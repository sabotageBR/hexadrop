/**
 * GamePix (partners.gamepix.com/sdk/doc/javascript, SDK v3).
 *
 * O script e o primeiro do <head>, sem async (vite.config.js). Nao ha init: o
 * objeto `GamePix` ja esta la. `loaded()` tem que vir antes de qualquer outro
 * metodo, e por isso sai em `_preparar`, junto com o idioma e o save, antes de
 * main.js - o jogo abre logo depois.
 *
 * - **pausa e som**: o SDK chama `GamePix.on.pause`/`resume`/`soundOn`/
 *   `soundOff` (ou, sem eles, `GamePix.pause`...) quando o site pausa, devolve,
 *   cala ou liga o som; o jogo congela e volta sozinho. Os ganchos ficam
 *   declarados antes do `loaded()`, nas duas formas;
 * - **anuncio**: `interstitialAd()` e `rewardAd()` resolvem com `{success}`; o
 *   SDK decide a frequencia e nao avisa quando o video entra, entao o som cala
 *   no pedido (`silencioNoVideo` falso). Intervalo so entre fases, nunca por
 *   tempo, como as diretrizes pedem;
 * - **save** no `GamePix.localStorage`, que sobrevive ao iframe no celular
 *   (src/portais/save.js);
 * - `updateLevel` na fase que comeca e `happyMoment` nos marcos.
 */

import { Portal } from './base.js';
import { idiomaDaPlataforma } from '../core/i18n.js';
import { prepararSave } from './save.js';
import { LEVEL_COUNT } from '../game/levelgen.js';

class GamePix extends Portal {
  constructor() {
    super();
    /** @type {*} */
    this._gp = null;
    this.silencioNoVideo = false;
    /** Ultima porcentagem informada; -1 antes da primeira. */
    this._pct = -1;
  }

  async _iniciar() {
    const gp = /** @type {*} */ (window).GamePix;
    if (!gp || typeof gp.interstitialAd !== 'function') return false;
    this._gp = gp;
    const ganchos = {
      pause: () => this._pausaDoPortal(true),
      resume: () => this._pausaDoPortal(false),
      soundOn: () => this._audioDoPortal(true),
      soundOff: () => this._audioDoPortal(false),
    };
    Object.assign(gp, ganchos);
    if (gp.on && typeof gp.on === 'object') Object.assign(gp.on, ganchos);
    this._chama(() => gp.loading(60));
    return true;
  }

  async _preparar() {
    const gp = this._gp;
    await Promise.resolve(this._chama(() => gp.loaded()));
    const lang = this._chama(() => gp.lang());
    if (lang) idiomaDaPlataforma(String(lang));
    const ls = this._chama(() => gp.localStorage);
    if (ls && typeof ls.getItem === 'function') prepararSave(ls);
  }

  /**
   * @param {string} categoria
   * @param {string} oque
   * @param {string} acao
   */
  _evento(categoria, oque, acao) {
    if (categoria === 'level' && acao === 'start') {
      const n = Number(oque);
      if (n > 0) this._gp.updateLevel(n);
    } else if (categoria === 'perfeitas' && acao === 'ganho') {
      this._gp.happyMoment();
    }
  }

  /** @param {number} fases */
  _progresso(fases) {
    const pct = Math.floor((fases * 100) / LEVEL_COUNT);
    if (pct >= 100 && this._pct >= 0 && this._pct < 100) this._gp.happyMoment();
    this._pct = pct;
  }

  /**
   * @param {'midgame'|'rewarded'} tipo
   * @returns {Promise<boolean>}
   */
  _anuncio(tipo) {
    const pedido = tipo === 'midgame' ? this._gp.interstitialAd() : this._gp.rewardAd();
    return Promise.resolve(pedido).then((r) => !!(r && r.success === true));
  }
}

export const plataforma = new GamePix();
