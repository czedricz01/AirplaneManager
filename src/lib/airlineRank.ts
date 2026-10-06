/**
 * The airline's rank: ten steps from Startup to Global Player.
 *
 * The rank is earned, never lost (a licence once granted is not taken back),
 * and each step opens something that was shut before: bigger airports, more
 * hubs, the next steps of the development tree (see research.ts), marketing
 * and the lounges. It is deliberately slow: every step asks for more routes,
 * more passengers, a better name, more regions and more years in business
 * than the one before, and the years cannot be bought.
 *
 * In Free Mode the rank does not exist: the airline is a Global Player from
 * the start and nothing is gated by it.
 *
 * The figures it reads are ones the monthly close already computes.
 * Everything here is pure.
 */

export interface RankStats {
  routes: number;
  /** Passengers flown in the month, every leg counted. */
  monthlyPax: number;
  reputation: number;
  /** Regions of the world with at least one route end in them. */
  regions: number;
  /** Whole years since the airline started. */
  years: number;
}

export interface RankDef {
  index: number;
  id: string;
  title: string;
  requires: RankStats;
  /** Hubs (airports at management tier 2) the airline may run at this rank. */
  maxHubs: number;
  /** The largest airport level (1-7) the airline may fly to, build at and manage. */
  maxAirportLevel: number;
  /** What the rank opens, in plain words. */
  unlocks: string[];
}

export const RANKS: readonly RankDef[] = [
  {
    index: 0, id: 'startup', title: 'Startup',
    requires: { routes: 0, monthlyPax: 0, reputation: 0, regions: 0, years: 0 },
    maxHubs: 1, maxAirportLevel: 3,
    unlocks: ['Airports up to level 3', 'One hub', 'Local marketing campaigns', 'The first development projects']
  },
  {
    index: 1, id: 'local', title: 'Local Airline',
    requires: { routes: 3, monthlyPax: 8_000, reputation: 40, regions: 1, years: 0 },
    maxHubs: 1, maxAirportLevel: 4,
    unlocks: ['Airports of level 4', 'Regional aircraft (development)']
  },
  {
    index: 2, id: 'regional', title: 'Regional Airline',
    requires: { routes: 6, monthlyPax: 25_000, reputation: 45, regions: 1, years: 1 },
    maxHubs: 2, maxAirportLevel: 4,
    unlocks: ['A second hub', 'The frequent-flyer programme', 'More development projects']
  },
  {
    index: 3, id: 'domestic', title: 'Domestic Airline',
    requires: { routes: 12, monthlyPax: 70_000, reputation: 50, regions: 1, years: 3 },
    maxHubs: 2, maxAirportLevel: 5,
    unlocks: ['Airports of level 5', 'Narrowbody aircraft (development)', 'National marketing campaigns']
  },
  {
    index: 4, id: 'national', title: 'National Airline',
    requires: { routes: 24, monthlyPax: 170_000, reputation: 55, regions: 1, years: 6 },
    maxHubs: 3, maxAirportLevel: 7,
    unlocks: ['The great hubs: airports of level 6 and 7', 'A third hub', 'The VIP lounge', 'A third development project at a time']
  },
  {
    index: 5, id: 'continental', title: 'Continental Airline',
    requires: { routes: 40, monthlyPax: 350_000, reputation: 60, regions: 2, years: 10 },
    maxHubs: 4,  maxAirportLevel: 7,
    unlocks: ['Wide-body aircraft (development)', 'A fourth hub']
  },
  {
    index: 6, id: 'international', title: 'International Airline',
    requires: { routes: 65, monthlyPax: 700_000, reputation: 65, regions: 3, years: 15 },
    maxHubs: 5, maxAirportLevel: 7,
    unlocks: ['Global marketing campaigns', 'Takeovers of rivals in distress', 'A fifth hub', 'A fourth development project at a time']
  },
  {
    index: 7, id: 'intercontinental', title: 'Intercontinental Airline',
    requires: { routes: 95, monthlyPax: 1_200_000, reputation: 70, regions: 4, years: 22 },
    maxHubs: 6, maxAirportLevel: 7,
    unlocks: ['Jumbo aircraft (development)', 'A sixth hub']
  },
  {
    index: 8, id: 'flag', title: 'Flag Carrier',
    requires: { routes: 135, monthlyPax: 2_000_000, reputation: 75, regions: 5, years: 30 },
    maxHubs: 8, maxAirportLevel: 7,
    unlocks: ['Supersonic aircraft (development)', 'Management tier 3 at a hub', 'Eight hubs', 'A fifth development project at a time']
  },
  {
    index: 9, id: 'global', title: 'Global Player',
    requires: { routes: 190, monthlyPax: 3_500_000, reputation: 80, regions: 6, years: 40 },
    maxHubs: 12, maxAirportLevel: 7,
    unlocks: ['Takeover bids for healthy rivals', 'Twelve hubs', 'The last development projects']
  }
];

export const MAX_RANK = RANKS.length - 1;

/**
 * How a game is played. In Normal Mode the airline climbs the ladder; in Free
 * Mode it is a Global Player from the first month and nothing is gated.
 */
export type GameMode = 'normal' | 'free';

export const GAME_MODES: readonly GameMode[] = ['normal', 'free'];

/** The rank of Free Mode: the top of the ladder, with nothing left to earn. */
export const FREE_MODE_RANK = MAX_RANK;

/** Anything saved or typed, as a valid mode; Normal Mode when it is not one. */
export function normalizeMode(raw: unknown): GameMode {
  return raw === 'free' ? 'free' : 'normal';
}

/** The rank a game has: the top one in Free Mode, otherwise the one earned. */
export function effectiveRank(mode: GameMode, rank: number): number {
  return mode === 'free' ? FREE_MODE_RANK : clampRank(rank);
}

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
  stats.regions >= req.regions &&
  stats.years >= req.years;

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
    { label: 'Regions served', current: stats.regions, target: req.regions, met: stats.regions >= req.regions },
    { label: 'Years in business', current: stats.years, target: req.years, met: stats.years >= req.years }
  ].filter(l => l.target > 0);
  const fraction = lines.length === 0
    ? 1
    : lines.reduce((sum, l) => sum + Math.min(1, l.target > 0 ? l.current / l.target : 1), 0) / lines.length;
  return { next, lines, fraction };
}

// --- What a rank opens ----------------------------------------------------------

/** Ranks the gated things need. Named so the screens and the checks read alike. */
export const RANK_NEEDED = {
  vipLounge: 4,
  frequentFlyer: 2,
  nationalCampaign: 3,
  globalCampaign: 6,
  managementTier3: 8,
  /** Buying a rival that is in distress and for sale. */
  takeoverDistressed: 6,
  /** Bidding for a healthy rival. */
  takeoverHealthy: 9
} as const;

/** The text of a refusal, or null when the rank is enough. */
export function rankGateMessage(rank: number, needed: number, what: string): string | null {
  if (clampRank(rank) >= needed) return null;
  return `${what} needs the rank ${rankDef(needed).title}; your airline is ${rankDef(rank).title}.`;
}

/** Hubs allowed: the rank's allowance plus whatever milestones granted; without limit in Free Mode. */
export function hubAllowance(rank: number, extraHubs: number, free = false): number {
  if (free) return Number.POSITIVE_INFINITY;
  return rankDef(rank).maxHubs + Math.max(0, Math.round(extraHubs));
}

/** The number of airports run at management tier 2 or higher. */
export function countHubs(management: Record<string, { level?: number } | undefined> | null | undefined): number {
  return Object.values(management || {}).filter(m => (m?.level ?? 0) >= 2).length;
}

/**
 * The rank a loaded game or a scenario starts at: what the figures give, and
 * no lower than the floor the scenario sets.
 */
export function startingRank(stats: RankStats, floor = 0): number {
  return Math.max(clampRank(floor), qualifyingRank(stats));
}

/**
 * Where a rank of the first six-step ladder (saves before version 7) sits on
 * this one: the old Startup/Regional/National/International/Flag/Global.
 */
const OLD_LADDER: readonly number[] = [0, 2, 4, 6, 8, 9];

export function migrateOldRank(oldRank: number): number {
  const i = Math.max(0, Math.min(OLD_LADDER.length - 1, Math.round(Number.isFinite(oldRank) ? oldRank : 0)));
  return OLD_LADDER[i];
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
  airportId?: string,
  free = false
): string | null {
  if (airportId && (management?.[airportId]?.level ?? 0) >= tier) return null;
  if (tier === 2) {
    const cap = hubAllowance(rank, extraHubs, free);
    if (countHubs(management) >= cap) {
      return `Your airline (${rankDef(rank).title}) may run ${cap} hub${cap === 1 ? '' : 's'}, and all ${cap === 1 ? 'is' : 'are'} in use. ` +
        `A higher rank or a gold milestone makes room for more.`;
    }
  }
  if (tier === 3) return rankGateMessage(rank, RANK_NEEDED.managementTier3, 'Management tier 3');
  return null;
}
