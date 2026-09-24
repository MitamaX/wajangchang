import { METEOR } from '../config.js';
import { radiate } from '../core/canvas.js';
import { TAU, clamp, normalize, polar, randomBetween, randomSign } from '../core/math.js';
import { Launcher } from './Launcher.js';
import { Shell } from './Shell.js';

const SKY_GAP = 0.08;
const CORNERS = 8;
const ROUGHNESS = [0.72, 1.1];
const SPIN = 9;
const TRAIL_WIDTH = 2.2;
const TRAIL_ALPHA = 0.85;
const HALO_REACH = 2.8;
const OUTLINE_WIDTH = 1.2;
const OUTLINE = 'rgba(40,12,4,0.7)';
const ROCK_CORE = '#6b4a36';
const ROCK_RIM = '#1f130d';
const GLOW_HOT = '255,236,190';
const GLOW = '255,120,40';
const GLOW_EDGE = '200,40,10';

class Rock extends Shell {
  constructor(options) {
    super(options);
    this.outline = Array.from({ length: CORNERS }, (_, corner) => polar((corner / CORNERS) * TAU, METEOR.size * randomBetween(...ROUGHNESS)));
    this.spin = randomBetween(-SPIN, SPIN);
  }
}

function paintTrail(context, { x, y, trail }) {
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.lineCap = 'round';
  trail.reduce(([fromX, fromY], [toX, toY], index) => {
    const fade = 1 - index / trail.length;
    context.strokeStyle = `rgba(${index < 2 ? GLOW_HOT : GLOW},${TRAIL_ALPHA * fade})`;
    context.lineWidth = METEOR.size * TRAIL_WIDTH * fade;
    context.beginPath();
    context.moveTo(fromX, fromY);
    context.lineTo(toX, toY);
    context.stroke();
    return [toX, toY];
  }, [x, y]);
  context.restore();
}

function paintRock(context, pixel, { x, y, age, spin, outline }) {
  radiate(context, x, y, METEOR.size * HALO_REACH, [
    [0, `rgba(${GLOW_HOT},0.9)`],
    [0.35, `rgba(${GLOW},0.55)`],
    [1, `rgba(${GLOW_EDGE},0)`],
  ]);
  context.save();
  context.translate(x, y);
  context.rotate(age * spin);
  const shade = context.createRadialGradient(0, 0, 0, 0, 0, METEOR.size);
  shade.addColorStop(0, ROCK_CORE);
  shade.addColorStop(1, ROCK_RIM);
  context.fillStyle = shade;
  context.strokeStyle = OUTLINE;
  context.lineWidth = OUTLINE_WIDTH * pixel;
  context.beginPath();
  outline.forEach(([cornerX, cornerY]) => context.lineTo(cornerX, cornerY));
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

export class Meteor extends Launcher {
  constructor(room, surface, { onImpact, onTrail, onLaunch }) {
    super(room, surface, METEOR, onLaunch);
    this.onImpact = onImpact;
    this.onTrail = onTrail;
  }

  launch() {
    const skyY = -this.room.ceiling - SKY_GAP;
    const reach = this.room.halfWidth;
    const fromX = clamp(this.aimX - randomSign() * (this.aimY - skyY) * randomBetween(...METEOR.slant), -reach, reach);
    const [dx, dy] = normalize(this.aimX - fromX, this.aimY - skyY);
    const target = { x: this.aimX, y: this.aimY };
    return new Rock({ x: fromX, y: skyY, vx: dx * METEOR.speed, vy: dy * METEOR.speed, reach: METEOR.reach, target });
  }

  fly(shell) {
    this.onTrail(shell.x, shell.y);
  }

  impact(shell, { x, y }) {
    const blow = { ...METEOR.blow, x, y };
    this.blasts.add(blow);
    this.onImpact(blow);
  }

  paint(context, pixel, shell) {
    paintTrail(context, shell);
    paintRock(context, pixel, shell);
  }
}
