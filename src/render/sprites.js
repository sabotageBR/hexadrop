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
import { hashSeed } from '../core/rng.js';
import { roundRect } from './draw2d.js';
import { paintHexModel } from './hexmodels.js';

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

/** @param {string} color @returns {number[]} */
function parseRgb(color) {
  if (color.startsWith('rgb')) {
    const m = color.match(/[\d.]+/g);
    if (!m || m.length < 3) return [255, 255, 255];
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  }
  const h = color.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

/** @param {number[]} rgb @param {number} [a] */
function rgbStr(rgb, a) {
  if (a === undefined || a >= 1) return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

/**
 * Faixas de perigo da TNT, preenchidas.
 *
 * Traco fino sobre o brilho do puzzle sumia e virava ruído. Faixa cheia
 * preta sobre laranja e o sinal de "isto explode se cair" - o mesmo em
 * qualquer tema, independente da cor do traco.
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
  const passo = scale * 0.5;
  const band = scale * 0.24;
  const extra = scale * 2;
  ctx.fillStyle = 'rgba(24, 10, 6, 0.88)';
  for (let x = -h - w; x < w + h + extra; x += passo) {
    ctx.beginPath();
    ctx.moveTo(ox + x, oy + extra);
    ctx.lineTo(ox + x + band, oy + extra);
    ctx.lineTo(ox + x + band + h + extra, oy - h - extra);
    ctx.lineTo(ox + x + h + extra, oy - h - extra);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Estrela de faísca da bomba.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} r
 */
function paintSpark(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.36;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Bomba de desenho animado: esfera preta, brilho de plastico, pavio e faisca.
 *
 * A marca de antes era um circulo de 0,4 celula com um anel laranja em volta.
 * No tamanho em que a peca aparece de verdade o anel fechava a leitura: virava
 * uma rosquinha escura, e no escuro nao dava para separar a bomba da obsidiana,
 * que tambem e preta. Agora a esfera ocupa quase a celula inteira, tem contorno
 * proprio e um brilho grande no alto - e o corpo da peca e vinho, nao preto
 * neutro: obsidiana e fria, bomba e quente.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {[number, number][]} cells
 * @param {number} scale
 * @param {number} ox
 * @param {number} oy
 */
function paintBombMark(ctx, cells, scale, ox, oy) {
  // A bomba inteira - esfera, pavio e faisca - cabe dentro de UMA celula, a
  // mais proxima do centro da peca. Desenhada no centro geometrico e grande o
  // bastante para o pavio passar da silhueta, ela ficava certa so quando a
  // peca era a do topo: em qualquer outra a vizinha de cima cobria o pavio e
  // sobrava uma bola preta sem nada.
  let sx = 0;
  let sy = 0;
  for (const [cx, cy] of cells) {
    sx += cx + 0.5;
    sy += cy + 0.5;
  }
  const n = cells.length || 1;
  const mx = sx / n;
  const my = sy / n;
  let alvo = cells[0];
  let perto = Infinity;
  for (const c of cells) {
    const d = (c[0] + 0.5 - mx) ** 2 + (c[1] + 0.5 - my) ** 2;
    if (d < perto) {
      perto = d;
      alvo = c;
    }
  }
  const r = scale * 0.355;
  const bx = ox + (alvo[0] + 0.5) * scale;
  // A composicao e mais alta para cima (pavio) do que para baixo (sombra):
  // descer a esfera um pouco centraliza o conjunto na celula.
  const by = oy - (alvo[1] + 0.5) * scale + r * 0.31;

  ctx.save();

  // Sombra de contato: sem ela a esfera flutua sobre o corpo da peca.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.beginPath();
  ctx.ellipse(bx, by + r * 0.84, r * 0.8, r * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(bx - r * 0.34, by - r * 0.4, r * 0.06, bx, by, r * 1.05);
  body.addColorStop(0, '#5e5e70');
  body.addColorStop(0.42, '#1e1e2a');
  body.addColorStop(1, '#07070d');
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  // Luz quente rasante na quina de baixo. Da volume sem clarear a silhueta,
  // que e o que faz a esfera preta aparecer tambem nos temas escuros.
  ctx.save();
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.clip();
  const rim = ctx.createRadialGradient(
    bx + r * 0.52, by + r * 0.58, r * 0.08,
    bx + r * 0.3, by + r * 0.34, r * 1.1,
  );
  rim.addColorStop(0, 'rgba(255, 122, 50, 0.55)');
  rim.addColorStop(1, 'rgba(255, 122, 50, 0)');
  ctx.fillStyle = rim;
  ctx.fillRect(bx - r, by - r, r * 2, r * 2);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#08060c';
  ctx.lineWidth = Math.max(2, scale * 0.065);
  ctx.stroke();

  // O brilho e o que le como "bola", e nao como buraco.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.ellipse(bx - r * 0.33, by - r * 0.37, r * 0.32, r * 0.17, -0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.arc(bx - r * 0.06, by - r * 0.62, r * 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Boca de lata, em trapezio: reta em cima ela parecia um selo colado.
  const capW = r * 0.66;
  const capH = r * 0.32;
  const capY = by - r * 0.9;
  ctx.beginPath();
  ctx.moveTo(bx - capW / 2, capY);
  ctx.lineTo(bx + capW / 2, capY);
  ctx.lineTo(bx + capW * 0.34, capY - capH);
  ctx.lineTo(bx - capW * 0.34, capY - capH);
  ctx.closePath();
  ctx.fillStyle = '#8a6a44';
  ctx.fill();
  ctx.strokeStyle = '#26190e';
  ctx.lineWidth = Math.max(1.4, scale * 0.04);
  ctx.stroke();

  // Pavio: corda escura por baixo, fio claro por cima - so o fio claro sumia
  // contra o ceu dos mundos claros.
  const fx = bx + r * 0.8;
  const fy = by - r * 1.28;
  const fx0 = bx;
  const fy0 = capY - capH * 0.8;
  const traca = () => {
    ctx.beginPath();
    ctx.moveTo(fx0, fy0);
    ctx.quadraticCurveTo(bx + r * 0.16, by - r * 1.24, fx, fy);
  };
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#2e2014';
  ctx.lineWidth = Math.max(2.6, scale * 0.085);
  traca();
  ctx.stroke();
  ctx.strokeStyle = '#e0b46a';
  ctx.lineWidth = Math.max(1.3, scale * 0.042);
  traca();
  ctx.stroke();

  ctx.fillStyle = '#ffdc3c';
  ctx.shadowColor = '#ff6a2a';
  ctx.shadowBlur = scale * 0.2;
  paintSpark(ctx, fx, fy, r * 0.42);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff8d8';
  paintSpark(ctx, fx, fy, r * 0.18);
  ctx.restore();
}

/**
 * Medidas do tubo de neon, em fracao de celula, como saíram da foto.
 *
 * Exportadas porque o realce de dica e de peca sob o ponteiro (`renderer.js`)
 * tem que usar exatamente a mesma geometria: desenhado na silhueta crua, com a
 * quina do tema, ele virava uma moldura solta em volta da peca.
 */
export const TUBO = { raio: 0.11, vao: 0.055, fio: 0.047, faixa: 0.028 };

/**
 * O tema desenha as pecas como tubo de neon?
 * @param {import('./themes.js').Theme} th
 */
export function usaTubo(th) {
  if (th.pecas) return th.pecas === 'glow';
  return th.style === 'puzzle' || th.style === 'neon';
}

/** Cores da marca, sem o azul da pedra. */
const PUZZLE_BLOCK_COLORS = [
  '#ff4eb6',
  '#2dd0ff',
  '#7ce83a',
  '#ffd220',
  '#ff8218',
  '#9b48ff',
  '#ff528c',
];

/**
 * A peca sai nas cores da marca? Vale para a base do mundo puzzle - o bloco, e
 * desde que o mundo 1 passou a ser de borracha, a borracha. Sem a borracha aqui
 * a torre do mundo 1 sairia inteira no verde-limao do traco dela, e o arco-iris
 * que veio do jogo de referencia sumiria justo na primeira fase.
 * @param {import('./themes.js').Theme} th
 * @param {string} materialId
 */
function arcoIris(th, materialId) {
  return th.style === 'puzzle' && (materialId === 'block' || materialId === 'rubber');
}

/** Indice da cor da marca para uma peca do mundo puzzle. */
function colorIndex(gridX, gridY) {
  return ((gridX * 5 + gridY * 13) >>> 0) % PUZZLE_BLOCK_COLORS.length;
}

/**
 * Cor viva da peca: no mundo puzzle a base sorteia uma das cores da marca pela
 * posicao de origem; nos outros mundos e o traco do material no tema.
 *
 * Exportada porque as particulas de quebra precisam sair na cor da peca que
 * quebrou - lendo do material, uma peca verde estourava rosa.
 *
 * @param {import('./themes.js').Theme} th
 * @param {string} materialId
 * @param {number} [gridX]
 * @param {number} [gridY]
 * @returns {string}
 */
export function pieceColor(th, materialId, gridX = 0, gridY = 0) {
  if (arcoIris(th, materialId)) {
    return PUZZLE_BLOCK_COLORS[colorIndex(gridX, gridY)];
  }
  const style = th.materials[materialId] || th.materials.block || th.materials.wood;
  return style.stroke;
}

/**
 * Cor do realce da peca sob o ponteiro nos mundos de tubo: a propria cor da
 * peca, acesa. Pintar o realce na cor de destaque do tema fazia toda peca
 * virar magenta ao passar o mouse, e a torre perdia o arco-iris justamente no
 * momento em que o jogador esta escolhendo qual quebrar.
 *
 * @param {import('./themes.js').Theme} th
 * @param {string} materialId
 * @param {number} [gridX]
 * @param {number} [gridY]
 */
export function pieceHighlight(th, materialId, gridX = 0, gridY = 0) {
  return lighten(pieceColor(th, materialId, gridX, gridY), 0.55);
}

function mixHex(hex, other, t) {
  const a = parseRgb(hex);
  const b = parseRgb(other);
  return rgbStr([
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]);
}
const darken = (hex, t = 0.4) => mixHex(hex, '#000000', t);
const lighten = (hex, t = 0.4) => mixHex(hex, '#ffffff', t);

/** Luminancia percebida, 0 a 255. */
function lum(color) {
  const [r, g, b] = parseRgb(color);
  return r * 0.299 + g * 0.587 + b * 0.114;
}

/**
 * Cor do contorno de uma peca: a PROPRIA peca, um passo adiante.
 *
 * O contorno era tinta quase preta cravada nos tres estilos de toon. Numa
 * paleta viva isso passa; num cenario de pouco contraste, como o papel e o
 * rustico, a torre virava uma grade preta com cor dentro - e a peca que nao se
 * move, a obsidiana, que ja e escura, era um borrao preto com moldura preta em
 * volta. Tirando a cor do proprio corpo o contorno continua separando peca de
 * peca, sem ser a primeira coisa que se ve.
 *
 * O lado para onde andar depende do corpo: peca clara escurece, peca ja escura
 * CLAREIA. Sem essa inversao a obsidiana nao teria contorno nenhum.
 * @param {string} fill
 * @returns {string}
 */
function contorno(fill) {
  return lum(fill) < 96 ? lighten(fill, 0.34) : darken(fill, 0.46);
}

function sil(ctx, cells, scale, ox, oy, r) {
  tracePiece(ctx, outlineLoops(cells), scale, r, ox, oy);
}

/**
 * Qual dos 4 looks aprovados esta peca usa.
 * No mundo puzzle o bloco cicla os quatro para todos aparecerem ja nas fases iniciais.
 * @param {import('./themes.js').Theme} th
 * @param {string} materialId
 * @param {number} colorIx
 */
function lookFor(th, materialId, colorIx) {
  // Um tema pode pedir um estilo so para todas as pecas (`pecas` em themes.js).
  if (th.pecas) return th.pecas;
  // O mundo neon usa o tubo (o puzzle tambem usava, ate a 1.0.5 - hoje ele
  // pede gelatina por `pecas`); os outros ficam no toon.
  if (th.style === 'puzzle' || th.style === 'neon') return 'glow';
  void colorIx;
  if (
    materialId === 'ice' ||
    materialId === 'glass' ||
    materialId === 'crystal' ||
    materialId === 'wax' ||
    materialId === 'foam'
  ) {
    return 'gelatina';
  }
  if (materialId === 'stone') return 'toon-cel';
  // A borracha e gomosa: o mesmo corpo da gelatina, opaco pela cor. O metal vai
  // no toon HQ - o filete branco por dentro do traco e o que le como chapa.
  if (materialId === 'rubber') return 'gelatina';
  if (materialId === 'metal' || materialId === 'obsidian') return 'toon-hq';
  return 'toon';
}

function paintToon(ctx, cells, fill, scale, ox, oy, traco) {
  const r = scale * 0.14;
  const b = bounds(cells);
  sil(ctx, cells, scale, ox, oy, r);
  ctx.fillStyle = fill;
  ctx.fill('evenodd');
  ctx.save();
  sil(ctx, cells, scale, ox, oy, r);
  ctx.clip('evenodd');
  ctx.fillStyle = darken(fill, 0.28);
  ctx.fillRect(ox, oy - b.h * scale * 0.48, b.w * scale, b.h * scale);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(ox + scale * 0.18, oy - b.h * scale + scale * 0.16);
  ctx.lineTo(ox + scale * 0.46, oy - b.h * scale + scale * 0.16);
  ctx.lineTo(ox + scale * 0.18, oy - b.h * scale + scale * 0.42);
  ctx.fill();
  ctx.restore();
  sil(ctx, cells, scale, ox, oy, r);
  ctx.strokeStyle = contorno(fill);
  ctx.lineWidth = Math.max(1.1, scale * 0.046) * traco;
  ctx.stroke();
}

function paintToonHq(ctx, cells, fill, scale, ox, oy, traco) {
  const r = scale * 0.12;
  const b = bounds(cells);
  sil(ctx, cells, scale, ox, oy, r);
  ctx.fillStyle = fill;
  ctx.fill('evenodd');
  ctx.save();
  sil(ctx, cells, scale, ox, oy, r);
  ctx.clip('evenodd');
  ctx.fillStyle = darken(fill, 0.34);
  ctx.fillRect(ox, oy - b.h * scale * 0.5, b.w * scale, b.h * scale);
  ctx.restore();
  // O filete claro do metal vinha ANTES do contorno, na mesma linha de centro
  // e com menos da metade da largura: o contorno o cobria inteiro e o estilo
  // era so um toon de tinta mais grossa. Aqui os dois vao por dentro do
  // recorte, do mais largo para o mais estreito - um traco de largura 2L cobre
  // L para dentro -, entao sobra mesmo um fio claro logo depois da tinta.
  const linha = Math.max(1.1, scale * 0.044) * traco;
  const filete = Math.max(0.7, scale * 0.026) * traco;
  ctx.save();
  sil(ctx, cells, scale, ox, oy, r);
  ctx.clip('evenodd');
  sil(ctx, cells, scale, ox, oy, r);
  ctx.strokeStyle = lighten(fill, 0.5);
  ctx.lineWidth = 2 * (linha + filete);
  ctx.stroke();
  sil(ctx, cells, scale, ox, oy, r);
  ctx.strokeStyle = contorno(fill);
  ctx.lineWidth = 2 * linha;
  ctx.stroke();
  ctx.restore();
}

function paintToonCel(ctx, cells, fill, scale, ox, oy, traco) {
  const r = scale * 0.12;
  const b = bounds(cells);
  const h = b.h * scale;
  sil(ctx, cells, scale, ox, oy, r);
  ctx.fillStyle = fill;
  ctx.fill('evenodd');
  ctx.save();
  sil(ctx, cells, scale, ox, oy, r);
  ctx.clip('evenodd');
  ctx.fillStyle = lighten(fill, 0.22);
  ctx.fillRect(ox, oy - h, b.w * scale, h * 0.34);
  ctx.fillStyle = darken(fill, 0.32);
  ctx.fillRect(ox, oy - h * 0.38, b.w * scale, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(ox + scale * 0.16, oy - h + scale * 0.14, scale * 0.22, scale * 0.1);
  ctx.restore();
  sil(ctx, cells, scale, ox, oy, r);
  ctx.strokeStyle = contorno(fill);
  ctx.lineWidth = Math.max(1, scale * 0.042) * traco;
  ctx.stroke();
}

function paintGelatina(ctx, cells, fill, scale, ox, oy) {
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
  roundRect(
    ctx,
    ox + scale * 0.16,
    oy - b.h * scale + scale * 0.12,
    b.w * scale - scale * 0.32,
    b.h * scale * 0.42,
    r * 0.7,
  );
  ctx.fillStyle = lighten(fill, 0.45);
  ctx.globalAlpha = 0.55;
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(
    ox + b.w * scale * 0.35,
    oy - b.h * scale + scale * 0.28,
    scale * 0.28,
    scale * 0.12,
    -0.4,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
  sil(ctx, cells, scale, ox, oy, r);
  ctx.strokeStyle = darken(fill, 0.25);
  ctx.lineWidth = Math.max(2, scale * 0.07);
  ctx.stroke();
}

/**
 * Peca de neon: fio duro, faixa escura por dentro e miolo translucido.
 *
 * A estrutura saiu de medir a foto do jogo de referencia pixel a pixel - nao e
 * borda dupla, como parecia: e um fio vivo, uma faixa escura fina logo por
 * dentro dele e um VAO de fundo entre uma peca e a vizinha (a "segunda linha"
 * era a borda da peca de baixo). As medidas, em fracao de celula:
 *
 *   0    .. 0,055  vao, fundo puro          (as pecas nao se encostam)
 *   0,055.. 0,102  fio vivo, cor cheia
 *   0,102.. 0,130  faixa da cor a 27%       (e ela que destaca o fio)
 *   dai para dentro                          miolo: 19% da cor sobre 50% do fundo
 *
 * A referencia ainda tem um halo por fora e um brilho difuso para dentro. Os
 * dois sairam a pedido do Evandro: na tela grande o borrao comia a quina e a
 * peca perdia a forma. Fica so o desenho duro, que e o que da leitura.
 *
 * Tudo sai de tracos concentricos dentro do recorte: um traco de largura L
 * cobre de 0 a L/2 para dentro, entao pintar do mais largo para o mais estreito
 * empilha as faixas na ordem certa, e um traco em `destination-out` no fim abre
 * o vao. Deslocar o caminho para conseguir as faixas nao funciona num polimino:
 * em quina reentrante o deslocamento se cruza sozinho.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {[number,number][]} cells
 * @param {string} cor cor viva do fio
 * @param {number} scale
 * @param {number} ox
 * @param {number} oy
 */
function paintGlow(ctx, cells, cor, scale, ox, oy) {
  const raio = scale * TUBO.raio;
  const vao = Math.max(1.2, scale * TUBO.vao);
  const fio = Math.max(1.8, scale * TUBO.fio);
  const faixa = Math.max(1, scale * TUBO.faixa);
  const traco = (largura) => {
    sil(ctx, cells, scale, ox, oy, raio);
    ctx.lineWidth = largura;
    ctx.stroke();
  };

  ctx.save();
  sil(ctx, cells, scale, ox, oy, raio);
  ctx.clip('evenodd');
  ctx.lineJoin = 'miter';

  // Miolo: 19% da cor sobre 50% do fundo, entao a cena continua aparecendo
  // atraves da peca. Opaco demais e a torre vira um bloco de cor.
  sil(ctx, cells, scale, ox, oy, raio);
  ctx.fillStyle = withAlpha(mixHex(cor, '#000000', 0.61), 0.5);
  ctx.fill('evenodd');

  // Faixa, fio e vao - do mais largo para o mais estreito. A faixa nao e preta:
  // e a propria cor a 27%. Preta ela abria um sulco que nao existe na foto.
  ctx.strokeStyle = mixHex(cor, '#000000', 0.73);
  traco(2 * (vao + fio + faixa));
  ctx.strokeStyle = cor;
  traco(2 * (vao + fio));
  ctx.restore();

  // O vao vem por ultimo e FORA do recorte. Dentro dele, o apagador herda a
  // mesma borda serrilhada do recorte que acabou de pintar, e as duas meias
  // coberturas nao se cancelam: sobrava um fio de um pixel exatamente em cima
  // da silhueta - a "bordinha fina" em volta de toda peca.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.strokeStyle = '#000';
  ctx.lineJoin = 'miter';
  traco(2 * vao);
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} look
 * @param {[number,number][]} cells
 * @param {string} fill
 * @param {number} scale
 * @param {number} ox
 * @param {number} oy
 * @param {number} traco espessura do contorno, fracao do padrao
 */
function paintLook(ctx, look, cells, fill, scale, ox, oy, traco) {
  if (look === 'glow') paintGlow(ctx, cells, fill, scale, ox, oy);
  else if (look === 'toon-hq') paintToonHq(ctx, cells, fill, scale, ox, oy, traco);
  else if (look === 'toon-cel') paintToonCel(ctx, cells, fill, scale, ox, oy, traco);
  else if (look === 'gelatina') paintGelatina(ctx, cells, fill, scale, ox, oy);
  else paintToon(ctx, cells, fill, scale, ox, oy, traco);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./themes.js').Theme} th
 * @param {string} materialId
 * @param {[number,number][]} cells
 * @param {number} scale
 * @param {number} ox
 * @param {number} oy
 * @param {number} seed
 * @param {number} [colorIx]
 */
function paintPiece(ctx, th, materialId, cells, scale, ox, oy, seed, colorIx = 0) {
  const style = th.materials[materialId] || th.materials.block || th.materials.wood;
  let fill = style.fill;
  if (arcoIris(th, materialId)) {
    fill = PUZZLE_BLOCK_COLORS[colorIx % PUZZLE_BLOCK_COLORS.length];
  }
  if (materialId === 'bomb') fill = '#3a1622';
  if (materialId === 'tnt') fill = '#ff8a12';
  const look = lookFor(th, materialId, colorIx);
  // O contorno sai da cor da propria peca (`contorno`), e nao de uma tinta
  // preta cravada: era a linha que se via primeiro, nao a peca. `traco` deixa
  // um tema pedir mais ou menos que o padrao, e afina so a linha - a silhueta
  // nunca muda.
  const traco = th.traco ?? 1;
  void seed;
  if (look === 'glow') {
    // No tubo quem manda e a cor do fio, nao a do corpo.
    const linha = arcoIris(th, materialId)
      ? PUZZLE_BLOCK_COLORS[colorIx % PUZZLE_BLOCK_COLORS.length]
      : style.stroke;
    paintLook(ctx, look, cells, linha, scale, ox, oy, traco);
  } else {
    paintLook(ctx, look, cells, fill, scale, ox, oy, traco);
  }

  const b = bounds(cells);
  const radius = Math.max(1.5, scale * 0.14);
  if (materialId === 'tnt') {
    sil(ctx, cells, scale, ox, oy, radius);
    hazardStripes(ctx, style, ox, oy, b.w * scale, b.h * scale, scale);
    sil(ctx, cells, scale, ox, oy, radius);
    ctx.strokeStyle = '#5a2208';
    ctx.lineWidth = Math.max(1.2, scale * 0.04) * traco;
    ctx.stroke();
  }
  if (th.glow > 0.45 && look !== 'glow') {
    ctx.save();
    ctx.shadowColor = style.stroke;
    ctx.shadowBlur = scale * (0.16 + th.glow * 0.28);
    sil(ctx, cells, scale, ox, oy, radius);
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = Math.max(1.6, scale * 0.06);
    ctx.stroke();
    ctx.restore();
  }
  if (materialId === 'bomb') paintBombMark(ctx, cells, scale, ox, oy);
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
   * @param {number} [gridX]
   * @param {number} [gridY]
   * @returns {{canvas: HTMLCanvasElement, w:number, h:number, pad:number}}
   */
  piece(cells, materialId, gridX = 0, gridY = 0) {
    // No puzzle a base troca de cor da marca por peca. Sem posicao na
    // chave, todas as barras iguais pintavam a mesma magenta.
    const colorIx = arcoIris(this.theme, materialId) ? colorIndex(gridX, gridY) : 0;
    const look = lookFor(this.theme, materialId, colorIx);
    const key =
      cells.map((c) => c[0] + ',' + c[1]).join(';') +
      '|' +
      materialId +
      '|' +
      look +
      (colorIx ? '|c' + colorIx : '');
    const hit = this.map.get(key);
    if (hit) return hit;

    const th = this.theme;
    const scale = this.px * this.dpr;
    const b = bounds(cells);
    const pad = Math.ceil(scale * (0.32 + th.glow * 0.4 + (materialId === 'bomb' ? 0.12 : 0)));
    const cw = Math.ceil(b.w * scale + pad * 2);
    const ch = Math.ceil(b.h * scale + pad * 2);
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    paintPiece(ctx, th, materialId, cells, scale, pad, ch - pad, hashSeed(key), colorIx);

    const entry = { canvas, w: cw / this.dpr, h: ch / this.dpr, pad: pad / this.dpr };
    this.map.set(key, entry);
    return entry;
  }

  /**
   * Sprite do hexagono, com a skin aplicada.
   *
   * O desenho mora em `hexmodels.js`: a skin escolhe o MODELO (estilo de
   * construcao) alem da cor, e a vitrine da loja e a galeria de prototipo
   * chamam o mesmo pintor. A silhueta e a mesma em todos os modelos - e a
   * copia do poligono do corpo rigido em `physics/world.js` -, entao trocar
   * de modelo nunca muda onde a peca encaixa.
   *
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

    paintHexModel(
      ctx,
      cx,
      cy,
      r,
      skin.model || 'joia',
      {
        fill: skin.fill || th.hexagon.fill,
        stroke: skin.stroke || th.hexagon.stroke,
        core: skin.core || th.hexagon.core,
      },
      th.glow,
    );

    // A marca da skin e um carimbo por cima do modelo, nao parte dele: o anel
    // do Ouro e o circuito continuam valendo em qualquer construcao.
    if (skin.mark) skin.mark(ctx, cx, cy, r, th);

    const entry = { canvas, w: size / this.dpr, h: size / this.dpr, pad: pad / this.dpr };
    this.map.set(key, entry);
    return entry;
  }

  clear() {
    this.map.clear();
  }
}
