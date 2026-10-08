/**
 * A compra que tira os anuncios ("remover_anuncios", nao consumivel).
 *
 * Tira so o intersticial: o video recompensado continua, porque ele so existe
 * quando o jogador escolhe assistir para ganhar algo - e o padrao do genero.
 *
 * A loja e a fonte da verdade, mas a flag fica gravada numa chave propria
 * (`semAnuncios`), fora do save: `Progress.reset()` zera o save, e reiniciar o
 * progresso nao pode devolver os anuncios a quem pagou para tira-los. Ela vale
 * offline, e uma consulta que volta vazia ou falha NUNCA a desliga.
 *
 * No Android a compra tem que ser reconhecida (acknowledge) em 3 dias, senao o
 * Play estorna. O plugin reconhece na hora da compra; `verificar()` reconhece o
 * que tiver escapado - uma compra pendente (pagamento em dinheiro) que so se
 * concluiu depois, com o app fechado.
 */

import { load, save } from '../core/storage.js';

const CHAVE = 'semAnuncios';

export class Compras {
  /**
   * @param {*} loja o `loja` do backend
   * @param {string} produto
   */
  constructor(loja, produto) {
    this.l = loja;
    this.produto = produto;
    this.suportada = false;
    /** Preco da loja, ja no formato e na moeda do jogador. @type {string|null} */
    this.preco = null;
    this.comprado = load(CHAVE, false) === true;
    /** @type {null|(()=>void)} */
    this.onMudou = null;
    /** @type {Promise<void>|null} */
    this._verificando = null;
  }

  /** Disponivel para o jogo mostrar o botao: loja respondeu e tem preco. */
  get disponivel() {
    return this.suportada && !!this.preco;
  }

  async iniciar() {
    try {
      this.suportada = await this.l.suportada();
    } catch {
      this.suportada = false;
    }
    if (this.suportada) {
      try {
        this.preco = await this.l.preco(this.produto);
      } catch {
        this.preco = null;
      }
      await this.verificar();
    }
    this._avisa();
  }

  /** Consulta a loja e reconhece o que faltar. So liga, nunca desliga. */
  verificar() {
    if (!this.suportada) return Promise.resolve();
    if (this._verificando) return this._verificando;
    this._verificando = (async () => {
      try {
        const lista = await this.l.compras(this.produto);
        for (const c of lista) {
          if (c.estado !== 'comprado') continue;
          if (c.token && c.reconhecida === false) {
            try {
              await this.l.reconhecer(c.token);
            } catch {
              /* tenta de novo na proxima verificacao */
            }
          }
          this._marca();
        }
      } catch {
        /* sem resposta: fica como estava */
      } finally {
        this._verificando = null;
      }
    })();
    return this._verificando;
  }

  /** @returns {Promise<'ok'|'pendente'|'cancelado'|'erro'>} */
  async comprar() {
    if (!this.suportada) return 'erro';
    const r = await this.l.comprar(this.produto);
    if (r === 'ok') {
      this._marca();
      await this.verificar();
    }
    return r;
  }

  /** @returns {Promise<boolean>} se ha compra valendo depois de restaurar */
  async restaurar() {
    if (!this.suportada) return this.comprado;
    try {
      await this.l.restaurar();
    } catch {
      /* segue para a consulta */
    }
    await this.verificar();
    return this.comprado;
  }

  _marca() {
    if (this.comprado) return;
    this.comprado = true;
    save(CHAVE, true);
    this._avisa();
  }

  _avisa() {
    if (this.onMudou) this.onMudou();
  }
}
