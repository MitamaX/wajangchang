import { createCanvas, scatterNoise, traceRoundRect } from '../core/canvas.js';
import { FONT } from '../core/fonts.js';
import { TAU } from '../core/math.js';

const DAYS_IN_WEEK = 7;
const MONDAY = 1;
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const PROBE_SIZE = 100;
const QR = Object.freeze({ modules: 21, finder: 7, quiet: 1 });

function nextMonday() {
  const date = new Date();
  const today = date.getDay();
  const ahead = today === MONDAY ? DAYS_IN_WEEK : ((MONDAY + DAYS_IN_WEEK - today) % DAYS_IN_WEEK || DAYS_IN_WEEK);
  date.setDate(date.getDate() + ahead);
  return date;
}

function fillFitted(g, text, { weight, family, x, y, width, tracking = 0 }) {
  const glyphs = [...text];
  g.font = `${weight} ${PROBE_SIZE}px ${family}`;
  const advances = glyphs.map((glyph) => g.measureText(glyph).width + tracking * PROBE_SIZE);
  const span = advances.reduce((sum, advance) => sum + advance, 0) - tracking * PROBE_SIZE;
  const scale = width / span;
  g.font = `${weight} ${PROBE_SIZE * scale}px ${family}`;
  g.textAlign = 'left';
  let cursor = x - width / 2;
  glyphs.forEach((glyph, i) => {
    g.fillText(glyph, cursor, y);
    cursor += advances[i] * scale;
  });
}

function inkOffset(box) {
  return {
    x: (box.actualBoundingBoxLeft - box.actualBoundingBoxRight) / 2,
    y: (box.actualBoundingBoxAscent - box.actualBoundingBoxDescent) / 2,
  };
}

function drawMonday() {
  const width = 960;
  const height = 1200;
  const margin = 64;
  const canvas = createCanvas(width, height);
  const g = canvas.getContext('2d');
  g.fillStyle = '#f5f2ea';
  g.fillRect(0, 0, width, height);
  scatterNoise(g, width, height, 0.05, 12000);
  g.fillStyle = '#7e1d1d';
  g.fillRect(0, 0, width, 92);
  g.fillStyle = '#5e1414';
  g.fillRect(0, 84, width, 8);
  g.fillStyle = '#f5f2ea';
  for (let x = 40; x < width; x += 44) {
    g.beginPath();
    g.arc(x, 46, 7, 0, TAU);
    g.fill();
  }
  g.fillStyle = 'rgba(0,0,0,.12)';
  for (let x = 12; x < width; x += 16) g.fillRect(x, 100, 7, 2);
  const cell = (width - margin * 2) / WEEKDAYS.length;
  const weekdayY = 196;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = `600 34px ${FONT.ui}`;
  const weekdayBaseline = weekdayY + inkOffset(g.measureText(WEEKDAYS[0])).y;
  WEEKDAYS.forEach((day, i) => {
    const x = margin + cell * (i + 0.5);
    const isMonday = i === 0;
    if (isMonday) {
      g.fillStyle = '#9a2a22';
      g.beginPath();
      g.arc(x, weekdayY, 42, 0, TAU);
      g.fill();
    }
    g.fillStyle = isMonday ? '#f5f2ea' : '#7b786f';
    g.fillText(day, x + inkOffset(g.measureText(day)).x, weekdayBaseline);
  });
  const lockup = { x: width / 2, width: width - margin * 2 };
  g.fillStyle = '#1c1b19';
  fillFitted(g, '월요일', { ...lockup, weight: 400, family: FONT.display, y: 620 });
  g.fillStyle = '#7b786f';
  fillFitted(g, 'MONDAY', { ...lockup, weight: 600, family: FONT.ui, y: 800, tracking: 0.45 });
  g.strokeStyle = '#cfcabd';
  g.lineWidth = 2;
  const memo = [['08:30', '출근'], ['09:00', '주간회의 (보고서 지참)'], ['14:00', '거래처 미팅'], ['18:30', '야근 예정']];
  memo.forEach(([time, task], i) => {
    const y = 972 + i * 54;
    g.beginPath();
    g.moveTo(margin, y + 16);
    g.lineTo(width - margin, y + 16);
    g.stroke();
    g.textAlign = 'left';
    g.font = `600 28px ${FONT.mono}`;
    g.fillStyle = '#9a2a22';
    g.fillText(time, 70, y);
    g.font = `500 30px ${FONT.ui}`;
    g.fillStyle = '#2b2a27';
    g.fillText(task, 200, y);
  });
  return canvas;
}

function drawAlarm() {
  const width = 900;
  const height = 1400;
  const canvas = createCanvas(width, height);
  const g = canvas.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#0e2a2e');
  sky.addColorStop(0.55, '#0b1b22');
  sky.addColorStop(1, '#070b0e');
  g.fillStyle = sky;
  g.fillRect(0, 0, width, height);
  const glow = g.createRadialGradient(width / 2, 470, 20, width / 2, 470, 520);
  glow.addColorStop(0, 'rgba(255,170,60,.28)');
  glow.addColorStop(1, 'rgba(255,170,60,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, width, height);
  g.fillStyle = '#e9eef0';
  g.font = `600 34px ${FONT.mono}`;
  g.textAlign = 'left';
  g.fillText('6:30', 56, 76);
  g.strokeStyle = '#e9eef0';
  g.lineWidth = 3;
  traceRoundRect(g, width - 118, 50, 58, 28, 6);
  g.stroke();
  g.fillRect(width - 58, 58, 5, 12);
  g.fillStyle = '#e36a4a';
  g.fillRect(width - 113, 55, 11, 18);
  g.textAlign = 'center';
  g.fillStyle = '#ffb44a';
  g.font = `600 40px ${FONT.ui}`;
  g.fillText('알람', width / 2, 300);
  g.fillStyle = '#f4f7f8';
  g.font = `600 250px ${FONT.mono}`;
  g.fillText('06:30', width / 2, 560);
  const date = nextMonday();
  g.fillStyle = '#a9b8bd';
  g.font = `500 40px ${FONT.ui}`;
  g.fillText(`${date.getMonth() + 1}월 ${date.getDate()}일 월요일`, width / 2, 640);
  g.fillStyle = '#6f8389';
  g.font = `400 30px ${FONT.ui}`;
  g.fillText('5분 뒤 다시 울림 · 3번째 알림', width / 2, 700);
  for (let i = 0; i < 3; i++) {
    g.strokeStyle = `rgba(255,180,74,${0.35 - i * 0.1})`;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(width / 2, 470, 330 + i * 46, -2.5, -0.64);
    g.stroke();
  }
  traceRoundRect(g, 90, 1040, width - 180, 120, 60);
  g.fillStyle = '#2a3a40';
  g.fill();
  g.fillStyle = '#e9eef0';
  g.font = `600 44px ${FONT.ui}`;
  g.fillText('다시 알림', width / 2, 1116);
  traceRoundRect(g, 90, 1190, width - 180, 120, 60);
  g.fillStyle = '#f07b3f';
  g.fill();
  g.fillStyle = '#1b0f08';
  g.fillText('중지', width / 2, 1266);
  return canvas;
}

function qrFinderInk(col, row) {
  const far = QR.modules - QR.finder;
  const half = (QR.finder - 1) / 2;
  const corners = [[0, 0], [far, 0], [0, far]];
  for (const [left, top] of corners) {
    const ring = Math.max(Math.abs(col - left - half), Math.abs(row - top - half));
    if (ring <= half + 1) return ring !== half - 1 && ring !== half + 1;
  }
  return null;
}

function qrModuleInk(col, row) {
  const finder = qrFinderInk(col, row);
  if (finder !== null) return finder;
  const timing = QR.finder - 1;
  if (col === timing || row === timing) return (col + row) % 2 === 0;
  return Math.random() < 0.5;
}

function paintQr(g, x, y, cell, ink) {
  const span = (QR.modules + QR.quiet * 2) * cell;
  g.fillStyle = '#ffffff';
  g.fillRect(x, y, span, span);
  g.fillStyle = ink;
  for (let row = 0; row < QR.modules; row++) {
    for (let col = 0; col < QR.modules; col++) {
      if (qrModuleInk(col, row)) g.fillRect(x + (col + QR.quiet) * cell, y + (row + QR.quiet) * cell, cell, cell);
    }
  }
  return span;
}

function fillLines(g, lines, x, y, leading) {
  lines.forEach((line, i) => g.fillText(line, x, y + i * leading));
}

function drawFreeze() {
  const width = 1280;
  const height = 800;
  const margin = 120;
  const gutter = 80;
  const blue = '#0078d7';
  const canvas = createCanvas(width, height);
  const g = canvas.getContext('2d');
  g.fillStyle = blue;
  g.fillRect(0, 0, width, height);
  g.fillStyle = '#ffffff';
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = `300 400px ${FONT.system}`;
  const face = g.measureText(':(');
  const faceX = margin + face.actualBoundingBoxLeft;
  g.fillText(':(', faceX, 300 + inkOffset(face).y);
  const textX = faceX + face.actualBoundingBoxRight + gutter;
  const top = 210;
  g.font = `300 40px ${FONT.system}`;
  fillLines(g, ['PC에 문제가 발생하여 다시 시작해야 합니다.', '오류 정보를 수집하고 있으며,', '자동으로 다시 시작됩니다.'], textX, top, 58);
  g.fillText('20% 완료', textX, top + 200);
  const qrTop = 580;
  const qrSpan = paintQr(g, margin, qrTop, 5, blue);
  g.fillStyle = '#ffffff';
  g.font = `300 24px ${FONT.system}`;
  fillLines(g, ['지원 담당자에게 문의하는 경우 다음 정보를 알려 주세요.', '중지 코드: CRITICAL_PROCESS_DIED'], margin + qrSpan + 28, qrTop + 44, 42);
  return canvas;
}

export const SAMPLES = Object.freeze({
  monday: { name: '월요일', draw: drawMonday },
  alarm: { name: '알람', draw: drawAlarm },
  freeze: { name: '응답 없음', draw: drawFreeze },
});

export const SAMPLE_ORDER = ['monday', 'alarm', 'freeze'];
