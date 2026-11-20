# Phase 1 motion reviews

## Engine contract

- Listening uses the user’s input envelope for inward motion. Speaking uses the agent’s output envelope for outward motion. Existing shapes can carry momentum across a turn; the opposite channel cannot drive them.
- Listening lights the edge over 200 ms before the contraction eases in. State requests require 75 ms of persistence and 145 ms of dwell. Returning to idle from a speech turn requires 600 ms, with a low anticipation level during the hold.
- Barge-in applies a recoil impulse before the listening ramp begins. RMS and peak drive the body and onset packets, and bands drive material detail. Ordinary syllables are nearly critically damped. Emphatic onsets can overshoot.
- Speech accelerates a moving phase through time integration. Each preset has a unique idle period and amplitude in `IDLE_RHYTHMS`.

Both presets were tuned in the Audio Lab with the same [LibriSpeech recording](https://www.openslr.org/12). I compared the agent and user turns, replayed an attenuated copy at 12% volume, and tested the microphone path with a browser-injected recording.

## Lumen Orb

**Directional mapping.** User input contracts the shell after the Fresnel rim lights. Agent output expands the shell and sends pressure rings outward along its surface.

1. **Listening was too close to idle.** The old intake caused a small uniform shrink. The new spring draws the glass inward, calms its displacement, and leans the lit rim toward the user.
2. **Speaking made the whole surface undulate at once.** Low bands now carry the mass. Up to three syllable packets move up the glass, with treble and spectral centroid confined to the highlights.
3. **Turn changes felt like the material lost momentum.** Shader phase is now integrated from spring velocity. Barge-in dents the shell briefly, then it rebounds into the listening pose.

| Parameter | Before | After |
| --- | ---: | ---: |
| RMS attack / release | 45 / 190 ms | 22 / 235 ms |
| Body stiffness / damping | None | 315 / 22 |
| Listening intake scale | 0.16 | 0.23 |
| Speaking expansion scale | 0.10 | 0.15 |
| Gain / output lookahead | Fixed / 0 ms | Adaptive × 1.06 / 38 ms |

## Silk Strands

**Directional mapping.** User input gathers the lanes toward the center seam after the outer edges light. Agent output opens the ribbon bundle and carries folds from the anchored root toward the free ends.

1. **The ribbon narrowed without visibly gathering.** The listening spring now groups the middle lanes and reduces the depth spread while keeping the original ribbon path and satin finish.
2. **Speaking bent the entire ribbon like a single flag.** The root stays anchored while onset packets travel down slightly staggered lanes. Bass carries the slower fold and treble moves the specular detail.
3. **Between words, highlights followed body motion too closely.** A slower body release lets the ribbon finish its swing. Bright accents follow a shorter independent envelope. On interruption, the loose end recoils while the root stays planted.

| Parameter | Before | After |
| --- | ---: | ---: |
| RMS attack / release | 45 / 190 ms | 27 / 278 ms |
| Body stiffness / damping | None | 260 / 22 |
| Listening width coefficients | 0.34 + 0.13 × taper | 0.55 + 0.24 × taper |
| Speaking deformation | Full-span oscillator | Root-anchored wave and syllable packets |
| Gain / output lookahead | Fixed / 0 ms | Adaptive × 1.12 / 44 ms |

## Review

**8.5/10 for the reference pair.** Lumen has the clearest state change without labels. Silk’s soft consonants were the weakest signal on the first pass. I lowered the onset threshold, added a refractory interval, and checked the quiet clip again. The gallery’s remaining six presets use the shared signal engine and still need the individual motion pass in Phase 2.

Buffered recordings and the demo can be sampled ahead. Microphones and live provider streams use a bounded slope prediction for output compensation because future samples have yet to arrive. Frame-rate measurements are specific to the tested browser and GPU.

## Silk Strands speaking refinement

Narrow onset peaks stacked into sharp bends. The revised wave spreads across more of each strand, travels more slowly and compresses overlapping peaks. The body spring settles more gently between syllables, and treble adds a smaller change to the satin highlight.

| Parameter | Before | After |
| --- | ---: | ---: |
| RMS attack / release | 27 / 278 ms | 36 / 315 ms |
| Body stiffness / damping | 260 / 22 | 220 / 27 |
| Syllable ripple travel / fade-in | 2.85 lengths/s / 40 ms | 1.85 lengths/s / 85 ms |
| Treble highlight multiplier | 0.42 | 0.25 |
| Gain / output lookahead | 1.12 / 44 ms | 1.03 / 40 ms |

## Phase 1 checkpoint

- **Lumen Orb · 8.5/10.** With labels hidden, the orb holds a smaller silhouette during listening and pushes rounded ridges outward on speech. The brighter rim makes emphasized syllables easy to spot.
- **Silk Strands · 8/10.** The gathered listening pose and larger speaking folds read clearly in motion. Dense strands produced the strongest visible shimmer in the review. Screen-space edge feathering and a matching satin layer reduced dark gaps at the folds while preserving the individual fibers.
- **Audio Lab.** Opposite-polarity stereo had canceled out when samples were averaged before analysis. The Lab now measures power per channel and takes one FFT on the strongest. Browser checks covered real speech at the original level and at 12% volume, a stereo copy with inverted polarity, and Chrome microphone input driven by the same recording. The selected speech direction survives decoding, and changing presets while paused refreshes the signal view.
- **Performance.** Steady WebGL playback in Chrome on integrated AMD Radeon graphics measured 136 FPS for Lumen and 143 FPS for Silk. The recording-swap test showed short dips. The 360 px reduced-motion browser check passed. Physical mobile frame rates are unmeasured.

## Scenario review

The Audio Lab scenarios run on the same clock as the preset so pause, step and replay keep the timeline aligned with the signal. The hesitation scenario inserts 460 ms of requested idle during a phrase. Recovery tests a complete release followed by a 45 ms noise burst. The overlap scenario runs both channels together. Quiet and loud use the same simulated user phrase at 13% and 380% gain.

At 1 ms simulation steps, recoil reached its peak at 69 ms for Lumen and 76 ms for Silk. Their idle rhythms are 5.2 s and 6.8 s respectively, with Silk breathing at 72% of Lumen’s amplitude.

## Phase 2 motion reviews

### Mirror
- Problem. Reflections changed direction inside an almost stationary frame.
- Fix. The brass lip lights first, and the shared impulse makes the frame pull back on interruption.
- Direction. User input contracts the frame and pulls reflections toward the center. Agent output expands it and sends ripples outward.

### Bloom
- Problem. Small petal movements made the two speech directions hard to distinguish at a glance.
- Fix. Petal tips catch the attention light and the recoil closes the outer whorl first.
- Direction. User input cups the petals inward. Agent output opens the whorls and scatters pollen.

### Prism Halo
- Problem. Individual spectrum spikes dominated the silhouette.
- Fix. The inner rail lights first and the ring kicks inward on interruption. Spectrum detail follows the output envelope.
- Direction. User input gathers the orbit and bows the crystals inward. Agent output expands the ring and raises the facets.

### Stardust
- Problem. The orbit stayed relatively dim on entry and recoil followed the slower state blend.
- Fix. Outer grains light before focus and the shared recoil compresses the particle field immediately.
- Direction. User input draws particles toward the core. Agent output sends the cloud into expanding eddies.

### Dock Pill
- Problem. Both audio channels increased waveform height, which made listening and speaking look alike.
- Fix. The border lights before the waveform gathers, and the pill shortens briefly on interruption.
- Direction. User input tightens the pill and compresses its waveform. Agent output stretches the body and lifts the waveform.

### Contour
- Problem. Fixed-rate waves masked the turn, and interruption looked like a slow rotation change.
- Fix. Highlights climb the rails before the knot gathers. The roll follows integrated phase and the shared recoil pulls the knot back.
- Direction. User input packs the rails into the center. Agent output fans the rails and opens the spaces between them.

## Phase 3 motion reviews

| Preset | Inward and outward mapping | Review |
| --- | --- | --- |
| Mercury | User input gathers the chrome. Agent output stretches the shoulder until droplets detach. | Cooler reflections and deeper dark bands give the metal a clearer edge. |
| Aurora Veil | User input folds the light curtains together. Agent output spreads them and drives flares down the seams. | Lower emission exposure keeps the jade, rose and blue layers visible in brighter passages. |
| Ink in Water | User input tightens the dye field around the source. Agent output adds dye and drives outward eddies. | Stronger counter-rotating vortices, vorticity confinement and smaller dye injectors preserve more detail. Strong output still makes the edges softer than the other new presets. |
| Silk Veil | User input gathers the pinned sheet. Agent output opens the hem and inflates the cloth with wind. | The single cloth silhouette distinguishes it from Silk Strands. Side light picks out the folds and the attention cue runs along the hem. |

Chrome verified all seven scenarios, both label-free directional comparisons, pause, frame step and replay. The 360 px viewport and reduced-motion checks passed. Quiet and loud scenario samples measured raw RMS of 0.0096 and 0.5312 and smoothed RMS of 0.293 and 0.847. Uploaded speech preserved the expected direction for both presets. Steady demo playback measured 135 FPS for Lumen and 142 FPS for Silk on the integrated AMD GPU. Recording playback and capture showed intermittent dips below 60 FPS in this run.
