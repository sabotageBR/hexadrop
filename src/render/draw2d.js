/** Primitivas de desenho compartilhadas entre os modulos de render. */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, r);
}

/**
 * O mesmo retangulo como subcaminho, sem `beginPath`: varios somam um caminho
 * so (a mao do tutorial e cinco deles). E o `ctx.roundRect` nativo, que so
 * existe a partir do Chrome 99 e do Safari/iOS 16 - no iOS 15 o app quebrava
 * ao desenhar a mao das fases 1 a 3.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
