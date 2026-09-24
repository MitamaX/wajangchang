export const FONT = Object.freeze({
  display: '"Gasoek One","Black Han Sans","Apple SD Gothic Neo","Malgun Gothic",sans-serif',
  ui: '"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif',
  doc: '"Nanum Myeongjo","AppleMyungjo","Batang","Noto Serif KR",serif',
  mono: '"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace',
});

const BASE_GLYPHS = '와장창파기보고서관리대장소월화수목토요일알람응답없음재질유리나무돌금속타격소요시간파편균열파괴율판정회개초분년';
const DIGITS = '0123456789:.%-m';
const FACES = [
  '400 64px "Gasoek One"',
  '800 40px "Nanum Myeongjo"',
  '700 40px "Nanum Myeongjo"',
  '600 32px "IBM Plex Sans KR"',
  '500 32px "IBM Plex Sans KR"',
  '400 32px "IBM Plex Sans KR"',
];

export function loadFonts(text = '', timeout = 2500) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const glyphs = text + BASE_GLYPHS + DIGITS;
  const jobs = [...FACES.map((face) => document.fonts.load(face, glyphs)), document.fonts.load('600 32px "IBM Plex Mono"', DIGITS)];
  return Promise.race([Promise.all(jobs).catch(() => {}), new Promise((resolve) => setTimeout(resolve, timeout))]);
}
