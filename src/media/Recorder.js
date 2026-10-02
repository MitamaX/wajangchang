import { AudioBufferSource, BufferTarget, EncodedVideoPacketSource, Mp4OutputFormat, NullTarget, Output, QUALITY_HIGH, VideoSample, VideoSampleSource, canEncodeAudio, canEncodeVideo } from 'mediabunny';
import { MIX } from '../audio/mixdown.js';
import { RECORDING } from '../config.js';
import { createCanvas } from '../core/canvas.js';
import { fidelity } from '../core/fidelity.js';
import { Soundtrack } from './Soundtrack.js';

const PROBE = { width: 1280, height: 720 };
const FRAME_SECONDS = 1 / RECORDING.fps;
const KEY_FRAME_GAP = Math.round(RECORDING.preludeKeySeconds * RECORDING.fps);
const FRAMING = new Set(['starting', 'standby']);
const LISTENING = new Set(['starting', 'standby', 'recording']);
const CANCELLABLE = new Set(['standby', 'recording', 'closing', 'dubbing']);
const MP4 = 'video/mp4';
const OUTRO_SHARE = 0.3;

export function frameSize(aspect) {
  const long = fidelity.profile.longEdge;
  const even = (value) => Math.max(2, Math.round(value / 2) * 2);
  return aspect >= 1 ? { width: long, height: even(long / aspect) } : { width: even(long * aspect), height: long };
}

class Encoder {
  constructor({ onPacket, onFail }) {
    this.output = new Output({ format: new Mp4OutputFormat({ fastStart: 'fragmented' }), target: new NullTarget() });
    this.source = new VideoSampleSource({ codec: 'avc', quality: QUALITY_HIGH, onEncodedPacket: onPacket });
    this.output.addVideoTrack(this.source, { frameRate: RECORDING.fps });
    this.onFail = onFail;
    this.pending = 0;
    this.queue = this.output.start().catch(onFail);
  }

  get busy() {
    return this.pending >= RECORDING.backlog;
  }

  add(sample, options) {
    this.pending++;
    this.queue = this.queue
      .then(() => this.source.add(sample, options))
      .catch(this.onFail)
      .finally(() => {
        sample.close();
        this.pending--;
      });
    return this.queue;
  }

  async flush() {
    await this.queue;
    await this.output.finalize();
  }

  cancel() {
    this.output.cancel().catch(() => {});
  }
}

class Reel {
  constructor(withAudio) {
    this.output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    this.video = new EncodedVideoPacketSource('avc');
    this.output.addVideoTrack(this.video, { frameRate: RECORDING.fps });
    this.audio = withAudio ? new AudioBufferSource({ codec: 'aac', bitrate: QUALITY_HIGH }) : null;
    if (this.audio) this.output.addAudioTrack(this.audio);
    this.queue = Promise.resolve();
  }

  get blob() {
    return new Blob([this.output.target.buffer], { type: MP4 });
  }

  forward(packet, meta) {
    this.queue = this.queue.then(() => this.video.add(packet, meta));
  }

  async finalize() {
    await this.queue;
    await this.output.finalize();
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
    this.compose = null;
    this.soundtrack = null;
    this.encoder = null;
    this.preview = null;
    this.dub = null;
    this.held = [];
    this.keys = [];
    this.sinceKey = KEY_FRAME_GAP;
    this.decoderConfig = null;
    this.configSent = false;
    this.keyPending = false;
    this.cued = false;
    this.frames = 0;
    this.origin = 0;
    this.clock = 0;
    this.generation = 0;
  }

  get timeline() {
    return this.frames * FRAME_SECONDS - this.origin;
  }

  get recording() {
    return this.state === 'recording';
  }

  get saturated() {
    return Boolean(this.encoder && this.encoder.busy);
  }

  get lead() {
    return Math.max(0, this.timeline - this.clock);
  }

  get reels() {
    return [this.preview, this.dub].filter(Boolean);
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

  async begin(compose) {
    this.cancel();
    const generation = this.generation;
    this.canvas = null;
    this.compose = compose;
    this.cued = false;
    this.configSent = false;
    this.frames = 0;
    this.origin = 0;
    this.clock = 0;
    this.soundtrack = new Soundtrack();
    this.state = 'starting';
    const support = await this.probe();
    if (generation !== this.generation) return;
    if (!support.video) {
      this.state = 'unsupported';
      return;
    }
    const preview = new Reel(false);
    const dub = support.audio ? new Reel(true) : null;
    const reels = [preview, dub].filter(Boolean);
    try {
      await Promise.all(reels.map((reel) => reel.output.start()));
    } catch {
      this.state = 'failed';
      return;
    }
    if (generation !== this.generation) {
      reels.forEach((reel) => reel.cancel());
      return;
    }
    this.preview = preview;
    this.dub = dub;
    if (dub) this.soundtrack.attach(dub.audio);
    else this.soundtrack = null;
    this.state = 'standby';
    this.restartEncoder();
    if (this.cued) this.roll();
  }

  reframe(aspect) {
    if (!FRAMING.has(this.state)) return;
    const { width, height } = frameSize(aspect);
    if (this.canvas && this.canvas.width === width && this.canvas.height === height) return;
    this.canvas = createCanvas(width, height);
    this.context = this.canvas.getContext('2d', { alpha: false });
    if (this.state === 'standby') this.restartEncoder();
  }

  restartEncoder() {
    if (this.encoder) this.encoder.cancel();
    this.held = [];
    this.keys = [];
    this.sinceKey = KEY_FRAME_GAP;
    this.decoderConfig = null;
    const { generation } = this;
    const encoder = new Encoder({
      onPacket: (packet, meta) => {
        if (encoder === this.encoder) this.receive(packet, meta);
      },
      onFail: () => {
        if (encoder === this.encoder && generation === this.generation) this.state = 'failed';
      },
    });
    this.encoder = encoder;
  }

  cue(name, args) {
    if (this.soundtrack && LISTENING.has(this.state)) this.soundtrack.cue(name, args, this.clock);
  }

  elapse(seconds) {
    this.clock += seconds;
  }

  rehearse(seconds) {
    if (this.state !== 'standby') return;
    this.clock += seconds;
    let sample = null;
    for (; this.frames * FRAME_SECONDS <= this.clock; this.frames++) {
      if (this.encoder.busy) continue;
      sample = sample ? sample.clone() : this.shot();
      this.encode(sample, { keyFrame: this.markKeyFrame() });
    }
  }

  markKeyFrame() {
    const due = this.sinceKey >= KEY_FRAME_GAP;
    this.sinceKey = due ? 1 : this.sinceKey + 1;
    if (due) this.keys.push(this.frames * FRAME_SECONDS);
    return due;
  }

  preludeStart() {
    const cutoff = this.frames * FRAME_SECONDS - RECORDING.preludeSeconds;
    const reached = this.keys.filter((time) => time <= cutoff);
    return reached.length ? reached[reached.length - 1] : (this.keys[0] ?? this.frames * FRAME_SECONDS);
  }

  receive(packet, meta) {
    if (meta && meta.decoderConfig) this.decoderConfig = meta.decoderConfig;
    if (this.state === 'standby') this.hold(packet);
    else this.forward(packet);
  }

  hold(packet) {
    this.held.push(packet);
    const start = this.preludeStart();
    this.keys = this.keys.filter((time) => time >= start);
    this.held = this.held.filter(({ timestamp }) => timestamp >= start);
  }

  forward(packet) {
    if (packet.timestamp < this.origin) return;
    const shifted = packet.clone({ timestamp: packet.timestamp - this.origin });
    const meta = this.configSent ? undefined : { decoderConfig: this.decoderConfig };
    this.configSent = true;
    this.reels.forEach((reel) => reel.forward(shifted, meta));
  }

  roll() {
    if (this.state === 'starting') this.cued = true;
    if (this.state !== 'standby') return;
    this.origin = this.preludeStart();
    this.clock -= this.origin;
    if (this.soundtrack) this.soundtrack.shift(-this.origin);
    this.state = 'recording';
    this.keyPending = this.keys.length === 0;
    this.held.forEach((packet) => this.forward(packet));
    this.held = [];
    this.keys = [];
  }

  capture() {
    this.push(this.shot());
  }

  shot() {
    this.compose(this.context, this.canvas.width, this.canvas.height);
    return this.grab();
  }

  grab() {
    return new VideoSample(this.canvas, { timestamp: 0, duration: FRAME_SECONDS });
  }

  encode(sample, options) {
    sample.setTimestamp(this.frames * FRAME_SECONDS);
    return this.encoder.add(sample, options);
  }

  push(sample) {
    const added = this.encode(sample, this.keyPending ? { keyFrame: true } : undefined);
    this.keyPending = false;
    this.frames++;
    if (this.soundtrack) this.soundtrack.advance(this.timeline);
    return added;
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
        await this.push(this.grab());
        onProgress((OUTRO_SHARE * (i + 1)) / outroFrames);
      }
      await this.encoder.flush();
      await this.preview.finalize();
    } catch {
      this.state = 'failed';
      return null;
    }
    if (generation !== this.generation) return null;
    const preview = this.preview.blob;
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
    await dub.finalize();
    this.state = 'done';
    return dub.blob;
  }

  cancel() {
    this.generation++;
    if (CANCELLABLE.has(this.state)) [this.encoder, ...this.reels].forEach((part) => part && part.cancel());
    this.encoder = null;
    this.preview = null;
    this.dub = null;
    this.soundtrack = null;
    this.held = [];
    this.keys = [];
    this.state = 'idle';
  }
}
