// Keyframe tracks: every animatable storyboard field is a Track evaluated at shot-local time lt
import { clamp, easeInOutQuad, lerp } from './palette.ts';

/**
 * - `5`                    constant
 * - `[0, 10]`              ease from 0 to 10 across the whole shot
 * - `[[0, 0], [1.5, 10]]`  keyframes at lt seconds (eased between, held outside)
 * - `{ through: [[0, 0], [1, 4], [3, 9]] }`  waypoints passed at their times without stopping
 *   (monotone cubic, no overshoot); ends ease in/out unless `ends: 'linear'`
 */
export interface ThroughTrack {
  readonly through: ReadonlyArray<readonly [number, number]>;
  readonly ends?: 'ease' | 'linear';
}
export type Track = number | readonly [number, number] | ReadonlyArray<readonly [number, number]> | ThroughTrack;
/** Discrete value or `[[lt, value], ...]` switching at key times */
export type Step<T> = T | ReadonlyArray<readonly [number, T]>;

function isKeyframes(track: Track): track is ReadonlyArray<readonly [number, number]> {
  return Array.isArray(track) && Array.isArray(track[0]);
}

export function isThrough(track: unknown): track is ThroughTrack {
  return typeof track === 'object' && track !== null && !Array.isArray(track) && 'through' in track;
}

/** Monotone cubic Hermite (Fritsch–Carlson) through the keys; end tangents 0 (ease) or the end slope (linear) */
function evalThrough(tr: ThroughTrack, lt: number): number {
  const k = tr.through;
  const n = k.length;
  if (n === 0) return 0;
  if (n === 1 || lt <= k[0][0]) return k[0][1];
  if (lt >= k[n - 1][0]) return k[n - 1][1];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((k[i + 1][1] - k[i][1]) / (k[i + 1][0] - k[i][0] || 1));
  const m: number[] = new Array(n).fill(0);
  const linear = tr.ends === 'linear';
  m[0] = linear ? d[0] : 0;
  m[n - 1] = linear ? d[n - 2] : 0;
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const h = a * a + b * b;
    if (h > 9) { const tau = 3 / Math.sqrt(h); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; }
  }
  let i = 0;
  while (i < n - 2 && lt >= k[i + 1][0]) i++;
  const [t0, v0] = k[i];
  const [t1, v1] = k[i + 1];
  const hgt = t1 - t0 || 1;
  const u = (lt - t0) / hgt;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * hgt * m[i] + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * hgt * m[i + 1];
}

export function evalTrack(track: Track | undefined, lt: number, dur: number, fallback = 0): number {
  if (track === undefined) return fallback;
  if (typeof track === 'number') return track;
  if (isThrough(track)) return evalThrough(track, lt);
  if (!isKeyframes(track)) {
    const [a, b] = track as readonly [number, number];
    return lerp(a, b, easeInOutQuad(clamp(lt / (dur || 1), 0, 1)));
  }
  const keys = track;
  if (lt <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i];
    const [t1, v1] = keys[i + 1];
    if (lt < t1) return lerp(v0, v1, easeInOutQuad((lt - t0) / (t1 - t0 || 1)));
  }
  return keys[keys.length - 1][1];
}

/** Direction of motion (-1, 0, 1) of a track at lt; used to auto-switch walk pose and facing */
export function trackMoving(track: Track | undefined, lt: number, dur: number): -1 | 0 | 1 {
  if (track === undefined || typeof track === 'number') return 0;
  const a = evalTrack(track, lt - 0.02, dur);
  const b = evalTrack(track, lt + 0.02, dur);
  if (Math.abs(b - a) < 0.05) return 0;
  return b > a ? 1 : -1;
}

function isStepKeys<T>(v: Step<T>): v is ReadonlyArray<readonly [number, T]> {
  return Array.isArray(v) && v.length > 0 && Array.isArray(v[0]) && typeof (v[0] as readonly unknown[])[0] === 'number';
}

export function evalStep<T>(v: Step<T> | undefined, lt: number, fallback: T): T {
  if (v === undefined) return fallback;
  if (!isStepKeys(v)) return v as T;
  let cur = fallback;
  for (const [t, val] of v) {
    if (lt >= t) cur = val;
    else break;
  }
  return cur;
}

/** Time since the current step value became active (for pop-in animations) */
export function stepAge<T>(v: Step<T> | undefined, lt: number): number {
  if (v === undefined || !isStepKeys(v)) return lt;
  let since = 0;
  for (const [t] of v) {
    if (lt >= t) since = t;
    else break;
  }
  return lt - since;
}
