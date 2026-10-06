/**
 * Milestones: the things worth remembering about an airline's career.
 *
 * There used to be seven of them, one each, and the only reward was a few
 * reputation points. They now come in tracks of three tiers (bronze, silver,
 * gold) and pay out in things the player can use: cash, cheaper airport slots
 * and, for the gold ones, room for another hub.
 *
 * Checked at the end of each month and awarded once. Everything here is pure;
 * App.tsx supplies the figures and applies the result.
 */

export type MilestoneTier = 'bronze' | 'silver' | 'gold' | 'feat';

export type MilestoneTrack = 'network' | 'fleet' | 'passengers' | 'reach' | 'finance' | 'standing' | 'hub' | 'feats';

export const TRACK_LABELS: Record<MilestoneTrack, string> = {
  network: 'Network',
  fleet: 'Fleet',
  passengers: 'Passengers',
  reach: 'Reach',
  finance: 'Finance',
  standing: 'Standing',
  hub: 'Hub',
  feats: 'Feats'
};

export interface MilestoneContext {
  routeCount: number;
  fleetSize: number;
  capital: number;
  longestRouteKm: number;
  continents: number;
  profitableMonthStreak: number;
  reputation: number;
  /** Passengers carried over the whole career, every leg counted. */
  careerPax: number;
  /** Connecting passengers in the month just closed. */
  transferPaxMonth: number;
  hasWidebody: boolean;
  hasSupersonic: boolean;
  /** Rival airlines bought. */
  takeovers: number;
}

export interface MilestoneReward {
  /** Reputation points, added once. */
  reputation: number;
  /** A one-off payment from the board and the sponsors. */
  cash: number;
  /** Fraction taken off every airport slot bought from now on; adds up across milestones. */
  slotDiscount: number;
  /** Hubs (airports at management tier 2) the airline may run beyond what its rank allows. */
  extraHubs: number;
}

export interface Milestone {
  id: string;
  track: MilestoneTrack;
  tier: MilestoneTier;
  title: string;
  detail: string;
  reward: MilestoneReward;
  met: (c: MilestoneContext) => boolean;
}

/** What each tier pays. A feat is a one-off and pays like silver. */
const TIER_REWARD: Record<MilestoneTier, MilestoneReward> = {
  bronze: { reputation: 3, cash: 500_000, slotDiscount: 0, extraHubs: 0 },
  silver: { reputation: 5, cash: 3_000_000, slotDiscount: 0.02, extraHubs: 0 },
  gold: { reputation: 8, cash: 15_000_000, slotDiscount: 0.03, extraHubs: 0 },
  feat: { reputation: 4, cash: 2_000_000, slotDiscount: 0.01, extraHubs: 0 }
};

const make = (
  id: string,
  track: MilestoneTrack,
  tier: MilestoneTier,
  title: string,
  detail: string,
  met: (c: MilestoneContext) => boolean,
  override: Partial<MilestoneReward> = {}
): Milestone => ({ id, track, tier, title, detail, reward: { ...TIER_REWARD[tier], ...override }, met });

export const MILESTONES: Milestone[] = [
  // Network
  make('first-route', 'network', 'bronze', 'First route opened', 'Your airline is flying.',
    c => c.routeCount >= 1, { reputation: 2 }),
  make('routes-10', 'network', 'bronze', 'Ten routes', 'A network, not a handful of lines.', c => c.routeCount >= 10),
  make('routes-50', 'network', 'silver', 'Fifty routes', 'Passengers can reach fifty places from your hubs.', c => c.routeCount >= 50),
  make('routes-150', 'network', 'gold', '150 routes', 'One of the great route networks.', c => c.routeCount >= 150, { extraHubs: 1 }),

  // Fleet
  make('fleet-10', 'fleet', 'bronze', 'Ten aircraft', 'A fleet rather than a handful of aeroplanes.', c => c.fleetSize >= 10),
  make('fleet-50', 'fleet', 'silver', 'Fifty aircraft', 'The hangar is never empty.', c => c.fleetSize >= 50),
  make('fleet-200', 'fleet', 'gold', '200 aircraft', 'A fleet that rivals the national carriers.', c => c.fleetSize >= 200),

  // Passengers, over the whole career
  make('pax-1m', 'passengers', 'bronze', 'One million passengers', 'Counted over the whole career.', c => c.careerPax >= 1_000_000),
  make('pax-10m', 'passengers', 'silver', 'Ten million passengers', 'A city the size of Lagos has flown with you.', c => c.careerPax >= 10_000_000),
  make('pax-100m', 'passengers', 'gold', 'One hundred million passengers', 'More than the population of Germany, with room to spare.',
    c => c.careerPax >= 100_000_000, { extraHubs: 1 }),

  // Reach
  make('continents-2', 'reach', 'bronze', 'Two continents served', 'Your network crosses a continental border.', c => c.continents >= 2),
  make('longhaul', 'reach', 'bronze', 'First intercontinental route', 'A route beyond 5,000 km.', c => c.longestRouteKm >= 5000, { reputation: 4 }),
  make('continents-4', 'reach', 'silver', 'Four continents served', 'Your network spans four continents.', c => c.continents >= 4),
  make('ultralong', 'reach', 'silver', 'Ultra long haul', 'A route beyond 10,000 km.', c => c.longestRouteKm >= 10000),
  make('continents-6', 'reach', 'gold', 'Every continent served', 'The sun never sets on your network.', c => c.continents >= 6),

  // Finance
  make('capital-100m', 'finance', 'bronze', '$100 million in the bank', 'Enough to buy almost anything on the market.', c => c.capital >= 100_000_000),
  make('profit-12', 'finance', 'bronze', 'A full year in profit', 'Twelve consecutive months without a loss.', c => c.profitableMonthStreak >= 12, { reputation: 6 }),
  make('capital-1b', 'finance', 'silver', '$1 billion in the bank', 'The banks now call you.', c => c.capital >= 1_000_000_000),
  make('profit-60', 'finance', 'silver', 'Five years without a loss', 'Sixty consecutive months in profit.', c => c.profitableMonthStreak >= 60),
  make('capital-10b', 'finance', 'gold', '$10 billion in the bank', 'A war chest few governments could match.', c => c.capital >= 10_000_000_000),
  make('profit-120', 'finance', 'gold', 'A decade without a loss', 'One hundred and twenty consecutive months in profit.', c => c.profitableMonthStreak >= 120),

  // Standing
  make('reputation-60', 'standing', 'bronze', 'A name people know', 'Reputation above 60.', c => c.reputation >= 60),
  make('reputation-80', 'standing', 'silver', 'A reputation worth having', 'Reputation above 80.', c => c.reputation >= 80, { reputation: 0 }),
  make('reputation-95', 'standing', 'gold', 'The gold standard', 'Reputation above 95.', c => c.reputation >= 95, { reputation: 0 }),

  // Hub
  make('transfer-1k', 'hub', 'bronze', '1,000 connecting passengers', 'In a single month.', c => c.transferPaxMonth >= 1_000),
  make('transfer-10k', 'hub', 'silver', '10,000 connecting passengers', 'In a single month.', c => c.transferPaxMonth >= 10_000),
  make('transfer-50k', 'hub', 'gold', '50,000 connecting passengers', 'In a single month: a true hub.', c => c.transferPaxMonth >= 50_000),

  // Feats
  make('widebody', 'feats', 'feat', 'The wide-body age', 'A wide-body aircraft joins the fleet.', c => c.hasWidebody),
  make('supersonic', 'feats', 'feat', 'Flying faster than sound', 'A supersonic airliner joins the fleet.', c => c.hasSupersonic, { reputation: 8 }),
  make('takeover', 'feats', 'feat', 'Consolidator', 'You bought a rival airline.', c => c.takeovers >= 1, { reputation: 5 }),
  make('takeover-3', 'feats', 'feat', 'Empire builder', 'Three rival airlines have been absorbed.', c => c.takeovers >= 3, { reputation: 8, extraHubs: 1 })
];

/** Slot discounts never add up to more than this. */
export const SLOT_DISCOUNT_CAP = 0.3;

export interface MilestonePerks {
  /** Multiplies the price of an airport slot, 0.7-1. */
  slotPriceFactor: number;
  extraHubs: number;
}

export const NEUTRAL_PERKS: MilestonePerks = { slotPriceFactor: 1, extraHubs: 0 };

/** What the milestones earned so far give the airline. */
export function milestonePerks(earnedIds: readonly string[]): MilestonePerks {
  const earned = new Set(earnedIds);
  let discount = 0;
  let hubs = 0;
  for (const m of MILESTONES) {
    if (!earned.has(m.id)) continue;
    discount += m.reward.slotDiscount;
    hubs += m.reward.extraHubs;
  }
  return { slotPriceFactor: 1 - Math.min(SLOT_DISCOUNT_CAP, discount), extraHubs: hubs };
}

/** The milestones the context newly satisfies, in catalogue order. */
export function newlyEarned(earnedIds: readonly string[], ctx: MilestoneContext): Milestone[] {
  const have = new Set(earnedIds);
  return MILESTONES.filter(m => !have.has(m.id) && m.met(ctx));
}

/** The sum of the rewards of a batch of milestones. */
export function totalReward(list: readonly Milestone[]): MilestoneReward {
  return list.reduce<MilestoneReward>(
    (sum, m) => ({
      reputation: sum.reputation + m.reward.reputation,
      cash: sum.cash + m.reward.cash,
      slotDiscount: sum.slotDiscount + m.reward.slotDiscount,
      extraHubs: sum.extraHubs + m.reward.extraHubs
    }),
    { reputation: 0, cash: 0, slotDiscount: 0, extraHubs: 0 }
  );
}

/** One line describing what a milestone pays, for the inbox and the catalogue. */
export function describeReward(r: MilestoneReward, formatMoney: (n: number) => string): string {
  const parts: string[] = [];
  if (r.reputation > 0) parts.push(`reputation +${r.reputation}`);
  if (r.cash > 0) parts.push(`${formatMoney(r.cash)} prize`);
  if (r.slotDiscount > 0) parts.push(`slots ${Math.round(r.slotDiscount * 100)}% cheaper`);
  if (r.extraHubs > 0) parts.push(`room for ${r.extraHubs} more hub${r.extraHubs === 1 ? '' : 's'}`);
  return parts.length > 0 ? parts.join(', ') : 'no bonus attached: this one is the reward';
}
