const MAX_PIXEL_RATIO = 2;
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
const COMPACT_LAYOUT = matchMedia('(max-width: 900px)');

export const pixelRatio = () => Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

export const prefersReducedMotion = () => REDUCED_MOTION.matches;

export const compactLayout = () => COMPACT_LAYOUT.matches;
