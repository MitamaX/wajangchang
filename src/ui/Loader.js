import { sum } from '../core/math.js';
import { byId } from './dom.js';
import { Meter } from './Meter.js';

export class Loader {
  constructor(shares) {
    this.root = byId('loader');
    this.meter = new Meter(byId('loaderMeter'), byId('loaderFill'), byId('loaderPercent'));
    this.shares = shares;
    this.fractions = Object.fromEntries(Object.keys(shares).map((key) => [key, 0]));
    this.total = sum(Object.values(shares));
  }

  update(key, fraction) {
    this.fractions[key] = fraction;
    const done = sum(Object.entries(this.shares).map(([name, weight]) => weight * this.fractions[name]));
    this.meter.show(done / this.total);
  }

  async track(key, promise) {
    const value = await promise;
    this.update(key, 1);
    return value;
  }

  close() {
    this.root.hidden = true;
  }
}
