import { DRONE } from '../config.js';
import { inkOutline, radiate } from '../core/canvas.js';
import { TAU, clamp, normalize } from '../core/math.js';
import { Blasts } from './Blasts.js';
import { Pulse } from './Pulse.js';
import { Tool } from './Tool.js';

const SKY_GAP = 0.05;
const BODY = Object.freeze({ width: DRONE.size * 0.45, height: DRONE.size * 0.22 });
const ROTOR = Object.freeze({ reach: DRONE.size * 0.5, blade: DRONE.size * 0.28, lift: DRONE.size * 0.14 });
const TILT = 1.5;
const BLINK = 4;
const GUIDE = Object.freeze({ width: 1.2, dash: 4, alpha: 0.5 });
const HULL = '#2f3338';
const BLUR = 'rgba(220,225,230,0.45)';
const LED = '255,60,50';

function paintDrone(context, pixel, { x, y, vx, age }) {
  context.save();
  context.translate(x, y);
  context.rotate(clamp(vx * TILT, -0.5, 0.5));
  inkOutline(context, pixel);
  context.fillStyle = HULL;
  context.fillRect(-ROTOR.reach, -BODY.height * 0.2, ROTOR.reach * 2, BODY.height * 0.4);
  context.fillRect(-BODY.width / 2, -BODY.height / 2, BODY.width, BODY.height);
  context.strokeRect(-BODY.width / 2, -BODY.height / 2, BODY.width, BODY.height);
  context.strokeStyle = BLUR;
  context.lineWidth = 2 * pixel;
  context.beginPath();
  [-1, 1].forEach((side) => {
    context.ellipse(side * ROTOR.reach, -ROTOR.lift, ROTOR.blade, ROTOR.blade * 0.18, 0, 0, TAU);
  });
  context.stroke();
  if ((age * BLINK) % 1 < 0.5) radiate(context, 0, BODY.height / 2, BODY.height, [[0, `rgba(${LED},0.9)`], [1, `rgba(${LED},0)`]]);
  context.restore();
}

export class Drone extends Tool {
  constructor(room, surface, { onBlast, onRotor, onDive }) {
    super(room);
    this.surface = surface;
    this.onBlast = onBlast;
    this.onRotor = onRotor;
    this.onDive = onDive;
    this.drone = null;
    this.blasts = new Blasts(DRONE.blastSeconds);
    this.rotors = new Pulse(DRONE.rotorSeconds);
  }

  get spills() {
    return false;
  }

  get busy() {
    return this.drone !== null || this.blasts.busy;
  }

  get pending() {
    return this.drone !== null && this.drone.diving;
  }

  get focus() {
    return this.drone && !this.drone.diving ? { x: this.aimX, y: this.aimY, radius: DRONE.reach, charge: DRONE.tension } : null;
  }

  windUp() {
    if (this.drone) return;
    this.drone = { x: this.aimX, y: -this.room.ceiling - SKY_GAP, vx: 0, vy: 0, speed: 0, age: 0, diving: false, target: null };
  }

  release() {
    const { drone } = this;
    if (!drone || drone.diving) return;
    drone.diving = true;
    drone.target = { x: this.aimX, y: this.aimY };
    this.onDive();
  }

  cancel() {
    this.release();
  }

  stow() {
    super.stow();
    this.drone = null;
  }

  update(dt) {
    this.blasts.update(dt);
    const { drone } = this;
    if (!drone) return;
    drone.age += dt;
    if (this.rotors.tick(dt)) this.onRotor(DRONE.rotorSeconds);
    if (drone.diving) this.dive(drone, dt);
    else this.hover(drone, dt);
  }

  hover(drone, dt) {
    const { ceiling } = this.room;
    const x = this.aimX;
    const y = clamp(this.aimY - DRONE.hover, -ceiling + DRONE.margin, -DRONE.margin);
    const follow = Math.min(1, DRONE.follow * dt);
    drone.vx = ((x - drone.x) * follow) / (dt || 1);
    drone.vy = ((y - drone.y) * follow) / (dt || 1);
    drone.x += drone.vx * dt;
    drone.y += drone.vy * dt;
  }

  dive(drone, dt) {
    const [dx, dy] = normalize(drone.target.x - drone.x, drone.target.y - drone.y);
    drone.speed = Math.min(DRONE.dive, drone.speed + DRONE.thrust * dt);
    drone.vx = dx * drone.speed;
    drone.vy = dy * drone.speed;
    drone.x += drone.vx * dt;
    drone.y = Math.min(0, drone.y + drone.vy * dt);
    const arrived = Math.hypot(drone.target.x - drone.x, drone.target.y - drone.y) <= DRONE.reach * 2;
    if (arrived || drone.y >= 0 || this.surface.contactAt(drone.x, drone.y, DRONE.reach)) this.explode(drone);
  }

  explode({ x, y }) {
    const blow = { ...DRONE.blow, x, y };
    this.drone = null;
    this.blasts.add(blow);
    this.onBlast(blow);
  }

  draw(context, pixelsPerMeter) {
    const pixel = 1 / pixelsPerMeter;
    this.blasts.draw(context, pixel);
    const { drone } = this;
    if (!drone) return;
    if (!drone.diving) this.drawGuide(context, pixel, drone);
    paintDrone(context, pixel, drone);
  }

  drawGuide(context, pixel, { x, y }) {
    context.save();
    context.strokeStyle = `rgba(${LED},${GUIDE.alpha})`;
    context.lineWidth = GUIDE.width * pixel;
    context.setLineDash([GUIDE.dash * pixel, GUIDE.dash * pixel]);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(this.aimX, this.aimY);
    context.stroke();
    context.restore();
  }
}
