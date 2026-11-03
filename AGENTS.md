# AGENTS.md — 给外部协作者（含网页版 Claude）的工作约定

本仓库是 **clawd-kit**：水彩手绘角色的引擎与工具链。组件库在 `clawd-components`。

## 1. 环境

```bash
node --version     # 需要 >= 22.18
npm install
```

Node 直接运行 `.ts`，不要引入构建步骤。渲染走 `@napi-rs/canvas`，不需要浏览器。

## 2. 命令

| 命令 | 用途 |
|---|---|
| `npm test` | 全部测试 |
| `node scripts/gate.mjs <file.ts>` | 单个组件门禁：源码安全、契约、出卡图 + 场景图 |
| `node scripts/build-api-doc.mjs` | 重新生成 `docs/API.clawd.md` |
| `node scripts/act-strip.mjs <角色> <动作> [时间点…]` | 动作分镜条（自查用） |

## 3. “做完”的定义

一个改动算完成，必须同时满足：

1. `npm test` 通过；
2. 贴出**你自己看过的图**：组件用 `gate.mjs` 生成的 `<name>_card.png` 与 `<name>_context.png`，动作/角色用 `act-strip.mjs` 生成的分镜条；
3. 在说明里写清楚改了哪些文件、为什么。

**只看代码不算完成。** 画出来的东西必须放大看过：第一版 `cross_arms` 就是因为没放大，折臂像一撇胡子。

## 4. 画组件 / 加动作 / 加角色

三份清单在 `docs/`：

- `docs/ADD_COMPONENT.md`
- `docs/ADD_ACTION.md`
- `docs/ADD_CHARACTER.md`

## 5. 已知的坑

- **`flip` 语义**：`flip: true` 是把角色水平镜像成朝左；`x` 仍是角色脚下地面点，不是镜像后的位置。
- **`rot` / `dx` 是屏幕空间**：先旋转/位移再按角色本地坐标画，不要反过来推导。
- **手臂图层在身体后面**：远侧手臂先画，近侧手臂后画；不要把两只手臂都放到身体前面。
- **动作表**：`move()` 的动作是纯时间函数，必须对所有 `t` 返回有限值；门禁会扫多个时间点。
- **不要自己播种**：`randomSeed` / `setBoil` / `boilSeed` 由引擎管理，组件里出现会被门禁拒绝。
- **组件不能 import 值**（clawd 风格）：一切通过 `api` 拿；只有 `import type` 允许。

## 6. 提交

- 一次只做一件事：组件、动作、引擎改动不要混在一个 PR。
- 改引擎/角色套件会影响所有组件的 API，必须在说明里列出受影响的 `api.*`。
