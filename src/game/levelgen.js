/**
 * Gerador de fases.
 *
 * Este arquivo roda nos dois lados: o validador offline em Node usa para
 * produzir e testar layouts, e o jogo usa para reconstruir exatamente o mesmo
 * layout a partir da seed aprovada. Por isso tudo aqui e puro, deterministico
 * e livre de qualquer dependencia de navegador.
 */

import { Rng } from '../core/rng.js';
import { SHAPE_LIST, orientations, bounds, normalize } from '../physics/shapes.js';
import { MATERIAL_DEBUT, HOLD_MATERIALS } from '../physics/materials.js';
import { HEX_RADIUS, CELL } from '../physics/world.js';

/**
 * Fases de cada mundo.
 *
 * O primeiro e um tutorial longo: vinte fases para apresentar o toque, a
 * estrela, o pedestal, a pedra e a obsidiana sem pressa. Os demais mantem as
 * dez de sempre, que e o tamanho em que um mundo cabe numa sessao.
 *
 * Esta lista e a UNICA fonte de verdade sobre fronteira de mundo. Antes o "10"
 * estava literal em dezenove lugares de cinco arquivos, e bastava esquecer um
 * para o mapa abrir uma fase e o portao cobrar outra.
 */
export const WORLD_SIZES = [20, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];

export const WORLD_COUNT = WORLD_SIZES.length;

export const LEVEL_COUNT = WORLD_SIZES.reduce((a, b) => a + b, 0);

/** Indice 0-based da primeira fase de cada mundo, mais o total no fim. */
const WORLD_START = WORLD_SIZES.reduce(
  (acc, n) => {
    acc.push(acc[acc.length - 1] + n);
    return acc;
  },
  [0],
);

/**
 * @param {number} index indice 0-based da fase
 * @returns {number} mundo 0-based
 */
export function worldOf(index) {
  const i = Math.max(0, Math.min(LEVEL_COUNT - 1, index | 0));
  let w = 0;
  while (w + 1 < WORLD_COUNT && i >= WORLD_START[w + 1]) w++;
  return w;
}

/** @param {number} world @returns {number} indice 0-based da primeira fase */
export function worldStart(world) {
  return WORLD_START[Math.max(0, Math.min(WORLD_COUNT - 1, world | 0))];
}

/** @param {number} world @returns {number} quantas fases o mundo tem */
export function worldSize(world) {
  return WORLD_SIZES[Math.max(0, Math.min(WORLD_COUNT - 1, world | 0))];
}

/** @param {number} index @returns {number} posicao da fase dentro do mundo */
export function indexInWorld(index) {
  const i = Math.max(0, Math.min(LEVEL_COUNT - 1, index | 0));
  return i - worldStart(worldOf(i));
}

/** Tema de cada mundo. */
export const WORLD_THEMES = [
  'puzzle',
  'classic',
  'ice',
  'candy',
  'futuristic',
  'rustic',
  'paper',
  'lava',
  'neon',
  'futuristic',
  // Segunda volta: os mesmos cenarios em outra ordem, nunca dois iguais
  // seguidos, e o neon fecha o jogo como fechava a primeira volta.
  'candy',
  'ice',
  'rustic',
  'lava',
  'neon',
];

/**
 * A peca que define cada mundo.
 *
 * `base` e a peca dominante da torre, `apoio` e o que a sustenta (e o que
 * assume enquanto a base ainda nao estreou), e `assinatura` e o material que
 * aquele cenario empurra para frente.
 *
 * Antes daqui isto era uma funcao de dois valores que devolvia madeira para
 * CATORZE dos quinze mundos: trocar de mundo trocava o ceu e a paleta, nunca a
 * peca. Medido sobre as seeds aprovadas, o mundo 2 inteiro era 68% madeira e
 * 27% pedra, e nada mais.
 *
 * O `teto` existe porque nem toda peca aguenta ser maioria. Gelo tem atrito
 * 0,09 e vidro quebra por pancada: uma torre feita quase so deles vira um
 * escorregador que o validador so aprova no degrau 3 de afrouxamento - o
 * degrau que apaga toda a variedade de materiais.
 */
const THEME_MATERIALS = {
  puzzle: { base: 'block', apoio: 'stone', assinatura: '', teto: 10 },
  classic: { base: 'wood', apoio: 'stone', assinatura: 'ice', teto: 10 },
  ice: { base: 'ice', apoio: 'stone', assinatura: 'rubber', teto: 6.5 },
  candy: { base: 'rubber', apoio: 'wood', assinatura: 'foam', teto: 8 },
  futuristic: { base: 'metal', apoio: 'stone', assinatura: 'glass', teto: 9 },
  rustic: { base: 'wood', apoio: 'stone', assinatura: 'crystal', teto: 10 },
  paper: { base: 'foam', apoio: 'wood', assinatura: 'glass', teto: 6.5 },
  lava: { base: 'stone', apoio: 'wood', assinatura: 'wax', teto: 10 },
  neon: { base: 'glass', apoio: 'metal', assinatura: 'crystal', teto: 6.5 },
};

/**
 * Peca dominante de um mundo, respeitando o calendario de estreias.
 *
 * Antes de a base estrear o mundo se apoia no material de apoio - senao o
 * mundo do gelo abriria feito de gelo numa fase em que o jogador ainda nao viu
 * gelo nenhum. Com `seguro`, bases frageis cedem lugar ao apoio: e o que o
 * degrau 3 de afrouxamento precisa, porque ali o objetivo e so a fase existir.
 *
 * @param {string} theme
 * @param {number} [level] 1-based; sem ele assume o fim do jogo
 * @param {boolean} [seguro]
 * @returns {string}
 */
export function baseMaterial(theme, level = LEVEL_COUNT, seguro = false) {
  const kit = THEME_MATERIALS[theme] || THEME_MATERIALS.classic;
  const alvo = seguro && kit.teto < 10 ? kit.apoio : kit.base;
  if (level >= (MATERIAL_DEBUT[alvo] || 1)) return alvo;
  if (level >= (MATERIAL_DEBUT[kit.apoio] || 1)) return kit.apoio;
  return 'wood';
}

/**
 * As tres primeiras fases sao roteiro, e nao ponto da curva.
 *
 * Pela curva elas eram a MESMA fase tres vezes: quatro colunas, quatro linhas
 * e so barras, ou seja, quatro toques sem nada cair de verdade. O jogador
 * concluia que o jogo era aquilo, o primeiro intervalo comercial chegava em
 * seguida e ele ia embora ali.
 *
 * A saida nao foi so misturar formas numa torre de quatro colunas: medido no
 * validador, nessa largura qualquer peca que nao seja barra deixa o hexagono
 * rolar para fora com um toque ingenuo, e as unicas seeds que perdoavam tudo
 * eram as de barras de novo. Com seis colunas a torre tem apoio dos dois
 * lados, e cerca de uma seed em quatro sai variada (doze a dezessete pecas,
 * seis a oito toques) e ainda vence com o jogador tocando ao acaso. As pecas
 * que caem de lado ficam no pedestal largo e viram a cascata de bonus do fim,
 * que a pilha de barras nunca mostrava.
 *
 * `minForgiveness`, `minPieces` e `minPar` nao mudam o layout: sao exigencias
 * que tools/generate-levels.mjs cobra antes de aceitar uma seed. O `minPar`
 * tira as torres que desabam inteiras em dois toques - bonitas, mas de novo
 * uma fase que acaba antes de o jogador entender o que fez.
 */
const PRIMEIRAS_FASES = [
  // "Toque nas pecas": base quase sempre de barras, formas soltas por cima.
  { width: 6, rows: 6, barBias: 0.3, tierMax: 1, minForgiveness: 1, minPieces: 9, minPar: 3 },
  // "Leve o hexagono": a torre inteira de formas, o caminho e escolha.
  { width: 6, rows: 6, barBias: 0.15, tierMax: 1, minForgiveness: 1, minPieces: 9, minPar: 3 },
  // "Cruze as linhas": uma linha a mais, para as estrelas acenderem espacadas,
  // e as formas de quatro blocos. Com sete linhas e so as formas basicas quase
  // nenhuma seed perdoava tudo; o L, o T e o J dao mais encaixe e mais apoio.
  { width: 6, rows: 7, barBias: 0.25, tierMax: 2, minForgiveness: 1, minPieces: 9, minPar: 3 },
];

/**
 * @typedef {object} LevelConfig
 * @property {number} index 0 a 99
 * @property {number} level 1 a 100
 * @property {number} width colunas
 * @property {number} rows linhas
 * @property {number} tierMax complexidade maxima das formas
 * @property {Record<string, number>} materialWeights
 * @property {number} obsidian quantidade de pecas indestrutiveis
 * @property {number} bombs quantidade de bombas
 * @property {number} tnt quantidade de caixas de TNT
 * @property {number} bandMerge probabilidade de fundir duas faixas
 * @property {number} barBias chance de uma faixa virar barras de largura total
 * @property {number} pedestalHalf meia largura do pedestal em celulas
 * @property {number} oscillate amplitude do pedestal movel
 * @property {number} wind forca lateral
 * @property {number} hexScale
 * @property {number} hexOffset deslocamento inicial do hexagono em celulas
 * @property {string} theme
 * @property {string[]} newMaterials materiais que estreiam nesta fase
 * @property {number} [minForgiveness] o validador so aceita seed com perdao igual ou maior
 * @property {number} [minPieces] o validador so aceita layout com pelo menos tantas pecas
 * @property {number} [minPar] o validador so aceita seed cuja melhor solucao pede tantos toques
 * @property {number} [softened] degrau de afrouxamento aplicado
 */

/**
 * @param {number} index 0 a 99
 * @param {number} [soften] 0 a 3, aplicado quando o validador nao acha
 *   nenhuma variante vencivel com a configuracao original
 * @returns {LevelConfig}
 */
export function levelConfig(index, soften = 0) {
  const i = Math.max(0, Math.min(LEVEL_COUNT - 1, index | 0));
  const level = i + 1;
  const r = new Rng(7919 + i * 31);
  const p = i / (LEVEL_COUNT - 1);

  // --- largura da torre ---------------------------------------------------
  // Nunca menos de 4 colunas: o hexagono ocupa uma celula e meia, e numa torre
  // de 3 ele fica com margem de meia celula para cada lado, o que transforma
  // qualquer desabamento em queda certa.
  let width;
  if (i < 6) width = 4;
  else if (i < 16) width = r.chance(0.45) ? 4 : 5;
  else if (i < 45) width = r.chance(0.25) ? 6 : 5;
  else if (i < 75) width = 5 + r.int(0, 1);
  else width = r.chance(0.3) ? 5 : 6;

  // --- altura, com dente de serra e fases de folego -----------------------
  // A altura e o eixo que mais gasta toques, mas tambem o que mais acumula
  // risco: cada degrau e uma chance de o hexagono tombar. Por isso ela para em
  // 16 e o resto da dificuldade vem de pedestal estreito, materiais e vento.
  // Dois trechos: o mundo 1 inteiro fica baixo, para ensinar, e dali em
  // diante a torre sobe depressa. E a silhueta alta e cheia de pecas
  // encaixadas que faz a torre parecer uma torre, e nao tres barras.
  //
  // O trecho de ensino acompanha o tamanho do mundo 1, e nao um "10" cravado:
  // quando ele dobrou para vinte fases, a rampa dobrou junto em vez de deixar
  // dez fases de tutorial ja na altura de mundo 2.
  const mundo = worldOf(i);
  const fimDoTutorial = worldStart(1);
  let rows =
    i < fimDoTutorial
      ? 4 + Math.round((i / (fimDoTutorial - 1)) * 4)
      : 8 +
        Math.round(
          Math.pow((i - fimDoTutorial) / (LEVEL_COUNT - fimDoTutorial - 1), 0.65) * 8,
        );
  const inWorld = indexInWorld(i);
  if (inWorld === worldSize(mundo) - 1) rows += 2; // fase final de cada mundo
  else if (inWorld === 0 && i > 0) rows -= 1; // alivio depois do chefe
  rows = Math.max(4, Math.min(16, rows));

  // --- complexidade das formas -------------------------------------------
  let tierMax = 1;
  if (i >= 5) tierMax = 2;
  if (i >= 20) tierMax = 3;
  if (i >= 45) tierMax = 4;

  const theme = WORLD_THEMES[mundo];

  // --- materiais ----------------------------------------------------------
  const kit = THEME_MATERIALS[theme] || THEME_MATERIALS.classic;
  const base = baseMaterial(theme, level);
  // O teto so vale quando o mundo de fato conseguiu a peca que queria. Se ele
  // ainda esta no material de apoio, nao ha fragilidade nenhuma a limitar.
  const teto = base === kit.base ? kit.teto : 10;
  /** @type {Record<string, number>} */
  const materialWeights = { [base]: teto };
  const add = (id, weight) => {
    if (!id || id === base) return;
    if (level < MATERIAL_DEBUT[id]) return;
    materialWeights[id] = Math.max(materialWeights[id] || 0, weight);
  };
  add('stone', level > worldStart(1) ? 6 : 4);
  add('ice', Math.min(6, 2 + (level - MATERIAL_DEBUT.ice) * 0.12));
  add('rubber', Math.min(5, 2 + (level - MATERIAL_DEBUT.rubber) * 0.1));
  add('metal', Math.min(5, 2 + (level - MATERIAL_DEBUT.metal) * 0.1));
  add('glass', Math.min(5, 2 + (level - MATERIAL_DEBUT.glass) * 0.1));
  add('foam', Math.min(4, 1.5 + (level - MATERIAL_DEBUT.foam) * 0.1));
  // Peso deliberadamente pequeno, e nao so por custo de geracao. Um cristal sob
  // o hexagono cede sozinho e faz de graca o trabalho que seria do jogador: na
  // primeira medicao, com peso chegando a 4 (o mesmo da madeira), as fases 57 e
  // 58 cairam de 12 e 10 toques para 6. Como perigo ocasional ele acrescenta
  // variedade; como material comum, ele resolve a fase.
  add('crystal', Math.min(1.8, 0.8 + (level - MATERIAL_DEBUT.crystal) * 0.025));
  // A cera so existe onde a lava justifica. Fora do mundo 8 ela seria um
  // material sem historia, e o jogador leria "derrete" como regra universal.
  if (theme === 'lava') add('wax', 1.6);

  // O material de apoio segura a torre quando a base e leve, escorregadia ou
  // quebradica. Sem ele o mundo do papel seria uma pilha de espuma que cede
  // inteira no primeiro toque.
  add(kit.apoio, teto < 10 ? 5.5 : 3);
  // A assinatura do mundo. Cristal e cera entram baixo mesmo sendo assinatura:
  // eles cedem sozinhos sob o hexagono e, em quantidade, resolvem a fase no
  // lugar do jogador - medido, com peso 4 as fases de cristal cairam de doze
  // para seis toques.
  if (kit.assinatura) {
    add(kit.assinatura, HOLD_MATERIALS.has(kit.assinatura) ? 2 : 4.5);
  }

  // O material-base perde espaco conforme os especiais entram.
  const outros = Object.keys(materialWeights).filter((id) => id !== base);
  materialWeights[base] = Math.max(teto * 0.55, teto - outros.length * 0.7);
  if (teto < 10) {
    // Base fragil: em vez de inflar a base ate a torre virar um escorregador,
    // os outros encolhem. "Este e o mundo do gelo" sai da proporcao, e nao de
    // um numero absoluto grande.
    for (const id of outros) materialWeights[id] *= 0.7;
  }
  // A peca do mundo precisa LER como a peca do mundo: a pedra cresce com o
  // nivel e roubava o papel principal justamente nos mundos de gelo e vidro.
  const maiorOutro = outros.reduce((m, id) => Math.max(m, materialWeights[id]), 0);
  materialWeights[base] = Math.max(materialWeights[base], maiorOutro * 1.35);

  // --- pecas especiais ----------------------------------------------------
  let obsidian = 0;
  if (level >= MATERIAL_DEBUT.obsidian) {
    obsidian = 1 + Math.floor((level - MATERIAL_DEBUT.obsidian) / 30);
    // Poucas e boas. Cada peca ancorada e um lugar a mais onde o hexagono
    // pode terminar empoleirado sem ter como descer.
    obsidian = Math.min(2, obsidian);
    if (width < 4 || rows < 7) obsidian = 0;
  }
  let bombs = 0;
  if (level >= MATERIAL_DEBUT.bomb) bombs = r.chance(0.55) ? 1 : 0;
  let tnt = 0;
  if (level >= MATERIAL_DEBUT.tnt) tnt = r.chance(0.5) ? 1 : 0;

  // --- pedestal -----------------------------------------------------------
  // O pedestal comeca bem mais largo que a torre e vai encolhendo. Nas
  // primeiras fases ele funciona como rede de seguranca, o que a Poki pede
  // em "comece facil e suba gradualmente".
  let pedestalFrac;
  if (i < 10) pedestalFrac = 0.95;
  else if (i < 20) pedestalFrac = 0.86;
  else if (i < 30) pedestalFrac = 0.78;
  else if (i < 45) pedestalFrac = 0.7;
  else if (i < 60) pedestalFrac = 0.62;
  else if (i < 80) pedestalFrac = 0.54;
  else if (i < 95) pedestalFrac = 0.46;
  else pedestalFrac = 0.4;
  const pedestalHalf = Math.max(1.35, width * pedestalFrac);

  // Os limiares abaixo acompanharam o deslocamento de dez fases que o tutorial
  // longo produziu: o jogador chega em cada novidade com a mesma bagagem de
  // antes, e nao dez fases mais cedo na curva.
  const oscillate = level >= 75 ? 0.35 + Math.min(0.55, (level - 75) * 0.018) : 0;
  const wind = level >= 85 ? (r.chance(0.5) ? 1 : -1) * (0.7 + (level - 85) * 0.035) : 0;

  let hexScale = 1;
  if (level >= 38 && r.chance(0.16)) hexScale = 1.16;
  else if (level >= 50 && r.chance(0.14)) hexScale = 0.86;

  const hexOffset = level >= 34 && r.chance(0.3) ? (r.chance(0.5) ? -0.7 : 0.7) : 0;

  // Barras que atravessam a torre inteira sao o encaixe mais seguro que existe:
  // tirar uma faz tudo acima descer reto, sem degrau para o hexagono tombar.
  // As primeiras fases sao feitas quase so delas, e a mistura entra devagar.
  let barBias = 0;
  if (level <= 3) barBias = 1;
  else if (level <= 8) barBias = 0.5;
  else if (level <= 14) barBias = 0.22;
  else if (level <= 22) barBias = 0.08;

  const newMaterials = Object.keys(MATERIAL_DEBUT).filter((m) => {
    if (MATERIAL_DEBUT[m] !== level) return false;
    // Bloco e madeira estreiam juntos no calendario, e agora cada mundo tem a
    // sua propria peca dominante: o mundo so apresenta o que de fato coloca na
    // torre. Anunciar "gelo!" num mundo sem gelo seria mentira.
    if (m === 'obsidian' || m === 'bomb' || m === 'tnt') return true;
    return m in materialWeights;
  });
  // Uma mecanica nova de cada vez, e sempre numa fase facil. A fase de estreia
  // de um material ganha mais barras e perde uma linha, para o jogador aprender
  // como ele se comporta antes de precisar dele sob pressao.
  if (newMaterials.length) {
    barBias = Math.max(barBias, 0.45);
    rows = Math.max(4, rows - 2);
    tierMax = Math.max(1, tierMax - 1);
  }

  /** @type {LevelConfig} */
  const config = {
    index: i,
    level,
    width,
    rows,
    tierMax,
    materialWeights,
    obsidian,
    bombs,
    tnt,
    bandMerge: Math.min(0.55, 0.1 + p * 0.5),
    barBias,
    pedestalHalf,
    oscillate,
    wind,
    hexScale,
    hexOffset,
    theme,
    newMaterials,
  };
  // O roteiro vem por cima da curva e da regra de estreia: o bloco "estreia"
  // na fase 1, e a regra cortaria duas linhas justo da fase que tem que
  // mostrar o jogo.
  const roteiro = PRIMEIRAS_FASES[i];
  if (roteiro) {
    Object.assign(config, roteiro);
    config.pedestalHalf = Math.max(1.35, roteiro.width * pedestalFrac);
  }
  return soften > 0 ? softenConfig(config, soften) : config;
}

/** Materiais que tornam a fase imprevisivel, na ordem em que sao aliviados. */
const HAZARDS = ['tnt', 'crystal', 'wax', 'bomb', 'foam', 'glass', 'metal', 'rubber', 'ice'];

/**
 * Afrouxa uma configuracao em degraus.
 *
 * O validador so chega aqui quando nenhuma variante da fase original passou.
 * Preferimos uma fase um pouco mais facil do que uma fase impossivel, e o
 * degrau usado fica gravado no arquivo de fases para o cliente reconstruir
 * exatamente a mesma configuracao.
 *
 * @param {LevelConfig} config
 * @param {number} step 1 a 3
 * @returns {LevelConfig}
 */
export function softenConfig(config, step) {
  const c = { ...config, materialWeights: { ...config.materialWeights } };
  c.obsidian = 0;
  c.bombs = 0;
  // TNT e o perigo de maior variancia: o alivio mais barato de uma fase
  // impossivel e tirar a caixa que apaga meia torre.
  c.tnt = 0;
  c.pedestalHalf = config.pedestalHalf * 1.25;
  c.wind = config.wind * 0.5;
  for (const h of HAZARDS) {
    if (c.materialWeights[h]) c.materialWeights[h] *= 0.5;
  }

  c.barBias = Math.min(1, (config.barBias || 0) + 0.2);

  if (step >= 2) {
    c.rows = Math.max(4, Math.round(config.rows * 0.75));
    c.barBias = Math.min(1, (config.barBias || 0) + 0.4);
    c.tierMax = Math.max(1, config.tierMax - 1);
    c.oscillate = config.oscillate * 0.5;
    c.pedestalHalf = config.pedestalHalf * 1.4;
    c.hexOffset = 0;
    for (const h of HAZARDS) {
      if (c.materialWeights[h]) c.materialWeights[h] *= 0.5;
    }
  }

  if (step >= 3) {
    c.rows = Math.max(4, Math.round(config.rows * 0.6));
    c.tierMax = Math.max(1, config.tierMax - 1);
    c.oscillate = 0;
    c.wind = 0;
    c.hexScale = 1;
    c.pedestalHalf = Math.max(config.pedestalHalf * 1.6, c.width * 0.8);
    // Aqui o objetivo e so a fase existir, entao base fragil cede lugar ao
    // apoio: um degrau 3 feito de gelo seria mais dificil que o original.
    const seguro = baseMaterial(config.theme, config.level, true);
    c.materialWeights =
      seguro === 'stone' ? { stone: 10, wood: 3 } : { [seguro]: 10, stone: 3 };
    c.bandMerge = 0.1;
    c.barBias = Math.min(1, (config.barBias || 0) + 0.6);
  }

  c.softened = step;
  return c;
}

/**
 * Preenche um retangulo com poliminos, sem sobra nem sobreposicao.
 *
 * Busca a celula vazia mais baixa e mais a esquerda e tenta encaixar ali a
 * celula ancora de cada forma candidata. Como a ancora e sempre a primeira
 * celula na ordem canonica, nenhuma combinacao e testada duas vezes.
 *
 * @param {number} w
 * @param {number} h
 * @param {{id:string, cells:[number,number][]}[]} catalog
 * @param {Rng} rng
 * @param {number} budget teto de tentativas antes de desistir
 * @returns {{id:string, cells:[number,number][], x:number, y:number}[]|null}
 */
export function tileRect(w, h, catalog, rng, budget = 60000) {
  /** @type {boolean[]} */
  const grid = new Array(w * h).fill(false);
  /** @type {{id:string, cells:[number,number][], x:number, y:number}[]} */
  const placed = [];

  /** @type {{id:string, cells:[number,number][]}[]} */
  const options = [];
  for (const shape of catalog) {
    for (const cells of orientations(shape.cells)) {
      const b = bounds(cells);
      if (b.w > w || b.h > h) continue;
      options.push({ id: shape.id, cells: /** @type {[number,number][]} */ (cells) });
    }
  }
  if (!options.length) return null;

  let steps = 0;

  /** @returns {number} indice da primeira celula vazia ou -1 */
  const firstEmpty = () => {
    for (let i = 0; i < grid.length; i++) {
      if (!grid[i]) return i;
    }
    return -1;
  };

  /**
   * @param {{id:string, cells:[number,number][]}} option
   * @param {number} ax
   * @param {number} ay
   * @returns {number[]|null} indices ocupados
   */
  const tryPlace = (option, ax, ay) => {
    const anchor = option.cells[0];
    const dx = ax - anchor[0];
    const dy = ay - anchor[1];
    /** @type {number[]} */
    const idx = [];
    for (const [cx, cy] of option.cells) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || x >= w || y < 0 || y >= h) return null;
      const i = y * w + x;
      if (grid[i]) return null;
      idx.push(i);
    }
    return idx;
  };

  /** @returns {boolean} */
  const solve = () => {
    if (steps++ > budget) return false;
    const empty = firstEmpty();
    if (empty === -1) return true;
    const ax = empty % w;
    const ay = Math.floor(empty / w);

    const candidates = rng.shuffle(options.slice());
    for (const option of candidates) {
      const idx = tryPlace(option, ax, ay);
      if (!idx) continue;
      for (const i of idx) grid[i] = true;
      const anchor = option.cells[0];
      placed.push({
        id: option.id,
        cells: option.cells,
        x: ax - anchor[0],
        y: ay - anchor[1],
      });
      if (solve()) return true;
      placed.pop();
      for (const i of idx) grid[i] = false;
      if (steps > budget) return false;
    }
    return false;
  };

  if (solve()) return placed;
  return null;
}

/**
 * Preenchimento de emergencia: monominos onde a busca nao fechou.
 * @param {number} w
 * @param {number} h
 * @returns {{id:string, cells:[number,number][], x:number, y:number}[]}
 */
function fallbackTiling(w, h) {
  const out = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out.push({ id: 'mono', cells: /** @type {[number,number][]} */ ([[0, 0]]), x, y });
    }
  }
  return out;
}

/**
 * Divide a torre em faixas horizontais, como no jogo de referencia.
 * @param {number} rows
 * @param {Rng} rng
 * @param {number} mergeChance
 * @returns {number[]} alturas das faixas, de baixo para cima
 */
function bandHeights(rows, rng, mergeChance) {
  /** @type {number[]} */
  const bands = [];
  let left = rows;
  while (left > 0) {
    if (left <= 4) {
      bands.push(left);
      break;
    }
    let h = rng.chance(0.55) ? 2 : 3;
    if (rng.chance(mergeChance)) h += rng.chance(0.5) ? 2 : 1;
    h = Math.min(h, left);
    if (left - h === 1) h = Math.min(left, h + 1);
    bands.push(h);
    left -= h;
  }
  return bands;
}

/**
 * Gera o layout completo de uma variante.
 * @param {LevelConfig} config
 * @param {number} seed
 * @returns {import('../physics/world.js').LevelLayout}
 */
export function generateLayout(config, seed) {
  const rng = new Rng(seed >>> 0);
  const { width, rows } = config;
  const base = baseMaterial(config.theme, config.level);

  const catalog = SHAPE_LIST.filter((s) => {
    if (s.tier > config.tierMax) return false;
    const b = bounds(s.cells);
    return b.w <= width && b.h <= Math.max(2, rows);
  });
  const safeCatalog = catalog.length ? catalog : SHAPE_LIST.filter((s) => s.tier === 1);

  const bands = bandHeights(rows, rng, config.bandMerge);
  /** @type {{shape:string, cells:[number,number][], material:string, x:number, y:number, band:number}[]} */
  const pieces = [];
  let baseY = 0;
  /** @type {[number,number][]} */
  const barCells = [];
  for (let x = 0; x < width; x++) barCells.push([x, 0]);

  bands.forEach((bandH, bandIndex) => {
    if (config.barBias > 0 && rng.chance(config.barBias)) {
      for (let row = 0; row < bandH; row++) {
        pieces.push({
          shape: 'bar' + width,
          cells: barCells.map((c) => /** @type {[number,number]} */ ([c[0], c[1]])),
          material: base,
          x: 0,
          y: baseY + row,
          band: bandIndex,
        });
      }
      baseY += bandH;
      return;
    }
    const usable = safeCatalog.filter((s) => {
      const b = bounds(s.cells);
      return b.h <= bandH && b.w <= width;
    });
    const list = usable.length ? usable : safeCatalog.filter((s) => s.tier === 1);
    const tiling = tileRect(width, bandH, list, rng) || fallbackTiling(width, bandH);
    for (const t of tiling) {
      pieces.push({
        shape: t.id,
        cells: /** @type {[number,number][]} */ (normalize(t.cells)),
        material: base,
        x: t.x,
        y: baseY + t.y,
        band: bandIndex,
      });
    }
    baseY += bandH;
  });

  // --- materiais ----------------------------------------------------------
  const matIds = Object.keys(config.materialWeights);
  const matWeights = matIds.map((id) => config.materialWeights[id]);
  // Em fases avancadas, faixas inteiras podem ter um material so.
  const bandMaterial = new Map();
  // Uma faixa inteira de cristal ou cera se dissolveria de uma vez sob o
  // hexagono; o sorteio de faixa usa so os materiais estaveis. Mesmo numero de
  // sorteios, entao o fluxo do Rng nao desloca.
  const bandIds = matIds.filter((id) => !HOLD_MATERIALS.has(id));
  const bandWeights = bandIds.map((id) => config.materialWeights[id]);
  for (let b = 0; b < bands.length; b++) {
    if (config.level >= 30 && rng.chance(0.28)) {
      bandMaterial.set(b, rng.weighted(bandIds, bandWeights));
    }
  }
  for (const piece of pieces) {
    const forced = bandMaterial.get(piece.band);
    piece.material = forced || rng.weighted(matIds, matWeights);
  }

  // --- obsidiana ----------------------------------------------------------
  // Nunca em uma peca que atravesse a torre inteira, para nao criar uma laje
  // impassavel, e nunca na faixa mais alta, onde bloquearia a descida inicial.
  // A obsidiana e ancorada: fica parada no ar quando o que estava embaixo some.
  // Por isso ela so pode encostar nas laterais da torre e nunca ocupar o
  // corredor central, senao o hexagono terminaria empoleirado nela sem ter
  // como descer, e a fase viraria um beco sem saida.
  if (config.obsidian > 0) {
    const topBand = bands.length - 1;
    const bottomRows = 2;
    const candidates = pieces.filter((p) => {
      const b = bounds(p.cells);
      if (b.w >= width) return false;
      if (p.band === topBand) return false;
      if (p.y < bottomRows) return false;
      const minX = p.x;
      const maxX = p.x + b.w - 1;
      const encostaNaLateral = minX === 0 || maxX === width - 1;
      const larguraSegura = b.w <= Math.max(1, Math.floor(width / 2));
      return encostaNaLateral && larguraSegura;
    });
    rng.shuffle(candidates);
    const limit = Math.min(config.obsidian, candidates.length, 2);
    for (let i = 0; i < limit; i++) candidates[i].material = 'obsidian';
  }

  // --- bombas -------------------------------------------------------------
  if (config.bombs > 0) {
    const candidates = pieces.filter((p) => p.material !== 'obsidian' && p.cells.length <= 4);
    rng.shuffle(candidates);
    for (let i = 0; i < Math.min(config.bombs, candidates.length); i++) {
      candidates[i].material = 'bomb';
    }
  }

  // --- tnt ----------------------------------------------------------------
  // Nunca na faixa mais alta: o hexagono nasce sobre ela e a primeira queda
  // detonaria antes de o jogador entender o que e aquela caixa. Nunca na linha
  // de base: ali a explosao apagaria a plataforma de pouso.
  if (config.tnt > 0) {
    const topo = bands.length - 1;
    const candidates = pieces.filter(
      (p) =>
        p.material !== 'obsidian' &&
        p.material !== 'bomb' &&
        p.cells.length <= 4 &&
        p.band !== topo &&
        p.y >= 1,
    );
    rng.shuffle(candidates);
    for (let i2 = 0; i2 < Math.min(config.tnt, candidates.length); i2++) {
      candidates[i2].material = 'tnt';
    }
  }

  // --- material temporal fora da faixa do topo ----------------------------
  // O hexagono nasce em cima da ultima faixa. Se ela for de cristal, a trinca
  // comeca antes do primeiro toque - e na fase de estreia isso acontece com a
  // legenda do tutorial ainda na tela.
  {
    const topo = bands.length - 1;
    for (const p of pieces) {
      if (p.band === topo && HOLD_MATERIALS.has(p.material)) p.material = base;
    }
  }

  // --- pedestal, estrelas e hexagono -------------------------------------
  const centerX = (width * CELL) / 2;
  const hexRadius = HEX_RADIUS * config.hexScale;
  const winLine = hexRadius * 0.866 + 0.18;
  // As tres linhas precisam de folga entre si mesmo em torres baixas, senao
  // as tres estrelas acendem praticamente ao mesmo tempo e nao informam nada.
  const line2 = Math.max(winLine + 1.15, rows * CELL * 0.32);
  const line1 = Math.max(line2 + 1.15, rows * CELL * 0.64);
  const starLines = [line1, line2, winLine];

  return {
    width,
    height: rows,
    pieces: pieces.map((p) => ({
      shape: p.shape,
      cells: p.cells,
      material: p.material,
      x: p.x,
      y: p.y,
    })),
    hexagon: { x: centerX + config.hexOffset },
    pedestal: {
      x: centerX,
      halfWidth: config.pedestalHalf,
      oscillate: config.oscillate,
    },
    starLines,
    wind: config.wind,
    hexScale: config.hexScale,
  };
}
