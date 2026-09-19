/**
 * Audio totalmente sintetizado em Web Audio. Nenhum arquivo, nenhuma
 * requisicao externa, nenhum byte no bundle.
 *
 * Grafo: fonte -> ganho do som -> barramento (sfx|musica) -> mestre -> saida.
 * O mute de anuncio mexe apenas no mestre, como a Poki pede.
 */

import { load, save } from './storage.js';

const A4 = 440;

/** @param {number} semitonesFromA4 @returns {number} */
function hz(semitonesFromA4) {
  return A4 * Math.pow(2, semitonesFromA4 / 12);
}

/**
 * Mascaras ritmicas de um compasso 4/4 em colcheias. 1 = ataque, 0 = silencio.
 *
 * O silencio e o ingrediente principal: a trilha antiga atacava em toda
 * colcheia par, sem excecao, e por isso soava como um relogio.
 */
const PATTERNS = {
  reto: [1, 0, 0, 1, 0, 1, 0, 0],
  sincope: [1, 0, 1, 0, 0, 1, 0, 1],
  arejado: [1, 0, 0, 0, 1, 0, 0, 1],
  corrido: [1, 0, 1, 1, 0, 1, 0, 1],
  esparso: [1, 0, 0, 0, 0, 1, 0, 0],
  raiz: [1, 0, 0, 0, 1, 0, 0, 0],
  andante: [1, 0, 0, 1, 0, 0, 1, 0],
  pulsar: [1, 0, 1, 0, 1, 0, 1, 0],
};

/** Contorno melodico: grau da escala em cada compasso de uma secao. */
const CONTOUR = [0, 2, 1, 4, 0, 3, 5, 2];
/** Figura dentro do compasso, somada ao contorno a cada ataque. */
const MOTIF = [0, 2, 1, 3];

const BARS_PER_SECTION = 8;

/**
 * Forma de 32 compassos: A A' B A''.
 *
 * Oito compassos davam um loop curto demais para ficar de fundo. A secao B
 * sobe uma oitava, abre o ritmo e traz o pad - e o ponto de respiro que faz o
 * retorno de A soar como retorno, e nao como repeticao.
 */
const SECTIONS = [
  { lead: 'reto', bass: 'raiz', oct: 0, pad: false, hat: false },
  { lead: 'sincope', bass: 'andante', oct: 0, pad: false, hat: true },
  { lead: 'arejado', bass: 'raiz', oct: 12, pad: true, hat: true },
  { lead: 'corrido', bass: 'pulsar', oct: 0, pad: false, hat: true },
];

const BARS_PER_FORM = SECTIONS.length * BARS_PER_SECTION;

/**
 * Grau da escala, com o indice podendo passar das pontas: o excedente vira
 * oitava. E o que produz linha melodica em vez de salto aleatorio.
 * @param {number[]} scale
 * @param {number} index
 * @returns {number} semitons acima da tonica
 */
function degreeAt(scale, index) {
  const n = scale.length;
  const oct = Math.floor(index / n);
  const i = ((index % n) + n) % n;
  return scale[i] + oct * 12;
}

export class AudioEngine {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.noiseBuffer = null;
    this.unlocked = false;
    this.adMuted = false;
    this.sfxOn = load('sfxOn', true) !== false;
    this.musicOn = load('musicOn', true) !== false;
    /** @type {number} */
    this.lastImpactAt = 0;
    this._music = null;
    this._musicTimer = 0;
    this._musicNext = 0;
    this._musicStep = 0;
    /** @type {AudioNode[]} */
    this._musicNodes = [];
    /** Trilha segurada pela pausa do jogo ou pela aba em segundo plano. */
    this._musicHold = false;
    this._hidden = false;
    this._visBound = false;
  }

  /** Cria o contexto. Fica suspenso ate o primeiro gesto do usuario. */
  init() {
    if (this.ctx) return;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 0.85 : 0;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.3 : 0;
      this.musicBus.connect(this.master);
      this._buildNoise();
      this.ctx.onstatechange = () => {
        if (this.ctx && this.ctx.state === 'running') this.unlocked = true;
      };
      this._bindVisibility();
    } catch {
      this.ctx = null;
    }
  }

  _buildNoise() {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * 0.6);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < len; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = (seed / 2147483648) - 1;
    }
    this.noiseBuffer = buf;
  }

  /** Chamado no primeiro gesto real do usuario (toque, clique ou tecla). */
  unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') {
      this.ctx.resume().then(
        () => {
          this.unlocked = true;
        },
        () => {
          /* ignora */
        },
      );
    } else {
      this.unlocked = true;
    }
  }

  /** @returns {number} */
  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** @returns {boolean} */
  get ready() {
    return !!this.ctx && this.ctx.state === 'running' && !this.adMuted;
  }

  /** @param {boolean} on */
  setSfx(on) {
    this.sfxOn = on;
    save('sfxOn', on);
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.02);
    }
  }

  /** @param {boolean} on */
  setMusic(on) {
    this.musicOn = on;
    save('musicOn', on);
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(on ? 0.3 : 0, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * Silencia tudo antes de um intervalo comercial.
   * A documentacao da Poki avisa que o callback onStart pode nao ser chamado,
   * entao isso roda antes da chamada, nao dentro dela.
   */
  muteForAd() {
    this.adMuted = true;
    if (!this.ctx || !this.master) return;
    try {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      this._stopMusicNodes();
      window.setTimeout(() => {
        if (this.adMuted && this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend().catch(() => {});
        }
      }, 80);
    } catch {
      /* ignora */
    }
  }

  unmuteAfterAd() {
    this.adMuted = false;
    if (!this.ctx || !this.master) return;
    try {
      this.ctx.resume().then(
        () => {
          if (this.master && this.ctx) {
            this.master.gain.setTargetAtTime(1, this.ctx.currentTime, 0.05);
          }
          if (this._music) this._musicNext = this.ctx ? this.ctx.currentTime + 0.1 : 0;
        },
        () => {},
      );
    } catch {
      /* ignora */
    }
  }

  // ---------------------------------------------------------------- sintese

  /**
   * @param {object} o
   * @param {number} o.freq
   * @param {number} [o.freqEnd]
   * @param {number} [o.dur]
   * @param {number} [o.gain]
   * @param {OscillatorType} [o.type]
   * @param {number} [o.attack]
   * @param {number} [o.delay]
   * @param {GainNode|null} [o.bus]
   */
  tone(o) {
    if (!this.ready || !this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (o.delay || 0);
    const dur = o.dur === undefined ? 0.15 : o.dur;
    const peak = (o.gain === undefined ? 0.3 : o.gain);
    const attack = o.attack === undefined ? 0.004 : o.attack;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(20, o.freq), t0);
    if (o.freqEnd !== undefined && o.freqEnd !== o.freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t0 + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(o.bus || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /**
   * @param {object} o
   * @param {number} [o.dur]
   * @param {number} [o.gain]
   * @param {number} [o.freq] centro do filtro
   * @param {number} [o.freqEnd]
   * @param {BiquadFilterType} [o.filter]
   * @param {number} [o.q]
   * @param {number} [o.delay]
   * @param {number} [o.attack]
   */
  noise(o) {
    if (!this.ready || !this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (o.delay || 0);
    const dur = o.dur === undefined ? 0.12 : o.dur;
    const peak = o.gain === undefined ? 0.25 : o.gain;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filter || 'bandpass';
    const f0 = Math.max(40, o.freq === undefined ? 1200 : o.freq);
    filter.frequency.setValueAtTime(f0, t0);
    if (o.freqEnd !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, o.freqEnd), t0 + dur);
    }
    filter.Q.value = o.q === undefined ? 1.2 : o.q;
    const g = ctx.createGain();
    const attack = o.attack === undefined ? 0.002 : o.attack;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ------------------------------------------------------------ efeitos

  /** @param {number} [pitch] */
  click(pitch = 1) {
    this.tone({ freq: 1800 * pitch, freqEnd: 900 * pitch, dur: 0.06, gain: 0.16, type: 'triangle' });
    this.noise({ freq: 3600, dur: 0.035, gain: 0.07, filter: 'highpass' });
  }

  button() {
    this.tone({ freq: 620, freqEnd: 980, dur: 0.09, gain: 0.16, type: 'triangle' });
  }

  buttonBack() {
    this.tone({ freq: 620, freqEnd: 380, dur: 0.09, gain: 0.14, type: 'triangle' });
  }

  denied() {
    this.tone({ freq: 220, freqEnd: 160, dur: 0.16, gain: 0.18, type: 'square' });
  }

  /**
   * Som de quebra especifico do material.
   * @param {string} material
   * @param {number} [size] 0..1 escala com a area da peca
   */
  breakPiece(material, size = 0.5) {
    const s = Math.max(0.2, Math.min(1, size));
    switch (material) {
      case 'glass':
        this.noise({ freq: 5200, freqEnd: 3000, dur: 0.22, gain: 0.2, filter: 'bandpass', q: 1.5 });
        for (let i = 0; i < 5; i++) {
          this.tone({
            freq: 2600 + i * 900,
            freqEnd: 2000 + i * 700,
            dur: 0.09,
            gain: 0.06,
            type: 'triangle',
            delay: 0.01 + i * 0.022,
          });
        }
        break;
      case 'metal':
        this.tone({ freq: 340, freqEnd: 250, dur: 0.5, gain: 0.16, type: 'triangle' });
        this.tone({ freq: 1180, freqEnd: 940, dur: 0.42, gain: 0.1, type: 'sine', delay: 0.005 });
        this.tone({ freq: 2320, dur: 0.3, gain: 0.05, type: 'sine', delay: 0.01 });
        this.noise({ freq: 3000, dur: 0.1, gain: 0.08, filter: 'highpass' });
        break;
      case 'stone':
        this.noise({ freq: 620, freqEnd: 220, dur: 0.24, gain: 0.26, filter: 'lowpass', q: 0.8 });
        this.tone({ freq: 120, freqEnd: 60, dur: 0.18, gain: 0.2, type: 'sine' });
        break;
      case 'ice':
        this.noise({ freq: 7000, freqEnd: 4200, dur: 0.16, gain: 0.14, filter: 'highpass' });
        this.tone({ freq: 3100, freqEnd: 4200, dur: 0.1, gain: 0.08, type: 'sine' });
        this.tone({ freq: 4600, dur: 0.07, gain: 0.05, type: 'sine', delay: 0.05 });
        break;
      case 'rubber':
        this.tone({ freq: 300, freqEnd: 140, dur: 0.16, gain: 0.22, type: 'sine' });
        this.tone({ freq: 180, freqEnd: 90, dur: 0.12, gain: 0.12, type: 'triangle', delay: 0.05 });
        break;
      case 'foam':
        this.noise({ freq: 900, freqEnd: 400, dur: 0.1, gain: 0.12, filter: 'lowpass' });
        break;
      case 'obsidian':
        this.tone({ freq: 90, dur: 0.1, gain: 0.14, type: 'square' });
        break;
      case 'tnt':
        // Mais grave, mais longo e mais sujo que a bomba: e a detonacao que o
        // jogador nao pediu.
        this.noise({ freq: 520, freqEnd: 60, dur: 0.62, gain: 0.38, filter: 'lowpass', q: 0.5 });
        this.tone({ freq: 180, freqEnd: 28, dur: 0.55, gain: 0.32, type: 'sine' });
        this.noise({ freq: 3200, dur: 0.09, gain: 0.18, filter: 'highpass' });
        break;
      case 'crystal':
        // Estalo seco, mais curto e mais agudo que o vidro.
        this.noise({ freq: 6200, freqEnd: 2400, dur: 0.16, gain: 0.16, filter: 'bandpass', q: 2 });
        this.tone({ freq: 1800, freqEnd: 900, dur: 0.12, gain: 0.08, type: 'triangle' });
        break;
      case 'wax':
        // Sopro molhado, sem ataque: derreter nao estala.
        this.noise({ freq: 300, freqEnd: 90, dur: 0.38, gain: 0.16, filter: 'lowpass', q: 0.7 });
        this.tone({ freq: 160, freqEnd: 70, dur: 0.3, gain: 0.1, type: 'sine' });
        break;
      case 'bomb':
        this.noise({ freq: 400, freqEnd: 80, dur: 0.5, gain: 0.34, filter: 'lowpass', q: 0.6 });
        this.tone({ freq: 160, freqEnd: 35, dur: 0.45, gain: 0.3, type: 'sine' });
        this.noise({ freq: 2600, dur: 0.12, gain: 0.14, filter: 'highpass' });
        break;
      default:
        this.noise({ freq: 380 + s * 300, freqEnd: 150, dur: 0.16, gain: 0.2, filter: 'lowpass' });
        this.tone({ freq: 210, freqEnd: 110, dur: 0.12, gain: 0.14, type: 'triangle' });
    }
  }

  /**
   * Impacto de colisao, com limite de frequencia para nao empastar.
   * @param {number} strength 0..1
   * @param {string} [material]
   */
  impact(strength, material = 'wood') {
    const now = this.now();
    if (now - this.lastImpactAt < 0.045) return;
    this.lastImpactAt = now;
    const s = Math.max(0.05, Math.min(1, strength));
    const base = material === 'metal' ? 420 : material === 'stone' ? 180 : material === 'ice' ? 900 : 260;
    this.tone({ freq: base, freqEnd: base * 0.55, dur: 0.05 + s * 0.09, gain: 0.05 + s * 0.16, type: 'sine' });
    this.noise({
      freq: material === 'ice' ? 4200 : 1100,
      freqEnd: 400,
      dur: 0.04 + s * 0.06,
      gain: 0.03 + s * 0.1,
      filter: 'lowpass',
    });
  }

  /** @param {number} index 0..2 */
  star(index) {
    const notes = [0, 4, 7, 12];
    const n = notes[Math.min(index, notes.length - 1)];
    this.tone({ freq: hz(n + 7), dur: 0.22, gain: 0.18, type: 'triangle' });
    this.tone({ freq: hz(n + 19), dur: 0.3, gain: 0.1, type: 'sine', delay: 0.04 });
  }

  coin(index = 0) {
    const n = [7, 9, 11, 12, 14, 16][index % 6];
    this.tone({ freq: hz(n + 12), dur: 0.1, gain: 0.1, type: 'triangle' });
    this.tone({ freq: hz(n + 24), dur: 0.08, gain: 0.05, type: 'sine', delay: 0.03 });
  }

  win() {
    const seq = [0, 4, 7, 12, 16];
    seq.forEach((n, i) => {
      this.tone({ freq: hz(n), dur: 0.35, gain: 0.16, type: 'triangle', delay: i * 0.09 });
      this.tone({ freq: hz(n + 12), dur: 0.3, gain: 0.08, type: 'sine', delay: i * 0.09 + 0.02 });
    });
  }

  lose() {
    const seq = [0, -3, -7, -12];
    seq.forEach((n, i) => {
      this.tone({ freq: hz(n), dur: 0.3, gain: 0.16, type: 'triangle', delay: i * 0.13 });
    });
  }

  /**
   * Estouro da celebracao de fim de fase.
   *
   * A nota sobe com a contagem - e o que transforma "sobraram doze pecas" numa
   * escala que termina em cima, em vez de doze estouros iguais. A subida e
   * normalizada pelo total, entao dez pecas e trinta pecas percorrem o mesmo
   * intervalo, e a ultima sempre resolve duas oitavas acima.
   *
   * @param {number} index 1..total
   * @param {number} total
   */
  bonusPop(index, total) {
    const n = Math.max(1, total);
    const i = Math.max(1, Math.min(n, index));
    const frac = n > 1 ? (i - 1) / (n - 1) : 1;
    const escala = [0, 2, 4, 7, 9];
    const passo = Math.round(frac * 10);
    const ultima = i >= n;
    const semis = ultima ? 24 : escala[passo % escala.length] + 12 * Math.floor(passo / escala.length);
    this.tone({ freq: hz(semis), dur: ultima ? 0.42 : 0.16, gain: 0.17, type: 'triangle' });
    this.tone({ freq: hz(semis + 12), dur: ultima ? 0.34 : 0.12, gain: 0.07, type: 'sine', delay: 0.02 });
    this.noise({ freq: 2600, freqEnd: 500, dur: 0.1, gain: 0.09, filter: 'lowpass' });
    if (ultima) this.tone({ freq: hz(31), dur: 0.5, gain: 0.08, type: 'sine', delay: 0.05 });
  }

  /**
   * Combo: arpejo curto que cresce com o tamanho da cadeia.
   * @param {number} n 2 ou mais
   */
  combo(n) {
    const tamanho = Math.max(2, Math.min(6, n | 0));
    const escala = [0, 4, 7, 12, 16, 19];
    for (let i = 0; i < tamanho; i++) {
      this.tone({ freq: hz(escala[i] + 7), dur: 0.2, gain: 0.15, type: 'triangle', delay: i * 0.055 });
      this.tone({ freq: hz(escala[i] + 19), dur: 0.16, gain: 0.06, type: 'sine', delay: i * 0.055 + 0.02 });
    }
  }

  land() {
    this.tone({ freq: 160, freqEnd: 80, dur: 0.2, gain: 0.2, type: 'sine' });
    this.noise({ freq: 700, freqEnd: 200, dur: 0.14, gain: 0.12, filter: 'lowpass' });
  }

  whoosh() {
    this.noise({ freq: 400, freqEnd: 2200, dur: 0.24, gain: 0.08, filter: 'bandpass', q: 0.7, attack: 0.08 });
  }

  // -------------------------------------------------- aba em segundo plano

  /**
   * Silencia a trilha quando a aba sai de cena.
   *
   * O laco ja pausa sozinho no visibilitychange (core/loop.js), mas o contexto
   * de audio continuava 'running' em segundo plano, e _musicNext ficava parado
   * no passado: na volta, o agendador despejava de uma vez todas as notas
   * vencidas. Suspender e ressincronizar resolve os dois de uma vez - e a mesma
   * correcao que unmuteAfterAd() ja fazia no caminho do anuncio.
   */
  _bindVisibility() {
    if (this._visBound || typeof document === 'undefined') return;
    this._visBound = true;
    const esconder = () => {
      this._hidden = true;
      this._stopMusicNodes();
      // Durante um anuncio quem manda e muteForAd/unmuteAfterAd: mexer aqui
      // deixaria o contexto suspenso depois que o anuncio terminasse.
      if (this.adMuted || !this.ctx || this.ctx.state !== 'running') return;
      this.ctx.suspend().catch(() => {});
    };
    const mostrar = () => {
      this._hidden = false;
      if (this.adMuted || !this.ctx || !this.unlocked) return;
      this.ctx.resume().then(
        () => {
          if (this.ctx) this._musicNext = this.ctx.currentTime + 0.1;
        },
        () => {},
      );
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) esconder();
      else mostrar();
    });
    window.addEventListener('pagehide', esconder);
    window.addEventListener('pageshow', mostrar);
  }

  // ------------------------------------------------------------- musica

  /**
   * Segura a trilha sem perder o lugar. Usado pela pausa do jogo.
   *
   * Antes a musica continuava tocando na tela de pausa: o laco segue rodando e
   * quem chama updateMusic() e o passo da cena, que nao sabe de pausa nenhuma.
   */
  holdMusic() {
    if (this._musicHold) return;
    this._musicHold = true;
    this._stopMusicNodes();
  }

  releaseMusic() {
    if (!this._musicHold) return;
    this._musicHold = false;
    if (this.ctx) this._musicNext = this.ctx.currentTime + 0.1;
  }

  /**
   * Arma uma trilha. Cada tema define escala, tempo, timbres e o desenho
   * ritmico; a forma de 32 compassos e comum a todas.
   * @param {*} spec
   */
  setMusic_(spec) {
    if (spec && this._music && spec === this._music) return;
    this._music = spec;
    this._musicStep = 0;
    this._stopMusicNodes();
    if (this.ctx) this._musicNext = this.ctx.currentTime + 0.15;
  }

  _stopMusicNodes() {
    for (const n of this._musicNodes) {
      try {
        /** @type {*} */ (n).stop ? /** @type {*} */ (n).stop() : n.disconnect();
      } catch {
        /* ignora */
      }
    }
    this._musicNodes.length = 0;
  }

  /**
   * Agendador da trilha, chamado pelo laco principal.
   *
   * A versao anterior tocava uma nota em TODA colcheia par e um baixo sempre
   * nos mesmos dois lugares, num loop de oito compassos - o "tum, tum, tum" de
   * relogio. Aqui a melodia segue uma mascara ritmica com silencios, a forma
   * tem 32 compassos em quatro secoes (A A' B A'') e a secao B troca registro,
   * densidade e timbre. O silencio e o que mais tira o som de metronomo.
   */
  updateMusic() {
    if (!this._music || !this.ctx || !this.musicOn || this.adMuted) return;
    if (this._musicHold || this._hidden) return;
    if (this.ctx.state !== 'running') return;
    const spec = this._music;
    const beat = 60 / spec.bpm;
    const lookahead = this.ctx.currentTime + 0.4;
    // A trilha nunca agenda no passado: depois de qualquer parada longa o
    // relogio anda junto, em vez de despejar as notas vencidas de uma vez.
    if (this._musicNext < this.ctx.currentTime) this._musicNext = this.ctx.currentTime + 0.05;
    let guard = 0;
    while (this._musicNext < lookahead && guard++ < 24) {
      this._emitStep(spec, this._musicStep, this._musicNext, beat);
      this._musicNext += beat / 2;
      this._musicStep = (this._musicStep + 1) % (BARS_PER_FORM * 8);
    }
  }

  /**
   * Uma colcheia da forma.
   * @param {*} spec
   * @param {number} step 0..(BARS_PER_FORM*8 - 1)
   * @param {number} t quando tocar
   * @param {number} beat duracao da seminima
   */
  _emitStep(spec, step, t, beat) {
    const bar = Math.floor(step / 8);
    const inBar = step % 8;
    const sec = SECTIONS[Math.floor(bar / BARS_PER_SECTION) % SECTIONS.length];
    const barInSec = bar % BARS_PER_SECTION;

    // --- melodia ----------------------------------------------------------
    const lead = PATTERNS[spec.lead || sec.lead] || PATTERNS.reto;
    if (lead[inBar]) {
      const motif = spec.motif || MOTIF;
      // Quantos ataques ja saíram neste compasso: e o indice dentro do motivo,
      // e nao a colcheia - assim a figura se mantem reconhecivel mesmo quando a
      // mascara muda de secao.
      let ataque = 0;
      for (let k = 0; k < inBar; k++) ataque += lead[k];
      const grau = CONTOUR[barInSec % CONTOUR.length] + motif[ataque % motif.length];
      const semis = spec.root + sec.oct + degreeAt(spec.scale, grau);
      // Cabeca do compasso segura mais e soa mais forte; o resto e curto.
      const longa = inBar === 0;
      this._musicNote(semis, t, beat * (longa ? 1.35 : 0.62), longa ? 0.1 : 0.075, spec.type, 2600);
    }

    // --- baixo ------------------------------------------------------------
    const bass = PATTERNS[spec.bassPattern || sec.bass] || PATTERNS.raiz;
    if (bass[inBar]) {
      const fundamental = CONTOUR[barInSec % CONTOUR.length];
      const semis = spec.root - 24 + degreeAt(spec.scale, fundamental);
      this._musicNote(semis, t, beat * 1.5, 0.13, spec.bass, 900);
    }

    // --- pad, so na secao de contraste ------------------------------------
    if (sec.pad && inBar === 0 && barInSec % 2 === 0) {
      const semis = spec.root - 12 + degreeAt(spec.scale, CONTOUR[barInSec % CONTOUR.length]);
      this._musicNote(semis, t, beat * 3.4, 0.05, spec.pad || 'sine', 1400);
      this._musicNote(semis + 7, t + 0.03, beat * 3.2, 0.035, spec.pad || 'sine', 1400);
    }

    // --- chimbal: pulso sem gastar nota -----------------------------------
    if (sec.hat && spec.hat !== false && inBar % 2 === 1) {
      this._musicHat(t, inBar === 3 || inBar === 7 ? 0.05 : 0.028);
    }
  }

  /**
   * @param {number} semis
   * @param {number} when
   * @param {number} dur
   * @param {number} gain
   * @param {OscillatorType} type
   * @param {number} [cutoff]
   */
  _musicNote(semis, when, dur, gain, type, cutoff = 2400) {
    if (!this.ctx || !this.musicBus) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = hz(semis);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    osc.connect(filter).connect(g).connect(this.musicBus);
    osc.start(when);
    osc.stop(when + dur + 0.05);
    this._musicNodes.push(osc);
    if (this._musicNodes.length > 40) this._musicNodes.splice(0, 12);
  }

  /**
   * Chimbal de ruido filtrado. Vai no barramento de musica, e nao no de
   * efeitos, para desligar junto com a trilha.
   * @param {number} when
   * @param {number} gain
   */
  _musicHat(when, gain) {
    if (!this.ctx || !this.musicBus || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    src.connect(filter).connect(g).connect(this.musicBus);
    src.start(when);
    src.stop(when + 0.12);
    this._musicNodes.push(src);
    if (this._musicNodes.length > 40) this._musicNodes.splice(0, 12);
  }
}

export const audio = new AudioEngine();
