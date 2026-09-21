/**
 * Cromado da interface por mundo.
 *
 * As pecas sao as mesmas em todo o jogo. O que muda com a progressao e o
 * cenario e o kit da HUD / telas de fim: atelier, hex-deck, ficha ou queda.
 * A home e sempre o carrossel, com o kit do mundo que o jogador esta vendo.
 */

/** @type {Record<string, 'atelier'|'hexdeck'|'ficha'|'queda'>} */
export const KIT_BY_THEME = {
  puzzle: 'ficha',
  neon: 'hexdeck',
  futuristic: 'hexdeck',
  rustic: 'atelier',
  paper: 'atelier',
  classic: 'ficha',
  candy: 'ficha',
  ice: 'queda',
  lava: 'queda',
};

/**
 * @param {string} themeId
 * @returns {'atelier'|'hexdeck'|'ficha'|'queda'}
 */
export function kitForTheme(themeId) {
  return KIT_BY_THEME[themeId] || 'hexdeck';
}
