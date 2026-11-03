import test from 'node:test';
import assert from 'node:assert/strict';

import { validateComponentSource } from '../src/core/security.ts';
import { resolveParams, paramProblems, paramDefProblems } from '../src/core/params.ts';
import { buildRegistry } from '../src/core/registry.ts';
import { resolveFreeShot } from '../src/core/scene.ts';
import { validateFreeStoryboard, lintFreeStoryboard } from '../src/core/validate.ts';
import { FreeFilm, INTRO_S, TRANS_PRE } from '../src/core/film.ts';
import { CLAWD_INFO } from '../src/styles/clawd/adapter.ts';
import { PIXEL_INFO } from '../src/styles/pixel/adapter.ts';

const W = CLAWD_INFO.world;
const def = (name, kind, extra = {}) => ({
  name, style: 'clawd', kind, description: `${name} test`, tags: ['test'],
  size: kind === 'background' ? [W.w, W.h] : [100, 80], draw() {}, ...extra,
});
const reg = (...defs) => new Map(defs.map((d) => [d.name, d]));

// ---------- security ----------
test('clawd scan: only type imports, no Math.random, no engine seeding', () => {
  const ok = `
    import type { ComponentDef } from '../../src/core/types.ts';
    import type { ClawdApi } from '../../src/styles/clawd/api.ts';
    export const leaf: ComponentDef<ClawdApi> = { name: 'leaf', style: 'clawd', kind: 'prop', description: 'd', tags: [], size: [10, 10],
      draw(api) { api.subSeed('vein'); api.blob(api.ctx, 0, -5, 4, 4, api.PAL.sap, 0.5); const x = api.jit(2); void x; } };`;
  assert.doesNotThrow(() => validateComponentSource(ok, 'leaf.ts', { style: 'clawd' }));
  const bad = {
    valueImport: `import { blob } from '../../src/styles/clawd/paint.ts';`,
    namedValue: `import { type Pt, paint } from '../../src/styles/clawd/paint.ts';`,
    sideEffect: `import '../../src/styles/clawd/core.ts';`,
    mathRandom: `const r = Math.random();`,
    reseed: `function f(api) { randomSeed(4); }`,
    boil: `function f(api) { api.setBoil(3); }`,
    boilSeed: `function f(api) { api.boilSeed('x'); }`,
    meta: `const u = import.meta.url;`,
    doc: `const d = document.body;`,
    req: `const m = require('fs');`,
  };
  for (const [k, src] of Object.entries(bad)) {
    assert.throws(() => validateComponentSource(src, `${k}.ts`, { style: 'clawd' }), /Security violation/, k);
  }
});

test('pixel scan keeps engine value imports but now also rejects Math.random', () => {
  assert.doesNotThrow(() => validateComponentSource(`import { C } from '../../src/engine/palette.ts'; export const x = C;`, 'a.ts', { style: 'pixel' }));
  assert.throws(() => validateComponentSource(`const r = Math.random();`, 'a.ts'), /Math\.random/);
});

// ---------- params ----------
test('params: defaults, numeric Tracks ease, Steps switch', () => {
  const d = def('cell', 'actor', { params: {
    squeeze: { type: 'number', default: 0, min: 0, max: 1, description: 'squash' },
    mood: { type: 'enum', default: 'calm', options: ['calm', 'panic'], description: 'mood' },
    lit: { type: 'boolean', default: false, description: 'glow' },
  } });
  assert.deepEqual(resolveParams(d, undefined, 1, 4), { squeeze: 0, mood: 'calm', lit: false });
  const raw = { squeeze: [[1, 0], [2, 1]], mood: [[0, 'calm'], [1.5, 'panic']], lit: true };
  assert.deepEqual(resolveParams(d, raw, 0.5, 4), { squeeze: 0, mood: 'calm', lit: true });
  assert.deepEqual(resolveParams(d, raw, 3, 4), { squeeze: 1, mood: 'panic', lit: true });
  assert.equal(resolveParams(d, { squeeze: [0, 1] }, 2, 4).squeeze, 0.5);
  assert.deepEqual(paramProblems(d, raw), []);
  const probs = paramProblems(d, { squeeze: [[0, 0], [1, 3]], mood: 'angry', size: 2, lit: 'yes' });
  assert.equal(probs.length, 4, probs.join('\n'));
  assert.ok(probs.some((p) => p.includes('3 > max 1')));
  assert.ok(probs.some((p) => p.includes('not declared')));
  assert.deepEqual(paramDefProblems(def('x', 'prop', { params: { k: { type: 'enum', default: 'z', options: ['a'], description: 'k' } } })).length, 1);
});

// ---------- registry ----------
test('registry: project overrides library, duplicates and bad defs are reported, other styles ignored', () => {
  const libLeaf = def('leaf', 'prop');
  const projLeaf = def('leaf', 'prop', { description: 'project leaf' });
  const { registry, errors } = buildRegistry('clawd', W, [
    { file: 'proj/leaf.ts', origin: 'project', exports: { default: projLeaf } },
    { file: 'lib/leaf.ts', origin: 'library', exports: { leaf: libLeaf, default: libLeaf } },
    { file: 'lib/leaf2.ts', origin: 'library', exports: { other: def('leaf', 'prop') } },
    { file: 'lib/bg.ts', origin: 'library', exports: { bg: def('bg_bad', 'background', { size: [480, 240] }) } },
    { file: 'lib/px.ts', origin: 'library', exports: { p: { ...def('px_thing', 'prop'), style: 'pixel' } } },
    { file: 'lib/Bad.ts', origin: 'library', exports: { b: def('BadName', 'prop') } },
  ]);
  assert.equal(registry.get('leaf').description, 'project leaf');
  assert.ok(!registry.has('px_thing'));
  assert.ok(errors.some((e) => e.includes('duplicate component "leaf"')), errors.join('\n'));
  assert.ok(errors.some((e) => e.includes('background size must be [1920, 1080]')));
  assert.ok(errors.some((e) => e.includes('snake_case')));
});

// ---------- scene ----------
const R = reg(def('meadow', 'background'), def('cell', 'actor'), def('rock', 'prop'), def('fg_reeds', 'foreground'));

test('scene: y-sorted actors and presenter, front layer last, follow camera clamped to world', () => {
  const shot = {
    id: 'S1', chapter: 'c', dur: 4, sub: 's', read: 'r',
    background: { use: 'meadow' },
    actors: [
      { id: 'near', use: 'rock', x: 900, y: 1000 },
      { id: 'far', use: 'cell', x: 300, y: 600 },
      { id: 'top', use: 'cell', x: 400, y: 100, layer: 'front' },
    ],
    foreground: [{ use: 'fg_reeds', x: 960, y: 1080 }],
    presenter: { x: [[0, 200], [2, 800]], emotion: [[0, 'calm'], [1, 'idea']] },
    cam: { follow: 'far', z: 1.5 },
  };
  const sc = resolveFreeShot({ title: 't' }, shot, 1, R, CLAWD_INFO);
  assert.equal(sc.background.def.name, 'meadow');
  const order = sc.items.map((i) => (i.type === 'presenter' ? 'presenter' : i.inst.id));
  assert.deepEqual(order, ['far', 'presenter', 'near', 'top', 'fg0']);
  // view is 1280×720 at z 1.5 → centre clamped to x ≥ 640, y ≥ 360
  assert.deepEqual(sc.cam, { cx: 640, cy: 560, z: 1.5 });
  const p = sc.items.find((i) => i.type === 'presenter').spec;
  assert.equal(p.char, 'bean');
  assert.equal(p.moving, true);
  assert.equal(p.action, 'walk');
  assert.equal(p.flip, false);
  assert.ok(p.walked > 100 && p.walked < 600, `walked ${p.walked}`);
  const still = resolveFreeShot({ title: 't' }, shot, 3, R, CLAWD_INFO).items.find((i) => i.type === 'presenter').spec;
  assert.equal(still.moving, false);
  assert.equal(still.action, 'none');
});

test('scene: shots may have no presenter; pixel camera snaps to integer zoom', () => {
  const pr = reg({ ...def('dot', 'actor'), style: 'pixel', size: [10, 10] });
  const shot = { id: 'S', chapter: 'c', dur: 3, sub: 's', read: 'r', actors: [{ id: 'd', use: 'dot', x: 100, y: 100 }], cam: { follow: 'd', z: 2 } };
  const sc = resolveFreeShot({ title: 't' }, shot, 1, pr, PIXEL_INFO);
  assert.ok(sc.items.every((i) => i.type !== 'presenter'));
  assert.deepEqual(sc.cam, { cx: 120, cy: 95, z: 2 });
});

// ---------- validate ----------
const good = () => ([
  { id: 'S1', chapter: '序', dur: 4, sub: '红细胞出发了', read: '看到主角', tin: 'brush',
    background: { use: 'meadow' }, actors: [{ id: 'rbc', use: 'cell', x: 400, y: 800 }],
    presenter: { x: 1500, emotion: [[0, 'calm'], [2, 'idea']], action: [[0, 'none'], [1, 'jump']] }, cam: { follow: 'presenter', z: [1, 1.3] } },
  { id: 'S2', chapter: '序', dur: 4, sub: '它挤进窄窄的通道', read: '没有主讲人', tin: 'iris',
    background: { use: 'meadow' }, actors: [{ id: 'rbc', use: 'cell', x: [200, 1600], y: 700 }], cam: { follow: 'rbc', z: 1.4 } },
]);

test('validator accepts a good clawd storyboard (presenter optional)', () => {
  assert.deepEqual(validateFreeStoryboard({ title: 't', style: 'clawd' }, good(), R, CLAWD_INFO), []);
});

test('validator reports style-specific mistakes', () => {
  const s = good();
  s[0].tin = 'checker';
  s[0].background = { use: 'cell' };
  s[0].presenter.emotion = [[0, 'humming']];
  s[0].presenter.hat = 'sombrero';
  s[0].cam = { follow: 'ghost', z: 2 };
  s[1].actors.push({ id: 'rbc', use: 'nope', x: 99999, y: 10 });
  s[1].presenter = null;
  s[1].cam = { follow: 'presenter' };
  s[1].panels = [{ type: 'note', text: 'x' }];
  const errs = validateFreeStoryboard({ title: 't', presenter: { char: 'dog' } }, s, R, CLAWD_INFO);
  const expect = ['presenter.char "dog"', 'tin "checker"', '"cell" is a actor, expected background', 'emotion "humming"', 'hat "sombrero"',
    'cam.z must be 1..1.6', 'cam.follow "ghost"', 'duplicate or reserved actor id "rbc"', 'unknown component "nope"', 'x outside world', 'cam.follow "presenter"', 'panels are not available'];
  for (const e of expect) assert.ok(errs.some((x) => x.includes(e)), `missing "${e}" in\n${errs.join('\n')}`);
});

test('validator: pixel needs integer zoom and its own transitions', () => {
  const pr = reg({ ...def('dot', 'actor'), style: 'pixel', size: [10, 10] });
  const shots = [{ id: 'S', chapter: 'c', dur: 3, sub: '一句话', read: 'r', tin: 'brush', actors: [{ id: 'd', use: 'dot', x: 100, y: 100, scale: 1.5 }], cam: { z: 1.4 } }];
  const errs = validateFreeStoryboard({ title: 't' }, shots, pr, PIXEL_INFO);
  for (const e of ['tin "brush"', 'cam.z must be an integer', 'scale must be 1 or 2']) assert.ok(errs.some((x) => x.includes(e)), `${e}\n${errs.join('\n')}`);
});

test('lint warns on repeated compositions and actors under the subtitle band', () => {
  const s = good();
  s[1] = { ...s[0], id: 'S2' };
  s[0].actors[0].y = 1060;
  const w = lintFreeStoryboard(s, R, CLAWD_INFO);
  assert.ok(w.some((x) => x.includes('share identical')), w.join('\n'));
  assert.ok(w.some((x) => x.includes('behind the subtitle band')), w.join('\n'));
});

// ---------- film timing ----------
test('film: intro, cut and outro transition windows', () => {
  const s = good();
  s[1].tout = 'iris';
  const nullAdapter = { info: CLAWD_INFO, screen: { w: 1920, h: 1080, viewH: 1080, subtitleTop: 948 } };
  const f = new FreeFilm({ title: 't' }, s, R, nullAdapter);
  assert.equal(f.duration, 8);
  assert.deepEqual(f.transitionAt(INTRO_S / 2) && { kind: f.transitionAt(INTRO_S / 2).kind, out: f.transitionAt(INTRO_S / 2).out }, { kind: 'brush', out: null });
  const cut = f.transitionAt(4 - TRANS_PRE + 0.01);
  assert.equal(cut.kind, 'iris');
  assert.equal(cut.out.id, 'S1');
  assert.equal(cut.inn.id, 'S2');
  assert.equal(f.transitionAt(2), null);
  assert.equal(f.transitionAt(7.9).inn, null);
});

test('scene: depth overrides the y sort key; presenter tint passes through and is validated', () => {
  const shot = {
    id: 'S', chapter: 'c', dur: 3, sub: '一句话', read: 'r',
    actors: [{ id: 'pad', use: 'rock', x: 900, y: 880, depth: 700 }],
    presenter: { x: 900, y: 805, tint: 'night' },
  };
  const sc = resolveFreeShot({ title: 't' }, shot, 1, R, CLAWD_INFO);
  assert.deepEqual(sc.items.map((i) => (i.type === 'presenter' ? 'presenter' : i.inst.id)), ['pad', 'presenter']);
  assert.equal(sc.items[1].spec.tint, 'night');
  assert.deepEqual(validateFreeStoryboard({ title: 't' }, [shot], R, CLAWD_INFO), []);
  const bad = validateFreeStoryboard({ title: 't' }, [{ ...shot, presenter: { x: 900, tint: 'purple' } }], R, CLAWD_INFO);
  assert.ok(bad.some((e) => e.includes('tint "purple"')), bad.join('\n'));
});

test('lint: same background with different params is not a repeated composition', () => {
  const s = good();
  s[1] = { ...s[0], id: 'S2', background: { use: 'meadow', params: { x: 1 } } };
  assert.ok(!lintFreeStoryboard(s, R, CLAWD_INFO).some((x) => x.includes('share identical')));
});

test('labels can follow an actor or the presenter; x/y become offsets', () => {
  const shot = {
    id: 'S', chapter: 'c', dur: 4, sub: '一句话', read: 'r',
    actors: [{ id: 'cell', use: 'cell', x: { through: [[0, 200], [4, 1600]] }, y: 700 }],
    presenter: { x: 1500, y: 880 },
    labels: [{ text: '红细胞', follow: 'cell' }, { text: '豆丁', follow: 'presenter', x: 40, y: -20 }],
  };
  const at = (lt) => resolveFreeShot({ title: 't' }, shot, lt, R, CLAWD_INFO).labels;
  const [a, b] = at(2);
  const cellX = resolveFreeShot({ title: 't' }, shot, 2, R, CLAWD_INFO).items.find((i) => i.type === 'component').inst.x;
  assert.equal(a.x, cellX);
  assert.equal(a.y, 700 - 80 - 10); // top of the 100×80 box, minus the default gap
  assert.equal(b.x, 1540);
  assert.equal(b.y, 880 - CLAWD_INFO.presenter.size[1] - 10 - 20);
  assert.ok(at(3)[0].x > a.x, 'label moves with the actor');
  assert.deepEqual(validateFreeStoryboard({ title: 't' }, [shot], R, CLAWD_INFO), []);
  const bad = validateFreeStoryboard({ title: 't' }, [{ ...shot, presenter: null, labels: [{ text: 'x', follow: 'ghost' }, { text: 'y', follow: 'presenter' }, { text: 'z' }] }], R, CLAWD_INFO);
  for (const e of ['label 0 follow "ghost"', 'label 1 follow "presenter"', 'label 2 x required']) assert.ok(bad.some((x) => x.includes(e)), `${e}\n${bad.join('\n')}`);
});

test('validator accepts through tracks and checks their values', () => {
  const s = good();
  s[1].actors[0].x = { through: [[0, 200], [2, 900], [4, 1700]], ends: 'linear' };
  assert.deepEqual(validateFreeStoryboard({ title: 't' }, s, R, CLAWD_INFO), []);
  s[1].actors[0].x = { through: [[0, 200], [2, 99999]] };
  assert.ok(validateFreeStoryboard({ title: 't' }, s, R, CLAWD_INFO).some((e) => e.includes('x outside world')));
  s[1].actors[0].x = { through: [[2, 200], [1, 300]] };
  assert.ok(validateFreeStoryboard({ title: 't' }, s, R, CLAWD_INFO).some((e) => e.includes('not a Track')));
});

test('lint: scale jumps across a cut and actors whose keys start late are flagged', () => {
  const shot = (id, actors) => ({ id, chapter: 'c', dur: 4, sub: '一句话', read: 'r', background: { use: 'meadow' }, actors });
  const s = [
    shot('S1', [{ id: 'd', use: 'cell', x: 500, y: 700, scale: [[0, 1], [4, 1.25]] }]),
    shot('S2', [{ id: 'd', use: 'cell', x: 500, y: 700, scale: [[0, 0.7], [4, 1.4]] }, { id: 'p', use: 'cell', x: [[2.4, 900], [3, 950]], y: 700, scale: [[2.4, 0.5], [3, 0.2]] }]),
  ];
  const w = lintFreeStoryboard(s, R, CLAWD_INFO);
  assert.ok(w.some((x) => x.includes('jumps from scale 1.25 to 0.7')), w.join('\n'));
  assert.ok(w.some((x) => x.includes('shot S2: p@2.4s')), w.join('\n'));
  s[1].actors[0].scale = [[0, 1.25], [4, 1.6]];
  s[1].actors[1].scale = [[0, 0.01], [2.38, 0.01], [2.4, 0.5], [3, 0.2]];
  assert.ok(!lintFreeStoryboard(s, R, CLAWD_INFO).some((x) => /jumps from scale|Tracks only start/.test(x)));
});

test('lint: a shot with every Track / Step constant is flagged as still', () => {
  const shot = (id, extra = {}) => ({ id, chapter: 'c', dur: 4, sub: '一句话', read: 'r', background: { use: 'meadow' }, actors: [{ id: 'd', use: 'cell', x: 500, y: 700 }], ...extra });
  const still = lintFreeStoryboard([shot('S1')], R, CLAWD_INFO);
  assert.ok(still.some((x) => x.includes('nothing changes on screen')), still.join('\n'));
  const moving = [
    shot('S1', { actors: [{ id: 'd', use: 'cell', x: [[0, 300], [4, 900]], y: 700 }] }),
    shot('S2', { actors: [{ id: 'd', use: 'cell', x: { through: [[0, 300], [4, 900]] }, y: 700 }] }),
    shot('S3', { actors: [{ id: 'd', use: 'cell', x: 500, y: 700, params: { mood: [[0, 'calm'], [2, 'panic']] } }] }),
    shot('S4', { presenter: { x: 1500, action: [[0, 'none'], [2, 'jump']] } }),
    shot('S5', { cam: { z: [1, 1.4] } }),
    shot('S6', { labels: [{ text: '红细胞', x: 500, y: 300, at: 1 }] }),
    shot('S7', { background: { use: 'meadow', params: { light: [[0, 0], [3, 1]] } } }),
    shot('S8', { actors: [{ id: 'h', use: 'cell', x: [[0, 300], [4, 900]], y: 700 }, { id: 'c', use: 'rock', attach: { to: 'h', at: 'hand' } }] }),
  ];
  for (const s of moving) assert.ok(!lintFreeStoryboard([s], R, CLAWD_INFO).some((x) => x.includes('nothing changes on screen')), JSON.stringify(s));
  // a flat key list is still a constant picture
  const flat = shot('S9', { actors: [{ id: 'd', use: 'cell', x: [[0, 500], [4, 500]], y: 700 }] });
  assert.ok(lintFreeStoryboard([flat], R, CLAWD_INFO).some((x) => x.includes('nothing changes on screen')));
});

test('lint: a shot where only a label or the camera moves does not carry the line', () => {
  const shot = (id, extra = {}) => ({ id, chapter: 'c', dur: 4, sub: '一句话', read: 'r', background: { use: 'meadow' }, actors: [{ id: 'd', use: 'cell', x: 500, y: 700 }], ...extra });
  const weak = [
    shot('S1', { labels: [{ text: '红细胞', x: 500, y: 300, at: 1 }] }),
    shot('S2', { cam: { z: [1, 1.4] } }),
    shot('S3', { labels: [{ text: 'x', x: 500, y: 300 }], cam: { cx: [0, 200] } }),
  ];
  for (const s of weak) {
    const w = lintFreeStoryboard([s], R, CLAWD_INFO);
    assert.ok(w.some((x) => x.includes('only a label or the camera moves')), w.join('\n'));
    assert.ok(!w.some((x) => x.includes('nothing changes on screen')), w.join('\n'));
  }
  const carried = [
    shot('S4', { actors: [{ id: 'd', use: 'cell', x: [[0, 300], [4, 900]], y: 700 }], labels: [{ text: '红细胞', x: 500, y: 300, at: 1 }] }),
    shot('S5', { presenter: { x: 1500, action: [[0, 'none'], [2, 'jump']] } }),
    shot('S6', { presenter: { x: 1500, action: 'dance' } }),
  ];
  for (const s of carried) assert.ok(!lintFreeStoryboard([s], R, CLAWD_INFO).some((x) => x.includes('only a label or the camera moves')), JSON.stringify(s));
});

test('lint: presenter in almost every shot is flagged', () => {
  const s = Array.from({ length: 8 }, (_, i) => ({ id: `S${i}`, chapter: 'c', dur: 4, sub: '一句话', read: 'r', background: { use: 'meadow', params: { i } }, presenter: i < 7 ? { x: 1500 } : null }));
  assert.ok(lintFreeStoryboard(s, R, CLAWD_INFO).some((x) => x.includes('presenter appears in 7 of 8 shots')));
  for (let i = 2; i < 8; i++) s[i].presenter = null;
  assert.ok(!lintFreeStoryboard(s, R, CLAWD_INFO).some((x) => x.includes('presenter appears')));
});

test('lint: the presenter inside an interior / organ background is flagged', () => {
  const reg = new Map([...R, ['gut', { ...def('gut', 'background'), tags: ['bio', 'stomach', 'interior'] }]]);
  const s = [
    { id: 'S1', chapter: 'c', dur: 4, sub: '一句话', read: 'r', background: { use: 'meadow' }, presenter: { x: 1500 } },
    { id: 'S2', chapter: 'c', dur: 4, sub: '一句话', read: 'r', background: { use: 'gut' }, presenter: { x: 1500 } },
    { id: 'S3', chapter: 'c', dur: 4, sub: '一句话', read: 'r', background: { use: 'gut' } },
  ];
  const w = lintFreeStoryboard(s, reg, CLAWD_INFO);
  assert.ok(w.some((x) => x.includes('presenter stands inside a micro / interior scene in S2')), w.join('\n'));
});

test('lint: more than 3 different characters in one episode is flagged (critter by char, swing riders, presenter count)', () => {
  const def = (name, kind, tags, params = {}) => ({ name, style: 'clawd', kind, description: 'd', tags, size: kind === 'background' ? [1920, 1080] : [100, 100], params, draw() {} });
  const reg = new Map([
    ['meadow', def('meadow', 'background', [])],
    ['ch_clawd_girl', def('ch_clawd_girl', 'actor', ['character'])],
    ['ch_clawd_boy', def('ch_clawd_boy', 'actor', ['character'])],
    ['ch_critter', def('ch_critter', 'actor', ['character'], { char: { type: 'enum', default: 'jiu', options: ['jiu', 'bean', 'mian'], description: 'c' } })],
    ['pr_mv_swing', def('pr_mv_swing', 'prop', ['swing'], { rider: { type: 'enum', default: 'girl', options: ['girl', 'boy', 'none'], description: 'r' } })],
    ['jar', def('jar', 'prop', ['prop'])],
  ]);
  const shot = (id, actors, presenter = null) => ({ id, chapter: 'c', dur: 4, sub: '一句话', read: 'r', background: { use: 'meadow', params: { id } }, actors, presenter });
  const ok = [
    shot('S1', [{ id: 'g', use: 'ch_clawd_girl', x: 500, y: 800 }], { x: 1500 }),
    shot('S2', [{ id: 's', use: 'pr_mv_swing', x: 500, y: 800 }, { id: 'j', use: 'jar', x: 900, y: 800 }]), // the swing's default rider is the girl again
    shot('S3', [{ id: 'm', use: 'ch_critter', x: 500, y: 800, params: { char: 'mian' } }]),
  ];
  assert.ok(!lintFreeStoryboard(ok, reg, CLAWD_INFO).some((x) => x.includes('different characters')), 'girl + presenter + mian = 3');
  const crowded = [...ok, shot('S4', [{ id: 'c', use: 'ch_critter', x: 500, y: 800 }, { id: 's', use: 'pr_mv_swing', x: 900, y: 800, params: { rider: 'boy' } }])];
  const w = lintFreeStoryboard(crowded, reg, CLAWD_INFO).find((x) => x.includes('different characters'));
  assert.ok(w, 'flagged');
  assert.match(w, /5 different characters/);
  assert.match(w, /critter:jiu/);
  assert.match(w, /clawd_boy/);
});
