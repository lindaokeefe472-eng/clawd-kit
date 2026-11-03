// Node renderer for clawd projects (no browser): contact sheets, motion strips, frame export, component previews.
// Frames are a pure function of t, so any worker split produces the same video.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createCanvas } from '@napi-rs/canvas';
import { loadRegistry } from '../../src/core/registry-node.ts';
import { validateComponentSource } from '../../src/core/security.ts';
import { isComponentDef } from '../../src/core/registry.ts';
import { validateFreeStoryboard } from '../../src/core/validate.ts';
import { FreeFilm } from '../../src/core/film.ts';
import { resolveParams } from '../../src/core/params.ts';
import { ClawdAdapter, CLAWD_INFO, SUB_FONT } from '../../src/styles/clawd/adapter.ts';
import { setupClawdCanvas } from './clawd-node.mjs';
import { previewCard } from '../preview-clawd.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const W = CLAWD_INFO.world.w;
const H = CLAWD_INFO.world.h;

/** strict = false skips broken files instead of throwing (previews while sibling components are still being drawn) */
export async function clawdRegistry(projectDir = path.join(ROOT, 'project'), extra = [], { strict = true } = {}) {
  setupClawdCanvas();
  const built = await loadRegistry('clawd', CLAWD_INFO.world, [
    { dir: path.join(ROOT, 'components', 'clawd'), origin: 'library' },
    { dir: path.join(projectDir, 'components'), origin: 'project' },
    ...extra,
  ]);
  if (strict && built.errors.length) throw new Error(`component errors:\n  ${built.errors.join('\n  ')}`);
  return built.registry;
}

/** Film for the project in projectDir (throws on validation errors so a bad storyboard never renders silently) */
export async function loadClawdFilm(projectDir = path.join(ROOT, 'project'), options = {}) {
  const project = JSON.parse(fs.readFileSync(path.join(projectDir, 'project.json'), 'utf8'));
  const shots = JSON.parse(fs.readFileSync(path.join(projectDir, 'storyboard.json'), 'utf8'));
  const registry = await clawdRegistry(projectDir);
  const errs = validateFreeStoryboard(project, shots, registry, CLAWD_INFO);
  if (errs.length) throw new Error(`storyboard invalid (run npm run check):\n  ${errs.join('\n  ')}`);
  const canvas = createCanvas(W, H);
  const film = new FreeFilm(project, shots, registry, new ClawdAdapter(canvas.getContext('2d')), options);
  return { film, canvas };
}

function save(file, buf) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}

/** Grid of frames with a caption strip per cell (same layout as the browser contact sheet) */
export function contactSheet(film, canvas, times, { cols = 4, cellW = 384, caption } = {}) {
  const cellH = Math.round((cellW * H) / W);
  const lab = 26;
  const sheet = createCanvas(cols * cellW, Math.ceil(times.length / cols) * (cellH + lab));
  const g = sheet.getContext('2d');
  g.fillStyle = '#141020';
  g.fillRect(0, 0, sheet.width, sheet.height);
  times.forEach((t, i) => {
    const f = film.renderFrame(t);
    const x = (i % cols) * cellW;
    const y = Math.floor(i / cols) * (cellH + lab);
    g.drawImage(canvas, 0, 0, W, H, x, y + lab, cellW, cellH);
    g.fillStyle = '#e8d8b9';
    g.font = `bold 16px ${SUB_FONT}`;
    // clip the caption to its cell so long reads do not run into the neighbour
    let text = caption ? caption(t, f) : `${t.toFixed(2)}s ${f.shot.id} · ${f.shot.read}`;
    while (text.length > 4 && g.measureText(text).width > cellW - 12) text = text.slice(0, -2);
    g.save();
    g.beginPath();
    g.rect(x, y, cellW, lab);
    g.clip();
    g.fillText(text, x + 6, y + 18);
    g.restore();
  });
  return sheet;
}

export function shotMids(film) {
  return film.shots.map((s) => Number((s.start + s.dur * 0.6).toFixed(2)));
}

/** Export frame_%06d.jpg for frames [i0, i1) of the range, every `step`-th starting at `offset` */
export async function exportFrames({ projectDir, outDir, start, fps, i0, i1, offset = 0, step = 1, quality = 92, log = true, subtitles = true }) {
  const { film, canvas } = await loadClawdFilm(projectDir, { subtitles });
  fs.mkdirSync(outDir, { recursive: true });
  let n = 0;
  for (let i = i0 + offset; i < i1; i += step) {
    const file = path.join(outDir, `frame_${String(i).padStart(6, '0')}.jpg`);
    if (fs.existsSync(file)) continue;
    film.renderFrame(start + i / fps);
    fs.writeFileSync(file, await canvas.encode('jpeg', quality));
    n++;
    if (log && n % 60 === 0) console.log(`[clawd worker ${offset}] ${i + 1}/${i1}`);
  }
  return n;
}

/** Split the export over child processes (each renders every N-th frame) */
export async function exportFramesParallel({ projectDir, outDir, start, end, fps, workers = 4, subtitles = true }) {
  const total = Math.ceil((end - start) * fps);
  const self = fileURLToPath(import.meta.url);
  await Promise.all(Array.from({ length: workers }, (_, k) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [self, 'frames', JSON.stringify({ projectDir, outDir, start, fps, i0: 0, i1: total, offset: k, step: workers, subtitles })], { stdio: 'inherit' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`worker ${k} exited ${code}`))));
  })));
  return total;
}

/** Load a single component by library name, project name, or file path (AST-scanned before import) */
export async function loadComponent(spec, projectDir = path.join(ROOT, 'project')) {
  const candidates = spec.endsWith('.ts')
    ? [path.resolve(spec)]
    : [path.join(projectDir, 'components', `${spec}.ts`), path.join(ROOT, 'components', 'clawd', `${spec}.ts`)];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    validateComponentSource(fs.readFileSync(file, 'utf8'), path.basename(file), { style: 'clawd' });
    const mod = await import(pathToFileURL(file).href);
    const def = Object.values(mod).find(isComponentDef);
    if (def) return { def, file };
  }
  const reg = await clawdRegistry(projectDir);
  const def = reg.get(spec);
  if (def) return { def, file: null };
  throw new Error(`component "${spec}" not found (looked in project/components, components/clawd)`);
}

const SWEEP_DUR = 3.6;

/**
 * Every declared param walks through its range over the preview (numbers min → max, enums step through their
 * options, booleans flip), so param-driven animation is visible; params given explicitly stay fixed.
 */
export function sweepParams(def, given = {}) {
  const out = { ...given };
  for (const [k, p] of Object.entries(def.params ?? {})) {
    if (k in given) continue;
    if (p.type === 'number') out[k] = [[0.2, p.min ?? 0], [SWEEP_DUR - 0.2, p.max ?? 1]];
    else if (p.type === 'enum' && p.options?.length > 1) out[k] = p.options.map((o, i) => [(i * SWEEP_DUR) / p.options.length, o]);
    else if (p.type === 'boolean') out[k] = [[0, !p.default], [SWEEP_DUR / 2, p.default]];
  }
  return out;
}

/**
 * In-context preview: the component placed in a real scene next to Bean for scale, sampled over 3 s.
 * Backgrounds are shown as the scene itself with Bean walking across.
 */
export async function inContextSheet(def, { background = 'bg_meadow', params: given = {}, cols = 3, cellW = 640, projectDir, at, presenter, sweep = true } = {}) {
  const params = sweep ? sweepParams(def, given) : given;
  const extra = new Map([[def.name, def]]);
  const lib = await clawdRegistry(projectDir, [], { strict: false });
  const registry = new Map([...lib, ...extra]);
  const isBg = def.kind === 'background';
  const shot = {
    id: 'PREVIEW', chapter: '预览', dur: SWEEP_DUR, sub: '预览', read: def.description.slice(0, 40),
    background: { use: isBg ? def.name : background, ...(isBg ? { params } : {}) },
    actors: isBg ? [] : [{ id: 'c', use: def.name, x: at?.[0] ?? (def.kind === 'foreground' ? 1500 : 820), y: at?.[1] ?? (def.kind === 'foreground' ? 1080 : 860), params }],
    presenter: presenter === null ? null : isBg ? { x: presenter?.[0] ?? 1750, y: presenter?.[1] ?? 880, emotion: 'calm' } : { x: presenter?.[0] ?? 1380, y: presenter?.[1] ?? 870, emotion: [[0, 'calm'], [1.5, 'surprised']] },
  };
  const errs = validateFreeStoryboard({ title: 'preview', style: 'clawd' }, [shot], registry, CLAWD_INFO);
  if (errs.length) throw new Error(`in-context preview invalid:\n  ${errs.join('\n  ')}`);
  const canvas = createCanvas(W, H);
  const film = new FreeFilm({ title: 'preview', style: 'clawd' }, [shot], registry, new ClawdAdapter(canvas.getContext('2d')));
  const times = [0.3, 0.9, 1.5, 2.1, 2.7, 3.3];
  const show = (t) => Object.entries(resolveParams(def, params, t, SWEEP_DUR)).map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`).join(' ');
  return contactSheet(film, canvas, times, { cols, cellW, caption: (t) => `${def.name} @ ${t.toFixed(1)}s  ${show(t)}`.slice(0, 90) });
}

export { previewCard, save };

// child-process entry for exportFramesParallel
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) && process.argv[2] === 'frames') {
  await exportFrames({ ...JSON.parse(process.argv[3]), log: true });
}
