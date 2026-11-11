/** The new-game screen: airline, scenario or mode, hub, difficulty, rivals and the save name. */
import { motion } from 'motion/react';
import { ScenarioPicker } from '../ScenarioPicker';
import { BrandingPicker } from '../BrandingPicker';
import { ScenarioLock } from './AppChrome';
import { airportsMapAdjusted } from '../../data/airportRegistry';
import { ChevronDown, ChevronRight } from 'lucide-react';
import React from 'react';
import type { Branding } from '../../lib/gameState';
import type { ScenarioStars } from '../../lib/careerScore';
import { airportsByName } from '../../data/airportRegistry';
import type { GameMode } from '../../lib/airlineRank';
import type { Scenario } from '../../data/scenarios';
import type { ViewState } from '../../lib/gameTypes';

const HubPickerModal = React.lazy(() => import('../HubPickerModal').then(m => ({ default: m.HubPickerModal })));
import { maxAirportLevel } from '../../lib/airportAccess';
import { rankDef } from '../../lib/airlineRank';
import { formatCurrency, yearOf } from '../../lib/format';
import { writeString } from '../../lib/safeStorage';

export interface NewGameScreenProps {
  setView: React.Dispatch<React.SetStateAction<ViewState>>;
  newGameScenarioId: string | null;
  newGameMode: GameMode;
  pickNewGameScenario: (id: string | null, mode?: GameMode) => void;
  scenarioStars: ScenarioStars;
  newGameScenario: Scenario | undefined;
  airlineName: string;
  setAirlineName: React.Dispatch<React.SetStateAction<string>>;
  airlineCode: string;
  handleAirlineCodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  newGameBranding: Branding;
  setNewGameBranding: React.Dispatch<React.SetStateAction<Branding>>;
  setHubPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedHub: string;
  hubPickerOpen: boolean;
  startDateOffset: number;
  setSelectedHub: React.Dispatch<React.SetStateAction<string>>;
  setDifficulty: React.Dispatch<React.SetStateAction<string>>;
  difficulty: string;
  setStartingBudget: React.Dispatch<React.SetStateAction<string>>;
  startingBudget: string;
  setDebugMode: React.Dispatch<React.SetStateAction<boolean>>;
  debugMode: boolean;
  aiAirlinesCount: number;
  setAiAirlinesCount: React.Dispatch<React.SetStateAction<number>>;
  aiDifficulty: string;
  setAiDifficulty: React.Dispatch<React.SetStateAction<string>>;
  formatDate: (offset: number) => string;
  setStartDateOffset: React.Dispatch<React.SetStateAction<number>>;
  initialSaveFileName: string;
  setInitialSaveFileName: React.Dispatch<React.SetStateAction<string>>;
  setAppAlert: React.Dispatch<React.SetStateAction<string | null>>;
  startNewGame: (saveName: string, chosen?: Scenario, keepBranding?: Branding) => void;
}

export function NewGameScreen({
  setView, newGameScenarioId, newGameMode, pickNewGameScenario, scenarioStars, newGameScenario, airlineName, setAirlineName, airlineCode, handleAirlineCodeChange, newGameBranding, setNewGameBranding, setHubPickerOpen, selectedHub, hubPickerOpen, startDateOffset, setSelectedHub, setDifficulty, difficulty, setStartingBudget, startingBudget, setDebugMode, debugMode, aiAirlinesCount, setAiAirlinesCount, aiDifficulty, setAiDifficulty, formatDate, setStartDateOffset, initialSaveFileName, setInitialSaveFileName, setAppAlert, startNewGame
}: NewGameScreenProps) {
  return (
    <>
              <motion.div
                key="start-menu"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-1 min-h-0 p-4 lg:p-12 short:pt-2 bar:pb-0 short:pb-0 overflow-y-auto"
              >
                <div className="max-w-4xl mx-auto space-y-12 bar:space-y-5 short:space-y-3 pb-20 bar:pb-0 short:pb-0">
                  <div className="flex items-end short:items-center justify-between gap-4 border-b border-line pb-6 bar:pb-3 short:pb-2">
                    <div>
                      <span className="text-accent font-label text-xs tracking-label uppercase block mb-2 bar:hidden short:hidden">Operation: Initialize</span>
                      <h2 className="text-3xl sm:text-3xl bar:text-3xl short:text-3xl tiny:text-2xl font-semibold leading-none">Pre-Flight <span className="text-accent">Config</span></h2>
                    </div>
                    <button 
                      onClick={() => setView('main-menu')}
                      className="shrink-0 whitespace-nowrap text-xs font-label uppercase tracking-label text-muted hover:text-accent transition-colors"
                    >
                      [ Abort_Mission ]
                    </button>
                  </div>

                  {/* On a phone held sideways the settings go into two columns. */}
                  <div className="space-y-8 bar:space-y-5 max-w-2xl mx-auto short:max-w-none short:space-y-0 short:grid short:grid-cols-2 short:gap-x-6 short:gap-y-3">
                    <div className="space-y-4 short:space-y-2 short:col-span-2">
                      <div className="block text-2xs font-semibold uppercase tracking-label text-muted">Game Mode</div>
                      <ScenarioPicker selectedId={newGameScenarioId} mode={newGameMode} onSelect={pickNewGameScenario} stars={scenarioStars} />
                      {newGameScenario && (
                        <p className="text-2xs text-muted">
                          {newGameScenario.title} sets the hub, start date, budget, difficulty and rivals below, so every
                          player faces the same challenge. Name, code, livery and debug mode are yours to choose.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4 short:space-y-2">
                        <label className="block text-2xs font-semibold uppercase tracking-label text-muted">Airline Name</label>
                        <input 
                          type="text" 
                          value={airlineName}
                          onChange={(e) => setAirlineName(e.target.value)}
                          placeholder="Neo Airlines"
                          className="w-full bg-raised border border-line p-4 short:p-2.5 font-mono text-sm outline-none focus:border-accent text-accent placeholder:text-muted"
                        />
                      </div>
                      <div className="space-y-4 short:space-y-2">
                        <label className="block text-2xs font-semibold uppercase tracking-label text-muted">Airline Code</label>
                        <input 
                          type="text" 
                          value={airlineCode}
                          onChange={handleAirlineCodeChange}
                          placeholder="NX"
                          className="w-full bg-raised border border-line p-4 short:p-2.5 font-mono text-sm outline-none focus:border-accent text-accent placeholder:text-muted"
                        />
                      </div>
                    </div>

                    <div className="space-y-4 short:space-y-2">
                      <div className="block text-2xs font-semibold uppercase tracking-label text-muted">Livery</div>
                      <div className="bg-raised border border-line p-4 short:p-2.5">
                        <BrandingPicker
                          value={newGameBranding}
                          onChange={setNewGameBranding}
                          code={airlineCode}
                          name={airlineName}
                        />
                      </div>
                      <p className="text-2xs text-muted">Your routes and aircraft are drawn in this colour; rivals get colours clearly apart from it.</p>
                    </div>

                    <div className="space-y-4 short:space-y-2">
                      <div className="flex justify-between items-end gap-2">
                        <label htmlFor="new-game-hub" className="block text-2xs font-semibold uppercase tracking-label text-muted">Select Hub</label>
                        <ScenarioLock scenario={newGameScenario} />
                      </div>
                      <button
                        id="new-game-hub"
                        type="button"
                        disabled={!!newGameScenario}
                        onClick={() => setHubPickerOpen(true)}
                        className="relative w-full text-left bg-raised border border-line p-4 short:py-2.5 pl-4 pr-10 font-mono text-sm text-ink hover:border-accent/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-line"
                      >
                        {(() => {
                          const hubAirport = airportsMapAdjusted.get(selectedHub);
                          return hubAirport ? `${hubAirport.name} (${hubAirport.id}) - Level ${hubAirport.level}` : selectedHub;
                        })()}
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                          <ChevronDown size={16} />
                        </span>
                      </button>
                      {hubPickerOpen && !newGameScenario && (
                        <React.Suspense fallback={null}>
                        <HubPickerModal
                          airports={airportsByName}
                          maxLevel={newGameMode === 'normal' ? maxAirportLevel(0) : 7}
                          rankTitle={rankDef(0).title}
                          year={yearOf(startDateOffset)}
                          selectedId={selectedHub}
                          onSelect={setSelectedHub}
                          onClose={() => setHubPickerOpen(false)}
                        />
                        </React.Suspense>
                      )}
                    </div>

                    <div className="space-y-4 short:space-y-2">
                      <div className="flex justify-between items-end gap-2">
                        <label className="block text-2xs font-semibold uppercase tracking-label text-muted">Difficulty</label>
                        <ScenarioLock scenario={newGameScenario} />
                      </div>
                      <div className="flex gap-4">
                        {['Easy', 'Normal', 'Hard'].map((diff) => (
                          <button
                            key={diff}
                            disabled={!!newGameScenario}
                            onClick={() => setDifficulty(diff)}
                            className={`flex-1 p-4 short:p-2.5 font-mono text-sm border transition-colors disabled:cursor-not-allowed ${difficulty === diff ? 'bg-accent text-on-accent border-accent' : 'bg-raised border-line text-ink hover:border-accent disabled:opacity-40 disabled:hover:border-line'}`}
                          >
                            {diff}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 short:space-y-2">
                      <div className="flex justify-between items-end gap-2">
                        <label className="block text-2xs font-semibold uppercase tracking-label text-muted">Starting Budget</label>
                        <ScenarioLock scenario={newGameScenario} />
                      </div>
                      {newGameScenario ? (
                        <div className="p-4 short:p-2.5 font-label text-xs border uppercase tracking-label bg-accent/10 border-accent/40 text-accent">
                          {formatCurrency(newGameScenario.capital)} and the scenario's fleet
                        </div>
                      ) : (
                      <div className="flex flex-wrap gap-4">
                        {['$25M', '$50M', '$100M', '$200M'].map((budget) => (
                          <button
                            key={budget}
                            onClick={() => setStartingBudget(budget)}
                            className={`flex-1 min-w-[100px] p-4 short:p-2.5 font-label text-xs border uppercase tracking-label transition-colors ${startingBudget === budget ? 'bg-accent text-on-accent border-accent' : 'bg-raised border-line text-ink hover:border-accent'}`}
                          >
                            {budget}
                          </button>
                        ))}
                      </div>
                      )}
                    </div>

                    <div className="space-y-4 short:space-y-2">
                      <label className="block text-2xs font-semibold uppercase tracking-label text-muted">Debug Mode</label>
                      <div className="flex gap-4">
                        {[
                          { label: 'Deactivated (Normal Play)', value: false },
                          { label: 'Activated (Debug Info)', value: true }
                        ].map((opt) => (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => {
                              setDebugMode(opt.value);
                              writeString('airline_debug_mode', String(opt.value));
                            }}
                            className={`flex-1 p-4 short:p-2.5 font-label text-xs border uppercase tracking-label transition-all ${debugMode === opt.value ? 'bg-accent text-on-accent border-accent font-semibold' : 'bg-raised border-line text-ink hover:border-accent/50'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-2xs text-muted">When activated, real-time demand calculation and pricing base debug tools are enabled.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4 short:space-y-2">
                        <div className="flex justify-between items-end">
                          <label htmlFor="new-game-rivals" className="block text-2xs font-semibold uppercase tracking-label text-muted">AI-Controlled Airlines</label>
                          <span className="flex items-center gap-3">
                            <ScenarioLock scenario={newGameScenario} />
                            <span className="text-xl font-mono text-accent">{aiAirlinesCount}</span>
                          </span>
                        </div>
                        <input 
                          id="new-game-rivals"
                          type="range"
                          min="0"
                          max="12"
                          value={aiAirlinesCount}
                          disabled={!!newGameScenario}
                          onChange={(e) => setAiAirlinesCount(parseInt(e.target.value))}
                          className="w-full appearance-none bg-raised h-2 outline-none slider-thumb disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                        <div className="flex justify-between text-2xs font-mono text-muted">
                          <span>0</span>
                          <span>12</span>
                        </div>
                      </div>
                      <div className="space-y-4 short:space-y-2">
                        <div className="flex justify-between items-end gap-2">
                          <label htmlFor="new-game-rival-difficulty" className="block text-2xs font-semibold uppercase tracking-label text-muted">Opponent Difficulty</label>
                          <ScenarioLock scenario={newGameScenario} />
                        </div>
                        <select 
                          id="new-game-rival-difficulty"
                          value={aiDifficulty}
                          disabled={!!newGameScenario}
                          onChange={(e) => setAiDifficulty(e.target.value)}
                          className="w-full bg-raised border border-line p-4 short:p-2.5 font-mono text-sm outline-none focus:border-accent text-ink disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option>Easy</option>
                          <option>Normal</option>
                          <option>Hard</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4 short:space-y-2">
                      <div className="flex justify-between items-end gap-2">
                        <label htmlFor="new-game-start" className="block text-2xs font-semibold uppercase tracking-label text-muted">Start Date</label>
                        <span className="flex items-center gap-3">
                          <ScenarioLock scenario={newGameScenario} />
                          <span className="text-xl font-mono text-accent">{formatDate(startDateOffset)}</span>
                        </span>
                      </div>
                      <input 
                        id="new-game-start"
                        type="range"
                        min="0"
                        max="731"
                        value={startDateOffset}
                        disabled={!!newGameScenario}
                        onChange={(e) => setStartDateOffset(parseInt(e.target.value))}
                        className="w-full appearance-none bg-raised h-2 outline-none slider-thumb disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      <div className="flex justify-between text-2xs font-mono text-muted">
                        <span>01/1960</span>
                        <span>12/2020</span>
                      </div>
                    </div>

                    <div className="space-y-4 short:space-y-2">
                      <label className="block text-2xs font-semibold uppercase tracking-label text-accent">Initial Save File Name</label>
                      <input 
                        type="text" 
                        value={initialSaveFileName}
                        onChange={(e) => setInitialSaveFileName(e.target.value)}
                        placeholder="My Airline Save 1"
                        className="w-full bg-raised border border-accent/30 p-4 short:p-2.5 font-mono text-sm outline-none focus:border-accent text-accent placeholder:text-muted"
                      />
                      <p className="text-2xs text-muted mt-2">A save file name must be provided to initialize the system.</p>
                    </div>
                    
                    {/* Kept in reach at the foot of the screen on phones, rather than
                        at the end of the whole form. */}
                    <div className="pt-8 flex justify-end short:col-span-2 bar:sticky short:sticky bar:bottom-0 short:bottom-0 bar:z-10 short:z-10 bar:pt-2 short:pt-2 bar:pb-1 short:pb-1 bar:bg-ground short:bg-ground">
                      <button 
                        onClick={() => {
                          if (!initialSaveFileName.trim()) {
                            setAppAlert("You must provide a save file name to begin.");
                            return;
                          }
                          startNewGame(initialSaveFileName.trim(), newGameScenario);
                        }}
                        className="group flex items-center bg-accent text-on-accent px-4 py-4 short:py-2.5 tiny:py-2 font-semibold uppercase tracking-label hover:bg-ink transition-all w-full md:w-auto"
                      >
                        Start Game
                        <ChevronRight size={20} className="ml-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
    </>
  );
}
