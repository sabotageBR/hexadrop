import { defineConfig } from 'vite';
import { relative, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { PORTAIS } from './tools/portais-sdk.mjs';

const root = import.meta.dirname;

// `lisa` = sem plataforma nenhuma, em dist-lisa/. `app` = o jogo empacotado pelo
// Capacitor (Android/iOS), em dist-app/, que e o `webDir` de capacitor.config.json.
// `crazy` = a CrazyGames, em dist-crazy/. Os portais de distribuicao (PORTAIS,
// src/portais/) saem em dist-<portal>/.
// A Poki continua em dist/ - e o que as ferramentas de tools/ conferem por padrao.
// A mesma lista mora em src/core/platform.js; valor desconhecido vira `poki`.
const ALVO = process.env.VITE_PLATAFORMA;
const NUM_PORTAL = Object.hasOwn(PORTAIS, ALVO || '');
const PLATAFORMA = ALVO === 'lisa' || ALVO === 'app' || ALVO === 'crazy' || NUM_PORTAL ? ALVO : 'poki';
const SAIDA = NUM_PORTAL
  ? `dist-${PLATAFORMA}`
  : { poki: 'dist', lisa: 'dist-lisa', app: 'dist-app', crazy: 'dist-crazy' }[PLATAFORMA];
/** O SDK v3 da CrazyGames: o unico script externo do build `crazy`. */
const SDK_CRAZY = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
/** Entrada de cada alvo que precisa preparar o save antes de main.js ser avaliado. */
const ENTRADA = NUM_PORTAL
  ? './src/portais/inicio.js'
  : { app: './src/app/inicio.js', crazy: './src/crazy/inicio.js' }[PLATAFORMA];
/** A implementacao de `@plataforma` de cada alvo. */
const PORTA = NUM_PORTAL
  ? `src/portais/${PLATAFORMA}.js`
  : { app: 'src/app/nativo.js', crazy: 'src/crazy/crazy.js' }[PLATAFORMA] || 'src/poki.js';
const VERSAO = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
/**
 * Os ids que o painel de cada portal da ao jogo (marketing/portais/ids.json):
 * so os do portal do build entram no bundle. `IDS_PORTAL` (JSON) passa por
 * cima, para a automacao.
 */
const IDS_PORTAL = !NUM_PORTAL
  ? {}
  : process.env.IDS_PORTAL // ids de teste (tools/portaischeck.mjs), nunca no build publicado
    ? JSON.parse(process.env.IDS_PORTAL)
    : JSON.parse(readFileSync(resolve(root, 'marketing/portais/ids.json'), 'utf8'))[PLATAFORMA] || {};

/**
 * Tira o carregador do Poki SDK do HTML publicado fora da Poki (lisa, app e
 * crazy), e na CrazyGames poe o SDK deles no lugar.
 *
 * O wrapper ja se vira sem SDK, mas isso nao basta: o arquivo publicado nao
 * pode nem *pedir* o script, senao a versao lisa continua fazendo uma
 * requisicao externa e dependendo de um dominio de terceiro para carregar - e
 * o app levaria o dominio da Poki para dentro da loja.
 */
function semPlataforma() {
  return {
    name: 'hexadrop-sem-plataforma',
    transformIndexHtml(html) {
      if (PLATAFORMA === 'poki') return html;
      let troca = '';
      if (PLATAFORMA === 'crazy') {
        troca = `\n<!-- Unico script externo permitido pela CrazyGames. -->\n<script src="${SDK_CRAZY}"></script>`;
      } else if (NUM_PORTAL) {
        const { nome, html: sdk } = PORTAIS[PLATAFORMA];
        troca = sdk
          ? `\n<!-- ${nome}: o SDK do portal, unico script de fora. -->\n${sdk}`
          : `\n<!-- ${nome}: o SDK entra por src/portais/${PLATAFORMA}.js, depois das opcoes que ele le. -->`;
      }
      const novo = html.replace(
        /\n?[^\n]*<!--[^>]*Poki[^>]*-->\s*\n?[^\n]*<script src="https:\/\/game-cdn\.poki\.com[^>]*><\/script>/,
        troca,
      );
      if (novo === html) throw new Error('semPlataforma: o carregador da Poki sumiu do index.html');
      return novo;
    },
    // Os arquivos que o portal pede ao lado do index.html (Playgama: a config
    // do Bridge).
    generateBundle() {
      if (!NUM_PORTAL) return;
      for (const [fileName, source] of Object.entries(PORTAIS[PLATAFORMA].arquivos || {})) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
  };
}

/**
 * No app a entrada e src/app/inicio.js, e na CrazyGames src/crazy/inicio.js -
 * nao main.js.
 *
 * O idioma (i18n.js) e o som (audio.js) sao lidos do storage na avaliacao do
 * modulo, e o save no construtor do Game. A copia do save (o Preferences no
 * app, o modulo Data na CrazyGames) tem que voltar para o localStorage ANTES
 * disso, entao inicio.js hidrata e so depois importa main.js. Tem que rodar
 * antes do processamento do HTML pelo Vite (`order: 'pre'`), senao o bundle ja
 * saiu com a entrada antiga.
 */
function entradaDoApp() {
  return {
    name: 'hexadrop-entrada-do-app',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!ENTRADA) return html;
        const novo = html.replace('src="./src/main.js"', `src="${ENTRADA}"`);
        if (novo === html) throw new Error('entradaDoApp: <script src="./src/main.js"> sumiu do index.html');
        return novo;
      },
    },
  };
}

/**
 * O que muda so no build da Playgama, pelos requisitos de 2026-10-30
 * (wiki.playgama.com/playgama/game-requirements). Arquivo do repositorio ->
 * [texto, troca]; texto que sumir do codigo reprova o build.
 */
const TROCAS_PLAYGAMA = {
  'src/main.js': [
    // passo 7 do Bridge: nada de contador proprio, quem espaca o intervalo e o
    // Bridge (60 s no playgama-bridge-config.json, e o primeiro aos 30 s)
    ['const FASES_SEM_INTERVALO = 5;', 'const FASES_SEM_INTERVALO = 0;'],
    // 1.5.2: o Esc e do navegador (sai da tela cheia); P e Espaco pausam, e os
    // menus voltam pelo botao
    ["  onKey(code) {\n    if (code === 'KeyP'", "  onKey(code) {\n    if (code === 'Escape') return;\n    if (code === 'KeyP'"],
    // 3.3.1: os cartoes de vitoria e de derrota tocam as vinhetas (src/portais/playgama-audio.js)
    ['if (!calado) audio.win();', 'if (!calado) audio.winCard();'],
    ['  showLose() {\n    audio.lose();', '  showLose() {\n    audio.loseCard();'],
  ],
};
/** CSS a mais no fim de cada arquivo, so no build da Playgama. */
const CSS_PLAYGAMA = {
  // 2.2.1: o botao do video diz, em texto, que e anuncio (o icone de camera so
  // nao basta); o <html lang> vem do getLang() de main.js
  'src/ui/game.css': `
.btn.ad::after { content: "(ad)"; font-size: 0.82em; opacity: 0.85; }
:lang(pt) .btn.ad::after { content: "(anúncio)"; }
:lang(es) .btn.ad::after { content: "(anuncio)"; }
:lang(fr) .btn.ad::after { content: "(pub)"; }
:lang(it) .btn.ad::after { content: "(pubblicità)"; }
:lang(de) .btn.ad::after { content: "(Werbung)"; }
:lang(tr) .btn.ad::after { content: "(reklam)"; }
`,
};

/**
 * So no build da Playgama, os modulos trocados (MODULOS_PLAYGAMA), as
 * TROCAS_PLAYGAMA e o CSS_PLAYGAMA. Nos outros alvos o plugin nao faz nada, e
 * os bundles saem iguais.
 */
const MODULOS_PLAYGAMA = {
  // 3.2.1: so memoria e o espelho do Bridge, nunca o armazenamento do navegador
  'src/core/storage.js': 'src/portais/playgama-storage.js',
  // 3.3.1 e 3.3.2: musica e efeitos em arquivo (tools/sons-playgama.mjs), nada sintetizado
  'src/core/audio.js': 'src/portais/playgama-audio.js',
};

function soNaPlaygama() {
  const trocados = new Map(Object.entries(MODULOS_PLAYGAMA).map(([de, para]) => [resolve(root, de), resolve(root, para)]));
  return {
    name: 'hexadrop-so-na-playgama',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (PLATAFORMA !== 'playgama' || !importer || !/(storage|audio)\.js$/.test(source)) return null;
      const r = await this.resolve(source, importer, { ...options, skipSelf: true });
      return (r && trocados.get(r.id)) || null;
    },
    // os creditos dos sons (CC0) ao lado do LICENCAS.txt dos outros builds
    generateBundle() {
      if (PLATAFORMA !== 'playgama') return;
      this.emitFile({ type: 'asset', fileName: 'LICENCAS-SONS.txt', source: readFileSync(resolve(root, 'src/portais/playgama-sons/LICENCAS.txt'), 'utf8') });
    },
    transform(code, id) {
      if (PLATAFORMA !== 'playgama') return null;
      const arquivo = relative(root, id.split('?')[0]);
      const trocas = TROCAS_PLAYGAMA[arquivo];
      const css = CSS_PLAYGAMA[arquivo];
      if (!trocas && !css) return null;
      let novo = code;
      for (const [de, para] of trocas || []) {
        if (!novo.includes(de)) throw new Error(`soNaPlaygama: "${de}" sumiu de ${arquivo}`);
        novo = novo.split(de).join(para);
      }
      if (css) novo += css;
      return { code: novo, map: null };
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [semPlataforma(), entradaDoApp(), soNaPlaygama()],
  // A versao do package.json, para a telemetria do app saber de que build veio
  // cada evento (o versionName do Android sai do mesmo campo).
  define: {
    'import.meta.env.VITE_VERSAO': JSON.stringify(VERSAO),
    'import.meta.env.VITE_PORTAL_IDS': JSON.stringify(IDS_PORTAL),
  },
  // As implementacoes web dos plugins do Capacitor (o fallback de navegador,
  // que no aparelho nunca carrega) falam por console.log, e o verify-build
  // reprova console.log em qualquer JS publicado. O jogo nao usa console.
  esbuild: PLATAFORMA === 'app' ? { drop: ['console'] } : {},
  resolve: {
    alias: {
      // A unica porta do jogo para a plataforma: main.js importa `@plataforma`,
      // e o alias decide qual implementacao entra no bundle. Assim nenhum byte
      // de Capacitor/AdMob vai para a Poki, e nenhum da Poki vai para o app.
      '@plataforma': resolve(root, PORTA),
      // A implementacao web do @capacitor-firebase/analytics importa o SDK web
      // do Firebase, que o app nao usa (no aparelho quem fala e o SDK nativo).
      // Sem o desvio o build nao resolve o import, ou empacota o SDK web inteiro.
      ...(PLATAFORMA === 'app' ? { 'firebase/analytics': resolve(root, 'src/app/firebase-web.js') } : {}),
    },
  },
  build: {
    outDir: SAIDA,
    target: 'es2020',
    // na Playgama os MP3 vao como arquivo, nunca embutidos no JS (3.3.2: som em arquivo)
    assetsInlineLimit: PLATAFORMA === 'playgama' ? (arquivo, conteudo) => !arquivo.endsWith('.mp3') && conteudo.length < 8192 : 8192,
    cssCodeSplit: false,
    sourcemap: false,
    // Os prototipos NAO entram no build. Eles sao oficina: rodam em `npm run
    // dev`, que serve qualquer HTML do projeto direto da fonte.
    //
    // Enquanto estiveram aqui como entradas, `cssCodeSplit: false` juntava
    // `prototypes/proto.css` na MESMA folha que o index carrega - e, vindo
    // depois, o `.stat` do HUD de depuracao vencia o do jogo: os contadores de
    // coracao e moeda da home viravam caixinhas com o numero embaixo do icone,
    // e o `:root` do prototipo ainda trocava --ink, --accent e --panel antes
    // da primeira fase carregar. Isso so aparecia no build; em dev cada pagina
    // carrega a sua folha e o jogo ficava certo.
    rollupOptions: {
      input: { main: resolve(root, 'index.html') },
    },
  },
  server: { host: '127.0.0.1', port: 5173 },
});
