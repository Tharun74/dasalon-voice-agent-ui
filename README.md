# VoiceKit

Twelve interactive voice-agent presets for React. The Next.js site includes a gallery, component documentation, and a Maison Serein salon example.

## Run locally

```sh
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000). Each preset has a component page with live audio controls and a props playground. The salon example lives at `/examples/salon-landing`.

## Audio Lab

Open [the Audio Lab](http://localhost:3000/lab) to tune a preset with the scripted demo, a microphone, or a recording. Choose **Audio file** and **Load real speech sample** for an included LibriSpeech recording, or upload an audio file for local analysis. **Treat as** lets you compare listening and speaking with the same clip. Pause before stepping through individual frames.

**Copy tuned params** returns the preset key and a `motion` object. Pass its `tuning` values through `motion={{ tuning }}` on the matching preset. Attack and release are stored in seconds and output compensation is stored in milliseconds. [Motion reviews](MOTION-REVIEWS.md)

## Install from the local shadcn registry

`npm run dev` builds the current registry into `public/r`. To rebuild it explicitly, run `npm run registry:build`. While the site is running, initialize shadcn in a separate React app and run:

```sh
npx shadcn@latest add http://localhost:3000/r/lumen-orb.json
```

The CLI also installs `voicekit-core`. To use the namespace, merge this entry into the target app’s `components.json`:

```json
{
  "registries": { "@voicekit": "http://localhost:3000/r/{name}.json" }
}
```

```sh
npx shadcn@latest add @voicekit/silk-strands
```

Registry files appear under the target app’s configured components directory. Set `NEXT_PUBLIC_VOICEKIT_URL` to the public origin before building a hosted registry. Set `NEXT_PUBLIC_GITHUB_URL` to the project repository when you have a public GitHub URL.

## Install from this checkout

Run `npm pack` here, then install the resulting archive and Three.js in your React 18 or 19 app.

```sh
npm install ./dasalon-voice-agent-ui-0.1.0.tgz three
```

The package ships ESM and TypeScript declarations. Next.js consumers should create and control adapters in a Client Component.

```tsx
'use client';

import { useEffect, useState } from 'react';
import { VoiceAgent } from '@dasalon/voice-agent-ui';
import { DemoAdapter } from '@dasalon/voice-agent-ui/adapters';

export default function SalonVoice() {
  const [adapter] = useState(() => new DemoAdapter());

  useEffect(() => {
    adapter.start();
    return () => adapter.stop();
  }, [adapter]);

  return <VoiceAgent variant="lumen" adapter={adapter} theme="rose-gold" size="lg" />;
}
```

| Variant | Named export | Package subpath |
| --- | --- | --- |
| `lumen` | `LumenOrb` | `@dasalon/voice-agent-ui/lumen` |
| `silk` | `SilkStrands` | `@dasalon/voice-agent-ui/silk` |
| `mirror` | `Mirror` | `@dasalon/voice-agent-ui/mirror` |
| `bloom` | `Bloom` | `@dasalon/voice-agent-ui/bloom` |
| `prism` | `PrismHalo` | `@dasalon/voice-agent-ui/prism` |
| `stardust` | `Stardust` | `@dasalon/voice-agent-ui/stardust` |
| `dock` | `DockPill` | `@dasalon/voice-agent-ui/dock` |
| `contour` | `Contour` | `@dasalon/voice-agent-ui/contour` |

All presets take `adapter`, `theme`, `size`, `intensity`, `seed` and optional `colors` with `glow`, `highlight` and `shadow` CSS color values. Use `size="fill"` inside a container with a defined height. Use `onPushToTalk` to handle both the start and end of a pointer or keyboard hold.

- `DemoAdapter` supplies a scripted conversation, separate simulated voices, and transcripts without a backend.
- `MicAdapter` captures real microphone input. Call `start()` on a user gesture on HTTPS or localhost, and call `stop()` when you finish.
- `MediaStreamAdapter` measures caller-owned user and agent streams. Connect your provider’s conversation status and transcript with `setAgentState()` and `setTranscript()`. Your app retains ownership of stream playback and tracks.

Run `npm run build` to build the registry, package and site. Run `npm test` for shared-core and package-entry checks.
