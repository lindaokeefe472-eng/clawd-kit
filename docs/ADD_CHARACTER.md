# 加一个角色

角色**不是单文件**：一个角色 = 一个 `ch_*` 组件 + 可选的动作、情绪、手持物 + 一个 manifest。

## 1. 角色包结构

```
characters/<name>/
  ch_<name>.ts        # 角色组件（ComponentDef<ClawdApi>）
  acts.ts             # 可选：自定义动作，加载时 registerMove(...)
  manifest.json       # 元数据与契约
  tests/              # 可选：角色自己的测试
```

## 2. manifest.json

```json
{
  "name": "clawd",
  "component": "ch_clawd",
  "facing": "right",
  "kit": ">=1.0.0",
  "moves": ["bounce", "hop", "bow"],
  "emotions": ["happy", "sad", "surprised"],
  "anchors": ["handL", "handR", "head", "chest"],
  "params": ["emotion", "hold"]
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | 是 | 角色名，`snake_case`，与目录名一致 |
| `component` | 是 | 组件名，必须等于 `ch_<name>` |
| `facing` | 是 | 原图朝向：`"right"` 或 `"left"`。**写错会让整片反着走** |
| `kit` | 是 | 所需套件版本（semver range），导入时校验 |
| `moves` | 否 | 该角色支持的动作名（必须在套件/`acts.ts` 里存在） |
| `emotions` | 否 | 支持的情绪名（必须在 `EMOTIONS` 里存在） |
| `anchors` | 否 | 对外暴露的挂点，必须与组件 `anchorNames` 完全一致 |
| `params` | 否 | 对分镜暴露的参数名，必须与组件 `params` 一致 |

## 3. 朝向约定

本项目的 `normalizeFacing` 依赖 manifest 的 `facing`：

- 小爪（`clawd`）朝右；
- 小暖（`girl`）朝左。

角色组件本身永远按**朝右**画，`flip` 由引擎处理。manifest 写的是**原画**朝向；如果原画朝左，导入时会要求组件翻转过来或明确标注。

## 4. 动作

- 内置动作：直接用 `move()` 里已有的名字，写进 `moves`。
- 自定义动作：在 `acts.ts` 里 `registerMove('bow', fn)`，并在 `moves` 里列出。
- 动作表目前**尚未**改成可注册（见 `docs/ADD_ACTION.md` 第 4 节）；在它完成前，`import-character` 会拒绝带自定义动作的角色，并说明原因。

## 5. 自查（必做）

```bash
node scripts/act-strip.mjs clawd move:bow 0 0.2 0.4 0.6 0.8 1.0
node scripts/act-strip.mjs clawd emotion:happy --out=out/clawd-happy.png
```

逐格看：朝向对不对、手脚有没有穿模、锚点有没有跑、每个动作在所有时刻姿态有限。

## 6. 测试

- 角色组件通过 `gate.mjs`；
- `anchorNames` 与 manifest 的 `anchors` 一致；
- 每个 `moves` 里的动作在 `0..2s` 采样都是有限值；
- `facing` 与组件实际朝向一致（渲染一帧，检查脸/手臂在哪一侧）。

## 7. 迁回本项目

```bash
node scripts/import-character.mjs <角色目录|仓库@提交>
```

会校验 manifest、套件版本、动作是否可注册、锚点与朝向，然后注册到 `characters.lock.json`。
