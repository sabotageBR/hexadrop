/**
 * Leva a paleta do tema da fase para a interface em HTML.
 *
 * Os temas sempre carregaram uma paleta de UI completa - ink, accent, panel,
 * star, fonte - mas o CSS vivia com as cores do neon cravadas, entao um card
 * roxo aparecia por cima de um mundo de nuvens pastel. Aqui essa paleta vira
 * variaveis CSS, e a interface passa a pertencer ao mundo em que se joga.
 *
 * Tres dos oito temas (classico, doce e papel) pedem interface clara: o texto
 * deles e escuro. Por isso a polaridade vai junto, em data-ui, para as regras
 * que nao dao para resolver so trocando cor.
 */

/**
 * Luminancia aproximada de uma cor #rgb ou #rrggbb.
 * @param {string} hex
 * @returns {number} 0 a 255
 */
function luminance(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (!Number.isFinite(r + g + b)) return 255;
  return r * 0.299 + g * 0.587 + b * 0.114;
}

/**
 * Escurece uma cor mantendo o matiz.
 * @param {string} hex
 * @param {number} factor 0 a 1
 * @returns {string}
 */
function shade(hex, factor) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return hex;
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `rgb(${r},${g},${b})`;
}

/**
 * Converte #rrggbb em "r, g, b".
 * @param {string} hex
 * @returns {string}
 */
function rgbOf(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return '255, 255, 255';
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/**
 * @param {import('./themes.js').Theme} theme
 */
export function applyUiTheme(theme) {
  if (!theme || typeof document === 'undefined') return;
  const root = document.documentElement;
  // Texto claro significa interface escura. E o unico sinal confiavel: a cor
  // do painel varia demais entre os temas para servir de referencia.
  const dark = luminance(theme.ink) > 128;

  const set = (/** @type {string} */ name, /** @type {string} */ value) => {
    if (value) root.style.setProperty(name, value);
  };

  set('--accent-deep', shade(theme.accent, 0.62));

  set('--ink', theme.ink);
  set('--ink-soft', theme.inkSoft);
  set('--accent', theme.accent);
  set('--accent2', theme.accent2);
  set('--panel', theme.panel);
  set('--panel-solid', theme.panelSolid);
  set('--edge', theme.panelEdge);
  set('--gold', theme.star);
  set('--starOff', theme.starOff);
  set('--font', theme.font);
  set('--veil-rgb', theme.veilRgb);
  // Duas superficies com necessidades opostas. O veu atras de um CARTAO pode ser
  // escuro nos dois casos, porque quem carrega o texto e o cartao. Ja o fundo do
  // mapa e da loja recebe o texto direto, entao tem que seguir a polaridade:
  // num tema claro, texto escuro sobre veu escuro fica ilegivel.
  set('--sheet-rgb', dark ? theme.veilRgb : rgbOf(theme.panelSolid));
  // Realce de toque nos botoes: um claro sobre fundo escuro, um escuro sobre
  // fundo claro. Sem isso o botao some no card branco dos temas claros.
  set('--wash', dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)');

  root.setAttribute('data-ui', dark ? 'dark' : 'light');
  root.style.colorScheme = dark ? 'dark' : 'light';
}
