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

export const SHATTER = Object.freeze({ rays: 14, rings: 4 });

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
    shatter: SHATTER,
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
  pause: 0.35,
  tempo: 5,
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

export const GANTRY = Object.freeze({
  restGap: 0.02,
  travel: 2.5,
  overhang: 0.2,
});

export const PRESS = Object.freeze({
  halfWidth: 0.17,
  plateHeight: 0.06,
  rodWidth: 0.07,
  floorGap: 0.004,
  contactGap: 0.006,
  band: 0.02,
  eject: 0.6,
  drop: 0.3,
  speed: 0.25,
  lift: 1.2,
  tempo: 4,
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

export const BALL = Object.freeze({
  radius: 0.085,
  surface: Object.freeze({ density: 900, friction: 0.5, restitution: 0.12 }),
  reloadSeconds: 1,
  searSeconds: 1 / 15,
  sizzleSeconds: 0.14,
  crackSeconds: 0.35,
  charReach: 1.3,
  smoke: 1,
  tension: 0.3,
  landSpeed: 1.2,
  landShock: Object.freeze({ trauma: 0.55, kick: 0.45, punch: 0.02, flash: 0 }),
  restSpeed: 0.05,
  restSeconds: 1.2,
  lifeSeconds: 15,
  fadeSeconds: 0.6,
});

export const GUN = Object.freeze({
  rate: 14,
  spread: [0.004, 0.035],
  bloomSeconds: 1.2,
  recovery: 0.7,
  spin: 40,
  spool: 7,
  tracerSpeed: 40,
  riseSeconds: 0.18,
  motorSeconds: 0.12,
  smokeSeconds: 0.06,
  smokeHeat: 0.12,
  holeSeconds: 1.6,
  holes: 24,
  round: Object.freeze({
    radius: 0.014,
    strength: 0.8,
    hits: 1,
    falloff: 0,
    shatter: false,
    spray: 0.7,
    burst: 0.9,
    contact: 0.004,
    blast: Object.freeze({ reach: 0.06, speed: 1.4, heft: 0.2 }),
    cue: 'gunshot',
    shock: Object.freeze({ trauma: 0.14, kick: 0.05, punch: 0.004, flash: 0.03 }),
  }),
});

export const LIGHTNING = Object.freeze({
  cooldown: 0.25,
  leaderSeconds: 0.24,
  boltSeconds: 0.32,
  fadeSeconds: 0.35,
  strokes: [0, 0.07, 0.16],
  afterglow: 0.25,
  skyFlash: 0.2,
  drift: 0.25,
  jag: 0.28,
  depth: 4,
  branches: 3,
  branchReach: [0.12, 0.3],
  charReach: 0.014,
  blow: Object.freeze({
    normalX: 0,
    normalY: 1,
    radius: 0.07,
    strength: 2.6,
    hits: 6,
    falloff: 0.5,
    shatter: false,
    spray: 1.6,
    burst: 1.8,
    contact: 0.01,
    blast: Object.freeze({ reach: 0.3, speed: 3.5, heft: 0.3 }),
    force: 0.65,
    cue: 'thunder',
  }),
});

export const NUKE = Object.freeze({
  capacity: 1,
  drop: 0.3,
  gravity: 2.4,
  reach: 0.035,
  size: 0.06,
  armSeconds: 1.5,
  tension: 0.7,
  dim: 0.45,
  blastSeconds: 6,
  ringSeconds: 1.6,
  embers: 180,
  blow: Object.freeze({
    normalX: 0,
    normalY: 1,
    radius: 0.5,
    strength: 12,
    hits: 24,
    falloff: 0.4,
    shatter: Object.freeze({ rays: 24, rings: 8 }),
    spray: 4,
    burst: 1.5,
    contact: 0.05,
    blast: Object.freeze({ reach: 2.5, speed: 6, heft: 0.5 }),
    force: 1,
    shock: Object.freeze({ quake: 0.8, hitStop: 0.32 }),
    cue: 'nuke',
  }),
});

export const BLACKHOLE = Object.freeze({
  growSeconds: 2.5,
  follow: 6,
  horizon: [0.016, 0.052],
  reach: [0.25, 0.6],
  pull: [25, 80],
  swirl: 0.55,
  heft: 0.4,
  feedSeconds: 1 / 15,
  humSeconds: 0.15,
  flareSeconds: 0.5,
  tension: [0.2, 0.7],
  collapse: Object.freeze({
    normalX: 0,
    normalY: 1,
    hits: 8,
    falloff: 0.5,
    shatter: false,
    spray: 2,
    burst: 2.8,
    contact: 0.01,
    cue: 'collapse',
  }),
  collapseRadius: 3,
  collapseStrength: [1.2, 4],
  collapseSpeed: [3, 10],
});

export const FIST = Object.freeze({
  crackSeconds: 1.2,
  size: 0.1,
  blow: Object.freeze({
    normalX: 0,
    normalY: 1,
    radius: 0.08,
    strength: 2,
    hits: 7,
    falloff: 0.5,
    shatter: false,
    spray: 1.6,
    burst: 1.4,
    contact: 0.025,
    blast: Object.freeze({ reach: 0.3, speed: 2.5, heft: 0.35 }),
    force: 0.4,
    cue: 'punch',
  }),
});

export const PENDULUM = Object.freeze({
  radius: 0.075,
  surface: Object.freeze({ density: 1, friction: 0.4, restitution: 0.1 }),
  clearance: 0.03,
  reach: 1.3,
  damping: 0.25,
  settle: 0.12,
  follow: 1.6,
  cooldown: 0.25,
  contact: 1.15,
  strength: [0.8, 4],
  impactSpeed: [0.8, 5],
  tension: 0.25,
  blow: Object.freeze({
    hits: 8,
    falloff: 0.5,
    shatter: false,
    spray: 2,
    burst: 2.2,
    blast: Object.freeze({ reach: 0.25, speed: 3, heft: 0.35 }),
    cue: 'gong',
  }),
});

export const CUTTER = Object.freeze({
  size: 0.09,
  pressSeconds: 0.12,
  holdSeconds: 0.2,
  fadeSeconds: 0.2,
  pop: 1.5,
  sway: 0.4,
  spin: 4,
  crumbs: 0.6,
  shock: Object.freeze({ trauma: 0.35, kick: 0.25, punch: 0.02, flash: 0 }),
});

export const LAVA = Object.freeze({
  rise: 0.08,
  drain: 0.3,
  depth: 0.22,
  swell: 0.02,
  meltSeconds: 1 / 12,
  melt: 0.2,
  gap: 0.003,
  buoyancy: 1.6,
  drag: 2.5,
  heft: 0.5,
  char: 0.02,
  chars: 3,
  churnSeconds: 0.15,
  sizzleSeconds: 0.14,
  tension: 0.3,
  wave: Object.freeze({ height: 0.005, length: 9, speed: 2 }),
  bubbles: Object.freeze({ rate: 10, size: [0.006, 0.016], speed: [0.05, 0.14], popSeconds: 0.25 }),
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
  backlog: 8,
});
