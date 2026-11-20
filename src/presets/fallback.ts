import type { PresetName } from './catalog.js';
import { randomFor, energy } from './runtime.js';
import type { SceneInputs } from './runtime.js';

const TAU = Math.PI * 2;

export function fallbackRenderer(variant: PresetName, seed: number) {
  const random = randomFor(seed);
  const points = variant === 'stardust' ? Array.from({ length: 520 }, () => [random() * TAU, Math.sqrt(random()), random()]) : [];
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

    if (variant === 'dock') {
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
    } else if (variant === 'silk' || variant === 'contour') {
      ctx.rotate(variant === 'silk' ? -0.28 + Math.sin(phase * 0.67) * 0.07 : 0.28);
      for (let strand = 0; strand < 17; strand++) {
        const separation = variant === 'silk' ? 1 - inward * .55 + outward * .28 : 1;
        const shift = (strand - 8) * 3.7 * separation;
        ctx.lineWidth = variant === 'contour' ? 3.25 : 2.1;
        ctx.beginPath();
        if (variant === 'silk') {
          ctx.moveTo(-119, -30 + shift * 0.8);
          const fold = outward * Math.sin(phase * 3.6 - strand * 0.15) + motion.features.recoil * 7;
          ctx.bezierCurveTo(-53, -70 + shift, -30, 58 - shift * aperture, 20, 34 + shift * 0.7 + fold * 9);
          ctx.bezierCurveTo(59, 6 + shift + listen * 12, 83, -45 + shift, 120, -48 + shift * 0.55);
        } else {
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
        }
        if (variant === 'silk' && (strand === 0 || strand === 16) && motion.features.rim > 0) {
          ctx.strokeStyle = palette.highlight;
          ctx.globalAlpha = 0.45 + motion.features.rim * 0.35;
          ctx.stroke();
          ctx.strokeStyle = light;
          ctx.globalAlpha = 1 - quiet * 0.48;
        } else ctx.stroke();
      }
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
