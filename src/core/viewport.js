/**
 * Dimensionamento do canvas.
 * A Poki exige cobrir 100% do canvas no desktop (16:9 em 640x360, 836x470 e
 * 1031x580) e tela cheia em portrait ou landscape no mobile. Cobrimos os dois
 * casos deixando o canvas ocupar toda a janela e adaptando o layout ao formato.
 */

const MAX_DPR = 2;

export class Viewport {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    /** @type {CanvasRenderingContext2D} */
    this.ctx = /** @type {CanvasRenderingContext2D} */ (
      canvas.getContext('2d', { alpha: false, desynchronized: true })
    );
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.isPortrait = true;
    /** @type {Set<(vp: Viewport)=>void>} */
    this.listeners = new Set();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize, { passive: true });
    window.addEventListener('orientationchange', this._onResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this._onResize, { passive: true });
    }
    this.resize();
  }

  /** @param {(vp: Viewport)=>void} fn @returns {()=>void} */
  onResize(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width || window.innerWidth));
    const cssH = Math.max(1, Math.round(rect.height || window.innerHeight));
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    const changed = this.width !== cssW || this.height !== cssH || this.dpr !== dpr;
    this.width = cssW;
    this.height = cssH;
    this.dpr = dpr;
    this.isPortrait = cssH >= cssW;
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    if (changed) {
      for (const fn of this.listeners) fn(this);
    }
  }

  /**
   * Prepara o contexto para desenhar em pixels CSS.
   * @returns {CanvasRenderingContext2D}
   */
  begin() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    return ctx;
  }

  /**
   * Fator de escala de interface: telas pequenas recebem controles proporcionais.
   * @returns {number}
   */
  uiScale() {
    const base = Math.min(this.width, this.height);
    return Math.max(0.62, Math.min(1.45, base / 460));
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this._onResize);
    }
    this.listeners.clear();
  }
}

/** @returns {boolean} */
export function isTouchDevice() {
  try {
    return (
      ('ontouchstart' in window) ||
      (navigator.maxTouchPoints || 0) > 0 ||
      window.matchMedia('(pointer: coarse)').matches
    );
  } catch {
    return false;
  }
}
