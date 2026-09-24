const PRIMARY_BUTTON = 0;
const STRIKE_KEYS = new Set([' ', 'Enter']);
const KEYBOARD = 'keyboard';

export class StageInput {
  constructor(canvas, handlers) {
    this.canvas = canvas;
    this.handlers = handlers;
    this.holder = null;
    this.armed = false;
    canvas.addEventListener('pointerdown', (event) => this.press(event));
    canvas.addEventListener('pointermove', (event) => this.move(event));
    canvas.addEventListener('pointerleave', () => this.leave());
    canvas.addEventListener('pointerup', (event) => this.lift(event.pointerId));
    canvas.addEventListener('pointercancel', (event) => this.drop(event.pointerId));
    canvas.addEventListener('lostpointercapture', (event) => this.drop(event.pointerId));
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('keydown', (event) => this.pressKey(event));
    canvas.addEventListener('keyup', (event) => {
      if (STRIKE_KEYS.has(event.key)) this.lift(KEYBOARD);
    });
    canvas.addEventListener('blur', () => this.drop(KEYBOARD));
  }

  get holding() {
    return this.holder !== null;
  }

  press(event) {
    if (event.pointerType === 'mouse' && event.button !== PRIMARY_BUTTON) return;
    event.preventDefault();
    if (this.holder !== null || !this.arm()) return;
    this.holder = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    this.handlers.onCharge(...this.locate(event));
  }

  pressKey(event) {
    if (!STRIKE_KEYS.has(event.key)) return;
    event.preventDefault();
    if (event.repeat || this.holder !== null || !this.arm()) return;
    this.holder = KEYBOARD;
    this.handlers.onKeyCharge();
  }

  move(event) {
    if (!this.arm()) return;
    if (this.holder === null || this.holder === event.pointerId) this.handlers.onAim(...this.locate(event));
  }

  leave() {
    if (this.armed) this.handlers.onLeave();
  }

  lift(holder) {
    if (this.letGo(holder)) this.handlers.onRelease();
  }

  drop(holder) {
    if (this.letGo(holder)) this.handlers.onCancel();
  }

  letGo(holder) {
    const holding = this.holder !== null && this.holder === holder;
    if (holding) this.holder = null;
    return holding;
  }

  cancel() {
    this.show(false);
    this.drop(this.holder);
  }

  arm() {
    this.show(this.handlers.canStrike());
    return this.armed;
  }

  show(armed) {
    this.armed = armed;
    this.canvas.toggleAttribute('data-armed', armed);
  }

  locate(event) {
    const bounds = this.canvas.getBoundingClientRect();
    return [event.clientX - bounds.left, event.clientY - bounds.top];
  }
}
