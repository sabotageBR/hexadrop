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
 * `gamedistribution`, `gamepix`, `wavedash`) tem cada um o SDK dele
 * (src/portais/). A Wavedash injeta o dela e nao tem anuncio: a partir da
 * versao lisa, com o `Wavedash.init()` e a barra de carregamento. A `itch`
 * (itch.io) e o build da Wavedash sem SDK nenhum: sem anuncio, sem pacotes de
 * moedas e sem nuvem. A `gamepush` (GamePush) e o build da itch com o SDK da
 * GamePush, os anuncios dela e o russo (src/portais/gamepush.js).
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
  ALVO === 'gamepix' ||
  ALVO === 'wavedash' ||
  ALVO === 'itch' ||
  ALVO === 'gamepush';

export const PLATAFORMA = ALVO === 'lisa' || ALVO === 'app' || ALVO === 'crazy' || PORTAL ? ALVO : 'poki';

/**
 * Ha video recompensado? A versao lisa, a Wavedash e a itch nao tem anuncio
 * nenhum, e a GameMonetize so tem o intersticial: nas quatro os botoes de video
 * somem e o caminho gratuito fica no lugar. A ordem importa: o Rollup deixa no
 * bundle so a ultima comparacao, e com a GameMonetize por ultimo os outros
 * builds sairam byte a byte iguais quando a Wavedash e a itch entraram.
 */
export const COM_ANUNCIOS =
  PLATAFORMA !== 'lisa' && PLATAFORMA !== 'wavedash' && PLATAFORMA !== 'itch' && PLATAFORMA !== 'gamemonetize';

/** O jogo esta empacotado como app (Android/iOS)? */
export const NO_APP = PLATAFORMA === 'app';

/** O jogo esta na CrazyGames? */
export const NA_CRAZY = PLATAFORMA === 'crazy';

/** O jogo esta num dos portais de distribuicao (src/portais/)? */
export const NUM_PORTAL = PORTAL;

/**
 * Pacotes de moedas pagos (o Paid Content da Wavedash): a secao de moedas da
 * loja e o credito das compras (game/pacotes.js). Comparacao unica, para o
 * Rollup resolver no build: nos outros alvos todo ramo `if (COM_PACOTES)` sai
 * do bundle, e eles continuam byte a byte iguais.
 */
export const COM_PACOTES = PLATAFORMA === 'wavedash';

/**
 * O video premiado decidido na hora (a GamePush): o botao de video so aparece
 * com o SDK pronto e anuncio disponivel, conferido cada vez que o botao e
 * mostrado; sem isso fica o caminho gratuito da versao lisa, como na itch.
 * Nos outros builds o video e fixo (`COM_ANUNCIOS`). Comparacao unica, como
 * `COM_PACOTES`: fora da GamePush todo `VIDEO_NA_HORA ? ... : COM_ANUNCIOS` vira
 * `COM_ANUNCIOS` no build, e eles saem byte a byte iguais.
 */
export const VIDEO_NA_HORA = PLATAFORMA === 'gamepush';
