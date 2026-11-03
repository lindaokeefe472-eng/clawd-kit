// Pixel StyleAdapter: thin layer over the existing 4a engine (src/engine). Output = indexed-resolved
// 480×270 pixels + HD text commands, exactly what HdCompositor paints.
import type { StyleAdapter, StyleInfo } from '../../core/adapter.ts';
import type { Bounds, ResolvedCam, ResolvedInstance, ResolvedLabel, ResolvedPresenter } from '../../core/types.ts';
import { C, LOGICAL_H, LOGICAL_W, SAFE_Y, WORLD_H, WORLD_W, clamp } from '../../engine/palette.ts';
import { PixelSurface } from '../../engine/surface.ts';
import { blitComponentToWorld, createDrawApi, createScratchSurface } from '../../engine/component.ts';
import type { ComponentDrawApi } from '../../engine/component.ts';
import { drawPresenter, TINTS } from '../../engine/sprites.ts';
import type { EmoteType, PresenterPose, Tint } from '../../engine/sprites.ts';
import { drawLabel } from '../../engine/world.ts';
import type { Focus, TextCmd } from '../../engine/world.ts';
import { drawPixelSubtitleBand } from '../../engine/frame.ts';
import type { FrameText } from '../../engine/frame.ts';
import { EMOTIONS } from '../clawd/emotions.ts';

export type PixelApi = ComponentDrawApi;

export const PIXEL_INFO: StyleInfo = {
  name: 'pixel',
  world: { w: WORLD_W, h: WORLD_H },
  subtitleTop: SAFE_Y,
  camera: { zoom: 'integer', min: 1, max: 2 },
  transitions: ['checker', 'iris'],
  presenter: {
    chars: ['artificer'],
    defaultChar: 'artificer',
    // same emotion vocabulary as clawd, so one storyboard renders in both styles
    emotions: EMOTIONS.map((e) => e.id),
    hats: ['none'],
    defaultY: 212,
    defaultU: 30,
    size: [24, 36],
  },
};

const EMOTE: Readonly<Record<string, EmoteType>> = {
  surprised: '!', confused: '?', idea: 'bulb', love: 'heart', shy: 'heart', proud: 'star', excited: 'star', joy: 'star',
  cool: 'star', sleepy: 'zzz', nervous: 'sweat', scared: 'sweat', hungry: 'sweat', bored: 'dots', gloomy: 'dots', sad: 'dots',
};
const POSE: Readonly<Record<string, PresenterPose>> = {
  idea: 'point', happy: 'wave', joy: 'cheer', excited: 'cheer', proud: 'cheer', confused: 'think', bored: 'think', calm: 'idle',
};

function currentEmotion(p: ResolvedPresenter, lt: number): readonly [number, string] {
  let cur = p.emotions[0];
  for (const k of p.emotions) if (lt >= k[0]) cur = k;
  return cur;
}

function asTint(s: string): Tint {
  return (TINTS as readonly string[]).includes(s) ? (s as Tint) : 'red';
}

export class PixelAdapter implements StyleAdapter<PixelApi> {
  readonly info = PIXEL_INFO;
  readonly screen = { w: LOGICAL_W, h: LOGICAL_H, viewH: SAFE_Y, subtitleTop: SAFE_Y };
  readonly pixels = new Uint32Array(LOGICAL_W * LOGICAL_H);
  texts: FrameText[] = [];
  private readonly world = new PixelSurface(WORLD_W, WORLD_H);
  private readonly frame = new PixelSurface(LOGICAL_W, LOGICAL_H);
  private worldTexts: TextCmd[] = [];
  private view = { x0: 0, y0: 0, z: 1 as 1 | 2 };
  private t = 0;

  beginFrame(t: number): void {
    this.t = t;
    this.texts = [];
    this.frame.clear(C.VOID_INK, 0);
  }

  blank(): void {
    this.frame.fillRect(0, 0, LOGICAL_W, SAFE_Y, C.VOID_INK, 0);
  }

  pushCamera(cam: ResolvedCam): void {
    const z: 1 | 2 = cam.z >= 1.5 ? 2 : 1;
    this.view = { x0: Math.floor(cam.cx - WORLD_W / (2 * z)), y0: Math.floor(cam.cy - WORLD_H / (2 * z)), z };
    this.world.clear(C.VOID_INK, 0);
    this.worldTexts = [];
  }

  drawComponent(inst: ResolvedInstance<PixelApi>, t: number, lt: number): void {
    const [w, h] = inst.def.size;
    const scratch = createScratchSurface(w, h);
    inst.def.draw(createDrawApi(scratch, t, lt, (c) => this.worldTexts.push(c)), inst.params, t, lt);
    if (inst.def.kind === 'background') blitComponentToWorld(scratch, this.world, 0, 0, { isBackground: true });
    else blitComponentToWorld(scratch, this.world, inst.x, inst.y, { flip: inst.flip, scale: inst.scale >= 1.5 ? 2 : 1 });
  }

  drawPresenter(p: ResolvedPresenter, t: number, lt: number): Bounds {
    const [at, emotion] = currentEmotion(p, lt);
    const pose: PresenterPose = p.moving ? 'walk' : p.action === 'jump' || p.action === 'dance' ? 'cheer' : POSE[emotion] ?? 'idle';
    return drawPresenter(this.world, { x: p.x, y: p.y, dir: p.flip ? 'left' : 'right', pose, emote: EMOTE[emotion], emoteT: lt - at }, t);
  }

  drawLabel(l: ResolvedLabel): Bounds {
    const focus: Focus[] = [];
    drawLabel(this.world, this.worldTexts, { text: l.text, x: l.x, y: l.y, tint: asTint(l.tint), age: l.age }, focus);
    return focus[0] ?? { x: l.x, y: l.y, w: 0, h: 0 };
  }

  popCamera(): void {
    const { x0, y0, z } = this.view;
    this.frame.blitCrop(this.world, x0, y0, z, SAFE_Y);
    for (const c of this.worldTexts) {
      const x = (c.x - x0) * z;
      const y = (c.y - y0) * z;
      if (x < -40 || x > LOGICAL_W + 40 || y < 0 || y > SAFE_Y) continue;
      this.texts.push({ ...c, x, y, size: c.size * z });
    }
  }

  transition(kind: string, k: number, focus: readonly [number, number], out: (() => void) | null, inn: (() => void) | null): void {
    // pixel transitions cover the outgoing shot, then uncover the incoming one
    const first = k < 0.5;
    const draw = first ? out : inn;
    if (draw) draw();
    else this.blank();
    const p = clamp(first ? k * 2 : (1 - k) * 2, 0, 1);
    if (kind === 'checker') this.frame.applyCheckerboardWipe(p, 16, C.PLUM_OUTLINE, SAFE_Y);
    else if (kind === 'iris') this.frame.applyIrisDither(1 - p, focus[0], focus[1], C.VOID_INK, SAFE_Y);
    if (p > 0.15) this.texts = [];
  }

  drawSubtitleBand(text: string, reveal: number, chapter: string, shotId: string): void {
    drawPixelSubtitleBand(this.frame, this.texts, text, reveal, chapter, shotId, this.t);
  }

  endFrame(): void {
    this.frame.resolveToUint32(this.pixels, 0);
  }
}
