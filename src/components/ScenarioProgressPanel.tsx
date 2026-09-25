import { useState } from 'react';
import { ChevronDown, Flag, ShieldAlert } from 'lucide-react';
import type { Scenario } from '../data/scenarios';
import { formatGoalValue, type GoalProgress } from '../lib/scenarioEval';
import { formatMonthOffset } from '../lib/format';
import { readString, writeString } from '../lib/safeStorage';

const STORAGE_KEY = 'aero_scenario_panel_open';

export interface ScenarioProgressPanelProps {
  scenario: Scenario;
  goals: GoalProgress[];
  /** Month closes still to come, the current one included. */
  monthsLeft: number;
}

/** The goal metrics that are a month's flow rather than a standing figure. */
const MONTHLY: ReadonlySet<string> = new Set(['transferPax', 'monthlyProfit']);

/**
 * The scenario's goals at a glance, floating over the map: a bar per goal,
 * the months left, and a warning once capital starts slipping towards
 * bankruptcy. Folds down to its title line; whether it is folded is kept per
 * browser.
 */
export function ScenarioProgressPanel({ scenario, goals, monthsLeft }: ScenarioProgressPanelProps) {
  const [open, setOpen] = useState(() => readString(STORAGE_KEY) !== 'false');
  const toggle = () => {
    setOpen(prev => {
      writeString(STORAGE_KEY, String(!prev));
      return !prev;
    });
  };

  const win = goals.filter(g => g.kind === 'win');
  const lose = goals.filter(g => g.kind === 'lose');
  const met = win.filter(g => g.done).length;
  const urgent = monthsLeft <= 6;

  return (
    <section
      aria-label={`Scenario: ${scenario.title}`}
      className="w-72 max-w-[calc(100vw-7rem)] bg-aero-black/90 backdrop-blur-sm border border-white/10 shadow-2xl font-mono pointer-events-auto"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-aero-yellow"
      >
        <Flag size={14} className="text-aero-yellow shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0">
          <span className="block text-2xs font-black uppercase tracking-widest text-white truncate">{scenario.title}</span>
          <span className={`block text-3xs uppercase tracking-widest ${urgent ? 'text-aero-warn' : 'text-white/45'}`}>
            {monthsLeft} month{monthsLeft === 1 ? '' : 's'} left · {met}/{win.length} goal{win.length === 1 ? '' : 's'} met
          </span>
        </span>
        <ChevronDown size={14} className={`text-white/50 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-white/5">
          {win.map(g => {
            const pct = Math.round(g.progress * 100);
            return (
              <div key={g.id}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-2xs text-white/80 leading-tight">{g.label}</span>
                  {g.atDeadline && <span className="text-4xs uppercase tracking-widest text-white/35 shrink-0">at deadline</span>}
                </div>
                <div
                  role="progressbar"
                  aria-label={g.label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  className="h-1.5 bg-white/10 overflow-hidden"
                >
                  <div className={`h-full ${g.done ? 'bg-aero-good' : 'bg-aero-yellow'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-3xs text-white/45 mt-1 tabular-nums">
                  <span className={g.done ? 'text-aero-good' : undefined}>{formatGoalValue(g.metric, g.current, true)}{MONTHLY.has(g.metric) && g.current !== null ? ' last month' : ''}</span>
                  <span>{formatGoalValue(g.metric, g.target, true)}</span>
                </div>
              </div>
            );
          })}

          {lose.map(g => {
            const danger = (g.streak ?? 0) > 0;
            return (
              <div key={g.id} className={`flex items-start gap-2 text-3xs leading-snug ${danger ? 'text-aero-warn' : 'text-white/40'}`}>
                <ShieldAlert size={12} className="shrink-0 mt-px" aria-hidden="true" />
                <span>
                  {danger
                    ? `Bankruptcy watch: capital below ${formatGoalValue('capitalFloor', g.target, true)} at ${g.streak} month-end${g.streak === 1 ? '' : 's'} in a row. ${g.months} end${g.months === 1 ? 's' : ''} the scenario.`
                    : g.label}
                </span>
              </div>
            );
          })}

          <div className="text-4xs uppercase tracking-widest text-white/30">
            Deadline {formatMonthOffset(scenario.deadlineOffset)}
          </div>
        </div>
      )}
    </section>
  );
}
