import { BALL, BLACKHOLE, CHARGE, LAVA, NUKE, PRESS } from '../config.js';
import { TEXT } from '../i18n/text.js';
import { BlackHole } from './BlackHole.js';
import { Bomber } from './Bomber.js';
import { Cutter } from './Cutter.js';
import { Fist } from './Fist.js';
import { Gun } from './Gun.js';
import { Hammer } from './Hammer.js';
import { Katana } from './Katana.js';
import { Lava } from './Lava.js';
import { Lightning } from './Lightning.js';
import { Nuke } from './Nuke.js';
import { Pendulum } from './Pendulum.js';
import { Press } from './Press.js';
import { Saw } from './Saw.js';
import { WreckingBall } from './WreckingBall.js';

export const ARSENAL = Object.freeze([
  {
    key: 'hammer',
    label: TEXT.tools.hammer,
    arm: (session) => new Hammer(session.room, {
      onStrike: (blow) => session.strike(blow),
      onTier: (tier) => session.sound.cue('chime', tier, tier === CHARGE.tiers.length),
    }),
  },
  {
    key: 'fist',
    label: TEXT.tools.fist,
    arm: (session) => new Fist(session.room, {
      onPunch: (blow) => session.strike(blow),
    }),
  },
  {
    key: 'cutter',
    label: TEXT.tools.cutter,
    arm: (session) => new Cutter(session.room, {
      onStamp: (outline) => session.stamp(outline),
    }),
  },
  {
    key: 'saw',
    label: TEXT.tools.saw,
    arm: (session) => new Saw(session.room, {
      onGrind: (cut) => session.grind(cut),
      onWhir: () => session.sound.cue('whir'),
    }),
  },
  {
    key: 'pendulum',
    label: TEXT.tools.pendulum,
    arm: (session) => new Pendulum(session.room, session.physics, session, {
      onHit: (blow) => session.strike(blow),
      onGrab: () => session.sound.cue('latch'),
      onPass: (rush, beat) => session.sound.cue('pass', rush, beat),
    }),
  },
  {
    key: 'ball',
    label: TEXT.tools.ball,
    arm: (session) => new WreckingBall(session.room, session.physics, {
      onSear: (heat) => session.sear(heat),
      onContact: () => session.sound.cue('sear'),
      onSizzle: (cadence) => session.sound.cue('sizzle', cadence),
      onLand: (x) => session.land(x, BALL.landShock),
    }),
  },
  {
    key: 'press',
    label: TEXT.tools.press,
    arm: (session) => new Press(session.room, {
      onCrush: (stroke) => session.crush(stroke),
      onLand: (x) => session.land(x, PRESS.landShock),
      onHum: () => session.sound.cue('hum'),
    }),
  },
  {
    key: 'gun',
    label: TEXT.tools.gun,
    arm: (session) => new Gun(session.room, {
      onFire: (round) => session.pepper(round),
      onMotor: (cadence) => session.sound.cue('motor', cadence),
      onSpinDown: () => session.sound.cue('spindown'),
    }),
  },
  {
    key: 'bomb',
    label: TEXT.tools.bomb,
    arm: (session) => new Bomber(session.room, session, {
      onStrike: (blow) => session.strike(blow),
      onPlant: () => session.sound.cue('plant'),
      onTick: () => session.sound.cue('tick'),
    }),
  },
  {
    key: 'katana',
    label: TEXT.tools.katana,
    arm: (session) => new Katana(session.room, {
      onSlash: (line) => session.slash(line),
      onSever: (marks) => session.sever(marks),
    }),
  },
  {
    key: 'lightning',
    label: TEXT.tools.lightning,
    arm: (session) => new Lightning(session.room, {
      onStrike: (path, blow) => session.electrocute(path, blow),
      onCharge: () => session.sound.cue('static'),
    }),
  },
  {
    key: 'lava',
    label: TEXT.tools.lava,
    arm: (session) => new Lava(session.room, {
      onEngage: () => session.engage(),
      onSweep: (thrust) => session.sweep(thrust, LAVA.heft),
      onMelt: (surface) => session.immerse(surface),
      onChurn: (cadence) => session.sound.cue('lava', cadence),
      onSizzle: (cadence) => session.sound.cue('sizzle', cadence),
      onBlub: () => session.sound.cue('blub'),
    }),
  },
  {
    key: 'blackhole',
    label: TEXT.tools.blackhole,
    arm: (session) => new BlackHole(session.room, {
      onFeed: (maw) => session.devour(maw),
      onSweep: (thrust) => session.sweep(thrust, BLACKHOLE.heft),
      onHum: (cadence, size) => session.sound.cue('void', cadence, size),
      onCollapse: (blow) => session.strike(blow),
    }),
  },
  {
    key: 'nuke',
    label: TEXT.tools.nuke,
    arm: (session) => new Nuke(session.room, session, {
      onImpact: (blow) => session.incinerate(blow, NUKE.embers),
      onArm: () => session.sound.cue('alarm'),
      onLaunch: () => session.sound.cue('descent'),
    }),
  },
]);
