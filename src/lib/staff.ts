/**
 * Pay, morale and strikes: the few helpers the views still need.
 *
 * The rules themselves (target morale, the monthly step, strike chance, pay
 * limits, what a strike cancels) are the model's (SPEZIFIKATION 8.7,
 * `src/model/monthEvents.ts`), and the staff screen reads them through
 * `src/lib/modelStaff.ts`. What is left here: the pay limits under the names
 * the save code uses, whether a strike runs in a month, and the answer ids of
 * the strike question.
 */
import type { Staff } from './gameState';

/** The range pay can be set in, as a percentage of the market wage (the model's limits, 8.7). */
export { SALARY_PCT_MIN, SALARY_PCT_MAX } from '../model/constants';

/** Whether a strike grounds flights in the month at `offset`. A strike lasts its one month. */
export function isStrikeActive(staff: Pick<Staff, 'strike'>, offset: number): boolean {
  return !!staff.strike && staff.strike.startOffset === offset;
}

/** The option ids of the strike question. Any other answer means sitting it out. */
export const STRIKE_OPTION_RAISE = 'raise-pay';
export const STRIKE_OPTION_SIT_OUT = 'sit-out';
