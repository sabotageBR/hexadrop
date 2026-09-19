/**
 * Hexa Drop - controlador do jogo.
 *
 * Este arquivo e o unico lugar que decide telas, progressao e quando falar com
 * o Poki SDK. A fisica, o desenho e as regras de fase vivem em modulos proprios
 * e sao os mesmos usados pelos prototipos.
 */

import { GameScene } from './game/scene.js';
import { createSession } from './game/session.js';
import { levelConfig, LEVEL_COUNT, WORLD_THEMES } from './game/levelgen.js';
import { LEVELS } from './game/levels.gen.js';
import { Progress } from './game/progress.js';
import { UPGRADES, BOOSTS, gateStars, xpForRank, skin as getSkin } from './game/content.js';
import { THEMES } from './render/themes.js';
import { applyUiTheme } from './render/uitheme.js';
import { material as getMaterial } from './physics/materials.js';
import { audio } from './core/audio.js';
import { poki } from './poki.js';
import { t, getLang, setLang, LANGS, LANG_NAMES, onLangChange } from './core/i18n.js';
import { load, save, isPersistent } from './core/storage.js';
import { Rng } from './core/rng.js';

/** Trilha sonora por tema. */
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

/** Mundos do mapa. Dez fases cada. */
const WORLD_COUNT = 10;

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));

class Game {
  constructor() {
    this.progress = new Progress();
    this.rng = new Rng(Date.now() & 0x7fffffff);
    this.canvas = /** @type {HTMLCanvasElement} */ ($('game'));
    this.scene = new GameScene(this.canvas, { topInset: 108, bottomInset: 40 });
    /** @type {string} */
    this.screen = '';
    this.level = Math.min(LEVEL_COUNT, this.progress.data.unlocked);
    this.lossStreak = 0;
    this.lastResult = null;
    this.quality = load('quality', 'auto');
    this.shopTab = 'skins';
    this.toastTimer = 0;
    this.tutTimer = 0;
    this.pendingHeart = false;
  }

  // ---------------------------------------------------------------- boot

  async boot() {
    this.bindUi();
    this.applyLang();
    this.applyQuality();

    poki.onAdStart = () => {
      audio.muteForAd();
      this.scene.input.disable();
      this.scene.loop.pause();
    };
    poki.onAdEnd = () => {
      audio.unmuteAfterAd();
      this.scene.input.enable();
      this.scene.loop.start();
    };

    $('loaderBar').style.width = '35%';
    await poki.init();
    $('loaderBar').style.width = '75%';

    // Cena de fundo da tela inicial: uma fase real rodando atras do menu.
    this.showAmbient();
    $('loaderBar').style.width = '100%';

    this.scene.start();
    this.show('home');
    poki.gameLoadingFinished();
    window.setTimeout(() => $('loader').classList.add('gone'), 260);

    onLangChange(() => {
      this.applyLang();
      this.refreshScreen();
    });
    this.scene.input.onKey((code) => this.onKey(code));
    window.setInterval(() => this.tickHearts(), 5000);
  }

  // -------------------------------------------------------------- telas

  /** @param {string} name */
  show(name) {
    for (const el of document.querySelectorAll('.screen')) el.classList.remove('on');
    const el = document.getElementById('s-' + name);
    if (el) el.classList.add('on');
    this.screen = name;
    this.refreshScreen();
    // No mobile, afasta o botao flutuante da Poki da HUD do topo.
    poki.movePill(name === 'game' ? 0 : 0, name === 'game' ? 64 : 24);
  }

  refreshScreen() {
    const p = this.progress;
    p.refreshHearts();
    const hearts = String(p.data.hearts);
    const coins = String(p.data.coins);
    for (const id of ['homeHearts', 'mapHearts', 'gameHearts']) {
      const el = document.getElementById(id);
      if (el) el.textContent = hearts;
    }
    for (const id of ['homeCoins', 'mapCoins', 'shopCoins']) {
      const el = document.getElementById(id);
      if (el) el.textContent = coins;
    }
    $('homeRank').textContent = String(p.rank);
    $('homeStars').textContent = String(p.totalStars);
    // Barra de patente: quanto falta de XP para a proxima.
    const bar = document.getElementById('homeRankBar');
    if (bar) {
      const base = xpForRank(p.rank);
      const alvo = xpForRank(p.rank + 1);
      const frac = alvo > base ? (p.data.xp - base) / (alvo - base) : 0;
      bar.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    }
    if (this.screen === 'map') {
      this.buildMap();
      const novos = this.progress.freshlyOpenedWorlds();
      if (novos.length) this.playWorldUnlock(novos[0]);
      else this.scrollMapToCurrent();
    }
    if (this.screen === 'shop') this.buildShop();
    if (this.screen === 'home') {
      $('btnPlay').textContent = `${t('play')}  ${this.level}`;
    }
    const daily = $('btnDaily');
    if (daily) {
      daily.textContent = p.dailyReady ? t('dailyBonus') : t('comeBackTomorrow');
      /** @type {HTMLButtonElement} */ (daily).disabled = !p.dailyReady;
    }
  }

  tickHearts() {
    const before = this.progress.data.hearts;
    this.progress.refreshHearts();
    if (this.progress.data.hearts !== before) this.refreshScreen();
  }

  // -------------------------------------------------------------- idioma

  applyLang() {
    document.documentElement.lang = getLang();
    const set = (/** @type {string} */ id, /** @type {string} */ text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('tagline', t('credits'));
    set('btnMap', t('levels'));
    set('btnShop', t('shop'));
    set('btnSettings', t('settings'));
    set('rankLabel', t('playerLevel'));
    set('mapTitle', t('levels'));
    set('shopTitle', t('shop'));
    set('tabSkins', t('skins'));
    set('tabUpgrades', t('upgrades'));
    set('tabBoosts', t('boosts'));
    set('winNext', t('next'));
    set('winHome', t('home'));
    set('winDouble', t('doubleReward'));
    set('winCoinsLbl', t('rewardCoins'));
    set('winXpLbl', t('rewardXp'));
    set('loseTitle', t('gameOver'));
    set('loseRetry', t('retry'));
    set('loseShuffle', t('shuffle'));
    set('loseHome', t('home'));
    set('loseAd', t('refillHearts'));
    set('loseSkip', t('skipLevel'));
    set('pauseTitle', t('paused'));
    set('pauseResume', t('resume'));
    set('pauseRestart', t('restart'));
    set('pauseHome', t('home'));
    set('setTitle', t('settings'));
    set('lblSound', t('sound'));
    set('lblMusic', t('music'));
    set('lblQuality', t('quality'));
    set('lblLang', t('language'));
    set('setReset', t('reset'));
    set('setClose', t('close'));
    set('setStorage', isPersistent() ? '' : t('progressNotSaved'));
    this.buildSettings();
  }

  // ------------------------------------------------------------- ligacoes

  bindUi() {
    const go = (/** @type {string} */ name) => () => {
      audio.unlock();
      audio.button();
      this.show(name);
    };

    $('btnPlay').onclick = () => {
      audio.unlock();
      audio.button();
      this.startLevel(this.level);
    };
    $('btnMap').onclick = go('map');
    $('btnShop').onclick = go('shop');
    $('btnSettings').onclick = go('settings');
    $('mapBack').onclick = () => {
      audio.buttonBack();
      this.show('home');
    };
    $('shopBack').onclick = () => {
      audio.buttonBack();
      this.show('home');
    };
    $('setClose').onclick = () => {
      audio.buttonBack();
      this.show(this.scene.session && this.screen === 'settings' && this.paused ? 'pause' : 'home');
    };
    $('gameBack').onclick = () => this.quitLevel();
    $('gameRestart').onclick = () => {
      audio.button();
      this.retry(true);
    };
    $('gameHint').onclick = () => this.hintByAd();
    $('gamePause').onclick = () => this.pauseLevel();
    $('pauseResume').onclick = () => this.resumeLevel();
    $('pauseRestart').onclick = () => {
      audio.button();
      this.retry(true);
    };
    $('pauseHome').onclick = () => this.quitLevel();

    $('winNext').onclick = () => this.nextLevel();
    $('winHome').onclick = () => {
      audio.buttonBack();
      this.showAmbient();
      this.show('home');
    };
    $('winDouble').onclick = () => this.doubleReward();
    $('loseRetry').onclick = () => this.retry(false);
    $('loseShuffle').onclick = () => this.shuffleLevel();
    $('loseHome').onclick = () => {
      audio.buttonBack();
      this.showAmbient();
      this.show('home');
    };
    $('loseAd').onclick = () => this.refillByAd();
    $('loseSkip').onclick = () => this.skipByAd();
    $('btnDaily').onclick = () => this.dailyByAd();
    $('tabSkins').onclick = () => {
      this.shopTab = 'skins';
      audio.button();
      this.buildShop();
    };
    $('tabUpgrades').onclick = () => {
      this.shopTab = 'upgrades';
      audio.button();
      this.buildShop();
    };
    $('tabBoosts').onclick = () => {
      this.shopTab = 'boosts';
      audio.button();
      this.buildShop();
    };
    $('setReset').onclick = () => {
      if (!this._confirmReset) {
        this._confirmReset = true;
        $('setReset').textContent = t('resetConfirm');
        window.setTimeout(() => {
          this._confirmReset = false;
          $('setReset').textContent = t('reset');
        }, 4000);
        return;
      }
      this.progress.reset();
      this.level = 1;
      this._confirmReset = false;
      $('setReset').textContent = t('reset');
      this.toast(t('reset'));
      this.show('home');
    };
  }

  /** @param {string} code */
  onKey(code) {
    if (code === 'Escape' || code === 'Space') {
      if (this.screen === 'game') this.pauseLevel();
      else if (this.screen === 'pause') this.resumeLevel();
    }
  }

  // --------------------------------------------------------------- fases

  /**
   * @param {number} level base 1
   * @returns {{session:*, theme:string}}
   */
  makeSession(level, variantIndex) {
    const index = Math.max(0, Math.min(LEVEL_COUNT - 1, level - 1));
    const record = LEVELS[index] || LEVELS[0];
    // A variante fica gravada. Sem isso, "tentar de novo" sorteava outro layout
    // e ficava indistinguivel de "embaralhar" - que e justamente o que deve
    // custar um consumivel.
    const vi =
      variantIndex === undefined
        ? Math.floor(this.rng.next() * record.v.length)
        : ((variantIndex % record.v.length) + record.v.length) % record.v.length;
    this.variantIndex = vi;
    this.variantCount = record.v.length;
    const variant = record.v[vi];
    const config = levelConfig(index, record.s);
    const session = createSession({
      levelIndex: index,
      soften: record.s,
      seed: variant[0],
      upgrades: this.progress.data.upgrades,
      hooks: {
        onStar: (n) => this.onStar(n),
        onEnd: (state) => this.onLevelEnd(state),
        onFirstTap: () => poki.gameplayStart(),
      },
    });
    session.par = variant[1];
    return { session, theme: config.theme };
  }

  /** Cena de fundo do menu: uma fase real, sem interacao relevante. */
  showAmbient() {
    // Uma fase alta rende um cenario melhor atras do menu do que a fase 1.
    const level = Math.max(12, Math.min(LEVEL_COUNT, this.level));
    const { session, theme } = this.makeSession(level);
    session.onEnd = null;
    session.onStar = null;
    session.onFirstTap = null;
    this.scene.load(session, theme, getSkin(this.progress.data.skin));
    applyUiTheme(this.scene.theme);
    audio.setMusic_(MUSIC[theme] || MUSIC.neon);
  }

  /** @param {number} level */
  startLevel(level, variantIndex) {
    // Fecha o gameplay anterior antes de abrir o proximo: a Poki reprova
    // gameplayStart repetido sem um gameplayStop entre eles.
    poki.gameplayStop();
    const mudouDeFase = this.level !== Math.max(1, Math.min(LEVEL_COUNT, level));
    this.level = Math.max(1, Math.min(LEVEL_COUNT, level));
    if (mudouDeFase) this.lossStreak = 0;
    this.paused = false;
    this.pendingHeart = true;
    const { session, theme } = this.makeSession(this.level, variantIndex);
    this.scene.load(session, theme, getSkin(this.progress.data.skin));
    applyUiTheme(this.scene.theme);
    audio.setMusic_(MUSIC[theme] || MUSIC.neon);
    this.setStars('gameStars', 0);
    $('gameLevel').textContent = `${t('level')} ${this.level}`;
    // A dica so aparece depois de tropecar duas vezes na mesma fase, e sempre
    // ao lado de um botao padrao. Nunca e condicao para progredir.
    const showHelp = this.lossStreak >= 2;
    const hintBtn = /** @type {HTMLButtonElement} */ ($('gameHint'));
    const restartBtn = /** @type {HTMLButtonElement} */ ($('gameRestart'));
    hintBtn.hidden = !showHelp;
    restartBtn.hidden = !showHelp;
    hintBtn.disabled = false;
    hintBtn.textContent = t('hint');
    restartBtn.textContent = t('restart');
    this.show('game');
    this.showTutorial();
    poki.measure('level', String(this.level), 'start');
  }

  showTutorial() {
    const tut = $('tut');
    const config = levelConfig(this.level - 1);
    /** @type {string|null} */
    let msg = null;
    if (this.level === 1) msg = t('tutorialTap');
    else if (this.level === 2) msg = t('tutorialGoal');
    else if (this.level === 3) msg = t('tutorialStars');
    else if (config.newMaterials.length) {
      const id = config.newMaterials[0];
      msg = `${t('newMaterial')}: ${t(getMaterial(id).nameKey)} - ${t(getMaterial(id).hintKey)}`;
    }
    window.clearTimeout(this.tutTimer);
    if (!msg) {
      tut.classList.add('hide');
      return;
    }
    tut.textContent = msg;
    tut.classList.remove('hide');
    this.tutTimer = window.setTimeout(() => tut.classList.add('hide'), 5200);
  }

  /** @param {number} n */
  onStar(n) {
    audio.star(n - 1);
    this.setStars('gameStars', n);
    this.scene.camera.addTrauma(0.1);
  }

  /**
   * @param {string} id
   * @param {number} n
   */
  setStars(id, n) {
    const row = document.getElementById(id);
    if (!row) return;
    const kids = row.children;
    for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('on', i < n);
  }

  /** @param {string} state */
  onLevelEnd(state) {
    poki.gameplayStop();
    const session = this.scene.session;
    if (!session) return;
    const stars = session.stars;
    const completed = state === 'won' || (state === 'stuck' && stars >= 1);

    if (completed) {
      this.lossStreak = 0;
      poki.measure('level', String(this.level), 'complete');
      const result = this.progress.finishLevel({
        level: this.level,
        stars,
        won: state === 'won',
        taps: session.taps,
        par: session.par || 0,
      });
      this.lastResult = result;
      window.setTimeout(() => this.showWin(stars, result), 700);
    } else {
      this.lossStreak++;
      poki.measure('level', String(this.level), 'fail');
      if (this.pendingHeart) {
        this.progress.spendHeart();
        this.pendingHeart = false;
      }
      window.setTimeout(() => this.showLose(), 650);
    }
  }

  /**
   * @param {number} stars
   * @param {*} result
   */
  showWin(stars, result) {
    audio.win();
    $('winTitle').textContent = t('victory');
    this.setStars('winStars', 0);
    $('winCoins').textContent = '0';
    $('winXp').textContent = '0';
    $('winNote').textContent = result.halved ? t('noHeartsBody') : result.best ? t('newRecord') : '';
    const next = this.level >= LEVEL_COUNT ? t('home') : t('next');
    $('winNext').textContent = next;
    /** @type {HTMLButtonElement} */ ($('winDouble')).disabled = false;
    $('winDouble').textContent = `${t('doubleReward')}`;
    this.show('win');

    // Estrelas e contadores animam depois que a tela aparece.
    for (let i = 1; i <= stars; i++) {
      window.setTimeout(() => {
        this.setStars('winStars', i);
        audio.star(i - 1);
      }, 180 * i);
    }
    this.countUp($('winCoins'), result.coins, 180 * stars + 120, true);
    this.flyCoins($('winCoins'), Math.min(12, Math.max(4, Math.round(result.coins / 3))), 180 * stars + 160);
    this.countUp($('winXp'), result.xp, 180 * stars + 260, false);
    if (result.rankUp) {
      window.setTimeout(() => this.toast(`${t('playerLevel')} ${this.progress.rank}`), 900);
    }
  }

  /**
   * Lanca moedas do bloco de recompensa ate o contador do topo.
   * @param {HTMLElement} from
   * @param {number} count
   * @param {number} delay
   */
  flyCoins(from, count, delay) {
    const target = $('homeCoins');
    if (!target || !from) return;
    window.setTimeout(() => {
      const a = from.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      for (let i = 0; i < count; i++) {
        const dot = document.createElement('div');
        dot.className = 'coinfly';
        const sx = a.left + a.width / 2 + (this.rng.next() - 0.5) * 46;
        const sy = a.top + a.height / 2 + (this.rng.next() - 0.5) * 22;
        dot.style.left = `${sx}px`;
        dot.style.top = `${sy}px`;
        document.body.appendChild(dot);
        const dx = b.left + b.width / 2 - sx;
        const dy = b.top + b.height / 2 - sy;
        const lift = -60 - this.rng.next() * 70;
        dot.animate(
          [
            { transform: 'translate(0,0) scale(1)', opacity: 1 },
            { transform: `translate(${dx * 0.45}px, ${lift}px) scale(1.25)`, opacity: 1, offset: 0.45 },
            { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0 },
          ],
          { duration: 700 + this.rng.next() * 260, delay: i * 55, easing: 'cubic-bezier(0.3,0,0.4,1)', fill: 'forwards' },
        ).onfinish = () => dot.remove();
      }
    }, delay);
  }

  /**
   * @param {HTMLElement} el
   * @param {number} target
   * @param {number} delay
   * @param {boolean} sound
   */
  countUp(el, target, delay, sound) {
    window.setTimeout(() => {
      const steps = Math.min(18, Math.max(1, target));
      let i = 0;
      const timer = window.setInterval(() => {
        i++;
        el.textContent = String(Math.round((target * i) / steps));
        if (sound) audio.coin(i);
        if (i >= steps) window.clearInterval(timer);
      }, 42);
    }, delay);
  }

  showLose() {
    audio.lose();
    $('loseTitle').textContent = t('gameOver');
    const p = this.progress;
    $('loseNote').textContent = p.depleted ? t('noHeartsBody') : '';
    const adBtn = /** @type {HTMLButtonElement} */ ($('loseAd'));
    adBtn.hidden = p.data.hearts >= p.maxHearts;
    adBtn.disabled = false;
    adBtn.textContent = t('refillHearts');
    // Embaralhar: so faz sentido quando a fase tem mais de um layout aprovado.
    // Cinco das cem tem um so; ali o botao nao aparece em vez de gastar um
    // consumivel para devolver a mesma coisa.
    const shuffle = /** @type {HTMLButtonElement} */ ($('loseShuffle'));
    const restam = p.boostCount('shuffle');
    shuffle.hidden = (this.variantCount || 1) < 2;
    shuffle.disabled = restam <= 0;
    shuffle.textContent = restam > 0 ? `${t('shuffle')}  x${restam}` : t('shuffleNone');

    const skip = /** @type {HTMLButtonElement} */ ($('loseSkip'));
    skip.hidden = this.lossStreak < 3;
    skip.disabled = false;
    skip.textContent = t('skipLevel');
    this.show('lose');
  }

  pauseLevel() {
    if (this.screen !== 'game' || !this.scene.session) return;
    this.paused = true;
    this.scene.session.paused = true;
    poki.gameplayStop();
    audio.button();
    this.show('pause');
  }

  async resumeLevel() {
    audio.button();
    this.paused = false;
    this.show('game');
    // Voltar de uma parada para o jogo e o momento certo do intervalo, mas so
    // quando havia jogo de fato. Pausar antes do primeiro toque nao e uma
    // interrupcao de gameplay, e um anuncio ali seria injustificado.
    const wasPlaying = !!this.scene.session && this.scene.session.state === 'playing';
    if (wasPlaying) await poki.commercialBreak();
    if (this.scene.session) {
      this.scene.session.paused = false;
      if (wasPlaying && this.scene.session.state === 'playing') poki.gameplayStart();
    }
  }

  quitLevel() {
    audio.buttonBack();
    poki.gameplayStop();
    this.paused = false;
    if (this.scene.session) this.scene.session.paused = false;
    this.showAmbient();
    this.show('home');
  }

  async nextLevel() {
    audio.button();
    const target = this.level + 1;
    if (target > LEVEL_COUNT) {
      this.showAmbient();
      this.show('home');
      return;
    }
    this.level = target;
    await poki.commercialBreak();
    this.startLevel(target);
  }

  /**
   * Remonta a fase com outra variante aprovada, gastando um consumivel.
   * Nunca e condicao para progredir: "tentar de novo" continua gratuito.
   */
  shuffleLevel() {
    if ((this.variantCount || 1) < 2) {
      this.toast(t('shuffleOnly'));
      return;
    }
    if (!this.progress.spendBoost('shuffle')) {
      this.toast(t('shuffleNone'));
      return;
    }
    audio.button();
    // Um indice diferente do atual, sempre: embaralhar tem que mudar algo.
    const n = this.variantCount;
    const proximo = (this.variantIndex + 1 + Math.floor(this.rng.next() * (n - 1))) % n;
    this.toast(t('shuffleUsed'));
    this.startLevel(this.level, proximo);
    this.refreshScreen();
  }

  /** @param {boolean} fromPause */
  async retry(fromPause) {
    audio.button();
    this.paused = false;
    if (this.scene.session) this.scene.session.paused = false;
    if (!fromPause) await poki.commercialBreak();
    // Mesma fase, mesmo layout: repetir tem que ser repetir.
    this.startLevel(this.level, this.variantIndex);
  }

  // ------------------------------------------------------- videos opcionais

  async doubleReward() {
    const btn = /** @type {HTMLButtonElement} */ ($('winDouble'));
    btn.disabled = true;
    const ok = await poki.rewardedBreak('small');
    if (ok && this.lastResult) {
      this.progress.addCoins(this.lastResult.coins);
      this.progress.data.xp += this.lastResult.xp;
      this.progress.flush();
      $('winCoins').textContent = String(this.lastResult.coins * 2);
      $('winXp').textContent = String(this.lastResult.xp * 2);
      audio.win();
      this.toast(`+${this.lastResult.coins}`);
      this.lastResult = null;
      this.refreshScreen();
    } else {
      btn.disabled = false;
    }
  }

  async refillByAd() {
    const btn = /** @type {HTMLButtonElement} */ ($('loseAd'));
    btn.disabled = true;
    const ok = await poki.rewardedBreak('small');
    if (ok) {
      this.progress.refillHearts();
      audio.star(2);
      this.toast(t('heartsFull'));
      this.refreshScreen();
      btn.hidden = true;
    } else {
      btn.disabled = false;
    }
  }

  async skipByAd() {
    const btn = /** @type {HTMLButtonElement} */ ($('loseSkip'));
    btn.disabled = true;
    const ok = await poki.rewardedBreak('medium');
    if (!ok) {
      btn.disabled = false;
      return;
    }
    this.lossStreak = 0;
    const p = this.progress;
    if (this.level >= p.data.unlocked) p.data.unlocked = Math.min(LEVEL_COUNT, this.level + 1);
    p.flush();
    this.level = Math.min(LEVEL_COUNT, this.level + 1);
    this.startLevel(this.level);
  }

  async hintByAd() {
    const btn = /** @type {HTMLButtonElement} */ ($('gameHint'));
    btn.disabled = true;
    const ok = await poki.rewardedBreak('small');
    if (!ok) {
      btn.disabled = false;
      return;
    }
    const piece = this.scene.session ? this.scene.session.requestHint() : null;
    if (piece) {
      audio.star(0);
      this.toast(t('hintUsed'));
      btn.hidden = true;
    } else {
      btn.disabled = false;
    }
    // O intervalo parou o gameplay; se a fase continua, ele recomeca.
    if (this.scene.session && this.scene.session.state === 'playing') poki.gameplayStart();
  }

  async dailyByAd() {
    const btn = /** @type {HTMLButtonElement} */ ($('btnDaily'));
    btn.disabled = true;
    const ok = await poki.rewardedBreak('medium');
    if (ok) {
      const amount = 60 + this.progress.rank * 12;
      this.progress.addCoins(amount);
      this.progress.claimDaily();
      audio.coin(2);
      this.toast(`+${amount}`);
    }
    this.refreshScreen();
  }

  /**
   * Equipa uma skin e deixa a cena coerente com ela.
   * @param {string} skinId
   */
  useSkin(skinId) {
    this.progress.equipSkin(skinId);
    this.scene.skin = getSkin(skinId);
    if (this.scene.sprites) this.scene.sprites.clear();
  }

  /**
   * @param {string} skinId
   * @returns {Promise<void>}
   */
  async unlockSkinByAd(skinId) {
    const ok = await poki.rewardedBreak('large');
    if (!ok) return;
    this.progress.grantSkin(skinId);
    this.useSkin(skinId);
    audio.win();
    this.buildShop();
    this.refreshScreen();
  }

  // ----------------------------------------------------------------- mapa

  /**
   * Posicao de um no dentro do mundo, em porcentagem da caixa.
   *
   * A trilha serpenteia: o x descreve uma onda e meia ao longo dos dez nos, e o
   * y sobe do fundo para o topo - por isso o indice entra invertido. E a mesma
   * funcao que alimenta as posicoes dos botoes e o traçado do SVG, para que o
   * caminho passe exatamente pelo meio de cada no e nao ao lado.
   *
   * @param {number} i 0 a 9, de baixo para cima
   * @returns {{x:number, y:number}} em porcentagem
   */
  nodeSpot(i) {
    return {
      x: 50 + 27 * Math.sin((i / 9) * Math.PI * 3),
      y: 94 - (i / 9) * 88,
    };
  }

  buildMap() {
    const p = this.progress;
    const chave = [p.data.unlocked, getLang(), p.totalStars, this.level].join('|');
    const host = $('mapScroll');
    if (host.dataset.built === chave) return;
    host.dataset.built = chave;
    host.innerHTML = '';

    // Os mundos sao empilhados do ultimo para o primeiro, entao progredir e
    // subir na pagina - que e o que a animacao de troca de mundo encena.
    for (let w = WORLD_COUNT - 1; w >= 0; w--) {
      const sec = document.createElement('section');
      sec.className = 'world';
      sec.dataset.world = String(w);
      if (!p.worldOpen(w)) sec.classList.add('locked');

      const themeId = levelConfig(w * 10).theme;
      const head = document.createElement('div');
      head.className = 'world-head';
      head.textContent = `${t('world')} ${w + 1} - ${THEMES[themeId].label}`;
      sec.appendChild(head);

      const trilha = document.createElement('div');
      trilha.className = 'trail';

      // Traçado: uma polilinha suave pelos mesmos pontos dos nos.
      const pontos = [];
      for (let i = 0; i < 10; i++) pontos.push(this.nodeSpot(i));
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('class', 'trail-line');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      let d = `M ${pontos[0].x} ${pontos[0].y}`;
      for (let i = 1; i < pontos.length; i++) {
        const a2 = pontos[i - 1];
        const b2 = pontos[i];
        const my = (a2.y + b2.y) / 2;
        d += ` C ${a2.x} ${my}, ${b2.x} ${my}, ${b2.x} ${b2.y}`;
      }
      path.setAttribute('d', d);
      svg.appendChild(path);
      trilha.appendChild(svg);

      for (let i = 0; i < 10; i++) {
        const level = w * 10 + i + 1;
        const spot = pontos[i];
        const unlocked = p.isUnlocked(level);
        const stars = p.starsOf(level);
        const node = document.createElement('button');
        node.className = 'node' + (unlocked ? '' : ' locked') + (level === this.level ? ' current' : '');
        node.style.left = `${spot.x}%`;
        node.style.top = `${spot.y}%`;
        node.dataset.level = String(level);
        node.textContent = String(level);
        const pips = document.createElement('div');
        pips.className = 'pips';
        for (let k = 0; k < 3; k++) {
          const pip = document.createElement('i');
          if (k < stars) pip.classList.add('on');
          pips.appendChild(pip);
        }
        node.appendChild(pips);
        if (unlocked) {
          node.onclick = () => {
            audio.button();
            this.startLevel(level);
          };
        } else {
          node.setAttribute('aria-disabled', 'true');
        }
        trilha.appendChild(node);
      }
      sec.appendChild(trilha);
      host.appendChild(sec);
      // O portao entra DEPOIS do mundo que protege. Como a pilha desce do
      // mundo 10 para o 1, isso o coloca exatamente entre a ultima fase do
      // mundo anterior e a primeira deste - que e por onde o hexagono sobe.
      if (w > 0) host.appendChild(this.buildGate(w));
    }
  }

  /**
   * Encena a abertura de um mundo: rola ate o portao, abre e leva o hexagono
   * subindo pela trilha ate a primeira fase do mundo novo.
   *
   * Roda uma vez por mundo - o save guarda quais ja foram encenados.
   * @param {number} w
   */
  playWorldUnlock(w) {
    const host = $('mapScroll');
    const gate = host.querySelector(`.gate[data-world="${w}"]`);
    const de = host.querySelector(`.node[data-level="${w * 10}"]`);
    const para = host.querySelector(`.node[data-level="${w * 10 + 1}"]`);
    this.progress.markGateSeen(w);
    if (!gate || !de || !para) {
      this.scrollMapToCurrent();
      return;
    }

    gate.scrollIntoView({ block: 'center' });
    gate.classList.add('just-open');
    audio.star(1);

    const skinAtual = getSkin(this.progress.data.skin);
    const climber = document.createElement('div');
    climber.className = 'climber';
    climber.style.background = skinAtual.fill || 'rgba(190,240,255,0.3)';
    climber.style.border = `3px solid ${skinAtual.stroke || '#4fc8ff'}`;
    host.appendChild(climber);

    // Posicoes medidas na tela e convertidas para o sistema do container
    // rolavel, que e quem hospeda o hexagono.
    const rh = host.getBoundingClientRect();
    const ponto = (/** @type {Element} */ el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left - rh.left + host.scrollLeft + r.width / 2,
        y: r.top - rh.top + host.scrollTop + r.height / 2,
      };
    };
    const a0 = ponto(de);
    const meio = ponto(gate);
    const a1 = ponto(para);
    climber.style.left = `${a0.x}px`;
    climber.style.top = `${a0.y}px`;

    const anim = climber.animate(
      [
        { transform: 'translate(0,0) scale(1)' },
        { transform: `translate(${meio.x - a0.x}px, ${meio.y - a0.y}px) scale(1.15)`, offset: 0.5 },
        { transform: `translate(${a1.x - a0.x}px, ${a1.y - a0.y}px) scale(1)` },
      ],
      { duration: 1500, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
    );
    anim.onfinish = () => {
      audio.win();
      window.setTimeout(() => {
        climber.remove();
        gate.classList.remove('just-open');
        this.scrollMapToCurrent();
      }, 420);
    };
  }

  /** Centraliza o mapa na fase atual, sem animar se ja estiver perto. */
  scrollMapToCurrent() {
    const host = $('mapScroll');
    const node = host.querySelector('.node.current');
    if (!node) return;
    // offsetTop seria relativo a trilha, que e posicionada; o retangulo na tela
    // e o unico jeito confiavel de achar a posicao dentro do container rolavel.
    const rn = node.getBoundingClientRect();
    const rh = host.getBoundingClientRect();
    const alvo = host.scrollTop + (rn.top - rh.top) - host.clientHeight / 2 + rn.height / 2;
    const destino = Math.max(0, Math.min(host.scrollHeight - host.clientHeight, alvo));
    if (Math.abs(host.scrollTop - destino) < 4) return;
    host.scrollTop = destino;
  }

  /**
   * O portao entre dois mundos.
   * @param {number} w mundo que o portao protege
   * @returns {HTMLElement}
   */
  buildGate(w) {
    const p = this.progress;
    const faltam = p.starsToOpen(w);
    const gate = document.createElement('div');
    gate.className = 'gate' + (faltam > 0 ? '' : ' open');
    gate.dataset.world = String(w);

    const selo = document.createElement('div');
    selo.className = 'gate-seal';
    selo.innerHTML = faltam > 0 ? '&#128274;' : '&#10004;';
    gate.appendChild(selo);

    const txt = document.createElement('div');
    txt.className = 'gate-text';
    const forte = document.createElement('b');
    forte.innerHTML = `<i class="st"></i> ${p.totalStars} / ${gateStars(w)}`;
    txt.appendChild(forte);
    const sub = document.createElement('span');
    sub.textContent = faltam > 0 ? t('gateNeed', faltam) : t('gateOpen');
    txt.appendChild(sub);
    gate.appendChild(txt);

    // Quando falta estrela, o portao aponta onde busca-la: as fases ja jogadas
    // com estrela sobrando, da mais facil de melhorar para a mais dificil.
    if (faltam > 0) {
      const alvos = p.refillCandidates(3);
      if (alvos.length) {
        const lista = document.createElement('div');
        lista.className = 'gate-hint';
        for (const alvo of alvos) {
          const b = document.createElement('button');
          b.className = 'gate-jump';
          b.innerHTML = `${alvo.level} <i class="st${alvo.stars ? ' on' : ''}"></i>${'+' + (3 - alvo.stars)}`;
          b.onclick = () => {
            audio.button();
            this.startLevel(alvo.level);
          };
          lista.appendChild(b);
        }
        gate.appendChild(lista);
      }
    }
    return gate;
  }

  // ----------------------------------------------------------------- loja

  buildShop() {
    $('tabSkins').classList.toggle('on', this.shopTab === 'skins');
    $('tabUpgrades').classList.toggle('on', this.shopTab === 'upgrades');
    $('tabBoosts').classList.toggle('on', this.shopTab === 'boosts');
    const host = $('shopList');
    host.innerHTML = '';
    const p = this.progress;

    if (this.shopTab === 'skins') {
      for (const entry of p.skinCatalog()) {
        const s = entry.skin;
        const item = document.createElement('div');
        item.className = 'item';

        const swatch = document.createElement('div');
        swatch.className = 'swatch';
        swatch.style.background = s.fill || 'rgba(190,240,255,0.2)';
        swatch.style.border = `2px solid ${s.stroke || '#4fc8ff'}`;
        swatch.innerHTML = `<span style="width:16px;height:16px;border-radius:50%;background:${s.core || '#fff'}"></span>`;
        item.appendChild(swatch);

        const info = document.createElement('div');
        info.className = 'info';
        const name = document.createElement('b');
        name.textContent = s.name;
        const sub = document.createElement('span');
        if (entry.equipped) sub.textContent = t('equipped');
        else if (entry.owned) sub.textContent = t('owned');
        else if (entry.rankLocked) sub.textContent = t('unlockAt', s.rank);
        else if (s.rewarded) sub.textContent = t('watchAd');
        else sub.textContent = `${s.cost} ${t('coins')}`;
        info.appendChild(name);
        info.appendChild(sub);
        item.appendChild(info);

        const btn = document.createElement('button');
        if (entry.equipped) {
          btn.className = 'btn';
          btn.textContent = t('equipped');
          btn.disabled = true;
        } else if (entry.owned) {
          btn.className = 'btn primary';
          btn.textContent = t('equip');
          btn.onclick = () => {
            audio.button();
            this.useSkin(s.id);
            this.buildShop();
          };
        } else if (entry.rankLocked) {
          btn.className = 'btn';
          btn.textContent = t('locked');
          btn.disabled = true;
        } else if (s.rewarded) {
          // Duas rotas para a mesma recompensa: moedas ou video. A Poki pede
          // que o video nunca seja o unico caminho.
          const pair = document.createElement('div');
          pair.style.display = 'flex';
          pair.style.gap = '6px';
          const buy = document.createElement('button');
          buy.className = 'btn primary';
          buy.innerHTML = `<span style="color:var(--gold)">&#9679;</span> ${s.cost}`;
          buy.disabled = !entry.affordable;
          buy.onclick = () => {
            if (!p.spendCoins(s.cost)) {
              audio.denied();
              this.toast(t('notEnoughCoins'));
              return;
            }
            audio.coin(1);
            p.grantSkin(s.id);
            this.useSkin(s.id);
            this.buildShop();
            this.refreshScreen();
          };
          const watch = document.createElement('button');
          watch.className = 'btn ad';
          watch.textContent = t('watchAd');
          watch.onclick = () => this.unlockSkinByAd(s.id);
          pair.appendChild(buy);
          pair.appendChild(watch);
          item.appendChild(pair);
          host.appendChild(item);
          continue;
        } else {
          btn.className = 'btn primary';
          btn.innerHTML = `<span style="color:var(--gold)">&#9679;</span> ${s.cost}`;
          btn.disabled = !entry.affordable;
          btn.onclick = () => {
            if (!p.spendCoins(s.cost)) {
              audio.denied();
              this.toast(t('notEnoughCoins'));
              return;
            }
            audio.coin(1);
            p.grantSkin(s.id);
            this.useSkin(s.id);
            this.buildShop();
            this.refreshScreen();
          };
        }
        item.appendChild(btn);
        host.appendChild(item);
      }
      return;
    }

    if (this.shopTab === 'boosts') {
      for (const b of BOOSTS) {
        const restam = p.boostCount(b.id);
        const item = document.createElement('div');
        item.className = 'item';

        const swatch = document.createElement('div');
        swatch.className = 'swatch';
        swatch.style.background = 'var(--wash)';
        swatch.style.border = '2px solid var(--accent)';
        swatch.innerHTML = '<span style="font-size:18px">&#8646;</span>';
        item.appendChild(swatch);

        const info = document.createElement('div');
        info.className = 'info';
        const name = document.createElement('b');
        name.textContent = `${t(b.nameKey)}  x${restam}`;
        const sub = document.createElement('span');
        sub.textContent = t(b.descKey);
        info.appendChild(name);
        info.appendChild(sub);
        item.appendChild(info);

        const btn = document.createElement('button');
        btn.className = 'btn primary';
        btn.innerHTML = `<span style="color:var(--gold)">&#9679;</span> ${b.custo}`;
        btn.disabled = p.data.coins < b.custo;
        btn.onclick = () => {
          const r = p.buyBoost(b.id);
          if (!r.ok) {
            audio.denied();
            this.toast(t('notEnoughCoins'));
            return;
          }
          audio.coin(1);
          this.toast(`+${b.pacote} ${t(b.nameKey)}`);
          this.buildShop();
          this.refreshScreen();
        };
        item.appendChild(btn);
        host.appendChild(item);
      }
      return;
    }

    for (const u of UPGRADES) {
      const lvl = p.upgradeLevel(u.id);
      const maxed = lvl >= u.max;
      const cost = maxed ? 0 : u.costs[lvl];
      const item = document.createElement('div');
      item.className = 'item';

      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      swatch.style.background = 'rgba(51,225,255,0.14)';
      swatch.style.border = '2px solid rgba(51,225,255,0.5)';
      swatch.textContent = `${lvl}/${u.max}`;
      swatch.style.font = '700 13px/1 var(--font)';
      item.appendChild(swatch);

      const info = document.createElement('div');
      info.className = 'info';
      const name = document.createElement('b');
      name.textContent = t(u.nameKey);
      const sub = document.createElement('span');
      sub.textContent = t(u.descKey);
      const bars = document.createElement('div');
      bars.className = 'bars';
      for (let i = 0; i < u.max; i++) {
        const b = document.createElement('i');
        if (i < lvl) b.classList.add('on');
        bars.appendChild(b);
      }
      info.appendChild(name);
      info.appendChild(sub);
      info.appendChild(bars);
      item.appendChild(info);

      const btn = document.createElement('button');
      btn.className = maxed ? 'btn' : 'btn primary';
      btn.innerHTML = maxed ? t('maxLevel') : `<span style="color:var(--gold)">&#9679;</span> ${cost}`;
      btn.disabled = maxed || p.data.coins < cost;
      btn.onclick = () => {
        const res = p.buyUpgrade(u.id);
        if (!res.ok) {
          audio.denied();
          this.toast(t('notEnoughCoins'));
          return;
        }
        audio.coin(3);
        this.buildShop();
        this.refreshScreen();
      };
      item.appendChild(btn);
      host.appendChild(item);
    }
  }

  // -------------------------------------------------------------- ajustes

  buildSettings() {
    /**
     * @param {string} id
     * @param {{label:string, value:string}[]} options
     * @param {string} current
     * @param {(v:string)=>void} onPick
     */
    const seg = (id, options, current, onPick) => {
      const host = document.getElementById(id);
      if (!host) return;
      host.innerHTML = '';
      for (const o of options) {
        const b = document.createElement('button');
        b.textContent = o.label;
        if (o.value === current) b.classList.add('on');
        b.onclick = () => {
          audio.unlock();
          audio.button();
          onPick(o.value);
          this.buildSettings();
        };
        host.appendChild(b);
      }
    };
    const onOff = [
      { label: t('yes'), value: 'on' },
      { label: t('no'), value: 'off' },
    ];
    seg('segSound', onOff, audio.sfxOn ? 'on' : 'off', (v) => audio.setSfx(v === 'on'));
    seg('segMusic', onOff, audio.musicOn ? 'on' : 'off', (v) => audio.setMusic(v === 'on'));
    seg(
      'segQuality',
      [
        { label: t('qualityAuto'), value: 'auto' },
        { label: t('qualityHigh'), value: 'high' },
        { label: t('qualityLow'), value: 'low' },
      ],
      this.quality,
      (v) => {
        this.quality = v;
        save('quality', v);
        this.applyQuality();
      },
    );
    seg(
      'segLang',
      LANGS.map((l) => ({ label: LANG_NAMES[l], value: l })),
      getLang(),
      (v) => setLang(v),
    );
  }

  applyQuality() {
    let mode = this.quality;
    if (mode === 'auto') {
      const small = Math.min(window.innerWidth, window.innerHeight) < 420;
      mode = small || (navigator.hardwareConcurrency || 4) <= 4 ? 'low' : 'high';
    }
    this.scene.quality = mode;
    this.scene.refit();
  }

  /** @param {string} text */
  toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('show'), 1900);
  }
}

const game = new Game();
game.boot().catch((err) => {
  poki.captureError(err instanceof Error ? err : new Error(String(err)));
  $('loader').classList.add('gone');
});

// Ganchos usados pela automacao de teste em tools/.
/** @type {*} */ (window).__game = game;
/** @type {*} */ (window).__audio = audio;
