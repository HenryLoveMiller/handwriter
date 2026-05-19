// Stroke start/end positions normalized to the rendered bounding box.
// (0,0) = top-left of pixel bounding box, (1,1) = bottom-right.
//
// Calligraphic principles applied:
//   • All strokes travel top→bottom or left→right where possible (natural pen motion).
//   • Circular/oval forms enter at ~1 o'clock (x≈0.80, top-third) and go counterclockwise.
//   • Vertical strokes precede bumps/arches on letters like B, D, P, R.
//   • Crossbars are always the last stroke on a letter (T, H, E, F, etc.).
//   • Where two strokes share a start point they are offset by ~0.06 so
//     the numbered circles remain visually distinct.
//
// ex/ey = normalized end position of the stroke (used to draw directional arrows).
// For dot strokes (i, j) ex === x and ey === y to signal "tap here."
//
// Ascender letters (b d f h k l t): bounding box top = top of ascender (y≈0).
//   x-height body lives in approximately y ≈ 0.45–1.0.
// Descender letters (g j p q y): x-height body ≈ y 0.0–0.55;
//   descender fills y ≈ 0.55–1.0.
// Dot letters (i j): dot at y≈0.05–0.12, body below y≈0.28.
//
// Per-font structure:
//   UPPER_STROKES[fontFamily][letter] → StrokeStart[]
//   LOWER_STROKES[fontFamily][letter] → StrokeStart[]
//   getStrokes(fontFamily, caseType, letter) — falls back to 'Nunito' if font not yet defined.

// Bezier segments:
//   Quadratic:  cx/cy only                        → one control point
//   Cubic:      cx/cy + c2x/c2y                   → two control points
//   Compound:   cx/cy + c2x/c2y + mx/my + c3x/c3y + c4x/c4y
//               → two chained cubic segments: (start→mx) then (mx→end)
//               Use for closed or complex curves (O, Q, S) that need 4 handles.
// All values are normalised to letter bounding box. Values outside 0–1 are valid.
export interface StrokeStart {
  x: number; y: number;    // stroke start
  ex: number; ey: number;  // stroke end
  cx?: number; cy?: number;    // CP1 — cubic departure from start (or only CP for quadratic)
  c2x?: number; c2y?: number;  // CP2 — cubic arrival at end (or at mx for compound)
  // Compound bezier — second segment from mx/my → mx2/my2 (or end):
  mx?: number; my?: number;    // on-curve midpoint joining segments 1 and 2
  c3x?: number; c3y?: number;  // CP3 — departure from mx
  c4x?: number; c4y?: number;  // CP4 — arrival at mx2 (or end if no mx2)
  // Optional third segment from mx2/my2 → mx3/my3 (or end):
  mx2?: number; my2?: number;  // on-curve midpoint joining segments 2 and 3
  c5x?: number; c5y?: number;  // CP5 — departure from mx2
  c6x?: number; c6y?: number;  // CP6 — arrival at mx3 (or end if no mx3)
  // Optional fourth segment from mx3/my3 → end:
  mx3?: number; my3?: number;  // on-curve midpoint joining segments 3 and 4
  c7x?: number; c7y?: number;  // CP7 — departure from mx3
  c8x?: number; c8y?: number;  // CP8 — arrival at end
}

export type FontStrokeMap = Record<string, StrokeStart[]>;

// ─── Print baseline (Nunito) — shared fallback for all print/sans-serif fonts ──

const NUNITO_UPPER: FontStrokeMap = {
  // A: left leg from apex → lower-left; right leg from apex → lower-right; crossbar L→R.
  A: [
    {x:0.44,y:0.02, ex:0.10,ey:0.96},
    {x:0.56,y:0.02, ex:0.90,ey:0.96},
    {x:0.10,y:0.54, ex:0.90,ey:0.54},
  ],

  // B: vertical; upper bump (curves right back to mid); lower bump (curves right back to base).
  B: [
    {x:0.20,y:0.02, ex:0.20,ey:0.96},
    {x:0.24,y:0.02, ex:0.24,ey:0.50, cx:1.50,cy:0.25},
    {x:0.24,y:0.50, ex:0.24,ey:0.96, cx:1.60,cy:0.74},
  ],

  // C: single CCW arc, entering at ~1 o'clock, sweeping left, ending at ~5 o'clock.
  // Cubic: C1 at start-y → horizontal departure; C2 near end-y → gradual return.
  C: [
    {x:0.87,y:0.09, ex:0.98,ey:0.87, cx:-0.34,cy:-0.04, c2x:0.00,c2y:1.31},
  ],

  // D: vertical; rightward curve from top back to base.
  D: [
    {x:0.20,y:0.02, ex:0.20,ey:0.96},
    {x:0.26,y:0.02, ex:0.26,ey:0.96, cx:1.50,cy:0.50},  // bowl arc
  ],

  // E: vertical; top bar; middle bar; bottom bar.
  E: [
    {x:0.18,y:0.02, ex:0.18,ey:0.96},
    {x:0.22,y:0.02, ex:0.88,ey:0.02},
    {x:0.18,y:0.50, ex:0.72,ey:0.50},
    {x:0.18,y:0.96, ex:0.88,ey:0.96},
  ],

  // F: vertical; top bar; middle bar.
  F: [
    {x:0.18,y:0.02, ex:0.18,ey:0.96},
    {x:0.22,y:0.02, ex:0.88,ey:0.02},
    {x:0.18,y:0.50, ex:0.72,ey:0.50},
  ],

  // G: CCW arc (cubic) entering at ~1 o'clock, ending at mid-right; shelf L from mid-right.
  G: [
    {x:0.88,y:0.11, ex:0.93,ey:0.77, cx:-0.39,cy:-0.21, c2x:0.01,c2y:1.46},
    {x:0.93,y:0.52, ex:0.52,ey:0.52},
  ],

  // H: left vertical; right vertical; crossbar L→R.
  H: [
    {x:0.20,y:0.02, ex:0.20,ey:0.96},
    {x:0.80,y:0.02, ex:0.80,ey:0.96},
    {x:0.18,y:0.50, ex:0.82,ey:0.50},
  ],

  // I: single vertical.
  I: [
    {x:0.50,y:0.02, ex:0.50,ey:0.96},
  ],

  // J: descends from upper-right, curves left into hook at base — cubic bezier.
  J: [
    {x:0.75,y:0.02, ex:0.18,ey:0.90, cx:0.90,cy:1.20, c2x:0.12,c2y:0.88},
  ],

  // K: vertical; upper arm from top-right → junction; lower leg from junction → bottom-right.
  K: [
    {x:0.20,y:0.02, ex:0.20,ey:0.96},
    {x:0.82,y:0.02, ex:0.28,ey:0.50},
    {x:0.28,y:0.50, ex:0.82,ey:0.96},
  ],

  // L: vertical; base bar L→R.
  L: [
    {x:0.20,y:0.02, ex:0.20,ey:0.96},
    {x:0.16,y:0.94, ex:0.88,ey:0.94},
  ],

  // M: left vertical; left diagonal to valley; right diagonal to valley; right vertical.
  M: [
    {x:0.10,y:0.02, ex:0.10,ey:0.96},
    {x:0.18,y:0.02, ex:0.50,ey:0.74},
    {x:0.82,y:0.02, ex:0.50,ey:0.74},
    {x:0.90,y:0.02, ex:0.90,ey:0.96},
  ],

  // N: left vertical; diagonal top-left → bottom-right; right vertical.
  N: [
    {x:0.18,y:0.02, ex:0.18,ey:0.96},
    {x:0.22,y:0.02, ex:0.80,ey:0.96},
    {x:0.80,y:0.02, ex:0.80,ey:0.96},
  ],

  // O: CCW oval compound bezier — enters at ~1 o'clock, full CCW sweep, exits lower-right.
  O: [
    {x:0.84,y:0.25, ex:0.91,ey:0.34,
     cx:0.48,cy:-0.19, c2x:-0.34,c2y:0.30,
     mx:0.30,my:0.92,
     c3x:0.88,c3y:1.07, c4x:1.07,c4y:0.45},
  ],

  // P: vertical; bump arcs right from top then returns to stem at mid-height — cubic bezier.
  P: [
    {x:0.20,y:0.02, ex:0.20,ey:0.96},
    {x:0.28,y:0.02, ex:0.24,ey:0.50, cx:1.30,cy:0.14, c2x:1.30,c2y:0.46},
  ],

  // Q: CCW oval (compound, same as O); tail from lower-right interior diagonally outward.
  Q: [
    {x:0.84,y:0.25, ex:0.91,ey:0.34,
     cx:0.48,cy:-0.19, c2x:-0.34,c2y:0.30,
     mx:0.30,my:0.92,
     c3x:0.88,c3y:1.07, c4x:1.07,c4y:0.45},
    {x:0.60,y:0.72, ex:0.88,ey:0.96},
  ],

  // R: vertical; bump arcs right then returns to stem; diagonal leg from bump junction.
  R: [
    {x:0.20,y:0.02, ex:0.20,ey:0.96},
    {x:0.28,y:0.02, ex:0.26,ey:0.50, cx:0.96,cy:0.02, c2x:1.25,c2y:0.46},
    {x:0.50,y:0.50, ex:0.82,ey:0.96},
  ],

  // S: compound bezier S-curve — upper arc CCW, lower arc CW, midpoint at center.
  S: [
    {x:0.80,y:0.10, ex:0.20,ey:0.90,
     cx:0.14,cy:-0.02, c2x:0.14,c2y:0.44,
     mx:0.50,my:0.50,
     c3x:0.86,c3y:0.56, c4x:0.86,c4y:1.02},
  ],

  // T: vertical center stroke; crossbar L→R.
  T: [
    {x:0.50,y:0.02, ex:0.50,ey:0.96},
    {x:0.06,y:0.04, ex:0.94,ey:0.04},
  ],

  // U: single sweep-under stroke — departs downward left, sweeps under, arrives upward right.
  U: [
    {x:0.18,y:0.02, ex:0.82,ey:0.06, cx:0.04,cy:1.30, c2x:0.98,c2y:1.15},
  ],

  // V: left diagonal top→point; right diagonal top→point.
  V: [
    {x:0.10,y:0.02, ex:0.50,ey:0.96},
    {x:0.90,y:0.02, ex:0.50,ey:0.96},
  ],

  // W: four downward strokes (left-to-right across the top).
  W: [
    {x:0.06,y:0.02, ex:0.24,ey:0.96},
    {x:0.32,y:0.02, ex:0.44,ey:0.96},
    {x:0.66,y:0.02, ex:0.74,ey:0.96},
    {x:0.92,y:0.02, ex:0.94,ey:0.96},
  ],

  // X: forward diagonal (top-left → bottom-right); back diagonal (top-right → bottom-left).
  X: [
    {x:0.10,y:0.02, ex:0.90,ey:0.96},
    {x:0.90,y:0.02, ex:0.10,ey:0.96},
  ],

  // Y: left arm top→junction; right arm top→junction; stem junction→base.
  Y: [
    {x:0.10,y:0.02, ex:0.50,ey:0.50},
    {x:0.90,y:0.02, ex:0.50,ey:0.50},
    {x:0.50,y:0.50, ex:0.50,ey:0.96},
  ],

  // Z: top bar L→R; diagonal top-right → bottom-left; bottom bar L→R.
  Z: [
    {x:0.08,y:0.04, ex:0.92,ey:0.04},
    {x:0.88,y:0.04, ex:0.12,ey:0.94},
    {x:0.08,y:0.94, ex:0.92,ey:0.94},
  ],
};

const NUNITO_LOWER: FontStrokeMap = {
  // a: CCW oval (compound) entering at ~1 o'clock; right stem pulls straight down.
  a: [
    {x:0.80,y:0.22, ex:0.84,ey:0.84,
     cx:0.50,cy:-0.12, c2x:-0.18,c2y:0.28,
     mx:0.14,my:0.78,
     c3x:0.14,c3y:1.02, c4x:0.68,c4y:1.04},
    {x:0.88,y:0.06, ex:0.88,ey:0.96},
  ],

  // b: tall downstroke from ascender top; bowl CCW from mid-stick.
  b: [
    {x:0.20,y:0.02, ex:0.20,ey:0.96},
    {x:0.28,y:0.56, ex:0.24,ey:0.96, cx:1.48,cy:0.76},
  ],

  // c: single CCW arc entering at ~1 o'clock within x-height, sweeping left.
  c: [
    {x:0.80,y:0.18, ex:0.80,ey:0.82, cx:-0.60,cy:0.18, c2x:0.20,c2y:0.72},
  ],

  // d: CCW oval in x-height (bbox y≈0.45-1.0) then ascender stroke.
  d: [
    {x:0.74,y:0.50, ex:0.78,ey:0.90,
     cx:0.50,cy:0.38, c2x:-0.18,c2y:0.60,
     mx:0.12,my:0.82,
     c3x:0.12,c3y:1.02, c4x:0.64,c4y:1.04},
    {x:0.82,y:0.02, ex:0.82,ey:0.96},
  ],

  // e: crossbar entry → curves up → CCW loop over top and down left side → exits lower-right.
  e: [
    {x:0.14,y:0.48, ex:0.74,ey:0.82,
     cx:1.00,cy:0.48, c2x:0.80,c2y:0.10,
     mx:0.50,my:0.04,
     c3x:-0.20,c3y:0.04, c4x:0.14,c4y:1.00},
  ],

  // f: tall curved stroke from ascender top (curves right at apex); crossbar L→R at x-height mid.
  f: [
    {x:0.68,y:0.02, ex:0.44,ey:0.96},
    {x:0.10,y:0.42, ex:0.82,ey:0.42},
  ],

  // g: CCW oval in x-height (bbox y≈0.0-0.55); right side continues into descending tail.
  g: [
    {x:0.80,y:0.06, ex:0.82,ey:0.48,
     cx:0.50,cy:-0.06, c2x:-0.18,c2y:0.18,
     mx:0.12,my:0.40,
     c3x:0.12,c3y:0.58, c4x:0.66,c4y:0.60},
    {x:0.88,y:0.04, ex:0.60,ey:0.96},
  ],

  // h: tall downstroke from ascender; arch branches right at x-height then descends.
  h: [
    {x:0.20,y:0.02, ex:0.20,ey:0.96},
    {x:0.26,y:0.44, ex:0.82,ey:0.96, cx:0.80,cy:0.44, c2x:0.82,c2y:0.60},
  ],

  // i: short downstroke (x-height body); dot placed after.
  i: [
    {x:0.50,y:0.30, ex:0.50,ey:0.96},
    {x:0.50,y:0.06, ex:0.50,ey:0.06},
  ],

  // j: body descends straight then hooks left; dot placed after.
  j: [
    {x:0.52,y:0.24, ex:0.22,ey:0.84, cx:0.52,cy:0.68, c2x:0.10,c2y:0.90},
    {x:0.52,y:0.05, ex:0.52,ey:0.05},
  ],

  // k: tall downstroke; upper arm → junction; lower leg from junction.
  k: [
    {x:0.20,y:0.02, ex:0.20,ey:0.96},
    {x:0.80,y:0.06, ex:0.30,ey:0.52},
    {x:0.30,y:0.52, ex:0.80,ey:0.94},
  ],

  // l: single tall downstroke.
  l: [
    {x:0.50,y:0.02, ex:0.50,ey:0.96},
  ],

  // m: left stem; first arch (curves right then descends); second arch (curves right then descends).
  m: [
    {x:0.10,y:0.08, ex:0.10,ey:0.94},
    {x:0.38,y:0.08, ex:0.64,ey:0.94, cx:0.76,cy:0.08, c2x:0.64,c2y:0.52},
    {x:0.66,y:0.08, ex:0.90,ey:0.94, cx:1.02,cy:0.08, c2x:0.90,c2y:0.52},
  ],

  // n: downstroke; arch curves right at top then descends.
  n: [
    {x:0.18,y:0.08, ex:0.18,ey:0.94},
    {x:0.26,y:0.08, ex:0.82,ey:0.94, cx:0.80,cy:0.08, c2x:0.82,c2y:0.55},
  ],

  // o: CCW oval (compound bezier) entering at ~1 o'clock, full CCW sweep.
  o: [
    {x:0.80,y:0.12, ex:0.84,ey:0.84,
     cx:0.50,cy:-0.12, c2x:-0.20,c2y:0.22,
     mx:0.14,my:0.76,
     c3x:0.14,c3y:1.04, c4x:0.68,c4y:1.06},
  ],

  // p: downstroke through descender; bowl arcs right from stem-top then returns to stem-bottom.
  p: [
    {x:0.20,y:0.04, ex:0.20,ey:0.96},
    {x:0.26,y:0.04, ex:0.22,ey:0.56, cx:1.20,cy:0.15, c2x:1.20,c2y:0.48},
  ],

  // q: CCW oval in x-height (bbox y≈0.0-0.55); right stem continues through descender.
  q: [
    {x:0.74,y:0.06, ex:0.78,ey:0.48,
     cx:0.50,cy:-0.06, c2x:-0.18,c2y:0.16,
     mx:0.12,my:0.42,
     c3x:0.12,c3y:0.58, c4x:0.64,c4y:0.60},
    {x:0.82,y:0.04, ex:0.82,ey:0.96},
  ],

  // r: downstroke; shoulder arcs rightward from stem, curving to its tip.
  r: [
    {x:0.18,y:0.08, ex:0.18,ey:0.94},
    {x:0.26,y:0.08, ex:0.74,ey:0.30, cx:0.68,cy:0.04, c2x:0.58,c2y:0.36},
  ],

  // s: S-curve compound bezier — upper arc CCW, lower arc CW, midpoint at center.
  s: [
    {x:0.80,y:0.14, ex:0.20,ey:0.86,
     cx:0.14,cy:0.00, c2x:0.14,c2y:0.44,
     mx:0.50,my:0.50,
     c3x:0.86,c3y:0.56, c4x:0.86,c4y:1.00},
  ],

  // t: tall downstroke (ascender); crossbar L→R.
  t: [
    {x:0.50,y:0.02, ex:0.50,ey:0.96},
    {x:0.10,y:0.42, ex:0.82,ey:0.42},
  ],

  // u: left downstroke curving under; right downstroke.
  u: [
    {x:0.18,y:0.08, ex:0.50,ey:0.94},
    {x:0.82,y:0.08, ex:0.82,ey:0.94},
  ],

  // v: left diagonal top→point; right diagonal top→point.
  v: [
    {x:0.08,y:0.08, ex:0.50,ey:0.94},
    {x:0.92,y:0.08, ex:0.50,ey:0.94},
  ],

  // w: four downward strokes L→R.
  w: [
    {x:0.06,y:0.08, ex:0.22,ey:0.94},
    {x:0.34,y:0.08, ex:0.50,ey:0.94},
    {x:0.64,y:0.08, ex:0.72,ey:0.94},
    {x:0.92,y:0.08, ex:0.90,ey:0.94},
  ],

  // x: forward diagonal; back diagonal.
  x: [
    {x:0.08,y:0.08, ex:0.92,ey:0.94},
    {x:0.92,y:0.08, ex:0.08,ey:0.94},
  ],

  // y: left arm top→junction; right arm continues through descender.
  y: [
    {x:0.10,y:0.08, ex:0.50,ey:0.54},
    {x:0.88,y:0.08, ex:0.40,ey:0.96},
  ],

  // z: top bar L→R; diagonal top-right → bottom-left; bottom bar L→R.
  z: [
    {x:0.08,y:0.10, ex:0.92,ey:0.10},
    {x:0.88,y:0.10, ex:0.12,ey:0.90},
    {x:0.08,y:0.90, ex:0.92,ey:0.90},
  ],
};

// ─── ABeeZee overrides ────────────────────────────────────────────────────────
// Inherits Nunito baseline; corrects letters where ABeeZee's letterform differs.

const ABEEZEE_UPPER: FontStrokeMap = {
  ...NUNITO_UPPER,

  // A: crossbar at 62% cap-height (y=0.62); span recalculated to match leg faces at that y.
  //    History: y=0.48 too high; y=0.55 still reported too high on screen; y=0.62 targets
  //    the visual intersection zone of the legs (~60-65% of cap-height in sans-serif A).
  //    At y=0.62 the legs sit at x≈0.223 (left) and x≈0.777 (right); x:0.235/ex:0.765
  //    gives a ~0.012 inset from each outer leg face — the correct stroke endpoint position.
  A: [
    {x:0.44, y:0.02, ex:0.10, ey:0.96},   // left leg: apex → lower-left foot
    {x:0.56, y:0.02, ex:0.90, ey:0.96},   // right leg: apex → lower-right foot
    {x:0.235, y:0.62, ex:0.765, ey:0.62}, // crossbar: inner left → inner right at 62% cap-height
  ],

  // D: stem sits far left (x≈0.09); bowl arc cubic — from editor.
  D: [
    {x:0.09,y:0.06, ex:0.10,ey:0.97},
    {x:0.32,y:0.07, ex:0.20,ey:0.97, cx:1.15,cy:0.15, c2x:1.17,c2y:0.93},
  ],

  // E: vertical stem; top bar; middle bar; bottom bar — from editor.
  E: [
    {x:0.12,y:0.07, ex:0.12,ey:0.96},
    {x:0.39,y:0.06, ex:0.99,ey:0.06},
    {x:0.12,y:0.49, ex:0.86,ey:0.49},
    {x:0.12,y:0.95, ex:0.94,ey:0.95},
  ],

  // G: CCW arc like C but ending at lower-right; shelf going left from mid-right — from editor.
  G: [
    {x:0.88,y:0.11, ex:0.93,ey:0.77, cx:-0.39,cy:-0.21, c2x:0.01,c2y:1.46},
    {x:0.93,y:0.52, ex:0.60,ey:0.53},
  ],

  // H: left stem; right stem; crossbar L→R — from editor.
  H: [
    {x:0.09,y:0.04, ex:0.10,ey:0.98},
    {x:0.91,y:0.02, ex:0.91,ey:0.97},
    {x:0.11,y:0.49, ex:0.89,ey:0.49},
  ],

  // J: downstroke from upper-right, sweeping left into hook at base — from editor.
  J: [
    {x:0.85,y:0.02, ex:0.12,ey:0.89, cx:1.07,cy:1.32, c2x:0.19,c2y:0.88},
  ],

  // K: left stem; upper arm → junction; lower leg → bottom-right — estimated, tune with editor.
  K: [
    {x:0.09,y:0.04, ex:0.10,ey:0.97},
    {x:0.88,y:0.04, ex:0.18,ey:0.50},
    {x:0.18,y:0.50, ex:0.88,ey:0.97},
  ],

  // L: vertical stem; base bar L→R — from editor.
  L: [
    {x:0.12,y:0.03, ex:0.13,ey:0.96},
    {x:0.14,y:0.94, ex:0.96,ey:0.94},
  ],

  // M: left stem; left diagonal → valley; right diagonal → valley; right stem — from editor.
  M: [
    {x:0.08,y:0.05, ex:0.07,ey:0.96},
    {x:0.19,y:0.16, ex:0.48,ey:0.72},
    {x:0.49,y:0.70, ex:0.87,ey:0.11},
    {x:0.89,y:0.09, ex:0.90,ey:0.96},
  ],

  // N: left stem; diagonal top-left → bottom-right; right stem — from editor.
  N: [
    {x:0.09,y:0.04, ex:0.09,ey:0.97},
    {x:0.22,y:0.14, ex:0.88,ey:0.97},
    {x:0.91,y:0.04, ex:0.91,ey:0.97},
  ],

  // O: CCW oval — compound bezier — from editor.
  O: [
    {x:0.84,y:0.22, ex:0.91,ey:0.34, cx:0.48,cy:-0.19, c2x:-0.34,c2y:0.30, mx:0.29,my:0.90, c3x:0.88,c3y:1.07, c4x:1.07,c4y:0.45},
  ],

  // P: vertical stem; bump from top → mid — stem/bump positions estimated; needs editor tuning.
  P: [
    {x:0.09,y:0.04, ex:0.09,ey:0.97},
    {x:0.18,y:0.04, ex:0.18,ey:0.55, cx:1.20,cy:0.15, c2x:1.20,c2y:0.48},
  ],

  // Q: CCW oval (compound, like O); tail from lower-right — from editor.
  Q: [
    {x:0.91,y:0.49, ex:0.92,ey:0.61, cx:0.75,cy:-0.34, c2x:-0.30,c2y:0.15, mx:0.18,my:0.83, c3x:0.37,c3y:0.99, c4x:0.84,c4y:0.99},
    {x:0.62,y:0.72, ex:0.94,ey:0.93},
  ],

  // R: vertical stem; bump → mid; diagonal leg → lower-right — from editor.
  R: [
    {x:0.09,y:0.04, ex:0.09,ey:0.97},
    {x:0.18,y:0.04, ex:0.18,ey:0.52, cx:0.89,cy:0.04, c2x:1.20,c2y:0.46},
    {x:0.50,y:0.51, ex:0.90,ey:0.97},
  ],

  // S: S-curve — compound bezier — from editor.
  S: [
    {x:0.86,y:0.08, ex:0.08,ey:0.87, cx:0.09,cy:-0.04, c2x:-0.22,c2y:0.38, mx:0.84,my:0.58, c3x:1.06,c3y:0.79, c4x:0.70,c4y:1.11},
  ],

  // T: center vertical; crossbar L→R — estimated.
  T: [
    {x:0.50,y:0.04, ex:0.50,ey:0.97},
    {x:0.07,y:0.05, ex:0.95,ey:0.05},
  ],

  // U: single stroke sweeping under — from editor.
  U: [
    {x:0.09,y:0.04, ex:0.94,ey:0.10, cx:-0.03,cy:1.38, c2x:1.10,c2y:1.11},
  ],

  // V: left diagonal → point; right diagonal → point — estimated.
  V: [
    {x:0.08,y:0.04, ex:0.50,ey:0.97},
    {x:0.92,y:0.04, ex:0.50,ey:0.97},
  ],

  // W: four arms all starting at top of cap-height, converging to two valley points.
  // Inner arms corrected to y:0.04 — numbered circles appear at letter-top, not mid-letter.
  W: [
    {x:0.05,y:0.04, ex:0.28,ey:0.97},   // left outer: far-left top → left valley
    {x:0.44,y:0.04, ex:0.28,ey:0.97},   // left inner: center-left top → left valley
    {x:0.55,y:0.04, ex:0.71,ey:0.95},   // right inner: center-right top → right valley
    {x:0.95,y:0.04, ex:0.72,ey:0.97},   // right outer: far-right top → right valley
  ],

  // X: forward diagonal; back diagonal — estimated.
  X: [
    {x:0.08,y:0.04, ex:0.92,ey:0.97},
    {x:0.92,y:0.04, ex:0.08,ey:0.97},
  ],

  // Y: left arm → junction; right arm → junction; stem → base — estimated.
  Y: [
    {x:0.08,y:0.04, ex:0.50,ey:0.50},
    {x:0.92,y:0.04, ex:0.50,ey:0.50},
    {x:0.50,y:0.50, ex:0.50,ey:0.97},
  ],

  // Z: top bar L→R; diagonal top-right → bottom-left; bottom bar L→R — estimated.
  Z: [
    {x:0.08,y:0.05, ex:0.94,ey:0.05},
    {x:0.90,y:0.05, ex:0.10,ey:0.95},
    {x:0.08,y:0.95, ex:0.94,ey:0.95},
  ],
};

// ─── ABeeZee lowercase overrides ─────────────────────────────────────────────
// Straight-stroke letters: estimated from confirmed ABeeZee geometry.
// Curved-stroke letters: seeded with bezier placeholders — tune with Edit Arrows editor.

const ABEEZEE_LOWER: FontStrokeMap = {
  ...NUNITO_LOWER,

  // a: CCW oval (compound) + right stem — from editor.
  a: [
    {x:0.78,y:0.24, ex:0.81,ey:0.69,
     cx:0.50,cy:-0.14, c2x:-0.18,c2y:0.28,
     mx:0.15,my:0.80,
     c3x:0.33,c3y:0.94, c4x:0.68,c4y:1.06},
    {x:0.88,y:0.06, ex:0.88,ey:0.96},
  ],

  // b: tall stem; bowl — from editor.
  b: [
    {x:0.12,y:0.02, ex:0.12,ey:0.96},
    {x:0.23,y:0.36, ex:0.20,ey:0.92, cx:0.97,cy:0.23, c2x:1.23,c2y:1.08},
  ],

  // c: CCW arc — from editor.
  c: [
    {x:0.90,y:0.08, ex:0.97,ey:0.87, cx:-0.24,cy:0.04, c2x:-0.01,c2y:1.22},
  ],

  // d: oval + ascender stem — from editor.
  d: [
    {x:0.76,y:0.40, ex:0.77,ey:0.80,
     cx:0.32,cy:0.16, c2x:-0.18,c2y:0.60,
     mx:0.12,my:0.82,
     c3x:0.12,c3y:1.02, c4x:0.64,c4y:1.04},
    {x:0.81,y:0.03, ex:0.84,ey:0.96},
  ],

  // e: crossbar → up → CCW loop → exits lower-right — from editor.
  e: [
    {x:0.10,y:0.47, ex:0.82,ey:0.89,
     cx:1.54,cy:0.60, c2x:0.64,c2y:0.03,
     mx:0.55,my:0.10,
     c3x:-0.20,c3y:0.04, c4x:-0.04,c4y:1.19},
  ],

  // f: curved top stroke; crossbar — from editor.
  f: [
    {x:0.95,y:0.09, ex:0.31,ey:1.01, cx:0.17,cy:0.02, c2x:0.30,c2y:0.20},
    {x:0.04,y:0.38, ex:0.87,ey:0.38},
  ],

  // g: oval + descending tail with leftward hook — from editor.
  g: [
    {x:0.68,y:0.05, ex:0.91,ey:0.53,
     cx:0.37,cy:0.03, c2x:-0.18,c2y:0.18,
     mx:0.16,my:0.55,
     c3x:0.50,c3y:0.73, c4x:0.66,c4y:0.60},
    {x:0.94,y:0.09, ex:0.22,ey:0.92, cx:0.88,cy:0.68, c2x:1.12,c2y:1.01},
  ],

  // h: tall stem; arch — from editor.
  h: [
    {x:0.12,y:0.02, ex:0.12,ey:0.96},
    {x:0.18,y:0.44, ex:0.88,ey:0.96, cx:0.96,cy:0.19, c2x:0.88,c2y:0.60},
  ],

  // j: body descends then hooks; dot — from editor.
  j: [
    {x:0.77,y:0.25, ex:0.13,ey:0.94, cx:0.84,cy:0.77, c2x:0.81,c2y:1.07},
    {x:0.76,y:0.06, ex:0.60,ey:0.04},
  ],

  // k: tall stem; upper arm; lower leg — from editor.
  k: [
    {x:0.12,y:0.02, ex:0.12,ey:0.96},
    {x:0.75,y:0.35, ex:0.30,ey:0.56},
    {x:0.22,y:0.52, ex:0.88,ey:0.94},
  ],

  // l: tall stroke with curved tail — from editor.
  l: [
    {x:0.16,y:0.01, ex:0.86,ey:0.95, cx:0.27,cy:0.64, c2x:-0.25,c2y:0.98},
  ],

  // m: left stem; first arch; second arch — from editor.
  m: [
    {x:0.04,y:0.06, ex:0.05,ey:0.96},
    {x:0.11,y:0.23, ex:0.52,ey:0.94, cx:0.45,cy:-0.15, c2x:0.52,c2y:0.45},
    {x:0.56,y:0.26, ex:0.94,ey:0.94, cx:0.95,cy:-0.17, c2x:0.94,c2y:0.44},
  ],

  // n: downstroke; arch — from editor.
  n: [
    {x:0.12,y:0.08, ex:0.12,ey:0.94},
    {x:0.18,y:0.08, ex:0.88,ey:0.94, cx:1.03,cy:0.02, c2x:0.88,c2y:0.55},
  ],

  // o: CCW oval compound bezier — from editor.
  o: [
    {x:0.86,y:0.27, ex:0.92,ey:0.42,
     cx:0.50,cy:-0.12, c2x:-0.24,c2y:0.26,
     mx:0.19,my:0.83,
     c3x:0.51,c3y:1.13, c4x:1.06,c4y:0.78},
  ],

  // p: descender stem; bowl arcs right from stem-top — from editor.
  p: [
    {x:0.16,y:0.12, ex:0.20,ey:0.96},
    {x:0.28,y:0.10, ex:0.20,ey:0.56, cx:1.21,cy:-0.11, c2x:1.02,c2y:0.96},
  ],

  // q: CCW oval + right stem through descender — from editor.
  q: [
    {x:0.63,y:0.08, ex:0.88,ey:0.56,
     cx:0.40,cy:0.03, c2x:0.02,c2y:0.16,
     mx:0.15,my:0.49,
     c3x:0.12,c3y:0.58, c4x:0.54,c4y:0.77},
    {x:0.91,y:0.10, ex:0.92,ey:0.96},
  ],

  // r: downstroke; shoulder arcs rightward — from editor.
  r: [
    {x:0.14,y:0.10, ex:0.14,ey:1.01},
    {x:0.45,y:0.17, ex:0.99,ey:0.09, cx:0.57,cy:0.13, c2x:0.72,c2y:0.05},
  ],

  // s: S-curve compound bezier — from editor.
  s: [
    {x:0.81,y:0.10, ex:0.11,ey:0.88,
     cx:0.14,cy:0.00, c2x:-0.06,c2y:0.36,
     mx:0.50,my:0.50,
     c3x:1.22,c3y:0.71, c4x:0.86,c4y:1.00},
  ],

  // t: curved stroke + straight crossbar — from editor.
  t: [
    {x:0.39,y:0.05, ex:0.87,ey:0.93, cx:0.33,cy:0.32, c2x:0.12,c2y:1.03},
    {x:-0.05,y:0.29, ex:0.88,ey:0.30},
  ],

  // u: two curved strokes — from editor.
  u: [
    {x:0.14,y:0.10, ex:0.73,ey:0.79, cx:0.10,cy:0.78, c2x:0.16,c2y:1.17},
    {x:0.81,y:0.07, ex:0.84,ey:0.94, cx:0.82,cy:0.54, c2x:0.82,c2y:0.74},
  ],

  // w: four arms all starting at top of x-height, converging to two valley points.
  // Inner arms start at y:0.08 like the outer arms — numbered circles appear at letter-top.
  w: [
    {x:0.05,y:0.08, ex:0.26,ey:0.94},   // left outer: far-left top → left valley
    {x:0.44,y:0.08, ex:0.26,ey:0.94},   // left inner: center-left top → left valley
    {x:0.55,y:0.08, ex:0.70,ey:0.94},   // right inner: center-right top → right valley
    {x:0.95,y:0.08, ex:0.70,ey:0.94},   // right outer: far-right top → right valley
  ],
};

// ─── Cursive lowercase + uppercase (Dancing Script, Caveat) ──────────────────
// Every straight stroke has been converted to a cubic with neutral control points
// (placed at 1/3 and 2/3 along the original line) so handles are draggable in the
// Edit Arrows tool. Letters already fully curved (c, e, j, o, s) inherit from Nunito.
// h, m, n use 1- or 2-stroke cursive variants. All others retain Nunito stroke order.

const CURSIVE_LOWER: FontStrokeMap = {
  ...NUNITO_LOWER,

  // a — 1 stroke: oval CCW + exit (3 segments)
  a: [{x:0.76,y:0.23, ex:1.00,ey:0.49,
       cx:0.54,cy:-0.17, c2x:-0.05,c2y:0.39,
       mx:0.10,my:0.95, c3x:0.14,c3y:1.02, c4x:0.38,c4y:0.90,
       mx2:0.68,my2:0.33, c5x:0.27,c5y:1.18, c6x:0.82,c6y:1.00}],

  // b — 1 stroke: ascender down + bowl right (3 segments)
  b: [{x:0.44,y:0.49, ex:0.96,ey:0.73,
       cx:1.11,cy:-0.25, c2x:0.20,c2y:0.12,
       mx:0.12,my:0.89, c3x:-0.08,c3y:1.13, c4x:1.02,c4y:0.88,
       mx2:0.51,my2:0.54, c5x:0.12,c5y:0.97, c6x:1.02,c6y:0.85}],

  // c — 1 stroke: arc (2 segments)
  c: [{x:0.67,y:0.32, ex:1.00,ey:0.47,
       cx:0.91,cy:-0.19, c2x:0.04,c2y:0.26,
       mx:0.13,my:0.49, c3x:-0.03,c3y:1.02, c4x:0.53,c4y:1.19}],

  // d — 1 stroke: oval CCW + ascender up (3 segments)
  d: [{x:0.48,y:0.49, ex:0.92,ey:0.79,
       cx:0.37,cy:0.52, c2x:-0.20,c2y:0.88,
       mx:0.11,my:0.97, c3x:0.32,c3y:1.00, c4x:0.44,c4y:0.88,
       mx2:0.92,my2:0.03, c5x:0.09,c5y:1.34, c6x:0.80,c6y:0.95}],

  // e — 1 stroke: loop + exit (2 segments)
  e: [{x:0.34,y:0.56, ex:0.97,ey:0.54,
       cx:0.97,cy:0.26, c2x:0.79,c2y:0.05,
       mx:0.59,my:0.05, c3x:-0.04,c3y:0.16, c4x:-0.22,c4y:1.68}],

  // f — 1 stroke: arc down + crossbar (3 segments)
  f: [{x:0.37,y:0.42, ex:0.88,ey:0.57,
       cx:1.73,cy:-0.20, c2x:0.37,c2y:-0.11,
       mx:0.10,my:0.97, c3x:0.55,c3y:0.89, c4x:0.36,c4y:0.53,
       mx2:0.40,my2:0.50, c5x:0.33,c5y:0.71, c6x:0.80,c6y:0.70}],

  // g — 1 stroke: oval CCW + descender hook (3 segments)
  g: [{x:0.76,y:0.06, ex:0.97,ey:0.33,
       cx:0.21,cy:-0.05, c2x:-0.49,c2y:1.07,
       mx:0.74,my:0.23, c3x:0.53,c3y:-0.30, c4x:0.94,c4y:0.62,
       mx2:0.13,my2:1.00, c5x:-0.39,c5y:0.75, c6x:1.12,c6y:0.55}],

  // h — 1 stroke: ascender + arch (2 segments)
  h: [{x:0.31,y:0.48, ex:1.00,ey:0.77,
       cx:1.03,cy:-0.14, c2x:0.42,c2y:-0.22,
       mx:0.04,my:1.00, c3x:1.05,c3y:-0.12, c4x:0.06,c4y:1.44}],

  // i — 2 strokes: body + dot
  i: [
    {x:0.47,y:0.36, ex:1.02,ey:0.69, cx:0.07,cy:0.84, c2x:-0.02,c2y:1.28},
    {x:0.79,y:0.07, ex:0.74,ey:0.07},
  ],

  // j — 2 strokes: body + dot
  j: [
    {x:0.73,y:0.24, ex:1.01,ey:0.51, cx:0.61,cy:1.23, c2x:-1.11,c2y:1.12},
    {x:0.76,y:0.06, ex:0.60,ey:0.04},
  ],

  // k — 1 stroke: ascender + upper arm + lower leg (3 segments)
  k: [{x:0.40,y:0.42, ex:1.02,ey:0.75,
       cx:0.87,cy:0.06, c2x:0.50,c2y:-0.36,
       mx:0.05,my:0.99, c3x:0.48,c3y:0.11, c4x:1.24,c4y:0.71,
       mx2:0.48,my2:0.76, c5x:0.55,c5y:1.17, c6x:0.85,c6y:0.92}],

  // l — 1 stroke: ascender down + base curve (2 segments)
  l: [{x:0.41,y:0.66, ex:0.77,ey:0.79,
       cx:1.87,cy:-0.46, c2x:-0.05,c2y:0.26,
       mx:0.14,my:0.85, c3x:0.09,c3y:1.08, c4x:0.50,c4y:0.96}],

  // m — 1 stroke: two arches (4 segments)
  m: [{x:0.12,y:0.15, ex:1.02,ey:0.47,
       cx:-0.05,cy:1.85, c2x:0.10,c2y:0.06,
       mx:0.47,my:0.09, c3x:0.52,c3y:0.04, c4x:0.38,c4y:0.92,
       mx2:0.37,my2:0.94, c5x:0.73,c5y:-0.04, c6x:0.75,c6y:0.08,
       mx3:0.72,my3:0.89, c7x:0.84,c7y:0.98, c8x:0.95,c8y:0.65}],

  // n — 1 stroke: arch (2 segments)
  n: [{x:0.20,y:0.17, ex:1.01,ey:0.47,
       cx:0.02,cy:1.74, c2x:0.12,c2y:0.06,
       mx:0.64,my:0.11, c3x:0.55,c3y:1.43, c4x:0.81,c4y:0.96}],

  // o — 1 stroke: CCW oval (2 segments)
  o: [{x:0.25,y:0.30, ex:1.01,ey:0.51,
       cx:-0.18,cy:1.17, c2x:0.42,c2y:1.14,
       mx:0.77,my:0.35, c3x:0.59,c3y:-0.69, c4x:-0.01,c4y:1.20}],

  // p — 1 stroke: bowl + stem down (2 segments)
  p: [{x:0.36,y:0.05, ex:0.42,ey:0.59,
       cx:0.01,cy:1.19, c2x:0.09,c2y:0.98,
       mx:0.31,my:0.22, c3x:1.41,c3y:-0.21, c4x:0.77,c4y:0.65}],

  // q — 1 stroke: oval CCW + stem down (3 segments)
  q: [{x:0.80,y:0.10, ex:0.99,ey:0.32,
       cx:0.37,cy:-0.13, c2x:-0.42,c2y:0.89,
       mx:0.51,my:0.47, c3x:0.94,c3y:-0.21, c4x:0.02,c4y:1.16,
       mx2:0.61,my2:0.93, c5x:0.15,c5y:0.53, c6x:1.08,c6y:0.50}],

  // r — 1 stroke: shoulder bump + exit (3 segments)
  r: [{x:0.00,y:0.60, ex:1.03,ey:0.62,
       cx:0.12,cy:0.49, c2x:0.14,c2y:0.42,
       mx:0.16,my:0.41, c3x:0.28,c3y:0.61, c4x:0.05,c4y:-0.59,
       mx2:0.46,my2:0.39, c5x:0.14,c5y:1.30, c6x:0.68,c6y:0.90}],

  // s — 1 stroke: S-curve (2 segments)
  s: [{x:0.24,y:0.52, ex:0.94,ey:0.57,
       cx:0.59,cy:-0.42, c2x:0.90,c2y:1.11,
       mx:0.22,my:0.99, c3x:-0.37,c3y:0.04, c4x:0.57,c4y:1.25}],

  // t — 2 strokes: curved stem + crossbar
  t: [
    {x:0.68,y:0.02, ex:0.99,ey:0.71, cx:0.09,cy:0.45, c2x:-0.25,c2y:1.46},
    {x:0.02,y:0.45, ex:0.97,ey:0.45},
  ],

  // u — 1 stroke: sweep under + exit (2 segments)
  u: [{x:0.18,y:0.10, ex:1.00,ey:0.43,
       cx:0.03,cy:0.61, c2x:-0.07,c2y:1.63,
       mx:0.62,my:0.18, c3x:0.26,c3y:1.54, c4x:0.85,c4y:0.76}],

  // v — 1 stroke: down + up (2 segments)
  v: [{x:0.08,y:0.10, ex:1.01,ey:0.51,
       cx:-0.03,cy:1.37, c2x:0.32,c2y:0.96,
       mx:0.71,my:0.09, c3x:0.64,c3y:0.78, c4x:0.73,c4y:0.87}],

  // w — 1 stroke: four valleys (4 segments)
  w: [{x:0.11,y:0.18, ex:1.00,ey:0.50,
       cx:-0.08,cy:1.43, c2x:0.31,c2y:0.71,
       mx:0.44,my:0.19, c3x:0.25,c3y:1.72, c4x:0.79,c4y:0.61,
       mx2:0.76,my2:0.07, c5x:0.80,c5y:0.33, c6x:0.62,c6y:0.78,
       mx3:0.90,my3:0.68, c7x:0.85,c7y:0.67, c8x:0.96,c8y:0.62}],

  // x — 2 strokes: forward diagonal + back diagonal (2 segments each)
  x: [
    {x:-0.00,y:0.41, ex:0.98,ey:0.50, cx:0.48,cy:-0.22, c2x:0.41,c2y:0.37,
     mx:0.58,my:0.82, c3x:0.75,c3y:0.86, c4x:0.91,c4y:0.66},
    {x:0.88,y:-0.04, ex:0.10,ey:0.90, cx:0.68,cy:0.10, c2x:0.50,c2y:0.38,
     mx:0.60,my:0.26, c3x:0.36,c3y:0.57, c4x:0.20,c4y:0.80},
  ],

  // y — 1 stroke: down + descender hook (2 segments)
  y: [{x:0.21,y:0.04, ex:0.98,ey:0.35,
       cx:0.00,cy:1.21, c2x:1.30,c2y:-0.66,
       mx:0.52,my:0.58, c3x:0.34,c3y:1.22, c4x:-0.76,c4y:1.06}],

  // z — 1 stroke: top bar + diagonal + bottom bar (3 segments)
  z: [{x:0.22,y:0.32, ex:1.01,ey:0.33,
       cx:0.61,cy:-0.15, c2x:1.02,c2y:0.08,
       mx:0.50,my:0.41, c3x:0.97,c3y:0.81, c4x:-0.10,c4y:1.19,
       mx2:0.10,my2:0.78, c5x:0.92,c5y:0.43, c6x:1.02,c6y:0.36}],
};

// ─── Cursive uppercase ────────────────────────────────────────────────────────
// All straight strokes converted to editable cubics (neutral CPs at 1/3 and 2/3).
// C, J, O, S, U already fully curved — inherited unchanged from Nunito.

const CURSIVE_UPPER: FontStrokeMap = {
  ...NUNITO_UPPER,

  // A — editor-tuned.
  A: [
    {x:0.85,y:0.03, ex:0.07,ey:0.90, cx:0.51,cy:0.23, c2x:0.28,c2y:0.67},
    {x:0.80,y:0.20, ex:0.97,ey:0.73, cx:0.65,cy:0.29, c2x:0.46,c2y:1.29},
    {x:0.13,y:0.52, ex:0.70,ey:0.58, cx:0.36,cy:0.51, c2x:0.63,c2y:0.54},
  ],

  // B — editor-tuned.
  B: [
    {x:0.43,y:0.13, ex:0.12,ey:0.81, cx:0.28,cy:0.36, c2x:0.18,c2y:0.64},
    {x:0.23,y:0.07, ex:0.43,ey:0.44, cx:1.15,cy:-0.12, c2x:1.15,c2y:0.42},
    {x:0.46,y:0.43, ex:0.05,ey:0.96, cx:1.17,cy:0.50, c2x:1.15,c2y:0.92},
  ],

  // C — editor-tuned compound bezier.
  C: [
    {x:0.79,y:0.34, ex:0.98,ey:0.70, cx:1.27,cy:-0.12, c2x:0.30,c2y:-0.07, mx:0.14,my:0.52, c3x:-0.19,c3y:1.09, c4x:0.75,c4y:1.09},
  ],

  // D — editor-tuned.
  D: [
    {x:0.06,y:0.25, ex:0.15,ey:1.00, cx:0.79,cy:-0.49, c2x:1.55,c2y:0.81},
    {x:0.05,y:0.95, ex:0.41,ey:0.15, cx:0.16,cy:0.70, c2x:0.22,c2y:0.52},
  ],

  // E — editor-tuned.
  E: [
    {x:0.86,y:0.26, ex:0.99,ey:0.73, cx:1.20,cy:-0.19, c2x:0.05,c2y:0.09, mx:0.54,my:0.46, c3x:-0.16,c3y:0.71, c4x:0.16,c4y:0.92, mx2:0.35,my2:0.99, c5x:0.60,c5y:0.97, c6x:0.80,c6y:0.90},
  ],

  // F — editor-tuned.
  F: [
    {x:0.51,y:0.10, ex:0.07,ey:0.96, cx:0.30,cy:0.37, c2x:0.18,c2y:0.65},
    {x:0.06,y:0.30, ex:0.95,ey:0.02, cx:0.08,cy:-0.10, c2x:0.79,c2y:0.13},
    {x:0.03,y:0.47, ex:0.65,ey:0.44, cx:0.64,cy:0.45, c2x:0.44,c2y:0.46},
  ],

  // G — editor-tuned.
  G: [
    {x:0.86,y:0.32, ex:0.86,ey:0.68, cx:1.33,cy:-0.15, c2x:0.12,c2y:0.02, mx:0.10,my:0.53, c3x:-0.11,c3y:1.03, c4x:0.63,c4y:1.15},
    {x:0.54,y:0.52, ex:0.79,ey:0.96, cx:1.03,cy:0.55, c2x:0.80,c2y:0.80},
  ],

  // H — editor-tuned.
  H: [
    {x:0.11,y:0.23, ex:0.05,ey:0.95, cx:0.72,cy:-0.42, c2x:0.20,c2y:0.65},
    {x:0.95,y:-0.01, ex:0.64,ey:0.96, cx:0.80,cy:0.33, c2x:0.72,c2y:0.63},
    {x:0.10,y:0.48, ex:0.92,ey:0.45, cx:0.40,cy:0.47, c2x:0.64,c2y:0.45},
  ],

  // I — editor-tuned.
  I: [
    {x:0.25,y:0.04, ex:0.96,ey:0.05, cx:0.48,cy:0.04, c2x:0.65,c2y:0.04},
    {x:0.60,y:0.07, ex:0.35,ey:0.94, cx:0.50,cy:0.37, c2x:0.45,c2y:0.63},
    {x:0.02,y:0.97, ex:0.69,ey:0.94, cx:0.34,cy:0.95, c2x:0.50,c2y:0.94},
  ],

  // J — editor-tuned.
  J: [
    {x:0.31,y:0.04, ex:0.98,ey:0.04, cx:0.56,cy:0.03, c2x:0.77,c2y:0.04},
    {x:0.66,y:0.07, ex:0.12,ey:0.65, cx:0.80,cy:0.74, c2x:-0.09,c2y:1.37},
  ],

  // K — editor-tuned.
  K: [
    {x:0.15,y:0.20, ex:0.06,ey:0.94, cx:0.77,cy:-0.34, c2x:0.20,c2y:0.65},
    {x:0.99,y:0.06, ex:0.42,ey:0.44, cx:0.75,cy:0.26, c2x:0.58,c2y:0.35},
    {x:0.28,y:0.50, ex:0.82,ey:0.96, cx:0.46,cy:0.65, c2x:0.64,c2y:0.81},
  ],

  // L — editor-tuned.
  L: [
    {x:0.38,y:0.21, ex:0.85,ey:0.96, cx:0.59,cy:0.73, c2x:1.37,c2y:-0.13, mx:0.72,my:0.06, c3x:0.27,c3y:0.67, c4x:0.59,c4y:0.83, mx2:0.10,my2:0.96, c5x:-0.28,c5y:0.65, c6x:0.65,c6y:0.96},
  ],

  // M — editor-tuned.
  M: [
    {x:0.46,y:0.12, ex:0.04,ey:0.99, cx:0.29,cy:0.49, c2x:0.15,c2y:0.68},
    {x:0.19,y:0.25, ex:0.49,ey:0.84, cx:0.41,cy:-0.23, c2x:0.58,c2y:0.18},
    {x:0.55,y:0.74, ex:0.94,ey:0.06, cx:0.63,cy:0.56, c2x:0.79,c2y:0.27},
    {x:0.91,y:0.16, ex:0.80,ey:0.97, cx:0.83,cy:0.49, c2x:0.79,c2y:0.69},
  ],

  // N — editor-tuned.
  N: [
    {x:0.39,y:0.18, ex:0.04,ey:0.97, cx:0.28,cy:0.37, c2x:0.18,c2y:0.65},
    {x:0.12,y:0.24, ex:0.63,ey:0.96, cx:0.46,cy:-0.42, c2x:0.49,c2y:0.68},
    {x:0.66,y:0.84, ex:1.00,ey:0.02, cx:0.76,cy:0.50, c2x:0.88,c2y:0.10},
  ],

  // O — editor-tuned.
  O: [
    {x:0.81,y:0.02, ex:0.60,ey:0.31, cx:0.45,cy:-0.04, c2x:-0.19,c2y:0.62, mx:0.16,my:0.93, c3x:1.08,c3y:1.26, c4x:1.24,c4y:-0.51},
  ],

  // P — editor-tuned.
  P: [
    {x:0.47,y:0.12, ex:0.07,ey:0.93, cx:0.31,cy:0.36, c2x:0.20,c2y:0.65},
    {x:0.26,y:0.06, ex:0.35,ey:0.52, cx:0.98,cy:-0.13, c2x:1.30,c2y:0.46},
  ],

  // Q — editor-tuned.
  Q: [
    {x:0.06,y:0.73, ex:0.81,ey:0.99, cx:0.13,cy:-0.30, c2x:1.64,c2y:-0.18, mx:0.55,my:0.92, c3x:0.03,c3y:0.97, c4x:0.05,c4y:0.55},
  ],

  // R — editor-tuned.
  R: [
    {x:0.44,y:0.12, ex:0.08,ey:0.92, cx:0.32,cy:0.35, c2x:0.17,c2y:0.61},
    {x:0.20,y:0.07, ex:0.39,ey:0.47, cx:1.07,cy:-0.13, c2x:1.25,c2y:0.46},
    {x:0.38,y:0.54, ex:0.82,ey:0.96, cx:0.46,cy:0.69, c2x:0.62,c2y:0.85},
  ],

  // S — editor-tuned.
  S: [
    {x:0.85,y:0.34, ex:0.10,ey:0.66, cx:1.21,cy:-0.38, c2x:-0.27,c2y:0.32, mx:0.50,my:0.50, c3x:1.65,c3y:0.82, c4x:-0.04,c4y:1.31},
  ],

  // T — editor-tuned.
  T: [
    {x:0.46,y:0.13, ex:0.13,ey:0.98, cx:0.40,cy:0.31, c2x:0.26,c2y:0.63},
    {x:0.06,y:0.04, ex:0.94,ey:0.04, cx:0.35,cy:0.04, c2x:0.65,c2y:0.04},
  ],

  // U — editor-tuned.
  U: [
    {x:0.03,y:0.24, ex:0.78,ey:1.00, cx:0.19,cy:-0.09, c2x:0.61,c2y:-0.10, mx:0.17,my:0.82, c3x:0.30,c3y:1.10, c4x:0.65,c4y:1.01, mx2:0.91,my2:0.06, c5x:0.68,c5y:0.79, c6x:0.62,c6y:0.87},
  ],

  // V — editor-tuned.
  V: [
    {x:0.04,y:0.27, ex:0.93,ey:0.07, cx:0.12,cy:-0.12, c2x:0.74,c2y:-0.06, mx:0.19,my:0.96, c3x:0.76,c3y:1.01, c4x:0.94,c4y:0.21, mx2:0.87,my2:0.41, c5x:0.93,c5y:0.29, c6x:0.96,c6y:0.11},
  ],

  // W — editor-tuned.
  W: [
    {x:0.02,y:0.29, ex:0.94,ey:0.09, cx:0.36,cy:-0.46, c2x:0.31,c2y:0.74, mx:0.14,my:0.93, c3x:0.36,c3y:1.10, c4x:0.48,c4y:0.52, mx2:0.60,my2:0.44, c5x:0.28,c5y:1.35, c6x:0.66,c6y:0.92, mx3:0.82,my3:0.68, c7x:0.88,c7y:0.53, c8x:0.96,c8y:0.33},
  ],

  // X — editor-tuned.
  X: [
    {x:0.14,y:0.24, ex:1.01,ey:0.68, cx:0.76,cy:-0.60, c2x:0.19,c2y:1.74},
    {x:0.94,y:0.05, ex:0.02,ey:0.99, cx:0.69,cy:0.36, c2x:0.37,c2y:0.65},
  ],

  // Y — editor-tuned.
  Y: [
    {x:0.05,y:0.24, ex:0.78,ey:0.35, cx:0.27,cy:-0.19, c2x:0.48,c2y:0.12, mx:0.27,my:0.43, c3x:0.31,c3y:0.74, c4x:0.61,c4y:0.59},
    {x:0.95,y:0.05, ex:0.15,ey:0.85, cx:0.76,cy:0.21, c2x:0.69,c2y:1.38},
  ],

  // Z — editor-tuned.
  Z: [
    {x:0.19,y:0.19, ex:0.96,ey:0.10, cx:0.33,cy:-0.06, c2x:0.68,c2y:0.07},
    {x:0.82,y:0.12, ex:0.76,ey:0.95, cx:0.36,cy:1.50, c2x:-0.75,c2y:0.52},
    {x:0.46,y:0.47, ex:0.89,ey:0.45, cx:0.83,cy:0.46, c2x:0.75,c2y:0.46},
  ],
};

// ─── Serif lowercase + uppercase (Playfair Display, Lora) ────────────────────
// Serif stroke ORDER is identical to sans-serif Nunito.
// Fine-tune entry positions with the Edit Arrows tool after initial use:
//   - Round letters (c, e, o, a, d, g, q): entry shifts toward 11–12 o'clock
//     for calligraphic pen angle (currently inherits 1 o'clock from Nunito).
//   - Diagonal terminals (v, w, x, y): endpoints inward ~0.04 for serif clearance.

const SERIF_LOWER: FontStrokeMap = {
  ...NUNITO_LOWER,
  // Overrides to add after Edit Arrows tuning: c, e, o, a, d, g, q entries.
};

const SERIF_UPPER: FontStrokeMap = {
  ...NUNITO_UPPER,
  // Overrides to add after Edit Arrows tuning: C, G, O, Q, S entries.
};

// ─── Patrick Hand lowercase ───────────────────────────────────────────────────
// Patrick Hand uses a single-story 'a' and 'g' (same letterforms as ABeeZee).
// All other letters share Nunito stroke data.

const PATRICK_HAND_LOWER: FontStrokeMap = {
  ...NUNITO_LOWER,

  // a — single-story: same CCW oval + right stem as ABeeZee (not double-story Nunito).
  a: [
    {x:0.78,y:0.18, ex:0.82,ey:0.86,
     cx:0.50,cy:-0.14, c2x:-0.18,c2y:0.28,
     mx:0.14,my:0.80,
     c3x:0.14,c3y:1.04, c4x:0.68,c4y:1.06},
    {x:0.88,y:0.06, ex:0.88,ey:0.96},
  ],

  // g — single-story: same oval-in-x-height + descending hook as ABeeZee.
  g: [
    {x:0.80,y:0.06, ex:0.82,ey:0.48,
     cx:0.50,cy:-0.06, c2x:-0.18,c2y:0.18,
     mx:0.12,my:0.40,
     c3x:0.12,c3y:0.58, c4x:0.66,c4y:0.60},
    {x:0.88,y:0.04, ex:0.34,ey:0.96, cx:0.88,cy:0.68, c2x:0.20,c2y:1.02},
  ],
};

// ─── Pacifico (brush script) ──────────────────────────────────────────────────
// Pacifico is a connected brush-display font. Stroke counts mirror Nunito/cursive —
// the data structure caps at 2 bezier segments, so full oval+stem cannot merge to 1 stroke.
// Key overrides vs. Nunito print: h/n as 1-stroke upswing+arch (via CURSIVE_LOWER),
// m as 2 continuous arches. All others seed from Nunito/cursive; tune with Edit Arrows.

const PACIFICO_LOWER: FontStrokeMap = {
  ...CURSIVE_LOWER,   // inherits 1-stroke h, 1-stroke n, 2-stroke m
  // Add Pacifico-specific overrides after Edit Arrows tuning.
};

const PACIFICO_UPPER: FontStrokeMap = {
  ...NUNITO_UPPER,
  // Add Pacifico-specific uppercase overrides after Edit Arrows tuning.
};

// ─── Per-font stroke maps ──────────────────────────────────────────────────────
// Fonts without their own entry fall back to Nunito (print baseline) via getStrokes().
// Populate each font's entry using the handwriter-stroke-auditor agent.

export const UPPER_STROKES: Record<string, FontStrokeMap> = {
  'Nunito':                        NUNITO_UPPER,
  'Edu AU VIC WA NT Guides':       NUNITO_UPPER, // manuscript/print — Nunito data is appropriate
  'Roboto Mono':                   NUNITO_UPPER, // monospace print
  'ABeeZee':                       ABEEZEE_UPPER, // beginner print — corrected A crossbar
  'Fredoka':                       NUNITO_UPPER, // rounded display — print conventions
  // Fonts below need per-font audit and population:
  'Playfair Display':              SERIF_UPPER,   // serif — same stroke order as Nunito; tune entry positions
  'Lora':                          SERIF_UPPER,   // calligraphic serif — same seed as Playfair
  'Dancing Script':                CURSIVE_UPPER, // cursive — editable cubics, tune with Edit Arrows
  'Caveat':                        CURSIVE_UPPER, // cursive handwriting — same seed as Dancing Script
  'Patrick Hand':                  NUNITO_UPPER,  // script — print uppercase conventions
  'Indie Flower':                  NUNITO_UPPER,  // casual handwriting — print uppercase conventions
  'Pacifico':                      PACIFICO_UPPER, // brush script — seed from Nunito; tune with Edit Arrows
};

export const LOWER_STROKES: Record<string, FontStrokeMap> = {
  'Nunito':                        NUNITO_LOWER,
  'Edu AU VIC WA NT Guides':       NUNITO_LOWER,
  'Roboto Mono':                   NUNITO_LOWER,
  'ABeeZee':                       ABEEZEE_LOWER,
  'Fredoka':                       NUNITO_LOWER,
  'Playfair Display':              SERIF_LOWER,   // serif — tune entry positions via Edit Arrows
  'Lora':                          SERIF_LOWER,   // calligraphic serif — same seed as Playfair
  'Dancing Script':                CURSIVE_LOWER, // 1-stroke h/n, 2-stroke m; rest from Nunito
  'Caveat':                        CURSIVE_LOWER, // same cursive conventions as Dancing Script
  'Patrick Hand':                  PATRICK_HAND_LOWER, // single-story a/g; rest from Nunito
  'Indie Flower':                  NUNITO_LOWER,       // casual print — Nunito data is appropriate
  'Pacifico':                      PACIFICO_LOWER, // brush script — seed from cursive; tune with Edit Arrows
};

// ─── Lookup helper ─────────────────────────────────────────────────────────────

/**
 * Returns stroke data for a given font, case, and letter.
 * Falls back to Nunito (print baseline) when the font has no entry for that letter.
 */
export function getStrokes(fontFamily: string, caseType: 'upper' | 'lower', letter: string): StrokeStart[] {
  const map = caseType === 'upper' ? UPPER_STROKES : LOWER_STROKES;
  return map[fontFamily]?.[letter]
    ?? map['Nunito']?.[letter]
    ?? [];
}
