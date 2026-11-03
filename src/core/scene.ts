// Free-scene resolver: one shot + shot time -> ordered draw list and camera, independent of style.
import { clamp } from '../engine/palette.ts';
import { evalStep, evalTrack, stepAge } from '../engine/track.ts';
import type { Step, Track } from '../engine/track.ts';
import type { StyleInfo } from './adapter.ts';
import { paramAges, resolveParams } from './params.ts';
import type {
  ActorRef, ComponentDef, FreeProject, FreeShot, PresenterAction, PresenterRef, PresenterView, Registry,
  ResolvedCam, ResolvedInstance, ResolvedPresenter, ResolvedScene, SceneItem,
} from './types.ts';

const WALK_DT = 1 / 24;
/** Gap between a followed actor's head-top and the label's pointer tip */
export const LABEL_GAP = 10;

/** Distance travelled along a Track from 0 to lt, sampled at 24 fps (deterministic) */
function travelled(track: Track, lt: number, dur: number): number {
  if (typeof track === 'number' || lt <= 0) return 0;
  let d = 0;
  let prev = evalTrack(track, 0, dur);
  for (let s = WALK_DT; s < lt + WALK_DT; s += WALK_DT) {
    const v = evalTrack(track, Math.min(s, lt), dur);
    d += Math.abs(v - prev);
    prev = v;
  }
  return d;
}

function velocity(track: Track, lt: number, dur: number): number {
  if (typeof track === 'number') return 0;
  return (evalTrack(track, lt + 0.03, dur) - evalTrack(track, lt - 0.03, dur)) / 0.06;
}

function stepStart<T>(v: Step<T> | undefined, lt: number): number {
  return lt - stepAge(v, lt);
}

function emotionKeys(e: Step<string> | undefined): ReadonlyArray<readonly [number, string]> {
  if (e === undefined) return [[0, 'calm']];
  if (typeof e === 'string') return [[0, e]];
  return e.length ? e : [[0, 'calm']];
}

export function resolvePresenter(p: PresenterRef, info: StyleInfo, project: FreeProject, lt: number, dur: number): ResolvedPresenter {
  const x = evalTrack(p.x, lt, dur);
  const y = evalTrack(p.y, lt, dur, info.presenter.defaultY);
  const vx = velocity(p.x, lt, dur);
  const still = info.world.w * 0.01;
  const moving = Math.abs(vx) > still;
  const action: PresenterAction = evalStep(p.action, lt, moving ? 'walk' : 'none');
  // facing: explicit flip wins; walking faces the way it walks; standing faces the middle of the frame,
  // so a presenter on the right half never turns its back on what it is explaining
  const flip = p.flip !== undefined ? evalStep(p.flip, lt, false) : Math.abs(vx) > still ? vx < 0 : x > info.world.w / 2;
  const view: PresenterView = evalStep(p.view, lt, moving ? 'q' : 'front');
  return {
    char: project.presenter?.char ?? info.presenter.defaultChar,
    x, y,
    u: p.u ?? info.presenter.defaultU,
    flip, view,
    emotions: emotionKeys(p.emotion),
    action,
    actionAt: stepStart(p.action, lt),
    walked: travelled(p.x, lt, dur),
    moving: moving || action === 'walk',
    hat: p.hat ?? 'none',
    tint: p.tint ?? 'none',
  };
}

function instance<Api>(def: ComponentDef<Api>, id: string, ref: { x?: Track; y?: Track; scale?: Track; flip?: Step<boolean>; params?: Record<string, unknown> }, lt: number, dur: number, info: StyleInfo): ResolvedInstance<Api> {
  return {
    id,
    def,
    x: evalTrack(ref.x, lt, dur, info.world.w / 2),
    y: evalTrack(ref.y, lt, dur, info.world.h),
    scale: evalTrack(ref.scale, lt, dur, 1),
    flip: evalStep(ref.flip, lt, false),
    params: resolveParams(def, ref.params, lt, dur),
    ages: paramAges(def, ref.params, lt),
  };
}

/** Camera centre/zoom; follow tracks an actor or the presenter; the view is clamped inside the world */
export function resolveCam(shot: FreeShot, lt: number, info: StyleInfo, positions: ReadonlyMap<string, readonly [number, number]>): ResolvedCam {
  const { w, h } = info.world;
  const c = shot.cam ?? {};
  let z = clamp(evalTrack(c.z, lt, shot.dur, info.camera.min), info.camera.min, info.camera.max);
  if (info.camera.zoom === 'integer') z = Math.round(z);
  let cx = evalTrack(c.cx, lt, shot.dur, w / 2);
  let cy = evalTrack(c.cy, lt, shot.dur, h / 2);
  const target = c.follow !== undefined ? positions.get(c.follow) : undefined;
  if (target) [cx, cy] = target;
  const vw = w / z;
  const vh = h / z;
  return { cx: clamp(cx, vw / 2, w - vw / 2), cy: clamp(cy, vh / 2, h - vh / 2), z };
}

/** What attach / ground need beyond the storyboard: film time and the style's (drawing-free) api for `anchors` / `surface` */
export interface SceneGeometry<Api> {
  t: number;
  api: Api;
}

export function resolveFreeShot<Api>(project: FreeProject, shot: FreeShot, lt: number, registry: Registry<Api>, info: StyleInfo, geo?: SceneGeometry<Api>): ResolvedScene<Api> {
  const dur = shot.dur;
  const bgDef = shot.background ? registry.get(shot.background.use) : undefined;
  const background = bgDef && shot.background ? { ...instance(bgDef, 'bg', { x: info.world.w / 2, y: info.world.h, params: shot.background.params }, lt, dur, info) } : null;

  const sorted: { y: number; item: SceneItem<Api> }[] = [];
  const front: SceneItem<Api>[] = [];
  const positions = new Map<string, readonly [number, number]>();
  const tops = new Map<string, readonly [number, number]>();

  const actors = shot.actors ?? [];
  const byId = new Map(actors.map((a) => [a.id, a]));
  interface Placed {
    inst: ResolvedInstance<Api>;
    key: number;
    front: boolean;
    /** id of the host this actor is drawn right behind (attached, no depth / layer of its own) */
    after: string | null;
  }
  const placed = new Map<string, Placed>();
  const visiting = new Set<string>();
  /** actors drawn right behind a host: host id → its followers, in storyboard order */
  const followers = new Map<string, SceneItem<Api>[]>();
  const surfaceOf = (): ((x: number) => number) | null => (background && bgDef?.surface && geo ? bgDef.surface(geo.api, background.params, geo.t, lt) : null);

  /** Place one actor (its host first, when it is attached) and return where it ended up */
  const place = (a: ActorRef): Placed | null => {
    const known = placed.get(a.id);
    if (known) return known;
    const def = registry.get(a.use);
    if (!def) return null;
    if (visiting.has(a.id)) throw new Error(`actor "${a.id}": attach cycle`);
    visiting.add(a.id);
    let inst: ResolvedInstance<Api>;
    let hostPlace: Placed | null = null;
    if (a.attach) {
      const hostRef = byId.get(a.attach.to);
      hostPlace = hostRef ? place(hostRef) : null;
      if (!hostPlace) throw new Error(`actor "${a.id}": attach.to "${a.attach.to}" is not an actor of shot ${shot.id}`);
      if (!geo) throw new Error(`actor "${a.id}": attach needs the style geometry (pass { t, api } to resolveFreeShot)`);
      const host = hostPlace.inst;
      if (!host.def.anchors) throw new Error(`actor "${a.id}": "${host.def.name}" declares no anchors to attach to`);
      const pt = host.def.anchors(geo.api, host.params, geo.t, lt)[a.attach.at];
      if (!pt) throw new Error(`actor "${a.id}": "${host.def.name}" has no anchor "${a.attach.at}" (it has ${(host.def.anchorNames ?? []).join(', ')})`);
      const tx = host.x + (host.flip ? -pt[0] : pt[0]) * host.scale + evalTrack(a.attach.dx, lt, dur, 0);
      const ty = host.y + pt[1] * host.scale + evalTrack(a.attach.dy, lt, dur, 0);
      inst = instance(def, a.id, { ...a, x: tx, y: ty }, lt, dur, info);
      if (a.attach.with !== undefined) {
        // put the actor's own anchor (not its origin) on the point
        if (!def.anchors) throw new Error(`actor "${a.id}": attach.with "${a.attach.with}" but "${def.name}" declares no anchors`);
        const own = def.anchors(geo.api, inst.params, geo.t, lt)[a.attach.with];
        if (!own) throw new Error(`actor "${a.id}": "${def.name}" has no anchor "${a.attach.with}" (it has ${(def.anchorNames ?? []).join(', ')})`);
        inst = { ...inst, x: tx - (inst.flip ? -own[0] : own[0]) * inst.scale, y: ty - own[1] * inst.scale };
      }
    } else if (a.ground) {
      const surface = surfaceOf();
      if (!surface) throw new Error(`actor "${a.id}": ground needs a background with a surface (and the style geometry)`);
      const x = evalTrack(a.x, lt, dur, info.world.w / 2);
      inst = instance(def, a.id, { ...a, x, y: surface(x) + evalTrack(a.y, lt, dur, 0) }, lt, dur, info);
    } else {
      inst = instance(def, a.id, a, lt, dur, info);
    }
    visiting.delete(a.id);
    // an attached actor is drawn right behind its host (same layer) unless it sets a depth or layer of its own
    const after = hostPlace !== null && a.depth === undefined && a.layer === undefined && def.kind !== 'foreground' ? hostPlace.inst.id : null;
    const out: Placed = { inst, key: a.depth ?? inst.y, front: a.layer === 'front' || def.kind === 'foreground', after };
    placed.set(a.id, out);
    return out;
  };

  const addActor = (a: ActorRef): void => {
    const p = place(a);
    if (!p) return;
    const { inst } = p;
    positions.set(a.id, [inst.x, inst.y - (inst.def.size[1] * inst.scale) / 2]);
    tops.set(a.id, [inst.x, inst.y - inst.def.size[1] * inst.scale]);
    const item: SceneItem<Api> = { type: 'component', inst };
    if (p.after !== null) followers.set(p.after, [...(followers.get(p.after) ?? []), item]);
    else if (p.front) front.push(item);
    else sorted.push({ y: p.key, item });
  };
  // hosts are added before the actors attached to them, whatever the storyboard order
  const added = new Set<string>();
  const visit = (a: ActorRef): void => {
    if (added.has(a.id)) return;
    added.add(a.id);
    if (a.attach) {
      const h = byId.get(a.attach.to);
      if (h) visit(h);
    }
    addActor(a);
  };
  actors.forEach(visit);

  if (shot.presenter) {
    const spec = resolvePresenter(shot.presenter, info, project, lt, dur);
    const k = spec.u / info.presenter.defaultU;
    positions.set('presenter', [spec.x, spec.y - (info.presenter.size[1] * k) / 2]);
    tops.set('presenter', [spec.x, spec.y - info.presenter.size[1] * k]);
    sorted.push({ y: shot.presenter.depth ?? spec.y, item: { type: 'presenter', spec } });
  }
  (shot.foreground ?? []).forEach((f, i) => {
    const def = registry.get(f.use);
    if (def) front.push({ type: 'component', inst: instance(def, f.id ?? `fg${i}`, f, lt, dur, info) });
  });

  // stable sort: equal y keeps storyboard order
  const withFollowers = (it: SceneItem<Api>): SceneItem<Api>[] => (it.type === 'component' ? [it, ...(followers.get(it.inst.id) ?? []).flatMap(withFollowers)] : [it]);
  const items = [...sorted.map((s, i) => ({ ...s, i })).sort((a, b) => a.y - b.y || a.i - b.i).map((s) => s.item), ...front].flatMap(withFollowers);
  const labels = (shot.labels ?? [])
    .filter((l) => lt >= (l.at ?? 0) && (l.until === undefined || lt < l.until))
    .map((l) => {
      const top = l.follow !== undefined ? tops.get(l.follow) : undefined;
      const [x, y] = top
        ? [top[0] + evalTrack(l.x, lt, dur, 0), top[1] - LABEL_GAP + evalTrack(l.y, lt, dur, 0)]
        : [evalTrack(l.x, lt, dur), evalTrack(l.y, lt, dur)];
      return { text: l.text, x, y, tint: l.tint ?? 'ink', age: lt - (l.at ?? 0) };
    });
  return { shotId: shot.id, lt, background, items, labels, cam: resolveCam(shot, lt, info, positions) };
}
