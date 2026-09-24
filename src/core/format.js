const MINUTE = 60;
const pad = (value, size = 2) => String(value).padStart(size, '0');
const WEEKDAYS = '일월화수목금토';

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
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. (${WEEKDAYS[date.getDay()]}) ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function longDate(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function serialNumber(date, suffix) {
  return `제 ${date.getFullYear()}-${pad(date.getMonth() + 1)}${pad(date.getDate())}-${suffix} 호`;
}
