/**
 * Progresso do jogador.
 *
 * Sem coracoes desde a 1.0.5. Eles eram "suaves" - acabando, o jogador seguia
 * jogando com metade do premio -, mas o efeito era invisivel (a homologacao ja
 * nao avisava que tinham acabado) e o contador era um segundo recurso ao lado
 * das moedas no HUD. A Poki pede economia simples, com uma moeda so, e
 * desaconselha os padroes de celular feitos para vender recarga.
 */

import { load, save, isPersistent } from '../core/storage.js';
import { LEVEL_COUNT, WORLD_COUNT, worldOf, worldStart, worldSize } from './levelgen.js';
import { rankFromXp, upgradeEffects, UPGRADES, SKINS, BOOSTS, boost as getBoost, gateStars, BONUS_COINS_PER_PIECE, BONUS_XP_PER_PIECE, CHUVA_COINS_PER_PIECE, barraDoMundo, worldPrize, prizeWorldOfSkin, skin as getSkin } from './content.js';
import { faseDeOrigem } from './alem.js';

/**
 * Progresso salvo de uma versao anterior e descartado quando este numero muda
 * (`stored.v === SAVE_VERSION` no construtor).
 *
 * Foi para 2 quando o mundo 1 voltou a ter dez fases: com `WORLD_SIZES`
 * diferente, a fase 21 deixou de ser a primeira do mundo 2 e passou a ser a
 * primeira do mundo 3, e um save antigo levaria o jogador para um mundo que
 * ele nunca abriu, com estrelas gravadas em fases de outro tema - e podia
 * trazer `unlocked` acima de `LEVEL_COUNT`.
 *
 * Foi para 3 quando o jogo passou a ter cem fases em mundos de cinco: o save
 * da versao anterior podia trazer `unlocked` ate 150 e estrelas nas fases 101
 * a 150, que inflariam o total e abririam portoes sem merito.
 *
 * A 1.0.8 NAO muda o numero: os premios de mundo (`prizes`) e as fases depois
 * da 100 (`alem`) entram por migracao no construtor. Trocar a versao apagaria
 * o progresso de todo mundo que ja jogou.
 */
const SAVE_VERSION = 3;

/**
 * @typedef {object} SaveData
 * @property {number} v
 * @property {number} unlocked maior fase liberada, base 1
 * @property {Record<string, number>} stars estrelas por fase
 * @property {number} coins
 * @property {number} xp
 * @property {string} skin
 * @property {string[]} skins
 * @property {Record<string, number>} upgrades
 * @property {Record<string, number>} boosts consumiveis restantes, por id
 * @property {number} mapaAte ultima fase cuja chegada o mapa ja animou
 * @property {number} dailyAt
 * @property {number} plays
 * @property {number} barraDe mundo (0-based) a que o contador da barra se refere; -1 = nenhum
 * @property {number} barraMoedas moedas ganhas no mundo `barraDe`, rumo ao hexagono da barra
 * @property {number[]} prizes mundos (0-based) cujo premio ja foi entregue
 * @property {number} alem proxima fase depois da 100 a jogar; 0 = ainda nao venceu a 100
 * @property {boolean} shopNews ha premio novo para ver na loja
 * @property {number} [rev] gravacoes ate aqui; no app decide entre o localStorage e a copia do Preferences (src/app/save.js)
 */

/**
 * @typedef {object} PrizeResult
 * @property {number} world mundo concluido, 0-based
 * @property {'skin'|'upgrade'|'coins'} kind
 * @property {string} [id] skin ou melhoria
 * @property {number} [level] nivel da melhoria depois do premio
 * @property {number} [coins] moedas, no bau ou no lugar de algo que o jogador ja tinha
 * @property {'chest'|'owned'|'max'} [why] por que vieram moedas
 */

/**
 * O hexagono que a barra de moedas comprou no fim de um mundo par.
 * @typedef {object} BarraResult
 * @property {number} world
 * @property {'skin'} kind
 * @property {string} id
 * @property {number} coins o preco pago
 * @property {'moedas'} via
 */

/** @returns {SaveData} */
function blank() {
  return {
    v: SAVE_VERSION,
    unlocked: 1,
    stars: {},
    coins: 0,
    xp: 0,
    skin: 'classic',
    skins: ['classic'],
    upgrades: {},
    boosts: Object.fromEntries(BOOSTS.map((b) => [b.id, b.inicial])),
    mapaAte: 0,
    dailyAt: 0,
    barraDe: -1,
    barraMoedas: 0,
    plays: 0,
    prizes: [],
    alem: 0,
    shopNews: false,
  };
}

export class Progress {
  constructor() {
    const stored = load('save', null);
    const valido = !!stored && stored.v === SAVE_VERSION;
    /** @type {SaveData} */
    this.data = valido ? { ...blank(), ...stored } : blank();
    /** Premios entregues pela migracao desta carga; a home avisa uma vez. @type {PrizeResult[]} */
    this.retroativos = [];
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
    // Os coracoes sairam do jogo. Quem comprou o "coracao extra" recebe as
    // moedas de volta, e os campos velhos somem do save.
    const extra = Math.max(0, this.data.upgrades.heart || 0);
    if (extra > 0) this.data.coins += [250, 700].slice(0, extra).reduce((a, b) => a + b, 0);
    delete this.data.upgrades.heart;
    delete (/** @type {*} */ (this.data)).hearts;
    delete (/** @type {*} */ (this.data)).heartsAt;
    // A barra da 1.0.13 guardava o mundo da ultima compra; a de agora guarda o
    // contador do mundo. O campo velho nao diz nada a regra nova.
    delete (/** @type {*} */ (this.data)).barraMundo;
    if (valido && !Array.isArray(stored.prizes)) this.migrarPremios();
    // Quem ja venceu a 100 antes de existir o depois dela comeca na 101, senao a
    // home continuaria oferecendo "Jogar 100".
    if (!this.data.alem && this.starsOf(LEVEL_COUNT) >= 1) this.data.alem = LEVEL_COUNT + 1;
    this.persistent = isPersistent();
  }

  /**
   * Save de antes dos premios de mundo: entrega, uma vez, o premio de cada
   * mundo que o jogador ja concluiu. Sem equipar - ele escolheu a skin que
   * esta usando -, e skin ja comprada vira as moedas que ela custou. As skins
   * antigas que ele tinha continuam dele (`retired` so as tira da loja).
   */
  migrarPremios() {
    const d = this.data;
    d.prizes = [];
    for (let w = 0; w < WORLD_COUNT; w++) {
      if (this.starsOf(worldStart(w) + worldSize(w)) < 1) continue;
      const r = this.claimWorldPrize(w, false, false);
      if (r) this.retroativos.push(r);
    }
    if (this.retroativos.length) d.shopNews = true;
    this.flush();
  }

  // ---------------------------------------------------------------- premios

  /** @param {number} world 0-based @returns {boolean} */
  prizeClaimed(world) {
    return Array.isArray(this.data.prizes) && this.data.prizes.includes(world);
  }

  /**
   * O que o premio do mundo daria AGORA, sem entregar nada: a skin que o
   * jogador ja tem vira moeda, a melhoria no maximo passa para a proxima.
   * @param {number} world 0-based
   * @returns {PrizeResult}
   */
  resolvePrize(world) {
    const p = worldPrize(world, WORLD_COUNT);
    if ('skin' in p) {
      if (!this.ownsSkin(p.skin)) return { world, kind: 'skin', id: p.skin };
      return { world, kind: 'coins', id: p.skin, coins: getSkin(p.skin).cost, why: 'owned' };
    }
    if ('upgrade' in p) {
      const ordem = [p.upgrade, ...UPGRADES.map((u) => u.id).filter((id) => id !== p.upgrade)];
      for (const id of ordem) {
        const def = UPGRADES.find((u) => u.id === id);
        const lvl = this.upgradeLevel(id);
        if (def && lvl < def.max) return { world, kind: 'upgrade', id, level: lvl + 1 };
      }
      const def = UPGRADES.find((u) => u.id === p.upgrade);
      const custo = def ? def.costs[def.costs.length - 1] : 300;
      return { world, kind: 'coins', id: p.upgrade, coins: custo, why: 'max' };
    }
    return { world, kind: 'coins', coins: p.coins, why: 'chest' };
  }

  /**
   * Entrega o premio de um mundo concluido, uma vez so.
   * @param {number} world 0-based
   * @param {boolean} [equip] skin nova ja equipada (no jogo corrido, sim)
   * @param {boolean} [gravar]
   * @returns {PrizeResult|null} null quando ja foi entregue
   */
  claimWorldPrize(world, equip = true, gravar = true) {
    const d = this.data;
    if (!Array.isArray(d.prizes)) d.prizes = [];
    if (d.prizes.includes(world)) return null;
    const r = this.resolvePrize(world);
    if (r.kind === 'skin' && r.id) {
      if (!d.skins.includes(r.id)) d.skins.push(r.id);
      if (equip) d.skin = r.id;
    } else if (r.kind === 'upgrade' && r.id) {
      d.upgrades[r.id] = r.level || this.upgradeLevel(r.id) + 1;
    } else {
      d.coins += Math.max(0, Math.round(r.coins || 0));
    }
    d.prizes.push(world);
    if (gravar) this.flush();
    return r;
  }

  /** O ponto no botao da loja foi visto. */
  clearShopNews() {
    if (!this.data.shopNews) return;
    this.data.shopNews = false;
    this.flush();
  }

  flush() {
    // No app o save tem uma copia no Preferences (src/app/save.js), e o
    // Chromium grava o localStorage em disco com atraso: morto logo depois de
    // uma fase, o app pode voltar com o localStorage mais velho que a copia.
    // Quem decide qual dos dois vale e este contador, que so cresce.
    this.data.rev = (this.data.rev || 0) + 1;
    save('save', this.data);
  }

  // ------------------------------------------------------------- progresso

  /**
   * Ninguem ainda: nenhuma fase liberada alem da primeira e nenhuma partida
   * contada. E quem entra jogando, sem passar pela tela inicial.
   *
   * O criterio olha `plays` alem de `unlocked` porque quem jogou a fase 1 e
   * perdeu continua com `unlocked` em 1 - e para ele a home ja e uma tela
   * conhecida, com o botao "Jogar 1" dizendo exatamente onde ele parou.
   *
   * @returns {boolean}
   */
  isNewcomer() {
    return this.data.unlocked <= 1 && !this.data.plays;
  }

  /** @param {number} level base 1 @returns {number} */
  starsOf(level) {
    return this.data.stars[String(level)] || 0;
  }

  /** @param {number} level @returns {boolean} */
  isUnlocked(level) {
    if (level > LEVEL_COUNT) return level <= (this.data.alem || 0);
    if (level > this.data.unlocked) return false;
    return this.worldOpen(worldOf(level - 1));
  }

  /**
   * Um mundo abre quando o jogador acumulou estrelas suficientes no total.
   *
   * O criterio e acumulado e nao por mundo de proposito: pular uma fase com
   * video nao grava estrela nenhuma, entao o portao seguinte fica fechado e o
   * jogador precisa voltar e melhorar alguma fase. E o que torna o "volte e
   * preencha as estrelas" uma regra e nao um pedido.
   *
   * @param {number} world 0 a WORLD_COUNT-1
   * @returns {boolean}
   */
  worldOpen(world) {
    return this.totalStars >= gateStars(world);
  }

  /**
   * O mapa ainda nao mostrou o jogador chegando nesta fase?
   *
   * A chegada e animada uma vez so, e por isso fica no save: reandar o mesmo
   * passo a cada visita ao mapa transformaria o avanco em ruido. So conta
   * avanco - voltar para rejogar uma fase antiga nao e chegar em lugar novo.
   *
   * @param {number} level 1-based
   * @returns {boolean}
   */
  mapStepPending(level) {
    return level > 1 && level > (this.data.mapaAte || 0);
  }

  /** @param {number} level 1-based */
  markMapStep(level) {
    if (level > (this.data.mapaAte || 0)) {
      this.data.mapaAte = level;
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
   * @returns {{coins:number, xp:number, bonusCoins:number, bonusXp:number, bonusPieces:number, chuvaPieces:number, best:boolean, rankUp:boolean, prize:PrizeResult|null, unlock:BarraResult|null}}
   */
  finishLevel(o) {
    const d = this.data;
    d.plays++;
    // Depois da 100 nao ha estrela gravada: o total de 300 e os portoes
    // continuam medindo a campanha, e `unlocked` continua com teto de 100.
    const alem = o.level > LEVEL_COUNT;
    const before = alem ? 0 : this.starsOf(o.level);
    const best = !alem && o.stars > before;
    if (best) d.stars[String(o.level)] = o.stars;

    if (!alem && o.stars >= 1 && o.level >= d.unlocked) {
      d.unlocked = Math.min(LEVEL_COUNT, o.level + 1);
    }
    if (o.stars >= 1 && o.level >= LEVEL_COUNT) d.alem = Math.max(d.alem || 0, o.level + 1);

    // A parcela que cresce com a fase para na 100: sem teto, a economia
    // inflaria sem fim no depois.
    const nivel = Math.min(o.level, LEVEL_COUNT);
    let coins = 0;
    let xp = 0;
    if (o.stars > 0) {
      coins = 6 + o.stars * 4 + Math.floor(nivel / 8);
      if (o.won && o.par > 0 && o.taps <= o.par) coins += 6;
      xp = 8 + o.stars * 5 + Math.floor(nivel / 5);
      if (best) coins += 4;
    }

    // Pericia: cada peca que o jogador NAO precisou gastar rende. E o que faz
    // "sobrou peca" virar meta em vez de sobra.
    const bonusPieces = Math.max(0, o.bonusPieces || 0);
    const comboScore = Math.max(0, o.comboScore || 0);
    const comboPieces = Math.max(0, o.comboPieces || 0);
    const chuvaPieces = Math.max(0, o.chuvaPieces || 0);
    let bonusCoins = 0;
    let bonusXp = 0;
    if (o.stars > 0) {
      bonusCoins = bonusPieces * BONUS_COINS_PER_PIECE + comboScore + chuvaPieces * CHUVA_COINS_PER_PIECE;
      bonusXp = bonusPieces * BONUS_XP_PER_PIECE + comboPieces + chuvaPieces;
    }

    const mult = upgradeEffects(d.upgrades).coinMultiplier;
    coins = Math.round(coins * mult);
    bonusCoins = Math.round(bonusCoins * mult);

    const rankBefore = this.rank;
    d.coins += coins + bonusCoins;
    d.xp += xp + bonusXp;
    const rankUp = this.rank > rankBefore;

    // O premio do mundo vai junto com o resultado, na mesma gravacao: quem
    // sai no meio do selo, do intervalo ou do corte nao o perde - vale o mesmo
    // que vale para a vitoria (commitPendingWin).
    let prize = null;
    let unlock = null;
    const origem = faseDeOrigem(o.level);
    if (o.stars > 0) this.contaBarra(origem.mundo, coins + bonusCoins);
    if (o.stars > 0 && origem.fimDeMundo) {
      prize = this.claimWorldPrize(origem.mundo, true, false);
      // Depois do premio: a melhoria nao troca skin, e o hexagono da barra e o
      // que fica equipado.
      unlock = this.compraDaBarra(origem.mundo);
    }
    this.flush();
    return { coins, xp, bonusCoins, bonusXp, bonusPieces, chuvaPieces, best, rankUp, prize, unlock };
  }

  /**
   * Fase aberta por video, sem estrela. Fica marcada para o mapa poder mostrar
   * que ela esta em aberto sem fingir que foi vencida.
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

  /**
   * O hexagono que a barra de moedas compra no fim deste mundo, se o jogador
   * ainda nao o tem: e o alvo da barra no HUD. So os mundos pares 2 a 8 tem
   * um; nos outros a barra some, e quem fala do proximo hexagono e a fita do
   * mundo. Quem ja o tem (o Descolado tambem sai por video na loja) fica so
   * com a melhoria.
   * @param {number} mundo 0-based
   * @returns {*|null}
   */
  barraAlvo(mundo) {
    const id = barraDoMundo(mundo);
    if (!id || this.ownsSkin(id)) return null;
    const s = SKINS.find((k) => k.id === id);
    return s && !s.retired ? s : null;
  }

  /**
   * Moedas que a barra mostra neste mundo: so as ganhas nas fases dele.
   * @param {number} mundo 0-based
   * @returns {number}
   */
  barraMoedasDe(mundo) {
    return this.data.barraDe === mundo ? Math.max(0, this.data.barraMoedas || 0) : 0;
  }

  /**
   * Soma as moedas de uma vitoria ao contador da barra. O contador e do mundo:
   * entrar em outro mundo com barra recomeca do zero. Sem isso a barra do
   * mundo 2 ja nascia cheia com as ~220 moedas do mundo 1, e comprava na
   * primeira vitoria dele (1.0.13).
   * @param {number} mundo 0-based
   * @param {number} ganho
   */
  contaBarra(mundo, ganho) {
    if (!this.barraAlvo(mundo)) return;
    const d = this.data;
    if (d.barraDe !== mundo) {
      d.barraDe = mundo;
      d.barraMoedas = 0;
    }
    d.barraMoedas = Math.max(0, d.barraMoedas || 0) + Math.max(0, Math.round(ganho));
  }

  /**
   * No fim de um mundo par, as moedas compram e equipam o hexagono da barra -
   * sem pergunta e sem loja: no Player Fit Test da 1.0.10, de 1.018 jogadores
   * novos, 6 abriram a loja e 2 compraram.
   *
   * So no fim do mundo, e nunca antes: e o que poe um hexagono novo a cada
   * cinco fases. Se a barra nao encheu, o saldo completa - a compra so nao sai
   * quando o saldo nao cobre o preco (o jogador gastou na loja), e ai espera a
   * proxima vitoria nesta mesma fase.
   * @param {number} mundo 0-based
   * @returns {BarraResult|null}
   */
  compraDaBarra(mundo) {
    const s = this.barraAlvo(mundo);
    const d = this.data;
    if (!s || d.coins < s.cost) return null;
    d.coins -= s.cost;
    if (!this.ownsSkin(s.id)) d.skins.push(s.id);
    d.skin = s.id;
    d.barraDe = -1;
    d.barraMoedas = 0;
    return { world: mundo, kind: 'skin', id: s.id, coins: s.cost, via: 'moedas' };
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

  /**
   * Skins da loja com o estado de cada uma, na ordem da trilha: a Original,
   * depois as de premio pelo mundo em que saem, depois as que so se compram.
   * @returns {*}
   */
  skinCatalog() {
    const rank = this.rank;
    // Skin aposentada so aparece para quem ja a tem: ela saiu da loja, mas o
    // que foi comprado continua sendo do jogador.
    const lista = SKINS.filter((s) => !s.retired || this.ownsSkin(s.id)).map((s) => {
      const prizeWorld = prizeWorldOfSkin(s.id);
      return {
        skin: s,
        owned: this.ownsSkin(s.id),
        equipped: this.data.skin === s.id,
        rankLocked: rank < s.rank,
        affordable: this.data.coins >= s.cost,
        prizeWorld,
        prizeClaimed: prizeWorld >= 0 && this.prizeClaimed(prizeWorld),
      };
    });
    const ordem = (/** @type {*} */ e) => (e.skin.id === 'classic' ? -1 : e.prizeWorld >= 0 ? e.prizeWorld : 1000);
    return lista.sort((a, b) => ordem(a) - ordem(b));
  }

  reset() {
    // O `rev` continua contando: zerado, a copia do Preferences de antes do
    // reset venceria no proximo boot do app e devolveria o progresso apagado.
    const rev = this.data.rev || 0;
    this.data = blank();
    this.data.rev = rev;
    this.flush();
  }
}
