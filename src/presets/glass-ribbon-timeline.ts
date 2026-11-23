import { REFERENCE_CURVE } from './glass-ribbon-envelope.js';
import type { MotionFrame } from '../motion.js';
import type { ThemeName } from '../theme.js';

export type GlassRibbonDriver = 'replay' | 'synthetic' | 'live';
export type GlassRibbonBackdrop = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

export const REFERENCE_FPS = 14671 / 500;
export const REFERENCE_LAST = 261;
export const VISUAL_DURATION = (REFERENCE_LAST - 1) / REFERENCE_FPS;
export const ENTRY_DONE = 2;
export const LENS_DETAILS = { diameter:75, horizon:.53, emerge:.54, round:.95, flare:1.26, color:1.57 } as const;
type Ink = readonly [number, number, number];
type Spectrum = readonly [Ink, Ink, Ink, Ink, Ink];

const SPECTRA: Record<ThemeName, Spectrum> = {
  'rose-gold': [[1,.10,.25],[1,.71,.15],[.10,1,.56],[.08,.57,1],[.69,.19,1]],
  champagne: [[1,.26,.12],[1,.89,.33],[.41,.95,.51],[.23,.67,1],[.93,.37,.79]],
  'midnight-noir': [[1,.15,.45],[.94,.57,.29],[.15,.91,.79],[.14,.42,1],[.49,.20,1]],
  'emerald-spa': [[1,.33,.30],[.94,.83,.28],[.16,1,.64],[.07,.75,1],[.54,.26,.96]],
  'blush-pastel': [[1,.37,.55],[1,.86,.40],[.56,1,.70],[.37,.67,1],[.80,.39,1]],
};

export interface RibbonPose {
  cx: number; cy: number; rx: number; ry: number;
  amount: number; neck: number; dark: number; flare: number; ramp: number;
  energy: number; span: number; lift: number; heat: number;
  phase: number; tint: number; rim: number; quiet: number;
  pitch: number; breath: number; pointerX: number; pointerY: number;
}

export interface RibbonStage {
  pose: RibbonPose;
  width: number;
  height: number;
  originX?: number;
  originY?: number;
  diameter?: number;
  backdrop?: GlassRibbonBackdrop;
  spectrum: Spectrum;
  full: boolean;
}

export function glassSpectrum(theme: ThemeName = 'rose-gold') { return SPECTRA[theme]; }
export function frameTime(frame: number) { return (frame - 1) / REFERENCE_FPS; }

export function createRibbonPose(): RibbonPose {
  return { cx: 0, cy: 0, rx: 1, ry: 1, amount: 0, neck: 0, dark: 0, flare: 0, ramp: 0,
    energy: 0, span: .43, lift: .023, heat: 0, phase: 0, tint: 0, rim: 0, quiet: 0,
    pitch: 0, breath: 0, pointerX: 0, pointerY: 0 };
}

const limit = (value: number) => Math.min(1, Math.max(0, value));
const blend = (start: number, end: number, weight: number) => start + (end - start) * weight;
function ease(start: number, end: number, time: number) {
  const n = limit((time - start) / (end - start));
  return n * n * (3 - 2 * n);
}

export const RIBBON_PROFILE = {
  horizon: +(2 * LENS_DETAILS.horizon - 1).toFixed(4),
  narrow: .22, wide: .91, foot: .026, lift: .42, curve: 1.08, top: .97, bottom: .57,
} as const;

type MaskPose = Pick<RibbonPose, 'span' | 'lift' | 'ramp'>;

export function ribbonHalfWidth(span: number) {
  return blend(RIBBON_PROFILE.narrow, RIBBON_PROFILE.wide, limit(span));
}

export function ribbonBump(x: number) {
  return Math.max(0, 1 - x * x) ** RIBBON_PROFILE.curve;
}

export function ribbonMaskAlpha(x: number, y: number, pose: MaskPose, soft = .012) {
  const bump = ribbonBump(x / ribbonHalfWidth(pose.span));
  const height = (RIBBON_PROFILE.foot + pose.lift * RIBBON_PROFILE.lift) * pose.ramp * bump;
  const at = y - RIBBON_PROFILE.horizon;
  return bump * ease(-soft, soft, at + height * RIBBON_PROFILE.top)
    * (1 - ease(-soft, soft, at - height * RIBBON_PROFILE.bottom));
}

export const ribbonMaskShader = `
  const float apertureHorizon = ${RIBBON_PROFILE.horizon};
  float ribbonReach(float span) { return mix(${RIBBON_PROFILE.narrow},${RIBBON_PROFILE.wide},clamp(span,0.0,1.0)); }
  float ribbonBump(float x) { return pow(clamp(1.0-x*x,0.0,1.0),${RIBBON_PROFILE.curve}); }
  float ribbonCoverage(float bump,float y,float lift,float ramp,float soft) {
    float h=(${RIBBON_PROFILE.foot}+lift*${RIBBON_PROFILE.lift})*ramp*bump;
    return bump*smoothstep(-soft,soft,y+h*${RIBBON_PROFILE.top})
      *(1.0-smoothstep(-soft,soft,y-h*${RIBBON_PROFILE.bottom}));
  }
`;

export function replayEnvelope(pose: RibbonPose, time: number) {
  const frame = 1 + time * REFERENCE_FPS;
  const sample = Math.min(239, Math.max(40, frame));
  const base = Math.min(238, Math.floor(sample));
  const offset = (base - 40) * 4;
  const part = sample - base;
  const start = ease(39, 40, frame);
  const tail = 1 - ease(239, 255, frame);
  pose.energy = blend(REFERENCE_CURVE[offset], REFERENCE_CURVE[offset + 4], part) * start * tail;
  pose.heat = blend(REFERENCE_CURVE[offset + 1], REFERENCE_CURVE[offset + 5], part) * start * tail;
  pose.span = blend(.43, blend(REFERENCE_CURVE[offset + 2], REFERENCE_CURVE[offset + 6], part), start * tail);
  pose.lift = blend(.023, blend(REFERENCE_CURVE[offset + 3], REFERENCE_CURVE[offset + 7], part), start * tail);
}

const accents = [.62, .37, .82, .58, .91, .70, .29, .66, .79, .53, .86, .48];
const times = [0, .53, 1.07, 1.66, 2.18, 2.81, 3.38, 3.99, 4.5, 5.11, 5.67, 6.21];
const period = 6.84;

function syntheticEnvelope(pose: RibbonPose, time: number, amplitude: number) {
  const clock = (time + .24) % period;
  let sum = 0;
  for (let i = 0; i < times.length; i++) {
    let dt = clock - times[i];
    if (dt > period / 2) dt -= period;
    if (dt < -period / 2) dt += period;
    const width = dt < 0 ? .093 : .151 + accents[i] * .047;
    sum += accents[i] * Math.exp(-.8 * (dt / width) ** 2);
  }
  pose.energy = limit(sum * (.73 + amplitude * .25));
  pose.heat = limit(pose.energy ** 2 * 1.09);
  pose.span = .43 + pose.energy * .53;
  pose.lift = .035 + pose.energy * .77;
}

export function updateRibbon(stage: RibbonStage, entryTime: number, colorTime: number, driver: GlassRibbonDriver,
  motion: MotionFrame | undefined, intensity: number, reduced: boolean, seed: number) {
  const { pose, width, height } = stage;
  const f = LENS_DETAILS;
  const d = stage.diameter ?? Math.min(width * .56, height * .72);
  const arrival = ease(f.emerge, f.round, entryTime);
  const overshoot = (1 - arrival) * Math.sin(arrival * Math.PI * 1.65) * .21;
  const restX = stage.originX ?? width * .5;
  const restY = stage.originY ?? height * .57;
  const pointerX = motion?.x ?? 0, pointerY = motion?.y ?? 0;
  pose.pointerX = reduced ? 0 : pointerX;
  pose.pointerY = reduced ? 0 : pointerY;
  pose.cx = restX + pose.pointerX * d * .032;
  pose.cy = reduced ? restY : blend(-d * .24, restY, arrival) + d * overshoot + pose.pointerY * d * .018;
  pose.rx = d * .5 * (reduced ? 1 : blend(.33,1,arrival) + overshoot * .32);
  pose.ry = d * .5  * (reduced ? 1 : blend(.56,1,arrival) + overshoot * .65);
  pose.amount = reduced ? 1 : ease(f.emerge, f.emerge + .063, entryTime);
  pose.neck = reduced ? 0 : Math.sin(Math.PI * arrival) * (1 - arrival) * pose.amount;
  pose.dark = reduced ? 1 : ease(f.round - .02, f.round + .27, entryTime);
  pose.flare = reduced ? .69 : ease(f.flare, f.flare + .24, entryTime);
  pose.ramp = reduced ? 1 : ease(f.color, f.color + .30, entryTime);
  pose.breath = reduced ? 0 : Math.sin(colorTime * 1.32);
  pose.rim = motion?.features.rim ?? 0;
  pose.quiet = motion ? motion.weights.muted * .44 + motion.weights.error * .60 : 0;
  pose.pitch = reduced ? 0 : pose.pointerX * .07 + Math.sin(colorTime * 1.01) * .017;
  pose.phase = colorTime * 6.2 + (seed - 42) * .039;
  pose.tint = motion ? motion.features.sheen * 2.8 : 0;

  if (reduced) {
    pose.energy = .44; pose.span = .60; pose.lift = .32; pose.heat = .12; pose.phase = 1.8;
  } else if (driver === 'replay') replayEnvelope(pose, colorTime);
  else if (driver === 'synthetic') syntheticEnvelope(pose, colorTime, motion?.audio.output.rms ?? .50);
  else {
    const speaking = (motion?.features.outward ?? 0) * intensity;
    const listening = (motion?.features.inward ?? 0) * intensity;
    const thought = motion?.weights.thinking ?? 0;
    const connecting = motion?.weights.connecting ?? 0;
    const recoil = Math.max(0, -(motion?.features.recoil ?? 0));
    const press = motion?.pulse ?? 0;
    pose.rim += connecting * (.17 + .065 * pose.breath);
    pose.energy = limit(speaking * 1.28 + thought * (.13 + .05 * pose.breath) + recoil * .28 + press * .13);
    pose.span = Math.max(.20, .43 + .016 * pose.breath + pose.energy * .49 - listening * .18 + connecting * .09);
    pose.lift = Math.max(.017, .035 + pose.energy * .69 - listening * .06);
    pose.heat = limit(pose.energy * .42 + (motion?.features.accent ?? 0) * .69 + listening * .08);
    pose.phase = (motion?.phase ?? colorTime * .67) * 7.9 + (seed - 42) * .039;
  }
  pose.lift = Math.max(.022, pose.lift);
  pose.span = Math.max(.24, pose.span);
}
