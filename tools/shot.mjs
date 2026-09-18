/**
 * Captura telas das paginas do jogo com o Chrome em modo headless,
 * via protocolo DevTools. Sem dependencias externas.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = process.env.SHOT_DIR || '/tmp/shots';
mkdirSync(OUT, { recursive: true });

const PORT = 9222;
const chrome = spawn('google-chrome', [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--no-sandbox',
  '--disable-gpu',
  '--hide-scrollbars',
  '--disable-dev-shm-usage',
  '--force-device-scale-factor=2',
  'about:blank',
], { stdio: 'ignore' });

process.on('exit', () => chrome.kill());

async function ws() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      return j.webSocketDebuggerUrl;
    } catch { await sleep(250); }
  }
  throw new Error('Chrome nao respondeu');
}

const url = await ws();
const { WebSocket } = await import('node:worker_threads').then(() => globalThis);
const sock = new WebSocket(url);
await new Promise((res, rej) => { sock.onopen = res; sock.onerror = rej; });

let id = 0;
const pending = new Map();
const events = [];
sock.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else events.push(msg);
};
function send(method, params = {}, sessionId) {
  const mid = ++id;
  return new Promise((res) => {
    pending.set(mid, res);
    sock.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

const jobs = JSON.parse(process.argv[2] || '[]');
for (const job of jobs) {
  const { targetId } = (await send('Target.createTarget', { url: 'about:blank' })).result;
  const { sessionId } = (await send('Target.attachToTarget', { targetId, flatten: true })).result;
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', {
    width: job.w, height: job.h, deviceScaleFactor: 2, mobile: !!job.mobile,
  }, sessionId);
  await send('Page.navigate', { url: job.url }, sessionId);
  await sleep(job.wait || 2200);
  if (job.js) await send('Runtime.evaluate', { expression: job.js, awaitPromise: true }, sessionId);
  if (job.after) await sleep(job.after);
  const logs = await send('Runtime.evaluate', {
    expression: 'JSON.stringify(window.__errors || [])', returnByValue: true,
  }, sessionId);
  const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  if (shot.result?.data) {
    writeFileSync(`${OUT}/${job.name}.png`, Buffer.from(shot.result.data, 'base64'));
    console.log('ok', job.name, `${job.w}x${job.h}`, logs.result?.result?.value || '');
  } else {
    console.log('FALHA', job.name, JSON.stringify(shot).slice(0, 300));
  }
  await send('Target.closeTarget', { targetId });
}
sock.close();
chrome.kill();
