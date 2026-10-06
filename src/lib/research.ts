/**
 * Development: the airline's long-term investments, as a tree that opens with
 * the rank.
 *
 * The main points of the tree are the aircraft classes (see aircraftClasses.ts):
 * Regional, Narrowbody, Wide-body, Jumbo and Supersonic aircraft can only be
 * bought once their class has been developed. Between them sit the small
 * bonuses, a percent at a time: leaner aircraft, better-liked aircraft, cheaper
 * maintenance, crews, airport charges and catering, slower wear, a better
 * resale price, and a few larger ones from the first version of the tree
 * (fuel programmes, yield management, predictive maintenance, ...).
 *
 * A project costs money at once and takes months. It appears at a rank and
 * needs the project before it in its chain. How many can run at once grows
 * with the rank. In Free Mode the rank is the top one and every class is open.
 *
 * Everything here is pure; App.tsx applies the effects where they act.
 */
import { MAX_RANK, clampRank, rankDef } from './airlineRank';
import type { AircraftClassId } from './aircraftClasses';

/** What a finished project adds up to. Amounts are fractions (0.01 = 1%), except where the key says points. */
export interface ProjectEffect {
  /** Aircraft efficiency up by this many percent of the 0-100 scale: 0.01 is one point. */
  efficiency?: number;
  /** Plane type satisfaction (the type's popularity, shown in %) up: 0.01 is one point. */
  popularity?: number;
  /** Maintenance programme cheaper by this share. */
  maintenance?: number;
  /** Crew and ground staff cheaper. */
  crew?: number;
  /** Landing, passenger-handling and check-in fees and airport upkeep cheaper. */
  fees?: number;
  /** Catering cheaper. */
  catering?: number;
  /** Interior and airframe wear slower. */
  wear?: number;
  /** Resale value higher. */
  resale?: number;
  /** Demand on every route higher. */
  demand?: number;
  /** Connecting passengers more numerous. */
  transfer?: number;
  /** Fuel bill lower. */
  fuel?: number;
  /** Airport slots cheaper. */
  slots?: number;
  /** Technical defects rarer. */
  defects?: number;
  /** Staff morale higher, in points. */
  morale?: number;
  /** Satisfaction higher in every cabin class, in points. */
  sat?: number;
  /** A new route starts this much closer to full demand. */
  ramp?: number;
}

export type ProjectKind = 'class' | 'bonus';

export interface ResearchProject {
  id: string;
  title: string;
  detail: string;
  /** Cost in 1960 dollars; it grows with the years, see projectCost. */
  baseCost: number;
  months: number;
  kind: ProjectKind;
  /** The rank at which it appears. */
  rank: number;
  requires?: string;
  /** For a class project: the class it opens. */
  opens?: AircraftClassId;
  effect?: ProjectEffect;
}

const roundCost = (n: number) => Math.round(n / 100_000) * 100_000;

/** A small bonus: its cost and time follow the rank it appears at. */
function bonus(
  id: string, title: string, detail: string, rank: number, effect: ProjectEffect, requires?: string,
  over: Partial<Pick<ResearchProject, 'baseCost' | 'months'>> = {}
): ResearchProject {
  return {
    id, title, detail, kind: 'bonus', rank, requires, effect,
    baseCost: over.baseCost ?? roundCost((1.2 + 1.3 * rank) * 1_000_000),
    months: over.months ?? 3 + Math.ceil(rank / 2)
  };
}

function aircraftClass(
  id: string, opens: AircraftClassId, title: string, detail: string, rank: number, baseCost: number, months: number, requires?: string
): ResearchProject {
  return { id, title, detail, kind: 'class', rank, requires, opens, baseCost, months };
}

export const PROJECTS: readonly ResearchProject[] = [
  // --- Startup -------------------------------------------------------------------
  bonus('eff-1', 'Lean flight operations', 'Aircraft efficiency +1%: weight discipline and flight planning.', 0, { efficiency: 0.01 }),
  bonus('sat-1', 'Passenger service basics', 'Plane type satisfaction +1%: clean cabins, friendly crews.', 0, { popularity: 0.01 }),
  bonus('crew-1', 'Crew rostering', 'Crew and ground staff 1% cheaper: fewer idle hours.', 0, { crew: 0.01 }),

  // --- Local Airline ---------------------------------------------------------------
  aircraftClass('class-regional', 'regional', 'Regional aircraft class',
    'Opens regional aircraft over 60 seats and small jets up to 130 seats: the Caravelle, the Comet, the DC-9, the ATR 72.', 1, 3_000_000, 6),
  bonus('maint-1', 'Maintenance routines', 'Maintenance programme 1% cheaper.', 1, { maintenance: 0.01 }),
  bonus('fees-1', 'Handling agreements', 'Airport charges 1% lower.', 1, { fees: 0.01 }),
  bonus('eff-2', 'Winglets and weight', 'Aircraft efficiency +1%.', 1, { efficiency: 0.01 }, 'eff-1'),

  // --- Regional Airline --------------------------------------------------------------
  bonus('slots', 'Slot negotiators', 'Airport slots 8% cheaper: a team that knows every coordinator.', 2, { slots: 0.08 }, undefined, { baseCost: 4_000_000, months: 6 }),
  bonus('sat-2', 'Cabin crew training', 'Plane type satisfaction +1%.', 2, { popularity: 0.01 }, 'sat-1'),
  bonus('catering-1', 'Galley logistics', 'Catering 2% cheaper.', 2, { catering: 0.02 }),
  bonus('yield-1', 'Revenue management system', 'Demand 1.5% higher on every route: fares follow the booking curve.', 2, { demand: 0.015 }, undefined, { baseCost: 6_000_000, months: 9 }),
  bonus('academy', 'Crew academy', 'Staff morale settles 5 points higher: training, a career path, a name to be proud of.', 2, { morale: 5 }, undefined, { baseCost: 5_000_000, months: 6 }),

  // --- Domestic Airline ---------------------------------------------------------------
  aircraftClass('class-narrowbody', 'narrowbody', 'Narrowbody aircraft class',
    'Opens single-aisle jets over 130 seats: the Boeing 707, the DC-8, the 727, the Airbus A320.', 3, 12_000_000, 9, 'class-regional'),
  bonus('fuel-1', 'Fuel management programme', 'Fuel bill 3% lower: flight planning, single-engine taxi.', 3, { fuel: 0.03 }, undefined, { baseCost: 4_000_000, months: 6 }),
  bonus('maint-2', 'Condition monitoring', 'Maintenance programme 1% cheaper.', 3, { maintenance: 0.01 }, 'maint-1'),
  bonus('crew-2', 'Crew pairing optimiser', 'Crew and ground staff 1% cheaper.', 3, { crew: 0.01 }, 'crew-1'),
  bonus('planning', 'Route planning suite', 'New routes start at 75% of their demand instead of 60%.', 3, { ramp: 0.15 }, undefined, { baseCost: 7_000_000, months: 8 }),

  // --- National Airline --------------------------------------------------------------
  bonus('eff-3', 'Engine upgrades', 'Aircraft efficiency +1%.', 4, { efficiency: 0.01 }, 'eff-2'),
  bonus('sat-3', 'Premium service concept', 'Plane type satisfaction +1%.', 4, { popularity: 0.01 }, 'sat-2'),
  bonus('wear-1', 'Protective cabin materials', 'Cabin and airframe wear 3% slower.', 4, { wear: 0.03 }),
  bonus('maintenance', 'Predictive maintenance', 'Technical defects 30% less likely: parts are replaced before they fail.', 4, { defects: 0.3 }, 'maint-2', { baseCost: 9_000_000, months: 9 }),
  bonus('resale-1', 'Fleet remarketing', 'Resale value +1%.', 4, { resale: 0.01 }),

  // --- Continental Airline -----------------------------------------------------------
  aircraftClass('class-widebody', 'widebody', 'Wide-body aircraft class',
    'Opens twin-aisle jets up to 500 seats: the A300, the 767, the DC-10, the Airbus A330, the 777-200 and the 787.', 5, 60_000_000, 12, 'class-narrowbody'),
  bonus('alliance', 'Alliance and codeshare systems', 'Connecting passengers 10% more: shared booking, through-checked bags.', 5, { transfer: 0.1 }, undefined, { baseCost: 10_000_000, months: 12 }),
  bonus('eff-4', 'Aerodynamic refit programme', 'Aircraft efficiency +1%.', 5, { efficiency: 0.01 }, 'eff-3'),
  bonus('fees-2', 'Airport partnerships', 'Airport charges 1% lower.', 5, { fees: 0.01 }, 'fees-1'),
  bonus('fuel-2', 'Fleet fuel optimisation', 'Fuel bill another 3% lower: engine washes, continuous descent.', 5, { fuel: 0.03 }, 'fuel-1', { baseCost: 12_000_000, months: 12 }),

  // --- International Airline -----------------------------------------------------------
  bonus('sat-4', 'Lounge and service standards', 'Plane type satisfaction +1%.', 6, { popularity: 0.01 }, 'sat-3'),
  bonus('cabin', 'Cabin design studio', 'Satisfaction +2 in every cabin class: the cabin is designed, not just fitted.', 6, { sat: 2 }, undefined, { baseCost: 8_000_000, months: 9 }),
  bonus('yield-2', 'Dynamic pricing engine', 'Demand another 2.5% higher: fares follow the market hour by hour.', 6, { demand: 0.025 }, 'yield-1', { baseCost: 18_000_000, months: 12 }),
  bonus('maint-3', 'Own maintenance base', 'Maintenance programme 1% cheaper.', 6, { maintenance: 0.01 }, 'maint-2'),
  bonus('catering-2', 'Central kitchen', 'Catering another 2% cheaper.', 6, { catering: 0.02 }, 'catering-1'),

  // --- Intercontinental Airline ---------------------------------------------------------
  aircraftClass('class-jumbo', 'jumbo', 'Jumbo aircraft class',
    'Opens twin-aisle jets over 500 seats: the Boeing 747, the 777-300ER, the Airbus A380.', 7, 200_000_000, 18, 'class-widebody'),
  bonus('eff-5', 'Composite wings', 'Aircraft efficiency +1%.', 7, { efficiency: 0.01 }, 'eff-4'),
  bonus('crew-3', 'Crew base network', 'Crew and ground staff 1% cheaper.', 7, { crew: 0.01 }, 'crew-2'),
  bonus('wear-2', 'Nano-coated interiors', 'Cabin and airframe wear another 3% slower.', 7, { wear: 0.03 }, 'wear-1'),

  // --- Flag Carrier ----------------------------------------------------------------------
  aircraftClass('class-supersonic', 'supersonic', 'Supersonic aircraft class',
    'Opens airliners that fly faster than sound: the Concorde.', 8, 500_000_000, 24, 'class-jumbo'),
  bonus('sat-5', 'Ambassador airline', 'Plane type satisfaction +1%.', 8, { popularity: 0.01 }, 'sat-4'),
  bonus('resale-2', 'Certified pre-owned programme', 'Resale value another 1.5%.', 8, { resale: 0.015 }, 'resale-1'),
  bonus('fees-3', 'Terminal operating rights', 'Airport charges another 1% lower.', 8, { fees: 0.01 }, 'fees-2'),

  // --- Global Player ----------------------------------------------------------------------
  bonus('eff-6', 'Next-generation engines', 'Aircraft efficiency +1%.', 9, { efficiency: 0.01 }, 'eff-5'),
  bonus('maint-4', 'Self-diagnosing fleet', 'Maintenance programme another 1% cheaper.', 9, { maintenance: 0.01 }, 'maint-3'),
  bonus('sat-6', 'The world\'s favourite airline', 'Plane type satisfaction +1%.', 9, { popularity: 0.01 }, 'sat-5'),
  bonus('yield-3', 'Global yield network', 'Demand another 1% higher.', 9, { demand: 0.01 }, 'yield-2'),
  bonus('fuel-3', 'Sustainable fuel contracts', 'Fuel bill another 1% lower.', 9, { fuel: 0.01 }, 'fuel-2')
];

/** The projects that open an aircraft class. */
export const CLASS_PROJECTS: readonly ResearchProject[] = PROJECTS.filter(p => p.kind === 'class');

export function projectById(id: string): ResearchProject | undefined {
  return PROJECTS.find(p => p.id === id);
}

/** How many projects can run at once: two at the start, one more every three ranks. */
export function maxParallel(rank: number): number {
  return Math.min(5, 2 + Math.floor(clampRank(rank) / 3));
}

export interface ResearchState {
  done: string[];
  active: { id: string; startedOffset: number }[];
}

export const EMPTY_RESEARCH: ResearchState = { done: [], active: [] };

/**
 * The state a new game starts with: the class projects of the ranks already
 * reached are done (a scenario that starts as a National Airline already flies
 * narrowbodies).
 */
export function startingResearch(rank: number): ResearchState {
  return { done: CLASS_PROJECTS.filter(p => p.rank <= clampRank(rank)).map(p => p.id), active: [] };
}

/** Cost at a year: it grows 4% of its 1960 value every year, as the airline does. */
export function projectCost(project: ResearchProject, year: number): number {
  const years = Math.max(0, year - 1960);
  return roundCost(project.baseCost * (1 + 0.04 * years));
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
  /** Points added to every aircraft's efficiency (0-100 scale): 0.03 = 3 points. */
  efficiencyBonus: number;
  /** Points added to every aircraft's plane type satisfaction (shown in %): 0.03 = 3 points. */
  popularityBonus: number;
  /** Multiplies the maintenance part of the fleet's upkeep. */
  maintenanceFactor: number;
  /** Multiplies crew and ground staff cost. */
  crewFactor: number;
  /** Multiplies landing, handling and check-in fees and airport upkeep. */
  feeFactor: number;
  /** Multiplies catering cost. */
  cateringFactor: number;
  /** Multiplies the wear aircraft take. */
  wearFactor: number;
  /** Added to the resale value: 0.02 = 2% more. */
  resaleBonus: number;
}

export const NEUTRAL_EFFECTS: ResearchEffects = {
  fuelFactor: 1, demandBonus: 0, defectFactor: 1, moraleBonus: 0, transferBoost: 0, slotFactor: 1, satBonus: 0, rampStart: 0.6,
  efficiencyBonus: 0, popularityBonus: 0, maintenanceFactor: 1, crewFactor: 1, feeFactor: 1, cateringFactor: 1, wearFactor: 1, resaleBonus: 0
};

/** An aircraft's efficiency with the developed bonus: whole points on the 0-100 scale, never above 100. */
export function boostedEfficiency(base: number, fx: Pick<ResearchEffects, 'efficiencyBonus'>): number {
  return Math.min(100, Math.max(base, Math.round(base + fx.efficiencyBonus * 100)));
}

/** An aircraft's plane type satisfaction with the developed bonus, never above 100. */
export function boostedPopularity(base: number, fx: Pick<ResearchEffects, 'popularityBonus'>): number {
  return Math.min(100, Math.max(base, base + fx.popularityBonus * 100));
}

/** A cost factor from a summed saving: never below 40%. */
const saved = (sum: number) => Math.max(0.4, 1 - sum);

export function researchEffects(done: readonly string[]): ResearchEffects {
  const sum: Required<ProjectEffect> = {
    efficiency: 0, popularity: 0, maintenance: 0, crew: 0, fees: 0, catering: 0, wear: 0, resale: 0, demand: 0,
    transfer: 0, fuel: 0, slots: 0, defects: 0, morale: 0, sat: 0, ramp: 0
  };
  const finished = new Set(done);
  for (const p of PROJECTS) {
    if (!finished.has(p.id) || !p.effect) continue;
    for (const [key, value] of Object.entries(p.effect) as [keyof ProjectEffect, number][]) sum[key] += value;
  }
  return {
    fuelFactor: saved(sum.fuel),
    demandBonus: sum.demand,
    defectFactor: saved(sum.defects),
    moraleBonus: sum.morale,
    transferBoost: sum.transfer,
    slotFactor: saved(sum.slots),
    satBonus: sum.sat,
    rampStart: Math.min(1, NEUTRAL_EFFECTS.rampStart + sum.ramp),
    efficiencyBonus: sum.efficiency,
    popularityBonus: sum.popularity,
    maintenanceFactor: saved(sum.maintenance),
    crewFactor: saved(sum.crew),
    feeFactor: saved(sum.fees),
    cateringFactor: saved(sum.catering),
    wearFactor: saved(sum.wear),
    resaleBonus: sum.resale
  };
}

/** Why a project cannot be started now, or null when it can. `rank` is the top one in Free Mode. */
export function startBlocker(state: ResearchState, project: ResearchProject, rank: number, capital: number, year: number): string | null {
  if (state.done.includes(project.id)) return 'Already finished.';
  if (state.active.some(a => a.id === project.id)) return 'Already under way.';
  if (project.rank > clampRank(rank)) return `Appears at the rank ${rankDef(project.rank).title}.`;
  if (project.requires && !state.done.includes(project.requires)) {
    return `Needs "${projectById(project.requires)?.title ?? project.requires}" first.`;
  }
  const limit = maxParallel(rank);
  if (state.active.length >= limit) return `Only ${limit} project${limit === 1 ? '' : 's'} can run at once at this rank.`;
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
    .slice(0, maxParallel(MAX_RANK))
    .map(a => ({ id: a.id, startedOffset: Math.round(a.startedOffset) }));
  return { done, active };
}

/** The projects of a rank, in the order of the tree. */
export function projectsOfRank(rank: number): ResearchProject[] {
  return PROJECTS.filter(p => p.rank === rank);
}

/** The class projects that must be done for a fleet: the classes it flies and everything they need. */
export function projectsForClasses(classes: ReadonlySet<AircraftClassId>): string[] {
  const out = new Set<string>();
  const add = (id: string | undefined) => {
    if (!id || out.has(id)) return;
    const p = projectById(id);
    if (!p) return;
    out.add(id);
    add(p.requires);
  };
  for (const p of CLASS_PROJECTS) if (p.opens && classes.has(p.opens)) add(p.id);
  return [...out];
}
