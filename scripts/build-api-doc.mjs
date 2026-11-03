#!/usr/bin/env node
// Generate docs/API.<style>.md from the real api interfaces with the TypeScript compiler API:
// every member's actual signature (parameter names, defaults) and the doc comment of its source declaration.
// The drawing-model prompt quotes only this file, so the docs can never drift from the engine.
// Usage: node scripts/build-api-doc.mjs [clawd|pixel]   (default: both)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STYLES = {
  clawd: {
    file: 'src/styles/clawd/api.ts',
    iface: 'ClawdApi',
    types: { 'src/styles/clawd/paint.ts': ['Pt', 'Ctx', 'PaintOpts'], 'src/styles/clawd/core.ts': ['Pose', 'View'], 'src/styles/clawd/critters.ts': ['EyeType', 'MouthType', 'Emote', 'Hat', 'Opts'], 'src/styles/clawd/sketch/core.ts': ['Sketch'], 'src/styles/clawd/sketch/character.ts': ['ClawdOpts', 'Hook', 'ViewName'], 'src/styles/clawd/anchors.ts': ['BodyPose'] },
    notes: async () => {
      const { CHARS } = await import('../src/styles/clawd/critters.ts');
      const { EMOTIONS } = await import('../src/styles/clawd/emotions.ts');
      return [
        `模块常量：FW = 1920，FH = 1080；PAL 键：${Object.keys((await import('../src/styles/clawd/core.ts')).PAL).join(' ')}`,
        `角色（api.charById(id)）：${CHARS.map((c) => `${c.id} ${c.name}（${c.kind}）`).join('，')}`,
        `表情（api.feel / api.acting 的名字）：${EMOTIONS.map((e) => `${e.id} ${e.cn}`).join('，')}`,
        '画角色：`api.critter(api.ctx, api.charById(\'bean\'), 0, 0, 24, api.combine(api.feel(\'happy\', lt), { key: api.key, view: \'q\' }), t)`，(x, y) 是双脚之间的地面点，u 是身体单位（24 ≈ 300px 宽）。',
        ...(await (async () => {
          const mv = await import('../src/styles/clawd/sketch/character.ts');
          return [
            `clawd-mv 角色套件（第一个参数都是 \`api.sk\`）：情绪（api.feelMv / api.emotionsMv）：${mv.EMOTION_NAMES.join(' ')}；动作（api.moveMv）：${mv.MOVE_STYLES.join(' ')}；眼睛：${mv.EYE_KINDS.join(' ')}；嘴：${mv.MOUTH_KINDS.join(' ')}；帽子：${mv.HAT_KINDS.join(' ')}；气泡：${mv.EMOTE_KINDS.join(' ')}`,
            '画 clawd-mv 角色：`api.girl(api.sk, 0, 0, 24, { ...api.feelMv(\'happy\', t), ...api.moveMv(\'bounce\', t), view: \'q\', boilKey: api.key })`（`api.boy` / `api.clawdChar` 同参数；女主默认朝左、戴花）。库里已有成品组件 ch_clawd_girl / ch_clawd_boy / pr_mv_swing / pr_mv_flower / pr_mv_flower_bunch / fg_mv_petal_shower，能用就直接在分镜里 use。',
          ];
        })()),
      ];
    },
    title: 'clawd 组件绘制 API（源码直出）',
    rules: [
      '世界 1920×1080。组件在**局部坐标**里画：原点 = 锚点 = 包围盒底边中点，向上是 −y；背景组件不平移，直接用世界坐标画满 1920×1080。',
      '引擎在调用 `draw` 前已经做好 `translate(x, y)`、`scale(±scale, scale)`（flip 时水平镜像），并按实例设好线条抖动种子；组件不要自己设种子。',
      '同一组件里需要多套独立抖动时（左右翅膀、每根草）调用 `api.subSeed(\'名字\')`。`api.jit(a)` 返回 ±a 的确定性抖动。',
      '纯函数：只能依赖 `api`、`params`、`t`（整片时间）、`lt`（镜头内时间）。禁止 `Math.random`、模块级 `let/var`、任何非 `import type` 的导入、`document`、`fetch`、`process`、`eval` 等。',
      '画风：水彩铺色 + 手绘墨线。主体形状用 `api.paint(ctx, pts, { wash, sw })`（自动描墨线），柔和色块用 `api.blob` / `api.wcolor`，发光用 `api.glow`，颜色优先取 `api.PAL`。',
      '**位移交给分镜**：组件里不要用 `frac()` / `%` 做循环位移（滑一段再跳回原处，叠上分镜的 x/y 运动就像掉帧）；原地的呼吸、摇摆、抖动用 `Math.sin` 这类连续函数。门禁会逐帧检查“滑动后瞬间跳回”。',
      '**同一角色各状态一样大**：enum 状态（如 cloud / heavy / rain）只改外形和颜色，主体大小保持一致；大小变化交给分镜的 `scale`，否则切状态时角色会突然变小。',
      '`api.since(\'参数名\')`：这个参数在分镜里多久前变过（秒），用来做切换动画；`api.key`：本实例唯一键（传给 `api.critter` 的 `opts.key`）。',
      '**挂点（anchors）**：组件可以声明 `anchorNames` 和 `anchors(api, params, t, lt)`，返回若干命名点（局部坐标：原点 = 锚点，向上是 −y，未缩放、未镜像）。分镜里的 `attach: { to, at, with? }` 把另一个演员挂在这个点上（手持物贴手、头顶的东西贴头），缩放和镜像由引擎处理，组件自己不用管。**手持的组件**（杯子、伞、手电、气球……）正常按「包围盒底边中点 = 原点」来画，另外声明一个锚点（惯例叫 `grip`，写握把/绳端的位置），分镜里写 `with: "grip"`，引擎就让这个锚点落在手上。`anchors` 只做几何、不能画图（碰 `api.ctx` / `api.sk` 会报错）；算 clawd-mv 角色的手和身体用 `api.armTip` / `api.bodyPoint`，并且和 `draw` 用同一套姿势参数。每个名字每个时刻都必须返回有限的 [x, y]，门禁会检查。',
      '**地面（surface）**：背景可以声明 `surface(api, params, t, lt)`，返回 `x → y` 的函数（会晃的桥面、有坡度的地面都可以）。分镜里写 `ground: true` 的演员站在这条线上，`y` 变成偏移。',
    ],
    example: `import type { ComponentDef } from '../../src/core/types.ts';
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
};`,
  },
  pixel: {
    file: 'src/engine/component.ts',
    iface: 'ComponentDrawApi',
    types: { 'src/engine/sprites.ts': ['ItemSpec'], 'src/engine/world.ts': ['TextCmd'] },
    classes: { 'src/engine/surface.ts': ['PixelSurface'] },
    notes: async () => [],
    title: '像素组件绘制 API（源码直出）',
    rules: [
      '世界 480×240 逻辑像素。组件在自己 `size` 大小的局部画布上作画；锚点 = 底边中点 `[w/2, h]`；背景固定 `[480, 240]`。',
      '纯函数：只依赖 `api`、`params`、`t`、`lt`；禁止 `Math.random`（用 `api.hashFloat`）和模块级 `let/var`。',
      '未画的像素是透明的（哨兵 255），引擎贴回世界时自动处理；颜色只用 `api.C` 调色板索引。',
    ],
    example: '',
  },
};

/** Doc comment directly above a declaration (JSDoc or // lines) */
function leadingDoc(node, sf) {
  const text = sf.getFullText();
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
  return ranges
    .map((r) => text.slice(r.pos, r.end))
    .map((c) => c.replace(/\r\n?/g, '\n').replace(/^\/\*\*?|\*\/$/g, '').replace(/^\s*\*\s?/gm, '').replace(/^\/\/\s?/gm, '').trim())
    .filter((c) => c && !/^-{3,}/.test(c))
    .join(' ');
}

/** Find the function-like declaration a `typeof x.y` member points at */
function declOf(checker, type) {
  const sym = type.getSymbol() ?? type.aliasSymbol;
  const d = sym?.valueDeclaration ?? sym?.declarations?.[0];
  if (!d) return null;
  if (ts.isVariableDeclaration(d) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) return { fn: d.initializer, host: d.parent.parent };
  if (ts.isFunctionDeclaration(d) || ts.isMethodDeclaration(d) || ts.isArrowFunction(d)) return { fn: d, host: d };
  return null;
}

function paramsText(fn) {
  return fn.parameters.map((p) => p.getText().replace(/\s+/g, ' ')).join(', ');
}

/** Public method signatures of named classes (api.s is a PixelSurface) */
function classMethods(program, classes) {
  const out = [];
  for (const [rel, names] of Object.entries(classes ?? {})) {
    const sf = program.getSourceFile(path.join(ROOT, rel));
    if (!sf) throw new Error(`${rel} not in program`);
    ts.forEachChild(sf, (n) => {
      if (!ts.isClassDeclaration(n) || !n.name || !names.includes(n.name.text)) return;
      for (const m of n.members) {
        if (!ts.isMethodDeclaration(m) || !m.name) continue;
        const mods = ts.getCombinedModifierFlags(m);
        if (mods & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) continue;
        const name = m.name.getText(sf);
        const ret = m.type ? m.type.getText(sf) : 'void';
        const doc = leadingDoc(m, sf);
        out.push(`${doc ? `/** ${doc} */\n` : ''}s.${name}(${paramsText(m)}): ${ret}`);
      }
    });
  }
  return out;
}

/** Declaration text of named type aliases / interfaces, comments stripped to one line each */
function typeDecls(program, types) {
  const out = [];
  for (const [rel, names] of Object.entries(types)) {
    const sf = program.getSourceFile(path.join(ROOT, rel));
    if (!sf) throw new Error(`${rel} not in program`);
    ts.forEachChild(sf, (n) => {
      if ((ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) && names.includes(n.name.text)) {
        // drop line comments before joining lines, or "// note" would swallow every member after it
        out.push(n.getText(sf).replace(/^export\s+/, '').replace(/\/\/[^\n]*/g, '').replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' '));
      }
    });
  }
  return out;
}

export async function buildApiDoc(style) {
  const cfg = STYLES[style];
  const file = path.join(ROOT, cfg.file);
  const extra = [...Object.keys(cfg.types), ...Object.keys(cfg.classes ?? {})].map((r) => path.join(ROOT, r));
  const program = ts.createProgram([file, ...extra], { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, allowImportingTsExtensions: true, noEmit: true, strict: true, lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'], types: [] });
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(file);
  let iface = null;
  ts.forEachChild(sf, (n) => { if (ts.isInterfaceDeclaration(n) && n.name.text === cfg.iface) iface = n; });
  if (!iface) throw new Error(`${cfg.iface} not found in ${cfg.file}`);

  const fns = [];
  const values = [];
  for (const m of iface.members) {
    if (!ts.isPropertySignature(m) || !m.type) continue;
    const name = m.name.getText();
    const own = leadingDoc(m, sf);
    const type = checker.getTypeAtLocation(m.type);
    const sigs = type.getCallSignatures();
    if (sigs.length) {
      const found = declOf(checker, type);
      let sig;
      let doc = own;
      if (found) {
        const ret = checker.typeToString(checker.getReturnTypeOfSignature(sigs[0]));
        sig = `${name}(${paramsText(found.fn)}): ${ret}`;
        const dsf = found.fn.getSourceFile();
        doc = doc || leadingDoc(found.host, dsf);
      } else {
        sig = `${name}: ${checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation)}`;
      }
      fns.push({ sig, doc });
    } else {
      let t = checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
      if (t.length > 220) t = t.slice(0, 217) + '…';
      values.push({ sig: `${name}: ${t}`, doc: own });
    }
  }

  const out = [`# ${cfg.title}`, '', `> 由 \`scripts/build-api-doc.mjs\` 从 \`${cfg.file}\` 的 \`${cfg.iface}\` 生成，勿手改。`, '', '## 契约', '', ...cfg.rules.map((r) => `- ${r}`), ''];
  const decls = typeDecls(program, cfg.types);
  if (decls.length) out.push('## 类型', '', '```ts', ...decls, '```', '');
  const notes = await cfg.notes();
  if (notes.length) out.push('## 速查', '', ...notes.map((n) => `- ${n}`), '');
  out.push('## 常量与对象', '', '```ts', ...values.map((v) => (v.doc ? `/** ${v.doc} */\n${v.sig}` : v.sig)), '```', '');
  out.push('## 函数（参数名与默认值即源码）', '', '```ts', ...fns.map((f) => (f.doc ? `/** ${f.doc} */\n${f.sig}` : f.sig)), '```', '');
  const methods = classMethods(program, cfg.classes);
  if (methods.length) out.push('## 画布方法（api.s）', '', '```ts', ...methods, '```', '');
  if (cfg.example) out.push('## 最小示例', '', '```ts', cfg.example, '```', '');
  return out.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const which = process.argv[2] ? [process.argv[2]] : Object.keys(STYLES);
  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  for (const s of which) {
    const md = await buildApiDoc(s);
    fs.writeFileSync(path.join(ROOT, 'docs', `API.${s}.md`), md);
    console.log(`docs/API.${s}.md: ${md.split('\n').length} lines`);
  }
}
