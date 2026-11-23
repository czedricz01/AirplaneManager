import { useMemo, useState } from 'react';
import { Megaphone, Globe2, Award, X } from 'lucide-react';
import { Panel } from './ui/Panel';
import { StatTile } from './ui/StatTile';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { CAMPAIGN_TIERS, type Campaign, type CampaignTier, type Marketing, type RegionId } from '../lib/gameState';
import {
  CAMPAIGN_DURATIONS,
  CAMPAIGN_SPECS,
  REGION_LABELS,
  campaignBlocker,
  ffpRankGate,
  createCampaign
} from '../lib/marketing';
import {
  ADVERTISING_BOOST,
  ADVERTISING_MAX,
  ADVERTISING_REPUTATION_MAX,
  CAMPAIGN_REPUTATION,
  FF_MAX,
  FF_PER_MONTH,
  FF_START,
  REPUTATION_STEP
} from '../model/constants';
import {
  campaignMonthCost,
  campaignMonthsLeft,
  campaignRunCost,
  campaignsMonthCost,
  loyaltyBonus,
  marketingReputation,
  regionAdvertising,
  runningCampaigns
} from '../lib/modelMarketing';
import type { FfpForecast } from '../lib/modelNetwork';
import { formatCurrency, formatMoneyCompact as compact, formatNumber, yearOf, monthOf } from '../lib/format';

export interface MarketingPanelProps {
  marketing: Marketing;
  currentDateOffset: number;
  capital: number;
  /**
   * What the frequent-flyer programme costs this month at the current forecast, as the month close books it
   * (docs/neubau 4.7b, `ffpForecast`): base, rate per trip and trips.
   */
  ffpForecast: FfpForecast;
  /** How many of the player's routes touch each region. */
  regionRouteCounts: Record<RegionId, number>;
  /** Where a global campaign is booked from; it runs everywhere regardless. */
  homeRegion: RegionId;
  onLaunchCampaign: (tier: CampaignTier, region: RegionId, months: number) => void;
  onCancelCampaign: (id: string) => void;
  onSetFfp: (active: boolean) => void;
  /** The airline's rank; the higher campaign tiers and the programme need one. */
  rank?: number;
}

const REGIONS = Object.keys(REGION_LABELS) as RegionId[];

const pct = (factor: number) => `+${Math.round((factor - 1) * 100)}%`;

const monthLabel = (offset: number) =>
  `${String(monthOf(offset)).padStart(2, '0')}/${yearOf(offset)}`;

/** One running campaign, with what is left of it and a way to stop it. */
function CampaignRow({ campaign, offset, onCancel }: { campaign: Campaign; offset: number; onCancel: (id: string) => void }) {
  const spec = CAMPAIGN_SPECS[campaign.tier];
  const left = campaignMonthsLeft(campaign, offset);
  return (
    <div className="flex items-center justify-between gap-2 border border-good/30 bg-good/5 px-2 py-1.5 rounded-sm">
      <div className="min-w-0">
        <div className="text-2xs font-label font-semibold uppercase tracking-label text-good">
          {spec.label} · +{Math.round(ADVERTISING_BOOST[campaign.tier] * 100)}%
        </div>
        <div className="text-2xs text-muted">
          {left} month{left === 1 ? '' : 's'} left · {compact(campaignMonthCost(campaign.tier, offset))}/mo
        </div>
      </div>
      <button
        type="button"
        onClick={() => onCancel(campaign.id)}
        title="Cancel campaign"
        aria-label={`Cancel ${spec.label.toLowerCase()} campaign`}
        className="shrink-0 p-1 text-muted hover:text-bad transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * The Marketing tab of My Company: a card per region with what runs there,
 * the worldwide campaign, and the frequent-flyer programme. Everything here
 * is a request; App checks the cash and books it.
 */
export function MarketingPanel({
  marketing, currentDateOffset: offset, capital, ffpForecast, regionRouteCounts, homeRegion,
  onLaunchCampaign, onCancelCampaign, onSetFfp, rank
}: MarketingPanelProps) {
  /** The launch dialog: the region it was opened from and the tier picked. */
  const [launch, setLaunch] = useState<{ region: RegionId; tier: CampaignTier } | null>(null);
  const [months, setMonths] = useState<number>(6);

  // Everything from the model (docs/neubau 4.8): prices with the cost index, region factors, reputation, loyalty.
  const running = useMemo(() => runningCampaigns(marketing, offset), [marketing, offset]);
  const factors = useMemo(() => regionAdvertising(marketing, offset), [marketing, offset]);
  const campaignCost = useMemo(() => campaignsMonthCost(marketing, offset), [marketing, offset]);
  const ffpCost = ffpForecast.total;
  const monthTotal = campaignCost + (marketing.ffpActive ? ffpCost : 0);
  const reputationGain = marketingReputation(marketing, offset);
  const ffpGate = rank === undefined ? null : ffpRankGate(rank);
  const loyalty = loyaltyBonus(marketing, offset);
  const global = running.find(c => c.tier === 'global');

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile size="md" label="Marketing this month" value={formatCurrency(monthTotal)}>
          <span className="block text-2xs text-muted mt-1">
            charged at month end · {running.length} campaign{running.length === 1 ? '' : 's'}
            {marketing.ffpActive ? ' + loyalty' : ''}
          </span>
        </StatTile>
        <StatTile
          size="md"
          label="Reputation from advertising"
          value={reputationGain > 0 ? `+${formatNumber(reputationGain, 1)}` : '0'}
          valueClassName={reputationGain > 0 ? 'text-good' : ''}
        >
          <span className="block text-2xs text-muted mt-1">
            points on the reputation target
            {reputationGain > 0 ? ` · +${formatNumber(REPUTATION_STEP * reputationGain, 2)} this month` : ''}
          </span>
        </StatTile>
        <StatTile
          size="md"
          label="Loyalty bonus"
          value={loyalty > 0 ? `+${Math.round(loyalty * 100)}%` : 'none'}
          valueClassName={loyalty > 0 ? 'text-good' : 'text-muted'}
        >
          <span className="block text-2xs text-muted mt-1">appeal of all your flights</span>
        </StatTile>
      </div>

      {/* Frequent flyer programme */}
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Award size={18} className={marketing.ffpActive ? 'text-accent shrink-0 mt-0.5' : 'text-muted shrink-0 mt-0.5'} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xs uppercase tracking-label text-muted font-semibold">Frequent flyer programme</span>
                {marketing.ffpActive
                  ? <Badge tone="good">Running since {monthLabel(marketing.ffpSinceOffset ?? offset)}</Badge>
                  : <Badge>Not running</Badge>}
              </div>
              <p className="text-2xs text-muted leading-relaxed max-w-xl">
                Members choose you more often: the appeal of all your flights rises
                by {Math.round(FF_START * 100)}% in the first month and {Math.round(FF_PER_MONTH * 100)} point
                more each month, up to {Math.round(FF_MAX * 100)}%.
                Ending the programme loses the loyalty built up.
              </p>
              {ffpGate && !marketing.ffpActive && (
                <p className="text-2xs font-mono text-bad mt-2">{ffpGate}</p>
              )}
            </div>
          </div>
          <Button
            variant={marketing.ffpActive ? 'danger' : 'primary'}
            onClick={() => onSetFfp(!marketing.ffpActive)}
            disabled={!marketing.ffpActive && (capital < ffpCost || !!ffpGate)}
          >
            {marketing.ffpActive ? 'End programme' : 'Launch programme'}
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <div>
            <div className="flex justify-between text-2xs font-label uppercase tracking-label text-muted mb-1">
              <span>Loyalty</span>
              <span>{Math.round(loyalty * 100)}% of {Math.round(FF_MAX * 100)}%</span>
            </div>
            <div className="w-full h-1.5 bg-raised overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${(loyalty / FF_MAX) * 100}%` }} />
            </div>
          </div>
          <div className="text-2xs text-muted">
            <span className="text-ink">{formatCurrency(ffpCost)}</span> a month at the current forecast:
            {' '}{compact(ffpForecast.base)} + ${ffpForecast.perPassenger.toFixed(2)} × {formatNumber(Math.round(ffpForecast.passengers))} trips
            {!marketing.ffpActive && capital < ffpCost && (
              <span className="block text-bad mt-1">{formatCurrency(ffpCost - capital)} short for the first month.</span>
            )}
          </div>
        </div>
      </Panel>

      {/* Worldwide */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Globe2 size={18} className={global ? 'text-accent shrink-0' : 'text-muted shrink-0'} />
            <div className="min-w-0">
              <span className="text-2xs uppercase tracking-label text-muted font-semibold block">Worldwide</span>
              <span className="text-2xs text-muted">
                A global campaign lifts demand in all six regions at once.
              </span>
            </div>
          </div>
          {global ? (
            <div className="w-full sm:w-64"><CampaignRow campaign={global} offset={offset} onCancel={onCancelCampaign} /></div>
          ) : (
            <Button variant="secondary" icon={<Megaphone size={12} />} onClick={() => setLaunch({ region: homeRegion, tier: 'global' })}>
              Launch global campaign
            </Button>
          )}
        </div>
      </Panel>

      {/* Regions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {REGIONS.map(region => {
          const regional = running.find(c => c.tier !== 'global' && c.region === region);
          const factor = factors[region] ?? 1;
          const routes = regionRouteCounts[region] ?? 0;
          return (
            <Panel key={region} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs uppercase tracking-label font-semibold text-ink">{REGION_LABELS[region]}</span>
                <span className={`font-mono text-sm font-semibold ${factor > 1 ? 'text-good' : 'text-muted'}`}>
                  {factor > 1 ? pct(factor) : '±0%'}
                </span>
              </div>
              <span className="text-2xs font-mono text-muted">
                {routes === 1 ? '1 of your routes touches' : `${routes} of your routes touch`} this region
                {factor >= ADVERTISING_MAX ? ` · at the +${Math.round((ADVERTISING_MAX - 1) * 100)}% cap` : ''}
              </span>
              {regional && <CampaignRow campaign={regional} offset={offset} onCancel={onCancelCampaign} />}
              {global && (
                <span className="text-2xs text-good">
                  +{Math.round(ADVERTISING_BOOST.global * 100)}% from the worldwide campaign
                </span>
              )}
              {!regional && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-auto self-start"
                  icon={<Megaphone size={11} />}
                  onClick={() => setLaunch({ region, tier: 'national' })}
                >
                  Launch campaign
                </Button>
              )}
            </Panel>
          );
        })}
      </div>

      <p className="text-2xs text-muted leading-relaxed">
        A route takes the mean of its two ends: a campaign lifts routes inside its region fully and
        routes leaving it by half. Campaigns in one region add up to at most +{Math.round((ADVERTISING_MAX - 1) * 100)}%.
        Running campaigns also raise the reputation target, by at most {ADVERTISING_REPUTATION_MAX} points together;
        reputation drifts back once they end. Prices follow the cost index; each month is charged at
        month end, so a cancelled campaign costs nothing more.
      </p>

      {launch && (
        <LaunchDialog
          marketing={marketing}
          offset={offset}
          capital={capital}
          region={launch.region}
          tier={launch.tier}
          months={months}
          routes={regionRouteCounts}
          rank={rank}
          onTier={tier => setLaunch({ ...launch, tier })}
          onMonths={setMonths}
          onClose={() => setLaunch(null)}
          onLaunch={() => {
            onLaunchCampaign(launch.tier, launch.region, months);
            setLaunch(null);
          }}
        />
      )}
    </div>
  );
}

interface LaunchDialogProps {
  marketing: Marketing;
  offset: number;
  capital: number;
  region: RegionId;
  tier: CampaignTier;
  months: number;
  routes: Record<RegionId, number>;
  rank?: number;
  onTier: (tier: CampaignTier) => void;
  onMonths: (months: number) => void;
  onClose: () => void;
  onLaunch: () => void;
}

/** Tier, length, what it costs and what it does, before anything is booked. */
function LaunchDialog({ marketing, offset, capital, region, tier, months, routes, rank, onTier, onMonths, onClose, onLaunch }: LaunchDialogProps) {
  const monthly = campaignMonthCost(tier, offset);
  const total = campaignRunCost(tier, offset, months);
  const blocker = campaignBlocker(marketing, tier, region, offset, rank);
  const short = capital < monthly;

  // The regions it would reach, before and after, so a campaign that runs
  // into the cap says so.
  const after = useMemo(() => {
    const trial = { ...marketing, campaigns: [...marketing.campaigns, createCampaign(tier, region, months, offset, 'preview')] };
    return regionAdvertising(trial, offset);
  }, [marketing, tier, region, months, offset]);
  const before = regionAdvertising(marketing, offset);
  const reputationAfter = marketingReputation(
    { campaigns: [...marketing.campaigns, createCampaign(tier, region, months, offset, 'preview')] }, offset);
  const reputationBefore = marketingReputation(marketing, offset);
  const reached = tier === 'global' ? REGIONS : [region];
  const routesReached = tier === 'global'
    ? null
    : routes[region] ?? 0;

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={tier === 'global' ? 'Global campaign' : `Campaign in ${REGION_LABELS[region]}`}
      icon={<Megaphone size={18} />}
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <span className="text-2xs font-mono text-bad">
            {blocker ?? (short ? `${formatCurrency(monthly - capital)} short for the first month.` : '')}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={!!blocker || short} onClick={onLaunch}>Launch campaign</Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <span className="text-2xs uppercase tracking-label text-muted font-semibold block mb-2">Reach</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {CAMPAIGN_TIERS.map(t => {
              const s = CAMPAIGN_SPECS[t];
              const selected = t === tier;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onTier(t)}
                  aria-pressed={selected}
                  className={`text-left p-2 border rounded-sm transition-colors ${
                    selected ? 'border-accent bg-accent/10' : 'border-line bg-surface hover:border-rule'
                  }`}
                >
                  <div className={`text-2xs font-semibold uppercase tracking-label ${selected ? 'text-accent' : 'text-ink'}`}>{s.label}</div>
                  <div className="text-2xs text-muted mt-0.5">{s.scope}</div>
                  <div className="text-2xs text-muted mt-1">
                    +{Math.round(ADVERTISING_BOOST[t] * 100)}% appeal · {compact(campaignMonthCost(t, offset))}/mo
                  </div>
                  <div className="text-2xs text-good">+{CAMPAIGN_REPUTATION[t]} reputation target</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="text-2xs uppercase tracking-label text-muted font-semibold block mb-2">Duration</span>
          <div className="flex gap-2">
            {CAMPAIGN_DURATIONS.map(n => (
              <Button key={n} size="sm" active={n === months} onClick={() => onMonths(n)}>
                {n} months
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-line pt-3 text-2xs">
          <div>
            <span className="text-muted uppercase tracking-label block">Per month</span>
            <span className="text-base font-semibold text-ink">{formatCurrency(monthly)}</span>
          </div>
          <div>
            <span className="text-muted uppercase tracking-label block">Total for {months} months</span>
            <span className="text-base font-semibold text-accent">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="text-2xs text-muted leading-relaxed">
          <span className="text-muted uppercase tracking-label block mb-1">Expected effect</span>
          <ul className="space-y-0.5">
            {reached.map(r => (
              <li key={r} className="flex justify-between gap-2">
                <span>{REGION_LABELS[r]}</span>
                <span>
                  {pct(before[r] ?? 1)} → <span className="text-good">{pct(after[r] ?? 1)}</span>
                  {(after[r] ?? 1) >= ADVERTISING_MAX && <span className="text-muted"> (cap)</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-muted">
            {routesReached === null
              ? 'Every route gains the full boost.'
              : routesReached === 0
                ? <span className="text-bad">None of your routes touch {REGION_LABELS[region]} yet: until one does, this buys reputation only.</span>
                : `${routesReached} of your routes touch ${REGION_LABELS[region]}: those inside it gain the full boost, those leaving it half.`}
            {' '}Runs from {monthLabel(offset)} to {monthLabel(offset + months - 1)}. Reputation target
            {' '}{reputationAfter > reputationBefore
              ? `+${formatNumber(reputationAfter - reputationBefore, 1)} while it runs`
              : `unchanged: campaigns add at most ${ADVERTISING_REPUTATION_MAX} points together`}.
          </p>
        </div>
      </div>
    </Modal>
  );
}
