/**
 * Catalogo de poliminos e utilitarios de geometria de grade.
 *
 * Uma peca e um conjunto de celulas [coluna, linha], com a linha crescendo
 * para cima. Tudo aqui e puro e deterministico: o gerador offline e o cliente
 * executam exatamente o mesmo codigo.
 */

/** @typedef {[number, number]} Cell */

/**
 * @typedef {object} ShapeDef
 * @property {string} id
 * @property {Cell[]} cells
 * @property {number} tier 1 = simples, 4 = avancado
 * @property {boolean} [hole] tem buraco interno
 */

/** @type {ShapeDef[]} */
export const SHAPE_LIST = [
  // --- tier 1: formas basicas -------------------------------------------
  { id: 'mono', tier: 1, cells: [[0, 0]] },
  { id: 'domino', tier: 1, cells: [[0, 0], [1, 0]] },
  { id: 'i3', tier: 1, cells: [[0, 0], [1, 0], [2, 0]] },
  { id: 'o4', tier: 1, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: 'i4', tier: 1, cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { id: 'l3', tier: 1, cells: [[0, 0], [1, 0], [0, 1]] },

  // --- tier 2: tetrominos completos --------------------------------------
  { id: 'l4', tier: 2, cells: [[0, 0], [1, 0], [2, 0], [0, 1]] },
  { id: 'j4', tier: 2, cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
  { id: 't4', tier: 2, cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { id: 'i5', tier: 2, cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
  { id: 'rect23', tier: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]] },

  // --- tier 3: pentominos e formas em degrau -----------------------------
  { id: 's4', tier: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { id: 'z4', tier: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { id: 'u5', tier: 3, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]] },
  { id: 'p5', tier: 3, cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]] },
  { id: 'l5', tier: 3, cells: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1]] },
  { id: 'v5', tier: 3, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]] },
  { id: 't5', tier: 3, cells: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]] },
  { id: 'y5', tier: 3, cells: [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1]] },
  { id: 'n5', tier: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1]] },
  { id: 'w5', tier: 3, cells: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]] },
  { id: 'z5', tier: 3, cells: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]] },

  // --- tier 4: grandes, com recortes e buracos ---------------------------
  { id: 'x5', tier: 4, cells: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]] },
  { id: 'f5', tier: 4, cells: [[1, 0], [1, 1], [2, 1], [0, 2], [1, 2]] },
  { id: 'rect32', tier: 4, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
  { id: 'c7', tier: 4, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2], [1, 2], [2, 2]] },
  { id: 'h7', tier: 4, cells: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [2, 2]] },
  { id: 'l6', tier: 4, cells: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [0, 2]] },
  { id: 'u7', tier: 4, cells: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [3, 1], [0, 2]] },
  {
    id: 'ring8',
    tier: 4,
    hole: true,
    cells: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
  },
  {
    id: 'frame10',
    tier: 4,
    hole: true,
    cells: [
      [0, 0], [1, 0], [2, 0], [3, 0],
      [0, 1], [3, 1],
      [0, 2], [1, 2], [2, 2], [3, 2],
    ],
  },
  { id: 'rect24', tier: 4, cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2], [0, 3], [1, 3]] },
];

/** @type {Record<string, ShapeDef>} */
export const SHAPES = {};
for (const s of SHAPE_LIST) SHAPES[s.id] = s;

/**
 * Move as celulas para a origem.
 * @param {Cell[]} cells
 * @returns {Cell[]}
 */
export function normalize(cells) {
  let minX = Infinity;
  let minY = Infinity;
  for (const [x, y] of cells) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }
  const out = cells.map(([x, y]) => /** @type {Cell} */ ([x - minX, y - minY]));
  out.sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
  return out;
}

/**
 * Rotaciona 90 graus no sentido anti-horario.
 * @param {Cell[]} cells
 * @returns {Cell[]}
 */
export function rotate90(cells) {
  return normalize(cells.map(([x, y]) => /** @type {Cell} */ ([-y, x])));
}

/**
 * Espelha no eixo vertical.
 * @param {Cell[]} cells
 * @returns {Cell[]}
 */
export function mirror(cells) {
  return normalize(cells.map(([x, y]) => /** @type {Cell} */ ([-x, y])));
}

/**
 * @param {Cell[]} cells
 * @returns {string}
 */
export function cellsKey(cells) {
  return normalize(cells).map(([x, y]) => x + ',' + y).join(';');
}

/**
 * Todas as orientacoes distintas (rotacoes e espelhos).
 * @param {Cell[]} cells
 * @returns {Cell[][]}
 */
export function orientations(cells) {
  /** @type {Map<string, Cell[]>} */
  const seen = new Map();
  let base = normalize(cells);
  for (let m = 0; m < 2; m++) {
    let cur = m === 0 ? base : mirror(base);
    for (let r = 0; r < 4; r++) {
      const key = cellsKey(cur);
      if (!seen.has(key)) seen.set(key, cur);
      cur = rotate90(cur);
    }
  }
  return [...seen.values()];
}

/**
 * @param {Cell[]} cells
 * @returns {{w:number, h:number}}
 */
export function bounds(cells) {
  let w = 0;
  let h = 0;
  for (const [x, y] of cells) {
    if (x + 1 > w) w = x + 1;
    if (y + 1 > h) h = y + 1;
  }
  return { w, h };
}

/**
 * Decompoe um conjunto de celulas em retangulos maximais.
 *
 * Isso reduz o numero de fixtures do corpo e, principalmente, remove as
 * costuras internas entre celulas vizinhas, onde outro corpo deslizando
 * poderia engatar num canto invisivel.
 *
 * @param {Cell[]} cells
 * @returns {{x:number, y:number, w:number, h:number}[]}
 */
export function toRects(cells) {
  const { w, h } = bounds(cells);
  /** @type {boolean[][]} */
  const grid = [];
  for (let y = 0; y < h; y++) grid.push(new Array(w).fill(false));
  for (const [x, y] of cells) grid[y][x] = true;

  /** @type {{x:number, y:number, w:number, h:number}[]} */
  const rects = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!grid[y][x]) continue;
      // largura maxima nesta linha
      let rw = 0;
      while (x + rw < w && grid[y][x + rw]) rw++;
      // altura maxima mantendo essa largura cheia
      let rh = 1;
      outer: while (y + rh < h) {
        for (let i = 0; i < rw; i++) {
          if (!grid[y + rh][x + i]) break outer;
        }
        rh++;
      }
      for (let j = 0; j < rh; j++) {
        for (let i = 0; i < rw; i++) grid[y + j][x + i] = false;
      }
      rects.push({ x, y, w: rw, h: rh });
    }
  }
  return rects;
}

/**
 * Arestas externas do contorno, usadas para desenhar o perfil da peca.
 * Retorna segmentos [x1,y1,x2,y2] em coordenadas de celula.
 * @param {Cell[]} cells
 * @returns {number[][]}
 */
export function outlineEdges(cells) {
  const set = new Set(cells.map(([x, y]) => x + ',' + y));
  /** @type {number[][]} */
  const edges = [];
  for (const [x, y] of cells) {
    if (!set.has(x + ',' + (y + 1))) edges.push([x, y + 1, x + 1, y + 1]);
    if (!set.has(x + ',' + (y - 1))) edges.push([x, y, x + 1, y]);
    if (!set.has((x - 1) + ',' + y)) edges.push([x, y, x, y + 1]);
    if (!set.has((x + 1) + ',' + y)) edges.push([x + 1, y, x + 1, y + 1]);
  }
  return edges;
}

/**
 * Centro geometrico das celulas, em coordenadas de celula.
 * @param {Cell[]} cells
 * @returns {{x:number, y:number}}
 */
export function centroid(cells) {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of cells) {
    sx += x + 0.5;
    sy += y + 0.5;
  }
  return { x: sx / cells.length, y: sy / cells.length };
}

/**
 * Formas liberadas por nivel de dificuldade.
 * @param {number} maxTier
 * @param {number} maxWidth largura maxima aceitavel em celulas
 * @returns {ShapeDef[]}
 */
export function shapesUpTo(maxTier, maxWidth) {
  return SHAPE_LIST.filter((s) => {
    if (s.tier > maxTier) return false;
    const b = bounds(s.cells);
    return Math.min(b.w, b.h) <= maxWidth;
  });
}

/**
 * Contorno fechado de um polimino, em coordenadas de celula.
 *
 * Emite as arestas de borda com orientacao consistente (anti-horaria para o
 * contorno externo, horaria para buracos) e as encadeia em laços. E isso que
 * permite desenhar a peca como um unico traço continuo, com cantos
 * arredondados, em vez de varios retangulos com costuras visiveis.
 *
 * @param {Cell[]} cells
 * @returns {number[][][]} lista de laços, cada um uma lista de pontos [x,y]
 */
export function outlineLoops(cells) {
  const set = new Set(cells.map(([x, y]) => x + ',' + y));
  /** @type {Map<string, [number,number][]>} */
  const starts = new Map();
  const key = (/** @type {number} */ x, /** @type {number} */ y) => x + ',' + y;

  /** @param {[number,number]} a @param {[number,number]} b */
  const push = (a, b) => {
    const k = key(a[0], a[1]);
    const list = starts.get(k);
    if (list) list.push(b);
    else starts.set(k, [b]);
  };

  for (const [x, y] of cells) {
    if (!set.has(key(x, y - 1))) push([x, y], [x + 1, y]);
    if (!set.has(key(x + 1, y))) push([x + 1, y], [x + 1, y + 1]);
    if (!set.has(key(x, y + 1))) push([x + 1, y + 1], [x, y + 1]);
    if (!set.has(key(x - 1, y))) push([x, y + 1], [x, y]);
  }

  /** @type {number[][][]} */
  const loops = [];
  let guard = 0;
  while (starts.size && guard++ < 5000) {
    const firstKey = starts.keys().next().value;
    if (firstKey === undefined) break;
    const parts = firstKey.split(',');
    /** @type {[number,number]} */
    const origin = [Number(parts[0]), Number(parts[1])];
    /** @type {number[][]} */
    const loop = [];
    /** @type {[number,number]} */
    let cur = origin;
    let steps = 0;
    while (steps++ < 5000) {
      const k = key(cur[0], cur[1]);
      const list = starts.get(k);
      if (!list || !list.length) break;
      const next = /** @type {[number,number]} */ (list.shift());
      if (!list.length) starts.delete(k);
      loop.push([cur[0], cur[1]]);
      cur = next;
      if (cur[0] === origin[0] && cur[1] === origin[1]) break;
    }
    if (loop.length >= 4) loops.push(simplifyLoop(loop));
  }
  return loops;
}

/**
 * Remove pontos colineares de um laço fechado.
 * @param {number[][]} loop
 * @returns {number[][]}
 */
function simplifyLoop(loop) {
  /** @type {number[][]} */
  const out = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const prev = loop[(i - 1 + n) % n];
    const cur = loop[i];
    const next = loop[(i + 1) % n];
    const ax = cur[0] - prev[0];
    const ay = cur[1] - prev[1];
    const bx = next[0] - cur[0];
    const by = next[1] - cur[1];
    if (ax * by - ay * bx !== 0) out.push(cur);
  }
  return out.length >= 3 ? out : loop;
}
