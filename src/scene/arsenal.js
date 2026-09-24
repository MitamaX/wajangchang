import { CHARGE } from '../config.js';
import { Bomber } from './Bomber.js';
import { Hammer } from './Hammer.js';
import { Katana } from './Katana.js';
import { Press } from './Press.js';
import { Saw } from './Saw.js';
import { WreckingBall } from './WreckingBall.js';

export const ARSENAL = Object.freeze([
  {
    key: 'hammer',
    label: '망치',
    arm: (session) => new Hammer(session.room, {
      onStrike: (blow) => session.strike(blow),
      onTier: (tier) => session.sound.chime(tier, tier === CHARGE.tiers.length),
    }),
  },
  {
    key: 'bomb',
    label: '폭탄',
    arm: (session) => new Bomber(session.room, session, {
      onStrike: (blow) => session.strike(blow),
      onPlant: () => session.sound.plant(),
      onTick: () => session.sound.tick(),
    }),
  },
  {
    key: 'saw',
    label: '톱날',
    arm: (session) => new Saw(session.room, {
      onGrind: (cut) => session.grind(cut),
      onWhir: () => session.sound.whir(),
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
      onLand: (x) => session.land(x),
      onHum: () => session.sound.hum(),
    }),
  },
  {
    key: 'ball',
    label: '철구',
    arm: (session) => new WreckingBall(session.room, session, {
      onSmash: (blow) => session.strike(blow),
    }),
  },
]);
