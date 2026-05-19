import { useCallback, useEffect, useRef, useState } from 'react';
import { getWeightLevels, getScoreDisplay, getAccuracyWord, getCoverageWord, getSmoothnessWord } from '../types';
import type { LetterCase, LetterScore, ToolbarSettings } from '../types';
import { useDrawing } from '../hooks/useDrawing';
import { buildOutsideMask, scoreAttempt } from '../utils/scoring';
import { playScoreSound } from '../utils/sounds';
import { getStrokes } from '../data/strokeData';
import type { StrokeStart } from '../data/strokeData';

function drawDiamond(ctx: CanvasRenderingContext2D, px: number, py: number, half: number) {
  ctx.beginPath();
  ctx.moveTo(px, py - half);
  ctx.lineTo(px + half, py);
  ctx.lineTo(px, py + half);
  ctx.lineTo(px - half, py);
  ctx.closePath();
}

function formatStrokeData(strokes: StrokeStart[]): string {
  return strokes.map(s => {
    const fields: string[] = [
      `x:${s.x.toFixed(2)},y:${s.y.toFixed(2)}`,
      `ex:${s.ex.toFixed(2)},ey:${s.ey.toFixed(2)}`,
    ];
    if (s.cx  !== undefined && s.cy  !== undefined) fields.push(`cx:${s.cx.toFixed(2)},cy:${s.cy.toFixed(2)}`);
    if (s.c2x !== undefined && s.c2y !== undefined) fields.push(`c2x:${s.c2x.toFixed(2)},c2y:${s.c2y.toFixed(2)}`);
    if (s.mx  !== undefined && s.my  !== undefined) fields.push(`mx:${s.mx.toFixed(2)},my:${s.my.toFixed(2)}`);
    if (s.c3x !== undefined && s.c3y !== undefined) fields.push(`c3x:${s.c3x.toFixed(2)},c3y:${s.c3y.toFixed(2)}`);
    if (s.c4x !== undefined && s.c4y !== undefined) fields.push(`c4x:${s.c4x.toFixed(2)},c4y:${s.c4y.toFixed(2)}`);
    if (s.mx2 !== undefined && s.my2 !== undefined) fields.push(`mx2:${s.mx2.toFixed(2)},my2:${s.my2.toFixed(2)}`);
    if (s.c5x !== undefined && s.c5y !== undefined) fields.push(`c5x:${s.c5x.toFixed(2)},c5y:${s.c5y.toFixed(2)}`);
    if (s.c6x !== undefined && s.c6y !== undefined) fields.push(`c6x:${s.c6x.toFixed(2)},c6y:${s.c6y.toFixed(2)}`);
    if (s.mx3 !== undefined && s.my3 !== undefined) fields.push(`mx3:${s.mx3.toFixed(2)},my3:${s.my3.toFixed(2)}`);
    if (s.c7x !== undefined && s.c7y !== undefined) fields.push(`c7x:${s.c7x.toFixed(2)},c7y:${s.c7y.toFixed(2)}`);
    if (s.c8x !== undefined && s.c8y !== undefined) fields.push(`c8x:${s.c8x.toFixed(2)},c8y:${s.c8y.toFixed(2)}`);
    return `  {${fields.join(', ')}}`;
  }).join(',\n');
}

interface Props {
  letter: string;
  caseType: LetterCase;
  settings: ToolbarSettings;
  onScore: (score: LetterScore) => void;
  onClear?: () => void;
  score?: LetterScore | null;
  onNext?: () => void;
}

const GUIDE_FONT_SIZE_RATIO = 0.72;

export function Canvas({ letter, caseType, settings, onScore, onClear, score, onNext }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guideCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const editCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bboxRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null);
  const dragRef = useRef<{ strokeIdx: number; field: 'start' | 'end' | 'cp1' | 'cp2' | 'mid' | 'cp3' | 'cp4' | 'mid2' | 'cp5' | 'cp6' | 'mid3' | 'cp7' | 'cp8' } | null>(null);
  const [size, setSize] = useState({ w: 600, h: 600 });
  const [showOverlay, setShowOverlay] = useState(false);
  const [arrowEditMode, setArrowEditMode] = useState(false);
  const [draftStrokes, setDraftStrokes] = useState<StrokeStart[] | null>(null);

  const weight = getWeightLevels(settings.font.category)[settings.strokeWeight];

  const guideFontSize = Math.min(size.w, size.h) * GUIDE_FONT_SIZE_RATIO;

  const isCursive = settings.font.category === 'cursive';
  // Cursive nibs are naturally thinner — scale down so Regular feels like a calligraphy pen
  const penScale = isCursive ? 0.6 : 1.0;
  // penWidth is stored as % of min canvas dimension so it scales with the guide letter
  const resolvedPenWidth = (settings.penWidth / 100) * Math.min(size.w, size.h) * penScale;
  // Cursive: dwell peaks at Regular (penWidth≤5) and fades toward Bold. Print stays subtle.
  const penWeightScale = Math.max(0.1, 1 - Math.max(0, settings.penWidth - 5) / 5);
  const maxDwellBoost  = isCursive ? 0.75 * penWeightScale : 0.15;
  // Fast strokes thin out — more dramatic in cursive (calligraphy), moderate in print
  const maxSpeedThin   = isCursive ? 0.5 : 0.25;

  const { strokes, startStroke, addPoint, endStroke, clearCanvas, undoLastStroke } = useDrawing(
    resolvedPenWidth,
    maxDwellBoost,
    maxSpeedThin
  );
  const guideX = size.w / 2;
  const guideY = size.h / 2;

  const expectedStrokes = getStrokes(settings.font.family, caseType, caseType === 'upper' ? letter.toUpperCase() : letter.toLowerCase()).length;

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.floor(rect.width), h: Math.floor(rect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Redraw guide canvas whenever relevant settings change
  useEffect(() => {
    const canvas = guideCanvasRef.current;
    if (!canvas) return;

    const draw = () => {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const displayLetter = caseType === 'upper' ? letter.toUpperCase() : letter.toLowerCase();
    ctx.font = `${guideFontSize}px "${settings.font.family}"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Positive: stroke expands outward, then fill on top (thicker)
    // Zero:     fill only (natural font weight)
    // Negative: fill first, then erase edges with destination-out stroke (thinner)
    if (settings.guideStrokeWidth > 0) {
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = settings.guideStrokeWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeText(displayLetter, guideX, guideY);
    }
    ctx.fillStyle = '#6366f1';
    ctx.fillText(displayLetter, guideX, guideY);
    if (settings.guideStrokeWidth < 0) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = Math.abs(settings.guideStrokeWidth);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeText(displayLetter, guideX, guideY);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Draw stroke order arrows and numbers
    if (settings.showStrokeNumbers) {
      const baseStrokeList = getStrokes(settings.font.family, caseType, caseType === 'upper' ? letter.toUpperCase() : letter.toLowerCase());
      const strokeList = (arrowEditMode && draftStrokes) ? draftStrokes : baseStrokeList;
      if (strokeList && strokeList.length > 0) {
        const m = ctx.measureText(displayLetter);
        const boxLeft   = guideX - m.actualBoundingBoxLeft;
        const boxTop    = guideY - m.actualBoundingBoxAscent;
        const boxWidth  = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
        const boxHeight = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
        bboxRef.current = { left: boxLeft, top: boxTop, width: boxWidth, height: boxHeight };

        const r = Math.max(13, guideFontSize * 0.055);
        const fontSize = Math.max(10, r * 1.15);

        // Compute circle centres, then push any overlapping pair apart so numbers stay legible.
        const circleCentres = strokeList.map(({ x, y }) => ({
          px: boxLeft + x * boxWidth,
          py: boxTop  + y * boxHeight,
        }));
        const minSep = r * 2 + 4;
        for (let i = 0; i < circleCentres.length; i++) {
          for (let j = i + 1; j < circleCentres.length; j++) {
            const dx = circleCentres[j].px - circleCentres[i].px;
            const dy = circleCentres[j].py - circleCentres[i].py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minSep) {
              if (dist < 0.5) {
                // Coincident — push j to the right
                circleCentres[j].px = circleCentres[i].px + minSep;
              } else {
                const scale = minSep / dist;
                circleCentres[j].px = circleCentres[i].px + dx * scale;
                circleCentres[j].py = circleCentres[i].py + dy * scale;
              }
            }
          }
        }

        // Pass 1: draw arrows (behind circles)
        ctx.lineCap  = 'round';
        ctx.lineJoin = 'round';
        const headLen = Math.max(8, r * 0.75);
        const dotDistSq = (r * 1.5) ** 2;

        strokeList.forEach((stroke, i) => {
          const { ex, ey, cx, cy } = stroke;
          const c2x = stroke.c2x, c2y = stroke.c2y;
          const hasMid   = stroke.mx !== undefined && stroke.my !== undefined;
          const hasCubic = cx !== undefined && c2x !== undefined && c2y !== undefined;
          const hasCurve = cx !== undefined && cy !== undefined;

          const sx  = circleCentres[i].px;
          const sy  = circleCentres[i].py;
          const epx = boxLeft + ex * boxWidth;
          const epy = boxTop  + ey * boxHeight;
          const dx = epx - sx;
          const dy = epy - sy;
          if (dx * dx + dy * dy < dotDistSq) return; // dot stroke — skip arrow

          const cpx  = hasCurve ? boxLeft + cx!  * boxWidth  : 0;
          const cpy  = hasCurve ? boxTop  + cy!  * boxHeight : 0;
          const cp2x = hasCubic ? boxLeft + c2x! * boxWidth  : 0;
          const cp2y = hasCubic ? boxTop  + c2y! * boxHeight : 0;

          // Compound bezier segments 2–4
          const hasMid2  = stroke.mx2 !== undefined && stroke.my2 !== undefined;
          const hasMid3  = stroke.mx3 !== undefined && stroke.my3 !== undefined;
          const midpx  = hasMid  ? boxLeft + stroke.mx!  * boxWidth  : 0;
          const midpy  = hasMid  ? boxTop  + stroke.my!  * boxHeight : 0;
          const cp3x   = hasMid  ? boxLeft + (stroke.c3x ?? stroke.mx!) * boxWidth  : 0;
          const cp3y   = hasMid  ? boxTop  + (stroke.c3y ?? stroke.my!) * boxHeight : 0;
          const mid2px = hasMid2 ? boxLeft + stroke.mx2! * boxWidth  : 0;
          const mid2py = hasMid2 ? boxTop  + stroke.my2! * boxHeight : 0;
          // CP4 arrives at mx2 (if exists) or mx3 isn't relevant here — at end otherwise
          const cp4x   = hasMid  ? boxLeft + (stroke.c4x ?? (hasMid2 ? stroke.mx2! : stroke.ex)) * boxWidth  : 0;
          const cp4y   = hasMid  ? boxTop  + (stroke.c4y ?? (hasMid2 ? stroke.my2! : stroke.ey)) * boxHeight : 0;
          // Third segment from mx2/my2 to mx3/my3 (or end)
          const mid3px = hasMid3 ? boxLeft + stroke.mx3! * boxWidth  : 0;
          const mid3py = hasMid3 ? boxTop  + stroke.my3! * boxHeight : 0;
          const cp5x   = hasMid2 ? boxLeft + (stroke.c5x ?? stroke.mx2!) * boxWidth  : 0;
          const cp5y   = hasMid2 ? boxTop  + (stroke.c5y ?? stroke.my2!) * boxHeight : 0;
          const cp6x   = hasMid2 ? boxLeft + (stroke.c6x ?? (hasMid3 ? stroke.mx3! : stroke.ex)) * boxWidth  : 0;
          const cp6y   = hasMid2 ? boxTop  + (stroke.c6y ?? (hasMid3 ? stroke.my3! : stroke.ey)) * boxHeight : 0;
          // Fourth segment from mx3/my3 to end
          const cp7x   = hasMid3 ? boxLeft + (stroke.c7x ?? stroke.mx3!) * boxWidth  : 0;
          const cp7y   = hasMid3 ? boxTop  + (stroke.c7y ?? stroke.my3!) * boxHeight : 0;
          const cp8x   = hasMid3 ? boxLeft + (stroke.c8x ?? stroke.ex)   * boxWidth  : 0;
          const cp8y   = hasMid3 ? boxTop  + (stroke.c8y ?? stroke.ey)   * boxHeight : 0;

          // Tangent at start: toward CP1. Tangent at end: from last CP → endpoint.
          const startAngle = hasCurve ? Math.atan2(cpy  - sy,   cpx  - sx)  : Math.atan2(dy, dx);
          const endAngle   = hasMid3  ? Math.atan2(epy  - cp8y, epx  - cp8x)
                           : hasMid2  ? Math.atan2(epy  - cp6y, epx  - cp6x)
                           : hasMid   ? Math.atan2(epy  - cp4y, epx  - cp4x)
                           : hasCubic ? Math.atan2(epy  - cp2y, epx  - cp2x)
                           : hasCurve ? Math.atan2(epy  - cpy,  epx  - cpx)  : Math.atan2(dy, dx);

          const lsx = sx + (r + 2) * Math.cos(startAngle);
          const lsy = sy + (r + 2) * Math.sin(startAngle);

          ctx.beginPath();
          ctx.moveTo(lsx, lsy);
          if (hasMid && hasCubic) {
            ctx.bezierCurveTo(cpx, cpy, cp2x, cp2y, midpx, midpy);
            if (hasMid2) {
              ctx.bezierCurveTo(cp3x, cp3y, cp4x, cp4y, mid2px, mid2py);
              if (hasMid3) {
                ctx.bezierCurveTo(cp5x, cp5y, cp6x, cp6y, mid3px, mid3py);
                ctx.bezierCurveTo(cp7x, cp7y, cp8x, cp8y, epx, epy);
              } else {
                ctx.bezierCurveTo(cp5x, cp5y, cp6x, cp6y, epx, epy);
              }
            } else {
              ctx.bezierCurveTo(cp3x, cp3y, cp4x, cp4y, epx, epy);
            }
          } else if (hasCubic) {
            ctx.bezierCurveTo(cpx, cpy, cp2x, cp2y, epx, epy);
          } else if (hasCurve) {
            ctx.quadraticCurveTo(cpx, cpy, epx, epy);
          } else {
            ctx.lineTo(epx, epy);
          }
          ctx.strokeStyle = 'rgba(249,115,22,0.50)';
          ctx.lineWidth = Math.max(1.5, r * 0.18);
          ctx.stroke();

          // Arrowhead
          ctx.beginPath();
          ctx.moveTo(epx, epy);
          ctx.lineTo(
            epx - headLen * Math.cos(endAngle - Math.PI / 5.5),
            epy - headLen * Math.sin(endAngle - Math.PI / 5.5)
          );
          ctx.moveTo(epx, epy);
          ctx.lineTo(
            epx - headLen * Math.cos(endAngle + Math.PI / 5.5),
            epy - headLen * Math.sin(endAngle + Math.PI / 5.5)
          );
          ctx.strokeStyle = 'rgba(249,115,22,0.72)';
          ctx.lineWidth = Math.max(1.5, r * 0.22);
          ctx.stroke();
        });

        // Pass 2: draw numbered circles (on top of arrows)
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const circleStrokeWidth = Math.max(1.5, r * 0.15);

        strokeList.forEach((_, i) => {
          const { px, py } = circleCentres[i];

          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.25)';
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = circleStrokeWidth;
          ctx.stroke();
          ctx.restore();

          ctx.fillStyle = '#f97316';
          ctx.fillText(String(i + 1), px, py);
        });

        // Restore guide font state
        ctx.font = `${guideFontSize}px "${settings.font.family}"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
      }
    }
    }; // end draw()

    document.fonts.load(`${guideFontSize}px "${settings.font.family}"`).then(draw);
  }, [letter, caseType, settings.font.family, settings.guideStrokeWidth, settings.showStrokeNumbers, size, arrowEditMode, draftStrokes]);

  // Edit canvas: draw drag handles whenever arrowEditMode or draftStrokes changes
  useEffect(() => {
    const canvas = editCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!arrowEditMode) return;
    const bbox = bboxRef.current;
    const strokes = draftStrokes;
    if (!bbox || !strokes) return;

    const { left, top, width, height } = bbox;
    const toScreen = (nx: number, ny: number) => ({
      px: left + nx * width,
      py: top  + ny * height,
    });

    const half = 8; // diamond half-size
    const r = 9;    // circle radius for start/end

    strokes.forEach((stroke, i) => {
      const start  = toScreen(stroke.x,   stroke.y);
      const end    = toScreen(stroke.ex,  stroke.ey);
      const hasMid  = stroke.mx  !== undefined && stroke.my  !== undefined;
      const hasMid2 = stroke.mx2 !== undefined && stroke.my2 !== undefined;
      const hasMid3 = stroke.mx3 !== undefined && stroke.my3 !== undefined;
      const hasCP1  = stroke.cx  !== undefined && stroke.cy  !== undefined;
      const hasCP2  = stroke.c2x !== undefined && stroke.c2y !== undefined;
      const hasCP3  = stroke.c3x !== undefined && stroke.c3y !== undefined;
      const hasCP4  = stroke.c4x !== undefined && stroke.c4y !== undefined;
      const hasCP5  = stroke.c5x !== undefined && stroke.c5y !== undefined;
      const hasCP6  = stroke.c6x !== undefined && stroke.c6y !== undefined;
      const hasCP7  = stroke.c7x !== undefined && stroke.c7y !== undefined;
      const hasCP8  = stroke.c8x !== undefined && stroke.c8y !== undefined;
      const cp1  = hasCP1  ? toScreen(stroke.cx!,  stroke.cy!)  : null;
      const cp2  = hasCP2  ? toScreen(stroke.c2x!, stroke.c2y!) : null;
      const mid  = hasMid  ? toScreen(stroke.mx!,  stroke.my!)  : null;
      const cp3  = hasCP3  ? toScreen(stroke.c3x!, stroke.c3y!) : null;
      const cp4  = hasCP4  ? toScreen(stroke.c4x!, stroke.c4y!) : null;
      const mid2 = hasMid2 ? toScreen(stroke.mx2!, stroke.my2!) : null;
      const cp5  = hasCP5  ? toScreen(stroke.c5x!, stroke.c5y!) : null;
      const cp6  = hasCP6  ? toScreen(stroke.c6x!, stroke.c6y!) : null;
      const mid3 = hasMid3 ? toScreen(stroke.mx3!, stroke.my3!) : null;
      const cp7  = hasCP7  ? toScreen(stroke.c7x!, stroke.c7y!) : null;
      const cp8  = hasCP8  ? toScreen(stroke.c8x!, stroke.c8y!) : null;

      // Dashed leader lines
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(100,100,100,0.5)';
      ctx.lineWidth = 1;
      const anchor2 = hasMid  && mid  ? mid  : end;
      const anchor4 = hasMid2 && mid2 ? mid2 : end;
      const anchor6 = hasMid3 && mid3 ? mid3 : end;
      if (cp1) { ctx.beginPath(); ctx.moveTo(start.px, start.py); ctx.lineTo(cp1.px, cp1.py); ctx.stroke(); }
      if (cp2) { ctx.beginPath(); ctx.moveTo(anchor2.px, anchor2.py); ctx.lineTo(cp2.px, cp2.py); ctx.stroke(); }
      if (cp3 && mid)  { ctx.beginPath(); ctx.moveTo(mid.px,  mid.py);  ctx.lineTo(cp3.px, cp3.py); ctx.stroke(); }
      if (cp4) { ctx.beginPath(); ctx.moveTo(anchor4.px, anchor4.py); ctx.lineTo(cp4.px, cp4.py); ctx.stroke(); }
      if (cp5 && mid2) { ctx.beginPath(); ctx.moveTo(mid2.px, mid2.py); ctx.lineTo(cp5.px, cp5.py); ctx.stroke(); }
      if (cp6) { ctx.beginPath(); ctx.moveTo(anchor6.px, anchor6.py); ctx.lineTo(cp6.px, cp6.py); ctx.stroke(); }
      if (cp7 && mid3) { ctx.beginPath(); ctx.moveTo(mid3.px, mid3.py); ctx.lineTo(cp7.px, cp7.py); ctx.stroke(); }
      if (cp8) { ctx.beginPath(); ctx.moveTo(end.px,   end.py);   ctx.lineTo(cp8.px, cp8.py); ctx.stroke(); }
      ctx.setLineDash([]);

      const label = (text: string) => { ctx.fillStyle = '#fff'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 0); };

      // CP1 — blue diamond
      if (cp1) {
        drawDiamond(ctx, cp1.px, cp1.py, half);
        ctx.fillStyle = '#3b82f6'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.save(); ctx.translate(cp1.px, cp1.py); label(`${i+1}a`); ctx.restore();
      }
      // CP2 — purple diamond
      if (cp2) {
        drawDiamond(ctx, cp2.px, cp2.py, half);
        ctx.fillStyle = '#a855f7'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.save(); ctx.translate(cp2.px, cp2.py); label(`${i+1}b`); ctx.restore();
      }
      // Mid — green circle (on-curve midpoint for compound bezier)
      if (mid) {
        ctx.beginPath(); ctx.arc(mid.px, mid.py, r, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.save(); ctx.translate(mid.px, mid.py); label(`${i+1}m`); ctx.restore();
      }
      // CP3 — teal diamond
      if (cp3) {
        drawDiamond(ctx, cp3.px, cp3.py, half);
        ctx.fillStyle = '#14b8a6'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.save(); ctx.translate(cp3.px, cp3.py); label(`${i+1}c`); ctx.restore();
      }
      // CP4 — pink diamond
      if (cp4) {
        drawDiamond(ctx, cp4.px, cp4.py, half);
        ctx.fillStyle = '#ec4899'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.save(); ctx.translate(cp4.px, cp4.py); label(`${i+1}d`); ctx.restore();
      }
      // Mid2 — lime circle (second on-curve midpoint)
      if (mid2) {
        ctx.beginPath(); ctx.arc(mid2.px, mid2.py, r, 0, Math.PI * 2);
        ctx.fillStyle = '#84cc16'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.save(); ctx.translate(mid2.px, mid2.py); label(`${i+1}m2`); ctx.restore();
      }
      // CP5 — amber diamond
      if (cp5) {
        drawDiamond(ctx, cp5.px, cp5.py, half);
        ctx.fillStyle = '#f59e0b'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.save(); ctx.translate(cp5.px, cp5.py); label(`${i+1}e`); ctx.restore();
      }
      // CP6 — rose diamond
      if (cp6) {
        drawDiamond(ctx, cp6.px, cp6.py, half);
        ctx.fillStyle = '#fb7185'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.save(); ctx.translate(cp6.px, cp6.py); label(`${i+1}f`); ctx.restore();
      }
      // Mid3 — yellow circle (third on-curve midpoint)
      if (mid3) {
        ctx.beginPath(); ctx.arc(mid3.px, mid3.py, r, 0, Math.PI * 2);
        ctx.fillStyle = '#eab308'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.save(); ctx.translate(mid3.px, mid3.py); label(`${i+1}m3`); ctx.restore();
      }
      // CP7 — violet diamond
      if (cp7) {
        drawDiamond(ctx, cp7.px, cp7.py, half);
        ctx.fillStyle = '#7c3aed'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.save(); ctx.translate(cp7.px, cp7.py); label(`${i+1}g`); ctx.restore();
      }
      // CP8 — cyan diamond
      if (cp8) {
        drawDiamond(ctx, cp8.px, cp8.py, half);
        ctx.fillStyle = '#06b6d4'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.save(); ctx.translate(cp8.px, cp8.py); label(`${i+1}h`); ctx.restore();
      }

      // Start — orange circle
      ctx.beginPath(); ctx.arc(start.px, start.py, r, 0, Math.PI * 2);
      ctx.fillStyle = '#f97316'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), start.px, start.py);

      // End — red circle
      ctx.beginPath(); ctx.arc(end.px, end.py, r, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('→', end.px, end.py);
    });
  }, [arrowEditMode, draftStrokes, size]);

  const handleToggleEditArrows = useCallback(() => {
    if (!arrowEditMode) {
      const base = getStrokes(settings.font.family, caseType, caseType === 'upper' ? letter.toUpperCase() : letter.toLowerCase());
      // Promote every quadratic bezier (cx/cy only) to an equivalent cubic (cx/cy + c2x/c2y)
      // using the exact quadratic→cubic conversion so the rendered shape is unchanged.
      // This ensures every curved stroke always has two draggable handles in the editor.
      setDraftStrokes(base.map(s => {
        // Compound bezier — add c3/c4 defaults if mx/my present but c3/c4 missing
        if (s.mx !== undefined && s.my !== undefined && s.c3x === undefined) {
          const dest = s.mx2 !== undefined ? { x: s.mx2, y: s.my2! } : { x: s.ex, y: s.ey };
          s = {
            ...s,
            c3x: s.mx + (dest.x - s.mx) / 3,
            c3y: s.my + (dest.y - s.my) / 3,
            c4x: s.mx + 2 * (dest.x - s.mx) / 3,
            c4y: s.my + 2 * (dest.y - s.my) / 3,
          };
        }
        // Third segment — add c5/c6 defaults if mx2/my2 present but c5/c6 missing
        if (s.mx2 !== undefined && s.my2 !== undefined && s.c5x === undefined) {
          const dest3 = s.mx3 !== undefined ? { x: s.mx3, y: s.my3! } : { x: s.ex, y: s.ey };
          s = {
            ...s,
            c5x: s.mx2 + (dest3.x - s.mx2) / 3,
            c5y: s.my2 + (dest3.y - s.my2) / 3,
            c6x: s.mx2 + 2 * (dest3.x - s.mx2) / 3,
            c6y: s.my2 + 2 * (dest3.y - s.my2) / 3,
          };
        }
        // Fourth segment — add c7/c8 defaults if mx3/my3 present but c7/c8 missing
        if (s.mx3 !== undefined && s.my3 !== undefined && s.c7x === undefined) {
          return {
            ...s,
            c7x: s.mx3 + (s.ex - s.mx3) / 3,
            c7y: s.my3 + (s.ey - s.my3) / 3,
            c8x: s.mx3 + 2 * (s.ex - s.mx3) / 3,
            c8y: s.my3 + 2 * (s.ey - s.my3) / 3,
          };
        }
        // Simple quadratic → promote to equivalent cubic so both handles are draggable
        if (s.cx !== undefined && s.cy !== undefined && s.c2x === undefined && s.mx === undefined) {
          return {
            ...s,
            cx:  s.x  + (2 / 3) * (s.cx - s.x),
            cy:  s.y  + (2 / 3) * (s.cy - s.y),
            c2x: s.ex + (2 / 3) * (s.cx - s.ex),
            c2y: s.ey + (2 / 3) * (s.cy - s.ey),
          };
        }
        return { ...s };
      }));
    }
    setArrowEditMode(prev => !prev);
  }, [arrowEditMode, settings.font.family, caseType, letter]);

  const onEditPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = editCanvasRef.current;
    const bbox = bboxRef.current;
    if (!canvas || !bbox || !draftStrokes) return;
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left)  * scaleX;
    const my = (e.clientY - rect.top)   * scaleY;

    const { left, top, width, height } = bbox;
    const toScreen = (nx: number, ny: number) => ({
      px: left + nx * width,
      py: top  + ny * height,
    });
    const hitR = 14;

    type DragField = 'start' | 'end' | 'cp1' | 'cp2' | 'mid' | 'cp3' | 'cp4' | 'mid2' | 'cp5' | 'cp6' | 'mid3' | 'cp7' | 'cp8';
    type Hit = { strokeIdx: number; field: DragField; dist: number };

    const buildCandidates = (stroke: StrokeStart): Array<{ field: DragField; nx: number; ny: number }> => {
      const c: Array<{ field: DragField; nx: number; ny: number }> = [
        { field: 'start', nx: stroke.x,   ny: stroke.y  },
        { field: 'end',   nx: stroke.ex,  ny: stroke.ey },
      ];
      if (stroke.cx  !== undefined && stroke.cy  !== undefined) c.push({ field: 'cp1',  nx: stroke.cx,  ny: stroke.cy  });
      if (stroke.c2x !== undefined && stroke.c2y !== undefined) c.push({ field: 'cp2',  nx: stroke.c2x, ny: stroke.c2y });
      if (stroke.mx  !== undefined && stroke.my  !== undefined) c.push({ field: 'mid',  nx: stroke.mx,  ny: stroke.my  });
      if (stroke.c3x !== undefined && stroke.c3y !== undefined) c.push({ field: 'cp3',  nx: stroke.c3x, ny: stroke.c3y });
      if (stroke.c4x !== undefined && stroke.c4y !== undefined) c.push({ field: 'cp4',  nx: stroke.c4x, ny: stroke.c4y });
      if (stroke.mx2 !== undefined && stroke.my2 !== undefined) c.push({ field: 'mid2', nx: stroke.mx2, ny: stroke.my2 });
      if (stroke.c5x !== undefined && stroke.c5y !== undefined) c.push({ field: 'cp5',  nx: stroke.c5x, ny: stroke.c5y });
      if (stroke.c6x !== undefined && stroke.c6y !== undefined) c.push({ field: 'cp6',  nx: stroke.c6x, ny: stroke.c6y });
      if (stroke.mx3 !== undefined && stroke.my3 !== undefined) c.push({ field: 'mid3', nx: stroke.mx3, ny: stroke.my3 });
      if (stroke.c7x !== undefined && stroke.c7y !== undefined) c.push({ field: 'cp7',  nx: stroke.c7x, ny: stroke.c7y });
      if (stroke.c8x !== undefined && stroke.c8y !== undefined) c.push({ field: 'cp8',  nx: stroke.c8x, ny: stroke.c8y });
      return c;
    };

    let closest: Hit | null = null;
    draftStrokes.forEach((stroke, i) => {
      buildCandidates(stroke).forEach(({ field, nx, ny }) => {
        const s = toScreen(nx, ny);
        const d = Math.hypot(mx - s.px, my - s.py);
        if (d < hitR && (!closest || d < closest.dist))
          closest = { strokeIdx: i, field, dist: d };
      });
    });

    // Fallback: if nothing within hitR (e.g. point dragged off-canvas), pick globally nearest
    if (!closest) {
      let fallback: Hit | null = null;
      draftStrokes.forEach((stroke, i) => {
        buildCandidates(stroke).forEach(({ field, nx, ny }) => {
          const s = toScreen(nx, ny);
          const d = Math.hypot(mx - s.px, my - s.py);
          if (!fallback || d < fallback.dist) fallback = { strokeIdx: i, field, dist: d };
        });
      });
      if (fallback) closest = fallback;
    }

    if (closest) dragRef.current = { strokeIdx: (closest as Hit).strokeIdx, field: (closest as Hit).field };
  }, [draftStrokes]);

  const onEditPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons === 0 || !dragRef.current) return;
    const canvas = editCanvasRef.current;
    const bbox = bboxRef.current;
    if (!canvas || !bbox || !draftStrokes) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left)  * scaleX;
    const my = (e.clientY - rect.top)   * scaleY;

    const { left, top, width, height } = bbox;
    const nx = (mx - left) / width;
    const ny = (my - top)  / height;

    const { strokeIdx, field } = dragRef.current;
    setDraftStrokes(prev => {
      if (!prev) return prev;
      const next = prev.map(s => ({ ...s }));
      const s = next[strokeIdx];
      if      (field === 'start') { s.x   = nx; s.y   = ny; }
      else if (field === 'end')   { s.ex  = nx; s.ey  = ny; }
      else if (field === 'cp1')   { s.cx  = nx; s.cy  = ny; }
      else if (field === 'cp2')   { s.c2x = nx; s.c2y = ny; }
      else if (field === 'mid')   { s.mx  = nx; s.my  = ny; }
      else if (field === 'cp3')   { s.c3x = nx; s.c3y = ny; }
      else if (field === 'cp4')   { s.c4x = nx; s.c4y = ny; }
      else if (field === 'mid2')  { s.mx2 = nx; s.my2 = ny; }
      else if (field === 'cp5')   { s.c5x = nx; s.c5y = ny; }
      else if (field === 'cp6')   { s.c6x = nx; s.c6y = ny; }
      else if (field === 'mid3')  { s.mx3 = nx; s.my3 = ny; }
      else if (field === 'cp7')   { s.c7x = nx; s.c7y = ny; }
      else if (field === 'cp8')   { s.c8x = nx; s.c8y = ny; }
      return next;
    });
  }, [draftStrokes]);

  const onEditPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Pointer handlers
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      setShowOverlay(false);
      startStroke(e.nativeEvent, canvas);
    },
    [startStroke]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.buttons === 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      addPoint(e.nativeEvent, canvas);
    },
    [addPoint]
  );

  const onPointerUp = useCallback(() => {
    endStroke();
  }, [endStroke]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    clearCanvas(canvas);
    setShowOverlay(false);
    onClear?.();
  }, [clearCanvas, onClear]);

  const handleUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    undoLastStroke(canvas);
    setShowOverlay(false);
  }, [undoLastStroke]);

  const handleScore = useCallback(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    const result = scoreAttempt(
      canvas,
      letter,
      caseType,
      settings.font,
      settings.guideStrokeWidth,
      guideFontSize,
      guideX,
      guideY,
      strokes,
      strokes.length,
      expectedStrokes
    );

    const mask = buildOutsideMask(
      canvas,
      letter,
      caseType,
      settings.font,
      settings.guideStrokeWidth,
      guideFontSize,
      guideX,
      guideY
    );

    const octx = overlay.getContext('2d')!;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    octx.putImageData(mask, 0, 0);
    setShowOverlay(true);

    playScoreSound(result.grade);
    onScore(result);
  }, [letter, caseType, settings.font, settings.guideStrokeWidth, guideFontSize, guideX, guideY, onScore, strokes.length, expectedStrokes]);

  return (
    <div className="flex flex-col flex-1 gap-3 min-h-0">
      {/* Canvas area */}
      <div
        ref={containerRef}
        className="relative flex-1 rounded-3xl overflow-hidden bg-white shadow-xl border border-gray-100"
        style={{ minHeight: 0 }}
      >
        {/* Guide letter canvas */}
        <canvas
          ref={guideCanvasRef}
          width={size.w}
          height={size.h}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: settings.guideOpacity }}
        />

        {/* User drawing canvas */}
        <canvas
          ref={canvasRef}
          width={size.w}
          height={size.h}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />

        {/* Score overlay canvas */}
        <canvas
          ref={overlayRef}
          width={size.w}
          height={size.h}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: showOverlay ? 1 : 0, transition: 'opacity 0.3s' }}
        />

        {/* Arrow editor canvas */}
        <canvas
          ref={editCanvasRef}
          width={size.w}
          height={size.h}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none', pointerEvents: arrowEditMode ? 'auto' : 'none', cursor: arrowEditMode ? 'crosshair' : 'default' }}
          onPointerDown={onEditPointerDown}
          onPointerMove={onEditPointerMove}
          onPointerUp={onEditPointerUp}
        />

        {/* Hint when empty */}
        {strokes.length === 0 && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
            <span className="text-sm text-gray-300 font-medium bg-white/60 px-3 py-1.5 rounded-full">
              Trace the letter above
            </span>
          </div>
        )}

        {/* Score overlay — lower right of canvas */}
        {score && (() => {
          const display = getScoreDisplay(score.grade);
          return (
            <div className="absolute bottom-0 left-0 right-0 sm:bottom-4 sm:left-auto sm:right-4 z-10 sm:w-64 rounded-t-2xl sm:rounded-3xl shadow-2xl overflow-hidden"
              style={{ backdropFilter: 'blur(12px)' }}>
              {/* Header band */}
              <div className={`${display.bgClass} px-5 py-3`}>
                <span className="text-2xl font-black tracking-tight">{display.word}</span>
              </div>
              {/* Stats */}
              <div className="bg-white/95 px-4 pt-3 pb-1 flex flex-col gap-1.5">
                {([
                  ['Accuracy',   getAccuracyWord(score.accuracy)],
                  ['Coverage',   getCoverageWord(score.coverage)],
                  ['Smoothness', getSmoothnessWord(score.smoothnessScore)],
                ] as [string, string][]).map(([label, word]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{label}</span>
                    <span className="text-xs font-semibold text-gray-700">{word}</span>
                  </div>
                ))}
                <div className="flex items-center justify-end mt-1 mb-2">
                  <span className="text-xs text-gray-400">Attempt {score.attempts}</span>
                </div>
              </div>
              {/* Next / Try Again button */}
              {score.grade === 'F' ? (
                <button
                  onClick={handleClear}
                  className="w-full py-4 bg-red-500 text-white font-bold text-sm hover:bg-red-600 active:scale-95 transition-all"
                >
                  Try Again
                </button>
              ) : onNext && (
                <button
                  onClick={onNext}
                  className="w-full py-4 bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 active:scale-95 transition-all"
                >
                  Next →
                </button>
              )}
            </div>
          );
        })()}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 justify-center flex-wrap">
        <button
          onClick={handleUndo}
          disabled={strokes.length === 0}
          className="px-4 py-3.5 sm:px-5 sm:py-3.5 rounded-2xl bg-white shadow-md text-gray-700 font-semibold text-sm hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↩ Undo
        </button>

        <button
          onClick={handleClear}
          disabled={strokes.length === 0}
          className="px-4 py-3.5 sm:px-5 sm:py-3.5 rounded-2xl bg-white shadow-md text-gray-700 font-semibold text-sm hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ✕ Clear
        </button>

        <button
          onClick={handleScore}
          disabled={strokes.length === 0}
          className="px-6 py-3.5 sm:px-8 sm:py-3.5 rounded-2xl bg-indigo-600 shadow-md text-white font-bold text-sm hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Score ✓
        </button>

      </div>

      {/* Arrow editor readout panel */}
      {arrowEditMode && draftStrokes && (
        <div className="rounded-2xl bg-gray-900 text-green-400 font-mono text-xs p-4 shadow-inner overflow-x-auto">
          <div className="text-gray-400 mb-1 text-[10px] uppercase tracking-wider">Stroke data — copy &amp; paste into strokeData.ts</div>
          <pre className="whitespace-pre leading-relaxed">{`// ${settings.font.family} — ${caseType}\n${caseType === 'upper' ? letter.toUpperCase() : letter.toLowerCase()}: [\n${formatStrokeData(draftStrokes)}\n],`}</pre>
        </div>
      )}

    </div>
  );
}
