import { smooth } from '../../audio.js';
import { energy, randomFor } from '../runtime.js';
import type { CanvasVisual } from '../runtime.js';

const PI = Math.PI;
const arch = [
  [-72,-45,19, -71,-96,18, -29,-114,24, 0,-110,36],
  [0,-110,36, 47,-114,20, 78,-88,15, 73,-38,20],
  [-76,-19,14, -77,25,23, -40,69,31, -9,82,35],
  [76,-19,14, 77,25,23, 40,69,31, 9,82,35],
  [-28,70,30, -19,91,31, 19,91,31, 28,70,30],
  [-57,-62,28, -34,-84,48, 1,-76,54, 14,-72,45],
  [54,-59,28, 42,-73,42, 27,-77,46, 19,-72,44],
] as const;

export const renderMuse: CanvasVisual = seed => {
  const rand = randomFor(seed);
  const duet = Float32Array.from({length: 246},rand);
  let mouth = 0;
  let x = 0, y = 0, scale = 1, centerX = 0, centerY = 0;
  let sinX = 0, cosX = 1, sinY = 0, cosY = 1;
  function point(px: number, py: number, pz: number) {
    const xx=px*cosY+pz*sinY, depth=pz*cosY-px*sinY;
    const perspective=340/(340-depth*cosX-py*sinX);
    x=centerX+xx*perspective*scale;
    y=centerY+(py*cosX-depth*sinX)*perspective*scale;
  }
  return (ctx,width,height,inputs,lightweight) => {
    const {motion,palette}=inputs;
    const {inward,outward,quiet}=energy(inputs);
    const restrained=motion.reducedMotion?.33:1;
    centerX=width*.5+motion.x*width*.017;
    centerY=height*.53+motion.y*height*.012;
    scale=Math.min(width/350,height/266)*(1-inward*.15+outward*.15+motion.breath*.022+motion.features.recoil*.18);
    const yaw=(motion.x*.25+Math.sin(motion.phase*.48+seed%11)*.13)*restrained;
    const pitch=(motion.y*.15+Math.sin(motion.time*.51)*.039-motion.weights.thinking*.12)*restrained;
    sinX=Math.sin(pitch); cosX=Math.cos(pitch); sinY=Math.sin(yaw); cosY=Math.cos(yaw);
    const clarity=1-quiet*.61;
    const blinkTime=(motion.time+(seed%17)*.14)%5.38;
    const blink=1-Math.pow(Math.max(0,1-Math.abs(blinkTime-4.71)/.135),1.7)*.95;
    const {input,output}=motion.audio;
    const speaking=motion.weights.speaking;
    const listening=motion.weights.listening;
    const formant=output.lowMid*speaking+input.lowMid*listening*.18;
    const formantEdge=output.presence*speaking+input.presence*listening*.17;
    mouth=smooth(mouth,Math.min(1,output.rms*speaking*1.55+outward*.49),motion.delta,.055);
    ctx.clearRect(0,0,width,height);
    ctx.save();
    const halo=ctx.createRadialGradient(centerX,centerY,scale*12,centerX,centerY,scale*103);
    halo.addColorStop(0,palette.shadow);
    halo.addColorStop(.49,palette.glow);
    halo.addColorStop(1,'transparent');
    ctx.globalAlpha=.19*clarity;
    ctx.fillStyle=halo;
    ctx.fillRect(0,0,width,height);
    ctx.lineCap='round';
    const frame=ctx.createLinearGradient(centerX-scale*75,centerY-scale*85,centerX+scale*64,centerY+scale*80);
    frame.addColorStop(0,palette.shadow);
    frame.addColorStop(.42,palette.highlight);
    frame.addColorStop(.73,palette.glow);
    frame.addColorStop(1,palette.shadow);
    ctx.strokeStyle=frame;
    ctx.lineWidth=scale*(.65+motion.features.rim*.40);
    ctx.globalAlpha=clarity*(.61+motion.features.rim*.26);
    for (const row of arch) {
      point(row[0],row[1],row[2]);ctx.beginPath();ctx.moveTo(x,y);
      point(row[3],row[4],row[5]);const x1=x,y1=y;
      point(row[6],row[7],row[8]);const x2=x,y2=y;
      point(row[9],row[10],row[11]);ctx.bezierCurveTo(x1,y1,x2,y2,x,y);ctx.stroke();
    }
    const particleCount=inputs.tier==='full'&& !lightweight ? 82:46;
    ctx.fillStyle=palette.glow;
    for (let i=0;i<particleCount;i++) {
      const a=duet[i*3]*PI*2+motion.phase*.12;
      const r=(86+duet[i*3+1]*32)*(1-inward*.21+outward*.28);
      const z=(duet[i*3+2]-.5)*99;
      point(Math.cos(a)*r,Math.sin(a)*r*.94-11,z);
      ctx.globalAlpha=(.14+duet[i*3+2]*.58+outward*.22+motion.features.sparkle*.08)*clarity;
      ctx.beginPath();ctx.arc(x,y,Math.max(.52,scale*(.52+duet[i*3+1]*.84)),0,PI*2);ctx.fill();
    }
    for (let side=-1;side<=1;side+=2) {
      const eye=side*(34-inward*6+outward*3);
      const bend=8*(.2+.8*blink)*(1-inward*.23+outward*.21);
      ctx.strokeStyle=palette.highlight;
      ctx.lineWidth=scale*(1.22+motion.features.rim*.35);
      ctx.globalAlpha=clarity*.91;
      point(eye,-17-bend,50);const topX=x,topY=y;
      // Lay the lower line in its own path so a blink stays as a single clean stroke.
      ctx.beginPath();point(eye-19,-17,43);ctx.moveTo(x,y);
      point(eye+19,-17,43);const rightX=x,rightY=y;
      ctx.quadraticCurveTo(topX,topY,rightX,rightY);
      ctx.stroke();
      if(blink>.24) {
        ctx.globalAlpha=clarity*.49;
        point(eye,-17+bend*.77,50);const endX=x,endY=y;
        ctx.beginPath();ctx.moveTo(rightX,rightY);
        point(eye-19,-17,43);ctx.quadraticCurveTo(endX,endY,x,y);ctx.stroke();
      }
      if(blink>.18) {
        point(eye+motion.x*6,-17+motion.y*4,53);
        ctx.globalAlpha=clarity*(.44+blink*.54);
        ctx.beginPath();ctx.arc(x,y,scale*(1.7+blink*1.0),0,PI*2);ctx.fillStyle=palette.highlight;ctx.fill();
        ctx.globalAlpha=clarity*.34;
        ctx.beginPath();ctx.arc(x,y,scale*5.6*blink,0,PI*2);ctx.strokeStyle=palette.glow;ctx.stroke();
      }
      ctx.lineWidth=scale*.82;
      ctx.strokeStyle=palette.glow;
      ctx.globalAlpha=clarity*.76;
      point(eye-22,-32,38);ctx.beginPath();ctx.moveTo(x,y);
      point(eye,-47+side*2,51);const browX=x,browY=y;
      point(eye+19,-33,42);ctx.quadraticCurveTo(browX,browY,x,y);ctx.stroke();
      ctx.globalAlpha=clarity*(.25+outward*.36);
      point(side*45,14,38);ctx.beginPath();ctx.moveTo(x,y);
      point(side*60,8+inward*2,29);const cheekX=x,cheekY=y;
      point(side*66,-2,25);ctx.quadraticCurveTo(cheekX,cheekY,x,y);ctx.stroke();
    }
    ctx.globalAlpha=clarity*.55;
    ctx.strokeStyle=palette.glow;
    point(-3,-10,45);ctx.beginPath();ctx.moveTo(x,y);
    point(-10,18,55);const noseX=x,noseY=y;
    point(6,17,49);ctx.quadraticCurveTo(noseX,noseY,x,y);ctx.stroke();
    const widthOfMouth=17*(1-inward*.52)+mouth*(6+formantEdge*7)-formant*3.1;
    const center=42+mouth*1.5;
    const open=(2.8+mouth*(7.5+formant*9))*restrained+(1-restrained)*2;
    ctx.globalAlpha=clarity*(.68+mouth*.28);
    ctx.lineWidth=scale*(1.14+mouth*.53);
    ctx.strokeStyle=frame;
    point(-widthOfMouth,center,46);ctx.beginPath();ctx.moveTo(x,y);
    point(0,center-open*.47,53);const mouthX=x,mouthY=y;
    point(widthOfMouth,center,46);ctx.quadraticCurveTo(mouthX,mouthY,x,y);
    point(0,center+open,53);const lipX=x,lipY=y;
    point(-widthOfMouth,center,46);ctx.quadraticCurveTo(lipX,lipY,x,y);ctx.stroke();
    ctx.restore();
  };
};
