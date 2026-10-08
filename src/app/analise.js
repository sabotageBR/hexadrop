/**
 * Telemetria do app no Firebase Analytics.
 *
 * O jogo fala `measure(categoria, oque, acao)`, o mesmo das tres abas de Game
 * Events da Poki, e esta traducao leva isso para eventos do Firebase sem mudar
 * nenhum ponto de chamada em main.js:
 *
 * - `level/N/start` vira `level_start {level_name, n}` e `level/N/complete|fail`
 *   viram `level_end {level_name, n, success}`: sao os eventos recomendados do
 *   GA4 para jogos, e os relatorios de nivel ja nascem prontos.
 * - o resto vira `<categoria>_<acao>` com `{oque, n}`, onde `n` e o numero no
 *   fim de `oque` (`tempo/min-5` da n=5, `level/12/tap1` da n=12). Assim o funil
 *   por fase e os marcos de tempo saem de um filtro numerico, e o numero de
 *   nomes distintos fica pequeno e fixo - o Firebase aceita 500.
 *
 * Regras do Firebase: nome com letras, numeros e `_`, comecando por letra, ate
 * 40 caracteres; valor de parametro ate 100 caracteres.
 */

const LIMITE_NOME = 40;
const LIMITE_VALOR = 100;

/**
 * Um nome qualquer dentro das regras do Firebase.
 * @param {string} bruto
 * @returns {string}
 */
export function limpaNome(bruto) {
  let nome = String(bruto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!/^[a-z]/.test(nome)) nome = 'e_' + nome;
  // Prefixos que o Firebase reserva para si.
  if (/^(firebase_|google_|ga_)/.test(nome)) nome = 'x_' + nome;
  return nome.slice(0, LIMITE_NOME);
}

/**
 * @param {string} categoria
 * @param {string} acao
 * @returns {string}
 */
export function nomeDoEvento(categoria, acao) {
  return limpaNome(`${categoria}_${acao}`);
}

/**
 * @param {string} categoria
 * @param {string|number} oque
 * @param {string} acao
 * @returns {{nome:string, params:Record<string, string|number>}}
 */
export function traduz(categoria, oque, acao) {
  const o = String(oque).slice(0, LIMITE_VALOR);
  const m = /(\d+)$/.exec(o);
  /** @type {Record<string, string|number>} */
  const params = {};
  if (m) params.n = Number(m[1]);
  if (categoria === 'level' && acao === 'start') {
    return { nome: 'level_start', params: { level_name: o, ...params } };
  }
  if (categoria === 'level' && (acao === 'complete' || acao === 'fail')) {
    return { nome: 'level_end', params: { level_name: o, ...params, success: acao === 'complete' ? 1 : 0 } };
  }
  return { nome: nomeDoEvento(categoria, acao), params: { oque: o, ...params } };
}

export class Analise {
  /** @param {*} analytics o `analytics` do backend */
  constructor(analytics) {
    this.a = analytics;
  }

  /**
   * @param {string} categoria
   * @param {string|number} oque
   * @param {string} acao
   */
  medir(categoria, oque, acao) {
    const { nome, params } = traduz(categoria, oque, acao);
    this.a.evento(nome, params);
  }

  /**
   * @param {string} nome
   * @param {Record<string, string|number>} [params]
   */
  evento(nome, params = {}) {
    this.a.evento(limpaNome(nome), params);
  }

  /**
   * @param {string} chave
   * @param {string} valor
   */
  propriedade(chave, valor) {
    this.a.propriedade(chave, String(valor).slice(0, 36));
  }

  /** @param {boolean} concedido */
  consentimento(concedido) {
    this.a.consentimento(concedido);
  }
}
