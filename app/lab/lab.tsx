'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AudioLines, ChevronRight, Clipboard, FileAudio, Mic, Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VoiceAgent } from '@/src/VoiceAgent';
import { DemoAdapter, MicAdapter } from '@/src/adapters';
import { motionTuning } from '@/src/motion';
import type { MotionFrame, MotionTransport, MotionTuning } from '@/src/motion';
import type { PresetName } from '@/src/presets/catalog';
import { STATE_LABELS } from '@/src/state';
import type { AgentState, VoiceAgentAdapter } from '@/src/types';
import { catalog } from '@/site/catalog';
import { ClipAdapter } from '@/site/lab/clip';
import { Telemetry } from '@/site/lab/telemetry';

type Source = 'demo' | 'mic' | 'clip';

class LabTransport implements MotionTransport {
  running = true;
  speed = 1;
  source: Source = 'demo';
  clip?: ClipAdapter;
  pending = 0;
  sampleAfterSeek = false;
  refocusIn = 0;

  constructor(private readonly demo: DemoAdapter) {}

  advance(delta: number) {
    const single = this.pending > 0;
    if (!this.running && !single && !this.sampleAfterSeek) return 0;
    const seconds = single || this.sampleAfterSeek ? 1 / 60 : delta * this.speed;
    this.sampleAfterSeek = false;
    if (single) this.pending--;
    if (this.source === 'demo') {
      this.demo.advance(seconds);
      if (this.refocusIn > 0) {
        this.refocusIn = Math.max(0, this.refocusIn - seconds);
        if (!this.refocusIn) this.demo.preview('listening');
      }
    }
    else if (this.source === 'clip' && single && this.clip) this.clip.seek(this.clip.position() + seconds);
    return seconds;
  }
}

const legend = [
  ['Raw RMS', '#8b91a3'], ['Smoothed RMS', '#f2ab8e'], ['Bass', '#e3a56c'], ['Low mids', '#c49ff4'],
  ['Mids', '#8cc7ec'], ['Presence', '#75dfb8'], ['Treble', '#e68fc8'], ['Onset markers', '#f6bd8d'],
];

const timeline = [
  ['Idle', '#586577'], ['Connecting', '#c19968'], ['Listening', '#78d7c6'], ['Thinking', '#a593f3'],
  ['Speaking', '#f6ab85'], ['Barge-in', '#f37884'], ['Muted', '#887f9b'], ['Error', '#b76273'],
];

const parameters: { key: keyof MotionTuning; label: string; unit: string; scale: number; min: number; max: number; step: number }[] = [
  { key: 'attack', label: 'Attack', unit: ' ms', scale: 1000, min: 9, max: 120, step: 1 },
  { key: 'release', label: 'Release', unit: ' ms', scale: 1000, min: 75, max: 600, step: 1 },
  { key: 'stiffness', label: 'Stiffness', unit: '', scale: 1, min: 60, max: 600, step: 1 },
  { key: 'damping', label: 'Damping', unit: '', scale: 1, min: 6, max: 48, step: 1 },
  { key: 'gain', label: 'Gain', unit: '×', scale: 1, min: .25, max: 2.5, step: .01 },
  { key: 'latency', label: 'Output compensation', unit: ' ms', scale: 1, min: 0, max: 80, step: 1 },
];

const sourceChoices = [
  { value: 'demo', text: 'Demo', icon: AudioLines },
  { value: 'mic', text: 'Microphone', icon: Mic },
  { value: 'clip', text: 'Audio file', icon: FileAudio },
] as const;

const selectStyle = 'h-9 min-w-0 rounded-md border bg-background px-2.5 text-sm';
const scrubStep = 0.01;

export function AudioLab({ initialVariant }: { initialVariant: PresetName }) {
  const [demo] = useState(() => new DemoAdapter({ manual: true }));
  const [mic] = useState(() => new MicAdapter());
  const [transport] = useState(() => new LabTransport(demo));
  const [telemetry] = useState(() => new Telemetry());
  const [variant, setVariant] = useState(initialVariant);
  const [overrides, setOverrides] = useState<Partial<Record<PresetName, MotionTuning>>>({});
  const [source, setSource] = useState<Source>('demo');
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [clip, setClip] = useState<ClipAdapter>();
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<'listening' | 'speaking'>('speaking');
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [demoMode, setDemoMode] = useState<AgentState | 'auto'>('auto');
  const [copyResult, setCopyResult] = useState('');
  const audio = useRef<ClipAdapter | undefined>(undefined);
  const scrubbing = useRef<ClipAdapter | undefined>(undefined);
  const generation = useRef(0);
  const graph = useRef<HTMLCanvasElement>(null);
  const stats = useRef<HTMLOutputElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const position = useRef<HTMLOutputElement>(null);
  const adapter: VoiceAgentAdapter = source === 'mic' ? mic : source === 'clip' && clip ? clip : demo;
  const { state, error } = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getSnapshot);
  const tuning = useMemo(() => overrides[variant] ?? motionTuning(variant), [overrides, variant]);

  const onFrame = useCallback((frame: MotionFrame, realDelta: number) => {
    telemetry.record(frame, realDelta, transport.source === 'clip' && !scrubbing.current ? transport.clip?.position() : undefined, !transport.running);
  }, [telemetry, transport]);
  const playback = useMemo(() => ({ tuning, transport, onFrame }), [tuning, transport, onFrame]);

  useEffect(() => {
    demo.start();
    return () => {
      generation.current++;
      demo.stop();
      void mic.stop();
      audio.current?.dispose();
    };
  }, [demo, mic]);

  useEffect(() => {
    telemetry.connect(graph.current, stats.current, range.current, position.current);
    if (clip) telemetry.seekReadout(clip.position());
  }, [telemetry, clip, source]);

  useEffect(() => {
    if (source === 'clip' && (state === 'idle' || state === 'error') && !clip?.playing) {
      transport.running = false;
      setPlaying(false);
      if (clip) telemetry.seekReadout(clip.position());
      telemetry.flush();
    }
    if (source === 'mic' && state === 'error') {
      transport.running = false;
      setPlaying(false);
    }
  }, [clip, state, source, transport, telemetry]);

  useEffect(() => {
    if (!copyResult) return;
    const id = window.setTimeout(() => setCopyResult(''), 1800);
    return () => window.clearTimeout(id);
  }, [copyResult]);

  function activate(next: Source, nextClip = audio.current) {
    scrubbing.current = undefined;
    if (next !== 'mic') void mic.stop();
    if (next !== 'clip') {
      nextClip?.stop();
      generation.current++;
      setLoading(false);
    }
    transport.source = next;
    transport.clip = nextClip;
    transport.pending = 0;
    transport.sampleAfterSeek = false;
    transport.refocusIn = next === 'demo' && demoMode === 'interrupted' ? .59 : 0;
    transport.running = next === 'demo';
    setPlaying(transport.running);
    setSource(next);
    telemetry.reset();
    if (next === 'demo') {
      if (demoMode === 'auto') demo.start();
      else demo.preview(demoMode);
    }
  }

  async function loadFile(getBytes: () => Promise<ArrayBuffer>, label: string) {
    const id = ++generation.current;
    setLoading(true);
    setFileError('');
    try {
      const next = await ClipAdapter.decode(await getBytes());
      if (id !== generation.current) { next.dispose(); return; }
      next.setDirection(direction);
      next.setRate(transport.speed);
      audio.current?.dispose();
      audio.current = next;
      setClip(next);
      setName(label);
      activate('clip', next);
    } catch {
      if (id === generation.current) setFileError('Could not decode that recording. Try a WAV, MP3, FLAC or Ogg file.');
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }

  async function toggle() {
    if (playing) {
      transport.running = false;
      scrubbing.current = undefined;
      clip?.stop();
      if (source === 'mic') void mic.stop();
      telemetry.flush();
      setPlaying(false);
      return;
    }
    if (source === 'clip' && !clip) return;
    transport.running = true;
    setPlaying(true);
    if (source === 'clip') await clip?.start();
    if (source === 'mic') await mic.start();
  }

  function seek(nextTime: number) {
    if (!clip) return;
    clip.seek(clip.duration - nextTime <= scrubStep ? clip.duration : nextTime);
    telemetry.seekReadout(clip.position(), !scrubbing.current);
    if (!transport.running) transport.sampleAfterSeek = true;
  }

  function beginScrub() {
    if (!clip?.playing) return;
    scrubbing.current = clip;
    transport.running = false;
    clip.stop();
  }

  function finishScrub() {
    const resume = scrubbing.current;
    scrubbing.current = undefined;
    if (!resume || resume !== audio.current || transport.source !== 'clip' || !playing) return;
    if (resume.position() >= resume.duration - 0.001) {
      transport.running = false;
      setPlaying(false);
      telemetry.flush();
      return;
    }
    transport.running = true;
    void resume.start();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ preset: variant, motion: { tuning } }, null, 2));
      setCopyResult('Copied');
    } catch { setCopyResult('Copy unavailable'); }
  }

  const displayName = catalog.find(item => item.variant === variant)?.name;
  return <div className="site-width space-y-6 py-9 sm:py-13">
    <header>
      <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">VoiceKit <ChevronRight className="size-3" /> Motion</p>
      <h1 className="text-5xl leading-none font-semibold tracking-[-.061em] sm:text-6xl">Audio Lab</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Watch the signal that drives the preset. Switch between a scripted conversation, your microphone and a recording processed in this browser.</p>
    </header>

    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Audio source">
        {sourceChoices.map(choice => <Button key={choice.value} type="button" size="sm" variant={source === choice.value ? 'secondary' : 'ghost'}
          aria-pressed={source === choice.value} onClick={() => { if (source !== choice.value) activate(choice.value); }}><choice.icon className="size-4" />{choice.text}</Button>)}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="lab-preset" className="text-sm text-muted-foreground">Preset</label>
        <select id="lab-preset" className={selectStyle} value={variant} onChange={event => { telemetry.reset(); setVariant(event.target.value as PresetName); }}>
          {catalog.map(item => <option value={item.variant} key={item.variant}>{item.name}</option>)}
        </select>
      </div>
    </div>

    {source === 'clip' ? <section aria-label="Audio file controls" className="space-y-3 rounded-xl border bg-card p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="relative flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium focus-within:outline-2 focus-within:outline-ring">
            <FileAudio className="size-3.5" /> Upload recording
            <input type="file" className="absolute inset-0 cursor-pointer opacity-0" accept="audio/*,.flac,.wav,.m4a" aria-label="Upload recording" onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void loadFile(() => file.arrayBuffer(), file.name);
            }} />
          </label>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => void loadFile(async () => {
            const response = await fetch('/audio/librispeech.flac');
            if (!response.ok) throw new Error('Speech sample unavailable');
            return response.arrayBuffer();
          }, 'LibriSpeech recording')}>Load real speech sample</Button>
          <span className="max-w-[260px] truncate text-xs text-muted-foreground" role="status">{loading ? 'Decoding recording…' : name}</span>
          {name === 'LibriSpeech recording' ? <a href="/audio/ATTRIBUTION.md" className="rounded text-xs text-muted-foreground underline underline-offset-3">Recording credit</a> : null}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="clip-direction" className="text-xs text-muted-foreground">Treat as</label>
          <select className={selectStyle} id="clip-direction" value={direction} onChange={event => {
            const next = event.target.value as typeof direction;
            setDirection(next);
            clip?.setDirection(next);
            if (!transport.running) transport.sampleAfterSeek = true;
          }}><option value="speaking">Agent speech</option><option value="listening">User speech</option></select>
        </div>
      </div>
      {fileError ? <p role="alert" className="text-sm text-destructive">{fileError}</p> : null}
      {clip ? <div className="flex flex-wrap items-center gap-2.5">
        <label htmlFor="lab-scrub" className="text-xs text-muted-foreground">Scrub</label>
        <input key={name} ref={range} id="lab-scrub" type="range" min="0" max={clip.duration} step={scrubStep} defaultValue={0} className="min-w-24 flex-1 accent-[var(--rose)]"
          onPointerDown={beginScrub} onPointerUp={finishScrub} onPointerCancel={finishScrub} onLostPointerCapture={finishScrub}
          onInput={event => seek(Number(event.currentTarget.value))} onBlur={() => { finishScrub(); telemetry.seekReadout(clip.position()); }} />
        <output ref={position} className="min-w-14 font-mono text-xs">0.00 s</output>
        <span className="font-mono text-xs text-muted-foreground">/ {clip.duration.toFixed(2)} s</span>
      </div> : null}
    </section> : null}

    <div className="grid items-start gap-4 lg:grid-cols-2">
      <section aria-label="Preset playback" className="min-w-0 overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b p-3.5">
          <h2 className="text-sm font-semibold">{displayName}</h2>
          <span role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><i className="size-1.5 rounded-full bg-[var(--rose)]" />{STATE_LABELS[state]}</span>
        </div>
        <div className="voice-canvas h-64 sm:h-[318px]">
          <VoiceAgent variant={variant} adapter={adapter} size="fill" motion={playback} />
        </div>
        <div className="flex flex-wrap items-center gap-2.5 border-t p-3">
          <Button type="button" size="sm" onClick={() => void toggle()} disabled={source === 'clip' && !clip}>
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {source === 'mic' ? playing ? 'Stop microphone' : 'Start microphone' : playing ? 'Pause' : 'Play'}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={playing || (source === 'clip' && !clip)}
            onClick={() => { transport.pending++; }}><StepForward className="size-3.5" /> Step frame</Button>
          <div className="flex items-center gap-2 text-xs"><label htmlFor="lab-speed">Speed</label>
            <select id="lab-speed" className={`${selectStyle} h-8 text-xs`} value={speed} onChange={event => {
              const next = Number(event.target.value);
              transport.speed = next;
              audio.current?.setRate(next);
              setSpeed(next);
            }}>{[.1, .25, .5, .75, 1].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select>
          </div>
          {source === 'demo' ? <div className="flex items-center gap-2 text-xs"><label htmlFor="lab-turn">Turn</label>
            <select id="lab-turn" className={`${selectStyle} h-8 text-xs`} value={demoMode} onChange={event => {
              const mode = event.target.value as typeof demoMode;
              setDemoMode(mode);
              transport.refocusIn = mode === 'interrupted' ? .59 : 0;
              if (mode === 'auto') demo.start();
              else demo.preview(mode);
            }}>
              <option value="auto">Conversation</option><option value="listening">Listening</option>
              <option value="speaking">Speaking</option><option value="thinking">Thinking</option>
              <option value="interrupted">Barge-in</option>
            </select>
          </div> : null}
        </div>
        {error && source !== 'demo' ? <p role="alert" className="px-3 pb-3 text-sm text-destructive">{error}</p> : null}
        {source === 'mic' && state === 'connecting' ? <p className="px-3 pb-3 text-xs text-muted-foreground">Allow microphone access in your browser.</p> : null}
      </section>

      <section aria-label="Signal telemetry" className="min-w-0 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3.5">
          <h2 className="text-sm font-semibold">Signal telemetry</h2>
          <output ref={stats} aria-label="Frame rate and frame time" className="font-mono text-[10px] text-muted-foreground">0 frames · — FPS</output>
        </div>
        <canvas ref={graph} className="block h-[252px] w-full sm:h-[307px]" aria-label="Raw and smoothed RMS, five band envelopes, onset markers and state timeline for the latest 360 frames" />
        <div className="space-y-2.5 border-t p-3 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {legend.map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: color }} />{label}</span>)}
          </div>
          <div className="flex flex-wrap gap-x-2.5 gap-y-1.5"><strong className="font-medium text-foreground">State timeline</strong>
            {timeline.map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><i className="size-2 rounded-sm" style={{ background: color }} />{label}</span>)}
          </div>
        </div>
      </section>
    </div>

    <section aria-labelledby="motion-tuning" className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 id="motion-tuning" className="text-base font-semibold tracking-tight">Engine tuning</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setOverrides(values => ({ ...values, [variant]: motionTuning(variant) }))}><RotateCcw className="size-3.5" /> Reset to defaults</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void copy()}><Clipboard className="size-3.5" /><span aria-live="polite">{copyResult || 'Copy tuned params'}</span></Button>
        </div>
      </div>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {parameters.map(parameter => {
          const id = `tuning-${parameter.key}`;
          const value = Math.round(tuning[parameter.key] * parameter.scale * 100) / 100;
          return <div key={parameter.key}>
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <label htmlFor={id}>{parameter.label}</label><output htmlFor={id} className="font-mono text-muted-foreground">{value}{parameter.unit}</output>
            </div>
            <input id={id} type="range" className="w-full accent-[var(--rose)]" min={parameter.min} max={parameter.max} step={parameter.step}
              value={value} onChange={event => {
                const next = Number(event.target.value) / parameter.scale;
                setOverrides(values => ({ ...values, [variant]: { ...tuning, [parameter.key]: next } }));
              }} />
          </div>;
        })}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">Recordings and demos can read ahead. Live streams use bounded prediction for rising output levels.</p>
    </section>
  </div>;
}
