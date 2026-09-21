/**
 * Plataforma alvo do build.
 *
 * `poki` (padrao) carrega o SDK da Poki, mostra intervalos comerciais e oferece
 * os videos recompensados opcionais. `lisa` nao tem plataforma nenhuma: nenhum
 * script de fora, nenhum anuncio, nenhum botao de video - e a versao para
 * hospedar em qualquer lugar, ou para levar a outro portal depois.
 *
 * O valor entra por `VITE_PLATAFORMA` no build. O Vite troca a expressao por
 * uma constante literal, entao o ramo que nao vale para o alvo sai do bundle.
 * Fora do build (dev) o padrao e `poki`, que e o alvo principal.
 */
export const PLATAFORMA = import.meta.env.VITE_PLATAFORMA === 'lisa' ? 'lisa' : 'poki';

/** Ha plataforma para anuncio e video recompensado? */
export const COM_ANUNCIOS = PLATAFORMA === 'poki';
