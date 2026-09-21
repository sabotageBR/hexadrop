/**
 * Hexa Drop - controlador do jogo.
 *
 * Este arquivo e o unico lugar que decide telas, progressao e quando falar com
 * o Poki SDK. A fisica, o desenho e as regras de fase vivem em modulos proprios
 * e sao os mesmos usados pelos prototipos.
 */

import { GameScene } from './game/scene.js';
import { createSession } from './game/session.js';
import {
  levelConfig, LEVEL_COUNT, WORLD_THEMES, WORLD_COUNT, worldOf, worldStart, worldSize,
  indexInWorld,
} from './game/levelgen.js';
import { LEVELS } from './game/levels.gen.js';
import { Progress } from './game/progress.js';
import {
  UPGRADES, BOOSTS, gateStars, xpForRank, skin as getSkin, BONUS_COINS_PER_PIECE,
} from './game/content.js';
import { THEMES } from './render/themes.js';
import { applyUiTheme } from './render/uitheme.js';
import { paintHexModel } from './render/hexmodels.js';
import { material as getMaterial } from './physics/materials.js';
import { audio } from './core/audio.js';
import { poki } from './poki.js';
import { PLATAFORMA, COM_ANUNCIOS } from './core/platform.js';
import { t, getLang, setLang, LANGS, LANG_NAMES, onLangChange } from './core/i18n.js';
import { load, save, isPersistent } from './core/storage.js';
import { Rng } from './core/rng.js';

/** Margens que a HUD de jogo reserva no enquadramento da cena. */
const GAME_INSET_TOP = 108;
const GAME_INSET_BOTTOM = 40;

/**
 * Fases vencidas antes do primeiro intervalo comercial.
 *
 * A frequencia dos intervalos e da Poki, mas o comeco do jogo e nosso. Com o
 * intervalo liberado desde a fase 1, o anuncio chegava justo quando o jogador
 * ainda decidia se o jogo valia a pena - e era ali que ele saia. Conta o
 * progresso salvo, nao a sessao: quem volta ja passou dessa decisao.
 */
const FASES_SEM_INTERVALO = 5;

/**
 * Quanto tempo o selo de recompensa fica sobre a cena antes do corte, e quanto
 * dura o corte - igual a transicao de .wipe no CSS.
 *
 * Dentro de um mundo, vencer nao abre tela: a fase seguinte entra sozinha
 * atras desse corte. A fronteira de mundo continua sendo WORLD_SIZES, a unica
 * fonte de verdade sobre isso - e e la que o cartao ainda tem trabalho a
 * fazer, porque e onde o tema, a musica, o portao e o video de dobrar
 * recompensa entram.
 */
const FLOW_SEAL_MS = 1000;
const WIPE_MS = 200;

/** Trilha sonora por tema. */
const MUSIC = {
  puzzle: { scale: [0, 2, 4, 7, 9], root: 2, bpm: 112, type: 'triangle', bass: 'sine', pad: 'triangle', motif: [0, 2, 4, 1] },
  neon: { scale: [0, 3, 5, 7, 10], root: -5, bpm: 104, type: 'sawtooth', bass: 'square', pad: 'sawtooth', motif: [0, 3, 1, 4] },
  futuristic: { scale: [0, 2, 3, 7, 9], root: -7, bpm: 96, type: 'square', bass: 'triangle', pad: 'triangle', motif: [0, 4, 2, 1] },
  rustic: { scale: [0, 2, 4, 7, 9], root: -9, bpm: 84, type: 'triangle', bass: 'sine', pad: 'sine', motif: [0, 1, 3, 2], hat: false },
  classic: { scale: [0, 2, 4, 7, 11], root: -4, bpm: 92, type: 'sine', bass: 'sine', pad: 'sine', motif: [0, 2, 4, 3] },
  candy: { scale: [0, 2, 4, 7, 9], root: 0, bpm: 118, type: 'triangle', bass: 'sine', pad: 'triangle', motif: [0, 2, 5, 3] },
  ice: { scale: [0, 2, 3, 7, 10], root: -2, bpm: 76, type: 'sine', bass: 'triangle', pad: 'sine', motif: [0, 4, 1, 5], hat: false },
  lava: { scale: [0, 1, 5, 7, 8], root: -12, bpm: 88, type: 'sawtooth', bass: 'square', pad: 'square', motif: [0, 1, 4, 2] },
  paper: { scale: [0, 2, 5, 7, 9], root: -7, bpm: 100, type: 'triangle', bass: 'triangle', pad: 'sine', motif: [0, 3, 2, 4], hat: false },
};

/**
 * Trilha da tela inicial.
 *
 * Nao e a de nenhum mundo. Antes a home herdava a musica do mundo em cartaz, e
 * deslizar o carrossel trocava a trilha: a identidade sonora do jogo dependia
 * de onde o jogador tinha parado. Com tema proprio, a home soa sempre igual e
 * entrar numa fase passa a ter uma troca que se percebe.
 */
const MAIN_THEME = {
  scale: [0, 2, 4, 7, 9],
  root: -3,
  bpm: 88,
  type: 'triangle',
  bass: 'sine',
  pad: 'triangle',
  motif: [0, 2, 4, 1],
};

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));

class Game {
  constructor() {
    this.progress = new Progress();
    /**
     * Fluxo continuo entre fases. A automacao desliga: com o cartao de volta,
     * o playsweep mede uma fase por vez em vez de correr atras do avanco.
     */
    this.flowLevels = true;
    /** Temporizador do selo de recompensa; zero quando nao ha transicao. */
    this.flowTimer = 0;
    /** true entre o fim do selo e a fase seguinte estar no ar. */
    this.advancing = false;
    this.rng = new Rng(Date.now() & 0x7fffffff);
    this.canvas = /** @type {HTMLCanvasElement} */ ($('game'));
    this.scene = new GameScene(this.canvas, { topInset: GAME_INSET_TOP, bottomInset: GAME_INSET_BOTTOM });
    /** @type {string} */
    this.screen = '';
    this.level = Math.min(LEVEL_COUNT, this.progress.data.unlocked);
    this.lossStreak = 0;
    this.lastResult = null;
    /** Vitoria esperando o fim da celebracao para ser gravada. */
    /** @type {{stars:number, won:boolean}|null} */
    this.pendingWin = null;
    this.quality = load('quality', 'auto');
    this.shopTab = 'skins';
    this.toastTimer = 0;
    this.tutTimer = 0;
    this.pendingHeart = false;
    this.homeWorld = worldOf(this.level - 1);
    this.homeSwiped = false;
    /** @type {IntersectionObserver|null} Vigia qual mundo esta na tela no mapa. */
    this._mapObs = null;
  }

  // ---------------------------------------------------------------- boot

  async boot() {
    this.bindUi();
    this.applyLang();
    this.applyQuality();
    // A folha de estilo esconde os botoes de video pela raiz: na versao lisa
    // nao existe video, e um botao que promete recompensa e nao entrega e pior
    // do que nao ter botao.
    document.documentElement.dataset.plataforma = PLATAFORMA;
    // A logo muda a altura da faixa de cima quando chega: sem reenquadrar, a
    // torre da home fica desalinhada ate o primeiro resize.
    const logo = /** @type {HTMLImageElement|null} */ (document.getElementById('homeLogo'));
    if (logo && !logo.complete) logo.addEventListener('load', () => this.fitHomeScene());

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
    // O reenquadramento da home vem depois do refit da cena, senao mede o
    // layout antigo.
    window.addEventListener('resize', () => {
      window.requestAnimationFrame(() => this.fitHomeScene());
    });
  }

  bindHomeSwipe() {
    const el = $('s-home');
    let x0 = 0;
    let y0 = 0;
    let armado = false;
    el.addEventListener('pointerdown', (e) => {
      // Sem a bandeira, apertar um botao guardava a origem do gesto anterior:
      // o pointerup do botao virava um deslize e trocava de mundo sozinho.
      armado = !(/** @type {HTMLElement} */ (e.target).closest('button'));
      x0 = e.clientX;
      y0 = e.clientY;
    });
    el.addEventListener('pointerup', (e) => {
      const valia = armado;
      armado = false;
      if (!valia || this.screen !== 'home') return;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return;
      const dir = dx < 0 ? 1 : -1;
      let w = this.homeWorld + dir;
      while (w >= 0 && w < WORLD_COUNT && !this.progress.worldOpen(w)) w += dir;
      if (w >= 0 && w < WORLD_COUNT) this.previewWorld(w);
    });
  }

  // -------------------------------------------------------------- telas

  /** @param {string} name */
  show(name) {
    // Sair da tela de jogo por qualquer caminho fecha o contador da
    // celebracao e o selo do fluxo: os dois vivem sobre a cena, nao sobre o
    // menu.
    if (name !== 'game') {
      this.hideBonusCounter();
      this.hideFlowSeal();
    }
    // A folha de estilo precisa saber qual tela esta no ar: em paisagem baixa
    // a cena de fundo da home cede lugar para a logo.
    document.documentElement.dataset.tela = name;
    for (const el of document.querySelectorAll('.screen')) el.classList.remove('on');
    const el = document.getElementById('s-' + name);
    if (el) el.classList.add('on');
    this.screen = name;
    if (name !== 'game') {
      const tut = $('tut');
      if (tut) tut.classList.add('hide');
    }
    this.refreshScreen();
    // O enquadramento da home depende da altura real do titulo e da pilha de
    // botoes, que so existe depois que a tela entra no layout.
    if (name === 'home') {
      window.requestAnimationFrame(() => this.fitHomeScene());
    }
    // No mobile, afasta o botao flutuante da Poki da HUD do topo.
    poki.movePill(name === 'game' ? 0 : 0, name === 'game' ? 64 : 24);
  }

  /**
   * Enquadra a cena de fundo da home na faixa livre entre o titulo e os botoes.
   *
   * A home reserva faixas diferentes das do jogo: em cima o nome do jogo, em
   * baixo o mundo em cartaz, os botoes e o rodape de patente. Medir os blocos
   * de verdade, em vez de cravar numeros, e o que impede a torre de voltar a
   * ficar atras deles quando a tela muda de tamanho ou o idioma muda o texto.
   */
  fitHomeScene() {
    if (this.screen !== 'home') return;
    const topo = document.getElementById('homeTop');
    const base = document.getElementById('homeBase');
    if (!topo || !base) return;
    const rt = topo.getBoundingClientRect();
    const rb = base.getBoundingClientRect();
    if (rt.height <= 0 || rb.height <= 0) return;
    const alto = Math.round(rt.bottom + 14);
    const baixo = Math.round(window.innerHeight - rb.top + 18);
    this.scene.setInsets(Math.max(60, alto), Math.max(30, baixo), true);
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
    for (const id of ['homeCoins', 'mapCoins', 'shopCoins', 'gameCoins']) {
      const el = document.getElementById(id);
      if (el) el.textContent = coins;
    }
    $('homeRank').textContent = String(p.rank);
    $('homeStars').textContent = String(p.totalStars);
    // O teto sai da contagem de fases: cravado no HTML, ele mentia assim que o
    // jogo ganhou fases novas.
    $('homeStarsMax').textContent = '/' + LEVEL_COUNT * 3;
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
    if (this.screen === 'home') this.buildHomeWorlds();
    const daily = $('btnDaily');
    if (daily) {
      daily.textContent = p.dailyReady ? t('dailyBonus') : t('comeBackTomorrow');
      /** @type {HTMLButtonElement} */ (daily).disabled = !p.dailyReady;
      // Na versao lisa o bonus diario continua existindo, sem video: como
      // `.btn.ad` some por CSS ali, manter a classe apagava o rodape do mapa.
      daily.classList.toggle('ad', COM_ANUNCIOS);
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
    const gear = document.getElementById('btnSettings');
    if (gear) gear.setAttribute('aria-label', t('settings'));
    set('rankLabel', t('playerLevel'));
    set('mapTitle', t('levels'));
    set('shopTitle', t('shop'));
    set('tabSkins', t('skins'));
    set('tabUpgrades', t('upgrades'));
    set('tabBoosts', t('boosts'));
    set('winNext', t('next'));
    set('winPurseLbl', t('coins'));
    set('winRetry', t('retry'));
    set('winHome', t('home'));
    set('winDouble', t('doubleReward'));
    set('winCoinsLbl', t('rewardCoins'));
    set('winXpLbl', t('rewardXp'));
    set('loseTitle', t('gameOver'));
    set('loseRetry', t('retry'));
    set('loseShuffle', t('shuffle'));
    set('loseHome', t('home'));
    set('loseSkip', t('skipLevel'));
    set('pauseTitle', t('paused'));
    set('pauseResume', t('resume'));
    set('pauseSoundLbl', t('sound'));
    set('pauseMusicLbl', t('music'));
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
      this.startLevel(this.homeTarget());
    };
    $('homeWorldDots').onclick = (ev) => {
      const btn = ev.target && /** @type {HTMLElement} */ (ev.target).closest('button[data-world]');
      if (!btn) return;
      audio.unlock();
      this.previewWorld(Number(btn.dataset.world));
    };
    this.bindHomeSwipe();
    $('btnMap').onclick = go('map');
    $('btnShop').onclick = go('shop');
    $('btnSettings').onclick = go('settings');
    $('mapBack').onclick = () => {
      audio.buttonBack();
      this.show('home');
    };
    // Numa fita de quinze mundos a fase atual sai da tela em dois gestos; o
    // atalho so aparece quando ela sumiu, para nao virar enfeite fixo.
    $('mapHere').onclick = () => {
      audio.button();
      this.scrollMapToCurrent();
    };
    $('mapScroll').addEventListener('scroll', () => this.updateMapHere(), { passive: true });
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
    $('pauseSound').onclick = () => {
      audio.setSfx(!audio.sfxOn);
      audio.button();
      this.buildPause();
      this.buildSettings();
    };
    $('pauseMusic').onclick = () => {
      audio.setMusic(!audio.musicOn);
      audio.button();
      this.buildPause();
      this.buildSettings();
    };
    $('pauseRestart').onclick = () => {
      audio.button();
      this.retry(true);
    };
    $('pauseHome').onclick = () => this.quitLevel();

    $('winNext').onclick = () => this.nextLevel();
    $('winRetry').onclick = () => this.retry(false);
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
      this.homeWorld = 0;
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
        onCombo: (n, x, y) => this.onCombo(n, x, y),
        onBonusPiece: (done, total, x, y) => this.onBonusPiece(done, total, x, y),
        onBonusDone: () => this.finishWin(),
      },
    });
    session.par = variant[1];
    return { session, theme: config.theme };
  }

  /** Cena de fundo do menu: uma fase real do mundo em preview. */
  showAmbient() {
    const w = Math.max(0, Math.min(WORLD_COUNT - 1, this.homeWorld | 0));
    // Meio do mundo: a torre ja esta cheia o bastante para virar cenario.
    const level = Math.min(LEVEL_COUNT, worldStart(w) + Math.ceil(worldSize(w) / 2) + 1);
    const { session, theme } = this.makeSession(level);
    session.onEnd = null;
    session.onStar = null;
    session.onFirstTap = null;
    session.onCombo = null;
    session.onBonusPiece = null;
    session.onBonusDone = null;
    this.scene.load(session, theme, getSkin(this.progress.data.skin));
    applyUiTheme(this.scene.theme);
    // A trilha da home e sempre a mesma; so o cenario muda com o carrossel.
    audio.setMusic_(MAIN_THEME);
    audio.releaseMusic();
    this.buildHomeWorlds();
    this.fitHomeScene();
  }

  /**
   * Fase que o botao de jogar abre: a atual, ou a primeira do mundo que o
   * jogador esta olhando no carrossel. O rotulo le daqui tambem - senao o
   * botao dizia "Jogar 100" e comecava a fase 61.
   * @returns {number}
   */
  homeTarget() {
    const w = Math.max(0, Math.min(WORLD_COUNT - 1, this.homeWorld | 0));
    if (w === worldOf(this.level - 1)) return this.level;
    const first = worldStart(w) + 1;
    return this.progress.isUnlocked(first) ? first : this.level;
  }

  /** Bolinhas do carrossel de mundos na tela inicial. */
  buildHomeWorlds() {
    const host = $('homeWorldDots');
    const label = $('homeWorld');
    const play = $('btnPlay');
    // O rotulo do botao sai daqui, e nao de refreshScreen: deslizar o
    // carrossel nao passa por la, e o botao ficava dizendo a fase do mundo
    // anterior enquanto abria a primeira fase do mundo em cartaz.
    if (play) play.textContent = `${t('play')}  ${this.homeTarget()}`;
    if (!host) return;
    const w = Math.max(0, Math.min(WORLD_COUNT - 1, this.homeWorld | 0));
    const themeId = levelConfig(worldStart(w)).theme;
    if (label) label.textContent = `${t('world')} ${w + 1} · ${THEMES[themeId].label}`;
    if (host.childElementCount !== WORLD_COUNT) {
      host.innerHTML = '';
      for (let i = 0; i < WORLD_COUNT; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.world = String(i);
        host.appendChild(b);
      }
    }
    let abertos = 0;
    for (let i = 0; i < host.children.length; i++) {
      const b = /** @type {HTMLButtonElement} */ (host.children[i]);
      const aberto = this.progress.worldOpen(i);
      if (aberto) abertos++;
      b.classList.toggle('on', i === w);
      b.classList.toggle('locked', !aberto);
      b.setAttribute('aria-label', `${t('world')} ${i + 1}`);
    }
    // A dica some assim que o gesto e descoberto: repetir vira ruido.
    const dica = $('homeSwipeHint');
    if (dica) dica.textContent = abertos > 1 && !this.homeSwiped ? t('swipeWorlds') : '';
  }

  /** @param {number} world */
  previewWorld(world) {
    const w = Math.max(0, Math.min(WORLD_COUNT - 1, world | 0));
    if (!this.progress.worldOpen(w)) {
      this.toast(t('gateLocked'));
      return;
    }
    if (w === this.homeWorld) return;
    this.homeWorld = w;
    this.homeSwiped = true;
    audio.button();
    this.showAmbient();
  }

  /** @param {number} level */
  startLevel(level, variantIndex) {
    // Fecha o gameplay anterior antes de abrir o proximo: a Poki reprova
    // gameplayStart repetido sem um gameplayStop entre eles.
    poki.gameplayStop();
    this.cancelFlow();
    const mudouDeFase = this.level !== Math.max(1, Math.min(LEVEL_COUNT, level));
    this.level = Math.max(1, Math.min(LEVEL_COUNT, level));
    if (mudouDeFase) this.lossStreak = 0;
    this.paused = false;
    this.pendingHeart = true;
    this.pendingWin = null;
    this.hideBonusCounter();
    const { session, theme } = this.makeSession(this.level, variantIndex);
    this.scene.setInsets(GAME_INSET_TOP, GAME_INSET_BOTTOM, false);
    this.scene.load(session, theme, getSkin(this.progress.data.skin));
    applyUiTheme(this.scene.theme);
    audio.setMusic_(MUSIC[theme] || MUSIC.neon);
    audio.releaseMusic();
    this.setStars('gameStars', 0);
    const themeId = levelConfig(this.level - 1).theme;
    $('gameLevel').textContent = `${THEMES[themeId].label} · ${this.level}`;
    this.homeWorld = worldOf(this.level - 1);
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
    // Uma vitoria so termina uma vez. Durante a celebracao a torre se desfaz e
    // o hexagono desce - se o veredito for lido de novo no meio disso, a
    // segunda chamada recomeca a contagem com a torre ja vazia e apaga o
    // premio que o jogador tinha acabado de fazer.
    if (this.pendingWin || this.screen !== 'game') return;
    poki.gameplayStop();
    const session = this.scene.session;
    if (!session) return;
    const stars = session.stars;
    const completed = state === 'won' || (state === 'stuck' && stars >= 1);

    if (completed) {
      this.lossStreak = 0;
      poki.measure('level', String(this.level), 'complete');
      // O resultado so e gravado depois da celebracao: as pecas que sobraram
      // fazem parte do premio, e a contagem delas acontece no canvas, antes do
      // cartao entrar.
      this.pendingWin = { stars, won: state === 'won' };
      const sobraram = session.startBonus();
      if (sobraram > 0) this.showBonusCounter(sobraram);
      else window.setTimeout(() => this.finishWin(), 700);
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
  /** Fecha a fase depois que a celebracao terminou. */
  finishWin() {
    const session = this.scene.session;
    const pend = this.pendingWin;
    if (!session || !pend) return;
    this.pendingWin = null;
    const result = this.progress.finishLevel({
      level: this.level,
      stars: pend.stars,
      won: pend.won,
      taps: session.taps,
      par: session.par || 0,
      bonusPieces: session.bonusTotal,
      comboScore: session.comboScore,
      comboPieces: session.comboPieces,
    });
    this.lastResult = result;
    // Dentro de um mundo o jogo nao para: o premio vira um selo sobre a cena e
    // a fase seguinte entra sozinha. Quem reabilita os botoes do HUD nesse
    // caminho e o hideBonusCounter() de startLevel, no fim da transicao.
    if (this.flowContinues()) {
      // A contagem sai e o selo entra no mesmo lugar: sao o mesmo recado em
      // dois tempos, e empilhados viravam duas caixas sobre a torre.
      this.hideBonusCounter(false);
      this.flowToNext(result, session);
      return;
    }
    this.hideBonusCounter();
    this.showWin(pend.stars, result, session);
  }

  /** Fase que fecha um mundo: e onde o cartao de fim de fase ainda para. */
  atWorldEnd() {
    const i = this.level - 1;
    return indexInWorld(i) === worldSize(worldOf(i)) - 1;
  }

  /**
   * A fase seguinte entra sozinha?
   *
   * Nao entra no fim de um mundo nem na ultima fase do jogo: sao as duas
   * paradas que valem um cartao, e a fronteira sai de WORLD_SIZES, nao de um
   * "10" cravado aqui. E nao entra quando a automacao desliga o fluxo.
   * @returns {boolean}
   */
  flowContinues() {
    if (!this.flowLevels) return false;
    if (this.level >= LEVEL_COUNT) return false;
    return !this.atWorldEnd();
  }

  /**
   * Fluxo continuo: mostra o recibo da fase sobre a cena e agenda a seguinte.
   *
   * Tudo que o cartao dizia continua sendo dito, so nao em tela cheia - as
   * estrelas na fileira do HUD, as moedas no selo e no contador do topo, e o
   * resto (recorde, patente, premio pela metade) nos toasts que o jogo ja usa
   * em qualquer outra tela. O que nao cabe no selo e o video de dobrar
   * recompensa: ele exige um botao padrao do mesmo tamanho ao lado, e um par
   * de botoes e o cartao de volta. Ele fica no fim de mundo.
   *
   * @param {*} result
   * @param {*} session
   */
  flowToNext(result, session) {
    audio.win();
    const box = $('flowSeal');
    const moedas = result.coins + (result.bonusCoins || 0);
    $('flowCoins').textContent = moedas > 0 ? `+${moedas}` : '';
    // De onde veio o extra, com o mesmo texto do cartao: peca intacta e combo
    // sao coisas que o jogador pode repetir de proposito na fase seguinte.
    const sobraram = session && session.bonusTotal ? session.bonusTotal : result.bonusPieces || 0;
    const partes = [];
    if (sobraram > 0) partes.push(`${t('bonusIntact')} x${sobraram}`);
    if (session && session.bestCombo > 1) partes.push(`${t('combo')} x${session.bestCombo}`);
    $('flowWhat').textContent = partes.join('  \u00b7  ');
    box.hidden = false;

    // As moedas pousam no contador do HUD, nao numa bolsa de cartao: o premio
    // fica onde o jogador vai continuar olhando.
    const bolsaAntes = this.progress.data.coins - moedas;
    this.flyCoins($('flowCoins'), Math.min(12, Math.max(4, Math.round(moedas / 3))), 200, $('gameCoins'));
    this.countUp($('gameCoins'), this.progress.data.coins, 260, false, bolsaAntes);

    if (result.halved) this.toast(t('noHeartsBody'));
    else if (result.best) this.toast(t('newRecord'));
    if (result.rankUp) {
      window.setTimeout(() => this.toast(`${t('playerLevel')} ${this.progress.rank}`), 700);
    }

    window.clearTimeout(this.flowTimer);
    this.flowTimer = window.setTimeout(() => this.advanceLevel(), FLOW_SEAL_MS);
  }

  /** Esconde o selo do fluxo. */
  hideFlowSeal() {
    const box = document.getElementById('flowSeal');
    if (box) box.hidden = true;
  }

  /** Cancela uma transicao em curso e devolve a tela ao estado normal. */
  cancelFlow() {
    window.clearTimeout(this.flowTimer);
    this.flowTimer = 0;
    this.advancing = false;
    this.hideFlowSeal();
    const wipe = document.getElementById('wipe');
    if (wipe) wipe.classList.remove('on');
  }

  /**
   * Leva o jogador para a fase seguinte, com ou sem cartao antes.
   *
   * A ordem aqui e obrigatoria: o intervalo comercial tem que terminar ANTES
   * de startLevel, porque startLevel dispara measure('level', N, 'start') e a
   * Poki nao aceita evento nenhum dentro de um intervalo. E passa pelo
   * commercialBreak() da classe, nao pelo do poki, senao pula a carencia.
   */
  async advanceLevel() {
    this.flowTimer = 0;
    this.advancing = true;
    const target = this.level + 1;
    this.level = target;
    await this.commercialBreak();
    // O corte cobre o quadro em que a cena e remontada: sobe, troca a fase
    // escondido e desce sobre a torre nova. Quem baixa a cortina e o
    // cancelFlow() de startLevel, ja com a fase nova montada.
    $('wipe').classList.add('on');
    await new Promise((resolve) => window.setTimeout(resolve, WIPE_MS));
    this.startLevel(target);
  }

  /**
   * Mostra o painel de contagem da celebracao.
   * @param {number} total
   */
  showBonusCounter(total) {
    const box = $('bonusBox');
    if (!box) return;
    void total;
    $('bonusLabel').textContent = t('bonusIntact');
    // Comeca em zero e SOBE a cada estouro. Contar para baixo dava a sensacao
    // de algo acabando; contar para cima e o placar crescendo, que e o que faz
    // o jogador querer deixar mais pecas na proxima vez.
    $('bonusCount').textContent = '0';
    $('bonusGain').textContent = '';
    box.hidden = false;
    // Durante a celebracao o jogador nao sai nem pausa: a fase ja acabou, e o
    // premio so e gravado quando a contagem termina.
    /** @type {HTMLButtonElement} */ ($('gameBack')).disabled = true;
    /** @type {HTMLButtonElement} */ ($('gamePause')).disabled = true;
  }

  /**
   * @param {boolean} [reabilitar] devolve o HUD ao jogador; falso no fluxo
   *   continuo, onde a contagem sai de cena mas a fase ainda vai trocar
   */
  hideBonusCounter(reabilitar = true) {
    const box = $('bonusBox');
    if (box) box.hidden = true;
    if (!reabilitar) return;
    /** @type {HTMLButtonElement} */ ($('gameBack')).disabled = false;
    /** @type {HTMLButtonElement} */ ($('gamePause')).disabled = false;
  }

  /**
   * Uma peca da celebracao estourou.
   * @param {number} done
   * @param {number} total
   * @param {number} [x] em metros
   * @param {number} [y]
   */
  onBonusPiece(done, total, x, y) {
    audio.bonusPop(done, total);
    const count = $('bonusCount');
    if (count) {
      count.textContent = String(done);
      count.classList.remove('pop');
      // Reinicia a animacao: sem o reflow o navegador ignora a reaplicacao.
      void count.offsetWidth;
      count.classList.add('pop');
    }
    const gain = $('bonusGain');
    if (gain) gain.textContent = `+${done * BONUS_COINS_PER_PIECE}`;
    this.scene.camera.addTrauma(0.1 + (done / Math.max(1, total)) * 0.14);
    if (x !== undefined && y !== undefined) {
      this.floatText(`+${BONUS_COINS_PER_PIECE}`, x, y, 'coin');
    }
  }

  /**
   * Combo fechado: mais de uma peca caiu pelo mesmo toque.
   * @param {number} n
   * @param {number} x em metros
   * @param {number} y
   */
  onCombo(n, x, y) {
    audio.combo(n);
    this.scene.camera.addTrauma(Math.min(0.42, 0.1 + n * 0.05));
    this.floatText(`${t('combo')} x${n}`, x, y, 'combo');
  }

  /**
   * Texto que sobe e some, ancorado num ponto do mundo.
   * @param {string} text
   * @param {number} wx em metros
   * @param {number} wy
   * @param {string} kind
   */
  floatText(text, wx, wy, kind) {
    const [sx, sy] = this.scene.camera.toScreen(wx, wy);
    if (!isFinite(sx) || !isFinite(sy)) return;
    const el = document.createElement('div');
    el.className = `floater ${kind}`;
    el.textContent = text;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    document.body.appendChild(el);
    el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 },
        { transform: 'translate(-50%, -110%) scale(1.1)', opacity: 1, offset: 0.25 },
        { transform: 'translate(-50%, -220%) scale(1)', opacity: 0 },
      ],
      { duration: 700, easing: 'cubic-bezier(0.2,0.7,0.3,1)', fill: 'forwards' },
    ).onfinish = () => el.remove();
  }

  showWin(stars, result, session) {
    audio.win();
    // No fim de um mundo o cartao fecha um capitulo, e nao uma fase; a ultima
    // fase do jogo tambem cai aqui, e ali "vitoria" e o que se quer dizer.
    $('winTitle').textContent =
      this.atWorldEnd() && this.level < LEVEL_COUNT ? t('worldClear') : t('victory');
    this.setStars('winStars', 0);
    $('winCoins').textContent = '0';
    $('winXp').textContent = '0';
    $('winNote').textContent = result.halved ? t('noHeartsBody') : result.best ? t('newRecord') : '';
    // Linha de bonus: so aparece quando houve merito a mostrar, e diz de onde
    // veio - senao o jogador ve uma moeda a mais e nao sabe por que.
    const bonusEl = $('winBonus');
    const sobraram = session && session.bonusTotal ? session.bonusTotal : result.bonusPieces || 0;
    const ganho = (result.bonusCoins || 0) + (result.bonusXp || 0);
    if (bonusEl) {
      if (ganho > 0) {
        const partes = [];
        if (sobraram > 0) partes.push(`${t('bonusIntact')} x${sobraram}`);
        if (session && session.bestCombo > 1) partes.push(`${t('combo')} x${session.bestCombo}`);
        $('winBonusLbl').textContent = t('bonusTitle');
        $('winBonusWhat').textContent = partes.join('  \u00b7  ');
        $('winBonusValue').textContent = `+${result.bonusCoins}`;
        bonusEl.hidden = false;
      } else {
        bonusEl.hidden = true;
      }
    }
    const next = this.level >= LEVEL_COUNT ? t('home') : t('next');
    $('winNext').textContent = next;
    $('winRetry').textContent = t('retry');
    // Tentar de novo so vale enquanto ha o que melhorar: com as tres estrelas
    // o botao nao leva a lugar nenhum e ainda divide a fileira com "proxima",
    // que e para onde o jogador quer ir. Sem ele, "proxima" cresce sozinha e
    // ocupa a fileira inteira - a regra `.card .row .btn` ja e `flex: 1 1`.
    $('winRetry').hidden = stars >= 3;
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
    const moedas = result.coins + (result.bonusCoins || 0);
    const bolsaAntes = this.progress.data.coins - moedas;
    $('winPurse').textContent = String(bolsaAntes);
    this.countUp($('winCoins'), result.coins, 180 * stars + 120, true);
    this.flyCoins($('winCoins'), Math.min(12, Math.max(4, Math.round(moedas / 3))), 180 * stars + 160);
    this.countUp($('winXp'), result.xp, 180 * stars + 260, false);
    this.countUp($('winPurse'), this.progress.data.coins, 180 * stars + 700, false, bolsaAntes);
    if (result.rankUp) {
      window.setTimeout(() => this.toast(`${t('playerLevel')} ${this.progress.rank}`), 900);
    }
  }

  /**
   * Lanca moedas do bloco de recompensa ate um contador.
   * @param {HTMLElement} from
   * @param {number} count
   * @param {number} delay
   * @param {HTMLElement} [target] contador de destino; a bolsa do cartao por padrao
   */
  flyCoins(from, count, delay, target = $('winPurse')) {
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
  countUp(el, target, delay, sound, from = 0) {
    window.setTimeout(() => {
      const span = target - from;
      const steps = Math.min(18, Math.max(1, Math.abs(span)));
      let i = 0;
      const timer = window.setInterval(() => {
        i++;
        el.textContent = String(Math.round(from + (span * i) / steps));
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
    // Embaralhar: so faz sentido quando a fase tem mais de um layout aprovado.
    // Cinco das cem tem um so; ali o botao nao aparece em vez de gastar um
    // consumivel para devolver a mesma coisa.
    const shuffle = /** @type {HTMLButtonElement} */ ($('loseShuffle'));
    const restam = p.boostCount('shuffle');
    shuffle.hidden = (this.variantCount || 1) < 2;
    shuffle.disabled = restam <= 0;
    shuffle.textContent = restam > 0 ? `${t('shuffle')}  x${restam}` : t('shuffleNone');

    // Pular fase fica sempre a mao, ao lado de "tentar de novo". Ficou
    // escondido atras de tres derrotas seguidas NA MESMA FASE durante um
    // merge, o que na pratica significava nunca: tocar em "inicio" e voltar
    // zerava a contagem.
    const skip = /** @type {HTMLButtonElement} */ ($('loseSkip'));
    // Sem plataforma nao ha video, e a regra da Poki nao se aplica: ali o
    // pular vira botao comum, aberto depois de tres derrotas, para o jogador
    // nao ficar preso numa fase dura sem nenhuma saida.
    skip.classList.toggle('ad', COM_ANUNCIOS);
    skip.hidden = this.level >= LEVEL_COUNT || (!COM_ANUNCIOS && this.lossStreak < 3);
    skip.disabled = false;
    skip.textContent = t('skipLevel');
    $('loseSkipNote').textContent = skip.hidden ? '' : t('skipNoStars');
    this.show('lose');
  }

  pauseLevel() {
    if (this.screen !== 'game' || !this.scene.session) return;
    // Celebracao e transicao nao se pausam: a fase ja acabou e os botoes do
    // HUD estao fora do ar. Sem esta guarda, Escape entrava por tras deles.
    if (this.pendingWin || this.flowTimer || this.advancing) return;
    this.paused = true;
    this.scene.session.paused = true;
    poki.gameplayStop();
    audio.button();
    // A trilha tocava na tela de pausa: quem pulsa o sequenciador e o passo da
    // cena, que segue rodando, e ele nao sabia de pausa nenhuma.
    audio.holdMusic();
    this.buildPause();
    this.show('pause');
  }

  /** Conteudo da tela de pausa: onde o jogador esta e como esta indo. */
  buildPause() {
    const session = this.scene.session;
    const themeId = levelConfig(this.level - 1).theme;
    $('pauseWhere').textContent = `${THEMES[themeId].label} \u00b7 ${t('level')} ${this.level}`;
    this.setStars('pauseStars', session ? session.stars : 0);
    const par = session && session.par ? ` \u00b7 ${t('par')} ${session.par}` : '';
    $('pauseTaps').textContent = session ? `${t('taps')} ${session.taps}${par}` : '';
    const toggle = (/** @type {string} */ id, /** @type {boolean} */ on) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('off', !on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    toggle('pauseSound', audio.sfxOn);
    toggle('pauseMusic', audio.musicOn);
  }

  async resumeLevel() {
    audio.button();
    this.paused = false;
    audio.releaseMusic();
    this.show('game');
    // Voltar de uma parada para o jogo e o momento certo do intervalo, mas so
    // quando havia jogo de fato. Pausar antes do primeiro toque nao e uma
    // interrupcao de gameplay, e um anuncio ali seria injustificado.
    const wasPlaying = !!this.scene.session && this.scene.session.state === 'playing';
    if (wasPlaying) await this.commercialBreak();
    if (this.scene.session) {
      this.scene.session.paused = false;
      if (wasPlaying && this.scene.session.state === 'playing') poki.gameplayStart();
    }
  }

  /**
   * Intervalo comercial, depois da carencia do comeco do jogo. Todo intervalo
   * passa por aqui: chamar `poki.commercialBreak()` direto pularia a carencia.
   */
  async commercialBreak() {
    if (this.progress.data.unlocked - 1 < FASES_SEM_INTERVALO) return;
    await poki.commercialBreak();
  }

  quitLevel() {
    audio.buttonBack();
    poki.gameplayStop();
    this.cancelFlow();
    this.paused = false;
    audio.releaseMusic();
    if (this.scene.session) this.scene.session.paused = false;
    this.showAmbient();
    this.show('home');
  }

  async nextLevel() {
    audio.button();
    if (this.level + 1 > LEVEL_COUNT) {
      this.showAmbient();
      this.show('home');
      return;
    }
    await this.advanceLevel();
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
    if (!fromPause) await this.commercialBreak();
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

  async skipByAd() {
    const btn = /** @type {HTMLButtonElement} */ ($('loseSkip'));
    btn.disabled = true;
    const ok = COM_ANUNCIOS ? await poki.rewardedBreak('medium') : true;
    if (!ok) {
      btn.disabled = false;
      return;
    }
    this.lossStreak = 0;
    const p = this.progress;
    p.markSkipped(this.level);
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
    const ok = COM_ANUNCIOS ? await poki.rewardedBreak('medium') : true;
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
   * A trilha serpenteia: o x descreve ondas ao longo do mundo e o y sobe do
   * fundo para o topo - por isso o indice entra invertido. E a mesma funcao
   * que alimenta as posicoes dos botoes e o tracado do SVG, para que o caminho
   * passe exatamente pelo meio de cada no e nao ao lado.
   *
   * O numero de ondas acompanha o tamanho do mundo em vez de ser fixo: com o
   * mundo 1 em vinte fases, tres ondas cravadas dobrariam o periodo e a
   * serpentina viraria uma cobra esticada.
   *
   * @param {number} i 0 a n-1, de baixo para cima
   * @param {number} n quantas fases o mundo tem
   * @returns {{x:number, y:number}} em porcentagem
   */
  nodeSpot(i, n) {
    const t = n > 1 ? i / (n - 1) : 0;
    const ondas = Math.max(3, Math.round(n / 3.4));
    return {
      x: 50 + 27 * Math.sin(t * Math.PI * ondas),
      y: 96 - t * 92,
    };
  }

  /**
   * Leva a paleta de um tema para dentro de um elemento do mapa.
   *
   * O mapa inteiro herdava as variaveis de `applyUiTheme`, que so roda ao
   * carregar uma cena - ou seja, a tela de fases era pintada com a paleta da
   * ULTIMA fase jogada. Vindo do mundo puzzle, que e claro, saia branco sobre
   * branco: no branco, borda azul clara, veu a 95%. Aqui cada mundo carrega a
   * propria cor, e o fundo da tela e fixo.
   *
   * @param {HTMLElement} el
   * @param {string} themeId
   */
  paintWorld(el, themeId) {
    const th = THEMES[themeId] || THEMES.neon;
    const ceu = th.sky;
    const cor = (/** @type {number} */ i) => ceu[Math.min(i, ceu.length - 1)];
    el.style.setProperty('--w-sky', `linear-gradient(170deg, ${cor(2)}, ${cor(1)} 46%, ${cor(0)})`);
    el.style.setProperty('--w-accent', th.accent);
    el.style.setProperty('--w-accent2', th.accent2);
    el.style.setProperty('--w-ink', th.ink);
    el.style.setProperty('--w-soft', th.inkSoft);
    el.style.setProperty('--w-node', th.panelSolid);
    el.style.setProperty('--w-edge', th.panelEdge);
    el.style.setProperty('--w-star', th.star);
    el.style.setProperty('--w-staroff', th.starOff);
    el.style.setProperty('--w-hex', th.hexagon.stroke);
  }

  /**
   * Estrelas ganhas e possiveis num mundo.
   * @param {number} w
   * @returns {{tem:number, total:number}}
   */
  worldStars(w) {
    const ini = worldStart(w);
    const n = worldSize(w);
    let tem = 0;
    for (let i = 0; i < n; i++) tem += this.progress.starsOf(ini + i + 1);
    return { tem, total: n * 3 };
  }

  buildMap() {
    const p = this.progress;
    const chave = [
      p.data.unlocked, getLang(), p.totalStars, this.level, (p.data.skipped || []).length,
    ].join('|');
    const host = $('mapScroll');
    if (host.dataset.built === chave) return;
    host.dataset.built = chave;
    host.innerHTML = '';
    if (this._mapObs) this._mapObs.disconnect();

    // Os mundos sao empilhados do ultimo para o primeiro, entao progredir e
    // subir na pagina - que e o que a animacao de troca de mundo encena.
    for (let w = WORLD_COUNT - 1; w >= 0; w--) {
      const aberto = p.worldOpen(w);
      const themeId = levelConfig(worldStart(w)).theme;
      const sec = document.createElement('section');
      sec.className = 'world' + (aberto ? '' : ' locked');
      sec.dataset.world = String(w);
      sec.dataset.nome = `${t('world')} ${w + 1} · ${THEMES[themeId].label}`;
      sec.dataset.tema = themeId;
      this.paintWorld(sec, themeId);

      const head = document.createElement('div');
      head.className = 'world-head';
      const num = document.createElement('b');
      num.className = 'world-num';
      num.textContent = String(w + 1);
      const nome = document.createElement('span');
      nome.className = 'world-name';
      nome.textContent = THEMES[themeId].label;
      const conta = document.createElement('span');
      conta.className = 'world-count';
      const st = this.worldStars(w);
      conta.innerHTML = `<i class="st on"></i>${st.tem} / ${st.total}`;
      head.append(num, nome, conta);
      sec.appendChild(head);

      if (!aberto) {
        // Mundo fechado e cartaz, nao parede cinza: antes os quinze mundos
        // montavam sempre ~150 botoes e os travados so ganhavam opacidade,
        // o que deixava o futuro parecendo um muro morto.
        // Cartaz: a arte do tema e o selo. A exigencia em estrelas ja esta
        // no portao logo abaixo, e dizer duas vezes vira ruido.
        const cartaz = document.createElement('div');
        cartaz.className = 'world-teaser';
        const selo = document.createElement('div');
        selo.className = 'teaser-seal';
        selo.innerHTML = '&#128274;';
        cartaz.appendChild(selo);
        sec.appendChild(cartaz);
        host.appendChild(sec);
        if (w > 0) host.appendChild(this.buildGate(w));
        continue;
      }

      const n = worldSize(w);
      const trilha = document.createElement('div');
      trilha.className = 'trail';
      trilha.style.setProperty('--nos', String(n));

      // Tracado: uma polilinha suave pelos mesmos pontos dos nos.
      const pontos = [];
      for (let i = 0; i < n; i++) pontos.push(this.nodeSpot(i, n));
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

      for (let i = 0; i < n; i++) {
        const level = worldStart(w) + i + 1;
        const spot = pontos[i];
        const unlocked = p.isUnlocked(level);
        const stars = p.starsOf(level);
        const node = document.createElement('button');
        // Pulada por video: aberta, porem sem estrela nenhuma.
        const pulada = p.wasSkipped(level) && stars === 0;
        node.className =
          'node' +
          (unlocked ? '' : ' locked') +
          (pulada ? ' skipped' : '') +
          (stars >= 3 ? ' perfect' : '') +
          (level === this.level ? ' current' : '');
        node.style.left = `${spot.x}%`;
        node.style.top = `${spot.y}%`;
        node.dataset.level = String(level);
        const rotulo = document.createElement('span');
        rotulo.className = 'node-num';
        // Fase ainda nao alcancada mostra o PROPRIO numero, apagado: dez
        // cadeados iguais em fila nao dizem para onde se esta indo.
        rotulo.textContent = String(level);
        node.appendChild(rotulo);
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
      // ultimo mundo para o primeiro, isso o coloca exatamente entre a ultima
      // fase do mundo anterior e a primeira deste - que e por onde o hexagono
      // sobe.
      if (w > 0) host.appendChild(this.buildGate(w));
    }

    this.watchMapWorlds();
  }

  /**
   * Mantem o cabecalho fixo dizendo em que mundo a rolagem esta.
   *
   * Numa fita de quinze mundos o jogador perde a referencia em tres segundos
   * de rolagem; o titulo "Fases" nao dizia nada.
   */
  watchMapWorlds() {
    const host = $('mapScroll');
    const titulo = $('mapTitle');
    if (!titulo || typeof IntersectionObserver !== 'function') return;
    this._mapObs = new IntersectionObserver(
      (entradas) => {
        let melhor = null;
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          if (!melhor || e.intersectionRatio > melhor.intersectionRatio) melhor = e;
        }
        if (melhor) {
          const alvo = /** @type {HTMLElement} */ (melhor.target);
          titulo.textContent = alvo.dataset.nome || t('levels');
          // O tema vem do dataset, e nao de levelConfig(): o observador dispara
          // a cada rolagem, e regerar a configuracao da fase ali seria trabalho
          // repetido dezenas de vezes por segundo.
          this.paintWorld(titulo, alvo.dataset.tema || 'neon');
        }
      },
      { root: host, threshold: [0.15, 0.4, 0.75] },
    );
    for (const sec of host.querySelectorAll('.world')) this._mapObs.observe(sec);
  }

  /** Mostra o atalho de volta a fase atual so quando ela saiu da tela. */
  updateMapHere() {
    const botao = $('mapHere');
    if (!botao) return;
    const host = $('mapScroll');
    const node = host.querySelector('.node.current');
    if (!node) {
      botao.classList.remove('on');
      return;
    }
    const rn = node.getBoundingClientRect();
    const rh = host.getBoundingClientRect();
    const fora = rn.bottom < rh.top + 12 || rn.top > rh.bottom - 12;
    botao.classList.toggle('on', fora);
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
    const de = host.querySelector(`.node[data-level="${worldStart(w)}"]`);
    const para = host.querySelector(`.node[data-level="${worldStart(w) + 1}"]`);
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
    climber.style.boxShadow = `inset 0 0 0 3px ${skinAtual.stroke || '#4fc8ff'}`;
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
    if (Math.abs(host.scrollTop - destino) >= 4) host.scrollTop = destino;
    this.updateMapHere();
  }

  /**
   * O portao entre dois mundos.
   *
   * E uma faixa larga, e nao um cartao solto no meio do caminho: o portao e a
   * fronteira da fita, entao ele atravessa a coluna inteira e traz a barra de
   * estrelas que falta preencher.
   *
   * @param {number} w mundo que o portao protege
   * @returns {HTMLElement}
   */
  buildGate(w) {
    const p = this.progress;
    const faltam = p.starsToOpen(w);
    const meta = gateStars(w);
    const themeId = levelConfig(worldStart(w)).theme;
    const gate = document.createElement('div');
    gate.className = 'gate' + (faltam > 0 ? '' : ' open');
    gate.dataset.world = String(w);
    this.paintWorld(gate, themeId);

    const selo = document.createElement('div');
    selo.className = 'gate-seal';
    selo.innerHTML = faltam > 0 ? '&#128274;' : '&#10004;';
    gate.appendChild(selo);

    const txt = document.createElement('div');
    txt.className = 'gate-text';
    const forte = document.createElement('b');
    forte.textContent = `${t('world')} ${w + 1} · ${THEMES[themeId].label}`;
    txt.appendChild(forte);

    const barra = document.createElement('div');
    barra.className = 'gate-bar';
    const cheio = document.createElement('i');
    cheio.style.width = `${Math.max(0, Math.min(1, meta ? p.totalStars / meta : 1)) * 100}%`;
    barra.appendChild(cheio);
    txt.appendChild(barra);

    const sub = document.createElement('span');
    // Depois de aberto, "62 / 24" nao informa nada - so a palavra importa.
    sub.innerHTML = faltam > 0
      ? `<i class="st on"></i>${p.totalStars} / ${meta} · ${t('gateNeed', faltam)}`
      : t('gateOpen');
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

  /**
   * Miniatura de uma skin, com as cores efetivas no tema corrente.
   * @param {HTMLCanvasElement} cv
   * @param {import('./game/content.js').Skin} s
   */
  paintSkinSwatch(cv, s) {
    const th = this.scene.theme || THEMES.neon;
    const lado = 44;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(lado * dpr);
    cv.height = Math.round(lado * dpr);
    const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintHexModel(
      ctx,
      lado / 2,
      lado / 2,
      lado * 0.37,
      s.model || 'liso',
      {
        fill: s.fill || th.hexagon.fill,
        stroke: s.stroke || th.hexagon.stroke,
        core: s.core || th.hexagon.core,
      },
      th.glow,
    );
  }

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

        // A vitrine desenha o hexagono de verdade, no tema em que se esta
        // jogando. Era um quadrado arredondado com o azul do tema neon
        // cravado: a skin "Original" aparecia azul mesmo no mundo puzzle,
        // onde o hexagono e amarelo, e nenhuma delas tinha forma de hexagono.
        const swatch = document.createElement('canvas');
        swatch.className = 'swatch';
        this.paintSkinSwatch(swatch, s);
        item.appendChild(swatch);

        const info = document.createElement('div');
        info.className = 'info';
        const name = document.createElement('b');
        name.textContent = s.name;
        const sub = document.createElement('span');
        if (entry.equipped) sub.textContent = t('equipped');
        else if (entry.owned) sub.textContent = t('owned');
        else if (entry.rankLocked) sub.textContent = t('unlockAt', s.rank);
        // Sem plataforma a rota do video nao existe: o subtitulo tem que dizer
        // o preco em moedas, que e o unico caminho que sobrou.
        else if (s.rewarded && COM_ANUNCIOS) sub.textContent = t('watchAd');
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
          pair.appendChild(buy);
          // Sem plataforma sobra so a rota das moedas - que ja existia, porque
          // a Poki nunca deixou o video ser o unico caminho.
          if (COM_ANUNCIOS) {
            const watch = document.createElement('button');
            watch.className = 'btn ad';
            watch.textContent = t('watchAd');
            watch.onclick = () => this.unlockSkinByAd(s.id);
            pair.appendChild(watch);
          }
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
