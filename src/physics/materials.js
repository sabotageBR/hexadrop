/**
 * Materiais das pecas.
 *
 * As densidades ficam dentro de uma razao de 10:1 entre a mais leve e a mais
 * pesada. Box2D empilha muito melhor quando as massas em contato sao parecidas,
 * e passar dessa razao produz torres que afundam e tremem.
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
};

/**
 * @param {string} id
 * @returns {Material}
 */
export function material(id) {
  return MATERIALS[id] || MATERIALS.wood;
}
