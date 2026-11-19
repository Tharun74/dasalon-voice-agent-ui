'use client';

import { useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { STATE_LABELS, themeVariables, VoiceAgent } from '@/src/index';
import type { AgentState, PresetName, PresetProps } from '@/src/index';
import portrait from './salon-portrait.webp';

const STAGE_COPY: Record<AgentState, string> = {
  idle: 'Try a conversation or use your microphone to see it respond.',
  connecting: 'Getting the listening room ready.',
  listening: 'Go ahead. Tell us what you’re looking for.',
  thinking: 'Checking the details for your visit.',
  speaking: 'The concierge is sharing a suggestion.',
  interrupted: 'Go ahead. The concierge has paused.',
  muted: 'The microphone is muted.',
  error: 'The concierge is temporarily offline.',
};

const SERVICES = [
  ['Cut & shape', 'Precision cuts built around the way you wear your hair.', 'From $85'],
  ['Gloss & color', 'Dimensional color and a sheer gloss for lasting shine.', 'From $110'],
  ['Scalp ritual', 'A slow cleanse, targeted care and a restorative massage.', 'From $75'],
] as const;

interface SalonProps {
  variant: PresetName;
  adapter: PresetProps['adapter'];
  options: Omit<PresetProps, 'adapter'>;
  mode: 'manual' | 'demo' | 'mic';
  playDemo(): void;
  useMicrophone(): void;
}

export function SalonContext({ variant, adapter, options, mode, playDemo, useMicrophone }: SalonProps) {
  const { state, error } = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getSnapshot);
  const stageCopy = error ?? (mode === 'mic' && state === 'connecting'
    ? 'Allow microphone access in your browser to begin.'
    : STAGE_COPY[state]);

  return (
    <div className="site">
      <a className="skip-link" href="#concierge">Skip to concierge</a>
      <header className="masthead">
        <a className="wordmark" href="#" aria-label="Maison Serein home">
          maison serein<span>.</span>
        </a>
        <nav aria-label="Salon">
          <a href="#rituals">The menu</a>
          <a className="nav-concierge" href="#concierge">Voice concierge <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <div>
        <div className="hero">
          <section className="portrait" aria-labelledby="hero-title">
            <img src={portrait.src} alt="Glossy espresso waves styled at the Maison Serein atelier" width="1080" height="1350" fetchPriority="high" />
            <div className="portrait-copy">
              <p className="small-label">Hair &amp; scalp atelier</p>
              <h1 id="hero-title">Good hair.<br /><em>Better rituals.</em></h1>
              <a className="portrait-link" href="#rituals">Explore the menu <span aria-hidden="true">↘</span></a>
            </div>
          </section>

          <section id="concierge" className="concierge" aria-labelledby="concierge-title" style={themeVariables(options.theme, options.colors) as CSSProperties}>
            <div className="stage-heading">
              <span className="small-label"><span className="stage-mark" aria-hidden="true">✦</span> Voice concierge</span>
              <span className="source-label">{mode === 'mic' ? 'Microphone mode' : 'Demo mode'}</span>
            </div>
            <div className="stage-title">
              <h2 id="concierge-title">The listening room</h2>
              <p>Appointments, treatments and a little expert advice.</p>
            </div>

            <div className="salon-preset"><VoiceAgent adapter={adapter} variant={variant} {...options} size="fill" /></div>

            <div className="stage-status" data-state={state}>
              <p className="stage-state" role="status"><i aria-hidden="true" />{STATE_LABELS[state]}</p>
              <p className="stage-copy" aria-live="polite">{stageCopy}</p>
            </div>
            <div className="voice-controls">
              <button type="button" className="primary-action" onClick={playDemo}>
                <span className={mode === 'demo' ? 'stop-icon' : 'play-icon'} aria-hidden="true" />
                {mode === 'demo' ? 'Stop demo' : 'Play demo'}
              </button>
              <button type="button" className="mic-action" aria-pressed={mode === 'mic'} onClick={useMicrophone}>
                <span className="mic-icon" aria-hidden="true" />
                {mode === 'mic' ? 'Turn mic off' : 'Use microphone'}
              </button>
            </div>
          </section>
        </div>

        <section id="rituals" className="rituals" aria-labelledby="rituals-title">
          <p className="small-label">The menu</p>
          <h2 id="rituals-title">Care for every texture.</h2>
          <div className="service-grid">
            {SERVICES.map(([name, description, price]) => (
              <article key={name} className="service">
                <h3>{name}</h3>
                <p>{description}</p>
                <span>{price}</span>
              </article>
            ))}
          </div>
        </section>
      </div>

      <footer><span>Maison Serein</span><span>Fictional salon · Voice UI playground</span></footer>
    </div>
  );
}
