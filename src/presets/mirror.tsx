'use client';

import { createPreset } from './preset.js';
import { lazyScene } from './load-scene.js';

export const Mirror = /* @__PURE__ */ createPreset('mirror', /* @__PURE__ */ lazyScene(() => import('./scenes/mirror.js')));
