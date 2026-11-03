/**
 * O storage do build da Playgama, no lugar de src/core/storage.js (o plugin
 * `soNaPlaygama` do vite.config.js troca o import so neste build).
 *
 * Requisito 3.2.1 da Playgama (wiki.playgama.com/playgama/game-requirements,
 * de 2026-10-30): o progresso so passa pelo storage do Bridge, e o jogo nunca
 * toca o armazenamento do navegador. Entao aqui so ha a memoria da sessao:
 * src/portais/save.js a hidrata com o que o Bridge guardou, antes de main.js, e
 * liga o espelho, que leva cada gravacao ao Bridge (fonteEmLote junta tudo numa
 * chave e grava 1,2 s depois da ultima mudanca). Sem o Bridge, nada persiste.
 *
 * A interface e a do src/core/storage.js.
 */

const PREFIX = 'hexadrop.';

/** @type {Map<string, string>} */
const memory = new Map();

/** @type {null|{gravar:(chave:string, raw:string)=>void, apagar:(chave:string)=>void}} */
let espelho = null;

/**
 * Persiste so com o espelho do Bridge ligado (o aviso "progresso nao salvo"
 * das opcoes depende disso).
 * @returns {boolean}
 */
export function isPersistent() {
  return espelho !== null;
}

/**
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
export function load(key, fallback) {
  const raw = memory.get(PREFIX + key);
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {*} value
 */
export function save(key, value) {
  const full = PREFIX + key;
  let raw;
  try {
    raw = JSON.stringify(value);
  } catch {
    return;
  }
  memory.set(full, raw);
  if (espelho) espelho.gravar(full, raw);
}

/** @param {string} key */
export function remove(key) {
  const full = PREFIX + key;
  memory.delete(full);
  if (espelho) espelho.apagar(full);
}

/**
 * Tudo o que o jogo guardou, como chave completa -> texto cru.
 * @returns {Record<string, string>}
 */
export function entradasLocais() {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of memory) out[k] = v;
  return out;
}

/**
 * Grava entradas cruas sem passar pelo espelho: e o caminho de volta do Bridge.
 * Chave de fora do prefixo do jogo e ignorada.
 * @param {Record<string, string>} entradas chave completa -> texto cru
 */
export function hidratar(entradas) {
  for (const [k, v] of Object.entries(entradas)) {
    if (k.startsWith(PREFIX) && typeof v === 'string') memory.set(k, v);
  }
}

/**
 * Liga (ou desliga, com null) a copia de cada gravacao no Bridge. Quem liga
 * tem que ter hidratado antes.
 * @param {null|{gravar:(chave:string, raw:string)=>void, apagar:(chave:string)=>void}} e
 */
export function definirEspelho(e) {
  espelho = e;
}

export const PREFIXO = PREFIX;
