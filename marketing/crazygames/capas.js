/**
 * As tres capas da CrazyGames: 1920x1080 (16:9), 800x1200 (2:3) e 800x800 (1:1).
 *
 * A cena e a da capa comercial da Poki (marketing/capa/capa.js), levada para
 * cada formato por escala e deslocamento, com a logo do jogo por cima. A
 * CrazyGames aceita texto na capa so se for o nome do jogo - e a logo e o nome.
 * As regras dela: sem borda, sem "New"/"Play", sem icone de loja, sem imagem
 * borrada, e as tres com o mesmo visual.
 *
 * Abrir com `npm run dev` em /marketing/crazygames/; quem grava os PNGs e
 * `node tools/crazygames.mjs` (le cada canvas e desce do dobro para o tamanho).
 */
import { pintaCapa, CORES } from '../capa/capa.js';

const DPR = 2;
const { ROSA, CIANO, VERDE, AMARELO, ROXO, ROSA2 } = CORES;

const logo = new Image();
logo.src = new URL('../../src/ui/logo.webp', import.meta.url).href;
/** Proporcao da logo (900x768). */
const LOGO_H = 768 / 900;

/**
 * Pecas a mais nas laterais da torre, na mesma grade (x em celulas a partir da
 * coluna 0 da torre, y em linhas a partir da 0, que fica cortada embaixo).
 */
const ESQUERDA = [
  { x: -6, y: 0, cells: [[0, 0], [1, 0], [0, 1]], cor: ROXO },
  { x: -4, y: 0, cells: [[0, 0], [1, 0], [2, 0]], cor: CIANO },
  { x: -1, y: 0, cells: [[0, 0]], cor: ROSA2 },
  { x: -5, y: 1, cells: [[0, 0], [1, 0]], cor: AMARELO },
  { x: -3, y: 1, cells: [[0, 0], [1, 0], [2, 0]], cor: VERDE },
];
const DIREITA = [{ x: 6, y: 0, cells: [[0, 0], [1, 0], [0, 1], [0, 2]], cor: ROSA }];
const LADOS = [
  { x: -1, y: 0, cells: [[0, 0], [0, 1]], cor: CIANO },
  { x: -1, y: 2, cells: [[0, 0]], cor: AMARELO },
  { x: 6, y: 0, cells: [[0, 0]], cor: ROSA2 },
  { x: 6, y: 1, cells: [[0, 0], [0, 1]], cor: VERDE },
];

/**
 * Cada formato: o quadro da cena (k, ox, oy) e a caixa da logo (x, y, largura).
 * Medidas em pixels da capa.
 */
const FORMATOS = {
  // A torre na metade direita e a logo na esquerda, sobre a base que continua.
  paisagem: { w: 1920, h: 1080, k: 1, ox: 780, oy: 0, extras: [...ESQUERDA, ...DIREITA], logo: { x: 80, y: 96, l: 700 } },
  // A logo em cima e a torre embaixo, com o hexagono no meio da capa.
  retrato: { w: 800, h: 1200, k: 0.74, ox: 0, oy: 440, extras: [], logo: { x: 105, y: 40, l: 590 } },
  // A mesma, mais apertada: a logo menor e a torre um pouco mais longe.
  quadrada: { w: 800, h: 800, k: 0.6, ox: 76, oy: 224, extras: LADOS, logo: { x: 205, y: 24, l: 390 } },
};

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
  for (const [id, f] of Object.entries(FORMATOS)) {
    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById(id));
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    pintaCapa(ctx, f);
    pintaLogo(ctx, f.logo);
  }
  window.__capasProntas = true;
}

logo.decode().then(desenha, desenha);
