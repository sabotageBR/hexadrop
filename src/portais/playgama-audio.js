/**
 * O audio do build da Playgama, no lugar de src/core/audio.js (o plugin
 * `soNaPlaygama` do vite.config.js troca o import so neste build), com a mesma
 * interface do AudioEngine.
 *
 * Requisitos 3.3.1 e 3.3.2 da Playgama (wiki.playgama.com/playgama/game-requirements,
 * de 2026-10-30): musica de fundo, e som gravado ou produzido em ferramenta de
 * audio, em ogg ou mp3. O sintetizado em codigo nao vale, entao aqui tudo e
 * arquivo (src/portais/playgama-sons/, de tools/sons-playgama.mjs):
 * - os efeitos sao os do pacote CC0 da Kenney, um por material; o que a sintese
 *   variava (a nota da estrela, da moeda, do bonus e do combo, a forca da
 *   batida) vem da velocidade e do volume do arquivo;
 * - a musica e uma faixa so (Sci-fi Puzzle In-Game 2, do MintoDog, CC0) em
 *   laco sem emenda, para todos os mundos; e comeca ligada (na versao
 *   sintetizada ela nasce desligada desde a 1.0.16), porque a 3.3.1 pede musica
 *   de fundo. O jogador desliga nos ajustes, e a escolha fica salva;
 * - os cartoes de vitoria e de derrota tocam as vinhetas Clear e Failure do
 *   MintoDog (`winCard`, `loseCard`, que o plugin poe no main.js); a derrota
 *   sem cartao e o "voltar jogada" ficam com o som curto.
 *
 * O resto e como no original: o contexto nasce suspenso e destrava no primeiro
 * gesto; o anuncio zera o mestre e suspende o contexto; a aba escondida
 * suspende; a pausa do jogo segura a musica.
 */
import { load, save } from '../core/storage.js';
import { SONS_PLAYGAMA } from './playgama-sons-indice.js';

/** Volume dos efeitos (os MP3 estao em -18 LUFS). */
const VOL = 0.55;
/** Ganho da musica antes do barramento (0,3): fica uns 6 dB abaixo dos efeitos. */
const GANHO_MUSICA = 0.8;
/** Fontes tocando juntas, no maximo. */
const MAX_FONTES = 24;
/** A pentatonica dos arpejos do original. */
const PENTA = [0, 2, 4, 7, 9];

/** @param {number} s semitons @returns {number} velocidade */
const semitons = (s) => Math.pow(2, s / 12);

/**
 * Quebra de cada material: o arquivo, a velocidade e o volume.
 * @type {Record<string, {id: string, taxa?: number, vol?: number}>}
 */
const QUEBRA = {
  glass: { id: 'vidro' },
  metal: { id: 'metal' },
  stone: { id: 'pedra' },
  ice: { id: 'gelo', taxa: 1.15 },
  rubber: { id: 'borracha', taxa: 1.25 },
  foam: { id: 'espuma', vol: 0.8 },
  block: { id: 'bloco' },
  obsidian: { id: 'obsidiana', taxa: 0.85 },
  tnt: { id: 'explosao', taxa: 0.7 },
  crystal: { id: 'cristal', vol: 0.5 },
  wax: { id: 'cera', taxa: 0.9 },
  bomb: { id: 'explosao', taxa: 0.85 },
};
/** Batida de colisao de cada material (o original so distinguia estes). */
const BATIDA = { metal: 'batidaMetal', stone: 'batidaPedra', ice: 'batidaGelo' };

/**
 * Laco [inicio, fim] da faixa decodificada, s: com o Xing o navegador corta o
 * atraso do codificador; sem cortar, o laco pula o atraso medido.
 * @param {number} duracao a do AudioBuffer
 * @param {{dur: number, atraso?: number}} faixa
 * @returns {[number, number]}
 */
export function lacoDaFaixa(duracao, faixa) {
  if (Math.abs(duracao - faixa.dur) < 0.02) return [0, duracao];
  const inicio = faixa.atraso || 0;
  return [inicio, Math.min(duracao, inicio + faixa.dur)];
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
    /** O mudo da plataforma: vence os botoes de som e musica do jogo. */
    this.platformMuted = false;
    this.sfxOn = load('sfxOn', true) !== false;
    // a Playgama pede musica de fundo (3.3.1): ligada, salvo se o jogador desligou
    this.musicOn = load('musicOn', true) !== false;
    /** @type {number} */
    this.lastImpactAt = 0;
    /** @type {Map<string, AudioBuffer|'carregando'|'falhou'>} */
    this._buffers = new Map();
    /**
     * Os arquivos ja vem chegando desde o carregamento da pagina; o contexto so
     * nasce no primeiro gesto, e decodifica o que ja chegou.
     * @type {Map<string, Promise<ArrayBuffer|null>>}
     */
    this._dados = new Map();
    if (typeof fetch === 'function' && typeof window !== 'undefined') {
      for (const [id, s] of Object.entries(SONS_PLAYGAMA)) {
        this._dados.set(id, fetch(s.url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
      }
    }
    /** Fontes tocando agora (o limite de polifonia). */
    this._ativas = 0;
    /** @type {AudioBufferSourceNode|null} */
    this._musica = null;
    /** @type {GainNode|null} o ganho da faixa: segura (0) na pausa do jogo, 1 fora dela */
    this._seguraMusica = null;
    this._musicHold = false;
    this._hidden = false;
    this._visBound = false;
    /** resume() pedido por um gesto e ainda nao resolvido. */
    this._retomando = false;
  }

  /** Cria o contexto. Fica suspenso ate o primeiro gesto do usuario. */
  init() {
    if (this.ctx) return;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.platformMuted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 0.85 : 0;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.3 : 0;
      this.musicBus.connect(this.master);
      this.ctx.onstatechange = () => {
        if (this.ctx && this.ctx.state === 'running') this.unlocked = true;
      };
      this._bindVisibility();
      // decodificar nao precisa do contexto rodando: os arquivos chegam antes do primeiro toque
      for (const id of Object.keys(SONS_PLAYGAMA)) this._carregar(id);
    } catch {
      this.ctx = null;
    }
  }

  /**
   * Busca e decodifica um arquivo (uma vez).
   * @param {string} id
   */
  async _carregar(id) {
    if (this._buffers.has(id) || !this.ctx) return;
    this._buffers.set(id, 'carregando');
    try {
      const dados = await (this._dados.get(id) || fetch(SONS_PLAYGAMA[id].url).then((r) => (r.ok ? r.arrayBuffer() : null)));
      if (!dados) throw new Error(id);
      const ctx = this.ctx;
      const buf = await new Promise((ok, falha) => {
        const p = ctx.decodeAudioData(dados, ok, falha);
        if (p && typeof p.then === 'function') p.then(ok, falha);
      });
      this._buffers.set(id, /** @type {AudioBuffer} */ (buf));
      if (id === 'musica') this.updateMusic();
    } catch {
      this._buffers.set(id, 'falhou');
    }
  }

  /** Chamado no primeiro gesto real do usuario (toque, clique ou tecla). */
  unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') {
      this._retomando = true;
      this.ctx.resume().then(
        () => {
          this._retomando = false;
          this.unlocked = true;
        },
        () => {
          this._retomando = false;
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
    return !!this.ctx && (this.ctx.state === 'running' || !!this._retomando) && !this.adMuted && !this.platformMuted;
  }

  /**
   * Liga ou desliga o mudo da plataforma.
   * @param {boolean} on
   */
  setPlatformMute(on) {
    this.platformMuted = !!on;
    if (!this.ctx || !this.master || this.adMuted) return;
    try {
      this.master.gain.setTargetAtTime(on ? 0 : 1, this.ctx.currentTime, 0.02);
    } catch {
      /* ignora */
    }
  }

  /** @param {boolean} on */
  setSfx(on) {
    this.sfxOn = on;
    save('sfxOn', on);
    if (this.sfxBus && this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.02);
  }

  /** @param {boolean} on */
  setMusic(on) {
    this.musicOn = on;
    save('musicOn', on);
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.3 : 0, this.ctx.currentTime, 0.05);
    if (on) this.updateMusic();
  }

  /** Silencia tudo antes de um intervalo comercial (antes da chamada, como no original). */
  muteForAd() {
    this.adMuted = true;
    if (!this.ctx || !this.master) return;
    try {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      window.setTimeout(() => {
        if (this.adMuted && this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
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
          if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.platformMuted ? 0 : 1, this.ctx.currentTime, 0.05);
        },
        () => {},
      );
    } catch {
      /* ignora */
    }
  }

  /**
   * Toca um arquivo no barramento de efeitos.
   * @param {string} id
   * @param {{taxa?: number, vol?: number, atraso?: number}} [o]
   */
  _tocar(id, o = {}) {
    if (!this.ready || !this.sfxBus) return;
    const buf = this._buffers.get(id);
    if (!buf || typeof buf === 'string' || this._ativas >= MAX_FONTES) return;
    const ctx = /** @type {AudioContext} */ (this.ctx);
    try {
      const taxa = o.taxa || 1;
      const inicio = SONS_PLAYGAMA[id].inicio || 0;
      const t = ctx.currentTime + (o.atraso || 0) + 0.005;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      if (taxa !== 1) src.playbackRate.setValueAtTime(taxa, t);
      const g = ctx.createGain();
      g.gain.value = VOL * (o.vol === undefined ? 1 : o.vol);
      src.connect(g).connect(this.sfxBus);
      src.onended = () => {
        this._ativas--;
        try {
          g.disconnect();
        } catch {
          /* ignora */
        }
      };
      this._ativas++;
      src.start(t, inicio);
    } catch {
      /* ignora */
    }
  }

  // ---------------------------------------------------------- efeitos
  /** @param {number} [pitch] */
  click(pitch = 1) {
    this._tocar('clique', { taxa: pitch, vol: 0.8 });
  }

  button() {
    this._tocar('botao');
  }

  buttonBack() {
    this._tocar('voltar');
  }

  denied() {
    this._tocar('negado', { vol: 0.8 });
  }

  /**
   * @param {string} material
   * @param {number} [size] 0..1
   */
  breakPiece(material, size = 0.5) {
    const s = Math.max(0.2, Math.min(1, size));
    const q = QUEBRA[material] || { id: 'madeira' };
    this._tocar(q.id, { taxa: q.taxa, vol: (q.vol || 1) * (0.6 + 0.4 * s) });
  }

  /**
   * Batida de colisao, com limite de frequencia para nao empastar (o original).
   * @param {number} strength 0..1
   * @param {string} [material]
   */
  impact(strength, material = 'wood') {
    const now = this.now();
    if (now - this.lastImpactAt < 0.045) return;
    this.lastImpactAt = now;
    const s = Math.max(0.05, Math.min(1, strength));
    this._tocar(BATIDA[/** @type {'metal'|'stone'|'ice'} */ (material)] || 'batidaMadeira', { vol: 0.15 + 0.6 * s });
  }

  /** @param {number} index 0..2 */
  star(index) {
    const notas = [0, 4, 7, 12];
    this._tocar('estrela', { taxa: semitons(notas[Math.min(Math.max(0, index), notas.length - 1)]) });
  }

  /** @param {number} [index] */
  coin(index = 0) {
    this._tocar('moeda', { taxa: semitons(Math.min(index, 12) / 2), vol: 0.7 });
  }

  /** O ganho comum (moedas em dobro, skin, compra): o som curto de confirmacao. */
  win() {
    this._tocar('fimDeMundo');
  }

  /** O cartao de vitoria: a vinheta Clear. */
  winCard() {
    this._tocar('vitoria', { vol: 1.1 });
  }

  /** @param {boolean} [mundo] */
  yes(mundo = false) {
    this._tocar(mundo ? 'fimDeMundo' : 'passou');
  }

  prize() {
    this._tocar('premio');
  }

  /** A derrota sem cartao (o recomeco do fluxo) e o "voltar jogada": o som curto. */
  lose() {
    this._tocar('perdeu', { vol: 0.8 });
  }

  /** O cartao de derrota: a vinheta Failure. */
  loseCard() {
    this._tocar('derrota', { vol: 1.1 });
  }

  /**
   * Estouro da celebracao de fim de fase: a nota sobe com a contagem e a ultima
   * resolve duas oitavas acima, como no original.
   * @param {number} index 1..total
   * @param {number} total
   */
  bonusPop(index, total) {
    const n = Math.max(1, total);
    const i = Math.max(1, Math.min(n, index));
    const passo = Math.round((n > 1 ? (i - 1) / (n - 1) : 1) * 10);
    const ultima = i >= n;
    const semis = ultima ? 24 : PENTA[passo % PENTA.length] + 12 * Math.floor(passo / PENTA.length);
    this._tocar('bonus', { taxa: semitons(semis / 2), vol: ultima ? 1 : 0.8 });
  }

  /** @param {number} n 2 ou mais */
  combo(n) {
    const tamanho = Math.max(2, Math.min(6, n | 0));
    this._tocar('combo', { taxa: semitons(PENTA[(tamanho - 2) % PENTA.length]) });
  }

  land() {
    this._tocar('pouso', { vol: 0.7 });
  }

  whoosh() {
    this._tocar('sopro', { vol: 0.6 });
  }

  // ------------------------------------------------------------ musica
  /** Pausa do jogo: a musica cai e fica parada onde estava. */
  holdMusic() {
    if (this._musicHold) return;
    this._musicHold = true;
    this._fadeMusica(0, 0.15);
  }

  releaseMusic() {
    if (!this._musicHold) return;
    this._musicHold = false;
    this._fadeMusica(1, 0.4);
  }

  /** O tema de cada mundo trocava a trilha sintetizada; aqui a faixa e uma so. */
  setMusic_() {
    this.updateMusic();
  }

  /**
   * @param {number} alvo
   * @param {number} tau
   */
  _fadeMusica(alvo, tau) {
    if (!this._seguraMusica || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      this._seguraMusica.gain.cancelScheduledValues(t);
      this._seguraMusica.gain.setValueAtTime(this._seguraMusica.gain.value, t);
      this._seguraMusica.gain.setTargetAtTime(alvo, t, tau);
    } catch {
      /* ignora */
    }
  }

  /** Chamado a cada quadro (game/scene.js): comeca a faixa assim que puder, uma vez. */
  updateMusic() {
    if (this._musica || !this.ctx || !this.musicBus || !this.musicOn) return;
    if (this.ctx.state !== 'running' || this.adMuted || this.platformMuted || this._hidden) return;
    const buf = this._buffers.get('musica');
    if (!buf || typeof buf === 'string') return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const fade = ctx.createGain();
      fade.gain.setValueAtTime(0, t);
      fade.gain.linearRampToValueAtTime(GANHO_MUSICA, t + 3);
      fade.connect(this.musicBus);
      this._seguraMusica = ctx.createGain();
      this._seguraMusica.gain.value = this._musicHold ? 0 : 1;
      this._seguraMusica.connect(fade);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const [ini, fim] = lacoDaFaixa(buf.duration, SONS_PLAYGAMA.musica);
      src.loopStart = ini;
      src.loopEnd = fim;
      src.connect(this._seguraMusica);
      src.start(t + 0.05, ini);
      this._musica = src;
    } catch {
      this._musica = null;
    }
  }

  /** A aba escondida suspende o contexto (o som para e volta de onde estava). */
  _bindVisibility() {
    if (this._visBound || typeof document === 'undefined') return;
    this._visBound = true;
    const esconder = () => {
      this._hidden = true;
      if (this.adMuted || !this.ctx || this.ctx.state !== 'running') return;
      this.ctx.suspend().catch(() => {});
    };
    const mostrar = () => {
      this._hidden = false;
      if (this.adMuted || !this.ctx || !this.unlocked) return;
      this.ctx.resume().catch(() => {});
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) esconder();
      else mostrar();
    });
    window.addEventListener('pagehide', esconder);
    window.addEventListener('pageshow', mostrar);
  }
}

export const audio = new AudioEngine();
