import { BENCHMARK } from '../config.js';
import { createCanvas } from '../core/canvas.js';
import { pixelRatio } from '../core/display.js';
import { TAU, median, randomBetween } from '../core/math.js';
import { Layer, PhysicsWorld } from '../physics/PhysicsWorld.js';

const FRAME_SECONDS = 1 / 60;
const SPRITE_SIZE = 48;
const PARTICLE_SIZE = 3;
const PARTICLE_INKS = ['#c9c2b4', '#8d8478', '#e8e2d6', '#5b544b'];
const GLOW_REACH = 0.3;
const PILE_SURFACE = Object.freeze({ density: 2500, friction: 0.5, restitution: 0.1, groups: Layer.fragment, forceThreshold: Number.MAX_VALUE });

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

const ignore = () => {};

function timed(work) {
  const start = performance.now();
  work();
  return performance.now() - start;
}

function shadedCanvas(width, height) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#5a5d60');
  gradient.addColorStop(1, '#232426');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  return canvas;
}

function renderProbe() {
  const ratio = pixelRatio();
  const stage = createCanvas(window.innerWidth * ratio, window.innerHeight * ratio);
  const context = stage.getContext('2d');
  const { width, height } = stage;
  const layer = shadedCanvas(width, height);
  const sprite = shadedCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const readback = createCanvas(1, 1).getContext('2d', { willReadFrequently: true });
  return () => {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.drawImage(layer, 0, 0);
    context.drawImage(layer, 0, 0);
    for (let i = 0; i < BENCHMARK.sprites; i++) {
      const angle = randomBetween(0, TAU);
      context.setTransform(Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), randomBetween(0, width), randomBetween(0, height));
      context.drawImage(sprite, -SPRITE_SIZE / 2, -SPRITE_SIZE / 2);
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < BENCHMARK.particles; i++) {
      context.fillStyle = PARTICLE_INKS[i % PARTICLE_INKS.length];
      context.fillRect(randomBetween(0, width), randomBetween(0, height), PARTICLE_SIZE * ratio, PARTICLE_SIZE * ratio);
    }
    const glow = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.min(width, height) * GLOW_REACH);
    glow.addColorStop(0, 'rgba(255,200,120,0.8)');
    glow.addColorStop(1, 'rgba(255,200,120,0)');
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'source-over';
    readback.drawImage(stage, 0, 0, 1, 1, 0, 0, 1, 1);
    readback.getImageData(0, 0, 1, 1);
  };
}

function pile() {
  const { columns, rows, size } = BENCHMARK.pile;
  const physics = new PhysicsWorld((columns * size) / 2);
  const half = size / 2;
  const square = new Float32Array([-half, -half, half, -half, half, half, -half, half]);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = (column - (columns - 1) / 2) * size;
      const body = physics.createBody({ x, y: -(row + 0.5) * size, angle: 0, vx: 0, vy: 0, spin: 0 }, true);
      physics.attachConvex(body, square, PILE_SURFACE);
    }
  }
  return physics;
}

async function sample(frames, work, onFrame) {
  const times = [];
  for (let i = 0; i < frames; i++) {
    await nextFrame();
    times.push(timed(work));
    onFrame();
  }
  return median(times);
}

export async function measure(onProgress) {
  const { renderFrames, physicsFrames, budgets } = BENCHMARK;
  let done = 0;
  const tick = () => onProgress(++done / (renderFrames + physicsFrames));
  const render = await sample(renderFrames, renderProbe(), tick);
  const physics = pile();
  const simulate = await sample(physicsFrames, () => physics.advance(FRAME_SECONDS, ignore), tick);
  physics.dispose();
  const cost = render + simulate;
  return Object.keys(budgets).find((preset) => cost <= budgets[preset]);
}
