/**
 * Cache de sprites das pecas.
 *
 * Cada combinacao de forma, material e tema e desenhada uma unica vez num
 * canvas fora da tela, com o brilho ja embutido. Durante o jogo as pecas so
 * transladam e giram, entao cada quadro e um drawImage sob transformacao.
 * E o que permite ter o traco neon da referencia sem shader e com folga de
 * desempenho em celular de entrada.
 */

import { outlineLoops, bounds } from '../physics/shapes.js';
import { Rng, hashSeed } from '../core/rng.js';

/**
 * Desenha um poligono fechado com cantos arredondados.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[][]} loop
 * @param {number} scale pixels por celula
 * @param {number} radius em pixels
 * @param {number} ox
 * @param {number} oy origem, ja no topo do sprite (eixo y invertido)
 */
function traceLoop(ctx, loop, scale, radius, ox, oy) {
  const n = loop.length;
  if (n < 3) return;
  /** @param {number} i @returns {number[]} */
  const pt = (i) => {
    const p = loop[((i % n) + n) % n];
    return [ox + p[0] * scale, oy - p[1] * scale];
  };
  const a = pt(0);
  const b = pt(1);
  ctx.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  for (let i = 1; i <= n; i++) {
    const cur = pt(i);
    const next = pt(i + 1);
    ctx.arcTo(cur[0], cur[1], (cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2, radius);
  }
  ctx.closePath();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[][][]} loops
 * @param {number} scale
 * @param {number} radius
 * @param {number} ox
 * @param {number} oy
 */
function tracePiece(ctx, loops, scale, radius, ox, oy) {
  ctx.beginPath();
  for (const loop of loops) traceLoop(ctx, loop, scale, radius, ox, oy);
}

/**
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
function withAlpha(hex, alpha) {
  if (hex.startsWith('rgba')) return hex;
  if (hex.startsWith('rgb')) return hex.replace('rgb', 'rgba').replace(')', `,${alpha})`);
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Pinta a peca no estilo do tema.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./themes.js').Theme} th
 * @param {string} materialId
 * @param {[number,number][]} cells
 * @param {number} scale pixels por celula
 * @param {number} ox
 * @param {number} oy
 * @param {number} seed
 */
function paintPiece(ctx, th, materialId, cells, scale, ox, oy, seed) {
  const style = th.materials[materialId] || th.materials.wood;
  const loops = outlineLoops(cells);
  const radius = Math.max(1.5, scale * th.corner);
  const b = bounds(cells);
  const w = b.w * scale;
  const h = b.h * scale;
  const rng = new Rng(seed);

  tracePiece(ctx, loops, scale, radius, ox, oy);

  switch (th.style) {
    case 'neon': {
      ctx.fillStyle = style.fill;
      ctx.fill('evenodd');
      ctx.save();
      ctx.shadowColor = style.stroke;
      ctx.shadowBlur = scale * 0.42;
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = Math.max(1.6, scale * 0.075);
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.stroke();
      ctx.restore();
      if (style.inner) {
        ctx.save();
        ctx.strokeStyle = style.inner;
        ctx.lineWidth = Math.max(1, scale * 0.03);
        ctx.globalAlpha = 0.9;
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    case 'plate': {
      const grad = ctx.createLinearGradient(ox, oy - h, ox, oy);
      grad.addColorStop(0, withAlpha(style.fill, 1));
      grad.addColorStop(1, withAlpha(style.stroke, 0.32));
      ctx.fillStyle = grad;
      ctx.fill('evenodd');
      ctx.save();
      ctx.clip('evenodd');
      ctx.strokeStyle = withAlpha(style.stroke, 0.22);
      ctx.lineWidth = 1;
      for (let i = 1; i < b.h * 3; i++) {
        const y = oy - (i * scale) / 3;
        ctx.beginPath();
        ctx.moveTo(ox, y);
        ctx.lineTo(ox + w, y);
        ctx.stroke();
      }
      ctx.restore();
      tracePiece(ctx, loops, scale, radius, ox, oy);
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = Math.max(1.4, scale * 0.05);
      ctx.stroke();
      break;
    }

    case 'grain': {
      ctx.fillStyle = style.fill;
      ctx.fill('evenodd');
      ctx.save();
      ctx.clip('evenodd');
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = Math.max(1, scale * 0.035);
      for (let i = 0; i < b.h * 4 + 3; i++) {
        const y = oy - rng.range(0, h);
        ctx.beginPath();
        ctx.moveTo(ox, y);
        for (let x = 0; x <= w; x += scale * 0.28) {
          ctx.lineTo(ox + x, y + Math.sin(x * 0.07 + i) * scale * 0.035);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 0.16;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(ox + rng.range(0, w), oy - rng.range(0, h), scale * rng.range(0.05, 0.12), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      tracePiece(ctx, loops, scale, radius, ox, oy);
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = Math.max(1.6, scale * 0.065);
      ctx.stroke();
      break;
    }

    case 'gloss': {
      ctx.fillStyle = style.fill;
      ctx.fill('evenodd');
      ctx.save();
      ctx.clip('evenodd');
      const g = ctx.createLinearGradient(ox, oy - h, ox, oy - h * 0.35);
      g.addColorStop(0, withAlpha(style.top || '#ffffff', 0.85));
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(ox, oy - h, w, h * 0.65);
      ctx.restore();
      tracePiece(ctx, loops, scale, radius, ox, oy);
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = Math.max(1.8, scale * 0.07);
      ctx.stroke();
      break;
    }

    case 'frost': {
      ctx.fillStyle = style.fill;
      ctx.fill('evenodd');
      ctx.save();
      ctx.clip('evenodd');
      ctx.fillStyle = withAlpha(style.top || '#ffffff', 0.5);
      for (let i = 0; i < 14; i++) {
        const px = ox + rng.range(0, w);
        const py = oy - rng.range(0, h);
        const s = scale * rng.range(0.02, 0.06);
        ctx.fillRect(px, py, s, s);
      }
      const g = ctx.createLinearGradient(ox, oy - h, ox, oy);
      g.addColorStop(0, 'rgba(255,255,255,0.32)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(ox, oy - h, w, h);
      ctx.restore();
      tracePiece(ctx, loops, scale, radius, ox, oy);
      ctx.save();
      ctx.shadowColor = style.stroke;
      ctx.shadowBlur = scale * 0.2;
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = Math.max(1.5, scale * 0.06);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'ember': {
      ctx.fillStyle = style.fill;
      ctx.fill('evenodd');
      ctx.save();
      ctx.clip('evenodd');
      ctx.strokeStyle = withAlpha(style.stroke, 0.75);
      ctx.lineWidth = Math.max(1, scale * 0.045);
      ctx.shadowColor = style.stroke;
      ctx.shadowBlur = scale * 0.25;
      for (let i = 0; i < 3; i++) {
        let px = ox + rng.range(0, w);
        let py = oy - rng.range(0, h);
        ctx.beginPath();
        ctx.moveTo(px, py);
        for (let k = 0; k < 4; k++) {
          px += rng.range(-scale * 0.4, scale * 0.4);
          py += rng.range(-scale * 0.4, scale * 0.4);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
      tracePiece(ctx, loops, scale, radius, ox, oy);
      ctx.save();
      ctx.shadowColor = style.stroke;
      ctx.shadowBlur = scale * 0.2;
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = Math.max(1.6, scale * 0.07);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'paper': {
      ctx.save();
      ctx.shadowColor = 'rgba(70,55,35,0.42)';
      ctx.shadowBlur = scale * 0.16;
      ctx.shadowOffsetY = scale * 0.08;
      ctx.fillStyle = style.fill;
      ctx.fill('evenodd');
      ctx.restore();
      ctx.save();
      ctx.clip('evenodd');
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = style.stroke;
      for (let i = 0; i < 26; i++) {
        ctx.fillRect(ox + rng.range(0, w), oy - rng.range(0, h), 1.4, 1.4);
      }
      ctx.restore();
      tracePiece(ctx, loops, scale, radius, ox, oy);
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = Math.max(1.4, scale * 0.045);
      ctx.stroke();
      break;
    }

    default: {
      // flat
      ctx.fillStyle = style.fill;
      ctx.fill('evenodd');
      ctx.save();
      ctx.clip('evenodd');
      ctx.fillStyle = withAlpha(style.top || '#ffffff', 0.35);
      ctx.fillRect(ox, oy - h, w, Math.max(2, scale * 0.12));
      ctx.restore();
      tracePiece(ctx, loops, scale, radius, ox, oy);
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = Math.max(1.6, scale * 0.065);
      ctx.stroke();
    }
  }
}

export class SpriteCache {
  /**
   * @param {import('./themes.js').Theme} theme
   * @param {number} pxPerMeter
   * @param {number} dpr
   */
  constructor(theme, pxPerMeter, dpr) {
    this.theme = theme;
    this.px = pxPerMeter;
    this.dpr = Math.min(2, dpr || 1);
    /** @type {Map<string, {canvas: HTMLCanvasElement, w:number, h:number, pad:number}>} */
    this.map = new Map();
  }

  /**
   * @param {[number,number][]} cells
   * @param {string} materialId
   * @returns {{canvas: HTMLCanvasElement, w:number, h:number, pad:number}}
   */
  piece(cells, materialId) {
    const key = cells.map((c) => c[0] + ',' + c[1]).join(';') + '|' + materialId;
    const hit = this.map.get(key);
    if (hit) return hit;

    const th = this.theme;
    const scale = this.px * this.dpr;
    const b = bounds(cells);
    const pad = Math.ceil(scale * (0.32 + th.glow * 0.4));
    const cw = Math.ceil(b.w * scale + pad * 2);
    const ch = Math.ceil(b.h * scale + pad * 2);
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    paintPiece(ctx, th, materialId, cells, scale, pad, ch - pad, hashSeed(key));

    const entry = { canvas, w: cw / this.dpr, h: ch / this.dpr, pad: pad / this.dpr };
    this.map.set(key, entry);
    return entry;
  }

  /**
   * Sprite do hexagono, com a skin aplicada.
   * @param {number} radiusMeters
   * @param {import('../game/content.js').Skin} skin
   * @returns {{canvas: HTMLCanvasElement, w:number, h:number}}
   */
  hexagon(radiusMeters, skin) {
    const key = 'hex|' + radiusMeters.toFixed(3) + '|' + skin.id;
    const hit = this.map.get(key);
    if (hit) return hit;

    const th = this.theme;
    const scale = this.px * this.dpr;
    const r = radiusMeters * scale;
    const pad = Math.ceil(r * (0.35 + th.glow * 0.5));
    const size = Math.ceil(r * 2 + pad * 2);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    const cx = size / 2;
    const cy = size / 2;

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const x = cx + r * Math.cos(a);
      const y = cy - r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    const stroke = skin.stroke || th.hexagon.stroke;
    const core = skin.core || th.hexagon.core;
    const fill = skin.fill || th.hexagon.fill;

    // Nos temas claros o hexagono sumiria no fundo; uma sombra projetada
    // sob a peca resolve sem precisar escurecer a paleta.
    if (th.glow < 0.4) {
      ctx.save();
      ctx.shadowColor = 'rgba(30,25,45,0.4)';
      ctx.shadowBlur = r * 0.35;
      ctx.shadowOffsetY = r * 0.12;
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
    }
    const glow = ctx.createRadialGradient(cx, cy - r * 0.12, r * 0.05, cx, cy, r * 1.05);
    glow.addColorStop(0, core);
    glow.addColorStop(0.5, withAlpha(core, th.glow > 0.4 ? 0.55 : 0.82));
    glow.addColorStop(1, fill);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.save();
    ctx.shadowColor = stroke;
    ctx.shadowBlur = r * (0.25 + th.glow * 0.5);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(2, r * 0.11);
    ctx.lineJoin = 'round';
    ctx.stroke();
    if (th.glow > 0.4) ctx.stroke();
    ctx.restore();

    if (skin.mark) skin.mark(ctx, cx, cy, r, th);

    const entry = { canvas, w: size / this.dpr, h: size / this.dpr, pad: pad / this.dpr };
    this.map.set(key, entry);
    return entry;
  }

  clear() {
    this.map.clear();
  }
}
