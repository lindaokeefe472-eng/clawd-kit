// Fixed art contract: 480x270 logical grid, x4 to 1080p, warm 32-color hue-shifted palette (from 4a)

export const PIXEL_SCALE = 4;
export const LOGICAL_W = 480;
export const LOGICAL_H = 270;
export const OUT_W = LOGICAL_W * PIXEL_SCALE; // 1920
export const OUT_H = LOGICAL_H * PIXEL_SCALE; // 1080

// Subtitle safe line contract: y < 240 in logical space === y < 960 in 1920x1080 HD space
export const SAFE_Y = 240;
export const SAFE_Y_HD = SAFE_Y * PIXEL_SCALE; // 960

/** The world is exactly one zoom-1 screen above the subtitle band */
export const WORLD_W = LOGICAL_W;
export const WORLD_H = SAFE_Y;

/** Strict Anti-Mixel integer pixel alignment */
export function snapToPixel(v: number): number {
  return Math.floor(v);
}

/** Pure deterministic integer hash (ZERO Math.random anywhere in codebase) */
export function hash(n: number): number {
  let x = (Math.imul(n | 0, 0x27d4eb2d) ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

export function hash2(x: number, y: number): number {
  return hash(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663));
}

/** Deterministic float in [0, 1) */
export function hashFloat(seed: number): number {
  return (hash(seed) & 0xffffff) / 0x1000000;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
}

export function easeOutCubic(t: number): number {
  const c = 1 - clamp(t, 0, 1);
  return 1 - c * c * c;
}

export function easeInOutQuad(t: number): number {
  const c = clamp(t, 0, 1);
  return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2;
}

/**
 * Curated 32-Color Warm Cozy Hi-Bit Palette (Hue-Shifted Ramps:
 * highlights shift warm cream/gold, shadows shift plum/deep indigo).
 */
export const PALETTE_32: readonly string[] = [
  // 00-03: Ramp A — Deep Shadow & Selective Outlines (Sel-out)
  '#141020', // 00 VOID_INK
  '#221933', // 01 PLUM_OUTLINE
  '#362647', // 02 VIOLET_UMBER
  '#4E3656', // 03 MUTED_MULBERRY

  // 04-08: Ramp B — Warm Earth, Cobblestone & Courtyard Path
  '#5C4038', // 04 DARK_SOIL
  '#7D5642', // 05 TERRACOTTA_EARTH
  '#A47451', // 06 OCHRE_STONE
  '#C99A6B', // 07 SANDSTONE
  '#E5C391', // 08 CREAM_LIMESTONE

  // 09-12: Ramp C — Crafted Timber, Oak Beams & Shingles
  '#472D2B', // 09 DARK_WALNUT
  '#6E4437', // 10 ROASTED_OAK
  '#996344', // 11 CEDAR_PLANK
  '#C48B5C', // 12 HONEY_PINE

  // 13-17: Ramp D — Hearth Brick & Copper-Amber Flame
  '#7A2832', // 13 CRIMSON_BRICK
  '#AD3E39', // 14 VERMILION_KILN
  '#D96838', // 15 EMBER_ORANGE
  '#F2A23A', // 16 AMBER_GOLD
  '#FCE07D', // 17 SUNLIGHT_CREAM

  // 18-22: Ramp E — Meadow Moss, Foliage & Emerald Gem
  '#1F3B3B', // 18 PINE_SHADE
  '#2E5948', // 19 FOREST_MOSS
  '#4B8253', // 20 MEADOW_GREEN
  '#7AB05A', // 21 SPRING_LEAF
  '#B2D973', // 22 DEW_SPROUT

  // 23-27: Ramp F — Brook Water, Conservatory Glass & Sapphire Crystal
  '#1D2B53', // 23 INDIGO_NIGHT
  '#2C4A78', // 24 COBALT_BROOK
  '#4678A8', // 25 CERULEAN_GLASS
  '#73B0D4', // 26 SKY_SHIMMER
  '#B8E6F5', // 27 ICE_PRISM

  // 28-31: Ramp G — Slate Iron, Steam, Parchment & Specular Spark
  '#6D7187', // 28 SLATE_IRON
  '#9BA2B8', // 29 SILVER_GEAR
  '#E8D8B9', // 30 WARM_PARCHMENT
  '#FFF8E7', // 31 IVORY_SPARK
] as const;

export const C = {
  VOID_INK: 0,
  PLUM_OUTLINE: 1,
  VIOLET_UMBER: 2,
  MUTED_MULBERRY: 3,

  DARK_SOIL: 4,
  TERRACOTTA_EARTH: 5,
  OCHRE_STONE: 6,
  SANDSTONE: 7,
  CREAM_LIMESTONE: 8,

  DARK_WALNUT: 9,
  ROASTED_OAK: 10,
  CEDAR_PLANK: 11,
  HONEY_PINE: 12,

  CRIMSON_BRICK: 13,
  VERMILION_KILN: 14,
  EMBER_ORANGE: 15,
  AMBER_GOLD: 16,
  SUNLIGHT_CREAM: 17,

  PINE_SHADE: 18,
  FOREST_MOSS: 19,
  MEADOW_GREEN: 20,
  SPRING_LEAF: 21,
  DEW_SPROUT: 22,

  INDIGO_NIGHT: 23,
  COBALT_BROOK: 24,
  CERULEAN_GLASS: 25,
  SKY_SHIMMER: 26,
  ICE_PRISM: 27,

  SLATE_IRON: 28,
  SILVER_GEAR: 29,
  WARM_PARCHMENT: 30,
  IVORY_SPARK: 31,
} as const;

/** Packed 32-bit ABGR colors for fast little-endian ImageData writes */
export const PALETTE_ABGR = new Uint32Array(
  PALETTE_32.map((hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  })
);

/**
 * Hue-shifted shade progression table:
 * For each palette index [0..31], defines 7 discrete lighting steps:
 *   0 = deepest star-night shadow
 *   1 = dusk / deep cast shadow
 *   2 = soft shade / cool morning
 *   3 = base noon neutral color
 *   4 = warm sunlit / lantern rim
 *   5 = bright golden amber highlight
 *   6 = intense core glow / cream spark
 */
export const HUE_SHIFT_RAMPS: ReadonlyArray<readonly [number, number, number, number, number, number, number]> = [
  [0, 0, 0, 0, 1, 2, 3],       // 00 VOID_INK
  [0, 0, 1, 1, 2, 3, 5],       // 01 PLUM_OUTLINE
  [1, 1, 2, 2, 3, 5, 6],       // 02 VIOLET_UMBER
  [1, 2, 2, 3, 5, 6, 7],       // 03 MUTED_MULBERRY

  [1, 2, 3, 4, 5, 6, 7],       // 04 DARK_SOIL
  [2, 2, 4, 5, 6, 7, 8],       // 05 TERRACOTTA_EARTH
  [2, 3, 5, 6, 7, 8, 17],      // 06 OCHRE_STONE
  [3, 4, 5, 7, 8, 17, 31],     // 07 SANDSTONE
  [3, 5, 6, 8, 30, 17, 31],    // 08 CREAM_LIMESTONE

  [1, 1, 9, 9, 10, 11, 12],    // 09 DARK_WALNUT
  [1, 2, 9, 10, 11, 12, 16],   // 10 ROASTED_OAK
  [2, 3, 10, 11, 12, 16, 17],  // 11 CEDAR_PLANK
  [3, 5, 11, 12, 8, 16, 17],   // 12 HONEY_PINE

  [2, 9, 13, 13, 14, 15, 16],  // 13 CRIMSON_BRICK
  [9, 13, 13, 14, 15, 16, 17], // 14 VERMILION_KILN
  [13, 14, 14, 15, 16, 17, 31],// 15 EMBER_ORANGE
  [14, 15, 15, 16, 17, 31, 31],// 16 AMBER_GOLD
  [15, 16, 16, 17, 31, 31, 31],// 17 SUNLIGHT_CREAM

  [0, 1, 18, 18, 19, 20, 21],  // 18 PINE_SHADE
  [23, 18, 19, 19, 20, 21, 22],// 19 FOREST_MOSS
  [23, 18, 19, 20, 21, 22, 17],// 20 MEADOW_GREEN
  [18, 19, 20, 21, 22, 17, 31],// 21 SPRING_LEAF
  [19, 20, 21, 22, 17, 31, 31],// 22 DEW_SPROUT

  [0, 0, 23, 23, 24, 25, 26],  // 23 INDIGO_NIGHT
  [0, 23, 23, 24, 25, 26, 27], // 24 COBALT_BROOK
  [23, 23, 24, 25, 26, 27, 31],// 25 CERULEAN_GLASS
  [23, 24, 25, 26, 27, 31, 31],// 26 SKY_SHIMMER
  [24, 25, 26, 27, 31, 31, 31],// 27 ICE_PRISM

  [1, 2, 23, 28, 29, 8, 17],   // 28 SLATE_IRON
  [2, 28, 28, 29, 30, 17, 31], // 29 SILVER_GEAR
  [3, 6, 7, 30, 31, 17, 31],   // 30 WARM_PARCHMENT
  [28, 29, 30, 31, 31, 31, 31],// 31 IVORY_SPARK
];

/** Classic 4x4 Bayer ordered dithering matrix normalized to [0..15] / 16 */
export const BAYER_4X4: readonly number[] = [
   0 / 16,  8 / 16,  2 / 16, 10 / 16,
  12 / 16,  4 / 16, 14 / 16,  6 / 16,
   3 / 16, 11 / 16,  1 / 16,  9 / 16,
  15 / 16,  7 / 16, 13 / 16,  5 / 16,
];

/** 2x2 Bayer matrix normalized to [0..3] / 4 */
export const BAYER_2X2: readonly number[] = [
  0 / 4, 2 / 4,
  3 / 4, 1 / 4,
];

export function bayer4(x: number, y: number): number {
  return BAYER_4X4[((y & 3) << 2) | (x & 3)];
}

export function bayer2(x: number, y: number): number {
  return BAYER_2X2[((y & 1) << 1) | (x & 1)];
}

export function easeOutBack(t: number): number {
  const c = clamp(t, 0, 1) - 1;
  return 1 + 2.70158 * c * c * c + 1.70158 * c * c;
}

/** Quantize time to a discrete animation rate (pixel art steps, never smooth) */
export function stepT(t: number, fps: number): number {
  return Math.floor(t * fps) / fps;
}
