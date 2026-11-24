/**
 * Judging a game against its scenario (src/data/scenarios.ts).
 *
 * Called once at every month's close with what the close worked out, it
 * answers "running", "won" or "lost" and how far each goal has come:
 *
 *   - A goal is met when the month's figure reaches its target. A target of
 *     zero (an operating profit) wants more than nothing: a month that only
 *     breaks even does not meet it, and neither does a monthly figure before
 *     the first month has closed. Without `atDeadline`, the scenario is won
 *     at the FIRST close where every goal is met at once -- a player does
 *     not have to wait for the deadline.
 *   - A scenario with an `atDeadline` goal is only decided at the deadline's
 *     close; every goal must be met at that close.
 *   - When the deadline's close passes without a win, the scenario is lost.
 *   - A lose goal (bankruptcy) ends it at once, whatever else was met in the
 *     same close. Its floor and the month-ends in a row below it are the
 *     model's (`scenarioFloor`, `ScenarioState.floorStreak`, E77).
 *
 * Nothing here keeps state: a goal met in one month and missed in the next
 * is simply not met. Everything is pure.
 */
import type { CapitalFloorGoal, GoalMetric, Scenario, TargetGoal } from '../data/scenarios';
import { atCost } from '../model/basics';
import { scenarioFloor, servedCityPairs } from '../model/monthClose';
import { formatCurrency, formatMoneyCompact, formatMonthOffset, formatNumber } from './format';
import type { ScenarioStatus } from './gameState';

export type { ScenarioStatus };

/** What a month's close knows, in the terms the goals are written in. */
export interface ScenarioContext {
  /** The month just closed. */
  offset: number;
  /** Cash at its end. */
  capital: number;
  /**
   * Every route flown, with its weekly departures. A route is one aircraft's
   * timetable, so one city pair may be flown by several of them.
   */
  routes: { origin: string; destination: string; weeklyFlights: number }[];
  reputation: number;
  /** World regions the network touches. */
  regionsServed: number;
  /**
   * Passengers who changed planes at the player's airports in the month, each
   * counted once. Null before the scenario's first month has closed.
   */
  transferPaxMonth: number | null;
  /** The month's operating profit; null before the scenario's first month has closed. */
  monthlyProfit: number | null;
  /** Month-ends in a row below the floor, as the model counted them at the last close (`ScenarioState.floorStreak`). */
  floorStreak: number;
  /** The credit line now (`creditStatus`), for a floor at the negative credit line (8.15, E77). */
  creditLimit: number;
}

export interface GoalProgress {
  id: string;
  label: string;
  /** A goal to reach, or a way to lose. */
  kind: 'win' | 'lose';
  metric: GoalMetric | 'capitalFloor';
  /** Null for a monthly figure before any month has closed: nothing to show yet. */
  current: number | null;
  target: number;
  /**
   * 0-1. For a win goal how much of the target is reached; for a lose goal
   * how close it is to ending the game (months in a row below the floor).
   */
  progress: number;
  /** A win goal is met; a lose goal has ended the game. */
  done: boolean;
  /** Only counts at the deadline. */
  atDeadline?: boolean;
  /** For a lose goal: month-ends in a row below the floor, and how many end the game. */
  streak?: number;
  months?: number;
  /** For a lose goal: capital is below the floor now (the next month-end would count). */
  below?: boolean;
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/**
 * City pairs flown with at least `minWeekly` departures a week between them,
 * every aircraft on the pair and both directions counted together: a daily
 * service needing two aircraft (4 + 3 a week) is daily, and thirty aircraft
 * on the same pair are still one city pair. The model's count
 * (`servedCityPairs`, SPEZIFIKATION 8.15), so the panel shows what the
 * month close decides.
 */
export function cityPairsServed(routes: ScenarioContext['routes'], minWeekly = 0): number {
  return servedCityPairs(
    routes.map((r) => ({ from: r.origin, to: r.destination, departuresPerWeek: 2 * Math.max(0, Number(r.weeklyFlights) || 0) })),
    minWeekly,
  );
}

/** The month's figure a target goal is measured by; null while a monthly figure has no month to show. */
export function goalValue(goal: TargetGoal, ctx: ScenarioContext): number | null {
  switch (goal.metric) {
    case 'capital': return ctx.capital;
    case 'routes': return cityPairsServed(ctx.routes, goal.minWeeklyFlights ?? 0);
    case 'reputation': return ctx.reputation;
    case 'regions': return ctx.regionsServed;
    case 'transferPax': return ctx.transferPaxMonth;
    case 'monthlyProfit': return ctx.monthlyProfit;
  }
  return 0;
}

/**
 * The floor of a lose goal in dollars of the month `offset`, by the model's rule (`scenarioFloor`, SPEZIFIKATION 8.15,
 * E77): the negative credit line, or the scenario's own threshold (dollars of the start month) moved with the cost
 * index.
 */
export function floorThreshold(goal: CapitalFloorGoal, scenario: Pick<Scenario, 'startOffset'>, creditLimit: number, offset: number): number {
  const t = goal.threshold;
  return scenarioFloor(typeof t === 'number' ? { floorThreshold: t / atCost(1, scenario.startOffset) } : {}, creditLimit, offset);
}

/**
 * A figure as its goal speaks of it: money, or a count. `compact` shortens
 * money to "$12.5M". A figure not known yet is a dash.
 */
export function formatGoalValue(metric: GoalMetric | 'capitalFloor', value: number | null, compact = false): string {
  if (value === null || !Number.isFinite(value)) return '\u2014';
  if (metric === 'capital' || metric === 'monthlyProfit' || metric === 'capitalFloor') {
    return compact ? formatMoneyCompact(value) : formatCurrency(value);
  }
  return formatNumber(Math.round(value));
}

/**
 * Whether a figure meets a target. A target of zero, an operating profit,
 * wants a figure above it: breaking even is no profit. No figure yet meets
 * nothing.
 */
export function meetsTarget(value: number | null, target: number): boolean {
  if (value === null || !Number.isFinite(value)) return false;
  return target === 0 ? value > 0 : value >= target;
}

function targetProgress(goal: TargetGoal, ctx: ScenarioContext): GoalProgress {
  const current = goalValue(goal, ctx);
  const done = meetsTarget(current, goal.target);
  return {
    id: goal.id,
    label: goal.label,
    kind: 'win',
    metric: goal.metric,
    current,
    target: goal.target,
    // A target of zero or less (an operating profit) is met or it is not.
    progress: goal.target > 0 && current !== null ? clamp01(current / goal.target) : done ? 1 : 0,
    done,
    ...(goal.atDeadline ? { atDeadline: true } : {})
  };
}

function floorProgress(goal: CapitalFloorGoal, scenario: Scenario, ctx: ScenarioContext): GoalProgress {
  const months = Math.max(1, Math.round(goal.months));
  const streak = Math.max(0, ctx.floorStreak);
  const target = floorThreshold(goal, scenario, ctx.creditLimit, ctx.offset);
  return {
    id: goal.id,
    label: goal.label,
    kind: 'lose',
    metric: 'capitalFloor',
    current: ctx.capital,
    target,
    progress: clamp01(streak / months),
    done: streak >= months,
    streak,
    months,
    below: ctx.capital < target
  };
}

/** Where the goals stand, without deciding anything: for the progress panel. */
export function scenarioGoals(scenario: Scenario, ctx: ScenarioContext): GoalProgress[] {
  return [...scenario.win.map(g => targetProgress(g, ctx)), ...scenario.lose.map(g => floorProgress(g, scenario, ctx))];
}

/** Month closes still to come, the current month's included: 1 in the deadline month itself. */
export function monthsLeft(scenario: Pick<Scenario, 'deadlineOffset'>, currentOffset: number): number {
  return Math.max(0, scenario.deadlineOffset - currentOffset + 1);
}

/** The briefing the board sends when a scenario starts: the scene, the goals and the ways to lose. */
export function scenarioBriefing(scenario: Scenario): string {
  const by = formatMonthOffset(scenario.deadlineOffset);
  const goals = scenario.win.map(g => `\u2022 ${g.label}${g.atDeadline ? '' : ` by ${by}`}`);
  const risks = scenario.lose.map(g => `\u2022 ${g.label}`);
  const early = scenario.win.some(g => g.atDeadline)
    ? `The scenario is decided at the close of ${by}.`
    : `Meet every goal at the same month's close and the scenario is won on the spot; the last chance is the close of ${by}.`;
  return `${scenario.blurb}\n\nTo win:\n${goals.join('\n')}\n\n${early}\n\nTo avoid:\n${risks.join('\n')}\n\n` +
    `Your aircraft arrive with the standard all-economy cabin. A refit under My Fleet costs about $1,000 a seat.`;
}
