/**
 * Junta tudo que faz uma fase rodar: viewport, entrada, laco, fisica,
 * particulas, camera e desenho. Os prototipos e o jogo final usam esta mesma
 * classe, entao o que se ve num prototipo e literalmente o jogo.
 */

import { Viewport, isTouchDevice } from '../core/viewport.js';
import { Input } from '../core/input.js';
import { Loop } from '../core/loop.js';
import { Camera } from '../render/camera.js';
import { Renderer } from '../render/renderer.js';
import { SpriteCache } from '../render/sprites.js';
import { Particles } from '../render/particles.js';
import { theme as getTheme } from '../render/themes.js';
import { material as getMaterial } from '../physics/materials.js';
import { audio } from '../core/audio.js';
import { Tweens } from '../core/tween.js';
import { Rng } from '../core/rng.js';

export class GameScene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} [opts]
   * @param {number} [opts.topInset]
   * @param {number} [opts.bottomInset]
   * @param {(dt:number)=>void} [opts.onUpdate]
   * @param {(ctx:CanvasRenderingContext2D)=>void} [opts.onOverlay]
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.viewport = new Viewport(canvas);
    this.input = new Input(canvas);
    this.camera = new Camera();
    this.renderer = new Renderer(this.viewport, this.camera);
    this.particles = new Particles();
    this.tweens = new Tweens();
    this.rng = new Rng(20260918);
    this.touch = isTouchDevice();
    this.topInset = opts.topInset || 96;
    this.bottomInset = opts.bottomInset || 24;
    this.onUpdate = opts.onUpdate || null;
    this.onOverlay = opts.onOverlay || null;

    /** @type {import('./session.js').Session|null} */
    this.session = null;
    /** @type {import('../render/themes.js').Theme} */
    this.theme = getTheme('neon');
    /** @type {SpriteCache|null} */
    this.sprites = null;
    this.skin = { id: 'classic' };
    this.time = 0;
    /** @type {*|null} */
    this.hovered = null;
    this.quality = 'auto';

    this.loop = new Loop(
      (dt) => this.step(dt),
      (alpha, frameDt) => this.render(frameDt),
    );

    this.viewport.onResize(() => this.refit());
    this.input.onDown((p) => this.handleDown(p));
    this.input.onMove((p) => this.handleMove(p));
    this.input.onFirstGesture(() => audio.unlock());
  }

  /**
   * @param {import('./session.js').Session} session
   * @param {string} themeId
   * @param {*} [skin]
   */
  load(session, themeId, skin) {
    if (this.session) this.session.destroy();
    this.session = session;
    this.theme = getTheme(themeId);
    if (skin) this.skin = skin;
    this.particles.clear();
    this.tweens.clear();
    this.hovered = null;
    this.time = 0;
    this.particles.gravity = -10;
    this.refit();

    const originalDestroy = session.world.onDestroy;
    session.world.onDestroy = (piece, cause) => {
      this.spawnDebris(piece, cause);
      if (originalDestroy) originalDestroy(piece, cause);
    };
    const originalImpact = session.world.onImpact;
    session.world.onImpact = (strength, mat, x, y) => {
      audio.impact(strength, mat);
      if (strength > 0.45) this.camera.addTrauma(strength * 0.22);
      if (strength > 0.35) {
        this.particles.spark(x, y, getMaterial(mat).color, 2, () => this.rng.next());
      }
      if (originalImpact) originalImpact(strength, mat, x, y);
    };
  }

  refit() {
    if (!this.session) return;
    const world = this.session.world;
    // Em paisagem baixa a HUD come uma fatia bem maior da altura util, entao
    // as margens reservadas encolhem junto.
    const short = this.viewport.height < 640 && this.viewport.width > this.viewport.height;
    const top = short ? Math.min(this.topInset, 72) : this.topInset;
    const bottom = short ? Math.max(this.bottomInset, 58) : this.bottomInset;
    this.camera.fit({
      viewW: this.viewport.width,
      viewH: this.viewport.height,
      towerWidth: world.towerWidth,
      towerHeight: world.towerHeight,
      pedestalHalf: world.pedestalHalfWidth,
      topInset: top,
      bottomInset: bottom,
    });
    const dpr = this.quality === 'low' ? 1 : this.viewport.dpr;
    this.sprites = new SpriteCache(this.theme, this.camera.pxPerMeter, dpr);
    this.renderer.bgCanvas = null;
  }

  /**
   * @param {*} piece
   * @param {string} cause
   */
  spawnDebris(piece, cause) {
    if (cause === 'cleanup') return;
    const mat = getMaterial(piece.material);
    const style = this.theme.materials[piece.material];
    const color = style ? style.stroke : mat.color;
    const pos = piece.body.getPosition();
    const vel = piece.body.getLinearVelocity();
    const dense = this.quality === 'low' ? 2 : 3;
    this.particles.burst({
      cells: piece.cells,
      x: pos.x,
      y: pos.y,
      angle: piece.body.getAngle(),
      cw: piece.cw,
      ch: piece.ch,
      color,
      vx: vel.x,
      vy: vel.y,
      density: cause === 'explosion' || cause === 'blast' ? dense + 2 : cause === 'melt' ? 1 : dense,
      // Derretimento escorre; nao voa. Os dois parametros existem so para este
      // caso - todos os outros usam os valores de sempre.
      lift: cause === 'melt' ? -0.5 : undefined,
      spread: cause === 'melt' ? 1.2 : undefined,
      rand: () => this.rng.next(),
    });
    audio.breakPiece(piece.material, Math.min(1, piece.area / 6));
    if (cause === 'blast') {
      this.camera.addTrauma(0.5);
      this.particles.spark(pos.x, pos.y, '#ffd24a', 10, () => this.rng.next());
    } else if (cause === 'explosion') this.camera.addTrauma(0.45);
    else if (cause === 'crack') this.camera.addTrauma(0.2);
    else if (cause === 'shatter') this.camera.addTrauma(0.16);
    else if (cause === 'melt') this.camera.addTrauma(0.04);
    else this.camera.addTrauma(0.09);
  }

  /** @param {{x:number,y:number}} p */
  handleDown(p) {
    if (!this.session) return;
    const [wx, wy] = this.camera.toWorld(p.x, p.y);
    const finger = this.touch ? 0.32 : 0;
    const result = this.session.tap(wx, wy, finger);
    if (!result) return;
    if (result.ok) {
      audio.click();
    } else {
      audio.denied();
      this.camera.addTrauma(0.06);
    }
  }

  /** @param {{x:number,y:number}|null} p */
  handleMove(p) {
    if (!this.session || !p || this.touch) {
      this.hovered = null;
      return;
    }
    const [wx, wy] = this.camera.toWorld(p.x, p.y);
    this.hovered = this.session.world.pickAt(wx, wy, 0);
  }

  /** @param {number} dt */
  step(dt) {
    this.time += dt;
    if (this.session) {
      this.session.step(dt);
      this.camera.follow(this.session.world.hexTransform().y, dt);
    }
    this.particles.update(dt);
    this.tweens.update(dt);
    this.camera.update(dt, this.time);
    audio.updateMusic();
    if (this.onUpdate) this.onUpdate(dt);
  }

  render() {
    const ctx = this.viewport.begin();
    if (this.session && this.sprites) {
      this.renderer.draw(ctx, {
        session: this.session,
        theme: this.theme,
        sprites: this.sprites,
        particles: this.particles,
        skin: this.skin,
        time: this.time,
        hovered: this.hovered,
      });
    }
    if (this.onOverlay) this.onOverlay(ctx);
  }

  start() {
    this.loop.start();
  }

  stop() {
    this.loop.stop();
  }

  destroy() {
    this.loop.destroy();
    this.input.destroy();
    this.viewport.destroy();
    if (this.session) this.session.destroy();
  }
}
