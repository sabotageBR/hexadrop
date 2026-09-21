/**
 * Gera e valida as 100 fases, depois grava src/game/levels.gen.js.
 *
 * Para cada fase o programa procura seeds cujo layout seja realmente vencivel,
 * provando isso com um jogador automatico que simula um lance a frente. Uma
 * variante so e aceita quando vence por caminhos diferentes e continua vencendo
 * com as posicoes iniciais perturbadas. E essa robustez que permite usar um
 * motor de fisica que nao e determinista entre plataformas: a vitoria nao
 * depende de precisao milimetrica.
 *
 * Quando nenhuma variante passa, a configuracao da fase e afrouxada em degraus
 * ate passar. Melhor uma fase um pouco mais facil do que uma fase impossivel.
 *
 * Nas vinte primeiras fases o programa ainda escolhe entre as variantes que
 * passaram, em vez de ficar com as primeiras: ver RAMP_FORGIVENESS.
 *
 * Uso:
 *   node tools/generate-levels.mjs            geracao completa
 *   node tools/generate-levels.mjs --quick    menos seeds, para iterar rapido
 *   node tools/generate-levels.mjs --levels 1-20
 *   node tools/generate-levels.mjs --seeds 40 --levels 79-79
 */

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { levelConfig, generateLayout, LEVEL_COUNT } from '../src/game/levelgen.js';
import { evaluateVariant, rollout } from '../src/game/solver.js';
import { hashSeed } from '../src/core/rng.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/game/levels.gen.js');
const GENERATOR_VERSION = 1;

const QUICK = process.argv.includes('--quick');
const VARIANTS_WANTED = QUICK ? 2 : 4;
const seedArg = process.argv.indexOf('--seeds');
// Cinco fases so conseguiam uma variante com o orcamento padrao, e o botao de
// embaralhar precisa de pelo menos duas. --seeds 40 resolve, ao custo de tempo.
const SEED_BUDGET = seedArg >= 0 ? Number(process.argv[seedArg + 1]) : QUICK ? 6 : 16;
const SMART_RUNS = QUICK ? 4 : 6;

/**
 * @param {number} index
 * @param {number} soften
 * @param {number} attempt
 * @returns {number}
 */
function seedFor(index, soften, attempt) {
  return hashSeed(`hexadrop|v${GENERATOR_VERSION}|${index}|${soften}|${attempt}`);
}

/**
 * Toques minimos exigidos de uma variante.
 *
 * Uma fase que se resolve em um toque nao e uma fase. As duas primeiras sao a
 * excecao porque sao o tutorial: ali o toque unico e a licao.
 *
 * @param {number} index
 * @returns {number}
 */
function minPar(index) {
  return index < 2 ? 1 : 2;
}

/**
 * Quanto cada fase da rampa de entrada deve perdoar, de 1 (um jogador que toca
 * ao acaso vence sempre) a 0.
 *
 * O tamanho da torre e a largura do pedestal dizem o quanto a fase cobra, mas
 * nao o quanto ela perdoa: duas seeds do mesmo tamanho podem ser um corredor
 * unico ou uma pilha que desaba sozinha em qualquer ordem. Por isso as vinte
 * primeiras fases nao ficam com a primeira variante que passa - o gerador
 * varre um orcamento maior de seeds e monta o conjunto cuja media cai nesta
 * curva. Duas fases para ensinar, oito para descer ate onde o mundo 2 abre, e
 * o mundo 2 inteiro para chegar aos 30% com que o mundo 3 trabalha.
 *
 * Sem a curva, o mundo 2 era um serrilhado: 94% na fase 12, 15% na 19.
 */
const RAMP_FORGIVENESS = [
  1, 1, 0.85, 0.8, 0.75, 0.68, 0.62, 0.56, 0.5, 0.45,
  0.42, 0.4, 0.38, 0.37, 0.36, 0.35, 0.34, 0.33, 0.32, 0.3,
];

/**
 * Toques que cada fase da rampa deveria pedir, no minimo.
 *
 * Perdao e duracao sao coisas diferentes, e so o alvo de perdao deixava passar
 * uma fase mansa de dois toques - que e o retrato do comeco que fazia o
 * jogador sair. Isto e uma preferencia, e nao um filtro: se a fase nao tiver
 * variantes longas o bastante, vale a mansa, porque a alternativa e o gerador
 * afrouxar a fase inteira e entregar algo ainda menor.
 *
 * Os numeros param em sete. Fase longa nao e fase dificil - o mundo 3, que
 * perdoa menos que qualquer fase daqui, tem par medio de 3,9: quando uma boa
 * jogada derruba a torre inteira, o par cai e a fase continua dura.
 */
const RAMP_MIN_PAR = [1, 1, 4, 4, 4, 4, 4, 5, 5, 5, 4, 4, 5, 5, 5, 6, 6, 6, 6, 7];

/**
 * Fases em que o gerador escolhe, em vez de aceitar a primeira que passa.
 * @param {number} index
 * @returns {boolean}
 */
function isPicky(index) {
  return index < RAMP_FORGIVENESS.length;
}

/**
 * Escolhe as variantes cuja media de perdao mais se aproxima do alvo da fase.
 *
 * Guloso, uma variante por vez, porque as candidatas costumam ser bimodais: a
 * mesma fase produz seeds que perdoam tudo e seeds que nao perdoam nada, e
 * quase nenhuma no meio. Escolher as quatro individualmente mais proximas do
 * alvo pegaria as quatro perdoadoras; olhar a media aceita uma dura ao lado de
 * uma mansa, que e tambem a variedade que o jogador ve ao repetir a fase.
 *
 * @param {*[]} pool
 * @param {number} target
 * @param {number} floorPar
 * @param {number} want
 * @returns {*[]}
 */
function pickByForgiveness(pool, target, floorPar, want) {
  const longas = pool.filter((v) => v.par >= floorPar);
  const rest = (longas.length >= want ? longas : pool).slice();
  const picked = [];
  let sum = 0;
  while (picked.length < want && rest.length) {
    let best = 0;
    let bestDist = Infinity;
    for (let k = 0; k < rest.length; k++) {
      const dist = Math.abs((sum + rest[k].forgiveness) / (picked.length + 1) - target);
      // Empate resolvido pela fase mais longa: mesmo perdao, mais jogo.
      if (dist < bestDist - 1e-9 || (dist < bestDist + 1e-9 && rest[k].par > rest[best].par)) {
        best = k;
        bestDist = dist;
      }
    }
    sum += rest[best].forgiveness;
    picked.push(rest.splice(best, 1)[0]);
  }
  return picked;
}

/**
 * Procura variantes validas para uma fase.
 * @param {number} index
 * @returns {*}
 */
function bakeLevel(index) {
  // A escolha por alvo so e boa quando ha de onde escolher: no mundo inicial o
  // orcamento de seeds e maior, e as fases sao pequenas o bastante para isso
  // custar segundos.
  const budget = isPicky(index) ? Math.round(SEED_BUDGET * 2.5) : SEED_BUDGET;

  for (let soften = 0; soften <= 3; soften++) {
    const config = levelConfig(index, soften);
    /** @type {*[]} */
    const accepted = [];
    let screened = 0;

    for (let attempt = 0; attempt < budget; attempt++) {
      const seed = seedFor(index, soften, attempt);
      const layout = generateLayout(config, seed);

      // Triagem barata: se nem uma partida competente vence, nao vale gastar
      // a avaliacao completa nesta seed.
      let promising = rollout(layout, { policy: 'plan', seed: seed + 1 }).outcome === 'won';
      if (!promising) {
        promising = rollout(layout, { policy: 'planWide', seed: seed + 2 }).outcome === 'won';
      }
      screened++;
      if (!promising) continue;

      const report = evaluateVariant(layout, seed, {
        smartRuns: SMART_RUNS,
        // Tres partidas ingenuas medem o perdao em degraus de 33 pontos, o que
        // basta para reprovar uma fase impossivel e nao basta para escolher
        // entre duas aceitas.
        naiveRuns: isPicky(index) ? 9 : 3,
        minSmartWins: 2,
      });
      if (!report.accepted) continue;
      // Com materiais que somem sozinhos a fase de um toque deixa de ser
      // hipotetica - e o bonus de moedas por bater o par ficaria inatingivel.
      if (report.par < minPar(index)) continue;

      accepted.push({
        seed,
        par: report.par,
        smart: report.smartWins / report.smartRuns,
        forgiveness: report.forgiveness,
        pieces: layout.pieces.length,
      });
      if (!isPicky(index) && accepted.length >= VARIANTS_WANTED) break;
      // Com o orcamento varrido ate o fim, um punhado de candidatas ja da a
      // media pedida; passar disso e so tempo de geracao.
      if (isPicky(index) && accepted.length >= VARIANTS_WANTED * 4) break;
    }

    if (accepted.length > 0) {
      const variants = isPicky(index)
        ? pickByForgiveness(
            accepted,
            RAMP_FORGIVENESS[index],
            RAMP_MIN_PAR[index],
            VARIANTS_WANTED,
          )
        : accepted;
      return { index, soften, variants, screened, fallback: false };
    }
  }

  // Ultimo recurso: grava a variante mais suave mesmo sem certificado, para
  // que o jogo nunca fique sem esta fase. Fica marcada no relatorio.
  const config = levelConfig(index, 3);
  const seed = seedFor(index, 3, 0);
  const layout = generateLayout(config, seed);
  return {
    index,
    soften: 3,
    variants: [{ seed, par: 0, smart: 0, forgiveness: 0, pieces: layout.pieces.length }],
    screened: SEED_BUDGET,
    fallback: true,
  };
}

if (!isMainThread) {
  const list = /** @type {number[]} */ (workerData.levels);
  for (const index of list) {
    const result = bakeLevel(index);
    parentPort?.postMessage(result);
  }
  parentPort?.close();
} else {
  const arg = process.argv.indexOf('--levels');
  /** @type {number[]} */
  let indices = [];
  if (arg >= 0 && process.argv[arg + 1]) {
    const [a, b] = process.argv[arg + 1].split('-').map(Number);
    for (let i = a; i <= (b || a); i++) indices.push(i - 1);
  } else {
    for (let i = 0; i < LEVEL_COUNT; i++) indices.push(i);
  }

  const workerCount = Math.max(1, Math.min(indices.length, (cpus().length || 4) - 1));
  console.log(
    `Gerando ${indices.length} fases em ${workerCount} processos` +
      (QUICK ? ' (modo rapido)' : '') + '...',
  );

  /** @type {Map<number, *>} */
  const results = new Map();
  const started = Date.now();
  let done = 0;

  /** @type {number[][]} */
  const buckets = Array.from({ length: workerCount }, () => []);
  indices.forEach((idx, i) => buckets[i % workerCount].push(idx));

  await Promise.all(
    buckets.map(
      (levels) =>
        new Promise((resolveWorker, rejectWorker) => {
          if (!levels.length) return resolveWorker(null);
          const worker = new Worker(fileURLToPath(import.meta.url), {
            workerData: { levels },
            argv: process.argv.slice(2),
          });
          worker.on('message', (msg) => {
            results.set(msg.index, msg);
            done++;
            const pct = ((done / indices.length) * 100).toFixed(0);
            const secs = ((Date.now() - started) / 1000).toFixed(0);
            process.stdout.write(`\r  ${done}/${indices.length} (${pct}%) ${secs}s   `);
          });
          worker.on('error', rejectWorker);
          worker.on('exit', () => resolveWorker(null));
        }),
    ),
  );
  process.stdout.write('\n');

  // Quando so um trecho e regerado, o restante do arquivo e preservado.
  /** @type {Map<number, *>} */
  const merged = new Map();
  if (existsSync(OUT) && indices.length < LEVEL_COUNT) {
    const prev = readFileSync(OUT, 'utf8');
    const rows = prev.match(/\{ s: (\d+), v: \[(.*?)\] \}/g) || [];
    rows.forEach((row, i) => {
      const m = row.match(/\{ s: (\d+), v: \[(.*?)\] \}/);
      if (!m) return;
      const variants = (m[2].match(/\[[^\]]*\]/g) || []).map((v) => {
        const parts = v.slice(1, -1).split(',').map(Number);
        return { seed: parts[0], par: parts[1], forgiveness: parts[2], smart: 0, pieces: 0 };
      });
      merged.set(i, { index: i, soften: Number(m[1]), variants, kept: true });
    });
  }
  for (const [i, r] of results) merged.set(i, r);
  const ordered = [...merged.keys()].sort((a, b) => a - b).map((i) => merged.get(i)).filter(Boolean);

  // ---- relatorio --------------------------------------------------------
  const softCount = [0, 0, 0, 0];
  let fallbacks = 0;
  let kept = 0;
  let variantTotal = 0;
  for (const r of ordered) {
    softCount[r.soften]++;
    if (r.fallback) fallbacks++;
    if (r.kept) kept++;
    variantTotal += r.variants.length;
  }
  console.log('\nResumo');
  console.log('  fases geradas .............', ordered.length);
  console.log('  variantes validadas .......', variantTotal, `(media ${(variantTotal / ordered.length).toFixed(1)} por fase)`);
  console.log('  sem afrouxamento ..........', softCount[0]);
  console.log('  afrouxadas grau 1 / 2 / 3 .', softCount[1], '/', softCount[2], '/', softCount[3]);
  console.log('  sem certificado ...........', fallbacks, fallbacks ? '<-- revisar' : '');
  if (kept) console.log('  preservadas do arquivo ....', kept);

  const buckets10 = [];
  for (let b = 0; b < 10; b++) {
    const slice = ordered.filter((r) => Math.floor(r.index / 10) === b);
    if (!slice.length) continue;
    const forg = slice.reduce((a, r) => a + r.variants.reduce((x, v) => x + v.forgiveness, 0) / r.variants.length, 0) / slice.length;
    const par = slice.reduce((a, r) => a + r.variants.reduce((x, v) => x + v.par, 0) / r.variants.length, 0) / slice.length;
    buckets10.push(`  fases ${String(b * 10 + 1).padStart(3)}-${String(b * 10 + 10).padStart(3)}  toques ~${par.toFixed(1).padStart(4)}  perdoa ${(forg * 100).toFixed(0).padStart(3)}%`);
  }
  console.log('\nCurva de dificuldade');
  console.log(buckets10.join('\n'));

  // ---- arquivo ----------------------------------------------------------
  const rows = ordered.map((r) => {
    const vs = r.variants.map((v) => `[${v.seed},${v.par},${v.forgiveness.toFixed(2)}]`).join(',');
    return `  { s: ${r.soften}, v: [${vs}] },`;
  });

  const file = `/**
 * Fases assadas por tools/generate-levels.mjs. NAO EDITE A MAO.
 *
 * Guarda apenas o degrau de afrouxamento e as seeds aprovadas de cada fase. O
 * layout e reconstruido no cliente pelo mesmo levelgen.js que o validador usou,
 * entao o que foi testado e exatamente o que se joga, com um arquivo minusculo.
 *
 * Formato de cada variante: [seed, toques da melhor solucao, indice de perdao].
 * Gerado em ${new Date().toISOString().slice(0, 10)}.
 */

export const GENERATOR_VERSION = ${GENERATOR_VERSION};

/** @type {{s:number, v:[number,number,number][]}[]} */
export const LEVELS = [
${rows.join('\n')}
];
`;
  writeFileSync(OUT, file);
  console.log('\nArquivo gravado:', OUT, `(${(file.length / 1024).toFixed(1)} KB)`);
}
