import { FIDELITY } from '../config.js';
import { byId, chipButton, markSelected } from './dom.js';

const CLOSE_KEY = 'Escape';
const SWITCH = Object.freeze({ true: '켬', false: '끔' });
const PRESETS = Object.freeze({ key: 'preset', label: '사양', names: Object.freeze({ full: '기본', lite: '저사양', bare: '최저' }) });
const KNOBS = Object.freeze([
  { key: 'pixelRatio', label: '해상도', names: { 2: '높음', 1: '보통' } },
  { key: 'bodies', label: '파편', names: { 220: '많음', 100: '적음' } },
  { key: 'particles', label: '입자', names: { 1: '많음', 0.5: '적음', 0: '없음' } },
  { key: 'shadows', label: '그림자', names: SWITCH },
  { key: 'blur', label: '블러', names: SWITCH },
  { key: 'effects', label: '이펙트', names: SWITCH },
  { key: 'longEdge', label: '녹화', names: { 1280: '720p', 854: '480p' } },
]);

function knob({ key, label, names }, values, onPick) {
  const group = document.createElement('div');
  const title = document.createElement('span');
  title.className = 'label';
  title.id = `knob-${key}`;
  title.textContent = label;
  group.className = 'knob';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', title.id);
  const buttons = values.map((value) => chipButton({ key: value, label: names[value], className: 'chip' }));
  buttons.forEach((button, i) => button.addEventListener('click', () => onPick(values[i])));
  group.append(title, ...buttons);
  return { key, group, buttons };
}

function rule() {
  const line = document.createElement('hr');
  line.className = 'knob-rule';
  return line;
}

export class FidelityDialog {
  constructor({ onPreset, onTune }) {
    this.root = byId('fidelity');
    this.closeButton = byId('fidelityClose');
    this.opener = null;
    this.presets = knob(PRESETS, Object.keys(FIDELITY.presets), onPreset);
    this.knobs = KNOBS.map((spec) => knob(spec, FIDELITY.options[spec.key], (value) => onTune(spec.key, value)));
    byId('fidelityKnobs').append(this.presets.group, rule(), ...this.knobs.map(({ group }) => group));
    this.closeButton.addEventListener('click', () => this.close());
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.close();
    });
    this.root.addEventListener('keydown', (event) => {
      if (event.key === CLOSE_KEY) this.close();
    });
  }

  present() {
    this.opener = document.activeElement;
    this.root.hidden = false;
    this.closeButton.focus({ preventScroll: true });
  }

  close() {
    this.root.hidden = true;
    if (this.opener) this.opener.focus({ preventScroll: true });
  }

  show(profile, preset) {
    markSelected(this.presets.buttons, 'aria-pressed', preset);
    this.knobs.forEach(({ key, buttons }) => markSelected(buttons, 'aria-pressed', String(profile[key])));
  }
}
