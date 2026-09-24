import { MATERIALS, MATERIAL_ORDER } from '../destruction/materials.js';
import { SAMPLES, SAMPLE_ORDER } from '../samples/samples.js';
import { byId, chipButton, markSelected, tileButton } from './dom.js';
import { ICONS } from './icons.js';

const UPLOAD_KEY = 'upload';
const SELECTED = '[aria-pressed="true"]';
const Step = Object.freeze({ IMAGE: 'image', MATERIAL: 'material' });

export class SetupPanel {
  constructor({ onMaterial, onSample, onUpload, onStart }) {
    this.root = byId('setup');
    this.steps = { [Step.IMAGE]: byId('imageStep'), [Step.MATERIAL]: byId('materialStep') };
    const upload = byId('setupUpload');
    const samples = SAMPLE_ORDER.map((key) => chipButton({ key, label: SAMPLES[key].name }));
    this.images = [...samples, upload];
    this.materials = MATERIAL_ORDER.map((key) => tileButton({ key, label: MATERIALS[key].label, icon: ICONS[key] }));
    upload.before(...samples);
    byId('materials').append(...this.materials);
    samples.forEach((button) => button.addEventListener('click', () => onSample(button.dataset.key)));
    this.materials.forEach((button) => button.addEventListener('click', () => onMaterial(button.dataset.key)));
    upload.addEventListener('click', onUpload);
    byId('nextButton').addEventListener('click', () => this.turn(Step.MATERIAL));
    byId('backButton').addEventListener('click', () => this.turn(Step.IMAGE));
    byId('startButton').addEventListener('click', onStart);
  }

  present() {
    this.show(Step.IMAGE);
    this.root.hidden = false;
  }

  selectImage(sampleKey) {
    markSelected(this.images, 'aria-pressed', sampleKey ?? UPLOAD_KEY);
  }

  selectMaterial(materialKey) {
    markSelected(this.materials, 'aria-pressed', materialKey);
  }

  turn(name) {
    this.show(name);
    this.steps[name].querySelector(SELECTED).focus({ preventScroll: true });
  }

  show(name) {
    Object.entries(this.steps).forEach(([key, step]) => {
      step.inert = key !== name;
    });
  }

  hide() {
    this.root.hidden = true;
  }
}
