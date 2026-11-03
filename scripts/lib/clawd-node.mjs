// Node-side clawd helpers shared by gates, previews and check: napi canvas, single-component renders.
import { createCanvas } from '@napi-rs/canvas';
import { setCanvasFactory } from '../../src/styles/clawd/paint.ts';
import { boilSeed, setBoil, PAL } from '../../src/styles/clawd/core.ts';
import { createClawdAnchorApi, createClawdApi } from '../../src/styles/clawd/api.ts';

let ready = false;
export function setupClawdCanvas() {
  if (!ready) setCanvasFactory((w, h) => createCanvas(w, h));
  ready = true;
}

/** Draw one component alone on a transparent canvas of its own size (anchor bottom-centre; backgrounds 1:1) */
export function renderComponentCanvas(def, params, t, lt, { pad = 0, paper = false } = {}) {
  setupClawdCanvas();
  const [w, h] = def.size;
  const c = createCanvas(w + pad * 2, h + pad * 2);
  const ctx = c.getContext('2d');
  if (paper) { ctx.fillStyle = PAL.paper; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.translate(pad, pad);
  if (def.kind !== 'background') ctx.translate(w / 2, h);
  setBoil(t);
  const key = `${def.name}#gate`;
  boilSeed(key);
  def.draw(createClawdApi(ctx, key, {}, lt, t), params, t, lt);
  return c;
}

/** RenderBytes for core/gates.ts */
export function clawdRenderBytes(def, params, t, lt) {
  const c = renderComponentCanvas(def, params, t, lt);
  return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
}

/** Drawing-free api for the gate's anchors() / surface() checks */
export const clawdAnchorApi = createClawdAnchorApi('gate');
