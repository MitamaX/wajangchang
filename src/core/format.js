const MINUTE = 60;
const FORCE_STEP = 1000;
const FORCE_UNITS = ['N', 'kN', 'MN', 'GN'];
const forceFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });
const pad = (value, size = 2) => String(value).padStart(size, '0');

export const numberFormat = new Intl.NumberFormat('ko-KR');

export const wholePercent = (fraction) => Math.round(fraction * 100);

export function clockTime(seconds) {
  const minutes = Math.floor(seconds / MINUTE);
  const rest = seconds - minutes * MINUTE;
  return `${pad(minutes)}:${rest.toFixed(1).padStart(4, '0')}`;
}

export function spokenTime(seconds) {
  if (seconds < MINUTE) return `${seconds.toFixed(1)}초`;
  const minutes = Math.floor(seconds / MINUTE);
  return `${minutes}분 ${(seconds - minutes * MINUTE).toFixed(1)}초`;
}

export function stampDate(date) {
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
}

export function forceText(newtons) {
  const tier = Math.min(FORCE_UNITS.length - 1, Math.max(0, Math.floor(Math.log10(Math.max(newtons, 1)) / 3)));
  return `${forceFormat.format(newtons / FORCE_STEP ** tier)} ${FORCE_UNITS[tier]}`;
}

export function longDate(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function serialNumber(date, suffix) {
  return `제 ${date.getFullYear()}-${pad(date.getMonth() + 1)}${pad(date.getDate())}-${suffix} 호`;
}
