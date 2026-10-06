/**
 * Development: the airline's long-term investments.
 *
 * Money had little to be spent on late in the game. Ten projects now cost
 * money and months and pay back for good: leaner fuel use, better yields,
 * fewer defects, content crews, better connections, cheaper slots, a nicer
 * cabin, faster route ramp-up. Two can run at once; the later projects of a
 * chain need the earlier ones and a rank.
 *
 * Everything here is pure; App.tsx applies the effects where they act.
 */
import { RANKS, rankDef } from './airlineRank';

export interface ResearchProject {
  id: string;
  title: string;
  detail: string;
  /** Cost in 1960 dollars; it grows with the years, see projectCost. */
  baseCost: number;
  months: number;
  requires?: string;
  rank?: number;
}

export const PROJECTS: readonly ResearchProject[] = [
  { id: 'fuel-1', title: 'Fuel management programme', detail: 'Fuel use 3% lower: flight planning, weight discipline, single-engine taxi.', baseCost: 4_000_000, months: 6 },
  { id: 'fuel-2', title: 'Fleet fuel optimisation', detail: 'Another 3% off the fuel bill: engine washes, winglets, continuous descent.', baseCost: 12_000_000, months: 12, requires: 'fuel-1', rank: 2 },
  { id: 'yield-1', title: 'Revenue management system', detail: 'Demand 1.5% higher on every route: fares follow the booking curve.', baseCost: 6_000_000, months: 9 },
  { id: 'yield-2', title: 'Dynamic pricing engine', detail: 'Another 2.5% demand: fares follow the market hour by hour.', baseCost: 18_000_000, months: 12, requires: 'yield-1', rank: 3 },
  { id: 'maintenance', title: 'Predictive maintenance', detail: 'Technical defects 30% less likely: parts are replaced before they fail.', baseCost: 9_000_000, months: 9 },
  { id: 'academy', title: 'Crew academy', detail: 'Staff morale settles 5 points higher: training, a career path, a name to be proud of.', baseCost: 5_000_000, months: 6 },
  { id: 'alliance', title: 'Alliance and codeshare systems', detail: 'Connecting passengers 10% more: shared booking, through-checked bags.', baseCost: 10_000_000, months: 12, rank: 2 },
  { id: 'slots', title: 'Slot negotiators', detail: 'Airport slots 8% cheaper: a team that knows every coordinator.', baseCost: 4_000_000, months: 6 },
  { id: 'cabin', title: 'Cabin design studio', detail: 'Satisfaction +2 in every cabin class: the cabin is designed, not just fitted.', baseCost: 8_000_000, months: 9 },
  { id: 'planning', title: 'Route planning suite', detail: 'New routes start at 75% of their demand instead of 60%.', baseCost: 7_000_000, months: 8 }
];

export const MAX_PARALLEL = 2;

export interface ResearchState {
  done: string[];
  active: { id: string; startedOffset: number }[];
}

export const EMPTY_RESEARCH: ResearchState = { done: [], active: [] };

export function projectById(id: string): ResearchProject | undefined {
  return PROJECTS.find(p => p.id === id);
}

/** Cost at a year: it grows 4% of its 1960 value every year, as the airline does. */
export function projectCost(project: ResearchProject, year: number): number {
  const years = Math.max(0, year - 1960);
  const raw = project.baseCost * (1 + 0.04 * years);
  return Math.round(raw / 100_000) * 100_000;
}

/** What the finished projects do. Every field is neutral when nothing is done. */
export interface ResearchEffects {
  /** Multiplies the player's fuel price. */
  fuelFactor: number;
  /** Added to the demand factor of every route: 0.04 = 4% more. */
  demandBonus: number;
  /** Multiplies the chance of a technical defect. */
  defectFactor: number;
  /** Added to the morale staff settle at. */
  moraleBonus: number;
  /** Connecting passengers: 0.1 = 10% more. */
  transferBoost: number;
  /** Multiplies the price of an airport slot. */
  slotFactor: number;
  /** Satisfaction points in every cabin class. */
  satBonus: number;
  /** Where a new route's demand starts, 0-1. */
  rampStart: number;
}

export const NEUTRAL_EFFECTS: ResearchEffects = {
  fuelFactor: 1, demandBonus: 0, defectFactor: 1, moraleBonus: 0, transferBoost: 0, slotFactor: 1, satBonus: 0, rampStart: 0.6
};

export function researchEffects(done: readonly string[]): ResearchEffects {
  const has = (id: string) => done.includes(id);
  return {
    fuelFactor: (has('fuel-1') ? 0.97 : 1) * (has('fuel-2') ? 0.97 : 1),
    demandBonus: (has('yield-1') ? 0.015 : 0) + (has('yield-2') ? 0.025 : 0),
    defectFactor: has('maintenance') ? 0.7 : 1,
    moraleBonus: has('academy') ? 5 : 0,
    transferBoost: has('alliance') ? 0.1 : 0,
    slotFactor: has('slots') ? 0.92 : 1,
    satBonus: has('cabin') ? 2 : 0,
    rampStart: has('planning') ? 0.75 : 0.6
  };
}

/** Why a project cannot be started now, or null when it can. */
export function startBlocker(state: ResearchState, project: ResearchProject, rank: number, capital: number, year: number): string | null {
  if (state.done.includes(project.id)) return 'Already finished.';
  if (state.active.some(a => a.id === project.id)) return 'Already under way.';
  if (state.active.length >= MAX_PARALLEL) return `Only ${MAX_PARALLEL} projects can run at once.`;
  if (project.requires && !state.done.includes(project.requires)) {
    return `Needs "${projectById(project.requires)?.title ?? project.requires}" first.`;
  }
  if ((project.rank ?? 0) > rank) return `Needs the rank ${rankDef(project.rank ?? 0).title}.`;
  const cost = projectCost(project, year);
  if (capital < cost) return `Costs ${cost.toLocaleString('en-US')} dollars; the airline has less.`;
  return null;
}

export function startProject(state: ResearchState, id: string, offset: number): ResearchState {
  if (state.done.includes(id) || state.active.some(a => a.id === id)) return state;
  return { ...state, active: [...state.active, { id, startedOffset: offset }] };
}

/** Months a project has run, and its share done, 0-1. */
export function projectProgress(project: ResearchProject, startedOffset: number, offset: number): { monthsDone: number; fraction: number } {
  const monthsDone = Math.max(0, offset - startedOffset);
  return { monthsDone, fraction: Math.min(1, monthsDone / project.months) };
}

/** What finishes when the month at `offset` begins. */
export function advanceResearch(state: ResearchState, offset: number): { state: ResearchState; completed: ResearchProject[] } {
  const completed: ResearchProject[] = [];
  const active: ResearchState['active'] = [];
  for (const a of state.active) {
    const project = projectById(a.id);
    if (!project) continue;
    if (offset - a.startedOffset >= project.months) completed.push(project);
    else active.push(a);
  }
  if (completed.length === 0 && active.length === state.active.length) return { state, completed };
  return { state: { done: [...state.done, ...completed.map(p => p.id)], active }, completed };
}

/** The saved state, with unknown projects dropped and a project never both done and under way. */
export function normalizeResearch(raw: unknown): ResearchState {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const done = Array.isArray(src.done) ? [...new Set(src.done.filter((id): id is string => typeof id === 'string' && !!projectById(id)))] : [];
  const active = (Array.isArray(src.active) ? src.active : [])
    .filter((a): a is { id: string; startedOffset: number } =>
      !!a && typeof a === 'object' && typeof (a as any).id === 'string' && !!projectById((a as any).id) &&
      Number.isFinite((a as any).startedOffset) && !done.includes((a as any).id))
    .slice(0, MAX_PARALLEL)
    .map(a => ({ id: a.id, startedOffset: Math.round(a.startedOffset) }));
  return { done, active };
}

export const RANK_TITLES = RANKS.map(r => r.title);
