import type { MotionFrame } from '../motion.js';
import type { Color, Group, Object3D } from 'three';
import { smooth } from '../audio.js';

export interface Palette {
  glow: string;
  highlight: string;
  shadow: string;
}

export interface SceneInputs {
  motion: MotionFrame;
  intensity: number;
  palette: Palette;
  dockOpen?: number;
}

export interface BuiltScene {
  object: Group;
  update(inputs: SceneInputs): void;
  dispose?(): void;
}

export interface SceneModule {
  createScene(seed: number): BuiltScene;
}

export type SceneLoader = () => Promise<SceneModule>;

export function randomFor(seed: number) {
  let state = Math.trunc(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const driveCache = new WeakMap<SceneInputs, { inward: number; outward: number; quiet: number }>();

export function energy(inputs: SceneInputs) {
  const { motion: { features, weights, reducedMotion }, intensity } = inputs;
  const range = reducedMotion ? 0.35 : 1;
  let drive = driveCache.get(inputs);
  if (!drive) {
    drive = { inward: 0, outward: 0, quiet: 0 };
    driveCache.set(inputs, drive);
  }
  drive.inward = features.inward * (0.57 + 0.55 * intensity) * range;
  drive.outward = features.outward * (0.35 + 0.77 * intensity) * range;
  drive.quiet = weights.muted * 0.51 + weights.error * 0.67;
  return drive;
}

const paletteTargets = new WeakMap<Color, { value: string; target: Color }>();

export function updateColor(color: Color, value: string, tau = 0.11, dt = 1 / 60) {
  let entry = paletteTargets.get(color);
  if (!entry) {
    entry = { value, target: color.clone().set(value) };
    paletteTargets.set(color, entry);
  } else if (entry.value !== value) {
    entry.value = value;
    entry.target.set(value);
  }
  color.lerp(entry.target, dt ? smooth(0, 1, dt, tau) : 1);
}

export function tilt(object: Object3D, motion: MotionFrame, x = 0, y = 0, z = 0) {
  object.rotation.set(x - motion.y * 0.19, y + motion.x * 0.25, z);
}
