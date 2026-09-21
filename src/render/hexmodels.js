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
  { id: 'liso', nome: 'Liso', desc: 'O de hoje: corpo em degrade e contorno aceso.' },
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

/** @type {Record<string, (ctx:CanvasRenderingContext2D, cx:number, cy:number, r:number, c:Cores, glow:number)=>void>} */
const PINTORES = {
  /** O hexagono de sempre: gradiente radial deslocado para cima e halo. */
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
};

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
  const pintor = PINTORES[modelo] || PINTORES.liso;
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
