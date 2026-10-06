/**
 * Modelos do hexagono.
 *
 * Ate aqui a skin do hexagono mudava SO cor: `fill`, `stroke`, `core` e uma
 * marca opcional desenhada por cima. A forma era sempre o mesmo hexagono liso
 * com um gradiente radial. Este modulo separa o ESTILO DE CONSTRUCAO da cor,
 * do mesmo jeito que `lookFor()` faz com as pecas.
 *
 * Restricao que vale para todos: a silhueta e sempre a mesma - seis vertices
 * em (PI/3)*i, topo e base planos, vertices a esquerda e a direita. Ela esta
 * copiada em `physics/world.js` (o poligono do corpo rigido), e um modelo que
 * mudasse a silhueta faria o jogador ver a peca encaixar num canto que
 * fisicamente nao existe - alem de invalidar o balanceamento de todas as fases
 * ja validadas. A variacao vem do miolo, das arestas, do ornamento e do
 * brilho, nunca do contorno.
 *
 * Este arquivo nao toca no DOM e nao importa nada do jogo: serve igual ao
 * sprite do jogo, a vitrine da loja e a galeria de prototipo.
 */

/** @typedef {{fill:string, stroke:string, core:string}} Cores */

export const HEX_MODELS = [
  { id: 'joia', nome: 'Joia chapada', desc: 'O padrao: facetas chapadas, mesa no centro e contorno fino.' },
  { id: 'liso', nome: 'Liso', desc: 'O padrao antigo: corpo em degrade radial e contorno aceso.' },
  { id: 'cristal', nome: 'Cristal facetado', desc: 'Seis facetas do centro para as arestas.' },
  { id: 'neon', nome: 'Tubo de neon', desc: 'Vao escuro, fio vivo e miolo translucido.' },
  { id: 'placa', nome: 'Placa metalica', desc: 'Chapa escovada, chanfro e seis rebites.' },
  { id: 'nucleo', nome: 'Nucleo de energia', desc: 'Anel aceso, raios e miolo pulsante.' },
  { id: 'gema', nome: 'Gema lapidada', desc: 'Mesa no topo e pavilhao em volta.' },
  { id: 'favo', nome: 'Favo de mel', desc: 'Colmeia por dentro da silhueta.' },
  { id: 'vidro', nome: 'Vidro soprado', desc: 'Corpo translucido com reflexo oval.' },
  { id: 'origami', nome: 'Origami', desc: 'Papel dobrado em duas metades e vincos.' },
  { id: 'ouro', nome: 'Ouro macico', desc: 'Metal polido com varredura de luz.' },
  { id: 'selo', nome: 'Selo runico', desc: 'Pedra com runa gravada e acesa.' },
  // Os nove abaixo nasceram com os premios de mundo (1.0.8). Todos na gramatica
  // da joia: tons chapados, contorno fino por dentro, sem halo e sem mancha
  // radial - o que o Evandro rejeita nos modelos de cima que acendem o miolo.
  { id: 'catavento', nome: 'Catavento', desc: 'Seis pas em dois tons, girando em volta do miolo.' },
  { id: 'listras', nome: 'Listras', desc: 'Listras diagonais de bala, sombra embaixo.' },
  { id: 'roseta', nome: 'Roseta', desc: 'Hexagonos encaixados, cada um girado meio passo.' },
  { id: 'estrela', nome: 'Estrela', desc: 'Estrela de seis pontas embutida no corpo.' },
  { id: 'duo', nome: 'Duo', desc: 'Duas metades na diagonal e um filete claro na emenda.' },
  { id: 'bolinhas', nome: 'Bolinhas', desc: 'Bolinhas chapadas em grade.' },
  { id: 'pixel', nome: 'Pixel', desc: 'O hexagono em pixel art, luz de cima.' },
  { id: 'carinha', nome: 'Carinha', desc: 'A joia com olhos e sorriso.' },
  { id: 'xadrez', nome: 'Xadrez', desc: 'Losangos em dois tons.' },
  // Os quatorze da 1.0.12, escolhidos pelo Evandro na galeria de 92
  // (prototypes/galeria.html). Recortados pela silhueta; ver `DESENHOS`.
  { id: 'feliz', nome: 'Feliz', desc: 'Carinha sorrindo, bochechas rosadas.' },
  { id: 'descolado', nome: 'Descolado', desc: 'Oculos escuros e meio sorriso.' },
  { id: 'bravo', nome: 'Bravo', desc: 'Sobrancelhas franzidas e boca para baixo.' },
  { id: 'robo', nome: 'Robo', desc: 'Visor com olhos de LED e rebites.' },
  { id: 'caveirinha', nome: 'Caveirinha', desc: 'Caveira de olhos rosados sobre o roxo.' },
  { id: 'melancia', nome: 'Melancia', desc: 'Fatia com casca, miolo e sementes.' },
  { id: 'pizza', nome: 'Pizza', desc: 'Borda, queijo, calabresa e manjericao.' },
  { id: 'queijo', nome: 'Queijo', desc: 'Queijo com furos.' },
  { id: 'ovo', nome: 'Ovo frito', desc: 'Clara e gema.' },
  { id: 'futebol', nome: 'Bola de futebol', desc: 'Gomos pretos sobre o branco.' },
  { id: 'basquete', nome: 'Bola de basquete', desc: 'Laranja com as costuras.' },
  { id: 'relogio', nome: 'Relogio', desc: 'Mostrador com ponteiros.' },
  { id: 'controle', nome: 'Controle', desc: 'Controle de videogame.' },
  { id: 'escoces', nome: 'Xadrez escoces', desc: 'Tecido xadrez vermelho.' },
];

export const HEX_MODEL_IDS = HEX_MODELS.map((m) => m.id);

// --------------------------------------------------------------- cor -------

/** @param {string} cor @returns {number[]} */
function rgb(cor) {
  if (cor.startsWith('rgb')) {
    const m = cor.match(/[\d.]+/g);
    return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : [255, 255, 255];
  }
  const h = cor.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

/** @param {string} cor @param {number} a @returns {string} */
function alfa(cor, a) {
  const c = rgb(cor);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

/**
 * @param {string} cor
 * @param {string} outra
 * @param {number} t 0 = cor, 1 = outra
 * @returns {string}
 */
function mistura(cor, outra, t) {
  const a = rgb(cor);
  const b = rgb(outra);
  const m = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}

/** @param {string} cor @param {number} t */
const claro = (cor, t) => mistura(cor, '#ffffff', t);
/** @param {string} cor @param {number} t */
const escuro = (cor, t) => mistura(cor, '#000000', t);

/** Luminancia percebida, 0 a 255 - a mesma conta de `render/sprites.js`. */
function lum(cor) {
  const [r, g, b] = rgb(cor);
  return r * 0.299 + g * 0.587 + b * 0.114;
}

// ------------------------------------------------------------ geometria ----

/**
 * A silhueta, identica a de physics/world.js (com o y invertido, porque o
 * canvas cresce para baixo).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {number} [giro] em radianos, so para ornamento interno
 */
export function hexPath(ctx, cx, cy, r, giro = 0) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + giro;
    const x = cx + r * Math.cos(a);
    const y = cy - r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Vertice i da silhueta. @returns {number[]} */
function vert(cx, cy, r, i, giro = 0) {
  const a = (Math.PI / 3) * i + giro;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

// -------------------------------------------------------------- modelos ----

/**
 * Contorno da gramatica chapada, o mesmo da joia: por dentro da silhueta, a
 * propria cor um passo adiante - escurece corpo claro, clareia corpo escuro.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx @param {number} cy @param {number} r
 * @param {string} corpo
 */
function filete(ctx, cx, cy, r, corpo) {
  const largura = r * 0.05;
  ctx.save();
  hexPath(ctx, cx, cy, r - largura / 2);
  ctx.strokeStyle = lum(corpo) < 64 ? claro(corpo, 0.34) : escuro(corpo, 0.46);
  ctx.lineWidth = largura;
  ctx.lineJoin = 'miter';
  ctx.stroke();
  ctx.restore();
}

/**
 * Sombra chapada no terco de baixo: o que da volume sem degrade radial.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx @param {number} cy @param {number} r
 */
function sombraDeBaixo(ctx, cx, cy, r) {
  ctx.save();
  hexPath(ctx, cx, cy, r);
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(cx - r, cy + r * 0.18, r * 2, r);
  ctx.restore();
}

/** @param {CanvasRenderingContext2D} ctx @param {number[][]} pts @param {string} cor */
function poligono(ctx, pts, cor) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = cor;
  ctx.fill();
  // Traco da mesma cor: fecha a fresta de antisserrilhado entre vizinhos.
  ctx.strokeStyle = cor;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Ponto dentro do hexagono de topo plano com raio r centrado na origem. */
function dentroDoHex(dx, dy, r) {
  const ay = Math.abs(dy);
  return ay <= r * 0.8660254 && Math.abs(dx) + ay / 1.7320508 <= r;
}

/** @type {Record<string, (ctx:CanvasRenderingContext2D, cx:number, cy:number, r:number, c:Cores, glow:number)=>void>} */
const PINTORES = {
  /**
   * Joia chapada: o hexagono padrao.
   *
   * Seis facetas entre a borda e uma mesa central, cada uma num tom chapado. A
   * luz vem de cima: a faceta do topo e a mais clara, a da base a mais escura.
   * Substituiu o `liso`, cujo degrade radial com miolo quase branco lia como
   * uma lampada no meio da peca, cercada por um halo borrado que as pecas do
   * mundo 1 ja nao tinham. Aqui nao ha halo, centelha nem mancha redonda: o que
   * separa o hexagono da torre e ser um objeto solido no meio de pecas de
   * contorno.
   *
   * O corpo e `fill`, que por isso e opaco em todo tema. O contorno e a propria
   * cor um passo adiante, como o das pecas (`contorno()` em sprites.js).
   */
  joia(ctx, cx, cy, r, c) {
    const corpo = c.fill;
    const mesa = r * 0.56;
    // A aresta i liga o vertice i ao i+1: 0-1 e a de cima a direita, 1-2 o
    // topo, 2-3 a de cima a esquerda, e dai as tres de baixo.
    const tons = [0.2, 0.45, 0.2, -0.12, -0.28, -0.12];
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.clip();
    for (let i = 0; i < 6; i++) {
      const a = vert(cx, cy, r, i);
      const b = vert(cx, cy, r, (i + 1) % 6);
      const bm = vert(cx, cy, mesa, (i + 1) % 6);
      const am = vert(cx, cy, mesa, i);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(bm[0], bm[1]);
      ctx.lineTo(am[0], am[1]);
      ctx.closePath();
      const t = tons[i];
      ctx.fillStyle = t > 0 ? claro(corpo, t) : escuro(corpo, -t);
      ctx.fill();
      // Traco fino da mesma cor: fecha a fresta de antisserrilhado que sobraria
      // entre duas facetas vizinhas.
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    hexPath(ctx, cx, cy, mesa);
    const g = ctx.createLinearGradient(0, cy - mesa, 0, cy + mesa);
    g.addColorStop(0, claro(corpo, 0.25));
    g.addColorStop(1, corpo);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    // O contorno vai por dentro da silhueta: centrado em r - L/2, o traco de
    // largura L termina na borda. Corpo claro escurece e corpo escuro clareia,
    // como nas pecas - so o limiar e mais baixo que o de sprites.js, para o
    // azul do mundo classico (lum ~79) escurecer como as outras oito cores.
    const largura = r * 0.05;
    ctx.save();
    hexPath(ctx, cx, cy, r - largura / 2);
    ctx.strokeStyle = lum(corpo) < 64 ? claro(corpo, 0.34) : escuro(corpo, 0.46);
    ctx.lineWidth = largura;
    ctx.lineJoin = 'miter';
    ctx.stroke();
    ctx.restore();
  },

  /** O padrao antigo: gradiente radial deslocado para cima e halo. */
  liso(ctx, cx, cy, r, c, glow) {
    const g = ctx.createRadialGradient(cx, cy - r * 0.12, r * 0.05, cx, cy, r * 1.05);
    g.addColorStop(0, c.core);
    g.addColorStop(0.5, alfa(c.core, glow > 0.4 ? 0.55 : 0.82));
    g.addColorStop(1, c.fill);
    hexPath(ctx, cx, cy, r);
    ctx.fillStyle = g;
    ctx.fill();
    contorno(ctx, cx, cy, r, c, glow);
  },

  /**
   * Cristal facetado: seis triangulos do centro para cada aresta.
   *
   * A luz vem de cima, entao as facetas superiores sao claras e as de baixo
   * escuras. E o gradiente POR FACETA, e nao um radial unico, que faz a peca
   * ler como talhada em vez de inflada.
   */
  cristal(ctx, cx, cy, r, c, glow) {
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.clip();
    for (let i = 0; i < 6; i++) {
      const a = vert(cx, cy, r, i);
      const b = vert(cx, cy, r, (i + 1) % 6);
      // Quanto mais alto o meio da aresta, mais luz recebe.
      const meioY = (a[1] + b[1]) / 2;
      const luz = 1 - (meioY - (cy - r)) / (2 * r);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.closePath();
      const g = ctx.createLinearGradient(cx, cy, (a[0] + b[0]) / 2, meioY);
      g.addColorStop(0, claro(c.fill, 0.1 + luz * 0.2));
      g.addColorStop(1, luz > 0.5 ? claro(c.core, luz * 0.35) : escuro(c.fill, 0.34 - luz * 0.3));
      ctx.fillStyle = g;
      ctx.fill();
      // Aresta da faceta: o fio que separa uma face da outra.
      ctx.strokeStyle = alfa(c.core, 0.22);
      ctx.lineWidth = Math.max(1, r * 0.02);
      ctx.stroke();
    }
    // Centelha no alto, onde as facetas se encontram.
    const cent = ctx.createRadialGradient(cx, cy - r * 0.42, 0, cx, cy - r * 0.42, r * 0.38);
    cent.addColorStop(0, alfa(c.core, 0.85));
    cent.addColorStop(1, alfa(c.core, 0));
    ctx.fillStyle = cent;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    contorno(ctx, cx, cy, r, c, glow);
  },

  /**
   * Tubo de neon, na mesma gramatica das pecas do mundo 1.
   *
   * Tracos concentricos dentro do recorte: um traco de largura L cobre de 0 a
   * L/2 para dentro, entao pintar do mais largo para o mais estreito empilha
   * as faixas na ordem certa.
   */
  neon(ctx, cx, cy, r, c) {
    // O fio usa uma versao CLAREADA do contorno, nao o contorno cru: em temas
    // de tinta escura (o amarelo do puzzle tem stroke #e09a00) o tubo saia
    // apagado e a peca virava um buraco preto.
    const vivo = claro(c.stroke, 0.24);
    const fio = Math.max(2.5, r * 0.17);
    const faixa = Math.max(1.5, r * 0.07);
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.clip();
    hexPath(ctx, cx, cy, r);
    ctx.fillStyle = alfa(escuro(vivo, 0.56), 0.6);
    ctx.fill();
    ctx.lineJoin = 'miter';
    hexPath(ctx, cx, cy, r);
    ctx.strokeStyle = escuro(vivo, 0.74);
    ctx.lineWidth = 2 * (fio + faixa);
    ctx.stroke();
    hexPath(ctx, cx, cy, r);
    ctx.strokeStyle = vivo;
    ctx.lineWidth = 2 * fio;
    ctx.stroke();
    ctx.restore();
    // Gas aceso no meio: largo e fraco, porque o que faz ler como tubo e o
    // fio, nao a mancha central.
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.66);
    g.addColorStop(0, alfa(c.core, 0.6));
    g.addColorStop(0.55, alfa(vivo, 0.22));
    g.addColorStop(1, alfa(vivo, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2);
    ctx.fill();
  },

  /** Chapa escovada com chanfro e seis rebites. */
  placa(ctx, cx, cy, r, c, glow) {
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.clip();
    const g = ctx.createLinearGradient(cx - r * 0.7, cy - r, cx + r * 0.7, cy + r);
    g.addColorStop(0, claro(c.fill, 0.34));
    g.addColorStop(0.42, claro(c.fill, 0.06));
    g.addColorStop(0.55, escuro(c.fill, 0.18));
    g.addColorStop(1, escuro(c.fill, 0.34));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // Escovado: riscos finos na diagonal, quase no limite do visivel.
    ctx.strokeStyle = alfa('#ffffff', 0.05);
    ctx.lineWidth = Math.max(0.6, r * 0.012);
    for (let k = -8; k <= 8; k++) {
      ctx.beginPath();
      ctx.moveTo(cx - r, cy + k * r * 0.13);
      ctx.lineTo(cx + r, cy + k * r * 0.13 - r * 0.5);
      ctx.stroke();
    }
    // Chanfro: aresta clara em cima, escura embaixo.
    ctx.lineJoin = 'miter';
    hexPath(ctx, cx, cy, r);
    ctx.strokeStyle = alfa('#ffffff', 0.4);
    ctx.lineWidth = Math.max(2, r * 0.09);
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - r, cy, r * 2, r);
    ctx.clip();
    hexPath(ctx, cx, cy, r);
    ctx.strokeStyle = alfa('#000000', 0.4);
    ctx.lineWidth = Math.max(2, r * 0.09);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    // Rebites, um por vertice, recuados para dentro.
    for (let i = 0; i < 6; i++) {
      const v = vert(cx, cy, r * 0.74, i);
      const rg = ctx.createRadialGradient(v[0] - r * 0.02, v[1] - r * 0.02, 0, v[0], v[1], r * 0.075);
      rg.addColorStop(0, claro(c.core, 0.4));
      rg.addColorStop(1, escuro(c.fill, 0.45));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(v[0], v[1], r * 0.072, 0, Math.PI * 2);
      ctx.fill();
    }
    contorno(ctx, cx, cy, r, c, glow);
  },

  /** Nucleo de energia: anel aceso, raios e miolo. */
  nucleo(ctx, cx, cy, r, c, glow) {
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.clip();
    ctx.fillStyle = escuro(c.fill, 0.55);
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // Raios do centro para cada vertice.
    ctx.strokeStyle = alfa(c.stroke, 0.35);
    ctx.lineWidth = Math.max(1.5, r * 0.05);
    for (let i = 0; i < 6; i++) {
      const v = vert(cx, cy, r, i);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(v[0], v[1]);
      ctx.stroke();
    }
    // Anel: hexagono interno aceso, girado 30 graus para nao repetir a
    // silhueta e dar a leitura de mecanismo.
    hexPath(ctx, cx, cy, r * 0.62, Math.PI / 6);
    ctx.strokeStyle = c.stroke;
    ctx.lineWidth = Math.max(2, r * 0.07);
    ctx.stroke();
    ctx.restore();
    // Miolo.
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.46);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, c.core);
    g.addColorStop(1, alfa(c.stroke, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.46, 0, Math.PI * 2);
    ctx.fill();
    contorno(ctx, cx, cy, r, c, glow);
  },

  /**
   * Gema lapidada: mesa no topo, pavilhao em volta.
   *
   * O truque de leitura e o contraste alternado entre facetas vizinhas do
   * pavilhao - sem isso vira so um hexagono dentro de outro.
   */
  gema(ctx, cx, cy, r, c, glow) {
    const rm = r * 0.5;
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.clip();
    ctx.fillStyle = escuro(c.fill, 0.2);
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    for (let i = 0; i < 6; i++) {
      const a = vert(cx, cy, r, i);
      const b = vert(cx, cy, r, (i + 1) % 6);
      const am = vert(cx, cy, rm, i);
      const bm = vert(cx, cy, rm, (i + 1) % 6);
      ctx.beginPath();
      ctx.moveTo(am[0], am[1]);
      ctx.lineTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(bm[0], bm[1]);
      ctx.closePath();
      const alto = (a[1] + b[1]) / 2 < cy;
      ctx.fillStyle = alto
        ? claro(c.fill, i % 2 ? 0.42 : 0.2)
        : escuro(c.fill, i % 2 ? 0.14 : 0.36);
      ctx.fill();
      ctx.strokeStyle = alfa('#ffffff', 0.18);
      ctx.lineWidth = Math.max(0.8, r * 0.015);
      ctx.stroke();
    }
    // Mesa.
    const t = ctx.createLinearGradient(cx, cy - rm, cx, cy + rm);
    t.addColorStop(0, claro(c.core, 0.2));
    t.addColorStop(1, c.fill);
    hexPath(ctx, cx, cy, rm);
    ctx.fillStyle = t;
    ctx.fill();
    ctx.strokeStyle = alfa('#ffffff', 0.3);
    ctx.lineWidth = Math.max(1, r * 0.02);
    ctx.stroke();
    // Lampejo na mesa.
    ctx.fillStyle = alfa('#ffffff', 0.5);
    ctx.beginPath();
    ctx.ellipse(cx - rm * 0.3, cy - rm * 0.34, rm * 0.4, rm * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    contorno(ctx, cx, cy, r, c, glow);
  },

  /** Favo: colmeia por dentro da silhueta. */
  favo(ctx, cx, cy, r, c, glow) {
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.clip();
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, claro(c.fill, 0.22));
    g.addColorStop(1, escuro(c.fill, 0.3));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // Sete celulas: uma no centro e seis em volta, giradas 30 graus para
    // encaixarem como colmeia de verdade.
    const rc = r * 0.3;
    const passo = rc * Math.sqrt(3);
    const centros = [[cx, cy]];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      centros.push([cx + passo * Math.cos(a), cy - passo * Math.sin(a)]);
    }
    for (const [x, y] of centros) {
      hexPath(ctx, x, y, rc * 0.86, Math.PI / 6);
      ctx.fillStyle = alfa(escuro(c.fill, 0.42), 0.55);
      ctx.fill();
      ctx.strokeStyle = alfa(c.core, 0.55);
      ctx.lineWidth = Math.max(1, r * 0.028);
      ctx.stroke();
    }
    ctx.restore();
    contorno(ctx, cx, cy, r, c, glow);
  },

  /** Vidro soprado: corpo translucido, reflexo oval e caustica embaixo. */
  vidro(ctx, cx, cy, r, c, glow) {
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.clip();
    // Alfas baixos demais deixavam o corpo cinza sobre fundo escuro: vidro
    // translucido ainda precisa ter cor, senao vira fumaca.
    const g = ctx.createLinearGradient(cx - r * 0.5, cy - r, cx + r * 0.4, cy + r);
    g.addColorStop(0, alfa(claro(c.core, 0.12), 0.88));
    g.addColorStop(0.45, alfa(claro(c.stroke, 0.3), 0.56));
    g.addColorStop(1, alfa(escuro(c.stroke, 0.16), 0.74));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // Borda grossa por dentro: e a espessura do vidro que se ve de lado.
    hexPath(ctx, cx, cy, r);
    ctx.strokeStyle = alfa(claro(c.core, 0.3), 0.55);
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.stroke();
    // Caustica: a luz que atravessa e se junta no fundo.
    const cau = ctx.createRadialGradient(cx, cy + r * 0.52, 0, cx, cy + r * 0.52, r * 0.6);
    cau.addColorStop(0, alfa(claro(c.core, 0.2), 0.55));
    cau.addColorStop(1, alfa(c.core, 0));
    ctx.fillStyle = cau;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    // Reflexo.
    ctx.fillStyle = alfa('#ffffff', 0.62);
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.3, cy - r * 0.34, r * 0.3, r * 0.13, -0.6, 0, Math.PI * 2);
    ctx.fill();
    contorno(ctx, cx, cy, r, c, glow);
  },

  /** Papel dobrado: duas metades e vincos do centro para tres vertices. */
  origami(ctx, cx, cy, r, c, glow) {
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.clip();
    ctx.fillStyle = claro(c.fill, 0.24);
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // Metade de baixo-direita dobrada para tras: um tom abaixo, sem gradiente.
    // Papel nao tem brilho especular, e a leitura vem so da quebra de tom.
    ctx.beginPath();
    ctx.moveTo(...vert(cx, cy, r, 2));
    ctx.lineTo(...vert(cx, cy, r, 5));
    ctx.lineTo(...vert(cx, cy, r, 4));
    ctx.lineTo(...vert(cx, cy, r, 3));
    ctx.closePath();
    ctx.fillStyle = escuro(c.fill, 0.22);
    ctx.fill();
    // Uma aba menor, para a dobra nao parecer so um corte ao meio.
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(...vert(cx, cy, r, 1));
    ctx.lineTo(...vert(cx, cy, r, 0));
    ctx.closePath();
    ctx.fillStyle = claro(c.core, 0.12);
    ctx.fill();
    // Vincos.
    ctx.strokeStyle = alfa('#000000', 0.22);
    ctx.lineWidth = Math.max(1, r * 0.022);
    for (const i of [0, 2, 4]) {
      const v = vert(cx, cy, r, i);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(v[0], v[1]);
      ctx.stroke();
    }
    ctx.restore();
    contorno(ctx, cx, cy, r, c, glow);
  },

  /** Ouro macico: metal polido com varredura de luz. */
  ouro(ctx, cx, cy, r, c, glow) {
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.clip();
    // Metal polido e uma sequencia de faixas claras e escuras, nao um
    // degrade suave: e a alternancia que le como reflexo.
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, claro(c.fill, 0.52));
    g.addColorStop(0.2, claro(c.fill, 0.12));
    g.addColorStop(0.42, claro(c.core, 0.45));
    g.addColorStop(0.58, escuro(c.fill, 0.1));
    g.addColorStop(0.8, escuro(c.fill, 0.42));
    g.addColorStop(1, escuro(c.fill, 0.12));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // Varredura diagonal.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.6);
    const v = ctx.createLinearGradient(-r, 0, r, 0);
    v.addColorStop(0, alfa('#ffffff', 0));
    v.addColorStop(0.45, alfa('#ffffff', 0.4));
    v.addColorStop(0.55, alfa('#ffffff', 0.4));
    v.addColorStop(1, alfa('#ffffff', 0));
    ctx.fillStyle = v;
    ctx.fillRect(-r, -r * 0.22, r * 2, r * 0.44);
    ctx.restore();
    // Chanfro interno.
    ctx.lineJoin = 'miter';
    hexPath(ctx, cx, cy, r * 0.97);
    ctx.strokeStyle = alfa(escuro(c.fill, 0.5), 0.8);
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.stroke();
    ctx.restore();
    contorno(ctx, cx, cy, r, c, glow);
  },

  /** Selo runico: pedra com a runa gravada e acesa. */
  selo(ctx, cx, cy, r, c, glow) {
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.clip();
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, escuro(c.fill, 0.08));
    g.addColorStop(1, escuro(c.fill, 0.44));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // Anel gravado: sombra por dentro e luz por fora, que e o que faz um
    // sulco parecer fundo em vez de desenhado.
    hexPath(ctx, cx, cy, r * 0.78);
    ctx.strokeStyle = alfa('#000000', 0.38);
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.stroke();
    hexPath(ctx, cx, cy, r * 0.82);
    ctx.strokeStyle = alfa('#ffffff', 0.14);
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.stroke();
    // Runa: tres tracos que nao fecham, para nao virar simbolo de coisa
    // nenhuma - e ornamento, nao linguagem.
    ctx.strokeStyle = c.core;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, r * 0.09);
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.42);
    ctx.lineTo(cx, cy + r * 0.42);
    ctx.moveTo(cx, cy - r * 0.12);
    ctx.lineTo(cx + r * 0.32, cy - r * 0.36);
    ctx.moveTo(cx, cy + r * 0.14);
    ctx.lineTo(cx - r * 0.32, cy - r * 0.1);
    ctx.stroke();
    ctx.restore();
    contorno(ctx, cx, cy, r, c, glow);
  },

  /** Catavento: seis pas, cada uma em dois tons, girando em volta do miolo. */
  catavento(ctx, cx, cy, r, c) {
    const corpo = c.fill;
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.clip();
    for (let i = 0; i < 6; i++) {
      const a = vert(cx, cy, r, i);
      const b = vert(cx, cy, r, (i + 1) % 6);
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      poligono(ctx, [[cx, cy], a, m], claro(corpo, 0.3));
      poligono(ctx, [[cx, cy], m, b], escuro(corpo, 0.16));
    }
    hexPath(ctx, cx, cy, r * 0.2);
    ctx.fillStyle = c.core;
    ctx.fill();
    ctx.restore();
    filete(ctx, cx, cy, r, corpo);
  },

  /** Listras diagonais de bala, com a sombra chapada embaixo. */
  listras(ctx, cx, cy, r, c) {
    const corpo = c.fill;
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.clip();
    ctx.fillStyle = corpo;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = c.core;
    const w = r * 0.24;
    for (let x = -r * 2; x < r * 2; x += w * 2) ctx.fillRect(x, -r * 2, w, r * 4);
    ctx.restore();
    sombraDeBaixo(ctx, cx, cy, r);
    filete(ctx, cx, cy, r, corpo);
  },

  /** Roseta: hexagonos encaixados, cada anel girado meio passo do anterior. */
  roseta(ctx, cx, cy, r, c) {
    const corpo = c.fill;
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.fillStyle = escuro(corpo, 0.12);
    ctx.fill();
    const aneis = [
      [0.8, Math.PI / 6, corpo],
      [0.62, 0, claro(corpo, 0.22)],
      [0.44, Math.PI / 6, claro(corpo, 0.42)],
      [0.24, 0, c.core],
    ];
    for (const [k, giro, cor] of aneis) {
      // Girado 30 graus, o hexagono de raio k*r so cabe no anterior com o
      // raio reduzido a cos(30) - e o que faz as pontas tocarem as arestas.
      hexPath(ctx, cx, cy, r * Number(k), Number(giro));
      ctx.fillStyle = String(cor);
      ctx.fill();
    }
    ctx.restore();
    filete(ctx, cx, cy, r, corpo);
  },

  /** Estrela de seis pontas embutida no corpo. */
  estrela(ctx, cx, cy, r, c) {
    const corpo = c.fill;
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.fillStyle = corpo;
    ctx.fill();
    ctx.clip();
    const R = r * 0.72;
    for (const giro of [Math.PI / 2, -Math.PI / 2]) {
      const pts = [0, 1, 2].map((k) => {
        const a = giro + (k * 2 * Math.PI) / 3;
        return [cx + R * Math.cos(a), cy - R * Math.sin(a)];
      });
      poligono(ctx, pts, claro(corpo, 0.42));
    }
    hexPath(ctx, cx, cy, r * 0.26, Math.PI / 6);
    ctx.fillStyle = c.core;
    ctx.fill();
    ctx.restore();
    sombraDeBaixo(ctx, cx, cy, r);
    filete(ctx, cx, cy, r, corpo);
  },

  /** Duas metades na diagonal, com um filete claro na emenda. */
  duo(ctx, cx, cy, r, c) {
    const corpo = c.fill;
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.clip();
    poligono(ctx, [[cx - r * 2, cy - r * 2], [cx + r * 2, cy - r * 2], [cx - r * 2, cy + r * 2]], claro(corpo, 0.2));
    poligono(ctx, [[cx + r * 2, cy - r * 2], [cx + r * 2, cy + r * 2], [cx - r * 2, cy + r * 2]], escuro(corpo, 0.2));
    ctx.strokeStyle = c.core;
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.moveTo(cx + r * 1.2, cy - r * 1.2);
    ctx.lineTo(cx - r * 1.2, cy + r * 1.2);
    ctx.stroke();
    ctx.restore();
    filete(ctx, cx, cy, r, corpo);
  },

  /** Bolinhas chapadas em grade, sombra embaixo. */
  bolinhas(ctx, cx, cy, r, c) {
    const corpo = c.fill;
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.fillStyle = corpo;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = c.core;
    const passo = r * 0.4;
    for (let j = -3; j <= 3; j++) {
      for (let i = -3; i <= 3; i++) {
        const x = cx + i * passo + (j % 2 ? passo / 2 : 0);
        const y = cy + j * passo * 0.87;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    sombraDeBaixo(ctx, cx, cy, r);
    filete(ctx, cx, cy, r, corpo);
  },

  /** O hexagono em pixel art: grade de quadrados, luz de cima, borda escura. */
  pixel(ctx, cx, cy, r, c) {
    const corpo = c.fill;
    const n = 11;
    const lado = (r * 2) / n;
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.clip();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = cx - r + i * lado;
        const y = cy - r + j * lado;
        const dx = x + lado / 2 - cx;
        const dy = y + lado / 2 - cy;
        if (!dentroDoHex(dx, dy, r * 1.02)) continue;
        const borda =
          !dentroDoHex(dx - lado, dy, r) || !dentroDoHex(dx + lado, dy, r) ||
          !dentroDoHex(dx, dy - lado, r) || !dentroDoHex(dx, dy + lado, r);
        let cor = corpo;
        if (borda) cor = lum(corpo) < 64 ? claro(corpo, 0.3) : escuro(corpo, 0.42);
        else if (dy < -r * 0.38) cor = claro(corpo, 0.32);
        else if (dy > r * 0.3) cor = escuro(corpo, 0.18);
        if (!borda && dx < -r * 0.25 && dy < -r * 0.18 && dy > -r * 0.5) cor = c.core;
        ctx.fillStyle = cor;
        ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(lado) + 1, Math.ceil(lado) + 1);
      }
    }
    ctx.restore();
  },

  /** A joia com olhos e sorriso. */
  carinha(ctx, cx, cy, r, c) {
    PINTORES.joia(ctx, cx, cy, r, c);
    const tinta = '#1d1a2b';
    ctx.save();
    ctx.fillStyle = tinta;
    for (const lado of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + lado * r * 0.22, cy - r * 0.06, r * 0.075, r * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    for (const lado of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + lado * r * 0.22 + r * 0.025, cy - r * 0.1, r * 0.028, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = tinta;
    ctx.lineWidth = Math.max(1.2, r * 0.055);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.08, r * 0.15, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
    ctx.fillStyle = alfa('#ff7aa8', 0.55);
    for (const lado of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + lado * r * 0.38, cy + r * 0.12, r * 0.08, r * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  /** Losangos em dois tons, como um xadrez girado. */
  xadrez(ctx, cx, cy, r, c) {
    const corpo = c.fill;
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.fillStyle = corpo;
    ctx.fill();
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    const passo = r * 0.34;
    ctx.fillStyle = c.core;
    for (let j = -5; j <= 5; j++) {
      for (let i = -5; i <= 5; i++) {
        if ((i + j) % 2 === 0) continue;
        ctx.fillRect(i * passo, j * passo, passo, passo);
      }
    }
    ctx.restore();
    sombraDeBaixo(ctx, cx, cy, r);
    filete(ctx, cx, cy, r, corpo);
  },
};

// ------------------------------------------------- os quatorze da galeria ----
//
// Os hexagonos da 1.0.12, escolhidos pelo Evandro entre os 92 de
// `prototypes/galeria.html` (ele nao gostou dos da 1.0.8). O desenho e o da
// galeria, traco por traco: corpo chapado, faixa de luz em cima e de sombra
// embaixo, aro grosso por dentro da silhueta e nada de halo nem mancha radial.
// O corpo principal vem de `fill` da skin; os detalhes (casca, recheio, olhos)
// sao do proprio desenho. Todos rodam recortados pela silhueta (`DESENHOS`,
// embrulhados em `paintHexModel`): o que escapasse dela faria a peca parecer
// maior que o corpo fisico.

const TINTA = '#1d1a2b';
const VOLTA = Math.PI * 2;

/** Aro por dentro da silhueta, mais grosso que o `filete` da 1.0.8. */
function aro(ctx, cx, cy, r, cor) {
  const w = Math.max(1.2, r * 0.075);
  ctx.save();
  hexPath(ctx, cx, cy, r - w / 2);
  ctx.lineWidth = w;
  ctx.strokeStyle = cor;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}
function chapa(ctx, cx, cy, r, cor) {
  hexPath(ctx, cx, cy, r);
  ctx.fillStyle = cor;
  ctx.fill();
}
/** Faixa chapada clara no alto e escura no terco de baixo: volume sem degrade. */
function volume(ctx, cx, cy, r, luz, sombra) {
  if (luz > 0) {
    ctx.fillStyle = `rgba(255,255,255,${luz})`;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 0.45);
  }
  if (sombra > 0) {
    ctx.fillStyle = `rgba(0,0,0,${sombra})`;
    ctx.fillRect(cx - r, cy + r * 0.32, r * 2, r);
  }
}
function bola(ctx, x, y, rr, cor) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, rr), 0, VOLTA);
  ctx.fillStyle = cor;
  ctx.fill();
}
function oval(ctx, x, y, rx, ry, cor, giro = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), giro, 0, VOLTA);
  ctx.fillStyle = cor;
  ctx.fill();
}
function chapaPts(ctx, pts, cor) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = cor;
  ctx.fill();
}
function risco(ctx, pts, cor, w) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = cor;
  ctx.lineWidth = Math.max(0.8, w);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}
function curva(ctx, x, y, rr, a0, a1, cor, w) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, rr), a0, a1);
  ctx.strokeStyle = cor;
  ctx.lineWidth = Math.max(0.8, w);
  ctx.lineCap = 'round';
  ctx.stroke();
}
/** Retangulo de cantos redondos, sem depender de `ctx.roundRect`. */
function caixa(ctx, x, y, w, h, raio, cor) {
  const k = Math.min(raio, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
  ctx.fillStyle = cor;
  ctx.fill();
}
/** Olho de bolinha com um ponto de brilho. */
function pontinho(ctx, x, y, s, cor = TINTA) {
  bola(ctx, x, y, s, cor);
  bola(ctx, x + s * 0.35, y - s * 0.35, s * 0.32, '#ffffff');
}
function sorriso(ctx, x, y, w, lw) {
  curva(ctx, x, y - w * 0.55, w, Math.PI * 0.22, Math.PI * 0.78, TINTA, lw);
}
function bochechas(ctx, cx, cy, r) {
  oval(ctx, cx - r * 0.48, cy + r * 0.14, r * 0.13, r * 0.08, 'rgba(255,110,140,0.45)');
  oval(ctx, cx + r * 0.48, cy + r * 0.14, r * 0.13, r * 0.08, 'rgba(255,110,140,0.45)');
}
/** Corpo, luz, sombra, o rosto por cima e o aro: a base das tres carinhas. */
function rosto(ctx, cx, cy, r, cor, desenho) {
  chapa(ctx, cx, cy, r, cor);
  volume(ctx, cx, cy, r, 0.16, 0.1);
  desenho();
  aro(ctx, cx, cy, r, escuro(cor, 0.42));
}

/** @type {Record<string, (ctx:CanvasRenderingContext2D, cx:number, cy:number, r:number, c:Cores)=>void>} */
const DESENHOS = {
  feliz(ctx, cx, cy, r, c) {
    rosto(ctx, cx, cy, r, c.fill, () => {
      pontinho(ctx, cx - r * 0.28, cy - r * 0.12, r * 0.11);
      pontinho(ctx, cx + r * 0.28, cy - r * 0.12, r * 0.11);
      sorriso(ctx, cx, cy + r * 0.2, r * 0.3, r * 0.09);
      bochechas(ctx, cx, cy, r);
    });
  },

  descolado(ctx, cx, cy, r, c) {
    rosto(ctx, cx, cy, r, c.fill, () => {
      const y = cy - r * 0.14;
      caixa(ctx, cx - r * 0.6, y - r * 0.13, r * 0.52, r * 0.28, r * 0.1, TINTA);
      caixa(ctx, cx + r * 0.08, y - r * 0.13, r * 0.52, r * 0.28, r * 0.1, TINTA);
      risco(ctx, [[cx - r * 0.1, y - r * 0.05], [cx + r * 0.1, y - r * 0.05]], TINTA, r * 0.07);
      risco(ctx, [[cx - r * 0.5, y - r * 0.06], [cx - r * 0.36, y - r * 0.06]], 'rgba(255,255,255,0.6)', r * 0.04);
      risco(ctx, [[cx - r * 0.15, cy + r * 0.3], [cx + r * 0.2, cy + r * 0.22]], TINTA, r * 0.08);
    });
  },

  bravo(ctx, cx, cy, r, c) {
    rosto(ctx, cx, cy, r, c.fill, () => {
      pontinho(ctx, cx - r * 0.28, cy - r * 0.06, r * 0.1);
      pontinho(ctx, cx + r * 0.28, cy - r * 0.06, r * 0.1);
      risco(ctx, [[cx - r * 0.45, cy - r * 0.32], [cx - r * 0.14, cy - r * 0.18]], TINTA, r * 0.09);
      risco(ctx, [[cx + r * 0.45, cy - r * 0.32], [cx + r * 0.14, cy - r * 0.18]], TINTA, r * 0.09);
      curva(ctx, cx, cy + r * 0.48, r * 0.24, Math.PI * 1.2, Math.PI * 1.8, TINTA, r * 0.09);
    });
  },

  robo(ctx, cx, cy, r, c) {
    const cor = c.fill;
    chapa(ctx, cx, cy, r, cor);
    volume(ctx, cx, cy, r, 0, 0.12);
    caixa(ctx, cx - r * 0.5, cy - r * 0.34, r, r * 0.56, r * 0.12, '#1b2236');
    ctx.fillStyle = '#4fe3ff';
    ctx.fillRect(cx - r * 0.32, cy - r * 0.16, r * 0.18, r * 0.14);
    ctx.fillRect(cx + r * 0.14, cy - r * 0.16, r * 0.18, r * 0.14);
    risco(ctx, [[cx - r * 0.16, cy + r * 0.08], [cx + r * 0.16, cy + r * 0.08]], '#4fe3ff', r * 0.05);
    for (const [x, y] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) bola(ctx, cx + r * x, cy + r * y, r * 0.06, escuro(cor, 0.35));
    risco(ctx, [[cx, cy - r * 0.866 + r * 0.04], [cx, cy - r * 0.42]], escuro(cor, 0.4), r * 0.05);
    aro(ctx, cx, cy, r, escuro(cor, 0.5));
  },

  caveirinha(ctx, cx, cy, r, c) {
    const fundo = c.fill;
    const osso = '#f2f0ea';
    chapa(ctx, cx, cy, r, fundo);
    oval(ctx, cx, cy - r * 0.1, r * 0.52, r * 0.46, osso);
    ctx.fillStyle = osso;
    ctx.fillRect(cx - r * 0.28, cy + r * 0.2, r * 0.56, r * 0.28);
    oval(ctx, cx - r * 0.2, cy - r * 0.1, r * 0.13, r * 0.15, fundo);
    oval(ctx, cx + r * 0.2, cy - r * 0.1, r * 0.13, r * 0.15, fundo);
    chapaPts(ctx, [[cx - r * 0.05, cy + r * 0.14], [cx + r * 0.05, cy + r * 0.14], [cx, cy + r * 0.06]], fundo);
    for (let i = 0; i < 3; i++) risco(ctx, [[cx - r * 0.12 + i * r * 0.12, cy + r * 0.3], [cx - r * 0.12 + i * r * 0.12, cy + r * 0.46]], fundo, r * 0.03);
    bola(ctx, cx - r * 0.2, cy - r * 0.12, r * 0.05, '#ff5fa2');
    bola(ctx, cx + r * 0.2, cy - r * 0.12, r * 0.05, '#ff5fa2');
    aro(ctx, cx, cy, r, c.stroke);
  },

  melancia(ctx, cx, cy, r, c) {
    chapa(ctx, cx, cy, r, c.fill);
    chapa(ctx, cx, cy, r * 0.84, '#e9fbd8');
    chapa(ctx, cx, cy, r * 0.76, '#ff4d63');
    for (const [x, y] of [[-0.3, -0.24], [0.1, -0.34], [0.36, -0.06], [-0.1, 0.06], [-0.38, 0.22], [0.2, 0.28], [0.0, -0.08]]) oval(ctx, cx + r * x, cy + r * y, r * 0.04, r * 0.065, TINTA, 0.3);
    aro(ctx, cx, cy, r, c.stroke);
  },

  pizza(ctx, cx, cy, r, c) {
    chapa(ctx, cx, cy, r, c.fill);
    chapa(ctx, cx, cy, r * 0.82, '#ffd24a');
    ctx.save();
    hexPath(ctx, cx, cy, r * 0.82);
    ctx.clip();
    for (const [x, y] of [[-0.34, -0.3], [0.3, -0.36], [0.42, 0.18], [-0.1, 0.06], [-0.4, 0.3], [0.1, 0.42]]) {
      bola(ctx, cx + r * x, cy + r * y, r * 0.13, '#d63a2f');
      bola(ctx, cx + r * x - r * 0.04, cy + r * y - r * 0.04, r * 0.03, '#ff7a6a');
    }
    for (const [x, y] of [[0.0, -0.42], [-0.5, -0.02], [0.24, -0.06]]) oval(ctx, cx + r * x, cy + r * y, r * 0.07, r * 0.04, '#3fa34d', 0.6);
    ctx.restore();
    aro(ctx, cx, cy, r, c.stroke);
  },

  queijo(ctx, cx, cy, r, c) {
    chapa(ctx, cx, cy, r, c.fill);
    volume(ctx, cx, cy, r, 0, 0.08);
    for (const [x, y, s] of [[-0.42, -0.36, 0.16], [0.3, -0.42, 0.11], [0.5, 0.1, 0.18], [-0.06, 0.02, 0.13], [-0.5, 0.32, 0.12], [0.18, 0.5, 0.1], [-0.2, -0.62, 0.08]]) {
      bola(ctx, cx + r * x, cy + r * y, r * s, '#e0a31a');
      bola(ctx, cx + r * x + r * s * 0.2, cy + r * y + r * s * 0.2, r * s * 0.7, '#c9890e');
    }
    aro(ctx, cx, cy, r, c.stroke);
  },

  ovo(ctx, cx, cy, r, c) {
    chapa(ctx, cx, cy, r, c.fill);
    bola(ctx, cx + r * 0.06, cy + r * 0.04, r * 0.36, '#ffb21e');
    bola(ctx, cx - r * 0.06, cy - r * 0.08, r * 0.09, '#ffe8a8');
    aro(ctx, cx, cy, r, c.stroke);
  },

  futebol(ctx, cx, cy, r, c) {
    chapa(ctx, cx, cy, r, c.fill);
    const gomo = (x, y, s, giro) => {
      const pts = [];
      for (let i = 0; i < 5; i++) {
        const a = giro + (i * VOLTA) / 5 - Math.PI / 2;
        pts.push([x + Math.cos(a) * s, y + Math.sin(a) * s]);
      }
      chapaPts(ctx, pts, TINTA);
    };
    gomo(cx, cy, r * 0.24, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i * VOLTA) / 5 - Math.PI / 2;
      risco(ctx, [[cx + Math.cos(a) * r * 0.24, cy + Math.sin(a) * r * 0.24], [cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62]], TINTA, r * 0.04);
      gomo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86, r * 0.2, Math.PI);
    }
    aro(ctx, cx, cy, r, c.stroke);
  },

  basquete(ctx, cx, cy, r, c) {
    chapa(ctx, cx, cy, r, c.fill);
    risco(ctx, [[cx - r, cy], [cx + r, cy]], TINTA, r * 0.06);
    risco(ctx, [[cx, cy - r], [cx, cy + r]], TINTA, r * 0.06);
    curva(ctx, cx - r * 1.05, cy, r * 0.7, -Math.PI / 2, Math.PI / 2, TINTA, r * 0.06);
    curva(ctx, cx + r * 1.05, cy, r * 0.7, Math.PI / 2, Math.PI * 1.5, TINTA, r * 0.06);
    aro(ctx, cx, cy, r, escuro(c.fill, 0.5));
  },

  relogio(ctx, cx, cy, r, c) {
    chapa(ctx, cx, cy, r, c.fill);
    chapa(ctx, cx, cy, r * 0.8, '#fbfbff');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * VOLTA;
      const r0 = i % 3 ? r * 0.58 : r * 0.5;
      risco(ctx, [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r * 0.64, cy + Math.sin(a) * r * 0.64]], TINTA, r * 0.04);
    }
    risco(ctx, [[cx, cy], [cx, cy - r * 0.42]], TINTA, r * 0.07);
    risco(ctx, [[cx, cy], [cx + r * 0.3, cy + r * 0.1]], '#e8333b', r * 0.05);
    bola(ctx, cx, cy, r * 0.06, TINTA);
    aro(ctx, cx, cy, r, c.stroke);
  },

  controle(ctx, cx, cy, r, c) {
    chapa(ctx, cx, cy, r, c.fill);
    caixa(ctx, cx - r * 0.66, cy - r * 0.3, r * 1.32, r * 0.6, r * 0.28, '#2c2f45');
    ctx.fillStyle = '#f2f4fb';
    ctx.fillRect(cx - r * 0.46, cy - r * 0.04, r * 0.3, r * 0.09);
    ctx.fillRect(cx - r * 0.355, cy - r * 0.15, r * 0.09, r * 0.3);
    bola(ctx, cx + r * 0.3, cy - r * 0.08, r * 0.07, '#ffd84a');
    bola(ctx, cx + r * 0.44, cy + r * 0.06, r * 0.07, '#4fc3ff');
    aro(ctx, cx, cy, r, escuro(c.fill, 0.45));
  },

  escoces(ctx, cx, cy, r, c) {
    chapa(ctx, cx, cy, r, c.fill);
    for (let i = -3; i <= 3; i++) {
      ctx.fillStyle = 'rgba(20,24,60,0.42)';
      ctx.fillRect(cx + i * r * 0.5 - r * 0.12, cy - r, r * 0.24, r * 2);
      ctx.fillRect(cx - r, cy + i * r * 0.5 - r * 0.12, r * 2, r * 0.24);
      ctx.fillStyle = 'rgba(255,214,90,0.8)';
      ctx.fillRect(cx + i * r * 0.5 + r * 0.2, cy - r, r * 0.035, r * 2);
      ctx.fillRect(cx - r, cy + i * r * 0.5 + r * 0.2, r * 2, r * 0.035);
    }
    aro(ctx, cx, cy, r, c.stroke);
  },
};

for (const [id, desenho] of Object.entries(DESENHOS)) {
  PINTORES[id] = (ctx, cx, cy, r, c) => {
    ctx.save();
    hexPath(ctx, cx, cy, r);
    ctx.clip();
    desenho(ctx, cx, cy, r, c);
    ctx.restore();
  };
}

/**
 * Contorno comum a quase todos os modelos.
 *
 * Em tema escuro ele vira halo (dois tracos com sombra da propria cor); em
 * tema claro, onde o hexagono sumiria no fundo, vira traco firme.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx @param {number} cy @param {number} r
 * @param {Cores} c @param {number} glow
 */
function contorno(ctx, cx, cy, r, c, glow) {
  ctx.save();
  hexPath(ctx, cx, cy, r);
  ctx.strokeStyle = c.stroke;
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.lineJoin = 'round';
  if (glow > 0.4) {
    ctx.shadowColor = c.stroke;
    ctx.shadowBlur = r * (0.25 + glow * 0.5);
    ctx.stroke();
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Pinta um hexagono no modelo pedido.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx centro em px
 * @param {number} cy
 * @param {number} r raio em px
 * @param {string} modelo id de HEX_MODELS
 * @param {Cores} cores
 * @param {number} [glow] 0 a 1, intensidade do tema
 */
export function paintHexModel(ctx, cx, cy, r, modelo, cores, glow = 0.6) {
  const pintor = PINTORES[modelo] || PINTORES.joia;
  // A sombra projetada so existe em tema claro, onde o hexagono sumiria no
  // fundo. Fica fora do pintor porque vale para todos os modelos.
  if (glow < 0.4) {
    ctx.save();
    ctx.shadowColor = 'rgba(30,25,45,0.4)';
    ctx.shadowBlur = r * 0.35;
    ctx.shadowOffsetY = r * 0.12;
    hexPath(ctx, cx, cy, r);
    ctx.fillStyle = cores.fill;
    ctx.fill();
    ctx.restore();
  }
  pintor(ctx, cx, cy, r, cores, glow);
}
