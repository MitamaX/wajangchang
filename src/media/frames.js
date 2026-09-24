import { HAZARD, paintHazard } from '../core/canvas.js';
import { FONT } from '../core/fonts.js';
import { wholePercent } from '../core/format.js';
import { clamp } from '../core/math.js';

const REFERENCE_EDGE = 720;

function paintMeter(context, x, y, width, height, progress, unit) {
  context.fillStyle = 'rgba(10,10,11,0.8)';
  context.fillRect(x - 2 * unit, y - 2 * unit, width + 4 * unit, height + 4 * unit);
  paintHazard(context, x, y, width * clamp(progress, 0, 1), height, 20 * unit);
}

export function composeFrame(context, width, height, stage, field, progress) {
  context.drawImage(stage, field.x, field.y, field.width, field.height, 0, 0, width, height);
  const unit = Math.min(width, height) / REFERENCE_EDGE;
  const margin = 26 * unit;
  const barWidth = 200 * unit;
  const barHeight = 14 * unit;
  const barY = height - margin - barHeight;
  context.save();
  context.shadowColor = 'rgba(0,0,0,0.55)';
  context.shadowBlur = 10 * unit;
  context.fillStyle = 'rgba(255,255,255,0.92)';
  context.font = `400 ${34 * unit}px ${FONT.display}`;
  context.textAlign = 'right';
  context.textBaseline = 'alphabetic';
  context.fillText('와장창', width - margin, height - margin);
  context.shadowColor = 'transparent';
  paintMeter(context, margin, barY, barWidth, barHeight, progress, unit);
  context.shadowColor = 'rgba(0,0,0,0.6)';
  context.shadowBlur = 6 * unit;
  context.textAlign = 'left';
  context.fillStyle = HAZARD;
  context.font = `600 ${20 * unit}px ${FONT.mono}`;
  context.fillText(`${wholePercent(progress)}%`, margin + barWidth + 12 * unit, barY + barHeight);
  context.fillStyle = 'rgba(255,255,255,0.85)';
  context.font = `600 ${15 * unit}px ${FONT.ui}`;
  context.fillText('파괴율', margin, barY - 10 * unit);
  context.restore();
}
