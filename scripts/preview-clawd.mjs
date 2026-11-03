#!/usr/bin/env node
// Preview cards for clawd library components + the generated index (components/clawd/index.json, and INDEX.md for people).
// Usage: node scripts/preview-clawd.mjs [name ...]     (default: all; cards -> components/clawd/previews/)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { loadRegistry } from '../src/core/registry-node.ts';
import { CLAWD_INFO, SUB_FONT } from '../src/styles/clawd/adapter.ts';
import { PAL } from '../src/styles/clawd/core.ts';
import { renderComponentCanvas, setupClawdCanvas } from './lib/clawd-node.mjs';
import { libraryIndexJson } from './lib/library-index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(ROOT, 'components', 'clawd');
const OUT = path.join(LIB, 'previews');

/** Param variants worth showing side by side */
function variants(def) {
  const base = Object.fromEntries(Object.entries(def.params ?? {}).map(([k, p]) => [k, p.default]));
  if (def.name === 'ch_critter') return ['jiu', 'bean', 'mian', 'mo', 'bing'].map((char, i) => ({ label: char, params: { ...base, char, emotion: ['happy', 'calm', 'shy', 'smug', 'surprised'][i] } }));
  const firstEnum = Object.entries(def.params ?? {}).find(([, p]) => p.type === 'enum');
  if (firstEnum && def.kind !== 'background') return firstEnum[1].options.slice(0, 4).map((v) => ({ label: `${firstEnum[0]}=${v}`, params: { ...base, [firstEnum[0]]: v } }));
  const firstBool = Object.entries(def.params ?? {}).find(([, p]) => p.type === 'boolean');
  if (firstBool && def.kind !== 'background') return [true, false].map((v) => ({ label: `${firstBool[0]}=${v}`, params: { ...base, [firstBool[0]]: v } }));
  return [{ label: 'default', params: base }];
}

export function previewCard(def) {
  const vs = variants(def);
  const isBg = def.kind === 'background';
  const cellW = isBg ? 960 : Math.max(def.size[0] + 40, 220);
  const cellH = isBg ? 540 : def.size[1] + 40;
  const head = 56;
  const card = createCanvas(cellW * vs.length, cellH + head + 30);
  const g = card.getContext('2d');
  g.fillStyle = PAL.paper;
  g.fillRect(0, 0, card.width, card.height);
  g.fillStyle = PAL.ink;
  g.font = `700 30px ${SUB_FONT}`;
  g.fillText(`${def.name}  ·  ${def.kind}  ·  ${def.size.join('×')}`, 16, 38);
  vs.forEach((v, i) => {
    const c = renderComponentCanvas(def, v.params, 2.2, 1.4, { pad: isBg ? 0 : 20, paper: true });
    g.drawImage(c, i * cellW + (cellW - (isBg ? 960 : c.width)) / 2, head, isBg ? 960 : c.width, isBg ? 540 : c.height);
    if (!isBg) {
      // anchor cross: where (x, y) of the storyboard lands
      const ax = i * cellW + cellW / 2, ay = head + 20 + def.size[1];
      g.strokeStyle = PAL.clay; g.lineWidth = 2;
      g.beginPath(); g.moveTo(ax - 10, ay); g.lineTo(ax + 10, ay); g.moveTo(ax, ay - 10); g.lineTo(ax, ay + 10); g.stroke();
    }
    g.fillStyle = PAL.ink; g.globalAlpha = 0.7; g.font = `22px ${SUB_FONT}`;
    g.fillText(v.label, i * cellW + 12, head + cellH + 22);
    g.globalAlpha = 1;
  });
  return card;
}

function indexMd(defs) {
  const rows = (kind) => defs.filter((d) => d.kind === kind).map((d) => {
    const params = Object.entries(d.params ?? {}).map(([k, p]) => `\`${k}\` ${p.type === 'enum' ? p.options.join('\\|') : p.type}${p.min !== undefined ? ` ${p.min}..${p.max}` : ''} = ${JSON.stringify(p.default)}：${p.description}`).join('<br>');
    return `| **\`${d.name}\`** | \`[${d.size.join(',')}]\` | ${d.tags.map((t) => `\`${t}\``).join(' ')} | ${d.description}${d.anchorNames?.length ? `<br>**anchors**：${d.anchorNames.map((n) => `\`${n}\``).join(' ')}（分镜 \`attach: {to, at}\`）` : ''}${d.surface ? '<br>**surface**：地面线（分镜 \`ground: true\`）' : ''} | ${params || '—'} | ![](previews/${d.name}.png) |`;
  });
  const out = ['# clawd 组件库索引', '', `> 由 \`scripts/preview-clawd.mjs\` 生成，共 ${defs.length} 个组件。坐标是 1920×1080 世界像素；非背景组件的锚点 = 底边中点（预览图里的红十字）。`, ''];
  for (const kind of ['background', 'actor', 'prop', 'foreground']) {
    const r = rows(kind);
    if (!r.length) continue;
    out.push(`## ${kind} (${r.length})`, '', '| use | size | tags | 说明 | params | 预览 |', '|---|---|---|---|---|---|', ...r, '');
  }
  return out.join('\n');
}

/** Write preview cards (all, or only `names`) and rebuild INDEX.md for a clawd library directory */
export async function refreshLibrary(libDir = LIB, names = []) {
  setupClawdCanvas();
  const { registry, errors } = await loadRegistry('clawd', CLAWD_INFO.world, [{ dir: libDir, origin: 'library' }]);
  const outDir = path.join(libDir, 'previews');
  fs.mkdirSync(outDir, { recursive: true });
  const defs = [...registry.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  const written = [];
  for (const def of defs) {
    if (names.length && !names.includes(def.name)) continue;
    fs.writeFileSync(path.join(outDir, `${def.name}.png`), previewCard(def).toBuffer('image/png'));
    written.push(def.name);
  }
  fs.writeFileSync(path.join(libDir, 'INDEX.md'), indexMd(defs));
  fs.writeFileSync(path.join(libDir, 'index.json'), JSON.stringify(libraryIndexJson(defs), null, 2) + '\n');
  return { errors, count: defs.length, written };
}

async function main() {
  const r = await refreshLibrary(LIB, process.argv.slice(2));
  for (const e of r.errors) console.log(`✖ ${e}`);
  for (const n of r.written) console.log(`preview ${n}`);
  console.log(`index.json + INDEX.md: ${r.count} components`);
  process.exit(r.errors.length ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
