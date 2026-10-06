import React, { useMemo, useState } from 'react';
import { Info, TrendingUp, TrendingDown, Minus, Palette } from 'lucide-react';
import { FinancialReport } from './FinancialReport';
import { ViewHeader } from './ui/ViewHeader';
import { StatTile } from './ui/StatTile';
import { Panel } from './ui/Panel';
import { BrandBadge } from './BrandBadge';
import { BrandingPicker } from './BrandingPicker';
import { MarketingPanel, type MarketingPanelProps } from './MarketingPanel';
import { StaffPanel, type StaffPanelProps } from './StaffPanel';
import { IncidentList } from './IncidentList';
import { ChronicleView } from './ChronicleView';
import { LineChart } from './charts/LineChart';
import { CareerPanel, type CareerPanelProps } from './CareerPanel';
import type { Commonality } from '../lib/fleetCosts';
import { rankDef } from '../lib/airlineRank';
import { describeGoal, goalFraction, goalValue } from '../lib/annualGoals';
import type { Branding, ChronicleEntry, ReportIncident } from '../lib/gameState';
import type { ReportMetrics } from '../lib/chronicle';
import { CHART_COLORS } from '../lib/theme';

import { CALENDAR_START_YEAR, formatCurrency, formatMoneyCompact as compact } from '../lib/format';

interface MonthlyReport extends ReportMetrics {
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
  /** One line per campaign and the frequent-flyer programme; absent before marketing existed. */
  marketingItems?: { label: string; amount: number }[];
  /** Strikes and disruptions in the month; absent when there were none. */
  incidents?: ReportIncident[];
  /** Rival landings at the airports the airline owns (tier 3), one line per airport. */
  hubIncomeItems?: { label: string; amount: number }[];
}

interface Props extends Omit<MarketingPanelProps, 'capital' | 'rank'>, Omit<StaffPanelProps, 'currentDateOffset' | 'noRoutes'>, CareerPanelProps {
  capital: number;
  /** Closed months, oldest first. */
  reportHistory: MonthlyReport[];
  /** Resale value of every owned aircraft, already summed. */
  fleetValue: number;
  fleetCount: number;
  /** What the make-up of the fleet does to its maintenance, from fleetCommonality. */
  commonality: Commonality;
  routeCount: number;
  /** Airline reputation, 0-100. */
  reputation: number;
  branding: Branding;
  airlineName: string;
  airlineCode: string;
  onBrandingChange: (next: Branding) => void;
  /** The airline's history, oldest first, for the History tab. */
  chronicle: ChronicleEntry[];
}

/**
 * The livery editor behind a button. Edits are a draft until applied: every
 * colour change redraws the whole map, too much to do on each step of
 * dragging through the colour picker.
 */
function LiveryEditor({ branding, airlineName, airlineCode, onBrandingChange }: Pick<Props, 'branding' | 'airlineName' | 'airlineCode' | 'onBrandingChange'>) {
  const [draft, setDraft] = useState<Branding | null>(null);
  const changed = draft !== null && (draft.color.toLowerCase() !== branding.color.toLowerCase() || draft.icon !== branding.icon);

  return (
    <div className="relative flex lg:justify-end">
      <button
        type="button"
        onClick={() => setDraft(draft ? null : { ...branding })}
        aria-expanded={draft !== null}
        className={`flex items-center gap-2 px-3 py-1.5 text-2xs uppercase tracking-widest font-bold border transition-colors ${
          draft ? 'bg-aero-yellow text-black border-aero-yellow' : 'bg-white/5 text-white/60 border-white/10 hover:text-white hover:border-white/30'
        }`}
      >
        <Palette size={12} /> Edit livery
      </button>
      {draft && (
        <div className="absolute left-0 lg:left-auto lg:right-0 top-full mt-2 z-50 w-[min(92vw,28rem)] bg-aero-panel border border-aero-yellow/20 shadow-2xl p-4">
          <BrandingPicker value={draft} onChange={setDraft} code={airlineCode} name={airlineName} />
          <p className="text-3xs font-mono text-white/40 mt-3">
            Rivals whose colour would look too much like yours are given a new one.
          </p>
          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="px-3 py-1.5 text-2xs uppercase tracking-widest font-bold border border-white/10 text-white/60 hover:text-white hover:border-white/30"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!changed}
              onClick={() => {
                if (draft) onBrandingChange(draft);
                setDraft(null);
              }}
              className="px-3 py-1.5 text-2xs uppercase tracking-widest font-bold border border-aero-yellow bg-aero-yellow text-black hover:bg-white hover:border-white disabled:opacity-40 disabled:pointer-events-none"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
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

function MyCompanyViewImpl({
  capital, reportHistory, fleetValue, fleetCount, commonality, routeCount, reputation,
  branding, airlineName, airlineCode, onBrandingChange, chronicle,
  staff, profitStreak, monthlyCrewCost, strikePending, onSetSalary,
  rank, rankStats, perks, milestones, annualGoal, goalOffer, goalSnapshot, onChooseGoal,
  ...marketingProps
}: Props) {
  const [section, setSection] = useState<'overview' | 'career' | 'marketing' | 'staff' | 'history'>('overview');

  // The last two years of profit at a glance; the History tab has the rest.
  const recent = useMemo(() => reportHistory.slice(-24), [reportHistory]);
  const recentOffsets = useMemo(() => recent.map(r => (r.year - CALENDAR_START_YEAR) * 12 + (r.month - 1)), [recent]);
  const recentProfit = useMemo(
    () => [{ id: 'profit', label: 'Operating profit', color: CHART_COLORS.series[0], values: recent.map(r => r.totalProfit) }],
    [recent]
  );
  const latest = reportHistory.length > 0 ? reportHistory[reportHistory.length - 1] : null;
  const previous = reportHistory.length > 1 ? reportHistory[reportHistory.length - 2] : undefined;

  const netWorth = capital + fleetValue;

  return (
    <div className="w-full h-full text-white/90 px-3 py-3 lg:px-4 lg:py-4 short:py-1.5 flex flex-col font-sans overflow-hidden relative">
      <ViewHeader
        eyebrow={[airlineName, airlineCode].filter(Boolean).join(' · ') || undefined}
        title="MY COMPANY"
        icon={<BrandBadge branding={branding} code={airlineCode} name={airlineName} size={36} className="mr-2" />}
        right={<LiveryEditor branding={branding} airlineName={airlineName} airlineCode={airlineCode} onBrandingChange={onBrandingChange} />}
      />

      <div className="pr-4 mb-3">
       <div className="flex gap-2 max-w-4xl mx-auto border-b border-white/5" role="tablist">
        {([['overview', 'Overview'], ['career', goalOffer ? 'Career \u25CF' : 'Career'], ['marketing', 'Marketing'], ['staff', 'Staff'], ['history', 'History']] as const).map(([id, text]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            onClick={() => setSection(id)}
            className={`px-2 md:px-4 py-2 -mb-px text-2xs uppercase tracking-wider md:tracking-widest font-black border-b-2 transition-colors ${
              section === id ? 'border-aero-yellow text-aero-yellow' : 'border-transparent text-white/40 hover:text-white'
            }`}
          >
            {text}
          </button>
        ))}
       </div>
      </div>

      <div className="flex-1 overflow-auto pr-4 custom-scrollbar">
        {section === 'history' ? (
          <div className="max-w-4xl mx-auto pb-6">
            <ChronicleView reportHistory={reportHistory} chronicle={chronicle} />
          </div>
        ) : section === 'career' ? (
          <div className="max-w-4xl mx-auto pb-6">
            <CareerPanel
              rank={rank}
              rankStats={rankStats}
              perks={perks}
              milestones={milestones}
              annualGoal={annualGoal}
              goalOffer={goalOffer}
              goalSnapshot={goalSnapshot}
              onChooseGoal={onChooseGoal}
            />
          </div>
        ) : section === 'marketing' ? (
          <div className="max-w-4xl mx-auto pb-6">
            <MarketingPanel capital={capital} rank={rank} {...marketingProps} />
          </div>
        ) : section === 'staff' ? (
          <div className="max-w-4xl mx-auto pb-6">
            <StaffPanel
              staff={staff}
              profitStreak={profitStreak}
              currentDateOffset={marketingProps.currentDateOffset}
              monthlyCrewCost={monthlyCrewCost}
              strikePending={strikePending}
              noRoutes={routeCount === 0}
              onSetSalary={onSetSalary}
            />
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-3 max-w-4xl mx-auto pb-6">

          {/* Balance sheet */}
          <div className="grid grid-cols-2 lg:grid-cols-4 short:grid-cols-4 gap-3 short:gap-2">
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
            <StatTile size="md" label="Rank" value={rankDef(rank).title.replace(' Airline', '')}>
              <span className="block text-3xs font-mono text-white/30 mt-1">
                <button type="button" onClick={() => setSection('career')} className="uppercase tracking-widest text-aero-yellow hover:text-white">
                  Career &rarr;
                </button>
              </span>
            </StatTile>
            {goalOffer ? (
              <StatTile size="md" label={`${goalOffer.year} goal`} value="Choose">
                <span className="block text-3xs font-mono text-white/30 mt-1">
                  <button type="button" onClick={() => setSection('career')} className="uppercase tracking-widest text-aero-yellow hover:text-white">
                    The board waits &rarr;
                  </button>
                </span>
              </StatTile>
            ) : annualGoal && goalSnapshot && (() => {
              const fraction = goalFraction(annualGoal, goalSnapshot);
              const value = goalValue(annualGoal, goalSnapshot);
              return (
                <StatTile
                  size="md"
                  label={`${annualGoal.year} goal`}
                  value={annualGoal.kind === 'profit' ? compact(value) : annualGoal.kind === 'noLoss' ? (value === 0 ? 'Clean' : `${value} loss`) : Math.round(value)}
                  valueClassName={fraction >= 1 ? 'text-aero-good' : ''}
                >
                  <span className="block text-3xs font-mono text-white/30 mt-1">
                    {describeGoal(annualGoal, compact, n => String(Math.round(n)))}
                  </span>
                  <div className="w-full h-1 bg-white/10 mt-2 overflow-hidden">
                    <div className={`h-full ${fraction >= 1 ? 'bg-aero-good' : 'bg-aero-yellow'}`} style={{ width: `${fraction * 100}%` }} />
                  </div>
                </StatTile>
              );
            })()}
            <StatTile size="md" label="Network" value={routeCount}>
              <span className="block text-3xs font-mono text-white/30 mt-1">active routes</span>
            </StatTile>
          </div>

          {fleetCount > 0 && (
            <Panel>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <span className="text-2xs uppercase tracking-widest text-white/40 font-black">Fleet commonality</span>
                <span className={`text-2xs font-mono ${commonality.meanFactor < 1 ? 'text-aero-good' : commonality.meanFactor > 1 ? 'text-aero-warn' : 'text-white/50'}`}>
                  maintenance {commonality.meanFactor === 1 ? 'at the standard rate' : `${commonality.meanFactor < 1 ? '' : '+'}${Math.round((commonality.meanFactor - 1) * 100)}% on average`}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {commonality.families.slice(0, 8).map(f => (
                  <span key={f.family} className="text-2xs font-mono border border-white/10 bg-white/[0.03] px-2 py-1 rounded-sm">
                    {f.family} &times;{f.count}{f.discount > 0 && <span className="text-aero-good"> &minus;{Math.round(f.discount * 100)}%</span>}
                  </span>
                ))}
                {commonality.families.length > 8 && <span className="text-2xs font-mono text-white/40 py-1">+{commonality.families.length - 8} more</span>}
              </div>
              <p className="text-3xs font-mono text-white/40 leading-relaxed">
                Aircraft of one family share crews and spare parts: three of a kind save 4% on their maintenance, six 8%, twelve 12%.
                Running more than three families costs 3% on every aircraft for each one beyond.
                {commonality.penalty > 0 && <span className="text-aero-warn"> Your {commonality.families.length} families add {Math.round(commonality.penalty * 100)}%.</span>}
              </p>
            </Panel>
          )}

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

              {/* Recent profit; every other figure and the chronicle are under History. */}
              <Panel>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <span className="text-2xs uppercase tracking-widest text-white/40 font-black">Operating profit, last {recent.length} month{recent.length === 1 ? '' : 's'}</span>
                  <button
                    type="button"
                    onClick={() => setSection('history')}
                    className="text-2xs font-mono uppercase tracking-widest text-aero-yellow hover:text-white"
                  >
                    Full history &rarr;
                  </button>
                </div>
                <LineChart
                  series={recentProfit}
                  offsets={recentOffsets}
                  formatValue={formatCurrency}
                  formatTick={compact}
                  height={160}
                  ariaLabel="Operating profit per month over the last two years"
                />
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
                  <p><strong className="text-white/80">Aircraft ownership</strong> — insurance and the maintenance programme for every aircraft in the fleet, flying or parked. A parked aircraft costs half, and the older an aircraft gets the more its upkeep takes.</p>
                  <p><strong className="text-white/80">Marketing &amp; loyalty</strong> — advertising campaigns and the frequent flyer programme, charged each month they run.</p>
                  <p><strong className="text-white/80">Incident repairs &amp; charters</strong> — replacement aircraft chartered to fly cancelled flights (older reports also list repair bills). A bird strike is paid on the spot and shows as capex.</p>
                  <p><strong className="text-white/80">Capex</strong> — one-off spending: aircraft, refits, checks, management tiers, airport slots. Deducted from cash at once, but not from operating profit, which is why the two differ.</p>
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
                  ...((latest!.breakdown.fleetOwnership || 0) > 0
                    ? [{
                        id: 'fleetOwnership',
                        label: 'Aircraft ownership',
                        total: latest!.breakdown.fleetOwnership,
                        items: [
                          { label: 'Insurance & maintenance programme', amount: latest!.breakdown.fleetOwnership - (latest!.breakdown.fleetParked || 0) },
                          ...((latest!.breakdown.fleetParked || 0) > 0
                            ? [{ label: `Parked aircraft (${latest!.breakdown.fleetParkedCount || 0}): storage & insurance`, amount: latest!.breakdown.fleetParked }]
                            : [])
                        ]
                      }]
                    : []),
                  ...((latest!.breakdown.hubIncome || 0) > 0
                    ? [{
                        id: 'hubIncome',
                        label: 'Airport ownership income',
                        variant: 'net' as const,
                        total: latest!.breakdown.hubIncome,
                        items: latest!.hubIncomeItems ?? []
                      }]
                    : []),
                  ...((latest!.breakdown.marketing || 0) > 0
                    ? [{
                        id: 'marketing',
                        label: 'Marketing & loyalty',
                        total: latest!.breakdown.marketing,
                        items: latest!.marketingItems ?? [
                          { label: 'Advertising campaigns', amount: latest!.breakdown.marketingCampaigns || 0 },
                          { label: 'Frequent flyer programme', amount: latest!.breakdown.ffp || 0 }
                        ]
                      }]
                    : []),
                  ...((latest!.breakdown.incidents || 0) > 0
                    ? [{
                        id: 'incidents',
                        label: 'Incident repairs & charters',
                        total: latest!.breakdown.incidents,
                        items: (latest!.incidents ?? []).filter(i => (i.cost ?? 0) > 0).map(i => ({ label: i.title, amount: i.cost ?? 0 }))
                      }]
                    : []),
                  // Only in reports closed before slots were paid for on the
                  // spot; they were billed into that month's result then.
                  // Slots bought since are a capex item, below the line.
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
              <IncidentList incidents={latest!.incidents} />
            </>
          )}

        </div>
        )}
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
