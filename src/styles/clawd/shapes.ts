// shapes.ts — deterministic geometry helpers shared by imported catalog components.
// Ported verbatim from the watercolour-clawd kit's header so those components keep their exact outlines.
// Pure functions: no unseeded randomness, no state, safe to call from any component.
import type { Pt } from './paint.ts';

/** Deterministic sin-hash in [0, 1); different constants from core.hash so imported art does not shift */
export const hash = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 4.1414) * 43758.5453;
  return s - Math.floor(s);
};

/** Symmetric deterministic jitter in [-amp, amp] */
export const jit = (i: number, amp: number): number => (hash(i + 0.37) * 2 - 1) * amp;

export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Closed ellipse ring, optionally wobbled per point */
export const ring = (cx: number, cy: number, rx: number, ry: number, n = 40, rot = 0, wobble = 0, seed = 1): Pt[] => {
  const out: Pt[] = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (wobble ? (hash(i * 2.7 + seed * 13.1) * 2 - 1) * wobble : 0);
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
};

/** Open elliptical arc from a0 to a1 (radians) */
export const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 16): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n);
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
};

/** Rounded-rectangle outline, clockwise from the top-left corner */
export const round = (x0: number, y0: number, x1: number, y1: number, r: number, n = 5): Pt[] => {
  const rr = Math.min(r, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2);
  const out: Pt[] = [];
  const corner = (cx: number, cy: number, a0: number, a1: number) => {
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n);
      out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
  };
  corner(x1 - rr, y0 + rr, -Math.PI / 2, 0);
  corner(x1 - rr, y1 - rr, 0, Math.PI / 2);
  corner(x0 + rr, y1 - rr, Math.PI / 2, Math.PI);
  corner(x0 + rr, y0 + rr, Math.PI, Math.PI * 1.5);
  return out;
};

/** One point on an ellipse (radians) */
export const ep = (cx: number, cy: number, rx: number, ry: number, a: number): Pt => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];

/**
 * The front lip of a vessel rim as a solid band: outer rim from right → front → left, then back along the inner
 * rim. Container components use it to pin contents below the rim so they read as inside the vessel.
 */
export const lipBand = (cx: number, cy: number, rx: number, ry: number, th: number, n = 20): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push(ep(cx, cy, rx, ry, (i / n) * Math.PI));
  for (let i = n; i >= 0; i--) out.push(ep(cx, cy, rx - th * 0.85, Math.max(2, ry - th), (i / n) * Math.PI));
  return out;
};

/** Clip polygon for the area above a vessel rim: contents may only appear above the rim plane */
export const lipClip = (cx: number, cy: number, rx: number, ry: number, wide = 320): Pt[] => {
  const pts: Pt[] = [[cx - wide, cy - 900], [cx + wide, cy - 900], [cx + wide, cy]];
  for (let i = 0; i <= 24; i++) pts.push(ep(cx, cy, rx, ry, (i / 24) * Math.PI));
  pts.push([cx - wide, cy]);
  return pts;
};

/** Clip the canvas to a polygon (the caller owns save/restore) */
export const clip = (ctx: CanvasRenderingContext2D, pts: Pt[]): void => {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]);
    else ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.closePath();
  ctx.clip();
};

/** Hand-drawn straight line with a deterministic wobble (midpoint method) */
export const line = (x0: number, y0: number, x1: number, y1: number, bow = 0, n = 10, seed = 1): Pt[] => {
  const out: Pt[] = [];
  const nx = -(y1 - y0);
  const ny = x1 - x0;
  const len = Math.hypot(nx, ny) || 1;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const b = Math.sin(u * Math.PI) * bow + jit(i + seed, bow * 0.25 + 0.4);
    out.push([lerp(x0, x1, u) + (nx / len) * b, lerp(y0, y1, u) + (ny / len) * b]);
  }
  return out;
};

/** Subdivide every edge so smoothing does not round off sharp corners */
export const poly = (pts: Pt[], seg = 3): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    for (let k = 0; k < seg; k++) out.push([lerp(a[0], b[0], k / seg), lerp(a[1], b[1], k / seg)]);
  }
  return out;
};

/** Heart outline sampled from the classic parametric curve */
export const heart = (cx: number, cy: number, s: number, rot = 0, n = 28): Pt[] => {
  const out: Pt[] = [];
  const c = Math.cos(rot);
  const si = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const hx = 16 * Math.pow(Math.sin(a), 3);
    const hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
    const x = (hx / 16) * s;
    const y = (-hy / 16) * s;
    out.push([cx + x * c - y * si, cy + x * si + y * c]);
  }
  return out;
};

/** The geometry toolbox exposed as `api.shapes` */
export interface ShapesApi {
  hash: typeof hash;
  jit: typeof jit;
  lerp: typeof lerp;
  clamp01: typeof clamp01;
  ring: typeof ring;
  arc: typeof arc;
  round: typeof round;
  ep: typeof ep;
  lipBand: typeof lipBand;
  lipClip: typeof lipClip;
  clip: typeof clip;
  line: typeof line;
  poly: typeof poly;
  heart: typeof heart;
}

export const shapes: ShapesApi = {
  hash, jit, lerp, clamp01, ring, arc, round, ep, lipBand, lipClip, clip, line, poly, heart,
};
