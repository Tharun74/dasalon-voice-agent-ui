# Sarvam voice pipeline · Phase 1

## Live documentation notes

1. Sarvam's index separates task guides, API contracts and SDK references. The server sends the `api-subscription-key` header. [Index](https://docs.sarvam.ai/llms.txt) · [Authentication](https://docs.sarvam.ai/api-reference/authentication.md)
2. `bulbul:v3` with `shubh` is the compatibility default here. `bulbul:v4-flash` is newer and has its own speaker IDs, such as `shubh_enhi_ads`. v2 is outside the current stream contract. [Streaming TTS](https://docs.sarvam.ai/api-reference/text-to-speech/convert-stream.md)
3. TTS supports Bengali, English, Gujarati, Hindi, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil and Telugu through the corresponding `-IN` codes. Verify the speaker against the selected model. [TTS contract](https://docs.sarvam.ai/api-reference/text-to-speech/convert.md)
4. REST TTS accepts up to 2,500 characters and returns base64 audio. HTTP streaming accepts up to 3,500 and streams bytes. The player uses 24 kHz mono `linear16` PCM. [REST](https://docs.sarvam.ai/api-reference/text-to-speech/convert.md) · [HTTP streaming](https://docs.sarvam.ai/api-reference/text-to-speech/convert-stream.md)
5. The TTS WebSocket uses config, text, flush and audio messages with optional completion events. Its browser subprotocol can carry a credential, so this integration keeps the provider connection on the server. [TTS WebSocket](https://docs.sarvam.ai/api-reference/text-to-speech/stream.md)
6. Saaras REST STT uses multipart audio and supports WAV. `saaras:v4` is current, accepts clips up to 30 seconds and supports automatic language detection. [STT REST](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe.md)
7. New Saaras realtime STT uses `/speech-to-text-realtime/ws` with `audio_input`, `end`, `transcript.partial` and `transcript.final`. Its server VAD requires a persistent stream. Legacy `/speech-to-text/ws` is a separate API. [Realtime guide](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/realtime-streaming.md)
8. The V2 chat API accepts `sarvam-105b-conversations` and `sarvam-105b`, supports strict JSON Schema, function calls and token SSE ending in `[DONE]`. [Chat V2](https://docs.sarvam.ai/api-reference/chat/chat-completions-v2.md)
9. The JavaScript package is `sarvamai` with `SarvamAIClient`. The implementation uses server-side fetch to propagate abort signals and stream PCM directly. [SDK](https://docs.sarvam.ai/api/getting-started/sdks.md)
10. Pay-as-you-go documentation lists 60 requests/minute each for REST STT, HTTP TTS and Sarvam 105B chat, plus 20 concurrent STT WebSockets. Account limits are shared and provider 429s can reflect quota or rate limits. [Limits](https://docs.sarvam.ai/api/getting-started/pricing.md)

## Architecture decision

- Next.js Node route handlers keep all provider credentials and text approval on the server and support SSE and PCM over HTTP.
- The serverless path uses bounded WAV submissions with client VAD and optional snapshot captions. It adds latency and one billable transcription per live snapshot.
- A persistent Node deployment can host a same-origin WebSocket gateway to Saaras Realtime for continuous partials. The playground and HTTP service run under either Vercel or `npm run build && npm start` with Node.

## Local and production setup

Run `npm install && npm run dev` and visit `/lab/sarvam`. With no key, MockSarvam runs behind the same four routes. Every microphone recording returns a fixed sample question. The mock uses 102 generated PCM speech fixtures across English, Hindi and Tamil.

To enable live calls, set the server variables in `.env.example`. Create a fresh provider key and a different random value of at least 32 characters for `SESSION_SECRET`. Locally put them in the ignored `.env.local` file. On Vercel mark both as sensitive Project Environment Variables for the intended environment, then deploy with Node route handlers. Set `SESSION_SECRET` for multi-instance mock deployments too. On a persistent Node host use the same environment variables and `npm run build && npm start`. Route limits, the in-memory TTS cache and the last three topic IDs are process-local in this phase. [Sarvam dashboard](https://indus.sarvam.ai/key-management)

The default live path makes up to two additional bounded STT snapshot requests per longer turn. Set `SARVAM_STT_SNAPSHOTS=false` to use final-only transcription. Every model request is bounded and the app reserves a provider call against its process-local budget before dispatching it. Short approved sentences can start TTS before the complete reply is ready. Provider pricing depends on clip duration, text length, tokens and model. [Sarvam pricing and limits](https://docs.sarvam.ai/api/getting-started/pricing.md)

The browser grants mic access only from an explicit action. Local audio buffers are discarded after the request, and the app stores no raw recordings or transcript text on the server. Inputs sent in live mode are processed by Sarvam. Deleting the conversation clears browser captions, discards the session credentials and stops the mic. The server retains short-lived counters and salon-topic IDs.

## Adapter boundary

Use `SarvamAdapter` from `@dasalon/voice-agent-ui/sarvam` as the `adapter` prop of any preset. Call `start()` from a user click after showing the mic notice. `sendText()` is available without permission. `mute()` disables the microphone track, `interrupt()` stops the current reply, `setLanguage()` sets a preference, and `stop()` releases the mic and playback context. `deleteConversation()` drops the local session and captions.

The live classifier chooses a salon fact. The streaming model may only request that fact through a validated tool. The server authorizes each vetted sentence individually and the TTS route accepts only a signed grant for its exact ID and index. Phase 1 answers about appointment requests and cancellations by directing visitors to the salon team. The fictitious salon has no published hours, address, staff list or real contact number in the current config.

Auto-detection passes the provider’s language through to the supported speech templates. English, Hindi and Tamil have vetted templates here and other codes fall back to English. When the mic reports echo cancellation active, automatic barge-in uses an output-dependent residual gate and a short speaking-state VAD confirmation. Otherwise the user can use the Interrupt button. Room-acoustic echo and live provider latency remain to be measured.

Mock audio was generated from the repository's own dialogue with [eSpeak NG](https://github.com/espeak-ng/espeak-ng). Only the generated audio is included. To regenerate after changing the responses, run `node --import tsx scripts/sarvam-mock-audio.mjs` with `VOICE_ESPEAK_MODULE` pointing to the external eSpeak NG JavaScript module and `VOICE_FFMPEG` pointing to FFmpeg.

## Verification commands

- `npm test` checks session signing, Zod, quotas, sentence segmentation, the Sarvam wire contract against a stub, and the mock pipeline, including cancellation and pause handling.
- `npm run eval:guardrails` runs the labeled cases without credentials. `npm run eval:guardrails:live` reads `SARVAM_API_KEY` from the shell or `.env.local` and uses provider quota.
- `npm run test:sarvam:browser` exercises mock UI failures and recovery at 360 CSS pixels. `npm run bench:sarvam` measures the microphone pipeline with a scripted audio fixture.
- For browser commands, run the app and install Chromium via `npx playwright install chromium` or set `VOICE_BENCH_BROWSER=msedge` to use installed Edge. The scripts default to port 3127. Set `VOICE_BENCH_URL` for another origin. To measure live speech, point to a server with credentials, set `VOICE_BENCH_WAV` to a consented WAV of an on-topic question, and run `npm run bench:sarvam -- --live`.

## Phase 1 results

The production build, 29 automated tests and the 360px browser smoke passed. The browser exercised permission denial, typed fallback, failed TTS, dropped chat, retry, interruption and local deletion. The barge-in test measures 60 ms of VAD confirmation plus 55 ms of scheduled audio fade. It does not measure acoustic latency.

| Mock guardrail group | Passed / total |
| --- | ---: |
| Injection and secret requests | 42 / 42 |
| Off-topic with salon redirect | 46 / 46 |
| Grounded on-topic answer | 66 / 66 |
| Sensitive | 10 / 10 |
| Abusive | 6 / 6 |
| Small talk | 6 / 6 |
| Unclear | 5 / 5 |

No failures remained in the 181-case deterministic mock run. The live evaluator and real end-to-end provider calls were outside verification because the server environment had no rotated key. The REST/SSE request shapes were checked with a stubbed upstream against the live API references above.

### Local MockSarvam latency

Eight measured microphone turns after one warm-up, using Chromium through Edge on this Windows machine against a production Next.js build. Timings are cumulative milliseconds from the fixture’s last voiced sample. The output timestamp is a Web Audio estimate.

| Stage | p50 ms | p95 ms |
| --- | ---: | ---: |
| Silence gate | 742 | 751 |
| STT final | 833 | 855 |
| First LLM token event | 913 | 960 |
| First approved sentence | 915 | 976 |
| First TTS chunk | 1,004 | 1,085 |
| First output sample | 1,105 | 1,200 |

Mock timings characterize the browser and local service, including turn detection and output scheduling. Provider processing, network latency and room acoustics require live measurement.
