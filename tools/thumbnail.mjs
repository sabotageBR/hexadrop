/**
 * Gera as thumbnails que a Poki pede: a animada (.mp4) e as estaticas (.png).
 *
 * Requisitos da Poki que esta ferramenta cobre:
 * - animada: 1:1, 1080x1080 ou maior, 50 fps ou mais, 4 a 6 s, SEM audio,
 *   .mp4, ate 100 MB; duas ou tres cenas curtas, sem cursor e sem UI
 *   que nao seja essencial;
 * - estatica: 1:1, 628x628 no minimo, sangrada (sem margem, borda nem canto
 *   arredondado), sem texto, longe do #83FFE7 que e o fundo da Poki.
 *
 * Como funciona, em quatro passos:
 *
 * 1. FOTO DO PROJETO. Outras pessoas mexem no codigo ao mesmo tempo, entao a
 *    captura nao usa o servidor de dev nem o dist/: copia o projeto (sem
 *    node_modules, dist, dist-lisa e .git) para uma pasta temporaria, liga
 *    node_modules por symlink e roda `vite build` la dentro. Um arquivo salvo
 *    no meio do caminho nao muda o que ja foi copiado. `--from-dist` pula isto.
 *
 * 2. SERVIDOR PROPRIO. Um servidor estatico minimo em 127.0.0.1 (porta 4190,
 *    ou a proxima livre). E 127.0.0.1 de proposito: e so nesse endereco que
 *    main.js expoe `window.__game`.
 *
 * 3. RELOGIO VIRTUAL. A captura nao e gravacao de tela. Antes de qualquer
 *    script da pagina, `Page.addScriptToEvaluateOnNewDocument` troca
 *    requestAnimationFrame, performance.now, Date e os temporizadores por um
 *    relogio que so anda quando a ferramenta manda. Cada quadro e: avanca
 *    1/60 s, roda o rAF do jogo (um passo fixo de fisica, core/loop.js) e le o
 *    canvas. Por isso o video sai a 60 fps cravados, sem engasgo, por mais
 *    lento que o Chrome headless seja - e sai IGUAL toda vez.
 *
 *    O quadro vem do proprio canvas (`toDataURL`), nao da tela: HUD, cartoes,
 *    tutorial, toasts, textos flutuantes e cursor sao DOM e nem entram. O que
 *    sobra e so o jogo.
 *
 * 4. FFMPEG. Os quadros viram H.264 yuv420p BT.709 a 60 fps, sem trilha de
 *    audio, e a folha de contato sai do proprio mp4. O Chrome fecha antes.
 *
 * Toda cena roda duas vezes: uma a seco (sem PNG), que mede cada candidata e
 * escolhe a melhor, e outra que repete os mesmos toques nos mesmos quadros e
 * captura. Com o relogio virtual a simulacao e a mesma nas duas, e a
 * ferramenta confere (o hexagono no ultimo quadro tem que bater). Na vitoria a
 * passada seca tambem acha o quadro em que ela acontece - o solucionador (a
 * peca de `session.requestHint()`) joga ate vencer -, e a captura pega so o
 * fim. As particulas tambem sao sorteadas de novo a cada cena: duas execucoes
 * sobre o mesmo codigo dao arquivos identicos byte a byte.
 *
 * MEMORIA. A ferramenta roda em maquina de desenvolvimento, dividindo memoria
 * com o resto. Tres cuidados, todos medidos numa maquina com o swap cheio em
 * que o earlyoom derrubava a aba desta captura e abas do navegador do usuario:
 * o proprio processo sobe o oom_score_adj para 1000 (herdado pelo vite, pelo
 * Chrome e pelo ffmpeg), entao se faltar memoria quem morre e a captura, que
 * repete a cena num Chrome novo; os quadros nao vao para /tmp quando /tmp e
 * tmpfs (RAM) - vao para ~/.cache/hexadrop-thumb/, apagada no fim; e antes de
 * abrir o Chrome e de cada cena ela confere o /proc/meminfo (--memoria-minima).
 *
 * Uso:
 *
 *   node tools/thumbnail.mjs                    # foto do projeto + build + tudo
 *   node tools/thumbnail.mjs --from-dist dist   # usa um build pronto
 *   node tools/thumbnail.mjs --sondar 1-45      # lista bomba/TNT por fase e
 *                                               # tira uma foto de cada fase
 *
 * Opcoes:
 *
 *   --from-dist <pasta>   serve esse build em vez de copiar e buildar
 *   --saida <pasta>       padrao marketing/thumbnail
 *   --porta <n>           servidor HTTP, padrao 4190 (tenta as dez seguintes)
 *   --cdp <n>             porta de debug do Chrome, padrao 9444. Nao use
 *                         9222/9333/9555/9666/9777/9888: sao das outras
 *                         ferramentas de tools/
 *   --lado <px>           lado do viewport quadrado em pixels CSS (padrao 540).
 *                         A escala do dispositivo e tamanho/lado, e o jogo
 *                         limita o dpr a 2 - entao lado >= tamanho/2
 *   --tamanho <px>        lado do video e das estaticas, padrao 1080
 *   --crf <n>             qualidade do H.264, padrao 16 (menor = melhor)
 *   --sem-marca           nao desenha o anel do toque sobre o canvas
 *   --so-video            nao grava as estaticas
 *   --so-estatica         nao grava o video nem a folha
 *   --manter-temp         nao apaga a pasta temporaria (build, perfil) nem a
 *                         dos quadros
 *   --cenas <a,b>         grava so essas cenas do roteiro ou estaticas, pelo
 *                         nome (toque, explosao, vitoria, estatica-mundo1,
 *                         estatica-explosao): para iterar numa
 *   --candidatas <f:v,..> troca as candidatas das cenas escolhidas, ex. 36:0,26:0
 *   --avaliar <js>        so avalia a expressao na pagina (com `__thumb` pronto)
 *                         e imprime o resultado: para depurar o roteiro
 *   --memoria-minima <MB> padrao 3000. Com o swap quase cheio e menos memoria
 *                         disponivel que isso, espera ate 3 min antes de abrir
 *                         o Chrome (e, com ele aberto, antes de cada cena com
 *                         700 MB a menos), e desiste se nao melhorar. 0
 *                         desliga a conferencia
 *   --sondar <faixa>      modo de escolha: "1-45" ou "7,9,38". Lista as fases
 *                         (tema, torre, bomba/TNT com a distancia ao hexagono,
 *                         CADEIA quando um explosivo alcanca outro) e monta uma
 *                         folha com uma foto de cada em <tmpdir>/hexadrop-sonda.png.
 *                         Nao grava nada em --saida
 *
 * O roteiro (fases, variantes, tempos e toques) esta em ROTEIRO e ESTATICAS,
 * logo abaixo. As fases sao regeradas de tempos em tempos (`npm run levels`) e
 * uma seed nova muda a torre: cada cena lista varias fases/variantes, na ordem
 * do que ja se mediu melhor, e fica com a de maior nota entre as que cumprem o
 * que a cena pede (ter TNT perto do hexagono, pousar no pedestal). O relatorio
 * no fim diz qual foi usada, com a nota.
 *
 * Precisa de: google-chrome, ffmpeg/ffprobe e o vite do proprio projeto.
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmdirSync, rmSync, statSync, statfsSync,
  symlinkSync, writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const RAIZ = resolve(import.meta.dirname, '..');
const FPS = 60;

// ------------------------------------------------------------------ opcoes

const argv = process.argv.slice(2);
/** @param {string} nome @param {string} [padrao] */
const opcao = (nome, padrao) => {
  const i = argv.indexOf(nome);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : padrao;
};
/** @param {string} nome */
const bandeira = (nome) => argv.includes(nome);

const SAIDA = resolve(RAIZ, opcao('--saida', 'marketing/thumbnail'));
const PORTA_HTTP = Number(opcao('--porta', '4190'));
const PORTA_CDP = Number(opcao('--cdp', '9444'));
const TAMANHO = Number(opcao('--tamanho', '1080'));
const LADO = Number(opcao('--lado', '540'));
const CRF = Number(opcao('--crf', '16'));
const DE_DIST = opcao('--from-dist');
const SONDAR = opcao('--sondar');
const MARCA_TOQUE = !bandeira('--sem-marca');
const SO_VIDEO = bandeira('--so-video');
const SO_ESTATICA = bandeira('--so-estatica');
const MANTER_TEMP = bandeira('--manter-temp');
const SO_CENAS = opcao('--cenas');
const CANDIDATAS = opcao('--candidatas');
const AVALIAR = opcao('--avaliar');
const MEMORIA_MINIMA = Number(opcao('--memoria-minima', '3000'));
/** Quanto o Chrome headless desta captura ocupa, medido: ~0,5 GB, com folga. */
const CHROME_MB = 700;

const PORTAS_DAS_OUTRAS = [9222, 9333, 9555, 9666, 9777, 9888];
if (PORTAS_DAS_OUTRAS.includes(PORTA_CDP)) {
  console.error(`A porta ${PORTA_CDP} e de outra ferramenta de tools/. Use --cdp 9444.`);
  process.exit(2);
}
const ESCALA = TAMANHO / LADO;
if (ESCALA > 2 + 1e-9) {
  // Viewport limita o dpr a 2 (core/viewport.js): acima disso o canvas sairia
  // menor que o video e teria que ser esticado.
  console.error(`--lado ${LADO} com --tamanho ${TAMANHO} pede dpr ${ESCALA.toFixed(2)}; o jogo para em 2. Use --lado >= ${Math.ceil(TAMANHO / 2)}.`);
  process.exit(2);
}

// ----------------------------------------------------------------- roteiro

/**
 * Cenas do video, na ordem. Tempos em segundos, contados do primeiro quadro
 * capturado da cena.
 *
 * - `candidatas`: pares [fase, variante] tentados em ordem; vale a primeira que
 *   cumpre a cena. Variante e o indice em levels.gen.js (0 a 3).
 * - `aquecer`: quadros rodados sem captura depois de abrir a fase, para a
 *   torre assentar (ela nasce com folga entre as pecas).
 * - `preparo`: toques de solucionador antes da captura (cena 2: descer o
 *   hexagono ate a TNT entrar na tela e ficar perto dele).
 * - `toques`: [tempo, seletor]. Seletores: 'sob-hex' (a peca em que o hexagono
 *   esta apoiado), 'dica' (a peca do solucionador), ou uma lista de materiais,
 *   ex. ['tnt', 'bomb'] (a mais perto do hexagono entre as que estao na tela).
 * - `vitoria`: joga cada candidata com cada politica ('cavar' desce em poco
 *   pela peca sob o hexagono; 'dica' e o solucionador), da nota ao fim de
 *   cada uma e captura `duracao` segundos da melhor: a partir de
 *   `antesDoToque` antes do ultimo toque, garantindo `minCascata` segundos
 *   da celebracao. `apressar`: segundos depois do inicio da cascata para um
 *   toque na celebracao (Session.hurryBonus), que a acelera; null desliga.
 *   `bastaNota`: para a procura na primeira tentativa com essa nota.
 * - `melhor`: roda todas as candidatas a seco e grava a de maior nota (queda
 *   do hexagono em metros + um quarto de ponto por peca destruida); sem ele
 *   vale a primeira que cumpre a cena. `basta`: para a procura na primeira
 *   candidata com essa nota (a lista vem na ordem do que ja se mediu melhor).
 * - `zoom`: aproxima a camera alem do enquadramento do jogo (1 = o do jogo).
 * - `linhas`: true mostra as linhas de estrela (padrao: escondidas, porque
 *   levam numeros e sao HUD); `marca`: false tira o anel do toque.
 */
const ROTEIRO = [
  {
    nome: 'toque',
    candidatas: [[2, 1], [2, 3], [3, 1], [1, 1], [2, 2], [3, 0], [2, 0], [1, 3], [1, 0], [1, 2]],
    melhor: true,
    basta: 1.9,
    aquecer: 45,
    duracao: 1.75,
    toques: [[0.2, 'sob-hex'], [0.95, 'sob-hex']],
  },
  {
    nome: 'explosao',
    candidatas: [[9, 3], [36, 0], [29, 0], [86, 3], [26, 0], [20, 3], [7, 1]],
    melhor: true,
    basta: 6,
    aquecer: 45,
    preparo: { material: ['tnt', 'bomb'], distancia: 3.6, maxToques: 14 },
    duracao: 1.75,
    toques: [[0.25, ['tnt', 'bomb']]],
  },
  {
    nome: 'vitoria',
    candidatas: [[1, 3], [1, 2], [3, 3], [2, 0], [2, 3], [3, 1], [1, 0], [1, 1], [2, 1], [2, 2], [3, 0], [3, 2], [4, 1], [5, 0]],
    aquecer: 45,
    vitoria: {
      duracao: 2.05, antesDoToque: 0.15, minCascata: 1.2, maxSegundos: 90,
      politicas: ['cavar', 'dica'], apressar: null, bastaNota: 11,
    },
  },
];

/**
 * Estaticas: cenas proprias, fora do video, no mesmo formato do roteiro. A
 * ferramenta roda cada candidata a seco, da nota a cada quadro de `janela`
 * (segundos depois do inicio) pela pose do hexagono - inclinado, em
 * movimento, com estilhaco no ar e inteiro dentro do quadro - e grava so o
 * melhor quadro da melhor candidata.
 *
 * `zoom` aproxima a camera no hexagono: a Poki mostra a thumbnail pequena, e
 * pede um objeto claro em primeiro plano. Sem anel de toque e sem as linhas de
 * estrela (numeros sao texto).
 */
const ESTATICAS = [
  {
    arquivo: 'hexadrop-estatica-1.png',
    nome: 'estatica-mundo1',
    candidatas: [[2, 0], [1, 0], [1, 3], [2, 1], [3, 0], [3, 1], [2, 3], [1, 1]],
    aquecer: 45,
    zoom: 1.55,
    duracao: 1.2,
    toques: [[0.1, 'sob-hex'], [0.6, 'sob-hex']],
    janela: [0.12, 1.2],
    pesos: { inclinacao: 1, velocidade: 0.6, particulas: 0.5 },
  },
  {
    arquivo: 'hexadrop-estatica-2.png',
    nome: 'estatica-explosao',
    // Paletas quentes: contrastam com o verde-agua do fundo da Poki.
    candidatas: [[36, 0], [29, 0], [26, 0]],
    aquecer: 45,
    zoom: 1.6,
    preparo: { material: ['tnt', 'bomb'], distancia: 3.6, maxToques: 14 },
    duracao: 0.8,
    toques: [[0.1, ['tnt', 'bomb']]],
    janela: [0.12, 0.5],
    pesos: { inclinacao: 0.6, velocidade: 0.4, particulas: 1.5 },
  },
];

// ------------------------------------------------- codigo que roda na pagina

/**
 * Relogio virtual e SDK falso. Instalado antes de qualquer script da pagina.
 * @param {{fps:number, epoca:number}} cfg
 */
function paginaRelogio(cfg) {
  const C = { t: 0, seq: 0, timers: new Map(), rafs: [], rafSeq: 0, quadros: 0 };
  /** @type {string[]} */
  const erros = [];
  window.__errosThumb = erros;
  window.addEventListener('error', (e) => erros.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) =>
    erros.push('promessa: ' + String((e.reason && e.reason.stack) || e.reason)),
  );

  const DataReal = Date;
  class DataVirtual extends DataReal {
    /** @param {...*} a */
    constructor(...a) {
      if (a.length) super(...a);
      else super(cfg.epoca + C.t);
    }
    static now() {
      return cfg.epoca + C.t;
    }
  }
  window.Date = DataVirtual;
  Object.defineProperty(performance, 'now', { value: () => C.t, configurable: true, writable: true });

  const agenda = (fn, ms, args, repete) => {
    const id = ++C.seq;
    if (typeof fn !== 'function') return id;
    const d = Math.max(0, Number(ms) || 0);
    C.timers.set(id, { id, em: C.t + d, fn, args, repete: repete ? Math.max(1, d) : 0, ordem: id });
    return id;
  };
  window.setTimeout = (fn, ms, ...a) => agenda(fn, ms, a, false);
  window.setInterval = (fn, ms, ...a) => agenda(fn, ms, a, true);
  window.clearTimeout = (id) => void C.timers.delete(id);
  window.clearInterval = (id) => void C.timers.delete(id);
  window.requestAnimationFrame = (cb) => {
    const id = ++C.rafSeq;
    C.rafs.push({ id, cb });
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    C.rafs = C.rafs.filter((r) => r.id !== id);
  };

  // Um centesimo de microssegundo a mais por quadro. Com 1000/60 exato, o
  // arredondamento de (agora - antes) as vezes da um fio abaixo de FIXED_DT, e
  // o laco do jogo (core/loop.js) faria zero passos num quadro e dois no
  // seguinte - o engasgo que este relogio existe para evitar.
  const QUADRO_MS = 1000 / cfg.fps + 1e-5;

  function quadro() {
    const alvo = C.t + QUADRO_MS;
    for (let guarda = 0; guarda < 100000; guarda++) {
      let prox = null;
      for (const tm of C.timers.values()) {
        if (tm.em > alvo) continue;
        if (!prox || tm.em < prox.em || (tm.em === prox.em && tm.ordem < prox.ordem)) prox = tm;
      }
      if (!prox) break;
      if (prox.em > C.t) C.t = prox.em;
      if (prox.repete) {
        prox.em += prox.repete;
        prox.ordem = ++C.seq;
      } else C.timers.delete(prox.id);
      try {
        prox.fn(...prox.args);
      } catch (e) {
        erros.push(String((e && e.stack) || e));
      }
    }
    C.t = alvo;
    const fila = C.rafs;
    C.rafs = [];
    for (const r of fila) {
      try {
        r.cb(C.t);
      } catch (e) {
        erros.push(String((e && e.stack) || e));
      }
    }
    C.quadros++;
  }
  window.__relogio = { quadro, agora: () => C.t, quadros: () => C.quadros };

  // SDK falso: o carregador da Poki e bloqueado na rede, e sem SDK nenhum o
  // wrapper esperaria os prazos dele - que agora sao virtuais e nao andam.
  window.PokiSDK = {
    init: () => Promise.resolve(),
    gameLoadingFinished() {},
    gameplayStart() {},
    gameplayStop() {},
    commercialBreak: (cb) => {
      if (typeof cb === 'function') cb();
      return Promise.resolve();
    },
    rewardedBreak: () => Promise.resolve(false),
    measure() {},
    getDeviceInfo: () => Promise.resolve({ category: 'mobile' }),
    movePill() {},
    captureError() {},
    setDebug() {},
  };
}

/**
 * Ajudante instalado depois do boot: abre fases, escolhe pecas, toca, avanca o
 * relogio e le o canvas. Tudo o que decide um toque mora aqui, na pagina, para
 * as duas passadas da cena de vitoria rodarem literalmente o mesmo codigo.
 * @param {{marcaToque:boolean, fps:number}} opts
 */
function paginaAjudante(opts) {
  const g = window.__game;
  const R = window.__relogio;
  const H = { quadro: 0, ultimoToque: -1e9, marcas: [], cfg: {}, toques: [] };
  const cena = () => g.scene;
  const sessao = () => g.scene.session;
  const mundo = () => g.scene.session.world;

  /** Centro de uma celula da peca, em coordenadas de mundo. */
  function pontoDaPeca(p) {
    const cell = p.cells[Math.floor(p.cells.length / 2)];
    const lx = cell[0] + 0.5 - p.cw / 2;
    const ly = cell[1] + 0.5 - p.ch / 2;
    const pos = p.body.getPosition();
    const a = p.body.getAngle();
    return { x: pos.x + lx * Math.cos(a) - ly * Math.sin(a), y: pos.y + lx * Math.sin(a) + ly * Math.cos(a) };
  }
  function naTela(pt, folga = 0) {
    const [sx, sy] = cena().camera.toScreen(pt.x, pt.y);
    const vp = cena().viewport;
    return sx >= folga && sy >= folga && sx < vp.width - folga && sy < vp.height - folga;
  }
  const tocavel = (p) => p.alive && p.body.isDynamic() && p.material !== 'obsidian';

  /** @param {*} sel */
  function escolher(sel) {
    const w = mundo();
    const hex = w.hexTransform();
    const vivas = w.alivePieces().filter(tocavel);
    if (sel === 'dica') {
      const p = sessao().requestHint();
      // A dica acende um realce; o toque vem no mesmo quadro e o apaga, mas
      // se ela nao achar nada o realce nao pode ficar para o video.
      sessao().hintPiece = null;
      return p && p.alive ? p : null;
    }
    if (sel === 'sob-hex') {
      const base = hex.y - w.hexHalfHeight();
      let melhor = null;
      let nota = -Infinity;
      for (const p of vivas) {
        const b = w.pieceBox(p);
        if (Math.abs(b.cx - hex.x) > b.hw + 0.35) continue;
        if (b.top > base + 0.35) continue;
        const n = b.top * 10 - Math.abs(b.cx - hex.x);
        if (n > nota) {
          nota = n;
          melhor = p;
        }
      }
      return melhor;
    }
    if (sel && sel.peca) return sel.peca.alive ? sel.peca : null;
    if (Array.isArray(sel)) {
      const alvo = vivas.filter((p) => sel.includes(p.material) && naTela(pontoDaPeca(p), 20));
      alvo.sort((a, b) => {
        const pa = pontoDaPeca(a);
        const pb = pontoDaPeca(b);
        return Math.hypot(pa.x - hex.x, pa.y - hex.y) - Math.hypot(pb.x - hex.x, pb.y - hex.y);
      });
      return alvo[0] || null;
    }
    return null;
  }

  H.tocar = (sel) => {
    const s = sessao();
    if (s.finished || s.bonus) return null;
    const p = escolher(sel);
    if (!p) return null;
    const pt = pontoDaPeca(p);
    const r = s.tap(pt.x, pt.y, 0);
    H.ultimoToque = H.quadro;
    const ok = !!(r && r.ok);
    if (ok) H.marcas.push({ x: pt.x, y: pt.y, q: H.quadro });
    const nomeSel = typeof sel === 'string' ? sel : Array.isArray(sel) ? sel.join('|') : 'dica';
    const info = { quadro: H.quadro, sel: nomeSel, mat: p.material, ok };
    H.toques.push(info);
    return info;
  };

  /** Anel do toque, desenhado por cima do jogo (GameScene.onOverlay). */
  function sobreposicao(ctx) {
    if (!opts.marcaToque || H.cfg.marca === false) return;
    const cam = cena().camera;
    for (const m of H.marcas) {
      const idade = (H.quadro - m.q) / opts.fps;
      if (idade < 0 || idade > 0.42) continue;
      const k = idade / 0.42;
      const e = 1 - (1 - k) * (1 - k);
      const [sx, sy] = cam.toScreen(m.x, m.y);
      const ppm = cam.pxPerMeter;
      ctx.save();
      ctx.globalAlpha = 0.95 * (1 - k);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = ppm * (0.12 - 0.07 * k);
      ctx.beginPath();
      ctx.arc(sx, sy, ppm * (0.22 + 0.6 * e), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.5 * (1 - k) * (1 - k);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, ppm * 0.2 * (1 - k), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** Aproxima a camera alem do enquadramento do jogo, centrando no hexagono. */
  function aplicarZoom(zoom) {
    if (!zoom || zoom === 1) return;
    const sc = cena();
    const cam = sc.camera;
    const w = mundo();
    cam.pxPerMeter *= zoom;
    const meio = cam.viewH / 2;
    const topo = w.towerHeight + 2.9;
    cam.maxY = topo - (meio - cam.topInset) / cam.pxPerMeter;
    cam.minY = -1.1 + (meio - cam.bottomInset) / cam.pxPerMeter;
    if (cam.minY > cam.maxY) cam.minY = cam.maxY = (cam.minY + cam.maxY) / 2;
    cam.x = w.hexTransform().x * 0.6 + (w.towerWidth / 2) * 0.4;
    cam.y = cam.maxY;
    cam.targetY = cam.y;
    sc.sprites = new sc.sprites.constructor(sc.theme, cam.pxPerMeter, sc.viewport.dpr);
    sc.renderer.bgCanvas = null;
  }

  H.abrir = (fase, variante, cfg) => {
    H.cfg = cfg || {};
    g.flowLevels = false;
    g.startLevel(fase, variante);
    const sc = cena();
    const s = sessao();
    s.autoHintAfter = 0;
    s.onAutoHint = null;
    s.hintPiece = null;
    // Sem HUD no video, as faixas que o jogo reserva para ela viram so fundo.
    sc.setInsets(H.cfg.topo ?? 24, H.cfg.base ?? 16, false);
    aplicarZoom(H.cfg.zoom);
    sc.camera.trauma = 0;
    // O sorteio dos estilhacos (GameScene.rng) nasce uma vez por pagina e nao
    // volta a cada fase: sem zerar aqui, o desenho das particulas dependeria de
    // tudo o que rodou antes - inclusive de uma cena repetida depois de o Chrome
    // cair. A fisica ja e a mesma; assim o quadro inteiro tambem e.
    if (sc.rng && typeof sc.rng.constructor === 'function') sc.rng = new sc.rng.constructor(20260918);
    sc.onOverlay = sobreposicao;
    // As linhas de estrela levam os numeros 1, 2 e 3 e o icone da estrela:
    // texto e HUD que a thumbnail dispensa. Some so nesta pagina, trocando o
    // metodo da instancia; o prototipo continua o do jogo.
    if (H.cfg.linhas) delete sc.renderer.drawStarLines;
    else sc.renderer.drawStarLines = () => {};
    H.quadro = 0;
    H.inicioBonus = null;
    H.apressou = false;
    H.ultimoToque = -1e9;
    H.marcas = [];
    H.toques = [];
    const w = s.world;
    return {
      fase: g.level,
      variante: g.variantIndex,
      variantes: g.variantCount,
      tema: sc.theme.id,
      colunas: w.towerWidth,
      linhas: w.towerHeight,
      pecas: w.alivePieces().length,
      ppm: sc.camera.pxPerMeter,
      toque: sc.touch,
      dpr: sc.viewport.dpr,
    };
  };

  /** A decisao do quadro atual: toques marcados e, se ligado, o solucionador. */
  function politica() {
    const s = sessao();
    const c = H.cfg;
    for (const [q, sel] of c.toques || []) if (q === H.quadro) H.tocar(sel);
    if (c.solucionar && !s.finished && !s.bonus) {
      const desde = H.quadro - H.ultimoToque;
      if (desde >= c.minIntervalo && (desde >= c.maxIntervalo || s.world.everythingAtRest())) {
        // 'cavar' desce o hexagono em poco, tocando sempre a peca sob ele: o
        // resto da torre fica de pe e sobra muita peca para a celebracao.
        // Onde nao ha peca sob ele, quem decide e o solucionador.
        const cavar = c.solucionar === 'cavar' && escolher('sob-hex');
        H.tocar(cavar ? 'sob-hex' : 'dica');
      }
    }
  }

  const venceu = () => {
    const s = sessao();
    return s.bonus || s.state === 'won' || (s.state === 'stuck' && s.stars >= 1);
  };

  H.estado = () => {
    const s = sessao();
    const w = s.world;
    const hex = w.hexTransform();
    const v = w.hexBody ? w.hexBody.getLinearVelocity() : { x: 0, y: 0 };
    const [sx, sy] = cena().camera.toScreen(hex.x, hex.y);
    const vp = cena().viewport;
    // O hexagono tem simetria de 60 graus: a inclinacao que se ve vai de 0 a 30.
    const giro = ((((hex.angle * 180) / Math.PI) % 60) + 60) % 60;
    return {
      quadro: H.quadro,
      estado: s.state,
      bonus: s.bonus,
      venceu: venceu(),
      estrelas: s.stars,
      toques: s.taps,
      hex: [+hex.x.toFixed(4), +hex.y.toFixed(4), +hex.angle.toFixed(4)],
      hexV: +Math.hypot(v.x, v.y).toFixed(3),
      hexTela: [+(sx / vp.width).toFixed(3), +(sy / vp.height).toFixed(3)],
      inclinacao: +Math.min(giro, 60 - giro).toFixed(2),
      particulas: cena().particles.count,
      vivas: w.alivePieces().length,
      camY: +cena().camera.y.toFixed(3),
      erros: window.__errosThumb.length,
    };
  };

  /** Avanca n quadros sem capturar e devolve o estado de cada um. */
  H.coletar = (n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      H.passo();
      out.push(H.estado());
    }
    return out;
  };

  /** Quanto este quadro de vitoria rende no video: pecas na tela e hexagono no meio. */
  H.notaDaVitoria = () => {
    const s = sessao();
    const w = s.world;
    const vp = cena().viewport;
    const hex = w.hexTransform();
    const [hx] = cena().camera.toScreen(hex.x, hex.y);
    const centro = Math.max(0, 1 - Math.abs(hx / vp.width - 0.5) * 2);
    const naTelaN = w.alivePieces().filter((p) => tocavel(p) && naTela(pontoDaPeca(p), 0)).length;
    // A cascata estoura de cima para baixo (Session.startBonus): cada peca
    // fora da tela e um estouro que ninguem ve antes dos que se ve.
    const fora = Math.max(0, s.bonusTotal - naTelaN);
    const ultimo = H.toques.length ? H.toques[H.toques.length - 1].quadro : 0;
    return {
      // 'stuck' com estrela tambem e vitoria no jogo (hexagono encalhado), mas
      // no video a vitoria e o hexagono pousado no pedestal.
      pousou: s.state === 'won',
      pecasNaTela: naTelaN,
      cascata: s.bonusTotal,
      centro: +centro.toFixed(3),
      ultimoToque: ultimo,
      nota: +((naTelaN - 1.5 * fora) * (centro >= 0.45 ? 1 : 0.25) - (s.state === 'won' ? 0 : 1000)).toFixed(2),
    };
  };

  H.passo = () => {
    // Toque durante a celebracao (GameScene.handleDown -> Session.hurryBonus):
    // a cascata aperta o passo. So existe nos builds que ja tem a funcao.
    const s = sessao();
    if (H.cfg.apressar != null && s.bonus && !H.apressou && typeof s.hurryBonus === 'function') {
      if (H.inicioBonus == null) H.inicioBonus = H.quadro;
      if (H.quadro - H.inicioBonus >= Math.round(H.cfg.apressar * opts.fps)) {
        s.hurryBonus();
        H.apressou = true;
      }
    }
    politica();
    R.quadro();
    H.quadro++;
  };

  /** Avanca n quadros sem capturar; para antes se `ateVencer` e venceu. */
  H.avancar = (n, ateVencer) => {
    for (let i = 0; i < n; i++) {
      H.passo();
      if (ateVencer && venceu()) break;
      if (ateVencer && sessao().finished) break;
    }
    return H.estado();
  };

  /**
   * Preparo da cena de explosao: toca a peca do solucionador ate uma peca dos
   * materiais pedidos estar na tela e a menos de `distancia` do hexagono.
   */
  H.preparar = (p) => {
    const distanciaAtual = () => {
      const alvo = escolher(p.material);
      if (!alvo) return 'nenhum na tela';
      const hex = mundo().hexTransform();
      const pt = pontoDaPeca(alvo);
      return `${alvo.material} a ${Math.hypot(pt.x - hex.x, pt.y - hex.y).toFixed(2)} m`;
    };
    const perto = () => {
      const alvo = escolher(p.material);
      if (!alvo) return false;
      const hex = mundo().hexTransform();
      const pt = pontoDaPeca(alvo);
      return Math.hypot(pt.x - hex.x, pt.y - hex.y) <= p.distancia;
    };
    const trilha = [];
    for (let k = 0; k <= p.maxToques; k++) {
      H.avancar(30);
      for (let i = 0; i < 150 && !mundo().everythingAtRest(); i++) H.passo();
      if (sessao().finished) return { ok: false, motivo: `fase acabou: ${sessao().state}`, trilha, ...H.estado() };
      trilha.push(distanciaAtual());
      if (perto()) {
        H.avancar(40);
        return { ok: !!escolher(p.material), trilha, ...H.estado() };
      }
      if (k < p.maxToques) {
        // Se o solucionador quer o explosivo, a hora dele chegou: o toque
        // fica para a captura.
        const dica = escolher('dica');
        if (dica && p.material.includes(dica.material) && naTela(pontoDaPeca(dica), 20)) {
          trilha.push(`dica pede ${dica.material}`);
          H.avancar(40);
          return { ok: true, trilha, ...H.estado() };
        }
        const t = H.tocar(dica ? { peca: dica } : 'sob-hex');
        trilha.push(t ? `toque ${t.mat}` : 'sem toque');
      }
    }
    return { ok: false, motivo: `material nao chegou perto (${distanciaAtual()})`, trilha, ...H.estado() };
  };

  /** Um quadro com captura: decide, avanca e devolve o canvas em PNG. */
  H.quadroCapturado = () => {
    H.passo();
    return { png: g.canvas.toDataURL('image/png'), ...H.estado() };
  };

  /** Fracao de pixels perto do #83FFE7, o fundo da Poki. */
  H.pertoDoFundo = () => {
    const c = g.canvas;
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    let perto = 0;
    for (let i = 0; i < d.length; i += 16) {
      n++;
      const dr = d[i] - 0x83;
      const dg = d[i + 1] - 0xff;
      const db = d[i + 2] - 0xe7;
      if (dr * dr + dg * dg + db * db < 70 * 70) perto++;
    }
    return perto / n;
  };

  /** Resumo das fases, para escolher o roteiro. */
  H.sondar = (fases) => {
    const out = [];
    for (const fase of fases) {
      const linha = { fase, variantes: [] };
      for (let vi = 0; vi < 8; vi++) {
        const { session, theme } = g.makeSession(fase, vi);
        if (vi >= g.variantCount) {
          session.destroy();
          break;
        }
        const L = session.layout;
        const conta = {};
        const explosivos = [];
        const hx = L.hexagon.x;
        const hy = L.height + 0.97;
        const centros = [];
        for (const p of L.pieces) {
          conta[p.material] = (conta[p.material] || 0) + 1;
          if (p.material !== 'tnt' && p.material !== 'bomb') continue;
          // Distancia do centro da caixa da peca ao hexagono, como a fase nasce.
          const xs = p.cells.map((c) => c[0]);
          const ys = p.cells.map((c) => c[1]);
          const cx = p.x + (Math.min(...xs) + Math.max(...xs) + 1) / 2;
          const cy = p.y + (Math.min(...ys) + Math.max(...ys) + 1) / 2;
          explosivos.push(`${p.material}@${p.y}~${Math.hypot(cx - hx, cy - hy).toFixed(1)}m`);
          centros.push({ m: p.material, cx, cy });
        }
        // Explosao em cadeia: um explosivo dentro do raio de outro (bomba 1,9 m,
        // TNT 2,2 m, physics/materials.js) - a explosao destroi o vizinho, e
        // o vizinho destruido explode tambem.
        const raio = { bomb: 1.9, tnt: 2.2 };
        let cadeia = 0;
        for (const a of centros) {
          for (const b of centros) {
            if (a !== b && Math.hypot(a.cx - b.cx, a.cy - b.cy) <= raio[a.m]) cadeia++;
          }
        }
        linha.tema = theme;
        linha.torre = `${L.width}x${L.height}`;
        linha.variantes.push({ vi, par: session.par, explosivos, cadeia, conta, balanco: !!L.pedestal.oscillate, vento: !!L.wind });
        session.destroy();
      }
      out.push(linha);
    }
    return out;
  };

  window.__thumb = H;
  return true;
}

// ------------------------------------------------------------ foto e build

const IGNORAR = new Set(['node_modules', 'dist', 'dist-lisa', '.git', 'marketing', 'inspiration']);

/** Copia o projeto para uma pasta temporaria e builda la. */
function buildDaFoto(temp) {
  const copia = join(temp, 'projeto');
  cpSync(RAIZ, copia, {
    recursive: true,
    filter: (origem) => {
      const rel = relative(RAIZ, origem);
      if (!rel) return true;
      if (IGNORAR.has(rel.split(sep)[0])) return false;
      return !rel.endsWith('.zip');
    },
  });
  symlinkSync(join(RAIZ, 'node_modules'), join(copia, 'node_modules'), 'dir');
  const saida = join(temp, 'build');
  const env = { ...process.env };
  // A versao Poki: e a que vai para a vitrine, com o mesmo codigo da QA.
  delete env.VITE_PLATAFORMA;
  console.log(`build da foto do projeto em ${copia}`);
  const r = spawnSync('npx', ['vite', 'build', '--outDir', saida, '--emptyOutDir', '--logLevel', 'warn'], {
    cwd: copia,
    env,
    stdio: 'inherit',
  });
  if (r.status !== 0) throw new Error('vite build falhou na copia do projeto');
  return saida;
}

// ------------------------------------------------------------- servidor

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

/** Servidor estatico minimo; devolve o servidor e a porta que pegou. */
async function servir(pasta, porta) {
  const raiz = resolve(pasta);
  for (let p = porta; p < porta + 10; p++) {
    const server = createServer((req, res) => {
      let caminho = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname);
      if (caminho.endsWith('/')) caminho += 'index.html';
      const arquivo = resolve(raiz, '.' + caminho);
      if (arquivo !== raiz && !arquivo.startsWith(raiz + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      try {
        const corpo = readFileSync(arquivo);
        res.writeHead(200, { 'content-type': MIME[extname(arquivo)] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(corpo);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    const ok = await new Promise((res) => {
      server.once('error', () => res(false));
      server.listen(p, '127.0.0.1', () => res(true));
    });
    if (ok) return { server, porta: p };
  }
  throw new Error(`nenhuma porta livre entre ${porta} e ${porta + 9}`);
}

// ---------------------------------------------------------------- chrome

async function abrirChrome(perfil) {
  try {
    await fetch(`http://127.0.0.1:${PORTA_CDP}/json/version`);
    throw new Error(`ja ha um Chrome na porta ${PORTA_CDP}; feche-o ou use --cdp`);
  } catch (e) {
    if (String(e.message).startsWith('ja ha')) throw e;
  }
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${PORTA_CDP}`,
    `--user-data-dir=${perfil}`,
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--mute-audio',
    // Menos processos e menos servico de fundo: a captura roda em maquina de
    // desenvolvimento, dividindo memoria com o resto.
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--renderer-process-limit=1',
    '--in-process-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--force-color-profile=srgb',
    'about:blank',
  ], { stdio: 'ignore' });
  let url = '';
  for (let i = 0; i < 80 && !url; i++) {
    try {
      url = (await (await fetch(`http://127.0.0.1:${PORTA_CDP}/json/version`)).json()).webSocketDebuggerUrl;
    } catch {
      await sleep(250);
    }
  }
  if (!url) throw new Error('o Chrome nao respondeu');
  const sock = new WebSocket(url);
  await new Promise((ok, falha) => {
    sock.onopen = ok;
    sock.onerror = falha;
  });
  let id = 0;
  const pendentes = new Map();
  /** @type {((m:*)=>void)[]} */
  const ouvintes = [];
  sock.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pendentes.has(m.id)) {
      pendentes.get(m.id)(m);
      pendentes.delete(m.id);
    } else if (m.method) {
      for (const f of ouvintes) f(m);
    }
  };
  // Se o Chrome morrer (por fora, ou por falta de memoria), toda chamada
  // pendente falha na hora em vez de esperar o prazo inteiro.
  let morto = '';
  const derrubar = (motivo) => {
    morto = motivo;
    for (const [mid, cb] of pendentes) {
      pendentes.delete(mid);
      cb({ error: { message: motivo } });
    }
  };
  chrome.once('exit', (code, sinal) => derrubar(`o Chrome saiu (codigo ${code}, sinal ${sinal})`));
  ouvintes.push((m) => {
    if (m.method === 'Inspector.targetCrashed') derrubar('a aba do Chrome caiu (Inspector.targetCrashed)');
    if (m.method === 'Page.javascriptDialogOpening') {
      console.log(`  aviso: dialogo da pagina aceito: ${m.params.message}`);
      sock.send(JSON.stringify({ id: ++id, method: 'Page.handleJavaScriptDialog', params: { accept: true }, sessionId: m.sessionId }));
    }
    if (m.method === 'Runtime.exceptionThrown') console.log(`  aviso: excecao na pagina: ${m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text}`);
  });
  sock.onclose = () => derrubar('a conexao com o Chrome caiu');
  /** @returns {Promise<*>} */
  const enviar = (method, params = {}, sessionId) =>
    new Promise((ok, falha) => {
      if (morto) {
        falha(new Error(morto));
        return;
      }
      const mid = ++id;
      const prazo = setTimeout(() => {
        pendentes.delete(mid);
        falha(new Error(`CDP sem resposta em 120 s: ${method}`));
      }, 120000);
      pendentes.set(mid, (m) => {
        clearTimeout(prazo);
        if (m.error && m.error.message === morto) falha(new Error(morto));
        else ok(m);
      });
      sock.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  /** Fecha e espera o processo sair: so entao o perfil pode ser apagado. */
  const fechar = async () => {
    const saiu = chrome.exitCode !== null ? Promise.resolve() : new Promise((ok) => chrome.once('exit', ok));
    // Fechamento limpo primeiro: morto a SIGTERM, o Chrome ainda grava o
    // perfil enquanto a pasta temporaria esta sendo apagada.
    try {
      sock.send(JSON.stringify({ id: ++id, method: 'Browser.close' }));
    } catch {
      /* ja fechou */
    }
    if (!(await Promise.race([saiu.then(() => true), sleep(4000).then(() => false)]))) chrome.kill('SIGKILL');
    await Promise.race([saiu, sleep(2000)]);
    try {
      sock.close();
    } catch {
      /* ja fechou */
    }
  };
  return { enviar, fechar };
}

// ---------------------------------------------------------- ffmpeg

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg falhou: ' + args.join(' '));
}

function ffprobe(arquivo) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries',
    'stream=index,codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames:format=duration,size,bit_rate',
    '-of', 'default=noprint_wrappers=1', arquivo], { encoding: 'utf8' });
  return r.stdout.trim();
}

// ------------------------------------------------------------------ main

// ------------------------------------------------------------- memoria

/**
 * Onde gravar os quadros do video (~1,3 MB de PNG cada, ~430 MB por video).
 *
 * Se o diretorio temporario do sistema for tmpfs, ele e RAM - e com o swap
 * cheio, e RAM que falta para o resto da maquina: foi o que empurrou esta
 * captura para a linha de corte do earlyoom. Nesse caso os quadros vao para
 * ~/.cache/hexadrop-thumb/, em disco, e sao apagados no fim do mesmo jeito.
 * A foto do projeto e o build (~15 MB) continuam no temporario.
 * @param {string} temp
 * @returns {string}
 */
function pastaDeQuadros(temp) {
  const TMPFS = 0x01021994;
  try {
    if (statfsSync(tmpdir()).type === TMPFS) return join(homedir(), '.cache', 'hexadrop-thumb', basename(temp));
  } catch {
    /* sem statfs: fica no temporario */
  }
  return join(temp, 'quadros');
}

/**
 * Memoria da maquina, pelo /proc/meminfo (so Linux; fora dele, null).
 * @returns {{disponivelMB:number, swapLivre:number}|null}
 */
function memoria() {
  try {
    const txt = readFileSync('/proc/meminfo', 'utf8');
    const kb = (k) => Number((txt.match(new RegExp(`^${k}:\\s+(\\d+)`, 'm')) || [])[1] || 0);
    const swap = kb('SwapTotal');
    return { disponivelMB: Math.round(kb('MemAvailable') / 1024), swapLivre: swap ? kb('SwapFree') / swap : 1 };
  } catch {
    return null;
  }
}

/**
 * Espera a maquina ter memoria antes de abrir o Chrome ou gravar uma cena.
 *
 * Numa maquina de desenvolvimento com o swap cheio, o earlyoom (ou o OOM do
 * kernel) mata o processo de maior oom_score - e o renderizador do Chrome e
 * sempre o primeiro da fila: o desta captura, e tambem as abas do navegador de
 * quem esta usando a maquina. Medido aqui: com 99% do swap ocupado e ~2,3 GB
 * disponiveis, cada captura derrubava a propria aba em segundos e levava junto
 * abas do Chrome do usuario. Esperar e melhor do que empurrar a maquina para
 * baixo do limite.
 *
 * Com o Chrome desta captura ja aberto, o piso cai CHROME_MB: a memoria que ele
 * ocupa ja saiu do "disponivel", e esperar por ela seria esperar por si mesmo.
 * @param {string} onde
 * @param {boolean} [chromeAberto]
 */
async function esperarMemoria(onde, chromeAberto = false) {
  if (!MEMORIA_MINIMA) return;
  const piso = MEMORIA_MINIMA - (chromeAberto ? CHROME_MB : 0);
  for (let t = 0; ; t += 5) {
    const m = memoria();
    if (!m || m.disponivelMB >= piso || m.swapLivre > 0.1) return;
    if (t === 0) {
      console.log(`  memoria baixa antes de ${onde}: ${m.disponivelMB} MB disponiveis (piso ${piso}), swap ${(m.swapLivre * 100).toFixed(1)}% livre; esperando ate 3 min`);
    }
    if (t >= 180) {
      throw new Error(`memoria baixa (${m.disponivelMB} MB disponiveis, swap ${(m.swapLivre * 100).toFixed(1)}% livre): `
        + 'o earlyoom mataria o Chrome desta captura e abas de outros programas. Libere memoria ou use --memoria-minima 0');
    }
    await sleep(5000);
  }
}

/** @param {string} faixa "1-45" ou "7,9,38" */
function lerFaixa(faixa) {
  const out = [];
  for (const parte of faixa.split(',')) {
    const [a, b] = parte.split('-').map(Number);
    for (let n = a; n <= (b || a); n++) out.push(n);
  }
  return out;
}

async function main() {
  // Se faltar memoria, que o earlyoom (ou o OOM do kernel) mate esta captura
  // e nao outro programa: o valor passa por heranca para o vite, o Chrome e o
  // ffmpeg. Subir o proprio oom_score_adj nao pede privilegio nenhum. A
  // captura aguenta perder o Chrome (a cena se repete numa pagina nova); a aba
  // do navegador de quem esta usando a maquina nao aguenta.
  try {
    writeFileSync('/proc/self/oom_score_adj', '1000');
  } catch {
    /* fora do Linux */
  }
  const temp = mkdtempSync(join(tmpdir(), 'hexadrop-thumb-'));
  let fechar = async () => {};
  let server = null;
  let quadros = '';
  const limpar = async () => {
    await fechar();
    if (server) server.close();
    if (MANTER_TEMP) {
      console.log(`pasta temporaria mantida: ${temp}${quadros && !quadros.startsWith(temp) ? ` (quadros em ${quadros})` : ''}`);
      return;
    }
    for (const pasta of [temp, quadros]) {
      if (!pasta) continue;
      try {
        rmSync(pasta, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
      } catch (e) {
        console.log(`aviso: nao consegui apagar ${pasta} (${e.code || e.message})`);
      }
    }
    // A ~/.cache/hexadrop-thumb/ so existe durante a captura.
    const cache = join(homedir(), '.cache', 'hexadrop-thumb');
    try {
      if (quadros.startsWith(cache)) rmdirSync(cache);
    } catch {
      /* nao esta vazia: outra captura em curso */
    }
  };
  process.on('SIGINT', async () => {
    await limpar();
    process.exit(130);
  });

  try {
    const pasta = DE_DIST ? resolve(RAIZ, DE_DIST) : buildDaFoto(temp);
    if (!existsSync(join(pasta, 'index.html'))) throw new Error(`sem index.html em ${pasta}`);
    const serv = await servir(pasta, PORTA_HTTP);
    server = serv.server;
    const base = `http://127.0.0.1:${serv.porta}`;
    console.log(`servindo ${pasta} em ${base}`);

    // Uma pagina do jogo pronta para capturar. Se o Chrome cair no meio (numa
    // maquina sem memoria sobrando, o kernel mata o renderizador), a cena que
    // estava sendo gravada recomeca numa pagina nova: cada cena abre a propria
    // fase e a simulacao so depende de fase, variante e toques, entao repetir
    // da o mesmo resultado.
    let aberturas = 0;
    const novaPagina = async () => {
      await esperarMemoria('abrir o Chrome');
      const chrome = await abrirChrome(join(temp, `perfil-${++aberturas}`));
      fechar = chrome.fechar;
      const { enviar } = chrome;
      const { targetId } = (await enviar('Target.createTarget', { url: 'about:blank' })).result;
      // A aba em branco com que o Chrome abre e um renderizador a mais a toa.
      const abas = (await enviar('Target.getTargets')).result?.targetInfos || [];
      for (const a of abas) if (a.type === 'page' && a.targetId !== targetId) await enviar('Target.closeTarget', { targetId: a.targetId });
      const { sessionId: S } = (await enviar('Target.attachToTarget', { targetId, flatten: true })).result;
      await enviar('Page.enable', {}, S);
      await enviar('Runtime.enable', {}, S);
      await enviar('Network.enable', {}, S);
      await enviar('Network.setBlockedURLs', { urls: ['*game-cdn.poki.com*', '*poki-sdk*'] }, S);
      await enviar('Emulation.setDeviceMetricsOverride', { width: LADO, height: LADO, deviceScaleFactor: ESCALA, mobile: true }, S);
      // Toque de verdade: ponteiro principal grosso, e a camera usa a celula de
      // dedo (56 px, game/scene.js) - a torre aparece grande, como no celular.
      await enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, S);
      await enviar('Page.addScriptToEvaluateOnNewDocument', {
        source: `(${paginaRelogio.toString()})(${JSON.stringify({ fps: FPS, epoca: Date.UTC(2026, 8, 23, 12) })});`,
      }, S);

      /** @returns {Promise<*>} */
      const avaliar = async (expr) => {
        const r = await enviar('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, S);
        if (r.result?.exceptionDetails) {
          throw new Error('erro na pagina: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
        }
        if (r.error) throw new Error(r.error.message);
        return r.result?.result?.value;
      };

      await enviar('Page.navigate', { url: `${base}/index.html` }, S);
      // O boot nao espera temporizador nenhum, mas se um dia esperar o relogio
      // virtual tem que andar: um quadro a cada 50 ms reais ate o jogo abrir.
      let pronto = false;
      for (let i = 0; i < 400 && !pronto; i++) {
        await sleep(50);
        pronto = !!(await avaliar('!!(window.__game && window.__game.scene && window.__game.scene.session && window.__game.screen === "game")').catch(() => false));
        if (!pronto) await avaliar('window.__relogio && window.__relogio.quadro()').catch(() => {});
      }
      if (!pronto) throw new Error('o jogo nao abriu (window.__game ausente? sirva em 127.0.0.1)');
      await avaliar(`(${paginaAjudante.toString()})(${JSON.stringify({ marcaToque: MARCA_TOQUE, fps: FPS })})`);
      return avaliar;
    };
    let pagina = await novaPagina();
    /** Avalia na pagina da vez: depois de uma queda, a pagina e outra. */
    const js = (expr) => pagina(expr);
    const caiu = (e) => /caiu|saiu|sem resposta/.test(String(e && e.message));
    /** Roda `fn` e, se o Chrome cair, abre outro e tenta de novo (ate 3 vezes). */
    const resistente = async (nome, fn) => {
      for (let vez = 1; ; vez++) {
        await esperarMemoria(nome, true);
        try {
          return await fn();
        } catch (e) {
          if (!caiu(e) || vez >= 3) throw e;
          const m = memoria();
          console.log(`  ${nome}: ${e.message}${m ? ` (${m.disponivelMB} MB disponiveis, swap ${(m.swapLivre * 100).toFixed(1)}% livre)` : ''}; abrindo outro Chrome em ${10 * vez} s e repetindo (${vez}/2)`);
          await fechar();
          await sleep(10000 * vez);
          pagina = await novaPagina();
        }
      }
    };
    const ambiente = await js('({ coarse: matchMedia("(pointer: coarse)").matches, dpr: devicePixelRatio, w: innerWidth, h: innerHeight })');
    console.log('pagina:', JSON.stringify(ambiente));

    if (AVALIAR) {
      console.log(JSON.stringify(await js(AVALIAR), null, 1));
      return;
    }
    if (SONDAR) {
      await sondar(js, lerFaixa(SONDAR), temp);
      return;
    }

    mkdirSync(SAIDA, { recursive: true });
    quadros = pastaDeQuadros(temp);
    mkdirSync(quadros, { recursive: true });
    /** @type {Map<string, {inicio:number, n:number, info:*, fundo:number[]}>} */
    const cenas = new Map();
    let total = 0;
    const escolhidas = SO_CENAS ? new Set(SO_CENAS.split(',')) : null;
    for (const c0 of SO_ESTATICA ? [] : ROTEIRO) {
      if (escolhidas && !escolhidas.has(c0.nome)) continue;
      const c = CANDIDATAS
        ? { ...c0, candidatas: CANDIDATAS.split(',').map((x) => x.split(':').map(Number)) }
        : c0;
      const feita = await resistente(c.nome, () => (c.vitoria ? gravarVitoria(js, c, quadros, total) : gravarCena(js, c, quadros, total)));
      cenas.set(c.nome, feita);
      total += feita.n;
      const heap = await js('performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1').catch(() => '?');
      console.log(`  (heap da pagina: ${heap} MB)`);
    }

    const relatorio = { cenas: [...cenas.entries()].map(([nome, c]) => ({ nome, ...c.info, quadros: c.n, segundos: +(c.n / FPS).toFixed(3) })) };

    if (!SO_VIDEO) {
      if (TAMANHO < 628) throw new Error('a estatica precisa de 628 px ou mais');
      relatorio.estaticas = [];
      for (const e of ESTATICAS) {
        if (escolhidas && !escolhidas.has(e.nome)) continue;
        const ee = CANDIDATAS && escolhidas ? { ...e, candidatas: CANDIDATAS.split(',').map((x) => x.split(':').map(Number)) } : e;
        relatorio.estaticas.push(await resistente(e.nome, () => gravarEstatica(js, ee, join(SAIDA, e.arquivo))));
      }
    }

    const erros = await js('window.__errosThumb.slice(0, 10)').catch((e) => [`(sem pagina: ${e.message})`]);
    relatorio.errosDaPagina = erros;
    // O Chrome sai antes do ffmpeg: os dois juntos sao o pico de memoria da
    // captura, e o x264 em 1080p nao precisa do navegador aberto.
    await fechar();
    fechar = async () => {};

    if (!SO_ESTATICA && total > 0) {
      const mp4 = join(SAIDA, 'hexadrop-animada.mp4');
      // Converte do sRGB do canvas para BT.709 de faixa limitada, e marca o
      // arquivo assim: sem isso os players chutam a matriz e a cor desbota.
      ffmpeg([
        '-framerate', String(FPS), '-i', join(quadros, '%05d.png'), '-an',
        // setparams por ultimo: sem ele o filtro deixa primarias e transferencia
        // como "unknown" no arquivo, por cima das opcoes de saida.
        '-vf', `scale=${TAMANHO}:${TAMANHO}:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p,`
          + 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', String(CRF), '-profile:v', 'high', '-threads', '4',
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
        '-r', String(FPS), '-movflags', '+faststart', mp4,
      ]);
      // Folha de contato: oito quadros do proprio mp4, espalhados por igual.
      const alvos = Array.from({ length: 8 }, (_, i) => Math.min(total - 1, Math.round(((i + 0.5) * total) / 8)));
      const sel = alvos.map((n) => `eq(n\\,${n})`).join('+');
      // O tempo de cada quadro vai escrito nele, para a revisao apontar "o de
      // 2,4 s". Sem a fonte, a folha sai sem o rotulo.
      const fonte = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
      const rotulo = existsSync(fonte)
        ? `,drawtext=fontfile=${fonte}:text='%{pts\\:hms}':x=10:y=10:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=5`
        : '';
      ffmpeg([
        '-i', mp4, '-vf',
        `select='${sel}',scale=360:360:flags=lanczos${rotulo},tile=4x2:padding=8:margin=8:color=0x101014`,
        '-frames:v', '1', '-fps_mode', 'passthrough', join(SAIDA, 'quadros.png'),
      ]);
      relatorio.video = { arquivo: mp4, quadros: total, ffprobe: ffprobe(mp4), mb: +(statSync(mp4).size / 1048576).toFixed(2), folha: alvos };
    }

    console.log('\n' + JSON.stringify(relatorio, null, 2));
    if (relatorio.video) console.log('\nffprobe:\n' + relatorio.video.ffprobe);
  } finally {
    await limpar();
  }
}

/**
 * Cena de vitoria. Primeira passada em TODAS as candidatas e politicas, sem
 * capturar: joga ate vencer e da nota ao quadro da vitoria (pecas que ainda
 * estao na tela para a cascata, hexagono perto do meio). A melhor ganha a
 * segunda passada, que repete os mesmos toques nos mesmos quadros e captura so
 * o fim - e confere que a simulacao foi a mesma.
 */
async function gravarVitoria(js, c, pasta, inicio) {
  const cfgBase = { ...cfgDaCena(c), minIntervalo: 40, maxIntervalo: 150, apressar: c.vitoria.apressar ?? null };
  const tentativas = [];
  procura: for (const [fase, variante] of c.candidatas) {
    for (const politica of c.vitoria.politicas || ['dica']) {
      const info = await js(`__thumb.abrir(${fase}, ${variante}, ${JSON.stringify(cfgBase)})`);
      if (info.variante !== variante % info.variantes) break;
      await js(`__thumb.avancar(${c.aquecer}, false)`);
      // O solucionador so entra depois do aquecimento.
      const fim = await js(`(__thumb.cfg.solucionar = ${JSON.stringify(politica)}, __thumb.avancar(${c.vitoria.maxSegundos * FPS}, true))`);
      const nota = fim.venceu ? await js('__thumb.notaDaVitoria()') : { nota: -1 };
      tentativas.push({ fase, variante, politica, fim, nota, info });
      const basta = c.vitoria.bastaNota != null && nota.nota >= c.vitoria.bastaNota;
      console.log(`  ${c.nome}: fase ${fase} v${variante} ${politica.padEnd(5)} ${fim.venceu ? `venceu no quadro ${fim.quadro} com ${fim.toques} toques` : `nao venceu (${fim.estado})`}  ${JSON.stringify(nota)}`);
      // Nota boa o bastante: nao vale gastar minutos com o resto da lista.
      if (basta) break procura;
    }
  }
  const boas = tentativas.filter((t) => t.fim.venceu).sort((a, b) => b.nota.nota - a.nota.nota);
  if (boas.length && !boas[0].nota.pousou) console.log(`  AVISO: nenhuma candidata pousou no pedestal; vai a melhor encalhada`);
  if (!boas.length) throw new Error(`nenhuma candidata venceu na cena ${c.nome}`);
  const t = boas[0];
  // A janela comeca um pouco antes do ultimo toque, para mostrar a queda final
  // ate o pedestal - o 'won' so sai com o hexagono ja parado. Mas a cascata
  // tem prioridade: se o hexagono demorou a assentar, a janela anda para a
  // frente ate caber `minCascata` segundos de celebracao.
  const n = Math.round(c.vitoria.duracao * FPS);
  const pelaCascata = t.fim.quadro - (n - Math.round(c.vitoria.minCascata * FPS));
  const peloToque = t.nota.ultimoToque - Math.round(c.vitoria.antesDoToque * FPS);
  const pular = Math.max(c.aquecer, pelaCascata, peloToque);
  const antes = t.fim.quadro - pular;
  const info = await js(`__thumb.abrir(${t.fase}, ${t.variante}, ${JSON.stringify(cfgBase)})`);
  await js(`__thumb.avancar(${c.aquecer}, false)`);
  await js(`(__thumb.cfg.solucionar = ${JSON.stringify(t.politica)}, __thumb.avancar(${pular - c.aquecer}, false))`);
  const r = await capturar(js, pasta, inicio, n, c.nome);
  // O quadro da vitoria e o de indice antes-1: cada captura avanca um.
  const confere = r.estados[antes - 1];
  info.politica = t.politica;
  info.vitoriaNoQuadro = t.fim.quadro;
  info.toquesAteVencer = t.fim.toques;
  info.nota = t.nota;
  info.mesmaSimulacao = !!confere && confere.venceu && confere.quadro === t.fim.quadro
    && JSON.stringify(confere.hex) === JSON.stringify(t.fim.hex);
  if (!info.mesmaSimulacao) {
    console.log(`  AVISO: a segunda passada divergiu (quadro ${confere && confere.quadro}, hex ${JSON.stringify(confere && confere.hex)} contra ${JSON.stringify(t.fim.hex)})`);
  }
  return { inicio, n, info, fundo: r.fundo };
}

/** Configuracao de pagina de uma cena (o que `__thumb.abrir` le). */
const cfgDaCena = (c) => ({ topo: c.topo, base: c.base, zoom: c.zoom, linhas: !!c.linhas, marca: c.marca !== false });

/**
 * Roda uma cena numa candidata. Sem `captura`, anda a seco e devolve o estado
 * de cada quadro; com `captura`, grava o PNG de cada quadro (ou so do ultimo,
 * com `captura.soUltimo`). As duas rodam exatamente o mesmo codigo na pagina,
 * entao a simulacao e a mesma - quem conferir compara os estados.
 */
async function rodarCena(js, c, fase, variante, captura) {
  const info = await js(`__thumb.abrir(${fase}, ${variante}, ${JSON.stringify(cfgDaCena(c))})`);
  if (info.variante !== variante % info.variantes) return { ok: false, motivo: 'variante inexistente', info };
  await js(`__thumb.avancar(${c.aquecer}, false)`);
  let comeco = c.aquecer;
  if (c.preparo) {
    const prep = await js(`__thumb.preparar(${JSON.stringify(c.preparo)})`);
    if (!prep.ok) return { ok: false, motivo: `sem ${c.preparo.material.join('/')} por perto: ${prep.motivo}`, trilha: prep.trilha, info };
    comeco = prep.quadro;
    info.preparo = { toques: prep.toques, quadro: comeco };
  }
  // Toques marcados no tempo: entram na politica pelo numero do quadro, contados
  // do fim do aquecimento (ou do preparo).
  const toques = (c.toques || []).map(([t, sel]) => [comeco + Math.round(t * FPS), sel]);
  await js(`(__thumb.cfg.toques = ${JSON.stringify(toques)}, true)`);
  const n = captura && captura.n ? captura.n : Math.round(c.duracao * FPS);
  let estados;
  let fundo = [];
  if (!captura) estados = await js(`__thumb.coletar(${n})`);
  else if (captura.soUltimo) {
    estados = n > 1 ? await js(`__thumb.coletar(${n - 1})`) : [];
    const r = await js('__thumb.quadroCapturado()');
    // O canvas sai RGBA (com alfa todo opaco). A estatica vai em RGB puro:
    // sangrada, sem transparencia nenhuma para a vitrine interpretar.
    const bruto = `${captura.arquivo}.rgba.png`;
    writeFileSync(bruto, Buffer.from(r.png.slice(r.png.indexOf(',') + 1), 'base64'));
    ffmpeg(['-i', bruto, '-pix_fmt', 'rgb24', captura.arquivo]);
    rmSync(bruto, { force: true });
    delete r.png;
    estados.push(r);
    fundo = [await js('__thumb.pertoDoFundo()')];
  } else {
    const r = await capturar(js, captura.pasta, captura.inicio, n, c.nome);
    estados = r.estados;
    fundo = r.fundo;
  }
  info.toques = (await js('__thumb.toques')).filter((t) => t.quadro >= comeco);
  // Cena de toque em que um toque nao pegou nao mostra a mecanica.
  const ok = info.toques.length === toques.length && info.toques.every((t) => t.ok);
  return { ok, motivo: ok ? '' : 'toque que nao pegou', info, estados, fundo, n };
}

/** Nota de uma cena de video: queda do hexagono e pecas destruidas. */
function notaDaCena(estados) {
  const a = estados[0];
  const b = estados[estados.length - 1];
  const queda = a.hex[1] - b.hex[1];
  const destruidas = a.vivas - b.vivas;
  return { queda: +queda.toFixed(2), destruidas, nota: +(queda + 0.25 * destruidas).toFixed(2) };
}

/** Mesmo hexagono no ultimo quadro: a passada seca e a captura foram a mesma simulacao. */
const mesmoFim = (a, b) => JSON.stringify(a[a.length - 1].hex) === JSON.stringify(b[b.length - 1].hex);

/**
 * Grava uma cena do video. Com `melhor`, roda todas as candidatas a seco e
 * grava a de maior nota; sem ele, grava a primeira que cumpre a cena.
 */
async function gravarCena(js, c, pasta, inicio) {
  let escolhida = null;
  for (const [fase, variante] of c.candidatas) {
    const seco = await rodarCena(js, c, fase, variante, null);
    if (!seco.ok) {
      console.log(`  ${c.nome}: fase ${fase} v${variante} nao serve (${seco.motivo})`);
      if (seco.trilha) console.log(`    trilha: ${seco.trilha.join(' > ')}`);
      continue;
    }
    const nota = notaDaCena(seco.estados);
    console.log(`  ${c.nome}: fase ${fase} v${variante} ${JSON.stringify(nota)}`);
    if (!escolhida || nota.nota > escolhida.nota.nota) escolhida = { fase, variante, nota, seco };
    if (!c.melhor || (c.basta != null && nota.nota >= c.basta)) break;
  }
  if (!escolhida) throw new Error(`nenhuma candidata serviu para a cena ${c.nome}`);
  const r = await rodarCena(js, c, escolhida.fase, escolhida.variante, { pasta, inicio });
  r.info.nota = escolhida.nota;
  r.info.mesmaSimulacao = mesmoFim(escolhida.seco.estados, r.estados);
  if (!r.info.mesmaSimulacao) console.log(`  AVISO: a captura de ${c.nome} divergiu da passada seca`);
  return { inicio, n: r.n, info: r.info, fundo: r.fundo };
}

/**
 * Nota de pose de um quadro, para as estaticas: hexagono inclinado, rapido,
 * com estilhaco no ar e inteiro dentro do quadro. A inclinacao vale mais perto
 * de 15 graus: com 30 o hexagono fica "de ponta", e de ponta ele parece parado
 * de novo - a silhueta e simetrica de 60 em 60 graus.
 * @param {*} e estado do quadro
 * @param {{inclinacao?:number, velocidade?:number, particulas?:number}} [pesos]
 */
function notaDePose(e, pesos = {}) {
  const [x, y] = e.hexTela;
  const dentro = x > 0.18 && x < 0.82 && y > 0.16 && y < 0.8;
  const giro = Math.max(0, 1 - Math.abs(e.inclinacao - 15) / 15);
  const nota = (pesos.inclinacao ?? 1) * giro
    + (pesos.velocidade ?? 0.6) * Math.min(1, e.hexV / 5)
    + (pesos.particulas ?? 0.5) * Math.min(1, e.particulas / 40)
    - (dentro ? 0 : 5);
  return +nota.toFixed(3);
}

/** Grava uma estatica: melhor quadro da melhor candidata. */
async function gravarEstatica(js, e, destino) {
  const c = { ...e, marca: false, linhas: false };
  const [t0, t1] = e.janela;
  let melhor = null;
  for (const [fase, variante] of c.candidatas) {
    const seco = await rodarCena(js, c, fase, variante, null);
    if (!seco.ok) {
      console.log(`  ${c.nome}: fase ${fase} v${variante} nao serve (${seco.motivo})`);
      continue;
    }
    let local = null;
    for (let i = Math.round(t0 * FPS); i < Math.min(seco.estados.length, Math.round(t1 * FPS)); i++) {
      const nota = notaDePose(seco.estados[i], e.pesos);
      if (!local || nota > local.nota) local = { i, nota, estado: seco.estados[i] };
    }
    if (!local) continue;
    console.log(`  ${c.nome}: fase ${fase} v${variante} melhor quadro ${local.i} nota ${local.nota} (inclinacao ${local.estado.inclinacao}, v ${local.estado.hexV}, particulas ${local.estado.particulas})`);
    if (!melhor || local.nota > melhor.nota) melhor = { fase, variante, ...local };
  }
  if (!melhor) throw new Error(`nenhuma candidata serviu para ${c.nome}`);
  const r = await rodarCena(js, c, melhor.fase, melhor.variante, { soUltimo: true, n: melhor.i + 1, arquivo: destino });
  const fim = r.estados[r.estados.length - 1];
  return {
    arquivo: destino,
    fase: melhor.fase,
    variante: melhor.variante,
    tema: r.info.tema,
    quadroDaCena: melhor.i,
    nota: melhor.nota,
    mesmaSimulacao: JSON.stringify(fim.hex) === JSON.stringify(melhor.estado.hex),
    pertoDoFundo: r.fundo[0],
  };
}

/** Captura n quadros a partir do indice global `inicio`. */
async function capturar(js, pasta, inicio, n, nome) {
  const estados = [];
  const fundo = [];
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const r = await js('__thumb.quadroCapturado()');
    const png = Buffer.from(r.png.slice(r.png.indexOf(',') + 1), 'base64');
    writeFileSync(join(pasta, `${String(inicio + i).padStart(5, '0')}.png`), png);
    delete r.png;
    estados.push(r);
    fundo.push(i % 6 === 0 || i === n - 1 ? await js('__thumb.pertoDoFundo()') : fundo[fundo.length - 1] ?? 0);
  }
  console.log(`  ${nome}: ${n} quadros em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return { estados, fundo };
}

/** Modo de escolha: tabela das fases e uma foto de cada uma. */
async function sondar(js, fases, temp) {
  const tabela = await js(`__thumb.sondar(${JSON.stringify(fases)})`);
  for (const l of tabela) {
    const vs = l.variantes.map((v) => `v${v.vi}[${v.explosivos.join(' ') || '-'}${v.cadeia ? ' CADEIA' : ''}${v.balanco ? ' balanco' : ''}${v.vento ? ' vento' : ''}]`).join(' ');
    console.log(`fase ${String(l.fase).padStart(3)}  ${l.tema.padEnd(10)} ${l.torre.padEnd(6)} ${vs}`);
  }
  const pasta = join(temp, 'sonda');
  mkdirSync(pasta, { recursive: true });
  let i = 0;
  for (const fase of fases) {
    await js(`__thumb.abrir(${fase}, 0, {})`);
    const r = await js('(__thumb.avancar(40, false), __thumb.quadroCapturado())');
    writeFileSync(join(pasta, `${String(i++).padStart(3, '0')}.png`), Buffer.from(r.png.slice(r.png.indexOf(',') + 1), 'base64'));
  }
  const destino = join(tmpdir(), 'hexadrop-sonda.png');
  const col = Math.min(8, fases.length);
  ffmpeg(['-framerate', '1', '-i', join(pasta, '%03d.png'), '-vf',
    `scale=240:240,tile=${col}x${Math.ceil(fases.length / col)}:padding=4:color=0x101014`, '-frames:v', '1', destino]);
  console.log(`\nfolha da sonda (fases na ordem, variante 0): ${destino}`);
}

main().catch((e) => {
  console.error(e.stack || String(e));
  process.exitCode = 1;
});
