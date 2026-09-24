import { LIGHTNING } from '../config.js';
import { paintReticle, radiate, strokeLayers } from '../core/canvas.js';
import { TAU, clamp, normalize, randomBetween, randomInt, rotate } from '../core/math.js';
import { Tool } from './Tool.js';

const SKY_GAP = 0.05;
const BRANCH_TURN = 0.7;
const BRANCH_SHARE = 0.5;
const LEADER = Object.freeze({ width: 1.6, alpha: 0.6, tip: 0.035 });
const CHANNEL = Object.freeze({ halo: 30, glow: 11, core: 3.4, haloAlpha: 0.16, glowAlpha: 0.5 });
const STROKE_DECAY = 14;
const FLICKER = [0.75, 1];
const SPOT_REACH = 0.1;
const CLOUD = Object.freeze({ puffs: 12, spread: 0.34, drop: [-0.02, 0.07], size: [0.07, 0.15], fadeIn: 0.6, glow: 0.3 });
const STREAMERS = Object.freeze({ count: 3, reach: [0.025, 0.06], depth: 2 });
const CRAWL = Object.freeze({ count: 5, reach: [0.04, 0.11], depth: 3, seconds: 0.05, fade: 0.5 });
const SKY_TINT = '150,185,255';
const ARC = '150,190,255';
const ARC_CORE = '245,249,255';
const CLOUD_BODY = '54,60,74';
const CLOUD_EDGE = '36,40,50';

function jagged(ax, ay, bx, by, depth) {
  let path = [ax, ay, bx, by];
  for (let level = 0; level < depth; level++) {
    const next = [path[0], path[1]];
    for (let i = 2; i < path.length; i += 2) {
      const [fromX, fromY, toX, toY] = path.slice(i - 2, i + 2);
      const [normalX, normalY] = normalize(fromY - toY, toX - fromX);
      const offset = randomBetween(-LIGHTNING.jag, LIGHTNING.jag) * Math.hypot(toX - fromX, toY - fromY);
      next.push((fromX + toX) / 2 + normalX * offset, (fromY + toY) / 2 + normalY * offset, toX, toY);
    }
    path = next;
  }
  return path;
}

function sprout(x, y, heading, [low, high], depth) {
  const reach = randomBetween(low, high);
  return jagged(x, y, x + Math.cos(heading) * reach, y + Math.sin(heading) * reach, depth);
}

function tracePath(context, path, share = 1) {
  const last = Math.max(2, Math.round((path.length / 2 - 1) * share) * 2);
  context.beginPath();
  context.moveTo(path[0], path[1]);
  for (let i = 2; i <= last; i += 2) context.lineTo(path[i], path[i + 1]);
  return [path[last], path[last + 1]];
}

function paintChannel(context, pixel, path, brightness, width = 1) {
  tracePath(context, path);
  strokeLayers(context, pixel * width, [
    [CHANNEL.halo, `rgba(${ARC},${CHANNEL.haloAlpha * brightness})`],
    [CHANNEL.glow, `rgba(${ARC},${CHANNEL.glowAlpha * brightness})`],
    [CHANNEL.core, `rgba(${ARC_CORE},${brightness})`],
  ]);
}

function paintSpark(context, x, y, radius, brightness) {
  radiate(context, x, y, radius, [
    [0, `rgba(${ARC_CORE},${brightness})`],
    [0.25, `rgba(${ARC},${0.6 * brightness})`],
    [1, `rgba(${ARC},0)`],
  ]);
}

function paintCloud(context, puffs, alpha, glow, { x: originX, y: top }) {
  puffs.forEach(({ x, y, size }) => {
    const gradient = context.createRadialGradient(x, y - size * 0.3, 0, x, y, size);
    gradient.addColorStop(0, `rgba(${CLOUD_BODY},${alpha})`);
    gradient.addColorStop(0.7, `rgba(${CLOUD_EDGE},${0.85 * alpha})`);
    gradient.addColorStop(1, `rgba(${CLOUD_EDGE},0)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, size, 0, TAU);
    context.fill();
  });
  if (glow > 0) radiate(context, originX, top + CLOUD.drop[1], CLOUD.spread * CLOUD.glow * 3, [[0, `rgba(${ARC_CORE},${0.8 * glow})`], [0.4, `rgba(${ARC},${0.35 * glow})`], [1, `rgba(${ARC},0)`]]);
}

class Bolt {
  constructor(fromX, top, toX, toY) {
    this.path = jagged(fromX, top - SKY_GAP, toX, toY, LIGHTNING.depth);
    this.branches = Array.from({ length: LIGHTNING.branches }, () => this.branch());
    this.puffs = Array.from({ length: CLOUD.puffs }, (_, i) => ({
      x: fromX + ((i + randomBetween(0, 1)) / CLOUD.puffs - 0.5) * CLOUD.spread * 2,
      y: top + randomBetween(...CLOUD.drop),
      size: randomBetween(...CLOUD.size),
    }));
    this.origin = { x: fromX, y: top };
    this.target = { x: toX, y: toY };
    this.streamers = [];
    this.crawls = [];
    this.age = 0;
    this.struck = false;
  }

  branch() {
    const node = randomInt(2, this.path.length / 2 - 3) * 2;
    const [x, y, nextX, nextY] = this.path.slice(node, node + 4);
    const [dx, dy] = rotate(...normalize(nextX - x, nextY - y), randomBetween(-BRANCH_TURN, BRANCH_TURN));
    return sprout(x, y, Math.atan2(dy, dx), LIGHTNING.branchReach, LIGHTNING.depth - 1);
  }

  get due() {
    return !this.struck && this.age >= LIGHTNING.leaderSeconds;
  }

  get since() {
    return this.age - LIGHTNING.leaderSeconds;
  }

  get gone() {
    return this.since >= LIGHTNING.boltSeconds + LIGHTNING.fadeSeconds;
  }

  get brightness() {
    const { since } = this;
    if (since < 0) return 0;
    const pulse = Math.max(...LIGHTNING.strokes.filter((at) => since >= at).map((at) => Math.exp(-STROKE_DECAY * (since - at))));
    const fade = clamp(1 - (since - LIGHTNING.boltSeconds) / LIGHTNING.fadeSeconds, 0, 1);
    return Math.min(1, pulse + LIGHTNING.afterglow * fade) * randomBetween(...FLICKER);
  }

  get cloud() {
    const rise = Math.min(1, this.age / (LIGHTNING.leaderSeconds * CLOUD.fadeIn));
    const fall = clamp(1 - this.since / (LIGHTNING.boltSeconds + LIGHTNING.fadeSeconds), 0, 1);
    return Math.min(rise, fall);
  }

  update(dt) {
    this.age += dt;
    const { x, y } = this.target;
    if (!this.struck) {
      this.streamers = Array.from({ length: STREAMERS.count }, () => sprout(x, y, -Math.PI / 2 + randomBetween(-0.8, 0.8), STREAMERS.reach, STREAMERS.depth));
      return;
    }
    this.streamers = [];
    if (this.since < LIGHTNING.boltSeconds && (!this.crawls.length || Math.random() < dt / CRAWL.seconds)) {
      this.crawls = Array.from({ length: CRAWL.count }, () => sprout(x, y, randomBetween(0, TAU), CRAWL.reach, CRAWL.depth));
    }
  }

  draw(context, pixel) {
    const { brightness } = this;
    paintCloud(context, this.puffs, this.cloud, brightness * CLOUD.glow, this.origin);
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    context.lineJoin = 'round';
    if (this.struck) this.drawStrike(context, pixel, brightness);
    else this.drawLeader(context, pixel);
    context.restore();
  }

  drawLeader(context, pixel) {
    const share = this.age / LIGHTNING.leaderSeconds;
    const alpha = LEADER.alpha * randomBetween(...FLICKER);
    context.strokeStyle = `rgba(${ARC},${alpha})`;
    context.lineWidth = LEADER.width * pixel;
    const [tipX, tipY] = tracePath(context, this.path, share);
    context.stroke();
    const forks = Math.max(0, share * 2 - 1);
    if (forks) this.branches.forEach((branch) => {
      tracePath(context, branch, forks);
      context.stroke();
    });
    this.streamers.forEach((streamer) => {
      tracePath(context, streamer);
      context.stroke();
    });
    paintSpark(context, tipX, tipY, LEADER.tip, alpha);
  }

  drawStrike(context, pixel, brightness) {
    paintChannel(context, pixel, this.path, brightness);
    this.branches.forEach((branch) => paintChannel(context, pixel, branch, brightness * BRANCH_SHARE, BRANCH_SHARE));
    const crawling = clamp(1 - this.since / (LIGHTNING.boltSeconds * CRAWL.fade * 2), 0, 1);
    this.crawls.forEach((crawl) => paintChannel(context, pixel, crawl, crawling, BRANCH_SHARE * 0.6));
    paintSpark(context, this.target.x, this.target.y, SPOT_REACH, brightness);
  }
}

export class Lightning extends Tool {
  constructor(room, { onStrike, onCharge }) {
    super(room);
    this.onStrike = onStrike;
    this.onCharge = onCharge;
    this.bolts = [];
    this.clock = 0;
    this.lastBolt = -Infinity;
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
    if (this.clock - this.lastBolt < LIGHTNING.cooldown) return;
    this.lastBolt = this.clock;
    const reach = this.room.halfWidth;
    const fromX = clamp(this.aimX + randomBetween(-LIGHTNING.drift, LIGHTNING.drift), -reach, reach);
    this.bolts.push(new Bolt(fromX, -this.room.ceiling, this.aimX, this.aimY));
    this.onCharge();
  }

  stow() {
    super.stow();
    this.bolts = [];
  }

  update(dt) {
    this.clock += dt;
    this.bolts.forEach((bolt) => {
      bolt.update(dt);
      if (!bolt.due) return;
      bolt.struck = true;
      this.onStrike(bolt.path, { ...LIGHTNING.blow, ...bolt.target });
    });
    this.bolts = this.bolts.filter((bolt) => !bolt.gone);
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.bolts.forEach((bolt) => bolt.draw(context, pixel));
    this.drawSky(context);
    if (this.present) paintReticle(context, this.aimX, this.aimY, pixel);
  }

  drawSky(context) {
    const flash = Math.max(0, ...this.bolts.map((bolt) => (bolt.struck ? bolt.brightness : 0)));
    if (flash <= 0) return;
    const { halfWidth, ceiling } = this.room;
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = `rgba(${SKY_TINT},${LIGHTNING.skyFlash * flash})`;
    context.fillRect(-halfWidth * 2, -ceiling * 2, halfWidth * 4, ceiling * 3);
    context.restore();
  }
}
