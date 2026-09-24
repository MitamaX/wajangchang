import { CLUSTER, GRAVITY } from '../config.js';
import { inkOutline, traceRoundRect } from '../core/canvas.js';
import { TAU, polar, randomBetween } from '../core/math.js';
import { Launcher } from './Launcher.js';
import { Shell } from './Shell.js';

const SKY_GAP = 0.08;
const SCATTER_TURN = 1.3;
const CANISTER = Object.freeze({ width: CLUSTER.size, height: CLUSTER.size * 2.4, fin: CLUSTER.size * 0.45 });
const BOMBLET = Object.freeze({ radius: CLUSTER.size * 0.32, band: 0.5 });
const CASING = '#56603f';
const FIN = '#343a28';
const BAND = '#e0402f';

class Bomblet extends Shell {}

function paintCanister(context, pixel) {
  const { width, height, fin } = CANISTER;
  inkOutline(context, pixel);
  context.fillStyle = FIN;
  context.beginPath();
  context.moveTo(-width / 2 - fin, -height / 2 - fin);
  context.lineTo(width / 2 + fin, -height / 2 - fin);
  context.lineTo(width / 2, -height / 2 + fin);
  context.lineTo(-width / 2, -height / 2 + fin);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = CASING;
  traceRoundRect(context, -width / 2, -height / 2, width, height, width / 2);
  context.fill();
  context.stroke();
}

function paintBomblet(context, pixel) {
  inkOutline(context, pixel);
  context.fillStyle = FIN;
  context.beginPath();
  context.arc(0, 0, BOMBLET.radius, 0, TAU);
  context.fill();
  context.stroke();
  context.fillStyle = BAND;
  context.fillRect(-BOMBLET.radius, -BOMBLET.radius * BOMBLET.band / 2, BOMBLET.radius * 2, BOMBLET.radius * BOMBLET.band);
}

export class Cluster extends Launcher {
  constructor(room, surface, { onImpact, onOpen, onLaunch }) {
    super(room, surface, CLUSTER, onLaunch);
    this.onImpact = onImpact;
    this.onOpen = onOpen;
  }

  launch() {
    const target = { x: this.aimX, y: this.aimY };
    return new Shell({ x: this.aimX, y: -this.room.ceiling - SKY_GAP, vx: 0, vy: CLUSTER.drop, gravity: CLUSTER.gravity, reach: CLUSTER.reach, target });
  }

  impact(shell, { x, y }) {
    if (shell instanceof Bomblet) {
      const blow = { ...CLUSTER.blow, x, y };
      this.blasts.add(blow);
      this.onImpact(blow);
      return;
    }
    this.shells.push(...Array.from({ length: CLUSTER.bomblets }, () => this.scatter(x, y)));
    this.onOpen();
  }

  scatter(x, y) {
    const [vx, vy] = polar(-Math.PI / 2 + randomBetween(-SCATTER_TURN, SCATTER_TURN), randomBetween(...CLUSTER.scatter));
    return new Bomblet({ x, y, vx, vy: vy - CLUSTER.lift, reach: CLUSTER.bombletReach, gravity: GRAVITY, arm: CLUSTER.armSeconds });
  }

  paint(context, pixel, shell) {
    context.save();
    context.translate(shell.x, shell.y);
    if (shell instanceof Bomblet) {
      context.rotate(shell.age * TAU * 2);
      paintBomblet(context, pixel);
    } else {
      paintCanister(context, pixel);
    }
    context.restore();
  }
}
