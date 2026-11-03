// Belt flow: items spawn, ride a route, dwell (get processed) in stations and morph — pure function of lt
import type { FlowDef, StationDef } from './storyboard.ts';
import type { ItemSpec } from './sprites.ts';
import { routePoint } from './route.ts';
import type { Route } from './route.ts';

export interface BeltItem {
  x: number;
  y: number;
  item: ItemSpec;
  /** Station index currently processing this item, -1 when riding */
  at: number;
}

const DEFAULT_ITEM: ItemSpec = { kind: 'gem', tint: 'blue' };

export function flowItems(
  flows: readonly FlowDef[],
  lt: number,
  route: Route,
  stations: readonly StationDef[],
  source: ItemSpec | undefined
): { items: BeltItem[]; working: Set<number> } {
  const items: BeltItem[] = [];
  const working = new Set<number>();

  for (const f of flows) {
    const from = f.from ?? -1;
    const speed = f.speed ?? 70;
    const dwell = f.dwell ?? 0.6;
    const count = f.count ?? 1;
    const every = f.every ?? 1;
    const start = f.start ?? 0;
    const d0 = from < 0 ? 0 : route.stops[from] ?? 0;
    const last = f.to ?? route.stops.length - 1;
    const exits = f.to === undefined;
    const base: ItemSpec = f.item ?? (from >= 0 ? stations[from].emits : undefined) ?? source ?? DEFAULT_ITEM;

    for (let i = 0; i < count; i++) {
      let age = lt - start - i * every;
      if (age < 0) continue;
      let d = d0;
      let item = base;
      let at = -1;
      let alive = true;
      let placed = false;
      for (let k = from + 1; k <= last; k++) {
        const stop = route.stops[k];
        if (stop === null || stop === undefined) continue;
        const travel = Math.abs(stop - d) / speed;
        if (age < travel) {
          d += Math.sign(stop - d) * age * speed;
          placed = true;
          break;
        }
        age -= travel;
        d = stop;
        if (age < dwell) {
          at = k;
          placed = true;
          break;
        }
        age -= dwell;
        item = stations[k].emits ?? item;
        if (k === last && !exits) {
          alive = false;
          break;
        }
      }
      if (!placed && alive) {
        d += age * speed;
        if (d > route.length) alive = false;
      }
      if (!alive) continue;
      if (at >= 0) working.add(at);
      const [x, y] = routePoint(route, d);
      items.push({ x: Math.floor(x), y: Math.floor(y), item, at });
    }
  }
  return { items, working };
}
