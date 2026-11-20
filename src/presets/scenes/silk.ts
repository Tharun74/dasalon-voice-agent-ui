import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { randomFor, tilt } from '../runtime.js';
import { aura, feed, PARAMS, uniformsFor } from './shading.js';
import type { BuiltScene } from '../runtime.js';

function ribbons(seed: number) {
  const random = randomFor(seed);
  const strands = 198;
  const sections = 40;
  const configuration = new Float32Array(strands * (sections + 1) * 2 * 3);
  const offsets = new Float32Array(strands * (sections + 1) * 2);
  const faces = new Uint16Array(strands * sections * 6);
  let face = 0;
  for (let strand = 0; strand < strands; strand++) {
    const thickness = 0.56 + random() * 0.74;
    const root = (strand / (strands - 1) - 0.5) * 2;
    for (let s = 0; s <= sections; s++) {
      const index = (strand * (sections + 1) + s) * 2;
      for (let edge = 0; edge < 2; edge++) {
        const vertex = index + edge;
        configuration[vertex * 3] = s / sections;
        configuration[vertex * 3 + 1] = root;
        configuration[vertex * 3 + 2] = edge * 2 - 1;
        offsets[vertex] = thickness;
      }
      if (s < sections) {
        faces[face++] = index;
        faces[face++] = index + 1;
        faces[face++] = index + 2;
        faces[face++] = index + 1;
        faces[face++] = index + 3;
        faces[face++] = index + 2;
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(configuration, 3));
  geometry.setAttribute('thread', new BufferAttribute(offsets, 1));
  geometry.setIndex(new BufferAttribute(faces, 1));
  return geometry;
}

const vertex = `
  ${PARAMS}
  attribute float thread;
  varying float u, lane, edge, fall, gloss;
  float ripple(float position, float age) {
    if (age > 1.2) return 0.0;
    float relative = position - 1.85 * age;
    return sin(relative * 10.0) * exp(-15.0 * relative * relative - age * 2.1) * smoothstep(0.0, 0.085, age);
  }
  void main() {
    u = position.x; lane = position.y; edge = position.z;
    float taper = pow(max(0.001, sin(u * 3.14159)), 0.42);
    float crease = sin(u * 9.2 + lane * 1.7 + clock * 0.39);
    float delayed = u + lane * 0.043;
    float packets = ripple(delayed, beatAges.x) * beatStrengths.x + ripple(delayed, beatAges.y) * beatStrengths.y
      + ripple(delayed, beatAges.z) * beatStrengths.z;
    packets /= 1.0 + 0.65 * abs(packets);
    float rootAnchor = smoothstep(0.04, 0.33, u);
    float wave = (packets * release * 0.47 + sin(u * 10.0 - motionPhase * 4.8 + lane * 0.48) * bodyWeight * 0.53)
      * taper * rootAnchor;
    float draw = 1.0 - intake * (0.55 + taper * 0.24) + release * (0.09 + 0.09 * u);
    float width = (0.32 + 0.28 * taper) * draw;
    float px = (u - 0.5) * 3.45 + lane * 0.28 * cos(u * 2.2);
    float py = 0.51 * sin(u * 7.05 - 0.83) + (u - 0.5) * 0.32;
    py += lane * width + (0.21 - intake * 0.115) * crease + wave * 0.36 + breath * 0.025 * taper;
    py += sin(u * 9.0 + lane * 3.0 + clock * 2.2) * (thought * 0.11 + connect * 0.052);
    py += springBack * rootAnchor * 0.29;
    float pz = 0.36 * cos(u * 7.0 + lane * 2.4 + clock * 0.63) + lane * 0.25;
    pz += wave * 0.21 + pulse * 0.15 * taper - intake * lane * 0.095;
    py += edge * thread * (0.0023 + 0.0051 * taper);
    gloss = 0.5 + 0.5 * sin(u * 9.8 + lane * 3.7 + motionPhase * 1.14 + pointer.x * 0.7 + seedKey * 0.3);
    fall = smoothstep(0.0, 0.19, u) * (1.0 - smoothstep(0.79, 1.0, u));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(px, py, pz, 1.0);
  }
`;

const fragment = `
  ${PARAMS}
  uniform float layerOpacity;
  varying float u, lane, edge, fall, gloss;
  void main() {
    float streak = pow(gloss, 5.0);
    float secondary = pow(0.5 + 0.5 * cos(u * 14.0 - lane + clock * 0.57), 9.0);
    float dye = 0.5 + 0.5 * sin(lane * 17.0 + u * 6.3);
    vec3 copper = mix(shade * 0.38 + vec3(0.10,0.037,0.019), glow, 0.23 + 0.35 * dye);
    vec3 color = copper * (0.32 + secondary * 0.54 + spectralSheen * 0.11) + foil * streak * (0.43 + sparkle * 0.25);
    color += foil * intake * pow(1.0 - abs(lane), 3.0) * 0.13;
    color += foil * listenRim * smoothstep(0.79, 1.0, abs(lane)) * 0.19;
    color += (1.0 - abs(edge)) * vec3(0.075,0.028,0.012) + foil * 0.075;
    float feather = clamp(fwidth(edge), 0.18, 1.0);
    float coverage = 1.0 - smoothstep(1.0 - feather, 1.0, abs(edge));
    float opacity = fall * (0.55 + 0.45 * dye) * coverage * layerOpacity;
    gl_FragColor = vec4(color * (1.0 - quiet * 0.58), opacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createScene(seed: number): BuiltScene {
  const uniforms = uniformsFor(seed);
  const object = new Group();
  const silk = new Group();
  const backing = new PlaneGeometry(1, 2, 40, 68).translate(0.5, 0, 0);
  backing.setAttribute('thread', new BufferAttribute(new Float32Array(backing.attributes.position.count), 1));
  // The matching satin surface keeps subpixel gaps between strands from flickering against the background.
  for (const [geometry, layerOpacity, order] of [[backing, 0.91, 0], [ribbons(seed), 0.40, 1]] as const) {
    const surface = new Mesh(geometry, new ShaderMaterial({
      uniforms: { ...uniforms, layerOpacity: { value: layerOpacity } }, vertexShader: vertex, fragmentShader: fragment,
      side: DoubleSide, transparent: true, depthWrite: false,
    }));
    surface.frustumCulled = false;
    surface.renderOrder = order;
    silk.add(surface);
  }
  object.add(aura(uniforms, 4.7, 3, 0.49), silk);
  return { object, update(inputs) {
    feed(uniforms, inputs);
    const { motion } = inputs;
    tilt(silk, motion, -0.20 - uniforms.intake.value * 0.16, Math.sin(motion.time * 0.51) * 0.12, 0.19 + motion.features.recoil * 0.16);
  } };
}
