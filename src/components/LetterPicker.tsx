import { ALPHABET, getScoreDisplay } from '../types';
import type { FontOption, LetterCase, LetterScore } from '../types';

interface Props {
  currentLetter: string;
  caseType: LetterCase;
  font: FontOption;
  scores: Record<string, LetterScore>;
  onSelect: (letter: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleCase: () => void;
}

export function LetterPicker({
  currentLetter,
  caseType,
  font,
  scores,
  onSelect,
  onPrev,
  onNext,
  onToggleCase,
}: Props) {
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex items-center gap-3">
        <button
          onClick={onPrev}
          className="w-11 h-11 rounded-full bg-white shadow-md text-gray-700 text-xl font-bold hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center"
          aria-label="Previous letter"
        >
          ‹
        </button>

        <div className="text-center">
          <div className="text-5xl font-bold text-indigo-700 leading-none select-none" style={{ minWidth: '3rem' }}>
            {caseType === 'upper' ? currentLetter.toUpperCase() : currentLetter.toLowerCase()}
          </div>
          <div className="text-xs text-gray-400 mt-1">{ALPHABET.indexOf(currentLetter.toUpperCase()) + 1} / 26</div>
        </div>

        <button
          onClick={onNext}
          className="w-11 h-11 rounded-full bg-white shadow-md text-gray-700 text-xl font-bold hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center"
          aria-label="Next letter"
        >
          ›
        </button>

        <button
          onClick={onToggleCase}
          className="ml-2 px-4 h-11 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold hover:bg-indigo-200 active:scale-95 transition-all"
        >
          {caseType === 'upper' ? 'Aa→aa' : 'aa→Aa'}
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-1">
        {ALPHABET.map((l) => {
          const key = `${font.family}_${caseType}_${l}`;
          const scored = scores[key];
          const isCurrent = l === currentLetter.toUpperCase();
          return (
            <button
              key={l}
              onClick={() => onSelect(l)}
              title={scored ? `${caseType === 'upper' ? l : l.toLowerCase()} — ${getScoreDisplay(scored.grade).word}` : l}
              className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all active:scale-95
                ${isCurrent
                  ? 'bg-indigo-600 text-white shadow-md scale-110'
                  : scored
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-white text-gray-600 hover:bg-indigo-50 shadow-sm'
                }`}
            >
              {caseType === 'upper' ? l : l.toLowerCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
