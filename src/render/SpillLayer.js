const IDENTITY = new DOMMatrix();

export class SpillLayer {
  constructor(canvas, stage) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.stage = stage;
    this.dpr = 1;
    this.corner = 0;
    this.blank = false;
    window.addEventListener('resize', () => this.resize(this.dpr));
  }

  resize(dpr) {
    this.dpr = dpr;
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
    this.corner = parseFloat(getComputedStyle(this.stage.parentElement).borderTopLeftRadius) || 0;
    this.blank = false;
  }

  draw(world, paint) {
    if (this.blank && !world) return;
    const { context, canvas, dpr } = this;
    context.setTransform(IDENTITY);
    context.clearRect(0, 0, canvas.width, canvas.height);
    this.blank = !world;
    if (!world) return;
    const { left, top, width, height } = this.stage.getBoundingClientRect();
    context.save();
    context.beginPath();
    context.rect(0, 0, canvas.width, canvas.height);
    context.roundRect(left * dpr, top * dpr, width * dpr, height * dpr, this.corner * dpr);
    context.clip('evenodd');
    context.setTransform(new DOMMatrix().translateSelf(left * dpr, top * dpr).multiply(world));
    paint(context);
    context.restore();
  }
}
