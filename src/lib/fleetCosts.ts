/**
 * What owning an aircraft costs while it is not earning, and how age tells.
 *
 * Until now a parked aircraft cost nothing and an old one cost no more than a
 * new one: the only reason to sell a plane was needing the cash. Now every
 * aircraft in the fleet is insured and kept airworthy each month, flying or
 * not, and the older it gets the more the upkeep takes. Age also takes
 * from its resale value and from the passengers' liking for the type.
 *
 * Everything here is pure.
 */

/** Insurance, as a share of the list price per year. */
export const INSURANCE_RATE = 0.006;
/** Maintenance programme per year at age 0 and from age MAINTENANCE_FULL_AGE on, as shares of the list price. */
export const MAINTENANCE_RATE_NEW = 0.03;
export const MAINTENANCE_RATE_OLD = 0.08;
export const MAINTENANCE_FULL_AGE = 25;
/** A parked aircraft costs this share of that: storage, insurance on the ground, preservation. */
export const PARKED_SHARE = 0.5;

/** Resale value lost per year of age, down to RESALE_AGE_FLOOR. */
export const RESALE_AGE_LOSS_PER_YEAR = 0.02;
export const RESALE_AGE_FLOOR = 0.4;

/** Years from which passengers like a type less, and the most that costs it (type SAT points). */
export const POPULARITY_DECAY_FROM = 8;
export const POPULARITY_DECAY_MAX = 15;

/** Years since the aircraft was bought; aircraft without a purchase date count as new. */
export function ageYears(plane: { purchasedAt?: number } | null | undefined, offset: number): number {
  const at = plane?.purchasedAt;
  if (typeof at !== 'number' || !Number.isFinite(at)) return 0;
  return Math.max(0, (offset - at) / 12);
}

/** Maintenance programme per year as a share of the list price: dearer with age. */
export function maintenanceRate(age: number): number {
  const t = Math.max(0, Math.min(1, age / MAINTENANCE_FULL_AGE));
  return MAINTENANCE_RATE_NEW + (MAINTENANCE_RATE_OLD - MAINTENANCE_RATE_NEW) * t;
}

/** What one aircraft costs for one month. */
export function monthlyOwnershipCost(
  plane: { basePrice?: number; purchasedAt?: number },
  offset: number,
  flying: boolean
): number {
  const price = plane.basePrice || 10_000_000;
  const yearly = price * (INSURANCE_RATE + maintenanceRate(ageYears(plane, offset)));
  return Math.round((yearly / 12) * (flying ? 1 : PARKED_SHARE));
}

/** The fleet's bill for a month and the share of it that went on aircraft with no route. */
export function fleetOwnershipCost(
  fleet: ReadonlyArray<{ registration: string; basePrice?: number; purchasedAt?: number }>,
  flyingRegistrations: ReadonlySet<string>,
  offset: number
): { total: number; parked: number; parkedCount: number } {
  let total = 0;
  let parked = 0;
  let parkedCount = 0;
  for (const plane of fleet) {
    const flying = flyingRegistrations.has(plane.registration);
    const cost = monthlyOwnershipCost(plane, offset, flying);
    total += cost;
    if (!flying) {
      parked += cost;
      parkedCount++;
    }
  }
  return { total, parked, parkedCount };
}

/** The factor age puts on resale value, 0.4-1. */
export function resaleAgeFactor(age: number): number {
  return Math.max(RESALE_AGE_FLOOR, 1 - RESALE_AGE_LOSS_PER_YEAR * Math.max(0, age));
}

/** Points a type loses in the passengers' eyes at this age. */
export function popularityDecay(age: number): number {
  return Math.max(0, Math.min(POPULARITY_DECAY_MAX, age - POPULARITY_DECAY_FROM));
}

/** The type's popularity for an aircraft of this age, never below 1. */
export function agedPopularity(catalogPopularity: number, age: number): number {
  return Math.max(1, catalogPopularity - popularityDecay(age));
}
