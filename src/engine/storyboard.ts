// Storyboard schema (project.json + storyboard.json) and the validator that gates every render
import { STATION_TYPES } from './stations.ts';
import type { StationType } from './stations.ts';
import { EMOTES, ITEM_KINDS, PRESENTER_POSES, TINTS } from './sprites.ts';
import type { Direction, EmoteType, ItemSpec, PresenterPose, Tint } from './sprites.ts';
import type { Step, Track } from './track.ts';
import { validateKit } from './kit.ts';
import type { KitSpec } from './kit.ts';
import { THEMES } from './themes.ts';
import type { ThemeName } from './themes.ts';
import type { ComponentDef } from './component.ts';

export const TRANSITIONS = ['cut', 'checker', 'iris'] as const;
export type Transition = (typeof TRANSITIONS)[number];
/** lane = 一字流水线；map = 自由地图；interior = 工位内部；board = 黑板讲解；split = 左右对比 */
export const SETS = ['lane', 'map', 'interior', 'board', 'split'] as const;
export type SetName = (typeof SETS)[number];
export const PANEL_TYPES = ['title', 'grid', 'chart', 'formula', 'bars', 'note'] as const;
export type PanelType = (typeof PANEL_TYPES)[number];
const DIRECTIONS: readonly Direction[] = ['down', 'right', 'up', 'left'];

export const MAX_STATIONS = 6;
/** Comfortable Chinese reading speed for subtitles (chars per second) */
export const MAX_SUB_CPS = 7;
export const MAX_SUB_CHARS = 36;
export const MAX_LABEL_CHARS = 6;

export interface StationDef {
  /** One of the 8 built-in stations — or describe a topic-specific one with `kit` (exactly one of the two) */
  type?: StationType;
  kit?: KitSpec;
  /** Sign text above the station (≤ 6 chars, CJK ok) */
  label: string;
  tint?: Tint;
  /** Item appearance after it leaves this station (belt items morph here) */
  emits?: ItemSpec;
  /** Default ASCII screen text (tower / mill / gate) */
  screen?: string;
}

export interface ProjectDef {
  title: string;
  subtitle?: string;
  stations: StationDef[];
  /** Item that enters the lane from the left before station 0 */
  source?: ItemSpec;
  /** Default skin for lane/map/board sets */
  theme?: ThemeName;
  /** Station ground positions [x, baseY] for the map set (one per station) */
  map?: ReadonlyArray<readonly [number, number]>;
}

/** 'wide' = whole lane at zoom 1; 'sN' = zoom 2 on station N (station+belt); 'pN' = zoom 2 on presenter level in front of station N; 'presenter' = zoom 2 on presenter */
export type CamTarget = 'wide' | 'presenter' | `s${number}` | `p${number}` | readonly [number, number];
export interface FreeCamDef {
  /** Target actor id, 'presenter', or fixed world coordinate [x, y] */
  follow?: string | readonly [number, number];
  zoom?: 1 | 2;
  x?: Track;
  y?: Track;
}
export type CamDef =
  | CamTarget
  | { from: CamTarget; to: CamTarget; over?: number; at?: number }
  | { x: Track; y: Track; zoom: 1 | 2 }
  | FreeCamDef;

export interface ActorShot {
  id: string;
  use: string;
  x: Track;
  y: Track;
  scale?: 1 | 2;
  flip?: boolean;
  layer?: 'sort' | 'front';
  params?: Record<string, unknown>;
}

export interface BackgroundShot {
  use: string;
  params?: Record<string, unknown>;
}

export interface ForegroundShot {
  use: string;
  x?: Track;
  y?: Track;
  params?: Record<string, unknown>;
}

/** True for the shorthand forms (string or [x, y]) */
export function isCamTarget(c: CamDef): c is CamTarget {
  return typeof c === 'string' || Array.isArray(c);
}

export interface StationShot {
  build?: Track;
  active?: Step<boolean>;
  power?: Track;
  screen?: string;
  /** Hide the sign above the station */
  hideLabel?: boolean;
}

export interface PresenterShot {
  /** Stand in front of station N (shortcut for x) */
  at?: number;
  x?: Track;
  y?: Track;
  dir?: Step<Direction>;
  pose?: Step<PresenterPose>;
  emote?: Step<EmoteType | null>;
  lantern?: boolean;
}

export interface FlowDef {
  /** Start station index, -1 = left edge (source) */
  from?: number;
  /** Destination station index, omitted = right edge */
  to?: number;
  /** First spawn at lt (s) */
  start?: number;
  /** Spawn interval (s); with count = 1 a single demo item */
  every?: number;
  count?: number;
  /** Belt speed in px/s */
  speed?: number;
  /** Seconds each item pauses inside every station it passes */
  dwell?: number;
  /** Override item appearance at spawn */
  item?: ItemSpec;
}

interface PanelBase {
  type: PanelType;
  /** Appear at lt (s) */
  at?: number;
  until?: number;
  x?: number;
  y?: number;
  /** Pixel scale 1 | 2 (board set defaults to 2); x/y stay in screen pixels */
  scale?: 1 | 2;
}
export interface TitlePanel extends PanelBase { type: 'title'; text: string; sub?: string }
export interface GridPanel extends PanelBase {
  type: 'grid';
  title?: string;
  rows: string[];
  cols: number;
  /** 'stagger' = row r fills cols r..r+stages-1 (pipeline); 'serial' = row r fills cols r*stages.. */
  pattern?: 'stagger' | 'serial';
  stages?: number;
  cells?: ReadonlyArray<readonly [number, number, Tint]>;
  /** Number of columns revealed (Track) */
  reveal?: Track;
}
export interface ChartPanel extends PanelBase {
  type: 'chart';
  title?: string;
  xLabel?: string;
  yLabel?: string;
  /** y values 0..1, evenly spaced on x */
  points: number[];
  reveal?: Track;
  w?: number;
  h?: number;
}
export interface FormulaPanel extends PanelBase {
  type: 'formula';
  parts: string[];
  /** Index of the highlighted part */
  highlight?: Step<number>;
}
export interface BarsPanel extends PanelBase {
  type: 'bars';
  title?: string;
  items: ReadonlyArray<{ label: string; value: number; tint?: Tint }>;
  reveal?: Track;
}
export interface NotePanel extends PanelBase { type: 'note'; text: string }
export type PanelDef = TitlePanel | GridPanel | ChartPanel | FormulaPanel | BarsPanel | NotePanel;

export interface LabelDef {
  text: string;
  x: number;
  y: number;
  at?: number;
  until?: number;
  tint?: Tint;
}

/** One half of a split shot: a world rendered with these overrides, cropped to 240 px */
export interface SplitSide {
  title: string;
  set?: 'lane' | 'map' | 'interior';
  interior?: number;
  theme?: ThemeName;
  stations?: Record<string, StationShot>;
  presenter?: PresenterShot | null;
  flow?: FlowDef[];
  labels?: LabelDef[];
  world?: ShotDef['world'];
  helpers?: boolean;
  /** Left edge of the 240-px window into that side's world (default: centered) */
  view?: number;
}

export interface ShotDef {
  id: string;
  chapter: string;
  dur: number;
  /** Narration / subtitle line */
  sub: string;
  /** Viewer Read: what the viewer must understand from this shot */
  read: string;
  tin?: Transition;
  tout?: Transition;
  /** Scene set (default lane) */
  set?: SetName;
  theme?: ThemeName;
  /** Free scene background component */
  background?: BackgroundShot;
  /** Free scene actors */
  actors?: ActorShot[];
  /** Free scene foreground elements */
  foreground?: ForegroundShot[];
  /** Station index shown from inside (set: interior) */
  interior?: number;
  split?: { left: SplitSide; right: SplitSide };
  tod?: Track;
  cam?: CamDef;
  world?: { floor?: Track; belt?: Track; lamps?: Track; fireflies?: Track };
  stations?: Record<string, StationShot>;
  presenter?: PresenterShot | null;
  helpers?: boolean;
  flow?: FlowDef[];
  panels?: PanelDef[];
  labels?: LabelDef[];
  custom?: string | readonly [string, Record<string, unknown>];
}

export interface TimedShot extends ShotDef {
  start: number;
  end: number;
  index: number;
}

export function buildTimeline(shots: readonly ShotDef[]): TimedShot[] {
  let t = 0;
  return shots.map((s, index) => {
    const start = Math.round(t * 1000) / 1000;
    t += s.dur;
    return { ...s, start, end: Math.round(t * 1000) / 1000, index };
  });
}

/** Expand a stations-map key: 'all' | 'N' | 'A-B' */
export function stationKeys(key: string, n: number): number[] | null {
  if (key === 'all') return Array.from({ length: n }, (_, i) => i);
  const m = /^(\d+)(?:-(\d+))?$/.exec(key);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] === undefined ? a : Number(m[2]);
  if (a > b || b >= n) return null;
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

const charLen = (s: string): number => Array.from(s).length;

function stepValues<T>(v: Step<T> | undefined): T[] {
  if (v === undefined) return [];
  if (Array.isArray(v) && v.length > 0 && Array.isArray(v[0])) return (v as ReadonlyArray<readonly [number, T]>).map((k) => k[1]);
  return [v as T];
}

function checkItem(item: ItemSpec | undefined, where: string, errs: string[]): void {
  if (!item) return;
  if (!ITEM_KINDS.includes(item.kind)) errs.push(`${where}: item kind "${item.kind}" not in ${ITEM_KINDS.join('|')}`);
  if (!TINTS.includes(item.tint)) errs.push(`${where}: item tint "${item.tint}" not in ${TINTS.join('|')}`);
  if (item.glyph && !/^[\x20-\x7e]{1,6}$/.test(item.glyph)) errs.push(`${where}: item glyph must be 1-6 ASCII chars`);
}

export function validateProject(p: ProjectDef): string[] {
  const errs: string[] = [];
  if (!p.title) errs.push('project: title required');
  if (!Array.isArray(p.stations) || p.stations.length < 1 || p.stations.length > MAX_STATIONS) {
    errs.push(`project: stations must have 1..${MAX_STATIONS} entries`);
    return errs;
  }
  p.stations.forEach((st, i) => {
    if ((st.type === undefined) === (st.kit === undefined)) errs.push(`station ${i}: give exactly one of type or kit`);
    else if (st.type !== undefined && !STATION_TYPES.includes(st.type)) errs.push(`station ${i}: type "${st.type}" not in ${STATION_TYPES.join('|')}`);
    if (st.kit) errs.push(...validateKit(st.kit, `station ${i}`));
    if (!st.label || charLen(st.label) > MAX_LABEL_CHARS) errs.push(`station ${i}: label must be 1..${MAX_LABEL_CHARS} chars`);
    if (st.tint && !TINTS.includes(st.tint)) errs.push(`station ${i}: tint "${st.tint}" invalid`);
    checkItem(st.emits, `station ${i} emits`, errs);
  });
  checkItem(p.source, 'project source', errs);
  if (p.theme && !THEMES.includes(p.theme)) errs.push(`project: theme "${p.theme}" not in ${THEMES.join('|')}`);
  if (p.map && p.map.length !== p.stations.length) errs.push('project: map must list one [x, baseY] per station');
  (p.map ?? []).forEach(([x, y], i) => {
    if (!(x >= 34 && x <= 446 && y >= 96 && y <= 196)) errs.push(`project: map[${i}] = [${x}, ${y}] out of range (x 34..446, baseY 96..196)`);
  });
  return errs;
}

function checkCamTarget(c: CamTarget, n: number): boolean {
  if (c === 'wide' || c === 'presenter') return true;
  if (Array.isArray(c)) return c.length === 2 && c.every((v) => typeof v === 'number');
  const m = /^[sp](\d+)$/.exec(String(c));
  return !!m && Number(m[1]) < n;
}

export function validateStoryboard(
  p: ProjectDef,
  shots: readonly ShotDef[],
  customOrRegistry: readonly string[] | Record<string, ComponentDef> = [],
  maybeRegistry?: Record<string, ComponentDef>
): string[] {
  const isArr = Array.isArray(customOrRegistry);
  const customNames: readonly string[] = isArr ? customOrRegistry : [];
  const componentRegistry: Record<string, ComponentDef> | undefined = isArr
    ? maybeRegistry
    : (customOrRegistry as Record<string, ComponentDef>);
  const errs: string[] = [];
  const n = p.stations?.length ?? 0;
  const ids = new Set<string>();
  shots.forEach((s, i) => {
    const w = `shot ${s.id ?? `#${i}`}`;
    if (!s.id) errs.push(`${w}: id required`);
    else if (ids.has(s.id)) errs.push(`${w}: duplicate id ${s.id}`);
    ids.add(s.id);
    if (!s.chapter) errs.push(`${w}: chapter required`);
    if (!(s.dur >= 1.5 && s.dur <= 12)) errs.push(`${w}: dur must be 1.5..12 s`);
    if (!s.sub) errs.push(`${w}: sub required`);
    else {
      const len = charLen(s.sub);
      if (len > MAX_SUB_CHARS) errs.push(`${w}: sub too long (${len} > ${MAX_SUB_CHARS} chars) — split the shot`);
      if (s.dur > 0 && len / s.dur > MAX_SUB_CPS) errs.push(`${w}: sub too fast (${(len / s.dur).toFixed(1)} chars/s > ${MAX_SUB_CPS}) — lengthen dur or shorten sub`);
    }
    if (!s.read) errs.push(`${w}: read (viewer read) required`);
    if (s.tin && !TRANSITIONS.includes(s.tin)) errs.push(`${w}: tin "${s.tin}" not in ${TRANSITIONS.join('|')}`);
    if (s.tout && !TRANSITIONS.includes(s.tout)) errs.push(`${w}: tout "${s.tout}" not in ${TRANSITIONS.join('|')}`);

    const isFreeShot = s.background !== undefined || (s.actors !== undefined && s.actors.length > 0);
    const set = s.set ?? (isFreeShot ? undefined : 'lane');
    if (set !== undefined && !SETS.includes(set)) errs.push(`${w}: set "${set}" not in ${SETS.join('|')}`);
    if (s.theme && !THEMES.includes(s.theme)) errs.push(`${w}: theme "${s.theme}" not in ${THEMES.join('|')}`);

    // Free scene components validation
    if (s.background) {
      if (!s.background.use) errs.push(`${w}: background missing "use"`);
      else if (componentRegistry && !componentRegistry[s.background.use]) {
        errs.push(`${w}: unknown component "${s.background.use}"`);
      }
    }

    const actorIds = new Set<string>();
    if (s.actors) {
      s.actors.forEach((a, k) => {
        if (!a.id) errs.push(`${w}: actor at index ${k} must have a unique "id"`);
        else if (actorIds.has(a.id)) errs.push(`${w}: duplicate actor id "${a.id}"`);
        else actorIds.add(a.id);

        if (!a.use) errs.push(`${w}: actor missing "use"`);
        else if (componentRegistry && !componentRegistry[a.use]) {
          errs.push(`${w}: unknown component "${a.use}"`);
        }
      });
    }

    if (s.foreground) {
      s.foreground.forEach((fg) => {
        if (!fg.use) errs.push(`${w}: foreground missing "use"`);
        else if (componentRegistry && !componentRegistry[fg.use]) {
          errs.push(`${w}: unknown component "${fg.use}"`);
        }
      });
    }

    const checkInterior = (v: number | undefined, where: string): void => {
      if (v === undefined) errs.push(`${where}: set interior needs "interior": <station index>`);
      else if (v < 0 || v >= n) errs.push(`${where}: interior ${v} out of range`);
    };
    if (set === 'interior') checkInterior(s.interior, w);
    if (set === 'map' && !p.map) errs.push(`${w}: set map needs project.map positions`);
    if (set === 'split') {
      if (!s.split?.left || !s.split?.right) errs.push(`${w}: split needs left and right`);
      else {
        for (const side of [s.split.left, s.split.right]) {
          if (!side.title) errs.push(`${w}: split side needs a title`);
          if (side.set === 'interior') checkInterior(side.interior, `${w} split`);
          if (side.set === 'map' && !p.map) errs.push(`${w}: split side map needs project.map`);
        }
      }
    }
    const stationCam = typeof s.cam === 'string' && /^[sp]\d+$/.test(s.cam);
    const fromTo = s.cam !== undefined && !isCamTarget(s.cam) && 'from' in s.cam ? [s.cam.from, s.cam.to] : [];
    const usesStationCam = stationCam || fromTo.some((c) => typeof c === 'string' && /^[sp]\d+$/.test(c));
    if (usesStationCam && set !== 'lane' && set !== 'map') errs.push(`${w}: cam "${typeof s.cam === 'string' ? s.cam : 'sN'}" only works in lane/map sets`);
    if (s.cam !== undefined && set === 'split') errs.push(`${w}: split shots ignore cam — use split.left/right.view`);

    if (s.cam !== undefined) {
      const c = s.cam;
      let ok = true;
      if (isCamTarget(c)) ok = checkCamTarget(c, n);
      else if ('from' in c) ok = checkCamTarget(c.from, n) && checkCamTarget(c.to, n) && (c.from === 'wide') === (c.to === 'wide');
      else if ('follow' in c) {
        if (typeof c.follow === 'string') {
          ok = c.follow === 'presenter' || actorIds.has(c.follow) || checkCamTarget(c.follow as CamTarget, n);
        } else if (Array.isArray(c.follow)) {
          ok = c.follow.length === 2 && typeof c.follow[0] === 'number' && typeof c.follow[1] === 'number';
        }
      } else ok = c.zoom === 1 || c.zoom === 2;
      if (!ok) errs.push(`${w}: cam ${JSON.stringify(c)} invalid (wide | presenter | s0..s${n - 1} | p0..p${n - 1} | [x,y] | {from,to,over} | {x,y,zoom} | {follow,zoom}); a pan cannot mix wide (zoom 1) with zoom-2 targets — cut instead`);
    }

    for (const key of Object.keys(s.stations ?? {})) {
      if (!stationKeys(key, n)) errs.push(`${w}: station key "${key}" invalid (all | 0..${n - 1} | A-B)`);
    }

    const pr = s.presenter;
    if (pr) {
      for (const v of stepValues(pr.pose)) if (!PRESENTER_POSES.includes(v)) errs.push(`${w}: presenter pose "${v}" not in ${PRESENTER_POSES.join('|')}`);
      for (const v of stepValues(pr.emote)) if (v !== null && !EMOTES.includes(v)) errs.push(`${w}: presenter emote "${v}" not in ${EMOTES.join('|')}`);
      for (const v of stepValues(pr.dir)) if (!DIRECTIONS.includes(v)) errs.push(`${w}: presenter dir "${v}" invalid`);
      if (pr.at !== undefined && (pr.at < 0 || pr.at >= n)) errs.push(`${w}: presenter at ${pr.at} out of range`);
    }

    (s.flow ?? []).forEach((f, k) => {
      if (f.from !== undefined && (f.from < -1 || f.from >= n)) errs.push(`${w}: flow[${k}].from out of range`);
      if (f.to !== undefined && (f.to < 0 || f.to >= n)) errs.push(`${w}: flow[${k}].to out of range`);
      checkItem(f.item, `${w} flow[${k}]`, errs);
    });

    (s.panels ?? []).forEach((pn, k) => {
      if (!PANEL_TYPES.includes(pn.type)) {
        errs.push(`${w}: panel type "${pn.type}" not in ${PANEL_TYPES.join('|')}`);
        return;
      }
      const need: Record<PanelType, string[]> = {
        title: ['text'], grid: ['rows', 'cols'], chart: ['points'], formula: ['parts'], bars: ['items'], note: ['text'],
      };
      for (const f of need[pn.type]) if ((pn as unknown as Record<string, unknown>)[f] === undefined) errs.push(`${w}: panels[${k}] (${pn.type}) missing "${f}"`);
    });

    if (s.custom !== undefined) {
      const name = typeof s.custom === 'string' ? s.custom : s.custom[0];
      if (!customNames.includes(name)) errs.push(`${w}: custom "${name}" not registered in project/custom.ts`);
    }
  });
  return errs;
}

/** Non-blocking variety warnings printed by `npm run check` */
export function lintStoryboard(p: ProjectDef, shots: readonly ShotDef[]): string[] {
  const warns: string[] = [];
  let run = 1;
  for (let i = 1; i <= shots.length; i++) {
    const prev = shots[i - 1];
    const curr = i < shots.length ? shots[i] : null;
    const prevIsFree = prev.background !== undefined || (prev.actors !== undefined && prev.actors.length > 0);
    const currIsFree = curr ? (curr.background !== undefined || (curr.actors !== undefined && curr.actors.length > 0)) : false;
    const prevSet = prevIsFree ? undefined : (prev.set ?? 'lane');
    const currSet = curr ? (currIsFree ? undefined : (curr.set ?? 'lane')) : undefined;
    const same = curr !== null && prevSet !== undefined && currSet !== undefined && prevSet === currSet;
    if (same) run++;
    else {
      if (run > 4 && prevSet !== undefined) warns.push(`same set "${prevSet}" for ${run} shots in a row (ends at ${shots[i - 1].id}) — switch set or framing`);
      run = 1;
    }
  }

  // Adjacent free scene redundancy check
  for (let i = 1; i < shots.length; i++) {
    const prev = shots[i - 1];
    const curr = shots[i];
    const isFreePrev = prev.background !== undefined || (prev.actors !== undefined && prev.actors.length > 0);
    const isFreeCurr = curr.background !== undefined || (curr.actors !== undefined && curr.actors.length > 0);
    if (isFreePrev && isFreeCurr) {
      const sameBg = prev.background?.use === curr.background?.use;
      const prevActors = (prev.actors ?? []).map((a) => a.use).sort().join(',');
      const currActors = (curr.actors ?? []).map((a) => a.use).sort().join(',');
      if (sameBg && prevActors === currActors && prevActors.length > 0) {
        warns.push(`adjacent shots "${prev.id}" and "${curr.id}" share identical background and actors — consider camera movement, changing actors, or varying the scene`);
      }
    }
  }

  const used = new Set(shots.map((s) => s.set ?? 'lane'));
  if (shots.length >= 10 && used.size < 3) warns.push(`only ${used.size} set(s) used in ${shots.length} shots — use at least 3 of ${SETS.join('/')}`);
  void p;
  return warns;
}
