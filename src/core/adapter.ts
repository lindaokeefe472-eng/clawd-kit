// StyleAdapter: the only surface the shared runtime (film.ts) talks to.
import type { Bounds, ResolvedCam, ResolvedInstance, ResolvedLabel, ResolvedPresenter, StyleName } from './types.ts';

/** Static facts about a style, used by the validator, scene resolver and prompts */
export interface StyleInfo {
  name: StyleName;
  /** World coordinate size */
  world: { readonly w: number; readonly h: number };
  /** Area the subtitle band covers, in world y (actors below this get a framing warning) */
  subtitleTop: number;
  camera: { zoom: 'continuous' | 'integer'; min: number; max: number };
  transitions: readonly string[];
  presenter: {
    chars: readonly string[];
    defaultChar: string;
    emotions: readonly string[];
    hats: readonly string[];
    defaultY: number;
    defaultU: number;
    /** Approximate presenter box at u = defaultU, anchor bottom-centre */
    size: readonly [number, number];
  };
}

export interface StyleAdapter<Api> {
  readonly info: StyleInfo;
  /** Drawing-free api for `anchors()` / `surface()` while a scene is resolved (styles without attach points leave it out) */
  readonly anchorApi?: Api;
  /** Called once per frame before anything else (clawd: setBoil(t)) */
  beginFrame(t: number): void;
  /** Start drawing one shot's world through camera `cam` (clears to the style's empty paper/void) */
  pushCamera(cam: ResolvedCam): void;
  drawComponent(inst: ResolvedInstance<Api>, t: number, lt: number): void;
  drawPresenter(spec: ResolvedPresenter, t: number, lt: number): Bounds;
  drawLabel(label: ResolvedLabel): Bounds;
  popCamera(): void;
  /**
   * Composite a transition at progress k ∈ [0, 1]. `out` / `inn` draw the outgoing / incoming shot
   * (null = empty paper, used for the film intro and outro). `focus` is in screen pixels.
   */
  transition(kind: string, k: number, focus: readonly [number, number], out: (() => void) | null, inn: (() => void) | null): void;
  /** Draw the empty frame (paper/void) */
  blank(): void;
  drawSubtitleBand(text: string, reveal: number, chapter: string, shotId: string): void;
  endFrame(): void;
  /** Output frame in screen pixels: full size, height of the world viewport, top of the subtitle band */
  readonly screen: { readonly w: number; readonly h: number; readonly viewH: number; readonly subtitleTop: number };
}
