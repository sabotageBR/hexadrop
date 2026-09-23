/**
 * Gera e valida as fases (LEVEL_COUNT), depois grava src/game/levels.gen.js.
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

import {
  levelConfig, generateLayout, LEVEL_COUNT, WORLD_COUNT, worldStart, worldSize,
} from '../src/game/levelgen.js';
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
 * Procura variantes validas para uma fase.
 * @param {number} index
 * @returns {*}
 */
function bakeLevel(index) {
  for (let soften = 0; soften <= 3; soften++) {
    const config = levelConfig(index, soften);
    /** @type {*[]} */
    const accepted = [];
    let screened = 0;
    // As fases de roteiro (levelgen.js, PRIMEIRAS_FASES) so aceitam seed que
    // perdoe o jogador tocando ao acaso. Medido, passa de uma seed em quatro
    // (seis linhas) a uma em dez (sete): o orcamento sextuplica - o laco para
    // nas quatro variantes, entao so custa onde falta - e cada politica
    // ingenua joga duas vezes, senao "perdoa tudo" seria sorte de tres partidas.
    const roteiro = config.minForgiveness !== undefined;
    const base = roteiro ? SEED_BUDGET * 6 : SEED_BUDGET;
    // Prorrogacao para as fases que nao conseguem encher as quatro variantes
    // com o orcamento normal.
    //
    // Sessenta e sete das cento e sessenta fases assadas saiam com menos de
    // quatro, e treze com UMA so - e a fase de variante unica e a fase em que
    // todo jogador pega o mesmo layout, sem nada a sortear e sem o botao de
    // embaralhar. No funil da Poki foram elas que apareceram: a fase 23, de
    // variante unica, reprovou 42% das tentativas, e a 40, de duas, 41% -
    // contra 3% a 9% das fases vizinhas. Uma fase inteira dependia de uma
    // seed.
    //
    // O custo fica so onde falta, porque o laco para assim que a faixa enche -
    // e so no degrau 0, que e onde a fase ainda pode sair certificada. Medido,
    // sem essa restricao uma unica fase de doze linhas segurou a geracao por
    // mais de doze minutos sozinha: nos degraus de afrouxamento o objetivo ja
    // e a fase EXISTIR, e quatro variantes ali custam quatro vezes o pior caso
    // para comprar um botao de embaralhar numa fase que ja foi amaciada.
    const teto = soften === 0 ? base * 4 : base;

    for (let attempt = 0; attempt < teto; attempt++) {
      const seed = seedFor(index, soften, attempt);
      const layout = generateLayout(config, seed);
      // Torre de barras e mais nada e justamente o que o roteiro quer evitar.
      if (config.minPieces && layout.pieces.length < config.minPieces) continue;
      // A fase de estreia tem que MOSTRAR a peca que o cartao do tutorial
      // anuncia. O peso sobe na estreia, mas peso e chance, nao garantia - e a
      // obsidiana ainda depende de uma peca que encoste na lateral.
      if (!config.newMaterials.every((m) => layout.pieces.some((pc) => pc.material === m))) continue;

      // Triagem barata: se nem uma partida competente vence, nao vale gastar
      // a avaliacao completa nesta seed.
      let tri = rollout(layout, { policy: 'plan', seed: seed + 1 });
      if (tri.outcome !== 'won') tri = rollout(layout, { policy: 'planWide', seed: seed + 2 });
      screened++;
      if (tri.outcome !== 'won') continue;
      // Corte exato do piso de toques, e o mais barato que existe: `par` e o
      // MINIMO de toques entre as partidas vencidas, entao uma triagem que ja
      // venceu com menos toques que o piso condena a seed sem apelacao. Vale
      // por uma avaliacao completa poupada - dez a quinze rollouts, e numa
      // torre de doze linhas cada um custa oito vezes o de uma torre de 4x5,
      // porque a politica `plan` simula um lance a frente para cada peca viva.
      if (config.minPar && tri.taps < config.minPar) continue;

      const report = evaluateVariant(layout, seed, {
        smartRuns: SMART_RUNS,
        naiveRuns: config.naiveRuns || (roteiro ? 6 : 3),
        minSmartWins: 2,
      });
      if (!report.accepted) continue;
      if (roteiro && report.forgiveness < (config.minForgiveness || 0)) continue;
      // Do mundo 8 em diante quem manda e a taxa do jogador competente: o
      // perdao ali satura em zero e nao separa mais uma fase da outra.
      const smart = report.smartRuns ? report.smartWins / report.smartRuns : 0;
      if (config.minSmart !== undefined && smart < config.minSmart) continue;
      // Uma fase que se resolve em um toque nao e uma fase. Com materiais que
      // somem sozinhos isso deixa de ser hipotetico - e o bonus de moedas por
      // bater o par ficaria inatingivel.
      if (index >= 9 && report.par < 2) continue;
      if (config.minPar && report.par < config.minPar) continue;

      accepted.push({
        seed,
        par: report.par,
        smart: report.smartWins / report.smartRuns,
        forgiveness: report.forgiveness,
        pieces: layout.pieces.length,
      });
      // O teto e preferencia, nao exigencia: o laco so para quando ja tem
      // variantes suficientes DENTRO da faixa. Sem isso o gerador ficava com as
      // primeiras quatro seeds aprovadas e a curva subia a esmo - foi assim que
      // uma fase de piso 50% saiu com 96% de perdao.
      const naFaixa =
        config.maxSmart !== undefined
          ? accepted.filter((v) => v.smart <= config.maxSmart)
          : accepted.filter((v) => v.forgiveness <= (config.maxForgiveness ?? 1));
      if (naFaixa.length >= VARIANTS_WANTED) break;
      // Passado o orcamento base, a prorrogacao persegue a CONTAGEM, nao a
      // faixa: encher a faixa e preferencia, ter quatro layouts e o que o
      // jogador percebe. Sem esta linha a prorrogacao rodaria ate o teto em
      // toda fase cuja faixa nunca enche, que e a metade do fim do jogo.
      //
      // E ela so vale onde o degrau ja PROVOU que produz. Com zero variantes
      // aceitas depois do orcamento base, o problema nao e sorte de seed, e a
      // configuracao: insistir quatro vezes mais so adia o afrouxamento, e
      // pagaria esse preco em cada um dos quatro degraus.
      if (attempt + 1 >= base && (accepted.length === 0 || accepted.length >= VARIANTS_WANTED)) {
        break;
      }
    }

    if (accepted.length > 0) {
      // Escolhe as mais proximas do ALVO, nao as mais dificeis. Ordenar pelo
      // menor perdao parece conservador e nao e: onde o piso e zero - os cinco
      // ultimos mundos - ele puxa a fase para o fundo do que foi sorteado, e a
      // curva que devia fechar em 13% fechava em 2%.
      const porSmart = config.targetSmart !== undefined;
      const alvo = porSmart ? config.targetSmart : config.targetForgiveness ?? config.maxForgiveness ?? 1;
      const dist = (/** @type {*} */ v) => Math.abs((porSmart ? v.smart : v.forgiveness) - alvo);
      const variants = accepted
        .slice()
        .sort((a, b) => dist(a) - dist(b))
        .slice(0, VARIANTS_WANTED);
      return { index, soften, variants, screened, fallback: false };
    }
  }

  // Ultimo recurso: grava a variante mais suave mesmo sem certificado, para
  // que o jogo nunca fique sem esta fase. Fica marcada no relatorio.
  // Mesmo sem certificado, a fase de estreia mostra a peca que anuncia.
  const config = levelConfig(index, 3);
  const mostra = (/** @type {*} */ l) =>
    config.newMaterials.every((m) => l.pieces.some((/** @type {*} */ pc) => pc.material === m));
  let seed = seedFor(index, 3, 0);
  let layout = generateLayout(config, seed);
  for (let attempt = 1; attempt < 64 && !mostra(layout); attempt++) {
    seed = seedFor(index, 3, attempt);
    layout = generateLayout(config, seed);
  }
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
      // Um arquivo gravado com mais fases do que o jogo tem hoje (a versao de
      // 150 fases, por exemplo) nao pode vazar as linhas que sobram.
      if (i >= LEVEL_COUNT) return;
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
  /** Fases que nao chegaram as quatro variantes, e as que ficaram com uma so. */
  const magras = [];
  const unicas = [];
  for (const r of ordered) {
    softCount[r.soften]++;
    if (r.fallback) fallbacks++;
    if (r.kept) kept++;
    variantTotal += r.variants.length;
    if (r.variants.length < VARIANTS_WANTED) magras.push(r.index + 1);
    if (r.variants.length < 2) unicas.push(r.index + 1);
  }
  console.log('\nResumo');
  console.log('  fases geradas .............', ordered.length);
  console.log('  variantes validadas .......', variantTotal, `(media ${(variantTotal / ordered.length).toFixed(1)} por fase)`);
  console.log('  sem afrouxamento ..........', softCount[0]);
  console.log('  afrouxadas grau 1 / 2 / 3 .', softCount[1], '/', softCount[2], '/', softCount[3]);
  console.log('  sem certificado ...........', fallbacks, fallbacks ? '<-- revisar' : '');
  console.log('  com menos de', VARIANTS_WANTED, 'variantes ..', magras.length, magras.length ? `[${magras.join(' ')}]` : '');
  console.log('  com UMA variante ..........', unicas.length, unicas.length ? `[${unicas.join(' ')}] <-- sem embaralhar` : '');
  if (kept) console.log('  preservadas do arquivo ....', kept);

  const buckets10 = [];
  // Uma linha por MUNDO, e nao por dezena fixa: a fronteira sai de
  // WORLD_SIZES, que e quem sabe o tamanho de cada mundo.
  for (let b = 0; b < WORLD_COUNT; b++) {
    const ini = worldStart(b);
    const fim = ini + worldSize(b) - 1;
    const slice = ordered.filter((r) => r.index >= ini && r.index <= fim);
    if (!slice.length) continue;
    const forg = slice.reduce((a, r) => a + r.variants.reduce((x, v) => x + v.forgiveness, 0) / r.variants.length, 0) / slice.length;
    const smart = slice.reduce((a, r) => a + r.variants.reduce((x, v) => x + (v.smart || 0), 0) / r.variants.length, 0) / slice.length;
    const par = slice.reduce((a, r) => a + r.variants.reduce((x, v) => x + v.par, 0) / r.variants.length, 0) / slice.length;
    const tema = levelConfig(ini).theme;
    buckets10.push(
      `  mundo ${String(b + 1).padStart(2)} ${tema.padEnd(11)} fases ${String(ini + 1).padStart(3)}-${String(fim + 1).padStart(3)}` +
        `  toques ~${par.toFixed(1).padStart(4)}  perdoa ${(forg * 100).toFixed(0).padStart(3)}%` +
          // A taxa do competente nao vai no arquivo, so existe no que foi
          // gerado agora: mostrar zero para fase preservada seria mentira.
          (smart > 0 ? `  competente ${(smart * 100).toFixed(0).padStart(3)}%` : ''),
    );
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
