import { Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import type { BuiltScene } from '../runtime.js';
import { feed, PARAMS, uniformsFor } from './shading.js';

const vertex = `
  varying vec2 field;
  void main() {
    field = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;

const fragment = `${PARAMS}
  varying vec2 field;
  uniform int slices;
  float hash(float p) { return fract(sin(p * 127.1 + seedKey * 3.0) * 43758.5453); }
  float noise1(float p) {
    float f = fract(p);
    return mix(hash(floor(p)), hash(floor(p) + 1.0), f * f * (3.0 - 2.0 * f));
  }
  float fbm(float x) {
    return 0.55 * noise1(x) + 0.29 * noise1(x * 2.11 + 3.4) + 0.16 * noise1(x * 4.3 + 7.0);
  }
  vec4 curtain(vec3 p, float layer) {
    if (abs(p.z - (layer - 1.0) * .44) > .91 || abs(p.x) > 2.15) return vec4(0);
    float width = 1.0 - intake * .31 + release * .17 + springBack * .25;
    float x = (p.x + sin(layer * 2.4) * .33) / max(.64, width);
    float taper = 1.0 - smoothstep(1.06, 1.96, abs(x));
    float swing = motionPhase * (.83 + layer * .12);
    float wave = sin(x * 2.8 + swing * 1.47 + layer * 1.63);
    float crease = fbm(x * (2.1 + intake * 1.15) + layer * 6.1 + swing * .34) - .5;
    float sheet = (layer - 1.0) * (.49 - intake * .21)
      + .26 * sin(x * (2.03 + intake * .89) + swing + layer * 1.8)
      + crease * .62 + release * wave * .25 + springBack * (layer - 1.0) * .68;
    float thickness = 0.073 + release * 0.035;
    float depth = (p.z - sheet) / thickness;
    if (abs(depth) > 2.5 || taper < .01) return vec4(0);
    float bottom = -.54 + sin(x * 1.61 + layer * 1.08 + swing * .74) * .31
      + .25 * x + .23 * crease + .10 * layer + release * .13 * wave;
    float y = p.y - bottom;
    float height = .82 + .16 * layer - .22 * intake + .30 * release * (1.0 + wave * .53);
    float beams = pow(fbm(x * 34.0 + layer * 31.0 + swing * .28), 1.8);
    float folds = .75 + .25 * cos(x * 16.0 + crease * 13.0 + swing);
    float mist = smoothstep(-.12, .045, y) * (1.0 - smoothstep(.19, height, y)) * (beams * 1.18 + .15);
    float seam = exp(-pow((y - .018) / .047, 2.0));
    float halo = exp(-pow(y / .21, 2.0)) * .24;
    float brightness = (mist * .72 + seam * (1.18 + listenRim * .23) + halo) * taper * folds;
    brightness *= .61 + release * (.68 + .36 * wave) + thought * .16 * sin(x * 4.0 - clock * 1.6) + connect * .19;
    float density = exp(-depth * depth * .86) * brightness;
    vec3 jade = mix(vec3(.012, .78, .36), glow, .14);
    vec3 lilac = mix(vec3(.26, .039, .67), shade, .17);
    vec3 hue = mix(jade, lilac, smoothstep(.14, height, y) * .85);
    if (layer > .5 && layer < 1.5) hue = mix(hue, glow * .73 + vec3(.29,.018,.075), .85);
    if (layer > 1.5) hue = mix(hue, vec3(.03,.27,.88), .53);
    hue += foil * seam * .14 + foil * mist * sparkle * .15;
    return vec4(hue * density, density);
  }
  void main() {
    float stepSize = 2.9 / float(slices);
    vec3 light = vec3(0);
    float transmittance = 1.0;
    for (int i = 0; i < 46; i++) {
      if (i >= slices || transmittance < .045) break;
      float z = 1.45 - (float(i) + .5) * stepSize;
      vec3 p = vec3(field.x + z * .38 + pointer.x * z * .19, field.y - z * .30 + pointer.y * z * .15, z);
      vec4 sampleColor = curtain(p,0.0) + curtain(p,1.0) + curtain(p,2.0);
      light += transmittance * sampleColor.rgb * stepSize * 4.5;
      transmittance *= exp(-sampleColor.a * stepSize * 3.7);
    }
    float vignette = (1.0 - smoothstep(1.34, 2.18, abs(field.x))) * (1.0 - smoothstep(1.18, 1.56, abs(field.y)));
    float alpha = min(0.98, (1.0 - transmittance) * 1.36) * vignette * (1.0 - quiet * .58);
    if (alpha < .008) discard;
    vec3 color = light / max(.13, alpha);
    color /= .91 + .32 * max(color.r, max(color.g, color.b));
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createScene(seed: number): BuiltScene {
  const uniforms = { ...uniformsFor(seed), slices: { value: 36 } };
  const object = new Group();
  const curtain = new Mesh(new PlaneGeometry(4.5, 3.10), new ShaderMaterial({
    uniforms, vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, toneMapped: false,
  }));
  object.add(curtain);
  return { object, update(inputs) {
    feed(uniforms, inputs);
    uniforms.slices.value = inputs.motion.reducedMotion ? 18 : inputs.tier === 'full' ? Math.round(24 + (inputs.quality ?? 1) * 20) : 24;
  } };
}

