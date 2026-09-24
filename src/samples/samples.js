import { createCanvas, scatterNoise, traceRoundRect } from '../core/canvas.js';
import { FONT } from '../core/fonts.js';
import { TAU, randomBetween } from '../core/math.js';

const DAYS_IN_WEEK = 7;
const MONDAY = 1;
const MILLISECONDS_PER_DAY = 86400000;

function nextMonday() {
  const date = new Date();
  const today = date.getDay();
  const ahead = today === MONDAY ? DAYS_IN_WEEK : ((MONDAY + DAYS_IN_WEEK - today) % DAYS_IN_WEEK || DAYS_IN_WEEK);
  date.setDate(date.getDate() + ahead);
  return date;
}

function isoWeek(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = target.getUTCDay() || DAYS_IN_WEEK;
  target.setUTCDate(target.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target - yearStart) / MILLISECONDS_PER_DAY + 1) / DAYS_IN_WEEK);
}

function drawMonday() {
  const width = 960;
  const height = 1200;
  const canvas = createCanvas(width, height);
  const g = canvas.getContext('2d');
  const date = nextMonday();
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
  g.fillStyle = '#2b2a27';
  g.textBaseline = 'alphabetic';
  g.font = `600 44px ${FONT.mono}`;
  g.textAlign = 'left';
  g.fillText(String(date.getFullYear()), 64, 186);
  g.font = `600 44px ${FONT.ui}`;
  g.textAlign = 'right';
  g.fillText(`${date.getMonth() + 1}월`, width - 64, 186);
  g.font = `400 23px ${FONT.mono}`;
  g.fillStyle = '#7b786f';
  g.fillText(`WEEK ${String(isoWeek(date)).padStart(2, '0')}`, width - 64, 222);
  g.textAlign = 'center';
  g.fillStyle = '#1c1b19';
  g.font = `400 470px ${FONT.display}`;
  g.fillText(String(date.getDate()), width / 2, 668);
  g.font = `800 132px ${FONT.doc}`;
  g.fillText('월요일', width / 2, 836);
  g.font = `600 30px ${FONT.mono}`;
  g.fillStyle = '#7b786f';
  g.fillText('M O N D A Y', width / 2, 890);
  g.strokeStyle = '#cfcabd';
  g.lineWidth = 2;
  const memo = [['08:30', '출근'], ['09:00', '주간회의 (보고서 지참)'], ['14:00', '거래처 미팅'], ['18:30', '야근 예정']];
  memo.forEach(([time, task], i) => {
    const y = 972 + i * 54;
    g.beginPath();
    g.moveTo(64, y + 16);
    g.lineTo(width - 64, y + 16);
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

function drawFreeze() {
  const width = 1280;
  const height = 860;
  const canvas = createCanvas(width, height);
  const g = canvas.getContext('2d');
  const backdrop = g.createLinearGradient(0, 0, width, height);
  backdrop.addColorStop(0, '#2f6e86');
  backdrop.addColorStop(1, '#1d4658');
  g.fillStyle = backdrop;
  g.fillRect(0, 0, width, height);
  const windowX = 70;
  const windowY = 60;
  const windowWidth = width - 140;
  const windowHeight = height - 120;
  g.fillStyle = 'rgba(0,0,0,.35)';
  traceRoundRect(g, windowX + 6, windowY + 12, windowWidth, windowHeight, 10);
  g.fill();
  g.fillStyle = '#fafafa';
  traceRoundRect(g, windowX, windowY, windowWidth, windowHeight, 10);
  g.fill();
  g.save();
  traceRoundRect(g, windowX, windowY, windowWidth, 58, 10);
  g.clip();
  g.fillStyle = '#e6e8ea';
  g.fillRect(windowX, windowY, windowWidth, 58);
  g.restore();
  g.fillStyle = '#2b2f33';
  g.font = `500 25px ${FONT.ui}`;
  g.textAlign = 'left';
  g.fillText('보고서_최종_진짜최종(3).hwp (응답 없음)', windowX + 24, windowY + 38);
  g.fillStyle = '#6e7479';
  g.textAlign = 'right';
  g.fillText('—   ☐   ✕', windowX + windowWidth - 24, windowY + 38);
  g.fillStyle = '#f1f2f3';
  g.fillRect(windowX, windowY + 58, windowWidth, 44);
  g.fillStyle = '#c9cdd1';
  for (let i = 0; i < 12; i++) g.fillRect(windowX + 24 + i * 58, windowY + 70, 38, 20);
  g.fillStyle = '#ffffff';
  g.fillRect(windowX + 170, windowY + 124, windowWidth - 340, windowHeight - 140);
  g.fillStyle = '#d5d8db';
  for (let i = 0; i < 13; i++) {
    const lineWidth = (windowWidth - 420) * (i % 4 === 3 ? 0.55 : randomBetween(0.8, 1));
    g.fillRect(windowX + 210, windowY + 170 + i * 42, lineWidth, 13);
  }
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.fillRect(windowX, windowY + 58, windowWidth, windowHeight - 58);
  const dialogWidth = 640;
  const dialogHeight = 300;
  const dialogX = (width - dialogWidth) / 2;
  const dialogY = (height - dialogHeight) / 2 + 20;
  g.fillStyle = 'rgba(0,0,0,.28)';
  traceRoundRect(g, dialogX + 4, dialogY + 10, dialogWidth, dialogHeight, 10);
  g.fill();
  g.fillStyle = '#ffffff';
  traceRoundRect(g, dialogX, dialogY, dialogWidth, dialogHeight, 10);
  g.fill();
  g.strokeStyle = '#b9bec3';
  g.lineWidth = 2;
  g.stroke();
  g.strokeStyle = '#2f6e86';
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(dialogX + 70, dialogY + 92, 26, -1.2, 3.6);
  g.stroke();
  g.fillStyle = '#1f2326';
  g.font = `600 31px ${FONT.ui}`;
  g.textAlign = 'left';
  g.fillText('프로그램이 응답하지 않습니다', dialogX + 122, dialogY + 86);
  g.fillStyle = '#5b6166';
  g.font = `400 24px ${FONT.ui}`;
  g.fillText('기다리거나 강제로 종료할 수 있습니다.', dialogX + 122, dialogY + 128);
  g.fillText('강제로 종료하면 변경 내용을 잃을 수 있습니다.', dialogX + 122, dialogY + 162);
  traceRoundRect(g, dialogX + dialogWidth - 380, dialogY + dialogHeight - 86, 170, 54, 8);
  g.fillStyle = '#eef0f2';
  g.fill();
  g.strokeStyle = '#b9bec3';
  g.stroke();
  traceRoundRect(g, dialogX + dialogWidth - 196, dialogY + dialogHeight - 86, 170, 54, 8);
  g.fillStyle = '#2f6e86';
  g.fill();
  g.textAlign = 'center';
  g.font = `600 24px ${FONT.ui}`;
  g.fillStyle = '#1f2326';
  g.fillText('기다리기', dialogX + dialogWidth - 295, dialogY + dialogHeight - 51);
  g.fillStyle = '#ffffff';
  g.fillText('강제 종료', dialogX + dialogWidth - 111, dialogY + dialogHeight - 51);
  return canvas;
}

export const SAMPLES = Object.freeze({
  monday: { name: '월요일', draw: drawMonday },
  alarm: { name: '알람', draw: drawAlarm },
  freeze: { name: '응답 없음', draw: drawFreeze },
});

export const SAMPLE_ORDER = ['monday', 'alarm', 'freeze'];
