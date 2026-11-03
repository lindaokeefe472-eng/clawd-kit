// api.ts — the drawing toolbox a clawd component receives. Types come from the real exports, so the
// generated API doc never drifts from the engine. Seeding is engine-managed: no randomSeed / setBoil here.
import * as core from './core.ts';
import * as paint from './paint.ts';
import { shapes } from './shapes.ts';
import type { ShapesApi } from './shapes.ts';
import { heart, star, critter, charById, CHARS } from './critters.ts';
import { acting, combine, feel, EMOTIONS } from './emotions.ts';
import * as scenery from './scenery.ts';
import * as mvCore from './sketch/core.ts';
import * as mvChar from './sketch/character.ts';
import * as mvFlower from './sketch/flower.ts';
import * as mvSwing from './sketch/swing.ts';
import { armTip, bodyPoint } from './anchors.ts';

export interface ClawdApi {
  ctx: CanvasRenderingContext2D;
  PAL: typeof core.PAL;
  TAU: number;
  paint: typeof paint.paint;
  inkLine: typeof paint.inkLine;
  wcolor: typeof paint.wcolor;
  blob: typeof paint.blob;
  washRect: typeof paint.washRect;
  glow: typeof paint.glow;
  trace: typeof paint.trace;
  /** Deterministic geometry helpers shared with the imported catalog components (ring / arc / round / line / poly / heart / clip …) */
  shapes: ShapesApi;
  label: typeof paint.label;
  rectPts: typeof paint.rectPts;
  roundRectPts: typeof paint.roundRectPts;
  ellPts: typeof paint.ellPts;
  jitPts: typeof paint.jitPts;
  heart: typeof heart;
  star: typeof star;
  critter: typeof critter;
  charById: typeof charById;
  CHARS: typeof CHARS;
  acting: typeof acting;
  feel: typeof feel;
  combine: typeof combine;
  EMOTIONS: typeof EMOTIONS;
  jit: typeof core.jit;
  hash: typeof core.hash;
  clamp: typeof core.clamp;
  lerp: typeof core.lerp;
  kf: typeof core.kf;
  kf2: typeof core.kf2;
  ease: typeof core.ease;
  easeOut: typeof core.easeOut;
  easeIn: typeof core.easeIn;
  backOut: typeof core.backOut;
  spring: typeof core.spring;
  wob: typeof core.wob;
  seg: typeof core.seg;
  frac: typeof core.frac;
  pulse: typeof core.pulse;
  jump: typeof core.jump;
  take: typeof core.take;
  mixCol: typeof core.mixCol;
  rgba: typeof core.rgba;
  /** Landscape brushes: hill polygon, grass tufts, five-petal flowers, puffy cloud */
  hillPts: typeof scenery.hillPts;
  tufts: typeof scenery.tufts;
  flowers: typeof scenery.flowers;
  cloud: typeof scenery.cloud;
  FLOWER_COLS: typeof scenery.FLOWER_COLS;
  /**
   * clawd-mv character kit. `sk` is this instance's sketch (its time is the film time `t`, its boil is reset per
   * instance); pass it as the first argument. Give every character `boilKey: api.key` (or `api.key + ':2'` for a second one).
   */
  sk: mvCore.Sketch;
  /** The Clawd character itself (clay orange); (x, y) = ground point between the feet, u = body unit (10u wide, 8u tall) */
  clawdChar: typeof mvChar.clawd;
  /** Pink heroine (u × 0.92, faces left, flower hat, always a little blush) */
  girl: typeof mvChar.girl;
  /** Clay hero */
  boy: typeof mvChar.boy;
  /** Expression + body motion + tint of one emotion: spread it into the character's options */
  feelMv: typeof mvChar.feel;
  /** Emotion timeline with anticipation and take: [[0,'happy'],[1.3,'surprised']] (pass { base: api.GIRL } for the girl) */
  emotionsMv: typeof mvChar.emotions;
  /** Dance / locomotion pose of one style (spread after feelMv so the pose wins) */
  moveMv: typeof mvChar.move;
  GIRL: typeof mvChar.GIRL;
  /** Prop hooks: guitar for armL, pinned flower for draw */
  guitar: typeof mvChar.guitar;
  pinned: typeof mvChar.pinned;
  /** One flower growing (grow 0..1: stem → leaves → petals); returns the flower centre */
  flowerMv: typeof mvFlower.flower;
  /** A bunch of n flowers */
  bunch: typeof mvFlower.bunch;
  /** Petals falling from (x, y) since t0 */
  petals: typeof mvFlower.petals;
  /** Petals drifting along an arc from (x0, y0) to (x1, y1) since t0 */
  petalArc: typeof mvFlower.petalArc;
  /** Swing frame on the ground at (x, y), beam height h, swing angle ang; returns [seatX, seatY, ang] */
  swing: typeof mvSwing.swing;
  /** Swing angle at time t (one full swing every two bars) */
  swingAng: typeof mvSwing.swingAng;
  /**
   * Geometry for `anchors`: where the tip of a clawd-mv character's arm is, `armTip(opts, u, 'L' | 'R')` → [x, y] from
   * the feet. Pass the same `opts` and `u` you draw with (api.girl draws at u × 0.92 and faces left: add `flip: true`)
   */
  armTip: typeof armTip;
  /** Geometry for `anchors`: a point of the character's body frame (units of u, feet = [0, 0], up = −y) as drawn, e.g. the head top is [0, -8] */
  bodyPoint: typeof bodyPoint;
  /** Unique key of this component instance (pass as critter's opts.key so two critters boil differently) */
  key: string;
  /** Independent line-boil stream for one part of the component (e.g. each wing) */
  subSeed: (part: string) => void;
  /** Seconds since param `name` last changed in the storyboard (shot time if it never changes) */
  since: (name: string) => number;
}

/** Static part shared by every instance (built once) */
const TOOLS: Omit<ClawdApi, 'ctx' | 'key' | 'subSeed' | 'since' | 'sk'> = {
  PAL: core.PAL, TAU: core.TAU,
  paint: paint.paint, inkLine: paint.inkLine, wcolor: paint.wcolor, blob: paint.blob, washRect: paint.washRect,
  glow: paint.glow, trace: paint.trace, label: paint.label, rectPts: paint.rectPts, roundRectPts: paint.roundRectPts,
  ellPts: paint.ellPts, jitPts: paint.jitPts, shapes,
  heart, star, critter, charById, CHARS, acting, feel, combine, EMOTIONS,
  jit: core.jit, hash: core.hash, clamp: core.clamp, lerp: core.lerp, kf: core.kf, kf2: core.kf2,
  ease: core.ease, easeOut: core.easeOut, easeIn: core.easeIn, backOut: core.backOut, spring: core.spring,
  wob: core.wob, seg: core.seg, frac: core.frac, pulse: core.pulse, jump: core.jump, take: core.take,
  mixCol: core.mixCol, rgba: core.rgba,
  hillPts: scenery.hillPts, tufts: scenery.tufts, flowers: scenery.flowers, cloud: scenery.cloud, FLOWER_COLS: scenery.FLOWER_COLS,
  clawdChar: mvChar.clawd, girl: mvChar.girl, boy: mvChar.boy, feelMv: mvChar.feel, emotionsMv: mvChar.emotions, moveMv: mvChar.move,
  GIRL: mvChar.GIRL, guitar: mvChar.guitar, pinned: mvChar.pinned,
  flowerMv: mvFlower.flower, bunch: mvFlower.bunch, petals: mvFlower.petals, petalArc: mvFlower.petalArc,
  swing: mvSwing.swing, swingAng: mvSwing.swingAng,
  armTip, bodyPoint,
};

/** One sketch per canvas context, re-timed for every instance */
const sketches = new WeakMap<CanvasRenderingContext2D, mvCore.Sketch>();

export function createClawdApi(ctx: CanvasRenderingContext2D, seedKey: string, ages: Readonly<Record<string, number>> = {}, lt = 0, t = lt): ClawdApi {
  let sk = sketches.get(ctx);
  if (!sk) {
    sk = mvCore.createSketch(ctx);
    sketches.set(ctx, sk);
  }
  mvCore.beginFrame(sk, t);
  return { ...TOOLS, ctx, sk, key: seedKey, subSeed: (part) => core.boilSeed(`${seedKey}:${part}`), since: (name) => ages[name] ?? lt };
}

/**
 * The api `anchors()` / `surface()` get while the scene is resolved: every tool, but nothing to draw on.
 * Touching `ctx` or `sk` throws, so geometry cannot quietly turn into drawing.
 */
export function createClawdAnchorApi(seedKey: string, ages: Readonly<Record<string, number>> = {}): ClawdApi {
  const refuse = (what: string): never => {
    throw new Error(`anchors() / surface() are geometry only: they cannot use api.${what}`);
  };
  const ctx = new Proxy({}, { get: () => refuse('ctx') }) as CanvasRenderingContext2D;
  const sk = new Proxy({}, { get: () => refuse('sk') }) as mvCore.Sketch;
  return { ...TOOLS, ctx, sk, key: seedKey, subSeed: () => undefined, since: (name) => ages[name] ?? 0 };
}
