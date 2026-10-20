# Hexa Drop na CrazyGames: ficha de envio

Tudo o que o formulário do Developer Portal (developer.crazygames.com) pede, com os
textos prontos para colar. Os textos vão em inglês, que é obrigatório; a tradução
em português no fim é só para conferir o sentido.

## Arquivos

| campo | arquivo | regra da CrazyGames |
|---|---|---|
| build | `hexa-drop-crazygames-<versão>.zip` (do `dist-crazy/`) | caminhos relativos, ≤ 50 MB inicial, ≤ 1.500 arquivos |
| capa paisagem | `capas/hexadrop-capa-1920x1080.png` | 16:9, 1920x1080 |
| capa retrato | `capas/hexadrop-capa-800x1200.png` | 2:3, 800x1200 |
| capa quadrada | `capas/hexadrop-capa-800x800.png` | 1:1, 800x800 |
| vídeo paisagem | `videos/hexadrop-video-1920x1080.mp4` | 16:9 1080p, 15 a 20 s, ≤ 50 MB, sem som |
| vídeo retrato | `videos/hexadrop-video-1080x1620.mp4` | 2:3 1080p, 15 a 20 s, ≤ 50 MB, sem som |

`capas/hexadrop-capa-1080x1620.png` não vai para o envio: é o primeiro quadro do
vídeo em retrato.

As capas só têm o nome do jogo como texto (a logo), sem borda, sem "New"/"Play" e sem
ícone de loja. Os vídeos abrem com a capa do mesmo formato, rodam em velocidade
real, não têm cursor, tela preta, faixa preta nem texto de propaganda.

## Opções do envio

- **Engine / tipo:** HTML5.
- **SDK:** HTML5 SDK v3, integrado (game, ad, data e user.systemInfo).
- **Progress Save:** **ligar.** Sem essa opção o módulo Data fica desligado
  (`dataModuleDisabled`), o save não vai para a conta do jogador e o jogo cai para o
  localStorage sozinho.
- **Orientação:** as duas. No desktop o jogo roda deitado (16:9) com o HUD nas laterais;
  no celular roda em pé ou deitado, a cena se ajusta.
- **Celular:** sim (toque). Tablet usa o esquema de celular.
- **Idiomas:** English, Português, Español, Français, Italiano, Deutsch, Türkçe. O jogo
  usa o `locale` do site e cai para o inglês.
- **Anúncios:** midgame entre fases (depois da fase 5) e vídeo recompensado opcional
  (voltar uma jogada, pular fase, bônus diário, hexágono da loja, dobrar o prêmio da
  fase 100). Sem banner.
- **Compras no jogo:** não.
- **Multiplayer / chat / login próprio:** não.
- **Classificação:** sem violência, sem texto livre e sem conta própria: cabe no PEGI 12
  que a CrazyGames exige.

## Nome

```
Hexa Drop
```

## Categoria e tags

Categoria: **Puzzle**. Tags sugeridas (escolha as que existirem na lista do portal):

```
Physics, Puzzle, Casual, Blocks, Tower, Relaxing, Logic, Mouse, Touch, 1 Player
```

## Descrição curta

```
Break the right blocks and bring the hexagon safely down the tower to the platform. A physics puzzle with 100 levels and new worlds every five.
```

## Descrição

```
Hexa Drop is a physics puzzle about taking a tower apart without losing what sits on top. Tap a block to break it, watch the tower settle, and guide the hexagon all the way down to the platform. If it falls off the edge, try again!

Every five levels opens a new world with its own sky and its own blocks. Rubber bounces, ice slides, metal is heavy, glass shatters, crystal and wax give way under the hexagon, and bombs and TNT blow up everything around them. Later worlds add wind, swinging platforms and new goals: protect the gem, work around locked blocks and land on the golden strip.

Clear a level within the target number of taps for a perfect play, finish worlds to win new hexagons and upgrades, and keep playing after level 100.

Features:
- 100 levels in 20 worlds, each one checked to be solvable, and more after level 100
- 13 kinds of blocks, from bouncy rubber to explosive TNT
- Wind, swinging platforms and special goals in the later worlds
- Three stars and a perfect play on every level, plus combos for big collapses
- 14 hexagons to collect, golden editions and upgrades
- Your progress is saved to your CrazyGames account
```

## Como jogar

```
Break blocks to bring the hexagon down to the platform at the bottom of the tower. Don't let it fall off! Each block you break changes how the tower falls, so pick the right one. Every win earns three stars; finish within the target number of taps for a perfect play.
```

## Controles

```
Left mouse button / tap: break a block
P, Space or Esc: pause
Arrow keys or WASD: move through menus
Enter or Space: confirm
```

## Para conferir (português)

> *Descrição curta:* Quebre os blocos certos e leve o hexágono em segurança torre
> abaixo até a plataforma. Um quebra-cabeça de física com 100 fases e mundos novos a
> cada cinco.
>
> *Descrição:* Hexa Drop é um quebra-cabeça de física sobre desmontar uma torre sem
> perder o que está no alto. Toque num bloco para quebrá-lo, veja a torre se acomodar
> e leve o hexágono até a plataforma. Se ele cair pela beirada, tente de novo! A cada
> cinco fases abre um mundo novo, com céu e blocos próprios: borracha quica, gelo
> escorrega, metal pesa, vidro estilhaça, cristal e cera cedem sob o hexágono, bomba e
> TNT explodem tudo em volta. Os mundos seguintes trazem vento, plataformas que
> balançam e objetivos novos: proteger a joia, contornar os blocos com cadeado e pousar
> na faixa dourada. Vença dentro da meta de toques para uma jogada perfeita, conclua
> mundos para ganhar hexágonos e melhorias, e continue depois da fase 100.

## Como regerar

```bash
npm run build:crazy                       # dist-crazy/
npm run preview:crazy                     # 127.0.0.1:4176, com o SDK em modo local
npm run verify:crazy                      # com o preview:crazy no ar
node tools/crazygames.mjs                 # capas (~10 s)
node tools/crazygames.mjs --videos        # capas e os dois vídeos (~10 min cada)
cd dist-crazy && zip -r ../hexa-drop-crazygames-$(node -p "require('../package.json').version").zip .
```

Os vídeos escolhem as fases pelas seeds atuais: rode de novo depois de `npm run levels`
ou de mexer em arte, como o `npm run thumbnail`.
