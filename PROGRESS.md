# Progress

## Done

- Completed Fix Pass Batch A for Lumen Orb, Silk Strands, Glass Ribbon and Liquid Glass. The [review](docs/fixes/BATCH-A.md) links all before-and-after sheets and 0.25× speaking strips and records the preview/full CPU numbers. All measured tier pairs held 60 FPS.
- Added Glass Ribbon as the 18th preset. It has one lens form, live and synthetic audio, measured-envelope replay, WebGL refraction, and a Canvas2D fallback. The local reference lab compares 261 frames and exports measurements. Source frames are generated locally from the supplied video and ignored by Git.
- Verified Glass Ribbon rendering in Chromium, Firefox and WebKit, plus Canvas2D with reduced motion. The original lens measured 0.5079 mean SSIM on entry frames 14–59 and 0.3930 on frames 60–239. All five authored entry cues were within one frame of the annotations.
- Ink in Water now uses bounded onset-only dye doses, shrinking high-energy splats, a dye grid at twice the velocity resolution, clamped MacCormack transport, and stronger vorticity confinement. The display tone-maps density with headroom.
- Added Murmuration, Liquid Glass, Muse, Jewel and Kinetic Type. Each ships with a separate package entry, gallery poster, component docs, and registry item. The gallery now has 17 presets.
- Gallery and embedded previews use the preview quality tier, and the focused playground uses the full tier. Hold Shift+F or use the FPS button to display per-card frame timings.
- Phase 4 verification passed the production build, 16 tests, and an actual shadcn install of all five new items in a separate TypeScript app. Hardware-accelerated Chrome on AMD Radeon measured all 17 previews at 60.0 FPS and 16.7 ms during simulated speaking in one 1440×2100 run with a single WebGL context. Ink in Water produced no near-opaque pixels at maximum intensity in its speech check.
- Added Mercury, Aurora Veil, Ink in Water and Silk Veil. Each has a gallery poster, dedicated docs, a package export and a shadcn registry item. Ink uses a pressure-projected GPU fluid solver and Silk Veil uses GPU Verlet cloth. [Motion reviews](MOTION-REVIEWS.md)
- Phase 3 verification passed the production build, all 16 tests, and shadcn resolution of the four items with their shared files. Chrome exercised all twelve live cards in one WebGL context, checked all ten changed component pages and verified the four animated Canvas2D fallbacks with reduced motion.
- Migrated Mirror, Bloom, Prism Halo, Stardust, Dock Pill and Contour to the shared attention, directional and recoil cues. [Motion reviews](MOTION-REVIEWS.md)
- Locked the seven required motion rules in the shared engine. Lumen Orb and Silk Strands now use a 200 ms attention rim, channel-isolated direction, an anticipation hold, and individually timed idle rhythms. [Motion reviews](MOTION-REVIEWS.md)
- The Audio Lab now includes all seven selectable speech scenarios, synchronized timeline markers, replay, and a state-label toggle.
- Reverified Motion Phase 1 with real speech, a quiet copy, opposite-polarity stereo and Chrome’s microphone input. The Audio Lab preserves the selected speech direction during decoding and lets a paused preset swap draw a fresh sample without starting playback. [Research](MOTION-RESEARCH.md), [motion reviews](MOTION-REVIEWS.md)
- All eight gallery cards now link to prerendered component pages with previews, usage and installation. The Audio Lab stays available as a separate tuning tool. Component previews show the preset poster while the client renderer starts, and code blocks defer syntax highlighting until they approach the viewport.
- The shared render loop batches WebGL previews into one atlas before copying to the visible canvases. The gallery keeps every visible card animated and can target 60 FPS with adaptive resolution. Persistent WebGL stalls switch to animated Canvas2D.
- Silk Strands uses wider, slower syllable ripples, a more damped body response and a smaller brightness swing. The Phase 1 review added feathered ribbon edges and satin underneath to reduce shimmer in dense folds. [Motion review](MOTION-REVIEWS.md)
- Smoothed the shared speaking-to-listening handoff, bounded changes to the shader clock, and made Dock and Stardust animation phase independent of transient input and frame rates. Fixed Lab scrubbing so dragging pauses the audio and resumes once on release, with fades at playback boundaries.
- Motion Phase 1 adds the shared audio-motion engine, a variable-cadence DemoAdapter, and the Audio Lab at `/lab`. The lab reads demo, microphone and uploaded audio, and exposes a transport, signal scopes, preset tuning and clipboard export.
- Lumen Orb and Silk Strands have individual spring, audio and onset profiles. The real-speech review tightened Silk’s response to soft syllables and verified visibly opposed listening and speaking shapes. [Motion research](MOTION-RESEARCH.md), [motion reviews](MOTION-REVIEWS.md)

- VoiceKit Phase A replaces the salon-first Vite playground with a dark-first Next.js App Router site. The landing page, light mode, searchable gallery and live hero use the original eight presets.
- The eight presets use one data-driven page template with state, finish, microphone and demo controls, a props editor, Shiki code, installer tabs, adapter examples, a props table, live examples and a table of contents.
- Maison Serein is isolated at `/examples/salon-landing` with its original portrait and salon layout and an eight-preset picker. The docs introduction and command palette cover the available routes.
- Shadcn builds `voicekit-core` and all eight preset items into `public/r`.
- The site review fixed overly tight hero typography, clipped desktop install text, and a mobile layout that put the live visual too far down. [Site research](SITE-RESEARCH.md)

## Next

- Fix Pass Batch B awaits confirmation. Order is Mirror, Bloom, Stardust and Prism Halo.
- Motion Phase 5 covers accessibility, performance and release verification for future presets.

## Decisions

- Liquid Glass passes optional backdrop media through the existing preset surface to its single WebGL scene. The shared audio-motion engine is unchanged by Fix Pass Batch A.
- Audio Lab uploads measure RMS across channels before calculating the spectrum from the strongest channel in the analysis window. This avoids phase cancellation while keeping one FFT per signal sample.
- The latest motion brief reopens the shared engine and preset choreography. Motion Phase 1 changes only the two reference scenes and shared runtime. The existing site layout is preserved.
- Output compensation reads future buffered samples when available and uses bounded output prediction otherwise. The transport and shader phases run independently of the browser audio clock during frame stepping.
- The gallery caps previews at 1× device-pixel ratio. WebGL previews share one context. Offscreen cards switch back to posters, and hidden tabs pause drawing.
- Murmuration runs a WebGL2 texture simulation with up to 16,384 boids focused and 3,072 in the gallery. Liquid Glass uses native SVG backdrop displacement in compatible browsers. Muse and Kinetic Type use projected Canvas2D drawing.
- Webpack resolves the frozen package’s Node-compatible `.js` specifiers to TS sources. The registry adjusts those specifiers in copied code for default Next consumer builds.
- The speed control changes the demo conversation’s cadence. The original shader clocks and live audio rates are preserved.

## Known issues

- The GitHub button opens repository search until `NEXT_PUBLIC_GITHUB_URL` is configured.
- Provider examples were type-checked against the SDKs. Live provider sessions require credentials and were outside the browser test.
- The focused Lumen Orb and Silk Strands reached 144 FPS at 6.9 ms in hardware-accelerated Chrome on AMD Radeon integrated graphics. Focused performance for the other presets and mobile hardware remain to be benchmarked.
- Liquid Glass uses frosted glass when SVG backdrop displacement is unavailable.

## Known issues (deferred)

- FPS dips during recording playback and capture.
- The 4× CPU-throttle test is deferred.
- Committed end-to-end regression tests for the Audio Lab scenarios are deferred. Core motion tests cover the scenario data and timing.

## Sarvam voice pipeline

- Phase 1 adds `/lab/sarvam`, the package’s `/sarvam` adapter, MockSarvam and the signed session, STT, chat and TTS handlers. The playground drives all 18 presets through the existing adapter contract.
- The HTTP path uses bounded WAV submissions with client VAD, optional snapshot captions, streamed fact selection and PCM playback. TTS requires a short-lived grant bound to the exact approved sentence.
- Next is Phase 2 for booking requests, salon integration, more vetted languages and the shadcn adapter registry item. True streaming STT needs a persistent gateway. Live Sarvam evals and room-acoustic tests are pending a rotated server credential. [Phase 1 report](docs/sarvam-phase-1.md)
