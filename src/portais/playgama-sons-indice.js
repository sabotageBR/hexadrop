// GERADO por `node tools/sons-playgama.mjs`: nao editar a mao.
// Os sons do build da Playgama, em src/portais/playgama-sons/: efeitos em MP3 mono
// 56 kbps, musica e vinhetas em estereo 96 kbps, todos em -18 LUFS. inicio: atraso
// do codificador, s (o start() pula); dur: sem ele, s. Na musica, dur e a faixa
// original e atraso o comeco dela no MP3 cru. Cada `new URL` leva o MP3 ao build.

/** @type {Readonly<Record<string, {url: string, kb: number, dur: number, inicio?: number, atraso?: number, licenca: string}>>} */
export const SONS_PLAYGAMA = Object.freeze({
  clique: { url: new URL('./playgama-sons/clique.mp3', import.meta.url).href, kb: 0.9, dur: 0.123, inicio: 0.0072, licenca: 'CC0 Kenney Interface Sounds' },
  botao: { url: new URL('./playgama-sons/botao.mp3', import.meta.url).href, kb: 0.9, dur: 0.107, inicio: 0.0232, licenca: 'CC0 Kenney UI Audio' },
  voltar: { url: new URL('./playgama-sons/voltar.mp3', import.meta.url).href, kb: 0.7, dur: 0.082, inicio: 0.0221, licenca: 'CC0 Kenney Interface Sounds' },
  negado: { url: new URL('./playgama-sons/negado.mp3', import.meta.url).href, kb: 1.1, dur: 0.143, inicio: 0.0132, licenca: 'CC0 Kenney Interface Sounds' },
  madeira: { url: new URL('./playgama-sons/madeira.mp3', import.meta.url).href, kb: 2.5, dur: 0.344, inicio: 0.0221, licenca: 'CC0 Kenney Impact Sounds' },
  bloco: { url: new URL('./playgama-sons/bloco.mp3', import.meta.url).href, kb: 4.1, dur: 0.583, inicio: 0.0181, licenca: 'CC0 Kenney Impact Sounds' },
  vidro: { url: new URL('./playgama-sons/vidro.mp3', import.meta.url).href, kb: 3.9, dur: 0.553, inicio: 0.0221, licenca: 'CC0 Kenney Impact Sounds' },
  metal: { url: new URL('./playgama-sons/metal.mp3', import.meta.url).href, kb: 2.1, dur: 0.296, inicio: 0.0171, licenca: 'CC0 Kenney Impact Sounds' },
  pedra: { url: new URL('./playgama-sons/pedra.mp3', import.meta.url).href, kb: 4.8, dur: 0.683, inicio: 0.0223, licenca: 'CC0 Kenney Impact Sounds' },
  obsidiana: { url: new URL('./playgama-sons/obsidiana.mp3', import.meta.url).href, kb: 4.6, dur: 0.657, inicio: 0.0224, licenca: 'CC0 Kenney Impact Sounds' },
  gelo: { url: new URL('./playgama-sons/gelo.mp3', import.meta.url).href, kb: 1.6, dur: 0.224, inicio: 0.0107, licenca: 'CC0 Kenney Impact Sounds' },
  cristal: { url: new URL('./playgama-sons/cristal.mp3', import.meta.url).href, kb: 8.9, dur: 1.284, inicio: 0.0222, licenca: 'CC0 Kenney Impact Sounds' },
  borracha: { url: new URL('./playgama-sons/borracha.mp3', import.meta.url).href, kb: 3.8, dur: 0.526, inicio: 0.0223, licenca: 'CC0 Kenney Impact Sounds' },
  espuma: { url: new URL('./playgama-sons/espuma.mp3', import.meta.url).href, kb: 1.3, dur: 0.16, inicio: 0.0225, licenca: 'CC0 Kenney Impact Sounds' },
  cera: { url: new URL('./playgama-sons/cera.mp3', import.meta.url).href, kb: 1.4, dur: 0.187, inicio: 0.0225, licenca: 'CC0 Kenney Impact Sounds' },
  explosao: { url: new URL('./playgama-sons/explosao.mp3', import.meta.url).href, kb: 4.6, dur: 0.657, inicio: 0.0226, licenca: 'CC0 Kenney Impact Sounds' },
  batidaMadeira: { url: new URL('./playgama-sons/batidaMadeira.mp3', import.meta.url).href, kb: 2.1, dur: 0.291, inicio: 0.0221, licenca: 'CC0 Kenney Impact Sounds' },
  batidaMetal: { url: new URL('./playgama-sons/batidaMetal.mp3', import.meta.url).href, kb: 2, dur: 0.278, inicio: 0.0092, licenca: 'CC0 Kenney Impact Sounds' },
  batidaPedra: { url: new URL('./playgama-sons/batidaPedra.mp3', import.meta.url).href, kb: 1.1, dur: 0.141, inicio: 0.0159, licenca: 'CC0 Kenney Impact Sounds' },
  batidaGelo: { url: new URL('./playgama-sons/batidaGelo.mp3', import.meta.url).href, kb: 1.6, dur: 0.227, inicio: 0.0086, licenca: 'CC0 Kenney Impact Sounds' },
  pouso: { url: new URL('./playgama-sons/pouso.mp3', import.meta.url).href, kb: 1.1, dur: 0.134, inicio: 0.0225, licenca: 'CC0 Kenney Impact Sounds' },
  estrela: { url: new URL('./playgama-sons/estrela.mp3', import.meta.url).href, kb: 1.1, dur: 0.137, inicio: 0.0199, licenca: 'CC0 Kenney Interface Sounds' },
  moeda: { url: new URL('./playgama-sons/moeda.mp3', import.meta.url).href, kb: 1.1, dur: 0.134, inicio: 0.0223, licenca: 'CC0 Kenney Casino Audio' },
  passou: { url: new URL('./playgama-sons/passou.mp3', import.meta.url).href, kb: 3.8, dur: 0.526, inicio: 0.0222, licenca: 'CC0 Kenney Interface Sounds' },
  fimDeMundo: { url: new URL('./playgama-sons/fimDeMundo.mp3', import.meta.url).href, kb: 3.6, dur: 0.496, inicio: 0.0262, licenca: 'CC0 Kenney Interface Sounds' },
  premio: { url: new URL('./playgama-sons/premio.mp3', import.meta.url).href, kb: 2.9, dur: 0.396, inicio: 0.0224, licenca: 'CC0 Kenney Interface Sounds' },
  perdeu: { url: new URL('./playgama-sons/perdeu.mp3', import.meta.url).href, kb: 1.3, dur: 0.161, inicio: 0.0222, licenca: 'CC0 Kenney Interface Sounds' },
  bonus: { url: new URL('./playgama-sons/bonus.mp3', import.meta.url).href, kb: 0.9, dur: 0.124, inicio: 0.0063, licenca: 'CC0 Kenney Interface Sounds' },
  combo: { url: new URL('./playgama-sons/combo.mp3', import.meta.url).href, kb: 4.6, dur: 0.657, inicio: 0.0221, licenca: 'CC0 Kenney Interface Sounds' },
  sopro: { url: new URL('./playgama-sons/sopro.mp3', import.meta.url).href, kb: 2, dur: 0.26, inicio: 0.0271, licenca: 'CC0 Kenney Interface Sounds' },
  vitoria: { url: new URL('./playgama-sons/vitoria.mp3', import.meta.url).href, kb: 58.2, dur: 4.948, inicio: 0.0155, licenca: 'CC0 MintoDog (opengameart.org) Sci-fi Puzzle Jingle & Result' },
  derrota: { url: new URL('./playgama-sons/derrota.mp3', import.meta.url).href, kb: 74.4, dur: 6.328, inicio: 0.0202, licenca: 'CC0 MintoDog (opengameart.org) Sci-fi Puzzle Jingle & Result' },
  musica: { url: new URL('./playgama-sons/musica.mp3', import.meta.url).href, kb: 1658.6, dur: 141.47367, atraso: 0.02506, licenca: 'CC0 MintoDog (opengameart.org) Sci-fi Puzzle In-Game 2' },
});
