import { AdditiveBlending, Color, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';
import type { SceneInputs } from '../runtime.js';
import { energy, updateColor } from '../runtime.js';

export function uniformsFor(seed: number) {
  const initial = (Math.trunc(seed) >>> 0) % 1021;
  return {
    clock: { value: 0 },
    motionPhase: { value: 0 },
    breath: { value: 0 },
    bodyWeight: { value: 0 },
    sparkle: { value: 0 },
    spectralSheen: { value: 0 },
    springBack: { value: 0 },
    beatAges: { value: new Vector3(9, 9, 9) },
    beatStrengths: { value: new Vector3() },
    listenRim: { value: 0 },
    seedKey: { value: initial * 0.01 },
    intake: { value: 0 },
    release: { value: 0 },
    quiet: { value: 0 },
    thought: { value: 0 },
    connect: { value: 0 },
    recoil: { value: 0 },
    pulse: { value: 0 },
    pointer: { value: new Vector2() },
    glow: { value: new Color('#e8a39a') },
    foil: { value: new Color('#ffdfc4') },
    shade: { value: new Color('#a63d65') },
  };
}

export type StageUniforms = ReturnType<typeof uniformsFor>;

export const PARAMS = `
uniform float clock, seedKey, intake, release, quiet, thought, connect, recoil, pulse;
uniform float motionPhase, breath, bodyWeight, sparkle, spectralSheen, springBack, listenRim;
uniform vec3 beatAges, beatStrengths;
uniform vec2 pointer;
uniform vec3 glow, foil, shade;
`;

export function feed(uniforms: StageUniforms, inputs: SceneInputs) {
  const { motion, palette } = inputs;
  const { inward, outward, quiet } = energy(inputs);
  uniforms.clock.value = motion.time;
  uniforms.motionPhase.value = motion.phase;
  uniforms.breath.value = motion.breath;
  const detail = (motion.reducedMotion ? 0.34 : 1) * (0.40 + inputs.intensity * 0.60);
  uniforms.bodyWeight.value = motion.features.weight * detail;
  uniforms.sparkle.value = motion.features.sparkle * detail;
  uniforms.spectralSheen.value = motion.features.sheen * detail;
  uniforms.springBack.value = motion.features.recoil * detail;
  uniforms.beatAges.value.set(motion.beats[0], motion.beats[1], motion.beats[2]);
  uniforms.beatStrengths.value.set(motion.beatStrengths[0], motion.beatStrengths[1], motion.beatStrengths[2]);
  uniforms.listenRim.value = motion.features.rim * (motion.reducedMotion ? .58 : 1);
  uniforms.intake.value = inward;
  uniforms.release.value = outward;
  uniforms.quiet.value = quiet;
  uniforms.thought.value = motion.weights.thinking;
  uniforms.connect.value = motion.weights.connecting;
  uniforms.recoil.value = motion.weights.interrupted;
  uniforms.pulse.value = motion.pulse;
  uniforms.pointer.value.set(motion.x, motion.y);
  updateColor(uniforms.glow.value, palette.glow, 0.11, motion.delta);
  updateColor(uniforms.foil.value, palette.highlight, 0.11, motion.delta);
  updateColor(uniforms.shade.value, palette.shadow, 0.11, motion.delta);
}

export function aura(uniforms: StageUniforms, width: number, height: number, strength = 0.61) {
  const material = new ShaderMaterial({
    uniforms: { ...uniforms, strength: { value: strength } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: `varying vec2 coords;
      void main() { coords = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${PARAMS}
      uniform float strength;
      varying vec2 coords;
      void main() {
        vec2 p = coords - vec2(0.12 * pointer.x, -0.1 * pointer.y);
        float r = length(p);
        float falloff = exp(-dot(p, p) * 4.8) * (1.0 - smoothstep(0.54, 0.98, r));
        vec3 tint = mix(shade, glow, 0.26 + 0.19 * sin(0.8 * clock - p.y * 3.0));
        gl_FragColor = vec4(tint, falloff * strength * (0.73 + release * 0.32 + pulse * 0.2 - quiet * 0.6));
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new Mesh(new PlaneGeometry(width, height), material);
  mesh.position.z = -0.8;
  mesh.renderOrder = -1;
  return mesh;
}

// Simplex gradient noise adapted from Ashima Arts / Stefan Gustavson (MIT).
// https://github.com/ashima/webgl-noise/blob/master/src/noise3D.glsl
export const SIMPLEX = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
float simplex(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy), i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx, x2 = x0 - i2 + C.yyy, x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  vec3 ns = (1.0 / 7.0) * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z), y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy, y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy), b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0, s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy, a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x), p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z), p3 = vec3(a1.zw,h.w);
  vec4 n = 1.79284291400159 - 0.85373472095314 *
    vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3));
  p0 *= n.x; p1 *= n.y; p2 *= n.z; p3 *= n.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m *= m;
  return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;
