const GROUND_TOLERANCE = 0.004;

export class Projectile {
  constructor(body, life) {
    this.body = body;
    this.life = life;
    this.speed = 0;
    this.age = 0;
    this.still = 0;
    this.fade = 0;
    this.grounded = false;
    this.sync();
  }

  get alpha() {
    return 1 - this.fade / this.life.fadeSeconds;
  }

  get cooling() {
    return this.fade > 0;
  }

  get gone() {
    return this.fade >= this.life.fadeSeconds;
  }

  get floored() {
    return this.y + this.life.radius >= -GROUND_TOLERANCE;
  }

  sync() {
    const { x, y } = this.body.translation();
    const velocity = this.body.linvel();
    const speed = Math.hypot(velocity.x, velocity.y);
    this.surge = Math.max(this.speed, speed);
    Object.assign(this, { x, y, speed, angle: this.body.rotation() });
  }

  update(dt) {
    this.sync();
    this.age += dt;
    const { restSpeed, restSeconds, lifeSeconds } = this.life;
    this.still = this.grounded && this.speed < restSpeed ? this.still + dt : 0;
    if (this.cooling || this.still >= restSeconds || this.age >= lifeSeconds) this.fade += dt;
  }

  touchdown(landSpeed) {
    if (this.grounded || !this.floored) return false;
    this.grounded = true;
    return this.surge >= landSpeed;
  }
}

export function retire(projectiles, physics) {
  projectiles.filter((projectile) => projectile.gone).forEach((projectile) => physics.removeBody(projectile.body));
  return projectiles.filter((projectile) => !projectile.gone);
}
