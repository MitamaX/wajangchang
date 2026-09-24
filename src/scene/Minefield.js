import { MINE } from '../config.js';
import { inkOutline, radiate, steel } from '../core/canvas.js';
import { TAU } from '../core/math.js';
import { Blasts } from './Blasts.js';
import { Tool } from './Tool.js';

const RADIUS = MINE.radius;
const SHELL = Object.freeze({ height: RADIUS * 0.55, cap: RADIUS * 0.45, capHeight: RADIUS * 0.3 });
const LED_HALO = RADIUS * 0.7;
const PREVIEW_ALPHA = 0.5;
const CASING = ['#6c7458', '#353b29'];
const LED_ARMED = '255,60,50';
const LED_SAFE = '120,255,120';

function paintMine(context, pixel, x, lit, armed) {
  const shade = context.createLinearGradient(x - RADIUS, 0, x + RADIUS, 0);
  shade.addColorStop(0, CASING[0]);
  shade.addColorStop(1, CASING[1]);
  inkOutline(context, pixel);
  context.fillStyle = shade;
  context.beginPath();
  context.ellipse(x, -SHELL.height / 2, RADIUS, SHELL.height / 2, 0, Math.PI, TAU);
  context.lineTo(x + RADIUS, 0);
  context.lineTo(x - RADIUS, 0);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = steel(context, x - SHELL.cap, 0, x + SHELL.cap, 0);
  context.fillRect(x - SHELL.cap / 2, -SHELL.height - SHELL.capHeight, SHELL.cap, SHELL.capHeight);
  context.strokeRect(x - SHELL.cap / 2, -SHELL.height - SHELL.capHeight, SHELL.cap, SHELL.capHeight);
  if (!lit) return;
  const tint = armed ? LED_ARMED : LED_SAFE;
  radiate(context, x, -SHELL.height - SHELL.capHeight, LED_HALO, [[0, `rgba(${tint},0.9)`], [1, `rgba(${tint},0)`]]);
}

class Mine {
  constructor(x) {
    this.x = x;
    this.age = 0;
  }

  get armed() {
    return this.age >= MINE.armSeconds;
  }

  get lit() {
    return (this.age * MINE.blinkRate) % 1 < 0.5;
  }
}

export class Minefield extends Tool {
  constructor(room, surface, { onPlant, onBlast }) {
    super(room);
    this.surface = surface;
    this.onPlant = onPlant;
    this.onBlast = onBlast;
    this.mines = [];
    this.blasts = new Blasts(MINE.blastSeconds);
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.blasts.busy;
  }

  windUp() {
    if (this.mines.length >= MINE.capacity) return;
    this.mines.push(new Mine(this.aimX));
    this.onPlant();
  }

  stow() {
    super.stow();
    this.mines = [];
  }

  update(dt) {
    this.blasts.update(dt);
    this.mines.forEach((mine) => {
      mine.age += dt;
    });
    const tripped = this.mines.filter((mine) => mine.armed && this.surface.contactAt(mine.x, -SHELL.height, MINE.trigger));
    if (!tripped.length) return;
    this.mines = this.mines.filter((mine) => !tripped.includes(mine));
    tripped.forEach((mine) => {
      const blow = { ...MINE.blow, x: mine.x, y: -SHELL.height };
      this.blasts.add(blow);
      this.onBlast(blow);
    });
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.blasts.draw(context, pixel);
    this.mines.forEach((mine) => paintMine(context, pixel, mine.x, mine.lit, mine.armed));
    if (!this.present) return;
    context.save();
    context.globalAlpha = PREVIEW_ALPHA;
    paintMine(context, pixel, this.aimX, false, false);
    context.restore();
  }
}
