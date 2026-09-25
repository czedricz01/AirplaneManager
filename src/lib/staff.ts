/**
 * Pay, morale and strikes: the airline's people as something to manage.
 *
 * The player sets one number, pay as a percentage of the market wage. Pay
 * sets the morale the staff drift towards; morale moves a fifth of the way
 * there each month, so a pay rise is felt over a season, not overnight.
 * Morale reaches the economy twice, through buildPlayerModifiers:
 *
 *   satisfaction  (morale - 60) / 10 points in every cabin, about +-4
 *   crew cost     x pay / 100, for flight crew and ground staff alike
 *
 * Below morale 35 the staff may strike, (35 - morale) x 0.6% a month. A
 * strike is called for the coming month and grounds all of it until the
 * player answers: a 10% pay rise halves the cancellations, sitting it out
 * grounds everything and costs reputation. Market pay settles morale at 50,
 * well clear of the threshold; only an airline that underpays for months
 * ever sees a strike.
 *
 * Everything here is pure. The one random draw, whether a strike is called,
 * takes its generator as a parameter so a test can fix it.
 */
import type { GameDecision, Staff, Strike } from './gameState';
import { formatCurrency } from './format';

// --- Pay ---------------------------------------------------------------------

/** The range pay can be set in, as a percentage of the market wage. */
export const SALARY_PCT_MIN = 80;
export const SALARY_PCT_MAX = 130;
/** The pay slider's step. Saves and the strike settlement may hold other values. */
export const SALARY_PCT_STEP = 5;

/** Pay within the allowed range; anything unusable becomes the market wage. */
export function clampSalaryPct(pct: number): number {
  if (!Number.isFinite(pct)) return 100;
  return Math.max(SALARY_PCT_MIN, Math.min(SALARY_PCT_MAX, pct));
}

/** What pay does to crew and ground staff cost: 110% pay, 110% cost. */
export function crewCostFactor(salaryPct: number): number {
  return clampSalaryPct(salaryPct) / 100;
}

// --- Morale ------------------------------------------------------------------

/** Where morale settles at the market wage, with nothing else going on. */
export const BASE_MORALE = 50;
/** Morale points per percentage point of pay above or below the market wage. */
export const MORALE_PER_PAY_POINT = 1.5;
/** A run of profitable months longer than this lifts morale... */
export const PROFIT_STREAK_MONTHS = 6;
/** ...by this much. */
export const PROFIT_STREAK_MORALE = 5;
/** A strike weighs on morale for this many months after it was called... */
export const STRIKE_MEMORY_MONTHS = 6;
/** ...by this much. */
export const STRIKE_MORALE_PENALTY = 10;
/** Share of the gap to the target morale closed each month. */
export const MORALE_INERTIA = 0.2;
/** Morale at which satisfaction is neither helped nor hurt. */
export const NEUTRAL_MORALE = 60;
/** Satisfaction points per morale point away from NEUTRAL_MORALE. */
export const SAT_PER_MORALE_POINT = 0.1;

const clampMorale = (m: number) => Math.max(0, Math.min(100, m));

/**
 * Whether a strike still weighs on morale in the month at `offset`: from the
 * month it was called for through the STRIKE_MEMORY_MONTHS after it.
 */
export function strikeIsRecent(strike: Strike | null | undefined, offset: number): boolean {
  if (!strike) return false;
  const since = offset - strike.startOffset;
  return since >= 0 && since <= STRIKE_MEMORY_MONTHS;
}

/** The morale that pay and the airline's fortunes justify, 0-100. */
export function targetMorale(salaryPct: number, profitStreak: number, recentStrike: boolean): number {
  return clampMorale(
    BASE_MORALE
    + (clampSalaryPct(salaryPct) - 100) * MORALE_PER_PAY_POINT
    + (profitStreak > PROFIT_STREAK_MONTHS ? PROFIT_STREAK_MORALE : 0)
    - (recentStrike ? STRIKE_MORALE_PENALTY : 0)
  );
}

/** One month's movement: a fifth of the way from `morale` to `target`. */
export function stepMorale(morale: number, target: number): number {
  return clampMorale(morale + (target - morale) * MORALE_INERTIA);
}

/** Satisfaction points morale adds to every cabin class: -6 at 0, +4 at 100. */
export function moraleSatDelta(morale: number): number {
  return (clampMorale(morale) - NEUTRAL_MORALE) * SAT_PER_MORALE_POINT;
}

// --- Strikes -----------------------------------------------------------------

/** Below this morale the staff may strike. */
export const STRIKE_MORALE_THRESHOLD = 35;
/** Monthly strike chance per morale point below the threshold: 0.6%. */
export const STRIKE_CHANCE_PER_POINT = 0.006;
/** What the "raise pay" answer to a strike adds to pay, in percentage points. */
export const STRIKE_PAY_RAISE = 10;
/** Share of flights a strike cancels once pay has been raised. */
export const STRIKE_SETTLED_CANCEL_SHARE = 0.5;
/** Share of flights a strike cancels while it is sat out, and until the player answers. */
export const STRIKE_FULL_CANCEL_SHARE = 1;
/** Reputation lost by sitting a strike out. */
export const STRIKE_REPUTATION_PENALTY = 3;

/** The chance, 0-1, that staff at this morale call a strike at a month's end. */
export function strikeChance(morale: number): number {
  return morale < STRIKE_MORALE_THRESHOLD ? (STRIKE_MORALE_THRESHOLD - morale) * STRIKE_CHANCE_PER_POINT : 0;
}

/** Whether a strike grounds flights in the month at `offset`. A strike lasts its one month. */
export function isStrikeActive(staff: Pick<Staff, 'strike'>, offset: number): boolean {
  return !!staff.strike && staff.strike.startOffset === offset;
}

/** Share of every route's flights a strike cancels in the month at `offset`; 0 without one. */
export function strikeCancelShare(staff: Pick<Staff, 'strike'>, offset: number): number {
  if (!isStrikeActive(staff, offset)) return 0;
  return Math.max(0, Math.min(1, Number(staff.strike!.cancelShare) || 0));
}

export interface StaffMonthContext {
  /** Profitable months in a row, the month just closed included. */
  profitStreak: number;
  /** The month about to start, whose morale is worked out and which a strike would hit. */
  nextOffset: number;
  /** A strike question is still waiting for the player's answer. */
  strikePending?: boolean;
  /** The airline flies no routes: there is nothing to strike against. */
  noRoutes?: boolean;
}

export interface StaffMonthResult {
  staff: Staff;
  /** A strike was called for `nextOffset`. */
  strikeCalled: boolean;
  /** The chance it had, for the record. */
  chance: number;
  /** The morale the staff are heading for. */
  target: number;
}

/**
 * The staff side of a month close. Morale takes its monthly step towards
 * the target, and at that new morale a strike may be called for the month
 * about to start. None is called while one is running or waiting for an
 * answer, nor at an airline without routes; the one just ended counts as
 * running, so two never follow back to back.
 *
 * A strike is called at full strength: until the player answers, and if they
 * sit it out, it grounds every flight. `staff.strike` keeps the latest strike
 * after it ends, for the morale it costs over the following months.
 *
 * `rng` is drawn from only when a strike is possible at all.
 */
export function advanceStaff(staff: Staff, ctx: StaffMonthContext, rng: () => number): StaffMonthResult {
  const target = targetMorale(staff.salaryPct, ctx.profitStreak, strikeIsRecent(staff.strike, ctx.nextOffset));
  const morale = stepMorale(staff.morale, target);
  const blocked = !!ctx.strikePending || !!ctx.noRoutes || (!!staff.strike && staff.strike.startOffset >= ctx.nextOffset - 1);
  const chance = blocked ? 0 : strikeChance(morale);
  const strikeCalled = chance > 0 && rng() < chance;
  return {
    staff: {
      ...staff,
      morale,
      strike: strikeCalled ? { startOffset: ctx.nextOffset, cancelShare: STRIKE_FULL_CANCEL_SHARE } : staff.strike
    },
    strikeCalled,
    chance,
    target
  };
}

/**
 * The "raise pay" answer to the strike called for `strikeOffset`: pay up by
 * STRIKE_PAY_RAISE points, capped at the top of the range, and half the
 * flights operate. Unchanged when that strike is no longer the current one.
 */
export function settleStrikeWithPayRise(staff: Staff, strikeOffset: number): Staff {
  if (!staff.strike || staff.strike.startOffset !== strikeOffset) return staff;
  return {
    ...staff,
    salaryPct: clampSalaryPct(staff.salaryPct + STRIKE_PAY_RAISE),
    strike: { ...staff.strike, cancelShare: STRIKE_SETTLED_CANCEL_SHARE }
  };
}

/** The option ids of the strike question. Any other answer means sitting it out. */
export const STRIKE_OPTION_RAISE = 'raise-pay';
export const STRIKE_OPTION_SIT_OUT = 'sit-out';

/**
 * The question put to the player when a strike is called for the month at
 * `strikeOffset`. Both answers are free up front: one costs pay from now on,
 * the other a month's flying and reputation. `monthlyRevenue` is what the
 * airline's tickets brought in over the month just closed, to put a figure
 * on what is at stake.
 */
export function buildStrikeDecision(staff: Staff, strikeOffset: number, monthLabel: string, monthlyRevenue: number): GameDecision {
  const raisedTo = clampSalaryPct(staff.salaryPct + STRIKE_PAY_RAISE);
  const atStake = monthlyRevenue > 0 ? ` Last month's tickets brought in ${formatCurrency(monthlyRevenue)}.` : '';
  return {
    id: `strike_${strikeOffset}`,
    kind: 'strike',
    ref: String(strikeOffset),
    title: `Staff strike in ${monthLabel}`,
    description:
      `Morale has fallen to ${Math.round(staff.morale)} and the unions have called a strike for ${monthLabel}. ` +
      `Until you answer, every flight that month is grounded.${atStake}`,
    options: [
      {
        id: STRIKE_OPTION_RAISE,
        label: `Raise pay to ${Math.round(raisedTo)}%`,
        detail:
          `Crew and ground staff cost ${Math.round(raisedTo)}% of the market wage from now on, and morale recovers faster. ` +
          `Half of the month's flights still do not operate while the deal is worked out.`,
        cost: 0
      },
      {
        id: STRIKE_OPTION_SIT_OUT,
        label: 'Sit it out',
        detail:
          `Pay stays at ${Math.round(staff.salaryPct)}%. Nothing flies in ${monthLabel}, and stranded passengers cost ` +
          `${STRIKE_REPUTATION_PENALTY} reputation. Morale stays low, and another strike may follow.`,
        cost: 0
      }
    ]
  };
}

export interface StaffOutlook {
  target: number;
  /** Morale after the coming month close, at today's pay. */
  nextMorale: number;
  /** The chance of a strike being called at that close. */
  strikeChance: number;
}

/**
 * What the coming month close will do to morale at today's pay, for the staff
 * screen. It assumes the profit streak carries on; the close itself uses the
 * month's actual result.
 */
export function staffOutlook(staff: Staff, profitStreak: number, currentOffset: number, strikePending = false): StaffOutlook {
  const r = advanceStaff(staff, { profitStreak: profitStreak + 1, nextOffset: currentOffset + 1, strikePending }, () => 1);
  return { target: r.target, nextMorale: r.staff.morale, strikeChance: r.chance };
}
