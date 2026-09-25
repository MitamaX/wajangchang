import { CELL_METERS, TEXELS_PER_CELL } from '../config.js';
import { createCanvas } from '../core/canvas.js';
import { fidelity } from '../core/fidelity.js';
import { clamp } from '../core/math.js';
import { paintBackdrop } from './Backdrop.js';
import { SpillLayer } from './SpillLayer.js';

const TEXEL_METERS = CELL_METERS / TEXELS_PER_CELL;
const SHADOW_SPRITE = 64;
const SHADOW_REACH = 0.56;
const STREAK = 0.022;
const IDENTITY = new DOMMatrix();
const FLASH_TINT = '225,245,255';
const VIGNETTE_CLEAR = 0.35;

function shadowSprite() {
  const canvas = createCanvas(SHADOW_SPRITE, SHADOW_SPRITE);
  const context = canvas.getContext('2d');
  const half = SHADOW_SPRITE / 2;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(0,0,0,0.85)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, SHADOW_SPRITE, SHADOW_SPRITE);
  return canvas;
}

function traceShard(context, particle) {
  const cos = Math.cos(particle.angle) * particle.size;
  const sin = Math.sin(particle.angle) * particle.size;
  const { outline } = particle;
  context.beginPath();
  for (let i = 0; i < outline.length; i += 2) {
    const x = particle.x + outline[i] * cos - outline[i + 1] * sin;
    const y = particle.y + outline[i] * sin + outline[i + 1] * cos;
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function paintShard(context, particle) {
  traceShard(context, particle);
  context.fillStyle = particle.color;
  context.fill();
}

function paintGrain(context, { x, y, size, color }) {
  context.fillStyle = color;
  context.fillRect(x - size / 2, y - size / 2, size, size);
}

function paintSolid(context, particle) {
  if (particle.spec.grain) paintGrain(context, particle);
  else paintShard(context, particle);
}

function paintHaze(context, particle) {
  context.globalAlpha = (1 - particle.age / particle.life) * 0.7;
  context.fillStyle = particle.color;
  context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
}

function paintGlow(context, particle) {
  context.globalAlpha = 1 - particle.age / particle.life;
  context.strokeStyle = particle.color;
  context.lineWidth = particle.size;
  context.beginPath();
  context.moveTo(particle.x, particle.y);
  context.lineTo(particle.x - particle.vx * STREAK, particle.y - particle.vy * STREAK);
  context.stroke();
}

export class Renderer {
  constructor(canvas, spillCanvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.spill = new SpillLayer(spillCanvas, canvas);
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.backdrop = null;
    this.rubble = null;
    this.shadow = shadowSprite();
  }

  resize(width, height, dpr) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.spill.resize(dpr);
  }

  stage(camera, room, restingDebris) {
    this.backdrop = paintBackdrop(this.width, this.height, this.dpr, camera, room);
    this.restock(camera, restingDebris);
  }

  restock(camera, restingDebris) {
    const { width, height } = this.canvas;
    if (this.rubble && this.rubble.width === width && this.rubble.height === height) {
      const context = this.rubble.getContext('2d');
      context.setTransform(IDENTITY);
      context.clearRect(0, 0, width, height);
    } else {
      this.rubble = createCanvas(width, height);
    }
    this.bake(camera, restingDebris);
  }

  bake(camera, particles) {
    if (!this.rubble || !particles.length) return;
    const context = this.rubble.getContext('2d');
    context.setTransform(this.worldMatrix(camera, IDENTITY));
    particles.forEach((particle) => paintSolid(context, particle));
  }

  worldMatrix(camera, view) {
    const scale = camera.scale * this.dpr;
    return view.multiply(new DOMMatrix([scale, 0, 0, scale, camera.originX * this.dpr, camera.originY * this.dpr]));
  }

  render({ camera, session }) {
    const { context } = this;
    const view = camera.view(this.dpr);
    const world = this.worldMatrix(camera, view);
    context.setTransform(IDENTITY);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = '#4b4e51';
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    context.setTransform(view);
    if (this.backdrop) context.drawImage(this.backdrop, 0, 0);
    if (session) this.drawScene(context, camera, view, world, session);
    const shown = session ? session.tools.filter((tool) => tool.shown && tool.spills) : [];
    this.spill.draw(shown.length ? world : null, (spill) => shown.forEach((tool) => tool.draw(spill, camera.scale)));
  }

  drawScene(context, camera, view, world, session) {
    context.setTransform(world);
    this.drawShadows(context, session.fragments);
    context.setTransform(view);
    if (this.rubble) context.drawImage(this.rubble, 0, 0);
    this.drawFragments(context, world, session.fragments);
    context.setTransform(world);
    session.tools.forEach((tool) => tool.draw(context, camera.scale));
    this.drawFlying(context, session.debris.flying);
    context.setTransform(IDENTITY);
    if (!fidelity.profile.effects) return;
    this.drawVignette(context, camera.vignette);
    this.drawFlash(context, camera.flash);
  }

  drawVignette(context, strength) {
    if (strength < 0.01) return;
    const { width, height } = this.canvas;
    const reach = Math.hypot(width, height) / 2;
    const gradient = context.createRadialGradient(width / 2, height / 2, reach * VIGNETTE_CLEAR, width / 2, height / 2, reach);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(0,0,0,${strength})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }

  drawFlash(context, strength) {
    if (strength < 0.01) return;
    context.fillStyle = `rgba(${FLASH_TINT},${strength})`;
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawShadows(context, fragments) {
    if (!fidelity.profile.shadows) return;
    fragments.forEach((fragment) => this.drawShadow(context, fragment));
    context.globalAlpha = 1;
  }

  drawShadow(context, { body, area }) {
    const center = body.worldCom();
    const radius = Math.sqrt(area) * SHADOW_REACH;
    const gap = -(center.y + radius * 0.7);
    const strength = 0.5 * clamp(1 - gap / (radius * 2 + 0.03), 0, 1);
    if (strength <= 0.01) return;
    const spreadX = radius * 1.15;
    const spreadY = Math.max(radius * 0.1, 0.006);
    context.globalAlpha = strength;
    context.drawImage(this.shadow, center.x - spreadX, -spreadY, spreadX * 2, spreadY * 2);
  }

  drawFragments(context, world, fragments) {
    const { a, b, c, d, e, f } = world;
    for (const { body, skin, anchorX, anchorY } of fragments) {
      const { x, y } = body.translation();
      const angle = body.rotation();
      const cos = Math.cos(angle) * TEXEL_METERS;
      const sin = Math.sin(angle) * TEXEL_METERS;
      context.setTransform(a, b, c, d, e, f);
      context.transform(cos, sin, -sin, cos, x, y);
      context.drawImage(skin.canvas, -anchorX * TEXELS_PER_CELL, -anchorY * TEXELS_PER_CELL);
    }
  }

  drawFlying(context, particles) {
    for (const particle of particles) {
      if (particle.spec.solid) paintSolid(context, particle);
      else if (!particle.spec.glow) paintHaze(context, particle);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    for (const particle of particles) if (particle.spec.glow) paintGlow(context, particle);
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
  }
}
