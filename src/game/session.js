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

// --- celebracao de fim de fase -------------------------------------------
/** Intervalo entre os primeiros estouros, em segundos. */
const BONUS_FIRST = 0.2;
/** Intervalo dos ultimos: a cascata acelera ate o fim. */
const BONUS_LAST = 0.07;
/** Teto de duracao da cascata inteira. */
const BONUS_MAX_TIME = 3.2;
const BONUS_BURST_RADIUS = 2.4;
const BONUS_BURST_FORCE = 3.2;
/** Tempo depois do ultimo estouro, para os estilhacos cairem. */
const BONUS_OUTRO = 0.9;
/**
 * Com um toque na celebracao, uma peca a cada dois quadros e o assentar final
 * pela metade: trinta pecas estouram em um segundo, e nao em tres.
 */
const BONUS_HURRY = 0.035;
const BONUS_OUTRO_HURRY = 0.45;

// --- combo ----------------------------------------------------------------
/** Teto de espera para fechar uma jogada, mesmo sem tudo parar. */
const COMBO_WINDOW = 1.4;
/** Piso: sem ele, a jogada fechava no mesmo quadro do toque. */
const COMBO_MIN = 0.25;

// --- voltar uma jogada ----------------------------------------------------
/**
 * Quedas seguidas a partir do mesmo ponto ate a volta ir para o comeco da fase.
 *
 * O ponto de volta e o estado de antes do ultimo toque, e nada garante que dali
 * exista saida: um cristal ou uma cera que ja estavam cedendo sob o hexagono
 * voltam com o mesmo relogio, e uma TNT que ja ia detonar detona de novo. Sem
 * esta porta o jogador das fases sem derrota ficaria preso num laco de "Quase!"
 * - o comeco da fase, esse sim, o validador provou que se vence.
 */
const QUEDAS_ATE_O_COMECO = 3;

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
   * @param {(n:number, x:number, y:number)=>void} [opts.onCombo]
   * @param {(done:number, total:number, x?:number, y?:number)=>void} [opts.onBonusPiece]
   * @param {(total:number)=>void} [opts.onBonusDone]
   * @param {number} [opts.autoHintAfter] segundos parado ate a dica acender sozinha; 0 desliga
   * @param {()=>void} [opts.onAutoHint]
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

    // Dica automatica. Desligada por padrao: o validador monta a mesma Session
    // e nao pode ganhar dica de ninguem. Quem liga e main.js, por fase.
    this.autoHintAfter = opts.autoHintAfter || 0;
    this.onAutoHint = opts.onAutoHint || null;
    /** Segundos sem toque e sem dica acesa. */
    this.idle = 0;

    // Celebracao de fim de fase.
    this.bonus = false;
    /** @type {*[]} */
    this.bonusQueue = [];
    this.bonusTotal = 0;
    this.bonusDone = 0;
    this.bonusTimer = 0;
    this.bonusElapsed = 0;
    this.bonusOutro = BONUS_OUTRO;
    this.bonusHurry = false;

    // --- combo -----------------------------------------------------------
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

    // --- voltar uma jogada ------------------------------------------------
    /**
     * Estado de antes do ultimo toque dado com o hexagono parado. E dele que
     * sai a volta automatica das fases de ensino e o video de "voltar uma
     * jogada" do cartao de derrota.
     * @type {{world:*}|null}
     */
    this.checkpoint = null;
    /** Perder volta uma jogada em vez de encerrar. Quem liga e main.js. */
    this.rewindOnLoss = false;
    /** @type {(()=>void)|null} */
    this.onRewind = opts.onRewind || null;
    /** Quantas vezes a fase voltou uma jogada. */
    this.rewinds = 0;
    /** O estado de antes do primeiro toque: a volta de quem ficou sem saida. */
    this.inicio = null;
    /** Quedas seguidas desde o mesmo ponto de volta (QUEDAS_ATE_O_COMECO). */
    this.quedasNoMesmoPonto = 0;
    /** Toques desde a ultima volta; e com eles que se sabe se o ponto andou. */
    this._toquesDesdeAVolta = 0;
  }

  /**
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
   * Fecha a jogada quando a torre para - ou quando a espera estoura.
   *
   * Esperar o repouso, e nao o quadro seguinte, e o que faz o combo enxergar
   * o desabamento inteiro que o toque provocou.
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
    this.bonusHurry = false;
    this.bonus = vivas.length > 0;
    return this.bonusTotal;
  }

  /**
   * O jogador tocou durante a celebracao: a cascata aperta o passo. Nao pula a
   * contagem - cada peca intacta ainda estoura e ainda vale moeda -, so tira a
   * espera entre uma e outra.
   */
  hurryBonus() {
    if (!this.bonus) return;
    this.bonusHurry = true;
    this.bonusTimer = Math.min(this.bonusTimer, BONUS_HURRY);
    this.bonusOutro = Math.min(this.bonusOutro, BONUS_OUTRO_HURRY);
  }

  /** @param {number} dt */
  _stepBonus(dt) {
    this.elapsed += dt;
    this.bonusElapsed += dt;
    this.bonusTimer -= dt;
    this.world.step(dt);
    if (this.bonusTimer > 0) return;

    if (this.bonusQueue.length === 0) {
      // Acabou a fila, mas a cena nao: deixa os estilhacos cairem antes de
      // entregar a tela ao cartao de vitoria.
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
    this.bonusTimer = this.bonusHurry ? BONUS_HURRY : Math.max(BONUS_LAST, Math.min(ideal, cabe));
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
    this.idle = 0;
    // Abre a jogada ANTES de destruir: a propria peca tocada e a primeira da
    // conta, e o que a queda dela derrubar entra na mesma.
    this.comboOpen = true;
    this.comboCount = 0;
    this.comboTimer = 0;
    // O ponto de volta so anda com o hexagono parado. Um toque dado com ele ja
    // tombando levaria a volta para dentro da queda, e o jogador cairia de novo
    // sem poder fazer nada; entao ali a volta fica no toque anterior.
    this._toquesDesdeAVolta++;
    if (!this.checkpoint || this.world.hexAtRest()) {
      this.checkpoint = { world: this.world.snapshot() };
      if (!this.inicio) this.inicio = this.checkpoint;
      // O primeiro toque depois de uma volta sai do proprio ponto de volta; so
      // o segundo prova que o anterior nao derrubou nada e que o ponto andou.
      if (this._toquesDesdeAVolta > 1) this.quedasNoMesmoPonto = 0;
    }
    this.world.destroyPiece(piece, 'tap');
    return { piece, ok: true };
  }

  /**
   * Destaca uma peca segura. Usado pelo video recompensado de dica e pela dica
   * automatica.
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
    this._updateAutoHint(dt);

    while (this.starsShown < this.world.starsCrossed) {
      this.starsShown++;
      if (this.onStar) this.onStar(this.starsShown);
    }

    const verdict = this.world.evaluate();
    const perdeu = verdict === 'lost' || (verdict === 'stuck' && this.world.starsCrossed === 0);
    if (perdeu && this.rewindOnLoss && this.rewind()) {
      if (this.onRewind) this.onRewind();
      return;
    }
    if (verdict !== 'playing') {
      this.state = verdict;
      this.endedAt = this.elapsed;
      if (this.onEnd) this.onEnd(this.state);
    }
  }

  /**
   * Acende a dica sozinha quando o jogador fica parado.
   *
   * Na 1.0.3 a unica dica era um video depois de duas derrotas, e ninguem a
   * pediu: zero cliques em 135 partidas que a viram. Quem trava sem saber o que
   * tocar nao pede ajuda - vai embora.
   *
   * A dica espera a torre parar: o solucionador escolheria a peca sobre uma
   * torre que ainda nao assentou. Sobre o pedestal que balanca as pecas nunca
   * repousam, e ali ela vem tres segundos depois em vez de nunca.
   * @param {number} dt
   */
  _updateAutoHint(dt) {
    if (this.autoHintAfter <= 0 || this.hintPiece) return;
    this.idle += dt;
    if (this.idle < this.autoHintAfter) return;
    if (this.idle < this.autoHintAfter + 3 && !this.world.everythingAtRest()) return;
    this.idle = 0;
    if (this.requestHint() && this.onAutoHint) this.onAutoHint();
  }

  /**
   * Volta a fase ao ponto de antes do ultimo toque dado com o hexagono parado.
   *
   * Serve a dois lados. Nas fases de ensino, perder nao existe: a Poki cita o
   * Subway Surfers - "players can't die during onboarding; they just try again
   * until it clicks" -, e na 1.0.3 de 18% a 28% dos jogadores perdiam cada uma
   * das primeiras fases. E no cartao de derrota ela e o video recompensado de
   * "voltar uma jogada", o "revive" que a Poki poe no topo da lista de ajuda.
   *
   * O toque que derrubou tudo continua contado: voltar desfaz a queda, nao a
   * jogada. As estrelas que a queda tinha cruzado voltam a apagar.
   *
   * Da `QUEDAS_ATE_O_COMECO`-esima queda seguida do mesmo ponto em diante a
   * volta vai para o comeco da fase, e o comeco vira o novo ponto de volta.
   * @returns {boolean} false se ainda nao ha ponto de volta
   */
  rewind() {
    if (!this.checkpoint || this.bonus) return false;
    this.quedasNoMesmoPonto++;
    if (this.quedasNoMesmoPonto >= QUEDAS_ATE_O_COMECO && this.inicio) {
      this.checkpoint = this.inicio;
      this.quedasNoMesmoPonto = 0;
    }
    this._toquesDesdeAVolta = 0;
    this.world.restore(this.checkpoint.world);
    this.state = 'playing';
    this.endedAt = 0;
    this.starsShown = Math.min(this.starsShown, this.world.starsCrossed);
    this.comboOpen = false;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.hintPiece = null;
    this.hintTimer = 0;
    this.idle = 0;
    this.rewinds++;
    return true;
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
