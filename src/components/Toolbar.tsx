import { useState } from 'react';
import { FONT_OPTIONS, getWeightLevels } from '../types';
import type { ToolbarSettings } from '../types';

interface Props {
  settings: ToolbarSettings;
  onChange: (s: ToolbarSettings) => void;
}

export function Toolbar({ settings, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const update = (patch: Partial<ToolbarSettings>) =>
    onChange({ ...settings, ...patch });

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="w-11 h-11 rounded-full bg-white shadow-md text-indigo-600 flex items-center justify-center text-xl hover:bg-indigo-50 active:scale-95 transition-all"
        aria-label="Settings"
      >
        ⚙
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-4 top-14 z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:w-72 bg-white rounded-2xl shadow-2xl p-5 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-base">Guide Settings</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                Letter Weight{' '}
                <span className="text-indigo-500 font-bold">
                  {getWeightLevels(settings.font.category)[settings.strokeWeight].name}
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={6}
                step={1}
                value={settings.strokeWeight}
                onChange={(e) => {
                  const w = Number(e.target.value);
                  update({ strokeWeight: w, guideStrokeWidth: getWeightLevels(settings.font.category)[w].guideStrokeWidth });
                }}
                className="accent-indigo-500 w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 -mt-1 px-0.5">
                {getWeightLevels(settings.font.category).map((w) => (
                  <span key={w.name}>{w.name.slice(0, 3)}</span>
                ))}
              </div>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">Pen Weight</span>
              <input
                type="range"
                min={1}
                max={9}
                step={0.5}
                value={settings.penWidth}
                onChange={(e) => update({ penWidth: Number(e.target.value) })}
                className="accent-indigo-500 w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 -mt-1 px-0.5">
                <span>Thin</span>
                <span>Regular</span>
                <span>Bold</span>
              </div>
            </label>

<label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">
                Guide Opacity <span className="text-indigo-500 font-bold">{Math.round(settings.guideOpacity * 100)}%</span>
              </span>
              <input
                type="range"
                min={0.05}
                max={0.5}
                step={0.01}
                value={settings.guideOpacity}
                onChange={(e) => update({ guideOpacity: Number(e.target.value) })}
                className="accent-indigo-500 w-full"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">Font</span>
              <select
                value={settings.font.family}
                onChange={(e) => {
                  const font = FONT_OPTIONS.find((f) => f.family === e.target.value)!;
                  update({ font });
                }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.family} value={f.family}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.showStrokeNumbers}
                onChange={(e) => update({ showStrokeNumbers: e.target.checked })}
                className="w-4 h-4 accent-indigo-500"
              />
              <span className="text-sm font-semibold text-gray-600">Show stroke order</span>
            </label>

            <div
              className="text-center text-4xl py-2 border border-gray-100 rounded-xl bg-gray-50 text-gray-600"
              style={{ fontFamily: `"${settings.font.family}", sans-serif` }}
            >
              Aa
            </div>
          </div>
        </>
      )}
    </>
  );
}
