// World renderer: dispatches on the scene set (lane / map / interior / board); 4a art, opus layout ideas
import { C, PALETTE_32, WORLD_W, clamp, hashFloat, snapToPixel } from './palette.ts';
import { PixelSurface, miniTextWidth } from './surface.ts';
import { drawHelper, drawItem, drawItemScaled, drawPresenter } from './sprites.ts';
import type { Bounds, ItemSpec, PresenterSpec, Tint } from './sprites.ts';
import { STATION_HALF_W, drawStation } from './stations.ts';
import type { StationType } from './stations.ts';
import { FENCE_Y, SKY_H, drawBackdrop, drawFrontProps, drawPath, isIndoor } from './themes.ts';
import type { ThemeName } from './themes.ts';
import { INTERIOR_BELT_Y, INTERIOR_HELPER_Y, MACHINE_X, drawInterior, drawKitInterior } from './interior.ts';
import { drawKitStation } from './kit.ts';
import type { KitSpec } from './kit.ts';
import { routePoint, routeSegments } from './route.ts';
import type { Route } from './route.ts';
import { createScratchSurface, blitComponentToWorld, createDrawApi } from './component.ts';
import type { ComponentDef } from './component.ts';
import type { ShotDef } from './storyboard.ts';
import { evalTrack } from './track.ts';

export { SKY_H, FENCE_Y };
/** Ground line of every lane station */
export const BASE_Y = 150;
export const BELT_Y = 156;
export const BELT_DY = BELT_Y - BASE_Y;
export const HELPER_Y = 180;
/** Presenter feet line */
export const PATH_Y = 212;

export function stationX(i: number, n: number): number {
  return Math.round((WORLD_W / n) * (i + 0.5));
}

/** Text drawn on the HD layer; coordinates in logical pixels of the surface it belongs to */
export interface TextCmd {
  text: string;
  x: number;
  y: number;
  /** Logical px (×4 on output) */
  size: number;
  color: string;
  align?: 'left' | 'center';
  bold?: boolean;
}

export interface Focus extends Bounds {
  label: string;
  /** Horizontal visible range [x0, x1] (split halves); defaults to the whole frame */
  clip?: readonly [number, number];
}

export interface SceneStation {
  type: StationType;
  /** Topic-specific station built from parts; overrides `type` when present */
  kit?: KitSpec;
  label: string;
  tint: Tint;
  x: number;
  baseY: number;
  build: number;
  active: boolean;
  power: number;
  screen?: string;
  showLabel: boolean;
}

export type WorldSet = 'lane' | 'map' | 'interior' | 'board';

export interface SceneState {
  set: WorldSet;
  theme: ThemeName;
  /** Station shown from inside (set interior) */
  interior: number;
  tod: number;
  floor: number;
  belt: number;
  lamps: number;
  fireflies: number;
  stations: SceneStation[];
  route: Route | null;
  presenter: PresenterSpec | null;
  helpers: boolean;
  items: ReadonlyArray<{ x: number; y: number; item: ItemSpec; at: number }>;
  labels: ReadonlyArray<{ text: string; x: number; y: number; tint: Tint; age: number }>;
}

export const HEX = (i: number): string => PALETTE_32[i];

const isAscii = (s: string): boolean => /^[\x20-\x7e]*$/.test(s);

/** Wooden sign with text; ASCII uses the pixel mini font, CJK goes to the HD layer */
export function drawSign(s: PixelSurface, texts: TextCmd[], cx: number, y: number, label: string, emissive = 0, size = 8): Bounds {
  const ascii = isAscii(label);
  const tw = ascii ? miniTextWidth(label.toUpperCase()) : Array.from(label).length * size;
  const w = tw + 10;
  const h = ascii ? 11 : size + 5;
  const x = snapToPixel(cx - w / 2);
  s.fillRect(x, y, w, h, C.PLUM_OUTLINE, emissive);
  s.fillRect(x + 1, y + 1, w - 2, h - 2, C.HONEY_PINE, emissive);
  s.hline(x + 1, y + 1, w - 2, C.SUNLIGHT_CREAM, emissive);
  s.hline(x + 1, y + h - 2, w - 2, C.CEDAR_PLANK, emissive);
  s.pset(x + 2, y + 3, C.ROASTED_OAK, emissive);
  s.pset(x + w - 3, y + 3, C.ROASTED_OAK, emissive);
  if (ascii) s.drawMiniText(x + 5, y + 3, label.toUpperCase(), C.DARK_WALNUT, null, 1);
  else texts.push({ text: label, x: cx, y: y + h / 2 + 0.5, size, color: HEX(C.DARK_WALNUT), align: 'center', bold: true });
  return { x, y, w, h };
}

function drawPads(s: PixelSurface, stations: readonly SceneStation[], floor: number): void {
  if (floor <= 0.005) return;
  for (const st of stations) {
    const x0 = st.x - STATION_HALF_W - 4;
    for (let py = st.baseY - 14; py < st.baseY + 2; py += 8) {
      for (let px = x0; px < x0 + STATION_HALF_W * 2 + 8; px += 8) {
        const p = clamp((floor * 1.45 - Math.hypot(px, py - st.baseY) / 520) * 3.2, 0, 1);
        if (p <= 0) continue;
        const drop = snapToPixel((1 - p) * -4);
        s.fillRect(px, py + drop, 8, 8, C.DARK_SOIL);
        s.fillRect(px + 1, py + 1 + drop, 6, 6, C.OCHRE_STONE);
        s.hline(px + 1, py + 1 + drop, 6, C.CREAM_LIMESTONE);
      }
    }
  }
}

function beltH(s: PixelSurface, x0: number, x1: number, y: number, anim: number): void {
  const a = Math.min(x0, x1);
  const len = Math.abs(x1 - x0) + 1;
  s.fillRect(a, y - 5, len, 10, C.PLUM_OUTLINE);
  s.hline(a, y - 4, len, C.SILVER_GEAR);
  s.hline(a, y + 3, len, C.ROASTED_OAK);
  s.fillRect(a, y - 3, len, 6, C.VIOLET_UMBER);
  for (let px = a; px < a + len; px++) {
    if ((px - anim + 400) % 4 === 0) {
      s.vline(px, y - 3, 6, C.SLATE_IRON);
      s.pset(px, y - 1, C.AMBER_GOLD);
    }
  }
}

function beltV(s: PixelSurface, x: number, y0: number, y1: number, anim: number): void {
  const a = Math.min(y0, y1);
  const len = Math.abs(y1 - y0) + 1;
  s.fillRect(x - 5, a - 5, 10, len + 5, C.PLUM_OUTLINE);
  s.vline(x - 4, a - 4, len + 3, C.SILVER_GEAR);
  s.vline(x + 3, a - 4, len + 3, C.SILVER_GEAR);
  s.fillRect(x - 3, a - 4, 6, len + 3, C.VIOLET_UMBER);
  for (let py = a; py < a + len; py++) {
    if ((py - anim + 400) % 4 === 0) {
      s.hline(x - 3, py, 6, C.SLATE_IRON);
      s.pset(x, py, C.AMBER_GOLD);
    }
  }
}

/** Belt along the route, revealed up to `build` of its length */
function drawRouteBelt(s: PixelSurface, r: Route, build: number, t: number, moving: boolean): void {
  const limit = r.length * clamp(build, 0, 1);
  if (limit < 3) return;
  const anim = moving ? Math.floor(t * 14) % 4 : 0;
  let acc = 0;
  for (const [x0, y0, x1, y1] of routeSegments(r)) {
    const segLen = Math.abs(x1 - x0) + Math.abs(y1 - y0);
    if (acc >= limit) break;
    const k = Math.min(1, (limit - acc) / segLen);
    const ex = x0 + (x1 - x0) * k;
    const ey = y0 + (y1 - y0) * k;
    if (y0 === y1) beltH(s, Math.max(-8, x0), Math.min(WORLD_W + 8, Math.round(ex)), y0, anim);
    else beltV(s, x0, y0, Math.round(ey), anim);
    acc += segLen;
  }
  if (build < 1) {
    const [hx, hy] = routePoint(r, limit);
    s.fillRect(hx - 1, hy - 6, 3, 12, C.SUNLIGHT_CREAM, 1);
  }
}

function drawLamp(s: PixelSurface, lx: number, ly: number, lit: boolean, t: number, i: number): void {
  s.drawGroundShadow(lx, ly, 4, 2, 1.0);
  s.fillRect(lx - 1, ly - 14, 3, 14, C.PLUM_OUTLINE);
  s.vline(lx, ly - 13, 13, C.SLATE_IRON);
  s.fillRect(lx - 3, ly - 19, 7, 6, C.PLUM_OUTLINE);
  if (lit) {
    s.fillRect(lx - 2, ly - 18, 5, 4, C.AMBER_GOLD, 1);
    s.pset(lx, ly - 17, C.IVORY_SPARK, 1);
    s.drawDitheredLight(lx, ly - 15, 28 + (Math.floor(t * 5 + i) % 3) * 2, 2.35);
  } else {
    s.fillRect(lx - 2, ly - 18, 5, 4, C.CERULEAN_GLASS);
  }
}

export function drawLabel(s: PixelSurface, texts: TextCmd[], l: SceneState['labels'][number], focus: Focus[]): void {
  if (l.age < 0) return;
  const drop = l.age < 0.25 ? 3 - Math.floor(l.age * 12) : 0;
  const w = Array.from(l.text).length * (isAscii(l.text) ? 4 : 8) + 10;
  const h = 13;
  const x = snapToPixel(l.x - w / 2);
  const y = snapToPixel(l.y - h - 5 - drop);
  s.fillRect(x, y, w, h, C.PLUM_OUTLINE, 1);
  s.fillRect(x + 1, y + 1, w - 2, h - 2, C.WARM_PARCHMENT, 1);
  s.hline(x + 1, y + 1, w - 2, C.IVORY_SPARK, 1);
  s.fillRect(l.x - 2, y + h, 4, 2, C.PLUM_OUTLINE, 1);
  s.pset(l.x - 1, y + h + 2, C.PLUM_OUTLINE, 1);
  s.pset(l.x, y + h + 3, C.PLUM_OUTLINE, 1);
  texts.push({ text: l.text, x: l.x, y: y + h / 2 + 0.5, size: 8, color: HEX(C.CRIMSON_BRICK), align: 'center', bold: true });
  focus.push({ x, y, w, h: h + 4, label: `label ${l.text}` });
}

function drawItems(s: PixelSurface, sc: SceneState, t: number): void {
  if (sc.belt <= 0.05) return;
  const big = sc.set === 'interior';
  for (const it of sc.items) {
    if (it.x < -16 || it.x > WORLD_W + 16) continue;
    if (big) drawItemScaled(s, it.x, it.y - 10, it.item, t, 2, true);
    else drawItem(s, it.x, it.y - 6, it.item, t, it.at < 0);
    if (it.at >= 0) {
      const ff = Math.floor(t * 12);
      for (let k = 0; k < 3; k++) {
        const a = hashFloat(ff * 3 + k + it.x) * Math.PI * 2;
        s.pset(it.x + Math.round(Math.cos(a) * 8), it.y - 8 + Math.round(Math.sin(a) * 5), k ? C.SUNLIGHT_CREAM : C.AMBER_GOLD, 1);
      }
    }
  }
}

type Actor = { y: number; draw: () => void };

function presenterActor(s: PixelSurface, pr: PresenterSpec, t: number, focus: Focus[]): Actor {
  return {
    y: pr.y,
    draw: () => {
      const b = drawPresenter(s, pr, t);
      focus.push({ ...b, label: pr.emote ? 'presenter+emote' : 'presenter' });
    },
  };
}

function drawFireflies(s: PixelSurface, amount: number, t: number): void {
  if (amount <= 0.01) return;
  const count = Math.floor(24 * clamp(amount, 0, 1));
  for (let i = 0; i < count; i++) {
    const fx = snapToPixel(10 + hashFloat(i * 41 + 7) * 460 + Math.sin(t * 1.35 + i * 2.1) * 11);
    const fy = snapToPixel(60 + hashFloat(i * 67 + 13) * 160 + Math.cos(t * 1.05 + i * 1.7) * 8 - ((t * 4 + i * 9) % 18));
    if (Math.sin(t * 4.5 + i * 1.9) > -0.35) {
      s.pset(fx, fy, C.IVORY_SPARK, 1);
      s.pset(fx + 1, fy, C.DEW_SPROUT, 1);
      s.drawDitheredLight(fx, fy, 11, 1.55);
    } else {
      s.pset(fx, fy, C.SPRING_LEAF, 1);
    }
  }
}

function renderStations(s: PixelSurface, sc: SceneState, t: number, texts: TextCmd[], focus: Focus[]): Actor[] {
  const actors: Actor[] = [];
  const order = sc.stations.map((st, i) => ({ st, i })).sort((a, b) => a.st.baseY - b.st.baseY);
  for (const { st } of order) {
    actors.push({
      y: st.baseY - 0.5,
      draw: () => {
        const d = { build: st.build, active: st.active, tint: st.tint, screen: st.screen, power: st.power, tod: sc.tod };
        const b = st.kit ? drawKitStation(s, st.kit, st.x, st.baseY, d, t) : drawStation(s, st.type, st.x, st.baseY, d, t);
        if (st.build > 0.02) {
          focus.push({ ...b, label: `station ${st.label}` });
          if (st.showLabel && st.build > 0.6) drawSign(s, texts, st.x, Math.max(2, b.y - 14), st.label);
        }
      },
    });
  }
  return actors;
}

function renderLaneOrMap(s: PixelSurface, sc: SceneState, t: number, texts: TextCmd[], focus: Focus[]): void {
  const indoor = isIndoor(sc.theme);
  drawBackdrop(s, sc.theme, sc.tod, t);
  if (sc.set === 'lane') drawPath(s, sc.theme, PATH_Y - 12);
  drawPads(s, sc.stations, sc.floor);

  // belts sit in front of stations of the same row, so stations (sorted by baseY) are interleaved with them
  const actors = renderStations(s, sc, t, texts, focus);
  if (sc.route) {
    const route = sc.route;
    actors.push({ y: sc.set === 'lane' ? BASE_Y : -1, draw: () => drawRouteBelt(s, route, sc.belt, t, sc.items.length > 0) });
    // each item sorts just in front of the station whose front it is passing
    sc.items.forEach((it) => actors.push({ y: it.y - BELT_DY + 0.6, draw: () => drawItems(s, { ...sc, items: [it] }, t) }));
  }
  if (sc.helpers) {
    sc.stations.forEach((st, i) => {
      if (st.build < 1) return;
      const working = sc.items.some((it) => it.at === i) || st.active;
      const state = working ? 'work' : sc.tod > 0.9 ? 'sleep' : 'idle';
      const hy = sc.set === 'lane' ? HELPER_Y : st.baseY + 24;
      actors.push({ y: hy, draw: () => { drawHelper(s, st.x - 24, hy, t, i, state, working ? 'gear' : undefined); } });
    });
  }
  const lamps: Array<readonly [number, number]> =
    sc.set === 'lane'
      ? (sc.stations.length > 1 ? sc.stations.slice(0, -1).map((st, i) => [Math.round((st.x + sc.stations[i + 1].x) / 2), PATH_Y - 13] as const) : [[WORLD_W / 2, PATH_Y - 13] as const])
      : sc.stations.map((st) => [st.x + 44, st.baseY + 22] as const);
  if (!indoor) {
    lamps.forEach(([lx, ly], i) => actors.push({ y: ly, draw: () => drawLamp(s, lx, ly, sc.lamps > i / lamps.length + 0.001, t, i) }));
  }
  if (sc.presenter) actors.push(presenterActor(s, sc.presenter, t, focus));
  actors.sort((a, b) => a.y - b.y);
  for (const a of actors) a.draw();

  drawFrontProps(s, sc.theme);
  if (!indoor) drawFireflies(s, sc.fireflies, t);
}

function renderInteriorSet(s: PixelSurface, sc: SceneState, t: number, texts: TextCmd[], focus: Focus[]): void {
  const st = sc.stations[sc.interior];
  const idraw = { active: st.active, power: st.power, tint: st.tint, screen: st.screen, tod: sc.tod };
  const top = st.kit ? drawKitInterior(s, st.kit, idraw, t) : drawInterior(s, st.type, idraw, t);
  focus.push({ x: MACHINE_X - 80, y: top, w: 160, h: INTERIOR_BELT_Y - top, label: `station ${st.label}` });
  // room name plate, fixed at the top so it never covers the mechanism
  if (st.showLabel) drawSign(s, texts, MACHINE_X, 3, st.label, 1, 10);
  if (sc.route) {
    drawRouteBelt(s, sc.route, sc.belt, t, sc.items.length > 0);
    drawItems(s, sc, t);
  }
  const actors: Actor[] = [];
  if (sc.helpers) {
    [150, 330].forEach((hx, k) => actors.push({ y: INTERIOR_HELPER_Y, draw: () => { drawHelper(s, hx, INTERIOR_HELPER_Y, t, k + sc.interior, st.active ? 'work' : 'idle', st.active ? 'gear' : undefined); } }));
  }
  if (sc.presenter) actors.push(presenterActor(s, sc.presenter, t, focus));
  actors.sort((a, b) => a.y - b.y);
  for (const a of actors) a.draw();
}

/** Board set: big chalkboard on the wall; panels default onto it */
export const BOARD_RECT = { x: 116, y: 10, w: 356, h: 170 } as const;

function renderBoardSet(s: PixelSurface, sc: SceneState, t: number, focus: Focus[]): void {
  drawBackdrop(s, sc.theme, sc.tod, t);
  drawPath(s, sc.theme, PATH_Y - 12);
  const { x, y, w, h } = BOARD_RECT;
  for (const lx of [x + 20, x + w - 24]) {
    s.fillRect(lx, y + h - 4, 4, PATH_Y - 14 - (y + h - 4), C.PLUM_OUTLINE);
    s.vline(lx + 1, y + h - 4, PATH_Y - 14 - (y + h - 4), C.CEDAR_PLANK);
  }
  s.drawGroundShadow(x + w / 2, PATH_Y - 14, w / 2 - 10, 4, 1.2);
  s.fillRect(x, y, w, h, C.PLUM_OUTLINE);
  s.fillRect(x + 2, y + 2, w - 4, h - 4, C.CEDAR_PLANK);
  s.hline(x + 2, y + 2, w - 4, C.HONEY_PINE);
  s.fillRect(x + 6, y + 6, w - 12, h - 14, C.PINE_SHADE);
  s.drawDitheredRect(x + 6, y + 6, w - 12, h - 14, C.FOREST_MOSS, 0.12);
  s.fillRect(x + 6, y + h - 8, w - 12, 4, C.ROASTED_OAK);
  s.fillRect(x + 30, y + h - 10, 8, 2, C.IVORY_SPARK);
  s.fillRect(x + 44, y + h - 10, 6, 2, C.AMBER_GOLD);
  focus.push({ x, y, w, h, label: 'board' });
  if (sc.presenter) presenterActor(s, sc.presenter, t, focus).draw();
  drawFrontProps(s, sc.theme);
}

/** Render a free-form scene composed of background, Y-sorted actors/presenter, and foreground */
export function renderFreeWorld(
  s: PixelSurface,
  shot: ShotDef,
  registry: Record<string, ComponentDef>,
  t: number,
  lt: number,
  texts: TextCmd[] = [],
  focus: Focus[] = []
): void {
  // 1. Background layer
  if (shot.background && registry[shot.background.use]) {
    const bgDef = registry[shot.background.use];
    const scratch = createScratchSurface(480, 240);
    const api = createDrawApi(scratch, t, lt, (cmd) => texts.push(cmd));
    bgDef.draw(api, shot.background.params ?? {}, t, lt);
    blitComponentToWorld(scratch, s, 0, 0, { isBackground: true });
  }

  // 2. Y-sorted dynamic layer (actors + presenter)
  interface RenderEntity {
    y: number;
    draw: () => void;
  }
  const sortables: RenderEntity[] = [];

  if (shot.actors) {
    for (const a of shot.actors) {
      if (a.layer === 'front') continue;
      const comp = registry[a.use];
      if (!comp) continue;
      const ax = typeof a.x === 'number' ? a.x : evalTrack(a.x, lt, shot.dur);
      const ay = typeof a.y === 'number' ? a.y : evalTrack(a.y, lt, shot.dur);
      const [cw, ch] = comp.size;
      sortables.push({
        y: ay,
        draw: () => {
          const scratch = createScratchSurface(cw, ch);
          const api = createDrawApi(scratch, t, lt, (cmd) => texts.push(cmd));
          comp.draw(api, a.params ?? {}, t, lt);
          blitComponentToWorld(scratch, s, ax, ay, {
            flip: a.flip,
            scale: a.scale,
          });
        },
      });
    }
  }

  // Sort by Y ascending (further back draws first, closer draws on top)
  sortables.sort((e1, e2) => e1.y - e2.y);
  for (const ent of sortables) ent.draw();

  // 3. Foreground layer
  const foregroundList = [
    ...(shot.foreground ?? []),
    ...(shot.actors?.filter((a) => a.layer === 'front') ?? []).map((a) => ({
      use: a.use,
      x: a.x,
      y: a.y,
      params: a.params,
    })),
  ];

  for (const fg of foregroundList) {
    const comp = registry[fg.use];
    if (!comp) continue;
    const fx = typeof fg.x === 'number' ? fg.x : (fg.x !== undefined ? evalTrack(fg.x, lt, shot.dur) : 240);
    const fy = typeof fg.y === 'number' ? fg.y : (fg.y !== undefined ? evalTrack(fg.y, lt, shot.dur) : 240);
    const [cw, ch] = comp.size;
    const scratch = createScratchSurface(cw, ch);
    const api = createDrawApi(scratch, t, lt, (cmd) => texts.push(cmd));
    comp.draw(api, fg.params ?? {}, t, lt);
    blitComponentToWorld(scratch, s, fx, fy);
  }

  // 4. Labels
  if (shot.labels) {
    for (const l of shot.labels) {
      drawLabel(s, texts, { ...l, tint: l.tint ?? 'red', age: lt - (l.at ?? 0) }, focus);
    }
  }
}

/** Render the whole 480×240 world. Emits HD text commands and focus boxes in world coordinates. */
export function renderWorld(s: PixelSurface, sc: SceneState, t: number, texts: TextCmd[], focus: Focus[]): void {
  s.clear(C.MEADOW_GREEN, 0);
  if (sc.set === 'interior') renderInteriorSet(s, sc, t, texts, focus);
  else if (sc.set === 'board') renderBoardSet(s, sc, t, focus);
  else renderLaneOrMap(s, sc, t, texts, focus);
  for (const l of sc.labels) drawLabel(s, texts, l, focus);
}
