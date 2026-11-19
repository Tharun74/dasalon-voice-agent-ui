import type { SceneLoader } from './runtime.js';
import type { MountedScene } from './webgl.js';

export type LoadVisual = (document: Document, seed: number, signal: AbortSignal) => Promise<MountedScene | undefined>;

export function lazyScene(load: SceneLoader): LoadVisual {
  return async (document, seed, signal) => {
    const [renderer, module] = await Promise.all([import('./webgl.js'), load()]);
    if (!signal.aborted) return renderer.mountScene(document, module, seed);
    return undefined;
  };
}
