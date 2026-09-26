import type { ReactNode } from 'react';

export type StatTileSize = 'sm' | 'md';

interface StatTileProps {
  label: string;
  value: ReactNode;
  /** Compact (GameStat-style, e.g. the top stats bar) or panel (KPI-card style). */
  size?: StatTileSize;
  trend?: string;
  /** Which direction of `trend` counts as good news — demand falling is bad, fuel price falling is good. */
  goodDirection?: 'up' | 'down';
  valueClassName?: string;
  /** size="sm" only: extra classes for the label, e.g. to keep it on one line. */
  labelClassName?: string;
  /** Extra content under the value: a subtitle line, a progress bar, etc. */
  children?: ReactNode;
  /**
   * size="sm" only. Denser on phones, for the game's top stats bar: smaller
   * figures upright, and label beside value on a phone held sideways, where
   * the bar is a single slim strip.
   */
  compact?: boolean;
}

export function StatTile({
  label,
  value,
  size = 'md',
  trend,
  goodDirection = 'up',
  valueClassName = '',
  labelClassName = '',
  children,
  compact = false,
}: StatTileProps) {
  const isNegative = Boolean(trend && trend.includes('-'));
  const isGood = goodDirection === 'up' ? !isNegative : isNegative;
  const trendColor = isGood ? 'text-aero-good font-bold' : 'text-aero-warn font-bold';

  if (size === 'sm') {
    return (
      <div className={`flex flex-col items-center ${compact ? 'short:flex-row short:items-baseline short:gap-1.5 short:shrink-0' : ''}`}>
        <span className={`text-3xs uppercase tracking-widest text-white/40 font-bold mb-1 leading-none text-center ${compact ? 'bar:mb-0.5 short:mb-0 short:whitespace-nowrap' : ''} ${labelClassName}`}>{label}</span>
        <div className="flex items-baseline justify-center gap-1.5 leading-none">
          <span className={`text-sm md:text-base ${compact ? 'bar:text-[13px] short:text-xs short:whitespace-nowrap' : ''} font-black italic tracking-tighter text-white font-mono ${valueClassName}`}>{value}</span>
          {trend && <span className={`${trendColor} font-mono text-3xs`}>{trend}</span>}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="bg-aero-panel border border-white/10 rounded-sm p-4 bar:p-3 short:p-2.5">
      <span className="text-2xs uppercase tracking-widest text-white/40 font-black mb-2 short:mb-1 block">{label}</span>
      {/* Phones: smaller (an eight-figure sum fits a half-width tile at 360px),
          and a longer figure wraps inside the tile instead of running over its
          border. */}
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={`text-lg sm:text-xl md:text-2xl short:text-lg font-mono font-bold text-white/80 min-w-0 [overflow-wrap:anywhere] ${valueClassName}`}>{value}</span>
        {trend && <span className={`${trendColor} font-mono text-2xs`}>{trend}</span>}
      </div>
      {children}
    </div>
  );
}
