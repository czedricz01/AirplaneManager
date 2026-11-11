/**
 * Small pieces of the application frame: menu buttons and the top bar's
 * figures. They hold no state and were part of App.tsx.
 */
import { Lock } from 'lucide-react';
import type { Scenario } from '../../data/scenarios';
import { StatTile } from '../ui/StatTile';

/** Why a new-game field cannot be changed: the scenario picked above sets it. */
export function ScenarioLock({ scenario }: { scenario?: Scenario }) {
  if (!scenario) return null;
  return (
    <span className="flex items-center gap-1 text-2xs font-label uppercase tracking-label text-muted whitespace-nowrap">
      <Lock size={10} aria-hidden="true" /> Set by {scenario.title}
    </span>
  );
}

/** A row of the main menu: what it does on the left, a short note on the right. */
export function ThemeMenuButton({
  label,
  hint,
  onClick,
  primary = false,
  disabled = false
}: {
  label: string,
  hint?: string,
  onClick: () => void,
  primary?: boolean,
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full min-h-12 px-4 flex items-center justify-between gap-3 border rounded-sm text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        primary ? 'bg-accent border-accent text-on-accent hover:bg-ink hover:border-ink' : 'bg-surface border-rule text-ink hover:bg-raised hover:border-ink'
      }`}
    >
      <span className="font-label font-semibold text-lg">{label}</span>
      {hint && <span className={`text-xs ${primary ? 'text-on-accent' : 'text-muted'}`}>{hint}</span>}
    </button>
  );
}

/**
 * `goodDirection` says which way is good news for this particular stat, because
 * the sign alone does not: demand falling is bad, the fuel price falling is
 * good. Thin wrapper over the shared StatTile so the top stats bar uses the
 * same tile component as every KPI card elsewhere in the app.
 */
export function GameStat(
  { label, value, trend, goodDirection = 'up' }:
  { label: string, value: string, trend?: string, goodDirection?: 'up' | 'down' }
) {
  return <StatTile size="sm" compact labelClassName="whitespace-nowrap" label={label} value={value} trend={trend} goodDirection={goodDirection} />;
}

export function GameMenuOption({ label, onClick }: { label: string, onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left px-3.5 min-h-10 bar:min-h-11 text-sm text-ink hover:bg-raised transition-colors"
    >
      {label}
    </button>
  );
}
