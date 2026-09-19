/**
 * Progresso do jogador.
 *
 * Coracoes "suaves": quando acabam, o jogador continua jogando normalmente e
 * so ganha metade das recompensas. Isso atende a regra da Poki que proibe
 * tanto espera obrigatoria quanto anuncio como condicao para progredir.
 */

import { load, save, isPersistent } from '../core/storage.js';
import { LEVEL_COUNT } from './levelgen.js';
import {
  rankFromXp, upgradeEffects, UPGRADES, SKINS, BOOSTS, boost as getBoost, gateStars,
  BONUS_COINS_PER_PIECE, BONUS_XP_PER_PIECE,
} from './content.js';

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
 * @property {Record<string, number>} boosts consumiveis restantes, por id
 * @property {number[]} gatesSeen mundos cuja abertura ja foi encenada
 * @property {number[]} skipped fases passadas por video, sem estrela
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
    boosts: Object.fromEntries(BOOSTS.map((b) => [b.id, b.inicial])),
    gatesSeen: [],
    skipped: [],
    dailyAt: 0,
    plays: 0,
  };
}

export class Progress {
  constructor() {
    const stored = load('save', null);
    /** @type {SaveData} */
    this.data = stored && stored.v === SAVE_VERSION ? { ...blank(), ...stored } : blank();
    // Toda skin gratuita e sem patente pertence a todo mundo, inclusive a quem
    // ja jogava antes de ela existir. Sem isto, um save antigo nao consegue
    // equipar a skin inicial nova.
    for (const s of SKINS) {
      if (s.cost === 0 && s.rank === 0 && !this.data.skins.includes(s.id)) {
        this.data.skins.push(s.id);
      }
    }
    for (const b of BOOSTS) {
      if (this.data.boosts[b.id] === undefined) this.data.boosts[b.id] = b.inicial;
    }
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
    if (level > this.data.unlocked) return false;
    return this.worldOpen(Math.floor((level - 1) / 10));
  }

  /**
   * Um mundo abre quando o jogador acumulou estrelas suficientes no total.
   *
   * O criterio e acumulado e nao por mundo de proposito: pular uma fase com
   * video nao grava estrela nenhuma, entao o portao seguinte fica fechado e o
   * jogador precisa voltar e melhorar alguma fase. E o que torna o "volte e
   * preencha as estrelas" uma regra e nao um pedido.
   *
   * @param {number} world 0 a 9
   * @returns {boolean}
   */
  worldOpen(world) {
    return this.totalStars >= gateStars(world);
  }

  /**
   * Mundos que acabaram de abrir e cuja animacao ainda nao rodou.
   *
   * Fica no save porque a abertura e encenada uma vez so: reanimar o portao a
   * cada visita ao mapa transformaria a recompensa em ruido.
   *
   * @returns {number[]}
   */
  freshlyOpenedWorlds() {
    /** @type {number[]} */
    const out = [];
    for (let w = 1; w < 10; w++) {
      if (this.worldOpen(w) && !this.data.gatesSeen.includes(w)) out.push(w);
    }
    return out;
  }

  /** @param {number} w */
  markGateSeen(w) {
    if (!this.data.gatesSeen.includes(w)) {
      this.data.gatesSeen.push(w);
      this.flush();
    }
  }

  /**
   * Quantas estrelas ainda faltam para abrir um mundo.
   * @param {number} world
   * @returns {number}
   */
  starsToOpen(world) {
    return Math.max(0, gateStars(world) - this.totalStars);
  }

  /**
   * Fases ja jogadas que ainda tem estrela sobrando, da mais barata para a mais
   * cara. E a lista que o portao mostra: "volte aqui".
   * @param {number} [limit]
   * @returns {{level:number, stars:number}[]}
   */
  refillCandidates(limit = 3) {
    /** @type {{level:number, stars:number}[]} */
    const out = [];
    for (let lvl = 1; lvl < this.data.unlocked; lvl++) {
      const st = this.starsOf(lvl);
      if (st < 3) out.push({ level: lvl, stars: st });
    }
    out.sort((a, b) => b.stars - a.stars || a.level - b.level);
    return out.slice(0, limit);
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
   * @param {number} [o.bonusPieces] pecas que sobraram e estouraram na celebracao
   * @param {number} [o.comboScore] soma de n^2 dos combos da fase
   * @param {number} [o.comboPieces] soma de n dos combos da fase
   * @returns {{coins:number, xp:number, bonusCoins:number, bonusXp:number,
   *   halved:boolean, best:boolean, rankUp:boolean}}
   */
  finishLevel(o) {
    const d = this.data;
    d.plays++;
    const before = this.starsOf(o.level);
    const best = o.stars > before;
    if (best) d.stars[String(o.level)] = o.stars;

    if (o.stars >= 1 && o.level >= d.unlocked) {
      d.unlocked = Math.min(LEVEL_COUNT, o.level + 1);
    }

    let coins = 0;
    let xp = 0;
    if (o.stars > 0) {
      coins = 6 + o.stars * 4 + Math.floor(o.level / 8);
      if (o.won && o.par > 0 && o.taps <= o.par) coins += 6;
      xp = 8 + o.stars * 5 + Math.floor(o.level / 5);
      if (best) coins += 4;
    }

    // Perica: cada peca que o jogador NAO precisou gastar rende, e cada combo
    // rende pelo quadrado do tamanho. E o que faz "sobrou peca" virar meta em
    // vez de sobra. Nao toca em estrela nenhuma - os portoes de mundo continuam
    // pedindo exatamente o que pediam antes.
    const bonusPieces = Math.max(0, o.bonusPieces || 0);
    const comboScore = Math.max(0, o.comboScore || 0);
    const comboPieces = Math.max(0, o.comboPieces || 0);
    let bonusCoins = 0;
    let bonusXp = 0;
    if (o.stars > 0) {
      bonusCoins = bonusPieces * BONUS_COINS_PER_PIECE + comboScore;
      bonusXp = bonusPieces * BONUS_XP_PER_PIECE + comboPieces;
    }

    const halved = this.depleted;
    if (halved) {
      coins = Math.floor(coins / 2);
      xp = Math.floor(xp / 2);
      bonusCoins = Math.floor(bonusCoins / 2);
      bonusXp = Math.floor(bonusXp / 2);
    }
    const mult = upgradeEffects(d.upgrades).coinMultiplier;
    coins = Math.round(coins * mult);
    bonusCoins = Math.round(bonusCoins * mult);

    const rankBefore = this.rank;
    d.coins += coins + bonusCoins;
    d.xp += xp + bonusXp;
    const rankUp = this.rank > rankBefore;
    this.flush();
    return { coins, xp, bonusCoins, bonusXp, halved, best, rankUp };
  }

  /**
   * Marca uma fase como passada por video.
   *
   * Nao grava estrela, e e essa a razao de existir: o mapa precisa distinguir
   * "pulei" de "nunca joguei", e o portao seguinte continua cobrando as
   * estrelas que essa fase nao deu.
   *
   * @param {number} level
   */
  markSkipped(level) {
    if (!Array.isArray(this.data.skipped)) this.data.skipped = [];
    if (!this.data.skipped.includes(level)) {
      this.data.skipped.push(level);
      this.flush();
    }
  }

  /** @param {number} level @returns {boolean} */
  wasSkipped(level) {
    return Array.isArray(this.data.skipped) && this.data.skipped.includes(level);
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

  // ------------------------------------------------------------ consumiveis

  /** @param {string} id @returns {number} */
  boostCount(id) {
    return Math.max(0, this.data.boosts[id] || 0);
  }

  /**
   * Gasta um consumivel. Devolve false quando nao ha nenhum, e nesse caso a UI
   * e que decide o que oferecer - nunca uma espera obrigatoria.
   * @param {string} id
   * @returns {boolean}
   */
  spendBoost(id) {
    if (this.boostCount(id) <= 0) return false;
    this.data.boosts[id] = this.boostCount(id) - 1;
    this.flush();
    return true;
  }

  /** @param {string} id @param {number} n */
  addBoost(id, n) {
    this.data.boosts[id] = this.boostCount(id) + Math.max(0, Math.round(n));
    this.flush();
  }

  /**
   * @param {string} id
   * @returns {{ok:boolean, cost:number}}
   */
  buyBoost(id) {
    const def = getBoost(id);
    if (!def) return { ok: false, cost: 0 };
    if (!this.spendCoins(def.custo)) return { ok: false, cost: def.custo };
    this.addBoost(id, def.pacote);
    return { ok: true, cost: def.custo };
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
