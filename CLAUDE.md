# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Jogo de física em HTML5 (Vite + Planck.js + Canvas 2D), sem framework, feito para
publicação na Poki. Código, comentários e documentação estão em português; siga o
mesmo idioma ao escrever.

## Comandos

```bash
npm run dev          # servidor de desenvolvimento em 127.0.0.1:5173
npm run build        # dist/ com caminhos relativos
npm run preview      # serve o build em 127.0.0.1:4173
npm run check        # build + verify-build + sdkcheck
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

**`Session` (`src/game/session.js`) são as regras**, em volta de `PhysicsWorld`. Não
desenha e não fala com o DOM; comunica por callbacks (`onStar`, `onEnd`, `onFirstTap`,
`onDestroy`, `onImpact`). Quem quer efeito visual/sonoro embrulha esses callbacks — é
o que `GameScene.load()` faz.

**`main.js` é o único lugar que decide telas, progressão e quando falar com a Poki.**
Nenhum outro módulo importa `poki.js`. Mantenha assim.

### Celebração de fim de fase e combo

Vencer não abre o cartão na hora. `onLevelEnd` guarda o resultado em `pendingWin` e chama
`Session.startBonus()`: as peças **destrutíveis que sobraram** estouram uma a uma, de cima
para baixo, cada uma dando um empurrão nas vizinhas (`PhysicsWorld.burstAt`, que só aplica
impulso e nunca destrói) e um som que sobe com a contagem. O cartão só entra em
`onBonusDone`, depois de um rescaldo de 0,9 s — sem ele o cartão subia no mesmo quadro da
última explosão e cortava justamente o fim da comemoração.

Três coisas que essa fase precisa respeitar:

- **`evaluate()` não roda durante o bônus.** Esvaziar a torre dispararia `stuck` por cima
  do resultado que o jogador acabou de conquistar.
- **O ritmo acelera e tem teto.** O intervalo cai de 0,20 s para 0,07 s e a celebração
  inteira cabe em ~3,2 s: com trinta peças sobrando ela aperta o passo em vez de arrastar.
- **Sair no meio não pode custar a fase.** `quitLevel()` chama `commitPendingWin()` antes
  de voltar para a home, porque o progresso só é gravado no fim da contagem.

O **combo** é a outra metade: uma jogada abre no `tap()` e fecha quando a cena volta ao
repouso (ou em 1,4 s). Tudo que quebrar nesse intervalo conta junto — a peça tocada, a
cadeia de TNT, o que o desabamento levou. Esperar o repouso, e não o quadro seguinte, é o
que faz o combo enxergar desabamento. A `Session` instala a **própria** `world.onDestroy`
para contar; `GameScene.load()` embrulha essa função, então a contagem sobrevive.

Peça intacta e combo valem moedas **e** XP (`progress.finishLevel`), nunca estrelas: os
portões de mundo continuam cobrando exatamente o que cobravam.

### Determinismo e as fases assadas

A altura das torres vai de 4 a **24 linhas**, por duas curvas das quais vale a maior
(`levelConfig`): a antiga manda até a metade do jogo e a de expoente alto só ultrapassa
ela perto do fim, então nenhuma fase ficou mais baixa do que já era. Isso não aperta o
enquadramento — `camera.fit()` limita as linhas visíveis a 13 e acompanha o hexágono, de
modo que a torre mais alta rola mais, e não encolhe a peça na tela. O que precisou subir
junto foi o orçamento do validador: `MAX_SETTLE` de 420 para 600 passos e `maxTaps` de
60 para 85, porque uma torre do fim do jogo ainda está desabando quando os sete segundos
de antes acabavam.

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
  possivelmente impossíveis.
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

Impacto é medido pela velocidade de aproximação no `pre-solve`, não pelo impulso do
`post-solve`: numa torre alta o impulso mede o peso estático da pilha e o vidro da
base estilhaçaria sozinho.

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

### Renderização

Canvas 2D. Cada combinação de forma, material e tema vira um sprite desenhado uma vez
fora da tela, com o brilho embutido; cada quadro é `drawImage` sob transformação
(`render/sprites.js`). **Isso só funciona porque o zoom é fixo durante a fase** — o
cache é remontado em `GameScene.refit()`, que roda no resize e ao carregar a fase.

O material é uma **foto**, não um estilo de pintura por tema. `render/textures.js`
carrega os doze JPGs de `render/tex/` (192x192, `import.meta.glob`, embutidos no
bundle porque cabem no `assetsInlineLimit` — nenhuma requisição nova) e devolve um
ladrilho na escala da peça, que `paintPiece` usa como `createPattern` recortado na
silhueta do poliminó. Três armadilhas já pagas:

- **O ladrilho é espelhado em quatro quadrantes.** As fotos não são sem emenda; repetidas
  cruas deixavam uma borda clara atravessando a pedra como um remendo.
- **O desvio de fase do padrão tem que ser somado de volta no `fillRect`.** Só
  transladar o contexto deixava a direita e a base de qualquer peça menor que o desvio
  sem textura nenhuma.
- **`loadTextures()` é esperado antes da primeira cena** (`main.js`, `proto.js`): o cache
  de sprites é montado uma vez e não se refaz sozinho quando a imagem chega depois.

Por cima da foto vai um véu da cor do horizonte do tema em `soft-light` — luz do mundo,
não da peça. Ele é homogêneo de propósito: a peça gira, e um gradiente denunciaria onde
era o "cima" do sprite.

No mundo **neon** a peça é um tubo de luz com vidro fumê dentro: miolo translúcido
escuro, traço aceso e grosso, e **nenhuma fotografia** — é o único tema com
`photo: false`, que `paintPiece` consulta para pular o ladrilho. Já foi corpo opaco,
porque o sol listrado do cenário aparecia através da peça; o sol saiu de
`backgrounds.js` e com ele a razão do corpo opaco. Quem garante a leitura agora é a
`bruma`, que escurece o miolo da tela — onde a torre fica — e deixa a grade em
perspectiva viva só nas laterais e no rodapé. A obsidiana é a exceção e vai quase
opaca: é a única que o jogador não pode quebrar, e um corpo denso diz isso antes de
ele tentar.

A TNT ganha listras diagonais em qualquer tema (`hazardStripes` em `sprites.js`),
porque só a cor não separava a TNT laranja da madeira âmbar — e confundir as duas
custa a fase. O gatilho é o material que quebra por pancada **e** explode, que é só a
TNT: a bomba espera o dedo do jogador e o vidro não espalha nada.

### Tema na interface

`applyUiTheme()` (`src/render/uitheme.js`) leva a paleta do tema da fase para variáveis
CSS a cada `scene.load`. Três temas (classic, candy, paper) pedem interface clara: a
polaridade vai em `data-ui` no root, e superfícies usam `var(--wash)` em vez de branco
cravado. `.btn.ad` fica fora do tema — a Poki exige que o botão de vídeo seja constante.

Além da paleta, o mundo escolhe um **kit** de cromado (`render/uikit.js` → `data-kit` no
root): `neon`, `atelier`, `hexdeck`, `ficha` ou `queda` mudam o botão primário, o cartão
de fim de fase e onde ficam as estrelas do HUD. São cinco e não oito porque o kit é a
cara de uma família de mundos, não da fase — o `neon` é o único de um tema só, porque o
anel de luz é a assinatura desse mundo e ficaria errado no futurista, que é frio e
chapado de propósito. O kit muda o cromado, nunca o que cabe na tela: em paisagem baixa
a regra de `@media` recoloca as estrelas no canto para qualquer kit. O cartão da **pausa**
tem fundo em todos os kits, inclusive no `queda`, onde os de vitória e derrota são
transparentes: dava para ver o jogo atrás, mas não dava para ler a tela.

A tela inicial é um **carrossel de mundos** — a cena de fundo é uma fase real do mundo em
cartaz, e deslizar (ou tocar nas bolinhas) troca de mundo entre os já abertos. O rótulo
do botão de jogar sai de `buildHomeWorlds()`, junto com as bolinhas, e não de
`refreshScreen()`: deslizar não passa por lá, e o botão prometia uma fase e abria outra.

A home é **três faixas que não se tocam**: nome do jogo em cima, um vão vazio no meio e
as opções embaixo. O vão não tem conteúdo de propósito — é por ele que a torre aparece.
`fitHomeScene()` mede a altura real das outras duas faixas e chama `scene.setInsets()`
para enquadrar a cena exatamente ali; medir, em vez de cravar números, é o que sustenta
a troca de idioma e de tamanho de janela. Antes havia um único espaçador antes do bloco
central, e tudo se empilhava na metade de baixo: o título ficava sobre a torre e o
rodapé de patente saía da tela.

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

### Áudio

Tudo sintetizado em Web Audio, sem um byte de asset. A trilha é um sequenciador com
lookahead pulsado pelo passo da cena (`audio.updateMusic()` em `scene.step`), e não por
timer próprio.

- **A forma tem 32 compassos em quatro seções (A A' B A'')**, com máscaras rítmicas que
  têm silêncio. A versão anterior atacava em toda colcheia par, com baixo sempre nos
  mesmos dois lugares e loop de oito compassos — era um relógio. O silêncio é o que tira
  o som de metrônomo; a seção B sobe uma oitava, abre o ritmo e traz o pad.
- **A home tem trilha própria** (`MAIN_THEME` em `main.js`), que não muda ao deslizar o
  carrossel. Antes ela herdava a música do mundo em cartaz, e a identidade sonora do jogo
  dependia de onde o jogador tinha parado.
- **A trilha para fora da aba e na pausa.** `AudioEngine` tem o próprio handler de
  `visibilitychange`: suspende o contexto e, ao voltar, **ressincroniza** `_musicNext` —
  sem isso o agendador despejava de uma vez todas as notas vencidas. A pausa usa
  `holdMusic()`/`releaseMusic()`, porque quem pulsa o sequenciador é o passo da cena, que
  segue rodando e não sabe de pausa nenhuma.

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
  próprio — a frequência é decisão da Poki.

Vídeo recompensado só por escolha explícita do jogador, sempre ao lado de um botão
padrão de tamanho igual ou maior, e a recompensa só vale quando o retorno é
estritamente `true`. Nada de vídeo como condição para progredir: os corações são
"suaves" — sem corações o jogador continua jogando e só ganha metade das recompensas
(`game/progress.js`).

Na **vitória** não há vídeo nenhum: só Repetir e Próxima. Na **derrota** há um, "pular
fase", sempre visível e ao lado de "tentar de novo", que é maior e gratuito. Pular
**não grava estrela** (`progress.markSkipped`), então o portão do mundo seguinte continua
cobrando o que cobrava — o vídeo adianta o caminho, nunca o progresso.

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
