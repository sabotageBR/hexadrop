# Hexa Drop na GameMonetize: ficha de envio

Tudo o que o painel da GameMonetize (gamemonetize.com, Dashboard > My games) pede, com os textos prontos
para colar.

> **Leia antes de enviar.** Os termos de uso (atualizados em 27/02/2025) dizem que *"your submitted game
> cannot be removed because you have accepted publishing rules which are under exclusive agreement
> GameMonetize.com (GMO Holding Ltd.) and their partners"*: o jogo enviado não pode ser retirado depois.

## Antes de gerar o zip: o id

1. Dashboard > My games > **Add game**; na página do jogo criado, copie o **GameId**.
2. Cole em `marketing/portais/ids.json`, em `"gamemonetize"`.
3. Rode `node tools/portais.mjs --portal=gamemonetize --so=builds`. Sai `dist-portais/hexa-drop-gamemonetize-1.0.19.zip` (enquanto faltar o id: `dist-portais/hexa-drop-gamemonetize-1.0.19-sem-id.zip`, só para teste).
4. No painel: suba o zip, **Verify Game** e **REQUEST ACTIVATION**. Teste sem AdBlock nem VPN, e espere
   cerca de 2 minutos antes de pedir o anúncio de teste.

## Arquivos

| campo do painel | arquivo | regra |
|---|---|---|
| Zip | `dist-portais/hexa-drop-gamemonetize-1.0.19.zip` | index.html e os arquivos na raiz (sem pasta por cima) |
| Default image | `gamemonetize/hexa-drop-thumb-512x384.jpg` | 512x384, JPEG |
| 512x512 e 512x340 (se o painel pedir) | `gamemonetize/hexa-drop-thumb-512x512.jpg, -512x340.jpg` | JPEG |

Os arquivos ficam em `marketing/portais/`.

## Opções do envio

- **SDK:** GameMonetize SDK (`api.gamemonetize.com/sdk.js`), carregado pelo jogo depois do `SDK_OPTIONS`
  com o `gameId`. Pausa e mudo no `SDK_GAME_PAUSE`, volta no `SDK_GAME_START`.
- **Não existe vídeo premiado na GameMonetize:** o jogo troca os botões de vídeo pelo caminho gratuito que já existe na versão lisa: pular fase vira botão comum depois de três derrotas, voltar uma jogada sai de graça e o bônus diário sai sem vídeo.
- **Anúncios:** só o intersticial (`sdk.showBanner()`), e nunca no carregamento, que eles proíbem.
  Sai nas passagens de fase, a partir da fase 6. O SDK espera ~130 s entre um e outro.
- **Mobile:** sim. **Orientação:** as duas. No desktop o jogo roda deitado, com o HUD nas laterais; no celular, em pé ou deitado, e a cena se ajusta. **Idiomas:** English, Português, Español, Français, Italiano, Deutsch, Türkçe.
- **Branding/links:** nenhum (o jogo não tem link externo nem "More Games").

## Title

```
Hexa Drop
```

## Category e tags (até 7)

Puzzle · Physics, Puzzle, Casual, Blocks, Tower, Logic, Brain

## Description

```
Hexa Drop is a physics puzzle about taking a tower apart without losing what sits on top. Tap a block to break it, watch the tower settle and guide the hexagon down to the platform. Every five levels opens a new world with new blocks: bouncy rubber, slippery ice, heavy metal, shattering glass, bombs and TNT. Play 100 levels in 20 worlds, earn three stars and perfect plays, and collect 14 hexagons and upgrades.
```

## Instructions

```
Tap or click a block to break it and bring the hexagon down to the platform at the bottom of the tower. Don't let it fall off the edge! Every block you break changes how the tower falls, so pick the right one. Each win earns up to three stars, and finishing within the target number of taps is a perfect play. If you get stuck, a hint lights up.

Mouse or touch: click or tap a block to break it
P, Space or Esc: pause
Arrow keys or WASD: move through menus
Enter or Space: confirm
```

## Como regerar

```bash
node tools/portais.mjs --portal=gamemonetize             # zip e material deste portal
node tools/portais.mjs --portal=gamemonetize --so=builds # só o zip
node tools/portaischeck.mjs gamemonetize           # o SDK falso do portal: carregamento, anúncios, prêmio, pausa, idioma, save
```

O código que fala com o SDK é `src/portais/gamemonetize.js (sobre src/portais/base.js)`. A pesquisa das regras é de 2026-10-20; as páginas citadas
podem mudar, confira antes de enviar.
