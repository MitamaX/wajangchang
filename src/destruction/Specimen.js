import { CELL_METERS, SPECIMEN } from '../config.js';
import { contentBounds, coverThumbnail, readPixels } from '../core/images.js';
import { clamp, randomBetween } from '../core/math.js';
import { CellGrid } from './CellGrid.js';
import { FragmentSkin } from './FragmentSkin.js';
import { applyFinish } from './finishes.js';

const THUMB_SIZE = 220;
const COLOR_JITTER = 14;

function dropSpecks(grid) {
  const { labels, parts } = grid.components();
  const specks = new Set(parts.filter((part) => part.count < SPECIMEN.minIslandCells).map((part) => part.label));
  if (!specks.size) return;
  for (let i = 0; i < labels.length; i++) if (specks.has(labels[i])) grid.solid[i] = 0;
}

export class Specimen {
  constructor({ grid, skin, palette, grain, thumb }) {
    this.grid = grid;
    this.skin = skin;
    this.palette = palette;
    this.grain = grain;
    this.thumb = thumb;
    this.totalCells = grid.countSolid();
    this.widthMeters = grid.width * CELL_METERS;
    this.heightMeters = grid.height * CELL_METERS;
  }

  static create(source, material) {
    const bounds = contentBounds(source);
    const metersPerPixel = Math.min(
      Math.sqrt(SPECIMEN.targetArea / (bounds.width * bounds.height)),
      SPECIMEN.maxSide / Math.max(bounds.width, bounds.height),
    );
    const columns = Math.max(SPECIMEN.minCells, Math.round((bounds.width * metersPerPixel) / CELL_METERS));
    const rows = Math.max(SPECIMEN.minCells, Math.round((bounds.height * metersPerPixel) / CELL_METERS));
    const palette = readPixels(source, bounds, columns, rows);
    const grid = new CellGrid(columns, rows);
    for (let i = 0; i < grid.solid.length; i++) grid.solid[i] = palette[i * 4 + 3] >= SPECIMEN.alphaThreshold ? 1 : 0;
    dropSpecks(grid);
    const grain = columns >= rows ? [1, 0] : [0, 1];
    const skin = FragmentSkin.fromImage(source, bounds, grid);
    applyFinish(skin, material.look.finish, grain);
    return new Specimen({ grid, skin, palette, grain, thumb: coverThumbnail(source, THUMB_SIZE, bounds) });
  }

  colorAt(cellX, cellY) {
    const x = clamp(Math.floor(cellX), 0, this.grid.width - 1);
    const y = clamp(Math.floor(cellY), 0, this.grid.height - 1);
    const index = (y * this.grid.width + x) * 4;
    const channel = (offset) => clamp(this.palette[index + offset] + Math.round(randomBetween(-COLOR_JITTER, COLOR_JITTER)), 0, 255);
    return `rgb(${channel(0)},${channel(1)},${channel(2)})`;
  }
}
