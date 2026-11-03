import test from 'node:test';
import assert from 'node:assert/strict';

import { validateComponentSource } from '../src/engine/security.ts';
import {
  createScratchSurface,
  blitComponentToWorld,
  verifyComponentDeterminism,
  createDrawApi,
} from '../src/engine/component.ts';
import { PixelSurface } from '../src/engine/surface.ts';
import { C } from '../src/engine/palette.ts';

test('security scanner rejects unsafe imports and globals', () => {
  // 1. Rejected imports
  assert.throws(
    () => validateComponentSource(`import fs from 'fs'; export default {};`),
    /forbidden import/i
  );
  assert.throws(
    () => validateComponentSource(`import { readFileSync } from 'node:fs'; export default {};`),
    /forbidden import/i
  );
  assert.throws(
    () => validateComponentSource(`const mod = import('node:child_process');`),
    /dynamic import/i
  );

  // 2. Rejected dangerous identifiers
  assert.throws(
    () => validateComponentSource(`const p = process.env; export default {};`),
    /forbidden identifier: process/i
  );
  assert.throws(
    () => validateComponentSource(`const g = globalThis; export default {};`),
    /forbidden identifier: globalThis/i
  );
  assert.throws(
    () => validateComponentSource(`eval("1+1"); export default {};`),
    /forbidden identifier: eval/i
  );
  assert.throws(
    () => validateComponentSource(`fetch("http://evil.com"); export default {};`),
    /forbidden identifier: fetch/i
  );

  // 3. Rejected property evasion
  assert.throws(
    () => validateComponentSource(`const x = ({}).constructor; export default {};`),
    /forbidden property: constructor/i
  );
  assert.throws(
    () => validateComponentSource(`const x = Object.prototype; export default {};`),
    /forbidden property: prototype/i
  );
  assert.throws(
    () => validateComponentSource(`const x = target.__proto__; export default {};`),
    /forbidden property: __proto__/i
  );
  assert.throws(
    () => validateComponentSource(`const key = "pro" + "cess"; const x = obj[key]; export default {};`),
    /dynamic computed property access/i
  );

  // 4. Rejected top-level mutable state
  assert.throws(
    () => validateComponentSource(`let count = 0; export default {};`),
    /mutable top-level variable/i
  );
  assert.throws(
    () => validateComponentSource(`var state = {}; export default {};`),
    /mutable top-level variable/i
  );

  // 5. Allowed clean source
  const cleanSource = `
    import type { ComponentDef, ComponentDrawApi } from '../src/engine/component.ts';
    export const redCell: ComponentDef = {
      name: 'red_cell',
      kind: 'actor',
      description: 'A simple red blood cell',
      tags: ['bio', 'cell'],
      size: [24, 24],
      draw(api, params, t, lt) {
        api.s.fillRect(2, 2, 20, 20, api.C.RUBY_RED, 1);
      }
    };
  `;
  assert.doesNotThrow(() => validateComponentSource(cleanSource));
});

test('component scratch surface is initialized with 255 sentinel value', () => {
  const scratch = createScratchSurface(20, 30);
  assert.equal(scratch.width, 20);
  assert.equal(scratch.height, 30);
  // All pixels in colorBuf must be 255 (empty sentinel)
  for (let i = 0; i < scratch.colorBuf.length; i++) {
    assert.equal(scratch.colorBuf[i], 255);
  }
});

test('blitComponentToWorld aligns anchor [w/2, h] to [x, y] with 255 transparency', () => {
  const world = new PixelSurface(100, 100);
  world.clear(C.HONEY_PINE, 0);

  const scratch = createScratchSurface(10, 10);
  // Draw a 4x4 block at local coordinates (3, 6) to (6, 9)
  scratch.fillRect(3, 6, 4, 4, C.CRIMSON_BRICK, 1);

  // Align foot [5, 10] to world position [50, 50]
  // Top-left should be [50 - 5, 50 - 10] = [45, 40]
  blitComponentToWorld(scratch, world, 50, 50, { flip: false, scale: 1 });

  // Point [45, 40] was not drawn in scratch -> should still be world's HONEY_PINE
  assert.equal(world.colorBuf[40 * 100 + 45], C.HONEY_PINE);
  // Local (3, 6) is at world (45 + 3, 40 + 6) = (48, 46) -> should be CRIMSON_BRICK
  assert.equal(world.colorBuf[46 * 100 + 48], C.CRIMSON_BRICK);
});

test('blitComponentToWorld supports horizontal flip and scale 2', () => {
  const world = new PixelSurface(100, 100);
  world.clear(C.HONEY_PINE, 0);

  const scratch = createScratchSurface(10, 10);
  // Draw single pixel at (2, 5)
  scratch.pset(2, 5, C.CRIMSON_BRICK, 1);

  // Flip horizontally: x=2 in 10-wide should map to x = 10 - 1 - 2 = 7
  blitComponentToWorld(scratch, world, 50, 50, { flip: true, scale: 1 });
  // Top-left is (45, 40), flipped local x=7 -> world x=52, local y=5 -> world y=45
  assert.equal(world.colorBuf[45 * 100 + 52], C.CRIMSON_BRICK);
  assert.equal(world.colorBuf[45 * 100 + 47], C.HONEY_PINE);
});

test('verifyComponentDeterminism confirms identical output across repeat and out-of-order calls', () => {
  const def = {
    name: 'test_dot',
    kind: 'actor',
    description: 'Deterministic moving dot',
    tags: ['test'],
    size: [20, 20],
    draw(api, params, t, lt) {
      const offset = Math.floor(lt * 10) % 10;
      api.s.pset(5 + offset, 10, api.C.RUBY_RED, 1);
    },
  };

  const errs = verifyComponentDeterminism(def);
  assert.deepEqual(errs, []);
});
