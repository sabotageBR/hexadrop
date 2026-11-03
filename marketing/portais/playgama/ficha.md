# Hexa Drop na Playgama: ficha de envio

Tudo o que o painel da Playgama (developer.playgama.com) pede, com os textos prontos para colar.
O título e os textos vão em inglês, que é obrigatório e é o idioma padrão do jogo.

## Arquivos

| campo do painel | arquivo | regra |
|---|---|---|
| Build (Plain JS) | `dist-portais/hexa-drop-playgama-1.0.19.zip` | index.html e playgama-bridge-config.json na raiz, ≤ 300 MB |
| Cover Square 1:1 | `playgama/hexa-drop-capa-800x800.png` | 800x800, ≤ 10 MB, obrigatória |
| Cover Portrait 9:16 | `playgama/hexa-drop-capa-1080x1920.png` | 1080x1920, ≤ 10 MB, obrigatória |
| Cover Landscape 16:9 | `playgama/hexa-drop-capa-1920x1080.png` | 1920x1080, ≤ 10 MB, obrigatória |
| Other assets (opcional) | `playgama/hexa-drop-tela-*.jpg, hexa-drop-video-1920x1080.mp4` | telas e vídeo de gameplay |

Sem as três capas o painel deixa testar o build, mas não manda para a moderação. As capas também viram
os banners das campanhas de tráfego do sandbox. Os arquivos ficam em `marketing/portais/`.

## Opções do envio

- **Game engine:** Plain JS (`js`). **SDK:** Playgama Bridge v2, do CDN deles (o único recurso de fora
  que o checklist aceita), com a config `playgama-bridge-config.json` (intervalo mínimo de 60 s entre
  intersticiais).
- **Obrigatórios do Bridge, todos no build:**
  - `platform.language` antes do jogo;
  - `sendMessage('game_ready')` quando o jogo fica interativo;
  - `isAudioEnabled` e os eventos de som e de pausa;
  - **o save pelo `bridge.storage`**;
  - o prêmio só no estado `rewarded`.
- **Requisitos reescritos em 2026-10-30** (wiki.playgama.com/playgama/game-requirements), só neste build
  (branch `playgama`, plugin `soNaPlaygama` do `vite.config.js`):
  - nada do armazenamento do navegador (3.2.1): o build usa `src/portais/playgama-storage.js` no lugar do
    `src/core/storage.js`, só memória e o espelho do Bridge;
  - sem o Esc (1.5.2): P e Espaço pausam, e os menus voltam pelo botão;
  - intersticial sem a carência do jogo (passo 7 do Bridge): quem espaça é o Bridge;
  - o idioma só do Bridge, com o inglês de reserva (3.4.2), aplicado depois do save, para a escolha das
    opções voltar;
  - "(ad)" no texto dos botões de vídeo, em cada idioma (2.2.1).
- **Som em arquivo (3.3.1 e 3.3.2), escolhido pelo usuário em 2026-11-03:**
  - música de fundo: Sci-fi Puzzle In-Game 2, do MintoDog (CC0, opengameart.org), uma faixa para todos os
    mundos, em laço sem emenda. Neste build ela começa ligada: a 3.3.1 pede música de fundo, e a versão
    sintetizada nasce desligada desde a 1.0.16;
  - cartões de vitória e de derrota: as vinhetas Clear e Failure da mesma série;
  - efeitos: os CC0 da Kenney, um por material de peça. Estrela, moeda, bônus e combo sobem de nota como
    na síntese, e a batida varia de volume pela força.

  O `tools/sons-playgama.mjs` converte as fontes de `.tmp/sons/`, e o `src/portais/playgama-audio.js`
  entra no lugar do `src/core/audio.js`. A build não leva nenhum som sintetizado, e os 33 MP3 vão como
  arquivo, nunca embutidos no JS.
- **Supported devices:** Desktop, iOS, Android. **Screen orientation:** as duas. No desktop o jogo roda deitado, com o HUD nas laterais; no celular, em pé ou deitado, e a cena se ajusta.
- **Game languages:** English, Português, Español, Français, Italiano, Deutsch, Türkçe.
- **Category:** `puzzle`.
- **Anúncios:** intersticial na passagem de fase, desde a fase 1 (o Bridge espaça), e vídeo premiado opcional (voltar uma jogada, pular fase, bônus diário, hexágono da loja, dobrar o prêmio da fase 100).
- **Distribution:** aceite a distribuição nos parceiros. Para a Playhop/Yandex eles pedem russo, e o
  jogo não tem; deixe a Yandex de fora aqui, porque ela tem build própria (`marketing/portais/yandex/`).

## Title

```
Hexa Drop
```

## Description (832 caracteres, mínimo 100)

```
Hexa Drop is a physics puzzle about taking a tower apart without losing what sits on top. Tap a block to break it, watch the tower settle and guide the hexagon all the way down to the platform. If it falls off the edge, try again!

Every five levels opens a new world with its own sky and its own blocks. Rubber bounces, ice slides, metal is heavy, glass shatters, and bombs and TNT blow up everything around them. Later worlds add wind, swinging platforms and new goals: protect the gem, work around locked blocks and land on the golden strip.

Features:
- 100 levels in 20 worlds, each one checked to be solvable, and more after level 100
- 13 kinds of blocks, from bouncy rubber to explosive TNT
- Three stars and a perfect play on every level, plus combos for big collapses
- 14 hexagons to collect, golden editions and upgrades
```

## How to play (481 caracteres, mínimo 100)

```
Tap or click a block to break it and bring the hexagon down to the platform at the bottom of the tower. Don't let it fall off the edge! Every block you break changes how the tower falls, so pick the right one. Each win earns up to three stars, and finishing within the target number of taps is a perfect play. If you get stuck, a hint lights up.

Mouse or touch: click or tap a block to break it
P or Space: pause
Arrow keys or WASD: move through menus
Enter or Space: confirm
```

## Pontos de atenção na revisão

- **Vídeo que salva uma derrota no máximo uma vez por tentativa (2.2.4, a antiga 6.3):** o "voltar uma jogada" por vídeo do cartão de derrota sai deste build (CSS). Os outros vídeos são bônus opcionais, com o ícone de câmera e "(ad)" no botão.
- **Botão de mute obrigatório:** o jogo tem.
- A moderação leva de 1 a 5 dias úteis. O sandbox (link público sem moderação) exige Bridge ≥ 2.2.0, e o
  CDN `v2/stable` já está na 2.4.0 (2026-10-30), a versão atual que o 1.1.1 pede.

## Como regerar

```bash
node tools/portais.mjs --portal=playgama             # zip e material deste portal
node tools/portais.mjs --portal=playgama --so=builds # só o zip
node tools/portaischeck.mjs playgama           # o SDK falso do portal: carregamento, anúncios, prêmio, pausa, idioma, save
```

O código que fala com o SDK é `src/portais/playgama.js (sobre src/portais/base.js)`. A pesquisa das regras é de 2026-10-20; as páginas citadas
podem mudar, confira antes de enviar.
