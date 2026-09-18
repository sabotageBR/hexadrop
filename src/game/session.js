/**
 * Uma partida: regras do jogo em volta do mundo fisico.
 *
 * Nao desenha nada e nao fala com o DOM. O renderizador le o estado daqui, e
 * os protótipos e o jogo final compartilham exatamente esta logica.
 */

import { PhysicsWorld } from '../physics/world.js';
import { material as getMaterial } from '../physics/materials.js';
import { generateLayout, levelConfig } from './levelgen.js';
import { upgradeEffects } from './content.js';
import { Rng } from '../core/rng.js';
import { choosePiece } from './solver.js';

/**
 * @typedef {'ready'|'playing'|'won'|'lost'|'stuck'} SessionState
 */

export class Session {
  /**
   * @param {object} opts
   * @param {import('../physics/world.js').LevelLayout} opts.layout
   * @param {Record<string, number>} [opts.upgrades]
   * @param {number} [opts.seed]
   * @param {(piece:*, cause:string)=>void} [opts.onDestroy]
   * @param {(strength:number, material:string, x:number, y:number)=>void} [opts.onImpact]
   * @param {(index:number)=>void} [opts.onStar]
   * @param {(state:SessionState)=>void} [opts.onEnd]
   * @param {()=>void} [opts.onFirstTap]
   */
  constructor(opts) {
    this.layout = opts.layout;
    this.rng = new Rng(opts.seed || 1);
    const eff = upgradeEffects(opts.upgrades || {});
    this.onStar = opts.onStar || null;
    this.onEnd = opts.onEnd || null;
    this.onFirstTap = opts.onFirstTap || null;

    this.world = new PhysicsWorld({
      hexAngularDamping: eff.angularDamping,
      hexFrictionBonus: eff.frictionBonus,
      onDestroy: opts.onDestroy,
      onImpact: opts.onImpact,
    });
    this.world.build(this.layout);

    /** @type {SessionState} */
    this.state = 'ready';
    this.taps = 0;
    this.starsShown = 0;
    this.elapsed = 0;
    this.endedAt = 0;
    /** @type {*|null} */
    this.hintPiece = null;
    this.hintTimer = 0;
    this.paused = false;
  }

  /** @returns {number} estrelas conquistadas ate agora */
  get stars() {
    return this.world.starsCrossed;
  }

  /** @returns {boolean} */
  get finished() {
    return this.state === 'won' || this.state === 'lost' || this.state === 'stuck';
  }

  /**
   * Converte um toque em remocao de peca.
   * @param {number} worldX
   * @param {number} worldY
   * @param {number} [fingerRadius] em metros, folga para o dedo no celular
   * @returns {{piece:*, ok:boolean, reason?:string}|null}
   */
  tap(worldX, worldY, fingerRadius = 0) {
    if (this.finished || this.paused) return null;
    const piece = this.world.pickAt(worldX, worldY, fingerRadius);
    if (!piece) return null;
    const mat = getMaterial(piece.material);
    if (!mat.destructible) return { piece, ok: false, reason: 'indestructible' };

    if (this.state === 'ready') {
      this.state = 'playing';
      if (this.onFirstTap) this.onFirstTap();
    }
    this.taps++;
    this.hintPiece = null;
    this.world.destroyPiece(piece, 'tap');
    return { piece, ok: true };
  }

  /**
   * Destaca uma peca segura. Usado pelo video recompensado de dica.
   * @returns {*|null}
   */
  requestHint() {
    if (this.finished) return null;
    const piece = choosePiece(this.world, 'plan', this.rng);
    this.hintPiece = piece;
    this.hintTimer = 6;
    return piece;
  }

  /** @param {number} dt */
  step(dt) {
    if (this.paused) return;
    if (this.finished) {
      // Deixa a cena assentar depois do fim, para a animacao nao congelar.
      if (this.elapsed - this.endedAt < 2.5) this.world.step(dt);
      this.elapsed += dt;
      return;
    }
    this.elapsed += dt;
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hintPiece = null;
    }
    if (this.hintPiece && !this.hintPiece.alive) this.hintPiece = null;

    this.world.step(dt);

    while (this.starsShown < this.world.starsCrossed) {
      this.starsShown++;
      if (this.onStar) this.onStar(this.starsShown);
    }

    const verdict = this.world.evaluate();
    if (verdict !== 'playing') {
      this.state = verdict;
      this.endedAt = this.elapsed;
      if (this.onEnd) this.onEnd(this.state);
    }
  }

  destroy() {
    this.world.destroy();
  }
}

/**
 * Monta uma sessao a partir do numero da fase e da variante escolhida.
 * @param {object} opts
 * @param {number} opts.levelIndex 0 a 99
 * @param {number} opts.soften degrau gravado em levels.gen.js
 * @param {number} opts.seed seed da variante
 * @param {Record<string, number>} [opts.upgrades]
 * @param {*} [opts.hooks]
 * @returns {Session}
 */
export function createSession(opts) {
  const config = levelConfig(opts.levelIndex, opts.soften);
  const layout = generateLayout(config, opts.seed);
  return new Session({
    layout,
    upgrades: opts.upgrades,
    seed: opts.seed,
    ...(opts.hooks || {}),
  });
}
