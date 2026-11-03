#!/usr/bin/env node
// act-strip.mjs — render one action (or one component) as a storyboard strip, so a drawing can be
// checked by eye before it is accepted. This is the "出图自查" step in AGENTS.md.
//
// Usage:
//   node scripts/act-strip.mjs clawd move:bounce [times…] [--out=out/strip.png]
//   node scripts/act-strip.mjs girl emotion:happy
//   node scripts/act-strip.mjs boy move:wave 0 0.5 1 1.5 2
//   node scripts/act-strip.mjs path/to/component.ts [times…] [--param=key=value]
//
// Characters: clawd | girl | boy. Actions: move:<style> | emotion:<id> | none.
// Times default to 0..2s in 0.25s steps. The strip is written to out/strip.png unless --out is given.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { PAL, setBoil, boilSeed } from '../src/styles/clawd/core.ts';
import { createClawdApi } from '../src/styles/clawd/api.ts';
import { clawd, girl, boy, feel, move, MOVE_STYLES, EMOTION_NAMES } from '../src/styles/clawd/sketch/character.ts';
import { renderComponentCanvas, setupClawdCanvas } from './lib/clawd-node.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHARACTERS = { clawd, girl, boy };
const DEFAULT_TIMES = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (const a of argv) {
  if (!a.startsWith('--')) { positional.push(a); continue; }
  const i = a.indexOf('=');
  const key = i < 0 ? a.slice(2) : a.slice(2, i);
  const val = i < 0 ? true : a.slice(i + 1);
  if (flags[key] === undefined) flags[key] = val;
  else if (Array.isArray(flags[key])) flags[key].push(val);
  else flags[key] = [flags[key], val];
}
const out = path.resolve(flags.out || path.join(ROOT, 'out', 'strip.png'));
const cols = Math.max(1, Number(flags.cols || 6));
const [cellW, cellH] = String(flags.cell || '420x460').split('x').map(Number);
const u = Number(flags.u || 22);
const params = Object.fromEntries((Array.isArray(flags.param) ? flags.param : flags.param ? [flags.param] : []).map((s) => {
  const i = s.indexOf('=');
  return i < 0 ? [s, true] : [s.slice(0, i), parseLiteral(s.slice(i + 1))];
}));

function parseLiteral(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null') return null;
  const n = Number(v);
  return v !== '' && !Number.isNaN(n) ? n : v;
}

function parseAct(raw) {
  if (!raw || raw === 'none') return {};
  const i = raw.indexOf(':');
  if (i < 0) throw new Error(`action must be move:<style> or emotion:<id> (got "${raw}")`);
  const kind = raw.slice(0, i), name = raw.slice(i + 1);
  if (kind === 'move') {
    if (!MOVE_STYLES.includes(name)) throw new Error(`unknown move "${name}". Known: ${MOVE_STYLES.join(', ')}`);
    return { move: name };
  }
  if (kind === 'emotion') {
    if (!EMOTION_NAMES.includes(name)) throw new Error(`unknown emotion "${name}". Known: ${EMOTION_NAMES.join(', ')}`);
    return { emotion: name };
  }
  throw new Error(`unknown action kind "${kind}" (use move: or emotion:)`);
}

function caption(g, text, x, y) {
  g.fillStyle = PAL.ink;
  g.globalAlpha = 0.75;
  g.font = '20px sans-serif';
  g.fillText(text, x, y);
  g.globalAlpha = 1;
}

function characterCell(name, act, t) {
  const c = createCanvas(cellW, cellH);
  const ctx = c.getContext('2d');
  ctx.fillStyle = PAL.paper;
  ctx.fillRect(0, 0, cellW, cellH);
  const key = `${name}:strip`;
  setBoil(t);
  boilSeed(key);
  const api = createClawdApi(ctx, key, {}, t, t);
  const opts = { ...(act.emotion ? feel(act.emotion, t) : {}), ...(act.move ? move(act.move, t) : {}) };
  CHARACTERS[name](api.sk, cellW / 2, cellH - 36, u, opts);
  return c;
}

async function componentCell(target, t) {
  const file = path.resolve(target);
  if (!fs.existsSync(file)) throw new Error(`no such file: ${target}`);
  setupClawdCanvas();
  const source = fs.readFileSync(file, 'utf8');
  const { validateComponentSource } = await import('../src/core/security.ts');
  validateComponentSource(source, path.basename(file), { style: 'clawd' });
  const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
  const def = Object.values(mod).find((v) => v && typeof v === 'object' && typeof v.draw === 'function' && Array.isArray(v.size));
  if (!def) throw new Error(`no ComponentDef exported from ${target}`);
  return renderComponentCanvas(def, params, t, t, { pad: 16, paper: true });
}

async function main() {
  const target = positional[0];
  if (!target) {
    console.error('Usage: node scripts/act-strip.mjs <clawd|girl|boy|component.ts> [move:<style>|emotion:<id>|none] [times…] [--out=…] [--cols=…] [--cell=WxH] [--param=k=v]');
    process.exit(1);
  }
  const isCharacter = target in CHARACTERS;
  const act = isCharacter ? parseAct(positional[1]) : {};
  const times = positional.slice(isCharacter ? 2 : 1).map(Number).filter((n) => Number.isFinite(n));
  const at = times.length ? times : DEFAULT_TIMES;

  const cells = [];
  for (const t of at) {
    const c = isCharacter ? characterCell(target, act, t) : await componentCell(target, t);
    cells.push({ t, c });
  }

  const rows = Math.ceil(cells.length / cols);
  const capH = 28, headH = 56;
  const strip = createCanvas(cols * cellW, headH + rows * (cellH + capH));
  const g = strip.getContext('2d');
  g.fillStyle = PAL.paper;
  g.fillRect(0, 0, strip.width, strip.height);
  g.fillStyle = PAL.ink;
  g.font = '700 28px sans-serif';
  const label = isCharacter ? `${target}  ${positional[1] ?? 'none'}` : path.basename(target);
  g.fillText(label, 16, 38);

  cells.forEach(({ t, c }, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = col * cellW, y = headH + row * (cellH + capH);
    g.drawImage(c, x + (cellW - c.width) / 2, y + (cellH - c.height) / 2);
    caption(g, `t=${t.toFixed(2)}s`, x + 12, y + cellH + 20);
  });

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, strip.toBuffer('image/png'));
  console.log(`strip: ${out}  (${cells.length} frames, ${strip.width}×${strip.height})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
