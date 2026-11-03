// Cast & props: chibi presenter, clockwork helper, emote bubbles, data-carrier items (art ported from 4a)
import { C, clamp, snapToPixel } from './palette.ts';
import { PixelSurface } from './surface.ts';

export type Direction = 'down' | 'right' | 'up' | 'left';
export const PRESENTER_POSES = ['idle', 'walk', 'point', 'wave', 'wrench', 'think', 'cheer', 'lantern'] as const;
export type PresenterPose = (typeof PRESENTER_POSES)[number];
export const EMOTES = ['?', '!', 'bulb', 'dots', 'heart', 'star', 'check', 'gear', 'zzz', 'sweat'] as const;
export type EmoteType = (typeof EMOTES)[number];
export const ITEM_KINDS = ['gem', 'scroll', 'ingot', 'core', 'crate', 'orb', 'vial', 'letter'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export const TINTS = ['red', 'blue', 'green', 'gold', 'cyan', 'purple', 'gray', 'wood'] as const;
export type Tint = (typeof TINTS)[number];
export const BADGES = ['check', 'bolt', 'heart', 'star', 'gear', 'dots', '!'] as const;
export type Badge = (typeof BADGES)[number];

/** [dark, mid, light] palette indices for each tint */
export const TINT_RAMP: Record<Tint, readonly [number, number, number]> = {
  red: [C.CRIMSON_BRICK, C.VERMILION_KILN, C.AMBER_GOLD],
  blue: [C.COBALT_BROOK, C.CERULEAN_GLASS, C.SKY_SHIMMER],
  green: [C.FOREST_MOSS, C.SPRING_LEAF, C.DEW_SPROUT],
  gold: [C.EMBER_ORANGE, C.AMBER_GOLD, C.SUNLIGHT_CREAM],
  cyan: [C.CERULEAN_GLASS, C.SKY_SHIMMER, C.ICE_PRISM],
  purple: [C.VIOLET_UMBER, C.MUTED_MULBERRY, C.SILVER_GEAR],
  gray: [C.SLATE_IRON, C.SILVER_GEAR, C.WARM_PARCHMENT],
  wood: [C.ROASTED_OAK, C.CEDAR_PLANK, C.HONEY_PINE],
};

export interface PresenterSpec {
  x: number;
  /** Ground contact (feet) y */
  y: number;
  dir: Direction;
  pose: PresenterPose;
  emote?: EmoteType;
  /** Seconds since the emote appeared (drives pop-in) */
  emoteT?: number;
  lantern?: boolean;
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Chibi Master Artificer, 16x32-class, 10fps walk, 2.8fps idle bob, deterministic blink */
export function drawPresenter(s: PixelSurface, spec: PresenterSpec, t: number): Bounds {
  const sx = snapToPixel(spec.x);
  const sy = snapToPixel(spec.y);
  const walkStep = Math.floor(t * 10) % 4;
  const isWalking = spec.pose === 'walk';
  const cheering = spec.pose === 'cheer';
  const idleBob = !isWalking ? (Math.floor(t * 2.8) % 2 === 1 ? 1 : 0) : 0;
  const stepBounce = isWalking && (walkStep === 1 || walkStep === 3) ? -1 : 0;
  const cheerHop = cheering ? (Math.floor(t * 6) % 2 === 0 ? -2 : 0) : 0;
  const bodyY = sy - 25 + idleBob + stepBounce + cheerHop;

  s.drawGroundShadow(sx, sy, 8, 3, 1.45);

  const flipLeft = spec.dir === 'left';
  const facingBack = spec.dir === 'up';
  const facingSide = spec.dir === 'left' || spec.dir === 'right';

  const leftLegOff = isWalking ? (walkStep === 1 ? -2 : walkStep === 3 ? 1 : 0) : 0;
  const rightLegOff = isWalking ? (walkStep === 3 ? -2 : walkStep === 1 ? 1 : 0) : 0;
  const footY = sy + cheerHop;

  s.fillRect(sx - 5, footY - 4 + leftLegOff, 4, 4, C.PLUM_OUTLINE);
  s.fillRect(sx - 4, footY - 3 + leftLegOff, 3, 2, C.DARK_WALNUT);
  s.pset(sx - 3, footY - 3 + leftLegOff, C.CEDAR_PLANK);
  s.fillRect(sx + 1, footY - 4 + rightLegOff, 4, 4, C.PLUM_OUTLINE);
  s.fillRect(sx + 2, footY - 3 + rightLegOff, 3, 2, C.DARK_WALNUT);
  s.pset(sx + 3, footY - 3 + rightLegOff, C.CEDAR_PLANK);

  // Tunic & leather apron
  const ty = bodyY + 13;
  s.fillRect(sx - 6, ty, 12, 8, C.PLUM_OUTLINE);
  s.fillRect(sx - 5, ty + 1, 10, 6, C.ROASTED_OAK);
  s.fillRect(sx - 4, ty + 1, 8, 2, C.WARM_PARCHMENT);
  s.vline(sx - 3, ty + 1, 5, C.CEDAR_PLANK);
  s.vline(sx + 2, ty + 1, 5, C.CEDAR_PLANK);
  s.fillRect(sx - 3, ty + 3, 6, 4, C.HONEY_PINE);
  s.fillRect(sx - 1, ty + 4, 2, 2, C.AMBER_GOLD);

  // Oversized expressive head
  const hy = bodyY + 5;
  s.fillRect(sx - 7, hy + 1, 14, 7, C.PLUM_OUTLINE);
  s.fillRect(sx - 6, hy, 12, 9, C.PLUM_OUTLINE);
  if (facingBack) {
    s.fillRect(sx - 5, hy + 1, 10, 7, C.DARK_WALNUT);
    s.fillRect(sx - 4, hy + 2, 8, 4, C.ROASTED_OAK);
  } else {
    s.fillRect(sx - 5, hy + 1, 10, 7, C.CREAM_LIMESTONE);
    s.hline(sx - 5, hy + 7, 10, C.SANDSTONE);
    const hairX = flipLeft ? sx + 3 : sx - 5;
    s.fillRect(hairX, hy + 1, 2, 4, C.ROASTED_OAK);

    const blink = t % 3.6 > 3.46;
    const eyeShift = facingSide ? (flipLeft ? -1 : 1) : 0;
    const lookUp = spec.pose === 'think' ? -1 : 0;
    if (blink) {
      s.hline(sx - 3 + eyeShift, hy + 4, 2, C.DARK_WALNUT);
      s.hline(sx + 1 + eyeShift, hy + 4, 2, C.DARK_WALNUT);
    } else if (cheering) {
      // Happy ^ ^ eyes
      s.pset(sx - 3 + eyeShift, hy + 4, C.VOID_INK);
      s.pset(sx - 2 + eyeShift, hy + 3, C.VOID_INK);
      s.pset(sx + 1 + eyeShift, hy + 3, C.VOID_INK);
      s.pset(sx + 2 + eyeShift, hy + 4, C.VOID_INK);
    } else {
      s.fillRect(sx - 3 + eyeShift, hy + 3 + lookUp, 2, 3, C.VOID_INK);
      s.pset(sx - 3 + eyeShift, hy + 3 + lookUp, C.IVORY_SPARK);
      s.fillRect(sx + 1 + eyeShift, hy + 3 + lookUp, 2, 3, C.VOID_INK);
      s.pset(sx + 1 + eyeShift, hy + 3 + lookUp, C.IVORY_SPARK);
    }
    s.pset(sx - 4 + eyeShift, hy + 5, C.EMBER_ORANGE);
    s.pset(sx + 3 + eyeShift, hy + 5, C.EMBER_ORANGE);
  }

  // Pointed artificer cap with brass goggles on the brim
  const capY = bodyY - 2;
  s.fillRect(sx - 8, capY + 6, 16, 3, C.PLUM_OUTLINE);
  s.hline(sx - 7, capY + 7, 14, C.VERMILION_KILN);
  s.hline(sx - 6, capY + 6, 12, C.EMBER_ORANGE);
  s.fillRect(sx - 6, capY + 3, 12, 4, C.CRIMSON_BRICK);
  s.fillRect(sx - 5, capY + 1, 9, 3, C.VERMILION_KILN);
  s.fillRect(sx - 3, capY - 1, 6, 2, C.EMBER_ORANGE);
  s.fillRect(sx - 1, capY - 2, 3, 2, C.AMBER_GOLD);
  s.pset(sx - 6, capY + 2, C.PLUM_OUTLINE);
  s.pset(sx + 5, capY + 2, C.PLUM_OUTLINE);
  if (!facingBack) {
    s.fillRect(sx - 5, capY + 4, 4, 3, C.DARK_WALNUT);
    s.fillRect(sx + 1, capY + 4, 4, 3, C.DARK_WALNUT);
    s.fillRect(sx - 4, capY + 5, 2, 2, C.SKY_SHIMMER, 1);
    s.pset(sx - 4, capY + 5, C.IVORY_SPARK, 1);
    s.fillRect(sx + 2, capY + 5, 2, 2, C.SKY_SHIMMER, 1);
    s.pset(sx + 2, capY + 5, C.IVORY_SPARK, 1);
    s.hline(sx - 1, capY + 5, 2, C.AMBER_GOLD);
  }

  const armSwing = isWalking ? (walkStep === 1 ? -1 : walkStep === 3 ? 1 : 0) : 0;

  // Left arm
  if (spec.pose === 'wave' || cheering) {
    const waveX = spec.pose === 'wave' && Math.floor(t * 8) % 2 === 0 ? -1 : 0;
    s.fillRect(sx - 9 + waveX, ty - 5, 3, 6, C.PLUM_OUTLINE);
    s.fillRect(sx - 8 + waveX, ty - 4, 2, 4, C.WARM_PARCHMENT);
    s.pset(sx - 8 + waveX, ty - 5, C.CREAM_LIMESTONE);
  } else {
    s.fillRect(sx - 8, ty + 1 + armSwing, 3, 5, C.PLUM_OUTLINE);
    s.fillRect(sx - 7, ty + 2 + armSwing, 2, 3, C.WARM_PARCHMENT);
  }

  // Right arm + prop
  if (spec.pose === 'wrench') {
    s.fillRect(sx + 5, ty - 4, 3, 6, C.PLUM_OUTLINE);
    s.fillRect(sx + 6, ty - 3, 2, 4, C.WARM_PARCHMENT);
    s.vline(sx + 7, ty - 10, 7, C.SLATE_IRON, 1);
    s.vline(sx + 8, ty - 10, 7, C.SILVER_GEAR, 1);
    s.fillRect(sx + 6, ty - 12, 4, 3, C.AMBER_GOLD, 1);
    s.pset(sx + 7, ty - 12, C.VOID_INK, 1);
  } else if (spec.pose === 'point') {
    const px = flipLeft ? sx - 10 : sx + 5;
    s.fillRect(px, ty, 6, 3, C.PLUM_OUTLINE);
    s.hline(px + 1, ty + 1, 4, C.CREAM_LIMESTONE);
  } else if (spec.pose === 'think') {
    // Hand to chin
    s.fillRect(sx + 2, ty - 2, 4, 4, C.PLUM_OUTLINE);
    s.fillRect(sx + 3, ty - 1, 2, 2, C.CREAM_LIMESTONE);
  } else if (cheering) {
    s.fillRect(sx + 6, ty - 5, 3, 6, C.PLUM_OUTLINE);
    s.fillRect(sx + 6, ty - 4, 2, 4, C.WARM_PARCHMENT);
    s.pset(sx + 7, ty - 5, C.CREAM_LIMESTONE);
  } else {
    s.fillRect(sx + 5, ty + 1 - armSwing, 3, 5, C.PLUM_OUTLINE);
    s.fillRect(sx + 6, ty + 2 - armSwing, 2, 3, C.WARM_PARCHMENT);
  }

  if (spec.lantern || spec.pose === 'lantern') {
    const lx = flipLeft ? sx - 10 : sx + 9;
    const ly = ty + 4 + (Math.floor(t * 5) % 2);
    s.pset(lx, ly - 2, C.SLATE_IRON);
    s.fillRect(lx - 2, ly - 1, 5, 6, C.PLUM_OUTLINE);
    s.hline(lx - 1, ly, 3, C.ROASTED_OAK);
    s.fillRect(lx - 1, ly + 1, 3, 3, C.AMBER_GOLD, 1);
    s.pset(lx, ly + 2, C.IVORY_SPARK, 1);
    s.hline(lx - 1, ly + 4, 3, C.DARK_WALNUT);
    s.drawDitheredLight(lx, ly + 2, 26 + (Math.floor(t * 6) % 3) * 2, 2.35);
  }

  let top = capY - 2;
  if (spec.emote) {
    drawEmoteBubble(s, sx, capY - 12, spec.emote, clamp((spec.emoteT ?? 1) / 0.35, 0, 1), t);
    top = capY - 22;
  }
  return { x: sx - 11, y: top, w: 22, h: sy + 1 - top };
}

/** 16x14 parchment speech bubble with pop-in */
export function drawEmoteBubble(
  s: PixelSurface,
  cx: number,
  cy: number,
  emote: EmoteType,
  progress: number,
  t: number
): void {
  if (progress <= 0.05) return;
  const pop = progress < 0.35 ? -2 : progress < 0.6 ? 1 : 0;
  const bob = Math.floor(t * 4) % 2;
  const bx = snapToPixel(cx - 8);
  const by = Math.max(2, snapToPixel(cy - 8 + pop - bob));

  s.fillRect(bx + 1, by, 14, 13, C.PLUM_OUTLINE, 1);
  s.fillRect(bx, by + 1, 16, 11, C.PLUM_OUTLINE, 1);
  s.fillRect(bx + 1, by + 1, 14, 11, C.WARM_PARCHMENT, 1);
  s.hline(bx + 2, by + 1, 12, C.IVORY_SPARK, 1);
  s.fillRect(cx - 2, by + 12, 4, 2, C.PLUM_OUTLINE, 1);
  s.hline(cx - 1, by + 12, 2, C.WARM_PARCHMENT, 1);
  s.pset(cx - 1, by + 14, C.PLUM_OUTLINE, 1);

  drawEmoteGlyph(s, bx + 4, by + 3, emote, t);
  if (emote === 'bulb') s.drawDitheredLight(cx, by + 6, 16, 1.4);
}

/** 8x8 glyph drawn at top-left (ix, iy); shared by bubbles and helper badges */
export function drawEmoteGlyph(s: PixelSurface, ix: number, iy: number, emote: EmoteType, t: number): void {
  switch (emote) {
    case '?':
      s.hline(ix + 2, iy, 4, C.VERMILION_KILN, 1);
      s.pset(ix + 1, iy + 1, C.CRIMSON_BRICK, 1);
      s.fillRect(ix + 5, iy + 1, 2, 2, C.VERMILION_KILN, 1);
      s.hline(ix + 3, iy + 3, 2, C.VERMILION_KILN, 1);
      s.pset(ix + 3, iy + 4, C.CRIMSON_BRICK, 1);
      s.fillRect(ix + 3, iy + 6, 2, 2, C.CRIMSON_BRICK, 1);
      break;
    case '!':
      s.fillRect(ix + 3, iy, 2, 5, C.VERMILION_KILN, 1);
      s.vline(ix + 3, iy, 4, C.EMBER_ORANGE, 1);
      s.fillRect(ix + 3, iy + 6, 2, 2, C.CRIMSON_BRICK, 1);
      break;
    case 'bulb':
      s.fillRect(ix + 2, iy, 4, 6, C.PLUM_OUTLINE, 1);
      s.fillRect(ix + 1, iy + 1, 6, 4, C.PLUM_OUTLINE, 1);
      s.fillRect(ix + 2, iy + 1, 4, 4, C.AMBER_GOLD, 1);
      s.fillRect(ix + 3, iy + 1, 2, 3, C.SUNLIGHT_CREAM, 1);
      s.pset(ix + 3, iy + 1, C.IVORY_SPARK, 1);
      s.hline(ix + 2, iy + 6, 4, C.DARK_WALNUT, 1);
      s.hline(ix + 3, iy + 7, 2, C.VOID_INK, 1);
      if (Math.floor(t * 8) % 2 === 0) {
        s.pset(ix, iy, C.EMBER_ORANGE, 1);
        s.pset(ix + 7, iy, C.EMBER_ORANGE, 1);
      }
      break;
    case 'dots': {
      const n = (Math.floor(t * 4) % 3) + 1;
      for (let i = 0; i < n; i++) s.fillRect(ix + i * 3, iy + 3, 2, 2, C.VIOLET_UMBER, 1);
      break;
    }
    case 'heart':
      s.fillRect(ix + 1, iy + 1, 2, 3, C.VERMILION_KILN, 1);
      s.fillRect(ix + 5, iy + 1, 2, 3, C.VERMILION_KILN, 1);
      s.fillRect(ix, iy + 2, 8, 2, C.EMBER_ORANGE, 1);
      s.fillRect(ix + 1, iy + 4, 6, 2, C.VERMILION_KILN, 1);
      s.fillRect(ix + 2, iy + 6, 4, 1, C.CRIMSON_BRICK, 1);
      s.fillRect(ix + 3, iy + 7, 2, 1, C.CRIMSON_BRICK, 1);
      s.pset(ix + 2, iy + 2, C.IVORY_SPARK, 1);
      break;
    case 'star':
      s.vline(ix + 3, iy, 7, C.AMBER_GOLD, 1);
      s.hline(ix, iy + 3, 7, C.AMBER_GOLD, 1);
      s.fillRect(ix + 2, iy + 2, 3, 3, C.SUNLIGHT_CREAM, 1);
      s.pset(ix + 3, iy + 3, C.IVORY_SPARK, 1);
      break;
    case 'check':
      s.pset(ix + 1, iy + 4, C.FOREST_MOSS, 1);
      s.fillRect(ix + 2, iy + 5, 2, 2, C.FOREST_MOSS, 1);
      s.line(ix + 3, iy + 5, ix + 7, iy + 1, C.FOREST_MOSS, 1);
      s.line(ix + 3, iy + 4, ix + 6, iy + 1, C.SPRING_LEAF, 1);
      break;
    case 'gear': {
      const f = Math.floor(t * 8) % 2;
      s.fillRect(ix + 2, iy + 2, 4, 4, C.SLATE_IRON, 1);
      s.fillRect(ix + 3, iy + 3, 2, 2, C.WARM_PARCHMENT, 1);
      if (f === 0) {
        s.fillRect(ix + 3, iy, 2, 2, C.SLATE_IRON, 1);
        s.fillRect(ix + 3, iy + 6, 2, 2, C.SLATE_IRON, 1);
        s.fillRect(ix, iy + 3, 2, 2, C.SLATE_IRON, 1);
        s.fillRect(ix + 6, iy + 3, 2, 2, C.SLATE_IRON, 1);
      } else {
        s.fillRect(ix + 1, iy + 1, 2, 2, C.SLATE_IRON, 1);
        s.fillRect(ix + 5, iy + 1, 2, 2, C.SLATE_IRON, 1);
        s.fillRect(ix + 1, iy + 5, 2, 2, C.SLATE_IRON, 1);
        s.fillRect(ix + 5, iy + 5, 2, 2, C.SLATE_IRON, 1);
      }
      break;
    }
    case 'zzz':
      s.hline(ix + 3, iy, 4, C.COBALT_BROOK, 1);
      s.pset(ix + 5, iy + 1, C.COBALT_BROOK, 1);
      s.hline(ix + 3, iy + 2, 4, C.COBALT_BROOK, 1);
      s.hline(ix, iy + 4, 3, C.CERULEAN_GLASS, 1);
      s.pset(ix + 1, iy + 5, C.CERULEAN_GLASS, 1);
      s.hline(ix, iy + 6, 3, C.CERULEAN_GLASS, 1);
      break;
    case 'sweat':
      s.pset(ix + 4, iy, C.SKY_SHIMMER, 1);
      s.fillRect(ix + 3, iy + 1, 3, 2, C.SKY_SHIMMER, 1);
      s.fillRect(ix + 2, iy + 3, 5, 3, C.CERULEAN_GLASS, 1);
      s.pset(ix + 3, iy + 3, C.IVORY_SPARK, 1);
      s.hline(ix + 3, iy + 6, 3, C.COBALT_BROOK, 1);
      break;
  }
}

export interface ItemSpec {
  kind: ItemKind;
  tint: Tint;
  /** Up to ~6 ASCII chars drawn above the item in mini font */
  glyph?: string;
}

/** Data-carrier item centered on (x, y); generalizes 4a token gem / ingot / binary core / scroll */
export function drawItem(s: PixelSurface, sx: number, sy: number, item: ItemSpec, t: number, showGlyph = true): void {
  const [dark, mid, light] = TINT_RAMP[item.tint];
  const x = snapToPixel(sx);
  const bobY = item.kind === 'gem' || item.kind === 'orb' ? (Math.floor(t * 6) % 2 === 0 ? 0 : -1) : 0;
  const y = snapToPixel(sy) + bobY;
  let topY = y - 5;

  switch (item.kind) {
    case 'gem':
      s.fillRect(x - 4, y - 3, 9, 7, C.PLUM_OUTLINE, 1);
      s.fillRect(x - 3, y - 4, 7, 9, C.PLUM_OUTLINE, 1);
      s.fillRect(x - 3, y - 3, 7, 7, mid, 1);
      s.fillRect(x - 2, y - 3, 4, 3, light, 1);
      s.hline(x - 3, y + 3, 7, dark, 1);
      s.pset(x - 2, y - 2, C.IVORY_SPARK, 1);
      break;
    case 'ingot':
      s.fillRect(x - 8, y - 4, 16, 8, C.PLUM_OUTLINE, 1);
      s.fillRect(x - 7, y - 3, 14, 3, light, 1);
      s.fillRect(x - 7, y, 14, 3, mid, 1);
      s.hline(x - 7, y + 2, 14, dark, 1);
      s.pset(x - 5, y - 2, C.IVORY_SPARK, 1);
      if (Math.floor(t * 7) % 3 === 0) {
        s.hline(x + 4, y - 4, 5, C.IVORY_SPARK, 1);
        s.vline(x + 6, y - 6, 5, C.IVORY_SPARK, 1);
      }
      s.drawDitheredLight(x, y, 14, 1.35);
      topY = y - 6;
      break;
    case 'core': {
      const pulse = Math.floor(t * 8) % 2 === 0;
      s.fillRect(x - 6, y - 4, 12, 8, C.PLUM_OUTLINE, 1);
      s.fillRect(x - 5, y - 3, 10, 6, C.INDIGO_NIGHT, 1);
      s.vline(x - 5, y - 3, 6, mid, 1);
      s.vline(x + 4, y - 3, 6, mid, 1);
      s.vline(x - 3, y - 2, 4, pulse ? C.ICE_PRISM : C.SKY_SHIMMER, 1);
      s.pset(x - 1, y - 1, C.DEW_SPROUT, 1);
      s.vline(x + 1, y - 2, 4, pulse ? C.SUNLIGHT_CREAM : C.ICE_PRISM, 1);
      s.pset(x + 2, y + 1, C.DEW_SPROUT, 1);
      s.drawDitheredLight(x, y, 13, 1.45);
      break;
    }
    case 'scroll':
      s.fillRect(x - 7, y - 4, 14, 8, C.PLUM_OUTLINE);
      s.fillRect(x - 6, y - 3, 12, 6, C.WARM_PARCHMENT, 1);
      s.hline(x - 6, y - 3, 12, C.IVORY_SPARK, 1);
      s.vline(x, y - 3, 6, mid, 1);
      s.fillRect(x - 1, y - 1, 3, 3, light, 1);
      break;
    case 'crate':
      s.fillRect(x - 6, y - 6, 12, 11, C.PLUM_OUTLINE);
      s.fillRect(x - 5, y - 5, 10, 9, mid);
      s.hline(x - 5, y - 5, 10, light);
      s.hline(x - 5, y, 10, dark);
      s.vline(x - 1, y - 5, 9, dark);
      s.fillRect(x - 2, y - 2, 3, 3, light, 1);
      topY = y - 7;
      break;
    case 'orb':
      s.fillEllipse(x, y, 4, 4, C.PLUM_OUTLINE, 1);
      s.fillEllipse(x, y, 3, 3, mid, 1);
      s.fillRect(x - 2, y - 2, 2, 2, light, 1);
      s.pset(x - 2, y - 2, C.IVORY_SPARK, 1);
      s.drawDitheredLight(x, y, 12, 1.2);
      break;
    case 'vial':
      s.fillRect(x - 3, y - 7, 6, 12, C.PLUM_OUTLINE, 1);
      s.fillRect(x - 2, y - 6, 4, 3, C.ICE_PRISM, 1);
      s.fillRect(x - 2, y - 3, 4, 7, mid, 1);
      s.vline(x - 2, y - 3, 6, light, 1);
      s.fillRect(x - 2, y - 9, 4, 2, C.ROASTED_OAK);
      topY = y - 10;
      break;
    case 'letter':
      s.fillRect(x - 7, y - 5, 14, 10, C.PLUM_OUTLINE, 1);
      s.fillRect(x - 6, y - 4, 12, 8, C.WARM_PARCHMENT, 1);
      s.line(x - 6, y - 4, x, y, C.SANDSTONE, 1);
      s.line(x + 5, y - 4, x, y, C.SANDSTONE, 1);
      s.fillRect(x - 1, y - 1, 3, 3, mid, 1);
      topY = y - 6;
      break;
  }

  if (showGlyph && item.glyph) {
    const w = item.glyph.length * 5 - 1;
    s.drawMiniText(x - Math.floor(w / 2), topY - 6, item.glyph, C.IVORY_SPARK, C.VOID_INK, 1);
  }
}

const ITEM_SCRATCH = new PixelSurface(40, 32);

/** Item drawn ×k (interior close-ups); glyph stays 1× above it */
export function drawItemScaled(s: PixelSurface, x: number, y: number, item: ItemSpec, t: number, k: number, showGlyph = true): void {
  ITEM_SCRATCH.clear(C.VOID_INK, 0);
  drawItem(ITEM_SCRATCH, 20, 18, { ...item, glyph: undefined }, t, false);
  for (let i = 0; i < ITEM_SCRATCH.emissiveBuf.length; i++) if (ITEM_SCRATCH.colorBuf[i] !== C.VOID_INK) ITEM_SCRATCH.emissiveBuf[i] = 1;
  s.blitEmissiveScaled(ITEM_SCRATCH, snapToPixel(x) - 20 * k, snapToPixel(y) - 18 * k, k);
  if (showGlyph && item.glyph) {
    const w = item.glyph.length * 5 - 1;
    s.drawMiniText(snapToPixel(x) - Math.floor(w / 2), snapToPixel(y) - 12 * k, item.glyph, C.IVORY_SPARK, C.VOID_INK, 1);
  }
}

/** 14x18 clockwork helper with rotating wind-up key; may carry an item or show a status badge */
export function drawHelper(
  s: PixelSurface,
  wx: number,
  wy: number,
  t: number,
  seed: number,
  state: 'idle' | 'work' | 'sleep',
  badge?: Badge,
  carrying?: ItemSpec
): Bounds {
  const sx = snapToPixel(wx);
  const sy = snapToPixel(wy);
  const rate = state === 'work' ? 12 : state === 'sleep' ? 0 : 9;
  const hop = state !== 'sleep' && Math.floor(t * rate + seed) % 4 === 1 ? -1 : 0;
  const keyFrame = state === 'sleep' ? 0 : Math.floor(t * (state === 'work' ? 12 : 8) + seed * 1.7) % 4;

  s.drawGroundShadow(sx, sy, 5, 2, 1.15);
  const step = state === 'sleep' ? 0 : Math.floor(t * 10 + seed) % 2;
  s.fillRect(sx - 4, sy - 2 - step, 3, 2, C.DARK_WALNUT);
  s.fillRect(sx + 1, sy - 2 - (state === 'sleep' ? 0 : 1 - step), 3, 2, C.DARK_WALNUT);

  const ky = sy - 14 + hop;
  s.vline(sx, ky + 1, 3, C.SILVER_GEAR);
  if (keyFrame === 0 || keyFrame === 2) {
    s.strokeRect(sx - 3, ky - 2, 7, 4, C.AMBER_GOLD);
    s.pset(sx - 2, ky - 1, C.SUNLIGHT_CREAM);
  } else {
    s.fillRect(sx - 1, ky - 2, 3, 4, C.AMBER_GOLD);
  }

  const by = sy - 11 + hop;
  s.fillRect(sx - 5, by + 1, 10, 8, C.PLUM_OUTLINE);
  s.fillRect(sx - 4, by, 8, 9, C.PLUM_OUTLINE);
  s.fillRect(sx - 4, by + 1, 8, 7, C.AMBER_GOLD);
  s.hline(sx - 3, by + 1, 6, C.SUNLIGHT_CREAM);
  s.fillRect(sx - 3, by + 3, 6, 3, C.INDIGO_NIGHT);
  if (state === 'sleep') {
    s.hline(sx - 2, by + 4, 1, C.SLATE_IRON);
    s.hline(sx + 1, by + 4, 1, C.SLATE_IRON);
  } else {
    s.pset(sx - 2, by + 4, C.DEW_SPROUT, 1);
    s.pset(sx + 1, by + 4, C.DEW_SPROUT, 1);
  }

  if (carrying) {
    drawItem(s, sx, by - 7, carrying, t, false);
  } else if (badge || state === 'sleep') {
    const iy = by - 12 - (Math.floor(t * 5 + seed) % 2);
    const glyph: EmoteType = state === 'sleep' && !badge ? 'zzz' : badge === 'bolt' ? '!' : (badge ?? 'dots');
    drawEmoteGlyph(s, sx - 4, iy, glyph, t + seed * 0.2);
  }
  return { x: sx - 6, y: by - 14, w: 12, h: sy - by + 14 };
}

/** Deterministic dust puff for build/placement frames */
export function drawDustPuff(s: PixelSurface, sx: number, sy: number, progress: number, radius = 12): void {
  const p = clamp(progress, 0, 1);
  if (p <= 0 || p >= 1) return;
  const r = p * radius;
  const size = p < 0.45 ? 3 : p < 0.78 ? 2 : 1;
  const col = p < 0.4 ? C.IVORY_SPARK : C.WARM_PARCHMENT;
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.4;
    s.fillRect(sx + Math.cos(ang) * r, sy + Math.sin(ang) * r * 0.55 - p * 4, size, size, col, 1);
  }
}

/** Rotating pixel gear with 8 teeth */
export function drawPixelGear(
  s: PixelSurface,
  cx: number,
  cy: number,
  radius: number,
  rimCol: number,
  faceCol: number,
  phase: number
): void {
  const ix = snapToPixel(cx);
  const iy = snapToPixel(cy);
  s.fillEllipse(ix, iy, radius, radius, C.PLUM_OUTLINE);
  s.fillEllipse(ix, iy, radius - 1, radius - 1, faceCol);
  s.fillEllipse(ix, iy, Math.max(2, radius - 4), Math.max(2, radius - 4), rimCol);
  s.fillRect(ix - 1, iy - 1, 3, 3, C.VOID_INK);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + phase;
    s.fillRect(snapToPixel(ix + Math.cos(a) * (radius + 1)) - 1, snapToPixel(iy + Math.sin(a) * (radius + 1)) - 1, 2, 2, faceCol);
  }
}
