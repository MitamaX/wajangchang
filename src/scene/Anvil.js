import { ANVIL } from '../config.js';
import { inkOutline, paintReticle, steel } from '../core/canvas.js';
import { randomBetween } from '../core/math.js';
import { Artillery } from './Artillery.js';

const SKY_GAP = 0.06;
const TUMBLE = 0.6;
const LIFE = Object.freeze({ ...ANVIL, radius: ANVIL.halfHeight });
const SILHOUETTE = [
  [-1, -1], [0.55, -1], [1, -0.72], [0.55, -0.42], [0.28, -0.42], [0.2, 0.3], [0.55, 0.62], [0.62, 1],
  [-0.62, 1], [-0.55, 0.62], [-0.2, 0.3], [-0.3, -0.42], [-0.86, -0.42], [-1, -0.6],
].map(([x, y]) => [x * ANVIL.halfWidth, y * ANVIL.halfHeight]);
const FACE = 'rgba(255,255,255,0.45)';

export class Anvil extends Artillery {
  constructor(room, physics, surface, { onHit, onLand, onDrop }) {
    super(room, physics, surface, ANVIL, { onHit, onLand });
    this.onDrop = onDrop;
    this.life = LIFE;
  }

  windUp() {
    if (!this.loaded) return;
    const y = -this.room.ceiling - ANVIL.halfHeight - SKY_GAP;
    this.launch({ x: this.aimX, y, angle: 0, vx: 0, vy: ANVIL.drop, spin: randomBetween(-TUMBLE, TUMBLE) });
    this.onDrop();
  }

  shape(body) {
    this.physics.attachBox(body, ANVIL.halfWidth, ANVIL.halfHeight, this.body);
  }

  probe(shot) {
    const [x, y] = [shot.x - Math.sin(shot.angle) * ANVIL.halfHeight, shot.y + Math.cos(shot.angle) * ANVIL.halfHeight];
    return this.surface.contactAt(x, y, ANVIL.halfWidth);
  }

  paint(context, pixel) {
    context.fillStyle = steel(context, 0, -ANVIL.halfHeight, 0, ANVIL.halfHeight);
    inkOutline(context, pixel);
    context.beginPath();
    SILHOUETTE.forEach(([x, y]) => context.lineTo(x, y));
    context.closePath();
    context.fill();
    context.stroke();
    context.strokeStyle = FACE;
    context.beginPath();
    context.moveTo(SILHOUETTE[0][0], SILHOUETTE[0][1]);
    context.lineTo(SILHOUETTE[1][0], SILHOUETTE[1][1]);
    context.stroke();
  }

  draw(context, pixelsPerMeter) {
    super.draw(context, pixelsPerMeter);
    if (this.present) paintReticle(context, this.aimX, this.aimY, 1 / pixelsPerMeter);
  }
}
