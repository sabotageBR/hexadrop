/**
 * Icone do app (Android e iOS) e a splash, desenhados com os pintores do jogo.
 *
 * Como a capa (marketing/capa/), nada aqui e desenho novo: o ceu do mundo 1
 * (paintBackground), as pecas de gelatina e o hexagono da skin padrao saem do
 * SpriteCache. O icone e o hexagono - a peca que o jogador leva ate a base -,
 * grande e sozinho, sobre o ceu com um brilho dourado; embaixo, a torre de
 * gelatina cortada, que diz "jogo de blocos" na primeira olhada.
 *
 * Tres camadas, porque o icone adaptativo do Android e frente + fundo e o
 * sistema recorta a mascara (circulo, gota, quadrado) por cima:
 *
 * - `frente`: so o hexagono, transparente em volta, dentro do circulo seguro
 *   de 66% do lado (o que nenhuma mascara corta);
 * - `fundo`: ceu, brilho e a torre;
 * - `completo`: as duas juntas, para o iOS, para o Play (512) e para o
 *   Android antigo.
 *
 * E a splash (2732, o que o @capacitor/assets pede): o hexagono no meio do
 * fundo escuro do carregador.
 *
 * Abrir com `npm run dev` em /marketing/icone/; tools/icone.mjs grava os PNGs em
 * assets/ e o @capacitor/assets gera os tamanhos de cada plataforma.
 */
import { THEMES } from '../../src/render/themes.js';
import { SpriteCache } from '../../src/render/sprites.js';
import { paintBackground } from '../../src/render/backgrounds.js';
import { skin as getSkin } from '../../src/game/content.js';

const LADO = 1024;
/** Celula das pecas da torre no icone. */
const CELULA = 150;
const th = THEMES.puzzle;
const cache = new SpriteCache(th, CELULA, 2);
const skinId = new URLSearchParams(window.location.search).get('skin') || 'classic';

// Cores da marca na ordem de PUZZLE_BLOCK_COLORS (render/sprites.js): a cor de
// uma peca do puzzle sai da posicao dela, e `gx` escolhe a posicao da cor.
const ROSA = 0;
const CIANO = 1;
const VERDE = 2;
const LARANJA = 4;
const ROXO = 5;
/** @param {number} cor @returns {number} */
const gx = (cor) => (cor * 3) % 7;

/** A torre cortada embaixo, em celulas a partir da esquerda e da base. */
const TORRE = [
  { x: 0, y: 0, cells: [[0, 0], [1, 0], [2, 0]], cor: LARANJA },
  { x: 3, y: 0, cells: [[0, 0], [1, 0], [0, 1]], cor: ROXO },
  { x: 5, y: 0, cells: [[0, 0], [0, 1]], cor: VERDE },
  { x: 0, y: 1, cells: [[0, 0], [0, 1]], cor: CIANO },
  { x: 1, y: 1, cells: [[0, 0], [1, 0]], cor: ROSA },
  { x: 4, y: 1, cells: [[0, 0]], cor: CIANO },
];

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} lado
 */
function pintaFundo(ctx, lado) {
  const k = lado / LADO;
  ctx.save();
  ctx.scale(k, k);
  paintBackground(ctx, th, LADO, LADO);
  const cx = LADO / 2;
  const cy = LADO * 0.45;
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, LADO * 0.5);
  halo.addColorStop(0, 'rgba(255, 214, 80, 0.55)');
  halo.addColorStop(0.4, 'rgba(255, 150, 60, 0.16)');
  halo.addColorStop(1, 'rgba(255, 120, 60, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, LADO, LADO);
  // A torre, cortada pela borda de baixo: sete colunas centradas.
  const x0 = (LADO - 6 * CELULA) / 2;
  const base = LADO + CELULA * 0.55;
  for (const p of TORRE) {
    const s = cache.piece(p.cells, 'rubber', gx(p.cor), 0);
    const x = x0 + p.x * CELULA;
    const yBase = base - p.y * CELULA;
    ctx.drawImage(s.canvas, x - s.pad, yBase - (s.h - s.pad), s.w, s.h);
  }
  // Cantos escurecidos: o olho vai para o meio.
  const vinheta = ctx.createRadialGradient(cx, LADO / 2, LADO * 0.4, cx, LADO / 2, LADO * 0.75);
  vinheta.addColorStop(0, 'rgba(3, 6, 20, 0)');
  vinheta.addColorStop(1, 'rgba(3, 6, 20, 0.45)');
  ctx.fillStyle = vinheta;
  ctx.fillRect(0, 0, LADO, LADO);
  ctx.restore();
}

/**
 * O hexagono, centrado um pouco acima do meio. `raioPx` e o raio do hexagono
 * desenhado, em pixels da tela de 1024.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} lado
 * @param {number} raioPx
 */
function pintaHexagono(ctx, lado, raioPx) {
  const k = lado / LADO;
  // O SpriteCache mede o raio em celulas; CELULA px por celula.
  const hex = cache.hexagon(raioPx / CELULA, getSkin(skinId));
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(LADO / 2, LADO * 0.46);
  ctx.rotate(-0.14);
  ctx.shadowColor = 'rgba(255, 200, 60, 0.8)';
  ctx.shadowBlur = 40;
  ctx.drawImage(hex.canvas, -hex.w / 2, -hex.h / 2, hex.w, hex.h);
  ctx.restore();
}

/** @param {string} id @returns {CanvasRenderingContext2D} */
function contexto(id) {
  const c = /** @type {HTMLCanvasElement} */ (document.getElementById(id));
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

// Na frente o hexagono tem que caber no circulo seguro (66% do lado, 338 px de
// raio): o raio do hexagono e o do vertice, e com a sombra 270 fica dentro.
const RAIO_FRENTE = 270;
// No completo nao ha mascara do sistema cortando, entao ele pode crescer.
const RAIO_COMPLETO = 330;

pintaFundo(contexto('fundo'), LADO);
pintaHexagono(contexto('frente'), LADO, RAIO_FRENTE);
const completo = contexto('completo');
pintaFundo(completo, LADO);
pintaHexagono(completo, LADO, RAIO_COMPLETO);
// A splash e o fundo do carregador (#1a0b2e) com o hexagono pequeno no meio; o
// celular corta as bordas conforme a proporcao da tela. Fundo liso e de
// proposito: com o ceu estrelado (ou mesmo um degrade) cada PNG de splash
// passava de 0,5 MB, e eles vao em dezenas de tamanhos para o git e o pacote.
const splash = contexto('splash');
splash.fillStyle = '#1a0b2e';
splash.fillRect(0, 0, 2732, 2732);
pintaHexagono(splash, 2732, 120);

window.__iconePronto = true;
