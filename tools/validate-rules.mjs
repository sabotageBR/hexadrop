/**
 * Valida as regras de fase (src/game/regras.js) sobre as variantes de
 * levels.gen.js e grava src/game/regras.gen.js.
 *
 * Nada aqui gera layout novo: cada variante continua a que o gerador certificou.
 * Para cada fase que a agenda (`regraDaFase`) marca, e para cada variante, o
 * programa tenta os parametros da regra (`candidatosDaRegra`), do mais rigido
 * ao mais folgado, e fica com o primeiro que o jogador competente do
 * solucionador ainda vence - com o mesmo criterio do gerador (duas vitorias em
 * seis e robustez com as posicoes perturbadas) e sem ficar muito mais dificil
 * que a mesma variante sem regra: no maximo duas vitorias a menos.
 *
 * Fase com menos de duas variantes aprovadas tenta a regra seguinte do rodizio;
 * se nenhuma passa, fica sem regra. Duas e o minimo para o "tentar de novo" em
 * outro layout e o embaralhar continuarem existindo.
 *
 * Uso:
 *   node tools/validate-rules.mjs                 todas as fases com regra
 *   node tools/validate-rules.mjs --levels 21-25  so um trecho (o resto e preservado)
 *   node tools/validate-rules.mjs --workers 12
 *   node tools/validate-rules.mjs --retomar       continua de onde parou
 *   node tools/validate-rules.mjs --conferir      so confere regras.gen.js contra levels.gen.js (sem simular)
 *
 * Memoria: todos os workers vivem num processo so, e o earlyoom desta maquina
 * mata o maior processo. Cada worker tem teto de heap, o progresso vai para
 * ~/.cache/hexadrop-regras/ (e nao /tmp, que aqui e RAM) a cada variante, e o
 * proprio processo se oferece primeiro ao earlyoom (oom_score_adj 1000): se
 * morrer, --retomar recomeca de onde parou.
 */

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

import { levelConfig, generateLayout, LEVEL_COUNT, WORLD_COUNT, worldStart, worldSize } from '../src/game/levelgen.js';
import { evaluateVariant, rollout, SMART_POLICIES, NAIVE_POLICIES } from '../src/game/solver.js';
import { LEVELS } from '../src/game/levels.gen.js';
import {
  regraDaFase, proximaRegra, candidatosDaRegra, comRegra, REGRA_IDS, regraDaVariante, ESTREIA,
} from '../src/game/regras.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/game/regras.gen.js');
const CACHE = resolve(homedir(), '.cache/hexadrop-regras');
const PROGRESSO = resolve(CACHE, 'progresso.jsonl');
const REGRAS_VERSION = 1;

/** Partidas competentes por variante, as mesmas seeds do gerador. */
const SMART_RUNS = 6;

/**
 * Vitorias do competente sem regra: a base contra a qual a regra e medida.
 * @param {*} layout
 * @param {number} seed
 */
function vitoriasBase(layout, seed) {
  let wins = 0;
  for (let i = 0; i < SMART_RUNS; i++) {
    const res = rollout(layout, { policy: SMART_POLICIES[i % SMART_POLICIES.length], seed: seed + i * 977 + 13 });
    if (res.outcome === 'won') wins++;
  }
  return wins;
}

/**
 * Uma tarefa: uma variante de uma fase com uma regra.
 * @param {{index:number, vi:number, id:string, base:number|null}} t
 */
function validaVariante(t) {
  const rec = LEVELS[t.index];
  const [seed] = rec.v[t.vi];
  const config = levelConfig(t.index, rec.s);
  const layout = generateLayout(config, seed);
  const inicio = Date.now();
  const base = t.base ?? vitoriasBase(layout, seed);
  const piso = Math.max(2, base - 2);
  const cands = candidatosDaRegra(t.id, layout, seed, t.index);
  for (let c = 0; c < cands.length; c++) {
    const param = cands[c];
    const regra = { tipo: t.id, ...param };
    delete regra.a;
    const rep = evaluateVariant(comRegra(layout, regra), seed, { smartRuns: SMART_RUNS, naiveRuns: 0, minSmartWins: 2 });
    if (!rep.accepted || rep.smartWins < piso) continue;
    // O perdao so importa onde ele e a regua (fases 21 a 25): e so relatorio.
    let perdao = null;
    if (t.index < worldStart(5)) {
      let ganhos = 0;
      for (let i = 0; i < 6; i++) {
        const res = rollout(comRegra(layout, regra), {
          policy: NAIVE_POLICIES[i % NAIVE_POLICIES.length],
          seed: seed + 30011 + i * 617,
        });
        if (res.outcome === 'won') ganhos++;
      }
      perdao = ganhos / 6;
    }
    return { ...t, base, ok: true, param: { s: seed, ...param }, wins: rep.smartWins, tentativa: c, perdao, ms: Date.now() - inicio };
  }
  return { ...t, base, ok: false, tentados: cands.length, ms: Date.now() - inicio };
}

if (!isMainThread) {
  parentPort?.on('message', (t) => {
    if (t === null) {
      parentPort?.close();
      return;
    }
    parentPort?.postMessage(validaVariante(t));
  });
} else {
  await principal();
}

async function principal() {
  const argv = process.argv.slice(2);
  const arg = (/** @type {string} */ nome) => {
    const i = argv.indexOf(nome);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  if (argv.includes('--conferir')) {
    process.exit(await conferir());
  }

  try {
    writeFileSync('/proc/self/oom_score_adj', '1000');
  } catch {
    /* fora do Linux, ou sem permissao: segue */
  }
  mkdirSync(CACHE, { recursive: true });

  /** @type {number[]} */
  let indices = [];
  const faixa = arg('--levels');
  if (faixa) {
    const [a, b] = faixa.split('-').map(Number);
    for (let i = a; i <= (b || a); i++) indices.push(i - 1);
  } else {
    for (let i = 0; i < LEVEL_COUNT; i++) indices.push(i);
  }
  /** Fases deste trecho: as de fora sao preservadas do arquivo anterior. */
  const noTrecho = new Set(indices);
  /** Regra em teste por fase, e as ja tentadas. */
  /** @type {Map<number, {id:string, tentadas:string[]}>} */
  const estado = new Map();
  for (const i of indices) {
    const id = regraDaFase(i, levelConfig(i, LEVELS[i].s));
    if (id) estado.set(i, { id, tentadas: [id] });
  }
  indices = [...estado.keys()];

  /** Resultado por chave `index|vi|id`. */
  /** @type {Map<string, *>} */
  const feitos = new Map();
  if (argv.includes('--retomar') && existsSync(PROGRESSO)) {
    for (const linha of readFileSync(PROGRESSO, 'utf8').split('\n')) {
      if (!linha.trim()) continue;
      const r = JSON.parse(linha);
      feitos.set(`${r.index}|${r.vi}|${r.id}`, r);
    }
    console.log(`Retomando: ${feitos.size} variantes ja validadas.`);
  } else {
    writeFileSync(PROGRESSO, '');
  }
  /** Vitorias sem regra por variante, para nao refazer a cada rodada. */
  /** @type {Map<string, number>} */
  const bases = new Map();
  for (const r of feitos.values()) bases.set(`${r.index}|${r.vi}`, r.base);

  const nWorkers = Math.max(1, Math.min(Number(arg('--workers')) || 16, (cpus().length || 4) - 1));
  console.log(`Validando regras em ${indices.length} fases com ${nWorkers} workers...`);
  const inicio = Date.now();

  /** @param {*[]} tarefas */
  async function roda(tarefas) {
    const fila = tarefas.slice();
    let feitasAgora = 0;
    const total = fila.length;
    await Promise.all(
      Array.from({ length: Math.min(nWorkers, fila.length) }, () =>
        new Promise((ok, erro) => {
          const w = new Worker(fileURLToPath(import.meta.url), {
            resourceLimits: { maxOldGenerationSizeMb: 256 },
          });
          const proxima = () => {
            const t = fila.shift();
            if (!t) {
              w.postMessage(null);
              return;
            }
            w.postMessage(t);
          };
          w.on('message', (r) => {
            feitos.set(`${r.index}|${r.vi}|${r.id}`, r);
            bases.set(`${r.index}|${r.vi}`, r.base);
            appendFileSync(PROGRESSO, JSON.stringify(r) + '\n');
            feitasAgora++;
            const secs = ((Date.now() - inicio) / 1000).toFixed(0);
            const rss = (process.memoryUsage().rss / 1048576).toFixed(0);
            process.stdout.write(`\r  ${feitasAgora}/${total}  ${secs}s  ${rss} MB   `);
            proxima();
          });
          w.on('error', erro);
          w.on('exit', ok);
          proxima();
        }),
      ),
    );
    process.stdout.write('\n');
  }

  for (let rodada = 0; rodada < REGRA_IDS.length; rodada++) {
    /** @type {*[]} */
    const tarefas = [];
    for (const [index, e] of estado) {
      LEVELS[index].v.forEach((_, vi) => {
        const chave = `${index}|${vi}|${e.id}`;
        if (feitos.has(chave)) return;
        tarefas.push({ index, vi, id: e.id, base: bases.get(`${index}|${vi}`) ?? null });
      });
    }
    // As torres altas primeiro: sao as que demoram, e no fim da fila elas
    // deixariam um worker trabalhando sozinho.
    tarefas.sort((a, b) => levelConfig(b.index, LEVELS[b.index].s).rows - levelConfig(a.index, LEVELS[a.index].s).rows);
    if (tarefas.length) {
      console.log(`Rodada ${rodada + 1}: ${tarefas.length} variantes`);
      await roda(tarefas);
    }
    // Fase com menos de duas aprovadas tenta a regra seguinte do rodizio.
    let mudou = false;
    for (const [index, e] of estado) {
      if (aprovadas(index, e.id).length >= 2) continue;
      const config = levelConfig(index, LEVELS[index].s);
      const livre = (/** @type {string} */ r) => !e.tentadas.includes(r) && !(r === 'dourado' && config.oscillate);
      /** @type {string|null} */
      let prox = null;
      let r = e.id;
      for (let k = 0; k < REGRA_IDS.length; k++) {
        r = proximaRegra(r);
        if (livre(r)) {
          prox = r;
          break;
        }
      }
      if (!prox) continue;
      e.tentadas.push(prox);
      e.id = prox;
      mudou = true;
    }
    if (!mudou) break;
  }

  /** @param {number} index @param {string} id */
  function aprovadas(index, id) {
    return LEVELS[index].v.map((_, vi) => feitos.get(`${index}|${vi}|${id}`)).filter((r) => r && r.ok);
  }

  // ---- arquivo ----------------------------------------------------------
  /** @type {Record<number, {r:string, v:(*|null)[]}>} */
  const regras = {};
  if (faixa && existsSync(OUT)) {
    const antigo = await import(pathToFileURL(OUT).href + '?t=' + Date.now());
    for (const [k, v] of Object.entries(antigo.REGRAS || {})) {
      if (!noTrecho.has(Number(k))) regras[Number(k)] = v;
    }
  }
  for (const [index, e] of estado) {
    const ok = aprovadas(index, e.id);
    if (ok.length < 2) continue;
    regras[index] = {
      r: e.id,
      v: LEVELS[index].v.map((_, vi) => {
        const r = feitos.get(`${index}|${vi}|${e.id}`);
        return r && r.ok ? r.param : null;
      }),
    };
  }
  gravar(regras);

  // ---- relatorio --------------------------------------------------------
  console.log('\nResumo por mundo');
  for (let w = 0; w < WORLD_COUNT; w++) {
    const ini = worldStart(w);
    const fim = ini + worldSize(w) - 1;
    const doMundo = [...estado.keys()].filter((i) => i >= ini && i <= fim);
    if (!doMundo.length) continue;
    const partes = doMundo.map((i) => {
      const rec = regras[i];
      const agenda = regraDaFase(i, levelConfig(i, LEVELS[i].s));
      if (!rec) return `${i + 1}:-`;
      const n = rec.v.filter(Boolean).length;
      const rs = LEVELS[i].v.map((_, vi) => feitos.get(`${i}|${vi}|${rec.r}`)).filter((r) => r && r.ok);
      const base = rs.reduce((a, r) => a + r.base, 0) / (rs.length || 1);
      const comR = rs.reduce((a, r) => a + r.wins, 0) / (rs.length || 1);
      const perd = rs.filter((r) => r.perdao !== null);
      // O perdao sem regra e o gravado em levels.gen.js (terceiro numero).
      const semRegra = perd.reduce((a, r) => a + LEVELS[i].v[r.vi][2], 0) / (perd.length || 1);
      const perdao = perd.length
        ? ` perdao ${semRegra.toFixed(2)}->${(perd.reduce((a, r) => a + r.perdao, 0) / perd.length).toFixed(2)}`
        : '';
      const troca = rec.r !== agenda ? ` (era ${agenda})` : '';
      return `${i + 1}:${rec.r}${troca} ${n}/${LEVELS[i].v.length} comp ${base.toFixed(1)}->${comR.toFixed(1)}${perdao}`;
    });
    console.log(`  mundo ${String(w + 1).padStart(2)}  ${partes.join('  |  ')}`);
  }
  const comRegraN = Object.keys(regras).filter((k) => Number(k) >= worldStart(7)).length;
  const possiveis = [...Array(LEVEL_COUNT).keys()].filter((i) => i >= worldStart(7)).length;
  console.log(`\nFases com regra do mundo 8 em diante: ${comRegraN} de ${possiveis}`);
  for (const id of REGRA_IDS) {
    const primeira = Object.keys(regras).map(Number).sort((a, b) => a - b).find((k) => regras[k].r === id);
    console.log(`  ${id.padEnd(8)} estreia na fase ${primeira === undefined ? '-' : primeira + 1} (agenda: ${ESTREIA[id] + 1})`);
  }
  console.log(`\nArquivo gravado: ${OUT}  (${((Date.now() - inicio) / 60000).toFixed(1)} min)`);
}

/** @param {Record<number, {r:string, v:(*|null)[]}>} regras */
function gravar(regras) {
  const linhas = Object.keys(regras)
    .map(Number)
    .sort((a, b) => a - b)
    .map((k) => `  ${k}: ${JSON.stringify(regras[k])},`);
  const file = `/**
 * Regras de fase validadas por tools/validate-rules.mjs. NAO EDITE A MAO.
 *
 * Para cada fase com regra (chave = indice base 0), o tipo e, por variante de
 * levels.gen.js, o parametro aprovado (ou null). Cada variante guarda a propria
 * seed, e a joia e os cadeados guardam a assinatura da peca: se levels.gen.js
 * for regerado sem revalidar as regras, a assinatura deixa de bater e a regra e
 * descartada no jogo. \`node tools/validate-rules.mjs --conferir\` acusa isso.
 * Gerado em ${new Date().toISOString().slice(0, 10)}.
 */

export const REGRAS_VERSION = ${REGRAS_VERSION};

/** @type {Record<number, {r:string, v:(*|null)[]}>} */
export const REGRAS = {
${linhas.join('\n')}
};
`;
  writeFileSync(OUT, file);
}

/**
 * Confere regras.gen.js contra levels.gen.js, sem simular: seed de cada
 * variante e assinatura das pecas.
 * @returns {Promise<number>} codigo de saida
 */
async function conferir() {
  const src = readFileSync(OUT, 'utf8');
  if (!/export const REGRAS = \{/.test(src)) {
    console.log('regras.gen.js sem a tabela REGRAS.');
    return 1;
  }
  return import(pathToFileURL(OUT).href).then((m) => {
    let erros = 0;
    let fases = 0;
    for (const [k, rec] of Object.entries(m.REGRAS)) {
      const index = Number(k);
      fases++;
      const lv = LEVELS[index];
      rec.v.forEach((/** @type {*} */ v, /** @type {number} */ vi) => {
        if (!v) return;
        const variante = lv && lv.v[vi];
        if (!variante || variante[0] !== v.s) {
          erros++;
          console.log(`  fase ${index + 1} variante ${vi}: seed nao bate`);
          return;
        }
        const layout = generateLayout(levelConfig(index, lv.s), v.s);
        if (!regraDaVariante(index, vi, v.s, layout)) {
          erros++;
          console.log(`  fase ${index + 1} variante ${vi}: assinatura nao bate`);
        }
      });
    }
    console.log(erros ? `regras.gen.js: ${erros} erro(s) em ${fases} fases.` : `regras.gen.js confere (${fases} fases).`);
    return erros ? 1 : 0;
  });
}
