const FALLBACK_NAME = '이 이미지';
const NAME_LIMIT = 20;
const FILE_NAME_LIMIT = 40;
const GENERIC_NAMES = /^(img|dsc|pxl|mvimg|screenshot|screen shot|스크린샷|kakaotalk|photo|image|unnamed|download)/i;
const SERIAL_DIGITS = /\d{5,}/;
const EXTENSION = /\.[a-z0-9]{2,5}$/i;
const UNSAFE_FILE_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]+/g;

export function tidyName(value) {
  return value.trim().slice(0, NAME_LIMIT) || FALLBACK_NAME;
}

export function nameFromFile(fileName) {
  const name = (fileName || '').replace(EXTENSION, '').trim();
  if (!name || GENERIC_NAMES.test(name) || SERIAL_DIGITS.test(name)) return FALLBACK_NAME;
  return tidyName(name.replace(/_+/g, ' '));
}

export function fileSafe(name) {
  return name.replace(UNSAFE_FILE_CHARACTERS, '').replace(/\s+/g, '_').slice(0, FILE_NAME_LIMIT) || FALLBACK_NAME;
}
