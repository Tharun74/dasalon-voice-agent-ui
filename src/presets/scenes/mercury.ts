import { Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import type { BuiltScene } from '../runtime.js';
import { feed, PARAMS, uniformsFor } from './shading.js';

const vertex = `
  varying vec2 field;
  void main() {
    field = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = `${PARAMS}
  uniform int steps;
  varying vec2 field;

  float merge(float a, float b, float tension) {
    float overlap = max(tension - abs(a - b), 0.0) / tension;
    return min(a, b) - overlap * overlap * tension * 0.25;
  }
  mat2 spin(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, s, -s, c);
  }
  float metal(vec3 p) {
    p.yz = spin(pointer.y * 0.34 + 0.23 * sin(clock * 0.54)) * p.yz;
    p.xz = spin(pointer.x * 0.39 + 0.28 * sin(motionPhase * 0.62 + seedKey)) * p.xz;
    p.xy = spin(-0.32 + 0.13 * sin(clock * 0.47) + springBack * 0.45) * p.xy;
    p /= max(0.67, 1.0 + breath * 0.036 - intake * 0.36 + springBack * 0.31);
    float lean = sin(motionPhase * 2.1 + p.y * 4.0) * (0.05 + 0.12 * bodyWeight);
    float core = length((p - vec3(-0.14, -0.08, 0.02)) / vec3(1.13, 0.82, 0.84)) - 0.62;
    float shoulder = length(p - vec3(-0.59, 0.17 + lean, 0.12)) - 0.39;
    float arm = length(p - vec3(0.43 + release * 0.19, 0.31 + lean, -0.02)) - 0.39;
    float body = merge(merge(core, shoulder, 0.27), arm, 0.33 - release * 0.11);
    float sling = sin(motionPhase * 5.7) * (0.035 + release * 0.11);
    float bead = length(p - vec3(0.80 + release * 0.74, 0.50 + lean + sling, 0.04)) - (0.18 + release * 0.035);
    float returnDrop = length(p - vec3(-0.54 - release * 0.46, -0.44 - release * 0.19, 0.12 + sling)) - 0.16;
    float satellite = length(p - vec3(0.98 + release * 0.82, -0.12 - sling, -0.10)) - (0.057 + release * 0.030);
    body = merge(merge(body, bead, 0.22 - release * 0.12), returnDrop, 0.18);
    return min(body, mix(1.0, satellite, smoothstep(0.19, 0.58, release)));
  }
  vec3 normalAt(vec3 p) {
    vec2 h = vec2(0.003, 0.0);
    return normalize(vec3(metal(p + h.xyy) - metal(p - h.xyy), metal(p + h.yxy) - metal(p - h.yxy), metal(p + h.yyx) - metal(p - h.yyx)));
  }
  float boxLight(vec2 p, vec2 extent) {
    vec2 border = abs(p) - extent;
    return 1.0 - smoothstep(-0.03, 0.07, max(border.x, border.y));
  }
  vec3 studio(vec3 ray) {
    vec2 angle = vec2(atan(ray.x, ray.z), ray.y);
    float tall = boxLight(vec2(angle.x + .72, angle.y - .17), vec2(.36, .59));
    float strip = boxLight(vec2(angle.x - .93 - ray.y * .48, angle.y + .11), vec2(.12, .67));
    float ceiling = smoothstep(.37, .61, ray.y + ray.x * .27);
    float darkRail = 1.0 - 0.52 * exp(-pow((ray.y + .18) * 14.0, 2.0));
    vec3 color = (vec3(.018, .023, .041) + glow * .065 + shade * .17) * darkRail;
    color += vec3(.77, .84, 1.12) * tall * 1.60;
    color += mix(foil, vec3(.78, .86, 1.0), .56) * strip * 1.66 + vec3(.60, .67, .82) * ceiling * .82;
    color += mix(glow, vec3(.33, .44, .63), .50) * exp(-pow((ray.y + .63) * 8.5, 2.0)) * .50;
    return color;
  }
  void main() {
    vec3 origin = vec3(field, 3.35);
    vec3 ray = normalize(vec3(field * 0.075, -1.0));
    float travel = 1.83;
    bool hit = false;
    for(int i = 0; i < 58; ++i) {
      if (i >= steps) break;
      float d = metal(origin + ray * travel);
      if (d < .0032) { hit = true; break; }
      travel += max(.004, d * .79);
      if (travel > 4.7) break;
    }
    if (!hit) discard;
    vec3 p = origin + ray * travel;
    vec3 normal = normalAt(p);
    float grazed = 1.0 - clamp(dot(normal, -ray), 0.0, 1.0);
    vec3 reflection = reflect(ray, normal);
    vec3 color = studio(reflection);
    color += pow(grazed, 4.5) * (vec3(.54,.68,.89) * .38 + foil * (.25 + listenRim * .53));
    float highlight = pow(max(0.0, dot(normal, normalize(vec3(-.44,.76,.49)))), 44.0);
    color += foil * highlight * (0.39 + 0.55 * sparkle);
    color += glow * (0.10 * thought + 0.13 * connect) * pow(0.5 + 0.5 * cos(p.x * 5.0 - clock * 2.5), 3.0);
    color *= 1.0 - quiet * .55;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createScene(seed: number): BuiltScene {
  const uniforms = { ...uniformsFor(seed), steps: { value: 54 } };
  const object = new Group();
  const surface = new Mesh(new PlaneGeometry(3.92, 2.87), new ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: fragment }));
  surface.scale.setScalar(1.12);
  object.add(surface);
  return { object, update(inputs) {
    feed(uniforms, inputs);
    uniforms.steps.value = inputs.motion.reducedMotion ? 28 : inputs.tier === 'full' ? Math.round(34 + (inputs.quality ?? 1) * 22) : 32;
  } };
}

