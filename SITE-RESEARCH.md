# Site research

1. Shadcn keeps the header quiet and lets working components prove the product. Use a compact sticky nav and a live hero. [shadcn/ui](https://ui.shadcn.com/)
2. Shadcn’s individual docs place the preview and installation close together, with repeatable headings below. Keep that order across presets. [Button docs](https://ui.shadcn.com/docs/components/button)
3. Aceternity gives the visual a generous stage framed by a restrained docs layout. Give each shader room at both gallery and component-page scale. [Aceternity UI](https://ui.aceternity.com/)
4. Aceternity’s demos explain interaction by letting visitors try it. Keep state, audio and theme controls next to the canvas where their effects are visible. [Animated Tooltip](https://ui.aceternity.com/components/animated-tooltip)
5. Magic UI uses a clean composition and makes motion part of the component demonstration. Reserve the border beam for the featured preview. [Magic UI](https://magicui.design/), [Border Beam](https://magicui.design/docs/components/border-beam)
6. Magic UI’s Bento Grid makes features easy to scan by giving each cell one job. Pair concise feature cards with small, relevant visual cues. [Bento Grid](https://magicui.design/docs/components/bento-grid)
7. ElevenLabs UI foregrounds stateful, provider-specific components and source installation. Pair each voice preview with adapter-oriented usage and copyable commands. [ElevenLabs UI](https://ui.elevenlabs.io/), [official source](https://github.com/elevenlabs/ui)
8. 21st.dev’s discovery cards make it easy to recognize a component from its preview. Keep search and category facets adjacent to a consistent gallery grid. [21st.dev](https://21st.dev/community/components)
9. Shadcn’s registry manifest indexes items. Item metadata declares files, target paths, npm dependencies and registry dependencies. Preserve the presets’ relative module layout and declare the shared core explicitly. [Registry schema](https://ui.shadcn.com/docs/registry/registry-json), [item schema](https://ui.shadcn.com/docs/registry/registry-item-json)
10. The shadcn CLI builds distributable JSON from the manifest and consumers install from an item URL or configured namespace. Use the same item slug in page routes and install commands. [CLI](https://ui.shadcn.com/docs/cli), [registry guide](https://ui.shadcn.com/docs/registry/getting-started)
