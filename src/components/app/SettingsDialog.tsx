/** The settings dialog: display, number format, autosave, game options and the account. */
import { Button } from '../ui/Button';
import React from 'react';
import type { GameSettings } from '../../lib/gameState';
import type { ActiveWindow, ViewState } from '../../lib/gameTypes';
import { DecimalSymbol } from '../../lib/format';
import { Check, RotateCcw } from 'lucide-react';
import { restartTutorial } from '../../lib/tutorial';

export interface SettingsDialogProps {
  setDecimalSymbol: (symbol: DecimalSymbol) => void;
  decimalSymbol: DecimalSymbol;
  uiScaleSetting: number;
  setUiScaleSetting: (value: number) => void;
  autosaveInterval: number;
  setAutosaveInterval: React.Dispatch<React.SetStateAction<number>>;
  setAutosaveOverwrite: React.Dispatch<React.SetStateAction<boolean>>;
  autosaveOverwrite: boolean;
  gameSettings: GameSettings;
  setGameSettings: React.Dispatch<React.SetStateAction<GameSettings>>;
  view: ViewState;
  setTutorialStep: React.Dispatch<React.SetStateAction<number | null>>;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setView: React.Dispatch<React.SetStateAction<ViewState>>;
  openWindow: (win: ActiveWindow) => void;
}

export function SettingsDialog({
  setDecimalSymbol, decimalSymbol, uiScaleSetting, setUiScaleSetting, autosaveInterval, setAutosaveInterval, setAutosaveOverwrite, autosaveOverwrite, gameSettings, setGameSettings, view, setTutorialStep, setIsSettingsOpen, setView, openWindow
}: SettingsDialogProps) {
  /** A setting that is on or off: a real switch, with what it does underneath. */
  const toggle = (on: boolean, flip: () => void, title: string, detail: string) => (
    <button type="button" role="switch" aria-checked={on} onClick={flip}
      className="w-full flex items-start gap-3 py-2.5 text-left border-t border-line first:border-t-0">
      <span className={`mt-0.5 size-5 shrink-0 flex items-center justify-center border rounded-sm ${on ? 'bg-accent border-accent text-on-accent' : 'border-rule'}`}>
        {on && <Check size={14} aria-hidden="true" />}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-medium text-ink">{title}</span>
        <span className="text-xs text-muted">{detail}</span>
      </span>
    </button>
  );
  const sectionLabel = 'block font-label font-semibold text-2xs uppercase tracking-label text-muted mb-1.5';

  return (
    <>
        <div className="fixed inset-0 z-[1001] bg-ground/80 flex items-center justify-center p-4 short:p-2 animate-appear">
          {/* Scrolls when taller than the screen, as on a phone held sideways,
              where the settings also go into two columns. */}
          <div role="dialog" aria-modal="true" aria-labelledby="settings-title"
            className="bg-surface border border-rule shadow-pop rounded-sm max-w-lg short:max-w-3xl w-full max-h-full flex flex-col">
            <div className="pl-4 pr-2 py-2 border-b border-line flex items-center justify-between shrink-0">
              <h2 id="settings-title" className="font-label text-lg text-ink font-semibold">Settings</h2>
              <Button variant="ghost" onClick={() => setIsSettingsOpen(false)}>Close</Button>
            </div>

            <div className="p-4 short:p-3 overflow-y-auto flex flex-col gap-5 short:grid short:grid-cols-2 short:gap-x-6 short:gap-y-3">
              <div>
                <span className={sectionLabel}>Number format</span>
                <div className="flex gap-2" role="group" aria-label="Number format">
                  {[".", ","].map((symbol) => (
                    <Button key={symbol} className="flex-1 font-mono normal-case" active={decimalSymbol === symbol} aria-pressed={decimalSymbol === symbol}
                      onClick={() => setDecimalSymbol(symbol as DecimalSymbol)}>
                      {symbol === "." ? "1,234.50" : "1.234,50"}
                    </Button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className={`${sectionLabel} flex justify-between`}>
                  <span>Interface size</span>
                  <span className="font-mono text-ink">{uiScaleSetting.toFixed(2)}×</span>
                </span>
                <input type="range" min="0.5" max="1.5" step="0.05" value={uiScaleSetting}
                  onChange={(e) => setUiScaleSetting(parseFloat(e.target.value))}
                  className="slider-thumb w-full h-1.5 bg-line rounded-full appearance-none cursor-pointer" />
                <span className="block mt-1 text-xs text-muted">Small screens are scaled automatically as well.</span>
              </label>

              <label className="block">
                <span className={`${sectionLabel} flex justify-between`}>
                  <span>Autosave every</span>
                  <span className="font-mono text-ink normal-case">{autosaveInterval} {autosaveInterval === 1 ? 'month' : 'months'}</span>
                </span>
                <input type="range" min="1" max="12" step="1" value={autosaveInterval}
                  onChange={(e) => setAutosaveInterval(parseInt(e.target.value, 10))}
                  className="slider-thumb w-full h-1.5 bg-line rounded-full appearance-none cursor-pointer" />
              </label>

              <div className="short:col-span-2">
                {toggle(autosaveOverwrite, () => setAutosaveOverwrite(!autosaveOverwrite), 'Autosave overwrites the current save',
                  'When off, each autosave is kept as a copy of its own (up to three).')}
                {toggle(gameSettings.newspaper, () => setGameSettings(prev => ({ ...prev, newspaper: !prev.newspaper })), 'Monthly newspaper',
                  'Show The Aviation Times after every month. When off, the latest edition is still under Messages and on the monthly report.')}
                {toggle(gameSettings.tutorial, () => setGameSettings(prev => ({ ...prev, tutorial: !prev.tutorial })), 'Tutorial for new games',
                  'Start every new game with the guided tour of the first steps. Skipping it ends the tour for that game only.')}
              </div>

              {(view === 'game' || view === 'monthly-overview') && (
                <Button className="self-start" icon={<RotateCcw size={14} aria-hidden="true" />}
                  onClick={() => {
                    setTutorialStep(restartTutorial());
                    setIsSettingsOpen(false);
                    if (view === 'monthly-overview') setView('game');
                    openWindow('map');
                  }}>
                  Restart tutorial in this game
                </Button>
              )}
            </div>
          </div>
        </div>
    </>
  );
}
