import { clamp } from '../core/math.js';
import { byId, markSelected, tileButton } from './dom.js';
import { ICONS } from './icons.js';

const PAGE_SIZE = 4;
const SHORTCUTS = [...'123456789'];
const WHEEL_STEP = 60;
const SWIPE_DISTANCE = 32;

const pageOf = (index) => Math.floor(index / PAGE_SIZE);
const dominant = (x, y) => (Math.abs(x) > Math.abs(y) ? x : y);

export class ToolRack {
  constructor(tools, { onSelect }) {
    this.root = byId('rack');
    this.buttons = tools.map(({ key, label }, index) => tileButton({ key, label, icon: ICONS[key], shortcut: SHORTCUTS[index] }));
    this.prevButton = byId('rackPrev');
    this.nextButton = byId('rackNext');
    this.lastPage = pageOf(this.buttons.length - 1);
    this.page = 0;
    this.wheel = 0;
    this.swipe = null;
    this.swiped = false;
    const tiles = byId('rackTiles');
    tiles.style.setProperty('--rack-slots', String(PAGE_SIZE));
    tiles.append(...this.buttons);
    [this.prevButton, this.nextButton].forEach((arrow) => {
      arrow.hidden = this.lastPage === 0;
    });
    this.buttons.forEach((button) => button.addEventListener('click', () => onSelect(button.dataset.key)));
    this.prevButton.addEventListener('click', () => this.turn(-1));
    this.nextButton.addEventListener('click', () => this.turn(1));
    this.root.addEventListener('wheel', (event) => this.scroll(event), { passive: false });
    this.root.addEventListener('pointerdown', (event) => this.touch(event));
    this.root.addEventListener('pointerup', (event) => this.lift(event));
    this.root.addEventListener('click', (event) => this.swallow(event), true);
    this.show(0);
  }

  get paged() {
    return getComputedStyle(this.nextButton).display !== 'none';
  }

  toolFor(shortcut) {
    const button = this.buttons[SHORTCUTS.indexOf(shortcut)];
    return button ? button.dataset.key : null;
  }

  select(key) {
    markSelected(this.buttons, 'aria-pressed', key);
    this.show(pageOf(this.buttons.findIndex((button) => button.dataset.key === key)));
  }

  turn(step) {
    this.show(this.page + step);
  }

  show(page) {
    this.page = clamp(page, 0, this.lastPage);
    this.buttons.forEach((button, index) => button.toggleAttribute('data-offpage', pageOf(index) !== this.page));
    this.prevButton.disabled = this.page === 0;
    this.nextButton.disabled = this.page === this.lastPage;
  }

  scroll(event) {
    if (!this.paged) return;
    event.preventDefault();
    const delta = dominant(event.deltaX, event.deltaY);
    this.wheel += event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? delta : Math.sign(delta) * WHEEL_STEP;
    if (Math.abs(this.wheel) < WHEEL_STEP) return;
    this.turn(Math.sign(this.wheel));
    this.wheel = 0;
  }

  touch(event) {
    this.swiped = false;
    this.swipe = event.pointerType === 'mouse' ? null : { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  lift(event) {
    const { swipe } = this;
    this.swipe = null;
    if (!swipe || swipe.id !== event.pointerId || !this.paged) return;
    const travel = dominant(event.clientX - swipe.x, event.clientY - swipe.y);
    if (Math.abs(travel) < SWIPE_DISTANCE) return;
    this.swiped = true;
    this.turn(-Math.sign(travel));
  }

  swallow(event) {
    if (!this.swiped) return;
    this.swiped = false;
    event.stopPropagation();
  }
}
