// Shared free-scene runtime: timeline -> per-frame scene resolution -> StyleAdapter calls.
// Pure function of t: every frame re-resolves from the storyboard, so frames render in any order.
import { clamp } from '../engine/palette.ts';
import type { StyleAdapter } from './adapter.ts';
import { resolveFreeShot } from './scene.ts';
import type { SceneGeometry } from './scene.ts';
import type { Bounds, ComponentKind, FreeProject, FreeShot, Registry, ResolvedCam } from './types.ts';

export const TYPE_CPS = 22;
/** Transition window around a cut: starts this long before the cut ... */
export const TRANS_PRE = 0.45;
/** ... and ends this long after it */
export const TRANS_POST = 0.55;
export const INTRO_S = 0.9;
export const OUTRO_S = 1.4;

export interface TimedFreeShot extends FreeShot {
  start: number;
  end: number;
  index: number;
}

export interface FocusBox extends Bounds {
  label: string;
  kind: ComponentKind | 'presenter' | 'label';
}

export interface FreeFrameInfo {
  shot: TimedFreeShot;
  lt: number;
  /** Boxes of drawn things in screen pixels (one per item of the main shot) */
  focus: FocusBox[];
  /** Labels of focus boxes cut by the screen edge or hidden behind the subtitle band */
  cropped: string[];
  transition: string | null;
}

export function buildFreeTimeline(shots: readonly FreeShot[]): TimedFreeShot[] {
  let t = 0;
  return shots.map((s, index) => {
    const start = Math.round(t * 1000) / 1000;
    t += s.dur;
    return { ...s, start, end: Math.round(t * 1000) / 1000, index };
  });
}

interface TransitionWindow {
  kind: string;
  k: number;
  out: TimedFreeShot | null;
  inn: TimedFreeShot | null;
}

export class FreeFilm<Api> {
  readonly shots: TimedFreeShot[];
  readonly duration: number;
  private readonly project: FreeProject;
  private readonly registry: Registry<Api>;
  private readonly adapter: StyleAdapter<Api>;
  private readonly subtitles: boolean;

  constructor(
    project: FreeProject,
    shots: readonly FreeShot[],
    registry: Registry<Api>,
    adapter: StyleAdapter<Api>,
    options: { subtitles?: boolean } = {},
  ) {
    this.project = project;
    this.registry = registry;
    this.adapter = adapter;
    this.subtitles = options.subtitles !== false;
    this.shots = buildFreeTimeline(shots);
    this.duration = this.shots.length ? this.shots[this.shots.length - 1].end : 0;
  }

  /** Film time + the style's drawing-free api, for attach / ground */
  private geometry(t: number): SceneGeometry<Api> | undefined {
    return this.adapter.anchorApi === undefined ? undefined : { t, api: this.adapter.anchorApi };
  }

  shotAt(t: number): TimedFreeShot {
    const tt = clamp(t, 0, Math.max(0, this.duration - 1e-6));
    return this.shots.find((s) => tt >= s.start && tt < s.end) ?? this.shots[this.shots.length - 1];
  }

  /** Which transition (if any) covers time t */
  transitionAt(t: number): TransitionWindow | null {
    const first = this.shots[0];
    const last = this.shots[this.shots.length - 1];
    if (first.tin && first.tin !== 'cut' && t < INTRO_S) return { kind: first.tin, k: t / INTRO_S, out: null, inn: first };
    if (last.tout && last.tout !== 'cut' && t > this.duration - OUTRO_S) return { kind: last.tout, k: clamp((t - (this.duration - OUTRO_S)) / (OUTRO_S - 0.2), 0, 1), out: last, inn: null };
    for (let i = 1; i < this.shots.length; i++) {
      const a = this.shots[i - 1];
      const b = this.shots[i];
      const kind = b.tin ?? a.tout ?? 'cut';
      if (kind === 'cut') continue;
      if (t >= b.start - TRANS_PRE && t < b.start + TRANS_POST) return { kind, k: (t - (b.start - TRANS_PRE)) / (TRANS_PRE + TRANS_POST), out: a, inn: b };
    }
    return null;
  }

  private screenBox(b: Bounds, cam: ResolvedCam): Bounds {
    const { w, viewH: h } = this.adapter.screen;
    const s = (w / this.adapter.info.world.w) * cam.z;
    return { x: (b.x - cam.cx) * s + w / 2, y: (b.y - cam.cy) * s + h / 2, w: b.w * s, h: b.h * s };
  }

  /** Draw one shot at time t; returns its focus boxes in screen pixels */
  private drawShot(shot: TimedFreeShot, t: number): FocusBox[] {
    const lt = clamp(t - shot.start, 0, shot.dur + TRANS_POST);
    const scene = resolveFreeShot(this.project, shot, lt, this.registry, this.adapter.info, this.geometry(t));
    const a = this.adapter;
    const focus: FocusBox[] = [];
    a.pushCamera(scene.cam);
    if (scene.background) a.drawComponent(scene.background, t, lt);
    for (const it of scene.items) {
      if (it.type === 'presenter') {
        focus.push({ ...this.screenBox(a.drawPresenter(it.spec, t, lt), scene.cam), label: 'presenter', kind: 'presenter' });
      } else {
        const { inst } = it;
        a.drawComponent(inst, t, lt);
        const [w, h] = inst.def.size;
        focus.push({ ...this.screenBox({ x: inst.x - (w * inst.scale) / 2, y: inst.y - h * inst.scale, w: w * inst.scale, h: h * inst.scale }, scene.cam), label: inst.id, kind: inst.def.kind });
      }
    }
    for (const l of scene.labels) focus.push({ ...this.screenBox(a.drawLabel(l), scene.cam), label: `label:${l.text}`, kind: 'label' });
    a.popCamera();
    return focus;
  }

  renderFrame(tRaw: number): FreeFrameInfo {
    const t = clamp(tRaw, 0, Math.max(0, this.duration - 1e-4));
    const shot = this.shotAt(t);
    const lt = t - shot.start;
    const a = this.adapter;
    a.beginFrame(t);
    const win = this.transitionAt(t);
    let focus: FocusBox[] = [];
    if (win) {
      const { out, inn } = win;
      const sx = this.adapter.screen;
      const f = inn ?? out;
      const fx = f ? this.drawShotFocusCenter(f, t) : [sx.w / 2, sx.h / 2] as const;
      a.transition(win.kind, clamp(win.k, 0, 1), fx, out && (() => { const r = this.drawShot(out, t); if (out === shot) focus = r; }), inn && (() => { const r = this.drawShot(inn, t); if (inn === shot) focus = r; }));
    } else {
      focus = this.drawShot(shot, t);
    }
    const total = Array.from(shot.sub).length;
    if (this.subtitles) {
      a.drawSubtitleBand(shot.sub, Math.min(total, Math.max(1, Math.floor(lt * TYPE_CPS))), shot.chapter, shot.id);
    }
    a.endFrame();
    const top = a.screen.subtitleTop;
    // cut = partly visible; something entirely off screen was placed there on purpose
    const visible = (b: FocusBox): boolean => b.x < a.screen.w && b.x + b.w > 0 && b.y < a.screen.h && b.y + b.h > 0;
    const cropped = win ? [] : focus.filter((b) => b.kind !== 'foreground' && visible(b) && (b.x < 0 || b.y < 0 || b.x + b.w > a.screen.w || b.y + b.h > top + b.h * 0.5)).map((b) => b.label);
    return { shot, lt, focus, cropped, transition: win?.kind ?? null };
  }

  /** Screen point a transition should centre on: the followed actor / presenter, else screen centre */
  private drawShotFocusCenter(shot: TimedFreeShot, t: number): readonly [number, number] {
    const lt = clamp(t - shot.start, 0, shot.dur);
    const scene = resolveFreeShot(this.project, shot, lt, this.registry, this.adapter.info, this.geometry(t));
    const follow = shot.cam?.follow;
    const { w, viewH: h } = this.adapter.screen;
    for (const it of scene.items) {
      const hit = it.type === 'presenter' ? follow === 'presenter' || follow === undefined : it.inst.id === follow;
      if (!hit) continue;
      const [x, y] = it.type === 'presenter' ? [it.spec.x, it.spec.y - (this.adapter.info.presenter.size[1] * it.spec.u) / this.adapter.info.presenter.defaultU / 2] : [it.inst.x, it.inst.y - it.inst.def.size[1] / 2];
      const b = this.screenBox({ x, y, w: 0, h: 0 }, scene.cam);
      return [clamp(b.x, 0, w), clamp(b.y, 0, h)];
    }
    return [w / 2, h / 2];
  }
}
