# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Jogo de física em HTML5 (Vite + Planck.js + Canvas 2D), sem framework, feito para
publicação na Poki. Código, comentários e documentação estão em português; siga o
mesmo idioma ao escrever.

## Comandos

```bash
npm run dev          # servidor de desenvolvimento em 127.0.0.1:5173
npm run build        # dist/ (versao Poki) com caminhos relativos
npm run preview      # serve o build em 127.0.0.1:4173
npm run check        # build + verify-build + sdkcheck

npm run build:lisa   # dist-lisa/ (versao sem plataforma)
npm run preview:lisa # serve dist-lisa em 127.0.0.1:4174
npm run verify:lisa  # conformidade da versao lisa (precisa do preview:lisa no ar)
```

Geração de fases (grava `src/game/levels.gen.js`):

```bash
npm run levels                                   # 160 fases, um worker por núcleo
npm run levels:quick                             # menos seeds, para iterar
node tools/generate-levels.mjs --levels 1-20     # só um trecho; o resto do arquivo é preservado
```

Verificação — **todas as ferramentas de `tools/` sobem `google-chrome --headless=new`
em uma porta de debug fixa (9222/9333/9555/9666/9777/9888), então rode uma por vez**,
e todas precisam de um servidor já no ar:

```bash
npm run verify           # conformidade Poki; lê VERIFY_URL, padrão :5173 (dev)
npm run verify:sdk       # ordem dos eventos do SDK; lê SDK_URL, padrão :4173 (preview)
npm run verify:audio     # AUDIO_URL, padrão :4173
npm run playsweep        # joga fases de verdade no navegador; SWEEP_URL :4173
SWEEP_LEVELS=42,43 npm run playsweep             # só essas fases
node tools/playtest.mjs http://127.0.0.1:5173/prototypes/neon.html
node tools/shot.mjs '[{"name":"home","url":"...","w":430,"h":880,"mobile":true}]'   # PNGs em /tmp/shots
```

`npm run check` roda `verify-build` (padrão :5173) e `sdkcheck` (padrão :4173): ou
deixe `dev` e `preview` no ar ao mesmo tempo, ou aponte `VERIFY_URL` para o preview.

Não há framework de teste nem linter. A verificação é essa automação sobre o Chrome.

## Arquitetura

**Camadas, da mais pura para a mais suja.** `core/` e `physics/` e `game/` não tocam
no DOM — é isso que permite o validador offline rodar exatamente o mesmo código do
jogo dentro do Node. Só `main.js`, `poki.js`, `render/` e `core/{input,loop,viewport,audio,storage,i18n}.js`
usam `window`/`document`. **Ao mexer em `src/physics/` ou `src/game/`, não introduza
nenhuma referência a `window`, `document` ou `performance`**: `tools/generate-levels.mjs`
importa esses módulos direto e quebra.

**`GameScene` (`src/game/scene.js`) é o jogo.** Junta viewport, input, loop, câmera,
partículas e renderer. Tanto `main.js` quanto os protótipos em `prototypes/` carregam
essa mesma classe — um protótipo é o jogo final com outra arte e um HUD de depuração,
nunca uma reimplementação.

**Os protótipos não entram no build.** São oficina: rodam em `npm run dev`, que serve
qualquer HTML do projeto direto da fonte. Enquanto estiveram nas entradas do
`vite.config.js`, `cssCodeSplit: false` juntava `prototypes/proto.css` na **mesma folha**
que o `index.html` carrega — e, vindo depois, o `.stat` do HUD de depuração vencia o do
jogo: na home os contadores de coração e moeda viravam caixinhas com o número embaixo do
ícone, e o `:root` do protótipo ainda trocava `--ink`, `--accent` e `--panel` até a
primeira fase carregar. **Isso só aparecia no build**: em dev cada página carrega a sua
folha e o jogo ficava certo. Daí a regra: conferir sempre o `dist/` servido, não o
servidor de desenvolvimento — é o que `tools/` já faz por padrão.

**`Session` (`src/game/session.js`) são as regras**, em volta de `PhysicsWorld`. Não
desenha e não fala com o DOM; comunica por callbacks (`onStar`, `onEnd`, `onFirstTap`,
`onDestroy`, `onImpact`). Quem quer efeito visual/sonoro embrulha esses callbacks — é
o que `GameScene.load()` faz.

**`main.js` é o único lugar que decide telas, progressão e quando falar com a Poki.**
Nenhum outro módulo importa `poki.js`. Mantenha assim.

### Mundos e o tamanho de cada um

`WORLD_SIZES` em `src/game/levelgen.js` é a **única fonte de verdade** sobre fronteira
de mundo: `[20, 10, 10, ...]`, quinze mundos, 160 fases, 480 estrelas. Dele saem
`LEVEL_COUNT`, `WORLD_COUNT`, `worldOf()`, `worldStart()`, `worldSize()` e
`indexInWorld()`, e é por essas funções que todo mundo pergunta — **nunca por `/10`,
`% 10` ou `w * 10`**. Esse `10` esteve literal em dezenove lugares de cinco arquivos,
e enquanto esteve bastava esquecer um para o mapa abrir uma fase e o portão cobrar
outra.

O mundo 1 tem vinte fases porque é o tutorial: toque, estrela, pedestal, pedra e
obsidiana cabem ali sem pressa. A curva de `levelConfig()` acompanha o tamanho dele
(`fimDoTutorial = worldStart(1)`), e não um número cravado.

**As três primeiras fases são roteiro, não ponto da curva** (`PRIMEIRAS_FASES` em
`levelgen.js`, aplicado por cima da curva e da regra de estreia). Pela curva elas
eram a mesma fase três vezes — quatro barras de quatro colunas, quatro toques, nada
caindo de verdade —, o jogador concluía que o jogo era aquilo e saía no primeiro
intervalo. Misturar formas numa torre de quatro colunas não resolve: medido, qualquer
peça que não seja barra deixa o hexágono rolar para fora com um toque ingênuo. Com
**seis colunas** a torre tem apoio dos dois lados e cerca de uma seed em quatro sai
variada e ainda vence tocando ao acaso. Cada linha do roteiro traz exigências que só
o gerador lê — `minForgiveness` (1: as políticas ingênuas vencem sempre, jogando duas
vezes cada), `minPieces` (9: nada de torre só de barras) e `minPar` (3: nada de torre
que desaba inteira em dois toques) —, com orçamento de seeds seis vezes maior, porque
com sete linhas a taxa cai para uma em dez.

`GATE_STARS` (`game/content.js`) tem uma entrada por mundo e foi re-escalado pela
mesma fração do que já estava disponível em cada ponto, para o aperto percebido
continuar igual ao de antes. O mundo 1 vale 60 estrelas, os outros 30.

### A peça que define cada mundo

`THEME_MATERIALS` (`levelgen.js`) dá a cada tema `{ base, apoio, assinatura, teto }`.
A `base` é a peça dominante da torre; o `apoio` a sustenta e assume enquanto a base
ainda não estreou; a `assinatura` é o material que aquele cenário empurra para frente.

Antes disso `baseMaterial()` devolvia **madeira para catorze dos quinze mundos**:
trocar de mundo trocava o céu e a paleta, nunca a peça. Medido sobre as seeds
aprovadas, o mundo 2 inteiro era 68% madeira, 27% pedra e 5% obsidiana. O mundo 1
escondia o problema porque o `block` do tema puzzle sorteia sete cores da marca pela
posição na grade — sai do mundo 1 e o arco-íris acaba.

Duas regras que nasceram de medição:

- **`teto` limita bases frágeis.** Gelo tem atrito 0,09 e vidro quebra por pancada:
  uma torre feita quase só deles é um escorregador que o validador só aprova no degrau
  3 de afrouxamento — o degrau que apaga toda a variedade. Onde há teto, os outros
  pesos encolhem em vez de a base inflar.
- **O degrau 3 usa `baseMaterial(theme, level, true)`**, que troca base frágil pelo
  apoio. Ali o objetivo é só a fase existir, e um degrau 3 feito de gelo sairia mais
  difícil que o original.

`MATERIAL_DEBUT` (`physics/materials.js`) segue as fronteiras de mundo e obedece a uma
regra: **cada material estreia no mundo ANTERIOR àquele em que vira dominante**, para
o jogador conhecer a peça solta antes de encarar uma torre feita dela.

### Determinismo e as fases assadas

`src/game/levelgen.js` é puro e determinístico: a mesma seed produz o mesmo layout no
validador em Node e no cliente. `src/game/levels.gen.js` guarda só o degrau de
afrouxamento e as seeds aprovadas — o layout é reconstruído no cliente.

Consequências práticas:

- **Nunca edite `src/game/levels.gen.js` à mão.** A regeneração parcial reencontra as
  linhas preservadas por regex no formato `{ s: N, v: [...] }`; mudar a formatação
  quebra o merge.
- **Qualquer mudança em `levelgen.js`, `core/rng.js`, `physics/shapes.js`,
  `physics/materials.js` ou nas constantes de `physics/world.js` invalida as seeds
  assadas.** Rode `npm run levels` depois — senão fases validadas viram fases
  possivelmente impossíveis. Isso inclui `WORLD_SIZES`, `MATERIAL_DEBUT`,
  `THEME_MATERIALS` e a regra de impacto do `pre-solve`.
- Bumpar `GENERATOR_VERSION` em `tools/generate-levels.mjs` troca todas as seeds.
- O validador aceita uma variante só quando ela vence por caminhos diferentes e
  continua vencendo com as posições iniciais perturbadas. É essa folga que permite
  usar um motor de física que não é determinista entre plataformas.

`src/game/solver.js` serve aos dois lados: prova a jogabilidade no validador e escolhe
a peça destacada quando o jogador pede dica no jogo.

### Física

Planck.js (Box2D 2.4 em JS puro, sem WebAssembly). Uma célula da grade é um metro;
cada peça é um corpo rígido com um retângulo por bloco maximal do poliminó
(`shapes.toRects`). Passo fixo de 1/60 com acumulador e no máximo 4 passos por quadro
(`core/loop.js`) — **a simulação nunca recebe o delta do `requestAnimationFrame`
direto**, senão uma tela de 120 Hz muda o resultado.

A razão entre a maior e a menor densidade em `physics/materials.js` é 10:1, que é o
limite a partir do qual o empilhamento do Box2D degrada. Não passe disso.

Impacto é medido no `pre-solve` pela velocidade de aproximação **vezes o quinhão de
massa do outro corpo**, nunca pelo impulso do `post-solve`: numa torre alta o impulso
mede o peso estático da pilha e o vidro da base estilhaçaria sozinho.

O quinhão (`quinhaoDeMassa`, `physics/world.js`) é `2 * outra / (outra + minha)`,
dobrado de propósito para que **massas iguais continuem valendo 1** — é nesse ponto
que os `breakSpeed` de `materials.js` foram calibrados, então a regra antiga continua
valendo para o caso simétrico. Corpo estático (pedestal, obsidiana) tem massa zero no
Box2D e vale como massa infinita, senão vidro que cai no chão nunca quebraria.

Sem o quinhão, só a velocidade contava, e foi o que o jogador viu: medido no próprio
motor, uma espuma de densidade 0,35 quebrava o vidro exatamente como um bloco de metal
de densidade 3,2, e uma torre inteira parada em cima dele não fazia nada. Pior, como
numa torre a peça de cima raramente cai os 0,8 de célula que valem 4,0 m/s, o metal
batia a ~3 m/s e o vidro sobrevivia. Queda mínima para estilhaçar o vidro, medida
depois da correção:

| quem cai | densidade | queda |
|---|---|---|
| espuma | 0,35 | nunca, na prática |
| madeira | 1,0 | 1,5 célula |
| vidro (massa igual) | 1,3 | 1 célula — **como era antes** |
| pedra | 2,2 | 0,75 célula |
| metal | 3,2 | 0,4 célula |

A TNT subiu de 3,2 para 4,5 de `breakSpeed` na mesma mudança: com o quinhão, 3,2 fazia
a caixa detonar com um metal roçando de um quarto de célula. 4,5 devolve o gatilho de
antes para uma peça pesada e cobra bem mais de uma leve, que é o que "pancada forte"
sempre quis dizer. Peça parada em cima não quebra nada: seis metais empilhados sobre
um vidro dão 1,26 m/s, longe dos 4,0.

`PhysicsWorld.evaluate()` devolve `playing | won | lost | stuck`. `stuck` (acabaram as
peças destrutíveis e tudo parou fora do pedestal) conta como vitória para o jogador
quando ele já tem pelo menos uma estrela — ver `onLevelEnd` em `main.js`.

`stuck` também cobre o hexágono **encalhado** (`hexStranded()`): ele parou sobre
geometria que o jogador não pode remover — obsidiana, pedestal — e nenhuma peça viva
o alcança mais, nem encostando, nem desabando em cima, nem explodindo perto. Antes
disso a fase seguia em `playing` para sempre e o jogador só descobria o beco sem saída
gastando todos os toques. O gatilho é o corpo do hexágono **dormindo** no Box2D, e não
`hexAtRest()`: meio segundo abaixo de 0,01 m/s contra 0,16, o que impede encerrar a
fase enquanto ele ainda tomba devagar pela quina. Todo o resto do teste erra de
propósito para o lado de "ainda dá" — uma peça em contato, ou perto o bastante para
tombar sobre ele, mantém a fase viva.

### Combo, trilha e pausa

**Combo.** Cada toque abre uma jogada (`comboOpen` em `session.js`); tudo que cair
por causa dele entra na conta, e a jogada fecha quando a torre para
(`everythingAtRest`) ou quando estoura `COMBO_WINDOW`. Esperar o repouso, e não o
quadro seguinte, é o que faz o combo enxergar o desabamento inteiro. Peça que sai
da tela (`cleanup`) e peça da celebração (`bonus`) não contam — nenhuma das duas é
mérito do jogador. Vale `n²` em moedas e `n` em XP, somados no fim da fase.

**A contagem sobrevive ao embrulho.** `Session` passa o seu próprio `_onDestroy`
para o `PhysicsWorld` e guarda o hook externo em `_destroyHook`. `GameScene.load()`
embrulha `world.onDestroy` depois, para os estilhaços; se a contagem estivesse no
hook externo, o embrulho a substituiria.

**Trilha.** Cada mundo tem escala, raiz, andamento, timbre, pad e um **motivo**
melódico próprio (`MUSIC` em `main.js`); o desenho rítmico e a forma de 32 compassos
moram em `core/audio.js`. A tela inicial tem tema próprio (`MAIN_THEME`): antes ela
herdava a música do mundo em cartaz, e deslizar o carrossel trocava a trilha — a
identidade sonora do jogo dependia de onde o jogador tinha parado. `holdMusic()` na
pausa e `releaseMusic()` ao voltar: quem pulsa o sequenciador é o passo da cena, que
segue rodando, e ele não sabia de pausa nenhuma.

**Pausa.** O cartão diz onde o jogador está (mundo, fase, estrelas, toques e meta) e
traz os botões de som e música. Nada disso é decoração: pausar é o momento em que o
jogador quer saber como está indo.

### Celebração de fim de fase

Toda vitória passa por uma cascata: as peças que sobraram estouram uma a uma, de
cima para baixo, com um contador na tela (`session.startBonus()` / `_stepBonus()`).
Cada peça intacta vale `BONUS_COINS_PER_PIECE` moedas e `BONUS_XP_PER_PIECE` de XP
(`game/content.js`) — é o que transforma "sobrou peça" de sobra em meta, sem tocar
em estrela nenhuma: os portões de mundo continuam pedindo o que pediam.

Três invariantes:

1. **`evaluate()` não roda durante a cascata.** `step()` desvia para `_stepBonus`
   enquanto `session.bonus` é true. Sem isso, esvaziar a torre dispararia `stuck`
   por cima do resultado que o jogador acabou de conquistar.
2. **O resultado só é gravado quando a contagem termina** (`finishWin()` em
   `main.js`). As peças que sobraram fazem parte do prêmio, e a contagem acontece
   no canvas, antes do cartão entrar.
3. **`onLevelEnd` ignora reentrada** (`pendingWin` preenchido ou tela diferente de
   `game`). Durante a cascata a torre se desfaz e o hexágono desce; um segundo
   veredito no meio disso recomeçaria a contagem com a torre já vazia e apagaria o
   prêmio — foi exatamente o que aconteceu no primeiro teste.

No cartão de vitória, **"tentar de novo" só existe abaixo de três estrelas**: com as
três o botão não leva a lugar nenhum e ainda divide a fileira com "próxima", que é para
onde o jogador quer ir. Escondido, "próxima" ocupa a fileira inteira sozinha — a regra
`.card .row .btn` já é `flex: 1 1`.

O ritmo acelera pela posição na fila e pelo tempo restante, com teto em
`BONUS_MAX_TIME`: com trinta peças sobrando a celebração aperta o passo em vez de
arrastar. `tools/playsweep.mjs` espera a tela sair de `game` antes de anotar o
resultado — sem isso toda vitória com muitas peças vira "ainda jogando"; é por isso
que ele desliga o fluxo contínuo (abaixo).

### Fluxo contínuo entre fases

**Dentro de um mundo, vencer não abre tela.** `finishWin()` grava o prêmio, a contagem
da celebração sai, um selo entra no lugar dela com o `+moedas` e a linha de bônus, as
moedas voam para o contador `#gameCoins` do HUD, e um segundo depois a fase seguinte
entra atrás de um corte de 200 ms (`.wipe`). Ninguém clica em nada.

A régua é `WORLD_SIZES`, a mesma fonte de verdade de todo o resto: `flowContinues()`
para na **última fase de cada mundo** e na fase final do jogo, e em nenhum outro lugar.
Como o mundo 1 tem vinte fases, o primeiro cartão do jogo aparece na fase 20.

A medida vem de um playtest da Poki relatado por outro desenvolvedor: tirando as telas
de "fase concluída", o tempo médio de sessão dele foi de 3 min 49 s para 7 min 05 s em
quatro dias, e cerca de dois minutos do salto vieram só dessa mudança. O benchmark da
Poki é 3 minutos de mínimo aceitável e 5 de jogo que dá certo — e o cartão a cada fase
cobrava cinco segundos de parada mais um clique, cento e sessenta vezes.

Quatro coisas que esse fluxo precisa respeitar:

- **O intervalo comercial termina antes de `startLevel`, e passa pelo funil da classe.**
  `startLevel` dispara `measure('level', N, 'start')`, e a Poki não aceita evento nenhum
  dentro de um intervalo — por isso o `await this.commercialBreak()` mora em
  `advanceLevel()`, antes da troca de cena. E é `this.commercialBreak()`, não
  `poki.commercialBreak()`: o direto pularia a carência de `FASES_SEM_INTERVALO`.
- **O vídeo de dobrar prêmio não cabe no selo.** A Poki exige um botão padrão de tamanho
  igual ou maior ao lado do vídeo, e um par de botões sobre a cena é o cartão de volta.
  Então `#winDouble` continua só no cartão — ou seja, no fim de cada mundo. É o custo
  desta mudança, e a régua de quanto ele custa é o tamanho do mundo em `WORLD_SIZES`.
- **O selo não repete as estrelas.** A fileira do HUD já acende durante a jogada, e o kit
  do mundo decide se ela fica em cima ou embaixo; uma fileira própria no selo era o mesmo
  recado duas vezes, às vezes colado nela.
- **O HUD fica fora do ar da celebração até a fase seguinte.** `hideBonusCounter(false)`
  esconde a contagem sem devolver `gameBack` e `gamePause`; quem os devolve é o
  `hideBonusCounter()` de `startLevel`. `pauseLevel()` também recusa enquanto
  `pendingWin`, `flowTimer` ou `advancing` estiverem de pé — senão `Escape` entrava por
  trás dos botões desabilitados.

`flowLevels = false` é o que mantém o `playsweep` medindo uma fase por vez. Quem cobre o
caminho do fluxo é o `sdkcheck`: ele joga a fase 1 (a 2 tem que entrar sozinha) e a 20
(o cartão tem que voltar), e reprova se algum dos dois se inverter.

### Renderização

Canvas 2D. Cada combinação de forma, material e tema vira um sprite desenhado uma vez
fora da tela, com o brilho embutido; cada quadro é `drawImage` sob transformação
(`render/sprites.js`). **Isso só funciona porque o zoom é fixo durante a fase** — o
cache é remontado em `GameScene.refit()`, que roda no resize e ao carregar a fase.

O material é um **estilo de pintura**, escolhido em `lookFor()` (`render/sprites.js`).
São cinco, e cada um existe porque um material precisava dele:

- `toon` — corpo chapado, faixa escura na metade de baixo, triângulo de luz e contorno
  fino. É o padrão (madeira, bloco).
- `toon-cel` — três faixas (luz, meio, sombra) e um quadradinho de brilho: pedra.
- `toon-hq` — contorno mais grosso com um filete claro logo por dentro, que lê como
  chapa polida: metal e obsidiana.
- `gelatina` — corpo quase transparente com miolo claro e um reflexo oval: gelo,
  vidro, cristal, cera, espuma e borracha.
- `glow` — o tubo de neon dos **mundos 1 (puzzle) e neon**, copiado do jogo de
  referência medindo a foto pixel a pixel.

**O contorno é a própria peça, um passo adiante** (`contorno()` em `sprites.js`), e não
uma tinta preta cravada: peça clara escurece 46%, peça já escura **clareia** 34%. A
inversão não é enfeite — sem ela a obsidiana, que é o corpo mais escuro da paleta e é
justo a peça que não se move, ficava um borrão preto com moldura preta em volta. Numa
paleta viva o preto passava; no papel e no rústico a torre lia como uma grade preta com
cor dentro, e o que se via primeiro era a linha, não a peça.

A largura também é **fina de propósito**: 0,046 de célula no `toon`, 0,042 no `toon-cel`
e 0,044 no `toon-hq`. No `toon-hq` a linha e o filete vão **por dentro do recorte**, do
mais largo para o mais estreito — um traço de largura 2L cobre L para dentro. Antes o
filete claro era pintado antes do contorno, na mesma linha de centro e com menos da
metade da largura: o contorno o cobria inteiro, e o estilo da chapa polida era só um
`toon` de tinta mais grossa.

O peso é do **tema**, não do estilo: `traco` (`themes.js`) multiplica a largura do
contorno nos três estilos de tinta e na borda da TNT, e vale 1 quando ausente. Hoje
nenhum tema pede diferente — o campo existe para um cenário que precise de mais ou
menos linha sem mexer nos outros catorze. `traco` afina só a linha, nunca a silhueta,
então nada do encaixe muda.

O `glow` **não é uma borda dupla**, embora pareça: o que se vê na referência é um
fio vivo, uma faixa escura fina logo por dentro dele, um brilho que decai para o
miolo, e um **vão de fundo entre uma peça e a vizinha** — a "segunda linha" era a
borda da peça de baixo. Perfil medido, em frações de célula (a célula tinha 107 px
na foto):

| profundidade | o que é | valor |
|---|---|---|
| 0 – 0,055 | vão, fundo puro | as peças não se encostam |
| 0,055 – 0,102 | fio vivo | cor cheia, 0,047 de espessura |
| 0,102 – 0,130 | faixa escura | a própria cor a 27%, não preto |
| daí para dentro | miolo | 19% da cor sobre 50% do fundo |

Quina: raio de 0,055 na borda visível — bem mais dura do que parece de olho.

A referência ainda tem um **halo por fora e um brilho difuso para dentro** (pico em
51% da cor, decaindo até ~0,29 de célula). Os dois foram medidos, implementados e
depois **removidos a pedido do Evandro**: na tela grande o borrão comia a quina e a
peça perdia a forma. Se voltarem, são dois passes de `shadowBlur` — um antes do
recorte, outro logo depois do preenchimento do miolo.

Tudo sai de traços concêntricos dentro do recorte: um traço de largura L cobre de 0
a L/2 para dentro, então pintar do mais largo para o mais estreito empilha as
faixas na ordem certa. O vão vem por último e **fora do recorte**, em
`destination-out`: ele apaga de `vao` para dentro e de `vao` para fora, e é a parte
de fora que importa — sem ela o núcleo duro do halo pintava uma linha cheia dentro
do vão da peça de baixo, e duas peças vizinhas viravam uma só com borda dupla.
Deslocar o caminho para conseguir as faixas não funciona num poliminó: em quina
reentrante o deslocamento se cruza sozinho.

Duas armadilhas já pagas no `glow`:

- **O vão tem que ser aberto fora do recorte.** Dentro dele, o apagador herda a
  mesma borda serrilhada do recorte que acabou de pintar, e as duas meias
  coberturas não se cancelam: sobra um fio de um pixel exatamente em cima da
  silhueta, em volta de toda peça.
- **O realce (dica e peça sob o ponteiro) entra por dentro da silhueta**, na
  geometria do tubo (`TUBO` em `sprites.js`), e sem sombra. Desenhado por fora
  com a quina do tema — 0,28 contra os 0,11 do tubo — ele virava uma moldura
  solta e borrada em volta da peça. A cor do realce é a da própria peça acesa
  (`pieceHighlight`), não a cor de destaque do tema: pintar de magenta fazia a
  torre perder o arco-íris justamente na hora de escolher qual quebrar.

O miolo é translúcido de propósito (50% do fundo passa). Opaco demais a torre vira
um bloco de cor; transparente demais duas peças vizinhas viram a mesma mancha — o
que separa as duas é o fio, não a opacidade.

No mundo puzzle a cor do fio não vem do material: cada peça sorteia uma das sete cores
da marca pela posição de origem (`PUZZLE_BLOCK_COLORS`), que é o que dá o arco-íris da
torre. Por isso a posição entra na chave do cache de sprites — sem ela, todas as barras
iguais sairiam da mesma cor.

A **bomba** é desenhada inteira dentro de **uma célula**, a mais próxima do centro da
peça (`paintBombMark`). Desenhada no centro geométrico e grande o bastante para o pavio
passar da silhueta, ela só ficava certa quando a bomba era a peça do topo: em qualquer
outra a vizinha de cima cobria o pavio e sobrava uma bola preta sem nada. O corpo da
peça é vinho, não preto neutro — obsidiana é fria, bomba é quente.

A TNT ganha listras diagonais em qualquer tema (`hazardStripes` em `sprites.js`),
porque só a cor não separava a TNT laranja da madeira âmbar — e confundir as duas
custa a fase. O gatilho é o material que quebra por pancada **e** explode, que é só a
TNT: a bomba espera o dedo do jogador e o vidro não espalha nada.

### O hexágono e seus modelos

`src/render/hexmodels.js` separa o **estilo de construção** do hexágono da cor, como
`lookFor()` faz com as peças. `paintHexModel(ctx, cx, cy, r, modelo, cores, glow)`
tem onze modelos (`liso`, `cristal`, `neon`, `placa`, `nucleo`, `gema`, `favo`,
`vidro`, `origami`, `ouro`, `selo`); a vitrine deles é `prototypes/hexagonos.html`,
que desenha com a mesma função, sobre os mesmos temas e as mesmas cores de skin.

**A silhueta é a mesma em todos os modelos** — seis vértices em `(PI/3)*i`, topo e
base planos. Ela está copiada em dois lugares independentes: `physics/world.js:301`
(o polígono do corpo rígido) e `hexPath()` em `hexmodels.js`, de onde sai todo o
desenho — jogo, loja e vitrine. Um modelo que mudasse a silhueta faria o jogador ver
a peça encaixar num canto que fisicamente não existe, e invalidaria o balanceamento
de todas as fases já validadas. A variação vem do miolo, das arestas, do ornamento e
do brilho.

**A skin escolhe o modelo**, no campo `model` de `SKINS` (`game/content.js`); ausente
vale `liso`. `Sprites.hexagon()` não desenha mais hexágono nenhum: chama
`paintHexModel` com a cor da skin — ou a do tema, quando a skin não define a sua — e
carimba `skin.mark` por cima, porque a marca é ornamento **sobre** o modelo, não parte
dele (o circuito e o véu da Aurora continuam valendo em qualquer construção). O Ouro
**não tem mais marca**: o anel branco que havia ali era um círculo no meio de uma peça
de seis lados e brigava com a varredura de luz do modelo — o que se via era o círculo,
não o metal. A vitrine
da loja (`paintSkinSwatch` em `main.js`) chama o mesmo pintor com o mesmo modelo, no
tema corrente: o cartão mostra exatamente o que vai para a fase.

Antes disso o jogo desenhava o `liso` para as oito skins e o cartão da loja era um
quadrado arredondado com o azul do tema neon cravado — a skin "Original" aparecia azul
mesmo no mundo puzzle, onde o hexágono é amarelo, nenhuma tinha forma de hexágono, e a
loja vendia cor.

A distribuição atual: `classic → liso` (o hexágono de sempre, para quem nunca entrou na
loja não ver nada mudar), `ember → nucleo`, `mint → vidro`, `violet → cristal`,
`gold → ouro`, `circuit → placa`, `aurora → gema`, `shadow → selo`. Sobram `neon`,
`favo` e `origami` sem skin — cada um é uma entrada nova em `SKINS`, nada mais.

### A tela de fases

É uma **fita**: uma rolagem só, mas cada mundo é uma faixa com a própria pele. A faixa
recebe as variáveis `--w-*` do seu tema por `paintWorld()` (`main.js`), e o fundo da
tela é fixo e escuro.

Isso resolve o defeito que a fazia parecer amadora: o mapa herdava as variáveis de
`applyUiTheme()`, que só roda ao carregar uma cena — ou seja, a tela inteira era
pintada com a paleta da **última fase jogada**. Vindo do mundo puzzle, que é claro,
saía branco sobre branco.

Quatro decisões que valem a pena manter:

- **O cabeçalho da faixa fica embaixo** (`flex-direction: column-reverse`). A fita é
  lida de baixo para cima — progredir é subir —, então o nome do mundo tem que estar
  na entrada dele, não depois de o jogador já ter passado por tudo.
- **Mundo fechado é cartaz, não parede.** Antes os quinze mundos montavam sempre ~150
  botões e os travados só ganhavam opacidade. Agora um mundo fechado vira uma faixa
  de arte com selo, e o portão logo abaixo é quem diz quantas estrelas faltam — dizer
  nos dois é ruído.
- **Fase ainda não alcançada mostra o próprio número**, apagado. Dez cadeados iguais
  em fila não dizem para onde se está indo.
- **O portão carrega o céu do mundo que protege.** Com fundo escuro fixo, a tinta
  clara dos temas claros (clássico, doce, papel) ficava ilegível sobre ele.

`nodeSpot(i, n)` recebe o tamanho do mundo: o número de ondas da serpentina acompanha
`n`, senão o mundo 1, com vinte fases, viraria uma cobra esticada. A altura da trilha
sai de `--nos` pela mesma razão.

O cabeçalho fixo diz em que mundo a rolagem está (IntersectionObserver em
`watchMapWorlds`), e o atalho `#mapHere` só aparece quando o nó atual saiu da tela.
Atenção: `#s-map > *` tem `position: relative` e vence `.map-here` por
especificidade — por isso a regra do atalho é `#s-map > .map-here`.

### Tema na interface

`applyUiTheme()` (`src/render/uitheme.js`) leva a paleta do tema da fase para variáveis
CSS a cada `scene.load`. Três temas (classic, candy, paper) pedem interface clara: a
polaridade vai em `data-ui` no root, e superfícies usam `var(--wash)` em vez de branco
cravado. `.btn.ad` fica fora do tema — a Poki exige que o botão de vídeo seja constante.

Além da paleta, o mundo escolhe um **kit** de cromado (`render/uikit.js` → `data-kit` no
root): `atelier`, `hexdeck`, `ficha` ou `queda` mudam o botão primário, o cartão de fim
de fase e onde ficam as estrelas do HUD. São quatro e não oito porque o kit é a cara de
uma família de mundos, não da fase. O kit muda o cromado, nunca o que cabe na tela: em
paisagem baixa a regra de `@media` recoloca as estrelas no canto para qualquer kit.

Dois desses kits — `ficha` e `atelier` — pintam o cartão modal (pausa, ajustes, fim de
fase) **escuro venha de que mundo vier**, e por isso o cartão sai da polaridade de
`data-ui`: num tema claro `--ink` é tinta escura, e era assim que o cartão de pausa do
mundo doce mostrava "DOCE · NÍVEL 48", "Toques 0 · Meta 10" e os dois interruptores em
roxo sobre verde-escuro, ilegíveis. O cartão **reabre as próprias variáveis**
(`--ink`, `--ink-soft`, `--panel`, `--edge`, `--wash`, `--starOff`, `--accent2`) em vez
de acertar cor por elemento: tudo que mora dentro dele já pedia essas variáveis e passa
a ler os valores certos de uma vez.

O feltro desse cartão vem do **tema**, não de uma cor cravada: `applyUiTheme()` emite
`--felt` e `--felt-deep` a partir do véu do mundo (`lift()`, com ganho e piso — o véu
cru deixaria o cartão do mundo lava quase preto). Antes o verde de cassino da `ficha`
aparecia inteiro por cima do céu rosa do mundo doce. A borda é `var(--gold)`, a mesma
cor da estrela do mundo: o cromado continua sendo o do kit, a cor passa a ser a do
mundo. Como o feltro nasce do véu, atrás de um cartão de feltro o véu fecha mais
(0,9 em vez de 0,72) — senão o cartão e o fundo ficariam no mesmo tom e só a borda
dourada os separaria.

O **botão primário de cada kit é um degradê da cor do mundo**, não uma cor chapada:
`applyUiTheme()` emite `--accent-lite`/`--accent-vivid` (o acento com L e S subidos por
`vivid()`, em HSL — misturar com branco clareia mas lava a cor), `--gold-lite`/
`--gold-deep` e `--on-accent`, que resolve a tinta do texto por luminância. O cobre
chapado que o `atelier` usava parecia o botão secundário da dupla ao lado do azul do
vídeo, justo na hora em que "próxima" é o que o jogador quer acertar.

A tela inicial é um **carrossel de mundos** — a cena de fundo é uma fase real do mundo em
cartaz, e deslizar (ou tocar nas bolinhas) troca de mundo entre os já abertos. O rótulo
do botão de jogar sai de `buildHomeWorlds()`, junto com as bolinhas, e não de
`refreshScreen()`: deslizar não passa por lá, e o botão prometia uma fase e abria outra.

### Materiais que cedem com o tempo

`crystal` e `wax` têm `holdTime`: cedem depois de N segundos **com o hexágono apoiado
em cima**, contados em `PhysicsWorld._updateHoldTimers`. Três invariantes:

1. **`holdTimer` entra em `snapshot()`/`restore()`.** Sem isso o solucionador vaza tempo
   entre os ramos que simula, a prova de que a fase é vencível fica falsa, e no jogo
   `requestHint()` — que roda sobre o mundo real — envelheceria a peça sob o jogador.
2. **`everythingAtRest()` retorna false enquanto algo carrega.** Senão o validador toca
   antes de o tempo passar e certifica uma fase que na prática não existe.
3. **`holdTime` tem que caber em `2 × holdTime × 60 + 120 < 420`**, o teto de
   `MAX_SETTLE`. Daí o limite de 2,5 s, documentado em `materials.js`.

A bandeira `_hasHold` desliga toda a varredura em fases sem esses materiais, o que
mantém as fases antigas idênticas passo a passo.

`tnt` não precisou de campo novo: `breakSpeed` + `explodeRadius` já compõem "detona com
pancada forte". A cera só é sorteada no mundo lava, por peso em `levelConfig`, e não por
uma bandeira no `LevelLayout` — assim `PhysicsWorld` segue sem conhecer tema.

### Duas versoes: Poki e lisa

O alvo do build entra por `VITE_PLATAFORMA` e vive em `src/core/platform.js`.
`poki` (padrao, sai em `dist/`) carrega o SDK, mostra intervalo comercial e oferece
os videos recompensados. `lisa` (`npm run build:lisa`, sai em `dist-lisa/`) nao tem
plataforma nenhuma — e a versao para hospedar em qualquer lugar.

O que muda na versao lisa:

- **O carregador do Poki SDK sai do HTML**, removido no build pelo plugin
  `semPlataforma` em `vite.config.js`. Nao basta o wrapper se virar sem SDK: o
  arquivo publicado nao pode nem *pedir* o script, senao a versao lisa continua
  fazendo requisicao externa e dependendo de um dominio de terceiro para carregar.
- **`sdk()` devolve `null` e `commercialBreak`/`rewardedBreak` saem na primeira
  linha** (`src/poki.js`), entao nada espera por um anuncio que nao vem.
- **Todo botao de video some**, por uma regra so:
  `html[data-plataforma='lisa'] .btn.ad { display: none }`. Ao lado de cada um
  deles ja existia o caminho padrao — a Poki nunca deixou o video ser a unica
  rota —, entao nada fica inalcancavel. Na loja o botao de assistir nem chega a
  ser criado, e o subtitulo passa a mostrar o preco em moedas.
- `tools/verify-build.mjs` reconhece a versao lisa pela ausencia do carregador e
  **inverte a exigencia**: em vez de cobrar o script da Poki, cobra que nao exista
  script externo nenhum. A pasta conferida sai de `DIST_DIR` (padrao `dist`).

`sdkcheck`, `audiocheck` e `playsweep` continuam valendo para a versao Poki, que e
a que precisa passar na QA.

### Poki

`src/poki.js` é um wrapper blindado. O script v2 da Poki é só um carregador, sem
`onerror` nem timeout: com bloqueador de anúncios o core nunca chega e as promessas
ficam pendentes para sempre. Por isso toda chamada passa por `withTimeout` e por uma
guarda de existência, e **o jogo se comporta igual nos dois casos, sem jamais
mencionar bloqueador de anúncios**.

Regras de evento que `tools/sdkcheck.mjs` cobra:

- `gameLoadingFinished` exatamente uma vez;
- `gameplayStart` só no primeiro toque real do jogador, nunca no carregamento;
- `gameplayStop` em toda interrupção (pausa, menu, fim de fase, intervalo);
- nenhum evento durante um intervalo, nenhum par repetido em sequência, nunca
  `complete` e `fail` na mesma tentativa;
- `commercialBreak` só ao sair de uma parada natural rumo ao jogo, e sem cooldown
  próprio — a frequência é decisão da Poki;
- **nenhum intervalo antes de o jogador vencer `FASES_SEM_INTERVALO` fases**
  (`main.js`, hoje 5), e o intervalo de volta depois disso. A frequência é da Poki,
  mas o começo é nosso: com o intervalo liberado desde a fase 1 o anúncio chegava
  justo quando o jogador ainda decidia se o jogo valia a pena, e ele saía ali. Conta o
  progresso salvo (`unlocked`), não a sessão. Todo intervalo passa por
  `Game.commercialBreak()`; chamar `poki.commercialBreak()` direto pula a carência.
  O `sdkcheck` joga a fase 1 com perfil novo, e depois ergue o `unlocked` para ver o
  intervalo acontecer — sem esse segundo trecho ele não veria intervalo nenhum e as
  regras de ordem acima passariam sem conferir nada.

No cartão de derrota o vídeo é **pular fase**, ao lado de "tentar de novo", que é
maior e gratuito. Pular não dá estrela, então o portão do mundo seguinte continua
cobrando o que cobrava: o vídeo adianta o caminho, nunca o progresso. **Não existe
botão de encher corações** — eles voltam sozinhos com o tempo e, sem eles, o jogador
continua jogando com metade do prêmio.

Na versão lisa `.btn.ad` some por CSS, então lá o pular vira botão comum liberado
depois de três derrotas, e o bônus diário sai sem vídeo. Quem decide a classe é o JS
(`skip.classList.toggle('ad', COM_ANUNCIOS)`), e não o HTML: com a classe cravada no
markup, o botão de bônus diário apagava o rodapé inteiro do mapa na versão lisa.

Vídeo recompensado só por escolha explícita do jogador, sempre ao lado de um botão
padrão de tamanho igual ou maior, e a recompensa só vale quando o retorno é
estritamente `true`. Nada de vídeo como condição para progredir: os corações são
"suaves" — sem corações o jogador continua jogando e só ganha metade das recompensas
(`game/progress.js`).

### O que `tools/verify-build.mjs` reprova

Reflete a QA da Poki e roda sobre `dist/`:

- qualquer URL externa que não seja `game-cdn.poki.com` (nada de fontes do Google, CDN
  de biblioteca, nenhuma nova dependência de rede);
- `console.log` sobrando em qualquer JS do build;
- source map publicado, `setDebug(true)`, link de saída, `viewport-fit=cover` ausente;
- não carregar com bloqueador de anúncios ativo ou com `localStorage` lançando exceção
  — `core/storage.js` é o único módulo que toca `localStorage` e já cai para memória;
- canvas não cobrir a janela em 640x360, 836x470 e 1031x580;
- build acima de 5 MB comprimido.

`window.__game` e `window.__audio` são expostos no fim de `main.js` só para essa
automação; `playsweep.mjs` depende deles.

### Desktop

A roda do mouse é barrada em `core/input.js` para a página não andar dentro do frame da
Poki — mas **passa quando há lista rolável sob o ponteiro** (`rolavelSob`). Sem essa
exceção o mapa e a loja ficavam presos no desktop: sem dedo para arrastar, a roda é a
única forma de rolar a fita de fases. `ctrl+roda` continua barrado sempre, que é o zoom
do navegador.

A barra de rolagem da fita é escondida no celular e **visível onde o ponteiro é fino**
(`@media (pointer: fine)`): no desktop ela é a única pista de que há mais mundos abaixo.

Em tela larga (`min-width: 760px` e paisagem) a faixa de cima da home vale a **tela
inteira**, não os 430px da coluna: corações, moedas e engrenagem vão para os cantos, que
é onde se procura por eles. O resto da home continua na coluna, e a logo continua
seguindo a regra de paisagem baixa — em 16:9 ela sozinha cobre a torre.
