/**
 * Judging a game against its scenario (src/data/scenarios.ts).
 *
 * Called once at every month's close with what the close worked out, it
 * answers "running", "won" or "lost" and how far each goal has come:
 *
 *   - A goal is met when the month's figure reaches its target. Without
 *     `atDeadline`, the scenario is won at the FIRST close where every goal
 *     is met at once -- a player does not have to wait for the deadline.
 *   - A scenario with an `atDeadline` goal is only decided at the deadline's
 *     close; every goal must be met at that close.
 *   - When the deadline's close passes without a win, the scenario is lost.
 *   - A lose goal (bankruptcy) ends it at once, whatever else was met in the
 *     same close.
 *
 * Nothing here keeps state: a goal met in one month and missed in the next
 * is simply not met. Everything is pure.
 */
import type { CapitalFloorGoal, GoalMetric, Scenario, TargetGoal } from '../data/scenarios';
import { formatCurrency, formatMoneyCompact, formatMonthOffset, formatNumber } from './format';
import type { ScenarioStatus } from './gameState';

export type { ScenarioStatus };

/** What a month's close knows, in the terms the goals are written in. */
export interface ScenarioContext {
  /** The month just closed. */
  offset: number;
  /** Cash at its end. */
  capital: number;
  /** Every route flown, with its weekly departures. */
  routes: { weeklyFlights: number }[];
  reputation: number;
  /** World regions the network touches. */
  regionsServed: number;
  /** Passengers who changed planes at the player's airports in the month, each counted once. */
  transferPaxMonth: number;
  /** The month's operating profit. */
  monthlyProfit: number;
  /** Capital at every month-end since the scenario started, oldest first, this one included. */
  capitalHistory: number[];
}

export interface GoalProgress {
  id: string;
  label: string;
  /** A goal to reach, or a way to lose. */
  kind: 'win' | 'lose';
  metric: GoalMetric | 'capitalFloor';
  current: number;
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
}

export interface ScenarioEvaluation {
  status: ScenarioStatus;
  goals: GoalProgress[];
  /** One sentence on why it was won or lost; absent while running. */
  reason?: string;
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** The month's figure a target goal is measured by. */
export function goalValue(goal: TargetGoal, ctx: ScenarioContext): number {
  switch (goal.metric) {
    case 'capital': return ctx.capital;
    case 'routes': {
      const min = goal.minWeeklyFlights ?? 0;
      return ctx.routes.filter(r => (r.weeklyFlights || 0) >= min).length;
    }
    case 'reputation': return ctx.reputation;
    case 'regions': return ctx.regionsServed;
    case 'transferPax': return ctx.transferPaxMonth;
    case 'monthlyProfit': return ctx.monthlyProfit;
  }
  return 0;
}

/** Month-ends in a row, counting back from the newest, with capital below the threshold. */
export function capitalFloorStreak(history: number[], threshold: number): number {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (!(history[i] < threshold)) break;
    streak++;
  }
  return streak;
}

/** A figure as its goal speaks of it: money, or a count. `compact` shortens money to "$12.5M". */
export function formatGoalValue(metric: GoalMetric | 'capitalFloor', value: number, compact = false): string {
  if (metric === 'capital' || metric === 'monthlyProfit' || metric === 'capitalFloor') {
    return compact ? formatMoneyCompact(value) : formatCurrency(value);
  }
  return formatNumber(Math.round(value));
}

function targetProgress(goal: TargetGoal, ctx: ScenarioContext): GoalProgress {
  const current = goalValue(goal, ctx);
  const done = current >= goal.target;
  return {
    id: goal.id,
    label: goal.label,
    kind: 'win',
    metric: goal.metric,
    current,
    target: goal.target,
    // A target of zero or less (an operating profit) is met or it is not.
    progress: goal.target > 0 ? clamp01(current / goal.target) : done ? 1 : 0,
    done,
    ...(goal.atDeadline ? { atDeadline: true } : {})
  };
}

function floorProgress(goal: CapitalFloorGoal, ctx: ScenarioContext): GoalProgress {
  const months = Math.max(1, Math.round(goal.months));
  const streak = capitalFloorStreak(ctx.capitalHistory, goal.threshold);
  return {
    id: goal.id,
    label: goal.label,
    kind: 'lose',
    metric: 'capitalFloor',
    current: ctx.capital,
    target: goal.threshold,
    progress: clamp01(streak / months),
    done: streak >= months,
    streak,
    months
  };
}

/** Where the goals stand, without deciding anything: for the progress panel. */
export function scenarioGoals(scenario: Scenario, ctx: ScenarioContext): GoalProgress[] {
  return [...scenario.win.map(g => targetProgress(g, ctx)), ...scenario.lose.map(g => floorProgress(g, ctx))];
}

/** The scenario after the close of month `ctx.offset`. See the notes at the top. */
export function evaluateScenario(scenario: Scenario, ctx: ScenarioContext): ScenarioEvaluation {
  const goals = scenarioGoals(scenario, ctx);
  const win = goals.filter(g => g.kind === 'win');
  const month = formatMonthOffset(ctx.offset);

  const broken = goals.find(g => g.kind === 'lose' && g.done);
  if (broken) {
    const reason = broken.months === 1
      ? `Capital fell below ${formatCurrency(broken.target)} at the end of ${month}.`
      : `Capital stayed below ${formatCurrency(broken.target)} for ${broken.months} month-ends in a row: bankrupt in ${month}.`;
    return { status: 'lost', goals, reason };
  }

  const allMet = win.length > 0 && win.every(g => g.done);
  const atDeadline = ctx.offset >= scenario.deadlineOffset;
  const waitsForDeadline = win.some(g => g.atDeadline);

  if (allMet && (atDeadline || !waitsForDeadline)) {
    const early = scenario.deadlineOffset - ctx.offset;
    return {
      status: 'won',
      goals,
      reason: early > 0
        ? `Every goal met in ${month}, ${early} month${early === 1 ? '' : 's'} before the deadline.`
        : `Every goal met at the deadline, ${month}.`
    };
  }

  if (atDeadline) {
    const missed = win.filter(g => !g.done);
    return {
      status: 'lost',
      goals,
      reason: `The deadline passed with goals missed: ${missed.map(g => `${g.label} (${formatGoalValue(g.metric, g.current)} of ${formatGoalValue(g.metric, g.target)})`).join('; ')}.`
    };
  }

  return { status: 'running', goals };
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
