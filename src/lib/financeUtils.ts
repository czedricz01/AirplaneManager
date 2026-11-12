import { LITRES_PER_GALLON } from './format';
import { Airport, calculateDistance, getAirportStats } from '../data/airports';
import { MEAL_DATA, EXTRAS_OPTIONS, SERVICE_OPTIONS } from '../data/catering';
import { jetFuelPrices } from '../data/fuelPrices';
import { routeCancelShare, routeDemandFactor, type PlayerModifiers } from './gameState';
import { getFeeFactor, getSlotPriceFactor } from './economyContext';
import { resaleAgeFactor } from './fleetCosts';
import { hubFeeFactor } from './hubOwnership';
import { realCostIndex } from './realCosts';

export function getAirportUpkeep(
  airport: Airport,
  infrastructure: any,
  routes: any[],
  fleet: any[],
  /** The calendar year, for the real growth of airport charges; leave out for 1960 prices. */
  year?: number
) {
  const hubAutoUpgrade = infrastructure.level >= 2;
  // The development tree's saving on airport charges applies to the upkeep too.
  const idx = (year === undefined ? 1 : realCostIndex(year)) * getFeeFactor();

  const slotCosts = {
    regional: Math.round(250 * idx),
    narrowbody: Math.round(250 * idx),
    widebody: Math.round(250 * idx)
  };
  
  const standUpgradeCosts = {
    regional: Math.round(150 * idx),
    narrowbody: Math.round(300 * idx),
    widebody: Math.round(600 * idx)
  };
  
  const deskCosts = {
    normal: Math.floor(2500 * hubFeeFactor(infrastructure.level) * idx),
    self: Math.floor(1500 * hubFeeFactor(infrastructure.level) * idx)
  };

  const deskCapacities = {
    normal: 5000,
    self: 10000
  };

  // Create a fast map for fleet registrations
  const fleetMap = new Map<string, any>();
  fleet.forEach(f => fleetMap.set(f.registration, f));

  let departing = 0;
  let arriving = 0;
  routes.forEach(r => {
    const ac = fleetMap.get(r.aircraft);
    if (!ac || !r.schedule) return;
    
    r.schedule.forEach((s: any) => {
      if (r.origin === airport.id) {
        departing += ac.capacity; 
        if (!s.isOneWay) arriving += ac.capacity; 
      }
      if (r.destination === airport.id) {
        arriving += ac.capacity; 
        if (!s.isOneWay) departing += ac.capacity;
      }
    });
  });

  const passengerData = {
    departing,
    total: departing + arriving
  };

  const b = {
    slots: { regional: 0, narrowbody: 0, widebody: 0 },
    stands: { regional: 0, narrowbody: 0, widebody: 0 },
    desks: { normal: 0, self: 0 },
    facilities: { hangar: 0, vip: 0, catering: 0 },
    total: 0
  };
  const { slots, stands, desks, hubFacilities } = infrastructure;
  
  b.slots.regional = (slots.regional || 0) * slotCosts.regional;
  b.slots.narrowbody = (slots.narrowbody || 0) * slotCosts.narrowbody;
  b.slots.widebody = (slots.widebody || 0) * slotCosts.widebody;
  
  if (!hubAutoUpgrade) {
    b.stands.regional = (stands.regional || 0) * standUpgradeCosts.regional;
    b.stands.narrowbody = (stands.narrowbody || 0) * standUpgradeCosts.narrowbody;
    b.stands.widebody = (stands.widebody || 0) * standUpgradeCosts.widebody;
  }
  
  b.desks.normal = (desks.normal || 0) * deskCosts.normal;
  b.desks.self = (desks.self || 0) * deskCosts.self;

  if (hubFacilities?.hangar) b.facilities.hangar = Math.round(10000 * idx);
  if (hubFacilities?.vipLounge) b.facilities.vip = Math.round(12500 * idx);
  if (hubFacilities?.catering) b.facilities.catering = Math.round(10000 * idx);

  b.total = b.slots.regional + b.slots.narrowbody + b.slots.widebody 
          + b.stands.regional + b.stands.narrowbody + b.stands.widebody 
          + b.desks.normal + b.desks.self
          + b.facilities.hangar + b.facilities.vip + b.facilities.catering;

  // The check-in load and its satisfaction cost are worked out by getDeskSim,
  // the one place that counts passengers per desk. An older copy here counted
  // them a second way and nothing read it.
  return {
    ...b,
    passengerData,
    slotCosts,
    standUpgradeCosts,
    deskCosts,
    deskCapacities
  };
}
/**
 * Block time for one leg, in minutes.
 *
 * This is the single flight-time model. It used to exist twice, and the two
 * copies disagreed: the planner used this acceleration model while the schedule
 * editor used `distance / aircraft.speed * 60 + 20`. `speed` is not a field on
 * any aircraft — the data calls it `cruiseSpeed` — so that second copy produced
 * NaN, which `getFlightTimeClass` below silently turned into class 8 (the
 * longest, worst-paying bucket) because every `<` comparison against NaN fails.
 * Editing a short-haul schedule therefore collapsed that route's demand to 40%.
 *
 * Returns 0 when the inputs are unusable, so callers never propagate NaN.
 */
export function getFlightDurationMinutes(
  origin: { coords: [number, number] } | null | undefined,
  dest: { coords: [number, number] } | null | undefined,
  aircraft: { cruiseSpeed?: number } | null | undefined
): number {
  if (!origin?.coords || !dest?.coords || !aircraft) return 0;

  const dKm = calculateDistance(origin.coords[0], origin.coords[1], dest.coords[0], dest.coords[1]);
  if (!Number.isFinite(dKm)) return 0;

  // Great-circle tracks are not flown exactly; airways add a few percent.
  const dCurved = dKm * 1.02;

  const vCruise = Number(aircraft.cruiseSpeed) || 800;
  const aAccel = 6000; // km/h^2
  const aDecel = 4000;

  const tAccelH = vCruise / aAccel;
  const sAccel = 0.5 * aAccel * tAccelH * tAccelH;

  const tDecelH = vCruise / aDecel;
  const sDecel = 0.5 * aDecel * tDecelH * tDecelH;

  const sCruise = Math.max(0, dCurved - sAccel - sDecel);
  const tCruiseH = sCruise / vCruise;

  const total = Math.round((tAccelH + tCruiseH + tDecelH) * 60);
  return Number.isFinite(total) ? total : 0;
}

export function getFlightTimeClass(durMin: number): number {
  // NaN fails every comparison below and would fall through to 8, so reject it
  // here rather than misclassifying a short hop as an ultra-long-haul flight.
  if (!Number.isFinite(durMin)) return 1;
  if (durMin < 60) return 1;
  if (durMin < 120) return 2;
  if (durMin < 180) return 3;
  if (durMin < 240) return 4;
  if (durMin < 360) return 5;
  if (durMin < 540) return 6;
  if (durMin < 720) return 7;
  return 8;
}

/**
 * Flight time as a position on the time-class scale, without steps.
 *
 * The time class is a bucket: 59 minutes is class 1 and 60 minutes is class 2.
 * Everything priced by it jumped at those edges. The same cabin scored 177%
 * satisfaction at 59 minutes and 136% at 60, and one minute more flight time
 * cost a route 13% of its passengers. This index is the same scale read
 * continuously: it equals the class in the middle of each bucket (1 at 30
 * minutes, 2 at 90, ... 8 at 810) and runs in a straight line in between.
 */
const TIME_INDEX_ANCHORS: [number, number][] = [
  [30, 1], [90, 2], [150, 3], [210, 4], [300, 5], [450, 6], [630, 7], [810, 8]
];

export function getFlightTimeIndex(durMin: number): number {
  if (!Number.isFinite(durMin)) return 1;
  const first = TIME_INDEX_ANCHORS[0];
  const last = TIME_INDEX_ANCHORS[TIME_INDEX_ANCHORS.length - 1];
  if (durMin <= first[0]) return first[1];
  if (durMin >= last[0]) return last[1];
  for (let i = 1; i < TIME_INDEX_ANCHORS.length; i++) {
    const [m1, c1] = TIME_INDEX_ANCHORS[i];
    if (durMin <= m1) {
      const [m0, c0] = TIME_INDEX_ANCHORS[i - 1];
      return c0 + (c1 - c0) * ((durMin - m0) / (m1 - m0));
    }
  }
  return last[1];
}

/**
 * A value from a table keyed by time class 1-8, for a time index that may lie
 * between two classes: the straight line between the two neighbours. A whole
 * number returns the table's own entry.
 */
export function byTimeIndex(table: Record<number, number>, timeIndex: number): number {
  const t = Number.isFinite(timeIndex) ? Math.max(1, Math.min(8, timeIndex)) : 1;
  const lo = Math.floor(t);
  const hi = Math.min(8, lo + 1);
  return table[lo] + (table[hi] - table[lo]) * (t - lo);
}

/** Southern summer is northern winter: the season there runs six months apart. */
const SEASON_BY_MONTH = [0.89, 0.91, 0.92, 0.96, 1.03, 1.10, 1.15, 1.14, 1.06, 0.95, 0.88, 1.00];

/**
 * The share of a route's two ends that lie south of the equator: 0, 0.5 or 1.
 * Feeds the season in calculateDemand.
 */
export function southernShare(
  origin: { coords: [number, number] } | null | undefined,
  dest: { coords: [number, number] } | null | undefined
): number {
  const south = (a: { coords: [number, number] } | null | undefined) => (a?.coords && a.coords[0] < 0 ? 1 : 0);
  return (south(origin) + south(dest)) / 2;
}

/**
 * The holiday season of a month, 1 on average. `south` is southernShare():
 * the tourist peak used to be July everywhere, Sydney and Cape Town included.
 */
export function seasonFactor(month: number, south: number = 0): number {
  const i = ((Math.round(month) - 1) % 12 + 12) % 12;
  const north = SEASON_BY_MONTH[i] ?? 1;
  const s = Number.isFinite(south) ? Math.max(0, Math.min(1, south)) : 0;
  return north * (1 - s) + SEASON_BY_MONTH[(i + 6) % 12] * s;
}


export function validateClassConfigs(classConfigs: any, selectedAircraft: any, airportManagement: any, selectedOrigin: any, selectedDest: any) {
  const baseAllowed = selectedAircraft.class === 'Regional' ? ['Basic'] : selectedAircraft.class === 'Narrowbody' ? ['Basic', 'Standard'] : ['Basic', 'Standard', 'Premium'];
  const allowedCategories = [...baseAllowed];
  const hasAdvancedCateringHub = airportManagement[selectedOrigin?.id]?.hubFacilities?.catering || airportManagement[selectedDest?.id]?.hubFacilities?.catering;
  const hasPremiumGalley = selectedAircraft.config?.details?.hasPremiumCatering;
  const isUpgradeActive = !!(hasAdvancedCateringHub && hasPremiumGalley);

  if (isUpgradeActive) {
    if (selectedAircraft.class === 'Regional') allowedCategories.push('Standard');
    else if (selectedAircraft.class === 'Narrowbody') allowedCategories.push('Premium');
    else allowedCategories.push('Luxury');
  }

  const allowedPrefixes: string[] = [];
  if (allowedCategories.includes('Basic')) allowedPrefixes.push('b');
  if (allowedCategories.includes('Standard')) allowedPrefixes.push('s');
  if (allowedCategories.includes('Premium')) allowedPrefixes.push('p');
  if (allowedCategories.includes('Luxury')) allowedPrefixes.push('l');

  const hasWifi = selectedAircraft.config?.details?.hasWifi;
  const newConfigs: any = { ...classConfigs };
  let changed = false;

  Object.keys(newConfigs).forEach(cls => {
    const current = newConfigs[cls];
    if (!current || !current.catering) return;

    let classChanged = false;

    const catArray = [...current.catering];
    for (let i = 0; i < catArray.length; i++) {
        const mealIds = catArray[i];
        if (Array.isArray(mealIds)) {
            const filtered = mealIds.filter((id: string) => id === 'none' || allowedPrefixes.some(pf => id.startsWith(pf)));
            if (filtered.length !== mealIds.length) {
                catArray[i] = filtered.length > 0 ? filtered : ['none'];
                classChanged = true;
            }
        }
    }

    const oldExtras = (current.extras || []).join(',');
    const capabilityFiltered = (current.extras || []).filter((ext: string) => {
        if (ext === 'wifi_limited' || ext === 'wifi_unlimited') return hasWifi;
        if (ext === 'premium_alcohol') return hasPremiumGalley;
        return true;
    });
    // Collapse any stale double-selection within a tiered family (e.g. a preset
    // saved before groups existed) down to the best remaining tier. Must run
    // AFTER the capability filter: collapsing first could keep a tier the
    // aircraft can no longer support, losing a still-valid lower tier.
    const filteredExtras = resolveExclusiveGroups(capabilityFiltered, EXTRAS_OPTIONS);
    const nextExtras = filteredExtras.length > 0 ? filteredExtras : ['none'];
    if (nextExtras.join(',') !== oldExtras) classChanged = true;

    // Replace the whole class object rather than writing into it: a shallow spread of
    // `classConfigs` still shares these nested objects with the caller's React state.
    if (classChanged) {
      newConfigs[cls] = { ...current, catering: catArray, extras: nextExtras };
      changed = true;
    }
  });

  return changed ? newConfigs : classConfigs;
}

export function getCateringOpt(ids: string | string[] | string[][], activeIndex?: number) {
  if (!ids) return { label: 'None', cost: 0, sat: 0 };
  
  let mealIds: string[] = [];
  if (Array.isArray(ids)) {
    if (typeof ids[0] === 'string') {
      mealIds = ids as string[];
    } else {
      mealIds = (ids as string[][])[activeIndex ?? 0] || ['none'];
    }
  } else {
    mealIds = [ids as string];
  }

  const activeMealIds = mealIds.filter(id => id !== 'none');
  if (activeMealIds.length === 0) return { label: 'None', cost: 0, sat: 0 };

  let totalCost = 0;
  let totalSat = 0;
  let labels: string[] = [];

  activeMealIds.forEach(id => {
    let found = null;
    for (const cat in MEAL_DATA) {
      found = MEAL_DATA[cat].find(m => m.id === id);
      if (found) break;
    }
    if (found) {
      totalCost += found.cost;
      totalSat += found.sat;
      labels.push(found.label);
    }
  });

  if (labels.length === 0) return { label: 'None', cost: 0, sat: 0 };

  const n = labels.length;
  // Cost is additive: serving N physical meal items costs what N items cost,
  // not an average of one. Sat stays average-based since perceived quality of
  // a combined meal tracks its average, not its sum.
  let sumCost = totalCost;
  let avgSat = totalSat / n;

  if (n > 1) {
    const extraCount = n - 1;
    sumCost = sumCost * (1 + (extraCount * 0.05));
    avgSat = avgSat * (1 + (extraCount * 0.075));
  }

  return {
    label: labels.join(', '),
    cost: Math.round(sumCost * 100) / 100,
    sat: Math.round(avgSat * 10) / 10
  };
}

// Tiered families (Wi-Fi, amenity kits, alcohol) are single-choice: if a stale
// selection somehow holds two tiers of the same family (e.g. a preset saved
// before groups existed), keep only the highest-sat tier so it's never
// double-counted. A no-op for option sets whose entries carry no `group`
// (e.g. SERVICE_OPTIONS).
function resolveExclusiveGroups(ids: string[], options: Record<string, { sat: number, group?: string }>): string[] {
  const bestOfGroup = new Map<string, string>();
  ids.forEach(id => {
    const group = options[id]?.group;
    if (group && (!bestOfGroup.has(group) || options[id].sat > options[bestOfGroup.get(group)!].sat)) {
      bestOfGroup.set(group, id);
    }
  });
  return ids.filter(id => {
    const group = options[id]?.group;
    return !group || bestOfGroup.get(group) === id;
  });
}

export function getMultiOptionSum(ids: string[], options: Record<string, { label: string, cost: number, sat: number, group?: string }>) {
  const activeIds = ids.filter(id => id !== 'none');
  if (activeIds.length === 0) return { label: 'None', cost: 0, sat: 0 };

  const resolvedIds = resolveExclusiveGroups(activeIds, options);

  let cost = 0;
  let sat = 0;
  let labels: string[] = [];

  resolvedIds.forEach(id => {
    if (options[id]) {
      cost += options[id].cost;
      sat += options[id].sat;
      labels.push(options[id].label);
    }
  });

  return {
    label: labels.join(', '),
    cost,
    sat
  };
}

/**
 * What passengers are willing to pay on a difficulty level, as a factor on the
 * fare: 12% more on Easy, 12% less on Hard.
 *
 * The level used to multiply the satisfaction figure itself, so the very same
 * flight left passengers "more satisfied" on Easy. It is a lever on money, and
 * that is where it now sits; satisfaction describes the flight alone.
 */
export function difficultyFareFactor(difficulty: string): number {
  if (difficulty === 'Easy') return 1.12;
  if (difficulty === 'Hard') return 0.88;
  return 1;
}

export const getLoungeBonus = (airportId: string | null, cabinClass: string, airportManagement?: any) => {
  const mgt = airportManagement || {};
  if (!airportId || !mgt) return 0;
  const infra = mgt[airportId];
  if (!infra?.hubFacilities?.vipLounge) return 0;
  if (cabinClass === 'business' || cabinClass === 'first') return 4;
  if (cabinClass === 'premium') return 1;
  return 0;
};

/**
 * How much of the interior's appeal a worn cabin keeps: 40% when it is
 * completely worn out, 100% when it is as good as new.
 */
const interiorWearFactor = (condition: number) => 0.4 + 0.6 * (condition / 100);

/**
 * The cabin score of an aircraft, 0 to about 100 and above for the best suites.
 *
 * With `cabinClass` it is that cabin's own score. The purchase used to average
 * the four cabins by seats into one figure for everybody, so a first-class
 * suite barely helped first class and economy was credited with it. Aircraft
 * bought before the per-cabin scores were stored, and the rivals' aircraft,
 * have only the average and use it for every cabin.
 */
export const getPlaneSat = (aircraft?: any, cabinClass?: string) => {
  if (!aircraft) return 0;
  // Any missing field used to make this NaN, and NaN then poisoned every figure
  // computed from it (it is how the AI economy ended up on a fallback constant).
  const popularity = Number.isFinite(aircraft.popularity) ? aircraft.popularity : 50;
  const ownCabin = cabinClass ? aircraft.config?.details?.interiorByClass?.[cabinClass] : undefined;
  const interiorPop = Number.isFinite(ownCabin)
    ? ownCabin
    : Number.isFinite(aircraft.baseInteriorPop) ? aircraft.baseInteriorPop : 50;
  const interiorCondition = Number.isFinite(aircraft.conditionInterior) ? aircraft.conditionInterior : 100;
  // Wear belongs to the cabin. The model's popularity is a fact about the type
  // and used to be scaled down by it as well, so a tired cabin also made the
  // aircraft type itself less popular.
  return Math.round(popularity * 0.33 + interiorPop * 0.67 * interiorWearFactor(interiorCondition));
};

/**
 * Satisfaction lost to the check-in desks a cabin class has to use.
 *
 * Adding a desk never makes this worse: no desk at all is the harshest case,
 * self-service alone is better than nothing, and a staffed desk is better
 * still. (Premium classes with self-service only used to lose 25, more than
 * with no desk at all, so building the cheaper desk hurt.) Economy passengers
 * do not mind self-service.
 */
export function getDeskPenalty(hasSelf: boolean, hasNormal: boolean, premiumClass: boolean): number {
  if (!hasSelf && !hasNormal) return -15;
  if (premiumClass && !hasNormal) return -10;
  return 0;
}

/**
 * Satisfaction lost because the check-in desks are too busy, for a desk load
 * in percent of capacity. Nothing up to 80%, then a steady slope: -4 at 100%
 * and -20 at 110%. It used to jump from -4 to -20 the moment the load passed
 * 100%, so one more departure could cost sixteen points.
 */
export function getDeskOverloadSat(loadPercent: number): number {
  if (!(loadPercent > 80)) return 0;
  if (loadPercent <= 100) return -((loadPercent - 80) * 0.2);
  return -Math.min(20, 4 + (loadPercent - 100) * 1.6);
}

export const getDeskSim = (airportId: string | null, airportManagement?: any, routes?: any[], fleet?: any[], selectedOrigin?: any, selectedDest?: any, selectedAircraft?: any, scheduleLength?: number, excludeRouteId?: string) => {
  const mgt = airportManagement || {};
  const rt = routes || [];
  const fl = fleet || [];
  if (!airportId || !mgt) return { load: 0, sat: 0, myPax: 0, cap: 0 };
  const infra = mgt[airportId]?.desks || { normal: 0, self: 0 };
  const totalCap = (infra.normal * 5000) + (infra.self * 10000);
  let myPax = 0;
  
  // Create a fast map for fleet registrations
  const fleetMap = new Map<string, any>();
  fl.forEach((f: any) => fleetMap.set(f.registration, f));
  
  rt.forEach((r: any) => {
    if (r.id === excludeRouteId) return;
    if (r.origin === airportId || r.destination === airportId) {
      const ac = fleetMap.get(r.aircraft);
      if (ac) {
        const actualSeats = (ac.config?.economy || 0) + (ac.config?.premium || 0) + (ac.config?.business || 0) + (ac.config?.first || 0) || ac.capacity;
        myPax += actualSeats * (r.schedule?.length || 0);
      }
    }
  });

  if (selectedOrigin && selectedAircraft && (airportId === selectedOrigin.id || airportId === selectedDest?.id)) {
    const actualSeats = (selectedAircraft.config?.economy || 0) + (selectedAircraft.config?.premium || 0) + (selectedAircraft.config?.business || 0) + (selectedAircraft.config?.first || 0) || selectedAircraft.capacity;
    myPax += actualSeats * (scheduleLength || 0);
  }
  
  const load = totalCap > 0 ? (myPax / totalCap) * 100 : 0;
  const totalDesks = infra.normal + infra.self;
  let sat = 0;
  if (totalDesks > 0) {
    sat -= (infra.self / totalDesks) * 1;
  }
  sat += getDeskOverloadSat(load);

  return { load, sat, myPax, cap: totalCap };
};

/** Satisfaction points for a stand at every slot, at both ends of the route. */
const FULL_STAND_BONUS = 2;

/**
 * The stand bonus of a route: up to +2, in proportion to how many of the slots
 * at each end have a stand, averaged over the two ends. `slotType` is the
 * lower-case infrastructure class of the aircraft ("regional", "narrowbody",
 * "widebody").
 *
 * The bonus used to be all or nothing and looked at the origin only, while this
 * function sat unused next to it: an airport at 9 stands for 10 slots earned
 * nothing, and a route to a destination without stands earned the full bonus.
 */
export const getStandBonus = (originId: string, destId: string, slotType: string, airportManagement?: any) => {
  const mgt = airportManagement || {};
  const coverage = (id: string) => {
    const slots = mgt[id]?.slots?.[slotType] || 0;
    const stands = mgt[id]?.stands?.[slotType] || 0;
    return slots > 0 ? Math.min(1, stands / slots) : 0;
  };
  return ((coverage(originId) + coverage(destId)) / 2) * FULL_STAND_BONUS;
};



import { getEventMultipliers, regionalDemandFactor } from "./eventSystem";
import { regionOf } from "./geoUtils";

/**
 * How much of the raw demand a year keeps: [year, factor] anchors, linear in
 * between, constant before the first and after the last.
 *
 * A city pair's demand grows about sevenfold from 1960 to 2018 (the airports'
 * own tables), while the seats a player puts on a route do not. Left alone, the
 * median pair asks for the seats of 73 weekly round trips of a 124-seat
 * aircraft in 2018, so demand never limits anything and only aircraft and slots
 * do. Pulling the late game back brings that to about 30, which makes a route
 * saturate and a network grow wider instead of denser.
 */
const ERA_DEMAND_POINTS: [number, number][] = [[1960, 1], [1990, 0.65], [2020, 0.40]];

export function eraDemandFactor(year: number): number {
    // NaN fails every comparison below and would fall through to the last
    // anchor; an unusable year is neutral instead.
    if (!Number.isFinite(year)) return 1;
    const first = ERA_DEMAND_POINTS[0];
    const last = ERA_DEMAND_POINTS[ERA_DEMAND_POINTS.length - 1];
    if (year <= first[0]) return first[1];
    if (year >= last[0]) return last[1];
    for (let i = 1; i < ERA_DEMAND_POINTS.length; i++) {
        const [y1, f1] = ERA_DEMAND_POINTS[i];
        if (year <= y1) {
            const [y0, f0] = ERA_DEMAND_POINTS[i - 1];
            return f0 + (f1 - f0) * ((year - y0) / (y1 - y0));
        }
    }
    return last[1];
}

export function calculateDemand(
    b1: number, t1: number, 
    b2: number, t2: number, 
    timeClass: number, 
    currentMonth: number,
    difficulty: string,
    currentYear: number,
    /**
     * An extra multiplier on top of the event effects, used for the player's
     * airline reputation. 1.0 is neutral, which is what the AI airlines pass.
     */
    extraDemandFactor: number = 1,
    /** southernShare() of the route; 0 keeps the northern season. */
    south: number = 0
) {
    // `timeClass` may be a time index between two classes (getFlightTimeIndex).
    const Mv = seasonFactor(currentMonth, south);
    // Was 1.2 / 1.1 / 1.0, which told the three levels apart by only 9%.
    const S = difficulty === 'Easy' ? 1.1 : difficulty === 'Normal' ? 0.9 : 0.75;
    const E = 1;
    const eraFactor = eraDemandFactor(currentYear);

    const offset = (currentYear - 1960) * 12 + (currentMonth - 1);
    const { demandMult: eventMult } = getEventMultipliers(offset);

    // Evaluate interaction by heavily weighting the lower of the two values
    const minB = Math.min(b1, b2);
    const maxB = Math.max(b1, b2);
    const businessInteraction = Math.pow(minB, 1.4) * Math.pow(maxB, 0.6);

    // Cross-tourism flows with similarly stronger weights on the bottleneck
    const flow1 = Math.pow(Math.min(b1, t2), 1.4) * Math.pow(Math.max(b1, t2), 0.6);
    const flow2 = Math.pow(Math.min(b2, t1), 1.4) * Math.pow(Math.max(b2, t1), 0.6);
    const tourismInteraction = ((flow1 + flow2) * Mv) / 2;
    
    const totalInteraction = businessInteraction + tourismInteraction;

    // Time class pax multiplier: Short haul gets significantly more, long haul less
    // Adjusted to be lower on long-haul routes (higher timeClass)
    const tcDemandMultiplier = Math.max(0.4, 3.1 - (timeClass * 0.35));

    const baseDemand = 29.0 * Math.pow(totalInteraction, 0.448351) * S * E * eraFactor * tcDemandMultiplier * eventMult * extraDemandFactor;
    const businessRatio = totalInteraction > 0 ? businessInteraction / totalInteraction : 0.5;
    const premiumMultiplier = Math.pow(timeClass / 8, 0.7);

    const prePct = Math.max(0.10, 0.15 * (0.3 + 0.7 * businessRatio) * Math.sqrt(premiumMultiplier));
    
    // Lower premium economy demand by 10%
    const preDemand = Math.round(baseDemand * prePct * 0.90);

    // Business demand should be 90% of Premium Economy demand on average (modulated by businessRatio for touristy routes)
    const busDemand = Math.round(preDemand * 0.90 * (0.4 + 1.2 * businessRatio));

    // First class demand should be 45% of Business demand on average (modulated by businessRatio for touristy routes)
    const firstDemand = Math.round(busDemand * 0.45 * (0.3 + 1.4 * businessRatio));

    const ecoDemand = Math.max(0, Math.round(baseDemand - firstDemand - busDemand - preDemand));

    return {
       total: Math.round(baseDemand),
       first: firstDemand,
       business: busDemand,
       premium: preDemand,
       economy: ecoDemand,
       formulaVars: { b1, t1, b2, t2, businessRatio, premiumMultiplier, Mv, S, E, eraFactor, totalInteraction, eventMult, tcDemandMultiplier, extraDemandFactor }
    };
}

/** What a short flight costs more per kilometre, by time class. */
const SHORT_HAUL_FARE_FACTOR: Record<number, number> = { 1: 1.15, 2: 1.15, 3: 1.10, 4: 1.10, 5: 1.05, 6: 1, 7: 1, 8: 1 };

export function calculateBasePrices(distance: number, timeClass: number) {
    // `timeClass` may be a time index between two classes (getFlightTimeIndex);
    // the short-haul surcharge then fades in a line instead of in steps.
    const baseEconomy = (30 + (distance * 0.05)) * byTimeIndex(SHORT_HAUL_FARE_FACTOR, timeClass);

    const basePre = baseEconomy * (1.3 + ((timeClass - 1) * 0.15));
    const baseBus = baseEconomy * (2.0 + ((timeClass - 1) * 0.25));
    const baseFirst = baseEconomy * (3.0 + ((timeClass - 1) * 0.5));

    return {
        economy: Math.round(baseEconomy),
        premium: Math.round(basePre),
        business: Math.round(baseBus),
        first: Math.round(baseFirst)
    };
}

export function getSatMultiplier(sat: number): number {
    if (sat <= 100) return sat / 100;
    const sEx = sat - 100;
    if (sEx <= 100) {
        const mult = 1.0 + (0.008 * sEx) - (0.000035 * Math.pow(sEx, 2));
        return Math.round(mult * 1000) / 1000;
    } else {
        const mult = 1.45 + (0.001 * (sEx - 100));
        return Math.round(mult * 1000) / 1000;
    }
}


/**
 * The satisfaction model.
 *
 * Satisfaction is 100 when a flight is what its passengers expected, and moves
 * up or down by what each part of the trip delivers against that expectation:
 *
 *   100 + cabin + service + ground        (and, per route: check-in load,
 *                                           staff morale, cancelled flights)
 *
 * Every part is in the same unit, satisfaction points, and every part levels
 * off, so the figure stays between 0 and SAT_MAX. It used to be the ratio of a
 * "quality" to an "expectation", open at the top: a 45-minute hop with every
 * extra reached 378%, because short flights multiplied service by three while
 * long flights both damped it and expected twice as much.
 *
 * How flight time enters, by time index 1 (half an hour) to 8 (13 hours):
 *   cabin    counts more the longer the passenger sits in it
 *   service  is expected in proportion to the flight: nothing much on a hop,
 *            three meals and drinks on a long haul. Missing it costs more the
 *            longer the flight; exceeding it pleases up to a limit.
 *   ground   check-in, lounge and stand count less on a long trip
 */
export const SAT_MAX = 160;

export const SAT_MODEL = {
  /** The cabin score (getPlaneSat) each class takes for granted. */
  cabinExpectation: { economy: 55, premium: 60, business: 68, first: 80 } as Record<string, number>,
  /** Satisfaction points per cabin point above or below it: at time index 1, and more per index. */
  cabinWeight: { base: 0.5, perIndex: 0.1 },
  /** The most the cabin can add or cost. */
  cabinLimit: 30,
  /**
   * Service points (meals + extras + service, as listed in catering.ts) a
   * class expects: at time index 1, and more per index.
   */
  serviceExpectation: {
    economy: { base: 5, perIndex: 10 },
    premium: { base: 12, perIndex: 14 },
    business: { base: 25, perIndex: 21 },
    first: { base: 40, perIndex: 33 }
  } as Record<string, { base: number; perIndex: number }>,
  /** What no service at all costs: at time index 1, and more per index. */
  serviceShortfall: { base: 6, perIndex: 9 },
  /** No service hurts the dearer cabins more. */
  serviceShortfallByClass: { economy: 1, premium: 1.1, business: 1.25, first: 1.4 } as Record<string, number>,
  /** The most that service beyond the expectation can add; twice the expectation earns 63% of it. */
  serviceDelight: 25,
  /** How much the ground side counts: at time index 1, and less per index. */
  groundWeight: { base: 1.2, perIndex: -0.1 },
  /** Points lost for a timetable that is cancelled entirely; in proportion below that. */
  cancelPenalty: 50
};

/** Levels off towards +-limit; near zero it changes nothing. */
const levelOff = (x: number, limit: number) => limit * Math.tanh(x / limit);

/** The service points a class expects on a flight at this time index. */
export function expectedServicePoints(cabinClass: string, timeIndex: number): number {
  const e = SAT_MODEL.serviceExpectation[cabinClass] || SAT_MODEL.serviceExpectation.economy;
  return e.base + e.perIndex * (timeIndex - 1);
}

/**
 * Satisfaction points for `delivered` service points against the `expected`
 * ones: a straight loss down to nothing delivered, a gain that levels off above.
 */
export function serviceSatPoints(delivered: number, expected: number, cabinClass: string, timeIndex: number): number {
  const ratio = expected > 0 ? Math.max(0, delivered) / expected : 1;
  if (ratio < 1) {
    const worst = (SAT_MODEL.serviceShortfall.base + SAT_MODEL.serviceShortfall.perIndex * (timeIndex - 1))
      * (SAT_MODEL.serviceShortfallByClass[cabinClass] ?? 1);
    return -worst * (1 - ratio);
  }
  return SAT_MODEL.serviceDelight * (1 - Math.exp(-(ratio - 1)));
}

export function calculateClassSatisfaction(c: string, aircraft: any, config: any, dur: number, airportManagement: any, routeOrigin: string, routeDest: string, slotType: string = 'regional') {
      // Meals come in whole numbers and follow the class; everything that is a
      // matter of degree follows the index, so one minute never moves it far.
      const timeClass = getFlightTimeClass(dur);
      const timeIndex = getFlightTimeIndex(dur);
      const mealCount = timeClass <= 5 ? 1 : timeClass <= 7 ? 2 : 3;

      let cateringSat = 0;
      for (let i = 0; i < mealCount; i++) {
          cateringSat += getCateringOpt(config.catering, i).sat;
      }
      const extrasSat = getMultiOptionSum(config.extras, EXTRAS_OPTIONS).sat;
      const serviceSat = getMultiOptionSum(config.service, SERVICE_OPTIONS).sat;

      // --- Cabin: this class's own seats against what the class takes for granted.
      const planeSat = getPlaneSat(aircraft, c);
      const cabinExpectation = SAT_MODEL.cabinExpectation[c] ?? SAT_MODEL.cabinExpectation.economy;
      const cabinWeight = SAT_MODEL.cabinWeight.base + SAT_MODEL.cabinWeight.perIndex * (timeIndex - 1);
      const cabinPoints = levelOff((planeSat - cabinExpectation) * cabinWeight, SAT_MODEL.cabinLimit);

      // --- Service: what is served against what a flight this long calls for.
      const serviceDelivered = cateringSat + extrasSat + serviceSat;
      const serviceExpected = expectedServicePoints(c, timeIndex);
      const servicePoints = serviceSatPoints(serviceDelivered, serviceExpected, c, timeIndex);

      // --- Ground: passengers check in at both ends of a round trip, so both
      // airports count, as they already do for the overload penalty.
      const groundWeight = SAT_MODEL.groundWeight.base + SAT_MODEL.groundWeight.perIndex * (timeIndex - 1);
      const isPremium = c === 'business' || c === 'first' || c === 'premium';
      const deskPenaltyAt = (airportId: string) => {
         const desks = airportManagement[airportId]?.desks;
         return getDeskPenalty((desks?.self || 0) > 0, (desks?.normal || 0) > 0, isPremium);
      };
      const deskPenalty = ((deskPenaltyAt(routeOrigin) + deskPenaltyAt(routeDest)) / 2) * groundWeight;
      const loungeBonus = (getLoungeBonus(routeOrigin, c, airportManagement) + getLoungeBonus(routeDest, c, airportManagement)) * groundWeight;
      const standBonus = getStandBonus(routeOrigin, routeDest, slotType, airportManagement) * groundWeight;
      const groundPoints = deskPenalty + loungeBonus + standBonus;

      const sat = Math.round(Math.max(0, Math.min(SAT_MAX, 100 + cabinPoints + servicePoints + groundPoints)));

      return {
         satisfactionPercentage: sat,
         // The parts, in satisfaction points, so screens can show what the
         // model actually applied instead of re-deriving it their own way.
         cabinPoints,
         servicePoints,
         groundPoints,
         standBonus,
         loungeBonus,
         deskPenalty,
         // What stands behind the parts.
         planeSat,
         cabinExpectation,
         serviceDelivered,
         serviceExpected: Math.round(serviceExpected)
      };
}

export const CABIN_CLASSES = ['economy', 'premium', 'business', 'first'] as const;

/** A class's cabin set-up, falling back to "general" and then to nothing at all. */
export function classConfigFor(classConfigs: Record<string, any> | undefined, cabinClass: string) {
  const configs = classConfigs || {};
  return configs[cabinClass] || configs.general || { catering: [['none']], extras: ['none'], service: ['none'] };
}

/**
 * Satisfaction per cabin class for a route, exactly as the economy prices it.
 *
 * This is the one definition. The route planner, the cabin overlay and the
 * route details each used to compute "route satisfaction" their own way --
 * one weighted the aircraft score twice, one called the engine with an empty
 * airport table and made-up airport ids, one averaged only the classes above
 * zero -- so the same route showed four different numbers, none of them the
 * one that set its fares and loads.
 *
 * The check-in load now includes this route's own passengers. It used to be
 * excluded, so a route on its own could never overload the desks it used,
 * while the planner's desk panel showed it doing exactly that.
 */
export function getRouteClassSatisfaction(
  route: any,
  aircraft: any,
  airportManagement: Record<string, any>,
  allRoutes: any[] = [],
  fleet: any[] = [],
  /** No longer used: the difficulty acts on the fare (difficultyFareFactor), not on satisfaction. */
  _difficulty?: string
) {
  const durMin = Number(route.durMin) || 0;
  const weeklyFlights = route.schedule?.length || route.weeklyFlights || 0;
  const slotType = String(aircraft?.class || 'regional').toLowerCase();
  const mgt = airportManagement || {};

  const origin = { id: route.origin };
  const dest = { id: route.destination };

  // A saved cabin selection can go stale: a refit that drops premium catering
  // or Wi-Fi, or a hub that loses its catering facility, used to leave the
  // route's classConfigs pointing at a menu nothing can still serve. The
  // economy priced and costed it anyway, silently, until the player happened
  // to reopen the cabin editor -- the only place this ran before. Validated
  // here instead, so every route is always priced against what its aircraft
  // and airports can currently support.
  const classConfigs = aircraft
    ? validateClassConfigs(route.classConfigs, aircraft, mgt, origin, dest)
    : (route.classConfigs || {});

  const originDeskSim = getDeskSim(route.origin, mgt, allRoutes, fleet, origin, dest, aircraft, weeklyFlights, route.id);
  const destDeskSim = getDeskSim(route.destination, mgt, allRoutes, fleet, origin, dest, aircraft, weeklyFlights, route.id);
  const overloadPenalty = (originDeskSim.sat < 0 ? originDeskSim.sat : 0) + (destDeskSim.sat < 0 ? destDeskSim.sat : 0);

  const routeSat: Record<string, number> = {};
  const satisfactionDetails: Record<string, any> = {};

  for (const c of CABIN_CLASSES) {
    const seats = aircraft?.config?.[c] || 0;
    if (seats <= 0) continue;
    const satData = calculateClassSatisfaction(
      c, aircraft, classConfigFor(classConfigs, c), durMin, mgt,
      route.origin, route.destination, slotType
    );
    routeSat[c] = Math.round(Math.max(0, Math.min(SAT_MAX, satData.satisfactionPercentage + overloadPenalty)));
    satisfactionDetails[c] = {
      ...satData,
      // Before the check-in overload penalty, for the "cabin services" figure.
      baseSatisfaction: satData.satisfactionPercentage,
      satisfactionPercentage: routeSat[c],
      overloadPenalty
    };
  }

  return { routeSat, satisfactionDetails, overloadPenalty, originDeskSim, destDeskSim, classConfigs };
}

/** Seat-weighted mean satisfaction over the classes an aircraft actually has. */
export function seatWeightedSatisfaction(routeSat: Record<string, number>, config: Record<string, any> | undefined): number {
  let seats = 0;
  let sum = 0;
  for (const c of CABIN_CLASSES) {
    const n = config?.[c] || 0;
    if (n <= 0) continue;
    seats += n;
    sum += (routeSat[c] || 0) * n;
  }
  return seats > 0 ? sum / seats : 0;
}

/** Overpricing hits demand much harder than underpricing rewards it. */
const OVERPRICE_ELASTICITY_FACTOR = 3;

/**
 * Above the fare not every passenger reacts alike. Most compare prices and
 * leave quickly (the steep curve above); a quarter has to travel and is only
 * unit-elastic: twice the fare halves them. So demand first drops steeply,
 * then levels off instead of running to nothing.
 *
 * Unit elasticity is the bound that keeps this from being a lever: a fare
 * above the market fare can never earn more than the market fare itself,
 * because what this group pays in total stays the same however high it goes.
 */
export const PRICE_INSENSITIVE_SHARE = 0.25;
const PRICE_INSENSITIVE_ELASTICITY = 1;

/**
 * How strongly a cabin's demand reacts to its fare: 1.2 means 1% cheaper sells
 * 1.2% more seats. Holidaymakers in economy compare prices; business and first
 * class travel mostly on someone else's account and react far less.
 *
 * This used to depend on satisfaction alone and was the same for every cabin
 * (1 at 100% satisfaction), which made satisfaction count a second time on top
 * of the fare it already sets.
 */
export const PRICE_ELASTICITY: Record<string, number> = { economy: 1.2, premium: 1.0, business: 0.8, first: 0.7 };

export const priceElasticity = (cabinClass: string) => PRICE_ELASTICITY[cabinClass] ?? 1;

/**
 * The share of demand a fare keeps, against the fare passengers find fair.
 * `elasticity` is priceElasticity() of the cabin; 1 when left out.
 */
export function getPriceDemandMultiplier(price: number, satBasePrice: number, elasticity: number = 1) {
    // Nothing is worth zero, and a free ticket draws the most demand there is.
    // Without these two lines 0/0 and x/0 turned the whole route result into NaN.
    if (!(satBasePrice > 0)) return 0;
    if (!(price > 0)) return 1.5;
    const appeal = satBasePrice / price;
    if (price <= satBasePrice) return Math.min(1.5, Math.pow(appeal, elasticity));
    return (1 - PRICE_INSENSITIVE_SHARE) * Math.pow(appeal, elasticity * OVERPRICE_ELASTICITY_FACTOR)
      + PRICE_INSENSITIVE_SHARE * Math.pow(appeal, PRICE_INSENSITIVE_ELASTICITY);
}

/**
 * How much unsold demand beyond your own seats still counts.
 *
 * Demand on a city pair grows about eightfold between 1960 and 2020, while the
 * aircraft a player actually flies do not. The result was that surplus demand
 * turned directly into free pricing power: measured with a 180-seat aircraft at
 * seven round trips a week, the median pair allowed a fare 54% above the
 * satisfaction-adjusted base in 1980, 216% in 2000 and 500% in 2020 without
 * losing a single passenger, because demand stayed above capacity however high
 * the fare went.
 *
 * Passengers you have no seat for do not queue at any price -- they fly at
 * another time, on another carrier, or not at all. So demand counts only up to
 * what the route can actually carry. The margin used to be 1.2, which kept a
 * full aircraft worth a premium of about 5% (the fare that earns most per seat
 * was 1.05 times the base). At exactly 1.0 that premium ends: a full aircraft
 * sells out at the satisfaction-adjusted base fare, and every fare above it
 * costs passengers in every era. Flying at the base fare is unaffected.
 */
export const MAX_DEMAND_SURPLUS = 1.0;

/**
 * How much more than the satisfaction-adjusted fare passengers accept when
 * seats are scarce, at most.
 *
 * With the cap above alone, demand beyond the seats counted for nothing: a
 * route with ten times the passengers it could carry priced exactly like one
 * with just enough, and above the satisfaction fare it emptied just as fast.
 * Scarce seats do sell dearer, but only a little and never without limit, so
 * the premium grows with the fourth root of demand over seats and stops at
 * 15%: 5% at 1.2 times the seats, 11% at 1.5 times, 15% from 1.75 times on.
 * It is the same in every era and at every satisfaction, which is what the
 * old surplus margin was not: there the premium grew with satisfaction and,
 * before the margin, with the era's demand.
 */
export const MAX_SCARCITY_PREMIUM = 0.10;
const SCARCITY_EXPONENT = 0.25;

/** The multiplier on the satisfaction-adjusted fare for `demand` passengers wanting `seats` seats; 1 when they fit. */
export function scarcityPremium(demand: number, seats: number): number {
  if (!(seats > 0) || !(demand > seats)) return 1;
  return Math.min(1 + MAX_SCARCITY_PREMIUM, Math.pow(demand / seats, SCARCITY_EXPONENT));
}

/**
 * One airline's offer on a city pair, for the market-share split below.
 */
export interface RouteOffer {
  origin: string;
  destination: string;
  /** Departures per week. */
  departures: number;
  /** Who flies it, for display only. Never used in the share calculation. */
  airline?: string;
  /**
   * How much better than the going fare this offer is priced, 1 when it is
   * neither dearer nor cheaper: a rival that cuts fares by 12% has 1 / 0.88.
   * Feeds the share split like the player's own price does.
   */
  priceAppeal?: number;
}

/** City pair, direction-insensitive: FRA-CDG and CDG-FRA are the same market. */
export const marketKey = (a: string, b: string) => [a, b].sort().join('>');

/**
 * Rival AI routes grouped by exact city pair, for an O(1) "how many rivals
 * fly this exact route" lookup per candidate. Keying by `marketKey` (both
 * endpoints) rather than by a single airport is what makes this exact --
 * grouping by destination alone would count every rival merely touching that
 * airport, on any origin, as "competition" on a route that hasn't been picked
 * yet.
 */
export function buildRivalRoutesByPair(aiAirlines: any[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const ai of aiAirlines || []) {
    for (const r of ai.routes || []) {
      const key = marketKey(r.origin, r.destination);
      m.set(key, (m.get(key) || 0) + 1);
    }
  }
  return m;
}

/**
 * How attractive an offer is to a passenger choosing between airlines.
 *
 * Frequency matters with diminishing returns -- the second daily departure is
 * worth far more than the tenth. Price matters more than service, which is why
 * its exponent is the larger one.
 *
 * `priceAppeal` is the sat-adjusted base price divided by what is charged, and
 * `satAppeal` is satisfaction over 100. Both default to 1 for a rival whose
 * fares and cabin we cannot see -- AI routes carry only a frequency.
 */
export function offerAttractiveness(
  departuresPerWeek: number,
  priceAppeal: number = 1,
  satAppeal: number = 1
): number {
  if (departuresPerWeek <= 0) return 0;
  // Both appeals are clamped. Price already grows the whole market through
  // getPriceDemandMultiplier, which is capped at 1.5x for the same reason; without
  // a bound here, pricing at almost nothing would also take almost the entire
  // market, and "charge $1" would beat every other decision in the game.
  const price = Math.max(0.5, Math.min(2, priceAppeal));
  const sat = Math.max(0.5, Math.min(1.6, satAppeal));
  return Math.pow(departuresPerWeek, 0.5)
    * Math.pow(price, 1.2)
    * Math.pow(sat, 0.8);
}

/**
 * What the regional events of a month do to the demand between two airports;
 * 1 when none is running. Shared by the monthly figures and the planner's
 * demand preview, which calls calculateDemand directly.
 */
export function eventRegionalFactor(
  year: number,
  month: number,
  origin: { coords: [number, number] } | undefined | null,
  dest: { coords: [number, number] } | undefined | null
): number {
  if (!origin || !dest) return 1;
  return regionalDemandFactor((year - 1960) * 12 + (month - 1), regionOf(origin.coords), regionOf(dest.coords));
}

/**
 * The share of a city pair's demand this route wins.
 *
 * Returns 1 when nobody else flies the pair, which is what every route used to
 * get unconditionally: demand had no competition term at all, so two identical
 * parallel services each carried a full load of the same passengers.
 */
export function marketShare(ownAttractiveness: number, rivalAttractiveness: number): number {
  const total = ownAttractiveness + rivalAttractiveness;
  if (total <= 0) return 1;
  return ownAttractiveness / total;
}

/**
 * Seats a regional aircraft needs to pay the full regional landing fee, and
 * the smallest share of it any aircraft pays.
 */
export const REGIONAL_FEE_REFERENCE_SEATS = 100;
export const REGIONAL_FEE_MIN_SHARE = 0.3;

/**
 * The share of its class's landing fee an aircraft pays.
 *
 * Real airports charge by take-off weight. The game charged one flat amount
 * per class, so a 52-seat turboprop paid 80% of what a 180-seat jet paid:
 * about $50 per seat and landing, two thirds of a 500 km fare. No regional
 * aircraft of 1960 could break even on any route at any price. Regional
 * aircraft now pay by size, measured in seats, up to the full fee at
 * REGIONAL_FEE_REFERENCE_SEATS. Narrowbodies and widebodies are unchanged.
 */
export function landingFeeSizeFactor(seats: number | undefined, aircraftClass: string | undefined): number {
  if (String(aircraftClass || 'regional').toLowerCase() !== 'regional') return 1;
  if (!(Number(seats) > 0)) return 1;
  return Math.max(REGIONAL_FEE_MIN_SHARE, Math.min(1, Number(seats) / REGIONAL_FEE_REFERENCE_SEATS));
}

// Full Financial Calculation
export function calculateRouteFinancials(
  route: any,
  aircraft: any,
  fuelPrice: number,
  airportManagement: Record<string, any>,
  currentYear: number,
  currentMonth: number,
  difficulty: string,
  airportsMap: Map<string, Airport>,
  allRoutes: any[] = [],
  fleet: any[] = [],
  forceFullLoad: boolean = false,
  /** Reputation effect on demand for this operator. 1.0 = neutral. */
  extraDemandFactor: number = 1,
  /**
   * Everyone else flying this city pair. Other operators' routes only; this
   * route's own entry must not be in here.
   */
  rivalOffers: RouteOffer[] = [],
  /**
   * Everything that applies to the player's airline only. When given, its
   * demandFactor replaces extraDemandFactor; its other fields are neutral when
   * absent. The AI airlines never pass it.
   */
  mods?: PlayerModifiers
) {
  const dist = route.distance || 0;
  const fuelPricePerL = Math.round((fuelPrice / LITRES_PER_GALLON) * 1000) / 1000;
  const weeklyFlights = route.schedule?.length || route.weeklyFlights || 0;
  // The share of the timetable that actually operates. Strikes and disruptions
  // cancel the rest: fuel, crew hours, fees and seats all scale with it, while
  // the timetable passengers chose the airline by does not.
  const flownShare = 1 - routeCancelShare(mods, route.id);
  const flightLegs = (route.schedule ? route.schedule.reduce((acc: number, s: any) => acc + (s.isOneWay ? 1 : 2), 0) : weeklyFlights * 2) * flownShare;

  // Initial Costs
  const totalWeeklyFuelLiters = (7.5 * aircraft.capacity * (dist / 100)) / (0.75 + (aircraft.efficiency / 70)) * flightLegs;
  const weeklyFuelCost = fuelPricePerL * totalWeeklyFuelLiters;
  
  // Crew Costs (Base: 2 Pilots * 100/hr + FAs * 40/hr)
  const durMin = Number(route.durMin) || 0;
  const flightHoursWeekly = (durMin * flightLegs) / 60;
  const faCount = Math.ceil(aircraft.capacity / 50);
  const hourlyCrewRate = (2 * 100) + (faCount * 40);
  // Pay above or below the market rate; ground staff below follow the crew.
  const costIndex = realCostIndex(currentYear);
  // Development projects make the airport charges and the catering cheaper.
  const feeFactor = mods?.feeFactor ?? 1;
  const cateringFactor = mods?.cateringFactor ?? 1;
  const weeklyCrewCost = hourlyCrewRate * flightHoursWeekly * (mods?.crewCostFactor ?? 1) * costIndex;
  
  // Assuming staff cost is same as crew or similar if handled differently
  const weeklyStaffCost = weeklyCrewCost * 0.3; // Just a flat ground staff assumption
  
  const originAirport = airportsMap.get(route.origin);
  const destAirport = airportsMap.get(route.destination);
  const originLevel = originAirport?.level || 0;
  const destLevel = destAirport?.level || 0;
  
  const originHub = airportManagement[route.origin]?.level >= 2;
  const destHub = airportManagement[route.destination]?.level >= 2;
  const originFeeFactor = hubFeeFactor(airportManagement[route.origin]?.level);
  const destFeeFactor = hubFeeFactor(airportManagement[route.destination]?.level);

  const sizeFactor = landingFeeSizeFactor(aircraft.capacity, aircraft.class);
  const getLandingFee = (level: number, hubFactor: number, type: string) => {
    switch (type.toLowerCase()) {
      case 'regional': return Math.floor((2000 + 100 * level) * 1.1 * hubFactor * costIndex * feeFactor * sizeFactor);
      case 'narrowbody': return Math.floor((2500 + 100 * level) * 1.1 * hubFactor * costIndex * feeFactor);
      case 'widebody': return Math.floor((3000 + 150 * level) * 1.1 * hubFactor * costIndex * feeFactor);
      default: return Math.floor(2200 * costIndex * feeFactor);
    }
  };

  // Infrastructure is keyed by lower-case class names ("regional" / "narrowbody" /
  // "widebody") while aircraft data capitalises them, so normalise once here.
  // Passing the capitalised form made every slots/stands lookup miss silently.
  const slotType = String(aircraft.class || 'regional').toLowerCase();
  const originLandingFees = getLandingFee(originLevel, originFeeFactor, slotType) * weeklyFlights * flownShare;
  const destLandingFees = getLandingFee(destLevel, destFeeFactor, slotType) * weeklyFlights * flownShare;

  const originCheckInUnit = (originHub ? 0.475 : 0.5) * costIndex * feeFactor;
  const destCheckInUnit = (destHub ? 0.475 : 0.5) * costIndex * feeFactor;
  const getPaxHandlingUnit = (level: number) => (level >= 5 ? 5 : level >= 3 ? 4 : 3) * costIndex * feeFactor;

  const timeClass = getFlightTimeClass(durMin);
  // Demand and fares follow the flight time without steps; see getFlightTimeIndex.
  const timeIndex = getFlightTimeIndex(durMin);

  // Satisfaction per class: the single definition every screen also uses.
  // Returned as part of the result instead of being written onto the route
  // argument, which is a React state object at most call sites. `classConfigs`
  // comes back validated against the aircraft and airports, so the catering
  // cost below never bills for an option the satisfaction figure has already
  // discarded.
  const { routeSat: cabinSat, satisfactionDetails, classConfigs } = getRouteClassSatisfaction(route, aircraft, airportManagement, allRoutes, fleet, difficulty);
  // Staff morale moves every class the same way, on top of the cabin product.
  // Cancelled flights cost satisfaction as well: a strike or a disruption
  // used to thin out the timetable and leave the passengers as happy as before.
  const cancelSat = -(1 - flownShare) * SAT_MODEL.cancelPenalty;
  const satDelta = (mods?.satDelta ?? 0) + cancelSat;
  const routeSat: Record<string, number> = satDelta === 0
    ? cabinSat
    : Object.fromEntries(Object.entries(cabinSat).map(([c, sat]) => [c, Math.max(0, Math.min(SAT_MAX, Math.round(sat + satDelta)))]));

  const originStats = getAirportStats(originAirport, currentYear);
  const destStats = getAirportStats(destAirport, currentYear);

  const demandData = calculateDemand(
    originStats.business, originStats.tourism,
    destStats.business, destStats.tourism,
    timeIndex, currentMonth, difficulty, currentYear,
    (mods ? routeDemandFactor(mods, originAirport, destAirport) * (mods.maturity?.[route.id] ?? 1) : extraDemandFactor) *
      eventRegionalFactor(currentYear, currentMonth, originAirport, destAirport),
    southernShare(originAirport, destAirport)
  );

  const bases = calculateBasePrices(dist, timeIndex);
  const fareFactor = difficultyFareFactor(difficulty);
  let totalPax = 0;
  let totalRev = 0;
  /**
   * Seats and passengers per cabin per week. `actual` is local passengers
   * only; `transfer` is the connecting passengers sitting in that cabin too,
   * so a cabin's load factor is (actual + transfer) / max.
   */
  const paxByClass: Record<string, { actual: number, max: number, transfer?: number }> = {};
  /**
   * Per cabin, the fare above which passengers start to stay away: the
   * satisfaction-adjusted base fare times the scarcity premium.
   */
  const marketFare: Record<string, number> = {};
  // A route mid-creation carries `ticketPrices: {}` (and copies that into
  // `activeTicketPrices` too, see RoutePlannerView's routeDraft) until the
  // player's first price edit. `{}` is truthy, so `a || b || c` never reached
  // the base-price fallback for it -- every class priced at `undefined`,
  // which turned pax, revenue and every cost that scales with pax into NaN,
  // shown as a stuck "$NaN" on the price sliders and, once safely formatted
  // elsewhere, a stuck "$0" on the Financial Summary next to it.
  const hasPrices = (p: unknown): p is Record<string, number> => !!p && Object.keys(p).length > 0;
  const ticketPrices = hasPrices(route.activeTicketPrices)
    ? route.activeTicketPrices
    : hasPrices(route.ticketPrices)
      ? route.ticketPrices
      : { economy: bases.economy, premium: bases.premium, business: bases.business, first: bases.first };

  let totalWeeklyCateringCost = 0;

  // --- Competition on this city pair ------------------------------------
  // Own parallel services count too: flying the same pair twice splits the
  // same passengers rather than doubling them. They are kept apart from the
  // rivals because loyalty (below) favours them as much as this route.
  const ownKey = marketKey(route.origin, route.destination);
  let otherAirlinesAttractiveness = 0;
  for (const offer of rivalOffers) {
    if (marketKey(offer.origin, offer.destination) !== ownKey) continue;
    otherAirlinesAttractiveness += offerAttractiveness(offer.departures, offer.priceAppeal ?? 1);
  }
  let ownParallelAttractiveness = 0;
  for (const other of allRoutes) {
    if (!other || other.id === route.id) continue;
    if (marketKey(other.origin, other.destination) !== ownKey) continue;
    const otherFlights = other.schedule?.length || other.weeklyFlights || 0;
    ownParallelAttractiveness += offerAttractiveness(otherFlights);
  }
  /** Everyone else on the pair, own parallel routes included, as the result reports it. */
  const rivalAttractiveness = otherAirlinesAttractiveness + ownParallelAttractiveness;
  // Loyal passengers (the frequent-flyer programme) prefer the airline, not
  // one of its flights: the bonus lifts this route and its own parallel
  // routes alike, so it wins passengers from rivals and never from itself.
  const loyalty = 1 + (mods?.loyaltyBonus ?? 0);

  // What serving one passenger in class `c` costs: meals, extras and service.
  const cateringPerPax = (c: string) => {
    const config = classConfigFor(classConfigs, c);
    const mealCount = timeClass <= 5 ? 1 : timeClass <= 7 ? 2 : 3;
    let catSum = 0;
    for (let i = 0; i < mealCount; i++) catSum += getCateringOpt(config.catering, i).cost;
    const extSum = getMultiOptionSum(config.extras, EXTRAS_OPTIONS).cost;
    const srvSum = getMultiOptionSum(config.service, SERVICE_OPTIONS).cost;
    return (catSum + extSum + srvSum) * cateringFactor;
  };

  // CALCULATE PAX AND DEPENDENT COSTS
  ['economy', 'premium', 'business', 'first'].forEach(c => {
    const seats = aircraft.config?.[c] || 0;
    if (seats > 0) {
      const maxPax = demandData[c as keyof typeof demandData] as number;
      const sat = routeSat[c];
      const satMultiplier = getSatMultiplier(sat);
      // The going fare for this distance on this difficulty, and what this
      // cabin is worth to its passengers on top of or below it.
      const marketBase = bases[c as keyof typeof bases] * fareFactor;
      const satBase = Math.round(marketBase * satMultiplier);
      // A saved fare list that lacks this cabin (say, business added by a
      // refit) is priced at the going rate rather than at `undefined`, which
      // made every figure of the route NaN.
      const price = Number.isFinite(ticketPrices[c]) ? ticketPrices[c] : satBase;

      // The share of this class's demand won against the rivals above. With
      // nobody else on the pair this is 1 and nothing changes.
      // Price is measured against the going fare, quality counts on its own.
      // The price term used to be the satisfaction-adjusted fare over the
      // price, so satisfaction entered the split twice.
      const ownAttractiveness = offerAttractiveness(
        weeklyFlights,
        price > 0 ? marketBase / price : 1,
        sat / 100
      );
      const share = loyalty === 1
        ? marketShare(ownAttractiveness, rivalAttractiveness)
        : marketShare(ownAttractiveness * loyalty, ownParallelAttractiveness * loyalty + otherAirlinesAttractiveness);

      // Whole seats: with part of the timetable cancelled, flightLegs is a
      // fraction, and so would be every passenger count derived from it.
      const weeklySupply = Math.round(seats * flightLegs);
      // Scarce seats sell a little dearer: the fare passengers measure the
      // price against carries the scarcity premium.
      const marketDemand = maxPax * share;
      const fare = Math.round(satBase * scarcityPremium(marketDemand, weeklySupply));
      marketFare[c] = fare;
      const demMult = getPriceDemandMultiplier(price, fare, priceElasticity(c));
      // Demand beyond MAX_DEMAND_SURPLUS times what this route can carry is not
      // available to it at any price, so it cannot prop up an inflated fare.
      const reachableDemand = Math.min(marketDemand, weeklySupply * MAX_DEMAND_SURPLUS);
      const targetPax = Math.floor(reachableDemand * demMult);

      const actualPax = forceFullLoad ? weeklySupply : Math.min(weeklySupply, targetPax);
      
      paxByClass[c] = { actual: actualPax, max: weeklySupply };
      totalPax += actualPax;
      totalRev += actualPax * price;
      
      // Calculate catering cost for this class's ACTUAL pax
      totalWeeklyCateringCost += cateringPerPax(c) * actualPax;
    }
  });

  // Connecting passengers, worked out across the whole network by
  // computeNetworkFinancials (transferUtils.ts), per cabin. They only ever
  // take seats of their own cabin the local passengers above left empty, and
  // pay the fees and catering every other passenger in that cabin does. They
  // are counted in their cabin's load, so no cabin reads half empty while
  // the route reads full. A full-load preview has no empty seat to give them.
  // A figure without a split by cabin (older callers) is all economy.
  const transfer = forceFullLoad ? undefined : mods?.transfer?.[route.id];
  const transferByClass = transfer?.byClass ?? (transfer ? { economy: transfer } : {});
  let transferPax = 0;
  let transferRev = 0;
  for (const c of CABIN_CLASSES) {
    const load = paxByClass[c];
    const requested = Math.max(0, Math.floor(Number(transferByClass[c]?.pax) || 0));
    if (!load || requested <= 0) continue;
    // Capped at the cabin's empty seats; transferUtils never asks for more,
    // but a stale figure must not seat anyone twice. Revenue shrinks with it.
    const pax = Math.min(requested, Math.max(0, load.max - load.actual));
    if (pax <= 0) continue;
    const rev = Math.round(Math.max(0, Number(transferByClass[c]?.revenue) || 0) * pax / requested);
    load.transfer = pax;
    transferPax += pax;
    transferRev += rev;
    totalWeeklyCateringCost += cateringPerPax(c) * pax;
  }
  totalPax += transferPax;
  totalRev += transferRev;

  const originPaxHandlingFees = totalPax * getPaxHandlingUnit(originLevel);
  const destPaxHandlingFees = totalPax * getPaxHandlingUnit(destLevel);
  const originCheckInFees = totalPax * originCheckInUnit;
  const destCheckInFees = totalPax * destCheckInUnit;

  const weeklyInfraCost = originLandingFees + destLandingFees + originCheckInFees + destCheckInFees + originPaxHandlingFees + destPaxHandlingFees;
  const totalWeeklyCosts = weeklyFuelCost + weeklyCrewCost + weeklyStaffCost + weeklyInfraCost + totalWeeklyCateringCost;

  const weightedSeatsPerWeek = (
    (aircraft.config?.economy || 0) * 1 +
    (aircraft.config?.premium || 0) * 1.6 +
    (aircraft.config?.business || 0) * 3.0 +
    (aircraft.config?.first || 0) * 5.0
  ) * flightLegs;
  
  const basePriceBE75 = weightedSeatsPerWeek > 0 ? totalWeeklyCosts / (weightedSeatsPerWeek * 0.75) : 100;
  const basePriceBE99 = weightedSeatsPerWeek > 0 ? totalWeeklyCosts / (weightedSeatsPerWeek * 0.99) : 80;
  const basePriceBE35 = weightedSeatsPerWeek > 0 ? totalWeeklyCosts / (weightedSeatsPerWeek * 0.35) : 300;
  
  return {
    basePriceBE75,
    basePriceBE99,
    basePriceBE35,
    estWeeklyProfit: totalRev - totalWeeklyCosts,
    estWeeklyCosts: totalWeeklyCosts,
    estWeeklyRev: totalRev,
    paxPerWeek: totalPax,
    paxByClass,
    marketFare,
    /** Connecting passengers per week, included in paxPerWeek. */
    transferPax,
    /** Their share of the fare, included in estWeeklyRev. */
    transferRev,
    routeSat,
    satisfactionDetails,
    demandData,
    distance: dist,
    durMin,
    timeClass,
    /** The time class without steps: what demand and base fares were priced with. */
    timeIndex,
    flightLegs,
    weeklyFlights,
    weightedSeatsPerWeek,
    rivalAttractiveness,
    costsBreakdown: {
      fuel: weeklyFuelCost,
      fuelLiters: totalWeeklyFuelLiters,
      fuelPriceL: fuelPricePerL,
      infra: weeklyInfraCost,
      landingFees: originLandingFees + destLandingFees,
      paxFees: originCheckInFees + destCheckInFees + originPaxHandlingFees + destPaxHandlingFees,
      crew: weeklyCrewCost + weeklyStaffCost,
      catering: totalWeeklyCateringCost,
      // Per-airport detail, so UIs can show a breakdown without re-deriving the model.
      originLandingFees,
      destLandingFees,
      originCheckInUnit,
      destCheckInUnit,
      originCheckInFees,
      destCheckInFees,
      originPaxFeeUnit: getPaxHandlingUnit(originLevel),
      destPaxFeeUnit: getPaxHandlingUnit(destLevel),
      originPaxHandlingFees,
      destPaxHandlingFees
    }
  };
}

export type RouteFinancials = ReturnType<typeof calculateRouteFinancials>;

/**
 * The figures a route keeps between months: what the route list, the map and
 * the rivals screen read without recomputing.
 *
 * Routes used to receive the whole engine result via `{...route, ...fin}` --
 * cost breakdowns, demand model inputs, per-class satisfaction internals --
 * roughly doubling each route in every savegame and cloud upload, and leaving
 * stale copies of numbers that every screen recomputes live anyway.
 */
export function toStoredRouteMetrics(fin: ReturnType<typeof calculateRouteFinancials>) {
  return {
    paxPerWeek: fin.paxPerWeek,
    paxByClass: fin.paxByClass,
    routeSat: fin.routeSat,
    estWeeklyRev: fin.estWeeklyRev,
    estWeeklyCosts: fin.estWeeklyCosts,
    estWeeklyProfit: fin.estWeeklyProfit,
    weeklyFlights: fin.weeklyFlights
  };
}

/** Engine-only fields older versions wrote onto routes; removed when a save loads. */
export const TRANSIENT_ROUTE_FIELDS = [
  'basePriceBE75', 'basePriceBE99', 'basePriceBE35', 'satisfactionDetails', 'demandData',
  'timeClass', 'timeIndex', 'flightLegs', 'weightedSeatsPerWeek', 'rivalAttractiveness', 'costsBreakdown'
] as const;

/**
 * The single source of truth for the jet fuel price of a given month.
 *
 * Includes the historical/random event multiplier and the Hard-difficulty
 * surcharge, so that every screen quotes the same price. Previously the route
 * planner rebuilt this inline and skipped the event multiplier, which made its
 * break-even preview disagree with the monthly report during fuel crises.
 */
export function getJetFuelPrice(year: number, month: number, difficulty: string): number {
  const dateKey = `${year}-${month.toString().padStart(2, '0')}`;
  let price = jetFuelPrices[dateKey] || 1.05;

  const offset = (year - 1960) * 12 + (month - 1);
  const { fuelMult } = getEventMultipliers(offset);
  price *= fuelMult;

  if (difficulty === 'Hard') price *= 1.15;
  return price;
}

/**
 * What an aircraft is worth today: a 30% residual floor plus what its airframe
 * and interior condition still carry. Used both for the sale price and for the
 * fleet line of the balance sheet, so the two cannot drift apart.
 */
export function getAircraftResaleValue(plane: {
  basePrice?: number;
  conditionGeneral?: number;
  conditionInterior?: number;
  /** Years since it was bought; leave out for a figure that ignores age. */
  ageYears?: number;
  /** What the development tree adds to the price: 0.02 = 2% more. */
  resaleBonus?: number;
}): number {
  const baseValue = plane.basePrice || 10000000;
  const condGenFactor = ((plane.conditionGeneral ?? 100) / 100) * 0.45;
  const condIntFactor = ((plane.conditionInterior ?? 100) / 100) * 0.15;
  const ageFactor = plane.ageYears === undefined ? 1 : resaleAgeFactor(plane.ageYears);
  return Math.round(baseValue * (0.30 + condGenFactor + condIntFactor) * ageFactor * (1 + Math.max(0, plane.resaleBonus ?? 0)));
}

/**
 * Price of an airport management tier, per level of the airport.
 *
 * The route planner charged a flat $100,000 / $500,000 / $2,500,000 while the
 * airport console charged these per-level prices, and only the console also
 * applied the tier's effects (hub auto-upgrade, stands). Both now use this.
 */
const MANAGEMENT_COST_PER_AIRPORT_LEVEL: Record<number, number> = { 1: 30_000, 2: 750_000, 3: 25_000_000 };

export function getManagementUnlockCost(airportLevel: number, tier: number): number {
  return Math.max(1, Number(airportLevel) || 1) * (MANAGEMENT_COST_PER_AIRPORT_LEVEL[tier] ?? 0);
}

/**
 * Infrastructure after unlocking a management tier. Never lowers the tier.
 * Every tier brings at least one standard check-in desk; tier 2 and above
 * turn on the hub auto-upgrade, which keeps a stand for every slot.
 */
export function applyManagementUnlock(infra: any | undefined, tier: number) {
  const base = infra || {
    level: 0,
    slots: { regional: 0, narrowbody: 0, widebody: 0 },
    stands: { regional: 0, narrowbody: 0, widebody: 0 },
    desks: { normal: 0, self: 0 }
  };
  const slots = base.slots || { regional: 0, narrowbody: 0, widebody: 0 };
  const level = Math.max(Number(base.level) || 0, tier);
  const desks = { normal: 0, self: 0, ...base.desks };
  if (desks.normal < 1) desks.normal = 1;
  return {
    ...base,
    slots,
    desks,
    level,
    hubAutoUpgrade: level >= 2,
    ...(level >= 2
      ? {
          stands: {
            ...base.stands,
            regional: slots.regional || 0,
            narrowbody: slots.narrowbody || 0,
            widebody: slots.widebody || 0
          }
        }
      : {})
  };
}

/**
 * What can be built at an airport. The airport console and the route planner
 * each had their own answer: the console offered widebody slots and stands
 * only from airport level 3 and self check-in only from 1995; the planner
 * offered all of it everywhere and always.
 */
export function getInfraAvailability(airport: { level?: number } | null | undefined, year: number) {
  const level = airport?.level || 0;
  return {
    widebodySlots: level >= 3,
    stands: level >= 3,
    selfCheckIn: year >= 1995
  };
}

/** How buying and selling slots is listed among the month's one-off spending. */
export const SLOT_CAPEX_LABEL = 'Airport Slots';

export function getSlotPurchaseCost(type: string) {
  const base = type === 'narrowbody' ? 50000 : type === 'widebody' ? 100000 : 25000;
  // Milestones make slots cheaper; see economyContext.ts.
  return Math.round((base * getSlotPriceFactor()) / 50) * 50;
}

export interface InfraChangeParams {
  /** Current infrastructure for one airport; never mutated. */
  infra: any;
  type: 'slots' | 'stands' | 'desks';
  subType: string;
  /** Signed delta requested, already multiplied for a shift-click. */
  requestedAmount: number;
  hubAutoUpgrade: boolean;
  autoBuyStands: boolean;
  /** Free purchasable slots at this airport; only consulted when buying slots. */
  availableSlots: number;
  /** Weekly slots this subType already has scheduled — the floor a sell cannot cross. */
  utilizedSlots: number;
  /** getSlotPurchaseCost(subType) for slots, 0 for stands/desks. */
  costPerUnit: number;
  /** Desks of subType 'normal' can't be sold below this (0 unless the caller enforces a minimum). */
  minNormalDesks?: number;
}

export interface InfraChangeResult {
  /** New infra to persist, or the original object unchanged if actualAmount is 0. */
  infra: any;
  /** The delta actually applied, after every clamp below. */
  actualAmount: number;
  /** Signed amount to bill: positive charges, negative refunds. Always 0 for stands/desks. */
  cost: number;
  reason: 'ok' | 'no-availability' | 'sell-floor' | 'stands-need-slots' | 'noop';
}

/**
 * The single place that may change an airport's rented slots, stands or desks.
 * Both the Hub Management console and the New Route wizard call this so the two
 * screens can't drift apart: a slot sell here can never cross the utilized-slots
 * floor (which used to let free slots go negative), and stands are auto-shrunk
 * to stay within the new slot count (which used to leave stands > slots after a
 * sell made through the wizard).
 */
export function applyInfrastructureChange(params: InfraChangeParams): InfraChangeResult {
  const {
    infra, type, subType, requestedAmount, hubAutoUpgrade, autoBuyStands,
    availableSlots, utilizedSlots, costPerUnit, minNormalDesks = 0
  } = params;

  const newInfra = JSON.parse(JSON.stringify(infra));
  if (!newInfra[type]) newInfra[type] = {};
  const currentCount = newInfra[type][subType] || 0;

  let actualAmount = requestedAmount;

  // Can only sell what we have.
  if (currentCount + actualAmount < 0) {
    actualAmount = -currentCount;
  }

  if (type === 'slots') {
    if (actualAmount > 0 && actualAmount > availableSlots) {
      actualAmount = availableSlots;
    }
    if (actualAmount < 0 && currentCount + actualAmount < utilizedSlots) {
      actualAmount = utilizedSlots - currentCount;
    }
  }

  if (type === 'stands' && actualAmount > 0) {
    const slotLimit = newInfra.slots?.[subType] || 0;
    if (currentCount + actualAmount > slotLimit) {
      actualAmount = slotLimit - currentCount;
    }
  }

  if (type === 'desks' && subType === 'normal' && currentCount + actualAmount < minNormalDesks) {
    actualAmount = minNormalDesks - currentCount;
  }

  if (actualAmount === 0) {
    let reason: InfraChangeResult['reason'] = 'noop';
    if (type === 'slots' && requestedAmount > 0) reason = 'no-availability';
    else if (type === 'slots' && requestedAmount < 0) reason = 'sell-floor';
    else if (type === 'stands' && requestedAmount > 0) reason = 'stands-need-slots';
    return { infra, actualAmount: 0, cost: 0, reason };
  }

  newInfra[type][subType] = currentCount + actualAmount;

  let cost = 0;
  if (type === 'slots') {
    // Selling refunds half of what a slot cost to buy.
    cost = actualAmount > 0 ? costPerUnit * actualAmount : costPerUnit * actualAmount * 0.5;

    if (actualAmount > 0 && (hubAutoUpgrade || autoBuyStands)) {
      newInfra.stands = { ...newInfra.stands };
      newInfra.stands[subType] = (newInfra.stands[subType] || 0) + actualAmount;
    }

    if (actualAmount < 0) {
      const newSlotCount = currentCount + actualAmount;
      if (newInfra.stands && (newInfra.stands[subType] || 0) > newSlotCount) {
        newInfra.stands = { ...newInfra.stands };
        newInfra.stands[subType] = newSlotCount;
      }
    }
  }

  return { infra: newInfra, actualAmount, cost, reason: 'ok' };
}
