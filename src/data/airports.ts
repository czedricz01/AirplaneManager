import { airportRows } from './airportsRows';
import {
  Airport,
  AirportDemandStats,
  EMPTY_STATS,
  STATS_BASE_YEAR,
  lastStatsYear,
  rowToAirport,
  statsGrowth
} from './airportTypes';

export type { Airport, AirportDemandStats };
export { STATS_BASE_YEAR };

/**
 * The core airport list.
 *
 * The rows come from a generated file in a compact encoding; see airportTypes.ts
 * for why. Building the 500 airport objects here is cheap because the per-year
 * demand table is one flat array per airport rather than 66 objects.
 */
export const airportsData: Airport[] = airportRows.map(rowToAirport);

/**
 * Reads an airport's demand statistics for a given year.
 *
 * The bundled tables stop at a fixed year while the simulation runs far past it.
 * Reading the table directly yielded nothing beyond that point, which silently
 * collapsed demand -- and therefore all ticket revenue -- to zero. Years below
 * the table are clamped to the first entry, years above it are extrapolated from
 * the airport's own historical growth rate.
 */
export function getAirportStats(
  airport: Airport | undefined | null,
  year: number
): AirportDemandStats {
  const stats = airport?.stats;
  if (!stats || stats.length < 2) return EMPTY_STATS;

  const max = lastStatsYear(stats);

  if (year <= STATS_BASE_YEAR) {
    return { tourism: stats[0], business: stats[1] };
  }

  if (year <= max) {
    const i = (year - STATS_BASE_YEAR) * 2;
    return { tourism: stats[i], business: stats[i + 1] };
  }

  // Cap the extrapolation horizon so very distant years stay in a sane range.
  const yearsAhead = Math.min(year - max, 50);
  const factor = Math.pow(statsGrowth(stats), yearsAhead);
  const last = (max - STATS_BASE_YEAR) * 2;
  return {
    tourism: Math.round(stats[last] * factor),
    business: Math.round(stats[last + 1] * factor)
  };
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
