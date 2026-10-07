/**
 * Fim de fase no estilo do stringcut, que veio do Blumgi Bounce (medido quadro
 * a quadro na gravacao de referencia): flash branco, feixe e soco de camera ->
 * o grito com extrusao colorida ciclando -> estrelas e moedas pulando embaixo
 * -> confete dos dois lados -> o grito sai por cima -> corte para a fase nova,
 * que nasce lavada de branco e com zoom 1,25x recuando para 1.
 *
 * No fim de mundo vem o mesmo, com confete dobrado, os pips da fita voando para
 * o centro e estourando, a revelacao do premio (DOM, main.js) e uma varredura
 * diagonal na cor do mundo seguinte com "MUNDO N", que cobre a troca.
 *
 * Tudo e funcao pura do tempo t (s desde a vitoria). Quem conta o tempo e
 * main.js, no passo fixo da cena: o laco para no intervalo comercial, e a
 * transicao para junto. Nao toca no DOM: recebe o contexto ja na escala CSS.
 */

import { drawStar } from './renderer.js';

const TAU = Math.PI * 2;
const CORES = ['#ff4fa3', '#ff9a3d', '#ffd93b', '#43dd6e', '#2fd0ff', '#5b7cff', '#a55bff', '#ff5be0'];
const CONFETE = ['#ff4fa3', '#ffd93b', '#7a5cff', '#3ee08f', '#38c8ff', '#ff8a3d', '#ffffff'];
const DOURADO = '#f2a900';
const FONTE = '"Fredoka", "Arial Rounded MT Bold", system-ui, sans-serif';

/** Troca de fase: o grito ja saiu e o confete ainda cai. */
export const TROCA_FASE = 2.3;
/** O confete termina de cair por cima da fase nova. */
const FIM_FASE = 2.7;
/** Os pips terminam de juntar aqui; e tambem quando a revelacao do premio abre. */
export const PREMIO_INI = 1.95;
/** Duracao fixa da revelacao do premio (sem toque para adiantar). */
export const PREMIO_DUR = 2.2;

/** @param {number} v @param {number} [a] @param {number} [b] */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
/** @param {number} u */
export const easeOut = (u) => 1 - Math.pow(1 - clamp(u), 3);
/** @param {number} u */
export const easeIn = (u) => Math.pow(clamp(u), 3);
/** @param {number} u */
export const backOut = (u) => {
  const c = 1.9;
  const x = clamp(u) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
};

/** @param {number} s */
function rng(s) {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Os tempos do fim de mundo. Sem premio (mundo rejogado) sao os do stringcut:
 * "MUNDO N" no centro desde que os pips estouram, e a varredura cobrindo a
 * troca aos 3,3 s. Com premio, a revelacao ocupa o centro de 1,95 a 4,15, e o
 * nome do mundo entra junto com a varredura, logo depois dela.
 * @param {boolean} premio
 */
export function temposDoMundo(premio) {
  if (!premio) return { textoIni: 1.95, textoSai: 3.55, varIni: 2.95, varFim: 3.65, troca: 3.3, fim: 3.95 };
  const base = PREMIO_INI + PREMIO_DUR;
  return { textoIni: base, textoSai: base + 0.9, varIni: base, varFim: base + 0.7, troca: base + 0.35, fim: base + 1.25 };
}

/**
 * Quando trocar de fase e quando a camada some.
 * @param {string} tipo 'fase' | 'mundo' | 'final'
 * @param {boolean} premio
 */
export function tempos(tipo, premio) {
  if (tipo === 'mundo') {
    const m = temposDoMundo(premio);
    return { troca: m.troca, fim: m.fim };
  }
  return { troca: TROCA_FASE, fim: FIM_FASE };
}

/**
 * Soco de camera de ~6,5% no instante da vitoria.
 * @param {number} t
 */
export function soco(t) {
  if (t < 0 || t > 0.4) return 1;
  return 1 + 0.065 * (1 - easeOut(t / 0.38));
}

/**
 * Entrada da fase nova (t = s desde a troca): zoom 1,25 -> 1 e lavado branco.
 * @param {number} t
 */
export function entrada(t) {
  if (t >= 0.6) return { zoom: 1, branco: 0 };
  return { zoom: 1 + 0.25 * (1 - easeOut(t / 0.55)), branco: 0.62 * (1 - easeOut(t / 0.42)) };
}

/**
 * @param {string} h '#rrggbb'
 * @param {number} k
 */
function sombrear(h, k) {
  const n = parseInt(h.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/**
 * Tamanho de fonte que cabe na largura: as palavras mudam de lingua para
 * lingua ("JA!" e "MUKEMMEL!"), e a do celular em pe e a mais estreita.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} txt
 * @param {number} tam
 * @param {number} largura
 */
function cabe(ctx, txt, tam, largura) {
  ctx.font = `700 ${tam}px ${FONTE}`;
  const w = ctx.measureText(txt).width + tam * 0.3;
  return w > largura ? Math.max(12, Math.floor((tam * largura) / w)) : tam;
}

/**
 * Texto com face branca, contorno colorido e extrusao 3D (estilo Blumgi).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} txt
 * @param {number} x
 * @param {number} y
 * @param {number} tam
 * @param {string} cor
 * @param {number} [alpha]
 * @param {number} [glitch]
 */
function textoBlumgi(ctx, txt, x, y, tam, cor, alpha = 1, glitch = 0) {
  const escura = sombrear(cor, 0.55);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `700 ${tam}px ${FONTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const prof = Math.max(3, tam * 0.075);
  if (glitch > 0) {
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = '#ff2d6f';
    ctx.fillText(txt, x - glitch, y);
    ctx.fillStyle = '#2de1ff';
    ctx.fillText(txt, x + glitch, y);
    ctx.globalAlpha = alpha;
  }
  // extrusao
  for (let k = Math.round(prof); k >= 1; k--) {
    ctx.strokeStyle = escura;
    ctx.lineWidth = tam * 0.16;
    ctx.strokeText(txt, x + k * 0.55, y + k);
    ctx.fillStyle = escura;
    ctx.fillText(txt, x + k * 0.55, y + k);
  }
  // contorno colorido + face branca
  ctx.strokeStyle = cor;
  ctx.lineWidth = tam * 0.16;
  ctx.strokeText(txt, x, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(txt, x, y);
  // brilho interno leve
  ctx.globalAlpha = alpha * 0.18;
  ctx.fillStyle = cor;
  ctx.fillText(txt, x + tam * 0.025, y + tam * 0.04);
  ctx.restore();
}

/**
 * Tamanho base do grito, antes de caber na largura.
 * @param {number} W
 * @param {number} H
 */
const tamGrito = (W, H) => Math.min(W * 0.22, H * 0.2, 170);

/**
 * O grito: entra, treme, sai por cima.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} t
 * @param {*} info
 */
function desenharGrito(ctx, t, info) {
  const { W, H } = info;
  const ini = 0.08;
  const sai = 1.3;
  if (t < ini || t > sai + 0.32) return;
  const perfeita = info.nota === 'perfeita';
  const tam = cabe(ctx, info.grito, tamGrito(W, H) * (perfeita ? 1.1 : 1), W * 0.86);
  const u = (t - ini) / 0.3;
  let esc = u < 1 ? 1.7 - 0.7 * backOut(u) : 1 + Math.sin((t - ini) * 9) * 0.015;
  const alpha = clamp(0.3 + u * 1.6);
  let y = H * 0.3;
  let glitch = u < 0.6 ? (1 - u / 0.6) * 10 : 0;
  if (t > sai) {
    const v = (t - sai) / 0.3;
    y -= easeIn(v) * (H * 0.3 + tam * 1.2);
    glitch = 4 + v * 10;
  }
  if (info.reduzido) {
    esc = 1;
    glitch = 0;
  }
  // A perfeita fica no dourado: o arco-iris ciclando e o das outras duas.
  const cor = perfeita ? DOURADO : CORES[Math.floor(t * 15) % CORES.length];
  ctx.save();
  ctx.translate(W / 2, y);
  if (!info.reduzido) ctx.rotate(Math.sin(t * 11) * 0.035 * (u < 1 ? 1.6 : 1));
  ctx.scale(esc, esc);
  textoBlumgi(ctx, info.grito, 0, 0, tam, cor, alpha, glitch);
  ctx.restore();
}

/**
 * Altura das estrelas e das moedas: logo abaixo do grito, e subindo com ele.
 * @param {number} t
 * @param {number} W
 * @param {number} H
 */
function linhaDeBaixo(t, W, H) {
  return H * 0.3 + tamGrito(W, H) * 0.62 - (t > 1.3 ? easeIn((t - 1.3) / 0.3) * H * 0.6 : 0);
}

/**
 * Tamanho das estrelas: um pouco maiores que as do stringcut, cuja estrela e
 * mais gorda que a do `drawStar` daqui.
 * @param {number} W
 * @param {number} H
 */
const tamEstrela = (W, H) => Math.min(W * 0.078, H * 0.085, 50);

/**
 * As estrelas da fase, que pulam junto com o grito.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} t
 * @param {*} info
 */
function desenharEstrelas(ctx, t, info) {
  if (t < 0.32 || t > 1.65) return;
  const { W, H } = info;
  const tam = tamEstrela(W, H);
  const y = linhaDeBaixo(t, W, H);
  for (let k = 0; k < 3; k++) {
    const u = (t - 0.32 - k * 0.12) / 0.25;
    if (u < 0) continue;
    const esc = u < 1 && !info.reduzido ? backOut(u) : 1;
    ctx.save();
    ctx.translate(W / 2 + (k - 1) * tam * 1.25, y + (k === 1 ? -tam * 0.18 : 0));
    ctx.scale(esc, esc);
    ctx.rotate((k - 1) * 0.18);
    // Contorno escuro por baixo: a estrela tem que ler sobre ceu claro tambem.
    drawStar(ctx, 0, tam * 0.06, tam * 0.62, 'rgba(31,26,46,0.35)', false);
    drawStar(ctx, 0, 0, tam * 0.56, k < info.estrelas ? info.corEstrela : 'rgba(255,255,255,0.55)', false);
    ctx.restore();
  }
}

/**
 * A moeda do contador, a mesma do icone de premio: disco chapado, aro escuro.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} r
 */
function moeda(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = '#d99a00';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.78, 0, TAU);
  ctx.fillStyle = '#ffd84a';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.3, 0, TAU);
  ctx.fillStyle = '#fff3c4';
  ctx.fill();
}

/**
 * Onde o contador de moedas fica na tela (para as moedas sairem dele).
 * @param {number} t
 * @param {number} W
 * @param {number} H
 */
export function pontoDasMoedas(t, W, H) {
  return { x: W / 2, y: linhaDeBaixo(t, W, H) + tamEstrela(W, H) * 1.25 };
}

/**
 * O contador "+N" com a moeda: so numero, nada para traduzir. Na chuva do fim
 * de mundo ele e dourado e leva o "x2".
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} t
 * @param {*} info
 */
function desenharMoedas(ctx, t, info) {
  if (!info.moedas || t < 0.32 || t > 1.65) return;
  const { W, H } = info;
  const p = pontoDasMoedas(t, W, H);
  const tam = Math.min(W * 0.075, H * 0.06, 40);
  const pulo = info.pulo > 0 ? 1 + 0.18 * info.pulo : 1;
  const txt = `+${info.moedas}`;
  ctx.save();
  ctx.font = `700 ${tam}px ${FONTE}`;
  const w = ctx.measureText(txt).width;
  const r = tam * 0.42;
  const total = r * 2 + tam * 0.25 + w;
  const x0 = -total / 2;
  ctx.translate(p.x, p.y);
  ctx.scale(pulo, pulo);
  moeda(ctx, x0 + r, 0, r);
  textoBlumgi(ctx, txt, x0 + r * 2 + tam * 0.25 + w / 2, 0, tam, info.dobro ? DOURADO : '#d99a00');
  if (info.dobro) textoBlumgi(ctx, 'x2', total / 2 + tam * 0.55, -tam * 0.45, tam * 0.6, '#ff4fa3');
  ctx.restore();
}

/**
 * Confete fechado no tempo: dois canhoes nas laterais (posicao pura de t).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} t
 * @param {*} info
 * @param {number[]} inicios
 */
function desenharConfete(ctx, t, info, inicios) {
  const { W, H } = info;
  const g = 1250;
  const k = 1.7;
  for (let c = 0; c < inicios.length; c++) {
    const dt = t - inicios[c];
    if (dt < 0 || dt > 2.6) continue;
    const r = rng((info.semente || 7) + c * 977);
    let n = Math.round(Math.min(90, 40 + W / 14));
    if (info.baixa) n = Math.round(n / 2);
    for (let i = 0; i < n * 2; i++) {
      const lado = i % 2 ? 1 : -1;
      const x0 = lado < 0 ? -10 : W + 10;
      const y0 = H * (0.48 + r() * 0.18);
      const vel = (900 + r() * 1100) * Math.min(1.25, Math.max(0.7, W / 900));
      const ang = -0.95 - r() * 0.75;
      const vx = Math.cos(ang) * vel * -lado;
      const vy = Math.sin(ang) * vel;
      const e = Math.exp(-k * dt);
      const fx = (1 - e) / k;
      let x = x0 + vx * fx;
      const y = y0 + vy * fx + (g / k) * (dt - fx);
      x += Math.sin(dt * (7 + r() * 5) + i) * 9;
      const tamP = 5 + r() * 7;
      const rot = dt * (5 + r() * 10) + r() * TAU;
      const fade = dt > 2.1 ? 1 - (dt - 2.1) / 0.5 : 1;
      const giro = Math.cos(dt * (8 + r() * 6) + i);
      const cor = CONFETE[Math.floor(r() * CONFETE.length)];
      const alto = 0.6 + r() * 0.5;
      if (y > H + 20) continue;
      ctx.save();
      ctx.globalAlpha = clamp(fade);
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(1, giro);
      ctx.fillStyle = cor;
      ctx.fillRect(-tamP / 2, -tamP / 2, tamP, tamP * alto);
      ctx.restore();
    }
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} t
 * @param {*} info
 */
function desenharFlash(ctx, t, info) {
  const { W, H, fx } = info;
  if (t < 0.32) {
    ctx.fillStyle = `rgba(255,255,255,${0.82 * (1 - t / 0.32)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (t < 0.65) {
    const a = 0.75 * (1 - t / 0.65);
    const larg = Math.max(46, W * 0.07) * (1 + t * 0.6);
    const g = ctx.createLinearGradient(fx - larg, 0, fx + larg, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(fx - larg, 0, larg * 2, H);
  }
}

/**
 * Os pips da fita do mundo voando para o centro e estourando.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} t
 * @param {*} info
 */
function desenharPips(ctx, t, info) {
  const { W, H, pips } = info;
  const ini = 1.45;
  const junta = PREMIO_INI;
  if (t < ini || !pips || !pips.length) return;
  const cx = W / 2;
  const cy = H * 0.42;
  if (t < junta) {
    const u = easeIn((t - ini) / (junta - ini));
    pips.forEach((/** @type {{x:number,y:number}} */ p, /** @type {number} */ k) => {
      const mx = (p.x + cx) / 2 + (k - pips.length / 2) * 24;
      const my = Math.min(p.y, cy) - 80;
      const x = (1 - u) * (1 - u) * p.x + 2 * (1 - u) * u * mx + u * u * cx;
      const y = (1 - u) * (1 - u) * p.y + 2 * (1 - u) * u * my + u * u * cy;
      const r = 7 + u * 9;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = CORES[(k + Math.floor(t * 15)) % CORES.length];
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
    });
    return;
  }
  const v = (t - junta) / 0.6;
  if (v > 1) return;
  ctx.strokeStyle = `rgba(255,255,255,${1 - v})`;
  ctx.lineWidth = 14 * (1 - v) + 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 20 + easeOut(v) * Math.max(W, H) * 0.45, 0, TAU);
  ctx.stroke();
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU;
    const d = 20 + easeOut(v) * 190;
    ctx.fillStyle = CONFETE[k % CONFETE.length];
    ctx.globalAlpha = 1 - v;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 6 * (1 - v) + 1, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/**
 * Varredura diagonal na cor do mundo novo: cobre a tela inteira na troca.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} t
 * @param {*} info
 * @param {{varIni:number, varFim:number}} m
 */
function desenharVarredura(ctx, t, info, m) {
  const { W, H } = info;
  if (t < m.varIni || t > m.varFim) return;
  const u = (t - m.varIni) / (m.varFim - m.varIni);
  const inc = H * 0.5;
  const larg = W + inc + 80;
  // a frente entra pela esquerda e a traseira sai pela direita
  const frente = -inc + easeOut(Math.min(1, u * 2)) * (larg + inc);
  const tras = u < 0.5 ? -inc - 40 : -inc + easeIn((u - 0.5) * 2) * (larg + inc);
  ctx.fillStyle = info.corMundo || '#ffd84a';
  ctx.beginPath();
  ctx.moveTo(tras, H);
  ctx.lineTo(tras + inc, 0);
  ctx.lineTo(frente + inc, 0);
  ctx.lineTo(frente, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(frente, H);
  ctx.lineTo(frente + inc, 0);
  if (u > 0.5) {
    ctx.moveTo(tras, H);
    ctx.lineTo(tras + inc, 0);
  }
  ctx.stroke();
}

/**
 * "MUNDO N": entra no centro, treme e sai por cima.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} t
 * @param {*} info
 * @param {{textoIni:number, textoSai:number}} m
 */
function desenharTextoMundo(ctx, t, info, m) {
  const { W, H } = info;
  if (!info.textoMundo || t < m.textoIni || t > m.textoSai + 0.4) return;
  const u = (t - m.textoIni) / 0.32;
  const sai = t > m.textoSai ? easeIn((t - m.textoSai) / 0.35) : 0;
  const tam = cabe(ctx, info.textoMundo, Math.min(W * 0.15, H * 0.15, 120), W * 0.86);
  const esc = info.reduzido ? 1 : u < 1 ? 1.6 - 0.6 * backOut(u) : 1 + Math.sin(t * 7) * 0.02;
  ctx.save();
  ctx.translate(W / 2, H * 0.42 - sai * (H * 0.42 + tam));
  if (!info.reduzido) ctx.rotate(Math.sin(t * 9) * 0.03);
  ctx.scale(esc, esc);
  const cor = CORES[(Math.floor(t * 15) + 3) % CORES.length];
  textoBlumgi(ctx, info.textoMundo, 0, 0, tam, cor, clamp(u * 2), sai > 0 && !info.reduzido ? 6 + sai * 8 : 0);
  ctx.restore();
}

/**
 * Desenha a camada da transicao, em pixels CSS de tela.
 *
 * info: { W, H, fx, grito, nota, estrelas, corEstrela, moedas, pulo, dobro,
 * pips, premio, textoMundo, corMundo, semente, reduzido, baixa }
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} tipo 'fase' | 'mundo' | 'final'
 * @param {number} t
 * @param {*} info
 */
export function desenhar(ctx, tipo, t, info) {
  const mundo = tipo === 'mundo';
  if (!info.reduzido) {
    desenharFlash(ctx, t, info);
    // Confete dobrado no fim de mundo, na fase 100 e na jogada perfeita.
    const dobrado = mundo || tipo === 'final' || info.nota === 'perfeita';
    desenharConfete(ctx, t, info, dobrado ? [0.12, 0.62] : [0.12]);
  }
  desenharGrito(ctx, t, info);
  desenharEstrelas(ctx, t, info);
  desenharMoedas(ctx, t, info);
  if (mundo) {
    const m = temposDoMundo(!!info.premio);
    if (!info.reduzido) desenharPips(ctx, t, info);
    desenharVarredura(ctx, t, info, m);
    desenharTextoMundo(ctx, t, info, m);
  }
}

/**
 * Lavado branco da entrada da fase nova, por cima da cena.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} branco
 * @param {number} W
 * @param {number} H
 */
export function desenharBranco(ctx, branco, W, H) {
  if (branco <= 0) return;
  ctx.fillStyle = `rgba(255,255,255,${branco})`;
  ctx.fillRect(0, 0, W, H);
}
