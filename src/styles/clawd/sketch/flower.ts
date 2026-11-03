// Vendored from clawd-mv/src/sketch — keep in sync; see core.ts for the attribution.
// flower.ts — the yellow-flower motif: a single stem, a bunch, and drifting petals.
//
// Ported from public/engine/scenes/mv_common.js. The flower is the film's motif: it opens on the beat,
// grows petal by petal, and sways on the same clock as everything else.

import {
  PAL, TAU, type Pt, type Sketch, clamp, seg, easeOut, backOut, hash, mixCol, arcPt,
  boilSeed, paint, ellPts, ribbon,
} from './core.ts';

export const YEL = '#F0C34A';     // petal
export const YELDK = '#C9961E';   // petal shadow
export const LEAF = '#7FA85A';    // stem and leaves

// grow 0..1: stem rises, then leaves, then petals open one by one. s = scale (petal radius ≈ s).
// sway = radians. `rich` adds the darker petal fill used by the hero flower.
export function flower(
  sk: Sketch, x: number, y: number, s: number,
  grow = 1, sway = 0, key = 'f', rich = key === 'hero',
): Pt {
  boilSeed(sk, 'mv flower ' + key);
  const g = clamp(grow), hs = s * 3.6 * easeOut(seg(g, 0, .45));
  const tipX = x + Math.sin(sway) * hs * .5, tipY = y - hs;
  if (hs > 2) {
    paint(sk, ribbon([[x, y], [x + Math.sin(sway) * hs * .15, y - hs * .5], [tipX, tipY]], s * .34, s * .22), { wash: LEAF, ink: PAL.ink, sw: .9, curv: .5 });
  }
  const lk = seg(g, .3, .6);
  if (lk > .02) {
    const ly = y - hs * .45, lw = s * 1.3 * lk;
    paint(sk, ellPts(sk, x - lw * .6, ly, lw * .7, s * .32 * lk, 14, 1, .5), { wash: LEAF, ink: PAL.ink, sw: .8 });
    paint(sk, ellPts(sk, x + lw * .55, ly + s * .3, lw * .6, s * .28 * lk, 14, 1, -.4), { wash: mixCol(LEAF, PAL.ink, .15), ink: PAL.ink, sw: .8 });
  }
  for (let i = 0; i < 6; i++) {
    const pk = seg(g, .5 + i * .07, .75 + i * .05); if (pk <= .02) continue;
    const a = sway * .5 - Math.PI / 2 + i / 6 * TAU, r = s * .95 * backOut(pk);
    paint(
      sk,
      ellPts(sk, tipX + Math.cos(a) * r * .9, tipY + Math.sin(a) * r * .9, r * .72, r * .46, 14, 1, a),
      rich ? { wash: YEL, fill: YELDK, fillOp: 45, tex: .5, ink: PAL.ink, sw: .8 } : { wash: YEL, ink: PAL.ink, sw: .8 },
    );
  }
  if (g > .5) paint(sk, ellPts(sk, tipX, tipY, s * .45 * seg(g, .5, .7), s * .45 * seg(g, .5, .7), 14, 1), { wash: '#B9722E', ink: PAL.ink, sw: .8 });
  return [tipX, tipY];
}

// A clump of flowers growing out of the same patch of ground.
export function bunch(sk: Sketch, t: number, x: number, y: number, s: number, n: number, grow = 1, key = 'b') {
  for (let i = 0; i < n; i++) {
    const gx = x + (hash(i + 40) - .5) * s * 9, gy = y + (hash(i + 41) - .5) * s * 1.2;
    flower(sk, gx, gy, s * (.7 + .5 * hash(i + 42)), clamp(grow * 1.4 - i / n * .4), .12 * Math.sin(t * 1.3 + i), key + i);
  }
}

// n petals released at (x, y) at t0, drifting down-right on arcs.
export function petals(sk: Sketch, t: number, t0: number, x: number, y: number, n = 10, life = 6, dir = 1) {
  for (let i = 0; i < n; i++) {
    const a = t - t0 - hash(i + 90) * life * .35; if (a < 0 || a > life) continue;
    boilSeed(sk, 'mv petal' + i);
    const k = a / life;
    const px = x + dir * (a * (60 + 120 * hash(i)) + Math.sin(a * 2 + i) * 40);
    const py = y + a * a * 22 + a * 40 * hash(i + 1) + Math.sin(a * 3 + i) * 12;
    const r = 14 + 8 * hash(i + 2), rot = a * (2 + hash(i + 3) * 2);
    paint(sk, ellPts(sk, px, py, r, r * .55, 12, 1, rot), { wash: YEL, washOp: 255 * (1 - seg(k, .8, 1)), ink: PAL.ink, sw: .7 });
  }
}

// A single petal falling between two points — handy for a close-up beat.
export function petalArc(sk: Sketch, t: number, t0: number, x0: number, y0: number, x1: number, y1: number, life = 4) {
  const k = seg(t, t0, t0 + life); if (k <= 0 || k >= 1) return;
  boilSeed(sk, 'mv petal arc');
  const [px, py] = arcPt([x0, y0], [x1, y1], 80, k);
  paint(sk, ellPts(sk, px, py, 16, 9, 12, 1, k * 6 + t), { wash: YEL, washOp: 255 * (1 - seg(k, .85, 1)), ink: PAL.ink, sw: .7 });
}
