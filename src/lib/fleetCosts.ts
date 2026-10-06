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

/**
 * What one aircraft costs for one month. `maintenanceFactor` is what the
 * fleet's make-up does to the maintenance programme, see fleetCommonality.
 */
export function monthlyOwnershipCost(
  plane: { basePrice?: number; purchasedAt?: number },
  offset: number,
  flying: boolean,
  maintenanceFactor: number = 1
): number {
  const price = plane.basePrice || 10_000_000;
  const yearly = price * (INSURANCE_RATE + maintenanceRate(ageYears(plane, offset)) * maintenanceFactor);
  return Math.round((yearly / 12) * (flying ? 1 : PARKED_SHARE));
}

// --- Commonality ---------------------------------------------------------------

/**
 * One family of aircraft shares crews, spare parts and mechanics; every
 * family beyond a few needs its own. The more aircraft of a family the fleet
 * has, the cheaper each one's maintenance programme; the more families, the
 * dearer all of them. A fleet of ten Boeing 737s is cheaper to keep than ten
 * aircraft of ten kinds.
 */
export const COMMONALITY_DISCOUNTS: ReadonlyArray<{ from: number; discount: number }> = [
  { from: 25, discount: 0.15 },
  { from: 12, discount: 0.12 },
  { from: 6, discount: 0.08 },
  { from: 3, discount: 0.04 }
];
/** Families a fleet can run without penalty, and the penalty for each one more, to a ceiling. */
export const FREE_FAMILIES = 3;
export const VARIETY_PENALTY_PER_FAMILY = 0.03;
export const VARIETY_PENALTY_MAX = 0.3;

/** The maintenance discount for an aircraft whose family has `count` aircraft in the fleet. */
export function familyDiscount(count: number): number {
  return COMMONALITY_DISCOUNTS.find(d => count >= d.from)?.discount ?? 0;
}

/** The surcharge on every aircraft's maintenance for running this many families. */
export function varietyPenalty(families: number): number {
  return Math.min(VARIETY_PENALTY_MAX, Math.max(0, families - FREE_FAMILIES) * VARIETY_PENALTY_PER_FAMILY);
}

export interface Commonality {
  /** Families in the fleet, the biggest first. */
  families: { family: string; count: number; discount: number }[];
  penalty: number;
  /** The factor on one aircraft's maintenance by registration. */
  factorByRegistration: Map<string, number>;
  /** The mean factor over the fleet; 1 when it is empty. */
  meanFactor: number;
}

/** What the make-up of the fleet does to its maintenance. */
export function fleetCommonality(
  fleet: ReadonlyArray<{ registration: string; family?: string; type?: string }>
): Commonality {
  const familyOf = (p: { family?: string; type?: string }) => p.family || p.type || 'unknown';
  const counts = new Map<string, number>();
  for (const p of fleet) counts.set(familyOf(p), (counts.get(familyOf(p)) ?? 0) + 1);
  const penalty = varietyPenalty(counts.size);
  const factorByRegistration = new Map<string, number>();
  let sum = 0;
  for (const p of fleet) {
    const factor = 1 + penalty - familyDiscount(counts.get(familyOf(p)) ?? 0);
    factorByRegistration.set(p.registration, factor);
    sum += factor;
  }
  return {
    families: [...counts.entries()]
      .map(([family, count]) => ({ family, count, discount: familyDiscount(count) }))
      .sort((a, b) => b.count - a.count),
    penalty,
    factorByRegistration,
    meanFactor: fleet.length > 0 ? sum / fleet.length : 1
  };
}

/** The fleet's bill for a month and the share of it that went on aircraft with no route. */
export function fleetOwnershipCost(
  fleet: ReadonlyArray<{ registration: string; basePrice?: number; purchasedAt?: number; family?: string; type?: string }>,
  flyingRegistrations: ReadonlySet<string>,
  offset: number
): { total: number; parked: number; parkedCount: number } {
  let total = 0;
  let parked = 0;
  let parkedCount = 0;
  const commonality = fleetCommonality(fleet);
  for (const plane of fleet) {
    const flying = flyingRegistrations.has(plane.registration);
    const cost = monthlyOwnershipCost(plane, offset, flying, commonality.factorByRegistration.get(plane.registration) ?? 1);
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
