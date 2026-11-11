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
  const trendColor = isGood ? 'text-good' : 'text-bad';

  if (size === 'sm') {
    return (
      <div className={`flex flex-col justify-center px-3.5 py-2 bar:px-3 bar:py-1.5 ${compact ? 'short:flex-row short:items-baseline short:gap-1.5 short:py-0 short:shrink-0' : ''}`}>
        <span className={`font-label font-semibold text-2xs uppercase tracking-label text-muted leading-tight ${labelClassName}`}>{label}</span>
        <div className={`flex items-baseline gap-1.5 leading-none mt-1.5 ${compact ? 'short:mt-0' : ''}`}>
          <span className={`text-base ${compact ? 'short:text-sm' : ''} font-medium text-ink font-mono whitespace-nowrap ${valueClassName}`}>{value}</span>
          {trend && <span className={`${trendColor} font-mono text-2xs whitespace-nowrap`}>{trend}</span>}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="bg-surface border border-line p-4 bar:p-3 short:p-2.5">
      <span className="font-label text-2xs uppercase tracking-label text-muted font-semibold mb-2 short:mb-1 block">{label}</span>
      {/* Phones: smaller (an eight-figure sum fits a half-width tile at 360px),
          and a longer figure wraps inside the tile instead of running over its
          border. */}
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={`text-lg sm:text-xl short:text-lg font-mono font-medium text-ink min-w-0 [overflow-wrap:anywhere] ${valueClassName}`}>{value}</span>
        {trend && <span className={`${trendColor} font-mono text-2xs`}>{trend}</span>}
      </div>
      {children}
    </div>
  );
}
