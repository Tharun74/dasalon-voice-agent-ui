import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const source=process.argv[2]||process.env.VOICEKIT_REFERENCE_VIDEO;
if (source) {
  const input=resolve(source);
  const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,nb_frames,avg_frame_rate','-of','json',input],{encoding:'utf8'});
  if (probe.error) throw new Error('Install FFmpeg with ffprobe to extract the reference frames.',{cause:probe.error});
  if (probe.status!==0) throw new Error(probe.stderr.trim()||'The reference video could not be opened.');
  const [track]=JSON.parse(probe.stdout).streams;
  if (track?.width!==720||track.height!==720||track.nb_frames!=='261'||track.avg_frame_rate!=='14671/500') {
    throw new Error('Expected the supplied 720×720, 261-frame reference at 29.342 FPS.');
  }
  const folder=resolve('public','ref-frames');
  await mkdir(folder,{recursive:true});
  const extraction=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',input,'-map','0:v:0',
    '-fps_mode','passthrough',resolve(folder,'f_%03d.png')],{stdio:'inherit'});
  if (extraction.error||extraction.status!==0) throw new Error('FFmpeg failed to extract the supplied video.',{cause:extraction.error});
  console.log('Extracted 261 local reference frames to public/ref-frames.');
}
