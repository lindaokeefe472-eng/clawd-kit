import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';

import { setCanvasFactory } from '../src/styles/clawd/paint.ts';
import { ClawdAdapter, CLAWD_INFO } from '../src/styles/clawd/adapter.ts';
import { createClawdApi } from '../src/styles/clawd/api.ts';
import { boilSeed } from '../src/styles/clawd/core.ts';
import { PixelAdapter, PIXEL_INFO } from '../src/styles/pixel/adapter.ts';
import { FreeFilm } from '../src/core/film.ts';
import { validateFreeStoryboard } from '../src/core/validate.ts';
import { gateComponent } from '../src/core/gates.ts';
import { loadRegistry } from '../src/core/registry-node.ts';

setCanvasFactory((w, h) => createCanvas(w, h));
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

// ---------- the same storyboard shape, written in each style's world units ----------
function storyboard(info, trans) {
  const { w: W, h: H } = info.world;
  const zMax = info.camera.zoom === 'integer' ? 2 : 1.4;
  return [
    { id: 'S01', chapter: '出发', dur: 3, sub: '一颗红细胞从心脏出发', read: '主角登场', tin: trans[0],
      background: { use: 'vessel' },
      actors: [{ id: 'rbc', use: 'rbc', x: [[0, W * 0.2], [3, W * 0.45]], y: H * 0.7, params: { squeeze: [[1, 0], [2, 1]] } }],
      presenter: { x: [[0, W * 0.9], [1.5, W * 0.75]], y: H * 0.78, emotion: [[0, 'calm'], [1.6, 'surprised']] },
      labels: [{ text: '红细胞', x: W * 0.3, y: H * 0.55, at: 0.5 }] },
    { id: 'S02', chapter: '毛细血管', dur: 3, sub: '通道窄到只能挤着过', read: '没有主讲人，只看红细胞', tin: trans[1],
      background: { use: 'vessel', params: { narrow: true } },
      actors: [{ id: 'rbc', use: 'rbc', x: [W * 0.2, W * 0.8], y: H * 0.6, params: { squeeze: 1 } }],
      cam: { follow: 'rbc', z: zMax } },
    { id: 'S03', chapter: '回家', dur: 3, sub: '交完氧气，它慢慢回到心脏', read: '主讲人点题', tout: trans[0],
      background: { use: 'vessel' },
      actors: [{ id: 'rbc', use: 'rbc', x: W * 0.35, y: H * 0.7, flip: true }],
      presenter: { x: W * 0.6, y: H * 0.78, emotion: 'happy', action: [[0, 'none'], [1, 'jump']] } },
  ];
}

const clawdDefs = {
  vessel: { name: 'vessel', style: 'clawd', kind: 'background', description: 'blood vessel wall', tags: ['bio'], size: [1920, 1080],
    params: { narrow: { type: 'boolean', default: false, description: 'narrow capillary' } },
    draw(api, p, t) {
      api.washRect(api.ctx, -100, -100, 2120, 1300, [[0, '#F3C9B8'], [1, '#E9A08E']]);
      const gap = p.narrow ? 220 : 420;
      api.subSeed('top'); api.wcolor(api.ctx, [[-50, 0], [1970, 0], [1970, 540 - gap], [-50, 540 - gap + api.wob(t, 0.3) * 10]], '#C2614E', 0.8, 3, 10);
      api.subSeed('bot'); api.wcolor(api.ctx, [[-50, 540 + gap], [1970, 540 + gap], [1970, 1130], [-50, 1130]], '#C2614E', 0.8, 3, 10);
    } },
  rbc: { name: 'rbc', style: 'clawd', kind: 'actor', description: 'red blood cell', tags: ['bio'], size: [180, 140],
    params: { squeeze: { type: 'number', default: 0, min: 0, max: 1, description: 'squash 0..1' } },
    draw(api, p, t) {
      const sx = 1 - 0.35 * p.squeeze, sy = 1 + 0.25 * p.squeeze;
      api.paint(api.ctx, api.ellPts(0, -60 * sy, 80 * sx, 55 * sy, 22, 3), { wash: api.PAL.clay, sw: 5 });
      api.subSeed('dimple'); api.blob(api.ctx, 0, -60 * sy, 30 * sx, 18 * sy, api.PAL.clayDk, 0.5);
      void t;
    } },
};

const pixelDefs = {
  vessel: { name: 'vessel', style: 'pixel', kind: 'background', description: 'blood vessel wall', tags: ['bio'], size: [480, 240],
    params: { narrow: { type: 'boolean', default: false, description: 'narrow capillary' } },
    draw(api, p) {
      api.s.fillRect(0, 0, 480, 240, api.C.CRIMSON_BRICK, 0);
      const gap = p.narrow ? 50 : 100;
      api.s.fillRect(0, 120 - gap, 480, gap * 2, api.C.WARM_PARCHMENT, 0);
    } },
  rbc: { name: 'rbc', style: 'pixel', kind: 'actor', description: 'red blood cell', tags: ['bio'], size: [24, 20],
    params: { squeeze: { type: 'number', default: 0, min: 0, max: 1, description: 'squash 0..1' } },
    draw(api, p) { const w = Math.round(20 - 6 * p.squeeze); api.s.fillRect(12 - w / 2, 4, w, 14, api.C.RUBY_RED, 1); } },
};

const regOf = (defs) => new Map(Object.values(defs).map((d) => [d.name, d]));

function clawdFilm() {
  const canvas = createCanvas(1920, 1080);
  const ctx = canvas.getContext('2d');
  const film = new FreeFilm({ title: 'rbc', style: 'clawd' }, storyboard(CLAWD_INFO, ['brush', 'iris']), regOf(clawdDefs), new ClawdAdapter(ctx));
  const frame = (t) => { const info = film.renderFrame(t); return { info, hash: sha(ctx.getImageData(0, 0, 1920, 1080).data) }; };
  return { film, frame, canvas };
}

test('the free storyboard validates in both styles', () => {
  assert.deepEqual(validateFreeStoryboard({ title: 'rbc', style: 'clawd' }, storyboard(CLAWD_INFO, ['brush', 'iris']), regOf(clawdDefs), CLAWD_INFO), []);
  assert.deepEqual(validateFreeStoryboard({ title: 'rbc', style: 'pixel' }, storyboard(PIXEL_INFO, ['checker', 'iris']), regOf(pixelDefs), PIXEL_INFO), []);
});

test('clawd free scene: frames are a pure function of t (repeat + out of order)', () => {
  const { frame } = clawdFilm();
  const times = [0.4, 1.2, 2.8, 3.1, 4.5, 7.9, 8.8];
  const fwd = times.map((t) => frame(t).hash);
  const rev = [...times].reverse().map((t) => frame(t).hash).reverse();
  assert.deepEqual(rev, fwd);
  assert.equal(new Set(fwd).size, times.length);
});

test('clawd free scene: presenter only where the storyboard has one; transitions reported', () => {
  const { frame, canvas } = clawdFilm();
  const a = frame(1.2).info;
  assert.equal(a.shot.id, 'S01');
  assert.ok(a.focus.some((f) => f.label === 'presenter'));
  assert.ok(a.focus.some((f) => f.label === 'label:红细胞'));
  const b = frame(4.5).info;
  assert.equal(b.shot.id, 'S02');
  assert.ok(!b.focus.some((f) => f.label === 'presenter'));
  assert.deepEqual(b.cropped, []);
  assert.equal(frame(3.05).info.transition, 'iris');
  assert.equal(frame(0.3).info.transition, 'brush');
  assert.equal(frame(8.9).info.transition, 'brush');
  const out = process.env.FREE_SCENE_PNG;
  if (out) {
    for (const t of [1.6, 3.05, 4.5, 7.2]) { frame(t); fs.writeFileSync(path.join(out, `clawd_${t}.png`), canvas.toBuffer('image/png')); }
  }
});

test('pixel free scene: the same storyboard shape renders deterministically', () => {
  const adapter = new PixelAdapter();
  const film = new FreeFilm({ title: 'rbc', style: 'pixel' }, storyboard(PIXEL_INFO, ['checker', 'iris']), regOf(pixelDefs), adapter);
  const frame = (t) => { const info = film.renderFrame(t); return { info, hash: sha(Buffer.from(adapter.pixels.buffer)), texts: adapter.texts.map((x) => x.text) }; };
  const a = frame(1.2);
  assert.equal(a.hash, frame(1.2).hash);
  frame(7.5);
  assert.equal(a.hash, frame(1.2).hash);
  assert.ok(a.texts.includes('一颗红细胞从心脏出发'));
  assert.ok(a.info.focus.some((f) => f.label === 'presenter'));
  assert.notEqual(frame(4.5).hash, a.hash);
  assert.ok(!frame(4.5).info.focus.some((f) => f.label === 'presenter'));
});

// ---------- component gate (clawd) ----------
function clawdRenderBytes(def, params, t, lt) {
  const c = createCanvas(def.size[0], def.size[1]);
  const ctx = c.getContext('2d');
  ctx.translate(def.size[0] / 2, def.size[1]);
  const key = `${def.name}#gate`;
  boilSeed(key);
  def.draw(createClawdApi(ctx, key), params, t, lt);
  return ctx.getImageData(0, 0, def.size[0], def.size[1]).data;
}

test('clawd component gate: passes a pure component, catches hidden state and blank output', () => {
  const src = 'export const rbc = {};';
  const world = CLAWD_INFO.world;
  assert.deepEqual(gateComponent(src, 'rbc.ts', clawdDefs.rbc, 'clawd', world, clawdRenderBytes), { ok: true, errors: [] });
  const memo = { n: 0 };
  const leaky = { ...clawdDefs.rbc, name: 'leaky', draw(api) { memo.n++; api.blob(api.ctx, 0, -40, 20 + memo.n * 5, 20, api.PAL.ink, 1); } };
  const r1 = gateComponent(src, 'leaky.ts', leaky, 'clawd', world, clawdRenderBytes);
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.some((e) => e.includes('repeated render')), r1.errors.join('\n'));
  const blank = { ...clawdDefs.rbc, name: 'blank', draw() {} };
  assert.ok(gateComponent(src, 'blank.ts', blank, 'clawd', world, clawdRenderBytes).errors.some((e) => e.includes('draws nothing')));
  const rnd = gateComponent('const x = Math.random();', 'r.ts', clawdDefs.rbc, 'clawd', world, clawdRenderBytes);
  assert.ok(!rnd.ok && /Math\.random/.test(rnd.errors[0]));
});

test('node registry scans files before importing them', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawd-reg-'));
  fs.writeFileSync(path.join(dir, 'leaf.ts'), `
export const leaf = { name: 'leaf', style: 'clawd', kind: 'prop', description: 'lotus leaf', tags: ['pond'], size: [60, 30], draw() {} };
`);
  // would throw a non-security error if it were ever imported
  fs.writeFileSync(path.join(dir, 'evil.ts'), `throw new Error('imported!'); const p = process.env;`);
  const { registry, errors } = await loadRegistry('clawd', CLAWD_INFO.world, [{ dir, origin: 'project' }]);
  assert.ok(registry.has('leaf'));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Security violation: forbidden identifier: process/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('clawd iris outro keeps the scene inside the closing circle and paper outside', () => {
  const canvas = createCanvas(1920, 1080);
  const ctx = canvas.getContext('2d');
  const film = new FreeFilm({ title: 'rbc', style: 'clawd' }, storyboard(CLAWD_INFO, ['iris', 'brush']), regOf(clawdDefs), new ClawdAdapter(ctx));
  const info = film.renderFrame(film.duration - 0.9);
  assert.equal(info.transition, 'iris');
  const px = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3));
  const p = info.focus.find((f) => f.label === 'presenter');
  const inside = px(Math.round(p.x + p.w / 2), Math.round(p.y + p.h * 0.8));
  const corner = px(20, 20);
  // background vessel wash is pink (r ≫ b); paper is near-neutral cream
  assert.ok(corner[0] - corner[2] < 40, `corner should be paper, got ${corner}`);
  assert.ok(inside[0] - inside[2] > 25 || inside[1] - inside[2] > 25, `centre should still show the scene, got ${inside}`);
});

test('crop check: partly visible actors are cut, fully off-screen ones are not', () => {
  const canvas = createCanvas(1920, 1080);
  const shots = [{ id: 'S', chapter: 'c', dur: 3, sub: '一句话', read: 'r', background: { use: 'vessel' },
    actors: [{ id: 'edge', use: 'rbc', x: 1900, y: 600 }, { id: 'gone', use: 'rbc', x: 960, y: -400 }] }];
  const film = new FreeFilm({ title: 't', style: 'clawd' }, shots, regOf(clawdDefs), new ClawdAdapter(canvas.getContext('2d')));
  assert.deepEqual(film.renderFrame(1.5).cropped, ['edge']);
});
