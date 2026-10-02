import en from './en.js';
import ko from './ko.js';
import { LOCALE } from './locale.js';

function deepFreeze(value) {
  if (value && typeof value === 'object') Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const TEXT = deepFreeze({ ko, en }[LOCALE]);

const phrase = (path) => path.split('.').reduce((node, key) => node[key], TEXT);

export function localizePage() {
  document.documentElement.lang = LOCALE;
  document.documentElement.style.setProperty('--f-brand-face', TEXT.brandFace);
  document.querySelectorAll('[data-text]').forEach((element) => {
    element.textContent = phrase(element.dataset.text);
  });
  document.querySelectorAll('[data-label]').forEach((element) => {
    element.setAttribute('aria-label', phrase(element.dataset.label));
  });
}
