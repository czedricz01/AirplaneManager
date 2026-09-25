/**
 * Operational disruptions: the things that ground part of a month's flying
 * without anyone deciding to.
 *
 * At each month's end the coming month is rolled for, and whatever comes up
 * is known for the whole month it hits: the route list, the planner and the
 * forecast show the cancellations from the start, and the month's close then
 * books exactly that. Four kinds:
 *
 *   technical defect  per route, 1% + (100 - airframe condition) x 0.08%
 *                     + age in years x 0.1%, halved by a hangar at the
 *                     route's origin; cancels 25% of its flights
 *   bird strike       per route, 0.4%; 10% of its flights and $200k repairs
 *   airport strike    per airport served, 1%; 30% of every route there
 *   winter weather    per region, 3% in December to February, Europe, North
 *                     America and Asia only; 15% of every route touching it
 *
 * A route hit twice loses flights to each cause independently (see
 * combineCancelShares). Disruptions of 25% and more are put to the player:
 * charter a replacement aircraft and nothing is cancelled, or cancel the
 * flights for free and lose a reputation point per route hit, four at most.
 * At most three such questions a month; the rest, and the minor ones, are
 * reported in the inbox and simply happen.
 *
 * A charter is billed at the close of the month it flies, as an operating
 * cost: 90% of the ticket revenue it saved, with every other cause applied
 * (marginalLostRevenue). A route a strike grounds anyway saves nothing and
 * costs nothing to charter, and cancelling there costs no reputation either.
 *
 * Everything here is pure; the random generator is a parameter. Nothing here
 * reaches the AI airlines.
 */
import type { Disruption, DisruptionKind, GameDecision, RegionId, ReportIncident, RouteCancellation } from './gameState';
import { regionOf } from './geoUtils';
import { REGION_LABELS } from './marketing';
import { formatCurrency } from './format';

// --- What each kind does -------------------------------------------------------

export interface DisruptionSpec {
  label: string;
  /** Share of each hit route's flights cancelled, 0-1. */
  cancelShare: number;
}

export const DISRUPTION_SPECS: Record<DisruptionKind, DisruptionSpec> = {
  technical: { label: 'Technical defect', cancelShare: 0.25 },
  birdstrike: { label: 'Bird strike', cancelShare: 0.10 },
  'airport-strike': { label: 'Airport strike', cancelShare: 0.30 },
  weather: { label: 'Winter weather', cancelShare: 0.15 }
};

/** Chance of a technical defect on a route in a month, before wear and age. */
export const TECH_BASE_CHANCE = 0.01;
/** Added per point of airframe condition below 100. */
export const TECH_CHANCE_PER_WEAR_POINT = 0.0008;
/** Added per year since the aircraft was bought. */
export const TECH_CHANCE_PER_YEAR = 0.001;
/** A hangar at the route's origin catches faults early: the chance is multiplied by this. */
export const HANGAR_TECH_FACTOR = 0.5;

export const BIRDSTRIKE_CHANCE = 0.004;
/** The repair bill for a bird strike, charged in the month it happens. */
export const BIRDSTRIKE_REPAIR_COST = 200_000;

/** Per airport served, per month. */
export const AIRPORT_STRIKE_CHANCE = 0.01;

/** Per region, per winter month. */
export const WEATHER_CHANCE = 0.03;
/** The regions with a winter worth the name: the northern ones. */
export const WEATHER_REGIONS: readonly RegionId[] = ['EU', 'NA', 'AS'];
/** December, January, February. */
export const WINTER_MONTHS: readonly number[] = [12, 1, 2];

/** From this share of flights cancelled up, the player is asked what to do. */
export const MAJOR_DISRUPTION_SHARE = 0.25;
/** No more questions than this per month; the rest just happen. */
export const MAX_DISRUPTION_DECISIONS = 3;
/** A replacement aircraft costs this share of the revenue it saves. */
export const CHARTER_COST_SHARE = 0.9;
/** Reputation lost per route whose flights are cancelled rather than chartered... */
export const CANCEL_REPUTATION_PER_ROUTE = 1;
/** ...and at most this much for one disruption. */
export const CANCEL_REPUTATION_MAX = 4;

/** The option ids of a disruption question. Any other answer means cancelling. */
export const DISRUPTION_OPTION_CHARTER = 'charter';
export const DISRUPTION_OPTION_CANCEL = 'cancel';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Every region, in the order they are rolled for. */
const REGIONS = Object.keys(REGION_LABELS) as RegionId[];

/**
 * The share of flights lost to several independent causes, 0-1: each one
 * cancels its share of what the others left flying, 1 - (1 - a)(1 - b)...
 * Two 25% cancellations take 43.75% of the flights, not 50%.
 */
export function combineCancelShares(...shares: (number | undefined)[]): number {
  let flown = 1;
  let causes = 0;
  let only = 0;
  for (const s of shares) {
    const share = clamp01(Number(s) || 0);
    if (share <= 0) continue;
    causes++;
    only = share;
    flown *= 1 - share;
  }
  // A single cause is returned as it is, without the rounding of 1 - (1 - s).
  return causes === 0 ? 0 : causes === 1 ? only : 1 - flown;
}

/** The month of the year, 1-12, for a month offset. */
const monthOf = (offset: number) => 1 + (((offset % 12) + 12) % 12);

/** Whether a region has winter weather in the month at `offset`. */
export function isWinterIn(region: RegionId, offset: number): boolean {
  return WEATHER_REGIONS.includes(region) && WINTER_MONTHS.includes(monthOf(offset));
}

/**
 * The monthly chance of a technical defect on a route flown by `aircraft`, at
 * the month `offset`: worn and old aircraft break more often, a hangar at the
 * origin halves it.
 */
export function technicalDefectChance(
  aircraft: { conditionGeneral?: number; purchasedAt?: number } | undefined,
  offset: number,
  hangarAtOrigin: boolean
): number {
  const condition = Math.max(0, Math.min(100, Number(aircraft?.conditionGeneral ?? 100)));
  const purchased = Number(aircraft?.purchasedAt);
  const ageYears = Number.isFinite(purchased) ? Math.max(0, (offset - purchased) / 12) : 0;
  const chance = TECH_BASE_CHANCE + (100 - condition) * TECH_CHANCE_PER_WEAR_POINT + ageYears * TECH_CHANCE_PER_YEAR;
  return clamp01(hangarAtOrigin ? chance * HANGAR_TECH_FACTOR : chance);
}

// --- Rolling -------------------------------------------------------------------

export interface DisruptionRoute {
  id: string;
  origin: string;
  destination: string;
  aircraft: string;
  schedule?: unknown[];
  weeklyFlights?: number;
}

export interface DisruptionAircraft {
  registration: string;
  conditionGeneral?: number;
  purchasedAt?: number;
}

/** Only routes with an aircraft and at least one departure fly, so only they can be disrupted. */
function flyingRoutes<R extends DisruptionRoute>(routes: R[], fleet: Map<string, DisruptionAircraft>): R[] {
  return routes.filter(r => r && fleet.has(r.aircraft) && ((r.schedule?.length ?? 0) > 0 || (r.weeklyFlights ?? 0) > 0));
}

/**
 * What goes wrong in the month at `offset`, rolled once, in a fixed order:
 * each route (technical defect, then bird strike) in the order given, each
 * airport served in alphabetical order, then each winter region. The same
 * inputs and generator always give the same list. Ids are unique within a
 * month and repeatable: `dis_<offset>_<kind>_<what>`.
 */
export function rollDisruptions(
  routes: DisruptionRoute[],
  fleet: DisruptionAircraft[],
  airportManagement: Record<string, { hubFacilities?: { hangar?: boolean } } | undefined>,
  offset: number,
  rng: () => number,
  airportsMap: Map<string, { coords: [number, number] }>
): Disruption[] {
  const byReg = new Map<string, DisruptionAircraft>();
  for (const f of fleet || []) if (f && !byReg.has(f.registration)) byReg.set(f.registration, f);
  const flying = flyingRoutes(routes || [], byReg);
  const out: Disruption[] = [];

  for (const r of flying) {
    const plane = byReg.get(r.aircraft);
    const hangar = !!airportManagement?.[r.origin]?.hubFacilities?.hangar;
    if (rng() < technicalDefectChance(plane, offset, hangar)) {
      out.push({
        id: `dis_${offset}_technical_${r.id}`, kind: 'technical', offset,
        routeIds: [r.id], cancelShare: DISRUPTION_SPECS.technical.cancelShare, ref: r.aircraft
      });
    }
    if (rng() < BIRDSTRIKE_CHANCE) {
      out.push({
        id: `dis_${offset}_birdstrike_${r.id}`, kind: 'birdstrike', offset,
        routeIds: [r.id], cancelShare: DISRUPTION_SPECS.birdstrike.cancelShare, ref: r.aircraft,
        cost: BIRDSTRIKE_REPAIR_COST
      });
    }
  }

  const served = [...new Set(flying.flatMap(r => [r.origin, r.destination]))].sort();
  for (const airport of served) {
    if (rng() < AIRPORT_STRIKE_CHANCE) {
      out.push({
        id: `dis_${offset}_airport-strike_${airport}`, kind: 'airport-strike', offset,
        routeIds: flying.filter(r => r.origin === airport || r.destination === airport).map(r => r.id),
        cancelShare: DISRUPTION_SPECS['airport-strike'].cancelShare, ref: airport
      });
    }
  }

  const regionsOf = (r: DisruptionRoute) => {
    const set = new Set<RegionId>();
    for (const id of [r.origin, r.destination]) {
      const a = airportsMap.get(id);
      if (a) set.add(regionOf(a.coords));
    }
    return set;
  };
  const routeRegions = new Map(flying.map(r => [r.id, regionsOf(r)] as const));
  for (const region of REGIONS) {
    if (!isWinterIn(region, offset)) continue;
    const hit = flying.filter(r => routeRegions.get(r.id)!.has(region));
    if (hit.length === 0) continue;
    if (rng() < WEATHER_CHANCE) {
      out.push({
        id: `dis_${offset}_weather_${region}`, kind: 'weather', offset,
        routeIds: hit.map(r => r.id), cancelShare: DISRUPTION_SPECS.weather.cancelShare, ref: region
      });
    }
  }

  return out;
}

/** The disruptions still to come or running, from the month at `offset` on. Older ones are done with. */
export function dropPastDisruptions(disruptions: Disruption[], offset: number): Disruption[] {
  return disruptions.filter(d => d.offset >= offset);
}

// --- What they do to the month ---------------------------------------------------

/** Disruptions hitting the month at `offset`, whether or not a replacement flies. */
export function disruptionsIn(disruptions: Disruption[] | undefined, offset: number): Disruption[] {
  return (disruptions || []).filter(d => d.offset === offset);
}

/**
 * The share of each route's flights disruptions cancel in the month at
 * `offset`, by route id, several causes combined. Chartered ones cancel
 * nothing. Undefined when nothing is cancelled.
 */
export function disruptionCancelShares(disruptions: Disruption[] | undefined, offset: number): Record<string, number> | undefined {
  const perRoute = new Map<string, number[]>();
  for (const d of disruptionsIn(disruptions, offset)) {
    if (d.mitigated || !(d.cancelShare > 0)) continue;
    for (const id of d.routeIds) {
      const list = perRoute.get(id);
      if (list) list.push(d.cancelShare);
      else perRoute.set(id, [d.cancelShare]);
    }
  }
  if (perRoute.size === 0) return undefined;
  const out: Record<string, number> = {};
  perRoute.forEach((shares, id) => { out[id] = combineCancelShares(...shares); });
  return out;
}

/** The repair bills of the disruptions in the month at `offset`, in dollars. */
export function disruptionRepairCost(disruptions: Disruption[] | undefined, offset: number): number {
  return disruptionsIn(disruptions, offset).reduce((sum, d) => sum + Math.max(0, Number(d.cost) || 0), 0);
}

/** A disruption's heading: what and where. */
export function disruptionTitle(d: Disruption): string {
  const label = DISRUPTION_SPECS[d.kind]?.label ?? 'Disruption';
  switch (d.kind) {
    case 'technical':
    case 'birdstrike':
      return d.ref ? `${label}: ${d.ref}` : label;
    case 'airport-strike':
      return d.ref ? `${label} at ${d.ref}` : label;
    case 'weather':
      return d.ref && d.ref in REGION_LABELS ? `${label} in ${REGION_LABELS[d.ref as RegionId]}` : label;
  }
  return label;
}

/**
 * Why each route loses flights in the month these modifiers price: the
 * strike, if one runs, and every disruption that is not chartered away. The
 * share is the one the engine applies, via `shareOf`.
 */
export function describeRouteCancellations(
  routeIds: string[],
  shareOf: (routeId: string) => number,
  disruptions: Disruption[] | undefined,
  offset: number,
  strikeShare: number
): Record<string, RouteCancellation> {
  const reasons = new Map<string, string[]>();
  for (const d of disruptionsIn(disruptions, offset)) {
    if (d.mitigated || !(d.cancelShare > 0)) continue;
    for (const id of d.routeIds) {
      const list = reasons.get(id) ?? [];
      list.push(`${disruptionTitle(d)} (${Math.round(d.cancelShare * 100)}%)`);
      reasons.set(id, list);
    }
  }
  const out: Record<string, RouteCancellation> = {};
  for (const id of routeIds) {
    const share = shareOf(id);
    if (!(share > 0)) continue;
    const own = reasons.get(id) ?? [];
    out[id] = { share, reasons: strikeShare > 0 ? [`Staff strike (${Math.round(strikeShare * 100)}%)`, ...own] : own };
  }
  return out;
}

/**
 * The disruptions of the month at `offset`, as the monthly report lists them.
 * `charterFees` holds what each chartered one was billed, by id; it is part
 * of the incident's cost with any repairs.
 */
export function disruptionIncidents(
  disruptions: Disruption[] | undefined,
  offset: number,
  routeName: (routeId: string) => string,
  charterFees: Record<string, number> = {}
): ReportIncident[] {
  return disruptionsIn(disruptions, offset).map(d => {
    const names = d.routeIds.map(routeName);
    const where = names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
    const cost = Math.max(0, Number(d.cost) || 0) + (d.mitigated ? Math.max(0, charterFees[d.id] || 0) : 0);
    return {
      kind: d.kind,
      title: disruptionTitle(d),
      detail: where || 'No routes affected',
      cancelShare: d.mitigated ? 0 : d.cancelShare,
      routeCount: d.routeIds.length,
      ...(d.mitigated ? { mitigated: true } : {}),
      ...(cost > 0 ? { cost } : {})
    };
  });
}

// --- Asking the player -------------------------------------------------------------

/**
 * The ticket revenue one disruption takes from the month, with every other
 * cause applied: the month priced with it chartered away, minus priced with
 * it cancelling. `revenueWith` prices the month's whole network for a list
 * of disruptions; the strike, if any, is in whatever it prices with. What
 * other causes cancel anyway is not counted twice, and a route a strike
 * grounds entirely loses nothing more to it.
 */
export function marginalLostRevenue(
  d: Disruption,
  disruptions: Disruption[],
  revenueWith: (disruptions: Disruption[]) => number
): number {
  const withIt = (mitigated: boolean) => {
    const list = disruptions.map(x => (x.id === d.id ? { ...x, mitigated } : x));
    return list.some(x => x.id === d.id) ? list : [...list, { ...d, mitigated }];
  };
  return Math.max(0, revenueWith(withIt(true)) - revenueWith(withIt(false)));
}

/** What a charter costs for the revenue it saves, in whole dollars. */
export function charterFee(lostRevenue: number): number {
  return Math.round(CHARTER_COST_SHARE * Math.max(0, Number(lostRevenue) || 0));
}

/**
 * Reputation lost by cancelling a disruption's flights instead of chartering:
 * a point per route hit, four at most, each route counted by the share of
 * its flights that would otherwise have flown. `otherShare` gives what other
 * causes, a strike above all, already cancel on a route; a route grounded
 * entirely strands nobody more. Rounded to a tenth.
 */
export function cancelReputationPenalty(d: Disruption, otherShare: (routeId: string) => number = () => 0): number {
  const raw = d.routeIds.reduce((sum, id) => sum + CANCEL_REPUTATION_PER_ROUTE * (1 - clamp01(otherShare(id) || 0)), 0);
  return Math.round(Math.min(CANCEL_REPUTATION_MAX, raw) * 10) / 10;
}

/**
 * The disruptions worth a question: 25% and more, with revenue at stake
 * (`lostOf`, see marginalLostRevenue), largest loss first, three at most.
 * The rest are only reported.
 */
export function disruptionsToAsk(disruptions: Disruption[], lostOf: (d: Disruption) => number): Disruption[] {
  return disruptions
    .filter(d => !d.mitigated && d.cancelShare >= MAJOR_DISRUPTION_SHARE)
    .map(d => ({ d, lost: lostOf(d) }))
    .filter(x => x.lost > 0)
    .sort((a, b) => b.lost - a.lost || (a.d.id < b.d.id ? -1 : a.d.id > b.d.id ? 1 : 0))
    .slice(0, MAX_DISRUPTION_DECISIONS)
    .map(x => x.d);
}

/**
 * The question for one disruption: charter a replacement or cancel. `ref` is
 * the disruption's id. `lost` is the revenue at stake as the forecast sees
 * it now. Neither answer costs anything up front: the charter is billed at
 * the month's close on what it actually saved, so a strike settled or sat
 * out in the meantime is priced in.
 */
export function buildDisruptionDecision(
  d: Disruption,
  monthLabel: string,
  lost: number,
  routeName: (routeId: string) => string
): GameDecision {
  const fee = charterFee(lost);
  const penalty = cancelReputationPenalty(d);
  const pct = Math.round(d.cancelShare * 100);
  const routes = d.routeIds.length === 1
    ? routeName(d.routeIds[0])
    : `${d.routeIds.length} routes`;
  const cause = d.kind === 'technical'
    ? `${d.ref ?? 'An aircraft'} needs unplanned repairs in ${monthLabel}.`
    : d.kind === 'airport-strike'
      ? `Ground staff at ${d.ref ?? 'an airport you serve'} walk out in ${monthLabel}.`
      : `${disruptionTitle(d)} in ${monthLabel}.`;
  return {
    id: `dec_${d.id}`,
    kind: 'disruption',
    ref: d.id,
    title: disruptionTitle(d),
    description:
      `${cause} ${pct}% of the flights on ${routes} would not operate, about ${formatCurrency(lost)} of ticket revenue. ` +
      `The forecast already leaves them out.`,
    options: [
      {
        id: DISRUPTION_OPTION_CHARTER,
        label: 'Charter a replacement aircraft',
        detail:
          `A leased aircraft flies every cancelled flight; passengers notice nothing. Billed with the month's costs at ` +
          `${Math.round(CHARTER_COST_SHARE * 100)}% of the ticket revenue it saves: about ${formatCurrency(fee)} at today's forecast.`,
        cost: 0
      },
      {
        id: DISRUPTION_OPTION_CANCEL,
        label: 'Cancel the flights',
        detail: `Nothing to pay, but stranded passengers cost up to ${penalty} reputation.`,
        cost: 0
      }
    ]
  };
}

/** One line per disruption for the inbox. */
export function describeDisruption(d: Disruption, routeName: (routeId: string) => string): string {
  const pct = Math.round(d.cancelShare * 100);
  const names = d.routeIds.map(routeName);
  const where = names.length <= 4 ? names.join(', ') : `${names.slice(0, 4).join(', ')} and ${names.length - 4} more`;
  const repair = (d.cost ?? 0) > 0 ? ` Repairs: ${formatCurrency(d.cost!)}.` : '';
  return `• ${disruptionTitle(d)}: ${pct}% of flights cancelled on ${where}.${repair}`;
}
