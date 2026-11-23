import { LENS_DETAILS, REFERENCE_FPS, createRibbonPose, frameTime, glassSpectrum, updateRibbon } from '@/src/presets/glass-ribbon-timeline';
import type { RibbonStage } from '@/src/presets/glass-ribbon-timeline';

export const framing = { x:304, y:325, width:112, height:112, cx:56, cy:60 } as const;
const entryPhases = [17,29,35,38,47] as const;
const phaseNames = ['Emergence','Settled shape','Glass darkens','Flare begins','Ribbon appears'];

export function referenceStage(): RibbonStage {
  const crop=framing;
  return { pose:createRibbonPose(),width:crop.width,height:crop.height,
    originX:crop.cx,originY:crop.cy,diameter:LENS_DETAILS.diameter,spectrum:glassSpectrum(),full:true };
}

export function entryTimings() {
  const stage=referenceStage();
  const seen=[0,0,0,0,0];
  for(let frame=1;frame<=70;frame++){
    const t=frameTime(frame);
    updateRibbon(stage,t,t,'replay',undefined,1,false,42);
    const p=stage.pose, target=LENS_DETAILS.diameter*.5;
    const cues=[p.amount>.025,p.amount>.98&&Math.abs(p.rx-target)<target*.025&&Math.abs(p.cy-framing.cy)<1.1,p.dark>.92,p.flare>.025,p.ramp>.025];
    for(let i=0;i<cues.length;i++)if(cues[i]&&!seen[i])seen[i]=frame;
  }
  return phaseNames.map((phase,i)=>({phase,reference:entryPhases[i],actual:seen[i],delta:seen[i]-entryPhases[i]}));
}

type Rect={left:number;top:number;right:number;bottom:number};
export interface FrameReport {
  frame: number;
  ssim: number;
  colorError: number;
  horizon: number | null;
  rim: number | null;
  sliver: number | null;
  hue: number | null;
}

function bounds(frame: number): Rect {
  const crop=framing;
  const size=LENS_DETAILS;
  if(frame<30){
    const half=size.diameter*.58;
    return {left:Math.max(0,Math.floor(crop.cx-half)),right:Math.min(crop.width,Math.ceil(crop.cx+half)),top:0,
      bottom:Math.min(crop.height,Math.ceil(crop.cy+size.diameter*.56))};
  }
  return {left:Math.floor(crop.cx-size.diameter/2),right:Math.ceil(crop.cx+size.diameter/2),
    top:Math.floor(crop.cy-size.diameter/2),bottom:Math.ceil(crop.cy+size.diameter/2)};
}

function luma(p: Uint8ClampedArray, i: number) { return .2126*p[i]+.7152*p[i+1]+.0722*p[i+2]; }

function windowScores(ref: ImageData, result: ImageData, box: Rect) {
  const a=ref.data,b=result.data;
  const pitch=ref.width;
  let ssim=0, weight=0, color=0;
  for(let y=box.top;y<box.bottom;y+=8){
    for(let x=box.left;x<box.right;x+=8){
      let left=0,right=0,xx=0,yy=0,xy=0,n=0;
      for(let row=y;row<Math.min(y+8,box.bottom);row++){
        for(let col=x;col<Math.min(x+8,box.right);col++){
          const i=(row*pitch+col)*4;
          const q=luma(a,i),r=luma(b,i);
          left+=q;right+=r;xx+=q*q;yy+=r*r;xy+=q*r;n++;
          color+=Math.hypot(a[i]-b[i],a[i+1]-b[i+1],a[i+2]-b[i+2])/Math.sqrt(3);
        }
      }
      left/=n;right/=n;
      const vx=Math.max(0,xx/n-left*left),vy=Math.max(0,yy/n-right*right),cov=xy/n-left*right;
      ssim+=n*((2*left*right+6.5025)*(2*cov+58.5225))/((left*left+right*right+6.5025)*(vx+vy+58.5225));
      weight+=n;
    }
  }
  return {ssim:ssim/weight,colorError:color/weight};
}

function scanRibbon(image: ImageData, frame: number) {
  const group=LENS_DETAILS, crop=framing;
  const center=crop.cy+(group.horizon-.5)*group.diameter;
  const top=Math.max(0,Math.round(center-17)), bottom=Math.min(image.height,Math.round(center+17));
  const half=Math.round(group.diameter*.42), x0=crop.cx-half, x1=crop.cx+half;
  let w=0,yMean=0,xMin=x1,xMax=x0;
  const hue=new Float32Array(12);
  for(let y=top;y<bottom;y++){
    for(let x=x0;x<=x1;x++){
      const i=(y*image.width+x)*4;
      const r=image.data[i],g=image.data[i+1],b=image.data[i+2];
      const max=Math.max(r,g,b),min=Math.min(r,g,b);
      if(max<149||(max-min<27&&max<210))continue;
      const brightness=(max-145)*Math.max(.22,1-Math.abs(y-center)/24);
      w+=brightness;yMean+=brightness*y;xMin=Math.min(xMin,x);xMax=Math.max(xMax,x);
      if(max-min<35 || max<152)continue;
      const d=max-min;
      const h=r===max?(g-b)/d:g===max?2+(b-r)/d:4+(r-g)/d;
      hue[Math.floor(((h+6)%6)*2)]+=d;
    }
  }
  const total=hue.reduce((sum,value)=>sum+value,0);
  if(total)for(let i=0;i<hue.length;i++)hue[i]/=total;
  return {y:w>200?yMean/w:null,width:w>200&&frame>=250?xMax-xMin+1:null,hue,total};
}

function estimateRim(img: ImageData) {
  const crop=framing,f=LENS_DETAILS, r=f.diameter*.5;
  let hits=0,total=0;
  for(const side of [-1,1]){
    for(const dy of [-.44,-.33,-.22,.22,.33,.44]){
      const row=Math.round(crop.cy+dy*r);
      const at=Math.round(crop.cx+side*r*Math.sqrt(1-dy*dy));
      const pitch=img.width;
      const sample=(x:number)=>luma(img.data,(row*pitch+x)*4);
      let peak=0,peakAt=0;
      for(let x=at-4;x<=at+4;x++){const v=sample(x);if(v>peak){peak=v;peakAt=x;}}
      const local=Math.max(sample(at-5),sample(at+5));
      if(peak-local<16 || Math.abs(peakAt-at)===4)continue;
      const level=(peak+local)*.5;
      let run=1;
      for(const dir of [-1,1]){
        for(let j=1;j<4;j++){if(sample(peakAt+j*dir)<level)break;run++;}
      }
      hits++;total+=run;
    }
  }
  return hits>=3?total/hits:null;
}

export function measureFrame(ref: ImageData, result: ImageData, frame: number): FrameReport {
  const sizes=LENS_DETAILS;
  const {ssim,colorError}=windowScores(ref,result,bounds(frame));
  const a=scanRibbon(ref,frame),b=scanRibbon(result,frame);
  const rim1=estimateRim(ref),rim2=estimateRim(result);
  let hue=0;
  for(let i=0;i<12;i++) hue+=Math.min(a.hue[i],b.hue[i]);
  return {frame,ssim,colorError,
    horizon:frame>=60&&a.y!=null&&b.y!=null?Math.abs(a.y-b.y)/(sizes.diameter)*100:null,
    rim:frame>=60&&rim1!=null&&rim2!=null?Math.abs(rim1-rim2):null,
    sliver:a.width!=null&&b.width!=null?Math.abs(a.width-b.width)/Math.max(1,a.width)*100:null,
    hue:frame>=60&&a.total>0&&b.total>0?hue:null};
}

export function paintDifference(ctx:CanvasRenderingContext2D,ref:ImageData,actual:ImageData){
  const out=ctx.createImageData(ref.width,ref.height);
  for(let i=0;i<out.data.length;i+=4){
    const e=(Math.abs(ref.data[i]-actual.data[i])+Math.abs(ref.data[i+1]-actual.data[i+1])+Math.abs(ref.data[i+2]-actual.data[i+2]))/3;
    out.data[i]=Math.min(255,e*4.0);
    out.data[i+1]=Math.min(255,Math.max(0,e-22)*2.6);
    out.data[i+2]=Math.min(230,e*.76+14);
    out.data[i+3]=255;
  }
  ctx.putImageData(out,0,0);
}

export function referenceTimeText(frame: number) { return ((frame-1)/REFERENCE_FPS).toFixed(3)+' s'; }
