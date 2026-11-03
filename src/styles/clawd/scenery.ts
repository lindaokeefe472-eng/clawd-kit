// scenery.ts — reusable landscape brushes (from the demo film), exposed to components through ClawdApi.
import { PAL, boilSeed, hash, lerp } from './core.ts';
import { blob, inkLine, type Ctx, type Pt } from './paint.ts';

const FW = 1920, FH = 1080;

/** Closed rolling-hill polygon with its top edge around y; fill it with wcolor */
export function hillPts(y: number, amp: number, freq: number, ph: number, bottom = FH + 60, x0 = -80, x1 = FW + 80): Pt[] {
  const pts: Pt[] = [[x0, bottom]];
  for (let i = 0; i <= 16; i++) { const x = x0 + (i / 16) * (x1 - x0); pts.push([x, y + Math.sin(i * freq + ph) * amp + Math.sin(i * freq * 2.3 + ph * 1.7) * amp * 0.35]); }
  pts.push([x1, bottom]);
  return pts;
}

/** n swaying grass tufts scattered in the band y0..y1 (x across x0..x1) */
export function tufts(ctx: Ctx, n: number, y0: number, y1: number, col: string, t: number, seed: number, scale = 1, x0 = -100, x1 = FW + 100) {
  for (let i = 0; i < n; i++) {
    boilSeed('tuft' + seed + ':' + i);
    const x = x0 + hash(i * 3.7 + seed) * (x1 - x0), y = lerp(y0, y1, hash(i * 1.9 + seed)), s = (0.6 + hash(i + seed * 2) * 0.6) * scale * (0.6 + (y - y0) / (y1 - y0 + 1) * 0.6);
    const sway = Math.sin(t * 1.6 + i) * 4 * s;
    for (let b = -1; b <= 1; b++) inkLine(ctx, [[x + b * 6 * s, y], [x + b * 9 * s + sway, y - (22 + (b === 0 ? 10 : 0)) * s]], 2.4 * s, col, false, 0.85);
  }
}

export const FLOWER_COLS = [PAL.cream, PAL.rose, '#F6D27A', '#C9B6E4'];

/** n little five-petal flowers in the band y0..y1 (x across x0..x1); size grows toward y1 */
export function flowers(ctx: Ctx, n: number, y0: number, y1: number, t: number, seed: number, x0 = 0, x1 = FW, cols: readonly string[] = FLOWER_COLS) {
  for (let i = 0; i < n; i++) {
    boilSeed('fl' + seed + ':' + i);
    const x = x0 + hash(i * 5.1 + seed) * (x1 - x0), y = lerp(y0, y1, hash(i * 2.3 + seed)), s = 6 + (y - y0) / (y1 - y0 || 1) * 8;
    const sw = Math.sin(t * 1.4 + i) * 2;
    inkLine(ctx, [[x, y], [x + sw, y - s * 2]], 1.6, PAL.sap);
    for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; blob(ctx, x + sw + Math.cos(a) * s * 0.55, y - s * 2 + Math.sin(a) * s * 0.55, s * 0.45, s * 0.45, cols[i % cols.length], 0.95, 2); }
    blob(ctx, x + sw, y - s * 2, s * 0.32, s * 0.32, PAL.ochre, 1, 2);
  }
}

/** Soft four-puff watercolour cloud centred at (x, y), puff radius s */
export function cloud(ctx: Ctx, x: number, y: number, s: number, key: string, col: string = PAL.cream, op = 0.85) {
  boilSeed('cloud' + key);
  [[-1.2, 0.2, 1.1], [0, -0.3, 1.4], [1.3, 0.1, 1.0], [0.4, 0.4, 1.2]].forEach(([a, b, r]) => blob(ctx, x + a * s, y + b * s, r * s, r * 0.7 * s, col, op, 3));
}
