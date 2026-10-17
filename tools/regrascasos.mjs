/**
 * Casos das regras de fase, em Node puro. Chamado por tools/regrascheck.mjs.
 *
 * Cada caso monta uma fase de verdade (levels.gen.js) com a regra anexada e
 * confere o veredito do PhysicsWorld, que e o mesmo que o validador, a dica e
 * a Session leem.
 */
import { levelConfig, generateLayout } from '../src/game/levelgen.js';
import { PhysicsWorld } from '../src/physics/world.js';
import { rollout, settle } from '../src/game/solver.js';
import { Session } from '../src/game/session.js';
import { LEVELS } from '../src/game/levels.gen.js';
import { comRegra, candidatosDaRegra, regraDaFase, ESTREIA, folgaDeToques } from '../src/game/regras.js';
import { material as getMaterial } from '../src/physics/materials.js';

/** @param {number} level base 1 @param {number} [vi] */
function fase(level, vi = 0) {
  const index = level - 1;
  const rec = LEVELS[index];
  const [seed, par] = rec.v[vi];
  const config = levelConfig(index, rec.s);
  return { index, seed, par, config, layout: generateLayout(config, seed) };
}

/** @param {*} layout */
function mundo(layout) {
  const w = new PhysicsWorld();
  w.build(layout);
  return w;
}

/** @param {PhysicsWorld} w @param {number} n */
function passos(w, n) {
  for (let i = 0; i < n; i++) w.step(1 / 60);
}

/** A peca tocavel mais alta: tirar ela quase nunca resolve a fase. @param {PhysicsWorld} w */
function topo(w) {
  let best = null;
  let y = -Infinity;
  for (const p of w.alivePieces()) {
    if (!w.tocavel(p)) continue;
    const py = p.body.getPosition().y;
    if (py > y) {
      y = py;
      best = p;
    }
  }
  return best;
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
  confere(regraDaFase(ESTREIA.toques - 1, levelConfig(ESTREIA.toques - 1)) === null, 'nada antes da fase 16');
  confere(regraDaFase(ESTREIA.toques, levelConfig(ESTREIA.toques)) === 'toques', 'fase 16: toques');
  confere(regraDaFase(19, levelConfig(19)) === null, 'fase 20 (fim do mundo): livre');
  confere(regraDaFase(ESTREIA.joia, levelConfig(ESTREIA.joia)) === 'joia', 'fase 21: joia');
  confere(regraDaFase(ESTREIA.cadeado, levelConfig(ESTREIA.cadeado)) === 'cadeado', 'fase 26: cadeado');
  let semBalanco = true;
  for (let i = 0; i < 100; i++) {
    const c = levelConfig(i, LEVELS[i].s);
    if (regraDaFase(i, c) === 'dourado' && c.oscillate) semBalanco = false;
  }
  confere(semBalanco, 'dourado nunca em pedestal que balanca');
  confere(regraDaFase(99, levelConfig(99, 2)) === null, 'fase afrouxada (100, degrau 2): livre');
  confere(
    folgaDeToques(10, 15) === 5 && folgaDeToques(10, 40) === 4 && folgaDeToques(10, 80) === 3 && folgaDeToques(4, 80) === 3,
    'folga de meta 10: 5 / 4 / 3, e nunca menos de 3',
  );

  console.log('\nToques');
  {
    const f = fase(16);
    const w = mundo(comRegra(f.layout, { tipo: 'toques', limite: 1 }));
    settle(w);
    const alvo = topo(w);
    w.destroyPiece(alvo, 'tap');
    w.step(1 / 60);
    confere(w.evaluate() === 'playing', 'o ultimo toque nao perde no passo seguinte');
    const snap = w.snapshot();
    confere(w.toquesUsados === 1 && w.toquesRestantes() === 0, 'contou o toque e esgotou o limite');
    const outra = topo(w);
    w.destroyPiece(outra, 'tap');
    confere(!!outra && outra.alive, 'toque alem do limite e recusado pelo mundo');
    let v = 'playing';
    for (let k = 0; k < 600 && v === 'playing'; k++) {
      w.step(1 / 60);
      v = w.evaluate();
    }
    confere(v === 'lost' && w.motivo === 'toques', `sem toques e sem vitoria: ${v} (${w.motivo})`);
    w.restore(snap);
    confere(w.toquesUsados === 1 && w.motivo === null, 'restore devolve o contador e limpa o motivo');
    w.destroy();
  }
  {
    const f = fase(17);
    const r = rollout(comRegra(f.layout, { tipo: 'toques', limite: 2 }), { policy: 'plan', seed: f.seed + 13 });
    confere(r.taps <= 2 && r.outcome !== 'timeout', `rollout respeita o limite: ${r.outcome} em ${r.taps} toques`);
    const ok = rollout(comRegra(f.layout, { tipo: 'toques', limite: f.par + 6 }), { policy: 'plan', seed: f.seed + 13 });
    const livre = rollout(f.layout, { policy: 'plan', seed: f.seed + 13 });
    confere(ok.outcome === livre.outcome, `limite folgado nao muda o desfecho: ${ok.outcome} / ${livre.outcome}`);
  }
  {
    // Sem toques nao ha volta de jogada, mesmo com voltas sobrando: a volta
    // devolveria um toque so e o jogador ficava num laco de perder de novo.
    const f = fase(16);
    const s = new Session({ layout: comRegra(f.layout, { tipo: 'toques', limite: 1 }), seed: f.seed });
    s.rewindOnLoss = true;
    s.rewindLimit = 2;
    for (let i = 0; i < 60; i++) s.step(1 / 60);
    const alvo = topo(s.world);
    const pos = alvo.body.getPosition();
    const r = s.tap(pos.x, pos.y);
    for (let i = 0; i < 900 && !s.finished; i++) s.step(1 / 60);
    confere(
      !!r && r.ok && !!s.checkpoint && s.state === 'lost' && s.motivo === 'toques' && s.rewinds === 0,
      `sem toques perde direto, sem voltar jogada: ${s.state} (${s.motivo}), voltas ${s.rewinds}`,
    );
    s.destroy();
  }
  {
    const f = fase(16);
    const s = new Session({ layout: comRegra(f.layout, { tipo: 'toques', limite: f.par + 4 }), seed: f.seed });
    for (let i = 0; i < 30; i++) s.step(1 / 60);
    const antes = s.world.toquesUsados;
    s.requestHint();
    confere(s.world.toquesUsados === antes, 'a dica simula sem gastar toque');
    s.destroy();
  }

  console.log('\nJoia');
  {
    const f = fase(21);
    const cands = candidatosDaRegra('joia', f.layout, f.seed, f.par, f.index);
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
    const cands = candidatosDaRegra('cadeado', f.layout, f.seed, f.par, f.index);
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
    confere(w.regra === null && w.toquesRestantes() === Infinity, 'sem regra: limite infinito');
    const todas = w.alivePieces().filter((p) => getMaterial(p.material).destructible).length;
    confere(w.alivePieces().filter((p) => w.tocavel(p)).length === todas, 'sem regra: tocavel = destrutivel');
    w.destroy();
  }
  return falhas;
}
