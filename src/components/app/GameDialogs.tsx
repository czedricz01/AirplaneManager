/** The dialogs a game puts to the player: event decisions, strikes and disruptions, bird strikes, retirement, goal offers, the scenario result and plain alerts. */
import type { Scenario } from '../../data/scenarios';
import type { AnnualGoal } from '../../lib/annualGoals';
import type { HallOfFameEntry, ScoreBreakdown } from '../../lib/careerScore';
import type { BirdStrike } from '../../lib/disruptions';
import type { HistoricalEvent } from '../../lib/eventSystem';
import type { Branding, Career, GameDecision, ScenarioState } from '../../lib/gameState';
import type { SimulatedRoute } from '../../lib/gameTypes';
import type { OwnedAircraft } from '../MyFleetView';
import React from 'react';
import { Modal } from '../ui/Modal';
import { AlertTriangle, Bird, CheckCircle2, RotateCcw, Trophy } from 'lucide-react';
import { EventChoice, eventKey } from '../../lib/eventSystem';
import { formatCurrency, formatMoneyCompact } from '../../lib/format';
import { RetirementDialog } from '../RetirementDialog';
import { GoalOfferDialog } from '../GoalOfferDialog';
import { scenarioById } from '../../data/scenarios';

export interface GameDialogsProps {
  pendingDecision: HistoricalEvent | null;
  isNewspaperOpen: boolean;
  scenarioResultOpen: boolean;
  capital: number;
  spend: (amount: number, label: string) => void;
  setEventChoices: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPendingDecision: React.Dispatch<React.SetStateAction<HistoricalEvent | null>>;
  pendingDecisions: GameDecision[];
  resolveDecision: (decisionId: string, optionId: string) => void;
  retirement: { entry: HallOfFameEntry; position: number | null; } | null;
  airlineName: string;
  score: ScoreBreakdown;
  hall: HallOfFameEntry[];
  setRetirement: React.Dispatch<React.SetStateAction<{ entry: HallOfFameEntry; position: number | null; } | null>>;
  returnToMainMenu: () => void;
  career: Career;
  goalOfferOpen: boolean;
  handleChooseGoal: (goal: AnnualGoal) => void;
  setGoalOfferOpen: React.Dispatch<React.SetStateAction<boolean>>;
  birdStrikeAlerts: BirdStrike[];
  fleet: OwnedAircraft[];
  routes: SimulatedRoute[];
  setBirdStrikeAlerts: React.Dispatch<React.SetStateAction<BirdStrike[]>>;
  scenario: ScenarioState | null;
  currentDateOffset: number;
  reputation: number;
  setScenarioResultOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowExitSavePrompt: React.Dispatch<React.SetStateAction<boolean>>;
  currentSaveName: string | null;
  startNewGame: (saveName: string, chosen?: Scenario, keepBranding?: Branding) => void;
  branding: Branding;
  toast: string | null;
  appAlert: string | null;
  setAppAlert: React.Dispatch<React.SetStateAction<string | null>>;
}

export function GameDialogs({
  pendingDecision, isNewspaperOpen, scenarioResultOpen, capital, spend, setEventChoices, setPendingDecision, pendingDecisions, resolveDecision, retirement, airlineName, score, hall, setRetirement, returnToMainMenu, career, goalOfferOpen, handleChooseGoal, setGoalOfferOpen, birdStrikeAlerts, fleet, routes, setBirdStrikeAlerts, scenario, currentDateOffset, reputation, setScenarioResultOpen, setShowExitSavePrompt, currentSaveName, startNewGame, branding, toast, appAlert, setAppAlert
}: GameDialogsProps) {
  return (
    <>
          {pendingDecision && !isNewspaperOpen && !scenarioResultOpen && (
            <Modal open size="lg" accent="warn" layer="top">
              <h3 className="text-bad font-semibold text-lg mb-1 flex items-center gap-2">
                <AlertTriangle size={22} /> {pendingDecision.title}
              </h3>
              <p className="text-2xs text-muted mb-4 leading-relaxed">
                {pendingDecision.description} Running for {pendingDecision.duration} months.
              </p>

              <div className="space-y-2">
                {pendingDecision.choices?.map((choice: EventChoice) => {
                  const affordable = capital >= choice.cost;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      disabled={!affordable}
                      onClick={() => {
                        if (choice.cost > 0) spend(choice.cost, `Crisis response: ${pendingDecision.title}`);
                        setEventChoices(prev => ({ ...prev, [eventKey(pendingDecision)]: choice.id }));
                        setPendingDecision(null);
                      }}
                      className="w-full text-left p-3 border border-line bg-surface hover:border-accent hover:bg-raised transition-all disabled:opacity-40 disabled:hover:border-line disabled:cursor-not-allowed rounded-sm"
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span className="font-semibold uppercase tracking-label text-2xs text-ink">{choice.label}</span>
                        <span className={`font-mono text-2xs font-semibold shrink-0 ${choice.cost > 0 ? 'text-accent' : 'text-good'}`}>
                          {choice.cost > 0 ? formatCurrency(choice.cost) : 'No cost'}
                        </span>
                      </div>
                      <p className="text-2xs text-muted leading-relaxed">{choice.detail}</p>
                      {!affordable && (
                        <p className="text-2xs font-mono text-bad mt-1">
                          {formatCurrency(choice.cost - capital)} short.
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setPendingDecision(null)}
                  className="px-3 py-2 text-muted hover:text-ink text-2xs font-label uppercase tracking-label transition-colors bg-transparent border-0"
                >
                  Decide later (does nothing)
                </button>
              </div>
            </Modal>
          )}
          {/* Any other question for the player, one at a time. Waits while a
              world event decision or the newspaper is open, so none stack. */}
          {!pendingDecision && !isNewspaperOpen && !scenarioResultOpen && pendingDecisions.length > 0 && (() => {
            const decision = pendingDecisions[0];
            return (
              <Modal open size="lg" accent="warn" layer="top">
                <h3 className="text-bad font-semibold text-lg mb-1 flex items-center gap-2">
                  <AlertTriangle size={22} /> {decision.title}
                </h3>
                <p className="text-2xs text-muted mb-4 leading-relaxed">
                  {decision.description}
                </p>

                <div className="space-y-2">
                  {decision.options.map(option => {
                    const affordable = option.cost <= 0 || capital >= option.cost;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={!affordable}
                        onClick={() => resolveDecision(decision.id, option.id)}
                        className="w-full text-left p-3 border border-line bg-surface hover:border-accent hover:bg-raised transition-all disabled:opacity-40 disabled:hover:border-line disabled:cursor-not-allowed rounded-sm"
                      >
                        <div className="flex items-baseline justify-between gap-3 mb-1">
                          <span className="font-semibold uppercase tracking-label text-2xs text-ink">{option.label}</span>
                          <span className={`font-mono text-2xs font-semibold shrink-0 ${option.cost > 0 ? 'text-accent' : 'text-good'}`}>
                            {option.cost > 0 ? formatCurrency(option.cost) : 'No cost'}
                          </span>
                        </div>
                        <p className="text-2xs text-muted leading-relaxed">{option.detail}</p>
                        {!affordable && (
                          <p className="text-2xs font-mono text-bad mt-1">
                            {formatCurrency(option.cost - capital)} short.
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Modal>
            );
          })()}
          <RetirementDialog
            open={!!retirement}
            airline={airlineName}
            score={score}
            entry={retirement?.entry ?? null}
            position={retirement?.position ?? null}
            hall={hall}
            onKeepPlaying={() => setRetirement(null)}
            onMainMenu={() => { setRetirement(null); returnToMainMenu(); }}
          />
          {/* The board's goals for the coming year, after the December close. */}
          <GoalOfferDialog
            offer={career.goalOffer}
            open={goalOfferOpen && !pendingDecision && !isNewspaperOpen && !scenarioResultOpen && pendingDecisions.length === 0}
            onChoose={handleChooseGoal}
            onLater={() => setGoalOfferOpen(false)}
          />
          {/* A bird strike: the bill is paid already, this only says so. Waits
              for the newspaper and any question, like they wait for each other. */}
          {!pendingDecision && !isNewspaperOpen && !scenarioResultOpen && pendingDecisions.length === 0 && birdStrikeAlerts.length > 0 && (() => {
            const strike = birdStrikeAlerts[0];
            const plane = fleet.find(f => f.registration === strike.registration);
            const route = routes.find(r => r.id === strike.routeId);
            const dismiss = () => setBirdStrikeAlerts(prev => prev.slice(1));
            return (
              <Modal open size="sm" accent="warn" layer="top" onClose={dismiss}>
                <div role="alertdialog" aria-labelledby="bird-strike-title" aria-describedby="bird-strike-detail">
                  <h3 id="bird-strike-title" className="text-bad font-semibold text-lg mb-1 flex items-center gap-2">
                    <Bird size={22} aria-hidden="true" /> Bird strike
                  </h3>
                  <p className="text-3xl font-mono font-semibold text-bad tabular-nums my-3">{formatCurrency(-strike.cost)}</p>
                  <p id="bird-strike-detail" className="text-2xs text-muted mb-4 leading-relaxed">
                    {strike.registration}{plane ? ` (${plane.manufacturer} ${plane.type})` : ''} hit a flock of birds{route ? ` on ${route.origin}-${route.destination}` : ''}.
                    The repair bill was deducted from your balance.
                  </p>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      autoFocus
                      onClick={dismiss}
                      className="px-3 py-2 bg-raised hover:bg-raised text-ink font-semibold uppercase tracking-label transition-colors rounded-sm"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </Modal>
            );
          })()}
          {/* The scenario's verdict, once, after the newspaper that reports it.
              Any question the same close raised waits until it is closed. */}
          {scenarioResultOpen && !isNewspaperOpen && scenario && scenario.status !== 'running' && (() => {
            const decided = scenarioById(scenario.id);
            if (!decided) return null;
            const won = scenario.status === 'won';
            const months = (scenario.result?.offset ?? currentDateOffset) - scenario.startedOffset + 1;
            const stats = [
              { label: 'Capital', value: formatMoneyCompact(capital) },
              { label: 'Routes', value: String(routes.length) },
              { label: 'Fleet', value: String(fleet.length) },
              { label: 'Reputation', value: String(Math.round(reputation)) },
              { label: 'Months played', value: String(months) }
            ];
            return (
              <Modal open size="lg" accent={won ? 'yellow' : 'warn'} layer="top">
                <div role="alertdialog" aria-labelledby="scenario-result-title" aria-describedby="scenario-result-reason">
                  <div className={`flex items-center gap-3 mb-2 ${won ? 'text-accent' : 'text-bad'}`}>
                    {won ? <Trophy size={28} aria-hidden="true" /> : <AlertTriangle size={28} aria-hidden="true" />}
                    <div>
                      <div className="text-2xs font-label uppercase tracking-label text-muted">Scenario {won ? 'complete' : 'failed'}</div>
                      <h3 id="scenario-result-title" className="font-semibold text-xl leading-tight">
                        {decided.title}: {won ? 'you did it' : 'out of reach'}
                      </h3>
                    </div>
                  </div>
                  <p id="scenario-result-reason" className="text-sm text-ink leading-relaxed mb-4">{scenario.result?.reason}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                    {stats.map(st => (
                      <div key={st.label} className="border border-line bg-surface px-2 py-2">
                        <div className="text-2xs font-label uppercase tracking-label text-muted">{st.label}</div>
                        <div className="text-sm font-mono font-semibold text-ink tabular-nums truncate">{st.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-2xs text-muted mb-4 leading-relaxed">
                    {won
                      ? 'The result is written into your chronicle. Fly on without the scenario, or leave for the main menu.'
                      : 'The airline still flies: carry on without the scenario, or start it over.'}
                  </p>
                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    {won ? (
                      <>
                        <button
                          type="button"
                          onClick={() => { setScenarioResultOpen(false); setShowExitSavePrompt(true); }}
                          className="px-3 py-2 border border-line text-muted hover:text-ink hover:border-rule font-label text-2xs uppercase tracking-label transition-colors"
                        >
                          Main menu
                        </button>
                        <button
                          type="button"
                          autoFocus
                          onClick={() => setScenarioResultOpen(false)}
                          className="px-3 py-2 bg-accent text-on-accent border border-accent hover:bg-ink hover:border-ink font-label text-2xs font-semibold uppercase tracking-label transition-colors"
                        >
                          Continue without the scenario
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setScenarioResultOpen(false)}
                          className="px-3 py-2 border border-line text-muted hover:text-ink hover:border-rule font-label text-2xs uppercase tracking-label transition-colors"
                        >
                          Continue without the scenario
                        </button>
                        <button
                          type="button"
                          autoFocus
                          onClick={() => {
                            const base = (currentSaveName || decided.title).replace(/\s*\((Autosave.*|retry)\)$/, '');
                            startNewGame(`${base} (retry)`, decided, branding);
                          }}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-accent text-on-accent border border-accent hover:bg-ink hover:border-ink font-label text-2xs font-semibold uppercase tracking-label transition-colors"
                        >
                          <RotateCcw size={14} aria-hidden="true" /> Try again
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </Modal>
            );
          })()}
          {toast && (
            <div
              role="status"
              aria-live="polite"
              className="fixed top-16 left-1/2 -translate-x-1/2 z-[4000] flex items-center gap-2 bg-raised border border-good/40 px-4 py-2 text-xs text-ink pointer-events-none"
            >
              <CheckCircle2 size={14} className="text-good shrink-0" />
              {toast}
            </div>
          )}
          {appAlert && (
            <Modal open size="md" layer="top" onClose={() => setAppAlert(null)}>
              <h3 className="text-accent font-semibold text-lg mb-4 flex items-center gap-2">
                <AlertTriangle size={24} /> System Alert
              </h3>
              <p className="text-ink mb-3">{appAlert}</p>
              <div className="flex justify-end">
                <button
                  onClick={() => setAppAlert(null)}
                  className="px-3 py-2 bg-raised hover:bg-raised text-ink font-semibold uppercase tracking-label transition-colors rounded-sm"
                >
                  OK
                </button>
              </div>
            </Modal>
          )}
    </>
  );
}
