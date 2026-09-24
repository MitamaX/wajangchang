import { MATERIALS, MATERIAL_ORDER } from '../destruction/materials.js';
import { SAMPLES, SAMPLE_ORDER } from '../samples/samples.js';
import { byId, chipButton, markSelected, tileButton } from './dom.js';
import { ICONS } from './icons.js';

export class SetupPanel {
  constructor({ onMaterial, onSample, onUpload, onStart }) {
    this.root = byId('setup');
    this.thumb = byId('setupThumb');
    this.materials = MATERIAL_ORDER.map((key) => tileButton({ key, label: MATERIALS[key].label, icon: ICONS[key] }));
    this.samples = SAMPLE_ORDER.map((key) => chipButton({ key, label: SAMPLES[key].name }));
    this.startButton = byId('startButton');
    byId('materials').append(...this.materials);
    byId('samples').append(...this.samples);
    this.materials.forEach((button) => button.addEventListener('click', () => onMaterial(button.dataset.key)));
    this.samples.forEach((button) => button.addEventListener('click', () => onSample(button.dataset.key)));
    byId('setupUpload').addEventListener('click', onUpload);
    this.startButton.addEventListener('click', onStart);
  }

  present(thumb, sampleKey) {
    this.thumb.src = thumb.toDataURL('image/png');
    markSelected(this.samples, 'aria-current', sampleKey);
    this.root.hidden = false;
  }

  select(materialKey) {
    markSelected(this.materials, 'aria-pressed', materialKey);
  }

  hide() {
    this.root.hidden = true;
  }
}
