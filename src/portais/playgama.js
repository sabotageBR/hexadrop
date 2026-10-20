/**
 * Playgama, pelo Playgama Bridge v2 (wiki.playgama.com/playgama/bridge-sdk).
 *
 * O Bridge vem do CDN deles - o unico recurso de fora que o checklist aceita -
 * e le `playgama-bridge-config.json` ao lado do index.html (o build grava,
 * vite.config.js). Fora da Playgama ele cai na plataforma `mock`: anuncio
 * falha sem lancar, e o jogo segue igual.
 *
 * O que o Bridge marca como obrigatorio e mora aqui:
 * - `platform.language` antes do jogo;
 * - `platform.sendMessage('game_ready')` no `gameLoadingFinished`;
 * - `isAudioEnabled` e os eventos de som e de pausa do portal;
 * - **o save pelo `bridge.storage`**, nunca so pelo localStorage: tudo o que o
 *   jogo guarda vai numa chave do Bridge (src/portais/save.js);
 * - o premio do video so no estado `rewarded`, nunca no `closed`.
 *
 * As mensagens de fase (`level_started`, `level_completed`, `level_failed`)
 * saem dos eventos que o jogo ja emite. O "voltar uma jogada" por video do
 * cartao de derrota sai deste build (game.css): a regra 6.3 deles proibe o
 * "+1 vida" oferecido a cada derrota.
 */

import { Portal } from './base.js';
import { idiomaDaPlataforma } from '../core/i18n.js';
import { prepararSave, fonteEmLote } from './save.js';

/** A chave do Bridge que guarda o save inteiro. */
const CHAVE = 'hexadrop';

class Playgama extends Portal {
  constructor() {
    super();
    /** @type {*} */
    this._b = null;
  }

  async _iniciar() {
    const bridge = /** @type {*} */ (window).bridge;
    if (!bridge || typeof bridge.initialize !== 'function') return false;
    await bridge.initialize();
    this._b = bridge;
    const ev = bridge.EVENT_NAME;
    this._chama(() => {
      const tipo = bridge.device.type;
      if (tipo === 'desktop' || tipo === 'tablet' || tipo === 'mobile') this.device = tipo;
    });
    this._chama(() => {
      if (bridge.platform.isAudioEnabled === false) this._audioDoPortal(false);
      bridge.platform.on(ev.AUDIO_STATE_CHANGED, (/** @type {boolean} */ ligado) => this._audioDoPortal(!!ligado));
    });
    this._chama(() => bridge.platform.on(ev.PAUSE_STATE_CHANGED, (/** @type {boolean} */ p) => this._pausaDoPortal(!!p)));
    return true;
  }

  async _preparar() {
    const lang = this._chama(() => this._b.platform.language);
    if (lang) idiomaDaPlataforma(String(lang));
    const storage = this._b.storage;
    /** @type {Record<string, string>} */
    let salvo = {};
    try {
      const [bruto] = await storage.get([CHAVE]);
      const d = typeof bruto === 'string' ? JSON.parse(bruto) : bruto;
      if (d && typeof d === 'object') salvo = d;
    } catch {
      // Sem ler o Bridge, nada de espelho: gravar por cima apagaria o que
      // estava la.
      return;
    }
    prepararSave(fonteEmLote(salvo, (tudo) => storage.set([CHAVE], [JSON.stringify(tudo)])));
  }

  _carregou() {
    this._b.platform.sendMessage('game_ready');
  }

  /**
   * @param {string} categoria
   * @param {string} oque
   * @param {string} acao
   */
  _evento(categoria, oque, acao) {
    if (categoria !== 'level') return;
    const msg = { start: 'level_started', complete: 'level_completed', fail: 'level_failed' }[acao];
    const n = Number(oque);
    if (msg && n > 0) this._b.platform.sendMessage(msg, { level: n });
  }

  /**
   * @param {'midgame'|'rewarded'} tipo
   * @param {()=>void} comecou
   * @returns {Promise<boolean>}
   */
  _anuncio(tipo, comecou) {
    const b = this._b;
    const ad = b.advertisement;
    const midgame = tipo === 'midgame';
    if (midgame ? ad.isInterstitialSupported === false : ad.isRewardedSupported === false) return Promise.resolve(false);
    const evento = midgame ? b.EVENT_NAME.INTERSTITIAL_STATE_CHANGED : b.EVENT_NAME.REWARDED_STATE_CHANGED;
    return new Promise((resolve) => {
      let premio = false;
      const fim = (/** @type {boolean} */ ok) => {
        this._chama(() => ad.off(evento, ouvir));
        resolve(ok);
      };
      const ouvir = (/** @type {string} */ estado) => {
        if (estado === 'opened') comecou();
        else if (estado === 'rewarded') premio = true;
        else if (estado === 'closed') fim(midgame || premio);
        else if (estado === 'failed') fim(false);
      };
      ad.on(evento, ouvir);
      if (midgame) ad.showInterstitial();
      else ad.showRewarded();
    });
  }
}

export const plataforma = new Playgama();
