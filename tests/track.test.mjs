import test from 'node:test';
import assert from 'node:assert/strict';

import { evalTrack, evalStep, trackMoving } from '../src/engine/track.ts';

test('number track is constant', () => {
  assert.equal(evalTrack(3, 0, 4), 3);
  assert.equal(evalTrack(3, 4, 4), 3);
});

test('[a,b] track eases across the whole shot', () => {
  assert.equal(evalTrack([0, 10], 0, 4), 0);
  assert.equal(evalTrack([0, 10], 4, 4), 10);
  assert.equal(evalTrack([0, 10], 2, 4), 5);
});

test('keyframe track holds before first and after last key', () => {
  const k = [[1, 100], [2, 200]];
  assert.equal(evalTrack(k, 0, 5), 100);
  assert.equal(evalTrack(k, 1.5, 5), 150);
  assert.equal(evalTrack(k, 4, 5), 200);
});

test('undefined track falls back to default', () => {
  assert.equal(evalTrack(undefined, 1, 2, 7), 7);
});

test('step track switches at key times', () => {
  const s = [[0, 'walk'], [1.2, 'point']];
  assert.equal(evalStep(s, 0.5, 'idle'), 'walk');
  assert.equal(evalStep(s, 1.2, 'idle'), 'point');
  assert.equal(evalStep('think', 9, 'idle'), 'think');
  assert.equal(evalStep(undefined, 1, 'idle'), 'idle');
  assert.equal(evalStep([[1, 'bulb']], 0.5, null), null);
});

test('trackMoving reports motion only between differing keys', () => {
  const k = [[0, 100], [1, 140], [2, 140]];
  assert.equal(trackMoving(k, 0.5, 3), 1);
  assert.equal(trackMoving(k, 1.5, 3), 0);
  assert.equal(trackMoving([[0, 140], [1, 100]], 0.5, 3), -1);
  assert.equal(trackMoving(5, 0.5, 3), 0);
});

test('through track hits every waypoint at its time without stopping in between', () => {
  const k = { through: [[0, 0], [1, 100], [3, 300], [4, 300]] };
  assert.equal(evalTrack(k, 0, 4), 0);
  assert.equal(evalTrack(k, 1, 4), 100);
  assert.equal(evalTrack(k, 3, 4), 300);
  assert.equal(evalTrack(k, 9, 4), 300);
  assert.equal(evalTrack(k, -1, 4), 0);
  // at the middle waypoint the speed is not zero (plain keyframes stop there)
  const v = (tr, t) => (evalTrack(tr, t + 0.01, 4) - evalTrack(tr, t - 0.01, 4)) / 0.02;
  assert.ok(v(k, 1) > 50, `through speed at waypoint ${v(k, 1)}`);
  assert.ok(Math.abs(v(k.through, 1)) < 5, 'eased keyframes stop at each key');
  // ends ease in and out by default; no overshoot past a flat stretch
  assert.ok(v(k, 0.001) < 40);
  for (let t = 3; t <= 4; t += 0.1) assert.ok(evalTrack(k, t, 4) <= 300.0001);
});

test('through track with ends: linear keeps moving at the first and last waypoint', () => {
  const k = { through: [[0, -200], [2, 600], [4, 2100]], ends: 'linear' };
  const v = (t) => (evalTrack(k, t + 0.01, 4) - evalTrack(k, t - 0.01, 4)) / 0.02;
  assert.ok(v(0.01) > 300, `start speed ${v(0.01)}`);
  assert.ok(v(3.99) > 300, `end speed ${v(3.99)}`);
  assert.equal(trackMoving(k, 1, 4), 1);
});
