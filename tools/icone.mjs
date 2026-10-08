/**
 * Grava o icone e a splash do app em assets/ (o que o @capacitor/assets le).
 *
 * Sobe o proprio servidor do Vite (porta 4191) e o Chrome headless (porta de
 * depuracao 9998), abre /marketing/icone/ e le os pixels de cada canvas por
 * `toDataURL`, com a transparencia da camada da frente - uma captura de tela
 * perderia o alfa. Depois:
 *
 *   npx @capacitor/assets generate --android --ios \
 *     --iconBackgroundColor '#1a0b2e' --splashBackgroundColor '#1a0b2e'
 *
 * (ou `npm run icones`, que faz as duas coisas). Rode de novo depois de mexer
 * no hexagono padrao, no ceu do mundo 1 ou nas cores da marca.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = resolve(RAIZ, 'assets');
const PORTA_HTTP = 4191;
const PORTA_CDP = 9998;

const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORTA_HTTP), '--strictPort'], {
  cwd: RAIZ,
  stdio: 'ignore',
});
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORTA_CDP}`, '--no-sandbox',
  '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => {
  chrome.kill();
  vite.kill();
});

async function espera(/** @type {string} */ url) {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
    } catch {
      /* ainda nao */
    }
    await sleep(250);
  }
  throw new Error('nao respondeu: ' + url);
}

await espera(`http://127.0.0.1:${PORTA_HTTP}/marketing/icone/`);
const ws = (await (await espera(`http://127.0.0.1:${PORTA_CDP}/json/version`)).json()).webSocketDebuggerUrl;
const sock = new WebSocket(ws);
await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
let id = 0;
const pendentes = new Map();
sock.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pendentes.has(m.id)) { pendentes.get(m.id)(m); pendentes.delete(m.id); }
};
const send = (method, params = {}, sessionId) => new Promise((res) => {
  const mid = ++id;
  pendentes.set(mid, res);
  sock.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const { targetId } = (await send('Target.createTarget', { url: 'about:blank' })).result;
const { sessionId } = (await send('Target.attachToTarget', { targetId, flatten: true })).result;
await send('Page.enable', {}, sessionId);
await send('Page.navigate', { url: `http://127.0.0.1:${PORTA_HTTP}/marketing/icone/` }, sessionId);
const js = async (/** @type {string} */ e) =>
  (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId)).result?.result?.value;
for (let i = 0; i < 80 && !(await js('window.__iconePronto === true')); i++) await sleep(250);

mkdirSync(SAIDA, { recursive: true });
/** canvas -> arquivo que o @capacitor/assets espera */
const ARQUIVOS = {
  completo: 'icon-only.png',
  frente: 'icon-foreground.png',
  fundo: 'icon-background.png',
  splash: 'splash.png',
};
for (const [canvas, arquivo] of Object.entries(ARQUIVOS)) {
  const url = await js(`document.getElementById('${canvas}').toDataURL('image/png')`);
  if (!url) throw new Error('canvas vazio: ' + canvas);
  writeFileSync(resolve(SAIDA, arquivo), Buffer.from(url.split(',')[1], 'base64'));
  console.log('  ' + arquivo);
}
// A splash escura e a mesma: o jogo nao tem tema claro na abertura.
writeFileSync(resolve(SAIDA, 'splash-dark.png'), Buffer.from((await js(`document.getElementById('splash').toDataURL('image/png')`)).split(',')[1], 'base64'));
console.log('  splash-dark.png');
sock.close();
process.exit(0);
