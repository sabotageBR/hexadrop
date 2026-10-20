/**
 * Entrada do build `crazy` (vite.config.js troca o main.js do index.html por este).
 *
 * A ordem e a regra, como em src/app/inicio.js: o idioma (core/i18n.js) e o som
 * (core/audio.js) sao lidos do storage na avaliacao, e o progresso no
 * construtor do Game. Entao, antes de main.js:
 *
 * 1. o SDK inicia (`init` pre-carrega o save da nuvem) e o carregamento comeca
 *    a contar (`loadingStart`; o fim e o `gameLoadingFinished` de main.js);
 * 2. o save volta do modulo Data para o localStorage (src/crazy/save.js);
 * 3. o idioma passa a ser o do site (`systemInfo.locale`), que a CrazyGames
 *    pede no lugar do navegador;
 * 4. main.js entra por import dinamico.
 *
 * Sem SDK (bloqueador de anuncios, outro dominio) os tres primeiros passos nao
 * fazem nada e o jogo abre igual, com o save so no localStorage.
 */

import { iniciarSdk } from './sdk.js';
import { prepararSave } from './save.js';

/** @param {*} sdk */
function comecaCarregamento(sdk) {
  try {
    if (sdk) sdk.game.loadingStart();
  } catch {
    /* ignora */
  }
}

/** @param {*} sdk */
async function idiomaDoSite(sdk) {
  /** @type {string|null} */
  let locale = null;
  try {
    locale = sdk ? sdk.user.systemInfo.locale : null;
  } catch {
    locale = null;
  }
  if (!locale) return;
  const { idiomaDaPlataforma } = await import('../core/i18n.js');
  idiomaDaPlataforma(locale);
}

iniciarSdk()
  .catch(() => null)
  .then(async (sdk) => {
    comecaCarregamento(sdk);
    await prepararSave(sdk).catch(() => {});
    await idiomaDoSite(sdk).catch(() => {});
  })
  .then(() => import('../main.js'));
