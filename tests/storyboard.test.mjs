import test from 'node:test';
import assert from 'node:assert/strict';

import { validateProject, validateStoryboard, lintStoryboard, buildTimeline, stationKeys } from '../src/engine/storyboard.ts';

const project = {
  title: '测试',
  stations: [
    { type: 'bench', label: '取指', tint: 'red' },
    { type: 'furnace', label: 'EX' },
    { type: 'tower', label: '结果', emits: { kind: 'ingot', tint: 'gold', glyph: '14' } },
  ],
};

const shot = (over = {}) => ({ id: 'S01', chapter: 'CH1', dur: 4, sub: '清晨，工坊醒来了。', read: '建立场景', ...over });

test('valid project passes', () => {
  assert.deepEqual(validateProject(project), []);
});

test('project rejects unknown station type and too many stations', () => {
  const bad = { title: 'x', stations: [{ type: 'rocket', label: 'a' }] };
  assert.match(validateProject(bad).join('\n'), /rocket/);
  const many = { title: 'x', stations: Array.from({ length: 7 }, () => ({ type: 'bench', label: 'a' })) };
  assert.match(validateProject(many).join('\n'), /1\.\.6/);
});

test('timeline accumulates durations', () => {
  const tl = buildTimeline([shot(), shot({ id: 'S02', dur: 2.5 })]);
  assert.deepEqual(tl.map((s) => [s.start, s.end]), [[0, 4], [4, 6.5]]);
});

test('valid storyboard passes', () => {
  const shots = [
    shot({
      cam: { from: 's0', to: 's1', over: 1 },
      stations: { all: { build: 1 }, '1': { active: [[0, false], [1, true]] } },
      presenter: { x: [[0, 100], [1, 140]], at: undefined, pose: 'point', emote: [[0.3, 'bulb']] },
      flow: [{ from: -1, to: 2, every: 1, count: 3 }],
      panels: [{ type: 'title', text: '流水线' }],
    }),
  ];
  assert.deepEqual(validateStoryboard(project, shots, []), []);
});

test('storyboard catches common authoring mistakes', () => {
  const errs = validateStoryboard(
    project,
    [
      shot(),
      shot({
        sub: '这是一句非常非常非常非常非常非常非常非常非常非常长到观众根本读不完的字幕文本啊啊啊',
        dur: 2,
        cam: { from: 'wide', to: 's9' },
        stations: { '5': { build: 1 } },
        presenter: { pose: 'dance', emote: 'lol' },
        panels: [{ type: 'pie' }],
        custom: 'missingFn',
        tin: 'spin',
      }),
    ],
    []
  );
  const all = errs.join('\n');
  assert.match(all, /duplicate id S01/);
  assert.match(all, /sub too long/);
  assert.match(all, /too fast/);
  assert.match(all, /cam/);
  assert.match(all, /station key "5"/);
  assert.match(all, /pose "dance"/);
  assert.match(all, /emote "lol"/);
  assert.match(all, /panel type "pie"/);
  assert.match(all, /custom "missingFn"/);
  assert.match(all, /tin "spin"/);
});

test('stationKeys expands all / ranges / single', () => {
  assert.deepEqual(stationKeys('all', 3), [0, 1, 2]);
  assert.deepEqual(stationKeys('0-1', 3), [0, 1]);
  assert.deepEqual(stationKeys('2', 3), [2]);
  assert.equal(stationKeys('7', 3), null);
});

test('sets: interior needs a station, map needs project.map, split needs both sides', () => {
  const errs = validateStoryboard(
    project,
    [
      shot({ id: 'A', set: 'interior' }),
      shot({ id: 'B', set: 'map' }),
      shot({ id: 'C', set: 'split', split: { left: { title: '之前' } } }),
      shot({ id: 'D', set: 'cave' }),
      shot({ id: 'E', theme: 'moon' }),
      shot({ id: 'F', set: 'interior', interior: 1, cam: 's1' }),
    ],
    []
  ).join('\n');
  assert.match(errs, /shot A: set interior needs "interior"/);
  assert.match(errs, /shot B: set map needs project\.map/);
  assert.match(errs, /shot C: split needs left and right/);
  assert.match(errs, /shot D: set "cave"/);
  assert.match(errs, /shot E: theme "moon"/);
  assert.match(errs, /shot F: cam "s1" only works in lane\/map/);
});

test('valid map / interior / board / split shots pass', () => {
  const p = { ...project, theme: 'indoor', map: [[80, 110], [240, 170], [400, 120]] };
  const shots = [
    shot({ id: 'A', set: 'map', cam: 's1' }),
    shot({ id: 'B', set: 'interior', interior: 2 }),
    shot({ id: 'C', set: 'board', panels: [{ type: 'note', text: 'x' }] }),
    shot({ id: 'D', set: 'split', split: { left: { title: '之前', stations: { all: { build: 1 } } }, right: { title: '之后', set: 'interior', interior: 1 } } }),
  ];
  assert.deepEqual(validateStoryboard(p, shots, []), []);
});

test('lint warns when the same set repeats too long or too few sets are used', () => {
  const many = Array.from({ length: 10 }, (_, i) => shot({ id: `S${i}` }));
  const warns = lintStoryboard(project, many).join('\n');
  assert.match(warns, /same set "lane" for 10 shots in a row/);
  assert.match(warns, /only 1 set/);
});
