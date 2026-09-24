import React, { useMemo, useState } from 'react';
import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { FinancialReport } from './FinancialReport';
import { ViewHeader } from './ui/ViewHeader';
import { StatTile } from './ui/StatTile';
import { Panel } from './ui/Panel';

import { formatCurrency, formatMoneyCompact as compact } from '../lib/format';

interface MonthlyReport {
  month: number;
  year: number;
  routeRevenues: number;
  routeCosts: number;
  airportUpkeep: number;
  totalProfit: number;
  capex?: number;
  capexItems?: { label: string; amount: number }[];
  cashChange?: number;
  capitalAfter?: number;
  routes?: { name: string; revenue: number; cost: number; profit: number; paxPerWeek?: number; capacity?: number }[];
  breakdown: Record<string, number>;
}

interface Props {
  capital: number;
  /** Closed months, oldest first. */
  reportHistory: MonthlyReport[];
  /** Resale value of every owned aircraft, already summed. */
  fleetValue: number;
  fleetCount: number;
  routeCount: number;
  /** Airline reputation, 0-100. */
  reputation: number;
  /** Milestones earned so far, with the full catalogue to show what is left. */
  milestones: string[];
  milestoneCatalogue: { id: string; title: string; detail: string }[];
  /** The board's target for the current year, and what has been earned so far. */
  annualGoal: { year: number; targetProfit: number } | null;
}

const label = (r: MonthlyReport) => `${String(r.month).padStart(2, '0')}/${r.year}`;

/** A number with its change against the previous month. */
function Delta({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) {
    return <span className="text-2xs font-mono text-white/30 uppercase tracking-widest">First month</span>;
  }
  const diff = current - previous;
  if (diff === 0) {
    return (
      <span className="flex items-center gap-1 text-2xs font-mono text-white/40">
        <Minus size={10} /> unchanged
      </span>
    );
  }
  const up = diff > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  // Percent against a previous month that was zero or negative says nothing
  // useful, so only the absolute change is shown there.
  const pct = previous > 0 ? ` (${up ? '+' : ''}${((diff / previous) * 100).toFixed(1)}%)` : '';
  return (
    <span className={`flex items-center gap-1 text-2xs font-mono ${up ? 'text-aero-good' : 'text-aero-warn'}`}>
      <Icon size={10} />
      {up ? '+' : ''}{formatCurrency(diff)}{pct}
    </span>
  );
}

/** Bars for one series across the visible months, with a zero line when needed. */
function History({ reports, pick, title }: { reports: MonthlyReport[]; pick: (r: MonthlyReport) => number; title: string }) {
  const values = reports.map(pick);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const zeroPct = (max / span) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-2xs uppercase tracking-widest text-white/40 font-black">{title}</span>
        <span className="text-3xs font-mono text-white/30">
          {compact(min)} … {compact(max)}
        </span>
      </div>
      <div className="relative h-32 flex items-stretch gap-[3px] bg-black/30 border border-white/5 px-2 py-2">
        {min < 0 && (
          <div className="absolute left-0 right-0 border-t border-dashed border-white/15" style={{ top: `${zeroPct}%` }} />
        )}
        {reports.map((r, i) => {
          const v = values[i];
          const heightPct = (Math.abs(v) / span) * 100;
          const isLast = i === reports.length - 1;
          return (
            <div key={`${r.year}-${r.month}`} className="relative flex-1 group" title={`${label(r)}: ${formatCurrency(v)}`}>
              <div
                className={`absolute left-0 right-0 min-h-[2px] ${
                  v < 0 ? 'bg-aero-warn/70' : isLast ? 'bg-aero-yellow' : 'bg-aero-good/50'
                }`}
                style={
                  v >= 0
                    ? { bottom: `${100 - zeroPct}%`, height: `${heightPct}%` }
                    : { top: `${zeroPct}%`, height: `${heightPct}%` }
                }
              />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black text-3xs px-1.5 py-0.5 whitespace-nowrap z-10 font-black pointer-events-none">
                {label(r)}: {formatCurrency(v)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-3xs font-mono text-white/25">
        <span>{reports.length > 0 ? label(reports[0]) : ''}</span>
        <span>{reports.length > 0 ? label(reports[reports.length - 1]) : ''}</span>
      </div>
    </div>
  );
}

function MyCompanyViewImpl({ capital, reportHistory, fleetValue, fleetCount, routeCount, reputation, milestones, milestoneCatalogue, annualGoal }: Props) {
  const [series, setSeries] = useState<'profit' | 'revenue' | 'capital'>('profit');
  const [monthsShown, setMonthsShown] = useState(24);

  const reports = useMemo(() => reportHistory.slice(-monthsShown), [reportHistory, monthsShown]);
  const latest = reportHistory.length > 0 ? reportHistory[reportHistory.length - 1] : null;
  const previous = reportHistory.length > 1 ? reportHistory[reportHistory.length - 2] : undefined;

  const netWorth = capital + fleetValue;

  const picker = {
    profit: (r: MonthlyReport) => r.totalProfit,
    revenue: (r: MonthlyReport) => r.routeRevenues,
    capital: (r: MonthlyReport) => r.capitalAfter ?? 0,
  }[series];

  const seriesTitle = {
    profit: 'Operating profit per month',
    revenue: 'Ticket revenue per month',
    capital: 'Capital at month end',
  }[series];

  const tab = (id: typeof series, text: string) => (
    <button
      key={id}
      onClick={() => setSeries(id)}
      className={`px-3 py-1.5 text-2xs uppercase tracking-widest font-bold border transition-colors ${
        series === id
          ? 'bg-aero-yellow text-black border-aero-yellow'
          : 'bg-white/5 text-white/50 border-white/10 hover:text-white hover:border-white/30'
      }`}
    >
      {text}
    </button>
  );

  return (
    <div className="w-full h-full text-white/90 px-3 py-3 lg:px-4 lg:py-4 flex flex-col font-sans overflow-hidden relative">
      <ViewHeader title="MY COMPANY" />

      <div className="flex-1 overflow-auto pr-4 custom-scrollbar">
        <div className="grid grid-cols-1 gap-3 max-w-4xl mx-auto pb-6">

          {/* Balance sheet */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile size="md" label="Cash" value={formatCurrency(capital)} valueClassName="text-aero-yellow" />
            <StatTile size="md" label="Fleet value" value={formatCurrency(fleetValue)}>
              <span className="block text-3xs font-mono text-white/30 mt-1">{fleetCount} aircraft, at resale</span>
            </StatTile>
            <StatTile size="md" label="Net worth" value={formatCurrency(netWorth)}>
              <span className="block text-3xs font-mono text-white/30 mt-1">cash + fleet</span>
            </StatTile>
            <StatTile
              size="md"
              label="Reputation"
              value={Math.round(reputation)}
              valueClassName={reputation >= 65 ? 'text-aero-good' : reputation < 40 ? 'text-aero-warn' : ''}
            >
              <span className="block text-3xs font-mono text-white/30 mt-1">
                demand {reputation >= 50 ? '+' : ''}{Math.round((reputation - 50) * 0.2)}%
              </span>
              <div className="w-full h-1 bg-white/10 mt-2 overflow-hidden">
                <div
                  className={`h-full ${reputation >= 65 ? 'bg-aero-good' : reputation < 40 ? 'bg-aero-warn' : 'bg-aero-yellow'}`}
                  style={{ width: `${Math.max(0, Math.min(100, reputation))}%` }}
                />
              </div>
            </StatTile>
            {annualGoal && (() => {
              const earned = reportHistory
                .filter(r => r.year === annualGoal.year)
                .reduce((a, r) => a + r.totalProfit, 0);
              const pct = annualGoal.targetProfit > 0
                ? Math.max(0, Math.min(100, (earned / annualGoal.targetProfit) * 100))
                : 0;
              return (
                <StatTile
                  size="md"
                  label={`${annualGoal.year} target`}
                  value={compact(earned)}
                  valueClassName={pct >= 100 ? 'text-aero-good' : ''}
                >
                  <span className="block text-3xs font-mono text-white/30 mt-1">
                    of {compact(annualGoal.targetProfit)} operating profit
                  </span>
                  <div className="w-full h-1 bg-white/10 mt-2 overflow-hidden">
                    <div className={`h-full ${pct >= 100 ? 'bg-aero-good' : 'bg-aero-yellow'}`} style={{ width: `${pct}%` }} />
                  </div>
                </StatTile>
              );
            })()}
            <StatTile size="md" label="Network" value={routeCount}>
              <span className="block text-3xs font-mono text-white/30 mt-1">active routes</span>
            </StatTile>
          </div>

          {reportHistory.length === 0 ? (
            <div className="h-48 border border-white/5 bg-black/20 rounded-sm flex flex-col items-center justify-center gap-2 text-white/40 uppercase tracking-widest text-xs font-bold">
              No month closed yet
              <span className="text-2xs normal-case tracking-normal text-white/30 font-mono">
                Plan a route, then advance the month to produce your first report.
              </span>
            </div>
          ) : (
            <>
              {/* Last month at a glance */}
              <Panel>
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-2xs uppercase tracking-widest text-white/40 font-black">
                    {latest && label(latest)} — versus previous month
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-2xs uppercase tracking-widest text-white/40 block mb-1">Revenue</span>
                    <span className="font-mono text-lg">{formatCurrency(latest!.routeRevenues)}</span>
                    <Delta current={latest!.routeRevenues} previous={previous?.routeRevenues} />
                  </div>
                  <div>
                    <span className="text-2xs uppercase tracking-widest text-white/40 block mb-1">Operating profit</span>
                    <span className={`font-mono text-lg ${latest!.totalProfit >= 0 ? 'text-aero-good' : 'text-aero-warn'}`}>
                      {formatCurrency(latest!.totalProfit)}
                    </span>
                    <Delta current={latest!.totalProfit} previous={previous?.totalProfit} />
                  </div>
                  <div>
                    <span className="text-2xs uppercase tracking-widest text-white/40 block mb-1">Cash change</span>
                    <span className={`font-mono text-lg ${(latest!.cashChange ?? latest!.totalProfit) >= 0 ? 'text-aero-good' : 'text-aero-warn'}`}>
                      {formatCurrency(latest!.cashChange ?? latest!.totalProfit)}
                    </span>
                    <span className="block text-2xs font-mono text-white/30">
                      profit minus {formatCurrency(latest!.capex ?? 0)} capex
                    </span>
                  </div>
                </div>
              </Panel>

              {/* History */}
              <Panel>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex gap-2">
                    {tab('profit', 'Profit')}
                    {tab('revenue', 'Revenue')}
                    {tab('capital', 'Capital')}
                  </div>
                  <div className="flex gap-2">
                    {[12, 24, 60].map(n => (
                      <button
                        key={n}
                        onClick={() => setMonthsShown(n)}
                        className={`px-2 py-1 text-2xs font-mono border transition-colors ${
                          monthsShown === n
                            ? 'border-aero-yellow text-aero-yellow'
                            : 'border-white/10 text-white/40 hover:text-white'
                        }`}
                      >
                        {n}m
                      </button>
                    ))}
                  </div>
                </div>
                <History reports={reports} pick={picker} title={seriesTitle} />
                <p className="text-2xs font-mono text-white/30 mt-3 leading-relaxed">
                  {reportHistory.length} month{reportHistory.length === 1 ? '' : 's'} on record.
                  History is kept for the last ten years and travels with the savegame.
                </p>
              </Panel>

              {/* Glossary */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-sm flex gap-4">
                <Info className="text-white/60 shrink-0 mt-0.5" size={16} />
                <div className="text-2xs text-white/60 leading-relaxed font-mono space-y-1.5">
                  <p><strong className="text-white/80">Flight revenue</strong> — ticket sales on your active routes.</p>
                  <p><strong className="text-white/80">Direct flight costs</strong> — what scales with flying: fuel, crew, landing fees, catering.</p>
                  <p><strong className="text-white/80">Fixed monthly costs</strong> — rent for check-in desks, lounges and stands, whether you fly or not.</p>
                  <p><strong className="text-white/80">Capex</strong> — one-off spending: aircraft, refits, checks, management tiers. Deducted from cash but not from operating profit, which is why the two differ.</p>
                </div>
              </div>

              {/* Latest report */}
              <FinancialReport
                title={`Report — ${label(latest!)}`}
                netProfit={latest!.totalProfit}
                totalRevenue={latest!.routeRevenues}
                revenues={(latest!.routes || []).map(r => ({
                  label: `${r.name}${r.capacity ? ` (${Math.round(((r.paxPerWeek || 0) / r.capacity) * 100)}% LF)` : ''}`,
                  amount: r.revenue
                }))}
                expenses={[
                  {
                    id: 'routeCosts',
                    label: 'Direct flight costs',
                    total: latest!.routeCosts,
                    items: [
                      { label: 'Fuel', amount: latest!.breakdown.fuel },
                      { label: 'Catering', amount: latest!.breakdown.catering },
                      { label: 'Crew (flight & ground)', amount: latest!.breakdown.staff },
                      { label: 'Landing fees', amount: latest!.breakdown.landingFees },
                      { label: 'Pax handling & check-in', amount: latest!.breakdown.paxFees }
                    ]
                  },
                  {
                    id: 'airportCosts',
                    label: 'Fixed monthly costs',
                    total: latest!.airportUpkeep,
                    items: [
                      { label: 'Stands & slots upkeep', amount: latest!.breakdown.mgt },
                      { label: 'Service desk operations', amount: latest!.breakdown.desks }
                    ]
                  },
                  // Slots are billed into the month's result; the rest is not,
                  // which is exactly why cash and profit differ.
                  // Signed: slot refunds and aircraft sales are money coming in.
                  ...((latest!.breakdown.purchasedSlots || 0) !== 0
                    ? [{
                        id: 'slots',
                        label: 'Slot purchases & refunds',
                        variant: 'net' as const,
                        total: -latest!.breakdown.purchasedSlots,
                        items: [{
                          label: latest!.breakdown.purchasedSlots > 0 ? 'Slot rights bought this month' : 'Slot rights sold back this month',
                          amount: -latest!.breakdown.purchasedSlots
                        }]
                      }]
                    : []),
                  ...((latest!.capexItems ?? []).some(i => i.amount !== 0)
                    ? [{
                        id: 'capex',
                        label: 'One-off investments & sales (below the line)',
                        variant: 'net' as const,
                        total: -(latest!.capex ?? 0),
                        items: (latest!.capexItems ?? []).filter(i => i.amount !== 0).map(i => ({ label: i.label, amount: -i.amount }))
                      }]
                    : []),
                  ...(latest!.routes && latest!.routes.length > 0
                    ? [{
                        id: 'routeBreakdown',
                        label: 'Per route',
                        variant: 'net' as const,
                        total: latest!.routes.reduce((s, r) => s + r.profit, 0),
                        items: latest!.routes.map(r => ({
                          label: `${r.name} (rev ${formatCurrency(r.revenue)}, exp ${formatCurrency(r.cost)})`,
                          amount: r.profit
                        }))
                      }]
                    : [])
                ]}
              />
            </>
          )}

          {/* Milestones. The only thing in the game that accumulates across a
              whole career, so it shows what is still out there as well. */}
          <Panel>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-2xs uppercase tracking-widest text-white/40 font-black">Milestones</span>
              <span className="text-2xs font-mono text-white/40">
                {milestones.length} / {milestoneCatalogue.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {milestoneCatalogue.map(m => {
                const earned = milestones.includes(m.id);
                return (
                  <div
                    key={m.id}
                    className={`p-2 border rounded-sm text-2xs font-mono leading-relaxed ${
                      earned
                        ? 'border-aero-good/40 bg-aero-good/5 text-white/80'
                        : 'border-white/5 bg-white/[0.02] text-white/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={earned ? 'text-aero-good' : 'text-white/20'}>{earned ? '\u2713' : '\u25CB'}</span>
                      <span className="font-bold uppercase tracking-wider">{m.title}</span>
                    </div>
                    <p className="pl-5 mt-0.5">{m.detail}</p>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/**
 * Memoised: this view stays mounted while App re-renders for unrelated state
 * (messages, dialogs, settings), and it only needs to redraw when its own
 * props change. App passes stable callbacks for exactly this reason.
 */
export const MyCompanyView = React.memo(MyCompanyViewImpl);
