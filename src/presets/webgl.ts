import {
  ACESFilmicToneMapping, AmbientLight, DirectionalLight, Group, InstancedMesh, Mesh, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer,
} from 'three';
import type { Material, Object3D } from 'three';
import type { BuiltScene, SceneInputs, SceneModule } from './runtime.js';

interface SharedRenderer {
  renderer: WebGLRenderer;
  users: number;
  disposeTimer?: ReturnType<typeof setTimeout>;
}

const renderers = new WeakMap<Document, SharedRenderer>();

function acquire(document: Document) {
  let shared = renderers.get(document);
  if (!shared) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!context) throw new Error('Three-dimensional rendering requires WebGL 2.');
    const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(1, 1, false);
    shared = { renderer, users: 0 };
    renderers.set(document, shared);
  }
  clearTimeout(shared.disposeTimer);
  shared.disposeTimer = undefined;
  shared.users++;
  return shared;
}

function release(document: Document, shared: SharedRenderer) {
  shared.users--;
  if (shared.users === 0) {
    // A viewport slot can be reassigned before the next preset finishes loading.
    shared.disposeTimer = setTimeout(() => {
      if (shared.users !== 0) return;
      renderers.delete(document);
      shared.renderer.dispose();
      shared.renderer.forceContextLoss();
    }, 250);
  }
}

function disposeObjects(group: Object3D) {
  const materials = new Set<Material>();
  const geometries = new Set<Mesh['geometry']>();
  group.traverse(object => {
    const mesh = object as Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    }
    if (object instanceof InstancedMesh) object.dispose();
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

function light(color: number, strength: number, x: number, y: number, z: number) {
  const source = new DirectionalLight(color, strength);
  source.position.set(x, y, z);
  return source;
}

export function mountScene(document: Document, module: SceneModule, seed: number) {
  const shared = acquire(document);
  let built: BuiltScene;
  try {
    built = module.createScene(seed);
  } catch (error) {
    release(document, shared);
    throw error;
  }
  const renderer = shared.renderer;
  const canvas = renderer.domElement;
  const scene = new Scene();
  const subject = new Group();
  scene.add(subject);
  subject.add(built.object);
  scene.add(
    new AmbientLight(0xd7a7b1, 1.38),
    light(0xffede0, 3.0, -3, 5, 5),
    light(0x968dff, 2.5, 4, -2, 2),
    light(0xff8a97, 2.8, 0, 3, -4),
  );
  const camera = new PerspectiveCamera(34, 1, 0.1, 40);
  camera.position.z = 6;
  let disposed = false;

  return {
    render(target: CanvasRenderingContext2D, width: number, height: number, inputs: SceneInputs) {
      if (disposed || renderer.getContext().isContextLost()) return false;
      if (canvas.width < width || canvas.height < height) {
        renderer.setSize(Math.max(width, canvas.width), Math.max(height, canvas.height), false);
      }
      const aspect = width / height;
      camera.aspect = aspect;
      camera.position.z = 5.2 * Math.max(1, 0.92 / aspect);
      camera.updateProjectionMatrix();
      subject.position.set(inputs.motion.x * 0.07, -inputs.motion.y * 0.06, 0);
      built.update(inputs);
      renderer.setViewport(0, 0, width, height);
      renderer.setScissor(0, 0, width, height);
      renderer.setScissorTest(true);
      renderer.render(scene, camera);
      target.clearRect(0, 0, width, height);
      target.drawImage(canvas, 0, canvas.height - height, width, height, 0, 0, width, height);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      built.dispose?.();
      disposeObjects(scene);
      release(document, shared);
    },
  };
}

export type MountedScene = ReturnType<typeof mountScene>;
