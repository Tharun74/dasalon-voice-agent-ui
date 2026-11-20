import { BufferAttribute, BufferGeometry, DoubleSide, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, ShaderMaterial, SphereGeometry } from 'three';
import { energy, randomFor, tilt } from '../runtime.js';
import { aura, feed, PARAMS, uniformsFor } from './shading.js';
import { sparks } from './sparks.js';
import type { BuiltScene } from '../runtime.js';

function petalGeometry(length: number, width: number, curve: number) {
  const vertices: number[] = [], uv: number[] = [], faces: number[] = [];
  const rows = 21, cols = 13;
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    const wing = Math.sin(Math.PI * v ** 1.46) ** 0.65;
    for (let col = 0; col <= cols; col++) {
      const u = col / cols, cross = u * 2 - 1;
      const x = cross * width * (wing + 0.02) + Math.sin(v * Math.PI) * 0.034;
      const y = length * v;
      const z = curve * Math.sin(v * Math.PI * 0.83) + cross * cross * wing * width * 0.39
        - 0.074 * v ** 3 * Math.cos(cross * 4.0) + Math.sin(u * 12 + v * 10) * v ** 3 * 0.012;
      vertices.push(x, y, z);
      uv.push(u, v);
      if (row < rows && col < cols) {
        const index = row * (cols + 1) + col;
        faces.push(index, index + cols + 1, index + 1, index + 1, index + cols + 1, index + cols + 2);
      }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  geo.setIndex(faces);
  geo.computeVertexNormals();
  return geo;
}

const petalVertex = `
  varying vec2 coord;
  varying vec3 surface, toward;
  void main() {
    coord = uv;
    surface = normalize(normalMatrix * normal);
    vec4 view = modelViewMatrix * vec4(position,1.0);
    toward = -view.xyz;
    gl_Position = projectionMatrix * view;
  }
`;

const petalFragment = `${PARAMS}
  uniform float layer;
  varying vec2 coord;
  varying vec3 surface, toward;
  void main() {
    vec3 view = normalize(toward);
    vec3 n = normalize(surface);
    if (dot(view,n) < 0.0) n *= -1.0;
    vec3 key = normalize(vec3(-0.53,0.72,0.61));
    float diffuse = 0.45 + 0.55 * max(0.0, dot(n, key));
    float porous = pow(max(0.0, dot(reflect(-key,n),view)), 17.0);
    float rim = pow(1.0 - clamp(dot(n,view),0.0,1.0), 3.0);
    float edge = pow(abs(coord.x*2.0-1.0), 3.0);
    float veins = pow(0.5 + 0.5 * cos((coord.x - 0.5) * (62.0 + coord.y * 21.0) + sin(coord.y * 7.0) * 0.8), 11.0);
    float tip = smoothstep(0.30, 1.0, coord.y);
    vec3 root = shade * (0.42 + layer * 0.19) + vec3(0.055, 0.012, 0.024);
    vec3 finish = glow * (0.70 + layer * 0.13) + foil * 0.19;
    vec3 color = mix(root, finish, tip * 0.82 + edge * 0.15) * diffuse;
    color += foil * (rim * 0.18 + porous * 0.25 + veins * tip * 0.055 + pow(coord.y, 8.0) * 0.22);
    color += glow * release * tip * 0.29 + foil * listenRim * edge * tip * .22;
    gl_FragColor = vec4(color * (1.0 - quiet * 0.59), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createScene(seed: number): BuiltScene {
  const random = randomFor(seed);
  const uniforms = uniformsFor(seed);
  const object = new Group();
  const flower = new Group();
  const petals: { hinge: Mesh; angle: number; layer: number; variation: number }[] = [];
  const whorls = [
    { count: 12, len: 1.055, width: 0.31, curve: 0.16, start: 0.14 },
    { count: 10, len: 0.74, width: 0.24, curve: 0.22, start: 0.10 },
    { count: 8, len: 0.48, width: 0.18, curve: 0.21, start: 0.065 },
  ];
  for (const [layer, whorl] of whorls.entries()) {
    const geometry = petalGeometry(whorl.len, whorl.width, whorl.curve);
    const material = new ShaderMaterial({
      uniforms: { ...uniforms, layer: { value: layer } }, side: DoubleSide, vertexShader: petalVertex, fragmentShader: petalFragment,
    });
    for (let i = 0; i < whorl.count; i++) {
      const angle = i * Math.PI * 2 / whorl.count + layer * 0.26 + random() * 0.09 + seed * 0.065;
      const hinge = new Mesh(geometry, material);
      hinge.rotation.order = 'ZXY';
      hinge.position.set(-Math.sin(angle) * whorl.start, Math.cos(angle) * whorl.start, layer * 0.067);
      const shape = 0.91 + random() * 0.14;
      hinge.scale.set(shape, shape, shape);
      petals.push({ hinge, angle, layer, variation: random() });
      flower.add(hinge);
    }
  }
  const center = new InstancedMesh(new SphereGeometry(1, 7, 5), new MeshStandardMaterial({ color: '#f1baa8', roughness: 0.44, emissive: '#73394a', emissiveIntensity: 0.52 }), 48);
  const point = new Object3D();
  for (let i = 0; i < center.count; i++) {
    const angle = i * 2.399963;
    const radius = Math.sqrt(i / center.count) * 0.155;
    point.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.39 - radius * 0.48);
    point.scale.setScalar(0.012 + random() * 0.020);
    point.updateMatrix();
    center.setMatrixAt(i, point.matrix);
  }
  flower.add(center);
  object.add(aura(uniforms, 3.55, 3.4, 0.79), flower, sparks(uniforms, seed + 4, 105, 1.03, true));
  return { object, update(inputs) {
    feed(uniforms, inputs);
    const { motion } = inputs;
    const { inward, outward, quiet } = energy(inputs);
    for (const { hinge, angle, layer, variation } of petals) {
      const ripple = Math.sin(motion.time * 6 - layer * 1.4 - angle * 0.7);
      const turn = Math.sin(motion.time * 2.25 + angle * 2 + layer * 1.7);
      hinge.rotation.set(0.02 + layer * 0.20 + inward * 0.54 - outward * (0.43 + ripple * 0.17)
        + motion.weights.thinking * turn * 0.11 + motion.weights.connecting * turn * 0.17
        - motion.features.recoil * (0.55 + layer * .08) + quiet * 0.31 - motion.pulse * 0.17
        + Math.sin(motion.time * 1.35 + angle + variation) * 0.05, (variation - 0.5) * 0.16, angle);
    }
    flower.scale.setScalar(1 - inward * .13 + outward * .16 + motion.features.recoil * .14);
    tilt(flower, motion, -0.23 + Math.sin(motion.time * 0.62) * 0.10, 0.18, motion.time * 0.10);
  } };
}
