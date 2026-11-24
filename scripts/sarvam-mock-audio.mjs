import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { approvedIds, approvedLine, vettedLocales } from '../server/voice/knowledge.ts';
import { normalizeForSpeech, sentenceChunker } from '../server/voice/text.ts';

if (!process.env.VOICE_ESPEAK_MODULE || !process.env.VOICE_FFMPEG) {
  throw new Error('Set VOICE_ESPEAK_MODULE to the espeak-ng module file and VOICE_FFMPEG to the FFmpeg executable.');
}
const { default: espeak } = await import(pathToFileURL(process.env.VOICE_ESPEAK_MODULE).href);
const clips = {};
for (const language of vettedLocales) {
  const voice = language === 'en-IN' ? 'en-us' : language.split('-')[0];
  for (const id of approvedIds) {
    for (const [index, sentence] of sentenceChunker(language).push(approvedLine(id, language), true).entries()) {
      const synthesized = await espeak({ arguments: [
        '-s', '168', '-a', '100', '-v', voice, '-w', 'clip.wav', normalizeForSpeech(sentence, language),
      ] });
      const pcm = execFileSync(process.env.VOICE_FFMPEG, [
        '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ar', '8000', '-f', 'u8', 'pipe:1',
      ], { input: synthesized.FS.readFile('clip.wav') });
      if (!pcm.length) throw new Error(`No audio for ${language} ${id}`);
      clips[`${language}:${id}:${index}`] = gzipSync(pcm).toString('base64');
    }
  }
}
await writeFile(new URL('../server/voice/mock-clips.json', import.meta.url), JSON.stringify(clips, null, 2) + '\n');
console.log(`Generated ${Object.keys(clips).length} speech fixtures`);
