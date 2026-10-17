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
await sleep(400);

// Segunda sonda, SEM a flag de autoplay: o navegador de verdade. O primeiro
// clique com o mouse tem que destravar o audio no proprio mousedown (core/
// input.js) e sair com som - ate a 1.0.15 o clique e a quebra do primeiro toque
// do desktop saiam mudos, porque o destravamento esperava o pointerup.
const PORT2 = PORT + 1;
const chrome2 = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORT2}`, '--no-sandbox', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => chrome2.kill());
let ws2 = '';
for (let i = 0; i < 60 && !ws2; i++) {
  try { ws2 = (await (await fetch(`http://127.0.0.1:${PORT2}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(250); }
}
const sock2 = new WebSocket(ws2);
await new Promise((r, j) => { sock2.onopen = r; sock2.onerror = j; });
let id2 = 0; const pend2 = new Map();
sock2.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend2.has(m.id)) { pend2.get(m.id)(m); pend2.delete(m.id); } };
const send2 = (method, params = {}, sid) => new Promise((res) => { const mid = ++id2; pend2.set(mid, res); sock2.send(JSON.stringify({ id: mid, method, params, ...(sid ? { sessionId: sid } : {}) })); });
const t2 = (await send2('Target.createTarget', { url: 'about:blank' })).result.targetId;
const s2 = (await send2('Target.attachToTarget', { targetId: t2, flatten: true })).result.sessionId;
await send2('Runtime.enable', {}, s2);
await send2('Page.enable', {}, s2);
await send2('Emulation.setDeviceMetricsOverride', { width: 1031, height: 580, deviceScaleFactor: 1, mobile: false }, s2);
await send2('Page.navigate', { url: (process.env.AUDIO_URL || 'http://127.0.0.1:4173') + '/index.html' }, s2);
await sleep(3500);
const js2 = async (e) => (await send2('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, s2)).result?.result?.value;
// Escuta o barramento antes do clique, e so o mousedown: sem mouseup nenhum.
await js2(`(() => { window.__pico = 0; const a = window.__audio; a.init(); const an = a.ctx.createAnalyser(); an.fftSize = 2048;
  a.sfxBus.connect(an); const buf = new Float32Array(2048);
  const ler = () => { an.getFloatTimeDomainData(buf); for (let i = 0; i < buf.length; i++) window.__pico = Math.max(window.__pico, Math.abs(buf[i])); requestAnimationFrame(ler); };
  ler(); return a.ctx.state; })()`);
const antes = await js2('window.__audio.ctx.state');
// Mira a celula da peca mais perto do meio dela, e nao o centro do corpo: numa
// peca em L o centro cai no vazio e o clique nao acertava nada.
const alvo = await js2(`(() => { const g = window.__game.scene; const w = g.session.world;
  const naTela = (p) => { let m = [0, 0], d = Infinity;
    for (const [cx, cy] of p.cells) { const lx = cx + 0.5 - p.cw / 2, ly = cy + 0.5 - p.ch / 2; const k = lx * lx + ly * ly; if (k < d) { d = k; m = [lx, ly]; } }
    const pos = p.body.getPosition(), a = p.body.getAngle();
    const [x, y] = g.camera.toScreen(pos.x + m[0] * Math.cos(a) - m[1] * Math.sin(a), pos.y + m[0] * Math.sin(a) + m[1] * Math.cos(a));
    return x > 0 && y > 0 && x < innerWidth && y < innerHeight ? { x: Math.round(x), y: Math.round(y) } : null; };
  for (const p of w.alivePieces()) { if (!w.tocavel(p)) continue; const s = naTela(p); if (s) return s; }
  return null; })()`);
await send2('Input.dispatchMouseEvent', { type: 'mousePressed', x: alvo.x, y: alvo.y, button: 'left', clickCount: 1 }, s2);
await sleep(700);
const depois = await js2('({ estado: window.__audio.ctx.state, pico: Number(window.__pico.toFixed(4)), toques: window.__game.scene.session.taps })');
console.log('primeiro clique sem autoplay:', JSON.stringify({ antes, ...depois }));
const okClique = antes !== 'running' && depois.estado === 'running' && depois.pico > 0.001 && depois.toques === 1;
console.log(okClique ? '  ok    o mousedown destrava o audio e o primeiro clique sai com som' : ' FALHA  o primeiro clique ainda sai mudo');
sock2.close(); chrome2.kill();
process.exit(okClique ? 0 : 1);
