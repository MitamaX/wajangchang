import { CELL_METERS } from '../config.js';
import { clamp, randomBetween } from '../core/math.js';
import { velocityAt, worldFromCell } from '../destruction/Fragment.js';

const UPWARD = -Math.PI / 2;
const MAX_SPILL = 28;
const CELLS_PER_CHIP = 6;
const MAX_CRUMB_CHIPS = 5;
const SURFACE_DUST = 'rgba(170,172,170,1)';
const SURFACE_PUFF = 10;
const SMOKE = 'rgba(60,56,52,1)';
const EMBER = 'rgba(255,150,60,1)';
const HEADED_SPREAD = 0.45;
const CELLS_PER_EMBER = 12;
const MAX_EMBERS = 16;

const SPRAYS = Object.freeze({
  glint: { speed: [0.3, 1.4], size: [0.0015, 0.003] },
  dust: { speed: [0.05, 0.4], size: [0.004, 0.01] },
  chip: { speed: [0.4, 1.4], size: [0.002, 0.005], direction: UPWARD, spread: 1.3 },
  splinter: { speed: [0.5, 1.5], size: [0.002, 0.004], direction: UPWARD, spread: 1.2 },
  spark: { speed: [1.2, 3], size: [0.0015, 0.003], direction: UPWARD, spread: 1.4 },
  smoke: { speed: [0.1, 0.4], size: [0.004, 0.008], direction: UPWARD, spread: 0.6 },
  ember: { speed: [0.6, 2.4], size: [0.002, 0.0045], direction: UPWARD, spread: 1.5 },
});

const GLOW_COLORS = Object.freeze({ glint: 'rgba(255,255,255,1)', spark: 'rgba(255,200,110,1)' });

export class Fallout {
  constructor(debris, specimen, look) {
    this.debris = debris;
    this.specimen = specimen;
    this.look = look;
    this.chips = 0;
  }

  impact(x, y, strength, paletteColor, abundance, heading = null) {
    const colors = { ...GLOW_COLORS, dust: this.look.dustColor, splinter: this.look.rimColor, chip: paletteColor };
    const scale = clamp(strength, 0.4, 1.2) * abundance;
    const aim = heading === null ? {} : { direction: heading, spread: HEADED_SPREAD };
    this.look.burst.forEach(([kind, count]) => {
      this.debris.spray(kind, x, y, { ...SPRAYS[kind], ...aim, count: Math.round(count * scale), color: colors[kind] });
    });
  }

  smolder(x, y, count) {
    this.debris.spray('smoke', x, y, { ...SPRAYS.smoke, count, color: SMOKE });
    this.debris.spray('spark', x, y, { ...SPRAYS.spark, count, color: EMBER });
  }

  melt(x, y, cells, color) {
    const count = Math.min(MAX_EMBERS, Math.ceil(cells / CELLS_PER_EMBER));
    this.debris.spray('ember', x, y, { ...SPRAYS.ember, count, color });
  }

  blaze(x, y, count, color) {
    this.debris.spray('ember', x, y, { ...SPRAYS.ember, count, color, direction: null });
  }

  puff(x, y) {
    this.debris.spray('dust', x, y, { ...SPRAYS.dust, count: SURFACE_PUFF, color: SURFACE_DUST, direction: UPWARD, spread: 1.2 });
  }

  spill(fragment, removed) {
    const pose = fragment.pose();
    const { width } = fragment.grid;
    const stride = Math.max(1, Math.round(removed.length / MAX_SPILL));
    for (let i = 0; i < removed.length; i += stride) {
      const cellX = (removed[i] % width) + 0.5;
      const cellY = Math.floor(removed[i] / width) + 0.5;
      const [x, y] = worldFromCell(pose, cellX, cellY);
      const [vx, vy] = velocityAt(pose, x, y);
      const size = CELL_METERS * randomBetween(0.8, 1.6) * Math.sqrt(stride);
      const color = this.specimen.colorAt(fragment.originX + cellX, fragment.originY + cellY);
      this.chip(x, y, vx + randomBetween(-0.6, 0.6), vy - randomBetween(0.2, 1.2), size, color);
    }
  }

  crumble({ x, y, vx, vy, cells, colorX, colorY }) {
    const count = clamp(Math.round(cells / CELLS_PER_CHIP), 1, MAX_CRUMB_CHIPS);
    const size = Math.sqrt(cells / count) * CELL_METERS * 0.6;
    const color = this.specimen.colorAt(colorX, colorY);
    for (let i = 0; i < count; i++) {
      const offsetX = randomBetween(-size, size);
      const offsetY = randomBetween(-size, size);
      this.chip(x + offsetX, y + offsetY, vx + randomBetween(-0.3, 0.3), vy + randomBetween(-0.3, 0.1), size, color);
    }
  }

  chip(x, y, vx, vy, size, color) {
    this.debris.add('chip', { x, y, vx, vy, size, color });
    this.chips++;
  }
}
