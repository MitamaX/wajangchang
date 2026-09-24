import { clockTime } from '../core/format.js';
import { tidyName } from '../core/naming.js';
import { byId } from './dom.js';
import { Meter } from './Meter.js';

const PAINT_INTERVAL = 0.1;

export class StatusBar {
  constructor() {
    this.nameInput = byId('targetName');
    this.materialTag = byId('materialTag');
    this.meter = new Meter(byId('meter'), byId('meterFill'), byId('percent'));
    this.timer = byId('timer');
    this.lastPaint = -Infinity;
  }

  get name() {
    return tidyName(this.nameInput.value);
  }

  set name(value) {
    this.nameInput.value = value;
  }

  set material(label) {
    this.materialTag.textContent = label || '';
    this.materialTag.hidden = !label;
  }

  show(progress, seconds, now, force = false) {
    if (!force && now - this.lastPaint < PAINT_INTERVAL) return;
    this.lastPaint = now;
    this.meter.show(progress);
    this.timer.textContent = clockTime(seconds);
  }
}
