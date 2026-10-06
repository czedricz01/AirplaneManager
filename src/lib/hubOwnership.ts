/**
 * Management tier 3, "Corporate Ownership": what owning an airport outright
 * brings beyond the hub operations of tier 2.
 *
 *   - Cheaper to run: landing fees and desk costs 15% below the standard rate
 *     (a tier-2 hub gets 5%).
 *   - A better place to change planes: hub quality +0.05.
 *   - Rival airlines may not open new routes into it: the airline owns the slots.
 *   - It collects half of the landing fees the rivals pay when they land there.
 *
 * Tier 3 used to cost airport level x $500M and do nothing of the above beyond
 * the same connection bonus every tier gave; it is now level x $25M.
 *
 * Everything here is pure.
 */

export const TIER3 = 3;

/** Multiplier on landing fees and desk costs at an airport of this tier. */
export function hubFeeFactor(tier: number | undefined): number {
  if ((tier ?? 0) >= TIER3) return 0.85;
  if ((tier ?? 0) >= 2) return 0.95;
  return 1;
}

/** The extra hub quality tier 3 gives, on top of the 0.15 each tier gives. */
export const TIER3_HUB_QUALITY_BONUS = 0.05;

/** The share of a rival's landing fee the owner of the airport collects. */
export const OWNER_FEE_SHARE = 0.5;

/** A rival's landing fee at an airport of this level, by the middle class of aircraft. */
export function rivalLandingFee(airportLevel: number): number {
  return Math.round((2500 + 100 * Math.max(0, airportLevel)) * 1.1);
}

export interface RivalRouteLike {
  origin: string;
  destination: string;
  /** Departures a week, each way. */
  departures: number;
}

/** Landings per week rival airlines make at an airport. */
export function rivalLandingsPerWeek(airportId: string, rivals: ReadonlyArray<{ routes: ReadonlyArray<RivalRouteLike> }>): number {
  let landings = 0;
  for (const ai of rivals) {
    for (const r of ai.routes) {
      if (r.origin === airportId || r.destination === airportId) landings += Math.max(0, r.departures || 0);
    }
  }
  return landings;
}

/**
 * What the player collects in a month from the rivals landing at the
 * airports it owns at tier 3, four weeks, and the airports that paid.
 */
export function ownerIncome(
  management: Record<string, { level?: number } | undefined>,
  airportLevel: (id: string) => number,
  rivals: ReadonlyArray<{ routes: ReadonlyArray<RivalRouteLike> }>
): { total: number; items: { airportId: string; amount: number; landings: number }[] } {
  const items: { airportId: string; amount: number; landings: number }[] = [];
  for (const [id, infra] of Object.entries(management)) {
    if ((infra?.level ?? 0) < TIER3) continue;
    const landings = rivalLandingsPerWeek(id, rivals);
    if (landings <= 0) continue;
    const amount = Math.round(landings * 4 * rivalLandingFee(airportLevel(id)) * OWNER_FEE_SHARE);
    items.push({ airportId: id, amount, landings });
  }
  return { total: items.reduce((s, i) => s + i.amount, 0), items };
}

/** Whether a rival may open a new route into this airport: not a tier-3 airport of the player. */
export function rivalMayEnter(airportId: string, management: Record<string, { level?: number } | undefined>): boolean {
  return (management[airportId]?.level ?? 0) < TIER3;
}
