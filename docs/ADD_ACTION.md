# 加一个动作

动作（move）是角色的**纯时间函数**：给定 `t`，返回一组叠加到角色上的姿态参数。
当前动作表在 `src/styles/clawd/sketch/character.ts` 的 `move(style, t, seed)`，可选值在 `MOVE_STYLES`。

> 注意：`bow` / `sit` / `hug` / `cross_arms` 这批新动作目前在 `clawd-mv` 里，尚未迁入本仓库。
> 迁入时按下面的步骤做，并把动作表改成可注册（见第 4 节）。

## 1. 写动作函数

```ts
export function move(style: string, t: number, seed = 0): ClawdOpts {
  switch (style) {
    case 'bow': {
      const k = Math.max(0, Math.sin(t * Math.PI * 2)); // 0..1
      return { rot: k * 0.35, dy: k * 0.4, aL: -0.6, aR: -0.6 };
    }
    // ...
  }
}
```

返回值可用的字段见 `docs/API.clawd.md` 的 `ClawdOpts`（`rot` / `dx` / `dy` / `sq` / `aL` / `aR` / `lean` / `noArms` …）。

## 2. 硬规则

- 对所有 `t` 返回**有限值**；不要出现 `NaN` / `Infinity`。
- 只用 `t` 与 `seed`，不要读全局状态、不要随机播种。
- 姿态是叠加的：`dy` / `dx` / `sq` / `rot` 会相加，其余字段后写覆盖。
- 一个动作只做一件事；组合动作用调用方叠加多个 `move()`。

## 3. 注册

把新名字加进 `MOVE_STYLES`：

```ts
export const MOVE_STYLES = ['bounce', 'hop', ..., 'bow'];
```

`MOVE_STYLES` 是 API 文档和测试的取值来源，漏加会导致文档/校验看不到。

## 4. 改成可注册的动作表（尚未做）

现在动作写死在 `switch` 里。要让外部角色包注册自定义动作，需要：

1. 新建 `src/styles/clawd/acts.ts`，导出 `registerMove(name, fn)` 与 `MOVES: Map<string, MoveFn>`；
2. `move()` 先查 `MOVES`，再回退到内置表；
3. 导出 `listMoves()` 给门禁/文档；
4. 角色包的 `acts.ts` 在加载时调用 `registerMove`。

这一步会改变 `ClawdApi` 的可用动作集合，**必须单独一个 PR**，并跑全库门禁。

## 5. 自查（必做）

```bash
node scripts/act-strip.mjs clawd move:bow 0 0.15 0.3 0.45 0.6 0.75 0.9 1.05
```

打开生成的分镜条，逐格看：手脚有没有穿模、有没有某一格突然跳变、落地有没有压扁。
**不看分镜条不算完成。**

## 6. 测试

在 `tests/clawd.test.mjs` 加：

- 动作在 `0..2s` 采样 100 个点，所有返回字段都是有限数；
- 动作名在 `MOVE_STYLES` 里；
- 用 `act-strip` 用的同一套参数渲染不抛错。
