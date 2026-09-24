import { createCanvas } from './canvas.js';

const SCAN_EDGE = 256;
const SCAN_ALPHA = 8;
const THUMB_BACKDROP = '#d9dcdf';

export function sourceSize(source) {
  return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height };
}

export function readPixels(source, bounds, width, height) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

export function contentBounds(source) {
  const { width, height } = sourceSize(source);
  const scale = Math.min(1, SCAN_EDGE / Math.max(width, height));
  const scanWidth = Math.max(1, Math.round(width * scale));
  const scanHeight = Math.max(1, Math.round(height * scale));
  const data = readPixels(source, { x: 0, y: 0, width, height }, scanWidth, scanHeight);
  let minX = scanWidth;
  let minY = scanHeight;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < scanHeight; y++) {
    for (let x = 0; x < scanWidth; x++) {
      if (data[(y * scanWidth + x) * 4 + 3] <= SCAN_ALPHA) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return { x: 0, y: 0, width, height };
  const left = Math.max(0, Math.floor(minX / scale));
  const top = Math.max(0, Math.floor(minY / scale));
  const right = Math.min(width, Math.ceil((maxX + 1) / scale));
  const bottom = Math.min(height, Math.ceil((maxY + 1) / scale));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function coverThumbnail(source, size, bounds = contentBounds(source)) {
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');
  context.fillStyle = THUMB_BACKDROP;
  context.fillRect(0, 0, size, size);
  const scale = Math.max(size / bounds.width, size / bounds.height);
  const width = bounds.width * scale;
  const height = bounds.height * scale;
  context.drawImage(source, bounds.x, bounds.y, bounds.width, bounds.height, (size - width) / 2, (size - height) / 2, width, height);
  return canvas;
}
