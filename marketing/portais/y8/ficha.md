# Hexa Drop na Y8: ficha de envio

Tudo o que o Developer Portal da Y8 (developer.y8.com) pede, com os textos prontos para colar.
Os textos vão em inglês; a Y8 traduz a página pelo subdomínio, e o jogo segue o idioma do site
(`getPlatformLocale`).

## Antes de gerar o zip: os ids

1. Crie o jogo no Developer Portal (só pede o *Game Name*).
2. Abra a aba **SDK Initialization**, copie o **App ID** e o **Game ID** e cole em
   `marketing/portais/ids.json`, em `"y8"`.
3. Rode `node tools/portais.mjs --portal=y8 --so=builds`. Sai `dist-portais/hexa-drop-y8-1.0.19.zip` (enquanto faltar o id: `dist-portais/hexa-drop-y8-1.0.19-sem-id.zip`, só para teste).

Sem os ids o SDK nem é iniciado, e o jogo roda sem anúncios.

## Arquivos (aba Media e Builds)

| campo do painel | arquivo | regra |
|---|---|---|
| Builds | `dist-portais/hexa-drop-y8-1.0.19.zip` | index.html na raiz |
| Standard Screenshot (vira o thumbnail das listas, com teste A/B) | `y8/hexa-drop-tela-760x570-1.jpg, -2, -3` | 760x570 exato, ≤ 2 MB, só gameplay |
| Widescreen Screenshot | `y8/hexa-drop-tela-1280x720-1.jpg, -2` | 1280x720 exato, ≤ 5 MB, só gameplay |
| Landscape Promo | `y8/hexa-drop-promo-1920x1080.jpg` | 1920x1080 exato, ≤ 5 MB |
| Portrait Promo | `y8/hexa-drop-promo-1080x1920.jpg` | 1080x1920 exato, ≤ 5 MB |
| Game Card Promo | `y8/hexa-drop-card-760x570.jpg` | 760x570 exato, ≤ 2 MB |
| Gameplay video | `y8/hexa-drop-video-1920x1080.mp4` | 16:9, ≥ 1280x720, ≥ 15 s, ≤ 50 MB, gameplay desde o 1º segundo |

Os arquivos ficam em `marketing/portais/`. As telas mostram só o jogo, com o HUD e sem menu. As promos
têm o nome do jogo como parte da arte, longe das bordas. O vídeo é um trecho só de uma fase, sem corte, gravado pelo jogo de verdade até o hexágono pousar e a celebração (`tools/thumbnail.mjs --perfil y8`), em H.264 `yuv420p` com trilha de áudio muda (o painel mostrava preto com o vídeo anterior). A `folha.jpg` é só para conferir e não vai para o envio.

## Opções do envio

- **SDK:** Y8 SDK 2-0, carregado do CDN deles (`cdn.y8.com/minimal-sdk/2-0/y8.min.js`, async), com
  `appId` e `gameId`. Anúncios por `showAd` (intersticial `next` e recompensado `reward`).
- **Login, leaderboards, conquistas, cloud save:** não usados (são opcionais). O progresso fica no navegador.
- **Aparelhos:** desktop e celular. **Orientação:** as duas. No desktop o jogo roda deitado, com o HUD nas laterais; no celular, em pé ou deitado, e a cena se ajusta.
- **Idiomas do jogo:** English, Português, Español, Français, Italiano, Deutsch, Türkçe.
- **Anúncios:** intersticial na passagem de fase (a partir da fase 6) e vídeo premiado opcional (voltar uma jogada, pular fase, bônus diário, hexágono da loja, dobrar o prêmio da fase 100). Na Y8 o intersticial só sai depois de um clique (as diretrizes
  proíbem o automático): "próxima" no cartão de vitória, "tentar de novo" e continuar da pausa; as passagens automáticas do jogo corrido não pedem anúncio.
  O pre-roll é da própria Y8.

## Nome

```
Hexa Drop
```

## Descrição

```
Hexa Drop is a physics puzzle about taking a tower apart without losing what sits on top. Tap a block to break it, watch the tower settle and guide the hexagon all the way down to the platform. If it falls off the edge, try again!

Every five levels opens a new world with its own sky and its own blocks. Rubber bounces, ice slides, metal is heavy, glass shatters, and bombs and TNT blow up everything around them. Later worlds add wind, swinging platforms and new goals: protect the gem, work around locked blocks and land on the golden strip.

Features:
- 100 levels in 20 worlds, each one checked to be solvable, and more after level 100
- 13 kinds of blocks, from bouncy rubber to explosive TNT
- Three stars and a perfect play on every level, plus combos for big collapses
- 14 hexagons to collect, golden editions and upgrades
```

## Como jogar / instruções

```
Tap or click a block to break it and bring the hexagon down to the platform at the bottom of the tower. Don't let it fall off the edge! Every block you break changes how the tower falls, so pick the right one. Each win earns up to three stars, and finishing within the target number of taps is a perfect play. If you get stuck, a hint lights up.
```

## Controles

```
Mouse or touch: click or tap a block to break it
P, Space or Esc: pause
Arrow keys or WASD: move through menus
Enter or Space: confirm
```

## Categoria e tags

Puzzle · Physics, Puzzle, Casual, Blocks, Tower, Logic, Brain

## Pontos de atenção na revisão

- **Intersticial só depois de clique:** o build já segue isso. Na revisão, peça dois anúncios seguidos
  para ver o limite de frequência e confirme que o jogo continua.
- **Vídeo:** a Y8 pede "a continuous gameplay clip with no cuts" e recusa trailer. O vídeo é um trecho só, sem corte e sem texto, e começa já no jogo. Depois do upload, o painel gera as prévias de até 20 s sozinho, e isso pode levar alguns minutos.
- A espera entre reenvios para revisão cresce: 0, 6 h, 12 h, 24 h, 2 dias, 5 dias.

## Como regerar

```bash
node tools/portais.mjs --portal=y8             # zip e material deste portal
node tools/portais.mjs --portal=y8 --so=builds # só o zip
node tools/portaischeck.mjs y8           # o SDK falso do portal: carregamento, anúncios, prêmio, pausa, idioma, save
```

O código que fala com o SDK é `src/portais/y8.js (sobre src/portais/base.js)`. A pesquisa das regras é de 2026-10-20; as páginas citadas
podem mudar, confira antes de enviar.
