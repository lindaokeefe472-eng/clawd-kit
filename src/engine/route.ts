// Belt routes: a polyline plus the distance of each station along it (null = station not on this route)
export interface Route {
  pts: ReadonlyArray<readonly [number, number]>;
  /** Cumulative distance at each polyline point */
  cum: readonly number[];
  stops: ReadonlyArray<number | null>;
  length: number;
}

export const ROUTE_MARGIN = 10;

function build(pts: Array<readonly [number, number]>, stopPts: ReadonlyArray<readonly [number, number] | null>): Route {
  const clean: Array<readonly [number, number]> = [];
  for (const p of pts) {
    const last = clean[clean.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) clean.push(p);
  }
  const cum = [0];
  for (let i = 1; i < clean.length; i++) cum.push(cum[i - 1] + Math.abs(clean[i][0] - clean[i - 1][0]) + Math.abs(clean[i][1] - clean[i - 1][1]));
  // a stop's distance = first time the polyline passes its point
  let searchFrom = 0;
  const stops = stopPts.map((sp) => {
    if (!sp) return null;
    for (let i = searchFrom; i < clean.length - 1; i++) {
      const [ax, ay] = clean[i];
      const [bx, by] = clean[i + 1];
      const onX = ay === by && sp[1] === ay && sp[0] >= Math.min(ax, bx) && sp[0] <= Math.max(ax, bx);
      const onY = ax === bx && sp[0] === ax && sp[1] >= Math.min(ay, by) && sp[1] <= Math.max(ay, by);
      if (onX || onY) {
        searchFrom = i;
        return cum[i] + Math.abs(sp[0] - ax) + Math.abs(sp[1] - ay);
      }
    }
    return null;
  });
  return { pts: clean, cum, stops, length: cum[cum.length - 1] };
}

/** Straight belt at height y from the left edge to the right edge */
export function laneRoute(xs: readonly number[], y: number, worldW = 480): Route {
  return build([[-ROUTE_MARGIN, y], [worldW + ROUTE_MARGIN, y]], xs.map((x) => [x, y] as const));
}

/**
 * Manhattan route through station fronts (x, baseY + dy). Segments always pass in front of stations:
 * toward a lower station go down first then across; toward a higher one go across first then up.
 */
export function mapRoute(positions: ReadonlyArray<readonly [number, number]>, dy: number, worldW = 480): Route {
  const fronts = positions.map(([x, y]) => [x, y + dy] as const);
  const pts: Array<readonly [number, number]> = [[-ROUTE_MARGIN, fronts[0][1]], fronts[0]];
  for (let i = 1; i < fronts.length; i++) {
    const [ax, ay] = fronts[i - 1];
    const [bx, by] = fronts[i];
    pts.push(by >= ay ? [ax, by] : [bx, ay], [bx, by]);
  }
  const last = fronts[fronts.length - 1];
  pts.push([worldW + ROUTE_MARGIN, last[1]]);
  return build(pts, fronts);
}

export function routePoint(r: Route, d: number): [number, number] {
  if (d <= 0) return [r.pts[0][0] + d * Math.sign(r.pts[1][0] - r.pts[0][0] || 1), r.pts[0][1]];
  for (let i = 0; i < r.pts.length - 1; i++) {
    if (d <= r.cum[i + 1]) {
      const [ax, ay] = r.pts[i];
      const [bx, by] = r.pts[i + 1];
      const k = d - r.cum[i];
      return [ax + Math.sign(bx - ax) * k, ay + Math.sign(by - ay) * k];
    }
  }
  return [...r.pts[r.pts.length - 1]] as [number, number];
}

/** Axis-aligned segments for drawing belts */
export function routeSegments(r: Route): Array<readonly [number, number, number, number]> {
  const out: Array<readonly [number, number, number, number]> = [];
  for (let i = 0; i < r.pts.length - 1; i++) out.push([r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]]);
  return out;
}
