/** Confere que o audio sintetizado realmente produz som e responde ao mute. */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = 9777;
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-sandbox',
  '--disable-gpu', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => chrome.kill());
async function wsUrl() { for (let i = 0; i < 60; i++) { try { return (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(250); } } throw new Error('sem chrome'); }
const sock = new WebSocket(await wsUrl());
await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
let id = 0; const pending = new Map();
sock.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise((res) => { const mid = ++id; pending.set(mid, res); sock.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) })); });
const { targetId } = (await send('Target.createTarget', { url: 'about:blank' })).result;
const { sessionId } = (await send('Target.attachToTarget', { targetId, flatten: true })).result;
await send('Runtime.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
await send('Page.navigate', { url: (process.env.AUDIO_URL || 'http://127.0.0.1:4173') + '/index.html' }, sessionId);
await sleep(3500);
// O jogo expoe o motor de audio para este teste.
const js = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId)).result?.result?.value;

const probe = await js(`(async () => {
  const audio = window.__audio;
  audio.init(); audio.unlock();
  await new Promise(r => setTimeout(r, 400));
  const ctx = audio.ctx;
  if (!ctx) return JSON.stringify({erro: 'sem AudioContext'});
  // grava a saida do barramento de efeitos por 0,4 s
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  audio.sfxBus.connect(analyser);
  let peak = 0;
  const buf = new Float32Array(analyser.fftSize);
  audio.breakPiece('glass', 1);
  audio.click();
  const t0 = performance.now();
  while (performance.now() - t0 < 500) {
    analyser.getFloatTimeDomainData(buf);
    for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
    await new Promise(r => setTimeout(r, 20));
  }
  const before = peak;
  audio.muteForAd();
  await new Promise(r => setTimeout(r, 300));
  const estadoMudo = ctx.state;
  audio.unmuteAfterAd();
  await new Promise(r => setTimeout(r, 400));
  return JSON.stringify({
    estado: ctx.state, picoSfx: Number(before.toFixed(4)),
    estadoDuranteAnuncio: estadoMudo, ganhoMestre: audio.master.gain.value,
    sampleRate: ctx.sampleRate,
  });
})()`);
console.log('audio:', probe);
sock.close(); chrome.kill();
