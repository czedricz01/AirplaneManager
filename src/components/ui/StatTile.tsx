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
  /** Extra content under the value: a subtitle line, a progress bar, etc. */
  children?: ReactNode;
}

export function StatTile({
  label,
  value,
  size = 'md',
  trend,
  goodDirection = 'up',
  valueClassName = '',
  children,
}: StatTileProps) {
  const isNegative = Boolean(trend && trend.includes('-'));
  const isGood = goodDirection === 'up' ? !isNegative : isNegative;
  const trendColor = isGood ? 'text-aero-good font-bold' : 'text-aero-warn font-bold';

  if (size === 'sm') {
    return (
      <div className="flex flex-col items-center">
        <span className="text-3xs uppercase tracking-widest text-white/40 font-bold mb-1 leading-none text-center">{label}</span>
        <div className="flex items-baseline justify-center gap-1.5 leading-none">
          <span className={`text-sm md:text-base font-black italic tracking-tighter text-white font-mono ${valueClassName}`}>{value}</span>
          {trend && <span className={`${trendColor} font-mono text-3xs`}>{trend}</span>}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="bg-aero-panel border border-white/10 rounded-sm p-4">
      <span className="text-2xs uppercase tracking-widest text-white/40 font-black mb-2 block">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-mono font-bold text-white/80 ${valueClassName}`}>{value}</span>
        {trend && <span className={`${trendColor} font-mono text-2xs`}>{trend}</span>}
      </div>
      {children}
    </div>
  );
}
