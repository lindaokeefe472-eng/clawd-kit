// Component registry: library components (components/<style>/) overlaid by per-project ones (project/components/).
// Modules come from import.meta.glob in the browser or dynamic import in node (registry-node.ts).
import { paramDefProblems } from './params.ts';
import type { ComponentDef, ComponentKind, Registry, StyleName } from './types.ts';

const KINDS: readonly ComponentKind[] = ['background', 'actor', 'prop', 'foreground'];

export interface ModuleSource {
  /** File path, for error messages */
  file: string;
  /** 'library' entries may be overridden by 'project' entries of the same name */
  origin: 'library' | 'project';
  exports: Readonly<Record<string, unknown>>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Duck-typed check that an export is a component definition */
export function isComponentDef(v: unknown): v is ComponentDef<unknown> {
  return (
    isRecord(v) &&
    typeof v.name === 'string' &&
    typeof v.kind === 'string' &&
    typeof v.draw === 'function' &&
    Array.isArray(v.size)
  );
}

/** Problems with the definition itself (independent of any storyboard) */
export function defProblems<Api>(def: ComponentDef<Api>, style: StyleName, world: { w: number; h: number }): string[] {
  const errs: string[] = [];
  const n = def.name || '(unnamed)';
  if (!/^[a-z][a-z0-9_]*$/.test(def.name)) errs.push(`${n}: name must be snake_case`);
  if (def.style !== style) errs.push(`${n}: style "${def.style}" but registry is "${style}"`);
  if (!KINDS.includes(def.kind)) errs.push(`${n}: kind "${def.kind}" not in ${KINDS.join('|')}`);
  if (!def.description) errs.push(`${n}: description required`);
  if (!Array.isArray(def.tags)) errs.push(`${n}: tags must be an array`);
  const [w, h] = def.size;
  if (!(w > 0 && h > 0)) errs.push(`${n}: size must be positive`);
  if (def.kind === 'background' && (w !== world.w || h !== world.h)) errs.push(`${n}: background size must be [${world.w}, ${world.h}]`);
  errs.push(...paramDefProblems(def));
  const hasNames = def.anchorNames !== undefined;
  if (def.anchors !== undefined && typeof def.anchors !== 'function') errs.push(`${n}: anchors must be a function`);
  if (def.anchors && !hasNames) errs.push(`${n}: anchors needs anchorNames (the point names it returns)`);
  if (hasNames && !def.anchors) errs.push(`${n}: anchorNames is declared but anchors() is missing`);
  if (hasNames) {
    const names = def.anchorNames as readonly string[];
    if (!Array.isArray(names) || names.length === 0) errs.push(`${n}: anchorNames must be a non-empty array`);
    else {
      for (const a of names) if (!/^[a-z][A-Za-z0-9]*$/.test(a)) errs.push(`${n}: anchor name "${a}" must be camelCase (letters and digits)`);
      if (new Set(names).size !== names.length) errs.push(`${n}: anchorNames has duplicates`);
    }
  }
  if (def.surface !== undefined && def.kind !== 'background') errs.push(`${n}: surface is only for backgrounds (kind is ${def.kind})`);
  if (def.surface !== undefined && typeof def.surface !== 'function') errs.push(`${n}: surface must be a function`);
  return errs;
}

export interface BuiltRegistry<Api> {
  registry: Registry<Api>;
  errors: string[];
}

export function buildRegistry<Api>(style: StyleName, world: { w: number; h: number }, sources: readonly ModuleSource[]): BuiltRegistry<Api> {
  const map = new Map<string, ComponentDef<Api>>();
  const origin = new Map<string, { origin: ModuleSource['origin']; file: string }>();
  const errors: string[] = [];
  const ordered = [...sources].sort((a, b) => (a.origin === b.origin ? a.file.localeCompare(b.file) : a.origin === 'library' ? -1 : 1));
  for (const src of ordered) {
    const defs = Object.values(src.exports).filter(isComponentDef) as ComponentDef<Api>[];
    for (const def of new Set(defs)) {
      if (def.style !== style) continue; // other style's library; not an error
      const probs = defProblems(def, style, world);
      if (probs.length) {
        errors.push(...probs.map((p) => `${src.file}: ${p}`));
        continue;
      }
      const prev = origin.get(def.name);
      if (prev && prev.origin === src.origin) {
        errors.push(`${src.file}: duplicate component "${def.name}" (also in ${prev.file})`);
        continue;
      }
      map.set(def.name, def);
      origin.set(def.name, { origin: src.origin, file: src.file });
    }
  }
  return { registry: map, errors };
}
