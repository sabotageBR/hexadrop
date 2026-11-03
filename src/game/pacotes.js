/**
 * Os pacotes de moedas pagos (Paid Content da Wavedash, do tipo consumivel) e
 * o credito de cada compra no save.
 *
 * So o build da Wavedash chega aqui (`COM_PACOTES` em core/platform.js). Nos
 * outros nenhum caminho usa este modulo, o Rollup o tira do bundle e eles saem
 * byte a byte iguais.
 *
 * - O `id` de cada pacote e o "content identifier" da oferta no painel da
 *   Wavedash, que nao muda depois de criada. Compra de outro id nao e nossa:
 *   nao credita nada e nao e dada por entregue.
 * - **As moedas vao para o saldo, e so para ele.** A barra do hexagono conta
 *   as moedas ganhas no proprio mundo (`barraMoedas`, Progress.contaBarra), e
 *   uma compra nao adianta a sequencia de premios: o fim do mundo continua
 *   sendo o unico que compra o hexagono da barra.
 * - **`compras` no save**: os `purchaseId` ja creditados, criada na primeira
 *   compra e sem trocar SAVE_VERSION (o `{...blank(), ...stored}` do construtor
 *   de Progress preserva o campo). A Wavedash entrega de novo, a cada abertura
 *   do jogo, toda compra que ainda nao recebeu o `fulfillPurchase`, e a mesma
 *   compra pode chegar duas vezes: a lista e o que segura o credito em um so.
 *   As moedas e o id entram na MESMA gravacao, e o fulfill so vem depois dela
 *   (src/portais/wavedash-pacotes.js).
 */

/**
 * @typedef {object} Pacote
 * @property {string} id      content identifier da oferta na Wavedash
 * @property {number} moedas
 * @property {boolean} melhor o de melhor preco por moeda, com o selo na loja
 */

/** @type {Pacote[]} */
export const PACOTES = [
  { id: 'coins-1500', moedas: 1500, melhor: false },
  { id: 'coins-5000', moedas: 5000, melhor: true },
];

/**
 * @param {string} id content identifier
 * @returns {Pacote|null}
 */
export function pacote(id) {
  return PACOTES.find((p) => p.id === id) || null;
}

/**
 * A lista de compras ja creditadas, criada se ainda nao existe.
 * @param {*} progress game/progress.js
 * @returns {string[]}
 */
function creditadas(progress) {
  const d = progress.data;
  if (!Array.isArray(d.compras)) d.compras = [];
  return d.compras;
}

/**
 * Esta compra ja virou moeda neste save?
 * @param {*} progress
 * @param {string} purchaseId
 * @returns {boolean}
 */
export function compraCreditada(progress, purchaseId) {
  return Array.isArray(progress.data.compras) && progress.data.compras.includes(purchaseId);
}

/**
 * Credita uma compra, uma vez so: as moedas no saldo e o `purchaseId` na
 * lista, gravados juntos.
 * @param {*} progress
 * @param {string} purchaseId
 * @param {string} id content identifier
 * @returns {'novo'|'repetido'|null} null: pacote que nao e deste jogo (nada muda)
 */
export function creditaCompra(progress, purchaseId, id) {
  const p = pacote(id);
  if (!p || typeof purchaseId !== 'string' || !purchaseId) return null;
  const lista = creditadas(progress);
  if (lista.includes(purchaseId)) return 'repetido';
  progress.data.coins += p.moedas;
  lista.push(purchaseId);
  progress.flush();
  return 'novo';
}

/**
 * Desfaz um credito que acabou de entrar: o `fulfillPurchase` respondeu
 * NOT_FOUND (a compra nao existe para este jogador, ou foi estornada antes do
 * fulfill), e a regra da Wavedash e nao entregar. O id sai da lista - se a
 * compra voltar valida, ela credita de novo - e o saldo nunca fica negativo.
 * @param {*} progress
 * @param {string} purchaseId
 * @param {string} id content identifier
 * @returns {boolean} se havia o que desfazer
 */
export function estornaCompra(progress, purchaseId, id) {
  const p = pacote(id);
  const lista = creditadas(progress);
  const i = lista.indexOf(purchaseId);
  if (!p || i < 0) return false;
  lista.splice(i, 1);
  progress.data.coins = Math.max(0, progress.data.coins - p.moedas);
  progress.flush();
  return true;
}

/**
 * "Apagar progresso" nos ajustes, guardando a lista das compras ja creditadas.
 * As moedas vao embora com o resto (foi o jogador que apagou), mas a compra
 * cujo fulfill falhou continua sendo entregue a cada abertura: sem a lista,
 * ela creditaria de novo no save zerado.
 * @param {*} progress
 */
export function zeraGuardandoCompras(progress) {
  const lista = Array.isArray(progress.data.compras) ? progress.data.compras.slice() : [];
  progress.reset();
  if (!lista.length) return;
  progress.data.compras = lista;
  progress.flush();
}
