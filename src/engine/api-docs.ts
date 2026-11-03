// Extract true ComponentDrawApi documentation from TypeScript source code
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const engineDir = __dirname;

export function extractApiDocs(): string {
  const componentTs = fs.readFileSync(path.join(engineDir, 'component.ts'), 'utf8');

  // Extract ComponentDrawApi interface block
  const apiMatch = /export interface ComponentDrawApi \{([\s\S]*?)\n\}/.exec(componentTs);
  const apiBody = apiMatch ? apiMatch[1].trim() : '';

  return `# 像素科普组件绘制 API 手册 (源码直出)

## 契约规则
- **局部画布**：组件在自己 \`size: [w, h]\` 尺寸的局部画布上作画，背景组件固定为 \`[480, 240]\`。
- **锚点坐标**：底边中点 \`[w/2, h]\` 对应世界脚底坐标 \`[x, y]\`。
- **纯函数确定性**：只能依赖 \`api\`、\`params\`、\`t\`、\`lt\`，严禁使用 \`Math.random\`（强制使用 \`api.hashFloat\`），严禁模块顶层 \`let\` / \`var\`。
- **透明度**：未绘制的像素为透明（哨兵值 255），引擎在贴回世界时自动处理。

## ComponentDrawApi 源码签名
\`\`\`typescript
interface ComponentDrawApi {
${apiBody}
}
\`\`\`

## 关键画风工具用法
0. **表面绘制基本方法** \`api.s\`:
   - \`s.pset(x, y, col, emissive?)\` 或 \`s.set(x, y, col)\`: 单像素着色
   - \`s.fillRect(x, y, w, h, col, emissive?)\`: 填充矩形
   - \`s.strokeRect(x, y, w, h, col, emissive?)\`: 描边矩形
   - \`s.hline(x, y, len, col)\` / \`s.vline(x, y, len, col)\`: 水平/垂直直线
   - \`s.pget(x, y)\` 或 \`s.get(x, y)\`: 获取像素颜色
1. **凹凸与材质着色** \`api.shadeShape(s, x0, y0, w, h, inside, ramp, opts)\`:
   - \`inside\`: \`(x, y) => boolean\` 判断形状内像素
   - \`ramp\`: 颜色三元组 \`[dark, mid, bright]\`（可从 \`api.TINT_RAMP[tint]\` 获取）
   - \`opts\`: \`{ texture?: (x, y) => number | null, gloss?: boolean, emissive?: number }\`
2. **像素抖动判定** \`api.bayer4(x, y)\`:
   - 返回 0..15 的抖动门槛，配合阈值实现细腻的 1px 像素过渡
3. **确定性伪随机** \`api.hashFloat(seed)\`:
   - 返回 0..1 的浮点数，替代 \`Math.random\`
4. **标准物品** \`api.drawItem(s, x, y, item, t, showGlyph?)\`:
   - 绘制小图标、齿轮、卷轴等经典像素物件
`;
}
