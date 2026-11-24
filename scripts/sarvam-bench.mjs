import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const base = process.env.VOICE_BENCH_URL ?? 'http://localhost:3127';
const runs = Math.max(2, Math.min(20, Number(process.env.VOICE_BENCH_TURNS) || 8));
const live = process.argv.includes('--live');
if (live && !process.env.VOICE_BENCH_WAV) throw new Error('Set VOICE_BENCH_WAV to a consented WAV recording of a salon question.');
const mockClips = JSON.parse(await readFile(new URL('../server/voice/mock-clips.json', import.meta.url), 'utf8'));
const fixture = process.env.VOICE_BENCH_WAV
  ? { wav: (await readFile(process.env.VOICE_BENCH_WAV)).toString('base64') }
  : { pcm: gunzipSync(Buffer.from(mockClips['en-IN:greeting:1'], 'base64')).toString('base64'), rate: 8000 };
const browser = await chromium.launch({
  channel: process.env.VOICE_BENCH_BROWSER || undefined,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const values = [];
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const field = stage => page.locator(`[data-metric="${stage}"]`);
const state = name => page.locator(`[data-testid="voice-state"][data-state="${name}"]`);

try {
  await page.addInitScript(speech => {
    let context;
    let feed;
    let clip;
    navigator.mediaDevices.getUserMedia = async () => {
      context = new AudioContext();
      await context.resume();
      feed = context.createMediaStreamDestination();
      if (speech.wav) {
        clip = await context.decodeAudioData(Uint8Array.from(atob(speech.wav), b => b.charCodeAt(0)).buffer);
      } else {
        const bytes = atob(speech.pcm);
        clip = context.createBuffer(1, bytes.length, speech.rate);
        const row = clip.getChannelData(0);
        for (let i = 0; i < row.length; i++) row[i] = (bytes.charCodeAt(i) - 128) / 128;
      }
      return feed.stream;
    };
    window.playVoiceBenchmark = () => {
      const source = context.createBufferSource();
      source.buffer = clip;
      source.connect(feed);
      const start = context.currentTime + 0.06;
      source.start(start);
      const row = clip.getChannelData(0);
      let voiced = row.length - 1;
      while (voiced > 0 && Math.abs(row[voiced]) < 0.012) voiced--;
      return performance.now() + (start - context.currentTime + voiced / clip.sampleRate) * 1000;
    };
    const samples = [];
    const read = () => {
      const field = document.querySelector('[data-metric="first-sample"]');
      const stt = document.querySelector('[data-metric="stt-final"]');
      if (field && stt && /^\d+$/.test(field.textContent) && /^\d+$/.test(stt.textContent)) {
        if (!samples.length || samples.at(-1).reset) samples.push({ at: performance.now() });
      } else if (samples.length) samples.at(-1).reset = true;
    };
    document.addEventListener('DOMContentLoaded', () => new MutationObserver(read).observe(document.body, {
      subtree: true, childList: true, characterData: true,
    }));
    window.voiceBenchmarkSamples = samples;
  }, fixture);

  await page.goto(`${base}/lab/sarvam`, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Enable mic' }).click();
  await page.getByTestId('voice-mode').filter({ hasText: live ? 'Sarvam AI' : 'MockSarvam' }).waitFor({ timeout: 30_000 });
  await page.getByTestId('captions').locator('[data-speaker="agent"][data-final="true"]').first().waitFor();
  await state('idle').waitFor();

  for (let run = 0; run <= runs; run++) {
    if (live && run > 0) await page.waitForTimeout(2500);
    const speechEnd = await page.evaluate(() => window.playVoiceBenchmark());
    await state('listening').waitFor();
    await page.waitForFunction(run => window.voiceBenchmarkSamples.length > run, run, { timeout: 25_000 });
    const sample = await page.evaluate(run => window.voiceBenchmarkSamples[run].at, run);
    const valid = value => {
      const result = Number(value);
      if (!Number.isFinite(result)) throw new Error(`Missing benchmark metric: ${value}`);
      return result;
    };
    const times = Object.fromEntries(await Promise.all(
      ['stt-final', 'llm-first-token', 'sentence-ready', 'tts-first-chunk', 'first-sample']
        .map(async stage => [stage, valid(await field(stage).textContent())]),
    ));
    const endToEnd = Math.round(sample - speechEnd);
    const vad = endToEnd - times['first-sample'];
    if (run) values.push({
      'Silence gate': vad,
      'STT final': times['stt-final'] + vad,
      'LLM first token': times['llm-first-token'] + vad,
      'First checked sentence': times['sentence-ready'] + vad,
      'First TTS chunk': times['tts-first-chunk'] + vad,
      'First output sample': endToEnd,
    });
    await state('idle').waitFor();
  }
  if (errors.length) throw new Error(errors.join('\n'));
} catch (error) {
  const status = await page.getByTestId('voice-state').textContent({ timeout: 1000 }).catch(() => 'page not ready');
  const messages = await page.getByRole('status').allTextContents();
  console.error('Playground status', status, messages, errors);
  throw error;
} finally {
  await browser.close();
}

function percentile(array, p) {
  return array.toSorted((a, b) => a - b)[Math.ceil(p * array.length) - 1];
}
console.log(`${live ? 'Live Sarvam' : 'Local MockSarvam'} · ${values.length} measured microphone turns · milliseconds from fixture’s last voiced sample`);
console.table(Object.keys(values[0]).map(stage => {
  const samples = values.map(row => row[stage]);
  return { stage, p50: percentile(samples, 0.5), p95: percentile(samples, 0.95) };
}));
console.log('Output timing comes from AudioContext.getOutputTimestamp with a browser clock fallback. No physical speaker measurement.');
