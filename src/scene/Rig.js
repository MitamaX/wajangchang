import { inkOutline, paintHazard, steel } from '../core/canvas.js';

const HAZARD_BAND = Object.freeze({ offset: 0.3, share: 0.4, pitch: 0.03 });
const EDGE_WIDTH = 1.5;
const EDGE = 'rgba(255,255,255,0.5)';

export function paintRod(context, pixel, x, sky, top, width) {
  const half = width / 2;
  context.fillStyle = steel(context, x - half, 0, x + half, 0);
  inkOutline(context, pixel);
  context.fillRect(x - half, sky, width, top - sky);
  context.strokeRect(x - half, sky, width, top - sky);
}

export function paintRam(context, pixel, x, top, bottom, halfWidth) {
  const left = x - halfWidth;
  const width = halfWidth * 2;
  const height = bottom - top;
  context.fillStyle = steel(context, 0, top, 0, bottom);
  context.fillRect(left, top, width, height);
  paintHazard(context, left, top + height * HAZARD_BAND.offset, width, height * HAZARD_BAND.share, HAZARD_BAND.pitch);
  inkOutline(context, pixel);
  context.strokeRect(left, top, width, height);
  context.strokeStyle = EDGE;
  context.lineWidth = EDGE_WIDTH * pixel;
  context.beginPath();
  context.moveTo(left, bottom);
  context.lineTo(left + width, bottom);
  context.stroke();
}
