/**
 * A plataforma do app (Android/iOS), no lugar de src/poki.js.
 *
 * main.js importa `@plataforma`, e o alias de vite.config.js aponta para ca no
 * build `app`. A interface e a mesma do wrapper da Poki - init,
 * gameLoadingFinished, gameplayStart/Stop, commercialBreak, rewardedBreak,
 * measure, captureError, movePill, onAdStart/onAdEnd, inBreak, ready -, mais o
 * que so o app tem: a loja (`loja`), as opcoes de privacidade (`privacidade`) e
 * os ganchos do ciclo de vida (`onVoltar`, `onSegundoPlano`, `onPrimeiroPlano`),
 * do veu de carregamento (`onAdLoading`) e do video que nao veio (`onSemVideo`).
 *
 * O que muda da Poki e a FREQUENCIA. La quem decide e a Poki, e o jogo nao pode
 * ter cooldown proprio; a AdMob mostra o que pedirem, entao a politica e daqui:
 * a carencia de fases continua em main.js (`FASES_SEM_INTERVALO`), e aqui entram
 * o intervalo minimo, o ponto de onde o intervalo vem e o segundo plano.
 *
 * O backend sai de tres lugares: os plugins no aparelho (backend.js), um
 * simulado no navegador local (simulado.js, para tools/appcheck.mjs) ou nada,
 * se o build `app` for aberto num servidor qualquer.
 */

import { Capacitor } from '@capacitor/core';
import { Anuncios } from './anuncios.js';
import { Analise } from './analise.js';
import { Compras } from './compras.js';
import { criarBackendNativo } from './backend.js';
import { INTERSTICIAL_INTERVALO_S, CARENCIA_VOLTA_S, ESPERA_RECOMPENSADO_S, PRODUTO_SEM_ANUNCIOS } from './config.js';

const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(window.location.hostname);

/** Espera entre a splash sair e o formulario de consentimento entrar. */
const DEPOIS_DA_SPLASH_MS = 350;

/**
 * Backend que nao faz nada: o build `app` aberto num servidor de verdade, fora
 * do aparelho. Sem video, sem loja, sem telemetria.
 * @returns {*}
 */
function backendNulo() {
  const nada = () => {};
  const nunca = () => Promise.reject(new Error('sem plataforma'));
  return {
    nome: 'nulo',
    plataforma: 'web',
    agora: () => Date.now(),
    escondido: () => document.hidden,
    ads: {
      consentir: () => Promise.resolve({ status: 'UNKNOWN', podePedir: false, privacidadeObrigatoria: false }),
      abrirPrivacidade: () => Promise.resolve(),
      rastreamento: () => Promise.resolve(),
      iniciar: nunca,
      carregar: nunca,
      mostrar: nunca,
      ouvir: nada,
    },
    analytics: { evento: nada, propriedade: nada, consentimento: nada },
    loja: {
      suportada: () => Promise.resolve(false),
      preco: () => Promise.resolve(null),
      compras: () => Promise.resolve([]),
      comprar: () => Promise.resolve('erro'),
      reconhecer: () => Promise.resolve(),
      restaurar: () => Promise.resolve(),
    },
    ciclo: { ouvir: nada, minimizar: nada, esconderSplash: nada, esconderBarras: nada },
  };
}

/** @returns {Promise<*>} */
async function escolherBackend() {
  if (Capacitor.isNativePlatform()) return criarBackendNativo();
  if (LOCAL) {
    const { criarBackendSimulado } = await import('./simulado.js');
    return criarBackendSimulado();
  }
  return backendNulo();
}

class Nativo {
  constructor() {
    this.ready = false;
    this.loadingFinished = false;
    /** true entre gameplayStart e gameplayStop */
    this.inGameplay = false;
    /** true durante um anuncio, inclusive enquanto o veu espera o video carregar */
    this.inBreak = false;
    /** @type {{category:string}|null} */
    this.device = null;
    /** @type {null|(()=>void)} */
    this.onAdStart = null;
    /** @type {null|(()=>void)} */
    this.onAdEnd = null;
    /** Veu de "carregando" do video recompensado. @type {null|((on:boolean)=>void)} */
    this.onAdLoading = null;
    /** O video pedido nao veio a tempo. @type {null|(()=>void)} */
    this.onSemVideo = null;
    /** Botao voltar do Android. @type {null|(()=>void)} */
    this.onVoltar = null;
    /** O app saiu da frente (pausa a fase). @type {null|(()=>void)} */
    this.onSegundoPlano = null;
    /** O app voltou (rearma o som). @type {null|(()=>void)} */
    this.onPrimeiroPlano = null;
    /** @type {Compras|null} */
    this.loja = null;
    /** @type {null|{readonly obrigatoria:boolean, abrir:()=>Promise<void>}} */
    this.privacidade = null;

    /** @type {*} */
    this.b = null;
    /** @type {Anuncios|null} */
    this.anuncios = null;
    /** @type {Analise|null} */
    this.analise = null;
    /** Eventos medidos antes de o backend existir. @type {Array<[string, string, string]>} */
    this._fila = [];
    this._ativo = true;
    this._voltouEm = -Infinity;
    /** Ultimo anuncio de qualquer tipo; comeca na abertura do app. */
    this._ultimoAnuncio = Date.now();
    /** @type {Promise<boolean>|null} */
    this._iniciandoAnuncios = null;
  }

  /** @returns {number} */
  agora() {
    return this.b ? this.b.agora() : Date.now();
  }

  /**
   * Monta o backend e liga os ouvintes. Nao espera consentimento nem anuncio:
   * isso vem depois que a splash sai (`gameLoadingFinished`), e a primeira
   * abertura offline nao pode ficar parada esperando a rede.
   * @returns {Promise<void>}
   */
  async init() {
    try {
      this.b = await escolherBackend();
    } catch {
      this.b = backendNulo();
    }
    const b = this.b;
    this._ultimoAnuncio = b.agora();
    this.device = { category: 'mobile' };
    this.anuncios = new Anuncios(b);
    this.analise = new Analise(b.analytics);
    this.loja = new Compras(b.loja, PRODUTO_SEM_ANUNCIOS);
    const anuncios = this.anuncios;
    this.privacidade = {
      get obrigatoria() {
        return anuncios.privacidadeObrigatoria;
      },
      abrir: () => anuncios.abrirPrivacidade(),
    };
    this.analise.propriedade('plataforma', b.plataforma);
    this.analise.propriedade('versao', String(import.meta.env.VITE_VERSAO || ''));
    for (const [c, o, a] of this._fila.splice(0)) this.analise.medir(c, o, a);

    b.ciclo.ouvir((/** @type {string} */ ev) => this._ciclo(ev));
    // No iOS o `pause` do Capacitor pode so ser entregue na volta; a
    // visibilidade do documento chega na hora.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this._ciclo('pausa');
    });
    b.ciclo.esconderBarras();
    this.loja.iniciar();
    this.ready = true;
  }

  /**
   * @param {string} ev 'voltar' | 'pausa' | 'volta'
   */
  _ciclo(ev) {
    if (ev === 'voltar') {
      // Durante anuncio ou o veu de carregamento, o voltar nao faz nada: o
      // jogo esta parado esperando o anuncio terminar.
      if (!this.inBreak && this.onVoltar) this.onVoltar();
      return;
    }
    if (ev === 'pausa') {
      this._ativo = false;
      // No Android o anuncio e uma Activity propria e dispara a mesma pausa.
      if (!this.inBreak && this.onSegundoPlano) this.onSegundoPlano();
      return;
    }
    if (ev === 'volta') {
      this._ativo = true;
      this._voltouEm = this.agora();
      if (this.b) this.b.ciclo.esconderBarras();
      if (this.loja) this.loja.verificar();
      if (this.inBreak && this.anuncios) this.anuncios.vigiar();
      if (!this.inBreak && this.onPrimeiroPlano) this.onPrimeiroPlano();
    }
  }

  /** Dispara uma unica vez, quando o jogador ja pode interagir. */
  gameLoadingFinished() {
    if (this.loadingFinished) return;
    this.loadingFinished = true;
    if (!this.b) return;
    this.b.ciclo.esconderSplash();
    // O formulario do UMP (e o ATT no iOS) entra com a splash ja fora.
    window.setTimeout(() => this._iniciarAnuncios(), DEPOIS_DA_SPLASH_MS);
  }

  /** @returns {Promise<boolean>} */
  _iniciarAnuncios() {
    if (!this.anuncios) return Promise.resolve(false);
    if (!this._iniciandoAnuncios) {
      const anuncios = this.anuncios;
      this._iniciandoAnuncios = anuncios.iniciar().then((ok) => {
        // Consent Mode do Firebase: sem consentimento exigido, concede; com o
        // formulario respondido, o Firebase le as strings TCF do UMP sozinho.
        if (this.analise && anuncios.statusConsentimento === 'NOT_REQUIRED') this.analise.consentimento(true);
        return ok;
      });
    }
    return this._iniciandoAnuncios;
  }

  gameplayStart() {
    if (this.inGameplay || this.inBreak) return;
    this.inGameplay = true;
  }

  gameplayStop() {
    this.inGameplay = false;
  }

  /**
   * Intersticial. `ponto` diz de onde o intervalo vem (ver
   * `Game.commercialBreak` em main.js); a Poki ignora, o app nao mostra nada
   * ao `retomar` de uma pausa - a pausa abre sozinha quando o app vai para o
   * segundo plano, e um anuncio na volta seria um anuncio de abertura.
   * @param {string} [ponto]
   * @returns {Promise<void>}
   */
  async commercialBreak(ponto) {
    const anuncios = this.anuncios;
    if (!anuncios || this.inBreak) return;
    if (this.loja && this.loja.comprado) return;
    if (ponto === 'retomar') return;
    const b = this.b;
    if (!this._ativo || b.escondido()) return;
    const agora = this.agora();
    if (agora - this._voltouEm < CARENCIA_VOLTA_S * 1000) return;
    if (agora - this._ultimoAnuncio < INTERSTICIAL_INTERVALO_S * 1000) return;
    // Sem anuncio carregado nao se espera: a troca de fase segue na hora.
    if (!anuncios.pronto('intersticial')) {
      anuncios.carregar('intersticial');
      return;
    }
    this.gameplayStop();
    this.inBreak = true;
    if (this.onAdStart) this.onAdStart();
    let mostrou = false;
    try {
      ({ mostrou } = await anuncios.mostrar('intersticial'));
    } finally {
      if (mostrou) this._ultimoAnuncio = this.agora();
      this.inBreak = false;
      if (this.onAdEnd) this.onAdEnd();
    }
    if (mostrou && this.analise) this.analise.evento('anuncio_intersticial', { ponto: String(ponto || '') });
  }

  /**
   * Video recompensado, so por escolha do jogador. O veu sobe no clique e
   * segura a tela ate o video abrir ou o prazo acabar: sem ele a tela seguia
   * viva por ate 8 s, e o video podia abrir por cima de outra tela.
   * @param {'small'|'medium'|'large'} [size]
   * @returns {Promise<boolean>} true so com o premio ganho
   */
  async rewardedBreak(size) {
    const anuncios = this.anuncios;
    if (!anuncios || this.inBreak) return false;
    this.gameplayStop();
    this.inBreak = true;
    if (this.onAdStart) this.onAdStart();
    if (this.onAdLoading) this.onAdLoading(true);
    let premio = false;
    let semVideo = false;
    try {
      this._iniciarAnuncios();
      const pronto = await anuncios.esperarPronto('recompensado', ESPERA_RECOMPENSADO_S * 1000);
      if (this.onAdLoading) this.onAdLoading(false);
      if (!pronto) semVideo = true;
      else {
        const r = await anuncios.mostrar('recompensado');
        premio = r.premio;
        if (r.mostrou) this._ultimoAnuncio = this.agora();
        else semVideo = true;
      }
    } finally {
      if (this.onAdLoading) this.onAdLoading(false);
      this.inBreak = false;
      if (this.onAdEnd) this.onAdEnd();
    }
    if (this.analise) {
      this.analise.evento('anuncio_video', { tamanho: String(size || ''), premio: premio ? 1 : 0, sem_video: semVideo ? 1 : 0 });
    }
    if (semVideo && this.onSemVideo) this.onSemVideo();
    return premio;
  }

  /**
   * @param {string} category
   * @param {string|number} what
   * @param {string} action
   */
  measure(category, what, action) {
    if (!this.analise) {
      if (this._fila.length < 50) this._fila.push([category, String(what), action]);
      return;
    }
    this.analise.medir(category, what, action);
  }

  /** @param {Error|string} err */
  captureError(err) {
    if (!this.analise) return;
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    this.analise.evento('erro_js', { msg: msg.slice(0, 100) });
  }

  /** O botao flutuante e da Poki; no app nao existe. */
  movePill() {}

  /** O botao voltar do Android na tela inicial: o app vai para tras, nao fecha. */
  minimizar() {
    if (this.b) this.b.ciclo.minimizar();
  }

  /** @returns {boolean} */
  isTablet() {
    return false;
  }

  /** @returns {boolean} */
  isMobileCategory() {
    return true;
  }
}

export const plataforma = new Nativo();
