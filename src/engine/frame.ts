// Pure frame pipeline: world -> camera crop -> panels -> transitions -> subtitle band -> palette resolve
// Returns indexed-resolved pixels plus HD text commands; no DOM, so it runs in node tests and in the browser.
import { C, LOGICAL_H, LOGICAL_W, SAFE_Y, WORLD_H, WORLD_W, clamp } from './palette.ts';
import { PixelSurface } from './surface.ts';
import { SCREEN_AREA, drawPanels } from './panels.ts';
import type { PanelArea } from './panels.ts';
import { resolveCamera, resolveScene } from './scene.ts';
import type { Camera } from './scene.ts';
import { buildTimeline } from './storyboard.ts';
import type { ProjectDef, ShotDef, TimedShot, Transition } from './storyboard.ts';
import { BOARD_RECT, HEX, drawSign, renderWorld, renderFreeWorld } from './world.ts';
import type { Focus, SceneState, TextCmd } from './world.ts';
import type { ComponentDef } from './component.ts';

export interface CustomApi {
  /** World surface (480×240, world coordinates) */
  s: PixelSurface;
  t: number;
  lt: number;
  dur: number;
  args: Record<string, unknown>;
  scene: SceneState;
  /** Queue HD text in world coordinates */
  text: (cmd: TextCmd) => void;
  focus: (f: Focus) => void;
}
export type CustomFn = (api: CustomApi) => void;
export type CustomRegistry = Readonly<Record<string, CustomFn>>;

export interface FrameText extends TextCmd {
  /** Typewriter: number of characters revealed (layout uses the full string) */
  reveal?: number;
}

export interface FrameResult {
  pixels: Uint32Array;
  texts: FrameText[];
  focus: Focus[];
  shot: TimedShot;
  lt: number;
  cam: Camera;
}

export const TRANSITION_S = 0.4;
const BOARD_AREA: PanelArea = { cx: BOARD_RECT.x + BOARD_RECT.w / 2, top: BOARD_RECT.y + 10, right: BOARD_RECT.x + BOARD_RECT.w - 8, bottom: BOARD_RECT.y + BOARD_RECT.h - 10 };
export const TYPE_CPS = 22;

function transitionCover(kind: Transition | undefined, p: number, s: PixelSurface, irisAt: readonly [number, number]): number {
  if (!kind || kind === 'cut' || p <= 0) return 0;
  if (kind === 'checker') s.applyCheckerboardWipe(p, 16, C.PLUM_OUTLINE, SAFE_Y);
  else s.applyIrisDither(1 - p, irisAt[0], irisAt[1], C.VOID_INK, SAFE_Y);
  return p;
}

function drawSubtitleBand(s: PixelSurface, texts: FrameText[], shot: TimedShot, lt: number): void {
  const total = Array.from(shot.sub).length;
  drawPixelSubtitleBand(s, texts, shot.sub, Math.min(total, Math.max(1, Math.floor(lt * TYPE_CPS))), shot.chapter, shot.id, lt);
}

/** Subtitle band shared with the free-scene pixel adapter; reveal = characters shown */
export function drawPixelSubtitleBand(s: PixelSurface, texts: FrameText[], sub: string, reveal: number, chapter: string, id: string, lt: number): void {
  const y0 = SAFE_Y;
  s.fillRect(0, y0, LOGICAL_W, LOGICAL_H - y0, C.PLUM_OUTLINE, 1);
  s.hline(0, y0, LOGICAL_W, C.HONEY_PINE, 1);
  s.hline(0, y0 + 1, LOGICAL_W, C.CEDAR_PLANK, 1);
  s.hline(0, LOGICAL_H - 1, LOGICAL_W, C.VOID_INK, 1);
  for (let x = 6; x < LOGICAL_W; x += 48) s.fillRect(x, y0 + 1, 2, 1, C.AMBER_GOLD, 1);
  const tag = chapter.split(/\s+/)[0].slice(0, 6);
  s.fillRect(4, y0 + 6, 26, 9, C.VIOLET_UMBER, 1);
  s.drawMiniText(6, y0 + 8, tag.toUpperCase(), C.SUNLIGHT_CREAM, null, 1);
  s.drawMiniText(6, y0 + 19, id.toUpperCase(), C.SLATE_IRON, null, 1);
  const total = Array.from(sub).length;
  texts.push({ text: sub,x: LOGICAL_W / 2 + 8, y: y0 + 15.5, size: 10, color: HEX(C.WARM_PARCHMENT), align: 'center', bold: true, reveal });
  if (reveal >= total && Math.floor(lt * 4) % 2 === 0) texts.push({ text: '▌', x: LOGICAL_W - 12, y: y0 + 15.5, size: 8, color: HEX(C.AMBER_GOLD), align: 'center' });
}

export class Renderer {
  readonly shots: TimedShot[];
  readonly duration: number;
  private readonly world = new PixelSurface(WORLD_W, WORLD_H);
  private readonly worldB = new PixelSurface(WORLD_W, WORLD_H);
  private readonly frame = new PixelSurface(LOGICAL_W, LOGICAL_H);
  private readonly pixels = new Uint32Array(LOGICAL_W * LOGICAL_H);

  readonly project: ProjectDef;
  private readonly custom: CustomRegistry;
  private readonly components: Record<string, ComponentDef>;
  private readonly subtitles: boolean;

  constructor(
    project: ProjectDef,
    shots: readonly ShotDef[],
    custom: CustomRegistry = {},
    components: Record<string, ComponentDef> = {},
    options: { subtitles?: boolean } = {}
  ) {
    this.project = project;
    this.custom = custom;
    this.components = components;
    this.subtitles = options.subtitles !== false;
    this.shots = buildTimeline(shots);
    this.duration = this.shots.length ? this.shots[this.shots.length - 1].end : 0;
  }

  shotAt(t: number): TimedShot {
    const tt = clamp(t, 0, Math.max(0, this.duration - 1e-6));
    return this.shots.find((s) => tt >= s.start && tt < s.end) ?? this.shots[this.shots.length - 1];
  }

  /** Render one world (with optional custom drawing) and return its world-space texts / focus */
  private paintWorld(surface: PixelSurface, scene: SceneState, shot: ShotDef, t: number, lt: number): { texts: TextCmd[]; focus: Focus[] } {
    const texts: TextCmd[] = [];
    const focus: Focus[] = [];
    const isFree = shot.background !== undefined || (shot.actors !== undefined && shot.actors.length > 0);
    if (isFree) {
      renderFreeWorld(surface, shot, this.components, t, lt, texts, focus);
    } else {
      renderWorld(surface, scene, t, texts, focus);
    }
    if (shot.custom !== undefined) {
      const [name, args] = typeof shot.custom === 'string' ? [shot.custom, {}] : shot.custom;
      const fn = this.custom[name];
      if (fn) fn({ s: surface, t, lt, dur: shot.dur, args, scene, text: (c) => texts.push(c), focus: (f) => focus.push(f) });
    }
    return { texts, focus };
  }

  renderFrame(tRaw: number): FrameResult {
    const t = clamp(tRaw, 0, Math.max(0, this.duration - 1e-4));
    const shot = this.shotAt(t);
    const lt = t - shot.start;
    const dur = shot.dur;
    const texts: FrameText[] = [];
    const focus: Focus[] = [];
    this.frame.clear(C.VOID_INK, 0);

    const place = (wt: readonly TextCmd[], wf: readonly Focus[], ox: number, oy: number, z: number, dx: number, clip: readonly [number, number]): void => {
      for (const c of wt) {
        const x = (c.x - ox) * z + dx;
        const y = (c.y - oy) * z;
        if (x < clip[0] - 40 || x > clip[1] + 40 || y < 0 || y > SAFE_Y) continue;
        texts.push({ ...c, x, y, size: c.size * z });
      }
      for (const f of wf) {
        const x = (f.x - ox) * z + dx;
        const y = (f.y - oy) * z;
        const w = f.w * z;
        const h = f.h * z;
        if (x + w <= clip[0] || x >= clip[1] || y + h <= 0 || y >= SAFE_Y) continue;
        focus.push({ x, y, w, h, label: f.label, clip });
      }
    };

    let scene: SceneState;
    let cam: Camera;
    if (shot.set === 'split' && shot.split) {
      const sides = [shot.split.left, shot.split.right];
      let first: SceneState | null = null;
      sides.forEach((side, k) => {
        const merged: ShotDef = {
          ...shot,
          set: side.set ?? 'lane',
          interior: side.interior,
          theme: side.theme ?? shot.theme,
          stations: side.stations ?? shot.stations,
          presenter: side.presenter !== undefined ? side.presenter : shot.presenter,
          flow: side.flow ?? shot.flow,
          labels: side.labels ?? [],
          world: side.world ?? shot.world,
          helpers: side.helpers ?? shot.helpers,
          custom: undefined,
        };
        const sc = resolveScene(this.project, merged, lt);
        first = first ?? sc;
        const surface = k === 0 ? this.world : this.worldB;
        const w = this.paintWorld(surface, sc, merged, t, lt);
        const view = clamp(side.view ?? WORLD_W / 4, 0, WORLD_W / 2);
        const dx = k * (LOGICAL_W / 2);
        this.frame.blitRect(surface, view, 0, dx, 0, LOGICAL_W / 2, SAFE_Y);
        place(w.texts, w.focus, view, 0, 1, dx, [dx, dx + LOGICAL_W / 2]);
      });
      scene = first ?? resolveScene(this.project, shot, lt);
      cam = { x: 0, y: 0, zoom: 1 };
      // divider + side titles
      this.frame.fillRect(LOGICAL_W / 2 - 2, 0, 4, SAFE_Y, C.PLUM_OUTLINE, 1);
      this.frame.vline(LOGICAL_W / 2 - 1, 0, SAFE_Y, C.HONEY_PINE, 1);
      sides.forEach((side, k) => drawSign(this.frame, texts, LOGICAL_W / 4 + k * (LOGICAL_W / 2), 6, side.title, 1, 10));
    } else {
      scene = resolveScene(this.project, shot, lt);
      const w = this.paintWorld(this.world, scene, shot, t, lt);
      cam = resolveCamera(shot.cam, lt, dur, scene, shot);
      this.frame.blitCrop(this.world, cam.x, cam.y, cam.zoom, SAFE_Y);
      place(w.texts, w.focus, cam.x, cam.y, cam.zoom, 0, [0, LOGICAL_W]);
    }
    const onBoard = scene.set === 'board' && shot.set !== 'split';
    drawPanels(this.frame, texts, shot.panels ?? [], lt, dur, focus, onBoard ? BOARD_AREA : SCREEN_AREA, onBoard ? 2 : 1);

    const presenter = focus.find((f) => f.label.startsWith('presenter'));
    const irisAt: readonly [number, number] = presenter ? [presenter.x + presenter.w / 2, presenter.y + presenter.h / 2] : [240, 120];
    let cover = 0;
    if (shot.tout && lt > dur - TRANSITION_S) cover = Math.max(cover, transitionCover(shot.tout, clamp((lt - (dur - TRANSITION_S)) / TRANSITION_S, 0, 1), this.frame, irisAt));
    if (shot.tin && lt < TRANSITION_S) cover = Math.max(cover, transitionCover(shot.tin, 1 - clamp(lt / TRANSITION_S, 0, 1), this.frame, irisAt));
    const visibleTexts = cover > 0.15 ? [] : texts;

    const bandTexts: FrameText[] = [];
    if (this.subtitles) drawSubtitleBand(this.frame, bandTexts, shot, lt);
    this.frame.resolveToUint32(this.pixels, scene.tod);
    return { pixels: this.pixels, texts: [...visibleTexts, ...bandTexts], focus, shot, lt, cam };
  }

}

/** Focus boxes that are partially cut off by the viewport edge (likely framing mistakes) */
export function croppedFocus(focus: readonly Focus[], labels: readonly string[] = ['presenter', 'title', 'grid', 'chart', 'formula', 'bars', 'note', 'label']): Focus[] {
  return focus.filter((f) => {
    const [x0, x1] = f.clip ?? [0, LOGICAL_W];
    return labels.some((l) => f.label.startsWith(l)) && (f.x < x0 || f.y < 0 || f.x + f.w > x1 || f.y + f.h > SAFE_Y);
  });
}
