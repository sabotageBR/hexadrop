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
 * E cobra o fluxo continuo, que e a outra metade do desenho: vencer nao abre
 * tela e a fase seguinte entra sozinha, inclusive na fronteira de mundo, onde o
 * premio de mundo entra no proprio selo. So a fase 100 abre o cartao de vitoria,
 * e dali "proxima" leva a 101, que tambem segue sem cartao.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { notaDaJogada } from '../src/game/content.js';

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

/**
 * A transicao de fim de fase vista por ultimo (main.js, `iniciaTransicao`):
 * tipo, grito e nivel da jogada. Guardada enquanto o teste espera o desfecho.
 * @type {Record<number, *>}
 */
const transVista = {};
const LER_TRANS = `(() => { const tr = window.__game.trans; return tr ? { tipo: tr.tipo, grito: tr.grito, nota: tr.nota, dobro: tr.dobro } : null; })()`;

/** Espera o desfecho: celebracao, selo e transicao levam alguns segundos. */
async function esperarDesfecho(deLevel) {
  for (let t = 0; t < 40; t++) {
    const tr = await js(LER_TRANS);
    if (tr && !transVista[deLevel]) transVista[deLevel] = tr;
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
 *
 * Com a derrota sem parada (main.js, `flowRetry`) as primeiras derrotas nem
 * saem da tela de jogo: a fase recomeca sozinha, no mesmo nivel. So a quinta
 * seguida abre o cartao.
 * @param {number} nivel
 */
async function vencer(nivel) {
  let st = null;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    await jogarFase();
    st = await esperarDesfecho(nivel);
    if (st && st.screen === 'game' && st.level === nivel) continue;
    if (!st || st.screen !== 'lose') return st;
    await sleep(700);
    await js('document.getElementById("loseRetry").click()');
    await sleep(1500);
  }
  return st;
}

/**
 * Derrota de verdade, sem depender de o jogador automatico perder: e o mesmo
 * veredito que `Session.step` da quando o hexagono cai.
 */
async function perder() {
  await js(`(() => { const s = window.__game.scene.session; s.state = 'lost'; s.endedAt = s.elapsed; s.onEnd('lost'); })()`);
}

/**
 * Vitoria forcada, sem depender do jogador automatico: o mesmo veredito que
 * `Session.step` da quando o hexagono pousa. Serve as fronteiras de mundo, em
 * que o que se confere e o que vem DEPOIS da vitoria - e a torre da 1.0.8
 * subiu, entao o jogador automatico ja nao vence a 20 e a 30 com folga.
 */
async function ganhar() {
  // As estrelas moram no mundo (`Session.stars` e so um getter): sem as tres
  // cruzadas, a vitoria forcada chegava ao save com zero estrelas.
  // E toda vitoria de verdade vem depois de um toque: sem o `onFirstTap` o
  // gameplayStart nunca saia, e a regra "gameplayStop antes de cada intervalo"
  // reprovava uma partida que nenhum jogador jogaria.
  await js(`(() => { const s = window.__game.scene.session; if (s.onFirstTap) s.onFirstTap();
    s.world.starsCrossed = 3; s.state = 'won'; s.endedAt = s.elapsed; s.onEnd('won'); })()`);
}

/**
 * Vence pela forca e espera o desfecho, guardando o selo do fluxo no meio do
 * caminho - e o unico momento em que da para ver se o premio de mundo entrou.
 * @param {number} nivel
 */
async function ganharEsperando(nivel, verChuva = false) {
  await ganhar();
  let selo = null;
  // Fim de mundo: a rajada da celebracao vira a chuva de moedas (main.js,
  // startCelebration), sozinha - as pecas estouram sem toque nenhum, debaixo
  // do grito da transicao de fim de mundo.
  /** @type {*} */
  let chuva = null;
  if (verChuva) {
    await sleep(500);
    chuva = await js(`(() => { const tr = window.__game.trans; return { tipo: tr && tr.tipo, dobro: !!(tr && tr.dobro),
      brilho: document.getElementById('s-game').classList.contains('chuva') }; })()`);
  }
  // A linha da melhoria embaixo do hexagono da barra (fim dos mundos pares 2 a 8).
  let extra = null;
  for (let t = 0; t < 110; t++) {
    const st = await js(`({screen: window.__game.screen, level: window.__game.level, advancing: window.__game.advancing,
      premio: !document.getElementById('prizeReveal').hidden, extra: !document.getElementById('revealExtra').hidden})`);
    if (st && st.premio) selo = true;
    if (st && st.premio && st.extra) extra = true;
    if (st && st.screen !== 'game') return { ...st, selo, chuva, extra };
    if (st && st.level !== nivel && !st.advancing) return { ...st, selo, chuva, extra };
    await sleep(250);
  }
  return { ...(await js('({screen: window.__game.screen, level: window.__game.level})')), selo, chuva, extra };
}

const estado = () => js('({screen: window.__game.screen, level: window.__game.level, variante: window.__game.variantIndex})');

// Perfil novo entra jogando: main.js manda `isNewcomer()` direto para a fase
// 1 e a home nem chega a aparecer. O clique em "jogar" so existe para o caso
// de a tela inicial estar no ar por qualquer outro motivo.
if ((await js('window.__game.screen')) !== 'game') {
  await js('document.getElementById("btnPlay").click()');
  await sleep(1500);
}
const entrouJogando = await js('window.__game.level');
// A barra de moedas so existe nos mundos pares 2 a 8: na fase 1 ela nao aparece.
const metaNaFase1 = await js(`!document.getElementById('gameMeta').hidden`);
// Fluxo continuo: a fase 1 nao abre cartao nenhum e a 2 entra sozinha, sem
// ninguem clicar em nada. Se alguma coisa parou o jogador, segue pelo cartao
// para o resto do roteiro continuar valendo.
const fluxo = await vencer(1);
await sleep(700);
if (fluxo && fluxo.screen === 'win') await js('document.getElementById("winNext").click()');
else if (fluxo && fluxo.screen === 'lose') await js('document.getElementById("loseRetry").click()');
await sleep(1200);
await js('window.__game.pauseLevel()');
await sleep(400);
await js('document.getElementById("pauseResume").click()');
await sleep(1200);

// Fases de ensino nao se perdem (main.js, VOLTAS_POR_FASE): o hexagono que
// cai de verdade volta uma jogada, sem `fail` e sem sair da fase. Aqui a queda
// e fisica - o hexagono jogado para fora da cena -, para passar pelo veredito
// de Session.step, que e onde a volta mora.
const faseDaVolta = await js('window.__game.level');
await tocar();
await sleep(1500);
await js(`(() => { const w = window.__game.scene.session.world; const h = w.hexTransform();
  w.hexBody.setTransform({ x: h.x + 40, y: -40 }, 0); w.hexBody.setAwake(true); })()`);
await sleep(1500);
const aposQueda = await js('({screen: window.__game.screen, level: window.__game.level, voltas: window.__game.scene.session.rewinds, estado: window.__game.scene.session.state})');

// Derrota sem parada: as quatro primeiras derrotas seguidas na mesma fase
// recomecam sozinhas, sem cartao - as duas primeiras no mesmo layout, a
// terceira e a quarta em outro -, e so a quinta abre o cartao de derrota
// (main.js, RETRIES_SEM_CARTAO e RETRIES_MESMO_LAYOUT). Na 1.0.3 o cartao era
// a unica parada em tela cheia do jogo, e cerca de 36% de quem perdia
// desistia ali; na 1.0.4, abrindo na terceira, mais da metade.
const faseDaDerrota = await js('window.__game.level');
const varianteInicial = await js('window.__game.variantIndex');
await perder();
await sleep(1800);
const aposDerrota1 = await estado();
await perder();
await sleep(1800);
const aposDerrota2 = await estado();
await perder();
await sleep(1800);
const aposDerrota3 = await estado();
await perder();
await sleep(1800);
const aposDerrota4 = await estado();
// Um toque antes da quinta: o cartao so oferece "voltar uma jogada" quando
// houve jogada para voltar.
await tocar();
await sleep(1200);
await perder();
await sleep(1500);
const aposDerrota5 = await estado();
const voltaNoCartao = await js('!document.getElementById("loseRevive").hidden && document.getElementById("loseRevive").classList.contains("ad")');
// O video de voltar uma jogada devolve a fase pronta para o toque seguinte, e
// abre uma tentativa nova: o `fail` da anterior ja saiu.
if (aposDerrota5 && aposDerrota5.screen === 'lose') await js('document.getElementById("loseRevive").click()');
await sleep(1000);
const aposVolta = await js('({screen: window.__game.screen, level: window.__game.level, estado: window.__game.scene.session.state})');
await sleep(400);

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

// O ensino sem derrota vai ate a fase 10, e dali a derrota chega em rampa
// (main.js, VOLTAS_POR_FASE): no mundo 3 as duas primeiras quedas de cada
// tentativa ainda voltam uma jogada, no mundo 4 a primeira, e do mundo 5 em
// diante toda queda perde. A mao que toca a peca so vai ate a 3 (FASES_COM_MAO).
// `Infinity` vira null no JSON, por isso o limite volta como texto.
/** @type {Record<number, {volta:boolean, limite:string, mao:boolean}>} */
const rampa = {};
for (const n of [10, 11, 15, 16, 20, 21]) {
  await js(`window.__game.startLevel(${n})`);
  await sleep(500);
  rampa[n] = await js(`(() => { const s = window.__game.scene.session;
    return { volta: s.rewindOnLoss, limite: String(s.rewindLimit), mao: window.__game.scene.tapHand }; })()`);
}

// A rampa na pratica: tres quedas de verdade numa tentativa da fase 11 dao duas
// voltas e uma derrota, nessa ordem. A queda e a mesma do teste de ensino -
// hexagono jogado para fora da cena -, depois de um toque, que e o que cria o
// ponto de volta.
await js('window.__game.startLevel(11)');
await sleep(1500);
const corteRampa = await js('window.__sdkLog.length');
await tocar();
await sleep(1500);
for (let q = 0; q < 3; q++) {
  await js(`(() => { const w = window.__game.scene.session.world; const h = w.hexTransform();
    w.hexBody.setTransform({ x: h.x + 40, y: -40 }, 0); w.hexBody.setAwake(true); })()`);
  await sleep(1500);
}
// A derrota recomeca a fase sozinha (flowRetry), passando pelo intervalo. Mudar
// de fase antes de o recomeco terminar poria um `start` dentro do intervalo.
for (let t = 0; t < 32; t++) {
  const st = await js(`({screen: window.__game.screen, level: window.__game.level, avancando: window.__game.advancing,
    timer: !!window.__game.flowTimer, estado: window.__game.scene.session && window.__game.scene.session.state})`);
  if (st && st.screen === 'game' && st.level === 11 && !st.avancando && !st.timer && st.estado === 'ready') break;
  await sleep(250);
}
const rampaSeq = await js(`window.__sdkLog.slice(${corteRampa})
  .filter((e) => e.name === 'measure' && String(e.extra).startsWith('level/11/'))
  .map((e) => e.extra.slice('level/11/'.length))`);

// Fronteira de mundo: a fase 20 fecha o mundo 4 e nao pode parar o jogador. O
// fluxo so para na ultima fase do jogo (main.js, `flowContinues`). E a regra
// que o funil da Poki comprou: medida, a unica parada do jogo com amostra
// custou 15% dos jogadores.
await js('window.__game.startLevel(20)');
await sleep(1200);
const pipsNoHud = await js('document.querySelectorAll("#gameWorldPips i").length');
const fronteiraCedo = await ganharEsperando(20, true);
const premio20 = await js('window.__game.progress.prizeClaimed(3)');
await sleep(700);
if (fronteiraCedo && fronteiraCedo.screen === 'win') await js('document.getElementById("winNext").click()');
else if (fronteiraCedo && fronteiraCedo.screen === 'lose') await js('document.getElementById("loseRetry").click()');
await sleep(1200);

// A fase 30 ja foi a primeira parada do jogo. Com mundos de cinco fases o
// cartao pararia o jogo a cada cinco, e a decisao foi nao parar nunca: ela
// tambem tem que seguir direto para a 31.
await js('window.__game.startLevel(30)');
await sleep(1200);
const parada = await ganharEsperando(30);
await sleep(500);
if (parada && parada.screen === 'win') await js('document.getElementById("winNext").click()');
else if (parada && parada.screen === 'lose') await js('document.getElementById("loseRetry").click()');
await sleep(1500);

// O primeiro premio de mundo: vencer a fase 5 entrega a skin do mundo 1, ja
// equipada, e a fase 6 entra com o hexagono novo (main.js, `showPrize`). As
// vitorias forcadas de antes (20, 30) ja entregaram os premios e podem ter
// comprado pela barra: zera os mundos 1, 2 e 4, as skins e o contador.
await js('window.__game.progress.data.prizes = (window.__game.progress.data.prizes || []).filter((w) => w !== 0 && w !== 1 && w !== 3)');
await js('window.__game.progress.data.skins = window.__game.progress.data.skins.filter((id) => id === "classic")');
await js('Object.assign(window.__game.progress.data, { barraDe: -1, barraMoedas: 0 })');
await js('window.__game.startLevel(5)');
await sleep(1200);
const fimDoMundo1 = await ganharEsperando(5);
const skinPremio = await js(`(() => { const g = window.__game; return { salva: g.progress.data.skin, cena: g.scene.skin && g.scene.skin.id }; })()`);
// A fase 6 entrou sozinha: a barra do mundo 2 aparece, e do zero, por mais
// que o mundo 1 tenha rendido.
const metaNaFase6 = await js(`(() => { const b = document.getElementById('gameMeta'); return { level: window.__game.level,
  visivel: !b.hidden, txt: document.getElementById('gameMetaTxt').textContent }; })()`);
await sleep(600);

// A barra compra so no fim dos mundos pares 2 a 8, junto da melhoria e na
// mesma revelacao (Progress.compraDaBarra): um hexagono a cada cinco fases.
// Com a bolsa cheia, vencer a 7 nao compra; a 10 compra o Descolado e entrega
// a melhoria; a 12 (mundo 3) nao compra; a 20 compra o seguinte.
await js('window.__game.progress.data.coins = 99999');
const skinAntesDaCompra = await js('window.__game.progress.data.skin');
await js('window.__game.startLevel(7)');
await sleep(1200);
await ganharEsperando(7);
const semCompraNa7 = await js('window.__game.progress.data.skin');
await js('window.__game.startLevel(10)');
await sleep(1200);
const fimDoMundo2 = await ganharEsperando(10);
const compraNo2 = await js(`(() => { const g = window.__game; return { skin: g.progress.data.skin, cena: g.scene.skin && g.scene.skin.id,
  melhoria: g.progress.prizeClaimed(1) }; })()`);
await js('window.__game.startLevel(12)');
await sleep(1200);
await ganharEsperando(12);
const semCompraNo3 = await js('window.__game.progress.data.skin');
await js('window.__game.startLevel(20)');
await sleep(1200);
const fimDoMundo4 = await ganharEsperando(20);
const compra = await js(`(() => { const g = window.__game; return { skin: g.progress.data.skin, cena: g.scene.skin && g.scene.skin.id }; })()`);

// So a fase 100 para o fluxo, e so por uma vez a cada vitoria: e o fim da
// campanha, com o cartao e o video de dobrar premio. Dali "proxima" leva a
// 101, que reusa uma fase validada da segunda metade (game/alem.js) e segue
// sem cartao.
const fimDoJogo = await js(
  '(() => { const g = window.__game; const antes = g.level; const r = [99, 100, 101].map((n) => { g.level = n; return g.flowContinues(); }); g.level = antes; return r.join("|"); })()',
);
await js('window.__game.startLevel(100)');
await sleep(1500);
const fim100 = await ganharEsperando(100);
await sleep(600);
const cartao100 = await js(`({ dobrar: !document.getElementById('winDouble').hidden, alem: window.__game.progress.data.alem,
  premio: !document.getElementById('winPrize').hidden })`);
if (fim100 && fim100.screen === 'win') await js('document.getElementById("winNext").click()');
let em101 = null;
for (let t = 0; t < 40; t++) {
  em101 = await js('({screen: window.__game.screen, level: window.__game.level, tema: window.__game.scene.theme.id, advancing: window.__game.advancing})');
  if (em101 && em101.level === 101 && !em101.advancing && em101.screen === 'game') break;
  await sleep(250);
}
await sleep(800);
const depois101 = await ganharEsperando(101);
await sleep(500);
await js('window.__game.quitLevel()');
await sleep(900);
const botaoHome = await js('document.getElementById("btnPlay").textContent');

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
  'primeira derrota recomeca a fase sozinha, no mesmo layout',
  !!aposDerrota1 && aposDerrota1.screen === 'game' && aposDerrota1.level === faseDaDerrota && aposDerrota1.variante === varianteInicial,
  aposDerrota1 ? `tela ${aposDerrota1.screen}, fase ${aposDerrota1.level}, variante ${varianteInicial} -> ${aposDerrota1.variante}` : 'sem estado',
);
check(
  'segunda derrota seguida recomeca a fase sozinha, no mesmo layout',
  !!aposDerrota2 && aposDerrota2.screen === 'game' && aposDerrota2.level === faseDaDerrota && aposDerrota2.variante === varianteInicial,
  aposDerrota2 ? `tela ${aposDerrota2.screen}, fase ${aposDerrota2.level}, variante ${aposDerrota2.variante}` : 'sem estado',
);
check(
  'terceira derrota seguida recomeca sozinha em outro layout',
  !!aposDerrota3 && aposDerrota3.screen === 'game' && aposDerrota3.level === faseDaDerrota && aposDerrota3.variante !== varianteInicial,
  aposDerrota3 ? `tela ${aposDerrota3.screen}, fase ${aposDerrota3.level}, variante ${varianteInicial} -> ${aposDerrota3.variante}` : 'sem estado',
);
check(
  'quarta derrota seguida ainda recomeca sozinha',
  !!aposDerrota4 && aposDerrota4.screen === 'game' && aposDerrota4.level === faseDaDerrota,
  aposDerrota4 ? `tela ${aposDerrota4.screen}, fase ${aposDerrota4.level}` : 'sem estado',
);
check(
  'fase de ensino volta uma jogada em vez de perder',
  !!aposQueda && aposQueda.screen === 'game' && aposQueda.level === faseDaVolta && aposQueda.voltas >= 1 && aposQueda.estado !== 'lost',
  aposQueda ? `tela ${aposQueda.screen}, fase ${aposQueda.level}, voltas ${aposQueda.voltas}, ${aposQueda.estado}` : 'sem estado',
);
{
  const alvo = `level/${faseDaVolta}/`;
  const seq = measures.filter((m) => m.startsWith(alvo)).map((m) => m.slice(alvo.length));
  const i = seq.indexOf('rewind');
  check('a volta da fase de ensino nao manda fail', i >= 0 && seq.slice(0, i).every((a) => a !== 'fail'), seq.slice(0, i + 1).join(' '));
}
{
  const r = rampa;
  const ok = (n, volta, limite) => !!r[n] && r[n].volta === volta && r[n].limite === limite;
  check(
    'rampa de derrota: 10 sem limite e sem a mao, 11 e 15 com duas voltas, 16 e 20 com uma, 21 sem volta',
    ok(10, true, 'Infinity') && r[10].mao === false && ok(11, true, '2') && ok(15, true, '2') &&
      ok(16, true, '1') && ok(20, true, '1') && !!r[21] && r[21].volta === false,
    JSON.stringify(r),
  );
}
{
  // Sem os `start` do recomeco: o que importa e a ordem entre volta e derrota.
  const seq = (rampaSeq || []).filter((a) => a !== 'start');
  check(
    'tres quedas na fase 11 dao volta, volta e derrota',
    seq.length >= 3 && seq[0] === 'rewind' && seq[1] === 'rewind' && seq[2] === 'fail',
    (rampaSeq || []).join(' '),
  );
}
check('cartao de derrota oferece voltar uma jogada, como video', voltaNoCartao === true, String(voltaNoCartao));
check(
  'voltar uma jogada devolve a fase pronta para o toque',
  !!aposVolta && aposVolta.screen === 'game' && aposVolta.estado === 'ready',
  aposVolta ? `tela ${aposVolta.screen}, fase ${aposVolta.level}, ${aposVolta.estado}` : 'sem estado',
);
check(
  'quinta derrota seguida abre o cartao',
  !!aposDerrota5 && aposDerrota5.screen === 'lose',
  aposDerrota5 ? `tela ${aposDerrota5.screen}, fase ${aposDerrota5.level}` : 'sem estado',
);
{
  // Cada recomeco e uma tentativa nova: `fail` e logo depois o `start` da
  // mesma fase, sem nada no meio.
  const alvo = `level/${faseDaDerrota}/`;
  const seq = measures.filter((m) => m.startsWith(alvo)).map((m) => m.slice(alvo.length));
  const recomecos = seq.filter((a, i) => a === 'fail' && seq[i + 1] === 'start').length;
  check('derrota sem parada manda fail e depois start da mesma fase', recomecos >= 4, seq.join(' '));
}
check(
  'so a fase 100 para o fluxo, e a 101 segue sem cartao',
  fimDoJogo === 'true|false|true',
  fimDoJogo,
);
check('o HUD mostra um pip por fase do mundo', pipsNoHud === 5, String(pipsNoHud));
check(
  'fim de mundo revela o premio, sem parar (fase 20)',
  premio20 === true && !!fronteiraCedo && fronteiraCedo.selo === true,
  JSON.stringify({ premio20, selo: fronteiraCedo && fronteiraCedo.selo }),
);
check(
  'premio do mundo 1 e um hexagono novo, equipado na fase 6',
  !!fimDoMundo1 && fimDoMundo1.level === 6 && fimDoMundo1.screen === 'game' && !!skinPremio && skinPremio.salva !== 'classic' && skinPremio.salva === skinPremio.cena,
  JSON.stringify({ fimDoMundo1, skinPremio }),
);
check(
  'premio de mundo medido (visible)',
  measures.some((m) => m === 'premio/mundo-1/visible') && measures.some((m) => m === 'premio/mundo-4/visible'),
  measures.filter((m) => m.startsWith('premio/')).join(' ') || 'nenhum',
);
check(
  'a fase 100 abre o cartao com o video de dobrar e o bau',
  !!fim100 && fim100.screen === 'win' && !!cartao100 && cartao100.dobrar === true && cartao100.premio === true && cartao100.alem === 101,
  JSON.stringify({ fim100, cartao100 }),
);
check(
  '"proxima" da 100 leva a 101, no tema do mundo 21',
  !!em101 && em101.screen === 'game' && em101.level === 101 && em101.tema === 'ice',
  JSON.stringify(em101),
);
check(
  'a 101 segue para a 102 sem cartao',
  !!depois101 && depois101.screen === 'game' && depois101.level === 102,
  JSON.stringify(depois101),
);
{
  // Marcos de tempo de sessao (main.js, MARCOS_MIN): o teste dura alguns
  // minutos de aba visivel, entao os primeiros saem sozinhos - cada um uma vez
  // so e na ordem.
  const marcos = measures.filter((m) => m.startsWith('tempo/')).map((m) => Number(m.split('/')[1].replace('min-', '')));
  const ordem = marcos.every((v, i) => i === 0 || v > marcos[i - 1]);
  check('marcos de tempo saem uma vez cada, na ordem, a partir de min-1', marcos[0] === 1 && ordem, marcos.join(' ') || 'nenhum');
}
check(
  'fim de mundo vira chuva de moedas sozinha, sem toque (fase 20)',
  !!fronteiraCedo && !!fronteiraCedo.chuva && fronteiraCedo.chuva.tipo === 'mundo' && fronteiraCedo.chuva.dobro === true &&
    fronteiraCedo.chuva.brilho === true && measures.includes('chuva/mundo-4/visible'),
  JSON.stringify(fronteiraCedo && fronteiraCedo.chuva),
);
{
  // A vitoria no jogo corrido e a transicao do stringcut, com um grito da
  // lista do nivel da jogada, na lingua do jogador - e nao o nome da chave.
  const tr = transVista[1];
  check(
    'vitoria abre a transicao do grito (fase 1)',
    !!tr && tr.tipo === 'fase' && ['boa', 'otima', 'perfeita'].includes(tr.nota) &&
      typeof tr.grito === 'string' && tr.grito.length > 0 && !tr.grito.startsWith('grito'),
    JSON.stringify(tr),
  );
  // O nivel da jogada (game/content.js): a meta e o par da variante.
  const nota = (/** @type {string} */ estado, /** @type {number} */ taps, /** @type {number} */ combo = 0) =>
    notaDaJogada({ estado, taps, par: 6, bestCombo: combo });
  const casos = [nota('won', 6), nota('won', 5), nota('won', 8), nota('won', 9), nota('won', 11, 4), nota('stuck', 6), nota('won', 3, 0)];
  check(
    'nivel da jogada pela meta: perfeita, otima e boa',
    casos.join(' ') === 'perfeita perfeita otima boa otima boa perfeita' &&
      notaDaJogada({ estado: 'won', taps: 4, par: 0, bestCombo: 0 }) === 'boa',
    casos.join(' '),
  );
}
check(
  'a barra some no mundo 1 e aparece do zero no 2 (fases 1 e 6)',
  metaNaFase1 === false && !!metaNaFase6 && metaNaFase6.level === 6 && metaNaFase6.visivel === true && String(metaNaFase6.txt).startsWith('0/'),
  JSON.stringify({ metaNaFase1, metaNaFase6 }),
);
check(
  'a barra compra so no fim do mundo par, com a melhoria na mesma revelacao (fases 7, 10, 12 e 20)',
  semCompraNa7 === skinAntesDaCompra &&
    !!compraNo2 && compraNo2.skin !== skinAntesDaCompra && compraNo2.skin === compraNo2.cena && compraNo2.melhoria === true &&
    !!fimDoMundo2 && fimDoMundo2.extra === true &&
    semCompraNo3 === compraNo2.skin &&
    !!compra && compra.skin !== compraNo2.skin && compra.skin === compra.cena && !!fimDoMundo4 && fimDoMundo4.extra === true &&
    measures.includes('premio/desbloqueio/visible') && measures.includes('premio/mundo-2/visible'),
  JSON.stringify({ skinAntesDaCompra, semCompraNa7, compraNo2, extra10: fimDoMundo2 && fimDoMundo2.extra, semCompraNo3, compra }),
);
check('a home oferece a fase depois da 101', typeof botaoHome === 'string' && botaoHome.includes('102'), String(botaoHome));
{
  const i100 = measures.indexOf('level/100/complete');
  const i101 = measures.indexOf('level/101/start');
  check('a 101 comeca depois de a 100 terminar', i100 >= 0 && i101 > i100, `${i100} ${i101}`);
}
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
