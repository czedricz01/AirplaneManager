/**
 * Connecting passengers: people who fly O -> H on one of the player's routes
 * and change at H onto another of the player's routes to D.
 *
 * Until now every route was priced on its own city pair only, so a hub was
 * worth nothing beyond the sum of its spokes. Here a network earns extra
 * passengers on every O-D market it can serve with one change -- as long as
 * the detour is modest, the timetable actually lets people make the
 * connection, and the aircraft have empty seats left after the local traffic.
 *
 * Everything here applies to the player only. The AI airlines never pass
 * `mods.transfer`, so their economy is untouched.
 *
 * Deterministic by construction: no randomness, and every loop that decides
 * who gets a scarce seat runs in a fixed order.
 */
import { calculateDistance, getAirportStats, type Airport } from '../data/airports';
import {
  calculateBasePrices,
  calculateDemand,
  calculateRouteFinancials,
  getFlightDurationMinutes,
  getFlightTimeClass,
  marketKey,
  marketShare,
  offerAttractiveness,
  type RouteFinancials,
  type RouteOffer
} from './financeUtils';
import { routeDemandFactor, type PlayerModifiers } from './gameState';
import { BOARDING_MIN, WEEK_MIN, getTurnoverMinutes, tripStartMinute, type TripLike } from './scheduleUtils';

/** Shortest change of aircraft a passenger will book, in minutes. */
export const MIN_CONNECTION_MIN = 45;
/** Longest wait at the hub a passenger will still accept, in minutes. */
export const MAX_CONNECTION_MIN = 360;
/** Flown distance over the direct distance beyond which nobody connects. */
export const MAX_DETOUR = 1.6;
/** Share of an O-D market a perfect one-stop connection can win at best. */
export const TRANSFER_DEMAND_SHARE = 0.25;
/** Connecting fares sell below the direct economy fare. */
export const TRANSFER_FARE_FACTOR = 0.9;
/**
 * Cruise speed assumed when classing an O-D market by flight time. The market
 * is the same whichever aircraft happens to serve its legs, and the route
 * planner uses the same stand-in before an aircraft is chosen.
 */
const MARKET_CRUISE_SPEED = { cruiseSpeed: 800 };

// --- Timetable ---------------------------------------------------------------

/** One flight leg, in minutes of the week (Monday 00:00 = 0). */
export interface Leg {
  from: string;
  to: string;
  /** Off-block at `from`, 0 to WEEK_MIN - 1. */
  dep: number;
  /** On-block at `to`, 0 to WEEK_MIN - 1; lower than `dep` when the leg crosses Sunday midnight. */
  arr: number;
}

interface ScheduledRoute {
  id: string;
  origin: string;
  destination: string;
  aircraft?: string;
  distance?: number;
  durMin?: number;
  schedule?: Partial<TripLike>[];
}

// A local copy: the connection check runs millions of times on a large
// network, and a module binding read in that loop is not free everywhere.
const WEEK = WEEK_MIN;

const wrapWeek = (m: number) => ((Math.round(m) % WEEK) + WEEK) % WEEK;

/**
 * Every leg a route flies in a week, following the timetable conventions in
 * scheduleUtils: a trip's block starts with boarding, the outbound leg leaves
 * the origin BOARDING_MIN later, and a round trip's return leg leaves the
 * destination after the turnaround.
 */
export function legTimes(route: ScheduledRoute, aircraft?: { class?: string } | null): Leg[] {
  const legs: Leg[] = [];
  for (const trip of route.schedule || []) {
    const dur = Number(trip.durMin) || Number(route.durMin) || 0;
    const turn = trip.turnoverMin != null && Number.isFinite(Number(trip.turnoverMin))
      ? Number(trip.turnoverMin)
      : getTurnoverMinutes(aircraft?.class);
    const dep = tripStartMinute(trip as TripLike) + BOARDING_MIN;
    const arr = dep + dur;
    legs.push({ from: route.origin, to: route.destination, dep: wrapWeek(dep), arr: wrapWeek(arr) });
    if (!trip.isOneWay) {
      const back = arr + turn;
      legs.push({ from: route.destination, to: route.origin, dep: wrapWeek(back), arr: wrapWeek(back + dur) });
    }
  }
  return legs;
}

/** Minutes from an arrival to a departure, forward round the week. */
export function connectionGap(arrival: number, departure: number): number {
  return (((departure - arrival) % WEEK) + WEEK) % WEEK;
}

/** Whether a passenger arriving at `arrival` can make a departure at `departure`. */
export function isFeasibleConnection(arrival: number, departure: number): boolean {
  const gap = connectionGap(arrival, departure);
  return gap >= MIN_CONNECTION_MIN && gap <= MAX_CONNECTION_MIN;
}

/**
 * Feasible connections per week between legs arriving at a hub and legs
 * leaving it: the arrivals with an onward flight to catch, or the departures
 * with a feeder to wait for, whichever is fewer. That keeps one daily feeder
 * from counting as seven connections just because seven departures follow it.
 */
export function countConnections(arrivals: number[], departures: number[]): number {
  let arrivalsServed = 0;
  for (const a of arrivals) if (departures.some(d => isFeasibleConnection(a, d))) arrivalsServed++;
  let departuresFed = 0;
  for (const d of departures) if (arrivals.some(a => isFeasibleConnection(a, d))) departuresFed++;
  return Math.min(arrivalsServed, departuresFed);
}

// --- Hub quality ---------------------------------------------------------------

/**
 * How well an airport works as a place to change planes, 0.4 to 1: a base
 * for any airport, more for each management tier, a little more for a lounge
 * and for a catering facility.
 */
export function hubQuality(infra: { level?: number; hubFacilities?: { vipLounge?: boolean; catering?: boolean } } | null | undefined): number {
  const level = Math.max(0, Number(infra?.level) || 0);
  const lounge = infra?.hubFacilities?.vipLounge ? 0.05 : 0;
  const catering = infra?.hubFacilities?.catering ? 0.05 : 0;
  return Math.min(1, 0.4 + 0.15 * level + lounge + catering);
}

// --- Flows -------------------------------------------------------------------

/** Passengers per week travelling O -> hub -> D. */
export interface TransferFlow {
  o: string;
  d: string;
  hub: string;
  pax: number;
}

/** What one route carries in connecting passengers per week. */
export interface RouteTransfer {
  pax: number;
  revenue: number;
  /** Largest first. */
  flows: TransferFlow[];
}

/** Connecting passengers changing planes at one airport per week. */
export interface HubTransferStats {
  pax: number;
  /** Largest first. */
  flows: TransferFlow[];
}

export interface TransferResult {
  /** Exactly what calculateRouteFinancials reads from `mods.transfer`. */
  transfer: Record<string, { pax: number; revenue: number }>;
  flowsByRoute: Record<string, RouteTransfer>;
  hubStats: Record<string, HubTransferStats>;
}

export interface TransferContext {
  airportsMap: Map<string, Airport>;
  airportManagement: Record<string, any>;
  year: number;
  month: number;
  difficulty: string;
  /** For the player's demand factor; transfer passengers feel reputation too. */
  mods?: PlayerModifiers;
  /** Rival departures, so a connection shares its O-D market with any direct rival. */
  rivalOffers?: RouteOffer[];
  /** For the turnaround of timetables saved without one. */
  fleet?: { registration: string; class?: string }[];
}

/** The part of a route's result the allocation needs: seats and local passengers. */
type LocalLoad = Pick<RouteFinancials, 'paxByClass'>;

interface Candidate {
  o: string;
  hub: string;
  d: string;
  odKey: string;
  routeA: ScheduledRoute;
  routeB: ScheduledRoute;
  dA: number;
  dB: number;
  fare: number;
  pot: number;
  quality: number;
}

const directionKey = (routeId: string, from: string, to: string) => `${routeId}|${from}>${to}`;

/** Plain code-unit order: fixed across locales, and far cheaper than localeCompare. */
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const flowKey = (f: TransferFlow) => `${f.o}>${f.hub}>${f.d}`;

const byPaxThenKey = (a: TransferFlow, b: TransferFlow) => b.pax - a.pax || cmp(flowKey(a), flowKey(b));

/**
 * One entry per O -> hub -> D, largest first. Two parallel routes feeding the
 * same market each sell part of it, and used to show up as two identical
 * lines -- with the same React key -- on the hub and the onward route.
 */
function mergeFlows(flows: TransferFlow[]): TransferFlow[] {
  const byKey = new Map<string, TransferFlow>();
  for (const f of flows) {
    const hit = byKey.get(flowKey(f));
    if (hit) hit.pax += f.pax;
    else byKey.set(flowKey(f), { ...f });
  }
  return [...byKey.values()].sort(byPaxThenKey);
}

/**
 * Connecting passengers on the player's network.
 *
 * For every airport H and every ordered pair of routes meeting there -- a
 * feeder A from O into H and a different route B from H on to D -- the O-D
 * market's weekly demand in that direction is scaled by
 *   TRANSFER_DEMAND_SHARE x detour factor x hub quality x connection factor x
 *   market share against rivals flying O-D direct,
 * and the result is sold on seats left empty by `localFin`, on both legs.
 * O-D pairs the player already flies direct are left out: those passengers
 * take the direct flight.
 *
 * `localFin` must be the routes' results WITHOUT transfer passengers; its
 * paxByClass gives seats and local passengers per week, both directions.
 */
export function computeTransferFlows(
  routes: ScheduledRoute[],
  localFin: Map<string, LocalLoad>,
  ctx: TransferContext
): TransferResult {
  const result: TransferResult = { transfer: {}, flowsByRoute: {}, hubStats: {} };
  const { airportsMap, airportManagement, year, month, difficulty, mods } = ctx;
  const aircraftByReg = new Map<string, { class?: string }>();
  for (const f of ctx.fleet || []) if (!aircraftByReg.has(f.registration)) aircraftByReg.set(f.registration, f);

  // Only routes that fly: they have a result and both airports exist.
  const active = routes.filter(r =>
    r && localFin.has(r.id) && r.origin !== r.destination && airportsMap.has(r.origin) && airportsMap.has(r.destination)
  );
  if (active.length < 2) return result;

  const directPairs = new Set(active.map(r => marketKey(r.origin, r.destination)));

  // Legs and empty seats per route and direction. paxByClass counts both
  // directions together, so its free seats are split between them in
  // proportion to the legs each way (equal for round trips).
  const arrivalsBy = new Map<string, number[]>();
  const departuresBy = new Map<string, number[]>();
  const freeSeats = new Map<string, number>();
  for (const r of active) {
    const legs = legTimes(r, r.aircraft ? aircraftByReg.get(r.aircraft) : undefined);
    for (const leg of legs) {
      const key = directionKey(r.id, leg.from, leg.to);
      if (!arrivalsBy.has(key)) { arrivalsBy.set(key, []); departuresBy.set(key, []); }
      arrivalsBy.get(key)!.push(leg.arr);
      departuresBy.get(key)!.push(leg.dep);
    }
    let free = 0;
    for (const cls of Object.values(localFin.get(r.id)!.paxByClass || {})) {
      free += Math.max(0, (Number(cls?.max) || 0) - (Number(cls?.actual) || 0));
    }
    const out = legs.filter(l => l.from === r.origin).length;
    const back = legs.length - out;
    freeSeats.set(directionKey(r.id, r.origin, r.destination), legs.length > 0 ? Math.floor(free * out / legs.length) : 0);
    freeSeats.set(directionKey(r.id, r.destination, r.origin), legs.length > 0 ? Math.floor(free * back / legs.length) : 0);
  }

  const routeDistance = (r: ScheduledRoute) => {
    const stored = Number(r.distance);
    if (stored > 0) return stored;
    const a = airportsMap.get(r.origin)!;
    const b = airportsMap.get(r.destination)!;
    return calculateDistance(a.coords[0], a.coords[1], b.coords[0], b.coords[1]);
  };

  // Rival appeal per city pair, built once rather than scanned per market.
  const rivalsByPair = new Map<string, number>();
  for (const offer of ctx.rivalOffers || []) {
    const key = marketKey(offer.origin, offer.destination);
    rivalsByPair.set(key, (rivalsByPair.get(key) || 0) + offerAttractiveness(offer.departures));
  }

  const distanceCache = new Map<string, number>();
  const directDistance = (o: string, d: string) => {
    const key = marketKey(o, d);
    let dist = distanceCache.get(key);
    if (dist === undefined) {
      const ao = airportsMap.get(o)!;
      const ad = airportsMap.get(d)!;
      dist = calculateDistance(ao.coords[0], ao.coords[1], ad.coords[0], ad.coords[1]);
      distanceCache.set(key, dist);
    }
    return dist;
  };

  // Per call only: calculateDemand reads the month's events from module state.
  const marketCache = new Map<string, { demand: number; fare: number; rivals: number }>();
  const market = (o: string, d: string) => {
    const key = marketKey(o, d);
    const hit = marketCache.get(key);
    if (hit) return hit;
    const ao = airportsMap.get(o)!;
    const ad = airportsMap.get(d)!;
    const timeClass = getFlightTimeClass(getFlightDurationMinutes(ao, ad, MARKET_CRUISE_SPEED));
    const so = getAirportStats(ao, year);
    const sd = getAirportStats(ad, year);
    const demand = calculateDemand(
      so.business, so.tourism, sd.business, sd.tourism, timeClass, month, difficulty, year,
      mods ? routeDemandFactor(mods, ao, ad) : 1
    ).total;
    const fare = Math.round(calculateBasePrices(Math.round(directDistance(o, d)), timeClass).economy * TRANSFER_FARE_FACTOR);
    const entry = { demand, fare, rivals: rivalsByPair.get(key) || 0 };
    marketCache.set(key, entry);
    return entry;
  };

  // Routes meeting at each airport. Sorted, so candidates come out in the
  // same order whatever order the routes were passed in.
  const atAirport = new Map<string, ScheduledRoute[]>();
  for (const r of active) {
    for (const id of [r.origin, r.destination]) {
      if (!atAirport.has(id)) atAirport.set(id, []);
      atAirport.get(id)!.push(r);
    }
  }
  const hubs = [...atAirport.keys()].sort();

  const candidates: Candidate[] = [];
  for (const hub of hubs) {
    const spokes = atAirport.get(hub)!.slice().sort((a, b) => cmp(a.id, b.id));
    if (spokes.length < 2) continue;
    const quality = hubQuality(airportManagement?.[hub]);
    for (const routeA of spokes) {
      const o = routeA.origin === hub ? routeA.destination : routeA.origin;
      const arrivals = arrivalsBy.get(directionKey(routeA.id, o, hub));
      if (!arrivals) continue;
      const dA = routeDistance(routeA);
      for (const routeB of spokes) {
        if (routeB.id === routeA.id) continue;
        const d = routeB.origin === hub ? routeB.destination : routeB.origin;
        if (d === o || directPairs.has(marketKey(o, d))) continue;

        const dB = routeDistance(routeB);
        const dOD = directDistance(o, d);
        if (!(dOD > 0)) continue;
        const detour = (dA + dB) / dOD;
        if (detour > MAX_DETOUR) continue;
        const detourF = Math.min(1, 1 - (detour - 1) / (MAX_DETOUR - 1));

        const departures = departuresBy.get(directionKey(routeB.id, hub, d));
        if (!departures) continue;
        const conn = countConnections(arrivals, departures);
        if (conn === 0) continue;
        const connF = Math.min(1, conn / Math.min(arrivals.length, departures.length));

        const m = market(o, d);
        const share = marketShare(offerAttractiveness(conn), m.rivals);
        // calculateDemand is both directions of the market; this is one.
        const pot = Math.floor((m.demand / 2) * TRANSFER_DEMAND_SHARE * detourF * quality * connF * share);
        if (pot <= 0) continue;

        candidates.push({
          o, hub, d, odKey: `${o}>${d}`, routeA, routeB, dA, dB,
          fare: m.fare, pot, quality: detourF * quality * connF
        });
      }
    }
  }
  if (candidates.length === 0) return result;

  // Two ways to connect the same O-D (two hubs, or two parallel feeders)
  // share one market rather than each selling the whole of it: the best
  // path's potential is the budget, and better paths fill it first.
  const budget = new Map<string, number>();
  for (const c of candidates) budget.set(c.odKey, Math.max(budget.get(c.odKey) || 0, c.pot));

  // Scarce seats go to the dearest tickets first; ties in a fixed order.
  candidates.sort((a, b) =>
    b.fare - a.fare
    || cmp(a.odKey, b.odKey)
    || b.quality - a.quality
    || cmp(a.hub, b.hub)
    || cmp(a.routeA.id, b.routeA.id)
    || cmp(a.routeB.id, b.routeB.id)
  );

  const addToRoute = (routeId: string, flow: TransferFlow, revenue: number) => {
    const entry = result.flowsByRoute[routeId] || (result.flowsByRoute[routeId] = { pax: 0, revenue: 0, flows: [] });
    entry.pax += flow.pax;
    entry.revenue += revenue;
    entry.flows.push(flow);
  };

  for (const c of candidates) {
    const keyA = directionKey(c.routeA.id, c.o, c.hub);
    const keyB = directionKey(c.routeB.id, c.hub, c.d);
    const take = Math.min(c.pot, budget.get(c.odKey) || 0, freeSeats.get(keyA) || 0, freeSeats.get(keyB) || 0);
    if (take <= 0) continue;
    budget.set(c.odKey, budget.get(c.odKey)! - take);
    freeSeats.set(keyA, freeSeats.get(keyA)! - take);
    freeSeats.set(keyB, freeSeats.get(keyB)! - take);

    const flow: TransferFlow = { o: c.o, d: c.d, hub: c.hub, pax: take };
    // The fare is shared between the two legs by distance flown.
    const revenue = take * c.fare;
    const splitA = c.dA / (c.dA + c.dB);
    addToRoute(c.routeA.id, flow, revenue * splitA);
    addToRoute(c.routeB.id, flow, revenue * (1 - splitA));

    const hubEntry = result.hubStats[c.hub] || (result.hubStats[c.hub] = { pax: 0, flows: [] });
    hubEntry.pax += take;
    hubEntry.flows.push(flow);
  }

  for (const [id, entry] of Object.entries(result.flowsByRoute)) {
    // Whole dollars, so adding it to a route's revenue is exact.
    entry.revenue = Math.round(entry.revenue);
    entry.flows = mergeFlows(entry.flows);
    result.transfer[id] = { pax: entry.pax, revenue: entry.revenue };
  }
  for (const entry of Object.values(result.hubStats)) entry.flows = mergeFlows(entry.flows);
  return result;
}

// --- The network, priced as one ---------------------------------------------

export interface NetworkEnv {
  fuelPrice: number;
  airportManagement: Record<string, any>;
  year: number;
  month: number;
  difficulty: string;
  airportsMap: Map<string, Airport>;
  rivalOffers?: RouteOffer[];
}

export interface NetworkFinancials extends TransferResult {
  /** Every route with an aircraft, transfer passengers included. */
  finById: Map<string, RouteFinancials>;
}

/**
 * The single entry point for pricing the player's routes: the route list,
 * the monthly report, next month's forecast and the route planner's preview
 * all come through here, so none of them can disagree about transfers.
 *
 *   1. Every route on its own, without connecting passengers.
 *   2. The connecting flows those results leave room for.
 *   3. The routes that carry any of them, again, with `mods.transfer`.
 *
 * A route without connecting passengers keeps its first result, which is
 * exactly what calculateRouteFinancials gave it before transfers existed.
 */
export function computeNetworkFinancials(
  routes: any[],
  fleet: any[],
  mods: PlayerModifiers,
  env: NetworkEnv
): NetworkFinancials {
  const aircraftByReg = new Map<string, any>();
  for (const f of fleet || []) if (!aircraftByReg.has(f.registration)) aircraftByReg.set(f.registration, f);
  const rivalOffers = env.rivalOffers || [];
  // Transfers are an output of this function; a stale set passed in must not
  // leak into the local pass.
  const { transfer: _stale, ...localMods } = mods;

  const price = (route: any, aircraft: any, m: PlayerModifiers) => calculateRouteFinancials(
    route, aircraft, env.fuelPrice, env.airportManagement, env.year, env.month, env.difficulty,
    env.airportsMap, routes, fleet, false, m.demandFactor, rivalOffers, m
  );

  const finById = new Map<string, RouteFinancials>();
  for (const r of routes) {
    const aircraft = aircraftByReg.get(r.aircraft);
    if (aircraft) finById.set(r.id, price(r, aircraft, localMods));
  }

  const flows = computeTransferFlows(routes, finById, {
    airportsMap: env.airportsMap,
    airportManagement: env.airportManagement,
    year: env.year,
    month: env.month,
    difficulty: env.difficulty,
    mods: localMods,
    rivalOffers,
    fleet
  });

  const withTransfer: PlayerModifiers = { ...localMods, transfer: flows.transfer };
  for (const r of routes) {
    if (!flows.transfer[r.id]) continue;
    finById.set(r.id, price(r, aircraftByReg.get(r.aircraft), withTransfer));
  }

  return { finById, ...flows };
}

// --- The route planner ---------------------------------------------------------

/**
 * The player's routes with a draft put in: in place of the saved route with
 * the same id when that route is being edited, so it is not counted twice, or
 * added at the end when it is new.
 */
export function withDraftRoute<T extends { id: string }>(routes: T[], draft: T): T[] {
  return routes.some(r => r.id === draft.id)
    ? routes.map(r => (r.id === draft.id ? draft : r))
    : [...routes, draft];
}

export interface DraftPricing {
  /** The draft's result, connecting passengers included. */
  fin: RouteFinancials;
  /** Its connecting passengers, as computeNetworkFinancials hands them to the engine. */
  transfer: { pax: number; revenue: number } | undefined;
}

/**
 * A route the planner is drafting, priced inside the player's network exactly
 * as the monthly report will price it once it is saved.
 *
 * The draft must name its aircraft's registration in `aircraft`:
 * computeNetworkFinancials prices only routes whose aircraft it finds in the
 * fleet. The planner's draft used to have none, so it was silently left out
 * of the network, and its preview never included a connecting passenger while
 * the route list, once saved, did.
 *
 * Null when the draft's aircraft is not in the fleet.
 */
export function priceDraftInNetwork(
  draft: any,
  routes: any[],
  fleet: any[],
  mods: PlayerModifiers,
  env: NetworkEnv
): DraftPricing | null {
  const network = computeNetworkFinancials(withDraftRoute(routes, draft), fleet, mods, env);
  const fin = network.finById.get(draft.id);
  return fin ? { fin, transfer: network.transfer[draft.id] } : null;
}
