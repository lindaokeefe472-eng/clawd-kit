// Free-scene storyboard validator (style-aware via StyleInfo) and variety lint.
import { isThrough } from '../engine/track.ts';
import type { Step, Track } from '../engine/track.ts';
import type { StyleInfo } from './adapter.ts';
import { paramProblems } from './params.ts';
import type { ActorRef, ComponentKind, FreeProject, FreeShot, PresenterAction, PresenterView, Registry } from './types.ts';

export const MAX_SUB_CHARS = 34;
export const MAX_SUB_CPS = 7.5;
const ACTIONS: readonly PresenterAction[] = ['none', 'walk', 'turn', 'jump', 'take', 'dance', 'smear'];
const VIEWS: readonly PresenterView[] = ['front', 'q', 'side', 'qback', 'back'];

const charLen = (s: string): number => Array.from(s).length;

function trackValues(t: Track | undefined): number[] {
  if (t === undefined) return [];
  if (typeof t === 'number') return [t];
  if (isThrough(t)) return t.through.map((k) => k[1]);
  return (t as ReadonlyArray<number | readonly [number, number]>).flatMap((k) => (typeof k === 'number' ? [k] : [k[1]]));
}
function keysOk(keys: unknown, strictTimes: boolean): boolean {
  if (!Array.isArray(keys) || keys.length === 0) return false;
  if (!keys.every((k) => Array.isArray(k) && k.length === 2 && typeof k[0] === 'number' && typeof k[1] === 'number')) return false;
  return !strictTimes || keys.every((k, i) => i === 0 || k[0] > keys[i - 1][0]);
}
function trackOk(t: unknown): boolean {
  if (typeof t === 'number') return Number.isFinite(t);
  if (isThrough(t)) return keysOk(t.through, true) && (t.ends === undefined || t.ends === 'ease' || t.ends === 'linear');
  if (!Array.isArray(t) || t.length === 0) return false;
  if (t.length === 2 && typeof t[0] === 'number' && typeof t[1] === 'number') return true;
  return t.every((k) => Array.isArray(k) && k.length === 2 && typeof k[0] === 'number' && typeof k[1] === 'number');
}
function stepValues<T>(v: Step<T> | undefined): T[] {
  if (v === undefined) return [];
  if (Array.isArray(v) && v.length > 0 && Array.isArray(v[0])) return (v as ReadonlyArray<readonly [number, T]>).map((k) => k[1]);
  return [v as T];
}

/** Does a Track / Step take more than one value over the shot? (a constant or a flat key list does not) */
function varies(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (isThrough(v)) {
    const vals = v.through.map((k) => k[1]);
    return vals.some((x) => x !== vals[0]);
  }
  if (Array.isArray(v) && v.length > 0 && Array.isArray(v[0])) {
    const vals = (v as ReadonlyArray<readonly [number, unknown]>).map((k) => k[1]);
    return vals.some((x) => x !== vals[0]);
  }
  if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number') return v[0] !== v[1];
  return false;
}

function paramsVary(params: Readonly<Record<string, unknown>> | undefined): boolean {
  return Object.values(params ?? {}).some(varies);
}

type ChangeSource = 'actor' | 'background' | 'foreground' | 'presenter' | 'camera' | 'label';

/** What the storyboard makes change in this shot (labels and camera only annotate: they do not carry the line) */
function changeSources(s: FreeShot): Set<ChangeSource> {
  const out = new Set<ChangeSource>();
  if (paramsVary(s.background?.params)) out.add('background');
  const byId = new Map<string, ActorRef>();
  for (const a of s.actors ?? []) if (a.id) byId.set(a.id, a);
  const seen = new Set<string>();
  const moves = (a: ActorRef): boolean => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    if (varies(a.x) || varies(a.y) || varies(a.scale) || varies(a.flip) || paramsVary(a.params)) return true;
    if (a.attach) {
      if (varies(a.attach.dx) || varies(a.attach.dy)) return true;
      const host = byId.get(a.attach.to);
      if (host && moves(host)) return true;
    }
    return false;
  };
  for (const a of s.actors ?? []) if (moves(a)) out.add('actor');
  for (const f of s.foreground ?? []) if (varies(f.x) || varies(f.y) || varies(f.scale) || varies(f.flip) || paramsVary(f.params)) out.add('foreground');
  const p = s.presenter;
  // a constant 'dance' is the one presenter action that keeps moving on its own; walk/jump/take/turn play once at actionAt
  if (p && (varies(p.x) || varies(p.y) || varies(p.emotion) || varies(p.action) || varies(p.view) || varies(p.flip) || p.action === 'dance')) out.add('presenter');
  if (s.cam && (varies(s.cam.cx) || varies(s.cam.cy) || varies(s.cam.z))) out.add('camera');
  for (const l of s.labels ?? []) if (l.at !== undefined || l.until !== undefined || varies(l.x) || varies(l.y)) out.add('label');
  return out;
}

/**
 * none: the picture holds still. weak: only a label / the camera moves. presenter: the narrator acts.
 * strong: an actor, the background or the foreground changes — the shot itself carries the line.
 */
function changeKind(s: FreeShot): 'none' | 'weak' | 'presenter' | 'strong' {
  const src = changeSources(s);
  if (src.size === 0) return 'none';
  if (src.has('actor') || src.has('background') || src.has('foreground')) return 'strong';
  if (src.has('presenter')) return 'presenter';
  return 'weak';
}

export function validateProject(p: FreeProject, info: StyleInfo): string[] {
  const errs: string[] = [];
  if (!p.title) errs.push('project: title required');
  if (p.style !== undefined && p.style !== info.name) errs.push(`project: style "${p.style}" does not match adapter "${info.name}"`);
  const ch = p.presenter?.char;
  if (ch !== undefined && !info.presenter.chars.includes(ch)) errs.push(`project: presenter.char "${ch}" not in ${info.presenter.chars.join('|')}`);
  const cast = p.cast;
  if (cast !== undefined) {
    if (cast.host !== undefined && cast.host !== 'bean' && cast.host !== 'protagonist') errs.push('project: cast.host must be "bean" or "protagonist"');
    if (cast.characters !== undefined && !Array.isArray(cast.characters)) errs.push('project: cast.characters must be an array');
  }
  return errs;
}

export function validateFreeStoryboard<Api>(p: FreeProject, shots: readonly FreeShot[], registry: Registry<Api>, info: StyleInfo): string[] {
  const errs = validateProject(p, info);
  const { w: W, h: H } = info.world;
  const ids = new Set<string>();
  if (!shots.length) errs.push('storyboard: at least one shot required');

  shots.forEach((s, si) => {
    const w = `shot ${s.id || si}`;
    if (!s.id) errs.push(`${w}: id required`);
    else if (ids.has(s.id)) errs.push(`${w}: duplicate id`);
    ids.add(s.id);
    if (!s.chapter) errs.push(`${w}: chapter required`);
    if (!(s.dur >= 1.5 && s.dur <= 12)) errs.push(`${w}: dur must be 1.5..12 s`);
    if (!s.sub) errs.push(`${w}: sub required`);
    else {
      const len = charLen(s.sub);
      if (len > MAX_SUB_CHARS) errs.push(`${w}: sub too long (${len} > ${MAX_SUB_CHARS} chars) — split the shot`);
      if (s.dur > 0 && len / s.dur > MAX_SUB_CPS) errs.push(`${w}: sub too fast (${(len / s.dur).toFixed(1)} chars/s > ${MAX_SUB_CPS})`);
    }
    if (!s.read) errs.push(`${w}: read (viewer read) required`);
    for (const [k, v] of [['tin', s.tin], ['tout', s.tout]] as const) {
      if (v !== undefined && v !== 'cut' && !info.transitions.includes(v)) errs.push(`${w}: ${k} "${v}" not in cut|${info.transitions.join('|')} for style ${info.name}`);
    }
    if (s.panels?.length && info.name === 'clawd') errs.push(`${w}: panels are not available in style clawd yet — use labels or a component`);

    const use = (name: string | undefined, where: string, allowed: readonly ComponentKind[], params?: Record<string, unknown>): void => {
      if (!name) { errs.push(`${w}: ${where} missing "use"`); return; }
      const def = registry.get(name);
      if (!def) { errs.push(`${w}: ${where} unknown component "${name}"`); return; }
      if (!allowed.includes(def.kind)) errs.push(`${w}: ${where} "${name}" is a ${def.kind}, expected ${allowed.join('|')}`);
      errs.push(...paramProblems(def, params).map((e) => `${w}: ${where} ${e}`));
    };
    const coords = (x: unknown, y: unknown, where: string, optional: boolean): void => {
      for (const [axis, v, max] of [['x', x, W], ['y', y, H]] as const) {
        if (v === undefined) { if (!optional) errs.push(`${w}: ${where} ${axis} required`); continue; }
        if (!trackOk(v)) { errs.push(`${w}: ${where} ${axis} is not a Track`); continue; }
        const vals = trackValues(v as Track);
        const m = max * 0.25;
        if (vals.some((n) => n < -m || n > max + m)) errs.push(`${w}: ${where} ${axis} outside world 0..${max} (±${m})`);
      }
    };

    if (s.background) use(s.background.use, 'background', ['background'], s.background.params);

    const actorIds = new Set<string>();
    (s.actors ?? []).forEach((a, k) => {
      const where = `actor ${a.id ?? k}`;
      if (!a.id) errs.push(`${w}: actor at index ${k} must have a unique "id"`);
      else if (actorIds.has(a.id) || a.id === 'presenter') errs.push(`${w}: duplicate or reserved actor id "${a.id}"`);
      else actorIds.add(a.id);
      use(a.use, where, ['actor', 'prop', 'foreground'], a.params);
      if (a.attach !== undefined) {
        if (a.x !== undefined || a.y !== undefined) errs.push(`${w}: ${where} x/y are not allowed with attach — its position is the anchor's; nudge it with attach.dx / attach.dy`);
        if (a.ground) errs.push(`${w}: ${where} cannot have both attach and ground`);
      } else if (a.ground) {
        coords(a.x, a.y, where, true);
        if (a.x === undefined) errs.push(`${w}: ${where} x required (ground puts y on the surface; y is only an offset)`);
        const bgDef = s.background ? registry.get(s.background.use) : undefined;
        if (!s.background) errs.push(`${w}: ${where} ground needs a background`);
        else if (bgDef && !bgDef.surface) errs.push(`${w}: ${where} ground: background "${s.background.use}" has no surface — give the actor an explicit y`);
      } else {
        coords(a.x, a.y, where, false);
      }
      if (a.depth !== undefined && !Number.isFinite(a.depth)) errs.push(`${w}: ${where} depth must be a number`);
      if (a.scale !== undefined && trackValues(a.scale).some((v) => !(v > 0 && v <= 4))) errs.push(`${w}: ${where} scale must be in (0, 4]`);
      if (info.camera.zoom === 'integer' && a.scale !== undefined && trackValues(a.scale).some((v) => v !== 1 && v !== 2)) errs.push(`${w}: ${where} scale must be 1 or 2 in style ${info.name}`);
    });
    // attach: the host must be another actor of this shot that declares the anchor; no cycles
    const hostOf = new Map<string, string>();
    (s.actors ?? []).forEach((a, k) => {
      if (a.attach === undefined) return;
      const where = `actor ${a.id ?? k}`;
      const { to, at } = a.attach;
      for (const [axis, v] of [['dx', a.attach.dx], ['dy', a.attach.dy]] as const) if (v !== undefined && !trackOk(v)) errs.push(`${w}: ${where} attach.${axis} is not a Track`);
      if (typeof to !== 'string' || typeof at !== 'string') { errs.push(`${w}: ${where} attach needs { to: "<actor id>", at: "<anchor name>" }`); return; }
      if (to === 'presenter') { errs.push(`${w}: ${where} attach.to "presenter" is not supported — only actors declare anchors`); return; }
      if (to === a.id) { errs.push(`${w}: ${where} cannot attach to itself`); return; }
      const host = (s.actors ?? []).find((h) => h.id === to);
      if (!host) { errs.push(`${w}: ${where} attach.to "${to}" is not an actor id in this shot`); return; }
      hostOf.set(a.id, to);
      const hostDef = registry.get(host.use);
      if (!hostDef) return;
      if (!hostDef.anchorNames?.length) errs.push(`${w}: ${where} attach.to "${to}": component "${host.use}" declares no anchors`);
      else if (!hostDef.anchorNames.includes(at)) errs.push(`${w}: ${where} anchor "${at}" is not one of ${hostDef.anchorNames.join(', ')} (${host.use})`);
      if (a.attach.with !== undefined) {
        const own = registry.get(a.use);
        if (own && !own.anchorNames?.length) errs.push(`${w}: ${where} attach.with "${a.attach.with}": component "${a.use}" declares no anchors`);
        else if (own && !own.anchorNames?.includes(a.attach.with)) errs.push(`${w}: ${where} attach.with "${a.attach.with}" is not one of ${own.anchorNames?.join(', ')} (${a.use})`);
      }
    });
    for (const start of hostOf.keys()) {
      const seen = new Set<string>([start]);
      for (let cur = hostOf.get(start); cur !== undefined; cur = hostOf.get(cur)) {
        if (seen.has(cur)) { errs.push(`${w}: attach cycle through actor "${start}"`); break; }
        seen.add(cur);
      }
    }
    (s.foreground ?? []).forEach((f, k) => {
      use(f.use, `foreground ${k}`, ['foreground', 'prop'], f.params);
      coords(f.x, f.y, `foreground ${k}`, true);
    });

    const pr = s.presenter;
    if (pr) {
      coords(pr.x, pr.y, 'presenter', true);
      if (pr.x === undefined) errs.push(`${w}: presenter x required`);
      for (const e of stepValues(pr.emotion)) if (!info.presenter.emotions.includes(e)) errs.push(`${w}: presenter emotion "${e}" not in ${info.presenter.emotions.join(' ')}`);
      for (const a of stepValues(pr.action)) if (!ACTIONS.includes(a)) errs.push(`${w}: presenter action "${a}" not in ${ACTIONS.join('|')}`);
      for (const v of stepValues(pr.view)) if (!VIEWS.includes(v)) errs.push(`${w}: presenter view "${v}" not in ${VIEWS.join('|')}`);
      if (pr.hat !== undefined && !info.presenter.hats.includes(pr.hat)) errs.push(`${w}: presenter hat "${pr.hat}" not in ${info.presenter.hats.join('|')}`);
      if (pr.u !== undefined && !(pr.u >= 8 && pr.u <= 80)) errs.push(`${w}: presenter u must be 8..80`);
      if (pr.tint !== undefined && !['none', 'night', 'warm'].includes(pr.tint)) errs.push(`${w}: presenter tint "${pr.tint}" not in none|night|warm`);
      if (pr.depth !== undefined && !Number.isFinite(pr.depth)) errs.push(`${w}: presenter depth must be a number`);
    }

    if (s.cam) {
      const c = s.cam;
      for (const [k, v] of [['cx', c.cx], ['cy', c.cy], ['z', c.z]] as const) if (v !== undefined && !trackOk(v)) errs.push(`${w}: cam.${k} is not a Track`);
      const zs = trackValues(c.z);
      if (zs.some((z) => z < info.camera.min || z > info.camera.max)) errs.push(`${w}: cam.z must be ${info.camera.min}..${info.camera.max} for style ${info.name}`);
      if (info.camera.zoom === 'integer' && zs.some((z) => !Number.isInteger(z))) errs.push(`${w}: cam.z must be an integer for style ${info.name}`);
      if (c.follow !== undefined) {
        if (c.follow === 'presenter' ? !pr : !actorIds.has(c.follow)) errs.push(`${w}: cam.follow "${c.follow}" is not an actor id${pr ? ' or presenter' : ''} in this shot`);
      }
    }
    (s.labels ?? []).forEach((l, k) => {
      if (!l.text) errs.push(`${w}: label ${k} text required`);
      if (l.follow !== undefined) {
        if (l.follow === 'presenter' ? !pr : !actorIds.has(l.follow)) errs.push(`${w}: label ${k} follow "${l.follow}" is not an actor id${pr ? ' or presenter' : ''} in this shot`);
        for (const v of [l.x, l.y]) if (v !== undefined && !trackOk(v)) errs.push(`${w}: label ${k} offset is not a Track`);
      } else {
        coords(l.x, l.y, `label ${k}`, false);
      }
    });
    if (!s.background && !(s.actors?.length) && !pr) errs.push(`${w}: empty shot — needs a background, actors or the presenter`);
  });
  return errs;
}

/** Scene tags the presenter (an outside-world narrator) does not belong in: it would be the wrong size there */
export const INSIDE_TAGS: ReadonlySet<string> = new Set(['interior', 'organ', 'cross-section', 'tunnel', 'micro', 'cell']);

/** These two warnings mean the picture does not carry its line. The studio treats them as errors, not style notes. */
export const STATIC_CHANGE_MARK = 'nothing changes on screen';
export const WEAK_CHANGE_MARK = 'does not carry the line';

/** Soft warnings: repeated compositions, presenter in every shot, offscreen-feeling placements */
export function lintFreeStoryboard<Api>(shots: readonly FreeShot[], registry: Registry<Api>, info: StyleInfo): string[] {
  const warns: string[] = [];
  const sig = (s: FreeShot): string => `${s.background?.use ?? '-'}${JSON.stringify(s.background?.params ?? {})}|${(s.actors ?? []).map((a) => a.use).sort().join(',')}|${s.cam?.follow ?? ''}|${trackValues(s.cam?.z).join(',')}`;
  for (let i = 1; i < shots.length; i++) {
    if (sig(shots[i - 1]) === sig(shots[i])) warns.push(`adjacent shots "${shots[i - 1].id}" and "${shots[i].id}" share identical background, actors and camera — vary the composition`);
  }
  for (const s of shots) {
    for (const a of s.actors ?? []) {
      const def = registry.get(a.use);
      if (def && def.kind !== 'foreground' && a.layer !== 'front' && trackValues(a.y).some((y) => y > info.subtitleTop + 0.5 * def.size[1])) {
        warns.push(`shot ${s.id}: actor ${a.id} stands behind the subtitle band (y > ${info.subtitleTop})`);
      }
    }
  }
  // continuity: the same actor (id + component) in adjacent shots should not jump in size across the cut
  const firstOf = (t: Track | undefined): number => (t === undefined ? 1 : trackValues(t)[0] ?? 1);
  const lastOf = (t: Track | undefined): number => { const v = trackValues(t); return t === undefined ? 1 : v[v.length - 1] ?? 1; };
  for (let i = 1; i < shots.length; i++) {
    for (const a of shots[i].actors ?? []) {
      const b = (shots[i - 1].actors ?? []).find((x) => x.id === a.id && x.use === a.use);
      if (!b) continue;
      const r = firstOf(a.scale) / lastOf(b.scale);
      if (r < 0.75 || r > 1.33) warns.push(`actor ${a.id} jumps from scale ${lastOf(b.scale)} to ${firstOf(a.scale)} across the cut ${shots[i - 1].id} → ${shots[i].id} — start where the previous shot ended unless the change is the point`);
    }
  }
  // keyframes that only start later hold their first value before that: the actor already sits there from lt 0
  // start time of a keyed Track; constants and whole-shot [a, b] eases have none
  const keyStart = (t: unknown): number | null => {
    if (isThrough(t)) return t.through[0]?.[0] ?? null;
    if (Array.isArray(t) && Array.isArray(t[0])) return (t[0] as readonly number[])[0];
    return null;
  };
  for (const s of shots) {
    const late: string[] = [];
    for (const a of s.actors ?? []) {
      const starts = [a.x, a.y, a.scale].map(keyStart).filter((v): v is number => v !== null);
      if (starts.length && Math.min(...starts) >= 0.5) late.push(`${a.id}@${Math.min(...starts)}s`);
    }
    if (late.length) warns.push(`shot ${s.id}: ${late.join(', ')} — their Tracks only start then, so each already stands at its first position from 0s; hide them until they enter (e.g. scale [[0, 0.01], [T - 0.02, 0.01], [T, …]]) or start their keys at 0`);
  }
  // the presenter is a narrator from the outside world: inside a mouth / a cell it is the wrong size and steals focus
  const INSIDE = INSIDE_TAGS;
  const inside = shots.filter((s) => s.presenter && (registry.get(s.background?.use ?? '')?.tags ?? []).some((t) => INSIDE.has(t))).map((s) => s.id);
  if (inside.length) warns.push(`presenter stands inside a micro / interior scene in ${inside.join(', ')} — leave it out there (the protagonist carries those shots); bring it back on the outside world or the overview map`);
  // the presenter is optional: in micro / follow-the-hero shots it steals focus from the protagonist
  const withPresenter = shots.filter((s) => s.presenter).length;
  if (shots.length >= 6 && withPresenter / shots.length > 0.7) warns.push(`presenter appears in ${withPresenter} of ${shots.length} shots — keep it for the opening, key explanations and the ending; leave it out of micro / inside-the-body / follow-the-hero shots so the protagonist reads`);
  const bgs = new Set(shots.map((s) => s.background?.use).filter(Boolean));
  if (shots.length >= 6 && bgs.size <= 1) warns.push(`all ${shots.length} shots use the same background — design more than one place`);
  // one protagonist, a helper or two: a new face every few shots and nobody knows whom to follow
  const cast = new Set<string>();
  for (const s of shots) {
    if (s.presenter) cast.add('presenter');
    for (const a of [...(s.actors ?? []), ...(s.foreground ?? [])]) {
      const def = registry.get(a.use);
      if (!def) continue;
      const params = (a.params ?? {}) as Record<string, unknown>;
      const pick = (k: string): string | undefined => {
        const d = def.params?.[k];
        if (!d || d.type !== 'enum') return undefined;
        return typeof params[k] === 'string' ? (params[k] as string) : String(d.default);
      };
      if (def.tags.includes('character')) cast.add(pick('char') !== undefined ? `${a.use}:${pick('char')}` : a.use);
      // a rider param seats one of the Clawd kids (mv_swing)
      const rider = pick('rider');
      if (rider && rider !== 'none' && registry.has(`ch_clawd_${rider}`)) cast.add(`ch_clawd_${rider}`);
    }
  }
  if (cast.size > MAX_CAST) warns.push(`${cast.size} different characters appear (${[...cast].join(', ')}) — keep one protagonist and at most ${MAX_CAST - 1} others; give one character one component and turn the rest into props`);
  // a shot whose every Track / Step is constant holds the same picture for its whole duration: the line rides on
  // the subtitle alone. Labels and camera moves are not enough either — they annotate a picture, they do not carry it.
  for (const s of shots) {
    const kind = changeKind(s);
    if (kind === 'none') {
      warns.push(`shot ${s.id}: ${STATIC_CHANGE_MARK} for ${s.dur}s — every actor, param, camera and label value is constant; animate something (x/y/scale, a component param, cam, a label's at/until) or merge this line into a neighbouring shot (ignore only if stillness is the point)`);
    } else if (kind === 'weak') {
      warns.push(`shot ${s.id}: only a label or the camera moves — no actor, background or foreground changes, so the picture ${WEAK_CHANGE_MARK}; give the subject a visible action (move / scale / a component param) or merge this line into a neighbouring shot`);
    }
  }
  return warns;
}

/** Different characters one episode may show (presenter included) */
export const MAX_CAST = 3;
