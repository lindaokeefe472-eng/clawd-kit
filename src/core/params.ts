// Param contract: defaults, Track/Step evaluation at lt, and validation against ComponentParamDef.
import { evalStep, evalTrack, stepAge } from '../engine/track.ts';
import type { ComponentDef, ComponentParamDef, ParamValue } from './types.ts';

function isKeyList(v: unknown): v is ReadonlyArray<readonly [number, unknown]> {
  return Array.isArray(v) && v.length > 0 && v.every((k) => Array.isArray(k) && k.length === 2 && typeof k[0] === 'number');
}
function isPair(v: unknown): v is readonly [number, number] {
  return Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number';
}

/** Evaluate one storyboard param value at lt (numbers ease as Tracks, others switch as Steps) */
function evalParam(def: ComponentParamDef, v: ParamValue, lt: number, dur: number): unknown {
  if (def.type === 'number') {
    if (typeof v === 'number') return v;
    if (isPair(v) || isKeyList(v)) return evalTrack(v as readonly [number, number], lt, dur, Number(def.default));
    return def.default;
  }
  if (isKeyList(v)) return evalStep(v, lt, def.default);
  return v;
}

export function resolveParams<Api>(def: ComponentDef<Api>, raw: Readonly<Record<string, ParamValue>> | undefined, lt: number, dur: number): Readonly<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(def.params ?? {})) {
    const v = raw?.[k];
    out[k] = v === undefined ? p.default : evalParam(p, v, lt, dur);
  }
  return out;
}

/** Seconds since each keyed param last changed (constant params: lt), so components can animate the change */
export function paramAges<Api>(def: ComponentDef<Api>, raw: Readonly<Record<string, ParamValue>> | undefined, lt: number): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(def.params ?? {})) {
    const v = raw?.[k];
    out[k] = isKeyList(v) ? stepAge(v, lt) : lt;
  }
  return out;
}

function valueProblem(p: ComponentParamDef, v: unknown): string | null {
  switch (p.type) {
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) return `expected number, got ${JSON.stringify(v)}`;
      if (p.min !== undefined && v < p.min) return `${v} < min ${p.min}`;
      if (p.max !== undefined && v > p.max) return `${v} > max ${p.max}`;
      return null;
    case 'boolean':
      return typeof v === 'boolean' ? null : `expected boolean, got ${JSON.stringify(v)}`;
    case 'string':
      return typeof v === 'string' ? null : `expected string, got ${JSON.stringify(v)}`;
    case 'enum':
      return typeof v === 'string' && (p.options ?? []).includes(v) ? null : `expected one of ${(p.options ?? []).join('|')}, got ${JSON.stringify(v)}`;
  }
}

/** Storyboard-side check: unknown keys, wrong types, out-of-range or bad enum values (in every keyframe) */
export function paramProblems<Api>(def: ComponentDef<Api>, raw: Readonly<Record<string, ParamValue>> | undefined): string[] {
  const errs: string[] = [];
  const defs = def.params ?? {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const p = defs[k];
    if (!p) {
      errs.push(`param "${k}" not declared by "${def.name}" (has: ${Object.keys(defs).join(', ') || 'none'})`);
      continue;
    }
    const values = p.type === 'number' && isPair(v) ? [...v] : isKeyList(v) ? v.map((kv) => kv[1]) : [v];
    for (const x of values) {
      const e = valueProblem(p, x);
      if (e) {
        errs.push(`param "${k}" of "${def.name}": ${e}`);
        break;
      }
    }
  }
  return errs;
}

/** Component-side check: every declared default must satisfy its own declaration */
export function paramDefProblems<Api>(def: ComponentDef<Api>): string[] {
  const errs: string[] = [];
  for (const [k, p] of Object.entries(def.params ?? {})) {
    if (!p.description) errs.push(`${def.name}.params.${k}: description required`);
    if (p.type === 'enum' && !(p.options && p.options.length > 0)) errs.push(`${def.name}.params.${k}: enum needs options`);
    const e = valueProblem(p, p.default);
    if (e) errs.push(`${def.name}.params.${k}: default ${e}`);
  }
  return errs;
}
