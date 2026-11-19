'use client';

import { useEffect, useState } from 'react';
import { DemoAdapter, MicAdapter } from '@/src/adapters';
import type { PresetName } from '@/src/presets/catalog';
import { catalog } from '@/site/catalog';
import { SalonContext } from './salon-context';

export function SalonExample() {
  const [demo] = useState(() => new DemoAdapter());
  const [mic] = useState(() => new MicAdapter());
  const [preset, setPreset] = useState<PresetName>('lumen');
  const [mode, setMode] = useState<'manual' | 'demo' | 'mic'>('manual');
  useEffect(() => () => { demo.stop(); void mic.stop(); }, [demo, mic]);
  return <>
    <div className="site-width flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
      <p className="text-sm font-medium">Example <span className="text-muted-foreground">/ Maison Serein</span></p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <label htmlFor="example-preset">Salon preset</label>
        <select id="example-preset" value={preset} onChange={event => setPreset(event.target.value as PresetName)} className="rounded-md border bg-card px-3 py-2 text-foreground">
          {catalog.map(item => <option key={item.variant} value={item.variant}>{item.name}</option>)}
        </select>
      </div>
    </div>
    <div className="salon-example">
      <SalonContext variant={preset} adapter={mode === 'mic' ? mic : demo} options={{ theme: 'rose-gold' }} mode={mode}
        playDemo={() => {
          if (mode === 'mic') void mic.stop();
          if (mode === 'demo') { demo.stop(); setMode('manual'); }
          else { demo.start(); setMode('demo'); }
        }}
        useMicrophone={() => {
          if (mode === 'mic') { void mic.stop(); setMode('manual'); }
          else { demo.stop(); void mic.start(); setMode('mic'); }
        }}
      />
    </div>
  </>;
}
