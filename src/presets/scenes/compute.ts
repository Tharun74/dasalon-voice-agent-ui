import {
  HalfFloatType, LinearFilter, Mesh, NearestFilter, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, WebGLRenderTarget,
} from 'three';
import type { WebGLRenderer } from 'three';

export const computeVertex = `
  varying vec2 coord;
  void main() {
    coord = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export function computeTarget(width: number, height = width, linear = true) {
  const filter = linear ? LinearFilter : NearestFilter;
  return new WebGLRenderTarget(width, height, {
    type: HalfFloatType, minFilter: filter, magFilter: filter, depthBuffer: false, stencilBuffer: false,
  });
}

export class ComputePass {
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera();
  private readonly plane: Mesh<PlaneGeometry, ShaderMaterial>;

  constructor(private readonly material: ShaderMaterial) {
    this.plane = new Mesh(new PlaneGeometry(2, 2), material);
    this.plane.frustumCulled = false;
    this.scene.add(this.plane);
  }

  draw(renderer: WebGLRenderer, target: WebGLRenderTarget) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.plane.geometry.dispose();
    this.material.dispose();
  }
}

