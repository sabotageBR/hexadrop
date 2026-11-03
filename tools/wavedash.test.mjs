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
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// --------------------------------------------------- navegador minimo
mock.timers.enable({ apis: ['setTimeout'] });
const g = /** @type {*} */ (globalThis);
g.window = globalThis;
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
