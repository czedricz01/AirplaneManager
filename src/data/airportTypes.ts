/**
 * Airport shape and the compact row encoding the generated data files use.
 *
 * The per-year demand table used to be a `{ [year]: { tourism, business } }`
 * object per airport: 33,000 object literals across the two data files, 2.07 MB
 * of source and roughly 74,000 allocations at load, all to serve a lookup that
 * reads exactly one year at a time.
 *
 * It is now one flat array per airport with tourism and business interleaved,
 * starting at STATS_BASE_YEAR. Same numbers, no interpolation, no loss -- just
 * an encoding that does not build an object per year.
 */

export const STATS_BASE_YEAR = 1960;

export type IcaoCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/** [id, name, lat, lon, level, maxIcaoCode, interleaved stats or null] */
export type AirportRow = [string, string, number, number, number, string, number[] | null];

export interface Airport {
  id: string;
  name: string;
  coords: [number, number];
  level: number;
  maxIcaoCode: IcaoCode;
  /**
   * Tourism and business demand interleaved, one pair per year from
   * STATS_BASE_YEAR onwards: [t1960, b1960, t1961, b1961, ...].
   */
  stats?: number[] | null;
}

export interface AirportDemandStats {
  tourism: number;
  business: number;
}

export const EMPTY_STATS: AirportDemandStats = { tourism: 0, business: 0 };

export function rowToAirport(r: AirportRow): Airport {
  return {
    id: r[0],
    name: r[1],
    coords: [r[2], r[3]],
    level: r[4],
    maxIcaoCode: r[5] as IcaoCode,
    stats: r[6]
  };
}

/** Last year the table actually covers, or -1 when there is no table. */
export const lastStatsYear = (stats: number[] | null | undefined): number =>
  stats && stats.length >= 2 ? STATS_BASE_YEAR + stats.length / 2 - 1 : -1;

/**
 * Compound annual growth over the final decade of real data, clamped so one
 * noisy airport cannot produce runaway numbers far into the future.
 *
 * Cached by array identity, because the adjusted copies the registry builds are
 * distinct arrays with their own growth.
 */
const growthCache = new WeakMap<number[], number>();

export function statsGrowth(stats: number[]): number {
  const cached = growthCache.get(stats);
  if (cached !== undefined) return cached;

  let growth = 1;
  const years = stats.length / 2;
  if (years > 1) {
    const window = Math.min(10, years - 1);
    const firstIdx = (years - 1 - window) * 2;
    const lastIdx = (years - 1) * 2;
    const firstTotal = stats[firstIdx] + stats[firstIdx + 1];
    const lastTotal = stats[lastIdx] + stats[lastIdx + 1];
    if (firstTotal > 0 && lastTotal > 0) {
      growth = Math.pow(lastTotal / firstTotal, 1 / window);
    }
    growth = Math.min(1.04, Math.max(1, growth));
  }

  growthCache.set(stats, growth);
  return growth;
}
