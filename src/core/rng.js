/**
 * Gerador pseudoaleatorio deterministico (mulberry32).
 * Usado tanto no gerador offline quanto no cliente, para que a mesma seed
 * produza exatamente o mesmo layout nos dois lugares.
 */

/** @param {string} str @returns {number} */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export class Rng {
  /** @param {number|string} seed */
  constructor(seed) {
    this.state = (typeof seed === 'string' ? hashSeed(seed) : seed >>> 0) || 1;
  }

  /** @returns {number} float em [0,1) */
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** @param {number} min @param {number} max @returns {number} float em [min,max) */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** @param {number} min @param {number} max @returns {number} inteiro em [min,max] */
  int(min, max) {
    return Math.floor(min + this.next() * (max - min + 1));
  }

  /** @param {number} p @returns {boolean} */
  chance(p) {
    return this.next() < p;
  }

  /** @template T @param {T[]} arr @returns {T} */
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /**
   * Escolha ponderada.
   * @template T
   * @param {T[]} items
   * @param {number[]} weights
   * @returns {T}
   */
  weighted(items, weights) {
    let total = 0;
    for (let i = 0; i < items.length; i++) total += weights[i] || 0;
    if (total <= 0) return items[0];
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i] || 0;
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /** @template T @param {T[]} arr @returns {T[]} embaralha no lugar e devolve */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
}
