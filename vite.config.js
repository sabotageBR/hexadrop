import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const root = import.meta.dirname;

// `lisa` = sem plataforma nenhuma. Sai em dist-lisa/ para conviver com o build
// da Poki, que continua em dist/ - e o que as ferramentas de tools/ conferem.
const PLATAFORMA = process.env.VITE_PLATAFORMA === 'lisa' ? 'lisa' : 'poki';

/**
 * Tira o carregador do Poki SDK do HTML publicado na versao lisa.
 *
 * O wrapper ja se vira sem SDK, mas isso nao basta: o arquivo publicado nao
 * pode nem *pedir* o script, senao a versao lisa continua fazendo uma
 * requisicao externa e dependendo de um dominio de terceiro para carregar.
 */
function semPlataforma() {
  return {
    name: 'hexadrop-sem-plataforma',
    transformIndexHtml(html) {
      if (PLATAFORMA !== 'lisa') return html;
      return html.replace(
        /\n?[^\n]*<!--[^>]*Poki[^>]*-->\s*\n?[^\n]*<script src="https:\/\/game-cdn\.poki\.com[^>]*><\/script>/,
        '',
      );
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [semPlataforma()],
  build: {
    outDir: PLATAFORMA === 'lisa' ? 'dist-lisa' : 'dist',
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
