import { clamp } from '../core/math.js';
import { byId, markSelected, tileButton } from './dom.js';
import { ICONS } from './icons.js';

const PAGE_SIZE = 4;
const SHORTCUTS = [...'123456789'];
const WHEEL_STEP = 60;
const SWIPE_SHARE = 0.3;
const TAP_SLOP = 8;

const pageOf = (index) => Math.floor(index / PAGE_SIZE);

export class ToolRack {
  constructor(tools, { onSelect }) {
    this.tiles = byId('rackTiles');
    this.buttons = tools.map(({ key, label }, index) => tileButton({ key, label, icon: ICONS[key], shortcut: SHORTCUTS[index] }));
    this.prevButton = byId('rackPrev');
    this.nextButton = byId('rackNext');
    this.lastPage = pageOf(this.buttons.length - 1);
    this.wheel = 0;
    this.drag = null;
    this.swiped = false;
    this.tiles.style.setProperty('--rack-slots', String(PAGE_SIZE));
    this.tiles.style.setProperty('--rack-columns', String((this.lastPage + 1) * PAGE_SIZE));
    this.tiles.append(...this.buttons);
    this.buttons.forEach((button) => button.addEventListener('click', () => onSelect(button.dataset.key)));
    [this.prevButton, this.nextButton].forEach((arrow) => {
      arrow.hidden = this.lastPage === 0;
    });
    this.prevButton.addEventListener('click', () => this.turn(-1));
    this.nextButton.addEventListener('click', () => this.turn(1));
    this.tiles.addEventListener('scroll', () => this.mark());
    this.tiles.addEventListener('pointerdown', (event) => this.grab(event));
    this.tiles.addEventListener('pointermove', (event) => this.pull(event));
    this.tiles.addEventListener('pointerup', (event) => this.letGo(event, true));
    this.tiles.addEventListener('pointercancel', (event) => this.letGo(event, false));
    this.tiles.addEventListener('click', (event) => this.swallowSwipe(event), true);
    byId('rack').addEventListener('wheel', (event) => this.scroll(event), { passive: false });
    this.mark();
  }

  get paged() {
    return getComputedStyle(this.nextButton).display !== 'none';
  }

  get stride() {
    return this.lastPage ? this.buttons[PAGE_SIZE].offsetLeft - this.buttons[0].offsetLeft : 0;
  }

  get page() {
    const { stride } = this;
    return stride ? clamp(Math.round(this.tiles.scrollLeft / stride), 0, this.lastPage) : 0;
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
    this.tiles.scrollTo({ left: clamp(page, 0, this.lastPage) * this.stride });
  }

  mark() {
    const { page } = this;
    this.prevButton.disabled = page === 0;
    this.nextButton.disabled = page === this.lastPage;
  }

  grab(event) {
    this.swiped = false;
    if (!this.paged || event.pointerType === 'mouse') return;
    this.drag = { id: event.pointerId, x: event.clientX, page: this.page };
  }

  pull(event) {
    const { drag } = this;
    if (!drag || drag.id !== event.pointerId) return;
    const shift = event.clientX - drag.x;
    if (Math.abs(shift) > TAP_SLOP) this.swiped = true;
    if (this.swiped) this.tiles.scrollTo({ left: drag.page * this.stride - shift, behavior: 'instant' });
  }

  letGo(event, commit) {
    const { drag } = this;
    if (!drag || drag.id !== event.pointerId) return;
    this.drag = null;
    const shift = event.clientX - drag.x;
    const turning = commit && Math.abs(shift) > this.stride * SWIPE_SHARE;
    this.show(drag.page - (turning ? Math.sign(shift) : 0));
  }

  swallowSwipe(event) {
    if (!this.swiped) return;
    this.swiped = false;
    event.preventDefault();
    event.stopPropagation();
  }

  scroll(event) {
    if (!this.paged) return;
    event.preventDefault();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    this.wheel += event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? delta : Math.sign(delta) * WHEEL_STEP;
    if (Math.abs(this.wheel) < WHEEL_STEP) return;
    this.turn(Math.sign(this.wheel));
    this.wheel = 0;
  }
}
