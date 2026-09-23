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

/**
 * Tablet, mesmo com teclado ou trackpad acoplado.
 *
 * A Poki pede "automatically force mobile control schemes on tablet devices". Um
 * iPad com teclado e trackpad informa ponteiro principal fino e caia na camera
 * do desktop, de pecas pequenas para o dedo. O iPadOS se apresenta como Mac, e
 * a pista que sobra e o toque multiplo num "Macintosh".
 * @returns {boolean}
 */
export function isTablet() {
  try {
    const ua = navigator.userAgent || '';
    if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua)) return true;
    if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return true;
    return /Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1;
  } catch {
    return false;
  }
}

/** @returns {boolean} */
/**
 * O ponteiro PRINCIPAL e preciso - qualquer coisa que nao seja o dedo?
 *
 * Nao e o contrario de `isTouchDevice()`: um notebook com tela de toque tem
 * toque, mas quem joga nele usa o mouse. E o ponteiro principal que decide o
 * tamanho de celula da camera - o dedo precisa de peca grande, o mouse nao, e
 * no desktop a peca grande empurrava o pedestal para fora da janela da Poki.
 *
 * Pergunta por `coarse`, e nao por `fine`: sem ponteiro nenhum (`pointer:
 * none`, que e o que o Chrome headless das ferramentas informa) a resposta
 * certa e a do desktop.
 * @returns {boolean}
 */
export function hasFinePointer() {
  if (isTablet()) return false;
  try {
    return !window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return true;
  }
}

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
