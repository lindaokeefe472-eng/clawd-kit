import test from 'node:test';
import assert from 'node:assert/strict';

import { flowItems } from '../src/engine/flow.ts';
import { laneRoute, mapRoute, routePoint } from '../src/engine/route.ts';

const xs = laneRoute([100, 200, 300], 156);
const stations = [
  { type: 'bench', label: 'A', emits: { kind: 'gem', tint: 'red' } },
  { type: 'furnace', label: 'B', emits: { kind: 'ingot', tint: 'gold' } },
  { type: 'tower', label: 'C' },
];
const source = { kind: 'scroll', tint: 'wood' };

test('single item travels from source and dwells in stations', () => {
  const f = [{ from: -1, to: 2, speed: 100, dwell: 1 }];
  // spawn at x=-10: reaches station 0 (x=100) after 1.1s
  let r = flowItems(f, 0.5, xs, stations, source);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].item.kind, 'scroll');
  assert.ok(r.items[0].x > -10 && r.items[0].x < 100);
  assert.equal(r.working.size, 0);
  r = flowItems(f, 1.5, xs, stations, source);
  assert.equal(r.items[0].x, 100);
  assert.ok(r.working.has(0));
  r = flowItems(f, 2.6, xs, stations, source);
  assert.equal(r.items[0].item.kind, 'gem');
  assert.ok(r.items[0].x > 100 && r.items[0].x < 200);
});

test('item is consumed after dwelling at destination', () => {
  const f = [{ from: 0, to: 1, speed: 100, dwell: 0.5 }];
  assert.equal(flowItems(f, 1.2, xs, stations, source).items.length, 1);
  assert.ok(flowItems(f, 1.2, xs, stations, source).working.has(1));
  assert.equal(flowItems(f, 1.7, xs, stations, source).items.length, 0);
});

test('periodic spawns produce a stream; count limits it', () => {
  const f = [{ from: 0, every: 0.5, count: 3, speed: 100, dwell: 0 }];
  assert.equal(flowItems(f, 1.2, xs, stations, source).items.length, 3);
  assert.equal(flowItems(f, 0.2, xs, stations, source).items.length, 1);
});

test('deterministic: same input same output', () => {
  const f = [{ from: -1, every: 0.7, count: 9 }];
  assert.deepEqual(flowItems(f, 3.3, xs, stations, source), flowItems(f, 3.3, xs, stations, source));
});

test('lane route maps distance to points on the belt line', () => {
  const r = laneRoute([100, 200], 156);
  assert.deepEqual(routePoint(r, 0), [-10, 156]);
  assert.deepEqual(routePoint(r, r.stops[1]), [200, 156]);
  assert.ok(r.length > 490);
});

test('map route stays in front of stations: down first, or across then up', () => {
  const r = mapRoute([[80, 100], [200, 180], [380, 120]], 6);
  assert.deepEqual(routePoint(r, r.stops[0]), [80, 106]);
  assert.deepEqual(routePoint(r, r.stops[1]), [200, 186]);
  assert.deepEqual(routePoint(r, r.stops[2]), [380, 126]);
  // toward a lower station: straight down first
  assert.deepEqual(routePoint(r, r.stops[0] + 20), [80, 126]);
  // toward a higher station: across first
  assert.deepEqual(routePoint(r, r.stops[1] + 20), [220, 186]);
});

test('items on a map route report 2D positions', () => {
  const r = mapRoute([[80, 100], [200, 180]], 6);
  const f = [{ from: 0, to: 1, speed: 100, dwell: 0 }];
  const it = flowItems(f, 0.3, r, stations, source).items[0];
  assert.deepEqual([it.x, it.y], [80, 136]);
});

test('null stops are skipped: interior shows one machine only', () => {
  const r = { ...laneRoute([240], 186), stops: [null, 250, null] };
  const f = [{ from: -1, speed: 100, dwell: 1, item: { kind: 'gem', tint: 'red' } }];
  // 2.5s to reach the machine, 1s dwell (working = station 1), then morph into station 1 emits
  assert.ok(flowItems(f, 3, r, stations, source).working.has(1));
  const after = flowItems(f, 4, r, stations, source).items[0];
  assert.equal(after.item.kind, 'ingot');
  assert.equal(flowItems(f, 9, r, stations, source).items.length, 0);
});
