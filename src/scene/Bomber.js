import { BOMB } from '../config.js';
import { Blasts } from './Blasts.js';
import { Bomb, drawBomb } from './Bomb.js';
import { Tool } from './Tool.js';

const PREVIEW_ALPHA = 0.55;
const BLAST_SECONDS = 0.45;

export class Bomber extends Tool {
  constructor(room, surface, { onStrike, onPlant, onTick }) {
    super(room);
    this.surface = surface;
    this.onStrike = onStrike;
    this.onPlant = onPlant;
    this.onTick = onTick;
    this.bombs = [];
    this.blasts = new Blasts(BLAST_SECONDS);
  }

  get busy() {
    return this.bombs.length > 0 || this.blasts.busy;
  }

  get pending() {
    return this.bombs.length > 0;
  }

  windUp() {
    if (this.bombs.length >= BOMB.capacity) return;
    this.bombs.push(new Bomb(this.aimX, this.aimY, this.surface.grip(this.aimX, this.aimY, BOMB.size)));
    this.onPlant();
  }

  stow() {
    this.bombs = [];
    this.present = false;
  }

  update(dt) {
    this.blasts.update(dt);
    this.bombs.forEach((bomb) => {
      if (bomb.update(dt, this.surface)) this.onTick();
    });
    const due = this.bombs.filter((bomb) => bomb.due);
    this.bombs = this.bombs.filter((bomb) => !bomb.due);
    due.forEach((bomb) => this.detonate(bomb));
  }

  detonate(bomb) {
    const blow = bomb.blow();
    this.blasts.add(blow);
    this.onStrike(blow);
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.blasts.draw(context, pixel);
    this.bombs.forEach((bomb) => bomb.draw(context, pixel));
    if (this.present) this.drawPreview(context, pixel);
  }

  drawPreview(context, pixel) {
    context.save();
    context.globalAlpha = PREVIEW_ALPHA;
    drawBomb(context, pixel, { x: this.aimX, y: this.aimY });
    context.restore();
  }
}
