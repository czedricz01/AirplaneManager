/**
 * The airline's rank: Startup, Regional, National, International, Flag
 * Carrier, Global Player.
 *
 * Until now the only thing that stood between a new airline and the whole
 * game was money. The rank is the other gate: it is earned with a network, a
 * crowd of passengers and a good name, it never falls (a licence once granted
 * is not taken back), and each step opens something that was shut before.
 *
 * The figures it reads are ones the monthly close already computes. Everything
 * here is pure.
 */

export interface RankStats {
  routes: number;
  /** Passengers flown in the month, every leg counted. */
  monthlyPax: number;
  reputation: number;
  /** Regions of the world with at least one route end in them. */
  regions: number;
}

export interface RankDef {
  index: number;
  id: string;
  title: string;
  requires: RankStats;
  /** Hubs (airports at management tier 2) the airline may run at this rank. */
  maxHubs: number;
  /** What the rank opens, in plain words. */
  unlocks: string[];
}

export const RANKS: readonly RankDef[] = [
  {
    index: 0, id: 'startup', title: 'Startup',
    requires: { routes: 0, monthlyPax: 0, reputation: 0, regions: 0 },
    maxHubs: 1,
    unlocks: ['One hub', 'Local marketing campaigns']
  },
  {
    index: 1, id: 'regional', title: 'Regional Airline',
    requires: { routes: 3, monthlyPax: 8_000, reputation: 40, regions: 1 },
    maxHubs: 2,
    unlocks: ['A second hub', 'National marketing campaigns', 'The frequent-flyer programme']
  },
  {
    index: 2, id: 'national', title: 'National Airline',
    requires: { routes: 8, monthlyPax: 40_000, reputation: 50, regions: 1 },
    maxHubs: 3,
    unlocks: ['Wide-body aircraft', 'The VIP lounge at a hub', 'A third hub']
  },
  {
    index: 3, id: 'international', title: 'International Airline',
    requires: { routes: 20, monthlyPax: 150_000, reputation: 58, regions: 2 },
    maxHubs: 4,
    unlocks: ['Global marketing campaigns', 'Takeovers of rivals in distress', 'A fourth hub']
  },
  {
    index: 4, id: 'flag', title: 'Flag Carrier',
    requires: { routes: 40, monthlyPax: 500_000, reputation: 66, regions: 3 },
    maxHubs: 6,
    unlocks: ['Supersonic aircraft', 'Management tier 3 at a hub', 'Six hubs']
  },
  {
    index: 5, id: 'global', title: 'Global Player',
    requires: { routes: 80, monthlyPax: 1_500_000, reputation: 75, regions: 4 },
    maxHubs: 12,
    unlocks: ['Takeover bids for healthy rivals', 'Twelve hubs']
  }
];

export const MAX_RANK = RANKS.length - 1;

/** Clamps anything to a valid rank index. */
export function clampRank(rank: unknown): number {
  const n = typeof rank === 'number' && Number.isFinite(rank) ? Math.round(rank) : 0;
  return Math.max(0, Math.min(MAX_RANK, n));
}

export function rankDef(rank: number): RankDef {
  return RANKS[clampRank(rank)];
}

const meets = (stats: RankStats, req: RankStats) =>
  stats.routes >= req.routes &&
  stats.monthlyPax >= req.monthlyPax &&
  stats.reputation >= req.reputation &&
  stats.regions >= req.regions;

/** The highest rank the figures qualify for. */
export function qualifyingRank(stats: RankStats): number {
  let best = 0;
  for (const r of RANKS) {
    if (meets(stats, r.requires)) best = r.index;
    else break;
  }
  return best;
}

/** The rank after this month: never lower than the one already held. */
export function nextRank(current: number, stats: RankStats): number {
  return Math.max(clampRank(current), qualifyingRank(stats));
}

export interface RankRequirementLine {
  label: string;
  current: number;
  target: number;
  met: boolean;
}

/** How far the airline is from the next rank, one line per requirement; null at the top. */
export function rankProgress(current: number, stats: RankStats): { next: RankDef; lines: RankRequirementLine[]; fraction: number } | null {
  const rank = clampRank(current);
  if (rank >= MAX_RANK) return null;
  const next = RANKS[rank + 1];
  const req = next.requires;
  const lines: RankRequirementLine[] = [
    { label: 'Routes', current: stats.routes, target: req.routes, met: stats.routes >= req.routes },
    { label: 'Passengers per month', current: stats.monthlyPax, target: req.monthlyPax, met: stats.monthlyPax >= req.monthlyPax },
    { label: 'Reputation', current: Math.round(stats.reputation), target: req.reputation, met: stats.reputation >= req.reputation },
    { label: 'Regions served', current: stats.regions, target: req.regions, met: stats.regions >= req.regions }
  ].filter(l => l.target > 0);
  const fraction = lines.length === 0
    ? 1
    : lines.reduce((sum, l) => sum + Math.min(1, l.target > 0 ? l.current / l.target : 1), 0) / lines.length;
  return { next, lines, fraction };
}

// --- What a rank opens ----------------------------------------------------------

/** Ranks the gated things need. Named so the screens and the checks read alike. */
export const RANK_NEEDED = {
  widebody: 2,
  supersonic: 4,
  vipLounge: 2,
  frequentFlyer: 1,
  nationalCampaign: 1,
  globalCampaign: 3,
  managementTier3: 4,
  /** Buying a rival that is in distress and for sale. */
  takeoverDistressed: 3,
  /** Bidding for a healthy rival. */
  takeoverHealthy: 5
} as const;

/** The rank an aircraft needs before it can be bought; 0 for most. */
export function aircraftRankNeeded(aircraft: { class?: string; id?: string; cruiseSpeed?: number }): number {
  if ((aircraft.cruiseSpeed ?? 0) > 1000) return RANK_NEEDED.supersonic;
  if (aircraft.class === 'Widebody') return RANK_NEEDED.widebody;
  return 0;
}

/** The text of a refusal, or null when the rank is enough. */
export function rankGateMessage(rank: number, needed: number, what: string): string | null {
  if (clampRank(rank) >= needed) return null;
  return `${what} needs the rank ${rankDef(needed).title}; your airline is ${rankDef(rank).title}.`;
}

/** Hubs allowed: the rank's allowance plus whatever milestones granted. */
export function hubAllowance(rank: number, extraHubs: number): number {
  return rankDef(rank).maxHubs + Math.max(0, Math.round(extraHubs));
}

/** The number of airports run at management tier 2 or higher. */
export function countHubs(management: Record<string, { level?: number } | undefined> | null | undefined): number {
  return Object.values(management || {}).filter(m => (m?.level ?? 0) >= 2).length;
}

/**
 * The rank a loaded game or a scenario starts at: what the figures give, and
 * no lower than the fleet already requires. A save from before ranks existed
 * must not lock its owner out of the wide-bodies they already fly.
 */
export function startingRank(
  stats: RankStats,
  fleet: ReadonlyArray<{ class?: string; id?: string; cruiseSpeed?: number }>,
  floor = 0
): number {
  const fleetNeeds = fleet.reduce((m, p) => Math.max(m, aircraftRankNeeded(p)), 0);
  return Math.max(clampRank(floor), fleetNeeds, qualifyingRank(stats));
}

/**
 * Why a management tier cannot be bought at an airport, or null when it can.
 * Tier 2 makes the airport a hub, and the rank (plus any milestone rooms)
 * limits how many there are; tier 3 needs a rank of its own. Airports already
 * at the tier are not asked again, and a save with more hubs than its rank
 * allows keeps them: the limit only stops new ones.
 */
export function managementGate(
  tier: number,
  rank: number,
  extraHubs: number,
  management: Record<string, { level?: number } | undefined> | null | undefined,
  airportId?: string
): string | null {
  if (airportId && (management?.[airportId]?.level ?? 0) >= tier) return null;
  if (tier === 2) {
    const cap = hubAllowance(rank, extraHubs);
    if (countHubs(management) >= cap) {
      return `Your airline (${rankDef(rank).title}) may run ${cap} hub${cap === 1 ? '' : 's'}, and all ${cap === 1 ? 'is' : 'are'} in use. ` +
        `A higher rank or a gold milestone makes room for more.`;
    }
  }
  if (tier === 3) return rankGateMessage(rank, RANK_NEEDED.managementTier3, 'Management tier 3');
  return null;
}
