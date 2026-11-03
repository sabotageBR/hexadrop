/**
 * O save na nuvem da Wavedash (Remote Storage, docs.wavedash.com/sdk/cloud-saves,
 * lido em 2026-11-03, e os tipos do @wvdsh/sdk-js 1.3.78).
 *
 * **Por que existe:** cada build da Wavedash roda noutra origem
 * (`<id>-c21ee9ed-<build>.builds.wavedashcdn.com`, medido no playtest: o build
 * #1 e o #2 tem o ultimo trecho diferente), e o localStorage de um build nao
 * aparece no seguinte. Sem a nuvem, cada atualizacao publicada zerava o
 * progresso de todo jogador, moedas compradas inclusive.
 *
 * O jogo continua gravando so pelo core/storage.js, como na CrazyGames
 * (src/crazy/save.js) e na Playgama (src/portais/save.js). Aqui:
 *
 * 1. **antes de main.js** (`hidrata`, do `_preparar` do adaptador), com prazo
 *    curto (`PRAZO_LEITURA_MS`): baixa o arquivo da nuvem e devolve ao
 *    localStorage o que falta nele, e o `save` quando o da nuvem e mais novo
 *    (`rev`) ou quando o local nunca leu a nuvem (`MARCA`, abaixo);
 * 2. SO ENTAO liga o espelho: cada gravacao vai para um mapa em memoria
 *    (chave -> texto cru, as de `CHAVES`), que sobe inteiro num arquivo so;
 * 3. **sobe nos pontos que contam**, e nunca acima do limite da Wavedash (30
 *    por minuto e 300 por hora, por jogador): o jogo grava no fim de fase, no
 *    fim de mundo, na loja e nos ajustes, e cada gravacao marca o mapa como
 *    sujo. O envio sai `ESPERA_MS` depois da primeira mudanca e no minimo
 *    `INTERVALO_MS` depois do anterior (no pior caso 4 por minuto, 240 por
 *    hora); a compra (`garante`) e a pagina escondida sobem na hora; e uma
 *    janela deslizante (`LIMITE_MINUTO`, `LIMITE_HORA`) segura qualquer envio
 *    acima disso. Envio que falha (rede, limite) volta depois de uma pausa
 *    crescente, ou do tempo que o SDK mandou esperar.
 *
 * **Sem ler a nuvem nao ha espelho.** Download que nao responde no prazo, ou
 * que falha sem ser "nao existe", deixa a sessao so no localStorage: gravar por
 * cima de um arquivo que nao foi lido apagaria o progresso de quem joga noutro
 * build ou aparelho. A leitura continua no fundo (e tenta de novo duas vezes);
 * se ela chegar e a nuvem nao for mais nova que o local, o espelho liga ali.
 *
 * **`MARCA`** (fora da nuvem): este localStorage ja leu a nuvem uma vez. Save
 * local sem ela nasceu numa sessao que nao conseguiu ler a nuvem - o primeiro
 * carregamento de um build novo com a rede fora -, e perde para o da nuvem
 * mesmo com `rev` maior: o `rev` dele contou so aquela sessao.
 *
 * **As compras so recebem o fulfill com a moeda na nuvem** (`garante`, que
 * src/portais/wavedash-pacotes.js chama depois do credito). Ver o comentario
 * de `garante`.
 *
 * Sem as funcoes de Remote Storage no SDK (SDK antigo, fora da Wavedash), nada
 * disso liga e o jogo segue so no localStorage, como na 1.0.20.
 */

import { comPrazo } from './base.js';
import { resposta } from './wavedash-pacotes.js';
import { entradasLocais, hidratar, definirEspelho, isPersistent, load, save, remove, PREFIXO } from '../core/storage.js';

/** O arquivo da nuvem: o save inteiro, um envio por vez. */
export const ARQUIVO = 'hexadrop-save.json';
/**
 * As chaves que vao para a nuvem (sem o prefixo). Chave nova no storage entra
 * aqui, como em src/crazy/save.js e src/portais/save.js.
 */
export const CHAVES = ['save', 'sfxOn', 'musicOn', 'lang', 'quality'];
/** Este localStorage ja leu a nuvem (so aqui; nunca sobe). */
export const MARCA = 'nuvemLida';

/** A leitura antes do jogo: estourado, o jogo abre so com o localStorage. */
export const PRAZO_LEITURA_MS = 3000;
/** Leitura que falhou tenta de novo no fundo, nestes intervalos. */
export const RELEITURAS_MS = [10000, 30000];
/** O envio sai este tempo depois da primeira mudanca... */
export const ESPERA_MS = 4000;
/** ...e nunca antes deste tempo depois do envio anterior. */
export const INTERVALO_MS = 15000;
/** Teto proprio, abaixo dos 30 por minuto e 300 por hora da Wavedash. */
export const LIMITE_MINUTO = 25;
export const LIMITE_HORA = 280;
/** Um envio (escrita local mais upload) que nao responde conta como falha. */
export const PRAZO_ENVIO_MS = 20000;
/** Pausa depois de uma falha, dobrando ate o teto. */
export const PAUSA_FALHA_MS = 30000;
export const PAUSA_MAX_MS = 300000;
/** Quanto uma compra espera a nuvem antes de desistir nesta sessao (sem fulfill). */
export const PRAZO_GARANTIA_MS = 180000;

const NA_NUVEM = new Set(CHAVES.map((c) => PREFIXO + c));
const CHAVE_SAVE = PREFIXO + 'save';

/**
 * @param {string|undefined|null} raw
 * @returns {number}
 */
function revDe(raw) {
  if (!raw) return -1;
  try {
    const d = JSON.parse(raw);
    return d && typeof d.rev === 'number' ? d.rev : 0;
  } catch {
    return -1;
  }
}

/**
 * So as chaves que vao para a nuvem.
 * @param {Record<string, string>} e
 * @returns {Record<string, string>}
 */
function soDaNuvem(e) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of Object.entries(e || {})) if (NA_NUVEM.has(k) && typeof v === 'string') out[k] = v;
  return out;
}

/**
 * O que volta da nuvem para o localStorage. Pura, para a automacao.
 *
 * O que falta no local vem da nuvem; o `save` da nuvem vence quando e mais novo
 * (`rev`), ou sempre que o local nao descende da nuvem (sem `MARCA`).
 * Preferencia que o aparelho ja tem (som, idioma, qualidade) fica.
 * @param {Record<string, string>} local
 * @param {Record<string, string>} nuvem
 * @param {boolean} descende o localStorage ja tinha lido a nuvem
 * @returns {Record<string, string>}
 */
export function oQueVolta(local, nuvem, descende) {
  /** @type {Record<string, string>} */
  const volta = {};
  for (const [k, v] of Object.entries(soDaNuvem(nuvem))) {
    if (local[k] === v) continue;
    if (!(k in local)) volta[k] = v;
    else if (k === CHAVE_SAVE && (!descende || revDe(v) > revDe(local[k]))) volta[k] = v;
  }
  return volta;
}

/**
 * @typedef {object} Espera
 * @property {number} alvo a versao do mapa que precisa estar na nuvem
 * @property {(ok: boolean) => void} resolve
 * @property {number} prazo
 */

export class NuvemWavedash {
  /** @param {() => *} sdk o `window.Wavedash`, ou null fora dela */
  constructor(sdk) {
    /** O SDK deste carregamento (nao muda depois que a pagina abre). */
    this._w = sdk();
    /** @type {'ausente'|'lendo'|'ligada'|'desligada'} */
    this.estado = this.disponivel ? 'desligada' : 'ausente';
    /** O que esta (ou vai estar) no arquivo da nuvem. @type {Record<string, string>} */
    this.mem = {};
    /** Cresce a cada mudanca do mapa; `confirmada` e a ultima que a nuvem tem. */
    this.versao = 0;
    this.confirmada = 0;
    this.sujo = false;
    this.enviando = false;
    this._denovo = false;
    this._timer = 0;
    this._quando = 0;
    this._ultimoEnvio = -Infinity;
    this._pausaAte = 0;
    this.falhas = 0;
    /** Inicio de cada envio na ultima hora, para a janela deslizante. @type {number[]} */
    this.envios = [];
    /** Compras esperando a nuvem. @type {Espera[]} */
    this._esperas = [];
    this._hidratou = false;
    if (this.estado !== 'ausente' && typeof document !== 'undefined' && document.addEventListener) {
      // Fechar a aba ou trocar de aplicativo: o que mudou sobe na hora (o SDK
      // manda arquivo pequeno com keepalive, que sobrevive a pagina saindo).
      const sai = () => {
        if (document.hidden && this.sujo) this._agenda(true);
      };
      document.addEventListener('visibilitychange', sai);
      if (typeof window.addEventListener === 'function') {
        window.addEventListener('pagehide', () => {
          if (this.sujo) this._agenda(true);
        });
      }
    }
  }

  /** O SDK tem o Remote Storage inteiro que o save usa. @returns {boolean} */
  get disponivel() {
    const w = this._w;
    return !!w && ['downloadRemoteFile', 'uploadRemoteFile', 'writeLocalFile', 'readLocalFile'].every((f) => typeof w[f] === 'function');
  }

  // ----------------------------------------------------------- leitura

  /**
   * Antes de main.js: le a nuvem, hidrata o localStorage e liga o espelho, ou,
   * sem resposta no prazo, deixa a sessao so no localStorage. Nunca rejeita.
   * @returns {Promise<void>}
   */
  async hidrata() {
    if (this._hidratou || this.estado === 'ausente') return;
    this._hidratou = true;
    this.estado = 'lendo';
    const leitura = this._le();
    const r = await comPrazo(leitura, PRAZO_LEITURA_MS, null);
    if (r && r.ok) {
      this._aplica(r.chaves, true);
      return;
    }
    this.estado = 'desligada';
    // Chegou tarde (ou falhou): a leitura segue no fundo e tenta de novo.
    const tarde = (/** @type {*} */ x) => {
      if (x && x.ok && this.estado === 'desligada') this._aplica(x.chaves, false);
      return !!(x && x.ok);
    };
    leitura.then((x) => {
      if (tarde(x) || this.estado !== 'desligada') return;
      let i = 0;
      const tenta = () => {
        if (this.estado !== 'desligada' || i >= RELEITURAS_MS.length) return;
        window.setTimeout(() => {
          this._le().then((y) => {
            if (!tarde(y)) tenta();
          });
        }, RELEITURAS_MS[i++]);
      };
      tenta();
    });
  }

  /**
   * Baixa e le o arquivo. `chaves` null: a nuvem nao tem arquivo (jogador novo).
   * @returns {Promise<{ok: boolean, chaves?: Record<string, string>|null}>}
   */
  async _le() {
    const w = this._w;
    try {
      const d = resposta(await w.downloadRemoteFile(ARQUIVO));
      if (!d.ok) {
        // O download diz "404" so na mensagem: o HEAD separa "nao existe" de
        // "nao deu para ler".
        if (typeof w.remoteFileExists !== 'function') return { ok: false };
        const e = resposta(await w.remoteFileExists(ARQUIVO));
        return e.ok && e.valor === false ? { ok: true, chaves: null } : { ok: false };
      }
      const lido = resposta(await w.readLocalFile(ARQUIVO));
      const bytes = lido.valor;
      if (!lido.ok || !bytes || typeof bytes.length !== 'number') return { ok: false };
      let dados = null;
      try {
        dados = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        dados = null;
      }
      // Arquivo ilegivel nao tem o que salvar: vale como nuvem vazia, e o
      // proximo envio o substitui.
      const chaves = dados && typeof dados === 'object' && dados.chaves && typeof dados.chaves === 'object' ? soDaNuvem(dados.chaves) : null;
      return { ok: true, chaves };
    } catch {
      return { ok: false };
    }
  }

  /**
   * A nuvem foi lida: hidrata (so antes do jogo) e liga o espelho.
   * @param {Record<string, string>|null|undefined} nuvem
   * @param {boolean} cedo antes de main.js; tarde, o save em memoria ja esta em uso
   */
  _aplica(nuvem, cedo) {
    const n = soDaNuvem(nuvem || {});
    const descende = load(MARCA, 0) === 1;
    const volta = oQueVolta(soDaNuvem(entradasLocais()), n, descende);
    if (cedo) {
      hidratar(volta);
    } else if (CHAVE_SAVE in volta) {
      // A nuvem tem um save mais novo, e o desta sessao ja esta na memoria do
      // jogo: ela vale na proxima abertura. A marca sai para a nuvem vencer
      // ali mesmo que o `rev` local cresca ate la.
      remove(MARCA);
      return;
    }
    save(MARCA, 1);
    const local = soDaNuvem(entradasLocais());
    this.mem = { ...n, ...local };
    const difere = Object.keys(this.mem).some((k) => this.mem[k] !== n[k]);
    definirEspelho({
      gravar: (chave, raw) => this._muda(chave, raw),
      apagar: (chave) => this._muda(chave, null),
    });
    this.estado = 'ligada';
    this.versao++;
    if (!difere && !this._esperas.length) this.confirmada = this.versao;
    else this.sujo = true;
    // A compra que esperava a nuvem ligar agora espera este estado subir.
    for (const e of this._esperas) e.alvo = this.versao;
    if (this.sujo) this._agenda(this._esperas.length > 0);
  }

  // ------------------------------------------------------------- envio

  /**
   * O espelho: cada gravacao do jogo.
   * @param {string} chave completa, com o prefixo
   * @param {string|null} raw null: apagada
   */
  _muda(chave, raw) {
    if (!NA_NUVEM.has(chave)) return;
    if (raw === null) {
      if (!(chave in this.mem)) return;
      delete this.mem[chave];
    } else {
      if (this.mem[chave] === raw) return;
      this.mem[chave] = raw;
    }
    this.versao++;
    this.sujo = true;
    this._agenda(false);
  }

  /**
   * Quando um envio cabe na janela deslizante.
   * @param {number} t
   * @returns {number}
   */
  _vaga(t) {
    this.envios = this.envios.filter((x) => t - x < 3600000);
    const noMinuto = this.envios.filter((x) => t - x < 60000);
    let vaga = t;
    if (noMinuto.length >= LIMITE_MINUTO) vaga = Math.max(vaga, noMinuto[noMinuto.length - LIMITE_MINUTO] + 60000);
    if (this.envios.length >= LIMITE_HORA) vaga = Math.max(vaga, this.envios[this.envios.length - LIMITE_HORA] + 3600000);
    return vaga;
  }

  /**
   * Agenda o proximo envio. O que ja estava agendado para antes fica.
   * @param {boolean} agora sem a espera e o intervalo (compra, pagina saindo)
   */
  _agenda(agora) {
    if (this.estado !== 'ligada') return;
    const t = Date.now();
    let quando = agora ? t : Math.max(t + ESPERA_MS, this._ultimoEnvio + INTERVALO_MS);
    quando = Math.max(quando, this._pausaAte, this._vaga(t));
    if (this._timer && this._quando <= quando) return;
    window.clearTimeout(this._timer);
    this._quando = quando;
    this._timer = window.setTimeout(() => {
      this._timer = 0;
      this._envia();
    }, Math.max(0, quando - t));
  }

  async _envia() {
    if (this.estado !== 'ligada') return;
    if (this.enviando) {
      this._denovo = true;
      return;
    }
    if (!this.sujo) return;
    const t = Date.now();
    if (this._vaga(t) > t || this._pausaAte > t) {
      this._agenda(true);
      return;
    }
    this.enviando = true;
    this.sujo = false;
    const versao = this.versao;
    this.envios.push(t);
    this._ultimoEnvio = t;
    const r = await comPrazo(this._sobe(), PRAZO_ENVIO_MS, { ok: false, msg: '' });
    this.enviando = false;
    if (r.ok) {
      this.falhas = 0;
      this.confirmada = Math.max(this.confirmada, versao);
      this._solta();
    } else {
      this.sujo = true;
      this.falhas++;
      const pedido = /(\d+)\s*s\b/.exec(r.msg || '');
      const pausa = Math.min(PAUSA_MAX_MS, PAUSA_FALHA_MS * 2 ** (this.falhas - 1));
      this._pausaAte = Date.now() + Math.max(pausa, pedido ? (Number(pedido[1]) + 1) * 1000 : 0);
    }
    if (this.sujo || this._denovo) {
      this._denovo = false;
      this.sujo = true;
      this._agenda(this._esperas.some((e) => e.alvo > this.confirmada));
    }
  }

  /**
   * Um envio: o mapa inteiro no arquivo local do SDK, e dele para a nuvem.
   * @returns {Promise<{ok: boolean, msg: string}>}
   */
  async _sobe() {
    const w = this._w;
    try {
      const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, chaves: this.mem }));
      const escrito = resposta(await w.writeLocalFile(ARQUIVO, bytes));
      if (!escrito.ok || escrito.valor === false) return { ok: false, msg: '' };
      const r = resposta(await w.uploadRemoteFile(ARQUIVO));
      return { ok: r.ok, msg: r.ok ? '' : String(r.message || '') };
    } catch (e) {
      return { ok: false, msg: String((e && /** @type {*} */ (e).message) || '') };
    }
  }

  /** Solta as compras cujo estado ja esta na nuvem. */
  _solta() {
    const fica = [];
    for (const e of this._esperas) {
      if (e.alvo <= this.confirmada) {
        window.clearTimeout(e.prazo);
        e.resolve(true);
      } else {
        fica.push(e);
      }
    }
    this._esperas = fica;
  }

  /**
   * A gravacao local de agora ja esta na nuvem? E o que libera o
   * `fulfillPurchase` de uma compra, e a ordem e esta: credito -> gravacao
   * local (o espelho poe no mapa) -> envio imediato -> fulfill so com o envio
   * confirmado. Se a nuvem nao confirmar nesta sessao (fora do ar, limite,
   * pagina fechando), nao ha fulfill: a Wavedash entrega a compra de novo na
   * proxima abertura, e o save que a nuvem devolver ali ou ja tem o
   * `purchaseId` (so recebe o fulfill) ou nao tem (credita de novo, porque o
   * save que tinha a moeda nunca chegou a nuvem). Na ordem contraria, um
   * fulfill antes de a moeda subir perderia a compra no build seguinte.
   *
   * Sem Remote Storage no SDK, vale o localStorage, como na 1.0.20.
   * @returns {Promise<boolean>}
   */
  garante() {
    if (this.estado === 'ausente') return Promise.resolve(isPersistent());
    if (this.estado === 'ligada' && !this.sujo && !this.enviando && this.confirmada >= this.versao) return Promise.resolve(true);
    return new Promise((resolve) => {
      /** @type {Espera} */
      const espera = { alvo: this.versao, resolve, prazo: 0 };
      espera.prazo = window.setTimeout(() => {
        this._esperas = this._esperas.filter((e) => e !== espera);
        resolve(false);
      }, PRAZO_GARANTIA_MS);
      this._esperas.push(espera);
      if (this.estado === 'ligada') {
        this.sujo = true;
        this._agenda(true);
      }
    });
  }
}
