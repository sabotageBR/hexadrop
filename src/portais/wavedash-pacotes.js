/**
 * Os pacotes de moedas da Wavedash (Paid Content consumivel): o lado do SDK.
 * docs.wavedash.com/sdk/paid-content/consumables, lido em 2026-11-03, e os
 * tipos do @wvdsh/sdk-js 1.3.78.
 *
 * Quem decide o que cada pacote da e onde ele fica gravado e o jogo
 * (game/pacotes.js, ligado por main.js em `liga`). Aqui fica o protocolo:
 *
 * - **o ouvinte do PURCHASE_COMPLETED entra antes do `Wavedash.init()`**: o
 *   SDK guarda os eventos ate o init e os solta dentro dele, e as compras sem
 *   fulfill chegam ali, a cada abertura do jogo. Ele nasce com o adaptador
 *   (src/portais/wavedash.js), na avaliacao do modulo. Ate main.js ligar o
 *   credito (`liga`), as compras esperam numa fila;
 * - **credito antes do fulfill**: o jogo credita e grava, e so depois sai o
 *   `fulfillPurchase`. Se a pagina fechar no meio, a compra volta na proxima
 *   abertura e o `purchaseId` gravado impede o segundo credito. Sem save que
 *   dure (localStorage bloqueado), a compra vale para a sessao e nao recebe o
 *   fulfill: na proxima abertura ela volta, em vez de sumir com o save;
 * - **a mesma compra pode chegar mais de uma vez** (evento e lista, duas
 *   abas, a reentrega): a que ja esta sendo tratada nao comeca de novo, e o
 *   save diz se ela ja virou moeda;
 * - **NOT_FOUND** no fulfill (compra estornada ou desconhecida) desfaz o
 *   credito que acabou de entrar. Compra creditada numa sessao anterior fica
 *   como esta;
 * - **so consumivel de pacote conhecido**: outro id nao credita e nao recebe
 *   fulfill (fica para quem o conhecer);
 * - **`getUnfulfilledPurchases` depois do init**, uma vez (`revisa`): a
 *   segunda chance do fulfill que falhou, porque cada compra e entregue uma vez
 *   so por sessao. A mesma revisao roda se o checkout disser que comprou e o
 *   evento nao chegar em `ESPERA_EVENTO_MS` - o credito sai da lista do
 *   servidor, nunca do resultado do checkout;
 * - **nada aqui atrasa o init**: o ouvinte so registra, e a revisao sai depois
 *   dele, sem que ninguem espere por ela.
 *
 * Toda resposta do SDK e aceita como `{success, data, message}` (o formato da
 * 1.3.78) ou como o valor puro.
 */

import { comPrazo } from './base.js';
import { isPersistent } from '../core/storage.js';

/** Prazo do fulfill e da lista de compras pendentes; estourado, conta como falha. */
export const PRAZO_SDK_MS = 15000;
/** Checkout confirmado e nenhum evento ate aqui: a lista do servidor e consultada. */
export const ESPERA_EVENTO_MS = 6000;

/**
 * @typedef {object} Compra
 * @property {string} purchaseId
 * @property {string} id content identifier
 */

/**
 * O credito, do lado do jogo: 'novo' creditou agora, 'repetido' ja estava no
 * save, qualquer outra coisa nao deixa dar a compra por entregue.
 * @typedef {(c: Compra) => ('novo'|'repetido'|null|undefined)} Credita
 */

/**
 * `{success, data}` ou o valor puro.
 * @param {*} r
 * @returns {{ok: boolean, valor: *}}
 */
function resposta(r) {
  if (r && typeof r === 'object' && typeof r.success === 'boolean' && !Array.isArray(r)) {
    return { ok: r.success, valor: r.success ? r.data : undefined };
  }
  return { ok: r !== undefined && r !== null, valor: r };
}

export class PacotesWavedash {
  /** @param {() => *} sdk o `window.Wavedash`, ou null fora dela */
  constructor(sdk) {
    this._sdk = sdk;
    /** O ouvinte do PURCHASE_COMPLETED esta registrado. */
    this.ouvindo = false;
    /** Um checkout aberto: a loja trava os botoes ate ele responder. */
    this.abrindo = false;
    /** Compras que chegaram antes de main.js ligar o credito. @type {Compra[]} */
    this._fila = [];
    /** Compras sendo tratadas agora, por purchaseId. @type {Map<string, Promise<void>>} */
    this._emCurso = new Map();
    /** @type {Credita|null} */
    this._credita = null;
    /** @type {null|((c: Compra) => void)} */
    this._estorna = null;
    /** Creditos desde a abertura (o checkout confirmado espera o seu). */
    this.creditos = 0;
    this._ouve();
  }

  /**
   * O SDK tem o que a loja precisa: o ouvinte, o checkout e o fulfill. Sem
   * isso (fora da Wavedash, SDK antigo) a secao de moedas nem aparece.
   * @returns {boolean}
   */
  get disponivel() {
    const w = this._sdk();
    return !!w && this.ouvindo && typeof w.triggerPaywall === 'function' && typeof w.fulfillPurchase === 'function';
  }

  _ouve() {
    const w = this._sdk();
    if (!w || typeof w.on !== 'function') return;
    const nome = (w.Events && w.Events.PURCHASE_COMPLETED) || 'PurchaseCompleted';
    try {
      w.on(nome, (/** @type {*} */ p) => this.recebe(p));
      this.ouvindo = true;
    } catch {
      this.ouvindo = false;
    }
  }

  /**
   * main.js pronto para creditar: liga o jogo e solta a fila.
   * @param {Credita} credita
   * @param {(c: Compra) => void} estorna
   */
  liga(credita, estorna) {
    this._credita = credita;
    this._estorna = estorna;
    const fila = this._fila;
    this._fila = [];
    for (const c of fila) this._trata(c);
  }

  /**
   * Uma entrega: o PURCHASE_COMPLETED ou um item da lista de pendentes.
   * @param {*} p
   */
  recebe(p) {
    try {
      if (!p || typeof p !== 'object') return;
      const { purchaseId, contentIdentifier } = p;
      if (typeof purchaseId !== 'string' || !purchaseId || typeof contentIdentifier !== 'string') return;
      // Durable a Wavedash ja entregou (e este jogo nao tem nenhum); consumivel
      // ja dado por entregue foi creditado em outro save.
      if (String(p.type).toUpperCase() !== 'CONSUMABLE' || p.fulfilled === true) return;
      const c = { purchaseId, id: contentIdentifier };
      if (!this._credita) {
        if (!this._fila.some((x) => x.purchaseId === purchaseId)) this._fila.push(c);
        return;
      }
      this._trata(c);
    } catch {
      /* entrega malformada: nada muda, e a compra volta na proxima abertura */
    }
  }

  /**
   * @param {Compra} c
   * @returns {Promise<void>}
   */
  _trata(c) {
    const ja = this._emCurso.get(c.purchaseId);
    if (ja) return ja;
    const feito = this._creditaEEntrega(c).finally(() => this._emCurso.delete(c.purchaseId));
    this._emCurso.set(c.purchaseId, feito);
    return feito;
  }

  /**
   * O credito sai na hora, dentro da entrega; o fulfill depois da gravacao.
   * @param {Compra} c
   */
  async _creditaEEntrega(c) {
    let r = null;
    try {
      r = this._credita ? this._credita(c) : null;
    } catch {
      r = null;
    }
    if (r !== 'novo' && r !== 'repetido') return;
    if (r === 'novo') this.creditos++;
    if (!isPersistent()) return;
    const status = await this._entregue(c.purchaseId);
    if (status === 'NOT_FOUND' && r === 'novo' && this._estorna) {
      try {
        this._estorna(c);
      } catch {
        /* ignora */
      }
    }
  }

  /**
   * O `fulfillPurchase`, com prazo.
   * @param {string} purchaseId
   * @returns {Promise<string>} FULFILLED, ALREADY_FULFILLED, NOT_FOUND ou '' (falhou)
   */
  async _entregue(purchaseId) {
    const w = this._sdk();
    if (!w || typeof w.fulfillPurchase !== 'function') return '';
    const r = resposta(await comPrazo(Promise.resolve().then(() => w.fulfillPurchase(purchaseId)), PRAZO_SDK_MS, null));
    if (!r.ok) return '';
    const status = r.valor && typeof r.valor === 'object' ? r.valor.status : r.valor;
    return status === 'FULFILLED' || status === 'ALREADY_FULFILLED' || status === 'NOT_FOUND' ? status : '';
  }

  /**
   * As compras que o servidor ainda tem sem fulfill, tratadas como entrega.
   * Espera antes o que ja esta em curso: o fulfill que falhou ali tem aqui a
   * segunda chance.
   * @returns {Promise<void>}
   */
  async revisa() {
    const w = this._sdk();
    if (!w || typeof w.getUnfulfilledPurchases !== 'function') return;
    await Promise.all([...this._emCurso.values()]);
    const r = resposta(await comPrazo(Promise.resolve().then(() => w.getUnfulfilledPurchases()), PRAZO_SDK_MS, null));
    if (!r.ok || !Array.isArray(r.valor)) return;
    for (const p of r.valor) this.recebe(p);
  }

  /**
   * Abre o checkout da Wavedash. O credito nunca sai daqui: vem do
   * PURCHASE_COMPLETED (ou da lista do servidor, se o evento atrasar).
   * @param {string} id content identifier
   * @returns {Promise<'ok'|'cancelado'|'erro'>}
   */
  async comprar(id) {
    const w = this._sdk();
    if (this.abrindo) return 'cancelado';
    if (!this.disponivel) return 'erro';
    this.abrindo = true;
    const antes = this.creditos;
    let saida = /** @type {'ok'|'cancelado'|'erro'} */ ('erro');
    try {
      const r = resposta(await w.triggerPaywall(id));
      saida = !r.ok ? 'erro' : r.valor === true ? 'ok' : 'cancelado';
    } catch {
      saida = 'erro';
    } finally {
      this.abrindo = false;
    }
    if (saida === 'ok') {
      window.setTimeout(() => {
        if (this.creditos === antes) this.revisa().catch(() => {});
      }, ESPERA_EVENTO_MS);
    }
    return saida;
  }
}
