import PLAIN_ENGINE from '@dimforge/rapier2d-compat?sized';
import SIMD_ENGINE from '@dimforge/rapier2d-simd-compat?sized';
import { GRAVITY, MAX_PHYSICS_STEPS, PHYSICS_STEP } from '../config.js';
import { loadModule } from '../core/modules.js';

const SLAB = 1;
const WALL_HEIGHT = 30;
const SOLVER_ITERATIONS = 6;
const LINEAR_DAMPING = 0.05;
const ANGULAR_DAMPING = 0.15;
const FLOOR_FRICTION = 0.8;
const WALL_FRICTION = 0.3;
const GROUP_SHIFT = 16;

const Membership = Object.freeze({ ROOM: 0x1, FRAGMENT: 0x2, TOOL: 0x4 });
const interaction = (member, filter) => ((member << GROUP_SHIFT) | filter) >>> 0;

export const Layer = Object.freeze({
  fragment: interaction(Membership.FRAGMENT, Membership.ROOM | Membership.FRAGMENT | Membership.TOOL),
  tool: interaction(Membership.TOOL, Membership.ROOM | Membership.FRAGMENT),
});

const ROOM_GROUPS = interaction(Membership.ROOM, Membership.FRAGMENT | Membership.TOOL);

const surfaced = (description, { density, friction, restitution, groups }) => description
  .setDensity(density)
  .setFriction(friction)
  .setRestitution(restitution)
  .setCollisionGroups(groups);

const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

const engineSource = () => (WebAssembly.validate(SIMD_PROBE) ? SIMD_ENGINE : PLAIN_ENGINE);

let RAPIER = null;

export class PhysicsWorld {
  static async load(onProgress) {
    RAPIER = (await loadModule(engineSource(), onProgress)).default;
    await RAPIER.init();
  }

  constructor(halfWidth) {
    this.world = new RAPIER.World({ x: 0, y: GRAVITY });
    this.world.timestep = PHYSICS_STEP;
    this.world.numSolverIterations = SOLVER_ITERATIONS;
    this.events = new RAPIER.EventQueue(true);
    this.backlog = 0;
    this.ground = null;
    this.buildRoom(halfWidth);
  }

  buildRoom(halfWidth) {
    if (this.ground) this.world.removeRigidBody(this.ground);
    const ground = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const slab = (halfX, halfY, x, y, friction) => {
      const description = RAPIER.ColliderDesc.cuboid(halfX, halfY).setTranslation(x, y).setFriction(friction).setCollisionGroups(ROOM_GROUPS);
      this.world.createCollider(description, ground);
    };
    this.ground = ground;
    slab(halfWidth + SLAB * 2, SLAB, 0, SLAB, FLOOR_FRICTION);
    slab(SLAB, WALL_HEIGHT, -halfWidth - SLAB, SLAB - WALL_HEIGHT, WALL_FRICTION);
    slab(SLAB, WALL_HEIGHT, halfWidth + SLAB, SLAB - WALL_HEIGHT, WALL_FRICTION);
  }

  createBody(pose, continuous) {
    const description = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pose.x, pose.y)
      .setRotation(pose.angle)
      .setLinvel(pose.vx, pose.vy)
      .setAngvel(pose.spin)
      .setLinearDamping(LINEAR_DAMPING)
      .setAngularDamping(ANGULAR_DAMPING)
      .setCcdEnabled(continuous);
    return this.world.createRigidBody(description);
  }

  createKinematicBody({ x, y }) {
    return this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y));
  }

  attachConvex(body, points, surface) {
    const description = RAPIER.ColliderDesc.convexHull(points);
    if (!description) return null;
    surfaced(description, surface)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(surface.forceThreshold);
    try {
      return this.world.createCollider(description, body);
    } catch {
      return null;
    }
  }

  attachBall(body, radius, surface) {
    return this.attach(body, RAPIER.ColliderDesc.ball(radius), surface);
  }

  attachBox(body, halfWidth, halfHeight, surface) {
    return this.attach(body, RAPIER.ColliderDesc.cuboid(halfWidth, halfHeight), surface);
  }

  attach(body, description, surface) {
    return this.world.createCollider(surfaced(description, surface), body);
  }

  removeCollider(collider) {
    this.world.removeCollider(collider, true);
  }

  removeBody(body) {
    this.world.removeRigidBody(body);
  }

  advance(dt, onImpact) {
    this.backlog = Math.min(this.backlog + dt, PHYSICS_STEP * MAX_PHYSICS_STEPS);
    const steps = Math.floor(this.backlog / PHYSICS_STEP);
    this.backlog -= steps * PHYSICS_STEP;
    for (let step = 0; step < steps; step++) {
      this.world.step(this.events);
      this.events.drainContactForceEvents((event) => {
        onImpact(event.collider1(), event.collider2(), event.totalForceMagnitude() * PHYSICS_STEP);
      });
    }
    return steps * PHYSICS_STEP;
  }

  bodyOf(handle) {
    const collider = this.world.getCollider(handle);
    return collider ? collider.parent() : null;
  }

  contact(handleA, handleB) {
    const first = this.world.getCollider(handleA);
    const second = this.world.getCollider(handleB);
    if (!first || !second) return null;
    let found = null;
    this.world.contactPair(first, second, (manifold, flipped) => {
      if (found || manifold.numSolverContacts() === 0) return;
      const point = manifold.solverContactPoint(0);
      if (!point) return;
      const normal = manifold.normal();
      const outward = flipped ? -1 : 1;
      found = { x: point.x, y: point.y, normalX: normal.x * outward, normalY: normal.y * outward };
    });
    return found;
  }

  hasMotion() {
    let moving = false;
    this.world.forEachActiveRigidBody(() => {
      moving = true;
    });
    return moving;
  }

  dispose() {
    this.events.free();
    this.world.free();
  }
}
