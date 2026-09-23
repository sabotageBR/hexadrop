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
 *
 * Fora da polaridade fica o cartao de feltro dos kits ficha e atelier, que e
 * escuro em todos os mundos: ele recebe --felt daqui e reabre as proprias
 * variaveis de tinta no CSS.
 */

import { kitForTheme } from './uikit.js';

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
 * Acende uma cor: mais clara e mais saturada, pelo HSL.
 *
 * Misturar com branco tambem clareia, mas lava a cor junto - e era assim que o
 * topo do botao primario saia rosado em vez de aceso. Subindo L e S o matiz
 * fica onde esta e o botao ganha brilho de verdade.
 * @param {string} hex
 * @param {number} dl quanto sobe de luminosidade, 0 a 1
 * @param {number} ds quanto sobe de saturacao, 0 a 1
 * @returns {string}
 */
function vivid(hex, dl, ds) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return hex;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let hue = 0;
  let sat = 0;
  if (d > 0) {
    sat = d / (1 - Math.abs(2 * l - 1));
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const L = Math.min(0.92, l + dl);
  const S = Math.min(1, sat + ds);
  return `hsl(${Math.round(hue)}, ${Math.round(S * 100)}%, ${Math.round(L * 100)}%)`;
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
 * Clareia um "r, g, b" e devolve uma cor CSS.
 *
 * O veu do tema e a versao mais escura do mundo, mas escura demais para virar
 * superficie: usado cru, o cartao do mundo lava sairia quase preto. Um ganho
 * mais um piso resolvem os dois extremos de uma vez.
 * @param {string} rgb "r, g, b"
 * @param {number} gain
 * @param {number} floor
 * @returns {string}
 */
function lift(rgb, gain, floor) {
  const parts = String(rgb).split(',').map((n) => parseInt(n.trim(), 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return '';
  const [r, g, b] = parts.map((n) => Math.max(0, Math.min(255, Math.round(n * gain + floor))));
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
  // O botao primario de cada kit e um degrade da cor do mundo, e nao uma cor
  // chapada: o topo claro e a base cheia sao o que fazem o botao parecer aceso.
  // `--on-accent` resolve o texto por luminancia - ouro claro pede tinta
  // escura, terracota pede branca, e nenhum kit precisa saber disso.
  set('--accent-lite', vivid(theme.accent, 0.18, 0.34));
  set('--accent-vivid', vivid(theme.accent, 0.04, 0.3));
  set('--gold-lite', vivid(theme.star, 0.16, 0.12));
  set('--gold-deep', shade(theme.star, 0.55));
  set('--on-accent', luminance(theme.accent) > 150 ? '#1c1408' : '#fff');

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
  // Dois kits (ficha e atelier) pintam o cartao escuro venha de que mundo vier.
  // O feltro sai do veu do tema e nao de uma cor cravada: antes o verde de
  // cassino aparecia inteiro por cima do ceu rosa do mundo doce.
  set('--felt', lift(theme.veilRgb, 1.35, 12));
  set('--felt-deep', lift(theme.veilRgb, 0.9, 3));

  root.setAttribute('data-ui', dark ? 'dark' : 'light');
  root.setAttribute('data-kit', kitForTheme(theme.id));
  root.style.colorScheme = dark ? 'dark' : 'light';
}
