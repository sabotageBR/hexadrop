/**
 * Capa comercial do Hexa Drop para a Poki: 1080x1080, sangrada, sem texto.
 *
 * Nada aqui e desenho novo. O ceu, as pecas de gelatina, as cores da marca e o
 * hexagono saem dos mesmos pintores do jogo (paintBackground, SpriteCache), no
 * mundo 1, e os estilhacos imitam o `burst` de render/particles.js. O que a
 * capa acrescenta e ENCENACAO, e so ela:
 *
 * - a torre abre um vao no meio, e o hexagono esta entrando nele - e o momento
 *   do jogo (tirar a peca certa e ver o hexagono descer);
 * - a peca que estava ali acabou de estourar, em estilhacos amarelos;
 * - colunas mais altas dos dois lados emolduram o hexagono;
 * - um brilho dourado atras dele e um escurecido nos cantos poem o olho no
 *   centro.
 *
 * Regras da Poki para a estatica: 1:1, 628x628 no minimo, sangrada (sem
 * margem, borda nem canto arredondado), sem texto e longe do #83FFE7 que e o
 * fundo do site.
 *
 * Abrir com `npm run dev` em /marketing/capa/; a captura e a de sempre
 * (tools/shot.mjs a 1080x1080, que sai com o dobro, reduzido depois).
 */
import { THEMES } from '../../src/render/themes.js';
import { SpriteCache } from '../../src/render/sprites.js';
import { paintBackground } from '../../src/render/backgrounds.js';
import { skin as getSkin } from '../../src/game/content.js';
import { HEX_RADIUS } from '../../src/physics/world.js';

const W = 1080;
const DPR = 2;
/** Tamanho de uma celula na capa: a mesma escala da estatica atual. */
const CELULA = 170;
/** Seis colunas centradas: o vao das colunas 2 e 3 cai no meio da capa. */
const X0 = (W - 6 * CELULA) / 2;
/** A base da linha 0 fica abaixo da capa: a torre continua para baixo. */
const BASE = W + 70;

const th = THEMES.puzzle;
const cache = new SpriteCache(th, CELULA, DPR);

// Cores da marca, na ordem de PUZZLE_BLOCK_COLORS (render/sprites.js). A cor de
// uma peca do puzzle sai da posicao dela; `gx` escolhe a posicao que da a cor.
const ROSA = 0;
const CIANO = 1;
const VERDE = 2;
const AMARELO = 3;
const LARANJA = 4;
const ROXO = 5;
const ROSA2 = 6;
/** @param {number} cor @returns {number} posicao de grade que pinta essa cor */
const gx = (cor) => (cor * 3) % 7;
const AMARELO_HEX = '#ffd220';

/**
 * A torre, em celulas: x para a direita, y para cima, a partir da linha 0.
 * O vao das colunas 2 e 3 na linha 3 e onde estava a peca que estourou.
 */
const PECAS = [
  // linha 0 (cortada embaixo) e 1
  { x: 0, y: 0, cells: [[0, 0], [1, 0], [2, 0], [3, 0]], cor: LARANJA },
  { x: 4, y: 0, cells: [[0, 0], [1, 0], [0, 1], [1, 1]], cor: ROXO },
  { x: 0, y: 1, cells: [[0, 0], [1, 0], [2, 0], [0, 1]], cor: VERDE },
  { x: 3, y: 1, cells: [[0, 0]], cor: AMARELO },
  // linha 2
  { x: 1, y: 2, cells: [[0, 0], [1, 0], [2, 0]], cor: ROSA2 },
  { x: 4, y: 2, cells: [[0, 0], [1, 0]], cor: AMARELO },
  // linhas 3 e 4: as colunas dos lados emolduram o vao
  { x: 0, y: 3, cells: [[0, 0], [0, 1]], cor: ROSA },
  { x: 1, y: 3, cells: [[0, 0]], cor: CIANO },
  { x: 4, y: 3, cells: [[0, 0]], cor: VERDE },
  { x: 5, y: 3, cells: [[0, 0], [0, 1]], cor: LARANJA },
];

/** Gerador deterministico: a capa sai igual toda vez. */
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

/** @param {CanvasRenderingContext2D} ctx */
function pintaPecas(ctx) {
  for (const p of PECAS) {
    const s = cache.piece(p.cells, 'rubber', gx(p.cor), 0);
    // O sprite tem a caixa da peca com o canto de baixo em (pad, h - pad).
    const x = X0 + p.x * CELULA;
    const yBase = BASE - p.y * CELULA;
    ctx.drawImage(s.canvas, x - s.pad, yBase - (s.h - s.pad), s.w, s.h);
  }
}

/**
 * Estilhacos da peca que estourou, no formato do `burst` do jogo: retangulos
 * de 0,12 a 0,2 de celula, girados, espalhando mais para cima que para baixo.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 */
function pintaEstilhacos(ctx, cx, cy) {
  // Cor cheia e opaca, com um halo dourado: transparente sobre o ceu azul o
  // amarelo virava oliva e o estilhaco lia como sujeira em cima das pecas.
  const r = sorteio(27);
  for (let i = 0; i < 24; i++) {
    const ang = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.5;
    const dist = 70 + r() * 230;
    const x = cx + Math.cos(ang) * dist * 1.3;
    const y = cy + Math.sin(ang) * dist * 0.9;
    const w = CELULA * (0.11 + r() * 0.09);
    const h = CELULA * (0.09 + r() * 0.07);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r() * Math.PI * 2);
    ctx.globalAlpha = 0.85 + r() * 0.15;
    ctx.shadowColor = 'rgba(255, 210, 60, 0.9)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = r() < 0.7 ? AMARELO_HEX : '#ffec8a';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.25);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/**
 * Brilho de quatro pontas, como as faiscas cruzadas do ceu do mundo 1.
 * @param {CanvasRenderingContext2D} ctx
 */
function brilho(ctx, x, y, raio, cor, alfa) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alfa;
  ctx.fillStyle = cor;
  ctx.beginPath();
  const fino = raio * 0.16;
  ctx.moveTo(0, -raio);
  ctx.quadraticCurveTo(fino, -fino, raio, 0);
  ctx.quadraticCurveTo(fino, fino, 0, raio);
  ctx.quadraticCurveTo(-fino, fino, -raio, 0);
  ctx.quadraticCurveTo(-fino, -fino, 0, -raio);
  ctx.fill();
  ctx.restore();
}

function desenha() {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('capa'));
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  // Ceu do mundo 1, o mesmo do jogo.
  paintBackground(ctx, th, W, W);

  const hx = W / 2;
  const hy = 392;
  const vaoY = BASE - 3 * CELULA - CELULA / 2;

  // Brilho dourado atras do hexagono: o primeiro lugar em que o olho pousa.
  const halo = ctx.createRadialGradient(hx, hy + 20, 0, hx, hy + 20, 430);
  halo.addColorStop(0, 'rgba(255, 214, 80, 0.55)');
  halo.addColorStop(0.35, 'rgba(255, 150, 60, 0.18)');
  halo.addColorStop(1, 'rgba(255, 120, 60, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, W);

  // Raios suaves saindo do hexagono.
  ctx.save();
  ctx.translate(hx, hy);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * 560, Math.sin(a) * 560);
    g.addColorStop(0, 'rgba(255, 230, 140, 0.16)');
    g.addColorStop(1, 'rgba(255, 230, 140, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 560, a - 0.07, a + 0.07);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  pintaPecas(ctx);

  // O clarao no vao, onde a peca acabou de estourar.
  const clarao = ctx.createRadialGradient(hx, vaoY, 0, hx, vaoY, 200);
  clarao.addColorStop(0, 'rgba(255, 250, 220, 0.75)');
  clarao.addColorStop(0.4, 'rgba(255, 220, 100, 0.25)');
  clarao.addColorStop(1, 'rgba(255, 220, 100, 0)');
  ctx.fillStyle = clarao;
  ctx.fillRect(hx - 220, vaoY - 220, 440, 440);
  pintaEstilhacos(ctx, hx, vaoY);

  // O hexagono do jogo, um pouco inclinado na queda. A skin de sempre, ou a
  // pedida em `?skin=` - a variante com rosto usa a `sunny`, o primeiro premio
  // de mundo da 1.0.8, para medir se um personagem puxa mais clique.
  const raio = HEX_RADIUS * 1.15;
  const skinId = new URLSearchParams(window.location.search).get('skin') || 'classic';
  const hex = cache.hexagon(raio, getSkin(skinId));
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-0.2);
  ctx.shadowColor = 'rgba(255, 200, 60, 0.85)';
  ctx.shadowBlur = 46;
  ctx.drawImage(hex.canvas, -hex.w / 2, -hex.h / 2, hex.w, hex.h);
  ctx.restore();

  // Brilhos em volta dele.
  brilho(ctx, hx + 175, hy - 118, 30, '#fff6c8', 0.95);
  brilho(ctx, hx - 190, hy - 40, 20, '#ffd23c', 0.85);
  brilho(ctx, hx + 128, hy + 96, 16, '#ffffff', 0.8);
  brilho(ctx, hx - 120, hy - 170, 14, '#ffffff', 0.7);

  // Cantos escurecidos: o foco fica no centro.
  const vinheta = ctx.createRadialGradient(W / 2, W / 2, W * 0.42, W / 2, W / 2, W * 0.78);
  vinheta.addColorStop(0, 'rgba(3, 6, 20, 0)');
  vinheta.addColorStop(1, 'rgba(3, 6, 20, 0.5)');
  ctx.fillStyle = vinheta;
  ctx.fillRect(0, 0, W, W);

  window.__capaPronta = true;
}

desenha();
