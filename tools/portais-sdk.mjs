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

import { readFileSync } from 'node:fs';

const RAIZ = new URL('..', import.meta.url);

/**
 * O carregador oficial da GamePush (painel: Public Zone > Install Code), copiado
 * como o painel entrega, so com o projectId e o publicToken do jogo trocados.
 * Ele faz HEAD nos quatro CDNs do `atob` (gs.eponesh.com, s3.gamepush.com,
 * s3-eu.gamepush.com e gamepush.com), carrega o primeiro que responde e chama
 * `onGPInit(gp)`. O script classico de antes guarda o `gp` numa promessa: os
 * modulos do jogo rodam depois do SDK, e o callback tem de existir antes dele
 * (src/portais/gamepush.js espera `window.__gpPronto`).
 * @param {string} projectId
 * @param {string} publicToken
 * @returns {string}
 */
export function carregadorGamePush(projectId, publicToken) {
  return [
    '<script>window.__gpPronto = new Promise(function (ok) { window.onGPInit = ok; });</script>',
    '<script>',
    '((s,c,o,r,e)=>{var f=0,p=0,t={},a=r.map(()=>new AbortController),l=u=>{t[u]=1;var d=c.createElement(o);d.async=1;d.src=u+e;d.onerror=()=>{d.remove();n()};var g=c.getElementsByTagName(o)[0];g.parentNode.insertBefore(d,g)},n=()=>{var u=r.find(u=>!t[u]);u&&l(u)},j=u=>{if(f)return;f=1;a.forEach(x=>x.abort());u?l(u):n()},q=()=>{++p>=r.length&&j()};r.forEach((u,i)=>s.fetch(u,{method:"HEAD",signal:a[i].signal}).then(x=>x.ok?j(u):q()).catch(q));s.setTimeout(j,5000)})(window,document,"script",atob("aHR0cHM6Ly9ncy5lcG9uZXNoLmNvbS9zZGsvZ2FtZS1zY29yZS5qcyxodHRwczovL3MzLmdhbWVwdXNoLmNvbS9maWxlcy9ncy9zZGsvZ2FtZS1zY29yZS5qcyxodHRwczovL3MzLWV1LmdhbWVwdXNoLmNvbS9zZGsvZ2FtZS1zY29yZS5qcyxodHRwczovL2dhbWVwdXNoLmNvbS9zZGsvZ2FtZS1zY29yZS5qcw==").split(","),'
      + `"?projectId=${projectId}&publicToken=${publicToken}&callback=onGPInit");`,
    '</script>',
  ].join('\n');
}

/** Os ids do painel da GamePush (marketing/portais/ids.json): publicos, vao no HTML. */
export const IDS_GAMEPUSH = (() => {
  try {
    const ids = JSON.parse(readFileSync(new URL('marketing/portais/ids.json', RAIZ), 'utf8')).gamepush || {};
    return { projectId: String(ids.projectId || ''), publicToken: String(ids.publicToken || '') };
  } catch {
    return { projectId: '', publicToken: '' };
  }
})();

/**
 * A logo do jogo num lugar so (checklist da GamePush, regra da GameDistribution
 * e da Poki): fica a da tela inicial. Saem a dos cartoes de vitoria e de derrota
 * e o titulo em texto da tela de carregamento, que fica so com a barra. No HTML,
 * e nao no JS, para o titulo nem piscar antes de o adaptador carregar.
 */
const MARCA_UMA_VEZ = '<style>#loader .logo, .card-logo { display: none !important; }</style>';

/** Os quatro hosts do carregador oficial da GamePush (o `atob` dele). */
export const HOSTS_GAMEPUSH = ['gs.eponesh.com', 's3.gamepush.com', 's3-eu.gamepush.com', 'gamepush.com'];

/**
 * O LICENCAS.txt do build da GamePush: o de public/ e a licenca da Nunito, a
 * fonte cirilica que so este build leva (src/ui/fontes/nunito-cyrillic-900-normal.woff2).
 */
function licencasGamePush() {
  try {
    const base = readFileSync(new URL('public/LICENCAS.txt', RAIZ), 'utf8').replace(/\s*$/, '\n');
    const ofl = base.slice(base.indexOf('-----------------------------------------------------------\nSIL OPEN FONT LICENSE'));
    return (
      `${base}\n\n` +
      'Nunito (SIL Open Font License 1.1) - arquivo src/ui/fontes/nunito-cyrillic-900-normal.woff2\n' +
      '----------------------------------------------------------------------\n' +
      'Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito)\n' +
      'So o subconjunto cirilico (@fontsource/nunito 5.3.0), no grito da vitoria em russo.\n\n' +
      'This Font Software is licensed under the SIL Open Font License, Version 1.1.\n' +
      'The license is the same as the one copied above for Fredoka:\n\n' +
      ofl
    );
  } catch {
    return '';
  }
}

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
  gamepush: {
    nome: 'GamePush',
    // O carregador oficial do painel, com os ids de marketing/portais/ids.json,
    // e antes dele o onGPInit (src/portais/gamepush.js). E o build da itch com
    // o SDK da GamePush, os anuncios dela e o russo; ela publica em nome do
    // dono em varias plataformas, entao o zip nao cita nenhum outro portal.
    html: `${MARCA_UMA_VEZ}\n${carregadorGamePush(IDS_GAMEPUSH.projectId, IDS_GAMEPUSH.publicToken)}`,
    hosts: HOSTS_GAMEPUSH,
    dominios: /(^|\.)(gamepush\.com|eponesh\.com)$/,
    semMarcas: true,
    marca: /gamepush|eponesh/i,
    arquivos: { 'LICENCAS.txt': licencasGamePush() },
  },
};
