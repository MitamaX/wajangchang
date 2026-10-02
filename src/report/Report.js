import { CELL_METERS } from '../config.js';
import { forceText, longDate, numberFormat, serialCode, spokenTime, stampDate, wholePercent } from '../core/format.js';
import { randomInt } from '../core/math.js';
import { TEXT } from '../i18n/text.js';

const COPY = TEXT.report;
const TASTER_PERCENT = 30;
const ROWS = [
  ['name', false],
  ['material', false],
  ['date', false],
  ['force', true],
  ['time', false],
  ['pieces', true],
  ['cracks', true],
  ['percent', true],
];

function verdictFor(materialKey, percent, early) {
  if (early) return percent < TASTER_PERCENT ? COPY.verdicts.taster : COPY.verdicts.partial;
  return COPY.verdicts[materialKey];
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
    pieces: COPY.pieces(numberFormat.format(session.pieceCount)),
    cracks: `${(session.stats.crackCells * CELL_METERS).toFixed(2)} m`,
    percent: `${percent}%`,
  };
  return {
    early,
    fields,
    rows: ROWS.map(([key, numeric]) => ({ label: COPY.rows[key], value: fields[key], numeric })),
    thumb: session.specimen.thumb,
    title: early ? COPY.partialTitle : COPY.title,
    serial: COPY.serial(serialCode(now, randomInt(1000, 9999))),
    dateLong: longDate(now),
    verdict: verdictFor(session.material.key, percent, early),
  };
}
