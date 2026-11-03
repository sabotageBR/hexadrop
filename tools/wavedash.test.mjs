/**
 * Teste de unidade do adaptador da Wavedash (src/portais/wavedash.js), em Node
 * puro: um `window.Wavedash` falso que so registra as chamadas, um `document`
 * minimo e os temporizadores do node:test, para a reserva por timer andar sem
 * esperar de verdade.
 *
 *   node --test tools/wavedash.test.mjs     (ou npm run test:wavedash)
 *
 * Cobre o que a Wavedash cobra e a prova do zip (distribuicao/provar-wavedash.mjs)
 * so ve de fora: o init uma vez so, mesmo com o jogo pausado, sem foco e com a
 * aba escondida, e sem requestAnimationFrame; a reserva por timer; a barra de
 * carregamento; intervalo e video premiado saindo na hora, sem anuncio; o idioma
 * so quando o jogo o tem; e o jogo seguindo igual sem `window.Wavedash`.
 *
 * E os pacotes de moedas (src/portais/wavedash-pacotes.js com o credito de
 * game/pacotes.js sobre o Progress de verdade, ligados como main.js liga): um
 * SDK falso que guarda os eventos ate o init, como o de verdade, e um
 * "servidor" de compras que sobrevive a reabertura do jogo. Compra no meio da
 * sessao, reentrega na abertura, entrega repetida, fulfill que falha e depois
 * passa pela lista de pendentes, NOT_FOUND, pacote desconhecido, respostas sem
 * o envelope `{success, data}`, checkout sem evento, o init sem esperar nada
 * disso, e o SDK sem as funcoes pagas.
 *
 * E o save na nuvem (src/portais/wavedash-nuvem.js): um Remote Storage falso
 * cuja "nuvem" sobrevive a uma origem nova (o build novo da Wavedash, que zera
 * o localStorage). Nuvem mais nova, local mais novo, local orfao, nuvem sem
 * arquivo, download que nao responde ou falha (e a leitura que chega tarde),
 * envio que falha, que nao responde e que bate no limite, a ordem credito ->
 * save -> nuvem -> fulfill, a compra com a nuvem fora, a pagina escondida e o
 * SDK sem o Remote Storage.
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// --------------------------------------------------- navegador minimo
// O Date anda junto com os temporizadores: a janela do limite de envios e as
// pausas da nuvem contam pelo Date.now().
mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1790000000000 });
const g = /** @type {*} */ (globalThis);
g.window = globalThis;
/** O localStorage: o save dura entre uma "abertura" e outra. O ultimo teste o quebra. */
const disco = new Map();
let discoQuebrado = false;
g.localStorage = {
  getItem: (/** @type {string} */ k) => (disco.has(k) ? disco.get(k) : null),
  setItem: (/** @type {string} */ k, /** @type {string} */ v) => {
    if (discoQuebrado) throw new Error('QuotaExceededError');
    disco.set(k, String(v));
  },
  removeItem: (/** @type {string} */ k) => disco.delete(k),
  get length() {
    return disco.size;
  },
  key: (/** @type {number} */ i) => [...disco.keys()][i] ?? null,
};
/** Estilos que o adaptador pos na pagina. @type {string[]} */
const estilos = [];
/** @type {Record<string, Function[]>} */
const ouvintes = {};
g.document = {
  hidden: false,
  visibilityState: 'visible',
  hasFocus: () => true,
  head: { appendChild: (/** @type {*} */ el) => estilos.push(el.textContent) },
  createElement: () => ({ textContent: '' }),
  addEventListener: (/** @type {string} */ n, /** @type {Function} */ f) => (ouvintes[n] = ouvintes[n] || []).push(f),
};
/** Quantas vezes alguem pediu um quadro: o init nao pode depender disso. */
let quadrosPedidos = 0;
g.requestAnimationFrame = () => {
  quadrosPedidos++;
  return 0;
};

const { plataforma, PortalWavedash, RESERVA_MS, CARGA } = await import('../src/portais/wavedash.js');
const { getLang } = await import('../src/core/i18n.js');
const { PRAZO_SDK_MS, ESPERA_EVENTO_MS } = await import('../src/portais/wavedash-pacotes.js');
const { creditaCompra, estornaCompra, zeraGuardandoCompras, PACOTES } = await import('../src/game/pacotes.js');
const { Progress } = await import('../src/game/progress.js');
const { load, save, remove, isPersistent, entradasLocais, definirEspelho, PREFIXO } = await import('../src/core/storage.js');
const N = await import('../src/portais/wavedash-nuvem.js');

/**
 * O SDK falso: so registra.
 * @param {{lang?: *, lanca?: boolean}} [o]
 */
function sdkFalso(o = {}) {
  /** @type {Array<[string, *?]>} */
  const chamadas = [];
  const lanca = () => {
    if (o.lanca) throw new Error('SDK quebrado');
  };
  return {
    chamadas,
    init: (/** @type {*} */ cfg) => {
      chamadas.push(['init', cfg]);
      lanca();
      return true;
    },
    loadComplete: () => chamadas.push(['loadComplete']),
    updateLoadProgressZeroToOne: (/** @type {number} */ p) => {
      chamadas.push(['progresso', p]);
      lanca();
    },
    getUserLanguage: () => {
      chamadas.push(['idioma']);
      if (o.lang instanceof Error) throw o.lang;
      return o.lang === undefined ? 'en' : o.lang;
    },
  };
}
/** @param {ReturnType<typeof sdkFalso>} sdk */
const inits = (sdk) => sdk.chamadas.filter((c) => c[0] === 'init').length;
/** @param {ReturnType<typeof sdkFalso>} sdk */
const progresso = (sdk) => sdk.chamadas.filter((c) => c[0] === 'progresso').map((c) => c[1]);

/** O que main.js faz no boot, na ordem, depois de src/portais/inicio.js. */
async function carregar(/** @type {*} */ p) {
  await p.preparar();
  await p.init();
  p.gameLoadingFinished();
}

/** @param {boolean} escondida */
function aba(escondida) {
  g.document.hidden = escondida;
  g.document.visibilityState = escondida ? 'hidden' : 'visible';
  g.document.hasFocus = () => !escondida;
}

// O singleton do modulo nasceu sem SDK: e o caso de rodar fora da Wavedash.
test('sem window.Wavedash o jogo carrega igual e nada lanca', async () => {
  assert.equal(g.Wavedash, undefined);
  await carregar(plataforma);
  assert.equal(plataforma.ready, false);
  assert.equal(plataforma.revelado, true);
  assert.equal(await plataforma.rewardedBreak('medium'), false);
  await plataforma.commercialBreak('troca');
  plataforma.gameplayStart();
  plataforma.gameplayStop();
  plataforma.measure('level', '1', 'start');
  plataforma.progresso(3);
  mock.timers.tick(RESERVA_MS * 2);
  assert.ok(estilos.some((s) => /\.btn\.ad\s*\{\s*display:\s*none/.test(s)), 'botoes de video escondidos');
});

test('init uma vez so: no fim do carregamento, nem repetido nem pela reserva', async () => {
  const sdk = sdkFalso();
  g.Wavedash = sdk;
  try {
    const p = new PortalWavedash();
    await p.preparar();
    await p.init();
    assert.equal(inits(sdk), 0, 'nada antes do fim do carregamento');
    p.gameLoadingFinished();
    assert.equal(inits(sdk), 1);
    assert.equal(p.reveladoPor, 'carregou');
    p.gameLoadingFinished();
    mock.timers.tick(RESERVA_MS * 2);
    assert.equal(inits(sdk), 1, 'nem o segundo aviso nem a reserva chamam de novo');
    assert.equal(sdk.chamadas.filter((c) => c[0] === 'loadComplete').length, 0, 'o init ja faz o loadComplete');
  } finally {
    delete g.Wavedash;
  }
});

test('init sai com o jogo pausado, sem foco, com a aba escondida e sem quadro', async () => {
  const sdk = sdkFalso();
  g.Wavedash = sdk;
  aba(true);
  try {
    const p = new PortalWavedash();
    let pausas = 0;
    p.onPausaPortal = () => pausas++;
    p.onAba = () => {};
    await p.preparar();
    await p.init();
    p._pausaDoPortal(true);
    for (const f of ouvintes.visibilitychange || []) f();
    const antes = quadrosPedidos;
    p.gameLoadingFinished();
    assert.equal(inits(sdk), 1, 'na hora, sem esperar foco, aba visivel ou o fim da pausa');
    assert.equal(quadrosPedidos, antes, 'nenhum requestAnimationFrame');
    assert.equal(pausas, 1);
    p._pausaDoPortal(false);
    aba(false);
    assert.equal(inits(sdk), 1, 'a volta da pausa nao repete o init');
  } finally {
    aba(false);
    delete g.Wavedash;
  }
});

test('reserva por timer: o init sai sozinho se o carregamento nao chegar ao fim', async () => {
  const sdk = sdkFalso();
  g.Wavedash = sdk;
  try {
    const p = new PortalWavedash();
    await p.preparar();
    // main.js nunca chega ao gameLoadingFinished (falhou, travou, quadro que nao vem)
    mock.timers.tick(RESERVA_MS - 1);
    assert.equal(inits(sdk), 0);
    mock.timers.tick(1);
    assert.equal(inits(sdk), 1);
    assert.equal(p.reveladoPor, 'reserva');
    p.gameLoadingFinished();
    assert.equal(inits(sdk), 1, 'o carregamento atrasado nao chama de novo');
  } finally {
    delete g.Wavedash;
  }
});

test('progresso: de 0 a 1, sempre subindo, e nada depois do init', async () => {
  const sdk = sdkFalso();
  g.Wavedash = sdk;
  try {
    const p = new PortalWavedash();
    await carregar(p);
    const ps = progresso(sdk);
    assert.ok(ps.length >= 4, `chamadas: ${ps.join(', ')}`);
    assert.ok(ps.every((v, i) => v > 0 && v <= 1 && (i === 0 || v > ps[i - 1])), `sobe: ${ps.join(', ')}`);
    assert.equal(ps[ps.length - 1], CARGA.pronto);
    const iInit = sdk.chamadas.findIndex((c) => c[0] === 'init');
    const iUltimo = sdk.chamadas.map((c) => c[0]).lastIndexOf('progresso');
    assert.ok(iUltimo < iInit, 'a barra chega a 1 antes do init');
    p._progresso01(0.99);
    p._progresso01(1);
    assert.equal(progresso(sdk).length, ps.length, 'depois do init a barra nao recebe mais nada');
  } finally {
    delete g.Wavedash;
  }
});

test('intervalo e video premiado resolvem na hora, sem anuncio e sem premio', async () => {
  const sdk = sdkFalso();
  g.Wavedash = sdk;
  try {
    const p = new PortalWavedash();
    let pausou = 0;
    let semVideo = 0;
    p.onAdStart = () => pausou++;
    p.onAdEnd = () => pausou++;
    p.onSemVideo = () => semVideo++;
    await carregar(p);
    const antes = sdk.chamadas.length;
    for (const ponto of ['troca', 'proxima', 'recomeco', 'repetir', 'retomar']) await p.commercialBreak(ponto);
    assert.equal(pausou, 0, 'o intervalo nem pausa o jogo');
    for (const tam of ['small', 'medium', 'large']) assert.equal(await p.rewardedBreak(tam), false, 'nunca paga');
    assert.equal(pausou, 0);
    assert.equal(semVideo, 3, 'o botao que sobrar responde "sem video"');
    assert.equal(p.inBreak, false);
    assert.equal(sdk.chamadas.length, antes, 'nada pedido ao SDK');
  } finally {
    delete g.Wavedash;
  }
});

test('idioma: o da Wavedash so quando o jogo o tem', async () => {
  const casos = [
    ['ja', 'en'], // o jogo nao tem japones: fica o do navegador (en no Node)
    ['pt-BR', 'pt'],
    ['zh-TW', 'pt'], // nem chines: nao mexe
    ['es_ES', 'es'],
    [new Error('sem idioma'), 'es'],
    [null, 'es'],
    ['tr', 'tr'],
  ];
  for (const [lang, esperado] of casos) {
    const sdk = sdkFalso({ lang });
    g.Wavedash = sdk;
    try {
      const p = new PortalWavedash();
      await carregar(p);
      assert.equal(getLang(), esperado, `getUserLanguage() = ${String(lang)}`);
      assert.equal(inits(sdk), 1);
    } finally {
      delete g.Wavedash;
    }
  }
});

test('SDK que lanca excecao nao derruba o jogo', async () => {
  const sdk = sdkFalso({ lanca: true, lang: new Error('x') });
  g.Wavedash = sdk;
  try {
    const p = new PortalWavedash();
    await carregar(p);
    assert.equal(inits(sdk), 1);
    assert.equal(p.revelado, true);
    mock.timers.tick(RESERVA_MS * 2);
    assert.equal(inits(sdk), 1);
  } finally {
    delete g.Wavedash;
  }
});

// ------------------------------------------------------ pacotes de moedas

/** Deixa as promessas andarem (o setImmediate nao e o temporizador falso). */
async function sossega(n = 30) {
  for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r));
}

let nCompra = 0;
/** Um purchaseId com a cara dos de verdade (base32, 32 caracteres). */
const novoId = () => `k97bn2q5h1t8xw6d3c0zv4ms${String(++nCompra).padStart(8, '0')}`;

/**
 * O "servidor" de compras da Wavedash: o que foi comprado e se ja recebeu o
 * fulfill. Sobrevive a reabertura do jogo.
 * @returns {{compras: Map<string, *>}}
 */
function servidorFalso() {
  return { compras: new Map() };
}

/**
 * SDK com o Paid Content: os eventos esperam o init, como o `eventsReady` do de
 * verdade, e a abertura entrega toda consumivel ainda sem fulfill.
 * @param {{compras: Map<string, *>}} servidor
 * @param {{falhasNoFulfill?: number, pendura?: boolean, puro?: boolean, perdeEvento?: boolean, checkout?: *}} [o]
 */
function sdkPago(servidor, o = {}) {
  const base = sdkFalso();
  const chamadas = base.chamadas;
  /** @type {Function[]} */
  const ouvintes = [];
  /** @type {*[]} */
  let fila = [];
  let pronto = false;
  let falhas = o.falhasNoFulfill || 0;
  const embrulha = (/** @type {*} */ v) => (o.puro ? v : { success: true, data: v });
  const emite = (/** @type {*} */ p) => {
    const copia = p && typeof p === 'object' ? { ...p } : p;
    if (!pronto) fila.push(copia);
    else for (const f of ouvintes) f(copia);
  };
  const nova = (/** @type {string} */ id, /** @type {*} */ extra = {}) => {
    const p = { purchaseId: novoId(), contentIdentifier: id, type: 'CONSUMABLE', fulfilled: false, purchasedAt: Date.now(), receiptJwt: 'eyJ.falso', ...extra };
    servidor.compras.set(p.purchaseId, p);
    return p;
  };
  for (const p of servidor.compras.values()) if (p.type === 'CONSUMABLE' && !p.fulfilled && !p.estornada) emite(p);
  return {
    ...base,
    chamadas,
    Events: { PURCHASE_COMPLETED: 'PurchaseCompleted' },
    PurchaseType: { DURABLE: 'DURABLE', CONSUMABLE: 'CONSUMABLE' },
    init: (/** @type {*} */ cfg) => {
      chamadas.push(['init', cfg]);
      pronto = true;
      const f = fila;
      fila = [];
      for (const p of f) for (const fn of ouvintes) fn(p);
      return true;
    },
    on: (/** @type {string} */ nome, /** @type {Function} */ fn) => {
      chamadas.push(['on', nome]);
      if (nome === 'PurchaseCompleted') ouvintes.push(fn);
      return () => {};
    },
    emite,
    /** Compra feita fora do checkout do jogo (a pagina da loja, outra aba). */
    compraFora: (/** @type {string} */ id, /** @type {*} */ extra) => {
      const p = nova(id, extra);
      emite(p);
      return p;
    },
    triggerPaywall: async (/** @type {string} */ id) => {
      chamadas.push(['paywall', id]);
      if (o.checkout instanceof Error) throw o.checkout;
      if (o.checkout !== undefined) return o.checkout;
      const p = nova(id);
      if (!o.perdeEvento) emite(p);
      return embrulha(true);
    },
    fulfillPurchase: (/** @type {string} */ pid) => {
      // O que estava no save no instante do fulfill: o credito tem que vir antes.
      const gravado = (load('save', null) || {}).compras || [];
      chamadas.push(['fulfill', pid, gravado.includes(pid)]);
      if (o.pendura) return new Promise(() => {});
      if (falhas > 0) {
        falhas--;
        return Promise.resolve(o.puro ? undefined : { success: false, data: null, message: 'rede' });
      }
      const p = servidor.compras.get(pid);
      let status = 'NOT_FOUND';
      if (p && !p.estornada) {
        status = p.fulfilled ? 'ALREADY_FULFILLED' : 'FULFILLED';
        p.fulfilled = true;
      }
      return Promise.resolve(embrulha({ status }));
    },
    getUnfulfilledPurchases: () => {
      chamadas.push(['pendentes']);
      if (o.pendura) return new Promise(() => {});
      const lista = [...servidor.compras.values()].filter((p) => p.type === 'CONSUMABLE' && !p.fulfilled && !p.estornada);
      return Promise.resolve(embrulha(lista.map((p) => ({ ...p }))));
    },
  };
}
/** @param {*} sdk @returns {Array<[string, string, boolean]>} */
const fulfills = (sdk) => sdk.chamadas.filter((/** @type {*} */ c) => c[0] === 'fulfill');
/** @param {*} sdk @param {string} nome */
const conta = (sdk, nome) => sdk.chamadas.filter((/** @type {*} */ c) => c[0] === nome).length;

/**
 * Uma abertura do jogo, na ordem de main.js: o adaptador nasce (o ouvinte
 * entra), o Progress le o save, main.js liga o credito e o fim do carregamento
 * chama o init, que solta as compras pendentes.
 * @param {*} sdk
 * @param {{ligaAntes?: boolean}} [o]
 */
async function abre(sdk, o = {}) {
  g.Wavedash = sdk;
  const p = new PortalWavedash();
  await p.preparar();
  // O Progress nasce com main.js, depois do preparar (e da nuvem).
  const progress = new Progress();
  /** @type {string[]} purchaseIds que viraram moeda nesta abertura (o toast) */
  const avisos = [];
  const liga = () =>
    p.pacotes.liga(
      (c) => {
        const r = creditaCompra(progress, c.purchaseId, c.id);
        if (r === 'novo') avisos.push(c.purchaseId);
        return r;
      },
      (c) => {
        estornaCompra(progress, c.purchaseId, c.id);
      },
    );
  if (o.ligaAntes !== false) liga();
  await p.init();
  p.gameLoadingFinished();
  await sossega();
  return { p, progress, avisos, liga };
}

/**
 * Uma origem nova, como a de um build novo na Wavedash: nada no localStorage
 * (nem a marca da nuvem) e nenhum espelho ligado.
 */
function novaOrigem() {
  definirEspelho(null);
  for (const k of Object.keys(entradasLocais())) remove(k.slice(PREFIXO.length));
}

/** Save zerado e nenhum SDK: cada teste comeca de um jogador novo. */
function zera() {
  novaOrigem();
  delete g.Wavedash;
}

test('pacotes: os dois do painel, coins-1500 e coins-5000', () => {
  assert.deepEqual(PACOTES.map((p) => [p.id, p.moedas]), [['coins-1500', 1500], ['coins-5000', 5000]]);
  assert.equal(PACOTES.filter((p) => p.melhor).map((p) => p.id).join(), 'coins-5000');
  assert.ok(isPersistent(), 'o localStorage falso vale como save que dura');
});

test('compra no meio da sessao: credita uma vez, grava antes do fulfill, so no saldo', async () => {
  zera();
  const srv = servidorFalso();
  const sdk = sdkPago(srv);
  try {
    const { p, progress, avisos } = await abre(sdk);
    assert.equal(p.pacotes.disponivel, true);
    assert.equal(conta(sdk, 'on'), 1);
    assert.ok(sdk.chamadas.findIndex((c) => c[0] === 'on') < sdk.chamadas.findIndex((c) => c[0] === 'init'), 'ouvinte antes do init');
    const barra = [progress.data.barraDe, progress.data.barraMoedas];
    assert.equal(await p.pacotes.comprar('coins-1500'), 'ok');
    await sossega();
    assert.equal(progress.data.coins, 1500);
    assert.deepEqual([progress.data.barraDe, progress.data.barraMoedas], barra, 'a barra do mundo nao conta moeda comprada');
    assert.equal(avisos.length, 1);
    const [pid] = avisos;
    assert.deepEqual(progress.data.compras, [pid]);
    assert.deepEqual(load('save', null).compras, [pid], 'gravado');
    assert.equal(load('save', null).coins, 1500);
    assert.deepEqual(fulfills(sdk), [['fulfill', pid, true]], 'um fulfill, com o credito ja gravado');
    assert.equal(srv.compras.get(pid).fulfilled, true);
    assert.equal(p.pacotes.abrindo, false);
    // O pacote grande, pela pagina da loja (fora do checkout do jogo).
    sdk.compraFora('coins-5000');
    await sossega();
    assert.equal(progress.data.coins, 6500);
    assert.equal(fulfills(sdk).length, 2);
    assert.equal(inits(sdk), 1);
  } finally {
    zera();
  }
});

test('reentrega na abertura: a compra sem fulfill chega dentro do init e credita uma vez', async () => {
  zera();
  const srv = servidorFalso();
  // Comprada com o jogo fechado: nunca recebeu fulfill.
  const fora = { purchaseId: novoId(), contentIdentifier: 'coins-5000', type: 'CONSUMABLE', fulfilled: false, purchasedAt: 1, receiptJwt: 'x' };
  srv.compras.set(fora.purchaseId, fora);
  const sdk = sdkPago(srv);
  try {
    g.Wavedash = sdk;
    const { progress, avisos } = await abre(sdk);
    assert.equal(progress.data.coins, 5000);
    assert.deepEqual(avisos, [fora.purchaseId]);
    assert.equal(fora.fulfilled, true);
    const i = (/** @type {string} */ n) => sdk.chamadas.findIndex((c) => c[0] === n);
    assert.ok(i('init') < i('fulfill'), 'o credito so vem depois do init');
    assert.equal(conta(sdk, 'pendentes'), 1, 'a lista de pendentes uma vez so, depois do init');
    assert.ok(i('init') < i('pendentes'));
    // O evento e a lista entregaram a mesma compra: uma moeda so.
    assert.equal(progress.data.compras.length, 1);
    // Reabre: ja recebeu fulfill, nao vem mais.
    const outra = await abre(sdkPago(srv));
    assert.equal(outra.progress.data.coins, 5000);
    assert.equal(outra.avisos.length, 0);
  } finally {
    zera();
  }
});

test('entrega repetida: a mesma compra credita uma vez', async () => {
  zera();
  const srv = servidorFalso();
  const sdk = sdkPago(srv);
  try {
    const { p, progress } = await abre(sdk);
    const c = sdk.compraFora('coins-1500');
    sdk.emite(c); // no mesmo instante
    p.pacotes.recebe({ ...c }); // pela lista
    await sossega();
    sdk.emite(c); // depois do fulfill
    await sossega();
    assert.equal(progress.data.coins, 1500);
    assert.deepEqual(progress.data.compras, [c.purchaseId]);
    const st = fulfills(sdk);
    assert.ok(st.length >= 1 && st.length <= 2, `fulfills: ${st.length}`);
    assert.equal(srv.compras.get(c.purchaseId).fulfilled, true);
  } finally {
    zera();
  }
});

test('fulfill que falha: o credito fica, e a lista de pendentes da a segunda chance', async () => {
  zera();
  const srv = servidorFalso();
  try {
    // Sessao 1: a compra credita, o fulfill falha (rede).
    const s1 = sdkPago(srv, { falhasNoFulfill: 1 });
    const a = await abre(s1);
    assert.equal(await a.p.pacotes.comprar('coins-1500'), 'ok');
    await sossega();
    const [pid] = a.avisos;
    assert.equal(a.progress.data.coins, 1500);
    assert.equal(srv.compras.get(pid).fulfilled, false, 'sem fulfill');
    // Sessao 2: chega de novo (evento na abertura e lista); ja creditada, so recebe o fulfill.
    const s2 = sdkPago(srv);
    const b = await abre(s2);
    assert.equal(b.progress.data.coins, 1500, 'nao credita de novo');
    assert.equal(b.avisos.length, 0);
    assert.equal(srv.compras.get(pid).fulfilled, true);
    // Na mesma abertura: o fulfill de dentro do init falha, e a lista que vem
    // depois do init tenta de novo.
    const pendente = { purchaseId: novoId(), contentIdentifier: 'coins-5000', type: 'CONSUMABLE', fulfilled: false, purchasedAt: 2, receiptJwt: 'x' };
    srv.compras.set(pendente.purchaseId, pendente);
    const s3 = sdkPago(srv, { falhasNoFulfill: 1 });
    const c = await abre(s3);
    assert.equal(c.progress.data.coins, 6500);
    assert.equal(c.avisos.length, 1);
    assert.equal(pendente.fulfilled, true, 'a segunda tentativa, pela lista, entregou');
    assert.equal(fulfills(s3).length, 2);
    assert.equal(conta(s3, 'pendentes'), 1);
  } finally {
    zera();
  }
});

test('NOT_FOUND: o credito que acabou de entrar sai; o de outra sessao fica', async () => {
  zera();
  const srv = servidorFalso();
  const sdk = sdkPago(srv);
  try {
    const { progress } = await abre(sdk);
    progress.addCoins(40);
    // Uma compra que o servidor nao conhece (ou estornada antes do fulfill).
    const fantasma = { purchaseId: novoId(), contentIdentifier: 'coins-5000', type: 'CONSUMABLE', fulfilled: false };
    sdk.emite(fantasma);
    await sossega();
    assert.equal(progress.data.coins, 40, 'desfeito');
    assert.deepEqual(progress.data.compras, []);
    assert.equal(load('save', null).coins, 40, 'e gravado');
    // Creditada e entregue antes; agora estornada: a moeda ja dada fica.
    const c = sdk.compraFora('coins-1500');
    await sossega();
    assert.equal(progress.data.coins, 1540);
    srv.compras.get(c.purchaseId).estornada = true;
    sdk.emite(c);
    await sossega();
    assert.equal(progress.data.coins, 1540);
  } finally {
    zera();
  }
});

test('pacote desconhecido, durable e entrega malformada: nada credita, nada recebe fulfill', async () => {
  zera();
  const srv = servidorFalso();
  const sdk = sdkPago(srv);
  try {
    const { progress } = await abre(sdk);
    sdk.compraFora('gems-10');
    sdk.compraFora('coins-1500', { type: 'DURABLE', fulfilled: true });
    sdk.compraFora('coins-5000', { fulfilled: true });
    for (const lixo of [null, undefined, 7, 'x', {}, { purchaseId: '', contentIdentifier: 'coins-1500', type: 'CONSUMABLE' }, { purchaseId: novoId(), type: 'CONSUMABLE' }]) {
      sdk.emite(lixo);
    }
    await sossega();
    assert.equal(progress.data.coins, 0);
    assert.equal(fulfills(sdk).length, 0);
    assert.equal(progress.data.compras, undefined, 'a lista nem nasce');
  } finally {
    zera();
  }
});

test('SDK sem as funcoes pagas (ou sem SDK): a loja nao oferece, e nada quebra', async () => {
  zera();
  try {
    // O SDK da prova do zip e o de antes: sem on, triggerPaywall nem fulfill.
    const antigo = sdkFalso();
    const a = await abre(antigo);
    assert.equal(a.p.pacotes.disponivel, false);
    assert.equal(a.p.pacotes.ouvindo, false);
    assert.equal(await a.p.pacotes.comprar('coins-1500'), 'erro');
    assert.equal(inits(antigo), 1);
    assert.deepEqual([...new Set(antigo.chamadas.map((c) => c[0]))].sort(), ['idioma', 'init', 'progresso']);
    // So o ouvinte, sem checkout: tambem nao oferece.
    const meio = { ...sdkFalso(), on: () => () => {} };
    const b = await abre(meio);
    assert.equal(b.p.pacotes.ouvindo, true);
    assert.equal(b.p.pacotes.disponivel, false);
    // Um `on` que lanca.
    const quebra = { ...sdkPago(servidorFalso()), on: () => { throw new Error('x'); } };
    const c = await abre(quebra);
    assert.equal(c.p.pacotes.disponivel, false);
    assert.equal(inits(quebra), 1);
    // Fora da Wavedash.
    delete g.Wavedash;
    const fora = new PortalWavedash();
    assert.equal(fora.pacotes.disponivel, false);
    assert.equal(await fora.pacotes.comprar('coins-5000'), 'erro');
    await fora.pacotes.revisa();
    // Solta a reserva de 8 s: armada, ela chamaria o init no SDK do teste seguinte.
    fora.gameLoadingFinished();
    assert.equal(plataforma.pacotes.disponivel, false, 'o singleton nasceu sem SDK');
  } finally {
    zera();
  }
});

test('o init nao espera compra nenhuma: lista e fulfill pendurados estouram o prazo', async () => {
  zera();
  const srv = servidorFalso();
  const pendente = { purchaseId: novoId(), contentIdentifier: 'coins-1500', type: 'CONSUMABLE', fulfilled: false, purchasedAt: 3, receiptJwt: 'x' };
  srv.compras.set(pendente.purchaseId, pendente);
  const sdk = sdkPago(srv, { pendura: true });
  aba(true);
  try {
    g.Wavedash = sdk;
    const p = new PortalWavedash();
    const progress = new Progress();
    p.pacotes.liga((c) => creditaCompra(progress, c.purchaseId, c.id), () => {});
    await p.preparar();
    await p.init();
    const antes = quadrosPedidos;
    p.gameLoadingFinished();
    assert.equal(inits(sdk), 1, 'na hora');
    assert.equal(quadrosPedidos, antes);
    assert.equal(progress.data.coins, 1500, 'credita dentro do init, sem esperar o fulfill');
    await sossega();
    assert.equal(p.pacotes._emCurso.size, 1, 'fulfill pendurado');
    mock.timers.tick(PRAZO_SDK_MS);
    await sossega();
    assert.equal(p.pacotes._emCurso.size, 0, 'o prazo solta');
    assert.equal(conta(sdk, 'pendentes'), 1);
    mock.timers.tick(PRAZO_SDK_MS);
    await sossega();
    assert.equal(progress.data.coins, 1500);
    assert.equal(inits(sdk), 1);
  } finally {
    aba(false);
    zera();
  }
});

test('fila: compra que chega antes de main.js ligar o credito espera por ele', async () => {
  zera();
  const srv = servidorFalso();
  const pendente = { purchaseId: novoId(), contentIdentifier: 'coins-5000', type: 'CONSUMABLE', fulfilled: false, purchasedAt: 4, receiptJwt: 'x' };
  srv.compras.set(pendente.purchaseId, pendente);
  const sdk = sdkPago(srv);
  try {
    g.Wavedash = sdk;
    const p = new PortalWavedash();
    await p.preparar();
    // main.js travou: a reserva por timer chama o init sem o jogo pronto.
    mock.timers.tick(RESERVA_MS);
    await sossega();
    assert.equal(inits(sdk), 1);
    assert.equal(fulfills(sdk).length, 0, 'sem credito, sem fulfill');
    const progress = new Progress();
    p.pacotes.liga((c) => creditaCompra(progress, c.purchaseId, c.id), () => {});
    await sossega();
    assert.equal(progress.data.coins, 5000, 'uma vez, mesmo com o evento e a lista na fila');
    assert.equal(pendente.fulfilled, true);
  } finally {
    zera();
  }
});

test('respostas sem o envelope {success, data} tambem valem', async () => {
  zera();
  const srv = servidorFalso();
  const sdk = sdkPago(srv, { puro: true });
  try {
    const { p, progress } = await abre(sdk);
    assert.equal(await p.pacotes.comprar('coins-1500'), 'ok');
    await sossega();
    assert.equal(progress.data.coins, 1500);
    assert.equal([...srv.compras.values()][0].fulfilled, true);
  } finally {
    zera();
  }
});

test('checkout: cancelado, erro, aberto duas vezes, e confirmado sem evento', async () => {
  zera();
  const srv = servidorFalso();
  try {
    const casos = [
      [{ success: true, data: false }, 'cancelado'],
      [false, 'cancelado'],
      [{ success: false, data: null, message: 'Paywall already in progress' }, 'erro'],
      [new Error('quebrou'), 'erro'],
    ];
    for (const [checkout, esperado] of casos) {
      const sdk = sdkPago(srv, { checkout });
      const { p, progress } = await abre(sdk);
      assert.equal(await p.pacotes.comprar('coins-1500'), esperado, String(checkout));
      assert.equal(progress.data.coins, 0, 'o checkout nunca credita');
      assert.equal(p.pacotes.abrindo, false);
    }
    // Duas vezes: a segunda nem abre.
    let solta = (/** @type {*} */ _v) => {};
    const lento = sdkPago(srv, { checkout: new Promise((r) => (solta = r)) });
    const l = await abre(lento);
    const primeira = l.p.pacotes.comprar('coins-1500');
    assert.equal(l.p.pacotes.abrindo, true);
    assert.equal(await l.p.pacotes.comprar('coins-5000'), 'cancelado');
    solta({ success: true, data: false });
    assert.equal(await primeira, 'cancelado');
    assert.equal(conta(lento, 'paywall'), 1);
    // Confirmado, mas o evento se perdeu: a lista do servidor credita.
    const mudo = sdkPago(srv, { perdeEvento: true });
    const m = await abre(mudo);
    assert.equal(await m.p.pacotes.comprar('coins-5000'), 'ok');
    await sossega();
    assert.equal(m.progress.data.coins, 0, 'nada do resultado do checkout');
    mock.timers.tick(ESPERA_EVENTO_MS);
    await sossega();
    assert.equal(m.progress.data.coins, 5000, 'veio da lista');
    assert.equal(conta(mudo, 'pendentes'), 2);
  } finally {
    zera();
  }
});

test('apagar o progresso guarda a lista: a compra sem fulfill nao credita de novo', async () => {
  zera();
  const srv = servidorFalso();
  try {
    const s1 = sdkPago(srv, { falhasNoFulfill: 1 });
    const a = await abre(s1);
    await a.p.pacotes.comprar('coins-1500');
    await sossega();
    assert.equal(a.progress.data.coins, 1500);
    zeraGuardandoCompras(a.progress);
    assert.equal(a.progress.data.coins, 0);
    assert.equal(a.progress.data.unlocked, 1);
    assert.equal(a.progress.data.compras.length, 1);
    const b = await abre(sdkPago(srv));
    assert.equal(b.progress.data.coins, 0, 'a reentrega so recebe o fulfill');
    assert.equal(b.avisos.length, 0);
    assert.equal([...srv.compras.values()][0].fulfilled, true);
  } finally {
    zera();
  }
});

// ------------------------------------------------------ save na nuvem

/**
 * A nuvem da Wavedash: os arquivos por caminho, que sobrevivem a qualquer
 * build, e o instante de cada envio que chegou ao servidor.
 */
function nuvemFalsa() {
  return { arquivos: /** @type {Map<string, Uint8Array>} */ (new Map()), tentativas: /** @type {number[]} */ ([]), envios: 0 };
}

/**
 * O Remote Storage por cima de outro SDK falso. O arquivo local (o IndexedDB
 * do SDK de verdade) e da origem: some num build novo.
 * @param {*} base
 * @param {ReturnType<typeof nuvemFalsa>} nuvem
 * @param {{baixa?: *, sobe?: (n: number) => *}} [o] baixa: 'ok' | 'erro' | 'pendura' | Promise | (n) => um desses;
 *   sobe: (n) => '' (deu certo), uma mensagem de erro, ou 'pendura'
 */
function comNuvem(base, nuvem, o = {}) {
  const idb = new Map();
  const ch = base.chamadas;
  let nBaixa = 0;
  let nSobe = 0;
  const copia = (/** @type {string} */ p) => {
    if (!nuvem.arquivos.has(p)) return { success: false, data: null, message: '404 (Not Found)' };
    idb.set(p, new Uint8Array(/** @type {*} */ (nuvem.arquivos.get(p))));
    return { success: true, data: p };
  };
  return Object.assign(base, {
    writeLocalFile: async (/** @type {string} */ p, /** @type {Uint8Array} */ b) => {
      ch.push(['escreve', p]);
      idb.set(p, new Uint8Array(b));
      return true;
    },
    readLocalFile: async (/** @type {string} */ p) => {
      ch.push(['le', p]);
      return idb.has(p) ? new Uint8Array(idb.get(p)) : null;
    },
    downloadRemoteFile: (/** @type {string} */ p) => {
      ch.push(['baixa', p]);
      nBaixa++;
      const modo = typeof o.baixa === 'function' ? o.baixa(nBaixa) : o.baixa || 'ok';
      if (modo === 'pendura') return new Promise(() => {});
      if (modo instanceof Promise) return modo.then(() => copia(p));
      if (modo === 'erro') return Promise.resolve({ success: false, data: null, message: '503 (Service Unavailable)' });
      return Promise.resolve(copia(p));
    },
    remoteFileExists: async (/** @type {string} */ p) => {
      ch.push(['existe', p]);
      const modo = typeof o.baixa === 'function' ? o.baixa(nBaixa) : o.baixa;
      if (modo === 'erro') return { success: false, data: null, message: '503 (Service Unavailable)' };
      return { success: true, data: nuvem.arquivos.has(p) };
    },
    uploadRemoteFile: (/** @type {string} */ p) => {
      ch.push(['sobe', p]);
      nSobe++;
      nuvem.tentativas.push(Date.now());
      const falha = o.sobe ? o.sobe(nSobe) : '';
      if (falha === 'pendura') return new Promise(() => {});
      if (falha) return Promise.resolve({ success: false, data: null, message: falha });
      nuvem.arquivos.set(p, new Uint8Array(idb.get(p)));
      nuvem.envios++;
      return Promise.resolve({ success: true, data: p });
    },
  });
}

/** O que a nuvem guarda: chave completa -> texto cru. @param {ReturnType<typeof nuvemFalsa>} nuvem */
const naNuvem = (nuvem) => {
  const b = nuvem.arquivos.get(N.ARQUIVO);
  return b ? JSON.parse(new TextDecoder().decode(b)).chaves : null;
};
/** O save que a nuvem guarda. @param {ReturnType<typeof nuvemFalsa>} nuvem */
const saveNaNuvem = (nuvem) => {
  const c = naNuvem(nuvem);
  return c && c[PREFIXO + 'save'] ? JSON.parse(c[PREFIXO + 'save']) : null;
};
/**
 * Poe um arquivo na nuvem, como um build anterior teria subido.
 * @param {ReturnType<typeof nuvemFalsa>} nuvem
 * @param {Record<string, *>} chaves sem o prefixo; o valor vira texto cru (JSON)
 */
function poeNaNuvem(nuvem, chaves) {
  /** @type {Record<string, string>} */
  const cru = {};
  for (const [k, v] of Object.entries(chaves)) cru[PREFIXO + k] = JSON.stringify(v);
  nuvem.arquivos.set(N.ARQUIVO, new TextEncoder().encode(JSON.stringify({ v: 1, chaves: cru })));
}
/** Um save da versao 3 com o que o teste precisa. @param {*} extra */
// Com `prizes` e `perfeitas`, o construtor do Progress nao migra (nem grava) nada.
const umSave = (extra) => ({ v: 3, unlocked: 1, stars: {}, coins: 0, xp: 0, skin: 'classic', skins: ['classic'], upgrades: {}, prizes: [], perfeitas: [], ...extra });
/** Os temporizadores andam ate o envio sair e as promessas assentarem. @param {number} ms */
async function anda(ms) {
  mock.timers.tick(ms);
  await sossega();
}
const indice = (/** @type {*} */ sdk, /** @type {string} */ nome) => sdk.chamadas.findIndex((/** @type {*} */ c) => c[0] === nome);

test('nuvem: build nova - o save, o idioma e o som voltam antes de main.js', async () => {
  zera();
  const nuvem = nuvemFalsa();
  poeNaNuvem(nuvem, { save: umSave({ unlocked: 12, coins: 777, rev: 40, compras: ['k97x'] }), lang: 'pt', sfxOn: false });
  const sdk = comNuvem(sdkPago(servidorFalso()), nuvem);
  try {
    const { p, progress } = await abre(sdk);
    assert.equal(p.nuvem.estado, 'ligada');
    assert.equal(progress.data.coins, 777, 'o save da nuvem, no construtor do Progress');
    assert.deepEqual(progress.data.compras, ['k97x'], 'e a lista das compras');
    assert.equal(getLang(), 'pt', 'o idioma escolhido nos ajustes vence o da Wavedash (en)');
    assert.equal(load('sfxOn', true), false);
    assert.equal(load(N.MARCA, 0), 1, 'a marca: este localStorage leu a nuvem');
    assert.ok(indice(sdk, 'baixa') < indice(sdk, 'init'), 'leu antes do init');
    assert.equal(inits(sdk), 1);
    assert.deepEqual(progresso(sdk).slice(0, 4), [CARGA.modulo, CARGA.sdk, CARGA.nuvem, CARGA.preparado]);
    await anda(N.INTERVALO_MS * 2);
    assert.equal(conta(sdk, 'sobe'), 0, 'nada mudou: nada sobe');
    assert.equal(naNuvem(nuvem)[PREFIXO + N.MARCA], undefined, 'a marca nunca sobe');
  } finally {
    zera();
  }
});

test('nuvem: a mais nova vence; local mais novo fica e sobe; local orfao perde', async () => {
  try {
    // A nuvem mais nova (outro aparelho, ou o build anterior).
    zera();
    save('save', umSave({ coins: 10, rev: 5 }));
    save(N.MARCA, 1);
    const n1 = nuvemFalsa();
    poeNaNuvem(n1, { save: umSave({ coins: 99, rev: 9 }) });
    const a = await abre(comNuvem(sdkPago(servidorFalso()), n1));
    assert.equal(a.progress.data.coins, 99);
    // O local mais novo: o envio da sessao anterior nao chegou.
    zera();
    save('save', umSave({ coins: 50, rev: 12 }));
    save(N.MARCA, 1);
    const n2 = nuvemFalsa();
    poeNaNuvem(n2, { save: umSave({ coins: 99, rev: 9 }) });
    const s2 = comNuvem(sdkPago(servidorFalso()), n2);
    const b = await abre(s2);
    assert.equal(b.progress.data.coins, 50);
    assert.equal(conta(s2, 'sobe'), 0, 'nao sobe antes da espera');
    await anda(N.ESPERA_MS);
    assert.equal(conta(s2, 'sobe'), 1);
    assert.equal(saveNaNuvem(n2).coins, 50);
    assert.equal(saveNaNuvem(n2).rev, 12);
    // Orfao: um save local que nunca leu a nuvem (o primeiro carregamento de
    // um build novo com a rede fora) perde mesmo com o rev maior.
    zera();
    save('save', umSave({ coins: 5, rev: 50 }));
    const n3 = nuvemFalsa();
    poeNaNuvem(n3, { save: umSave({ coins: 99, rev: 9 }) });
    const c = await abre(comNuvem(sdkPago(servidorFalso()), n3));
    assert.equal(c.progress.data.coins, 99);
  } finally {
    zera();
  }
});

test('nuvem sem arquivo (jogador novo): o espelho liga e a primeira gravacao cria o arquivo', async () => {
  zera();
  const nuvem = nuvemFalsa();
  const sdk = comNuvem(sdkPago(servidorFalso()), nuvem);
  try {
    const { p, progress } = await abre(sdk);
    assert.equal(p.nuvem.estado, 'ligada');
    assert.equal(conta(sdk, 'existe'), 1, 'o HEAD separa "nao existe" de "nao deu"');
    progress.addCoins(5);
    progress.addCoins(5);
    await anda(N.ESPERA_MS - 1);
    assert.equal(conta(sdk, 'sobe'), 0);
    await anda(1);
    assert.equal(conta(sdk, 'sobe'), 1, 'as duas gravacoes num envio so');
    assert.equal(saveNaNuvem(nuvem).coins, 10);
    // Os ajustes tambem sobem (o som, o idioma, a qualidade).
    save('quality', 'low');
    await anda(N.INTERVALO_MS);
    assert.equal(naNuvem(nuvem)[PREFIXO + 'quality'], '"low"');
  } finally {
    zera();
  }
});

test('download que nao responde: o jogo abre no prazo so com o localStorage, e a nuvem liga quando chega', async () => {
  for (const nuvemTem of [false, true]) {
    zera();
    const nuvem = nuvemFalsa();
    if (nuvemTem) poeNaNuvem(nuvem, { save: umSave({ coins: 99, rev: 9 }) });
    let solta = () => {};
    const atrasado = new Promise((r) => (solta = () => r(undefined)));
    const sdk = comNuvem(sdkPago(servidorFalso()), nuvem, { baixa: (/** @type {number} */ n) => (n === 1 ? atrasado : 'ok') });
    g.Wavedash = sdk;
    try {
      const p = new PortalWavedash();
      const prep = p.preparar();
      await sossega();
      assert.equal(p.nuvem.estado, 'lendo');
      await anda(N.PRAZO_LEITURA_MS);
      await prep;
      assert.equal(p.nuvem.estado, 'desligada', 'sem a nuvem, sem espelho');
      const progress = new Progress();
      p.pacotes.liga((c) => creditaCompra(progress, c.purchaseId, c.id), () => {});
      await p.init();
      p.gameLoadingFinished();
      assert.equal(inits(sdk), 1, 'o init nao esperou a nuvem');
      progress.addCoins(3);
      await anda(N.INTERVALO_MS);
      assert.equal(conta(sdk, 'sobe'), 0, 'nada sobe por cima de um arquivo que nao foi lido');
      solta();
      await sossega();
      if (nuvemTem) {
        // A nuvem tem um save, e este (orfao, rev 1) nao pode trocar de lugar
        // com ele no meio da sessao: fica para a proxima abertura.
        assert.equal(p.nuvem.estado, 'desligada');
        assert.equal(load(N.MARCA, 0), 0, 'sem a marca, a nuvem vence na proxima');
        await anda(N.INTERVALO_MS);
        assert.equal(conta(sdk, 'sobe'), 0);
        assert.equal(saveNaNuvem(nuvem).coins, 99, 'a nuvem ficou intacta');
      } else {
        assert.equal(p.nuvem.estado, 'ligada', 'nuvem vazia: o local passa a ser ela');
        await anda(N.ESPERA_MS);
        assert.equal(saveNaNuvem(nuvem).coins, 3);
      }
    } finally {
      zera();
    }
  }
});

test('download com erro: so o localStorage, e a releitura no fundo liga a nuvem', async () => {
  zera();
  const nuvem = nuvemFalsa();
  const sdk = comNuvem(sdkPago(servidorFalso()), nuvem, { baixa: (/** @type {number} */ n) => (n === 1 ? 'erro' : 'ok') });
  try {
    const { p, progress } = await abre(sdk);
    assert.equal(p.nuvem.estado, 'desligada');
    progress.addCoins(4);
    await anda(N.RELEITURAS_MS[0]);
    assert.equal(conta(sdk, 'baixa'), 2);
    assert.equal(p.nuvem.estado, 'ligada');
    await anda(N.ESPERA_MS);
    assert.equal(saveNaNuvem(nuvem).coins, 4);
  } finally {
    zera();
  }
});

test('compra: credito, save local, envio para a nuvem e so entao o fulfill', async () => {
  zera();
  const srv = servidorFalso();
  const nuvem = nuvemFalsa();
  const sdk = comNuvem(sdkPago(srv), nuvem);
  try {
    const { p, progress, avisos } = await abre(sdk);
    assert.equal(await p.pacotes.comprar('coins-1500'), 'ok');
    await anda(0);
    const [pid] = avisos;
    assert.equal(progress.data.coins, 1500);
    assert.ok(indice(sdk, 'sobe') >= 0 && indice(sdk, 'sobe') < indice(sdk, 'fulfill'), 'sobe antes do fulfill');
    assert.deepEqual(saveNaNuvem(nuvem).compras, [pid], 'o purchaseId foi junto');
    assert.equal(saveNaNuvem(nuvem).coins, 1500);
    assert.equal(srv.compras.get(pid).fulfilled, true);
  } finally {
    zera();
  }
});

test('compra com o envio barrado pelo limite: o fulfill espera o envio que passa', async () => {
  zera();
  const srv = servidorFalso();
  const nuvem = nuvemFalsa();
  const sdk = comNuvem(sdkPago(srv), nuvem, { sobe: (n) => (n === 1 ? 'Upload rate limited; try again in 40s. Upload less often.' : '') });
  try {
    const { p, progress, avisos } = await abre(sdk);
    await p.pacotes.comprar('coins-5000');
    await anda(0);
    const [pid] = avisos;
    assert.equal(progress.data.coins, 5000, 'a moeda ja vale na sessao');
    assert.equal(conta(sdk, 'sobe'), 1);
    assert.equal(fulfills(sdk).length, 0, 'sem a moeda na nuvem, sem fulfill');
    await anda(39000);
    assert.equal(conta(sdk, 'sobe'), 1, 'esperou o que o SDK pediu');
    await anda(2000);
    assert.equal(conta(sdk, 'sobe'), 2);
    assert.equal(fulfills(sdk).length, 1);
    assert.equal(srv.compras.get(pid).fulfilled, true);
    assert.deepEqual(saveNaNuvem(nuvem).compras, [pid]);
  } finally {
    zera();
  }
});

test('envio que nao responde estoura o prazo, e a falha so atrasa o envio seguinte', async () => {
  zera();
  const nuvem = nuvemFalsa();
  const sdk = comNuvem(sdkPago(servidorFalso()), nuvem, { sobe: (n) => (n === 1 ? 'pendura' : n === 2 ? 'Failed to upload file' : '') });
  try {
    const { p, progress } = await abre(sdk);
    progress.addCoins(1);
    await anda(N.ESPERA_MS);
    assert.equal(p.nuvem.enviando, true);
    await anda(N.PRAZO_ENVIO_MS);
    assert.equal(p.nuvem.enviando, false);
    assert.equal(p.nuvem.falhas, 1);
    await anda(N.PAUSA_FALHA_MS);
    assert.equal(conta(sdk, 'sobe'), 2);
    assert.equal(p.nuvem.falhas, 2);
    await anda(N.PAUSA_FALHA_MS * 2);
    assert.equal(conta(sdk, 'sobe'), 3);
    assert.equal(p.nuvem.falhas, 0);
    assert.equal(saveNaNuvem(nuvem).coins, 1);
  } finally {
    zera();
  }
});

test('nuvem fora na compra: sem fulfill; na abertura seguinte a compra credita uma vez e recebe o fulfill', async () => {
  zera();
  const srv = servidorFalso();
  const nuvem = nuvemFalsa();
  try {
    // Sessao 1: a nuvem nao responde.
    const s1 = comNuvem(sdkPago(srv), nuvem, { baixa: 'pendura' });
    g.Wavedash = s1;
    const p = new PortalWavedash();
    const prep = p.preparar();
    await sossega();
    await anda(N.PRAZO_LEITURA_MS);
    await prep;
    const progress = new Progress();
    p.pacotes.liga((c) => creditaCompra(progress, c.purchaseId, c.id), () => {});
    await p.init();
    p.gameLoadingFinished();
    await p.pacotes.comprar('coins-1500');
    await sossega();
    assert.equal(progress.data.coins, 1500);
    await anda(N.PRAZO_GARANTIA_MS);
    assert.equal(fulfills(s1).length, 0, 'a moeda nao chegou a nuvem: sem fulfill');
    // Sessao 2, num build novo: a Wavedash entrega de novo, e a moeda entra no
    // save que a nuvem devolveu.
    novaOrigem();
    const s2 = comNuvem(sdkPago(srv), nuvem);
    const b = await abre(s2);
    await anda(0);
    assert.equal(b.progress.data.coins, 1500, 'uma vez');
    assert.equal(fulfills(s2).length, 1);
    assert.equal([...srv.compras.values()][0].fulfilled, true);
    // Sessao 3, outro build: a moeda volta da nuvem, e nada credita de novo.
    novaOrigem();
    const c = await abre(comNuvem(sdkPago(srv), nuvem));
    assert.equal(c.progress.data.coins, 1500);
    assert.equal(c.avisos.length, 0);
  } finally {
    zera();
  }
});

test('build nova depois da compra: a reentrega so recebe o fulfill', async () => {
  zera();
  const srv = servidorFalso();
  const nuvem = nuvemFalsa();
  try {
    const a = await abre(comNuvem(sdkPago(srv, { falhasNoFulfill: 1 }), nuvem));
    await a.p.pacotes.comprar('coins-1500');
    await anda(0);
    const [pid] = a.avisos;
    assert.equal(srv.compras.get(pid).fulfilled, false, 'o fulfill falhou');
    assert.deepEqual(saveNaNuvem(nuvem).compras, [pid]);
    novaOrigem();
    const s2 = comNuvem(sdkPago(srv), nuvem);
    const b = await abre(s2);
    await anda(0);
    assert.equal(b.progress.data.coins, 1500, 'veio da nuvem, sem credito novo');
    assert.equal(b.avisos.length, 0);
    assert.equal(srv.compras.get(pid).fulfilled, true);
    assert.equal(conta(s2, 'sobe'), 0, 'ja estava na nuvem: nada a subir');
  } finally {
    zera();
  }
});

test('limite: no pior caso, nunca acima de 25 envios por minuto nem de 280 por hora', async () => {
  zera();
  const nuvem = nuvemFalsa();
  const sdk = comNuvem(sdkPago(servidorFalso()), nuvem);
  try {
    const { p, progress } = await abre(sdk);
    // 10 min de gravacoes a cada segundo: no maximo um envio a cada INTERVALO_MS.
    for (let s = 0; s < 600; s++) {
      progress.addCoins(1);
      mock.timers.tick(1000);
      await sossega(3);
    }
    const t = nuvem.tentativas;
    const intervalos = t.slice(1).map((x, i) => x - t[i]);
    assert.ok(t.length >= 30 && t.length <= 600 / (N.INTERVALO_MS / 1000) + 1, `envios em 10 min: ${t.length}`);
    assert.ok(Math.min(...intervalos) >= N.INTERVALO_MS, `menor intervalo ${Math.min(...intervalos)} ms`);
    // E uma compra por segundo por 2 h (o pior caso que a janela segura).
    for (let s = 0; s < 7200; s++) {
      progress.addCoins(1);
      p.nuvem.garante();
      mock.timers.tick(1000);
      await sossega(3);
    }
    const todos = nuvem.tentativas;
    let maxMin = 0;
    let maxHora = 0;
    for (let i = 0; i < todos.length; i++) {
      maxMin = Math.max(maxMin, todos.filter((x) => x >= todos[i] && x - todos[i] < 60000).length);
      maxHora = Math.max(maxHora, todos.filter((x) => x >= todos[i] && x - todos[i] < 3600000).length);
    }
    assert.ok(maxMin <= N.LIMITE_MINUTO, `pico por minuto: ${maxMin}`);
    assert.ok(maxHora <= N.LIMITE_HORA, `pico por hora: ${maxHora}`);
    assert.ok(maxHora >= N.LIMITE_HORA - 5, 'e a janela deixou o maximo passar');
    await anda(N.PRAZO_GARANTIA_MS);
  } finally {
    zera();
  }
});

test('pagina escondida: o que mudou sobe na hora', async () => {
  zera();
  const nuvem = nuvemFalsa();
  const sdk = comNuvem(sdkPago(servidorFalso()), nuvem);
  try {
    const { progress } = await abre(sdk);
    progress.addCoins(7);
    aba(true);
    for (const f of ouvintes.visibilitychange || []) f();
    await anda(0);
    assert.equal(conta(sdk, 'sobe'), 1, 'sem esperar os 4 s');
    assert.equal(saveNaNuvem(nuvem).coins, 7);
  } finally {
    aba(false);
    zera();
  }
});

test('sem o Remote Storage (ou com ele pela metade): so o localStorage, e a compra recebe o fulfill como na 1.0.20', async () => {
  zera();
  try {
    const srv = servidorFalso();
    const sdk = sdkPago(srv);
    const { p, progress } = await abre(sdk);
    assert.equal(p.nuvem.estado, 'ausente');
    assert.equal(conta(sdk, 'baixa'), 0);
    await p.pacotes.comprar('coins-1500');
    await sossega();
    assert.equal(progress.data.coins, 1500);
    assert.equal(fulfills(sdk).length, 1);
    zera();
    const meio = comNuvem(sdkPago(servidorFalso()), nuvemFalsa());
    delete (/** @type {*} */ (meio)).uploadRemoteFile;
    const b = await abre(meio);
    assert.equal(b.p.nuvem.estado, 'ausente');
    assert.equal(conta(meio, 'baixa'), 0);
    // O SDK da prova do zip responde {success:false} a tudo o que nao conhece.
    zera();
    const prova = comNuvem(sdkPago(servidorFalso()), nuvemFalsa(), { baixa: 'erro' });
    const c = await abre(prova);
    assert.equal(c.p.nuvem.estado, 'desligada');
    c.progress.addCoins(2);
    assert.equal(load('save', null).coins, 2, 'o localStorage continua gravando');
    assert.equal(inits(prova), 1);
  } finally {
    zera();
  }
});

test('oQueVolta: so o que falta, e o save pelo rev ou pela marca', () => {
  const s = (/** @type {number} */ rev) => JSON.stringify({ v: 3, rev });
  const S = PREFIXO + 'save';
  const L = PREFIXO + 'lang';
  assert.deepEqual(N.oQueVolta({}, { [S]: s(3), [L]: '"pt"' }, false), { [S]: s(3), [L]: '"pt"' });
  assert.deepEqual(N.oQueVolta({ [S]: s(5), [L]: '"en"' }, { [S]: s(3), [L]: '"pt"' }, true), {}, 'local mais novo e idioma do aparelho ficam');
  assert.deepEqual(N.oQueVolta({ [S]: s(5) }, { [S]: s(9) }, true), { [S]: s(9) });
  assert.deepEqual(N.oQueVolta({ [S]: s(50) }, { [S]: s(9) }, false), { [S]: s(9) }, 'orfao perde');
  assert.deepEqual(N.oQueVolta({}, { [PREFIXO + N.MARCA]: '1', [PREFIXO + 'outra']: 'x' }, false), {}, 'chave fora de CHAVES nao volta');
});

// Por ultimo: quebra o localStorage do modulo de storage para o resto do arquivo.
test('sem save que dure, a compra vale na sessao e nao recebe fulfill', async () => {
  zera();
  const srv = servidorFalso();
  const sdk = sdkPago(srv);
  try {
    const { p, progress } = await abre(sdk);
    discoQuebrado = true;
    assert.equal(await p.pacotes.comprar('coins-1500'), 'ok');
    await sossega();
    assert.equal(isPersistent(), false);
    assert.equal(progress.data.coins, 1500, 'na sessao');
    assert.equal(fulfills(sdk).length, 0, 'sem fulfill: ela volta na proxima abertura');
    assert.equal([...srv.compras.values()][0].fulfilled, false);
  } finally {
    zera();
  }
});
