export type LetterCase = 'upper' | 'lower';

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  t: number;  // ms timestamp (e.timeStamp)
}

export interface Stroke {
  points: StrokePoint[];
  width: number;
  color: string;
}

export interface LetterScore {
  letter: string;
  caseType: LetterCase;
  fontFamily: string;
  accuracy: number;          // mean soft-field value under user pixels — rewards tracing stroke centres
  coverage: number;          // fraction of guide area touched — ensures all strokes attempted
  strokeOrderScore: number;  // fraction of strokes drawn in correct calligraphic sequence (0–100)
  smoothnessScore: number;   // fluency — penalises direction reversals per stroke (0–100)
  slantScore: number;        // consistency of stroke angle across the letter (0–100)
  overall: number;
  grade: string;
  strokeCount: number;       // number of strokes the user drew
  expectedStrokes: number;   // expected stroke count for this letter (0 = unknown)
  attempts: number;          // cumulative number of times this letter has been scored
  timestamp: number;
}

export interface WeightLevel {
  name: string;
  strokeWidth: number;
  guideStrokeWidth: number; // paired guide width — calibrated so Regular (36/10) is visually matched
}

// Steps of ~7-9 units — smooth ramp with Regular near the font's natural weight (0).
export const WEIGHT_LEVELS: WeightLevel[] = [
  { name: 'Thinnest', strokeWidth:  6, guideStrokeWidth: -22 },
  { name: 'Thinner',  strokeWidth: 12, guideStrokeWidth: -15 },
  { name: 'Thin',     strokeWidth: 24, guideStrokeWidth:  -7 },
  { name: 'Regular',  strokeWidth: 36, guideStrokeWidth:   2 },
  { name: 'Bold',     strokeWidth: 48, guideStrokeWidth:  14 },
  { name: 'Bolder',   strokeWidth: 60, guideStrokeWidth:  28 },
  { name: 'Boldest',  strokeWidth: 72, guideStrokeWidth:  42 },
];

// Cursive: anchored so Regular guide ≈ pen Regular (5% canvas). All levels positive.
export const CURSIVE_WEIGHT_LEVELS: WeightLevel[] = [
  { name: 'Thinnest', strokeWidth:  8, guideStrokeWidth:   4 },
  { name: 'Thinner',  strokeWidth: 16, guideStrokeWidth:   7 },
  { name: 'Thin',     strokeWidth: 24, guideStrokeWidth:  10 },
  { name: 'Regular',  strokeWidth: 30, guideStrokeWidth:  13 },
  { name: 'Bold',     strokeWidth: 38, guideStrokeWidth:  19 },
  { name: 'Bolder',   strokeWidth: 46, guideStrokeWidth:  27 },
  { name: 'Boldest',  strokeWidth: 54, guideStrokeWidth:  36 },
];

export function getWeightLevels(category: string): WeightLevel[] {
  return category === 'cursive' ? CURSIVE_WEIGHT_LEVELS : WEIGHT_LEVELS;
}

export interface ToolbarSettings {
  strokeWeight: number;      // index into WEIGHT_LEVELS (0–6) — controls guide letter weight only
  penWidth: number;          // % of min(canvas.w, canvas.h) — scales with guide letter
  guideStrokeWidth: number;  // px — derived from strokeWeight, controls guide letter appearance
  guideOpacity: number;
  font: FontOption;
  showStrokeNumbers: boolean;
}

export interface FontOption {
  name: string;
  family: string;
  category: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { name: "Children's Print (ABeeZee)", family: 'ABeeZee', category: 'beginner' },
  { name: 'Cursive (Dancing Script)', family: 'Dancing Script', category: 'cursive' },
];

export function getAccuracyWord(s: number) {
  if (s >= 85) return 'Precise';
  if (s >= 70) return 'On Track';
  if (s >= 50) return 'Close';
  if (s >= 35) return 'Off Path';
  return 'Way Off';
}

export function getCoverageWord(s: number) {
  if (s >= 85) return 'Complete';
  if (s >= 70) return 'Thorough';
  if (s >= 50) return 'Partial';
  if (s >= 35) return 'Sparse';
  return 'Missing';
}

export function getSmoothnessWord(s: number) {
  if (s >= 85) return 'Fluid';
  if (s >= 70) return 'Steady';
  if (s >= 50) return 'Uneven';
  if (s >= 35) return 'Shaky';
  return 'Very Shaky';
}

export function getShortRating(s: number) {
  if (s >= 85) return 'Great';
  if (s >= 70) return 'Good';
  if (s >= 50) return 'Okay';
  if (s >= 35) return 'Fair';
  return 'Try';
}

export function getGrade(score: number): string {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 52) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

export interface ScoreDisplay {
  word: string;
  textClass: string;
  bgClass: string;
}

const SCORE_DISPLAY: Record<string, ScoreDisplay> = {
  A: { word: 'Excellent',         textClass: 'text-blue-500',   bgClass: 'bg-blue-400 text-white'   },
  B: { word: 'Well Done',         textClass: 'text-green-500',  bgClass: 'bg-green-400 text-white'  },
  C: { word: 'Decent',            textClass: 'text-yellow-500', bgClass: 'bg-yellow-400 text-white' },
  D: { word: 'Fair',              textClass: 'text-orange-500', bgClass: 'bg-orange-400 text-white' },
  F: { word: 'Needs Improvement', textClass: 'text-red-500',    bgClass: 'bg-red-400 text-white'    },
};

export function getScoreDisplay(grade: string): ScoreDisplay {
  return SCORE_DISPLAY[grade] ?? SCORE_DISPLAY['F'];
}

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
