import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const root = import.meta.dirname;

// `lisa` = sem plataforma nenhuma, em dist-lisa/. `app` = o jogo empacotado pelo
// Capacitor (Android/iOS), em dist-app/, que e o `webDir` de capacitor.config.json.
// A Poki continua em dist/ - e o que as ferramentas de tools/ conferem por padrao.
// A mesma lista mora em src/core/platform.js; valor desconhecido vira `poki`.
const ALVO = process.env.VITE_PLATAFORMA;
const PLATAFORMA = ALVO === 'lisa' ? 'lisa' : ALVO === 'app' ? 'app' : 'poki';
const SAIDA = { poki: 'dist', lisa: 'dist-lisa', app: 'dist-app' }[PLATAFORMA];
const VERSAO = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;

/**
 * Tira o carregador do Poki SDK do HTML publicado fora da Poki (lisa e app).
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
      return html.replace(
        /\n?[^\n]*<!--[^>]*Poki[^>]*-->\s*\n?[^\n]*<script src="https:\/\/game-cdn\.poki\.com[^>]*><\/script>/,
        '',
      );
    },
  };
}

/**
 * No app a entrada e src/app/inicio.js, e nao main.js.
 *
 * O idioma (i18n.js) e o som (audio.js) sao lidos do storage na avaliacao do
 * modulo, e o save no construtor do Game. A copia do save no Preferences tem
 * que voltar para o localStorage ANTES disso, entao inicio.js hidrata e so
 * depois importa main.js. Tem que rodar antes do processamento do HTML pelo
 * Vite (`order: 'pre'`), senao o bundle ja saiu com a entrada antiga.
 */
function entradaDoApp() {
  return {
    name: 'hexadrop-entrada-do-app',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (PLATAFORMA !== 'app') return html;
        const novo = html.replace('src="./src/main.js"', 'src="./src/app/inicio.js"');
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
  define: { 'import.meta.env.VITE_VERSAO': JSON.stringify(VERSAO) },
  // As implementacoes web dos plugins do Capacitor (o fallback de navegador,
  // que no aparelho nunca carrega) falam por console.log, e o verify-build
  // reprova console.log em qualquer JS publicado. O jogo nao usa console.
  esbuild: PLATAFORMA === 'app' ? { drop: ['console'] } : {},
  resolve: {
    alias: {
      // A unica porta do jogo para a plataforma: main.js importa `@plataforma`,
      // e o alias decide qual implementacao entra no bundle. Assim nenhum byte
      // de Capacitor/AdMob vai para a Poki, e nenhum da Poki vai para o app.
      '@plataforma': resolve(root, PLATAFORMA === 'app' ? 'src/app/nativo.js' : 'src/poki.js'),
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
