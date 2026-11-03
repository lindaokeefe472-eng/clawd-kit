// Promote a clawd component from a project into a template's library: full gate first, then COPY
// (the project keeps its file), rewrite `import type` paths for the new location, refresh preview + INDEX.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { validateComponentSource } from '../../src/core/security.ts';
import { isComponentDef } from '../../src/core/registry.ts';
import { gateComponent } from '../../src/core/gates.ts';
import { loadRegistry } from '../../src/core/registry-node.ts';
import { CLAWD_INFO } from '../../src/styles/clawd/adapter.ts';
import { clawdAnchorApi, clawdRenderBytes, setupClawdCanvas } from './clawd-node.mjs';
import { refreshLibrary } from '../preview-clawd.mjs';

/**
 * Re-point relative import specifiers for a file moving from `fromFile` to `toFile`.
 * Engine imports (…/src/core|styles|engine/…) always target `templateDir`'s own engine, whatever copy the
 * source project pointed at; other relative imports keep pointing at the same file.
 */
export function rewriteImports(source, fromFile, toFile, templateDir) {
  const sf = ts.createSourceFile(fromFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const edits = [];
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const spec = st.moduleSpecifier.text;
    if (!spec.startsWith('.')) continue;
    const resolved = path.resolve(path.dirname(fromFile), spec).split(path.sep).join('/');
    const engine = /(?:^|\/)src\/((?:core|styles|engine)\/.+)$/.exec(resolved);
    const abs = engine && templateDir ? path.join(templateDir, 'src', engine[1]) : resolved;
    let rel = path.relative(path.dirname(toFile), abs).split(path.sep).join('/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    edits.push({ start: st.moduleSpecifier.getStart(sf) + 1, end: st.moduleSpecifier.getEnd() - 1, text: rel });
  }
  let out = source;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

export async function promoteClawd(projectDir, componentName, { templateDir, force = false } = {}) {
  const fileName = componentName.endsWith('.ts') ? componentName : `${componentName}.ts`;
  const src = path.join(projectDir, 'components', fileName);
  if (!fs.existsSync(src)) throw new Error(`component file not found: ${src}`);
  const source = fs.readFileSync(src, 'utf8');

  // 1. static scan before anything is imported
  validateComponentSource(source, fileName, { style: 'clawd' });
  // 2. load + full gate (contract, determinism, draws something)
  setupClawdCanvas();
  const mod = await import(`${pathToFileURL(src).href}?promote=${Date.now()}`);
  const def = Object.values(mod).find(isComponentDef);
  const gate = gateComponent(source, fileName, def, 'clawd', CLAWD_INFO.world, clawdRenderBytes, clawdAnchorApi);
  if (!gate.ok) throw new Error(`gate failed:\n  ${gate.errors.join('\n  ')}`);

  // 3. name / file collisions in the library
  const libDir = path.join(templateDir, 'components', 'clawd');
  fs.mkdirSync(libDir, { recursive: true });
  const dest = path.join(libDir, fileName);
  const { registry } = await loadRegistry('clawd', CLAWD_INFO.world, [{ dir: libDir, origin: 'library' }]);
  if (!force && (fs.existsSync(dest) || registry.has(def.name))) {
    throw new Error(`"${def.name}" is already in the library (${dest}); pass --force to replace it`);
  }

  // 4. copy with re-pointed type imports, 5. preview card + INDEX
  const previous = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
  fs.writeFileSync(dest, rewriteImports(source, src, dest, templateDir));
  const refreshed = await refreshLibrary(libDir, [def.name]);
  if (refreshed.errors.length) {
    // roll back so the library never keeps a file that breaks loading
    if (previous === null) fs.rmSync(dest);
    else fs.writeFileSync(dest, previous);
    await refreshLibrary(libDir, []);
    throw new Error(`library failed to load after promote (rolled back):\n  ${refreshed.errors.join('\n  ')}`);
  }
  return { source: src, destination: dest, metadata: { name: def.name, kind: def.kind, style: 'clawd' }, totalComponents: refreshed.count };
}
