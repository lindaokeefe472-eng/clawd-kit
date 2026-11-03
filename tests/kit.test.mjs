import test from 'node:test';
import assert from 'node:assert/strict';

import { validateKit, drawKitStation, KIT_BODIES, KIT_MATERIALS, KIT_PARTS, KIT_ICONS, KIT_ANIMS } from '../src/engine/kit.ts';
import { PixelSurface } from '../src/engine/surface.ts';
import { validateProject } from '../src/engine/storyboard.ts';

const heart = { body: 'blob', material: 'flesh', tint: 'purple', size: 'l', parts: [{ type: 'chamber', count: 2 }, { type: 'pipe', at: 'top' }, { type: 'valve', at: 'right' }], icon: 'heart', anim: ['pulse', 'flow'] };

test('vocabulary matches the agreed parts list', () => {
  assert.equal(KIT_BODIES.length, 10);
  assert.equal(KIT_MATERIALS.length, 10);
  assert.ok(KIT_PARTS.length >= 27);
  assert.equal(KIT_ICONS.length, 24);
  assert.equal(KIT_ANIMS.length, 10);
});

test('a valid kit passes; bad values are named', () => {
  assert.deepEqual(validateKit(heart, 'st0'), []);
  const errs = validateKit({ body: 'cube', material: 'gold', parts: Array.from({ length: 7 }, () => ({ type: 'gear' })).concat([{ type: 'laser' }]), icon: 'cat', anim: ['dance'] }, 'st1').join('\n');
  for (const word of ['cube', 'gold', 'at most 6', 'laser', 'cat', 'dance']) assert.match(errs, new RegExp(word));
});

test('stations take exactly one of type or kit', () => {
  assert.deepEqual(validateProject({ title: 't', stations: [{ label: '右心', kit: heart }] }), []);
  assert.match(validateProject({ title: 't', stations: [{ label: 'x' }] }).join(''), /type or kit/);
  assert.match(validateProject({ title: 't', stations: [{ label: 'x', type: 'bench', kit: heart }] }).join(''), /type or kit/);
});

test('every body x material renders inside its footprint and is deterministic', () => {
  for (const body of KIT_BODIES) {
    for (const material of KIT_MATERIALS) {
      const a = new PixelSurface(120, 140);
      const b = new PixelSurface(120, 140);
      const kit = { body, material, size: 'l', parts: [{ type: 'window' }], icon: 'gear', anim: ['glow'] };
      const ba = drawKitStation(a, kit, 60, 120, { build: 1, active: true, tint: 'blue', power: 1, tod: 0.4 }, 1.3);
      drawKitStation(b, kit, 60, 120, { build: 1, active: true, tint: 'blue', power: 1, tod: 0.4 }, 1.3);
      assert.deepEqual(a.colorBuf, b.colorBuf, `${body}/${material} not deterministic`);
      assert.ok(ba.w <= 68 + 24 && ba.y >= 120 - 110, `${body}/${material} too big: ${JSON.stringify(ba)}`);
      assert.ok(a.colorBuf.some((c) => c !== 0), `${body}/${material} drew nothing`);
    }
  }
});

test('every part and icon draws without throwing', () => {
  const s = new PixelSurface(120, 140);
  for (const type of KIT_PARTS) drawKitStation(s, { body: 'box', material: 'metal', parts: [{ type }], anim: ['spin', 'flow', 'blink'] }, 60, 120, { build: 1, active: true, tint: 'red', power: 1, tod: 0.5 }, 2);
  for (const icon of KIT_ICONS) drawKitStation(s, { body: 'orb', material: 'plastic', icon }, 60, 120, { build: 1, active: false, tint: 'gold', power: 0, tod: 0.5 }, 2);
});
