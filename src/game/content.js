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
 * @property {string} name rotulo interno (prototipos); o jogo mostra `nameKey`
 * @property {string} nameKey chave de i18n do nome
 * @property {number} cost 0 = gratis; para skin da trilha e o preco de adiantar
 * @property {number} rank patente minima (so nas skins fora da trilha)
 * @property {boolean} [rewarded] desbloqueavel com um video
 * @property {string} [model] id de HEX_MODELS; ausente = 'joia'
 * @property {string} [fill]
 * @property {string} [stroke]
 * @property {string} [core]
 * @property {boolean} [halo] false = sem o halo borrado do contorno em tema escuro
 * @property {boolean} [retired] fora da loja; so quem ja tem ve e equipa
 * @property {(ctx:CanvasRenderingContext2D, cx:number, cy:number, r:number, theme:*)=>void} [mark]
 */

/** @type {Skin[]} */
export const SKINS = [
  {
    id: 'classic',
    nameKey: 'skinClassic',
    name: 'Original',
    cost: 0,
    rank: 0,
    model: 'joia',
  },
  // Um hexagono por mundo (1.0.12): os quatorze que o Evandro escolheu na
  // galeria de 92 (prototypes/galeria.html), na ordem em que o jogador os
  // ganha - os impares sao premio de mundo (WORLD_PRIZES), os quatro de
  // HEX_DA_BARRA a barra de moedas compra nos mundos pares 2, 4, 6 e 8. A
  // ordem alterna rosto, comida, bola e objeto, para dois seguidos nunca serem
  // do mesmo tipo, e abre com o rosto: o primeiro premio e o que mais gente ve.
  //
  // Trilha: o preco e o de quem quer adiantar na loja; quando o mundo chega,
  // as moedas voltam.
  { id: 'smiley', nameKey: 'skinSmiley', name: 'Feliz', cost: 120, rank: 0, model: 'feliz', fill: '#ffc93c', stroke: '#947523', core: '#fff3cf', halo: false },
  { id: 'watermelon', nameKey: 'skinWatermelon', name: 'Melancia', cost: 180, rank: 0, model: 'melancia', fill: '#2f9e44', stroke: '#1b6a2a', core: '#ff4d63', halo: false },
  { id: 'robot', nameKey: 'skinRobot', name: 'Robo', cost: 240, rank: 0, model: 'robo', fill: '#9aa6bf', stroke: '#4d5360', core: '#4fe3ff', halo: false },
  { id: 'soccer', nameKey: 'skinSoccer', name: 'Bola de futebol', cost: 300, rank: 0, model: 'futebol', fill: '#f6f7fb', stroke: '#7c84a6', core: '#1d1a2b', halo: false },
  { id: 'cheese', nameKey: 'skinCheese', name: 'Queijo', cost: 360, rank: 0, model: 'queijo', fill: '#ffcf3a', stroke: '#a87410', core: '#e0a31a', halo: false },
  { id: 'grumpy', nameKey: 'skinGrumpy', name: 'Bravo', cost: 420, rank: 0, model: 'bravo', fill: '#ff4d4d', stroke: '#942d2d', core: '#ffe0e0', halo: false },
  { id: 'friedegg', nameKey: 'skinFriedEgg', name: 'Ovo frito', cost: 480, rank: 0, model: 'ovo', fill: '#f7f9ff', stroke: '#b6bdd8', core: '#ffb21e', halo: false },
  { id: 'clock', nameKey: 'skinClock', name: 'Relogio', cost: 540, rank: 0, model: 'relogio', fill: '#4f8bff', stroke: '#22489e', core: '#fbfbff', halo: false },
  { id: 'tartan', nameKey: 'skinTartan', name: 'Xadrez escoces', cost: 600, rank: 0, model: 'escoces', fill: '#c4242f', stroke: '#6a0f18', core: '#ffd65a', halo: false },
  { id: 'skully', nameKey: 'skinSkully', name: 'Caveirinha', cost: 660, rank: 0, model: 'caveirinha', fill: '#3a2a55', stroke: '#7c6aa8', core: '#f2f0ea', halo: false },
  // Barra de moedas: precos para encher dentro do mundo em que ela compra. A
  // primeira tambem e a oferta de video da loja (moedas OU video, nunca so o
  // video).
  { id: 'shades', nameKey: 'skinShades', name: 'Descolado', cost: 220, rank: 0, rewarded: true, model: 'descolado', fill: '#4fb3ff', stroke: '#2e6894', core: '#1d1a2b', halo: false },
  { id: 'basketball', nameKey: 'skinBasketball', name: 'Bola de basquete', cost: 300, rank: 0, model: 'basquete', fill: '#ff7a1a', stroke: '#803d0d', core: '#1d1a2b', halo: false },
  { id: 'pizza', nameKey: 'skinPizza', name: 'Pizza', cost: 450, rank: 0, model: 'pizza', fill: '#d98b3a', stroke: '#8a4a12', core: '#ffd24a', halo: false },
  { id: 'gamepad', nameKey: 'skinGamepad', name: 'Controle', cost: 500, rank: 0, model: 'controle', fill: '#ff5f7a', stroke: '#8c3443', core: '#2c2f45', halo: false },
  // Aposentadas na 1.0.12: os desenhos da 1.0.8 (trilha e barra), que o
  // Evandro trocou pelos da galeria. Saem da loja e da trilha, mas quem ja tem
  // continua podendo equipar.
  { retired: true, id: 'sunny', nameKey: 'skinSunny', name: 'Carinha sol', cost: 120, rank: 0, model: 'carinha', fill: '#ffc93c', stroke: '#9a6a00', core: '#fff3cf', halo: false },
  { retired: true, id: 'strawberry', nameKey: 'skinStrawberry', name: 'Listras morango', cost: 180, rank: 0, model: 'listras', fill: '#ff4d7a', stroke: '#a01a42', core: '#ffe3ec', halo: false },
  { retired: true, id: 'pinwheel', nameKey: 'skinPinwheel', name: 'Catavento turquesa', cost: 240, rank: 0, model: 'catavento', fill: '#19c3d6', stroke: '#0a6f7a', core: '#e2fcff', halo: false },
  { retired: true, id: 'bubblegum', nameKey: 'skinBubblegum', name: 'Bolinhas chiclete', cost: 300, rank: 0, model: 'bolinhas', fill: '#ff7ac8', stroke: '#a3307a', core: '#fff0f8', halo: false },
  { retired: true, id: 'nightstar', nameKey: 'skinNightstar', name: 'Estrela da noite', cost: 360, rank: 0, model: 'estrela', fill: '#2e3fbf', stroke: '#141f6e', core: '#ffe36a', halo: false },
  { retired: true, id: 'pixelleaf', nameKey: 'skinPixelLeaf', name: 'Pixel folha', cost: 420, rank: 0, model: 'pixel', fill: '#3fcf5a', stroke: '#1b6e2a', core: '#e9ffe9', halo: false },
  { retired: true, id: 'grape', nameKey: 'skinGrape', name: 'Roseta uva', cost: 480, rank: 0, model: 'roseta', fill: '#8b5cff', stroke: '#4a22b0', core: '#f1e9ff', halo: false },
  { retired: true, id: 'graphite', nameKey: 'skinGraphite', name: 'Xadrez grafite', cost: 540, rank: 0, model: 'xadrez', fill: '#30334a', stroke: '#8a8fb0', core: '#5b6080', halo: false },
  { retired: true, id: 'pixelember', nameKey: 'skinPixelEmber', name: 'Pixel brasa', cost: 600, rank: 0, model: 'pixel', fill: '#ff4a3d', stroke: '#8a1810', core: '#ffe2dc', halo: false },
  { retired: true, id: 'rosy', nameKey: 'skinRosy', name: 'Carinha rosa', cost: 660, rank: 0, model: 'carinha', fill: '#ff8fb8', stroke: '#a3406a', core: '#fff0f6', halo: false },
  { retired: true, id: 'tangerine', nameKey: 'skinTangerine', name: 'Xadrez laranja', cost: 700, rank: 0, rewarded: true, model: 'xadrez', fill: '#ff9a3c', stroke: '#9a4a00', core: '#ffc98f', halo: false },
  { retired: true, id: 'sunwheel', nameKey: 'skinSunwheel', name: 'Catavento laranja', cost: 400, rank: 0, model: 'catavento', fill: '#ff8a1e', stroke: '#9a4a00', core: '#fff0d8', halo: false },
  { retired: true, id: 'lemondrop', nameKey: 'skinLemondrop', name: 'Bolinhas sol', cost: 450, rank: 0, model: 'bolinhas', fill: '#ffc21e', stroke: '#9a6a00', core: '#fff7d6', halo: false },
  { retired: true, id: 'mintstripe', nameKey: 'skinMintstripe', name: 'Listras menta', cost: 500, rank: 0, model: 'listras', fill: '#2fd6a0', stroke: '#13805c', core: '#eafff6', halo: false },
  // Aposentadas na 1.0.8: o Evandro nao gosta delas, e as de miolo aceso
  // (nucleo, vidro, cristal) tinham a mancha radial que ele ja tinha rejeitado
  // no hexagono padrao. Saem da loja, mas quem comprou continua podendo
  // equipar - por isso ficam aqui.
  {
    id: 'ember',
    retired: true,
    nameKey: 'skinEmber',
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
    retired: true,
    nameKey: 'skinMint',
    name: 'Menta',
    cost: 180,
    rank: 0,
    model: 'vidro',
    fill: 'rgba(90,240,190,0.26)',
    stroke: '#3ee0b0',
    core: '#eafff8',
  },
  {
    id: 'violet',
    retired: true,
    nameKey: 'skinViolet',
    name: 'Violeta',
    cost: 260,
    rank: 0,
    model: 'cristal',
    fill: 'rgba(180,120,255,0.3)',
    stroke: '#b57cff',
    core: '#f5ecff',
  },
  {
    id: 'gold',
    retired: true,
    nameKey: 'skinGold',
    name: 'Ouro',
    cost: 420,
    rank: 0,
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
    retired: true,
    nameKey: 'skinCircuit',
    name: 'Circuito',
    cost: 300,
    rank: 0,
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
    retired: true,
    nameKey: 'skinAurora',
    name: 'Aurora',
    cost: 600,
    rank: 0,
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
    retired: true,
    nameKey: 'skinShadow',
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
 * Premio por peca que sobrou intacta no fim da fase.
 *
 * E o que transforma "sobrou peca" de sobra em meta: quem resolve com menos
 * toques termina com a torre mais cheia e leva mais moeda. Nao toca em estrela
 * nenhuma - os portoes de mundo continuam pedindo exatamente o que pediam.
 */
export const BONUS_COINS_PER_PIECE = 3;
export const BONUS_XP_PER_PIECE = 2;

/**
 * Chuva de moedas (1.0.12): na ultima fase de cada mundo a cascata da
 * celebracao vira chuva, e cada peca que sobrou estoura sozinha valendo o
 * dobro da intacta de uma fase comum. E o premio de chegar ao fim do mundo,
 * antes do premio do mundo - sem depender de toque nenhum.
 */
export const CHUVA_COINS_PER_PIECE = BONUS_COINS_PER_PIECE * 2;

/**
 * Estrelas acumuladas para abrir cada mundo.
 *
 * O teto e 300 (100 fases x 3 estrelas), 15 por mundo. A curva e folgada no
 * comeco - toda vitoria cruza as tres linhas, entao duas fases ja abrem o
 * mundo 2 - e vai apertando, de modo que perto do fim o jogador precisa ter
 * voltado para melhorar fases antigas. Nunca chega a exigir tudo: o ultimo
 * portao pede 275 das 300.
 *
 * Cada degrau foi re-escalado pela MESMA fracao do que ja estava disponivel
 * naquele ponto do jogo - a cada mudanca de `WORLD_SIZES` -, para que o aperto
 * percebido continue identico ao da primeira versao. Com fluxo continuo ate a
 * fase 100 o portao nao para o jogo corrido: ele vale para quem escolhe o
 * mundo no mapa ou na home.
 *
 * Indice = numero do mundo (0 a 19); o mundo 0 nunca e travado.
 */
export const GATE_STARS = [
  0, 6, 13, 22, 33, 44, 58, 72, 88, 104, 121, 138, 157, 176, 194, 212, 229, 245, 260, 275,
];

/**
 * @param {number} world 0 a WORLD_COUNT-1
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
];

/**
 * @typedef {{skin:string}|{upgrade:string}|{coins:number}} Prize
 */

/**
 * O premio de cada mundo CONCLUIDO (indice = mundo, 0-based).
 *
 * A 1.0.7 reprovou no Web Fit Test com 5:54 de tempo na pagina contra ~8:52 de
 * referencia, e o painel mostrou por que: o jogador saia em ritmo constante,
 * uns 10% a cada fase, inclusive nas fases 1 a 10, onde nao da para perder -
 * com nota 4,7 e 93% de avaliacoes positivas. Ele nao saia frustrado, saia sem
 * motivo para a fase seguinte. A moeda ja existia, mas nao tinha destino
 * visivel, e quem entra jogando nunca passava pela loja. A Poki pede metas
 * curtas (a fase) E longas (recompensa desbloqueavel); faltava a longa.
 *
 * Cada mundo dura cinco fases, ~90 s. Os impares (1, 3 ... 19) dao um
 * hexagono novo, equipado na hora - o jogador ve a peca trocar na fase
 * seguinte. Os pares dao um nivel de melhoria: nove premios, exatamente os
 * 3x3 niveis de UPGRADES, com a estabilidade primeiro (mundo 2, fase 10), que
 * e o que firma o hexagono antes do pedestal que balanca estrear na 11.
 *
 * Contado pelo mundo concluido, e nao pelo mundo em que se entra, o primeiro
 * premio cai na fase 5 (metade do funil chega la) e e um hexagono - visivel.
 *
 * O primeiro e um hexagono com rosto: e o premio que mais gente ve (a fase 5),
 * e o que tem que se notar de longe. A skin de video da loja fica fora.
 * @type {Prize[]}
 */
export const WORLD_PRIZES = [
  { skin: 'smiley' },
  { upgrade: 'stability' },
  { skin: 'watermelon' },
  { upgrade: 'grip' },
  { skin: 'robot' },
  { upgrade: 'fortune' },
  { skin: 'soccer' },
  { upgrade: 'stability' },
  { skin: 'cheese' },
  { upgrade: 'grip' },
  { skin: 'grumpy' },
  { upgrade: 'fortune' },
  { skin: 'friedegg' },
  { upgrade: 'stability' },
  { skin: 'clock' },
  { upgrade: 'grip' },
  { skin: 'tartan' },
  { upgrade: 'fortune' },
  { skin: 'skully' },
];

/** Bau do fim da campanha (mundo 20, fase 100). */
export const CHEST_FINAL = 500;
/** Bau de cada mundo depois do 20 - perto da renda de um mundo inteiro. */
export const CHEST_COINS = 300;

/**
 * Premio nominal do mundo `world` (0-based). Ainda nao considera o que o
 * jogador ja tem: isso e `Progress.resolvePrize`.
 * @param {number} world
 * @param {number} worldCount mundos da campanha (WORLD_COUNT)
 * @returns {Prize}
 */
export function worldPrize(world, worldCount) {
  const w = Math.max(0, world | 0);
  if (w < WORLD_PRIZES.length) return WORLD_PRIZES[w];
  if (w === worldCount - 1) return { coins: CHEST_FINAL };
  return { coins: CHEST_COINS };
}

/**
 * Em que mundo (0-based) uma skin e premio, ou -1 se ela so se compra.
 * @param {string} id
 * @returns {number}
 */
export function prizeWorldOfSkin(id) {
  return WORLD_PRIZES.findIndex((p) => 'skin' in p && p.skin === id);
}

/**
 * Os hexagonos que a barra de moedas compra, na ordem (1.0.12).
 *
 * Um hexagono por mundo: os impares dao o da trilha como premio, os pares a
 * partir do 2 dao o da barra (`BARRA_DESDE_MUNDO`, `Progress.unlockNextSkin`),
 * no maximo um por mundo. Os precos sao para a barra encher dentro do mundo em
 * que ela compra: medido com o jogador automatico, uma fase rende ~35 moedas
 * nas primeiras vinte, entao 220 chega pela fase 8 e 300 pela 17.
 */
export const HEX_DA_BARRA = ['shades', 'basketball', 'pizza', 'gamepad'];

/**
 * Primeiro mundo (0-based) em que a barra pode comprar: o 2. Dali em diante
 * ela compra nos pares, entre um premio de mundo e o seguinte.
 */
export const BARRA_DESDE_MUNDO = 1;

/**
 * Proximo mundo (0-based), a partir de `from`, cujo premio e um nivel desta
 * melhoria; -1 se nao ha mais nenhum.
 * @param {string} id
 * @param {number} from
 * @returns {number}
 */
export function nextUpgradePrizeWorld(id, from) {
  for (let w = Math.max(0, from); w < WORLD_PRIZES.length; w++) {
    const p = WORLD_PRIZES[w];
    if ('upgrade' in p && p.upgrade === id) return w;
  }
  return -1;
}

/**
 * Efeitos numericos de cada aprimoramento.
 * @param {Record<string, number>} levels
 */
export function upgradeEffects(levels) {
  const s = levels.stability || 0;
  const g = levels.grip || 0;
  const f = levels.fortune || 0;
  return {
    angularDamping: 0.08 + s * 0.16,
    frictionBonus: g * 0.07,
    coinMultiplier: 1 + f * 0.15,
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
