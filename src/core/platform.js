/**
 * Plataforma alvo do build.
 *
 * `poki` (padrao) carrega o SDK da Poki, mostra intervalos comerciais e oferece
 * os videos recompensados opcionais. `lisa` nao tem plataforma nenhuma: nenhum
 * script de fora, nenhum anuncio, nenhum botao de video - e a versao para
 * hospedar em qualquer lugar, ou para levar a outro portal depois. `app` e o
 * jogo empacotado pelo Capacitor para Android e iOS, com AdMob, Firebase e a
 * compra que tira os anuncios (src/app/). `crazy` e a CrazyGames, com o SDK v3
 * deles, o save na nuvem pelo modulo Data e o idioma do site (src/crazy/).
 * Os portais de distribuicao (`y8`, `playgama`, `yandex`, `gamemonetize`,
 * `gamedistribution`, `gamepix`) tem cada um o SDK dele (src/portais/).
 *
 * O valor entra por `VITE_PLATAFORMA` no build. O Vite troca a expressao por
 * uma constante literal, entao o ramo que nao vale para o alvo sai do bundle.
 * Fora do build (dev) o padrao e `poki`, que e o alvo principal.
 *
 * A mesma lista mora em vite.config.js, que decide a pasta de saida e para
 * onde aponta o `@plataforma`. Valor desconhecido vira `poki` nos dois.
 */
const ALVO = import.meta.env.VITE_PLATAFORMA;

/**
 * Os portais de distribuicao: a mesma lista de vite.config.js. Comparacoes
 * soltas, e nao `lista.includes(ALVO)`: com o literal no lugar de ALVO o
 * Rollup resolve cada uma no build, e o ramo do app (NO_APP) sai do bundle.
 */
const PORTAL =
  ALVO === 'y8' ||
  ALVO === 'playgama' ||
  ALVO === 'yandex' ||
  ALVO === 'gamemonetize' ||
  ALVO === 'gamedistribution' ||
  ALVO === 'gamepix';

export const PLATAFORMA = ALVO === 'lisa' || ALVO === 'app' || ALVO === 'crazy' || PORTAL ? ALVO : 'poki';

/**
 * Ha video recompensado? A versao lisa nao tem anuncio nenhum, e a
 * GameMonetize so tem o intersticial: nas duas os botoes de video somem e o
 * caminho gratuito fica no lugar.
 */
export const COM_ANUNCIOS = PLATAFORMA !== 'lisa' && PLATAFORMA !== 'gamemonetize';

/** O jogo esta empacotado como app (Android/iOS)? */
export const NO_APP = PLATAFORMA === 'app';

/** O jogo esta na CrazyGames? */
export const NA_CRAZY = PLATAFORMA === 'crazy';

/** O jogo esta num dos portais de distribuicao (src/portais/)? */
export const NUM_PORTAL = PORTAL;
