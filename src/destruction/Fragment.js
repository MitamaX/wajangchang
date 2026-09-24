import { CELL_METERS } from '../config.js';

let issued = 0;

export class Fragment {
  constructor({ grid, skin, anchorX, anchorY, originX, originY, ancestry = [] }) {
    this.id = ++issued;
    this.ancestry = ancestry;
    this.grid = grid;
    this.skin = skin;
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    this.originX = originX;
    this.originY = originY;
    this.cells = grid.countSolid();
    this.body = null;
    this.colliders = [];
    this.lastImpact = -Infinity;
    this.reshaped = false;
    this.spread = 1;
  }

  reshape(grid, skin, offsetX, offsetY) {
    this.grid = grid;
    this.skin = skin;
    this.anchorX -= offsetX;
    this.anchorY -= offsetY;
    this.originX += offsetX;
    this.originY += offsetY;
    this.cells = grid.countSolid();
    this.reshaped = false;
  }

  descendsFrom(id) {
    return this.id === id || this.ancestry.includes(id);
  }

  toMaterial(worldX, worldY) {
    const [cellX, cellY] = this.toCell(worldX, worldY);
    return [this.originX + cellX, this.originY + cellY];
  }

  fromMaterial([materialX, materialY]) {
    return [materialX - this.originX, materialY - this.originY];
  }

  get area() {
    return this.cells * CELL_METERS * CELL_METERS;
  }

  get extent() {
    return Math.hypot(this.grid.width, this.grid.height) * CELL_METERS;
  }

  pose() {
    const { x, y } = this.body.translation();
    const velocity = this.body.linvel();
    const center = this.body.worldCom();
    return {
      x,
      y,
      angle: this.body.rotation(),
      anchorX: this.anchorX,
      anchorY: this.anchorY,
      originX: this.originX,
      originY: this.originY,
      vx: velocity.x,
      vy: velocity.y,
      spin: this.body.angvel(),
      centerX: center.x,
      centerY: center.y,
    };
  }

  toCell(worldX, worldY) {
    return cellFromWorld(this.pose(), worldX, worldY);
  }

  toWorld(cellX, cellY) {
    return worldFromCell(this.pose(), cellX, cellY);
  }

  solidNear(worldX, worldY, reachCells) {
    const cell = this.grid.nearestSolid(...this.toCell(worldX, worldY), reachCells);
    if (!cell) return null;
    const [x, y] = this.toWorld(cell.x, cell.y);
    return { x, y };
  }

  toLocalDirection(dx, dy) {
    const angle = this.body.rotation();
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [dx * cos + dy * sin, -dx * sin + dy * cos];
  }
}

export function cellMapper(pose) {
  const cos = Math.cos(pose.angle);
  const sin = Math.sin(pose.angle);
  return (cellX, cellY) => {
    const localX = (cellX - pose.anchorX) * CELL_METERS;
    const localY = (cellY - pose.anchorY) * CELL_METERS;
    return [pose.x + localX * cos - localY * sin, pose.y + localX * sin + localY * cos];
  };
}

export function worldFromCell(pose, cellX, cellY) {
  return cellMapper(pose)(cellX, cellY);
}

export function cellFromWorld(pose, worldX, worldY) {
  const cos = Math.cos(pose.angle);
  const sin = Math.sin(pose.angle);
  const dx = worldX - pose.x;
  const dy = worldY - pose.y;
  return [pose.anchorX + (dx * cos + dy * sin) / CELL_METERS, pose.anchorY + (-dx * sin + dy * cos) / CELL_METERS];
}

export function velocityAt(pose, worldX, worldY) {
  return [pose.vx - pose.spin * (worldY - pose.centerY), pose.vy + pose.spin * (worldX - pose.centerX)];
}
