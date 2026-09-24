import { seededRandom } from '../core/math.js';
import { SOUNDS } from './sounds.js';
import { Synth } from './Synth.js';

export const MIX = Object.freeze({ sampleRate: 48000, channels: 1 });

export function mixdown(cues, from, seconds) {
  const context = new OfflineAudioContext(MIX.channels, Math.max(1, Math.round(seconds * MIX.sampleRate)), MIX.sampleRate);
  const synth = new Synth(context);
  cues.forEach(({ name, args, time, seed }) => {
    synth.random = seededRandom(seed);
    SOUNDS[name](synth, time - from, ...args);
  });
  return context.startRendering();
}

export function excerpt(buffer, offset, seconds) {
  const start = Math.round(offset * MIX.sampleRate);
  const length = Math.max(1, Math.round(seconds * MIX.sampleRate));
  const clip = new AudioBuffer({ length, numberOfChannels: MIX.channels, sampleRate: MIX.sampleRate });
  for (let channel = 0; channel < MIX.channels; channel++) {
    clip.copyToChannel(buffer.getChannelData(channel).subarray(start, start + length), channel);
  }
  return clip;
}
