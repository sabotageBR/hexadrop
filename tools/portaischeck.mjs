/**
 * Banco dos portais de distribuicao (src/portais/): cada build roda com um SDK
 * falso que imita o do portal - servido no lugar do de verdade, pela mesma
 * URL - e a automacao confere o que as regras de cada um cobram:
 *
 * - o SDK inicia e o jogo avisa o fim do carregamento do jeito do portal;
 * - o idioma vem do portal (o falso responde `tr`) onde ele tem API para isso;
 * - o intervalo comercial chega ao SDK e o som esta calado quando o video
 *   entra; na Y8 so de clique (`proxima`), e nunca das passagens automaticas;
 * - o video recompensado paga so quando o SDK diz que foi visto ate o fim;
 * - a pausa do portal fora do anuncio cala o jogo, e a volta devolve o som;
 * - na Playgama e na GamePix o save vai para o armazenamento do portal;
 * - na GameDistribution o pre-roll sai antes do jogo abrir.
 *
 * Cada portal e montado em .tmp/portaischeck/<portal> com ids de teste (os de
 * marketing/portais/ids.json ficam para o build publicado) e servido por um
 * servidor estatico proprio na porta 4185; o Chrome usa a porta de depuracao
 * 9119. Rode sozinho, como as outras ferramentas de tools/.
 *
 *   node tools/portaischeck.mjs              # os seis
 *   node tools/portaischeck.mjs yandex y8    # so esses
 */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { PORTAIS } from './portais-sdk.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORTA_HTTP = 4185;
const PORTA_CDP = 9119;
const pedidos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ALVOS = pedidos.length ? pedidos : Object.keys(PORTAIS);
const IDS_TESTE = { appId: 'teste-app', gameId: 'teste-jogo' };

/** O que o SDK falso guarda e o que a automacao manda nele. Vale para todos. */
const COMUM = `
window.__log = window.__log || [];
window.__sdkFalso = window.__sdkFalso || { premio: true, store: {}, pausar() {}, retomar() {} };
window.__calado = () => !!(window.__audio && (window.__audio.adMuted || window.__audio.platformMuted));
`;

/** Os SDKs falsos, pela URL que o build pede. */
const FALSOS = {
  yandex: {
    url: '*/sdk.js',
    js: `${COMUM}
window.YaGames = { init() {
  const ev = {};
  const s = {
    deviceInfo: { type: 'desktop' },
    environment: { i18n: { lang: 'tr' } },
    features: { LoadingAPI: { ready() { __log.push('pronto'); } } },
    on(n, f) { (ev[n] = ev[n] || []).push(f); },
    adv: {
      showFullscreenAdv({ callbacks: c }) {
        __log.push('midgame');
        setTimeout(() => { c.onOpen(); __log.push('abriu:' + __calado()); setTimeout(() => c.onClose(true), 250); }, 80);
      },
      showRewardedVideo({ callbacks: c }) {
        __log.push('rewarded');
        setTimeout(() => { c.onOpen(); __log.push('abriu:' + __calado());
          setTimeout(() => { if (__sdkFalso.premio) c.onRewarded(); c.onClose(); }, 250); }, 80);
      },
    },
  };
  __sdkFalso.pausar = () => (ev.game_api_pause || []).forEach((f) => f());
  __sdkFalso.retomar = () => (ev.game_api_resume || []).forEach((f) => f());
  return Promise.resolve(s);
} };`,
  },
  playgama: {
    url: '*playgama-bridge.js*',
    js: `${COMUM}
(() => {
  const ouv = { a: {}, p: {} };
  const on = (t) => (n, f) => { (ouv[t][n] = ouv[t][n] || []).push(f); };
  const off = (t) => (n, f) => { ouv[t][n] = (ouv[t][n] || []).filter((g) => g !== f); };
  const emite = (t, n, v) => (ouv[t][n] || []).slice().forEach((f) => f(v));
  const E = { INTERSTITIAL_STATE_CHANGED: 'i', REWARDED_STATE_CHANGED: 'r', AUDIO_STATE_CHANGED: 'au', PAUSE_STATE_CHANGED: 'pa' };
  const anuncio = (n, premio) => {
    setTimeout(() => { emite('a', n, 'opened'); __log.push('abriu:' + __calado());
      setTimeout(() => { if (premio) emite('a', n, 'rewarded'); emite('a', n, 'closed'); }, 250); }, 80);
  };
  window.bridge = {
    EVENT_NAME: E,
    initialize() { __log.push('init'); return Promise.resolve(); },
    device: { type: 'mobile' },
    platform: {
      language: 'tr', isAudioEnabled: true,
      on: on('p'),
      sendMessage(m, o) { __log.push('msg:' + m + (o && o.level ? ':' + o.level : '')); },
    },
    storage: {
      get(ks) { return Promise.resolve(ks.map((k) => (k in __sdkFalso.store ? __sdkFalso.store[k] : null))); },
      set(ks, vs) { ks.forEach((k, i) => { __sdkFalso.store[k] = vs[i]; }); __log.push('gravou'); return Promise.resolve(); },
    },
    advertisement: {
      isInterstitialSupported: true, isRewardedSupported: true,
      on: on('a'), off: off('a'),
      showInterstitial() { __log.push('midgame'); anuncio('i', false); },
      showRewarded() { __log.push('rewarded'); anuncio('r', __sdkFalso.premio); },
    },
  };
  __sdkFalso.pausar = () => emite('p', 'pa', true);
  __sdkFalso.retomar = () => emite('p', 'pa', false);
  __sdkFalso.semSom = (v) => emite('p', 'au', !v);
})();`,
  },
  gamepix: {
    url: '*gamepix.sdk.js*',
    js: `${COMUM}
window.GamePix = {
  loading(n) { __log.push('loading:' + n); },
  loaded() { __log.push('pronto'); return Promise.resolve(); },
  lang() { return 'tr'; },
  localStorage: {
    getItem(k) { return k in __sdkFalso.store ? __sdkFalso.store[k] : null; },
    setItem(k, v) { __sdkFalso.store[k] = String(v); __log.push('gravou'); },
    removeItem(k) { delete __sdkFalso.store[k]; },
  },
  updateLevel(n) { __log.push('fase:' + n); },
  happyMoment() { __log.push('festa'); },
  interstitialAd() { __log.push('midgame'); return new Promise((r) => setTimeout(() => { __log.push('abriu:' + __calado()); r({ success: true }); }, 250)); },
  rewardAd() { __log.push('rewarded'); return new Promise((r) => setTimeout(() => { __log.push('abriu:' + __calado()); r({ success: __sdkFalso.premio }); }, 250)); },
};
// como o SDK v3 de verdade: GamePix.on.<evento> se for funcao, senao GamePix.<evento>
GamePix.on = { pause: false, resume: false, soundOn: false, soundOff: false };
const despacha = (n) => (typeof GamePix.on[n] === 'function' ? GamePix.on[n] : GamePix[n])();
__sdkFalso.pausar = () => despacha('pause');
__sdkFalso.retomar = () => despacha('resume');`,
  },
  y8: {
    url: '*y8.min.js*',
    js: `${COMUM}
window.y8 = {
  emitReadyEvent() { window.dispatchEvent(new Event('y8sdk.ready')); },
  sdk() { return {
    init(app, ad) { __log.push('init:' + app.appId + ':' + (ad && ad.gameId)); },
    getPlatformLocale() { return Promise.resolve('tr'); },
    showAd(o) {
      __log.push(o.type === 'reward' ? 'rewarded' : 'midgame:' + o.type);
      return new Promise((res) => setTimeout(() => {
        o.beforeAd(); __log.push('abriu:' + __calado());
        if (o.type === 'reward') { o.beforeReward(() => {}); if (__sdkFalso.premio) o.adViewed(); else o.adDismissed(); }
        setTimeout(() => { o.afterAd(); o.adBreakDone({ breakStatus: __sdkFalso.premio ? 'viewed' : 'dismissed' }); res(); }, 250);
      }, 80));
    },
  }; },
};
window.dispatchEvent(new Event('y8sdk.ready'));`,
  },
  gamedistribution: {
    url: '*html5.api.gamedistribution.com*',
    js: `${COMUM}
(() => {
  const o = window.GD_OPTIONS;
  __log.push('opcoes:' + o.gameId);
  const emite = (name) => o.onEvent({ name });
  window.gdsdk = {
    preloadAd() { return Promise.resolve(); },
    showAd(t) {
      __log.push(t === 'rewarded' ? 'rewarded' : 'midgame:' + (window.__game ? 'jogo' : 'preroll'));
      return new Promise((res) => setTimeout(() => {
        emite('SDK_GAME_PAUSE'); __log.push('abriu:' + __calado());
        setTimeout(() => { if (t === 'rewarded' && __sdkFalso.premio) emite('SDK_REWARDED_WATCH_COMPLETE'); emite('SDK_GAME_START'); res(); }, 250);
      }, 80));
    },
  };
  __sdkFalso.pausar = () => emite('SDK_GAME_PAUSE');
  __sdkFalso.retomar = () => emite('SDK_GAME_START');
  setTimeout(() => emite('SDK_READY'), 40);
})();`,
  },
  gamemonetize: {
    url: '*api.gamemonetize.com*',
    js: `${COMUM}
(() => {
  const o = window.SDK_OPTIONS;
  __log.push('opcoes:' + o.gameId);
  const emite = (name) => o.onEvent({ name });
  window.sdk = {
    showBanner() {
      __log.push('midgame');
      setTimeout(() => { emite('SDK_GAME_PAUSE'); __log.push('abriu:' + __calado()); setTimeout(() => emite('SDK_GAME_START'), 250); }, 80);
    },
  };
  __sdkFalso.pausar = () => emite('SDK_GAME_PAUSE');
  __sdkFalso.retomar = () => emite('SDK_GAME_START');
  setTimeout(() => emite('SDK_READY'), 40);
})();`,
  },
};

/** O que cada portal tem e o banco confere. */
const TEM = {
  yandex: { idioma: true, pausa: true, premio: true, sinal: 'pronto' },
  playgama: { idioma: true, pausa: true, premio: true, sinal: 'msg:game_ready', save: true },
  gamepix: { idioma: true, pausa: true, premio: true, sinal: 'pronto', save: true },
  y8: { idioma: true, pausa: false, premio: true, sinal: 'init:teste-app:teste-jogo', soClique: true },
  gamedistribution: { idioma: false, pausa: true, premio: true, sinal: 'opcoes:teste-jogo', preroll: true },
  gamemonetize: { idioma: false, pausa: true, premio: false, sinal: 'opcoes:teste-jogo' },
};

let falhas = 0;
/** @param {string} nome @param {boolean} ok @param {string} [det] */
function confere(nome, ok, det = '') {
  console.log(`${ok ? '  ok  ' : ' FALHA'}  ${nome}${det ? '  -  ' + det : ''}`);
  if (!ok) falhas++;
}

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.txt': 'text/plain' };
/** @type {string} */
let pasta = '';
const servidor = createServer(async (req, res) => {
  try {
    let arq = normalize(join(pasta, decodeURIComponent(new URL(req.url || '/', 'http://x').pathname)));
    if (!arq.startsWith(pasta)) throw new Error('fora');
    if ((await stat(arq)).isDirectory()) arq = join(arq, 'index.html');
    res.writeHead(200, { 'content-type': TIPOS[extname(arq)] || 'application/octet-stream' });
    res.end(await readFile(arq));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => servidor.listen(PORTA_HTTP, '127.0.0.1', () => r(undefined)));

const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORTA_CDP}`, '--no-sandbox',
  '--disable-gpu', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => chrome.kill());
let ws = '';
for (let i = 0; i < 60 && !ws; i++) {
  try {
    ws = (await (await fetch(`http://127.0.0.1:${PORTA_CDP}/json/version`)).json()).webSocketDebuggerUrl;
  } catch {
    await sleep(250);
  }
}
const sock = new WebSocket(ws);
await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
let id = 0;
const pendentes = new Map();
/** @type {Map<string, (p:*)=>void>} */
const ouvintes = new Map();
/** @type {string[]} */
let erros = [];
sock.onmessage = (e) => {
  const m = JSON.parse(String(e.data));
  if (m.id && pendentes.has(m.id)) { pendentes.get(m.id)(m); pendentes.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text);
  if (m.method && ouvintes.has(m.method)) ouvintes.get(m.method)(m.params);
};
const send = (method, params = {}, sessionId) => new Promise((r) => {
  const mid = ++id;
  pendentes.set(mid, r);
  sock.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
});

for (const portal of ALVOS) {
  console.log(`\n=== ${PORTAIS[portal].nome} ===`);
  pasta = resolve(RAIZ, '.tmp/portaischeck', portal);
  const b = spawnSync('node', ['node_modules/vite/bin/vite.js', 'build', '--logLevel', 'error', '--outDir', pasta, '--emptyOutDir'], {
    cwd: RAIZ, encoding: 'utf8', env: { ...process.env, VITE_PLATAFORMA: portal, IDS_PORTAL: JSON.stringify(IDS_TESTE) },
  });
  if (b.status !== 0) { confere('build', false, b.stderr.slice(0, 300)); continue; }
  erros = [];
  const falso = FALSOS[portal];
  const tem = TEM[portal];
  const { targetId } = (await send('Target.createTarget', { url: 'about:blank' })).result;
  const { sessionId } = (await send('Target.attachToTarget', { targetId, flatten: true })).result;
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: false }, sessionId);
  // O SDK falso sai pela mesma URL que o build pede.
  await send('Fetch.enable', { patterns: [{ urlPattern: falso.url }] }, sessionId);
  ouvintes.set('Fetch.requestPaused', (p) => {
    send('Fetch.fulfillRequest', {
      requestId: p.requestId, responseCode: 200,
      responseHeaders: [{ name: 'content-type', value: 'text/javascript' }],
      body: Buffer.from(falso.js).toString('base64'),
    }, sessionId);
  });
  await send('Page.navigate', { url: `http://127.0.0.1:${PORTA_HTTP}/index.html` }, sessionId);
  const js = async (/** @type {string} */ e) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId);
    return r.result?.result?.value;
  };
  let pronto = false;
  for (let i = 0; i < 60 && !pronto; i++) {
    await sleep(250);
    pronto = (await js('!!(window.__game && window.__plataforma && window.__plataforma.loadingFinished)')) === true;
  }
  confere('o jogo abre', pronto);
  if (!pronto) {
    if (erros.length) console.log('   erros:', erros.slice(0, 3).join(' | '));
    await send('Target.closeTarget', { targetId });
    continue;
  }
  const log = async () => /** @type {string[]} */ (await js('JSON.stringify(window.__log)').then((v) => JSON.parse(v || '[]')));
  const l0 = await log();
  confere('SDK pronto', (await js('window.__plataforma.ready')) === true);
  confere('fim do carregamento avisado ao portal', l0.includes(tem.sinal), l0.join(' '));
  if (tem.preroll) confere('pre-roll antes de o jogo abrir', l0.indexOf('midgame:preroll') >= 0, l0.join(' '));
  if (tem.idioma) confere('idioma do portal', (await js('document.documentElement.lang')) === 'tr', await js('document.documentElement.lang'));

  // Intervalo: com a carencia vencida. Na Y8 a passagem automatica nao pede.
  await js('window.__game.progress.data.unlocked = 30; true');
  await js('window.__log.length = 0; true');
  if (tem.soClique) {
    await js("window.__game.commercialBreak('troca')");
    confere('passagem automatica sem anuncio', !(await log()).some((x) => x.startsWith('midgame')), (await log()).join(' '));
    await js("window.__game.commercialBreak('proxima')");
  } else {
    await js("window.__game.commercialBreak('troca')");
  }
  const l1 = await log();
  confere('intervalo chega ao SDK', l1.some((x) => x.startsWith('midgame')), l1.join(' '));
  confere('som calado quando o video entra', l1.includes('abriu:true'), l1.join(' '));
  confere('som de volta depois', (await js('window.__audio.adMuted')) === false);

  // Video recompensado: paga so com o fim do video.
  await js('window.__log.length = 0; window.__sdkFalso.premio = true; true');
  const pago = await js('window.__plataforma.rewardedBreak()');
  if (tem.premio) {
    confere('video visto ate o fim paga', pago === true, (await log()).join(' '));
    await js('window.__sdkFalso.premio = false; true');
    confere('video pulado nao paga', (await js('window.__plataforma.rewardedBreak()')) === false);
  } else {
    confere('sem video recompensado no portal', pago === false && !(await log()).includes('rewarded'));
    const visiveis = await js("[...document.querySelectorAll('.btn.ad')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.id).join(',')");
    confere('botoes de video escondidos', visiveis === '', visiveis);
  }

  if (tem.pausa) {
    // numa fase: a tela de pausa do jogo, e a volta sozinha
    await js('window.__game.startLevel(5); new Promise((r) => setTimeout(() => r(true), 1500))');
    await js('window.__sdkFalso.pausar(); true');
    confere('pausa do portal cala o jogo', (await js('window.__audio.platformMuted')) === true);
    confere('pausa do portal abre a tela de pausa', (await js('window.__game.screen')) === 'pause', await js('window.__game.screen'));
    await js('window.__sdkFalso.retomar(); true');
    confere('volta do portal devolve o som', (await js('window.__audio.platformMuted')) === false);
    confere('volta do portal fecha a pausa e segue sozinha', (await js("window.__game.screen === 'game' && !window.__game.paused")) === true, await js('window.__game.screen'));
  }
  {
    // a aba escondida no meio da fase (o "Open Tab" da GamePix): a tela de pausa, que fica na volta
    await js('window.__game.startLevel(5); new Promise((r) => setTimeout(() => r(true), 1500))');
    await js('window.__game.scene.session.state = "playing"; true');
    await js(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (true ? 'hidden' : 'visible') }); document.dispatchEvent(new Event('visibilitychange')); true`);
    const naAba = await js('window.__game.screen');
    await js(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (false ? 'hidden' : 'visible') }); document.dispatchEvent(new Event('visibilitychange')); true`);
    const logoDepois = await js('window.__game.screen');
    await sleep(1300);
    confere('aba escondida abre a tela de pausa', naAba === 'pause' && logoDepois === 'pause', naAba);
    confere('volta da aba retoma sozinha', (await js("window.__game.screen === 'game' && !window.__game.paused")) === true, await js('window.__game.screen'));
  }
  if (tem.save) {
    await js("window.__log.length = 0; window.__game.progress.data.coins += 7; window.__game.progress.flush(); true");
    await sleep(1800);
    const store = await js('JSON.stringify(window.__sdkFalso.store)');
    confere('save no armazenamento do portal', (await log()).includes('gravou') && /hexadrop\.save|coins/.test(store || ''), (store || '').slice(0, 80));
  }
  confere('sem erro no console', erros.length === 0, erros.slice(0, 2).join(' | '));
  ouvintes.delete('Fetch.requestPaused');
  await send('Target.closeTarget', { targetId });
}

sock.close();
chrome.kill();
servidor.close();
console.log(`\n=== Resultado: ${falhas} falhas ===\n`);
process.exit(falhas ? 1 : 0);
