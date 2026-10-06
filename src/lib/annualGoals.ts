/**
 * The board's annual goal.
 *
 * It used to be one number, always the same: 15% more profit than last year,
 * with nothing lost for missing it. Now each December the board puts three
 * goals to the player for the year ahead -- a safe profit target, a different
 * kind of goal, and a stretch -- and the player picks one. A harder goal pays
 * more and costs more to miss, so the choice is a bet on one's own airline.
 *
 * Everything here is pure; App.tsx supplies the figures and applies the result.
 */

export type GoalKind = 'profit' | 'routes' | 'regions' | 'reputation' | 'pax' | 'noLoss';

export const GOAL_KINDS: readonly GoalKind[] = ['profit', 'routes', 'regions', 'reputation', 'pax', 'noLoss'];

export interface AnnualGoal {
  year: number;
  kind: GoalKind;
  /** What has to be reached: dollars, a count, reputation points. Zero for noLoss. */
  target: number;
  /** Short wording, without the number: "operating profit". */
  label: string;
  /** What the board says it is: 'steady', 'stretch', or the kind of the goal. */
  tag: 'steady' | 'stretch' | 'focus';
  reward: { reputation: number; cash: number };
  /** Reputation lost when the goal is missed. */
  penalty: number;
}

/** What the board is offering for a year and has yet to be answered. */
export interface GoalOffer {
  year: number;
  options: AnnualGoal[];
}

/** The year as it stands, measured from the reports and the airline as it is now. */
export interface YearSnapshot {
  profit: number;
  pax: number;
  /** Months of the year closed with an operating loss. */
  lossMonths: number;
  routes: number;
  regions: number;
  reputation: number;
}

/** What the offer is built from. */
export interface OfferContext {
  /** Operating profit of the year just closed. */
  lastYearProfit: number;
  lastYearPax: number;
  routes: number;
  regions: number;
  reputation: number;
}

const PROFIT_FLOOR = 2_000_000;
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** Rounds a dollar target to a figure that reads like a target. */
export function niceDollars(n: number): number {
  if (n >= 100_000_000) return roundTo(n, 5_000_000);
  if (n >= 10_000_000) return roundTo(n, 1_000_000);
  return roundTo(n, 100_000);
}

function profitGoal(year: number, base: number, factor: number, tag: 'steady' | 'stretch'): AnnualGoal {
  const target = niceDollars(Math.max(PROFIT_FLOOR * (tag === 'stretch' ? 1.5 : 1), base * factor));
  const stretch = tag === 'stretch';
  return {
    year, kind: 'profit', target, tag,
    label: 'operating profit',
    reward: { reputation: stretch ? 7 : 3, cash: Math.round((target * (stretch ? 0.03 : 0.01)) / 50_000) * 50_000 },
    penalty: stretch ? 3 : 1
  };
}

type FocusBuilder = (year: number, c: OfferContext) => AnnualGoal | null;

const FOCUS_BUILDERS: FocusBuilder[] = [
  (year, c) => c.routes < 1 ? null : {
    year, kind: 'routes', tag: 'focus', label: 'routes in operation',
    target: c.routes + Math.max(3, Math.ceil(c.routes * 0.2)),
    reward: { reputation: 5, cash: 1_000_000 }, penalty: 2
  },
  (year, c) => c.regions >= 6 || c.routes < 1 ? null : {
    year, kind: 'regions', tag: 'focus', label: 'regions served',
    target: c.regions + 1,
    reward: { reputation: 6, cash: 1_500_000 }, penalty: 2
  },
  (year, c) => c.reputation >= 92 || c.routes < 1 ? null : {
    year, kind: 'reputation', tag: 'focus', label: 'reputation',
    target: Math.min(98, Math.ceil(c.reputation + 6)),
    reward: { reputation: 4, cash: 1_000_000 }, penalty: 2
  },
  (year, c) => c.lastYearPax <= 0 ? null : {
    year, kind: 'pax', tag: 'focus', label: 'passengers carried',
    target: Math.max(1000, roundTo(c.lastYearPax * 1.2, c.lastYearPax >= 1_000_000 ? 100_000 : 1_000)),
    reward: { reputation: 5, cash: 1_000_000 }, penalty: 2
  },
  (year, c) => c.routes < 1 ? null : {
    year, kind: 'noLoss', tag: 'focus', label: 'months in loss',
    target: 0,
    reward: { reputation: 5, cash: 1_500_000 }, penalty: 2
  }
];

/**
 * The three goals offered for `year`: steady profit, a goal of another kind,
 * and stretch profit. The other kind rotates with the year, so the board does
 * not ask for the same thing every January; goals that make no sense for the
 * airline as it is (more regions when all six are served) are left out.
 */
export function generateGoalOffers(year: number, ctx: OfferContext): AnnualGoal[] {
  const eligible = FOCUS_BUILDERS.map(b => b(year, ctx)).filter((g): g is AnnualGoal => g !== null);
  const options: AnnualGoal[] = [profitGoal(year, ctx.lastYearProfit, 1.1, 'steady')];
  if (eligible.length > 0) options.push(eligible[((year % eligible.length) + eligible.length) % eligible.length]);
  options.push(profitGoal(year, ctx.lastYearProfit, 1.35, 'stretch'));
  return options;
}

/** The goal as a sentence: "Operating profit of $4.2M". */
export function describeGoal(goal: AnnualGoal, formatMoney: (n: number) => string, formatCount: (n: number) => string): string {
  switch (goal.kind) {
    case 'profit': return `Operating profit of ${formatMoney(goal.target)}`;
    case 'routes': return `${formatCount(goal.target)} routes by December`;
    case 'regions': return `${formatCount(goal.target)} regions served by December`;
    case 'reputation': return `Reputation of ${formatCount(goal.target)} by December`;
    case 'pax': return `${formatCount(goal.target)} passengers over the year`;
    case 'noLoss': return 'No month in loss';
  }
}

/** The figure the goal measures, taken from the snapshot. */
export function goalValue(goal: AnnualGoal, snap: YearSnapshot): number {
  switch (goal.kind) {
    case 'profit': return snap.profit;
    case 'routes': return snap.routes;
    case 'regions': return snap.regions;
    case 'reputation': return snap.reputation;
    case 'pax': return snap.pax;
    case 'noLoss': return snap.lossMonths;
  }
}

export function goalMet(goal: AnnualGoal, snap: YearSnapshot): boolean {
  const value = goalValue(goal, snap);
  return goal.kind === 'noLoss' ? value <= 0 : value >= goal.target;
}

/** 0-1 progress, for a bar. A loss-free goal is fully met until the first loss. */
export function goalFraction(goal: AnnualGoal, snap: YearSnapshot): number {
  if (goal.kind === 'noLoss') return snap.lossMonths <= 0 ? 1 : 0;
  if (goal.target <= 0) return 1;
  return Math.max(0, Math.min(1, goalValue(goal, snap) / goal.target));
}

interface ReportLike {
  year: number;
  totalProfit?: number;
  paxTotal?: number;
}

/** The snapshot of `year` from the closed reports and the airline as it stands. */
export function buildYearSnapshot(
  reports: readonly ReportLike[],
  year: number,
  now: { routes: number; regions: number; reputation: number }
): YearSnapshot {
  let profit = 0;
  let pax = 0;
  let lossMonths = 0;
  for (const r of reports) {
    if (!r || r.year !== year) continue;
    const p = Number.isFinite(r.totalProfit) ? (r.totalProfit as number) : 0;
    profit += p;
    pax += Number.isFinite(r.paxTotal) ? (r.paxTotal as number) : 0;
    if (p < 0) lossMonths++;
  }
  return { profit, pax, lossMonths, routes: now.routes, regions: now.regions, reputation: now.reputation };
}

/** What the board makes of a year: the reputation and cash it gives or takes. */
export function settleGoal(goal: AnnualGoal, snap: YearSnapshot): { met: boolean; reputation: number; cash: number; achieved: number } {
  const met = goalMet(goal, snap);
  return {
    met,
    reputation: met ? goal.reward.reputation : -goal.penalty,
    cash: met ? goal.reward.cash : 0,
    achieved: goalValue(goal, snap)
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * A goal as saved, whatever version wrote it. The first goals were a bare
 * `{ year, targetProfit }`; they load as a steady profit goal worth what they
 * were worth then: four reputation points, nothing lost.
 */
export function normalizeGoal(raw: unknown): AnnualGoal | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, any>;
  if (!isNum(g.year)) return null;
  if (GOAL_KINDS.includes(g.kind) && isNum(g.target)) {
    const reward = g.reward && typeof g.reward === 'object' ? g.reward : {};
    return {
      year: Math.round(g.year),
      kind: g.kind,
      target: Math.max(0, g.target),
      label: typeof g.label === 'string' ? g.label : g.kind,
      tag: g.tag === 'stretch' || g.tag === 'focus' ? g.tag : 'steady',
      reward: {
        reputation: isNum(reward.reputation) ? reward.reputation : 0,
        cash: isNum(reward.cash) ? Math.max(0, reward.cash) : 0
      },
      penalty: isNum(g.penalty) ? Math.max(0, g.penalty) : 0
    };
  }
  if (isNum(g.targetProfit)) {
    return {
      year: Math.round(g.year), kind: 'profit', target: g.targetProfit, tag: 'steady',
      label: 'operating profit', reward: { reputation: 4, cash: 0 }, penalty: 0
    };
  }
  return null;
}

/** A saved offer, or null when it is not a usable one. */
export function normalizeOffer(raw: unknown): GoalOffer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, any>;
  if (!isNum(o.year) || !Array.isArray(o.options)) return null;
  const options = o.options.map(normalizeGoal).filter((g): g is AnnualGoal => g !== null);
  return options.length > 0 ? { year: Math.round(o.year), options } : null;
}
