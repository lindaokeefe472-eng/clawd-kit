// Component contract, scratch surface blitter with 255 sentinel, and determinism tester
import { PixelSurface } from './surface.ts';
import type { TextCmd } from './world.ts';
import type { ComponentDef as CoreComponentDef } from '../core/types.ts';

// Real engine functions and types (100% true signatures derived from source)
import { shadeShape } from './kit.ts';
import { drawPixelGear, drawItem, drawItemScaled, TINT_RAMP, TINTS } from './sprites.ts';
import { bayer4, hashFloat, hash2, C, PALETTE_32 } from './palette.ts';
import { HEX } from './world.ts';

export type { ComponentKind, ComponentParamDef } from '../core/types.ts';

export interface ComponentDrawApi {
  s: PixelSurface;
  t: number;
  lt: number;

  shadeShape: typeof shadeShape;
  drawPixelGear: typeof drawPixelGear;
  drawItem: typeof drawItem;
  drawItemScaled: typeof drawItemScaled;

  bayer4: typeof bayer4;
  hashFloat: typeof hashFloat;
  hash2: typeof hash2;

  C: typeof C;
  PALETTE_32: typeof PALETTE_32;
  HEX: typeof HEX;
  TINT_RAMP: typeof TINT_RAMP;
  TINTS: typeof TINTS;

  text: (cmd: TextCmd) => void;
}

/** Pixel components: the shared contract with the pixel toolbox as api (style: 'pixel') */
export type ComponentDef = CoreComponentDef<ComponentDrawApi>;

/** Create a scratch surface filled with the 255 sentinel value (255 = untouched / transparent) */
export function createScratchSurface(w: number, h: number): PixelSurface {
  const surf = new PixelSurface(w, h);
  surf.clear(C.VOID_INK, 0);
  surf.colorBuf.fill(255);
  return surf;
}

export interface BlitOpts {
  flip?: boolean;
  scale?: 1 | 2;
  isBackground?: boolean;
}

/** Blit a scratch component surface onto the target world surface using the 255 sentinel mask */
export function blitComponentToWorld(
  scratch: PixelSurface,
  target: PixelSurface,
  anchorX: number,
  anchorY: number,
  opts: BlitOpts = {}
): void {
  const flip = opts.flip ?? false;
  const scale = opts.scale ?? 1;
  const isBg = opts.isBackground ?? false;

  const sw = scratch.width;
  const sh = scratch.height;

  let destX0: number;
  let destY0: number;

  if (isBg) {
    destX0 = 0;
    destY0 = 0;
  } else {
    // Foot anchor [sw / 2, sh] mapped to [anchorX, anchorY]
    destX0 = Math.round(anchorX - (scale === 2 ? sw : sw / 2));
    destY0 = Math.round(anchorY - (scale === 2 ? sh * 2 : sh));
  }

  const sColor = scratch.colorBuf;
  const sLight = scratch.lightBuf;
  const tColor = target.colorBuf;
  const tLight = target.lightBuf;
  const tw = target.width;
  const th = target.height;

  if (scale === 1) {
    for (let sy = 0; sy < sh; sy++) {
      const dy = destY0 + sy;
      if (dy < 0 || dy >= th) continue;
      const sRow = sy * sw;
      const dRow = dy * tw;
      for (let sx = 0; sx < sw; sx++) {
        const srcX = flip ? sw - 1 - sx : sx;
        const sIdx = sRow + srcX;
        const c = sColor[sIdx];
        if (c === 255) continue; // transparent sentinel
        const dx = destX0 + sx;
        if (dx < 0 || dx >= tw) continue;
        const dIdx = dRow + dx;
        tColor[dIdx] = c;
        tLight[dIdx] = sLight[sIdx];
      }
    }
  } else {
    // scale: 2 (2x2 expansion)
    for (let sy = 0; sy < sh; sy++) {
      const sRow = sy * sw;
      const dyBase = destY0 + sy * 2;
      for (let sx = 0; sx < sw; sx++) {
        const srcX = flip ? sw - 1 - sx : sx;
        const sIdx = sRow + srcX;
        const c = sColor[sIdx];
        if (c === 255) continue;
        const light = sLight[sIdx];
        const dxBase = destX0 + sx * 2;
        for (let oy = 0; oy < 2; oy++) {
          const dy = dyBase + oy;
          if (dy < 0 || dy >= th) continue;
          const dRow = dy * tw;
          for (let ox = 0; ox < 2; ox++) {
            const dx = dxBase + ox;
            if (dx < 0 || dx >= tw) continue;
            const dIdx = dRow + dx;
            tColor[dIdx] = c;
            tLight[dIdx] = light;
          }
        }
      }
    }
  }
}

/** Construct standard ComponentDrawApi instance for a scratch surface */
export function createDrawApi(
  s: PixelSurface,
  t: number,
  lt: number,
  textCollector: (cmd: TextCmd) => void = () => {}
): ComponentDrawApi {
  return {
    s,
    t,
    lt,
    shadeShape,
    drawPixelGear,
    drawItem,
    drawItemScaled,
    bayer4,
    hashFloat,
    hash2,
    C,
    PALETTE_32,
    HEX,
    TINT_RAMP,
    TINTS,
    text: textCollector,
  };
}

/** Verify pure-function determinism across repeated and out-of-order draws */
export function verifyComponentDeterminism(def: ComponentDef, defaultParams: Record<string, unknown> = {}): string[] {
  const errs: string[] = [];
  const [w, h] = def.size;

  function renderAt(t: number, lt: number): Uint8Array {
    const s = createScratchSurface(w, h);
    const api = createDrawApi(s, t, lt);
    def.draw(api, defaultParams, t, lt);
    const buf = new Uint8Array(s.colorBuf.length + s.lightBuf.length);
    buf.set(s.colorBuf, 0);
    buf.set(s.lightBuf, s.colorBuf.length);
    return buf;
  }

  function buffersMatch(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // 1. Repeat test at t=1.0, lt=0.5
  const frame1A = renderAt(1.0, 0.5);
  const frame1B = renderAt(1.0, 0.5);
  if (!buffersMatch(frame1A, frame1B)) {
    errs.push(`Determinism error in component "${def.name}": repeated render at identical time produced differing output.`);
  }

  // 2. Out-of-order test (render future frame, then re-render past frame)
  renderAt(5.0, 2.5); // later frame
  const frame1C = renderAt(1.0, 0.5);
  if (!buffersMatch(frame1A, frame1C)) {
    errs.push(`Determinism error in component "${def.name}": state leak detected. Out-of-order render produced differing output.`);
  }

  return errs;
}
