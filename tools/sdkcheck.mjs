/**
 * Confere a ordem dos eventos do Poki SDK.
 *
 * Injeta um SDK falso que registra cada chamada, joga uma fase ate o fim e
 * verifica as regras que a revisao da Poki cobra: gameLoadingFinished uma unica
 * vez, gameplayStart so no primeiro toque, gameplayStop em toda interrupcao,
 * nenhum evento durante um intervalo e nenhum par repetido em sequencia. Cobra
 * tambem a carencia do comeco: nenhum intervalo antes de o jogador vencer as
 * primeiras fases, e o intervalo de volta depois delas.
 *
 * E cobra o fluxo continuo, que e a outra metade do desenho: dentro de um mundo
 * vencer nao abre tela e a fase seguinte entra sozinha; no fim do mundo o cartao
 * volta. Se um dos dois se inverter, o teste reprova.
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

/**
 * Toca na peca que a dica do jogo escolheria (o jogador competente do
 * solucionador), e na falta dela na mais alta logo abaixo do hexagono.
 *
 * Tocar so pela heuristica ja bastou quando a fase 20 perdoava metade das
 * partidas ao acaso. Com o comeco endurecido - torre de catorze linhas sobre
 * pedestal da largura dela - a heuristica perdia as fases de fronteira, e o
 * teste reprovava o fluxo por uma derrota que nao tem nada a ver com ele.
 *
 * So vale peca que esta NA TELA: a camera segue o hexagono, e numa torre de
 * quinze linhas a dica pode apontar uma peca la embaixo, fora do quadro - o
 * clique nao acertava nada e os toques acabavam com a fase parada.
 * @returns {Promise<boolean>}
 */
async function tocar() {
  const info = await js(`(() => { const g=window.__game.scene; if(!g.session||g.session.finished) return null;
    const w=g.session.world; const dest=w.alivePieces().filter(p=>p.body.isDynamic()&&p.material!=='obsidian');
    if(!dest.length) return null;
    const naTela=(p)=>{const cell=p.cells[Math.floor(p.cells.length/2)];
      const lx=cell[0]+0.5-p.cw/2, ly=cell[1]+0.5-p.ch/2;
      const pos=p.body.getPosition(), a=p.body.getAngle();
      const wx=pos.x+lx*Math.cos(a)-ly*Math.sin(a), wy=pos.y+lx*Math.sin(a)+ly*Math.cos(a);
      const [sx,sy]=g.camera.toScreen(wx,wy);
      return sx>=0&&sy>=0&&sx<innerWidth&&sy<innerHeight?{x:Math.round(sx), y:Math.round(sy)}:null;};
    let best=g.session.requestHint();
    if(best&&(!best.alive||!naTela(best))) best=null;
    const hex=w.hexTransform(); let bs=-Infinity;
    if(!best) for(const p of dest){if(!naTela(p)) continue; const b=w.pieceBox(p); if(b.top>hex.y+0.35) continue; const sc=b.top*10-Math.abs(b.cx-hex.x); if(sc>bs){bs=sc;best=p;}}
    if(!best) best=dest.find(naTela)||null;
    return best?naTela(best):null; })()`);
  if (!info) return false;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: info.x, y: info.y, button: 'left', clickCount: 1 }, sessionId);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: info.x, y: info.y, button: 'left', clickCount: 1 }, sessionId);
  return true;
}

/** Toca ate a fase acabar ou o orcamento de toques esgotar. */
async function jogarFase(maxToques = 45) {
  for (let t = 0; t < maxToques; t++) {
    if ((await js('window.__game.screen')) !== 'game') break;
    if (!(await tocar())) break;
    await sleep(700);
  }
}

/** Espera o desfecho: celebracao, selo e transicao levam alguns segundos. */
async function esperarDesfecho(deLevel) {
  for (let t = 0; t < 40; t++) {
    const st = await js('({screen: window.__game.screen, level: window.__game.level, advancing: window.__game.advancing})');
    if (st && st.screen !== 'game') return st;
    if (st && st.level !== deLevel && !st.advancing) return st;
    await sleep(250);
  }
  return await js('({screen: window.__game.screen, level: window.__game.level})');
}

/**
 * Joga a fase ate vencer, com ate tres tentativas. O que os testes de
 * fronteira conferem e para onde o jogo vai DEPOIS da vitoria; uma derrota do
 * jogador automatico nao diz nada sobre isso.
 * @param {number} nivel
 */
async function vencer(nivel) {
  let st = null;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    await jogarFase();
    st = await esperarDesfecho(nivel);
    if (!st || st.screen !== 'lose') return st;
    await sleep(700);
    await js('document.getElementById("loseRetry").click()');
    await sleep(1500);
  }
  return st;
}

// Perfil novo entra jogando: main.js manda `isNewcomer()` direto para a fase
// 1 e a home nem chega a aparecer. O clique em "jogar" so existe para o caso
// de a tela inicial estar no ar por qualquer outro motivo.
if ((await js('window.__game.screen')) !== 'game') {
  await js('document.getElementById("btnPlay").click()');
  await sleep(1500);
}
const entrouJogando = await js('window.__game.level');
await jogarFase();
// Fluxo continuo: a fase 1 nao abre cartao nenhum e a 2 entra sozinha, sem
// ninguem clicar em nada. Se alguma coisa parou o jogador, segue pelo cartao
// para o resto do roteiro continuar valendo.
const fluxo = await esperarDesfecho(1);
await sleep(700);
if (fluxo && fluxo.screen === 'win') await js('document.getElementById("winNext").click()');
else if (fluxo && fluxo.screen === 'lose') await js('document.getElementById("loseRetry").click()');
await sleep(1200);
await js('window.__game.pauseLevel()');
await sleep(400);
await js('document.getElementById("pauseResume").click()');
await sleep(1200);

// Ate aqui o perfil e novo e tudo cai na carencia do comeco (main.js,
// FASES_SEM_INTERVALO): nenhum intervalo pode ter acontecido. Dali em diante o
// mesmo jogador passa a ter fases vencidas de sobra, e pausar no meio de uma
// jogada tem que levar ao intervalo - senao este teste nunca mais veria um e
// as regras de ordem abaixo passariam sem conferir nada.
const corte = await js('window.__sdkLog.length');
await js('window.__game.progress.data.unlocked = window.__game.progress.data.unlocked + 999');
await tocar();
await sleep(900);
await js('window.__game.pauseLevel()');
await sleep(400);
await js('document.getElementById("pauseResume").click()');
await sleep(1200);

// Fronteira de mundo: a fase 20 fecha o mundo 4 e nao pode parar o jogador. O
// fluxo so para na ultima fase do jogo (main.js, `flowContinues`). E a regra
// que o funil da Poki comprou: medida, a unica parada do jogo com amostra
// custou 15% dos jogadores.
await js('window.__game.startLevel(20)');
await sleep(1200);
const fronteiraCedo = await vencer(20);
await sleep(700);
if (fronteiraCedo && fronteiraCedo.screen === 'win') await js('document.getElementById("winNext").click()');
else if (fronteiraCedo && fronteiraCedo.screen === 'lose') await js('document.getElementById("loseRetry").click()');
await sleep(1200);

// A fase 30 ja foi a primeira parada do jogo. Com mundos de cinco fases o
// cartao pararia o jogo a cada cinco, e a decisao foi nao parar nunca: ela
// tambem tem que seguir direto para a 31.
await js('window.__game.startLevel(30)');
await sleep(1200);
const parada = await vencer(30);
await sleep(500);
if (parada && parada.screen === 'win') await js('document.getElementById("winNext").click()');
else if (parada && parada.screen === 'lose') await js('document.getElementById("loseRetry").click()');
await sleep(1500);

// So a ultima fase do jogo para o fluxo: e ali que o cartao de vitoria volta,
// e com ele o video de dobrar premio. Conferido pela regra, sem jogar a fase
// 100 - uma torre de dezoito linhas nao cabe no orcamento deste teste.
const fimDoJogo = await js(
  '(() => { const g = window.__game; const antes = g.level; g.level = 99; const a = g.flowContinues(); g.level = 100; const b = g.flowContinues(); g.level = antes; return a + "|" + b; })()',
);

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

check('nenhum intervalo na carencia do comeco',
  !names.slice(0, corte).includes('commercialBreak:begin'));
check('intervalo volta depois da carencia',
  names.slice(corte).includes('commercialBreak:begin'));

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

const measures = events.filter((e) => e.name === 'measure').map((e) => e.extra || '');
// Fluxo continuo: dentro de um mundo o jogo nao para, e no fim dele para.
check(
  'fase seguinte entra sozinha',
  !!fluxo && fluxo.screen === 'game' && fluxo.level === 2,
  fluxo ? `tela ${fluxo.screen}, fase ${fluxo.level}` : 'sem estado',
);
check(
  'perfil novo entra jogando, sem passar pela home',
  entrouJogando === 1,
  `fase ${entrouJogando}`,
);
check(
  'fronteira de mundo nao para o jogador (fase 20)',
  !!fronteiraCedo && fronteiraCedo.screen === 'game' && fronteiraCedo.level === 21,
  fronteiraCedo ? `tela ${fronteiraCedo.screen}, fase ${fronteiraCedo.level}` : 'sem estado',
);
check(
  'fronteira de mundo nao para o jogador (fase 30)',
  !!parada && parada.screen === 'game' && parada.level === 31,
  parada ? `tela ${parada.screen}, fase ${parada.level}` : 'sem estado',
);
check(
  'so a ultima fase do jogo para o fluxo',
  fimDoJogo === 'true|false',
  fimDoJogo,
);
// Interaction events: ate a versao 1.0.1 a aba da Poki estava vazia, e toda
// pergunta sobre POR QUE o jogador saiu era palpite.
const botoes = measures.filter((m) => m.startsWith('botao/'));
check(
  'interaction events registrados',
  botoes.some((m) => m.endsWith('/visible')) && botoes.some((m) => m.endsWith('/interact')),
  botoes.slice(0, 4).join(' ') || 'nenhum',
);
check('telemetria de fase registrada', measures.some((m) => m.startsWith('level/')), measures.slice(0, 3).join(' '));
// Por TENTATIVA, que e o que a Poki cobra: cada `start` abre uma. Agrupar pela
// sessao inteira reprovaria o jogador que perde e depois vence a mesma fase -
// e o teste agora repete a fase de fronteira ate vencer.
const lvl = measures.filter((m) => m.startsWith('level/'));
/** @type {Map<string, string[]>} */
const tentativa = new Map();
let bothEnds = '';
for (const m of lvl) {
  const [, n, action] = m.split('/');
  if (action === 'start' || !tentativa.has(n)) tentativa.set(n, []);
  const atual = /** @type {string[]} */ (tentativa.get(n));
  atual.push(action);
  if (atual.includes('complete') && atual.includes('fail')) bothEnds = 'fase ' + n;
}
check('nunca complete e fail na mesma fase', !bothEnds, bothEnds);

console.log(`\n=== ${failures} falhas ===\n`);
process.exit(failures ? 1 : 0);
