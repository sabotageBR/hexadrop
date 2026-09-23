/**
 * Entrada unificada de ponteiro e teclado.
 * Usa Pointer Events, que cobrem mouse, toque e caneta com o mesmo caminho.
 * Tambem impede que setas, espaco e roda do mouse rolem a pagina que hospeda
 * o iframe do jogo, como a Poki exige.
 */

/**
 * @typedef {object} PointerInfo
 * @property {number} x em pixels CSS relativos ao canvas
 * @property {number} y
 * @property {number} id
 */

/**
 * Ha uma lista rolavel entre este no e a raiz?
 *
 * @param {EventTarget|null} node
 * @returns {boolean}
 */
function rolavelSob(node) {
  let el = /** @type {Element|null} */ (node instanceof Element ? node : null);
  while (el && el !== document.body) {
    if (el.scrollHeight > el.clientHeight + 1) {
      const y = getComputedStyle(el).overflowY;
      if (y === 'auto' || y === 'scroll') return true;
    }
    el = el.parentElement;
  }
  return false;
}

const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'PageUp',
  'PageDown',
  'Home',
  'End',
]);

/** Teclas que andam pelo menu e podem repetir quando seguradas. */
const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

export class Input {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.enabled = true;
    /** @type {PointerInfo|null} */
    this.hover = null;
    /** @type {((p: PointerInfo)=>void)[]} */
    this.downHandlers = [];
    /** @type {((p: PointerInfo)=>void)[]} */
    this.upHandlers = [];
    /** @type {((p: PointerInfo|null)=>void)[]} */
    this.moveHandlers = [];
    /** @type {((code: string)=>void)[]} */
    this.keyHandlers = [];
    /** @type {(()=>void)[]} */
    this.gestureHandlers = [];
    this._activeId = null;
    this._downAt = 0;
    this._downPos = { x: 0, y: 0 };

    canvas.style.touchAction = 'none';

    this._onDown = (/** @type {PointerEvent} */ e) => {
      if (!this.enabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (this._activeId !== null) return;
      this._activeId = e.pointerId;
      const p = this._toLocal(e);
      this._downAt = performance.now();
      this._downPos.x = p.x;
      this._downPos.y = p.y;
      this.hover = p;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignora */
      }
      for (const fn of this.downHandlers) fn(p);
    };

    this._onMove = (/** @type {PointerEvent} */ e) => {
      if (!this.enabled) return;
      const p = this._toLocal(e);
      this.hover = p;
      for (const fn of this.moveHandlers) fn(p);
    };

    this._onUp = (/** @type {PointerEvent} */ e) => {
      this._fireGesture();
      if (!this.enabled) {
        this._activeId = null;
        return;
      }
      if (this._activeId !== e.pointerId) return;
      this._activeId = null;
      const p = this._toLocal(e);
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignora */
      }
      for (const fn of this.upHandlers) fn(p);
    };

    this._onCancel = () => {
      this._activeId = null;
      this.hover = null;
    };

    this._onLeave = () => {
      if (this._activeId === null) {
        this.hover = null;
        for (const fn of this.moveHandlers) fn(null);
      }
    };

    this._onKey = (/** @type {KeyboardEvent} */ e) => {
      if (SCROLL_KEYS.has(e.code)) e.preventDefault();
      // Enter tambem e do jogo: sem isto, um botao focado era acionado duas
      // vezes - pelo navegador e pelo atalho de teclado do main.js.
      if (e.code === 'Enter' || e.code === 'NumpadEnter') e.preventDefault();
      this._fireGesture();
      if (!this.enabled) return;
      // Tecla segurada repete o keydown. Para andar pelo menu isso e bom; para
      // acao nao: Espaco segurado na fase alternava pausa e volta sem parar.
      if (e.repeat && !MOVE_KEYS.has(e.code)) return;
      for (const fn of this.keyHandlers) fn(e.code);
    };

    this._onWheel = (/** @type {WheelEvent} */ e) => {
      // A roda ficava barrada na janela inteira, e no desktop isso prendia o
      // mapa e a loja: sem toque para arrastar, a roda e a unica forma de
      // rolar a fita de fases. Onde ha lista rolavel embaixo do ponteiro a
      // roda passa; no resto - a cena do jogo - continua barrada, senao a
      // pagina inteira anda dentro do frame da Poki.
      if (!e.ctrlKey && rolavelSob(e.target)) return;
      e.preventDefault();
    };

    this._onContext = (/** @type {Event} */ e) => e.preventDefault();

    canvas.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointermove', this._onMove, { passive: true });
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onCancel);
    canvas.addEventListener('pointerleave', this._onLeave);
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('wheel', this._onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this._onContext);
  }

  /**
   * @param {PointerEvent} e
   * @returns {PointerInfo}
   */
  _toLocal(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, id: e.pointerId };
  }

  /** Dispara uma unica vez por gesto: usado para destravar o AudioContext. */
  _fireGesture() {
    if (!this.gestureHandlers.length) return;
    const list = this.gestureHandlers.slice();
    this.gestureHandlers.length = 0;
    for (const fn of list) fn();
  }

  /** @param {()=>void} fn chamado no primeiro gesto valido do usuario */
  onFirstGesture(fn) {
    this.gestureHandlers.push(fn);
  }

  /** @param {(p: PointerInfo)=>void} fn @returns {()=>void} */
  onDown(fn) {
    this.downHandlers.push(fn);
    return () => {
      this.downHandlers = this.downHandlers.filter((h) => h !== fn);
    };
  }

  /** @param {(p: PointerInfo)=>void} fn @returns {()=>void} */
  onUp(fn) {
    this.upHandlers.push(fn);
    return () => {
      this.upHandlers = this.upHandlers.filter((h) => h !== fn);
    };
  }

  /** @param {(p: PointerInfo|null)=>void} fn @returns {()=>void} */
  onMove(fn) {
    this.moveHandlers.push(fn);
    return () => {
      this.moveHandlers = this.moveHandlers.filter((h) => h !== fn);
    };
  }

  /** @param {(code: string)=>void} fn @returns {()=>void} */
  onKey(fn) {
    this.keyHandlers.push(fn);
    return () => {
      this.keyHandlers = this.keyHandlers.filter((h) => h !== fn);
    };
  }

  /** Usado antes de um intervalo comercial. */
  disable() {
    this.enabled = false;
    this._activeId = null;
    this.hover = null;
  }

  enable() {
    this.enabled = true;
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onCancel);
    this.canvas.removeEventListener('pointerleave', this._onLeave);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('wheel', this._onWheel);
    this.canvas.removeEventListener('contextmenu', this._onContext);
  }
}
