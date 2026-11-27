import { airportsData } from './airports';
import { Airport } from './airportTypes';
import { moreAirports } from './more_airports';

/**
 * The single airport list.
 *
 * Four modules used to build this independently, and they did not agree. App
 * kept the core entry when an id appeared in both files; AirportsView,
 * RouteDetailView and RoutePricingEditView let `moreAirports` overwrite it. Eight
 * ids are in both (SKG HER RHO AYT ADB ESB BJV DLM), so those airports had a
 * different level, ICAO code and demand depending on which screen you were
 * looking at.
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

/** Merged core and secondary airports. */
export const rawAirports: Airport[] = Array.from(byId.values());

/**
 * The list every screen uses. It used to apply an era adjustment here (Soviet-bloc traffic × 0.45–0.65,
 * major Western hubs × 1.15 before 1975) to correct invented demand tables. The tables now come from real
 * passenger statistics (scripts/airport-traffic), which already contain those effects, so the list is the
 * merged data unchanged. The name `airportsMapAdjusted` stays for the callers.
 */
export const airports: Airport[] = rawAirports;

/** Lookup over the adjusted list. This is what every screen should use. */
export const airportsMapAdjusted = new Map<string, Airport>();
for (const a of airports) airportsMapAdjusted.set(a.id, a);

/** Every airport sorted by name, for pickers and lists. */
export const airportsByName: Airport[] = [...airports].sort((a, b) => a.name.localeCompare(b.name));
