import { FRAGMENTS } from '../config.js';
import { Fragment, velocityAt, worldFromCell } from './Fragment.js';

const fills = (part, grid) => part.minX === 0 && part.minY === 0 && part.maxX === grid.width - 1 && part.maxY === grid.height - 1;

export class Splitter {
  constructor(builder) {
    this.builder = builder;
  }

  split(fragment) {
    const { grid: whole, skin: cover } = fragment;
    const { labels, parts } = whole.components();
    if (parts.length === 1 && !fragment.reshaped) return { survivors: [fragment], crumbs: [] };
    if (parts.length === 1 && fills(parts[0], whole) && parts[0].count >= FRAGMENTS.minBodyCells) return this.trim(fragment);
    const pose = fragment.pose();
    const survivors = [];
    const crumbs = [];
    parts.sort((a, b) => b.count - a.count).forEach((part, rank) => {
      if (part.count < FRAGMENTS.minBodyCells) {
        crumbs.push(this.crumb(pose, part));
        return;
      }
      const grid = whole.extract(labels, part);
      const skin = cover.extract(part, grid);
      if (rank === 0) {
        fragment.reshape(grid, skin, part.minX, part.minY);
        this.builder.reshape(fragment);
        survivors.push(fragment);
        return;
      }
      survivors.push(this.spawn(fragment, pose, grid, skin, part));
    });
    if (survivors[0] !== fragment) this.builder.release(fragment);
    return { survivors, crumbs };
  }

  trim(fragment) {
    const { grid, skin } = fragment;
    grid.tips = grid.tips.filter((tip) => grid.isSolidAt(tip.x, tip.y));
    skin.clipTo(grid);
    fragment.reshape(grid, skin, 0, 0);
    this.builder.reshape(fragment);
    return { survivors: [fragment], crumbs: [] };
  }

  spawn(parent, pose, grid, skin, part) {
    const center = grid.centroid();
    const child = new Fragment({
      grid,
      skin,
      anchorX: center.x,
      anchorY: center.y,
      originX: pose.originX + part.minX,
      originY: pose.originY + part.minY,
      ancestry: [...parent.ancestry, parent.id],
    });
    const [x, y] = worldFromCell(pose, part.minX + center.x, part.minY + center.y);
    const [vx, vy] = velocityAt(pose, x, y);
    this.builder.place(child, { x, y, angle: pose.angle, vx, vy, spin: pose.spin });
    return child;
  }

  crumb(pose, part) {
    const cellX = (part.minX + part.maxX + 1) / 2;
    const cellY = (part.minY + part.maxY + 1) / 2;
    const [x, y] = worldFromCell(pose, cellX, cellY);
    const [vx, vy] = velocityAt(pose, x, y);
    return { x, y, vx, vy, cells: part.count, colorX: pose.originX + cellX, colorY: pose.originY + cellY };
  }
}
