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
 * @property {'neon'|'plate'|'grain'|'flat'|'gloss'|'frost'|'ember'|'paper'} style
 * @property {number} glow 0 a 1
 * @property {boolean} [photo] false quando o material NAO e uma fotografia
 * @property {number} corner raio dos cantos, em fracao da celula
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
 * @property {{fill:string, stroke:string, core:string}} hexagon
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
  // ------------------------------------------------------------------ neon
  neon: {
    id: 'neon',
    label: 'Neon',
    style: 'neon',
    glow: 1,
    corner: 0.22,
    // Sem foto: neste mundo a peca e um tubo de vidro aceso, e a fotografia de
    // pedra dentro dele contradiz o que o cenario promete. Todos os outros
    // temas continuam usando o material como fotografia.
    photo: false,
    sky: ['#03020b', '#0a0520', '#1d0937'],
    horizon: '#ff2d95',
    ground: '#06030f',
    grid: 'rgba(190,90,255,0.26)',
    ink: '#f4ecff',
    inkSoft: 'rgba(244,236,255,0.62)',
    accent: '#ff43b8',
    accent2: '#33e1ff',
    panel: 'rgba(30,10,60,0.82)',
    panelEdge: 'rgba(255,67,184,0.75)',
    panelSolid: '#1a0a38',
    veilRgb: '6, 3, 15',
    // Miolo translucido e escuro, traco aceso: a peca e um tubo de luz com
    // vidro fumê dentro.
    //
    // Ja foi corpo opaco, e por um motivo concreto: o sol listrado do cenario
    // aparecia ATRAVES da peca e o jogador via faixas onde devia ver material.
    // O sol saiu do cenario - a referencia deste mundo nao tem sol -, e com ele
    // saiu a razao do corpo opaco. O que garante a leitura agora e o proprio
    // fundo, escuro e calmo atras da coluna de jogo.
    //
    // A obsidiana e a excecao: vai quase opaca de proposito. Ela e a unica que
    // o jogador nao pode quebrar, e um corpo denso le como "isto nao cede"
    // antes mesmo de ele tentar.
    materials: {
      wood: { fill: 'rgba(92,60,14,0.46)', stroke: '#ffc43c', inner: 'rgba(255,196,60,0.42)', top: '#ffc43c' },
      stone: { fill: 'rgba(84,20,42,0.46)', stroke: '#ff3d6e', inner: 'rgba(255,61,110,0.42)', top: '#ff3d6e' },
      ice: { fill: 'rgba(16,62,76,0.44)', stroke: '#50e2ff', inner: 'rgba(80,226,255,0.48)', top: '#8af0ff' },
      rubber: { fill: 'rgba(12,64,40,0.46)', stroke: '#42ff8c', inner: 'rgba(66,255,140,0.42)', top: '#42ff8c' },
      metal: { fill: 'rgba(44,54,86,0.5)', stroke: '#b2c6ff', inner: 'rgba(178,198,255,0.42)', top: '#d8e2ff' },
      glass: { fill: 'rgba(158,220,240,0.24)', stroke: '#d2f5ff', inner: 'rgba(210,245,255,0.5)', top: '#ffffff' },
      foam: { fill: 'rgba(80,24,63,0.46)', stroke: '#ff8cdc', inner: 'rgba(255,140,220,0.42)', top: '#ff8cdc' },
      bomb: { fill: 'rgba(92,22,14,0.54)', stroke: '#ff5a3c', inner: 'rgba(255,200,60,0.6)', top: '#ffc83c' },
      obsidian: { fill: 'rgba(30,22,52,0.86)', stroke: '#8a74c8', inner: 'rgba(90,70,150,0.5)', top: '#8a74c8' },
      tnt: { fill: 'rgba(92,44,6,0.54)', stroke: '#ff8c28', inner: 'rgba(255,230,90,0.6)', top: '#ffe65a' },
      crystal: { fill: 'rgba(52,36,88,0.44)', stroke: '#c896ff', inner: 'rgba(200,150,255,0.45)', top: '#e0c6ff' },
      wax: { fill: 'rgba(96,56,14,0.46)', stroke: '#ffbe5a', inner: 'rgba(255,230,160,0.48)', top: '#ffe6a0' },
    },
    pedestal: { style: 'neon', fill: 'rgba(92,46,190,0.85)', stroke: '#b98cff', glow: '#a066ff' },
    hexagon: { fill: 'rgba(190,240,255,0.2)', stroke: '#4fc8ff', core: '#ffffff' },
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
      wood: { fill: '#3d4a56', stroke: '#7c93a6', top: 'rgba(255,255,255,0.14)' },
      stone: { fill: '#4a4152', stroke: '#9c8ab0', top: 'rgba(255,255,255,0.12)' },
      ice: { fill: '#22505e', stroke: '#5fd9f2', top: 'rgba(200,250,255,0.24)' },
      rubber: { fill: '#22513f', stroke: '#3ddc97', top: 'rgba(200,255,230,0.18)' },
      metal: { fill: '#5b6470', stroke: '#cdd9e6', top: 'rgba(255,255,255,0.3)' },
      glass: { fill: 'rgba(150,220,240,0.22)', stroke: '#a9e8f7', top: 'rgba(255,255,255,0.35)' },
      foam: { fill: '#4f3d54', stroke: '#d38fd0', top: 'rgba(255,230,255,0.16)' },
      bomb: { fill: '#5c2f2a', stroke: '#ff7a55', top: 'rgba(255,190,140,0.3)' },
      obsidian: { fill: '#1b2029', stroke: '#48566b', top: 'rgba(120,150,180,0.2)' },
      tnt: { fill: '#5e3a1e', stroke: '#ffa24d', top: 'rgba(255,215,150,0.32)' },
      crystal: { fill: 'rgba(170,140,220,0.26)', stroke: '#c0a8f0', top: 'rgba(240,230,255,0.38)' },
      wax: { fill: '#54452c', stroke: '#e8c070', top: 'rgba(255,240,200,0.24)' },
    },
    pedestal: { style: 'hangar', fill: '#152a38', stroke: '#2ee6c4', glow: '#2ee6c4' },
    hexagon: { fill: '#173c48', stroke: '#5ff0d8', core: '#d8fff6' },
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
      wood: { fill: '#a9723c', stroke: '#67401e', top: 'rgba(255,220,170,0.26)' },
      stone: { fill: '#8d8578', stroke: '#544e46', top: 'rgba(255,255,245,0.2)' },
      ice: { fill: '#8fb9c4', stroke: '#4d7783', top: 'rgba(235,255,255,0.34)' },
      rubber: { fill: '#6f8f4e', stroke: '#3f5a2a', top: 'rgba(230,255,190,0.2)' },
      metal: { fill: '#7d8894', stroke: '#454d58', top: 'rgba(255,255,255,0.3)' },
      glass: { fill: 'rgba(190,220,215,0.4)', stroke: '#6f9a95', top: 'rgba(255,255,255,0.4)' },
      foam: { fill: '#c9909f', stroke: '#8a5763', top: 'rgba(255,225,235,0.22)' },
      bomb: { fill: '#8d4230', stroke: '#4a1e14', top: 'rgba(255,170,120,0.24)' },
      obsidian: { fill: '#3a3138', stroke: '#17131a', top: 'rgba(130,120,140,0.2)' },
      tnt: { fill: '#9a5a2a', stroke: '#4d2a10', top: 'rgba(255,200,140,0.28)' },
      crystal: { fill: 'rgba(190,175,215,0.5)', stroke: '#6f5f8a', top: 'rgba(255,250,255,0.4)' },
      wax: { fill: '#d9b46a', stroke: '#8a6a2c', top: 'rgba(255,245,210,0.3)' },
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
    hexagon: { fill: '#dce9ff', stroke: '#1f4fd0', core: '#ffffff' },
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
    hexagon: { fill: '#ffc2dd', stroke: '#e6247e', core: '#fffdfe' },
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
      wood: { fill: '#9e7d5c', stroke: '#6a5038', top: 'rgba(255,240,215,0.28)' },
      stone: { fill: '#6d7c8a', stroke: '#3c4854', top: 'rgba(230,245,255,0.28)' },
      ice: { fill: 'rgba(160,230,255,0.55)', stroke: '#cbf2ff', top: 'rgba(255,255,255,0.7)' },
      rubber: { fill: '#3f8f78', stroke: '#1d5a49', top: 'rgba(210,255,240,0.24)' },
      metal: { fill: '#8496a8', stroke: '#4a5a6b', top: 'rgba(240,250,255,0.4)' },
      glass: { fill: 'rgba(205,245,255,0.42)', stroke: '#e6fbff', top: 'rgba(255,255,255,0.7)' },
      foam: { fill: '#c096b8', stroke: '#7d5e79', top: 'rgba(255,235,250,0.3)' },
      bomb: { fill: '#a3503e', stroke: '#5e2a1f', top: 'rgba(255,190,165,0.3)' },
      obsidian: { fill: '#2b3947', stroke: '#101a24', top: 'rgba(150,185,210,0.28)' },
      tnt: { fill: '#8a4a26', stroke: '#e08a45', top: 'rgba(255,215,170,0.3)' },
      crystal: { fill: 'rgba(190,175,230,0.5)', stroke: '#d8ccff', top: 'rgba(255,255,255,0.65)' },
      wax: { fill: '#b89a62', stroke: '#e6c98a', top: 'rgba(255,245,215,0.32)' },
    },
    pedestal: { style: 'gelo', fill: '#2c5a75', stroke: '#9fe0f5', glow: '#9fe0f5' },
    hexagon: { fill: 'rgba(225,250,255,0.75)', stroke: '#59c4e8', core: '#ffffff' },
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
      wood: { fill: '#7d4a1f', stroke: '#ffae4d', top: 'rgba(255,215,160,0.34)' },
      stone: { fill: '#565049', stroke: '#c9bcae', top: 'rgba(255,240,225,0.26)' },
      ice: { fill: '#2f6f85', stroke: '#7fe9ff', top: 'rgba(220,250,255,0.34)' },
      rubber: { fill: '#2b6b45', stroke: '#57f59a', top: 'rgba(200,255,215,0.26)' },
      metal: { fill: '#6f7a86', stroke: '#e4eef8', top: 'rgba(255,255,255,0.36)' },
      glass: { fill: 'rgba(170,215,235,0.3)', stroke: '#d8f3ff', top: 'rgba(255,255,255,0.45)' },
      foam: { fill: '#8a3f63', stroke: '#ff9ac6', top: 'rgba(255,215,235,0.3)' },
      bomb: { fill: '#8f2410', stroke: '#ff5a1a', top: 'rgba(255,215,140,0.5)' },
      obsidian: { fill: '#120c0c', stroke: '#6b3a26', top: 'rgba(255,120,50,0.3)' },
      tnt: { fill: '#8a3a10', stroke: '#ffae3c', top: 'rgba(255,230,160,0.5)' },
      crystal: { fill: 'rgba(160,130,190,0.32)', stroke: '#d0b4ff', top: 'rgba(245,235,255,0.42)' },
      wax: { fill: '#a85f1e', stroke: '#ffd27a', top: 'rgba(255,240,190,0.45)' },
    },
    pedestal: { style: 'obsidiana', fill: '#3b1b12', stroke: '#ff8a2a', glow: '#ff6a12' },
    hexagon: { fill: 'rgba(255,220,170,0.28)', stroke: '#ffb347', core: '#fff4dc' },
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
    hexagon: { fill: '#ffdcc6', stroke: '#b8441f', core: '#fffcf7' },
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
