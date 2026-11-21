'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PresetProps } from './catalog.js';
import { createPreset } from './preset.js';
import { lazyScene } from './load-scene.js';
import { lensHeight, lensPitch, lensStretch } from './scenes/glass-form.js';

const Surface = /* @__PURE__ */ createPreset('liquid-glass', /* @__PURE__ */ lazyScene(() => import('./scenes/liquid-glass.js')));
const maps = new WeakMap<Document, string>();
const widths = { sm: 176, md: 300, lg: 520 };

function displacementMap(document: Document) {
  const cached = maps.get(document);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  const width = canvas.width = 160, height = canvas.height = 49;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const pixels = ctx.createImageData(width, height);
  const radius = height / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const h = x + .5 - width / 2, v = y + .5 - radius;
      const cap = Math.max(0, Math.abs(h) - width / 2 + radius) * Math.sign(h);
      const length = Math.hypot(cap, v);
      const rim = Math.pow(Math.max(0, Math.min(1, (length / radius - .34) / .66)), 2.1);
      const index = (y * width + x) * 4;
      pixels.data[index] = Math.round(128 - rim * 108 * cap / Math.max(1, length));
      pixels.data[index + 1] = Math.round(128 - rim * 108 * v / Math.max(1, length));
      pixels.data[index + 2] = 128;
      pixels.data[index + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const url = canvas.toDataURL();
  maps.set(document, url);
  return url;
}

export interface LiquidGlassProps extends PresetProps {
  /** Anchor the lens to the bottom corner of the viewport. */
  floating?: boolean;
}

export function LiquidGlass({ floating = false, size = 'md', quality = 'preview', motion, className, style, ...props }: LiquidGlassProps) {
  const key = 'voicekit-lens-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const lens = useRef<HTMLDivElement>(null);
  const displacement = useRef<SVGFEDisplacementMapElement>(null);
  const [map, setMap] = useState('');
  const fullOptics = floating || quality === 'full';
  const backdrop = 'saturate(138%) blur(1.5px)';
  useEffect(() => {
    if (fullOptics && lens.current) setMap(displacementMap(lens.current.ownerDocument));
  }, [fullOptics]);
  const playback = useMemo<PresetProps['motion']>(() => ({
    ...motion,
    onFrame(frame, dt) {
      if (lens.current) {
        lens.current.style.transform = 'translate(' + (-50 + frame.x * 3) + '%, ' + (-50 + frame.y * 9) +
          '%) rotate(' + lensPitch(frame) + 'rad) scale(' + lensStretch(frame) + ', ' + lensHeight(frame) + ')';
      }
      if (displacement.current) {
        const scale = String(Math.round((frame.reducedMotion ? 10 : 20) + frame.features.outward * 8 - frame.features.inward * 4));
        if (displacement.current.getAttribute('scale') !== scale) displacement.current.setAttribute('scale', scale);
      }
      motion?.onFrame?.(frame, dt);
    },
  }), [motion]);
  const width = size === 'fill' ? undefined : typeof size === 'number' ? Math.max(1, size) : widths[size];
  const outerStyle: CSSProperties = {
    position: floating ? 'fixed' : 'relative', width: floating ? 'calc(100% - 32px)' : '100%',
    maxWidth: width ?? (floating ? 360 : undefined), aspectRatio: size === 'fill' && !floating ? undefined : '1.28',
    height: size === 'fill' && !floating ? '100%' : undefined, bottom: floating ? 'max(0px, env(safe-area-inset-bottom))' : undefined,
    right: floating ? 'max(16px, env(safe-area-inset-right))' : undefined,
    zIndex: floating ? 30 : undefined, pointerEvents: floating ? 'none' : undefined, ...style,
  };
  return <div className={className} style={outerStyle}>
    {fullOptics ? <div aria-hidden="true" style={{ position: 'absolute', inset: 0, containerType: 'size', pointerEvents: 'none' }}>
      {map ? <svg width="0" height="0" style={{ position: 'absolute' }} focusable="false">
        <defs><filter id={key} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage href={map} preserveAspectRatio="none" result="lens-map" />
          <feDisplacementMap ref={displacement} in="SourceGraphic" in2="lens-map" xChannelSelector="R" yChannelSelector="G" scale="20" />
        </filter></defs>
      </svg> : null}
      <div ref={lens} style={{
        position: 'absolute', top: '50%', left: '50%', width: 'min(86%, 156.52cqh)', aspectRatio: '3.3',
        borderRadius: '9999px', transform: 'translate(-50%, -50%)',
        background: 'linear-gradient(154deg,rgba(218,233,255,.23),rgba(143,171,204,.04) 44%,rgba(163,135,201,.14))',
        border: '1px solid rgba(233,234,255,.34)', boxShadow: '0 12px 36px rgba(5,7,24,.23), inset 0 1px 2px rgba(255,255,255,.38)',
        WebkitBackdropFilter: backdrop, backdropFilter: map && typeof CSS !== 'undefined' && CSS.supports('backdrop-filter', 'url("#x")') ? 'url("#' + key + '") ' + backdrop : backdrop,
      }} />
    </div> : null}
    <Surface {...props} size="fill" quality={quality} motion={playback} style={floating ? { pointerEvents: 'auto' } : undefined} />
  </div>;
}
