import { getGrade } from '../types';
import type { FontOption, LetterScore, LetterCase } from '../types';
import type { Stroke } from '../types';
import { getStrokes } from '../data/strokeData';

function drawGuide(
  ctx: CanvasRenderingContext2D,
  letter: string,
  caseType: LetterCase,
  font: FontOption,
  guideStrokeWidth: number,
  guideFontSize: number,
  offsetX: number,
  offsetY: number
) {
  const displayLetter = caseType === 'upper' ? letter.toUpperCase() : letter.toLowerCase();
  ctx.font = `${guideFontSize}px "${font.family}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (guideStrokeWidth > 0) {
    ctx.strokeStyle = 'black';
    ctx.lineWidth = guideStrokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeText(displayLetter, offsetX, offsetY);
  }
  ctx.fillStyle = 'black';
  ctx.fillText(displayLetter, offsetX, offsetY);
  if (guideStrokeWidth < 0) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = Math.abs(guideStrokeWidth);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeText(displayLetter, offsetX, offsetY);
    ctx.globalCompositeOperation = 'source-over';
  }
}

function makeOffscreen(width: number, height: number) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

// Build a soft distance field by Gaussian-blurring the guide letter.
// Pixels at stroke centers score near 1.0; pixels far from any stroke score near 0.
function buildSoftField(
  guideCanvas: HTMLCanvasElement,
  blurRadius: number
): { data: Uint8ClampedArray; max: number } {
  const w = guideCanvas.width;
  const h = guideCanvas.height;
  const blurCanvas = makeOffscreen(w, h);
  const ctx = blurCanvas.getContext('2d', { willReadFrequently: true })!;
  ctx.filter = `blur(${blurRadius}px)`;
  ctx.drawImage(guideCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);

  let max = 1;
  for (let i = 3; i < imageData.data.length; i += 4) {
    if (imageData.data[i] > max) max = imageData.data[i];
  }

  return { data: imageData.data, max };
}

// ─── Stroke order ─────────────────────────────────────────────────────────────

// @ts-ignore — stroke-order scoring, wired up in a future scoring update
function _scoreStrokeOrder(
  strokes: Stroke[],
  font: FontOption,
  caseType: LetterCase,
  letter: string,
  guideFontSize: number,
  offsetX: number,
  offsetY: number
): number {
  const displayLetter = caseType === 'upper' ? letter.toUpperCase() : letter.toLowerCase();
  const expected = getStrokes(font.family, caseType, displayLetter);
  if (expected.length === 0 || strokes.length === 0) return 100; // no data — no penalty

  // Measure bounding box of guide letter to convert normalised coords → canvas px
  const offscreen = makeOffscreen(1, 1);
  const ctx = offscreen.getContext('2d')!;
  ctx.font = `${guideFontSize}px "${font.family}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const m = ctx.measureText(displayLetter);
  const boxLeft  = offsetX - m.actualBoundingBoxLeft;
  const boxTop   = offsetY - m.actualBoundingBoxAscent;
  const boxW     = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const boxH     = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;

  // Convert expected stroke starts to canvas pixels
  const expectedPx = expected.map(s => ({
    x: boxLeft + s.x * boxW,
    y: boxTop  + s.y * boxH,
  }));

  // For each user stroke, find the nearest expected stroke (nearest-neighbour)
  const userStarts = strokes.map(s => s.points[0] ?? { x: 0, y: 0 });
  const assignment: number[] = userStarts.map(u => {
    let best = 0;
    let bestDist = Infinity;
    expectedPx.forEach((e, i) => {
      const d = (u.x - e.x) ** 2 + (u.y - e.y) ** 2;
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  });

  // Count strokes whose assigned expected index follows the correct rank order
  const n = Math.min(strokes.length, expected.length);
  let correct = 0;
  for (let i = 0; i < n; i++) {
    if (assignment[i] === i) correct++;
  }

  return Math.round((correct / n) * 100);
}

// ─── Smoothness ───────────────────────────────────────────────────────────────

// Resample stroke to fixed spatial intervals so wobble rate is independent of
// pointer-event frequency (touch devices fire 60+ events/sec, inflating point count).
function resampleStroke(pts: Stroke['points'], stepPx: number): Stroke['points'] {
  if (pts.length < 2) return pts;
  const out: Stroke['points'] = [pts[0]];
  let carried = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    carried += Math.sqrt(dx * dx + dy * dy);
    if (carried >= stepPx) {
      out.push(pts[i]);
      carried = 0;
    }
  }
  if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
  return out;
}

function scoreSmoothnessAll(strokes: Stroke[]): number {
  if (strokes.length === 0) return 100;
  const STEP_PX  = 20;                        // sample every 20 canvas px
  const WOBBLE   = 30 * (Math.PI / 180);      // 30° direction change = wobble

  const perStroke = strokes.map(stroke => {
    const pts = resampleStroke(stroke.points, STEP_PX);
    if (pts.length < 3) return 1;
    let wobbles = 0;
    let prevAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    for (let i = 2; i < pts.length; i++) {
      const angle = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
      let diff = Math.abs(angle - prevAngle);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff > WOBBLE) wobbles++;
      prevAngle = angle;
    }
    return 1 - Math.min(wobbles / (pts.length - 2), 1);
  });

  const avg = perStroke.reduce((a, b) => a + b, 0) / perStroke.length;
  return Math.round(avg * 100);
}

// ─── Main scoring function ────────────────────────────────────────────────────

export function scoreAttempt(
  userCanvas: HTMLCanvasElement,
  letter: string,
  caseType: LetterCase,
  font: FontOption,
  guideStrokeWidth: number,
  guideFontSize: number,
  offsetX: number,
  offsetY: number,
  strokes: Stroke[] = [],
  strokeCount: number = 0,
  expectedStrokes: number = 0
): LetterScore {
  const w = userCanvas.width;
  const h = userCanvas.height;

  // Hard guide — for coverage calculation
  const guideCanvas = makeOffscreen(w, h);
  const guideCtx = guideCanvas.getContext('2d', { willReadFrequently: true })!;
  guideCtx.clearRect(0, 0, w, h);
  drawGuide(guideCtx, letter, caseType, font, guideStrokeWidth, guideFontSize, offsetX, offsetY);
  const guideData = guideCtx.getImageData(0, 0, w, h).data;

  // Soft field — 6% blur gives a more forgiving tolerance zone
  const blurRadius = Math.max(4, guideFontSize * 0.06);
  const { data: softData, max: softMax } = buildSoftField(guideCanvas, blurRadius);

  const userCtx = userCanvas.getContext('2d', { willReadFrequently: true })!;
  const userData = userCtx.getImageData(0, 0, w, h).data;

  let guidePixels = 0;
  let userPixels = 0;
  let overlap = 0;
  let accuracySum = 0;

  for (let i = 0; i < guideData.length; i += 4) {
    const isGuide = guideData[i + 3] > 30;
    const isUser  = userData[i + 3]  > 30;

    if (isGuide) guidePixels++;
    if (isUser) {
      userPixels++;
      accuracySum += softData[i + 3] / softMax;
    }
    if (isGuide && isUser) overlap++;
  }

  // insideFraction: what portion of drawn pixels landed within the guide.
  // Softened with sqrt so minor outside strokes don't collapse the score.
  const insideFraction = userPixels > 0 ? overlap / userPixels : 0;
  const rawAccuracy    = userPixels > 0 ? accuracySum / userPixels : 0;
  const accuracy = rawAccuracy * Math.sqrt(insideFraction) * 100;
  const coverage = guidePixels > 0 ? (overlap / guidePixels) * 100 : 0;

  const smoothnessScore  = scoreSmoothnessAll(strokes);
  const slantScore       = 0;

  const anyFailing = [accuracy, coverage].some(s => s < 25);

  const overall = anyFailing ? 0 : (
    0.50 * accuracy +
    0.40 * coverage +
    0.10 * smoothnessScore
  );

  return {
    letter,
    caseType,
    fontFamily:       font.family,
    accuracy:         Math.round(accuracy         * 10) / 10,
    coverage:         Math.round(coverage         * 10) / 10,
    strokeOrderScore: 0,
    smoothnessScore:  Math.round(smoothnessScore  * 10) / 10,
    slantScore:       Math.round(slantScore       * 10) / 10,
    overall:          Math.round(overall          * 10) / 10,
    grade:            getGrade(overall),
    strokeCount,
    expectedStrokes,
    attempts:         1,
    timestamp:        Date.now(),
  };
}

export function buildOutsideMask(
  userCanvas: HTMLCanvasElement,
  letter: string,
  caseType: LetterCase,
  font: FontOption,
  guideStrokeWidth: number,
  guideFontSize: number,
  offsetX: number,
  offsetY: number
): ImageData {
  const w = userCanvas.width;
  const h = userCanvas.height;
  const offscreen = makeOffscreen(w, h);
  const ctx = offscreen.getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(0, 0, w, h);
  drawGuide(ctx, letter, caseType, font, guideStrokeWidth, guideFontSize, offsetX, offsetY);

  const guideData = ctx.getImageData(0, 0, w, h).data;
  const userCtx   = userCanvas.getContext('2d', { willReadFrequently: true })!;
  const userData  = userCtx.getImageData(0, 0, w, h).data;

  const maskData = new Uint8ClampedArray(guideData.length);

  for (let i = 0; i < guideData.length; i += 4) {
    const isGuide = guideData[i + 3] > 30;
    const isUser  = userData[i + 3]  > 30;

    if (!isGuide && isUser) {
      maskData[i] = 220; maskData[i + 1] = 50; maskData[i + 2] = 50; maskData[i + 3] = 180;
    } else if (isGuide && isUser) {
      maskData[i] = 60; maskData[i + 1] = 180; maskData[i + 2] = 60; maskData[i + 3] = 120;
    }
  }

  return new ImageData(maskData, w, h);
}

const STORAGE_KEY = 'handwriter_scores';

export function loadScores(): Record<string, LetterScore> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveScore(score: LetterScore): LetterScore {
  const all = loadScores();
  const key = `${score.fontFamily}_${score.caseType}_${score.letter}`;
  const prev = all[key];
  const attempts = (prev?.attempts ?? 0) + 1;

  // Running average: newAvg = (prevAvg × (n-1) + newValue) / n
  const runAvg = (prevVal: number, newVal: number) =>
    Math.round(((prevVal ?? 0) * (attempts - 1) + newVal) / attempts * 10) / 10;

  const avgOverall = prev ? runAvg(prev.overall, score.overall) : score.overall;

  const saved: LetterScore = {
    ...score,
    attempts,
    accuracy:         prev ? runAvg(prev.accuracy,         score.accuracy)         : score.accuracy,
    coverage:         prev ? runAvg(prev.coverage,         score.coverage)         : score.coverage,
    strokeOrderScore: prev ? runAvg(prev.strokeOrderScore, score.strokeOrderScore) : score.strokeOrderScore,
    smoothnessScore:  prev ? runAvg(prev.smoothnessScore,  score.smoothnessScore)  : score.smoothnessScore,
    slantScore:       prev ? runAvg(prev.slantScore,       score.slantScore)       : score.slantScore,
    overall:          avgOverall,
    grade:            getGrade(avgOverall),
  };

  all[key] = saved;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return saved;
}
