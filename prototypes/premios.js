/**
 * Vitrine dos candidatos a premio de mundo (1.0.8).
 *
 * Oficina, nao jogo: os candidatos moram aqui ate o Evandro escolher, e so os
 * escolhidos entram em SKINS (src/game/content.js). Desenha com o mesmo
 * `paintHexModel` e o mesmo `brilhoDaSkin` que o jogo usa, entao o que se ve e
 * o que vai para a tela.
 *
 * Todos na gramatica da joia: tons chapados, contorno por dentro, sem halo e
 * sem mancha radial - os modelos `liso`, `neon`, `nucleo` e `vidro` ficam fora.
 */
import { THEMES } from '../src/render/themes.js';
import { SKINS, WORLD_PRIZES } from '../src/game/content.js';
import { paintHexModel } from '../src/render/hexmodels.js';
import { brilhoDaSkin } from '../src/render/sprites.js';
import { worldTheme } from '../src/game/levelgen.js';

const DPR = Math.min(2, window.devicePixelRatio || 1);
const TEMAS = ['puzzle', 'neon', 'lava', 'classic', 'ice'];

/**
 * Modelos novos (catavento, listras, roseta, estrela, duo, bolinhas, pixel,
 * carinha e xadrez), feitos depois que o Evandro pediu skins novas no lugar
 * das atuais. Vem primeiro na vitrine.
 * @type {{id:string, nome:string, model:string, fill:string, stroke:string, core:string, halo:boolean}[]}
 */
export const NOVOS = [
  { id: 'n-catavento-laranja', nome: 'Catavento laranja', model: 'catavento', fill: '#ff8a1e', stroke: '#9a4a00', core: '#fff0d8', halo: false },
  { id: 'n-catavento-turquesa', nome: 'Catavento turquesa', model: 'catavento', fill: '#19c3d6', stroke: '#0a6f7a', core: '#e2fcff', halo: false },
  { id: 'n-listras-morango', nome: 'Listras morango', model: 'listras', fill: '#ff4d7a', stroke: '#a01a42', core: '#ffe3ec', halo: false },
  { id: 'n-listras-menta', nome: 'Listras menta', model: 'listras', fill: '#2fd6a0', stroke: '#13805c', core: '#eafff6', halo: false },
  { id: 'n-roseta-uva', nome: 'Roseta uva', model: 'roseta', fill: '#8b5cff', stroke: '#4a22b0', core: '#f1e9ff', halo: false },
  { id: 'n-estrela-noite', nome: 'Estrela da noite', model: 'estrela', fill: '#2e3fbf', stroke: '#141f6e', core: '#ffe36a', halo: false },
  { id: 'n-duo-lima', nome: 'Duo lima', model: 'duo', fill: '#8ee03c', stroke: '#467a10', core: '#f6ffe6', halo: false },
  { id: 'n-bolinhas-sol', nome: 'Bolinhas sol', model: 'bolinhas', fill: '#ffc21e', stroke: '#9a6a00', core: '#fff7d6', halo: false },
  { id: 'n-bolinhas-chiclete', nome: 'Bolinhas chiclete', model: 'bolinhas', fill: '#ff7ac8', stroke: '#a3307a', core: '#fff0f8', halo: false },
  { id: 'n-pixel-folha', nome: 'Pixel folha', model: 'pixel', fill: '#3fcf5a', stroke: '#1b6e2a', core: '#e9ffe9', halo: false },
  { id: 'n-pixel-brasa', nome: 'Pixel brasa', model: 'pixel', fill: '#ff4a3d', stroke: '#8a1810', core: '#ffe2dc', halo: false },
  { id: 'n-carinha-sol', nome: 'Carinha sol', model: 'carinha', fill: '#ffc93c', stroke: '#9a6a00', core: '#fff3cf', halo: false },
  { id: 'n-carinha-rosa', nome: 'Carinha rosa', model: 'carinha', fill: '#ff8fb8', stroke: '#a3406a', core: '#fff0f6', halo: false },
  { id: 'n-xadrez-grafite', nome: 'Xadrez grafite', model: 'xadrez', fill: '#30334a', stroke: '#8a8fb0', core: '#5b6080', halo: false },
  { id: 'n-xadrez-laranja', nome: 'Xadrez laranja', model: 'xadrez', fill: '#ff9a3c', stroke: '#9a4a00', core: '#ffc98f', halo: false },
];

/** Os candidatos da primeira rodada (recolores dos modelos que ja existiam). @type {*} */
export const CANDIDATOS = [
  { id: 'c-favo-ambar', nome: 'Favo âmbar', model: 'favo', fill: '#ffb21e', stroke: '#b86e00', core: '#fff1c2', halo: false },
  { id: 'c-favo-menta', nome: 'Favo menta', model: 'favo', fill: '#2fd6a0', stroke: '#13805c', core: '#e2fff4', halo: false },
  { id: 'c-origami-coral', nome: 'Origami coral', model: 'origami', fill: '#ff6f61', stroke: '#b8362c', core: '#ffe2dc', halo: false },
  { id: 'c-origami-azul', nome: 'Origami azul', model: 'origami', fill: '#4f8bff', stroke: '#22489e', core: '#e3ecff', halo: false },
  { id: 'c-joia-rubi', nome: 'Rubi', model: 'joia', fill: '#e0284a', stroke: '#8a1028', core: '#ffe0e6', halo: false },
  { id: 'c-joia-esmeralda', nome: 'Esmeralda', model: 'joia', fill: '#18b866', stroke: '#0b6a3a', core: '#dcffeb', halo: false },
  { id: 'c-joia-safira', nome: 'Safira', model: 'joia', fill: '#2f6bff', stroke: '#173a9e', core: '#dfe8ff', halo: false },
  { id: 'c-joia-ametista', nome: 'Ametista', model: 'joia', fill: '#9b4dff', stroke: '#5a1fb0', core: '#f0e4ff', halo: false },
  { id: 'c-joia-onix', nome: 'Ônix', model: 'joia', fill: '#2b2d3a', stroke: '#8a8fb0', core: '#d6d9ee', halo: false },
  { id: 'c-ouro-rose', nome: 'Ouro rosé', model: 'ouro', fill: '#f2a38a', stroke: '#a85a44', core: '#fff0ea', halo: false },
  { id: 'c-placa-cobre', nome: 'Placa cobre', model: 'placa', fill: '#d9773a', stroke: '#7d3c14', core: '#ffe4d0', halo: false },
  { id: 'c-gema-turquesa', nome: 'Gema turquesa', model: 'gema', fill: '#2fd3e0', stroke: '#117a84', core: '#e0fcff', halo: false },
];

/** @param {HTMLCanvasElement} cv @param {number} w @param {number} h */
function prepara(cv, w, h) {
  cv.width = Math.round(w * DPR);
  cv.height = Math.round(h * DPR);
  const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  return ctx;
}

/** Ceu do tema num retangulo. */
function ceu(ctx, th, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  th.sky.forEach((c, i) => g.addColorStop(i / Math.max(1, th.sky.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/** Hexagono de uma skin (ou candidato) do jeito do jogo. */
function hex(ctx, s, th, cx, cy, r) {
  paintHexModel(
    ctx,
    cx,
    cy,
    r,
    s.model || 'joia',
    { fill: s.fill || th.hexagon.fill, stroke: s.stroke || th.hexagon.stroke, core: s.core || th.hexagon.core },
    brilhoDaSkin(s, th.glow),
  );
  if (s.mark) s.mark(ctx, cx, cy, r, th);
}

function pintaCandidatos(lista, hostId, primeiro) {
  const host = /** @type {HTMLElement} */ (document.getElementById(hostId));
  lista.forEach((c, k) => {
    const card = document.createElement('div');
    card.className = 'card';
    const cv = document.createElement('canvas');
    const passo = 104;
    const w = passo * TEMAS.length + 120;
    const h = 120;
    const ctx = prepara(cv, w, h);
    TEMAS.forEach((id, i) => {
      const th = THEMES[id];
      ceu(ctx, th, i * passo, 0, passo, h);
      hex(ctx, c, th, i * passo + passo / 2, h / 2, 42);
    });
    // Tamanhos do selo (r 22) e do HUD (r 9), no tema do mundo 1.
    const th = THEMES.puzzle;
    ceu(ctx, th, TEMAS.length * passo, 0, 120, h);
    hex(ctx, c, th, TEMAS.length * passo + 40, h / 2, 22);
    hex(ctx, c, th, TEMAS.length * passo + 92, h / 2, 9);
    card.appendChild(cv);
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<b>#${primeiro + k} ${c.nome}</b><span>${c.model}</span><code>${c.id}</code>`;
    card.appendChild(meta);
    host.appendChild(card);
  });
}

function pintaTrilha() {
  const cv = /** @type {HTMLCanvasElement} */ (document.getElementById('trilha'));
  const premios = WORLD_PRIZES.map((p, w) => ({ p, w })).filter((x) => 'skin' in x.p);
  const passo = 112;
  const w = passo * premios.length;
  const h = 150;
  const ctx = prepara(cv, w, h);
  premios.forEach(({ p, w: mundo }, i) => {
    const th = THEMES[worldTheme(mundo)];
    ceu(ctx, th, i * passo, 0, passo, h);
    const s = SKINS.find((k) => k.id === /** @type {*} */ (p).skin);
    if (s) hex(ctx, s, th, i * passo + passo / 2, 62, 38);
    ctx.fillStyle = th.ink || '#fff';
    ctx.font = '700 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`mundo ${mundo + 1}`, i * passo + passo / 2, 126);
    ctx.font = '600 11px system-ui';
    ctx.fillText(s ? s.id : '?', i * passo + passo / 2, 142);
  });
}

function pintaAtuais() {
  const cv = /** @type {HTMLCanvasElement} */ (document.getElementById('atuais'));
  const ids = ['mint', 'ember', 'violet', 'gold', 'circuit', 'aurora'];
  const temas = ['neon', 'lava'];
  const passo = 104;
  const w = passo * ids.length * temas.length;
  const h = 220;
  const ctx = prepara(cv, w, h);
  temas.forEach((tid, t) => {
    const th = THEMES[tid];
    ids.forEach((id, i) => {
      const x = (t * ids.length + i) * passo;
      ceu(ctx, th, x, 0, passo, h);
      const s = SKINS.find((k) => k.id === id);
      if (!s) return;
      hex(ctx, s, th, x + passo / 2, 58, 40);
      hex(ctx, { ...s, halo: false }, th, x + passo / 2, 160, 40);
    });
  });
}

pintaCandidatos(NOVOS, 'novos', 1);
pintaCandidatos(CANDIDATOS, 'candidatos', NOVOS.length + 1);
pintaTrilha();
pintaAtuais();
