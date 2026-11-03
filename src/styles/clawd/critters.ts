// critters.ts — a new cast in the Clawd style: blocky watercolour bodies, stubby legs, arm nubs, slit eyes.
// `u` is the body unit. (x, y) is the point on the ground between the feet. Every view faces screen-right; flip mirrors it.
import { PAL, TAU, boilSeed, clamp, mixCol, rgba, backOut, frac, hash, lerp, random, jit, type View } from './core.ts';
import { paint, inkLine, rectPts, roundRectPts, ellPts, glow, wcolor, type Ctx, type Pt } from './paint.ts';

export type Kind = 'chick' | 'frog' | 'bunny' | 'cat' | 'penguin';
export interface CharDef {
  id: string; name: string; en: string; desc: string; kind: Kind;
  col: string; dk: string; lt: string; accent: string;
  bw: number; bh: number; legH: number; legW: number; legs: number[]; legCol?: string;
  armY: number; armLen: number; armW: number; armCol?: string;
  eyeX: number; eyeY: number; eyeW: number; eyeH: number; mouthY: number; mouthW: number;
  blushX: number; blushY: number; sideK: number;
}

export const CHARS: CharDef[] = [
  {
    id: 'jiu', name: '啾啾', en: 'JIUJIU', kind: 'chick', desc: '一只方方的小黄鸡，头顶三根呆毛，好奇心比身体还大，看到会飞的东西就忍不住要追。',
    col: '#F0BE46', dk: '#C38622', lt: '#FBDB86', accent: PAL.orange,
    bw: 7, bh: 6, legH: 1.9, legW: 0.6, legs: [-1.7, 1.1], legCol: '#E08A3A',
    armY: 2.8, armLen: 1.9, armW: 1.1, eyeX: 1.6, eyeY: 2.0, eyeW: 0.8, eyeH: 1.6, mouthY: 3.45, mouthW: 1.2,
    blushX: 2.5, blushY: 3.3, sideK: 0.8,
  },
  {
    id: 'bean', name: '豆丁', en: 'BEAN', kind: 'frog', desc: '扁扁宽宽的青蛙，眼睛长在两个小方包上。最爱在荷叶上打盹，偶尔一口吞下整只苍蝇。',
    col: '#86B062', dk: '#4F7B3B', lt: '#BCD994', accent: '#B9D98C',
    bw: 10, bh: 5, legH: 1.7, legW: 1.1, legs: [-4.2, -2.2, 1.1, 3.1],
    armY: 2.6, armLen: 2.1, armW: 1, eyeX: 2.8, eyeY: -0.5, eyeW: 0.85, eyeH: 1.5, mouthY: 2.5, mouthW: 2.6,
    blushX: 3.7, blushY: 2.0, sideK: 0.6,
  },
  {
    id: 'mian', name: '棉棉', en: 'MIANMIAN', kind: 'bunny', desc: '粉色方块兔，两只长耳朵会跟着心情立起或耷拉。容易害羞，一害羞耳朵就红透。',
    col: '#F0B4C2', dk: '#C2788F', lt: '#FBDCE3', accent: PAL.rose,
    bw: 7, bh: 7, legH: 1.8, legW: 1.2, legs: [-2.7, 1.5],
    armY: 3.6, armLen: 2, armW: 1, eyeX: 1.6, eyeY: 2.6, eyeW: 0.8, eyeH: 1.6, mouthY: 4.3, mouthW: 1,
    blushX: 2.5, blushY: 3.9, sideK: 0.78,
  },
  {
    id: 'mo', name: '墨球', en: 'MOQIU', kind: 'cat', desc: '紫墨色的方块猫，尖耳朵加一条会摇的方尾巴。表面高冷，其实偷偷跟着大家一起跳舞。',
    col: '#8E72C0', dk: '#5C438E', lt: '#BBA8DF', accent: '#F2C6D8',
    bw: 9, bh: 6, legH: 2, legW: 1, legs: [-3.8, -1.9, 0.9, 2.8],
    armY: 3.2, armLen: 2.1, armW: 1, eyeX: 2.2, eyeY: 2.3, eyeW: 0.85, eyeH: 1.7, mouthY: 3.9, mouthW: 1.2,
    blushX: 3.2, blushY: 3.5, sideK: 0.62,
  },
  {
    id: 'bing', name: '冰冰', en: 'BINGBING', kind: 'penguin', desc: '高高的方块企鹅，奶油色的小肚皮，扁扁的橙色脚丫。走路一摇一摆，最怕热。',
    col: '#46619A', dk: '#28396A', lt: '#7790C2', accent: PAL.cream,
    bw: 7, bh: 8, legH: 0.9, legW: 1.6, legs: [-2.6, 1.0], legCol: '#E8913A',
    armY: 3.4, armLen: 2.1, armW: 0.95, eyeX: 1.5, eyeY: 2.3, eyeW: 0.8, eyeH: 1.6, mouthY: 3.6, mouthW: 1.2,
    blushX: 2.4, blushY: 3.4, sideK: 0.8,
  },
];
export const charById = (id: string) => CHARS.find(c => c.id === id) || CHARS[0];

export type EyeType = 'slit' | 'closed' | 'happy' | 'sad' | 'angry' | 'wide' | 'tiny' | 'heart' | 'spiral' | 'star' | 'sleepy' | 'half' | 'cry' | 'squint' | 'smug' | 'shades' | 'sparkle';
export type MouthType = 'none' | 'smile' | 'grin' | 'o' | 'wail' | 'frown' | 'flat' | 'wavy' | 'teeth' | 'smirk' | 'tongue' | 'cat' | 'drool';
export type Emote = 'none' | '!' | '?' | 'hearts' | 'zzz' | 'sweat' | 'bulb' | 'rain' | 'vein' | 'sparkle' | 'note' | 'stars' | 'steam';
export type Hat = 'none' | 'party' | 'crown' | 'halo' | 'wizard' | 'top' | 'beanie' | 'bow' | 'flower' | 'headphones' | 'band' | 'hard' | 'leaf';

export interface Opts {
  view?: View; flip?: boolean; dx?: number; dy?: number; sq?: number; rot?: number; sx?: number;
  aL?: number; aR?: number; walk?: number; noLegs?: boolean; noShadow?: boolean;
  eyes?: EyeType | [EyeType, EyeType]; mouth?: MouthType; lookX?: number; lookY?: number; blush?: number; gloom?: number;
  tint?: string; tintK?: number; emote?: Emote; emoteK?: number; emoteAge?: number; hat?: Hat;
  smear?: number; smearDir?: number; key?: string; shake?: number; earDroop?: number; tailWag?: number; seed?: number; noBlink?: boolean;
}

const TINT: Record<string, string> = { pale: '#F6E6D2', flush: '#E23E36', blue: '#6D86BE', rosy: '#EF8EA8', green: '#98B25E', gold: '#F0BE46' };

interface ViewCfg { L: number; R: number; strip?: [number, number]; face: null | { cx: number; fw: number; sides: number[] }; mapX: (x: number) => number; hat: number; hw: number; back?: boolean }
function viewCfg(c: CharDef, v: View): ViewCfg {
  const hw = c.bw / 2, sk = c.sideK;
  switch (v) {
    case 'q': return { L: -hw, R: hw + 0.1, strip: [-hw, -hw + c.bw * 0.27], face: { cx: c.bw * 0.15, fw: 0.74, sides: [-1, 1] }, mapX: x => x * 0.9 + c.bw * 0.06, hat: 0.6, hw: 1 };
    case 'side': return { L: -hw * sk, R: hw * sk, face: { cx: hw * sk * 0.42, fw: 0.5, sides: [1] }, mapX: x => x * sk * 0.75, hat: 0.3, hw: 0.75 };
    case 'qback': return { L: -hw - 0.1, R: hw, strip: [hw - c.bw * 0.27, hw], face: null, mapX: x => -x * 0.9 - c.bw * 0.06, hat: -0.4, hw: 1 };
    case 'back': return { L: -hw, R: hw, face: null, mapX: x => -x, hat: 0, hw: 1, back: true };
    default: return { L: -hw, R: hw, face: { cx: 0, fw: 1, sides: [-1, 1] }, mapX: x => x, hat: 0, hw: 1 };
  }
}

const OPEN: MouthType[] = ['grin', 'o', 'wail', 'teeth', 'tongue', 'drool'];

export function critter(ctx: Ctx, c: CharDef, x: number, y: number, u: number, o: Opts = {}, t = 0) {
  const key = o.key ?? c.id, rs = (p: string) => boilSeed(key + ':' + p);
  const view = o.view ?? 'front', V = viewCfg(c, view);
  const sm = clamp(o.smear || 0), sq = o.sq || 0, dyPx = (o.dy || 0) * u;
  x += (o.dx || 0) * u + (o.shake ? Math.sin(t * 60) * o.shake * u : 0);
  const sw = clamp(u * 0.2, 1, 10), J = u * 0.07;
  let col = c.col, dk = c.dk, lt = c.lt;
  const tc = o.tint && (TINT[o.tint] || o.tint), tk = clamp(o.tintK ?? 1);
  if (tc && tk > 0) { col = mixCol(col, tc, 0.5 * tk); dk = mixCol(dk, mixCol(tc, PAL.ink, 0.35), 0.45 * tk); lt = mixCol(lt, mixCol(tc, '#FFFFFF', 0.4), 0.4 * tk); }
  const far = mixCol(dk, PAL.ink, 0.22);
  const flipS = o.flip ? -1 : 1;

  // shadow
  rs('shadow');
  if (!o.noShadow) {
    const f = 1 - Math.min(0.5, Math.abs(o.dy || 0) * 0.07), w = (V.R - V.L) / 10;
    wcolor(ctx, ellPts(x, y + u * 0.15, u * 5.8 * f * Math.max(0.6, w), u * 0.9 * f, 20), '#6E6488', 0.22, 2, u * 0.12, false);
  }
  if (sm > 0.05) {
    rs('smear');
    const dir = o.smearDir ?? flipS;
    for (let i = 0; i < 4; i++) {
      const yy = y + dyPx - (c.legH + c.bh * (0.15 + i * 0.22)) * u, len = (3 + random() * 4) * u * sm;
      ctx.save(); ctx.strokeStyle = rgba(col, 0.5 - i * 0.08); ctx.lineCap = 'round'; ctx.lineWidth = u * (0.8 + random() * 0.6);
      ctx.beginPath(); ctx.moveTo(x - dir * (c.bw * 0.3) * u, yy); ctx.lineTo(x - dir * (c.bw * 0.3 * u + len), yy + jit(u * 0.2)); ctx.stroke(); ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(x, y + dyPx);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(flipS * (o.sx ?? 1) * (1 + sq * 0.6) * (1 + sm * 0.35), 1 - sq);

  const yb = -c.legH * u, yt = -(c.legH + c.bh) * u, L = V.L * u, R = V.R * u;
  const armCol = c.armCol ?? (c.kind === 'penguin' ? c.dk : col);

  const arm = (px: number, dir: number, which: 'L' | 'R', layer: number) => {
    rs('arm' + which);
    const a = which === 'L' ? (o.aL ?? 0.2) : (o.aR ?? 0.2);
    ctx.save();
    ctx.translate(px + dir * 0.5 * u * clamp((Math.abs(a) - 0.7) / 0.9), yt + c.armY * u);
    const wcol = layer === 2 ? mixCol(armCol, dk, 0.4) : armCol;
    if (dir === 0) {
      ctx.translate(0, 0.3 * u); ctx.rotate(0.7 - a);
      paint(ctx, rectPts(-0.2 * u, -c.armW * 0.5 * u, (c.armLen + 0.1) * u, c.armW * u, J * 0.6), { wash: wcol, dk, sw: sw * 0.8, tex: 0.6 });
    } else {
      ctx.rotate(dir < 0 ? a : -a);
      paint(ctx, rectPts(dir < 0 ? -c.armLen * u : 0, -c.armW * 0.5 * u, c.armLen * u, c.armW * u, J * 0.6), { wash: wcol, dk, sw: sw * 0.8, tex: 0.6 });
    }
    ctx.restore();
  };
  const arms: [number, number, 'L' | 'R', number][] =
    view === 'front' ? [[L + 0.1 * u, -1, 'L', 0], [R - 0.1 * u, 1, 'R', 0]] :
    view === 'q' ? [[R, 1, 'R', 2], [L + 0.3 * u, -1, 'L', 1]] :
    view === 'side' ? [[R * 0.35, 0, 'L', 1]] :
    view === 'qback' ? [[L, -1, 'R', 2], [R - 0.3 * u, 1, 'L', 1]] :
    [[L + 0.1 * u, -1, 'R', 0], [R - 0.1 * u, 1, 'L', 0]];

  // --- behind the body: ears, bumps, tail ---
  rs('behind');
  drawBehind(ctx, c, V, view, u, yt, yb, L, R, sw, J, col, dk, lt, o, t);
  arms.filter(a => a[3] !== 1).forEach(a => arm(...a));

  // legs
  if (!o.noLegs) c.legs.forEach((lx, i) => {
    rs('leg' + i);
    let h = c.legH, sx = 0;
    const isFar = view === 'side' ? i % 2 === 0 : (view === 'q' || view === 'qback') && i === 0;
    if (o.walk != null) {
      if (view === 'side') { const ph = (o.walk + (i % 2 ? 0.5 : 0)) * TAU; sx = Math.sin(ph) * 0.55; h = c.legH - Math.max(0, Math.cos(ph)) * c.legH * 0.35; }
      else { const ph = Math.sin((o.walk + (i % 2 ? 0.5 : 0)) * TAU); if (ph > 0) h = c.legH - ph * c.legH * 0.4; }
    }
    const lc = c.legCol ? (isFar ? mixCol(c.legCol, PAL.ink, 0.25) : c.legCol) : (isFar ? far : dk);
    let lxp = V.mapX(lx + c.legW / 2) - c.legW / 2;
    if (view === 'side' && c.legs.length === 2) lxp = (i === 0 ? -1.2 : 0.1) * c.sideK;
    if (c.kind === 'penguin') {
      paint(ctx, rectPts((lxp + sx) * u - (view === 'side' ? 0 : 0.1 * u), yb - 0.2 * u, (view === 'side' ? c.legW * 1.1 : c.legW) * u, (h + 0.2) * u, J * 0.5), { wash: lc, sw: sw * 0.8, tex: 0.4 });
    } else {
      paint(ctx, rectPts((lxp + sx) * u, yb - 0.3 * u, c.legW * u, (h + 0.3) * u, J * 0.6), { wash: lc, sw: sw * 0.8, tex: 0.4 });
    }
  });

  // body
  rs('body');
  const bodyPts = rectPts(L, yt, R - L, c.bh * u, J);
  paint(ctx, bodyPts, { wash: col, dk, lt, sw });
  if (V.strip) {
    rs('strip');
    paint(ctx, rectPts(V.strip[0] * u, yt + sw * 0.4, (V.strip[1] - V.strip[0]) * u, c.bh * u - sw * 0.8, J * 0.4), { wash: mixCol(col, dk, 0.45), ink: null, tex: 0.5 });
    const sx2 = (V.strip[0] === V.L ? V.strip[1] : V.strip[0]) * u;
    inkLine(ctx, [[sx2 + jit(J), yt], [sx2 + jit(J), yt + c.bh * u]], sw * 0.55);
  }
  // penguin belly
  if (c.kind === 'penguin' && !V.back) {
    rs('belly');
    const f = V.face, bw = view === 'side' ? 2.2 : 4.4 * (f ? f.fw : 0.9), bcx = f ? f.cx : (view === 'qback' ? 99 : 0);
    if (bcx !== 99) {
      const bx = view === 'side' ? (V.R - 2.6) * u : (bcx - bw / 2) * u;
      paint(ctx, roundRectPts(bx, yt + 2.9 * u, bw * u, c.bh * u - 3.4 * u, u * 1.2, J * 0.5), { wash: PAL.cream, dk: '#D9C9A8', sw: sw * 0.6, tex: 0.6 });
    }
  }
  // gloom
  if ((o.gloom || 0) > 0.01) {
    rs('gloom');
    ctx.save();
    ctx.beginPath(); ctx.rect(L, yt, R - L, c.bh * u); ctx.clip();
    const g = ctx.createLinearGradient(0, yt, 0, yt + c.bh * u * 0.55);
    g.addColorStop(0, rgba('#3A2F55', 0.55 * o.gloom!)); g.addColorStop(1, rgba('#3A2F55', 0));
    ctx.fillStyle = g; ctx.fillRect(L, yt, R - L, c.bh * u);
    ctx.restore();
    const cx0 = V.face ? V.face.cx : 0;
    for (let i = -1; i <= 1; i++) inkLine(ctx, [[(cx0 + i * 0.9) * u, yt + 0.4 * u], [(cx0 + i * 0.9) * u + jit(1), yt + 1.5 * u]], sw * 0.5, PAL.ink, false, 0.6 * o.gloom!);
  }

  // face
  if (V.face) drawFace(ctx, c, V.face, view, u, yt, sw, o, t);
  // front extras (beak, tail in back view)
  rs('front');
  drawFront(ctx, c, V, view, u, yt, yb, L, R, sw, J, col, dk, o, t);
  arms.filter(a => a[3] === 1).forEach(a => arm(...a));
  if (o.hat && o.hat !== 'none') { rs('hat'); drawHat(ctx, o.hat, V.mapX(0) * 0 + V.hat * u + (V.face ? V.face.cx * u * 0.3 : 0), c.kind === 'frog' ? yt - 0.05 * u : yt, u * V.hw * (c.bw >= 9 ? 1 : 0.85), sw, t, c.kind === 'bunny' ? 0.9 : 1); }
  ctx.restore();

  // emote, in screen space so it never mirrors
  if (o.emote && o.emote !== 'none') {
    rs('emote');
    const topY = y + dyPx + (yt - (c.kind === 'bunny' ? 3.5 * u : c.kind === 'cat' ? 1.6 * u : c.kind === 'frog' ? 1.6 * u : 0.4 * u)) * (1 - sq);
    const ex = x + flipS * (R + 0.3 * u), cx = x + flipS * (V.face ? V.face.cx * u : 0);
    drawEmote(ctx, o.emote, ex, topY, cx, u, clamp(o.emoteK ?? 1), o.emoteAge ?? t, t, sw, flipS);
  }
}

// ---------- extras ----------
function drawBehind(ctx: Ctx, c: CharDef, V: ViewCfg, view: View, u: number, yt: number, yb: number, L: number, R: number, sw: number, J: number, col: string, dk: string, lt: string, o: Opts, t: number) {
  if (c.kind === 'frog') {
    const xs = V.face ? V.face.sides.map(s => V.face!.cx + s * c.eyeX * V.face!.fw) : [-1, 1].map(s => V.mapX(s * c.eyeX));
    const bw = 2.5 * (V.face ? Math.max(0.7, V.face.fw) : 1);
    xs.forEach((bx, i) => {
      paint(ctx, rectPts((bx - bw / 2) * u, yt - 1.7 * u, bw * u, 2.6 * u, J * 0.6), { wash: i === 0 && view === 'q' ? mixCol(col, dk, 0.3) : col, dk, lt, sw: sw * 0.9 });
    });
  }
  if (c.kind === 'bunny') {
    const droop = o.earDroop || 0;
    const xs = view === 'side' ? [-0.6, 0.3] : [-1.7, 1.7].map(x => V.mapX(x));
    xs.forEach((ex, i) => {
      const s = view === 'side' ? 1 : (ex < V.mapX(0) ? -1 : 1);
      const wig = Math.sin(t * 3 + i) * 0.04;
      ctx.save();
      ctx.translate(ex * u, yt + 0.6 * u);
      ctx.rotate(s * (0.08 + droop * 0.95) + wig + (view === 'side' ? -droop * 1.2 - 0.15 : 0));
      const ew = 1.5 * u, eh = 4.6 * u;
      paint(ctx, rectPts(-ew / 2, -eh, ew, eh, J * 0.6), { wash: view === 'side' && i === 0 ? mixCol(col, dk, 0.35) : col, dk, lt, sw: sw * 0.9 });
      if (!V.back && !(view === 'qback')) paint(ctx, rectPts(-ew * 0.22, -eh * 0.85, ew * 0.44, eh * 0.62, J * 0.3), { wash: c.accent, ink: null, tex: 0.4, washOp: 0.75 });
      ctx.restore();
    });
  }
  if (c.kind === 'cat') {
    const ears = view === 'side' ? [[-1.6, 0.6]] : [[V.L + 0.2, V.L + 2.8], [V.R - 2.8, V.R - 0.2]];
    ears.forEach(([a, b], i) => {
      const pk = view === 'side' ? (a + b) / 2 + 0.3 : (i === 0 ? a + 0.6 : b - 0.6);
      const pts: Pt[] = [[a * u, yt + 0.6 * u], [pk * u + (i === 0 ? -1 : 1) * Math.sin(t * 2) * 0.05 * u, yt - 2.3 * u], [b * u, yt + 0.6 * u]];
      paint(ctx, pts.map(([x, y]) => [x + jit(J), y + jit(J)] as Pt), { wash: view === 'q' && i === 0 ? mixCol(col, dk, 0.35) : col, dk, sw: sw * 0.9 });
      if (!V.back && view !== 'qback') {
        const m = (a + b) / 2;
        paint(ctx, [[(m - 0.6) * u + (pk - m) * 0.2 * u, yt + 0.2 * u], [pk * u, yt - 1.4 * u], [(m + 0.6) * u + (pk - m) * 0.2 * u, yt + 0.2 * u]], { wash: c.accent, ink: null, tex: 0.3, washOp: 0.8 });
      }
    });
    if (!V.back) drawTail(ctx, c, view, u, yt, yb, L, R, sw, col, dk, o, t);
  }
  if (c.kind === 'chick') {
    const tx = V.mapX(0) + (V.face ? V.face.cx * 0.2 : 0);
    [-0.6, 0, 0.6].forEach((k, i) => {
      const bx = (tx + k * 0.7) * u, h = (1.3 + (i === 1 ? 0.5 : 0)) * u, sway = Math.sin(t * 4 + i) * 0.15 * u;
      inkLine(ctx, [[bx, yt + 0.2 * u], [bx + k * 0.5 * u + sway, yt - h * 0.6], [bx + k * 0.9 * u + sway * 1.6 + 0.3 * u, yt - h]], sw * 0.9);
    });
  }
}

function drawTail(ctx: Ctx, _c: CharDef, view: View, u: number, _yt: number, yb: number, L: number, R: number, sw: number, col: string, dk: string, o: Opts, t: number) {
  const wag = Math.sin(t * (o.tailWag ?? 2.2) * Math.PI) * 0.6;
  const base: Pt = view === 'front' ? [R - 1.5 * u, yb - 1.4 * u] : view === 'back' ? [0, yb - 1.4 * u] : view === 'qback' ? [R - 1.2 * u, yb - 1.4 * u] : [L + 1.2 * u, yb - 1.4 * u];
  const dir = view === 'front' || view === 'qback' ? 1 : view === 'back' ? 0.4 : -1;
  const p1: Pt = [base[0] + dir * 2.4 * u, base[1] - 0.6 * u];
  const p2: Pt = [p1[0] + dir * 0.9 * u + wag * u, p1[1] - 2.2 * u];
  const p3: Pt = [p2[0] - dir * 0.2 * u + wag * 1.6 * u, p2[1] - 1.1 * u];
  const pts: Pt[] = [base, p1, p2, p3].map(([x, y]) => [x + jit(u * 0.05), y + jit(u * 0.05)]);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = u * 0.95 + sw * 2;
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.strokeStyle = view === 'front' ? mixCol(col, dk, 0.25) : col; ctx.lineWidth = u * 0.95;
  ctx.stroke();
  ctx.restore();
}

function drawFront(ctx: Ctx, c: CharDef, V: ViewCfg, view: View, u: number, yt: number, yb: number, L: number, R: number, sw: number, J: number, col: string, dk: string, o: Opts, t: number) {
  if (c.kind === 'cat' && V.back) drawTail(ctx, c, view, u, yt, yb, L, R, sw, col, dk, o, t);
  if ((c.kind === 'chick' || c.kind === 'penguin') && V.face) {
    const open = OPEN.includes(o.mouth || 'none') ? (o.mouth === 'wail' || o.mouth === 'o' ? 1 : 0.6) : 0;
    const by = yt + c.mouthY * u, bc = c.kind === 'chick' ? PAL.orange : '#F0A040';
    if (view === 'side') {
      const bx = R - 0.1 * u;
      paint(ctx, [[bx, by - 0.5 * u - open * 0.2 * u], [bx + 1.4 * u, by - open * 0.2 * u], [bx, by + 0.1 * u]], { wash: bc, sw: sw * 0.75, tex: 0.4 });
      if (open) paint(ctx, [[bx, by + 0.2 * u], [bx + 1.1 * u, by + 0.3 * u + open * 0.3 * u], [bx, by + 0.6 * u + open * 0.3 * u]], { wash: bc, sw: sw * 0.75, tex: 0.4 });
    } else {
      const bx = V.face.cx * u, w = 0.8 * u * Math.max(0.75, V.face.fw);
      if (open) {
        paint(ctx, ellPts(bx, by + 0.45 * u, w * 0.75, (0.35 + open * 0.35) * u, 12, J * 0.3), { wash: PAL.mouth, sw: sw * 0.6, tex: 0.2 });
        paint(ctx, [[bx - w, by], [bx + w, by], [bx, by + 0.45 * u]], { wash: bc, sw: sw * 0.75, tex: 0.4 });
        paint(ctx, [[bx - w * 0.8, by + 0.75 * u + open * 0.3 * u], [bx + w * 0.8, by + 0.75 * u + open * 0.3 * u], [bx, by + 1.05 * u + open * 0.3 * u]], { wash: bc, sw: sw * 0.7, tex: 0.4 });
      } else {
        paint(ctx, [[bx - w, by], [bx + w, by], [bx + jit(J), by + 1.0 * u]], { wash: bc, sw: sw * 0.75, tex: 0.4 });
      }
    }
  }
}

// ---------- face ----------
function drawFace(ctx: Ctx, c: CharDef, F: { cx: number; fw: number; sides: number[] }, _view: View, u: number, yt: number, sw: number, o: Opts, t: number) {
  boilSeed((o.key ?? c.id) + ':face');
  const lx = clamp(o.lookX || 0, -1, 1) * 0.45 * u, ly = clamp(o.lookY || 0, -1, 1) * (c.kind === 'frog' ? 0.18 : 0.4) * u;
  let eyes = o.eyes ?? 'slit';
  const seed = o.seed ?? hash(c.id.length * 3.3) * 5;
  const blink = !o.noBlink && frac((t + seed) / 3.4) < 0.045;
  const pair: [EyeType, EyeType] = Array.isArray(eyes) ? eyes : [eyes, eyes];
  const ey = yt + c.eyeY * u;
  // blush
  if ((o.blush || 0) > 0.01) F.sides.forEach(s => {
    const bx = (F.cx + s * c.blushX * F.fw) * u;
    wcolor(ctx, ellPts(bx, yt + c.blushY * u, 0.85 * u * Math.max(0.6, F.fw), 0.45 * u, 14), PAL.rose, 0.55 * o.blush!, 2, u * 0.08, false);
  });
  if (pair[0] === 'shades' && F.sides.length === 2) {
    const x0 = (F.cx - (c.eyeX + 0.9) * F.fw) * u, x1 = (F.cx + (c.eyeX + 0.9) * F.fw) * u;
    inkLine(ctx, [[x0 - 0.3 * u, ey - 0.4 * u], [x1 + 0.3 * u, ey - 0.4 * u]], sw * 0.9);
    F.sides.forEach(s => {
      const ex = (F.cx + s * c.eyeX * F.fw) * u;
      paint(ctx, roundRectPts(ex - 0.95 * u * F.fw, ey - 0.5 * u, 1.9 * u * F.fw, 1.3 * u, 0.4 * u, u * 0.04), { wash: '#2E2A44', sw: sw * 0.7, tex: 0.3 });
      inkLine(ctx, [[ex - 0.5 * u * F.fw, ey - 0.25 * u], [ex - 0.1 * u * F.fw, ey - 0.25 * u]], sw * 0.4, PAL.cream, false, 0.8);
    });
  } else {
    F.sides.forEach(s => {
      const ex = (F.cx + s * c.eyeX * F.fw) * u;
      let ty = pair[s < 0 ? 0 : 1];
      if (ty === 'shades') ty = 'slit';
      if (blink && (ty === 'slit' || ty === 'wide' || ty === 'sparkle' || ty === 'tiny')) ty = 'closed';
      drawEye(ctx, ty, ex + lx, ey + ly, c.eyeW * u * Math.max(0.75, F.fw), c.eyeH * u, s, sw, t, u);
    });
  }
  if (c.kind !== 'chick' && c.kind !== 'penguin') {
    const mx = (F.cx + (F.sides.length === 1 ? 0.9 : 0)) * u + lx * 0.4;
    drawMouth(ctx, o.mouth ?? 'smile', mx, yt + c.mouthY * u, c.mouthW * u * (F.sides.length === 1 ? 0.6 : F.fw), u, sw, t, c.kind === 'cat');
  } else if (o.mouth === 'drool' || o.mouth === 'tongue') {
    const mx = F.cx * u;
    if (o.mouth === 'drool') paint(ctx, ellPts(mx + 0.4 * u, yt + (c.mouthY + 1.5 + frac(t) * 0.4) * u, 0.2 * u, 0.32 * u, 10), { wash: PAL.sky, sw: sw * 0.4, tex: 0.2 });
  }
}

function drawEye(ctx: Ctx, ty: EyeType, ex: number, ey: number, w: number, h: number, s: number, sw: number, t: number, u: number) {
  const ink = PAL.ink;
  const slit = (ww: number, hh: number, oy = 0, hl = true) => {
    paint(ctx, rectPts(ex - ww / 2, ey - hh / 2 + oy, ww, hh, u * 0.04), { wash: ink, ink: null, tex: 0 });
    if (hl) paint(ctx, rectPts(ex + ww * 0.02, ey - hh / 2 + oy + hh * 0.1, ww * 0.36, ww * 0.36, 0), { wash: PAL.cream, ink: null, tex: 0 });
  };
  switch (ty) {
    case 'closed': inkLine(ctx, [[ex - w * 0.75, ey + h * 0.1], [ex + w * 0.75, ey + h * 0.1 + jit(1)]], sw * 0.9); break;
    case 'happy': inkLine(ctx, [[ex - w * 0.95, ey + h * 0.2], [ex, ey - h * 0.28], [ex + w * 0.95, ey + h * 0.2]], sw); break;
    case 'sad':
      slit(w * 0.9, h * 0.65, h * 0.15);
      inkLine(ctx, [[ex - s * w * 0.9, ey - h * 0.65], [ex + s * w * 0.9, ey - h * 0.35]], sw * 0.8); break;
    case 'angry':
      slit(w, h * 0.75, h * 0.12, false);
      inkLine(ctx, [[ex - s * w * 1.0, ey - h * 0.22], [ex + s * w * 1.0, ey - h * 0.75]], sw * 1.1); break;
    case 'wide': slit(w * 1.3, h * 1.25); paint(ctx, rectPts(ex - w * 0.5, ey + h * 0.3, w * 0.2, w * 0.2, 0), { wash: PAL.cream, ink: null, tex: 0 }); break;
    case 'sparkle': {
      slit(w * 1.3, h * 1.25, 0, false);
      star(ctx, ex + w * 0.15, ey - h * 0.2, w * 0.45, PAL.cream, 0, 0);
      paint(ctx, rectPts(ex - w * 0.4, ey + h * 0.25, w * 0.22, w * 0.22, 0), { wash: PAL.cream, ink: null, tex: 0 });
      break;
    }
    case 'tiny': slit(w * 0.6, h * 0.55, 0, false); break;
    case 'heart': {
      const k = 1 + Math.sin(t * 10) * 0.08;
      heart(ctx, ex, ey, w * 1.15 * k, PAL.rose, sw * 0.6); break;
    }
    case 'spiral': {
      const pts: Pt[] = [];
      for (let i = 0; i < 26; i++) { const a = i * 0.55 + t * 8 * s, r = (i / 26) * w * 1.1; pts.push([ex + Math.cos(a) * r, ey + Math.sin(a) * r]); }
      inkLine(ctx, pts, sw * 0.7); break;
    }
    case 'star': star(ctx, ex, ey, w * 1.1 * (1 + Math.sin(t * 9) * 0.1), PAL.ochre, sw * 0.6, t * 2); break;
    case 'sleepy':
      paint(ctx, rectPts(ex - w / 2, ey, w, h * 0.42, u * 0.03), { wash: ink, ink: null, tex: 0 });
      inkLine(ctx, [[ex - w * 0.85, ey], [ex + w * 0.85, ey]], sw * 0.9); break;
    case 'half':
      paint(ctx, rectPts(ex - w / 2, ey - h * 0.1, w, h * 0.55, u * 0.03), { wash: ink, ink: null, tex: 0 });
      inkLine(ctx, [[ex - w * 0.9, ey - h * 0.12], [ex + w * 0.9, ey - h * 0.12]], sw); break;
    case 'smug':
      paint(ctx, rectPts(ex - w / 2 + w * 0.2, ey - h * 0.05, w, h * 0.5, u * 0.03), { wash: ink, ink: null, tex: 0 });
      inkLine(ctx, [[ex - w * 0.9, ey - h * 0.15 - s * h * 0.05], [ex + w * 1.1, ey - h * 0.05 + s * h * 0.05]], sw); break;
    case 'squint':
      inkLine(ctx, [[ex - s * w * 0.8, ey - h * 0.35], [ex + s * w * 0.6, ey], [ex - s * w * 0.8, ey + h * 0.35]], sw); break;
    case 'cry': {
      inkLine(ctx, [[ex - s * w * 0.8, ey - h * 0.3], [ex + s * w * 0.6, ey], [ex - s * w * 0.8, ey + h * 0.3]], sw);
      ctx.save(); ctx.globalAlpha = 0.75;
      const tw = w * 0.8;
      paint(ctx, rectPts(ex - tw / 2 + s * w * 0.1, ey + h * 0.35, tw, h * 1.6 + Math.sin(t * 12) * h * 0.1, u * 0.05), { wash: PAL.sky, ink: null, tex: 0.3 });
      ctx.restore();
      const k = frac(t * 2.2 + (s > 0 ? 0.5 : 0));
      paint(ctx, ellPts(ex + s * w * 1.2, ey + h * (0.3 + k * 1.6), w * 0.28, w * 0.38, 10), { wash: PAL.sky, sw: sw * 0.4, tex: 0.2 });
      break;
    }
    default: slit(w, h);
  }
}

function drawMouth(ctx: Ctx, ty: MouthType, mx: number, my: number, mw: number, u: number, sw: number, t: number, cat: boolean) {
  const J = u * 0.04;
  switch (ty) {
    case 'none': break;
    case 'smile':
      if (cat) { drawMouth(ctx, 'cat', mx, my, mw, u, sw, t, false); break; }
      inkLine(ctx, [[mx - mw / 2, my - 0.1 * u], [mx - mw * 0.2, my + 0.25 * u], [mx + mw * 0.2, my + 0.25 * u], [mx + mw / 2, my - 0.1 * u]], sw * 0.8); break;
    case 'cat':
      inkLine(ctx, [[mx - mw / 2, my], [mx - mw / 4, my + 0.3 * u], [mx, my], [mx + mw / 4, my + 0.3 * u], [mx + mw / 2, my]], sw * 0.75); break;
    case 'grin': {
      const pts: Pt[] = [[mx - mw / 2, my - 0.15 * u]];
      for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; pts.push([mx - Math.cos(a) * mw / 2 + jit(J), my - 0.15 * u + Math.sin(a) * mw * 0.45]); }
      paint(ctx, pts, { wash: PAL.mouth, sw: sw * 0.75, tex: 0.3 });
      paint(ctx, ellPts(mx, my + mw * 0.2, mw * 0.22, mw * 0.1, 10), { wash: PAL.tongue, ink: null, tex: 0 });
      break;
    }
    case 'o': paint(ctx, ellPts(mx, my + 0.15 * u, 0.32 * u, 0.42 * u, 12, J), { wash: PAL.mouth, sw: sw * 0.75, tex: 0.2 }); break;
    case 'wail': paint(ctx, ellPts(mx, my + 0.3 * u, mw * 0.45, (0.55 + Math.sin(t * 14) * 0.08) * u, 14, J), { wash: PAL.mouth, sw: sw * 0.8, tex: 0.2 }); break;
    case 'frown':
      inkLine(ctx, [[mx - mw / 2, my + 0.3 * u], [mx - mw * 0.2, my], [mx + mw * 0.2, my], [mx + mw / 2, my + 0.3 * u]], sw * 0.8); break;
    case 'flat': inkLine(ctx, [[mx - mw * 0.4, my + 0.1 * u], [mx + mw * 0.4, my + 0.1 * u + jit(J)]], sw * 0.8); break;
    case 'wavy': {
      const pts: Pt[] = [];
      for (let i = 0; i <= 6; i++) pts.push([mx - mw / 2 + (i / 6) * mw, my + 0.1 * u + (i % 2 ? -0.15 : 0.15) * u]);
      inkLine(ctx, pts, sw * 0.7); break;
    }
    case 'teeth': {
      paint(ctx, rectPts(mx - mw / 2, my - 0.2 * u, mw, 0.7 * u, J), { wash: PAL.cream, sw: sw * 0.7, tex: 0.2 });
      const pts: Pt[] = [];
      for (let i = 0; i <= 6; i++) pts.push([mx - mw / 2 + (i / 6) * mw, my + 0.15 * u + (i % 2 ? -0.18 : 0.18) * u]);
      inkLine(ctx, pts, sw * 0.5); break;
    }
    case 'smirk':
      inkLine(ctx, [[mx - mw * 0.45, my + 0.15 * u], [mx + mw * 0.15, my + 0.2 * u], [mx + mw * 0.5, my - 0.15 * u]], sw * 0.8); break;
    case 'tongue':
      paint(ctx, rectPts(mx - mw * 0.05, my + 0.1 * u, mw * 0.35, 0.6 * u, J), { wash: PAL.tongue, sw: sw * 0.6, tex: 0.2 });
      inkLine(ctx, [[mx - mw / 2, my - 0.05 * u], [mx, my + 0.15 * u], [mx + mw / 2, my - 0.05 * u]], sw * 0.8); break;
    case 'drool':
      paint(ctx, ellPts(mx, my + 0.15 * u, 0.3 * u, 0.36 * u, 12, J), { wash: PAL.mouth, sw: sw * 0.7, tex: 0.2 });
      paint(ctx, ellPts(mx + 0.35 * u, my + (0.6 + frac(t) * 0.5) * u, 0.18 * u, 0.28 * u, 10), { wash: PAL.sky, sw: sw * 0.4, tex: 0.2 }); break;
  }
}

// ---------- shapes ----------
export function heart(ctx: Ctx, x: number, y: number, s: number, col: string, sw: number) {
  const pts: Pt[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU, hx = 16 * Math.pow(Math.sin(a), 3), hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
    pts.push([x + (hx / 17) * s * 0.6 + jit(s * 0.03), y + (hy / 17) * s * 0.6 + jit(s * 0.03)]);
  }
  paint(ctx, pts, { wash: col, sw, tex: 0.5 });
}
export function star(ctx: Ctx, x: number, y: number, r: number, col: string, sw: number, rot = 0, n = 4) {
  const pts: Pt[] = [];
  for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * TAU - Math.PI / 2, rr = i % 2 ? r * 0.38 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  paint(ctx, pts, { wash: col, sw, ink: sw > 0 ? PAL.ink : null, tex: 0.3 });
}

// ---------- hats ----------
export function drawHat(ctx: Ctx, h: Hat, hx: number, yt: number, u: number, sw: number, t: number, sc = 1) {
  const J = u * 0.05, S = sw * 0.85;
  u *= sc;
  switch (h) {
    case 'party':
      paint(ctx, [[hx - 1.5 * u, yt + 0.2 * u], [hx + jit(J), yt - 3.6 * u], [hx + 1.5 * u, yt + 0.2 * u]], { wash: PAL.rose, sw: S });
      inkLine(ctx, [[hx - 0.9 * u, yt - 1 * u], [hx + 0.7 * u, yt - 1.7 * u]], S * 0.6, PAL.cream);
      paint(ctx, ellPts(hx, yt - 3.8 * u, 0.45 * u, 0.45 * u, 10, J), { wash: PAL.ochre, sw: S }); break;
    case 'crown': {
      const pts: Pt[] = [[hx - 1.9 * u, yt + 0.2 * u], [hx - 1.9 * u, yt - 1.6 * u], [hx - 1.1 * u, yt - 0.7 * u], [hx - 0.4 * u, yt - 1.9 * u], [hx + 0.4 * u, yt - 0.7 * u], [hx + 1.1 * u, yt - 1.9 * u], [hx + 1.9 * u, yt - 0.7 * u], [hx + 1.9 * u, yt + 0.2 * u]];
      paint(ctx, pts.map(([a, b]) => [a + jit(J), b + jit(J)] as Pt), { wash: PAL.ochre, sw: S });
      paint(ctx, ellPts(hx, yt - 0.5 * u, 0.3 * u, 0.3 * u, 8), { wash: PAL.rose, sw: S * 0.5 }); break;
    }
    case 'halo':
      glow(ctx, hx, yt - 1.4 * u, 3 * u, '#FFD27A', 0.6);
      ctx.save(); ctx.strokeStyle = PAL.ochre; ctx.lineWidth = u * 0.4; ctx.beginPath(); ctx.ellipse(hx, yt - 1.4 * u + Math.sin(t * 3) * 0.15 * u, 1.9 * u, 0.5 * u, 0, 0, TAU); ctx.stroke(); ctx.restore();
      inkLine(ctx, ellPts(hx, yt - 1.4 * u + Math.sin(t * 3) * 0.15 * u, 2.1 * u, 0.7 * u, 22), S * 0.4, PAL.ink, true, 0.5); break;
    case 'wizard':
      paint(ctx, [[hx - 2.6 * u, yt + 0.2 * u], [hx + 0.3 * u + Math.sin(t * 2) * 0.3 * u, yt - 4.6 * u], [hx + 2.6 * u, yt + 0.2 * u]], { wash: PAL.indigo, sw: S });
      star(ctx, hx + 0.1 * u, yt - 1.6 * u, 0.6 * u, PAL.ochre, 0, 0, 5); break;
    case 'top':
      paint(ctx, rectPts(hx - 2.4 * u, yt - 0.5 * u, 4.8 * u, 0.7 * u, J), { wash: '#3B2E45', sw: S });
      paint(ctx, rectPts(hx - 1.5 * u, yt - 3.3 * u, 3 * u, 2.9 * u, J), { wash: '#3B2E45', sw: S });
      paint(ctx, rectPts(hx - 1.5 * u, yt - 1.3 * u, 3 * u, 0.6 * u, J * 0.5), { wash: '#C9414A', ink: null, tex: 0.2 }); break;
    case 'beanie':
      paint(ctx, roundRectPts(hx - 2.2 * u, yt - 2.2 * u, 4.4 * u, 2.6 * u, 1.3 * u, J), { wash: PAL.teal, sw: S });
      paint(ctx, rectPts(hx - 2.4 * u, yt - 0.5 * u, 4.8 * u, 0.9 * u, J), { wash: mixCol(PAL.teal, PAL.ink, 0.25), sw: S });
      paint(ctx, ellPts(hx, yt - 2.4 * u, 0.6 * u, 0.6 * u, 10, J), { wash: PAL.cream, sw: S }); break;
    case 'bow':
      paint(ctx, [[hx + 0.4 * u, yt - 0.3 * u], [hx + 1.9 * u, yt - 1.2 * u], [hx + 1.9 * u, yt + 0.6 * u]], { wash: PAL.rose, sw: S * 0.8 });
      paint(ctx, [[hx + 0.4 * u, yt - 0.3 * u], [hx - 1.1 * u, yt - 1.2 * u], [hx - 1.1 * u, yt + 0.6 * u]], { wash: PAL.rose, sw: S * 0.8 });
      paint(ctx, ellPts(hx + 0.4 * u, yt - 0.3 * u, 0.4 * u, 0.4 * u, 8), { wash: mixCol(PAL.rose, PAL.ink, 0.2), sw: S * 0.6 }); break;
    case 'flower':
      inkLine(ctx, [[hx + 0.3 * u, yt + 0.1 * u], [hx + 0.5 * u, yt - 1.4 * u]], S * 0.7, PAL.sap);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + t; paint(ctx, ellPts(hx + 0.5 * u + Math.cos(a) * 0.55 * u, yt - 1.7 * u + Math.sin(a) * 0.55 * u, 0.42 * u, 0.42 * u, 8), { wash: PAL.cream, sw: S * 0.5 }); }
      paint(ctx, ellPts(hx + 0.5 * u, yt - 1.7 * u, 0.35 * u, 0.35 * u, 8), { wash: PAL.ochre, sw: S * 0.5 }); break;
    case 'leaf':
      inkLine(ctx, [[hx, yt + 0.1 * u], [hx + 0.2 * u, yt - 1.2 * u]], S * 0.7);
      paint(ctx, [[hx + 0.2 * u, yt - 1.2 * u], [hx + 1.4 * u, yt - 2.2 * u], [hx + 2.4 * u, yt - 1.6 * u], [hx + 1.2 * u, yt - 0.9 * u]], { wash: PAL.sap, sw: S * 0.7 }); break;
    case 'headphones':
      inkLine(ctx, [[hx - 3 * u, yt + 1.2 * u], [hx - 2.6 * u, yt - 1.1 * u], [hx, yt - 1.8 * u], [hx + 2.6 * u, yt - 1.1 * u], [hx + 3 * u, yt + 1.2 * u]], u * 0.45, '#3B2E45');
      paint(ctx, roundRectPts(hx - 3.6 * u, yt + 0.4 * u, 1.3 * u, 2 * u, 0.4 * u, J), { wash: PAL.violet, sw: S });
      paint(ctx, roundRectPts(hx + 2.3 * u, yt + 0.4 * u, 1.3 * u, 2 * u, 0.4 * u, J), { wash: PAL.violet, sw: S }); break;
    case 'band':
      paint(ctx, rectPts(hx - 3.4 * u, yt + 0.25 * u, 6.8 * u, 0.75 * u, J), { wash: '#D9474F', sw: S * 0.7 }); break;
    case 'hard':
      paint(ctx, [...Array.from({ length: 9 }, (_, i) => { const a = Math.PI + (i / 8) * Math.PI; return [hx + Math.cos(a) * 2.1 * u + jit(J), yt - 0.3 * u + Math.sin(a) * 1.9 * u] as Pt; })], { wash: '#F0C43C', sw: S });
      paint(ctx, rectPts(hx - 2.7 * u, yt - 0.5 * u, 5.4 * u, 0.6 * u, J), { wash: '#E0AE2A', sw: S }); break;
  }
}

// ---------- emotes (painted marks, never letters) ----------
export function drawEmote(ctx: Ctx, e: Emote, ex: number, ey: number, cx: number, u: number, k: number, age: number, t: number, sw: number, fs: number) {
  const pop = backOut(k), S = sw * 0.8;
  if (pop <= 0.01) return;
  ctx.save();
  const at = (x: number, y: number) => { ctx.translate(x, y); ctx.scale(pop, pop); };
  switch (e) {
    case '!': {
      at(ex, ey - 1 * u); ctx.rotate(0.15 * fs + Math.sin(t * 8) * 0.05);
      paint(ctx, [[-0.55 * u, -3.4 * u], [0.55 * u, -3.4 * u], [0.25 * u, -0.9 * u], [-0.25 * u, -0.9 * u]], { wash: PAL.ochre, sw: S });
      paint(ctx, ellPts(0, 0, 0.42 * u, 0.42 * u, 10), { wash: PAL.ochre, sw: S }); break;
    }
    case '?': {
      at(ex, ey - 1 * u); ctx.rotate(0.12 * fs + Math.sin(t * 3) * 0.12);
      const pts: Pt[] = [];
      for (let i = 0; i <= 10; i++) { const a = Math.PI * 1.05 - (i / 10) * Math.PI * 1.45; pts.push([Math.cos(a) * 1.0 * u, -2.6 * u + Math.sin(a) * -1.0 * u]); }
      pts.push([0, -1.0 * u]);
      inkLine(ctx, pts, u * 0.42 + S, PAL.ink);
      inkLine(ctx, pts, u * 0.42, PAL.teal);
      paint(ctx, ellPts(0, 0, 0.36 * u, 0.36 * u, 10), { wash: PAL.teal, sw: S }); break;
    }
    case 'hearts': {
      ctx.translate(ex - fs * 0.5 * u, ey);
      for (let i = 0; i < 3; i++) {
        const p = frac(age * 0.6 + i / 3), s = Math.sin(p * Math.PI);
        ctx.save(); ctx.globalAlpha = clamp(s * 1.6) * clamp(k * 2);
        heart(ctx, Math.sin((p + i) * 5) * 0.9 * u + (i - 1) * 0.8 * u * fs, -p * 4 * u, (0.9 + s * 0.6) * u, PAL.rose, S * 0.8); ctx.restore();
      }
      break;
    }
    case 'zzz': {
      ctx.translate(ex, ey);
      for (let i = 0; i < 3; i++) {
        const p = frac(age * 0.35 + i / 3), s = (0.5 + p * 0.9) * u;
        ctx.save(); ctx.globalAlpha = Math.sin(p * Math.PI) * k;
        const zx = fs * (p * 2.5 * u) + Math.sin(p * 6) * 0.4 * u, zy = -p * 4.5 * u;
        inkLine(ctx, [[zx - s, zy - s], [zx + s, zy - s], [zx - s, zy + s], [zx + s, zy + s]], S * (0.6 + p * 0.5), PAL.indigo);
        ctx.restore();
      }
      break;
    }
    case 'sweat': {
      const p = frac(age * 0.8);
      at(ex - fs * 0.6 * u, ey + 1.6 * u + p * 1.2 * u);
      const pts: Pt[] = [[0, -1.1 * u]];
      for (let i = 0; i <= 10; i++) { const a = -0.2 + (i / 10) * (Math.PI + 0.4); pts.push([Math.cos(a) * 0.55 * u, Math.sin(a) * 0.6 * u]); }
      paint(ctx, pts, { wash: PAL.sky, sw: S * 0.8 });
      break;
    }
    case 'bulb': {
      at(cx, ey - 2.6 * u);
      glow(ctx, 0, 0, 5 * u * (0.9 + Math.sin(t * 6) * 0.1), '#FFD27A', 0.9);
      paint(ctx, ellPts(0, 0, 1.3 * u, 1.35 * u, 18), { wash: '#FBD86A', sw: S });
      paint(ctx, rectPts(-0.6 * u, 1.1 * u, 1.2 * u, 0.9 * u, u * 0.04), { wash: '#9C8F9E', sw: S });
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55; inkLine(ctx, [[Math.cos(a) * 1.8 * u, Math.sin(a) * 1.8 * u], [Math.cos(a) * 2.5 * u, Math.sin(a) * 2.5 * u]], S * 0.7, PAL.ochre); }
      break;
    }
    case 'rain': {
      at(cx, ey - 2 * u);
      for (let i = 0; i < 6; i++) {
        const p = frac(age * 1.4 + hash(i) ), rx = (-1.6 + i * 0.65) * u;
        inkLine(ctx, [[rx, 0.6 * u + p * 3 * u], [rx - 0.15 * u, 1.1 * u + p * 3 * u]], S * 0.6, '#6D86BE', false, 1 - p);
      }
      [[-1.1, 0, 1.1], [0.2, -0.5, 1.3], [1.3, 0.1, 1.0]].forEach(([bx, by, r]) => blob(ctx, bx * u, by * u, r * u, r * 0.8 * u, '#8D8FAF', 0.9));
      inkLine(ctx, ellPts(0, -0.1 * u, 2.6 * u, 1.0 * u, 20), S * 0.5, PAL.ink, true, 0.5); break;
    }
    case 'vein': {
      at(ex - fs * 0.4 * u, ey + 0.8 * u); const s = 1 + Math.sin(t * 14) * 0.1; ctx.scale(s, s);
      for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.rotate((i * Math.PI) / 2);
        inkLine(ctx, [[0.3 * u, -1.0 * u], [0.3 * u, -0.3 * u], [1.0 * u, -0.3 * u]], u * 0.3, '#D9474F'); ctx.restore();
      }
      break;
    }
    case 'sparkle': {
      ctx.translate(ex, ey);
      [[0, -0.5, 1.1, 0], [1.4, 0.7, 0.6, 0.4], [-0.6, -2.2, 0.55, 0.7]].forEach(([sx, sy, r, ph]) => {
        const s = 0.6 + 0.4 * Math.abs(Math.sin((t + ph) * 4));
        star(ctx, fs * sx * u, sy * u, r * u * s * pop, '#FBE39A', S * 0.6, 0);
      });
      break;
    }
    case 'note': {
      ctx.translate(ex, ey);
      for (let i = 0; i < 2; i++) {
        const p = frac(age * 0.5 + i * 0.5), nx = fs * (p * 2.2 * u) + Math.sin(p * 7) * 0.5 * u, ny = -p * 4 * u;
        ctx.save(); ctx.globalAlpha = Math.sin(p * Math.PI) * k;
        paint(ctx, ellPts(nx, ny, 0.5 * u, 0.4 * u, 10), { wash: PAL.violet, sw: S * 0.6 });
        inkLine(ctx, [[nx + 0.45 * u, ny], [nx + 0.45 * u, ny - 1.7 * u], [nx + 1.1 * u, ny - 1.3 * u]], S * 0.8);
        ctx.restore();
      }
      break;
    }
    case 'stars': {
      ctx.translate(cx, ey - 0.6 * u);
      for (let i = 0; i < 4; i++) {
        const a = t * 3 + (i / 4) * TAU;
        star(ctx, Math.cos(a) * 2.8 * u * pop, Math.sin(a) * 0.8 * u, 0.6 * u * pop, i % 2 ? PAL.ochre : '#FBE39A', S * 0.6, a);
      }
      break;
    }
    case 'steam': {
      ctx.translate(cx, ey);
      for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 2; i++) {
        const p = frac(age * 1.2 + i * 0.5);
        ctx.save(); ctx.globalAlpha = (1 - p) * k;
        blob(ctx, s * (2.2 + p * 1.5) * u, -p * 2.6 * u, (0.6 + p * 0.7) * u, (0.5 + p * 0.6) * u, '#E8E2E6', 0.95);
        inkLine(ctx, ellPts(s * (2.2 + p * 1.5) * u, -p * 2.6 * u, (0.6 + p * 0.7) * u, (0.5 + p * 0.6) * u, 12), S * 0.4, PAL.ink, true, 0.5);
        ctx.restore();
      }
      break;
    }
  }
  ctx.restore();
}

function blob(ctx: Ctx, x: number, y: number, rx: number, ry: number, col: string, op: number) {
  wcolor(ctx, ellPts(x, y, rx, ry, 14), col, op, 2, Math.min(rx, ry) * 0.08, false);
}
export const lerpN = lerp;
