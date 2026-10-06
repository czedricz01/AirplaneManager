import { Compass, Flag, Infinity, Lock, Plane, Star, Wallet, Users } from 'lucide-react';
import { SCENARIOS, type Scenario, type ScenarioRating } from '../data/scenarios';
import { aircraftList } from '../data/aircraft';
import { airportsMapAdjusted } from '../data/airportRegistry';
import { formatMoneyCompact, formatMonthOffset } from '../lib/format';
import { SCENARIO_ORDER, scenarioUnlocked, type ScenarioStars } from '../lib/careerScore';
import type { GameMode } from '../lib/airlineRank';

const RATING_TONE: Record<ScenarioRating, string> = {
  Moderate: 'text-aero-good border-aero-good/40',
  Hard: 'text-aero-yellow border-aero-yellow/40',
  Expert: 'text-aero-warn border-aero-warn/40'
};

/** "1× Boeing 707-420, 2× Caravelle III" */
function fleetLine(scenario: Scenario): string {
  return scenario.fleet
    .map(e => {
      const spec = aircraftList.find(a => a.id === e.model);
      return `${e.count}× ${spec ? `${spec.manufacturer} ${spec.type}` : e.model}${e.ageMonths ? ' (used)' : ''}`;
    })
    .join(', ');
}

export interface ScenarioPickerProps {
  /** The picked scenario's id; null for a game without one. */
  selectedId: string | null;
  /** Normal Mode or Free Mode, for a game without a scenario. */
  mode: GameMode;
  /** The picked scenario, or null with the mode picked. */
  onSelect: (id: string | null, mode: GameMode) => void;
  /** Best stars earned per scenario; a scenario opens once the one before it has a star. */
  stars?: ScenarioStars;
}

/**
 * The new-game screen's mode picker: Normal Mode, Free Mode, or one of the
 * scenarios, each card saying where and when it starts, what it asks and with what.
 */
export function ScenarioPicker({ selectedId, mode, onSelect, stars }: ScenarioPickerProps) {
  const card = (selected: boolean) =>
    `relative w-full h-full flex flex-col items-stretch justify-start text-left p-4 short:p-3 border rounded-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-aero-yellow ${
      selected ? 'bg-aero-yellow/10 border-aero-yellow' : 'bg-aero-carbon border-white/10 hover:border-aero-yellow/50'
    }`;

  return (
    <div role="radiogroup" aria-label="Game mode" className="grid grid-cols-1 md:grid-cols-2 short:grid-cols-3 gap-3 short:gap-2">
      <button type="button" role="radio" aria-checked={selectedId === null && mode === 'normal'} onClick={() => onSelect(null, 'normal')} className={card(selectedId === null && mode === 'normal')}>
        <div className="flex items-center gap-2 mb-2">
          <Compass size={16} className={selectedId === null && mode === 'normal' ? 'text-aero-yellow' : 'text-white/50'} aria-hidden="true" />
          <span className="font-black uppercase tracking-widest text-sm text-white">Normal Mode</span>
        </div>
        <p className="text-2xs font-mono text-white/50 leading-relaxed">
          Start as a Startup and earn your way up ten ranks, from Local Airline to Global Player. Bigger airports,
          more hubs and new aircraft classes open step by step. Any hub, any year from 1960, no deadline. The climb
          takes years, so a late start leaves less time for it: Free Mode skips it.
        </p>
      </button>

      <button type="button" role="radio" aria-checked={selectedId === null && mode === 'free'} onClick={() => onSelect(null, 'free')} className={card(selectedId === null && mode === 'free')}>
        <div className="flex items-center gap-2 mb-2">
          <Infinity size={16} className={selectedId === null && mode === 'free' ? 'text-aero-yellow' : 'text-white/50'} aria-hidden="true" />
          <span className="font-black uppercase tracking-widest text-sm text-white">Free Mode</span>
        </div>
        <p className="text-2xs font-mono text-white/50 leading-relaxed">
          Start as a Global Player: no rank to earn. Every airport, every aircraft class and every development
          project is open from the first month, and the number of hubs is not limited. Build what you like.
        </p>
      </button>

      {SCENARIOS.map(sc => {
        const selected = selectedId === sc.id;
        const hub = airportsMapAdjusted.get(sc.hub);
        const earned = stars?.[sc.id] ?? 0;
        // Without stars given (an older caller) every scenario is open.
        const open = !stars || scenarioUnlocked(sc.id, stars);
        const previous = SCENARIOS.find(x => x.id === SCENARIO_ORDER[(SCENARIO_ORDER as readonly string[]).indexOf(sc.id) - 1]);
        return (
          <button
            key={sc.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={!open}
            onClick={() => { if (open) onSelect(sc.id, 'normal'); }}
            className={`${card(selected)} ${open ? '' : 'opacity-50 cursor-not-allowed'}`}
          >
            {!open && (
              <div className="flex items-center gap-1.5 text-2xs font-mono text-aero-warn mb-2">
                <Lock size={12} aria-hidden="true" /> Win {previous?.title ?? 'the scenario before'} first
              </div>
            )}
            {open && stars && (
              <div className="flex items-center gap-0.5 mb-1" aria-label={`${earned} of 3 stars`}>
                {[1, 2, 3].map(n => (
                  <Star key={n} size={13} aria-hidden="true" className={n <= earned ? 'text-aero-yellow fill-aero-yellow' : 'text-white/25'} />
                ))}
              </div>
            )}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <Flag size={16} className={selected ? 'text-aero-yellow shrink-0' : 'text-white/50 shrink-0'} aria-hidden="true" />
                <span className="font-black uppercase tracking-widest text-sm text-white truncate">{sc.title}</span>
              </div>
              <span className={`shrink-0 border px-1.5 py-0.5 text-4xs font-mono font-bold uppercase tracking-widest ${RATING_TONE[sc.rating]}`}>
                {sc.rating}
              </span>
            </div>
            <div className="text-3xs font-mono uppercase tracking-widest text-white/40 mb-2">
              {hub?.name || sc.hub} ({sc.hub}) · {formatMonthOffset(sc.startOffset)} – {formatMonthOffset(sc.deadlineOffset)}
            </div>
            <p className="text-2xs font-mono text-white/50 leading-relaxed mb-3">{sc.blurb}</p>
            <ul className="space-y-1 mb-3">
              {sc.win.map(g => (
                <li key={g.id} className="text-2xs font-bold text-white/85 flex gap-1.5">
                  <span className="text-aero-yellow" aria-hidden="true">▸</span>
                  <span>{g.label}{g.atDeadline ? '' : ` by ${formatMonthOffset(sc.deadlineOffset)}`}</span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-1 gap-1 text-3xs font-mono text-white/45">
              <span className="flex items-center gap-1.5"><Wallet size={11} aria-hidden="true" /> {formatMoneyCompact(sc.capital)} cash, no loans</span>
              <span className="flex items-center gap-1.5"><Plane size={11} aria-hidden="true" /> {fleetLine(sc)}</span>
              <span className="flex items-center gap-1.5"><Users size={11} aria-hidden="true" /> {sc.rivals.count} rivals ({sc.rivals.difficulty})</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
