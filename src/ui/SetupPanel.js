import { MATERIALS, MATERIAL_ORDER } from '../destruction/materials.js';
import { SAMPLES, SAMPLE_ORDER } from '../samples/samples.js';
import { byId, chipButton, markSelected, tileButton } from './dom.js';
import { ICONS } from './icons.js';

const UPLOAD_KEY = 'upload';
const SELECTED = '[aria-pressed="true"]';
const Step = Object.freeze({ IMAGE: 'image', MATERIAL: 'material' });

const sampleChips = (className) => SAMPLE_ORDER.map((key) => chipButton({ key, label: SAMPLES[key].name, className }));
const materialTiles = () => MATERIAL_ORDER.map((key) => tileButton({ key, label: MATERIALS[key].label, icon: ICONS[key] }));

export class SetupPanel {
  constructor({ onMaterial, onSample, onUpload, onStart }) {
    this.panels = [byId('setup'), byId('dock')];
    this.thumb = byId('setupThumb');
    this.steps = { [Step.IMAGE]: byId('imageStep'), [Step.MATERIAL]: byId('materialStep') };
    const panelSamples = sampleChips('chip');
    const dockSamples = sampleChips('choice option');
    const panelMaterials = materialTiles();
    const dockMaterials = materialTiles();
    const dockUpload = byId('dockUpload');
    byId('samples').append(...panelSamples);
    dockUpload.before(...dockSamples);
    byId('materials').append(...panelMaterials);
    byId('dockMaterials').append(...dockMaterials);
    this.images = [...panelSamples, ...dockSamples, dockUpload];
    this.materials = [...panelMaterials, ...dockMaterials];
    [...panelSamples, ...dockSamples].forEach((button) => button.addEventListener('click', () => onSample(button.dataset.key)));
    this.materials.forEach((button) => button.addEventListener('click', () => onMaterial(button.dataset.key)));
    [byId('setupUpload'), dockUpload].forEach((button) => button.addEventListener('click', onUpload));
    [byId('startButton'), byId('dockStart')].forEach((button) => button.addEventListener('click', onStart));
    byId('nextButton').addEventListener('click', () => this.turn(Step.MATERIAL));
    byId('backButton').addEventListener('click', () => this.turn(Step.IMAGE));
  }

  present() {
    this.show(Step.IMAGE);
    this.panels.forEach((panel) => {
      panel.hidden = false;
    });
  }

  selectImage(thumb, sampleKey) {
    this.thumb.src = thumb.toDataURL('image/png');
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
    this.panels.forEach((panel) => {
      panel.hidden = true;
    });
  }
}
