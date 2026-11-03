#!/usr/bin/env node
// Gate one clawd component file for an automated pipeline. Prints a JSON verdict on stdout, exit 0 only when ok:
//   {"ok": true, "name": "...", "errors": [], "card": "<png>", "context": "<png>"}
// Usage: node scripts/gate.mjs <file.ts> [--contract=<json>] [--out=<dir>] [--bg=<background for the in-context sheet>]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isComponentDef } from '../src/core/registry.ts';
import { contractProblems, gateComponent } from '../src/core/gates.ts';
import { CLAWD_INFO } from '../src/styles/clawd/adapter.ts';
import { clawdAnchorApi, clawdRenderBytes, setupClawdCanvas } from './lib/clawd-node.mjs';

const args = Object.fromEntries(process.argv.slice(3).map((a) => {
  const i = a.indexOf('=');
  return i < 0 ? [a.replace(/^--/, ''), 'true'] : [a.slice(2, i), a.slice(i + 1)];
}));
const file = path.resolve(process.argv[2] ?? '');
const verdict = { ok: false, name: '', errors: [], card: null, context: null };
const done = (code) => { process.stdout.write(JSON.stringify(verdict) + '\n'); process.exit(code); };

try {
  if (!fs.existsSync(file)) throw new Error(`no such file: ${file}`);
  setupClawdCanvas();
  const source = fs.readFileSync(file, 'utf8');
  // gateComponent scans the source first; import only after a clean scan
  const { validateComponentSource } = await import('../src/core/security.ts');
  validateComponentSource(source, path.basename(file), { style: 'clawd' });
  const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
  const def = Object.values(mod).find(isComponentDef);
  const report = gateComponent(source, path.basename(file), def, 'clawd', CLAWD_INFO.world, clawdRenderBytes, clawdAnchorApi);
  verdict.errors.push(...report.errors);
  if (def) {
    verdict.name = def.name;
    if (args.contract) verdict.errors.push(...contractProblems(def, JSON.parse(args.contract)));
  }
  if (def && verdict.errors.length === 0) {
    const R = await import('./lib/render-clawd.mjs');
    const out = path.resolve(args.out ?? path.join(path.dirname(file), '..', '..', 'out', 'gate'));
    fs.mkdirSync(out, { recursive: true });
    verdict.card = path.join(out, `${def.name}_card.png`);
    fs.writeFileSync(verdict.card, R.previewCard(def).toBuffer('image/png'));
    verdict.context = path.join(out, `${def.name}_context.png`);
    const sheet = await R.inContextSheet(def, { background: args.bg ?? 'bg_meadow', cols: 3, cellW: 640, projectDir: path.dirname(path.dirname(file)) });
    fs.writeFileSync(verdict.context, sheet.toBuffer('image/png'));
  }
  verdict.ok = verdict.errors.length === 0;
  done(verdict.ok ? 0 : 1);
} catch (e) {
  verdict.errors.push(e instanceof Error ? e.message : String(e));
  done(1);
}
