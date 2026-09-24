import { createCanvas, traceRoundRect } from '../core/canvas.js';
import { FONT } from '../core/fonts.js';
import { TAU, clamp, easeOut, randomBetween } from '../core/math.js';

const CARD = Object.freeze({ width: 540, height: 760, frameWidth: 640, frameHeight: 820, padding: 34, rowHeight: 50, labelWidth: 118 });
const INK = '#1f1e1b';
const MUTE = '#6b6a63';
const RULE = '#a9ada2';
const LABEL_INK = '#3a3934';
const PAPER = '#f3f1ea';
const SEAL_INK = '#d2381f';
const SEAL_SIZE = 240;
const DROP_SECONDS = 0.45;
const STAMP_AT = 0.85;
const STAMP_SECONDS = 0.3;
const THUMP_AT = 1.1;
const THUMP_SECONDS = 0.2;
const SIGNATURE_LIFT = 14;
const SEAL_INSET = Object.freeze({ right: 40, bottom: 22 + SIGNATURE_LIFT });
const SEAL_LANDED = 130;

export const REPORT_ASPECT = CARD.frameWidth / CARD.frameHeight;
export const STAMP_DELAY = (STAMP_AT + STAMP_SECONDS) * 1000;

export function makeSeal(early) {
  const canvas = createCanvas(SEAL_SIZE, SEAL_SIZE);
  const context = canvas.getContext('2d');
  context.translate(SEAL_SIZE / 2, SEAL_SIZE / 2);
  context.strokeStyle = SEAL_INK;
  context.fillStyle = SEAL_INK;
  context.lineWidth = 13;
  traceRoundRect(context, -100, -100, 200, 200, 24);
  context.stroke();
  context.lineWidth = 4;
  traceRoundRect(context, -83, -83, 166, 166, 14);
  context.stroke();
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `400 50px ${FONT.display}`;
  context.fillText('와장창', 0, -30, 150);
  const caption = early ? '부분파기' : '파기완료';
  context.font = `800 38px ${FONT.doc}`;
  context.fillText(caption, 0, 38, 150);
  context.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 1100; i++) {
    context.globalAlpha = Math.random() * 0.75;
    context.beginPath();
    context.arc(randomBetween(-112, 112), randomBetween(-112, 112), randomBetween(0.4, 2.4), 0, TAU);
    context.fill();
  }
  return canvas;
}

function drawTable(context, report, unit, top, cardWidth) {
  const { padding, rowHeight, labelWidth } = CARD;
  const left = padding * unit;
  const right = cardWidth - padding * unit;
  const row = rowHeight * unit;
  context.fillStyle = INK;
  context.fillRect(left, top, right - left, 2.4 * unit);
  context.fillRect(left, top + row * report.rows.length, right - left, 2.4 * unit);
  report.rows.forEach(({ label, value, numeric }, i) => {
    const y = top + row * i;
    context.fillStyle = RULE;
    if (i) context.fillRect(left, y, right - left, unit);
    context.fillRect(left + labelWidth * unit, y + 8 * unit, unit, row - 16 * unit);
    context.fillStyle = LABEL_INK;
    context.textAlign = 'left';
    context.font = `700 ${17 * unit}px ${FONT.doc}`;
    context.fillText(label, left + 4 * unit, y + row / 2 + 6 * unit);
    let valueX = left + labelWidth * unit + 16 * unit;
    if (i === 0 && report.thumb) {
      const size = row - 14 * unit;
      context.drawImage(report.thumb, valueX, y + 7 * unit, size, size);
      context.strokeStyle = RULE;
      context.lineWidth = unit;
      context.strokeRect(valueX, y + 7 * unit, size, size);
      valueX += size + 12 * unit;
    }
    context.fillStyle = INK;
    context.font = numeric ? `600 ${19 * unit}px ${FONT.mono}` : `600 ${17 * unit}px ${FONT.ui}`;
    context.fillText(value, valueX, y + row / 2 + 6 * unit, right - valueX);
  });
  return top + row * report.rows.length;
}

export function drawReportCard(context, width, height, report, time, seal) {
  const unit = Math.min(width / CARD.frameWidth, height / CARD.frameHeight);
  const cardWidth = CARD.width * unit;
  const cardHeight = CARD.height * unit;
  const padding = CARD.padding * unit;
  const drop = clamp(time / DROP_SECONDS, 0, 1);
  const ease = easeOut(drop);
  const stamp = clamp((time - STAMP_AT) / STAMP_SECONDS, 0, 1);
  const thump = time > THUMP_AT && time < THUMP_AT + THUMP_SECONDS ? Math.sin(((time - THUMP_AT) / THUMP_SECONDS) * Math.PI) * 3 * unit : 0;
  context.save();
  context.globalAlpha = drop;
  context.translate(width / 2, height / 2 + (1 - ease) * -60 * unit + thump);
  context.rotate(((-1.2 - (1 - ease) * 3) * Math.PI) / 180);
  context.translate(-cardWidth / 2, -cardHeight / 2);
  context.shadowColor = 'rgba(0,0,0,0.55)';
  context.shadowBlur = 40 * unit;
  context.shadowOffsetY = 18 * unit;
  context.fillStyle = PAPER;
  context.fillRect(0, 0, cardWidth, cardHeight);
  context.shadowColor = 'transparent';
  context.textBaseline = 'alphabetic';
  context.fillStyle = MUTE;
  context.font = `500 ${13 * unit}px ${FONT.ui}`;
  context.textAlign = 'left';
  context.fillText('와장창 파기관리대장', padding, padding + 6 * unit);
  context.font = `500 ${13 * unit}px ${FONT.mono}`;
  context.textAlign = 'right';
  context.fillText(report.serial, cardWidth - padding, padding + 6 * unit);
  context.fillStyle = INK;
  context.textAlign = 'center';
  context.font = `800 ${(report.early ? 32 : 40) * unit}px ${FONT.doc}`;
  context.fillText(report.title, cardWidth / 2, padding + 76 * unit);
  const bottom = drawTable(context, report, unit, padding + 104 * unit, cardWidth);
  context.textAlign = 'center';
  context.fillStyle = MUTE;
  context.font = `500 ${13 * unit}px ${FONT.ui}`;
  context.fillText('판   정', cardWidth / 2, bottom + 46 * unit);
  context.fillStyle = INK;
  context.font = `400 ${30 * unit}px ${FONT.display}`;
  context.fillText(report.verdict, cardWidth / 2, bottom + 86 * unit, cardWidth - padding * 2);
  context.textAlign = 'right';
  context.font = `700 ${16 * unit}px ${FONT.doc}`;
  const signature = cardHeight - padding - SIGNATURE_LIFT * unit;
  context.fillText(report.dateLong, cardWidth - padding, signature - 34 * unit);
  context.fillText('와장창 파기관리소장', cardWidth - padding - 20 * unit, signature);
  if (stamp > 0 && seal) {
    const size = SEAL_LANDED * unit * (1 + (1 - stamp) * 1.3);
    context.globalAlpha = 0.92 * clamp(stamp * 1.6, 0, 1);
    context.globalCompositeOperation = 'multiply';
    context.translate(cardWidth - padding - SEAL_INSET.right * unit, cardHeight - padding - SEAL_INSET.bottom * unit);
    context.rotate((-9 * Math.PI) / 180);
    context.drawImage(seal, -size / 2, -size / 2, size, size);
  }
  context.restore();
}

export function paintOutro(context, width, height, time, report, seal) {
  context.fillStyle = `rgba(8,9,10,${0.62 * clamp(time / 0.4, 0, 1)})`;
  context.fillRect(0, 0, width, height);
  drawReportCard(context, width, height, report, time, seal);
}
