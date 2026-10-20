/**
 * GameMonetize (github.com/MonetizeGame/GameMonetize.com-SDK).
 *
 * Como na GameDistribution, o SDK le `window.SDK_OPTIONS` (o `gameId` do
 * painel, src/portais/ids.js) quando carrega, e entra por aqui. Sem `gameId`
 * ele nem e carregado e o build e so de teste.
 *
 * - **nao ha video recompensado**: so o intersticial (`sdk.showBanner()`, que
 *   apesar do nome e um video). Os botoes de video somem deste build como na
 *   versao lisa (`COM_ANUNCIOS` falso em core/platform.js), com o mesmo
 *   caminho gratuito no lugar;
 * - **nada de anuncio no carregamento** (regra deles): so nas passagens de
 *   fase;
 * - `SDK_GAME_PAUSE` e o comeco do video e `SDK_GAME_START` o fim. Pedido
 *   cedo demais (o SDK espera ~130 s entre um e outro) volta com
 *   `SDK_GAME_START` sem `SDK_GAME_PAUSE` antes: o jogo segue na hora.
 */

import { Portal } from './base.js';
import { IDS } from './ids.js';

const SDK = 'https://api.gamemonetize.com/sdk.js';
/** O SDK quase sempre responde na hora; sem resposta, o jogo nao espera. */
const PEDIDO_TIMEOUT = 6000;

class GameMonetize extends Portal {
  constructor() {
    super();
    /** @type {*} */
    this._sdk = null;
    /** @type {null|(()=>void)} */
    this._comecou = null;
    /** @type {null|((ok:boolean)=>void)} */
    this._acabou = null;
    /** @type {null|((ok:boolean)=>void)} */
    this._pronto = null;
    this.prazoPedido = PEDIDO_TIMEOUT;
  }

  async _iniciar() {
    if (!IDS.gameId) return false;
    const w = /** @type {*} */ (window);
    const pronto = new Promise((resolve) => {
      this._pronto = resolve;
    });
    w.SDK_OPTIONS = { gameId: IDS.gameId, onEvent: (/** @type {*} */ e) => this._aoEvento(e && e.name) };
    if (!document.getElementById('gamemonetize-sdk')) {
      const s = document.createElement('script');
      s.id = 'gamemonetize-sdk';
      s.src = SDK;
      s.onerror = () => this._pronto && this._pronto(false);
      document.head.appendChild(s);
    }
    const ok = await pronto;
    if (!ok || !w.sdk || typeof w.sdk.showBanner !== 'function') return false;
    this._sdk = w.sdk;
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
      // Um anuncio que comecou depois do prazo do pedido chega aqui com o jogo
      // ja de volta: entao e o fim de uma pausa do portal.
      if (this.inBreak && this._acabou) this._acabou(true);
      else {
        this._acabou = null;
        this._pausaDoPortal(false);
      }
    } else if (nome === 'SDK_ERROR') {
      if (this._acabou) this._acabou(false);
    }
  }

  /**
   * @param {'midgame'|'rewarded'} tipo
   * @param {()=>void} comecou
   * @returns {Promise<boolean>}
   */
  _anuncio(tipo, comecou) {
    if (tipo !== 'midgame') return Promise.resolve(false);
    return new Promise((resolve) => {
      this._comecou = comecou;
      this._acabou = (ok) => {
        this._comecou = null;
        this._acabou = null;
        resolve(ok);
      };
      this._sdk.showBanner();
    });
  }
}

export const plataforma = new GameMonetize();
