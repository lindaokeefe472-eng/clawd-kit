// Deterministic checks that catch "looks fine in JSON, invisible on screen" mistakes (blocking errors)
import { WORLD_H, WORLD_W } from './palette.ts';
import { resolveCamera, resolveScene } from './scene.ts';
import type { ProjectDef, ShotDef } from './storyboard.ts';
import { INTERIOR_BELT_Y, MACHINE_X } from './interior.ts';
import { ROUTE_MARGIN } from './route.ts';

const SAMPLES = [0.35, 0.5, 0.65];

/** A shot with a flow must show at least one belt item inside the camera window at some point mid-shot */
export function flowVisibilityProblems(p: ProjectDef, shots: readonly ShotDef[]): string[] {
  const out: string[] = [];
  for (const shot of shots) {
    if (!shot.flow || shot.flow.length === 0 || shot.set === 'split' || shot.set === 'board') continue;
    let seen = false;
    for (const k of SAMPLES) {
      const lt = shot.dur * k;
      const scene = resolveScene(p, shot, lt);
      if (scene.belt <= 0.05) continue;
      const cam = resolveCamera(shot.cam, lt, shot.dur, scene);
      const w = WORLD_W / cam.zoom;
      const h = WORLD_H / cam.zoom;
      if (scene.items.some((it) => it.x >= cam.x - 4 && it.x <= cam.x + w + 4 && it.y - 10 >= cam.y && it.y - 10 <= cam.y + h)) {
        seen = true;
        break;
      }
    }
    if (seen) continue;
    if (shot.set === 'interior') {
      const f = shot.flow[0];
      const speed = f.speed ?? 70;
      const arrive = (MACHINE_X + ROUTE_MARGIN) / speed;
      const suggest = Math.round((shot.dur * 0.3 - arrive) * 10) / 10;
      out.push(`shot ${shot.id}: no flow item is on screen mid-shot — items enter at the left edge and need ${arrive.toFixed(1)}s at speed ${speed} to reach the machine (x=${MACHINE_X}, belt y=${INTERIOR_BELT_Y}); set "start": ${suggest} (or lower) so one is inside the machine by 30% of the shot`);
    } else {
      out.push(`shot ${shot.id}: no flow item is on screen mid-shot — the items are outside the camera window or have not arrived yet; use a negative "start", a higher "speed", or point cam at where the items are`);
    }
  }
  return out;
}
