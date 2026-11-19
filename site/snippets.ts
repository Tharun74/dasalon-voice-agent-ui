import type { CatalogEntry } from '@/site/catalog';
import type { AgentState } from '@/src/types';
import type { BrandColors, ThemeName } from '@/src/theme';
import type { PresetSize } from '@/src/presets/catalog';

export const demoSequence: readonly [AgentState, number][] = [
  ['connecting', 800], ['listening', 2950], ['thinking', 1530], ['speaking', 2450],
  ['interrupted', 590], ['listening', 2100], ['speaking', 2750], ['muted', 1350], ['error', 1500], ['idle', 1300],
];

export type PlaygroundOptions = {
  size: PresetSize;
  intensity: number;
  seed: number;
  theme: ThemeName;
  speed: number;
  interactive: boolean;
  colors?: BrandColors;
};

export const defaultOptions: PlaygroundOptions = {
  size: 'lg', intensity: 1, seed: 42, theme: 'rose-gold', speed: 1, interactive: true,
};

const root = '@/components/voicekit';
const importFor = ({ exportName, variant }: CatalogEntry) => `import { ${exportName} } from '${root}/presets/${variant}';`;

export function demoSnippet(item: CatalogEntry, options?: PlaygroundOptions) {
  const paced = Boolean(options && options.speed !== 1);
  const lines = options ? [
    `size={${JSON.stringify(options.size)}}`,
    `theme="${options.theme}"`,
    `intensity={${options.intensity}}`,
    `seed={${options.seed}}`,
    ...(!options.interactive ? ['interactive={false}'] : []),
    ...(options.colors ? [`colors={${JSON.stringify(options.colors)}}`] : []),
  ] : [];
  const effect = paced ? `const playbackRate = ${options!.speed};
    const scenes = ${JSON.stringify(demoSequence)} as const;
    let step = 0;
    let timer: ReturnType<typeof setTimeout>;

    function advance() {
      const [state, duration] = scenes[step];
      adapter.preview(state);
      step = (step + 1) % scenes.length;
      timer = setTimeout(advance, duration / playbackRate);
    }

    advance();
    return () => {
      clearTimeout(timer);
      adapter.stop();
    };` : `adapter.start();
    return () => adapter.stop();`;

  return `'use client';

import { useEffect, useState } from 'react';
${importFor(item)}
import { DemoAdapter } from '${root}/adapters';

export default function VoicePreview() {
  const [adapter] = useState(() => new DemoAdapter());

  useEffect(() => {
    ${effect}
  }, [adapter]);

  return <${item.exportName} adapter={adapter}${lines.length ? '\n    ' + lines.join('\n    ') + '\n  ' : ' '}/>;
}`;
}

export function microphoneSnippet(item: CatalogEntry) {
  return `'use client';

import { useEffect, useState } from 'react';
${importFor(item)}
import { MicAdapter } from '${root}/adapters';

export default function MicrophonePreview() {
  const [adapter] = useState(() => new MicAdapter());

  useEffect(() => () => { void adapter.stop(); }, [adapter]);

  return (
    <section>
      <${item.exportName} adapter={adapter} />
      <button onClick={() => void adapter.start()}>Start microphone</button>
      <button onClick={() => void adapter.stop()}>Stop microphone</button>
    </section>
  );
}`;
}

function mediaSnippet(item: CatalogEntry, liveKit: boolean) {
  const providerImport = liveKit ? "import { useVoiceAssistant, useLocalParticipant } from '@livekit/components-react';\n" : '';
  const inputs = liveKit ? `  const { state, audioTrack } = useVoiceAssistant();
  const { microphoneTrack } = useLocalParticipant();
  const input = microphoneTrack?.track?.mediaStreamTrack;
  const output = audioTrack?.publication.track?.mediaStreamTrack;
` : '';
  const mapped = liveKit ? `state === 'speaking' || state === 'thinking' || state === 'listening' ? state : 'connecting'` : 'state';
  return `'use client';

import { useEffect, useMemo } from 'react';
${providerImport}${importFor(item)}
import { MediaStreamAdapter } from '${root}/adapters';${liveKit ? '' : `\nimport type { AgentState } from '${root}/types';`}

export default function ${liveKit ? 'LiveKitPreview()' : `StreamPreview({ input, output, state }: {
  input?: MediaStreamTrack;
  output?: MediaStreamTrack;
  state: AgentState;
})`} {
${inputs}  const adapter = useMemo(() => new MediaStreamAdapter({
    input: input ? new MediaStream([input]) : undefined,
    output: output ? new MediaStream([output]) : undefined,
  }), [input, output]);

  useEffect(() => () => { void adapter.stop(); }, [adapter]);
  useEffect(() => {
    adapter.setAgentState(${mapped});
  }, [adapter, state]);

  async function measure() {
    await adapter.start();
    adapter.setAgentState(${mapped});
  }

  return (
    <>
      <${item.exportName} adapter={adapter} />
      <button disabled={!input && !output} onClick={() => void measure()}>
        Enable voice visualization
      </button>
    </>
  );
}`;
}

function elevenLabsSnippet(item: CatalogEntry) {
  return `'use client';

import { useMemo } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
${importFor(item)}
import type { AgentSnapshot, VoiceAgentAdapter } from '${root}/types';

function Meter({ conversationToken }: { conversationToken: string }) {
  const session = useConversation();
  const adapter = useMemo<VoiceAgentAdapter>(() => {
    const snapshot: AgentSnapshot = {
      state: session.status === 'connected'
        ? session.isSpeaking ? 'speaking' : 'listening'
        : session.status === 'connecting' ? 'connecting' : 'idle',
      transcript: [],
    };
    return {
      ...snapshot,
      getSnapshot: () => snapshot,
      subscribe: () => () => {},
      inputLevel: session.getInputVolume,
      outputLevel: session.getOutputVolume,
      frequencyData: (channel = 'input') => ({
        bins: Float32Array.from(channel === 'output'
          ? session.getOutputByteFrequencyData()
          : session.getInputByteFrequencyData(), value => value / 255),
        sampleRate: 48000,
      }),
      async start() { await session.startSession({ conversationToken }); },
      async stop() { await session.endSession(); },
      mute: session.setMuted,
    };
  }, [conversationToken, session]);

  return (
    <>
      <${item.exportName} adapter={adapter} />
      <button onClick={() => void adapter.start()}>Connect</button>
      <button onClick={() => void adapter.stop()}>Disconnect</button>
    </>
  );
}

export default function ElevenLabsPreview({ conversationToken }: {
  conversationToken: string;
}) {
  return <ConversationProvider><Meter conversationToken={conversationToken} /></ConversationProvider>;
}`;
}

function vapiSnippet(item: CatalogEntry) {
  return `'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Vapi from '@vapi-ai/web';
${importFor(item)}
import type { AgentSnapshot, AgentState, VoiceAgentAdapter } from '${root}/types';

export default function VapiPreview({ publicKey, assistantId }: {
  publicKey: string;
  assistantId: string;
}) {
  const client = useRef<Vapi | null>(null);
  const output = useRef(0);
  const [state, setState] = useState<AgentState>('idle');

  useEffect(() => {
    const vapi = new Vapi(publicKey);
    client.current = vapi;
    const listening = () => setState('listening');
    const speaking = () => setState('speaking');
    const idle = () => { output.current = 0; setState('idle'); };
    const error = () => setState('error');
    const level = (value: number) => { output.current = value; };
    vapi.on('call-start', listening);
    vapi.on('call-end', idle);
    vapi.on('speech-start', speaking);
    vapi.on('speech-end', listening);
    vapi.on('volume-level', level);
    vapi.on('error', error);
    return () => {
      vapi.removeAllListeners();
      void vapi.stop();
      client.current = null;
    };
  }, [publicKey]);

  const adapter = useMemo<VoiceAgentAdapter>(() => {
    const snapshot: AgentSnapshot = { state, transcript: [] };
    const frequencies = { bins: new Float32Array(0), sampleRate: 48000 };
    return {
      ...snapshot,
      getSnapshot: () => snapshot,
      subscribe: () => () => {},
      inputLevel: () => 0,
      outputLevel: () => output.current,
      frequencyData: () => frequencies,
      async start() { setState('connecting'); await client.current?.start(assistantId); },
      async stop() { await client.current?.stop(); },
      mute(value) { client.current?.setMuted(value); },
    };
  }, [assistantId, state]);

  return (
    <>
      <${item.exportName} adapter={adapter} />
      <button onClick={() => void adapter.start()}>Connect</button>
      <button onClick={() => void adapter.stop()}>Disconnect</button>
    </>
  );
}`;
}

export function providerSnippets(item: CatalogEntry) {
  return [
    { label: 'Demo', filename: 'voice-preview.tsx', code: demoSnippet(item), context: 'Use the scripted conversation when developing without a provider or API key.' },
    { label: 'Mic', filename: 'microphone-preview.tsx', code: microphoneSnippet(item), context: 'Start capture from a user gesture on HTTPS or localhost. Only the input channel is measured.' },
    { label: 'MediaStream', filename: 'stream-preview.tsx', code: mediaSnippet(item, false), context: 'Pass browser audio tracks already owned by your app. The adapter measures both channels without playing them or stopping their tracks.' },
    { label: 'LiveKit', filename: 'livekit-preview.tsx', code: mediaSnippet(item, true), context: 'Place this inside your LiveKit room alongside your audio renderer. The example uses @livekit/components-react.' },
    { label: 'ElevenLabs', filename: 'elevenlabs-preview.tsx', code: elevenLabsSnippet(item), context: 'Pass a conversation token from your server and install @elevenlabs/react. Session controls remain owned by the provider.' },
    { label: 'Vapi', filename: 'vapi-preview.tsx', code: vapiSnippet(item), context: 'Install @vapi-ai/web and pass your public key and assistant ID. The web SDK bridge below provides output level and turn state.' },
  ];
}
