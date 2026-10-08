/**
 * Backend simulado, com o mesmo formato de backend.js.
 *
 * So entra quando o build `app` roda no navegador em 127.0.0.1/localhost
 * (nativo.js o carrega por import dinamico, entao no aparelho ele nem baixa). E
 * por ele que tools/appcheck.mjs joga a politica de anuncio, a compra e o
 * voltar sem aparelho nenhum.
 *
 * O comportamento sai de `window.__nativoSimulado` (pode ser montado antes do
 * carregamento ou mudado a qualquer hora), e cada chamada fica registrada em
 * `window.__nativoLog`.
 */

const PADRAO = {
  /** 'NOT_REQUIRED' | 'REQUIRED' (abre o formulario) | 'OBTAINED' */
  consentimento: 'NOT_REQUIRED',
  privacidadeObrigatoria: false,
  podePedir: true,
  /** o anuncio carrega? */
  carrega: true,
  atrasoCarregarMs: 30,
  /** o show() funciona? */
  abre: true,
  /** o anuncio fecha sozinho? Falso simula o evento de fechar que nunca chega. */
  fecha: true,
  atrasoFecharMs: 60,
  /** o recompensado paga? */
  premia: true,
  /** o premio chega depois do fechar, como em alguns adaptadores de mediacao */
  premioDepoisDeFechar: false,
  loja: true,
  preco: 'R$ 9,90',
  /** a loja ja tem a compra (reinstalacao, outro aparelho) */
  jaComprado: false,
  /** resultado de comprar(): 'ok' | 'pendente' | 'cancelado' | 'erro' */
  compra: 'ok',
  /** document.hidden do simulado */
  escondido: false,
  /** soma ao relogio: a automacao anda 120 s sem esperar 120 s */
  avancoMs: 0,
};

/** @returns {*} */
export function criarBackendSimulado() {
  const w = /** @type {*} */ (window);
  const cfg = Object.assign({}, PADRAO, w.__nativoSimulado || {});
  /** @type {Array<{t:number, area:string, acao:string, dados?:*}>} */
  const log = [];
  w.__nativoSimulado = cfg;
  w.__nativoLog = log;

  const agora = () => Date.now() + (cfg.avancoMs || 0);
  /** @param {string} area @param {string} acao @param {*} [dados] */
  const anota = (area, acao, dados) => log.push({ t: agora(), area, acao, dados });

  /** @type {null|((evento:string, tipo:string)=>void)} */
  let ouvinteAds = null;
  /** @type {null|((evento:string)=>void)} */
  let ouvinteCiclo = null;
  let comprado = !!cfg.jaComprado;
  /** @type {null|string} */
  let aberto = null;

  const emitirAd = (/** @type {string} */ ev, /** @type {string} */ tipo) => {
    anota('ads', ev, { tipo });
    if (ouvinteAds) ouvinteAds(ev, tipo);
  };

  const fechar = () => {
    const tipo = aberto;
    if (!tipo) return;
    aberto = null;
    if (tipo === 'recompensado' && cfg.premia && !cfg.premioDepoisDeFechar) emitirAd('premio', tipo);
    emitirAd('fechou', tipo);
    if (tipo === 'recompensado' && cfg.premia && cfg.premioDepoisDeFechar) {
      window.setTimeout(() => emitirAd('premio', tipo), 150);
    }
  };

  /** Fecha o anuncio aberto quando `fecha` e falso (o teste escolhe a hora). */
  cfg.fechar = fechar;
  /** Dispara um evento do ciclo de vida: 'voltar' | 'pausa' | 'volta'. */
  cfg.emitir = (/** @type {string} */ ev) => {
    anota('ciclo', ev);
    if (ouvinteCiclo) ouvinteCiclo(ev);
  };

  return {
    nome: 'simulado',
    plataforma: 'android',
    agora,
    escondido: () => !!cfg.escondido,

    ads: {
      async consentir() {
        anota('ads', 'consentir', { status: cfg.consentimento });
        return {
          status: cfg.consentimento,
          podePedir: !!cfg.podePedir,
          privacidadeObrigatoria: !!cfg.privacidadeObrigatoria,
        };
      },
      async abrirPrivacidade() {
        anota('ads', 'privacidade');
      },
      async rastreamento() {
        anota('ads', 'rastreamento');
      },
      async iniciar() {
        anota('ads', 'iniciar');
      },
      /** @param {string} tipo */
      carregar(tipo) {
        anota('ads', 'carregar', { tipo });
        return new Promise((resolve, reject) => {
          window.setTimeout(() => {
            if (cfg.carrega) {
              anota('ads', 'carregou', { tipo });
              resolve(undefined);
            } else {
              anota('ads', 'falhou-carregar', { tipo });
              reject(new Error('sem anuncio'));
            }
          }, cfg.atrasoCarregarMs);
        });
      },
      /** @param {string} tipo */
      async mostrar(tipo) {
        anota('ads', 'mostrar', { tipo });
        if (!cfg.abre) throw new Error('nao abriu');
        aberto = tipo;
        window.setTimeout(() => emitirAd('abriu', tipo), 5);
        if (cfg.fecha) window.setTimeout(fechar, cfg.atrasoFecharMs);
      },
      /** @param {(evento:string, tipo:string)=>void} fn */
      ouvir(fn) {
        ouvinteAds = fn;
      },
    },

    analytics: {
      /** @param {string} nome @param {*} params */
      evento(nome, params) {
        anota('analytics', nome, params);
      },
      /** @param {string} chave @param {string} valor */
      propriedade(chave, valor) {
        anota('analytics', 'propriedade', { chave, valor });
      },
      /** @param {boolean} concedido */
      consentimento(concedido) {
        anota('analytics', 'consentimento', { concedido });
      },
    },

    loja: {
      async suportada() {
        return !!cfg.loja;
      },
      async preco() {
        return cfg.preco;
      },
      async compras() {
        return comprado ? [{ estado: 'comprado', token: 'tok-sim', reconhecida: true }] : [];
      },
      async comprar() {
        anota('loja', 'comprar', { resultado: cfg.compra });
        if (cfg.compra === 'ok') comprado = true;
        return cfg.compra;
      },
      async reconhecer() {
        anota('loja', 'reconhecer');
      },
      async restaurar() {
        anota('loja', 'restaurar');
        if (cfg.jaComprado) comprado = true;
      },
    },

    ciclo: {
      /** @param {(evento:string)=>void} fn */
      ouvir(fn) {
        ouvinteCiclo = fn;
      },
      minimizar() {
        anota('ciclo', 'minimizar');
      },
      esconderSplash() {
        anota('ciclo', 'splash');
      },
      esconderBarras() {},
    },
  };
}
