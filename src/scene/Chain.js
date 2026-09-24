import { steel } from '../core/canvas.js';
import { TAU } from '../core/math.js';

const LINK = Object.freeze({ pitch: 0.017, length: 0.024, width: 0.013, thickness: 0.0035 });
const OUTLINE_WIDTH = 1.2;

export function strokeOutlined(context, pixel, thickness, ink, outline) {
  context.lineWidth = thickness + OUTLINE_WIDTH * 2 * pixel;
  context.strokeStyle = outline;
  context.stroke();
  context.lineWidth = thickness;
  context.strokeStyle = ink;
  context.stroke();
}

function traceChain(context, x, bottom, top) {
  context.beginPath();
  for (let y = bottom, index = 0; y > top; y -= LINK.pitch, index++) {
    if (index % 2) {
      context.moveTo(x, y);
      context.lineTo(x, y - LINK.length);
    } else {
      context.moveTo(x + LINK.width / 2, y - LINK.length / 2);
      context.ellipse(x, y - LINK.length / 2, LINK.width / 2, LINK.length / 2, 0, 0, TAU);
    }
  }
}

export function paintChain(context, pixel, x, bottom, top, outline) {
  traceChain(context, x, bottom, top);
  strokeOutlined(context, pixel, LINK.thickness, steel(context, x - LINK.width / 2, 0, x + LINK.width / 2, 0), outline);
}
