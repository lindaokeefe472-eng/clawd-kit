// Indexed 32-color framebuffer with hue-shifted Bayer lighting (ported from 4a pixelBuffer.ts)
import {
  BAYER_4X4,
  C,
  HUE_SHIFT_RAMPS,
  LOGICAL_H,
  LOGICAL_W,
  PALETTE_ABGR,
  bayer2,
  bayer4,
  clamp,
  snapToPixel,
} from './palette.ts';

// Crisp 4x5 pixel bitmap font for in-world labels, code scrolls, AST nodes & station badges
const MINI_FONT: Record<string, readonly number[]> = {
  A: [0b0110, 0b1001, 0b1111, 0b1001, 0b1001],
  B: [0b1110, 0b1001, 0b1110, 0b1001, 0b1110],
  C: [0b0111, 0b1000, 0b1000, 0b1000, 0b0111],
  D: [0b1110, 0b1001, 0b1001, 0b1001, 0b1110],
  E: [0b1111, 0b1000, 0b1110, 0b1000, 0b1111],
  F: [0b1111, 0b1000, 0b1110, 0b1000, 0b1000],
  G: [0b0111, 0b1000, 0b1011, 0b1001, 0b0111],
  H: [0b1001, 0b1001, 0b1111, 0b1001, 0b1001],
  I: [0b1110, 0b0100, 0b0100, 0b0100, 0b1110],
  J: [0b0011, 0b0001, 0b0001, 0b1001, 0b0110],
  K: [0b1001, 0b1010, 0b1100, 0b1010, 0b1001],
  L: [0b1000, 0b1000, 0b1000, 0b1000, 0b1111],
  M: [0b1001, 0b1111, 0b1111, 0b1001, 0b1001],
  N: [0b1001, 0b1101, 0b1011, 0b1001, 0b1001],
  O: [0b0110, 0b1001, 0b1001, 0b1001, 0b0110],
  P: [0b1110, 0b1001, 0b1110, 0b1000, 0b1000],
  Q: [0b0110, 0b1001, 0b1001, 0b0111, 0b0001],
  R: [0b1110, 0b1001, 0b1110, 0b1010, 0b1001],
  S: [0b0111, 0b1000, 0b0110, 0b0001, 0b1110],
  T: [0b1110, 0b0100, 0b0100, 0b0100, 0b0100],
  U: [0b1001, 0b1001, 0b1001, 0b1001, 0b0110],
  V: [0b1001, 0b1001, 0b1001, 0b0110, 0b0100],
  W: [0b1001, 0b1001, 0b1111, 0b1111, 0b1001],
  X: [0b1001, 0b1001, 0b0110, 0b1001, 0b1001],
  Y: [0b1001, 0b1001, 0b0110, 0b0100, 0b0100],
  Z: [0b1111, 0b0010, 0b0100, 0b1000, 0b1111],
  x: [0b0000, 0b1001, 0b0110, 0b0110, 0b1001],
  '0': [0b0110, 0b1011, 0b1101, 0b1001, 0b0110],
  '1': [0b0100, 0b1100, 0b0100, 0b0100, 0b1110],
  '2': [0b1110, 0b0001, 0b0110, 0b1000, 0b1111],
  '3': [0b1110, 0b0001, 0b0110, 0b0001, 0b1110],
  '4': [0b1010, 0b1010, 0b1111, 0b0010, 0b0010],
  '5': [0b1111, 0b1000, 0b1110, 0b0001, 0b1110],
  '6': [0b0111, 0b1000, 0b1110, 0b1001, 0b0110],
  '7': [0b1111, 0b0001, 0b0010, 0b0100, 0b0100],
  '8': [0b0110, 0b1001, 0b0110, 0b1001, 0b0110],
  '9': [0b0110, 0b1001, 0b0111, 0b0001, 0b1110],
  '.': [0b0000, 0b0000, 0b0000, 0b0000, 0b0100],
  '+': [0b0000, 0b0100, 0b1110, 0b0100, 0b0000],
  '*': [0b1010, 0b0100, 0b1110, 0b0100, 0b1010],
  '=': [0b0000, 0b1111, 0b0000, 0b1111, 0b0000],
  '?': [0b1110, 0b0001, 0b0110, 0b0000, 0b0100],
  '!': [0b0100, 0b0100, 0b0100, 0b0000, 0b0100],
  ':': [0b0000, 0b0100, 0b0000, 0b0100, 0b0000],
  '#': [0b1010, 0b1111, 0b1010, 0b1111, 0b1010],
  '-': [0b0000, 0b0000, 0b1110, 0b0000, 0b0000],
  '>': [0b1000, 0b0100, 0b0010, 0b0100, 0b1000],
  '[': [0b1100, 0b1000, 0b1000, 0b1000, 0b1100],
  ']': [0b0011, 0b0001, 0b0001, 0b0001, 0b0011],
  '/': [0b0001, 0b0010, 0b0100, 0b1000, 0b0000],
  '(': [0b0100, 0b1000, 0b1000, 0b1000, 0b0100],
  ')': [0b0100, 0b0010, 0b0010, 0b0010, 0b0100],
  ',': [0b0000, 0b0000, 0b0000, 0b0100, 0b1000],
  '%': [0b1001, 0b0010, 0b0100, 0b1001, 0b0000],
  '<': [0b0010, 0b0100, 0b1000, 0b0100, 0b0010],
  '_': [0b0000, 0b0000, 0b0000, 0b0000, 0b1111],
  ' ': [0, 0, 0, 0, 0],
};

/** Pixel width of drawMiniText output */
export function miniTextWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += ch === ' ' ? 3 : 5;
  return Math.max(0, w - 1);
}

export class PixelSurface {
  readonly width: number;
  readonly height: number;
  /** Palette index [0..31] per logical pixel */
  readonly colorBuf: Uint8Array;
  /** Illumination delta [-3.0 .. +3.5] relative to neutral noon (level 3) */
  readonly lightBuf: Float32Array;
  /** Emissive mask (1 = ignores night darkening: flames, crystal cores, UI) */
  readonly emissiveBuf: Uint8Array;

  constructor(width = LOGICAL_W, height = LOGICAL_H) {
    this.width = width;
    this.height = height;
    this.colorBuf = new Uint8Array(width * height);
    this.lightBuf = new Float32Array(width * height);
    this.emissiveBuf = new Uint8Array(width * height);
  }

  clear(col: number = C.VOID_INK, baseLight = 0): void {
    this.colorBuf.fill(col & 31);
    this.lightBuf.fill(baseLight);
    this.emissiveBuf.fill(0);
  }

  pset(x: number, y: number, col: number, emissive = 0): void {
    const ix = snapToPixel(x);
    const iy = snapToPixel(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return;
    const idx = iy * this.width + ix;
    this.colorBuf[idx] = col & 31;
    this.emissiveBuf[idx] = emissive;
  }

  /** Alias for pset to accommodate standard pixel-setting conventions */
  setPixel(x: number, y: number, col: number, emissive = 0): void {
    this.pset(x, y, col, emissive);
  }

  /** Short alias for pset (e.g., s.set(x, y, col)) */
  set(x: number, y: number, col: number, emissive = 0): void {
    this.pset(x, y, col, emissive);
  }

  pget(x: number, y: number): number {
    const ix = snapToPixel(x);
    const iy = snapToPixel(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return C.VOID_INK;
    return this.colorBuf[iy * this.width + ix];
  }

  /** Alias for pget */
  getPixel(x: number, y: number): number {
    return this.pget(x, y);
  }

  /** Short alias for pget */
  get(x: number, y: number): number {
    return this.pget(x, y);
  }

  fillRect(x: number, y: number, w: number, h: number, col: number, emissive = 0): void {
    const x0 = Math.max(0, snapToPixel(x));
    const y0 = Math.max(0, snapToPixel(y));
    const x1 = Math.min(this.width, snapToPixel(x) + snapToPixel(w));
    const y1 = Math.min(this.height, snapToPixel(y) + snapToPixel(h));
    const c = col & 31;
    for (let py = y0; py < y1; py++) {
      const row = py * this.width;
      for (let px = x0; px < x1; px++) {
        this.colorBuf[row + px] = c;
        this.emissiveBuf[row + px] = emissive;
      }
    }
  }

  hline(x: number, y: number, len: number, col: number, emissive = 0): void {
    this.fillRect(x, y, len, 1, col, emissive);
  }

  vline(x: number, y: number, len: number, col: number, emissive = 0): void {
    this.fillRect(x, y, 1, len, col, emissive);
  }

  strokeRect(x: number, y: number, w: number, h: number, col: number, emissive = 0): void {
    const ix = snapToPixel(x);
    const iy = snapToPixel(y);
    const iw = snapToPixel(w);
    const ih = snapToPixel(h);
    if (iw <= 0 || ih <= 0) return;
    this.hline(ix, iy, iw, col, emissive);
    this.hline(ix, iy + ih - 1, iw, col, emissive);
    this.vline(ix, iy, ih, col, emissive);
    this.vline(ix + iw - 1, iy, ih, col, emissive);
  }

  /** Strict Bresenham integer pixel line */
  line(x0: number, y0: number, x1: number, y1: number, col: number, emissive = 0): void {
    let ix0 = snapToPixel(x0);
    let iy0 = snapToPixel(y0);
    const ix1 = snapToPixel(x1);
    const iy1 = snapToPixel(y1);
    const dx = Math.abs(ix1 - ix0);
    const dy = -Math.abs(iy1 - iy0);
    const sx = ix0 < ix1 ? 1 : -1;
    const sy = iy0 < iy1 ? 1 : -1;
    let err = dx + dy;
    let guard = 0;
    while (guard++ < 1024) {
      this.pset(ix0, iy0, col, emissive);
      if (ix0 === ix1 && iy0 === iy1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        ix0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        iy0 += sy;
      }
    }
  }

  fillEllipse(cx: number, cy: number, rx: number, ry: number, col: number, emissive = 0): void {
    const icx = snapToPixel(cx);
    const icy = snapToPixel(cy);
    const irx = Math.max(1, snapToPixel(rx));
    const iry = Math.max(1, snapToPixel(ry));
    for (let dy = -iry; dy <= iry; dy++) {
      for (let dx = -irx; dx <= irx; dx++) {
        const nx = dx / (irx + 0.35);
        const ny = dy / (iry + 0.35);
        if (nx * nx + ny * ny <= 1) {
          this.pset(icx + dx, icy + dy, col, emissive);
        }
      }
    }
  }

  /** 4x4 Bayer Matrix Dithered Rect (Stage 1 Contract: drawDitheredRect) */
  drawDitheredRect(
    x: number,
    y: number,
    w: number,
    h: number,
    col: number,
    density: number,
    emissive = 0
  ): void {
    const x0 = Math.max(0, snapToPixel(x));
    const y0 = Math.max(0, snapToPixel(y));
    const x1 = Math.min(this.width, snapToPixel(x) + snapToPixel(w));
    const y1 = Math.min(this.height, snapToPixel(y) + snapToPixel(h));
    const c = col & 31;
    for (let py = y0; py < y1; py++) {
      const row = py * this.width;
      for (let px = x0; px < x1; px++) {
        if (density > bayer4(px, py)) {
          this.colorBuf[row + px] = c;
          this.emissiveBuf[row + px] = emissive;
        }
      }
    }
  }

  /** Ground contact shadow using hue-shifted cooling light delta + 2x2 Bayer edge */
  drawGroundShadow(cx: number, cy: number, rx: number, ry: number, strength = 1.35): void {
    const icx = snapToPixel(cx);
    const icy = snapToPixel(cy);
    const irx = Math.max(1, snapToPixel(rx));
    const iry = Math.max(1, snapToPixel(ry));
    for (let dy = -iry; dy <= iry; dy++) {
      const py = icy + dy;
      if (py < 0 || py >= this.height) continue;
      for (let dx = -irx; dx <= irx; dx++) {
        const px = icx + dx;
        if (px < 0 || px >= this.width) continue;
        const d2 = (dx * dx) / (irx * irx + 0.5) + (dy * dy) / (iry * iry + 0.5);
        if (d2 <= 1.0) {
          const edge = 1.0 - d2;
          if (edge > 0.35 || bayer2(px, py) < edge * 2.2) {
            const idx = py * this.width + px;
            if (!this.emissiveBuf[idx]) {
              this.lightBuf[idx] = Math.min(this.lightBuf[idx], -strength);
            }
          }
        }
      }
    }
  }

  /** Radial Bayer Point Light Halo (Stage 1 Contract: drawDitheredLight) */
  drawDitheredLight(cx: number, cy: number, radius: number, boost = 2.4): void {
    const icx = snapToPixel(cx);
    const icy = snapToPixel(cy);
    const r = Math.max(2, snapToPixel(radius));
    const y0 = Math.max(0, icy - r);
    const y1 = Math.min(this.height - 1, icy + r);
    const x0 = Math.max(0, icx - r);
    const x1 = Math.min(this.width - 1, icx + r);
    const rSq = r * r;

    for (let py = y0; py <= y1; py++) {
      const dy = py - icy;
      const row = py * this.width;
      for (let px = x0; px <= x1; px++) {
        const dx = px - icx;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rSq) continue;
        const falloff = 1 - Math.sqrt(d2) / r;
        const add = falloff * falloff * boost;
        const idx = row + px;
        if (this.lightBuf[idx] < add) {
          this.lightBuf[idx] += add * 0.85;
        } else {
          this.lightBuf[idx] += add * 0.35;
        }
      }
    }
  }

  /** ASCII Pixel Sprite Matrix renderer with transparency '.' */
  drawSpriteMatrix(
    x: number,
    y: number,
    rows: readonly string[],
    paletteMap: Record<string, number>,
    flipX = false,
    emissiveChars?: ReadonlySet<string>
  ): void {
    const bx = snapToPixel(x);
    const by = snapToPixel(y);
    for (let r = 0; r < rows.length; r++) {
      const line = rows[r];
      const w = line.length;
      for (let c = 0; c < w; c++) {
        const ch = line[c];
        if (ch === '.' || ch === ' ') continue;
        const col = paletteMap[ch];
        if (col === undefined) continue;
        const dx = flipX ? w - 1 - c : c;
        this.pset(bx + dx, by + r, col, emissiveChars?.has(ch) ? 1 : 0);
      }
    }
  }

  /** Crisp 4x5 pixel font for in-world labels & code tokens */
  drawMiniText(
    x: number,
    y: number,
    text: string,
    col: number,
    shadowCol: number | null = C.PLUM_OUTLINE,
    emissive = 1
  ): number {
    let cursor = snapToPixel(x);
    const iy = snapToPixel(y);
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const glyph = MINI_FONT[ch] ?? MINI_FONT[ch.toUpperCase()] ?? MINI_FONT[' '];
      for (let r = 0; r < 5; r++) {
        const bits = glyph[r];
        for (let c = 0; c < 4; c++) {
          if ((bits >> (3 - c)) & 1) {
            if (shadowCol !== null) {
              this.pset(cursor + c, iy + r + 1, shadowCol, emissive);
            }
            this.pset(cursor + c, iy + r, col, emissive);
          }
        }
      }
      cursor += ch === ' ' ? 3 : 5;
    }
    return cursor - snapToPixel(x);
  }

  /** Copy a camera window of src (origin cx,cy) into this surface at strict integer zoom (1 or 2) */
  blitCrop(src: PixelSurface, cx: number, cy: number, zoom: 1 | 2, maxDestY: number): void {
    const ox = snapToPixel(cx);
    const oy = snapToPixel(cy);
    const limitY = Math.min(this.height, maxDestY);
    for (let dy = 0; dy < limitY; dy++) {
      const sy = oy + (zoom === 2 ? dy >> 1 : dy);
      if (sy < 0 || sy >= src.height) continue;
      const srcRow = sy * src.width;
      const dstRow = dy * this.width;
      for (let dx = 0; dx < this.width; dx++) {
        const sx = ox + (zoom === 2 ? dx >> 1 : dx);
        if (sx < 0 || sx >= src.width) continue;
        const si = srcRow + sx;
        const di = dstRow + dx;
        this.colorBuf[di] = src.colorBuf[si];
        this.lightBuf[di] = src.lightBuf[si];
        this.emissiveBuf[di] = src.emissiveBuf[si];
      }
    }
  }

  /** Copy a w×h block of src at (sx, sy) to (dx, dy), zoom 1 */
  blitRect(src: PixelSurface, sx: number, sy: number, dx: number, dy: number, w: number, h: number): void {
    for (let y = 0; y < h; y++) {
      const syy = sy + y;
      const dyy = dy + y;
      if (syy < 0 || syy >= src.height || dyy < 0 || dyy >= this.height) continue;
      for (let x = 0; x < w; x++) {
        const sxx = sx + x;
        const dxx = dx + x;
        if (sxx < 0 || sxx >= src.width || dxx < 0 || dxx >= this.width) continue;
        const si = syy * src.width + sxx;
        const di = dyy * this.width + dxx;
        this.colorBuf[di] = src.colorBuf[si];
        this.lightBuf[di] = src.lightBuf[si];
        this.emissiveBuf[di] = src.emissiveBuf[si];
      }
    }
  }

  /** Paste every emissive pixel of src scaled ×k with its top-left at (dx, dy) — overlays drawn on a scratch surface */
  blitEmissiveScaled(src: PixelSurface, dx: number, dy: number, k: number): void {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const si = y * src.width + x;
        if (!src.emissiveBuf[si]) continue;
        this.fillRect(dx + x * k, dy + y * k, k, k, src.colorBuf[si], 1);
      }
    }
  }

  /** Paste src ×k at (dx, dy), skipping pixels whose colour index is 255 (scratch "empty"); keeps lighting */
  blitMaskedScaled(src: PixelSurface, dx: number, dy: number, k: number): void {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const si = y * src.width + x;
        if (src.colorBuf[si] === 255) continue;
        for (let oy = 0; oy < k; oy++) {
          const ty = dy + y * k + oy;
          if (ty < 0 || ty >= this.height) continue;
          for (let ox = 0; ox < k; ox++) {
            const tx = dx + x * k + ox;
            if (tx < 0 || tx >= this.width) continue;
            const di = ty * this.width + tx;
            this.colorBuf[di] = src.colorBuf[si];
            this.lightBuf[di] = Math.max(this.lightBuf[di], src.lightBuf[si]);
            this.emissiveBuf[di] = src.emissiveBuf[si];
          }
        }
      }
    }
  }

  /** Checkerboard Tile Wipe transition mask */
  applyCheckerboardWipe(progress: number, tileSize = 16, wipeCol: number = C.PLUM_OUTLINE, maxY = LOGICAL_H): void {
    if (progress <= 0) return;
    for (let y = 0; y < maxY; y++) {
      const ty = Math.floor(y / tileSize);
      const ly = (y % tileSize) / tileSize;
      const row = y * this.width;
      for (let x = 0; x < this.width; x++) {
        const tx = Math.floor(x / tileSize);
        const lx = (x % tileSize) / tileSize;
        const parity = ((tx + ty) & 1) * 0.32;
        const sweep = (x / this.width) * 0.45 + parity;
        const local = progress * 1.85 - sweep;
        if (local > 0.5 + (Math.abs(lx - 0.5) + Math.abs(ly - 0.5)) * 0.5) {
          this.colorBuf[row + x] = wipeCol;
          this.emissiveBuf[row + x] = 1;
        }
      }
    }
  }

  /** Circular Iris Bayer Dither aperture (openness: 0 = closed, 1 = fully open) */
  applyIrisDither(openness: number, centerX = 240, centerY = 120, vignetteCol: number = C.VOID_INK, maxY = LOGICAL_H): void {
    if (openness >= 0.999) return;
    const maxR = 290;
    const targetR = openness * maxR;
    for (let y = 0; y < maxY; y++) {
      const dy = y - centerY;
      const row = y * this.width;
      for (let x = 0; x < this.width; x++) {
        const dx = x - centerX;
        const dist = Math.sqrt(dx * dx + dy * dy * 1.15);
        const edge = (dist - targetR) / 26;
        if (edge > 0) {
          if (edge >= 1 || edge > bayer4(x, y)) {
            this.colorBuf[row + x] = edge > 0.55 ? vignetteCol : C.PLUM_OUTLINE;
            this.emissiveBuf[row + x] = 1;
          }
        }
      }
    }
  }

  /**
   * Resolve indexed colors + ambient timePhase + dynamic Bayer point lights
   * strictly into packed 32-bit ABGR colors from our 32-color palette!
   *
   * timePhase:
   *   0.00..0.22 = Peach Dawn (slightly cool shadows + warm golden rim)
   *   0.22..0.55 = Crisp Lush Noon (neutral vibrant level 3.1)
   *   0.55..0.82 = Golden Amber Dusk (shadows cool down, warm golden sun angle)
   *   0.82..1.00 = Deep Starry Indigo Night (ambient drops to 0.35; lanterns & fireflies shine!)
   */
  resolveToUint32(outPixels: Uint32Array, timePhase: number): void {
    let ambient = 3.05;
    if (timePhase < 0.22) {
      // Morning awakening: soft cool-plum shadow warming into bright day
      ambient = 2.35 + (timePhase / 0.22) * 0.7;
    } else if (timePhase < 0.55) {
      // Bright daytime workshop
      ambient = 3.08;
    } else if (timePhase < 0.82) {
      // Golden dusk transition
      const k = (timePhase - 0.55) / 0.27;
      ambient = 3.08 - k * 1.55;
    } else {
      // Deep starry night: rich indigo twilight preserving two-tone silhouettes
      const k = (timePhase - 0.82) / 0.18;
      ambient = 1.62 - k * 0.44;
    }

    const total = this.width * this.height;
    for (let i = 0; i < total; i++) {
      const baseCol = this.colorBuf[i];
      if (this.emissiveBuf[i]) {
        outPixels[i] = PALETTE_ABGR[baseCol];
        continue;
      }

      const x = i % this.width;
      const y = (i / this.width) | 0;
      const rawLevel = clamp(ambient + this.lightBuf[i], 0, 6);
      const baseStep = Math.floor(rawLevel);
      const frac = rawLevel - baseStep;
      const ditherStep =
        baseStep < 6 && frac > BAYER_4X4[((y & 3) << 2) | (x & 3)] ? baseStep + 1 : baseStep;

      const resolvedIdx = HUE_SHIFT_RAMPS[baseCol][ditherStep];
      outPixels[i] = PALETTE_ABGR[resolvedIdx];
    }
  }
}
