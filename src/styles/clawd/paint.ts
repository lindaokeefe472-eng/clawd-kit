// paint.ts — the hand-painted medium: watercolour washes, boiling ink lines, soft background fills, light, paper.
import { setSketchCanvasFactory } from './sketch/core.ts';
import { PAL, jit, random, mixCol, rgba, clamp, hash, lerp } from './core.ts';

export type Pt = [number, number];
export type Ctx = CanvasRenderingContext2D;

export function rectPts(x: number, y: number, w: number, h: number, J = 0): Pt[] {
  const p: Pt[] = [[x, y], [x + w / 2, y], [x + w, y], [x + w, y + h / 2], [x + w, y + h], [x + w / 2, y + h], [x, y + h], [x, y + h / 2]];
  return p.map(([a, b]) => [a + jit(J), b + jit(J)]);
}
export function roundRectPts(x: number, y: number, w: number, h: number, r: number, J = 0): Pt[] {
  const p: Pt[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 4; i++) { const a = a0 + (i / 4) * (Math.PI / 2); p.push([cx + Math.cos(a) * r + jit(J), cy + Math.sin(a) * r + jit(J)]); }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return p;
}
export function ellPts(cx: number, cy: number, rx: number, ry: number, n = 24, J = 0): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; p.push([cx + Math.cos(a) * rx + jit(J), cy + Math.sin(a) * ry + jit(J)]); }
  return p;
}
export function jitPts(pts: Pt[], J: number): Pt[] { return pts.map(([a, b]) => [a + jit(J), b + jit(J)]); }

export function trace(ctx: Ctx, pts: Pt[], closed = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
}
function bbox(pts: Pt[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export interface PaintOpts { wash?: string; /* wash opacity 0–1 (the clawd-mv kit's paint uses 0–255) */ washOp?: number; dk?: string; lt?: string; /* null = no outline */ ink?: string | null; /* outline width px */ sw?: number; /* pigment texture 0–1 */ tex?: number; }

// A character-style shape: flat wash, pigment pooling at the bottom and edges, light on top, a boiling ink outline.
export function paint(ctx: Ctx, pts: Pt[], o: PaintOpts = {}) {
  const sw = o.sw ?? 3, tex = o.tex ?? 1;
  if (o.wash) {
    ctx.save();
    trace(ctx, pts);
    ctx.globalAlpha = o.washOp ?? 1;
    ctx.fillStyle = o.wash;
    ctx.fill();
    if (tex > 0) {
      ctx.clip();
      const bb = bbox(pts), dk = o.dk ?? mixCol(o.wash, PAL.ink, 0.3), lt = o.lt ?? mixCol(o.wash, '#FFFFFF', 0.35);
      const g = ctx.createLinearGradient(0, bb.y + bb.h * 0.5, 0, bb.y + bb.h);
      g.addColorStop(0, rgba(dk, 0)); g.addColorStop(0.75, rgba(dk, 0.18 * tex)); g.addColorStop(1, rgba(dk, 0.36 * tex));
      ctx.fillStyle = g; ctx.fillRect(bb.x - 4, bb.y - 4, bb.w + 8, bb.h + 8);
      const g2 = ctx.createLinearGradient(0, bb.y, 0, bb.y + bb.h * 0.4);
      g2.addColorStop(0, rgba(lt, 0.28 * tex)); g2.addColorStop(1, rgba(lt, 0));
      ctx.fillStyle = g2; ctx.fillRect(bb.x - 4, bb.y - 4, bb.w + 8, bb.h + 8);
      const R = Math.max(bb.w, bb.h);
      for (let i = 0; i < 3; i++) {
        const bx = bb.x + random() * bb.w, by = bb.y + random() * bb.h, r = (0.2 + random() * 0.3) * R;
        const rg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
        const c = i === 2 ? lt : dk;
        rg.addColorStop(0, rgba(c, 0.12 * tex)); rg.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = rg; ctx.fillRect(bx - r, by - r, r * 2, r * 2);
      }
      trace(ctx, pts);
      ctx.lineWidth = Math.max(2, sw * 2.4);
      ctx.strokeStyle = rgba(dk, 0.3 * tex);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (o.ink !== null) inkLine(ctx, pts, sw, o.ink ?? PAL.ink, true);
}

// Brush ink: a main stroke, pressure swells on some segments, and a faint dry-brush ghost.
export function inkLine(ctx: Ctx, pts: Pt[], sw: number, col: string = PAL.ink, closed = false, op = 1) {
  if (pts.length < 2 || sw <= 0) return;
  ctx.save();
  ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = op;
  trace(ctx, pts, closed); ctx.lineWidth = sw; ctx.stroke();
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], k = random();
    if (k > 0.45) {
      const s0 = random() * 0.3, s1 = 0.5 + random() * 0.5;
      ctx.lineWidth = sw * (1.05 + (k - 0.45) * 0.8);
      ctx.beginPath();
      ctx.moveTo(lerp(a[0], b[0], s0), lerp(a[1], b[1], s0));
      ctx.lineTo(lerp(a[0], b[0], s1), lerp(a[1], b[1], s1));
      ctx.stroke();
    }
  }
  ctx.globalAlpha = op * 0.3; ctx.lineWidth = Math.max(0.6, sw * 0.45);
  trace(ctx, jitPts(pts, sw * 0.7), closed); ctx.stroke();
  ctx.restore();
}

function subdivide(pts: Pt[], s: number, closed = true): Pt[] {
  const out: Pt[] = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    for (let k = 0; k < 3; k++) { const f = k / 3; out.push([lerp(a[0], b[0], f) + jit(s), lerp(a[1], b[1], f) + jit(s)]); }
  }
  if (!closed) out.push(pts[pts.length - 1]);
  return out;
}

// Background watercolour: several translucent, deformed layers, with pigment gathering at the edge.
export function wcolor(ctx: Ctx, pts: Pt[], col: string, op = 0.6, layers = 4, spread = 8, edge = true) {
  ctx.save();
  ctx.fillStyle = col;
  let last: Pt[] = pts;
  for (let l = 0; l < layers; l++) {
    ctx.globalAlpha = clamp((op / layers) * 1.7);
    last = subdivide(pts, spread);
    trace(ctx, last); ctx.fill();
  }
  if (edge) {
    ctx.globalAlpha = op * 0.35; ctx.strokeStyle = mixCol(col, PAL.ink, 0.2); ctx.lineWidth = 1.6;
    trace(ctx, last); ctx.stroke();
  }
  ctx.restore();
}
export function blob(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, col: string, op = 0.5, layers = 3) {
  wcolor(ctx, ellPts(cx, cy, rx, ry, 18), col, op, layers, Math.min(rx, ry) * 0.12, false);
}
export function washRect(ctx: Ctx, x: number, y: number, w: number, h: number, stops: [number, string][], vertical = true) {
  const g = vertical ? ctx.createLinearGradient(0, y, 0, y + h) : ctx.createLinearGradient(x, 0, x + w, 0);
  stops.forEach(([k, c]) => g.addColorStop(k, c));
  ctx.save(); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore();
}

// Light: the one additive mark.
export function glow(ctx: Ctx, x: number, y: number, r: number, col = '#FFC766', a = 1) {
  if (a <= 0 || r < 1) return;
  const rr = r * (1 + jit(0.03));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
  g.addColorStop(0, rgba(col, 0.55 * a)); g.addColorStop(0.25, rgba(col, 0.3 * a)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  ctx.restore();
}

// ---------- canvas factory (browser default; node tests inject @napi-rs/canvas) ----------
type CanvasFactory = (w: number, h: number) => HTMLCanvasElement;
let makeCanvas: CanvasFactory = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
export function setCanvasFactory(f: CanvasFactory): void {
  makeCanvas = f;
  setSketchCanvasFactory(f);
  paperCache.clear();
  grainPat = null;
}

/** Local seeded generator for textures: same pixels in every process / render worker */
function texRand(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- paper ----------
const paperCache = new Map<string, HTMLCanvasElement>();
export function paperCanvas(w: number, h: number, base = PAL.paper) {
  const key = `${w}x${h}${base}`;
  const hit = paperCache.get(key); if (hit) return hit;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d')!;
  const rnd = texRand(w * 73856093 ^ h * 19349663 ^ parseInt(base.slice(1), 16));
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    const x = hash(i * 3.1) * w, y = hash(i * 7.7) * h, r = 80 + hash(i * 1.3) * 260;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = hash(i * 9.1) > 0.5;
    rg.addColorStop(0, dark ? 'rgba(150,120,90,0.05)' : 'rgba(255,250,240,0.08)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const n = Math.floor((w * h) / 90);
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h;
    g.fillStyle = rnd() > 0.5 ? 'rgba(90,70,60,0.06)' : 'rgba(255,255,255,0.10)';
    g.fillRect(x, y, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  g.strokeStyle = 'rgba(110,90,70,0.05)'; g.lineWidth = 0.8;
  for (let i = 0; i < n / 30; i++) {
    const x = rnd() * w, y = rnd() * h, a = rnd() * Math.PI, l = 4 + rnd() * 14;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(60,40,40,0)'); v.addColorStop(1, 'rgba(60,40,40,0.10)');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
  paperCache.set(key, c);
  return c;
}
let grainPat: HTMLCanvasElement | null = null;
export function grain(ctx: Ctx, w: number, h: number, a = 0.5) {
  if (!grainPat) {
    grainPat = makeCanvas(256, 256);
    const g = grainPat.getContext('2d')!; const im = g.createImageData(256, 256);
    const rnd = texRand(256256);
    for (let i = 0; i < im.data.length; i += 4) { const v = 200 + rnd() * 55; im.data[i] = v; im.data[i + 1] = v * 0.98; im.data[i + 2] = v * 0.94; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = a;
  ctx.fillStyle = ctx.createPattern(grainPat, 'repeat')!;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function label(ctx: Ctx, text: string, x: number, y: number, size = 22, col: string = PAL.ink, op = 0.78) {
  ctx.save();
  ctx.font = `${size}px "ZCOOL KuaiLe", "Patrick Hand", cursive`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = col; ctx.globalAlpha = op;
  ctx.fillText(text, x, y);
  ctx.restore();
}
