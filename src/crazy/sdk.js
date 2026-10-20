/**
 * O SDK v3 da CrazyGames, iniciado uma vez so.
 *
 * Mora fora de crazy.js porque src/crazy/inicio.js precisa dele antes de
 * main.js ser avaliado (o save vem do modulo Data, que so existe depois do
 * init), e este arquivo e pequeno: o que entra antes do jogo e o que o jogador
 * espera para ver a primeira fase.
 */

/** O init pre-carrega o save da nuvem; estourado, a sessao segue sem SDK. */
const INIT_TIMEOUT = 6000;

/** @returns {*} */
export function api() {
  try {
    return typeof window !== 'undefined' && window.CrazyGames && window.CrazyGames.SDK ? window.CrazyGames.SDK : null;
  } catch {
    return null;
  }
}

/** @type {Promise<*>|null} */
let pedidoInit = null;

/**
 * Inicia o SDK e devolve ele pronto, ou null: sem o script (bloqueador de
 * anuncios), com o init falhando ou estourando o prazo, e fora dos dominios da
 * CrazyGames, onde o ambiente e `disabled` e toda chamada lanca. Em 127.0.0.1 o
 * ambiente e `local`, com o video trocado por um texto e um usuario de
 * demonstracao - e o que as ferramentas de tools/ usam.
 * @returns {Promise<*>}
 */
export function iniciarSdk() {
  if (pedidoInit) return pedidoInit;
  pedidoInit = (async () => {
    const sdk = api();
    if (!sdk || typeof sdk.init !== 'function') return null;
    const ok = await new Promise((resolve) => {
      const prazo = window.setTimeout(() => resolve(false), INIT_TIMEOUT);
      const fim = (/** @type {boolean} */ v) => {
        window.clearTimeout(prazo);
        resolve(v);
      };
      try {
        Promise.resolve(sdk.init()).then(() => fim(true), () => fim(false));
      } catch {
        fim(false);
      }
    });
    if (!ok) return null;
    try {
      if (sdk.environment === 'disabled') return null;
    } catch {
      return null;
    }
    return sdk;
  })();
  return pedidoInit;
}
