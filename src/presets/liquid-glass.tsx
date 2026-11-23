'use client';

import type { CSSProperties } from 'react';
import type { PresetProps } from './catalog.js';
import type { SceneInputs } from './runtime.js';
import { PresetSurface } from './preset.js';
import { lazyScene } from './load-scene.js';

const lens = /* @__PURE__ */ lazyScene(() => import('./scenes/liquid-glass.js'));
const widths = { sm:176, md:300, lg:520 };

export interface LiquidGlassProps extends PresetProps {
  /** Anchor the lens to the bottom corner of the viewport. */
  floating?: boolean;
  /** A loaded, origin-clean image, video or canvas to refract. */
  backdrop?: SceneInputs['backdrop'];
}

export function LiquidGlass({ floating = false, size = 'md', className, style, backdrop, ...props }: LiquidGlassProps) {
  const width = size === 'fill' ? undefined : typeof size === 'number' ? Math.max(1,size) : widths[size];
  const outerStyle: CSSProperties = {
    position:floating?'fixed':'relative',width:floating?'calc(100% - 32px)':'100%',
    maxWidth:width??(floating?360:undefined),aspectRatio:size==='fill'&&!floating?undefined:'1.28',
    height:size==='fill'&&!floating?'100%':undefined,
    bottom:floating?'max(0px, env(safe-area-inset-bottom))':undefined,
    right:floating?'max(16px, env(safe-area-inset-right))':undefined,
    zIndex:floating?30:undefined,pointerEvents:floating?'none':undefined,...style,
  };
  return <div className={className} style={outerStyle}>
    <PresetSurface {...props} variant="liquid-glass" load={lens} backdrop={backdrop} size="fill"
      style={floating?{pointerEvents:'auto'}:undefined} />
  </div>;
}
