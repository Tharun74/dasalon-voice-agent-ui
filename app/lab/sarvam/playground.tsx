'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { AudioLines, Mic, MicOff, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VoiceAgent } from '@/src/VoiceAgent';
import { SarvamAdapter } from '@/src/adapters/sarvam';
import type { SarvamLanguage, VoiceMetric } from '@/src/adapters/sarvam-protocol';
import { PRESETS, PRESET_NAMES } from '@/src/presets/catalog';
import type { PresetName } from '@/src/presets/catalog';
import { STATE_LABELS } from '@/src/state';

const languageOptions: ReadonlyArray<{ value: SarvamLanguage; label: string }> = [
  { value: 'en-IN', label: 'English (India)' }, { value: 'hi-IN', label: 'हिन्दी' }, { value: 'ta-IN', label: 'தமிழ்' },
];
const selectClass = 'rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring';
const metricLabels: Record<VoiceMetric, string> = {
  'stt-final': 'Transcription final', 'llm-first-token': 'First LLM token', 'sentence-ready': 'Approved sentence',
  'tts-first-chunk': 'First audio chunk', 'first-sample': 'First output sample (estimated)',
};

export function SarvamPlayground() {
  const [timings, setTimings] = useState<Partial<Record<VoiceMetric, number>>>({});
  const [adapter] = useState(() => new SarvamAdapter({
    onTurnStart: () => setTimings({}),
    onMetric: (stage, ms) => setTimings(previous => ({ ...previous, [stage]: Math.round(ms) })),
  }));
  const [preset, setPreset] = useState<PresetName>('lumen');
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const { state, permission, transcript, error } = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getSnapshot);

  useEffect(() => {
    setReady(true);
    return () => { void adapter.stop(); };
  }, [adapter]);

  function submit(text: string) {
    if (!text.trim()) return;
    setTimings({});
    setMessage('');
    void adapter.sendText(text);
  }

  const micOn = adapter.microphoneActive;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-8 sm:py-18">
      <header className="mb-8 max-w-xl">
        <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <AudioLines size={15} aria-hidden="true" /> Voice Lab
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Sarvam voice pipeline</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Talk to Maison Serein’s AI receptionist. Ask about the salon’s services, prices or appointments.
        </p>
      </header>
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1fr]">
        <section aria-label="Voice preset" className="overflow-hidden rounded-xl border bg-card">
          <div className="relative h-72 bg-zinc-950 sm:h-96">
            <VoiceAgent variant={preset} adapter={adapter} size="fill" />
            <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/70 px-3 py-1 text-xs text-white" data-testid="voice-mode">
              AI assistant{adapter.mode ? ` · ${adapter.mode === 'mock' ? 'MockSarvam' : 'Sarvam AI'}` : ''}
            </span>
            <span className="absolute bottom-4 left-4 rounded-full border border-white/20 bg-black/70 px-3 py-1 text-xs text-white" data-testid="voice-state" data-state={state}>
              {STATE_LABELS[state]}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 min-[420px]:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-medium">Preset
              <select className={selectClass} value={preset} onChange={event => setPreset(event.target.value as PresetName)}>
                {PRESET_NAMES.map(key => <option key={key} value={key}>{PRESETS[key].name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium">Language
              <select className={selectClass} defaultValue="" onChange={event => adapter.setLanguage((event.target.value || undefined) as SarvamLanguage | undefined)}>
                <option value="">Auto-detect from speech</option>
                {languageOptions.map(language => <option key={language.value} value={language.value}>{language.label}</option>)}
              </select>
            </label>
          </div>
        </section>
        <section aria-labelledby="conversation-title" className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
          <h2 id="conversation-title" className="text-base font-semibold">Conversation</h2>
          <p id="mic-consent" className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Turning on your mic sends speech clips for transcription. This playground stores no raw audio or server-side transcript text.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={micOn ? 'outline' : 'default'} aria-describedby="mic-consent"
              disabled={!ready || state === 'connecting'} onClick={() => {
                setTimings({});
                if (micOn) void adapter.stop();
                else void adapter.start();
              }}>
              <Mic aria-hidden="true" /> {state === 'connecting' ? 'Waiting for permission' : micOn ? 'Turn off mic' : 'Enable mic'}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!micOn} aria-pressed={adapter.isMuted}
              onClick={() => adapter.mute(!adapter.isMuted)}><MicOff aria-hidden="true" /> {adapter.isMuted ? 'Unmute' : 'Mute'}</Button>
            <Button type="button" variant="ghost" size="sm" disabled={state !== 'speaking' && state !== 'thinking'}
              onClick={() => adapter.interrupt()}><Square aria-hidden="true" /> Interrupt</Button>
          </div>
          {error && <p role="status" className="mt-3 rounded-md border border-border px-3 py-2 text-sm">{error}</p>}
          {permission === 'denied' && <p className="mt-2 text-xs text-muted-foreground">Unblock this site’s mic in your browser settings to try voice again.</p>}
          <section aria-label="Captions" className="my-4 max-h-64 min-h-32 overflow-auto rounded-lg border bg-background p-3">
            {!transcript.length && <p className="text-sm text-muted-foreground">Try “How much is a haircut?”</p>}
            <div aria-live="polite" className="sr-only">{transcript.filter(entry => entry.final).at(-1)?.text}</div>
            <ol className="space-y-3 text-sm leading-relaxed" data-testid="captions">
              {transcript.map(entry => <li key={entry.id} data-speaker={entry.speaker} data-final={entry.final} className="break-words">
                <span className="mr-2 text-xs font-medium text-muted-foreground">{entry.speaker === 'agent' ? 'AI' : 'You'}</span>
                <span className={entry.final ? undefined : 'text-muted-foreground'}>{entry.text}</span>
              </li>)}
            </ol>
          </section>
          <form className="grid grid-cols-[1fr_auto] gap-2" onSubmit={event => { event.preventDefault(); submit(message); }}>
            <label className="sr-only" htmlFor="voice-message">Type a message</label>
            <input id="voice-message" className="min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
              value={message} onChange={event => setMessage(event.target.value)} placeholder="Type instead" maxLength={800} />
            <Button type="submit" disabled={!ready || !message.trim()}>Send</Button>
          </form>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
            <Button type="button" size="sm" variant="ghost" disabled={!ready} onClick={() => submit('How much is a haircut?')}>Try the price question</Button>
            <Button type="button" size="sm" variant="ghost" disabled={!transcript.length} onClick={() => {
              setTimings({});
              void adapter.deleteConversation();
            }}><Trash2 aria-hidden="true" /> Delete conversation</Button>
          </div>
          <details className="mt-3 border-t pt-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-ring">Latency for this turn</summary>
            <dl className="mt-2 space-y-1" data-testid="voice-timings">
              {Object.entries(metricLabels).map(([stage, label]) => (
                <div key={stage} className="flex justify-between gap-2">
                  <dt>{label}</dt><dd data-metric={stage} className="font-mono">{timings[stage as VoiceMetric] ?? '—'}</dd>
                </div>
              ))}
            </dl>
          </details>
        </section>
      </div>
    </main>
  );
}
