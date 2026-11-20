import {
  ACESFilmicToneMapping, AmbientLight, DirectionalLight, Group, InstancedMesh, Mesh, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer,
} from 'three';
import type { Material, Object3D } from 'three';
import type { BuiltScene, SceneInputs, SceneModule } from './runtime.js';

interface SharedRenderer {
  renderer: WebGLRenderer;
  users: number;
  pending: Set<RenderTile>;
  batch: RenderTile[];
  flush(): void;
  disposeTimer?: ReturnType<typeof setTimeout>;
}

interface RenderTile {
  context?: CanvasRenderingContext2D;
  inputs?: SceneInputs;
  width: number;
  height: number;
  y: number;
  draw(renderer: WebGLRenderer, inputs: SceneInputs): void;
}

const renderers = new WeakMap<Document, SharedRenderer>();
const unavailable = new WeakSet<Document>();

function paintBatch(renderer: WebGLRenderer, batch: RenderTile[], width: number, height: number) {
  const canvas = renderer.domElement;
  if (canvas.width < width || canvas.height < height) {
    renderer.setSize(Math.max(width, canvas.width), Math.max(height, canvas.height), false);
  }
  renderer.setScissorTest(true);
  for (const tile of batch) {
    renderer.setViewport(0, tile.y, tile.width, tile.height);
    renderer.setScissor(0, tile.y, tile.width, tile.height);
    tile.draw(renderer, tile.inputs!);
  }
  // Draw a complete atlas before any 2D copies request the WebGL output.
  for (const tile of batch) {
    const context = tile.context!;
    const { width: w, height: h } = tile;
    context.clearRect(0, 0, w, h);
    context.drawImage(canvas, 0, canvas.height - tile.y - h, w, h, 0, 0, w, h);
  }
  batch.length = 0;
}

function flushTiles(renderer: WebGLRenderer, pending: Set<RenderTile>, batch: RenderTile[]) {
  if (renderer.getContext().isContextLost()) {
    pending.clear();
    return;
  }
  const limit = renderer.capabilities.maxTextureSize;
  let width = 0;
  let height = 0;
  for (const tile of pending) {
    if (batch.length && height + tile.height > limit) {
      paintBatch(renderer, batch, width, height);
      width = height = 0;
    }
    tile.y = height;
    width = Math.max(width, tile.width);
    height += tile.height;
    batch.push(tile);
  }
  pending.clear();
  if (batch.length) paintBatch(renderer, batch, width, height);
}

function acquire(document: Document) {
  if (unavailable.has(document)) return undefined;
  let shared = renderers.get(document);
  if (!shared) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', {
      alpha: true, antialias: true, premultipliedAlpha: true, failIfMajorPerformanceCaveat: true,
    });
    if (!context) {
      unavailable.add(document);
      return undefined;
    }
    const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(1, 1, false);
    const pending = new Set<RenderTile>();
    const batch: RenderTile[] = [];
    shared = { renderer, users: 0, pending, batch, flush: () => flushTiles(renderer, pending, batch) };
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
    // Retain the context briefly across client navigation and viewport changes.
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
  if (!shared) return undefined;
  let built: BuiltScene;
  try {
    built = module.createScene(seed);
  } catch (error) {
    release(document, shared);
    throw error;
  }
  const renderer = shared.renderer;
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
  const tile: RenderTile = {
    width: 0, height: 0, y: 0,
    draw(renderer, inputs) {
      const aspect = tile.width / tile.height;
      if (camera.aspect !== aspect) {
        camera.aspect = aspect;
        camera.position.z = 5.2 * Math.max(1, 0.92 / aspect);
        camera.updateProjectionMatrix();
      }
      subject.position.set(inputs.motion.x * 0.07, -inputs.motion.y * 0.06, 0);
      built.update(inputs);
      renderer.render(scene, camera);
    },
  };
  camera.aspect = 0;

  return {
    render(target: CanvasRenderingContext2D, width: number, height: number, inputs: SceneInputs) {
      if (disposed || renderer.getContext().isContextLost()) return false;
      tile.context = target;
      tile.inputs = inputs;
      tile.width = width;
      tile.height = height;
      if (!shared.pending.size) queueMicrotask(shared.flush);
      shared.pending.add(tile);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      shared.pending.delete(tile);
      built.dispose?.();
      disposeObjects(scene);
      release(document, shared);
    },
  };
}

export type MountedScene = NonNullable<ReturnType<typeof mountScene>>;
