import { Color, Curve, Group, Mesh, MeshPhysicalMaterial, TubeGeometry, Vector3 } from 'three';
import { energy, tilt } from '../runtime.js';
import { aura, feed, uniformsFor } from './shading.js';
import type { BuiltScene } from '../runtime.js';

class SculptureRail extends Curve<Vector3> {
  constructor(private offset: number, private phase: number) { super(); }

  getPoint(u: number, target = new Vector3()) {
    const a = u * Math.PI * 2;
    const x = 2 * a + this.phase;
    const y = 3 * a + this.phase * 0.73;
    const wrap = this.offset * Math.cos(a * 5 + this.phase);
    const depth = this.offset * Math.sin(a * 5 + this.phase);
    const band = 0.79 + 0.39 * Math.cos(y) + wrap;
    return target.set(Math.cos(x) * band, Math.sin(x) * band * 0.95, 0.42 * Math.sin(y) + depth);
  }
}

export function createScene(seed: number): BuiltScene {
  const uniforms = uniformsFor(seed);
  const object = new Group();
  const sculpture = new Group();
  const tones = ['#4b223b', '#8a4672', '#d77d86', '#c67764', '#f2caa7', '#a75d72', '#e2abb2', '#d3a2b4', '#ffdeb5'];
  const foils = tones.map((tone, i) => new MeshPhysicalMaterial({
    color: tone, roughness: 0.30 - (i % 3) * 0.04, metalness: 0.31 + (i % 3) * 0.10,
    clearcoat: 0.71, clearcoatRoughness: 0.23, iridescence: 0.58, iridescenceIOR: 1.5,
    emissive: '#752748', emissiveIntensity: 0.11,
  }));
  const rails = foils.map((material, i) => {
    const offset = (i - 4) * 0.048;
    const path = new SculptureRail(offset, (Math.trunc(seed) % 377) * 0.012);
    return new Mesh(new TubeGeometry(path, 200, i % 3 === 0 ? 0.032 : 0.027, 8, true), material);
  });
  sculpture.add(...rails);
  object.add(aura(uniforms, 4, 3.8, 0.62), sculpture);
  const gold = new Color(), rose = new Color(), soft = new Color(), base = tones.map((tone) => new Color(tone));
  return { object, update(inputs) {
    feed(uniforms, inputs);
    const { motion, palette } = inputs;
    const { inward, outward, quiet } = energy(inputs);
    const t = motion.time;
    gold.set(palette.highlight);
    rose.set(palette.shadow);
    soft.set(palette.glow);
    for (let i = 0; i < rails.length; i++) {
      const wave = Math.sin(t * 6.0 - i * 0.68) * outward;
      const chase = Math.sin(t * 2.3 - i * 0.52) * (motion.weights.thinking + motion.weights.connecting);
      const radius = 1 + wave * 0.091 - inward * (0.10 + i * 0.012) + outward * i * 0.013;
      rails[i].scale.set(radius, radius, 1 + outward * 0.64 - inward * 0.24);
      rails[i].rotation.z = wave * 0.090 + chase * 0.076 + motion.pulse * 0.10 * (i / 8);
      foils[i].color.copy(base[i]).lerp(i % 3 === 0 ? gold : i % 3 === 1 ? rose : soft, 0.51);
      foils[i].emissive.copy(rose);
      foils[i].emissiveIntensity = 0.07 + outward * 0.16 - quiet * 0.06;
    }
    tilt(sculpture, motion, -0.42 + Math.sin(t * 0.73) * 0.21 + motion.weights.interrupted * 0.30,
      0.44 + Math.sin(t * 0.57) * 0.23, 0.2 + t * 0.24);
    sculpture.scale.setScalar(0.91 + Math.sin(t * 1.19) * 0.027 + motion.pulse * 0.053);
  } };
}
