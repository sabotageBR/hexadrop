/**
 * Galeria de derivados: toon, gelatina, lego e pixel.
 * Nada disto entra no jogo ate o modelo ser escolhido.
 */
import { bounds, outlineLoops } from '../src/physics/shapes.js';
import { tracePiece } from '../src/render/sprites.js';
import { roundRect } from '../src/render/draw2d.js';

const COLORS = [
  '#ff4eb6',
  '#3dd0ff',
  '#7cdb3a',
  '#ffcc22',
  '#ff8c22',
  '#9b4dff',
  '#ff5aa0',
  '#3d8aff',
];

const FAMILIES = [
  {
    id: 'toon',
    name: 'Toon',
    models: [
      { id: 'toon', name: 'Toon original', desc: 'Duas faixas duras, triangulo de luz, contorno preto.' },
      { id: 'toon-hq', name: 'Toon HQ', desc: 'Tinta mais grossa, filete branco interno, sombra ate a metade.' },
      { id: 'toon-cel', name: 'Toon cel', desc: 'Tres faixas (luz, meio, sombra) e um quadradinho de brilho.' },
    ],
  },
  {
    id: 'gelatina',
    name: 'Gelatina',
    models: [
      { id: 'gelatina', name: 'Gelatina original', desc: 'Miolo claro, um reflexo oval. Gummy arcade.' },
      { id: 'gelatina-bolha', name: 'Gelatina bolha', desc: 'Mais redonda, reflexo maior e bolhas no miolo.' },
      { id: 'gelatina-nucleo', name: 'Gelatina nucleo', desc: 'Borda escura, centro aceso. Jujuba grossa.' },
    ],
  },
  {
    id: 'lego',
    name: 'Lego',
    models: [
      { id: 'lego', name: 'Lego original', desc: 'Pino no centro de cada celula.' },
      { id: 'lego-tijolo', name: 'Lego tijolo', desc: 'Sulcos horizontais de bloco e pinos menores.' },
      { id: 'lego-alto', name: 'Lego alto', desc: 'Pino 3D com parede, como peca vista de cima.' },
    ],
  },
  {
    id: 'pixel',
    name: 'Pixel',
    models: [
      { id: 'pixel', name: 'Pixel 8-bit', desc: 'Grade 8x8, quatro tons, sem blur.' },
      { id: 'pixel-grosso', name: 'Pixel grosso', desc: 'Grade 4x4, botao chunky de fliperama.' },
      { id: 'pixel-tinta', name: 'Pixel tinta', desc: 'Contorno preto de 1 pixel em volta da peca.' },
    ],
  },
];

const MODELS = FAMILIES.flatMap((f) => f.models);

function rgb(hex) {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}
function mix(hex, other, t) {
  const a = rgb(hex);
  const b = rgb(other);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
const dark = (hex, t = 0.4) => mix(hex, '#000000', t);
const lite = (hex, t = 0.4) => mix(hex, '#ffffff', t);

function sil(ctx, cells, scale, ox, oy, r) {
  tracePiece(ctx, outlineLoops(cells), scale, r, ox, oy);
}
function cellBox(cx, cy, scale, ox, oy) {
  return { x: ox + cx * scale, y: oy - (cy + 1) * scale };
}

function pixelGrid(ctx, cells, fill, scale, ox, oy, n, outline) {
  const px = scale / n;
  const d = dark(fill, 0.48);
  const m = fill;
  const l = lite(fill, 0.32);
  const hi = lite(fill, 0.62);
  ctx.imageSmoothingEnabled = false;
  for (const [cx, cy] of cells) {
    const { x, y } = cellBox(cx, cy, scale, ox, oy);
    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        let c = m;
        if (outline && (ix === 0 || iy === 0 || ix === n - 1 || iy === n - 1)) c = '#140c18';
        else if (ix === 0 || iy === n - 1) c = d;
        else if (iy === 0 || ix === n - 1) c = l;
        else if (ix <= Math.max(1, n / 8) && iy <= Math.max(1, n / 8)) c = hi;
        else if (ix >= n - 2 && iy >= n - 2) c = d;
        ctx.fillStyle = c;
        ctx.fillRect(x + ix * px, y + iy * px, px + 0.45, px + 0.45);
      }
    }
  }
}

/** @type {Record<string, Function>} */
const PAINT = {
  toon(ctx, cells, fill, scale, ox, oy) {
    const r = scale * 0.14;
    const b = bounds(cells);
    sil(ctx, cells, scale, ox, oy, r);
    ctx.fillStyle = fill;
    ctx.fill('evenodd');
    ctx.save();
    sil(ctx, cells, scale, ox, oy, r);
    ctx.clip('evenodd');
    ctx.fillStyle = dark(fill, 0.28);
    ctx.fillRect(ox, oy - b.h * scale * 0.48, b.w * scale, b.h * scale);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(ox + scale * 0.18, oy - b.h * scale + scale * 0.16);
    ctx.lineTo(ox + scale * 0.46, oy - b.h * scale + scale * 0.16);
    ctx.lineTo(ox + scale * 0.18, oy - b.h * scale + scale * 0.42);
    ctx.fill();
    ctx.restore();
    sil(ctx, cells, scale, ox, oy, r);
    ctx.strokeStyle = '#1a1020';
    ctx.lineWidth = Math.max(2.4, scale * 0.1);
    ctx.stroke();
  },

  'toon-hq'(ctx, cells, fill, scale, ox, oy) {
    const r = scale * 0.12;
    const b = bounds(cells);
    sil(ctx, cells, scale, ox, oy, r);
    ctx.fillStyle = fill;
    ctx.fill('evenodd');
    ctx.save();
    sil(ctx, cells, scale, ox, oy, r);
    ctx.clip('evenodd');
    ctx.fillStyle = dark(fill, 0.34);
    ctx.fillRect(ox, oy - b.h * scale * 0.5, b.w * scale, b.h * scale);
    ctx.restore();
    sil(ctx, cells, scale, ox, oy, r);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1.4, scale * 0.055);
    ctx.stroke();
    sil(ctx, cells, scale, ox, oy, r);
    ctx.strokeStyle = '#100814';
    ctx.lineWidth = Math.max(3, scale * 0.13);
    ctx.stroke();
  },

  'toon-cel'(ctx, cells, fill, scale, ox, oy) {
    const r = scale * 0.12;
    const b = bounds(cells);
    const h = b.h * scale;
    sil(ctx, cells, scale, ox, oy, r);
    ctx.fillStyle = fill;
    ctx.fill('evenodd');
    ctx.save();
    sil(ctx, cells, scale, ox, oy, r);
    ctx.clip('evenodd');
    ctx.fillStyle = lite(fill, 0.22);
    ctx.fillRect(ox, oy - h, b.w * scale, h * 0.34);
    ctx.fillStyle = dark(fill, 0.32);
    ctx.fillRect(ox, oy - h * 0.38, b.w * scale, h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(ox + scale * 0.16, oy - h + scale * 0.14, scale * 0.22, scale * 0.1);
    ctx.restore();
    sil(ctx, cells, scale, ox, oy, r);
    ctx.strokeStyle = '#140c18';
    ctx.lineWidth = Math.max(2.2, scale * 0.09);
    ctx.stroke();
  },

  gelatina(ctx, cells, fill, scale, ox, oy) {
    const r = scale * 0.28;
    const b = bounds(cells);
    sil(ctx, cells, scale, ox, oy, r);
    ctx.fillStyle = fill;
    ctx.globalAlpha = 0.92;
    ctx.fill('evenodd');
    ctx.globalAlpha = 1;
    ctx.save();
    sil(ctx, cells, scale, ox, oy, r);
    ctx.clip('evenodd');
    roundRect(ctx, ox + scale * 0.16, oy - b.h * scale + scale * 0.12, b.w * scale - scale * 0.32, b.h * scale * 0.42, r * 0.7);
    ctx.fillStyle = lite(fill, 0.45);
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(ox + b.w * scale * 0.35, oy - b.h * scale + scale * 0.28, scale * 0.28, scale * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    sil(ctx, cells, scale, ox, oy, r);
    ctx.strokeStyle = dark(fill, 0.25);
    ctx.lineWidth = Math.max(2, scale * 0.07);
    ctx.stroke();
  },

  'gelatina-bolha'(ctx, cells, fill, scale, ox, oy) {
    const r = scale * 0.36;
    const b = bounds(cells);
    sil(ctx, cells, scale, ox, oy, r);
    ctx.fillStyle = fill;
    ctx.fill('evenodd');
    ctx.save();
    sil(ctx, cells, scale, ox, oy, r);
    ctx.clip('evenodd');
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(ox + b.w * scale * 0.38, oy - b.h * scale + scale * 0.3, scale * 0.38, scale * 0.16, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(ox + b.w * scale * 0.72, oy - b.h * scale * 0.45, scale * 0.08, 0, Math.PI * 2);
    ctx.arc(ox + b.w * scale * 0.22, oy - b.h * scale * 0.28, scale * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    sil(ctx, cells, scale, ox, oy, r);
    ctx.strokeStyle = lite(fill, 0.25);
    ctx.lineWidth = Math.max(2, scale * 0.06);
    ctx.stroke();
  },

  'gelatina-nucleo'(ctx, cells, fill, scale, ox, oy) {
    const r = scale * 0.26;
    const b = bounds(cells);
    sil(ctx, cells, scale, ox, oy, r);
    ctx.fillStyle = dark(fill, 0.22);
    ctx.fill('evenodd');
    ctx.save();
    sil(ctx, cells, scale, ox, oy, r);
    ctx.clip('evenodd');
    const pad = scale * 0.18;
    roundRect(ctx, ox + pad, oy - b.h * scale + pad, b.w * scale - pad * 2, b.h * scale - pad * 2, r * 0.8);
    ctx.fillStyle = lite(fill, 0.2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(ox + b.w * scale * 0.4, oy - b.h * scale + scale * 0.32, scale * 0.22, scale * 0.1, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    sil(ctx, cells, scale, ox, oy, r);
    ctx.strokeStyle = dark(fill, 0.4);
    ctx.lineWidth = Math.max(2.2, scale * 0.08);
    ctx.stroke();
  },

  lego(ctx, cells, fill, scale, ox, oy) {
    const r = scale * 0.12;
    sil(ctx, cells, scale, ox, oy, r);
    ctx.fillStyle = fill;
    ctx.fill('evenodd');
    sil(ctx, cells, scale, ox, oy, r);
    ctx.strokeStyle = dark(fill, 0.4);
    ctx.lineWidth = Math.max(2, scale * 0.07);
    ctx.stroke();
    for (const [cx, cy] of cells) {
      const { x, y } = cellBox(cx, cy, scale, ox, oy);
      const px = x + scale * 0.5;
      const py = y + scale * 0.5;
      const rad = scale * 0.22;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fillStyle = lite(fill, 0.18);
      ctx.fill();
      ctx.strokeStyle = dark(fill, 0.35);
      ctx.lineWidth = Math.max(1.5, scale * 0.045);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, rad * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = lite(fill, 0.35);
      ctx.lineWidth = Math.max(1, scale * 0.03);
      ctx.stroke();
    }
  },

  'lego-tijolo'(ctx, cells, fill, scale, ox, oy) {
    const r = scale * 0.08;
    sil(ctx, cells, scale, ox, oy, r);
    ctx.fillStyle = fill;
    ctx.fill('evenodd');
    ctx.save();
    sil(ctx, cells, scale, ox, oy, r);
    ctx.clip('evenodd');
    ctx.strokeStyle = dark(fill, 0.28);
    ctx.lineWidth = Math.max(1.2, scale * 0.04);
    for (const [cx, cy] of cells) {
      const { x, y } = cellBox(cx, cy, scale, ox, oy);
      ctx.beginPath();
      ctx.moveTo(x + 2, y + scale * 0.33);
      ctx.lineTo(x + scale - 2, y + scale * 0.33);
      ctx.moveTo(x + 2, y + scale * 0.66);
      ctx.lineTo(x + scale - 2, y + scale * 0.66);
      ctx.stroke();
    }
    ctx.restore();
    sil(ctx, cells, scale, ox, oy, r);
    ctx.strokeStyle = dark(fill, 0.42);
    ctx.lineWidth = Math.max(2, scale * 0.07);
    ctx.stroke();
    for (const [cx, cy] of cells) {
      const { x, y } = cellBox(cx, cy, scale, ox, oy);
      ctx.beginPath();
      ctx.arc(x + scale * 0.5, y + scale * 0.5, scale * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = lite(fill, 0.14);
      ctx.fill();
      ctx.strokeStyle = dark(fill, 0.3);
      ctx.lineWidth = Math.max(1.2, scale * 0.035);
      ctx.stroke();
    }
  },

  'lego-alto'(ctx, cells, fill, scale, ox, oy) {
    const r = scale * 0.1;
    sil(ctx, cells, scale, ox, oy, r);
    ctx.fillStyle = fill;
    ctx.fill('evenodd');
    sil(ctx, cells, scale, ox, oy, r);
    ctx.strokeStyle = dark(fill, 0.45);
    ctx.lineWidth = Math.max(2, scale * 0.07);
    ctx.stroke();
    for (const [cx, cy] of cells) {
      const { x, y } = cellBox(cx, cy, scale, ox, oy);
      const px = x + scale * 0.5;
      const py = y + scale * 0.52;
      const rad = scale * 0.24;
      ctx.beginPath();
      ctx.ellipse(px, py + scale * 0.06, rad, rad * 0.78, 0, 0, Math.PI * 2);
      ctx.fillStyle = dark(fill, 0.28);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(px, py - scale * 0.04, rad, rad * 0.78, 0, 0, Math.PI * 2);
      ctx.fillStyle = lite(fill, 0.16);
      ctx.fill();
      ctx.strokeStyle = dark(fill, 0.35);
      ctx.lineWidth = Math.max(1.4, scale * 0.04);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(px, py - scale * 0.04, rad * 0.55, rad * 0.42, 0, 0, Math.PI * 2);
      ctx.strokeStyle = lite(fill, 0.4);
      ctx.lineWidth = Math.max(1, scale * 0.03);
      ctx.stroke();
    }
  },

  pixel(ctx, cells, fill, scale, ox, oy) {
    pixelGrid(ctx, cells, fill, scale, ox, oy, 8, false);
  },
  'pixel-grosso'(ctx, cells, fill, scale, ox, oy) {
    pixelGrid(ctx, cells, fill, scale, ox, oy, 4, false);
  },
  'pixel-tinta'(ctx, cells, fill, scale, ox, oy) {
    pixelGrid(ctx, cells, fill, scale, ox, oy, 6, true);
  },
};

function paintPiece(ctx, model, cells, fill, scale, ox, oy) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  PAINT[model](ctx, cells, fill, scale, ox, oy);
  ctx.restore();
}

function paintHex(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const x = cx + r * Math.cos(a);
    const y = cy - r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffcc22';
  ctx.fill();
  ctx.strokeStyle = '#c48a00';
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.stroke();
}

function drawStrip(canvas, model) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = Math.max(280, canvas.parentElement ? canvas.parentElement.clientWidth - 24 : 640);
  const h = 92;
  const scale = Math.min(40, Math.floor((cssW - 24) / (COLORS.length * 1.28)));
  canvas.width = Math.ceil(cssW * dpr);
  canvas.height = Math.ceil(h * dpr);
  canvas.style.width = '100%';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#07102c';
  ctx.fillRect(0, 0, cssW, h);
  const gap = (cssW - COLORS.length * scale) / (COLORS.length + 1);
  COLORS.forEach((c, i) => {
    paintPiece(ctx, model, [[0, 0]], c, scale, gap + i * (scale + gap), (h + scale) / 2);
  });
}

function drawStage(canvas, model) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 860;
  const h = Math.max(420, Math.round(w * 0.58));
  canvas.width = Math.ceil(w * dpr);
  canvas.height = Math.ceil(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#07102c');
  sky.addColorStop(1, '#0a1a48');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.15 + (i % 5) * 0.1;
    ctx.beginPath();
    ctx.arc((i * 97) % w, (i * 53) % (h * 0.7), 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const scale = Math.min(56, w * 0.08);
  const towerW = 4 * scale;
  const ox = (w - towerW) / 2;
  const baseY = h * 0.82;
  roundRect(ctx, ox - scale * 0.6, baseY, towerW + scale * 1.2, scale * 0.72, scale * 0.28);
  ctx.fillStyle = '#6b5cff';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(ox - scale * 0.4, baseY + 4, towerW + scale * 0.8, 6);

  const rows = [
    { y: 3, fill: COLORS[4] },
    { y: 2, fill: COLORS[5] },
    { y: 1, fill: COLORS[6] },
    { y: 0, fill: COLORS[0] },
  ];
  for (const row of rows) {
    const oy = baseY - 8 - row.y * (scale + 6);
    paintPiece(ctx, model, [[0, 0], [1, 0], [2, 0], [3, 0]], row.fill, scale, ox, oy);
  }
  paintHex(ctx, ox + towerW / 2, baseY - 8 - 4 * (scale + 6) - scale * 0.15, scale * 0.46);
}

const KEY = 'hexadrop-tex-pick';
const valid = new Set(MODELS.map((m) => m.id));
let current = localStorage.getItem(KEY) || 'toon';
if (!valid.has(current)) current = 'toon';

const list = document.getElementById('list');
const stage = /** @type {HTMLCanvasElement} */ (document.getElementById('stage'));
const stageName = document.getElementById('stageName');
const stageHint = document.getElementById('stageHint');
/** @type {Map<string, HTMLButtonElement>} */
const cards = new Map();

function select(id) {
  current = id;
  localStorage.setItem(KEY, id);
  const m = MODELS.find((x) => x.id === id);
  stageName.textContent = m ? m.name : id;
  stageHint.textContent = m ? m.desc : '';
  for (const [k, el] of cards) el.classList.toggle('on', k === id);
  drawStage(stage, id);
}

let n = 0;
for (const fam of FAMILIES) {
  const h = document.createElement('div');
  h.className = 'fam';
  h.textContent = fam.name;
  list.appendChild(h);
  const grid = document.createElement('div');
  grid.className = 'fam-grid';
  for (const m of fam.models) {
    n += 1;
    const btn = document.createElement('button');
    btn.className = 'card' + (m.id === current ? ' on' : '');
    btn.type = 'button';
    btn.innerHTML = `<div class="num">${String(n).padStart(2, '0')}</div>
      <div><h2>${m.name}</h2><p>${m.desc}</p></div>
      <canvas></canvas>`;
    btn.addEventListener('click', () => select(m.id));
    grid.appendChild(btn);
    cards.set(m.id, btn);
  }
  list.appendChild(grid);
}

function paintAll() {
  for (const m of MODELS) {
    const c = /** @type {HTMLCanvasElement} */ (cards.get(m.id).querySelector('canvas'));
    drawStrip(c, m.id);
  }
  select(current);
}

requestAnimationFrame(paintAll);
window.addEventListener('resize', paintAll);
