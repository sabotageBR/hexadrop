/**
 * Plataforma alvo do build.
 *
 * `poki` (padrao) carrega o SDK da Poki, mostra intervalos comerciais e oferece
 * os videos recompensados opcionais. `lisa` nao tem plataforma nenhuma: nenhum
 * script de fora, nenhum anuncio, nenhum botao de video - e a versao para
 * hospedar em qualquer lugar, ou para levar a outro portal depois. `app` e o
 * jogo empacotado pelo Capacitor para Android e iOS, com AdMob, Firebase e a
 * compra que tira os anuncios (src/app/).
 *
 * O valor entra por `VITE_PLATAFORMA` no build. O Vite troca a expressao por
 * uma constante literal, entao o ramo que nao vale para o alvo sai do bundle.
 * Fora do build (dev) o padrao e `poki`, que e o alvo principal.
 *
 * A mesma lista mora em vite.config.js, que decide a pasta de saida e para
 * onde aponta o `@plataforma`. Valor desconhecido vira `poki` nos dois.
 */
const ALVO = import.meta.env.VITE_PLATAFORMA;

export const PLATAFORMA = ALVO === 'lisa' ? 'lisa' : ALVO === 'app' ? 'app' : 'poki';

/** Ha plataforma para anuncio e video recompensado? */
export const COM_ANUNCIOS = PLATAFORMA !== 'lisa';

/** O jogo esta empacotado como app (Android/iOS)? */
export const NO_APP = PLATAFORMA === 'app';
