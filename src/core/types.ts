// Style-agnostic contracts: components, free-scene storyboard schema, resolved scene graph.
// Nothing in src/core imports a drawing engine; styles plug in through StyleAdapter (adapter.ts).
import type { Step, Track } from '../engine/track.ts';

export type StyleName = 'clawd' | 'pixel';
export type ComponentKind = 'background' | 'actor' | 'prop' | 'foreground';

export interface ComponentParamDef {
  type: 'number' | 'string' | 'boolean' | 'enum';
  default: unknown;
  options?: readonly string[];
  min?: number;
  max?: number;
  description: string;
}

/** Named points of a component in its local frame: origin = anchor, +x right, up = −y, scale 1, not flipped */
export type AnchorPoints = Readonly<Record<string, readonly [number, number]>>;

export interface ComponentDef<Api> {
  name: string;
  style: StyleName;
  kind: ComponentKind;
  description: string;
  tags: readonly string[];
  /** Bounding box [w, h]; anchor = bottom-centre. Backgrounds use the style's world size. */
  size: readonly [number, number];
  params?: Readonly<Record<string, ComponentParamDef>>;
  /** Pure function of api / params / t (film time) / lt (shot-local time) */
  draw: (api: Api, params: Readonly<Record<string, unknown>>, t: number, lt: number) => void;
  /**
   * Names of the points `anchors` returns (declared up front so the validator, the index and the prompts can list
   * them): other actors attach to these with `attach: { to, at }`
   */
  anchorNames?: readonly string[];
  /** Where those points are right now (pure geometry: api / params / t / lt, no drawing); must return every name */
  anchors?: (api: Api, params: Readonly<Record<string, unknown>>, t: number, lt: number) => AnchorPoints;
  /** Background only: the walking surface, y at a given x; actors with `ground: true` stand on it */
  surface?: (api: Api, params: Readonly<Record<string, unknown>>, t: number, lt: number) => (x: number) => number;
}

export type Registry<Api> = ReadonlyMap<string, ComponentDef<Api>>;

/** A param value in the storyboard: constant, numeric Track, or Step of any value */
export type ParamValue = unknown;

export interface BackgroundRef {
  use: string;
  params?: Record<string, ParamValue>;
}

/** Hold an actor on a named point of another actor of the same shot (a hand, the head …) */
export interface AttachRef {
  /** id of the host actor */
  to: string;
  /** one of the host component's `anchorNames` */
  at: string;
  /**
   * One of THIS actor's own anchors that sits on the host point (a cup's `grip`, an umbrella's `handle`);
   * default: the actor's own origin
   */
  with?: string;
  /** offset from the point, in world px (not scaled with the host) */
  dx?: Track;
  dy?: Track;
}

export interface ActorRef {
  id: string;
  use: string;
  /** Required unless `attach` is given (then the actor's position is the anchor's) */
  x?: Track;
  /** With `ground: true`, an offset from the surface; with `attach`, not allowed */
  y?: Track;
  attach?: AttachRef;
  /** Stand on the background's surface: y = surface(x) + y */
  ground?: boolean;
  scale?: Track;
  flip?: Step<boolean>;
  /** 'sort' (default) joins the y-sorted layer; 'front' draws above everything */
  layer?: 'sort' | 'front';
  /** Sort key override (default y): e.g. a lily pad with depth 700 stays under a frog standing on it at y 805 */
  depth?: number;
  params?: Record<string, ParamValue>;
}

export interface ForegroundRef {
  id?: string;
  use: string;
  x?: Track;
  y?: Track;
  scale?: Track;
  flip?: Step<boolean>;
  params?: Record<string, ParamValue>;
}

export type PresenterAction = 'none' | 'walk' | 'turn' | 'jump' | 'take' | 'dance' | 'smear';
export type PresenterView = 'front' | 'q' | 'side' | 'qback' | 'back';

export interface PresenterRef {
  x: Track;
  y?: Track;
  emotion?: Step<string>;
  action?: Step<PresenterAction>;
  view?: Step<PresenterView>;
  /** Facing; default follows walking direction, else right */
  flip?: Step<boolean>;
  hat?: string;
  /** Body unit (clawd); default from adapter */
  u?: number;
  /** Sort key override (default y) */
  depth?: number;
  /** Lighting tint matching bg_night / bg_dusk (clawd) */
  tint?: PresenterTint;
}

export type PresenterTint = 'none' | 'night' | 'warm';

export interface CamRef {
  cx?: Track;
  cy?: Track;
  z?: Track;
  /** actor id or 'presenter'; overrides cx/cy */
  follow?: string;
}

export interface LabelRef {
  text: string;
  /** Without follow: the point the label points at. With follow: offset from the followed head-top (default 0, 0) */
  x?: Track;
  y?: Track;
  /** actor id or 'presenter': the label rides along, pointing at the top of its box */
  follow?: string;
  at?: number;
  until?: number;
  tint?: string;
}

export interface FreeShot {
  id: string;
  chapter: string;
  dur: number;
  sub: string;
  read: string;
  tin?: string;
  tout?: string;
  background?: BackgroundRef;
  actors?: ActorRef[];
  foreground?: ForegroundRef[];
  /** Omitted or null: no presenter in this shot */
  presenter?: PresenterRef | null;
  cam?: CamRef;
  labels?: LabelRef[];
  panels?: unknown[];
}

export interface FreeProject {
  title: string;
  style?: StyleName;
  presenter?: { char?: string };
  /** Who the episode follows: one protagonist, Bean or the protagonist presents, at most 2 characters */
  cast?: { protagonist?: string; host?: 'bean' | 'protagonist'; characters?: Array<{ name?: string; component?: string }> };
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ResolvedInstance<Api> {
  /** Stable per-instance key used for seeding ('bg', actor id, 'fg0', ...) */
  id: string;
  def: ComponentDef<Api>;
  x: number;
  y: number;
  scale: number;
  flip: boolean;
  params: Readonly<Record<string, unknown>>;
  /** Seconds since each param last changed (see paramAges) */
  ages: Readonly<Record<string, number>>;
}

export interface ResolvedPresenter {
  char: string;
  x: number;
  y: number;
  u: number;
  flip: boolean;
  view: PresenterView;
  /** Emotion keyframes in shot time (for acting()) */
  emotions: ReadonlyArray<readonly [number, string]>;
  action: PresenterAction;
  /** Shot time at which the current action started */
  actionAt: number;
  /** Distance walked so far along x (world px), drives the walk cycle */
  walked: number;
  moving: boolean;
  hat: string;
  tint: PresenterTint;
}

export type SceneItem<Api> =
  | { type: 'component'; inst: ResolvedInstance<Api> }
  | { type: 'presenter'; spec: ResolvedPresenter };

export interface ResolvedLabel {
  text: string;
  x: number;
  y: number;
  tint: string;
  age: number;
}

export interface ResolvedCam {
  cx: number;
  cy: number;
  z: number;
}

export interface ResolvedScene<Api> {
  shotId: string;
  lt: number;
  background: ResolvedInstance<Api> | null;
  /** Draw order: y-sorted actors + presenter, then foreground / front actors */
  items: ReadonlyArray<SceneItem<Api>>;
  labels: readonly ResolvedLabel[];
  cam: ResolvedCam;
}
