import { CircleGeometry, Color, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, ShaderMaterial, SphereGeometry, TorusGeometry } from 'three';
import { smooth } from '../../audio.js';
import { energy, tilt, updateColor } from '../runtime.js';
import { aura, feed, PARAMS, uniformsFor } from './shading.js';
import { sparks } from './sparks.js';
import type { BuiltScene } from '../runtime.js';

const glass = `${PARAMS}
  varying vec2 coord;
  float stripe(float value, float width) { return exp(-value * value / width); }
  void main() {
    vec2 p = coord * 2.0 - 1.0;
    float radius = length(p);
    vec2 focus = p - pointer * vec2(0.14, -0.14);
    float distanceFromVoice = length(focus);
    float ripple = sin(distanceFromVoice * 31.5 - clock * 8.0) * release
      + sin(distanceFromVoice * 24.0 + clock * 5.9) * intake * 0.8;
    float touch = sin(distanceFromVoice * 28.0 - clock * 7.2) * pulse;
    vec2 reflection = p + vec2(0.06 * sin(clock * 0.63), 0.04 * cos(clock * 0.52))
      + pointer * vec2(0.15, -0.18) + normalize(focus + vec2(0.0001)) * (ripple + touch) * 0.073;
    vec2 arch = vec2((reflection.x + 0.39) * 2.2, (reflection.y + 0.14) * 1.65);
    float vault = abs(length(vec2(arch.x, max(0.0, arch.y))) - 0.88);
    float window = (stripe(vault, 0.019) * 0.71 + stripe(vault, 0.0014) * 0.29) * smoothstep(-1.13, -0.84, arch.y);
    float rail = stripe(arch.x + 0.63 + reflection.y * 0.15, 0.011);
    float side = stripe(reflection.x - reflection.y * 0.35 - 0.39, 0.17) * 0.3;
    float plate = 1.0 - smoothstep(0.12, 0.92, length(reflection + vec2(-0.15, 0.15)));
    float edge = smoothstep(0.74, 1.0, radius);
    vec3 surface = mix(vec3(0.054,0.041,0.078) + shade * 0.083, glow * 0.65 + vec3(0.18,0.19,0.25), plate * 0.72);
    surface += foil * (window * 0.44 + rail * 0.22 + side) * (0.81 - quiet * 0.53);
    surface += mix(glow, foil, 0.44) * (ripple + touch) * 0.13;
    float twirl = pow(max(0.0, cos(atan(p.y,p.x) - clock * 2.45)), 20.0);
    surface += foil * edge * (0.18 + listenRim * 0.16 + twirl * (thought + connect) * 0.53);
    surface *= 1.0 - quiet * 0.54;
    gl_FragColor = vec4(surface, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createScene(seed: number): BuiltScene {
  const uniforms = uniformsFor(seed);
  const object = new Group();
  const mirror = new Group();
  const gold = new MeshStandardMaterial({ color: '#c38c56', metalness: 0.47, roughness: 0.27, emissive: '#240f0d', emissiveIntensity: 0.20 });
  const dark = new MeshStandardMaterial({ color: '#5b3147', metalness: 0.49, roughness: 0.28 });
  const beads = new MeshStandardMaterial({ color: '#efc193', metalness: 0.35, roughness: 0.23 });
  const reflection = new Mesh(new CircleGeometry(0.899, 92), new ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 coord; void main() { coord = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: glass,
  }));
  reflection.position.z = 0.07;
  const back = new Mesh(new CircleGeometry(1.04, 92), dark);
  back.position.z = -0.072;
  mirror.add(back, reflection);
  for (const [radius, tube, depth, material] of [[0.898, 0.043, 0.08, gold], [0.959, 0.044, 0.044, dark], [1.018, 0.031, 0.035, gold], [1.05, 0.014, 0.024, beads]] as const) {
    const lip = new Mesh(new TorusGeometry(radius, tube, 10, 112), material);
    lip.position.z = depth;
    mirror.add(lip);
  }

  const filigree = new InstancedMesh(new SphereGeometry(1, 8, 6), beads, 88);
  const guide = new Object3D();
  let slot = 0;
  for (let i = 0; i < 56; i++) {
    const a = i * Math.PI * 2 / 56;
    guide.position.set(Math.cos(a) * 0.968, Math.sin(a) * 0.968, 0.085);
    guide.scale.setScalar(i % 4 === 0 ? 0.032 : 0.020);
    guide.rotation.z = a;
    guide.updateMatrix();
    filigree.setMatrixAt(slot++, guide.matrix);
  }
  for (let corner = 0; corner < 4; corner++) {
    const a = Math.PI * (corner * 0.5 + 0.25);
    for (let lobe = 0; lobe < 8; lobe++) {
      const b = lobe * Math.PI / 4;
      guide.position.set(Math.cos(a) * 1.034 + Math.cos(b) * 0.086, Math.sin(a) * 1.034 + Math.sin(b) * 0.086, 0.075);
      guide.scale.set(0.055, 0.029, 0.022);
      guide.rotation.z = b;
      guide.updateMatrix();
      filigree.setMatrixAt(slot++, guide.matrix);
    }
  }
  mirror.add(filigree, sparks(uniforms, seed + 71, 52, 0.99));
  object.add(aura(uniforms, 3.5, 3.4, 0.59), mirror);
  const warmth = new Color(), brass = new Color('#c89b56');
  return { object, update(inputs) {
    feed(uniforms, inputs);
    const { motion, palette } = inputs;
    const { inward, outward, quiet } = energy(inputs);
    mirror.scale.setScalar(1 - inward * .16 + outward * .12 + motion.features.recoil * .23);
    tilt(mirror, motion, 0.12 + Math.sin(motion.time * 0.48) * 0.11, -0.22 - motion.features.recoil * .56, -0.09);
    warmth.set(palette.glow).lerp(brass, 0.58);
    gold.color.lerp(warmth, motion.delta ? smooth(0, 1, motion.delta, 0.16) : 1);
    gold.emissiveIntensity = 0.25 + outward * 0.65 + uniforms.listenRim.value * .48 - quiet * 0.22;
    updateColor(dark.color, palette.shadow, 0.09, motion.delta);
  } };
}
