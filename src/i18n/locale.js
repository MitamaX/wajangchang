const ENGLISH_PATH = '/en';
const ENGLISH_ROUTE = /^\/en(\/|$)/;
const KOREAN = /^ko\b/i;

export const LOCALE = ENGLISH_ROUTE.test(location.pathname) ? 'en' : 'ko';

export const LANGUAGE_TAG = Object.freeze({ ko: 'ko-KR', en: 'en-US' })[LOCALE];

const readsKorean = () => (navigator.languages || [navigator.language]).some((language) => KOREAN.test(language));

export function preferredLocalePath() {
  if (LOCALE === 'en' || readsKorean()) return null;
  return `${ENGLISH_PATH}${location.search}${location.hash}`;
}
