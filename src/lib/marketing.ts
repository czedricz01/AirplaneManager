/**
 * Advertising campaigns and the frequent-flyer programme: the first way to
 * spend money on demand rather than on capacity.
 *
 * Everything here is pure. buildPlayerModifiers (gameState.ts) turns the
 * Marketing state into regional demand factors and a loyalty bonus for the
 * finance engine, and the month close charges marketingMonthCost and adds
 * marketingReputation. Nothing here reaches the AI airlines.
 *
 * What the three tiers mean:
 *   local     one region, a light push:           +5% there
 *   national  one region, a full campaign:        +10% there
 *   global    every region at once:               +18% everywhere
 * A route gets the mean of the factors at its two ends (routeDemandFactor),
 * so a campaign lifts a route inside its region fully and one leaving the
 * region by half. Campaigns in one region add up, to at most +25%.
 *
 * At most one local or national campaign runs per region, and one global
 * campaign in all. A global campaign still records the region it was bought
 * from, for the save format; its effect does not depend on it.
 */
import type { Campaign, CampaignTier, Marketing, RegionId } from './gameState';
import { regionOf } from './geoUtils';

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

/** Advertising gets dearer by this much a year, from 1960. */
export const MARKETING_INFLATION = 0.03;

/** The price level of advertising in the year of the month at `offset`, 1 in 1960. */
export function marketingInflation(offset: number): number {
  return Math.pow(1 + MARKETING_INFLATION, Math.max(0, Math.floor(offset / 12)));
}

/** What a campaign of this tier costs for the month at `offset`, in whole dollars. */
export function campaignMonthlyCost(tier: CampaignTier, offset: number): number {
  return Math.round(CAMPAIGN_SPECS[tier].baseMonthlyCost * marketingInflation(offset));
}

/** What a campaign costs over its whole run, each month at that month's price. */
export function campaignTotalCost(tier: CampaignTier, startOffset: number, months: number): number {
  let total = 0;
  for (let i = 0; i < months; i++) total += campaignMonthlyCost(tier, startOffset + i);
  return total;
}

/** Whether a campaign runs in the month at `offset`. */
export function isCampaignActive(c: Campaign, offset: number): boolean {
  return c.startOffset <= offset && offset < c.startOffset + c.duration;
}

/** Months a campaign still runs, the one at `offset` included. */
export function campaignMonthsLeft(c: Campaign, offset: number): number {
  return Math.max(0, c.startOffset + c.duration - Math.max(offset, c.startOffset));
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
export function campaignBlocker(marketing: Marketing, tier: CampaignTier, region: RegionId, offset: number): string | null {
  const running = marketing.campaigns.filter(c => isCampaignActive(c, offset));
  if (tier === 'global') {
    return running.some(c => c.tier === 'global') ? 'A global campaign is already running.' : null;
  }
  const clash = running.find(c => c.tier !== 'global' && c.region === region);
  return clash
    ? `A ${CAMPAIGN_SPECS[clash.tier].label.toLowerCase()} campaign is already running in ${REGION_LABELS[region]}. Cancel it first to change it.`
    : null;
}

/** A new campaign starting in the month at `offset`. */
export function createCampaign(tier: CampaignTier, region: RegionId, duration: number, offset: number, id: string): Campaign {
  return { id, tier, region, startOffset: offset, duration: Math.max(1, Math.round(duration)) };
}

/**
 * The state without campaigns that ended before the month at `offset`. The
 * same object when nothing ended, so a month without change re-renders nothing.
 */
export function dropExpiredCampaigns(marketing: Marketing, offset: number): Marketing {
  const kept = marketing.campaigns.filter(c => c.startOffset + c.duration > offset);
  return kept.length === marketing.campaigns.length ? marketing : { ...marketing, campaigns: kept };
}

// --- Frequent-flyer programme ----------------------------------------------------

/** Fixed running cost per month: the scheme, the cards, the lounge desk. */
export const FFP_BASE_MONTHLY_COST = 50_000;
/** Paid out per passenger flown, in miles redeemed. */
export const FFP_COST_PER_PAX = 0.8;
export const FFP_REPUTATION_PER_MONTH = 0.3;
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

/**
 * The programme's monthly cost for so many passengers a month. Not inflated:
 * the per-passenger part already grows with the airline.
 */
export function ffpMonthlyCost(paxPerMonth: number): number {
  return Math.round(FFP_BASE_MONTHLY_COST + FFP_COST_PER_PAX * Math.max(0, paxPerMonth || 0));
}

export function startFfp(marketing: Marketing, offset: number): Marketing {
  return marketing.ffpActive ? marketing : { ...marketing, ffpActive: true, ffpSinceOffset: offset };
}

/** Ends the programme. Members drift away: loyalty starts over when it is relaunched. */
export function stopFfp(marketing: Marketing): Marketing {
  return marketing.ffpActive ? { ...marketing, ffpActive: false, ffpSinceOffset: null } : marketing;
}

// --- The month close ---------------------------------------------------------------

export interface MarketingCost {
  campaigns: number;
  ffp: number;
  total: number;
  /** One line per campaign and one for the programme, for the monthly report. */
  items: { label: string; amount: number }[];
}

/** What marketing costs for the month at `offset`, with the passengers flown in it. */
export function marketingMonthCost(marketing: Marketing, offset: number, paxPerMonth: number): MarketingCost {
  const items: { label: string; amount: number }[] = [];
  let campaigns = 0;
  for (const c of marketing.campaigns) {
    if (!isCampaignActive(c, offset)) continue;
    const amount = campaignMonthlyCost(c.tier, offset);
    campaigns += amount;
    const where = c.tier === 'global' ? 'worldwide' : REGION_LABELS[c.region];
    items.push({ label: `${CAMPAIGN_SPECS[c.tier].label} campaign, ${where}`, amount });
  }
  const ffp = marketing.ffpActive ? ffpMonthlyCost(paxPerMonth) : 0;
  if (ffp > 0) items.push({ label: 'Frequent flyer programme', amount: ffp });
  return { campaigns, ffp, total: campaigns + ffp, items };
}

/** Reputation marketing adds in the month at `offset`. */
export function marketingReputation(marketing: Marketing, offset: number): number {
  const fromCampaigns = marketing.campaigns
    .filter(c => isCampaignActive(c, offset))
    .reduce((a, c) => a + CAMPAIGN_SPECS[c.tier].reputationPerMonth, 0);
  return fromCampaigns + (marketing.ffpActive ? FFP_REPUTATION_PER_MONTH : 0);
}
