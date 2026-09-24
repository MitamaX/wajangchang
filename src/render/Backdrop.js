import { createCanvas } from '../core/canvas.js';
import { TAU, clamp, randomBetween } from '../core/math.js';

const GRAIN_TILE = 160;
const BLOTCHES = 46;
const PANEL_METERS = 0.6;
const SPOT_HEIGHT = 0.32;
const SPOT_REACH = 0.9;

let grainTile = null;

function grain() {
  if (grainTile) return grainTile;
  grainTile = createCanvas(GRAIN_TILE, GRAIN_TILE);
  const context = grainTile.getContext('2d');
  const image = context.createImageData(GRAIN_TILE, GRAIN_TILE);
  for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
    const value = Math.random();
    const shade = value < 0.5 ? 0 : 255;
    image.data[i * 4] = shade;
    image.data[i * 4 + 1] = shade;
    image.data[i * 4 + 2] = shade;
    image.data[i * 4 + 3] = Math.floor(Math.abs(value - 0.5) * 2 * 26);
  }
  context.putImageData(image, 0, 0);
  return grainTile;
}

function radialFill(context, x, y, inner, outer, color, area) {
  const gradient = context.createRadialGradient(x, y, inner, x, y, outer);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(area.x, area.y, area.width, area.height);
}

function paintWall(context, width, floor, texture, scale) {
  context.fillStyle = '#5a5d60';
  context.fillRect(0, 0, width, floor);
  for (let i = 0; i < BLOTCHES; i++) {
    const x = Math.random() * width;
    const y = Math.random() * floor;
    const radius = randomBetween(0.06, 0.4) * scale;
    const color = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    radialFill(context, x, y, 0, radius, color, { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 });
  }
  context.fillStyle = texture;
  context.fillRect(0, 0, width, floor);
}

function paintPanels(context, width, floor, centerX, scale, dpr) {
  const panelWidth = PANEL_METERS * scale;
  const panelHeight = panelWidth / 2;
  const startX = (((centerX % panelWidth) + panelWidth) % panelWidth);
  const startY = ((floor % panelHeight) + panelHeight) % panelHeight;
  context.lineWidth = Math.max(1, dpr);
  context.strokeStyle = 'rgba(20,22,24,0.22)';
  for (let x = startX; x < width; x += panelWidth) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, floor);
    context.stroke();
  }
  for (let y = startY; y < floor; y += panelHeight) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  const hole = clamp(0.006 * scale, 2, 7);
  for (let x = startX + panelWidth / 4; x < width + panelWidth; x += panelWidth / 2) {
    for (let y = startY + panelHeight / 2; y < floor - hole * 2; y += panelHeight) {
      context.fillStyle = 'rgba(0,0,0,0.42)';
      context.beginPath();
      context.arc(x, y, hole, 0, TAU);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.09)';
      context.beginPath();
      context.arc(x + hole * 0.3, y + hole * 0.35, hole * 0.75, 0, Math.PI);
      context.fill();
    }
  }
}

function paintFloor(context, width, height, floor, texture, centerX, scale) {
  const depth = height - floor;
  const slab = context.createLinearGradient(0, floor, 0, height);
  slab.addColorStop(0, '#2e3032');
  slab.addColorStop(0.35, '#35383a');
  slab.addColorStop(1, '#232426');
  context.fillStyle = slab;
  context.fillRect(0, floor, width, depth);
  context.fillStyle = texture;
  context.fillRect(0, floor, width, depth);
  radialFill(context, centerX, floor + depth * 0.35, 10, Math.max(width * 0.45, scale * 0.8), 'rgba(255,248,232,0.1)', { x: 0, y: floor, width, height: depth });
  context.fillStyle = 'rgba(0,0,0,0.45)';
  context.fillRect(0, floor - 2, width, 3);
  const skirting = context.createLinearGradient(0, floor - 16, 0, floor);
  skirting.addColorStop(0, 'rgba(0,0,0,0)');
  skirting.addColorStop(1, 'rgba(0,0,0,0.28)');
  context.fillStyle = skirting;
  context.fillRect(0, floor - 16, width, 16);
}

function paintBounds(context, width, height, left, right) {
  context.fillStyle = 'rgba(8,9,10,0.55)';
  if (left > 0) context.fillRect(0, 0, left, height);
  if (right < width) context.fillRect(right, 0, width - right, height);
}

export function paintBackdrop(width, height, dpr, camera, room) {
  const canvas = createCanvas(width * dpr, height * dpr);
  const context = canvas.getContext('2d');
  const scale = camera.scale * dpr;
  const floor = Math.round(camera.originY * dpr);
  const centerX = camera.originX * dpr;
  const texture = context.createPattern(grain(), 'repeat');
  paintWall(context, canvas.width, floor, texture, scale);
  paintPanels(context, canvas.width, floor, centerX, scale, dpr);
  radialFill(context, centerX, floor - SPOT_HEIGHT * scale, scale * 0.08, scale * SPOT_REACH, 'rgba(255,248,232,0.16)', { x: 0, y: 0, width: canvas.width, height: floor });
  paintFloor(context, canvas.width, canvas.height, floor, texture, centerX, scale);
  paintBounds(context, canvas.width, canvas.height, centerX - room.halfWidth * scale, centerX + room.halfWidth * scale);
  const vignette = context.createRadialGradient(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.35, canvas.width / 2, canvas.height / 2, Math.hypot(canvas.width, canvas.height) * 0.62);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}
