// The machine-readable component index (components/clawd/index.json), built from the loaded registry.
// The component files are the source of truth; this and INDEX.md are generated views and are not tracked.

const KIND_ORDER = ['background', 'actor', 'prop', 'foreground'];

function paramOf(name, p) {
  const out = { name, type: p.type };
  if (p.type === 'enum') out.options = [...p.options];
  if (p.min !== undefined) out.min = p.min;
  if (p.max !== undefined) out.max = p.max;
  out.default = p.default;
  out.description = p.description ?? '';
  return out;
}

/** @param {Iterable<object>} defs loaded component definitions @returns the index, stable for any input order */
export function libraryIndexJson(defs) {
  const components = [...defs]
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name))
    .map((d) => ({
      name: d.name,
      kind: d.kind,
      size: [...d.size],
      tags: [...(d.tags ?? [])],
      description: d.description ?? '',
      params: Object.entries(d.params ?? {}).map(([k, p]) => paramOf(k, p)),
      anchors: [...(d.anchorNames ?? [])],
      surface: typeof d.surface === 'function',
    }));
  return { version: 1, count: components.length, components };
}
