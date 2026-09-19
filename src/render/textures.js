/**
 * Texturas 2D dos materiais.
 *
 * Fotografia recortada na silhueta do polimino: a peca continua simetrica e
 * gira no plano, o veio vai junto. O modulo so vive em render/ - o validador
 * em Node nunca importa isto.
 */

const FILES = import.meta.glob('./tex/*.jpg', { eager: true, import: 'default' });

/** @type {Record<string, HTMLImageElement>} */
const images = {};
/** @type {Map<string, HTMLCanvasElement>} */
const tiles = new Map();

let loading = null;

/**
 * @param {string} id
 * @returns {string|undefined}
 */
function urlOf(id) {
  return FILES[`./tex/${id}.jpg`];
}

/**
 * Garante que as fotos estao prontas antes do primeiro sprite.
 * @returns {Promise<void>}
 */
export function loadTextures() {
  if (typeof Image === 'undefined') return Promise.resolve();
  if (loading) return loading;
  const ids = Object.keys(FILES).map((k) => k.replace('./tex/', '').replace('.jpg', ''));
  loading = Promise.all(
    ids.map(
      (id) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            images[id] = img;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = urlOf(id);
        }),
    ),
  ).then(() => undefined);
  return loading;
}

/**
 * Ladrilho na escala da peca, para o veio caber dentro de um tetromino.
 *
 * Sao quatro copias espelhadas num quadrado de lado 2x: a foto nao e sem
 * emenda, e repetida crua ela deixava uma borda clara atravessando a pedra
 * como se fosse um remendo. Espelhar faz as bordas casarem sem tocar no
 * tamanho aparente do veio.
 *
 * @param {string} id
 * @param {number} size
 * @returns {HTMLCanvasElement|null}
 */
export function tileOf(id, size) {
  const img = images[id];
  if (!img) return null;
  const px = Math.max(32, Math.round(size));
  const key = id + '|' + px;
  const hit = tiles.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = px * 2;
  canvas.height = px * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  for (let i = 0; i < 4; i++) {
    const fx = i % 2 ? -1 : 1;
    const fy = i > 1 ? -1 : 1;
    ctx.save();
    ctx.translate(i % 2 ? px * 2 : 0, i > 1 ? px * 2 : 0);
    ctx.scale(fx, fy);
    ctx.drawImage(img, 0, 0, px, px);
    ctx.restore();
  }
  tiles.set(key, canvas);
  return canvas;
}
