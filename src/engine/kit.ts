// Station kit: build a topic-specific station from parts (body × material × parts × icon × anim), in 4a's pixel style
import { C, bayer4, clamp, hash2, snapToPixel } from './palette.ts';
import { PixelSurface } from './surface.ts';
import { TINTS, TINT_RAMP, drawPixelGear } from './sprites.ts';
import type { Bounds, Tint } from './sprites.ts';

export const KIT_BODIES = ['box', 'house', 'dome', 'tower', 'tank', 'orb', 'blob', 'arch', 'platform', 'stack'] as const;
export const KIT_MATERIALS = ['wood', 'brick', 'stone', 'metal', 'glass', 'crystal', 'flesh', 'leaf', 'concrete', 'plastic'] as const;
export const KIT_PARTS = [
  'pipe', 'valve', 'funnel', 'nozzle', 'drip',
  'gear', 'fan', 'wheel', 'piston', 'crank', 'conveyor-port',
  'chimney', 'window', 'door', 'roof-flag', 'ladder', 'lamp',
  'screen', 'antenna', 'led-row', 'cable', 'coil',
  'chamber', 'membrane', 'roots', 'cilia', 'vessel', 'leafcap',
] as const;
export const KIT_ICONS = [
  'heart', 'lung', 'drop', 'bolt', 'leaf', 'flame', 'snowflake', 'gear', 'chip', 'box', 'mail', 'cart',
  'house', 'factory', 'cell', 'dna', 'shield', 'lock', 'magnifier', 'clock', 'check', 'recycle', 'globe', 'signal',
] as const;
export const KIT_ANIMS = ['pulse', 'spin', 'flow', 'glow', 'smoke', 'shake', 'blink', 'bubble', 'drip', 'sparks'] as const;
export const KIT_SLOTS = ['top', 'left', 'right', 'front'] as const;

export type KitBody = (typeof KIT_BODIES)[number];
export type KitMaterial = (typeof KIT_MATERIALS)[number];
export type KitPartType = (typeof KIT_PARTS)[number];
export type KitIcon = (typeof KIT_ICONS)[number];
export type KitAnim = (typeof KIT_ANIMS)[number];
export type KitSlot = (typeof KIT_SLOTS)[number];

export interface KitPart {
  type: KitPartType;
  at?: KitSlot;
  /** chamber: 1–4 cells; others ignore */
  count?: number;
}

export interface KitSpec {
  body: KitBody;
  material: KitMaterial;
  /** Accent / body colour family; defaults to the station tint */
  tint?: Tint;
  size?: 's' | 'm' | 'l';
  parts?: KitPart[];
  icon?: KitIcon;
  anim?: KitAnim[];
}

export interface KitDraw {
  build: number;
  active: boolean;
  tint: Tint;
  power: number;
  tod: number;
  screen?: string;
}

/** Where a part goes when `at` is omitted */
const DEFAULT_SLOT: Record<KitPartType, KitSlot> = {
  pipe: 'right', valve: 'right', funnel: 'top', nozzle: 'right', drip: 'front',
  gear: 'front', fan: 'front', wheel: 'front', piston: 'top', crank: 'right', 'conveyor-port': 'left',
  chimney: 'top', window: 'front', door: 'front', 'roof-flag': 'top', ladder: 'right', lamp: 'left',
  screen: 'front', antenna: 'top', 'led-row': 'front', cable: 'right', coil: 'front',
  chamber: 'front', membrane: 'front', roots: 'front', cilia: 'top', vessel: 'top', leafcap: 'top',
};

export const KIT_MAX_PARTS = 6;

export function validateKit(k: KitSpec, where: string): string[] {
  const errs: string[] = [];
  if (!KIT_BODIES.includes(k.body)) errs.push(`${where}: kit body "${k.body}" not in ${KIT_BODIES.join('|')}`);
  if (!KIT_MATERIALS.includes(k.material)) errs.push(`${where}: kit material "${k.material}" not in ${KIT_MATERIALS.join('|')}`);
  if (k.tint !== undefined && !TINTS.includes(k.tint)) errs.push(`${where}: kit tint "${k.tint}" invalid`);
  if (k.size !== undefined && !['s', 'm', 'l'].includes(k.size)) errs.push(`${where}: kit size must be s|m|l`);
  const parts = k.parts ?? [];
  if (parts.length > KIT_MAX_PARTS) errs.push(`${where}: kit allows at most ${KIT_MAX_PARTS} parts (got ${parts.length})`);
  parts.forEach((p, i) => {
    if (!KIT_PARTS.includes(p.type)) errs.push(`${where}: kit parts[${i}] "${p.type}" not in ${KIT_PARTS.join('|')}`);
    if (p.at !== undefined && !KIT_SLOTS.includes(p.at)) errs.push(`${where}: kit parts[${i}].at "${p.at}" not in ${KIT_SLOTS.join('|')}`);
  });
  if (k.icon !== undefined && !KIT_ICONS.includes(k.icon)) errs.push(`${where}: kit icon "${k.icon}" not in ${KIT_ICONS.join('|')}`);
  for (const a of k.anim ?? []) if (!KIT_ANIMS.includes(a)) errs.push(`${where}: kit anim "${a}" not in ${KIT_ANIMS.join('|')}`);
  return errs;
}

// ---------------------------------------------------------------- materials
type Ramp = readonly [number, number, number];
interface MaterialSpec {
  ramp: (tint: Tint) => Ramp;
  /** Optional texture colour override at local (x, y) */
  texture: (x: number, y: number, r: Ramp, w: number, h: number) => number | null;
  /** Glossy specular streaks */
  gloss: boolean;
}

const MAT: Record<KitMaterial, MaterialSpec> = {
  wood: {
    ramp: () => [C.ROASTED_OAK, C.CEDAR_PLANK, C.HONEY_PINE],
    texture: (x, y, r) => (y % 6 === 0 ? r[0] : (x + Math.floor(y / 6) * 7) % 17 === 0 ? r[0] : null),
    gloss: false,
  },
  brick: {
    ramp: () => [C.CRIMSON_BRICK, C.VERMILION_KILN, C.EMBER_ORANGE],
    texture: (x, y) => (y % 5 === 0 || (x + (Math.floor(y / 5) % 2) * 4) % 8 === 0 ? C.DARK_WALNUT : null),
    gloss: false,
  },
  stone: {
    ramp: () => [C.OCHRE_STONE, C.SANDSTONE, C.CREAM_LIMESTONE],
    texture: (x, y) => (y % 9 === 0 || (x + (Math.floor(y / 9) % 2) * 6) % 12 === 0 ? C.TERRACOTTA_EARTH : null),
    gloss: false,
  },
  metal: {
    ramp: () => [C.SLATE_IRON, C.SILVER_GEAR, C.WARM_PARCHMENT],
    texture: (x, y, r, w) => ((x === 3 || x === w - 4) && y % 6 === 3 ? r[2] : y % 14 === 13 ? r[0] : null),
    gloss: true,
  },
  glass: {
    ramp: (t) => (t === 'green' ? [C.FOREST_MOSS, C.MEADOW_GREEN, C.DEW_SPROUT] : [C.COBALT_BROOK, C.CERULEAN_GLASS, C.SKY_SHIMMER]),
    texture: (x, y, r) => (x % 14 === 0 || y % 14 === 0 ? r[0] : ((x - y) % 16 === 0 || (x - y) % 16 === 2) ? C.ICE_PRISM : null),
    gloss: false,
  },
  crystal: {
    ramp: (t) => TINT_RAMP[t],
    texture: (x, y, r) => ((x + y) % 11 === 0 ? r[2] : (x - y + 64) % 13 === 0 ? r[0] : null),
    gloss: true,
  },
  flesh: {
    ramp: (t) => (t === 'purple' ? [C.VIOLET_UMBER, C.MUTED_MULBERRY, C.VERMILION_KILN] : t === 'gold' ? [C.EMBER_ORANGE, C.SANDSTONE, C.CREAM_LIMESTONE] : [C.CRIMSON_BRICK, C.VERMILION_KILN, C.EMBER_ORANGE]),
    texture: (x, y, r) => ((hash2(x >> 1, y >> 1) & 15) === 0 ? r[2] : (hash2(x, y) & 31) === 1 ? r[0] : null),
    gloss: true,
  },
  leaf: {
    ramp: () => [C.FOREST_MOSS, C.MEADOW_GREEN, C.SPRING_LEAF],
    texture: (x, y, r, w) => (Math.abs(x - w / 2) < 1 || (Math.abs(x - w / 2) === y % 9 && y > 4) ? r[2] : null),
    gloss: false,
  },
  concrete: {
    ramp: () => [C.SLATE_IRON, C.SILVER_GEAR, C.WARM_PARCHMENT],
    texture: (x, y, r) => ((hash2(x, y) & 15) === 0 ? r[0] : y % 18 === 17 ? r[0] : null),
    gloss: false,
  },
  plastic: {
    ramp: (t) => TINT_RAMP[t],
    texture: () => null,
    gloss: true,
  },
};

/**
 * Fill an arbitrary silhouette in 4a style: 1px plum outline, top-left rim light, bottom-right shade,
 * optional texture and gloss. inside(x, y) is in local coords (0..w-1, 0..h-1).
 */
export function shadeShape(
  s: PixelSurface,
  x0: number,
  y0: number,
  w: number,
  h: number,
  inside: (x: number, y: number) => boolean,
  ramp: readonly [number, number, number],
  opts: { texture?: (x: number, y: number) => number | null; gloss?: boolean; emissive?: number } = {}
): void {
  const em = opts.emissive ?? 0;
  const ins = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && inside(x, y);
  for (let ly = 0; ly < h; ly++) {
    for (let lx = 0; lx < w; lx++) {
      if (!inside(lx, ly)) continue;
      if (!ins(lx - 1, ly) || !ins(lx + 1, ly) || !ins(lx, ly - 1) || !ins(lx, ly + 1)) {
        s.pset(x0 + lx, y0 + ly, C.PLUM_OUTLINE, em);
        continue;
      }
      let col: number = ramp[1];
      if (!ins(lx - 2, ly - 1) || !ins(lx - 1, ly - 2)) col = ramp[2];
      else if (!ins(lx + 2, ly + 1) || !ins(lx + 1, ly + 2) || !ins(lx + 3, ly + 3)) col = ramp[0];
      const tex = opts.texture?.(lx, ly);
      if (tex !== null && tex !== undefined) col = tex;
      s.pset(x0 + lx, y0 + ly, col, em);
    }
  }
  if (opts.gloss) {
    // short glossy streak near the upper-left of the shape
    let gx = -1;
    let gy = -1;
    for (let ly = Math.floor(h * 0.15); ly < h * 0.5 && gx < 0; ly++) for (let lx = Math.floor(w * 0.15); lx < w * 0.45; lx++) if (ins(lx - 2, ly) && ins(lx, ly - 2)) { gx = lx; gy = ly; break; }
    if (gx >= 0) for (let i = 0; i < 6; i++) if (ins(gx + (i >> 1), gy + i)) s.pset(x0 + gx + (i >> 1), y0 + gy + i, i % 2 ? ramp[2] : C.IVORY_SPARK, em);
  }
}

// ---------------------------------------------------------------- body silhouettes
const SIZE: Record<'s' | 'm' | 'l', readonly [number, number]> = { s: [40, 40], m: [52, 56], l: [62, 70] };

interface Shape {
  w: number;
  h: number;
  inside: (x: number, y: number) => boolean;
}

function bodyShape(body: KitBody, w: number, h: number): Shape {
  const cx = (w - 1) / 2;
  switch (body) {
    case 'box':
      return { w, h, inside: () => true };
    case 'house': {
      const roof = Math.floor(h * 0.38);
      return { w, h, inside: (x, y) => y >= roof || Math.abs(x - cx) <= ((y + 1) / roof) * (w / 2) };
    }
    case 'dome': {
      const r = w / 2;
      return { w, h, inside: (x, y) => y >= r || (x - cx) ** 2 + (y - r) ** 2 <= r * r };
    }
    case 'tower': {
      const shaft = w * 0.32;
      return { w, h, inside: (x, y) => (y < 8 ? Math.abs(x - cx) <= w * 0.42 : y > h - 8 ? true : Math.abs(x - cx) <= shaft) };
    }
    case 'tank': {
      const ry = Math.max(3, Math.floor(w * 0.16));
      return {
        w, h,
        inside: (x, y) => {
          const nx = (x - cx) / (w / 2);
          if (y < ry) return nx * nx + ((y - ry) / ry) ** 2 <= 1;
          if (y > h - ry) return nx * nx + ((y - (h - ry)) / ry) ** 2 <= 1;
          return true;
        },
      };
    }
    case 'orb': {
      const r = Math.min(w, h) / 2;
      return { w, h, inside: (x, y) => (x - cx) ** 2 + (y - (h - r)) ** 2 <= r * r };
    }
    case 'blob': {
      const cy = h * 0.55;
      return {
        w, h,
        inside: (x, y) => {
          const a = Math.atan2(y - cy, x - cx);
          const r = 1 + 0.09 * Math.sin(3 * a + 1) + 0.06 * Math.sin(5 * a + 2);
          // radii shrunk by the max wobble (1.15) so the outline never touches the bounding box
          return ((x - cx) / (w / 2 / 1.16)) ** 2 + ((y - cy) / (h * 0.46 / 1.16)) ** 2 <= r * r;
        },
      };
    }
    case 'arch': {
      const ow = w * 0.26;
      const oh = h * 0.55;
      return {
        w, h,
        inside: (x, y) => {
          const dx = Math.abs(x - cx);
          const top = h - oh;
          const inOpening = dx < ow && (y > top + ow || (y > top && dx * dx + (y - top - ow) ** 2 < ow * ow));
          return !inOpening;
        },
      };
    }
    case 'platform': {
      const top = h - 24;
      return { w, h, inside: (x, y) => (y >= top && y < top + 9) || (y >= top + 9 && (x < 6 || x > w - 7)) };
    }
    case 'stack': {
      const tiers = 3;
      const th = h / tiers;
      return { w, h, inside: (x, y) => Math.abs(x - cx) <= w / 2 - (tiers - 1 - Math.floor(y / th)) * 3 };
    }
  }
}

// ---------------------------------------------------------------- icons (11×11)
type IconSpec = { rows: readonly string[]; tint: Tint };
const ICONS: Record<KitIcon, IconSpec> = {
  heart: { tint: 'red', rows: ['..ooo.ooo..', '.ollmommmo.', 'olllmmmmmmo', 'olmmmmmmmmo', 'ommmmmmmmmo', '.ommmmmmmo.', '..ommmmmo..', '...ommmo...', '....omo....', '.....o.....', '...........'] },
  lung: { tint: 'red', rows: ['....oco....', '....oco....', '..ooocooo..', '.ollmcmllo.', 'olmmmcmmmmo', 'ommmmcmmmmo', 'ommmmcmmmmo', 'ommmo.ommmo', '.ooo...ooo.', '...........', '...........'] },
  drop: { tint: 'blue', rows: ['.....o.....', '....omo....', '....omo....', '...ommmo...', '..omlmmmo..', '..olmmmmo..', '.omlmmmmmo.', '.ommmmmmmo.', '.ommmmmmdo.', '..ommmmdo..', '...ooooo...'] },
  bolt: { tint: 'gold', rows: ['......ooo..', '.....olo...', '....olo....', '...olmo....', '..ommmmoo..', '..oooommo..', '....omo....', '...omo.....', '..omo......', '..oo.......', '...........'] },
  leaf: { tint: 'green', rows: ['........oo.', '......oomo.', '....oommmo.', '...ommmlmo.', '..ommmlmmo.', '.ommmlmmo..', '.ommlmmo...', '.omlmmo....', '.olmoo.....', 'oo.o.......', 'o..........'] },
  flame: { tint: 'gold', rows: ['.....o.....', '....omo....', '....omo..o.', '...ommmoomo', '..ommlmmmmo', '..omllmmmmo', '.omllllmmo.', '.omlwwlmmo.', '.omlwwlmmo.', '..omllmmo..', '...ooooo...'] },
  snowflake: { tint: 'cyan', rows: ['.....m.....', '...m.m.m...', '....mmm....', '.m..mlm..m.', '..mmmlmmm..', 'mmlllwlllmm', '..mmmlmmm..', '.m..mlm..m.', '....mmm....', '...m.m.m...', '.....m.....'] },
  gear: { tint: 'gray', rows: ['....ooo....', '.oo.omo.oo.', '.ommmmmmmo.', '..ommmmmo..', 'oommo.ommoo', 'ommm...mmmo', 'oommo.ommoo', '..ommmmmo..', '.ommmmmmmo.', '.oo.omo.oo.', '....ooo....'] },
  chip: { tint: 'gold', rows: ['..l.l.l.l..', '..l.l.l.l..', '.ooooooooo.', 'lodddddddol', '.odcccccdo.', 'lodcwwwcdol', '.odcccccdo.', 'lodddddddol', '.ooooooooo.', '..l.l.l.l..', '..l.l.l.l..'] },
  box: { tint: 'wood', rows: ['...........', '.ooooooooo.', '.olllolllo.', '.ommmommmo.', '.ommmommmo.', '.odddodddo.', '.ommmommmo.', '.ommmommmo.', '.ommmommmo.', '.ooooooooo.', '...........'] },
  mail: { tint: 'red', rows: ['...........', 'ooooooooooo', 'oowwwwwwwoo', 'owowwwwwowo', 'owwowwwowwo', 'owwwomowwwo', 'owwwwowwwwo', 'owwwwwwwwwo', 'ooooooooooo', '...........', '...........'] },
  cart: { tint: 'gray', rows: ['...........', 'oo.........', '.o.........', '.ooooooooo.', '.ommmmmmmo.', '..olllllo..', '..ommmmmo..', '...ooooo...', '...........', '..oo...oo..', '..oo...oo..'] },
  house: { tint: 'red', rows: ['.....o.....', '....omo....', '...ommmo...', '..ommmmmo..', '.ommmmmmmo.', 'ooooooooooo', '.owwwwwwwo.', '.owwoowwwo.', '.owwoowlwo.', '.owwoowwwo.', '.ooooooooo.'] },
  factory: { tint: 'gray', rows: ['.oo........', '.mo........', '.mo..o...o.', '.mo.om..om.', '.mooomooomo', '.ommmmmmmmo', '.omlmlmlmmo', '.ommmmmmmmo', '.omlmlmlmmo', '.ommmmmmmmo', '.oooooooooo'] },
  cell: { tint: 'green', rows: ['...ooooo...', '..ommmmmo..', '.ommmmmmmo.', 'ommmdddmmmo', 'ommdddddmmo', 'ommdddddmmo', 'ommmdddmmmo', 'omlmmmmmmmo', '.olmmmmmmo.', '..ommmmmo..', '...ooooo...'] },
  dna: { tint: 'blue', rows: ['.m.......l.', '..m.....l..', '...mwwwl...', '....m.l....', '.....x.....', '....l.m....', '...lwwwm...', '..l.....m..', '.l.......m.', '..l.....m..', '...lwwwm...'] },
  shield: { tint: 'blue', rows: ['ooooooooooo', 'ommmmlmmmmo', 'ommmmlmmmmo', 'olllllllllo', 'ommmmlmmmmo', '.ommmlmmmo.', '.ommmlmmmo.', '..ommlmmo..', '...omlmo...', '....olo....', '.....o.....'] },
  lock: { tint: 'gold', rows: ['...ooooo...', '..oo...oo..', '..o.....o..', '..o.....o..', '.ooooooooo.', '.ommmmmmmo.', '.ommmdmmmo.', '.ommdddmmo.', '.ommmdmmmo.', '.ommmmmmmo.', '.ooooooooo.'] },
  magnifier: { tint: 'cyan', rows: ['..ooooo....', '.olllllo...', 'olwllllllo.', 'ollllllllo.', 'ollllllllo.', 'ollllllllo.', '.olllllo...', '..oooooo...', '.......oo..', '........oo.', '.........oo'] },
  clock: { tint: 'gray', rows: ['...ooooo...', '..owwwwwo..', '.owwwmwwwo.', 'owwwwmwwwwo', 'owwwwmwwwwo', 'owwwwmmmwwo', 'owwwwwwwwwo', 'owwwwwwwwwo', '.owwwwwwwo.', '..owwwwwo..', '...ooooo...'] },
  check: { tint: 'green', rows: ['...........', '.........oo', '........omo', '.......omo.', 'oo....omo..', 'omo..omo...', '.omoomo....', '..ommo.....', '...oo......', '...........', '...........'] },
  recycle: { tint: 'green', rows: ['.....o.....', '....omo....', '...omlmo...', '..omo.omo..', '..mo...om..', '.omo...omo.', 'omo.....omo', 'ommmmmmmmmo', 'ooooooooooo', '...........', '...........'] },
  globe: { tint: 'blue', rows: ['...ooooo...', '..ommcmmo..', '.omcccmmmo.', 'omccmmmccmo', 'omcmmmmmcmo', 'ommmmmccmmo', 'omccmmmmmmo', 'ommccmmccmo', '.ommmmmcco.', '..ommmmmo..', '...ooooo...'] },
  signal: { tint: 'cyan', rows: ['...........', '..ooooooo..', '.o.......o.', 'o..ooooo..o', '..o.....o..', '.o..ooo..o.', '...o...o...', '.....m.....', '....mmm....', '.....m.....', '...........'] },
};

function drawIcon(s: PixelSurface, cx: number, cy: number, icon: KitIcon): void {
  const spec = ICONS[icon];
  const [dk, md, lt] = TINT_RAMP[spec.tint];
  const x0 = snapToPixel(cx) - 7;
  const y0 = snapToPixel(cy) - 7;
  s.fillRect(x0, y0, 15, 15, C.PLUM_OUTLINE, 1);
  s.fillRect(x0 + 1, y0 + 1, 13, 13, C.WARM_PARCHMENT, 1);
  s.hline(x0 + 1, y0 + 1, 13, C.IVORY_SPARK, 1);
  const map: Record<string, number> = { o: C.PLUM_OUTLINE, m: md, l: lt, d: dk, w: C.IVORY_SPARK, c: spec.tint === 'blue' ? C.SPRING_LEAF : C.SANDSTONE, x: C.AMBER_GOLD };
  spec.rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const col = map[row[rx]];
      if (col !== undefined) s.pset(x0 + 2 + rx, y0 + 2 + ry, col, 1);
    }
  });
}

// ---------------------------------------------------------------- parts
interface PartCtx {
  s: PixelSurface;
  t: number;
  on: boolean;
  anims: ReadonlySet<KitAnim>;
  ramp: Ramp;
  accent: Ramp;
  screen?: string;
  /** body bounds */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const O = C.PLUM_OUTLINE;

function drawPipeSeg(c: PartCtx, x: number, y: number, len: number, vertical: boolean): void {
  const s = c.s;
  if (vertical) {
    s.fillRect(x - 3, y, 7, len, O);
    s.fillRect(x - 2, y, 5, len, C.SLATE_IRON);
    s.vline(x - 1, y, len, C.SILVER_GEAR);
  } else {
    s.fillRect(x, y - 3, len, 7, O);
    s.fillRect(x, y - 2, len, 5, C.SLATE_IRON);
    s.hline(x, y - 1, len, C.SILVER_GEAR);
  }
  if (c.on && c.anims.has('flow')) {
    const k = Math.floor(c.t * 10) % 4;
    for (let i = k; i < len; i += 4) {
      if (vertical) s.pset(x, y + i, c.accent[2], 1);
      else s.pset(x + i, y, c.accent[2], 1);
    }
  }
}

type PartFn = (c: PartCtx, ax: number, ay: number, slot: KitSlot, count: number) => number;

/** Each part returns how far it extends above the body top (to grow the bounds) */
const PARTS: Record<KitPartType, PartFn> = {
  pipe: (c, ax, ay, slot) => {
    if (slot === 'top') {
      drawPipeSeg(c, ax, ay - 14, 14, true);
      drawPipeSeg(c, ax, ay - 14, 12, false);
      return 17;
    }
    const dir = slot === 'left' ? -1 : 1;
    drawPipeSeg(c, dir > 0 ? ax : ax - 10, ay, 10, false);
    drawPipeSeg(c, ax + dir * 8, ay, 14, true);
    return 0;
  },
  valve: (c, ax, ay) => {
    const s = c.s;
    s.fillRect(ax - 4, ay - 4, 9, 9, O);
    s.fillRect(ax - 3, ay - 3, 7, 7, C.VERMILION_KILN);
    const k = c.on && c.anims.has('spin') ? Math.floor(c.t * 6) % 2 : 0;
    if (k) s.hline(ax - 2, ay, 5, C.SUNLIGHT_CREAM);
    else s.vline(ax, ay - 2, 5, C.SUNLIGHT_CREAM);
    return 4;
  },
  funnel: (c, ax, ay) => {
    const s = c.s;
    for (let i = 0; i < 9; i++) {
      s.hline(ax - 3 - i, ay - 3 - i, 7 + i * 2, i === 8 ? O : c.ramp[i < 4 ? 0 : 1]);
      s.pset(ax - 4 - i, ay - 3 - i, O);
      s.pset(ax + 4 + i, ay - 3 - i, O);
    }
    s.hline(ax - 11, ay - 12, 23, c.ramp[2]);
    return 12;
  },
  nozzle: (c, ax, ay, slot) => {
    const dir = slot === 'left' ? -1 : 1;
    const s = c.s;
    s.fillRect(dir > 0 ? ax : ax - 8, ay - 3, 8, 6, O);
    s.fillRect(dir > 0 ? ax : ax - 7, ay - 2, 7, 4, C.SILVER_GEAR);
    s.fillRect(ax + dir * 8 - (dir < 0 ? 3 : 0), ay - 4, 3, 8, O);
    if (c.on && (c.anims.has('flow') || c.anims.has('sparks'))) {
      for (let i = 0; i < 3; i++) s.pset(ax + dir * (12 + ((Math.floor(c.t * 12) + i * 2) % 6)), ay - 1 + i, c.accent[2], 1);
    }
    return 4;
  },
  drip: (c, ax) => {
    const s = c.s;
    const by = c.y1;
    s.fillRect(ax - 2, by - 2, 5, 4, O);
    s.fillRect(ax - 1, by - 1, 3, 2, c.accent[1]);
    if (c.on || c.anims.has('drip')) {
      const k = (c.t * 1.4) % 1;
      s.fillRect(ax - 1, by + 2 + Math.floor(k * 10), 2, 3, c.accent[2], 1);
    }
    return 0;
  },
  gear: (c, ax, ay) => {
    const ph = c.on ? Math.floor(c.t * 8) * 0.4 : 0;
    drawPixelGear(c.s, ax, ay, 7, C.EMBER_ORANGE, C.AMBER_GOLD, ph);
    return 8;
  },
  fan: (c, ax, ay) => {
    const s = c.s;
    s.fillEllipse(ax, ay, 8, 8, O);
    s.fillEllipse(ax, ay, 7, 7, C.INDIGO_NIGHT);
    const ph = c.on ? Math.floor(c.t * 12) * 0.5 : 0;
    for (let i = 0; i < 4; i++) {
      const a = ph + (i * Math.PI) / 2;
      s.line(ax, ay, ax + Math.cos(a) * 6, ay + Math.sin(a) * 6, C.SILVER_GEAR);
      s.line(ax + 1, ay, ax + 1 + Math.cos(a + 0.3) * 5, ay + Math.sin(a + 0.3) * 5, C.WARM_PARCHMENT);
    }
    s.fillRect(ax - 1, ay - 1, 3, 3, C.AMBER_GOLD);
    return 8;
  },
  wheel: (c) => {
    const s = c.s;
    const ph = c.on ? Math.floor(c.t * 8) % 2 : 0;
    for (const wx of [c.x0 + 9, c.x1 - 9]) {
      s.fillEllipse(wx, c.y1 - 2, 6, 6, O);
      s.fillEllipse(wx, c.y1 - 2, 5, 5, C.VOID_INK);
      s.fillEllipse(wx, c.y1 - 2, 2, 2, C.SILVER_GEAR);
      s.pset(wx + (ph ? 3 : -3), c.y1 - 2, C.SILVER_GEAR);
    }
    return 0;
  },
  piston: (c, ax, ay) => {
    const s = c.s;
    const up = c.on ? [0, 3, 6, 3][Math.floor(c.t * 8) % 4] : 0;
    s.fillRect(ax - 5, ay - 6, 11, 6, O);
    s.fillRect(ax - 4, ay - 5, 9, 5, C.SLATE_IRON);
    s.fillRect(ax - 2, ay - 14 - up, 5, 9 + up, O);
    s.vline(ax, ay - 13 - up, 8 + up, C.SILVER_GEAR);
    s.fillRect(ax - 4, ay - 17 - up, 9, 4, C.AMBER_GOLD);
    return 17 + up;
  },
  crank: (c, ax, ay, slot) => {
    const dir = slot === 'left' ? -1 : 1;
    const s = c.s;
    const a = c.on ? Math.floor(c.t * 6) * 0.8 : 0.6;
    const hx = ax + dir * 6;
    s.fillEllipse(hx, ay, 4, 4, O);
    s.fillEllipse(hx, ay, 3, 3, C.SILVER_GEAR);
    const ex = hx + Math.cos(a) * 7;
    const ey = ay + Math.sin(a) * 7;
    s.line(hx, ay, ex, ey, O);
    s.fillRect(ex - 1, ey - 1, 3, 3, C.VERMILION_KILN);
    return 0;
  },
  'conveyor-port': (c, ax, ay, slot) => {
    const s = c.s;
    const dir = slot === 'right' ? 1 : -1;
    const py = c.y1 - 12;
    s.fillRect(dir > 0 ? ax - 6 : ax - 2, py, 8, 12, O);
    s.fillRect(dir > 0 ? ax - 5 : ax - 1, py + 1, 6, 10, C.VOID_INK);
    s.hline(dir > 0 ? ax - 5 : ax - 1, py + 1, 6, C.AMBER_GOLD);
    void ay;
    return 0;
  },
  chimney: (c, ax, ay) => {
    const s = c.s;
    s.fillRect(ax - 4, ay - 16, 9, 16, O);
    s.fillRect(ax - 3, ay - 15, 7, 15, C.CRIMSON_BRICK);
    s.fillRect(ax - 5, ay - 18, 11, 3, C.SLATE_IRON);
    if (c.on || c.anims.has('smoke')) {
      for (let i = 0; i < 3; i++) {
        const life = (c.t * 0.7 + i / 3) % 1;
        const sz = life < 0.4 ? 5 : life < 0.75 ? 4 : 2;
        s.fillRect(ax - 2 + Math.sin(life * 5 + i) * 3 + life * 4, ay - 22 - life * 18, sz, sz, C.SILVER_GEAR, 1);
      }
    }
    return 26;
  },
  window: (c, ax, ay) => {
    const s = c.s;
    s.fillRect(ax - 5, ay - 5, 11, 10, O);
    const lit = c.on || c.anims.has('glow');
    const flick = c.anims.has('blink') && c.on && Math.floor(c.t * 3) % 2 === 0;
    s.fillRect(ax - 4, ay - 4, 9, 8, lit && !flick ? C.AMBER_GOLD : C.INDIGO_NIGHT, lit ? 1 : 0);
    s.vline(ax, ay - 4, 8, O);
    s.hline(ax - 4, ay, 9, O);
    if (lit) s.drawDitheredLight(ax, ay, 20, 1.3);
    return 5;
  },
  door: (c, ax) => {
    const s = c.s;
    const dy = c.y1 - 16;
    s.fillRect(ax - 6, dy, 13, 16, O);
    s.fillRect(ax - 5, dy + 1, 11, 15, C.DARK_WALNUT);
    s.vline(ax, dy + 1, 15, C.ROASTED_OAK);
    s.pset(ax + 3, dy + 8, C.AMBER_GOLD);
    return 0;
  },
  'roof-flag': (c, ax, ay) => {
    const s = c.s;
    s.vline(ax, ay - 16, 16, O);
    const wave = Math.floor(c.t * 4) % 2;
    s.fillRect(ax + 1, ay - 16, 8, 5, c.accent[1]);
    s.hline(ax + 1, ay - 16, 8, c.accent[2]);
    s.pset(ax + 8, ay - 12 + wave, c.accent[0]);
    return 16;
  },
  ladder: (c, ax, _ay, slot) => {
    const s = c.s;
    const x = slot === 'left' ? ax - 6 : ax + 1;
    s.vline(x, c.y0 + 4, c.y1 - c.y0 - 4, C.CEDAR_PLANK);
    s.vline(x + 5, c.y0 + 4, c.y1 - c.y0 - 4, C.CEDAR_PLANK);
    for (let y = c.y0 + 7; y < c.y1; y += 5) s.hline(x, y, 6, C.HONEY_PINE);
    return 0;
  },
  lamp: (c, ax, ay, slot) => {
    const s = c.s;
    const dir = slot === 'right' ? 1 : -1;
    s.hline(dir > 0 ? ax : ax - 6, ay - 8, 7, O);
    const lx = ax + dir * 6;
    s.fillRect(lx - 2, ay - 7, 5, 5, O);
    s.fillRect(lx - 1, ay - 6, 3, 3, C.AMBER_GOLD, 1);
    s.drawDitheredLight(lx, ay - 4, 22, 1.6 + c.t * 0);
    return 0;
  },
  screen: (c, ax, ay) => {
    const s = c.s;
    s.fillRect(ax - 11, ay - 7, 23, 14, O);
    s.fillRect(ax - 10, ay - 6, 21, 12, C.PINE_SHADE, 1);
    const blink = c.anims.has('blink') && Math.floor(c.t * 2) % 2 === 0;
    const txt = (c.screen ?? (c.on ? 'ON' : '--')).slice(0, 4);
    if (!blink || !c.on) s.drawMiniText(ax - Math.floor((txt.length * 5 - 1) / 2), ay - 2, txt, c.on ? C.DEW_SPROUT : C.FOREST_MOSS, null, 1);
    if (c.on) s.drawDitheredLight(ax, ay, 18, 1.2);
    return 7;
  },
  antenna: (c, ax, ay) => {
    const s = c.s;
    s.vline(ax, ay - 18, 18, O);
    s.hline(ax - 4, ay - 12, 9, O);
    s.hline(ax - 2, ay - 16, 5, O);
    const lit = c.on && Math.floor(c.t * 3) % 2 === 0;
    s.fillRect(ax - 1, ay - 21, 3, 3, lit ? C.VERMILION_KILN : C.CRIMSON_BRICK, lit ? 1 : 0);
    if (lit && c.anims.has('glow')) s.drawDitheredLight(ax, ay - 20, 14, 1.5);
    return 21;
  },
  'led-row': (c, ax, ay) => {
    const s = c.s;
    s.fillRect(ax - 12, ay - 3, 25, 6, O);
    for (let i = 0; i < 5; i++) {
      const on = c.on && (Math.floor(c.t * 6) + i) % 3 !== 0;
      s.fillRect(ax - 10 + i * 5, ay - 1, 3, 2, on ? (i % 2 ? C.DEW_SPROUT : C.AMBER_GOLD) : C.VIOLET_UMBER, on ? 1 : 0);
    }
    return 3;
  },
  cable: (c, ax, ay, slot) => {
    const s = c.s;
    const dir = slot === 'left' ? -1 : 1;
    for (let i = 0; i < 16; i++) {
      const y = ay + Math.round(Math.sin(i / 3) * 2) + Math.floor(i / 2);
      s.fillRect(ax + dir * i, y, 1, 2, O);
    }
    return 0;
  },
  coil: (c, ax, ay) => {
    const s = c.s;
    s.fillRect(ax - 6, ay - 7, 13, 14, O);
    for (let y = ay - 6; y < ay + 6; y += 2) s.hline(ax - 5, y, 11, C.EMBER_ORANGE);
    s.vline(ax, ay - 6, 12, C.SLATE_IRON);
    if (c.on && (c.anims.has('sparks') || c.anims.has('glow'))) {
      const f = Math.floor(c.t * 12);
      s.line(ax + 7, ay - 6, ax + 10 + (f % 3), ay - 10, C.SUNLIGHT_CREAM, 1);
      s.drawDitheredLight(ax, ay, 18, 1.4);
    }
    return 7;
  },
  chamber: (c, ax, ay, _slot, count) => {
    const s = c.s;
    const n = clamp(count, 1, 4);
    const w = 11;
    const total = n * w + (n - 1) * 2;
    const beat = c.on && c.anims.has('pulse') ? (Math.floor(c.t * 2.5) % 2) : 0;
    for (let i = 0; i < n; i++) {
      const x = ax - total / 2 + i * (w + 2);
      s.fillRect(x, ay - 7 + beat, w, 15 - beat, O);
      s.fillRect(x + 1, ay - 6 + beat, w - 2, 13 - beat, c.ramp[0]);
      s.fillRect(x + 2, ay - 5 + beat, 3, 5, c.ramp[2]);
    }
    return 7;
  },
  membrane: (c, ax, ay) => {
    const s = c.s;
    for (let y = ay - 8; y <= ay + 8; y++) for (let x = ax - 12; x <= ax + 12; x++) {
      if ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0) s.pset(x, y, c.ramp[0]);
    }
    s.strokeRect(ax - 13, ay - 9, 27, 19, O);
    return 9;
  },
  roots: (c, ax) => {
    const s = c.s;
    const y = c.y1;
    for (const [dx, len] of [[-10, 8], [-4, 11], [3, 9], [9, 7]] as const) {
      for (let i = 0; i < len; i++) s.pset(ax + dx + Math.round(Math.sin(i * 0.8 + dx) * 1.5), y + i, i % 3 ? C.ROASTED_OAK : C.DARK_WALNUT);
    }
    return 0;
  },
  cilia: (c, ax, ay) => {
    const s = c.s;
    const wave = c.on ? Math.floor(c.t * 8) : 0;
    for (let i = -14; i <= 14; i += 4) {
      const lean = ((wave + i) % 4) - 1;
      s.line(ax + i, ay, ax + i + lean, ay - 7, c.ramp[0]);
      s.pset(ax + i + lean, ay - 8, c.ramp[2]);
    }
    return 9;
  },
  vessel: (c, ax, ay) => {
    const s = c.s;
    const col = c.accent;
    const branches: ReadonlyArray<readonly [number, number]> = [[-14, -12], [0, -16], [13, -11]];
    for (const [bx, by] of branches) {
      s.line(ax, ay, ax + bx, ay + by, O);
      s.line(ax + 1, ay, ax + bx + 1, ay + by, O);
      s.line(ax, ay - 1, ax + bx, ay + by - 1, col[1]);
    }
    s.fillRect(ax - 3, ay - 3, 7, 5, O);
    s.fillRect(ax - 2, ay - 2, 5, 3, col[1]);
    if (c.on && c.anims.has('flow')) {
      const k = (c.t * 2) % 1;
      for (const [bx, by] of branches) s.pset(ax + bx * k, ay + by * k - 1, col[2], 1);
    }
    return 17;
  },
  leafcap: (c, ax, ay) => {
    const s = c.s;
    s.fillEllipse(ax, ay - 7, 16, 8, O);
    s.fillEllipse(ax, ay - 7, 15, 7, C.FOREST_MOSS);
    s.fillEllipse(ax - 3, ay - 9, 10, 4, C.MEADOW_GREEN);
    s.hline(ax - 8, ay - 11, 9, C.SPRING_LEAF);
    return 15;
  },
};

// ---------------------------------------------------------------- station
function heartbeat(t: number): number {
  const k = (t * 1.25) % 1;
  return k < 0.1 ? 1 : k < 0.2 ? 0.35 : k < 0.3 ? 0.75 : 0;
}

/** Draw a kit station centered on cx with ground line baseY. Same contract as drawStation. */
export function drawKitStation(s: PixelSurface, k: KitSpec, cx: number, baseY: number, d: KitDraw, t: number): Bounds {
  const b = clamp(d.build, 0, 1);
  if (b <= 0.02) return { x: cx - 34, y: baseY - 8, w: 68, h: 8 };
  const anims = new Set<KitAnim>(k.anim ?? []);
  const tint = k.tint ?? d.tint;
  const mat = MAT[k.material];
  const ramp = mat.ramp(tint);
  const accent = TINT_RAMP[d.tint];
  const [bw, bh] = SIZE[k.size ?? 'm'];
  const pulse = anims.has('pulse') ? heartbeat(t) * (d.active ? 1 : 0.35) : 0;
  const w = Math.round(bw * (1 + pulse * 0.07));
  const fullH = Math.round(bh * (1 + pulse * 0.06));
  // stepped build: the body rises in 4 steps; parts appear once it is more than half built
  const h = Math.max(6, Math.round(fullH * Math.min(1, Math.ceil(b * 4) / 4)));
  const shake = anims.has('shake') && d.active ? (Math.floor(t * 14) % 2 ? 1 : -1) : 0;
  const x0 = snapToPixel(cx - w / 2) + shake;
  const y0 = baseY - h;
  const shape = bodyShape(k.body, w, fullH);
  const offY = fullH - h;

  s.drawGroundShadow(cx, baseY, Math.round(w / 2) + 2, 5, 1.4);
  const inside = (x: number, y: number): boolean => x >= 0 && x < w && y >= offY && y < fullH && shape.inside(x, y);
  for (let ly = offY; ly < fullH; ly++) {
    for (let lx = 0; lx < w; lx++) {
      if (!shape.inside(lx, ly)) continue;
      const px = x0 + lx;
      const py = y0 + ly - offY;
      const edge = !inside(lx - 1, ly) || !inside(lx + 1, ly) || !inside(lx, ly - 1) || !inside(lx, ly + 1);
      if (edge) {
        s.pset(px, py, O);
        continue;
      }
      let col: number = ramp[1];
      if (!inside(lx - 2, ly) || !inside(lx, ly - 2)) col = ramp[2];
      else if (!inside(lx + 2, ly) || !inside(lx, ly + 2) || ly > fullH * 0.82) col = ramp[0];
      const tex = mat.texture(lx, ly, ramp, w, fullH);
      if (tex !== null) col = tex;
      if (mat.gloss && lx > w * 0.2 && lx < w * 0.2 + 3 && ly > fullH * 0.18 && ly < fullH * 0.42) col = (lx + ly) % 2 === 0 ? ramp[2] : C.IVORY_SPARK;
      s.pset(px, py, col);
    }
  }
  // body-specific trim
  if (k.body === 'house' && h > fullH * 0.5) {
    const roof = Math.floor(fullH * 0.38);
    for (let ly = 0; ly < roof; ly++) for (let lx = 0; lx < w; lx++) if (inside(lx, ly) && inside(lx - 1, ly) && inside(lx + 1, ly) && inside(lx, ly - 1)) s.pset(x0 + lx, y0 + ly - offY, ly % 3 === 0 ? C.CRIMSON_BRICK : C.VERMILION_KILN);
  }
  if (k.body === 'tank') for (const fy of [0.35, 0.7]) s.hline(x0 + 1, y0 + Math.round(fullH * fy) - offY, w - 2, C.SLATE_IRON);
  if (k.body === 'platform') s.hline(x0 + 1, y0 + fullH - 24 - offY + 1, w - 2, ramp[2]);

  let top = y0;
  if (b > 0.5) {
    const ctx: PartCtx = { s, t, on: d.active, anims, ramp, accent, screen: d.screen, x0, y0, x1: x0 + w - 1, y1: baseY - 1 };
    const midY = y0 + Math.round(h * 0.5);
    const firstTop = (): number => {
      for (let ly = 0; ly < fullH; ly++) if (shape.inside(Math.floor(w / 2), ly)) return y0 + ly - offY;
      return y0;
    };
    const topY = firstTop();
    const slotCount: Record<KitSlot, number> = { top: 0, left: 0, right: 0, front: 0 };
    const parts = k.parts ?? [];
    const nFront = parts.filter((p) => (p.at ?? DEFAULT_SLOT[p.type]) === 'front').length;
    for (const p of parts) {
      const slot = p.at ?? DEFAULT_SLOT[p.type];
      const i = slotCount[slot]++;
      let ax = cx;
      let ay = midY;
      if (slot === 'top') {
        ax = cx + [0, -w * 0.28, w * 0.28][i % 3];
        let ly = 0;
        while (ly < fullH && !shape.inside(Math.round(ax - x0), ly)) ly++;
        ay = y0 + ly - offY;
      } else if (slot === 'left' || slot === 'right') {
        ay = y0 + Math.round(h * (0.4 + i * 0.25));
        let lx = slot === 'left' ? 0 : w - 1;
        const ly = ay - y0 + offY;
        while (lx >= 0 && lx < w && !shape.inside(lx, ly)) lx += slot === 'left' ? 1 : -1;
        ax = x0 + lx + (slot === 'left' ? 0 : 1);
      } else {
        const cols = Math.min(nFront, 2);
        ax = cols === 1 ? cx : cx + (i % 2 === 0 ? -w * 0.22 : w * 0.22);
        ay = y0 + Math.round(h * (nFront > 2 ? 0.35 + Math.floor(i / 2) * 0.32 : 0.55));
      }
      const up = PARTS[p.type](ctx, snapToPixel(ax), snapToPixel(ay), slot, p.count ?? 2);
      top = Math.min(top, (slot === 'top' ? ay : topY) - up);
    }
    if (k.icon) {
      const iy = k.body === 'platform' ? y0 + fullH - 34 - offY : topY + Math.max(9, Math.round(h * 0.28));
      drawIcon(s, cx, iy, k.icon);
      top = Math.min(top, iy - 8);
    }
    // whole-body effects
    if (d.active && anims.has('glow')) s.drawDitheredLight(cx, y0 + h / 2, w * 0.8, 1.2 + d.tod + d.power);
    if (d.active && anims.has('bubble')) {
      for (let i = 0; i < 5; i++) {
        const life = (t * 0.8 + i / 5) % 1;
        s.fillRect(x0 + 6 + ((i * 13) % (w - 12)), topY + h * 0.6 - life * h * 0.6, 2, 2, C.ICE_PRISM, 1);
      }
    }
    if (d.active && anims.has('sparks')) {
      const f = Math.floor(t * 12);
      for (let i = 0; i < 4; i++) {
        const a = ((f * 7 + i * 11) % 32) / 5;
        s.pset(cx + Math.cos(a) * (w / 2 + 3), y0 + h / 2 + Math.sin(a) * (h / 2 + 2), i % 2 ? C.SUNLIGHT_CREAM : C.AMBER_GOLD, 1);
      }
    }
    if (d.active && anims.has('smoke') && !parts.some((p) => p.type === 'chimney')) {
      for (let i = 0; i < 3; i++) {
        const life = (t * 0.7 + i / 3) % 1;
        s.fillRect(cx - 3 + Math.sin(life * 5 + i) * 4, topY - 6 - life * 18, life < 0.5 ? 4 : 3, life < 0.5 ? 4 : 3, C.SILVER_GEAR, 1);
      }
    }
    if (anims.has('drip') && !parts.some((p) => p.type === 'drip')) {
      const kk = (t * 1.2) % 1;
      s.fillRect(cx + 4, baseY - 2 + Math.floor(kk * 6), 2, 2, accent[2], 1);
    }
  }
  if (b > 0.05 && b < 0.95) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      s.fillRect(cx + Math.cos(a) * b * 22, baseY - 4 + Math.sin(a) * b * 6, 2, 2, C.WARM_PARCHMENT, 1);
    }
  }
  const bx = Math.min(x0 - 12, cx - 34);
  return { x: bx, y: Math.max(top, baseY - 110), w: Math.max(w + 24, 68), h: baseY - Math.max(top, baseY - 110) };
}

/** Pixels of a kit drawn on a scratch surface, for 2× interior close-ups (colour 255 = empty) */
export function kitScratch(k: KitSpec, d: KitDraw, t: number): { surf: PixelSurface; baseX: number; baseY: number } {
  const surf = new PixelSurface(110, 120);
  surf.clear(C.VOID_INK, 0);
  surf.colorBuf.fill(255);
  const baseX = 55;
  const baseY = 112;
  drawKitStation(surf, k, baseX, baseY, d, t);
  return { surf, baseX, baseY };
}

/** Dithered floor-glow helper reused by kit interiors */
export function kitAmbient(s: PixelSurface, cx: number, cy: number, r: number, k: number): void {
  for (let y = cy - r; y < cy + r; y++) for (let x = cx - r; x < cx + r; x++) if (((x - cx) ** 2 + (y - cy) ** 2) < r * r && k > bayer4(x, y)) s.pset(x, y, C.WARM_PARCHMENT);
}
