/**
 * Galeria de modelos de hexagono.
 *
 * Vitrine, nao reimplementacao: desenha com o mesmo `paintHexModel` que o jogo
 * vai usar, sobre os mesmos temas e as mesmas cores de skin. O que se ve aqui
 * e o que vai para a tela.
 */

import { THEMES } from '../src/render/themes.js';
import { SKINS } from '../src/game/content.js';
import { HEX_MODELS, paintHexModel } from '../src/render/hexmodels.js';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const DPR = Math.min(2, window.devicePixelRatio || 1);

/** Temas em vitrine: um claro, dois escuros e os dois de tubo de neon. */
const TEMAS = ['puzzle', 'neon', 'lava', 'classic', 'ice'];

let temaId = 'puzzle';
let skinId = 'classic';

/** Cores efetivas: a skin sobrescreve o tema, exatamente como no jogo. */
function cores() {
  const th = THEMES[temaId];
  const sk = SKINS.find((s) => s.id === skinId) || SKINS[0];
  return {
    fill: sk.fill || th.hexagon.fill,
    stroke: sk.stroke || th.hexagon.stroke,
    core: sk.core || th.hexagon.core,
  };
}

/** Fundo do tema, para o hexagono ser julgado onde ele vive. */
function ceu(ctx, w, h) {
  const th = THEMES[temaId];
  const g = ctx.createLinearGradient(0, 0, 0, h);
  th.sky.forEach((c, i) => g.addColorStop(i / Math.max(1, th.sky.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/**
 * @param {HTMLCanvasElement} cv
 * @param {number} w largura em px CSS
 * @param {number} h
 */
function prepara(cv, w, h) {
  cv.width = Math.round(w * DPR);
  cv.height = Math.round(h * DPR);
  cv.style.aspectRatio = `${w} / ${h}`;
  const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  return ctx;
}

/** Fila com todos os modelos no tamanho em que o jogo desenha. */
function pintaFila() {
  const cv = /** @type {HTMLCanvasElement} */ ($('fila'));
  const n = HEX_MODELS.length;
  const passo = 118;
  const w = passo * n + 24;
  const h = 150;
  const ctx = prepara(cv, w, h);
  ceu(ctx, w, h);
  const th = THEMES[temaId];
  const c = cores();
  HEX_MODELS.forEach((m, i) => {
    // 42 px de raio e o hexagono em tela cheia de celular: 0,75 m x ~56 px/m.
    paintHexModel(ctx, 24 + passo * i + passo / 2 - 12, h / 2 - 8, 42, m.id, c, th.glow);
    ctx.fillStyle = th.inkSoft;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.id, 24 + passo * i + passo / 2 - 12, h - 16);
  });
  $('filaTema').textContent = `${th.label} · skin ${skinId}`;
}

/** Um cartao por modelo: tamanho grande e tamanho de HUD lado a lado. */
function pintaGrade() {
  const host = $('grade');
  host.innerHTML = '';
  const th = THEMES[temaId];
  const c = cores();
  for (const m of HEX_MODELS) {
    const card = document.createElement('div');
    card.className = 'card';
    const cv = document.createElement('canvas');
    card.appendChild(cv);
    const w = 240;
    const h = 170;
    const ctx = prepara(cv, w, h);
    ceu(ctx, w, h);
    paintHexModel(ctx, 86, h / 2, 56, m.id, c, th.glow);
    // O mesmo modelo pequeno: metade dos modelos so mostra se aguenta 24 px.
    paintHexModel(ctx, 188, h / 2 - 26, 24, m.id, c, th.glow);
    paintHexModel(ctx, 188, h / 2 + 30, 14, m.id, c, th.glow);
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<b>${m.nome}</b><span>${m.desc}</span><code>${m.id}</code>`;
    card.appendChild(meta);
    host.appendChild(card);
  }
}

function pinta() {
  pintaFila();
  pintaGrade();
}

function montaChips() {
  const ht = $('temas');
  for (const id of TEMAS) {
    const b = document.createElement('button');
    b.className = 'chip' + (id === temaId ? ' on' : '');
    b.textContent = THEMES[id].label;
    b.onclick = () => {
      temaId = id;
      for (const el of ht.children) el.classList.toggle('on', el === b);
      pinta();
    };
    ht.appendChild(b);
  }
  const hs = $('skins');
  for (const s of SKINS) {
    const b = document.createElement('button');
    b.className = 'chip' + (s.id === skinId ? ' on' : '');
    b.innerHTML = `<i style="background:${s.stroke || '#4fc8ff'}"></i>${s.name}`;
    b.onclick = () => {
      skinId = s.id;
      for (const el of hs.children) el.classList.toggle('on', el === b);
      pinta();
    };
    hs.appendChild(b);
  }
}

montaChips();
pinta();
