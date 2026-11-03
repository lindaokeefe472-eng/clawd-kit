# 加一个组件

组件是 `components/clawd/` 下的**一个文件一个组件**。文件名 = `组件名.ts`，组件名用 `snake_case`。

## 1. 选 kind 与命名

| kind | 命名前缀 | 例子 |
|---|---|---|
| `background` | `bg_` | `bg_meadow` |
| `actor` | `ch_`（角色）/ `an_`（动物） | `ch_critter` |
| `prop` | `pr_` | `pr_campfire` |
| `foreground` | `fg_` | `fg_mv_petal_shower` |

`size` 是包围盒 `[w, h]`；非背景组件的锚点 = **底边中点**。背景必须是画风世界尺寸（`CLAWD_INFO.world`，1920×1080）。

## 2. 写文件

```ts
import type { ComponentDef } from '../../src/core/types.ts';
import type { ClawdApi } from '../../src/styles/clawd/api.ts';

export const my_thing: ComponentDef<ClawdApi> = {
  name: 'my_thing',
  style: 'clawd',
  kind: 'prop',
  description: '一句话说清它长什么样、怎么用',
  tags: ['watercolour', 'nature'],
  size: [200, 160],
  params: {
    tint: { type: 'enum', default: 'rose', options: ['rose', 'sky'], description: '主色' },
  },
  draw(api, p, t, lt) {
    const { ctx, PAL } = api;
    // 只通过 api 画；不要 import 值，不要碰随机种子
  },
};
```

**硬规则**

- 只允许 `import type`；任何值 import 都会被 `validateComponentSource` 拒绝。
- 不要用 `process` / `fetch` / `setTimeout` / `Math.random` 等；随机与时间由引擎给。
- `draw` 必须是 `api / params / t / lt` 的纯函数：同一帧重复画结果一致。
- 所有分镜会用到的参数都要在 `params` 里声明，类型与默认值一致。
- 要能被别的东西挂住：声明 `anchorNames` 并实现 `anchors`（纯几何，不能画）。
- 背景要让人站上去：实现 `surface(x) => y`。

## 3. 出图自查（必做）

```bash
node scripts/gate.mjs components/clawd/my_thing.ts
```

退出码 0 且 stdout 里 `"ok": true` 才算过。产物：

- `out/gate/my_thing_card.png` — 参数变体卡片
- `out/gate/my_thing_context.png` — 放进场景里的样子

**两张都要打开放大看。** 只看代码或只看缩略图不算完成。

## 4. 重建索引

```bash
node scripts/preview-clawd.mjs my_thing
```

会重写 `components/clawd/INDEX.md` 与 `index.json`，并生成 `previews/my_thing.png`。

## 5. 测试

在 `tests/` 里加一条最小测试：组件能被注册表加载、门禁通过、关键参数不抛错。
`tests/library_clawd.test.mjs` 会对整个库跑门禁，确认没有把别的组件弄坏。

## 6. 容易踩的坑

- `flip` 是屏幕镜像，`x` 仍是地面点。
- `rot` / `dx` 是屏幕空间。
- 手臂/远侧肢体先画，近侧后画。
- 画完必须看 `_context.png`：单看卡片会漏掉“放进场景后比例不对/穿模”。
