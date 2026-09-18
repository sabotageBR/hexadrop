/**
 * Laco principal com passo fixo.
 * A fisica nunca recebe o delta do requestAnimationFrame direto: telas de
 * 120 Hz ou quadros perdidos mudariam o resultado da simulacao.
 */

export const FIXED_DT = 1 / 60;
const MAX_FRAME = 0.1;
const MAX_STEPS = 4;

export class Loop {
  /**
   * @param {(dt:number)=>void} step chamado com passo fixo
   * @param {(alpha:number, frameDt:number)=>void} render alpha e a interpolacao
   */
  constructor(step, render) {
    this.step = step;
    this.render = render;
    this.running = false;
    this.accumulator = 0;
    this.last = 0;
    this.frameId = 0;
    this.fps = 60;
    this._fpsAccum = 0;
    this._fpsFrames = 0;
    this._tick = this._tick.bind(this);
    this._onVisibility = () => {
      if (document.hidden) {
        this.pause();
      } else if (this._wantRunning) {
        this.start();
      }
    };
    this._wantRunning = false;
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  start() {
    this._wantRunning = true;
    if (this.running || document.hidden) return;
    this.running = true;
    this.last = performance.now();
    this.accumulator = 0;
    this.frameId = requestAnimationFrame(this._tick);
  }

  /** Para o laco sem perder a intencao de estar rodando. */
  pause() {
    this.running = false;
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  stop() {
    this._wantRunning = false;
    this.pause();
  }

  /** @param {number} now */
  _tick(now) {
    if (!this.running) return;
    this.frameId = requestAnimationFrame(this._tick);
    let frameTime = (now - this.last) / 1000;
    this.last = now;
    if (!(frameTime > 0)) frameTime = 0;
    if (frameTime > MAX_FRAME) frameTime = MAX_FRAME;

    this._fpsAccum += frameTime;
    this._fpsFrames++;
    if (this._fpsAccum >= 0.5) {
      this.fps = this._fpsFrames / this._fpsAccum;
      this._fpsAccum = 0;
      this._fpsFrames = 0;
    }

    this.accumulator += frameTime;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_STEPS) this.accumulator = 0;

    this.render(this.accumulator / FIXED_DT, frameTime);
  }

  destroy() {
    this.stop();
    document.removeEventListener('visibilitychange', this._onVisibility);
  }
}
