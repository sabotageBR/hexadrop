/**
 * O SDK de cada portal de distribuicao no HTML publicado, e os dominios que
 * esse SDK pode chamar. Quem le: vite.config.js (poe o `html` no lugar do
 * carregador da Poki) e tools/verify-build.mjs (o unico script de fora aceito
 * em cada build e os hosts que o proprio SDK chama, que nao sao do jogo).
 *
 * O codigo que fala com cada SDK mora em src/portais/<portal>.js.
 */

/**
 * @typedef {Object} SdkPortal
 * @property {string} nome      como o portal se escreve
 * @property {string} html      o que entra no <head> no lugar do SDK da Poki
 * @property {string[]} hosts   hosts aceitos nas URLs do build (o script do SDK)
 * @property {RegExp} dominios  o que o proprio SDK pode chamar em tempo de execucao
 * @property {Record<string, string>} [arquivos]  arquivos a mais na raiz do build
 * @property {boolean} [injetado]  o portal poe o SDK na pagina sozinho: nada no HTML
 * @property {boolean} [semSdk]    o portal nao tem SDK nenhum (a itch.io): nada no HTML nem no JS
 * @property {boolean} [semMarcas] nem o CSS cita outra plataforma (vite.config.js), e o
 *                                 verify-build reprova qualquer nome de outro portal
 * @property {RegExp} [marca]      como o nome do portal aparece no build de outro portal
 *                                 que nao pode cita-lo (`semMarcas`)
 */

/** @type {Record<string, SdkPortal>} */
export const PORTAIS = {
  y8: {
    nome: 'Y8',
    // Sempre do CDN deles, nunca copiado: o "2-0" fixa so a versao major.
    html: '<script src="https://cdn.y8.com/minimal-sdk/2-0/y8.min.js" async></script>',
    hosts: ['cdn.y8.com'],
    dominios: /(^|\.)(y8\.com|id\.net|googlesyndication\.com|google\.com|doubleclick\.net|gstatic\.com)$/,
  },
  playgama: {
    nome: 'Playgama',
    // O CDN do Bridge e o unico recurso de fora que o checklist deles aceita.
    html: '<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>',
    hosts: ['bridge.playgama.com'],
    dominios: /(^|\.)(playgama\.com|playgama\.net)$/,
    arquivos: {
      // Ao lado do index.html: sem ele o painel recusa o build. O intervalo
      // minimo entre intersticiais e o padrao deles, escrito para ficar claro.
      'playgama-bridge-config.json': `${JSON.stringify({ advertisement: { minimumDelayBetweenInterstitial: 60 } }, null, 2)}\n`,
    },
  },
  yandex: {
    nome: 'Yandex Games',
    // Relativo de proposito: o portal serve o SDK na raiz do dominio do jogo.
    html: '<script src="/sdk.js"></script>',
    hosts: [],
    dominios: /(^|\.)(yandex\.ru|yandex\.com|yandex\.net|yastatic\.net|yandex\.com\.tr)$/,
  },
  gamemonetize: {
    nome: 'GameMonetize',
    // Carregado por src/portais/gamemonetize.js, depois do SDK_OPTIONS.
    html: '',
    hosts: ['api.gamemonetize.com'],
    dominios: /(^|\.)(gamemonetize\.com|gamemonetize\.co)$/,
  },
  gamedistribution: {
    nome: 'GameDistribution',
    // Carregado por src/portais/gamedistribution.js, depois do GD_OPTIONS.
    html: '',
    hosts: ['html5.api.gamedistribution.com'],
    dominios: /(^|\.)(gamedistribution\.com)$/,
  },
  gamepix: {
    nome: 'GamePix',
    // O primeiro script do <head>, sem async, como a GamePix pede.
    html: '<script src="https://integration.gamepix.com/sdk/v3/gamepix.sdk.js"></script>',
    hosts: ['integration.gamepix.com'],
    dominios: /(^|\.)(gamepix\.com)$/,
  },
  wavedash: {
    nome: 'Wavedash',
    // A Wavedash injeta `window.Wavedash` antes de qualquer script do jogo, e
    // o jogo roda isolado (COEP require-corp): nenhum script nem URL de fora.
    html: '',
    hosts: [],
    dominios: /(^|\.)(wavedash\.com|wavedashcdn\.com)$/,
    injetado: true,
    semMarcas: true,
    marca: /wavedash/i,
  },
  itch: {
    nome: 'itch.io',
    // Jogo HTML na itch nao tem SDK, anuncio nem compra no jogo (so doacao pela
    // pagina): o build da Wavedash sem nada da Wavedash. Roda num iframe de
    // html-classic.itch.zone/html/<upload>/, numa subpasta (caminho relativo), e
    // essa origem e de todos os jogos HTML da itch (o storage so com o prefixo).
    html: '',
    hosts: [],
    dominios: /^$/,
    semSdk: true,
    semMarcas: true,
    marca: /itch\.io/i,
  },
};
