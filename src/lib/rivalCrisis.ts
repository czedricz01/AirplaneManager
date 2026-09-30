/**
 * How the rival airlines behave when the world is in a crisis.
 *
 * The events themselves (demand and fuel multipliers) already hit rivals and
 * player alike, because both are priced by the same finance engine. What was
 * missing is what a sensible airline does about it, and the player is doing it
 * by hand: stop buying aircraft, fly fewer empty seats, rebuild afterwards.
 * This file holds those rules as plain functions so they can be tested alone.
 */
import { getEventMultipliers } from './eventSystem';
import type { RivalPersonality } from '../data/rivalAirlines';

/**
 * How hard the world is hit this month: 0 is normal, 1 is total collapse.
 * It is the larger of the demand loss and half the fuel price rise, so the
 * pandemic (demand x0.20) is 0.8, an oil shock with fuel x2 is 0.5 and the
 * 2001 downturn (demand x0.65) is 0.35. Cheaper fuel or higher demand never
 * counts as a crisis.
 */
export function crisisSeverity(offset: number): number {
  const { demandMult, fuelMult } = getEventMultipliers(offset);
  return Math.min(1, Math.max(0, 1 - demandMult, (fuelMult - 1) / 2));
}

/**
 * From this severity on, rivals cut flights that run empty. The random events
 * (ash cloud, slump, refinery outage) stay below it; every scripted crisis
 * from the Gulf War on is above it.
 */
export const CRISIS_FROM = 0.25;

/**
 * The severity at which each type of airline stops growing: no new and no
 * replacement aircraft. Aircraft it already owns still go on routes, since a
 * rival that starts its game inside a crisis has to fly something. Careful
 * carriers stop at the first real crisis, low-cost carriers at a serious one,
 * expansionists only in a severe one -- they see a crisis as the time to buy.
 */
export const GROWTH_FREEZE_AT: Record<RivalPersonality, number> = {
  optimizer: 0.25,
  flag: 0.25,
  boutique: 0.25,
  lcc: 0.35,
  expansionist: 0.5
};

export function growthFrozen(personality: RivalPersonality, severity: number): boolean {
  return severity >= (GROWTH_FREEZE_AT[personality] ?? CRISIS_FROM);
}

/** The load factor a rival cuts flights down to in a crisis. */
export const TARGET_LOAD = 0.8;

/** Above this load, demand has caught up and flights are added back. */
const FULL_LOAD = 0.95;

/** Share of the normal schedule added back per month. */
const RECOVERY_STEP = 0.25;

/**
 * Weekly departures a route should fly next month.
 *
 * In a crisis a route that sells less than {@link TARGET_LOAD} of its seats is
 * cut in proportion (10 flights at 40 % load become 5, which sells 80 %); one
 * that is full again is given flights back. Outside a crisis the schedule
 * simply climbs back towards `full` by a quarter per month. `full` is what the
 * route flew before the first cut, and is never exceeded.
 */
export function crisisDepartures(input: {
  current: number;
  full: number;
  /** Absent when the route did not fly last month; the schedule is then left alone. */
  loadFactor: number | undefined;
  inCrisis: boolean;
}): number {
  const { current, full, loadFactor, inCrisis } = input;
  const step = Math.max(1, Math.ceil(full * RECOVERY_STEP));
  if (!inCrisis) return Math.min(full, current + step);
  if (loadFactor === undefined) return current;
  if (loadFactor < TARGET_LOAD) {
    return Math.min(current, Math.max(1, Math.round((current * loadFactor) / TARGET_LOAD)));
  }
  if (loadFactor >= FULL_LOAD) return Math.min(full, current + step);
  return current;
}
