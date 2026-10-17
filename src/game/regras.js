/**
 * Regras de fase: um objetivo novo por mundo depois do ensino.
 *
 * O Web Fit Test da 1.0.15 (6:10 contra 8:27) mostrou o jogador indo embora aos
 * poucos, ~10% por fase e sem muro, e oito versoes de recompensa (premio por
 * mundo, barra, chuva, skins) sem mexer nisso. A pagina de engajamento da Poki
 * separa os dois casos: travar e dificuldade; ir embora aos poucos pede
 * "a reward or a new challenge". Recompensa ja foi medida. Desafio novo nao
 * existia: tudo estreava ate a fase 11, e dali em diante so mudavam ceu,
 * material e altura.
 *
 * As regras NAO mudam o layout. Elas valem sobre as variantes ja validadas de
 * levels.gen.js e chegam ao PhysicsWorld anexadas ao layout depois de
 * generateLayout (`comRegra`), sem consumir sorteio nenhum: sem regra, a fase e
 * identica bit a bit a que o gerador certificou. tools/validate-rules.mjs prova
 * cada variante de novo com a regra, com o mesmo solucionador, e grava o
 * parametro aprovado em regras.gen.js.
 *
 * - `joia`: uma peca da torre vira joia; nao se toca, e se cair ou quebrar perde.
 * - `cadeado`: duas a quatro pecas presas, que nao se tocam.
 * - `dourado`: o hexagono tem que repousar na faixa dourada do pedestal.
 *
 * Havia uma quarta, `toques` (limite = meta + folga), que estreava na fase 16 e
 * saiu na 1.0.19. No Player Fit Test da 1.0.18 a fase 16 perdeu 53% de quem
 * chegou nela (65% no celular), contra ~13% das vizinhas e 10% na mesma fase da
 * 1.0.15, e 49 das 68 partidas que viram o limite perderam por ele: quem toca
 * sem planejar nunca vence com limite nenhum, e esse e o jogador do funil.
 *
 * Puro: nada de window, document ou performance (o validador roda no Node).
 */

import { Rng, hashSeed } from '../core/rng.js';
import { material as getMaterial } from '../physics/materials.js';
import { worldOf, worldStart, worldSize, indexInWorld } from './levelgen.js';
import { REGRAS } from './regras.gen.js';

/** Na ordem em que estreiam. */
export const REGRA_IDS = ['joia', 'cadeado', 'dourado'];

/**
 * Indice (base 0) da fase em que cada regra estreia: uma por mundo, do 5 ao 7.
 * O mundo 3 fica de fora porque e o da estreia do pedestal que balanca (fase
 * 11) e o primeiro com derrota; o 4 ficou livre quando o limite de toques saiu.
 */
export const ESTREIA = {
  joia: worldStart(4),
  cadeado: worldStart(5),
  dourado: worldStart(6),
};

/** Materiais que nao servem de joia: quebram sozinhos ou explodem. */
const JOIA_FRAGIL = new Set(['glass', 'crystal', 'wax', 'tnt', 'bomb']);

/**
 * A regra que a agenda pede para esta fase, antes da validacao.
 *
 * - nada antes do mundo 5, nem na ultima fase de cada mundo (a da chuva de
 *   moedas e do premio), nem em fase afrouxada;
 * - no mundo de estreia, as quatro primeiras fases levam a regra nova;
 * - do mundo 8 em diante, tres das quatro primeiras levam uma regra, em
 *   rodizio, e a fase livre muda de posicao a cada mundo;
 * - o dourado nunca vai em pedestal que balanca: o alvo se mexeria, e no lugar
 *   dele vai o cadeado.
 *
 * O mundo vem de worldOf/indexInWorld, nunca de /5.
 * @param {number} index base 0, da campanha (0 a 99)
 * @param {{softened?:number, oscillate?:number}} [config] levelConfig da fase
 * @returns {string|null}
 */
export function regraDaFase(index, config) {
  if (index < ESTREIA.joia) return null;
  if (config && config.softened) return null;
  const w = worldOf(index);
  const pos = indexInWorld(index);
  if (pos >= worldSize(w) - 1) return null;
  /** @type {string|null} */
  let id = REGRA_IDS.find((r) => worldOf(ESTREIA[r]) === w) || null;
  if (!id) {
    if (w <= worldOf(ESTREIA.dourado)) return null;
    if (pos === (w * 3) % 4) return null;
    id = REGRA_IDS[(w + pos) % REGRA_IDS.length];
  }
  if (id === 'dourado' && config && config.oscillate) id = 'cadeado';
  return id;
}

/**
 * A regra seguinte no rodizio, para quando a da agenda nao passa.
 * @param {string} id
 * @returns {string}
 */
export function proximaRegra(id) {
  return REGRA_IDS[(REGRA_IDS.indexOf(id) + 1) % REGRA_IDS.length];
}

/**
 * Caixa de uma peca do layout, em metros (uma celula e um metro).
 * @param {{cells:[number,number][], x:number, y:number}} p
 */
function caixa(p) {
  let w = 0;
  let h = 0;
  for (const [cx, cy] of p.cells) {
    if (cx + 1 > w) w = cx + 1;
    if (cy + 1 > h) h = cy + 1;
  }
  return { x0: p.x, x1: p.x + w, y0: p.y, y1: p.y + h };
}

/**
 * Assinatura de uma peca do layout: e por ela que o jogo confere que o indice
 * gravado em regras.gen.js ainda aponta para a mesma peca.
 * @param {{material:string, x:number, y:number}} p
 */
export function assinaturaDaPeca(p) {
  return `${p.material}:${p.x}:${p.y}`;
}

/**
 * Parametros a tentar, do mais rigido ao mais folgado. Os candidatos saem de um
 * Rng proprio, semeado pela fase e pela seed da variante, e nunca do sorteio do
 * layout.
 *
 * @param {string} id
 * @param {import('../physics/world.js').LevelLayout} layout
 * @param {number} seed seed da variante
 * @param {number} index
 * @returns {*[]}
 */
export function candidatosDaRegra(id, layout, seed, index) {
  const rng = new Rng(hashSeed(`regra|v1|${index}|${seed}|${id}`));
  const ped = layout.pedestal;
  const hexX = layout.hexagon.x;

  if (id === 'dourado') {
    if (ped.oscillate) return [];
    return [
      { meia: Math.max(0.9, ped.halfWidth * 0.45) },
      { meia: Math.max(1.2, ped.halfWidth * 0.65) },
    ];
  }

  // Pecas fora da coluna do hexagono: uma joia ou um cadeado bem embaixo dele
  // so sairiam do caminho caindo, e a joia que cai perde a fase.
  const foraDaColuna = (/** @type {*} */ p) => {
    const c = caixa(p);
    return c.x1 <= hexX - 1.1 || c.x0 >= hexX + 1.1;
  };

  if (id === 'joia') {
    const elegiveis = [];
    layout.pieces.forEach((p, i) => {
      const mat = getMaterial(p.material);
      if (!mat.destructible || JOIA_FRAGIL.has(p.material)) return;
      const c = caixa(p);
      // Inteira sobre o pedestal: fora dele nada a segura quando a torre cai.
      if (c.x0 < ped.x - ped.halfWidth || c.x1 > ped.x + ped.halfWidth) return;
      if (!foraDaColuna(p)) return;
      elegiveis.push(i);
    });
    rng.shuffle(elegiveis);
    // No mundo de estreia a joia tenta primeiro as pecas mais baixas, que a
    // torre protege: medido no economia.mjs, o jogador mediano (um terco dos
    // toques ao acaso) desistia das fases 21 e 22 tres vezes mais que sem a
    // regra. Depois da estreia o sorteio fica livre.
    if (index < worldStart(5)) elegiveis.sort((a, b) => layout.pieces[a].y - layout.pieces[b].y);
    return elegiveis.slice(0, 4).map((i) => ({
      peca: i,
      a: assinaturaDaPeca(layout.pieces[i]),
    }));
  }

  if (id === 'cadeado') {
    const elegiveis = [];
    layout.pieces.forEach((p, i) => {
      if (!getMaterial(p.material).destructible) return;
      if (!foraDaColuna(p)) return;
      elegiveis.push(i);
    });
    const n = Math.max(2, Math.min(4, Math.round(layout.pieces.length * 0.1)));
    if (elegiveis.length < n) return [];
    const conjuntos = [];
    for (let k = 0; k < 4; k++) {
      const pecas = rng.shuffle(elegiveis.slice()).slice(0, n).sort((a, b) => a - b);
      conjuntos.push({ pecas, a: pecas.map((i) => assinaturaDaPeca(layout.pieces[i])) });
    }
    return conjuntos;
  }

  return [];
}

/**
 * O layout com a regra anexada. Copia rasa: as pecas sao as mesmas, e o
 * PhysicsWorld so le `regra` no build.
 * @param {import('../physics/world.js').LevelLayout} layout
 * @param {*} regra `{tipo, ...parametro}`
 */
export function comRegra(layout, regra) {
  return { ...layout, regra };
}

/**
 * A regra aprovada para uma variante, conferida contra o layout: a seed tem que
 * ser a mesma e a joia e os cadeados tem que apontar para a mesma peca.
 * Qualquer diferenca descarta a regra - melhor jogar sem regra do que com uma
 * que nao foi provada.
 *
 * @param {number} index base 0, da campanha
 * @param {number} vi variante em levels.gen.js
 * @param {number} seed
 * @param {import('../physics/world.js').LevelLayout} layout
 * @returns {*|null} `{tipo, ...parametro}`
 */
export function regraDaVariante(index, vi, seed, layout) {
  const rec = REGRAS[index];
  if (!rec) return null;
  const v = rec.v[vi];
  if (!v || v.s !== seed) return null;
  if (rec.r === 'joia') {
    const p = layout.pieces[v.peca];
    if (!p || assinaturaDaPeca(p) !== v.a) return null;
    return { tipo: 'joia', peca: v.peca };
  }
  if (rec.r === 'cadeado') {
    const ok = v.pecas.every(
      (/** @type {number} */ i, /** @type {number} */ k) =>
        layout.pieces[i] && assinaturaDaPeca(layout.pieces[i]) === v.a[k],
    );
    return ok ? { tipo: 'cadeado', pecas: v.pecas.slice() } : null;
  }
  if (rec.r === 'dourado') return { tipo: 'dourado', meia: v.meia };
  return null;
}

/**
 * Variantes que a fase pode sortear. Com regra, so as aprovadas: um layout sem
 * a regra no meio de uma fase com regra trocaria o objetivo no "tentar de novo".
 * @param {number} index
 * @param {[number, number, number][]} variantes de levels.gen.js
 * @returns {number[]} indices em `variantes`
 */
export function variantesPermitidas(index, variantes) {
  const rec = REGRAS[index];
  const todas = variantes.map((_, i) => i);
  if (!rec) return todas;
  const ok = todas.filter((i) => rec.v[i] && rec.v[i].s === variantes[i][0]);
  return ok.length ? ok : todas;
}

/** @param {number} index @returns {string|null} a regra gravada para a fase */
export function regraGravada(index) {
  const rec = REGRAS[index];
  return rec ? rec.r : null;
}

/**
 * A primeira fase (indice) em que cada regra aparece de fato, depois da
 * validacao. E nela que mora o cartao de estreia: se a validacao tirou a regra
 * da fase de estreia da agenda, o cartao vai junto para onde ela apareceu.
 * @type {Record<string, number>}
 */
export const PRIMEIRA_FASE = (() => {
  /** @type {Record<string, number>} */
  const primeira = {};
  for (const k of Object.keys(REGRAS).map(Number).sort((a, b) => a - b)) {
    const r = REGRAS[k].r;
    if (primeira[r] === undefined) primeira[r] = k;
  }
  return primeira;
})();

/**
 * A fase esta no mundo em que a regra dela estreou? Ali a derrota pela regra
 * ainda volta uma jogada (main.js): a regra e o desafio novo, mas nao pode
 * virar o muro que a 1.0.3 mostrou custar caro.
 * @param {number} index base 0, da campanha
 * @param {string} id
 * @returns {boolean}
 */
export function mundoDeEstreia(index, id) {
  const e = PRIMEIRA_FASE[id] ?? /** @type {Record<string, number>} */ (ESTREIA)[id];
  return e !== undefined && worldOf(index) === worldOf(e);
}
