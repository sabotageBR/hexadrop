/**
 * A plataforma da CrazyGames, no lugar de src/poki.js.
 *
 * main.js importa `@plataforma`, e o alias de vite.config.js aponta para ca no
 * build `crazy`. A interface e a mesma do wrapper da Poki - init,
 * gameLoadingFinished, gameplayStart/Stop, commercialBreak, rewardedBreak,
 * measure, captureError, movePill, onAdStart/onAdEnd, inBreak, ready -, mais o
 * que a CrazyGames pede e a Poki nao:
 *
 * - **o silencio so quando o video comeca** (`adStarted`), e nao no pedido:
 *   "Don't mute when the ad is only requested, since no ad may be available".
 *   O jogo para no pedido (`onAdStart`, com `silencioNoVideo` dizendo a main.js
 *   que o som fica para `onAdPlay`);
 * - **o mudo do site** (`settings.muteAudio`), que vence o botao de som do jogo
 *   (`onSilencio`);
 * - **o progresso da campanha** (`progresso`, `reportGameCompletedPercentage`),
 *   o contexto da fase para o feedback dos jogadores (`setGameContext`) e a
 *   comemoracao do site (`happytime`) so no fim da campanha e nos marcos de
 *   jogadas perfeitas - "don't call it for routine events".
 *
 * A frequencia dos anuncios e do SDK deles (no maximo um midgame a cada 3 min,
 * contando o recompensado), entao nao ha cooldown aqui. O que fica aqui e de
 * onde o intervalo NAO sai: nem ao `retomar` da pausa, que e navegacao, nem no
 * `repetir` do cartao de derrota, que oferece ao lado o video de voltar uma
 * jogada - "a midgame ad and a 'watch rewarded to keep playing' offer can't
 * both appear between the same two levels".
 *
 * O jogo tem que se comportar igual sem SDK (bloqueador de anuncios, outro
 * dominio): toda chamada passa pela guarda de existencia, e o pedido de video
 * sem resposta tem prazo.
 */

import { LEVEL_COUNT } from '../game/levelgen.js';
import { iniciarSdk } from './sdk.js';

/** Pedido de video sem `adStarted` nem `adError`: o jogo nao pode ficar parado. */
const PEDIDO_TIMEOUT = 15000;
/** Video que comecou e nunca terminou: a rede de seguranca, longa de proposito. */
const VIDEO_TIMEOUT = 180000;

class Crazy {
  constructor() {
    this.ready = false;
    this.loadingFinished = false;
    /** true entre gameplayStart e gameplayStop */
    this.inGameplay = false;
    /** true durante um pedido de video, quando nenhum evento pode ser disparado */
    this.inBreak = false;
    /** @type {'desktop'|'tablet'|'mobile'|null} */
    this.device = null;
    /** O som fica para `onAdPlay`: main.js nao silencia no `onAdStart`. */
    this.silencioNoVideo = true;
    /** @type {*} */
    this._sdk = null;
    /**
     * Ligado no primeiro `adsDisabledBasicLaunch`: no Basic Launch a CrazyGames
     * desliga todo anuncio, e pedir de novo so faria a tela parar a toa.
     */
    this._semAnuncios = false;
    /** Ultima porcentagem informada; -1 antes da primeira. */
    this._progresso = -1;
    /** @type {null|(()=>void)} */
    this.onAdStart = null;
    /** @type {null|(()=>void)} */
    this.onAdEnd = null;
    /** @type {null|(()=>void)} o video comecou de fato: hora de silenciar */
    this.onAdPlay = null;
    /** @type {null|((mudo:boolean)=>void)} */
    this.onSilencio = null;
    /** @type {null|((on:boolean)=>void)} */
    this.onAdLoading = null;
    /** @type {null|(()=>void)} */
    this.onSemVideo = null;
    // O que so o app tem (src/app/nativo.js): aqui nunca dispara.
    this.loja = null;
    this.privacidade = null;
    /** @type {null|(()=>void)} */
    this.onVoltar = null;
    /** @type {null|(()=>void)} */
    this.onSegundoPlano = null;
    /** @type {null|(()=>void)} */
    this.onPrimeiroPlano = null;
  }

  /**
   * @param {string} modulo
   * @param {string} metodo
   * @param {...*} args
   */
  _chama(modulo, metodo, ...args) {
    const sdk = this._sdk;
    if (!sdk || !sdk[modulo] || typeof sdk[modulo][metodo] !== 'function') return;
    try {
      sdk[modulo][metodo](...args);
    } catch {
      /* ignora */
    }
  }

  /** @returns {Promise<void>} resolve mesmo quando o SDK nao carrega */
  async init() {
    const sdk = await iniciarSdk();
    if (!sdk) return;
    this._sdk = sdk;
    this.ready = true;
    try {
      const tipo = sdk.user && sdk.user.systemInfo && sdk.user.systemInfo.device && sdk.user.systemInfo.device.type;
      if (tipo === 'desktop' || tipo === 'tablet' || tipo === 'mobile') this.device = tipo;
    } catch {
      /* ignora */
    }
    try {
      const aplica = (/** @type {*} */ s) => {
        if (this.onSilencio) this.onSilencio(!!(s && s.muteAudio));
      };
      if (sdk.game.settings && sdk.game.settings.muteAudio) aplica(sdk.game.settings);
      sdk.game.addSettingsChangeListener(aplica);
    } catch {
      /* ignora */
    }
  }

  /** Dispara uma unica vez, quando o jogador ja pode interagir. */
  gameLoadingFinished() {
    if (this.loadingFinished) return;
    this.loadingFinished = true;
    this._chama('game', 'loadingStop');
  }

  /** So no primeiro input real do jogador, nunca no carregamento. */
  gameplayStart() {
    if (this.inGameplay || this.inBreak) return;
    this.inGameplay = true;
    this._chama('game', 'gameplayStart');
  }

  /** Em qualquer interrupcao: pausa, menu, fim de fase, derrota. */
  gameplayStop() {
    if (!this.inGameplay) return;
    this.inGameplay = false;
    this._chama('game', 'gameplayStop');
  }

  /**
   * Pede um video e espera ele acabar, falhar ou estourar o prazo.
   * @param {'midgame'|'rewarded'} tipo
   * @returns {Promise<boolean>} true so com `adFinished`
   */
  _pedir(tipo) {
    const sdk = this._sdk;
    return new Promise((resolve) => {
      let fim = false;
      let prazo = 0;
      const sai = (/** @type {boolean} */ ok, /** @type {string} */ codigo) => {
        if (fim) return;
        fim = true;
        window.clearTimeout(prazo);
        if (codigo === 'adsDisabledBasicLaunch') this._semAnuncios = true;
        resolve(ok);
      };
      const espera = (/** @type {number} */ ms) => {
        window.clearTimeout(prazo);
        prazo = window.setTimeout(() => sai(false, 'prazo'), ms);
      };
      espera(PEDIDO_TIMEOUT);
      try {
        sdk.ad.requestAd(tipo, {
          adStarted: () => {
            espera(VIDEO_TIMEOUT);
            if (this.onAdLoading) this.onAdLoading(false);
            if (this.onAdPlay) this.onAdPlay();
          },
          adFinished: () => sai(true, ''),
          adError: (/** @type {*} */ e) => sai(false, (e && e.code) || 'other'),
        });
      } catch {
        sai(false, 'other');
      }
    });
  }

  /**
   * Intervalo comercial (midgame). So entre fases, nunca em navegacao.
   * @param {string} [ponto] de onde vem: troca, proxima, recomeco, repetir, retomar
   * @returns {Promise<void>}
   */
  async commercialBreak(ponto) {
    if (!this._sdk || this.inBreak || this._semAnuncios) return;
    if (ponto === 'retomar' || ponto === 'repetir') return;
    this.gameplayStop();
    this.inBreak = true;
    if (this.onAdStart) this.onAdStart();
    await this._pedir('midgame');
    this.inBreak = false;
    if (this.onAdEnd) this.onAdEnd();
  }

  /**
   * Video recompensado. So por escolha explicita do jogador, e o premio so vale
   * com `adFinished`. Sem video (Basic Launch, bloqueador, nada para mostrar) o
   * botao nao pode ficar mudo: o toast diz que nao ha video agora.
   * @param {'small'|'medium'|'large'} [_size]
   * @returns {Promise<boolean>}
   */
  async rewardedBreak(_size) {
    if (this.inBreak) return false;
    if (!this._sdk || this._semAnuncios) {
      if (this.onSemVideo) this.onSemVideo();
      return false;
    }
    this.gameplayStop();
    this.inBreak = true;
    if (this.onAdStart) this.onAdStart();
    // O veu trava a tela do pedido ate o video entrar: "keep the UI blocked
    // until either adFinished or adError fires".
    if (this.onAdLoading) this.onAdLoading(true);
    const ok = await this._pedir('rewarded');
    if (this.onAdLoading) this.onAdLoading(false);
    this.inBreak = false;
    if (this.onAdEnd) this.onAdEnd();
    if (!ok && this.onSemVideo) this.onSemVideo();
    return ok;
  }

  /**
   * A CrazyGames nao tem eventos proprios como a Poki: dos que o jogo emite, so
   * tres viram chamada do SDK. O comeco de fase vira o contexto do feedback,
   * e o marco de perfeitas a comemoracao do site.
   * @param {string} category
   * @param {string} what
   * @param {string} action
   */
  measure(category, what, action) {
    if (this.inBreak || !this._sdk) return;
    if (category === 'level' && action === 'start') {
      const n = Number(what);
      if (n > 0) this._chama('game', 'setGameContext', { level: n });
    } else if (category === 'perfeitas' && action === 'ganho') {
      this._chama('game', 'happytime');
    }
  }

  /**
   * Quanto da campanha o jogador ja concluiu (0 a 100), na carga e a cada
   * vitoria. A do fim da campanha (as cem fases) ganha a comemoracao do site.
   * @param {number} fases fases da campanha concluidas
   */
  progresso(fases) {
    const pct = Math.max(0, Math.min(100, Math.floor((fases * 100) / LEVEL_COUNT)));
    if (pct === this._progresso) return;
    if (pct === 100 && this._progresso >= 0) this._chama('game', 'happytime');
    this._progresso = pct;
    this._chama('game', 'reportGameCompletedPercentage', pct);
  }

  /** @param {Error|string} _err */
  captureError(_err) {}

  /** Nao ha botao flutuante da plataforma por cima do jogo. */
  movePill() {}

  /** So o app minimiza; no navegador nao ha para onde ir. */
  minimizar() {}

  /** @returns {boolean} */
  isTablet() {
    return this.device === 'tablet';
  }

  /** @returns {boolean} */
  isMobileCategory() {
    return this.device === 'mobile' || this.device === 'tablet';
  }
}

export const crazy = new Crazy();

/** O nome que main.js usa: `@plataforma` aponta para este arquivo na CrazyGames. */
export { crazy as plataforma };
