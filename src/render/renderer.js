/**
 * Desenho da cena.
 *
 * Tudo em Canvas 2D. As pecas sao sprites em cache desenhados com
 * transformacao, o cenario e um canvas pintado uma vez por tamanho de janela,
 * e o pos-processamento se resume a vinheta e tremor de camera.
 */

import { paintBackground } from './backgrounds.js';
import { roundRect } from './draw2d.js';
import { paintPedestal } from './pedestal.js';
import { tracePiece } from './sprites.js';
import { outlineLoops } from '../physics/shapes.js';
import { material as getMaterial } from '../physics/materials.js';
import { PEDESTAL_HALF_H } from '../physics/world.js';

export class Renderer {
  /**
   * @param {import('../core/viewport.js').Viewport} viewport
   * @param {import('./camera.js').Camera} camera
   */
  constructor(viewport, camera) {
    this.viewport = viewport;
    this.camera = camera;
    /** @type {HTMLCanvasElement|null} */
    this.bgCanvas = null;
    this.bgThemeId = '';
    this.bgW = 0;
    this.bgH = 0;
  }

  /**
   * @param {import('./themes.js').Theme} theme
   */
  ensureBackground(theme) {
    const vp = this.viewport;
    const w = Math.ceil(vp.width);
    const h = Math.ceil(vp.height * 1.35);
    if (this.bgCanvas && this.bgThemeId === theme.id && this.bgW === w && this.bgH === h) return;
    const canvas = document.createElement('canvas');
    const dpr = Math.min(1.5, vp.dpr);
    canvas.width = Math.ceil(w * dpr);
    canvas.height = Math.ceil(h * dpr);
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    ctx.scale(dpr, dpr);
    paintBackground(ctx, theme, w, h);
    this.bgCanvas = canvas;
    this.bgThemeId = theme.id;
    this.bgW = w;
    this.bgH = h;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} scene
   * @param {import('../game/session.js').Session} scene.session
   * @param {import('./themes.js').Theme} scene.theme
   * @param {import('./sprites.js').SpriteCache} scene.sprites
   * @param {import('./particles.js').Particles} scene.particles
   * @param {*} scene.skin
   * @param {number} scene.time
   * @param {*} [scene.hovered]
   */
  draw(ctx, scene) {
    const { session, theme, sprites, particles, skin } = scene;
    const cam = this.camera;
    const vp = this.viewport;
    const world = session.world;

    this.ensureBackground(theme);
    ctx.fillStyle = theme.sky[theme.sky.length - 1];
    ctx.fillRect(0, 0, vp.width, vp.height);
    if (this.bgCanvas) {
      // Parallax vertical suave: o fundo anda a um terco da camera.
      const range = this.bgH - vp.height;
      const t = cam.maxY > cam.minY ? (cam.y - cam.minY) / (cam.maxY - cam.minY) : 0;
      const offset = -range * (1 - Math.max(0, Math.min(1, t)));
      ctx.drawImage(this.bgCanvas, cam.shakeX * 0.3, offset + cam.shakeY * 0.3, this.bgW, this.bgH);
    }

    const px = cam.pxPerMeter;
    /** @param {number} x @param {number} y */
    const toScreen = (x, y) => cam.toScreen(x, y);

    this.drawPedestal(ctx, world, theme, toScreen, px);
    this.drawStarLines(ctx, session, theme, toScreen, px);

    // --- pecas -----------------------------------------------------------
    for (const piece of world.pieces) {
      if (!piece.alive) continue;
      const pos = piece.body.getPosition();
      const angle = piece.body.getAngle();
      const sprite = sprites.piece(piece.cells, piece.material);
      const [sx, sy] = toScreen(pos.x, pos.y);
      if (sx < -sprite.w || sx > vp.width + sprite.w || sy < -sprite.h || sy > vp.height + sprite.h) {
        continue;
      }
      ctx.save();
      ctx.translate(sx, sy);
      if (angle !== 0) ctx.rotate(-angle);
      ctx.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h / 2, sprite.w, sprite.h);
      ctx.restore();
    }

    // --- aviso dos perigos -------------------------------------------------
    // O sprite e cacheado por forma+material, entao nao pode mudar com o tempo:
    // o aviso vem por cima, reaproveitando o mesmo tracado de silhueta do
    // realce. A TNT pulsa devagar e sempre; o cristal so comeca a piscar depois
    // de um terco do prazo, e acelera ate ceder.
    for (const piece of world.pieces) {
      if (!piece.alive) continue;
      const mat = getMaterial(piece.material);
      const estilo = theme.materials[piece.material];
      const cor = estilo ? estilo.stroke : mat.color;
      if (mat.explodeRadius > 0 && mat.breakSpeed > 0) {
        this.outlinePiece(ctx, piece, toScreen, px, cor, 0.25 + 0.25 * Math.sin(scene.time * 4), theme.corner);
      } else if (mat.holdTime > 0 && piece.holdTimer > 0) {
        const k = piece.holdTimer / mat.holdTime;
        if (k > 0.3) {
          const alpha = ((k - 0.3) / 0.7) * (0.55 + 0.45 * Math.sin(scene.time * (6 + k * 14)));
          this.outlinePiece(ctx, piece, toScreen, px, cor, Math.max(0, alpha), theme.corner);
        }
      }
    }

    // --- realce de dica e de peca sob o ponteiro --------------------------
    if (session.hintPiece && session.hintPiece.alive) {
      this.outlinePiece(ctx, session.hintPiece, toScreen, px, theme.accent2, 0.5 + 0.5 * Math.sin(scene.time * 6), theme.corner);
    }
    if (scene.hovered && scene.hovered.alive && scene.hovered !== session.hintPiece) {
      const mat = getMaterial(scene.hovered.material);
      this.outlinePiece(ctx, scene.hovered, toScreen, px, mat.destructible ? theme.accent : '#ff5050', 0.55, theme.corner);
    }

    // --- hexagono ---------------------------------------------------------
    if (world.hexBody) {
      const t = world.hexTransform();
      const sprite = sprites.hexagon(world.hexRadius, skin);
      const [sx, sy] = toScreen(t.x, t.y);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-t.angle);
      ctx.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h / 2, sprite.w, sprite.h);
      ctx.restore();
    }

    particles.draw(ctx, toScreen, px);
    this.drawVignette(ctx, theme);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {*} piece
   * @param {(x:number,y:number)=>number[]} toScreen
   * @param {number} px
   * @param {string} color
   * @param {number} alpha
   * @param {number} corner raio dos cantos do tema, em fracao da celula
   */
  outlinePiece(ctx, piece, toScreen, px, color, alpha, corner) {
    const pos = piece.body.getPosition();
    const angle = piece.body.getAngle();
    const [sx, sy] = toScreen(pos.x, pos.y);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-angle);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, px * 0.06);
    ctx.shadowColor = color;
    ctx.shadowBlur = px * 0.3;
    ctx.lineJoin = 'round';
    // A mesma fonte geometrica do sprite: um caminho unico pela silhueta, e nao
    // um retangulo por bloco de toRects(). Com um retangulo por bloco, as
    // costuras internas da peca eram tracadas junto e brilhavam tanto quanto a
    // borda de verdade - duas em cada tres formas tem mais de um bloco. O
    // caminho unico tambem contorna o buraco das pecas vazadas.
    // Sao os numeros do sprite menos o dpr e menos o pad: a folga aqui vem toda
    // da espessura do traco.
    tracePiece(
      ctx,
      outlineLoops(piece.cells),
      px,
      Math.max(1.5, px * corner),
      -(piece.cw / 2) * px,
      (piece.ch / 2) * px,
    );
    ctx.stroke();
    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {*} world
   * @param {import('./themes.js').Theme} theme
   * @param {(x:number,y:number)=>number[]} toScreen
   * @param {number} px
   */
  drawPedestal(ctx, world, theme, toScreen, px) {
    const [sx, sy] = toScreen(world.pedestalX(), 0);
    ctx.save();
    paintPedestal({
      ctx,
      sx,
      sy,
      w: world.pedestalHalfWidth * 2 * px,
      h: PEDESTAL_HALF_H * 2 * px,
      px,
      vh: this.viewport.height,
      theme,
    });
    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../game/session.js').Session} session
   * @param {import('./themes.js').Theme} theme
   * @param {(x:number,y:number)=>number[]} toScreen
   * @param {number} px
   */
  drawStarLines(ctx, session, theme, toScreen, px) {
    const vp = this.viewport;
    const lines = session.world.starLines;
    ctx.save();
    ctx.lineWidth = Math.max(1.5, px * 0.035);
    const dash = Math.max(6, px * 0.2);
    ctx.setLineDash([dash, dash * 0.75]);
    for (let i = 0; i < lines.length; i++) {
      const done = session.world.starsCrossed > i;
      const [, sy] = toScreen(0, lines[i]);
      if (sy < -40 || sy > vp.height + 40) continue;
      ctx.globalAlpha = done ? 0.32 : 0.85;
      ctx.strokeStyle = done ? theme.inkSoft : theme.guide;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(vp.width, sy);
      ctx.stroke();

      ctx.setLineDash([]);
      const sSize = Math.max(11, px * 0.3);
      drawStar(ctx, sSize * 1.35, sy, sSize, done ? theme.star : theme.starOff, done);
      ctx.globalAlpha = 1;
      ctx.fillStyle = done ? theme.star : theme.inkSoft;
      ctx.font = `700 ${Math.max(13, px * 0.34)}px ${theme.font}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), sSize * 2.4, sy - sSize * 1.15);
      ctx.setLineDash([dash, dash * 0.75]);
    }
    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./themes.js').Theme} theme
   */
  drawVignette(ctx, theme) {
    const vp = this.viewport;
    const g = ctx.createRadialGradient(
      vp.width / 2,
      vp.height / 2,
      Math.min(vp.width, vp.height) * 0.35,
      vp.width / 2,
      vp.height / 2,
      Math.max(vp.width, vp.height) * 0.78,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, theme.style === 'flat' || theme.style === 'paper' ? 'rgba(40,30,20,0.16)' : 'rgba(0,0,0,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vp.width, vp.height);
  }
}


/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {string} color
 * @param {boolean} glow
 */
export function drawStar(ctx, cx, cy, r, color, glow) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.46;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = r * 0.9;
  }
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
