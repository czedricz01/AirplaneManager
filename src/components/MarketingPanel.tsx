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
  FFP_BASE_MONTHLY_COST,
  FFP_COST_PER_PAX,
  FFP_LOYALTY_MAX,
  FFP_LOYALTY_PER_MONTH,
  FFP_LOYALTY_START,
  FFP_REPUTATION_PER_MONTH,
  MARKETING_INFLATION,
  MAX_REGION_DEMAND,
  REGION_LABELS,
  campaignBlocker,
  campaignMonthlyCost,
  campaignMonthsLeft,
  campaignTotalCost,
  createCampaign,
  ffpLoyaltyBonus,
  ffpMonthlyCost,
  isCampaignActive,
  marketingMonthCost,
  marketingReputation,
  regionDemandFactors
} from '../lib/marketing';
import { formatCurrency, formatMoneyCompact as compact, formatNumber } from '../lib/format';

export interface MarketingPanelProps {
  marketing: Marketing;
  currentDateOffset: number;
  capital: number;
  /** Passengers a month at the current forecast, for the programme's bill. */
  projectedMonthlyPax: number;
  /** How many of the player's routes touch each region. */
  regionRouteCounts: Record<RegionId, number>;
  /** Where a global campaign is booked from; it runs everywhere regardless. */
  homeRegion: RegionId;
  onLaunchCampaign: (tier: CampaignTier, region: RegionId, months: number) => void;
  onCancelCampaign: (id: string) => void;
  onSetFfp: (active: boolean) => void;
}

const REGIONS = Object.keys(REGION_LABELS) as RegionId[];

const pct = (factor: number) => `+${Math.round((factor - 1) * 100)}%`;

const monthLabel = (offset: number) =>
  `${String(1 + (offset % 12)).padStart(2, '0')}/${1960 + Math.floor(offset / 12)}`;

/** One running campaign, with what is left of it and a way to stop it. */
function CampaignRow({ campaign, offset, onCancel }: { campaign: Campaign; offset: number; onCancel: (id: string) => void }) {
  const spec = CAMPAIGN_SPECS[campaign.tier];
  const left = campaignMonthsLeft(campaign, offset);
  return (
    <div className="flex items-center justify-between gap-2 border border-aero-good/30 bg-aero-good/5 px-2 py-1.5 rounded-sm">
      <div className="min-w-0">
        <div className="text-2xs font-mono font-bold uppercase tracking-wider text-aero-good">
          {spec.label} · +{Math.round(spec.demandBoost * 100)}%
        </div>
        <div className="text-3xs font-mono text-white/50">
          {left} month{left === 1 ? '' : 's'} left · {compact(campaignMonthlyCost(campaign.tier, offset))}/mo
        </div>
      </div>
      <button
        type="button"
        onClick={() => onCancel(campaign.id)}
        title="Cancel campaign"
        aria-label={`Cancel ${spec.label.toLowerCase()} campaign`}
        className="shrink-0 p-1 text-white/40 hover:text-aero-warn transition-colors"
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
  marketing, currentDateOffset: offset, capital, projectedMonthlyPax, regionRouteCounts, homeRegion,
  onLaunchCampaign, onCancelCampaign, onSetFfp
}: MarketingPanelProps) {
  /** The launch dialog: the region it was opened from and the tier picked. */
  const [launch, setLaunch] = useState<{ region: RegionId; tier: CampaignTier } | null>(null);
  const [months, setMonths] = useState<number>(6);

  const running = useMemo(() => marketing.campaigns.filter(c => isCampaignActive(c, offset)), [marketing, offset]);
  const factors = useMemo(() => regionDemandFactors(marketing, offset) ?? {}, [marketing, offset]);
  const monthCost = useMemo(() => marketingMonthCost(marketing, offset, projectedMonthlyPax), [marketing, offset, projectedMonthlyPax]);
  const reputationGain = marketingReputation(marketing, offset);
  const loyalty = ffpLoyaltyBonus(marketing, offset);
  const global = running.find(c => c.tier === 'global');
  const ffpCost = ffpMonthlyCost(projectedMonthlyPax);

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile size="md" label="Marketing this month" value={formatCurrency(monthCost.total)}>
          <span className="block text-3xs font-mono text-white/30 mt-1">
            charged at month end · {running.length} campaign{running.length === 1 ? '' : 's'}
            {marketing.ffpActive ? ' + loyalty' : ''}
          </span>
        </StatTile>
        <StatTile
          size="md"
          label="Reputation from marketing"
          value={reputationGain > 0 ? `+${formatNumber(reputationGain, 1)}` : '0'}
          valueClassName={reputationGain > 0 ? 'text-aero-good' : ''}
        >
          <span className="block text-3xs font-mono text-white/30 mt-1">points per month</span>
        </StatTile>
        <StatTile
          size="md"
          label="Loyalty bonus"
          value={loyalty > 0 ? `+${Math.round(loyalty * 100)}%` : 'none'}
          valueClassName={loyalty > 0 ? 'text-aero-good' : 'text-white/40'}
        >
          <span className="block text-3xs font-mono text-white/30 mt-1">appeal against rivals on shared routes</span>
        </StatTile>
      </div>

      {/* Frequent flyer programme */}
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Award size={18} className={marketing.ffpActive ? 'text-aero-yellow shrink-0 mt-0.5' : 'text-white/30 shrink-0 mt-0.5'} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xs uppercase tracking-widest text-white/60 font-black">Frequent flyer programme</span>
                {marketing.ffpActive
                  ? <Badge tone="good">Running since {monthLabel(marketing.ffpSinceOffset ?? offset)}</Badge>
                  : <Badge>Not running</Badge>}
              </div>
              <p className="text-2xs font-mono text-white/50 leading-relaxed max-w-xl">
                Members stick with you where a rival flies the same city pair: your appeal rises
                by {Math.round(FFP_LOYALTY_START * 100)}% in the first month and {Math.round(FFP_LOYALTY_PER_MONTH * 100)} point
                more each month, up to {Math.round(FFP_LOYALTY_MAX * 100)}%. Reputation +{FFP_REPUTATION_PER_MONTH} a month.
                Ending the programme loses the loyalty built up.
              </p>
            </div>
          </div>
          <Button
            variant={marketing.ffpActive ? 'danger' : 'primary'}
            onClick={() => onSetFfp(!marketing.ffpActive)}
            disabled={!marketing.ffpActive && capital < ffpCost}
          >
            {marketing.ffpActive ? 'End programme' : 'Launch programme'}
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <div>
            <div className="flex justify-between text-3xs font-mono uppercase tracking-wider text-white/40 mb-1">
              <span>Loyalty</span>
              <span>{Math.round(loyalty * 100)}% of {Math.round(FFP_LOYALTY_MAX * 100)}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 overflow-hidden">
              <div className="h-full bg-aero-yellow" style={{ width: `${(loyalty / FFP_LOYALTY_MAX) * 100}%` }} />
            </div>
          </div>
          <div className="text-2xs font-mono text-white/50">
            <span className="text-white/80">{formatCurrency(ffpCost)}</span> a month at the current forecast:
            {' '}{compact(FFP_BASE_MONTHLY_COST)} + ${FFP_COST_PER_PAX.toFixed(2)} × {formatNumber(Math.round(projectedMonthlyPax))} passengers
            {!marketing.ffpActive && capital < ffpCost && (
              <span className="block text-aero-warn mt-1">{formatCurrency(ffpCost - capital)} short for the first month.</span>
            )}
          </div>
        </div>
      </Panel>

      {/* Worldwide */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Globe2 size={18} className={global ? 'text-aero-yellow shrink-0' : 'text-white/30 shrink-0'} />
            <div className="min-w-0">
              <span className="text-2xs uppercase tracking-widest text-white/60 font-black block">Worldwide</span>
              <span className="text-3xs font-mono text-white/40">
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
                <span className="text-xs uppercase tracking-widest font-black text-white/80">{REGION_LABELS[region]}</span>
                <span className={`font-mono text-sm font-bold ${factor > 1 ? 'text-aero-good' : 'text-white/30'}`}>
                  {factor > 1 ? pct(factor) : '±0%'}
                </span>
              </div>
              <span className="text-3xs font-mono text-white/40">
                {routes === 1 ? '1 of your routes touches' : `${routes} of your routes touch`} this region
                {factor >= MAX_REGION_DEMAND ? ' · at the +25% cap' : ''}
              </span>
              {regional && <CampaignRow campaign={regional} offset={offset} onCancel={onCancelCampaign} />}
              {global && (
                <span className="text-3xs font-mono text-aero-good/70">
                  +{Math.round(CAMPAIGN_SPECS.global.demandBoost * 100)}% from the worldwide campaign
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

      <p className="text-2xs font-mono text-white/30 leading-relaxed">
        A route takes the mean of its two ends: a campaign lifts routes inside its region fully and
        routes leaving it by half. Campaigns in one region add up to at most +{Math.round((MAX_REGION_DEMAND - 1) * 100)}%.
        Prices rise {Math.round(MARKETING_INFLATION * 100)}% a year with inflation; each month is charged at
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
  onTier: (tier: CampaignTier) => void;
  onMonths: (months: number) => void;
  onClose: () => void;
  onLaunch: () => void;
}

/** Tier, length, what it costs and what it does, before anything is booked. */
function LaunchDialog({ marketing, offset, capital, region, tier, months, routes, onTier, onMonths, onClose, onLaunch }: LaunchDialogProps) {
  const spec = CAMPAIGN_SPECS[tier];
  const monthly = campaignMonthlyCost(tier, offset);
  const total = campaignTotalCost(tier, offset, months);
  const blocker = campaignBlocker(marketing, tier, region, offset);
  const short = capital < monthly;

  // The regions it would reach, before and after, so a campaign that runs
  // into the cap says so.
  const after = useMemo(() => {
    const trial = { ...marketing, campaigns: [...marketing.campaigns, createCampaign(tier, region, months, offset, 'preview')] };
    return regionDemandFactors(trial, offset) ?? {};
  }, [marketing, tier, region, months, offset]);
  const before = regionDemandFactors(marketing, offset) ?? {};
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
          <span className="text-2xs font-mono text-aero-warn">
            {blocker ?? (short ? `${formatCurrency(monthly - capital)} short for the first month.` : '')}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={!!blocker || short} onClick={onLaunch}>Launch campaign</Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 font-mono">
        <div>
          <span className="text-3xs uppercase tracking-widest text-white/40 font-black block mb-2">Reach</span>
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
                    selected ? 'border-aero-yellow bg-aero-yellow/10' : 'border-white/10 bg-white/[0.03] hover:border-white/30'
                  }`}
                >
                  <div className={`text-2xs font-bold uppercase tracking-widest ${selected ? 'text-aero-yellow' : 'text-white/80'}`}>{s.label}</div>
                  <div className="text-3xs text-white/40 mt-0.5">{s.scope}</div>
                  <div className="text-3xs text-white/70 mt-1">
                    +{Math.round(s.demandBoost * 100)}% demand · {compact(campaignMonthlyCost(t, offset))}/mo
                  </div>
                  <div className="text-3xs text-aero-good/80">+{s.reputationPerMonth} reputation/mo</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="text-3xs uppercase tracking-widest text-white/40 font-black block mb-2">Duration</span>
          <div className="flex gap-2">
            {CAMPAIGN_DURATIONS.map(n => (
              <Button key={n} size="sm" active={n === months} onClick={() => onMonths(n)}>
                {n} months
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3 text-2xs">
          <div>
            <span className="text-white/40 uppercase tracking-wider block">Per month</span>
            <span className="text-base font-bold text-white">{formatCurrency(monthly)}</span>
          </div>
          <div>
            <span className="text-white/40 uppercase tracking-wider block">Total for {months} months</span>
            <span className="text-base font-bold text-aero-yellow">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="text-2xs text-white/60 leading-relaxed">
          <span className="text-white/40 uppercase tracking-wider block mb-1">Expected effect</span>
          <ul className="space-y-0.5">
            {reached.map(r => (
              <li key={r} className="flex justify-between gap-2">
                <span>{REGION_LABELS[r]}</span>
                <span>
                  {pct(before[r] ?? 1)} → <span className="text-aero-good">{pct(after[r] ?? 1)}</span>
                  {(after[r] ?? 1) >= MAX_REGION_DEMAND && <span className="text-white/40"> (cap)</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-white/40">
            {routesReached === null
              ? 'Every route gains the full boost.'
              : routesReached === 0
                ? <span className="text-aero-warn">None of your routes touch {REGION_LABELS[region]} yet: until one does, this buys reputation only.</span>
                : `${routesReached} of your routes touch ${REGION_LABELS[region]}: those inside it gain the full boost, those leaving it half.`}
            {' '}Reputation +{spec.reputationPerMonth} a month while it runs, from {monthLabel(offset)} to {monthLabel(offset + months - 1)}.
          </p>
        </div>
      </div>
    </Modal>
  );
}
