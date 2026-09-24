import { createCanvas } from '../core/canvas.js';
import { sourceSize } from '../core/images.js';
import { MATERIAL_ORDER } from '../destruction/materials.js';
import { SAMPLE_ORDER } from '../samples/samples.js';

const STORAGE_KEY = 'wajangchang:setup';
const DEFAULT_SAMPLE = 'monday';
const DEFAULT_MATERIAL = 'glass';
const UPLOAD_EDGE = 1024;
const UPLOAD_TYPE = 'image/webp';

function readRecord() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeRecord(record) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

function encodeUpload(source) {
  const { width, height } = sourceSize(source);
  const scale = Math.min(1, UPLOAD_EDGE / Math.max(width, height));
  const canvas = createCanvas(width * scale, height * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(UPLOAD_TYPE);
}

function decodeUpload(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

export class SetupMemory {
  constructor(record, upload) {
    this.record = record;
    this.upload = upload;
  }

  static async recall() {
    const record = readRecord();
    const upload = record.upload ? await decodeUpload(record.upload) : null;
    return new SetupMemory(record, upload);
  }

  get sampleKey() {
    const { sampleKey } = this.record;
    return SAMPLE_ORDER.includes(sampleKey) ? sampleKey : DEFAULT_SAMPLE;
  }

  get materialKey() {
    const { materialKey } = this.record;
    return MATERIAL_ORDER.includes(materialKey) ? materialKey : DEFAULT_MATERIAL;
  }

  get name() {
    return this.record.name;
  }

  keepImage(source, name, sampleKey) {
    const upload = sampleKey ? null : this.encode(source);
    this.upload = sampleKey ? null : source;
    this.save({ ...this.record, sampleKey, name, upload });
  }

  keepMaterial(materialKey) {
    this.save({ ...this.record, materialKey });
  }

  encode(source) {
    return source === this.upload ? this.record.upload : encodeUpload(source);
  }

  save(record) {
    this.record = record;
    if (!writeRecord(record)) writeRecord({ ...record, upload: null });
  }
}
