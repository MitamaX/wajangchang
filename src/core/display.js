const MAX_PIXEL_RATIO = 2;
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');

export const pixelRatio = () => Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

export const prefersReducedMotion = () => REDUCED_MOTION.matches;
