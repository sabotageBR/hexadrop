/**
 * Y8 (docs.y8.com, SDK 2-0).
 *
 * O script vem do CDN da Y8 com `async` (vite.config.js); o SDK avisa que
 * esta pronto pelo evento `y8sdk.ready`, e `emitReadyEvent` cobre o caso de
 * ele ja ter carregado antes de o ouvinte existir. `appId` e `gameId` sao da
 * aba "SDK Initialization" do painel (src/portais/ids.js); sem eles o jogo
 * segue sem SDK.
 *
 * - **pre-roll**: a propria Y8 mostra, antes da interface do jogo;
 * - **intervalo so depois de um clique** (Next, Retry, Continue): as
 *   diretrizes proibem o intersticial automatico, mesmo no fim da fase. As
 *   passagens do jogo corrido (`troca`, `recomeco`) nao pedem anuncio; pedem o
 *   cartao de vitoria (`proxima`), o "tentar de novo" (`repetir`) e o
 *   continuar da pausa (`retomar`). A frequencia (~180 s) e da Y8;
 * - **pausar e calar dentro do `beforeAd`**, nunca antes: break pulado (limite
 *   de frequencia, sem anuncio) nao chama `beforeAd` nem `afterAd`, e termina
 *   so com `adBreakDone`;
 * - o premio so no `adViewed`;
 * - o idioma do subdominio (`getPlatformLocale`).
 */

import { Portal } from './base.js';
import { idiomaDaPlataforma } from '../core/i18n.js';
import { IDS } from './ids.js';

class Y8 extends Portal {
  constructor() {
    super();
    /** @type {*} */
    this._sdk = null;
    this.pontos = new Set(['proxima', 'repetir', 'retomar']);
  }

  async _iniciar() {
    if (!IDS.appId) return false;
    const w = /** @type {*} */ (window);
    const y8 = await new Promise((resolve) => {
      window.addEventListener('y8sdk.ready', () => resolve(w.y8), { once: true });
      if (w.y8 && typeof w.y8.emitReadyEvent === 'function') w.y8.emitReadyEvent();
    });
    if (!y8 || typeof y8.sdk !== 'function') return false;
    const sdk = y8.sdk();
    /** @type {*} */
    const anuncios = IDS.gameId ? { gameId: IDS.gameId, preloadAdBreaks: 'on', sound: 'on' } : undefined;
    sdk.init({ appId: IDS.appId, autoLogin: true }, anuncios);
    this._sdk = sdk;
    if (!anuncios) this._semAnuncios = true;
    return true;
  }

  async _preparar() {
    const locale = await this._sdk.getPlatformLocale();
    if (locale) idiomaDaPlataforma(String(locale));
  }

  /**
   * @param {'midgame'|'rewarded'} tipo
   * @param {()=>void} comecou
   * @returns {Promise<boolean>}
   */
  _anuncio(tipo, comecou) {
    const midgame = tipo === 'midgame';
    return new Promise((resolve) => {
      let viu = false;
      let fim = false;
      const sai = (/** @type {boolean} */ ok) => {
        if (fim) return;
        fim = true;
        resolve(ok);
      };
      /** @type {*} */
      const pedido = {
        type: midgame ? 'next' : 'reward',
        name: midgame ? 'next-level' : 'reward',
        beforeAd: comecou,
        afterAd: () => sai(midgame || viu),
        adBreakDone: (/** @type {*} */ info) => sai(midgame ? !!info && info.breakStatus === 'viewed' : viu),
      };
      if (!midgame) {
        pedido.beforeReward = (/** @type {()=>void} */ mostra) => mostra();
        pedido.adViewed = () => {
          viu = true;
        };
        pedido.adDismissed = () => {};
      }
      Promise.resolve(this._sdk.showAd(pedido)).catch(() => sai(false));
    });
  }
}

export const plataforma = new Y8();
