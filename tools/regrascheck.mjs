/**
 * Confere as regras de fase (game/regras.js) e que elas nao mexem em nada do
 * que ja estava validado.
 *
 * Roda em Node puro, sem Chrome nem servidor.
 *
 *   node tools/regrascheck.mjs --base     grava a assinatura das fases sem regra
 *   node tools/regrascheck.mjs            compara com a assinatura e roda os casos
 *
 * Por que existe: as regras moram no PhysicsWorld (build e evaluate), que e o
 * mesmo motor que certificou as cem fases de levels.gen.js. Uma regra que
 * vazasse para fase sem regra - um sorteio a mais, um ramo de evaluate fora da
 * guarda - mudaria em silencio o desfecho de fases ja validadas, e isso so
 * apareceria como "fase impossivel" no funil. A assinatura grava, para doze
 * variantes, o rollout completo (desfecho, toques, sequencia de pecas e passos)
 * e o par e o perdao recalculados contra o arquivo: tem que dar igual bit a bit.
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { levelConfig, generateLayout } from '../src/game/levelgen.js';
import { evaluateVariant, rollout } from '../src/game/solver.js';
import { LEVELS } from '../src/game/levels.gen.js';

const CACHE = resolve(homedir(), '.cache/hexadrop-regras');
const BASE = resolve(CACHE, 'base.json');
/** Doze fases espalhadas pela campanha, todas de degrau 0. */
const AMOSTRA = [4, 9, 12, 18, 27, 33, 44, 52, 61, 70, 85, 97];

/**
 * Assinatura de uma variante sem regra.
 * @param {number} level base 1
 */
function assinatura(level) {
  const index = level - 1;
  const rec = LEVELS[index];
  const [seed, par, perdao] = rec.v[0];
  const config = levelConfig(index, rec.s);
  const layout = generateLayout(config, seed);
  const r = rollout(layout, { policy: 'plan', seed: seed + 13 });
  const roteiro = config.minForgiveness !== undefined;
  const rep = evaluateVariant(layout, seed, {
    smartRuns: 6,
    naiveRuns: config.naiveRuns || (roteiro ? 6 : 3),
    minSmartWins: 2,
  });
  return {
    level,
    seed,
    rollout: { outcome: r.outcome, taps: r.taps, steps: r.steps, sequence: r.sequence.join(',') },
    par: rep.par,
    perdao: Number(rep.forgiveness.toFixed(2)),
    gravado: { par, perdao },
  };
}

if (!isMainThread) {
  for (const level of workerData.levels) parentPort?.postMessage(assinatura(level));
  parentPort?.close();
} else {
  const gravar = process.argv.includes('--base');
  const resultados = await Promise.all(
    AMOSTRA.map(
      (level) =>
        new Promise((ok, erro) => {
          const w = new Worker(fileURLToPath(import.meta.url), {
            workerData: { levels: [level] },
            resourceLimits: { maxOldGenerationSizeMb: 256 },
          });
          w.on('message', ok);
          w.on('error', erro);
        }),
    ),
  );
  resultados.sort((a, b) => a.level - b.level);

  let falhas = 0;
  /** @param {boolean} ok @param {string} msg */
  const confere = (ok, msg) => {
    if (ok) console.log('  ok   ' + msg);
    else {
      falhas++;
      console.log('  FALHA ' + msg);
    }
  };

  console.log('\nO motor reproduz levels.gen.js?');
  for (const r of resultados) {
    confere(
      r.par === r.gravado.par && Math.abs(r.perdao - r.gravado.perdao) < 0.006,
      `fase ${r.level}: par ${r.par} (gravado ${r.gravado.par}), perdao ${r.perdao} (gravado ${r.gravado.perdao})`,
    );
  }

  if (gravar) {
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(BASE, JSON.stringify(resultados, null, 1));
    console.log(`\nAssinatura gravada em ${BASE}`);
  } else if (existsSync(BASE)) {
    const antes = JSON.parse(readFileSync(BASE, 'utf8'));
    console.log('\nAs fases sem regra continuam identicas?');
    for (const r of resultados) {
      const a = antes.find((/** @type {*} */ x) => x.level === r.level);
      confere(
        !!a && JSON.stringify(a.rollout) === JSON.stringify(r.rollout) && a.par === r.par && a.perdao === r.perdao,
        `fase ${r.level}: ${r.rollout.outcome} em ${r.rollout.taps} toques, ${r.rollout.steps} passos`,
      );
    }
  } else {
    console.log('\nSem assinatura gravada: rode antes com --base.');
  }

  if (!gravar) {
    const { casos } = await import('./regrascasos.mjs');
    falhas += await casos();
  }

  console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
}
