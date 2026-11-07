/**
 * itch.io (itch.io/docs/creators/html5, lido em 2026-11-07).
 *
 * Jogo HTML na itch nao tem SDK, nem anuncio, nem compra dentro do jogo (so
 * doacao pela pagina). Este build e o da Wavedash sem nada da Wavedash: a
 * versao lisa pelo caminho dos portais (src/portais/inicio.js), com o
 * adaptador quase vazio.
 *
 * - **sem anuncio**: `COM_ANUNCIOS` e falso (core/platform.js), o intervalo sai
 *   na hora e o video premiado responde "sem video" sem nunca pagar. Os botoes
 *   de video somem e fica o caminho gratuito da versao lisa: voltar uma jogada
 *   de graca, pular fase depois de tres derrotas e o bonus diario sem video.
 * - **sem pacotes de moedas nem nuvem**: `COM_PACOTES` so vale na Wavedash, e
 *   o save fica so no localStorage (core/storage.js, tudo com o prefixo
 *   `hexadrop.`). A origem dos jogos HTML da itch (html-classic.itch.zone) e a
 *   mesma para todos eles: o storage nunca e limpo inteiro nem varrido fora do
 *   prefixo. Em compensacao ela nao muda de um upload para outro, e o save
 *   passa de uma versao para a seguinte.
 * - **idioma**: o do navegador (core/i18n.js), como fora dos portais; a escolha
 *   feita nos ajustes continua valendo.
 * - **nenhuma marca de outro portal** (`semMarcas` em tools/portais-sdk.mjs):
 *   nem no CSS, nem nos comentarios do index.html, nem no JS.
 */

import { Portal } from './base.js';

export class PortalItch extends Portal {
  constructor() {
    super();
    // Nao ha anuncio: commercialBreak e rewardedBreak saem na hora (base.js).
    this._semAnuncios = true;
    this._botoesDeVideo();
  }

  /**
   * Os botoes de video somem, como na versao lisa e na Wavedash. A regra mora
   * aqui, e nao em game.css, para a folha dos outros builds continuar byte a
   * byte a mesma.
   */
  _botoesDeVideo() {
    if (typeof document === 'undefined' || !document.head) return;
    this._chama(() => {
      const s = document.createElement('style');
      s.textContent = '.btn.ad { display: none !important; }';
      document.head.appendChild(s);
    });
  }
}

export const plataforma = new PortalItch();
