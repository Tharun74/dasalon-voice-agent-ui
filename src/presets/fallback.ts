import type { PresetName } from './catalog.js';
import { randomFor, energy } from './runtime.js';
import type { SceneInputs } from './runtime.js';

const TAU = Math.PI * 2;

export function fallbackRenderer(variant: PresetName, seed: number) {
  const random = randomFor(seed);
  const points = variant === 'stardust' ? Array.from({ length: 520 }, () => [random() * TAU, Math.sqrt(random()), random()]) : [];
  const flock = variant === 'murmuration' ? Float32Array.from({ length: 1100 }, random) : undefined;
  return (ctx: CanvasRenderingContext2D, width: number, height: number, inputs: SceneInputs, lightweight: boolean) => {
    const { motion, palette } = inputs;
    const { inward, outward, quiet } = energy(inputs);
    const scale = Math.min(width / 285, height / 205);
    const seedPhase = (Math.trunc(seed) % 359) * 0.035;
    const phase = motion.time + seedPhase;
    const listen = inward * Math.sin(phase * 5.7);
    const speak = outward * Math.sin(phase * 7.2);
    const breath = motion.breath * 0.018;
    const aperture = 1 + breath - inward * .22 + outward * .19 + motion.pulse * .09 + motion.features.recoil * .20;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width * 0.5 + motion.x * 9 * scale, height * 0.5 + motion.y * 7 * scale);
    ctx.scale(scale * (1 + breath), scale * (1 + breath));
    ctx.globalAlpha = 1 - quiet * 0.48;
    const light = ctx.createRadialGradient(-23, -27, 4, 2, 5, 100);
    light.addColorStop(0, palette.highlight);
    light.addColorStop(0.34, palette.glow);
    light.addColorStop(0.8, palette.shadow);
    light.addColorStop(1, '#180e1a');
    ctx.fillStyle = light;
    ctx.strokeStyle = light;

    if (variant === 'murmuration' && flock) {
      ctx.globalCompositeOperation = 'lighter';
      const count = lightweight || motion.reducedMotion ? 280 : 550;
      const swell = aperture * (1 - motion.weights.thinking * .35);
      for (let group = 0; group < 3; group++) {
        ctx.beginPath();
        ctx.lineWidth = .78 + group * .19;
        ctx.strokeStyle = group === 2 ? palette.highlight : group === 1 ? palette.glow : palette.shadow;
        ctx.globalAlpha = (.34 + group * .18 + motion.features.rim * .18) * (1 - quiet * .47);
        for (let index = group; index < count; index += 3) {
          const t = index / count * TAU + motion.phase * .52;
          const spread = flock[index * 2] - .5;
          const orbit = (79 + spread * 35) * swell;
          const x = Math.cos(t) * orbit;
          const y = (Math.sin(t) * .58 + Math.sin(t * 2 + spread * 5) * .26) * orbit;
          const wings = 1.05 + flock[index * 2 + 1] * 1.9;
          ctx.moveTo(x - wings, y - wings * .45);
          ctx.lineTo(x, y + wings * Math.sin(t) * .45);
          ctx.lineTo(x + wings, y - wings * .45);
        }
        ctx.stroke();
      }
    } else if (variant === 'liquid-glass') {
      const lensWidth = Math.min(width * .407, height * .752) / scale;
      const halfX = lensWidth * (1 - motion.features.inward * .22 + motion.features.outward * .18 + motion.features.recoil * .24 + motion.pulse * .14);
      const halfY = lensWidth / 3.3 * (1 - motion.features.inward * .15 + motion.features.outward * .12 - motion.pulse * .19);
      ctx.rotate(motion.x * -.035 + Math.sin(motion.phase * .84) * (.028 + outward * .039) + motion.pulse * .063);
      const shell = ctx.createLinearGradient(-halfX * .25, -halfY, halfX * .25, halfY);
      const source = inputs.backdrop;
      const video = source?.tagName === 'VIDEO' ? source as HTMLVideoElement : undefined;
      const img = source?.tagName === 'IMG' ? source as HTMLImageElement : undefined;
      const mediaWidth = video?.videoWidth ?? img?.naturalWidth ?? source?.width ?? 0;
      const mediaHeight = video?.videoHeight ?? img?.naturalHeight ?? source?.height ?? 0;
      const mediaReady = !!source && mediaWidth > 0 && mediaHeight > 0 && (!video || video.readyState >= 2);
      shell.addColorStop(0,'#e2f5ffbc'); shell.addColorStop(.18,mediaReady?'#adc7ee3f':'#536582bf');
      shell.addColorStop(.52,mediaReady?'#779bc321':'#24263fcb'); shell.addColorStop(.78,mediaReady?'#887fd12c':'#465371b9');
      shell.addColorStop(1,'#bfb1eb9a');
      ctx.beginPath();
      ctx.roundRect(-halfX, -halfY, halfX * 2, halfY * 2, halfY);
      ctx.save();
      ctx.clip();
      if (mediaReady) {
        const cover = Math.max(width / scale / mediaWidth, height / scale / mediaHeight) * 1.15;
        ctx.filter = 'blur(10px) saturate(1.38)';
        ctx.drawImage(source,-mediaWidth*cover*.5,-mediaHeight*cover*.5,mediaWidth*cover,mediaHeight*cover);
        ctx.filter = 'none';
      }
      ctx.fillStyle = shell;
      ctx.fill();
      ctx.restore();
      const bevel = ctx.createLinearGradient(-halfX * .29,-halfY,halfX * .34,halfY);
      bevel.addColorStop(0,'#e9f9ffe0');bevel.addColorStop(.43,palette.glow);bevel.addColorStop(1,'#9eabf391');
      ctx.lineWidth = 1.35 + motion.features.rim * .38;
      ctx.strokeStyle = bevel;
      ctx.globalAlpha = (.76+motion.features.rim*.17)*(1-quiet*.48);
      ctx.stroke();
    } else if (variant === 'jewel') {
      const gleam = ctx.createLinearGradient(-63, -77, 71, 62);
      gleam.addColorStop(0, palette.highlight);
      gleam.addColorStop(.33, palette.glow);
      gleam.addColorStop(.55, '#42577e');
      gleam.addColorStop(.82, palette.shadow);
      gleam.addColorStop(1, '#6a61ad');
      ctx.rotate(-.15 + Math.sin(motion.phase * .48) * .16);
      ctx.scale(aperture, aperture);
      const facets = [[0,-69, -51,-43, -70,-13], [0,-69,-70,-13,-21,-8], [0,-69,-21,-8,31,-5], [0,-69,31,-5,62,-20],
        [-70,-13,-21,-8,2,78], [-21,-8,31,-5,2,78], [31,-5,62,-20,2,78], [0,-69,62,-20,47,-52]];
      const split = Math.max(0, -motion.features.recoil) * 23 + motion.weights.interrupted * 14;
      for (let i=0; i<facets.length; i++) {
        const p = facets[i];
        const x = Math.cos(i * 2.39) * split, y = Math.sin(i * 2.39) * split;
        ctx.beginPath();
        ctx.moveTo(p[0]+x,p[1]+y);ctx.lineTo(p[2]+x,p[3]+y);ctx.lineTo(p[4]+x,p[5]+y);ctx.closePath();
        ctx.fillStyle = i%3===0 ? palette.glow : gleam;
        ctx.globalAlpha = (.57+i*.045+Math.sin(motion.phase+i)*.083)*(1-quiet*.52);
        ctx.fill();
        ctx.lineWidth = .78 + motion.features.rim * .5;
        ctx.strokeStyle = i%2===0 ? palette.highlight : '#a8b7e3';
        ctx.stroke();
      }
      for (let i=0;i<9;i++) {
        const turn = i*2.39+motion.phase*.34;
        const x=Math.cos(turn)*87, y=Math.sin(turn)*69;
        const star = Math.pow(Math.max(0,Math.sin(motion.phase*.76+i*7.3)),4)*(2.4+motion.features.sparkle*3.5);
        ctx.globalAlpha=(.27+star*.17)*(1-quiet*.52);
        ctx.strokeStyle=palette.highlight;
        ctx.lineWidth=.68;
        ctx.beginPath();ctx.moveTo(x-star,y);ctx.lineTo(x+star,y);ctx.moveTo(x,y-star);ctx.lineTo(x,y+star);ctx.stroke();
      }
    } else if (variant === 'dock') {
      const open = inputs.dockOpen ?? 0;
      const length = 103 + outward * 21 - inward * 12 + open * 15 + motion.features.recoil * 18;
      ctx.translate(0, -open * 35);
      const body = ctx.createLinearGradient(0, -28, 0, 33);
      body.addColorStop(0, '#795664');
      body.addColorStop(0.09, '#412a3b');
      body.addColorStop(0.31, '#2a1c2a');
      body.addColorStop(0.84, '#140e19');
      body.addColorStop(1, '#4e303e');
      ctx.shadowBlur = lightweight ? 0 : 24 + outward * 12;
      ctx.shadowColor = palette.shadow;
      ctx.fillStyle = body;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-length, -28, length * 2, 56, 30 - open * 8);
      ctx.fill();
      ctx.strokeStyle = motion.features.rim > .02 ? palette.highlight : light;
      ctx.globalAlpha *= .62 + motion.features.rim * .38;
      ctx.stroke();
      ctx.globalAlpha = 1 - quiet * .48;
      ctx.shadowBlur = 0;
      const medallion = ctx.createLinearGradient(-86, -18, -63, 15);
      medallion.addColorStop(0, palette.glow);
      medallion.addColorStop(1, palette.shadow);
      ctx.fillStyle = medallion;
      ctx.beginPath();
      ctx.arc(-74, 0, 17, 0, TAU);
      ctx.fill();
      ctx.fillStyle = palette.highlight;
      ctx.beginPath();
      ctx.roundRect(-77, -8, 6, 11, 3);
      ctx.fill();
      ctx.strokeStyle = palette.highlight;
      ctx.beginPath();
      ctx.arc(-74, 0, 5.2, 0, Math.PI);
      ctx.moveTo(-74, 5);
      ctx.lineTo(-74, 9);
      ctx.stroke();
      const steps = lightweight ? 36 : 72;
      for (let strand = 0; strand < (lightweight ? 4 : 6); strand++) {
        ctx.strokeStyle = strand === 0 ? palette.highlight : palette.glow;
        ctx.lineWidth = strand === 0 ? 1.35 : 0.7;
        ctx.globalAlpha = (0.86 - strand * 0.115) * (1 - quiet * 0.48);
        ctx.beginPath();
        for (let j = 0; j <= steps; j++) {
          const u = j / steps;
          const frame = Math.sin(Math.PI * u);
          const angle = u * 10 + strand * 0.61 - motion.phase * 3.6 - seedPhase;
          const drift = Math.sin(angle) + motion.weights.thinking * 0.35 * Math.sin(angle - phase * 1.4);
          const shape = Math.cos(u * 6.5 + phase * 0.73) * 0.68 + 0.32;
          const signal = frame * (5.6 + outward * 13 - inward * 3) * drift * shape
            + frame * (listen * (0.5 - u) * 10 + speak * Math.sin(u * 16) * 8 + motion.pulse * 8 * Math.sin(u * 12 - phase * 8));
          const px = -42 + u * (length + 26);
          const py = signal + (strand - 2.5) * 2.0;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    } else if (variant === 'mercury') {
      ctx.scale(aperture, aperture);
      ctx.rotate(-0.17 + Math.sin(phase * .81) * .12);
      const chrome = ctx.createLinearGradient(-24, -62, 16, 61);
      chrome.addColorStop(0, palette.highlight);
      chrome.addColorStop(.25, '#7c8fa8');
      chrome.addColorStop(.43, '#161923');
      chrome.addColorStop(.54, palette.glow);
      chrome.addColorStop(.74, '#333947');
      chrome.addColorStop(1, palette.highlight);
      ctx.fillStyle = chrome;
      const tip = 77 + outward * 37;
      const sway = Math.sin(phase * 2) * 9;
      ctx.beginPath();
      ctx.moveTo(-76, -5);
      ctx.bezierCurveTo(-104, -58, -47, -68 + sway, -24, -29);
      ctx.bezierCurveTo(3, -7, 10, -65, tip, -46 + sway);
      ctx.bezierCurveTo(tip + 23, -24, 26, 17, 24, 36);
      ctx.bezierCurveTo(12, 69, -64, 50, -76, -5);
      ctx.fill();
      ctx.lineWidth = .9 + motion.features.rim;
      ctx.strokeStyle = palette.highlight;
      ctx.stroke();
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.ellipse(58 + i * 29 + outward * (46 + i * 9), -24 + i * 49 + sway, 8 - i * 3 + outward * 5, 6 - i * 2 + outward * 4, -.35, 0, TAU);
        ctx.fill();
      }
    } else if (variant === 'aurora-veil') {
      ctx.scale(1 - inward * .35 + outward * .18, 1 + motion.features.recoil * .23);
      for (let layer = 0; layer < 3; layer++) {
        const sweep = (x: number) => 35 + layer * 11 - x * .26 + Math.sin(x * .026 + phase + layer * 1.4) * (24 + outward * 17);
        const haze = ctx.createLinearGradient(0, -77, 0, 67);
        haze.addColorStop(0, '#bc90ed00');
        haze.addColorStop(.37, layer === 1 ? palette.shadow : '#5c55ab');
        haze.addColorStop(.73, layer === 1 ? palette.glow : '#45eab4');
        haze.addColorStop(1, '#8bffe600');
        ctx.fillStyle = haze;
        ctx.globalAlpha = (.20 + layer * .09 + outward * .13) * (1 - quiet * .48);
        ctx.beginPath();
        for (let x = -124; x <= 124; x += 8) ctx.lineTo(x, sweep(x));
        for (let x = 124; x >= -124; x -= 8) {
          const height = Math.cos(x / 124 * 1.57) * (68 - inward * 22 + outward * 38);
          ctx.lineTo(x, sweep(x) - height);
        }
        ctx.fill();
        ctx.strokeStyle = layer === 1 ? palette.highlight : '#8fffe3';
        ctx.lineWidth = .75 + outward + motion.features.rim * .26;
        ctx.beginPath();
        for (let x = -124; x <= 124; x += 8) ctx.lineTo(x, sweep(x));
        ctx.stroke();
      }
    } else if (variant === 'ink-in-water') {
      ctx.scale(aperture, aperture);
      ctx.rotate(Math.sin(phase * .5) * .15);
      for (let plume = 0; plume < 15; plume++) {
        const turn = plume * .49 + phase * .42;
        const reach = 57 + plume * 2.1 + outward * 36 - inward * 25;
        const drift = Math.sin(turn) * 32 + motion.x * 25;
        const tilt = Math.cos(turn * .83) * 29 - motion.y * 25;
        const wash = ctx.createLinearGradient(-35, 32, drift, -reach);
        wash.addColorStop(0, plume % 2 ? palette.glow : '#5de7e0');
        wash.addColorStop(.59, plume % 2 ? palette.shadow : '#324f9a');
        wash.addColorStop(1, '#5389b600');
        ctx.strokeStyle = wash;
        ctx.globalAlpha = (.14 + motion.features.rim * .08) * (1 - quiet * .48);
        ctx.lineWidth = 6 + (plume % 4) * 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-11, 37);
        ctx.bezierCurveTo(45 + drift, 15, drift + tilt, -reach * .63, -drift, -reach);
        ctx.bezierCurveTo(-drift - 40, -reach - 18, -drift - 50, -reach + 4, -drift - 15, -reach + 22);
        ctx.stroke();
      }
    } else if (variant === 'silk-veil') {
      const width = 78 * (1 - inward * .34 + outward * .18 + motion.features.recoil * .26);
      const pull = 31 + motion.x * 31 + outward * 38;
      for (let strip = 0; strip < 29; strip++) {
        const x = (strip / 28 * 2 - 1) * width;
        const fold = Math.sin(strip * .51 + phase * 2) * (14 + outward * 17);
        const textile = ctx.createLinearGradient(x - 19, -72, x + pull, 81);
        textile.addColorStop(0, palette.shadow);
        textile.addColorStop(.42 + Math.sin(strip * .49) * .18, palette.highlight);
        textile.addColorStop(.77, palette.glow);
        textile.addColorStop(1, palette.shadow);
        ctx.strokeStyle = strip === 0 || strip === 28 ? palette.highlight : textile;
        ctx.lineWidth = 1 + (strip === 0 || strip === 28 ? motion.features.rim : 5.2);
        ctx.globalAlpha = (.73 + .21 * Math.cos(strip * .78)) * (1 - quiet * .50);
        ctx.beginPath();
        ctx.moveTo(x - 18,-72 - x * .18);
        ctx.bezierCurveTo(x - 35 + fold,-20 - x * .14, x + pull + fold,30 + x * .14, x + pull + fold * .85,78 + x * .14);
        ctx.stroke();
      }
    } else if (variant === 'stardust') {
      ctx.rotate(-0.31);
      for (let index = 0; index < points.length; index += lightweight ? 3 : 1) {
        const [angle, radius, hue] = points[index];
        const offset = angle + phase * (0.1 + hue * 0.24);
        const spread = (35 + radius * 70) * aperture;
        ctx.fillStyle = hue > 0.66 ? palette.highlight : palette.glow;
        ctx.globalAlpha = (0.22 + hue * 0.65) * (1 - quiet * 0.6);
        ctx.fillRect(Math.cos(offset) * spread, Math.sin(offset) * spread * (0.28 + hue * 0.5), 0.7 + hue * 1.5, 0.7 + hue * 1.5);
      }
    } else if (variant === 'bloom') {
      for (let ring = 0; ring < 3; ring++) {
        const radius = (92 - ring * 23) * aperture;
        for (let i = 0; i < 8; i++) {
          ctx.save();
          ctx.rotate(i * TAU / 8 + ring * 0.3 + Math.sin(phase * 0.55) * 0.11);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(-radius * 0.55, -radius * 0.37, -radius * 0.31, -radius, 2, -radius);
          ctx.bezierCurveTo(radius * 0.45, -radius * 0.87, radius * 0.32, -radius * 0.23, 0, 0);
          ctx.fill();
          ctx.strokeStyle = palette.glow;
          ctx.lineWidth = 0.65;
          ctx.stroke();
          ctx.restore();
        }
      }
    } else if (variant === 'prism') {
      ctx.rotate(-0.23);
      ctx.scale(1, 0.68);
      for (let i = 0; i < 26; i++) {
        ctx.save();
        ctx.rotate(i * TAU / 26 + phase * 0.12);
        const size = 13 + Math.sin(i * 2) * 8 + outward * motion.audio.output.spectrum[i] * 40;
        ctx.beginPath();
        ctx.moveTo(-5, -65);
        ctx.lineTo(2, -65 - size);
        ctx.lineTo(7, -65);
        ctx.lineTo(1, -58);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (variant === 'silk') {
      ctx.rotate(.13);
      const bundles=lightweight?20:32;
      for(let strand=0;strand<bundles;strand++){
        const lane=strand*2/(bundles-1)-1;
        const draw=(1-.46*inward+.18*outward);
        const wash=ctx.createLinearGradient(-117,-28,118,29);
        wash.addColorStop(0,'transparent');wash.addColorStop(.17,palette.shadow);
        wash.addColorStop(.40+lane*.045,palette.highlight);wash.addColorStop(.66,palette.glow);
        wash.addColorStop(.89,palette.shadow);wash.addColorStop(1,'transparent');
        ctx.strokeStyle=wash;
        ctx.lineWidth=2.9;
        ctx.beginPath();
        for(let i=0;i<=36;i++){
          const u=i/36, p=6.06*u-motion.phase*1.44+lane*.41-.76;
          const y=lane*(.46+.12*Math.sin(Math.PI*u))*54*draw
            +(21+outward*7)*Math.sin(p)+6*Math.sin(u*3.16-motion.phase*.73-lane*.20+1.04)+(u-.5)*12;
          if(i===0)ctx.moveTo((u-.5)*238,y);else ctx.lineTo((u-.5)*238,y);
        }
        ctx.stroke();
      }
    } else if (variant === 'contour') {
      ctx.rotate(.28);
      for (let strand = 0; strand < 17; strand++) {
        const shift = (strand - 8) * 3.7;
        ctx.lineWidth = 3.25;
        ctx.beginPath();
        const steps = lightweight ? 48 : 96;
        for (let j = 0; j <= steps; j++) {
          const a = j * TAU / steps;
          const radius = (71 + shift * 0.5 + Math.sin(a * 3 + phase * 0.45) * (19 + speak * 13)) * aperture;
          const x = radius * Math.cos(a);
          const y = radius * Math.sin(a) * 0.77 + Math.cos(a * 2) * shift * 0.5;
          if (!j) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
    } else if (variant === 'lumen') {
      const radius = 73 * (1 + breath * .38 - inward * .036 + outward * .024 + motion.features.recoil * .067);
      const shell = ctx.createRadialGradient(-radius*.29,-radius*.31,radius*.04,0,0,radius*1.07);
      shell.addColorStop(0,'#455269'); shell.addColorStop(.54,'#1e2034'); shell.addColorStop(.84,'#131522'); shell.addColorStop(1,'#745f82');
      ctx.beginPath();ctx.arc(0,0,radius,0,TAU);
      ctx.fillStyle=shell;ctx.fill();ctx.clip();
      const x=Math.sin(motion.phase*.73)*8+motion.x*7, y=11+Math.cos(motion.phase*.88)*5+motion.y*5;
      const span=radius*(.47+outward*.25-inward*.25);
      const core=ctx.createRadialGradient(x,y,0,x,y,span);
      core.addColorStop(0,'#fff1f0');core.addColorStop(.25,inward>.08?'#8ed6ff':palette.highlight);
      core.addColorStop(.53,palette.glow);core.addColorStop(1,'transparent');
      ctx.globalAlpha=(.82+outward*.18)*(1-quiet*.52);ctx.fillStyle=core;ctx.fillRect(-radius,-radius,radius*2,radius*2);
      const box=ctx.createRadialGradient(-radius*.43,-radius*.48,0,-radius*.43,-radius*.48,radius*.42);
      box.addColorStop(0,'#fffcf8f1');box.addColorStop(.42,'#c3d7ffa0');box.addColorStop(1,'transparent');
      ctx.fillStyle=box;ctx.fillRect(-radius,-radius,radius*2,radius*2);
      const rim=ctx.createLinearGradient(-radius,-radius,radius,radius);
      rim.addColorStop(0,'#a9d6fc');rim.addColorStop(.44,'#ad8ad3');rim.addColorStop(1,palette.highlight);
      ctx.beginPath();ctx.arc(0,0,radius-.85,0,TAU);ctx.lineWidth=1.8+motion.features.rim*.5;ctx.strokeStyle=rim;ctx.stroke();
    } else {
      const radius = (variant === 'mirror' ? 72 : 68) * aperture;
      ctx.shadowBlur = lightweight ? 0 : 22 + outward * 8;
      ctx.shadowColor = palette.shadow;
      ctx.lineWidth = variant === 'mirror' ? 8 : 1 + motion.features.rim * 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = palette.highlight;
      ctx.stroke();
      ctx.shadowBlur = 0;
      for (let i = 0; i < 5; i++) {
        ctx.globalAlpha = 0.36 - i * 0.057;
        ctx.beginPath();
        ctx.ellipse(Math.sin(phase + i) * 9, i * 7 - 13, radius * (0.35 + i * 0.1), 8 + i * 5, -0.35, 0, TAU);
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }
    ctx.restore();
  };
}
