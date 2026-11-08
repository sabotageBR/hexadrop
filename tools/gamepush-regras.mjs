/**
 * O que reprova o build da GamePush (docs.gamepush.com e o checklist de
 * moderacao dela, lidos em 2026-11-08). Quem chama: tools/portais.mjs, no zip
 * que ele acabou de fazer (o empacotador falha), e tools/verify-build.mjs, no
 * dist-gamepush/.
 *
 * - o carregador oficial do painel, exatamente como o painel entrega, com o
 *   projectId e o publicToken de marketing/portais/ids.json, e o `onGPInit`
 *   definido antes dele;
 * - nenhuma URL de fora alem dos quatro hosts do carregador (os namespaces do
 *   SVG nao sao pedidos; o LICENCAS.txt e texto de licenca, nunca pedido);
 * - nenhum caminho absoluto (a GamePush e as plataformas servem o jogo numa
 *   subpasta);
 * - nenhum SDK nem nome de outro portal: a GamePush publica em nome do dono em
 *   varios deles;
 * - nada de `localStorage.clear()`, de varrer o storage, nem chave fora do
 *   prefixo `hexadrop.` (todo acesso passa por core/storage.js);
 * - nada de console.log, window.open, alert, confirm ou prompt;
 * - zip com o index.html na raiz, ate 200 MB, e a pasta extraida igual a ele.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { carregadorGamePush, HOSTS_GAMEPUSH, IDS_GAMEPUSH } from './portais-sdk.mjs';

/** O prefixo de toda chave do jogo no localStorage (core/storage.js). */
export const PREFIXO = 'hexadrop.';
/** O limite do zip no Game Hosting da GamePush. */
export const MAX_ZIP_BYTES = 200 * 1024 * 1024;
/** URLs que aparecem no codigo sem nunca serem pedidas: namespaces do SVG. */
const NAMESPACES = ['http://www.w3.org/2000/svg', 'http://www.w3.org/1999/xlink'];
/** Nome ou SDK de outro portal (no JS, o "y8" so como dominio, global ou texto). */
const OUTROS_TEXTO =
  /poki|crazy ?games|playgama|yandex|yagames|gamemonetize|gamedistribution|gamepix|wavedash|itch\.io|kongregate|coolmath|\by8\b/i;
const OUTROS_JS =
  /poki|crazy ?games|playgama|yandex|yagames|ysdk|gamemonetize|gamedistribution|gdsdk|gamepix|wavedash|itch\.io|kongregate|coolmath|y8\.com|y8sdk|\.y8\b|["'`]y8["'`]/i;

/** @param {string} dir @returns {string[]} */
function arquivos(dir) {
  /** @type {string[]} */
  const fora = [];
  for (const nome of readdirSync(dir)) {
    const f = join(dir, nome);
    if (statSync(f).isDirectory()) fora.push(...arquivos(f));
    else fora.push(f);
  }
  return fora;
}

/** @param {Buffer|string} b */
const sha = (b) => createHash('sha256').update(b).digest('hex');

/**
 * Confere uma pasta de build da GamePush (e o zip dela, se dado).
 * @param {{pasta: string, zip?: string}} o
 * @returns {string[]} o que reprova (vazio: passou)
 */
export function conferirBuildGamePush({ pasta, zip }) {
  /** @type {string[]} */
  const falhas = [];
  const todos = arquivos(pasta);
  const rel = (/** @type {string} */ f) => relative(pasta, f).split('\\').join('/');
  const indexHtml = join(pasta, 'index.html');
  if (!todos.includes(indexHtml)) return ['sem index.html na raiz do build'];
  const html = readFileSync(indexHtml, 'utf8');

  // O carregador oficial, com os ids do jogo, e o onGPInit antes dele.
  const { projectId, publicToken } = IDS_GAMEPUSH;
  if (!projectId || !publicToken) falhas.push('marketing/portais/ids.json sem o projectId e o publicToken da GamePush');
  const oficial = carregadorGamePush(projectId, publicToken).split('\n').slice(1).join('\n');
  const onde = html.indexOf(oficial);
  if (onde < 0) {
    const ids = /projectId=([^&"]*)&publicToken=([^&"]*)&callback=/.exec(html);
    falhas.push(
      ids
        ? `carregador da GamePush diferente do oficial ou com outros ids (projectId=${ids[1]}, publicToken=${ids[2]}; os do jogo: ${projectId}, ${publicToken})`
        : 'falta o carregador oficial da GamePush no index.html',
    );
  }
  if ((html.match(/callback=onGPInit/g) || []).length > 1) falhas.push('o carregador da GamePush aparece mais de uma vez');
  const callback = html.search(/window\.onGPInit\s*=/);
  if (callback < 0 || (onde >= 0 && callback > onde)) falhas.push('o window.onGPInit nao e definido antes do carregador');

  const js = todos.filter((f) => ['.js', '.mjs'].includes(extname(f)));
  const css = todos.filter((f) => extname(f) === '.css');
  /** @type {Array<[string, string]>} */
  const textos = [[indexHtml, html], ...[...js, ...css].map((f) => /** @type {[string, string]} */ ([f, readFileSync(f, 'utf8')]))];

  for (const [f, texto] of textos) {
    const nome = rel(f);
    const ehJs = /\.m?js$/.test(f);
    // URL de fora: so os quatro hosts do carregador.
    for (const m of texto.matchAll(/\b(?:https?|wss?):\/\/[^\s"'`)<>\\]+/g)) {
      const url = m[0];
      if (NAMESPACES.some((n) => url.startsWith(n))) continue;
      let host = '';
      try {
        host = new URL(url).hostname;
      } catch {
        host = url;
      }
      if (!HOSTS_GAMEPUSH.includes(host)) falhas.push(`URL externa em ${nome}: ${url.slice(0, 80)}`);
    }
    for (const m of texto.matchAll(/["'(]\/\/[a-z0-9.-]+\.[a-z]{2,}/gi)) falhas.push(`URL sem protocolo em ${nome}: ${m[0]}`);
    // Caminho absoluto: a plataforma serve o jogo numa subpasta.
    const absolutos = [
      ...texto.matchAll(/\s(?:src|href)\s*=\s*["']\/(?!\/)[^"']*/g),
      ...texto.matchAll(/url\(\s*["']?\/(?!\/)[^"')]*/g),
      ...(ehJs ? texto.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)["']\/(?!\/)[^"']*/g) : []),
    ];
    for (const m of absolutos) falhas.push(`caminho absoluto em ${nome}: ${m[0].trim().slice(0, 60)}`);
    // Outro portal.
    const marca = (ehJs ? OUTROS_JS : OUTROS_TEXTO).exec(texto);
    if (marca) falhas.push(`nome ou SDK de outro portal em ${nome}: ...${texto.slice(Math.max(0, marca.index - 30), marca.index + 30)}...`);
    if (ehJs) {
      if (/console\s*\.\s*log\b/.test(texto)) falhas.push(`console.log em ${nome}`);
      if (/\bwindow\s*\.\s*open\s*\(/.test(texto)) falhas.push(`window.open em ${nome}`);
      for (const fn of ['alert', 'confirm', 'prompt']) {
        if (new RegExp(`(?<![\\w$.])${fn}\\s*\\(|window\\s*\\.\\s*${fn}\\s*\\(`).test(texto)) falhas.push(`${fn}() em ${nome}`);
      }
      if (/localStorage\s*\.\s*clear\s*\(|\.clear\s*\(\s*\)\s*[,;]?[^;]{0,40}localStorage/.test(texto)) falhas.push(`localStorage.clear() em ${nome}`);
    }
  }

  // O localStorage so por core/storage.js, e so com o prefixo.
  falhas.push(...conferirStorage(js.map((f) => /** @type {[string, string]} */ ([rel(f), readFileSync(f, 'utf8')]))));

  // O zip: index.html na raiz, ate 200 MB, e igual a pasta.
  if (zip) {
    const tam = statSync(zip).size;
    if (tam > MAX_ZIP_BYTES) falhas.push(`zip com ${(tam / 1048576).toFixed(1)} MB, acima de 200 MB`);
    const lista = spawnSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).stdout.split('\n').filter((l) => l && !l.endsWith('/'));
    if (!lista.includes('index.html')) falhas.push('zip sem index.html na raiz');
    const daPasta = todos.map(rel).sort();
    const doZip = [...lista].sort();
    if (JSON.stringify(daPasta) !== JSON.stringify(doZip)) {
      const so1 = daPasta.filter((x) => !doZip.includes(x));
      const so2 = doZip.filter((x) => !daPasta.includes(x));
      falhas.push(`pasta extraida diferente do zip (so na pasta: ${so1.join(', ') || '-'}; so no zip: ${so2.join(', ') || '-'})`);
    } else {
      for (const nome of doZip) {
        const noZip = spawnSync('unzip', ['-p', zip, nome], { maxBuffer: 1 << 30 }).stdout;
        if (sha(noZip) !== sha(readFileSync(join(pasta, nome)))) falhas.push(`pasta extraida diferente do zip: ${nome}`);
      }
    }
  }
  return falhas;
}

/**
 * Todo `localStorage` do build tem de ser o de core/storage.js: perto da
 * constante do prefixo, so getItem/setItem/removeItem, e cada chave montada
 * como `<prefixo> + nome`. Nada de clear, key(), length, Object.keys nem
 * colchetes (varrer o storage apagaria ou leria o de outros jogos na mesma
 * origem).
 * @param {Array<[string, string]>} js [nome, codigo]
 * @returns {string[]}
 */
export function conferirStorage(js) {
  /** @type {string[]} */
  const falhas = [];
  const comPrefixo = js.filter(([, c]) => c.includes(`"${PREFIXO}"`) || c.includes(`'${PREFIXO}'`));
  if (comPrefixo.length !== 1) return [`o prefixo "${PREFIXO}" do storage aparece em ${comPrefixo.length} arquivos JS (esperado 1)`];
  for (const [nome, codigo] of js) {
    for (const m of codigo.matchAll(/localStorage/g)) {
      const depois = codigo.slice(m.index + 'localStorage'.length, m.index + 'localStorage'.length + 80);
      const chamada = /^\s*\.\s*(getItem|setItem|removeItem)\s*\(\s*([\w$]+)\s*[,)]/.exec(depois);
      if (!chamada) {
        falhas.push(`localStorage usado fora de getItem/setItem/removeItem em ${nome}: ...${codigo.slice(m.index - 20, m.index + 50)}...`);
        continue;
      }
      if (nome !== comPrefixo[0][0]) {
        falhas.push(`localStorage fora do modulo do storage em ${nome}`);
        continue;
      }
      const prefixo = new RegExp(`([\\w$]+)\\s*=\\s*["']${PREFIXO.replace('.', '\\.')}["']`).exec(codigo);
      const pv = prefixo ? prefixo[1] : '';
      const chave = chamada[2];
      const montada = new RegExp(`(?<![\\w$])${chave.replace(/\$/g, '\\$')}\\s*=\\s*${pv.replace(/\$/g, '\\$')}\\s*\\+`);
      if (!pv || !montada.test(codigo)) falhas.push(`chave do localStorage sem o prefixo ${PREFIXO} em ${nome}: ${chamada[1]}(${chave})`);
    }
  }
  return falhas;
}
