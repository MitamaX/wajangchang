import { excerpt, mixdown } from '../audio/mixdown.js';

const CHUNK_SECONDS = 4;
const PREROLL_SECONDS = 3;
const REMAINDER_TOLERANCE = 1e-3;

export class Soundtrack {
  constructor() {
    this.source = null;
    this.cues = [];
    this.seed = 1;
    this.rendered = 0;
    this.work = Promise.resolve();
    this.working = false;
  }

  attach(source) {
    this.source = source;
  }

  cue(name, args, time) {
    this.cues.push({ name, args, time, seed: this.seed++ });
  }

  advance(timeline) {
    if (!this.source || this.working || timeline < this.rendered + CHUNK_SECONDS) return;
    this.working = true;
    this.work = this.render(CHUNK_SECONDS).finally(() => {
      this.working = false;
    });
  }

  async render(seconds) {
    const from = this.rendered;
    const base = from - PREROLL_SECONDS;
    const cues = this.cues.filter(({ time }) => time >= base && time < from + seconds);
    const mixed = await mixdown(cues, base, PREROLL_SECONDS + seconds);
    await this.source.add(excerpt(mixed, PREROLL_SECONDS, seconds));
    this.rendered = from + seconds;
    this.cues = this.cues.filter(({ time }) => time >= this.rendered - PREROLL_SECONDS);
  }

  async finish(total, onProgress) {
    await this.work;
    const chunks = Math.max(1, Math.ceil((total - this.rendered) / CHUNK_SECONDS));
    for (let done = 0; total - this.rendered > REMAINDER_TOLERANCE; done++) {
      onProgress(done / chunks);
      await this.render(Math.min(CHUNK_SECONDS, total - this.rendered));
    }
    onProgress(1);
  }
}
