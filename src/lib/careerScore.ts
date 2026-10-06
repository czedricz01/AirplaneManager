/**
 * The career score, the retirement report and the hall of fame; and the stars
 * a scenario earns, and which scenarios they open.
 *
 * The free game has no end. A player may retire whenever they like: the score
 * says how the airline did, is filed in the hall of fame, and the game can
 * carry on. A scenario is judged by how quickly it was won.
 *
 * Everything here is pure; the hall of fame and the stars are kept by the
 * caller in the browser's storage.
 */

export interface ScoreInput {
  /** Cash plus the resale value of the fleet. */
  netWorth: number;
  rank: number;
  milestones: number;
  reputation: number;
  takeovers: number;
  projectsDone: number;
  /** Whole years played. */
  years: number;
}

export interface ScoreBreakdown {
  wealth: number;
  rank: number;
  milestones: number;
  reputation: number;
  takeovers: number;
  development: number;
  longevity: number;
  total: number;
}

/** What each part of a career is worth, in points. */
export function careerScore(input: ScoreInput): ScoreBreakdown {
  const wealth = Math.max(0, Math.round(100 * Math.log10(Math.max(1, input.netWorth / 1_000_000))));
  const rank = 150 * Math.max(0, Math.round(input.rank));
  const milestones = 10 * Math.max(0, Math.round(input.milestones));
  const reputation = Math.round(2 * Math.max(0, Math.min(100, input.reputation)));
  const takeovers = 25 * Math.max(0, Math.round(input.takeovers));
  const development = 15 * Math.max(0, Math.round(input.projectsDone));
  const longevity = 5 * Math.max(0, Math.min(60, Math.floor(input.years)));
  return {
    wealth, rank, milestones, reputation, takeovers, development, longevity,
    total: wealth + rank + milestones + reputation + takeovers + development + longevity
  };
}

// --- Hall of fame ---------------------------------------------------------------

export interface HallOfFameEntry {
  id: string;
  airline: string;
  code: string;
  score: number;
  rank: number;
  years: number;
  netWorth: number;
  /** ISO date the career was filed. */
  filed: string;
}

export const HALL_SIZE = 10;

/** The hall with a new entry in it: best first, ten at most, the same career filed twice kept once. */
export function fileCareer(hall: readonly HallOfFameEntry[], entry: HallOfFameEntry): HallOfFameEntry[] {
  return [...hall.filter(e => e.id !== entry.id), entry]
    .sort((a, b) => b.score - a.score || a.filed.localeCompare(b.filed))
    .slice(0, HALL_SIZE);
}

/** Where an entry would stand, 1-based, or null if it does not make the hall. */
export function hallPosition(hall: readonly HallOfFameEntry[], entry: HallOfFameEntry): number | null {
  const filed = fileCareer(hall, entry);
  const i = filed.findIndex(e => e.id === entry.id);
  return i < 0 ? null : i + 1;
}

export function normalizeHall(raw: unknown): HallOfFameEntry[] {
  if (!Array.isArray(raw)) return [];
  const ok = raw.filter((e): e is HallOfFameEntry =>
    !!e && typeof e === 'object' &&
    typeof (e as any).id === 'string' && typeof (e as any).airline === 'string' &&
    Number.isFinite((e as any).score) && typeof (e as any).filed === 'string'
  ).map(e => ({
    id: e.id, airline: e.airline, code: typeof e.code === 'string' ? e.code : '', score: Math.round(e.score),
    rank: Number.isFinite(e.rank) ? e.rank : 0, years: Number.isFinite(e.years) ? e.years : 0,
    netWorth: Number.isFinite(e.netWorth) ? e.netWorth : 0, filed: e.filed
  }));
  return ok.sort((a, b) => b.score - a.score).slice(0, HALL_SIZE);
}

// --- Scenario stars ---------------------------------------------------------------

/** The scenarios in the order they open. */
export const SCENARIO_ORDER = ['jet-age', 'oil-shock', 'deregulation', 'hub-builder'] as const;

export type ScenarioStars = Record<string, number>;

/**
 * Stars for a decided scenario: none for a loss, one for a win, two for a win
 * in three quarters of the time allowed, three for one in half of it.
 */
export function starsFor(won: boolean, monthsUsed: number, monthsAllowed: number): number {
  if (!won) return 0;
  const share = monthsAllowed > 0 ? monthsUsed / monthsAllowed : 1;
  return share <= 0.5 ? 3 : share <= 0.75 ? 2 : 1;
}

/** Whether a scenario is open: the first always is, each other once the one before it has a star. */
export function scenarioUnlocked(id: string, stars: ScenarioStars): boolean {
  const i = (SCENARIO_ORDER as readonly string[]).indexOf(id);
  if (i <= 0) return true;
  return (stars[SCENARIO_ORDER[i - 1]] ?? 0) >= 1;
}

/** The best of the stars held and the stars just earned. */
export function bestStars(stars: ScenarioStars, id: string, earned: number): ScenarioStars {
  const e = Math.max(0, Math.min(3, Math.round(earned)));
  return e > (stars[id] ?? 0) ? { ...stars, [id]: e } : stars;
}

export function normalizeStars(raw: unknown): ScenarioStars {
  const out: ScenarioStars = {};
  if (raw && typeof raw === 'object') {
    for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 1) out[id] = Math.min(3, Math.round(v));
    }
  }
  return out;
}
