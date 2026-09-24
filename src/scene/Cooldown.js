export class Cooldown {
  constructor(seconds) {
    this.seconds = seconds;
    this.left = 0;
  }

  get ready() {
    return this.left <= 0;
  }

  trigger() {
    this.left = this.seconds;
  }

  tick(dt) {
    this.left = Math.max(0, this.left - dt);
  }
}
