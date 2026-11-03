# clawd-kit

水彩手绘风的 Canvas2D 角色套件：引擎、Clawd 角色（含表情与动作）、组件门禁、API 文档生成、动作分镜条。

这是 `clawd-components` 组件库的底层依赖，也是把单个组件/角色画好并迁回项目的标准工具链。

## 安装

```bash
npm install
```

需要 Node >= 22.18（直接运行 TypeScript，不需要 `--experimental-strip-types`）。
Node 侧渲染使用 `@napi-rs/canvas`，无需浏览器。

## 常用命令

```bash
npm test                                   # 引擎 / 角色 / 门禁测试
node scripts/gate.mjs <组件.ts>            # 单组件门禁：源码安全 + 契约 + 出图，stdout 输出 JSON
node scripts/build-api-doc.mjs             # 从真实导出重新生成 docs/API.clawd.md
node scripts/act-strip.mjs clawd move:bounce 0 0.25 0.5 0.75 1
node scripts/act-strip.mjs girl emotion:happy --out=out/girl-happy.png
```

## 目录

```
src/core/            组件注册表、场景解析、校验、门禁、源码安全扫描
src/engine/          渲染引擎（画布、时间线、像素风格）
src/styles/clawd/    Clawd 画风适配器、角色套件、表情、道具
scripts/             gate / build-api-doc / act-strip / preview / promote
docs/                API.clawd.md（生成的 API）、CLAWD_WORKFLOW.md
```

## 许可

MIT。上游为 [JohnHeibel/ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase)，
经 `clawd-mv` 移植。详见 [ATTRIBUTION.md](ATTRIBUTION.md) 与 [LICENSE](LICENSE)。
