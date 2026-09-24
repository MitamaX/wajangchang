import { CELL_METERS, FRAGMENTS, GRAVITY } from '../config.js';
import { Layer } from '../physics/PhysicsWorld.js';
import { ShapeDecomposer } from './ShapeDecomposer.js';

const IMPACT_SENSITIVITY = 4;

export class FragmentBuilder {
  constructor(physics, material) {
    this.physics = physics;
    this.material = material;
    this.decomposer = new ShapeDecomposer();
  }

  place(fragment, pose) {
    fragment.body = this.physics.createBody(pose, fragment.cells < FRAGMENTS.ccdCells);
    fragment.body.userData = fragment;
    this.shape(fragment);
  }

  reshape(fragment) {
    fragment.colliders.forEach((collider) => this.physics.removeCollider(collider));
    this.shape(fragment);
  }

  release(fragment) {
    this.physics.removeBody(fragment.body);
    fragment.body = null;
    fragment.colliders = [];
  }

  shape(fragment) {
    const { surface } = this.material;
    const mass = fragment.cells * CELL_METERS * CELL_METERS * surface.density;
    const settings = { ...surface, groups: Layer.fragment, forceThreshold: mass * GRAVITY * IMPACT_SENSITIVITY };
    const parts = this.decomposer.decompose(fragment.grid, fragment.cells);
    fragment.colliders = parts
      .map((part) => this.physics.attachConvex(fragment.body, this.toBodySpace(part, fragment), settings))
      .filter(Boolean);
    if (fragment.colliders.length) return;
    const hull = this.physics.attachConvex(fragment.body, this.toBodySpace(this.decomposer.cornerCloud(fragment.grid), fragment), settings);
    if (hull) fragment.colliders.push(hull);
  }

  toBodySpace(points, fragment) {
    const result = new Float32Array(points.length);
    for (let i = 0; i < points.length; i += 2) {
      result[i] = (points[i] - fragment.anchorX) * CELL_METERS;
      result[i + 1] = (points[i + 1] - fragment.anchorY) * CELL_METERS;
    }
    return result;
  }
}
