import test from 'node:test';
import assert from 'node:assert/strict';

import { PixelSurface } from '../src/engine/surface.ts';
import { C } from '../src/engine/palette.ts';
import { validateStoryboard, lintStoryboard } from '../src/engine/storyboard.ts';
import { renderFreeWorld } from '../src/engine/world.ts';
import { resolveCamera } from '../src/engine/scene.ts';

// Dummy test components
const bgComponent = {
  name: 'bg_space',
  kind: 'background',
  description: 'Deep space backdrop',
  tags: ['space'],
  size: [480, 240],
  draw(api) {
    api.s.clear(api.C.VOID_INK, 0);
    api.s.fillRect(0, 0, 480, 240, api.C.INDIGO_NIGHT, 0);
  },
};

const leadActor = {
  name: 'lead_star',
  kind: 'actor',
  description: 'Main actor',
  tags: ['star'],
  size: [20, 20],
  draw(api) {
    // 10x10 square at center
    api.s.fillRect(5, 5, 10, 10, api.C.AMBER_GOLD, 1);
  },
};

const backActor = {
  name: 'back_shadow',
  kind: 'actor',
  description: 'Background actor',
  tags: ['shadow'],
  size: [30, 30],
  draw(api) {
    // 20x20 square
    api.s.fillRect(5, 5, 20, 20, api.C.SLATE_IRON, 1);
  },
};

const frontPipe = {
  name: 'front_pipe',
  kind: 'foreground',
  description: 'Foreground barrier',
  tags: ['pipe'],
  size: [40, 10],
  draw(api) {
    api.s.fillRect(0, 0, 40, 10, api.C.CRIMSON_BRICK, 1);
  },
};

const componentRegistry = {
  bg_space: bgComponent,
  lead_star: leadActor,
  back_shadow: backActor,
  front_pipe: frontPipe,
};

test('storyboard validator accepts valid free scenes and rejects invalid configurations', () => {
  const p = { title: 'Free Scene Demo', stations: [] };

  const validShots = [
    {
      id: 'S01',
      chapter: 'Intro',
      dur: 4,
      sub: 'A star shines',
      read: 'Viewer sees star',
      background: { use: 'bg_space' },
      actors: [
        { id: 'star1', use: 'lead_star', x: 200, y: 150 },
      ],
      cam: { follow: 'star1', zoom: 2 },
    },
  ];

  // Passes validator
  const errs = validateStoryboard(p, validShots, componentRegistry);
  assert.deepEqual(errs, []);

  // Rejects actor without id
  const badShots = [
    {
      id: 'S02',
      chapter: 'Bad',
      dur: 2,
      sub: 'Missing actor id',
      read: 'None',
      actors: [{ use: 'lead_star', x: 100, y: 100 }],
    },
  ];
  const badErrs = validateStoryboard(p, badShots, componentRegistry);
  assert.ok(badErrs.some((e) => e.includes('must have a unique "id"')));

  // Rejects unknown component
  const unknownShots = [
    {
      id: 'S03',
      chapter: 'Bad',
      dur: 2,
      sub: 'Unknown component',
      read: 'None',
      background: { use: 'non_existent_bg' },
      actors: [{ id: 'a1', use: 'lead_star', x: 100, y: 100 }],
    },
  ];
  const unknownErrs = validateStoryboard(p, unknownShots, componentRegistry);
  assert.ok(unknownErrs.some((e) => e.includes('unknown component "non_existent_bg"')));
});

test('renderFreeWorld sorts actors by Y coordinate and applies foreground overlay', () => {
  const target = new PixelSurface(480, 240);
  target.clear(C.HONEY_PINE, 0);

  const shot = {
    id: 'S01',
    chapter: 'Layering',
    dur: 2,
    sub: 'Depth test',
    read: 'Layering',
    background: { use: 'bg_space' },
    actors: [
      // Y=150: lead_star (AMBER_GOLD) at (200, 150)
      { id: 'star_front', use: 'lead_star', x: 200, y: 150 },
      // Y=100: back_shadow (SLATE_IRON) at (200, 100) -> placed behind
      { id: 'star_back', use: 'back_shadow', x: 200, y: 100 },
    ],
    foreground: [
      // Foregound pipe at (200, 150), should overlay lead_star
      { use: 'front_pipe', x: 200, y: 150 },
    ],
  };

  renderFreeWorld(target, shot, componentRegistry, 1.0, 0.5);

  // Background should be INDIGO_NIGHT at (10, 10)
  assert.equal(target.colorBuf[10 * 480 + 10], C.INDIGO_NIGHT);

  // Foregound pipe (CRIMSON_BRICK) should cover (200, 150) foot area
  // Pipe is 40x10, foot anchor (20, 10) at (200, 150) -> x from 180 to 220, y from 140 to 150
  assert.equal(target.colorBuf[145 * 480 + 200], C.CRIMSON_BRICK);
});

test('resolveCamera correctly follows actor id in free scene', () => {
  const shot = {
    id: 'S01',
    chapter: 'Cam',
    dur: 2,
    sub: 'Follow test',
    read: 'Follow',
    actors: [{ id: 'hero', use: 'lead_star', x: 300, y: 120 }],
    cam: { follow: 'hero', zoom: 2 },
  };

  const cam = resolveCamera(shot, 1.0, 0.5);
  assert.equal(cam.zoom, 2);
  // Viewport center should align to actor hero's position (300, 120)
  // For zoom 2 (viewport 240x120), x0 = 300 - 120 = 180, y0 = 120 - 60 = 60
  assert.equal(cam.x0, 180);
  assert.equal(cam.y0, 60);
});

test('lintStoryboard warns when adjacent free shots share identical background and actors', () => {
  const p = { title: 'Test', stations: [] };
  const duplicateShots = [
    {
      id: 'S01',
      chapter: 'C1',
      dur: 2,
      sub: 'Shot 1',
      read: 'R1',
      background: { use: 'bg_space' },
      actors: [{ id: 'a1', use: 'lead_star', x: 100, y: 100 }],
    },
    {
      id: 'S02',
      chapter: 'C1',
      dur: 2,
      sub: 'Shot 2',
      read: 'R2',
      background: { use: 'bg_space' },
      actors: [{ id: 'a1', use: 'lead_star', x: 100, y: 100 }],
    },
  ];

  const warns = lintStoryboard(p, duplicateShots);
  assert.ok(warns.some((w) => w.includes('identical background and actors')));
});
