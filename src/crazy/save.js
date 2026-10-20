/**
 * O save na nuvem da CrazyGames (modulo Data do SDK v3).
 *
 * A CrazyGames exige progresso salvo pelo SDK, e nao so no localStorage: "do
 * not depend on local saves". O modulo Data tem a interface do localStorage
 * (getItem, setItem, removeItem), guarda no proprio navegador para o visitante
 * e sincroniza entre aparelhos quem entra com conta - e quando o visitante
 * entra, o SDK passa o save dele para a conta (se a conta ainda nao tinha um) e
 * recarrega a pagina.
 *
 * O jogo continua lendo e gravando pelo core/storage.js, como nas outras
 * plataformas. Aqui, uma vez, antes de main.js ser avaliado:
 *
 * 1. le do Data as chaves do jogo;
 * 2. devolve ao localStorage o que manda: o Data, menos quando o save local e
 *    do MESMO jogador e mais novo (`rev`) - o Data grava com atraso de 1 a 30 s,
 *    e quem fecha a aba logo depois de uma fase voltaria com a fase de antes;
 * 3. SO ENTAO liga o espelho: cada gravacao do jogo vai tambem para o Data;
 * 4. leva ao Data o que so o localStorage tinha.
 *
 * "O mesmo jogador" e o dono gravado na chave `crazyDono`, que fica so no
 * localStorage: o id da conta, ou `visitante`. Sem ela, entrar com uma conta
 * que ja tinha progresso em outro aparelho deixaria o save do visitante (que
 * pode ter `rev` maior, de tanto rejogar o comeco) por cima do da conta.
 */

import { entradasLocais, hidratar, definirEspelho, load, save, remove, PREFIXO } from '../core/storage.js';

/**
 * As chaves que o jogo grava (sem o prefixo). O Data nao lista as proprias
 * chaves, entao quem le precisa saber o nome de cada uma; as que estiverem no
 * localStorage entram tambem.
 */
const CHAVES = ['save', 'sfxOn', 'musicOn', 'lang', 'quality'];

/** Dono do save local. So no localStorage: nunca vai para o Data. */
const DONO = 'crazyDono';

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
 * Decide o que volta do Data para o localStorage. Pura, para a automacao.
 *
 * Do mesmo dono, o Data so cobre o que falta no local, e o `save` quando o dele
 * e mais novo. De outro dono (entrou ou saiu de uma conta), o Data manda em
 * tudo o que tem, e o save local que o Data nao tem e apagado (`null`): e o
 * progresso de outra pessoa. Preferencia (som, idioma, qualidade) que so o
 * aparelho tem fica.
 * @param {Record<string, string>} local
 * @param {Record<string, string>} nuvem
 * @param {boolean} mesmoDono
 * @returns {Record<string, string|null>}
 */
export function oQueVolta(local, nuvem, mesmoDono) {
  /** @type {Record<string, string|null>} */
  const volta = {};
  const chaveSave = PREFIXO + 'save';
  for (const [k, v] of Object.entries(nuvem)) {
    if (local[k] === v) continue;
    if (!(k in local) || !mesmoDono) volta[k] = v;
    else if (k === chaveSave && revDe(v) > revDe(local[k])) volta[k] = v;
  }
  if (!mesmoDono && chaveSave in local && !(chaveSave in nuvem)) volta[chaveSave] = null;
  return volta;
}

/**
 * @param {*} sdk
 * @returns {Promise<string>}
 */
async function donoDe(sdk) {
  try {
    if (!sdk.user || !sdk.user.isUserAccountAvailable) return 'visitante';
    const user = await Promise.race([
      sdk.user.getUser(),
      new Promise((resolve) => window.setTimeout(() => resolve(null), 1500)),
    ]);
    const id = user && (user.__dangerousUserId || user.username);
    return id ? `conta:${id}` : 'visitante';
  } catch {
    return 'visitante';
  }
}

/**
 * @param {*} sdk o SDK ja iniciado (src/crazy/sdk.js), ou null
 * @returns {Promise<void>} nunca rejeita
 */
export async function prepararSave(sdk) {
  const data = sdk && sdk.data;
  if (!data || typeof data.getItem !== 'function') return;
  const local = entradasLocais();
  const chaveDono = PREFIXO + DONO;
  delete local[chaveDono];
  /** @type {Record<string, string>} */
  const nuvem = {};
  try {
    for (const k of new Set([...CHAVES.map((c) => PREFIXO + c), ...Object.keys(local)])) {
      const v = data.getItem(k);
      if (typeof v === 'string') nuvem[k] = v;
    }
  } catch {
    // Sem conseguir ler o Data (o modulo desligado no envio, `dataModuleDisabled`),
    // a sessao nao liga o espelho: gravar por cima de um Data que nao foi lido
    // apagaria o progresso que estava la.
    return;
  }
  const dono = await donoDe(sdk);
  const donoLocal = load(DONO, null);
  // Sem dono gravado e o primeiro boot com o Data: o que esta no localStorage e
  // de quem esta jogando, e vai para a nuvem pela migracao do passo 4.
  const mesmoDono = donoLocal === null || donoLocal === dono;
  const volta = oQueVolta(local, nuvem, mesmoDono);
  /** @type {Record<string, string>} */
  const grava = {};
  for (const [k, v] of Object.entries(volta)) {
    if (v === null) remove(k.slice(PREFIXO.length));
    else grava[k] = v;
  }
  hidratar(grava);
  save(DONO, dono);
  definirEspelho({
    gravar: (chave, raw) => {
      if (chave === chaveDono) return;
      try {
        data.setItem(chave, raw);
      } catch {
        /* acima de 1 MB o Data recusa; o local continua valendo */
      }
    },
    apagar: (chave) => {
      try {
        data.removeItem(chave);
      } catch {
        /* ignora */
      }
    },
  });
  for (const [k, v] of Object.entries(entradasLocais())) {
    if (k === chaveDono || nuvem[k] === v) continue;
    try {
      data.setItem(k, v);
    } catch {
      /* ignora */
    }
  }
}
