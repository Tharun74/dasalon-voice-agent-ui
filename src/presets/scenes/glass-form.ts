import type { MotionFrame } from '../../motion.js';

export function lensStretch(motion: MotionFrame) {
  return 1 - motion.features.inward * .22 + motion.features.outward * .18 + motion.features.recoil * .24 + motion.breath * .023;
}
export function lensHeight(motion: MotionFrame) {
  return 1 - motion.features.inward * .15 + motion.features.outward * .12 + motion.features.recoil * .12;
}
export function lensPitch(motion: MotionFrame) {
  return motion.x * -.035 + Math.sin(motion.phase * .84) * (.028 + motion.features.outward * .039);
}
