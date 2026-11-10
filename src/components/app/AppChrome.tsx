/**
 * Small pieces of the application frame: menu buttons, the navigation button,
 * the top bar's figures. They hold no state and were part of App.tsx.
 */
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import type { Scenario } from '../../data/scenarios';
import { StatTile } from '../ui/StatTile';

/** Why a new-game field cannot be changed: the scenario picked above sets it. */
export function ScenarioLock({ scenario }: { scenario?: Scenario }) {
  if (!scenario) return null;
  return (
    <span className="flex items-center gap-1 text-3xs font-mono uppercase tracking-widest text-aero-yellow/70 whitespace-nowrap">
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
          ? 'bg-white text-black hover:bg-aero-yellow' 
          : 'bg-aero-carbon border border-white/10 text-white hover:border-aero-yellow'}
      `}
    >
      <span className={`
        px-4 py-3 short:py-2 font-mono text-sm transition-all
        ${primary 
          ? 'bg-black text-white group-hover:bg-white group-hover:text-black' 
          : 'bg-white/10 text-white/40 group-hover:bg-aero-yellow/20 group-hover:text-aero-yellow'}
      `}>
        {index}
      </span>
      {/* Tighter letter spacing on narrow phones, so "Resume Game" stays on one line. */}
      <span className="flex-1 text-left px-3 font-black uppercase tracking-wider sm:tracking-widest text-lg italic whitespace-nowrap">
        {label}
      </span>
      <span className={`pr-6 opacity-0 group-hover:opacity-100 transition-all ${primary ? 'text-black' : 'text-aero-yellow'}`}>
        →
      </span>
    </button>
  );
}

/**
 * A real <button>, not a clickable <div>. The whole primary navigation used to
 * be unreachable by keyboard, and the 7.5px label was the smallest type in the
 * interface.
 *
 * On upright phones all eight buttons share one row of the bottom bar, and on
 * sideways phones one short column, so both use `shortLabel` (when given),
 * smaller icons and tighter letter spacing. With the browser's address bar
 * also showing (tiny) even that column is too tall, so the labels move to
 * the tooltip and screen readers and only the icons remain.
 */
export function SidebarIcon({ icon, label, shortLabel, active = false, onClick, tour }: { icon: ReactNode, label: string, shortLabel?: string, active?: boolean, onClick?: () => void, tour?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tour={tour}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={`
      py-1.5 short:py-1 tiny:py-1.5 flex flex-col items-center gap-0.5 cursor-pointer transition-all flex-auto rail:flex-none rail:w-full select-none bg-transparent border-0
      focus-visible:outline focus-visible:outline-2 focus-visible:outline-aero-yellow
      ${active ? 'text-aero-yellow opacity-100' : 'text-white opacity-40 hover:opacity-100 hover:text-white'}
    `}>
      <div className={`p-1 rail:p-1.5 short:p-0.5 rounded-sm border border-transparent [&_svg]:size-6 rail:[&_svg]:size-7 short:[&_svg]:size-5 ${active ? 'bg-aero-yellow/10 border-aero-yellow/20' : 'bg-transparent'}`}>
        {icon}
      </div>
      <span className="text-3xs font-black tracking-tight rail:tracking-widest short:tracking-tight text-center px-0.5 rail:px-1 short:px-0.5 leading-[1.2] tiny:sr-only">
        <span className="rail:hidden short:inline">{shortLabel ?? label}</span>
        <span className="hidden rail:inline short:hidden">{label}</span>
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
      className="text-left px-4 py-3 text-2xs font-mono uppercase tracking-widest text-white/70 hover:text-aero-yellow hover:bg-white/5 transition-all outline-none"
    >
      {label}
    </button>
  );
}
