import { sourceSize } from '../core/images.js';
import { nameFromFile } from '../core/naming.js';
import { byId } from './dom.js';

const HEIC = /hei[cf]/i;
const PASTED_NAME = '붙여넣은 이미지.png';
const REVOKE_DELAY = 1000;

async function decode(file) {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(file);
    } catch {
      return decodeWithElement(file);
    }
  }
  return decodeWithElement(file);
}

function decodeWithElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve(image);
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    image.src = url;
  });
}

const carriesFiles = (event) => Boolean(event.dataTransfer && Array.from(event.dataTransfer.types || []).includes('Files'));

export class ImageIntake {
  constructor({ canAccept, onImage, onError }) {
    this.canAccept = canAccept;
    this.onImage = onImage;
    this.onError = onError;
    this.input = byId('fileInput');
    this.veil = byId('dropVeil');
    this.depth = 0;
    this.input.addEventListener('change', () => this.load(this.input.files && this.input.files[0]));
    window.addEventListener('paste', (event) => this.paste(event));
    window.addEventListener('dragenter', (event) => this.enter(event));
    window.addEventListener('dragover', (event) => this.over(event));
    window.addEventListener('dragleave', (event) => this.leave(event));
    window.addEventListener('drop', (event) => this.drop(event));
  }

  pick() {
    this.input.value = '';
    this.input.click();
  }

  async load(file) {
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      this.onError('이미지 파일만 가능');
      return;
    }
    try {
      const source = await decode(file);
      if (!sourceSize(source).width) throw new Error('empty');
      this.onImage(source, nameFromFile(file.name));
    } catch {
      this.onError(HEIC.test(file.name || file.type) ? 'HEIC 미지원 · JPG·PNG 가능' : '이미지를 열 수 없음');
    }
  }

  accepts(event) {
    return this.canAccept() && carriesFiles(event);
  }

  paste(event) {
    if (!this.canAccept() || (event.target && event.target.tagName === 'INPUT')) return;
    const items = Array.from((event.clipboardData && event.clipboardData.items) || []);
    const item = items.find((entry) => entry.kind === 'file' && entry.type.startsWith('image/'));
    const file = item && item.getAsFile();
    if (!file) return;
    event.preventDefault();
    this.load(new File([file], PASTED_NAME, { type: file.type }));
  }

  enter(event) {
    if (!this.accepts(event)) return;
    event.preventDefault();
    this.depth++;
    this.veil.hidden = false;
  }

  over(event) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = this.canAccept() ? 'copy' : 'none';
  }

  leave(event) {
    if (!carriesFiles(event)) return;
    this.depth = Math.max(0, this.depth - 1);
    if (!this.depth) this.veil.hidden = true;
  }

  drop(event) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    this.depth = 0;
    this.veil.hidden = true;
    if (!this.canAccept()) return;
    const files = Array.from(event.dataTransfer.files || []);
    this.load(files.find((file) => file.type.startsWith('image/')) || files[0]);
  }
}
