/**
 * Armazenamento com fallback em memoria.
 * A Poki exige que o jogo continue jogavel em janela anonima, onde
 * localStorage pode lancar excecao em qualquer acesso.
 */

const PREFIX = 'hexadrop.';

/** @type {Map<string, string>} */
const memory = new Map();

/**
 * Copia de cada gravacao em outro lugar. So o app liga (src/app/save.js), com o
 * Preferences do Capacitor: no iOS o sistema pode limpar o localStorage do
 * WebView quando falta espaco. Recebe a chave completa, com o prefixo.
 * @type {null|{gravar:(chave:string, raw:string)=>void, apagar:(chave:string)=>void}}
 */
let espelho = null;

let available = false;
try {
  const probe = PREFIX + '__probe';
  window.localStorage.setItem(probe, '1');
  window.localStorage.removeItem(probe);
  available = true;
} catch {
  available = false;
}

/** @returns {boolean} */
export function isPersistent() {
  return available;
}

/**
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
export function load(key, fallback) {
  const full = PREFIX + key;
  let raw = null;
  if (available) {
    try {
      raw = window.localStorage.getItem(full);
    } catch {
      raw = null;
    }
  }
  if (raw === null && memory.has(full)) raw = memory.get(full);
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
  if (!available) return;
  try {
    window.localStorage.setItem(full, raw);
  } catch {
    available = false;
  }
}

/** @param {string} key */
export function remove(key) {
  const full = PREFIX + key;
  memory.delete(full);
  if (espelho) espelho.apagar(full);
  if (!available) return;
  try {
    window.localStorage.removeItem(full);
  } catch {
    /* ignora */
  }
}

/**
 * Tudo o que o jogo guardou, como chave completa -> texto cru.
 * @returns {Record<string, string>}
 */
export function entradasLocais() {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of memory) out[k] = v;
  if (!available) return out;
  try {
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      const v = ls.getItem(k);
      if (v !== null) out[k] = v;
    }
  } catch {
    /* fica com o que estava em memoria */
  }
  return out;
}

/**
 * Grava entradas cruas sem passar pelo espelho: e o caminho de volta da copia.
 * Chave de fora do prefixo do jogo e ignorada.
 * @param {Record<string, string>} entradas chave completa -> texto cru
 */
export function hidratar(entradas) {
  for (const [k, v] of Object.entries(entradas)) {
    if (!k.startsWith(PREFIX) || typeof v !== 'string') continue;
    memory.set(k, v);
    if (!available) continue;
    try {
      window.localStorage.setItem(k, v);
    } catch {
      available = false;
    }
  }
}

/**
 * Liga (ou desliga, com null) a copia de cada gravacao. Quem liga tem que ter
 * hidratado antes: ligado cedo, o save novo de um Progress vazio sobrescreveria
 * a copia que ia salvar o progresso.
 * @param {null|{gravar:(chave:string, raw:string)=>void, apagar:(chave:string)=>void}} e
 */
export function definirEspelho(e) {
  espelho = e;
}

export const PREFIXO = PREFIX;
