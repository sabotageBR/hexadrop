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
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// --------------------------------------------------- navegador minimo
mock.timers.enable({ apis: ['setTimeout'] });
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
const { load, remove, isPersistent } = await import('../src/core/storage.js');

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
async function sossega() {
  for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r));
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
  await p.preparar();
  if (o.ligaAntes !== false) liga();
  await p.init();
  p.gameLoadingFinished();
  await sossega();
  return { p, progress, avisos, liga };
}

/** Save zerado e nenhum SDK: cada teste comeca de um jogador novo. */
function zera() {
  remove('save');
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
