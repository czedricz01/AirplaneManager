/**
 * Which airports an airline may use, by rank.
 *
 * Airports come in seven levels, from a grass strip (1) to the great hubs (6
 * and 7: Atlanta, Heathrow, Frankfurt, Dubai, Hong Kong, ...). A young airline
 * cannot get slots at the biggest ones: each rank opens the next level (see
 * RankDef.maxAirportLevel), and the great hubs open at National.
 *
 * What the airline already has stays open: its home airport, every airport it
 * has built management at and every airport one of its routes touches, so a
 * rank can never take something away. A game in Free Mode has the top rank and
 * so every airport.
 *
 * The rule itself is the model's (`isAirportOpen`, `src/model/progress.ts`); this file only collects the
 * airline's standings from the save and words the refusal. Everything here is pure.
 */
import { isAirportOpen, type AirportStanding } from '../model/progress';
import { RANKS, clampRank, rankDef } from './airlineRank';

/** The largest airport level the rank may use. */
export function maxAirportLevel(rank: number): number {
  return rankDef(rank).maxAirportLevel;
}

/** The lowest rank that may use airports of this level. */
export function rankForLevel(level: number): number {
  const wanted = Math.max(1, Math.min(7, Math.round(Number.isFinite(level) ? level : 1)));
  const found = RANKS.find(r => r.maxAirportLevel >= wanted);
  return found ? found.index : RANKS.length - 1;
}

/**
 * How the airline stands at each airport it already has something at: home, management tier, route end.
 * These are the exceptions of the model's access rule (`isAirportOpen`, SPEZIFIKATION 6.7); airports
 * not in the map have none.
 */
export function airportStandings(
  homeHub: string | null | undefined,
  management: Record<string, { level?: number } | undefined> | null | undefined,
  routes: ReadonlyArray<{ origin: string; destination: string }> | null | undefined
): Map<string, AirportStanding> {
  const out = new Map<string, { isHome?: boolean; managementTier?: number; isRouteEnd?: boolean }>();
  const at = (id: string) => {
    let st = out.get(id);
    if (!st) out.set(id, (st = {}));
    return st;
  };
  if (homeHub) at(homeHub).isHome = true;
  for (const [id, infra] of Object.entries(management || {})) {
    const tier = infra?.level ?? 0;
    if (tier >= 1) at(id).managementTier = tier;
  }
  for (const r of routes || []) {
    at(r.origin).isRouteEnd = true;
    at(r.destination).isRouteEnd = true;
  }
  return out;
}

/** Why an airport cannot be used at this rank, or null when it can. */
export function airportGate(
  airport: { id: string; name?: string; level?: number } | null | undefined,
  rank: number,
  standings: ReadonlyMap<string, AirportStanding>
): string | null {
  if (!airport) return null;
  const level = Number(airport.level) || 1;
  if (isAirportOpen(rank, level, standings.get(airport.id))) return null;
  const needed = rankForLevel(level);
  return `${airport.name || airport.id} is a level ${level} airport. Airports of that size open at the rank ` +
    `${rankDef(needed).title}; your airline is ${rankDef(clampRank(rank)).title}.`;
}
