// Vendored from clawd-mv/src/sketch (Canvas2D port of its p5 engine; upstream reference: JohnHeibel/ClaudeAnimationBase, MIT).
// Local changes: makeNoise() uses an injectable canvas factory (setSketchCanvasFactory); character.ts GIRL palette. Keep the rest in sync with clawd-mv.
// core.ts — the Canvas2D sketch kit behind the extracted components.
//
// This is a port of public/engine/core.js: palette, timing, seeded "boil" jitter, geometry, and the
// paint() / inkLine() / glow() primitives. The difference is the renderer: p5 + p5.brush are replaced by
// the plain 2D context, so a component is just `draw(sketch, ...)` and works in any canvas.
//
// A Sketch is one canvas + one moment in time. Drawing is synchronous: create it once, call
// beginFrame(sk, t) for each frame, then draw whatever the scene needs.

export const W = 1920, H = 1080;
export const TAU = Math.PI * 2;
export const BOIL = 12;                       // hand-drawn "on twos": 12 drawings per second

// Length and rhythm come from the film's config. bpm 69 drives every idle, pulse and swing.
export const PROJECT = { duration: 268, bpm: 69, offset: 0 };
export const BEAT = 60 / PROJECT.bpm;
export const OFF = PROJECT.offset;
export const DUR = PROJECT.duration;

export const PAL = {
  paper: '#F3EBDC', ink: '#2B2233', clay: '#D97757', clayDk: '#A84D33', clayLt: '#F2A283',
  night: '#1F2550', indigo: '#2F3C7A', rose: '#E27A92', ochre: '#E8AA38', sap: '#6E9F58',
  teal: '#3A9C98', violet: '#7B5CA8', cream: '#FFF5E2', sky: '#8EC3E6',
} as const;

export type Pt = [number, number];

export interface Sketch {
  ctx: CanvasRenderingContext2D;
  t: number;        // seconds
  boil: number;     // current boil frame, floor(t * BOIL)
  seed: number;     // state of the seeded RNG (see boilSeed)
  clawdN: number;   // call counter for characters without an explicit boilKey, reset each frame
  detail: number;   // 1 = full pigment texture; lower it for dense sheets where it would not be seen
  w: number;
  h: number;
}

export function createSketch(ctx: CanvasRenderingContext2D, w = W, h = H): Sketch {
  return { ctx, t: 0, boil: 0, seed: 1, clawdN: 0, detail: 1, w, h };
}

// ---------------------------------------------------------------------------------------------
// math / timing
// ---------------------------------------------------------------------------------------------

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
export const ease = (x: number) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const easeIn = (x: number) => Math.pow(clamp(x), 3);
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
export const backOut = (x: number) => { x = clamp(x); const s = 1.9; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
export const elasticOut = (x: number) => { x = clamp(x); return x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (TAU / 3)) + 1; };
export const hash = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const frac = (x: number) => x - Math.floor(x);
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const bpOf = (t: number) => (t - OFF) / BEAT;
export const beatN = (t: number) => Math.floor(bpOf(t));
export const pulse = (t: number, k = 6) => Math.exp(-frac(bpOf(t)) * k);
export const pulse2 = (t: number, k = 6) => Math.exp(-frac(bpOf(t) * 2) * k);
export const wob = (t: number, f = 1, ph = 0) => Math.sin((t * f + ph) * TAU);

// keyframes: kf(t, [[t0, v0], [t1, v1], ...], easeFn). Values may be numbers or arrays of numbers.
export function kf(t: number, keys: [number, number | number[]][], e = ease): number | number[] {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i], k = e((t - a) / (b - a));
      return Array.isArray(va) ? (va as number[]).map((v, j) => lerp(v, (vb as number[])[j], k)) : lerp(va as number, vb as number, k);
    }
  }
  return keys[keys.length - 1][1];
}

// hex colour mix
export function mixCol(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (i: number) => Math.round(lerp((pa >> i) & 255, (pb >> i) & 255, clamp(k)));
  return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
}

// Damped spring kicked at t0: 0 before, then a wobble that dies away.
export const spring = (t: number, t0: number, k = 6, w = 18) => t < t0 ? 0 : Math.exp(-k * (t - t0)) * Math.sin(w * (t - t0));
export const ring = (t: number, evs: number[], k = 6, w = 18) => evs.reduce((s, e) => s + spring(t, e, k, w), 0);
// Hold each drawing for two frames (12 drawings a second).
export const onTwos = (t: number) => Math.floor(t * 12 + 1e-6) / 12;
// Point on a thrown arc from p0 to p1, peaking h px above the straight line; k = 0..1 along the flight.
export const arcPt = (p0: Pt, p1: Pt, h: number, k: number): Pt => [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k) - h * 4 * k * (1 - k)];

// A hop that takes off at t0 and lands at t1, h body units high: crouch, stretch, squash, settle.
export function jump(t: number, t0: number, t1: number, h = 3): { dy: number; sq: number } {
  if (t < t0 - .12) return { dy: 0, sq: 0 };
  if (t < t0) return { dy: 0, sq: .18 * ease(seg(t, t0 - .12, t0)) };
  if (t < t1) { const k = (t - t0) / (t1 - t0); return { dy: -h * 4 * k * (1 - k), sq: -.16 * Math.abs(1 - 2 * k) }; }
  const a = t - t1; return { dy: 0, sq: .22 * Math.exp(-8 * a) * Math.cos(20 * a) };
}
// A surprise "take" peaking at t0: a quick squash, then a big stretch that springs back.
export function take(t: number, t0: number, amt = 1): { sq: number; dy: number } {
  if (t < t0 - .1) return { sq: 0, dy: 0 };
  if (t < t0) return { sq: .12 * amt * ease(seg(t, t0 - .1, t0)), dy: 0 };
  const a = t - t0;
  return { sq: -.26 * amt * Math.exp(-6 * a) * Math.cos(16 * a), dy: -1.2 * amt * Math.exp(-7 * a) * Math.max(0, Math.cos(9 * a)) };
}
// Walk from x0 to x1 (px) between t0 and t1 for a character of unit u.
export function stroll(t: number, t0: number, t1: number, x0: number, x1: number, u: number) {
  const x = lerp(x0, x1, ease(seg(t, t0, t1))), d = Math.abs(x - x0) / (4 * u), moving = t > t0 && t < t1;
  return { x, walk: d, view: (moving ? 'q' : 'front') as 'q' | 'front', flip: x1 < x0, dy: moving ? -Math.abs(Math.sin(d * Math.PI)) * .5 : 0 };
}

// ---------------------------------------------------------------------------------------------
// seeded randomness / boil
// ---------------------------------------------------------------------------------------------
// Every element restarts the stream from (boil frame, key), so the linework boils at 12 fps like hand-drawn
// animation, and a moving arm never shifts the randomness of the body drawn after it.

export function randomSeed(sk: Sketch, s: number) { sk.seed = (s >>> 0) || 1; }

export function rnd(sk: Sketch): number {
  sk.seed = (sk.seed + 0x6D2B79F5) >>> 0;
  let t = sk.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const jit = (sk: Sketch, a: number) => (rnd(sk) * 2 - 1) * a;

export function boilSeed(sk: Sketch, key: string | number) {
  let h = 2166136261;
  const s = key + '|' + sk.boil;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  randomSeed(sk, h >>> 0);
}

export function beginFrame(sk: Sketch, t: number) {
  sk.t = t;
  sk.boil = Math.floor(t * BOIL);
  sk.clawdN = 0;
  boilSeed(sk, 'frame');
}

// ---------------------------------------------------------------------------------------------
// transform helpers (thin aliases over the 2D context, so ports read like the p5 original)
// ---------------------------------------------------------------------------------------------

export const push = (sk: Sketch) => sk.ctx.save();
export const pop = (sk: Sketch) => sk.ctx.restore();
export const translate = (sk: Sketch, x: number, y: number) => sk.ctx.translate(x, y);
export const rotate = (sk: Sketch, a: number) => sk.ctx.rotate(a);
export const scale = (sk: Sketch, x: number, y: number) => sk.ctx.scale(x, y);

// ---------------------------------------------------------------------------------------------
// geometry
// ---------------------------------------------------------------------------------------------

export function rectPts(sk: Sketch, x: number, y: number, w: number, h: number, j = 0): Pt[] {
  const J = (a: number) => jit(sk, a);
  return [[x + J(j), y + J(j)], [x + w / 2 + J(j), y + J(j) * .5], [x + w + J(j), y + J(j)],
          [x + w + J(j) * .5, y + h / 2], [x + w + J(j), y + h + J(j)], [x + w / 2 + J(j), y + h + J(j) * .5],
          [x + J(j), y + h + J(j)], [x + J(j) * .5, y + h / 2]];
}

export function ellPts(sk: Sketch, cx: number, cy: number, rx: number, ry: number, n = 28, j = 0, rot = 0): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; p.push([cx + Math.cos(a) * rx + jit(sk, j), cy + Math.sin(a) * ry + jit(sk, j)]); }
  return p;
}

export function rrPts(sk: Sketch, x: number, y: number, w: number, h: number, r: number, j = 0): Pt[] {
  const p: Pt[] = [], seg = 5;
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= seg; i++) { const a = a0 + i / seg * Math.PI / 2; p.push([cx + Math.cos(a) * r + jit(sk, j), cy + Math.sin(a) * r + jit(sk, j)]); }
  };
  corner(x + w - r, y + r, -Math.PI / 2); corner(x + w - r, y + h - r, 0); corner(x + r, y + h - r, Math.PI / 2); corner(x + r, y + r, Math.PI);
  return p;
}

export function starPts(_sk: Sketch, cx: number, cy: number, r: number, inner = .38, n = 4, rot = -Math.PI / 2): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, q = i % 2 ? r * inner : r; p.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q]); }
  return p;
}

export function heartPts(cx: number, cy: number, r: number, n = 22): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU;
    p.push([cx + 16 * Math.pow(Math.sin(a), 3) * r / 16, cy - (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * r / 16]);
  }
  return p;
}

// Smooth curve through the points (Catmull-Rom), n samples per span. closed wraps the ends.
export function through(P: Pt[], n = 6, closed = false): Pt[] {
  if (P.length < 3) return P.slice();
  const N = P.length, out: Pt[] = [];
  const at = (i: number) => closed ? P[(i % N + N) % N] : P[Math.max(0, Math.min(N - 1, i))];
  const spans = closed ? N : N - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < n; k++) {
      const u = k / n, u2 = u * u, u3 = u2 * u;
      out.push([0, 1].map(d => .5 * (2 * p1[d] + (p2[d] - p0[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * u3)) as Pt);
    }
  }
  if (!closed) out.push(P[N - 1]);
  return out;
}

// Tapered ribbon around a path (w0 wide at the start, w1 at the end), as one closed outline.
export function ribbon(P: Pt[], w0: number, w1 = w0): Pt[] {
  const C = through(P), n = C.length, L: Pt[] = [], R: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, w = lerp(w0, w1, i / Math.max(1, n - 1)) / 2;
    L.push([C[i][0] - dy / d * w, C[i][1] + dx / d * w]);
    R.push([C[i][0] + dy / d * w, C[i][1] - dx / d * w]);
  }
  return L.concat(R.reverse());
}

// ---------------------------------------------------------------------------------------------
// paint
// ---------------------------------------------------------------------------------------------
// One call = one painted shape: optional flat wash, optional watercolour fill, optional ink outline.
// The Canvas2D kit approximates p5.brush: washes get a pooled edge, fills get pigment granulation, ink is
// drawn as a slightly rough tapered stroke.

export type BrushName = 'ink' | 'inkfine' | 'dry';

export interface PaintOpts {
  wash?: string | null;
  washOp?: number;
  fill?: string | null;
  fillOp?: number;
  bleed?: number;
  tex?: number;
  border?: number;
  ink?: string | null;      // undefined = PAL.ink outline, null = no outline
  sw?: number;
  curv?: number;
  br?: BrushName;
}

const BRUSH: Record<BrushName, { w: number; a: number }> = {
  ink: { w: 5, a: .92 },
  inkfine: { w: 2.6, a: .9 },
  dry: { w: 14, a: .35 },
};

function tracePath(sk: Sketch, pts: Pt[], closed: boolean, curv = 0) {
  const c = sk.ctx;
  const P = curv > 0 ? through(pts, Math.max(4, Math.round(4 + curv * 8)), closed) : pts;
  if (!P.length) return;
  c.beginPath();
  c.moveTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length; i++) c.lineTo(P[i][0], P[i][1]);
  if (closed) c.closePath();
}

export function paint(sk: Sketch, pts: Pt[], o: PaintOpts = {}) {
  if (!pts || pts.length < 2) return;
  const c = sk.ctx;

  if (o.wash) {
    const a = clamp((o.washOp ?? 255) / 255);
    tracePath(sk, pts, true, o.curv || 0);
    c.globalAlpha = a;
    c.fillStyle = o.wash;
    c.fill();
    // pooled pigment at the edge — watercolour is never an even flat fill
    c.globalAlpha = a * .38;
    c.strokeStyle = o.wash;
    c.lineWidth = 2.2;
    c.lineJoin = 'round';
    c.stroke();
    c.globalAlpha = 1;
  }

  if (o.fill) {
    const a = clamp((o.fillOp ?? 170) / 255) * .8, tex = o.tex ?? .4, border = o.border ?? .35, bleed = o.bleed ?? .1;
    c.save();
    tracePath(sk, pts, true, o.curv || 0);
    c.clip();
    c.globalAlpha = a;
    c.fillStyle = o.fill;
    c.fill();
    // granulation: a soft noise pattern multiplied over the pigment
    if (tex > .02 && sk.detail > .3) {
      const pat = noisePattern(sk);
      if (pat) {
        c.globalCompositeOperation = 'multiply';
        c.globalAlpha = a * tex * .55;
        c.fillStyle = pat;
        c.fill();
      }
    }
    c.globalCompositeOperation = 'source-over';
    // darker pigment where the wash meets the paper edge
    if (border > .02) {
      c.globalAlpha = a * border * .5;
      c.strokeStyle = o.fill;
      c.lineWidth = 2.5 + 9 * border * (1 + bleed);
      c.stroke();
    }
    c.restore();
    c.globalAlpha = 1;
  }

  if (o.ink !== null) {
    const br = BRUSH[o.br || 'ink'];
    const w = br.w * (o.sw ?? 1);
    c.globalAlpha = br.a * .94;
    c.strokeStyle = o.ink || PAL.ink;
    c.lineWidth = Math.max(.6, w);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    tracePath(sk, pts, true, o.curv || 0);
    c.stroke();
    // a second, thinner pass gives the outline a dry, uneven edge instead of a vector-perfect one
    if (w > 2.2) {
      c.globalAlpha = br.a * .28;
      c.lineWidth = Math.max(.5, w * .55);
      c.stroke();
    }
    c.globalAlpha = 1;
  }
}

export function inkLine(sk: Sketch, pts: Pt[], sw = 1, col: string = PAL.ink, br: BrushName = 'ink', curv = .5) {
  if (!pts || pts.length < 2) return;
  const c = sk.ctx, b = BRUSH[br];
  const P = curv > 0 ? through(pts, 8) : pts;
  const w0 = b.w * sw * 1.12, w1 = b.w * sw * .72;
  c.globalAlpha = b.a;
  c.fillStyle = col;
  c.beginPath();
  const R = ribbon(P, w0, w1);
  c.moveTo(R[0][0], R[0][1]);
  for (let i = 1; i < R.length; i++) c.lineTo(R[i][0], R[i][1]);
  c.closePath();
  c.fill();
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------------------------------------
// paper / light
// ---------------------------------------------------------------------------------------------

let noiseCanvas: HTMLCanvasElement | null = null;
const patternCache = new WeakMap<CanvasRenderingContext2D, CanvasPattern | null>();

function lcg(seed: number) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// [pixel] the noise canvas comes from an injectable factory so node renders (@napi-rs/canvas) get the pigment too
type SketchCanvasFactory = (w: number, h: number) => HTMLCanvasElement | null;
let newCanvas: SketchCanvasFactory = (w, h) => {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  return cv;
};
export function setSketchCanvasFactory(f: SketchCanvasFactory): void {
  newCanvas = f;
  noiseCanvas = null;
}

function makeNoise(): HTMLCanvasElement | null {
  if (noiseCanvas) return noiseCanvas;
  const cv = newCanvas(128, 128);
  if (!cv) return null;
  const c = cv.getContext('2d'); if (!c) return null;
  const rnd = lcg(19), id = c.createImageData(128, 128), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 190 + rnd() * 65;
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  c.putImageData(id, 0, 0);
  noiseCanvas = cv;
  return cv;
}

function noisePattern(sk: Sketch): CanvasPattern | null {
  if (patternCache.has(sk.ctx)) return patternCache.get(sk.ctx) ?? null;
  const cv = makeNoise();
  const pat = cv ? sk.ctx.createPattern(cv, 'repeat') : null;
  patternCache.set(sk.ctx, pat);
  return pat;
}

// The paper the whole film is painted on: a warm sheet with soft blooms and fibres.
export function makePaper(w = W, h = H): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); if (!c) return null;
  const rnd = lcg(11);
  c.fillStyle = PAL.paper; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * w, y = rnd() * h, r = 120 + rnd() * 380;
    const gr = c.createRadialGradient(x, y, 0, x, y, r), a = .045 * rnd();
    gr.addColorStop(0, `rgba(160,125,80,${a})`); gr.addColorStop(1, 'rgba(160,125,80,0)');
    c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  c.lineWidth = 1;
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * w, y = rnd() * h, l = 6 + rnd() * 26, a = rnd() * TAU;
    c.strokeStyle = `rgba(110,88,60,${.035 + rnd() * .06})`;
    c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(x + Math.cos(a + .6) * l * .5, y + Math.sin(a + .6) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }
  return cv;
}

let paperCanvas: HTMLCanvasElement | null = null;

// Fill the whole canvas with the paper texture (cached after the first call).
export function drawPaper(sk: Sketch) {
  if (!paperCanvas) paperCanvas = makePaper(sk.w, sk.h);
  const c = sk.ctx;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  if (paperCanvas) c.drawImage(paperCanvas, 0, 0, sk.w, sk.h);
  else { c.fillStyle = PAL.paper; c.fillRect(0, 0, sk.w, sk.h); }
  c.restore();
}

function rgba(col: string, a: number): string {
  if (!col.startsWith('#')) return col;
  let h = col.slice(1);
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a)})`;
}

// Light: ADDS a soft halo for anything that shines. The one non-paint mark in the kit.
export function glow(sk: Sketch, x: number, y: number, r: number, col = '#FFC766', a = 1) {
  if (a <= 0 || r < 1) return;
  const c = sk.ctx, rr = r * (1 + jit(sk, .03));
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, rr);
  [[0, .62], [.18, .5], [.45, .2], [.75, .05], [1, 0]].forEach(([s, al]) => g.addColorStop(s, rgba(col, al * clamp(a))));
  c.fillStyle = g;
  c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill();
  c.restore();
}

// Static grain + vignette, multiplied over the painted frame so pigment sits "in" the paper.
let grainCanvas: HTMLCanvasElement | null = null;
let grainSize = '';

function makeGrain(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); if (!c) return null;
  const rnd = lcg(5);
  const id = c.createImageData(w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 255 - (rnd() < .55 ? rnd() * rnd() * 34 : 0);
    d[i] = v; d[i + 1] = v - 1; d[i + 2] = v - 3; d[i + 3] = 255;
  }
  c.putImageData(id, 0, 0);
  const g = c.createRadialGradient(w / 2, h / 2, h * .45, w / 2, h / 2, h * 1.05);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,95,70,.35)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  return cv;
}

// Multiply the paper grain and vignette over everything painted so far. Call once, after the scene.
export function drawGrain(sk: Sketch) {
  const key = sk.w + 'x' + sk.h;
  if (grainSize !== key) { grainCanvas = makeGrain(sk.w, sk.h); grainSize = key; }
  if (!grainCanvas) return;
  const c = sk.ctx;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'multiply';
  c.drawImage(grainCanvas, 0, 0, sk.w, sk.h);
  c.restore();
}
