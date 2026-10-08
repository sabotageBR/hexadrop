/**
 * Entrada do build `app` (vite.config.js troca o main.js do index.html por este).
 *
 * O save volta do Preferences antes de qualquer modulo do jogo ser avaliado -
 * o idioma (core/i18n.js) e o som (core/audio.js) sao lidos do storage na
 * avaliacao, e o progresso no construtor do Game. Por isso main.js entra por
 * import dinamico, depois de `prepararSave()`.
 *
 * A splash nativa fica de pe ate o jogo dizer que carregou
 * (`gameLoadingFinished` em src/app/nativo.js). Se o boot quebrar antes disso,
 * o prazo daqui a tira de qualquer jeito: splash presa e app que nao abre.
 */

import { SplashScreen } from '@capacitor/splash-screen';
import { prepararSave } from './save.js';

const SPLASH_MAX_MS = 6000;

window.setTimeout(() => {
  SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
}, SPLASH_MAX_MS);

prepararSave()
  .catch(() => {})
  .then(() => import('../main.js'))
  .catch(() => {
    SplashScreen.hide().catch(() => {});
  });
