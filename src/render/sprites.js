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
import { material as getMaterial } from '../physics/materials.js';
import { hashSeed } from '../core/rng.js';
import { tileOf } from './textures.js';

/**
 * Desenha um poligono fechado com cantos arredondados.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[][]} loop
 * @param {number} scale pixels por celula
 * @param {number} radius em pixels
 * @param {number} ox
 * @param {number} oy origem, ja no topo do sprite (eixo y invertido)
 */
export function traceLoop(ctx, loop, scale, radius, ox, oy) {
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
export function tracePiece(ctx, loops, scale, radius, ox, oy) {
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
 * Faixas de perigo da TNT.
 *
 * Cor sozinha nao basta: no neon a TNT laranja ao lado da madeira ambar sao
 * dois quadrados parecidos, e confundir as duas custa a fase - a TNT detona
 * com qualquer queda forte. A listra diagonal e o sinal universal de "isto
 * explode" e aparece igual nos oito temas, sempre na propria cor do material.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./themes.js').PieceStyle} style
 * @param {number} ox
 * @param {number} oy
 * @param {number} w
 * @param {number} h
 * @param {number} scale
 */
function hazardStripes(ctx, style, ox, oy, w, h, scale) {
  ctx.save();
  ctx.clip('evenodd');
  // O traco, nao o realce: em tema claro o realce e quase branco e a listra
  // sumia justamente onde ela mais precisa aparecer.
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = scale * 0.16;
  const passo = scale * 0.46;
  for (let x = -h; x < w + h; x += passo) {
    ctx.beginPath();
    ctx.moveTo(ox + x, oy);
    ctx.lineTo(ox + x + h, oy - h);
    ctx.stroke();
  }
  ctx.restore();
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
  const mat = getMaterial(materialId);

  tracePiece(ctx, loops, scale, radius, ox, oy);
  ctx.fillStyle = style.fill;
  ctx.fill('evenodd');

  ctx.save();
  ctx.clip('evenodd');
  const tile = tileOf(materialId, Math.max(40, scale * 2.2));
  if (tile) {
    const pat = ctx.createPattern(tile, 'repeat');
    if (pat) {
      ctx.fillStyle = pat;
      // O desvio troca a fase do veio de peca para peca. O retangulo anda
      // junto: sem somar o desvio de volta, a translacao deixava a direita e
      // a base de toda peca menor que o desvio sem textura nenhuma - o corte
      // reto aparecia no meio da pedra e do obsidiano.
      const off = (seed >>> 0) % 72;
      ctx.save();
      ctx.translate(-off, -off);
      ctx.fillRect(ox - scale + off, oy - h - scale + off, w + scale * 2, h + scale * 2);
      ctx.restore();
    }
  }
  // Luz do mundo, nao da peca: um velo da cor do horizonte. A peca vira e
  // o veio vai junto; o velo e homogeneo, entao nao denuncia o "cima".
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = withAlpha(th.horizon, 0.22);
  ctx.fillRect(ox, oy - h, w, h);
  ctx.globalCompositeOperation = 'source-over';
  if (materialId === 'tnt') {
    ctx.fillStyle = 'rgba(196, 90, 24, 0.28)';
    ctx.fillRect(ox, oy - h, w, h);
  }
  if (materialId === 'bomb') {
    let sx = 0;
    let sy = 0;
    for (const [cx, cy] of cells) {
      sx += cx + 0.5;
      sy += cy + 0.5;
    }
    const n = cells.length || 1;
    const bx = ox + (sx / n) * scale;
    const by = oy - (sy / n) * scale;
    ctx.fillStyle = '#140a08';
    ctx.beginPath();
    ctx.arc(bx, by, scale * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = Math.max(1.2, scale * 0.05);
    ctx.beginPath();
    ctx.moveTo(bx, by - scale * 0.16);
    ctx.lineTo(bx + scale * 0.1, by - scale * 0.34);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = Math.max(1, scale * 0.05);
  tracePiece(ctx, loops, scale, radius, ox, oy);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  if (th.glow > 0.3) {
    ctx.shadowColor = style.stroke;
    ctx.shadowBlur = scale * (0.22 + th.glow * 0.28);
  }
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = Math.max(1.6, scale * 0.07);
  ctx.lineJoin = 'round';
  tracePiece(ctx, loops, scale, radius, ox, oy);
  ctx.stroke();
  if (th.glow > 0.55) ctx.stroke();
  ctx.restore();

  // Quem quebra com pancada E explode: so a TNT. A bomba nao entra - ela
  // espera o dedo do jogador, e o vidro quebra sem espalhar nada.
  if (mat.breakSpeed > 0 && mat.explodeRadius > 0) {
    tracePiece(ctx, loops, scale, radius, ox, oy);
    hazardStripes(ctx, style, ox, oy, w, h, scale);
    tracePiece(ctx, loops, scale, radius, ox, oy);
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = Math.max(1.6, scale * 0.07);
    ctx.stroke();
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
