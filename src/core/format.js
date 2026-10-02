import { LANGUAGE_TAG } from '../i18n/locale.js';

const MINUTE = 60;
const FORCE_STEP = 1000;
const FORCE_UNITS = ['N', 'kN', 'MN', 'GN'];
const forceFormat = new Intl.NumberFormat(LANGUAGE_TAG, { maximumFractionDigits: 1 });
const secondFormat = new Intl.NumberFormat(LANGUAGE_TAG, { style: 'unit', unit: 'second', unitDisplay: 'narrow', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const minuteFormat = new Intl.NumberFormat(LANGUAGE_TAG, { style: 'unit', unit: 'minute', unitDisplay: 'narrow' });
const stampFormat = new Intl.DateTimeFormat(LANGUAGE_TAG);
const longFormat = new Intl.DateTimeFormat(LANGUAGE_TAG, { dateStyle: 'long' });
const dayFormat = new Intl.DateTimeFormat(LANGUAGE_TAG, { month: 'long', day: 'numeric', weekday: 'long' });
const initialFormat = new Intl.DateTimeFormat(LANGUAGE_TAG, { weekday: 'narrow' });
const pad = (value, size = 2) => String(value).padStart(size, '0');

export const numberFormat = new Intl.NumberFormat(LANGUAGE_TAG);

export const wholePercent = (fraction) => Math.round(fraction * 100);

export function clockTime(seconds) {
  const minutes = Math.floor(seconds / MINUTE);
  const rest = seconds - minutes * MINUTE;
  return `${pad(minutes)}:${rest.toFixed(1).padStart(4, '0')}`;
}

export function spokenTime(seconds) {
  if (seconds < MINUTE) return secondFormat.format(seconds);
  const minutes = Math.floor(seconds / MINUTE);
  return `${minuteFormat.format(minutes)} ${secondFormat.format(seconds - minutes * MINUTE)}`;
}

export const stampDate = (date) => stampFormat.format(date);

export function forceText(newtons) {
  const tier = Math.min(FORCE_UNITS.length - 1, Math.max(0, Math.floor(Math.log10(Math.max(newtons, 1)) / 3)));
  return `${forceFormat.format(newtons / FORCE_STEP ** tier)} ${FORCE_UNITS[tier]}`;
}

export const longDate = (date) => longFormat.format(date);

export const dayHeading = (date) => dayFormat.format(date);

export const weekdayInitial = (date) => initialFormat.format(date);

export function serialCode(date, suffix) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}${pad(date.getDate())}-${suffix}`;
}
