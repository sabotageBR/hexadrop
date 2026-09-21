/**
 * Conteudo de progressao: skins do hexagono e aprimoramentos.
 *
 * A Poki exige uma moeda unica e proibe compras com dinheiro real. Aqui as
 * moedas sao a unica moeda; o XP e so patente do jogador e desbloqueia itens,
 * nunca e gasto. Todo aprimoramento so facilita, entao nenhuma fase validada
 * pode ficar impossivel por causa deles.
 */

/**
 * @typedef {object} Skin
 * @property {string} id
 * @property {string} name
 * @property {number} cost 0 = gratis
 * @property {number} rank patente minima
 * @property {boolean} [rewarded] desbloqueavel com um video
 * @property {string} [model] id de HEX_MODELS; ausente = 'liso'
 * @property {string} [fill]
 * @property {string} [stroke]
 * @property {string} [core]
 * @property {(ctx:CanvasRenderingContext2D, cx:number, cy:number, r:number, theme:*)=>void} [mark]
 */

/** @type {Skin[]} */
export const SKINS = [
  {
    id: 'classic',
    name: 'Original',
    cost: 0,
    rank: 0,
    model: 'liso',
  },
  {
    id: 'ember',
    name: 'Brasa',
    cost: 120,
    rank: 0,
    model: 'nucleo',
    fill: 'rgba(255,150,60,0.28)',
    stroke: '#ff8a2a',
    core: '#fff0d0',
  },
  {
    id: 'mint',
    name: 'Menta',
    cost: 180,
    rank: 2,
    model: 'vidro',
    fill: 'rgba(90,240,190,0.26)',
    stroke: '#3ee0b0',
    core: '#eafff8',
  },
  {
    id: 'violet',
    name: 'Violeta',
    cost: 260,
    rank: 3,
    model: 'cristal',
    fill: 'rgba(180,120,255,0.3)',
    stroke: '#b57cff',
    core: '#f5ecff',
  },
  {
    id: 'gold',
    name: 'Ouro',
    cost: 420,
    rank: 5,
    model: 'ouro',
    fill: 'rgba(255,205,70,0.32)',
    stroke: '#ffcd46',
    core: '#fff6d8',
    // Sem marca: o anel branco que havia aqui era um circulo no meio de uma
    // peca de seis lados, e brigava com a varredura de luz do modelo `ouro` -
    // o que se via era o circulo, nao o metal polido.
  },
  {
    id: 'circuit',
    name: 'Circuito',
    cost: 0,
    rank: 8,
    model: 'placa',
    fill: 'rgba(60,220,200,0.24)',
    stroke: '#2ee6c4',
    core: '#dffff8',
    mark(ctx, cx, cy, r) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = Math.max(1, r * 0.045);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy);
      ctx.lineTo(cx - r * 0.15, cy);
      ctx.lineTo(cx - r * 0.15, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.35, cy - r * 0.3);
      ctx.moveTo(cx + r * 0.1, cy + r * 0.32);
      ctx.lineTo(cx + r * 0.45, cy + r * 0.32);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    cost: 600,
    rank: 10,
    model: 'gema',
    fill: 'rgba(120,200,255,0.28)',
    stroke: '#7fd8ff',
    core: '#ffffff',
    mark(ctx, cx, cy, r) {
      ctx.save();
      const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      g.addColorStop(0, 'rgba(255,120,220,0.55)');
      g.addColorStop(0.5, 'rgba(120,255,220,0.35)');
      g.addColorStop(1, 'rgba(120,160,255,0.55)');
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'shadow',
    name: 'Sombra',
    cost: 350,
    rank: 0,
    model: 'selo',
    rewarded: true,
    fill: 'rgba(40,40,60,0.55)',
    stroke: '#8a8ab0',
    core: '#c8c8e0',
  },
];

/**
 * Estrelas acumuladas para abrir cada mundo.
 *
 * O teto e 480 (160 fases x 3 estrelas), com o mundo 1 valendo 60 - ele tem
 * vinte fases, o dobro dos outros. A curva e folgada no comeco - quem passa
 * raspando pelo mundo 1 entra no 2 sem perceber o portao - e vai apertando, de
 * modo que perto do fim o jogador precisa ter voltado para melhorar fases
 * antigas. Nunca chega a exigir tudo: o ultimo portao pede 434 das 480, entao
 * sobra folga para quinze fases mal resolvidas.
 *
 * Cada degrau foi re-escalado pela MESMA fracao do que ja estava disponivel
 * naquele ponto, para que o aperto percebido continue identico ao de antes.
 *
 * Indice = numero do mundo (0 a 14); o mundo 0 nunca e travado.
 */
/**
 * Premio por peca que sobrou intacta no fim da fase.
 *
 * E o que transforma "sobrou peca" de sobra em meta: quem resolve com menos
 * toques termina com a torre mais cheia e leva mais moeda. Nao toca em estrela
 * nenhuma - os portoes de mundo continuam pedindo exatamente o que pediam.
 */
export const BONUS_COINS_PER_PIECE = 3;
export const BONUS_XP_PER_PIECE = 2;

export const GATE_STARS = [
  0, 24, 42, 64, 90, 120, 153, 187, 224, 262, 301, 338, 373, 405, 434,
];

/**
 * @param {number} world 0 a 14
 * @returns {number}
 */
export function gateStars(world) {
  return GATE_STARS[Math.max(0, Math.min(GATE_STARS.length - 1, world))] || 0;
}

/**
 * @typedef {object} Boost
 * @property {string} id
 * @property {string} nameKey
 * @property {string} descKey
 * @property {number} inicial quantos o jogador ja comeca tendo
 * @property {number} pacote quantos vem em cada compra
 * @property {number} custo moedas por pacote
 */

/**
 * Consumiveis.
 *
 * Diferente dos aprimoramentos, que sao uma escada de niveis permanente, um
 * boost e gasto e acaba. Nenhum deles pode ser condicao para progredir: sem
 * boost nenhum o jogador continua tendo "tentar de novo", que e gratuito e
 * ilimitado.
 *
 * @type {Boost[]}
 */
export const BOOSTS = [
  { id: 'shuffle', nameKey: 'boostShuffle', descKey: 'boostShuffleDesc', inicial: 3, pacote: 5, custo: 150 },
];

/** @param {string} id @returns {Boost|undefined} */
export function boost(id) {
  return BOOSTS.find((b) => b.id === id);
}

/**
 * @typedef {object} Upgrade
 * @property {string} id
 * @property {string} nameKey
 * @property {string} descKey
 * @property {number} max
 * @property {number[]} costs
 */

/** @type {Upgrade[]} */
export const UPGRADES = [
  { id: 'stability', nameKey: 'upgStability', descKey: 'upgStabilityDesc', max: 3, costs: [80, 200, 420] },
  { id: 'grip', nameKey: 'upgGrip', descKey: 'upgGripDesc', max: 3, costs: [90, 220, 460] },
  { id: 'fortune', nameKey: 'upgFortune', descKey: 'upgFortuneDesc', max: 3, costs: [140, 300, 600] },
  { id: 'heart', nameKey: 'upgHeart', descKey: 'upgHeartDesc', max: 2, costs: [250, 700] },
];

/**
 * Efeitos numericos de cada aprimoramento.
 * @param {Record<string, number>} levels
 */
export function upgradeEffects(levels) {
  const s = levels.stability || 0;
  const g = levels.grip || 0;
  const f = levels.fortune || 0;
  const h = levels.heart || 0;
  return {
    angularDamping: 0.08 + s * 0.16,
    frictionBonus: g * 0.07,
    coinMultiplier: 1 + f * 0.15,
    extraHearts: h,
  };
}

/** @param {string} id @returns {Skin} */
export function skin(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}

/**
 * XP necessario para alcancar uma patente.
 * @param {number} rank
 * @returns {number}
 */
export function xpForRank(rank) {
  return Math.round(60 * rank + 14 * rank * rank);
}

/**
 * @param {number} xp
 * @returns {number}
 */
export function rankFromXp(xp) {
  let rank = 0;
  while (rank < 60 && xp >= xpForRank(rank + 1)) rank++;
  return rank;
}
