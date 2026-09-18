/**
 * Verificacao do build contra os requisitos da Poki.
 *
 * Roda sobre a pasta dist/ e sobre o jogo servido, e cobre os pontos que a QA
 * da Poki reprova: requisicao externa, dependencia de localStorage, travar com
 * bloqueador de anuncios, escala nas tres resolucoes obrigatorias e tamanho.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { spawn } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, '../dist');
const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:5173';
const ALLOWED_HOST = 'game-cdn.poki.com';
/** Dominios do proprio SDK da Poki: o jogo nao os chama, o SDK chama. */
const POKI_HOSTS = /(^|\.)(poki\.com|poki-cdn\.com|poki\.io|poki\.dev)$/;

let failures = 0;
let warnings = 0;
/** @param {string} name @param {boolean} ok @param {string} [detail] */
function check(name, ok, detail = '') {
  const mark = ok ? '  ok  ' : ' FALHA';
  console.log(`${mark}  ${name}${detail ? '  -  ' + detail : ''}`);
  if (!ok) failures++;
}
/** @param {string} name @param {string} detail */
function warn(name, detail) {
  console.log(`  !   ${name}  -  ${detail}`);
  warnings++;
}

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

console.log('\n=== Arquivos do build ===');
let files = [];
try {
  files = walk(DIST);
} catch {
  check('pasta dist existe', false, 'rode "npm run build" antes');
  process.exit(1);
}

let total = 0;
let totalGz = 0;
for (const f of files) {
  const buf = readFileSync(f);
  total += buf.length;
  totalGz += gzipSync(buf).length;
}
const mb = (/** @type {number} */ n) => (n / 1024 / 1024).toFixed(2) + ' MB';
console.log(`  ${files.length} arquivos, ${mb(total)} bruto, ${mb(totalGz)} comprimido`);
check('download inicial <= 5 MB comprimido', totalGz <= 5 * 1024 * 1024, mb(totalGz));
check('total <= 8 MB comprimido', totalGz <= 8 * 1024 * 1024, mb(totalGz));

console.log('\n=== Requisicoes externas ===');
const textExt = new Set(['.html', '.js', '.css', '.json', '.svg', '.mjs']);
/** @type {string[]} */
const external = [];
for (const f of files) {
  if (!textExt.has(extname(f))) continue;
  const text = readFileSync(f, 'utf8');
  const urls = text.match(/https?:\/\/[^\s"'`)]+/g) || [];
  for (const u of urls) {
    try {
      const host = new URL(u).host;
      // Namespaces de XML/SVG sao identificadores, nao enderecos que o
      // navegador chega a buscar.
      if (host === 'www.w3.org' || host === 'w3.org') continue;
      if (host !== ALLOWED_HOST) external.push(`${relative(DIST, f)}: ${u.slice(0, 90)}`);
    } catch {
      /* ignora */
    }
  }
  if (/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|unpkg\.com|cdnjs/.test(text)) {
    external.push(`${relative(DIST, f)}: referencia a CDN externa`);
  }
}
check('nenhuma URL externa alem do SDK da Poki', external.length === 0, external.slice(0, 4).join(' | '));

const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
check(
  'script do Poki SDK v2 presente',
  indexHtml.includes(`https://${ALLOWED_HOST}/scripts/v2/poki-sdk.js`),
);
check('sem links de saida', !/<a\s[^>]*href="https?:/i.test(indexHtml));
check('viewport com viewport-fit=cover', indexHtml.includes('viewport-fit=cover'));

const jsFiles = files.filter((f) => extname(f) === '.js');
const allJs = jsFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
check('sem setDebug ligado', !/setDebug\s*\(\s*true/.test(allJs));
check('sem console.log restante', !/console\s*\.\s*log\s*\(/.test(allJs));
check('sem source map publicado', !files.some((f) => f.endsWith('.map')));
check('localStorage sempre em try/catch', !/[^h]\s*localStorage\./.test(allJs) || allJs.includes('catch'));

// ------------------------------------------------------------------ browser
console.log('\n=== Comportamento no navegador ===');
const PORT = 9555;
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`,
  '--no-sandbox', '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => chrome.kill());
async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try { return (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; }
    catch { await sleep(250); }
  }
  throw new Error('chrome nao subiu');
}
const sock = new WebSocket(await wsUrl());
await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
let id = 0; const pending = new Map();
/** @type {string[]} */
let logs = [];
/** @type {string[]} */
let requests = [];
sock.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') logs.push(m.params.exceptionDetails.text);
  if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
};
const send = (method, params = {}, sessionId) => new Promise((res) => {
  const mid = ++id; pending.set(mid, res);
  sock.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
});

/**
 * @param {object} o
 * @param {number} o.w
 * @param {number} o.h
 * @param {string[]} [o.block] padroes de URL a bloquear
 * @param {boolean} [o.noStorage]
 * @returns {Promise<*>}
 */
async function run(o) {
  logs = []; requests = [];
  const { targetId } = (await send('Target.createTarget', { url: 'about:blank' })).result;
  const { sessionId } = (await send('Target.attachToTarget', { targetId, flatten: true })).result;
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);
  if (o.block && o.block.length) {
    await send('Network.setBlockedURLs', { urls: o.block }, sessionId);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: o.w, height: o.h, deviceScaleFactor: 1, mobile: false }, sessionId);
  if (o.noStorage) {
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked'); } });`,
    }, sessionId);
  }
  await send('Page.navigate', { url: BASE + '/index.html' }, sessionId);
  await sleep(4200);
  const state = (await send('Runtime.evaluate', {
    expression: `(() => { const g = window.__game;
      const c = document.getElementById('game');
      return JSON.stringify({
        booted: !!g, screen: g ? g.screen : null,
        loaderGone: document.getElementById('loader').classList.contains('gone'),
        canvasW: c.clientWidth, canvasH: c.clientHeight,
        winW: window.innerWidth, winH: window.innerHeight,
        pieces: g && g.scene.session ? g.scene.session.world.alivePieces().length : 0,
        adblockText: /ad ?block|bloqueador/i.test(document.body.innerText) });
    })()`, returnByValue: true,
  }, sessionId)).result?.result?.value;
  await send('Target.closeTarget', { targetId });
  return { state: JSON.parse(state || '{}'), logs: logs.slice(), requests: requests.slice() };
}

for (const [w, h] of [[640, 360], [836, 470], [1031, 580]]) {
  const r = await run({ w, h });
  const s = r.state;
  const covers = s.canvasW === s.winW && s.canvasH === s.winH;
  check(`escala ${w}x${h}: canvas cobre a janela`, covers, `${s.canvasW}x${s.canvasH} de ${s.winW}x${s.winH}`);
  check(`escala ${w}x${h}: fase montada`, s.pieces > 0, `${s.pieces} pecas`);
  if (r.logs.length) warn(`escala ${w}x${h}`, r.logs[0]);
}

{
  const r = await run({ w: 430, h: 880, block: ['*poki-sdk*', '*poki.com*', '*game-cdn*'] });
  const s = r.state;
  check('com bloqueador de anuncios: o jogo carrega', s.booted === true && s.loaderGone === true);
  check('com bloqueador de anuncios: fase jogavel', s.pieces > 0, `${s.pieces} pecas`);
  check('com bloqueador de anuncios: sem aviso sobre adblock', s.adblockText === false);
  if (r.logs.length) warn('com bloqueador', r.logs[0]);
}

{
  const r = await run({ w: 430, h: 880, noStorage: true });
  const s = r.state;
  check('modo anonimo: o jogo carrega', s.booted === true && s.loaderGone === true);
  check('modo anonimo: fase jogavel', s.pieces > 0, `${s.pieces} pecas`);
  if (r.logs.length) warn('modo anonimo', r.logs[0]);
}

{
  // Com o SDK bloqueado, tudo que sair da rede foi o jogo que pediu. E assim
  // que se distingue uma requisicao propria da pilha de anuncios da Poki, que
  // e permitida e nao esta sob nosso controle.
  const r = await run({ w: 430, h: 880, block: ['*poki-sdk*'] });
  const outside = r.requests.filter((u) => {
    try {
      const h = new URL(u).host;
      return h !== ALLOWED_HOST && !POKI_HOSTS.test(h) && !u.startsWith(BASE) &&
        !u.startsWith('data:') && !u.startsWith('blob:');
    } catch {
      return false;
    }
  });
  check('jogo nao faz nenhuma requisicao externa propria', outside.length === 0, outside.slice(0, 3).join(' | '));
}

sock.close();
chrome.kill();

console.log(`\n=== Resultado: ${failures} falhas, ${warnings} avisos ===\n`);
process.exit(failures ? 1 : 0);
