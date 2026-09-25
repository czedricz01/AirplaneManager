import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Globe, Megaphone, Target, TrendingDown, TrendingUp, Trophy, Waypoints } from 'lucide-react';
import { Panel } from './ui/Panel';
import { LineChart, type LineSeries } from './charts/LineChart';
import { isValue, type ChartValue } from './charts/chartMath';
import { CHART_COLORS } from '../lib/theme';
import { NEUTRAL_MORALE, STRIKE_MORALE_THRESHOLD } from '../lib/staff';
import type { ReportMetrics } from '../lib/chronicle';
import type { ChronicleEntry, ChronicleKind } from '../lib/gameState';
import {
  CALENDAR_START_YEAR,
  formatCurrency,
  formatMoneyCompact,
  formatMonthOffset,
  formatNumber,
  formatNumberCompact
} from '../lib/format';

/** The parts of a monthly report the history charts read. */
export interface ChronicleReport extends ReportMetrics {
  month: number;
  year: number;
  totalProfit: number;
  routeRevenues: number;
  capitalAfter?: number;
}

export interface ChronicleViewProps {
  /** Closed months, oldest first. */
  reportHistory: ChronicleReport[];
  /** The airline's history, oldest first. */
  chronicle: ChronicleEntry[];
}

type MetricId = 'capital' | 'profit' | 'revenue' | 'reputation' | 'morale' | 'pax' | 'share' | 'fleet';
type RangeId = '1y' | '5y' | 'all';

interface MetricChart {
  /** What the chart shows, above it and for screen readers. */
  title: string;
  series: LineSeries[];
  formatValue: (v: number) => string;
  formatTick?: (v: number) => string;
  domain?: [number, number];
  references?: { value: number; label: string }[];
  note?: (index: number) => string | null;
  /** The change over the period is money, a count or points. */
  delta: (d: number) => string;
}

const money = (v: number) => formatCurrency(v);
const count = (v: number) => formatNumber(Math.round(v));
const points = (v: number) => formatNumber(v, 1);
const signed = (text: string, d: number) => (d > 0 ? `+${text}` : d < 0 ? `−${text.replace(/^-/, '')}` : '±0');

const [C1, C2] = CHART_COLORS.series;

/** One chart per metric, built from the visible months. Metrics a report does not carry are gaps. */
function buildChart(id: MetricId, reports: ChronicleReport[]): MetricChart {
  const pick = (f: (r: ChronicleReport) => number | null | undefined): ChartValue[] => reports.map(f);
  switch (id) {
    case 'capital':
      return {
        title: 'Capital at month end',
        series: [{ id: 'capital', label: 'Capital', color: C1, values: pick(r => r.capitalAfter) }],
        formatValue: money,
        formatTick: formatMoneyCompact,
        delta: d => signed(formatMoneyCompact(Math.abs(d)), d)
      };
    case 'profit':
      return {
        title: 'Operating profit per month',
        series: [{ id: 'profit', label: 'Operating profit', color: C1, values: pick(r => r.totalProfit) }],
        formatValue: money,
        formatTick: formatMoneyCompact,
        delta: d => signed(formatMoneyCompact(Math.abs(d)), d)
      };
    case 'revenue':
      return {
        title: 'Ticket revenue against all operating costs, per month',
        series: [
          { id: 'revenue', label: 'Revenue', color: C1, values: pick(r => r.routeRevenues) },
          // Everything the operating profit is net of: route costs, upkeep, marketing, slots, repairs.
          { id: 'costs', label: 'Costs', color: C2, values: pick(r => (isValue(r.routeRevenues) && isValue(r.totalProfit) ? r.routeRevenues - r.totalProfit : null)) }
        ],
        formatValue: money,
        formatTick: formatMoneyCompact,
        delta: d => signed(formatMoneyCompact(Math.abs(d)), d)
      };
    case 'reputation':
      return {
        title: 'Reputation at month end, 0–100',
        series: [{ id: 'reputation', label: 'Reputation', color: C1, values: pick(r => r.reputation) }],
        formatValue: points,
        formatTick: count,
        domain: [0, 100],
        delta: d => signed(points(Math.abs(d)), d)
      };
    case 'morale':
      return {
        title: 'Staff morale at month end, 0–100',
        series: [{ id: 'morale', label: 'Morale', color: C1, values: pick(r => r.morale) }],
        formatValue: points,
        formatTick: count,
        domain: [0, 100],
        references: [
          { value: NEUTRAL_MORALE, label: 'neutral' },
          { value: STRIKE_MORALE_THRESHOLD, label: 'strikes possible below' }
        ],
        delta: d => signed(points(Math.abs(d)), d)
      };
    case 'pax': {
      const total = pick(r => r.paxTotal);
      const transfer = pick(r => r.transferPax);
      return {
        title: 'Passengers per month: every leg flown, and those who changed planes',
        series: [
          { id: 'pax', label: 'Passengers flown', color: C1, values: total },
          { id: 'transfer', label: 'Connecting', color: C2, values: transfer }
        ],
        formatValue: count,
        formatTick: formatNumberCompact,
        // A connecting passenger flies two legs: journeys are legs minus connections.
        note: i => {
          const t = total[i];
          const c = transfer[i];
          if (!isValue(t) || !isValue(c) || t - c <= 0) return null;
          return `${formatNumber((c / (t - c)) * 100, 1)}% of journeys connect`;
        },
        delta: d => signed(formatNumberCompact(Math.abs(d)), d)
      };
    }
    case 'share':
      return {
        title: 'Share of departures on the city pairs you fly, rivals included',
        series: [{ id: 'share', label: 'Market share', color: C1, values: pick(r => (isValue(r.marketShare) ? r.marketShare * 100 : null)) }],
        formatValue: v => `${formatNumber(v, 1)}%`,
        formatTick: v => `${formatNumber(v)}%`,
        domain: [0, 100],
        delta: d => signed(`${formatNumber(Math.abs(d), 1)} pts`, d)
      };
    case 'fleet':
      return {
        title: 'Aircraft owned and routes flown at month end',
        series: [
          { id: 'fleet', label: 'Aircraft', color: C1, values: pick(r => r.fleetSize) },
          { id: 'routes', label: 'Routes', color: C2, values: pick(r => r.routeCount) }
        ],
        formatValue: count,
        formatTick: count,
        delta: d => signed(count(Math.abs(d)), d)
      };
  }
}

const METRICS: { id: MetricId; label: string }[] = [
  { id: 'capital', label: 'Capital' },
  { id: 'profit', label: 'Monthly profit' },
  { id: 'revenue', label: 'Revenue vs costs' },
  { id: 'reputation', label: 'Reputation' },
  { id: 'morale', label: 'Morale' },
  { id: 'pax', label: 'Passengers' },
  { id: 'share', label: 'Market share' },
  { id: 'fleet', label: 'Fleet size' }
];

const RANGES: { id: RangeId; label: string; months: number }[] = [
  { id: '1y', label: '1 year', months: 12 },
  { id: '5y', label: '5 years', months: 60 },
  { id: 'all', label: 'All', months: Infinity }
];

const KIND_META: Record<ChronicleKind, { label: string; icon: ReactNode; tone: string }> = {
  milestone: { label: 'Milestone', icon: <Trophy size={13} />, tone: 'text-aero-yellow border-aero-yellow/40' },
  goal: { label: 'Annual target', icon: <Target size={13} />, tone: 'text-white/80 border-white/25' },
  record: { label: 'Record', icon: <TrendingUp size={13} />, tone: 'text-aero-good border-aero-good/40' },
  network: { label: 'Network', icon: <Waypoints size={13} />, tone: 'text-sky-300 border-sky-300/40' },
  crisis: { label: 'World event', icon: <Globe size={13} />, tone: 'text-white/80 border-white/25' },
  strike: { label: 'Strike', icon: <Megaphone size={13} />, tone: 'text-aero-warn border-aero-warn/40' },
  disruption: { label: 'Disruption', icon: <AlertTriangle size={13} />, tone: 'text-aero-warn border-aero-warn/40' },
  finance: { label: 'Finance', icon: <TrendingDown size={13} />, tone: 'text-aero-warn border-aero-warn/40' }
};

const offsetOf = (r: { month: number; year: number }) => (r.year - CALENDAR_START_YEAR) * 12 + (r.month - 1);

/** The first and last value a series has in the period, for the summary above the chart. */
function firstLast(values: ChartValue[]): [number, number] | null {
  const present = values.filter(isValue);
  return present.length > 0 ? [present[0], present[present.length - 1]] : null;
}

/**
 * The History tab of My Company: the airline's figures over time, one metric
 * at a time, and the chronicle of what happened to it, newest first.
 */
export function ChronicleView({ reportHistory, chronicle }: ChronicleViewProps) {
  const [metric, setMetric] = useState<MetricId>('capital');
  const [range, setRange] = useState<RangeId>('5y');

  const months = RANGES.find(r => r.id === range)!.months;
  const reports = useMemo(
    () => (Number.isFinite(months) ? reportHistory.slice(-months) : reportHistory),
    [reportHistory, months]
  );
  const offsets = useMemo(() => reports.map(offsetOf), [reports]);
  const chart = useMemo(() => buildChart(metric, reports), [metric, reports]);
  const summary = chart.series.map(s => ({ series: s, span: firstLast(s.values) }));

  // Newest first, grouped by year; entries of one month keep the order they were written in.
  const years = useMemo(() => {
    const sorted = chronicle
      .map((entry, i) => ({ entry, i }))
      .sort((a, b) => b.entry.offset - a.entry.offset || a.i - b.i)
      .map(x => x.entry);
    const groups: { year: number; entries: ChronicleEntry[] }[] = [];
    for (const entry of sorted) {
      const year = CALENDAR_START_YEAR + Math.floor(entry.offset / 12);
      const last = groups[groups.length - 1];
      if (last && last.year === year) last.entries.push(entry);
      else groups.push({ year, entries: [entry] });
    }
    return groups;
  }, [chronicle]);

  const button = (active: boolean) =>
    `px-3 py-1.5 text-2xs uppercase tracking-widest font-bold border transition-colors ${
      active ? 'bg-aero-yellow text-black border-aero-yellow' : 'bg-white/5 text-white/50 border-white/10 hover:text-white hover:border-white/30'
    }`;

  return (
    <div className="grid grid-cols-1 gap-3">
      <Panel>
        {/* One row of filters above the chart they scope. */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Metric">
            {METRICS.map(m => (
              <button key={m.id} type="button" role="tab" aria-selected={metric === m.id} onClick={() => setMetric(m.id)} className={button(metric === m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2" role="group" aria-label="Period">
            {RANGES.map(r => (
              <button
                key={r.id}
                type="button"
                aria-pressed={range === r.id}
                onClick={() => setRange(r.id)}
                className={`px-2 py-1 text-2xs font-mono border transition-colors ${
                  range === r.id ? 'border-aero-yellow text-aero-yellow' : 'border-white/10 text-white/40 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {reportHistory.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2 text-white/40 uppercase tracking-widest text-xs font-bold border border-white/5 bg-black/20">
            No month closed yet
            <span className="text-2xs normal-case tracking-normal text-white/30 font-mono">The charts fill in as months close.</span>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-3">
              <span className="text-2xs uppercase tracking-widest text-white/40 font-black">{chart.title}</span>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {summary.map(({ series, span }) => span && (
                  <div key={series.id} className="text-right">
                    {chart.series.length > 1 && <span className="block text-3xs uppercase tracking-widest text-white/40">{series.label}</span>}
                    <span className="text-base font-mono font-bold text-white">{chart.formatValue(span[1])}</span>
                    <span className="block text-3xs font-mono text-white/40">
                      {chart.delta(span[1] - span[0])} over the period
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <LineChart
              key={metric}
              series={chart.series}
              offsets={offsets}
              formatValue={chart.formatValue}
              formatTick={chart.formatTick}
              domain={chart.domain}
              references={chart.references}
              note={chart.note}
              ariaLabel={`${chart.title}, ${formatMonthOffset(offsets[0])} to ${formatMonthOffset(offsets[offsets.length - 1])}`}
            />
            <details className="mt-3 group">
              <summary className="cursor-pointer text-3xs font-mono uppercase tracking-widest text-white/40 hover:text-white">
                Show as table
              </summary>
              <div className="mt-2 max-h-56 overflow-y-auto custom-scrollbar border border-white/5">
                <table className="w-full text-2xs font-mono">
                  <thead className="sticky top-0 bg-aero-panel-2 text-white/40">
                    <tr>
                      <th className="text-left font-normal px-2 py-1">Month</th>
                      {chart.series.map(s => <th key={s.id} className="text-right font-normal px-2 py-1">{s.label}</th>)}
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {offsets.map((o, i) => ({ o, i })).reverse().map(({ o, i }) => (
                      <tr key={o} className="border-t border-white/5">
                        <td className="px-2 py-1 text-white/50">{formatMonthOffset(o)}</td>
                        {chart.series.map(s => {
                          const v = s.values[i];
                          return <td key={s.id} className="px-2 py-1 text-right text-white/80">{isValue(v) ? chart.formatValue(v) : '—'}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            {reports.some(r => r.reputation === undefined) && metric !== 'capital' && metric !== 'profit' && metric !== 'revenue' && (
              <p className="text-3xs font-mono text-white/30 mt-2">
                Months closed before this figure was recorded are left out.
              </p>
            )}
          </>
        )}
      </Panel>

      {/* The chronicle */}
      <Panel>
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-2xs uppercase tracking-widest text-white/40 font-black">Chronicle</span>
          <span className="text-2xs font-mono text-white/40">{chronicle.length} entr{chronicle.length === 1 ? 'y' : 'ies'}</span>
        </div>
        {years.length === 0 ? (
          <p className="text-2xs font-mono text-white/40 leading-relaxed">
            Nothing written yet. Milestones, records, world events, strikes and other turning points are recorded here as they happen.
          </p>
        ) : (
          <ol className="space-y-5">
            {years.map(group => (
              <li key={group.year}>
                <h4 className="text-sm font-black font-mono text-white/70 mb-2">{group.year}</h4>
                <ol className="relative ml-3 border-l border-white/10 space-y-3">
                  {group.entries.map((entry, i) => {
                    const meta = KIND_META[entry.kind];
                    return (
                      <li key={`${entry.offset}-${i}`} className="relative pl-6">
                        <span
                          className={`absolute -left-[12px] top-0 w-6 h-6 rounded-full border bg-aero-panel flex items-center justify-center ${meta.tone}`}
                          aria-hidden="true"
                        >
                          {meta.icon}
                        </span>
                        <div className="flex flex-wrap items-baseline gap-x-2 text-3xs font-mono uppercase tracking-widest text-white/40">
                          <span>{formatMonthOffset(entry.offset)}</span>
                          <span>{meta.label}</span>
                        </div>
                        <p className="text-xs text-white/85 leading-relaxed">{entry.text}</p>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
