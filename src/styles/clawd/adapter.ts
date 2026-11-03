// adapter.ts — clawd StyleAdapter: watercolour paper world, continuous camera, Bean presenter, ink transitions.
import type { StyleAdapter, StyleInfo } from '../../core/adapter.ts';
import type { Bounds, PresenterTint, ResolvedCam, ResolvedInstance, ResolvedLabel, ResolvedPresenter } from '../../core/types.ts';
import { PAL, boilSeed, clamp, ease, easeOut, jump, lerp, setBoil, take, turn, wob, bp } from './core.ts';
import { ellPts, grain, inkLine, paperCanvas, wcolor, type Ctx } from './paint.ts';
import { CHARS, charById, critter, type Hat, type Opts } from './critters.ts';
import { EMOTIONS, acting, combine } from './emotions.ts';
import { brushEdges, brushMask, dripPath, irisPath, withClip } from './transitions.ts';
import { createClawdAnchorApi, createClawdApi, type ClawdApi } from './api.ts';

export const CLAWD_W = 1920;
export const CLAWD_H = 1080;
export const SUB_TOP = 948;
export const SUB_FONT = '"Kaiti SC","STKaiti","KaiTi","LXGW WenKai","PingFang SC","Noto Sans SC",sans-serif';
export const HATS: readonly Hat[] = ['none', 'party', 'crown', 'halo', 'wizard', 'top', 'beanie', 'bow', 'flower', 'headphones', 'band', 'hard', 'leaf'];

export const CLAWD_INFO: StyleInfo = {
  name: 'clawd',
  world: { w: CLAWD_W, h: CLAWD_H },
  subtitleTop: SUB_TOP,
  camera: { zoom: 'continuous', min: 1, max: 1.6 },
  transitions: ['brush', 'iris', 'drip'],
  presenter: {
    chars: CHARS.map((c) => c.id),
    defaultChar: 'bean',
    emotions: EMOTIONS.map((e) => e.id),
    hats: HATS,
    defaultY: 830,
    defaultU: 30,
    size: [380, 280],
  },
};

const LABEL_TINTS: Readonly<Record<string, string>> = { ink: PAL.ink, red: PAL.clayDk, blue: PAL.indigo, green: '#4F7B3B', gold: '#B07A1A', violet: PAL.violet };

/** Same lighting tints as the critter component's tint param */
const PRESENTER_TINT: Readonly<Record<PresenterTint, Partial<Opts>>> = {
  none: {},
  night: { tint: '#5B6AA8', tintK: 0.55 },
  warm: { tint: '#F2A060', tintK: 0.3 },
};

/** Action layer on top of the emotion's own acting */
function actionOpts(p: ResolvedPresenter, lt: number): Partial<Opts> {
  const a = p.actionAt;
  switch (p.action) {
    case 'walk': {
      const d = p.walked / (4 * p.u);
      return { walk: d, dy: -Math.abs(Math.sin(d * Math.PI)) * 0.5 };
    }
    case 'jump': return jump(lt, a + 0.12, a + 0.62, 3);
    case 'take': return take(lt, a + 0.05, 1);
    case 'turn': return turn(lt, a, a + 0.6, 0, 1);
    case 'dance': {
      const k = Math.sin(bp(lt) * Math.PI);
      return { dy: -Math.abs(k) * 0.8, rot: wob(lt, 0.5) * 0.08, aL: 1 + k * 0.4, aR: 1 - k * 0.4 };
    }
    case 'smear': return { smear: 0.5 };
    default: return {};
  }
}

export class ClawdAdapter implements StyleAdapter<ClawdApi> {
  readonly info = CLAWD_INFO;
  readonly anchorApi: ClawdApi = createClawdAnchorApi('scene');
  readonly screen = { w: CLAWD_W, h: CLAWD_H, viewH: CLAWD_H, subtitleTop: SUB_TOP };
  private readonly ctx: Ctx;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  beginFrame(t: number): void {
    setBoil(t);
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  blank(): void {
    this.ctx.fillStyle = PAL.paper;
    this.ctx.fillRect(0, 0, CLAWD_W, CLAWD_H);
  }

  pushCamera(cam: ResolvedCam): void {
    const c = this.ctx;
    c.save();
    this.blank();
    c.translate(CLAWD_W / 2, CLAWD_H / 2);
    c.scale(cam.z, cam.z);
    c.translate(-cam.cx, -cam.cy);
  }

  popCamera(): void {
    this.ctx.restore();
  }

  drawComponent(inst: ResolvedInstance<ClawdApi>, t: number, lt: number): void {
    const c = this.ctx;
    const key = `${inst.def.name}#${inst.id}`;
    c.save();
    if (inst.def.kind !== 'background') {
      c.translate(inst.x, inst.y);
      c.scale(inst.flip ? -inst.scale : inst.scale, inst.scale);
    }
    boilSeed(key);
    inst.def.draw(createClawdApi(c, key, inst.ages, lt, t), inst.params, t, lt);
    c.restore();
  }

  drawPresenter(p: ResolvedPresenter, t: number, lt: number): Bounds {
    const keys = p.emotions.map(([at, e]) => [at, e] as [number, string]);
    const act = actionOpts(p, lt);
    const o = combine(acting(lt, keys), act, {
      view: act.view ?? p.view,
      flip: act.flip ?? p.flip,
      hat: p.hat === 'none' ? undefined : (p.hat as Hat),
      key: 'presenter',
      ...PRESENTER_TINT[p.tint],
    });
    critter(this.ctx, charById(p.char), p.x, p.y, p.u, o, t);
    const k = p.u / this.info.presenter.defaultU;
    const [w, h] = this.info.presenter.size;
    return { x: p.x - (w * k) / 2, y: p.y - h * k, w: w * k, h: h * k };
  }

  drawLabel(l: ResolvedLabel): Bounds {
    const c = this.ctx;
    const pop = easeOut(clamp(l.age / 0.3));
    const size = 40;
    c.save();
    c.font = `700 ${size}px ${SUB_FONT}`;
    const tw = c.measureText(l.text).width;
    const w = tw + 48;
    const h = size + 26;
    const x = l.x - w / 2;
    const y = l.y - h - 24;
    // pop by scale around the pointer tip: the brushes set globalAlpha themselves, so alpha cannot fade them
    if (pop < 0.02) { c.restore(); return { x, y, w, h: l.y - y }; }
    c.translate(l.x, l.y);
    c.scale(pop, pop);
    c.translate(-l.x, -l.y);
    boilSeed(`label:${l.text}`);
    wcolor(c, ellPts(l.x, y + h / 2, w / 2 + 6, h / 2 + 4, 20), PAL.cream, 0.95, 3, 6, true);
    inkLine(c, [[l.x, y + h + 2], [l.x + 4, l.y - 6]], 3.2, PAL.ink, false, 0.8);
    c.globalAlpha = clamp(l.age / 0.15);
    c.fillStyle = LABEL_TINTS[l.tint] ?? PAL.ink;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(l.text, l.x, y + h / 2 + 2);
    c.restore();
    return { x, y, w, h: l.y - y };
  }

  transition(kind: string, k: number, focus: readonly [number, number], out: (() => void) | null, inn: (() => void) | null): void {
    const c = this.ctx;
    const drawOut = (): void => (out ? out() : this.blank());
    const drawIn = (): void => (inn ? inn() : this.blank());
    const [fx, fy] = focus;
    if (kind === 'iris' && inn === null) {
      // outro: ink circle closes on the focus, leaving paper
      const r = lerp(1500, 0, ease(k));
      drawOut();
      c.save();
      // irisPath begins a new path, so the frame rect is added after it (even-odd = outside the circle)
      irisPath(c, fx, fy, r, 'out');
      c.rect(0, 0, CLAWD_W, CLAWD_H);
      c.clip('evenodd');
      this.blank();
      c.restore();
      if (r > 1) { boilSeed('outring'); inkLine(c, ellPts(fx, fy, r, r, 40, 5), 5, PAL.ink, true, 0.7); }
      return;
    }
    drawOut();
    if (kind === 'brush') {
      withClip(c, () => brushMask(c, k, 'cut', out ? 1 : -1), drawIn);
      brushEdges(c, k, 'cut', '#CDBFA8');
    } else if (kind === 'iris') {
      const r = easeOut(k) * 1300;
      withClip(c, () => irisPath(c, fx, fy, r, 'cut'), drawIn);
      boilSeed('irisring');
      inkLine(c, ellPts(fx, fy, r, r, 40, 6), 5, PAL.ink, true, 0.6 * (1 - k));
    } else if (kind === 'drip') {
      withClip(c, () => dripPath(c, ease(k)), drawIn);
    } else if (k >= 0.5) {
      drawIn();
    }
  }

  drawSubtitleBand(text: string, reveal: number, chapter: string, shotId: string): void {
    const c = this.ctx;
    c.save();
    boilSeed('subband');
    wcolor(c, [[-40, SUB_TOP + 14], [CLAWD_W + 40, SUB_TOP + 4], [CLAWD_W + 40, CLAWD_H + 40], [-40, CLAWD_H + 40]], PAL.cream, 0.92, 3, 8, false);
    inkLine(c, [[30, SUB_TOP + 12], [CLAWD_W * 0.5, SUB_TOP + 6], [CLAWD_W - 30, SUB_TOP + 10]], 3, PAL.ink, false, 0.55);
    const tag = chapter.split(/\s+/)[0].slice(0, 6);
    c.font = `700 26px ${SUB_FONT}`;
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = PAL.clayDk;
    c.fillText(tag, 40, SUB_TOP + 50);
    c.globalAlpha = 0.5;
    c.fillStyle = PAL.ink;
    c.fillText(shotId, 40, SUB_TOP + 88);
    c.globalAlpha = 1;
    const chars = Array.from(text);
    c.font = `700 54px ${SUB_FONT}`;
    c.textAlign = 'center';
    // lay out with the full string so the line does not drift while typing
    const full = c.measureText(text).width;
    c.textAlign = 'left';
    c.fillStyle = PAL.ink;
    c.fillText(chars.slice(0, reveal).join(''), CLAWD_W / 2 - full / 2 + 40, SUB_TOP + 68);
    c.restore();
  }

  endFrame(): void {
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.globalAlpha = 0.55;
    c.drawImage(paperCanvas(CLAWD_W, CLAWD_H), 0, 0);
    c.restore();
    grain(c, CLAWD_W, CLAWD_H, 0.3);
  }
}
