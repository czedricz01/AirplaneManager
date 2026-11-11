/** The settings dialog: display, number format, autosave, game options and the account. */
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
  return (
    <>
        <div className="fixed inset-0 z-[1001] bg-ground/80 flex items-center justify-center p-4 short:p-2">
          {/* Scrolls when taller than the screen, as on a phone held sideways;
              otherwise its top was cut off with no way to reach it. There the
              settings also go into two columns, so most of them fit at once. */}
          <div className="bg-raised border border-line p-4 short:p-3 max-w-lg short:max-w-3xl w-full max-h-full overflow-y-auto short:relative">
            <h2 className="text-2xl short:text-lg font-mono text-accent font-semibold mb-3 short:mb-2">System Settings</h2>
            
            <div className="flex flex-col gap-4 short:grid short:grid-cols-2 short:grid-rows-[repeat(3,auto)] short:grid-flow-col short:gap-x-5 short:gap-y-2">
              <div className="space-y-4 short:space-y-2">
                <label className="block text-2xs font-semibold uppercase tracking-label text-muted">Number Format (Decimal Separator)</label>
                <div className="flex gap-4 short:gap-2">
                  {[".", ","].map((symbol) => (
                    <button
                      key={symbol}
                      onClick={() => setDecimalSymbol(symbol as DecimalSymbol)}
                      className={`flex-1 p-4 short:p-2 font-mono text-xl short:text-base border transition-colors ${decimalSymbol === symbol ? 'bg-accent text-on-accent border-accent font-semibold' : 'bg-raised border-line text-ink hover:border-accent'}`}
                    >
                      {symbol === "." ? "1.234" : "1,234"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-label text-muted font-semibold flex justify-between">
                  <span>UI Scale Factor</span>
                  <span className="text-accent">{uiScaleSetting.toFixed(2)}x</span>
                </label>
                <input 
                  type="range" 
                  min="0.5" 
                  max="1.5" 
                  step="0.05" 
                  value={uiScaleSetting}
                  onChange={(e) => setUiScaleSetting(parseFloat(e.target.value))}
                  className="w-full h-2 bg-raised rounded-full appearance-none cursor-pointer"
                />
                <span className="text-2xs text-muted font-mono">Adjusts the scale of the user interface. Auto-scaling is also active for small screens.</span>
              </div>

              <div className="flex flex-col gap-4 pt-4 border-t border-line short:contents">
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-label text-muted font-semibold flex justify-between">
                    <span>Autosave Interval (Months)</span>
                    <span className="text-accent">{autosaveInterval} Months</span>
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="12" 
                    step="1" 
                    value={autosaveInterval}
                    onChange={(e) => setAutosaveInterval(parseInt(e.target.value))}
                    className="w-full h-2 bg-raised rounded-full appearance-none cursor-pointer accent-accent"
                  />
                  <div className="flex justify-between text-2xs text-muted uppercase tracking-label">
                    <span>1 Month</span>
                    <span>12 Months</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-surface p-4 short:p-2.5 select-none cursor-pointer border border-transparent hover:border-line transition-colors" onClick={() => setAutosaveOverwrite(!autosaveOverwrite)}>
                  <div className={`w-5 h-5 flex items-center justify-center border ${autosaveOverwrite ? 'bg-accent border-accent text-on-accent' : 'border-rule'}`}>
                    {autosaveOverwrite && <Check size={14} />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-ink uppercase tracking-label font-semibold">Overwrite Save File</span>
                    <span className="text-2xs text-muted max-w-sm leading-tight mt-1">If active, pending autosaves overwrite the current archive. If disabled, each autosave registers as a new clone.</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-line short:pt-0 short:border-t-0">
                <button
                  type="button"
                  role="switch"
                  aria-checked={gameSettings.newspaper}
                  onClick={() => setGameSettings(prev => ({ ...prev, newspaper: !prev.newspaper }))}
                  className="w-full flex items-center gap-3 bg-surface p-4 short:p-2.5 text-left select-none border border-transparent hover:border-line transition-colors"
                >
                  <div className={`w-5 h-5 shrink-0 flex items-center justify-center border ${gameSettings.newspaper ? 'bg-accent border-accent text-on-accent' : 'border-rule'}`}>
                    {gameSettings.newspaper && <Check size={14} />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-ink uppercase tracking-label font-semibold">Monthly Newspaper</span>
                    <span className="text-2xs text-muted max-w-sm leading-tight mt-1">Show The Aviation Times after every month. When off, the latest edition is still under Messages and on the monthly report.</span>
                  </div>
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={gameSettings.tutorial}
                  onClick={() => setGameSettings(prev => ({ ...prev, tutorial: !prev.tutorial }))}
                  className="w-full flex items-center gap-3 bg-surface p-4 short:p-2.5 text-left select-none border border-transparent hover:border-line transition-colors"
                >
                  <div className={`w-5 h-5 shrink-0 flex items-center justify-center border ${gameSettings.tutorial ? 'bg-accent border-accent text-on-accent' : 'border-rule'}`}>
                    {gameSettings.tutorial && <Check size={14} />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-ink uppercase tracking-label font-semibold">Tutorial for New Games</span>
                    <span className="text-2xs text-muted max-w-sm leading-tight mt-1">Start every new game with the guided tour of the first steps. Skipping it ends the tour for that game only.</span>
                  </div>
                </button>
                {(view === 'game' || view === 'monthly-overview') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTutorialStep(restartTutorial());
                      setIsSettingsOpen(false);
                      if (view === 'monthly-overview') setView('game');
                      openWindow('map');
                    }}
                    className="self-start flex items-center gap-2 px-3 py-2 border border-line text-muted hover:text-accent hover:border-accent/50 font-label text-2xs uppercase tracking-label transition-colors"
                  >
                    <RotateCcw size={12} aria-hidden="true" /> Restart tutorial in this game
                  </button>
                )}
              </div>
            </div>

            {/* Sideways: beside the title rather than below everything. */}
            <div className="mt-8 flex justify-end short:mt-0 short:absolute short:top-3 short:right-3">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="bg-surface hover:bg-raised text-ink border border-line px-3 py-2 short:py-1 font-mono text-sm transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
    </>
  );
}
