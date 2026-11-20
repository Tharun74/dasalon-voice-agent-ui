# Progress

## Done

- All eight gallery cards now link to prerendered component pages with previews, usage and installation. The Audio Lab stays available as a separate tuning tool. Component previews show the preset poster while the client renderer starts, and code blocks defer syntax highlighting until they approach the viewport.
- The shared render loop batches WebGL previews into one atlas before copying to the visible canvases. The gallery keeps every visible card animated and can target 60 FPS with adaptive resolution. Persistent WebGL stalls switch to animated Canvas2D.
- Silk Strands uses wider, slower syllable ripples, a more damped body response and a smaller brightness swing. [Motion review](MOTION-REVIEWS.md)
- Smoothed the shared speaking-to-listening handoff, bounded changes to the shader clock, and made Dock and Stardust animation phase independent of transient input and frame rates. Fixed Lab scrubbing so dragging pauses the audio and resumes once on release, with fades at playback boundaries.
- Motion Phase 1 adds the shared audio-motion engine, a variable-cadence DemoAdapter, and the Audio Lab at `/lab`. The lab reads demo, microphone and uploaded audio, and exposes a transport, signal scopes, preset tuning and clipboard export.
- Lumen Orb and Silk Strands have individual spring, audio and onset profiles. The real-speech review tightened Silk’s response to soft syllables and verified visibly opposed listening and speaking shapes. [Motion research](MOTION-RESEARCH.md), [motion reviews](MOTION-REVIEWS.md)

- VoiceKit Phase A replaces the salon-first Vite playground with a dark-first Next.js App Router site. The landing page, light mode, searchable gallery and live hero use the original eight presets.
- The eight presets use one data-driven page template with state, finish, microphone and demo controls, a props editor, Shiki code, installer tabs, adapter examples, a props table, live examples and a table of contents.
- Maison Serein is isolated at `/examples/salon-landing` with its original portrait and salon layout and an eight-preset picker. The docs introduction and command palette cover the available routes.
- Shadcn builds `voicekit-core` and all eight preset items into `public/r`.
- The site review fixed overly tight hero typography, clipped desktop install text, and a mobile layout that put the live visual too far down. [Site research](SITE-RESEARCH.md)

## Next

- Motion Phase 2 tunes Mirror, Bloom, Prism Halo, Stardust, Dock Pill and Contour individually and records a before/after review for each.
- Motion Phase 3 adds Mercury, Aurora Veil, Ink in Water and Silk Veil. Phase 4 adds Murmuration, Liquid Glass, Muse and Jewel, with Kinetic Type as a bonus.
- Motion Phase 5 covers accessibility, performance and release verification for future presets.

## Decisions

- The latest motion brief reopens the shared engine and preset choreography. Motion Phase 1 changes only the two reference scenes and shared runtime. The existing site layout is preserved.
- Output compensation reads future buffered samples when available and uses bounded output prediction otherwise. The transport and shader phases run independently of the browser audio clock during frame stepping.
- The gallery caps previews at 1× device-pixel ratio. WebGL previews share one context. Offscreen cards switch back to posters, and hidden tabs pause drawing.
- Webpack resolves the frozen package’s Node-compatible `.js` specifiers to TS sources. The registry adjusts those specifiers in copied code for default Next consumer builds.
- The speed control changes the demo conversation’s cadence. The original shader clocks and live audio rates are preserved.

## Known issues

- The GitHub button opens repository search until `NEXT_PUBLIC_GITHUB_URL` is configured.
- Provider examples were type-checked against the SDKs. Live provider sessions require credentials and were outside the browser test.
- The reference pair measured 144 FPS at 6.9 ms in hardware-accelerated Chrome on AMD Radeon integrated graphics. The software WebGL run was slower. The other six presets and mobile hardware remain to be benchmarked.
