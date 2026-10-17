/**
 * Desenho das regras de fase (game/regras.js): o icone de cada uma (chip do
 * HUD e cartao de estreia), as marcas por cima da peca - joia e cadeado - e a
 * faixa dourada do pedestal.
 *
 * O sprite das pecas e cacheado por forma, material e tema, entao a marca nao
 * pode entrar nele: ela vem por cima, a cada quadro, na celula da peca mais
 * perto do meio dela (como a mao da dica e a bomba), para nunca cair no vazio
 * de um L.
 */

import { roundRectPath } from './draw2d.js';

/** Ouro da regra: o mesmo em todo tema, para a faixa e a joia lerem igual. */
export const OURO = '#ffd23f';
const OURO_FUNDO = '#b8860b';
const JOIA = '#4fe3ff';
const JOIA_FUNDO = '#1673a8';

/**
 * Centro da celula da peca mais perto do meio dela, em metros do mundo.
 * @param {*} piece PieceState
 * @returns {number[]}
 */
export function celulaCentral(piece) {
  const pos = piece.body.getPosition();
  const a = piece.body.getAngle();
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  let melhor = [0, 0];
  let dist = Infinity;
  for (const [cx, cy] of piece.cells) {
    const lx = cx + 0.5 - piece.cw / 2;
    const ly = cy + 0.5 - piece.ch / 2;
    const d = lx * lx + ly * ly;
    if (d < dist) {
      dist = d;
      melhor = [lx, ly];
    }
  }
  return [pos.x + melhor[0] * cos - melhor[1] * sin, pos.y + melhor[0] * sin + melhor[1] * cos];
}

/**
 * Gema lapidada: o mesmo desenho no icone e sobre a peca.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x centro
 * @param {number} y centro
 * @param {number} s lado do quadro
 * @param {number} [brilho] 0 a 1, a centelha que pisca
 */
export function paintJoia(ctx, x, y, s, brilho = 0) {
  const r = s * 0.42;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  // Coroa (topo largo) e pavilhao (ponta embaixo).
  ctx.beginPath();
  ctx.moveTo(-r, -r * 0.25);
  ctx.lineTo(-r * 0.55, -r * 0.7);
  ctx.lineTo(r * 0.55, -r * 0.7);
  ctx.lineTo(r, -r * 0.25);
  ctx.lineTo(0, r);
  ctx.closePath();
  ctx.fillStyle = JOIA;
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, s * 0.07);
  ctx.strokeStyle = JOIA_FUNDO;
  ctx.stroke();
  // Facetas.
  ctx.beginPath();
  ctx.moveTo(-r, -r * 0.25);
  ctx.lineTo(r, -r * 0.25);
  ctx.moveTo(-r * 0.3, -r * 0.25);
  ctx.lineTo(0, r);
  ctx.lineTo(r * 0.3, -r * 0.25);
  ctx.lineWidth = Math.max(1, s * 0.045);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.62);
  ctx.lineTo(-r * 0.15, -r * 0.62);
  ctx.lineTo(-r * 0.35, -r * 0.3);
  ctx.closePath();
  ctx.fill();
  if (brilho > 0) {
    // Centelha de quatro pontas no canto: diz "isto vale" sem texto.
    const cx = r * 0.75;
    const cy = -r * 0.85;
    const k = s * 0.22 * brilho;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - k);
    ctx.lineTo(cx + k * 0.25, cy);
    ctx.lineTo(cx, cy + k);
    ctx.lineTo(cx - k * 0.25, cy);
    ctx.closePath();
    ctx.moveTo(cx - k, cy);
    ctx.lineTo(cx, cy + k * 0.25);
    ctx.lineTo(cx + k, cy);
    ctx.lineTo(cx, cy - k * 0.25);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Cadeado: arco e corpo, com o buraco da chave.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} s
 * @param {string} [cor]
 * @param {string} [fundo]
 */
export function paintCadeado(ctx, x, y, s, cor = '#f2f2f2', fundo = '#2b2b36') {
  const w = s * 0.62;
  const h = s * 0.46;
  ctx.save();
  ctx.translate(x, y + s * 0.1);
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.strokeStyle = fundo;
  ctx.beginPath();
  ctx.arc(0, -h * 0.5, w * 0.3, Math.PI, 0);
  ctx.lineTo(w * 0.3, -h * 0.25);
  ctx.moveTo(-w * 0.3, -h * 0.25);
  ctx.lineTo(-w * 0.3, -h * 0.5);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.2, s * 0.07);
  ctx.strokeStyle = cor;
  ctx.stroke();
  ctx.fillStyle = cor;
  ctx.strokeStyle = fundo;
  ctx.lineWidth = Math.max(1.2, s * 0.06);
  ctx.beginPath();
  roundRectPath(ctx, -w / 2, -h * 0.3, w, h, s * 0.08);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = fundo;
  ctx.beginPath();
  ctx.arc(0, h * 0.05, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-s * 0.025, h * 0.05, s * 0.05, h * 0.25);
  ctx.restore();
}

/**
 * Icone de uma regra, num quadro de lado `lado`. A cor da tinta vem de quem
 * chama: no cartao de estreia e a tinta do tema, porque o branco cravado some
 * no cartao claro do mundo classico.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} id
 * @param {number} lado
 * @param {string} tinta
 */
export function paintRegraIcon(ctx, id, lado, tinta) {
  const c = lado / 2;
  ctx.save();
  if (id === 'joia') {
    paintJoia(ctx, c, c, lado * 0.95, 1);
  } else if (id === 'cadeado') {
    paintCadeado(ctx, c, c, lado * 0.95, '#f2f2f2', tinta);
  } else if (id === 'dourado') {
    // O pedestal visto de frente, com a faixa dourada no meio do topo e a
    // seta do hexagono descendo nela.
    const u = lado / 36;
    ctx.fillStyle = tinta;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    roundRectPath(ctx, 4 * u, 24 * u, 28 * u, 7 * u, 2 * u);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = OURO;
    ctx.fillRect(12 * u, 22 * u, 12 * u, 4 * u);
    ctx.strokeStyle = OURO;
    ctx.lineWidth = 3 * u;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(18 * u, 4 * u);
    ctx.lineTo(18 * u, 16 * u);
    ctx.moveTo(13 * u, 11 * u);
    ctx.lineTo(18 * u, 16 * u);
    ctx.lineTo(23 * u, 11 * u);
    ctx.stroke();
  } else {
    // Toques contados: um dedo tocando e tres tracos de contagem.
    const u = lado / 36;
    ctx.strokeStyle = tinta;
    ctx.fillStyle = tinta;
    ctx.lineCap = 'round';
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.arc(13 * u, 12 * u, 6 * u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(13 * u, 12 * u, 2.2 * u, 0, Math.PI * 2);
    ctx.fill();
    for (const x of [22, 27, 32]) {
      ctx.beginPath();
      ctx.moveTo(x * u, 21 * u);
      ctx.lineTo(x * u, 32 * u);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(20 * u, 30 * u);
    ctx.lineTo(34 * u, 23 * u);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Canvas pronto com o icone, para o chip do HUD e o cartao de estreia.
 * @param {string} id
 * @param {number} lado px CSS
 * @param {string} tinta
 * @param {string} [classe]
 * @returns {HTMLCanvasElement}
 */
export function regraIcon(id, lado, tinta, classe = 'tut-ico') {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = document.createElement('canvas');
  cv.width = Math.round(lado * dpr);
  cv.height = Math.round(lado * dpr);
  cv.className = classe;
  const ctx = cv.getContext('2d');
  if (!ctx) return cv;
  ctx.scale(dpr, dpr);
  paintRegraIcon(ctx, id, lado, tinta);
  return cv;
}

/**
 * Faixa dourada no topo do pedestal: e onde o hexagono tem que pousar.
 * A meia-largura desenhada soma meia base do hexagono a `meia` (a regra mede
 * o CENTRO dele), para a base plana inteira caber na faixa quando o centro esta
 * dentro dela.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} sx centro do pedestal na tela
 * @param {number} sy topo do pedestal na tela
 * @param {number} meiaPx meia-largura da faixa em px
 * @param {number} px pixels por metro
 * @param {number} time
 */
export function paintFaixaDourada(ctx, sx, sy, meiaPx, px, time) {
  // A faixa desce pela FACE do pedestal, e nao so pelo topo: com a torre em
  // cima o topo fica escondido atras da linha de baixo das pecas, e o alvo da
  // fase nao aparecia ate o fim.
  const h = Math.max(4, px * 0.16);
  const topo = sy - h * 0.45;
  const alto = h * 0.45 + Math.max(h * 1.8, px * 0.36);
  ctx.save();
  const g = ctx.createLinearGradient(0, topo, 0, topo + alto);
  g.addColorStop(0, '#fff2a8');
  g.addColorStop(0.35, OURO);
  g.addColorStop(1, OURO_FUNDO);
  ctx.fillStyle = g;
  ctx.beginPath();
  roundRectPath(ctx, sx - meiaPx, topo, meiaPx * 2, alto, h * 0.4);
  ctx.fill();
  // Um reflexo correndo pela faixa, em vez de halo borrado: chapado, como o
  // resto da arte.
  const k = ((time * 0.35) % 1) * 2 - 0.5;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.rect(sx - meiaPx, topo, meiaPx * 2, alto);
  ctx.clip();
  ctx.fillRect(sx - meiaPx + k * meiaPx * 2, topo, Math.max(3, px * 0.12), alto);
  ctx.restore();
  // Marcas das pontas: o limite tem que ser lido de longe.
  ctx.fillStyle = OURO_FUNDO;
  for (const s of [-1, 1]) {
    ctx.fillRect(sx + s * meiaPx - Math.max(1, px * 0.03), sy - h * 1.3, Math.max(2, px * 0.06), h * 1.3 + alto);
  }
  ctx.restore();
}
