const DEFAULT_DURATION = 2600;

export class Toast {
  constructor(element) {
    this.element = element;
    this.timer = 0;
  }

  show(message, duration = DEFAULT_DURATION) {
    this.element.textContent = message;
    this.element.classList.add('show');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.element.classList.remove('show'), duration);
  }
}
