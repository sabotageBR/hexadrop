/**
 * Confere a ordem dos eventos do Poki SDK.
 *
 * Injeta um SDK falso que registra cada chamada, joga duas fases ate o fim e
 * verifica as regras que a revisao da Poki cobra: gameLoadingFinished uma unica
 * vez, gameplayStart so no primeiro toque, gameplayStop em toda interrupcao,
 * nenhum evento durante um intervalo e nenhum par repetido em sequencia.
 *
 * Duas fases porque o jogo tem dois desfechos: a fase 1 fecha em fluxo continuo
 * (a seguinte entra sozinha, sem clique) e a 10 fecha no cartao de fim de mundo.
 * O intervalo comercial acontece nos dois, e e onde a regra de ordem aperta.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 9888;
const BASE = process.env.SDK_URL || 'http://127.0.0.1:4173';
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-sandbox',
  '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => chrome.kill());
async function wsUrl() { for (let i = 0; i < 60; i++) { try { return (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(250); } } throw new Error('sem chrome'); }
const sock = new WebSocket(await wsUrl());
await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
let id = 0; const pending = new Map();
sock.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise((res) => { const mid = ++id; pending.set(mid, res); sock.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) })); });

const { targetId } = (await send('Target.createTarget', { url: 'about:blank' })).result;
const { sessionId } = (await send('Target.attachToTarget', { targetId, flatten: true })).result;
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Network.enable', {}, sessionId);
await send('Network.setBlockedURLs', { urls: ['*poki-sdk*'] }, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 880, deviceScaleFactor: 1, mobile: true }, sessionId);

// SDK falso, instalado antes de qualquer script da pagina.
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__sdkLog = [];
    const log = (name, extra) => window.__sdkLog.push({ name, extra: extra === undefined ? null : extra, t: Date.now() });
    window.PokiSDK = {
      init: () => { log('init'); return Promise.resolve(); },
      gameLoadingFinished: () => log('gameLoadingFinished'),
      gameplayStart: () => log('gameplayStart'),
      gameplayStop: () => log('gameplayStop'),
      commercialBreak: (cb) => { log('commercialBreak:begin'); if (cb) cb();
        return new Promise(r => setTimeout(() => { log('commercialBreak:end'); r(); }, 300)); },
      rewardedBreak: (arg) => { log('rewardedBreak:begin'); const cb = typeof arg === 'function' ? arg : (arg && arg.onStart);
        if (cb) cb(); return new Promise(r => setTimeout(() => { log('rewardedBreak:end'); r(true); }, 300)); },
      measure: (c, w, a) => log('measure', c + '/' + w + '/' + a),
      getDeviceInfo: () => Promise.resolve({ category: 'mobile' }),
      movePill: () => {},
      captureError: () => {},
      setDebug: () => {},
    };
  `,
}, sessionId);

await send('Page.navigate', { url: BASE + '/index.html' }, sessionId);
await sleep(3800);
const js = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId)).result?.result?.value;

/** Toca em pecas destrutiveis ate a fase acabar ou o orcamento esgotar. */
async function jogarFase(maxToques = 30) {
  for (let t = 0; t < maxToques; t++) {
    if ((await js('window.__game.screen')) !== 'game') break;
    const info = await js(`(() => { const g=window.__game.scene; if(!g.session||g.session.finished) return null;
      const w=g.session.world; const dest=w.alivePieces().filter(p=>p.body.isDynamic()&&p.material!=='obsidian');
      if(!dest.length) return null;
      const hex=w.hexTransform(); let best=null,bs=-Infinity;
      for(const p of dest){const b=w.pieceBox(p); if(b.top>hex.y+0.35) continue; const sc=b.top*10-Math.abs(b.cx-hex.x); if(sc>bs){bs=sc;best=p;}}
      if(!best) best=dest[0];
      const cell=best.cells[Math.floor(best.cells.length/2)];
      const lx=cell[0]+0.5-best.cw/2, ly=cell[1]+0.5-best.ch/2;
      const pos=best.body.getPosition(), a=best.body.getAngle();
      const wx=pos.x+lx*Math.cos(a)-ly*Math.sin(a), wy=pos.y+lx*Math.sin(a)+ly*Math.cos(a);
      const [sx,sy]=g.camera.toScreen(wx,wy); return {x:Math.round(sx), y:Math.round(sy)}; })()`);
    if (!info) break;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: info.x, y: info.y, button: 'left', clickCount: 1 }, sessionId);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: info.x, y: info.y, button: 'left', clickCount: 1 }, sessionId);
    await sleep(700);
  }
}

/** Espera o fim da fase: celebracao, selo e transicao levam alguns segundos. */
async function esperarDesfecho(deLevel) {
  for (let t = 0; t < 40; t++) {
    const st = await js('({screen: window.__game.screen, level: window.__game.level})');
    if (st && st.screen !== 'game') return st;
    if (st && st.level !== deLevel) return st;
    await sleep(250);
  }
  return await js('({screen: window.__game.screen, level: window.__game.level})');
}

await js('document.getElementById("btnPlay").click()');
await sleep(1500);
await jogarFase();
// Fluxo continuo: a fase 1 nao abre cartao nenhum. Ninguem clica em nada e a
// fase 2 entra sozinha - e e isso que os asserts la embaixo cobram.
const fluxo = await esperarDesfecho(1);
await sleep(600);

// Fim de mundo: ali o cartao volta, e com ele o intervalo do botao "Proxima".
await js('window.__game.startLevel(10)');
await sleep(1200);
await jogarFase();
const parada = await esperarDesfecho(10);
await sleep(400);
if (parada && parada.screen === 'win') await js('document.getElementById("winNext").click()');
else if (parada && parada.screen === 'lose') await js('document.getElementById("loseRetry").click()');
await sleep(1800);
await js('window.__game.pauseLevel()');
await sleep(400);
await js('document.getElementById("pauseResume").click()');
await sleep(1200);

const log = await js('JSON.stringify(window.__sdkLog)');
sock.close(); chrome.kill();

/** @type {{name:string, extra:string|null}[]} */
const events = JSON.parse(log || '[]');
const names = events.map((e) => e.name);
console.log('\nSequencia registrada:');
for (const e of events) console.log('  ' + e.name + (e.extra ? '  ' + e.extra : ''));

let failures = 0;
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, /** @type {string} */ detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FALHA'}  ${name}${detail ? '  -  ' + detail : ''}`);
  if (!ok) failures++;
};

check('init chamado uma vez', names.filter((n) => n === 'init').length === 1);
check('gameLoadingFinished chamado uma vez', names.filter((n) => n === 'gameLoadingFinished').length === 1);
check('gameLoadingFinished depois de init', names.indexOf('gameLoadingFinished') > names.indexOf('init'));
check('gameplayStart nao ocorre antes de gameLoadingFinished',
  names.indexOf('gameplayStart') === -1 || names.indexOf('gameplayStart') > names.indexOf('gameLoadingFinished'));

// nenhum start/stop repetido em sequencia
const pair = names.filter((n) => n === 'gameplayStart' || n === 'gameplayStop');
let dup = '';
for (let i = 1; i < pair.length; i++) if (pair[i] === pair[i - 1]) dup = pair[i] + ' repetido na posicao ' + i;
check('gameplayStart e gameplayStop sempre alternados', !dup, dup);

// nenhum evento entre o inicio e o fim de um intervalo
let inBreak = false;
let during = '';
for (const n of names) {
  if (n.endsWith(':begin')) { inBreak = true; continue; }
  if (n.endsWith(':end')) { inBreak = false; continue; }
  if (inBreak) during = n;
}
check('nenhum evento do SDK durante um intervalo', !during, during);

// gameplayStop antes de cada intervalo
let okBefore = true;
for (let i = 0; i < names.length; i++) {
  if (!names[i].endsWith(':begin')) continue;
  let j = i - 1;
  while (j >= 0 && names[j].startsWith('measure')) j--;
  if (names[j] !== 'gameplayStop') okBefore = false;
}
check('gameplayStop antes de cada intervalo', okBefore);

// Fluxo continuo: dentro de um mundo o jogo nao para, e no fim dele para.
check(
  'fase seguinte entra sozinha',
  !!fluxo && fluxo.screen === 'game' && fluxo.level === 2,
  fluxo ? `tela ${fluxo.screen}, fase ${fluxo.level}` : 'sem estado',
);
check(
  'fim de mundo para o jogador',
  !!parada && parada.screen !== 'game',
  parada ? `tela ${parada.screen}, fase ${parada.level}` : 'sem estado',
);

const measures = events.filter((e) => e.name === 'measure').map((e) => e.extra || '');
check('telemetria de fase registrada', measures.some((m) => m.startsWith('level/')), measures.slice(0, 3).join(' '));
const lvl = measures.filter((m) => m.startsWith('level/'));
const byLevel = new Map();
for (const m of lvl) {
  const [, n, action] = m.split('/');
  if (!byLevel.has(n)) byLevel.set(n, []);
  byLevel.get(n).push(action);
}
let bothEnds = '';
for (const [n, actions] of byLevel) {
  if (actions.includes('complete') && actions.includes('fail')) bothEnds = 'fase ' + n;
}
check('nunca complete e fail na mesma fase', !bothEnds, bothEnds);

console.log(`\n=== ${failures} falhas ===\n`);
process.exit(failures ? 1 : 0);
