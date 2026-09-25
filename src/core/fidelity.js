import { FIDELITY } from '../config.js';

const STORAGE_KEY = 'wajangchang.fidelity';
const { options, presets } = FIDELITY;
const KEYS = Object.keys(options);

function guarded(access) {
  try {
    return access();
  } catch {
    return null;
  }
}

const recall = () => guarded(() => JSON.parse(localStorage.getItem(STORAGE_KEY)));

const store = (profile) => guarded(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)));

const valid = (profile) => Boolean(profile) && KEYS.every((key) => options[key].includes(profile[key]));

const pick = (profile) => Object.fromEntries(KEYS.map((key) => [key, profile[key]]));

const matches = (profile, preset) => KEYS.every((key) => profile[key] === preset[key]);

class Fidelity {
  constructor() {
    const saved = recall();
    this.settled = valid(saved);
    this.profile = this.settled ? pick(saved) : presets.full;
    this.listener = null;
  }

  get preset() {
    return Object.keys(presets).find((key) => matches(this.profile, presets[key])) ?? null;
  }

  adopt(preset) {
    this.update(presets[preset]);
  }

  tune(key, value) {
    this.update({ ...this.profile, [key]: value });
  }

  update(profile) {
    this.profile = profile;
    this.settled = true;
    store(profile);
    if (this.listener) this.listener();
  }

  listen(listener) {
    this.listener = listener;
  }
}

export const fidelity = new Fidelity();
