import { LAG } from '../config.js';
import { median } from '../core/math.js';

export class LagMeter {
  constructor() {
    this.intervals = [];
    this.span = 0;
    this.lagged = false;
  }

  record(seconds) {
    if (seconds > LAG.outlier) return;
    this.intervals.push(seconds);
    this.span += seconds;
    if (this.span < LAG.window) return;
    this.lagged = median(this.intervals) > 1 / LAG.minFps;
    this.intervals = [];
    this.span = 0;
  }

  takeLag() {
    const { lagged } = this;
    this.lagged = false;
    return lagged;
  }
}
