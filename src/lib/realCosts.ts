/**
 * Wages and airport charges grow faster than fares.
 *
 * The game prices everything in roughly constant dollars: an aircraft of 1990
 * is listed at what it would fetch in 1990 money relative to one of 1960, and
 * fares are fixed. Adding a nominal price index on top would double count it.
 * What a real airline did feel, and what pressed it to renew its fleet and cut
 * its costs, was labour and airport charges rising in real terms while fares
 * were held down by competition. That is what this index is: 1.2% a year above
 * the fares, so crews and ground staff, landing fees, passenger handling and
 * check-in cost twice as much in 2020 as in 1960.
 *
 * Fuel is not in it: it follows its own historical price list.
 *
 * Everything here is pure.
 */

/** Yearly real growth of wages and airport charges. */
export const REAL_COST_GROWTH = 0.012;

const FIRST_YEAR = 1960;
const LAST_YEAR = 2100;

/** The multiplier on wages and airport charges in a calendar year; 1 in 1960. */
export function realCostIndex(year: number): number {
  const y = Number.isFinite(year) ? Math.max(FIRST_YEAR, Math.min(LAST_YEAR, year)) : FIRST_YEAR;
  return Math.pow(1 + REAL_COST_GROWTH, y - FIRST_YEAR);
}
