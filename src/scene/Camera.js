import { SPECIMEN, VIEW } from '../config.js';
import { TAU } from '../core/math.js';

const REFERENCE_SIDE = Math.sqrt(SPECIMEN.targetArea);

const SHAKE_REACH = 0.045;
const SHAKE_RATE = 34;
const SHAKE_HARMONIC = 1.73;
const SHAKE_BLEND = 0.6;
const MAX_ROLL = 0.035;
const TRAUMA_DECAY = 1.1;
const KICK_REACH = 0.035;
const KICK_FREQUENCY = 6;
const KICK_DECAY = 7;
const PUNCH_DECAY = 7;
const FLASH_DECAY = 5;
const TENSION_EASE = 8;
const TENSION_ZOOM = 0.06;
const TENSION_RUMBLE = 0.3;
const TENSION_VIGNETTE = 0.55;
const AXES = { x: 0, y: 1.9, roll: 4.3 };

const wave = (time, phase) => (Math.sin(time * SHAKE_RATE + phase) + SHAKE_BLEND * Math.sin(time * SHAKE_RATE * SHAKE_HARMONIC + phase * 2.3)) / (1 + SHAKE_BLEND);

export class Room {
  constructor(halfWidth, height) {
    this.halfWidth = halfWidth;
    this.height = height;
    this.ceiling = height;
  }

  static fitting(subjectWidth, subjectHeight) {
    const fit = (width, height) => Math.min(VIEW.subjectHeightShare / height, (VIEW.frameAspect * VIEW.subjectWidthShare) / width);
    const scale = Math.min(fit(subjectWidth, subjectHeight), fit(REFERENCE_SIDE, REFERENCE_SIDE));
    return new Room(VIEW.frameAspect / (2 * scale), VIEW.floorLine / scale);
  }

  get frameWidth() {
    return this.halfWidth * 2;
  }

  get frameHeight() {
    return this.height / VIEW.floorLine;
  }
}

export class Camera {
  constructor() {
    this.scale = 1;
    this.originX = 0;
    this.originY = 0;
    this.field = { x: 0, y: 0, width: 1, height: 1 };
    this.span = 1;
    this.time = 0;
    this.trauma = 0;
    this.kick = 0;
    this.kickAge = 0;
    this.punch = 0;
    this.flash = 0;
    this.tension = 0;
    this.tensionTarget = 0;
    this.focusX = 0;
    this.focusY = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.roll = 0;
    this.zoom = 1;
    this.lurch = 0;
  }

  frame(viewWidth, viewHeight, room) {
    this.scale = Math.min(viewWidth / room.frameWidth, viewHeight / room.frameHeight);
    const width = room.frameWidth * this.scale;
    const height = room.frameHeight * this.scale;
    this.field = { x: (viewWidth - width) / 2, y: viewHeight - height, width, height };
    this.originX = viewWidth / 2;
    this.originY = this.field.y + height * VIEW.floorLine;
    this.span = Math.min(width, height);
    room.ceiling = this.originY / this.scale;
  }

  impact({ trauma, kick, punch, flash }) {
    this.trauma = Math.max(this.trauma, trauma);
    this.kick = Math.max(this.lurch, kick * KICK_REACH * this.span);
    this.kickAge = 0;
    this.punch = Math.max(this.punch, punch);
    this.flash = Math.max(this.flash, flash);
  }

  brace(tension) {
    this.tensionTarget = tension ? tension.charge : 0;
    if (tension) [this.focusX, this.focusY] = this.toScreen(tension.x, tension.y);
  }

  update(dt, still) {
    this.time += dt;
    this.kickAge += dt;
    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY * dt);
    this.punch *= Math.exp(-PUNCH_DECAY * dt);
    this.flash *= Math.exp(-FLASH_DECAY * dt);
    this.tension += (this.tensionTarget - this.tension) * Math.min(1, TENSION_EASE * dt);
    const motion = still ? 0 : 1;
    const shake = Math.max(this.trauma, this.tension * TENSION_RUMBLE) ** 2 * motion;
    this.shakeX = shake * SHAKE_REACH * this.span * wave(this.time, AXES.x);
    this.shakeY = shake * SHAKE_REACH * this.span * wave(this.time, AXES.y);
    this.roll = this.trauma ** 2 * MAX_ROLL * wave(this.time, AXES.roll) * motion;
    this.lurch = this.kick * Math.exp(-KICK_DECAY * this.kickAge) * Math.cos(TAU * KICK_FREQUENCY * this.kickAge) * motion;
    this.zoom = 1 + (this.tension * TENSION_ZOOM + this.punch) * motion;
  }

  get vignette() {
    return this.tension * TENSION_VIGNETTE;
  }

  view(dpr) {
    const focusX = this.focusX * dpr;
    const focusY = this.focusY * dpr;
    return new DOMMatrix()
      .translateSelf(this.shakeX * dpr, (this.shakeY + this.lurch) * dpr)
      .translateSelf(focusX, focusY)
      .rotateSelf((this.roll * 180) / Math.PI)
      .scaleSelf(this.zoom, this.zoom)
      .translateSelf(-focusX, -focusY);
  }

  toWorld(screenX, screenY) {
    return [(screenX - this.originX) / this.scale, (screenY - this.originY) / this.scale];
  }

  toScreen(worldX, worldY) {
    return [this.originX + worldX * this.scale, this.originY + worldY * this.scale];
  }
}
