# clawd 组件绘制 API（源码直出）

> 由 `scripts/build-api-doc.mjs` 从 `src/styles/clawd/api.ts` 的 `ClawdApi` 生成，勿手改。

## 契约

- 世界 1920×1080。组件在**局部坐标**里画：原点 = 锚点 = 包围盒底边中点，向上是 −y；背景组件不平移，直接用世界坐标画满 1920×1080。
- 引擎在调用 `draw` 前已经做好 `translate(x, y)`、`scale(±scale, scale)`（flip 时水平镜像），并按实例设好线条抖动种子；组件不要自己设种子。
- 同一组件里需要多套独立抖动时（左右翅膀、每根草）调用 `api.subSeed('名字')`。`api.jit(a)` 返回 ±a 的确定性抖动。
- 纯函数：只能依赖 `api`、`params`、`t`（整片时间）、`lt`（镜头内时间）。禁止 `Math.random`、模块级 `let/var`、任何非 `import type` 的导入、`document`、`fetch`、`process`、`eval` 等。
- 画风：水彩铺色 + 手绘墨线。主体形状用 `api.paint(ctx, pts, { wash, sw })`（自动描墨线），柔和色块用 `api.blob` / `api.wcolor`，发光用 `api.glow`，颜色优先取 `api.PAL`。
- **位移交给分镜**：组件里不要用 `frac()` / `%` 做循环位移（滑一段再跳回原处，叠上分镜的 x/y 运动就像掉帧）；原地的呼吸、摇摆、抖动用 `Math.sin` 这类连续函数。门禁会逐帧检查“滑动后瞬间跳回”。
- **同一角色各状态一样大**：enum 状态（如 cloud / heavy / rain）只改外形和颜色，主体大小保持一致；大小变化交给分镜的 `scale`，否则切状态时角色会突然变小。
- `api.since('参数名')`：这个参数在分镜里多久前变过（秒），用来做切换动画；`api.key`：本实例唯一键（传给 `api.critter` 的 `opts.key`）。
- **挂点（anchors）**：组件可以声明 `anchorNames` 和 `anchors(api, params, t, lt)`，返回若干命名点（局部坐标：原点 = 锚点，向上是 −y，未缩放、未镜像）。分镜里的 `attach: { to, at, with? }` 把另一个演员挂在这个点上（手持物贴手、头顶的东西贴头），缩放和镜像由引擎处理，组件自己不用管。**手持的组件**（杯子、伞、手电、气球……）正常按「包围盒底边中点 = 原点」来画，另外声明一个锚点（惯例叫 `grip`，写握把/绳端的位置），分镜里写 `with: "grip"`，引擎就让这个锚点落在手上。`anchors` 只做几何、不能画图（碰 `api.ctx` / `api.sk` 会报错）；算 clawd-mv 角色的手和身体用 `api.armTip` / `api.bodyPoint`，并且和 `draw` 用同一套姿势参数。每个名字每个时刻都必须返回有限的 [x, y]，门禁会检查。
- **地面（surface）**：背景可以声明 `surface(api, params, t, lt)`，返回 `x → y` 的函数（会晃的桥面、有坡度的地面都可以）。分镜里写 `ground: true` 的演员站在这条线上，`y` 变成偏移。

## 类型

```ts
type Pt = [number, number];
type Ctx = CanvasRenderingContext2D;
interface PaintOpts { wash?: string; /* wash opacity 0–1 (the clawd-mv kit's paint uses 0–255) */ washOp?: number; dk?: string; lt?: string; /* null = no outline */ ink?: string | null; /* outline width px */ sw?: number; /* pigment texture 0–1 */ tex?: number; }
type Pose = { dy: number; sq: number };
type View = 'front' | 'q' | 'side' | 'qback' | 'back';
type EyeType = 'slit' | 'closed' | 'happy' | 'sad' | 'angry' | 'wide' | 'tiny' | 'heart' | 'spiral' | 'star' | 'sleepy' | 'half' | 'cry' | 'squint' | 'smug' | 'shades' | 'sparkle';
type MouthType = 'none' | 'smile' | 'grin' | 'o' | 'wail' | 'frown' | 'flat' | 'wavy' | 'teeth' | 'smirk' | 'tongue' | 'cat' | 'drool';
type Emote = 'none' | '!' | '?' | 'hearts' | 'zzz' | 'sweat' | 'bulb' | 'rain' | 'vein' | 'sparkle' | 'note' | 'stars' | 'steam';
type Hat = 'none' | 'party' | 'crown' | 'halo' | 'wizard' | 'top' | 'beanie' | 'bow' | 'flower' | 'headphones' | 'band' | 'hard' | 'leaf';
interface Opts { view?: View; flip?: boolean; dx?: number; dy?: number; sq?: number; rot?: number; sx?: number; aL?: number; aR?: number; walk?: number; noLegs?: boolean; noShadow?: boolean; eyes?: EyeType | [EyeType, EyeType]; mouth?: MouthType; lookX?: number; lookY?: number; blush?: number; gloom?: number; tint?: string; tintK?: number; emote?: Emote; emoteK?: number; emoteAge?: number; hat?: Hat; smear?: number; smearDir?: number; key?: string; shake?: number; earDroop?: number; tailWag?: number; seed?: number; noBlink?: boolean; }
interface Sketch { ctx: CanvasRenderingContext2D; t: number; boil: number; seed: number; clawdN: number; detail: number; w: number; h: number; }
type ViewName = 'front' | 'q' | 'side' | 'qback' | 'back';
type Hook = (sk: Sketch, u: number, sw: number) => void;
interface ClawdOpts { dx?: number; dy?: number; sq?: number; rot?: number; flip?: boolean; sx?: number; sy?: number; aL?: number; aR?: number; walk?: number | null; noLegs?: boolean; noShadow?: boolean; view?: ViewName; smear?: number; smearDir?: number; eyes?: string | string[]; mouth?: string | null; lookX?: number; lookY?: number; squint?: number; blush?: number | boolean; gloom?: number; lid?: number; seed?: number; col?: string; dk?: string; lt?: string; tint?: string | null; tintK?: number; hat?: string; emote?: string; emoteK?: number; emoteAge?: number; draw?: Hook; armL?: Hook; armR?: Hook; boilKey?: string | number; take?: number; swMul?: number; }
type BodyPose = Pick<ClawdOpts, 'dx' | 'dy' | 'sq' | 'take' | 'rot' | 'flip' | 'sx' | 'sy' | 'smear' | 'view' | 'aL' | 'aR'>;
```

## 速查

- 模块常量：FW = 1920，FH = 1080；PAL 键：paper ink clay clayDk clayLt night indigo rose ochre sap teal violet cream sky orange mouth tongue
- 角色（api.charById(id)）：jiu 啾啾（chick），bean 豆丁（frog），mian 棉棉（bunny），mo 墨球（cat），bing 冰冰（penguin）
- 表情（api.feel / api.acting 的名字）：happy 开心，joy 雀跃，love 心动，shy 害羞，sad 难过，cry 大哭，angry 生气，surprised 惊讶，scared 害怕，confused 疑惑，sleepy 犯困，dizzy 晕乎，proud 得意，idea 灵光，nervous 紧张，bored 无聊，gloomy 沮丧，excited 激动，smug 坏笑，hungry 嘴馋，wink 眨眼，cool 酷，music 哼歌，calm 平静
- 画角色：`api.critter(api.ctx, api.charById('bean'), 0, 0, 24, api.combine(api.feel('happy', lt), { key: api.key, view: 'q' }), t)`，(x, y) 是双脚之间的地面点，u 是身体单位（24 ≈ 300px 宽）。
- clawd-mv 角色套件（第一个参数都是 `api.sk`）：情绪（api.feelMv / api.emotionsMv）：neutral happy excited laugh love shy proud smug relieved sad cry angry furious scared surprised confused thinking idea determined sleepy bored nervous suspicious disgusted dizzy cool starstruck ko playful mischief hopeful；动作（api.moveMv）：bounce hop roof sway spin wave walk run idle stomp shimmy mix；眼睛：normal look wide happy closed sleepy wink narrow angry determined sad teary cry squeeze shine scared blank spark red heart x swirl dot shades；嘴：o O smile grin flat wobble cat frown smirk laugh open wail teeth tongue pout yawn；帽子：party hard crown halo wizard hood top fedora band sweatband beanie bow flower headphones cat mask masq bowtie；气泡：! ? !! !? zzz sweat spark heart hearts anger steam bulb dots scribble music swirl stars cloud
- 画 clawd-mv 角色：`api.girl(api.sk, 0, 0, 24, { ...api.feelMv('happy', t), ...api.moveMv('bounce', t), view: 'q', boilKey: api.key })`（`api.boy` / `api.clawdChar` 同参数；女主默认朝左、戴花）。库里已有成品组件 ch_clawd_girl / ch_clawd_boy / pr_mv_swing / pr_mv_flower / pr_mv_flower_bunch / fg_mv_petal_shower，能用就直接在分镜里 use。

## 常量与对象

```ts
ctx: CanvasRenderingContext2D
PAL: { paper: string; ink: string; clay: string; clayDk: string; clayLt: string; night: string; indigo: string; rose: string; ochre: string; sap: string; teal: string; violet: string; cream: string; sky: string; orange: st…
TAU: number
/** Deterministic geometry helpers shared with the imported catalog components (ring / arc / round / line / poly / heart / clip …) */
shapes: ShapesApi
CHARS: CharDef[]
EMOTIONS: Emotion[]
FLOWER_COLS: string[]
/** clawd-mv character kit. `sk` is this instance's sketch (its time is the film time `t`, its boil is reset per
instance); pass it as the first argument. Give every character `boilKey: api.key` (or `api.key + ':2'` for a second one). */
sk: Sketch
GIRL: { col: string; dk: string; lt: string; }
/** Unique key of this component instance (pass as critter's opts.key so two critters boil differently) */
key: string
```

## 函数（参数名与默认值即源码）

```ts
/** A character-style shape: flat wash, pigment pooling at the bottom and edges, light on top, a boiling ink outline. */
paint(ctx: Ctx, pts: Pt[], o: PaintOpts = {}): void
/** Brush ink: a main stroke, pressure swells on some segments, and a faint dry-brush ghost. */
inkLine(ctx: Ctx, pts: Pt[], sw: number, col: string = PAL.ink, closed = false, op = 1): void
/** Background watercolour: several translucent, deformed layers, with pigment gathering at the edge. */
wcolor(ctx: Ctx, pts: Pt[], col: string, op = 0.6, layers = 4, spread = 8, edge = true): void
blob(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, col: string, op = 0.5, layers = 3): void
washRect(ctx: Ctx, x: number, y: number, w: number, h: number, stops: [number, string][], vertical = true): void
/** Light: the one additive mark. */
glow(ctx: Ctx, x: number, y: number, r: number, col = '#FFC766', a = 1): void
trace(ctx: Ctx, pts: Pt[], closed = true): void
label(ctx: Ctx, text: string, x: number, y: number, size = 22, col: string = PAL.ink, op = 0.78): void
rectPts(x: number, y: number, w: number, h: number, J = 0): Pt[]
roundRectPts(x: number, y: number, w: number, h: number, r: number, J = 0): Pt[]
ellPts(cx: number, cy: number, rx: number, ry: number, n = 24, J = 0): Pt[]
jitPts(pts: Pt[], J: number): Pt[]
heart(ctx: Ctx, x: number, y: number, s: number, col: string, sw: number): void
star(ctx: Ctx, x: number, y: number, r: number, col: string, sw: number, rot = 0, n = 4): void
critter(ctx: Ctx, c: CharDef, x: number, y: number, u: number, o: Opts = {}, t = 0): void
charById(id: string): CharDef
/** acting(t, [[0,'calm'],[2.4,'surprised'],...]) — mood changes get a blink, a take, and the new emote pops in. */
acting(t: number, keys: [number, string][], amt = 0.6): Opts
feel(name: string, t: number): Opts
combine(...os: (Opts | Partial<Opts> | undefined)[]): Opts
jit(a: number): number
hash(i: number): number
clamp(x: number, a = 0, b = 1): number
lerp(a: number, b: number, x: number): number
kf(t: number, keys: [number, number][], e = ease): number
kf2(t: number, keys: [number, number, number][], e = ease): [number, number]
ease(x: number): number
easeOut(x: number): number
easeIn(x: number): number
backOut(x: number): number
spring(t: number, t0: number, k = 6, w = 18): number
wob(t: number, f = 1, ph = 0): number
seg(t: number, a: number, b: number): number
frac(x: number): number
pulse(t: number, k = 6): number
jump(t: number, t0: number, t1: number, h = 3): Pose
take(t: number, t0: number, amt = 1): Pose
mixCol(a: string, b: string, k: number): string
rgba(hex: string, a: number): string
/** Landscape brushes: hill polygon, grass tufts, five-petal flowers, puffy cloud */
hillPts(y: number, amp: number, freq: number, ph: number, bottom = FH + 60, x0 = -80, x1 = FW + 80): Pt[]
/** n swaying grass tufts scattered in the band y0..y1 (x across x0..x1) */
tufts(ctx: Ctx, n: number, y0: number, y1: number, col: string, t: number, seed: number, scale = 1, x0 = -100, x1 = FW + 100): void
/** n little five-petal flowers in the band y0..y1 (x across x0..x1); size grows toward y1 */
flowers(ctx: Ctx, n: number, y0: number, y1: number, t: number, seed: number, x0 = 0, x1 = FW, cols: readonly string[] = FLOWER_COLS): void
/** Soft four-puff watercolour cloud centred at (x, y), puff radius s */
cloud(ctx: Ctx, x: number, y: number, s: number, key: string, col: string = PAL.cream, op = 0.85): void
/** The Clawd character itself (clay orange); (x, y) = ground point between the feet, u = body unit (10u wide, 8u tall) */
clawdChar(sk: Sketch, x: number, y: number, u: number, o: ClawdOpts = {}): void
/** Pink heroine (u × 0.92, faces left, flower hat, always a little blush) */
girl(sk: Sketch, x: number, y: number, u: number, o: ClawdOpts = {}): void
/** Clay hero */
boy(sk: Sketch, x: number, y: number, u: number, o: ClawdOpts = {}): void
/** Expression + body motion + tint of one emotion: spread it into the character's options */
feelMv(name: string, t: number, over: Partial<ClawdOpts> = {}): ClawdOpts
/** Emotion timeline with anticipation and take: [[0,'happy'],[1.3,'surprised']] (pass { base: api.GIRL } for the girl) */
emotionsMv(t: number, keys: [number, string, Partial<ClawdOpts>?][], o: { take?: number; base?: Pick<ClawdOpts, 'col' | 'dk' | 'lt'> } = {}): ClawdOpts
/** Dance / locomotion pose of one style (spread after feelMv so the pose wins) */
moveMv(style: string, t: number, seed = 0): ClawdOpts
/** Prop hooks: guitar for armL, pinned flower for draw */
guitar(sk: Sketch, u: number, sw: number): void
/** a small flower pinned on the chest (draw hook) */
pinned(sk: Sketch, u: number, sw: number): void
/** One flower growing (grow 0..1: stem → leaves → petals); returns the flower centre */
flowerMv(sk: Sketch, x: number, y: number, s: number, grow = 1, sway = 0, key = 'f', rich = key === 'hero'): Pt
/** A bunch of n flowers */
bunch(sk: Sketch, t: number, x: number, y: number, s: number, n: number, grow = 1, key = 'b'): void
/** Petals falling from (x, y) since t0 */
petals(sk: Sketch, t: number, t0: number, x: number, y: number, n = 10, life = 6, dir = 1): void
/** Petals drifting along an arc from (x0, y0) to (x1, y1) since t0 */
petalArc(sk: Sketch, t: number, t0: number, x0: number, y0: number, x1: number, y1: number, life = 4): void
/** Swing frame on the ground at (x, y), beam height h, swing angle ang; returns [seatX, seatY, ang] */
swing(sk: Sketch, x: number, y: number, h = 300, ang = 0, col = '#8A5A3C'): SwingSeat
/** Swing angle at time t (one full swing every two bars) */
swingAng(t: number, amp: number, ph = 0): number
/** Geometry for `anchors`: where the tip of a clawd-mv character's arm is, `armTip(opts, u, 'L' | 'R')` → [x, y] from
the feet. Pass the same `opts` and `u` you draw with (api.girl draws at u × 0.92 and faces left: add `flip: true`) */
armTip(o: BodyPose, u: number, which: 'L' | 'R'): Pt
/** Geometry for `anchors`: a point of the character's body frame (units of u, feet = [0, 0], up = −y) as drawn, e.g. the head top is [0, -8] */
bodyPoint(o: BodyPose, u: number, p: Pt): Pt
/** Independent line-boil stream for one part of the component (e.g. each wing) */
subSeed: (part: string) => void
/** Seconds since param `name` last changed in the storyboard (shot time if it never changes) */
since: (name: string) => number
```

## 最小示例

```ts
import type { ComponentDef } from '../../src/core/types.ts';
import type { ClawdApi } from '../../src/styles/clawd/api.ts';

export const redCell: ComponentDef<ClawdApi> = {
  name: 'red_cell',
  style: 'clawd',
  kind: 'actor',
  description: 'Squishy clay-red blood cell with a dimple',
  tags: ['bio', 'blood'],
  size: [200, 150],
  params: { squeeze: { type: 'number', default: 0, min: 0, max: 1, description: 'squash 0..1' } },
  draw(api, p, t) {
    const sq = Number(p.squeeze);
    const bob = api.wob(t, 0.8) * 4;
    api.paint(api.ctx, api.ellPts(0, -70 + bob, 85 * (1 - 0.35 * sq), 58 * (1 + 0.3 * sq), 22, 3), { wash: api.PAL.clay, sw: 5 });
    api.subSeed('dimple');
    api.blob(api.ctx, 0, -70 + bob, 34, 20, api.PAL.clayDk, 0.55);
  },
};
```
