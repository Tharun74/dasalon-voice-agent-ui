'use client';

import { createPreset } from './preset.js';
import { lazyScene } from './load-scene.js';

export const Contour = /* @__PURE__ */ createPreset('contour', /* @__PURE__ */ lazyScene(() => import('./scenes/contour.js')));
