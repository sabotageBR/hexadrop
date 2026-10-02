/**
 * As fases depois da 100.
 *
 * O jogo tem 100 fases assadas (`LEVEL_COUNT`), e ele parava ali. Medido no
 * painel da Poki com a 1.0.7: a fase 100 teve 85 partidas, MAIS que a 57 e a
 * 60 - quem terminava o jogo ficava rejogando a ultima fase, porque a home so
 * oferecia "Jogar 100". O Web Fit Test cobra tempo na pagina, e o jogador mais
 * fiel era justamente o que ficava sem nada.
 *
 * Da 101 em diante nada e gerado: cada fase reusa uma fase JA VALIDADA da
 * segunda metade do jogo (51 a 100), com a mesma seed e o mesmo degrau de
 * afrouxamento. Nenhuma fase nova a certificar, nada invalidado.
 *
 * Tudo vem da fase de origem - layout, pele, musica e kit -, porque o tema faz
 * parte do layout: `THEME_MATERIALS` decide a peca dominante pelo tema, e uma
 * torre de gelo pintada com a pele do doce seria uma torre de gelo com outro
 * ceu. Os mundos depois do 20 seguem o ciclo de `worldTheme()` sem emenda (o
 * 20 e classico, o 21 e gelo), e a origem de cada um e o mundo da segunda
 * metade com o mesmo tema. Cada volta pelo mesmo tema usa outra variante.
 *
 * `LEVEL_COUNT` continua 100 e nao pode mudar por causa disto: ele entra nas
 * curvas do gerador, e muda-lo trocaria o layout das cem fases.
 *
 * Puro, como o resto de `game/`: nada de window, document ou performance.
 */
import {
  LEVEL_COUNT,
  WORLD_COUNT,
  indexInWorld,
  worldOf,
  worldSize,
  worldStart,
  worldTheme,
} from './levelgen.js';

/** Mundos (0-based) de onde as fases depois da 100 tiram o layout. */
const MUNDOS_DE_ORIGEM = Array.from(
  { length: WORLD_COUNT - Math.floor(WORLD_COUNT / 2) },
  (_, k) => Math.floor(WORLD_COUNT / 2) + k,
);

/** @type {Map<string, number[]>} tema -> mundos de origem com esse tema */
const ORIGENS = new Map();
for (const w of MUNDOS_DE_ORIGEM) {
  const tema = worldTheme(w);
  if (!ORIGENS.has(tema)) ORIGENS.set(tema, []);
  /** @type {number[]} */ (ORIGENS.get(tema)).push(w);
}

/**
 * Mundo de origem do j-esimo mundo depois do ultimo (j = 0 e o mundo 21), e
 * quantas vezes essa mesma origem ja foi usada antes - e a `visita` que
 * escolhe a variante.
 * @param {number} j
 * @returns {{origem:number, visita:number}}
 */
function origemDoMundo(j) {
  const w = WORLD_COUNT + j;
  const tema = worldTheme(w);
  const lista = ORIGENS.get(tema);
  if (lista && lista.length) {
    // Quantos mundos com este tema vieram antes, desde o 21: um a cada volta
    // do ciclo de temas.
    let antes = 0;
    for (let k = WORLD_COUNT; k < w; k++) if (worldTheme(k) === tema) antes++;
    return { origem: lista[antes % lista.length], visita: Math.floor(antes / lista.length) };
  }
  // Tema sem mundo na segunda metade (so acontece se WORLD_SIZES mudar):
  // rodizio por todas as origens.
  const n = MUNDOS_DE_ORIGEM.length;
  return { origem: MUNDOS_DE_ORIGEM[j % n], visita: Math.floor(j / n) };
}

/**
 * @typedef {object} FaseDeOrigem
 * @property {number} level a fase que o jogador ve (1, 2, ... 137 ...)
 * @property {number} index indice 0-based da fase assada que da o layout
 * @property {number} mundo mundo exibido, 0-based (20 em diante depois da 100)
 * @property {string} tema tema do mundo exibido, que e o da origem
 * @property {number} visita quantas vezes a origem ja foi usada antes (0 ate a 100)
 * @property {boolean} alem fase depois da 100
 * @property {number} posNoMundo posicao da fase dentro do mundo exibido, 0-based
 * @property {number} tamanho fases no mundo exibido
 * @property {boolean} fimDeMundo e a ultima fase do mundo exibido
 * @property {number} primeira numero da primeira fase do mundo exibido
 */

/**
 * De onde vem a fase `level` (1-based, sem teto).
 * @param {number} level
 * @returns {FaseDeOrigem}
 */
export function faseDeOrigem(level) {
  const n = Math.max(1, level | 0);
  if (n <= LEVEL_COUNT) {
    const index = n - 1;
    const mundo = worldOf(index);
    const pos = indexInWorld(index);
    const tamanho = worldSize(mundo);
    return {
      level: n,
      index,
      mundo,
      tema: worldTheme(mundo),
      visita: 0,
      alem: false,
      posNoMundo: pos,
      tamanho,
      fimDeMundo: pos === tamanho - 1,
      primeira: worldStart(mundo) + 1,
    };
  }
  let resto = n - LEVEL_COUNT - 1;
  let primeira = LEVEL_COUNT + 1;
  for (let j = 0; ; j++) {
    const { origem, visita } = origemDoMundo(j);
    const tamanho = worldSize(origem);
    if (resto < tamanho) {
      return {
        level: n,
        index: worldStart(origem) + resto,
        mundo: WORLD_COUNT + j,
        tema: worldTheme(origem),
        visita,
        alem: true,
        posNoMundo: resto,
        tamanho,
        fimDeMundo: resto === tamanho - 1,
        primeira,
      };
    }
    resto -= tamanho;
    primeira += tamanho;
  }
}

/**
 * Primeira fase de um mundo exibido, inclusive os depois do ultimo.
 * @param {number} mundo 0-based
 * @returns {number} numero da fase (1-based)
 */
export function primeiraFaseDoMundo(mundo) {
  const w = Math.max(0, mundo | 0);
  if (w < WORLD_COUNT) return worldStart(w) + 1;
  let primeira = LEVEL_COUNT + 1;
  for (let j = 0; j < w - WORLD_COUNT; j++) primeira += worldSize(origemDoMundo(j).origem);
  return primeira;
}
