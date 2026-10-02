/**
 * Confere o save: perfis de jogador antigos e novos passando pelo construtor de
 * `Progress`, e a forma da trilha de premios de mundo.
 *
 * Roda em Node puro, sem Chrome nem servidor: fora do navegador nao existe
 * `window`, entao `core/storage.js` cai para a memoria, e cada caso grava o
 * save de exemplo com o proprio `save()` antes de construir o `Progress`.
 *
 *   node tools/savecheck.mjs
 *
 * Por que existe: a 1.0.8 acrescenta campos ao save (`prizes`, `alem`) sem
 * trocar SAVE_VERSION - trocar apagaria o progresso de todo mundo -, e a
 * migracao entrega retroativamente os premios dos mundos ja concluidos. Erro
 * ali e silencioso no jogo e so aparece no save de quem ja jogava.
 */
import { save } from '../src/core/storage.js';
import { Progress } from '../src/game/progress.js';
import { SKINS, UPGRADES, WORLD_PRIZES, worldPrize, CHEST_FINAL, CHEST_COINS, skin as getSkin, xpForRank } from '../src/game/content.js';
import { LEVEL_COUNT, WORLD_COUNT, worldStart, worldSize } from '../src/game/levelgen.js';

let falhas = 0;
/** @param {boolean} ok @param {string} msg */
function confere(ok, msg) {
  if (ok) console.log('  ok   ' + msg);
  else {
    falhas++;
    console.log('  FALHA ' + msg);
  }
}

/** Estrelas em todas as fases ate `ate` (inclusive). @param {number} ate */
function estrelasAte(ate) {
  /** @type {Record<string, number>} */
  const st = {};
  for (let l = 1; l <= ate; l++) st[String(l)] = 3;
  return st;
}

/** Save da 1.0.7: versao 3, sem `prizes` nem `alem`. @param {*} extra */
function save107(extra) {
  return {
    v: 3,
    unlocked: 1,
    stars: {},
    coins: 0,
    xp: 0,
    skin: 'classic',
    skins: ['classic'],
    upgrades: {},
    boosts: { shuffle: 3 },
    mapaAte: 0,
    dailyAt: 0,
    plays: 0,
    ...extra,
  };
}

/** @param {*} dados @returns {Progress} */
function carrega(dados) {
  save('save', dados);
  return new Progress();
}

const ultimaDoMundo = (/** @type {number} */ w) => worldStart(w) + worldSize(w);

console.log('trilha');
{
  const ids = new Set(SKINS.map((s) => s.id));
  /** @type {Record<string, number>} */
  const porMelhoria = {};
  let alterna = true;
  const skins = [];
  WORLD_PRIZES.forEach((p, w) => {
    const deveSerSkin = w % 2 === 0;
    if (deveSerSkin !== 'skin' in p) alterna = false;
    if ('skin' in p) skins.push(p.skin);
    if ('upgrade' in p) porMelhoria[p.upgrade] = (porMelhoria[p.upgrade] || 0) + 1;
  });
  confere(WORLD_PRIZES.length === WORLD_COUNT - 1, `um premio por mundo ate o penultimo (${WORLD_PRIZES.length})`);
  confere(alterna, 'mundo impar da skin, par da melhoria');
  confere(skins.every((id) => ids.has(id)), 'toda skin da trilha existe em SKINS');
  confere(new Set(skins).size === skins.length, 'nenhuma skin repetida');
  confere(UPGRADES.every((u) => porMelhoria[u.id] === u.max), 'cada melhoria aparece exatamente max vezes');
  const porId = new Map(SKINS.map((k) => [k.id, k]));
  confere(skins.every((id) => !porId.get(id).retired && !porId.get(id).rewarded) && !skins.includes('classic'),
    'trilha sem skin aposentada, sem a de video e sem a Original');
  const fim = worldPrize(WORLD_COUNT - 1, WORLD_COUNT);
  const depois = worldPrize(WORLD_COUNT + 3, WORLD_COUNT);
  confere('coins' in fim && fim.coins === CHEST_FINAL, 'mundo 20 da o bau final');
  confere('coins' in depois && depois.coins === CHEST_COINS, 'mundo depois do 20 da o bau');
}

console.log('perfil novo');
{
  save('save', null);
  const p = new Progress();
  confere(Array.isArray(p.data.prizes) && p.data.prizes.length === 0, 'prizes vazio');
  confere(p.data.alem === 0, 'alem 0');
  confere(p.retroativos.length === 0, 'nada retroativo');
  confere(p.isNewcomer(), 'continua sendo quem entra jogando');
  // Vence o mundo 1 inteiro: o premio sai na fase 5, equipado.
  let r = null;
  for (let l = 1; l <= ultimaDoMundo(0); l++) r = p.finishLevel({ level: l, stars: 3, won: true, taps: 9, par: 8 });
  const p0 = /** @type {*} */ (WORLD_PRIZES[0]);
  confere(!!r && !!r.prize && r.prize.kind === 'skin' && r.prize.id === p0.skin, 'fase 5 entrega a skin do mundo 1');
  confere(p.data.skin === p0.skin, 'e ja equipa');
  confere(p.prizeClaimed(0), 'mundo 1 marcado');
  const again = p.finishLevel({ level: ultimaDoMundo(0), stars: 3, won: true, taps: 9, par: 8 });
  confere(again.prize === null, 'rejogar a fase 5 nao repete o premio');
  const meio = p.finishLevel({ level: 7, stars: 3, won: true, taps: 9, par: 8 });
  confere(meio.prize === null, 'fase do meio do mundo nao da premio');
  const derrota = p.finishLevel({ level: ultimaDoMundo(1), stars: 0, won: false, taps: 9, par: 8 });
  confere(derrota.prize === null && !p.prizeClaimed(1), 'perder a ultima fase nao da premio');
  const vence10 = p.finishLevel({ level: ultimaDoMundo(1), stars: 3, won: true, taps: 9, par: 8 });
  const p1 = /** @type {*} */ (WORLD_PRIZES[1]);
  confere(!!vence10.prize && vence10.prize.kind === 'upgrade' && p.upgradeLevel(p1.upgrade) === 1, 'fase 10 da um nivel de melhoria');
}

console.log('mundo 2 com a skin do mundo 1 ja comprada');
{
  const id = /** @type {*} */ (WORLD_PRIZES[0]).skin;
  const p = carrega(save107({ unlocked: 11, stars: estrelasAte(10), skins: ['classic', id], skin: id, coins: 40, xp: 500 }));
  confere(p.prizeClaimed(0) && p.prizeClaimed(1), 'mundos 1 e 2 entregues na migracao');
  confere(p.data.coins === 40 + getSkin(id).cost, `skin ja comprada vira as moedas do preco (+${getSkin(id).cost})`);
  confere(p.data.skin === id, 'a migracao nao troca a skin equipada');
  confere(p.data.shopNews === true && p.retroativos.length === 2, 'avisa a loja e a home');
  const p2 = new Progress();
  confere(p2.retroativos.length === 0 && p2.data.coins === p.data.coins, 'a migracao roda uma vez so');
}

console.log('mundo 12 com uma skin aposentada equipada e estabilidade 3');
{
  const adiantada = /** @type {*} */ (WORLD_PRIZES[4]).skin;
  const p = carrega(
    save107({
      unlocked: 61,
      stars: estrelasAte(60),
      skins: ['classic', 'gold', adiantada],
      skin: 'gold',
      upgrades: { stability: 3 },
      coins: 0,
      xp: xpForRank(12),
    }),
  );
  confere(p.data.prizes.length === 12, `doze mundos entregues (${p.data.prizes.length})`);
  confere(p.upgradeLevel('stability') === 3, 'estabilidade continua no maximo');
  confere(p.upgradeLevel('grip') >= 2, 'premio de estabilidade no maximo vira aderencia');
  confere(p.data.skin === 'gold', 'a skin aposentada equipada continua equipada');
  confere(p.data.skins.filter((x) => x === adiantada).length === 1, 'nenhuma skin duplicada');
  confere(p.data.coins >= getSkin(adiantada).cost, 'a skin da trilha comprada antes vira moeda');
  const cat = p.skinCatalog().map((/** @type {*} */ e) => e.skin.id);
  confere(cat.includes('gold') && !cat.includes('aurora'), 'aposentada aparece na loja so para quem a tem');
}

console.log('quem ja venceu a 100');
{
  const p = carrega(save107({ unlocked: LEVEL_COUNT, stars: estrelasAte(LEVEL_COUNT), xp: xpForRank(30) }));
  confere(p.data.alem === LEVEL_COUNT + 1, 'comeca na 101');
  confere(p.prizeClaimed(WORLD_COUNT - 1), 'bau final entregue na migracao');
  const estrelas = p.totalStars;
  const r = p.finishLevel({ level: LEVEL_COUNT + 1, stars: 3, won: true, taps: 9, par: 8 });
  confere(p.totalStars === estrelas, 'fase 101 nao grava estrela');
  confere(p.data.unlocked === LEVEL_COUNT, 'unlocked continua em 100');
  confere(p.data.alem === LEVEL_COUNT + 2, 'alem anda para 102');
  confere(r.prize === null, 'meio do mundo 21 sem premio');
  const moedas = p.data.coins;
  const fim = p.finishLevel({ level: LEVEL_COUNT + 5, stars: 3, won: true, taps: 9, par: 8 });
  confere(!!fim.prize && fim.prize.kind === 'coins' && fim.prize.coins === CHEST_COINS, 'fim do mundo 21 da o bau');
  confere(p.data.coins >= moedas + CHEST_COINS, 'o bau entra na bolsa');
  confere(p.isUnlocked(LEVEL_COUNT + 6) && !p.isUnlocked(LEVEL_COUNT + 7), 'isUnlocked depois da 100 segue o alem');
}

console.log('save de outra versao');
{
  const p = carrega({ ...save107({ unlocked: 40, coins: 999 }), v: 2 });
  confere(p.data.unlocked === 1 && p.data.coins === 0, 'continua descartado');
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
