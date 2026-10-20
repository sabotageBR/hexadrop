/**
 * Yandex Games (yandex.com/dev/games/doc, requisitos de 09/10/2026).
 *
 * O SDK vem de `/sdk.js`, relativo: o portal serve o arquivo na raiz do
 * dominio do jogo, e o item 1.7 proibe o endereco absoluto no zip. Fora da
 * Yandex o arquivo nao existe, `YaGames` fica indefinido e o jogo segue sem
 * SDK.
 *
 * O que os requisitos cobram e mora aqui:
 * - **1.19.2 Game Ready**: `LoadingAPI.ready()` no `gameLoadingFinished`, com o
 *   jogo ja interativo;
 * - **2.14 idioma**: `environment.i18n.lang` na inicializacao, antes do jogo;
 * - **4.7 e 1.3 som**: `game_api_pause`/`game_api_resume` calam e pausam o jogo
 *   - inclusive no anuncio que o portal mostra sozinho na abertura, sem
 *   callback nenhum;
 * - **anuncio**: `showFullscreenAdv` (a frequencia e da Yandex: chamada cedo
 *   demais fecha com `wasShown` falso) e `showRewardedVideo`, com o premio so
 *   no `onRewarded`.
 *
 * A marcacao de gameplay (`GameplayAPI`) e opcional, e se usada tem que bater
 * com a lista deles inteira (troca de aba inclusive, item 1.19.3): fica de
 * fora. O progresso fica no localStorage, que o requisito 1.9 aceita para jogo
 * sem compra e que o SDK torna confiavel no zip hospedado pela Yandex.
 */

import { Portal } from './base.js';
import { idiomaDaPlataforma } from '../core/i18n.js';

class Yandex extends Portal {
  constructor() {
    super();
    /** @type {*} */
    this._ysdk = null;
  }

  async _iniciar() {
    const ya = /** @type {*} */ (window).YaGames;
    if (!ya || typeof ya.init !== 'function') return false;
    const ysdk = await ya.init();
    if (!ysdk) return false;
    this._ysdk = ysdk;
    this._chama(() => {
      const tipo = ysdk.deviceInfo && ysdk.deviceInfo.type;
      if (tipo === 'desktop' || tipo === 'tablet' || tipo === 'mobile') this.device = tipo;
    });
    this._chama(() => {
      ysdk.on('game_api_pause', () => this._pausaDoPortal(true));
      ysdk.on('game_api_resume', () => this._pausaDoPortal(false));
    });
    return true;
  }

  async _preparar() {
    const lang = this._chama(() => this._ysdk.environment.i18n.lang);
    if (lang) idiomaDaPlataforma(String(lang));
  }

  _carregou() {
    const loading = this._ysdk.features && this._ysdk.features.LoadingAPI;
    if (loading && typeof loading.ready === 'function') loading.ready();
  }

  /**
   * @param {'midgame'|'rewarded'} tipo
   * @param {()=>void} comecou
   * @returns {Promise<boolean>}
   */
  _anuncio(tipo, comecou) {
    const adv = this._ysdk.adv;
    return new Promise((resolve) => {
      if (tipo === 'midgame') {
        adv.showFullscreenAdv({
          callbacks: {
            onOpen: comecou,
            onClose: (/** @type {boolean} */ mostrou) => resolve(!!mostrou),
            onError: () => resolve(false),
            onOffline: () => resolve(false),
          },
        });
        return;
      }
      let premio = false;
      adv.showRewardedVideo({
        callbacks: {
          onOpen: comecou,
          onRewarded: () => {
            premio = true;
          },
          onClose: () => resolve(premio),
          onError: () => resolve(false),
        },
      });
    });
  }
}

export const plataforma = new Yandex();
