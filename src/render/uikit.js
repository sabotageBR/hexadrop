/**
 * Cromado da interface por mundo.
 *
 * As pecas sao as mesmas em todo o jogo. O que muda com a progressao e o
 * cenario e o kit da HUD / telas de fim: atelier, hex-deck, ficha ou queda.
 * A home e sempre o carrossel, com o kit do mundo que o jogador esta vendo.
 */

/** @type {Record<string, 'atelier'|'hexdeck'|'ficha'|'queda'|'neon'>} */
export const KIT_BY_THEME = {
  // O neon tem kit proprio, e nao o hexdeck, porque o cromado aceso e a cara
  // DESTE mundo - o futurista, que divide o hexdeck, e frio e chapado de
  // proposito. Mundos 1 e 9 usam o kit neon; 5 e 10 seguem no hexdeck.
  neon: 'neon',
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
 * @returns {'atelier'|'hexdeck'|'ficha'|'queda'|'neon'}
 */
export function kitForTheme(themeId) {
  return KIT_BY_THEME[themeId] || 'hexdeck';
}
