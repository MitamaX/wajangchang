export function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function traceRoundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

export const HAZARD = '#ffc21a';
export const HAZARD_INK = '#15140f';

export function paintHazard(context, x, y, width, height, pitch) {
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.fillStyle = HAZARD;
  context.fillRect(x, y, width, height);
  context.fillStyle = HAZARD_INK;
  for (let offset = -height; offset < width; offset += pitch) {
    context.beginPath();
    context.moveTo(x + offset, y + height);
    context.lineTo(x + offset + pitch / 2, y + height);
    context.lineTo(x + offset + pitch / 2 + height, y);
    context.lineTo(x + offset + height, y);
    context.closePath();
    context.fill();
  }
  context.restore();
}

const RETICLE = Object.freeze({ gap: 3, reach: 9, width: 1.5 });
const RETICLE_ARMS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const RETICLE_INK = 'rgba(255,255,255,0.75)';

export function paintReticle(context, x, y, pixel) {
  const { gap, reach, width } = RETICLE;
  context.save();
  context.strokeStyle = RETICLE_INK;
  context.lineWidth = width * pixel;
  context.beginPath();
  RETICLE_ARMS.forEach(([dx, dy]) => {
    context.moveTo(x + dx * gap * pixel, y + dy * gap * pixel);
    context.lineTo(x + dx * reach * pixel, y + dy * reach * pixel);
  });
  context.stroke();
  context.restore();
}

export function steel(context, x0, y0, x1, y1) {
  const gradient = context.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, '#e3e7ea');
  gradient.addColorStop(0.45, '#8d9398');
  gradient.addColorStop(0.55, '#6c7176');
  gradient.addColorStop(1, '#b9bec2');
  return gradient;
}

const OUTLINE = Object.freeze({ ink: 'rgba(0,0,0,0.5)', width: 1.2 });

export function inkOutline(context, pixel) {
  context.strokeStyle = OUTLINE.ink;
  context.lineWidth = OUTLINE.width * pixel;
}

export function strokeOutline(context, pixel) {
  inkOutline(context, pixel);
  context.stroke();
}

export function strokeLayers(context, pixel, layers) {
  layers.forEach(([width, color]) => {
    context.strokeStyle = color;
    context.lineWidth = width * pixel;
    context.stroke();
  });
}

export function radiate(context, x, y, radius, stops) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export function scatterNoise(context, width, height, alpha, count) {
  for (let i = 0; i < count; i++) {
    const shade = Math.random() < 0.5 ? '0,0,0' : '255,255,255';
    context.fillStyle = `rgba(${shade},${alpha * Math.random()})`;
    context.fillRect(Math.random() * width, Math.random() * height, 1.6, 1.6);
  }
}
