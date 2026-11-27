/**
 * The board's annual goal on the screen (docs/neubau 6.11).
 *
 * Offer, reward, penalty, measurement and progress are the model's (`annualGoalOffers`, `yearSnapshot`,
 * `goalValue`, `goalFraction`, `settleGoal` in `src/model/progress.ts`); a goal is saved exactly as the model
 * makes it. This file adds the goal as a sentence, the closed reports in the model's form and the check of a
 * saved goal or offer.
 */
import type { AnnualGoal, GoalKind, GoalMonthReport } from '../model/progress';
import type { GoalTag } from '../model/constants';

export type { AnnualGoal, GoalKind } from '../model/progress';

const GOAL_KINDS: readonly GoalKind[] = ['profit', 'routes', 'regions', 'reputation', 'pax', 'noLoss'];
const GOAL_TAGS: readonly GoalTag[] = ['steady', 'focus', 'stretch'];

/** What the board is offering for a year and has yet to be answered. */
export interface GoalOffer {
  year: number;
  options: AnnualGoal[];
}

/** The goal as a sentence: "Operating profit of $4.2M". */
export function describeGoal(goal: AnnualGoal, formatMoney: (n: number) => string, formatCount: (n: number) => string): string {
  switch (goal.kind) {
    case 'profit':
      return `Operating profit of ${formatMoney(goal.target)}`;
    case 'routes':
      return `${formatCount(goal.target)} routes by December`;
    case 'regions':
      return `${formatCount(goal.target)} regions served by December`;
    case 'reputation':
      return `Reputation of ${formatCount(goal.target)} by December`;
    case 'pax':
      return `${formatCount(goal.target)} passengers over the year`;
    case 'noLoss':
      return 'No month in loss';
  }
}

interface ReportLike {
  year: number;
  totalProfit?: number;
  routeRevenues?: number;
  paxTotal?: number;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * The closed reports as the model's month reports for the goal (`GoalMonthReport`): result = `totalProfit`,
 * revenue = `routeRevenues`, passengers = `paxTotal`, as the bridge reads them (`historyReport`).
 */
export function goalReports(reports: readonly ReportLike[]): GoalMonthReport[] {
  return reports
    .filter((r) => r && Number.isFinite(r.year))
    .map((r) => ({ year: r.year, result: num(r.totalProfit), revenue: num(r.routeRevenues), passengers: num(r.paxTotal) }));
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A saved goal, checked; null when it is not one the model made. */
export function normalizeGoal(raw: unknown): AnnualGoal | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  if (!isNum(g.year) || !GOAL_KINDS.includes(g.kind as GoalKind) || !GOAL_TAGS.includes(g.tag as GoalTag)) return null;
  if (!isNum(g.target) || !isNum(g.reward) || !isNum(g.penalty)) return null;
  return {
    year: Math.round(g.year),
    kind: g.kind as GoalKind,
    tag: g.tag as GoalTag,
    target: Math.max(0, g.target),
    reward: Math.max(0, g.reward),
    penalty: Math.max(0, g.penalty),
  };
}

/** A saved offer, or null when it is not a usable one. */
export function normalizeOffer(raw: unknown): GoalOffer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!isNum(o.year) || !Array.isArray(o.options)) return null;
  const options = o.options.map(normalizeGoal).filter((g): g is AnnualGoal => g !== null);
  return options.length > 0 ? { year: Math.round(o.year), options } : null;
}

/**
 * What the board's offer says about itself: how many goals, that a harder goal pays more (also while the airline is
 * small: the minimum bonus is graded by goal, model 6.11, E83), and until when the choice is open (the January close).
 */
export function goalOfferLines(offer: GoalOffer): { intro: string; deadline: string } {
  const count = offer.options.length === 3 ? 'three' : offer.options.length === 2 ? 'two' : String(offer.options.length);
  return {
    intro: `The board offers ${count} goals for ${offer.year}. A harder goal pays more and costs more to miss.`,
    deadline: `Choose before January ${offer.year} is closed; without a choice the first goal stands.`
  };
}
