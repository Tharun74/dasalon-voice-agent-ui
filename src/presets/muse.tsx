'use client';

import { createPreset } from './preset.js';
import { renderMuse } from './scenes/muse.js';

export const Muse = /* @__PURE__ */ createPreset('muse', undefined, renderMuse);
