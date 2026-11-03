// sheets.ts — model sheets in the style of docs/emotions.jpg and docs/views.jpg
import { PAL, setBoil, boilSeed, jit, frac, jump, take, turn, wob, bp, type View } from './core.ts';
import { paperCanvas, grain, label, inkLine, type Ctx } from './paint.ts';
import { CHARS, critter, type CharDef, type Hat } from './critters.ts';
import { EMOTIONS, feel, combine, acting } from './emotions.ts';

function base(ctx: Ctx, w: number, h: number, t: number) {
  setBoil(t);
  ctx.drawImage(paperCanvas(w, h), 0, 0);
}
function ground(ctx: Ctx, x0: number, x1: number, y: number, key: string) {
  boilSeed('ground' + key);
  inkLine(ctx, [[x0, y + jit(1)], [(x0 + x1) / 2, y + jit(1.5)], [x1, y + jit(1)]], 1.6, '#7C7286', false, 0.55);
}
const fitU = (c: CharDef, w: number, h: number) => Math.min(w / (c.bw + 4), h / (c.bh + c.legH + (c.kind === 'bunny' ? 4.6 : 2.5)));

export const LINEUP_W = 1800, LINEUP_H = 760;
const LINEUP_ACT: [number, string][][] = [
  [[0, 'happy'], [3, 'excited'], [6, 'surprised'], [8, 'happy']],
  [[0, 'sleepy'], [3.5, 'surprised'], [5, 'happy'], [8, 'sleepy']],
  [[0, 'shy'], [3, 'love'], [6, 'happy'], [8.5, 'shy']],
  [[0, 'smug'], [3, 'cool'], [6, 'music'], [8.5, 'smug']],
  [[0, 'nervous'], [3, 'happy'], [6, 'proud'], [8.5, 'nervous']],
];
export function lineupSheet(ctx: Ctx, t: number, sel?: string) {
  const W = LINEUP_W, H = LINEUP_H;
  base(ctx, W, H, t);
  const gy = 560;
  ground(ctx, 60, W - 60, gy + 6, 'lineup');
  CHARS.forEach((c, i) => {
    const cx = 200 + i * 350, u = fitU(c, 300, 430);
    const lt = (t + i * 0.7) % 10;
    const o = acting(lt, LINEUP_ACT[i]);
    const picked = sel === c.id;
    critter(ctx, c, cx, gy, u, combine(o, { key: 'line' + c.id, seed: i * 1.3, dy: picked ? -Math.abs(Math.sin(t * 5)) * 0.4 : 0 }), lt);
    label(ctx, c.name, cx, gy + 70, 44, PAL.ink, picked ? 0.95 : 0.75);
    label(ctx, c.en, cx, gy + 118, 22, PAL.ink, 0.5);
  });
  grain(ctx, W, H, 0.35);
}

export const EMO_W = 1680, EMO_H = 1180;
export function emotionSheet(ctx: Ctx, t: number, c: CharDef) {
  const W = EMO_W, H = EMO_H;
  base(ctx, W, H, t);
  const cols = 6, cw = W / cols, ch = (H - 40) / 4;
  const u = fitU(c, cw * 0.82, ch * 0.62);
  EMOTIONS.forEach((e, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = cw * (col + 0.5), gy = 40 + ch * row + ch * 0.7;
    ground(ctx, cx - cw * 0.38, cx + cw * 0.38, gy + 4, 'e' + i);
    critter(ctx, c, cx, gy, u, combine(feel(e.id, t + i * 0.37), { key: `emo${c.id}${i}`, seed: i * 0.77 }), t + i * 0.37);
    label(ctx, `${e.cn}  ${e.en}`, cx, gy + 34, 22, PAL.ink, 0.72);
  });
  grain(ctx, W, H, 0.35);
}

export const VIEW_W = 1760, VIEW_H = 1080;
const HATS: [Hat, string][] = [['party', '派对'], ['hard', '安全帽'], ['crown', '王冠'], ['halo', '光环'], ['wizard', '巫师'], ['top', '礼帽'], ['beanie', '毛线帽'], ['band', '发带'], ['bow', '蝴蝶结'], ['flower', '小花'], ['leaf', '叶子'], ['headphones', '耳机']];
export function viewsSheet(ctx: Ctx, t: number, c: CharDef) {
  const W = VIEW_W, H = VIEW_H;
  base(ctx, W, H, t);
  // row 1: key views
  const views: [View, string][] = [['front', '正面 FRONT'], ['q', '四分之三 Q'], ['side', '侧面 SIDE'], ['qback', '背四分之三 QBACK'], ['back', '背面 BACK']];
  const u1 = fitU(c, 300, 330), g1 = 370;
  ground(ctx, 40, W - 40, g1 + 6, 'r1');
  views.forEach(([v, name], i) => {
    const cx = 190 + i * 345;
    critter(ctx, c, cx, g1, u1, combine(feel('calm', t), { view: v, key: 'v' + i, lookX: 0 }), t);
    label(ctx, name, cx, g1 + 40, 24);
  });
  // row 2: motion
  const u2 = fitU(c, 210, 230), g2 = 720;
  ground(ctx, 40, W - 40, g2 + 6, 'r2');
  const L = 6, step = (W - 160) / (L - 1);
  const xs = Array.from({ length: L }, (_, i) => 80 + i * step + (i === 0 ? 40 : i === L - 1 ? -40 : 0));
  // walk (side)
  const wk = t * 1.6;
  critter(ctx, c, xs[0] + Math.sin(t * 0.5) * 12, g2, u2, { view: 'side', walk: wk, dy: -Math.abs(Math.sin(wk * Math.PI)) * 0.3, key: 'walk', eyes: 'slit', mouth: 'smile' }, t);
  label(ctx, '走路 WALK', xs[0], g2 + 36, 22);
  // turn: steps through key views
  const tr = turn(frac(t / 4) * 4, 0, 4, 0, 1);
  critter(ctx, c, xs[1], g2, u2, { ...tr, smear: 0, key: 'turn', eyes: 'slit', mouth: 'smile' }, t);
  label(ctx, '转身 TURN', xs[1], g2 + 36, 22);
  // smear dash
  const sk = frac(t / 2.2);
  critter(ctx, c, xs[2] - 60 + sk * 120, g2, u2, { view: 'side', smear: Math.sin(sk * Math.PI) * 0.9, key: 'smear', eyes: 'wide', mouth: 'grin', emote: 'sparkle', walk: sk * 4 }, t);
  label(ctx, '冲刺 SMEAR', xs[2], g2 + 36, 22);
  // jump
  const jt = frac(t / 1.8) * 1.8, jp = jump(jt, 0.4, 1.0, 3.2);
  critter(ctx, c, xs[3], g2, u2, { ...feel('joy', 0.3), dy: jp.dy, sq: jp.sq, key: 'jump', emote: 'none', aL: jt > 0.4 && jt < 1 ? 1.4 : 0.2, aR: jt > 0.4 && jt < 1 ? 1.4 : 0.2 }, t);
  label(ctx, '跳跃 JUMP', xs[3], g2 + 36, 22);
  // take
  const tt = frac(t / 2.4) * 2.4, tk = take(tt, 0.5, 1);
  critter(ctx, c, xs[4], g2, u2, { eyes: tt > 0.5 ? 'wide' : 'slit', mouth: tt > 0.5 ? 'o' : 'smile', dy: tk.dy, sq: tk.sq, emote: tt > 0.5 ? '!' : 'none', emoteK: Math.min(1, (tt - 0.5) * 4), aL: tt > 0.5 ? 1 : 0.1, aR: tt > 0.5 ? 1 : 0.1, key: 'take' }, t);
  label(ctx, '吃惊 TAKE', xs[4], g2 + 36, 22);
  // dance
  const b = bp(t);
  critter(ctx, c, xs[5], g2, u2, { eyes: 'happy', mouth: 'grin', dy: -Math.abs(Math.sin(b * Math.PI)) * 0.8, rot: Math.sin(b * Math.PI) * 0.12, aL: Math.floor(b) % 2 ? 1.4 : -0.4, aR: Math.floor(b) % 2 ? -0.4 : 1.4, emote: 'note', emoteAge: t, key: 'dance', view: Math.floor(b / 2) % 4 === 3 ? 'q' : 'front', flip: Math.floor(b / 2) % 8 === 3 }, t);
  label(ctx, '跳舞 DANCE', xs[5], g2 + 36, 22);
  // row 3: hats
  const u3 = fitU(c, 118, 140), g3 = 990;
  ground(ctx, 30, W - 30, g3 + 4, 'r3');
  HATS.forEach(([h, name], i) => {
    const cx = 80 + i * ((W - 160) / (HATS.length - 1));
    critter(ctx, c, cx, g3, u3, combine(feel('calm', t + i), { hat: h, key: 'hat' + i, seed: i, dy: Math.sin(t * 2 + i) * 0.1 }), t + i);
    label(ctx, name, cx, g3 + 28, 18, PAL.ink, 0.65);
  });
  void wob;
  grain(ctx, W, H, 0.35);
}
