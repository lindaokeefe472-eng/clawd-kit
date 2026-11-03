// Vendored from clawd-mv/src/sketch — keep in sync; see core.ts for the attribution.
// swing.ts — the A-frame swing the two characters share.
//
// Ported from public/engine/scenes/mv_common.js. The frame stands on the ground at (x, y); the seat hangs
// from a bar h px up and swings by `ang` radians. Returns the seat centre and angle so a character can be
// planted on it:
//
//   const [sx, sy, ang] = swing(sk, 900, 840, 320, swingAng(t, .12));
//   boy(sk, sx, sy - 2, 22, { ...feel('happy', t), noShadow: true, rot: ang, dy: -1.2 });

import { PAL, TAU, type Pt, type Sketch, bpOf, boilSeed, paint, inkLine, rectPts, ribbon } from './core.ts';

export type SwingSeat = [number, number, number];   // seat x, seat y, angle

export function swing(sk: Sketch, x: number, y: number, h = 300, ang = 0, col = '#8A5A3C'): SwingSeat {
  boilSeed(sk, 'mv swing');
  const top = y - h, J = 3;
  // A-frame: four legs, the far pair a shade darker
  paint(sk, ribbon([[x - 230, y], [x - 150, top]], 18, 14), { wash: col, ink: PAL.ink, sw: 1 });
  paint(sk, ribbon([[x - 70, y], [x - 150, top]], 18, 14), { wash: col, ink: PAL.ink, sw: 1 });
  paint(sk, ribbon([[x + 230, y], [x + 150, top]], 18, 14), { wash: col, ink: PAL.ink, sw: 1 });
  paint(sk, ribbon([[x + 70, y], [x + 150, top]], 18, 14), { wash: col, ink: PAL.ink, sw: 1 });
  paint(sk, rectPts(sk, x - 170, top - 14, 340, 22, J), { wash: col, ink: PAL.ink, sw: 1 });

  // ropes + seat, hanging from the bar and rotated around it
  const L = h * .78, sx = x + Math.sin(ang) * L, sy = top + Math.cos(ang) * L;
  inkLine(sk, [[x - 50, top], [sx - 50 * Math.cos(ang), sy - 50 * Math.sin(ang)]], 1.6, '#6B5040', 'ink', 0);
  inkLine(sk, [[x + 50, top], [sx + 50 * Math.cos(ang), sy + 50 * Math.sin(ang)]], 1.6, '#6B5040', 'ink', 0);
  sk.ctx.save();
  sk.ctx.translate(sx, sy);
  sk.ctx.rotate(ang);
  paint(sk, rectPts(sk, -70, -8, 140, 18, 2), { wash: '#A86E46', ink: PAL.ink, sw: 1 });
  sk.ctx.restore();

  return [sx, sy, ang];
}

// Beat-locked swing angle: amplitude amp (rad), one full swing every two bars.
export function swingAng(t: number, amp: number, ph = 0): number {
  return amp * Math.sin((bpOf(t) / 4 + ph) * TAU);
}

// The two ropes as points, if a caller wants to draw something along them.
export function swingRopes(x: number, y: number, h: number, ang: number): [Pt, Pt][] {
  const top = y - h, L = h * .78;
  const sx = x + Math.sin(ang) * L, sy = top + Math.cos(ang) * L;
  return [
    [[x - 50, top], [sx - 50 * Math.cos(ang), sy - 50 * Math.sin(ang)]],
    [[x + 50, top], [sx + 50 * Math.cos(ang), sy + 50 * Math.sin(ang)]],
  ];
}
