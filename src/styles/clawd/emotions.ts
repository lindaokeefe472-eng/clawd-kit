// emotions.ts — every mood has a face AND an idle motion; acting() changes moods with a blink + take, never a snap.
import { bp, frac, wob, take, seg, backOut, pulse, clamp } from './core.ts';
import type { Opts } from './critters.ts';

export interface Emotion { id: string; cn: string; en: string; f: (t: number) => Opts }

const bounce = (t: number, h = 0.6) => -Math.abs(Math.sin(bp(t) * Math.PI)) * h;

export const EMOTIONS: Emotion[] = [
  { id: 'happy', cn: '开心', en: 'HAPPY', f: t => ({ eyes: 'happy', mouth: 'smile', dy: bounce(t, 0.5), aL: 0.4 + wob(t, 0.8) * 0.3, aR: 0.4 - wob(t, 0.8) * 0.3, blush: 0.4 }) },
  { id: 'joy', cn: '雀跃', en: 'JOY', f: t => { const k = frac(bp(t) / 2); return { eyes: 'happy', mouth: 'grin', dy: -Math.sin(k * Math.PI) * 2.2, sq: k < 0.08 ? 0.12 : -0.1 * Math.sin(k * Math.PI), aL: 1.3, aR: 1.3, emote: 'sparkle', blush: 0.5 }; } },
  { id: 'love', cn: '心动', en: 'LOVE', f: t => ({ eyes: 'heart', mouth: 'smile', blush: 1, emote: 'hearts', rot: wob(t, 0.5) * 0.06, aL: -0.4, aR: -0.4, tint: 'rosy', tintK: 0.25 }) },
  { id: 'shy', cn: '害羞', en: 'SHY', f: t => ({ eyes: 'happy', mouth: 'wavy', blush: 1.2, tint: 'rosy', tintK: 0.35, rot: wob(t, 0.4) * 0.05, dx: wob(t, 0.4) * 0.2, aL: -0.9, aR: -0.9, earDroop: 0.25, lookX: -0.6 }) },
  { id: 'sad', cn: '难过', en: 'SAD', f: t => ({ eyes: 'sad', mouth: 'frown', tint: 'blue', tintK: 0.35, dy: 0.15 + wob(t, 0.3) * 0.08, sq: 0.06, aL: -0.9, aR: -0.9, earDroop: 0.8, lookY: 0.6 }) },
  { id: 'cry', cn: '大哭', en: 'CRY', f: t => ({ eyes: 'cry', mouth: 'wail', tint: 'blue', tintK: 0.3, sq: Math.sin(t * 16) * 0.03, aL: 0.9 + wob(t, 3) * 0.2, aR: 0.9 - wob(t, 3) * 0.2, earDroop: 0.6 }) },
  { id: 'angry', cn: '生气', en: 'ANGRY', f: t => ({ eyes: 'angry', mouth: 'teeth', tint: 'flush', tintK: 0.5 + 0.2 * pulse(t), shake: 0.05, emote: 'steam', sq: 0.08, aL: -0.2 + Math.sin(t * 20) * 0.15, aR: -0.2 - Math.sin(t * 20) * 0.15 }) },
  // one take, then hold (a looping re-pop made the "!" blink every 2.4 s)
  { id: 'surprised', cn: '惊讶', en: 'SURPRISED', f: t => { const tk = take(t, 0.2, 1); return { eyes: 'wide', mouth: 'o', emote: '!', emoteK: seg(t, 0.2, 0.45), dy: tk.dy, sq: tk.sq, aL: 1.0, aR: 1.0 }; } },
  { id: 'scared', cn: '害怕', en: 'SCARED', f: t => ({ eyes: 'tiny', mouth: 'wavy', tint: 'pale', tintK: 0.6, shake: 0.06, sq: 0.1, emote: 'sweat', aL: 0.9, aR: 0.9, earDroop: 0.9, lookX: Math.sin(t * 2) }) },
  { id: 'confused', cn: '疑惑', en: 'CONFUSED', f: t => ({ eyes: ['slit', 'squint'], mouth: 'flat', emote: '?', rot: 0.12 + wob(t, 0.3) * 0.03, lookX: 0.5, lookY: -0.5, aL: 0.2, aR: 1.1 + wob(t, 1) * 0.15 }) },
  { id: 'sleepy', cn: '犯困', en: 'SLEEPY', f: t => ({ eyes: 'closed', mouth: 'o', emote: 'zzz', noBlink: true, sq: 0.04 + wob(t, 0.25) * 0.04, rot: 0.05 + wob(t, 0.12) * 0.04, aL: -0.7, aR: -0.7, earDroop: 0.5 }) },
  { id: 'dizzy', cn: '晕乎', en: 'DIZZY', f: t => ({ eyes: 'spiral', mouth: 'wavy', emote: 'stars', rot: wob(t, 0.8) * 0.14, dx: wob(t, 0.8, 0.25) * 0.4, aL: wob(t, 0.8) * 0.6, aR: -wob(t, 0.8) * 0.6 }) },
  { id: 'proud', cn: '得意', en: 'PROUD', f: t => ({ eyes: 'happy', mouth: 'smirk', emote: 'sparkle', sq: -0.08 + pulse(t) * 0.03, aL: -1.0, aR: -1.0, rot: -0.04, lookX: 0.3 }) },
  // one take, then hold (a looping re-pop made the bulb vanish and reappear every 3 s)
  { id: 'idea', cn: '灵光', en: 'IDEA', f: t => { const tk = take(t, 0.3, 0.7); return { eyes: 'sparkle', mouth: 'grin', emote: 'bulb', emoteK: seg(t, 0.3, 0.6), dy: tk.dy, sq: tk.sq, aL: 0.2, aR: 1.5 }; } },
  { id: 'nervous', cn: '紧张', en: 'NERVOUS', f: t => ({ eyes: 'slit', mouth: 'wavy', emote: 'sweat', lookX: Math.sign(Math.sin(t * 1.8)) * 0.9, sq: 0.04, aL: -0.6 + Math.sin(t * 9) * 0.1, aR: -0.6 - Math.sin(t * 9) * 0.1 }) },
  { id: 'bored', cn: '无聊', en: 'BORED', f: t => ({ eyes: 'half', mouth: 'flat', lookX: 0.6 * wob(t, 0.15), lookY: -0.5, sq: 0.08, dy: 0.1, aL: -0.9, aR: -0.9 + Math.max(0, wob(t, 0.5)) * 0.6, earDroop: 0.4, noBlink: true }) },
  { id: 'gloomy', cn: '沮丧', en: 'GLOOMY', f: t => ({ eyes: 'sad', mouth: 'flat', gloom: 1, emote: 'rain', tint: 'blue', tintK: 0.45, sq: 0.1, dy: 0.15 + wob(t, 0.25) * 0.05, aL: -1, aR: -1, earDroop: 1, lookY: 0.8 }) },
  { id: 'excited', cn: '激动', en: 'EXCITED', f: t => ({ eyes: 'star', mouth: 'grin', dy: -Math.abs(Math.sin(bp(t) * Math.PI * 2)) * 0.9, aL: 1.2 + Math.sin(t * 18) * 0.35, aR: 1.2 - Math.sin(t * 18) * 0.35, emote: 'sparkle', blush: 0.6 }) },
  { id: 'smug', cn: '坏笑', en: 'SMUG', f: t => ({ eyes: 'smug', mouth: 'smirk', lookX: 0.8, rot: -0.03 + wob(t, 0.3) * 0.02, aL: -0.8, aR: -0.8 }) },
  { id: 'hungry', cn: '嘴馋', en: 'HUNGRY', f: t => ({ eyes: 'wide', mouth: 'drool', lookX: 0.6, lookY: -0.8, sq: wob(t, 1.2) * 0.03, aL: 0.3, aR: 0.3, emote: 'sweat', emoteK: 0 }) },
  { id: 'wink', cn: '眨眼', en: 'WINK', f: t => ({ eyes: ['happy', 'slit'], mouth: 'tongue', emote: 'sparkle', aL: 0.2, aR: 1.4 + wob(t, 1) * 0.15, rot: -0.06, dy: bounce(t, 0.25), noBlink: true }) },
  { id: 'cool', cn: '酷', en: 'COOL', f: t => ({ eyes: 'shades', mouth: 'smirk', emote: 'sparkle', dy: bounce(t, 0.25), aL: -0.6, aR: 1.0 + pulse(t) * 0.2, rot: wob(t, 0.5) * 0.03 }) },
  { id: 'music', cn: '哼歌', en: 'HUMMING', f: t => ({ eyes: 'happy', mouth: 'o', emote: 'note', rot: Math.sin(bp(t) * Math.PI) * 0.08, dy: bounce(t, 0.3), aL: 0.5 + Math.sin(bp(t) * Math.PI) * 0.4, aR: 0.5 - Math.sin(bp(t) * Math.PI) * 0.4 }) },
  { id: 'calm', cn: '平静', en: 'CALM', f: t => ({ eyes: 'slit', mouth: 'smile', sq: wob(t, 0.3) * 0.025, aL: 0.15 + wob(t, 0.3) * 0.05, aR: 0.15 + wob(t, 0.3) * 0.05, lookX: wob(t, 0.1) * 0.4 }) },
];
const EMAP = Object.fromEntries(EMOTIONS.map(e => [e.id, e]));

export function feel(name: string, t: number): Opts {
  const e = EMAP[name] || EMAP.calm;
  return { emoteAge: t, ...e.f(t) };
}

// Merge option sets: dy, dx, sq, rot add up; everything else is overridden left-to-right.
const ADDITIVE: ReadonlySet<string> = new Set(['dy', 'dx', 'sq', 'rot']);

export function combine(...os: (Opts | Partial<Opts> | undefined)[]): Opts {
  const out: Record<string, unknown> = {};
  for (const o of os) {
    if (!o) continue;
    for (const [k, v] of Object.entries(o)) {
      if (v === undefined) continue;
      const prev = out[k];
      out[k] = ADDITIVE.has(k) && typeof v === 'number' ? (typeof prev === 'number' ? prev : 0) + v : v;
    }
  }
  return out as Opts;
}

// acting(t, [[0,'calm'],[2.4,'surprised'],...]) — mood changes get a blink, a take, and the new emote pops in.
export function acting(t: number, keys: [number, string][], amt = 0.6): Opts {
  let i = 0;
  for (let j = 0; j < keys.length; j++) if (t >= keys[j][0]) i = j;
  const [t0, name] = keys[i];
  const base = feel(name, t - t0);
  if (i === 0 && t0 <= 0) return { ...base, emoteK: base.emoteK ?? 1 };
  const dt = t - t0;
  const tk = take(t, t0, amt);
  const o = combine(base, { dy: tk.dy, sq: tk.sq });
  if (dt < 0.08 && dt >= 0) o.eyes = 'closed';
  o.emoteK = clamp(backOut(seg(dt, 0.05, 0.35))) * (base.emoteK ?? 1);
  o.emoteAge = dt;
  return o;
}
