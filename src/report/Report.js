import { CELL_METERS } from '../config.js';
import { forceText, longDate, numberFormat, serialNumber, spokenTime, stampDate, wholePercent } from '../core/format.js';
import { randomInt } from '../core/math.js';

const TITLES = Object.freeze({ glass: '산산조각 장인', wood: '장작 패기 달인', stone: '채석장 반장', metal: '대장장이' });
const TASTER_PERCENT = 30;
const ROWS = [
  ['파기 대상', 'name', false],
  ['재질', 'material', false],
  ['파기 일자', 'date', false],
  ['총 충격', 'force', true],
  ['소요 시간', 'time', false],
  ['파편', 'pieces', true],
  ['균열', 'cracks', true],
  ['파괴율', 'percent', true],
];

function verdictFor(materialKey, percent, early) {
  if (early) return percent < TASTER_PERCENT ? '맛보기 파괴자' : '부분 파기 담당';
  return TITLES[materialKey];
}

export function buildReport({ session, name, early }) {
  const now = new Date();
  const percent = wholePercent(session.destruction);
  const fields = {
    name,
    material: session.material.label,
    date: stampDate(now),
    force: forceText(session.stats.newtons),
    time: spokenTime(session.elapsed),
    pieces: `${numberFormat.format(session.pieceCount)}개`,
    cracks: `${(session.stats.crackCells * CELL_METERS).toFixed(2)} m`,
    percent: `${percent}%`,
  };
  return {
    early,
    fields,
    rows: ROWS.map(([label, key, numeric]) => ({ label, value: fields[key], numeric })),
    thumb: session.specimen.thumb,
    title: early ? '부분 파기 보고서' : '파 기 보 고 서',
    serial: serialNumber(now, randomInt(1000, 9999)),
    dateLong: longDate(now),
    verdict: verdictFor(session.material.key, percent, early),
  };
}

export function shareText({ fields, verdict }) {
  return `「${fields.name}」 ${fields.material} ${fields.percent} 파기 · ${fields.time} · 파편 ${fields.pieces} · ${verdict} #와장창`;
}
