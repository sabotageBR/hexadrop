/**
 * Simulacao automatica de uma fase.
 *
 * Dois usos: o validador offline prova que uma variante e vencivel e mede a
 * dificuldade, e o jogo usa a mesma heuristica para destacar uma peca segura
 * quando o jogador pede a dica.
 */

import { PhysicsWorld } from '../physics/world.js';
import { material as getMaterial } from '../physics/materials.js';
import { Rng } from '../core/rng.js';

/** Politicas competentes: usadas para provar que a fase tem solucao. */
export const SMART_POLICIES = ['plan', 'planWide'];
/** Politicas ingenuas: usadas so para medir o quanto a fase perdoa erros. */
export const NAIVE_POLICIES = ['lowest', 'exposed', 'random'];
export const POLICIES = [...SMART_POLICIES, ...NAIVE_POLICIES];

const STEP = 1 / 60;
const MIN_SETTLE = 12;
// Um colapso de torre alta leva bem mais que dois segundos. Cortar cedo faz
// o solucionador tocar no meio do caos e julgar a fase impossivel sem razao.
const MAX_SETTLE = 420;

/**
 * @param {PhysicsWorld} world
 * @returns {import('../physics/world.js').PieceState[]}
 */
function destructible(world) {
  return world.alivePieces().filter((p) => getMaterial(p.material).destructible);
}

/**
 * Pecas logo abaixo do hexagono e dentro da sua sombra vertical.
 * @param {PhysicsWorld} world
 * @param {import('../physics/world.js').PieceState[]} options
 * @param {number} widen folga horizontal extra
 * @returns {import('../physics/world.js').PieceState[]}
 */
function beneathHex(world, options, widen = 0) {
  const hex = world.hexTransform();
  const hexHW = world.hexHalfWidth();
  return options.filter((p) => {
    const b = world.pieceBox(p);
    if (b.top > hex.y + 0.15) return false;
    return Math.abs(b.cx - hex.x) < b.hw + hexHW * 0.95 + widen;
  });
}

/**
 * Altura da superficie mais alta em x que ainda esta abaixo de um teto.
 * @param {PhysicsWorld} world
 * @param {number} x
 * @param {number} ceiling ignora pecas cujo topo esteja acima disso
 * @param {number} excludeId peca considerada ja removida
 * @returns {number} -Infinity quando nao ha nada sob esse x
 */
function topBelow(world, x, ceiling, excludeId) {
  let best = -Infinity;
  for (const p of world.alivePieces()) {
    if (p.id === excludeId) continue;
    const b = world.pieceBox(p);
    if (b.top > ceiling) continue;
    if (x < b.cx - b.hw + 0.03 || x > b.cx + b.hw - 0.03) continue;
    if (b.top > best) best = b.top;
  }
  const pedX = world.pedestalX();
  if (x >= pedX - world.pedestalHalfWidth && x <= pedX + world.pedestalHalfWidth) {
    if (best < 0) best = 0;
  }
  return best;
}

/**
 * Qualidade do apoio que o hexagono teria se uma peca fosse removida.
 *
 * Amostra a superficie sob a base plana do hexagono. Uma superficie plana e
 * continua e estavel; um degrau ou um vao faz o hexagono tombar, que e
 * exatamente como se perde a fase.
 *
 * @param {PhysicsWorld} world
 * @param {number} excludeId
 * @returns {{max:number, flat:number, drop:number, void:boolean}}
 */
export function supportAfter(world, excludeId) {
  const hex = world.hexTransform();
  const hexBottom = hex.y - world.hexHalfHeight();
  const halfBase = world.hexHalfWidth() * 0.52;
  const ceiling = hexBottom + 0.14;
  const N = 9;
  /** @type {number[]} */
  const heights = [];
  for (let i = 0; i < N; i++) {
    const x = hex.x - halfBase + 2 * halfBase * (i / (N - 1));
    heights.push(topBelow(world, x, ceiling, excludeId));
  }
  let max = -Infinity;
  for (const h of heights) if (h > max) max = h;
  if (max === -Infinity) return { max, flat: 0, drop: Infinity, void: true };
  let flatCount = 0;
  for (const h of heights) if (h > max - 0.2) flatCount++;
  return { max, flat: flatCount / N, drop: Math.max(0, hexBottom - max), void: false };
}

/**
 * Distancia do centro do hexagono ate a borda da superficie que o sustenta.
 * @param {PhysicsWorld} world
 * @returns {number}
 */
function supportMargin(world) {
  const hex = world.hexTransform();
  const hexBottom = hex.y - world.hexHalfHeight();
  const ceiling = hexBottom + 0.16;
  const top = topBelow(world, hex.x, ceiling, -1);
  if (top === -Infinity) return 0;
  const stepSize = 0.12;
  let left = 0;
  let right = 0;
  for (let d = stepSize; d <= 2.4; d += stepSize) {
    if (topBelow(world, hex.x - d, ceiling, -1) < top - 0.22) break;
    left = d;
  }
  for (let d = stepSize; d <= 2.4; d += stepSize) {
    if (topBelow(world, hex.x + d, ceiling, -1) < top - 0.22) break;
    right = d;
  }
  return Math.min(left, right);
}

/**
 * Nota de um estado do mundo, do ponto de vista de quem quer vencer.
 * @param {PhysicsWorld} world
 * @returns {number}
 */
function scoreState(world) {
  const state = world.evaluate();
  if (state === 'won') return 100000;
  if (state === 'lost') return -100000;
  const hex = world.hexTransform();
  const pedX = world.pedestalX();
  const sup = supportAfter(world, -1);
  const v = world.hexBody ? world.hexBody.getLinearVelocity() : { x: 0, y: 0 };
  const speed = Math.hypot(v.x, v.y);
  let score = -hex.y * 14;
  score -= Math.abs(hex.x - pedX) * 9;
  score += sup.flat * 14;
  // Margem ate a borda do apoio: e o que separa "pousado" de "quase caindo".
  score += Math.min(supportMargin(world), 1.5) * 26;
  score -= Math.min(speed, 8) * 3;
  score += world.starsCrossed * 40;
  if (state === 'stuck') score -= 3000;
  // Um hexagono ainda no ar nao e progresso: pode estar caindo para fora.
  // Sem esta penalidade o lance ganancioso de derrubar tudo parece otimo.
  if (!world.hexAtRest()) score -= 5000;
  if (sup.void) score -= 2500;
  return score;
}

/**
 * Escolha com um lance de antecedencia.
 *
 * Para cada peca candidata o mundo e fotografado, o toque e realmente
 * simulado e o resultado e avaliado; depois tudo volta ao estado anterior.
 * E o que separa um jogador competente de um chute, e e o que permite
 * certificar que uma fase tem solucao.
 *
 * @param {PhysicsWorld} world
 * @param {import('../physics/world.js').PieceState[]} options
 * @param {Rng} rng
 * @param {number} [width] quantas candidatas testar
 * @returns {import('../physics/world.js').PieceState|null}
 */
function planAhead(world, options, rng, width = 9) {
  const hex = world.hexTransform();
  const ranked = options
    .filter((p) => world.pieceBox(p).top <= hex.y + 0.35)
    .map((p) => {
      const b = world.pieceBox(p);
      return { p, pre: b.top * 10 - Math.abs(b.cx - hex.x) * 1.1 };
    })
    .sort((a, b) => b.pre - a.pre);
  const pool = (ranked.length ? ranked : options.map((p) => ({ p, pre: 0 }))).slice(0, width);
  if (!pool.length) return null;
  if (pool.length === 1) return pool[0].p;

  const base = world.snapshot();
  /** @type {{p: import('../physics/world.js').PieceState, score: number}[]} */
  const results = [];
  for (const item of pool) {
    world.destroyPiece(item.p, 'tap');
    let steps = 0;
    while (steps < 320) {
      world.step(1 / 60);
      steps++;
      if (steps >= 10 && world.everythingAtRest()) break;
      if (world.evaluate() === 'lost') break;
    }
    results.push({ p: item.p, score: scoreState(world) });
    world.restore(base);
  }
  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, Math.min(3, results.length));
  // Sorteio leve entre as melhores: seeds diferentes exploram caminhos
  // diferentes, e e isso que mede a robustez da fase.
  return rng.weighted(top.map((r) => r.p), top.map((_, i) => (i === 0 ? 8 : i === 1 ? 2 : 1)));
}

/**
 * Simula um toque candidato e depois joga a fase ate o fim com uma heuristica
 * barata, usando o desfecho real como nota.
 *
 * E o passo de playout de uma busca Monte Carlo. O jogador ganancioso de um
 * lance nao enxerga que derrubar um apoio la embaixo parece otimo agora e
 * mata o hexagono tres toques depois; com o playout ele enxerga.
 *
 * @param {PhysicsWorld} world
 * @param {import('../physics/world.js').PieceState[]} options
 * @param {Rng} rng
 * @param {number} [width]
 * @returns {import('../physics/world.js').PieceState|null}
 */
function planPlayout(world, options, rng, width = 6) {
  const hex = world.hexTransform();
  const ranked = options
    .filter((p) => world.pieceBox(p).top <= hex.y + 0.35)
    .map((p) => {
      const b = world.pieceBox(p);
      return { p, pre: b.top * 10 - Math.abs(b.cx - hex.x) * 1.1 };
    })
    .sort((a, b) => b.pre - a.pre);
  const pool = (ranked.length ? ranked : options.map((p) => ({ p, pre: 0 }))).slice(0, width);
  if (!pool.length) return null;
  if (pool.length === 1) return pool[0].p;

  const base = world.snapshot();
  /** @type {{p: import('../physics/world.js').PieceState, score: number}[]} */
  const results = [];

  for (const item of pool) {
    world.destroyPiece(item.p, 'tap');
    let steps = 0;
    while (steps < 320) {
      world.step(1 / 60);
      steps++;
      if (steps >= 10 && world.everythingAtRest()) break;
      if (world.evaluate() === 'lost') break;
    }
    let score = scoreState(world);
    let state = world.evaluate();
    // Continua jogando com a heuristica barata ate o desfecho.
    let extraTaps = 0;
    while (state === 'playing' && extraTaps < 26) {
      const next = planAhead(world, destructible(world), rng, 3);
      if (!next) break;
      world.destroyPiece(next, 'tap');
      extraTaps++;
      let s2 = 0;
      while (s2 < 320) {
        world.step(1 / 60);
        s2++;
        if (s2 >= 10 && world.everythingAtRest()) break;
        if (world.evaluate() === 'lost') break;
      }
      state = world.evaluate();
    }
    if (state === 'won') score = 200000 - extraTaps * 40;
    else if (state === 'lost') score = -200000 + scoreState(world) * 0.001;
    else score = score - 20000;
    results.push({ p: item.p, score });
    world.restore(base);
  }

  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, Math.min(2, results.length));
  return rng.weighted(top.map((r) => r.p), top.map((_, i) => (i === 0 ? 9 : 1)));
}

/**
 * Escolhe a proxima peca conforme a politica.
 * @param {PhysicsWorld} world
 * @param {string} policy
 * @param {Rng} rng
 * @returns {import('../physics/world.js').PieceState|null}
 */
export function choosePiece(world, policy, rng) {
  const options = destructible(world);
  if (!options.length) return null;
  const hex = world.hexTransform();

  if (policy === 'playout') {
    return planPlayout(world, options, rng);
  }

  if (policy === 'plan') {
    return planAhead(world, options, rng, 9);
  }

  if (policy === 'planWide') {
    return planAhead(world, options, rng, 16);
  }

  if (policy === 'support') {
    const base = supportAfter(world, -1);
    /** @type {{p: import('../physics/world.js').PieceState, score: number}[]} */
    const scored = [];
    for (const p of options) {
      const b = world.pieceBox(p);
      if (b.bottom > hex.y + 0.2) continue; // nao mexe no que esta acima
      const s = supportAfter(world, p.id);
      if (s.void) continue; // deixaria o hexagono sobre o vazio
      const progress = base.max === -Infinity ? 0 : Math.max(0, base.max - s.max);
      let score = s.flat * 12 + progress * 3.4 - s.drop * 1.1;
      // Perto do fim, puxa o hexagono para o centro do pedestal.
      const pedX = world.pedestalX();
      if (hex.y < 4) score -= Math.abs(hex.x - pedX) * 0.6;
      // Empurra a remocao para cima: limpar de cima para baixo mantem a base larga.
      score += b.top * 0.25;
      scored.push({ p, score });
    }
    if (!scored.length) {
      // Nenhuma remocao segura: escolhe a peca mais alta abaixo do hexagono.
      let best = null;
      let bestTop = -Infinity;
      for (const p of options) {
        const b = world.pieceBox(p);
        if (b.top > hex.y + 0.2) continue;
        if (b.top > bestTop) {
          bestTop = b.top;
          best = p;
        }
      }
      return best || rng.pick(options);
    }
    scored.sort((a, b) => b.score - a.score);
    const pool = scored.slice(0, Math.min(3, scored.length));
    return rng.weighted(pool.map((s) => s.p), pool.map((_, i) => (i === 0 ? 7 : i === 1 ? 2 : 1)));
  }

  if (policy === 'descend' || policy === 'descendTidy') {
    let pool = beneathHex(world, options, 0);
    if (!pool.length) pool = beneathHex(world, options, 1.4);
    if (!pool.length) {
      pool = options.filter((p) => world.pieceBox(p).top <= hex.y + 0.15);
    }
    if (!pool.length) pool = options;

    const pedX = world.pedestalX();
    const scored = pool.map((p) => {
      const b = world.pieceBox(p);
      // Prioridade: a peca com o topo mais alto logo abaixo do hexagono.
      // O hexagono desce um degrau de cada vez, em vez de derrubar a torre.
      let score = b.top * 10 - Math.abs(b.cx - hex.x) * 1.2;
      if (policy === 'descendTidy') {
        // Prefere pecas pequenas, que tiram menos apoio de uma vez, e puxa o
        // hexagono na direcao do centro do pedestal.
        score -= p.area * 0.35;
        score -= Math.sign(hex.x - pedX) * Math.sign(b.cx - hex.x) * 0.9;
      }
      return { p, score };
    });
    scored.sort((a, b) => b.score - a.score);
    // O sorteio de desempate fica restrito a camada mais alta. Cavar um poco
    // numa camada de baixo deixaria o hexagono apoiado em duas bordas, que e
    // exatamente a posicao de onde ele tomba.
    const topMost = world.pieceBox(scored[0].p).top;
    const sameLayer = scored.filter((s) => world.pieceBox(s.p).top >= topMost - 0.55);
    const pool2 = sameLayer.slice(0, Math.min(3, sameLayer.length));
    const weights = pool2.map((_, i) => (i === 0 ? 6 : i === 1 ? 2 : 1));
    return rng.weighted(pool2.map((s) => s.p), weights);
  }

  if (policy === 'lowest') {
    let best = options[0];
    let bestY = Infinity;
    for (const p of options) {
      const y = p.body.getPosition().y;
      if (y < bestY) {
        bestY = y;
        best = p;
      }
    }
    return best;
  }

  if (policy === 'exposed') {
    const exposed = world.exposedPieces();
    return rng.pick(exposed.length ? exposed : options);
  }

  return rng.pick(options);
}

/**
 * Deixa a cena assentar.
 * @param {PhysicsWorld} world
 * @returns {number} passos gastos
 */
export function settle(world) {
  let steps = 0;
  while (steps < MAX_SETTLE) {
    world.step(STEP);
    steps++;
    if (steps >= MIN_SETTLE && world.everythingAtRest()) break;
    if (world.evaluate() === 'lost') break;
  }
  return steps;
}

/**
 * @typedef {object} RolloutResult
 * @property {'won'|'lost'|'stuck'|'timeout'} outcome
 * @property {number} taps
 * @property {number} stars
 * @property {number[]} sequence
 * @property {number} steps
 */

/**
 * Joga uma partida inteira automaticamente.
 * @param {import('../physics/world.js').LevelLayout} layout
 * @param {object} opts
 * @param {string} opts.policy
 * @param {number} opts.seed
 * @param {number} [opts.maxTaps]
 * @param {number} [opts.jitter]
 * @returns {RolloutResult}
 */
export function rollout(layout, opts) {
  const rng = new Rng(opts.seed >>> 0);
  const maxTaps = opts.maxTaps || 60;
  const world = new PhysicsWorld();
  world.build(layout);

  if (opts.jitter) {
    for (const p of world.alivePieces()) {
      const pos = p.body.getPosition();
      p.body.setTransform(
        { x: pos.x + rng.range(-opts.jitter, opts.jitter), y: pos.y + rng.range(-opts.jitter, opts.jitter) },
        rng.range(-opts.jitter, opts.jitter) * 0.5,
      );
    }
  }

  let steps = settle(world);
  /** @type {number[]} */
  const sequence = [];
  let taps = 0;
  /** @type {'won'|'lost'|'stuck'|'timeout'} */
  let outcome = 'timeout';

  for (let i = 0; i < maxTaps; i++) {
    const state = world.evaluate();
    if (state !== 'playing') {
      outcome = state;
      break;
    }
    const piece = choosePiece(world, opts.policy, rng);
    if (!piece) {
      outcome = 'stuck';
      break;
    }
    sequence.push(piece.id);
    world.destroyPiece(piece, 'tap');
    taps++;
    steps += settle(world);
    const after = world.evaluate();
    if (after !== 'playing') {
      outcome = after;
      break;
    }
  }

  if (outcome === 'timeout') {
    const finalState = world.evaluate();
    if (finalState !== 'playing') outcome = finalState;
  }

  const stars = world.starsCrossed;
  world.destroy();
  return { outcome, taps, stars, sequence, steps };
}

/**
 * @typedef {object} VariantReport
 * @property {boolean} accepted
 * @property {number} smartWins vitorias com jogo competente
 * @property {number} smartRuns
 * @property {number} naiveWins vitorias com jogo ingenuo
 * @property {number} naiveRuns
 * @property {number} forgiveness 0 a 1, quanto a fase perdoa erros
 * @property {number} par menor numero de toques em uma vitoria
 * @property {number} avgTaps
 * @property {boolean} robust
 */

/**
 * Avalia uma variante.
 *
 * Solvabilidade vem das politicas competentes. A dificuldade vem de quantas
 * vezes o jogo ingenuo tambem vence. A robustez confirma que a vitoria nao
 * depende de precisao milimetrica, o que e o que permite usar um motor sem
 * determinismo entre plataformas.
 *
 * @param {import('../physics/world.js').LevelLayout} layout
 * @param {number} seed
 * @param {object} [opts]
 * @param {number} [opts.smartRuns]
 * @param {number} [opts.naiveRuns]
 * @param {number} [opts.minSmartWins]
 * @returns {VariantReport}
 */
export function evaluateVariant(layout, seed, opts = {}) {
  const smartRuns = opts.smartRuns || 6;
  const naiveRuns = opts.naiveRuns || 3;
  const minSmartWins = opts.minSmartWins === undefined ? 2 : opts.minSmartWins;

  let smartWins = 0;
  let par = Infinity;
  let tapSum = 0;
  let tapCount = 0;

  for (let i = 0; i < smartRuns; i++) {
    const policy = SMART_POLICIES[i % SMART_POLICIES.length];
    const res = rollout(layout, { policy, seed: seed + i * 977 + 13 });
    if (res.outcome === 'won') {
      smartWins++;
      tapSum += res.taps;
      tapCount++;
      if (res.taps < par) par = res.taps;
    }
  }

  let naiveWins = 0;
  for (let i = 0; i < naiveRuns; i++) {
    const policy = NAIVE_POLICIES[i % NAIVE_POLICIES.length];
    const res = rollout(layout, { policy, seed: seed + 30011 + i * 617 });
    if (res.outcome === 'won') naiveWins++;
  }

  let robust = false;
  if (smartWins >= minSmartWins) {
    for (let i = 0; i < 3; i++) {
      const res = rollout(layout, {
        policy: SMART_POLICIES[i % SMART_POLICIES.length],
        seed: seed + 50021 + i * 131,
        jitter: 0.012,
      });
      if (res.outcome === 'won') {
        robust = true;
        break;
      }
    }
  }

  return {
    accepted: smartWins >= minSmartWins && robust,
    smartWins,
    smartRuns,
    naiveWins,
    naiveRuns,
    forgiveness: naiveRuns ? naiveWins / naiveRuns : 0,
    par: par === Infinity ? 0 : par,
    avgTaps: tapCount ? tapSum / tapCount : 0,
    robust,
  };
}
