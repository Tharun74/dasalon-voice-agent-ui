import { smooth } from '../../audio.js';
import { STATE_LABELS } from '../../state.js';
import { energy } from '../runtime.js';
import type { CanvasVisual } from '../runtime.js';

interface Word { text: string; x: number; line: number }

export const renderKineticType: CanvasVisual = seed => {
  const serif = 'Georgia, Times New Roman, serif';
  const phaseOffset = Math.abs(seed % 188) * .043;
  let text = '', activeId = '', speaker = '', age = 0, onsetBase = 0, tracking = 0;
  let font = '', lineHeight = 56, caption = false;
  const words: Word[] = [];

  function layout(ctx: CanvasRenderingContext2D, value: string, isCaption: boolean) {
    caption = isCaption;
    words.length = 0;
    const terms = value.trim().split(/\s+/u).slice(-17);
    const size = isCaption ? terms.length > 10 ? 30 : 35 : 61;
    lineHeight = size * 1.17;
    font = '600 ' + size + 'px ' + serif;
    ctx.font = font;
    let line = 0, left = 0, start = 0;
    const space = size * .30;
    function centerLine() {
      for (let index = start; index < words.length; index++) words[index].x -= (left - space) * .5;
    }
    for (const term of terms) {
      const width = ctx.measureText(term).width;
      if (left && left + width > 263) {
        centerLine();
        line++;
        left = 0;
        start = words.length;
      }
      words.push({text:term,line,x:left+width*.5});
      left += width+space;
    }
    centerLine();
  }

  return (ctx,width,height,inputs,lightweight) => {
    const { motion,palette }=inputs;
    const { inward,outward,quiet }=energy(inputs);
    const entry=inputs.transcript?.at(-1);
    const value=entry?.text.trim()|| (motion.state==='idle' ? 'Voice in motion.' : STATE_LABELS[motion.state]+'.');
    const activeSignal=entry?.speaker==='user'?motion.audio.input:motion.audio.output;
    if(text!==value||activeId!==(entry?.id??'')||!words.length){
      const nextId=entry?.id??'';
      const firstCaption=Boolean(entry)&&activeId!==nextId;
      text=value; activeId=nextId;
      speaker=entry?.speaker??'';
      if(firstCaption||!entry){age=0;onsetBase=activeSignal.onsetCount;}
      layout(ctx,value,Boolean(entry));
    }
    age+=motion.delta;
    tracking=smooth(tracking,outward*.29-inward*.22,motion.delta,.11);
    const steady=motion.reducedMotion?.23:1;
    const energyScale=1+(motion.breath*.026+tracking+motion.features.recoil*.16)*steady;
    const scale=Math.min(width/353,height/238);
    const inside=1-quiet*.49;
    const maxLine=words.at(-1)?.line??0;
    const pitch=(Math.sin(motion.phase*.46+phaseOffset)*.042+motion.y*.07)*steady;
    const rotate=(Math.sin(motion.time*.69+phaseOffset)*.028+motion.x*.044)*steady;
    const blockHeight=maxLine*lineHeight;
    const stepped=caption ? Math.max(age*4.5,Math.max(0,activeSignal.onsetCount-onsetBase)*1.1):10;
    ctx.clearRect(0,0,width,height);
    ctx.save();
    ctx.translate(width*.5,height*.49);
    ctx.scale(scale,scale);
    ctx.rotate(rotate);
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    const floor=ctx.createRadialGradient(0,10,12,0,4,152);
    floor.addColorStop(0,palette.shadow);
    floor.addColorStop(1,'transparent');
    ctx.fillStyle=floor;
    ctx.globalAlpha=.32*inside;
    ctx.fillRect(-157,-111,314,222);
    const ruler=Math.min(103,45+words.length*5.5);
    ctx.strokeStyle=palette.glow;
    ctx.lineWidth=.58;
    ctx.globalAlpha=(.50+motion.features.rim*.19)*inside;
    ctx.beginPath();
    ctx.moveTo(-ruler,83);ctx.lineTo(ruler,83);
    for(let tick=-5;tick<=5;tick++){
      const x=tick*ruler/5;
      ctx.moveTo(x,83);ctx.lineTo(x,tick%5===0?76:80);
    }
    ctx.stroke();
    ctx.font='500 7px ui-monospace, Consolas, monospace';
    ctx.fillStyle=palette.highlight;
    ctx.globalAlpha=.77*inside;
    ctx.fillText(speaker==='agent'?'A G E N T     /     L I V E':speaker==='user'?'G U E S T     /     L I V E':'K I N E T I C     /     T Y P E',0,96);
    ctx.font=font;
    const depth=lightweight||motion.reducedMotion?2:inputs.tier==='full'&&(inputs.quality??1)>.75?5:3;
    const bright=ctx.createLinearGradient(-95,-53,85,65);
    bright.addColorStop(0,palette.highlight);
    bright.addColorStop(.5,palette.highlight);
    bright.addColorStop(1,palette.glow);
    for(let i=0;i<words.length;i++){
      const word=words[i];
      const reveal=motion.reducedMotion ? 1 : Math.max(.10,Math.min(1,stepped-i*.84));
      const echo=(Math.sin(motion.phase*2.2-i*.71+phaseOffset)*.8+motion.breath*.45)*steady;
      const bend=word.x/130;
      const y=(word.line*lineHeight-blockHeight*.5)+(echo*(2.1+outward*9.2)-inward*bend*bend*5)*energyScale;
      const x=word.x*energyScale;
      const lean=pitch+bend*(tracking*.25)*(1+motion.features.sparkle*.23);
      const letterScale=(.99+echo*.032+tracking*.14);
      ctx.save();
      ctx.translate(x,y+(1-reveal)*9);
      ctx.transform(letterScale,lean,-lean*.79,1-Math.abs(bend)*.10+outward*.055,0,0);
      for(let layer=depth;layer>=1;layer--){
        ctx.globalAlpha=reveal*(.42-layer*.045)*inside;
        ctx.lineWidth=1.02;
        ctx.strokeStyle=layer===depth?palette.shadow:palette.glow;
        ctx.strokeText(word.text,layer*(1.20+outward*.64),layer*(1.06+outward*.33),279);
      }
      ctx.globalAlpha=reveal*inside;
      ctx.fillStyle=bright;
      ctx.fillText(word.text,0,0,279);
      ctx.restore();
    }
    ctx.restore();
  };
};
