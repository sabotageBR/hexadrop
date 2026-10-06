/**
 * Economia: quanto cada mundo rende de moeda, jogado pelo solucionador, e a
 * sequencia de hexagonos que sai disso.
 *
 * Roda em Node puro, sem Chrome nem servidor, como o savecheck: as fases sao as
 * de levels.gen.js, a fisica e a do jogo, e as moedas, os premios e a barra
 * saem do proprio `Progress.finishLevel` - a regra que vale no jogo e a que
 * vale aqui. A ultima fase de cada mundo paga a chuva (o dobro por peca).
 *
 *   node tools/economia.mjs                  # fases 1 a 45, 3 partidas por perfil
 *   node tools/economia.mjs --runs 6 --ate 50
 *
 * Dois perfis: `competente` joga a politica `plan` do solucionador; `mediano`
 * troca ~35% dos toques por um ao acaso e recomeca ate vencer. O mediano e o
 * mais perto do jogador de verdade: no mundo 1 o Evandro fez 223 moedas, o
 * competente faz ~310.
 *
 * Por que existe: a barra de moedas conta so o que o jogador ganha no proprio
 * mundo par, e o hexagono dela sai no fim desse mundo. O preco tem que caber
 * no que um mundo de cinco fases rende - e a 1.0.13 calibrou por "~35 moedas
 * por fase" contando o saldo inteiro, o que fez o Descolado sair na fase 6.
 * O preco sugerido e 80% da renda mediana do perfil mediano no mundo.
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { save } from '../src/core/storage.js';
import { Rng } from '../src/core/rng.js';
import { LEVELS } from '../src/game/levels.gen.js';
import { levelConfig, generateLayout, worldOf, worldStart, worldSize } from '../src/game/levelgen.js';
import { PhysicsWorld } from '../src/physics/world.js';
import { choosePiece, settle } from '../src/game/solver.js';
import { Progress } from '../src/game/progress.js';
import { faseDeOrigem } from '../src/game/alem.js';
import { upgradeEffects, barraDoMundo, skin as getSkin } from '../src/game/content.js';

/** Fracao dos toques do perfil mediano que sai ao acaso. */
const ACASO = 0.35;
/** Tentativas por fase antes de desistir dela. */
const TENTATIVAS = 8;
/** Preco sugerido: esta fracao da renda mediana do perfil mediano no mundo. */
const FRACAO_DO_PRECO = 0.8;

/**
 * Uma partida, do primeiro toque ao veredito.
 * @param {*} layout
 * @param {Record<string, number>} upgrades
 * @param {'competente'|'mediano'} perfil
 * @param {Rng} rng
 */
function joga(layout, upgrades, perfil, rng) {
  const eff = upgradeEffects(upgrades);
  let n = 0;
  const world = new PhysicsWorld({
    hexAngularDamping: eff.angularDamping,
    hexFrictionBonus: eff.frictionBonus,
    // Conta o que cada toque derruba, como o combo da Session: o solucionador
    // desliga este callback enquanto simula as candidatas.
    onDestroy: (_p, causa) => {
      if (causa !== 'cleanup') n++;
    },
  });
  world.build(layout);
  settle(world);
  let taps = 0;
  let comboScore = 0;
  let comboPieces = 0;
  let estado = 'playing';
  for (let i = 0; i < 60; i++) {
    estado = world.evaluate();
    if (estado !== 'playing') break;
    const politica = perfil === 'mediano' && rng.next() < ACASO ? 'random' : 'plan';
    const peca = choosePiece(world, politica, rng);
    if (!peca) {
      estado = 'stuck';
      break;
    }
    n = 0;
    world.destroyPiece(peca, 'tap');
    taps++;
    settle(world);
    if (n >= 2) {
      comboScore += n * n;
      comboPieces += n;
    }
  }
  if (estado === 'playing') estado = world.evaluate();
  const stars = world.starsCrossed;
  const sobraram = world.destructibleCount;
  world.destroy();
  // `stuck` com estrela e vitoria para o jogador (onLevelEnd em main.js).
  const venceu = estado === 'won' || (estado === 'stuck' && stars >= 1);
  return { venceu, won: estado === 'won', stars, taps, sobraram, comboScore, comboPieces };
}

/**
 * Um jogador do zero ate a fase `ate`.
 * @param {{perfil:'competente'|'mediano', run:number, ate:number}} t
 */
function jogador(t) {
  save('save', null);
  const p = new Progress();
  const rng = new Rng(9001 + t.run * 7919 + (t.perfil === 'mediano' ? 31 : 0));
  const linhas = [];
  for (let level = 1; level <= t.ate; level++) {
    const rec = LEVELS[level - 1];
    const config = levelConfig(level - 1, rec.s);
    let vi = Math.floor(rng.next() * rec.v.length);
    let r = null;
    let tentativas = 0;
    while (tentativas < TENTATIVAS) {
      tentativas++;
      const variante = rec.v[vi];
      const jogo = joga(generateLayout(config, variante[0]), p.data.upgrades, t.perfil, rng);
      if (jogo.venceu) {
        r = { ...jogo, par: variante[1] };
        break;
      }
      // O jogo repete o layout duas vezes e depois troca; aqui basta trocar.
      if (tentativas >= 2) vi = (vi + 1) % rec.v.length;
    }
    if (!r) {
      linhas.push({ level, coins: 0, saldo: p.data.coins, barra: 0, skin: p.data.skin, tentativas, desistiu: true });
      continue;
    }
    const chuva = faseDeOrigem(level).fimDeMundo;
    const res = p.finishLevel({
      level,
      stars: r.stars,
      won: r.won,
      taps: r.taps,
      par: r.par,
      bonusPieces: chuva ? 0 : r.sobraram,
      chuvaPieces: chuva ? r.sobraram : 0,
      comboScore: r.comboScore,
      comboPieces: r.comboPieces,
    });
    const mundo = worldOf(level - 1);
    linhas.push({
      level,
      coins: res.coins + res.bonusCoins,
      saldo: p.data.coins,
      barra: p.barraMoedasDe(mundo),
      skin: p.data.skin,
      tentativas,
      prize: res.prize ? `${res.prize.kind}:${res.prize.id || res.prize.coins}` : '',
      unlock: res.unlock ? res.unlock.id : '',
    });
  }
  return { ...t, linhas };
}

if (!isMainThread) {
  parentPort.postMessage(jogador(workerData));
} else {
  const args = process.argv.slice(2);
  const arg = (/** @type {string} */ nome, /** @type {number} */ padrao) => {
    const i = args.indexOf(nome);
    return i >= 0 ? Number(args[i + 1]) : padrao;
  };
  const runs = arg('--runs', 3);
  const ate = Math.min(LEVELS.length, arg('--ate', 45));
  /** @type {{perfil:'competente'|'mediano', run:number, ate:number}[]} */
  const tarefas = [];
  for (const perfil of /** @type {const} */ (['competente', 'mediano'])) {
    for (let run = 0; run < runs; run++) tarefas.push({ perfil, run, ate });
  }
  const t0 = Date.now();
  const resultados = await Promise.all(
    tarefas.map(
      (t) =>
        new Promise((ok, falha) => {
          const w = new Worker(fileURLToPath(import.meta.url), { workerData: t });
          w.once('message', ok);
          w.once('error', falha);
        }),
    ),
  );
  console.log(`${tarefas.length} jogadores, fases 1 a ${ate}, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);

  const mediana = (/** @type {number[]} */ xs) => {
    const o = [...xs].sort((a, b) => a - b);
    return o.length ? o[Math.floor((o.length - 1) / 2)] : 0;
  };
  const p25 = (/** @type {number[]} */ xs) => {
    const o = [...xs].sort((a, b) => a - b);
    return o.length ? o[Math.floor((o.length - 1) / 4)] : 0;
  };
  const mundos = Math.ceil(ate / 5);
  /** @param {*} r @param {number} w */
  const rendaDoMundo = (r, w) =>
    r.linhas.filter((/** @type {*} */ l) => worldOf(l.level - 1) === w).reduce((s, /** @type {*} */ l) => s + l.coins, 0);

  console.log('renda por mundo (mediana / p25)');
  console.log('mundo  competente   mediano    barra');
  for (let w = 0; w < mundos; w++) {
    const linha = [`  ${String(w + 1).padStart(2)}`];
    for (const perfil of ['competente', 'mediano']) {
      const rs = resultados.filter((/** @type {*} */ r) => r.perfil === perfil).map((r) => rendaDoMundo(r, w));
      linha.push(`${String(mediana(rs)).padStart(6)} / ${String(p25(rs)).padEnd(4)}`);
    }
    const id = barraDoMundo(w);
    if (id) {
      const rs = resultados.filter((/** @type {*} */ r) => r.perfil === 'mediano').map((r) => rendaDoMundo(r, w));
      const sugerido = Math.round((mediana(rs) * FRACAO_DO_PRECO) / 10) * 10;
      // Encheu sozinha: o contador do mundo chegou ao preco na ultima fase.
      const fim = worldStart(w) + worldSize(w);
      const sozinha = resultados.filter((/** @type {*} */ r) => {
        const l = r.linhas.find((/** @type {*} */ x) => x.level === fim - 1);
        const ultima = r.linhas.find((/** @type {*} */ x) => x.level === fim);
        return l && ultima && l.barra + ultima.coins >= getSkin(id).cost;
      }).length;
      linha.push(`  ${id} ${getSkin(id).cost} (sugerido ${sugerido}; encheu sozinha ${sozinha}/${resultados.length})`);
    }
    console.log(linha.join('  '));
  }

  console.log('\nhexagono em uso: fase em que chegou e quantas fases durou');
  for (const r of resultados) {
    /** @type {string[]} */
    const trocas = [];
    let atual = 'classic';
    let desde = 1;
    for (const l of /** @type {*[]} */ (r.linhas)) {
      if (l.skin !== atual) {
        if (atual !== 'classic') trocas.push(`${atual}@${desde}:${l.level - desde}`);
        atual = l.skin;
        desde = l.level;
      }
    }
    trocas.push(`${atual}@${desde}:...`);
    const desistiu = r.linhas.filter((/** @type {*} */ l) => l.desistiu).map((/** @type {*} */ l) => l.level);
    console.log(`  ${r.perfil.padEnd(10)} #${r.run}  ${trocas.join('  ')}${desistiu.length ? `  (desistiu: ${desistiu.join(', ')})` : ''}`);
  }

  console.log('\nfase a fase (mediano #0)');
  console.log('fase  moedas  saldo  barra  hexagono     chegou');
  const m0 = resultados.find((/** @type {*} */ r) => r.perfil === 'mediano' && r.run === 0);
  for (const l of /** @type {*[]} */ (m0 ? m0.linhas : [])) {
    const chegou = [l.prize, l.unlock && `barra:${l.unlock}`].filter(Boolean).join(' + ');
    console.log(
      `${String(l.level).padStart(4)}  ${String(l.coins).padStart(6)}  ${String(l.saldo).padStart(5)}  ${String(l.barra).padStart(5)}  ${String(l.skin).padEnd(11)}  ${chegou}${l.tentativas > 1 ? `  (${l.tentativas} tentativas)` : ''}`,
    );
  }
}
