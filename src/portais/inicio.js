/**
 * Entrada dos builds dos portais (vite.config.js troca o main.js do index.html
 * por este), como src/crazy/inicio.js na CrazyGames.
 *
 * O idioma (core/i18n.js) e o som (core/audio.js) sao lidos do storage na
 * avaliacao, e o progresso no construtor do Game. Entao, antes de main.js, o
 * portal inicia o SDK e prepara o que for dele (`preparar`): o save da nuvem
 * de volta ao localStorage e o idioma do site. Sem SDK (bloqueador de
 * anuncios, outro dominio) isso nao faz nada e o jogo abre igual.
 *
 * `@plataforma` aponta para o portal do build (src/portais/<portal>.js).
 */

import { plataforma } from '@plataforma';

// Menu de contexto em lugar nenhum da pagina, e nao so no canvas: o clique
// direito ou o toque longo num botao abria o do navegador, e a Yandex reprova
// (1.6.1.8 e 1.6.2.7).
window.addEventListener('contextmenu', (e) => e.preventDefault());

// Para a automacao de tools/ (portaischeck), como o `__game` de main.js: so
// servido de 127.0.0.1/localhost, nunca publicado.
if (/^(127\.0\.0\.1|localhost)$/.test(window.location.hostname)) {
  /** @type {*} */ (window).__plataforma = plataforma;
}

plataforma
  .preparar()
  .catch(() => {})
  .then(() => import('../main.js'));
