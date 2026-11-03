/**
 * Wavedash (docs.wavedash.com, lido em 2026-11-03).
 *
 * A Wavedash injeta `window.Wavedash` na pagina antes de qualquer script do
 * jogo: nao ha SDK a carregar nem nada no HTML (tools/portais-sdk.mjs,
 * `injetado`). Fora dela (local, outro host) o objeto nao existe e o jogo roda
 * igual, como a versao lisa.
 *
 * - **`Wavedash.init()` tira o jogo de tras da tela de carregamento dela**, e
 *   uma vez so (ele mesmo chama o `loadComplete`). Sai do
 *   `gameLoadingFinished` de main.js, que vem logo depois de a cena comecar, e
 *   nao de um quadro: num iframe de outra origem escondido o Chrome nao roda o
 *   requestAnimationFrame, e um init que esperasse o primeiro quadro deixaria o
 *   jogo preso para sempre. Pelo mesmo motivo ele nao olha foco, aba visivel
 *   nem pausa: escondido, o jogador nao tem como devolver nada disso. E se o
 *   carregamento nao chegar la, a reserva por timer (`RESERVA_MS` depois da
 *   avaliacao deste modulo) chama o init assim mesmo.
 * - **`updateLoadProgressZeroToOne`** alimenta a barra dela nas etapas do
 *   carregamento (`CARGA`), sempre subindo e so antes do init.
 * - **idioma**: `getUserLanguage()` ("en", "pt-BR"...), so quando o jogo tem
 *   esse idioma; senao fica o do navegador. A escolha feita nos ajustes
 *   continua valendo (`idiomaDaPlataforma`).
 * - **sem anuncio**: a Wavedash nao serve anuncio. O intervalo sai na hora e o
 *   video recompensado responde "sem video" sem nunca pagar; os botoes de
 *   video somem e o caminho gratuito da versao lisa fica no lugar
 *   (`COM_ANUNCIOS` falso em core/platform.js).
 * - o save continua no localStorage (core/storage.js), na origem do build.
 */

import { Portal } from './base.js';
import { LANGS, idiomaDaPlataforma } from '../core/i18n.js';

/** Sem init ate aqui (ms desde a avaliacao deste modulo), ele sai assim mesmo. */
export const RESERVA_MS = 8000;

/**
 * As etapas do carregamento na barra da Wavedash: o modulo avaliado, o SDK
 * visto, o idioma pronto (dai vem o main.js, o pedaco grande), o jogo montado
 * (main.js chama `init`) e o fim.
 */
export const CARGA = { modulo: 0.1, sdk: 0.2, preparado: 0.35, montado: 0.8, pronto: 1 };

/**
 * O SDK que a Wavedash injeta, ou null fora dela.
 * @returns {*}
 */
function sdk() {
  try {
    const w = /** @type {*} */ (window).Wavedash;
    return w && typeof w.init === 'function' ? w : null;
  } catch {
    return null;
  }
}

export class PortalWavedash extends Portal {
  /** @param {{reservaMs?: number}} [opcoes] */
  constructor(opcoes = {}) {
    super();
    // Nao ha anuncio nesta plataforma: commercialBreak e rewardedBreak saem
    // na hora (base.js).
    this._semAnuncios = true;
    /** O `Wavedash.init()` ja foi pedido (ou nao havia SDK quando era a hora). */
    this.revelado = false;
    /** @type {''|'carregou'|'reserva'} quem pediu o init */
    this.reveladoPor = '';
    /** O ultimo valor mandado a barra de carregamento. */
    this._carga = 0;
    this._botoesDeVideo();
    this._progresso01(CARGA.modulo);
    this._reserva = window.setTimeout(() => this.revelar('reserva'), opcoes.reservaMs ?? RESERVA_MS);
  }

  /**
   * Os botoes de video somem, como na versao lisa. A regra mora aqui, e nao em
   * game.css, para a folha dos outros builds continuar byte a byte a mesma.
   */
  _botoesDeVideo() {
    if (typeof document === 'undefined' || !document.head) return;
    this._chama(() => {
      const s = document.createElement('style');
      s.textContent = '.btn.ad { display: none !important; }';
      document.head.appendChild(s);
    });
  }

  /**
   * A barra da Wavedash, de 0 a 1: so sobe, e so antes do init.
   * @param {number} p
   */
  _progresso01(p) {
    if (this.revelado || p <= this._carga) return;
    this._carga = p;
    if (!sdk()) return;
    this._chama(() => /** @type {*} */ (window).Wavedash.updateLoadProgressZeroToOne(p));
  }

  async _iniciar() {
    if (!sdk()) return false;
    this._progresso01(CARGA.sdk);
    return true;
  }

  async _preparar() {
    if (!sdk()) return;
    const lang = this._chama(() => /** @type {*} */ (window).Wavedash.getUserLanguage());
    if (typeof lang === 'string' && LANGS.includes(lang.toLowerCase().split(/[-_]/)[0])) {
      idiomaDaPlataforma(lang);
    }
    this._progresso01(CARGA.preparado);
  }

  /** main.js chama depois de avaliado e com o jogo montado, antes da cena. */
  init() {
    this._progresso01(CARGA.montado);
    return super.init();
  }

  /**
   * O jogador ja pode interagir: o init sai daqui, por fora do `ready` e de
   * qualquer pausa.
   */
  gameLoadingFinished() {
    super.gameLoadingFinished();
    this.revelar('carregou');
  }

  /**
   * Pede o `Wavedash.init()`, uma vez so. Sem SDK nao ha o que pedir, e a
   * reserva para de esperar do mesmo jeito.
   * @param {'carregou'|'reserva'} motivo
   */
  revelar(motivo) {
    if (this.revelado) return;
    window.clearTimeout(this._reserva);
    if (sdk()) this._progresso01(CARGA.pronto);
    this.revelado = true;
    this.reveladoPor = motivo;
    if (!sdk()) return;
    this._chama(() => /** @type {*} */ (window).Wavedash.init());
  }
}

export const plataforma = new PortalWavedash();
