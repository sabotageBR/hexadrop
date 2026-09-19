/**
 * Camera do jogo.
 *
 * O zoom e fixo durante a fase: e o que permite montar o cache de sprites uma
 * unica vez. A camera so acompanha o hexagono na vertical, com suavizacao e
 * limites, e aplica o tremor de tela.
 */

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.targetY = 0;
    this.pxPerMeter = 40;
    this.viewW = 1;
    this.viewH = 1;
    this.minY = 0;
    this.maxY = 0;
    this.trauma = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeSeed = 1;
  }

  /**
   * Ajusta o enquadramento para a fase.
   * @param {object} o
   * @param {number} o.viewW pixels CSS
   * @param {number} o.viewH
   * @param {number} o.towerWidth em celulas
   * @param {number} o.towerHeight
   * @param {number} o.pedestalHalf
   * @param {number} o.topInset pixels reservados para o HUD no topo
   * @param {number} o.bottomInset
   * @param {boolean} [o.fitWhole] enquadrar a cena INTEIRA, sem piso de zoom
   */
  fit(o) {
    this.viewW = o.viewW;
    this.viewH = o.viewH;
    this.topInset = o.topInset;
    this.bottomInset = o.bottomInset;

    // Largura enquadrada: a torre sempre cabe inteira. O pedestal pode passar
    // das bordas quando for muito mais largo que a torre, e isso ate ajuda,
    // porque um chao que sai da tela le como "aqui embaixo e seguro".
    const neededW = o.towerWidth + 1.8;
    // O piso de 140 protege a area de JOGO de virar uma fresta. Na home ele
    // seria o contrario do que se quer: com um vao de 58 px entre o titulo e os
    // botoes, fingir 140 faz a cena ser desenhada maior do que o espaco que
    // existe, e ela reaparece por cima dos botoes.
    const usableH = Math.max(o.fitWhole ? 54 : 140, o.viewH - o.topInset - o.bottomInset);
    const sceneBottom = -1.1;
    const sceneTop = o.towerHeight + 2.9;
    const sceneH = sceneTop - sceneBottom;

    const byWidth = o.viewW / neededW;
    // Mira em um tamanho de celula parecido em qualquer tela, entre 5,5 e 13
    // linhas visiveis. Sem isso, uma janela 16:9 de desktop achataria a torre
    // num palito e o celular em pe mostraria pecas gigantes.
    //
    // `fitWhole` dispensa o piso: na tela inicial a cena e cenario, nao area de
    // jogo, e o que importa e a torre caber inteira no vao entre o titulo e os
    // botoes. Com o piso de 5,5 linhas o zoom nao recuava o bastante e a torre
    // transbordava por cima dos botoes em paisagem baixa.
    const TARGET_CELL_PX = 56;
    const visibleRows = o.fitWhole
      ? sceneH
      : Math.max(5.5, Math.min(13, usableH / TARGET_CELL_PX));
    const byHeight = usableH / Math.min(sceneH, visibleRows);
    // O piso existe para a peca nao virar um ponto durante o jogo. Na home ele
    // cede: ali a cena e cenario, e transbordar por cima dos botoes e pior do
    // que aparecer pequena numa janela baixa.
    this.pxPerMeter = Math.max(o.fitWhole ? 6 : 12, Math.min(byWidth, byHeight));

    this.x = o.towerWidth / 2;
    const half = o.viewH / 2;

    // Os limites verticais saem direto do que se quer ver na tela: o topo da
    // cena encostado embaixo da HUD superior, e a base dela logo acima da HUD
    // inferior. Resolver assim evita errar o sinal do deslocamento.
    const yForSceneTopAt = sceneTop - (half - o.topInset) / this.pxPerMeter;
    const yForSceneBottomAt = sceneBottom + (half - o.bottomInset) / this.pxPerMeter;

    if (yForSceneBottomAt >= yForSceneTopAt) {
      // A cena inteira cabe: centraliza na area util, entre as duas HUDs.
      const center = (sceneTop + sceneBottom) / 2 + (o.topInset - o.bottomInset) / 2 / this.pxPerMeter;
      this.minY = center;
      this.maxY = center;
    } else {
      this.minY = yForSceneBottomAt;
      this.maxY = yForSceneTopAt;
    }
    this.y = this.maxY;
    this.targetY = this.y;
  }

  /**
   * @param {number} hexY
   * @param {number} dt
   */
  follow(hexY, dt) {
    const desired = Math.max(this.minY, Math.min(this.maxY, hexY - 1.6));
    this.targetY = desired;
    const k = 1 - Math.pow(0.0025, dt);
    this.y += (this.targetY - this.y) * k;
  }

  /** @param {number} amount 0 a 1 */
  addTrauma(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** @param {number} dt @param {number} time */
  update(dt, time) {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const shake = this.trauma * this.trauma;
    if (shake > 0.0001) {
      const t = time * 26;
      this.shakeX = Math.sin(t * 1.7 + this.shakeSeed) * shake * 11;
      this.shakeY = Math.sin(t * 2.3 + this.shakeSeed * 2) * shake * 11;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  /**
   * @param {number} wx
   * @param {number} wy
   * @returns {number[]}
   */
  toScreen(wx, wy) {
    return [
      (wx - this.x) * this.pxPerMeter + this.viewW / 2 + this.shakeX,
      this.viewH / 2 - (wy - this.y) * this.pxPerMeter + this.shakeY,
    ];
  }

  /**
   * @param {number} sx
   * @param {number} sy
   * @returns {number[]}
   */
  toWorld(sx, sy) {
    return [
      (sx - this.viewW / 2 - this.shakeX) / this.pxPerMeter + this.x,
      (this.viewH / 2 - sy + this.shakeY) / this.pxPerMeter + this.y,
    ];
  }
}
