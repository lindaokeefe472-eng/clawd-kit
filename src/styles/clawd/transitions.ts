// transitions.ts — ink transitions shared by the demo film and the clawd StyleAdapter.
import { boilSeed, ease, seg, jit, hash } from './core.ts';
import { wcolor, ellPts, trace, type Ctx, type Pt } from './paint.ts';

const FW = 1920, FH = 1080;

// ---------- transitions ----------
export function brushMask(ctx: Ctx, k: number, key: string, dir = 1) {
  boilSeed('mask' + key);
  const N = 7, bh = FH / (N - 1.5);
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const p = ease(seg(k, i * 0.06, i * 0.06 + 0.58));
    if (p <= 0) continue;
    const y = -bh * 0.4 + i * (FH + bh * 0.8) / N, xe = -220 + p * (FW + 480);
    const pts: Pt[] = [];
    for (let s = 0; s <= 10; s++) pts.push([-260 + (s / 10) * (xe + 260), y - bh * 0.62 + Math.sin(s * 1.3 + i) * 12 + jit(4)]);
    for (let s = 0; s <= 6; s++) { const a = -Math.PI / 2 + (s / 6) * Math.PI; pts.push([xe + Math.cos(a) * 60, y + Math.sin(a) * bh * 0.62]); }
    for (let s = 10; s >= 0; s--) pts.push([-260 + (s / 10) * (xe + 260), y + bh * 0.62 + Math.sin(s * 1.1 + i * 2) * 12 + jit(4)]);
    const P = dir > 0 ? pts : pts.map(([x, yy]) => [FW - x, yy] as Pt);
    ctx.moveTo(P[0][0], P[0][1]);
    P.forEach(([x, yy]) => ctx.lineTo(x, yy));
    ctx.closePath();
  }
}
export function brushEdges(ctx: Ctx, k: number, key: string, col: string) {
  boilSeed('edge' + key);
  const N = 7, bh = FH / (N - 1.5);
  for (let i = 0; i < N; i++) {
    const p = ease(seg(k, i * 0.06, i * 0.06 + 0.58));
    if (p <= 0 || p >= 1) continue;
    const y = -bh * 0.4 + i * (FH + bh * 0.8) / N, xe = -220 + p * (FW + 480);
    wcolor(ctx, ellPts(xe - 10, y, 70, bh * 0.6, 16), col, 0.55, 3, 10, false);
  }
}
export function withClip(ctx: Ctx, mask: () => void, draw: () => void) {
  ctx.save(); mask(); ctx.clip(); draw(); ctx.restore();
}
export function irisPath(ctx: Ctx, x: number, y: number, r: number, key: string) {
  boilSeed('iris' + key);
  trace(ctx, ellPts(x, y, Math.max(0.1, r), Math.max(0.1, r), 40, Math.min(10, r * 0.03)));
}

export function dripPath(ctx: Ctx, k: number) {
  boilSeed('drip');
  const yb = -120 + k * (FH + 260);
  const pts: Pt[] = [[-50, -50], [FW + 50, -50]];
  for (let i = 0; i <= 24; i++) { const x = FW + 50 - (i / 24) * (FW + 100); pts.push([x, yb + Math.sin(i * 1.7) * 40 + (hash(i) > 0.7 ? hash(i * 3) * 90 : 0) + jit(5)]); }
  trace(ctx, pts);
}
