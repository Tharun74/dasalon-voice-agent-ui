'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { DemoAdapter } from '../adapters/demo.js';
import { deltaSeconds } from '../audio.js';
import { MotionEngine, motionTuning, observeMotion } from '../motion.js';
import type { VoiceAgentAdapter } from '../types.js';
import type { PresetProps } from './catalog.js';
import { paintRibbonCanvas } from './glass-ribbon-canvas.js';
import {
  createRibbonPose, ENTRY_DONE, glassSpectrum, updateRibbon, VISUAL_DURATION,
} from './glass-ribbon-timeline.js';
import type { GlassRibbonBackdrop, GlassRibbonDriver, RibbonStage } from './glass-ribbon-timeline.js';
import { lazyScene } from './load-scene.js';
import type { RibbonSceneInputs } from './scenes/glass-ribbon.js';
import type { MountedScene } from './webgl.js';

export type { GlassRibbonBackdrop, GlassRibbonDriver } from './glass-ribbon-timeline.js';

export interface GlassRibbonHandle {
  play(): void;
  exit(): void;
}

export interface GlassRibbonProps extends Omit<PresetProps, 'adapter'> {
  adapter?: VoiceAgentAdapter;
  driver?: GlassRibbonDriver;
  backdrop?: GlassRibbonBackdrop;
  autoplay?: boolean;
  entered?: boolean;
  onEntered?: () => void;
}

const mount = /* @__PURE__ */ lazyScene(() => import('./scenes/glass-ribbon.js'));
const sizeMap = { sm:176,md:300,lg:520 };
const loadingPalette = { glow: '#e8a39a', highlight: '#ffdfc4', shadow: '#a63d65' };

export const GlassRibbon = forwardRef<GlassRibbonHandle,GlassRibbonProps>(function GlassRibbon({
  adapter, driver=adapter?'live':'synthetic', backdrop, autoplay=true, entered, onEntered,
  size='md', quality='preview', theme='rose-gold', seed=42, intensity=1, interactive=true, className, style,
  motion:playback,onPushToTalk,
}, ref) {
  const [demo]=useState(() => new DemoAdapter({manual:true}));
  const signal=adapter??demo;
  const [engine]=useState(() => new MotionEngine(signal,'glass-ribbon'));
  const node=useRef<HTMLCanvasElement>(null);
  const [mode,setMode]=useState<'enter'|'exit'|'hold'>(entered===false||(!autoplay&&entered!==true)?'hold':'enter');
  const time=useRef({ entry: autoplay&&!interactive&&entered!==false?ENTRY_DONE:0, phase:0,
    announced: false, held: false, dirty: true });
  const props=useRef({ signal,driver,backdrop,intensity,playback,onEntered,
    spectrum:glassSpectrum(theme), tuning:motionTuning('glass-ribbon',playback?.tuning) });

  useEffect(() => {
    props.current={signal,driver,backdrop,intensity,playback,onEntered,
      spectrum:glassSpectrum(theme),tuning:motionTuning('glass-ribbon',playback?.tuning)};
    time.current.dirty=true;
  },[signal,driver,backdrop,intensity,playback,onEntered,theme]);

  useEffect(() => {
    if (adapter) return;
    demo.preview(driver==='synthetic'?'speaking':'idle');
    return () => demo.stop();
  }, [adapter,demo,driver]);

  useEffect(() => {
    if (entered !== undefined) setMode(entered?'enter':'exit');
  }, [entered]);
  useEffect(() => {
    if (entered===undefined && autoplay) setMode('enter');
  }, [autoplay,entered]);

  useImperativeHandle(ref,() => ({
    play() {
      time.current.entry=0;
      time.current.phase=0;
      time.current.announced=false;
      time.current.dirty=true;
      setMode('enter');
    },
    exit() { setMode('exit'); },
  }),[]);

  useEffect(() => () => {
    if (time.current.held) {
      time.current.held=false;
      onPushToTalk?.(false);
    }
  },[onPushToTalk]);

  const modeRef=useRef(mode);
  useEffect(() => { modeRef.current=mode; time.current.dirty=true; },[mode]);

  useEffect(() => {
    const canvas=node.current;
    const ctx=canvas?.getContext('2d');
    if (!canvas||!ctx) return;
    const owner=canvas.ownerDocument;
    const cancel=new AbortController();
    let scene:MountedScene|undefined;
    let loaded=false;
    let previousScene:MountedScene|undefined;
    let width=canvas.clientWidth, height=canvas.clientHeight;
    let budget=1, slow=0, fast=0;
    let previousReduced:boolean|undefined;
    let rendererWasSet=false;
    const stage:RibbonStage={pose:createRibbonPose(),width,height,spectrum:props.current.spectrum,full:quality==='full'};
    const inputs:RibbonSceneInputs={motion:engine.peek(),palette:loadingPalette,intensity:1,ribbon:stage};
    const Resize=owner.defaultView?.ResizeObserver;
    const resize=Resize?new Resize(([entry])=>{width=entry.contentRect.width;height=entry.contentRect.height;}):undefined;
    resize?.observe(canvas);
    void mount(owner,seed,cancel.signal).then(result => {
      if(cancel.signal.aborted)result?.dispose();else scene=result;
    }).catch(() => {}).finally(() => { loaded=true; time.current.dirty=true; });

    const stop=observeMotion(canvas,(raw,reduced)=>{
      if(!width||!height)return;
      const current=props.current;
      const t=time.current;
      const dt=deltaSeconds(current.playback?.transport?.advance(deltaSeconds(raw))??raw);
      const active=modeRef.current;
      if (scene && !reduced) {
        slow=raw>.029?slow+1:Math.max(0,slow-2);
        fast=raw<.023?fast+1:0;
        if(slow>=10){budget=Math.max(.54,budget-.15);slow=0;}
        if(fast>=110){budget=Math.min(1,budget+.10);fast=0;}
      }
      const scale=Math.min(owner.defaultView?.devicePixelRatio??1,quality==='preview'?1:2,current.playback?.maxPixelRatio??2)*budget;
      const w=Math.max(1,Math.round(width*scale)), h=Math.max(1,Math.round(height*scale));
      const resized=w!==canvas.width||h!==canvas.height;
      if(resized){canvas.width=w;canvas.height=h;}
      if(previousReduced!==reduced || previousScene!==scene || resized)t.dirty=true;
      if(active==='enter'&&t.entry<ENTRY_DONE)t.entry=Math.min(ENTRY_DONE,t.entry+dt);
      if(active==='exit'&&t.entry>0){
        t.entry=Math.max(0,t.entry-dt*2.6);
        if(t.entry===0){t.announced=false;t.phase=0;}
      }
      const complete=active==='enter'&&(t.entry>=ENTRY_DONE||reduced);
      if(complete&&!t.announced){t.announced=true;current.onEntered?.();}
      if(!dt&&!t.dirty&&rendererWasSet)return;
      if(!adapter)demo.advance(dt);
      if(active==='enter'){
        t.phase+=dt;
        if(current.driver==='replay'&&t.phase>VISUAL_DURATION+.85)t.phase=VISUAL_DURATION+.85;
      }
      const frame=engine.sample(current.signal,dt,reduced,current.tuning);
      inputs.motion=frame;
      inputs.quality=budget;
      stage.width=w;stage.height=h;stage.backdrop=current.backdrop;stage.spectrum=current.spectrum;
      updateRibbon(stage,t.entry,current.driver==='replay'?t.phase:Math.max(0,t.phase-1.33),current.driver,frame,
        Number.isFinite(current.intensity)?Math.min(2,Math.max(0,current.intensity)):1,reduced,seed);
      if (reduced && (active!=='enter')) stage.pose.amount=0;
      if(scene?.render(ctx,w,h,inputs)){
        if(canvas.dataset.renderer!=='webgl')canvas.dataset.renderer='webgl';
        rendererWasSet=true;
      } else {
        paintRibbonCanvas(ctx,stage,budget);
        if(loaded&&canvas.dataset.renderer!=='canvas')canvas.dataset.renderer='canvas';
        rendererWasSet=loaded;
      }
      previousReduced=reduced;previousScene=scene;t.dirty=false;
      if(dt)current.playback?.onFrame?.(frame,raw);
    },()=>{const fps=props.current.playback?.maxFps;return fps ? 1000/Math.max(20,fps) : 0;});
    return ()=>{cancel.abort();stop();resize?.disconnect();scene?.dispose();};
  },[adapter,demo,engine,quality,seed]);

  const width=typeof size==='number'?Math.max(1,size):size==='fill'?undefined:sizeMap[size];
  return <div className={className} data-voice-variant="glass-ribbon"
    style={{width:'100%',maxWidth:width,aspectRatio:size==='fill'?undefined:'1.28',height:size==='fill'?'100%':undefined,
      position:'relative',touchAction:'pan-y',...style}}
    role={interactive?'button':undefined} tabIndex={interactive?0:undefined} aria-label={interactive?'Activate Glass Ribbon':undefined}
    onClick={interactive?()=>{engine.pulse();if(modeRef.current!=='enter')setMode('enter');}:undefined}
    onKeyDown={event=>{
      if(!interactive||event.repeat||(event.key!==' '&&event.key!=='Enter'))return;
      event.preventDefault();engine.pulse();if(modeRef.current!=='enter')setMode('enter');
      if(onPushToTalk&&!time.current.held){time.current.held=true;onPushToTalk(true);}
    }}
    onKeyUp={event=>{if((event.key===' '||event.key==='Enter')&&time.current.held){time.current.held=false;onPushToTalk?.(false);}}}
    onPointerMove={event=>{
      const bounds=event.currentTarget.getBoundingClientRect();
      if(bounds.width&&bounds.height)engine.point(2*(event.clientX-bounds.left)/bounds.width-1,2*(event.clientY-bounds.top)/bounds.height-1);
    }}
    onPointerDown={event=>{
      if(onPushToTalk&&!time.current.held){
        event.currentTarget.setPointerCapture(event.pointerId);time.current.held=true;onPushToTalk(true);
      }
    }}
    onPointerUp={()=>{if(time.current.held){time.current.held=false;onPushToTalk?.(false);}}}
    onLostPointerCapture={()=>{if(time.current.held){time.current.held=false;onPushToTalk?.(false);}}}
    onPointerLeave={()=>engine.release()}
    onBlur={()=>{engine.release();if(time.current.held){time.current.held=false;onPushToTalk?.(false);}}}>
    <canvas ref={node} aria-hidden="true" style={{width:'100%',height:'100%',display:'block',pointerEvents:'none'}} />
  </div>;
});
