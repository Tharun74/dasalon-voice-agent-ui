# Phase 1 motion reviews

Both presets were tuned in the Audio Lab with the same [LibriSpeech recording](https://www.openslr.org/12). I compared the agent and user turns, replayed an attenuated copy at 12% volume, and tested the microphone path with a browser-injected recording.

## Lumen Orb

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
