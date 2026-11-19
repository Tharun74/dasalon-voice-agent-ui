import { Group, Mesh, ShaderMaterial, SphereGeometry } from 'three';
import { tilt } from '../runtime.js';
import { aura, feed, PARAMS, SIMPLEX, uniformsFor } from './shading.js';
import type { BuiltScene } from '../runtime.js';

const pressure = `
  float pressurePacket(float position, float age) {
    float front = 0.04 + age * 2.55;
    float distanceToFront = (position - front) * 10.5;
    return exp(-distanceToFront * distanceToFront - age * 2.8) * smoothstep(0.0, 0.045, age);
  }
  float surfacePressure(vec3 position) {
    float travel = (0.54 * position.y + 0.22 * position.x + 0.65);
    return pressurePacket(travel, beatAges.x) + pressurePacket(travel, beatAges.y) + pressurePacket(travel, beatAges.z);
  }
`;

const vertex = `
  ${PARAMS}
  ${SIMPLEX}
  ${pressure}
  varying vec3 surface, viewNormal, viewPoint;
  varying float pressureFront;
  void main() {
    surface = normalize(position);
    vec3 field = surface * 2.4 + vec3(seedKey, -motionPhase * 0.38, motionPhase * 0.23);
    float liquid = simplex(field) * (0.035 + release * 0.072 + bodyWeight * 0.14 - intake * 0.035);
    pressureFront = surfacePressure(surface);
    float wave = pressureFront * release * 0.083
      + sin(surface.y * 10.0 + surface.x * 3.4 - motionPhase * 5.3) * bodyWeight * 0.045;
    float scale = 1.0 + breath * 0.022 - intake * 0.23 + pulse * 0.08 + release * 0.15 + springBack * 0.25;
    vec3 displaced = position * (scale + liquid + wave);
    vec4 view = modelViewMatrix * vec4(displaced, 1.0);
    viewPoint = view.xyz;
    viewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * view;
  }
`;

const fragment = `
  ${PARAMS}
  ${SIMPLEX}
  varying vec3 surface, viewNormal, viewPoint;
  varying float pressureFront;
  void main() {
    vec3 s = normalize(surface), view = normalize(-viewPoint);
    vec3 faceNormal = normalize(cross(dFdx(viewPoint), dFdy(viewPoint)));
    vec3 normal = normalize(mix(viewNormal, faceNormal, 0.21));
    float angle = clamp(dot(normal, view), 0.0, 1.0);
    float rim = pow(1.0 - angle, 2.30);
    float critical = pow(1.0 - angle, 12.0);
    vec3 shift = vec3(motionPhase * 0.24, -motionPhase * 0.19, seedKey);
    vec3 bent = s * 2.0 + vec3(pointer * 0.12, 0.0);
    float n1 = simplex(bent + shift);
    float n2 = simplex(bent * 2.12 - shift + vec3(n1 * 0.7));
    float scroll = s.y * 6.5 - s.x * 5.2 + s.z * 4.5 + n1 * 3.1 + n2 * 0.24;
    float front = pressureFront;
    float flow = scroll + motionPhase * 0.65 + intake * sin(s.x * 5.3 + motionPhase * 2.8)
      + release * front * 1.32 + bodyWeight * sin(s.y * 10.0 - motionPhase * 4.8);
    float wave = 0.5 + 0.5 * sin(flow);
    float liquid = smoothstep(0.18, 0.94, wave);
    float filament = pow(wave, 13.0) + pow(0.5 + 0.5 * sin(flow * 1.9 + n2 * 0.8), 25.0) * 0.47;
    float iridescence = (1.0 - angle) * 11.0 + n1 * 1.5 + n2 * 0.43 + spectralSheen * 0.78;
    vec3 prism = 0.5 + 0.5 * cos(iridescence + vec3(0.1, 2.3, 4.4));
    vec3 spectral = vec3(0.10, 0.31, 0.54) * prism.z
      + vec3(0.44, 0.09, 0.26) * prism.x + vec3(0.10, 0.31, 0.24) * prism.y;
    vec3 tint = mix(shade * 0.1 + vec3(0.025,0.011,0.045), shade * 0.71 + spectral * 0.49, liquid);
    tint += filament * (glow * 0.48 + spectral * 1.45) * (0.38 + angle * 0.53);
    tint += rim * (spectral + glow * 0.28) * 1.36;
    tint += critical * foil * 0.38;
    vec3 key = normalize(vec3(-0.52 + pointer.x * 0.14, 0.64 - pointer.y * 0.1, 0.65));
    float softbox = pow(max(0.0, dot(normal, key)), 26.0);
    float fill = pow(max(0.0, dot(normal, normalize(vec3(0.74,-0.53,0.51)))), 20.0);
    tint += foil * softbox * (0.34 + wave * 0.30) + spectral * fill * 0.96;
    float traveling = pow(max(0.0, cos(atan(s.y, s.x) - clock * 2.2)), 15.0);
    tint += rim * foil * traveling * (thought * 0.83 + connect * 0.68);
    tint += foil * (0.24 * intake) * pow(max(0.0, s.y * .6 - s.x * .4 + .34), 2.0) * rim;
    tint += spectral * front * release * (0.18 + sparkle * 0.52);
    tint *= 1.0 - quiet * 0.69;
    gl_FragColor = vec4(tint, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createScene(seed: number): BuiltScene {
  const uniforms = uniformsFor(seed);
  const object = new Group();
  const shell = new Mesh(new SphereGeometry(1.02, 104, 72), new ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: fragment }));
  object.add(aura(uniforms, 3.8, 3.3, 0.87), shell);
  return { object, update(inputs) {
    feed(uniforms, inputs);
    const { motion } = inputs;
    const listening = uniforms.intake.value;
    tilt(shell, motion, Math.sin(motion.time * 0.41) * 0.15 - 0.20 * listening, -0.11, -0.25 + motion.features.recoil * 0.12);
  } };
}
