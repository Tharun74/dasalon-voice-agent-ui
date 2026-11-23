'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DemoAdapter } from '@/src/adapters/demo';
import { MotionEngine } from '@/src/motion';
import { lazyScene } from '@/src/presets/load-scene';
import { paintRibbonCanvas } from '@/src/presets/glass-ribbon-canvas';
import { REFERENCE_FPS, REFERENCE_LAST, frameTime, updateRibbon } from '@/src/presets/glass-ribbon-timeline';
import type { RibbonStage } from '@/src/presets/glass-ribbon-timeline';
import type { RibbonSceneInputs } from '@/src/presets/scenes/glass-ribbon';
import type { MountedScene } from '@/src/presets/webgl';
import { entryTimings, framing, measureFrame, paintDifference, referenceStage, referenceTimeText } from './metrics';
import type { FrameReport } from './metrics';

const visual=lazyScene(()=>import('@/src/presets/scenes/glass-ribbon'));
const range=(from:number,to:number)=>Array.from({length:to-from+1},(_,i)=>i+from);
const frames=range(14,239);
const palette={glow:'#edaaae',highlight:'#f9e0cf',shadow:'#993843'};

type Surfaces = { ref:HTMLCanvasElement; ours:HTMLCanvasElement; difference:HTMLCanvasElement };
interface Rig {
  scene?:MountedScene;
  effect:HTMLCanvasElement;
  background:HTMLCanvasElement;
  baseline:HTMLImageElement;
  inputs:RibbonSceneInputs;
}
function context(canvas:HTMLCanvasElement) { return canvas.getContext('2d',{willReadFrequently:true})!; }

function imageAt(frame:number,signal:AbortSignal) {
  return new Promise<HTMLImageElement>((resolve,reject)=>{
    const image=new Image();
    const cancel=()=>{detach();image.removeAttribute('src');reject(new DOMException('Canceled','AbortError'));};
    function detach(){image.onload=null;image.onerror=null;signal.removeEventListener('abort',cancel);}
    if(signal.aborted){cancel();return;}
    signal.addEventListener('abort',cancel,{once:true});
    image.onload=()=>{detach();resolve(image);};
    image.onerror=()=>{detach();reject(new Error('The local reference frames are unavailable.'));};
    image.src='/ref-frames/f_'+String(frame).padStart(3,'0')+'.png';
  });
}

function setSize(canvas:HTMLCanvasElement,width:number,height:number){
  if(canvas.width!==width)canvas.width=width;
  if(canvas.height!==height)canvas.height=height;
}

async function draw(rig:Rig,stage:RibbonStage,frame:number,signal:AbortSignal,target:Surfaces,showDifference:boolean) {
  const {effect,background,inputs}=rig;
  const original=await imageAt(frame,signal);
  if(signal.aborted)throw new DOMException('Canceled','AbortError');
  const crop=framing;
  const {width,height}=crop;
  for(const canvas of [effect,background,target.ref,target.ours,target.difference])setSize(canvas,width,height);
  const ref=context(target.ref), ours=context(target.ours), work=context(effect), plate=context(background);
  ref.clearRect(0,0,width,height);
  ref.drawImage(original,crop.x,crop.y,width,height,0,0,width,height);
  plate.clearRect(0,0,width,height);
  plate.drawImage(rig.baseline,crop.x,crop.y,width,height,0,0,width,height);
  const t=frameTime(frame);
  updateRibbon(stage,t,t,'replay',undefined,1,false,42);
  stage.backdrop=background;
  inputs.ribbon=stage;
  if(!rig.scene?.render(work,width,height,inputs))paintRibbonCanvas(work,stage,1);
  await Promise.resolve();
  ours.clearRect(0,0,width,height);
  ours.drawImage(background,0,0);
  ours.drawImage(effect,0,0);
  const before=ref.getImageData(0,0,width,height);
  const after=ours.getImageData(0,0,width,height);
  if(showDifference)paintDifference(context(target.difference),before,after);
  return measureFrame(before,after,frame);
}

function Summary({ rows }: { rows:FrameReport[] }) {
  return <table className="w-full text-left text-xs">
    <thead className="bg-card"><tr>{['Frames','Mean SSIM','Mean RGB error'].map(label=><th key={label} scope="col" className="px-3 py-2.5">{label}</th>)}</tr></thead>
    <tbody>{([['Entry',14,59],['Steady',60,239]] as const).map(([label,start,end])=>{
      const group=rows.filter(row=>row.frame>=start&&row.frame<=end);
      const average=(name:'ssim'|'colorError')=>group.length?group.reduce((total,row)=>total+row[name],0)/group.length:0;
      return <tr key={label} className="border-t" data-range={label}>
        <th scope="row" className="px-3 py-2.5">{label} {start}–{end}</th>
        <td className="px-3 font-mono" data-ssim={average('ssim').toFixed(4)}>{group.length?average('ssim').toFixed(4):'—'}</td>
        <td className="px-3 font-mono">{group.length?average('colorError').toFixed(2)+' / 255':'—'}</td>
      </tr>;
    })}</tbody>
  </table>;
}

function download(rows:FrameReport[]) {
  const names=['frame','ssim','colorError','horizon','rim','sliver','hue'] as const;
  const csv=[names.join(','),...rows.map(row=>names.map(key=>row[key]??'').join(','))].join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  const a=document.createElement('a');
  a.href=url;a.download='glass-ribbon-frames.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function GlassRibbonReference() {
  const [frame,setFrame]=useState(145);
  const [playing,setPlaying]=useState(false);
  const [running,setRunning]=useState(false);
  const [progress,setProgress]=useState(0);
  const [rig,setRig]=useState<Rig>();
  const [report,setReport]=useState<FrameReport>();
  const [rows,setRows]=useState<FrameReport[]>([]);
  const [error,setError]=useState('');
  const [renderer,setRenderer]=useState('');
  const reference=useRef<HTMLCanvasElement>(null);
  const result=useRef<HTMLCanvasElement>(null);
  const difference=useRef<HTMLCanvasElement>(null);
  const job=useRef<AbortController|null>(null);
  const preview=useRef<AbortController|null>(null);

  useEffect(()=>{
    const init=new AbortController();
    let scene:MountedScene|undefined;
    async function prepare() {
      const baseline=await imageAt(14,init.signal);
      try { scene=await visual(document,42,init.signal); } catch { /* Offscreen Canvas2D is the supported fallback. */ }
      if(init.signal.aborted){scene?.dispose();return;}
      const motion=new MotionEngine(new DemoAdapter(),'glass-ribbon').peek();
      const inputs:RibbonSceneInputs={motion,palette,intensity:1,quality:1,ribbon:referenceStage()};
      setRenderer(scene?'WebGL2':'Canvas2D');
      setRig({scene,baseline,effect:document.createElement('canvas'),background:document.createElement('canvas'),inputs});
    }
    void prepare().catch(problem=>{if(!init.signal.aborted)setError(String(problem.message??problem));});
    return ()=>{init.abort();job.current?.abort();preview.current?.abort();scene?.dispose();};
  },[]);

  useEffect(()=>{
    if(!rig||running||!reference.current||!result.current||!difference.current)return;
    const request=new AbortController();
    preview.current=request;
    const surfaces={ref:reference.current,ours:result.current,difference:difference.current};
    let next:ReturnType<typeof setTimeout>|undefined;
    const started=performance.now();
    void draw(rig,referenceStage(),frame,request.signal,surfaces,true).then(value=>{
      if(request.signal.aborted)return;
      setReport(value);
      if(playing)next=setTimeout(()=>setFrame(i=>i>=REFERENCE_LAST?1:i+1),Math.max(0,1000/REFERENCE_FPS-(performance.now()-started)));
    }).catch(problem=>{if(!request.signal.aborted){setError(String(problem.message??problem));setPlaying(false);}});
    return ()=>{request.abort();clearTimeout(next);};
  },[rig,running,frame,playing]);

  async function benchmark(){
    if(!rig||running)return;
    preview.current?.abort();
    setPlaying(false);setRunning(true);setProgress(0);setRows([]);
    const stop=new AbortController();
    job.current=stop;
    try {
      const stage=referenceStage();
      const measured:FrameReport[]=[];
      const doc=rig.effect.ownerDocument;
      const tmp={ref:doc.createElement('canvas'),ours:doc.createElement('canvas'),difference:doc.createElement('canvas')};
      for(const index of frames){
        measured.push(await draw(rig,stage,index,stop.signal,tmp,false));
        if(index%12===0){setProgress(measured.length);await new Promise<void>(resolve=>setTimeout(resolve,0));}
      }
      if(!stop.signal.aborted){setRows(measured);setProgress(measured.length);}
    } catch(problem){
      if(!stop.signal.aborted)setError(problem instanceof Error?problem.message:String(problem));
    } finally { if(job.current===stop){job.current=null;setRunning(false);} }
  }

  const crop=framing;
  const checks=entryTimings();
  const score=(n:number|null|undefined,unit:string,digits=2)=>n==null?'—':n.toFixed(digits)+unit;
  return <main className="site-width space-y-6 py-8 sm:py-12">
    <header className="space-y-2">
      <Link href="/components/glass-ribbon" className="text-xs text-muted-foreground underline underline-offset-4">Glass Ribbon</Link>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Reference lab</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">Original Glass Ribbon beside the supplied animation. Both use the source frame clock. Crops are measured at the source pixel size.</p>
    </header>
    {error?<div role="status" className="rounded-lg border bg-card p-4 text-sm">
      <p>{error}</p>
      <p className="mt-2 text-muted-foreground">Extract your copy of the video with <code className="break-all">npm run reference:frames -- "path-to-video.mp4"</code>, then reload the lab.</p>
    </div>:null}
    <section aria-label="Comparison controls" className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
      <Button type="button" size="sm" variant="outline" disabled={!rig||running} onClick={()=>setPlaying(!playing)}>{playing?'Pause':'Play'}</Button>
      <label className="flex min-w-36 flex-1 items-center gap-3 text-xs">Frame
        <input type="range" value={frame} min={1} max={REFERENCE_LAST} step={1} disabled={running} onChange={event=>{
          setPlaying(false);setFrame(Number(event.target.value));
        }} className="min-w-0 flex-1 accent-[var(--rose)]"/>
      </label>
      <output className="font-mono text-xs text-muted-foreground">{frame} / {REFERENCE_LAST} · {referenceTimeText(frame)}</output>
      <Button type="button" size="sm" disabled={!rig} onClick={running?()=>job.current?.abort():benchmark}>{running?'Cancel measurement':'Measure frame ranges'}</Button>
      {rows.length?<Button type="button" size="sm" variant="outline" onClick={()=>download(rows)}>Download CSV</Button>:null}
    </section>
    <section aria-label="Frame comparison" className="grid gap-3 sm:grid-cols-3">
      {([['Reference',reference],['Glass Ribbon',result],['Absolute RGB difference',difference]] as const).map(([name,ref])=>
        <figure key={name} className="overflow-hidden rounded-lg border bg-card">
          <figcaption className="border-b px-3 py-2 text-xs font-medium">{name}</figcaption>
          <div className="grid min-h-36 place-items-center bg-zinc-950 p-3">
            <canvas ref={ref} width={crop.width} height={crop.height} aria-label={name} className="block h-auto max-h-64 w-full max-w-sm object-contain" />
          </div>
        </figure>)}
    </section>
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-label="Frame metrics" className="rounded-lg border bg-card p-3.5">
        <h2 className="mb-2 text-sm font-medium">Frame metrics{renderer?' · '+renderer:''}</h2>
        <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-xs" data-frame-report={report?.frame} data-frame-ssim={report?.ssim}>
          <dt>SSIM</dt><dd>{score(report?.ssim,'',4)}</dd>
          <dt>Mean RGB error</dt><dd>{score(report?.colorError,' / 255')}</dd>
          <dt>Horizon error · tolerance 2% of height</dt><dd>{score(report?.horizon,'%')}</dd>
          <dt>Rim error · tolerance 0.5 px</dt><dd>{score(report?.rim,' px')}</dd>
          <dt>Idle sliver error · tolerance 10%</dt><dd>{score(report?.sliver,'%')}</dd>
          <dt>Ribbon hue overlap · 0 to 1</dt><dd>{score(report?.hue,'')}</dd>
        </dl>
        <p className="mt-3 text-[11px] text-muted-foreground">Horizon and hue use bright pixels inside the ribbon area. Rim is an edge-scan estimate. Idle width is measured on frames 250–261 when the sliver registers.</p>
      </section>
      <section aria-label="Range and timing metrics" className="space-y-3 overflow-hidden rounded-lg border bg-card">
        <Summary rows={rows}/>
        {running?<progress aria-label="Frames measured" value={progress} max={frames.length} className="mx-3 h-1.5 w-[calc(100%-1.5rem)]"/>:null}
        <div className="border-t px-3 pb-3 pt-2">
          <h2 className="mb-2 text-sm font-medium">Annotated entry cues</h2>
          <dl className="grid grid-cols-[1fr_auto] gap-1 text-xs">
            {checks.map(cue=><div key={cue.phase} className="contents">
              <dt>{cue.phase}</dt>
              <dd>{cue.reference} → {cue.actual} <span className="text-muted-foreground">({cue.delta>0?'+':''}{cue.delta} fr)</span></dd>
            </div>)}
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">Source frame → authored cue, tolerance 2 frames. Entry SSIM includes the movement into the form crop.</p>
        </div>
      </section>
    </div>
    <p className="text-xs text-muted-foreground">The replay uses the supplied measurements on frames 40–239. Before and after that interval, entry and settling are procedurally authored. The lens is 75 source pixels wide.</p>
  </main>;
}
