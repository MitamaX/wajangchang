const PULSE_TOLERANCE = 1e-6;

export class Pulse {
  constructor(period) {
    this.period = period;
    this.wait = 0;
  }

  reset() {
    this.wait = 0;
  }

  tick(dt) {
    this.wait -= dt;
    if (this.wait > PULSE_TOLERANCE) return false;
    this.wait = Math.max(this.wait + this.period, 0);
    return true;
  }
}
