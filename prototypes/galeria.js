/**
 * Galeria de hexagonos para escolher as skins do jogo (oficina, nao entra no
 * build).
 *
 * O Evandro nao gostou dos hexagonos da 1.0.8 e pediu mais de cinquenta
 * modelos para escolher. Todos aqui seguem as regras que ja custaram rodadas:
 * a silhueta e exatamente a do corpo fisico (`hexPath` de render/hexmodels.js,
 * topo e base planos), o traco e chapado com contorno por dentro, e nao ha
 * halo nem mancha radial - a "lampada" que ele ja recusou no `liso`.
 *
 * Os escolhidos viram modelos em render/hexmodels.js e skins em
 * game/content.js; ate la, moram so aqui.
 */
import { hexPath } from '../src/render/hexmodels.js';
import { THEMES } from '../src/render/themes.js';

const H = Math.sqrt(3) / 2;
const TAU = Math.PI * 2;
const DPR = Math.min(2, window.devicePixelRatio || 1);
const TINTA = '#1d1a2b';

// ------------------------------------------------------------------ cores ---

/** @param {string} c @returns {number[]} */
function rgb(c) {
  const h = c.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
/** @param {string} a @param {string} b @param {number} t */
function mistura(a, b, t) {
  const x = rgb(a);
  const y = rgb(b);
  const m = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('');
}
const escuro = (/** @type {string} */ c, t = 0.45) => mistura(c, '#000000', t);
const claro = (/** @type {string} */ c, t = 0.4) => mistura(c, '#ffffff', t);

// ------------------------------------------------------------- primitivas ---

/** @typedef {CanvasRenderingContext2D} Ctx */

/** @param {Ctx} ctx @param {number} cx @param {number} cy @param {number} r @param {string} cor */
function corpo(ctx, cx, cy, r, cor) {
  hexPath(ctx, cx, cy, r);
  ctx.fillStyle = cor;
  ctx.fill();
}
/** Desenha so dentro da silhueta. @param {Ctx} ctx @param {number} cx @param {number} cy @param {number} r @param {()=>void} fn */
function dentro(ctx, cx, cy, r, fn) {
  ctx.save();
  hexPath(ctx, cx, cy, r);
  ctx.clip();
  fn();
  ctx.restore();
}
/** Contorno por dentro da silhueta. @param {Ctx} ctx @param {number} cx @param {number} cy @param {number} r @param {string} cor */
function contorno(ctx, cx, cy, r, cor) {
  const w = Math.max(1.2, r * 0.075);
  ctx.save();
  hexPath(ctx, cx, cy, r - w / 2);
  ctx.lineWidth = w;
  ctx.strokeStyle = cor;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}
/** Faixa chapada mais escura no terco de baixo: volume sem degrade. */
function sombra(/** @type {Ctx} */ ctx, cx, cy, r, a = 0.13) {
  dentro(ctx, cx, cy, r, () => {
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(cx - r, cy + r * 0.32, r * 2, r);
  });
}
/** Faixa chapada mais clara no alto. */
function luz(/** @type {Ctx} */ ctx, cx, cy, r, a = 0.14) {
  dentro(ctx, cx, cy, r, () => {
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 0.45);
  });
}
function circ(/** @type {Ctx} */ ctx, x, y, rr, cor) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, rr), 0, TAU);
  ctx.fillStyle = cor;
  ctx.fill();
}
function elipse(/** @type {Ctx} */ ctx, x, y, rx, ry, cor, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  ctx.fillStyle = cor;
  ctx.fill();
}
/** @param {Ctx} ctx @param {number[][]} pts @param {string} cor */
function poli(ctx, pts, cor) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = cor;
  ctx.fill();
}
/** @param {Ctx} ctx @param {number[][]} pts @param {string} cor @param {number} w */
function traco(ctx, pts, cor, w) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = cor;
  ctx.lineWidth = Math.max(0.8, w);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}
function arco(/** @type {Ctx} */ ctx, x, y, rr, a0, a1, cor, w) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, rr), a0, a1);
  ctx.strokeStyle = cor;
  ctx.lineWidth = Math.max(0.8, w);
  ctx.lineCap = 'round';
  ctx.stroke();
}
/** Estrela de n pontas. */
function estrela(/** @type {Ctx} */ ctx, x, y, re, ri, cor, n = 5, giro = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? ri : re;
    const a = giro + (i * Math.PI) / n;
    pts.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]);
  }
  poli(ctx, pts, cor);
}
/** Coracao centrado em (x, y), largura ~2s. */
function coracao(/** @type {Ctx} */ ctx, x, y, s, cor) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  ctx.fillStyle = cor;
  ctx.fill();
}

// ------------------------------------------------------------------ rosto ---

function olho(/** @type {Ctx} */ ctx, x, y, s, iris = TINTA) {
  circ(ctx, x, y, s, '#ffffff');
  circ(ctx, x + s * 0.12, y + s * 0.08, s * 0.6, iris);
  circ(ctx, x + s * 0.32, y - s * 0.18, s * 0.22, '#ffffff');
}
function pontinho(/** @type {Ctx} */ ctx, x, y, s, cor = TINTA) {
  circ(ctx, x, y, s, cor);
  circ(ctx, x + s * 0.35, y - s * 0.35, s * 0.32, '#ffffff');
}
function olhoFeliz(/** @type {Ctx} */ ctx, x, y, s, cor = TINTA) {
  arco(ctx, x, y + s * 0.45, s * 0.75, Math.PI * 1.15, Math.PI * 1.85, cor, s * 0.42);
}
function olhoFechado(/** @type {Ctx} */ ctx, x, y, s, cor = TINTA) {
  arco(ctx, x, y - s * 0.45, s * 0.75, Math.PI * 0.15, Math.PI * 0.85, cor, s * 0.38);
}
function sorriso(/** @type {Ctx} */ ctx, x, y, w, cor = TINTA, lw = w * 0.32) {
  arco(ctx, x, y - w * 0.55, w, Math.PI * 0.22, Math.PI * 0.78, cor, lw);
}
function bocaAberta(/** @type {Ctx} */ ctx, x, y, w, lingua = '#ff6b8a') {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x, y + w * 1.5, x + w, y);
  ctx.closePath();
  ctx.fillStyle = TINTA;
  ctx.fill();
  ctx.clip();
  elipse(ctx, x, y + w * 0.75, w * 0.55, w * 0.35, lingua);
  ctx.restore();
}
function bochechas(/** @type {Ctx} */ ctx, cx, cy, r, cor = 'rgba(255,110,140,0.45)', dx = 0.48, dy = 0.14) {
  elipse(ctx, cx - r * dx, cy + r * dy, r * 0.13, r * 0.08, cor);
  elipse(ctx, cx + r * dx, cy + r * dy, r * 0.13, r * 0.08, cor);
}

// ---------------------------------------------------------------- modelos ---
// Cada modelo pinta tudo: corpo, desenho e contorno. (ctx, cx, cy, r).

/** @type {{id:string, nome:string, grupo:string, f:(ctx:Ctx, cx:number, cy:number, r:number)=>void}[]} */
const MODELOS = [];
/** @param {string} grupo @param {string} id @param {string} nome @param {(ctx:Ctx, cx:number, cy:number, r:number)=>void} f */
function m(grupo, id, nome, f) {
  MODELOS.push({ grupo, id, nome, f });
}

/** Carinha generica: corpo, luz, sombra, desenho do rosto, contorno. */
function carinha(cor, rosto) {
  return (/** @type {Ctx} */ ctx, cx, cy, r) => {
    corpo(ctx, cx, cy, r, cor);
    luz(ctx, cx, cy, r, 0.16);
    sombra(ctx, cx, cy, r, 0.1);
    rosto(ctx, cx, cy, r);
    contorno(ctx, cx, cy, r, escuro(cor, 0.42));
  };
}

// --- carinhas ----------------------------------------------------------------
m('Carinhas', 'feliz', 'Feliz', carinha('#ffc93c', (ctx, cx, cy, r) => {
  pontinho(ctx, cx - r * 0.28, cy - r * 0.12, r * 0.11);
  pontinho(ctx, cx + r * 0.28, cy - r * 0.12, r * 0.11);
  sorriso(ctx, cx, cy + r * 0.2, r * 0.3, TINTA, r * 0.09);
  bochechas(ctx, cx, cy, r);
}));
m('Carinhas', 'apaixonado', 'Apaixonado', carinha('#ff8fb8', (ctx, cx, cy, r) => {
  coracao(ctx, cx - r * 0.3, cy - r * 0.12, r * 0.16, '#e0284a');
  coracao(ctx, cx + r * 0.3, cy - r * 0.12, r * 0.16, '#e0284a');
  bocaAberta(ctx, cx, cy + r * 0.2, r * 0.2);
}));
m('Carinhas', 'descolado', 'Descolado', carinha('#4fb3ff', (ctx, cx, cy, r) => {
  const y = cy - r * 0.14;
  ctx.fillStyle = TINTA;
  ctx.beginPath();
  ctx.roundRect(cx - r * 0.6, y - r * 0.13, r * 0.52, r * 0.28, r * 0.1);
  ctx.roundRect(cx + r * 0.08, y - r * 0.13, r * 0.52, r * 0.28, r * 0.1);
  ctx.fill();
  traco(ctx, [[cx - r * 0.1, y - r * 0.05], [cx + r * 0.1, y - r * 0.05]], TINTA, r * 0.07);
  traco(ctx, [[cx - r * 0.5, y - r * 0.06], [cx - r * 0.36, y - r * 0.06]], 'rgba(255,255,255,0.6)', r * 0.04);
  traco(ctx, [[cx - r * 0.15, cy + r * 0.3], [cx + r * 0.2, cy + r * 0.22]], TINTA, r * 0.08);
}));
m('Carinhas', 'piscadinha', 'Piscadinha', carinha('#ff9a3c', (ctx, cx, cy, r) => {
  pontinho(ctx, cx - r * 0.28, cy - r * 0.12, r * 0.11);
  olhoFechado(ctx, cx + r * 0.28, cy - r * 0.1, r * 0.14);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.25, cy + r * 0.16);
  ctx.quadraticCurveTo(cx, cy + r * 0.42, cx + r * 0.25, cy + r * 0.16);
  ctx.closePath();
  ctx.fillStyle = TINTA;
  ctx.fill();
  ctx.restore();
  elipse(ctx, cx + r * 0.1, cy + r * 0.34, r * 0.1, r * 0.12, '#ff6b8a');
  bochechas(ctx, cx, cy, r);
}));
m('Carinhas', 'bravo', 'Bravo', carinha('#ff4d4d', (ctx, cx, cy, r) => {
  pontinho(ctx, cx - r * 0.28, cy - r * 0.06, r * 0.1);
  pontinho(ctx, cx + r * 0.28, cy - r * 0.06, r * 0.1);
  traco(ctx, [[cx - r * 0.45, cy - r * 0.32], [cx - r * 0.14, cy - r * 0.18]], TINTA, r * 0.09);
  traco(ctx, [[cx + r * 0.45, cy - r * 0.32], [cx + r * 0.14, cy - r * 0.18]], TINTA, r * 0.09);
  arco(ctx, cx, cy + r * 0.48, r * 0.24, Math.PI * 1.2, Math.PI * 1.8, TINTA, r * 0.09);
}));
m('Carinhas', 'sonolento', 'Sonolento', carinha('#b69cff', (ctx, cx, cy, r) => {
  olhoFechado(ctx, cx - r * 0.28, cy - r * 0.08, r * 0.14);
  olhoFechado(ctx, cx + r * 0.28, cy - r * 0.08, r * 0.14);
  circ(ctx, cx, cy + r * 0.28, r * 0.08, TINTA);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${r * 0.3}px system-ui, sans-serif`;
  ctx.fillText('z', cx + r * 0.38, cy - r * 0.32);
  ctx.font = `800 ${r * 0.2}px system-ui, sans-serif`;
  ctx.fillText('z', cx + r * 0.58, cy - r * 0.5);
}));
m('Carinhas', 'surpreso', 'Surpreso', carinha('#2fd3c0', (ctx, cx, cy, r) => {
  olho(ctx, cx - r * 0.28, cy - r * 0.12, r * 0.17);
  olho(ctx, cx + r * 0.28, cy - r * 0.12, r * 0.17);
  elipse(ctx, cx, cy + r * 0.32, r * 0.11, r * 0.14, TINTA);
}));
m('Carinhas', 'estrelado', 'Olhos de estrela', carinha('#8b5cff', (ctx, cx, cy, r) => {
  estrela(ctx, cx - r * 0.3, cy - r * 0.12, r * 0.19, r * 0.08, '#ffe36a');
  estrela(ctx, cx + r * 0.3, cy - r * 0.12, r * 0.19, r * 0.08, '#ffe36a');
  bocaAberta(ctx, cx, cy + r * 0.2, r * 0.22);
}));
m('Carinhas', 'timido', 'Tímido', carinha('#ffb08a', (ctx, cx, cy, r) => {
  pontinho(ctx, cx - r * 0.34, cy - r * 0.08, r * 0.09);
  pontinho(ctx, cx + r * 0.2, cy - r * 0.08, r * 0.09);
  sorriso(ctx, cx - r * 0.06, cy + r * 0.24, r * 0.16, TINTA, r * 0.07);
  bochechas(ctx, cx, cy, r, 'rgba(255,70,110,0.55)', 0.5, 0.12);
}));
m('Carinhas', 'maluco', 'Maluquinho', carinha('#8ee03c', (ctx, cx, cy, r) => {
  olho(ctx, cx - r * 0.28, cy - r * 0.12, r * 0.18);
  circ(ctx, cx + r * 0.28, cy - r * 0.16, r * 0.12, '#ffffff');
  circ(ctx, cx + r * 0.24, cy - r * 0.14, r * 0.06, TINTA);
  bocaAberta(ctx, cx, cy + r * 0.18, r * 0.24, '#ff5f7a');
}));
m('Carinhas', 'risada', 'Risada', carinha('#ffd84a', (ctx, cx, cy, r) => {
  olhoFeliz(ctx, cx - r * 0.28, cy - r * 0.1, r * 0.15);
  olhoFeliz(ctx, cx + r * 0.28, cy - r * 0.1, r * 0.15);
  bocaAberta(ctx, cx, cy + r * 0.12, r * 0.3);
  bochechas(ctx, cx, cy, r);
}));
m('Carinhas', 'fofinho', 'Fofinho', carinha('#9fe7ff', (ctx, cx, cy, r) => {
  olho(ctx, cx - r * 0.3, cy - r * 0.06, r * 0.2, '#2b3a8f');
  olho(ctx, cx + r * 0.3, cy - r * 0.06, r * 0.2, '#2b3a8f');
  sorriso(ctx, cx, cy + r * 0.28, r * 0.1, TINTA, r * 0.06);
  bochechas(ctx, cx, cy, r, 'rgba(255,120,170,0.5)', 0.56, 0.2);
}));

// --- bichos ------------------------------------------------------------------
/** Orelhas triangulares nos cantos de cima, por dentro da silhueta. */
function orelhas(ctx, cx, cy, r, cor, dentroCor) {
  const y = cy - r * H;
  for (const lado of [-1, 1]) {
    poli(ctx, [[cx + lado * r * 0.62, y + r * 0.02], [cx + lado * r * 0.22, y + r * 0.02], [cx + lado * r * 0.5, y + r * 0.42]], cor);
    poli(ctx, [[cx + lado * r * 0.54, y + r * 0.06], [cx + lado * r * 0.3, y + r * 0.06], [cx + lado * r * 0.47, y + r * 0.3]], dentroCor);
  }
}
m('Bichos', 'gato', 'Gatinho', (ctx, cx, cy, r) => {
  const cor = '#a3a8c3';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => orelhas(ctx, cx, cy, r, escuro(cor, 0.25), '#ff9fb8'));
  sombra(ctx, cx, cy, r, 0.08);
  pontinho(ctx, cx - r * 0.26, cy - r * 0.02, r * 0.1);
  pontinho(ctx, cx + r * 0.26, cy - r * 0.02, r * 0.1);
  poli(ctx, [[cx - r * 0.07, cy + r * 0.12], [cx + r * 0.07, cy + r * 0.12], [cx, cy + r * 0.2]], '#ff6b8a');
  arco(ctx, cx - r * 0.07, cy + r * 0.2, r * 0.07, 0, Math.PI, TINTA, r * 0.04);
  arco(ctx, cx + r * 0.07, cy + r * 0.2, r * 0.07, 0, Math.PI, TINTA, r * 0.04);
  for (const lado of [-1, 1]) {
    traco(ctx, [[cx + lado * r * 0.2, cy + r * 0.16], [cx + lado * r * 0.62, cy + r * 0.08]], escuro(cor, 0.5), r * 0.03);
    traco(ctx, [[cx + lado * r * 0.2, cy + r * 0.22], [cx + lado * r * 0.62, cy + r * 0.26]], escuro(cor, 0.5), r * 0.03);
  }
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Bichos', 'raposa', 'Raposa', (ctx, cx, cy, r) => {
  const cor = '#ff8a2e';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    orelhas(ctx, cx, cy, r, escuro(cor, 0.2), '#3a1f10');
    poli(ctx, [[cx - r, cy + r * 0.02], [cx, cy + r * 0.62], [cx + r, cy + r * 0.02], [cx + r, cy + r], [cx - r, cy + r]], '#fff4e6');
  });
  pontinho(ctx, cx - r * 0.26, cy - r * 0.08, r * 0.1);
  pontinho(ctx, cx + r * 0.26, cy - r * 0.08, r * 0.1);
  elipse(ctx, cx, cy + r * 0.5, r * 0.1, r * 0.07, TINTA);
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Bichos', 'panda', 'Panda', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#f4f6fb');
  dentro(ctx, cx, cy, r, () => {
    circ(ctx, cx - r * 0.55, cy - r * 0.78, r * 0.26, TINTA);
    circ(ctx, cx + r * 0.55, cy - r * 0.78, r * 0.26, TINTA);
  });
  sombra(ctx, cx, cy, r, 0.06);
  elipse(ctx, cx - r * 0.28, cy - r * 0.04, r * 0.17, r * 0.13, TINTA, 0.5);
  elipse(ctx, cx + r * 0.28, cy - r * 0.04, r * 0.17, r * 0.13, TINTA, -0.5);
  circ(ctx, cx - r * 0.26, cy - r * 0.06, r * 0.05, '#ffffff');
  circ(ctx, cx + r * 0.26, cy - r * 0.06, r * 0.05, '#ffffff');
  elipse(ctx, cx, cy + r * 0.2, r * 0.09, r * 0.06, TINTA);
  sorriso(ctx, cx, cy + r * 0.34, r * 0.08, TINTA, r * 0.04);
  contorno(ctx, cx, cy, r, '#8a8fb0');
});
m('Bichos', 'sapo', 'Sapinho', (ctx, cx, cy, r) => {
  const cor = '#5ad15a';
  corpo(ctx, cx, cy, r, cor);
  luz(ctx, cx, cy, r, 0.12);
  dentro(ctx, cx, cy, r, () => {
    circ(ctx, cx - r * 0.34, cy - r * 0.62, r * 0.24, cor);
    circ(ctx, cx + r * 0.34, cy - r * 0.62, r * 0.24, cor);
  });
  olho(ctx, cx - r * 0.34, cy - r * 0.52, r * 0.17);
  olho(ctx, cx + r * 0.34, cy - r * 0.52, r * 0.17);
  sorriso(ctx, cx, cy + r * 0.22, r * 0.42, escuro(cor, 0.55), r * 0.07);
  bochechas(ctx, cx, cy, r, 'rgba(255,120,140,0.5)', 0.56, 0.12);
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Bichos', 'pinguim', 'Pinguim', (ctx, cx, cy, r) => {
  const cor = '#262a40';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => elipse(ctx, cx, cy + r * 0.12, r * 0.6, r * 0.72, '#f4f6fb'));
  pontinho(ctx, cx - r * 0.22, cy - r * 0.1, r * 0.09);
  pontinho(ctx, cx + r * 0.22, cy - r * 0.1, r * 0.09);
  poli(ctx, [[cx - r * 0.12, cy + r * 0.06], [cx + r * 0.12, cy + r * 0.06], [cx, cy + r * 0.24]], '#ffa62b');
  bochechas(ctx, cx, cy, r, 'rgba(255,120,160,0.45)', 0.4, 0.12);
  contorno(ctx, cx, cy, r, claro(cor, 0.3));
});
m('Bichos', 'coruja', 'Coruja', (ctx, cx, cy, r) => {
  const cor = '#9a6a3a';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    poli(ctx, [[cx - r, cy - r * 0.2], [cx, cy + r * 0.05], [cx + r, cy - r * 0.2], [cx + r, cy + r], [cx - r, cy + r]], claro(cor, 0.35));
    for (let i = 0; i < 3; i++) arco(ctx, cx + (i - 1) * r * 0.25, cy + r * 0.5, r * 0.1, 0, Math.PI, escuro(cor, 0.1), r * 0.04);
  });
  circ(ctx, cx - r * 0.3, cy - r * 0.18, r * 0.24, '#fff3d0');
  circ(ctx, cx + r * 0.3, cy - r * 0.18, r * 0.24, '#fff3d0');
  pontinho(ctx, cx - r * 0.3, cy - r * 0.18, r * 0.12);
  pontinho(ctx, cx + r * 0.3, cy - r * 0.18, r * 0.12);
  poli(ctx, [[cx - r * 0.08, cy - r * 0.02], [cx + r * 0.08, cy - r * 0.02], [cx, cy + r * 0.16]], '#ffb22b');
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Bichos', 'abelha', 'Abelhinha', (ctx, cx, cy, r) => {
  const cor = '#ffcf24';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    ctx.fillStyle = TINTA;
    ctx.fillRect(cx - r, cy + r * 0.3, r * 2, r * 0.16);
    ctx.fillRect(cx - r, cy + r * 0.62, r * 2, r * 0.16);
  });
  pontinho(ctx, cx - r * 0.24, cy - r * 0.18, r * 0.1);
  pontinho(ctx, cx + r * 0.24, cy - r * 0.18, r * 0.1);
  sorriso(ctx, cx, cy + r * 0.08, r * 0.14, TINTA, r * 0.06);
  traco(ctx, [[cx - r * 0.12, cy - r * 0.5], [cx - r * 0.24, cy - r * 0.74]], TINTA, r * 0.05);
  traco(ctx, [[cx + r * 0.12, cy - r * 0.5], [cx + r * 0.24, cy - r * 0.74]], TINTA, r * 0.05);
  circ(ctx, cx - r * 0.24, cy - r * 0.74, r * 0.06, TINTA);
  circ(ctx, cx + r * 0.24, cy - r * 0.74, r * 0.06, TINTA);
  contorno(ctx, cx, cy, r, escuro(cor, 0.5));
});
m('Bichos', 'joaninha', 'Joaninha', (ctx, cx, cy, r) => {
  const cor = '#e8333b';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    ctx.fillStyle = TINTA;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 0.62);
    traco(ctx, [[cx, cy - r * 0.38], [cx, cy + r]], TINTA, r * 0.06);
    for (const [x, y, s] of [[-0.45, 0.05, 0.13], [0.45, 0.05, 0.13], [-0.3, 0.45, 0.11], [0.3, 0.45, 0.11], [-0.68, 0.32, 0.08], [0.68, 0.32, 0.08]]) circ(ctx, cx + r * x, cy + r * y, r * s, TINTA);
  });
  pontinho(ctx, cx - r * 0.2, cy - r * 0.62, r * 0.08, '#ffffff');
  pontinho(ctx, cx + r * 0.2, cy - r * 0.62, r * 0.08, '#ffffff');
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Bichos', 'urso', 'Ursinho', (ctx, cx, cy, r) => {
  const cor = '#b07848';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    circ(ctx, cx - r * 0.5, cy - r * 0.78, r * 0.24, escuro(cor, 0.15));
    circ(ctx, cx + r * 0.5, cy - r * 0.78, r * 0.24, escuro(cor, 0.15));
    circ(ctx, cx - r * 0.5, cy - r * 0.78, r * 0.12, '#ffb3a0');
    circ(ctx, cx + r * 0.5, cy - r * 0.78, r * 0.12, '#ffb3a0');
  });
  pontinho(ctx, cx - r * 0.26, cy - r * 0.12, r * 0.09);
  pontinho(ctx, cx + r * 0.26, cy - r * 0.12, r * 0.09);
  elipse(ctx, cx, cy + r * 0.22, r * 0.26, r * 0.2, claro(cor, 0.45));
  elipse(ctx, cx, cy + r * 0.14, r * 0.09, r * 0.06, TINTA);
  sorriso(ctx, cx, cy + r * 0.3, r * 0.07, TINTA, r * 0.04);
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Bichos', 'coelho', 'Coelhinho', (ctx, cx, cy, r) => {
  const cor = '#f2f0fa';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    elipse(ctx, cx - r * 0.24, cy - r * 0.78, r * 0.12, r * 0.34, '#d6d3e6');
    elipse(ctx, cx + r * 0.24, cy - r * 0.78, r * 0.12, r * 0.34, '#d6d3e6');
    elipse(ctx, cx - r * 0.24, cy - r * 0.76, r * 0.06, r * 0.24, '#ff9fb8');
    elipse(ctx, cx + r * 0.24, cy - r * 0.76, r * 0.06, r * 0.24, '#ff9fb8');
  });
  pontinho(ctx, cx - r * 0.24, cy - r * 0.02, r * 0.09);
  pontinho(ctx, cx + r * 0.24, cy - r * 0.02, r * 0.09);
  elipse(ctx, cx, cy + r * 0.16, r * 0.07, r * 0.05, '#ff6b8a');
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#a8a4c0';
  ctx.lineWidth = r * 0.025;
  ctx.fillRect(cx - r * 0.08, cy + r * 0.24, r * 0.16, r * 0.14);
  ctx.strokeRect(cx - r * 0.08, cy + r * 0.24, r * 0.16, r * 0.14);
  bochechas(ctx, cx, cy, r, 'rgba(255,120,170,0.45)', 0.46, 0.16);
  contorno(ctx, cx, cy, r, '#a8a4c0');
});
m('Bichos', 'porquinho', 'Porquinho', (ctx, cx, cy, r) => {
  const cor = '#ffa3c4';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => orelhas(ctx, cx, cy, r, escuro(cor, 0.12), escuro(cor, 0.25)));
  pontinho(ctx, cx - r * 0.28, cy - r * 0.08, r * 0.09);
  pontinho(ctx, cx + r * 0.28, cy - r * 0.08, r * 0.09);
  elipse(ctx, cx, cy + r * 0.22, r * 0.26, r * 0.18, escuro(cor, 0.15));
  elipse(ctx, cx - r * 0.09, cy + r * 0.22, r * 0.05, r * 0.07, escuro(cor, 0.5));
  elipse(ctx, cx + r * 0.09, cy + r * 0.22, r * 0.05, r * 0.07, escuro(cor, 0.5));
  contorno(ctx, cx, cy, r, escuro(cor, 0.4));
});
m('Bichos', 'polvo', 'Polvinho', (ctx, cx, cy, r) => {
  const cor = '#b55cff';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    for (let i = 0; i < 5; i++) circ(ctx, cx + (i - 2) * r * 0.36, cy + r * 0.9, r * 0.2, escuro(cor, 0.2));
    for (let i = 0; i < 4; i++) circ(ctx, cx + (i - 1.5) * r * 0.36, cy + r * 0.56, r * 0.06, claro(cor, 0.45));
  });
  olho(ctx, cx - r * 0.26, cy - r * 0.18, r * 0.17);
  olho(ctx, cx + r * 0.26, cy - r * 0.18, r * 0.17);
  elipse(ctx, cx, cy + r * 0.16, r * 0.08, r * 0.07, TINTA);
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Bichos', 'dino', 'Dinossauro', (ctx, cx, cy, r) => {
  const cor = '#3fbf6a';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    const y = cy - r * H;
    for (let i = 0; i < 4; i++) poli(ctx, [[cx - r * 0.42 + i * r * 0.28, y], [cx - r * 0.28 + i * r * 0.28, y + r * 0.26], [cx - r * 0.14 + i * r * 0.28, y]], '#ffcf3a');
    elipse(ctx, cx, cy + r * 0.62, r * 0.6, r * 0.34, claro(cor, 0.45));
  });
  olho(ctx, cx - r * 0.24, cy - r * 0.18, r * 0.15);
  olho(ctx, cx + r * 0.24, cy - r * 0.18, r * 0.15);
  sorriso(ctx, cx, cy + r * 0.12, r * 0.24, escuro(cor, 0.6), r * 0.06);
  poli(ctx, [[cx - r * 0.1, cy + r * 0.1], [cx - r * 0.04, cy + r * 0.2], [cx + r * 0.02, cy + r * 0.1]], '#ffffff');
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Bichos', 'leao', 'Leãozinho', (ctx, cx, cy, r) => {
  const juba = '#e0731e';
  corpo(ctx, cx, cy, r, juba);
  dentro(ctx, cx, cy, r, () => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      circ(ctx, cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, r * 0.2, escuro(juba, 0.12));
    }
  });
  circ(ctx, cx, cy, r * 0.55, '#ffc94a');
  pontinho(ctx, cx - r * 0.2, cy - r * 0.1, r * 0.08);
  pontinho(ctx, cx + r * 0.2, cy - r * 0.1, r * 0.08);
  poli(ctx, [[cx - r * 0.08, cy + r * 0.08], [cx + r * 0.08, cy + r * 0.08], [cx, cy + r * 0.17]], '#7a3f12');
  sorriso(ctx, cx, cy + r * 0.24, r * 0.1, '#7a3f12', r * 0.04);
  contorno(ctx, cx, cy, r, escuro(juba, 0.45));
});
m('Bichos', 'tigre', 'Tigrinho', (ctx, cx, cy, r) => {
  const cor = '#ff9b2e';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    for (const lado of [-1, 1]) {
      for (let i = 0; i < 3; i++) poli(ctx, [[cx + lado * r, cy - r * 0.5 + i * r * 0.32], [cx + lado * r * 0.62, cy - r * 0.42 + i * r * 0.32], [cx + lado * r, cy - r * 0.34 + i * r * 0.32]], TINTA);
    }
    poli(ctx, [[cx - r * 0.12, cy - r], [cx + r * 0.12, cy - r], [cx, cy - r * 0.55]], TINTA);
    elipse(ctx, cx, cy + r * 0.3, r * 0.34, r * 0.24, '#fff4e6');
  });
  olho(ctx, cx - r * 0.26, cy - r * 0.14, r * 0.13, '#2b8a3a');
  olho(ctx, cx + r * 0.26, cy - r * 0.14, r * 0.13, '#2b8a3a');
  elipse(ctx, cx, cy + r * 0.18, r * 0.08, r * 0.05, '#ff6b8a');
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Bichos', 'vaca', 'Vaquinha', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#f8f8fb');
  dentro(ctx, cx, cy, r, () => {
    elipse(ctx, cx - r * 0.66, cy - r * 0.5, r * 0.32, r * 0.24, TINTA, 0.4);
    elipse(ctx, cx + r * 0.72, cy + r * 0.1, r * 0.26, r * 0.36, TINTA, -0.3);
    elipse(ctx, cx, cy + r * 0.48, r * 0.52, r * 0.3, '#ffb3c6');
  });
  pontinho(ctx, cx - r * 0.24, cy - r * 0.14, r * 0.09);
  pontinho(ctx, cx + r * 0.24, cy - r * 0.14, r * 0.09);
  elipse(ctx, cx - r * 0.16, cy + r * 0.48, r * 0.06, r * 0.08, '#c4567a');
  elipse(ctx, cx + r * 0.16, cy + r * 0.48, r * 0.06, r * 0.08, '#c4567a');
  contorno(ctx, cx, cy, r, '#8a8fb0');
});
m('Bichos', 'pintinho', 'Pintinho', carinha('#ffe14d', (ctx, cx, cy, r) => {
  pontinho(ctx, cx - r * 0.24, cy - r * 0.1, r * 0.09);
  pontinho(ctx, cx + r * 0.24, cy - r * 0.1, r * 0.09);
  poli(ctx, [[cx - r * 0.13, cy + r * 0.06], [cx + r * 0.13, cy + r * 0.06], [cx, cy + r * 0.26]], '#ff8a1e');
  traco(ctx, [[cx - r * 0.06, cy - r * 0.7], [cx + r * 0.02, cy - r * 0.52], [cx + r * 0.1, cy - r * 0.72]], '#c79a00', r * 0.05);
  bochechas(ctx, cx, cy, r, 'rgba(255,120,80,0.45)', 0.46, 0.14);
}));

m('Bichos', 'peixe', 'Peixinho', (ctx, cx, cy, r) => {
  const cor = '#4fc3ff';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    poli(ctx, [[cx + r * 0.5, cy], [cx + r, cy - r * 0.4], [cx + r, cy + r * 0.4]], '#ff9a3c');
    for (let i = 0; i < 3; i++) arco(ctx, cx + r * (0.02 + i * 0.16), cy, r * 0.36, -0.9, 0.9, escuro(cor, 0.2), r * 0.04);
    elipse(ctx, cx - r * 0.1, cy + r * 0.62, r * 0.6, r * 0.24, claro(cor, 0.45));
  });
  olho(ctx, cx - r * 0.36, cy - r * 0.14, r * 0.17);
  elipse(ctx, cx - r * 0.66, cy + r * 0.16, r * 0.07, r * 0.09, TINTA);
  circ(ctx, cx + r * 0.1, cy - r * 0.5, r * 0.06, 'rgba(255,255,255,0.8)');
  circ(ctx, cx + r * 0.24, cy - r * 0.62, r * 0.04, 'rgba(255,255,255,0.8)');
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Bichos', 'unicornio', 'Unicórnio', (ctx, cx, cy, r) => {
  const cor = '#fbf4ff';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    const crina = ['#ff7ac0', '#b55cff', '#4fc3ff'];
    crina.forEach((c, i) => circ(ctx, cx + r * (0.74 - i * 0.02), cy - r * 0.62 + i * r * 0.36, r * 0.26, c));
    poli(ctx, [[cx - r * 0.18, cy - r * H], [cx + r * 0.18, cy - r * H], [cx, cy - r * 0.42]], '#ffcf3a');
    traco(ctx, [[cx - r * 0.1, cy - r * 0.72], [cx + r * 0.1, cy - r * 0.78]], '#e0a31a', r * 0.03);
    traco(ctx, [[cx - r * 0.06, cy - r * 0.58], [cx + r * 0.06, cy - r * 0.63]], '#e0a31a', r * 0.03);
  });
  olhoFechado(ctx, cx - r * 0.3, cy - r * 0.02, r * 0.13);
  olhoFechado(ctx, cx + r * 0.14, cy - r * 0.02, r * 0.13);
  sorriso(ctx, cx - r * 0.08, cy + r * 0.24, r * 0.12, TINTA, r * 0.05);
  bochechas(ctx, cx - r * 0.08, cy, r, 'rgba(255,120,190,0.55)', 0.4, 0.14);
  contorno(ctx, cx, cy, r, '#b49ad0');
});
m('Bichos', 'baleia', 'Baleia', (ctx, cx, cy, r) => {
  const cor = '#3f7fe0';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    elipse(ctx, cx, cy + r * 0.7, r * 0.9, r * 0.42, '#cfe6ff');
    for (let i = 0; i < 4; i++) traco(ctx, [[cx - r * 0.36 + i * r * 0.24, cy + r * 0.36], [cx - r * 0.36 + i * r * 0.24, cy + r * 0.6]], '#9cc4f2', r * 0.04);
  });
  traco(ctx, [[cx, cy - r * 0.62], [cx, cy - r * 0.8]], '#9fe2ff', r * 0.06);
  arco(ctx, cx - r * 0.12, cy - r * 0.8, r * 0.12, Math.PI * 1.1, Math.PI * 1.9, '#9fe2ff', r * 0.06);
  arco(ctx, cx + r * 0.12, cy - r * 0.8, r * 0.12, Math.PI * 1.1, Math.PI * 1.9, '#9fe2ff', r * 0.06);
  pontinho(ctx, cx - r * 0.3, cy - r * 0.08, r * 0.09);
  pontinho(ctx, cx + r * 0.3, cy - r * 0.08, r * 0.09);
  sorriso(ctx, cx, cy + r * 0.14, r * 0.22, TINTA, r * 0.06);
  bochechas(ctx, cx, cy, r, 'rgba(255,130,170,0.55)', 0.5, 0.1);
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});

// --- fantasia ----------------------------------------------------------------
m('Fantasia', 'fantasma', 'Fantasminha', (ctx, cx, cy, r) => {
  const cor = '#eef2ff';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    for (let i = 0; i < 5; i++) circ(ctx, cx + (i - 2) * r * 0.42, cy + r * 0.98, r * 0.2, '#c9d2f2');
  });
  elipse(ctx, cx - r * 0.24, cy - r * 0.12, r * 0.09, r * 0.15, TINTA);
  elipse(ctx, cx + r * 0.24, cy - r * 0.12, r * 0.09, r * 0.15, TINTA);
  elipse(ctx, cx, cy + r * 0.24, r * 0.09, r * 0.1, TINTA);
  bochechas(ctx, cx, cy, r, 'rgba(160,170,255,0.6)', 0.44, 0.12);
  contorno(ctx, cx, cy, r, '#9aa6d8');
});
m('Fantasia', 'alien', 'Alienígena', (ctx, cx, cy, r) => {
  const cor = '#7be04f';
  corpo(ctx, cx, cy, r, cor);
  luz(ctx, cx, cy, r, 0.12);
  elipse(ctx, cx - r * 0.3, cy - r * 0.08, r * 0.2, r * 0.13, TINTA, 0.5);
  elipse(ctx, cx + r * 0.3, cy - r * 0.08, r * 0.2, r * 0.13, TINTA, -0.5);
  circ(ctx, cx - r * 0.36, cy - r * 0.12, r * 0.05, '#ffffff');
  circ(ctx, cx + r * 0.24, cy - r * 0.12, r * 0.05, '#ffffff');
  traco(ctx, [[cx - r * 0.12, cy + r * 0.3], [cx + r * 0.12, cy + r * 0.3]], escuro(cor, 0.6), r * 0.06);
  circ(ctx, cx, cy - r * 0.62, r * 0.08, '#ff4fb8');
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Fantasia', 'ciclope', 'Ciclope', (ctx, cx, cy, r) => {
  const cor = '#6f6bff';
  corpo(ctx, cx, cy, r, cor);
  sombra(ctx, cx, cy, r, 0.12);
  olho(ctx, cx, cy - r * 0.14, r * 0.3, '#ff7a1a');
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - r * 0.36, cy + r * 0.24, r * 0.72, r * 0.2);
  ctx.fillStyle = TINTA;
  ctx.fill();
  ctx.restore();
  poli(ctx, [[cx - r * 0.24, cy + r * 0.24], [cx - r * 0.12, cy + r * 0.24], [cx - r * 0.18, cy + r * 0.36]], '#ffffff');
  poli(ctx, [[cx + r * 0.12, cy + r * 0.24], [cx + r * 0.24, cy + r * 0.24], [cx + r * 0.18, cy + r * 0.36]], '#ffffff');
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Fantasia', 'robo', 'Robô', (ctx, cx, cy, r) => {
  const cor = '#9aa6bf';
  corpo(ctx, cx, cy, r, cor);
  sombra(ctx, cx, cy, r, 0.12);
  ctx.fillStyle = '#1b2236';
  ctx.beginPath();
  ctx.roundRect(cx - r * 0.5, cy - r * 0.34, r * 1, r * 0.56, r * 0.12);
  ctx.fill();
  ctx.fillStyle = '#4fe3ff';
  ctx.fillRect(cx - r * 0.32, cy - r * 0.16, r * 0.18, r * 0.14);
  ctx.fillRect(cx + r * 0.14, cy - r * 0.16, r * 0.18, r * 0.14);
  traco(ctx, [[cx - r * 0.16, cy + r * 0.08], [cx + r * 0.16, cy + r * 0.08]], '#4fe3ff', r * 0.05);
  for (const [x, y] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) circ(ctx, cx + r * x, cy + r * y, r * 0.06, escuro(cor, 0.35));
  traco(ctx, [[cx, cy - r * H + r * 0.04], [cx, cy - r * 0.42]], escuro(cor, 0.4), r * 0.05);
  contorno(ctx, cx, cy, r, escuro(cor, 0.5));
});
m('Fantasia', 'ninja', 'Ninja', (ctx, cx, cy, r) => {
  const cor = '#2a2d40';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    ctx.fillStyle = '#ffd2b0';
    ctx.fillRect(cx - r, cy - r * 0.28, r * 2, r * 0.32);
    ctx.fillStyle = '#e8333b';
    ctx.fillRect(cx - r, cy - r * 0.52, r * 2, r * 0.12);
    poli(ctx, [[cx + r * 0.62, cy - r * 0.46], [cx + r, cy - r * 0.62], [cx + r, cy - r * 0.3]], '#e8333b');
  });
  traco(ctx, [[cx - r * 0.38, cy - r * 0.2], [cx - r * 0.14, cy - r * 0.14]], TINTA, r * 0.05);
  traco(ctx, [[cx + r * 0.38, cy - r * 0.2], [cx + r * 0.14, cy - r * 0.14]], TINTA, r * 0.05);
  pontinho(ctx, cx - r * 0.24, cy - r * 0.08, r * 0.07);
  pontinho(ctx, cx + r * 0.24, cy - r * 0.08, r * 0.07);
  contorno(ctx, cx, cy, r, claro(cor, 0.3));
});
m('Fantasia', 'pirata', 'Pirata', (ctx, cx, cy, r) => {
  const cor = '#ffcfa6';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    ctx.fillStyle = '#d62f3a';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 0.56);
    for (let i = 0; i < 6; i++) circ(ctx, cx - r * 0.75 + i * r * 0.3, cy - r * 0.62, r * 0.05, '#ffffff');
  });
  pontinho(ctx, cx - r * 0.26, cy - r * 0.08, r * 0.09);
  circ(ctx, cx + r * 0.26, cy - r * 0.08, r * 0.15, TINTA);
  traco(ctx, [[cx + r * 0.08, cy - r * 0.2], [cx + r * 0.62, cy - r * 0.4]], TINTA, r * 0.04);
  traco(ctx, [[cx + r * 0.42, cy + r * 0.0], [cx + r * 0.64, cy + r * 0.2]], TINTA, r * 0.04);
  sorriso(ctx, cx, cy + r * 0.3, r * 0.22, TINTA, r * 0.06);
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Fantasia', 'dentucinho', 'Monstrinho', (ctx, cx, cy, r) => {
  const cor = '#ff6fb5';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    for (let i = 0; i < 7; i++) circ(ctx, cx - r + i * r * 0.33, cy - r * 0.9, r * 0.14, escuro(cor, 0.12));
  });
  olho(ctx, cx - r * 0.3, cy - r * 0.12, r * 0.14);
  olho(ctx, cx + r * 0.3, cy - r * 0.12, r * 0.14);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.42, cy + r * 0.14);
  ctx.quadraticCurveTo(cx, cy + r * 0.62, cx + r * 0.42, cy + r * 0.14);
  ctx.closePath();
  ctx.fillStyle = TINTA;
  ctx.fill();
  ctx.clip();
  for (let i = 0; i < 4; i++) poli(ctx, [[cx - r * 0.36 + i * r * 0.2, cy + r * 0.14], [cx - r * 0.24 + i * r * 0.2, cy + r * 0.14], [cx - r * 0.3 + i * r * 0.2, cy + r * 0.27]], '#ffffff');
  ctx.restore();
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Fantasia', 'caveirinha', 'Caveirinha', (ctx, cx, cy, r) => {
  const cor = '#f2f0ea';
  corpo(ctx, cx, cy, r, '#3a2a55');
  elipse(ctx, cx, cy - r * 0.1, r * 0.52, r * 0.46, cor);
  ctx.fillStyle = cor;
  ctx.fillRect(cx - r * 0.28, cy + r * 0.2, r * 0.56, r * 0.28);
  elipse(ctx, cx - r * 0.2, cy - r * 0.1, r * 0.13, r * 0.15, '#3a2a55');
  elipse(ctx, cx + r * 0.2, cy - r * 0.1, r * 0.13, r * 0.15, '#3a2a55');
  poli(ctx, [[cx - r * 0.05, cy + r * 0.14], [cx + r * 0.05, cy + r * 0.14], [cx, cy + r * 0.06]], '#3a2a55');
  for (let i = 0; i < 3; i++) traco(ctx, [[cx - r * 0.12 + i * r * 0.12, cy + r * 0.3], [cx - r * 0.12 + i * r * 0.12, cy + r * 0.46]], '#3a2a55', r * 0.03);
  circ(ctx, cx - r * 0.2, cy - r * 0.12, r * 0.05, '#ff5fa2');
  circ(ctx, cx + r * 0.2, cy - r * 0.12, r * 0.05, '#ff5fa2');
  contorno(ctx, cx, cy, r, '#7c6aa8');
});

// --- comidas -----------------------------------------------------------------
m('Comidas', 'donut', 'Donut', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#e3a35c');
  dentro(ctx, cx, cy, r, () => {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * TAU;
      const rr = r * (0.72 + (i % 2 ? 0.06 : -0.02));
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr * 0.92;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.fillStyle = '#ff7ac0';
    ctx.fill();
    const cores = ['#ffffff', '#4fd1ff', '#ffe14d', '#7dff6a'];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + 0.3;
      const rr = r * (i % 2 ? 0.5 : 0.36);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      traco(ctx, [[x - r * 0.04, y - r * 0.02], [x + r * 0.04, y + r * 0.02]], cores[i % 4], r * 0.05);
    }
  });
  circ(ctx, cx, cy, r * 0.2, '#3a2a55');
  contorno(ctx, cx, cy, r, '#9a5a20');
});
m('Comidas', 'melancia', 'Melancia', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#2f9e44');
  corpo(ctx, cx, cy, r * 0.84, '#e9fbd8');
  corpo(ctx, cx, cy, r * 0.76, '#ff4d63');
  for (const [x, y] of [[-0.3, -0.24], [0.1, -0.34], [0.36, -0.06], [-0.1, 0.06], [-0.38, 0.22], [0.2, 0.28], [0.0, -0.08]]) elipse(ctx, cx + r * x, cy + r * y, r * 0.04, r * 0.065, TINTA, 0.3);
  contorno(ctx, cx, cy, r, '#1b6a2a');
});
m('Comidas', 'laranja', 'Laranja', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#ff8a1e');
  corpo(ctx, cx, cy, r * 0.84, '#fff1d6');
  corpo(ctx, cx, cy, r * 0.78, '#ffb238');
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    traco(ctx, [[cx, cy], [cx + Math.cos(a) * r * 0.74, cy - Math.sin(a) * r * 0.74]], '#fff1d6', r * 0.05);
  }
  circ(ctx, cx, cy, r * 0.08, '#fff1d6');
  contorno(ctx, cx, cy, r, '#a8520a');
});
m('Comidas', 'kiwi', 'Kiwi', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#8a6a3a');
  corpo(ctx, cx, cy, r * 0.86, '#8fd14a');
  corpo(ctx, cx, cy, r * 0.32, '#f2ffd8');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    elipse(ctx, cx + Math.cos(a) * r * 0.46, cy + Math.sin(a) * r * 0.46, r * 0.035, r * 0.06, TINTA, a + Math.PI / 2);
  }
  contorno(ctx, cx, cy, r, '#5a4220');
});
m('Comidas', 'pizza', 'Pizza', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#d98b3a');
  corpo(ctx, cx, cy, r * 0.82, '#ffd24a');
  dentro(ctx, cx, cy, r * 0.82, () => {
    for (const [x, y] of [[-0.34, -0.3], [0.3, -0.36], [0.42, 0.18], [-0.1, 0.06], [-0.4, 0.3], [0.1, 0.42]]) {
      circ(ctx, cx + r * x, cy + r * y, r * 0.13, '#d63a2f');
      circ(ctx, cx + r * x - r * 0.04, cy + r * y - r * 0.04, r * 0.03, '#ff7a6a');
    }
    for (const [x, y] of [[0.0, -0.42], [-0.5, -0.02], [0.24, -0.06]]) elipse(ctx, cx + r * x, cy + r * y, r * 0.07, r * 0.04, '#3fa34d', 0.6);
  });
  contorno(ctx, cx, cy, r, '#8a4a12');
});
m('Comidas', 'biscoito', 'Biscoito', (ctx, cx, cy, r) => {
  const cor = '#e0a865';
  corpo(ctx, cx, cy, r, cor);
  luz(ctx, cx, cy, r, 0.1);
  for (const [x, y, s] of [[-0.36, -0.28, 0.12], [0.22, -0.4, 0.1], [0.44, 0.04, 0.12], [-0.06, 0.0, 0.11], [-0.46, 0.26, 0.1], [0.16, 0.36, 0.12], [-0.12, 0.5, 0.08]]) {
    poli(ctx, [[cx + r * (x - s), cy + r * y], [cx + r * x, cy + r * (y - s * 0.9)], [cx + r * (x + s), cy + r * (y + s * 0.2)], [cx + r * x, cy + r * (y + s)]], '#5a3218');
  }
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Comidas', 'morango', 'Morango', (ctx, cx, cy, r) => {
  const cor = '#ff3b55';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    for (let i = 0; i < 5; i++) poli(ctx, [[cx, cy - r * 0.62], [cx + Math.cos(Math.PI * (1 + i / 4)) * r * 0.6, cy - r * 0.62 + Math.sin(Math.PI * (1 + i / 4)) * r * 0.3 + r * 0.04], [cx + Math.cos(Math.PI * (1.1 + i / 4)) * r * 0.3, cy - r * 0.95]], '#3fbf5a');
    for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
      const x = cx + (col - 2 + (row % 2) * 0.5) * r * 0.32;
      const y = cy - r * 0.18 + row * r * 0.24;
      elipse(ctx, x, y, r * 0.03, r * 0.05, '#ffe36a');
    }
  });
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Comidas', 'queijo', 'Queijo', (ctx, cx, cy, r) => {
  const cor = '#ffcf3a';
  corpo(ctx, cx, cy, r, cor);
  sombra(ctx, cx, cy, r, 0.08);
  dentro(ctx, cx, cy, r, () => {
    for (const [x, y, s] of [[-0.42, -0.36, 0.16], [0.3, -0.42, 0.11], [0.5, 0.1, 0.18], [-0.06, 0.02, 0.13], [-0.5, 0.32, 0.12], [0.18, 0.5, 0.1], [-0.2, -0.62, 0.08]]) {
      circ(ctx, cx + r * x, cy + r * y, r * s, '#e0a31a');
      circ(ctx, cx + r * x + r * s * 0.2, cy + r * y + r * s * 0.2, r * s * 0.7, '#c9890e');
    }
  });
  contorno(ctx, cx, cy, r, '#a87410');
});
m('Comidas', 'ovo', 'Ovo frito', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#f7f9ff');
  circ(ctx, cx + r * 0.06, cy + r * 0.04, r * 0.36, '#ffb21e');
  circ(ctx, cx - r * 0.06, cy - r * 0.08, r * 0.09, '#ffe8a8');
  contorno(ctx, cx, cy, r, '#b6bdd8');
});
m('Comidas', 'sorvete', 'Sorvete', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#e8b46a');
  dentro(ctx, cx, cy, r, () => {
    ctx.strokeStyle = '#b8803a';
    ctx.lineWidth = r * 0.05;
    for (let i = -4; i <= 4; i++) {
      traco(ctx, [[cx + i * r * 0.3 - r, cy + r], [cx + i * r * 0.3 + r, cy - r]], '#c98f45', r * 0.05);
      traco(ctx, [[cx + i * r * 0.3 - r, cy - r], [cx + i * r * 0.3 + r, cy + r]], '#c98f45', r * 0.05);
    }
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r);
    ctx.lineTo(cx + r, cy - r);
    ctx.lineTo(cx + r, cy + r * 0.05);
    for (let i = 0; i <= 8; i++) {
      const x = cx + r - (i * r * 2) / 8;
      const y = cy + r * 0.05 + (i % 2 ? r * 0.18 : 0);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#ff8fc4';
    ctx.fill();
    circ(ctx, cx + r * 0.12, cy - r * 0.62, r * 0.12, '#e8333b');
  });
  pontinho(ctx, cx - r * 0.22, cy - r * 0.26, r * 0.07);
  pontinho(ctx, cx + r * 0.22, cy - r * 0.26, r * 0.07);
  sorriso(ctx, cx, cy - r * 0.08, r * 0.08, TINTA, r * 0.04);
  contorno(ctx, cx, cy, r, '#9a5f22');
});

m('Comidas', 'hamburguer', 'Hambúrguer', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#e8a24a');
  dentro(ctx, cx, cy, r, () => {
    ctx.fillStyle = '#6ad14a';
    ctx.fillRect(cx - r, cy - r * 0.06, r * 2, r * 0.14);
    ctx.fillStyle = '#ffcf3a';
    ctx.fillRect(cx - r, cy + r * 0.08, r * 2, r * 0.12);
    ctx.fillStyle = '#6a3a1a';
    ctx.fillRect(cx - r, cy + r * 0.2, r * 2, r * 0.24);
    ctx.fillStyle = '#d98b3a';
    ctx.fillRect(cx - r, cy + r * 0.44, r * 2, r);
    for (const [x, y] of [[-0.4, -0.52], [-0.1, -0.66], [0.22, -0.5], [0.46, -0.64], [0.0, -0.36], [-0.5, -0.3]]) elipse(ctx, cx + r * x, cy + r * y, r * 0.05, r * 0.03, '#fff3d0', 0.4);
  });
  contorno(ctx, cx, cy, r, '#8a4a12');
});
m('Comidas', 'limao', 'Limão', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#6ac23a');
  corpo(ctx, cx, cy, r * 0.84, '#f4ffe0');
  corpo(ctx, cx, cy, r * 0.78, '#c4f05a');
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    traco(ctx, [[cx, cy], [cx + Math.cos(a) * r * 0.74, cy - Math.sin(a) * r * 0.74]], '#f4ffe0', r * 0.05);
  }
  circ(ctx, cx, cy, r * 0.08, '#f4ffe0');
  contorno(ctx, cx, cy, r, '#3a7a1a');
});

// --- objetos -----------------------------------------------------------------
m('Objetos', 'futebol', 'Bola de futebol', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#f6f7fb');
  const pent = (x, y, s, giro) => {
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = giro + (i * TAU) / 5 - Math.PI / 2;
      pts.push([x + Math.cos(a) * s, y + Math.sin(a) * s]);
    }
    poli(ctx, pts, TINTA);
  };
  dentro(ctx, cx, cy, r, () => {
    pent(cx, cy, r * 0.24, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i * TAU) / 5 - Math.PI / 2;
      traco(ctx, [[cx + Math.cos(a) * r * 0.24, cy + Math.sin(a) * r * 0.24], [cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62]], TINTA, r * 0.04);
      pent(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86, r * 0.2, Math.PI);
    }
  });
  contorno(ctx, cx, cy, r, '#7c84a6');
});
m('Objetos', 'basquete', 'Bola de basquete', (ctx, cx, cy, r) => {
  const cor = '#ff7a1a';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    traco(ctx, [[cx - r, cy], [cx + r, cy]], TINTA, r * 0.06);
    traco(ctx, [[cx, cy - r], [cx, cy + r]], TINTA, r * 0.06);
    arco(ctx, cx - r * 1.05, cy, r * 0.7, -Math.PI / 2, Math.PI / 2, TINTA, r * 0.06);
    arco(ctx, cx + r * 1.05, cy, r * 0.7, Math.PI / 2, Math.PI * 1.5, TINTA, r * 0.06);
  });
  contorno(ctx, cx, cy, r, escuro(cor, 0.5));
});
m('Objetos', 'dado', 'Dado', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#fbfbff');
  sombra(ctx, cx, cy, r, 0.06);
  for (const [x, y] of [[-0.36, -0.36], [0.36, -0.36], [0, 0], [-0.36, 0.36], [0.36, 0.36]]) circ(ctx, cx + r * x, cy + r * y * 0.9, r * 0.11, '#e8333b');
  contorno(ctx, cx, cy, r, '#9aa1c2');
});
m('Objetos', 'presente', 'Presente', (ctx, cx, cy, r) => {
  const cor = '#e8333b';
  corpo(ctx, cx, cy, r, cor);
  dentro(ctx, cx, cy, r, () => {
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(cx - r * 0.12, cy - r, r * 0.24, r * 2);
    ctx.fillRect(cx - r, cy - r * 0.12, r * 2, r * 0.24);
  });
  elipse(ctx, cx - r * 0.2, cy - r * 0.5, r * 0.2, r * 0.12, '#ffd84a', 0.5);
  elipse(ctx, cx + r * 0.2, cy - r * 0.5, r * 0.2, r * 0.12, '#ffd84a', -0.5);
  circ(ctx, cx, cy - r * 0.44, r * 0.08, '#e0a31a');
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Objetos', 'alvo', 'Alvo', (ctx, cx, cy, r) => {
  const cores = ['#e8333b', '#ffffff', '#e8333b', '#ffffff', '#e8333b'];
  cores.forEach((c, i) => corpo(ctx, cx, cy, r * (1 - i * 0.19), c));
  contorno(ctx, cx, cy, r, '#8a1828');
});
m('Objetos', 'relogio', 'Relógio', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#4f8bff');
  corpo(ctx, cx, cy, r * 0.8, '#fbfbff');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const r0 = i % 3 ? r * 0.58 : r * 0.5;
    traco(ctx, [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r * 0.64, cy + Math.sin(a) * r * 0.64]], TINTA, r * 0.04);
  }
  traco(ctx, [[cx, cy], [cx, cy - r * 0.42]], TINTA, r * 0.07);
  traco(ctx, [[cx, cy], [cx + r * 0.3, cy + r * 0.1]], '#e8333b', r * 0.05);
  circ(ctx, cx, cy, r * 0.06, TINTA);
  contorno(ctx, cx, cy, r, '#22489e');
});
m('Objetos', 'planeta', 'Planeta', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#2b1d5a');
  dentro(ctx, cx, cy, r, () => {
    for (const [x, y] of [[-0.7, -0.5], [0.6, -0.6], [0.75, 0.45], [-0.6, 0.6]]) estrela(ctx, cx + r * x, cy + r * y, r * 0.07, r * 0.03, '#fff3c4', 4, 0);
    elipse(ctx, cx, cy, r * 0.88, r * 0.22, '#ffd27a', -0.35);
    circ(ctx, cx, cy, r * 0.42, '#ff8a4a');
    dentro(ctx, cx, cy, r * 2, () => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.42, 0, TAU);
      ctx.clip();
      ctx.fillStyle = '#ff6a3a';
      ctx.fillRect(cx - r, cy + r * 0.08, r * 2, r * 0.12);
      ctx.fillRect(cx - r, cy - r * 0.2, r * 2, r * 0.08);
    });
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - r, cy, r * 2, r);
    ctx.clip();
    elipse(ctx, cx, cy, r * 0.88, r * 0.22, 'rgba(0,0,0,0)', -0.35);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.88, r * 0.22, -0.35, 0, Math.PI);
    ctx.ellipse(cx, cy, r * 0.62, r * 0.12, -0.35, Math.PI, 0, true);
    ctx.fillStyle = '#ffd27a';
    ctx.fill();
    ctx.restore();
  });
  contorno(ctx, cx, cy, r, '#6a5aa8');
});
m('Objetos', 'lua', 'Noite de lua', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#1d2b6e');
  dentro(ctx, cx, cy, r, () => {
    circ(ctx, cx - r * 0.06, cy, r * 0.46, '#ffe36a');
    circ(ctx, cx + r * 0.16, cy - r * 0.12, r * 0.4, '#1d2b6e');
    for (const [x, y, s] of [[0.48, 0.36, 0.08], [0.52, -0.42, 0.06], [-0.6, -0.5, 0.05], [0.2, 0.6, 0.05]]) estrela(ctx, cx + r * x, cy + r * y, r * s, r * s * 0.42, '#fff3c4');
  });
  contorno(ctx, cx, cy, r, '#5a6ad8');
});
m('Objetos', 'coracao', 'Coração', (ctx, cx, cy, r) => {
  const cor = '#ff8fc4';
  corpo(ctx, cx, cy, r, cor);
  luz(ctx, cx, cy, r, 0.14);
  coracao(ctx, cx, cy + r * 0.04, r * 0.46, '#e8234a');
  elipse(ctx, cx - r * 0.22, cy - r * 0.14, r * 0.08, r * 0.05, 'rgba(255,255,255,0.7)', -0.6);
  contorno(ctx, cx, cy, r, escuro(cor, 0.45));
});
m('Objetos', 'raio', 'Raio', (ctx, cx, cy, r) => {
  const cor = '#2a2d52';
  corpo(ctx, cx, cy, r, cor);
  poli(ctx, [[cx + r * 0.12, cy - r * 0.74], [cx - r * 0.36, cy + r * 0.08], [cx - r * 0.02, cy + r * 0.08], [cx - r * 0.14, cy + r * 0.74], [cx + r * 0.36, cy - r * 0.1], [cx + r * 0.02, cy - r * 0.1]], '#ffd84a');
  contorno(ctx, cx, cy, r, claro(cor, 0.35));
});
m('Objetos', 'diamante', 'Diamante', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#1a3a8a');
  const t = cy - r * 0.42;
  const m0 = cy - r * 0.12;
  const b = cy + r * 0.6;
  poli(ctx, [[cx - r * 0.56, m0], [cx - r * 0.3, t], [cx + r * 0.3, t], [cx + r * 0.56, m0], [cx, b]], '#7fd8ff');
  poli(ctx, [[cx - r * 0.3, t], [cx, m0], [cx - r * 0.56, m0]], '#b8ecff');
  poli(ctx, [[cx + r * 0.3, t], [cx, m0], [cx - r * 0.3, t]], '#e6f8ff');
  poli(ctx, [[cx + r * 0.3, t], [cx + r * 0.56, m0], [cx, m0]], '#9fe2ff');
  poli(ctx, [[cx, m0], [cx + r * 0.56, m0], [cx, b]], '#4fb8f0');
  contorno(ctx, cx, cy, r, '#6a8ae8');
});
m('Objetos', 'bussola', 'Bússola', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#c9963a');
  corpo(ctx, cx, cy, r * 0.8, '#fff6e0');
  poli(ctx, [[cx, cy - r * 0.6], [cx + r * 0.12, cy], [cx - r * 0.12, cy]], '#e8333b');
  poli(ctx, [[cx, cy + r * 0.6], [cx + r * 0.12, cy], [cx - r * 0.12, cy]], '#3a3f5a');
  circ(ctx, cx, cy, r * 0.06, '#c9963a');
  contorno(ctx, cx, cy, r, '#7a5412');
});
m('Objetos', 'bomba-fofa', 'Bombinha', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#2c2f45');
  luz(ctx, cx, cy, r, 0.1);
  dentro(ctx, cx, cy, r, () => {
    ctx.fillStyle = '#4a4f6e';
    ctx.fillRect(cx - r * 0.14, cy - r * H, r * 0.28, r * 0.2);
  });
  olho(ctx, cx - r * 0.24, cy - r * 0.02, r * 0.15);
  olho(ctx, cx + r * 0.24, cy - r * 0.02, r * 0.15);
  sorriso(ctx, cx, cy + r * 0.3, r * 0.14, '#ffffff', r * 0.06);
  contorno(ctx, cx, cy, r, '#6a6f98');
  // Pavio e faisca dentro da silhueta: nada pode sair dela, senao o jogador
  // ve a peca maior do que o corpo fisico.
  traco(ctx, [[cx, cy - r * 0.66], [cx + r * 0.1, cy - r * 0.72], [cx + r * 0.22, cy - r * 0.66]], '#c9963a', r * 0.07);
  estrela(ctx, cx + r * 0.3, cy - r * 0.66, r * 0.15, r * 0.065, '#ffb21e', 6);
  estrela(ctx, cx + r * 0.3, cy - r * 0.66, r * 0.075, r * 0.032, '#fff3a0', 6);
});

m('Objetos', 'coroa', 'Coroa', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#5a2a9a');
  const y0 = cy + r * 0.34;
  poli(ctx, [[cx - r * 0.56, y0], [cx - r * 0.56, cy - r * 0.34], [cx - r * 0.28, cy - r * 0.06], [cx, cy - r * 0.5], [cx + r * 0.28, cy - r * 0.06], [cx + r * 0.56, cy - r * 0.34], [cx + r * 0.56, y0]], '#ffcf3a');
  ctx.fillStyle = '#e0a31a';
  ctx.fillRect(cx - r * 0.56, y0 - r * 0.16, r * 1.12, r * 0.16);
  circ(ctx, cx, cy - r * 0.5, r * 0.07, '#ff4d63');
  circ(ctx, cx - r * 0.56, cy - r * 0.34, r * 0.06, '#4fc3ff');
  circ(ctx, cx + r * 0.56, cy - r * 0.34, r * 0.06, '#4fc3ff');
  circ(ctx, cx, y0 - r * 0.08, r * 0.06, '#ff4d63');
  contorno(ctx, cx, cy, r, '#9a6ae0');
});
m('Objetos', 'foguete', 'Foguete', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#1d2b6e');
  dentro(ctx, cx, cy, r, () => {
    for (const [x, y] of [[-0.62, -0.42], [0.6, -0.2], [-0.5, 0.5], [0.66, 0.46]]) estrela(ctx, cx + r * x, cy + r * y, r * 0.06, r * 0.025, '#fff3c4', 4, 0);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 5);
    const chama = [[-r * 0.1, r * 0.4], [r * 0.1, r * 0.4], [0, r * 0.78]];
    poli(ctx, chama.map(([x, y]) => [x, y]), '#ff7a1a');
    poli(ctx, [[-r * 0.05, r * 0.4], [r * 0.05, r * 0.4], [0, r * 0.6]], '#ffe14d');
    poli(ctx, [[-r * 0.2, r * 0.14], [-r * 0.34, r * 0.44], [-r * 0.12, r * 0.4]], '#e8333b');
    poli(ctx, [[r * 0.2, r * 0.14], [r * 0.34, r * 0.44], [r * 0.12, r * 0.4]], '#e8333b');
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.66);
    ctx.quadraticCurveTo(r * 0.28, -r * 0.3, r * 0.2, r * 0.42);
    ctx.lineTo(-r * 0.2, r * 0.42);
    ctx.quadraticCurveTo(-r * 0.28, -r * 0.3, 0, -r * 0.66);
    ctx.fillStyle = '#f2f4fb';
    ctx.fill();
    poli(ctx, [[0, -r * 0.66], [r * 0.14, -r * 0.4], [-r * 0.14, -r * 0.4]], '#e8333b');
    circ(ctx, 0, -r * 0.08, r * 0.1, '#4fc3ff');
    ctx.restore();
  });
  contorno(ctx, cx, cy, r, '#5a6ad8');
});
m('Objetos', 'controle', 'Controle', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#ff5f7a');
  ctx.fillStyle = '#2c2f45';
  ctx.beginPath();
  ctx.roundRect(cx - r * 0.66, cy - r * 0.3, r * 1.32, r * 0.6, r * 0.28);
  ctx.fill();
  ctx.fillStyle = '#f2f4fb';
  ctx.fillRect(cx - r * 0.46, cy - r * 0.04, r * 0.3, r * 0.09);
  ctx.fillRect(cx - r * 0.355, cy - r * 0.15, r * 0.09, r * 0.3);
  circ(ctx, cx + r * 0.3, cy - r * 0.08, r * 0.07, '#ffd84a');
  circ(ctx, cx + r * 0.44, cy + r * 0.06, r * 0.07, '#4fc3ff');
  contorno(ctx, cx, cy, r, escuro('#ff5f7a', 0.45));
});

// --- natureza ----------------------------------------------------------------
m('Natureza', 'fogo', 'Fogo', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#c4241a');
  const chama = (s, cor) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.8 * s);
    ctx.bezierCurveTo(cx + r * 0.6 * s, cy - r * 0.2 * s, cx + r * 0.62 * s, cy + r * 0.6 * s, cx, cy + r * 0.66 * s);
    ctx.bezierCurveTo(cx - r * 0.62 * s, cy + r * 0.6 * s, cx - r * 0.6 * s, cy - r * 0.1 * s, cx, cy - r * 0.8 * s);
    ctx.fillStyle = cor;
    ctx.fill();
  };
  chama(1, '#ff7a1a');
  chama(0.68, '#ffb21e');
  chama(0.38, '#fff3a0');
  contorno(ctx, cx, cy, r, '#7a1008');
});
m('Natureza', 'neve', 'Floco de neve', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#6ab8ff');
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const x1 = cx + Math.cos(a) * r * 0.66;
    const y1 = cy + Math.sin(a) * r * 0.66;
    traco(ctx, [[cx, cy], [x1, y1]], '#ffffff', r * 0.07);
    const xm = cx + Math.cos(a) * r * 0.42;
    const ym = cy + Math.sin(a) * r * 0.42;
    traco(ctx, [[xm, ym], [xm + Math.cos(a + 0.8) * r * 0.16, ym + Math.sin(a + 0.8) * r * 0.16]], '#ffffff', r * 0.05);
    traco(ctx, [[xm, ym], [xm + Math.cos(a - 0.8) * r * 0.16, ym + Math.sin(a - 0.8) * r * 0.16]], '#ffffff', r * 0.05);
  }
  circ(ctx, cx, cy, r * 0.1, '#ffffff');
  contorno(ctx, cx, cy, r, '#2f6bc4');
});
m('Natureza', 'flor', 'Flor', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#7fd86a');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    elipse(ctx, cx + Math.cos(a) * r * 0.36, cy + Math.sin(a) * r * 0.36, r * 0.26, r * 0.17, '#ff8fc4', a);
  }
  circ(ctx, cx, cy, r * 0.2, '#ffd84a');
  contorno(ctx, cx, cy, r, '#3a8a2a');
});
m('Natureza', 'folha', 'Folha', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#ffe9b0');
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.56, cy + r * 0.5);
  ctx.quadraticCurveTo(cx - r * 0.6, cy - r * 0.5, cx + r * 0.56, cy - r * 0.56);
  ctx.quadraticCurveTo(cx + r * 0.5, cy + r * 0.5, cx - r * 0.56, cy + r * 0.5);
  ctx.fillStyle = '#3fbf5a';
  ctx.fill();
  traco(ctx, [[cx - r * 0.5, cy + r * 0.44], [cx + r * 0.46, cy - r * 0.48]], '#1f7a32', r * 0.05);
  for (let i = 1; i <= 3; i++) {
    const x = cx - r * 0.5 + i * r * 0.24;
    const y = cy + r * 0.44 - i * r * 0.23;
    traco(ctx, [[x, y], [x - r * 0.16, y - r * 0.12]], '#1f7a32', r * 0.035);
    traco(ctx, [[x, y], [x + r * 0.12, y + r * 0.14]], '#1f7a32', r * 0.035);
  }
  contorno(ctx, cx, cy, r, '#b8964a');
});
m('Natureza', 'sol', 'Sol', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#4fb3ff');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    poli(ctx, [[cx + Math.cos(a - 0.12) * r * 0.42, cy + Math.sin(a - 0.12) * r * 0.42], [cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7], [cx + Math.cos(a + 0.12) * r * 0.42, cy + Math.sin(a + 0.12) * r * 0.42]], '#ffb21e');
  }
  circ(ctx, cx, cy, r * 0.42, '#ffd84a');
  pontinho(ctx, cx - r * 0.14, cy - r * 0.06, r * 0.06);
  pontinho(ctx, cx + r * 0.14, cy - r * 0.06, r * 0.06);
  sorriso(ctx, cx, cy + r * 0.12, r * 0.12, TINTA, r * 0.05);
  contorno(ctx, cx, cy, r, '#1f6ac4');
});
m('Natureza', 'arco-iris', 'Arco-íris', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#bfe9ff');
  dentro(ctx, cx, cy, r, () => {
    const cores = ['#ff4d63', '#ff9a3c', '#ffd84a', '#5ad15a', '#4f8bff', '#8b5cff'];
    cores.forEach((c, i) => arco(ctx, cx, cy + r * 0.62, r * (0.98 - i * 0.12), Math.PI, TAU, c, r * 0.12));
    elipse(ctx, cx - r * 0.56, cy + r * 0.56, r * 0.3, r * 0.16, '#ffffff');
    elipse(ctx, cx + r * 0.56, cy + r * 0.56, r * 0.3, r * 0.16, '#ffffff');
  });
  contorno(ctx, cx, cy, r, '#5aa0d0');
});
m('Natureza', 'onda', 'Onda', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#bff0ff');
  dentro(ctx, cx, cy, r, () => {
    const faixa = (y0, cor) => {
      ctx.beginPath();
      ctx.moveTo(cx - r, cy + r);
      ctx.lineTo(cx - r, y0);
      for (let i = 0; i <= 16; i++) {
        const x = cx - r + (i * r * 2) / 16;
        ctx.lineTo(x, y0 + Math.sin(i * 0.9) * r * 0.08);
      }
      ctx.lineTo(cx + r, cy + r);
      ctx.closePath();
      ctx.fillStyle = cor;
      ctx.fill();
    };
    faixa(cy - r * 0.2, '#4fc3ff');
    faixa(cy + r * 0.12, '#1f8ae0');
    faixa(cy + r * 0.44, '#155fb0');
  });
  contorno(ctx, cx, cy, r, '#1a5aa0');
});
m('Natureza', 'cacto', 'Cacto', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#ffe2b0');
  const cor = '#3fae5a';
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.roundRect(cx - r * 0.14, cy - r * 0.66, r * 0.28, r * 1.2, r * 0.14);
  ctx.roundRect(cx - r * 0.5, cy - r * 0.3, r * 0.2, r * 0.44, r * 0.1);
  ctx.roundRect(cx + r * 0.3, cy - r * 0.44, r * 0.2, r * 0.44, r * 0.1);
  ctx.fill();
  ctx.fillRect(cx - r * 0.4, cy, r * 0.3, r * 0.14);
  ctx.fillRect(cx + r * 0.1, cy - r * 0.14, r * 0.3, r * 0.14);
  dentro(ctx, cx, cy, r, () => {
    ctx.fillStyle = '#d9773a';
    ctx.fillRect(cx - r, cy + r * 0.54, r * 2, r);
  });
  circ(ctx, cx, cy - r * 0.68, r * 0.08, '#ff5fa2');
  contorno(ctx, cx, cy, r, '#b8864a');
});

// --- padroes -----------------------------------------------------------------
m('Padrões', 'bengala', 'Bengala doce', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#ffffff');
  dentro(ctx, cx, cy, r, () => {
    for (let i = -6; i <= 6; i++) poli(ctx, [[cx + i * r * 0.34 - r, cy + r], [cx + i * r * 0.34 - r + r * 0.17, cy + r], [cx + i * r * 0.34 + r + r * 0.17, cy - r], [cx + i * r * 0.34 + r, cy - r]], '#e8333b');
  });
  contorno(ctx, cx, cy, r, '#a01a2a');
});
m('Padrões', 'zigue', 'Ziguezague', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#2fd3c0');
  dentro(ctx, cx, cy, r, () => {
    for (let row = -3; row <= 3; row++) {
      const pts = [];
      for (let i = 0; i <= 10; i++) pts.push([cx - r + (i * r * 2) / 10, cy + row * r * 0.34 + (i % 2 ? r * 0.12 : -r * 0.04)]);
      traco(ctx, pts, row % 2 ? '#ffffff' : '#118a7a', r * 0.09);
    }
  });
  contorno(ctx, cx, cy, r, '#0b6a5c');
});
m('Padrões', 'xadrez-pb', 'Xadrez de corrida', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#ffffff');
  dentro(ctx, cx, cy, r, () => {
    const s = r * 0.32;
    for (let i = -4; i < 4; i++) for (let j = -4; j < 4; j++) if ((i + j) % 2 === 0) {
      ctx.fillStyle = TINTA;
      ctx.fillRect(cx + i * s, cy + j * s, s, s);
    }
  });
  contorno(ctx, cx, cy, r, '#5a5f80');
});
m('Padrões', 'poa', 'Poá', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#2b3a8f');
  dentro(ctx, cx, cy, r, () => {
    const s = r * 0.36;
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) circ(ctx, cx + i * s + (j % 2 ? s / 2 : 0), cy + j * s * 0.86, r * 0.08, '#ffffff');
  });
  contorno(ctx, cx, cy, r, '#7a8ae0');
});
m('Padrões', 'mosaico', 'Mosaico', (ctx, cx, cy, r) => {
  const cores = ['#ff4d63', '#ffd84a', '#4f8bff', '#5ad15a', '#ff9a3c', '#8b5cff'];
  for (let i = 0; i < 6; i++) {
    const a0 = (Math.PI / 3) * i;
    const a1 = (Math.PI / 3) * (i + 1);
    poli(ctx, [[cx, cy], [cx + r * Math.cos(a0), cy - r * Math.sin(a0)], [cx + r * Math.cos(a1), cy - r * Math.sin(a1)]], cores[i]);
  }
  corpo(ctx, cx, cy, r * 0.34, '#ffffff');
  contorno(ctx, cx, cy, r, TINTA);
});
m('Padrões', 'espiral', 'Hipnose', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#ffffff');
  dentro(ctx, cx, cy, r, () => {
    ctx.beginPath();
    for (let t = 0; t < 7 * Math.PI; t += 0.05) {
      const rr = (t / (7 * Math.PI)) * r * 1.05;
      const x = cx + Math.cos(t) * rr;
      const y = cy + Math.sin(t) * rr;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#8b5cff';
    ctx.lineWidth = r * 0.12;
    ctx.stroke();
  });
  contorno(ctx, cx, cy, r, '#4a22b0');
});
m('Padrões', 'camuflagem', 'Camuflagem', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#7a8a3a');
  dentro(ctx, cx, cy, r, () => {
    for (const [x, y, s, c, rot] of [[-0.5, -0.4, 0.32, '#4a5a22', 0.4], [0.4, -0.5, 0.28, '#a8a060', -0.3], [0.1, 0.0, 0.3, '#3a3a1a', 0.9], [-0.4, 0.4, 0.3, '#a8a060', 0.2], [0.5, 0.36, 0.3, '#4a5a22', -0.6], [-0.1, -0.7, 0.2, '#3a3a1a', 0]]) elipse(ctx, cx + r * x, cy + r * y, r * s, r * s * 0.62, c, rot);
  });
  contorno(ctx, cx, cy, r, '#3a4214');
});
m('Padrões', 'tijolos', 'Tijolinhos', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#f2e6d0');
  dentro(ctx, cx, cy, r, () => {
    const h = r * 0.3;
    for (let row = -4; row <= 4; row++) {
      const off = row % 2 ? r * 0.3 : 0;
      for (let i = -4; i <= 4; i++) {
        ctx.fillStyle = (i + row) % 3 ? '#d9653a' : '#c4502a';
        ctx.fillRect(cx + i * r * 0.6 + off - r * 0.27, cy + row * h - h / 2 + 1, r * 0.54, h - 2);
      }
    }
  });
  contorno(ctx, cx, cy, r, '#8a3418');
});
m('Padrões', 'favo', 'Favo de mel', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#ffb21e');
  dentro(ctx, cx, cy, r, () => {
    const s = r * 0.2;
    for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
      const x = cx + i * s * 1.5;
      const y = cy + j * s * H * 2 + (i % 2 ? s * H : 0);
      hexPath(ctx, x, y, s * 0.86);
      ctx.fillStyle = (i * 7 + j * 3) % 5 === 0 ? '#ffd84a' : '#f29a0e';
      ctx.fill();
    }
  });
  contorno(ctx, cx, cy, r, '#a85a0a');
});
m('Padrões', 'pixel-sorriso', 'Pixel sorriso', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#3fcf8a');
  const grade = ['..x..x..', '..x..x..', '........', '.x....x.', '..xxxx..'];
  const s = r * 0.16;
  grade.forEach((linha, j) => [...linha].forEach((c, i) => {
    if (c !== 'x') return;
    ctx.fillStyle = TINTA;
    ctx.fillRect(cx + (i - 4) * s, cy + (j - 2.5) * s, s, s);
  }));
  contorno(ctx, cx, cy, r, '#1b7a4a');
});
m('Padrões', 'joia-dupla', 'Joia dois tons', (ctx, cx, cy, r) => {
  const a = '#ff4fa2';
  const b = '#7a3cff';
  for (let i = 0; i < 6; i++) {
    const a0 = (Math.PI / 3) * i;
    const a1 = (Math.PI / 3) * (i + 1);
    poli(ctx, [[cx, cy], [cx + r * Math.cos(a0), cy - r * Math.sin(a0)], [cx + r * Math.cos(a1), cy - r * Math.sin(a1)]], i % 2 ? a : b);
  }
  hexPath(ctx, cx, cy, r * 0.46);
  ctx.fillStyle = claro(a, 0.35);
  ctx.fill();
  contorno(ctx, cx, cy, r, escuro(b, 0.4));
});
m('Padrões', 'listras-retro', 'Listras retrô', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#fff1d6');
  dentro(ctx, cx, cy, r, () => {
    const cores = ['#ff6a3a', '#ffb21e', '#2fd3c0', '#2b3a8f'];
    cores.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(cx - r, cy - r * 0.1 + i * r * 0.22, r * 2, r * 0.18);
    });
  });
  circ(ctx, cx, cy - r * 0.4, r * 0.22, '#ffb21e');
  contorno(ctx, cx, cy, r, '#7a3a1a');
});
m('Padrões', 'galaxia', 'Galáxia', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#2a1050');
  dentro(ctx, cx, cy, r, () => {
    elipse(ctx, cx, cy, r * 0.8, r * 0.3, '#5a2a9a', -0.5);
    elipse(ctx, cx, cy, r * 0.5, r * 0.18, '#8a4ae0', -0.5);
    circ(ctx, cx, cy, r * 0.12, '#ffe6ff');
    for (const [x, y, s] of [[-0.6, -0.4, 0.07], [0.5, 0.5, 0.06], [0.6, -0.5, 0.05], [-0.4, 0.6, 0.05], [0.1, -0.68, 0.04], [-0.75, 0.1, 0.04]]) estrela(ctx, cx + r * x, cy + r * y, r * s, r * s * 0.4, '#ffffff', 4, 0);
  });
  contorno(ctx, cx, cy, r, '#7a4ac8');
});
m('Padrões', 'bandeirinha', 'Festa junina', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#2b3a8f');
  const cores = ['#ff4d63', '#ffd84a', '#5ad15a', '#4fc3ff', '#ff9a3c'];
  dentro(ctx, cx, cy, r, () => {
    for (const [y0, off] of [[-0.42, 0], [0.12, 0.5]]) {
      traco(ctx, [[cx - r, cy + r * y0], [cx + r, cy + r * y0]], '#ffffff', r * 0.03);
      for (let i = -1; i < 6; i++) {
        const x = cx - r * 0.8 + (i + off) * r * 0.34;
        poli(ctx, [[x, cy + r * y0], [x + r * 0.26, cy + r * y0], [x + r * 0.13, cy + r * (y0 + 0.3)]], cores[(i + 5 + (off ? 2 : 0)) % 5]);
      }
    }
  });
  contorno(ctx, cx, cy, r, '#7a8ae0');
});
m('Padrões', 'confete', 'Confete', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#fff6e8');
  dentro(ctx, cx, cy, r, () => {
    const cores = ['#ff4d63', '#ffb21e', '#2fd3c0', '#4f8bff', '#b55cff', '#5ad15a'];
    let k = 7;
    for (let i = 0; i < 26; i++) {
      k = (k * 37 + 11) % 101;
      const x = cx + ((k % 19) / 9 - 1) * r * 0.95;
      k = (k * 37 + 11) % 101;
      const y = cy + ((k % 17) / 8 - 1) * r * 0.85;
      const c = cores[i % cores.length];
      if (i % 3 === 0) circ(ctx, x, y, r * 0.07, c);
      else {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(k);
        ctx.fillStyle = c;
        ctx.fillRect(-r * 0.09, -r * 0.035, r * 0.18, r * 0.07);
        ctx.restore();
      }
    }
  });
  contorno(ctx, cx, cy, r, '#c9a87a');
});
m('Padrões', 'escoces', 'Xadrez escocês', (ctx, cx, cy, r) => {
  corpo(ctx, cx, cy, r, '#c4242f');
  dentro(ctx, cx, cy, r, () => {
    for (let i = -3; i <= 3; i++) {
      ctx.fillStyle = 'rgba(20,24,60,0.42)';
      ctx.fillRect(cx + i * r * 0.5 - r * 0.12, cy - r, r * 0.24, r * 2);
      ctx.fillRect(cx - r, cy + i * r * 0.5 - r * 0.12, r * 2, r * 0.24);
      ctx.fillStyle = 'rgba(255,214,90,0.8)';
      ctx.fillRect(cx + i * r * 0.5 + r * 0.2, cy - r, r * 0.035, r * 2);
      ctx.fillRect(cx - r, cy + i * r * 0.5 + r * 0.2, r * 2, r * 0.035);
    }
  });
  contorno(ctx, cx, cy, r, '#6a0f18');
});

// ----------------------------------------------------------------- vitrine ---

const CHAVE = 'galeria-hexagonos-escolhidos';
/** @returns {Set<string>} */
function lerEscolhidos() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE) || '[]'));
  } catch {
    return new Set();
  }
}
const escolhidos = lerEscolhidos();
function gravar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify([...escolhidos]));
  } catch {
    /* sem armazenamento: a selecao vive so nesta aba */
  }
}

/** Ceu de um tema num retangulo. */
function ceu(/** @type {Ctx} */ ctx, temaId, x, y, w, h) {
  const th = THEMES[temaId];
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  th.sky.forEach((c, i) => g.addColorStop(i / Math.max(1, th.sky.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/**
 * Todo modelo desenha recortado pela silhueta: o que escapasse dela faria a
 * peca parecer maior que o corpo fisico. No jogo o pintor fara o mesmo.
 */
function desenha(/** @type {Ctx} */ ctx, modelo, cx, cy, r) {
  dentro(ctx, cx, cy, r, () => modelo.f(ctx, cx, cy, r));
}

const W = 360;
const ALT = 150;

/** @param {*} modelo */
function cartao(modelo) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.grupo = modelo.grupo;
  const cv = document.createElement('canvas');
  cv.width = W * DPR;
  cv.height = ALT * DPR;
  const ctx = /** @type {Ctx} */ (cv.getContext('2d'));
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // Metade escura (ceu do mundo 1) e metade clara (classico): o hexagono tem
  // que ler nos dois. Em cada uma: grande, tamanho de fase e tamanho do HUD.
  [['puzzle', 0], ['classic', W / 2]].forEach(([tema, x0]) => {
    ceu(ctx, tema, x0, 0, W / 2, ALT);
    desenha(ctx, modelo, x0 + 72, 75, 52);
    desenha(ctx, modelo, x0 + 150, 52, 22);
    desenha(ctx, modelo, x0 + 150, 108, 10);
  });
  card.appendChild(cv);
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `<span class="marca"></span><b></b><code></code>`;
  meta.querySelector('b').textContent = modelo.nome;
  meta.querySelector('code').textContent = modelo.id;
  card.appendChild(meta);
  if (escolhidos.has(modelo.id)) card.classList.add('escolhido');
  card.addEventListener('click', () => {
    if (escolhidos.has(modelo.id)) escolhidos.delete(modelo.id);
    else escolhidos.add(modelo.id);
    card.classList.toggle('escolhido', escolhidos.has(modelo.id));
    gravar();
    contar();
  });
  return card;
}

function contar() {
  const n = escolhidos.size;
  document.getElementById('contagem').textContent = `${n} escolhido${n === 1 ? '' : 's'} de ${MODELOS.length}`;
}

function montar() {
  const host = document.getElementById('galeria');
  const grupos = [...new Set(MODELOS.map((x) => x.grupo))];
  for (const g of grupos) {
    const h = document.createElement('h2');
    h.textContent = `${g} (${MODELOS.filter((x) => x.grupo === g).length})`;
    h.dataset.grupo = g;
    host.appendChild(h);
    const grade = document.createElement('div');
    grade.className = 'grade';
    grade.dataset.grupo = g;
    for (const mo of MODELOS.filter((x) => x.grupo === g)) grade.appendChild(cartao(mo));
    host.appendChild(grade);
  }
  // Filtro por grupo, e "escolhidos" para revisar a selecao.
  const nav = document.getElementById('grupos');
  const filtros = ['Todos', ...grupos, 'Escolhidos'];
  for (const f of filtros) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = f;
    if (f === 'Todos') b.classList.add('on');
    b.addEventListener('click', () => {
      nav.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      host.querySelectorAll('h2, .grade').forEach((el) => {
        const g = /** @type {HTMLElement} */ (el).dataset.grupo;
        /** @type {HTMLElement} */ (el).hidden = !(f === 'Todos' || f === 'Escolhidos' || f === g);
      });
      host.querySelectorAll('.card').forEach((c) => {
        /** @type {HTMLElement} */ (c).hidden = f === 'Escolhidos' && !c.classList.contains('escolhido');
      });
    });
    nav.appendChild(b);
  }
  contar();
  document.getElementById('copiar').addEventListener('click', async () => {
    const lista = MODELOS.filter((x) => escolhidos.has(x.id)).map((x) => `${x.id} (${x.nome})`).join('\n');
    const aviso = document.getElementById('aviso');
    try {
      await navigator.clipboard.writeText(lista || '(nenhum)');
      aviso.textContent = 'Copiado. É só colar na conversa.';
    } catch {
      aviso.textContent = lista || '(nenhum)';
    }
  });
  document.getElementById('limpar').addEventListener('click', () => {
    escolhidos.clear();
    gravar();
    document.querySelectorAll('.card.escolhido').forEach((c) => c.classList.remove('escolhido'));
    contar();
  });
}

montar();
