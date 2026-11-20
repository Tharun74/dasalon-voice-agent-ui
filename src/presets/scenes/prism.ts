import { Color, Group, InstancedMesh, LatheGeometry, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, TorusGeometry, Vector2 } from 'three';
import { energy, randomFor, tilt, updateColor } from '../runtime.js';
import { aura, feed, uniformsFor } from './shading.js';
import { sparks } from './sparks.js';
import type { BuiltScene } from '../runtime.js';

export function createScene(seed: number): BuiltScene {
  const random = randomFor(seed);
  const uniforms = uniformsFor(seed);
  const object = new Group();
  const halo = new Group();
  const geometry = new LatheGeometry([
    new Vector2(0, -0.47), new Vector2(0.080, -0.32), new Vector2(0.12, -0.16),
    new Vector2(0.084, 0.12), new Vector2(0.0, 0.48),
  ], 5);
  geometry.computeVertexNormals();
  const crystal = new MeshPhysicalMaterial({
    color: '#e9c9e8', roughness: 0.22, metalness: 0.24, iridescence: 0.82, iridescenceIOR: 1.7,
    clearcoat: 0.83, clearcoatRoughness: 0.12, flatShading: true, emissive: '#7751de', emissiveIntensity: 0.19,
  });
  const backing = new MeshStandardMaterial({ color: '#4c457e', metalness: 0.50, roughness: 0.23, emissive: '#5d3fa8', emissiveIntensity: 0.20 });
  const count = 48;
  const shards = new InstancedMesh(geometry, crystal, count);
  shards.frustumCulled = false;
  const shadow = new Color('#6b6eeb'), blush = new Color('#f7acc1'), clear = new Color('#e8e5ff');
  const lengths = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    lengths[i] = 0.27 + random() * 0.42 + (i % 6 === 0 ? 0.30 : 0);
    shards.setColorAt(i, shadow.clone().lerp(i % 4 === 0 ? blush : clear, 0.25 + random() * 0.67));
  }
  const rail = new Mesh(new TorusGeometry(0.93, 0.022, 8, 96), backing);
  const lip = new Mesh(new TorusGeometry(0.844, 0.016, 8, 96), backing);
  lip.position.z = -0.077;
  halo.add(shards, rail, lip);
  object.add(aura(uniforms, 3.85, 3.2, 0.71), halo, sparks(uniforms, seed + 15, 67, 1.13));
  const holder = new Object3D();
  return { object, update(inputs) {
    feed(uniforms, inputs);
    const { motion, palette } = inputs;
    const { inward, outward, quiet } = energy(inputs);
    const t = motion.time;
    const spectrum = motion.audio.output.spectrum;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count;
      const current = 0.5 + 0.5 * Math.sin(angle * 2 - t * 3.8);
      const sequencing = Math.pow(0.5 + 0.5 * Math.cos(angle - t * 2.8), 7);
      const voice = spectrum[i] * outward;
      const radius = 0.94 + outward * 0.25 - inward * 0.22 + motion.features.recoil * .24 + motion.pulse * 0.12;
      holder.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sin(angle * 4) * 0.09 + current * outward * 0.20);
      holder.rotation.set(inward * 0.65 + current * (0.30 + outward * 0.55), angle * 2 + t * 0.23, angle - Math.PI / 2);
      holder.scale.set(0.54, Math.max(0.19, lengths[i] - inward * 0.20 + outward * 0.30 + voice * 0.73
        + sequencing * (motion.weights.thinking + motion.weights.connecting) * 0.23 - quiet * 0.23
        + motion.features.recoil * .25), 0.61);
      holder.updateMatrix();
      shards.setMatrixAt(i, holder.matrix);
    }
    shards.instanceMatrix.needsUpdate = true;
    crystal.emissiveIntensity = 0.16 + outward * 0.61 - quiet * 0.17;
    backing.emissiveIntensity = .20 + uniforms.listenRim.value * .55;
    updateColor(crystal.color, palette.highlight, 0.11, motion.delta);
    updateColor(crystal.emissive, palette.shadow, 0.12, motion.delta);
    tilt(halo, motion, -0.68 + Math.sin(t * 0.77) * 0.11, 0.26 + Math.sin(t * 0.41) * 0.13, t * 0.14);
  } };
}
