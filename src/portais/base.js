/**
 * O que os portais de distribuicao (Y8, Playgama, Yandex, GameMonetize,
 * GameDistribution e GamePix) tem em comum, com a interface do wrapper da Poki
 * (src/poki.js) e da CrazyGames (src/crazy/crazy.js).
 *
 * main.js importa `@plataforma`; no build de cada portal o alias de
 * vite.config.js aponta para src/portais/<portal>.js, que estende `Portal` e
 * so diz como falar com o SDK daquele portal (os ganchos `_` abaixo). Aqui
 * fica o que nao muda de um para outro:
 *
 * - **o jogo se comporta igual sem SDK** (bloqueador de anuncios, outro
 *   dominio, SDK que nao responde): `init` tem prazo, toda chamada passa por
 *   `_chama`, que engole excecao, e pedido de video sem resposta tem prazo;
 * - **gameplayStart/Stop idempotentes** e nada de evento durante anuncio;
 * - **intervalo so entre fases**: nem ao `retomar` da pausa, que e navegacao,
 *   nem no `repetir` do cartao de derrota, que ja oferece o video de voltar
 *   uma jogada ao lado (`pontos`; a Y8 troca a lista, porque la o intervalo
 *   so pode vir de um clique). A frequencia e do SDK de cada portal (todos
 *   limitam); a carencia das primeiras fases continua em main.js;
 * - **o premio so com o fim do video** (`_anuncio` resolve true so ai), e sem
 *   video o botao nao fica mudo: o toast diz que nao ha video agora;
 * - **a pausa do portal** (o botao de pausa do site, o menu dele por cima) cala
 *   o jogo pelo mudo da plataforma e abre a tela de pausa; a volta do portal
 *   fecha a tela e o jogo segue sozinho, como os portais esperam
 *   (`_pausaDoPortal`, `onPausaPortal` em main.js);
 * - **a aba escondida pausa a fase** com a tela de pausa, e a volta da aba
 *   retoma sozinha (`onAba`, `pausaDaAba` em main.js). O som ja parava;
 *   faltava a pausa se ver e o jogo voltar - o Testing Toolkit da GamePix
 *   pergunta se o jogo pausou e voltou quando outra aba abriu.
 */

/** Pedido de video sem comecar nem falhar: o jogo nao pode ficar parado. */
const PEDIDO_TIMEOUT = 15000;
/** Video que comecou e nunca terminou: a rede de seguranca, longa de proposito. */
const VIDEO_TIMEOUT = 180000;
/** O init de cada SDK; estourado, a sessao segue sem ele. */
export const INIT_TIMEOUT = 6000;

/**
 * Espera uma promessa ate `ms`; estourado o prazo ou rejeitada, `reserva`.
 * Nunca rejeita.
 * @template T
 * @param {*} promessa
 * @param {number} ms
 * @param {T} reserva
 * @returns {Promise<T>}
 */
export function comPrazo(promessa, ms, reserva) {
  return new Promise((resolve) => {
    let fim = false;
    const sai = (/** @type {*} */ v) => {
      if (fim) return;
      fim = true;
      window.clearTimeout(prazo);
      resolve(v);
    };
    const prazo = window.setTimeout(() => sai(reserva), ms);
    Promise.resolve(promessa).then(sai, () => sai(reserva));
  });
}

export class Portal {
  constructor() {
    this.ready = false;
    this.loadingFinished = false;
    /** true entre gameplayStart e gameplayStop */
    this.inGameplay = false;
    /** true durante um pedido de video, quando nenhum evento pode ser disparado */
    this.inBreak = false;
    /** @type {'desktop'|'tablet'|'mobile'|null} */
    this.device = null;
    /**
     * O som fica para `onAdPlay` (main.js nao silencia no `onAdStart`) quando o
     * SDK avisa a hora em que o video entra; o portal que nao avisa poe false.
     */
    this.silencioNoVideo = true;
    /** Ligado quando o portal diz que nao ha anuncio nesta sessao. */
    this._semAnuncios = false;
    /**
     * De onde o intervalo comercial pode sair (o `ponto` de main.js): troca
     * e recomeco sao as passagens do jogo corrido, proxima o cartao de vitoria.
     * @type {Set<string>}
     */
    this.pontos = new Set(['troca', 'proxima', 'recomeco']);
    /** Prazo de `_preparar` (o pre-roll da GameDistribution precisa de mais). */
    this.prazoPreparo = INIT_TIMEOUT;
    /** O portal pausou o jogo (menu do site, aba escondida pelo portal). */
    this._pausadoPeloPortal = false;
    /** O portal mandou calar (o som desligado no site). */
    this._mudoPeloPortal = false;
    /** Pedido sem o video comecar: o jogo nao pode ficar parado mais que isso. */
    this.prazoPedido = PEDIDO_TIMEOUT;
    /** @type {Promise<void>|null} */
    this._pedidoInit = null;
    /** @type {null|(()=>void)} */
    this.onAdStart = null;
    /** @type {null|(()=>void)} */
    this.onAdEnd = null;
    /** @type {null|(()=>void)} o video comecou de fato: hora de silenciar */
    this.onAdPlay = null;
    /** @type {null|((mudo:boolean)=>void)} */
    this.onSilencio = null;
    /** @type {null|((on:boolean)=>void)} */
    this.onAdLoading = null;
    /** @type {null|(()=>void)} */
    this.onSemVideo = null;
    // O que so o app tem (src/app/nativo.js): aqui nunca dispara.
    this.loja = null;
    this.privacidade = null;
    /** @type {null|(()=>void)} */
    this.onVoltar = null;
    /** @type {null|(()=>void)} */
    this.onSegundoPlano = null;
    /** @type {null|(()=>void)} */
    this.onPrimeiroPlano = null;
    /** @type {null|((pausado:boolean)=>void)} o portal congelou ou devolveu o jogo */
    this.onPausaPortal = null;
    /** @type {null|((escondida:boolean)=>void)} a aba sumiu ou voltou */
    this.onAba = null;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (this.onAba) this.onAba(document.hidden);
      });
    }
  }

  // ------------------------------------------------------------ ganchos

  /**
   * Inicia o SDK do portal. Resolve true com ele pronto, false sem ele.
   * @returns {Promise<boolean>}
   */
  async _iniciar() {
    return false;
  }

  /** O jogador ja pode interagir. */
  _carregou() {}

  /** @param {boolean} _jogando */
  _gameplay(_jogando) {}

  /**
   * Pede um anuncio. Chama `comecou()` quando o video entra na tela, se o SDK
   * avisa, e resolve true so quando ele termina (no recompensado: com premio).
   * @param {'midgame'|'rewarded'} _tipo
   * @param {()=>void} _comecou
   * @returns {Promise<boolean>}
   */
  async _anuncio(_tipo, _comecou) {
    return false;
  }

  /**
   * Os eventos do jogo (`measure`), para o portal que tem algo parecido.
   * @param {string} _categoria
   * @param {string} _oque
   * @param {string} _acao
   */
  _evento(_categoria, _oque, _acao) {}

  /** @param {number} _fases fases da campanha concluidas */
  _progresso(_fases) {}

  /**
   * Antes de main.js ser avaliado (src/portais/inicio.js): o save e o idioma
   * do portal. O SDK ja respondeu (ou desistiu) quando isto roda.
   * @returns {Promise<void>}
   */
  async _preparar() {}

  // ------------------------------------------------------------ interface

  /**
   * Chama `fn` engolindo excecao: SDK quebrado nao derruba o jogo.
   * @param {()=>*} fn
   * @returns {*}
   */
  _chama(fn) {
    try {
      return fn();
    } catch {
      return undefined;
    }
  }

  /**
   * Resolve mesmo quando o SDK nao carrega; o SDK inicia uma vez so. Quem chama
   * de novo (main.js, depois de src/portais/inicio.js) ja ligou os ganchos, e
   * o silencio que o portal pediu antes disso vale dali em diante.
   * @returns {Promise<void>}
   */
  init() {
    return this._iniciarUmaVez().then(() => this._aplicaSilencio());
  }

  /** @returns {Promise<void>} */
  _iniciarUmaVez() {
    if (this._pedidoInit) return this._pedidoInit;
    this._pedidoInit = comPrazo(
      Promise.resolve()
        .then(() => this._iniciar())
        .catch(() => false),
      INIT_TIMEOUT,
      false,
    ).then((ok) => {
      this.ready = ok === true;
    });
    return this._pedidoInit;
  }

  /** O que src/portais/inicio.js roda antes de main.js. */
  async preparar() {
    await this._iniciarUmaVez();
    await comPrazo(Promise.resolve().then(() => this._preparar()), this.prazoPreparo, undefined);
  }

  /** Dispara uma unica vez, quando o jogador ja pode interagir. */
  gameLoadingFinished() {
    if (this.loadingFinished) return;
    this.loadingFinished = true;
    if (this.ready) this._chama(() => this._carregou());
  }

  /** So no primeiro input real do jogador, nunca no carregamento. */
  gameplayStart() {
    if (this.inGameplay || this.inBreak) return;
    this.inGameplay = true;
    if (this.ready) this._chama(() => this._gameplay(true));
  }

  /** Em qualquer interrupcao: pausa, menu, fim de fase, derrota. */
  gameplayStop() {
    if (!this.inGameplay) return;
    this.inGameplay = false;
    if (this.ready) this._chama(() => this._gameplay(false));
  }

  /**
   * Pede o anuncio e espera ele acabar, falhar ou estourar o prazo: 15 s ate
   * comecar, e dai 180 s.
   * @param {'midgame'|'rewarded'} tipo
   * @returns {Promise<boolean>}
   */
  _pedir(tipo) {
    return new Promise((resolve) => {
      let fim = false;
      let prazo = 0;
      const sai = (/** @type {boolean} */ ok) => {
        if (fim) return;
        fim = true;
        window.clearTimeout(prazo);
        resolve(ok);
      };
      const espera = (/** @type {number} */ ms) => {
        window.clearTimeout(prazo);
        prazo = window.setTimeout(() => sai(false), ms);
      };
      espera(this.prazoPedido);
      let comecou = false;
      const aoComecar = () => {
        if (fim || comecou) return;
        comecou = true;
        espera(VIDEO_TIMEOUT);
        if (this.onAdLoading) this.onAdLoading(false);
        if (this.silencioNoVideo && this.onAdPlay) this.onAdPlay();
      };
      Promise.resolve()
        .then(() => this._anuncio(tipo, aoComecar))
        .then((ok) => sai(ok === true), () => sai(false));
    });
  }

  /**
   * Intervalo comercial. So entre fases, nunca em navegacao.
   * @param {string} [ponto] de onde vem: troca, proxima, recomeco, repetir, retomar
   * @returns {Promise<void>}
   */
  async commercialBreak(ponto) {
    if (!this.ready || this.inBreak || this._semAnuncios) return;
    if (!this.pontos.has(ponto || '')) return;
    this.gameplayStop();
    this.inBreak = true;
    // Sem aviso do comeco do video (`silencioNoVideo` falso), main.js ja cala
    // o jogo aqui, no pedido.
    if (this.onAdStart) this.onAdStart();
    await this._pedir('midgame');
    this.inBreak = false;
    if (this.onAdEnd) this.onAdEnd();
  }

  /**
   * Video recompensado. So por escolha explicita do jogador, e o premio so vale
   * com o fim do video.
   * @param {'small'|'medium'|'large'} [_size]
   * @returns {Promise<boolean>}
   */
  async rewardedBreak(_size) {
    if (this.inBreak) return false;
    if (!this.ready || this._semAnuncios) {
      if (this.onSemVideo) this.onSemVideo();
      return false;
    }
    this.gameplayStop();
    this.inBreak = true;
    if (this.onAdStart) this.onAdStart();
    // O veu trava a tela do pedido ate o video entrar.
    if (this.silencioNoVideo && this.onAdLoading) this.onAdLoading(true);
    const ok = await this._pedir('rewarded');
    if (this.onAdLoading) this.onAdLoading(false);
    this.inBreak = false;
    if (this.onAdEnd) this.onAdEnd();
    if (!ok && this.onSemVideo) this.onSemVideo();
    return ok;
  }

  /**
   * @param {string} category
   * @param {string} what
   * @param {string} action
   */
  measure(category, what, action) {
    if (this.inBreak || !this.ready) return;
    this._chama(() => this._evento(category, what, action));
  }

  /**
   * Quanto da campanha o jogador ja concluiu, na carga e a cada vitoria.
   * @param {number} fases fases da campanha concluidas
   */
  progresso(fases) {
    if (!this.ready) return;
    this._chama(() => this._progresso(fases));
  }

  /**
   * O portal pausou ou devolveu o jogo fora de um anuncio: cala pelo mudo da
   * plataforma (que fica por cima dos botoes de som) e pausa a fase.
   * @param {boolean} pausado
   */
  _pausaDoPortal(pausado) {
    // O anuncio que o proprio jogo pediu ja pausa e cala por onAdStart/onAdEnd.
    if (this.inBreak && pausado) return;
    if (pausado === this._pausadoPeloPortal) return;
    this._pausadoPeloPortal = pausado;
    this._aplicaSilencio();
    if (this.onPausaPortal) this.onPausaPortal(pausado);
  }

  /**
   * O portal ligou ou desligou o som do jogo (o botao de som do site).
   * @param {boolean} ligado
   */
  _audioDoPortal(ligado) {
    if (ligado === !this._mudoPeloPortal) return;
    this._mudoPeloPortal = !ligado;
    this._aplicaSilencio();
  }

  /** O mudo da plataforma: calado enquanto o portal pausa ou manda calar. */
  _aplicaSilencio() {
    if (this.onSilencio) this.onSilencio(this._pausadoPeloPortal || this._mudoPeloPortal);
  }

  /** @param {Error|string} _err */
  captureError(_err) {}

  /** Nao ha botao flutuante da plataforma por cima do jogo. */
  movePill() {}

  /** So o app minimiza; no navegador nao ha para onde ir. */
  minimizar() {}

  /** @returns {boolean} */
  isTablet() {
    return this.device === 'tablet';
  }

  /** @returns {boolean} */
  isMobileCategory() {
    return this.device === 'mobile' || this.device === 'tablet';
  }
}
