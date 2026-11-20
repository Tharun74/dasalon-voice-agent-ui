'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown, Code2, Eye, Mic, MicOff, Play, RotateCcw, SlidersHorizontal, Square } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeBlock } from '@/components/code-block';
import { PresetPoster } from '@/components/live-visual';
import { DemoAdapter, MicAdapter } from '@/src/adapters';
import { THEME_PRESETS } from '@/src/theme';
import { VoiceAgent } from '@/src/VoiceAgent';
import { STATE_LABELS } from '@/src/state';
import type { AgentState } from '@/src/types';
import type { ThemeName } from '@/src/theme';
import type { CatalogEntry } from '@/site/catalog';
import { defaultOptions, demoSequence, demoSnippet } from '@/site/snippets';
import type { PlaygroundOptions } from '@/site/snippets';

const states = [
  ['idle', 'Idle'], ['listening', 'Listening'], ['thinking', 'Thinking'], ['speaking', 'Speaking'], ['error', 'Error'],
] as const;
const sizes = ['sm', 'md', 'lg', 'fill'] as const;
const themes = Object.entries(THEME_PRESETS);

function FinishSelect({ theme, onChange }: { theme: ThemeName; onChange(value: ThemeName): void }) {
  return <Select value={theme} onValueChange={value => onChange(value as ThemeName)}>
    <SelectTrigger aria-label="Preview finish" size="sm" className="h-8 min-w-[108px] rounded-md px-2 text-xs sm:min-w-[122px] sm:px-3">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>{themes.map(([name, finish]) => <SelectItem key={name} value={name}>
      <span className="size-2 rounded-full" style={{ background: finish.glow }} />{finish.label}
    </SelectItem>)}</SelectContent>
  </Select>;
}

function RangeField({ id, title, value, min, max, step, display, change }: {
  id: string; title: string; value: number; min: number; max: number; step: number; display: string; change(value: number): void;
}) {
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3"><span id={id} className="text-xs font-medium">{title}</span><output className="font-mono text-[11px] text-muted-foreground">{display}</output></div>
    <Slider aria-labelledby={id} value={[value]} min={min} max={max} step={step} onValueChange={values => change(values[0])} />
  </div>;
}

function PropsPlayground({ value, change }: { value: PlaygroundOptions; change(part: Partial<PlaygroundOptions>): void }) {
  const preset = THEME_PRESETS[value.theme];
  const colors = { glow: preset.glow, highlight: preset.highlight, shadow: preset.shadow, ...value.colors };
  const sizeIndex = sizes.indexOf(value.size as (typeof sizes)[number]);

  return <details className="group rounded-lg border bg-card">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3.5 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
      <span className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-muted-foreground" />Props playground</span>
      <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
    </summary>
    <div className="grid gap-x-6 gap-y-5 border-t p-4 sm:grid-cols-2">
      <RangeField id="prop-size" title="Size" value={Math.max(0, sizeIndex)} min={0} max={3} step={1} display={value.size.toString()} change={size => change({ size: sizes[size] })} />
      <RangeField id="prop-intensity" title="Intensity" value={value.intensity} min={0} max={2} step={.05} display={value.intensity.toFixed(2)} change={intensity => change({ intensity })} />
      <RangeField id="prop-seed" title="Seed" value={value.seed} min={0} max={256} step={1} display={value.seed.toString()} change={seed => change({ seed })} />
      <RangeField id="prop-speed" title="Demo speed" value={value.speed} min={.5} max={2} step={.25} display={`${value.speed}×`} change={speed => change({ speed })} />
      <fieldset className="min-w-0">
        <legend className="mb-1 text-xs font-medium">Colors</legend>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(colors) as (keyof typeof colors)[]).map(key => <label key={key} className="flex items-center gap-0.5 text-[11px] capitalize text-muted-foreground">
            <input type="color" value={colors[key]} className="h-7 w-7 cursor-pointer rounded-sm" onChange={event => change({ colors: { ...colors, [key]: event.target.value } })} />{key}
          </label>)}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end justify-between gap-3 pb-0.5">
        <label htmlFor="prop-interactive" className="flex items-center gap-2 text-xs font-medium">
          <Switch id="prop-interactive" checked={value.interactive} onCheckedChange={interactive => change({ interactive })} /> Interactive
        </label>
        <Button variant="ghost" size="sm" onClick={() => change({ ...defaultOptions, colors: undefined })} className="h-7 text-xs">Reset props</Button>
      </div>
      <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">Demo speed changes how long the scripted conversation stays in each state. Live audio continues at its original rate.</p>
    </div>
  </details>;
}

export function ComponentPlayground({ item }: { item: CatalogEntry }) {
  const [demo] = useState(() => new DemoAdapter());
  const [mic] = useState(() => new MicAdapter());
  const [mode, setMode] = useState<'manual' | 'demo' | 'mic'>('manual');
  const [options, setOptions] = useState<PlaygroundOptions>(defaultOptions);
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState('preview');
  const manualScene = useRef<AgentState | null>(null);
  const adapter = mode === 'mic' ? mic : demo;
  const { state, error } = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getSnapshot);

  useEffect(() => {
    if (mode !== 'demo') {
      if (manualScene.current) {
        demo.preview(manualScene.current);
        manualScene.current = null;
      }
      return;
    }
    if (options.speed === 1) {
      demo.start();
      return () => demo.stop();
    }
    let step = 0;
    let timeout: ReturnType<typeof setTimeout>;
    function advance() {
      const [scene, duration] = demoSequence[step];
      demo.preview(scene);
      step = (step + 1) % demoSequence.length;
      timeout = setTimeout(advance, duration / options.speed);
    }
    advance();
    return () => { clearTimeout(timeout); demo.stop(); };
  }, [demo, mode, options.speed]);

  useEffect(() => () => { void mic.stop(); }, [mic]);

  function chooseState(next: AgentState) {
    if (mode === 'mic') void mic.stop();
    if (mode === 'demo') manualScene.current = next;
    else demo.preview(next);
    setMode('manual');
  }

  function switchTab(value: string) {
    if (value === 'code' && mode === 'mic') { void mic.stop(); setMode('manual'); }
    setTab(value);
  }

  function toggleMic() {
    if (mode === 'mic') { void mic.stop(); setMode('manual'); return; }
    setMode('mic');
    void mic.start();
  }

  const canvasClass = 'voice-canvas flex min-h-[345px] flex-col rounded-lg border sm:min-h-[440px]';
  return <div className="space-y-3">
    <Tabs value={tab} onValueChange={switchTab} className="min-w-0 gap-3">
      <TabsList aria-label="Preset examples" className="w-fit">
        <TabsTrigger value="preview" className="gap-1.5 text-xs"><Eye className="size-3.5" />Preview</TabsTrigger>
        <TabsTrigger value="code" className="gap-1.5 text-xs"><Code2 className="size-3.5" />Code</TabsTrigger>
      </TabsList>
      <TabsContent value="preview" className="min-w-0">
        <div className={canvasClass}>
          <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-1.5 text-[11px] text-zinc-400" role="status">
            <i className="size-1.5 rounded-full bg-[#dca58e]" />{state === 'idle' ? 'Idle' : STATE_LABELS[state]}
          </div>
          <Button type="button" variant="ghost" size="icon" className="absolute top-2.5 right-2.5 z-10 size-8 text-zinc-300 hover:bg-white/10 hover:text-white"
            title="Reload animation" aria-label="Reload animation" onClick={() => setRevision(value => value + 1)}><RotateCcw className="size-4" /></Button>
          <div className="poster-swap relative grid min-h-[255px] flex-1 place-items-center sm:min-h-[340px]">
            <PresetPoster variant={item.variant} eager />
            <VoiceAgent key={revision} variant={item.variant} adapter={adapter} theme={options.theme}
              size={options.size} intensity={options.intensity} seed={options.seed} colors={options.colors} interactive={options.interactive} />
          </div>
          <div className="relative z-10 mx-2.5 mb-2.5 flex flex-wrap items-center gap-1.5 rounded-lg border bg-background/95 p-1.5 text-foreground shadow-lg sm:mx-auto sm:mb-3">
            <div className="flex w-full flex-wrap items-center gap-0.5 sm:w-auto" role="group" aria-label="Agent state">
              {states.map(([itemState, label]) => <Button key={itemState} type="button" size="sm" variant={state === itemState ? 'secondary' : 'ghost'}
                className="h-7 px-1.5 text-[11px] sm:px-2" aria-pressed={state === itemState} onClick={() => chooseState(itemState)}>{label}</Button>)}
            </div>
            <FinishSelect theme={options.theme} onChange={theme => setOptions(previous => ({ ...previous, theme, colors: undefined }))} />
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-[11px]" aria-label={mode === 'demo' ? 'Stop demo conversation' : 'Play demo conversation'}
              onClick={() => { if (mode === 'mic') void mic.stop(); setMode(mode === 'demo' ? 'manual' : 'demo'); }}>
              {mode === 'demo' ? <Square className="size-3.5" /> : <Play className="size-3.5" />}{mode === 'demo' ? 'Stop demo' : 'Play demo'}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-[11px]" aria-pressed={mode === 'mic'}
              aria-label={mode === 'mic' ? 'Turn microphone off' : 'Use my microphone'} onClick={toggleMic}>
              {mode === 'mic' ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}{mode === 'mic' ? 'Mic off' : 'Use mic'}
            </Button>
          </div>
        </div>
        {mode === 'mic' && (error || state === 'connecting') ? <p role="status" className="mt-2 text-xs text-muted-foreground">{error ?? 'Allow microphone access to visualize your voice.'}</p> : null}
      </TabsContent>
      <TabsContent value="code" className="min-w-0">
        <motion.div initial={{ opacity: .72 }} animate={{ opacity: 1 }} transition={{ duration: .18 }}>
          <CodeBlock code={demoSnippet(item, options)} filename={`${item.slug}-preview.tsx`} highlight={[4]} />
        </motion.div>
      </TabsContent>
    </Tabs>
    <PropsPlayground value={options} change={patch => setOptions(previous => ({ ...previous, ...patch }))} />
  </div>;
}
