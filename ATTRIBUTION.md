# Attribution and provenance

`clawd-kit` is derived from **ClaudeAnimationBase** by John Heibel, released under the MIT licence.

- Upstream: https://github.com/JohnHeibel/ClaudeAnimationBase
- Upstream licence: MIT, Copyright (c) 2026 John Heibel (see `LICENSE`)
- Port chain: ClaudeAnimationBase → `clawd-mv` (p5 engine) → this Canvas2D port.

## What came from upstream

| Path | Origin |
|---|---|
| `src/styles/clawd/sketch/core.ts` | Canvas2D port of `public/engine/core.js` (palette, timing, seeded boil, geometry, paint/inkLine/glow) |
| `src/styles/clawd/sketch/character.ts` | Port of `public/engine/clawd.js`; key-view model sheet, turns, arm table |
| `src/styles/clawd/sketch/flower.ts` | Port of `public/engine/scenes/mv_common.js` (flower motif) |
| `src/styles/clawd/sketch/swing.ts` | Port of `public/engine/scenes/mv_common.js` (swing frame) |

## Local modifications

These are **not** upstream and are covered by this repository's copyright line:

- Canvas2D renderer replacing p5 + p5.brush; `makeNoise()` uses an injectable canvas factory (`setSketchCanvasFactory`).
- `character.ts`: GIRL palette, exported `VIEWS`, `feel`/`emotions`/`move`/`girl`/`boy`/`guitar`/`pinned` helpers.
- `src/styles/clawd/critters.ts`, `emotions.ts`, `scenery.ts`, `shapes.ts`, `sheets.ts`, `anchors.ts`, `api.ts`.
- `src/core/**` and `src/engine/**`: the component registry, scene/validation/gate layer, and the pixel-style engine.
- `scripts/**`: component gate, API-doc generation, action strip, preview and promotion tools.

## Redistribution checklist

When redistributing this repository or a substantial portion of it:

1. Keep `LICENSE` and this file.
2. Keep the provenance header at the top of the four `sketch/*.ts` files.
3. State any further modifications you make.
