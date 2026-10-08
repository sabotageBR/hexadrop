/**
 * Copia do save no Preferences do Capacitor.
 *
 * No iOS o sistema pode limpar o localStorage do WebView quando falta espaco, e
 * o progresso do jogador vive ali. O Preferences (UserDefaults no iOS,
 * SharedPreferences no Android) e armazenamento do app, e o sistema nao mexe.
 *
 * O localStorage continua sendo o armazenamento do jogo - core/storage.js e o
 * unico modulo que toca nele -, e a copia so volta quando faz falta:
 *
 * 1. le a copia inteira;
 * 2. devolve ao localStorage as chaves que sumiram dele, e o `save` quando o da
 *    copia tem `rev` maior (o Chromium grava o localStorage em disco com atraso:
 *    morto logo depois de uma fase, o app pode voltar com o save mais velho);
 * 3. SO ENTAO liga o espelho. Ligado antes, o save novo de um Progress vazio
 *    sobrescreveria a copia que ia salvar o progresso.
 *
 * Tem que rodar antes de main.js ser avaliado (src/app/inicio.js): o idioma e o
 * som sao lidos do storage na avaliacao dos modulos.
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { entradasLocais, hidratar, definirEspelho, PREFIXO } from '../core/storage.js';

/** Prazo da leitura da copia. Estourado, a sessao segue sem copia nenhuma. */
const PRAZO_MS = 1500;

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

/** @returns {Promise<Record<string, string>>} */
async function lerCopia() {
  const { keys } = await Preferences.keys();
  /** @type {Record<string, string>} */
  const out = {};
  for (const k of keys) {
    if (!k.startsWith(PREFIXO)) continue;
    const { value } = await Preferences.get({ key: k });
    if (typeof value === 'string') out[k] = value;
  }
  return out;
}

/**
 * Decide o que volta da copia para o localStorage. Pura, para a automacao.
 * @param {Record<string, string>} local
 * @param {Record<string, string>} copia
 * @returns {Record<string, string>}
 */
export function oQueVolta(local, copia) {
  /** @type {Record<string, string>} */
  const volta = {};
  for (const [k, v] of Object.entries(copia)) {
    if (!(k in local)) volta[k] = v;
    else if (k === PREFIXO + 'save' && revDe(v) > revDe(local[k])) volta[k] = v;
  }
  return volta;
}

/** @returns {Promise<void>} nunca rejeita */
export async function prepararSave() {
  // Fora do aparelho o Preferences e o proprio localStorage: copiar nele mesmo
  // so duplicaria as chaves (e o verify-build reprova localStorage sem catch).
  if (!Capacitor.isNativePlatform()) return;
  /** @type {Record<string, string>|null} */
  let copia = null;
  try {
    copia = await Promise.race([
      lerCopia(),
      new Promise((resolve) => window.setTimeout(() => resolve(null), PRAZO_MS)),
    ]);
  } catch {
    copia = null;
  }
  // Sem conseguir ler a copia, a sessao nao liga o espelho: se o localStorage
  // tiver sido limpo, o save novo desta sessao apagaria a copia boa.
  if (!copia) return;
  hidratar(oQueVolta(entradasLocais(), copia));
  definirEspelho({
    gravar: (chave, raw) => {
      Preferences.set({ key: chave, value: raw }).catch(() => {});
    },
    apagar: (chave) => {
      Preferences.remove({ key: chave }).catch(() => {});
    },
  });
  // Primeira abertura com o espelho, ou chave que a copia nao tinha.
  for (const [k, v] of Object.entries(entradasLocais())) {
    if (copia[k] !== v) Preferences.set({ key: k, value: v }).catch(() => {});
  }
}
