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
    <span className="flex items-center gap-1 text-2xs font-label uppercase tracking-label text-accent whitespace-nowrap">
      <Lock size={10} aria-hidden="true" /> Set by {scenario.title}
    </span>
  );
}

export function ThemeMenuButton({ 
  index, 
  label, 
  onClick, 
  primary = false,
  disabled = false 
}: { 
  index: string, 
  label: string, 
  onClick: () => void,
  primary?: boolean,
  disabled?: boolean
}) {
  return (
    <button 
      onClick={disabled ? undefined : onClick}
      className={`
 group flex items-center p-1 transition-all
 ${disabled ? 'opacity-30 cursor-not-allowed grayscale' : 'cursor-pointer'}
        ${primary 
          ? 'bg-ink text-on-accent hover:bg-accent' 
          : 'bg-raised border border-line text-ink hover:border-accent'}
      `}
    >
      <span className={`
 px-4 py-3 short:py-2 font-mono text-sm transition-all
 ${primary 
          ? 'bg-ground text-ink group-hover:bg-ink group-hover:text-on-accent' 
          : 'bg-raised text-muted group-hover:bg-accent/20 group-hover:text-accent'}
      `}>
        {index}
      </span>
      {/* Tighter letter spacing on narrow phones, so "Resume Game" stays on one line. */}
      <span className="flex-1 text-left px-3 font-semibold text-lg whitespace-nowrap">
        {label}
      </span>
      <span className={`pr-6 opacity-0 group-hover:opacity-100 transition-all ${primary ? 'text-on-accent' : 'text-accent'}`}>
        →
      </span>
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
  return <StatTile size="sm" compact label={label} value={value} trend={trend} goodDirection={goodDirection} />;
}

export function GameMenuOption({ label, onClick }: { label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="text-left px-4 py-3 text-2xs font-label uppercase tracking-label text-muted hover:text-accent hover:bg-raised transition-all outline-none"
    >
      {label}
    </button>
  );
}
