/**
 * Os ids que o painel do portal da ao jogo (GameDistribution e GameMonetize:
 * `gameId`; Y8: `appId` e `gameId`). Moram em marketing/portais/ids.json e
 * entram no build por vite.config.js (`define`); sem eles o SDK do portal nem
 * e carregado e o build sai so para teste.
 * @type {Record<string, string>}
 */
export const IDS = import.meta.env.VITE_PORTAL_IDS || {};
