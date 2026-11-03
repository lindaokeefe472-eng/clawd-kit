// film.ts — "The Butterfly": a 28-second hand-painted short with the new cast.
// Story: Jiujiu spots a butterfly and chases it → it lands on sleepy Bean in the pond → it lands on Mianmian's ear at
// sunset; everyone gathers and dances → night: the five sleep in a row, the butterfly glows like a little lamp.
import { PAL, setBoil, boilSeed, jit, clamp, lerp, ease, seg, kf2, jump, stroll, bp, hash, frac, wob, backOut, easeOut, mixCol, type View } from './core.ts';
import { paint, inkLine, wcolor, blob, washRect, glow, ellPts, paperCanvas, grain, trace, type Ctx, type Pt } from './paint.ts';
import { charById, critter, star } from './critters.ts';
import { acting, combine, feel } from './emotions.ts';
import type { Opts } from './critters.ts';
import { brushMask, brushEdges, withClip, irisPath, dripPath } from './transitions.ts';
import { hillPts, tufts, flowers, cloud } from './scenery.ts';

export const FW = 1920, FH = 1080;
export const SHOTS = [
  { t0: 0, t1: 7, name: '草地 · 发现' },
  { t0: 7, t1: 14, name: '荷塘 · 打盹' },
  { t0: 14, t1: 21.5, name: '黄昏 · 相聚' },
  { t0: 21.5, t1: 28.5, name: '星夜 · 晚安' },
];
export const DURATION = 28.5;

const JIU = charById('jiu'), BEAN = charById('bean'), MIAN = charById('mian'), MO = charById('mo'), BING = charById('bing');

function cam(ctx: Ctx, cx: number, cy: number, z: number, fn: () => void) {
  ctx.save(); ctx.translate(FW / 2, FH / 2); ctx.scale(z, z); ctx.translate(-cx, -cy); fn(); ctx.restore();
}

// ---------- props ----------
function butterfly(ctx: Ctx, x: number, y: number, s: number, t: number, o: { flap?: number; dir?: number; glowA?: number; key: string; perched?: boolean }) {
  boilSeed('bf' + o.key);
  const f = o.flap ?? 2.4;
  const k = o.perched ? 0.35 + 0.25 * Math.abs(Math.sin(t * 1.4)) : 0.18 + 0.82 * Math.abs(Math.sin(t * f * Math.PI));
  if (o.glowA) { glow(ctx, x, y, s * 9, '#FFE29A', o.glowA); glow(ctx, x, y, s * 3, '#FFF3C8', o.glowA); }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(o.dir ?? 1, 1);
  ctx.rotate(Math.sin(t * 3) * 0.12);
  const sw = Math.max(1.2, s * 0.16);
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(side * k, 1);
    const up: Pt[] = [[0, -0.1 * s], [0.9 * s, -1.7 * s], [2.1 * s, -1.6 * s], [2.0 * s, -0.4 * s], [0.8 * s, 0.2 * s]];
    const lo: Pt[] = [[0, 0.1 * s], [1.3 * s, 0.4 * s], [1.4 * s, 1.3 * s], [0.6 * s, 1.5 * s]];
    paint(ctx, lo.map(([a, b]) => [a + jit(s * 0.05), b + jit(s * 0.05)] as Pt), { wash: PAL.ochre, sw, tex: 0.5 });
    paint(ctx, up.map(([a, b]) => [a + jit(s * 0.05), b + jit(s * 0.05)] as Pt), { wash: PAL.rose, sw, tex: 0.5 });
    paint(ctx, ellPts(1.4 * s, -1.0 * s, 0.32 * s, 0.32 * s, 8), { wash: PAL.cream, ink: null, tex: 0 });
    ctx.restore();
  }
  inkLine(ctx, [[0, -0.7 * s], [0, 1.1 * s]], s * 0.38);
  inkLine(ctx, [[0, -0.7 * s], [-0.5 * s, -1.6 * s], [-0.8 * s, -1.7 * s]], sw * 0.6);
  inkLine(ctx, [[0, -0.7 * s], [0.5 * s, -1.6 * s], [0.8 * s, -1.7 * s]], sw * 0.6);
  ctx.restore();
}

// ---------- shot A: meadow ----------
function shotA(ctx: Ctx, t: number) {
  const z = lerp(1.0, 1.07, ease(t / 7));
  cam(ctx, 960, 560, z, () => {
    boilSeed('A-sky');
    washRect(ctx, -100, -100, FW + 200, 820, [[0, '#A9CFE6'], [0.6, '#D4E6E4'], [1, '#EEEBD6']]);
    glow(ctx, 1560, 210, 320, '#FFE0A0', 0.7);
    boilSeed('A-sun'); blob(ctx, 1560, 210, 70, 70, '#F7D88A', 0.9, 3);
    cloud(ctx, 300 + t * 14, 200, 60, 'a1'); cloud(ctx, 1100 + t * 9, 140, 45, 'a2'); cloud(ctx, 1750 + t * 11, 330, 38, 'a3');
    boilSeed('A-far'); wcolor(ctx, hillPts(600, 30, 0.8, 1), '#AFC8B0', 0.8, 3, 10);
    boilSeed('A-mid'); wcolor(ctx, hillPts(690, 24, 0.6, 3), '#94BB78', 0.9, 4, 10);
    boilSeed('A-near'); wcolor(ctx, hillPts(790, 10, 0.4, 0.5), '#A7C982', 0.95, 4, 8);
    tufts(ctx, 26, 700, 780, '#6E9A55', t, 1, 0.7);
    flowers(ctx, 14, 820, 1040, t, 2);
    tufts(ctx, 34, 800, 1060, '#5E8B48', t, 3, 1.1);

    // butterfly path
    const bk: [number, number, number][] = [[2.5, 2150, 260], [3.3, 1300, 380], [3.9, 900, 500], [4.9, 840, 470], [5.6, 1150, 420], [7.2, 2300, 330]];
    const [bx0, by0] = kf2(t, bk);
    const bx = bx0 + wob(t, 0.9) * 30, by = by0 + wob(t, 1.7) * 26;
    const bdir = t < 4.9 ? -1 : 1;

    // Jiujiu
    const u = 28, gy = 830;
    let o: Opts; let x: number;
    const look = clamp((bx - 760) / 300, -1, 1);
    if (t < 2.7) {
      const s = stroll(t, 0.3, 2.7, -180, 760, u); x = s.x;
      o = combine(feel('happy', t), { view: s.view, flip: s.flip, walk: s.walk, dy: s.dy });
    } else if (t < 5.3) {
      x = 760;
      o = combine(acting(t, [[2.7, 'calm'], [3.55, 'surprised'], [4.45, 'joy']]), { lookX: look, lookY: by < 560 ? -0.8 : 0 });
      if (t < 3.55) o.lookX = Math.sin(t * 2) * 0.4;
      if (t > 4.45) o.emote = 'sparkle';
    } else {
      const k = seg(t, 5.35, 7.4); x = lerp(760, 2200, ease(k));
      const ph = frac((t - 5.35) / 0.5), jp = jump(ph * 0.5, 0.02, 0.45, 1.6);
      o = combine(feel('excited', t), { view: 'q' as View, dy: jp.dy, sq: jp.sq, aL: 1.3, aR: 1.3 });
    }
    critter(ctx, JIU, x, gy, u, combine(o, { key: 'A-jiu', seed: 0.4 }), t);
    if (t > 2.4 && t < 7.4) butterfly(ctx, bx, by, 24, t, { dir: bdir, key: 'A' });
    tufts(ctx, 10, 1000, 1090, '#557F40', t, 9, 1.4);
  });
}

// ---------- shot B: pond ----------
function shotB(ctx: Ctx, t: number) {
  cam(ctx, 960, 560, lerp(1.04, 1.0, ease(t / 7)), () => {
    boilSeed('B-sky');
    washRect(ctx, -100, -100, FW + 200, 700, [[0, '#BCD9DE'], [1, '#EFE7CF']]);
    cloud(ctx, 500 + t * 8, 160, 50, 'b1'); cloud(ctx, 1500 + t * 6, 120, 40, 'b2');
    boilSeed('B-treeband'); wcolor(ctx, [[-100, 470], [FW + 100, 470], [FW + 100, 640], [-100, 640]], '#6C955C', 0.9, 3, 10, false);
    for (let i = 0; i < 14; i++) { boilSeed('B-tree' + i); blob(ctx, i * 150 + hash(i) * 60, 500 - hash(i * 2) * 40, 110, 90 + hash(i) * 30, i % 2 ? '#7EA46A' : '#6C955C', 0.85, 3); }
    boilSeed('B-bank'); wcolor(ctx, hillPts(560, 8, 0.5, 2), '#C2CF8E', 0.95, 4, 8);
    tufts(ctx, 22, 600, 1080, '#7E9A55', t, 11, 0.9);
    boilSeed('B-pond');
    const pond = ellPts(1180, 840, 760, 230, 30);
    wcolor(ctx, pond, '#6FAFC0', 0.95, 4, 12);
    ctx.save(); trace(ctx, pond); ctx.clip();
    washRect(ctx, 400, 610, 1600, 460, [[0, 'rgba(255,255,255,0.18)'], [1, 'rgba(40,60,90,0.18)']]);
    for (let i = 0; i < 9; i++) {
      boilSeed('B-rip' + i);
      const rx = 600 + hash(i) * 1200, ry = 700 + hash(i * 3) * 300, l = 40 + hash(i * 5) * 60, d = Math.sin(t * 1.2 + i) * 8;
      inkLine(ctx, [[rx - l + d, ry], [rx + l + d, ry]], 2.2, PAL.cream, false, 0.5);
    }
    ctx.restore();
    inkLine(ctx, pond, 2, mixCol('#77B6B0', PAL.ink, 0.4), true, 0.5);
    // lily pads
    const pad = (x: number, y: number, rx: number, ry: number, key: string) => {
      boilSeed('pad' + key);
      const pts = ellPts(x, y, rx, ry, 22, ry * 0.05);
      pts.splice(4, 3, [x, y]);
      paint(ctx, pts, { wash: '#4F8A57', dk: '#2F5A3A', sw: 2.6, tex: 0.8 });
    };
    pad(750, 760, 110, 28, '1'); pad(1600, 900, 130, 32, '2'); pad(1480, 700, 80, 20, '3');
    pad(1080, 822, 270, 58, 'main');
    // reeds
    for (let i = 0; i < 9; i++) {
      boilSeed('reed' + i);
      const rx = 1720 + i * 26 + hash(i) * 20, ry = 760 + hash(i * 2) * 60, h = 180 + hash(i * 4) * 120, sway = Math.sin(t * 1.3 + i) * 8;
      inkLine(ctx, [[rx, ry], [rx + sway, ry - h]], 4, '#5E7F45');
      if (i % 2 === 0) paint(ctx, [[rx + sway - 7, ry - h + 10], [rx + sway + 7, ry - h + 10], [rx + sway + 7, ry - h + 60], [rx + sway - 7, ry - h + 60]], { wash: '#8A5A3A', sw: 2, tex: 0.5 });
    }

    // butterfly
    const u = 31;
    const bfL: [number, number] = [1080 + 2.8 * u + 4, 815 - (1.7 + 5 + 1.7) * u - 34];
    const bk: [number, number, number][] = [[0.5, -120, 300], [1.6, 600, 380], [2.4, bfL[0], bfL[1]], [5.7, bfL[0], bfL[1]], [7.4, 2250, 230]];
    const [bx0, by0] = kf2(t, bk);
    const perched = t > 2.4 && t < 5.7;
    const bx = bx0 + (perched ? 0 : wob(t, 0.9) * 26), by = by0 + (perched ? 0 : wob(t, 1.6) * 22);

    // Bean
    let bo = acting(t, [[0, 'sleepy'], [2.75, 'surprised'], [3.6, 'confused'], [4.5, 'love'], [5.9, 'surprised'], [6.4, 'happy']]);
    bo = combine(bo, { key: 'B-bean', seed: 2.1 });
    if (t > 2.75 && t < 4.5) { bo.lookY = -1; bo.lookX = 0.8; }
    if (t > 5.0 && t < 5.9) bo.lookX = -1;
    if (t > 5.9) { bo.lookX = 1; bo.lookY = -0.6; }
    if (t > 3.6 && t < 4.5) bo.emote = '?';
    critter(ctx, BEAN, 1080, 815, u, bo, t);

    // Jiujiu bounds in
    if (t > 4.3) {
      const k = seg(t, 4.6, 5.3), [jx, jy] = [lerp(-160, 300, easeOut(k)), 760];
      const jp = jump(t, 4.6, 5.3, 4);
      let jo = t < 5.3 ? combine(feel('excited', t), { view: 'q' as View, aL: 1.3, aR: 1.3 }) : acting(t, [[5.3, 'joy'], [5.95, 'surprised'], [6.5, 'happy']]);
      if (t > 5.95) jo.lookX = 1;
      jo = combine(jo, { dy: jp.dy, sq: jp.sq, key: 'B-jiu', seed: 0.9 });
      critter(ctx, JIU, jx, jy, 26, jo, t);
    }
    butterfly(ctx, bx, by, 21, t, { dir: 1, key: 'B', perched });
  });
}

// ---------- shot C: sunset hill ----------
function danceO(t: number, ph: number, i: number): Opts {
  const b = bp(t) + ph;
  return { eyes: 'happy', mouth: 'grin', dy: -Math.abs(Math.sin(b * Math.PI)) * 0.9, rot: Math.sin(b * Math.PI) * 0.1, aL: Math.floor(b) % 2 ? 1.4 : -0.3, aR: Math.floor(b) % 2 ? -0.3 : 1.4, emote: i % 2 ? 'note' : 'sparkle', emoteAge: t, blush: 0.5, tailWag: 4 };
}
function shotC(ctx: Ctx, t: number) {
  cam(ctx, lerp(1000, 960, ease(t / 7.5)), 560, lerp(1.08, 1.0, ease(seg(t, 3.5, 6))), () => {
    boilSeed('C-sky');
    washRect(ctx, -100, -100, FW + 200, 820, [[0, '#A796C6'], [0.45, '#EBA68E'], [0.8, '#F6CC8E'], [1, '#F7DCA6']]);
    glow(ctx, 960, 620, 520, '#FFC07A', 0.55);
    boilSeed('C-sun'); blob(ctx, 960, 610, 130, 130, '#F8C66E', 0.95, 4);
    cloud(ctx, 380 + t * 6, 260, 55, 'c1', '#F3C1B0', 0.8); cloud(ctx, 1450 + t * 5, 200, 48, 'c2', '#F3C1B0', 0.8);
    boilSeed('C-far'); wcolor(ctx, hillPts(640, 30, 0.7, 2), '#B98D98', 0.85, 3, 10);
    boilSeed('C-mid'); wcolor(ctx, hillPts(720, 22, 0.5, 4), '#A88A72', 0.9, 4, 10);
    boilSeed('C-near'); wcolor(ctx, hillPts(800, 14, 0.35, 1), '#9AAE6E', 0.95, 4, 8);
    tufts(ctx, 30, 820, 1060, '#6F8C4C', t, 21, 1.0);
    flowers(ctx, 8, 860, 1040, t, 22);

    const gy = 860;
    const bk: [number, number, number][] = [[1.2, -120, 380], [2.2, 520, 330], [3.0, 903, 540], [5.0, 903, 540], [5.6, 1050, 330], [7.6, 1050, 330]];
    let [bx, by] = kf2(t, bk);
    const perched = t > 3.0 && t < 5.0;
    if (!perched) { bx += wob(t, 0.9) * 26; by += wob(t, 1.6) * 20; }
    if (t > 5.6) { const a = (t - 5.6) * 2.2; bx = 1050 + Math.sin(a) * 260; by = 330 + Math.sin(a * 2) * 50; }

    const dancing = t > 5.4;
    // Mianmian
    let mo = acting(t, [[0, 'bored'], [3.05, 'surprised'], [3.7, 'shy'], [4.9, 'joy']]);
    if (t > 3.05 && t < 4.9) { mo.lookY = -1; mo.lookX = 0.6; }
    if (dancing) mo = danceO(t, 0, 0);
    critter(ctx, MIAN, 860, gy, 24, combine(mo, { key: 'C-mian', seed: 1.7, earDroop: t < 3.05 ? 0.45 : 0 }), t);
    // Moqiu
    let co = acting(t, [[0, 'sleepy'], [4.9, 'surprised']]);
    if (dancing) co = danceO(t, 0.5, 1);
    critter(ctx, MO, 1150, gy, 22, combine(co, { key: 'C-mo', seed: 3.3 }), t);
    // Bingbing
    let po = acting(t, [[0, 'calm'], [1.6, 'confused'], [3.05, 'surprised'], [3.8, 'happy'], [4.9, 'excited']]);
    if (t > 1.6 && t < 3.05) po.lookX = -0.9;
    if (dancing) po = danceO(t, 0.25, 2);
    critter(ctx, BING, 1420, gy, 22, combine(po, { key: 'C-bing', seed: 4.1 }), t);
    // newcomers
    if (t > 3.6) {
      const sj = stroll(t, 3.8, 5.1, -180, 380, 22);
      let jo = t < 5.1 ? combine(feel('happy', t), { view: sj.view, walk: sj.walk, dy: sj.dy }) : acting(t, [[5.1, 'joy']]);
      if (dancing) jo = danceO(t, 0.75, 3);
      critter(ctx, JIU, sj.x, gy + 10, 22, combine(jo, { key: 'C-jiu', seed: 0.2 }), t);
      const sb = stroll(t, 3.9, 5.25, -420, 600, 20);
      let bo = t < 5.25 ? combine(feel('happy', t + 0.3), { view: sb.view, walk: sb.walk, dy: sb.dy }) : acting(t, [[5.25, 'joy']]);
      if (dancing) bo = danceO(t, 0.4, 4);
      critter(ctx, BEAN, sb.x, gy + 20, 20, combine(bo, { key: 'C-bean', seed: 2.6 }), t);
    }
    if (t > 1.1) butterfly(ctx, bx, by, 21, t, { key: 'C', perched, dir: t > 5.6 ? (Math.cos((t - 5.6) * 2.2) > 0 ? 1 : -1) : 1 });
  });
}

// ---------- shot D: night ----------
function shotD(ctx: Ctx, t: number) {
  cam(ctx, 960, 580, lerp(1.0, 1.1, ease(t / 7)), () => {
    boilSeed('D-sky');
    washRect(ctx, -100, -100, FW + 200, 900, [[0, '#1C2250'], [0.6, '#33397A'], [1, '#6A5B8E']]);
    for (let i = 0; i < 70; i++) {
      const sx = hash(i * 7.3) * FW, sy = hash(i * 3.1) * 620, tw = 0.5 + 0.5 * Math.sin(t * (1 + hash(i) * 2) + i);
      boilSeed('star' + i);
      glow(ctx, sx, sy, 10 + tw * 12, '#FFF1C8', 0.6 * tw + 0.2);
      if (i % 5 === 0) star(ctx, sx, sy, 6 + tw * 4, '#FFF3D0', 0, 0);
    }
    glow(ctx, 1500, 220, 300, '#FFF0C8', 0.55);
    boilSeed('D-moon'); blob(ctx, 1500, 220, 75, 75, '#F7EBC8', 1, 4);
    blob(ctx, 1530, 205, 60, 64, '#2A3068', 0.0, 1);
    boilSeed('D-far'); wcolor(ctx, hillPts(660, 26, 0.7, 1), '#3A447A', 0.9, 3, 10);
    boilSeed('D-near'); wcolor(ctx, hillPts(800, 12, 0.4, 2), '#2F3D60', 0.95, 4, 8);
    tufts(ctx, 26, 820, 1070, '#22304E', t, 31, 1.0);

    const gy = 860, cast = [MIAN, MO, JIU, BEAN, BING], us = [20, 19, 20, 18, 19], xs = [560, 790, 1000, 1220, 1450];
    cast.forEach((c, i) => {
      let o = feel('sleepy', t + i * 0.6);
      o = combine(o, { tint: '#5B6AA8', tintK: 0.55, key: 'D-' + c.id, emoteAge: t * 0.8 + i * 0.3, emote: i === 2 || i === 4 ? 'zzz' : 'none', rot: (i - 2) * 0.03 });
      critter(ctx, c, xs[i], gy + (i % 2) * 8, us[i], o, t);
    });
    // fireflies
    for (let i = 0; i < 7; i++) {
      boilSeed('ff' + i);
      const fx = 300 + hash(i * 4.4) * 1400 + Math.sin(t * 0.6 + i) * 60, fy = 600 + hash(i * 2.2) * 300 + Math.cos(t * 0.8 + i * 2) * 40;
      glow(ctx, fx, fy, 26, '#F8F0A0', 0.5 + 0.5 * Math.sin(t * 3 + i));
    }
    const land: [number, number] = [1000, gy - (1.9 + 6) * 20 - 30];
    const bk: [number, number, number][] = [[0, 1750, 330], [2.2, 1300, 480], [3.8, land[0], land[1]], [9, land[0], land[1]]];
    let [bx, by] = kf2(t, bk);
    const perched = t > 3.8;
    if (!perched) { bx += wob(t, 0.7) * 30; by += wob(t, 1.3) * 20; }
    butterfly(ctx, bx, by, 19, t, { key: 'D', perched, dir: -1, glowA: 0.7 + 0.3 * Math.sin(t * 2.5) });
  });
}

const shotFns = [shotA, shotB, shotC, shotD];
function drawShot(ctx: Ctx, i: number, t: number) { shotFns[i](ctx, t - SHOTS[i].t0); }

export function film(ctx: Ctx, t: number) {
  setBoil(t);
  t = clamp(t, 0, DURATION);
  let cur = SHOTS.findIndex(s => t < s.t1); if (cur < 0) cur = SHOTS.length - 1;
  const paper = paperCanvas(FW, FH);

  const T1 = 7, T2 = 14, T3 = 21.5;
  if (t > T1 - 0.45 && t < T1 + 0.55) {
    const k = seg(t, T1 - 0.45, T1 + 0.55);
    drawShot(ctx, 0, t);
    withClip(ctx, () => brushMask(ctx, k, 'ab'), () => drawShot(ctx, 1, Math.max(t, T1)));
    brushEdges(ctx, k, 'ab', '#9CC27A');
  } else if (t > T2 - 0.4 && t < T2 + 0.6) {
    const k = easeOut(seg(t, T2 - 0.4, T2 + 0.6));
    drawShot(ctx, 1, t);
    withClip(ctx, () => irisPath(ctx, 960, 560, k * 1200, 'bc'), () => drawShot(ctx, 2, Math.max(t, T2)));
    boilSeed('irisring'); inkLine(ctx, ellPts(960, 560, k * 1200, k * 1200, 40, 6), 5, PAL.ink, true, 0.6 * (1 - k));
  } else if (t > T3 - 0.5 && t < T3 + 0.6) {
    const k = ease(seg(t, T3 - 0.5, T3 + 0.6));
    drawShot(ctx, 2, t);
    withClip(ctx, () => dripPath(ctx, k), () => drawShot(ctx, 3, Math.max(t, T3)));
  } else {
    drawShot(ctx, cur, t);
  }

  // paper grain over everything
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.55; ctx.drawImage(paper, 0, 0); ctx.restore();
  grain(ctx, FW, FH, 0.3);

  // intro: brush reveal from paper
  if (t < 0.9) {
    const k = seg(t, 0, 0.9);
    ctx.save();
    brushMask(ctx, k, 'intro', -1); ctx.rect(0, 0, FW, FH); // mask path first: brushMask begins a new path
    ctx.clip('evenodd');
    ctx.drawImage(paper, 0, 0);
    ctx.restore();
  }
  // outro: iris closes on the glowing butterfly, leaving paper
  if (t > DURATION - 1.7) {
    const k = ease(seg(t, DURATION - 1.7, DURATION - 0.3));
    const z = lerp(1.0, 1.1, ease((t - T3) / 7));
    const bx = FW / 2 + (1000 - 960) * z, by = FH / 2 + (860 - 188 - 580) * z;
    ctx.save();
    irisPath(ctx, bx, by, lerp(1500, 0, k), 'out'); ctx.rect(0, 0, FW, FH); // circle first: irisPath begins a new path
    ctx.clip('evenodd');
    ctx.drawImage(paper, 0, 0);
    ctx.restore();
    if (k < 1) { boilSeed('outring'); inkLine(ctx, ellPts(bx, by, lerp(1500, 0, k), lerp(1500, 0, k), 40, 5), 5, PAL.ink, true, 0.7); }
  }
  void backOut;
}
