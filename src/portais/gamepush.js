/**
 * GamePush (docs.gamepush.com, lido e medido em 2026-11-08).
 *
 * A GamePush publica o jogo em nome do dono nas plataformas dela (Yandex
 * Games, VK, OK, GameDistribution...). O build e o da itch (sem pacotes, sem
 * nuvem, save so no localStorage com o prefixo `hexadrop.`) com o SDK dela, os
 * anuncios e o russo.
 *
 * **O SDK** vem do carregador oficial do painel, no index.html
 * (tools/portais-sdk.mjs): ele tenta quatro CDNs e chama `onGPInit(gp)`. Os
 * modulos do jogo rodam depois dele, entao um script classico antes do
 * carregador guarda o `gp` numa promessa (`window.__gpPronto`), que este
 * adaptador espera. Nao ha `gp` global.
 *
 * - **Espera:** no maximo `ESPERA_SDK_MS` (8 s) desde a abertura da pagina, com
 *   a tela de carregamento do jogo (o #loader do index.html, com a barra
 *   andando). Sem SDK no prazo (bloqueador, rede), o jogo abre sem ele, inteiro
 *   e jogavel, como o da itch. Se ele chegar depois, liga ali: gameStart,
 *   pausa, som, anuncios e o idioma.
 * - **Idioma:** o escolhido nos ajustes; senao o `gp.language`, quando o jogo o
 *   tem (en, pt, es, fr, it, de, tr e ru); senao o do navegador; senao o
 *   ingles. O russo e os rotulos de video entram aqui (gamepush-textos.js), so
 *   neste build. Com o SDK atrasado, o idioma dele troca ao vivo, como a troca
 *   dos ajustes, logo depois do fim do carregamento.
 * - **`gp.gameStart()`:** uma vez por carga, no `gameLoadingFinished` de main.js
 *   (o jogo carregado e interativo), ou quando o SDK chegar, se for depois. E o
 *   que libera o LoadingAPI.ready das plataformas.
 * - **`gameplayStart`/`gameplayStop`:** nos mesmos pontos dos outros portais
 *   (base.js, idempotentes e balanceados).
 * - **Intersticial:** `gp.ads.showFullscreen()` so nos pontos de passagem de
 *   fase (`pontos` de base.js) e com a carencia de main.js, so com
 *   `isFullscreenAvailable`, e so com `INTERVALO_MIN_S` (180 s) ou mais desde o
 *   gameStart e desde o anuncio anterior. O checklist da GamePush: a OK nao
 *   aceita anuncio logo depois de abrir nem mais de um a cada 3 min, e a VK nao
 *   aceita anuncio antes de o jogador entender o jogo. Fora disso o intervalo
 *   resolve na hora, sem anuncio. Sem preloader e sem sticky.
 * - **Premiado:** `gp.ads.showRewardedVideo({ showFailedOverlay: true })`, e o
 *   premio so com a promessa em `true`. O aviso de "sem anuncio" e o da propria
 *   GamePush (`showFailedOverlay`). O botao de video so aparece com `haVideo()`
 *   (SDK pronto e `isRewardedAvailable`), que main.js pergunta cada vez que um
 *   botao de video e mostrado (`VIDEO_NA_HORA`); sem ele fica o caminho
 *   gratuito da itch.
 * - **Durante o anuncio** o jogo para e todo o som cala desde o pedido
 *   (`silencioNoVideo` falso: nada fica tocando por baixo de um anuncio que nao
 *   avisou o comeco).
 * - **Pausa e som do SDK:** `gp.on('pause'|'resume')` pausa e devolve o jogo
 *   (`_pausaDoPortal`); `gp.sounds` cala tudo, so os efeitos ou so a musica,
 *   como mudo da plataforma, por cima dos botoes de som do jogador e sem gravar
 *   a preferencia dele. A aba escondida ja pausa e cala (base.js e audio.js).
 * - **Proibido aqui:** save pelo `gp.player`/`gp.storage`, compras, link
 *   externo, janela, alert/confirm/prompt e console.log.
 */

import { Portal, comPrazo } from './base.js';
import { LANGS, getLang, idiomaDaPlataforma, onLangChange } from '../core/i18n.js';
import { load } from '../core/storage.js';
import { audio } from '../core/audio.js';
import { textosDaGamePush } from './gamepush-textos.js';

/** O jogo espera o SDK ate aqui, contado da abertura da pagina (ms). */
export const ESPERA_SDK_MS = 8000;

/**
 * Intervalo minimo entre intersticiais, e entre o gameStart e o primeiro (s).
 * O checklist da GamePush: a OK nao aceita anuncio logo depois de abrir nem
 * mais de um a cada 3 minutos, e a VK nao aceita anuncio antes de o jogador
 * entender o jogo. O premiado tambem conta, para um intersticial nao vir logo
 * depois de um video que o jogador escolheu ver.
 */
export const INTERVALO_MIN_S = 180;

/**
 * O ganho de cada barramento de audio.js (sfxBus e musicBus) quando ligado:
 * so para o mudo parcial da plataforma (`mute:sfx`, `mute:music`).
 */
const GANHO = { sfx: 0.85, musica: 0.3 };

/**
 * As letras cirilicas da Nunito (o subconjunto cyrillic do @fontsource/nunito
 * 5.3.0): so elas saem desta fonte, o resto continua na Fredoka.
 */
const CIRILICO = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';

/**
 * A Nunito Black cirilica (OFL; licenca no LICENCAS.txt deste build). Pelo
 * `new URL(..., import.meta.url)` o Vite emite o arquivo so neste build, com o
 * caminho relativo ao proprio JS (o jogo roda numa subpasta da CDN).
 */
const FONTE_CIRILICA = new URL('../ui/fontes/nunito-cyrillic-900-normal.woff2', import.meta.url).href;

/**
 * @typedef {Object} OpcoesGamePush
 * @property {Promise<*>|null} [sdk]       o `gp` que o carregador entrega (padrao: window.__gpPronto)
 * @property {() => number} [desdeAbertura] ms desde a abertura da pagina (padrao: performance.now)
 * @property {() => number} [agora]         relogio dos intervalos (padrao: Date.now)
 * @property {number} [esperaMs]            o prazo do SDK (padrao: ESPERA_SDK_MS)
 */

/** @type {PortalGamePush|null} o adaptador cujo mudo parcial vale (um so na pagina) */
let donoDoSom = null;

export class PortalGamePush extends Portal {
  /** @param {OpcoesGamePush} [opcoes] */
  constructor(opcoes = {}) {
    super();
    textosDaGamePush();
    /** @type {*} o `gp` do SDK, quando chegar */
    this._gp = null;
    this.esperaMs = opcoes.esperaMs ?? ESPERA_SDK_MS;
    this._agora = opcoes.agora || (() => Date.now());
    this._desdeAbertura =
      opcoes.desdeAbertura || (() => (typeof performance !== 'undefined' && performance.now ? performance.now() : 0));
    this._promessaSdk = opcoes.sdk !== undefined ? opcoes.sdk : sdkDaPagina();
    // O jogo cala desde o pedido do anuncio, e nao so quando o video avisa
    // que entrou: um anuncio que nao avise o comeco nao toca por baixo do jogo.
    this.silencioNoVideo = false;
    /** O gameStart ja saiu nesta carga. */
    this.gameStartFeito = false;
    /** Quando foi o gameStart ou o ultimo anuncio (relogio `agora`); -1 antes. */
    this._ultimoMarco = -1;
    /** Ja passou o prazo da espera (com ou sem SDK). */
    this.esperaAcabou = false;
    /** O idioma da abertura ja foi decidido (`_preparar`). */
    this._idiomaDecidido = false;
    /** @type {string} idioma do SDK que chegou tarde, esperando o fim do carregamento */
    this._idiomaPendente = '';
    /** O mudo da plataforma, por parte. */
    this._som = { tudo: false, sfx: false, musica: false };
    /** @type {null|(()=>void)} quem o anuncio em curso avisa quando o video entra */
    this._aoComecarAnuncio = null;
    this._fonteCirilica();
    this._chama(() => onLangChange(() => this._carregaCirilico()));
    if (this._promessaSdk) {
      Promise.resolve(this._promessaSdk).then(
        (gp) => this._chegou(gp),
        () => {},
      );
    }
  }

  // ------------------------------------------------------------ o SDK

  /**
   * A espera do SDK, uma vez so: ate o SDK chegar ou ate `esperaMs` desde a
   * abertura da pagina. Nunca rejeita; sem SDK, `ready` fica falso e o jogo
   * segue. Se ele chegar depois, `_chegou` liga tudo ali.
   * @returns {Promise<void>}
   */
  _iniciarUmaVez() {
    if (this._pedidoInit) return this._pedidoInit;
    const resta = Math.max(0, this.esperaMs - this._desdeAbertura());
    const barra = this._barraDeEspera();
    const chegou = this._promessaSdk ? Promise.resolve(this._promessaSdk).then(() => true) : Promise.resolve(false);
    this._pedidoInit = comPrazo(chegou, resta, false).then(() => {
      window.clearInterval(barra);
      this.esperaAcabou = true;
    });
    return this._pedidoInit;
  }

  /**
   * O SDK chegou (no prazo ou depois): guarda o `gp`, assina pausa e som, e
   * faz o que ja devia ter feito se ele estivesse la.
   * @param {*} gp
   */
  _chegou(gp) {
    if (this._gp || !gp || typeof gp !== 'object') return;
    this._gp = gp;
    this.ready = true;
    this._chama(() => {
      gp.on('pause', () => this._pausaDoPortal(true));
      gp.on('resume', () => this._pausaDoPortal(false));
    });
    this._chama(() => {
      if (gp.isMobile === true) this.device = 'mobile';
    });
    const s = this._chama(() => gp.sounds);
    if (s) {
      this._chama(() => {
        this._som.tudo = s.isMuted === true;
        this._som.sfx = s.isSFXMuted === true;
        this._som.musica = s.isMusicMuted === true;
      });
      /** @type {Array<[string, 'tudo'|'sfx'|'musica', boolean]>} */
      const eventos = [
        ['mute', 'tudo', true],
        ['unmute', 'tudo', false],
        ['mute:sfx', 'sfx', true],
        ['unmute:sfx', 'sfx', false],
        ['mute:music', 'musica', true],
        ['unmute:music', 'musica', false],
      ];
      for (const [ev, parte, mudo] of eventos) {
        this._chama(() =>
          s.on(ev, () => {
            this._som[parte] = mudo;
            this._aplicaSom();
          }),
        );
      }
      this._ligaBarramentos();
      this._aplicaSom();
    }
    this._chama(() => gp.ads.on('start', () => this._aoComecarAnuncio && this._aoComecarAnuncio()));
    if (this._idiomaDecidido) {
      // Chegou depois do prazo: o jogo ja abriu num idioma.
      const lang = this._idiomaDoSdk();
      if (lang && lang !== getLang() && !this._escolhaDoJogador()) this._trocaIdiomaTardia(lang);
    }
    if (this.loadingFinished) this._gameStart();
    if (this.inGameplay && !this.inBreak) this._chama(() => gp.gameplayStart());
  }

  /** O idioma do SDK, quando o jogo o tem; senao ''. */
  _idiomaDoSdk() {
    const lang = this._chama(() => this._gp && this._gp.language);
    if (typeof lang !== 'string') return '';
    const base = lang.toLowerCase().split(/[-_]/)[0];
    return LANGS.includes(base) ? base : '';
  }

  /** O idioma que o jogador escolheu nos ajustes, se escolheu. */
  _escolhaDoJogador() {
    const salvo = this._chama(() => load('lang', null));
    return typeof salvo === 'string' && LANGS.includes(salvo) ? salvo : '';
  }

  /**
   * Antes de main.js (src/portais/inicio.js), com o SDK ou o prazo vencido: o
   * idioma. A deteccao de core/i18n.js rodou antes de o russo existir, entao a
   * escolha e refeita aqui, na ordem: ajustes, SDK, navegador, ingles.
   */
  async _preparar() {
    this._idiomaDecidido = true;
    const doSdk = this._idiomaDoSdk();
    const lang = this._escolhaDoJogador() || doSdk || idiomaDoNavegador() || 'en';
    idiomaDaPlataforma(lang);
    this._carregaCirilico();
  }

  /** @param {string} lang */
  _trocaIdiomaTardia(lang) {
    if (!this.loadingFinished) {
      this._idiomaPendente = lang;
      return;
    }
    // Depois do boot de main.js, que liga o onLangChange logo depois do
    // gameLoadingFinished: a tela inteira troca como na troca dos ajustes.
    window.setTimeout(() => {
      if (!this._escolhaDoJogador()) idiomaDaPlataforma(lang);
    }, 0);
  }

  /** A barra do #loader anda durante a espera do SDK (ate 30%; main.js segue de 35%). */
  _barraDeEspera() {
    if (typeof document === 'undefined' || !document.getElementById) return 0;
    const barra = document.getElementById('loaderBar');
    if (!barra) return 0;
    const passo = () => {
      const p = Math.min(1, this._desdeAbertura() / Math.max(1, this.esperaMs));
      barra.style.width = `${Math.round(5 + 25 * p)}%`;
    };
    passo();
    return window.setInterval(passo, 200);
  }

  // ------------------------------------------------------------ fonte

  /**
   * A Fredoka do grito da vitoria (canvas) nao tem cirilico. A Nunito Black
   * (OFL, so as letras cirilicas) entra na mesma familia 'Fredoka' pelo
   * unicode-range: em russo as letras saem dela, e numeros e pontuacao
   * continuam na Fredoka. So este build tem a regra e o arquivo.
   */
  _fonteCirilica() {
    if (typeof document === 'undefined' || !document.head) return;
    this._chama(() => {
      const s = document.createElement('style');
      s.textContent =
        `@font-face { font-family: 'Fredoka'; src: url('${FONTE_CIRILICA}') format('woff2'); ` +
        `font-weight: 700; font-display: swap; unicode-range: ${CIRILICO}; }`;
      document.head.appendChild(s);
    });
  }

  /** Em russo, a fonte cirilica ja carregada antes do primeiro grito (o canvas nao espera fonte). */
  _carregaCirilico() {
    if (getLang() !== 'ru' || typeof document === 'undefined' || !document.fonts || !document.fonts.load) return;
    this._chama(() => document.fonts.load("700 80px 'Fredoka'", 'ИДЕАЛЬНО').catch(() => {}));
  }

  // ------------------------------------------------------------ som

  /** O mudo da plataforma: tudo pelo mudo de base.js; efeitos e musica pelos barramentos. */
  _aplicaSom() {
    this._audioDoPortal(!this._som.tudo);
    this._barramentos();
  }

  /**
   * `mute:sfx` e `mute:music` calam so uma parte, sem mexer na escolha do
   * jogador (audio.sfxOn e musicOn, gravados no storage): o barramento fica em
   * zero enquanto a plataforma pede, e volta ao que o jogador escolheu.
   */
  _barramentos() {
    const a = /** @type {*} */ (audio);
    if (!a.ctx) return;
    this._chama(() => {
      const t = a.ctx.currentTime;
      if (a.sfxBus) a.sfxBus.gain.setTargetAtTime(a.sfxOn && !this._som.sfx ? GANHO.sfx : 0, t, 0.02);
      if (a.musicBus) a.musicBus.gain.setTargetAtTime(a.musicOn && !this._som.musica ? GANHO.musica : 0, t, 0.05);
    });
  }

  /**
   * O jogador mexe nos botoes de som, e o contexto de audio nasce no primeiro
   * gesto: depois de cada um, o mudo parcial da plataforma vale de novo.
   */
  _ligaBarramentos() {
    donoDoSom = this;
    const a = /** @type {*} */ (audio);
    if (a.__gamepush) return;
    a.__gamepush = true;
    for (const m of ['init', 'setSfx', 'setMusic']) {
      const original = a[m];
      if (typeof original !== 'function') continue;
      a[m] = (/** @type {*[]} */ ...args) => {
        const r = original.apply(a, args);
        const dono = donoDoSom;
        if (dono && (dono._som.sfx || dono._som.musica)) dono._barramentos();
        return r;
      };
    }
  }

  // ------------------------------------------------------------ ciclo

  /** O jogador ja pode interagir: o gameStart, se o SDK ja estiver aqui. */
  gameLoadingFinished() {
    const antes = this.loadingFinished;
    super.gameLoadingFinished();
    if (antes) return;
    if (this._idiomaPendente) {
      const lang = this._idiomaPendente;
      this._idiomaPendente = '';
      this._trocaIdiomaTardia(lang);
    }
  }

  _carregou() {
    this._gameStart();
  }

  /** `gp.gameStart()`, uma vez por carga. */
  _gameStart() {
    if (this.gameStartFeito || !this._gp) return;
    this.gameStartFeito = true;
    this._ultimoMarco = this._agora();
    this._chama(() => this._gp.gameStart());
  }

  /** @param {boolean} jogando */
  _gameplay(jogando) {
    if (jogando) this._gp.gameplayStart();
    else this._gp.gameplayStop();
  }

  // ------------------------------------------------------------ anuncios

  /**
   * Ha video premiado agora? O SDK pronto, nenhum anuncio na tela e a GamePush
   * dizendo que ha anuncio. main.js pergunta cada vez que mostra um botao de
   * video (VIDEO_NA_HORA).
   * @returns {boolean}
   */
  haVideo() {
    if (!this.ready || !this._gp || this.inBreak) return false;
    return this._chama(() => this._gp.ads.isRewardedAvailable) === true;
  }

  /** Pode sair um intersticial agora? */
  podeIntersticial() {
    if (!this.ready || !this._gp || this.inBreak || !this.gameStartFeito) return false;
    if (this._agora() - this._ultimoMarco < INTERVALO_MIN_S * 1000) return false;
    return this._chama(() => this._gp.ads.isFullscreenAvailable) === true;
  }

  /**
   * Intervalo comercial: so nos pontos de base.js, e so com `podeIntersticial`.
   * Fora disso resolve na hora, sem parar o jogo.
   * @param {string} [ponto]
   * @returns {Promise<void>}
   */
  async commercialBreak(ponto) {
    if (!this.pontos.has(ponto || '') || !this.podeIntersticial()) return;
    await super.commercialBreak(ponto);
  }

  /**
   * Video premiado. O premio so com `true`. Sem anuncio, quem avisa e a propria
   * GamePush (`showFailedOverlay`): o toast do jogo fica para o caso sem SDK.
   * @param {'small'|'medium'|'large'} [_size]
   * @returns {Promise<boolean>}
   */
  async rewardedBreak(_size) {
    if (this.inBreak) return false;
    if (!this.ready || !this._gp) {
      if (this.onSemVideo) this.onSemVideo();
      return false;
    }
    this.gameplayStop();
    this.inBreak = true;
    if (this.onAdStart) this.onAdStart();
    const ok = await this._pedir('rewarded');
    this.inBreak = false;
    if (this.onAdEnd) this.onAdEnd();
    return ok;
  }

  /**
   * @param {'midgame'|'rewarded'} tipo
   * @param {()=>void} comecou
   * @returns {Promise<boolean>}
   */
  _anuncio(tipo, comecou) {
    const ads = this._gp.ads;
    this._aoComecarAnuncio = comecou;
    this._ultimoMarco = this._agora();
    const fim = (/** @type {boolean} */ ok) => {
      this._aoComecarAnuncio = null;
      this._ultimoMarco = this._agora();
      return ok;
    };
    const pedido = tipo === 'midgame' ? ads.showFullscreen() : ads.showRewardedVideo({ showFailedOverlay: true });
    return Promise.resolve(pedido).then(
      (ok) => fim(ok === true),
      () => fim(false),
    );
  }
}

/** A promessa que o script antes do carregador oficial deixa na pagina. */
function sdkDaPagina() {
  try {
    const p = /** @type {*} */ (window).__gpPronto;
    return p && typeof p.then === 'function' ? p : null;
  } catch {
    return null;
  }
}

/** O primeiro idioma do navegador que o jogo tem (ja com o russo), ou ''. */
function idiomaDoNavegador() {
  try {
    const tags = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    for (const tag of tags) {
      const base = String(tag).toLowerCase().split(/[-_]/)[0];
      if (LANGS.includes(base)) return base;
    }
  } catch {
    /* sem navigator */
  }
  return '';
}

export const plataforma = new PortalGamePush();
