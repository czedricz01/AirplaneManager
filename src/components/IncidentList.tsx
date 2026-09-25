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
    <div className={`border border-aero-warn/30 bg-aero-warn/5 rounded-sm font-mono text-xs ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-aero-warn/20">
        <AlertTriangle size={14} className="text-aero-warn" />
        <span className="uppercase tracking-widest font-black text-2xs text-aero-warn">Operational incidents</span>
        <span className="text-3xs text-white/40">{incidents.length}</span>
      </div>
      <ul className="divide-y divide-white/5">
        {incidents.map((inc, i) => (
          <li key={i} className="flex items-start justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <span className="block font-bold text-white/90">{inc.title}</span>
              <span className="block text-2xs text-white/50">{inc.detail}</span>
            </div>
            <div className="text-right shrink-0 text-2xs">
              {inc.mitigated ? (
                <span className="flex items-center gap-1 text-aero-good"><Plane size={11} /> replacement flew</span>
              ) : (
                <span className="text-aero-warn">
                  {Math.round(inc.cancelShare * 100)}% cancelled · {inc.routeCount} route{inc.routeCount === 1 ? '' : 's'}
                </span>
              )}
              {(inc.cost ?? 0) > 0 && <span className="block text-white/50">repairs {formatCurrency(inc.cost!)}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
