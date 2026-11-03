// Node-side registry loader: scan every component file with the AST gate *before* importing it.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRegistry } from './registry.ts';
import type { BuiltRegistry, ModuleSource } from './registry.ts';
import { validateComponentSource } from './security.ts';
import type { StyleName } from './types.ts';

export interface ComponentDir {
  dir: string;
  origin: ModuleSource['origin'];
}

function tsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return tsFiles(full);
    return e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.d.ts') ? [full] : [];
  });
}

export async function loadRegistry<Api>(style: StyleName, world: { w: number; h: number }, dirs: readonly ComponentDir[]): Promise<BuiltRegistry<Api>> {
  const sources: ModuleSource[] = [];
  const errors: string[] = [];
  for (const { dir, origin } of dirs) {
    for (const file of tsFiles(dir)) {
      try {
        validateComponentSource(fs.readFileSync(file, 'utf8'), path.basename(file), { style });
        const mod: Record<string, unknown> = await import(pathToFileURL(file).href);
        sources.push({ file, origin, exports: mod });
      } catch (e) {
        errors.push(`${file}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  const built = buildRegistry<Api>(style, world, sources);
  return { registry: built.registry, errors: [...errors, ...built.errors] };
}
