/**
 * O pedestal, com uma silhueta por mundo.
 *
 * Antes era o mesmo retangulo arredondado nos oito temas, mudando so de cor -
 * o destino da fase inteira desenhado como um placeholder. Aqui cada tema ganha
 * a sua forma.
 *
 * Nada disto toca a fisica: o corpo continua sendo a caixa de meia altura
 * PEDESTAL_HALF_H com o topo em y = 0. Tudo que estes desenhos acrescentam fica
 * abaixo da linha de pouso ou e puro enfeite, para que uma fase ja validada
 * continue se jogando exatamente igual.
 */

import { roundRect } from './draw2d.js';

/**
 * @typedef {object} Base
 * @property {CanvasRenderingContext2D} ctx
 * @property {number} sx centro do pedestal na tela
 * @property {number} sy topo do pedestal na tela
 * @property {number} w largura total em pixels
 * @property {number} h altura total em pixels
 * @property {number} px pixels por metro
 * @property {number} vh altura da viewport
 * @property {import('./themes.js').Theme} theme
 */

/** @param {Base} b */
function coluna(b, fracao = 0.68, alpha = 0.55) {
  const { ctx, sx, sy, w, h, vh, theme } = b;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = theme.pedestal.fill;
  ctx.fillRect(sx - (w * fracao) / 2, sy + h, w * fracao, Math.max(0, vh - sy));
  ctx.restore();
}

/** Plataforma de neon: chapa fina, halo forte e um facho descendo. */
function neon(b) {
  const { ctx, sx, sy, w, h, px, vh, theme } = b;
  const facho = ctx.createLinearGradient(0, sy, 0, vh);
  facho.addColorStop(0, theme.pedestal.glow);
  facho.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = facho;
  ctx.beginPath();
  ctx.moveTo(sx - w * 0.34, sy + h);
  ctx.lineTo(sx + w * 0.34, sy + h);
  ctx.lineTo(sx + w * 0.62, vh);
  ctx.lineTo(sx - w * 0.62, vh);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.shadowColor = theme.pedestal.glow;
  ctx.shadowBlur = px * 0.6;
  ctx.fillStyle = theme.pedestal.fill;
  roundRect(ctx, sx - w / 2, sy, w, h, Math.min(h * 0.45, px * 0.3));
  ctx.fill();
  ctx.strokeStyle = theme.pedestal.stroke;
  ctx.lineWidth = Math.max(2, px * 0.06);
  ctx.stroke();
  ctx.stroke();
  // Trilho de luz no topo, onde o hexagono pousa.
  ctx.shadowBlur = px * 0.35;
  ctx.beginPath();
  ctx.moveTo(sx - w * 0.44, sy + h * 0.16);
  ctx.lineTo(sx + w * 0.44, sy + h * 0.16);
  ctx.lineWidth = Math.max(1, px * 0.035);
  ctx.stroke();
}

/** Hangar: chapa metalica com estrias de alerta e dois pilares. */
function hangar(b) {
  const { ctx, sx, sy, w, h, px, vh, theme } = b;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = theme.pedestal.fill;
  for (const s of [-1, 1]) {
    ctx.fillRect(sx + s * w * 0.3 - px * 0.08, sy + h, px * 0.16, Math.max(0, vh - sy));
  }
  ctx.restore();

  ctx.fillStyle = theme.pedestal.fill;
  roundRect(ctx, sx - w / 2, sy, w, h, px * 0.06);
  ctx.fill();
  ctx.strokeStyle = theme.pedestal.stroke;
  ctx.lineWidth = Math.max(2, px * 0.05);
  ctx.stroke();

  ctx.save();
  roundRect(ctx, sx - w / 2, sy, w, h, px * 0.06);
  ctx.clip();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = theme.pedestal.glow;
  ctx.lineWidth = px * 0.1;
  for (let x = -w / 2; x < w / 2 + h; x += px * 0.34) {
    ctx.beginPath();
    ctx.moveTo(sx + x, sy + h);
    ctx.lineTo(sx + x + h, sy);
    ctx.stroke();
  }
  ctx.restore();
}

/** Tronco: prancha de madeira com veio e dois mourroes. */
function tronco(b) {
  const { ctx, sx, sy, w, h, px, vh, theme } = b;
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = theme.pedestal.fill;
  for (const s of [-1, 1]) {
    ctx.fillRect(sx + s * w * 0.32 - px * 0.1, sy + h, px * 0.2, Math.max(0, vh - sy));
  }
  ctx.restore();

  ctx.fillStyle = theme.pedestal.fill;
  roundRect(ctx, sx - w / 2, sy, w, h, px * 0.12);
  ctx.fill();
  ctx.strokeStyle = theme.pedestal.stroke;
  ctx.lineWidth = Math.max(2, px * 0.055);
  ctx.stroke();

  ctx.save();
  roundRect(ctx, sx - w / 2, sy, w, h, px * 0.12);
  ctx.clip();
  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = theme.pedestal.stroke;
  ctx.lineWidth = Math.max(1, px * 0.025);
  for (let i = 1; i < 4; i++) {
    const y = sy + (h * i) / 4;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, y);
    ctx.bezierCurveTo(sx - w * 0.15, y - h * 0.08, sx + w * 0.15, y + h * 0.08, sx + w / 2, y);
    ctx.stroke();
  }
  ctx.restore();
}

/** Altar: bloco de pedra em degraus. */
function degraus(b) {
  const { ctx, sx, sy, w, h, px, vh, theme } = b;
  coluna(b, 0.5, 0.42);
  ctx.strokeStyle = theme.pedestal.stroke;
  ctx.lineWidth = Math.max(2, px * 0.045);
  // Tres degraus: o de cima e a superficie de pouso, os outros descem e alargam.
  for (let i = 0; i < 3; i++) {
    const largura = w * (1 + i * 0.16);
    const altura = h * 0.52;
    const topo = sy + i * altura * 0.74;
    if (topo > vh) break;
    ctx.fillStyle = theme.pedestal.fill;
    ctx.globalAlpha = 1 - i * 0.16;
    roundRect(ctx, sx - largura / 2, topo, largura, altura, px * 0.05);
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Bolo: cobertura com pingos escorrendo. */
function bolo(b) {
  const { ctx, sx, sy, w, h, px, vh, theme } = b;
  coluna(b, 0.74, 0.8);
  ctx.fillStyle = theme.pedestal.fill;
  roundRect(ctx, sx - w / 2, sy, w, h, h * 0.42);
  ctx.fill();
  ctx.strokeStyle = theme.pedestal.stroke;
  ctx.lineWidth = Math.max(2, px * 0.05);
  ctx.stroke();

  // Pingos de cobertura, com tamanhos fixos para nao tremerem entre quadros.
  const pingos = [0.16, 0.34, 0.5, 0.68, 0.86];
  ctx.fillStyle = theme.pedestal.glow;
  for (let i = 0; i < pingos.length; i++) {
    const x = sx - w / 2 + w * pingos[i];
    const gota = h * (0.4 + ((i * 7) % 5) * 0.12);
    ctx.beginPath();
    ctx.moveTo(x - px * 0.11, sy + h * 0.7);
    ctx.lineTo(x + px * 0.11, sy + h * 0.7);
    ctx.lineTo(x + px * 0.09, sy + h * 0.7 + gota);
    ctx.quadraticCurveTo(x, sy + h * 0.7 + gota + px * 0.1, x - px * 0.09, sy + h * 0.7 + gota);
    ctx.closePath();
    ctx.fill();
  }
}

/** Bloco de gelo com facetas. */
function gelo(b) {
  const { ctx, sx, sy, w, h, px, vh, theme } = b;
  coluna(b, 0.56, 0.4);
  ctx.fillStyle = theme.pedestal.fill;
  ctx.beginPath();
  ctx.moveTo(sx - w / 2, sy);
  ctx.lineTo(sx + w / 2, sy);
  ctx.lineTo(sx + w * 0.42, sy + h);
  ctx.lineTo(sx - w * 0.42, sy + h);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = theme.pedestal.glow;
  ctx.shadowBlur = px * 0.4;
  ctx.strokeStyle = theme.pedestal.stroke;
  ctx.lineWidth = Math.max(2, px * 0.05);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = Math.max(1, px * 0.022);
  for (const f of [-0.26, 0.04, 0.3]) {
    ctx.beginPath();
    ctx.moveTo(sx + w * f, sy);
    ctx.lineTo(sx + w * (f + 0.12), sy + h);
    ctx.stroke();
  }
  ctx.restore();
}

/** Obsidiana: rocha escura com fendas acesas. */
function obsidiana(b) {
  const { ctx, sx, sy, w, h, px, vh, theme } = b;
  coluna(b, 0.6, 0.85);
  ctx.fillStyle = theme.pedestal.fill;
  ctx.beginPath();
  ctx.moveTo(sx - w / 2, sy + h * 0.1);
  ctx.lineTo(sx - w * 0.36, sy);
  ctx.lineTo(sx + w * 0.38, sy);
  ctx.lineTo(sx + w / 2, sy + h * 0.14);
  ctx.lineTo(sx + w * 0.44, sy + h);
  ctx.lineTo(sx - w * 0.46, sy + h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = theme.pedestal.stroke;
  ctx.lineWidth = Math.max(2, px * 0.05);
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = theme.pedestal.glow;
  ctx.shadowBlur = px * 0.5;
  ctx.strokeStyle = theme.pedestal.glow;
  ctx.lineWidth = Math.max(1.5, px * 0.03);
  // Fendas curtas e desiguais. Tres traços iguais e igualmente espaçados leem
  // como padrao, nao como rocha rachada - por isso cada um tem comeco, fim e
  // zigue-zague proprios. O desvio anda com a ALTURA e nao com a largura: o
  // pedestal e muito mais largo que alto, e um desvio proporcional a largura
  // desenharia setas atravessadas.
  const fendas = [
    { x: -0.34, y0: 0.0, y1: 0.62, zig: [0.1, -0.05] },
    { x: -0.06, y0: 0.24, y1: 1.0, zig: [-0.08, 0.04] },
    { x: 0.2, y0: 0.0, y1: 0.44, zig: [0.06, 0.0] },
    { x: 0.37, y0: 0.35, y1: 1.0, zig: [-0.05, 0.07] },
  ];
  for (const f of fendas) {
    const x0 = sx + w * f.x;
    ctx.beginPath();
    ctx.moveTo(x0, sy + h * f.y0);
    ctx.lineTo(x0 + h * f.zig[0], sy + h * (f.y0 + f.y1) * 0.5);
    ctx.lineTo(x0 + h * f.zig[1], sy + h * f.y1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Folha de papel dobrada. */
function dobra(b) {
  const { ctx, sx, sy, w, h, px, vh, theme } = b;
  coluna(b, 0.3, 0.3);
  ctx.fillStyle = theme.pedestal.fill;
  ctx.beginPath();
  ctx.moveTo(sx - w / 2, sy + h * 0.16);
  ctx.lineTo(sx - w * 0.44, sy);
  ctx.lineTo(sx + w * 0.44, sy);
  ctx.lineTo(sx + w / 2, sy + h * 0.16);
  ctx.lineTo(sx + w / 2, sy + h);
  ctx.lineTo(sx - w / 2, sy + h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = theme.pedestal.stroke;
  ctx.lineWidth = Math.max(1.5, px * 0.04);
  ctx.stroke();
  // Vinco central, o unico detalhe que uma folha dobrada precisa.
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx, sy + h);
  ctx.lineWidth = Math.max(1, px * 0.02);
  ctx.stroke();
  ctx.restore();
}

/** Retangulo arredondado: o desenho antigo, reserva para tema sem estilo. */
function chapa(b) {
  const { ctx, sx, sy, w, h, px, theme } = b;
  coluna(b);
  ctx.shadowColor = theme.pedestal.glow;
  ctx.shadowBlur = theme.glow > 0.3 ? px * 0.5 : 0;
  ctx.fillStyle = theme.pedestal.fill;
  roundRect(ctx, sx - w / 2, sy, w, h, Math.min(h * 0.3, px * 0.22));
  ctx.fill();
  ctx.strokeStyle = theme.pedestal.stroke;
  ctx.lineWidth = Math.max(2, px * 0.055);
  ctx.stroke();
}

const ESTILOS = { neon, hangar, tronco, degraus, bolo, gelo, obsidiana, dobra, chapa };

/**
 * @param {Base} b
 */
export function paintPedestal(b) {
  const estilo = (b.theme.pedestal && b.theme.pedestal.style) || 'chapa';
  (ESTILOS[estilo] || chapa)(b);
}
