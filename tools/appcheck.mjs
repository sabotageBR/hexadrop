/**
 * Confere a politica do app (Android/iOS) sem aparelho.
 *
 * Serve o build `app` no navegador (npm run preview:app, porta 4175). Fora do
 * aparelho src/app/nativo.js usa o backend simulado (src/app/simulado.js), que
 * tem o mesmo formato do backend dos plugins e registra cada chamada em
 * `window.__nativoLog`. O que se confere e tudo o que e decisao nossa, e nao da
 * AdMob, do Firebase ou da loja:
 *
 * - a ordem splash -> consentimento -> SDK -> carga;
 * - o intersticial: carencia de fases, intervalo minimo, nunca ao retomar,
 *   nunca com o app escondido nem logo depois da volta, nunca com a compra;
 * - o vigia que solta o jogo quando o fechar do anuncio se perde;
 * - o video recompensado: paga so com o premio, inclusive atrasado; o veu
 *   segura a tela e o prazo devolve "sem video";
 * - a compra que tira os anuncios;
 * - o voltar do Android e o segundo plano em cada tela;
 * - o safe-area entrando na camera;
 * - os nomes de evento dentro das regras do Firebase;
 * - a regra de qual save vale entre o localStorage e a copia (src/app/save.js).
 *
 * Chrome na porta de depuracao 9999: rode uma ferramenta de tools/ por vez.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 9999;
const BASE = process.env.APP_URL || 'http://127.0.0.1:4175';

let falhas = 0;
/** @param {string} nome @param {boolean} ok @param {string} [detalhe] */
function check(nome, ok, detalhe = '') {
  console.log(`${ok ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? '  -  ' + detalhe : ''}`);
  if (!ok) falhas++;
}

// ------------------------------------------------- regra do save, em Node
console.log('\n=== Save: copia no Preferences ===');
{
  // save.js importa os plugins, que esperam um navegador; a regra em si e pura.
  /** @type {*} */ (globalThis).window = globalThis.window || { location: { hostname: 'x' }, setTimeout, clearTimeout };
  const { oQueVolta } = await import('../src/app/save.js');
  const sv = (/** @type {number} */ rev) => JSON.stringify({ v: 3, rev, coins: rev });
  const P = 'hexadrop.';
  let r = oQueVolta({}, { [P + 'save']: sv(5), [P + 'lang']: '"pt"' });
  check('localStorage limpo: tudo volta da copia', r[P + 'save'] === sv(5) && r[P + 'lang'] === '"pt"');
  r = oQueVolta({ [P + 'save']: sv(9) }, { [P + 'save']: sv(5) });
  check('save local mais novo vence a copia', !(P + 'save' in r));
  r = oQueVolta({ [P + 'save']: sv(4) }, { [P + 'save']: sv(7) });
  check('copia mais nova (localStorage gravado com atraso) volta', r[P + 'save'] === sv(7));
  r = oQueVolta({ [P + 'lang']: '"en"' }, { [P + 'lang']: '"pt"' });
  check('fora do save, o local vence', !(P + 'lang' in r));
}

// ----------------------------------------------------------------- chrome
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-sandbox',
  '--disable-gpu', '--hide-scrollbars', '--lang=en-US', 'about:blank'], { stdio: 'ignore' });
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
const erros = [];
sock.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || 'erro');
};
const send = (method, params = {}, sessionId) => new Promise((res) => {
  const mid = ++id; pending.set(mid, res);
  sock.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const { targetId } = (await send('Target.createTarget', { url: 'about:blank' })).result;
const { sessionId } = (await send('Target.attachToTarget', { targetId, flatten: true })).result;
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'all' });
await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 880, deviceScaleFactor: 1, mobile: true }, sessionId);
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.__nativoSimulado = { atrasoFecharMs: 120 };`,
}, sessionId);
await send('Page.navigate', { url: BASE + '/index.html' }, sessionId);

/** @param {string} e */
const js = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId)).result?.result?.value;

for (let t = 0; t < 60; t++) {
  if (await js('!!(window.__game && window.__game.screen && window.__nativoLog)')) break;
  await sleep(250);
}
await sleep(1500);

const log = () => js('window.__nativoLog.map(e => ({area: e.area, acao: e.acao, dados: e.dados}))');
const marca = async () => (await js('window.__nativoLog.length')) || 0;
/** @param {number} desde */
const desde = async (desde) => (await log()).slice(desde);
/** @param {number} ms */
const avanca = (ms) => js(`window.__nativoSimulado.avancoMs += ${ms}`);
const sim = (/** @type {string} */ expr) => js(`(() => { const s = window.__nativoSimulado; ${expr}; })()`);
const estado = () => js(`({ screen: __game.screen, level: __game.level, advancing: !!__game.advancing,
  inBreak: !!(window.__nativoLog && __game.scene.input && !__game.scene.input.enabled),
  coins: __game.progress.data.coins })`);
/** @param {*} lista @param {string} tipo */
const mostrou = (lista, tipo) => lista.some((/** @type {*} */ e) => e.area === 'ads' && e.acao === 'mostrar' && e.dados && e.dados.tipo === tipo);

/** Vitoria forcada (o mesmo veredito de Session.step), como no sdkcheck. */
async function ganhar() {
  await js(`(() => { const s = __game.scene.session; if (s.onFirstTap) s.onFirstTap();
    s.world.starsCrossed = 3; s.state = 'won'; s.endedAt = s.elapsed; s.onEnd('won'); })()`);
}
/**
 * Vence e espera a fase seguinte entrar (transicao + intervalo, se houver).
 * @returns {Promise<*>}
 */
async function ganharEsperando() {
  const antes = await js('__game.level');
  await ganhar();
  for (let t = 0; t < 80; t++) {
    const st = await estado();
    if (st.screen === 'game' && st.level !== antes && !st.advancing) {
      await sleep(400);
      return st;
    }
    await sleep(150);
  }
  return estado();
}

// ----------------------------------------------------------------- boot
console.log('\n=== Abertura ===');
{
  const l = await log();
  const i = (/** @type {string} */ area, /** @type {string} */ acao) => l.findIndex((e) => e.area === area && e.acao === acao);
  const splash = i('ciclo', 'splash');
  const consentir = i('ads', 'consentir');
  const iniciar = i('ads', 'iniciar');
  const carregar = i('ads', 'carregar');
  check('jogo abriu na fase 1 (entra jogando)', (await js('__game.screen')) === 'game' && (await js('__game.level')) === 1);
  check('splash sai antes do consentimento', splash >= 0 && consentir > splash, `${splash} < ${consentir}`);
  check('consentimento antes do SDK, SDK antes da carga', consentir < iniciar && iniciar < carregar, `${consentir} < ${iniciar} < ${carregar}`);
  check('intersticial e recompensado pre-carregados', l.some((e) => e.acao === 'carregou' && e.dados.tipo === 'intersticial') &&
    l.some((e) => e.acao === 'carregou' && e.dados.tipo === 'recompensado'));
  check('telemetria: level_start da fase 1 com n=1', l.some((e) => e.area === 'analytics' && e.acao === 'level_start' && e.dados.n === 1));
  check('consent mode concedido sem consentimento exigido', l.some((e) => e.area === 'analytics' && e.acao === 'consentimento' && e.dados.concedido));
  check('ganchos de teste expostos fora do aparelho', await js('!!window.__game'));
}

// ------------------------------------------------------------- intersticial
console.log('\n=== Intersticial ===');
{
  let m = await marca();
  await avanca(10 * 60 * 1000);
  let st = await ganharEsperando();
  check('carencia: nenhum intersticial na fase 1 de perfil novo', !mostrou(await desde(m), 'intersticial') && st.level === 2);

  // Passa da carencia, como o sdkcheck: ergue o progresso salvo.
  await js('(() => { __game.progress.data.unlocked = 12; __game.progress.flush(); })()');
  m = await marca();
  await js('window.__nativoSimulado.avancoMs = 0');
  // O relogio do simulado voltou para "agora": o ultimo anuncio foi na abertura.
  st = await ganharEsperando();
  check('intervalo: nada antes de 120 s desde a abertura', !mostrou(await desde(m), 'intersticial'));

  m = await marca();
  await avanca(121 * 1000);
  st = await ganharEsperando();
  const l = await desde(m);
  check('intervalo vencido: o intersticial aparece na troca de fase', mostrou(l, 'intersticial'));
  check('depois do anuncio a fase seguinte entra e o toque volta', st.screen === 'game' && !st.inBreak, JSON.stringify(st));
  check('telemetria do intersticial com o ponto', l.some((e) => e.area === 'analytics' && e.acao === 'anuncio_intersticial' && e.dados.ponto === 'troca'));
  check('o intersticial e recarregado depois de fechar', l.some((e) => e.acao === 'carregar' && e.dados.tipo === 'intersticial'));

  m = await marca();
  await ganharEsperando();
  check('logo depois de um anuncio, nada', !mostrou(await desde(m), 'intersticial'));

  // Retomar de uma pausa nunca traz anuncio.
  m = await marca();
  await avanca(121 * 1000);
  await js(`(() => { const s = __game.scene.session; if (s.onFirstTap) s.onFirstTap(); s.state = 'playing'; })()`);
  await js('__game.pauseLevel()');
  const pausou = (await js('__game.screen')) === 'pause';
  await js('__game.resumeLevel()');
  await sleep(500);
  check('retomar da pausa nao mostra intersticial', pausou && !mostrou(await desde(m), 'intersticial'));

  // App escondido: os timers do fluxo correm, o anuncio nao.
  m = await marca();
  await sim('s.escondido = true');
  await ganharEsperando();
  await sim('s.escondido = false');
  check('com o app escondido, nada', !mostrou(await desde(m), 'intersticial'));

  // Volta do segundo plano: 20 s de carencia.
  m = await marca();
  await sim(`s.emitir('volta')`);
  await ganharEsperando();
  check('logo depois de voltar do segundo plano, nada', !mostrou(await desde(m), 'intersticial'));
  m = await marca();
  await avanca(21 * 1000);
  await ganharEsperando();
  check('passada a carencia da volta, o intersticial volta', mostrou(await desde(m), 'intersticial'));
}

// ------------------------------------------------------------------- vigia
console.log('\n=== Vigia: o fechar que nunca chega ===');
{
  await avanca(121 * 1000);
  await sim('s.fecha = false');
  const antes = await js('__game.level');
  await ganhar();
  let preso = null;
  for (let t = 0; t < 40; t++) {
    preso = await js(`({ mudo: __audio.adMuted, toque: __game.scene.input.enabled,
      aberto: window.__nativoLog.some(e => e.acao === 'abriu') })`);
    if (preso && preso.mudo) break;
    await sleep(150);
  }
  check('com o anuncio na tela, som mudo e toque desligado', !!preso && preso.mudo && !preso.toque, JSON.stringify(preso));
  await sleep(1500);
  // A troca de fase ja anotou o nivel novo antes do intervalo (trocaDeFase):
  // preso e o jogo parado em `advancing`, mudo, esperando o anuncio.
  const aindaPreso = (await js('__game.advancing && __audio.adMuted')) === true;
  // O app volta a ficar ativo e o anuncio nao fechou: o vigia solta em 1,5 s.
  await sim(`s.emitir('volta')`);
  let st = null;
  for (let t = 0; t < 40; t++) {
    st = await estado();
    if (st.level !== antes && !st.advancing) break;
    await sleep(150);
  }
  check('sem o fechar, o jogo fica parado esperando', aindaPreso);
  check('o vigia solta o jogo e a fase seguinte entra', !!st && st.level !== antes && !st.advancing && !st.inBreak &&
    !(await js('__audio.adMuted')), JSON.stringify(st));
  await sim('s.fecha = true');
  await sim('s.fechar()');
}

// -------------------------------------------------------------- recompensado
console.log('\n=== Video recompensado ===');
{
  // O bonus diario e um dos cinco pontos de video, e paga em moedas.
  const premio = async () => {
    const antes = await js('__game.progress.data.coins');
    await js('__game.dailyByAd()');
    return (await js('__game.progress.data.coins')) - antes;
  };
  await js(`__game.show('map')`);
  await sleep(300);
  let ganho = await premio();
  check('video assistido paga', ganho > 0, `+${ganho}`);

  await sim('s.premia = false');
  ganho = await premio();
  check('video fechado antes do fim nao paga', ganho === 0, `+${ganho}`);

  await sim('s.premia = true; s.premioDepoisDeFechar = true');
  ganho = await premio();
  check('premio que chega depois do fechar ainda paga', ganho > 0, `+${ganho}`);
  await sim('s.premioDepoisDeFechar = false');

  // Sem anuncio carregado: o veu segura a tela ate o prazo, e nada e pago.
  await sim('s.carrega = false');
  await premio();
  const antes = await js('__game.progress.data.coins');
  const pedido = js('__game.dailyByAd()');
  await sleep(1200);
  const veu = await js(`!document.getElementById('adVeil').hidden`);
  const telaPresa = await js(`(() => { const r = document.getElementById('mapBack').getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!el && !!el.closest('#adVeil'); })()`);
  await pedido;
  await sleep(200);
  check('sem video: o veu cobre a tela enquanto espera', veu && telaPresa);
  check('sem video: nada pago e o veu sai', (await js('__game.progress.data.coins')) === antes && (await js(`document.getElementById('adVeil').hidden`)));
  // Em qualquer um dos sete idiomas: o Chrome da maquina decide qual.
  const i18n = await import('../src/core/i18n.js');
  const textos = i18n.LANGS.map((l) => { i18n.setLang(l); return i18n.t('videoIndisponivel'); });
  const aviso = await js(`document.getElementById('toast').textContent`);
  check('sem video: o jogador fica sabendo', textos.includes(aviso), aviso);
  // A proxima espera pede a carga na hora, sem esperar a tentativa agendada.
  await sim('s.carrega = true');
}

// ------------------------------------------------------------------- compra
console.log('\n=== Remover anuncios ===');
{
  await js(`__game.show('settings')`);
  await sleep(300);
  const botao = await js(`(() => { const b = document.getElementById('setNoAds'); return { visivel: !b.hidden && !document.getElementById('setApp').hidden, texto: b.textContent }; })()`);
  check('ajustes mostram a compra com o preco da loja', botao.visivel && /R\$ 9,90/.test(botao.texto), botao.texto);
  await js(`document.getElementById('setNoAds').click()`);
  await sleep(500);
  check('comprar grava a flag fora do save', (await js(`localStorage.getItem('hexadrop.semAnuncios')`)) === 'true');
  const restaurar = await js(`document.getElementById('setRestore').hidden`);
  check('comprado: some o restaurar e o botao vira agradecimento', restaurar && (await js(`document.getElementById('setNoAds').disabled`)));

  await js(`__game.startLevel(__game.level)`);
  await sleep(800);
  const m = await marca();
  await avanca(10 * 60 * 1000);
  await ganharEsperando();
  check('com a compra, nenhum intersticial', !mostrou(await desde(m), 'intersticial'));
  await js(`__game.show('map')`);
  const antes = await js('__game.progress.data.coins');
  await js('__game.dailyByAd()');
  check('com a compra, o video opcional continua pagando', (await js('__game.progress.data.coins')) > antes);

  // Reiniciar o progresso nao devolve os anuncios.
  await js('__game.progress.reset()');
  check('reiniciar o progresso mantem a compra', (await js(`localStorage.getItem('hexadrop.semAnuncios')`)) === 'true');
}

// --------------------------------------------------- voltar e segundo plano
console.log('\n=== Voltar e segundo plano ===');
{
  const voltar = async () => { await sim(`s.emitir('voltar')`); await sleep(350); return js('__game.screen'); };
  await js(`__game.startLevel(3)`);
  await sleep(1500);
  await js(`(() => { const s = __game.scene.session; if (s.onFirstTap) s.onFirstTap(); s.state = 'playing'; })()`);
  check('voltar na fase: pausa', (await voltar()) === 'pause');
  check('voltar na pausa: continua a fase', (await voltar()) === 'game');
  await js(`__game.show('map')`);
  check('voltar no mapa: tela inicial', (await voltar()) === 'home');
  await js(`__game.show('settings')`);
  check('voltar nos ajustes: tela inicial', (await voltar()) === 'home');
  const m = await marca();
  await voltar();
  check('voltar na tela inicial: o app vai para tras', (await desde(m)).some((e) => e.area === 'ciclo' && e.acao === 'minimizar'));

  await js(`__game.startLevel(3)`);
  await sleep(1500);
  await js(`(() => { const s = __game.scene.session; if (s.onFirstTap) s.onFirstTap(); s.state = 'playing'; })()`);
  await sim(`s.emitir('pausa')`);
  await sleep(300);
  check('segundo plano no meio da fase abre a pausa', (await js('__game.screen')) === 'pause');
  const m2 = await marca();
  await avanca(10 * 60 * 1000);
  await sim(`s.emitir('volta')`);
  await sleep(400);
  check('a volta do segundo plano nao traz anuncio', !mostrou(await desde(m2), 'intersticial') && (await js('__game.screen')) === 'pause');
  await js('__game.resumeLevel()');
}

// ---------------------------------------------------------------- safe-area
console.log('\n=== Safe-area ===');
{
  await sleep(400);
  const antes = await js('__game.scene.topInset');
  await js(`document.documentElement.style.setProperty('--safe-area-inset-top', '40px');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', '24px')`);
  await sleep(500);
  const depois = await js('({ top: __game.scene.topInset, bottom: __game.scene.bottomInset })');
  check('o safe-area do Capacitor desce a camera', depois.top === antes + 40 && depois.bottom === 40 + 24, JSON.stringify({ antes, depois }));
  await js(`document.documentElement.style.removeProperty('--safe-area-inset-top');
    document.documentElement.style.removeProperty('--safe-area-inset-bottom')`);
}

// --------------------------------------------------------------- telemetria
console.log('\n=== Telemetria ===');
{
  const eventos = (await log()).filter((e) => e.area === 'analytics' && e.acao !== 'propriedade' && e.acao !== 'consentimento');
  const nomes = [...new Set(eventos.map((e) => e.acao))];
  const ruins = nomes.filter((n) => !/^[a-z][a-z0-9_]{0,39}$/.test(n) || /^(firebase_|google_|ga_)/.test(n));
  check('todo nome de evento passa a regra do Firebase', ruins.length === 0, ruins.join(', '));
  const params = eventos.flatMap((e) => Object.entries(e.dados || {}));
  const paramRuim = params.filter(([k, v]) => !/^[a-z][a-z0-9_]{0,39}$/.test(k) || (typeof v === 'string' && v.length > 100) ||
    (typeof v !== 'string' && typeof v !== 'number'));
  check('todo parametro passa a regra do Firebase', paramRuim.length === 0, JSON.stringify(paramRuim.slice(0, 3)));
  check('poucos nomes distintos', nomes.length < 40, `${nomes.length}: ${nomes.join(' ')}`);
  check('level_end com success', eventos.some((e) => e.acao === 'level_end' && e.dados.success === 1));
}

check('nenhuma excecao na pagina', erros.length === 0, erros.slice(0, 2).join(' | '));

sock.close();
chrome.kill();
console.log(`\n=== Resultado: ${falhas} falhas ===\n`);
process.exit(falhas ? 1 : 0);
