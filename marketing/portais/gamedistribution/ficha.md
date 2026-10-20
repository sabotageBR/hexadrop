# Hexa Drop na GameDistribution: ficha de envio

Tudo o que o painel da GameDistribution (developer.gamedistribution.com) pede, com os textos prontos para
colar. Os textos vão em inglês, que é obrigatório.

## Antes de gerar o zip: o id

1. No dashboard, digite o título e clique em **Add**.
2. Na aba **UPLOAD**, copie o **Game ID** (32 caracteres hexadecimais) e cole em
   `marketing/portais/ids.json`, em `"gamedistribution"`.
3. Rode `node tools/portais.mjs --portal=gamedistribution --so=builds`. Sai `dist-portais/hexa-drop-gamedistribution-1.0.19.zip` (enquanto faltar o id: `dist-portais/hexa-drop-gamedistribution-1.0.19-sem-id.zip`, só para teste).
4. Suba o zip e abra o jogo pelo iframe da aba UPLOAD. **Assista um anúncio inteiro sem pular**: é assim que
   a GD aprova a integração do SDK, e o checkbox "Rewarded Ads" se marca sozinho depois do teste.

Sem o id o SDK nem é carregado: a GD não atribui a receita.

## Arquivos (abas ASSETS e UPLOAD)

| campo do painel | arquivo | regra |
|---|---|---|
| Zip | `dist-portais/hexa-drop-gamedistribution-1.0.19.zip` | index.html na raiz, ≤ 500 MB |
| Thumbnail 512x384 | `gamedistribution/hexa-drop-thumb-512x384.jpg` | obrigatória; JPG ≤ 500 KB, tamanho exato |
| Thumbnail 512x512 | `gamedistribution/hexa-drop-thumb-512x512.jpg` | obrigatória; JPG ≤ 500 KB |
| Thumbnail 200x120 | `gamedistribution/hexa-drop-thumb-200x120.jpg` | obrigatória; JPG ≤ 500 KB, sem logo |
| Promo 1280x720 | `gamedistribution/hexa-drop-banner-1280x720.jpg` | opcional; JPG ≤ 500 KB, com o título |
| Promo 1280x550 | `gamedistribution/hexa-drop-banner-1280x550.jpg` | opcional; JPG ≤ 500 KB, com o título |

As de 512 e a de 200 vão sem o nome (a GD diz que o título fica melhor só nas de 1280, e proíbe logo na de
200), com a arte inteira, sem área vazia nem borda arredondada. Os arquivos ficam em `marketing/portais/`.

## Opções do envio (aba EDIT)

- **Type:** HTML5. **Sub Type:** Javascript.
- **SDK:** GD HTML5 SDK, carregado pelo jogo depois do `GD_OPTIONS` com o `gameId`:
  - **pre-roll** depois do `SDK_READY`, antes de o jogo abrir;
  - mid-roll nas passagens de fase;
  - o prêmio do vídeo só com `SDK_REWARDED_WATCH_COMPLETE`;
  - pausa e mudo no `SDK_GAME_PAUSE`.
- **Width / Height:** 800 x 600 (o padrão da GD; o jogo se ajusta a qualquer tamanho).
- **Genre (até 2):** Puzzle, Casual.
- **Tags (1 a 5):** Physics, Puzzle, Casual, Blocks, Tower.
- **Age Group:** Kids, Teens, Young Adults, Adults. **Child Friendly:** sim. **No Blood:** sim.
- **Languages:** English, Português, Español, Français, Italiano, Deutsch, Türkçe.
- **Compatibility:** Both (Android e iOS). **Preferred mode of play:** Both.
- **HTTPS Ready:** sim (o jogo não chama nada fora do SDK).

## Name (9 caracteres, máx. 40)

```
Hexa Drop
```

## Description (413 caracteres, 120 a 500, com o nome do jogo)

```
Hexa Drop is a physics puzzle about taking a tower apart without losing what sits on top. Tap a block to break it, watch the tower settle and guide the hexagon down to the platform. Every five levels opens a new world with new blocks: bouncy rubber, slippery ice, heavy metal, shattering glass, bombs and TNT. Play 100 levels in 20 worlds, earn three stars and perfect plays, and collect 14 hexagons and upgrades.
```

## Instructions (345 caracteres, até 500)

```
Tap or click a block to break it and bring the hexagon down to the platform at the bottom of the tower. Don't let it fall off the edge! Every block you break changes how the tower falls, so pick the right one. Each win earns up to three stars, and finishing within the target number of taps is a perfect play. If you get stuck, a hint lights up.
```

## Key game features (209 caracteres, até 300)

```
100 levels in 20 worlds. 13 kinds of blocks, from bouncy rubber to explosive TNT. Wind, swinging platforms and special goals. Three stars and a perfect play on every level. 14 hexagons to collect and upgrades.
```

## Pontos de atenção na revisão

- **Mobile Ready:** marcado, o QA testa em aparelhos Android e iOS antigos e novos, e só aprova se o jogo
  funcionar em todos.
- **Paridade de versão (§2.6.4 do contrato):** a versão na GD tem que ser sempre igual à última publicada
  em outro lugar. Toda atualização do jogo tem que subir aqui também.
- A revisão leva de dias a 3 semanas.

## Como regerar

```bash
node tools/portais.mjs --portal=gamedistribution             # zip e material deste portal
node tools/portais.mjs --portal=gamedistribution --so=builds # só o zip
node tools/portaischeck.mjs gamedistribution           # o SDK falso do portal: carregamento, anúncios, prêmio, pausa, idioma, save
```

O código que fala com o SDK é `src/portais/gamedistribution.js (sobre src/portais/base.js)`. A pesquisa das regras é de 2026-10-20; as páginas citadas
podem mudar, confira antes de enviar.
