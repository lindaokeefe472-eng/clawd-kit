// Interior set: the camera "steps inside" one station — a room with that station's mechanism at large scale
import { C, WORLD_H, WORLD_W, bayer4, clamp, hash2, hashFloat, snapToPixel } from './palette.ts';
import { PixelSurface } from './surface.ts';
import { TINT_RAMP, drawPixelGear } from './sprites.ts';
import type { Tint } from './sprites.ts';
import type { StationType } from './stations.ts';
import { kitScratch } from './kit.ts';
import type { KitSpec } from './kit.ts';

export const INTERIOR_FLOOR_Y = 150;
/** Machine ground line; the belt runs just in front of it */
export const INTERIOR_BASE_Y = 182;
export const INTERIOR_BELT_Y = 192;
export const INTERIOR_HELPER_Y = 214;
export const INTERIOR_PATH_Y = 230;
export const MACHINE_X = 240;

export interface InteriorDraw {
  active: boolean;
  power: number;
  tint: Tint;
  screen?: string;
  tod: number;
}

/** Mini-font text blown up by an integer factor (for big machine screens) */
function bigText(s: PixelSurface, cx: number, y: number, text: string, col: number, scale: number): void {
  const tmp = new PixelSurface(text.length * 5 + 2, 7);
  tmp.clear(0, 0);
  tmp.drawMiniText(0, 0, text, 31, null, 1);
  const w = (text.length * 5 - 1) * scale;
  const x0 = snapToPixel(cx - w / 2);
  for (let py = 0; py < 6; py++) for (let px = 0; px < tmp.width; px++) if (tmp.colorBuf[py * tmp.width + px] === 31) s.fillRect(x0 + px * scale, y + py * scale, scale, scale, col, 1);
}

export type Material = 'brick' | 'glass' | 'wood' | 'stone' | 'iron' | 'cave' | 'flesh' | 'leaf';
const MATERIAL: Record<StationType, Material> = {
  furnace: 'brick', greenhouse: 'glass', bench: 'wood', mill: 'stone', tower: 'iron', shelf: 'wood', crystal: 'cave', gate: 'wood',
};

export function drawRoom(s: PixelSurface, mat: Material, t: number): void {
  for (let y = 0; y < INTERIOR_FLOOR_Y; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      let c: number;
      switch (mat) {
        case 'brick': {
          const row = Math.floor(y / 8);
          const mortar = y % 8 === 0 || (x + (row % 2) * 8) % 16 === 0;
          c = mortar ? C.DARK_WALNUT : (hash2(Math.floor((x + (row % 2) * 8) / 16), row) & 3) === 0 ? C.VERMILION_KILN : C.CRIMSON_BRICK;
          break;
        }
        case 'glass':
          c = x % 40 === 0 || y % 30 === 0 ? C.CERULEAN_GLASS : (y / INTERIOR_FLOOR_Y) * 0.8 > bayer4(x, y) ? C.COBALT_BROOK : C.INDIGO_NIGHT;
          if ((x - y * 0.6) % 40 > 34 && x % 40 !== 0 && y % 30 !== 0) c = C.SKY_SHIMMER;
          break;
        case 'wood':
          c = y % 10 === 0 ? C.DARK_WALNUT : (x + Math.floor(y / 10) * 13) % 37 === 0 ? C.DARK_WALNUT : y % 10 < 2 ? C.CEDAR_PLANK : C.ROASTED_OAK;
          break;
        case 'stone': {
          const row = Math.floor(y / 12);
          c = y % 12 === 0 || (x + (row % 2) * 12) % 24 === 0 ? C.VIOLET_UMBER : (hash2(x >> 3, y >> 3) & 7) === 0 ? C.SILVER_GEAR : C.SLATE_IRON;
          break;
        }
        case 'iron':
          c = x % 48 === 0 || y % 36 === 0 ? C.PLUM_OUTLINE : (x % 48 === 4 || x % 48 === 44) && y % 6 === 3 ? C.SILVER_GEAR : C.SLATE_IRON;
          if (y % 36 === 1) c = C.SILVER_GEAR;
          break;
        case 'flesh': {
          // wet tissue wall with branching vessels
          const vein = Math.abs(Math.sin(x * 0.05 + Math.floor(y / 40) * 2) * 30 - (y % 40) + 5) < 1.2 || Math.abs(Math.sin(y * 0.07 + Math.floor(x / 60)) * 20 - (x % 60) + 20) < 1;
          c = vein ? C.VERMILION_KILN : (hash2(x >> 3, y >> 3) & 31) === 0 ? C.CRIMSON_BRICK : (y / INTERIOR_FLOOR_Y) * 0.5 + 0.2 > bayer4(x, y) ? C.VIOLET_UMBER : C.MUTED_MULBERRY;
          break;
        }
        case 'leaf': {
          const vein = x % 30 === 15 || Math.abs((x % 30) - 15) === Math.floor((y % 24) / 2);
          c = vein ? C.SPRING_LEAF : (hash2(x >> 2, y >> 2) & 7) === 0 ? C.MEADOW_GREEN : C.FOREST_MOSS;
          break;
        }
        case 'cave': {
          const n = hashFloat(Math.floor(x / 6) * 31 + Math.floor(y / 6) * 17);
          c = n > 0.75 ? C.MUTED_MULBERRY : n > 0.35 ? C.VIOLET_UMBER : C.PLUM_OUTLINE;
          break;
        }
      }
      s.pset(x, y, c);
    }
  }
  // skirting + floor
  const floorCol = mat === 'wood' ? C.CEDAR_PLANK : mat === 'glass' ? C.SANDSTONE : mat === 'cave' ? C.VIOLET_UMBER : mat === 'flesh' ? C.CRIMSON_BRICK : mat === 'leaf' ? C.PINE_SHADE : C.SLATE_IRON;
  const floorAlt = mat === 'wood' ? C.ROASTED_OAK : mat === 'glass' ? C.OCHRE_STONE : mat === 'cave' ? C.PLUM_OUTLINE : mat === 'flesh' ? C.VIOLET_UMBER : mat === 'leaf' ? C.FOREST_MOSS : C.VIOLET_UMBER;
  for (let y = INTERIOR_FLOOR_Y; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const line = mat === 'wood' ? y % 9 === 0 : (y - INTERIOR_FLOOR_Y) % 14 === 0 || (x + (Math.floor(y / 14) % 2) * 14) % 28 === 0;
      s.pset(x, y, line ? floorAlt : floorCol);
    }
  }
  s.fillRect(0, INTERIOR_FLOOR_Y - 3, WORLD_W, 3, C.PLUM_OUTLINE);
  s.hline(0, INTERIOR_FLOOR_Y - 3, WORLD_W, mat === 'glass' ? C.ICE_PRISM : C.HONEY_PINE);
  // side pillars frame the room
  for (const px of [0, WORLD_W - 18]) {
    s.fillRect(px, 0, 18, INTERIOR_FLOOR_Y, C.PLUM_OUTLINE);
    s.fillRect(px + 2, 0, 14, INTERIOR_FLOOR_Y, mat === 'cave' ? C.VIOLET_UMBER : C.DARK_WALNUT);
    s.vline(px + 4, 0, INTERIOR_FLOOR_Y, mat === 'cave' ? C.MUTED_MULBERRY : C.CEDAR_PLANK);
  }
  void t;
}

function furnace(s: PixelSurface, d: InteriorDraw, t: number): number {
  const cx = MACHINE_X, base = INTERIOR_BASE_Y;
  const roar = clamp((d.active ? 0.6 : 0.25) + d.power * 0.4, 0, 1);
  s.fillRect(cx - 76, base - 112, 152, 112, C.PLUM_OUTLINE);
  s.fillRect(cx - 72, base - 108, 144, 104, C.SLATE_IRON);
  s.hline(cx - 72, base - 108, 144, C.SILVER_GEAR);
  for (let k = 0; k < 6; k++) s.fillRect(cx - 66 + k * 26, base - 104, 4, 4, C.SILVER_GEAR);
  // arched mouth
  s.fillRect(cx - 56, base - 80, 112, 76, C.VOID_INK, 1);
  s.fillEllipse(cx, base - 80, 56, 18, C.VOID_INK, 1);
  const f = Math.floor(t * 10);
  for (let x = -52; x <= 52; x += 2) {
    const h = snapToPixel((28 + Math.sin(x * 0.21 + f * 0.9) * 10 + hashFloat(x * 7 + f) * 8) * (0.5 + roar * 0.7));
    s.fillRect(cx + x, base - 6 - h, 2, h, C.EMBER_ORANGE, 1);
    s.fillRect(cx + x, base - 6 - Math.floor(h * 0.7), 2, Math.floor(h * 0.7), C.AMBER_GOLD, 1);
    s.fillRect(cx + x, base - 6 - Math.floor(h * 0.4), 2, Math.floor(h * 0.4), C.SUNLIGHT_CREAM, 1);
  }
  for (let i = 0; i < 16; i++) {
    const life = (t * 0.6 + i / 16) % 1;
    s.pset(cx - 50 + hashFloat(i * 13) * 100 + Math.sin(life * 6 + i) * 4, base - 10 - life * 120, life < 0.5 ? C.AMBER_GOLD : C.EMBER_ORANGE, 1);
  }
  s.drawDitheredLight(cx, base - 30, 90 + roar * 40, 2 + roar * 1.5);
  // hood duct
  s.fillRect(cx - 20, 0, 40, base - 112, C.PLUM_OUTLINE);
  s.fillRect(cx - 17, 0, 34, base - 112, C.SLATE_IRON);
  s.vline(cx - 12, 0, base - 112, C.SILVER_GEAR);
  return base - 112;
}

function greenhouse(s: PixelSurface, d: InteriorDraw, t: number): number {
  const cx = MACHINE_X, base = INTERIOR_BASE_Y;
  const [dk, md, lt] = TINT_RAMP[d.tint];
  const g = d.active ? Math.max(0.4, d.power) : d.power;
  s.fillRect(cx - 50, base - 16, 100, 16, C.PLUM_OUTLINE);
  s.fillRect(cx - 48, base - 14, 96, 12, C.TERRACOTTA_EARTH);
  s.hline(cx - 48, base - 14, 96, C.SANDSTONE);
  const trunkH = snapToPixel(30 + g * 40);
  s.fillRect(cx - 3, base - 14 - trunkH, 6, trunkH, md, 1);
  s.vline(cx - 2, base - 14 - trunkH, trunkH, lt, 1);
  const top = base - 14 - trunkH;
  const branches: ReadonlyArray<readonly [number, number, number]> = [
    [-44, -18, 0.2], [44, -14, 0.2], [-70, -40, 0.5], [-24, -48, 0.5], [24, -46, 0.6], [70, -36, 0.6], [0, -70, 0.85],
  ];
  const pulse = Math.floor(t * 5) % branches.length;
  branches.forEach(([bx, by, need], i) => {
    if (g < need) return;
    const px = i < 2 ? cx : i < 4 ? cx + branches[0][0] : cx + branches[1][0];
    const py = i < 2 ? top + 20 : top + 20 + (i < 4 ? branches[0][1] : branches[1][1]);
    const nx = cx + bx, ny = top + 20 + by;
    s.line(i === 6 ? cx : px, i === 6 ? top : py, nx, ny, lt, 1);
    s.line(i === 6 ? cx + 1 : px + 1, i === 6 ? top : py, nx + 1, ny, md, 1);
    const big = d.active && i === pulse;
    // outer fruit nodes are gold so the tree reads against any glass tint
    const [ndk, nmd, nlt] = need >= 0.5 ? TINT_RAMP.gold : [dk, md, lt];
    s.fillRect(nx - 5, ny - 5, 11, 11, C.PLUM_OUTLINE, 1);
    s.fillRect(nx - 4, ny - 4, 9, 9, big ? C.SUNLIGHT_CREAM : nmd, 1);
    s.fillRect(nx - 3, ny - 4, 5, 3, big ? C.IVORY_SPARK : nlt, 1);
    s.hline(nx - 4, ny + 4, 9, ndk, 1);
    s.pset(nx - 3, ny - 3, C.IVORY_SPARK, 1);
    if (big) s.drawDitheredLight(nx, ny, 26, 2);
  });
  for (let k = 0; k < 3; k++) {
    for (let y = 0; y < INTERIOR_FLOOR_Y; y++) {
      const x = 60 + k * 150 + y * 0.6;
      if (0.35 > bayer4(Math.floor(x), y)) s.fillRect(x, y, 10, 1, C.SKY_SHIMMER, 1);
    }
  }
  s.drawDitheredLight(cx, base - 60, 100, 1.4 + g);
  return base - 110;
}

function bench(s: PixelSurface, d: InteriorDraw, t: number): number {
  const cx = MACHINE_X, base = INTERIOR_BASE_Y;
  s.fillRect(cx - 70, base - 30, 140, 30, C.PLUM_OUTLINE);
  s.fillRect(cx - 68, base - 28, 136, 26, C.ROASTED_OAK);
  s.fillRect(cx - 68, base - 28, 136, 6, C.HONEY_PINE);
  for (const px of [cx - 46, cx + 38]) {
    s.fillRect(px, base - 130, 8, 102, C.PLUM_OUTLINE);
    s.fillRect(px + 1, base - 129, 6, 100, C.CEDAR_PLANK);
  }
  s.fillRect(cx - 50, base - 136, 100, 10, C.PLUM_OUTLINE);
  s.fillRect(cx - 48, base - 134, 96, 6, C.HONEY_PINE);
  const phase = d.active ? Math.floor(t * 4) % 4 : 0;
  const drop = [0, 40, 70, 20][phase];
  const by = base - 120 + drop;
  s.fillRect(cx - 38, by, 76, 20, C.PLUM_OUTLINE, 1);
  s.fillRect(cx - 36, by + 2, 72, 16, C.SILVER_GEAR, 1);
  s.fillRect(cx - 36, by + 14, 72, 4, C.IVORY_SPARK, 1);
  s.line(cx - 36, by + 4, cx + 30, by + 10, C.SLATE_IRON, 1);
  if (phase === 2) for (let k = 0; k < 8; k++) s.fillRect(cx - 40 + k * 11, base - 34 - (k % 3) * 4, 2, 2, C.SUNLIGHT_CREAM, 1);
  const ang = d.active ? Math.floor(t * 8) * 0.4 : 0;
  drawPixelGear(s, 80, 70, 22, C.EMBER_ORANGE, C.AMBER_GOLD, ang);
  drawPixelGear(s, 112, 104, 14, C.SLATE_IRON, C.SILVER_GEAR, -ang * 1.5);
  drawPixelGear(s, 400, 80, 18, C.EMBER_ORANGE, C.AMBER_GOLD, -ang);
  s.drawDitheredLight(cx, base - 60, 80, 1.3 + d.tod);
  return base - 136;
}

function mill(s: PixelSurface, d: InteriorDraw, t: number): number {
  const cx = MACHINE_X, base = INTERIOR_BASE_Y;
  const ang = d.active ? Math.floor(t * 9) * 0.2 : 0;
  // giant wheel behind on the left
  const wx = 110, wy = 90, R = 64;
  s.fillEllipse(wx, wy, R, R, C.PLUM_OUTLINE);
  s.fillEllipse(wx, wy, R - 3, R - 3, C.CEDAR_PLANK);
  s.fillEllipse(wx, wy, R - 12, R - 12, C.SLATE_IRON);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + ang;
    s.line(wx, wy, wx + Math.cos(a) * (R - 3), wy + Math.sin(a) * (R - 3), C.HONEY_PINE);
    s.fillRect(wx + Math.cos(a) * (R - 2) - 4, wy + Math.sin(a) * (R - 2) - 4, 8, 8, C.CREAM_LIMESTONE);
  }
  s.fillEllipse(wx, wy, 8, 8, C.AMBER_GOLD);
  drawPixelGear(s, 200, 70, 18, C.ROASTED_OAK, C.HONEY_PINE, -ang * 2);
  drawPixelGear(s, 236, 52, 12, C.SLATE_IRON, C.SILVER_GEAR, ang * 3);
  s.fillRect(200, 66, 160, 6, C.CEDAR_PLANK);
  // press
  s.fillRect(cx + 40, base - 120, 90, 120, C.PLUM_OUTLINE);
  s.fillRect(cx + 43, base - 117, 84, 114, C.ROASTED_OAK);
  const stamp = d.active && Math.floor(t * 6) % 3 === 1 ? 26 : 0;
  s.fillRect(cx + 62, base - 100 + stamp, 46, 30, C.PLUM_OUTLINE, 1);
  s.fillRect(cx + 64, base - 98 + stamp, 42, 26, C.AMBER_GOLD, 1);
  s.fillRect(cx + 50, base - 116, 70, 14, C.SLATE_IRON);
  bigText(s, cx + 85, base - 114, (d.screen ?? '01').slice(0, 4), C.ICE_PRISM, 2);
  s.drawDitheredLight(cx + 85, base - 60, 60, 1.4 + d.tod);
  return base - 120;
}

function tower(s: PixelSurface, d: InteriorDraw, t: number): number {
  const cx = MACHINE_X, base = INTERIOR_BASE_Y;
  const spin = d.active || d.power > 0.3 ? t : 0;
  drawPixelGear(s, 70, 60, 34, C.SLATE_IRON, C.SILVER_GEAR, Math.floor(spin * 6) * 0.15);
  drawPixelGear(s, 128, 112, 20, C.EMBER_ORANGE, C.AMBER_GOLD, -Math.floor(spin * 6) * 0.25);
  drawPixelGear(s, 410, 64, 28, C.EMBER_ORANGE, C.AMBER_GOLD, -Math.floor(spin * 6) * 0.18);
  drawPixelGear(s, 372, 118, 16, C.SLATE_IRON, C.SILVER_GEAR, Math.floor(spin * 6) * 0.3);
  s.fillRect(cx - 64, base - 150, 128, 150, C.PLUM_OUTLINE);
  s.fillRect(cx - 61, base - 147, 122, 144, C.ROASTED_OAK);
  s.fillRect(cx - 50, base - 136, 100, 60, C.AMBER_GOLD);
  s.fillRect(cx - 46, base - 132, 92, 52, C.VOID_INK, 1);
  const awake = d.active || d.power > 0.25;
  if (awake) {
    s.fillRect(cx - 44, base - 130, 88, 48, C.PINE_SHADE, 1);
    for (let y = base - 130; y < base - 82; y += 2) s.hline(cx - 44, y, 88, C.FOREST_MOSS, 1);
    bigText(s, cx, base - 116, (d.screen ?? 'OK').slice(0, 5), C.DEW_SPROUT, 3);
    s.drawDitheredLight(cx, base - 106, 70, 2.4);
  } else {
    bigText(s, cx, base - 112, '---', C.MUTED_MULBERRY, 3);
  }
  const pend = snapToPixel(Math.sin(t * 3) * 22);
  s.line(cx, base - 72, cx + pend, base - 20, C.AMBER_GOLD, 1);
  s.fillEllipse(cx + pend, base - 18, 8, 8, C.SUNLIGHT_CREAM, 1);
  return base - 150;
}

function shelf(s: PixelSurface, d: InteriorDraw, t: number): number {
  const cols: readonly Tint[] = ['red', 'blue', 'green', 'gold', d.tint, 'purple'];
  const open = d.active ? Math.floor(t * 2) % 24 : -1;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 16; c++) {
      const x = 26 + c * 27;
      const y = 24 + r * 24;
      const idx = r * 16 + c;
      const [, md, lt] = TINT_RAMP[cols[(r + c * 2) % cols.length]];
      const out = idx % 24 === open ? 6 : 0;
      s.fillRect(x, y + out, 24, 20, C.PLUM_OUTLINE);
      s.fillRect(x + 1, y + 1 + out, 22, 18, md);
      s.hline(x + 1, y + 1 + out, 22, lt);
      s.fillRect(x + 9, y + 9 + out, 6, 3, C.AMBER_GOLD);
      if (out) s.drawDitheredLight(x + 12, y + 14, 20, 2);
    }
  }
  s.line(380, 10, 360, INTERIOR_FLOOR_Y, C.HONEY_PINE);
  s.line(396, 10, 376, INTERIOR_FLOOR_Y, C.HONEY_PINE);
  for (let k = 0; k < 9; k++) s.line(378 - k * 2.2, 22 + k * 15, 394 - k * 2.2, 22 + k * 15, C.CEDAR_PLANK);
  return 24;
}

function crystal(s: PixelSurface, d: InteriorDraw, t: number): number {
  const cx = MACHINE_X, base = INTERIOR_BASE_Y;
  const [dk, md, lt] = TINT_RAMP[d.tint];
  const spikes: ReadonlyArray<readonly [number, number, number]> = [[-60, 70, 16], [-30, 110, 20], [0, 140, 26], [30, 100, 20], [62, 76, 16], [-84, 44, 12], [86, 50, 12]];
  const glow = d.active ? Math.floor(t * 4) % spikes.length : -1;
  s.fillEllipse(cx, base - 4, 110, 12, C.PLUM_OUTLINE);
  s.fillEllipse(cx, base - 6, 106, 9, C.VIOLET_UMBER);
  spikes.forEach(([ox, h, w], i) => {
    const hh = snapToPixel(h * (0.6 + d.power * 0.4));
    const x = cx + ox - w / 2;
    const top = base - 8 - hh;
    s.fillRect(x - 1, top + 4, w + 2, hh - 4, C.PLUM_OUTLINE, 1);
    s.fillRect(x + 2, top, w - 4, 6, C.PLUM_OUTLINE, 1);
    s.fillRect(x, top + 4, w, hh - 4, i === glow ? lt : md, 1);
    s.fillRect(x + 2, top + 1, w - 4, 4, lt, 1);
    s.fillRect(x, top + 4, 3, hh - 4, lt, 1);
    s.fillRect(x + w - 3, top + 8, 3, hh - 8, dk, 1);
    if (i === glow) s.drawDitheredLight(cx + ox, top + hh / 2, 40, 2.4);
  });
  for (let i = 0; i < 20; i++) {
    const life = (t * 0.4 + i / 20) % 1;
    s.pset(cx - 100 + hashFloat(i * 7) * 200, base - 20 - life * 130, life > 0.5 ? C.ICE_PRISM : lt, 1);
  }
  s.drawDitheredLight(cx, base - 70, 110, 1.5 + d.power + (d.active ? 0.6 : 0));
  return base - 148;
}

function gate(s: PixelSurface, d: InteriorDraw, t: number): number {
  const cx = MACHINE_X, base = INTERIOR_BASE_Y;
  const open = clamp(d.active ? 1 : d.power, 0, 1);
  s.fillRect(cx - 80, base - 140, 160, 140, C.PLUM_OUTLINE);
  s.fillRect(cx - 76, base - 136, 152, 136, C.CRIMSON_BRICK);
  s.fillRect(cx - 60, base - 120, 120, 120, C.VOID_INK, 1);
  // daylight beyond the doors
  for (let y = base - 118; y < base; y++) for (let x = cx - 58; x < cx + 58; x++) s.pset(x, y, (y - (base - 118)) / 118 > bayer4(x, y) ? C.SUNLIGHT_CREAM : C.AMBER_GOLD, 1);
  const dw = snapToPixel(58 * (1 - open));
  s.fillRect(cx - 58, base - 118, dw, 118, C.ROASTED_OAK);
  s.fillRect(cx + 58 - dw, base - 118, dw, 118, C.ROASTED_OAK);
  for (let k = 0; k < dw; k += 8) {
    s.vline(cx - 58 + k, base - 118, 118, C.DARK_WALNUT);
    s.vline(cx + 57 - k, base - 118, 118, C.DARK_WALNUT);
  }
  s.drawDitheredLight(cx, base - 40, 30 + open * 90, 1 + open * 2);
  s.fillRect(cx - 84, base - 150, 168, 14, C.PLUM_OUTLINE);
  s.fillRect(cx - 82, base - 148, 164, 10, C.VERMILION_KILN);
  if (d.screen) bigText(s, cx, base - 147, d.screen.slice(0, 6), C.SUNLIGHT_CREAM, 1);
  void t;
  return base - 150;
}

const MECH: Record<StationType, (s: PixelSurface, d: InteriorDraw, t: number) => number> = {
  furnace, greenhouse, bench, mill, tower, shelf, crystal, gate,
};

const KIT_ROOM: Record<KitSpec['material'], Material> = {
  wood: 'wood', brick: 'brick', stone: 'stone', metal: 'iron', glass: 'glass', crystal: 'cave', flesh: 'flesh', leaf: 'leaf', concrete: 'stone', plastic: 'iron',
};

/** Kit interior: a room of the kit's material with the same station drawn ×2 in the middle */
export function drawKitInterior(s: PixelSurface, k: KitSpec, d: InteriorDraw, t: number): number {
  drawRoom(s, KIT_ROOM[k.material], t);
  const sc = kitScratch({ ...k, size: 'l' }, { build: 1, active: d.active, tint: d.tint, power: d.power, tod: d.tod, screen: d.screen }, t);
  let topRow = sc.surf.height;
  for (let i = 0; i < sc.surf.colorBuf.length; i++) if (sc.surf.colorBuf[i] !== 255) { topRow = Math.floor(i / sc.surf.width); break; }
  const dx = MACHINE_X - sc.baseX * 2;
  const dy = INTERIOR_BASE_Y - sc.baseY * 2;
  s.drawGroundShadow(MACHINE_X, INTERIOR_BASE_Y, 76, 10, 1.6);
  s.blitMaskedScaled(sc.surf, dx, dy, 2);
  if (d.active) s.drawDitheredLight(MACHINE_X, INTERIOR_BASE_Y - 60, 90, 1.2 + d.tod);
  return Math.max(20, dy + topRow * 2);
}

/** Room + mechanism; returns machine top y (for the sign) */
export function drawInterior(s: PixelSurface, type: StationType, d: InteriorDraw, t: number): number {
  drawRoom(s, MATERIAL[type], t);
  return MECH[type](s, d, t);
}
