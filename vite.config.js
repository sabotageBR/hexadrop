import { defineConfig } from 'vite';
import { resolve } from 'node:path';
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

export default defineConfig({
  base: './',
  plugins: [semPlataforma(), entradaDoApp()],
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
    assetsInlineLimit: 8192,
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
