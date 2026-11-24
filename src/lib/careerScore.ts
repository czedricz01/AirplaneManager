
import { HALL_SIZE } from '../model/constants';
import { fileCareer as fileModelCareer, splitHall, type HallsOfFame as ModelHalls } from '../model/progress';

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
  /** Free Mode careers are filed too, and marked as such; older entries are Normal Mode. */
  mode?: 'normal' | 'free';
}

/** Two halls (E43): Normal and Free Mode, ten best each (`HALL_SIZE`). Filing and sorting are the model's (6.12). */
export type HallsOfFame = ModelHalls<HallOfFameEntry>;

export { HALL_SIZE };

/** The halls with a new entry in the hall of its mode: best first, ten at most, the same career filed twice kept once. */
export function fileCareer(halls: HallsOfFame, entry: HallOfFameEntry): HallsOfFame {
  return fileModelCareer(halls, entry);
}

/** The hall of one mode. */
export function hallOf(halls: HallsOfFame, mode: 'normal' | 'free' | undefined): readonly HallOfFameEntry[] {
  return mode === 'free' ? halls.free : halls.normal;
}

/** Where an entry would stand in the hall of its mode, 1-based, or null if it does not make it. */
export function hallPosition(halls: HallsOfFame, entry: HallOfFameEntry): number | null {
  const i = hallOf(fileCareer(halls, entry), entry.mode).findIndex(e => e.id === entry.id);
  return i < 0 ? null : i + 1;
}

/** Stored entries, damaged ones dropped; an entry without a mode is Normal Mode. */
function cleanEntries(raw: unknown): HallOfFameEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e): e is HallOfFameEntry =>
    !!e && typeof e === 'object' &&
    typeof (e as any).id === 'string' && typeof (e as any).airline === 'string' &&
    Number.isFinite((e as any).score) && typeof (e as any).filed === 'string'
  ).map(e => ({
    id: e.id, airline: e.airline, code: typeof e.code === 'string' ? e.code : '', score: Math.round(e.score),
    rank: Number.isFinite(e.rank) ? e.rank : 0, years: Number.isFinite(e.years) ? e.years : 0,
    netWorth: Number.isFinite(e.netWorth) ? e.netWorth : 0, filed: e.filed,
    mode: (e as any).mode === 'free' ? 'free' as const : 'normal' as const
  }));
}

/**
 * The stored halls, repaired: `{ normal, free }`, or the one shared list stored before 5.2b, split by mode
 * (`splitHall`, 6.12). Each hall holds only entries of its mode.
 */
export function normalizeHalls(raw: unknown): HallsOfFame {
  if (Array.isArray(raw)) return splitHall(cleanEntries(raw));
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return splitHall([...cleanEntries(src.normal), ...cleanEntries(src.free)]);
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
