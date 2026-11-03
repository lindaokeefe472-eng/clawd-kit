// Interpreter: one storyboard shot + local time -> fully resolved SceneState and camera
import { WORLD_H, WORLD_W, clamp, easeInOutQuad, lerp } from './palette.ts';
import { flowItems } from './flow.ts';
import { isCamTarget, stationKeys } from './storyboard.ts';
import type { CamDef, CamTarget, FlowDef, ProjectDef, ShotDef } from './storyboard.ts';
import { evalStep, evalTrack, stepAge, trackMoving } from './track.ts';
import { BASE_Y, BELT_DY, BELT_Y, PATH_Y, stationX } from './world.ts';
import type { SceneState, SceneStation, WorldSet } from './world.ts';
import { laneRoute, mapRoute } from './route.ts';
import type { Route } from './route.ts';
import { INTERIOR_BELT_Y, INTERIOR_PATH_Y, MACHINE_X } from './interior.ts';

export interface Camera {
  x: number;
  y: number;
  x0?: number;
  y0?: number;
  zoom: 1 | 2;
}

/** Feet position of the presenter standing "at" a station in each set */
function standAt(set: WorldSet, st: SceneStation): [number, number] {
  // beside the station (its belt leaves straight down from the front)
  if (set === 'map') return [st.x + 22, st.baseY + 40];
  if (set === 'interior') return [MACHINE_X - 100, INTERIOR_PATH_Y];
  return [st.x, PATH_Y];
}

/** `shot` may be a split side merged over its parent shot */
export function resolveScene(p: ProjectDef, shot: ShotDef, lt: number): SceneState {
  const dur = shot.dur;
  const n = p.stations.length;
  const set: WorldSet = shot.set === 'map' || shot.set === 'interior' || shot.set === 'board' ? shot.set : 'lane';
  const interior = clamp(shot.interior ?? 0, 0, n - 1);
  const tod = clamp(evalTrack(shot.tod, lt, dur, 0.35), 0, 1);

  const positions: ReadonlyArray<readonly [number, number]> =
    set === 'map' && p.map ? p.map : p.stations.map((_, i) => [stationX(i, n), BASE_Y] as const);

  const st: Array<SceneStation & { explicitActive?: boolean }> = p.stations.map((d, i) => ({
    type: d.type ?? 'bench',
    kit: d.kit,
    label: d.label,
    tint: d.tint ?? 'blue',
    x: set === 'interior' ? MACHINE_X : positions[i][0],
    baseY: positions[i][1],
    // inside a station the machine is always there
    build: set === 'interior' && i === interior ? 1 : 0,
    active: false,
    power: 0,
    screen: d.screen,
    showLabel: true,
  }));
  for (const [key, cfg] of Object.entries(shot.stations ?? {})) {
    for (const i of stationKeys(key, n) ?? []) {
      const s = st[i];
      if (cfg.build !== undefined) s.build = clamp(evalTrack(cfg.build, lt, dur), 0, 1);
      if (cfg.power !== undefined) s.power = clamp(evalTrack(cfg.power, lt, dur), 0, 1);
      if (cfg.active !== undefined) s.explicitActive = evalStep(cfg.active, lt, false);
      if (cfg.screen !== undefined) s.screen = cfg.screen;
      if (cfg.hideLabel) s.showLabel = false;
    }
  }

  let route: Route | null = null;
  let flows: readonly FlowDef[] = shot.flow ?? [];
  if (set === 'lane') route = laneRoute(st.map((s) => s.x), BELT_Y);
  else if (set === 'map') route = mapRoute(positions, BELT_DY);
  else if (set === 'interior') {
    // one machine on a straight belt: items enter as whatever the previous station emitted
    const base = laneRoute([MACHINE_X], INTERIOR_BELT_Y);
    route = { ...base, stops: p.stations.map((_, i) => (i === interior ? base.stops[0] : null)) };
    const incoming = (interior > 0 ? p.stations[interior - 1].emits : undefined) ?? p.source;
    flows = flows.map((f) => ({ ...f, from: -1, to: undefined, item: f.item ?? incoming }));
  } else flows = [];

  const flow = route ? flowItems(flows, lt, route, p.stations, p.source) : { items: [], working: new Set<number>() };
  for (let i = 0; i < n; i++) st[i].active = st[i].explicitActive ?? flow.working.has(i);

  let presenter: SceneState['presenter'] = null;
  const pr = shot.presenter;
  if (pr) {
    const stand = pr.at !== undefined ? standAt(set, st[clamp(pr.at, 0, n - 1)]) : null;
    const fixed = stand !== null && pr.x === undefined;
    const x = fixed ? stand[0] : evalTrack(pr.x, lt, dur, set === 'board' ? 90 : WORLD_W / 2);
    const defaultY = stand ? stand[1] : set === 'interior' ? INTERIOR_PATH_Y : PATH_Y;
    const moving = fixed ? 0 : trackMoving(pr.x, lt, dur);
    const emote = evalStep(pr.emote, lt, null);
    presenter = {
      x: Math.floor(x),
      y: Math.floor(evalTrack(pr.y, lt, dur, defaultY)),
      pose: moving ? 'walk' : evalStep(pr.pose, lt, 'idle'),
      dir: moving ? (moving > 0 ? 'right' : 'left') : evalStep(pr.dir, lt, 'down'),
      emote: emote ?? undefined,
      emoteT: stepAge(pr.emote, lt),
      lantern: pr.lantern,
    };
  }

  const w = shot.world ?? {};
  return {
    set,
    theme: shot.theme ?? p.theme ?? 'meadow',
    interior,
    tod,
    floor: evalTrack(w.floor, lt, dur, 1),
    belt: evalTrack(w.belt, lt, dur, 1),
    lamps: evalTrack(w.lamps, lt, dur, tod > 0.6 ? 1 : 0),
    fireflies: evalTrack(w.fireflies, lt, dur, tod > 0.85 ? 1 : 0),
    stations: st.map(({ explicitActive: _e, ...rest }) => rest),
    route,
    presenter,
    helpers: shot.helpers ?? true,
    items: flow.items,
    labels: (shot.labels ?? [])
      .filter((l) => lt >= (l.at ?? 0) && (l.until === undefined || lt < l.until))
      .map((l) => ({ text: l.text, x: l.x, y: l.y, tint: l.tint ?? 'red', age: lt - (l.at ?? 0) })),
  };
}

const VIEW_W2 = WORLD_W / 2;
const VIEW_H2 = WORLD_H / 2;
/** Top of the zoom-2 window for lane sN shots: keeps signs, station and belt, excludes the presenter path */
const STATION_CAM_Y = 40;

function originFor(target: CamTarget, scene: SceneState): Camera {
  if (target === 'wide') return { x: 0, y: 0, zoom: 1 };
  let cx: number;
  let cy: number;
  if (target === 'presenter') {
    cx = scene.presenter?.x ?? WORLD_W / 2;
    cy = (scene.presenter?.y ?? PATH_Y) - 34;
  } else if (Array.isArray(target)) {
    [cx, cy] = target as readonly [number, number];
  } else {
    // sN: station + sign + belt; pN: the presenter level in front of station N
    const station = String(target)[0] === 's';
    const st = scene.stations[Number(String(target).slice(1))];
    cx = st.x;
    if (scene.set === 'map') cy = station ? st.baseY - 40 : st.baseY + 20;
    else cy = station ? STATION_CAM_Y + VIEW_H2 / 2 : WORLD_H - VIEW_H2 / 2;
  }
  return {
    x: Math.floor(clamp(cx - VIEW_W2 / 2, 0, WORLD_W - VIEW_W2)),
    y: Math.floor(clamp(cy - VIEW_H2 / 2, 0, WORLD_H - VIEW_H2)),
    zoom: 2,
  };
}

export function resolveCamera(
  camOrShot: CamDef | ShotDef | undefined,
  lt: number,
  durOrLt: number,
  scene?: SceneState,
  maybeShot?: ShotDef
): Camera {
  const isShot = camOrShot !== undefined && typeof camOrShot === 'object' && 'dur' in camOrShot && 'sub' in camOrShot;
  const shot = isShot ? (camOrShot as ShotDef) : maybeShot;
  const cam = isShot ? (camOrShot as ShotDef).cam : (camOrShot as CamDef | undefined);
  const dur = isShot ? (camOrShot as ShotDef).dur : durOrLt;

  if (cam === undefined) return { x: 0, y: 0, x0: 0, y0: 0, zoom: 1 };

  if (typeof cam === 'object' && 'follow' in cam && cam.follow !== undefined) {
    let cx = WORLD_W / 2;
    let cy = WORLD_H / 2;
    if (cam.follow === 'presenter') {
      cx = scene?.presenter?.x ?? WORLD_W / 2;
      cy = (scene?.presenter?.y ?? PATH_Y) - 34;
    } else if (Array.isArray(cam.follow)) {
      [cx, cy] = cam.follow as readonly [number, number];
    } else if (typeof cam.follow === 'string') {
      const targetActor = shot?.actors?.find((a) => a.id === cam.follow);
      if (targetActor) {
        cx = typeof targetActor.x === 'number' ? targetActor.x : evalTrack(targetActor.x, lt, dur);
        cy = typeof targetActor.y === 'number' ? targetActor.y : evalTrack(targetActor.y, lt, dur);
      }
    }
    const zoom = cam.zoom ?? 2;
    const vw = zoom === 2 ? VIEW_W2 : WORLD_W;
    const vh = zoom === 2 ? VIEW_H2 : WORLD_H;
    const x = Math.floor(clamp(cx - vw / 2, 0, WORLD_W - vw));
    const y = Math.floor(clamp(cy - vh / 2, 0, WORLD_H - vh));
    return { x, y, x0: x, y0: y, zoom };
  }

  if (isCamTarget(cam)) {
    const orig = originFor(cam, scene ?? ({ presenter: null, stations: [], set: 'lane' } as unknown as SceneState));
    return { ...orig, x0: orig.x, y0: orig.y };
  }
  if ('from' in cam) {
    const sc = scene ?? ({ presenter: null, stations: [], set: 'lane' } as unknown as SceneState);
    const a = originFor(cam.from, sc);
    const b = originFor(cam.to, sc);
    const k = easeInOutQuad(clamp((lt - (cam.at ?? 0)) / (cam.over ?? Math.min(1.2, dur * 0.5)), 0, 1));
    const x = Math.floor(lerp(a.x, b.x, k));
    const y = Math.floor(lerp(a.y, b.y, k));
    return { x, y, x0: x, y0: y, zoom: b.zoom };
  }
  const zoom: 1 | 2 = (typeof cam === 'object' && 'zoom' in cam && cam.zoom !== undefined) ? cam.zoom : 1;
  const maxX = zoom === 2 ? WORLD_W - VIEW_W2 : 0;
  const maxY = zoom === 2 ? WORLD_H - VIEW_H2 : 0;
  const x = Math.floor(clamp(typeof cam === 'object' && 'x' in cam && cam.x !== undefined ? evalTrack(cam.x, lt, dur) : 0, 0, maxX));
  const y = Math.floor(clamp(typeof cam === 'object' && 'y' in cam && cam.y !== undefined ? evalTrack(cam.y, lt, dur) : 0, 0, maxY));
  return { x, y, x0: x, y0: y, zoom };
}
