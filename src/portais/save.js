/**
 * O save dos portais que tem armazenamento proprio (Playgama: `bridge.storage`,
 * obrigatorio; GamePix: `GamePix.localStorage`, que sobrevive ao iframe no
 * celular), como src/crazy/save.js faz com o modulo Data da CrazyGames.
 *
 * O jogo continua gravando pelo core/storage.js. Aqui, uma vez, antes de
 * main.js ser avaliado (src/portais/inicio.js):
 *
 * 1. le do portal o que o jogo guardou;
 * 2. devolve ao localStorage o que falta nele, e o `save` quando o do portal e
 *    mais novo (`rev`);
 * 3. SO ENTAO liga o espelho: cada gravacao do jogo vai tambem para o portal;
 * 4. leva ao portal o que so o localStorage tinha.
 *
 * Nao ha conta de jogador como na CrazyGames, entao nao ha dono: o save do
 * portal e o do navegador sao do mesmo jogador.
 */

import { entradasLocais, hidratar, definirEspelho, PREFIXO } from '../core/storage.js';

/**
 * As chaves que o jogo grava (sem o prefixo), para o portal que precisa saber
 * o nome de cada uma. Chave nova no storage entra aqui e em src/crazy/save.js.
 */
export const CHAVES = ['save', 'sfxOn', 'musicOn', 'lang', 'quality'];

/**
 * @typedef {Object} Fonte
 * @property {(chave:string)=>string|null} getItem
 * @property {(chave:string, valor:string)=>void} setItem
 * @property {(chave:string)=>void} removeItem
 */

/**
 * @param {string|undefined} raw
 * @returns {number}
 */
function revDe(raw) {
  if (!raw) return -1;
  try {
    const d = JSON.parse(raw);
    return d && typeof d.rev === 'number' ? d.rev : 0;
  } catch {
    return -1;
  }
}

/**
 * O que volta do portal para o localStorage. Pura, para a automacao.
 * @param {Record<string, string>} local
 * @param {Record<string, string>} portal
 * @returns {Record<string, string>}
 */
export function oQueVolta(local, portal) {
  /** @type {Record<string, string>} */
  const volta = {};
  for (const [k, v] of Object.entries(portal)) {
    if (local[k] === v) continue;
    if (!(k in local)) volta[k] = v;
    else if (k === PREFIXO + 'save' && revDe(v) > revDe(local[k])) volta[k] = v;
  }
  return volta;
}

/**
 * @param {Fonte|null} fonte o armazenamento do portal, ja carregado
 */
export function prepararSave(fonte) {
  if (!fonte) return;
  const local = entradasLocais();
  /** @type {Record<string, string>} */
  const portal = {};
  try {
    for (const k of new Set([...CHAVES.map((c) => PREFIXO + c), ...Object.keys(local)])) {
      const v = fonte.getItem(k);
      if (typeof v === 'string') portal[k] = v;
    }
  } catch {
    // Sem ler o portal, nao liga o espelho: gravar por cima de um save que nao
    // foi lido apagaria o progresso que estava la.
    return;
  }
  hidratar(oQueVolta(local, portal));
  definirEspelho({
    gravar: (chave, raw) => {
      try {
        fonte.setItem(chave, raw);
      } catch {
        /* o local continua valendo */
      }
    },
    apagar: (chave) => {
      try {
        fonte.removeItem(chave);
      } catch {
        /* ignora */
      }
    },
  });
  for (const [k, v] of Object.entries(entradasLocais())) {
    if (portal[k] === v) continue;
    try {
      fonte.setItem(k, v);
    } catch {
      /* ignora */
    }
  }
}

/**
 * Uma `Fonte` sincrona por cima de um armazenamento assincrono (a Playgama):
 * tudo o que o jogo guardou vai numa chave so do portal, um JSON de chave ->
 * texto cru, carregado uma vez e gravado de volta `espera` ms depois da ultima
 * mudanca.
 * @param {Record<string, string>} inicial
 * @param {(tudo: Record<string, string>) => *} enviar
 * @param {number} [espera]
 * @returns {Fonte}
 */
export function fonteEmLote(inicial, enviar, espera = 1200) {
  /** @type {Record<string, string>} */
  const mem = { ...inicial };
  let prazo = 0;
  const agenda = () => {
    window.clearTimeout(prazo);
    prazo = window.setTimeout(() => {
      try {
        Promise.resolve(enviar({ ...mem })).catch(() => {});
      } catch {
        /* ignora */
      }
    }, espera);
  };
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
    setItem: (k, v) => {
      mem[k] = String(v);
      agenda();
    },
    removeItem: (k) => {
      delete mem[k];
      agenda();
    },
  };
}
