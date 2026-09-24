import { AudioBufferSource, BufferTarget, EncodedVideoPacketSource, Mp4OutputFormat, Output, QUALITY_HIGH, VideoSample, VideoSampleSource, canEncodeAudio, canEncodeVideo } from 'mediabunny';
import { MIX } from '../audio/mixdown.js';
import { RECORDING } from '../config.js';
import { createCanvas } from '../core/canvas.js';
import { Soundtrack } from './Soundtrack.js';

const PROBE = { width: 1280, height: 720 };
const FRAME_SECONDS = 1 / RECORDING.fps;
const LISTENING = new Set(['starting', 'recording']);
const CANCELLABLE = new Set(['recording', 'closing', 'dubbing']);
const MP4 = 'video/mp4';
const OUTRO_SHARE = 0.3;

const mp4Output = () => new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
const mp4Blob = (output) => new Blob([output.target.buffer], { type: MP4 });

export function frameSize(aspect) {
  const long = RECORDING.longEdge;
  const even = (value) => Math.max(2, Math.round(value / 2) * 2);
  return aspect >= 1 ? { width: long, height: even(long / aspect) } : { width: even(long * aspect), height: long };
}

class Dub {
  constructor() {
    this.output = mp4Output();
    this.video = new EncodedVideoPacketSource('avc');
    this.audio = new AudioBufferSource({ codec: 'aac', bitrate: QUALITY_HIGH });
    this.output.addVideoTrack(this.video, { frameRate: RECORDING.fps });
    this.output.addAudioTrack(this.audio);
    this.queue = Promise.resolve();
  }

  forward(packet, meta) {
    this.queue = this.queue.then(() => this.video.add(packet, meta));
  }

  cancel() {
    this.output.cancel().catch(() => {});
  }
}

export class Recorder {
  constructor() {
    this.support = null;
    this.state = 'idle';
    this.canvas = null;
    this.context = null;
    this.output = null;
    this.source = null;
    this.dub = null;
    this.soundtrack = null;
    this.frames = 0;
    this.clock = 0;
    this.backlog = 0;
    this.queue = Promise.resolve();
    this.generation = 0;
  }

  get timeline() {
    return this.frames * FRAME_SECONDS;
  }

  get recording() {
    return this.state === 'recording';
  }

  get saturated() {
    return this.backlog >= RECORDING.backlog;
  }

  get lead() {
    return Math.max(0, this.timeline - this.clock);
  }

  probe() {
    if (!this.support) {
      this.support = Promise.all([
        canEncodeVideo('avc', { ...PROBE, quality: QUALITY_HIGH }).catch(() => false),
        canEncodeAudio('aac', { numberOfChannels: MIX.channels, sampleRate: MIX.sampleRate, bitrate: QUALITY_HIGH }).catch(() => false),
      ]).then(([video, audio]) => ({ video, audio }));
    }
    return this.support;
  }

  async begin(aspect) {
    this.cancel();
    const generation = this.generation;
    const { width, height } = frameSize(aspect);
    this.canvas = createCanvas(width, height);
    this.context = this.canvas.getContext('2d', { alpha: false });
    this.frames = 0;
    this.clock = 0;
    this.backlog = 0;
    this.queue = Promise.resolve();
    this.soundtrack = new Soundtrack();
    this.state = 'starting';
    const support = await this.probe();
    if (generation !== this.generation) return;
    if (!support.video) {
      this.state = 'unsupported';
      return;
    }
    const dub = support.audio ? new Dub() : null;
    const output = mp4Output();
    const source = new VideoSampleSource({
      codec: 'avc',
      quality: QUALITY_HIGH,
      onEncodedPacket: dub ? (packet, meta) => dub.forward(packet, meta) : undefined,
    });
    output.addVideoTrack(source, { frameRate: RECORDING.fps });
    try {
      await Promise.all([output.start(), dub && dub.output.start()]);
    } catch {
      this.state = 'failed';
      return;
    }
    if (generation !== this.generation) {
      output.cancel().catch(() => {});
      if (dub) dub.cancel();
      return;
    }
    this.output = output;
    this.source = source;
    this.dub = dub;
    if (dub) this.soundtrack.attach(dub.audio);
    else this.soundtrack = null;
    this.state = 'recording';
  }

  cue(name, args) {
    if (this.soundtrack && LISTENING.has(this.state)) this.soundtrack.cue(name, args, this.clock);
  }

  elapse(seconds) {
    this.clock += seconds;
  }

  capture(compose) {
    compose(this.context, this.canvas.width, this.canvas.height);
    this.push();
  }

  push() {
    const { source, generation } = this;
    const sample = new VideoSample(this.canvas, { timestamp: this.timeline, duration: FRAME_SECONDS });
    this.frames++;
    this.backlog++;
    if (this.soundtrack) this.soundtrack.advance(this.timeline);
    this.queue = this.queue
      .then(() => source.add(sample))
      .catch(() => {
        if (generation === this.generation) this.state = 'failed';
      })
      .finally(() => {
        sample.close();
        if (generation === this.generation) this.backlog--;
      });
    return this.queue;
  }

  async finish(paintOutro, outroCues, onProgress) {
    if (this.state !== 'recording') return null;
    const generation = this.generation;
    this.state = 'closing';
    const outroFrames = Math.round(RECORDING.outroSeconds * RECORDING.fps);
    const outroStart = this.timeline;
    if (this.soundtrack) outroCues.forEach(({ name, args = [], offset }) => this.soundtrack.cue(name, args, outroStart + offset));
    const still = createCanvas(this.canvas.width, this.canvas.height);
    still.getContext('2d').drawImage(this.canvas, 0, 0);
    try {
      for (let i = 0; i < outroFrames; i++) {
        if (generation !== this.generation) return null;
        this.context.drawImage(still, 0, 0);
        paintOutro(this.context, this.canvas.width, this.canvas.height, i / RECORDING.fps);
        await this.push();
        onProgress((OUTRO_SHARE * (i + 1)) / outroFrames);
      }
      await this.output.finalize();
    } catch {
      this.state = 'failed';
      return null;
    }
    if (generation !== this.generation) return null;
    const preview = mp4Blob(this.output);
    if (!this.dub) {
      this.state = 'done';
      onProgress(1);
      return { preview, final: Promise.resolve(preview) };
    }
    this.state = 'dubbing';
    return { preview, final: this.mux(onProgress).catch(() => preview) };
  }

  async mux(onProgress) {
    const { dub, soundtrack } = this;
    await dub.queue;
    await soundtrack.finish(this.timeline, (fraction) => onProgress(OUTRO_SHARE + (1 - OUTRO_SHARE) * fraction));
    await dub.output.finalize();
    this.state = 'done';
    return mp4Blob(dub.output);
  }

  cancel() {
    this.generation++;
    if (CANCELLABLE.has(this.state)) {
      if (this.output) this.output.cancel().catch(() => {});
      if (this.dub) this.dub.cancel();
    }
    this.output = null;
    this.source = null;
    this.dub = null;
    this.soundtrack = null;
    this.state = 'idle';
  }
}
