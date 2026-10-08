/**
 * No lugar de `firebase/analytics` no build `app` (alias em vite.config.js).
 *
 * A implementacao web do @capacitor-firebase/analytics importa o SDK web do
 * Firebase, que o app nunca usa: no aparelho quem fala e o SDK nativo, e no
 * navegador local a telemetria vai para o backend simulado (src/app/simulado.js).
 * Sem este desvio o build nao resolve o import, ou empacota o SDK web inteiro,
 * com as URLs do Google que o verify-build reprova.
 */

const nada = () => {};

export const getAnalytics = () => ({});
export const logEvent = nada;
export const setAnalyticsCollectionEnabled = nada;
export const setConsent = nada;
export const setUserId = nada;
export const setUserProperties = nada;
export const setCurrentScreen = nada;
export const setDefaultEventParameters = nada;
export const isSupported = () => Promise.resolve(false);
export const getGoogleAnalyticsClientId = () => Promise.resolve('');
