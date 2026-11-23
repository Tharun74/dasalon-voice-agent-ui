# Batch A fix review

Preview and full renders were captured at 280 × 181 and 520 × 406 CSS pixels. Each before and after set uses the same four demo states, seed and capture times. Loud speaking uses intensity 2 and an amplified DemoAdapter output. The full-tier strips contain 12 equally spaced animation samples captured with the transport running at 0.25×.

CPU p95 measures the frame callback and synchronous atlas work on the browser's main thread. It excludes asynchronous GPU execution. Each timing window sampled 125 rendered frames in Chromium, with the preview and full tiers tested separately at DPR 1. Full-tier after timings for Lumen, Silk and Liquid were sampled after their speaking strips, so the exact syllable window differs from the before runs. Frame cadence averaged 60 FPS for every pair.

| Preset | Preview CPU p95, ms | Full CPU p95, ms | Evidence |
| --- | ---: | ---: | --- |
| Lumen Orb | 0.7 → 0.6 | 0.6 → 0.6 | [Preview](lumen-orb/comparison-preview.webp) · [Full](lumen-orb/comparison-full.webp) · [0.25× strip](lumen-orb/after/speaking-025x.webp) |
| Silk Strands | 0.5 → 0.6 | 0.5 → 0.5 | [Preview](silk-strands/comparison-preview.webp) · [Full](silk-strands/comparison-full.webp) · [0.25× strip](silk-strands/after/speaking-025x.webp) |
| Glass Ribbon | 0.6 → 0.5 | 0.7 → 0.5 | [Preview](glass-ribbon/comparison-preview.webp) · [Full](glass-ribbon/comparison-full.webp) · [0.25× strip](glass-ribbon/after/speaking-025x.webp) |
| Liquid Glass | 0.5 → 0.5 | 0.4 → 0.4 | [Preview](liquid-glass/comparison-preview.webp) · [Full](liquid-glass/comparison-full.webp) · [0.25× strip](liquid-glass/after/speaking-025x.webp) |

## Lumen Orb

**Root cause.** Layered simplex noise drove sine bands, filaments and surface displacement across the orb.\
**Fix.** A 1.45-IOR studio refraction pass, edge-only thin film and a spring-driven luminous core make up the glass.\
**Verified.** All eight captures show a smooth interior. The speaking strip shows the core brightening and expanding without contour lines.\
**Still weak:** Canvas2D approximates the studio reflection with a gradient.

## Silk Strands

**Root cause.** Large lane-dependent offsets and two superimposed translucent surfaces made neighboring strands visually cross and shimmer.\
**Fix.** A single surface of 180 tapered ribbons follows a shared travelling field. Spring-driven amplitude and speed preserve wavelength, and anisotropic highlights follow each tangent.\
**Verified.** The four-state pairs and slow-motion strip show parallel paths, with the final taper removing the visible stipple at both ends.\
**Still weak:** At gallery scale the finest strands blend into the satin sheen.

## Glass Ribbon

**Root cause.** Each travelling hue lane also changed the mask's lift and position.\
**Fix.** One centered mask feeds all five colors. Convex sampling, stronger rim dispersion, a softbox, caustic, bevel and fine dust add depth.\
**Verified.** Across 261 replay frames, 214 had a visible ribbon and measured 0.00000000% maximum horizontal deviation at reported precision. The Chromium lab measured SSIM 0.5079 → 0.5097 for entry and 0.3930 → 0.4063 for steady state. Both pass the 0.0200 absolute regression tolerance for this fix.\
**Still weak:** The color-weighted highlight can appear off-center as hues travel inside the centered mask.

The [first post-fix timing sample](glass-ribbon/after/timing-first-run.json) recorded 3.8 ms preview and 3.2 ms full CPU p95 while holding 60.08 FPS. The table uses the [isolated repeat](glass-ribbon/after/timing.json) at 60 FPS.

## Liquid Glass

**Root cause.** A CSS-backed capsule and a separate WebGL capsule used different transforms and could expose two rims.\
**Fix.** One canvas draws one spring-driven lens. Its WebGL pass samples the supplied media through a chromatic rim band and softened backdrop.\
**Verified.** The structure test counts one capsule in both layouts and tiers. [WebGL](liquid-glass/after/liquid-glass-webgl-single-capsule.png) and [Canvas2D](liquid-glass/after/liquid-glass-canvas-single-capsule.png) screenshot tests found one continuous silhouette. A test plate changed center-band RGB by 43.46, 43.13 and 41.36 out of 255 in Chromium, Firefox and WebKit respectively. [View the refracted test plate](liquid-glass/after/media-optics-full.png).\
**Still weak:** Live DOM content requires an explicit image, video, or canvas backdrop. Without one, the lens reflects its procedural studio.

Run the structural checks with `npm test`. With Playwright available and the development server running, execute `node scripts/verify-liquid-glass-visual.mjs http://localhost:3127` for the single-capsule screenshot check.
