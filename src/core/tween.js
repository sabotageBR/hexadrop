/** Sistema minimo de interpolacao, alimentado pelo loop principal. */

export const Ease = {
  /** @param {number} t */ linear: (t) => t,
  /** @param {number} t */ quadOut: (t) => 1 - (1 - t) * (1 - t),
  /** @param {number} t */ quadIn: (t) => t * t,
  /** @param {number} t */ cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  /** @param {number} t */ cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  /** @param {number} t */ backOut: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  /** @param {number} t */ elasticOut: (t) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  /** @param {number} t */ bounceOut: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

/**
 * @typedef {object} TweenEntry
 * @property {object} target
 * @property {Record<string, [number, number]>} props
 * @property {number} duration
 * @property {number} elapsed
 * @property {number} delay
 * @property {(t:number)=>number} ease
 * @property {(()=>void)|null} onDone
 * @property {boolean} done
 */

export class Tweens {
  constructor() {
    /** @type {TweenEntry[]} */
    this.list = [];
  }

  /**
   * @param {object} target
   * @param {Record<string, number>} props
   * @param {number} duration segundos
   * @param {object} [opts]
   * @param {(t:number)=>number} [opts.ease]
   * @param {number} [opts.delay]
   * @param {()=>void} [opts.onDone]
   * @returns {TweenEntry}
   */
  to(target, props, duration, opts = {}) {
    /** @type {Record<string, [number, number]>} */
    const pairs = {};
    for (const key of Object.keys(props)) {
      pairs[key] = [Number(target[key]) || 0, props[key]];
    }
    const entry = {
      target,
      props: pairs,
      duration: Math.max(0.0001, duration),
      elapsed: 0,
      delay: opts.delay || 0,
      ease: opts.ease || Ease.quadOut,
      onDone: opts.onDone || null,
      done: false,
    };
    this.list.push(entry);
    return entry;
  }

  /** @param {object} target remove todos os tweens desse alvo */
  cancel(target) {
    this.list = this.list.filter((e) => e.target !== target);
  }

  clear() {
    this.list.length = 0;
  }

  /** @param {number} dt segundos */
  update(dt) {
    if (!this.list.length) return;
    for (const entry of this.list) {
      if (entry.delay > 0) {
        entry.delay -= dt;
        if (entry.delay > 0) continue;
        dt += entry.delay;
      }
      entry.elapsed += dt;
      const raw = Math.min(1, entry.elapsed / entry.duration);
      const k = entry.ease(raw);
      for (const key of Object.keys(entry.props)) {
        const [from, to] = entry.props[key];
        entry.target[key] = from + (to - from) * k;
      }
      if (raw >= 1) {
        entry.done = true;
        if (entry.onDone) entry.onDone();
      }
    }
    this.list = this.list.filter((e) => !e.done);
  }
}
