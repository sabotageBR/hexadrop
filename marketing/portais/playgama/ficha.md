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
- **Supported devices:** Desktop, iOS, Android. **Screen orientation:** as duas. No desktop o jogo roda deitado, com o HUD nas laterais; no celular, em pé ou deitado, e a cena se ajusta.
- **Game languages:** English, Português, Español, Français, Italiano, Deutsch, Türkçe.
- **Category:** `puzzle`.
- **Anúncios:** intersticial na passagem de fase (a partir da fase 6) e vídeo premiado opcional (voltar uma jogada, pular fase, bônus diário, hexágono da loja, dobrar o prêmio da fase 100).
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
P, Space or Esc: pause
Arrow keys or WASD: move through menus
Enter or Space: confirm
```

## Pontos de atenção na revisão

- **"+1 vida" a cada derrota é proibido (regra 6.3):** o "voltar uma jogada" por vídeo do cartão de derrota sai deste build (CSS). Os outros vídeos são bônus opcionais, com o selo 🎬 no botão.
- **Botão de mute obrigatório:** o jogo tem.
- A moderação leva de 1 a 5 dias úteis. O sandbox (link público sem moderação) exige Bridge ≥ 2.2.0, e o
  CDN `v2/stable` já está na 2.3.1.

## Como regerar

```bash
node tools/portais.mjs --portal=playgama             # zip e material deste portal
node tools/portais.mjs --portal=playgama --so=builds # só o zip
node tools/portaischeck.mjs playgama           # o SDK falso do portal: carregamento, anúncios, prêmio, pausa, idioma, save
```

O código que fala com o SDK é `src/portais/playgama.js (sobre src/portais/base.js)`. A pesquisa das regras é de 2026-10-20; as páginas citadas
podem mudar, confira antes de enviar.
