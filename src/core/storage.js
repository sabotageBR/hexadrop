/**
 * Armazenamento com fallback em memoria.
 * A Poki exige que o jogo continue jogavel em janela anonima, onde
 * localStorage pode lancar excecao em qualquer acesso.
 */

const PREFIX = 'hexadrop.';

/** @type {Map<string, string>} */
const memory = new Map();

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
  if (!available) return;
  try {
    window.localStorage.removeItem(full);
  } catch {
    /* ignora */
  }
}
