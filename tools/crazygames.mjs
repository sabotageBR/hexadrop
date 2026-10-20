/**
 * Grava as capas e os videos de previa da CrazyGames em marketing/crazygames/.
 *
 * Capas: sobe o proprio servidor do Vite (porta 4192) e o Chrome headless
 * (porta de depuracao 9111), abre /marketing/crazygames/ e le os pixels de cada
 * canvas por `toDataURL`, no dobro do tamanho; o ffmpeg desce para o tamanho
 * pedido com lanczos e grava RGB puro, sem alfa, em capas/:
 *
 *   hexadrop-capa-1920x1080.png   paisagem, 16:9 (obrigatoria)
 *   hexadrop-capa-800x1200.png    retrato, 2:3 (obrigatoria)
 *   hexadrop-capa-800x800.png     quadrada, 1:1 (obrigatoria)
 *   hexadrop-capa-1080x1620.png   o retrato no tamanho do video: e o primeiro
 *                                 quadro dele, e nao vai para o envio
 *
 * Videos (`--videos`, ~10 min cada): roda `tools/thumbnail.mjs --perfil
 * crazygames` duas vezes, uma por formato, abrindo cada video com a capa do
 * mesmo formato - a CrazyGames pede a capa como primeiro quadro. Saem em videos/:
 *
 *   hexadrop-video-1920x1080.mp4  paisagem, 16:9
 *   hexadrop-video-1080x1620.mp4  retrato, 2:3
 *   quadros-*.png                 folha de contato de cada um
 *
 *   node tools/crazygames.mjs            # so as capas
 *   node tools/crazygames.mjs --videos   # capas e videos
 *   node tools/crazygames.mjs --so-videos
 *
 * Como o thumbnail, os videos usam as fases das seeds atuais: rode de novo
 * depois de `npm run levels` ou de mexer em arte.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = resolve(RAIZ, 'marketing/crazygames');
const CAPAS_DIR = resolve(SAIDA, 'capas');
const PORTA_HTTP = 4192;
const PORTA_CDP = 9111;
/** [canvas, largura, altura]: cada capa sai do dobro do canvas, reduzido. */
const CAPAS = [
  ['paisagem', 1920, 1080],
  ['retrato', 800, 1200],
  ['quadrada', 800, 800],
  ['retrato', 1080, 1620],
];
/** Os videos: tamanho e viewport CSS (o jogo desenha no dobro). */
const VIDEOS = [
  { largura: 1920, altura: 1080, vista: '960x540' },
  { largura: 1080, altura: 1620, vista: '540x810' },
];
const argv = process.argv.slice(2);
const COM_VIDEOS = argv.includes('--videos') || argv.includes('--so-videos');
const COM_CAPAS = !argv.includes('--so-videos');

if (COM_CAPAS) await gravarCapas();
if (COM_VIDEOS) {
  for (const v of VIDEOS) {
    const nome = `${v.largura}x${v.altura}`;
    console.log(`\n=== video ${nome} ===`);
    const r = spawnSync('node', [resolve(RAIZ, 'tools/thumbnail.mjs'), '--perfil', 'crazygames',
      '--largura', String(v.largura), '--altura', String(v.altura), '--vista', v.vista,
      '--video', `hexadrop-video-${nome}.mp4`, '--folha', `quadros-${nome}.png`,
      '--abertura', resolve(CAPAS_DIR, `hexadrop-capa-${nome}.png`), '--crf', '18'], { stdio: 'inherit', cwd: RAIZ });
    if (r.status !== 0) {
      console.error(`o video ${nome} falhou`);
      process.exit(1);
    }
  }
}
process.exit(0);

/** Le cada canvas de /marketing/crazygames/ e grava as capas. */
async function gravarCapas() {
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

  await espera(`http://127.0.0.1:${PORTA_HTTP}/marketing/crazygames/`);
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
  await send('Page.navigate', { url: `http://127.0.0.1:${PORTA_HTTP}/marketing/crazygames/` }, sessionId);
  const js = async (/** @type {string} */ e) =>
    (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId)).result?.result?.value;
  let pronto = false;
  for (let i = 0; i < 80 && !pronto; i++) {
    pronto = (await js('window.__capasProntas === true')) === true;
    if (!pronto) await sleep(250);
  }
  if (!pronto) throw new Error('as capas nao ficaram prontas (erro na pagina?)');

  mkdirSync(CAPAS_DIR, { recursive: true });
  for (const [canvas, w, h] of CAPAS) {
    const url = await js(`document.getElementById('${canvas}').toDataURL('image/png')`);
    if (!url) throw new Error('canvas vazio: ' + canvas);
    const bruto = resolve(CAPAS_DIR, `.${canvas}-2x.png`);
    const arquivo = resolve(CAPAS_DIR, `hexadrop-capa-${w}x${h}.png`);
    writeFileSync(bruto, Buffer.from(url.split(',')[1], 'base64'));
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', bruto,
      '-vf', `scale=${w}:${h}:flags=lanczos`, '-pix_fmt', 'rgb24', arquivo], { stdio: 'inherit' });
    rmSync(bruto, { force: true });
    if (r.status !== 0) throw new Error('ffmpeg falhou em ' + canvas);
    console.log(`  ${arquivo.replace(RAIZ + '/', '')}`);
  }
  sock.close();
  chrome.kill();
  vite.kill();
}
