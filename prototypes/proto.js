/**
 * Casca dos prototipos.
 *
 * Cada pagina carrega este modulo com um tema. A fisica, o laco, a entrada e o
 * desenho sao exatamente os do jogo final: o prototipo troca so a arte e
 * acrescenta controles para comparar temas e um teste de tortura da pilha.
 */

import { GameScene } from '../src/game/scene.js';
import { Session, createSession } from '../src/game/session.js';
import { levelConfig, generateLayout } from '../src/game/levelgen.js';
import { LEVELS } from '../src/game/levels.gen.js';
import { THEMES, THEME_IDS, theme as getTheme } from '../src/render/themes.js';
import { MATERIALS } from '../src/physics/materials.js';
import { audio } from '../src/core/audio.js';
import { SKINS, skin as getSkin } from '../src/game/content.js';

const MUSIC = {
  neon: { scale: [0, 3, 5, 7, 10], root: -5, bpm: 104, type: 'sawtooth', bass: 'square' },
  futuristic: { scale: [0, 2, 3, 7, 9], root: -7, bpm: 96, type: 'square', bass: 'triangle' },
  rustic: { scale: [0, 2, 4, 7, 9], root: -9, bpm: 84, type: 'triangle', bass: 'sine' },
  classic: { scale: [0, 2, 4, 7, 11], root: -4, bpm: 92, type: 'sine', bass: 'sine' },
  candy: { scale: [0, 2, 4, 7, 9], root: 0, bpm: 118, type: 'triangle', bass: 'sine' },
  ice: { scale: [0, 2, 3, 7, 10], root: -2, bpm: 76, type: 'sine', bass: 'triangle' },
  lava: { scale: [0, 1, 5, 7, 8], root: -12, bpm: 88, type: 'sawtooth', bass: 'square' },
  paper: { scale: [0, 2, 5, 7, 9], root: -7, bpm: 100, type: 'triangle', bass: 'triangle' },
};

/** Fases escolhidas para mostrar variedade de forma, material e cenario. */
const SHOWCASE = [
  { label: 'Facil', level: 3 },
  { label: 'Media', level: 24 },
  { label: 'Dificil', level: 58 },
  { label: 'Extrema', level: 88 },
];

/**
 * Teste de tortura: torre alta com razao de massa 10 para 1, para provar que
 * a pilha nao treme parada.
 * @returns {import('../src/physics/world.js').LevelLayout}
 */
function tortureLayout() {
  const width = 5;
  const rows = 14;
  /** @type {*[]} */
  const pieces = [];
  const heavy = ['metal', 'stone'];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < width; x++) {
      const mat = y % 3 === 0 ? heavy[(x + y) % 2] : y % 3 === 1 ? 'foam' : 'wood';
      pieces.push({ shape: 'mono', cells: [[0, 0]], material: mat, x, y });
    }
  }
  return {
    width,
    height: rows,
    pieces,
    hexagon: { x: width / 2 },
    pedestal: { x: width / 2, halfWidth: width * 0.75, oscillate: 0 },
    starLines: [rows * 0.62, rows * 0.3, 0.83],
    wind: 0,
    hexScale: 1,
  };
}

/**
 * @param {string} themeId
 */
export function startPrototype(themeId) {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
  const els = {
    title: /** @type {HTMLElement} */ (document.getElementById('title')),
    stars: /** @type {HTMLElement} */ (document.getElementById('stars')),
    taps: /** @type {HTMLElement} */ (document.getElementById('taps')),
    info: /** @type {HTMLElement} */ (document.getElementById('info')),
    banner: /** @type {HTMLElement} */ (document.getElementById('banner')),
    bannerTitle: /** @type {HTMLElement} */ (document.getElementById('bannerTitle')),
    bannerText: /** @type {HTMLElement} */ (document.getElementById('bannerText')),
    drawer: /** @type {HTMLElement} */ (document.getElementById('drawer')),
    themeChips: /** @type {HTMLElement} */ (document.getElementById('themeChips')),
    levelChips: /** @type {HTMLElement} */ (document.getElementById('levelChips')),
    skinChips: /** @type {HTMLElement} */ (document.getElementById('skinChips')),
    hint: /** @type {HTMLElement} */ (document.getElementById('hint')),
  };

  const state = {
    theme: THEMES[themeId] ? themeId : 'neon',
    pick: 0,
    skin: 'classic',
    torture: false,
    tortureStart: 0,
  };

  let hintTimer = 0;
  const scene = new GameScene(canvas, { topInset: 108, bottomInset: 92 });

  /** Aplica as cores do tema na interface HTML. */
  function paintUi() {
    const th = getTheme(state.theme);
    const root = document.documentElement.style;
    root.setProperty('--ink', th.ink);
    root.setProperty('--ink-soft', th.inkSoft);
    root.setProperty('--accent', th.accent);
    root.setProperty('--accent2', th.accent2);
    root.setProperty('--panel', th.panel);
    root.setProperty('--font', th.font);
    document.body.style.background = th.sky[0];
    els.title.textContent = th.label;
    document.title = 'Hexa Drop - modelo ' + th.label;
  }

  /** @param {number} n */
  function setStars(n) {
    const kids = els.stars.children;
    for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('on', i < n);
  }

  /**
   * @param {string} title
   * @param {string} text
   */
  function showBanner(title, text) {
    els.bannerTitle.textContent = title;
    els.bannerText.textContent = text;
    els.banner.classList.add('show');
  }
  function hideBanner() {
    els.banner.classList.remove('show');
  }

  function buildSession() {
    hideBanner();
    setStars(0);
    if (state.torture) {
      state.tortureStart = performance.now();
      return new Session({
        layout: tortureLayout(),
        seed: 99,
        onStar: setStars,
        onEnd: (s) => endBanner(s),
      });
    }
    const pick = SHOWCASE[state.pick];
    const idx = pick.level - 1;
    const record = LEVELS[idx] || LEVELS[0];
    const variant = record.v[Math.floor(Math.random() * record.v.length)];
    return createSession({
      levelIndex: idx,
      soften: record.s,
      seed: variant[0],
      hooks: { onStar: setStars, onEnd: (s) => endBanner(s) },
    });
  }

  /** @param {string} result */
  function endBanner(result) {
    const stars = scene.session ? scene.session.stars : 0;
    if (result === 'won') {
      audio.win();
      showBanner('Vitoria', `${stars} estrelas em ${scene.session?.taps} toques`);
    } else if (result === 'lost') {
      audio.lose();
      showBanner('Game over', 'O hexagono saiu da torre');
    } else {
      showBanner('Fim', `Acabaram as pecas com ${stars} estrelas`);
    }
  }

  function reload() {
    const session = buildSession();
    scene.load(session, state.theme, getSkin(state.skin));
    audio.setMusic_(MUSIC[state.theme] || MUSIC.neon);
    paintUi();
    updateChips();
    els.hint.textContent = state.torture
      ? 'Teste de tortura: a torre deve ficar imovel'
      : 'Toque nas pecas para levar o hexagono ate a plataforma';
    els.hint.classList.remove('fade');
    clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => els.hint.classList.add('fade'), 4500);
  }

  function updateChips() {
    for (const c of els.themeChips.children) {
      c.classList.toggle('on', /** @type {HTMLElement} */ (c).dataset.id === state.theme);
    }
    for (const c of els.levelChips.children) {
      const el = /** @type {HTMLElement} */ (c);
      const isTorture = el.dataset.torture === '1';
      c.classList.toggle('on', isTorture ? state.torture : !state.torture && Number(el.dataset.i) === state.pick);
    }
    for (const c of els.skinChips.children) {
      c.classList.toggle('on', /** @type {HTMLElement} */ (c).dataset.id === state.skin);
    }
  }

  // ---- monta os controles ------------------------------------------------
  for (const id of THEME_IDS) {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.dataset.id = id;
    chip.textContent = THEMES[id].label;
    chip.onclick = () => {
      state.theme = id;
      audio.button();
      reload();
    };
    els.themeChips.appendChild(chip);
  }
  SHOWCASE.forEach((s, i) => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.dataset.i = String(i);
    chip.textContent = `${s.label} (${s.level})`;
    chip.onclick = () => {
      state.pick = i;
      state.torture = false;
      audio.button();
      reload();
    };
    els.levelChips.appendChild(chip);
  });
  {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.dataset.torture = '1';
    chip.textContent = 'Teste de tortura';
    chip.onclick = () => {
      state.torture = true;
      audio.button();
      reload();
    };
    els.levelChips.appendChild(chip);
  }
  for (const s of SKINS.slice(0, 6)) {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.dataset.id = s.id;
    chip.textContent = s.name;
    chip.onclick = () => {
      state.skin = s.id;
      audio.button();
      scene.skin = getSkin(s.id);
      if (scene.sprites) scene.sprites.clear();
      updateChips();
    };
    els.skinChips.appendChild(chip);
  }

  const btnRestart = /** @type {HTMLElement} */ (document.getElementById('restart'));
  btnRestart.onclick = () => {
    audio.buttonBack();
    reload();
  };
  const btnOptions = /** @type {HTMLElement} */ (document.getElementById('options'));
  btnOptions.onclick = () => {
    audio.button();
    els.drawer.classList.toggle('open');
    btnOptions.classList.toggle('on', els.drawer.classList.contains('open'));
  };
  const btnSound = /** @type {HTMLElement} */ (document.getElementById('sound'));
  btnSound.onclick = () => {
    audio.unlock();
    const on = !audio.sfxOn;
    audio.setSfx(on);
    audio.setMusic(on);
    btnSound.textContent = on ? '♪' : '✕';
    btnSound.classList.toggle('on', on);
  };
  btnSound.textContent = audio.sfxOn ? '♪' : '✕';
  btnSound.classList.toggle('on', audio.sfxOn);

  // ---- estatisticas no rodape -------------------------------------------
  let statTimer = 0;
  scene.onUpdate = (dt) => {
    statTimer += dt;
    if (statTimer < 0.12 || !scene.session) return;
    statTimer = 0;
    const w = scene.session.world;
    els.taps.textContent = String(scene.session.taps);
    const awake = w.alivePieces().filter((p) => p.body.isDynamic() && p.body.isAwake()).length;
    if (state.torture) {
      const secs = ((performance.now() - state.tortureStart) / 1000).toFixed(0);
      let drift = 0;
      for (const p of w.alivePieces()) {
        const c = p.body.getPosition();
        drift = Math.max(drift, Math.abs(c.x - (p.spawnX + 0.5)));
      }
      els.info.textContent = `${secs}s - desvio ${drift.toFixed(3)} m - ${awake} em movimento`;
    } else {
      els.info.textContent = `${w.alivePieces().length} pecas - ${awake} em movimento - ${Math.round(scene.loop.fps)} fps`;
    }
  };

  audio.init();
  reload();
  scene.start();
  // Exposta para a automacao de teste headless.
  window.__scene = scene;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') reload();
    if (e.code === 'Escape') els.drawer.classList.remove('open');
  });
}
