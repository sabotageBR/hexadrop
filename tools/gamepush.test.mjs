/**
 * Teste de unidade do adaptador da GamePush (src/portais/gamepush.js) e do
 * russo (src/portais/gamepush-textos.js), em Node puro: um `gp` falso com a
 * forma do SDK real (medido em 2026-11-08), um `document` minimo e o relogio
 * falso do node:test, para a espera de 8 s e o intervalo de 180 s andarem sem
 * esperar de verdade.
 *
 *   node --test tools/gamepush.test.mjs     (ou npm run test:gamepush)
 *
 * Cobre o que o checklist da GamePush cobra e a prova do zip
 * (distribuicao/provar-gamepush.mjs) so ve de fora: o gameStart uma vez por
 * carga, no fim do carregamento ou quando o SDK chega depois; a espera de no
 * maximo 8 s desde a abertura, e o jogo inteiro sem SDK; o intersticial so com
 * anuncio disponivel e 180 s desde o gameStart e desde o anterior, e so nas
 * passagens de fase; o premio so com `true`, com o aviso de falha da GamePush;
 * o botao de video que some sem SDK ou sem anuncio; o mudo e a pausa da
 * plataforma por cima da escolha do jogador; o idioma (ajustes, SDK,
 * navegador, ingles) e a troca ao vivo com o SDK atrasado; o russo com todas as
 * chaves do ingles e o plural russo; e o SDK que lanca excecao.
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// --------------------------------------------------- navegador minimo
mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1790000000000 });
const g = /** @type {*} */ (globalThis);
g.window = globalThis;
const disco = new Map();
g.localStorage = {
  getItem: (/** @type {string} */ k) => (disco.has(k) ? disco.get(k) : null),
  setItem: (/** @type {string} */ k, /** @type {string} */ v) => disco.set(k, String(v)),
  removeItem: (/** @type {string} */ k) => disco.delete(k),
  get length() {
    return disco.size;
  },
  key: (/** @type {number} */ i) => [...disco.keys()][i] ?? null,
};
/** Estilos que o adaptador pos na pagina. @type {string[]} */
const estilos = [];
/** Fontes pedidas ao document.fonts. @type {Array<[string, string]>} */
const fontesPedidas = [];
const barra = { style: { width: '0%' } };
g.document = {
  hidden: false,
  head: { appendChild: (/** @type {*} */ el) => estilos.push(el.textContent) },
  createElement: () => ({ textContent: '' }),
  addEventListener: () => {},
  getElementById: (/** @type {string} */ id) => (id === 'loaderBar' ? barra : null),
  fonts: {
    load: (/** @type {string} */ f, /** @type {string} */ txt) => {
      fontesPedidas.push([f, txt]);
      return Promise.resolve([]);
    },
  },
};
/** O idioma do navegador (o Node 22 tem um navigator; aqui ele e trocavel). */
let idiomasDoNavegador = ['en-US'];
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  get: () => ({ language: idiomasDoNavegador[0], languages: idiomasDoNavegador, userAgent: 'node' }),
});

const { PortalGamePush, ESPERA_SDK_MS, INTERVALO_MIN_S } = await import('../src/portais/gamepush.js');
const { RUSSO, VIDEO, formaRussa } = await import('../src/portais/gamepush-textos.js');
const { getLang, setLang, t, LANGS, LANG_NAMES, idiomaDaPlataforma } = await import('../src/core/i18n.js');
const { audio } = await import('../src/core/audio.js');
const { remove } = await import('../src/core/storage.js');

/** Um emissor de eventos como o do SDK (on/off/emit). */
function emissor() {
  /** @type {Map<string, Function[]>} */
  const m = new Map();
  return {
    on: (/** @type {string} */ ev, /** @type {Function} */ f) => {
      if (!m.has(ev)) m.set(ev, []);
      /** @type {Function[]} */ (m.get(ev)).push(f);
    },
    off: (/** @type {string} */ ev, /** @type {Function} */ f) => m.set(ev, (m.get(ev) || []).filter((x) => x !== f)),
    emit: (/** @type {string} */ ev, /** @type {*[]} */ ...a) => {
      for (const f of [...(m.get(ev) || [])]) f(...a);
    },
    quantos: (/** @type {string} */ ev) => (m.get(ev) || []).length,
  };
}

/**
 * O `gp` falso: registra as chamadas e simula os anuncios com os eventos do
 * SDK real (ads start, gp pause, sounds mute, e o contrario no fim).
 * @param {{lang?: string, fullscreen?: boolean, premiado?: boolean, resultado?: *, falha?: boolean,
 *   mudo?: boolean, lanca?: boolean}} [o]
 */
function gpFalso(o = {}) {
  /** @type {Array<[string, *?]>} */
  const chamadas = [];
  const gpEv = emissor();
  const somEv = emissor();
  const adsEv = emissor();
  const estado = { fullscreen: o.fullscreen ?? true, premiado: o.premiado ?? true, resultado: o.resultado ?? true };
  /** @param {string} tipo @param {*} [opts] */
  const anuncio = (tipo, opts) => {
    chamadas.push([tipo, opts]);
    if (o.falha) return Promise.reject(new Error('anuncio quebrou'));
    adsEv.emit('start');
    gpEv.emit('pause');
    somEv.emit('mute');
    return Promise.resolve().then(() => {
      gpEv.emit('resume');
      somEv.emit('unmute');
      return estado.resultado;
    });
  };
  const lanca = () => {
    if (o.lanca) throw new Error('SDK quebrado');
  };
  const gp = {
    get language() {
      chamadas.push(['language']);
      lanca();
      return o.lang ?? 'en';
    },
    isMobile: false,
    on: gpEv.on,
    off: gpEv.off,
    gameStart: () => {
      chamadas.push(['gameStart']);
      lanca();
    },
    gameplayStart: () => {
      chamadas.push(['gameplayStart']);
      lanca();
    },
    gameplayStop: () => {
      chamadas.push(['gameplayStop']);
      lanca();
    },
    sounds: {
      on: somEv.on,
      off: somEv.off,
      isMuted: o.mudo === true,
      isSFXMuted: false,
      isMusicMuted: false,
    },
    ads: {
      on: adsEv.on,
      off: adsEv.off,
      get isFullscreenAvailable() {
        lanca();
        return estado.fullscreen;
      },
      get isRewardedAvailable() {
        lanca();
        return estado.premiado;
      },
      showFullscreen: (/** @type {*} */ opts) => anuncio('showFullscreen', opts),
      showRewardedVideo: (/** @type {*} */ opts) => anuncio('showRewardedVideo', opts),
      showPreloader: () => chamadas.push(['showPreloader']),
      showSticky: () => chamadas.push(['showSticky']),
    },
    payments: { purchase: () => chamadas.push(['purchase']) },
    player: { set: () => chamadas.push(['player.set']), sync: () => chamadas.push(['player.sync']) },
    storage: { set: () => chamadas.push(['storage.set']) },
  };
  return { gp, chamadas, estado, gpEv, somEv, adsEv };
}

/** @param {Array<[string, *?]>} ch @param {string} nome */
const vezes = (ch, nome) => ch.filter((c) => c[0] === nome).length;

/** Uma promessa que o teste resolve quando quiser (o `onGPInit` do carregador). */
function sdkQueChega() {
  /** @type {(gp: *) => void} */
  let chega = () => {};
  const promessa = new Promise((ok) => {
    chega = ok;
  });
  return { promessa, chega };
}

/** O relogio dos intervalos, separado do Date para o teste mandar. */
function relogio(inicio = 0) {
  let t = inicio;
  return { agora: () => t, anda: (/** @type {number} */ ms) => (t += ms) };
}

/** Deixa as promessas resolvidas andarem. */
const gira = async (n = 40) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

/**
 * Os ganchos que main.js liga, gravados.
 * @param {*} p
 */
function ganchos(p) {
  /** @type {string[]} */
  const log = [];
  p.onAdStart = () => log.push('adStart');
  p.onAdEnd = () => log.push('adEnd');
  p.onAdPlay = () => log.push('adPlay');
  p.onSemVideo = () => log.push('semVideo');
  p.onSilencio = (/** @type {boolean} */ m) => log.push(`silencio:${m}`);
  p.onPausaPortal = (/** @type {boolean} */ m) => log.push(`pausa:${m}`);
  return log;
}

/** O boot de main.js, na ordem, depois de src/portais/inicio.js. */
async function carregar(/** @type {*} */ p) {
  await p.preparar();
  await p.init();
  p.gameLoadingFinished();
}

/** Volta o idioma ao do teste anterior nao influir: nada nos ajustes, ingles. */
function limpaIdioma() {
  remove('lang');
  idiomaDaPlataforma('en');
  idiomasDoNavegador = ['en-US'];
}

// ------------------------------------------------------------------ testes

test('gameStart uma vez por carga, so no fim do carregamento', async () => {
  limpaIdioma();
  const { gp, chamadas } = gpFalso();
  const p = new PortalGamePush({ sdk: Promise.resolve(gp), desdeAbertura: () => 0 });
  await p.preparar();
  await p.init();
  assert.equal(vezes(chamadas, 'gameStart'), 0, 'antes do jogo ficar interativo, nada');
  p.gameLoadingFinished();
  p.gameLoadingFinished();
  assert.equal(vezes(chamadas, 'gameStart'), 1);
  assert.equal(p.ready, true);
});

test('espera: no maximo 8 s desde a abertura; sem SDK o jogo segue inteiro', async () => {
  limpaIdioma();
  assert.equal(ESPERA_SDK_MS, 8000);
  const nunca = new Promise(() => {});
  const p = new PortalGamePush({ sdk: nunca, desdeAbertura: () => 3000 });
  const log = ganchos(p);
  let pronto = false;
  p.preparar().then(() => (pronto = true));
  mock.timers.tick(4999);
  await gira();
  assert.equal(pronto, false, 'ainda dentro dos 8 s (3 s ja tinham passado na abertura)');
  mock.timers.tick(1);
  await gira();
  assert.equal(pronto, true, 'aos 8 s desde a abertura o jogo segue');
  await p.init();
  p.gameLoadingFinished();
  assert.equal(p.ready, false);
  assert.equal(p.haVideo(), false, 'sem SDK, nenhum botao de video');
  await p.commercialBreak('troca');
  assert.deepEqual(log.filter((l) => l.startsWith('ad')), [], 'o intervalo sai na hora, sem parar o jogo');
  assert.equal(await p.rewardedBreak('medium'), false, 'sem SDK, nunca premio');
  assert.ok(log.includes('semVideo'));
});

test('a barra do carregamento anda durante a espera e para no fim dela', async () => {
  limpaIdioma();
  let desde = 0;
  barra.style.width = '0%';
  const p = new PortalGamePush({ sdk: new Promise(() => {}), desdeAbertura: () => desde });
  const espera = p.preparar();
  assert.equal(barra.style.width, '5%');
  desde = 4000;
  mock.timers.tick(200);
  assert.equal(barra.style.width, '18%');
  desde = 8000;
  mock.timers.tick(8000);
  await espera;
  assert.equal(barra.style.width, '30%');
  barra.style.width = 'x';
  mock.timers.tick(1000);
  assert.equal(barra.style.width, 'x', 'depois da espera a barra e de main.js');
});

test('SDK que chega depois: gameStart quando ele chega, e o idioma dele troca ao vivo', async () => {
  limpaIdioma();
  idiomasDoNavegador = ['en-GB'];
  const { promessa, chega } = sdkQueChega();
  const { gp, chamadas } = gpFalso({ lang: 'ru' });
  const p = new PortalGamePush({ sdk: promessa, desdeAbertura: () => 0 });
  const prep = p.preparar();
  mock.timers.tick(ESPERA_SDK_MS);
  await prep;
  await p.init();
  assert.equal(getLang(), 'en', 'sem SDK no prazo, o idioma do navegador');
  p.gameLoadingFinished();
  p.gameplayStart();
  assert.equal(vezes(chamadas, 'gameStart'), 0);
  chega(gp);
  await gira();
  assert.equal(p.ready, true);
  assert.equal(vezes(chamadas, 'gameStart'), 1, 'o gameStart sai quando o SDK chega');
  assert.equal(vezes(chamadas, 'gameplayStart'), 1, 'o jogo ja estava em jogo: o SDK fica sabendo');
  assert.equal(getLang(), 'en', 'a troca espera o boot de main.js ligar o onLangChange');
  mock.timers.tick(0);
  assert.equal(getLang(), 'ru', 'o idioma da plataforma, ao vivo');
  p.gameLoadingFinished();
  assert.equal(vezes(chamadas, 'gameStart'), 1, 'e uma vez so');
});

test('SDK atrasado nao passa por cima do idioma escolhido nos ajustes', async () => {
  limpaIdioma();
  setLang('es');
  const { promessa, chega } = sdkQueChega();
  const { gp } = gpFalso({ lang: 'ru' });
  const p = new PortalGamePush({ sdk: promessa, desdeAbertura: () => 0 });
  const prep = p.preparar();
  mock.timers.tick(ESPERA_SDK_MS);
  await prep;
  p.gameLoadingFinished();
  chega(gp);
  await gira();
  mock.timers.tick(0);
  assert.equal(getLang(), 'es');
});

test('idioma: ajustes, depois gp.language, depois o navegador, depois o ingles', async () => {
  /** @param {string} lang @param {string[]} nav @param {string|null} salvo */
  const abre = async (lang, nav, salvo) => {
    limpaIdioma();
    idiomasDoNavegador = nav;
    if (salvo) setLang(salvo);
    const { gp, chamadas } = gpFalso({ lang });
    const p = new PortalGamePush({ sdk: Promise.resolve(gp), desdeAbertura: () => 0 });
    await p.preparar();
    assert.ok(vezes(chamadas, 'language') >= 1, 'o jogo le o gp.language');
    return getLang();
  };
  assert.equal(await abre('ru', ['en-US'], null), 'ru');
  assert.equal(await abre('pt', ['en-US'], null), 'pt', 'o pt do SDK cobre o pt-BR');
  assert.equal(await abre('ru', ['en-US'], 'pt'), 'pt', 'a escolha dos ajustes vence');
  assert.equal(await abre('zh', ['es-MX', 'en'], null), 'es', 'o SDK numa lingua que o jogo nao tem: o navegador');
  assert.equal(await abre('zh', ['ja-JP'], null), 'en');
  assert.equal(await abre('', ['ru-RU'], null), 'ru', 'sem idioma do SDK, o russo do navegador');
  // Sem SDK nenhum: o navegador (o russo ja existe neste build).
  limpaIdioma();
  idiomasDoNavegador = ['ru-RU', 'en'];
  const p = new PortalGamePush({ sdk: null, desdeAbertura: () => 0 });
  await p.preparar();
  assert.equal(getLang(), 'ru');
  assert.ok(fontesPedidas.some(([f, txt]) => /Fredoka/.test(f) && /[А-я]/.test(txt)), 'em russo a fonte cirilica e pedida antes do grito');
});

test('intersticial: so com anuncio, so nas passagens de fase, e 180 s desde o gameStart e desde o anterior', async () => {
  limpaIdioma();
  assert.equal(INTERVALO_MIN_S, 180);
  const r = relogio(1000);
  const { gp, chamadas, estado } = gpFalso();
  const p = new PortalGamePush({ sdk: Promise.resolve(gp), desdeAbertura: () => 0, agora: r.agora });
  const log = ganchos(p);
  await p.preparar();
  await p.init();
  assert.equal(p.podeIntersticial(), false, 'antes do gameStart, nunca');
  p.gameLoadingFinished();
  r.anda(179999);
  await p.commercialBreak('troca');
  assert.equal(vezes(chamadas, 'showFullscreen'), 0, '179,999 s depois do gameStart: nada');
  assert.deepEqual(log.filter((l) => l.startsWith('ad')), [], 'e o jogo nem parou');
  r.anda(1);
  for (const ponto of ['retomar', 'repetir', undefined]) await p.commercialBreak(ponto);
  assert.equal(vezes(chamadas, 'showFullscreen'), 0, 'nunca ao retomar da pausa nem no repetir do cartao de derrota');
  estado.fullscreen = false;
  await p.commercialBreak('troca');
  assert.equal(vezes(chamadas, 'showFullscreen'), 0, 'sem anuncio disponivel, nada');
  estado.fullscreen = true;
  await p.commercialBreak('troca');
  assert.equal(vezes(chamadas, 'showFullscreen'), 1);
  assert.deepEqual(log.filter((l) => l.startsWith('ad')), ['adStart', 'adEnd'], 'o jogo para (e cala) no pedido e volta no fim');
  r.anda(120000);
  await p.commercialBreak('proxima');
  assert.equal(vezes(chamadas, 'showFullscreen'), 1, '120 s depois do anterior: nada');
  r.anda(60000);
  await p.commercialBreak('recomeco');
  assert.equal(vezes(chamadas, 'showFullscreen'), 2, '180 s depois do anterior: sai');
  // O premiado tambem conta: nada de intersticial logo depois de um video.
  r.anda(200000);
  await p.rewardedBreak('medium');
  r.anda(1000);
  await p.commercialBreak('troca');
  assert.equal(vezes(chamadas, 'showFullscreen'), 2, 'logo depois de um premiado: nada');
  assert.equal(vezes(chamadas, 'showPreloader') + vezes(chamadas, 'showSticky'), 0, 'sem preloader nem sticky');
});

test('premiado: o premio so com true, e o aviso de falha e o da GamePush', async () => {
  limpaIdioma();
  const { gp, chamadas, estado } = gpFalso();
  const p = new PortalGamePush({ sdk: Promise.resolve(gp), desdeAbertura: () => 0 });
  const log = ganchos(p);
  await carregar(p);
  assert.equal(await p.rewardedBreak('medium'), true);
  const pedido = chamadas.find((c) => c[0] === 'showRewardedVideo');
  assert.deepEqual(pedido && pedido[1], { showFailedOverlay: true });
  estado.resultado = false;
  assert.equal(await p.rewardedBreak('medium'), false, 'fechado antes do fim, ou sem anuncio: sem premio');
  estado.resultado = 'true';
  assert.equal(await p.rewardedBreak('medium'), false, 'so o true de verdade');
  estado.resultado = undefined;
  assert.equal(await p.rewardedBreak('medium'), false);
  assert.ok(!log.includes('semVideo'), 'sem toast do jogo: o aviso e o showFailedOverlay');
  assert.equal(log.filter((l) => l === 'adStart').length, 4);
  assert.equal(log.filter((l) => l === 'adEnd').length, 4, 'todo anuncio termina e devolve o jogo');
  assert.equal(p.inBreak, false);
});

test('premiado que rejeita ou nunca responde: sem premio, e o jogo volta', async () => {
  limpaIdioma();
  const f = gpFalso({ falha: true });
  const p = new PortalGamePush({ sdk: Promise.resolve(f.gp), desdeAbertura: () => 0 });
  const log = ganchos(p);
  await carregar(p);
  assert.equal(await p.rewardedBreak('medium'), false);
  assert.deepEqual(log.filter((l) => l.startsWith('ad')), ['adStart', 'adEnd']);
  // Um anuncio que nunca comeca nem termina: o prazo de base.js devolve o jogo.
  f.gp.ads.showRewardedVideo = () => new Promise(() => {});
  let fim = null;
  p.rewardedBreak('medium').then((ok) => (fim = ok));
  await gira();
  assert.equal(fim, null);
  mock.timers.tick(15000);
  await gira();
  assert.equal(fim, false);
  assert.equal(p.inBreak, false);
});

test('botao de video: so com o SDK pronto e anuncio disponivel, conferido a cada vez', async () => {
  limpaIdioma();
  const { promessa, chega } = sdkQueChega();
  const { gp, estado } = gpFalso();
  const p = new PortalGamePush({ sdk: promessa, desdeAbertura: () => 0 });
  const prep = p.preparar();
  mock.timers.tick(ESPERA_SDK_MS);
  await prep;
  assert.equal(p.haVideo(), false, 'sem SDK');
  chega(gp);
  await gira();
  assert.equal(p.haVideo(), true);
  estado.premiado = false;
  assert.equal(p.haVideo(), false, 'sem anuncio disponivel o botao some');
  estado.premiado = true;
  assert.equal(p.haVideo(), true, 'e volta quando ha anuncio de novo');
  // Durante um anuncio, nenhum botao de video novo.
  let dentro = null;
  gp.ads.showRewardedVideo = () => {
    dentro = p.haVideo();
    return Promise.resolve(true);
  };
  await p.rewardedBreak('medium');
  assert.equal(dentro, false);
});

test('mudo e pausa da plataforma: gp.sounds e gp pause, e o anuncio do proprio jogo nao abre a pausa', async () => {
  limpaIdioma();
  const { gp, gpEv, somEv } = gpFalso({ mudo: true });
  const p = new PortalGamePush({ sdk: Promise.resolve(gp), desdeAbertura: () => 0 });
  const log = ganchos(p);
  await p.preparar();
  await p.init();
  assert.equal(log.at(-1), 'silencio:true', 'gp.sounds.isMuted na partida');
  somEv.emit('unmute');
  assert.equal(log.at(-1), 'silencio:false');
  somEv.emit('mute');
  assert.equal(log.at(-1), 'silencio:true');
  somEv.emit('unmute');
  gpEv.emit('pause');
  assert.deepEqual(log.slice(-2), ['silencio:true', 'pausa:true'], 'a pausa do SDK cala e pausa');
  gpEv.emit('resume');
  assert.deepEqual(log.slice(-2), ['silencio:false', 'pausa:false']);
  p.gameLoadingFinished();
  const antes = log.length;
  await p.rewardedBreak('medium');
  assert.ok(!log.slice(antes).some((l) => l.startsWith('pausa')), 'a pausa do SDK durante o nosso anuncio nao abre a tela de pausa');
  assert.ok(log.slice(antes).includes('adStart'));
});

test('mudo parcial: mute:sfx e mute:music calam um barramento, sem mexer na escolha do jogador', async () => {
  limpaIdioma();
  /** @type {Record<string, number[]>} */
  const ganho = { sfx: [], musica: [] };
  const a = /** @type {*} */ (audio);
  a.ctx = { currentTime: 0, state: 'running' };
  a.sfxBus = { gain: { setTargetAtTime: (/** @type {number} */ v) => ganho.sfx.push(v) } };
  a.musicBus = { gain: { setTargetAtTime: (/** @type {number} */ v) => ganho.musica.push(v) } };
  a.sfxOn = true;
  a.musicOn = true;
  const { gp, somEv } = gpFalso();
  const p = new PortalGamePush({ sdk: Promise.resolve(gp), desdeAbertura: () => 0 });
  await p.preparar();
  const salvoAntes = localStorage.getItem('hexadrop.sfxOn');
  somEv.emit('mute:sfx');
  assert.equal(ganho.sfx.at(-1), 0);
  assert.equal(ganho.musica.at(-1), 0.3, 'a musica continua');
  assert.equal(a.sfxOn, true, 'a escolha do jogador fica');
  assert.equal(localStorage.getItem('hexadrop.sfxOn'), salvoAntes, 'e nada e gravado');
  // O jogador religa os efeitos nos ajustes: a plataforma continua mandando.
  a.setMusic(true);
  assert.equal(ganho.sfx.at(-1), 0);
  somEv.emit('unmute:sfx');
  assert.equal(ganho.sfx.at(-1), 0.85, 'volta ao que o jogador escolheu');
  somEv.emit('mute:music');
  assert.equal(ganho.musica.at(-1), 0);
  somEv.emit('unmute:music');
  assert.equal(ganho.musica.at(-1), 0.3);
  a.ctx = null;
  a.sfxBus = null;
  a.musicBus = null;
});

test('gameplayStart/Stop balanceados, e nada para o SDK durante um anuncio', async () => {
  limpaIdioma();
  const { gp, chamadas } = gpFalso();
  const p = new PortalGamePush({ sdk: Promise.resolve(gp), desdeAbertura: () => 0 });
  await carregar(p);
  p.gameplayStart();
  p.gameplayStart();
  p.gameplayStop();
  p.gameplayStop();
  assert.equal(vezes(chamadas, 'gameplayStart'), 1);
  assert.equal(vezes(chamadas, 'gameplayStop'), 1);
  p.gameplayStart();
  gp.ads.showRewardedVideo = () => {
    p.gameplayStart();
    return Promise.resolve(true);
  };
  await p.rewardedBreak('medium');
  assert.equal(vezes(chamadas, 'gameplayStart'), 2, 'nenhum gameplayStart dentro do anuncio');
  assert.equal(vezes(chamadas, 'gameplayStop'), 2, 'o anuncio para o gameplay antes');
});

test('SDK que lanca excecao nao derruba o jogo', async () => {
  limpaIdioma();
  const { gp } = gpFalso({ lanca: true });
  const p = new PortalGamePush({ sdk: Promise.resolve(gp), desdeAbertura: () => 0 });
  await carregar(p);
  p.gameplayStart();
  p.gameplayStop();
  assert.equal(p.haVideo(), false);
  assert.equal(p.podeIntersticial(), false);
  assert.equal(getLang(), 'en');
});

test('nada de save pela GamePush nem compra', async () => {
  limpaIdioma();
  const { gp, chamadas } = gpFalso();
  const p = new PortalGamePush({ sdk: Promise.resolve(gp), desdeAbertura: () => 0 });
  await carregar(p);
  p.gameplayStart();
  p.gameplayStop();
  p.progresso(10);
  p.measure('level', '1', 'complete');
  assert.deepEqual(chamadas.filter((c) => /purchase|player|storage/.test(c[0])), []);
  const fonte = readFileSync(new URL('../src/portais/gamepush.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/gp\.(player|storage|payments)|_gp\.(player|storage|payments)|console\.log|window\.open|alert\(|confirm\(|prompt\(/.test(fonte));
});

test('russo: as mesmas chaves do ingles, no seletor dos ajustes, e os rotulos de video', () => {
  const fonte = readFileSync(new URL('../src/core/i18n.js', import.meta.url), 'utf8');
  const bloco = fonte.slice(fonte.indexOf('  en: {'), fonte.indexOf('\n  },', fonte.indexOf('  en: {')));
  const chavesEn = [...bloco.matchAll(/^ {4}(\w+):/gm)].map((m) => m[1]);
  assert.ok(chavesEn.length > 200);
  assert.deepEqual(Object.keys(RUSSO).sort(), [...chavesEn].sort());
  for (const [k, v] of Object.entries(RUSSO)) {
    if (Array.isArray(v)) for (const s of v) assert.match(s, /^[А-ЯЁ!]+$/, `${k}: grito so com letras cirilicas maiusculas`);
  }
  assert.ok(LANGS.includes('ru'));
  assert.equal(/** @type {*} */ (LANG_NAMES).ru, 'Русский');
  for (const lang of LANGS) {
    assert.ok(VIDEO[lang], `rotulo de video em ${lang}`);
    idiomaDaPlataforma(lang);
    if (getLang() !== lang) setLang(lang);
    assert.match(t('comVideo', 'X'), /^X \(.+\)$/);
    assert.notEqual(t('verVideo'), 'verVideo');
  }
  limpaIdioma();
});

test('russo: o plural de verdade (1 уровень, 2 уровня, 5 уровней)', () => {
  const casos = { 0: 2, 1: 0, 2: 1, 4: 1, 5: 2, 11: 2, 12: 2, 14: 2, 21: 0, 22: 1, 25: 2, 100: 2, 101: 0, 111: 2, 112: 2, 122: 1 };
  for (const [n, f] of Object.entries(casos)) assert.equal(formaRussa(Number(n)), f, `n = ${n}`);
  limpaIdioma();
  setLang('ru');
  assert.equal(t('levelsCleared', 100), 'Пройдено 100 уровней!');
  assert.equal(t('levelsCleared', 21), 'Пройден 21 уровень!');
  assert.equal(t('levelsCleared', 3), 'Пройдено 3 уровня!');
  assert.equal(t('gateNeed', 1), 'ещё 1 звезда, чтобы открыть');
  assert.equal(t('gateNeed', 3), 'ещё 3 звезды, чтобы открыть');
  assert.equal(t('gateNeed', 7), 'ещё 7 звёзд, чтобы открыть');
  assert.equal(t('perfeitasMarco', 25), '25 идеальных прохождений');
  assert.equal(t('perfeitasMarco', 51), '51 идеальное прохождение');
  assert.equal(t('prizeWorld', 3), 'Пройди мир 3');
  assert.equal(t('comVideo', t('skipLevel')), 'Пропустить уровень (видео)');
  limpaIdioma();
});

test('fonte cirilica: a Nunito so nas letras cirilicas, na familia do grito', () => {
  const regra = estilos.find((s) => s.includes('@font-face'));
  assert.ok(regra);
  assert.match(regra, /font-family: 'Fredoka'/);
  assert.match(regra, /nunito-cyrillic-900-normal\.woff2/);
  assert.match(regra, /unicode-range: U\+0301,U\+0400-045F/);
});

test('o empacotador reprova: carregador, ids, onGPInit, URL de fora, caminho absoluto, outro portal, storage e console.log', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { PORTAIS, carregadorGamePush, IDS_GAMEPUSH } = await import('./portais-sdk.mjs');
  const { conferirBuildGamePush } = await import('./gamepush-regras.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'hexadrop-gamepush-regras-'));
  const JS_BOM = 'const N="hexadrop.";let y=!1;function z(s){const a=N+s;try{return window.localStorage.getItem(a)}catch{return null}}export{z};';
  /** @param {{html?: string, js?: string}} o */
  const confere = (o = {}) => {
    rmSync(join(dir, 'b'), { recursive: true, force: true });
    mkdirSync(join(dir, 'b', 'assets'), { recursive: true });
    const cabeca = o.html ?? PORTAIS.gamepush.html;
    writeFileSync(join(dir, 'b', 'index.html'),
      `<!doctype html><html><head><title>Hexa Drop</title>\n${cabeca}\n<script type="module" src="./assets/a.js"></script></head><body></body></html>`);
    writeFileSync(join(dir, 'b', 'assets', 'a.js'), o.js ?? JS_BOM);
    return conferirBuildGamePush({ pasta: join(dir, 'b') }).join(' | ');
  };
  try {
    assert.equal(confere(), '', 'o build bom passa');
    const outroToken = PORTAIS.gamepush.html.replace(IDS_GAMEPUSH.publicToken, 'OUTRO');
    assert.match(confere({ html: outroToken }), /outros ids/);
    assert.match(confere({ html: carregadorGamePush('99999', IDS_GAMEPUSH.publicToken) }), /projectId=99999/);
    assert.match(confere({ html: PORTAIS.gamepush.html.split('\n').filter((l) => !l.includes('__gpPronto')).join('\n') }), /onGPInit nao e definido antes/);
    assert.match(confere({ html: '' }), /falta o carregador oficial/);
    assert.match(confere({ js: `${JS_BOM}console.log("oi");` }), /console\.log/);
    assert.match(confere({ js: `${JS_BOM}localStorage.clear();` }), /localStorage\.clear|localStorage usado fora/);
    assert.match(confere({ js: `${JS_BOM}window.localStorage.setItem("save","1");` }), /localStorage usado fora|sem o prefixo/);
    assert.match(confere({ js: `${JS_BOM}const k="save";window.localStorage.removeItem(k);` }), /sem o prefixo/);
    assert.match(confere({ js: `${JS_BOM}fetch("https://cdn.exemplo.com/x.js");` }), /URL externa/);
    assert.match(confere({ js: `${JS_BOM}import("/assets/b.js");` }), /caminho absoluto/);
    assert.match(confere({ html: `${PORTAIS.gamepush.html}\n<img src="/logo.png">` }), /caminho absoluto/);
    assert.match(confere({ js: `${JS_BOM}const p="poki";` }), /outro portal/);
    assert.match(confere({ js: `${JS_BOM}window.open("x");` }), /window\.open/);
    assert.match(confere({ js: `${JS_BOM}alert("x");` }), /alert\(\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
