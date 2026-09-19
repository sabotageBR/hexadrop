/**
 * Materiais das pecas.
 *
 * As densidades ficam dentro de uma razao de 10:1 entre a mais leve e a mais
 * pesada. Box2D empilha muito melhor quando as massas em contato sao parecidas,
 * e passar dessa razao produz torres que afundam e tremem.
 */

/**
 * Orcamento de tempo dos materiais que cedem por contato.
 *
 * O solucionador roda no maximo MAX_SETTLE passos por toque. Cada carga custa
 * holdTime * 60 passos que antes nao existiam, mais o reassentamento depois da
 * quebra. No pior caso o hexagono cai de um material temporal em outro dentro
 * do mesmo assentamento:
 *
 *     2 * holdTime * 60 + 120 < MAX_SETTLE
 *
 * Com os 420 passos originais isso dava holdTime < 2.5 s, que e o limite que os
 * valores abaixo respeitam. O orcamento subiu para 600 junto com o teto de
 * altura das torres, entao hoje sobra folga - mas os valores ficam onde estao:
 * 2,5 s ja e o limite do que o jogador aguenta esperar parado.
 *
 * Estourar esse teto faz o assentamento truncar no meio do movimento e o
 * validador julgar a fase com a cena ainda em queda. Nenhum holdTime aqui pode
 * passar de 2.5 segundos.
 */

/**
 * @typedef {object} Material
 * @property {string} id
 * @property {number} density
 * @property {number} friction
 * @property {number} restitution
 * @property {boolean} destructible se o toque do jogador remove a peca
 * @property {number} breakSpeed velocidade de impacto que quebra sozinho, m/s (0 = nunca)
 * @property {number} explodeRadius raio em celulas ao ser destruida (0 = nenhum)
 * @property {boolean} [anchored] corpo estatico, nao cai nunca
 * @property {number} [holdTime] segundos com o hexagono apoiado em cima antes de ceder
 * @property {string} [holdCause] causa reportada quando o holdTime estoura
 * @property {string} color cor base, usada em particulas e como reserva
 * @property {number} tapWeight peso na escolha do solucionador automatico
 * @property {string} nameKey chave de traducao
 * @property {string} hintKey chave de traducao da dica
 */

/** @type {Record<string, Material>} */
export const MATERIALS = {
  wood: {
    id: 'wood',
    density: 1.0,
    friction: 0.55,
    restitution: 0.05,
    destructible: true,
    breakSpeed: 0,
    explodeRadius: 0,
    color: '#d9a441',
    tapWeight: 1,
    nameKey: 'materialWood',
    hintKey: 'hintWood',
  },
  stone: {
    id: 'stone',
    density: 2.2,
    friction: 0.75,
    restitution: 0.03,
    destructible: true,
    breakSpeed: 0,
    explodeRadius: 0,
    color: '#8d9099',
    tapWeight: 1,
    nameKey: 'materialStone',
    hintKey: 'hintStone',
  },
  ice: {
    id: 'ice',
    density: 0.9,
    friction: 0.09,
    restitution: 0.06,
    destructible: true,
    breakSpeed: 0,
    explodeRadius: 0,
    color: '#7fe6ff',
    tapWeight: 1,
    nameKey: 'materialIce',
    hintKey: 'hintIce',
  },
  rubber: {
    id: 'rubber',
    density: 1.1,
    friction: 0.95,
    restitution: 0.42,
    destructible: true,
    breakSpeed: 0,
    explodeRadius: 0,
    color: '#5ee08a',
    tapWeight: 1,
    nameKey: 'materialRubber',
    hintKey: 'hintRubber',
  },
  metal: {
    id: 'metal',
    density: 3.2,
    friction: 0.42,
    restitution: 0.1,
    destructible: true,
    breakSpeed: 0,
    explodeRadius: 0,
    color: '#b9c4d6',
    tapWeight: 1,
    nameKey: 'materialMetal',
    hintKey: 'hintMetal',
  },
  glass: {
    id: 'glass',
    density: 1.3,
    friction: 0.35,
    restitution: 0.1,
    destructible: true,
    breakSpeed: 4.0,
    explodeRadius: 0,
    color: '#a8e8ff',
    tapWeight: 1,
    nameKey: 'materialGlass',
    hintKey: 'hintGlass',
  },
  foam: {
    id: 'foam',
    density: 0.35,
    friction: 0.55,
    restitution: 0.05,
    destructible: true,
    breakSpeed: 0,
    explodeRadius: 0,
    color: '#f2a8d0',
    tapWeight: 1,
    nameKey: 'materialFoam',
    hintKey: 'hintFoam',
  },
  bomb: {
    id: 'bomb',
    density: 1.0,
    friction: 0.5,
    restitution: 0.1,
    destructible: true,
    breakSpeed: 0,
    explodeRadius: 1.9,
    color: '#ff6b5a',
    tapWeight: 0.6,
    nameKey: 'materialBomb',
    hintKey: 'hintBomb',
  },
  // TNT nao precisa de campo novo: velocidade de quebra somada a raio de
  // explosao ja produz "detona com qualquer pancada forte". 3.2 m/s e uma queda
  // de meia celula, e fica acima do limiar de 2.2 do som de impacto - entao
  // toda detonacao vem precedida do baque, e o jogador entende o que houve.
  // Diferente da bomba, que explode quando o JOGADOR a toca.
  tnt: {
    id: 'tnt',
    density: 1.15,
    friction: 0.62,
    restitution: 0.02,
    destructible: true,
    breakSpeed: 3.2,
    explodeRadius: 2.2,
    color: '#ff9a3c',
    tapWeight: 0.4,
    nameKey: 'materialTnt',
    hintKey: 'hintTnt',
  },
  // Cristal cede pelo TEMPO com o hexagono em cima, nunca por impacto. Se
  // tambem quebrasse por pancada seria vidro com um extra, e a leitura do
  // jogador - azul quebra por pancada, roxo quebra por espera - se perderia.
  crystal: {
    id: 'crystal',
    density: 1.25,
    friction: 0.4,
    restitution: 0.08,
    destructible: true,
    breakSpeed: 0,
    explodeRadius: 0,
    holdTime: 1.8,
    holdCause: 'crack',
    color: '#c9a8ff',
    tapWeight: 1,
    nameKey: 'materialCrystal',
    hintKey: 'hintCrystal',
  },
  // Cera amolece sob o peso do hexagono. E o calor do mundo que justifica, mas
  // quem conta o tempo e o apoio: um derretimento disparado pela proximidade da
  // lava dissolveria a torre inteira sozinha e a fase se resolveria sem o
  // jogador.
  wax: {
    id: 'wax',
    density: 0.9,
    friction: 0.7,
    restitution: 0.02,
    destructible: true,
    breakSpeed: 0,
    explodeRadius: 0,
    holdTime: 2.4,
    holdCause: 'melt',
    color: '#ffb347',
    tapWeight: 1,
    nameKey: 'materialWax',
    hintKey: 'hintWax',
  },
  obsidian: {
    id: 'obsidian',
    density: 3.5,
    friction: 0.6,
    restitution: 0.05,
    destructible: false,
    anchored: true,
    breakSpeed: 0,
    explodeRadius: 0,
    color: '#4b4358',
    tapWeight: 0,
    nameKey: 'materialObsidian',
    hintKey: 'hintObsidian',
  },
};

export const MATERIAL_IDS = Object.keys(MATERIALS);

/**
 * Fase em que cada material aparece pela primeira vez, base para a tela
 * de "material novo" e para a curva de dificuldade.
 * @type {Record<string, number>}
 */
export const MATERIAL_DEBUT = {
  wood: 1,
  stone: 10,
  obsidian: 12,
  ice: 22,
  rubber: 32,
  metal: 42,
  glass: 52,
  foam: 62,
  bomb: 70,
  crystal: 56,
  wax: 74,
  tnt: 84,
};

/** Materiais que cedem por tempo de contato com o hexagono. */
export const HOLD_MATERIALS = new Set(
  Object.keys(MATERIALS).filter((id) => (MATERIALS[id].holdTime || 0) > 0),
);

/**
 * @param {string} id
 * @returns {Material}
 */
export function material(id) {
  return MATERIALS[id] || MATERIALS.wood;
}
