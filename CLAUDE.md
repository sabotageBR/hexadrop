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
npm run levels                                   # 100 fases, um worker por núcleo
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
de mundo: vinte mundos de cinco fases, 100 fases, 300 estrelas. Dele saem
`LEVEL_COUNT`, `WORLD_COUNT`, `worldOf()`, `worldStart()`, `worldSize()` e
`indexInWorld()`, e é por essas funções que todo mundo pergunta — **nunca por `/5`,
`% 5` ou `w * 5`**. O `10` da época de dez fases por mundo esteve literal em dezenove
lugares de cinco arquivos, e enquanto esteve bastava esquecer um para o mapa abrir uma
fase e o portão cobrar outra. O trecho de ensino de `levelConfig()` vai até
`fimDoTutorial = worldStart(2)` (a fase 10), e não um número cravado.

**Os cenários rodam em ciclo.** `WORLD_THEMES` lista os nove temas uma vez, e quem
pergunta o tema de um mundo usa `worldTheme(w)`, que é `w % 9`: o mundo 10 volta ao
puzzle e o 20 é o classic. O índice direto deixaria os mundos 10 a 20 sem tema, e o
`THEMES[theme].label` de `main.js` quebraria a tela.

O jogo já teve quinze mundos de dez fases, e antes disso um mundo 1 de vinte. Dois
funis da Poki guiaram as trocas:

- **1.0.1, 719 partidas.** A perda de uma fase para a seguinte era **exatamente** a
  fração que não concluía a fase (`gameplays(N+1) ≈ gameplays(N) × completed%(N)`, erro
  abaixo de 2% nas dezenove transições). O que matava o tempo de sessão era cada fase
  durar dez segundos — média de 4,7 toques nas vinte primeiras.
- **1.0.2, 265 partidas.** A mesma lei, e quem saía nas fases 1 a 6 saía **no meio da
  fase sem ter perdido**: falha de 2% a 7%, abandono de 5% a 11%; na fase 1 saíram 11%
  e só 2,3% perderam. Não era muro, era tédio — torre de 6x6 de bloco com pedestal de
  1,9 vez a torre, que se vencia tocando ao acaso. Daí os mundos de cinco (cenário novo
  a cada cinco fases), tudo estreando até a fase 10, borracha no mundo 1, pedestal
  estreito e torre mais alta.

**Altura é a alavanca do tempo de fase; pedestal e altura decidem o perdão.** Medido
com seis colunas, sobre o pedestal largo antigo:

| altura | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|
| toques | 4,7 | 4,8 | 5,9 | 7,2 | 8,9 | 9,7 | 9,8 |
| melhor perdão de dez | 1,00 | 1,00 | 1,00 | 1,00 | 1,00 | 1,00 | 0,50 |

E com borracha, seeds sem filtro:

| torre | pedestal | perdão | competente vence | toques |
|---|---|---|---|---|
| 6x6 | 1,9x | 0,75 | 5 de 6 | 6,8 |
| 6x8 | 1,5x | 0,33 | 4 de 6 | 9,8 |
| 6x12 | 1,5x | 0,17 | 4 de 6 | 13,3 |
| 6x14 | 1,2x | ~0,12 | 2 de 4 | 13,5 |
| 6x18 | 1,2x | 0 | 1 de 4 | ~20 |

Borracha contra bloco mede quase igual em 6x14: quem tira o perdão é altura e pedestal.

**A torre para em 18 linhas**, e não nas ~35 da fase 27 do jogo de referência. Uma
torre de 35 fica de pé sozinha, mas o jogador competente do solucionador não vence
nenhuma de 24 ou 32 linhas, e cada partida simulada ali custa de 8 a 13 s. A rampa: 8
linhas na fase 1, 12 na 10, 14 na 20 e na 27, 17 na 50, 18 da 70 em diante; a fase
final de cada mundo ganha **uma** linha. Em **cinco** colunas a mesma altura perdoa bem
menos — 5x13 mediu 0,17 de perdão máximo —, então o trecho de ensino é todo em seis
colunas e, a partir da fase 51, a chance de cinco colunas volta a 30%.

**O pedestal** vai de 1,5 vez a largura da torre (fases 1 a 5) a 1,3 (6 a 10), 1,1 (11
a 25), 1,0 — a largura da torre, como na referência — (26 a 50) e 0,92 (51 a 100). Nas
dez primeiras fases ele já foi 1,9 vez a torre.

**Torre grande não basta: `minPar` é o piso de toques.** O validador escolhe a
variante mais próxima do *alvo de perdão*, e nada nesse critério olha para o tamanho
da solução — numa torre de dez linhas ele pode ficar com a seed que desaba em três
toques, que é exatamente a fase de dez segundos. O piso é
`min(8, max(3, round(rows * 0,6)))`: folgado de propósito, porque 6x10 entrega 8,9
toques na média, e com teto em 8 porque torre alta sobre pedestal estreito já recusa
muita seed por si, e pedir mais ali só obrigaria a afrouxar. `softenConfig` reduz o piso junto com a torre e
o zera no degrau 3, onde o objetivo já é só a fase existir.

**As três primeiras fases são roteiro, não ponto da curva** (`PRIMEIRAS_FASES` em
`levelgen.js`, aplicado por cima da curva). Elas fixam a torre — 6x8, 6x8 e 6x9 de
borracha —, as barras e duas exigências que só o gerador lê: `minPieces` (10: nada de
torre só de barras) e `minPar` (4). O roteiro já exigiu `minForgiveness: 1`, toda
partida ao acaso vencendo, e foi exatamente isso que o funil da 1.0.2 condenou; hoje o
perdão delas sai da faixa comum, que abre em 0,5. Toda fase da régua de perdão (1 a
25) tem orçamento de seeds seis vezes maior e joga as políticas ingênuas duas vezes
cada.

`GATE_STARS` (`game/content.js`) tem uma entrada por mundo e foi re-escalado pela
mesma fração do que já estava disponível em cada ponto, para o aperto percebido
continuar igual ao da primeira versão. Cada mundo vale 15 estrelas, e o último portão
pede 275 das 300. O portão **não** é um gargalo de retenção: toda vitória cruza as
três linhas de estrela, então duas fases já abrem o mundo 2 — e com o fluxo contínuo
até a fase 100 ele nem para o jogo corrido: vale para quem escolhe o mundo no mapa ou
na home.

### A peça que define cada mundo

`THEME_MATERIALS` (`levelgen.js`) dá a cada tema `{ base, apoio, assinatura, teto }`.
A `base` é a peça dominante da torre; o `apoio` a sustenta e assume enquanto a base
ainda não estreou; a `assinatura` é o material que aquele cenário empurra para frente.

Antes disso `baseMaterial()` devolvia **madeira para catorze dos quinze mundos**:
trocar de mundo trocava o céu e a paleta, nunca a peça. Medido sobre as seeds
aprovadas, o mundo 2 inteiro era 68% madeira, 27% pedra e 5% obsidiana. O mundo 1
escondia o problema porque a base do tema puzzle sorteia sete cores da marca pela
posição na grade — sai do mundo 1 e o arco-íris acaba.

**O puzzle é de borracha**, e não mais de bloco: o jogo começa nele, e a torre de bloco
das primeiras fases era a que se vencia tocando ao acaso. A borracha quica e agarra. O
arco-íris continua: `arcoIris()` em `render/sprites.js` pinta a base do puzzle, bloco
ou borracha, com as cores da marca — sem isso a torre do mundo 1 sairia inteira no
verde-limão do traço da borracha.

Duas regras que nasceram de medição:

- **`teto` limita bases frágeis.** Gelo tem atrito 0,09 e vidro quebra por pancada:
  uma torre feita quase só deles é um escorregador que o validador só aprova no degrau
  3 de afrouxamento — o degrau que apaga toda a variedade. Onde há teto, os outros
  pesos encolhem em vez de a base inflar.
- **O degrau 3 usa `baseMaterial(theme, level, true)`**, que troca base frágil pelo
  apoio. Ali o objetivo é só a fase existir, e um degrau 3 feito de gelo sairia mais
  difícil que o original.

**Tudo estreia até a fase 10** — `MATERIAL_DEBUT` (`physics/materials.js`) para as
peças e `HAZARD_DEBUT` (`levelgen.js`) para as mecânicas que não são material:

| fase | estreia |
|---|---|
| 1 | borracha (a base do mundo 1) |
| 4 | pedra e gelo |
| 5 | obsidiana |
| 6 | vidro e metal |
| 7 | bomba e espuma |
| 8 | cristal e pedestal que balança |
| 9 | TNT |
| 10 | cera e vento |

A regra antiga — cada material estreia no mundo anterior àquele em que vira dominante —
espalhava as estreias pelo jogo inteiro (a TNT só na fase 81), e o jogador do funil ia
embora antes de ver novidade. Três consequências que precisam continuar valendo:

- **A fase de estreia não encolhe.** Ela perdia duas linhas e um tier; com uma estreia
  por fase isso desfaria a torre maior. No lugar, a novidade aparece com certeza:
  obsidiana, bomba e TNT valem 1 sem sorteio (antes a fase 81 anunciava "TNT!" sem ter
  TNT), o material de peso sobe para peso 4, o gerador recusa a seed em que ele não
  aparece, e `softenConfig` devolve a estreia depois de afrouxar.
- **Cada torre leva no máximo dois extras** (três a partir da fase 50) além do kit do
  tema, e a estreia conta entre eles. Com tudo disponível desde a fase 10, sem esse
  limite toda torre sortearia os onze materiais e a base cairia para um quinto das
  peças — o fim da peça que define o mundo.
- **O cartão do tutorial mostra todas as estreias da fase, em fila** (`showTutorial`
  em `main.js`). As fases 1 a 3 continuam com os textos fixos de toque, objetivo e
  estrelas, e por isso as estreias com cartão começam na 4.

Depois da estreia, pedestal que balança e vento aparecem em uma fase de cada cinco,
subindo até uma em duas, e nunca os dois juntos antes da fase 30.

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
- **O orçamento de seeds é adaptativo.** O laço para assim que a faixa tem quatro
  variantes; passado o orçamento base, ele prorroga até quatro vezes esse valor,
  perseguindo a **contagem** e não a faixa — encher a faixa é preferência, ter quatro
  layouts é o que o jogador percebe.

  Sem isso, 67 das 160 fases da versão anterior saíam com menos de quatro variantes e
  treze com **uma só** — e fase de variante única é fase em que todo jogador pega o
  mesmo layout, sem nada a sortear e sem o botão de embaralhar. Foram exatamente elas
  que apareceram no funil: a fase 23, de variante única, reprovou 42% das tentativas, e
  a 40, de duas, 41%, contra 3% a 9% das fases vizinhas.

  A prorrogação tem três freios, e os três são de medição. Ela para quando o degrau
  aceitou **zero** variantes com o orçamento base (aí o problema não é sorte de seed, é
  a configuração, e insistir só adia o afrouxamento). Ela vale **só no degrau 0**, que é
  onde a fase ainda pode sair certificada — sem essa restrição uma única fase de doze
  linhas segurou a geração por mais de doze minutos sozinha. E a triagem ganhou um corte
  exato do `minPar`: como `par` é o *mínimo* de toques entre as partidas vencidas, uma
  triagem que já venceu com menos toques que o piso condena a seed sem gastar a
  avaliação completa, que são dez a quinze rollouts. O relatório do gerador lista as
  fases magras e as de variante única.

  Na mesma conta entra a **ordem dentro de `evaluateVariant`**: as partidas ao acaso,
  que medem o perdão, rodam depois de `smartWins` e da perturbação, e não antes.
  `accepted` é `smartWins >= minSmartWins && robust`, e o perdão só é lido de uma
  variante aceita — medindo primeiro, toda seed reprovada pagava de três a seis
  rollouts à toa, e os ingênuos são os mais caros do conjunto porque uma política que
  não encerra a fase toca até acabar o que há.

`src/game/solver.js` serve aos dois lados: prova a jogabilidade no validador e escolhe
a peça destacada quando o jogador pede dica no jogo.

### A rampa de dificuldade, e as duas réguas

Antes disto só as fases 1 a 3 exigiam algo do validador; da quarta em diante ele ficava
com a primeira seed que um jogador competente vencesse. Medida, a dificuldade não era
rampa, era serrote — e em vários trechos andava para trás. Os números abaixo são da
numeração antiga, quando o mundo 1 tinha vinte fases:

- a fase 12 perdoava 83% das partidas ao acaso e a 13, ao lado, perdoava 17%;
- a fase 21 perdoava 83% e a 22 perdoava 8%, na virada do mundo 2;
- as fases 19 e 20 perdoavam 8% ainda dentro do mundo do tutorial;
- as fases 40 e 50 perdoavam **zero**: tocando ao acaso não se ganhava nunca;
- o mundo 4 (21%) era mais difícil que o 5 (29%), como o 12 (5%) que o 13 (11%).

Hoje cada fase carrega uma **faixa** `[piso, teto]` e um **alvo**, calculados em
`levelgen.js`. O piso é exigência: seed abaixo dele é recusada. O teto é preferência: o
laço só para quando há variantes suficientes dentro dele, e o desempate escolhe as mais
próximas do alvo. Teto sem piso deixa a curva subir a esmo — medido, uma fase de piso
50% saiu com 96%. Piso sem teto deixa o começo mais fácil do que era. **Escolher a
variante de menor perdão, em vez da mais próxima do alvo, também não serve**: onde o
piso é zero ele puxa a fase para o fundo do que foi sorteado, e a curva que devia fechar
em 13% fechava em 2%.

As curvas são retas em escala **logarítmica**, não em perdão: rampa linear de
dificuldade é taxa constante. Reta em perdão poria a fase 80 em 0,54 quando o jogo
entrega 0,16 ali, e um piso desses no fim obrigaria o validador a afrouxar quase tudo.

**São duas réguas, e cada uma vale onde ela mede** (`SMART_RULER_FROM`, que é
`worldStart(5)` — a fase 26, e não um número cravado):

- **Perdão** (vitórias de um jogador tocando ao acaso) nas fases 1 a 25, de 0,5 a 0,12.
  É a régua que importa onde a retenção se decide. Já abriu em 1,0 — e o funil da 1.0.2
  mostrou o jogador saindo no meio da fase 1 sem ter perdido.
- **Taxa do jogador competente** da fase 26 em diante. O perdão satura ali: a torre
  passa de 14 linhas, o pedestal encosta na largura da torre e toda peça especial já
  estreou. Na versão de 150 fases a mesma saturação só chegava no mundo 8, e no mundo
  15 seis das dez fases tinham *todas* as variantes em zero. A curva não descia porque
  o jogo endurecia, descia porque a medida acabava.

Nenhuma fase usa as duas, senão elas se brigam. Nada disso mexe em linha, largura,
material ou pedestal: são exigências de **validador**, não de layout — por isso dá para
regerar um trecho sem invalidar as seeds do resto (`--levels 26-100`).

**O que não fechava na versão de 150 fases**, e deve continuar valendo aqui: os mundos
12 a 15 subiam de volta (competente 48, 58, 50, 61) quando o alvo ali era 43 a 35. O
motivo é que o alvo fica abaixo do que existe: para ser aceita, a variante tem que ser
vencida pelo menos 2 de 6 vezes **e** resistir à perturbação, e as que passam esse filtro
se agrupam acima de 50%. A régua do competente tem pouca amplitude no fim do jogo (47%
a 67%), então uma rampa linear nela é quase plana. Se for para insistir, a medida com
amplitude no fim é **toques da melhor solução** (6,6 a 9,3 naquela versão), e ela também
não é monótona.

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

`stuck` também cobre o hexágono **encalhado** (`hexStranded()`): **tudo o que o sustenta
é imóvel**. O toque destrói peças, nunca as empurra, então parado sobre obsidiana o
hexágono só sai dali se uma explosão o empurrar. A fase acaba assim que ele dorme com
apoio só de obsidiana, nada do nível dele para cima ainda se mexe e não há bomba nem TNT
ao alcance da explosão.

`_hexSupport()` só conta como apoio o contato **abaixo do centro** do hexágono: o que
pesa em cima ou encosta acima do meio não o segura, e tirar essa peça não o faz descer.
Um apoio vivo mantém a fase — o jogador ainda pode tirar o chão dele. O repouso exigido
é só das peças da altura dele para cima (`_restAboveHex`), e não o `everythingAtRest()`
global: sobre um pedestal que balança as peças nunca repousam, e o veredito ficaria
preso.

A regra anterior perguntava se alguma peça "ainda o alcançava", e contava **toda** peça
viva acima da base dele, sem limite de altura e com uma folga lateral que cobria a
torre inteira — além de qualquer peça encostada, até a que só pesava em cima. Na prática
o jogador tinha que destruir tudo acima do hexágono para a fase acabar, e como a câmera
segue o hexágono e não rola, a peça que sobrava lá no alto saía da tela e não havia mais
como tocá-la: a fase ficava em `playing` para sempre.

O gatilho continua sendo o corpo do hexágono **dormindo** no Box2D, e não
`hexAtRest()`: meio segundo abaixo de 0,01 m/s contra 0,16, o que impede encerrar a
fase enquanto ele ainda tomba devagar pela quina. Todo toque o acorda (`wakeAround`),
então o relógio recomeça a cada jogada. Como a obsidiana nunca fica nas duas linhas de
baixo, o encalhe típico fecha a fase com uma ou duas estrelas — vitória.

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

### O primeiro carregamento entra jogando

`isNewcomer()` (`game/progress.js`: nenhuma fase liberada além da primeira e nenhuma
partida contada) manda o boot para `startLevel(1)` em vez de `show('home')`. A tela
inicial só existe a partir do momento em que ela tem para onde voltar.

Medido no funil da Poki: de **719 partidas carregadas, 571 chegaram a começar a fase
1** — 21% viram o menu e foram embora sem tocar em nada, quase três vezes a perda de
qualquer fase individual. Das quarenta gravações de playtest da 1.0.1, doze duram menos
de trinta segundos, que é o tempo de ler a tela e desistir. A home pedia que o jogador
entendesse um carrossel de quinze mundos, dois botões secundários, corações, moedas e
patente antes do primeiro toque de jogo.

`gameLoadingFinished()` vem **antes** de entrar na fase: `startLevel` dispara
`measure('level', 1, 'start')`, e um evento de progresso antes do fim do carregamento
inverte a ordem que o `sdkcheck` cobra. O critério olha `plays` além de `unlocked`
porque quem jogou a fase 1 e perdeu continua com `unlocked` em 1 — e para ele a home já
é uma tela conhecida.

### Fluxo contínuo entre fases

**Vencer não abre tela, do começo ao fim do jogo.** `finishWin()` grava o prêmio, a contagem
da celebração sai, um selo entra no lugar dela com o `+moedas` e a linha de bônus, as
moedas voam para o contador `#gameCoins` do HUD, e um segundo depois a fase seguinte
entra atrás de um corte de 200 ms (`.wipe`). Ninguém clica em nada.

`flowContinues()` só para na **fase 100** — nem o fim de mundo abre o cartão de vitória.
Ele ainda aparece na fase final, quando a automação desliga o fluxo (`flowLevels`) e,
claro, na derrota, que não mudou.

A medida vem de um playtest da Poki relatado por outro desenvolvedor: tirando as telas
de "fase concluída", o tempo médio de sessão dele foi de 3 min 49 s para 7 min 05 s em
quatro dias, e cerca de dois minutos do salto vieram só dessa mudança. O benchmark da
Poki é 3 minutos de mínimo aceitável e 5 de jogo que dá certo — e o cartão a cada fase
cobrava cinco segundos de parada mais um clique, cento e sessenta vezes.

O fim de mundo já foi parada, e depois parada só a partir da fase 30 (`FASES_SEM_CARTAO`,
que não existe mais). Na versão em que o mundo 1 tinha vinte fases, a passagem da 20
para a 21 foi o **único** ponto do jogo em que a perda não se explicava por quem deixou
de concluir a fase: pela taxa de conclusão da fase 20 deviam seguir 91 jogadores,
seguiram 77. Os 15% que faltam são o preço de três coisas que aconteciam só ali e todas
juntas — o primeiro cartão em tela cheia do jogo inteiro, o intervalo comercial de
`advanceLevel()` e a troca de tema e de música. Nas outras dezenove transições do mundo
o desvio ficou abaixo de 2%: o fluxo contínuo não perde jogador, a parada perde. Com
mundos de cinco fases o cartão pararia o jogo a cada cinco, e a decisão foi não parar
nunca. O custo é que o vídeo de dobrar prêmio e a encenação do portão saem do jogo
corrido — o vídeo rende 5%, contra os 15% que cada parada custou.

Quatro coisas que esse fluxo precisa respeitar:

- **O intervalo comercial termina antes de `startLevel`, e passa pelo funil da classe.**
  `startLevel` dispara `measure('level', N, 'start')`, e a Poki não aceita evento nenhum
  dentro de um intervalo — por isso o `await this.commercialBreak()` mora em
  `advanceLevel()`, antes da troca de cena. E é `this.commercialBreak()`, não
  `poki.commercialBreak()`: o direto pularia a carência de `FASES_SEM_INTERVALO`.
- **O vídeo de dobrar prêmio não cabe no selo.** A Poki exige um botão padrão de tamanho
  igual ou maior ao lado do vídeo, e um par de botões sobre a cena é o cartão de volta.
  Então `#winDouble` continua só no cartão — ou seja, na fase 100. É o custo desta
  mudança.
- **O selo não repete as estrelas.** A fileira do HUD já acende durante a jogada, e o kit
  do mundo decide se ela fica em cima ou embaixo; uma fileira própria no selo era o mesmo
  recado duas vezes, às vezes colado nela.
- **O HUD fica fora do ar da celebração até a fase seguinte.** `hideBonusCounter(false)`
  esconde a contagem sem devolver `gameBack` e `gamePause`; quem os devolve é o
  `hideBonusCounter()` de `startLevel`. `pauseLevel()` também recusa enquanto
  `pendingWin`, `flowTimer` ou `advancing` estiverem de pé — senão `Escape` entrava por
  trás dos botões desabilitados.

`flowLevels = false` é o que mantém o `playsweep` medindo uma fase por vez. Quem cobre o
caminho do fluxo é o `sdkcheck`: ele joga a fase 1 (a 2 tem que entrar sozinha), a 20 e
a 30 (fronteiras de mundo, que também não param), e confere que só a fase 100 para o
fluxo.

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
`n`, senão um mundo maior que os outros viraria uma cobra esticada. A altura da trilha
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
pancada forte". A cera é assinatura da lava e tempero raro nos outros mundos, por peso
em `levelConfig`, e não por uma bandeira no `LevelLayout` — assim `PhysicsWorld` segue
sem conhecer tema.

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
continua jogando com metade do prêmio. Na homologação o jogo **não avisa** que os corações
acabaram — nem no selo do fluxo nem nos cartões (`noHeartsBody` segue no i18n, sem
uso); o prêmio pela metade continua valendo, em silêncio.

Na versão lisa `.btn.ad` some por CSS, então lá o pular vira botão comum liberado
depois de três derrotas, e o bônus diário sai sem vídeo. Quem decide a classe é o JS
(`skip.classList.toggle('ad', COM_ANUNCIOS)`), e não o HTML: com a classe cravada no
markup, o botão de bônus diário apagava o rodapé inteiro do mapa na versão lisa.

Vídeo recompensado só por escolha explícita do jogador, sempre ao lado de um botão
padrão de tamanho igual ou maior, e a recompensa só vale quando o retorno é
estritamente `true`. Nada de vídeo como condição para progredir: os corações são
"suaves" — sem corações o jogador continua jogando e só ganha metade das recompensas
(`game/progress.js`).

### Telemetria: progresso e interação

`measure(categoria, oque, acao)` alimenta as três abas de Game Events da Poki. A ação é
que decide qual delas: `start`/`complete`/`fail` caem em **Progress**,
`visible`/`interact` em **Interaction**, e qualquer outra em **Other**. Nem `/` nem `^`
podem chegar ao SDK — a Poki usa os dois para separar os campos no painel —, e
`poki.measure` já limpa e já barra evento durante intervalo.

Até a versão 1.0.1 a aba de interação estava **literalmente vazia**: fora de "fase N
começou" e "fase N terminou" não havia dado nenhum sobre dica, pausa, loja, vídeo ou
mapa, e toda pergunta sobre *por que* o jogador saiu era palpite. Hoje `EVENTOS_UI`
(`main.js`) mapeia id de botão para nome de evento e um único ouvinte delegado em
`bindTelemetriaUi()` emite o `interact` — botão novo entra no mapa, não no ouvinte. Os
botões que nascem em tempo de execução e por isso não têm id — os da loja, um por skin,
melhoria e impulso — declaram `data-ev`, que o mesmo ouvinte lê. O par `visible` sai
de `ofertaVisivel()`, que conta uma vez por abertura de tela (`show()` zera o
conjunto): sem ele o painel diz quantos clicaram e nunca quantos tiveram a chance.

Os **nomes** do mapa mudam com mais cuidado que os ids: um nome trocado quebra a série
histórica do relatório. O mesmo nome em telas diferentes é de propósito onde a ação é a
mesma — sair da fase pelo HUD, pela pausa ou pelo cartão é a mesma decisão do jogador, e
separar em três linhas só diluiria o número.

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
