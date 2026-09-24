/**
 * Varre varias fases no navegador real, jogando cada uma automaticamente.
 * Serve para pegar o que a simulacao headless em Node nao pega: erros de
 * renderizacao, cache de sprites, som, e a integracao das telas.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 9666;
const BASE = process.env.SWEEP_URL || 'http://127.0.0.1:4173';
const LEVELS = (process.env.SWEEP_LEVELS || '1,4,7,10,14,22,27,33,41,50,60,70,80,90,100').split(',').map(Number);

const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-sandbox',
  '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => chrome.kill());
async function wsUrl() { for (let i = 0; i < 60; i++) { try { return (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(250); } } throw new Error('sem chrome'); }
const sock = new WebSocket(await wsUrl());
await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
let id = 0; const pending = new Map(); let errors = [];
sock.onmessage = (e) => { const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(String(m.params.exceptionDetails.text).slice(0, 160)); };
const send = (method, params = {}, sessionId) => new Promise((res) => { const mid = ++id; pending.set(mid, res); sock.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) })); });

const { targetId } = (await send('Target.createTarget', { url: 'about:blank' })).result;
const { sessionId } = (await send('Target.attachToTarget', { targetId, flatten: true })).result;
await send('Page.enable', {}, sessionId); await send('Runtime.enable', {}, sessionId);
await send('Network.setBlockedURLs', { urls: ['*poki-sdk*'] }, sessionId);
await send('Network.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 880, deviceScaleFactor: 1, mobile: true }, sessionId);
await send('Page.navigate', { url: BASE + '/index.html' }, sessionId);
await sleep(4000);
const js = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId)).result?.result?.value;

// libera todas as fases para o teste
await js('window.__game.progress.data.unlocked = 999; window.__game.progress.flush();');
// Desliga o fluxo continuo: com o cartao de fim de fase de volta, a tela para
// de 'game' para 'win'/'lose' e o sweep mede uma fase por vez, em vez de
// correr atras do avanco automatico e ler a sessao da fase seguinte.
await js('window.__game.flowLevels = false;');

let wins = 0, losses = 0;
const rows = [];
for (const level of LEVELS) {
  errors = [];
  await js(`window.__game.lossStreak = 0; window.__game.startLevel(${level});`);
  await sleep(600);
  let taps = 0;
  let fps = [];
  for (let t = 0; t < 40; t++) {
    const screen = await js('window.__game.screen');
    if (screen !== 'game') break;
    const info = await js(`(() => { const g=window.__game.scene; if(!g.session||g.session.finished) return null;
      const w=g.session.world; const alive=w.alivePieces().filter(p=>p.body.isDynamic() && !p.body.isStatic?false:p.body.isDynamic());
      const dest = alive.filter(p => p.material !== 'obsidian');
      if(!dest.length) return null;
      // So peca NA TELA: a camera segue o hexagono, e numa torre de dezoito
      // linhas a primeira peca da lista fica fora do quadro - o clique nao
      // acertava nada e a fase chegava aos quarenta toques ainda em jogo.
      const naTela=(p)=>{const cell=p.cells[Math.floor(p.cells.length/2)];
        const lx=cell[0]+0.5-p.cw/2, ly=cell[1]+0.5-p.ch/2;
        const pos=p.body.getPosition(), a=p.body.getAngle();
        const wx=pos.x+lx*Math.cos(a)-ly*Math.sin(a), wy=pos.y+lx*Math.sin(a)+ly*Math.cos(a);
        const [sx,sy]=g.camera.toScreen(wx,wy);
        return sx>=0&&sy>=0&&sx<innerWidth&&sy<innerHeight?{x:Math.round(sx), y:Math.round(sy)}:null;};
      const hex=w.hexTransform(); let best=null,bs=-Infinity;
      for(const p of dest){if(!naTela(p)) continue; const b=w.pieceBox(p); if(b.top>hex.y+0.35) continue; const sc=b.top*10-Math.abs(b.cx-hex.x); if(sc>bs){bs=sc;best=p;}}
      if(!best) best=dest.find(naTela)||null;
      if(!best) return null;
      return {...naTela(best), fps:Math.round(g.loop.fps)}; })()`);
    if (!info) break;
    fps.push(info.fps);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: info.x, y: info.y, button: 'left', clickCount: 1 }, sessionId);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: info.x, y: info.y, button: 'left', clickCount: 1 }, sessionId);
    taps++;
    await sleep(650);
  }
  await sleep(900);
  // A celebracao de fim de fase segura o cartao por alguns segundos: ler o
  // resultado antes dela terminar fazia toda vitoria com muitas pecas sobrando
  // ser anotada como "ainda jogando".
  for (let i = 0; i < 24; i++) {
    const tela = await js('window.__game.screen');
    if (tela !== 'game') break;
    await sleep(300);
  }
  // Nas fases sem derrota (main.js, FASES_SEM_DERROTA) a queda volta uma
  // jogada e a fase segue: sem esta contagem, vencer ali depois de tres voltas
  // pareceria vencer de primeira.
  const res = await js('({screen: window.__game.screen, state: window.__game.scene.session ? window.__game.scene.session.state : "?", stars: window.__game.scene.session ? window.__game.scene.session.stars : 0, voltas: window.__game.scene.session ? window.__game.scene.session.rewinds : 0})');
  const avgFps = fps.length ? Math.round(fps.reduce((a, b) => a + b, 0) / fps.length) : 0;
  if (res.screen === 'win') wins++; else if (res.screen === 'lose') losses++;
  rows.push(`fase ${String(level).padStart(3)}  ${res.screen.padEnd(5)}  estado=${String(res.state).padEnd(7)} estrelas=${res.stars} toques=${String(taps).padStart(2)} voltas=${res.voltas} fps~${avgFps}${errors.length ? '  ERRO: ' + errors[0] : ''}`);
  console.log(rows[rows.length - 1]);
  // volta ao menu para a proxima
  await js('window.__game.showAmbient(); window.__game.show("home");');
  await sleep(400);
}
console.log(`\nvitorias ${wins}, derrotas ${losses}, fases ${LEVELS.length}`);
sock.close(); chrome.kill();
