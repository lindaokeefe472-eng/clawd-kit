// anchors.ts — where parts of a clawd-mv character are, as pure geometry (no canvas).
//
// The character is drawn by sketch/character.ts through a chain of canvas transforms (pose → arm root → arm angle →
// hook). This file repeats that chain on points, so a storyboard can hang something on a hand (`attach`) without a
// hand-tuned offset. tests/attach.test.mjs draws real characters with hooks and checks these numbers against the
// transforms the canvas actually applied, so the two cannot drift apart unnoticed.
import { VIEWS, type ClawdOpts } from './sketch/character.ts';
import { clamp } from './sketch/core.ts';
import type { Pt } from './paint.ts';

/** The pose fields of a clawd-mv character's options that decide where its parts are */
export type BodyPose = Pick<ClawdOpts, 'dx' | 'dy' | 'sq' | 'take' | 'rot' | 'flip' | 'sx' | 'sy' | 'smear' | 'view' | 'aL' | 'aR'>;

const rot = ([x, y]: Pt, a: number): Pt => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/** A point of the character's body frame (in units of u, y up = negative; the feet are (0, 0)) as drawn, relative to the feet */
export function bodyPoint(o: BodyPose, u: number, p: Pt): Pt {
  const sq = (o.sq || 0) + (o.take || 0);
  const sm = clamp(o.smear || 0);
  const sx = (o.flip ? -1 : 1) * (o.sx ?? 1) * (1 + sq * 0.6) * (1 + sm * 0.35);
  const sy = (o.sy ?? 1) * (1 - sq);
  const [rx, ry] = o.rot ? rot([p[0] * u * sx, p[1] * u * sy], o.rot) : [p[0] * u * sx, p[1] * u * sy];
  return [rx + (o.dx || 0) * u, ry + (o.dy || 0) * u];
}

/**
 * Where the tip of an arm is (the point its hook is drawn at). `which` is the character's own L / R arm; a side view
 * shows one arm only, and both names give that arm. `o` and `u` are what clawd() draws with (the girl: u × 0.92, flip true).
 */
export function armTip(o: BodyPose, u: number, which: 'L' | 'R'): Pt {
  const V = VIEWS[o.view || 'front'] ?? VIEWS.front;
  const [px, dir, side] = V.arms.find((a) => a[2] === which) ?? V.arms[0];
  const a = side === 'L' ? (o.aL ?? 0.2) : (o.aR ?? 0.2);
  const root: Pt = [(px + dir * 0.55 * clamp((Math.abs(a) - 0.7) / 0.9)) * u, -4.5 * u];
  let tip: Pt;
  if (dir === 0) {
    const [dx, dy] = rot([2.1 * u, 0], 0.7 - a);
    tip = [root[0] + dx, root[1] + 0.3 * u + dy];
  } else {
    const [dx, dy] = rot([dir * 2.2 * u, 0], dir < 0 ? a : -a);
    tip = [root[0] + dx, root[1] + dy];
  }
  return bodyPoint(o, u, [tip[0] / u, tip[1] / u]);
}
