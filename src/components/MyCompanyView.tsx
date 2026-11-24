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
import { CareerPanel, type CareerPart, type CareerPanelProps } from './CareerPanel';
import { rankDef } from '../lib/airlineRank';
import { describeGoal } from '../lib/annualGoals';
import { goalFraction, goalValue } from '../model/progress';
import type { Branding, ChronicleEntry } from '../lib/gameState';
import type { MonthlyReport } from '../lib/gameTypes';
import { CHART_COLORS } from '../lib/theme';
import { fleetMixText, reputationEffect, type CompanyWorth, type CreditStatus, type FleetMix } from '../lib/modelCompany';
import { reportView } from '../lib/modelReport';
import { CREDIT_LIMIT_SHARE } from '../model/constants';

import { CALENDAR_START_YEAR, formatCurrency, formatMoneyCompact as compact, formatNumber } from '../lib/format';

interface ProgressionProps {
  /** 'progression' shows the Career screen alone (tabs Rank, Development, Board goals); 'company' everything else. */
  page?: 'company' | 'progression';
  /** Opens the Career screen from the overview's links. */
  onOpenProgression?: () => void;
}

interface Props extends ProgressionProps,  Omit<MarketingPanelProps, 'capital' | 'rank'>, Omit<StaffPanelProps, 'currentDateOffset' | 'routeCount'>, Omit<CareerPanelProps, 'capital' | 'currentDateOffset'> {
  capital: number;
  /** Closed months, oldest first. */
  reportHistory: MonthlyReport[];
  /** What the airline is worth by the model (docs/neubau 6.12): cash, aircraft at value, slots, deposits. */
  worth: CompanyWorth;
  /** The credit line by the model (8.14). */
  credit: CreditStatus;
  fleetCount: number;
  /** What the make-up of the fleet does to its maintenance (model 5.12). */
  commonality: FleetMix;
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
        className={`flex items-center gap-2 px-3 py-1.5 text-2xs uppercase tracking-label font-semibold border transition-colors ${
          draft ? 'bg-accent text-on-accent border-accent' : 'bg-surface text-muted border-line hover:text-ink hover:border-rule'
        }`}
      >
        <Palette size={12} /> Edit livery
      </button>
      {draft && (
        <div className="absolute left-0 lg:left-auto lg:right-0 top-full mt-2 z-50 w-[min(92vw,28rem)] bg-surface border border-accent/20 p-4">
          <BrandingPicker value={draft} onChange={setDraft} code={airlineCode} name={airlineName} />
          <p className="text-2xs text-muted mt-3">
            Rivals whose colour would look too much like yours are given a new one.
          </p>
          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="px-3 py-1.5 text-2xs uppercase tracking-label font-semibold border border-line text-muted hover:text-ink hover:border-rule"
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
              className="px-3 py-1.5 text-2xs uppercase tracking-label font-semibold border border-accent bg-accent text-on-accent hover:bg-ink hover:border-ink disabled:opacity-40 disabled:pointer-events-none"
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
    return <span className="text-2xs font-label text-muted uppercase tracking-label">First month</span>;
  }
  const diff = current - previous;
  if (diff === 0) {
    return (
      <span className="flex items-center gap-1 text-2xs text-muted">
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
    <span className={`flex items-center gap-1 text-2xs font-mono ${up ? 'text-good' : 'text-bad'}`}>
      <Icon size={10} />
      {up ? '+' : ''}{formatCurrency(diff)}{pct}
    </span>
  );
}

function MyCompanyViewImpl({
  capital, reportHistory, worth, credit, fleetCount, commonality, routeCount, reputation,
  branding, airlineName, airlineCode, onBrandingChange, chronicle,
  staff, profitStreak, monthlyCrewCost, strikePending, completedResearch, badLuckCapOpen, onSetSalary,
  page = 'company', onOpenProgression, free, rank, rankHistory, perks, milestones, annualGoal, goalOffer, goalSnapshot, onChooseGoal, research, onStartResearch, score, hall, onRetire,
  ...marketingProps
}: Props) {
  const [section, setSection] = useState<'overview' | 'career' | 'marketing' | 'staff' | 'history'>('overview');
  const [careerTab, setCareerTab] = useState<CareerPart>('rank');
  const progression = page === 'progression';
  const shown = progression ? 'career' : section;

  // The last two years of profit at a glance; the History tab has the rest.
  const recent = useMemo(() => reportHistory.slice(-24), [reportHistory]);
  const recentOffsets = useMemo(() => recent.map(r => (r.year - CALENDAR_START_YEAR) * 12 + (r.month - 1)), [recent]);
  const recentProfit = useMemo(
    () => [{ id: 'profit', label: 'Operating profit', color: CHART_COLORS.series[0], values: recent.map(r => r.totalProfit) }],
    [recent]
  );
  const latest = reportHistory.length > 0 ? reportHistory[reportHistory.length - 1] : null;
  const previous = reportHistory.length > 1 ? reportHistory[reportHistory.length - 2] : undefined;

  const view = useMemo(() => (latest ? reportView(latest) : null), [latest]);
  const demandEffect = reputationEffect(reputation) - 1;

  return (
    <div className="w-full h-full text-ink px-3 py-3 lg:px-4 lg:py-4 short:py-1.5 flex flex-col font-sans overflow-hidden relative">
      <ViewHeader
        title={progression ? 'CAREER' : 'MY COMPANY'}
        icon={<BrandBadge branding={branding} code={airlineCode} name={airlineName} size={36} className="mr-2" />}
        right={progression ? undefined : <LiveryEditor branding={branding} airlineName={airlineName} airlineCode={airlineCode} onBrandingChange={onBrandingChange} />}
      />

      <div className="pr-4 mb-3">
       <div className="flex gap-2 max-w-4xl mx-auto border-b border-line" role="tablist">
        {(progression
          ? ([['rank', 'Rank'], ['development', 'Development'], ['goals', 'Board goals']] as const)
          : ([['overview', 'Overview'], ['marketing', 'Marketing'], ['staff', 'Staff'], ['history', 'History']] as const)
        ).map(([id, text]) => {
          const active = progression ? careerTab === id : section === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => (progression ? setCareerTab(id as CareerPart) : setSection(id as typeof section))}
              className={`px-2 md:px-4 py-2 -mb-px text-2xs uppercase tracking-label md:tracking-label font-semibold border-b-2 transition-colors ${
                active ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {text}
            </button>
          );
        })}
       </div>
      </div>

      <div className="flex-1 overflow-auto pr-4">
        {shown === 'history' ? (
          <div className="max-w-4xl mx-auto pb-6">
            <ChronicleView reportHistory={reportHistory} chronicle={chronicle} />
          </div>
        ) : shown === 'career' ? (
          <div className="max-w-4xl mx-auto pb-6">
            <CareerPanel
              part={careerTab}
              free={free}
              rank={rank}
              rankHistory={rankHistory}
              perks={perks}
              milestones={milestones}
              annualGoal={annualGoal}
              goalOffer={goalOffer}
              goalSnapshot={goalSnapshot}
              onChooseGoal={onChooseGoal}
              research={research}
              capital={capital}
              currentDateOffset={marketingProps.currentDateOffset}
              onStartResearch={onStartResearch}
              score={score}
              hall={hall}
              onRetire={onRetire}
            />
          </div>
        ) : shown === 'marketing' ? (
          <div className="max-w-4xl mx-auto pb-6">
            <MarketingPanel capital={capital} rank={rank} {...marketingProps} />
          </div>
        ) : shown === 'staff' ? (
          <div className="max-w-4xl mx-auto pb-6">
            <StaffPanel
              staff={staff}
              profitStreak={profitStreak}
              currentDateOffset={marketingProps.currentDateOffset}
              monthlyCrewCost={monthlyCrewCost}
              strikePending={strikePending}
              completedResearch={completedResearch}
              badLuckCapOpen={badLuckCapOpen}
              routeCount={routeCount}
              onSetSalary={onSetSalary}
            />
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-3 max-w-4xl mx-auto pb-6">

          {/* Balance sheet */}
          <div className="grid grid-cols-2 lg:grid-cols-4 short:grid-cols-4 gap-3 short:gap-2">
            <StatTile size="md" label="Cash" value={formatCurrency(capital)} valueClassName={capital < 0 ? 'text-bad' : 'text-accent'}>
              <span className={`block text-2xs mt-1 ${credit.state === 'overdrawn' ? 'text-bad' : 'text-muted'}`}>
                {credit.state === 'healthy'
                  ? `credit line ${compact(credit.limit)}`
                  : credit.state === 'credit'
                    ? `credit used ${compact(credit.used)} of ${compact(credit.limit)}`
                    : `overdrawn, ${credit.closesToForcedSale === 1 ? 'aircraft sold at the next close' : `aircraft sold in ${credit.closesToForcedSale} closes`}`}
              </span>
            </StatTile>
            <StatTile size="md" label="Fleet value" value={formatCurrency(worth.fleetValue)}>
              <span className="block text-2xs text-muted mt-1">{fleetCount} aircraft at book value</span>
            </StatTile>
            <StatTile size="md" label="Company value" value={formatCurrency(worth.companyValue)}>
              <span className="block text-2xs text-muted mt-1">
                cash + fleet{worth.slotValue > 0 ? ` + slots ${compact(worth.slotValue)}` : ''}{worth.deposits > 0 ? ` + deposits ${compact(worth.deposits)}` : ''}
              </span>
            </StatTile>
            <StatTile
              size="md"
              label="Reputation"
              value={Math.round(reputation)}
              valueClassName={reputation >= 65 ? 'text-good' : reputation < 40 ? 'text-bad' : ''}
            >
              <span className="block text-2xs text-muted mt-1">
                appeal {demandEffect >= 0 ? '+' : ''}{(demandEffect * 100).toFixed(1)}%
              </span>
              <div className="w-full h-1 bg-raised mt-2 overflow-hidden">
                <div
                  className={`h-full ${reputation >= 65 ? 'bg-good' : reputation < 40 ? 'bg-bad' : 'bg-accent'}`}
                  style={{ width: `${Math.max(0, Math.min(100, reputation))}%` }}
                />
              </div>
            </StatTile>
            <StatTile size="md" label="Rank" value={rankDef(rank).title.replace(' Airline', '')}>
              <span className="block text-2xs text-muted mt-1">
                <button type="button" onClick={() => onOpenProgression?.()} className="uppercase tracking-label text-accent hover:text-ink">
                  Career &rarr;
                </button>
              </span>
            </StatTile>
            {goalOffer ? (
              <StatTile size="md" label={`${goalOffer.year} goal`} value="Choose">
                <span className="block text-2xs text-muted mt-1">
                  <button type="button" onClick={() => onOpenProgression?.()} className="uppercase tracking-label text-accent hover:text-ink">
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
                  valueClassName={fraction >= 1 ? 'text-good' : ''}
                >
                  <span className="block text-2xs text-muted mt-1">
                    {describeGoal(annualGoal, compact, n => String(Math.round(n)))}
                  </span>
                  <span className="block text-2xs text-muted">
                    met +{compact(annualGoal.reward)} · missed &minus;{compact(annualGoal.penalty)}
                  </span>
                  <div className="w-full h-1 bg-raised mt-2 overflow-hidden">
                    <div className={`h-full ${fraction >= 1 ? 'bg-good' : 'bg-accent'}`} style={{ width: `${fraction * 100}%` }} />
                  </div>
                </StatTile>
              );
            })()}
            <StatTile size="md" label="Network" value={routeCount}>
              <span className="block text-2xs text-muted mt-1">active routes</span>
            </StatTile>
          </div>

          {fleetCount > 0 && (
            <Panel>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <span className="text-2xs uppercase tracking-label text-muted font-semibold">Fleet commonality</span>
                <span className={`text-2xs font-mono ${commonality.meanFactor < 1 ? 'text-good' : commonality.meanFactor > 1 ? 'text-bad' : 'text-muted'}`}>
                  maintenance {commonality.meanFactor === 1 ? 'at the standard rate' : `${commonality.meanFactor < 1 ? '' : '+'}${Math.round((commonality.meanFactor - 1) * 100)}% on average`}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {commonality.families.slice(0, 8).map(f => (
                  <span key={f.family} className="text-2xs border border-line bg-surface px-2 py-1 rounded-sm">
                    {f.family} &times;{f.count}{f.discount > 0 && <span className="text-good"> &minus;{Math.round(f.discount * 100)}%</span>}
                  </span>
                ))}
                {commonality.families.length > 8 && <span className="text-2xs text-muted py-1">+{commonality.families.length - 8} more</span>}
              </div>
              <p className="text-2xs text-muted leading-relaxed">
                {fleetMixText()}
                {commonality.penalty > 0 && <span className="text-bad"> Your {commonality.families.length} families add {Math.round(commonality.penalty * 100)}%.</span>}
              </p>
            </Panel>
          )}

          {reportHistory.length === 0 ? (
            <div className="h-48 border border-line bg-ground/20 rounded-sm flex flex-col items-center justify-center gap-2 text-muted uppercase tracking-label text-xs font-semibold">
              No month closed yet
              <span className="text-2xs normal-case text-muted">
                Plan a route, then advance the month to produce your first report.
              </span>
            </div>
          ) : (
            <>
              {/* Last month at a glance */}
              <Panel>
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-2xs uppercase tracking-label text-muted font-semibold">
                    {latest && label(latest)} — versus previous month
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-2xs uppercase tracking-label text-muted block mb-1">Revenue</span>
                    <span className="font-mono text-lg">{formatCurrency(latest!.routeRevenues)}</span>
                    <Delta current={latest!.routeRevenues} previous={previous?.routeRevenues} />
                  </div>
                  <div>
                    <span className="text-2xs uppercase tracking-label text-muted block mb-1">Operating profit</span>
                    <span className={`font-mono text-lg ${latest!.totalProfit >= 0 ? 'text-good' : 'text-bad'}`}>
                      {formatCurrency(latest!.totalProfit)}
                    </span>
                    <Delta current={latest!.totalProfit} previous={previous?.totalProfit} />
                  </div>
                  <div>
                    <span className="text-2xs uppercase tracking-label text-muted block mb-1">Cash change</span>
                    <span className={`font-mono text-lg ${(latest!.cashChange ?? latest!.totalProfit) >= 0 ? 'text-good' : 'text-bad'}`}>
                      {formatCurrency(latest!.cashChange ?? latest!.totalProfit)}
                    </span>
                    <span className="block text-2xs text-muted">
                      {formatCurrency(latest!.capex ?? 0)} one-off payments; see &ldquo;From profit to cash&rdquo;
                    </span>
                  </div>
                </div>
              </Panel>

              {/* Recent profit; every other figure and the chronicle are under History. */}
              <Panel>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <span className="text-2xs uppercase tracking-label text-muted font-semibold">Operating profit, last {recent.length} month{recent.length === 1 ? '' : 's'}</span>
                  <button
                    type="button"
                    onClick={() => setSection('history')}
                    className="text-2xs font-label uppercase tracking-label text-accent hover:text-ink"
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
                <p className="text-2xs text-muted mt-3 leading-relaxed">
                  {reportHistory.length} month{reportHistory.length === 1 ? '' : 's'} on record.
                  History is kept for the last ten years and travels with the savegame.
                </p>
              </Panel>

              {/* Glossary: the items of the model's report (docs/neubau 5.16, 8.2). */}
              <div className="p-4 bg-surface border border-line rounded-sm flex gap-4">
                <Info className="text-muted shrink-0 mt-0.5" size={16} />
                <div className="text-2xs text-muted leading-relaxed space-y-1.5">
                  <p><strong className="text-ink">Flight costs</strong> — what scales with flying: fuel, crew, landing fees, check-in and handling, catering.</p>
                  <p><strong className="text-ink">Airport upkeep</strong> — rent for slots, stands, check-in desks and facilities, whether you fly or not.</p>
                  <p><strong className="text-ink">Aircraft</strong> — insurance and maintenance for every aircraft, flying or parked (parked costs half), and depreciation: the value an aircraft loses each month with age and wear.</p>
                  <p><strong className="text-ink">Aircraft trades</strong> — the difference between what you paid or received and the aircraft&rsquo;s value. An aircraft bought at its value costs nothing here; its price is cash, not profit.</p>
                  <p><strong className="text-ink">Charters, crises &amp; credit</strong> — replacement charters, crisis responses, and interest while cash is below zero.</p>
                  <p><strong className="text-ink">From profit to cash</strong> — one-off payments (aircraft, slots, tiers, research, deposits), prizes and the board goal move cash but not the operating profit. With cash below zero the credit line ({formatNumber(CREDIT_LIMIT_SHARE * 100)}% of the fleet value) covers losses and charges interest.</p>
                </div>
              </div>

              {/* Latest report */}
              {view && (
                <>
                  <FinancialReport
                    title={`Report — ${label(latest!)}`}
                    netProfit={latest!.totalProfit}
                    totalRevenue={latest!.routeRevenues}
                    revenues={view.revenues}
                    expenses={view.routes ? [...view.expenses, view.routes] : view.expenses}
                  />
                  <FinancialReport title="From profit to cash" netProfit={view.cash.total} expenses={[view.cash]} defaultOpen={false} />
                  {view.credit && <p className={`text-2xs ${view.credit.state === 'overdrawn' ? 'text-bad' : 'text-muted'}`}>{view.credit.text}</p>}
                </>
              )}
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
