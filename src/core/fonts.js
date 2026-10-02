import { TEXT } from '../i18n/text.js';

const DISPLAY = '"Gasoek One","Black Han Sans","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

export const FONT = Object.freeze({
  display: DISPLAY,
  brand: `${TEXT.brandFace},${DISPLAY}`,
  ui: '"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif',
  doc: '"Nanum Myeongjo","AppleMyungjo","Batang","Noto Serif KR",serif',
  mono: '"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace',
  system: '"Segoe UI","Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif',
});

const DIGITS = '0123456789:.,%-mkMGN ';
const FACES = [...new Set([
  '400 64px "Gasoek One"',
  `400 64px ${TEXT.brandFace}`,
  '800 40px "Nanum Myeongjo"',
  '700 40px "Nanum Myeongjo"',
  '600 32px "IBM Plex Sans KR"',
  '500 32px "IBM Plex Sans KR"',
  '400 32px "IBM Plex Sans KR"',
])];

export function loadFonts(text = '', timeout = 2500) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const glyphs = text + TEXT.glyphs + DIGITS;
  const jobs = [...FACES.map((face) => document.fonts.load(face, glyphs)), document.fonts.load('600 32px "IBM Plex Mono"', DIGITS)];
  return Promise.race([Promise.all(jobs).catch(() => {}), new Promise((resolve) => setTimeout(resolve, timeout))]);
}
