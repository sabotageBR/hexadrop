# Hexa Drop na Yandex Games: ficha de envio

Tudo o que o Console da Yandex Games (yandex.com/dev/games/console) pede, com os textos prontos para colar.
O rascunho vem com as abas **EN** e **RU**: os textos das duas estão abaixo. **O jogo não está traduzido
para o russo**; em "Game translated into" marque só os idiomas do jogo, porque a moderação testa todos os
marcados.

**Antes de enviar para a moderação, assine o contrato** (ULM no Console, para pessoa jurídica de fora da
Rússia).

## Arquivos

| campo do painel | arquivo | regra |
|---|---|---|
| Archive | `dist-portais/hexa-drop-yandex-1.0.19.zip` | index.html na raiz, ≤ 100 MB descompactado, nomes sem espaço |
| Icon | `yandex/hexa-drop-icone-512x512.png` | 512x512, sem texto nem UI |
| Cover | `yandex/hexa-drop-capa-800x470.png` | 800x470; o nome igual ao título do idioma |
| Cover (alternativa) | `yandex/hexa-drop-capa-800x470-sem-texto.png` | a mesma, sem o nome |
| Hero image (opcional) | `yandex/hexa-drop-hero-1560x520.png` | 1560x520 |
| Screenshots desktop | `yandex/hexa-drop-tela-desktop-1920x1080-1.png, -2, -3` | 16:9, mínimo 2, gameplay real |
| Screenshots mobile | `yandex/hexa-drop-tela-mobile-1080x1920-1.png, -2, -3` | 9:16, mínimo 2, gameplay real |
| Horizontal video | `yandex/hexa-drop-video-1920x1080.mp4` | 16:9, ≤ 28 s, ≤ 100 MB, ≥ 70% gameplay |

Cada idioma do rascunho tem o seu conjunto de mídias. Use as mesmas nas duas abas: o nome na capa é
**Hexa Drop**, e ele é o título nas duas. Os arquivos ficam em `marketing/portais/`.

## Opções do envio

- **SDK:** `<script src="/sdk.js">`, relativo, como a Yandex pede (item 1.7). Fora da Yandex o arquivo não
  existe e o jogo roda sem SDK. Confira no rascunho com `&debug-mode=16`: o painel deve mostrar `IT`.
- **O que o build faz pelos requisitos:**
  - `LoadingAPI.ready()` quando o jogo fica interativo (1.19.2);
  - o idioma por `environment.i18n.lang` na inicialização (2.14);
  - `game_api_pause` e `game_api_resume` calam e pausam o jogo, inclusive no anúncio que a Yandex mostra
    na abertura (4.7);
  - nenhum menu de contexto no clique direito nem no toque longo (1.6.1.8 e 1.6.2.7);
  - o prêmio do vídeo só no `onRewarded`.
- **Cloud save:** não. O progresso fica no armazenamento do navegador, que o requisito 1.9 aceita para jogo
  sem compra. **Compras:** não.
- **Supported platforms:** desktop, mobile, tablet. **Orientation:** as duas. No desktop o jogo roda deitado, com o HUD nas laterais; no celular, em pé ou deitado, e a cena se ajusta.
- **Game translated into:** English, Português, Español, Français, Italiano, Deutsch, Türkçe.
- **Age rating:** 0+ (sem violência, sem texto livre, sem conta própria).
- **Categories (até 2):** Puzzle e Casual.
- **Anúncios:** intersticial na passagem de fase (a partir da fase 6) e vídeo premiado opcional (voltar uma jogada, pular fase, bônus diário, hexágono da loja, dobrar o prêmio da fase 100).

## EN

**Title**
```
Hexa Drop
```
**Short description** (63 caracteres, máx. 70, sem o nome)
```
Break the right blocks and bring the hexagon down in 100 levels
```
**SEO description** (143 caracteres, 50 a 160)
```
Break the right blocks and bring the hexagon safely down the tower to the platform. A physics puzzle with 100 levels and new worlds every five.
```
**Description** (832 caracteres, 100 a 1000)
```
Hexa Drop is a physics puzzle about taking a tower apart without losing what sits on top. Tap a block to break it, watch the tower settle and guide the hexagon all the way down to the platform. If it falls off the edge, try again!

Every five levels opens a new world with its own sky and its own blocks. Rubber bounces, ice slides, metal is heavy, glass shatters, and bombs and TNT blow up everything around them. Later worlds add wind, swinging platforms and new goals: protect the gem, work around locked blocks and land on the golden strip.

Features:
- 100 levels in 20 worlds, each one checked to be solvable, and more after level 100
- 13 kinds of blocks, from bouncy rubber to explosive TNT
- Three stars and a perfect play on every level, plus combos for big collapses
- 14 hexagons to collect, golden editions and upgrades
```
**How to play** (481 caracteres, 100 a 1000)
```
Tap or click a block to break it and bring the hexagon down to the platform at the bottom of the tower. Don't let it fall off the edge! Every block you break changes how the tower falls, so pick the right one. Each win earns up to three stars, and finishing within the target number of taps is a perfect play. If you get stuck, a hint lights up.

Mouse or touch: click or tap a block to break it
P, Space or Esc: pause
Arrow keys or WASD: move through menus
Enter or Space: confirm
```
**Keywords** (68 caracteres, máx. 100)
```
physics puzzle, tower, hexagon, blocks, logic, brain, casual, levels
```

## RU

**Title**
```
Hexa Drop
```
**Short description** (63 caracteres, máx. 70)
```
Ломайте нужные блоки и спустите шестиугольник вниз: 100 уровней
```
**SEO description** (128 caracteres, 50 a 160)
```
Физическая головоломка: ломайте нужные блоки и спустите шестиугольник с башни на платформу. 100 уровней и новый мир каждые пять.
```
**Description** (762 caracteres, 100 a 1000)
```
Hexa Drop — физическая головоломка: разберите башню, не уронив то, что стоит на вершине. Нажмите на блок, чтобы сломать его, посмотрите, как оседает башня, и доведите шестиугольник до платформы внизу. Упал за край — попробуйте ещё раз!

Каждые пять уровней открывают новый мир со своим небом и своими блоками. Резина пружинит, лёд скользит, металл тяжёлый, стекло бьётся, а бомбы и TNT взрывают всё вокруг. В дальних мирах появляются ветер, качающиеся платформы и новые цели: сберечь кристалл, обойти запертые блоки и приземлиться на золотую полосу.

Особенности:
- 100 уровней в 20 мирах, а после сотого — ещё
- 13 видов блоков, от упругой резины до взрывчатки
- Три звезды и идеальное прохождение на каждом уровне
- 14 шестиугольников для коллекции и улучшения
```
**How to play** (334 caracteres, 100 a 1000)
```
Нажимайте на блоки, чтобы ломать их, и доведите шестиугольник до платформы у основания башни. Не дайте ему упасть за край! Каждый сломанный блок меняет то, как падает башня, поэтому выбирайте с умом. За победу — до трёх звёзд, а если уложиться в заданное число нажатий, прохождение будет идеальным. Если застряли, загорится подсказка.
```
**Keywords** (64 caracteres, máx. 100)
```
физика, головоломка, башня, блоки, шестиугольник, логика, уровни
```

## Developer's comment (opcional)

```
Ads: interstitials only between levels and after a player action, rewarded videos only by the player choice with the reward shown on the button. Progress is saved in the browser storage after every level. The game has no purchases and no external links.
```

## Pontos de atenção na revisão

- **Russo:** não é obrigatório, mas a Yandex recomenda RU+EN, e a seção "Popular" exige os dois. Traduzir
  o jogo para o russo é o que mais aumentaria o alcance aqui.
- **Item 4.4:** o intersticial do jogo corrido sai na passagem de fase, logo depois da celebração da vitória (a ação do jogador é o toque que derruba o hexágono). Se a moderação pedir, dá para tirar a passagem automática da lista (`pontos` em `src/portais/base.js`), como na Y8.
- A moderação leva de 3 a 5 dias úteis. Depois de uma recusa, a espera para reenviar começa em 24 h e dobra
  a cada recusa.

## Como regerar

```bash
node tools/portais.mjs --portal=yandex             # zip e material deste portal
node tools/portais.mjs --portal=yandex --so=builds # só o zip
node tools/portaischeck.mjs yandex           # o SDK falso do portal: carregamento, anúncios, prêmio, pausa, idioma, save
```

O código que fala com o SDK é `src/portais/yandex.js (sobre src/portais/base.js)`. A pesquisa das regras é de 2026-10-20; as páginas citadas
podem mudar, confira antes de enviar.
