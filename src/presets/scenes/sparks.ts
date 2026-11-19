import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from 'three';
import { randomFor } from '../runtime.js';
import { PARAMS } from './shading.js';
import type { StageUniforms } from './shading.js';

export function sparks(uniforms: StageUniforms, seed: number, count: number, radius: number, speakingOnly = false) {
  const random = randomFor(seed);
  const points = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) points.set([random() * Math.PI * 2, random(), random()], index * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(points, 3));
  const material = new ShaderMaterial({
    uniforms: { ...uniforms, radius: { value: radius }, speakingOnly: { value: speakingOnly ? 1 : 0 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: `${PARAMS}
      uniform float radius, speakingOnly;
      varying float light;
      void main() {
        float a = position.x + clock * (0.10 + position.z * 0.3);
        float offset = fract(position.z + clock * (0.16 + position.y * 0.11));
        float r = radius * (0.72 + position.y * 0.43 + release * offset * 0.7);
        vec3 p = vec3(cos(a) * r, sin(a) * r, sin(a * 2.0 + position.z * 6.283) * 0.18 + 0.1);
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        float blink = pow(max(0.0, sin(clock * (1.1 + position.y * 4.8) + position.z * 6.283)), 6.0);
        light = (0.14 + blink * 0.86) * (1.0 - quiet) * (1.0 - speakingOnly * (1.0 - min(release * 1.6, 1.0)));
        gl_PointSize = min(5.4, (2.0 + position.y * 3.0 + release * 1.4) * 4.1 / -view.z);
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `${PARAMS}
      varying float light;
      void main() {
        float r = length(gl_PointCoord * 2.0 - 1.0);
        gl_FragColor = vec4(mix(glow, foil, 0.81), light * exp(-r * r * 5.4) * (1.0 - smoothstep(0.76, 1.0, r)));
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new Points(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}
