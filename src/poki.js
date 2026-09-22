/**
 * Camada unica de contato com o Poki SDK.
 *
 * O script v2 e apenas um carregador: ele injeta o core com onload e sem
 * onerror nem timeout. Com um bloqueador de anuncios ativo, o core nunca chega
 * e as promessas do SDK ficam pendentes para sempre. Por isso toda chamada aqui
 * passa por um Promise.race com prazo e por uma guarda de existencia.
 *
 * O jogo tem que se comportar exatamente igual nos dois casos e nunca
 * mencionar bloqueador de anuncios.
 */

import { COM_ANUNCIOS } from './core/platform.js';

const INIT_TIMEOUT = 4000;
const BREAK_TIMEOUT = 45000;

/** @returns {*} */
function sdk() {
  // Na versao lisa o script nem e publicado; a guarda aqui garante que nenhuma
  // chamada tente usar um SDK que alguem tenha injetado por fora.
  if (!COM_ANUNCIOS) return null;
  try {
    return typeof window !== 'undefined' && window.PokiSDK ? window.PokiSDK : null;
  } catch {
    return null;
  }
}

/**
 * @template T
 * @param {Promise<T>|null} promise
 * @param {number} ms
 * @param {T} fallback
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, fallback) {
  if (!promise || typeof promise.then !== 'function') return Promise.resolve(fallback);
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value === undefined ? fallback : value);
      },
      () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

class Poki {
  constructor() {
    this.ready = false;
    this.loadingFinished = false;
    /** true entre gameplayStart e gameplayStop */
    this.inGameplay = false;
    /** true durante um intervalo, quando nenhum evento pode ser disparado */
    this.inBreak = false;
    /** @type {{category:string}|null} */
    this.device = null;
    /** @type {null|(()=>void)} */
    this.onAdStart = null;
    /** @type {null|(()=>void)} */
    this.onAdEnd = null;
  }

  /** @returns {Promise<void>} resolve mesmo quando o SDK nao carrega */
  async init() {
    const api = sdk();
    if (!api || typeof api.init !== 'function') {
      this.ready = false;
      return;
    }
    const ok = await withTimeout(
      (() => {
        try {
          return api.init();
        } catch {
          return null;
        }
      })(),
      INIT_TIMEOUT,
      null,
    );
    this.ready = ok !== null || !!sdk();
    try {
      if (typeof api.getDeviceInfo === 'function') {
        const info = await withTimeout(api.getDeviceInfo(), 1500, null);
        if (info) this.device = info;
      }
    } catch {
      /* ignora */
    }
  }

  /** Dispara uma unica vez, quando o jogador ja pode interagir. */
  gameLoadingFinished() {
    if (this.loadingFinished) return;
    this.loadingFinished = true;
    const api = sdk();
    if (!api || typeof api.gameLoadingFinished !== 'function') return;
    try {
      api.gameLoadingFinished();
    } catch {
      /* ignora */
    }
  }

  /** So no primeiro input real do jogador, nunca no carregamento. */
  gameplayStart() {
    if (this.inGameplay || this.inBreak) return;
    this.inGameplay = true;
    const api = sdk();
    if (!api || typeof api.gameplayStart !== 'function') return;
    try {
      api.gameplayStart();
    } catch {
      /* ignora */
    }
  }

  /** Em qualquer interrupcao: pausa, menu, fim de fase, derrota. */
  gameplayStop() {
    if (!this.inGameplay) return;
    this.inGameplay = false;
    const api = sdk();
    if (!api || typeof api.gameplayStop !== 'function') return;
    try {
      api.gameplayStop();
    } catch {
      /* ignora */
    }
  }

  /**
   * Intervalo comercial. So deve ser chamado ao sair de uma parada natural
   * rumo ao jogo. Nunca criar cooldown proprio: a Poki decide a frequencia.
   * @returns {Promise<void>}
   */
  async commercialBreak() {
    if (!COM_ANUNCIOS || this.inBreak) return;
    this.gameplayStop();
    this.inBreak = true;
    if (this.onAdStart) this.onAdStart();
    const api = sdk();
    if (api && typeof api.commercialBreak === 'function') {
      await withTimeout(
        (() => {
          try {
            return api.commercialBreak(() => {
              if (this.onAdStart) this.onAdStart();
            });
          } catch {
            return null;
          }
        })(),
        BREAK_TIMEOUT,
        null,
      );
    }
    this.inBreak = false;
    if (this.onAdEnd) this.onAdEnd();
  }

  /**
   * Video recompensado. So por escolha explicita do jogador.
   * A recompensa so vale quando o retorno e estritamente true.
   * @param {'small'|'medium'|'large'} [size]
   * @returns {Promise<boolean>}
   */
  async rewardedBreak(size) {
    if (!COM_ANUNCIOS || this.inBreak) return false;
    const wasPlaying = this.inGameplay;
    this.gameplayStop();
    this.inBreak = true;
    if (this.onAdStart) this.onAdStart();
    const api = sdk();
    let success = false;
    if (api && typeof api.rewardedBreak === 'function') {
      const result = await withTimeout(
        (() => {
          try {
            const cb = () => {
              if (this.onAdStart) this.onAdStart();
            };
            return size ? api.rewardedBreak({ size, onStart: cb }) : api.rewardedBreak(cb);
          } catch {
            return null;
          }
        })(),
        BREAK_TIMEOUT,
        false,
      );
      success = result === true;
    }
    this.inBreak = false;
    if (this.onAdEnd) this.onAdEnd();
    this._wasPlaying = wasPlaying;
    return success;
  }

  /**
   * Telemetria. Progresso usa 'start' e depois 'complete' ou 'fail', nunca os
   * dois na mesma tentativa; interacao usa 'visible' e depois 'interact'.
   *
   * Duas guardas que a QA da Poki cobra e o chamador nao deveria ter que
   * lembrar: nenhum evento sai durante um intervalo comercial, e nem `/` nem
   * `^` chegam ao SDK - a Poki reserva os dois para separar os campos no
   * painel, e um `what` com barra vira duas linhas diferentes no relatorio.
   *
   * @param {string} category
   * @param {string} what
   * @param {string} action
   */
  measure(category, what, action) {
    if (this.inBreak) return;
    const api = sdk();
    if (!api || typeof api.measure !== 'function') return;
    const limpa = (/** @type {string} */ v) => String(v).replace(/[/^]/g, '-');
    try {
      api.measure(limpa(category), limpa(what), limpa(action));
    } catch {
      /* ignora */
    }
  }

  /** @param {Error|string} err */
  captureError(err) {
    const api = sdk();
    if (!api || typeof api.captureError !== 'function') return;
    try {
      api.captureError(err instanceof Error ? err : new Error(String(err)));
    } catch {
      /* ignora */
    }
  }

  /**
   * Afasta o botao flutuante da Poki do HUD no mobile.
   * @param {number} topPercent 0 a 50
   * @param {number} topPx
   */
  movePill(topPercent, topPx) {
    const api = sdk();
    if (!api || typeof api.movePill !== 'function') return;
    try {
      api.movePill(Math.max(0, Math.min(50, topPercent)), topPx);
    } catch {
      /* ignora */
    }
  }

  /** @returns {boolean} */
  isTablet() {
    return !!this.device && this.device.category === 'tablet';
  }

  /** @returns {boolean} */
  isMobileCategory() {
    if (!this.device) return false;
    return this.device.category === 'mobile' || this.device.category === 'tablet';
  }
}

export const poki = new Poki();
