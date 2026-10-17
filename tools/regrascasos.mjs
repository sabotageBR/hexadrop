/**
 * Casos das regras de fase, em Node puro. Chamado por tools/regrascheck.mjs.
 *
 * Cada caso monta uma fase de verdade (levels.gen.js) com a regra anexada e
 * confere o veredito do PhysicsWorld, que e o mesmo que o validador, a dica e
 * a Session leem.
 */
import { levelConfig, generateLayout } from '../src/game/levelgen.js';
import { PhysicsWorld } from '../src/physics/world.js';
import { Session } from '../src/game/session.js';
import { LEVELS } from '../src/game/levels.gen.js';
import { comRegra, candidatosDaRegra, regraDaFase, ESTREIA, REGRA_IDS } from '../src/game/regras.js';
import { material as getMaterial } from '../src/physics/materials.js';

/** @param {number} level base 1 @param {number} [vi] */
function fase(level, vi = 0) {
  const index = level - 1;
  const rec = LEVELS[index];
  const [seed] = rec.v[vi];
  const config = levelConfig(index, rec.s);
  return { index, seed, config, layout: generateLayout(config, seed) };
}

/** @param {*} layout */
function mundo(layout) {
  const w = new PhysicsWorld();
  w.build(layout);
  return w;
}

export async function casos() {
  let falhas = 0;
  /** @param {boolean} ok @param {string} msg */
  const confere = (ok, msg) => {
    if (ok) console.log('  ok   ' + msg);
    else {
      falhas++;
      console.log('  FALHA ' + msg);
    }
  };

  console.log('\nAgenda');
  // O mundo 4 (16 a 20) ficou livre quando o limite de toques saiu (1.0.19).
  let mundo4 = true;
  for (let i = 15; i < ESTREIA.joia; i++) if (regraDaFase(i, levelConfig(i, LEVELS[i].s)) !== null) mundo4 = false;
  confere(mundo4, 'nada antes da fase 21');
  confere(regraDaFase(ESTREIA.joia, levelConfig(ESTREIA.joia)) === 'joia', 'fase 21: joia');
  confere(regraDaFase(ESTREIA.cadeado, levelConfig(ESTREIA.cadeado)) === 'cadeado', 'fase 26: cadeado');
  let semBalanco = true;
  for (let i = 0; i < 100; i++) {
    const c = levelConfig(i, LEVELS[i].s);
    if (regraDaFase(i, c) === 'dourado' && c.oscillate) semBalanco = false;
  }
  confere(semBalanco, 'dourado nunca em pedestal que balanca');
  confere(regraDaFase(99, levelConfig(99, 2)) === null, 'fase afrouxada (100, degrau 2): livre');
  let soConhecidas = true;
  for (let i = 0; i < 100; i++) {
    const r = regraDaFase(i, levelConfig(i, LEVELS[i].s));
    if (r !== null && !REGRA_IDS.includes(r)) soConhecidas = false;
  }
  confere(soConhecidas && !REGRA_IDS.includes('toques'), 'a agenda so pede joia, cadeado e dourado');

  console.log('\nJoia');
  {
    const f = fase(21);
    const cands = candidatosDaRegra('joia', f.layout, f.seed, f.index);
    confere(cands.length > 0, `fase 21 tem ${cands.length} candidata(s) a joia`);
    const peca = cands[0] ? cands[0].peca : 0;
    const w = mundo(comRegra(f.layout, { tipo: 'joia', peca }));
    const joia = w.pieces[peca];
    confere(!!joia.joia && !w.tocavel(joia), 'a joia nao e tocavel');
    w.destroyPiece(joia, 'tap');
    confere(joia.alive, 'toque na joia e recusado');
    const snap = w.snapshot();
    w.destroyPiece(joia, 'explosion');
    confere(w.evaluate() === 'lost' && w.motivo === 'joia', 'joia destruida perde a fase');
    w.restore(snap);
    confere(joia.alive && w.evaluate() === 'playing', 'restore devolve a joia');
    joia.body.setTransform({ x: joia.body.getPosition().x, y: -2 }, 0);
    confere(w.evaluate() === 'lost' && w.motivo === 'joia', 'joia abaixo do pedestal perde a fase');
    w.destroy();

    const s = new Session({ layout: comRegra(f.layout, { tipo: 'joia', peca }), seed: f.seed });
    const pos = s.world.pieces[peca].body.getPosition();
    const r = s.tap(pos.x, pos.y);
    confere(!!r && !r.ok && r.reason === 'joia' && s.state === 'ready', 'Session recusa a joia sem comecar a partida');
    s.destroy();
  }

  console.log('\nCadeado');
  {
    const f = fase(26);
    const cands = candidatosDaRegra('cadeado', f.layout, f.seed, f.index);
    confere(cands.length > 0 && cands[0].pecas.length >= 2, `fase 26: ${cands.length} conjunto(s)`);
    const pecas = cands[0] ? cands[0].pecas : [0, 1];
    const s = new Session({ layout: comRegra(f.layout, { tipo: 'cadeado', pecas }), seed: f.seed });
    for (let i = 0; i < 40; i++) s.step(1 / 60);
    let limpa = true;
    for (let k = 0; k < 4; k++) {
      const p = s.requestHint();
      if (p && p.presa) limpa = false;
    }
    confere(limpa, 'a dica nunca indica peca presa');
    s.destroy();

    // Tudo preso: o hexagono pousa no topo da torre e nada mais se toca.
    const todas = f.layout.pieces.map((_, i) => i);
    const w = mundo(comRegra(f.layout, { tipo: 'cadeado', pecas: todas }));
    let v = 'playing';
    for (let k = 0; k < 900 && v === 'playing'; k++) {
      w.step(1 / 60);
      v = w.evaluate();
    }
    confere(v === 'stuck', `torre toda presa termina encalhada: ${v}`);
    w.destroy();
  }

  console.log('\nDourado');
  {
    const f = fase(31);
    const meia = 0.9;
    for (const [dx, espera] of [
      [0, 'won'],
      [meia + 0.9, 'lost'],
    ]) {
      const w = mundo(comRegra(f.layout, { tipo: 'dourado', meia }));
      // Tira a torre inteira e pousa o hexagono no pedestal, no centro ou
      // fora da faixa.
      for (const p of w.alivePieces()) w.destroyPiece(p, 'cleanup');
      const hx = w.pedestalX() + /** @type {number} */ (dx);
      w.hexBody.setTransform({ x: hx, y: w.hexHalfHeight() + 0.02 }, 0);
      w.hexBody.setLinearVelocity({ x: 0, y: 0 });
      let v = 'playing';
      let primeiro = null;
      for (let k = 0; k < 400 && v === 'playing'; k++) {
        w.step(1 / 60);
        v = w.evaluate();
        if (primeiro === null && v !== 'playing') primeiro = k;
      }
      const dormiu = !w.hexBody.isAwake();
      confere(
        v === espera && (espera === 'won' || (w.motivo === 'dourado' && dormiu)),
        `pouso a ${dx.toFixed(1)} m do centro: ${v}${w.motivo ? ' (' + w.motivo + ')' : ''}`,
      );
      w.destroy();
    }
  }

  console.log('\nNada muda sem regra');
  {
    const f = fase(40);
    const w = mundo(f.layout);
    confere(w.regra === null && w.motivo === null, 'sem regra: nada anexado');
    const todas = w.alivePieces().filter((p) => getMaterial(p.material).destructible).length;
    confere(w.alivePieces().filter((p) => w.tocavel(p)).length === todas, 'sem regra: tocavel = destrutivel');
    w.destroy();
  }
  return falhas;
}
