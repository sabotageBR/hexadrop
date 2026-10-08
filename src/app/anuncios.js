/**
 * Mecanica de anuncio do app: consentimento, carga, validade e exibicao.
 *
 * Nao decide QUANDO mostrar - isso e de nativo.js. Aqui so se garante que um
 * anuncio pedido termina, de um jeito ou de outro: o jogo para tudo enquanto
 * ele esta na tela (a troca de fase fica em `tr.anuncio`, o recomeco em
 * `advancing`, o toque e o laco desligados), e um evento de fechar que nunca
 * chega deixaria o jogador preso para sempre.
 */

/** O anuncio carregado vale 1 h; recarrega antes. */
const VALIDADE_MS = 55 * 60 * 1000;

/** Esperas entre tentativas de carga que falharam (sem rede, sem estoque). */
const ESPERAS_MS = [5000, 15000, 30000, 60000, 120000];

/** O premio pode chegar depois do fechar (alguns adaptadores de mediacao). */
const ESPERA_PREMIO_MS = 500;

/**
 * Prazo de seguranca de um anuncio na tela. No iOS o anuncio e um view
 * controller por cima do WebView e nao ha evento de visibilidade que denuncie
 * um fechar perdido, entao so resta o prazo - longo, porque um prazo curto
 * soltaria o jogo por baixo de um video que ainda esta passando.
 */
const SEGURANCA_MS = 4 * 60 * 1000;

/** No Android, o app ativo de novo com o anuncio ainda "aberto" e fechar perdido. */
const VIGIA_MS = 1500;

/** @typedef {'intersticial'|'recompensado'} Tipo */

export class Anuncios {
  /** @param {*} backend */
  constructor(backend) {
    this.b = backend;
    this.ads = backend.ads;
    /** O consentimento permite pedir anuncio (ou a lei nao pede consentimento). */
    this.podePedir = false;
    this.iniciado = false;
    this.privacidadeObrigatoria = false;
    /** @type {string} */
    this.statusConsentimento = 'UNKNOWN';
    /** @type {Record<Tipo, {pronto:boolean, em:number, carregando:boolean, falhas:number, timer:number, esperas:Array<(ok:boolean)=>void>}>} */
    this.estado = {
      intersticial: { pronto: false, em: 0, carregando: false, falhas: 0, timer: 0, esperas: [] },
      recompensado: { pronto: false, em: 0, carregando: false, falhas: 0, timer: 0, esperas: [] },
    };
    /** O anuncio na tela, e como encerra-lo. @type {null|{tipo:Tipo, evento:(ev:string)=>void, encerrar:()=>void}} */
    this.exibindo = null;
    this.ads.ouvir((/** @type {string} */ ev, /** @type {Tipo} */ tipo) => {
      if (this.exibindo && this.exibindo.tipo === tipo) this.exibindo.evento(ev);
    });
  }

  /**
   * UMP, ATT no iOS, SDK e as duas primeiras cargas, nesta ordem. A Google
   * pede consentimento antes de qualquer pedido de anuncio.
   * @returns {Promise<boolean>} pode pedir anuncio
   */
  async iniciar() {
    try {
      const c = await this.ads.consentir();
      this.statusConsentimento = c.status;
      this.podePedir = !!c.podePedir;
      this.privacidadeObrigatoria = !!c.privacidadeObrigatoria;
    } catch {
      // Sem resposta do UMP (offline na primeira abertura): sem consentimento
      // conhecido nao se pede anuncio. Tenta de novo na proxima abertura.
      this.podePedir = false;
    }
    if (!this.podePedir) return false;
    try {
      await this.ads.rastreamento();
    } catch {
      /* negar o ATT nao impede anuncio, so personalizacao */
    }
    try {
      await this.ads.iniciar();
      this.iniciado = true;
    } catch {
      return false;
    }
    this.carregar('intersticial');
    this.carregar('recompensado');
    return true;
  }

  /** @returns {Promise<void>} */
  async abrirPrivacidade() {
    try {
      await this.ads.abrirPrivacidade();
    } catch {
      /* ignora */
    }
  }

  /**
   * @param {Tipo} tipo
   * @returns {boolean}
   */
  pronto(tipo) {
    const st = this.estado[tipo];
    if (!st.pronto) return false;
    if (this.b.agora() - st.em > VALIDADE_MS) {
      st.pronto = false;
      this.carregar(tipo);
      return false;
    }
    return true;
  }

  /**
   * Carrega se ainda nao ha anuncio pronto nem carga em andamento. Falha
   * agenda outra tentativa, com espera crescente.
   * @param {Tipo} tipo
   * @param {boolean} [agora] ignora a espera agendada (o jogador pediu o video)
   */
  carregar(tipo, agora = false) {
    const st = this.estado[tipo];
    if (!this.iniciado || st.carregando || this.pronto(tipo)) return;
    if (st.timer) {
      if (!agora) return;
      window.clearTimeout(st.timer);
      st.timer = 0;
    }
    st.carregando = true;
    this.ads.carregar(tipo).then(
      () => {
        st.carregando = false;
        st.pronto = true;
        st.em = this.b.agora();
        st.falhas = 0;
        this._acorda(tipo, true);
      },
      () => {
        st.carregando = false;
        st.falhas += 1;
        const espera = ESPERAS_MS[Math.min(st.falhas - 1, ESPERAS_MS.length - 1)];
        st.timer = window.setTimeout(() => {
          st.timer = 0;
          this.carregar(tipo);
        }, espera);
        this._acorda(tipo, false);
      },
    );
  }

  /**
   * @param {Tipo} tipo
   * @param {boolean} ok
   */
  _acorda(tipo, ok) {
    const st = this.estado[tipo];
    // Falha de carga so encerra a espera de quem ja esgotou o tempo; quem
    // espera continua esperando a proxima tentativa ate o prazo dele.
    if (!ok) return;
    const fila = st.esperas.splice(0);
    for (const fn of fila) fn(true);
  }

  /**
   * Espera um anuncio ficar pronto, ate `ms`. Pede a carga na hora, mesmo que
   * houvesse uma espera agendada: o jogador esta olhando para o veu.
   * @param {Tipo} tipo
   * @param {number} ms
   * @returns {Promise<boolean>}
   */
  esperarPronto(tipo, ms) {
    if (this.pronto(tipo)) return Promise.resolve(true);
    const st = this.estado[tipo];
    return new Promise((resolve) => {
      let feito = false;
      const fim = (/** @type {boolean} */ ok) => {
        if (feito) return;
        feito = true;
        window.clearTimeout(timer);
        const i = st.esperas.indexOf(fim);
        if (i >= 0) st.esperas.splice(i, 1);
        resolve(ok && this.pronto(tipo));
      };
      const timer = window.setTimeout(() => fim(false), ms);
      st.esperas.push(fim);
      this.carregar(tipo, true);
      // Ainda sem SDK (consentimento em andamento): `iniciar()` chama
      // carregar() quando terminar, e a espera pega essa carga.
    });
  }

  /**
   * Mostra e espera terminar. Resolve sempre: no fechar, na falha ao mostrar,
   * no vigia do Android ou no prazo de seguranca.
   * @param {Tipo} tipo
   * @returns {Promise<{mostrou:boolean, premio:boolean}>}
   */
  mostrar(tipo) {
    if (this.exibindo || !this.pronto(tipo)) return Promise.resolve({ mostrou: false, premio: false });
    const st = this.estado[tipo];
    st.pronto = false;
    return new Promise((resolve) => {
      let premio = false;
      let fechou = false;
      let acabou = false;
      let timerPremio = 0;
      const fim = (/** @type {boolean} */ mostrou) => {
        if (acabou) return;
        acabou = true;
        window.clearTimeout(timerPremio);
        window.clearTimeout(timerSeguranca);
        if (this.exibindo === atual) this.exibindo = null;
        this.carregar(tipo);
        resolve({ mostrou, premio });
      };
      const atual = {
        tipo,
        evento: (/** @type {string} */ ev) => {
          if (ev === 'premio') {
            premio = true;
            if (fechou) fim(true);
          } else if (ev === 'fechou') {
            fechou = true;
            if (tipo === 'recompensado' && !premio) {
              timerPremio = window.setTimeout(() => fim(true), ESPERA_PREMIO_MS);
            } else fim(true);
          } else if (ev === 'falhou-mostrar') {
            fim(false);
          }
        },
        encerrar: () => fim(true),
      };
      this.exibindo = atual;
      const timerSeguranca = window.setTimeout(() => fim(true), SEGURANCA_MS);
      this.ads.mostrar(tipo).catch(() => fim(false));
    });
  }

  /**
   * O app voltou a ficar ativo. No Android o anuncio e uma Activity propria:
   * se o app esta ativo e visivel de novo, o anuncio ja saiu da frente, e um
   * `exibindo` que continua de pe e um fechar que se perdeu.
   */
  vigiar() {
    const atual = this.exibindo;
    if (!atual || this.b.plataforma !== 'android') return;
    window.setTimeout(() => {
      if (this.exibindo === atual && !this.b.escondido()) atual.encerrar();
    }, VIGIA_MS);
  }
}
