/**
 * Pay, morale and strikes: the few helpers the views still need.
 *
 * The rules themselves (target morale, the monthly step, strike chance, pay
 * limits) are the model's (SPEZIFIKATION 8.7, `src/model/monthEvents.ts`), and
 * the staff screen reads them through `src/lib/modelStaff.ts`. What is left
 * here clamps pay, tells whether a strike runs in a month and what it cancels,
 * and the morale terms `buildPlayerModifiers` (gameState.ts) still uses.
 */
import type { Staff } from './gameState';

// --- Pay ---------------------------------------------------------------------

/** The range pay can be set in, as a percentage of the market wage. */
export const SALARY_PCT_MIN = 80;
export const SALARY_PCT_MAX = 130;

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
/**
 * Morale at which satisfaction is neither helped nor hurt: where market pay
 * settles, so paying the going rate costs nothing.
 */
export const NEUTRAL_MORALE = BASE_MORALE;
/** Satisfaction points per morale point away from NEUTRAL_MORALE. */
export const SAT_PER_MORALE_POINT = 0.1;

const clampMorale = (m: number) => Math.max(0, Math.min(100, m));

/** Satisfaction points morale adds to every cabin class: -5 at 0, +5 at 100. */
export function moraleSatDelta(morale: number): number {
  return (clampMorale(morale) - NEUTRAL_MORALE) * SAT_PER_MORALE_POINT;
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

/** The option ids of the strike question. Any other answer means sitting it out. */
export const STRIKE_OPTION_RAISE = 'raise-pay';
export const STRIKE_OPTION_SIT_OUT = 'sit-out';
