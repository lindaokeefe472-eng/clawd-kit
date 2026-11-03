// Theme skins for lane / map sets: same layout, different ground, path, fence, sky-or-wall and props
import { C, WORLD_H, WORLD_W, bayer4, clamp, hash2, hashFloat } from './palette.ts';
import { PixelSurface } from './surface.ts';

export const THEMES = ['meadow', 'desert', 'snow', 'indoor', 'lab'] as const;
export type ThemeName = (typeof THEMES)[number];

export const SKY_H = 34;
export const FENCE_Y = 46;

interface ThemeSpec {
  indoor: boolean;
  /** base, dither alt, tuft, sparkle */
  ground: readonly [number, number, number, number];
  /** grout, stone, highlight, glint */
  path: readonly [number, number, number, number];
  ridge: readonly [number, number];
  backProps: ReadonlyArray<readonly [number, number]>;
  frontProps: ReadonlyArray<readonly [number, number]>;
  back: (s: PixelSurface, x: number, y: number, i: number, t: number) => void;
  front: (s: PixelSurface, x: number, y: number, i: number) => void;
}

// ---------- props ----------
export function drawPineTree(s: PixelSurface, x: number, y: number, snowy = false): void {
  s.drawGroundShadow(x, y, 10, 4, 1.3);
  s.fillRect(x - 3, y - 7, 6, 7, C.PLUM_OUTLINE);
  s.fillRect(x - 2, y - 6, 4, 6, C.ROASTED_OAK);
  s.vline(x - 1, y - 6, 5, C.CEDAR_PLANK);
  for (const tr of [{ dy: -13, w: 18, h: 7 }, { dy: -19, w: 14, h: 7 }, { dy: -24, w: 10, h: 6 }]) {
    s.fillRect(x - tr.w / 2, y + tr.dy, tr.w, tr.h, C.PINE_SHADE);
    s.fillRect(x - tr.w / 2 + 1, y + tr.dy + 1, tr.w - 2, tr.h - 2, C.FOREST_MOSS);
    s.fillRect(x - tr.w / 2 + 2, y + tr.dy + 1, tr.w - 5, 2, snowy ? C.IVORY_SPARK : C.MEADOW_GREEN);
    s.hline(x - tr.w / 4, y + tr.dy, Math.max(3, tr.w / 3), snowy ? C.IVORY_SPARK : C.SPRING_LEAF);
  }
}

function drawBush(s: PixelSurface, x: number, y: number, i: number): void {
  s.drawGroundShadow(x, y + 1, 7, 3, 1.1);
  s.fillEllipse(x, y - 3, 7, 5, C.PINE_SHADE);
  s.fillEllipse(x, y - 4, 6, 4, C.FOREST_MOSS);
  s.fillEllipse(x - 1, y - 5, 4, 2, C.MEADOW_GREEN);
  s.hline(x - 2, y - 6, 3, C.SPRING_LEAF);
  if (i % 2 === 0) {
    s.pset(x - 3, y - 4, C.VERMILION_KILN);
    s.pset(x + 2, y - 3, C.AMBER_GOLD);
  }
}

function drawCactus(s: PixelSurface, x: number, y: number, i: number): void {
  const h = 18 + (i % 3) * 4;
  s.drawGroundShadow(x, y, 7, 3, 1.2);
  s.fillRect(x - 3, y - h, 7, h, C.PLUM_OUTLINE);
  s.fillRect(x - 2, y - h + 1, 5, h - 1, C.FOREST_MOSS);
  s.vline(x - 1, y - h + 2, h - 3, C.SPRING_LEAF);
  s.fillRect(x - 8, y - h + 8, 5, 3, C.PLUM_OUTLINE);
  s.fillRect(x - 8, y - h + 3, 3, 7, C.PLUM_OUTLINE);
  s.fillRect(x - 7, y - h + 4, 1, 6, C.FOREST_MOSS);
  s.fillRect(x + 4, y - h + 11, 5, 3, C.PLUM_OUTLINE);
  s.fillRect(x + 6, y - h + 6, 3, 7, C.PLUM_OUTLINE);
  s.fillRect(x + 7, y - h + 7, 1, 6, C.FOREST_MOSS);
  if (i % 2 === 0) s.pset(x, y - h, C.VERMILION_KILN);
}

function drawRock(s: PixelSurface, x: number, y: number, i: number): void {
  const w = 6 + (i % 3) * 2;
  s.drawGroundShadow(x, y + 1, w, 2, 1.0);
  s.fillEllipse(x, y - 2, w, 4, C.PLUM_OUTLINE);
  s.fillEllipse(x, y - 3, w - 1, 3, C.TERRACOTTA_EARTH);
  s.hline(x - w / 2, y - 5, w - 2, C.OCHRE_STONE);
}

function drawSnowMound(s: PixelSurface, x: number, y: number, i: number): void {
  s.fillEllipse(x, y - 2, 8 + (i % 2) * 3, 4, C.SILVER_GEAR);
  s.fillEllipse(x, y - 3, 7 + (i % 2) * 3, 3, C.IVORY_SPARK);
}

function drawShelfProp(s: PixelSurface, x: number, y: number, i: number, t: number): void {
  // wall shelf with jars / books, sitting on the wainscot line
  s.fillRect(x - 14, y - 24, 28, 24, C.PLUM_OUTLINE);
  s.fillRect(x - 13, y - 23, 26, 22, C.DARK_WALNUT);
  s.hline(x - 13, y - 12, 26, C.CEDAR_PLANK);
  const cols = [C.VERMILION_KILN, C.CERULEAN_GLASS, C.SPRING_LEAF, C.AMBER_GOLD];
  for (let k = 0; k < 5; k++) s.fillRect(x - 11 + k * 5, y - 21 + (k % 2), 3, 8 - (k % 2), cols[(k + i) % 4]);
  for (let k = 0; k < 3; k++) s.fillRect(x - 10 + k * 8, y - 10, 5, 8, cols[(k + i + 1) % 4]);
  void t;
}

function drawBarrel(s: PixelSurface, x: number, y: number): void {
  s.drawGroundShadow(x, y, 7, 2, 1.1);
  s.fillRect(x - 6, y - 14, 12, 14, C.PLUM_OUTLINE);
  s.fillRect(x - 5, y - 13, 10, 12, C.CEDAR_PLANK);
  s.hline(x - 5, y - 10, 10, C.SLATE_IRON);
  s.hline(x - 5, y - 4, 10, C.SLATE_IRON);
  s.vline(x - 2, y - 13, 12, C.HONEY_PINE);
}

function drawMonitorProp(s: PixelSurface, x: number, y: number, i: number, t: number): void {
  s.fillRect(x - 12, y - 22, 24, 18, C.PLUM_OUTLINE);
  s.fillRect(x - 11, y - 21, 22, 16, C.INDIGO_NIGHT, 1);
  const k = Math.floor(t * 3 + i) % 4;
  for (let r = 0; r < 3; r++) s.hline(x - 9, y - 18 + r * 4, 6 + ((r + k) % 3) * 4, r === k % 3 ? C.DEW_SPROUT : C.SKY_SHIMMER, 1);
  s.fillRect(x - 2, y - 4, 4, 4, C.SLATE_IRON);
}

function drawTank(s: PixelSurface, x: number, y: number, i: number): void {
  s.drawGroundShadow(x, y, 8, 2, 1.1);
  s.fillRect(x - 7, y - 22, 14, 22, C.PLUM_OUTLINE);
  s.fillRect(x - 6, y - 21, 12, 20, C.SILVER_GEAR);
  s.fillRect(x - 4, y - 16, 8, 12, i % 2 ? C.SPRING_LEAF : C.SKY_SHIMMER, 1);
  s.vline(x - 3, y - 15, 10, C.IVORY_SPARK, 1);
  s.hline(x - 6, y - 21, 12, C.IVORY_SPARK);
}

// ---------- theme table ----------
const OUTDOOR_BACK: ReadonlyArray<readonly [number, number]> = [[14, 58], [470, 60], [440, 52], [36, 52]];
const FRONT: ReadonlyArray<readonly [number, number]> = [[10, 236], [120, 238], [262, 237], [400, 238], [474, 236]];

const SPEC: Record<ThemeName, ThemeSpec> = {
  meadow: {
    indoor: false,
    ground: [C.MEADOW_GREEN, C.FOREST_MOSS, C.SPRING_LEAF, C.SUNLIGHT_CREAM],
    path: [C.TERRACOTTA_EARTH, C.OCHRE_STONE, C.SANDSTONE, C.CREAM_LIMESTONE],
    ridge: [C.PINE_SHADE, C.FOREST_MOSS],
    backProps: OUTDOOR_BACK,
    frontProps: FRONT,
    back: (s, x, y) => drawPineTree(s, x, y),
    front: drawBush,
  },
  desert: {
    indoor: false,
    ground: [C.SANDSTONE, C.OCHRE_STONE, C.CREAM_LIMESTONE, C.TERRACOTTA_EARTH],
    path: [C.DARK_SOIL, C.TERRACOTTA_EARTH, C.OCHRE_STONE, C.SANDSTONE],
    ridge: [C.TERRACOTTA_EARTH, C.OCHRE_STONE],
    backProps: OUTDOOR_BACK,
    frontProps: FRONT,
    back: (s, x, y, i) => drawCactus(s, x, y, i),
    front: drawRock,
  },
  snow: {
    indoor: false,
    ground: [C.WARM_PARCHMENT, C.SILVER_GEAR, C.IVORY_SPARK, C.ICE_PRISM],
    path: [C.SLATE_IRON, C.SILVER_GEAR, C.ICE_PRISM, C.IVORY_SPARK],
    ridge: [C.SILVER_GEAR, C.IVORY_SPARK],
    backProps: OUTDOOR_BACK,
    frontProps: FRONT,
    back: (s, x, y) => drawPineTree(s, x, y, true),
    front: drawSnowMound,
  },
  indoor: {
    indoor: true,
    ground: [C.CEDAR_PLANK, C.ROASTED_OAK, C.HONEY_PINE, C.DARK_WALNUT],
    path: [C.CRIMSON_BRICK, C.VERMILION_KILN, C.EMBER_ORANGE, C.AMBER_GOLD],
    ridge: [C.DARK_WALNUT, C.ROASTED_OAK],
    backProps: [[30, 56], [130, 56], [350, 56], [452, 56]],
    frontProps: [[16, 238], [470, 238]],
    back: drawShelfProp,
    front: (s, x, y) => drawBarrel(s, x, y),
  },
  lab: {
    indoor: true,
    ground: [C.SILVER_GEAR, C.WARM_PARCHMENT, C.SLATE_IRON, C.SLATE_IRON],
    path: [C.INDIGO_NIGHT, C.COBALT_BROOK, C.CERULEAN_GLASS, C.AMBER_GOLD],
    ridge: [C.SLATE_IRON, C.SILVER_GEAR],
    backProps: [[40, 56], [140, 56], [340, 56], [440, 56]],
    frontProps: [[14, 238], [468, 238]],
    back: drawMonitorProp,
    front: (s, x, y, i) => drawTank(s, x, y, i),
  },
};

export function isIndoor(theme: ThemeName): boolean {
  return SPEC[theme].indoor;
}

function skyColors(tod: number): [number, number] {
  if (tod < 0.22) return [C.MUTED_MULBERRY, C.AMBER_GOLD];
  if (tod >= 0.58 && tod < 0.84) return [C.VIOLET_UMBER, C.EMBER_ORANGE];
  if (tod >= 0.84) return [C.VOID_INK, C.INDIGO_NIGHT];
  return [C.CERULEAN_GLASS, C.SKY_SHIMMER];
}

function drawSky(s: PixelSurface, th: ThemeSpec, tod: number, t: number): void {
  const [skyTop, skyLow] = skyColors(tod);
  for (let py = 0; py < SKY_H; py++) {
    const ratio = clamp(py / (SKY_H - 4), 0, 1);
    for (let px = 0; px < WORLD_W; px++) s.pset(px, py, ratio > bayer4(px, py) ? skyLow : skyTop, 1);
  }
  if (tod > 0.72) {
    const count = Math.floor(40 * clamp((tod - 0.72) / 0.2, 0, 1));
    for (let i = 0; i < count; i++) {
      const wx = 8 + Math.floor(hashFloat(i * 17 + 3) * (WORLD_W - 16));
      const wy = 2 + Math.floor(hashFloat(i * 31 + 9) * 20);
      s.pset(wx, wy, Math.floor(t * 3 + i * 0.7) % 5 === 0 ? C.IVORY_SPARK : C.SKY_SHIMMER, 1);
    }
    s.fillEllipse(440, 10, 5, 5, C.SUNLIGHT_CREAM, 1);
    s.fillEllipse(438, 9, 4, 4, skyTop, 1);
  } else {
    if (tod < 0.6) {
      const sx = 40 + tod * 600;
      const sy = 22 - Math.sin(clamp(tod / 0.6, 0, 1) * Math.PI) * 14;
      s.fillEllipse(sx, sy, 6, 6, C.SUNLIGHT_CREAM, 1);
      s.fillEllipse(sx - 1, sy - 1, 4, 4, C.IVORY_SPARK, 1);
    }
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 142 + Math.floor(t * 4)) % (WORLD_W + 60)) - 30;
      const cy = 8 + (i % 2) * 5;
      const col = tod < 0.2 ? C.SUNLIGHT_CREAM : C.IVORY_SPARK;
      s.fillEllipse(cx, cy, 14, 4, col, 1);
      s.fillEllipse(cx - 7, cy + 1, 8, 3, C.WARM_PARCHMENT, 1);
      s.fillEllipse(cx + 8, cy + 1, 9, 3, col, 1);
    }
  }
  for (let wx = 0; wx < WORLD_W; wx++) {
    const ridgeH = 6 + Math.floor(Math.abs(Math.sin(wx * 0.045) * 6 + Math.cos(wx * 0.021) * 4));
    s.vline(wx, SKY_H - ridgeH, ridgeH, th.ridge[0]);
    if (wx % 3 === 0) s.pset(wx, SKY_H - ridgeH, th.ridge[1]);
  }
}

/** Indoor back wall (y 0..FENCE_Y+10) with windows that show the time-of-day sky */
function drawWall(s: PixelSurface, theme: ThemeName, tod: number, t: number): void {
  const lab = theme === 'lab';
  const wallH = FENCE_Y + 10;
  const [skyTop, skyLow] = skyColors(tod);
  for (let y = 0; y < wallH; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const plank = lab ? (x % 40 === 0 || y % 24 === 0 ? C.SLATE_IRON : C.SILVER_GEAR) : y % 8 === 0 ? C.DARK_WALNUT : (x + (Math.floor(y / 8) % 2) * 20) % 40 === 0 ? C.DARK_WALNUT : C.ROASTED_OAK;
      s.pset(x, y, plank);
    }
  }
  for (let wx = 70; wx < WORLD_W; wx += 120) {
    s.fillRect(wx - 16, 6, 32, 24, C.PLUM_OUTLINE);
    for (let y = 7; y < 29; y++) for (let x = wx - 15; x < wx + 15; x++) s.pset(x, y, (y - 7) / 22 > bayer4(x, y) ? skyLow : skyTop, 1);
    s.vline(wx, 7, 22, lab ? C.SLATE_IRON : C.CEDAR_PLANK);
    s.hline(wx - 15, 17, 30, lab ? C.SLATE_IRON : C.CEDAR_PLANK);
    if (tod > 0.8) s.pset(wx - 8, 11, C.IVORY_SPARK, 1);
    else s.drawDitheredLight(wx, 40, 34, 1.2);
  }
  // wainscot / skirting
  s.fillRect(0, wallH - 4, WORLD_W, 4, lab ? C.SLATE_IRON : C.DARK_WALNUT);
  s.hline(0, wallH - 4, WORLD_W, lab ? C.ICE_PRISM : C.HONEY_PINE);
  // pendant lamps
  for (let lx = 120; lx < WORLD_W; lx += 120) {
    s.vline(lx, 0, 4, C.SLATE_IRON);
    s.fillRect(lx - 3, 4, 7, 3, C.PLUM_OUTLINE);
    s.fillRect(lx - 2, 6, 5, 2, C.AMBER_GOLD, 1);
    s.drawDitheredLight(lx, 20, 46, 1.2 + tod * 1.4);
  }
  void t;
}

/** Ground tiles below the sky/wall line */
export function drawGround(s: PixelSurface, theme: ThemeName, fromY: number): void {
  const th = SPEC[theme];
  const [base, alt, tuft, spark] = th.ground;
  for (let ty = Math.floor(fromY / 16); ty < Math.ceil(WORLD_H / 16); ty++) {
    for (let tx = 0; tx < WORLD_W / 16; tx++) {
      const sx = tx * 16;
      const sy = Math.max(ty * 16, fromY);
      const h = hash2(tx, ty);
      s.fillRect(sx, sy, 16, ty * 16 + 16 - sy, base);
      if (theme === 'indoor') {
        s.hline(sx, ty * 16 + 7, 16, alt);
        s.hline(sx, ty * 16 + 15, 16, alt);
        s.vline(sx + ((ty % 2) * 8), ty * 16, 8, alt);
        if ((h & 7) === 0) s.pset(sx + (h % 13), ty * 16 + 3, tuft);
        continue;
      }
      if (theme === 'lab') {
        // quiet single-colour tiles with thin grout so stations stay the focus
        s.hline(sx, ty * 16, 16, spark);
        s.vline(sx, sy, ty * 16 + 16 - sy, spark);
        if ((h & 7) === 0) s.pset(sx + 3 + (h % 9), ty * 16 + 4 + ((h >> 4) % 8), alt);
        continue;
      }
      if ((h & 3) === 0) s.drawDitheredRect(sx, sy, 16, 16, (tx + ty) % 2 === 0 ? base : alt, 0.25);
      const gx = (h % 11) + 2;
      const gy = ((h >>> 4) % 11) + 2;
      s.pset(sx + gx, ty * 16 + gy, tuft);
      s.pset(sx + gx + 1, ty * 16 + gy - 1, tuft);
      if ((h & 15) === 3) s.pset(sx + gy, ty * 16 + gx, spark);
    }
  }
}

/** Horizontal walking path band (y0..y0+20) */
export function drawPath(s: PixelSurface, theme: ThemeName, y0: number): void {
  const [grout, stone, hi, glint] = SPEC[theme].path;
  if (theme === 'indoor' || theme === 'lab') {
    s.fillRect(0, y0, WORLD_W, 20, grout);
    s.fillRect(0, y0 + 2, WORLD_W, 16, stone);
    for (let x = 0; x < WORLD_W; x += 8) s.pset(x, y0 + 4, hi);
    s.hline(0, y0 + 2, WORLD_W, glint);
    s.hline(0, y0 + 17, WORLD_W, glint);
    return;
  }
  for (let tx = 0; tx < WORLD_W / 16; tx++) {
    const sx = tx * 16;
    s.fillRect(sx, y0, 16, 20, grout);
    for (const [ox, oy, sw, sh] of [[1, 1, 6, 6], [8, 2, 7, 5], [2, 10, 6, 7], [9, 11, 6, 6]] as const) {
      s.fillRect(sx + ox, y0 + oy, sw, sh, stone);
      s.hline(sx + ox + 1, y0 + oy, sw - 2, hi);
      s.pset(sx + ox + 1, y0 + oy + 1, glint);
    }
  }
  s.hline(0, y0 - 1, WORLD_W, C.DARK_SOIL);
  s.hline(0, y0 + 20, WORLD_W, C.DARK_SOIL);
}

/** Sky or wall, back props, fence, ground. Lane/map sets call this first. */
export function drawBackdrop(s: PixelSurface, theme: ThemeName, tod: number, t: number): void {
  const th = SPEC[theme];
  if (th.indoor) {
    drawWall(s, theme, tod, t);
    drawGround(s, theme, FENCE_Y + 10);
    th.backProps.forEach(([x, y], i) => th.back(s, x, y, i, t));
    return;
  }
  drawSky(s, th, tod, t);
  drawGround(s, theme, SKY_H);
  for (let wx = 4; wx < WORLD_W; wx += 12) {
    s.fillRect(wx, FENCE_Y - 6, 4, 8, C.PLUM_OUTLINE);
    s.fillRect(wx + 1, FENCE_Y - 5, 2, 6, theme === 'snow' ? C.IVORY_SPARK : C.HONEY_PINE);
    s.fillRect(wx + 4, FENCE_Y - 4, 8, 2, theme === 'desert' ? C.TERRACOTTA_EARTH : C.CEDAR_PLANK);
    s.hline(wx + 4, FENCE_Y - 1, 8, C.ROASTED_OAK);
  }
  th.backProps.forEach(([x, y], i) => th.back(s, x, y, i, t));
}

export function drawFrontProps(s: PixelSurface, theme: ThemeName): void {
  const th = SPEC[theme];
  th.frontProps.forEach(([x, y], i) => th.front(s, x, y, i));
}
