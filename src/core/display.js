import { fidelity } from './fidelity.js';

const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
const COMPACT_LAYOUT = matchMedia('(max-width: 900px)');

export const pixelRatio = () => Math.min(window.devicePixelRatio || 1, fidelity.profile.pixelRatio);

export const prefersReducedMotion = () => REDUCED_MOTION.matches;

export const compactLayout = () => COMPACT_LAYOUT.matches;
