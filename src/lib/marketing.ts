/**
 * Advertising campaigns and the frequent-flyer programme: the state the
 * marketing screen edits (create, start, stop, which region a campaign may
 * run in, rank gates).
 *
 * Prices, the advertising factor per region and the reputation from
 * advertising and the frequent-flyer loyalty are the model's (SPEZIFIKATION
 * 3.9.4, 3.9.5, 5.14, 6.3), read through `src/lib/modelMarketing.ts`.
 */
import type { Campaign, CampaignTier, Marketing, RegionId } from './gameState';
import { regionOf } from './geoUtils';
import { RANK_UNLOCKS } from '../model/constants';
import { rankGateMessage } from './airlineRank';

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

/** How a campaign tier is named on screen. What it costs and does is the model's (`src/lib/modelMarketing.ts`). */
export interface CampaignSpec {
  label: string;
  /** What the campaign reaches, for the launch dialog. */
  scope: string;
}

export const CAMPAIGN_SPECS: Record<CampaignTier, CampaignSpec> = {
  local: { label: 'Local', scope: 'One region, city posters and radio' },
  national: { label: 'National', scope: 'One region, press and television' },
  global: { label: 'Global', scope: 'All six regions at once' }
};

/** The lengths a campaign can be booked for, in months. */
export const CAMPAIGN_DURATIONS = [3, 6, 12] as const;

/** Whether a campaign runs in the month at `offset`. */
export function isCampaignActive(c: Campaign, offset: number): boolean {
  return c.startOffset <= offset && offset < c.startOffset + c.duration;
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
  if (tier === 'national') return rankGateMessage(rank, RANK_UNLOCKS.nationalCampaign, 'A national campaign');
  if (tier === 'global') return rankGateMessage(rank, RANK_UNLOCKS.globalCampaign, 'A global campaign');
  return null;
}

/** The refusal for the frequent-flyer programme at this rank, or null. */
export function ffpRankGate(rank: number): string | null {
  return rankGateMessage(rank, RANK_UNLOCKS.frequentFlyer, 'The frequent-flyer programme');
}

/** A new campaign starting in the month at `offset`. */
export function createCampaign(tier: CampaignTier, region: RegionId, duration: number, offset: number, id: string): Campaign {
  return { id, tier, region, startOffset: offset, duration: Math.max(1, Math.round(duration)) };
}
/** Starts the frequent-flyer programme in the month at `offset`; loyalty counts from there (3.9.4). */
export function startFfp(marketing: Marketing, offset: number): Marketing {
  return marketing.ffpActive ? marketing : { ...marketing, ffpActive: true, ffpSinceOffset: offset };
}

/** Ends the programme. Members drift away: loyalty starts over when it is relaunched. */
export function stopFfp(marketing: Marketing): Marketing {
  return marketing.ffpActive ? { ...marketing, ffpActive: false, ffpSinceOffset: null } : marketing;
}
