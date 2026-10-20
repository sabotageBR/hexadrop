/**
 * Capas dos portais (Y8, Playgama, Yandex, GameMonetize, GameDistribution,
 * GamePix) em qualquer tamanho: `?w=512&h=384`, com a logo (padrao) ou sem
 * (`&logo=0`).
 *
 * A cena e a da capa comercial (marketing/capa/capa.js), como nas capas da
 * CrazyGames (marketing/crazygames/), mas o arranjo sai da proporcao pedida,
 * e nao de tres formatos fixos:
 *
 * - **deitada** (largura >= 1,25 x altura): a logo a esquerda e a torre a
 *   direita, ancorada embaixo. Em 16:9 e exatamente a capa 1920x1080 da
 *   CrazyGames; mais estreita, a torre encolhe para a logo caber ao lado;
 * - **em pe** (o resto): a logo em cima e a torre embaixo, centrada. Em 1:1 e
 *   2:3 sao as capas 800x800 e 800x1200 da CrazyGames, e o meio interpola;
 * - **sem a logo** e deitada: a torre no meio, do tamanho da altura, sem o
 *   lugar vazio que ficaria a esquerda (a GameDistribution reprova capa com
 *   grande area vazia).
 *
 * O que sobra dos lados da torre ganha pecas de enchimento na mesma grade
 * (`enchimento`), sempre abaixo da linha 3: so a torre sobe, e o hexagono
 * continua sendo o ponto mais alto.
 *
 * O canvas tem o dobro do pedido; tools/portais.mjs le os pixels e desce para
 * o tamanho exato com filtro.
 */
import { pintaCapa, CORES } from '../../capa/capa.js';

const DPR = 2;
const { ROSA, CIANO, VERDE, AMARELO, LARANJA, ROXO, ROSA2 } = CORES;

const q = new URLSearchParams(window.location.search);
const W = Math.max(64, parseInt(q.get('w') || '1920', 10));
const H = Math.max(64, parseInt(q.get('h') || '1080', 10));
const COM_LOGO = q.get('logo') !== '0';

const logo = new Image();
logo.src = new URL('../../../src/ui/logo.webp', import.meta.url).href;
/** Proporcao da logo (900x768). */
const LOGO_H = 768 / 900;
/** Largura de uma celula e margem da torre em unidades (marketing/capa/capa.js). */
const CELULA = 170;
const X0 = 30;

/** As mesmas pecas a mais da capa 1920x1080 da CrazyGames. */
const ESQUERDA = [
  { x: -6, y: 0, cells: [[0, 0], [1, 0], [0, 1]], cor: ROXO },
  { x: -4, y: 0, cells: [[0, 0], [1, 0], [2, 0]], cor: CIANO },
  { x: -1, y: 0, cells: [[0, 0]], cor: ROSA2 },
  { x: -5, y: 1, cells: [[0, 0], [1, 0]], cor: AMARELO },
  { x: -3, y: 1, cells: [[0, 0], [1, 0], [2, 0]], cor: VERDE },
];
const DIREITA = [{ x: 6, y: 0, cells: [[0, 0], [1, 0], [0, 1], [0, 2]], cor: ROSA }];
/** E as da capa 800x800. */
const LADOS = [
  { x: -1, y: 0, cells: [[0, 0], [0, 1]], cor: CIANO },
  { x: -1, y: 2, cells: [[0, 0]], cor: AMARELO },
  { x: 6, y: 0, cells: [[0, 0]], cor: ROSA2 },
  { x: 6, y: 1, cells: [[0, 0], [0, 1]], cor: VERDE },
];

/** Gerador deterministico: o enchimento sai igual toda vez. */
function sorteio(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pecas nas colunas de `xMin` a `xMax` que ainda estao vazias, nas linhas 0 e
 * 1 (a 2 so encostada na torre, como na capa quadrada). As celulas da torre
 * (colunas 0 a 5) e das `extras` ja ocupam o lugar delas.
 * @param {{x:number, y:number, cells:number[][]}[]} ocupadas
 * @param {number} xMin
 * @param {number} xMax
 * @returns {{x:number, y:number, cells:number[][], cor:number}[]}
 */
function enchimento(ocupadas, xMin, xMax) {
  const cheio = new Set();
  for (let x = 0; x <= 5; x++) for (let y = 0; y <= 4; y++) cheio.add(`${x},${y}`);
  for (const p of ocupadas) for (const [cx, cy] of p.cells) cheio.add(`${p.x + cx},${p.y + cy}`);
  const cores = [ROXO, CIANO, AMARELO, VERDE, ROSA, LARANJA, ROSA2];
  const r = sorteio(91);
  /** @type {{x:number, y:number, cells:number[][], cor:number}[]} */
  const novas = [];
  let corAnterior = -1;
  for (const y of [0, 1]) {
    for (let x = xMin; x <= xMax; x++) {
      if (cheio.has(`${x},${y}`)) continue;
      // Uma a tres celulas deitadas, ate esbarrar em algo.
      let largura = 1 + Math.floor(r() * 3);
      const cells = [];
      for (let i = 0; i < largura && x + i <= xMax && !cheio.has(`${x + i},${y}`); i++) cells.push([i, 0]);
      largura = cells.length;
      let cor = cores[Math.floor(r() * cores.length)];
      if (cor === corAnterior) cor = cores[(cores.indexOf(cor) + 1) % cores.length];
      corAnterior = cor;
      for (const [cx] of cells) cheio.add(`${x + cx},${y}`);
      novas.push({ x, y, cells, cor });
      x += largura - 1;
    }
  }
  return novas;
}

/** Colunas da grade visiveis em [px0, px1] com a cena em (k, ox). */
function colunas(px0, px1, k, ox) {
  return [Math.floor(((px0 - ox) / k - X0) / CELULA) - 1, Math.ceil(((px1 - ox) / k - X0) / CELULA) + 1];
}

/**
 * O arranjo da capa: o quadro da cena (k, ox, oy), as pecas a mais e a caixa
 * da logo, em pixels da capa.
 * @param {number} w
 * @param {number} h
 */
function arranjo(w, h) {
  const ar = w / h;
  if (ar >= 1.25 && !COM_LOGO) {
    // A torre no meio, com a base cortada como na 1920x1080, e enchimento dos
    // dois lados ate a borda.
    const k = h / 1080;
    const ox = (w - 1080 * k) / 2;
    const oy = h - 1080 * k;
    const [xMin, xMax] = colunas(0, w, k, ox);
    const extras = [...ESQUERDA, ...DIREITA];
    return { w, h, k, ox, oy, extras: [...extras, ...enchimento(extras, Math.min(xMin, -7), Math.max(xMax, 8))], logo: { x: 0, y: 0, l: 0 } };
  }
  if (ar >= 1.25) {
    // Deitada. Em 16:9 (f = 1) e a capa 1920x1080: k = h/1080, a torre
    // encostada na direita e a logo de 700 em x = 80. Mais estreita, a torre
    // encolhe (f ate 0,7) e desce, e a logo ocupa o que sobra a esquerda.
    const kh = h / 1080;
    const f = Math.max(0.7, Math.min(1, (ar - 0.55) / 1.15));
    const k = kh * f;
    const ox = w - 1140 * k;
    const oy = h - 1080 * k;
    const margem = 80 * kh;
    const l = Math.min(700 * kh, ox + 10 * k - margem);
    const logoY = Math.max(0.04 * h, 0.365 * h - (l * LOGO_H) / 2);
    const [xMin] = colunas(0, w, k, ox);
    const extras = [...ESQUERDA, ...DIREITA];
    return { w, h, k, ox, oy, extras: [...extras, ...enchimento(extras, Math.min(xMin, -7), 8)], logo: { x: margem, y: logoY, l } };
  }
  // Em pe: interpola entre a 2:3 (t = 0) e a 1:1 (t = 1); mais larga que 1:1,
  // fica no 1:1 medido pela altura.
  const t = Math.max(0, Math.min(1, (ar - 2 / 3) / (1 - 2 / 3)));
  const lado = Math.min(w, h);
  const mix = (/** @type {number} */ a, /** @type {number} */ b) => a + (b - a) * t;
  const k = lado * mix(0.74 / 800, 0.6 / 800);
  const oy = h - 1080 * k + h * mix(0.0325, 0.09);
  const ox = (w - 1080 * k) / 2;
  const l = lado * mix(590 / 800, 390 / 800);
  const logo = { x: (w - l) / 2, y: h * mix(0.033, 0.03), l };
  const [xMin, xMax] = colunas(0, w, k, ox);
  const extras = t > 0.5 ? LADOS : [];
  return { w, h, k, ox, oy, extras: [...extras, ...enchimento(extras, xMin, xMax)], logo };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number, y:number, l:number}} caixa
 */
function pintaLogo(ctx, caixa) {
  const h = caixa.l * LOGO_H;
  ctx.save();
  // Uma sombra escura e larga descola a logo do ceu e dos raios dourados.
  ctx.shadowColor = 'rgba(8, 4, 28, 0.7)';
  ctx.shadowBlur = caixa.l * 0.06;
  ctx.shadowOffsetY = caixa.l * 0.012;
  ctx.drawImage(logo, caixa.x, caixa.y, caixa.l, h);
  ctx.restore();
}

function desenha() {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('capa'));
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const f = arranjo(W, H);
  pintaCapa(ctx, f);
  if (COM_LOGO) pintaLogo(ctx, f.logo);
  window.__capaPronta = true;
}

logo.decode().then(desenha, desenha);
