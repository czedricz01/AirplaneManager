/**
 * How long a route has been flown, and what that does to its demand.
 *
 * A new route does not fill at once: nobody knows the airline flies it yet.
 * Demand starts at 60% and grows to its full size over nine months. A route
 * flown for years earns loyalty instead: up to 5% more than a fresh one,
 * reached after four years. Closing a route and reopening it starts again,
 * which makes dropping one a decision and not a free experiment.
 *
 * Only the player's routes use this; routes saved before it existed have no
 * opening date and count as mature, so loading an old game changes nothing.
 *
 * Everything here is pure.
 */

/** Share of full demand in the first month. */
export const RAMP_START = 0.6;
/** Months until a route has reached its full demand. */
export const RAMP_MONTHS = 9;
/** Months after which loyalty starts to build, and when it has reached its largest. */
export const LOYALTY_START_MONTHS = 24;
export const LOYALTY_FULL_MONTHS = 48;
/** The most loyalty adds. */
export const LOYALTY_MAX = 0.05;

/** The demand multiplier for a route that has been open `monthsOpen` months. */
export function routeMaturityFactor(monthsOpen: number): number {
  if (!Number.isFinite(monthsOpen)) return 1;
  const m = Math.max(0, monthsOpen);
  if (m < RAMP_MONTHS) return RAMP_START + (1 - RAMP_START) * (m / RAMP_MONTHS);
  if (m < LOYALTY_START_MONTHS) return 1;
  if (m < LOYALTY_FULL_MONTHS) {
    return 1 + LOYALTY_MAX * ((m - LOYALTY_START_MONTHS) / (LOYALTY_FULL_MONTHS - LOYALTY_START_MONTHS));
  }
  return 1 + LOYALTY_MAX;
}

/** Months a route has been open at `offset`; null when it carries no opening date. */
export function monthsOpen(route: { openedOffset?: number } | null | undefined, offset: number): number | null {
  const opened = route?.openedOffset;
  return typeof opened === 'number' && Number.isFinite(opened) ? Math.max(0, offset - opened) : null;
}

/**
 * The maturity factor of every route that has an opening date and is not at
 * exactly 1, keyed by route id. Routes without a date are left out, which the
 * economy reads as mature.
 */
export function maturityFactors(
  routes: ReadonlyArray<{ id: string; openedOffset?: number }>,
  offset: number
): Record<string, number> | undefined {
  const out: Record<string, number> = {};
  for (const r of routes) {
    const months = monthsOpen(r, offset);
    if (months === null) continue;
    const f = routeMaturityFactor(months);
    if (f !== 1) out[r.id] = f;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** A short line for the route screens: "Ramping up: 74% of full demand", or null when mature. */
export function maturityNote(factor: number | undefined): string | null {
  if (factor === undefined || Math.abs(factor - 1) < 0.0005) return null;
  if (factor < 1) return `Ramping up: ${Math.round(factor * 100)}% of full demand`;
  return `Loyal customers: +${Math.round((factor - 1) * 100)}% demand`;
}
