// Explainer panels drawn in screen space over the world (from opus5.5 board / opus光合作用 chart ideas)
import { C, clamp, snapToPixel } from './palette.ts';
import { PixelSurface, miniTextWidth } from './surface.ts';
import { TINT_RAMP } from './sprites.ts';
import type { Tint } from './sprites.ts';
import { evalStep, evalTrack } from './track.ts';
import type { BarsPanel, ChartPanel, FormulaPanel, GridPanel, NotePanel, PanelDef, TitlePanel } from './storyboard.ts';
import { HEX } from './world.ts';
import type { Focus, TextCmd } from './world.ts';

const E = 1; // panels are emissive: unaffected by night darkening
const isAscii = (s: string): boolean => /^[\x20-\x7e]*$/.test(s);
const cjkW = (s: string, size: number): number => Array.from(s).reduce((w, ch) => w + (isAscii(ch) ? size * 0.6 : size), 0);

/** Stepped drop-in offset for the first 0.3 s of a panel */
const dropIn = (age: number): number => (age < 0.3 ? [8, 5, 2][Math.min(2, Math.floor(age * 10))] : 0);

function frame(s: PixelSurface, x: number, y: number, w: number, h: number, face: number): void {
  s.fillRect(x, y, w, h, C.PLUM_OUTLINE, E);
  s.fillRect(x + 1, y + 1, w - 2, h - 2, C.ROASTED_OAK, E);
  s.hline(x + 1, y + 1, w - 2, C.HONEY_PINE, E);
  s.fillRect(x + 3, y + 3, w - 6, h - 6, C.PLUM_OUTLINE, E);
  s.fillRect(x + 4, y + 4, w - 8, h - 8, face, E);
  for (const [px, py] of [[x + 1, y + 1], [x + w - 3, y + 1], [x + 1, y + h - 3], [x + w - 3, y + h - 3]]) s.fillRect(px, py, 2, 2, C.AMBER_GOLD, E);
}

/** Text that prefers the pixel mini font for short ASCII and the HD layer otherwise */
function label(s: PixelSurface, texts: TextCmd[], str: string, x: number, y: number, col: number, size = 7, align: 'left' | 'center' = 'left'): void {
  if (isAscii(str) && str.length <= 12 && size <= 7) {
    const w = miniTextWidth(str.toUpperCase());
    s.drawMiniText(align === 'center' ? x - Math.floor(w / 2) : x, y - 2, str.toUpperCase(), col, C.VOID_INK, 1);
  } else {
    texts.push({ text: str, x, y: y + 0.5, size, color: HEX(col), align, bold: true });
  }
}

/** Where panels land when x/y are omitted: the open screen (default) or the chalkboard of the board set */
export interface PanelArea {
  cx: number;
  top: number;
  right: number;
  bottom: number;
}
export const SCREEN_AREA: PanelArea = { cx: 240, top: 44, right: 470, bottom: 232 };

function drawTitle(s: PixelSurface, texts: TextCmd[], p: TitlePanel, age: number, focus: Focus[], A: PanelArea): void {
  const tw = cjkW(p.text, 14);
  const w = Math.max(120, snapToPixel(tw + 30));
  const h = p.sub ? 40 : 30;
  const cx = p.x ?? A.cx;
  const x = snapToPixel(cx - w / 2);
  const y0 = p.y ?? A.top + 20;
  const y = y0 - dropIn(age) * 3;
  s.drawDitheredRect(x + 6, y0 + h + 10, w - 12, 3, C.PLUM_OUTLINE, 0.5, E);
  s.fillRect(x + 12, y + h, 4, 12, C.ROASTED_OAK, E);
  s.fillRect(x + w - 16, y + h, 4, 12, C.ROASTED_OAK, E);
  s.fillRect(x, y, w, h, C.PLUM_OUTLINE, E);
  s.fillRect(x + 2, y + 2, w - 4, h - 4, C.HONEY_PINE, E);
  s.hline(x + 2, y + 2, w - 4, C.SUNLIGHT_CREAM, E);
  s.hline(x + 2, y + h - 3, w - 4, C.CEDAR_PLANK, E);
  s.fillRect(x + 3, y + 3, 2, 2, C.ROASTED_OAK, E);
  s.fillRect(x + w - 5, y + 3, 2, 2, C.ROASTED_OAK, E);
  texts.push({ text: p.text, x: cx + 0.5, y: y + 15.5, size: 14, color: HEX(C.CRIMSON_BRICK), align: 'center', bold: true });
  texts.push({ text: p.text, x: cx, y: y + 15, size: 14, color: HEX(C.DARK_WALNUT), align: 'center', bold: true });
  if (p.sub) texts.push({ text: p.sub, x: cx, y: y + 31, size: 7, color: HEX(C.ROASTED_OAK), align: 'center', bold: true });
  focus.push({ x, y, w, h: h + 12, label: 'title' });
}

function drawNote(s: PixelSurface, texts: TextCmd[], p: NotePanel, age: number, focus: Focus[], A: PanelArea): void {
  const w = snapToPixel(cjkW(p.text, 8) + 16);
  const h = 18;
  const x = snapToPixel((p.x ?? A.cx) - w / 2);
  const y = (p.y ?? A.top + 6) - dropIn(age);
  s.fillRect(x, y, w, h, C.PLUM_OUTLINE, E);
  s.fillRect(x + 1, y + 1, w - 2, h - 2, C.WARM_PARCHMENT, E);
  s.hline(x + 1, y + 1, w - 2, C.IVORY_SPARK, E);
  s.fillRect(x + w / 2 - 2, y - 2, 4, 4, C.VERMILION_KILN, E);
  texts.push({ text: p.text, x: x + w / 2, y: y + 9.5, size: 8, color: HEX(C.DARK_WALNUT), align: 'center', bold: true });
  focus.push({ x, y, w, h, label: 'note' });
}

function drawGrid(s: PixelSurface, texts: TextCmd[], p: GridPanel, lt: number, dur: number, age: number, focus: Focus[], A: PanelArea): void {
  const cell = 10;
  const labelW = 18;
  const w = labelW + p.cols * cell + 12;
  const h = (p.title ? 16 : 8) + p.rows.length * cell + 8;
  const x = p.x ?? (A === SCREEN_AREA ? A.right - w : A.cx - w / 2);
  const y = (p.y ?? (A === SCREEN_AREA ? A.bottom - h : A.top + 10)) - dropIn(age);
  frame(s, x, y, w, h, C.PINE_SHADE);
  const gx = x + 6 + labelW;
  const gy = y + (p.title ? 14 : 6) + 2;
  if (p.title) label(s, texts, p.title, x + 8, y + 9, C.SUNLIGHT_CREAM);
  const reveal = evalTrack(p.reveal, lt, dur, p.cols);
  const stages = p.stages ?? 5;
  const stageTint: readonly Tint[] = ['red', 'blue', 'gold', 'cyan', 'green', 'purple'];
  const filled = new Map<string, Tint>();
  p.rows.forEach((_, r) => {
    for (let k = 0; k < stages; k++) {
      const c = p.pattern === 'serial' ? r * stages + k : p.pattern === 'stagger' ? r + k : -1;
      if (c >= 0 && c < p.cols) filled.set(`${r},${c}`, stageTint[k % stageTint.length]);
    }
  });
  for (const [r, c, tint] of p.cells ?? []) filled.set(`${r},${c}`, tint);
  p.rows.forEach((row, r) => {
    label(s, texts, row, x + 7, gy + r * cell + 4, C.WARM_PARCHMENT, 6);
    for (let c = 0; c < p.cols; c++) {
      const cx = gx + c * cell;
      const cy = gy + r * cell;
      s.strokeRect(cx, cy, cell + 1, cell + 1, C.FOREST_MOSS, E);
      const tint = filled.get(`${r},${c}`);
      if (tint && c < Math.floor(reveal)) {
        const [dk, md, li] = TINT_RAMP[tint];
        s.fillRect(cx + 1, cy + 1, cell - 1, cell - 1, md, E);
        s.hline(cx + 1, cy + 1, cell - 1, li, E);
        s.hline(cx + 1, cy + cell - 1, cell - 1, dk, E);
      }
    }
  });
  const head = Math.floor(reveal);
  if (head < p.cols) s.vline(gx + head * cell, gy - 2, p.rows.length * cell + 4, C.SUNLIGHT_CREAM, E);
  focus.push({ x, y, w, h, label: 'grid' });
}

function drawChart(s: PixelSurface, texts: TextCmd[], p: ChartPanel, lt: number, dur: number, age: number, focus: Focus[], A: PanelArea): void {
  const w = p.w ?? 150;
  const h = p.h ?? 96;
  const x = p.x ?? A.cx - w / 2;
  const y = (p.y ?? A.top + 4) - dropIn(age);
  frame(s, x, y, w, h, C.WARM_PARCHMENT);
  const top = y + (p.title ? 18 : 10);
  const ax = x + 14;
  const ay = y + h - 14;
  const aw = w - 26;
  const ah = ay - top;
  if (p.title) label(s, texts, p.title, x + w / 2, y + 10, C.DARK_WALNUT, 7, 'center');
  s.vline(ax, top, ah + 1, C.DARK_WALNUT, E);
  s.hline(ax, ay, aw + 1, C.DARK_WALNUT, E);
  for (let i = 1; i < 4; i++) s.drawDitheredRect(ax + 1, ay - (ah * i) / 4, aw, 1, C.SANDSTONE, 0.5, E);
  if (p.yLabel) label(s, texts, p.yLabel, ax + 3, top + 3, C.ROASTED_OAK, 6);
  if (p.xLabel) label(s, texts, p.xLabel, ax + aw - 8, ay + 5, C.ROASTED_OAK, 6, 'center');
  const reveal = clamp(evalTrack(p.reveal, lt, dur, 1), 0, 1);
  const n = p.points.length;
  if (n < 2) return;
  const px = (i: number): number => ax + (aw * i) / (n - 1);
  const py = (v: number): number => ay - clamp(v, 0, 1) * ah;
  const span = reveal * (n - 1);
  for (let i = 0; i < n - 1 && i < span; i++) {
    const k = clamp(span - i, 0, 1);
    const x1 = px(i) + (px(i + 1) - px(i)) * k;
    const y1 = py(p.points[i]) + (py(p.points[i + 1]) - py(p.points[i])) * k;
    s.line(px(i), py(p.points[i]), x1, y1, C.FOREST_MOSS, E);
    s.line(px(i), py(p.points[i]) - 1, x1, y1 - 1, C.SPRING_LEAF, E);
    for (let xx = Math.ceil(px(i)); xx < x1; xx += 2) s.vline(xx, py(p.points[i]) + ((py(p.points[i + 1]) - py(p.points[i])) * (xx - px(i))) / (px(i + 1) - px(i)) + 1, 2, C.DEW_SPROUT, E);
  }
  const hi = Math.min(n - 1, Math.floor(span));
  const hk = span - hi;
  const hx = hi < n - 1 ? px(hi) + (px(hi + 1) - px(hi)) * hk : px(n - 1);
  const hy = hi < n - 1 ? py(p.points[hi]) + (py(p.points[hi + 1]) - py(p.points[hi])) * hk : py(p.points[n - 1]);
  s.fillRect(hx - 2, hy - 2, 5, 5, C.PLUM_OUTLINE, E);
  s.fillRect(hx - 1, hy - 1, 3, 3, C.VERMILION_KILN, E);
  focus.push({ x, y, w, h, label: 'chart' });
}

const OPERATOR = /^([+\-=×÷→⇌]|—.*→|->)$/;

function drawFormula(s: PixelSurface, texts: TextCmd[], p: FormulaPanel, lt: number, age: number, focus: Focus[], A: PanelArea): void {
  const size = 9;
  const hiIdx = evalStep(p.highlight, lt, -1);
  const widths = p.parts.map((part) => (OPERATOR.test(part) ? cjkW(part, size) + 6 : cjkW(part, size) + 14));
  const total = widths.reduce((a, b) => a + b, 0) + (p.parts.length - 1) * 3;
  let x = snapToPixel((p.x ?? A.cx) - total / 2);
  const y = (p.y ?? A.top) - dropIn(age);
  const h = 17;
  s.drawDitheredRect(x - 3, y - 3, total + 6, h + 6, C.VOID_INK, 0.55, E);
  p.parts.forEach((part, i) => {
    const w = widths[i];
    if (OPERATOR.test(part)) {
      texts.push({ text: part, x: x + w / 2, y: y + h / 2 + 0.5, size, color: HEX(C.SUNLIGHT_CREAM), align: 'center', bold: true });
    } else {
      const hi = i === hiIdx;
      const bob = hi && Math.floor(lt * 4) % 2 === 0 ? -1 : 0;
      s.fillRect(x, y + bob, w, h, C.PLUM_OUTLINE, E);
      s.fillRect(x + 1, y + 1 + bob, w - 2, h - 2, hi ? C.AMBER_GOLD : C.WARM_PARCHMENT, E);
      s.hline(x + 1, y + 1 + bob, w - 2, hi ? C.SUNLIGHT_CREAM : C.IVORY_SPARK, E);
      texts.push({ text: part, x: x + w / 2, y: y + h / 2 + 0.5 + bob, size, color: HEX(hi ? C.CRIMSON_BRICK : C.DARK_WALNUT), align: 'center', bold: true });
    }
    x += w + 3;
  });
  focus.push({ x: x - total - 3, y: y - 4, w: total, h: h + 8, label: 'formula' });
}

function drawBars(s: PixelSurface, texts: TextCmd[], p: BarsPanel, lt: number, dur: number, age: number, focus: Focus[], A: PanelArea): void {
  const row = 16;
  const w = 170;
  const h = (p.title ? 18 : 8) + p.items.length * row + 6;
  const x = p.x ?? A.cx - w / 2;
  const y = (p.y ?? A.top + 6) - dropIn(age);
  frame(s, x, y, w, h, C.PINE_SHADE);
  if (p.title) label(s, texts, p.title, x + w / 2, y + 10, C.SUNLIGHT_CREAM, 7, 'center');
  const reveal = clamp(evalTrack(p.reveal, lt, dur, 1), 0, 1);
  const bx = x + 56;
  const bw = w - 66;
  p.items.forEach((it, i) => {
    const ry = y + (p.title ? 18 : 8) + i * row;
    label(s, texts, it.label, x + 8, ry + 6, C.WARM_PARCHMENT, 7);
    const [dk, md, li] = TINT_RAMP[it.tint ?? 'gold'];
    s.fillRect(bx, ry + 1, bw, 10, C.PLUM_OUTLINE, E);
    const fw = Math.floor((bw - 2) * clamp(it.value, 0, 1) * reveal);
    if (fw > 0) {
      s.fillRect(bx + 1, ry + 2, fw, 8, md, E);
      s.hline(bx + 1, ry + 2, fw, li, E);
      s.hline(bx + 1, ry + 9, fw, dk, E);
    }
  });
  focus.push({ x, y, w, h, label: 'bars' });
}

/** Draw every visible panel; age = seconds since the panel appeared */
function drawOne(s: PixelSurface, texts: TextCmd[], p: PanelDef, lt: number, dur: number, focus: Focus[], A: PanelArea, at: number, age: number): void {
    switch (p.type) {
      case 'title': drawTitle(s, texts, p, age, focus, A); break;
      case 'note': drawNote(s, texts, p, age, focus, A); break;
      case 'grid': drawGrid(s, texts, p, lt - at, dur - at, age, focus, A); break;
      case 'chart': drawChart(s, texts, p, lt - at, dur - at, age, focus, A); break;
      case 'formula': drawFormula(s, texts, p, lt, age, focus, A); break;
      case 'bars': drawBars(s, texts, p, lt - at, dur - at, age, focus, A); break;
    }
}

const PANEL_SCRATCH = new PixelSurface(240, 135);

export function drawPanels(s: PixelSurface, texts: TextCmd[], panels: readonly PanelDef[], lt: number, dur: number, focus: Focus[], A: PanelArea = SCREEN_AREA, defaultScale: 1 | 2 = 1): void {
  for (const p of panels) {
    const at = p.at ?? 0;
    if (lt < at || (p.until !== undefined && lt >= p.until)) continue;
    const age = lt - at;
    const k = p.scale ?? defaultScale;
    if (k === 1) {
      drawOne(s, texts, p, lt, dur, focus, A, at, age);
      continue;
    }
    // draw at half resolution, then paste ×2; text and focus coordinates are scaled to match
    PANEL_SCRATCH.clear(C.VOID_INK, 0);
    const half: PanelDef = { ...p, x: p.x === undefined ? undefined : p.x / 2, y: p.y === undefined ? undefined : p.y / 2 };
    const hA: PanelArea = { cx: A.cx / 2, top: A.top / 2, right: A.right / 2, bottom: A.bottom / 2 };
    const t2: TextCmd[] = [];
    const f2: Focus[] = [];
    drawOne(PANEL_SCRATCH, t2, half, lt, dur, f2, hA, at, age);
    s.blitEmissiveScaled(PANEL_SCRATCH, 0, 0, 2);
    for (const c of t2) texts.push({ ...c, x: c.x * 2, y: c.y * 2, size: c.size * 2 });
    for (const f of f2) focus.push({ ...f, x: f.x * 2, y: f.y * 2, w: f.w * 2, h: f.h * 2 });
  }
}
