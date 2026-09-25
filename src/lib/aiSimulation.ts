/**
 * The rival airlines: how they are founded and how they play a month.
 *
 * This lived inside App.tsx, where nothing could test it -- which is how the
 * whole AI economy ended up running on a fallback constant (see
 * buildAiSimAircraft below). It is plain data in, data out, so it can now be
 * exercised without a browser.
 *
 * Rivals decide the way an airline planner would: a new route or a new
 * aircraft is only taken on when the same finance engine that books the
 * month says it will pay, frequencies follow what the aircraft can actually
 * fly in a week, and routes that keep losing money are dropped.
 */
import { calculateDistance, getAirportStats } from '../data/airports';
import { airports as eraAirports, airportsMapAdjusted } from '../data/airportRegistry';
import type { Airport } from '../data/airportTypes';
import { aircraftList, type Aircraft } from '../data/aircraft';
import { REAL_AIRLINES, FICTIONAL_AIRLINES, isActiveIn, type RivalPersonality } from '../data/rivalAirlines';
import {
  calculateRouteFinancials,
  getFlightTimeClass,
  calculateBasePrices,
  getJetFuelPrice,
  getFlightDurationMinutes,
  getAircraftResaleValue,
  RouteOffer
} from './financeUtils';
import { blockMinutes, getTurnoverMinutes } from './scheduleUtils';
import type { AiAirline } from '../components/CompetitorsView';
import type { GameMessage } from './gameTypes';
import { findNonFinite } from './invariants';
import { logWarn, logError } from './debugLog';
import { nextMessageId } from './messages';

/**
 * Fixed monthly income every AI airline receives on top of its route results,
 * so that rivals do not all go bankrupt early. Shown on the rivals screen,
 * because it is part of every AI profit figure there.
 */
export const AI_MONTHLY_SUBSIDY = 450_000;

type Personality = RivalPersonality;
type Difficulty = 'Easy' | 'Normal' | 'Hard';
type AiPlane = AiAirline['fleet'][number];
type AiRoute = AiAirline['routes'][number];

const PERSONALITIES: Personality[] = ['flag', 'lcc', 'expansionist', 'optimizer', 'boutique'];
const AGGRESSION: Record<Personality, number> = { expansionist: 9, lcc: 8, flag: 6, optimizer: 4, boutique: 5 };

/** One-off cost of opening a route: slots, staff, marketing. */
const ROUTE_OPENING_COST = 1_500_000;

/** Below this distance nobody opens a route; road and rail win. */
const MIN_ROUTE_KM = 150;

/**
 * Minutes per week an aircraft can be scheduled. Airports close at night, so
 * an aircraft is planned for 18 hours a day, not 24.
 */
const OPERATING_MIN_PER_WEEK = 7 * 18 * 60;

/** Three departures a day is the most any single aircraft is given. */
const MAX_WEEKLY_ROTATIONS = 21;

/**
 * How many destinations a rival works through before it picks one. The
 * cheaper the difficulty, the fewer options it looks at.
 */
const SEARCH_WIDTH: Record<Difficulty, number> = { Easy: 4, Normal: 8, Hard: 12 };

/**
 * How far off an airline's profit forecast may be. Hard rivals plan with the
 * real numbers, easy ones misjudge routes by up to 40 %.
 */
const FORECAST_NOISE: Record<Difficulty, number> = { Easy: 0.4, Normal: 0.1, Hard: 0 };

/**
 * Months a route gets to prove itself before a rival judges it. Optimizers
 * cut quickly, prestige carriers keep a route longer.
 */
const PATIENCE_MONTHS: Record<Personality, number> = { optimizer: 3, lcc: 4, expansionist: 5, flag: 6, boutique: 6 };

/**
 * A carrier never cuts its network below this many routes on its own. The
 * last routes out of the home base are kept through a bad spell (the
 * monthly subsidy covers them); only running out of cash forces them.
 */
const CORE_NETWORK = 2;

/**
 * Weekly departures a rival can get at its home base, per airport level. The
 * AI does not buy slots the way the player does, so without a limit an
 * airline that plays the market well grew without end (billions within ten
 * game years). Real carriers are capped by the slots at their hub too.
 */
const HUB_SLOTS_PER_LEVEL = 40;

/** Months an aircraft may stand idle before it is sold. */
const MAX_IDLE_MONTHS = 6;

/** Cash an airline keeps back after buying an aircraft. */
const CASH_RESERVE: Record<Personality, number> = {
  flag: 10_000_000, boutique: 10_000_000, optimizer: 10_000_000, lcc: 5_000_000, expansionist: 5_000_000
};

const yearOf = (offset: number) => 1960 + Math.floor(offset / 12);
const monthOf = (offset: number) => 1 + (offset % 12);

const specById = new Map<string, Aircraft>(aircraftList.map(a => [a.id, a]));

/**
 * Interior quality an AI cabin is assumed to have, per strategy. The player's
 * aircraft carry this from the purchase screen; AI aircraft never went through
 * it, so the field was simply missing -- and a missing field made getPlaneSat
 * return NaN, which turned every AI route's result into NaN.
 */
export const AI_INTERIOR_POP: Record<Personality, number> = {
  flag: 70,
  boutique: 78,
  optimizer: 58,
  expansionist: 50,
  lcc: 42
};

/**
 * The aircraft object the finance engine needs for an AI route.
 *
 * It used to be assembled without `baseInteriorPop` and `conditionInterior`.
 * getPlaneSat multiplied undefined into NaN, Math.max(1, NaN) is NaN, and so
 * every passenger count and revenue figure became NaN. The month loop then
 * replaced the NaN with a hard-coded 100,000, so every rival route in the game
 * earned exactly that, whatever it flew.
 */
export function buildAiSimAircraft(plane: AiPlane, personality: Personality) {
  const cap = plane.capacity || 131;
  return {
    capacity: cap,
    efficiency: plane.efficiency || 50,
    popularity: plane.popularity || 70,
    baseInteriorPop: AI_INTERIOR_POP[personality] ?? 55,
    conditionInterior: plane.conditionInterior ?? 100,
    conditionGeneral: plane.conditionGeneral ?? 100,
    class: plane.class ? (plane.class.charAt(0).toUpperCase() + plane.class.slice(1)) : 'Narrowbody',
    registration: plane.reg,
    config: plane.config || {
      economy: Math.floor(cap * 0.85),
      premium: Math.floor(cap * 0.10),
      business: Math.floor(cap * 0.04),
      first: Math.max(0, cap - Math.floor(cap * 0.85) - Math.floor(cap * 0.10) - Math.floor(cap * 0.04))
    }
  };
}

/**
 * Seat split per strategy: [economy, premium, business, first], where a
 * first share of -1 means "whatever is left". This used to be written out
 * three times, once each for starting, replacement and purchased aircraft.
 */
const CABIN_SHARES: Record<Personality, [number, number, number, number]> = {
  lcc: [0.96, 0.04, 0, 0],
  flag: [0.65, 0.15, 0.12, -1],
  boutique: [0.45, 0.25, 0.20, -1],
  optimizer: [0.76, 0.14, 0.07, -1],
  expansionist: [0.88, 0.08, 0.04, 0]
};

export function cabinConfigFor(personality: Personality, capacity: number) {
  const [e, p, b, f] = CABIN_SHARES[personality] ?? CABIN_SHARES.optimizer;
  const config = {
    economy: Math.floor(capacity * e),
    premium: Math.floor(capacity * p),
    business: Math.floor(capacity * b),
    first: 0
  };
  if (f < 0) config.first = capacity - config.economy - config.premium - config.business;
  // Rounding leftovers go to economy, so the seats always add up to capacity.
  config.economy += capacity - (config.economy + config.premium + config.business + config.first);
  return config;
}

/**
 * Easy rivals buy aircraft with a deliberately poor, premium-heavy cabin.
 * It is part of what makes them easy, so it stays.
 */
function easyCabinConfig(capacity: number, variant: number) {
  const config = { economy: 0, premium: 0, business: 0, first: 0 };
  if (variant % 2 === 0) {
    config.first = Math.floor(capacity * 0.85);
    config.economy = capacity - config.first;
  } else {
    config.premium = Math.floor(capacity * 0.50);
    config.business = Math.floor(capacity * 0.38);
    config.economy = capacity - config.premium - config.business;
  }
  return config;
}

function toFleetEntry(spec: Aircraft, reg: string, offset: number, config: AiPlane['config']): AiPlane {
  return {
    id: spec.id,
    manufacturer: spec.manufacturer,
    family: spec.family,
    type: spec.type,
    class: spec.class.toLowerCase() as AiPlane['class'],
    reg,
    maxRange: spec.maxRange,
    capacity: spec.capacity,
    basePrice: spec.basePrice,
    popularity: spec.popularity,
    efficiency: spec.efficiency,
    cruiseSpeed: spec.cruiseSpeed,
    purchasedAt: offset,
    conditionInterior: 100,
    conditionGeneral: 100,
    config
  };
}

/** Aircraft a customer can take delivery of in this month. */
function aircraftOnMarket(offset: number): Aircraft[] {
  return aircraftList.filter(a =>
    offset >= a.firstDeliveryOffset && (a.lastDeliveryOffset === null || offset <= a.lastDeliveryOffset)
  );
}

/** The player's rule for runways: the aircraft's ICAO code must fit the airport. */
function fitsAirport(plane: AiPlane, airport: Airport): boolean {
  const icao = specById.get(plane.id)?.icaoCode;
  return !icao || !airport.maxIcaoCode || icao <= airport.maxIcaoCode;
}

/**
 * Most round trips per week one aircraft can fly on a route: boarding, both
 * legs and the turnaround at the far end, within the airport opening hours.
 * Rivals used to fly 10 to 20 round trips a week on any route, including
 * ten-hour sectors a single aircraft could fly five times at most.
 */
export function maxWeeklyRotations(durMin: number, aircraftClass: string | undefined): number {
  const block = blockMinutes({ durMin, turnoverMin: getTurnoverMinutes(aircraftClass), isOneWay: false });
  if (!Number.isFinite(block) || block <= 0) return 1;
  return Math.max(1, Math.min(MAX_WEEKLY_ROTATIONS, Math.floor(OPERATING_MIN_PER_WEEK / block)));
}

/** Catering and onboard service per strategy. LCCs sell everything onboard. */
const serviceCache = new Map<Personality, ReturnType<typeof buildService>>();
function serviceFor(personality: Personality) {
  let s = serviceCache.get(personality);
  if (!s) serviceCache.set(personality, s = buildService(personality));
  return s;
}

function buildService(personality: Personality) {
  if (personality === 'flag') {
    return {
      economy: { catering: [['b15']], extras: ['water', 'pillows'], service: ['none'] },
      premium: { catering: [['s13']], extras: ['softdrinks', 'headphones', 'pillows'], service: ['drinks'] },
      business: { catering: [['p6', 's1']], extras: ['alcohol', 'amenities', 'headphones'], service: ['drinks', 'seat_coord'] },
      first: { catering: [['l13', 'p15']], extras: ['premium_alcohol', 'amenities_luxury', 'headphones', 'pajamas'], service: ['dine_demand', 'turndown'] }
    };
  }
  if (personality === 'boutique') {
    return {
      economy: { catering: [['b14']], extras: ['water'], service: ['none'] },
      premium: { catering: [['s9']], extras: ['softdrinks', 'pillows'], service: ['drinks'] },
      business: { catering: [['p9', 'p2']], extras: ['alcohol', 'amenities_premium', 'headphones'], service: ['dine_demand'] },
      first: { catering: [['l14', 'l4']], extras: ['premium_alcohol', 'amenities_luxury', 'pajamas'], service: ['dine_demand', 'turndown'] }
    };
  }
  if (personality === 'optimizer') {
    return {
      economy: { catering: [['b5']], extras: ['water'], service: ['none'] },
      premium: { catering: [['s8']], extras: ['softdrinks', 'pillows'], service: ['drinks'] },
      business: { catering: [['p6']], extras: ['alcohol', 'amenities'], service: ['drinks'] },
      first: { catering: [['l12']], extras: ['premium_alcohol', 'amenities_premium'], service: ['dine_demand'] }
    };
  }
  if (personality === 'expansionist') {
    return {
      economy: { catering: [['none']], extras: ['none'], service: ['none'] },
      premium: { catering: [['b14']], extras: ['water'], service: ['none'] },
      business: { catering: [['s10']], extras: ['softdrinks', 'pillows'], service: ['drinks'] },
      first: { catering: [['p5']], extras: ['alcohol', 'amenities'], service: ['drinks'] }
    };
  }
  return {
    economy: { catering: [['none']], extras: ['none'], service: ['none'] },
    premium: { catering: [['none']], extras: ['none'], service: ['none'] },
    business: { catering: [['none']], extras: ['none'], service: ['none'] },
    first: { catering: [['none']], extras: ['none'], service: ['none'] }
  };
}

/** Fares relative to the base price, per strategy. Easy rivals overcharge. */
function ticketPricesFor(personality: Personality, difficulty: Difficulty, distance: number, durMin: number) {
  const bases = calculateBasePrices(distance, getFlightTimeClass(durMin));
  const f: [number, number, number, number] =
    difficulty === 'Easy' ? [2.25, 2.30, 2.40, 2.50]
    : personality === 'lcc' ? [0.82, 0.85, 1, 1]
    : personality === 'flag' ? [1.05, 1.10, 1.14, 1.18]
    : personality === 'boutique' ? [1.02, 1.14, 1.25, 1.35]
    : personality === 'optimizer' ? [1.04, 1.04, 1.06, 1.06]
    : [0.92, 0.94, 0.95, 1];
  return {
    economy: Math.round(bases.economy * f[0]),
    premium: Math.round(bases.premium * f[1]),
    business: Math.round(bases.business * f[2]),
    first: Math.round(bases.first * f[3])
  };
}

/** Everything about the month that is the same for all of one airline's routes. */
interface Market {
  offset: number;
  fuelPrice: number;
  /** Other airlines' offers (the player and the other rivals, never this one). */
  rivalOffers: RouteOffer[];
}

/**
 * Monthly result of one route, from the same finance engine the player's
 * routes use. Used both to book a month and to forecast a route, so a rival's
 * plan and its books cannot disagree. NaN when the engine fails.
 */
function routeMonthlyProfit(
  personality: Personality,
  difficulty: Difficulty,
  plane: AiPlane,
  origin: Airport,
  dest: Airport,
  departures: number,
  distance: number,
  durMin: number,
  market: Market,
  label: string
): number {
  const aircraftSimObj = buildAiSimAircraft(plane, personality);
  const routeSimObj = {
    origin: origin.id,
    destination: dest.id,
    distance,
    durMin,
    schedule: Array(departures).fill({ isOneWay: false }),
    classConfigs: serviceFor(personality),
    ticketPrices: ticketPricesFor(personality, difficulty, distance, durMin)
  };

  const aiAirportManagement: Record<string, any> = {
    [origin.id]: {
      level: 3,
      slots: { regional: 100, narrowbody: 100, widebody: 100 },
      stands: { regional: 100, narrowbody: 100, widebody: 100 },
      desks: { normal: 10, self: 10 }
    },
    [dest.id]: {
      level: 2,
      slots: { regional: 100, narrowbody: 100, widebody: 100 },
      stands: { regional: 100, narrowbody: 100, widebody: 100 },
      desks: { normal: 5, self: 5 }
    }
  };

  try {
    const finObj = calculateRouteFinancials(
      routeSimObj,
      aircraftSimObj,
      market.fuelPrice,
      aiAirportManagement,
      yearOf(market.offset),
      monthOf(market.offset),
      difficulty,
      airportsMapAdjusted,
      [],
      [aircraftSimObj],
      false,
      1,
      market.rivalOffers
    );
    const monthly = Math.floor(finObj.estWeeklyProfit * 4);
    // A non-finite result is a bug in the inputs, not a result: report it
    // rather than inventing a profit as the old fallback did.
    if (!Number.isFinite(monthly)) logWarn('ai', `Non-finite result for ${label}`, findNonFinite(finObj));
    return monthly;
  } catch (err) {
    logError('ai', `Route calculation failed for ${label}`, err);
    return NaN;
  }
}

export interface RoutePlan {
  dest: Airport;
  departures: number;
  distance: number;
  durMin: number;
  /** Forecast monthly profit at that frequency. */
  profit: number;
}

/**
 * The best route this aircraft could fly out of the hub.
 *
 * Destinations are first ranked cheaply by the demand between the two cities,
 * weighted by what the airline sells (business travel for flag carriers,
 * holidays for low-cost ones), discounted for competitors already on the pair
 * and for sectors far too short for the aircraft. The best few are then run
 * through the finance engine at several frequencies, and the most profitable
 * combination wins. Returns null when the aircraft reaches nothing.
 */
export function planRoute(
  personality: Personality,
  difficulty: Difficulty,
  plane: AiPlane,
  hub: Airport,
  exclude: Set<string>,
  market: Market,
  candidates: Airport[] = eraAirports,
  /** Hub slots still free: no plan uses more departures than this. */
  maxDepartures: number = MAX_WEEKLY_ROTATIONS
): RoutePlan | null {
  if (maxDepartures < 1) return null;
  const range = plane.maxRange || specById.get(plane.id)?.maxRange || 0;
  if (range < MIN_ROUTE_KM || !fitsAirport(plane, hub)) return null;

  const year = yearOf(market.offset);
  const hs = getAirportStats(hub, year);

  // Competition per destination, and only the offers that touch this hub:
  // the finance engine scans the whole list on every call.
  const offersHere = market.rivalOffers.filter(o => o.origin === hub.id || o.destination === hub.id);
  const rivalDeps = new Map<string, number>();
  for (const o of offersHere) {
    const other = o.origin === hub.id ? o.destination : o.origin;
    rivalDeps.set(other, (rivalDeps.get(other) || 0) + (o.departures || 0));
  }

  const weigh = (s: { business: number; tourism: number }) =>
    personality === 'flag' || personality === 'boutique' ? s.business * 1.5 + s.tourism * 0.5
    : personality === 'lcc' ? s.business * 0.6 + s.tourism * 1.4
    : s.business + s.tourism;
  const hubWeight = weigh(hs);

  const ranked: { airport: Airport; distance: number; score: number }[] = [];
  for (const a of candidates) {
    if (a.id === hub.id || exclude.has(a.id) || !fitsAirport(plane, a)) continue;
    const distance = Math.floor(calculateDistance(hub.coords[0], hub.coords[1], a.coords[0], a.coords[1]));
    if (distance < MIN_ROUTE_KM || distance > range) continue;
    let score = Math.sqrt(Math.max(0, hubWeight * weigh(getAirportStats(a, year))));
    // A long-range aircraft on a short hop wastes its range and its size.
    score *= Math.min(1, distance / (range * 0.2));
    // Low-cost carriers stay short and medium haul.
    if (personality === 'lcc' && distance > 3500) score *= 0.4;
    score /= 1 + (rivalDeps.get(a.id) || 0) / 14;
    if (score > 0) ranked.push({ airport: a, distance, score });
  }
  if (ranked.length === 0) return null;
  ranked.sort((x, y) => y.score - x.score);

  const width = SEARCH_WIDTH[difficulty] ?? SEARCH_WIDTH.Normal;
  const shortlist = ranked.slice(0, width);
  // Two wildcards, so rivals sometimes find what the ranking undervalues.
  for (let i = 0; i < 2 && ranked.length > width; i++) {
    shortlist.push(ranked[width + Math.floor(Math.random() * (ranked.length - width))]);
  }

  const noise = FORECAST_NOISE[difficulty] ?? 0;
  let best: RoutePlan | null = null;
  let bestJudged = -Infinity;
  for (const c of shortlist) {
    const durMin = getFlightDurationMinutes(hub, c.airport, plane);
    const max = maxWeeklyRotations(durMin, plane.class);
    const options = [...new Set([max, Math.round(max * 0.6), Math.round(max * 0.3)])]
      .map(d => Math.min(d, maxDepartures))
      .filter((d, i, all) => d >= 1 && all.indexOf(d) === i);
    for (const departures of options) {
      const profit = routeMonthlyProfit(
        personality, difficulty, plane, hub, c.airport, departures, c.distance, durMin,
        { ...market, rivalOffers: offersHere }, `plan ${hub.id}-${c.airport.id}`
      );
      if (!Number.isFinite(profit)) continue;
      const judged = profit + Math.abs(profit) * noise * (Math.random() * 2 - 1);
      if (judged > bestJudged) {
        bestJudged = judged;
        best = { dest: c.airport, departures, distance: c.distance, durMin, profit };
      }
    }
  }
  return best;
}

function newRoute(hubId: string, plane: AiPlane, plan: RoutePlan, offset: number): AiRoute {
  return {
    origin: hubId,
    destination: plan.dest.id,
    aircraft: plane.id,
    aircraftReg: plane.reg,
    aircraftClass: plane.class,
    departures: plan.departures,
    monthlyProfit: 0,
    distance: plan.distance,
    durMin: plan.durMin,
    openedAt: offset,
    avgProfit: plan.profit
  };
}

/** Random pick, weighted. Returns -1 for an empty or all-zero list. */
function weightedIndex(weights: number[]): number {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return -1;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

const airportDemand = (a: Airport | undefined, year: number) => {
  const s = getAirportStats(a, year);
  return s.business + s.tourism;
};

interface RivalIdentity {
  name: string;
  code: string;
  hub: string;
  personality: Personality;
  isReal: boolean;
}

/**
 * Who competes: a mix of real and fictional airlines.
 *
 * Real airlines only appear in years they actually flew and always start at
 * their real hub. A real airline whose hub is the player's hub is left out
 * altogether (a Frankfurt player gets no Lufthansa), rather than being moved
 * somewhere it never was. No two rivals share a hub, and none starts at the
 * player's hub. Fictional airlines take the busiest free airports.
 */
export function pickRivalIdentities(count: number, playerHubId: string, year: number, playerCode = ''): RivalIdentity[] {
  if (count <= 0) return [];
  const usedHubs = new Set<string>([playerHubId]);
  const usedCodes = new Set<string>(playerCode ? [playerCode.toUpperCase()] : []);
  const out: RivalIdentity[] = [];

  let fictionalWanted = count === 1
    ? (Math.random() < 0.4 ? 1 : 0)
    : Math.max(1, Math.round(count * (0.3 + Math.random() * 0.2)));
  const realWanted = count - fictionalWanted;

  const realPool = REAL_AIRLINES.filter(a =>
    isActiveIn(a, year) && a.hub !== playerHubId && airportsMapAdjusted.has(a.hub)
  );
  while (out.length < realWanted) {
    const open = realPool.filter(a => !usedHubs.has(a.hub) && !usedCodes.has(a.code));
    // Big hubs come up more often, so the familiar names are usually there.
    const i = weightedIndex(open.map(a => Math.sqrt(airportDemand(airportsMapAdjusted.get(a.hub), year))));
    if (i < 0) break;
    const a = open[i];
    usedHubs.add(a.hub);
    usedCodes.add(a.code);
    out.push({ name: a.name, code: a.code, hub: a.hub, personality: a.personality, isReal: true });
  }
  // Not enough real airlines for this year: fictional ones fill the gap.
  fictionalWanted = count - out.length;

  const realCodes = new Set(REAL_AIRLINES.map(a => a.code));
  const names = [...FICTIONAL_AIRLINES]
    .filter(f => !realCodes.has(f.code) && !usedCodes.has(f.code))
    .sort(() => Math.random() - 0.5);
  const personalities = [...PERSONALITIES].sort(() => Math.random() - 0.5);
  for (let n = 0; n < fictionalWanted && n < names.length; n++) {
    let hubs = eraAirports.filter(a => a.level >= 4 && !usedHubs.has(a.id));
    if (hubs.length === 0) hubs = eraAirports.filter(a => a.level >= 2 && !usedHubs.has(a.id));
    const i = weightedIndex(hubs.map(a => airportDemand(a, year)));
    if (i < 0) break;
    const hub = hubs[i];
    usedHubs.add(hub.id);
    usedCodes.add(names[n].code);
    out.push({ name: names[n].name, code: names[n].code, hub: hub.id, personality: personalities[n % personalities.length], isReal: false });
  }

  return out.sort(() => Math.random() - 0.5);
}

/** A starting aircraft of the wanted class, chosen the way this strategy would. */
function pickStartingAircraft(personality: Personality, wantedClass: string, offset: number): Aircraft {
  const options = aircraftOnMarket(offset).filter(a => a.class.toLowerCase() === wantedClass);
  const score = (a: Aircraft) => {
    let s = a.popularity - (offset - a.firstDeliveryOffset) * 0.2;
    if (personality === 'lcc') s += (a.capacity || 100) * 0.15 + (a.efficiency || 50) * 0.6;
    else if (personality === 'flag') s += (a.popularity || 50) * 1.5;
    else if (personality === 'boutique') s += (a.maxRange || 1000) * 0.02;
    else if (personality === 'optimizer') s += (a.efficiency || 50) * 1.2;
    // Some variation so rivals do not all fly the same type.
    return s + (Math.random() - 0.5) * 15;
  };
  const scored = options.map(a => ({ a, s: score(a) })).sort((x, y) => y.s - x.s);
  return scored[0]?.a
    || aircraftOnMarket(offset)[0]
    || aircraftList.find(a => a.class.toLowerCase() === wantedClass)
    || aircraftList[0];
}

export const generateAiAirlines = (
  count: number,
  difficultyVal: string,
  playerHubId: string,
  startDateOffset: number = 0,
  /** The player's airline code, which no rival may carry. */
  playerCode: string = ''
): AiAirline[] => {
  const difficulty = (['Easy', 'Normal', 'Hard'].includes(difficultyVal) ? difficultyVal : 'Normal') as Difficulty;
  const identities = pickRivalIdentities(count, playerHubId, yearOf(startDateOffset), playerCode);

  // Routes of the rivals generated so far, so later ones plan around them
  // instead of all opening the same obvious route.
  const offers: RouteOffer[] = [];
  const result: AiAirline[] = [];

  for (const who of identities) {
    const { personality } = who;

    // Capital Reserves Variation based on personality + realistic small random noise
    const baseCapitalScale = difficulty === 'Hard' ? 120000000 : difficulty === 'Normal' ? 80000000 : 50000000;
    let prestigeMultiplier = 1.0;
    if (personality === 'flag') prestigeMultiplier = 1.25;
    else if (personality === 'boutique') prestigeMultiplier = 1.12;
    else if (personality === 'lcc') prestigeMultiplier = 0.88;
    else if (personality === 'expansionist') prestigeMultiplier = 0.94;
    const noise = Math.floor((Math.random() - 0.5) * 6000000); // ±3,000,000
    const capital = Math.floor(baseCapitalScale * prestigeMultiplier + noise);

    const fleet: AiPlane[] = [];
    const numInitialPlanes = difficulty === 'Hard' ? 4 : difficulty === 'Normal' ? 3 : 2;
    for (let i = 0; i < numInitialPlanes; i++) {
      const wantedClass = i > 0 || difficulty === 'Easy' ? 'regional' : 'narrowbody';
      const spec = pickStartingAircraft(personality, wantedClass, startDateOffset);
      fleet.push(toFleetEntry(spec, `${who.code}-A${100 + i}`, startDateOffset, cabinConfigFor(personality, spec.capacity || 131)));
    }

    // Every starting aircraft gets the best route it can find. The old code
    // gave the first two a route and parked the rest.
    const routes: AiRoute[] = [];
    const hubAirport = airportsMapAdjusted.get(who.hub);
    if (hubAirport) {
      const market: Market = {
        offset: startDateOffset,
        fuelPrice: getJetFuelPrice(yearOf(startDateOffset), monthOf(startDateOffset), difficulty),
        rivalOffers: offers
      };
      const served = new Set<string>();
      for (const plane of fleet) {
        const plan = planRoute(personality, difficulty, plane, hubAirport, served, market);
        if (!plan) continue;
        served.add(plan.dest.id);
        routes.push(newRoute(who.hub, plane, plan, startDateOffset));
      }
    }
    for (const r of routes) offers.push({ origin: r.origin, destination: r.destination, departures: r.departures });

    result.push({
      id: `ai_${who.code.toLowerCase()}`,
      name: who.name,
      code: who.code,
      hub: who.hub,
      isReal: who.isReal,
      capital,
      aiDifficulty: difficulty,
      fleet,
      routes,
      // Empty until a month has closed. It used to open with 5% of the
      // starting capital, a "profit" no month had produced.
      monthlyProfitsHistory: [],
      personality,
      aggression: AGGRESSION[personality]
    });
  }
  return result;
};

export const simulateAiAirlinesTurn = (
  currentAiAirlines: AiAirline[],
  allAirports: Airport[],
  currentDateOffset: number,
  playerHubId: string,
  /** The player's routes, so rivals face the same competition the player does. */
  playerRoutes: { origin: string; destination: string; schedule?: any[] }[] = []
): { updatedAis: AiAirline[], newMessages: GameMessage[] } => {
  const newMessages: GameMessage[] = [];
  const dateStr = `${monthOf(currentDateOffset).toString().padStart(2, '0')}/${yearOf(currentDateOffset)}`;
  const say = (text: string) => newMessages.push({ id: nextMessageId(), text, isRead: false, dateStr });

  // Everyone flying, as offers: the player plus every AI. An airline's own
  // entries are filtered out per airline below.
  const playerOffers: RouteOffer[] = playerRoutes.map(r => ({
    origin: r.origin,
    destination: r.destination,
    departures: r.schedule?.length || 0
  }));

  const updatedAis = currentAiAirlines.map((ai, idxOfAiZone) => {
    const difficulty = (ai.aiDifficulty || 'Normal') as Difficulty;
    // Dynamic Safe fallback if save file was old
    const personality: Personality = ai.personality || PERSONALITIES[idxOfAiZone % PERSONALITIES.length] || 'optimizer';
    const aggression = ai.aggression ?? AGGRESSION[personality];
    const hub = airportsMapAdjusted.get(ai.hub);

    let newFleet = [...ai.fleet];
    // Clone each route: the loop below writes onto these objects, and mutating
    // the ones held in React state would be a state mutation.
    let newRoutes = ai.routes.map(r => ({ ...r }));

    // Rivals buy fuel on the same market the player does. This used to read
    // the price table directly and skip getEventMultipliers, so through the
    // 1973 oil shock the player paid double while the AI paid the undisturbed
    // price for eighteen months -- and again in 1979 and 1990.
    const market: Market = {
      offset: currentDateOffset,
      fuelPrice: getJetFuelPrice(yearOf(currentDateOffset), monthOf(currentDateOffset), difficulty),
      // Everyone else on the market from this airline's point of view: the
      // player plus the other AI carriers, never itself.
      rivalOffers: [
        ...playerOffers,
        ...currentAiAirlines
          .filter(other => other.id !== ai.id)
          .flatMap(other => (other.routes || []).map(r => ({
            origin: r.origin,
            destination: r.destination,
            departures: r.departures || 0
          })))
      ]
    };

    const planeFor = (r: AiRoute) => newFleet.find(f => f.reg === r.aircraftReg) || newFleet[0];

    // 1. Book the month.
    let totalMonthlyProfit = 0;
    for (const r of newRoutes) {
      const plane = planeFor(r);
      const originAir = airportsMapAdjusted.get(r.origin);
      const destAir = airportsMapAdjusted.get(r.destination);
      if (!plane) {
        r.monthlyProfit = 0;
        continue;
      }

      const distance = originAir && destAir
        ? Math.floor(calculateDistance(originAir.coords[0], originAir.coords[1], destAir.coords[0], destAir.coords[1]))
        : (r.distance || 1500);
      r.distance = distance;
      // Recomputed every month: the aircraft on a route changes when the fleet
      // is modernised, and saves carry durations from the old formula.
      r.durMin = originAir && destAir
        ? getFlightDurationMinutes(originAir, destAir, plane)
        : (r.durMin || Math.floor((distance / (plane.cruiseSpeed || 800)) * 60 + 40));
      // No more departures than the aircraft can fly. Older saves carry
      // frequencies from before this limit existed.
      r.departures = Math.max(1, Math.min(r.departures || 1, maxWeeklyRotations(r.durMin, plane.class)));

      if (plane.maxRange && plane.maxRange < distance) {
        r.monthlyProfit = -150000;
      } else if (originAir && destAir) {
        const p = routeMonthlyProfit(personality, difficulty, plane, originAir, destAir, r.departures, distance, r.durMin, market, `${ai.code} ${r.origin}-${r.destination}`);
        r.monthlyProfit = Number.isFinite(p) ? p : 0;
      } else {
        r.monthlyProfit = 0;
      }
      // Smoothed result, so one weak winter month does not close a route.
      r.avgProfit = Number.isFinite(r.avgProfit) ? Math.round(r.avgProfit! * 0.65 + r.monthlyProfit * 0.35) : r.monthlyProfit;
      totalMonthlyProfit += r.monthlyProfit;
    }

    const finalCalculatedTurnover = totalMonthlyProfit + AI_MONTHLY_SUBSIDY;
    let newCapital = ai.capital + finalCalculatedTurnover;
    const nextProfitsHistory = [...(ai.monthlyProfitsHistory || []), finalCalculatedTurnover];
    if (nextProfitsHistory.length > 12) nextProfitsHistory.shift();

    const ageOf = (r: AiRoute) => currentDateOffset - (r.openedAt ?? -Infinity);
    const slotsLeft = () => (hub ? hub.level * HUB_SLOTS_PER_LEVEL : 0) - newRoutes.reduce((s, r) => s + (r.departures || 0), 0);

    // 2. Routes that keep losing money, once they had time to prove
    // themselves: first try a much thinner schedule, and drop the route only
    // if that would still lose. The aircraft then goes back into the pool for
    // a better route. Aggressive airlines hold on a little longer.
    const patience = PATIENCE_MONTHS[personality] + Math.max(0, aggression - 6);
    const losers = newRoutes
      .filter(r => ageOf(r) >= patience && (r.avgProfit ?? 0) < 0)
      .sort((a, b) => (a.avgProfit ?? 0) - (b.avgProfit ?? 0))
      .slice(0, difficulty === 'Hard' ? 2 : 1);
    for (const r of losers) {
      const plane = planeFor(r);
      const originAir = airportsMapAdjusted.get(r.origin);
      const destAir = airportsMapAdjusted.get(r.destination);
      const thin = Math.max(1, Math.round(r.departures * 0.4));
      if (plane && originAir && destAir && r.distance && r.durMin && thin < r.departures) {
        const p = routeMonthlyProfit(personality, difficulty, plane, originAir, destAir, thin, r.distance, r.durMin, market, `${ai.code} ${r.origin}-${r.destination}`);
        if (Number.isFinite(p) && p > 0) {
          r.departures = thin;
          r.avgProfit = p;
          continue;
        }
      }
      if (newRoutes.length <= CORE_NETWORK) break;
      newRoutes = newRoutes.filter(x => x !== r);
      if (r.origin === playerHubId || r.destination === playerHubId) {
        const other = airportsMapAdjusted.get(r.origin === playerHubId ? r.destination : r.origin);
        say(`ROUTE CLOSURE: ${ai.name} (${ai.code}) withdraws from ${r.origin}–${r.destination}${other ? ` (${other.name})` : ''} after sustained losses.`);
      }
    }

    // 3. Fine-tune frequencies: one step up where a route earns well, one
    // step down where it loses, kept only if the forecast improves. Easy
    // rivals never revisit a schedule; normal ones do so now and then.
    if (difficulty !== 'Easy') {
      for (const r of newRoutes) {
        if (ageOf(r) < 2 || (difficulty === 'Normal' && Math.random() < 0.5)) continue;
        const plane = planeFor(r);
        const originAir = airportsMapAdjusted.get(r.origin);
        const destAir = airportsMapAdjusted.get(r.destination);
        if (!plane || !originAir || !destAir || !r.durMin || !r.distance) continue;
        const max = maxWeeklyRotations(r.durMin, plane.class);
        const step = Math.max(1, Math.round(r.departures * 0.25));
        const alt = (r.avgProfit ?? 0) >= 0
          ? Math.min(max, r.departures + Math.min(step, Math.max(0, slotsLeft())))
          : Math.max(1, r.departures - step);
        if (alt === r.departures) continue;
        const label = `${ai.code} ${r.origin}-${r.destination}`;
        const now = routeMonthlyProfit(personality, difficulty, plane, originAir, destAir, r.departures, r.distance, r.durMin, market, label);
        const then = routeMonthlyProfit(personality, difficulty, plane, originAir, destAir, alt, r.distance, r.durMin, market, label);
        if (Number.isFinite(now) && Number.isFinite(then) && then > now + Math.abs(now) * 0.02) r.departures = alt;
      }
    }

    // 4. Fleet modernization: an aircraft out of production for twelve years
    // or older than twenty is replaced by a current type of the same class
    // that can still fly its route -- when the airline can pay for it.
    const obsoleteIndex = newFleet.findIndex(plane => {
      const spec = specById.get(plane.id);
      if (!spec) return false;
      const age = currentDateOffset - (plane.purchasedAt || 0);
      const isPastProduction = spec.lastDeliveryOffset !== null && currentDateOffset > (spec.lastDeliveryOffset + 144);
      return isPastProduction || age > 240;
    });
    if (obsoleteIndex !== -1) {
      const oldPlane = newFleet[obsoleteIndex];
      const route = newRoutes.find(r => r.aircraftReg === oldPlane.reg);
      const salvageValue = Math.floor((oldPlane.basePrice || 1000000) * 0.20);
      const budget = newCapital + salvageValue - CASH_RESERVE[personality] / 2;
      const replacement = aircraftOnMarket(currentDateOffset)
        .filter(a => a.class.toLowerCase() === oldPlane.class && a.id !== oldPlane.id && a.basePrice <= budget)
        .filter(a => !route || a.maxRange >= (route.distance || 0))
        .sort((a, b) => b.popularity - a.popularity)[0];
      if (replacement) {
        newCapital = newCapital + salvageValue - replacement.basePrice;
        newFleet = newFleet.map((p, i) => i === obsoleteIndex
          ? toFleetEntry(replacement, oldPlane.reg, currentDateOffset, cabinConfigFor(personality, replacement.capacity || 131))
          : p);
        if (route) route.aircraft = replacement.id;
        say(`FLEET MODERNIZATION: ${ai.name} (${ai.code}) has retired their obsolete ${`${oldPlane.manufacturer || ''} ${oldPlane.type}`.trim()} (Reg: ${oldPlane.reg}) and introduced a brand new ${replacement.manufacturer} ${replacement.type} to their scheduled fleet.`);
      }
    }

    // 5. Out of cash: sell one aircraft a month, an idle one first, else the
    // one on the worst route. The airline always keeps at least one.
    if (newCapital < 0 && newFleet.length > 1) {
      const idle = newFleet.find(p => !newRoutes.some(r => r.aircraftReg === p.reg));
      const worst = [...newRoutes].sort((a, b) => (a.avgProfit ?? 0) - (b.avgProfit ?? 0))[0];
      const sell = idle || (worst && (worst.avgProfit ?? 0) < 0 ? newFleet.find(p => p.reg === worst.aircraftReg) : undefined);
      if (sell) {
        newCapital += getAircraftResaleValue(sell);
        newFleet = newFleet.filter(p => p !== sell);
        newRoutes = newRoutes.filter(r => r.aircraftReg !== sell.reg);
      }
    }

    // 6. Put idle aircraft to work, on the best route the market offers, and
    // only if that route is forecast to make money. Easy rivals take any.
    const served = () => new Set(newRoutes.filter(r => r.origin === ai.hub).map(r => r.destination));
    const openRoute = (plane: AiPlane, plan: RoutePlan) => {
      newCapital -= ROUTE_OPENING_COST;
      newRoutes.push(newRoute(ai.hub, plane, plan, currentDateOffset));
      say(`NETWORK EXPANSION: ${ai.name} connects ${ai.hub} to ${plan.dest.name} (${plan.dest.id}) with the newly scheduled ${plane.type}.`);
    };
    const minForecast = difficulty === 'Easy' ? -Infinity : 0;
    const maxOpenings = difficulty === 'Hard' ? 2 : 1;
    let openings = 0;
    // Aircraft that were offered every destination and found nothing worth
    // flying. They do not hold up the purchase of a type that would.
    const unplaceable = new Set<string>();
    if (hub) {
      for (const plane of newFleet) {
        if (openings >= maxOpenings || newCapital < ROUTE_OPENING_COST) break;
        if (newRoutes.some(r => r.aircraftReg === plane.reg)) continue;
        if (difficulty === 'Easy' && Math.random() < 0.5) continue;
        const plan = planRoute(personality, difficulty, plane, hub, served(), market, allAirports, slotsLeft());
        if (plan && plan.profit > minForecast) {
          openRoute(plane, plan);
          openings++;
        } else {
          unplaceable.add(plane.reg);
        }
      }
    }

    // Aircraft that found no work: note since when, and sell one that has
    // stood around too long, as long as the airline keeps one aircraft.
    newFleet = newFleet.map(p => {
      const flying = newRoutes.some(r => r.aircraftReg === p.reg);
      if (flying) return p.idleSince === undefined ? p : { ...p, idleSince: undefined };
      return p.idleSince === undefined ? { ...p, idleSince: currentDateOffset } : p;
    });
    const parked = newFleet.find(p => p.idleSince !== undefined && currentDateOffset - p.idleSince >= MAX_IDLE_MONTHS);
    if (parked && newFleet.length > 1) {
      newCapital += getAircraftResaleValue(parked);
      newFleet = newFleet.filter(p => p !== parked);
    }

    // 7. Grow: buy an aircraft only when every aircraft is flying, the
    // airline is making money (or is flush with cash), the reserve stays
    // intact, and there is a route the new aircraft would earn on. The
    // aircraft is bought for that route and starts on it straight away.
    let buyProb = difficulty === 'Hard' ? 0.85 : difficulty === 'Normal' ? 0.45 : 0.12;
    if (personality === 'expansionist') buyProb = Math.min(0.90, buyProb * 1.35);
    else if (personality === 'lcc') buyProb = Math.min(0.85, buyProb * 1.25);
    else if (personality === 'optimizer') buyProb = buyProb * 0.70;
    else if (personality === 'boutique') buyProb = buyProb * 0.60;

    const allFlying = newFleet.every(p => unplaceable.has(p.reg) || newRoutes.some(r => r.aircraftReg === p.reg));
    const recent = nextProfitsHistory.slice(-3);
    const earning = recent.reduce((s, v) => s + v, 0) / recent.length > 0;
    const reserve = CASH_RESERVE[personality];

    if (hub && allFlying && slotsLeft() > 0 && Math.random() < buyProb) {
      const spendRatio = (personality === 'expansionist' || personality === 'lcc') ? 0.65 : 0.45;
      const affordable = aircraftOnMarket(currentDateOffset).filter(a =>
        a.basePrice <= newCapital * spendRatio &&
        a.basePrice + ROUTE_OPENING_COST <= newCapital - reserve &&
        (earning || a.basePrice * 3 <= newCapital)
      );

      const typeScore = (a: Aircraft) =>
        personality === 'lcc' ? (a.capacity || 100) * (a.efficiency || 50)
        : personality === 'boutique' ? (a.maxRange || 1000)
        : personality === 'flag' ? (a.class.toLowerCase() === 'widebody' ? 1000 : 0) + a.popularity
        : personality === 'optimizer' ? (a.efficiency || 50)
        : a.popularity;
      const shortlist = difficulty === 'Easy'
        ? affordable.sort(() => Math.random() - 0.5).slice(0, 1)
        : affordable.sort((a, b) => typeScore(b) - typeScore(a)).slice(0, 3);

      // Of the preferred types, the one whose best route pays back the
      // purchase fastest.
      let pick: { spec: Aircraft; plane: AiPlane; plan: RoutePlan } | null = null;
      let pickReturn = -Infinity;
      // Next free registration. Counting the fleet is not enough once
      // aircraft have been sold: it would hand out a registration still in use.
      const regNumbers = newFleet.map(p => Number(p.reg.split('-A')[1])).filter(Number.isFinite);
      const reg = `${ai.code}-A${Math.max(99, ...regNumbers) + 1}`;
      for (const spec of shortlist) {
        const config = difficulty === 'Easy'
          ? easyCabinConfig(spec.capacity || 131, idxOfAiZone)
          : cabinConfigFor(personality, spec.capacity || 131);
        const plane = toFleetEntry(spec, reg, currentDateOffset, config);
        const plan = planRoute(personality, difficulty, plane, hub, served(), market, allAirports, slotsLeft());
        if (!plan || plan.profit <= minForecast) continue;
        const payback = plan.profit / spec.basePrice;
        if (payback > pickReturn) {
          pickReturn = payback;
          pick = { spec, plane, plan };
        }
      }
      if (pick) {
        newCapital -= pick.spec.basePrice;
        newFleet = [...newFleet, pick.plane];
        // Rival Industry News has been removed per user request: the purchase
        // itself is silent, the new route is announced like any other.
        openRoute(pick.plane, pick.plan);
      }
    }

    return {
      ...ai,
      capital: newCapital,
      fleet: newFleet,
      routes: newRoutes,
      monthlyProfitsHistory: nextProfitsHistory,
      personality,
      aggression
    };
  });

  return { updatedAis, newMessages };
};
