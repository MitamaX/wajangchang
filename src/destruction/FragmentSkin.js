import { TEXELS_PER_CELL } from '../config.js';
import { createCanvas } from '../core/canvas.js';
import { TAU, randomBetween } from '../core/math.js';
import { Side } from './CellGrid.js';
import { pinchScale } from './pinch.js';

const T = TEXELS_PER_CELL;
const CHANNELS = 4;
const FROST = '255,255,255';
const HOLLOW = '24,22,20';
const SOOT = '26,16,10';

const scratch = { canvas: null, context: null };

function maskOf(grid) {
  if (!scratch.canvas || scratch.canvas.width < grid.width || scratch.canvas.height < grid.height) {
    scratch.canvas = createCanvas(Math.max(grid.width, scratch.canvas?.width ?? 0), Math.max(grid.height, scratch.canvas?.height ?? 0));
    scratch.context = scratch.canvas.getContext('2d');
  }
  const image = scratch.context.createImageData(grid.width, grid.height);
  for (let i = 0; i < grid.solid.length; i++) image.data[i * CHANNELS + 3] = grid.solid[i] * 255;
  scratch.context.putImageData(image, 0, 0);
  return scratch.canvas;
}

function sampleBilinear(source, width, height, x, y, target, offset) {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = Math.max(0, Math.min(1, x - x0));
  const fy = Math.max(0, Math.min(1, y - y0));
  const a = (y0 * width + x0) * CHANNELS;
  const b = (y0 * width + x1) * CHANNELS;
  const c = (y1 * width + x0) * CHANNELS;
  const d = (y1 * width + x1) * CHANNELS;
  for (let channel = 0; channel < CHANNELS; channel++) {
    const top = source[a + channel] + (source[b + channel] - source[a + channel]) * fx;
    const bottom = source[c + channel] + (source[d + channel] - source[c + channel]) * fx;
    target[offset + channel] = top + (bottom - top) * fy;
  }
}

export class FragmentSkin {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
  }

  static blank(columns, rows) {
    return new FragmentSkin(createCanvas(columns * T, rows * T));
  }

  static fromImage(source, bounds, grid) {
    const skin = FragmentSkin.blank(grid.width, grid.height);
    skin.context.imageSmoothingQuality = 'high';
    skin.context.drawImage(source, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, skin.canvas.width, skin.canvas.height);
    skin.clipTo(grid);
    return skin;
  }

  extract(part, grid) {
    const skin = FragmentSkin.blank(grid.width, grid.height);
    const width = grid.width * T;
    const height = grid.height * T;
    skin.context.drawImage(this.canvas, part.minX * T, part.minY * T, width, height, 0, 0, width, height);
    skin.clipTo(grid);
    return skin;
  }

  resampled(matrix, bounds, grid) {
    const skin = FragmentSkin.blank(grid.width, grid.height);
    const [xx, yx, xy, yy, shiftX, shiftY] = matrix;
    skin.paint('source-over', (context) => {
      context.setTransform(xx, yx, xy, yy, (shiftX - bounds.left) * T, (shiftY - bounds.top) * T);
      context.drawImage(this.canvas, 0, 0);
    });
    skin.clipTo(grid);
    return skin;
  }

  clipTo(grid) {
    const mask = maskOf(grid);
    this.paint('destination-in', (context) => {
      context.imageSmoothingEnabled = false;
      context.drawImage(mask, 0, 0, grid.width, grid.height, 0, 0, this.canvas.width, this.canvas.height);
    });
  }

  paint(operation, draw) {
    const { context } = this;
    context.save();
    context.globalCompositeOperation = operation;
    draw(context);
    context.restore();
  }

  drawCracks(segments, look) {
    if (!segments.length) return;
    const path = new Path2D();
    for (let i = 0; i < segments.length; i += 4) {
      path.moveTo(segments[i] * T, segments[i + 1] * T);
      path.lineTo(segments[i + 2] * T, segments[i + 3] * T);
    }
    this.paint('source-atop', (context) => {
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = look.crackShade;
      context.lineWidth = look.crackWidth * T * 2.2;
      context.stroke(path);
      context.strokeStyle = look.crackColor;
      context.lineWidth = look.crackWidth * T;
      context.stroke(path);
    });
  }

  paintRim(sides, look) {
    if (!sides.length) return;
    const band = Math.max(1, Math.round(T * look.rimWidth));
    this.paint('source-atop', (context) => {
      context.fillStyle = look.rimColor;
      for (let i = 0; i < sides.length; i += 3) {
        const x = sides[i] * T;
        const y = sides[i + 1] * T;
        const mask = sides[i + 2];
        if (mask & Side.TOP) context.fillRect(x, y, T, band);
        if (mask & Side.RIGHT) context.fillRect(x + T - band, y, band, T);
        if (mask & Side.BOTTOM) context.fillRect(x, y + T - band, T, band);
        if (mask & Side.LEFT) context.fillRect(x, y, band, T);
      }
    });
  }

  pinch(cellX, cellY, cellRadius, strength) {
    const centerX = cellX * T;
    const centerY = cellY * T;
    const radius = cellRadius * T;
    const x0 = Math.max(0, Math.floor(centerX - radius));
    const y0 = Math.max(0, Math.floor(centerY - radius));
    const x1 = Math.min(this.canvas.width, Math.ceil(centerX + radius));
    const y1 = Math.min(this.canvas.height, Math.ceil(centerY + radius));
    const width = x1 - x0;
    const height = y1 - y0;
    if (width <= 0 || height <= 0) return;
    const source = this.context.getImageData(x0, y0, width, height);
    const target = this.context.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x0 + x + 0.5 - centerX;
        const dy = y0 + y + 0.5 - centerY;
        const distance = Math.hypot(dx, dy);
        const scale = distance < radius ? pinchScale(distance, radius, strength) : 1;
        const sampleX = centerX + dx * scale - x0 - 0.5;
        const sampleY = centerY + dy * scale - y0 - 0.5;
        sampleBilinear(source.data, width, height, sampleX, sampleY, target.data, (y * width + x) * CHANNELS);
      }
    }
    this.context.putImageData(target, x0, y0);
  }

  shadeDent(cellX, cellY, cellRadius, depth, gloss) {
    const x = cellX * T;
    const y = cellY * T;
    const radius = cellRadius * T;
    const offset = radius * 0.35;
    this.paint('source-atop', (context) => {
      const glow = (centerX, centerY, reach, color) => {
        const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, reach);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      };
      context.beginPath();
      context.arc(x, y, radius, 0, TAU);
      context.clip();
      glow(x - offset, y - offset, radius * 0.95, `rgba(0,0,0,${0.16 * depth})`);
      if (gloss > 0) glow(x + offset, y + offset, radius * 0.7, `rgba(255,255,255,${0.3 * depth * gloss})`);
    });
  }

  stain(context, x, y, radius, ink, alpha) {
    const blot = context.createRadialGradient(x, y, 0, x, y, radius);
    blot.addColorStop(0, `rgba(${ink},${alpha})`);
    blot.addColorStop(1, `rgba(${ink},0)`);
    context.fillStyle = blot;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  tint(cellX, cellY, cellRadius, ink, alpha) {
    this.paint('source-atop', (context) => this.stain(context, cellX * T, cellY * T, cellRadius * T, ink, alpha));
  }

  frost(cellX, cellY, cellRadius, strength) {
    this.tint(cellX, cellY, cellRadius, FROST, Math.min(0.75, 0.45 * strength));
  }

  scorch(cellX, cellY, cellRadius, strength) {
    this.tint(cellX, cellY, cellRadius, SOOT, strength);
  }

  pit(cellX, cellY, cellRadius, strength) {
    const x = cellX * T;
    const y = cellY * T;
    const radius = cellRadius * T;
    this.paint('source-atop', (context) => {
      this.stain(context, x, y, radius, HOLLOW, Math.min(0.6, 0.4 * strength));
      const grains = Math.round(radius * radius * 0.06);
      for (let i = 0; i < grains; i++) {
        const angle = randomBetween(0, TAU);
        const distance = radius * Math.sqrt(Math.random());
        context.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)';
        context.fillRect(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, T * 0.5, T * 0.5);
      }
    });
  }
}
