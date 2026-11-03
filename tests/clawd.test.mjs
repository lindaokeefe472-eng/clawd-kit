import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';

import { setCanvasFactory } from '../src/styles/clawd/paint.ts';
import { film, FW, FH, SHOTS } from '../src/styles/clawd/film.ts';
import { emotionSheet, EMO_W, EMO_H } from '../src/styles/clawd/sheets.ts';
import { CHARS } from '../src/styles/clawd/critters.ts';

setCanvasFactory((w, h) => createCanvas(w, h));

const DIR = path.resolve('src/styles/clawd');

function frameHash(t) {
  const c = createCanvas(FW, FH);
  const ctx = c.getContext('2d');
  film(ctx, t);
  return createHash('sha256').update(ctx.getImageData(0, 0, FW, FH).data).digest('hex');
}

test('clawd sources use no Math.random and no any', () => {
  for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    assert.ok(!/Math\.random/.test(src), `${f} uses Math.random`);
    assert.ok(!/\bas any\b|:\s*any\b|<any>/.test(src), `${f} uses any`);
  }
});

test('film frames are a pure function of t (repeat and out-of-order)', () => {
  const times = [1.3, 9.7, 17.2, 25.4];
  const forward = times.map(frameHash);
  const again = [...times].reverse().map(frameHash).reverse();
  assert.deepEqual(again, forward);
  assert.equal(new Set(forward).size, times.length, 'different times should differ');
});

test('paper and grain are identical across fresh canvas factories (render workers)', () => {
  const a = frameHash(3.3);
  setCanvasFactory((w, h) => createCanvas(w, h)); // clears caches like a new worker would
  const b = frameHash(3.3);
  assert.equal(a, b);
});

test('every shot boundary and transition renders', () => {
  for (const s of SHOTS) for (const t of [s.t0, s.t0 + 0.3, s.t1 - 0.3]) frameHash(t);
});

test('emotion sheet renders for every character', () => {
  for (const c of CHARS) {
    const cv = createCanvas(EMO_W, EMO_H);
    emotionSheet(cv.getContext('2d'), 1.2, c);
  }
});
