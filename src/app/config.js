/**
 * Numeros e identificadores do app (Android/iOS). So entra no build `app`.
 *
 * Os IDs de anuncio sao de TESTE por padrao: os reais so entram com
 * `VITE_ANUNCIOS=producao`, que so o script de release passa. Clicar em anuncio
 * real durante o desenvolvimento e o jeito mais rapido de ter a conta da AdMob
 * suspensa por trafego invalido. O `verify:app` reprova o build de producao com
 * ID de teste dentro, ou com ID real vazio.
 */

export const PRODUCAO = import.meta.env.VITE_ANUNCIOS === 'producao';

/** Unidades de demonstracao da propria Google, que sempre servem anuncio de teste. */
const TESTE = {
  android: {
    intersticial: 'ca-app-pub-3940256099942544/1033173712',
    recompensado: 'ca-app-pub-3940256099942544/5224354917',
  },
  ios: {
    intersticial: 'ca-app-pub-3940256099942544/4411468910',
    recompensado: 'ca-app-pub-3940256099942544/1712485313',
  },
};

/**
 * Unidades reais, criadas no painel da AdMob (app "Hexa Drop"). Preencher antes
 * do primeiro build de producao; o ID do APP (com `~`) vai em
 * android/gradle.properties e no Info.plist, nao aqui.
 */
const REAL = {
  android: { intersticial: '', recompensado: '' },
  ios: { intersticial: '', recompensado: '' },
};

/**
 * @param {string} plataforma 'android' | 'ios' | outra
 * @returns {{intersticial:string, recompensado:string}}
 */
export function unidades(plataforma) {
  const so = plataforma === 'ios' ? 'ios' : 'android';
  return PRODUCAO ? REAL[so] : TESTE[so];
}

/**
 * Intervalo minimo entre dois anuncios de qualquer tipo, e desde a abertura do
 * app, para o intersticial. A Poki decide a frequencia por conta propria; a
 * AdMob nao, e mostrar a cada troca de fase seria um anuncio a cada ~17 s. O
 * funil da Poki mostra o jogador saindo pelo relogio (~0,3 por minuto), entao o
 * valor comeca alto e e para calibrar com o Firebase.
 */
export const INTERSTICIAL_INTERVALO_S = 120;

/**
 * Carencia depois de voltar do segundo plano. Os timers do fluxo (o "Quase!",
 * a transicao congelada) seguem correndo com o app escondido e chegam a troca
 * de fase logo na volta: sem isto o jogador reabriria o app direto num anuncio,
 * que a AdMob trata como anuncio de abertura disfarcado.
 */
export const CARENCIA_VOLTA_S = 20;

/** Quanto o botao de video espera o anuncio carregar, com o veu na tela. */
export const ESPERA_RECOMPENSADO_S = 8;

/** Produto nao consumivel que tira o intersticial. Mesmo id no Play e na App Store. */
export const PRODUTO_SEM_ANUNCIOS = 'remover_anuncios';
