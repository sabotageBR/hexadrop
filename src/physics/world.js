/**
 * Mundo fisico do jogo, sobre o Planck (porte do Box2D 2.4).
 *
 * Este modulo nao toca no DOM: o mesmo codigo roda no navegador e no
 * validador headless em Node. Efeitos visuais e sonoros chegam por callbacks.
 */

import * as pl from 'planck';
import { material as getMaterial } from './materials.js';
import { toRects, bounds } from './shapes.js';

/** Lado da celula em metros. Box2D trabalha melhor perto de 1 m. */
export const CELL = 1;
/** Folga entre pecas vizinhas, responsavel pelo contorno separado. */
export const GAP = 0.03;
export const GRAVITY = -10;

export const HEX_RADIUS = 0.75;
/** Meia altura do pedestal. O topo fica sempre em y = 0. */
export const PEDESTAL_HALF_H = 0.55;

const VEL_ITER = 9;
const POS_ITER = 4;
/** Velocidade abaixo da qual consideramos o hexagono parado. */
const REST_LINEAR = 0.16;
const REST_ANGULAR = 0.35;
/** Tirar o hexagono de cima alivia o dobro da velocidade com que carrega. */
const HOLD_DECAY = 2;

/**
 * @typedef {object} PieceState
 * @property {number} id
 * @property {import('planck').Body} body
 * @property {string} material
 * @property {[number,number][]} cells
 * @property {{x:number,y:number,w:number,h:number}[]} rects
 * @property {number} cw largura em celulas
 * @property {number} ch altura em celulas
 * @property {number} ox deslocamento do centro ate a celula 0,0
 * @property {number} oy
 * @property {boolean} alive
 * @property {number} area
 * @property {number} spawnX posicao inicial em coluna
 * @property {number} spawnY posicao inicial em linha
 * @property {number} holdTimer segundos acumulados com o hexagono apoiado em cima
 */

/**
 * @typedef {object} LevelLayout
 * @property {number} width colunas da torre
 * @property {number} height linhas da torre
 * @property {{shape:string, cells:[number,number][], material:string, x:number, y:number}[]} pieces
 * @property {{x:number}} hexagon coluna do centro do hexagono
 * @property {{halfWidth:number, x:number, oscillate:number}} pedestal
 * @property {number[]} starLines alturas em metros, do topo para a base
 * @property {number} wind forca lateral constante
 * @property {number} [hexScale]
 */

/**
 * Quanto da pancada pertence ao OUTRO corpo do par.
 *
 * O fator e dobrado de proposito, para que massas iguais continuem valendo 1:
 * e nesse ponto que os `breakSpeed` de materials.js foram calibrados, e assim
 * a regra antiga continua valendo para o caso simetrico. Um corpo estatico -
 * pedestal, obsidiana - tem massa zero no Box2D e vale como massa infinita,
 * senao vidro que cai no chao nunca quebraria.
 *
 * @param {number} minha
 * @param {number} outra
 * @returns {number} 0 (nada) a 2 (massa infinita do outro lado)
 */
function quinhaoDeMassa(minha, outra) {
  if (outra <= 0) return 2;
  if (minha <= 0) return 0;
  return (2 * outra) / (outra + minha);
}

export class PhysicsWorld {
  /**
   * @param {object} [opts]
   * @param {(piece: PieceState, cause: string)=>void} [opts.onDestroy]
   * @param {(strength:number, materialId:string, x:number, y:number)=>void} [opts.onImpact]
   * @param {number} [opts.hexAngularDamping]
   * @param {number} [opts.hexFrictionBonus]
   */
  constructor(opts = {}) {
    this.onDestroy = opts.onDestroy || null;
    this.onImpact = opts.onImpact || null;
    this.hexAngularDamping = opts.hexAngularDamping === undefined ? 0.08 : opts.hexAngularDamping;
    this.hexFrictionBonus = opts.hexFrictionBonus || 0;

    /** @type {import('planck').World} */
    this.world = new pl.World({ gravity: new pl.Vec2(0, GRAVITY) });
    this.world.setContinuousPhysics(true);

    /** @type {PieceState[]} */
    this.pieces = [];
    /** @type {Map<import('planck').Body, PieceState>} */
    this.byBody = new Map();
    /** @type {import('planck').Body|null} */
    this.hexBody = null;
    /** @type {import('planck').Body|null} */
    this.pedestalBody = null;

    this.time = 0;
    this.wind = 0;
    this.pedestalOscillate = 0;
    this.pedestalBaseX = 0;
    this.pedestalHalfWidth = 2;
    this.towerWidth = 5;
    this.towerHeight = 10;
    this.towerCenterX = 0;
    /** @type {number[]} */
    this.starLines = [];
    this.starsCrossed = 0;
    this.destructibleCount = 0;
    this.restTimer = 0;
    this.nextPieceId = 1;

    /** @type {{piece: PieceState, cause: string}[]} */
    this._pendingDestroy = [];
    /** @type {{x:number, y:number, radius:number, sourceId:number}[]} */
    this._pendingExplosions = [];
    this._stepping = false;

    this.world.on('pre-solve', (contact) => this._onPreSolve(contact));
  }

  /**
   * Impacto medido pela velocidade de aproximacao no ponto de contato, pesada
   * pela massa que chega.
   *
   * O impulso normal do post-solve nao serve para isso: numa torre alta ele
   * mede o peso estatico da pilha, entao o vidro da base estilhacaria sozinho
   * antes do jogador tocar em nada. A velocidade de aproximacao so e grande
   * quando algo realmente cai em cima.
   *
   * Mas velocidade sozinha tambem mentia. Medido no proprio motor, uma espuma
   * de densidade 0,35 e um bloco de metal de densidade 3,2 caindo da mesma
   * altura quebravam o vidro exatamente igual, e uma torre inteira parada em
   * cima dele nao fazia nada - porque nada disso entrava na conta. Dai o
   * quinhao de massa.
   *
   * @param {import('planck').Contact} contact
   */
  _onPreSolve(contact) {
    const wm = contact.getWorldManifold(null);
    if (!wm || !wm.points || !wm.points.length) return;
    const normal = wm.normal;
    const point = wm.points[0];
    const ba = contact.getFixtureA().getBody();
    const bb = contact.getFixtureB().getBody();
    const va = ba.getLinearVelocityFromWorldPoint(point);
    const vb = bb.getLinearVelocityFromWorldPoint(point);
    const approach = -((vb.x - va.x) * normal.x + (vb.y - va.y) * normal.y);
    if (approach < 1.1) return;

    const pa = this.byBody.get(ba);
    const pb = this.byBody.get(bb);

    if (this.onImpact && approach > 2.2) {
      // O som tambem escuta a massa: pancada pesada soa pesada.
      const alvo = pa || pb;
      const outro = alvo && alvo.body === ba ? bb : ba;
      const forca = approach * quinhaoDeMassa(alvo ? alvo.body.getMass() : 1, outro.getMass());
      this.onImpact(
        Math.min(1, (forca - 2.2) / 7),
        alvo ? alvo.material : 'stone',
        point.x,
        point.y,
      );
    }

    for (const p of [pa, pb]) {
      if (!p || !p.alive) continue;
      const mat = getMaterial(p.material);
      if (mat.breakSpeed <= 0) continue;
      const outro = p.body === ba ? bb : ba;
      const golpe = approach * quinhaoDeMassa(p.body.getMass(), outro.getMass());
      if (golpe >= mat.breakSpeed) {
        this._queueDestroy(p, mat.explodeRadius > 0 ? 'blast' : 'shatter');
      }
    }
  }

  /**
   * @param {PieceState} piece
   * @param {string} cause
   */
  _queueDestroy(piece, cause) {
    if (!piece.alive) return;
    if (this._pendingDestroy.some((d) => d.piece === piece)) return;
    this._pendingDestroy.push({ piece, cause });
  }

  /**
   * Monta uma fase a partir do layout gerado.
   * @param {LevelLayout} layout
   */
  build(layout) {
    this.towerWidth = layout.width;
    this.towerHeight = layout.height;
    this.towerCenterX = (layout.width * CELL) / 2;
    this.wind = layout.wind || 0;
    this.starLines = layout.starLines.slice();
    // Bandeira de custo zero: sem material temporal na fase, a varredura de
    // contatos por passo nem chega a rodar, e a simulacao fica identica a de
    // antes. E o que mantem as fases antigas bit a bit iguais.
    this._hasHold = layout.pieces.some((p) => (getMaterial(p.material).holdTime || 0) > 0);
    this._holdCharging = false;
    this.starsCrossed = 0;
    this.time = 0;
    this.restTimer = 0;

    // pedestal
    const ped = layout.pedestal;
    this.pedestalHalfWidth = ped.halfWidth;
    this.pedestalBaseX = ped.x;
    this.pedestalOscillate = ped.oscillate || 0;
    this.pedestalBody = this.world.createBody({
      type: this.pedestalOscillate > 0 ? 'kinematic' : 'static',
      position: new pl.Vec2(ped.x, -PEDESTAL_HALF_H),
    });
    this.pedestalBody.createFixture(new pl.Box(ped.halfWidth, PEDESTAL_HALF_H), {
      density: 0,
      friction: 0.72,
      restitution: 0.02,
    });

    // pecas
    for (const def of layout.pieces) {
      this.addPiece(def.cells, def.material, def.x, def.y);
    }

    // hexagono
    const scale = layout.hexScale || 1;
    const r = HEX_RADIUS * scale;
    const hexX = layout.hexagon.x * CELL;
    const hexY = layout.height * CELL + r + 0.22;
    this.addHexagon(hexX, hexY, r);

    this.destructibleCount = this.pieces.filter(
      (p) => p.alive && getMaterial(p.material).destructible,
    ).length;
  }

  /**
   * @param {[number,number][]} cells
   * @param {string} materialId
   * @param {number} gridX coluna da celula 0,0
   * @param {number} gridY linha da celula 0,0
   * @returns {PieceState}
   */
  addPiece(cells, materialId, gridX, gridY) {
    const b = bounds(cells);
    const rects = toRects(cells);

    /** @type {PieceState} */
    const piece = {
      id: this.nextPieceId++,
      body: /** @type {*} */ (null),
      material: materialId,
      cells,
      rects,
      cw: b.w,
      ch: b.h,
      ox: -(b.w / 2) * CELL,
      oy: -(b.h / 2) * CELL,
      alive: false,
      area: cells.length,
      spawnX: gridX,
      spawnY: gridY,
      holdTimer: 0,
    };
    this.pieces.push(piece);
    // O corpo nasce no centro do retangulo envolvente, para que massa e
    // rotacao fiquem coerentes com o desenho.
    this._spawnBody(piece, (gridX + b.w / 2) * CELL, (gridY + b.h / 2) * CELL, 0);
    return piece;
  }

  /**
   * Cria (ou recria) o corpo rigido de uma peca.
   * @param {PieceState} piece
   * @param {number} x
   * @param {number} y
   * @param {number} angle
   */
  _spawnBody(piece, x, y, angle) {
    const mat = getMaterial(piece.material);
    // Pecas indestrutiveis ficam ancoradas no lugar. Alem de serem obstaculos
    // previsiveis, isso impede que entulhem o pedestal e tornem a fase
    // impossivel, e da pontos de apoio fixos que estabilizam torres altas.
    const anchored = mat.anchored === true;
    const body = this.world.createBody({
      type: anchored ? 'static' : 'dynamic',
      position: new pl.Vec2(x, y),
      angle,
      angularDamping: 0.03,
      linearDamping: 0,
      allowSleep: true,
      bullet: false,
    });
    const half = GAP / 2;
    for (const r of piece.rects) {
      const hw = (r.w * CELL) / 2 - half;
      const hh = (r.h * CELL) / 2 - half;
      if (hw <= 0.02 || hh <= 0.02) continue;
      const ox = (r.x + r.w / 2 - piece.cw / 2) * CELL;
      const oy = (r.y + r.h / 2 - piece.ch / 2) * CELL;
      body.createFixture(new pl.Box(hw, hh, new pl.Vec2(ox, oy), 0), {
        density: mat.density,
        friction: mat.friction,
        restitution: mat.restitution,
      });
    }
    body.setUserData(piece);
    piece.body = body;
    piece.alive = true;
    this.byBody.set(body, piece);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   */
  addHexagon(x, y, radius) {
    const verts = [];
    // Topo e base planos, vertices a esquerda e a direita.
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      verts.push(new pl.Vec2(radius * Math.cos(a), radius * Math.sin(a)));
    }
    const body = this.world.createBody({
      type: 'dynamic',
      position: new pl.Vec2(x, y),
      angle: 0,
      angularDamping: this.hexAngularDamping,
      linearDamping: 0,
      bullet: true,
      allowSleep: true,
    });
    body.createFixture(new pl.Polygon(verts), {
      density: 1.25,
      friction: Math.min(0.95, 0.62 + this.hexFrictionBonus),
      restitution: 0.04,
    });
    body.setUserData({ hexagon: true });
    this.hexBody = body;
    this.hexRadius = radius;
  }

  /**
   * Encontra a peca sob um ponto do mundo.
   * @param {number} x
   * @param {number} y
   * @param {number} [tolerance] raio extra, util para o dedo no celular
   * @returns {PieceState|null}
   */
  pickAt(x, y, tolerance = 0) {
    const point = new pl.Vec2(x, y);
    const aabb = new pl.AABB(
      new pl.Vec2(x - tolerance - 0.01, y - tolerance - 0.01),
      new pl.Vec2(x + tolerance + 0.01, y + tolerance + 0.01),
    );
    /** @type {PieceState|null} */
    let exact = null;
    /** @type {PieceState|null} */
    let near = null;
    let nearDist = Infinity;
    this.world.queryAABB(aabb, (fixture) => {
      const piece = this.byBody.get(fixture.getBody());
      if (!piece || !piece.alive) return true;
      if (fixture.testPoint(point)) {
        exact = piece;
        return false;
      }
      if (tolerance > 0) {
        const c = fixture.getBody().getPosition();
        const d = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y);
        if (d < nearDist) {
          nearDist = d;
          near = piece;
        }
      }
      return true;
    });
    return exact || near;
  }

  /**
   * @param {PieceState} piece
   * @param {string} [cause] 'tap' | 'shatter' | 'explosion' | 'cleanup'
   */
  /**
   * Empurrao radial que NAO destroi nada.
   *
   * E o sopro da celebracao de fim de fase: a peca contada some por
   * destroyPiece, e este empurrao e o que faz a vizinhanca reagir. Separado de
   * _resolveExplosions de proposito - aquele laco destroi tudo que for
   * destrutivel dentro do raio, e usa-lo aqui levaria junto as pecas que ainda
   * serao contadas uma a uma, que e justamente a graca da contagem.
   *
   * Fica fora de snapshot()/restore() e nunca e chamado de dentro de step():
   * nao faz parte da simulacao que o solucionador prova.
   *
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {number} [force]
   */
  burstAt(x, y, radius, force = 4) {
    const r2 = radius * radius;
    for (const p of this.pieces) {
      if (!p.alive || !p.body.isDynamic()) continue;
      const c = p.body.getPosition();
      const dx = c.x - x;
      const dy = c.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const d = Math.sqrt(d2) || 0.001;
      p.body.setAwake(true);
      p.body.applyLinearImpulse(
        new pl.Vec2((dx / d) * force, (dy / d) * force),
        p.body.getWorldCenter(),
        true,
      );
    }
    // O hexagono leva um empurrao bem menor: ele ja pousou, e a celebracao
    // existe para comemorar isso, nao para arrancar ele do pedestal.
    if (this.hexBody) {
      const c = this.hexBody.getPosition();
      const dx = c.x - x;
      const dy = c.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2) {
        const d = Math.sqrt(d2) || 0.001;
        this.hexBody.setAwake(true);
        this.hexBody.applyLinearImpulse(
          new pl.Vec2((dx / d) * force * 0.3, (dy / d) * force * 0.3),
          this.hexBody.getWorldCenter(),
          true,
        );
      }
    }
    this.wakeAround(x, y, radius + 2);
  }
  destroyPiece(piece, cause = 'tap') {
    if (!piece || !piece.alive) return;
    if (this._stepping) {
      this._queueDestroy(piece, cause);
      return;
    }
    this._applyDestroy(piece, cause);
  }

  /**
   * @param {PieceState} piece
   * @param {string} cause
   */
  _applyDestroy(piece, cause) {
    piece.holdTimer = 0;
    if (!piece.alive) return;
    piece.alive = false;
    const mat = getMaterial(piece.material);
    const pos = piece.body.getPosition();
    const px = pos.x;
    const py = pos.y;
    this.byBody.delete(piece.body);
    this.world.destroyBody(piece.body);
    if (mat.destructible) this.destructibleCount--;
    if (this.onDestroy) this.onDestroy(piece, cause);
    if (mat.explodeRadius > 0 && cause !== 'cleanup') {
      this._pendingExplosions.push({
        x: px,
        y: py,
        radius: mat.explodeRadius,
        sourceId: piece.id,
      });
    }
    this.wakeAround(px, py, 6);
  }

  /**
   * Acorda os corpos proximos para que a torre reaja imediatamente.
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   */
  wakeAround(x, y, radius) {
    const r2 = radius * radius;
    for (const p of this.pieces) {
      if (!p.alive) continue;
      const c = p.body.getPosition();
      const dx = c.x - x;
      const dy = c.y - y;
      if (dx * dx + dy * dy <= r2) p.body.setAwake(true);
    }
    if (this.hexBody) this.hexBody.setAwake(true);
  }

  _resolveExplosions() {
    while (this._pendingExplosions.length) {
      const boom = this._pendingExplosions.shift();
      if (!boom) break;
      const r2 = boom.radius * boom.radius;
      for (const p of this.pieces) {
        if (!p.alive) continue;
        const mat = getMaterial(p.material);
        const c = p.body.getPosition();
        const dx = c.x - boom.x;
        const dy = c.y - boom.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        if (mat.destructible) {
          this._applyDestroy(p, 'explosion');
        } else if (p.body.isDynamic()) {
          const d = Math.sqrt(d2) || 0.001;
          p.body.setAwake(true);
          p.body.applyLinearImpulse(
            new pl.Vec2((dx / d) * 4, (dy / d) * 4),
            p.body.getWorldCenter(),
            true,
          );
        }
      }
      if (this.hexBody) {
        const c = this.hexBody.getPosition();
        const dx = c.x - boom.x;
        const dy = c.y - boom.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2 * 1.6) {
          const d = Math.sqrt(d2) || 0.001;
          this.hexBody.setAwake(true);
          this.hexBody.applyLinearImpulse(
            new pl.Vec2((dx / d) * 2.2, (dy / d) * 2.6),
            this.hexBody.getWorldCenter(),
            true,
          );
        }
      }
    }
  }

  /** @param {number} dt */
  step(dt) {
    this.time += dt;

    if (this.pedestalBody && this.pedestalOscillate > 0) {
      const omega = (Math.PI * 2) / 5.2;
      const vx = this.pedestalOscillate * omega * Math.cos(this.time * omega);
      this.pedestalBody.setLinearVelocity(new pl.Vec2(vx, 0));
    }

    if (this.wind !== 0) {
      // Rajadas que trocam de lado, e nao um empurrao constante. Um vento so
      // para um lado arrastaria o hexagono para fora antes do jogador agir.
      const gust = this.wind * Math.sin(this.time * 0.78) * 0.075;
      for (const p of this.pieces) {
        if (!p.alive) continue;
        const body = p.body;
        if (!body.isAwake()) continue;
        body.applyForceToCenter(new pl.Vec2(gust * body.getMass(), 0), false);
      }
      if (this.hexBody && this.hexBody.isAwake()) {
        this.hexBody.applyForceToCenter(new pl.Vec2(gust * this.hexBody.getMass(), 0), false);
      }
    }

    this._stepping = true;
    this.world.step(dt, VEL_ITER, POS_ITER);
    this._stepping = false;

    this._updateHoldTimers(dt);

    while (this._pendingDestroy.length) {
      const item = this._pendingDestroy.shift();
      if (item) this._applyDestroy(item.piece, item.cause);
    }
    this._resolveExplosions();
    this._cullFallen();
    this._updateStars();
  }

  /**
   * Cronometro dos materiais que cedem por contato prolongado.
   *
   * So o hexagono carrega o relogio. Se qualquer peca servisse, uma torre de
   * cristal se dissolveria sozinha nos primeiros segundos e a fase se
   * resolveria sem o jogador.
   *
   * @param {number} dt
   */
  _updateHoldTimers(dt) {
    if (!this._hasHold || !this.hexBody) return;
    this._holdCharging = false;

    /** @type {Set<PieceState>} */
    const tocando = new Set();
    for (let edge = this.hexBody.getContactList(); edge; edge = edge.next) {
      if (!edge.contact || !edge.contact.isTouching()) continue;
      const piece = this.byBody.get(edge.other);
      if (!piece || !piece.alive) continue;
      if (!(getMaterial(piece.material).holdTime > 0)) continue;
      // So conta peso vindo de cima. Um rocar lateral enquanto o hexagono
      // desliza nao e "ficar em cima", e contar isso tornaria o perigo
      // impossivel de prever.
      const wm = edge.contact.getWorldManifold(null);
      if (!wm || !wm.normal || Math.abs(wm.normal.y) < 0.6) continue;
      tocando.add(piece);
    }

    for (const p of this.pieces) {
      if (!p.alive) continue;
      const mat = getMaterial(p.material);
      if (!(mat.holdTime > 0)) continue;
      if (tocando.has(p)) {
        p.holdTimer += dt;
        if (p.holdTimer >= mat.holdTime) {
          this._queueDestroy(p, mat.holdCause || 'crack');
        } else {
          this._holdCharging = true;
        }
      } else if (p.holdTimer > 0) {
        p.holdTimer = Math.max(0, p.holdTimer - dt * HOLD_DECAY);
      }
    }
  }

  _cullFallen() {
    const floor = -14;
    const sideLimit = this.towerWidth * CELL + 16;
    for (const p of this.pieces) {
      if (!p.alive || !p.body.isDynamic()) continue;
      const c = p.body.getPosition();
      if (c.y < floor || c.x < -sideLimit || c.x > sideLimit) {
        this._applyDestroy(p, 'cleanup');
      }
    }
  }

  _updateStars() {
    if (!this.hexBody) return;
    const y = this.hexBody.getPosition().y;
    while (this.starsCrossed < this.starLines.length && y <= this.starLines[this.starsCrossed]) {
      this.starsCrossed++;
    }
  }

  /** @returns {{x:number,y:number,angle:number}} */
  hexTransform() {
    if (!this.hexBody) return { x: 0, y: 0, angle: 0 };
    const p = this.hexBody.getPosition();
    return { x: p.x, y: p.y, angle: this.hexBody.getAngle() };
  }

  /** @returns {boolean} hexagono praticamente parado */
  hexAtRest() {
    if (!this.hexBody) return true;
    if (!this.hexBody.isAwake()) return true;
    const v = this.hexBody.getLinearVelocity();
    const w = Math.abs(this.hexBody.getAngularVelocity());
    return Math.hypot(v.x, v.y) < REST_LINEAR && w < REST_ANGULAR;
  }

  /** @returns {boolean} nada mais se move na cena */
  everythingAtRest() {
    // Um cristal carregando nao e repouso. O jogador real gasta esse tempo
    // parado e a peca cede; se o solucionador puder tocar antes, ele certifica
    // uma fase que na pratica nao existe.
    if (this._holdCharging) return false;
    if (!this.hexAtRest()) return false;
    for (const p of this.pieces) {
      if (!p.alive) continue;
      if (!p.body.isAwake()) continue;
      const v = p.body.getLinearVelocity();
      if (Math.hypot(v.x, v.y) > 0.22) return false;
      if (Math.abs(p.body.getAngularVelocity()) > 0.5) return false;
    }
    return true;
  }

  /** @returns {number} x atual do centro do pedestal */
  pedestalX() {
    return this.pedestalBody ? this.pedestalBody.getPosition().x : this.pedestalBaseX;
  }

  /**
   * Altura em que o hexagono e considerado no pedestal.
   * @returns {number}
   */
  winLineY() {
    return this.starLines.length ? this.starLines[this.starLines.length - 1] : this.hexRadius;
  }

  /**
   * O que sustenta o hexagono agora.
   *
   * So conta como apoio o contato ABAIXO do centro dele: o que pesa em cima ou
   * encosta acima do meio nao o segura, e tirar essa peca nao o faz descer. Da
   * metade para baixo entra tudo - o chao, a quina onde ele se escora, a peca
   * que o calca de lado pela face inclinada -, porque derrubar qualquer uma
   * dessas ainda pode faze-lo rolar.
   *
   * @returns {'dynamic'|'static'|'none'} `dynamic` se algum apoio e peca viva,
   *   `static` se todo apoio e imovel (obsidiana), `none` se nao ha apoio
   */
  _hexSupport() {
    if (!this.hexBody) return 'none';
    const cy = this.hexBody.getPosition().y;
    /** @type {'dynamic'|'static'|'none'} */
    let apoio = 'none';
    for (let edge = this.hexBody.getContactList(); edge; edge = edge.next) {
      const contact = edge.contact;
      if (!contact || !contact.isTouching()) continue;
      const wm = contact.getWorldManifold(null);
      if (!wm) continue;
      let abaixo = false;
      for (let k = 0; k < wm.pointCount; k++) {
        if (wm.points[k].y < cy) abaixo = true;
      }
      if (!abaixo) continue;
      // Cinematico conta como vivo: o pedestal que balanca carrega quem esta
      // em cima dele.
      if (!edge.other.isStatic()) return 'dynamic';
      apoio = 'static';
    }
    return apoio;
  }

  /**
   * Bomba ou TNT perto o bastante para empurrar o hexagono.
   *
   * A explosao e a unica coisa do jogo que desloca o hexagono de uma obsidiana:
   * o toque destroi a peca, nunca a empurra. `_resolveExplosions` alcanca
   * raio * 1.27, e uma celula de folga cobre a peca descer um degrau antes de
   * detonar.
   *
   * @returns {boolean}
   */
  _explosiveNearHex() {
    if (!this.hexBody) return false;
    const c = this.hexBody.getPosition();
    for (const p of this.pieces) {
      if (!p.alive || !p.body.isDynamic()) continue;
      const mat = getMaterial(p.material);
      if (!(mat.explodeRadius > 0)) continue;
      const b = this.pieceBox(p);
      if (Math.hypot(b.cx - c.x, b.cy - c.y) <= mat.explodeRadius * 1.27 + CELL) return true;
    }
    return false;
  }

  /**
   * Nada da altura do hexagono para cima ainda se move.
   *
   * E o repouso que importa para o encalhe: uma peca escorregando na direcao
   * dele e alcance que a geometria deste instante nao ve. As de baixo nao
   * entram porque a gravidade so desce - e sobre um pedestal que balanca elas
   * nunca repousam, o que seguraria o veredito indefinidamente.
   *
   * @returns {boolean}
   */
  _restAboveHex() {
    if (!this.hexBody) return true;
    const base = this.hexBody.getPosition().y - this.hexHalfHeight();
    for (const p of this.pieces) {
      if (!p.alive || !p.body.isAwake()) continue;
      if (this.pieceBox(p).top < base - 0.05) continue;
      const v = p.body.getLinearVelocity();
      if (Math.hypot(v.x, v.y) > 0.22) return false;
      if (Math.abs(p.body.getAngularVelocity()) > 0.5) return false;
    }
    return true;
  }

  /**
   * O hexagono encalhou: tudo o que o sustenta e imovel.
   *
   * O toque destroi pecas, nunca as empurra. Parado sobre obsidiana, o
   * hexagono so sai dali se o chao dele sumir - e obsidiana nao some - ou se
   * uma explosao o empurrar. Entao a fase acaba assim que ele dorme com apoio
   * so de obsidiana e sem bomba ou TNT ao alcance.
   *
   * A regra anterior perguntava se alguma peca "ainda o alcancava", e contava
   * TODA peca viva acima da base dele, sem limite de altura e com uma folga
   * lateral que cobria a torre inteira - alem de qualquer peca encostada, ate a
   * que so pesava em cima. Na pratica o jogador tinha que destruir tudo acima
   * do hexagono para a fase acabar, e como a camera segue o hexagono, a peca
   * que sobrava la no alto saia da tela e nao havia mais como toca-la: a fase
   * ficava em 'playing' para sempre.
   *
   * O gatilho continua sendo o hexagono DORMINDO, nao hexAtRest(). O sono do
   * Box2D exige meio segundo abaixo de uma tolerancia muito mais apertada
   * (0.01 m/s contra 0.16), entao um hexagono que ainda tomba devagar pela quina
   * da obsidiana nunca dispara isto - e tombar devagar e justamente o caso em
   * que encerrar a fase tiraria do jogador uma vitoria que existia. Todo toque
   * acorda o hexagono (`wakeAround`), entao o relogio recomeca a cada jogada.
   *
   * @returns {boolean}
   */
  hexStranded() {
    if (!this.hexBody || this.hexBody.isAwake()) return false;
    if (this._hexSupport() !== 'static') return false;
    if (!this._restAboveHex()) return false;
    return !this._explosiveNearHex();
  }

  /** @returns {'playing'|'won'|'lost'|'stuck'} */
  evaluate() {
    if (!this.hexBody) return 'playing';
    const p = this.hexBody.getPosition();
    const pedX = this.pedestalX();
    const onPedestalX = Math.abs(p.x - pedX) <= this.pedestalHalfWidth + this.hexRadius * 0.55;

    // Passou do nivel do pedestal por fora dele: ja era, nao ha o que segure.
    // Detectar cedo importa: o solucionador precisa saber que um lance perdeu
    // sem esperar o hexagono atravessar a tela inteira.
    if (p.y < -this.hexRadius && !onPedestalX) return 'lost';
    if (p.y < -PEDESTAL_HALF_H * 2 - 0.8) return 'lost';
    const sideLimit = (this.towerWidth * CELL) / 2 + this.pedestalHalfWidth + 3;
    if (Math.abs(p.x - this.towerCenterX) > sideLimit) return 'lost';
    if (p.y <= this.winLineY() && onPedestalX && this.hexAtRest()) {
      return 'won';
    }
    if (this.destructibleCount <= 0 && this.everythingAtRest()) {
      return p.y <= this.winLineY() && onPedestalX ? 'won' : 'stuck';
    }
    // Encalhado e o mesmo fim de jogo do 'stuck' acima - a cena parou sem o
    // hexagono no pedestal -, so que reconhecido enquanto ainda sobram pecas
    // para tocar. Cai na mesma regra de onLevelEnd: com estrela ja conquistada
    // conta como vitoria, sem estrela e derrota.
    if (this.hexStranded()) return 'stuck';
    return 'playing';
  }

  /**
   * Caixa envolvente aproximada de uma peca, em coordenadas de mundo.
   * Ignora a rotacao, o que basta para heuristicas e para a dica.
   * @param {PieceState} piece
   * @returns {{cx:number, cy:number, hw:number, hh:number, top:number, bottom:number}}
   */
  pieceBox(piece) {
    const c = piece.body.getPosition();
    const hw = (piece.cw * CELL) / 2;
    const hh = (piece.ch * CELL) / 2;
    return { cx: c.x, cy: c.y, hw, hh, top: c.y + hh, bottom: c.y - hh };
  }

  /** @returns {number} meia largura do hexagono */
  hexHalfWidth() {
    return this.hexRadius || HEX_RADIUS;
  }

  /** @returns {number} altura da base plana do hexagono em relacao ao centro */
  hexHalfHeight() {
    return (this.hexRadius || HEX_RADIUS) * 0.8660254;
  }

  /** @returns {PieceState[]} pecas ainda vivas */
  alivePieces() {
    return this.pieces.filter((p) => p.alive);
  }

  /**
   * Pecas destrutiveis expostas, isto e, sem outra peca diretamente em cima.
   * Usado pelo validador e pela dica.
   * @returns {PieceState[]}
   */
  exposedPieces() {
    const alive = this.alivePieces().filter((p) => getMaterial(p.material).destructible);
    return alive.filter((p) => {
      const c = p.body.getPosition();
      for (const other of alive) {
        if (other === p) continue;
        const o = other.body.getPosition();
        if (o.y > c.y + 0.4 && Math.abs(o.x - c.x) < (p.cw + other.cw) * 0.5 * CELL * 0.6) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Fotografa o estado completo da simulacao.
   *
   * Permite que o solucionador experimente um toque, veja o resultado e volte
   * atras. O aquecimento de contatos do solver e perdido na restauracao, o que
   * so significa que a cena reassenta em alguns passos.
   *
   * @returns {*}
   */
  snapshot() {
    /** @type {*[]} */
    const pieces = [];
    for (const p of this.pieces) {
      if (!p.alive) {
        pieces.push({ id: p.id, alive: false });
        continue;
      }
      const pos = p.body.getPosition();
      const v = p.body.getLinearVelocity();
      pieces.push({
        id: p.id,
        alive: true,
        x: pos.x,
        y: pos.y,
        a: p.body.getAngle(),
        vx: v.x,
        vy: v.y,
        w: p.body.getAngularVelocity(),
        awake: p.body.isAwake(),
        hold: p.holdTimer,
      });
    }
    const hp = this.hexBody ? this.hexBody.getPosition() : { x: 0, y: 0 };
    const hv = this.hexBody ? this.hexBody.getLinearVelocity() : { x: 0, y: 0 };
    return {
      time: this.time,
      starsCrossed: this.starsCrossed,
      destructibleCount: this.destructibleCount,
      pieces,
      hex: {
        x: hp.x,
        y: hp.y,
        a: this.hexBody ? this.hexBody.getAngle() : 0,
        vx: hv.x,
        vy: hv.y,
        w: this.hexBody ? this.hexBody.getAngularVelocity() : 0,
      },
    };
  }

  /**
   * Restaura um estado fotografado por snapshot().
   * @param {*} snap
   */
  restore(snap) {
    this._pendingDestroy.length = 0;
    this._pendingExplosions.length = 0;
    this._holdCharging = false;
    this.time = snap.time;
    this.starsCrossed = snap.starsCrossed;
    this.destructibleCount = snap.destructibleCount;

    for (let i = 0; i < this.pieces.length; i++) {
      const piece = this.pieces[i];
      const state = snap.pieces[i];
      if (!state || state.id !== piece.id) continue;
      if (state.alive && !piece.alive) {
        this._spawnBody(piece, state.x, state.y, state.a);
      } else if (!state.alive && piece.alive) {
        this.byBody.delete(piece.body);
        this.world.destroyBody(piece.body);
        piece.alive = false;
        piece.body = /** @type {*} */ (null);
        piece.holdTimer = 0;
        continue;
      }
      if (!state.alive) continue;
      piece.body.setTransform(new pl.Vec2(state.x, state.y), state.a);
      piece.body.setLinearVelocity(new pl.Vec2(state.vx, state.vy));
      piece.body.setAngularVelocity(state.w);
      piece.body.setAwake(state.awake);
      // Sem esta linha o solucionador vaza tempo de contato entre os ramos que
      // ele simula: a primeira candidata e avaliada num mundo honesto e as
      // seguintes num mundo onde o cristal sob o hexagono ja estourou o prazo.
      // A ordenacao vira artefato da ordem do laco, e a prova de que a fase e
      // vencivel - que e o que fica gravado em levels.gen.js - fica falsa. Pior
      // ainda no jogo: requestHint() roda sobre o mundo REAL, entao pedir dica
      // envelheceria a peca sob o jogador e a dica passaria a mata-lo.
      piece.holdTimer = state.hold || 0;
    }

    if (this.hexBody) {
      this.hexBody.setTransform(new pl.Vec2(snap.hex.x, snap.hex.y), snap.hex.a);
      this.hexBody.setLinearVelocity(new pl.Vec2(snap.hex.vx, snap.hex.vy));
      this.hexBody.setAngularVelocity(snap.hex.w);
      this.hexBody.setAwake(true);
    }
    if (this.pedestalBody && this.pedestalOscillate > 0) {
      const omega = (Math.PI * 2) / 5.2;
      this.pedestalBody.setTransform(
        new pl.Vec2(this.pedestalBaseX + this.pedestalOscillate * Math.sin(this.time * omega), -PEDESTAL_HALF_H),
        0,
      );
    }
  }

  destroy() {
    for (const p of this.pieces) {
      if (p.alive) {
        try {
          this.world.destroyBody(p.body);
        } catch {
          /* ignora */
        }
      }
    }
    this.pieces.length = 0;
    this.byBody.clear();
    this.hexBody = null;
    this.pedestalBody = null;
  }
}
