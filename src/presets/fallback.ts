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
    const breath = Math.sin(phase * 1.55) * 0.018;
    const aperture = 1 + breath - inward * 0.16 + outward * 0.14 + motion.pulse * 0.09;
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
      const length = 103 + outward * 14 - inward * 5 + open * 15;
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
      ctx.stroke();
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
          const signal = frame * (5.6 + outward * 13 + inward * 7) * drift * shape
            + frame * (listen * (0.5 - u) * 10 + speak * Math.sin(u * 16) * 8 + motion.pulse * 8 * Math.sin(u * 12 - phase * 8));
          const px = -42 + u * (length + 26);
          const py = signal + (strand - 2.5) * 2.0;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
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
        const shift = (strand - 8) * 3.7;
        ctx.lineWidth = variant === 'contour' ? 3.25 : 2.1;
        ctx.beginPath();
        if (variant === 'silk') {
          ctx.moveTo(-119, -30 + shift * 0.8);
          const fold = outward * Math.sin(phase * 3.6 - strand * 0.15);
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
        ctx.stroke();
      }
    } else {
      const radius = (variant === 'mirror' ? 72 : 68) * aperture;
      ctx.shadowBlur = lightweight ? 0 : 22 + outward * 8;
      ctx.shadowColor = palette.shadow;
      ctx.lineWidth = variant === 'mirror' ? 8 : 1;
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
