/**
 * The airline's rank on the screen (docs/neubau 6.7).
 *
 * The ten ranks, their conditions, hubs, airport sizes, research slots and the tools they open are the model's
 * tables (`RANKS`, `RANK_UNLOCKS` in `src/model/constants.ts`); the rank itself is decided in the month close
 * (`nextRank`, 3-month means, never lost). This file adds what only the screen needs: a rank from anything
 * saved, the list of what a rank opens (generated from the tables, E52) and the texts of a refusal.
 *
 * In Free Mode the airline is a Global Player from the start and nothing is gated by the rank.
 */
import { CLASS_RESEARCH, MAX_RANK, RANK_UNLOCKS, RANKS, RESEARCH_PROJECTS, type RankDef, type RankUnlock } from '../model/constants';
import { hubAllowance as modelHubAllowance, rankDef as modelRankDef, type GameMode } from '../model/progress';
import { classDef } from './aircraftClasses';

export { MAX_RANK, RANKS, type RankDef };
export type { GameMode };

/** The rank of Free Mode: the top of the ladder, with nothing left to earn. */
export const FREE_MODE_RANK = MAX_RANK;

/** Anything saved or typed, as a valid mode; Normal Mode when it is not one. */
export function normalizeMode(raw: unknown): GameMode {
  return raw === 'free' ? 'free' : 'normal';
}

/** Clamps anything to a valid rank index. */
export function clampRank(rank: unknown): number {
  const n = typeof rank === 'number' && Number.isFinite(rank) ? Math.round(rank) : 0;
  return Math.max(0, Math.min(MAX_RANK, n));
}

/** The rank a game has: the top one in Free Mode, otherwise the one earned. */
export function effectiveRank(mode: GameMode, rank: number): number {
  return mode === 'free' ? FREE_MODE_RANK : clampRank(rank);
}

/** The model's row of a rank, for any number (clamped). */
export function rankDef(rank: number): RankDef {
  return modelRankDef(clampRank(rank));
}

const UNLOCK_TEXT: Readonly<Record<RankUnlock, string>> = {
  localCampaign: 'Local marketing campaigns',
  frequentFlyer: 'The frequent-flyer programme',
  nationalCampaign: 'National marketing campaigns',
  vipLounge: 'The VIP lounge',
  globalCampaign: 'Global marketing campaigns',
  takeoverDistressed: 'Takeovers of rivals in distress',
  managementTier3: 'Management tier 3 at a hub',
  takeoverHealthy: 'Takeover bids for healthy rivals',
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * What a rank opens, in plain words, generated from the model's tables (E52): airport size, hubs and research
 * slots where they grow, the tools of `RANK_UNLOCKS`, the aircraft classes whose project appears, and the
 * number of new bonus projects.
 */
export function rankUnlockLines(rank: number): string[] {
  const def = rankDef(rank);
  const prev = rank > 0 ? rankDef(rank - 1) : null;
  const lines: string[] = [];
  if (!prev) lines.push(`Airports up to level ${def.maxAirportLevel}`);
  else if (def.maxAirportLevel > prev.maxAirportLevel) lines.push(`Airports of level ${def.maxAirportLevel}`);
  if (!prev || def.maxHubs > prev.maxHubs) lines.push(`Up to ${plural(def.maxHubs, 'hub')}`);
  if (!prev || def.researchSlots > prev.researchSlots) lines.push(`${plural(def.researchSlots, 'development project')} at a time`);
  for (const [unlock, needed] of Object.entries(RANK_UNLOCKS) as [RankUnlock, number][]) {
    if (needed === def.index) lines.push(UNLOCK_TEXT[unlock]);
  }
  for (const [sizeClass, project] of Object.entries(CLASS_RESEARCH)) {
    if (project.rank === def.index) lines.push(`${classDef(sizeClass as keyof typeof CLASS_RESEARCH).title} (development)`);
  }
  const bonus = RESEARCH_PROJECTS.filter((p) => p.kind === 'bonus' && p.rank === def.index).length;
  if (bonus > 0) lines.push(`${plural(bonus, 'new bonus project')}`);
  return lines;
}

/** The text of a refusal, or null when the rank is enough. */
export function rankGateMessage(rank: number, needed: number, what: string): string | null {
  if (clampRank(rank) >= needed) return null;
  return `${what} needs the rank ${rankDef(needed).title}; your airline is ${rankDef(rank).title}.`;
}

/** Hubs allowed: the rank's allowance plus the milestones' (`hubAllowance`, 6.7); without limit in Free Mode. */
export function hubAllowance(rank: number, extraHubs: number, free = false): number {
  return modelHubAllowance(clampRank(rank), Math.max(0, Math.round(extraHubs)), free ? 'free' : 'normal');
}

/** The number of airports run at management tier 2 or higher. */
export function countHubs(management: Record<string, { level?: number } | undefined> | null | undefined): number {
  return Object.values(management || {}).filter((m) => (m?.level ?? 0) >= 2).length;
}

/**
 * Why a management tier cannot be bought at an airport, or null when it can.
 * Tier 2 makes the airport a hub, and the rank (plus any milestone rooms)
 * limits how many there are; tier 3 needs a rank of its own. Airports already
 * at the tier are not asked again, and a save with more hubs than its rank
 * allows keeps them: the limit only stops new ones.
 */
export function managementGate(
  tier: number,
  rank: number,
  extraHubs: number,
  management: Record<string, { level?: number } | undefined> | null | undefined,
  airportId?: string,
  free = false,
): string | null {
  if (airportId && (management?.[airportId]?.level ?? 0) >= tier) return null;
  if (tier === 2) {
    const cap = hubAllowance(rank, extraHubs, free);
    if (countHubs(management) >= cap) {
      return (
        `Your airline (${rankDef(rank).title}) may run ${cap} hub${cap === 1 ? '' : 's'}, and all ${cap === 1 ? 'is' : 'are'} in use. ` +
        `A higher rank or a gold milestone makes room for more.`
      );
    }
  }
  if (tier === 3 && !free) return rankGateMessage(rank, RANK_UNLOCKS.managementTier3, 'Management tier 3');
  return null;
}
