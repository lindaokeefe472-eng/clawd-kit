// core.ts — palette, seeded "boil" randomness, timing + motion helpers (pure functions of t)
export const PAL = {
  paper: '#F3EBDC', ink: '#2B2233', clay: '#D97757', clayDk: '#A84D33', clayLt: '#F2A283',
  night: '#1F2550', indigo: '#2F3C7A', rose: '#E27A92', ochre: '#E8AA38', sap: '#6E9F58',
  teal: '#3A9C98', violet: '#7B5CA8', cream: '#FFF5E2', sky: '#8EC3E6', orange: '#E8913A',
  mouth: '#7A2E3A', tongue: '#EF8EA8',
};

export const TAU = Math.PI * 2;
export const BPM = 100;
export const BEAT = 60 / BPM;
export const BOIL = 12;

export const S = { boil: 0 };
let seed = 1;
export function randomSeed(n: number) { seed = (n >>> 0) || 1; }
export function random() {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const boilSeed = (key: string) => {
  let h = 2166136261;
  const s = key + '|' + S.boil;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  randomSeed(h >>> 0);
};
export const setBoil = (t: number) => { S.boil = Math.floor(t * BOIL); };
export const jit = (a: number) => (random() * 2 - 1) * a;

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
export const ease = (x: number) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
export const easeIn = (x: number) => Math.pow(clamp(x), 3);
export const backOut = (x: number) => { x = clamp(x); const s = 1.9; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
export const hash = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const frac = (x: number) => x - Math.floor(x);
export const bp = (t: number) => t / BEAT;
export const pulse = (t: number, k = 6) => Math.exp(-frac(bp(t)) * k);
export const wob = (t: number, f = 1, ph = 0) => Math.sin((t * f + ph) * TAU);
export const spring = (t: number, t0: number, k = 6, w = 18) => (t < t0 ? 0 : Math.exp(-k * (t - t0)) * Math.sin(w * (t - t0)));

export function kf(t: number, keys: [number, number][], e = ease) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i];
      return lerp(va, vb, e((t - a) / (b - a)));
    }
  }
  return keys[keys.length - 1][1];
}
export function kf2(t: number, keys: [number, number, number][], e = ease): [number, number] {
  return [kf(t, keys.map(k => [k[0], k[1]]), e), kf(t, keys.map(k => [k[0], k[2]]), e)];
}

export function mixCol(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (i: number) => Math.round(lerp((pa >> i) & 255, (pb >> i) & 255, clamp(k)));
  return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
}
export function rgba(hex: string, a: number) {
  const p = parseInt(hex.slice(1), 16);
  return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${clamp(a)})`;
}

// ---------- acting helpers ----------
export type Pose = { dy: number; sq: number };
export function jump(t: number, t0: number, t1: number, h = 3): Pose {
  if (t < t0 - 0.12) return { dy: 0, sq: 0 };
  if (t < t0) return { dy: 0, sq: 0.18 * ease(seg(t, t0 - 0.12, t0)) };
  if (t < t1) { const k = (t - t0) / (t1 - t0); return { dy: -h * 4 * k * (1 - k), sq: -0.16 * Math.abs(1 - 2 * k) }; }
  const a = t - t1;
  return { dy: 0, sq: 0.22 * Math.exp(-8 * a) * Math.cos(20 * a) };
}
export function take(t: number, t0: number, amt = 1): Pose {
  if (t < t0 - 0.1) return { sq: 0, dy: 0 };
  if (t < t0) return { sq: 0.12 * amt * ease(seg(t, t0 - 0.1, t0)), dy: 0 };
  const a = t - t0;
  return { sq: -0.26 * amt * Math.exp(-6 * a) * Math.cos(16 * a), dy: -1.2 * amt * Math.exp(-7 * a) * Math.max(0, Math.cos(9 * a)) };
}
export function stroll(t: number, t0: number, t1: number, x0: number, x1: number, u: number) {
  const x = lerp(x0, x1, ease(seg(t, t0, t1)));
  const d = Math.abs(x - x0) / (4 * u), moving = t > t0 && t < t1;
  return { x, walk: moving ? d : undefined, view: (moving ? 'q' : 'front') as View, flip: x1 < x0, dy: moving ? -Math.abs(Math.sin(d * Math.PI)) * 0.5 : 0 };
}
export type View = 'front' | 'q' | 'side' | 'qback' | 'back';
export function spinView(a: number): { view: View; flip: boolean } {
  const K: [View, number][] = [['front', 0], ['q', 0], ['side', 0], ['qback', 0], ['back', 0], ['qback', 1], ['side', 1], ['q', 1]];
  const [view, f] = K[((Math.round(a * 8) % 8) + 8) % 8];
  return { view, flip: !!f };
}
export function turn(t: number, t0: number, t1: number, a0: number, a1: number) {
  const k = ease(seg(t, t0, t1)), v = spinView(lerp(a0, a1, k));
  return { ...v, smear: t > t0 && t < t1 ? 0.55 * Math.sin(k * Math.PI) : 0 };
}
export const shakeXY = (t: number, amt: number): [number, number] => {
  const f = Math.floor(t * 24);
  return [(hash(f * 1.7) - 0.5) * 2 * amt, (hash(f * 2.3 + 9) - 0.5) * 2 * amt];
};
