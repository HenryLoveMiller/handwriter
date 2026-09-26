# Handwriter — Letter Tracing Practice

A tablet-optimized web app for handwriting practice. Trace letters of the alphabet over a translucent guide and receive an accuracy score.

## Running the app

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in a browser (or on your tablet).
Also available at: `https://handwriter.jacobpaine.com/`
## Features

- **Trace any letter** A–Z in uppercase or lowercase
- **Pressure-sensitive drawing** via the Pointer Events API (varies line width with stylus pressure)
- **Scoring** — tap "Score ✓" after tracing to see:
  - **Coverage**: how much of the guide letter you covered
  - **Precision**: how much of your ink landed inside the guide
  - **Overall**: weighted average (50/50), shown as a percentage and letter grade
  - Red overlay = strokes outside the guide; green = inside
- **Progress tracker** — scores for all 26 letters persist across page reloads via localStorage
- **Customizable guide**: stroke width, opacity, and 12 font choices (manuscript, print, cursive, serif, monospace, handwriting, and brush script)
- **Undo** last stroke or **Clear** the canvas to retry

## Design decisions

### Calibrating stroke demonstrations

Stroke demonstrations use hand-authored centerlines rather than paths extracted from the font outline.
When adding a font, calibrate every uppercase and lowercase glyph instead of aliasing another font's
stroke map indefinitely. In development mode, select the font and letter, click **Calibrate Strokes**,
drag the numbered endpoints and Bézier handles onto the visible glyph, and press **Demo** to preview
the draft path. Copy the generated block into the font-specific map in `src/data/strokeData.ts`.
The development toolbar also reports a sampled **Path fit** score: 92% or higher is the default
acceptance target, while lower scores should be reviewed stroke by stroke. Audit links can open a
specific glyph directly, for example `/?font=ABeeZee&case=lower&letter=g`, which makes automated
browser regression checks deterministic.

- The guide letter is rendered as a CSS element (not on the canvas) for crisp antialiasing at all sizes; the scoring uses an offscreen canvas with an identical font spec for pixel-accurate comparison.
- Canvas internal resolution matches the container's CSS pixel dimensions from a ResizeObserver, so it stays sharp at any layout size.
- `touch-action: none` prevents scroll interference during drawing; pointer capture ensures strokes don't break when the pointer leaves the canvas.
- The canvas is keyed on `letter + caseType + canvasKey` so it resets automatically when navigating or toggling case.
