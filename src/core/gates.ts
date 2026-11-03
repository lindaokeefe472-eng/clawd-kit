// Component gates shared by both styles: static scan + definition contract + determinism.
// The style supplies `renderBytes`, which draws one component alone and returns its pixels.
import { defProblems } from './registry.ts';
import { validateComponentSource } from './security.ts';
import type { ComponentDef, StyleName } from './types.ts';

export type RenderBytes<Api> = (def: ComponentDef<Api>, params: Readonly<Record<string, unknown>>, t: number, lt: number) => Uint8Array | Uint8ClampedArray;

function same(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function defaults<Api>(def: ComponentDef<Api>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(def.params ?? {}).map(([k, p]) => [k, p.default]));
}

/** Same (t, lt) twice, then after a later frame: all three must match; and something must be drawn */
/** Largest distance an anchor may sit from the component's anchor, as a multiple of its bounding box */
const ANCHOR_REACH = 3;

/** anchors() must return exactly the declared names, as finite points that are not absurdly far from the component */
export function anchorProblems<Api>(def: ComponentDef<Api>, api: Api, times: readonly number[] = [0, 1.3, 2.9]): string[] {
  if (!def.anchors && !def.anchorNames) return [];
  const names = def.anchorNames ?? [];
  const errs: string[] = [];
  const [w, h] = def.size;
  for (const t of times) {
    let pts: Readonly<Record<string, readonly [number, number]>>;
    try {
      pts = def.anchors ? def.anchors(api, defaults(def), t, t) : {};
    } catch (e) {
      return [`${def.name}: anchors() threw at t=${t}: ${e instanceof Error ? e.message : String(e)}`];
    }
    for (const n of names) {
      const p = pts[n];
      if (!p) errs.push(`${def.name}: anchors() does not return "${n}" (t=${t})`);
      else if (!Array.isArray(p) || p.length !== 2 || !p.every((v) => typeof v === 'number' && Number.isFinite(v))) errs.push(`${def.name}: anchor "${n}" is not a finite [x, y] (t=${t})`);
      else if (Math.abs(p[0]) > w * ANCHOR_REACH || Math.abs(p[1]) > h * ANCHOR_REACH) errs.push(`${def.name}: anchor "${n}" = [${p.map((v) => v.toFixed(0))}] is far outside the ${w}×${h} box (t=${t})`);
    }
    for (const n of Object.keys(pts)) if (!names.includes(n)) errs.push(`${def.name}: anchors() returns "${n}" which is not in anchorNames`);
    if (errs.length) break;
  }
  return errs;
}

/** surface() must give a finite y for every x across the world, at several times */
export function surfaceProblems<Api>(def: ComponentDef<Api>, api: Api, world: { w: number; h: number }, times: readonly number[] = [0, 1.3, 2.9]): string[] {
  if (!def.surface) return [];
  for (const t of times) {
    try {
      const f = def.surface(api, defaults(def), t, t);
      if (typeof f !== 'function') return [`${def.name}: surface() must return a function x → y`];
      for (let i = 0; i <= 8; i++) {
        const x = (world.w * i) / 8;
        const y = f(x);
        if (typeof y !== 'number' || !Number.isFinite(y) || y < -world.h || y > world.h * 2) return [`${def.name}: surface(${x.toFixed(0)}) = ${String(y)} is not a sensible y (t=${t})`];
      }
    } catch (e) {
      return [`${def.name}: surface() threw at t=${t}: ${e instanceof Error ? e.message : String(e)}`];
    }
  }
  return [];
}

export function determinismProblems<Api>(def: ComponentDef<Api>, render: RenderBytes<Api>): string[] {
  const p = defaults(def);
  const errs: string[] = [];
  const a = render(def, p, 1.3, 0.7);
  const b = render(def, p, 1.3, 0.7);
  if (!same(a, b)) errs.push(`${def.name}: repeated render at the same time differs (hidden randomness?)`);
  render(def, p, 7.9, 4.2);
  const c = render(def, p, 1.3, 0.7);
  if (!same(a, c)) errs.push(`${def.name}: render depends on frame order (state leak between frames)`);
  if (!Array.prototype.some.call(a, (v: number) => v !== 0)) errs.push(`${def.name}: draws nothing at default params`);
  return errs;
}

/** Centre of mass of the opaque pixels of an RGBA buffer (null when empty) */
function centroid(px: ArrayLike<number>, w: number): readonly [number, number] | null {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let i = 3; i < px.length; i += 4) {
    if (px[i] < 32) continue;
    const p = (i - 3) / 4;
    sx += p % w;
    sy += Math.floor(p / w);
    n++;
  }
  return n ? [sx / n, sy / n] : null;
}

/**
 * A component must not teleport between consecutive 30 fps frames at fixed params: looping offsets built with
 * frac() / % (slide, snap back) look like dropped frames once the storyboard also moves the actor.
 */
export function motionProblems<Api>(def: ComponentDef<Api>, render: RenderBytes<Api>, fps = 30): string[] {
  if (def.kind === 'background') return [];
  const base = defaults(def);
  // every enum option and both boolean values get their own run: a broken state may not be the default one
  const variants: Array<{ label: string; p: Record<string, unknown> }> = [{ label: 'defaults', p: base }];
  for (const [k, d] of Object.entries(def.params ?? {})) {
    const values = d.type === 'enum' ? (d.options ?? []) : d.type === 'boolean' ? [true, false] : [];
    for (const v of values) if (v !== d.default) variants.push({ label: `${k}=${String(v)}`, p: { ...base, [k]: v } });
  }
  const [w, h] = def.size;
  const limit = Math.max(10, 0.06 * Math.max(w, h));
  const errs: string[] = [];
  for (const { label, p } of variants) {
    // a snap-back = a big one-frame jump right after drifting the opposite way about as far (slide, then reset);
    // pop-ins (an emote appearing) and landings jump without such a drift and are fine
    // the slide must also be (nearly) straight: a hop goes up and down before its landing pop, a sawtooth only one way
    const pts: Array<readonly [number, number] | null> = [];
    let worst = { d: 0, t: 0 };
    let lastJump = 0;
    for (let f = 0; f <= fps * 3; f++) {
      const t = 0.5 + f / fps;
      const c = centroid(render(def, p, t, t), w);
      const prev = pts[pts.length - 1];
      if (c && prev) {
        const jx = c[0] - prev[0];
        const jy = c[1] - prev[1];
        const d = Math.hypot(jx, jy);
        if (d > limit) {
          // look back to the previous big jump (at most a second), so a fast sawtooth is judged on one slide
          const from = Math.max(0, pts.length - 1 - fps, lastJump);
          const back = pts[from];
          let path = 0;
          for (let i = from + 1; i < pts.length; i++) {
            const a = pts[i - 1];
            const b = pts[i];
            if (a && b) path += Math.hypot(b[0] - a[0], b[1] - a[1]);
          }
          if (back) {
            // drift before the jump, projected on the jump direction (negative = opposite)
            const drift = ((prev[0] - back[0]) * jx + (prev[1] - back[1]) * jy) / d;
            if (-drift >= 0.5 * d && -drift >= 0.7 * path && d > worst.d) worst = { d, t };
          }
          lastJump = pts.length;
        }
      }
      pts.push(c);
    }
    if (worst.d > 0) errs.push(`${def.name} (${label}): the drawing slides and then snaps back ${Math.round(worst.d)} px in one frame (at t ≈ ${worst.t.toFixed(2)} s) — do not loop positions with frac()/% (it slides and snaps back); let the storyboard's x/y Tracks move the actor`);
  }
  return errs;
}

/** What the storyboard declared for a new component (newComponents[] entry) */
export interface ComponentContract {
  name: string;
  kind: string;
  size: readonly number[];
  params?: Readonly<Record<string, { type?: string; options?: readonly string[] }>>;
  /** Anchor names the component must declare (e.g. a held prop's `grip`) */
  anchors?: readonly string[];
}

/** The drawn component must match its declaration, or the storyboard that uses it will not line up */
export function contractProblems<Api>(def: ComponentDef<Api>, c: ComponentContract): string[] {
  const errs: string[] = [];
  if (def.name !== c.name) errs.push(`name "${def.name}" but the storyboard declared "${c.name}"`);
  if (def.kind !== c.kind) errs.push(`kind "${def.kind}" but the storyboard declared "${c.kind}"`);
  if (def.size[0] !== c.size[0] || def.size[1] !== c.size[1]) errs.push(`size [${def.size.join(',')}] but the storyboard declared [${c.size.join(',')}]`);
  for (const a of c.anchors ?? []) if (!(def.anchorNames ?? []).includes(a)) errs.push(`missing anchor "${a}" (declare anchorNames: ["${a}"] and return it from anchors())`);
  const have = def.params ?? {};
  for (const [k, want] of Object.entries(c.params ?? {})) {
    const p = have[k];
    if (!p) { errs.push(`missing param "${k}" declared by the storyboard`); continue; }
    if (want.type && p.type !== want.type) errs.push(`param "${k}" is ${p.type} but the storyboard declared ${want.type}`);
    for (const o of want.options ?? []) if (!(p.options ?? []).includes(o)) errs.push(`param "${k}" lacks option "${o}" used by the storyboard`);
  }
  return errs;
}

export interface GateReport {
  ok: boolean;
  errors: string[];
}

/** Full gate for a model-authored file: scan source text, then check the loaded definition */
export function gateComponent<Api>(source: string, file: string, def: ComponentDef<Api> | undefined, style: StyleName, world: { w: number; h: number }, render: RenderBytes<Api>, anchorApi?: Api): GateReport {
  const errors: string[] = [];
  try {
    validateComponentSource(source, file, { style });
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
  }
  if (!def) return { ok: false, errors: [`${file}: no component definition exported`] };
  errors.push(...defProblems(def, style, world));
  if (!errors.length && anchorApi !== undefined) errors.push(...anchorProblems(def, anchorApi), ...surfaceProblems(def, anchorApi, world));
  if (!errors.length) {
    try {
      errors.push(...determinismProblems(def, render));
      if (!errors.length && style === 'clawd') errors.push(...motionProblems(def, render));
    } catch (e) {
      errors.push(`${def.name}: draw threw: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
