import { useEffect, useState } from 'react';
import { getScoreDisplay } from '../types';
import type { LetterScore } from '../types';

interface Props {
  score: LetterScore | null;
  onClose: () => void;
  onNext: () => void;
}

export function ScoreModal({ score, onClose, onNext }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (score) {
      setVisible(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
    }
  }, [score]);

  if (!score) return null;

  const display = getScoreDisplay(score.grade);
  const isA = score.grade === 'A';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-4 min-w-64 max-w-sm w-full mx-4 transform transition-all duration-300 ${visible ? 'scale-100 translate-y-0' : 'scale-90 translate-y-4'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-6xl font-black leading-none" style={{ fontFamily: 'system-ui' }}>
          {score.caseType === 'upper' ? score.letter.toUpperCase() : score.letter.toLowerCase()}
        </div>

        <div className={`text-4xl font-black leading-none text-center ${display.textClass}`}>
          {display.word}
        </div>

        {score.expectedStrokes > 0 && (
          <div className={`text-sm font-semibold ${score.strokeCount === score.expectedStrokes ? 'text-green-500' : 'text-orange-500'}`}>
            Strokes: {score.strokeCount} / {score.expectedStrokes} expected
          </div>
        )}

        <div className={`mt-2 w-full flex gap-2 ${isA ? '' : 'flex-col'}`}>
          {isA && (
            <button
              onClick={onNext}
              className="flex-1 py-3 rounded-2xl bg-green-500 text-white font-bold text-base hover:bg-green-600 active:scale-95 transition-all"
            >
              Next Letter →
            </button>
          )}
          <button
            onClick={onClose}
            className={`py-3 rounded-2xl font-bold text-base active:scale-95 transition-all ${isA ? 'px-4 bg-gray-100 text-gray-600 hover:bg-gray-200' : 'w-full bg-indigo-600 text-white hover:bg-indigo-700'}`}
          >
            {isA ? 'Stay' : 'Keep Practicing'}
          </button>
        </div>
      </div>
    </div>
  );
}
