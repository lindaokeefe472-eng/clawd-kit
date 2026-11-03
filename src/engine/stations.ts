// Workstation library: each station = one step of the explained process (art ported from 4a tileWorld)
import { C, clamp, snapToPixel } from './palette.ts';
import { PixelSurface } from './surface.ts';
import { TINT_RAMP, drawDustPuff, drawItem, drawPixelGear } from './sprites.ts';
import type { Bounds, Tint } from './sprites.ts';

export const STATION_TYPES = ['gate', 'bench', 'greenhouse', 'furnace', 'mill', 'tower', 'shelf', 'crystal'] as const;
export type StationType = (typeof STATION_TYPES)[number];

/** Suggested metaphor per station type — used by the 文案拆解 stage to map concepts */
export const STATION_MEANING: Record<StationType, string> = {
  gate: '入口/来源/原料进场',
  bench: '切分/分拣/读取/输入处理',
  greenhouse: '分析/理解/结构生长/解析',
  furnace: '变换/计算/燃烧/合成',
  mill: '输出/编码/动力/打包',
  tower: '目标/结果/核心机器/终点',
  shelf: '存储/档案/寄存/库',
  crystal: '记忆/能量/缓存/数据阵列',
};

export interface StationDraw {
  /** 0..1 stepped build progress (0 = not there) */
  build: number;
  /** Machine running (animations, glow) */
  active: boolean;
  /** Accent tint for glass/crystals/screen */
  tint: Tint;
  /** Short ASCII text shown on the station's screen/window (tower, mill, shelf) */
  screen?: string;
  /** 0..1 intensity boost (furnace roar, crystal glow, tree growth in greenhouse) */
  power: number;
  /** Time-of-day 0..1, windows glow more at night */
  tod: number;
}

/** Half-width of every station footprint; layout spacing must be >= 2*HALF_W + 16 */
export const STATION_HALF_W = 34;
/** Tallest station height above its base line */
export const STATION_MAX_H = 84;

/** Draw station centered on cx with its ground line at baseY. Returns its visual bounds. */
export function drawStation(
  s: PixelSurface,
  type: StationType,
  cx: number,
  baseY: number,
  d: StationDraw,
  t: number
): Bounds {
  const b = clamp(d.build, 0, 1);
  const x = snapToPixel(cx) - STATION_HALF_W;
  const empty: Bounds = { x, y: baseY - 8, w: STATION_HALF_W * 2, h: 8 };
  if (b <= 0.02) return empty;
  const rise = snapToPixel((1 - Math.min(1, b * 1.4)) * 10);
  let top = baseY - 40;

  switch (type) {
    case 'gate': top = drawGate(s, x, baseY, b, d, t); break;
    case 'bench': top = drawBench(s, x, baseY, b, rise, d, t); break;
    case 'greenhouse': top = drawGreenhouse(s, x, baseY, b, d, t); break;
    case 'furnace': top = drawFurnace(s, x, baseY, b, d, t); break;
    case 'mill': top = drawMill(s, x, baseY, b, d, t); break;
    case 'tower': top = drawTower(s, x, baseY, b, d, t); break;
    case 'shelf': top = drawShelf(s, x, baseY, b, rise, d, t); break;
    case 'crystal': top = drawCrystal(s, x, baseY, b, d, t); break;
  }
  if (b > 0.05 && b < 0.95) drawDustPuff(s, cx, baseY - 6, b, 20);
  return { x, y: top, w: STATION_HALF_W * 2, h: baseY - top };
}

function windowGlow(s: PixelSurface, wx: number, wy: number, d: StationDraw, r = 26): void {
  s.fillRect(wx, wy, 8, 8, C.PLUM_OUTLINE);
  s.fillRect(wx + 1, wy + 1, 6, 6, C.AMBER_GOLD, 1);
  s.hline(wx + 1, wy + 2, 6, C.SUNLIGHT_CREAM, 1);
  s.drawDitheredLight(wx + 4, wy + 4, r, 1.3 + d.tod * 1.3);
}

function drawGate(s: PixelSurface, x: number, baseY: number, b: number, d: StationDraw, t: number): number {
  const gy = baseY - 52;
  s.drawGroundShadow(x + 34, baseY, 26, 5, 1.2);
  const postH = snapToPixel(52 * Math.min(1, b * 1.5));
  s.fillRect(x + 12, baseY - postH, 8, postH, C.PLUM_OUTLINE);
  s.fillRect(x + 13, baseY - postH + 1, 6, postH - 1, C.ROASTED_OAK);
  s.vline(x + 14, baseY - postH + 2, postH - 2, C.CEDAR_PLANK);
  s.fillRect(x + 48, baseY - postH, 8, postH, C.PLUM_OUTLINE);
  s.fillRect(x + 49, baseY - postH + 1, 6, postH - 1, C.ROASTED_OAK);
  s.vline(x + 50, baseY - postH + 2, postH - 2, C.CEDAR_PLANK);
  if (b > 0.4) {
    s.fillRect(x + 6, gy - 10, 56, 10, C.PLUM_OUTLINE);
    s.fillRect(x + 7, gy - 9, 54, 8, C.CRIMSON_BRICK);
    s.hline(x + 8, gy - 8, 52, C.VERMILION_KILN);
    s.hline(x + 8, gy - 2, 52, C.HONEY_PINE);
    // Handcart with source scroll
    const cx = x + 26;
    const cy = baseY - 10;
    s.drawGroundShadow(cx + 8, cy + 8, 12, 3, 1.1);
    s.fillRect(cx - 4, cy - 8, 24, 12, C.PLUM_OUTLINE);
    s.fillRect(cx - 3, cy - 7, 22, 10, C.CEDAR_PLANK);
    s.hline(cx - 3, cy - 7, 22, C.HONEY_PINE);
    const spin = d.active ? Math.floor(t * 8) % 2 : 0;
    s.fillEllipse(cx + 8, cy + 5, 5, 5, C.PLUM_OUTLINE);
    s.fillEllipse(cx + 8, cy + 5, 4, 4, C.ROASTED_OAK);
    s.pset(cx + 8 + spin, cy + 5, C.AMBER_GOLD);
    drawItem(s, cx + 8, cy - 12, { kind: 'scroll', tint: d.tint }, t, false);
    if (d.screen) s.drawMiniText(x + 34 - d.screen.length * 2.5, gy - 7, d.screen, C.SUNLIGHT_CREAM, C.VOID_INK, 1);
  }
  return gy - 10;
}

function drawBench(s: PixelSurface, x: number, baseY: number, b: number, rise: number, d: StationDraw, t: number): number {
  const y = baseY - 50;
  s.drawGroundShadow(x + 34, baseY, 30, 6, 1.4);
  s.fillRect(x + 4, y + 18 + rise, 60, 32 - rise, C.PLUM_OUTLINE);
  s.fillRect(x + 5, y + 19 + rise, 58, 30 - rise, C.ROASTED_OAK);
  s.fillRect(x + 6, y + 19 + rise, 56, 7, C.HONEY_PINE);
  s.fillRect(x + 3, y + 32 + rise, 7, 12, C.VOID_INK);
  s.fillRect(x + 58, y + 24 + rise, 7, 12, C.VOID_INK);
  if (b > 0.35) {
    s.fillRect(x + 8, y + 4, 52, 16, C.PLUM_OUTLINE);
    s.fillRect(x + 9, y + 5, 50, 14, C.CEDAR_PLANK);
    s.hline(x + 10, y + 6, 48, C.HONEY_PINE);
    const chop = d.active ? (Math.floor(t * 8) % 2 === 0 ? 0 : 5) : 0;
    s.fillRect(x + 24, y + 22, 20, 18, C.VOID_INK);
    s.fillRect(x + 26, y + 23 + chop, 16, 6, C.AMBER_GOLD, 1);
    s.hline(x + 26, y + 28 + chop, 16, C.IVORY_SPARK, 1);
    const gearPhase = d.active ? Math.floor(t * 8) * 0.4 : 0;
    drawPixelGear(s, x + 14, y + 28, 7, C.EMBER_ORANGE, C.AMBER_GOLD, gearPhase);
    windowGlow(s, x + 47, y + 26, d, 28);
    s.fillRect(x + 52, y + 1, 5, 5, C.SUNLIGHT_CREAM, 1);
  }
  return y + 1;
}

function drawGreenhouse(s: PixelSurface, x: number, baseY: number, b: number, d: StationDraw, t: number): number {
  const [dk, md, lt] = TINT_RAMP[d.tint];
  const y = baseY - 76;
  s.drawGroundShadow(x + 34, baseY, 34, 7, 1.4);
  s.fillRect(x, y + 58, 68, 18, C.PLUM_OUTLINE);
  s.fillRect(x + 1, y + 59, 66, 16, C.TERRACOTTA_EARTH);
  s.hline(x + 2, y + 60, 64, C.SANDSTONE);
  if (b > 0.3) {
    s.fillRect(x + 3, y + 18, 62, 41, C.PLUM_OUTLINE);
    s.fillRect(x + 10, y + 8, 48, 12, C.PLUM_OUTLINE);
    s.fillRect(x + 4, y + 19, 60, 39, C.INDIGO_NIGHT);
    s.fillRect(x + 11, y + 9, 46, 11, C.COBALT_BROOK);
    s.vline(x + 22, y + 9, 49, C.CERULEAN_GLASS);
    s.vline(x + 46, y + 9, 49, C.CERULEAN_GLASS);
    s.hline(x + 4, y + 36, 60, C.CERULEAN_GLASS);
    s.line(x + 7, y + 26, x + 15, y + 18, C.ICE_PRISM, 1);
    s.line(x + 10, y + 28, x + 17, y + 21, C.SKY_SHIMMER, 1);
    s.fillRect(x + 31, y + 2, 6, 7, C.AMBER_GOLD, 1);
    s.pset(x + 33, y + 3, C.IVORY_SPARK, 1);
    // Crystal tree growing inside the dome (power = growth)
    const g = d.active ? Math.max(0.35, d.power) : d.power;
    if (g > 0.05) {
      const rx = x + 34, ry = y + 22;
      const nodes: ReadonlyArray<readonly [number, number, number]> = [
        [x + 18, y + 36, 0.3], [x + 50, y + 34, 0.3],
        [x + 12, y + 50, 0.6], [x + 26, y + 50, 0.6], [x + 44, y + 50, 0.8], [x + 58, y + 50, 0.8],
      ];
      const parents = [0, 0, 1, 1, 2, 2];
      const pts: ReadonlyArray<readonly [number, number]> = [[rx, ry], [nodes[0][0], nodes[0][1]], [nodes[1][0], nodes[1][1]]];
      for (let i = 0; i < nodes.length; i++) {
        const [nx, ny, need] = nodes[i];
        if (g < need) continue;
        const p = i < 2 ? pts[0] : pts[parents[i] === 1 ? 1 : 2];
        s.line(p[0], p[1], nx, ny, i < 2 ? lt : md, 1);
      }
      const pulse = d.active && Math.floor(t * 6) % 2 === 0;
      drawItem(s, rx, ry, { kind: 'gem', tint: d.tint }, t, false);
      for (const [nx, ny, need] of nodes) if (g >= need) drawItem(s, nx, ny, { kind: 'gem', tint: need > 0.7 && pulse ? 'gold' : d.tint }, t, false);
      s.drawDitheredLight(x + 34, y + 36, 34, 1.3 + d.tod * 1.1 + (d.active ? 0.6 : 0));
      void dk;
    }
  }
  return y + 2;
}

function drawFurnace(s: PixelSurface, x: number, baseY: number, b: number, d: StationDraw, t: number): number {
  const y = baseY - 74;
  s.drawGroundShadow(x + 34, baseY, 32, 7, 1.45);
  s.fillRect(x + 4, y + 26, 60, 48, C.PLUM_OUTLINE);
  s.fillRect(x + 5, y + 27, 58, 46, C.CRIMSON_BRICK);
  for (let by = 30; by < 70; by += 6) {
    s.hline(x + 6, y + by, 56, C.VERMILION_KILN);
    const shift = (by / 6) % 2 === 0 ? 0 : 5;
    for (let bx = 10 + shift; bx < 60; bx += 10) s.vline(x + bx, y + by, 4, C.DARK_WALNUT);
  }
  if (b > 0.4) {
    s.fillRect(x + 40, y, 16, 28, C.PLUM_OUTLINE);
    s.fillRect(x + 41, y + 1, 14, 26, C.CRIMSON_BRICK);
    s.fillRect(x + 38, y - 2, 20, 5, C.AMBER_GOLD);
    s.hline(x + 39, y - 1, 18, C.SUNLIGHT_CREAM);
    const pump = d.active && Math.floor(t * 7) % 2 === 0 ? 2 : 0;
    s.fillRect(x - 4, y + 46 + pump, 12, 14 - pump, C.PLUM_OUTLINE);
    s.fillRect(x - 3, y + 47 + pump, 10, 12 - pump, C.HONEY_PINE);
    s.fillRect(x + 18, y + 42, 28, 26, C.VOID_INK);
    s.strokeRect(x + 17, y + 41, 30, 27, C.SLATE_IRON);
    const roar = clamp((d.active ? 0.55 : 0.2) + d.power * 0.45, 0, 1);
    const fireH = Math.floor(6 + roar * 12 + (Math.floor(t * 10) % 3) * 2);
    s.fillRect(x + 21, y + 66 - fireH, 22, fireH, C.EMBER_ORANGE, 1);
    s.fillRect(x + 24, y + 66 - Math.floor(fireH * 0.7), 16, Math.floor(fireH * 0.7), C.AMBER_GOLD, 1);
    s.fillRect(x + 28, y + 66 - Math.floor(fireH * 0.45), 8, Math.floor(fireH * 0.45), C.SUNLIGHT_CREAM, 1);
    s.drawDitheredLight(x + 32, y + 56, 26 + roar * 18, 1.6 + roar * 1.6);
    const puffs = d.active ? 4 : 2;
    for (let i = 0; i < puffs; i++) {
      const life = (t * 0.75 + i * 0.25) % 1;
      const sz = life < 0.35 ? 6 : life < 0.7 ? 5 : 3;
      s.fillRect(
        snapToPixel(x + 46 + Math.sin(life * 5 + i) * 5 + life * 6),
        snapToPixel(y - 6 - life * 22),
        sz, sz, roar > 0.6 ? C.IVORY_SPARK : C.SILVER_GEAR, 1
      );
    }
  }
  return y - 4;
}

function drawMill(s: PixelSurface, x: number, baseY: number, b: number, d: StationDraw, t: number): number {
  const y = baseY - 50;
  s.drawGroundShadow(x + 34, baseY, 32, 6, 1.35);
  s.fillRect(x, y + 18, 50, 32, C.PLUM_OUTLINE);
  s.fillRect(x + 1, y + 19, 48, 30, C.ROASTED_OAK);
  s.hline(x + 2, y + 20, 46, C.HONEY_PINE);
  if (b > 0.35) {
    // Water trough + waterwheel on the right
    s.fillRect(x + 44, baseY - 8, 26, 8, C.PLUM_OUTLINE);
    s.fillRect(x + 45, baseY - 7, 24, 6, C.COBALT_BROOK);
    if (Math.floor(t * 8) % 2 === 0) s.hline(x + 48, baseY - 6, 6, C.SKY_SHIMMER, 1);
    const wx = x + 56, wy = y + 24;
    const ang = d.active ? Math.floor(t * 9) * 0.28 : 0;
    s.fillEllipse(wx, wy, 13, 13, C.PLUM_OUTLINE);
    s.fillEllipse(wx, wy, 11, 11, C.CEDAR_PLANK);
    s.fillEllipse(wx, wy, 8, 8, C.COBALT_BROOK);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + ang;
      const px = wx + Math.cos(a) * 11, py = wy + Math.sin(a) * 11;
      s.line(wx, wy, px, py, C.HONEY_PINE);
      s.fillRect(px - 2, py - 2, 4, 4, C.CREAM_LIMESTONE);
    }
    s.fillEllipse(wx, wy, 3, 3, C.AMBER_GOLD);
    drawPixelGear(s, x + 34, y + 26, 7, C.ROASTED_OAK, C.HONEY_PINE, ang);
    const stamp = d.active && Math.floor(t * 8) % 4 === 2 ? 5 : 0;
    s.fillRect(x + 6, y + 4, 18, 16, C.PLUM_OUTLINE);
    s.fillRect(x + 7, y + 5, 16, 14, C.SLATE_IRON);
    s.fillRect(x + 10, y + 18 + stamp, 10, 8, C.AMBER_GOLD, 1);
    s.drawMiniText(x + 8, y + 7, (d.screen ?? '01').slice(0, 3), C.ICE_PRISM, C.VOID_INK, 1);
    windowGlow(s, x + 34, y + 36, d, 24);
  }
  return y + 4;
}

function drawTower(s: PixelSurface, x: number, baseY: number, b: number, d: StationDraw, t: number): number {
  const y = baseY - 66;
  const awake = d.active ? 1 : clamp(d.power, 0, 1);
  s.drawGroundShadow(x + 34, baseY, 26, 6, 1.5);
  const bodyH = snapToPixel(46 * Math.min(1, b * 1.4));
  s.fillRect(x + 12, baseY - bodyH, 44, bodyH, C.PLUM_OUTLINE);
  s.fillRect(x + 13, baseY - bodyH + 1, 42, bodyH - 1, awake > 0.3 ? C.ROASTED_OAK : C.SLATE_IRON);
  if (b > 0.45) {
    s.fillRect(x + 17, y + 8, 34, 12, C.PLUM_OUTLINE);
    s.fillRect(x + 18, y + 9, 32, 10, awake > 0.3 ? C.AMBER_GOLD : C.SILVER_GEAR);
    const spin = awake > 0.1 ? Math.floor(t * 10) * 0.35 : 0;
    drawPixelGear(s, x + 34, y + 4, 8, awake > 0.3 ? C.EMBER_ORANGE : C.SLATE_IRON, awake > 0.3 ? C.SUNLIGHT_CREAM : C.SILVER_GEAR, spin);
    s.fillRect(x + 20, y + 26, 28, 20, C.VOID_INK, 1);
    s.strokeRect(x + 19, y + 25, 30, 22, awake > 0.3 ? C.AMBER_GOLD : C.SLATE_IRON, 1);
    if (awake > 0.25) {
      s.fillRect(x + 21, y + 27, 26, 18, C.PINE_SHADE, 1);
      const txt = (d.screen ?? 'OK').slice(0, 5);
      s.drawMiniText(x + 34 - Math.floor((txt.length * 5 - 1) / 2), y + 33, txt, C.DEW_SPROUT, C.VOID_INK, 1);
      const pend = snapToPixel(Math.sin(t * 7) * 5);
      s.line(x + 34, y + 49, x + 34 + pend, y + 58, C.AMBER_GOLD, 1);
      s.fillEllipse(x + 34 + pend, y + 58, 3, 3, C.SUNLIGHT_CREAM, 1);
      s.drawDitheredLight(x + 34, y + 36, 40, 2.4 * awake);
    } else {
      s.drawMiniText(x + 27, y + 33, '---', C.MUTED_MULBERRY, null, 1);
    }
  }
  return y - 4;
}

function drawShelf(s: PixelSurface, x: number, baseY: number, b: number, rise: number, d: StationDraw, t: number): number {
  const y = baseY - 64;
  s.drawGroundShadow(x + 34, baseY, 30, 6, 1.4);
  s.fillRect(x + 6, y + rise, 56, 64 - rise, C.PLUM_OUTLINE);
  s.fillRect(x + 7, y + 1 + rise, 54, 62 - rise, C.DARK_WALNUT);
  s.fillRect(x + 4, y - 3 + rise, 60, 5, C.PLUM_OUTLINE);
  s.hline(x + 5, y - 2 + rise, 58, C.HONEY_PINE);
  if (b > 0.35) {
    const tints: readonly Tint[] = ['red', 'blue', 'green', 'gold', d.tint, 'purple'];
    const blinkRow = d.active ? Math.floor(t * 6) % 4 : -1;
    for (let r = 0; r < 4; r++) {
      s.hline(x + 8, y + 15 + r * 14, 52, C.CEDAR_PLANK);
      for (let c = 0; c < 4; c++) {
        const dx = x + 10 + c * 12, dy = y + 4 + r * 14;
        const [, md, lt] = TINT_RAMP[tints[(r * 4 + c + r) % tints.length]];
        s.fillRect(dx, dy, 10, 10, C.PLUM_OUTLINE);
        s.fillRect(dx + 1, dy + 1, 8, 8, md, r === blinkRow && c === (Math.floor(t * 6) % 4) ? 1 : 0);
        s.hline(dx + 1, dy + 1, 8, lt);
        s.fillRect(dx + 4, dy + 5, 2, 2, C.AMBER_GOLD);
      }
    }
    if (d.active) s.drawDitheredLight(x + 34, y + 30, 30, 1.2 + d.tod);
  }
  return y - 3;
}

function drawCrystal(s: PixelSurface, x: number, baseY: number, b: number, d: StationDraw, t: number): number {
  const [dk, md, lt] = TINT_RAMP[d.tint];
  const y = baseY - 70;
  s.drawGroundShadow(x + 34, baseY, 30, 6, 1.3);
  s.fillRect(x + 6, baseY - 14, 56, 14, C.PLUM_OUTLINE);
  s.fillRect(x + 7, baseY - 13, 54, 12, C.SLATE_IRON);
  s.hline(x + 8, baseY - 12, 52, C.SILVER_GEAR);
  for (let i = 0; i < 4; i++) s.fillRect(x + 12 + i * 13, baseY - 8, 6, 3, C.VIOLET_UMBER);
  if (b > 0.35) {
    const spikes: ReadonlyArray<readonly [number, number, number]> = [[18, 26, 6], [34, 52, 8], [50, 30, 6], [26, 18, 4], [44, 20, 4]];
    const glow = d.active ? Math.floor(t * 4) % spikes.length : -1;
    spikes.forEach(([ox, h, w], i) => {
      const hh = snapToPixel(h * Math.min(1, (b - 0.35) / 0.5));
      const cx = x + ox, top = baseY - 14 - hh;
      s.fillRect(cx - w / 2 - 1, top + 2, w + 2, hh - 2, C.PLUM_OUTLINE, 1);
      s.fillRect(cx - w / 2 + 1, top, w - 2, 3, C.PLUM_OUTLINE, 1);
      s.fillRect(cx - w / 2, top + 2, w, hh - 2, i === glow ? lt : md, 1);
      s.vline(cx - w / 2, top + 2, hh - 2, lt, 1);
      s.fillRect(cx - w / 2 + 1, top + 1, w - 2, 2, lt, 1);
      s.vline(cx + w / 2 - 1, top + 4, hh - 4, dk, 1);
    });
    s.drawDitheredLight(x + 34, baseY - 36, 30 + (d.active ? 10 : 0), 1.2 + d.power + (d.active ? 0.8 : 0) + d.tod);
  }
  return y;
}
