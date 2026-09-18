/**
 * Progresso do jogador.
 *
 * Coracoes "suaves": quando acabam, o jogador continua jogando normalmente e
 * so ganha metade das recompensas. Isso atende a regra da Poki que proibe
 * tanto espera obrigatoria quanto anuncio como condicao para progredir.
 */

import { load, save, isPersistent } from '../core/storage.js';
import { rankFromXp, upgradeEffects, UPGRADES, SKINS } from './content.js';

const BASE_HEARTS = 5;
/** Um coracao a cada dez minutos de relogio real. */
const HEART_REFILL_MS = 10 * 60 * 1000;
const SAVE_VERSION = 1;

/**
 * @typedef {object} SaveData
 * @property {number} v
 * @property {number} unlocked maior fase liberada, base 1
 * @property {Record<string, number>} stars estrelas por fase
 * @property {number} coins
 * @property {number} xp
 * @property {number} hearts
 * @property {number} heartsAt timestamp da ultima recarga contabilizada
 * @property {string} skin
 * @property {string[]} skins
 * @property {Record<string, number>} upgrades
 * @property {number} dailyAt
 * @property {number} plays
 */

/** @returns {SaveData} */
function blank() {
  return {
    v: SAVE_VERSION,
    unlocked: 1,
    stars: {},
    coins: 0,
    xp: 0,
    hearts: BASE_HEARTS,
    heartsAt: Date.now(),
    skin: 'classic',
    skins: ['classic'],
    upgrades: {},
    dailyAt: 0,
    plays: 0,
  };
}

export class Progress {
  constructor() {
    const stored = load('save', null);
    /** @type {SaveData} */
    this.data = stored && stored.v === SAVE_VERSION ? { ...blank(), ...stored } : blank();
    this.persistent = isPersistent();
    this.refreshHearts();
  }

  flush() {
    save('save', this.data);
  }

  // ------------------------------------------------------------- coracoes

  /** @returns {number} */
  get maxHearts() {
    return BASE_HEARTS + upgradeEffects(this.data.upgrades).extraHearts;
  }

  /** Converte tempo decorrido em coracoes recuperados. */
  refreshHearts() {
    const now = Date.now();
    const d = this.data;
    if (d.hearts >= this.maxHearts) {
      d.heartsAt = now;
      return;
    }
    if (!d.heartsAt || d.heartsAt > now) d.heartsAt = now;
    const gained = Math.floor((now - d.heartsAt) / HEART_REFILL_MS);
    if (gained > 0) {
      d.hearts = Math.min(this.maxHearts, d.hearts + gained);
      d.heartsAt = d.hearts >= this.maxHearts ? now : d.heartsAt + gained * HEART_REFILL_MS;
      this.flush();
    }
  }

  /** @returns {number} milissegundos ate o proximo coracao, 0 se cheio */
  msToNextHeart() {
    this.refreshHearts();
    if (this.data.hearts >= this.maxHearts) return 0;
    return Math.max(0, this.data.heartsAt + HEART_REFILL_MS - Date.now());
  }

  /** @returns {boolean} true se havia coracao para gastar */
  spendHeart() {
    this.refreshHearts();
    if (this.data.hearts <= 0) return false;
    if (this.data.hearts >= this.maxHearts) this.data.heartsAt = Date.now();
    this.data.hearts--;
    this.flush();
    return true;
  }

  refillHearts() {
    this.data.hearts = this.maxHearts;
    this.data.heartsAt = Date.now();
    this.flush();
  }

  /** @returns {boolean} recompensas pela metade quando sem coracoes */
  get depleted() {
    this.refreshHearts();
    return this.data.hearts <= 0;
  }

  // ------------------------------------------------------------- progresso

  /** @param {number} level base 1 @returns {number} */
  starsOf(level) {
    return this.data.stars[String(level)] || 0;
  }

  /** @param {number} level @returns {boolean} */
  isUnlocked(level) {
    return level <= this.data.unlocked;
  }

  /** @returns {number} soma de estrelas */
  get totalStars() {
    let sum = 0;
    for (const k of Object.keys(this.data.stars)) sum += this.data.stars[k];
    return sum;
  }

  /** @returns {number} */
  get rank() {
    return rankFromXp(this.data.xp);
  }

  /**
   * Registra o fim de uma fase.
   * @param {object} o
   * @param {number} o.level base 1
   * @param {number} o.stars 0 a 3
   * @param {boolean} o.won
   * @param {number} o.taps
   * @param {number} o.par
   * @returns {{coins:number, xp:number, halved:boolean, best:boolean, rankUp:boolean}}
   */
  finishLevel(o) {
    const d = this.data;
    d.plays++;
    const before = this.starsOf(o.level);
    const best = o.stars > before;
    if (best) d.stars[String(o.level)] = o.stars;

    if (o.stars >= 1 && o.level >= d.unlocked) {
      d.unlocked = Math.min(100, o.level + 1);
    }

    let coins = 0;
    let xp = 0;
    if (o.stars > 0) {
      coins = 6 + o.stars * 4 + Math.floor(o.level / 8);
      if (o.won && o.par > 0 && o.taps <= o.par) coins += 6;
      xp = 8 + o.stars * 5 + Math.floor(o.level / 5);
      if (best) coins += 4;
    }

    const halved = this.depleted;
    if (halved) {
      coins = Math.floor(coins / 2);
      xp = Math.floor(xp / 2);
    }
    coins = Math.round(coins * upgradeEffects(d.upgrades).coinMultiplier);

    const rankBefore = this.rank;
    d.coins += coins;
    d.xp += xp;
    const rankUp = this.rank > rankBefore;
    this.flush();
    return { coins, xp, halved, best, rankUp };
  }

  /** @param {number} amount */
  addCoins(amount) {
    this.data.coins += Math.max(0, Math.round(amount));
    this.flush();
  }

  // ------------------------------------------------------------- economia

  /** @param {number} cost @returns {boolean} */
  spendCoins(cost) {
    if (this.data.coins < cost) return false;
    this.data.coins -= cost;
    this.flush();
    return true;
  }

  /** @param {string} id @returns {boolean} */
  ownsSkin(id) {
    return this.data.skins.includes(id);
  }

  /** @param {string} id */
  grantSkin(id) {
    if (!this.ownsSkin(id)) {
      this.data.skins.push(id);
      this.flush();
    }
  }

  /** @param {string} id */
  equipSkin(id) {
    if (!this.ownsSkin(id)) return;
    this.data.skin = id;
    this.flush();
  }

  /** @param {string} id @returns {number} */
  upgradeLevel(id) {
    return this.data.upgrades[id] || 0;
  }

  /**
   * @param {string} id
   * @returns {{ok:boolean, cost:number}}
   */
  buyUpgrade(id) {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return { ok: false, cost: 0 };
    const lvl = this.upgradeLevel(id);
    if (lvl >= def.max) return { ok: false, cost: 0 };
    const cost = def.costs[lvl];
    if (!this.spendCoins(cost)) return { ok: false, cost };
    this.data.upgrades[id] = lvl + 1;
    this.flush();
    return { ok: true, cost };
  }

  /** @returns {boolean} bonus diario disponivel */
  get dailyReady() {
    const now = Date.now();
    return now - (this.data.dailyAt || 0) >= 20 * 60 * 60 * 1000;
  }

  claimDaily() {
    this.data.dailyAt = Date.now();
    this.flush();
  }

  /** @returns {*} skins visiveis na loja com o estado de cada uma */
  skinCatalog() {
    const rank = this.rank;
    return SKINS.map((s) => ({
      skin: s,
      owned: this.ownsSkin(s.id),
      equipped: this.data.skin === s.id,
      rankLocked: rank < s.rank,
      affordable: this.data.coins >= s.cost,
    }));
  }

  reset() {
    this.data = blank();
    this.flush();
  }
}
