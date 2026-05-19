import { useCallback, useRef, useState } from 'react';
import type { Stroke, StrokePoint } from '../types';

const DWELL_SPEED_PX_MS  = 0.15; // px/ms — below this counts as dwelling
const DWELL_RAMP_MS      = 1200; // ms to reach full dwell boost
const DWELL_DECAY_MULT   = 3;    // fades out 3× faster than it builds
const FAST_THRESHOLD_PX_MS = 0.7; // px/ms — full speed-thinning kicks in here

function lineWidthFor(
  baseWidth: number,
  pressure: number,
  speed: number,
  dwellBoost: number,
  maxSpeedThin: number,
): number {
  const speedThin = maxSpeedThin * Math.min(1, speed / FAST_THRESHOLD_PX_MS);
  return Math.max(1, baseWidth * (0.5 + pressure + dwellBoost - speedThin));
}

export function useDrawing(strokeWidth: number, maxDwellBoost: number, maxSpeedThin: number) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStroke   = useRef<Stroke | null>(null);
  const isDrawing       = useRef(false);
  const maxDwellRef     = useRef(maxDwellBoost);
  const maxSpeedThinRef = useRef(maxSpeedThin);
  maxDwellRef.current     = maxDwellBoost;
  maxSpeedThinRef.current = maxSpeedThin;
  const dwellTimeRef = useRef(0);

  const getPoint = useCallback((e: PointerEvent, canvas: HTMLCanvasElement): StrokePoint => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
      t: e.timeStamp,
    };
  }, []);

  const startStroke = useCallback(
    (e: PointerEvent, canvas: HTMLCanvasElement) => {
      isDrawing.current  = true;
      dwellTimeRef.current = 0;
      const point = getPoint(e, canvas);
      currentStroke.current = { points: [point], width: strokeWidth, color: '#1e3a5f' };
    },
    [getPoint, strokeWidth]
  );

  const addPoint = useCallback(
    (e: PointerEvent, canvas: HTMLCanvasElement) => {
      if (!isDrawing.current || !currentStroke.current) return;
      const point = getPoint(e, canvas);
      currentStroke.current.points.push(point);

      const ctx    = canvas.getContext('2d')!;
      const pts    = currentStroke.current.points;
      const stroke = currentStroke.current;
      if (pts.length < 2) return;

      const prev = pts[pts.length - 2];
      const curr = pts[pts.length - 1];

      const dt    = Math.max(1, curr.t - prev.t);
      const dist  = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
      const speed = dist / dt;

      if (speed < DWELL_SPEED_PX_MS) {
        dwellTimeRef.current = Math.min(DWELL_RAMP_MS, dwellTimeRef.current + dt);
      } else {
        dwellTimeRef.current = Math.max(0, dwellTimeRef.current - dt * DWELL_DECAY_MULT);
      }
      const dwellBoost = maxDwellRef.current * (dwellTimeRef.current / DWELL_RAMP_MS);

      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.lineWidth   = lineWidthFor(stroke.width, curr.pressure, speed, dwellBoost, maxSpeedThinRef.current);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.stroke();
      ctx.restore();
    },
    [getPoint]
  );

  const endStroke = useCallback(() => {
    if (!isDrawing.current || !currentStroke.current) return;
    isDrawing.current = false;
    if (currentStroke.current.points.length > 0)
      setStrokes((prev) => [...prev, currentStroke.current!]);
    currentStroke.current = null;
  }, []);

  const clearCanvas = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setStrokes([]);
    currentStroke.current = null;
    isDrawing.current     = false;
  }, []);

  const undoLastStroke = useCallback((canvas: HTMLCanvasElement) => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      redrawStrokes(canvas, next, maxDwellRef.current, maxSpeedThinRef.current);
      return next;
    });
  }, []);

  return { strokes, startStroke, addPoint, endStroke, clearCanvas, undoLastStroke };
}

export function redrawStrokes(
  canvas: HTMLCanvasElement,
  strokes: Stroke[],
  maxDwellBoost  = 0.4,
  maxSpeedThin   = 0.3,
) {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const stroke of strokes) {
    const pts = stroke.points;
    if (pts.length === 0) continue;
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    for (let i = 1; i < pts.length; i++) {
      const prev  = pts[i - 1];
      const curr  = pts[i];
      const dt    = Math.max(1, curr.t - prev.t);
      const dist  = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
      const speed = dist / dt;
      // Approximate dwell from speed for redraw (no accumulated state available)
      const dwellBoost = maxDwellBoost * Math.max(0, 1 - speed / DWELL_SPEED_PX_MS);
      ctx.lineWidth = lineWidthFor(stroke.width, curr.pressure, speed, dwellBoost, maxSpeedThin);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}
