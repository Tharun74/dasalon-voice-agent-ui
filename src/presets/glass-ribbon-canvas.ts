import type { GlassRibbonBackdrop, RibbonStage } from './glass-ribbon-timeline.js';
import { RIBBON_PROFILE, ribbonBump, ribbonHalfWidth } from './glass-ribbon-timeline.js';

function drawCover(ctx: CanvasRenderingContext2D, source: GlassRibbonBackdrop, width: number, height: number,
  shiftX = 0, shiftY = 0, zoom = 1) {
  const video=source.tagName==='VIDEO'?source as HTMLVideoElement:undefined;
  const image=source.tagName==='IMG'?source as HTMLImageElement:undefined;
  const dw=video?.videoWidth??image?.naturalWidth??source.width;
  const dh=video?.videoHeight??image?.naturalHeight??source.height;
  if (!dw || !dh || (video && video.readyState < 2)) return;
  const s=Math.max(width/dw,height/dh)*zoom;
  ctx.drawImage(source, (width-dw*s)*.5+shiftX, (height-dh*s)*.5+shiftY,dw*s,dh*s);
}

function shell(ctx: CanvasRenderingContext2D, rx: number, ry: number, inset=0) {
  rx=Math.max(.1,rx-inset); ry=Math.max(.1,ry-inset);
  ctx.beginPath();
  ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);
}

export function paintRibbonCanvas(ctx: CanvasRenderingContext2D, stage: RibbonStage, quality: number) {
  const {pose:p,width,height,spectrum,backdrop}=stage;
  ctx.clearRect(0,0,width,height);
  if(p.amount<.0001) return;
  ctx.save();
  ctx.translate(p.cx,p.cy);
  ctx.rotate(p.pitch);
  ctx.globalAlpha=p.amount*(1-p.quiet*.46);
  const {rx,ry}=p;
  if(p.neck>.008) {
    ctx.fillStyle='#102222';
    ctx.beginPath();
    ctx.moveTo(-rx*p.neck*.61,-p.cy);
    ctx.bezierCurveTo(-rx*p.neck*.30,-ry*.72,-rx*.67,-ry*.55,-rx*.39,0);
    ctx.lineTo(rx*.39,0);
    ctx.bezierCurveTo(rx*.68,-ry*.56,rx*p.neck*.33,-ry*.74,rx*p.neck*.58,-p.cy);
    ctx.closePath();
    ctx.fill();
  }

  ctx.save();
  shell(ctx,rx,ry);
  ctx.clip();
  if(backdrop) {
    ctx.save();
    ctx.translate(-p.cx,-p.cy);
    drawCover(ctx,backdrop,width,height,rx*.025,ry*.031,1.085);
    ctx.restore();
  }
  const wash=ctx.createLinearGradient(0,-ry,0,ry);
  wash.addColorStop(0,`rgba(10,29,29,${.64+p.dark*.32})`);
  wash.addColorStop(.46,`rgba(21,47,44,${.43+p.dark*.45})`);
  wash.addColorStop(.56,`rgba(10,14,16,${.25+p.dark*.49})`);
  wash.addColorStop(1,`rgba(63,40,29,${.16+p.dark*.34})`);
  ctx.fillStyle=wash;ctx.fillRect(-rx,-ry,rx*2,ry*2);
  const edge=ctx.createRadialGradient(rx*.19,-ry*.16,0,0,0,Math.max(rx,ry));
  edge.addColorStop(.43,'transparent');
  edge.addColorStop(1,'#090b15a3');
  ctx.fillStyle=edge;ctx.fillRect(-rx,-ry,rx*2,ry*2);

  const specular=ctx.createRadialGradient(-rx*.32,-ry*.52,0,-rx*.32,-ry*.52,rx*.33);
  specular.addColorStop(0,'#e0f3ff59');specular.addColorStop(.46,'#a3cbd631');specular.addColorStop(1,'transparent');
  ctx.fillStyle=specular;ctx.fillRect(-rx,-ry,rx*2,ry*2);
  ctx.rotate(-p.pitch);
  const horizon=ry*RIBBON_PROFILE.horizon;
  const reach=rx*ribbonHalfWidth(p.span);
  const lift=ry*(RIBBON_PROFILE.foot+p.lift*RIBBON_PROFILE.lift)*p.ramp;
  const soft=quality>.75 && stage.full;
  ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=p.amount*p.flare*(1-p.quiet*.83);
  const segments=soft?46:24;
  ctx.beginPath();
  ctx.moveTo(-reach,horizon);
  for(let j=1;j<=segments;j++){
    const x=j*2/segments-1;
    ctx.lineTo(x*reach,horizon-lift*RIBBON_PROFILE.top*ribbonBump(x));
  }
  for(let j=segments-1;j>=0;j--){
    const x=j*2/segments-1;
    ctx.lineTo(x*reach,horizon+lift*RIBBON_PROFILE.bottom*ribbonBump(x));
  }
  ctx.closePath();
  for(let i=0;i<spectrum.length;i++){
    const wave=Math.sin(p.phase*(1.11+i*.103)+i*2.399+p.tint);
    const drift=(.61*wave+.16*Math.cos(p.phase*.77+i*3.1))*reach;
    const [r,g,b]=spectrum[i];
    const color=`${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)}`;
    const gain=.25+p.energy*.58+p.heat*.12;
    const band=ctx.createLinearGradient(-reach,0,reach,0);
    const focus=Math.min(.91,Math.max(.09,.5+drift/(reach*2)));
    band.addColorStop(0,'transparent');
    band.addColorStop(focus,`rgba(${color},${gain})`);
    band.addColorStop(1,'transparent');
    ctx.fillStyle=band;
    if(soft){ctx.shadowColor=`rgb(${color})`;ctx.shadowBlur=Math.max(1,ry*.11);}
    ctx.fill();
  }
  ctx.shadowBlur=0;
  const flare=ctx.createLinearGradient(-reach,0,reach,0);
  flare.addColorStop(0,'transparent');
  flare.addColorStop(.32,'#62caff9a');
  flare.addColorStop(.57,p.heat>.5?'#ffffffec':'#f1ffffb5');
  flare.addColorStop(.76,'#ffb559a8');
  flare.addColorStop(1,'transparent');
  ctx.strokeStyle=flare; ctx.lineWidth=Math.max(1,ry*(.021+p.heat*.018));
  ctx.beginPath();
  ctx.moveTo(-reach,horizon);
  ctx.lineTo(reach,horizon);
  ctx.stroke();
  ctx.restore();

  const metal=ctx.createLinearGradient(-rx,-ry,rx,ry);
  metal.addColorStop(0,'#9cffe4b0');
  metal.addColorStop(.39,'#4968713d');
  metal.addColorStop(.72,'#f4c68c91');
  metal.addColorStop(1,'#9bb9ff9e');
  ctx.strokeStyle=metal;
  ctx.lineWidth=rx*(.019+p.heat*.013+p.rim*.009);
  ctx.globalAlpha*=.86;
  shell(ctx,rx,ry,ctx.lineWidth*.50);
  ctx.stroke();
  ctx.lineWidth*=.58;
  shell(ctx,rx,ry,rx*.063);
  ctx.stroke();
  ctx.restore();
}
