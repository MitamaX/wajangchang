import { PILEDRIVER } from '../config.js';
import { easeIn, easeOut, lerp } from '../core/math.js';
import { Gantry } from './Gantry.js';
import { paintRam, paintRod } from './Rig.js';
import { Tool } from './Tool.js';

const RISE_SPEED = 1.2;
const Stroke = Object.freeze({ REST: 'rest', LIFT: 'lift', DROP: 'drop' });

export class Piledriver extends Tool {
  constructor(room, surface, { onPound }) {
    super(room);
    this.surface = surface;
    this.onPound = onPound;
    this.gantry = new Gantry(room, PILEDRIVER.halfWidth);
    this.holding = false;
    this.stroke = Stroke.REST;
    this.bottom = null;
    this.from = 0;
    this.to = 0;
    this.elapsed = 0;
  }

  get spills() {
    return false;
  }

  get rest() {
    return this.gantry.top + PILEDRIVER.height;
  }

  get raised() {
    return this.bottom === null || this.bottom <= this.rest;
  }

  get busy() {
    return this.holding || !this.raised;
  }

  get shown() {
    return this.active || !this.raised;
  }

  get focus() {
    return this.holding ? { x: this.gantry.x, y: this.bottom, radius: PILEDRIVER.halfWidth, charge: PILEDRIVER.tension } : null;
  }

  windUp() {
    this.holding = true;
    this.gantry.send(this.aimX);
  }

  release() {
    this.holding = false;
  }

  cancel() {
    this.holding = false;
  }

  stow() {
    super.stow();
    this.holding = false;
    this.stroke = Stroke.REST;
    this.bottom = null;
  }

  update(dt) {
    this.bottom = Math.max(this.bottom ?? this.rest, this.rest);
    if (!this.holding && this.raised) this.gantry.follow(this.aimX);
    if (this.holding && !this.gantry.arrived) this.gantry.travel(dt);
    else if (this.holding) this.cycle(dt);
    else this.rise(dt);
  }

  cycle(dt) {
    this.elapsed += dt;
    if (this.stroke === Stroke.REST) this.begin(Stroke.LIFT, Math.max(this.rest, this.surfaceY() - PILEDRIVER.lift));
    else if (this.stroke === Stroke.LIFT) this.move(PILEDRIVER.liftSeconds, easeOut, () => this.begin(Stroke.DROP, this.surfaceY()));
    else this.move(PILEDRIVER.dropSeconds, easeIn, () => this.pound());
  }

  begin(stroke, to) {
    this.stroke = stroke;
    this.from = this.bottom;
    this.to = to;
    this.elapsed = 0;
  }

  move(seconds, ease, arrive) {
    const progress = Math.min(1, this.elapsed / seconds);
    this.bottom = lerp(this.from, this.to, ease(progress));
    if (progress === 1) arrive();
  }

  surfaceY() {
    const { x } = this.gantry;
    const hit = this.surface.raycast(x, this.rest, x, 0);
    return hit ? hit.y : 0;
  }

  pound() {
    this.onPound({ ...PILEDRIVER.blow, x: this.gantry.x, y: this.bottom });
    this.begin(Stroke.LIFT, Math.max(this.rest, this.bottom - PILEDRIVER.lift));
  }

  rise(dt) {
    this.stroke = Stroke.REST;
    this.bottom = Math.max(this.rest, this.bottom - RISE_SPEED * dt);
  }

  draw(context, pixelsPerMeter) {
    if (!this.shown) return;
    const pixel = 1 / pixelsPerMeter;
    const bottom = this.bottom ?? this.rest;
    const top = bottom - PILEDRIVER.height;
    const { x, sky } = this.gantry;
    paintRod(context, pixel, x, sky, top, PILEDRIVER.rodWidth);
    paintRam(context, pixel, x, top, bottom, PILEDRIVER.halfWidth);
  }
}
