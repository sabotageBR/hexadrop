# Hexa Drop na GamePix: ficha de envio

Tudo o que o painel da GamePix (my.gamepix.com) pede, com os textos prontos para colar.

> **A GamePix pede "Do not use AI-generated text"** na descrição. Os textos abaixo partem dos da CrazyGames;
> revise e ajuste com as suas palavras antes de colar.

## Arquivos

| campo do painel | arquivo | regra |
|---|---|---|
| Build | `dist-portais/hexa-drop-gamepix-1.0.19.zip` | index.html na raiz (compacte os arquivos, não a pasta) |
| Icon | `gamepix/hexa-drop-icone-256x256.png` | 256x256, ≤ 1 MB |
| Cover | `gamepix/hexa-drop-capa-1360x850.png` | 1360x850, ≤ 1,5 MB |
| Video (opcional) | `link do YouTube ou Vimeo` | o painel não aceita upload |

O título nas imagens é o do jogo. Os arquivos ficam em `marketing/portais/`.

## Opções do envio (aba Info)

- **Game engine:** HTML5-JS. **SDK integration:** sim. O GamePix SDK v3 é o primeiro script do `<head>`,
  sem async.
- **O que o build faz pelas diretrizes:**
  - `loaded()` antes de tudo e `lang()` para o idioma;
  - `pause`/`resume` calam e pausam;
  - o save no `GamePix.localStorage`;
  - `updateLevel` e `happyMoment` nos marcos;
  - intersticial só entre fases, nunca por tempo;
  - nenhum link externo nem botão de sair.
- **Orientation:** all. **Desktop friendly** e **Mobile friendly:** sim.
- **Main tag:** Puzzle. **Tags extras (até 4, da lista do painel):** Physics, Casual, Blocks, Tower
  (use as que existirem na lista).
- **Allow distribution:** sim, se quiser o jogo também nos sites parceiros.

## Title

```
Hexa Drop
```

## Description (413 caracteres, 100 a 500)

```
Hexa Drop is a physics puzzle about taking a tower apart without losing what sits on top. Tap a block to break it, watch the tower settle and guide the hexagon down to the platform. Every five levels opens a new world with new blocks: bouncy rubber, slippery ice, heavy metal, shattering glass, bombs and TNT. Play 100 levels in 20 worlds, earn three stars and perfect plays, and collect 14 hexagons and upgrades.
```

## How to Play (controles primeiro, até 500)

```
Desktop: click a block to break it. P, Space or Esc to pause.
Mobile: tap a block to break it.

Tap or click a block to break it and bring the hexagon down to the platform at the bottom of the tower. Don't let it fall off the edge! Every block you break changes how the tower falls, so pick the right one. Each win earns up to three stars, and finishing within the target number of taps is a perfect play. If you get stuck, a hint lights up.
```

## Pontos de atenção na revisão

- **Duplicatas:** a GamePix pode recusar jogo parecido com um que já está no catálogo. O Hexa Drop é original.
- Teste antes no Testing Toolkit (my.gamepix.com/sdk/toolkit): ele aceita o zip (até 200 MB, fica 24 h no ar)
  e tem os testes "Pause", "Resume" e "Open Tab to Check Audio Stop". Lá o vídeo premiado responde
  `success` em metade das vezes, de propósito.

## Como regerar

```bash
node tools/portais.mjs --portal=gamepix             # zip e material deste portal
node tools/portais.mjs --portal=gamepix --so=builds # só o zip
node tools/portaischeck.mjs gamepix           # o SDK falso do portal: carregamento, anúncios, prêmio, pausa, idioma, save
```

O código que fala com o SDK é `src/portais/gamepix.js (sobre src/portais/base.js)`. A pesquisa das regras é de 2026-10-20; as páginas citadas
podem mudar, confira antes de enviar.
