/**
 * GameDistribution (github.com/GameDistribution/GD-HTML5/wiki, diretrizes de
 * static.gamedistribution.com/developer/developers-guidelines.html).
 *
 * O SDK le `window.GD_OPTIONS` (o `gameId` do painel, src/portais/ids.js, e o
 * `onEvent`) quando carrega, entao ele entra por aqui, como no trecho oficial,
 * e nao pelo HTML. Sem `gameId` o SDK nem e carregado: a GD nao atribui a
 * receita, e o build e so de teste.
 *
 * - **pre-roll obrigatorio**: um `showAd()` depois do `SDK_READY`, antes de o
 *   jogo abrir (`_preparar`, com a tela de carregamento ainda na frente). O
 *   jogo abre na fase parada, esperando o primeiro toque - a "tela que so
 *   continua com interacao" que as diretrizes pedem depois de um anuncio;
 * - **mid-roll** nas passagens de fase; o SDK decide a frequencia (120 s) e
 *   rejeita o pedido cedo demais sem pausar nada;
 * - `SDK_GAME_PAUSE` e `SDK_GAME_START` contam o comeco e o fim do video; fora
 *   de um anuncio nosso, pausam e devolvem o jogo;
 * - o premio do video so com `SDK_REWARDED_WATCH_COMPLETE`.
 */

import { Portal, comPrazo } from './base.js';
import { IDS } from './ids.js';

const SDK = 'https://html5.api.gamedistribution.com/main.min.js';
/** O pre-roll: esperar o video comecar ou falhar, e depois ele acabar. */
const PREPARO_TIMEOUT = 200000;

class GameDistribution extends Portal {
  constructor() {
    super();
    /** @type {*} */
    this._sdk = null;
    /** @type {null|(()=>void)} o video do anuncio em curso entrou */
    this._comecou = null;
    this._premio = false;
    /** @type {null|((ok:boolean)=>void)} */
    this._pronto = null;
    this.prazoPreparo = PREPARO_TIMEOUT;
  }

  async _iniciar() {
    if (!IDS.gameId) return false;
    const w = /** @type {*} */ (window);
    const pronto = new Promise((resolve) => {
      this._pronto = resolve;
    });
    w.GD_OPTIONS = { gameId: IDS.gameId, onEvent: (/** @type {*} */ e) => this._aoEvento(e && e.name) };
    if (!document.getElementById('gamedistribution-jssdk')) {
      const s = document.createElement('script');
      s.id = 'gamedistribution-jssdk';
      s.src = SDK;
      s.onerror = () => this._pronto && this._pronto(false);
      document.head.appendChild(s);
    }
    const ok = await pronto;
    if (!ok || !w.gdsdk) return false;
    this._sdk = w.gdsdk;
    return true;
  }

  /** @param {string} nome */
  _aoEvento(nome) {
    if (nome === 'SDK_READY') {
      if (this._pronto) this._pronto(true);
    } else if (nome === 'SDK_GAME_PAUSE') {
      if (this.inBreak) {
        if (this._comecou) this._comecou();
      } else {
        this._pausaDoPortal(true);
      }
    } else if (nome === 'SDK_GAME_START') {
      if (!this.inBreak) this._pausaDoPortal(false);
    } else if (nome === 'SDK_REWARDED_WATCH_COMPLETE') {
      this._premio = true;
    }
  }

  /** O pre-roll, antes de main.js. */
  async _preparar() {
    this.inBreak = true;
    await this._pedir('midgame');
    this.inBreak = false;
  }

  /**
   * @param {'midgame'|'rewarded'} tipo
   * @param {()=>void} comecou
   * @returns {Promise<boolean>}
   */
  async _anuncio(tipo, comecou) {
    const sdk = this._sdk;
    this._comecou = comecou;
    this._premio = false;
    try {
      if (tipo === 'midgame') {
        await sdk.showAd('interstitial');
        return true;
      }
      await sdk.preloadAd('rewarded');
      await sdk.showAd('rewarded');
      // O evento do premio pode chegar logo depois da promessa.
      if (!this._premio) await comPrazo(new Promise((r) => window.setTimeout(r, 400)), 500, undefined);
      return this._premio;
    } catch {
      return false;
    } finally {
      this._comecou = null;
    }
  }
}

export const plataforma = new GameDistribution();
