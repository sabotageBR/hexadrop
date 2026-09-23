/**
 * A mao que toca: o gesto do tutorial.
 *
 * A Poki: "Walls of text intimidate, and English text excludes a lot of our
 * global audience. Use images, animations, and gestures instead." Ate a 1.0.4
 * a fase 1 explicava o toque so por escrito, e a dica automatica acendia a
 * peca certa sem dizer o que fazer com ela. A mao desce, aperta e solta sobre a
 * peca da dica, com uma onda saindo do ponto tocado - o gesto se explica
 * sozinho, em qualquer idioma.
 *
 * Nao toca no DOM: recebe o contexto ja na escala CSS da cena.
 */

const PERIODO = 1.25;

/** @param {number} t @returns {number} */
const suave = (t) => t * t * (3 - 2 * t);

/**
 * Silhueta da mao apontando, com a ponta do indicador em (0, 0) e o resto
 * descendo para a direita. Unidades de `s`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} s
 */
function formas(ctx, s) {
  ctx.beginPath();
  // indicador
  ctx.roundRect(-0.1 * s, 0, 0.2 * s, 0.62 * s, 0.1 * s);
  // palma, com os outros dedos dobrados por cima
  ctx.roundRect(-0.1 * s, 0.4 * s, 0.56 * s, 0.56 * s, 0.16 * s);
  ctx.roundRect(0.1 * s, 0.36 * s, 0.17 * s, 0.26 * s, 0.085 * s);
  ctx.roundRect(0.27 * s, 0.4 * s, 0.17 * s, 0.24 * s, 0.085 * s);
  // polegar
  ctx.roundRect(-0.3 * s, 0.56 * s, 0.34 * s, 0.17 * s, 0.085 * s);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x ponto tocado, px CSS
 * @param {number} y
 * @param {number} s tamanho da mao, px CSS
 * @param {number} tempo segundos, de qualquer relogio que ande
 */
export function paintTapHand(ctx, x, y, s, tempo) {
  const p = (tempo % PERIODO) / PERIODO;
  // Desce ate 35% do ciclo, aperta ate 50% e sobe no resto.
  let recuo;
  if (p < 0.35) recuo = 1 - suave(p / 0.35);
  else if (p < 0.5) recuo = 0;
  else recuo = suave((p - 0.5) / 0.5);
  const apertado = p >= 0.35 && p < 0.5;

  // A onda nasce no aperto e se abre ate o fim do ciclo.
  if (p >= 0.35) {
    const k = (p - 0.35) / 0.65;
    ctx.save();
    ctx.globalAlpha = 0.55 * (1 - k);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.5, s * 0.06);
    ctx.beginPath();
    ctx.arc(x, y, s * (0.12 + k * 0.5), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(x + recuo * s * 0.12, y + recuo * s * 0.2);
  ctx.rotate(-0.35);
  const escala = apertado ? 0.92 : 1;
  ctx.scale(escala, escala);
  // Contorno primeiro, largo, e o miolo branco por cima: sobra so a borda de
  // fora, sem as costuras entre as formas que compoem a mao.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = s * 0.12;
  ctx.shadowOffsetY = s * 0.05;
  formas(ctx, s);
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.1;
  ctx.strokeStyle = '#1b1530';
  ctx.stroke();
  ctx.shadowColor = 'transparent';
  formas(ctx, s);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  // Unha: a pista de para onde o dedo aponta.
  ctx.beginPath();
  ctx.roundRect(-0.055 * s, 0.05 * s, 0.11 * s, 0.13 * s, 0.05 * s);
  ctx.fillStyle = 'rgba(27, 21, 48, 0.14)';
  ctx.fill();
  ctx.restore();
}
