import { ANVIL, ARROWS, AXE, BALL, BLACKHOLE, BOWLING, CANNON, CHARGE, GUN, LASER, LEVITY, METEOR, NUKE, PRESS, RAIL, REPULSOR, ROCKET, SHOTGUN, SHURIKEN, STOMP, TORNADO, TSUNAMI, VOLCANO } from '../config.js';
import { Acid } from './Acid.js';
import { Airstrike } from './Airstrike.js';
import { Anvil } from './Anvil.js';
import { Arrows } from './Arrows.js';
import { Axe } from './Axe.js';
import { BlackHole } from './BlackHole.js';
import { Bomber } from './Bomber.js';
import { Boomerang } from './Boomerang.js';
import { Bowling } from './Bowling.js';
import { Cannon } from './Cannon.js';
import { Cluster } from './Cluster.js';
import { DiscThrower } from './DiscThrower.js';
import { Drill } from './Drill.js';
import { Drone } from './Drone.js';
import { EnergyWave } from './EnergyWave.js';
import { Fireworks } from './Fireworks.js';
import { Fist } from './Fist.js';
import { Freeze } from './Freeze.js';
import { Grab } from './Grab.js';
import { Grenade } from './Grenade.js';
import { Gun } from './Gun.js';
import { Hail } from './Hail.js';
import { Hammer } from './Hammer.js';
import { Jackhammer } from './Jackhammer.js';
import { Katana } from './Katana.js';
import { Laser } from './Laser.js';
import { Levity } from './Levity.js';
import { Lightning } from './Lightning.js';
import { Meteor } from './Meteor.js';
import { Microwave } from './Microwave.js';
import { Minefield } from './Minefield.js';
import { Nuke } from './Nuke.js';
import { Orbital } from './Orbital.js';
import { Pendulum } from './Pendulum.js';
import { Piledriver } from './Piledriver.js';
import { Press } from './Press.js';
import { Quake } from './Quake.js';
import { Railgun } from './Railgun.js';
import { Repulsor } from './Repulsor.js';
import { Rocket } from './Rocket.js';
import { Saw } from './Saw.js';
import { Shuriken } from './Shuriken.js';
import { Sonic } from './Sonic.js';
import { Stomp } from './Stomp.js';
import { Storm } from './Storm.js';
import { Termites } from './Termites.js';
import { Tesla } from './Tesla.js';
import { Tornado } from './Tornado.js';
import { Tsunami } from './Tsunami.js';
import { Volcano } from './Volcano.js';
import { WreckingBall } from './WreckingBall.js';

export const ARSENAL = Object.freeze([
  {
    key: 'hammer',
    label: '망치',
    arm: (session) => new Hammer(session.room, {
      onStrike: (blow) => session.strike(blow),
      onTier: (tier) => session.sound.cue('chime', tier, tier === CHARGE.tiers.length),
    }),
  },
  {
    key: 'bomb',
    label: '폭탄',
    arm: (session) => new Bomber(session.room, session, {
      onStrike: (blow) => session.strike(blow),
      onPlant: () => session.sound.cue('plant'),
      onTick: () => session.sound.cue('tick'),
    }),
  },
  {
    key: 'saw',
    label: '톱날',
    arm: (session) => new Saw(session.room, {
      onGrind: (cut) => session.grind(cut),
      onWhir: () => session.sound.cue('whir'),
    }),
  },
  {
    key: 'katana',
    label: '참격',
    arm: (session) => new Katana(session.room, {
      onSlash: (line) => session.slash(line),
      onSever: (marks) => session.sever(marks),
    }),
  },
  {
    key: 'press',
    label: '프레스',
    arm: (session) => new Press(session.room, {
      onCrush: (stroke) => session.crush(stroke),
      onLand: (x) => session.land(x, PRESS.landShock),
      onHum: () => session.sound.cue('hum'),
    }),
  },
  {
    key: 'ball',
    label: '철구',
    arm: (session) => new WreckingBall(session.room, session.physics, {
      onSear: (heat) => session.sear(heat, BALL),
      onContact: () => session.sound.cue('sear'),
      onSizzle: (cadence) => session.sound.cue('sizzle', cadence),
      onLand: (x) => session.land(x, BALL.landShock),
    }),
  },
  {
    key: 'drill',
    label: '드릴',
    arm: (session) => new Drill(session.room, {
      onBore: (bit) => session.bore(bit),
      onWhine: () => session.sound.cue('whine'),
    }),
  },
  {
    key: 'gun',
    label: '기관총',
    arm: (session) => new Gun(session.room, GUN, {
      onFire: (rounds) => session.pepper(rounds),
    }),
  },
  {
    key: 'laser',
    label: '레이저',
    arm: (session) => new Laser(session.room, session, {
      onSear: (heat) => session.sear(heat, LASER),
      onGlance: (x, y) => session.fallout.smolder(x, y, LASER.glance),
      onHum: (cadence) => session.sound.cue('beam', cadence),
    }),
  },
  {
    key: 'lightning',
    label: '번개',
    arm: (session) => new Lightning(session.room, {
      onStrike: (path, blow) => session.electrocute(path, blow),
    }),
  },
  {
    key: 'meteor',
    label: '운석',
    arm: (session) => new Meteor(session.room, session, {
      onImpact: (blow) => session.incinerate(blow, METEOR.embers),
      onTrail: (x, y) => session.fallout.smolder(x, y, METEOR.smoke),
      onLaunch: () => session.sound.cue('roar'),
    }),
  },
  {
    key: 'rocket',
    label: '로켓',
    arm: (session) => new Rocket(session.room, session, {
      onImpact: (blow) => session.strike(blow),
      onTrail: (x, y) => session.fallout.smolder(x, y, ROCKET.smoke),
      onLaunch: () => session.sound.cue('launch'),
    }),
  },
  {
    key: 'axe',
    label: '도끼',
    arm: (session) => new Axe(session.room, session, {
      onChop: (hit) => session.chop(hit, AXE),
      onLaunch: () => session.sound.cue('throw'),
    }),
  },
  {
    key: 'blackhole',
    label: '블랙홀',
    arm: (session) => new BlackHole(session.room, {
      onFeed: (maw) => session.devour(maw),
      onSweep: (thrust) => session.sweep(thrust, BLACKHOLE.heft),
      onHum: (cadence) => session.sound.cue('void', cadence),
      onCollapse: (blow) => session.strike(blow),
    }),
  },
  {
    key: 'tornado',
    label: '토네이도',
    arm: (session) => new Tornado(session.room, {
      onEngage: () => session.engage(true),
      onSweep: (thrust) => session.sweep(thrust, TORNADO.heft),
      onDust: (x) => session.fallout.puff(x, 0),
      onGale: (cadence) => session.sound.cue('gale', cadence),
    }),
  },
  {
    key: 'quake',
    label: '지진',
    arm: (session) => new Quake(session.room, {
      onEngage: () => session.engage(true),
      onQuake: (power) => session.quake(power),
      onRumble: (cadence) => session.sound.cue('rumble', cadence),
    }),
  },
  {
    key: 'levity',
    label: '중력',
    arm: (session) => new Levity(session.room, {
      onEngage: () => session.engage(true),
      onSweep: (thrust) => session.sweep(thrust, LEVITY.heft, LEVITY.spin),
      onSlam: () => session.slam(LEVITY.slam),
      onHum: (cadence) => session.sound.cue('hover', cadence),
    }),
  },
  {
    key: 'grab',
    label: '염력',
    arm: (session) => new Grab(session.room, {
      onSeize: (x, y) => session.seize(x, y),
      onTug: (anchor, x, y, dt) => session.tug(anchor, x, y, dt),
    }),
  },
  {
    key: 'freeze',
    label: '냉동',
    arm: (session) => new Freeze(session.room, {
      onChill: (frost) => session.chill(frost),
      onBurst: (blow) => session.strike(blow),
      onHiss: (cadence) => session.sound.cue('frost', cadence),
    }),
  },
  {
    key: 'acid',
    label: '산성',
    arm: (session) => new Acid(session.room, session, {
      onEat: (drop) => session.dissolve(drop),
      onSplat: () => session.sound.cue('splat'),
      onHiss: (cadence) => session.sound.cue('sizzle', cadence),
    }),
  },
  {
    key: 'termite',
    label: '흰개미',
    arm: (session) => new Termites(session.room, session, {
      onNibble: (bite) => session.nibble(bite),
      onHatch: () => session.sound.cue('skitter'),
    }),
  },
  {
    key: 'tesla',
    label: '테슬라',
    arm: (session) => new Tesla(session.room, session, {
      onZap: (spark) => session.zap(spark),
      onBuzz: (cadence) => session.sound.cue('buzz', cadence),
    }),
  },
  {
    key: 'orbital',
    label: '궤도포',
    arm: (session) => new Orbital(session.room, {
      onLock: () => session.sound.cue('lock'),
      onFire: (x) => session.beam(x),
      onBurn: (band) => session.vaporize(band),
    }),
  },
  {
    key: 'railgun',
    label: '레일건',
    arm: (session) => new Railgun(session.room, {
      onCharge: () => session.sound.cue('charge'),
      onFire: (line) => session.pierce(line, RAIL),
    }),
  },
  {
    key: 'cannon',
    label: '대포',
    arm: (session) => new Cannon(session.room, session.physics, session, {
      onHit: (blow) => session.strike(blow),
      onLand: (x) => session.land(x, CANNON.landShock),
      onFire: (x, y) => session.muzzle(x, y, 'cannon'),
    }),
  },
  {
    key: 'anvil',
    label: '모루',
    arm: (session) => new Anvil(session.room, session.physics, session, {
      onHit: (blow) => session.strike(blow),
      onLand: (x) => session.land(x, ANVIL.landShock),
      onDrop: () => session.sound.cue('whistle'),
    }),
  },
  {
    key: 'shotgun',
    label: '산탄총',
    arm: (session) => new Gun(session.room, SHOTGUN, {
      onFire: (rounds) => session.pepper(rounds),
    }),
  },
  {
    key: 'jackhammer',
    label: '착암기',
    arm: (session) => new Jackhammer(session.room, {
      onPound: (rounds) => session.pepper(rounds),
    }),
  },
  {
    key: 'boomerang',
    label: '부메랑',
    arm: (session) => new Boomerang(session.room, {
      onSlice: (line, first) => session.slice(line, first),
      onThrow: () => session.sound.cue('throw'),
    }),
  },
  {
    key: 'arrows',
    label: '화살비',
    arm: (session) => new Arrows(session.room, session, {
      onChop: (hit) => session.chop(hit, ARROWS),
      onLaunch: () => session.sound.cue('volley'),
    }),
  },
  {
    key: 'fireworks',
    label: '폭죽',
    arm: (session) => new Fireworks(session.room, session, {
      onBurst: (blow) => session.strike(blow),
      onEmber: (rounds) => session.pepper(rounds),
      onLaunch: () => session.sound.cue('whizz'),
    }),
  },
  {
    key: 'tsunami',
    label: '해일',
    arm: (session) => new Tsunami(session.room, {
      onEngage: () => session.engage(true),
      onSweep: (thrust) => session.sweep(thrust, TSUNAMI.heft),
      onBatter: (front) => session.batter(front),
      onSplash: (x, y) => session.fallout.splash(x, y, TSUNAMI.splash),
      onSurf: (cadence) => session.sound.cue('surf', cadence),
      onCrash: () => session.sound.cue('crash'),
    }),
  },
  {
    key: 'sonic',
    label: '초음파',
    arm: (session) => new Sonic(session.room, {
      onPulse: (wave) => session.resonate(wave),
      onTone: (cadence) => session.sound.cue('sonic', cadence),
    }),
  },
  {
    key: 'cluster',
    label: '집속탄',
    arm: (session) => new Cluster(session.room, session, {
      onImpact: (blow) => session.strike(blow),
      onOpen: () => session.sound.cue('pop'),
      onLaunch: () => session.sound.cue('whistle'),
    }),
  },
  {
    key: 'microwave',
    label: '전자파',
    arm: (session) => new Microwave(session.room, {
      onPulse: (dose) => session.irradiate(dose),
      onHum: (cadence) => session.sound.cue('micro', cadence),
    }),
  },
  {
    key: 'hail',
    label: '우박',
    arm: (session) => new Hail(session.room, session, {
      onHit: (rounds) => session.pepper(rounds),
    }),
  },
  {
    key: 'fist',
    label: '주먹',
    arm: (session) => new Fist(session.room, {
      onPunch: (blow, direction) => session.punch(blow, direction),
      onSwing: () => session.sound.cue('swing'),
    }),
  },
  {
    key: 'pendulum',
    label: '진자',
    arm: (session) => new Pendulum(session.room, session.physics, session, {
      onHit: (blow) => session.strike(blow),
      onGrab: () => session.sound.cue('creak'),
    }),
  },
  {
    key: 'bowling',
    label: '볼링',
    arm: (session) => new Bowling(session.room, session.physics, session, {
      onHit: (blow) => session.strike(blow),
      onLand: (x) => session.land(x, BOWLING.landShock),
      onRoll: () => session.sound.cue('roll'),
    }),
  },
  {
    key: 'piledriver',
    label: '항타기',
    arm: (session) => new Piledriver(session.room, session, {
      onPound: (blow) => session.strike(blow),
    }),
  },
  {
    key: 'stomp',
    label: '발',
    arm: (session) => new Stomp(session.room, session, {
      onStomp: (blow) => session.trample(blow, STOMP.landShock),
    }),
  },
  {
    key: 'mine',
    label: '지뢰',
    arm: (session) => new Minefield(session.room, session, {
      onPlant: () => session.sound.cue('plant'),
      onBlast: (blow) => session.strike(blow),
    }),
  },
  {
    key: 'disc',
    label: '원반톱',
    arm: (session) => new DiscThrower(session.room, {
      onGrind: (cut) => Boolean(session.grind(cut)),
      onThrow: () => session.sound.cue('throw'),
    }),
  },
  {
    key: 'storm',
    label: '뇌우',
    arm: (session) => new Storm(session.room, {
      onStrike: (path, blow) => session.electrocute(path, blow),
    }),
  },
  {
    key: 'volcano',
    label: '화산',
    arm: (session) => new Volcano(session.room, session, {
      onImpact: (blow) => session.incinerate(blow, VOLCANO.embers),
      onSmoke: (x, y) => session.fallout.smolder(x, y, VOLCANO.smoke),
      onErupt: () => session.sound.cue('eruption'),
    }),
  },
  {
    key: 'shuriken',
    label: '수리검',
    arm: (session) => new Shuriken(session.room, session, {
      onChop: (hit) => session.chop(hit, SHURIKEN),
      onLaunch: () => session.sound.cue('shing'),
    }),
  },
  {
    key: 'repulsor',
    label: '척력',
    arm: (session) => new Repulsor(session.room, {
      onSweep: (thrust) => session.sweep(thrust, REPULSOR.heft),
      onHum: (cadence) => session.sound.cue('shield', cadence),
      onRelease: (blow) => session.strike(blow),
    }),
  },
  {
    key: 'airstrike',
    label: '폭격',
    arm: (session) => new Airstrike(session.room, session, {
      onImpact: (blow) => session.strike(blow),
      onLaunch: () => session.sound.cue('flyover'),
    }),
  },
  {
    key: 'grenade',
    label: '수류탄',
    arm: (session) => new Grenade(session.room, session.physics, session, {
      onBlast: (blow) => session.strike(blow),
      onBounce: () => session.sound.cue('clink'),
      onThrow: () => session.sound.cue('pin'),
    }),
  },
  {
    key: 'drone',
    label: '드론',
    arm: (session) => new Drone(session.room, session, {
      onBlast: (blow) => session.strike(blow),
      onRotor: (cadence) => session.sound.cue('rotor', cadence),
      onDive: () => session.sound.cue('dive'),
    }),
  },
  {
    key: 'wave',
    label: '에너지파',
    arm: (session) => new EnergyWave(session.room, {
      onFire: (line, beam) => session.pierce(line, beam),
      onGather: (cadence) => session.sound.cue('gather', cadence),
    }),
  },
  {
    key: 'nuke',
    label: '핵',
    arm: (session) => new Nuke(session.room, session, {
      onImpact: (blow) => session.incinerate(blow, NUKE.embers),
      onLaunch: () => session.sound.cue('whistle'),
    }),
  },
]);
