import { CLAW } from '../config.js';
import { HAZARD, inkOutline, radiate, steel, traceRoundRect } from '../core/canvas.js';
import { TAU, lerp } from '../core/math.js';
import { strokeOutlined } from './Chain.js';
import { Gantry } from './Gantry.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const RAIL = Object.freeze({ height: 0.012 });
const CARRIAGE = Object.freeze({ width: 0.06, height: 0.028 });
const CABLE = Object.freeze({ rest: 0.02, width: 1.4 });
const HUB = Object.freeze({ width: 0.046, height: 0.026, pivot: 0.35, glow: 0.02 });
const PRONG = Object.freeze({ length: 0.05, reach: 0.04, knee: 0.55, hook: 0.9, open: 0.75, closed: -0.12, thickness: 0.006, back: [0.6, 0.85] });
const FLOOR_GAP = 0.01;
const STEEL = '#b9bec2';
const STEEL_DARK = '#6c7176';
const OUTLINE = 'rgba(0,0,0,0.5)';
const CABLE_INK = 'rgba(30,32,35,0.9)';
const LAMP = '255,70,60';
const Stage = Object.freeze({ REST: 'rest', TRAVEL: 'travel', DROP: 'drop', CLOSE: 'close', LIFT: 'lift', SHAKE: 'shake', OPEN: 'open' });
const WINDING = new Set([Stage.TRAVEL, Stage.DROP, Stage.LIFT]);

function paintProng(context, pixel, x, y, side, angle) {
  const [kneeX, kneeY] = [x + side * Math.sin(angle) * PRONG.length * PRONG.knee, y + Math.cos(angle) * PRONG.length * PRONG.knee];
  const bend = angle - PRONG.hook;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(kneeX, kneeY);
  context.lineTo(kneeX + side * Math.sin(bend) * PRONG.length * (1 - PRONG.knee), kneeY + Math.cos(bend) * PRONG.length * (1 - PRONG.knee));
  strokeOutlined(context, pixel, PRONG.thickness, STEEL, OUTLINE);
}

export class Claw extends Tool {
  constructor(room, surface, { onGrasp, onSqueeze, onTug, onHurl, onWinch }) {
    super(room);
    this.surface = surface;
    this.onGrasp = onGrasp;
    this.onSqueeze = onSqueeze;
    this.onTug = onTug;
    this.onHurl = onHurl;
    this.onWinch = onWinch;
    this.gantry = new Gantry(room, CLAW.margin);
    this.stage = Stage.REST;
    this.elapsed = 0;
    this.depth = 0;
    this.closure = 0;
    this.anchor = null;
    this.winches = new Pulse(CLAW.winchSeconds);
    this.crushes = new Pulse(CLAW.crushSeconds);
  }

  get spills() {
    return false;
  }

  get shown() {
    return this.active || this.busy;
  }

  get busy() {
    return this.stage !== Stage.REST;
  }

  get pending() {
    return this.anchor !== null || [Stage.TRAVEL, Stage.DROP, Stage.CLOSE].includes(this.stage);
  }

  get x() {
    const sway = this.stage === Stage.SHAKE ? Math.sin(this.elapsed * CLAW.shakeRate * TAU) * CLAW.shake : 0;
    return this.gantry.x + sway;
  }

  get rest() {
    return this.gantry.top + CARRIAGE.height + CABLE.rest + HUB.height + PRONG.reach;
  }

  get mouth() {
    return this.rest + this.depth;
  }

  get jaws() {
    return { x: this.x, y: this.mouth, span: CLAW.span };
  }

  get focus() {
    return this.anchor ? { x: this.x, y: this.mouth, radius: CLAW.span, charge: CLAW.tension } : null;
  }

  windUp() {
    if (this.stage !== Stage.REST) return;
    this.gantry.send(this.aimX);
    this.enter(Stage.TRAVEL);
  }

  stow() {
    super.stow();
    this.enter(Stage.REST);
    this.depth = 0;
    this.closure = 0;
    this.anchor = null;
  }

  enter(stage) {
    this.stage = stage;
    this.elapsed = 0;
  }

  update(dt) {
    this.elapsed += dt;
    if (WINDING.has(this.stage) && this.winches.tick(dt)) this.onWinch(CLAW.winchSeconds);
    if (this.stage === Stage.REST) this.gantry.follow(this.aimX);
    else if (this.stage === Stage.TRAVEL) this.travel(dt);
    else if (this.stage === Stage.DROP) this.drop(dt);
    else if (this.stage === Stage.CLOSE) this.close();
    else if (this.stage === Stage.LIFT) this.lift(dt);
    else if (this.stage === Stage.SHAKE) this.shake();
    else this.open();
    if (this.anchor) this.carry(dt);
  }

  carry(dt) {
    if (this.crushes.tick(dt)) this.onSqueeze(this.jaws);
    if (!this.onTug(this.anchor, this.x, this.mouth, dt)) this.anchor = null;
  }

  travel(dt) {
    this.gantry.travel(dt);
    if (this.gantry.arrived) this.enter(Stage.DROP);
  }

  drop(dt) {
    const { x } = this.gantry;
    const hit = this.surface.raycast(x, this.rest, x, 0);
    const bottom = (hit ? hit.y + CLAW.bite : -FLOOR_GAP) - this.rest;
    this.depth = Math.min(this.depth + CLAW.drop * dt, bottom);
    if (this.depth >= bottom) this.enter(Stage.CLOSE);
  }

  close() {
    this.closure = Math.min(1, this.elapsed / CLAW.closeSeconds);
    if (this.closure < 1) return;
    this.anchor = this.onGrasp(this.jaws);
    this.enter(Stage.LIFT);
  }

  lift(dt) {
    this.depth = Math.max(0, this.depth - CLAW.lift * dt);
    if (!this.depth) this.enter(Stage.SHAKE);
  }

  shake() {
    if (this.elapsed < CLAW.shakeSeconds) return;
    if (this.anchor) this.onHurl(this.anchor);
    this.anchor = null;
    this.enter(Stage.OPEN);
  }

  open() {
    this.closure = Math.max(0, 1 - this.elapsed / CLAW.openSeconds);
    if (!this.closure) this.enter(Stage.REST);
  }

  draw(context, pixelsPerMeter) {
    if (!this.shown) return;
    const pixel = 1 / pixelsPerMeter;
    const { x, mouth } = this;
    const { top } = this.gantry;
    const { halfWidth } = this.room;
    const hubTop = mouth - PRONG.reach - HUB.height;
    const hubBottom = hubTop + HUB.height;
    const angle = lerp(PRONG.open, PRONG.closed, this.closure);
    context.save();
    inkOutline(context, pixel);
    context.fillStyle = steel(context, 0, top - RAIL.height / 2, 0, top + RAIL.height / 2);
    context.fillRect(-halfWidth, top - RAIL.height / 2, halfWidth * 2, RAIL.height);
    context.strokeRect(-halfWidth, top - RAIL.height / 2, halfWidth * 2, RAIL.height);
    context.strokeStyle = CABLE_INK;
    context.lineWidth = CABLE.width * pixel;
    context.beginPath();
    context.moveTo(this.gantry.x, top + CARRIAGE.height);
    context.lineTo(x, hubTop);
    context.stroke();
    inkOutline(context, pixel);
    context.fillStyle = HAZARD;
    context.fillRect(this.gantry.x - CARRIAGE.width / 2, top, CARRIAGE.width, CARRIAGE.height);
    context.strokeRect(this.gantry.x - CARRIAGE.width / 2, top, CARRIAGE.width, CARRIAGE.height);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(x, hubBottom);
    context.lineTo(x, hubBottom + PRONG.length * lerp(...PRONG.back, this.closure));
    strokeOutlined(context, pixel, PRONG.thickness, STEEL_DARK, OUTLINE);
    [-1, 1].forEach((side) => paintProng(context, pixel, x + side * HUB.width * HUB.pivot, hubBottom, side, angle));
    inkOutline(context, pixel);
    context.fillStyle = steel(context, x - HUB.width / 2, 0, x + HUB.width / 2, 0);
    traceRoundRect(context, x - HUB.width / 2, hubTop, HUB.width, HUB.height, HUB.height * 0.4);
    context.fill();
    context.stroke();
    context.restore();
    if (this.busy) radiate(context, x, hubTop + HUB.height / 2, HUB.glow, [[0, `rgba(${LAMP},0.9)`], [1, `rgba(${LAMP},0)`]]);
  }
}
