import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, Points, ShaderMaterial } from 'three';
import { DampedSpring } from '../../motion.js';
import { energy, randomFor, tilt } from '../runtime.js';
import { aura, feed, PARAMS, uniformsFor } from './shading.js';
import type { BuiltScene } from '../runtime.js';

const vertex = `${PARAMS}
  attribute vec3 grain;
  attribute float orbit;
  uniform float spread;
  varying float brightness, warmth, orbital;
  void main() {
    vec3 p = position;
    float drift = clock * (0.19 + grain.y * 0.32);
    float radius = length(p);
    float rotation = drift + spread * (1.3 - radius * 0.23) + grain.z * 0.13;
    mat2 spin = mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation));
    p.xz = spin * p.xz;
    vec3 curl = vec3(
      cos(p.y * 2.5 + clock * 1.1) - sin(p.z * 3.1 - clock * 0.72),
      cos(p.z * 3.1 - clock * 0.72) - sin(p.x * 2.7 + clock * 0.83),
      cos(p.x * 2.7 + clock * 0.83) - sin(p.y * 2.5 + clock * 1.1));
    p *= 1.0 - intake * 0.36 + spread * (0.23 + grain.x * 0.30) + pulse * 0.11 + springBack * 0.27;
    p += curl * (0.035 + spread * grain.y * 0.20) * (1.0 - quiet * 0.62);
    p.y *= 1.0 - quiet * 0.25;
    p.y += sin(grain.x * 6.283 + clock * 2.5 + radius * 5.7) * thought * 0.097;
    p *= 1.0 + connect * sin(clock * 2.5 + radius * 5.0) * 0.13;
    vec4 view = modelViewMatrix * vec4(p,1.0);
    float twinkle = 0.65 + 0.35 * sin(clock * (0.7 + grain.z * 4.2) + grain.x * 51.0);
    brightness = (0.18 + grain.y * 0.31 + grain.z * grain.z * 0.18) * twinkle * (1.0 - quiet * 0.55);
    brightness *= 1.28 - 0.22 * radius + release * 0.46 + orbit * (0.21 + listenRim * 0.65);
    warmth = grain.z;
    orbital = orbit;
    gl_PointSize = (0.9 + pow(grain.y, 5.0) * 2.9 + release * 0.65) * (4.85 / -view.z);
    gl_Position = projectionMatrix * view;
  }
`;

const fragment = `${PARAMS}
  varying float brightness, warmth, orbital;
  void main() {
    float r = length(gl_PointCoord * 2.0 - 1.0);
    float jewel = exp(-r * r * 6.5) * (1.0 - smoothstep(0.76, 1.0, r));
    vec3 cold = mix(shade, vec3(0.31,0.28,0.85), 0.44);
    vec3 color = mix(cold, mix(glow, foil, warmth), smoothstep(0.05, 0.94, warmth));
    color = mix(color, vec3(0.58,0.44,0.97) * 0.75 + foil * 0.25, orbital * 0.48);
    gl_FragColor = vec4(color, brightness * jewel);
    #include <colorspace_fragment>
  }
`;

export function createScene(seed: number): BuiltScene {
  const random = randomFor(seed);
  const uniforms = { ...uniformsFor(seed), spread: { value: 0 } };
  const object = new Group();
  const count = 19400;
  const positions = new Float32Array(count * 3), grains = new Float32Array(count * 3), orbits = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const theta = random() * Math.PI * 2;
    const z = random() * 2 - 1;
    const radial = Math.sqrt(1 - z * z);
    if (i < 12500) {
      const radius = 0.86 * random() ** 0.47 + 0.01;
      positions.set([radius * radial * Math.cos(theta), radius * z, radius * radial * Math.sin(theta)], i * 3);
    } else {
      const spread = random() + random() - 1;
      const radius = 1.14 + 0.32 * spread + Math.sin(theta * 2) * 0.075;
      const arm = theta + radius * 1.19 + (i % 2) * Math.PI;
      const band = 0.063 * z + Math.sin(theta * 2) * 0.049 + z * z * z * 0.073;
      positions.set([Math.cos(arm) * radius, band, Math.sin(arm) * radius], i * 3);
      orbits[i] = 1;
    }
    grains.set([random(), random(), random()], i * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('grain', new BufferAttribute(grains, 3));
  geometry.setAttribute('orbit', new BufferAttribute(orbits, 1));
  const particles = new Points(geometry, new ShaderMaterial({
    uniforms, vertexShader: vertex, fragmentShader: fragment, blending: AdditiveBlending, transparent: true, depthWrite: false,
  }));
  particles.frustumCulled = false;
  object.add(aura(uniforms, 4.28, 3.8, 0.61), particles);
  const spread = new DampedSpring();
  return { object, update(inputs) {
    feed(uniforms, inputs);
    const { motion } = inputs;
    const { outward } = energy(inputs);
    const dt = motion.delta * (motion.reducedMotion ? 0.18 : 1);
    uniforms.spread.value = Math.max(0, spread.step(outward * 0.84, dt, 34, 8));
    tilt(particles, motion, 0.73 + Math.sin(motion.time * 0.43) * 0.15, 0.22, -0.34);
  } };
}
