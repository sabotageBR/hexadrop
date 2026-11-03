/**
 * Os sons do build da Playgama em arquivo (requisitos 3.3.1 e 3.3.2 de
 * 2026-10-30, wiki.playgama.com/playgama/game-requirements: musica de fundo, e
 * som gravado ou produzido em ferramenta de audio, em ogg ou mp3; o sintetizado
 * em codigo nao vale). O resto do jogo continua todo sintetizado
 * (src/core/audio.js).
 *
 *   node tools/sons-playgama.mjs
 *
 * Converte a tabela FONTES em src/portais/playgama-sons/ e gera
 * src/portais/playgama-sons-indice.js, com um `new URL(...)` por arquivo para o
 * Vite levar cada MP3 ao build. So o build da Playgama importa o indice (o
 * plugin `soNaPlaygama` troca src/core/audio.js por src/portais/playgama-audio.js).
 *
 * Fontes, todas CC0 1.0, em .tmp/sons/ (fora do git):
 * - pacotes/: os pacotes da Kenney (Impact Sounds, Interface Sounds, Casino
 *   Audio), os mesmos do slime_merge (o tools/sons.mjs de la baixa);
 * - mintodog/: a musica e as vinhetas do MintoDog (opengameart.org, colecao
 *   "For Puzzle Game"), baixadas em 2026-11-03: sci-fi_puzzle_in-game_2_bpm95_0.ogg
 *   e os .ogg de dentro de ogg_sci-fi_puzzle_jingle_result.zip.
 *
 * Efeitos em MP3 mono 56 kbps, loudnorm -18 LUFS (os curtos com pico em
 * -3 dBFS) e sem o cabecalho Xing (o `inicio` mede o atraso do codificador),
 * como no slime_merge. Musica e vinhetas em estereo 96 kbps, -18 LUFS; a musica
 * com o Xing (quem le corta o atraso sozinho) e o indice guarda os dois casos
 * para o laco: `dur` (a faixa original) e `atraso` (o comeco dela no MP3 cru).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEM = join(RAIZ, '.tmp', 'sons');
const SAIDA = join(RAIZ, 'src', 'portais', 'playgama-sons');
const INDICE = join(RAIZ, 'src', 'portais', 'playgama-sons-indice.js');
const TAXA = 44100;

const KENNEY = 'CC0 Kenney';
const MINTO = 'CC0 MintoDog (opengameart.org)';
const INTERFACE = `${KENNEY} Interface Sounds`;
const IMPACTO = `${KENNEY} Impact Sounds`;
/**
 * id -> fonte(s). tipo: efeito (mono 56k) | vinheta (estereo 96k) | musica
 * (estereo 96k, em laco). Mais de uma fonte: misturadas (a explosao).
 * @type {Record<string, {fontes: string[], tipo: 'efeito'|'vinheta'|'musica', licenca: string}>}
 */
export const FONTES = {
  // os click_002 a 005 do Interface Sounds tem 10 ms: no MP3 nao sobra quadro nenhum
  clique: { fontes: ['pacotes/interface/Audio/click_001.ogg'], tipo: 'efeito', licenca: INTERFACE },
  botao: { fontes: ['pacotes/ui/Audio/click1.ogg'], tipo: 'efeito', licenca: `${KENNEY} UI Audio` },
  voltar: { fontes: ['pacotes/interface/Audio/back_002.ogg'], tipo: 'efeito', licenca: INTERFACE },
  negado: { fontes: ['pacotes/interface/Audio/error_004.ogg'], tipo: 'efeito', licenca: INTERFACE },
  madeira: { fontes: ['pacotes/impacto/Audio/impactWood_medium_000.ogg'], tipo: 'efeito', licenca: IMPACTO },
  bloco: { fontes: ['pacotes/impacto/Audio/impactPlate_medium_000.ogg'], tipo: 'efeito', licenca: IMPACTO },
  vidro: { fontes: ['pacotes/impacto/Audio/impactGlass_medium_000.ogg'], tipo: 'efeito', licenca: IMPACTO },
  metal: { fontes: ['pacotes/impacto/Audio/impactMetal_medium_000.ogg'], tipo: 'efeito', licenca: IMPACTO },
  pedra: { fontes: ['pacotes/impacto/Audio/impactMining_000.ogg'], tipo: 'efeito', licenca: IMPACTO },
  obsidiana: { fontes: ['pacotes/impacto/Audio/impactMining_003.ogg'], tipo: 'efeito', licenca: IMPACTO },
  gelo: { fontes: ['pacotes/impacto/Audio/impactGlass_light_002.ogg'], tipo: 'efeito', licenca: IMPACTO },
  cristal: { fontes: ['pacotes/impacto/Audio/impactBell_heavy_000.ogg'], tipo: 'efeito', licenca: IMPACTO },
  borracha: { fontes: ['pacotes/impacto/Audio/impactSoft_heavy_000.ogg'], tipo: 'efeito', licenca: IMPACTO },
  espuma: { fontes: ['pacotes/impacto/Audio/impactSoft_medium_003.ogg'], tipo: 'efeito', licenca: IMPACTO },
  cera: { fontes: ['pacotes/impacto/Audio/impactSoft_medium_001.ogg'], tipo: 'efeito', licenca: IMPACTO },
  explosao: { fontes: ['pacotes/impacto/Audio/impactPunch_heavy_000.ogg', 'pacotes/impacto/Audio/impactMining_004.ogg'], tipo: 'efeito', licenca: IMPACTO },
  batidaMadeira: { fontes: ['pacotes/impacto/Audio/impactWood_light_001.ogg'], tipo: 'efeito', licenca: IMPACTO },
  batidaMetal: { fontes: ['pacotes/impacto/Audio/impactMetal_light_001.ogg'], tipo: 'efeito', licenca: IMPACTO },
  batidaPedra: { fontes: ['pacotes/impacto/Audio/impactGeneric_light_001.ogg'], tipo: 'efeito', licenca: IMPACTO },
  batidaGelo: { fontes: ['pacotes/impacto/Audio/impactGlass_light_001.ogg'], tipo: 'efeito', licenca: IMPACTO },
  pouso: { fontes: ['pacotes/impacto/Audio/impactSoft_medium_000.ogg'], tipo: 'efeito', licenca: IMPACTO },
  estrela: { fontes: ['pacotes/interface/Audio/glass_002.ogg'], tipo: 'efeito', licenca: INTERFACE },
  moeda: { fontes: ['pacotes/casino/Audio/chip-lay-1.ogg'], tipo: 'efeito', licenca: `${KENNEY} Casino Audio` },
  passou: { fontes: ['pacotes/interface/Audio/confirmation_002.ogg'], tipo: 'efeito', licenca: INTERFACE },
  fimDeMundo: { fontes: ['pacotes/interface/Audio/confirmation_004.ogg'], tipo: 'efeito', licenca: INTERFACE },
  premio: { fontes: ['pacotes/interface/Audio/maximize_006.ogg'], tipo: 'efeito', licenca: INTERFACE },
  perdeu: { fontes: ['pacotes/interface/Audio/error_008.ogg'], tipo: 'efeito', licenca: INTERFACE },
  bonus: { fontes: ['pacotes/interface/Audio/pluck_001.ogg'], tipo: 'efeito', licenca: INTERFACE },
  combo: { fontes: ['pacotes/interface/Audio/glass_004.ogg'], tipo: 'efeito', licenca: INTERFACE },
  sopro: { fontes: ['pacotes/interface/Audio/maximize_002.ogg'], tipo: 'efeito', licenca: INTERFACE },
  vitoria: { fontes: ['mintodog/Sci-fi Puzzle Clear (Jingle).ogg'], tipo: 'vinheta', licenca: `${MINTO} Sci-fi Puzzle Jingle & Result` },
  derrota: { fontes: ['mintodog/Sci-fi Puzzle Failure (Jingle).ogg'], tipo: 'vinheta', licenca: `${MINTO} Sci-fi Puzzle Jingle & Result` },
  musica: { fontes: ['mintodog/sci-fi_puzzle_in-game_2_bpm95_0.ogg'], tipo: 'musica', licenca: `${MINTO} Sci-fi Puzzle In-Game 2` },
};

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {'texto'|'binario'} [modo]
 */
function rodar(cmd, args, modo = 'texto') {
  const r = spawnSync(cmd, args, { encoding: modo === 'binario' ? 'buffer' : 'utf8', maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`${cmd} falhou: ${String(r.stderr).slice(-400)}`);
  return r;
}

/**
 * Caminho da fonte, sem sair da pasta dela em .tmp/sons (que pode ser um link).
 * @param {string} rel
 */
function fonteDe(rel) {
  const base = realpathSync(join(ORIGEM, rel.split('/')[0]));
  const p = realpathSync(join(ORIGEM, rel));
  if (!p.startsWith(base + sep)) throw new Error(`fora de .tmp/sons: ${rel}`);
  return p;
}

/**
 * Amostras mono float da decodificacao do ffmpeg.
 * @param {string} p
 * @param {string[]} [extra]
 */
function amostras(p, extra = []) {
  const b = /** @type {Buffer} */ (rodar('ffmpeg', ['-v', 'error', ...extra, '-i', p, '-f', 'f32le', '-ac', '1', '-ar', String(TAXA), '-'], 'binario').stdout);
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
}

/**
 * Atraso inicial do MP3 sem Xing: a primeira amostra acima de 2% do pico, menos 3 ms.
 * @param {Float32Array} a
 */
function atrasoInicial(a) {
  let pico = 0;
  for (let i = 0; i < a.length; i++) pico = Math.max(pico, Math.abs(a[i]));
  let i = 0;
  while (i < a.length && Math.abs(a[i]) < pico * 0.02) i++;
  return Math.max(0, i / TAXA - 0.003);
}

/**
 * Deslocamento de b contra a, em amostras, pela maior correlacao no primeiro segundo.
 * @param {Float32Array} a
 * @param {Float32Array} b
 */
function deslocamento(a, b, max = 4096) {
  const n = Math.min(TAXA, a.length, b.length - max);
  let melhor = 0;
  let valor = -Infinity;
  for (let d = 0; d <= max; d++) {
    let s = 0;
    for (let i = 0; i < n; i += 2) s += a[i] * b[i + d];
    if (s > valor) {
      valor = s;
      melhor = d;
    }
  }
  return melhor;
}

/**
 * loudnorm de 2 passadas para os de 0,5 s ou mais; nos curtos, pico em -3 dBFS.
 * @param {string[]} entradas argumentos -i do ffmpeg
 * @param {string} grafo o filtro ate o rotulo [s]
 */
function normalizacao(entradas, grafo) {
  const ff = (/** @type {string} */ extra) =>
    spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...entradas, '-filter_complex', `${grafo}${extra ? `;[s]${extra}[t]` : ''}`, '-map', extra ? '[t]' : '[s]', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '';
  const dur = Number((/time=(\d+):(\d+):([\d.]+)/.exec(ff('')) || []).slice(1).reduce((a, x, i) => a + Number(x) * [3600, 60, 1][i], 0)) || 0;
  if (dur >= 0.5) {
    const txt = ff('loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json');
    const j = JSON.parse(txt.slice(txt.lastIndexOf('{'), txt.lastIndexOf('}') + 1));
    if (Number.isFinite(Number(j.input_i))) {
      return `loudnorm=I=-18:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,aresample=${TAXA}`;
    }
  }
  const m = /max_volume: (-?[\d.]+) dB/.exec(ff('volumedetect'));
  return `volume=${(-3 - (m ? Number(m[1]) : 0)).toFixed(2)}dB`;
}

function converter() {
  rmSync(SAIDA, { recursive: true, force: true });
  mkdirSync(SAIDA, { recursive: true });
  /** @type {Record<string, any>} */
  const indice = {};
  for (const [id, f] of Object.entries(FONTES)) {
    const ents = f.fontes.map(fonteDe);
    const saida = join(SAIDA, `${id}.mp3`);
    const efeito = f.tipo === 'efeito';
    const entradas = ents.flatMap((e) => ['-i', e]);
    // efeitos: mono, sem silencio nas pontas e com fade curto; musica e vinhetas: inteiras
    const cada = efeito ? 'aformat=sample_fmts=fltp:channel_layouts=mono' : 'aformat=sample_fmts=fltp:channel_layouts=stereo';
    const mistura = ents.map((_, i) => `[${i}:a]aresample=${TAXA},${cada}[e${i}]`).join(';') + ';' +
      (ents.length > 1 ? `${ents.map((_, i) => `[e${i}]`).join('')}amix=inputs=${ents.length}:normalize=0` : '[e0]anull');
    const pontas = efeito
      ? ',silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.004,areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse,afade=t=in:d=0.004,areverse,afade=t=in:d=0.03,areverse'
      : '';
    const grafo = `${mistura}${pontas}[s]`;
    const norma = normalizacao(entradas, grafo);
    rodar('ffmpeg', ['-v', 'error', '-y', ...entradas, '-filter_complex', `${grafo};[s]${norma}[t]`, '-map', '[t]', '-ac', efeito ? '1' : '2', '-ar', String(TAXA),
      '-codec:a', 'libmp3lame', '-b:a', efeito ? '56k' : '96k', '-map_metadata', '-1', '-id3v2_version', '0',
      '-write_xing', f.tipo === 'musica' ? '1' : '0', saida]);
    const kb = Math.round((statSync(saida).size / 1024) * 10) / 10;
    if (f.tipo === 'musica') {
      const original = amostras(ents[0]);
      const cru = amostras(saida, ['-flags2', '+skip_manual']);
      indice[id] = { arquivo: `${id}.mp3`, kb, dur: Math.round((original.length / TAXA) * 100000) / 100000, atraso: Math.round((deslocamento(original, cru) / TAXA) * 100000) / 100000, licenca: f.licenca };
    } else {
      const a = amostras(saida);
      const inicio = atrasoInicial(a);
      indice[id] = { arquivo: `${id}.mp3`, kb, dur: Math.round((a.length / TAXA - inicio) * 1000) / 1000, inicio: Math.round(inicio * 10000) / 10000, licenca: f.licenca };
    }
    process.stdout.write(`${id.padEnd(14)} ${String(kb).padStart(7)} KB  <- ${f.fontes.join(' + ')}\n`);
  }
  const valor = (/** @type {any} */ v) => (typeof v === 'string' ? `'${v}'` : String(v));
  const linhas = Object.entries(indice).map(([id, x]) => {
    const campos = Object.entries(x).filter(([k]) => k !== 'arquivo').map(([k, v]) => `${k}: ${valor(v)}`);
    return `  ${id}: { url: new URL('./playgama-sons/${x.arquivo}', import.meta.url).href, ${campos.join(', ')} },`;
  });
  writeFileSync(INDICE, [
    '// GERADO por `node tools/sons-playgama.mjs`: nao editar a mao.',
    '// Os sons do build da Playgama, em src/portais/playgama-sons/: efeitos em MP3 mono',
    '// 56 kbps, musica e vinhetas em estereo 96 kbps, todos em -18 LUFS. inicio: atraso',
    '// do codificador, s (o start() pula); dur: sem ele, s. Na musica, dur e a faixa',
    '// original e atraso o comeco dela no MP3 cru. Cada `new URL` leva o MP3 ao build.',
    '',
    '/** @type {Readonly<Record<string, {url: string, kb: number, dur: number, inicio?: number, atraso?: number, licenca: string}>>} */',
    'export const SONS_PLAYGAMA = Object.freeze({',
    ...linhas,
    '});',
    '',
  ].join('\n'));
  const fontes = [...new Set(Object.values(FONTES).map((f) => f.licenca))];
  writeFileSync(join(SAIDA, 'LICENCAS.txt'), [
    'Sons do build da Playgama (CC0 1.0, creativecommons.org/publicdomain/zero/1.0/):',
    ...fontes.map((l) => `- ${l.replace(/^CC0 /, '')}`),
    'Convertidos por tools/sons-playgama.mjs (loudnorm, MP3).',
    '',
  ].join('\n'));
  const total = readdirSync(SAIDA).reduce((s, n) => s + statSync(join(SAIDA, n)).size, 0);
  process.stdout.write(`${relative(RAIZ, SAIDA)}: ${Object.keys(indice).length} sons, ${(total / 1024).toFixed(0)} KB\n`);
}

if (!existsSync(ORIGEM)) throw new Error('falta .tmp/sons (os pacotes da Kenney e as faixas do MintoDog)');
converter();
