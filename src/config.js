export const CELL_METERS = 0.0035;
export const TEXELS_PER_CELL = 3;
export const GRAVITY = 9.81;
export const PHYSICS_STEP = 1 / 120;
export const MAX_PHYSICS_STEPS = 4;

export const SPECIMEN = Object.freeze({
  targetArea: 0.3,
  maxSide: 1.05,
  minCells: 8,
  alphaThreshold: 128,
  dropHeight: 0.05,
  minIslandCells: 40,
});

export const VIEW = Object.freeze({
  frameAspect: 16 / 9,
  floorLine: 0.84,
  subjectHeightShare: 0.5,
  subjectWidthShare: 0.62,
});

export const HAMMER = Object.freeze({
  length: 0.54,
  headLength: 0.18,
  headWidth: 0.058,
  handleWidth: 0.045,
  restLift: 0.45,
  windUpLift: (100 * Math.PI) / 180,
  fullLift: (160 * Math.PI) / 180,
  raiseSeconds: 0.09,
  swingSeconds: [0.08, 0.3],
  swingWeight: [2, 4],
  recoilSeconds: 0.2,
  tremble: 0.04,
});

export const CHARGE = Object.freeze({
  seconds: 3.6,
  tiers: [0.2, 0.4, 0.6, 0.8, 1],
  minRadius: 0.03,
  maxRadius: 0.24,
  minStrength: 1,
  maxStrength: 4.5,
  hits: 12,
  falloff: 0.5,
  blastReach: 1.6,
  blastSpeed: 5,
  blastHeft: 0.35,
  burst: 1.8,
  spray: 2.5,
});

export const BOMB = Object.freeze({
  size: 0.03,
  fuseSeconds: 2,
  capacity: 6,
  blinkRate: [2, 14],
  blow: Object.freeze({
    normalX: 0,
    normalY: 1,
    radius: 0.17,
    strength: 3.2,
    hits: 9,
    falloff: 0.6,
    shatter: true,
    spray: 2.2,
    burst: 2.6,
    blast: Object.freeze({ reach: 0.5, speed: 7, heft: 0.35 }),
    force: 0.85,
    cue: 'explode',
  }),
});

export const SAW = Object.freeze({
  radius: 0.11,
  spin: 14,
  spool: 12,
  biteSeconds: 1 / 15,
  whirSeconds: 0.16,
  spray: 1.4,
  burst: 2.4,
  drive: 1,
  shove: 1.5,
  heft: 0.3,
  shake: 0.003,
  recoil: Object.freeze({ speed: 0.25, climb: 0.5, stiffness: 400, damping: 18 }),
  shock: Object.freeze({ trauma: 0.32, kick: 0.06, punch: 0.004, flash: 0 }),
});

export const KATANA = Object.freeze({
  delay: 0.9,
  cadence: 0.08,
  steadyCuts: 3,
  quickening: 0.97,
  drawIn: 0.07,
  afterglow: 0.35,
  minLength: 0.04,
  width: 0.012,
  part: 1,
  lift: 0.4,
  spin: 2,
  tension: 0.5,
  sparkles: 6,
  sparkleReach: 0.01,
  slashShock: Object.freeze({ trauma: 0.15, kick: 0.1, punch: 0.01, flash: 0.15 }),
  severShock: Object.freeze({ trauma: 0.6, kick: 0.4, punch: 0.05, flash: 0.45 }),
});

export const PRESS = Object.freeze({
  halfWidth: 0.17,
  plateHeight: 0.06,
  rodWidth: 0.07,
  restGap: 0.02,
  floorGap: 0.004,
  contactGap: 0.006,
  band: 0.02,
  eject: 0.6,
  drop: 0.3,
  speed: 0.25,
  lift: 1.2,
  travel: 2.5,
  crushSeconds: 1 / 20,
  humSeconds: 0.2,
  cracks: 4,
  crackReach: 0.012,
  bins: 32,
  push: 0.15,
  slide: 0.12,
  spread: 2.5,
  squashStep: 0.01,
  squashShare: 0.6,
  minSquash: 0.1,
  burst: 1.4,
  squeeze: 0.25,
  tension: Object.freeze({ moving: 0.2, crushing: 0.7 }),
  shock: Object.freeze({ trauma: 0.4, kick: 0.08, punch: 0.006, flash: 0 }),
  landShock: Object.freeze({ trauma: 0.8, kick: 0.6, punch: 0.04, flash: 0.1 }),
});

export const FLAME = Object.freeze({
  heading: [1, -0.35],
  lead: 0.2,
  reach: 0.3,
  step: 0.008,
  contact: 0.01,
  rate: 320,
  puff: 40,
  speed: [3.4, 4.6],
  spread: 0.16,
  puffSpread: 0.7,
  life: [0.28, 0.46],
  size: [0.014, 0.085],
  swell: [0.7, 1.3],
  drag: 3,
  buoyancy: 2.4,
  splash: 0.55,
  rebound: 0.25,
  billow: 1.6,
  igniteSeconds: 0.12,
  core: 0.13,
  coreWidth: [0.01, 0.03],
  flare: 0.14,
  flicker: 0.25,
  glow: Object.freeze({ radius: 0.035, cooling: 1.6 }),
  scorchSeconds: 1 / 24,
  roarSeconds: 0.1,
  charReach: 1.8,
  smoke: 3,
  thrust: 0.06,
  heft: 0.15,
  blowout: Object.freeze({ burst: 1.4, strength: 1 }),
  tension: Object.freeze({ idle: 0.25, burning: 0.55 }),
  shock: Object.freeze({ trauma: 0.22, kick: 0.02, punch: 0.003, flash: 0 }),
  igniteShock: Object.freeze({ trauma: 0.35, kick: 0.3, punch: 0.02, flash: 0 }),
});

export const IMPACT = Object.freeze({
  trauma: [0.25, 1],
  kick: [0.15, 1],
  punch: [0.008, 0.09],
  flash: [0, 0.55],
  hitStop: [0.02, 0.16],
});

export const FRAGMENTS = Object.freeze({
  minBodyCells: 24,
  maxBodies: 220,
  ccdCells: 1600,
  impactCooldown: 0.12,
  minImpactCells: 60,
  impactsPerFrame: 4,
  soundSpeed: 0.6,
  burstRadius: 0.13,
  burstSpeed: 1.3,
  burstLift: 0.45,
  burstSpin: 7,
});

export const SHOCKWAVE = Object.freeze({
  radius: 0.3,
  speed: 1.4,
  referenceMass: 0.5,
});

export const COMPLETION = Object.freeze({
  destruction: 0.99,
  settleDelay: 0.6,
  settleTimeout: 2.5,
});

export const RECORDING = Object.freeze({
  fps: 30,
  longEdge: 1280,
  outroSeconds: 3.6,
  busyGrace: 0.9,
});
