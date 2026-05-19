import { useState } from 'react';
import { ALPHABET, getScoreDisplay, getAccuracyWord, getCoverageWord, getSmoothnessWord, getShortRating } from '../types';
import type { FontOption, LetterCase, LetterScore } from '../types';

interface Props {
  scores: Record<string, LetterScore>;
  caseType: LetterCase;
  font: FontOption;
  currentLetter: string;
  onSelect: (letter: string) => void;
  onClearScores: () => void;
}

export function ProgressTracker({ scores, caseType, font, currentLetter, onSelect, onClearScores }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const attempted = ALPHABET.filter((l) => scores[`${font.family}_${caseType}_${l}`]).length;

  const close = () => { setOpen(false); setSelected(null); setConfirmClear(false); };

  const selectedScore = selected ? scores[`${font.family}_${caseType}_${selected}`] : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 h-11 rounded-full bg-white shadow-md text-gray-700 text-sm font-semibold hover:bg-indigo-50 active:scale-95 transition-all"
      >
        <span>📊</span>
        <span>{attempted}/26</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 w-full max-w-lg flex flex-col gap-4 max-h-[85vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selected && (
                  <button
                    onClick={() => { setSelected(null); setConfirmClear(false); }}
                    className="w-11 h-11 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center text-sm"
                  >
                    ←
                  </button>
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {selected ? `Letter ${caseType === 'upper' ? selected : selected.toLowerCase()}` : 'Progress'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selected
                      ? selectedScore ? `${selectedScore.attempts} attempt${selectedScore.attempts !== 1 ? 's' : ''}` : 'Not yet practiced'
                      : `${attempted}/26 letters · ${caseType === 'upper' ? 'Uppercase' : 'Lowercase'} · ${font.name}`}
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                className="w-11 h-11 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center text-lg"
              >
                ✕
              </button>
            </div>

            {/* Letter detail view */}
            {selected ? (
              <div className="flex flex-col gap-4">
                {selectedScore ? (() => {
                  const display = getScoreDisplay(selectedScore.grade);
                  return (
                    <>
                      {/* Grade banner */}
                      <div className={`${display.bgClass} rounded-2xl px-5 py-4`}>
                        <div className="text-2xl font-black">{display.word}</div>
                        <div className="text-sm opacity-80">{selectedScore.attempts} attempt{selectedScore.attempts !== 1 ? 's' : ''} · running average</div>
                      </div>

                      {/* Stat rows */}
                      <div className="flex flex-col gap-2">
                        {([
                          ['Accuracy',   getAccuracyWord(selectedScore.accuracy)],
                          ['Coverage',   getCoverageWord(selectedScore.coverage)],
                          ['Smoothness', getSmoothnessWord(selectedScore.smoothnessScore)],
                        ] as [string, string][]).map(([label, word]) => (
                          <div key={label} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                            <span className="text-sm text-gray-400">{label}</span>
                            <span className="text-sm font-semibold text-gray-700">{word}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })() : (
                  <div className="text-center py-8 text-gray-400">
                    <div className="text-4xl mb-2">{caseType === 'upper' ? selected : selected.toLowerCase()}</div>
                    <div className="text-sm">No attempts yet</div>
                  </div>
                )}

                {/* Practice button */}
                <button
                  onClick={() => { onSelect(selected); close(); }}
                  className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 active:scale-95 transition-all"
                >
                  Practice {caseType === 'upper' ? selected : selected.toLowerCase()} →
                </button>
              </div>
            ) : (
              <>
                {/* Letter grid */}
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {ALPHABET.map((l) => {
                    const key = `${font.family}_${caseType}_${l}`;
                    const score = scores[key];
                    const isCurrent = l === currentLetter.toUpperCase();
                    const display = caseType === 'upper' ? l : l.toLowerCase();

                    return (
                      <button
                        key={l}
                        onClick={() => setSelected(l)}
                        className={`rounded-xl p-2 flex flex-col items-center gap-1 border-2 transition-all active:scale-95
                          ${isCurrent ? 'border-indigo-400' : 'border-transparent'}
                          ${score ? getScoreDisplay(score.grade).bgClass : 'bg-gray-100 text-gray-400'}
                        `}
                      >
                        <span className="text-lg font-bold">{display}</span>
                        {score
                          ? <span className="text-[10px] font-semibold opacity-90">{getShortRating(score.overall)}</span>
                          : <span className="text-xs opacity-50">—</span>}
                      </button>
                    );
                  })}
                </div>

                {attempted === 26 && (
                  <div className="p-4 bg-indigo-50 rounded-2xl text-center">
                    <div className="text-3xl mb-1">🎉</div>
                    <p className="font-bold text-indigo-700">You've practiced all 26 letters!</p>
                  </div>
                )}

                {/* Clear scores */}
                <div className="border-t border-gray-100 pt-3">
                  {confirmClear ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 flex-1">Clear all scores?</span>
                      <button
                        onClick={() => { onClearScores(); setConfirmClear(false); }}
                        className="px-4 py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 active:scale-95 transition-all"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setConfirmClear(false)}
                        className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm hover:bg-gray-200 active:scale-95 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmClear(true)}
                      className="text-sm text-red-400 hover:text-red-600 font-semibold transition-colors"
                    >
                      Clear all scores
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
