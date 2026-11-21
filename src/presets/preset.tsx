'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { deltaSeconds, smooth } from '../audio.js';
import { MotionEngine, motionTuning, observeMotion } from '../motion.js';
import { themeVariables } from '../theme.js';
import type { VoiceAgentAdapter } from '../types.js';
import { PRESETS } from './catalog.js';
import type { PresetName, PresetProps } from './catalog.js';
import { fallbackRenderer } from './fallback.js';
import type { LoadVisual } from './load-scene.js';
import type { MountedScene } from './webgl.js';
import type { CanvasVisual, SceneInputs } from './runtime.js';

const SIZES = { sm: 176, md: 300, lg: 520 };
function renderSettings(variant: PresetName, adapter: VoiceAgentAdapter, theme: PresetProps['theme'], colors: PresetProps['colors'],
  intensity: number, playback?: PresetProps['motion']) {
  const vars = themeVariables(theme, colors);
  const { maxFps = Infinity, maxPixelRatio = Infinity } = playback ?? {};
  return {
    adapter, tuning: motionTuning(variant, playback?.tuning), playback,
    frameIntervalMs: maxFps > 0 ? 1000 / Math.max(20, maxFps) : 0,
    maxPixelRatio: maxPixelRatio > 0 ? maxPixelRatio : Infinity,
    intensity: Number.isFinite(intensity) ? Math.min(2, Math.max(0, intensity)) : 1,
    palette: { glow: vars['--va-glow'], highlight: vars['--va-highlight'], shadow: vars['--va-shadow'] },
  };
}

function DockPanel({ adapter }: { adapter: VoiceAgentAdapter }) {
  const subscribe = useCallback((notify: () => void) => adapter.subscribe(notify), [adapter]);
  const readSnapshot = useCallback(() => adapter.getSnapshot(), [adapter]);
  const { state, transcript, error } = useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
  const active = state !== 'idle' && state !== 'error';
  const text = error ?? transcript.at(-1)?.text ?? (active ? 'The concierge is ready.' : 'Start a conversation to meet the concierge.');
  return (
    <div style={{ position: 'absolute', inset: 'auto 8px 6px', marginInline: 'auto',
      width: 'min(calc(100% - 16px), 310px)', padding: '10px 12px', border: '1px solid #a96e83',
      borderRadius: 13, background: '#251823', color: '#fff1eb', boxShadow: '0 8px 24px #0006', font: '13px/1.35 system-ui, sans-serif' }}>
      <p role="status" style={{ margin: '0 0 8px' }}>{text}</p>
      <button type="button" style={{ background: '#eeb4a9', color: '#29171c', border: 0, borderRadius: 8, padding: '6px 9px', font: 'inherit' }}
        onClick={() => { if (active) void adapter.stop(); else void adapter.start(); }}>
        {active ? 'End conversation' : 'Start conversation'}
      </button>
    </div>
  );
}

function PresetSurface({ variant, load, draw, ...props }: PresetProps & { variant: PresetName; load?: LoadVisual; draw?: CanvasVisual }) {
  const { adapter, theme, size = 'md', quality: tier = 'preview', intensity = 1, seed = 42, colors, className, style, interactive = true, onPushToTalk, motion: playback } = props;
  const surface = useRef<HTMLCanvasElement>(null);
  const latest = useRef(renderSettings(variant, adapter, theme, colors, intensity, playback));
  const holding = useRef(false);
  const dockTarget = useRef(false);
  const [motion] = useState(() => new MotionEngine(adapter, variant));
  const [open, setOpen] = useState(false);
  const width = typeof size === 'number' ? Math.max(1, size) : size === 'fill' ? undefined : SIZES[size];

  useEffect(() => { latest.current = renderSettings(variant, adapter, theme, colors, intensity, playback); },
    [variant, adapter, theme, intensity, colors, playback]);
  useEffect(() => () => {
    if (!holding.current) return;
    holding.current = false;
    onPushToTalk?.(false);
  }, [onPushToTalk]);

  useEffect(() => {
    const canvas = surface.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    let scene: MountedScene | undefined;
    let loadingScene = !!load;
    let lightweight = false;
    const loading = new AbortController();
    let clientWidth = canvas.clientWidth;
    let clientHeight = canvas.clientHeight;
    const Resize = canvas.ownerDocument.defaultView?.ResizeObserver;
    const resize = Resize ? new Resize(([entry]) => {
      clientWidth = entry.contentRect.width;
      clientHeight = entry.contentRect.height;
    }) : undefined;
    resize?.observe(canvas);
    let slow = 0;
    let stalled = 0;
    let fast = 0;
    let quality = 1;
    let paintedScene: MountedScene | undefined;
    let paintedWhileLoading = false;
    let painted = false;
    let paintedSettings = latest.current;
    const inputs: SceneInputs = { motion: motion.peek(), intensity: latest.current.intensity, palette: latest.current.palette, dockOpen: 0, tier };
    const drawFallback = (draw ?? (seed => fallbackRenderer(variant, seed)))(seed);
    if (load) {
      void load(canvas.ownerDocument, seed, loading.signal).then(mounted => {
        if (loading.signal.aborted) mounted?.dispose();
        else scene = mounted;
      }).catch(() => {
        // Keep drawing the Canvas2D preview if WebGL cannot initialize.
      }).finally(() => { loadingScene = false; });
    }

    const stop = observeMotion(canvas, (dt, reduced) => {
      if (!resize) {
        clientWidth = canvas.clientWidth;
        clientHeight = canvas.clientHeight;
      }
      if (!clientWidth || !clientHeight || canvas.checkVisibility?.({ visibilityProperty: true }) === false) return;
      const current = latest.current;
      const delta = deltaSeconds(current.playback?.transport?.advance(deltaSeconds(dt)) ?? dt);
      if (!reduced && (scene || draw)) {
        const frameBudget = current.frameIntervalMs / 1000;
        slow = dt > Math.max(0.025, frameBudget * 1.45) ? slow + 1 : Math.max(0, slow - 2);
        if (slow > 8) { quality = Math.max(0.60, quality - 0.15); slow = 0; }
        fast = dt < Math.max(0.022, frameBudget * 1.12) ? fast + 1 : 0;
        if (fast > 150 && quality < 1) { quality = Math.min(1, quality + 0.10); fast = 0; }
      }
      if (scene && quality <= .67) {
        // Give a reduced render tier time to recover before relinquishing WebGL.
        stalled = Math.max(0, stalled + (dt > .085 ? Math.min(dt, .20) : -dt * 3));
        if (stalled >= .80) {
          scene.dispose();
          scene = undefined;
          quality = 1;
        }
      } else stalled = 0;
      lightweight = !!load && !loadingScene && !scene;
      const dpr = canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1;
      const maxRatio = lightweight ? 0.82 : tier === 'preview' ? 1 : clientWidth < 500 ? 1.5 : 2;
      const ratio = Math.min(dpr, current.maxPixelRatio, maxRatio) * quality;
      const pixelWidth = Math.max(1, Math.round(clientWidth * ratio));
      const pixelHeight = Math.max(1, Math.round(clientHeight * ratio));
      const resized = canvas.width !== pixelWidth || canvas.height !== pixelHeight;
      if (resized) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      if (!delta && painted && scene === paintedScene && loadingScene === paintedWhileLoading && !resized && paintedSettings === current) return;
      if (variant === 'dock' && delta) inputs.dockOpen = smooth(inputs.dockOpen ?? 0, dockTarget.current ? 1 : 0, delta, 0.10);
      inputs.motion = motion.sample(current.adapter, delta, reduced, current.tuning);
      inputs.intensity = current.intensity;
      inputs.palette = current.palette;
      inputs.aspect = pixelWidth / pixelHeight;
      if (draw) inputs.transcript = current.adapter.getSnapshot().transcript;
      inputs.quality = tier === 'preview' ? quality : Math.min(quality, Math.max(.58, Math.min(1, clientWidth / 460)));
      if (scene?.render(context, pixelWidth, pixelHeight, inputs)) {
        if (canvas.dataset.renderer !== 'webgl') canvas.dataset.renderer = 'webgl';
      } else {
        drawFallback(context, pixelWidth, pixelHeight, inputs, lightweight);
        if (!loadingScene && canvas.dataset.renderer !== 'canvas') canvas.dataset.renderer = 'canvas';
      }
      painted = true;
      paintedScene = scene;
      paintedWhileLoading = loadingScene;
      paintedSettings = current;
      if (delta) current.playback?.onFrame?.(inputs.motion, dt);
    }, () => Math.max(latest.current.frameIntervalMs, lightweight ? 1000 / 30 : 0));
    return () => { resize?.disconnect(); loading.abort(); stop(); scene?.dispose(); };
  }, [variant, seed, tier, load, draw, motion]);

  function hold(held: boolean) {
    if (!onPushToTalk || holding.current === held) return;
    holding.current = held;
    onPushToTalk(held);
  }

  function activate() {
    motion.pulse();
    if (variant === 'dock' && interactive) {
      dockTarget.current = !dockTarget.current;
      setOpen(dockTarget.current);
    }
  }

  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.key !== 'Enter' && event.key !== ' ') || event.repeat || event.target !== event.currentTarget) return;
    event.preventDefault();
    hold(true);
    activate();
  }

  function point(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    motion.point((event.clientX - bounds.left) * 2 / bounds.width - 1, (event.clientY - bounds.top) * 2 / bounds.height - 1);
  }

  return (
    <div className={className} data-voice-variant={variant}
      style={{ width: '100%', maxWidth: width, aspectRatio: size === 'fill' ? undefined : '1.28', height: size === 'fill' ? '100%' : undefined, position: 'relative', touchAction: 'pan-y', ...style }}>
      <div
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? variant === 'dock' ? 'Toggle voice concierge controls' : `Send a ripple through ${PRESETS[variant].name}` : undefined}
        aria-expanded={interactive && variant === 'dock' ? open : undefined}
        onClick={interactive ? activate : undefined}
        onKeyDown={interactive ? keyboard : undefined}
        onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') hold(false); }}
        onBlur={() => { motion.release(); hold(false); }}
        onPointerMove={point}
        onPointerDown={event => {
          point(event);
          if (onPushToTalk) event.currentTarget.setPointerCapture(event.pointerId);
          hold(true);
        }}
        onPointerUp={event => { if (event.pointerType !== 'mouse') motion.release(); hold(false); }}
        onPointerLeave={() => motion.release()}
        onLostPointerCapture={() => hold(false)}
        onPointerCancel={() => { motion.release(); hold(false); }}
        style={{ position: 'absolute', inset: 0, cursor: interactive ? 'pointer' : undefined, borderRadius: 8 }}
      >
        <canvas ref={surface} aria-hidden="true" style={{ height: '100%', width: '100%', display: 'block', pointerEvents: 'none' }} />
      </div>
      {variant === 'dock' && interactive && open ? <DockPanel adapter={adapter} /> : null}
    </div>
  );
}

export function createPreset(variant: PresetName, load?: LoadVisual, draw?: CanvasVisual) {
  function Preset(props: PresetProps) { return <PresetSurface {...props} variant={variant} load={load} draw={draw} />; }
  Preset.displayName = PRESETS[variant].component;
  return Preset;
}
