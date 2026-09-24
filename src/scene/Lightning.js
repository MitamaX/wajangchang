import { LIGHTNING } from '../config.js';
import { paintReticle } from '../core/canvas.js';
import { clamp, normalize, randomBetween, randomInt, rotate } from '../core/math.js';
import { jagged, paintArc, paintLeader, paintSpark } from './Arc.js';
import { Tool } from './Tool.js';

const SKY_GAP = 0.05;
const BRANCH_TURN = 0.7;
const LEADER = Object.freeze({ width: 1.5, alpha: 0.55 });
const BRANCH_SHARE = 0.55;
const STEADY_SHARE = 0.15;
const FLICKER = [0.35, 1];
const SPOT_REACH = 0.07;

class Bolt {
  constructor(fromX, fromY, toX, toY) {
    this.path = jagged(fromX, fromY, toX, toY, LIGHTNING.depth, LIGHTNING.jag);
    this.branches = Array.from({ length: LIGHTNING.branches }, () => this.branch());
    this.target = { x: toX, y: toY };
    this.age = 0;
    this.struck = false;
  }

  branch() {
    const node = randomInt(1, this.path.length / 2 - 2) * 2;
    const [x, y, nextX, nextY] = this.path.slice(node, node + 4);
    const [dx, dy] = rotate(...normalize(nextX - x, nextY - y), randomBetween(-BRANCH_TURN, BRANCH_TURN));
    const reach = randomBetween(...LIGHTNING.branchReach);
    return jagged(x, y, x + dx * reach, y + dy * reach, LIGHTNING.depth - 1, LIGHTNING.jag);
  }

  get due() {
    return !this.struck && this.age >= LIGHTNING.leaderSeconds;
  }

  get gone() {
    return this.age >= LIGHTNING.leaderSeconds + LIGHTNING.boltSeconds;
  }

  get brightness() {
    const t = (this.age - LIGHTNING.leaderSeconds) / LIGHTNING.boltSeconds;
    return (1 - t) * (t < STEADY_SHARE ? 1 : randomBetween(...FLICKER));
  }

  draw(context, pixel) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    context.lineJoin = 'round';
    if (this.struck) this.drawStrike(context, pixel);
    else paintLeader(context, pixel, this.path, this.age / LIGHTNING.leaderSeconds, LEADER.alpha, LEADER.width);
    context.restore();
  }

  drawStrike(context, pixel) {
    const { brightness } = this;
    paintArc(context, pixel, this.path, brightness);
    this.branches.forEach((branch) => paintArc(context, pixel, branch, brightness * BRANCH_SHARE, BRANCH_SHARE));
    paintSpark(context, this.target.x, this.target.y, SPOT_REACH, brightness);
  }
}

export class Lightning extends Tool {
  constructor(room, { onStrike }) {
    super(room);
    this.onStrike = onStrike;
    this.bolts = [];
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.bolts.length > 0;
  }

  get pending() {
    return this.bolts.some((bolt) => !bolt.struck);
  }

  windUp() {
    this.spawn(this.aimX, this.aimY);
  }

  spawn(x, y) {
    const reach = this.room.halfWidth;
    const fromX = clamp(x + randomBetween(-LIGHTNING.drift, LIGHTNING.drift), -reach, reach);
    this.bolts.push(new Bolt(fromX, -this.room.ceiling - SKY_GAP, x, y));
  }

  stow() {
    super.stow();
    this.bolts = [];
  }

  update(dt) {
    this.bolts.forEach((bolt) => {
      bolt.age += dt;
      if (!bolt.due) return;
      bolt.struck = true;
      this.onStrike(bolt.path, { ...LIGHTNING.blow, ...bolt.target });
    });
    this.bolts = this.bolts.filter((bolt) => !bolt.gone);
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.bolts.forEach((bolt) => bolt.draw(context, pixel));
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }
}
