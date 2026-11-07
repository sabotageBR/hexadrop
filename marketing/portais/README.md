# Hexa Drop nos portais de distribuição

Builds e material gráfico para Y8, Playgama, Yandex Games, GameMonetize, GameDistribution e GamePix
(2026-10-20, versão 1.0.19), para a Wavedash (2026-11-03, mesma versão) e para a itch.io (2026-11-07, o
build da Wavedash 1.0.21 sem SDK). Cada pasta tem as imagens e os vídeos no tamanho e no formato exatos que o
painel pede, a `ficha.md` com as opções do envio e os textos para colar, e uma `folha.jpg` para conferir
tudo de uma vez.

| portal | zip | material e ficha | estado |
|---|---|---|---|
| Y8 | `dist-portais/hexa-drop-y8-1.0.19-sem-id.zip` | [`y8/`](y8/ficha.md) | **falta o id do painel** |
| Playgama | `dist-portais/hexa-drop-playgama-1.0.19.zip` | [`playgama/`](playgama/ficha.md) | pronto |
| Yandex Games | `dist-portais/hexa-drop-yandex-1.0.19.zip` | [`yandex/`](yandex/ficha.md) | pronto |
| GameMonetize | `dist-portais/hexa-drop-gamemonetize-1.0.19-sem-id.zip` | [`gamemonetize/`](gamemonetize/ficha.md) | **falta o id do painel** |
| GameDistribution | `dist-portais/hexa-drop-gamedistribution-1.0.19-sem-id.zip` | [`gamedistribution/`](gamedistribution/ficha.md) | **falta o id do painel** |
| GamePix | `dist-portais/hexa-drop-gamepix-1.0.19.zip` | [`gamepix/`](gamepix/ficha.md) | pronto |
| Wavedash | `dist-portais/hexa-drop-wavedash-1.0.19.zip` | [`wavedash/`](wavedash/) (capa e vídeo; os textos ficam em `distribuicao/hexa-drop/textos.md`) | pronto, nada enviado |
| itch.io | `dist-portais/hexa-drop-itch-1.0.21.zip` (`--versao=1.0.21`) | [`itch/`](itch/) (capa 630x500 e quatro telas do próprio build; os textos ficam em `distribuicao/hexa-drop/textos.md`) | pronto, nada enviado |

## Os ids dos painéis

Y8, GameDistribution e GameMonetize dão ao jogo um id que vai **dentro** do zip. Crie o jogo em cada
painel, cole os ids em `ids.json` (nesta pasta) e gere de novo:

```bash
node tools/portais.mjs --portal=y8,gamedistribution,gamemonetize --so=builds
```

Enquanto faltar o id, o zip sai com `-sem-id` no nome e roda sem anúncios: serve só para testar.

## Tudo de uma vez

```bash
node tools/portais.mjs              # os seis zips e todo o material
node tools/portais.mjs --so=builds  # só os zips
node tools/portais.mjs --so=arte    # só as imagens e os vídeos
node tools/portaischeck.mjs         # os seis builds com o SDK falso de cada portal
```

As regras de cada portal (SDK, anúncios, imagens, textos) vêm da pesquisa de 2026-10-20 nas páginas oficiais.
A fonte de cada regra está citada na ficha do portal e no cofre do Obsidian
(`POKI/30 Referência/Outras plataformas web.md`).
