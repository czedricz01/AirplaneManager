/**
 * The used-aircraft market.
 *
 * The shop only sold what is in production, so the aircraft of a past
 * generation vanished from the game and every purchase was new. The used
 * market lists a handful of second-hand aircraft each month: types at least
 * five years in service, their age, wear and price all different. A used
 * aircraft costs less than a new one of the same type but is worn, sells for
 * little, and eats more upkeep as it ages (see fleetCosts.ts); and types that
 * left production years ago can be had here and nowhere else.
 *
 * The month's list is drawn from a generator seeded with the month, so it is
 * the same on every visit and after a reload; what has been bought from it is
 * remembered by the caller.
 *
 * Everything here is pure.
 */
import type { Aircraft } from '../data/aircraft';
import { getAircraftResaleValue } from './financeUtils';

/** Listings a month. */
export const LISTINGS_PER_MONTH = 6;
/** A type must have been in service this many months to appear second-hand. */
export const MIN_SERVICE_MONTHS = 60;
/** Second-hand aircraft change hands a little under book value: the buyer carries the risk. */
export const DEALER_MARGIN = 0.95;
/** Youngest and oldest airframe offered, in years. */
export const MIN_LISTING_AGE = 4;
export const MAX_LISTING_AGE = 24;

export interface UsedListing {
  /** Stable for the month and the slot: `${offset}:${n}`. */
  id: string;
  aircraftId: string;
  ageMonths: number;
  conditionGeneral: number;
  conditionInterior: number;
  price: number;
  /** Who is selling, for the flavour of the listing. */
  seller: string;
}

/** A small deterministic generator (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SELLERS = ['a leasing company', 'a regional carrier winding down', 'a flag carrier renewing its fleet', 'a bank repossession', 'a charter operator', 'a retiring fleet manager'];

/**
 * The listings of the month at `offset`, from the aircraft that exist by then.
 * `rivalNames` makes some of them "ex-" a named rival, for flavour only.
 */
export function usedListings(list: readonly Aircraft[], offset: number, rivalNames: readonly string[] = []): UsedListing[] {
  const eligible = list.filter(a => a.firstDeliveryOffset <= offset - MIN_SERVICE_MONTHS && a.basePrice > 0);
  if (eligible.length === 0) return [];
  const rand = seededRandom(offset * 7919 + 12345);
  const out: UsedListing[] = [];
  for (let n = 0; n < LISTINGS_PER_MONTH; n++) {
    const spec = eligible[Math.floor(rand() * eligible.length)];
    // No older than the type itself.
    const maxAge = Math.min(MAX_LISTING_AGE * 12, offset - spec.firstDeliveryOffset);
    const minAge = Math.min(MIN_LISTING_AGE * 12, maxAge);
    const ageMonths = Math.round(minAge + rand() * (maxAge - minAge));
    const years = ageMonths / 12;
    const wear = (base: number, perYear: number, noise: number) =>
      Math.round(Math.max(20, Math.min(95, base - years * perYear + (rand() - 0.5) * noise)));
    const conditionGeneral = wear(98, 2.2, 14);
    const conditionInterior = wear(92, 2.8, 22);
    const price = Math.round(getAircraftResaleValue({ basePrice: spec.basePrice, conditionGeneral, conditionInterior, ageYears: years }) * DEALER_MARGIN / 10_000) * 10_000;
    const seller = rivalNames.length > 0 && rand() < 0.4
      ? `ex-${rivalNames[Math.floor(rand() * rivalNames.length)]}`
      : SELLERS[Math.floor(rand() * SELLERS.length)];
    out.push({ id: `${offset}:${n}`, aircraftId: spec.id, ageMonths, conditionGeneral, conditionInterior, price: Math.max(250_000, price), seller });
  }
  return out;
}
