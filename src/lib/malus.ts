/**
 * A ceiling on bad luck: at most half of all months carry a malus event.
 *
 * "Malus event" means anything that happens to the player without them
 * deciding it and only costs them:
 *
 *   long-term   a random world event that hurts (isMalusEvent), which lasts
 *               several months
 *   one-time    a month with an operational disruption (technical defect,
 *               bird strike, airport strike, winter weather) or a staff strike
 *
 * Not counted: the scripted historical events (oil crises, the pandemic...).
 * They are history, they always happen, and they never use up or wait for
 * this budget.
 *
 * The rule is one sentence: a run of malus months is followed by at least as
 * many clean months. In practice:
 *
 *   - a month with a one-time malus event is followed by a clean month;
 *   - a random malus event that lasts d months is followed by d clean months,
 *     and nothing else is added on top of it while it runs.
 *
 * So the malus share can never pass 50%, however large the network is. (A
 * huge network sits right at the ceiling, a small one is far below it, as its
 * chances per route and airport are unchanged.)
 *
 * The rule looks only at what is already in the game state -- the random
 * events, this month's disruptions and the latest strike -- so it needs no
 * extra saved data and works on old saves.
 *
 * Everything here is pure.
 */
import type { Disruption, Staff } from './gameState';
import type { HistoricalEvent } from './eventSystem';
import { disruptionsIn } from './disruptions';
import { isStrikeActive } from './staff';

/**
 * Whether a random event only hurts the player: demand falls, or fuel gets
 * dearer by more than demand rises. A surge that raises demand by 10% and
 * fuel by 5% is a bonus; a pipeline outage that raises fuel by 25% is not.
 */
export function isMalusEvent(ev: Pick<HistoricalEvent, 'demandMultiplier' | 'fuelMultiplier'>): boolean {
  return ev.demandMultiplier < 1 || ev.fuelMultiplier > ev.demandMultiplier;
}

/**
 * The months a random malus event claims from its first month on: the
 * months it lasts, and the same number again to recover. `[first, end)`.
 */
export function malusEventClaim(ev: Pick<HistoricalEvent, 'startOffset' | 'duration'>): { first: number; end: number } {
  const months = Math.max(1, Math.floor(Number(ev.duration)) || 1);
  return { first: ev.startOffset, end: ev.startOffset + 2 * months };
}

/** Whether the month at `offset` had a one-time malus event: a disruption or a staff strike. */
export function hadOneTimeMalus(
  disruptions: Disruption[] | undefined,
  staff: Pick<Staff, 'strike'>,
  offset: number
): boolean {
  return disruptionsIn(disruptions, offset).length > 0 || isStrikeActive(staff, offset);
}

/**
 * Whether the month at `offset` may still take on new malus events, given
 * what is in the game state at the close of the month before it: no, while a
 * random malus event of the past (or one still running) claims it, and no
 * right after a month with a one-time malus event.
 *
 * `disruptions` and `staff` are those of the month just closing, `offset - 1`.
 * Historical events are not passed in and never matter.
 */
export function malusMonthOpen(
  randomEvents: HistoricalEvent[],
  disruptions: Disruption[] | undefined,
  staff: Pick<Staff, 'strike'>,
  offset: number
): boolean {
  for (const ev of randomEvents) {
    if (!isMalusEvent(ev)) continue;
    const { first, end } = malusEventClaim(ev);
    if (offset >= first && offset < end) return false;
  }
  return !hadOneTimeMalus(disruptions, staff, offset - 1);
}
