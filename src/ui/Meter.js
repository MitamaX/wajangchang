import { wholePercent } from '../core/format.js';

export class Meter {
  constructor(bar, fill, percent) {
    this.bar = bar;
    this.fill = fill;
    this.percent = percent;
  }

  show(fraction) {
    const percent = wholePercent(fraction);
    this.fill.style.width = `${(fraction * 100).toFixed(1)}%`;
    this.percent.textContent = `${percent}%`;
    this.bar.setAttribute('aria-valuenow', String(percent));
  }
}
