/**
 * Particulas em pool.
 *
 * Ao destruir uma peca, varremos a mascara do polimino e lancamos quadradinhos
 * com a cor do material, como o estouro de pixels da referencia. Tudo em um
 * unico Float32Array, agrupado por cor na hora de desenhar.
 */

const MAX = 640;
const STRIDE = 8; // x, y, vx, vy, vida, duracao, tamanho, indiceDeCor

export class Particles {
  constructor() {
    this.data = new Float32Array(MAX * STRIDE);
    this.count = 0;
    /** @type {string[]} */
    this.colors = [];
    /** @type {Map<string, number>} */
    this.colorIndex = new Map();
    this.gravity = -10;
  }

  /** @param {string} color @returns {number} */
  _color(color) {
    const hit = this.colorIndex.get(color);
    if (hit !== undefined) return hit;
    const idx = this.colors.length;
    this.colors.push(color);
    this.colorIndex.set(color, idx);
    return idx;
  }

  /**
   * @param {object} o
   * @param {[number,number][]} o.cells
   * @param {number} o.x centro do corpo, em metros
   * @param {number} o.y
   * @param {number} o.angle
   * @param {number} o.cw largura em celulas
   * @param {number} o.ch
   * @param {string} o.color
   * @param {number} [o.vx] velocidade herdada do corpo
   * @param {number} [o.vy]
   * @param {number} [o.density] particulas por celula
   * @param {(n:number)=>number} o.rand
   */
  burst(o) {
    const ci = this._color(o.color);
    const perCell = Math.max(1, Math.round(o.density === undefined ? 3 : o.density));
    const cos = Math.cos(o.angle);
    const sin = Math.sin(o.angle);
    for (const [cx, cy] of o.cells) {
      for (let k = 0; k < perCell; k++) {
        if (this.count >= MAX) return;
        // posicao local da celula dentro da peca, em metros
        const lx = cx + 0.5 - o.cw / 2 + o.rand(1) * 0.7 - 0.35;
        const ly = cy + 0.5 - o.ch / 2 + o.rand(1) * 0.7 - 0.35;
        const wx = o.x + lx * cos - ly * sin;
        const wy = o.y + lx * sin + ly * cos;
        const i = this.count * STRIDE;
        const d = this.data;
        const dur = 0.42 + o.rand(1) * 0.5;
        d[i] = wx;
        d[i + 1] = wy;
        d[i + 2] = (o.vx || 0) * 0.4 + (o.rand(1) - 0.5) * (o.spread === undefined ? 5.5 : o.spread);
        d[i + 3] = (o.vy || 0) * 0.4 + o.rand(1) * (o.lift === undefined ? 4.2 : o.lift);
        d[i + 4] = dur;
        d[i + 5] = dur;
        d[i + 6] = 0.1 + o.rand(1) * 0.13;
        d[i + 7] = ci;
        this.count++;
      }
    }
  }

  /**
   * Faisca simples, usada em impactos.
   * @param {number} x
   * @param {number} y
   * @param {string} color
   * @param {number} amount
   * @param {(n:number)=>number} rand
   */
  spark(x, y, color, amount, rand) {
    const ci = this._color(color);
    for (let k = 0; k < amount; k++) {
      if (this.count >= MAX) return;
      const i = this.count * STRIDE;
      const d = this.data;
      const dur = 0.2 + rand(1) * 0.3;
      d[i] = x;
      d[i + 1] = y;
      d[i + 2] = (rand(1) - 0.5) * 4;
      d[i + 3] = rand(1) * 3;
      d[i + 4] = dur;
      d[i + 5] = dur;
      d[i + 6] = 0.05 + rand(1) * 0.07;
      d[i + 7] = ci;
      this.count++;
    }
  }

  /** @param {number} dt */
  update(dt) {
    const d = this.data;
    let i = 0;
    while (i < this.count) {
      const o = i * STRIDE;
      d[o + 4] -= dt;
      if (d[o + 4] <= 0) {
        this.count--;
        if (this.count !== i) {
          const last = this.count * STRIDE;
          for (let k = 0; k < STRIDE; k++) d[o + k] = d[last + k];
        }
        continue;
      }
      d[o + 3] += this.gravity * dt * 0.55;
      d[o] += d[o + 2] * dt;
      d[o + 1] += d[o + 3] * dt;
      d[o + 2] *= 1 - dt * 1.4;
      i++;
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {(x:number,y:number)=>number[]} toScreen
   * @param {number} pxPerMeter
   */
  draw(ctx, toScreen, pxPerMeter) {
    if (!this.count) return;
    const d = this.data;
    for (let c = 0; c < this.colors.length; c++) {
      let opened = false;
      for (let i = 0; i < this.count; i++) {
        const o = i * STRIDE;
        if (d[o + 7] !== c) continue;
        if (!opened) {
          ctx.fillStyle = this.colors[c];
          opened = true;
        }
        const life = d[o + 4] / d[o + 5];
        ctx.globalAlpha = Math.min(1, life * 1.6);
        const [sx, sy] = toScreen(d[o], d[o + 1]);
        const size = d[o + 6] * pxPerMeter * (0.4 + life * 0.6);
        ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.count = 0;
  }
}
