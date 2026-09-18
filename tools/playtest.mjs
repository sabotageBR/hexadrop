/** Joga uma fase no Chrome headless, tocando em pecas, e relata o resultado. */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = '/tmp/shots';
mkdirSync(OUT, { recursive: true });
const PORT = 9333;
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`,
  '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => chrome.kill());

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try { return (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; }
    catch { await sleep(250); }
  }
  throw new Error('sem chrome');
}
const sock = new WebSocket(await wsUrl());
await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
let id = 0; const pending = new Map();
sock.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise((res) => {
  const mid = ++id; pending.set(mid, res);
  sock.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const url = process.argv[2] || 'http://127.0.0.1:5173/prototypes/neon.html';
const { targetId } = (await send('Target.createTarget', { url: 'about:blank' })).result;
const { sessionId } = (await send('Target.attachToTarget', { targetId, flatten: true })).result;
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 880, deviceScaleFactor: 2, mobile: true }, sessionId);

// coleta erros de console
const errors = [];
sock.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
});
await send('Page.navigate', { url }, sessionId);
await sleep(3000);

const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId)).result?.result?.value;

// expoe a cena para o teste
await evalJs(`window.__probe = () => {
  const s = document.querySelector('canvas');
  return null;
};`);

for (let t = 0; t < 14; t++) {
  // acha o centro de uma peca viva na tela pelo estado interno exposto
  const info = await evalJs(`(() => {
    const g = window.__scene; if (!g || !g.session) return null;
    const w = g.session.world;
    const alive = w.alivePieces().filter(p => p.body.isDynamic());
    if (!alive.length) return {done:true, state:g.session.state};
    const hex = w.hexTransform();
    let best=null, bs=-Infinity;
    for (const p of alive) { const b=w.pieceBox(p); const sc=b.top*10-Math.abs(b.cx-hex.x); if(sc>bs){bs=sc;best=p;} }
    const c = best.body.getPosition();
    const [sx, sy] = g.camera.toScreen(c.x, c.y);
    return { x: Math.round(sx), y: Math.round(sy), state: g.session.state, taps: g.session.taps, stars: g.session.stars, alive: alive.length, material: best.material };
  })()`);
  if (!info) { console.log('cena nao exposta'); break; }
  if (info.done || info.state === 'won' || info.state === 'lost' || info.state === 'stuck') {
    console.log('fim:', info.state, JSON.stringify(info)); break;
  }
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: info.x, y: info.y, button: 'left', clickCount: 1, pointerType: 'mouse' }, sessionId);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: info.x, y: info.y, button: 'left', clickCount: 1, pointerType: 'mouse' }, sessionId);
  await sleep(1400);
  const after = await evalJs(`(() => { const g=window.__scene; return {state:g.session.state, taps:g.session.taps, stars:g.session.stars, alive:g.session.world.alivePieces().length}; })()`);
  console.log(`toque ${t + 1}: ${info.material} em (${info.x},${info.y}) -> estado=${after.state} toques=${after.taps} estrelas=${after.stars} vivas=${after.alive}`);
  if (after.state !== 'ready' && after.state !== 'playing') break;
}

const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
if (shot.result?.data) writeFileSync(`${OUT}/playtest.png`, Buffer.from(shot.result.data, 'base64'));
console.log('erros de console:', errors.length ? errors.slice(0, 5) : 'nenhum');
sock.close(); chrome.kill();
