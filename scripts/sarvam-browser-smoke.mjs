import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.VOICE_BENCH_URL ?? 'http://localhost:3127';
const browser = await chromium.launch({ channel: process.env.VOICE_BENCH_BROWSER || undefined });
const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const captions = page.getByTestId('captions');
const state = name => page.locator(`[data-testid="voice-state"][data-state="${name}"]`);
const priceQuestion = () => page.getByRole('button', { name: 'Try the price question' }).click();

try {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Test permission denied', 'NotAllowedError'));
  });
  await page.goto(`${base}/lab/sarvam`, { timeout: 60_000 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360);
  await page.getByRole('button', { name: 'Enable mic' }).click();
  await page.getByText('Microphone access is unavailable. You can type instead.').waitFor();

  await page.route('**/api/voice/tts', route => route.fulfill({ status: 502 }));
  await priceQuestion();
  await captions.getByText('Cut and shape starts at $85.').waitFor();
  await page.getByText('Audio is unavailable for part of this reply. Read the captions below.').waitFor();
  await page.unroute('**/api/voice/tts');

  await page.route('**/api/voice/chat', route => route.abort('internetdisconnected'), { times: 1 });
  await priceQuestion();
  await state('error').waitFor();
  await priceQuestion();
  await state('speaking').waitFor();
  await page.getByRole('button', { name: 'Interrupt' }).click();
  await state('idle').waitFor();
  await page.getByRole('button', { name: 'Delete conversation' }).click();
  await captions.locator('li').first().waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
  console.log('Browser smoke passed: 360 px layout, mic denial, typed fallback, TTS failure, network retry, interruption and deletion.');
} finally {
  await browser.close();
}
