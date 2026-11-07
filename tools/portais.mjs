/**
 * Os pacotes e o material grafico dos portais de distribuicao (Y8, Playgama,
 * Yandex Games, GameMonetize, GameDistribution, GamePix, Wavedash e itch.io).
 *
 *   node tools/portais.mjs                    # builds e material de todos
 *   node tools/portais.mjs --so=builds        # so os zips
 *   node tools/portais.mjs --so=arte          # so as imagens e os videos
 *   node tools/portais.mjs --portal=y8,yandex # so esses portais
 *   node tools/portais.mjs --portal=wavedash --so=builds --versao=1.0.20
 *                                             # outro rotulo no nome do zip; o package.json
 *                                             # fica (a versao dele entra no bundle do app)
 *   node tools/portais.mjs --portal=itch --so=builds --versao=1.0.21 --destino=<pasta>
 *                                             # e mais uma copia do zip em <pasta>, com o
 *                                             # mesmo zip extraido ao lado (<pasta>/<nome>/)
 *   --porta-http=4195 --porta-previa=4196 --porta-cdp=9112
 *                                             # as portas da arte (padrao: estas)
 *
 * **Builds**: `VITE_PLATAFORMA=<portal> vite build` (src/portais/, SDK de
 * tools/portais-sdk.mjs, ids de marketing/portais/ids.json) e o zip com o
 * index.html na raiz em dist-portais/hexa-drop-<portal>-<versao>.zip, com o
 * sha256 ao lado. O portal que pede id e esta sem ele sai como
 * `-sem-id.zip`: so serve para teste, o SDK nem carrega.
 *
 * **Material** em marketing/portais/<portal>/, no tamanho e no formato exatos
 * que cada painel pede (ITENS, abaixo; a fonte de cada regra esta no
 * ficha.md do portal):
 * - capas: marketing/portais/capa/ (a cena da capa comercial levada a
 *   qualquer proporcao), lida do canvas no dobro e reduzida com lanczos;
 * - icones: o icone do app (assets/icon-only.png), sem texto;
 * - telas: o jogo de verdade no Chrome, em ingles, numa fase de cada mundo,
 *   um toque na peca da dica um instante antes da foto (a peca estourando,
 *   e nao a torre parada); HUD do jogo incluido, que os portais aceitam. As
 *   da itch.io (`doBuild`) saem do proprio build dela (dist-itch/, servido
 *   pelo `vite preview`), sem botao de video nem pacote de moedas;
 * - videos: o de 1920x1080 da CrazyGames (marketing/crazygames/videos/); na Y8,
 *   que recusa montagem ("a continuous gameplay clip with no cuts"), um trecho
 *   so de uma fase, gravado por `node tools/thumbnail.mjs --perfil y8` (VIDEO_Y8,
 *   ~10 min; rode antes, depois de mexer em arte ou em `npm run levels`). O da
 *   Y8 sai no MP4 que todo painel le (mp4Compativel). O da Wavedash, jogo desde
 *   o primeiro quadro e sem audio, ja sai no lugar por `node tools/thumbnail.mjs
 *   --perfil wavedash` (VIDEO_WAVEDASH): aqui so se confere que ele existe;
 * - folha.jpg de cada portal, para conferir tudo de uma vez (nao vai para o
 *   envio).
 * JPG que passa do peso maximo do portal desce de qualidade ate caber.
 *
 * Sobe o Vite na porta 4195 (o `vite preview` do build, para as telas
 * `doBuild`, na 4196) e o Chrome com depuracao na 9112; `--porta-http`,
 * `--porta-previa` e `--porta-cdp` trocam as tres.
 */
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { PORTAIS } from './portais-sdk.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSAO = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).version;
const JOGO = 'hexa-drop';
const argv = process.argv.slice(2);
const opcao = (/** @type {string} */ nome) => (argv.find((a) => a.startsWith(`--${nome}=`)) || '').split('=')[1] || '';
const PORTA_HTTP = Number(opcao('porta-http')) || 4195;
/** O `vite preview` do build do portal, para as telas `doBuild`. */
const PORTA_PREVIA = Number(opcao('porta-previa')) || 4196;
const PORTA_CDP = Number(opcao('porta-cdp')) || 9112;
const VIDEO_CRAZY = join(RAIZ, 'marketing/crazygames/videos/hexadrop-video-1920x1080.mp4');
/** O trecho continuo da Y8, de `tools/thumbnail.mjs --perfil y8` (ROTEIRO_Y8). */
const VIDEO_Y8 = join(RAIZ, 'marketing/portais/y8/hexa-drop-video-continuo-1920x1080.mp4');
/** O video de previa da Wavedash, de `tools/thumbnail.mjs --perfil wavedash` (ROTEIRO_WAVEDASH). */
const VIDEO_WAVEDASH = join(RAIZ, 'marketing/portais/wavedash/hexa-drop-video-1920x1080.mp4');
/** Os portais que pedem id do painel, e quais. */
const IDS_PEDIDOS = { y8: ['appId', 'gameId'], gamedistribution: ['gameId'], gamemonetize: ['gameId'] };

/**
 * As cenas das telas: uma fase de cada mundo, com os pontos fortes do jogo
 * (gelatina colorida, gelo, doce, neon, explosivo, papel). Fase 4 e a
 * primeira sem a mao do tutorial.
 */
const CENAS = {
  puzzle: { fase: 4 },
  gelo: { fase: 12 },
  doce: { fase: 17 },
  rustico: { fase: 29 },
  neon: { fase: 42 },
  papel: { fase: 77 },
};

/**
 * @typedef {Object} Item
 * @property {string} arq      nome do arquivo, sem a extensao
 * @property {'capa'|'icone'|'tela'|'video'} tipo
 * @property {number} [w]
 * @property {number} [h]
 * @property {'png'|'jpg'} [fmt]
 * @property {number} [maxKB]  peso maximo do portal
 * @property {boolean} [logo]  capa com a logo (padrao: sim)
 * @property {string} [cena]   tela: chave de CENAS
 * @property {boolean} [continuo]  video: o trecho sem corte da Y8 (VIDEO_Y8)
 * @property {boolean} [previa]    video: o da Wavedash (VIDEO_WAVEDASH), gravado ja no lugar
 * @property {boolean} [doBuild]   tela: do build do portal (dist-<portal>/), e nao do servidor
 *                                 de desenvolvimento (que e o da Poki)
 */

/** O que cada portal pede. @type {Record<string, Item[]>} */
const ITENS = {
  y8: [
    // "Standard Screenshot": vira o thumbnail das listas (a Y8 testa A/B entre eles). So gameplay.
    { arq: 'tela-760x570-1', tipo: 'tela', w: 760, h: 570, cena: 'puzzle', fmt: 'jpg', maxKB: 2048 },
    { arq: 'tela-760x570-2', tipo: 'tela', w: 760, h: 570, cena: 'neon', fmt: 'jpg', maxKB: 2048 },
    { arq: 'tela-760x570-3', tipo: 'tela', w: 760, h: 570, cena: 'doce', fmt: 'jpg', maxKB: 2048 },
    { arq: 'tela-1280x720-1', tipo: 'tela', w: 1280, h: 720, cena: 'gelo', fmt: 'jpg', maxKB: 5120 },
    { arq: 'tela-1280x720-2', tipo: 'tela', w: 1280, h: 720, cena: 'rustico', fmt: 'jpg', maxKB: 5120 },
    { arq: 'promo-1920x1080', tipo: 'capa', w: 1920, h: 1080, fmt: 'jpg', maxKB: 5120 },
    { arq: 'promo-1080x1920', tipo: 'capa', w: 1080, h: 1920, fmt: 'jpg', maxKB: 5120 },
    { arq: 'card-760x570', tipo: 'capa', w: 760, h: 570, fmt: 'jpg', maxKB: 2048 },
    { arq: 'video-1920x1080', tipo: 'video', continuo: true },
  ],
  playgama: [
    { arq: 'capa-800x800', tipo: 'capa', w: 800, h: 800, fmt: 'png', maxKB: 10240 },
    { arq: 'capa-1080x1920', tipo: 'capa', w: 1080, h: 1920, fmt: 'png', maxKB: 10240 },
    { arq: 'capa-1920x1080', tipo: 'capa', w: 1920, h: 1080, fmt: 'png', maxKB: 10240 },
    // "Other assets", opcionais
    { arq: 'tela-1920x1080-1', tipo: 'tela', w: 1920, h: 1080, cena: 'gelo', fmt: 'jpg' },
    { arq: 'tela-1920x1080-2', tipo: 'tela', w: 1920, h: 1080, cena: 'neon', fmt: 'jpg' },
    { arq: 'tela-1080x1920-1', tipo: 'tela', w: 1080, h: 1920, cena: 'doce', fmt: 'jpg' },
    { arq: 'video-1920x1080', tipo: 'video' },
  ],
  yandex: [
    // Sem texto no icone; a capa pode ter o nome, igual ao titulo de cada idioma (5.1.3).
    { arq: 'icone-512x512', tipo: 'icone', w: 512, h: 512, fmt: 'png' },
    { arq: 'capa-800x470', tipo: 'capa', w: 800, h: 470, fmt: 'png' },
    { arq: 'capa-800x470-sem-texto', tipo: 'capa', w: 800, h: 470, fmt: 'png', logo: false },
    { arq: 'hero-1560x520', tipo: 'capa', w: 1560, h: 520, fmt: 'png' },
    { arq: 'tela-desktop-1920x1080-1', tipo: 'tela', w: 1920, h: 1080, cena: 'puzzle', fmt: 'png' },
    { arq: 'tela-desktop-1920x1080-2', tipo: 'tela', w: 1920, h: 1080, cena: 'gelo', fmt: 'png' },
    { arq: 'tela-desktop-1920x1080-3', tipo: 'tela', w: 1920, h: 1080, cena: 'neon', fmt: 'png' },
    { arq: 'tela-mobile-1080x1920-1', tipo: 'tela', w: 1080, h: 1920, cena: 'puzzle', fmt: 'png' },
    { arq: 'tela-mobile-1080x1920-2', tipo: 'tela', w: 1080, h: 1920, cena: 'doce', fmt: 'png' },
    { arq: 'tela-mobile-1080x1920-3', tipo: 'tela', w: 1080, h: 1920, cena: 'neon', fmt: 'png' },
    { arq: 'video-1920x1080', tipo: 'video' },
  ],
  gamemonetize: [
    { arq: 'thumb-512x384', tipo: 'capa', w: 512, h: 384, fmt: 'jpg' },
    { arq: 'thumb-512x512', tipo: 'capa', w: 512, h: 512, fmt: 'jpg' },
    { arq: 'thumb-512x340', tipo: 'capa', w: 512, h: 340, fmt: 'jpg' },
  ],
  gamedistribution: [
    // So JPG, no maximo 500 KB, tamanho exato. O titulo so nas de 1280; na 200x120, nada de logo.
    { arq: 'thumb-512x384', tipo: 'capa', w: 512, h: 384, fmt: 'jpg', maxKB: 500, logo: false },
    { arq: 'thumb-512x512', tipo: 'capa', w: 512, h: 512, fmt: 'jpg', maxKB: 500, logo: false },
    { arq: 'thumb-200x120', tipo: 'capa', w: 200, h: 120, fmt: 'jpg', maxKB: 500, logo: false },
    { arq: 'banner-1280x720', tipo: 'capa', w: 1280, h: 720, fmt: 'jpg', maxKB: 500 },
    { arq: 'banner-1280x550', tipo: 'capa', w: 1280, h: 550, fmt: 'jpg', maxKB: 500 },
  ],
  gamepix: [
    { arq: 'icone-256x256', tipo: 'icone', w: 256, h: 256, fmt: 'png', maxKB: 1024 },
    { arq: 'capa-1360x850', tipo: 'capa', w: 1360, h: 850, fmt: 'png', maxKB: 1536 },
  ],
  wavedash: [
    // 16:9 (guardada ate 1920x1080, ate 25 MB), com o titulo e nenhum outro texto.
    { arq: 'capa-1920x1080', tipo: 'capa', w: 1920, h: 1080, fmt: 'png', maxKB: 25600 },
    // Jogo desde o primeiro quadro, sem audio: ela guarda so os 10 primeiros segundos.
    { arq: 'video-1920x1080', tipo: 'video', previa: true },
  ],
  itch: [
    // Capa 315:250 (a itch mostra em 315x250; entregue no dobro), so com o titulo.
    { arq: 'capa-630x500', tipo: 'capa', w: 630, h: 500, fmt: 'png' },
    // 3 a 5 telas de qualquer tamanho, do proprio build da itch: a vista de 960x600 do
    // embed recomendado (no dobro) e uma de celular em pe.
    { arq: 'tela-1920x1200-1', tipo: 'tela', w: 1920, h: 1200, cena: 'gelo', fmt: 'png', doBuild: true },
    { arq: 'tela-1920x1200-2', tipo: 'tela', w: 1920, h: 1200, cena: 'doce', fmt: 'png', doBuild: true },
    { arq: 'tela-1920x1200-3', tipo: 'tela', w: 1920, h: 1200, cena: 'neon', fmt: 'png', doBuild: true },
    { arq: 'tela-1080x1920-4', tipo: 'tela', w: 1080, h: 1920, cena: 'puzzle', fmt: 'png', doBuild: true },
  ],
};

const SO = opcao('so');
/** `--destino=<pasta>`: onde mais deixar o zip, com ele extraido ao lado (`entrega`). */
const destino = opcao('destino') ? resolve(opcao('destino')) : '';
const ESCOLHIDOS = opcao('portal') ? opcao('portal').split(',') : Object.keys(PORTAIS);
for (const p of ESCOLHIDOS) {
  if (!PORTAIS[p]) {
    console.error(`portal desconhecido: ${p} (${Object.keys(PORTAIS).join(', ')})`);
    process.exit(2);
  }
}

if (SO !== 'arte') builds();
if (SO !== 'builds') await arte();
process.exit(0);

// ------------------------------------------------------------------ builds

function builds() {
  const ids = JSON.parse(readFileSync(join(RAIZ, 'marketing/portais/ids.json'), 'utf8'));
  // So o nome do zip: o build e o mesmo, e a versao do package.json continua
  // onde estava (no app ela vira o versionName e entra no bundle).
  const rotulo = opcao('versao') || VERSAO;
  const saida = join(RAIZ, 'dist-portais');
  mkdirSync(saida, { recursive: true });
  for (const p of ESCOLHIDOS) {
    const b = spawnSync('node', ['node_modules/vite/bin/vite.js', 'build', '--logLevel', 'error'], {
      cwd: RAIZ, encoding: 'utf8', env: { ...process.env, VITE_PLATAFORMA: p, IDS_PORTAL: '' },
    });
    if (b.status !== 0) {
      console.error(`build ${p} falhou:\n${b.stderr}`);
      process.exit(1);
    }
    const faltam = (IDS_PEDIDOS[p] || []).filter((k) => !(ids[p] && ids[p][k]));
    const nome = `${JOGO}-${p}-${rotulo}${faltam.length ? '-sem-id' : ''}`;
    const zip = join(saida, `${nome}.zip`);
    rmSync(zip, { force: true });
    const z = spawnSync('zip', ['-qr', '-X', zip, '.'], { cwd: join(RAIZ, `dist-${p}`), encoding: 'utf8' });
    const lista = spawnSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).stdout.trim().split('\n');
    if (z.status !== 0 || !lista.includes('index.html')) {
      console.error(`zip ${p} invalido ou sem index.html na raiz`);
      process.exit(1);
    }
    const sha = createHash('sha256').update(readFileSync(zip)).digest('hex');
    writeFileSync(join(saida, `${nome}.sha256`), `${sha}  ${nome}.zip\n`);
    const aviso = faltam.length ? `  (SEM ${faltam.join(' e ')}: so para teste)` : '';
    console.log(`dist-portais/${nome}.zip  ${(statSync(zip).size / 1024).toFixed(0)} KB, ${lista.length} arquivos${aviso}`);
    if (destino) entrega(zip, nome);
  }
}

/**
 * `--destino=<pasta>`: uma copia do zip la, e o mesmo zip extraido ao lado, em
 * <pasta>/<nome>/ (o painel que aceita pasta, e para conferir sem abrir o zip).
 * A pasta extraida sai do zip, nunca do dist-<portal>: as duas sao iguais por
 * construcao.
 * @param {string} zip
 * @param {string} nome
 */
function entrega(zip, nome) {
  mkdirSync(destino, { recursive: true });
  const copia = join(destino, `${nome}.zip`);
  const pasta = join(destino, nome);
  copyFileSync(zip, copia);
  rmSync(pasta, { recursive: true, force: true });
  const u = spawnSync('unzip', ['-q', copia, '-d', pasta], { encoding: 'utf8' });
  if (u.status !== 0) {
    console.error(`unzip ${copia} falhou: ${u.stderr}`);
    process.exit(1);
  }
  console.log(`  -> ${copia} e ${pasta}/`);
}

// ------------------------------------------------------------------ arte

async function arte() {
  const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORTA_HTTP), '--strictPort'], {
    cwd: RAIZ, stdio: 'ignore',
  });
  const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORTA_CDP}`, '--no-sandbox',
    '--disable-gpu', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
  /** O `vite preview` de cada build cujas telas saem dele (`doBuild`). @type {Map<string, *>} */
  const previas = new Map();
  process.on('exit', () => {
    chrome.kill();
    vite.kill();
    for (const p of previas.values()) p.kill();
  });
  const base = `http://127.0.0.1:${PORTA_HTTP}`;
  const basePrevia = `http://127.0.0.1:${PORTA_PREVIA}`;
  /**
   * Serve dist-<portal>/ (gerado agora, se faltar) pelo `vite preview`, um
   * portal por vez na mesma porta.
   * @param {string} portal
   */
  async function previa(portal) {
    if (previas.has(portal)) return;
    for (const p of previas.values()) p.kill();
    previas.clear();
    if (!existsSync(join(RAIZ, `dist-${portal}`, 'index.html'))) {
      const b = spawnSync('node', ['node_modules/vite/bin/vite.js', 'build', '--logLevel', 'error'], {
        cwd: RAIZ, encoding: 'utf8', env: { ...process.env, VITE_PLATAFORMA: portal, IDS_PORTAL: '' },
      });
      if (b.status !== 0) throw new Error(`build ${portal} falhou:\n${b.stderr}`);
    }
    const p = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(PORTA_PREVIA), '--strictPort'], {
      cwd: RAIZ, stdio: 'ignore', env: { ...process.env, VITE_PLATAFORMA: portal },
    });
    previas.set(portal, p);
    await espera(`${basePrevia}/index.html`);
  }
  await espera(`${base}/marketing/portais/capa/`);
  const ws = (await (await espera(`http://127.0.0.1:${PORTA_CDP}/json/version`)).json()).webSocketDebuggerUrl;
  const sock = new WebSocket(ws);
  await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
  let id = 0;
  const pendentes = new Map();
  sock.onmessage = (e) => {
    const m = JSON.parse(String(e.data));
    if (m.id && pendentes.has(m.id)) { pendentes.get(m.id)(m); pendentes.delete(m.id); }
  };
  const send = (/** @type {string} */ method, params = {}, /** @type {string} */ sessionId = '') => new Promise((r) => {
    const mid = ++id;
    pendentes.set(mid, r);
    sock.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  /** Uma aba nova com a vista pedida. */
  async function aba(/** @type {number} */ vw, /** @type {number} */ vh, /** @type {boolean} */ mobile, /** @type {string} */ pre = '') {
    const { targetId } = (await send('Target.createTarget', { url: 'about:blank' })).result;
    const { sessionId } = (await send('Target.attachToTarget', { targetId, flatten: true })).result;
    await send('Page.enable', {}, sessionId);
    await send('Runtime.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width: vw, height: vh, deviceScaleFactor: 2, mobile }, sessionId);
    if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
    if (pre) await send('Page.addScriptToEvaluateOnNewDocument', { source: pre }, sessionId);
    const js = async (/** @type {string} */ e) =>
      (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId)).result?.result?.value;
    return {
      js,
      ir: (/** @type {string} */ url) => send('Page.navigate', { url }, sessionId),
      foto: async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png' }, sessionId)).result.data, 'base64'),
      fechar: () => send('Target.closeTarget', { targetId }),
    };
  }

  const tmp = join(RAIZ, '.tmp/portais');
  mkdirSync(tmp, { recursive: true });
  /** O que ja foi feito nesta execucao, pela receita: o mesmo PNG serve a varios portais. */
  const feitos = new Map();

  /** A capa no tamanho pedido, em PNG cru (tmp). */
  async function capa(/** @type {Item} */ it) {
    const chave = `capa-${it.w}x${it.h}-${it.logo === false ? 'sem' : 'com'}`;
    if (feitos.has(chave)) return feitos.get(chave);
    const a = await aba(1200, 800, false);
    // Com o servidor de desenvolvimento ainda frio, a capa ja saiu so com o ceu
    // (sem as pecas nem a logo, que sao imagens): o ponto mais claro dela fica
    // escuro. Entao confere e recarrega, ate tres vezes.
    const claro = `(() => { const c = document.getElementById('capa'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let m = 0; for (let i = 0; i < d.length; i += 4 * 97) m = Math.max(m, d[i] + d[i + 1] + d[i + 2]); return m; })()`;
    let ok = false;
    for (let vez = 0; vez < 3 && !ok; vez++) {
      await a.ir(`${base}/marketing/portais/capa/?w=${it.w}&h=${it.h}${it.logo === false ? '&logo=0' : ''}`);
      for (let i = 0; i < 80 && !ok; i++) {
        await sleep(150);
        ok = (await a.js('window.__capaPronta === true')) === true;
      }
      if (ok) {
        await sleep(300);
        ok = Number(await a.js(claro)) >= 400;
      }
    }
    if (!ok) throw new Error(`a capa ${chave} nao ficou pronta`);
    const url = await a.js(`document.getElementById('capa').toDataURL('image/png')`);
    await a.fechar();
    const bruto = join(tmp, `${chave}-2x.png`);
    writeFileSync(bruto, Buffer.from(url.split(',')[1], 'base64'));
    const png = join(tmp, `${chave}.png`);
    ff(['-i', bruto, '-vf', `scale=${it.w}:${it.h}:flags=lanczos`, '-pix_fmt', 'rgb24', png]);
    feitos.set(chave, png);
    return png;
  }

  /** O icone do app, sem texto. */
  function icone(/** @type {Item} */ it) {
    const png = join(tmp, `icone-${it.w}.png`);
    ff(['-i', join(RAIZ, 'assets/icon-only.png'), '-vf', `scale=${it.w}:${it.h}:flags=lanczos`, '-pix_fmt', 'rgb24', png]);
    return png;
  }

  /**
   * Uma tela do jogo: ingles, todas as fases abertas, a fase da cena e um
   * toque na peca da dica ~0,3 s antes da foto. A vista e a metade do pedido
   * (dpr 2); 760x570 e 1280x720 saem de uma vista do proprio tamanho, no
   * dobro, reduzida - o HUD fica na proporcao de uma janela de verdade. Com
   * `doBuild`, do build do portal servido pelo `vite preview` (`previa`).
   * @param {Item} it
   * @param {string} portal
   */
  async function tela(it, portal) {
    const w = /** @type {number} */ (it.w);
    const h = /** @type {number} */ (it.h);
    const chave = `tela-${w}x${h}-${it.cena}${it.doBuild ? `-${portal}` : ''}`;
    if (feitos.has(chave)) return feitos.get(chave);
    const retrato = h > w;
    const [vw, vh] = w >= 1920 || h >= 1920 ? [w / 2, h / 2] : [w, h];
    const pre = `try { localStorage.setItem('hexadrop.lang', '"en"'); } catch (e) {}`;
    const a = await aba(vw, vh, retrato, pre);
    if (it.doBuild) await previa(portal);
    await a.ir(`${it.doBuild ? basePrevia : base}/index.html`);
    let ok = false;
    for (let i = 0; i < 80 && !ok; i++) {
      await sleep(150);
      ok = (await a.js('!!(window.__game && window.__game.scene && window.__game.scene.session)')) === true;
    }
    if (!ok) throw new Error('o jogo nao abriu para a tela ' + chave);
    const fase = CENAS[/** @type {string} */ (it.cena)].fase;
    await a.js(`(async () => {
      const g = window.__game;
      g.progress.data.unlocked = 999;
      g.progress.flush();
      g.flowLevels = false;
      g.startLevel(${fase});
      await new Promise((r) => setTimeout(r, 2600));
      const s = g.scene.session;
      const p = s.requestHint();
      s.hintPiece = null;
      if (p && p.alive) {
        const cell = p.cells[Math.floor(p.cells.length / 2)];
        const lx = cell[0] + 0.5 - p.cw / 2;
        const ly = cell[1] + 0.5 - p.ch / 2;
        const pos = p.body.getPosition();
        const ang = p.body.getAngle();
        s.tap(pos.x + lx * Math.cos(ang) - ly * Math.sin(ang), pos.y + lx * Math.sin(ang) + ly * Math.cos(ang), 0);
      }
      await new Promise((r) => setTimeout(r, 280));
      return true;
    })()`);
    const bruto = join(tmp, `${chave}-bruto.png`);
    writeFileSync(bruto, await a.foto());
    await a.fechar();
    const png = join(tmp, `${chave}.png`);
    ff(['-i', bruto, '-vf', `scale=${w}:${h}:flags=lanczos`, '-pix_fmt', 'rgb24', png]);
    feitos.set(chave, png);
    return png;
  }

  for (const portal of ESCOLHIDOS) {
    const pasta = join(RAIZ, 'marketing/portais', portal);
    mkdirSync(pasta, { recursive: true });
    /** @type {string[]} */
    const naFolha = [];
    for (const it of ITENS[portal]) {
      if (it.tipo === 'video') {
        const mp4 = join(pasta, `${JOGO}-${it.arq}.mp4`);
        if (it.previa) {
          if (!existsSync(VIDEO_WAVEDASH)) throw new Error('falta o video da Wavedash: node tools/thumbnail.mjs --perfil wavedash');
        } else if (it.continuo) {
          if (!existsSync(VIDEO_Y8)) {
            throw new Error('falta o trecho continuo da Y8: node tools/thumbnail.mjs --perfil y8 --largura 1920 --altura 1080 '
              + '--vista 960x540 --video hexa-drop-video-continuo-1920x1080.mp4 --folha quadros-video-continuo.png --sem-marca --crf 18');
          }
          mp4Compativel(['-i', VIDEO_Y8], mp4);
        } else {
          copyFileSync(VIDEO_CRAZY, mp4);
        }
        const dur = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { encoding: 'utf8' }).stdout.trim();
        console.log(`  ${portal}/${JOGO}-${it.arq}.mp4  ${Number(dur).toFixed(1)} s, ${(statSync(mp4).size / 1048576).toFixed(1)} MB`);
        continue;
      }
      const fonte = it.tipo === 'capa' ? await capa(it) : it.tipo === 'icone' ? icone(it) : await tela(it, portal);
      const arq = join(pasta, `${JOGO}-${it.arq}.${it.fmt}`);
      const kb = gravar(fonte, arq, it);
      naFolha.push(arq);
      console.log(`  ${portal}/${JOGO}-${it.arq}.${it.fmt}  ${it.w}x${it.h}, ${kb.toFixed(0)} KB${it.maxKB ? ` (max ${it.maxKB})` : ''}`);
    }
    folha(naFolha, join(pasta, 'folha.jpg'));
  }
  sock.close();
  chrome.kill();
  vite.kill();
  for (const p of previas.values()) p.kill();
}

/**
 * Grava no formato do item. JPG desce a qualidade ate caber no peso maximo.
 * @param {string} fonte PNG no tamanho final
 * @param {string} arq
 * @param {Item} it
 * @returns {number} KB
 */
function gravar(fonte, arq, it) {
  if (it.fmt === 'png') {
    ff(['-i', fonte, '-pix_fmt', 'rgb24', '-compression_level', '9', arq]);
  } else {
    // -q:v 2 e o melhor JPEG do ffmpeg; sobe (piora) ate caber.
    for (let q = 2; q <= 12; q++) {
      ff(['-i', fonte, '-q:v', String(q), '-pix_fmt', 'yuvj444p', arq]);
      if (!it.maxKB || statSync(arq).size / 1024 <= it.maxKB) break;
    }
  }
  const kb = statSync(arq).size / 1024;
  if (it.maxKB && kb > it.maxKB) throw new Error(`${arq}: ${kb.toFixed(0)} KB, acima de ${it.maxKB}`);
  return kb;
}

/**
 * O MP4 que todo painel le: H.264 High 4.2, yuv420p na faixa de TV com as cores
 * bt709 marcadas e uma trilha de audio muda. A Y8 mostrava o video em preto,
 * em 0:00, com o yuvj420p (faixa cheia) e sem trilha de audio.
 * @param {string[]} entrada argumentos de entrada do ffmpeg (com o -ss, se cortar)
 * @param {string} mp4
 */
function mp4Compativel(entrada, mp4) {
  ff([...entrada, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-map', '0:v:0', '-map', '1:a:0', '-shortest',
    '-vf', 'scale=in_range=auto:out_range=tv:out_color_matrix=bt709,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-level:v', '4.2', '-pix_fmt', 'yuv420p',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', mp4]);
}

/** Folha de conferencia: todas as imagens do portal, cada uma numa celula de 576x416. */
function folha(/** @type {string[]} */ arqs, /** @type {string} */ saida) {
  if (!arqs.length) return;
  const ents = arqs.flatMap((a) => ['-i', a]);
  const filtros = arqs
    .map((_, i) => `[${i}]scale=560:400:force_original_aspect_ratio=decrease:flags=lanczos,pad=576:416:(ow-iw)/2:(oh-ih)/2:white[a${i}]`)
    .join(';');
  const porLinha = 4;
  /** @type {string[]} */
  const linhas = [];
  let f = filtros;
  for (let i = 0; i < arqs.length; i += porLinha) {
    const grupo = arqs.slice(i, i + porLinha).map((_, k) => `[a${i + k}]`).join('');
    const n = Math.min(porLinha, arqs.length - i);
    f += `;${grupo}${n > 1 ? `hstack=inputs=${n}` : 'null'},pad=${576 * porLinha}:416:0:0:white[l${i}]`;
    linhas.push(`[l${i}]`);
  }
  f += linhas.length > 1 ? `;${linhas.join('')}vstack=inputs=${linhas.length}[s]` : `;${linhas[0]}null[s]`;
  ff([...ents, '-filter_complex', f, '-map', '[s]', '-q:v', '4', saida]);
}

/** @param {string[]} args */
function ff(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg falhou: ${r.stderr.slice(0, 400)}`);
}

/** @param {string} url */
async function espera(url) {
  for (let i = 0; i < 120; i++) {
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
