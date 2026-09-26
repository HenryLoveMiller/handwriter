import { useCallback, useState } from 'react';
import { flushSync } from 'react-dom';
import { ALPHABET, FONT_OPTIONS } from './types';
import type { LetterCase, LetterScore, ToolbarSettings } from './types';
import { Canvas } from './components/Canvas';
import { LetterPicker } from './components/LetterPicker';
import { Toolbar } from './components/Toolbar';
import { ProgressTracker } from './components/ProgressTracker';
import { loadScores, saveScore } from './utils/scoring';

const INITIAL_PARAMS = new URLSearchParams(window.location.search);
const INITIAL_LETTER = INITIAL_PARAMS.get('letter')?.toUpperCase() ?? 'A';
const INITIAL_LETTER_INDEX = Math.max(0, ALPHABET.indexOf(INITIAL_LETTER));
const INITIAL_CASE: LetterCase = INITIAL_PARAMS.get('case') === 'lower' ? 'lower' : 'upper';
const INITIAL_FONT = FONT_OPTIONS.find((font) => font.family === INITIAL_PARAMS.get('font')) ?? FONT_OPTIONS[0];

const DEFAULT_SETTINGS: ToolbarSettings = {
  strokeWeight: 3,      // Regular — guide 2px
  penWidth: 5,          // 5% of canvas min dimension — matches ABeeZee Regular stroke width
  guideStrokeWidth: 2,
  guideOpacity: 0.2,
  font: INITIAL_FONT, // ABeeZee by default; URL parameter supports automated audits
  showStrokeNumbers: true,
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => void;
};

function updateWithViewTransition(update: () => void) {
  const startViewTransition = (document as ViewTransitionDocument).startViewTransition;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!startViewTransition || reduceMotion) {
    update();
    return;
  }

  startViewTransition.call(document, () => {
    flushSync(update);
  });
}

export default function App() {
  const [letterIndex, setLetterIndex] = useState(INITIAL_LETTER_INDEX);
  const [caseType, setCaseType] = useState<LetterCase>(INITIAL_CASE);
  const [settings, setSettings] = useState<ToolbarSettings>(DEFAULT_SETTINGS);
  const [scores, setScores] = useState<Record<string, LetterScore>>(loadScores);
  const [pendingScore, setPendingScore] = useState<LetterScore | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);

  const currentLetter = ALPHABET[letterIndex];

  const goTo = useCallback((index: number) => {
    updateWithViewTransition(() => {
      setLetterIndex(((index % 26) + 26) % 26);
      setCanvasKey((k) => k + 1);
      setPendingScore(null);
    });
  }, []);

  const handleScore = useCallback((score: LetterScore) => {
    const saved = saveScore(score);
    setScores((prev) => ({
      ...prev,
      [`${saved.fontFamily}_${saved.caseType}_${saved.letter}`]: saved,
    }));
    setPendingScore(saved);
  }, []);

  const handleSelectLetter = useCallback(
    (letter: string) => {
      const idx = ALPHABET.indexOf(letter.toUpperCase());
      if (idx !== -1) goTo(idx);
    },
    [goTo]
  );

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-indigo-700 tracking-tight">Handwriter</span>
          <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">
            {caseType === 'upper' ? 'Uppercase' : 'Lowercase'}
          </span>
        </div>

        <div className="flex items-center gap-2 relative">
          <ProgressTracker
            scores={scores}
            caseType={caseType}
            font={settings.font}
            currentLetter={currentLetter}
            onSelect={handleSelectLetter}
            onClearScores={() => {
              const filtered = Object.fromEntries(
                Object.entries(scores).filter(([key]) => !key.startsWith(`${settings.font.family}_`))
              );
              localStorage.setItem('handwriter_scores', JSON.stringify(filtered));
              setScores(filtered);
              setPendingScore(null);
            }}
          />
          <Toolbar settings={settings} onChange={(s) => { setSettings(s); if (s.font.family !== settings.font.family) setPendingScore(null); }} />
        </div>
      </header>

      {/* Letter picker */}
      <div className="px-4 pb-2 flex-shrink-0">
        <LetterPicker
          currentLetter={currentLetter}
          caseType={caseType}
          font={settings.font}
          scores={scores}
          onSelect={handleSelectLetter}
          onPrev={() => goTo(letterIndex - 1)}
          onNext={() => goTo(letterIndex + 1)}
          onToggleCase={() => {
            updateWithViewTransition(() => {
              setCaseType((c) => (c === 'upper' ? 'lower' : 'upper'));
              setCanvasKey((k) => k + 1);
            });
          }}
        />
      </div>

      {/* Canvas */}
      <div className="practice-stage flex-1 px-4 pb-4 min-h-0 flex flex-col">
        <Canvas
          key={`${canvasKey}-${currentLetter}-${caseType}-${settings.font.family}`}
          letter={currentLetter}
          caseType={caseType}
          settings={settings}
          onScore={handleScore}
          onClear={() => setPendingScore(null)}
          score={pendingScore}
          onNext={() => {
            setPendingScore(null);
            goTo(letterIndex + 1);
          }}
        />
      </div>
    </div>
  );
}
