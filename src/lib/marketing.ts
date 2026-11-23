/**
 * Advertising campaigns and the frequent-flyer programme: the state the
 * marketing screen edits (create, start, stop, which region a campaign may
 * run in, rank gates).
 *
 * Prices, the advertising factor per region and the reputation from
 * advertising are the model's (SPEZIFIKATION 3.9.5, 5.14, 6.3), read through
 * `src/lib/modelMarketing.ts`. `regionDemandFactors` and `ffpLoyaltyBonus` are
 * left for `buildPlayerModifiers` (gameState.ts).
 */
import type { Campaign, CampaignTier, Marketing, RegionId } from './gameState';
import { regionOf } from './geoUtils';
import { RANK_NEEDED, rankGateMessage } from './airlineRank';

// --- Regions -------------------------------------------------------------------

/** How the regions are named on screen, in the order they are shown. */
export const REGION_LABELS: Record<RegionId, string> = {
  EU: 'Europe',
  NA: 'North America',
  SA: 'South America',
  AF: 'Africa',
  AS: 'Asia',
  OC: 'Oceania'
};

const ALL_REGIONS = Object.keys(REGION_LABELS) as RegionId[];

/**
 * How many of the given routes touch each region, counting a route once per
 * region even when both ends lie in it.
 */
export function routesByRegion(
  routes: { origin: string; destination: string }[],
  airportsMap: Map<string, { coords: [number, number] }>
): Record<RegionId, number> {
  const counts = Object.fromEntries(ALL_REGIONS.map(r => [r, 0])) as Record<RegionId, number>;
  for (const r of routes) {
    const touched = new Set<RegionId>();
    for (const id of [r.origin, r.destination]) {
      const airport = airportsMap.get(id);
      if (airport) touched.add(regionOf(airport.coords));
    }
    touched.forEach(region => counts[region]++);
  }
  return counts;
}

// --- Campaigns -----------------------------------------------------------------

export interface CampaignSpec {
  label: string;
  /** What the campaign reaches, for the launch dialog. */
  scope: string;
  /** Added to the demand factor of every region it covers: 0.1 = +10%. */
  demandBoost: number;
  /** Per month in 1960; later years pay more, see marketingInflation. */
  baseMonthlyCost: number;
  /** Reputation points added each month it runs. */
  reputationPerMonth: number;
}

export const CAMPAIGN_SPECS: Record<CampaignTier, CampaignSpec> = {
  local: { label: 'Local', scope: 'One region, city posters and radio', demandBoost: 0.05, baseMonthlyCost: 150_000, reputationPerMonth: 0.5 },
  national: { label: 'National', scope: 'One region, press and television', demandBoost: 0.10, baseMonthlyCost: 400_000, reputationPerMonth: 1 },
  global: { label: 'Global', scope: 'All six regions at once', demandBoost: 0.18, baseMonthlyCost: 1_000_000, reputationPerMonth: 2 }
};

/** The lengths a campaign can be booked for, in months. */
export const CAMPAIGN_DURATIONS = [3, 6, 12] as const;

/** No region's demand rises by more than this, however many campaigns run there. */
export const MAX_REGION_DEMAND = 1.25;

/** Whether a campaign runs in the month at `offset`. */
export function isCampaignActive(c: Campaign, offset: number): boolean {
  return c.startOffset <= offset && offset < c.startOffset + c.duration;
}

/** Whether a campaign works on a region. */
export function campaignCovers(c: Campaign, region: RegionId): boolean {
  return c.tier === 'global' || c.region === region;
}

/**
 * The demand factor per region in the month at `offset`, for every region a
 * running campaign covers. Undefined when none runs, so a player without
 * campaigns keeps modifiers that are exactly neutral.
 */
export function regionDemandFactors(marketing: Marketing, offset: number): Partial<Record<RegionId, number>> | undefined {
  const active = marketing.campaigns.filter(c => isCampaignActive(c, offset));
  if (active.length === 0) return undefined;
  const factors: Partial<Record<RegionId, number>> = {};
  for (const region of ALL_REGIONS) {
    const boost = active.filter(c => campaignCovers(c, region)).reduce((a, c) => a + CAMPAIGN_SPECS[c.tier].demandBoost, 0);
    if (boost > 0) factors[region] = Math.min(MAX_REGION_DEMAND, 1 + boost);
  }
  return factors;
}

/**
 * Why a campaign cannot be launched now, or null when it can. Cash is not
 * checked here; the caller knows the balance.
 *
 * Only campaigns running now count, the same ones the marketing screen shows
 * with a cancel button. The game never books one for later, and a save that
 * holds one has it moved to the present on load.
 */
export function campaignBlocker(marketing: Marketing, tier: CampaignTier, region: RegionId, offset: number, rank?: number): string | null {
  const gated = rank === undefined ? null : campaignRankGate(tier, rank);
  if (gated) return gated;
  const running = marketing.campaigns.filter(c => isCampaignActive(c, offset));
  if (tier === 'global') {
    return running.some(c => c.tier === 'global') ? 'A global campaign is already running.' : null;
  }
  const clash = running.find(c => c.tier !== 'global' && c.region === region);
  return clash
    ? `A ${CAMPAIGN_SPECS[clash.tier].label.toLowerCase()} campaign is already running in ${REGION_LABELS[region]}. Cancel it first to change it.`
    : null;
}

/** The refusal for a campaign tier the airline's rank does not yet allow, or null. */
export function campaignRankGate(tier: CampaignTier, rank: number): string | null {
  if (tier === 'national') return rankGateMessage(rank, RANK_NEEDED.nationalCampaign, 'A national campaign');
  if (tier === 'global') return rankGateMessage(rank, RANK_NEEDED.globalCampaign, 'A global campaign');
  return null;
}

/** The refusal for the frequent-flyer programme at this rank, or null. */
export function ffpRankGate(rank: number): string | null {
  return rankGateMessage(rank, RANK_NEEDED.frequentFlyer, 'The frequent-flyer programme');
}

/** A new campaign starting in the month at `offset`. */
export function createCampaign(tier: CampaignTier, region: RegionId, duration: number, offset: number, id: string): Campaign {
  return { id, tier, region, startOffset: offset, duration: Math.max(1, Math.round(duration)) };
}
/** Loyalty in the programme's first month, and what each further month adds, up to the cap. */
export const FFP_LOYALTY_START = 0.05;
export const FFP_LOYALTY_PER_MONTH = 0.01;
export const FFP_LOYALTY_MAX = 0.2;

/** Whole months the programme has run before the one at `offset`; 0 when it is not running. */
export function ffpMonthsActive(marketing: Marketing, offset: number): number {
  if (!marketing.ffpActive || marketing.ffpSinceOffset == null) return 0;
  return Math.max(0, offset - marketing.ffpSinceOffset);
}

/**
 * How much more attractive the player is against rivals on a shared market,
 * 0.05 in the programme's first month, one point more each month after, 0.20
 * at most. 0 while the programme is not running.
 */
export function ffpLoyaltyBonus(marketing: Marketing, offset: number): number {
  if (!marketing.ffpActive) return 0;
  const bonus = FFP_LOYALTY_START + FFP_LOYALTY_PER_MONTH * ffpMonthsActive(marketing, offset);
  return Math.min(FFP_LOYALTY_MAX, Math.round(bonus * 1000) / 1000);
}

export function startFfp(marketing: Marketing, offset: number): Marketing {
  return marketing.ffpActive ? marketing : { ...marketing, ffpActive: true, ffpSinceOffset: offset };
}

/** Ends the programme. Members drift away: loyalty starts over when it is relaunched. */
export function stopFfp(marketing: Marketing): Marketing {
  return marketing.ffpActive ? { ...marketing, ffpActive: false, ffpSinceOffset: null } : marketing;
}
