/**
 * Temas visuais.
 *
 * Cada tema define paleta de fundo, estilo de traço das pecas e uma cor por
 * material. O material sempre tem cor propria e reconhecivel dentro do tema:
 * a cor informa fisica, nao decoracao.
 */

/**
 * @typedef {object} PieceStyle
 * @property {string} fill
 * @property {string} stroke
 * @property {string} [inner] traço interno, para o efeito de tubo neon
 * @property {string} [top] realce na aresta superior
 */

/**
 * @typedef {object} Theme
 * @property {string} id
 * @property {string} label
 * @property {'puzzle'|'neon'|'plate'|'grain'|'flat'|'gloss'|'frost'|'ember'|'paper'} style
 * @property {number} glow 0 a 1
 * @property {number} corner raio dos cantos, em fracao da celula
 * @property {number} [traco] espessura do contorno das pecas, fracao do padrao (1)
 * @property {'glow'|'toon'|'toon-cel'|'toon-hq'|'gelatina'} [pecas] estilo de pintura
 *   unico para todas as pecas do tema, por cima da escolha por material de
 *   `lookFor()` (render/sprites.js). Ausente, vale a escolha por material.
 * @property {string[]} sky gradiente vertical do fundo
 * @property {string} horizon
 * @property {string} ground
 * @property {string} grid
 * @property {string} ink cor do texto
 * @property {string} inkSoft
 * @property {string} accent
 * @property {string} accent2
 * @property {string} panel
 * @property {string} panelEdge
 * @property {string} panelSolid versao opaca do painel, para cartoes
 * @property {string} veilRgb "r, g, b" do veu que escurece a cena atras das telas
 * @property {Record<string, PieceStyle>} materials
 * @property {{fill:string, stroke:string, glow:string, style:string}} pedestal
 * @property {{fill:string, stroke:string, core:string}} hexagon cores da skin
 *   Original, a unica que nao traz as suas. `fill` e o corpo da joia
 *   (`render/hexmodels.js`) e tem que ser OPACO e saturado: translucido, o
 *   hexagono some no ceu; claro demais, vira um adesivo palido. Por isso, em
 *   sete dos nove temas ele repete o `stroke`. O `stroke` tambem pinta o `--w-hex`
 *   da interface.
 * @property {string} star
 * @property {string} starOff
 * @property {string} guide cor das linhas tracejadas
 * @property {string} font
 */

const UI_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const TECH_FONT =
  '"SF Mono", "Segoe UI Mono", "Roboto Mono", Menlo, Consolas, ui-monospace, monospace';
const SERIF_FONT = 'Georgia, "Times New Roman", "Noto Serif", serif';
const ROUND_FONT =
  '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, Avenir, sans-serif';

/** @type {Record<string, Theme>} */
export const THEMES = {
  // ---------------------------------------------------------------- puzzle
  // O mundo das fases iniciais. Pecas de plastico brilhante como na marca,
  // ceu azul-marinho e o hexagono amarelo caindo. A cor continua informando
  // a fisica: o bloco magenta e o neutro, cada material especial ganha o
  // seu lugar no arco-iris da logo.
  puzzle: {
    id: 'puzzle',
    label: 'Puzzle',
    style: 'puzzle',
    // Gelatina, e nao mais o tubo de neon: o tubo tinha sido copiado do jogo
    // de referencia medindo a foto pixel a pixel, e o mundo 1 - a primeira
    // impressao do jogo e a arte da thumbnail - era o que mais lembrava ele. A
    // Poki recusa jogo que "overlaps too much with what's already on Poki". A
    // gelatina e das pecas do proprio jogo, casa com a borracha que e a base
    // deste mundo (quica e agarra) e mantem o arco-iris da marca. O Evandro
    // escolheu entre cinco estilos desenhados na fase 5. O tubo continua no
    // mundo neon.
    pecas: 'gelatina',
    // 0,4 e o ponto exato em que nada muda alem das pecas: acima de 0,45 cada
    // peca que nao e tubo ganha um halo borrado (paintPiece), e abaixo de 0,4
    // o hexagono cai no ramo de tema claro e ganha sombra.
    glow: 0.4,
    corner: 0.28,
    sky: ['#07102c', '#0a1a48', '#12305c'],
    horizon: '#4fc8ff',
    ground: '#07102c',
    grid: 'rgba(80, 180, 255, 0.12)',
    ink: '#f4f7ff',
    inkSoft: 'rgba(244, 247, 255, 0.62)',
    accent: '#ff4eb6',
    accent2: '#3dd0ff',
    panel: 'rgba(10, 22, 56, 0.9)',
    panelEdge: 'rgba(255, 78, 182, 0.55)',
    panelSolid: '#0c1a3c',
    veilRgb: '6, 12, 32',
    materials: {
      block: { fill: '#ff4eb6', stroke: '#ff9ad8', top: 'rgba(255,255,255,0.85)' },
      wood: { fill: '#ffb020', stroke: '#ffe07a', top: 'rgba(255,255,255,0.75)' },
      stone: { fill: '#2f86ff', stroke: '#9cc8ff', top: 'rgba(255,255,255,0.75)' },
      ice: { fill: '#12dcff', stroke: '#c4f6ff', top: 'rgba(255,255,255,0.95)' },
      rubber: { fill: '#7cff2e', stroke: '#d4ff8a', top: 'rgba(255,255,255,0.75)' },
      metal: { fill: '#8ec8ff', stroke: '#e8f4ff', top: 'rgba(255,255,255,0.9)' },
      glass: { fill: 'rgba(190, 255, 230, 0.78)', stroke: '#e8fff6', top: 'rgba(255,255,255,0.95)' },
      foam: { fill: '#ff6a58', stroke: '#ffc2b4', top: 'rgba(255,255,255,0.8)' },
      bomb: { fill: '#2a2434', stroke: '#ff7a32', top: 'rgba(255,200,140,0.55)' },
      obsidian: { fill: '#3a2468', stroke: '#b89cff', top: 'rgba(200,180,255,0.4)' },
      tnt: { fill: '#ff8a12', stroke: '#5a2208', top: 'rgba(255,230,120,0.7)' },
      crystal: { fill: '#c44dff', stroke: '#efc2ff', top: 'rgba(255,255,255,0.9)' },
      wax: { fill: '#ffd000', stroke: '#fff08a', top: 'rgba(255,255,255,0.85)' },
    },
    pedestal: { style: 'bloco', fill: '#6b5cff', stroke: '#c4b8ff', glow: '#ff4eb6' },
    hexagon: { fill: '#ffcc22', stroke: '#e09a00', core: '#fff6c8' },
    star: '#ffd23c',
    starOff: 'rgba(120, 150, 190, 0.5)',
    guide: 'rgba(180, 220, 255, 0.5)',
    font: ROUND_FONT,
  },

  // ------------------------------------------------------------------ neon
  neon: {
    id: 'neon',
    label: 'Neon',
    style: 'neon',
    glow: 1,
    corner: 0.22,
    sky: ['#05030f', '#140a2e', '#2b0f47'],
    horizon: '#ff2d95',
    ground: '#0a0520',
    grid: 'rgba(120,80,255,0.2)',
    ink: '#f4ecff',
    inkSoft: 'rgba(244,236,255,0.62)',
    accent: '#ff43b8',
    accent2: '#33e1ff',
    panel: 'rgba(30,10,60,0.82)',
    panelEdge: 'rgba(255,67,184,0.75)',
    panelSolid: '#1a0a38',
    veilRgb: '6, 3, 15',
    // Corpo opaco, na cor do material. Com o preenchimento translucido de
    // antes o sol e a grade do cenario apareciam ATRAVES da peca: o jogador
    // via listras onde devia ver madeira, e duas pecas vizinhas viravam a
    // mesma mancha. A cor fecha a silhueta; o traco neon continua sendo quem
    // identifica o material de longe.
    materials: {
      wood: { fill: '#e09422', stroke: '#ffc43c', inner: 'rgba(255,196,60,0.55)', top: '#ffc43c' },
      block: { fill: '#e04090', stroke: '#ff4eb6', inner: 'rgba(255,78,182,0.55)', top: '#ff7ad4' },
      stone: { fill: '#e02458', stroke: '#ff3d6e', inner: 'rgba(255,61,110,0.55)', top: '#ff3d6e' },
      ice: { fill: '#1ab8d8', stroke: '#50e2ff', inner: 'rgba(80,226,255,0.6)', top: '#8af0ff' },
      rubber: { fill: '#14c868', stroke: '#42ff8c', inner: 'rgba(66,255,140,0.55)', top: '#42ff8c' },
      metal: { fill: '#5a6ab0', stroke: '#b2c6ff', inner: 'rgba(178,198,255,0.55)', top: '#d8e2ff' },
      glass: { fill: '#7ed4ea', stroke: '#d2f5ff', inner: 'rgba(210,245,255,0.5)', top: '#ffffff' },
      foam: { fill: '#e04098', stroke: '#ff8cdc', inner: 'rgba(255,140,220,0.55)', top: '#ff8cdc' },
      bomb: { fill: '#2a1820', stroke: '#ff5a3c', inner: 'rgba(255,200,60,0.75)', top: '#ffc83c' },
      obsidian: { fill: '#2a2048', stroke: '#8a74c8', inner: 'rgba(60,44,100,0.9)', top: '#8a74c8' },
      tnt: { fill: '#ff8c28', stroke: '#ffe65a', inner: 'rgba(255,230,90,0.8)', top: '#ffe65a' },
      crystal: { fill: '#8a50d0', stroke: '#c896ff', inner: 'rgba(200,150,255,0.55)', top: '#e0c6ff' },
      wax: { fill: '#e89830', stroke: '#ffbe5a', inner: 'rgba(255,230,160,0.55)', top: '#ffe6a0' },
    },
    pedestal: { style: 'neon', fill: 'rgba(92,46,190,0.85)', stroke: '#b98cff', glow: '#a066ff' },
    hexagon: { fill: '#4fc8ff', stroke: '#4fc8ff', core: '#ffffff' },
    star: '#ffd23c',
    starOff: 'rgba(120,90,60,0.55)',
    guide: 'rgba(200,180,255,0.5)',
    font: TECH_FONT,
  },

  // ------------------------------------------------------------ futurista
  futuristic: {
    id: 'futuristic',
    label: 'Futurista',
    style: 'plate',
    glow: 0.45,
    corner: 0.1,
    sky: ['#04080f', '#0a1622', '#13293d'],
    horizon: '#2ee6c4',
    ground: '#060c14',
    grid: 'rgba(46,230,196,0.16)',
    ink: '#e6f6ff',
    inkSoft: 'rgba(230,246,255,0.58)',
    accent: '#2ee6c4',
    accent2: '#5b8cff',
    panel: 'rgba(10,26,38,0.88)',
    panelEdge: 'rgba(46,230,196,0.5)',
    panelSolid: '#0a1a26',
    veilRgb: '4, 14, 22',
    materials: {
      wood: { fill: '#6a8aa0', stroke: '#b4d4e8', top: 'rgba(255,255,255,0.2)' },
      block: { fill: '#e050a8', stroke: '#ff8ad4', top: 'rgba(255,200,230,0.3)' },
      stone: { fill: '#8a78b0', stroke: '#d0c0ee', top: 'rgba(255,255,255,0.2)' },
      ice: { fill: '#3ec8e0', stroke: '#9cf0ff', top: 'rgba(200,250,255,0.3)' },
      rubber: { fill: '#2edc90', stroke: '#8affc8', top: 'rgba(200,255,230,0.25)' },
      metal: { fill: '#8aa0b4', stroke: '#e0eef8', top: 'rgba(255,255,255,0.35)' },
      glass: { fill: '#7ad4ea', stroke: '#d0f4ff', top: 'rgba(255,255,255,0.4)' },
      foam: { fill: '#d070c0', stroke: '#f0b0e8', top: 'rgba(255,230,255,0.25)' },
      bomb: { fill: '#2a1820', stroke: '#ff7a55', top: 'rgba(255,190,140,0.3)' },
      obsidian: { fill: '#243040', stroke: '#6a88a8', top: 'rgba(120,150,180,0.25)' },
      tnt: { fill: '#ff8a28', stroke: '#ffc878', top: 'rgba(255,215,150,0.35)' },
      crystal: { fill: '#a078e0', stroke: '#d8c4ff', top: 'rgba(240,230,255,0.4)' },
      wax: { fill: '#e0b050', stroke: '#ffe090', top: 'rgba(255,240,200,0.3)' },
    },
    pedestal: { style: 'hangar', fill: '#152a38', stroke: '#2ee6c4', glow: '#2ee6c4' },
    hexagon: { fill: '#5ff0d8', stroke: '#5ff0d8', core: '#d8fff6' },
    star: '#ffd75e',
    starOff: 'rgba(90,110,120,0.5)',
    guide: 'rgba(46,230,196,0.45)',
    font: TECH_FONT,
  },

  // --------------------------------------------------------------- rustico
  rustic: {
    id: 'rustic',
    label: 'Rustico',
    style: 'grain',
    glow: 0,
    corner: 0.12,
    sky: ['#3b2a1d', '#6b4a2f', '#a9764a'],
    horizon: '#e8b26a',
    ground: '#2a1c12',
    grid: 'rgba(90,60,35,0.3)',
    ink: '#fdf0dd',
    inkSoft: 'rgba(253,240,221,0.65)',
    accent: '#e0913a',
    accent2: '#8fae5a',
    panel: 'rgba(58,38,24,0.92)',
    panelEdge: 'rgba(224,145,58,0.7)',
    panelSolid: '#3a2618',
    veilRgb: '22, 14, 8',
    materials: {
      wood: { fill: '#e09040', stroke: '#8a5020', top: 'rgba(255,220,170,0.3)' },
      block: { fill: '#e06098', stroke: '#a03868', top: 'rgba(255,220,235,0.3)' },
      stone: { fill: '#a8a090', stroke: '#686058', top: 'rgba(255,255,245,0.25)' },
      ice: { fill: '#7ec8d8', stroke: '#3e8090', top: 'rgba(235,255,255,0.4)' },
      rubber: { fill: '#7cb050', stroke: '#487028', top: 'rgba(230,255,190,0.25)' },
      metal: { fill: '#90a0b0', stroke: '#506070', top: 'rgba(255,255,255,0.35)' },
      glass: { fill: '#b0d8d4', stroke: '#68a098', top: 'rgba(255,255,255,0.45)' },
      foam: { fill: '#e090a4', stroke: '#a05868', top: 'rgba(255,225,235,0.28)' },
      bomb: { fill: '#2a1820', stroke: '#e07040', top: 'rgba(255,170,120,0.3)' },
      obsidian: { fill: '#3a3138', stroke: '#17131a', top: 'rgba(130,120,140,0.25)' },
      tnt: { fill: '#ff8a28', stroke: '#6a3010', top: 'rgba(255,200,140,0.3)' },
      crystal: { fill: '#b8a0d8', stroke: '#7868a0', top: 'rgba(255,250,255,0.4)' },
      wax: { fill: '#f0c868', stroke: '#a88838', top: 'rgba(255,245,210,0.35)' },
    },
    pedestal: { style: 'tronco', fill: '#6b4a2f', stroke: '#3a2717', glow: '#e8b26a' },
    hexagon: { fill: '#e8cf9c', stroke: '#5d4117', core: '#fffaec' },
    star: '#ffc74d',
    starOff: 'rgba(110,85,55,0.6)',
    guide: 'rgba(255,230,190,0.5)',
    font: SERIF_FONT,
  },

  // --------------------------------------------------------------- classico
  classic: {
    id: 'classic',
    label: 'Classico',
    style: 'flat',
    glow: 0,
    corner: 0.16,
    sky: ['#eef2f7', '#dde5ef', '#c6d3e2'],
    horizon: '#ffffff',
    ground: '#b9c6d6',
    grid: 'rgba(80,110,150,0.12)',
    ink: '#1d2733',
    inkSoft: 'rgba(29,39,51,0.55)',
    accent: '#2f6df0',
    accent2: '#f0713a',
    panel: 'rgba(255,255,255,0.94)',
    panelEdge: 'rgba(47,109,240,0.45)',
    panelSolid: '#ffffff',
    veilRgb: '20, 32, 48',
    materials: {
      wood: { fill: '#f0b64e', stroke: '#b57f24', top: 'rgba(255,255,255,0.4)' },
      block: { fill: '#ff5eb0', stroke: '#c2307a', top: 'rgba(255,255,255,0.5)' },
      stone: { fill: '#9aa6b4', stroke: '#65727f', top: 'rgba(255,255,255,0.4)' },
      ice: { fill: '#79cfe8', stroke: '#3d92ad', top: 'rgba(255,255,255,0.55)' },
      rubber: { fill: '#63cf86', stroke: '#2f8b50', top: 'rgba(255,255,255,0.4)' },
      metal: { fill: '#8f9bad', stroke: '#4d5766', top: 'rgba(255,255,255,0.5)' },
      glass: { fill: 'rgba(180,225,240,0.6)', stroke: '#6fa8bd', top: 'rgba(255,255,255,0.7)' },
      foam: { fill: '#ef9fc4', stroke: '#b1628a', top: 'rgba(255,255,255,0.45)' },
      bomb: { fill: '#ef6a52', stroke: '#a83a26', top: 'rgba(255,220,200,0.45)' },
      obsidian: { fill: '#4a4f5c', stroke: '#23272f', top: 'rgba(160,170,190,0.28)' },
      tnt: { fill: '#f07a3a', stroke: '#a84a16', top: 'rgba(255,235,210,0.45)' },
      crystal: { fill: '#c3a6ec', stroke: '#7a5aae', top: 'rgba(255,255,255,0.55)' },
      wax: { fill: '#f5cf7a', stroke: '#b08c34', top: 'rgba(255,255,255,0.45)' },
    },
    pedestal: { style: 'degraus', fill: '#7b8aa0', stroke: '#48556a', glow: '#2f6df0' },
    hexagon: { fill: '#1f4fd0', stroke: '#1f4fd0', core: '#ffffff' },
    star: '#f5b921',
    starOff: 'rgba(150,160,175,0.5)',
    guide: 'rgba(60,80,110,0.4)',
    font: UI_FONT,
  },

  // ------------------------------------------------------------------ doce
  candy: {
    id: 'candy',
    label: 'Doce',
    style: 'gloss',
    glow: 0.25,
    corner: 0.3,
    sky: ['#ffd9ec', '#ffc2e0', '#b8a4f0'],
    horizon: '#fff3b0',
    ground: '#a48be8',
    grid: 'rgba(255,255,255,0.25)',
    ink: '#4a2350',
    inkSoft: 'rgba(74,35,80,0.6)',
    accent: '#ff5fa2',
    accent2: '#7be0d0',
    panel: 'rgba(255,255,255,0.92)',
    panelEdge: 'rgba(255,95,162,0.6)',
    panelSolid: '#fff5fb',
    veilRgb: '60, 20, 60',
    materials: {
      wood: { fill: '#ffb85c', stroke: '#e0813a', top: 'rgba(255,255,255,0.65)' },
      block: { fill: '#ff5eb8', stroke: '#e04090', top: 'rgba(255,255,255,0.75)' },
      stone: { fill: '#c9a9e8', stroke: '#8d6bb5', top: 'rgba(255,255,255,0.6)' },
      ice: { fill: '#9fe8ff', stroke: '#52a9cf', top: 'rgba(255,255,255,0.8)' },
      rubber: { fill: '#7bf0a8', stroke: '#35b070', top: 'rgba(255,255,255,0.6)' },
      metal: { fill: '#c2cde0', stroke: '#7b8aa3', top: 'rgba(255,255,255,0.75)' },
      glass: { fill: 'rgba(210,245,255,0.7)', stroke: '#87c4dc', top: 'rgba(255,255,255,0.85)' },
      foam: { fill: '#ffa8d4', stroke: '#d4668f', top: 'rgba(255,255,255,0.7)' },
      bomb: { fill: '#ff7a6b', stroke: '#c23f38', top: 'rgba(255,230,225,0.6)' },
      obsidian: { fill: '#6b5a86', stroke: '#3c3050', top: 'rgba(200,190,225,0.4)' },
      tnt: { fill: '#ff9245', stroke: '#c85a14', top: 'rgba(255,245,225,0.7)' },
      crystal: { fill: '#d6b4ff', stroke: '#8f5fd0', top: 'rgba(255,255,255,0.8)' },
      wax: { fill: '#ffd98a', stroke: '#d0a03c', top: 'rgba(255,255,255,0.75)' },
    },
    pedestal: { style: 'bolo', fill: '#b28ce8', stroke: '#6f4dad', glow: '#ff9ed4' },
    hexagon: { fill: '#e6247e', stroke: '#e6247e', core: '#fffdfe' },
    star: '#ffd53d',
    starOff: 'rgba(180,150,190,0.55)',
    guide: 'rgba(120,70,140,0.42)',
    font: ROUND_FONT,
  },

  // ------------------------------------------------------------------ gelo
  ice: {
    id: 'ice',
    label: 'Gelo',
    style: 'frost',
    glow: 0.35,
    corner: 0.14,
    sky: ['#0d2233', '#1d4560', '#6ba5c4'],
    horizon: '#dff4ff',
    ground: '#0a1b28',
    grid: 'rgba(190,235,255,0.18)',
    ink: '#eaf8ff',
    inkSoft: 'rgba(234,248,255,0.6)',
    accent: '#7fe3ff',
    accent2: '#c9f0ff',
    panel: 'rgba(16,44,64,0.88)',
    panelEdge: 'rgba(127,227,255,0.6)',
    panelSolid: '#102c40',
    veilRgb: '6, 20, 32',
    materials: {
      wood: { fill: '#c89860', stroke: '#e8c090', top: 'rgba(255,240,215,0.35)' },
      block: { fill: '#e060a8', stroke: '#ffa0d0', top: 'rgba(255,220,240,0.35)' },
      stone: { fill: '#7a90a4', stroke: '#b8d0e0', top: 'rgba(230,245,255,0.35)' },
      ice: { fill: '#7ae0ff', stroke: '#d8f6ff', top: 'rgba(255,255,255,0.75)' },
      rubber: { fill: '#40c898', stroke: '#90ffe0', top: 'rgba(210,255,240,0.3)' },
      metal: { fill: '#90b0c8', stroke: '#d8ecf8', top: 'rgba(240,250,255,0.45)' },
      glass: { fill: '#b8f0ff', stroke: '#e8fbff', top: 'rgba(255,255,255,0.7)' },
      foam: { fill: '#e0a0c8', stroke: '#ffd0ea', top: 'rgba(255,235,250,0.35)' },
      bomb: { fill: '#2a1820', stroke: '#ff7a50', top: 'rgba(255,190,165,0.35)' },
      obsidian: { fill: '#2b3947', stroke: '#7aa0b8', top: 'rgba(150,185,210,0.3)' },
      tnt: { fill: '#ff8a28', stroke: '#ffc878', top: 'rgba(255,215,170,0.35)' },
      crystal: { fill: '#b8a0e8', stroke: '#e8dcff', top: 'rgba(255,255,255,0.65)' },
      wax: { fill: '#e0b860', stroke: '#ffe8a8', top: 'rgba(255,245,215,0.35)' },
    },
    pedestal: { style: 'gelo', fill: '#2c5a75', stroke: '#9fe0f5', glow: '#9fe0f5' },
    hexagon: { fill: '#59c4e8', stroke: '#59c4e8', core: '#ffffff' },
    star: '#ffe27a',
    starOff: 'rgba(120,150,170,0.5)',
    guide: 'rgba(200,240,255,0.5)',
    font: UI_FONT,
  },

  // ------------------------------------------------------------------ lava
  lava: {
    id: 'lava',
    label: 'Lava',
    style: 'ember',
    glow: 0.42,
    corner: 0.1,
    sky: ['#0a0403', '#25090a', '#5a1408'],
    horizon: '#ff6a12',
    ground: '#120503',
    grid: 'rgba(255,110,40,0.16)',
    ink: '#ffeade',
    inkSoft: 'rgba(255,234,222,0.6)',
    accent: '#ff7a1a',
    accent2: '#ffd04a',
    panel: 'rgba(40,12,8,0.9)',
    panelEdge: 'rgba(255,122,26,0.6)',
    panelSolid: '#280c08',
    veilRgb: '18, 5, 3',
    materials: {
      wood: { fill: '#e07828', stroke: '#ffae4d', top: 'rgba(255,215,160,0.4)' },
      block: { fill: '#e04090', stroke: '#ff6eb4', top: 'rgba(255,180,220,0.4)' },
      stone: { fill: '#8a8078', stroke: '#d8ccc0', top: 'rgba(255,240,225,0.3)' },
      ice: { fill: '#3aa8c8', stroke: '#7fe9ff', top: 'rgba(220,250,255,0.4)' },
      rubber: { fill: '#2cb868', stroke: '#57f59a', top: 'rgba(200,255,215,0.3)' },
      metal: { fill: '#8898a8', stroke: '#e4eef8', top: 'rgba(255,255,255,0.4)' },
      glass: { fill: '#80c8e0', stroke: '#d8f3ff', top: 'rgba(255,255,255,0.5)' },
      foam: { fill: '#e05088', stroke: '#ff9ac6', top: 'rgba(255,215,235,0.35)' },
      bomb: { fill: '#2a1010', stroke: '#ff5a1a', top: 'rgba(255,215,140,0.5)' },
      obsidian: { fill: '#1a1010', stroke: '#ff6a28', top: 'rgba(255,120,50,0.35)' },
      tnt: { fill: '#ff8a1a', stroke: '#ffd05a', top: 'rgba(255,230,160,0.5)' },
      crystal: { fill: '#a070d0', stroke: '#d0b4ff', top: 'rgba(245,235,255,0.45)' },
      wax: { fill: '#ff9a30', stroke: '#ffd27a', top: 'rgba(255,240,190,0.45)' },
    },
    pedestal: { style: 'obsidiana', fill: '#3b1b12', stroke: '#ff8a2a', glow: '#ff6a12' },
    hexagon: { fill: '#ffb347', stroke: '#ffb347', core: '#fff4dc' },
    star: '#ffd04a',
    starOff: 'rgba(120,70,40,0.6)',
    guide: 'rgba(255,190,140,0.5)',
    font: TECH_FONT,
  },

  // ----------------------------------------------------------------- papel
  paper: {
    id: 'paper',
    label: 'Papel',
    style: 'paper',
    glow: 0,
    corner: 0.08,
    sky: ['#f7f0e0', '#efe4cd', '#ddcdb0'],
    horizon: '#ffffff',
    ground: '#cdb994',
    grid: 'rgba(120,100,70,0.12)',
    ink: '#3a3025',
    inkSoft: 'rgba(58,48,37,0.55)',
    accent: '#d2603a',
    accent2: '#4f7f6a',
    panel: 'rgba(255,251,240,0.96)',
    panelEdge: 'rgba(210,96,58,0.5)',
    panelSolid: '#fffbf0',
    veilRgb: '50, 40, 28',
    materials: {
      wood: { fill: '#e5b678', stroke: '#a97c41', top: 'rgba(255,255,255,0.45)' },
      block: { fill: '#e07aa8', stroke: '#a84872', top: 'rgba(255,255,255,0.5)' },
      stone: { fill: '#b8b3a6', stroke: '#7d7869', top: 'rgba(255,255,255,0.45)' },
      ice: { fill: '#a9d6e5', stroke: '#6497ab', top: 'rgba(255,255,255,0.6)' },
      rubber: { fill: '#8fc79a', stroke: '#4f8b5d', top: 'rgba(255,255,255,0.45)' },
      metal: { fill: '#aeb6c2', stroke: '#6d7683', top: 'rgba(255,255,255,0.55)' },
      glass: { fill: 'rgba(214,236,242,0.75)', stroke: '#8bb3bf', top: 'rgba(255,255,255,0.7)' },
      foam: { fill: '#eaa8bf', stroke: '#ac6f84', top: 'rgba(255,255,255,0.5)' },
      bomb: { fill: '#e07a63', stroke: '#9c4331', top: 'rgba(255,235,225,0.5)' },
      obsidian: { fill: '#575146', stroke: '#2e2a23', top: 'rgba(190,180,165,0.35)' },
      tnt: { fill: '#e0885c', stroke: '#9c4f28', top: 'rgba(255,240,225,0.5)' },
      crystal: { fill: 'rgba(216,206,234,0.8)', stroke: '#8d82a8', top: 'rgba(255,255,255,0.65)' },
      wax: { fill: '#eccb8e', stroke: '#a8863f', top: 'rgba(255,255,255,0.5)' },
    },
    pedestal: { style: 'dobra', fill: '#c0a880', stroke: '#7c6748', glow: '#d2603a' },
    hexagon: { fill: '#b8441f', stroke: '#b8441f', core: '#fffcf7' },
    star: '#e8a82e',
    starOff: 'rgba(160,145,120,0.55)',
    guide: 'rgba(90,75,55,0.4)',
    font: SERIF_FONT,
  },
};

export const THEME_IDS = Object.keys(THEMES);

/**
 * @param {string} id
 * @returns {Theme}
 */
export function theme(id) {
  return THEMES[id] || THEMES.neon;
}
