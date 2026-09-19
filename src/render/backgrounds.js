/**
 * Cenarios. Cada tema pinta o seu proprio fundo.
 *
 * O fundo e desenhado num canvas fora da tela e so refeito quando a janela
 * muda de tamanho. O parallax vertical vem de deslocar esse canvas, nao de
 * repintar tudo a cada quadro.
 */

import { Rng } from '../core/rng.js';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./themes.js').Theme} th
 * @param {number} w
 * @param {number} h
 */
function sky(ctx, th, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const stops = th.sky;
  for (let i = 0; i < stops.length; i++) {
    g.addColorStop(i / (stops.length - 1), stops[i]);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Grade em perspectiva, a marca do estilo synthwave.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./themes.js').Theme} th
 * @param {number} w
 * @param {number} h
 * @param {number} horizonY
 */
function perspectiveGrid(ctx, th, w, h, horizonY) {
  ctx.save();
  ctx.strokeStyle = th.grid;
  ctx.lineWidth = 1;
  const vanishX = w / 2;
  for (let i = -14; i <= 14; i++) {
    const x = vanishX + i * (w / 9);
    ctx.beginPath();
    ctx.moveTo(vanishX + i * 6, horizonY);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  let y = horizonY;
  let step = (h - horizonY) * 0.035;
  let guard = 0;
  while (y < h && guard++ < 40) {
    ctx.globalAlpha = Math.min(1, (y - horizonY) / (h - horizonY) + 0.12);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    y += step;
    step *= 1.22;
  }
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} baseY
 * @param {string} color
 * @param {Rng} rng
 * @param {number} height
 * @param {number} count
 */
function mountains(ctx, w, baseY, color, rng, height, count) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-10, baseY);
  let x = -10;
  for (let i = 0; i < count; i++) {
    const peakW = w / count;
    const peak = rng.range(height * 0.45, height);
    ctx.lineTo(x + peakW / 2, baseY - peak);
    x += peakW;
    ctx.lineTo(x, baseY - rng.range(0, height * 0.18));
  }
  ctx.lineTo(w + 10, baseY);
  ctx.closePath();
  ctx.fill();
}

/**
 * Pinta o cenario completo de um tema.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./themes.js').Theme} th
 * @param {number} w
 * @param {number} h
 */
export function paintBackground(ctx, th, w, h) {
  const rng = new Rng('bg|' + th.id);
  sky(ctx, th, w, h);
  const horizonY = h * 0.56;

  switch (th.id) {
    // O sol synthwave e a assinatura do mundo, mas ele nasce exatamente atras
    // da coluna de jogo: brilhante e listrado como era, as faixas cruzavam as
    // pecas e o jogador nao sabia mais o que era cenario e o que era torre.
    // Aqui ele continua inteiro - so que menor, mais fundo na paleta e coberto
    // por uma bruma no miolo da tela. Cenario e cenario; a cor viva fica para
    // as pecas.
    case 'neon': {
      const glow = ctx.createRadialGradient(w / 2, horizonY, 0, w / 2, horizonY, w * 0.62);
      glow.addColorStop(0, 'rgba(210,40,130,0.24)');
      glow.addColorStop(0.45, 'rgba(120,30,150,0.12)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      const sunR = w * 0.17;
      ctx.save();
      ctx.globalAlpha = 0.5;
      const sun = ctx.createLinearGradient(0, horizonY - sunR, 0, horizonY);
      sun.addColorStop(0, '#ff9f4a');
      sun.addColorStop(0.5, '#e8407f');
      sun.addColorStop(1, '#5a17b0');
      ctx.fillStyle = sun;
      ctx.beginPath();
      ctx.arc(w / 2, horizonY, sunR, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 1; i < 7; i++) {
        const y = horizonY - sunR + (i * sunR) / 6.5;
        ctx.fillRect(0, y, w, sunR * 0.05 * i * 0.5);
      }
      ctx.restore();
      mountains(ctx, w, horizonY + 1, 'rgba(38,10,54,0.92)', rng, h * 0.1, 7);
      ctx.fillStyle = th.ground;
      ctx.fillRect(0, horizonY, w, h - horizonY);
      perspectiveGrid(ctx, th, w, h, horizonY);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 40; i++) {
        ctx.globalAlpha = rng.range(0.15, 0.6);
        ctx.fillRect(rng.range(0, w), rng.range(0, horizonY * 0.8), 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
      // Bruma no eixo da torre. E o inverso da vinheta do renderizador, que
      // escurece as bordas: aqui o miolo - onde tudo acontece - e que precisa
      // ficar calmo, e as pontas do sol continuam aparecendo dos lados.
      const bruma = ctx.createRadialGradient(w / 2, horizonY, 0, w / 2, horizonY, w * 0.42);
      bruma.addColorStop(0, 'rgba(8,4,24,0.5)');
      bruma.addColorStop(0.7, 'rgba(8,4,24,0.28)');
      bruma.addColorStop(1, 'rgba(8,4,24,0)');
      ctx.fillStyle = bruma;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    case 'futuristic': {
      ctx.strokeStyle = th.grid;
      ctx.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const y = rng.range(0, h);
        ctx.globalAlpha = rng.range(0.15, 0.5);
        ctx.beginPath();
        ctx.moveTo(0, y);
        let x = 0;
        while (x < w) {
          const seg = rng.range(w * 0.06, w * 0.2);
          ctx.lineTo(x + seg, y);
          const jump = rng.chance(0.5) ? -1 : 1;
          ctx.lineTo(x + seg, y + jump * rng.range(4, 18));
          x += seg;
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const beam = ctx.createLinearGradient(0, horizonY - h * 0.2, 0, h);
      beam.addColorStop(0, 'rgba(46,230,196,0)');
      beam.addColorStop(0.6, 'rgba(46,230,196,0.12)');
      beam.addColorStop(1, 'rgba(91,140,255,0.2)');
      ctx.fillStyle = beam;
      ctx.fillRect(0, horizonY - h * 0.2, w, h);
      ctx.fillStyle = 'rgba(46,230,196,0.9)';
      for (let i = 0; i < 18; i++) {
        ctx.globalAlpha = rng.range(0.25, 0.8);
        const s = rng.range(2, 4);
        ctx.fillRect(rng.range(0, w), rng.range(0, h), s, s);
      }
      ctx.globalAlpha = 1;
      break;
    }

    case 'rustic': {
      ctx.fillStyle = 'rgba(255,220,160,0.22)';
      ctx.beginPath();
      ctx.arc(w * 0.72, h * 0.2, w * 0.14, 0, Math.PI * 2);
      ctx.fill();
      mountains(ctx, w, horizonY, 'rgba(90,62,38,0.65)', rng, h * 0.14, 5);
      mountains(ctx, w, horizonY + h * 0.06, 'rgba(58,40,24,0.9)', rng, h * 0.1, 8);
      ctx.fillStyle = th.ground;
      ctx.fillRect(0, horizonY + h * 0.06, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 2;
      for (let y = horizonY + h * 0.09; y < h; y += h * 0.05) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= w; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.02) * 3);
        ctx.stroke();
      }
      break;
    }

    case 'classic': {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 5; i++) {
        const cx = rng.range(0, w);
        const cy = rng.range(h * 0.08, h * 0.42);
        const r = rng.range(w * 0.06, w * 0.14);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.arc(cx + r * 0.8, cy + r * 0.15, r * 0.75, 0, Math.PI * 2);
        ctx.arc(cx - r * 0.8, cy + r * 0.2, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = th.ground;
      ctx.fillRect(0, h * 0.78, w, h);
      break;
    }

    case 'candy': {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 6; i++) {
        const cx = rng.range(0, w);
        const cy = rng.range(h * 0.05, h * 0.4);
        const r = rng.range(w * 0.07, w * 0.16);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.arc(cx + r * 0.7, cy + r * 0.1, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      const colors = ['#ff8ec4', '#8ee6ff', '#ffe58e', '#a8ffc0', '#d3a8ff'];
      for (let i = 0; i < 46; i++) {
        ctx.save();
        ctx.translate(rng.range(0, w), rng.range(0, h));
        ctx.rotate(rng.range(0, Math.PI));
        ctx.fillStyle = colors[Math.floor(rng.range(0, colors.length))];
        ctx.globalAlpha = 0.6;
        ctx.fillRect(-5, -1.6, 10, 3.2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = th.ground;
      ctx.fillRect(0, h * 0.82, w, h);
      break;
    }

    case 'ice': {
      const aurora = ctx.createLinearGradient(0, 0, w, h * 0.5);
      aurora.addColorStop(0, 'rgba(127,227,255,0.0)');
      aurora.addColorStop(0.4, 'rgba(127,227,255,0.22)');
      aurora.addColorStop(0.7, 'rgba(160,255,220,0.16)');
      aurora.addColorStop(1, 'rgba(127,227,255,0)');
      ctx.fillStyle = aurora;
      ctx.fillRect(0, 0, w, h * 0.6);
      mountains(ctx, w, horizonY + h * 0.05, 'rgba(180,220,240,0.35)', rng, h * 0.16, 5);
      mountains(ctx, w, horizonY + h * 0.12, 'rgba(120,170,200,0.5)', rng, h * 0.1, 7);
      ctx.fillStyle = '#e8f7ff';
      ctx.fillRect(0, h * 0.86, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 70; i++) {
        ctx.globalAlpha = rng.range(0.25, 0.85);
        const s = rng.range(1.5, 3.2);
        ctx.beginPath();
        ctx.arc(rng.range(0, w), rng.range(0, h), s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }

    case 'lava': {
      const glow = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, h * 0.8);
      glow.addColorStop(0, 'rgba(255,110,20,0.6)');
      glow.addColorStop(0.5, 'rgba(180,40,10,0.22)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      mountains(ctx, w, horizonY + h * 0.08, 'rgba(20,8,6,0.95)', rng, h * 0.2, 4);
      ctx.strokeStyle = 'rgba(255,120,30,0.65)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff7a1a';
      ctx.shadowBlur = 12;
      for (let i = 0; i < 9; i++) {
        let x = rng.range(0, w);
        let y = h * rng.range(0.6, 1);
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += rng.range(-40, 40);
          y -= rng.range(6, 26);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,170,60,0.85)';
      for (let i = 0; i < 26; i++) {
        ctx.globalAlpha = rng.range(0.2, 0.75);
        ctx.beginPath();
        ctx.arc(rng.range(0, w), rng.range(h * 0.25, h), rng.range(1, 2.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }

    case 'paper':
    default: {
      ctx.fillStyle = 'rgba(160,140,100,0.1)';
      for (let i = 0; i < 900; i++) {
        ctx.fillRect(rng.range(0, w), rng.range(0, h), 1.2, 1.2);
      }
      ctx.strokeStyle = 'rgba(120,100,70,0.12)';
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 26) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.16, w * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = th.ground;
      ctx.fillRect(0, h * 0.84, w, h);
      ctx.strokeStyle = 'rgba(90,75,55,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.84);
      for (let x = 0; x <= w; x += 18) ctx.lineTo(x, h * 0.84 + Math.sin(x * 0.05) * 2.5);
      ctx.stroke();
      break;
    }
  }
}
