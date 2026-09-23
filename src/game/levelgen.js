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
 * Vinte mundos de cinco fases, cem no total. O jogo ja teve quinze mundos de
 * dez, e antes disso um mundo 1 de vinte. O funil da Poki da versao 1.0.2
 * (265 partidas) mostrou quem sai nas primeiras fases saindo NO MEIO da fase
 * sem ter perdido: falha de 2% a 7% nas fases 1 a 6, contra abandono de 5% a
 * 11%. Nao era muro, era tedio - e a resposta foi encurtar o jogo, trocar de
 * cenario com mais frequencia e endurecer o comeco (torre mais alta, pedestal
 * mais estreito, borracha), tudo em `levelConfig` abaixo.
 *
 * Esta lista e a UNICA fonte de verdade sobre fronteira de mundo. Antes o "10"
 * estava literal em dezenove lugares de cinco arquivos, e bastava esquecer um
 * para o mapa abrir uma fase e o portao cobrar outra.
 */
export const WORLD_SIZES = Array.from({ length: 20 }, () => 5);

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

/**
 * Ordem dos cenarios. Os mundos percorrem esta lista e, quando ela acaba,
 * recomecam do primeiro: com vinte mundos e nove temas, o mundo 10 volta ao
 * puzzle e o 20 e o classic. Quem pergunta o tema de um mundo usa `worldTheme`,
 * nunca o indice direto - senao os mundos 10 a 20 ficam sem tema.
 */
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
];

/** @param {number} world 0-based @returns {string} tema do mundo */
export function worldTheme(world) {
  const w = Math.max(0, world | 0);
  return WORLD_THEMES[w % WORLD_THEMES.length];
}

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
 *
 * O puzzle e de BORRACHA, e nao de bloco: o jogo comeca nele, e a torre de
 * bloco das primeiras fases era a que se vencia tocando ao acaso. A borracha
 * quica e agarra, entao o hexagono pula ao pousar e a torre nao escorrega em
 * bloco - a fase 1 deixa de se resolver sozinha. O arco-iris do mundo 1 vem
 * junto: `render/sprites.js` pinta a base do puzzle com as sete cores da marca,
 * seja ela bloco ou borracha.
 */
const THEME_MATERIALS = {
  puzzle: { base: 'rubber', apoio: 'stone', assinatura: '', teto: 10 },
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
 * `minPieces` e `minPar` nao mudam o layout: sao exigencias que
 * tools/generate-levels.mjs cobra antes de aceitar uma seed. O `minPar` tira as
 * torres que desabam inteiras em poucos toques - bonitas, mas de novo uma fase
 * que acaba antes de o jogador entender o que fez.
 *
 * O roteiro ja exigiu perdao TOTAL (`minForgiveness: 1`, toda partida ao acaso
 * vencia), e depois caiu para a faixa comum abrindo em 0,5 sobre pedestal de
 * 1,5x, porque o funil da 1.0.2 parecia dizer que o jogador saia da fase 1 por
 * tedio. O funil da 1.0.3 desmentiu: com a fase 1 derrubando 20% dos jogadores,
 * cerca de 36% de quem perde uma fase desiste dela, e quem saia no meio da fase
 * 1 era o jogador de desktop (18%, contra 5,6% no celular) que nem via o
 * pedestal na tela. Hoje o roteiro continua em 6x8 e 6x9 - a altura e o que da
 * tempo de fase -, mas o pedestal volta a 1,9x a torre e a faixa de perdao abre
 * em 0,85.
 */
const PRIMEIRAS_FASES = [
  // "Toque nas pecas": oito linhas de borracha, formas de ate quatro blocos.
  { width: 6, rows: 8, barBias: 0.15, tierMax: 2, minPieces: 10, minPar: 4 },
  // "Leve o hexagono": a torre inteira de formas, o caminho e escolha.
  { width: 6, rows: 8, barBias: 0.1, tierMax: 2, minPieces: 10, minPar: 4 },
  // "Cruze as linhas": uma linha a mais, para as estrelas acenderem espacadas.
  { width: 6, rows: 9, barBias: 0.1, tierMax: 2, minPieces: 10, minPar: 4 },
];

/**
 * Onde estreiam as duas mecanicas que nao sao material.
 *
 * O pedestal que balanca e o vento moram aqui, e nao em `MATERIAL_DEBUT`,
 * porque o `PhysicsWorld` nao conhece calendario: ele recebe a amplitude e a
 * forca prontas no layout.
 *
 * O vento estreia na fase 10, com as pecas. O pedestal que balanca estreava na
 * 8, junto com o cristal, e a fase 8 da 1.0.3 derrubou 37% dos jogadores (45% no
 * celular) contra 25% a 29% das vizinhas: duas estreias numa fase so, e uma
 * delas a mecanica mais dura do jogo. Ele passou para a 11, a primeira fase
 * depois do trecho de ensino, onde estreia sozinho.
 */
const HAZARD_DEBUT = { swing: 11, wind: 10 };

/**
 * De onde a amplitude do pedestal que balanca comeca a crescer.
 *
 * Era a propria estreia do balanco, a fase 8. A estreia mudou, a rampa nao: a
 * amplitude entra no layout, e mexer nela trocaria o pedestal de toda fase com
 * balanco do jogo e invalidaria as seeds assadas das fases 26 a 100.
 */
const BALANCO_RAMPA_DESDE = 8;

/**
 * Peso de cada material quando ele entra numa torre fora do kit do tema.
 *
 * Os pesos sobem com a distancia da estreia, como sempre subiram. O que mudou
 * e QUEM entra: veja `extras` em `levelConfig`.
 * @type {Record<string, (level: number) => number>}
 */
const PESO_EXTRA = {
  stone: (level) => (level > worldStart(1) ? 6 : 4),
  ice: (level) => Math.min(6, 2 + (level - MATERIAL_DEBUT.ice) * 0.12),
  rubber: (level) => Math.min(5, 2 + (level - MATERIAL_DEBUT.rubber) * 0.1),
  metal: (level) => Math.min(5, 2 + (level - MATERIAL_DEBUT.metal) * 0.1),
  glass: (level) => Math.min(5, 2 + (level - MATERIAL_DEBUT.glass) * 0.1),
  foam: (level) => Math.min(4, 1.5 + (level - MATERIAL_DEBUT.foam) * 0.1),
  // Peso deliberadamente pequeno, e nao so por custo de geracao. Um cristal sob
  // o hexagono cede sozinho e faz de graca o trabalho que seria do jogador: na
  // primeira medicao, com peso chegando a 4 (o mesmo da madeira), duas fases
  // cairam de 12 e 10 toques para 6. Como perigo ocasional ele acrescenta
  // variedade; como material comum, ele resolve a fase.
  crystal: (level) => Math.min(1.8, 0.8 + (level - MATERIAL_DEBUT.crystal) * 0.025),
  // A cera tambem cede sozinha. Fora da lava ela e so tempero; na lava ela e a
  // assinatura e entra pelo kit do tema.
  wax: () => 0.8,
};

/**
 * Faixa de perdao de cada fase: [piso, teto], do comeco do jogo ate
 * `SMART_RULER_FROM`.
 *
 * "Perdao" e a fracao de partidas que um jogador tocando **ao acaso** ganha,
 * medida pelo validador em seis partidas por seed, doze no trecho de ensino
 * (tools/generate-levels.mjs, `naiveRuns`) - por isso a faixa tem meia largura
 * de 1/6, que e o passo da medida mais grossa.
 *
 * Antes disto so as tres primeiras fases exigiam algo do validador, e da quarta
 * em diante o gerador ficava com a primeira seed que um jogador competente
 * vencesse. Medido, a dificuldade nao era uma rampa, era um serrote - e em
 * varios trechos ela andava para tras:
 *
 * - a fase 12 perdoava 83% das partidas ao acaso e a 13 perdoava 17%;
 * - a fase 21 perdoava 83% e a 22, logo ao lado, perdoava 8%;
 * - as fases 19 e 20 perdoavam 8% ainda dentro do mundo do tutorial, quando
 *   ele tinha vinte fases;
 * - as fases 40 e 50 perdoavam ZERO: jogando ao acaso nao se ganhava nunca;
 * - e o mundo 4 (21%) era mais difícil que o 5 (29%), como o 12 (5%) era mais
 *   difícil que o 13 (11%).
 *
 * Quem sai do jogo no comeco nao sai porque ficou difícil: sai porque ficou
 * difícil sem aviso, ou porque a fase seguinte desmentiu a anterior.
 *
 * **Piso e teto fazem coisas diferentes e as duas sao necessarias.** Piso tira
 * o paredao: seed abaixo dele e recusada. Teto faz a rampa descer: sem ele a
 * curva para de despencar mas sobe a esmo - medido, a fase 12 saiu com 96% de
 * perdao tendo piso de 50%, e o mundo 1 inteiro ficou mais facil do que era. O
 * teto e preferencia, nao exigencia: entre as seeds aprovadas o gerador escolhe
 * as que cabem nele e so extrapola se nao houver outras, para nunca trocar uma
 * fase certificada por uma sem certificado.
 *
 * A curva vai de `INICIO` na fase 1 a `FIM` na ultima fase antes da troca de
 * regua, **reta em escala logaritmica**: cada fase multiplica por um fator
 * constante a chance de um jogador ao acaso vencer. Rampa linear de dificuldade
 * e taxa constante, e nao reta em perdao - reta em perdao descia devagar demais
 * no comeco e obrigava o validador a afrouxar quase tudo no fim.
 *
 * O que guia a escolha e o **alvo**, o centro da faixa, e nao o piso: com piso
 * zero e ordenacao pelo menor perdao, medido, a curva que devia fechar em 13%
 * fechava em 2% a 5% - o paredao voltava, so que no fim em vez do comeco.
 *
 * `INICIO` ja foi 1,0 e depois 0,5. Com 0,5 a derrota da 1.0.3 ficou entre 18%
 * e 28% da fase 1 a 7 - plana, e nao rampa -, e cerca de 36% de quem perde uma
 * fase desiste nela: metade de toda a perda das dez primeiras fases veio logo
 * depois de uma derrota. Hoje a fase 1 pede 0,85, sobre pedestal de 1,9x.
 *
 * A medida tem que ter resolucao para o piso segurar alguma coisa. Com seis
 * partidas ao acaso o perdao so vale 0, 1/6, 2/6..., e as variantes assadas da
 * 1.0.3 sairam todas em 0,50, 0,33 ou 0,17 - quase tudo 0,33 da fase 3 a 8.
 * Ate `worldStart(2)` o validador joga doze partidas ao acaso (`naiveRuns` na
 * configuracao): as torres dali sao curtas e baratas de simular.
 *
 * Nada disto mexe em linha, largura, material ou pedestal: sao exigencias de
 * VALIDADOR, nao de layout.
 *
 * @param {number} i indice 0-based da fase
 * @returns {[number, number, number]} piso, teto e alvo
 */
function forgivenessBand(i) {
  const INICIO = 0.85;
  const FIM = 0.12;
  const PASSO = 1 / 6;
  const k = Math.max(0, Math.min(1, i / Math.max(1, SMART_RULER_FROM - 1)));
  const centro = INICIO * (FIM / INICIO) ** k;
  // Meia largura de um passo da medida, mais uma folga pequena: com a folga a
  // comparacao nao rejeita uma seed que mediu exatamente o valor do limite.
  const folga = 0.01;
  return [Math.max(0, centro - PASSO - folga), Math.min(1, centro + PASSO + folga), centro];
}

/**
 * Onde o perdao para de medir e a taxa do jogador competente assume: a fase 26,
 * primeira do mundo 6.
 *
 * O perdao satura: numa torre alta sobre pedestal estreito, jogador ao acaso
 * nao ganha. Na versao de 150 fases a regua acabava no mundo 8, com torres de
 * treze linhas; aqui a torre chega a quatorze linhas na fase 20, o pedestal
 * encosta na largura da torre na 26, e toda peca especial ja estreou na 10.
 * Medido sem filtro, 6x14 de borracha sobre pedestal de 1,2x ja da perdao de
 * 0,12 - dali em diante a curva de perdao nao desceria porque o jogo ficou mais
 * dificil, desceria porque a regua acabou.
 *
 * A taxa do jogador competente nao satura: na versao anterior ela ia de 94% na
 * fase 5 a 31% no fim do jogo, e continuava separando fases.
 */
const SMART_RULER_FROM = worldStart(5);

/**
 * Faixa de vitoria do jogador competente, da fase 26 ao fim.
 *
 * Reta em escala logaritmica, como a do perdao, pelo mesmo motivo: taxa de
 * dificuldade constante.
 *
 * **Esta regua nao consegue ser uma rampa lisa, e o motivo e granularidade.**
 * Com `smartRuns: 6` a medida por seed so assume 0, 1/6, 2/6 ... 1 - e como o
 * piso de aceitacao e 2/6, sobram quatro valores para oito mundos. Medido, em
 * duas rodadas completas: pedindo 0,60 a 0,35 os mundos 8 a 15 sairam em 67,
 * 62, 57, 47, 48, 58, 50, 61; pedindo 0,67 a 0,47 sairam em 68, 62, 66, 56, 64,
 * 68, 51, 61, e as fases afrouxadas subiram de 12 para 19. Mudar o alvo nao
 * conserta: entre 0,47 e 0,67 existem DOIS valores atingiveis, e uma rampa de
 * oito mundos com dois degraus so pode alternar.
 *
 * Ficaram os 0,60 a 0,35 da primeira rodada, que derivou menos (soma dos
 * degraus para cima: 22 contra 26) e afrouxou sete fases a menos. Para uma
 * descida lisa de verdade aqui seria preciso subir `smartRuns` de 6 para ~24,
 * o que multiplica por quatro o custo de gerar estas oitenta fases.
 *
 * O piso nao vai abaixo de 2/6 porque uma fase que nem o jogador competente
 * vence nao e fase difícil, e fase quebrada.
 *
 * @param {number} i indice 0-based da fase
 * @returns {[number, number, number]} piso, teto e alvo
 */
function smartBand(i) {
  const INICIO = 0.6;
  const FIM = 0.35;
  const PASSO = 1 / 6;
  const folga = 0.01;
  const span = Math.max(1, LEVEL_COUNT - 1 - SMART_RULER_FROM);
  const k = Math.max(0, Math.min(1, (i - SMART_RULER_FROM) / span));
  const centro = INICIO * (FIM / INICIO) ** k;
  return [Math.max(2 / 6 - folga, centro - PASSO - folga), Math.min(1, centro + PASSO + folga), centro];
}

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
 * @property {string[]} newHazards mecanicas que estreiam nesta fase ('swing', 'wind')
 * @property {number} [minForgiveness] o validador so aceita seed com perdao igual ou maior
 * @property {number} [maxForgiveness] entre as aprovadas, o validador prefere as ate este perdao
 * @property {number} [targetForgiveness] centro da faixa: e dele que o validador escolhe as mais proximas
 * @property {number} [minSmart] piso de vitoria do jogador competente
 * @property {number} [maxSmart] teto de vitoria do jogador competente
 * @property {number} [targetSmart] centro da faixa do jogador competente
 * @property {number} [minPieces] o validador so aceita layout com pelo menos tantas pecas
 * @property {number} [minPar] o validador so aceita seed cuja melhor solucao pede tantos toques
 * @property {number} [naiveRuns] partidas ao acaso por seed na medida do perdao
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

  // O trecho de ensino vai ate a fase 10: e ali que o jogador ja viu todas as
  // pecas e mecanicas do jogo (`MATERIAL_DEBUT`, `HAZARD_DEBUT`). Sai de
  // `worldStart`, e nao de um "10" cravado.
  const fimDoTutorial = worldStart(2);

  // --- largura da torre ---------------------------------------------------
  // Nunca menos de 4 colunas: o hexagono ocupa uma celula e meia, e numa torre
  // de 3 ele fica com margem de meia celula para cada lado, o que transforma
  // qualquer desabamento em queda certa.
  //
  // O trecho de ensino inteiro tem SEIS colunas: e a largura em que a torre tem
  // apoio dos dois lados, e ele ja chega pesado de pedestal estreito e de uma
  // peca nova por fase. Medido com seis colunas, altura e toques andam juntos:
  //
  //   altura  6     7     8     9     10    11    12
  //   toques  4,7   4,8   5,9   7,2   8,9   9,7   9,8
  //
  // Em cinco colunas a mesma altura perdoa bem menos - 5x13 mediu 0,17 de
  // perdao maximo -, e e por isso que a partir da fase 51, com torres de 16 a
  // 18 linhas, a chance de cinco colunas volta a cair.
  //
  // Cinco colunas ja apareciam a partir da fase 11. A primeira delas, a 13 da
  // 1.0.3 - 5x12 com pedestal que balanca, bomba e TNT sobre pedestal de 1,1x -,
  // derrubou METADE dos jogadores, nos dois tipos de aparelho. Agora a torre
  // estreita so vem no mundo 5, e nunca com balanco antes da fase 30.
  const cincoColunasDesde = worldStart(4);
  let width;
  if (i < cincoColunasDesde) width = 6;
  else if (i < 30) width = r.chance(0.4) ? 5 : 6;
  else if (i < 50) width = r.chance(0.5) ? 5 : 6;
  else width = r.chance(0.3) ? 5 : 6;

  // --- altura -------------------------------------------------------------
  // A altura e o eixo que mais gasta toques, mas tambem o que mais acumula
  // risco: cada degrau e uma chance de o hexagono tombar. Dois trechos: ate a
  // fase 10 a torre vai de oito a onze linhas, e dali ela sobe depressa ate
  // quatorze na fase 20 e para em dezoito.
  //
  // Mais alta que isso nao cabe no validador, e nao por custo. Medido: uma
  // torre de 35 linhas (a da fase 27 do jogo de referencia) fica de pe
  // sozinha, mas o jogador competente do solucionador nao vence nenhuma de 24
  // ou 32 linhas, e em 6x18 sobre pedestal de 1,2x ele ja vence so uma em
  // quatro, com uns vinte toques.
  //
  // A rampa comeca em OITO linhas. Uma torre de 6x6 acabava em quatro ou cinco
  // toques, e a fase do mundo 1 durava dez segundos: o jogador precisava de
  // vinte fases para somar os tres minutos que o Player Fit Test cobra. O
  // `minPar` abaixo e quem impede o validador de ficar com a seed que desaba
  // em tres toques.
  const mundo = worldOf(i);
  let rows =
    i < fimDoTutorial
      ? 8 + Math.round((i / (fimDoTutorial - 1)) * 3)
      : 11 +
        Math.round(
          Math.pow((i - fimDoTutorial) / (LEVEL_COUNT - fimDoTutorial - 1), 0.5) * 7,
        );
  const inWorld = indexInWorld(i);
  // A fase final do mundo ganha UMA linha. Nao ha mais a linha a menos na
  // abertura do mundo seguinte: com mundos de cinco fases ela cairia em uma
  // fase de cada cinco, e o que o jogador pediu foi torre maior.
  if (inWorld === worldSize(mundo) - 1) rows += 1;
  rows = Math.max(4, Math.min(18, rows));

  // --- complexidade das formas -------------------------------------------
  // Formas de quatro blocos desde a fase 1, pentominos da 7, e as grandes, com
  // recorte e buraco, da 21: na fase 27 o jogo de referencia ja e quase so C,
  // U e L de cinco blocos.
  let tierMax = 2;
  if (i >= 6) tierMax = 3;
  if (i >= 20) tierMax = 4;

  const theme = worldTheme(mundo);

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

  // Quem estreia aqui entra com certeza. Bloco e madeira estreiam no calendario
  // junto com a borracha, mas so contam se o mundo de fato os poe na torre:
  // anunciar "gelo!" num mundo sem gelo seria mentira.
  const estreias = Object.keys(PESO_EXTRA).filter((m) => MATERIAL_DEBUT[m] === level);

  // Extras: alem do kit do tema, cada torre leva DOIS materiais sorteados entre
  // os ja estreados (tres a partir da fase 50), e quem estreia na fase conta
  // entre eles. Sem esse limite, com tudo estreado ate a fase 10, toda torre
  // dali em diante sortearia os onze materiais, a base cairia para um quinto
  // das pecas e "a peca que define cada mundo" deixaria de existir.
  const kitIds = new Set([base, kit.apoio, kit.assinatura]);
  const vagas = Math.max(0, (level >= 50 ? 3 : 2) - estreias.length);
  const sorteaveis = Object.keys(PESO_EXTRA).filter(
    (m) => !kitIds.has(m) && !estreias.includes(m) && level > MATERIAL_DEBUT[m],
  );
  r.shuffle(sorteaveis);
  const extras = [...estreias, ...sorteaveis.slice(0, vagas)];
  // Apoio e assinatura tambem passam pela formula: eles ficam com o maior dos
  // dois pesos, como sempre ficaram.
  for (const id of new Set([...extras, kit.apoio, kit.assinatura])) {
    if (id && PESO_EXTRA[id]) add(id, PESO_EXTRA[id](level));
  }

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
  // A peca que estreia tem que aparecer, e em quantidade que se note: com o
  // peso da rampa (2 na estreia) e a base no minimo 1,35 vez o maior dos
  // outros, ela saia numa peca ou em nenhuma. O gerador ainda recusa a seed em
  // que ela nao aparece (tools/generate-levels.mjs).
  for (const id of estreias) {
    if (id in materialWeights && id !== base) {
      materialWeights[id] = Math.max(materialWeights[id], 4);
    }
  }

  // --- pecas especiais ----------------------------------------------------
  // Na fase de estreia a contagem e UM, sem sorteio. Antes bomba e TNT eram
  // anunciadas pelo calendario e sorteadas por fora - a fase 81 dizia "TNT!" e
  // nao tinha TNT nenhuma.
  let obsidian = 0;
  if (level === MATERIAL_DEBUT.obsidian) obsidian = 1;
  else if (level > MATERIAL_DEBUT.obsidian) {
    obsidian = 1 + Math.floor((level - MATERIAL_DEBUT.obsidian) / 20);
    // Poucas e boas. Cada peca ancorada e um lugar a mais onde o hexagono
    // pode terminar empoleirado sem ter como descer.
    obsidian = Math.min(2, obsidian);
    if (width < 4 || rows < 7) obsidian = 0;
  }
  let bombs = 0;
  if (level === MATERIAL_DEBUT.bomb) bombs = 1;
  else if (level > MATERIAL_DEBUT.bomb) bombs = r.chance(0.55) ? 1 : 0;
  let tnt = 0;
  if (level === MATERIAL_DEBUT.tnt) tnt = 1;
  else if (level > MATERIAL_DEBUT.tnt) tnt = r.chance(0.5) ? 1 : 0;

  // --- pedestal -----------------------------------------------------------
  // O pedestal comeca mais largo que a torre e encolhe ate ficar da largura
  // dela na fase 26, como no jogo de referencia.
  //
  // Na 1.0.3 ele abria em 1,5x (1,3x da fase 6 a 10), e a derrota ficou entre
  // 18% e 28% ja nas primeiras fases - com cerca de 36% de quem perde desistindo
  // ali mesmo. O pedestal e a alavanca do perdao; a altura, a do tempo de fase.
  // Por isso a torre continua alta e o pedestal voltou a abrir largo: 1,9x nas
  // tres fases de roteiro, 1,7x na 4 e na 5, 1,45x da 6 a 10.
  let pedestalFrac;
  if (i < 3) pedestalFrac = 0.95;
  else if (i < 5) pedestalFrac = 0.85;
  else if (i < fimDoTutorial) pedestalFrac = 0.72;
  else if (i < 25) pedestalFrac = 0.55;
  else if (i < 50) pedestalFrac = 0.5;
  else pedestalFrac = 0.46;
  const pedestalHalf = Math.max(1.35, width * pedestalFrac);

  // --- pedestal que balanca e vento ---------------------------------------
  // Os dois estreiam ate a fase 10, com o minimo de amplitude e de forca, e
  // dali em diante aparecem em uma fase a cada cinco, subindo ate uma em duas.
  // Nunca juntos antes da fase 30: pedestal que foge e rajada que empurra, com
  // torre alta e pedestal estreito, e uma fase que so o solucionador vence. Pela
  // mesma conta, antes da 30 o balanco tambem nao entra em torre de cinco
  // colunas. O sorteio vem ANTES da condicao de largura de proposito: pular o
  // sorteio deslocaria todos os seguintes, e o layout das fases 26 a 29 mudaria.
  const chanceMecanica = Math.min(0.5, 0.2 + (level - fimDoTutorial) * 0.005);
  let oscillate = 0;
  if (level === HAZARD_DEBUT.swing) oscillate = 0.35;
  else if (level > HAZARD_DEBUT.swing && r.chance(chanceMecanica) && !(width < 6 && level < 30)) {
    oscillate = 0.35 + Math.min(0.55, (level - BALANCO_RAMPA_DESDE) * 0.012);
  }
  let wind = 0;
  const lado = r.chance(0.5) ? 1 : -1;
  if (level === HAZARD_DEBUT.wind) wind = lado * 0.7;
  else if (level > HAZARD_DEBUT.wind && !(oscillate > 0 && level < 30) && r.chance(chanceMecanica)) {
    wind = lado * (0.7 + (level - HAZARD_DEBUT.wind) * 0.03);
  }
  const newHazards = Object.keys(HAZARD_DEBUT).filter((m) => HAZARD_DEBUT[m] === level);

  let hexScale = 1;
  if (level >= 19 && r.chance(0.16)) hexScale = 1.16;
  else if (level >= 27 && r.chance(0.14)) hexScale = 0.86;

  const hexOffset = level >= 16 && r.chance(0.3) ? (r.chance(0.5) ? -0.7 : 0.7) : 0;

  // Barras que atravessam a torre inteira sao o encaixe mais seguro que existe:
  // tirar uma faz tudo acima descer reto, sem degrau para o hexagono tombar.
  // Ja foram a torre inteira das tres primeiras fases e metade das tres
  // seguintes - exatamente as fases que se venciam tocando ao acaso.
  let barBias = 0;
  if (level <= fimDoTutorial) barBias = 0.12;
  else if (level <= 20) barBias = 0.06;

  // O que o jogador ve pela primeira vez aqui, na ordem do cartao do tutorial.
  // A fase de estreia NAO encolhe mais: ela perdia duas linhas e um tier, e
  // com uma estreia em cada fase ate a 10 isso desfaria justamente a torre
  // maior que o comeco do jogo precisava.
  const newMaterials = Object.keys(MATERIAL_DEBUT).filter((m) => {
    if (MATERIAL_DEBUT[m] !== level) return false;
    if (m === 'obsidian' || m === 'bomb' || m === 'tnt') return true;
    return m in materialWeights;
  });

  // --- piso de toques -----------------------------------------------------
  // O validador escolhe a variante mais proxima do ALVO de perdao, e nada ali
  // olha para o tamanho da solucao: numa torre de dez linhas ele pode ficar
  // com a seed que desaba em tres toques, que e exatamente a fase de dez
  // segundos que o funil da Poki mostrou. O piso corta essas.
  //
  // Folgado de proposito - medido, 6x10 entrega 8,9 toques na media, entao um
  // piso de 6 recusa a cauda curta sem estrangular a busca. O teto de 8 existe
  // porque torres altas sobre pedestal estreito ja recusam muita seed por si:
  // pedir mais ali so obrigaria a afrouxar.
  const minPar = Math.min(8, Math.max(3, Math.round(rows * 0.6)));

  /** @type {LevelConfig} */
  const config = {
    index: i,
    level,
    width,
    rows,
    minPar,
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
    newHazards,
  };
  // O roteiro vem por cima da curva: ele fixa torre, barras e as exigencias de
  // validador das tres primeiras fases.
  const roteiro = PRIMEIRAS_FASES[i];
  if (roteiro) {
    Object.assign(config, roteiro);
    config.pedestalHalf = Math.max(1.35, roteiro.width * pedestalFrac);
  }
  // Duas reguas, cada uma onde ela mede: perdao ate a fase 25, jogador
  // competente da 26 ao fim. Nenhuma fase usa as duas, senao elas se brigam.
  if (i < SMART_RULER_FROM) {
    // Doze partidas ao acaso no trecho de ensino: com seis o perdao so assume
    // sete valores e o piso da faixa nao separa uma seed da outra.
    if (i < fimDoTutorial) config.naiveRuns = 12;
    const [perdaoMin, perdaoMax, perdaoAlvo] = forgivenessBand(i);
    if (config.minForgiveness === undefined) config.minForgiveness = perdaoMin;
    config.maxForgiveness = Math.max(config.minForgiveness, perdaoMax);
    config.targetForgiveness = Math.max(config.minForgiveness, perdaoAlvo);
  } else {
    const [smartMin, smartMax, smartAlvo] = smartBand(i);
    config.minSmart = smartMin;
    config.maxSmart = smartMax;
    config.targetSmart = smartAlvo;
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
  // O piso de toques acompanha a torre encolhida - e some no degrau 3, onde o
  // objetivo ja e so a fase existir. Manter o piso original numa torre 40%
  // menor seria pedir a mesma solucao longa de uma torre que nao a tem mais.
  if (config.minPar) c.minPar = Math.max(2, Math.round(config.minPar * 0.7));

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
    c.minPar = 0;
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

  // A estreia sobrevive ao afrouxamento. O cartao do tutorial anuncia a peca
  // pelo `newMaterials`, e o gerador recusa a seed que nao a mostra: tirar a
  // obsidiana, zerar o vento ou trocar os pesos pelos do degrau 3 deixaria a
  // fase sem nenhuma seed aceitavel - ou, pior, anunciando o que nao tem.
  const estreias = config.newMaterials || [];
  if (estreias.includes('obsidian')) c.obsidian = 1;
  if (estreias.includes('bomb')) c.bombs = 1;
  if (estreias.includes('tnt')) c.tnt = 1;
  for (const m of estreias) {
    const peso = config.materialWeights[m];
    if (peso) c.materialWeights[m] = Math.max(c.materialWeights[m] || 0, Math.min(peso, 3));
  }
  const mecanicas = config.newHazards || [];
  if (mecanicas.includes('swing')) c.oscillate = config.oscillate;
  if (mecanicas.includes('wind')) c.wind = config.wind;

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
    if (config.level >= 20 && rng.chance(0.28)) {
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
