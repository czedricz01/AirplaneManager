import { airportsData } from './airports';
import { Airport, STATS_BASE_YEAR } from './airportTypes';
import { moreAirports } from './more_airports';

/**
 * The single airport list.
 *
 * Four modules used to build this independently, and they did not agree. App
 * kept the core entry when an id appeared in both files; AirportsView,
 * RouteDetailView and RoutePricingEditView let `moreAirports` overwrite it. Eight
 * ids are in both (SKG HER RHO AYT ADB ESB BJV DLM), so those airports had a
 * different level, ICAO code and demand depending on which screen you were
 * looking at. Only App applied the era adjustment below, so the airports table
 * showed unadjusted demand while the planner and the map used adjusted values.
 *
 * Everything now comes from here.
 */

const byId = new Map<string, Airport>();
for (const a of airportsData) byId.set(a.id, a as Airport);
for (const a of moreAirports) {
  // Core data wins on a duplicate id. This was App's behaviour and it is the
  // one that keeps the richer per-year statistics.
  if (!byId.has(a.id)) byId.set(a.id, a as unknown as Airport);
}

/** Merged, before the era adjustment. */
export const rawAirports: Airport[] = Array.from(byId.values());

const sovietAirports = new Set([
  'SVO', 'DME', 'VKO', 'LED', 'OVB', 'KBP', 'MSQ', 'TAS', 'ALA', 'EVN',
  'GYD', 'TBS', 'KIV', 'PRG', 'WAW', 'BUD', 'SOF', 'OTP', 'SXF'
]);
const westernAirports = new Set([
  'JFK', 'EWR', 'LGA', 'ORD', 'LAX', 'SFO', 'ATL', 'DFW', 'MIA', 'IAD',
  'DCA', 'LHR', 'LGW', 'CDG', 'ORY', 'FRA', 'MUC', 'AMS', 'MAD', 'BCN',
  'FCO', 'MXP', 'ZRH'
]);

/**
 * Airports with the era adjustment applied: Soviet-bloc traffic damped before
 * 1990 and through the transition, major Western hubs lifted before 1975.
 */
export const airports: Airport[] = rawAirports.map(a => {
  const isSoviet = sovietAirports.has(a.id);
  const isWesternMajor = westernAirports.has(a.id);

  if ((!isSoviet && !isWesternMajor) || !a.stats) return a;

  // The stats array is tourism and business interleaved from STATS_BASE_YEAR,
  // so the year for index i is STATS_BASE_YEAR + (i >> 1).
  const src = a.stats;
  const out = src.slice();
  for (let i = 0; i < src.length; i += 2) {
    const year = STATS_BASE_YEAR + i / 2;
    let multiplier = 1.0;

    if (isSoviet) {
      if (year < 1990) multiplier = 0.45;        // Soviet era
      else if (year < 2000) multiplier = 0.55;   // post-Soviet collapse
      else multiplier = 0.65;                    // modern Russian aviation
    } else if (isWesternMajor) {
      if (year < 1975) multiplier = 1.15;        // early Western hubs
    }

    if (multiplier !== 1.0) {
      out[i] = Math.max(1, Math.round(src[i] * multiplier));
      out[i + 1] = Math.max(1, Math.round(src[i + 1] * multiplier));
    }
  }
  return { ...a, stats: out };
});

/** Lookup over the adjusted list. This is what every screen should use. */
export const airportsMapAdjusted = new Map<string, Airport>();
for (const a of airports) airportsMapAdjusted.set(a.id, a);

export const getAirport = (id: string): Airport | undefined => airportsMapAdjusted.get(id);
