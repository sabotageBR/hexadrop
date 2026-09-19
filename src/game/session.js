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

/** Intervalo entre os estouros da celebracao, do primeiro ao ultimo. */
const BONUS_FIRST = 0.2;
const BONUS_LAST = 0.07;
/** Teto de duracao da celebracao inteira, em segundos. */
const BONUS_MAX_TIME = 3.2;
/** Sopro que cada peca contada da na vizinhanca. */
const BONUS_BURST_RADIUS = 2.4;
const BONUS_BURST_FORCE = 3.2;
/**
 * Respiro depois do ultimo estouro, antes de o cartao de vitoria entrar.
 *
 * Sem ele o cartao subia no mesmo quadro da ultima explosao e cortava
 * justamente o fim da comemoracao - os estilhacos no ar e a nota que resolve.
 */
const BONUS_OUTRO = 0.9;
/** Tempo maximo que uma jogada fica aberta esperando a cena parar. */
const COMBO_WINDOW = 1.4;
/** Antes disto a cena nem comecou a reagir ao toque; repouso aqui nao vale. */
const COMBO_MIN = 0.25;

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
   * @param {(size:number, x:number, y:number)=>void} [opts.onCombo]
   * @param {(done:number, total:number, x:number, y:number)=>void} [opts.onBonusPiece]
   * @param {(total:number)=>void} [opts.onBonusDone]
   */
  constructor(opts) {
    this.layout = opts.layout;
    this.rng = new Rng(opts.seed || 1);
    const eff = upgradeEffects(opts.upgrades || {});
    this.onStar = opts.onStar || null;
    this.onEnd = opts.onEnd || null;
    this.onFirstTap = opts.onFirstTap || null;
    this.onCombo = opts.onCombo || null;
    this.onBonusPiece = opts.onBonusPiece || null;
    this.onBonusDone = opts.onBonusDone || null;
    /** Hook externo de destruicao, chamado depois da contagem de combo. */
    this._destroyHook = opts.onDestroy || null;

    this.world = new PhysicsWorld({
      hexAngularDamping: eff.angularDamping,
      hexFrictionBonus: eff.frictionBonus,
      // A sessao entra no meio do caminho para contar o combo. GameScene.load()
      // embrulha ESTA funcao depois, entao a contagem sobrevive ao embrulho.
      onDestroy: (piece, cause) => this._onDestroy(piece, cause),
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

    // --- combo -------------------------------------------------------------
    /** Jogada em curso: tudo que quebrar ate a cena parar conta junto. */
    this.comboOpen = false;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboX = 0;
    this.comboY = 0;
    /** Soma de n^2 de cada combo da fase. Vira moedas no fim. */
    this.comboScore = 0;
    /** Soma de n de cada combo da fase. Vira XP no fim. */
    this.comboPieces = 0;
    /** Maior combo da fase, so para exibir. */
    this.bestCombo = 0;

    // --- celebracao de fim de fase ----------------------------------------
    this.bonus = false;
    /** @type {*[]} */
    this.bonusQueue = [];
    this.bonusTotal = 0;
    this.bonusDone = 0;
    this.bonusTimer = 0;
    this.bonusElapsed = 0;
    this.bonusOutro = BONUS_OUTRO;
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
   * Toda peca destruida passa por aqui antes do hook externo.
   * @param {*} piece
   * @param {string} cause
   */
  _onDestroy(piece, cause) {
    // 'cleanup' e peca que caiu para fora da tela e 'bonus' e a celebracao:
    // nenhum dos dois e merito do jogador, entao nao entram no combo.
    if (this.comboOpen && cause !== 'cleanup' && cause !== 'bonus') {
      this.comboCount++;
      if (piece.body) {
        const pos = piece.body.getPosition();
        this.comboX = pos.x;
        this.comboY = pos.y;
      }
    }
    if (this._destroyHook) this._destroyHook(piece, cause);
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
    // Abre a jogada ANTES de destruir: a propria peca tocada e a primeira da
    // conta, e o que a queda dela derrubar entra na mesma.
    this.comboOpen = true;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.world.destroyPiece(piece, 'tap');
    return { piece, ok: true };
  }

  /**
   * Destaca uma peca segura. Usado pelo video recompensado de dica.
   * @returns {*|null}
   */
  requestHint() {
    if (this.finished) return null;
    // O solucionador roda sobre o mundo REAL: cada ramo que ele experimenta
    // destroi pecas de verdade e desfaz depois com snapshot/restore. Os
    // callbacks precisam ficar mudos nesse intervalo, senao pedir dica espalha
    // estilhacos e toca a quebra de pecas que continuam de pe - e, desde que
    // existe combo, soma uma cadeia enorme que o jogador nunca fez.
    const destroy = this.world.onDestroy;
    const impact = this.world.onImpact;
    this.world.onDestroy = null;
    this.world.onImpact = null;
    try {
      this.hintPiece = choosePiece(this.world, 'plan', this.rng);
      this.hintTimer = 6;
      return this.hintPiece;
    } finally {
      this.world.onDestroy = destroy;
      this.world.onImpact = impact;
    }
  }

  /**
   * Fecha a jogada quando a cena para de reagir ao toque.
   *
   * Esperar o repouso, e nao o quadro seguinte, e o que faz o combo enxergar
   * desabamento: uma torre que cai leva bem mais que um passo de fisica, e o
   * que a queda quebra e consequencia do mesmo toque.
   *
   * @param {number} dt
   */
  _updateCombo(dt) {
    if (!this.comboOpen) return;
    this.comboTimer += dt;
    const parou = this.comboTimer >= COMBO_MIN && this.world.everythingAtRest();
    if (!parou && this.comboTimer < COMBO_WINDOW) return;
    this.comboOpen = false;
    const n = this.comboCount;
    this.comboCount = 0;
    if (n < 2) return;
    this.comboScore += n * n;
    this.comboPieces += n;
    if (n > this.bestCombo) this.bestCombo = n;
    if (this.onCombo) this.onCombo(n, this.comboX, this.comboY);
  }

  /**
   * Celebracao de fim de fase: as pecas que sobraram estouram uma a uma.
   *
   * So a vitoria chama isto. O estado ('won' ou 'stuck') fica congelado o tempo
   * todo - evaluate() nao roda durante a cascata, senao esvaziar a torre
   * dispararia 'stuck' por cima do resultado que o jogador acabou de conquistar.
   *
   * @returns {number} quantas pecas vao estourar
   */
  startBonus() {
    if (this.bonus) return this.bonusTotal;
    const vivas = this.world.alivePieces().filter((p) => getMaterial(p.material).destructible);
    // De cima para baixo: a torre desmonta em cascata, e o hexagono ja pousado
    // nao leva o primeiro estouro na cara.
    vivas.sort((a, b) => b.body.getPosition().y - a.body.getPosition().y);
    this.bonusQueue = vivas;
    this.bonusTotal = vivas.length;
    this.bonusDone = 0;
    this.bonusTimer = 0;
    this.bonusElapsed = 0;
    this.bonusOutro = BONUS_OUTRO;
    this.bonus = vivas.length > 0;
    return this.bonusTotal;
  }

  /** @param {number} dt */
  _stepBonus(dt) {
    this.elapsed += dt;
    this.bonusElapsed += dt;
    this.bonusTimer -= dt;
    this.world.step(dt);
    if (this.bonusTimer > 0) return;

    if (this.bonusQueue.length === 0) {
      // Acabou a fila, mas a cena nao: deixa os estilhacos cairem e a ultima
      // nota resolver antes de entregar a tela ao cartao de vitoria.
      this.bonusOutro -= dt;
      if (this.bonusOutro > 0) return;
      this.bonus = false;
      if (this.onBonusDone) this.onBonusDone(this.bonusTotal);
      return;
    }
    const piece = this.bonusQueue.shift();
    // Ja foi levada por um estouro anterior (cadeia de TNT, por exemplo): conta
    // na contagem, mas nao gasta um intervalo so para ela.
    if (!piece.alive) {
      this.bonusDone++;
      // Sem posicao: ela ja estourou junto com outra, e fingir um ponto faria
      // o texto flutuante nascer num canto qualquer da tela.
      if (this.onBonusPiece) this.onBonusPiece(this.bonusDone, this.bonusTotal);
      return;
    }

    const pos = piece.body.getPosition();
    const px = pos.x;
    const py = pos.y;
    this.world.destroyPiece(piece, 'bonus');
    this.world.burstAt(px, py, BONUS_BURST_RADIUS, BONUS_BURST_FORCE);
    this.bonusDone++;
    if (this.onBonusPiece) this.onBonusPiece(this.bonusDone, this.bonusTotal, px, py);

    // O ritmo acelera de duas formas: pela posicao na fila e pelo tempo que
    // ainda resta. Com trinta pecas sobrando a celebracao aperta o passo em vez
    // de arrastar por seis segundos.
    const restantes = this.bonusQueue.length;
    const fracao = this.bonusTotal > 0 ? this.bonusDone / this.bonusTotal : 1;
    const ideal = BONUS_FIRST + (BONUS_LAST - BONUS_FIRST) * fracao;
    const sobra = Math.max(0, BONUS_MAX_TIME - this.bonusElapsed);
    const cabe = restantes > 0 ? sobra / restantes : ideal;
    this.bonusTimer = Math.max(BONUS_LAST, Math.min(ideal, cabe));
  }

  /** @param {number} dt */
  step(dt) {
    if (this.paused) return;
    if (this.bonus) {
      this._stepBonus(dt);
      return;
    }
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
    this._updateCombo(dt);

    while (this.starsShown < this.world.starsCrossed) {
      this.starsShown++;
      if (this.onStar) this.onStar(this.starsShown);
    }

    const verdict = this.world.evaluate();
    if (verdict !== 'playing') {
      this.state = verdict;
      this.endedAt = this.elapsed;
      // A jogada que encerrou a fase ainda vale combo: fecha agora, para o
      // premio nao se perder junto com o fim da partida.
      if (this.comboOpen) {
        this.comboTimer = COMBO_WINDOW;
        this._updateCombo(0);
      }
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
