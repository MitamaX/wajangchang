import { FIDELITY } from '../config.js';

const STORAGE_KEY = 'wajangchang.fidelity';
const LEVELS = Object.keys(FIDELITY);

function guarded(access) {
  try {
    return access();
  } catch {
    return null;
  }
}

const recall = () => guarded(() => JSON.parse(localStorage.getItem(STORAGE_KEY)));

const store = (choice) => guarded(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(choice)));

class Fidelity {
  constructor() {
    const saved = recall();
    const known = LEVELS.includes(saved?.level);
    this.level = known ? saved.level : LEVELS[0];
    this.pinned = known && saved.pinned === true;
    this.listener = null;
  }

  get profile() {
    return FIDELITY[this.level];
  }

  get rank() {
    return LEVELS.indexOf(this.level);
  }

  get adapting() {
    return !this.pinned && this.rank < LEVELS.length - 1;
  }

  cycle() {
    this.pinned = true;
    this.select((this.rank + 1) % LEVELS.length);
  }

  degrade() {
    this.select(this.rank + 1);
  }

  select(rank) {
    this.level = LEVELS[rank];
    store({ level: this.level, pinned: this.pinned });
    if (this.listener) this.listener();
  }

  listen(listener) {
    this.listener = listener;
  }
}

export const fidelity = new Fidelity();
