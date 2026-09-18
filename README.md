# Hexa Drop

Jogo de física em HTML5: uma torre de peças com um hexágono no topo. O jogador
toca nas peças para destruí-las, a torre desaba e o hexágono precisa chegar ao
pedestal da base sem cair para fora. Roda em navegador desktop e celular, e foi
construído para publicação na Poki.

Inspirado nos prints em `inspiration/`.

## Rodar

```bash
npm install
npm run dev                  # servidor de desenvolvimento
npm run build                # gera dist/ com caminhos relativos
npm run preview              # serve o build
```

Os cinco modelos visuais ficam em `/prototypes/index.html`.

## Como funciona

**Física.** Planck.js, que é o Box2D 2.4 portado para JavaScript puro. Sem
WebAssembly, então o carregamento é imediato e não há risco de tipo MIME dentro
do iframe da Poki. O mundo usa metros: uma célula da grade é um metro, a
gravidade é de dez metros por segundo ao quadrado, e cada peça é um corpo rígido
com um retângulo por bloco maximal do poliminó.

O passo é fixo em um sexagésimo de segundo, com acumulador e no máximo quatro
passos por quadro. A simulação nunca recebe o delta do `requestAnimationFrame`
direto, porque uma tela de 120 Hz mudaria o resultado.

**Renderização.** Canvas 2D. Cada combinação de forma, material e tema é
desenhada uma vez num canvas fora da tela, com o brilho já embutido, e depois
cada quadro é um `drawImage` sob transformação. É o que dá o traço neon da
referência sem shader e com folga em celular de entrada. O zoom é fixo durante a
fase, o que permite montar esse cache uma única vez.

**Áudio.** Sintetizado em Web Audio, sem nenhum arquivo. Um contexto, um ganho
mestre e dois barramentos. O mute de anúncio mexe só no mestre.

**Fases.** Cem fases, cada uma com um punhado de variantes. O arquivo
`src/game/levels.gen.js` guarda apenas configuração e seeds aprovadas; o layout é
reconstruído no cliente pelo mesmo `levelgen.js` que o validador usou. O arquivo
inteiro cabe em dez kilobytes.

## Geração e validação das fases

```bash
npm run levels               # gera e valida as 100 fases
npm run levels:quick         # menos seeds, para iterar
node tools/generate-levels.mjs --levels 1-20
```

A ferramenta usa um processo por núcleo. Para cada fase ela procura seeds cujo
layout seja realmente vencível, e prova isso com um jogador automático que
simula um lance à frente: para cada peça candidata o mundo é fotografado, o
toque é de fato simulado, o resultado é avaliado e tudo volta ao estado anterior.

Uma variante só é aceita quando vence por caminhos diferentes e continua
vencendo com as posições iniciais perturbadas. Essa robustez é o que permite
usar um motor que não é determinístico entre plataformas: a vitória nunca
depende de precisão milimétrica, então uma divergência de ponto flutuante entre
iOS e desktop não quebra fase nenhuma.

Quando nenhuma variante passa, a configuração é afrouxada em degraus até passar,
e o degrau usado fica gravado no arquivo de fases.

## Verificação

```bash
npm run build
npm run preview &                  # servidor em 127.0.0.1:4173
npm run check                      # build + conformidade + eventos do SDK
npm run verify:audio               # áudio toca e responde ao mute de anúncio
npm run playsweep                  # joga várias fases do jogo no navegador
node tools/playtest.mjs            # joga um protótipo no navegador
node tools/shot.mjs '[...]'        # capturas de tela
```

`verify-build.mjs` cobre o que a revisão da Poki reprova: requisição externa,
dependência de `localStorage`, travar com bloqueador de anúncios, escala nas três
resoluções obrigatórias e tamanho do build.

`sdkcheck.mjs` injeta um SDK falso que registra cada chamada, joga uma fase até o
fim e verifica a ordem dos eventos: `gameLoadingFinished` uma vez, `gameplayStart`
só no primeiro toque, nenhum evento durante um intervalo, nenhum par repetido, e
nunca `complete` e `fail` na mesma tentativa.

## Estrutura

```
index.html                 jogo
prototypes/                os cinco modelos visuais
src/
  main.js                  telas, progressão e o único ponto que fala com a Poki
  poki.js                  wrapper blindado do SDK
  core/                    rng, storage, i18n, viewport, input, loop, tween, audio
  physics/                 materiais, formas, mundo
  game/                    levelgen, solver, session, scene, progress, content
  render/                  temas, sprites, cenários, partículas, câmera, renderer
  ui/game.css              interface
tools/                     geração de fases, verificação, capturas, testes
```

## Conteúdo

**Oito temas**: neon, futurista, rústico, clássico, doce, gelo, lava e papel. O
tema é propriedade da fase e muda a cada mundo de dez.

**Nove materiais**, cada um com física própria e cor própria dentro de cada tema:

| Material | Comportamento |
|---|---|
| Madeira | Referência neutra |
| Pedra | Pesada, cai com força |
| Gelo | Quase sem atrito, tudo escorrega |
| Borracha | Quica e agarra |
| Metal | Muito pesada, esmaga o que está abaixo |
| Vidro | Estilhaça sozinho acima de uma velocidade de impacto |
| Espuma | Leve demais para segurar peso |
| Bomba | Ao tocar, leva as vizinhas |
| Obsidiana | Indestrutível e ancorada, não cai nunca |

A razão entre a densidade mais alta e a mais baixa é de dez para um, que é o
limite a partir do qual o empilhamento do Box2D começa a degradar.

**Trinta e três formas de peça**, de um a dez blocos, incluindo poliminós com
buraco interno.

## Monetização

Toda a receita vem do sistema de anúncios da Poki. Não há compra, login próprio
nem segunda moeda.

**Corações suaves.** Cinco corações; cada queda custa um. Com zero, o jogador
continua jogando normalmente e apenas ganha metade das moedas e do XP. Recarrega
um a cada dez minutos. Nunca há espera obrigatória, o que é a diferença entre
passar e não passar na revisão.

**Quatro vídeos recompensados**, todos opcionais e sempre ao lado de um botão
padrão de tamanho igual ou maior: recarregar corações na derrota, dobrar o
prêmio na vitória, bônus diário no mapa, e dica ou pular fase depois de tropeçar
na mesma fase. A skin exclusiva também pode ser comprada com moedas, porque o
vídeo nunca pode ser o único caminho.

## Checklist da Poki

Antes de enviar uma versão:

- [ ] `npm run check` sem falhas
- [ ] Abrir `dist/` no Poki Inspector e conferir o Event Log:
      `gameLoadingFinished` uma vez, `gameplayStart` só no primeiro toque,
      `gameplayStop` em toda interrupção, nenhum evento durante anúncio
- [ ] Scaling Tests em 640x360, 836x470 e 1031x580
- [ ] QR code do Inspector num aparelho real: áudio destrava no primeiro toque,
      chave de silêncio respeitada, áudio volta depois do anúncio
- [ ] Testar com uBlock ou AdGuard ativo
- [ ] Testar em janela anônima
- [ ] Thumbnail estática de 628x628 sem texto
- [ ] Thumbnail animada de 1080x1080, mp4, quatro a seis segundos
