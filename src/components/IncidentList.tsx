import { AlertTriangle, Plane } from 'lucide-react';
import type { ReportIncident } from '../lib/gameState';
import { formatCurrency } from '../lib/format';

/**
 * What cost the airline flights in a closed month: strikes and operational
 * disruptions, as the monthly report lists them. Nothing when there were none.
 */
export function IncidentList({ incidents, className = '' }: { incidents?: ReportIncident[]; className?: string }) {
  if (!incidents || incidents.length === 0) return null;
  return (
    <div className={`border border-bad/30 bg-bad/5 rounded-sm font-mono text-xs ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-bad/20">
        <AlertTriangle size={14} className="text-bad" />
        <span className="uppercase tracking-label font-semibold text-2xs text-bad">Operational incidents</span>
        <span className="text-2xs text-muted">{incidents.length}</span>
      </div>
      <ul className="divide-y divide-line">
        {incidents.map((inc, i) => (
          <li key={i} className="flex items-start justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <span className="block font-semibold text-ink">{inc.title}</span>
              <span className="block text-2xs text-muted">{inc.detail}</span>
            </div>
            <div className="text-right shrink-0 text-2xs">
              {inc.mitigated ? (
                <span className="flex items-center gap-1 text-good"><Plane size={11} /> replacement flew</span>
              ) : (
                <span className="text-bad">
                  {Math.round(inc.cancelShare * 100)}% cancelled · {inc.routeCount} route{inc.routeCount === 1 ? '' : 's'}
                </span>
              )}
              {(inc.cost ?? 0) > 0 && (
                <span className="block text-muted">{inc.mitigated ? 'charter' : 'repairs'} {formatCurrency(inc.cost!)}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
