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
 * Everything here is pure.
 */
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

/** Airports the airline may use whatever their level: home, built-up, flown to. */
export function exemptAirports(
  homeHub: string | null | undefined,
  management: Record<string, { level?: number } | undefined> | null | undefined,
  routes: ReadonlyArray<{ origin: string; destination: string }> | null | undefined
): Set<string> {
  const out = new Set<string>();
  if (homeHub) out.add(homeHub);
  for (const [id, infra] of Object.entries(management || {})) if ((infra?.level ?? 0) >= 1) out.add(id);
  for (const r of routes || []) {
    out.add(r.origin);
    out.add(r.destination);
  }
  return out;
}

/** Why an airport cannot be used at this rank, or null when it can. */
export function airportGate(
  airport: { id: string; name?: string; level?: number } | null | undefined,
  rank: number,
  exempt: ReadonlySet<string>
): string | null {
  if (!airport) return null;
  const level = Number(airport.level) || 1;
  if (exempt.has(airport.id) || level <= maxAirportLevel(rank)) return null;
  const needed = rankForLevel(level);
  return `${airport.name || airport.id} is a level ${level} airport. Airports of that size open at the rank ` +
    `${rankDef(needed).title}; your airline is ${rankDef(clampRank(rank)).title}.`;
}

/** How many of the airports are closed at this rank, and the rank that opens the nearest of them. */
export function lockedSummary(
  airports: ReadonlyArray<{ id: string; level?: number }>,
  rank: number,
  exempt: ReadonlySet<string>
): { count: number; opensAt: number | null } {
  let count = 0;
  let lowest = Infinity;
  for (const a of airports) {
    const level = Number(a.level) || 1;
    if (exempt.has(a.id) || level <= maxAirportLevel(rank)) continue;
    count++;
    lowest = Math.min(lowest, rankForLevel(level));
  }
  return { count, opensAt: count > 0 ? lowest : null };
}
