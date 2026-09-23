import { Airport, calculateDistance, getAirportStats } from '../data/airports';
import { MEAL_DATA, EXTRAS_OPTIONS, SERVICE_OPTIONS } from '../data/catering';
import { jetFuelPrices } from '../data/fuelPrices';

export function getAirportUpkeep(
  airport: Airport,
  infrastructure: any,
  routes: any[],
  fleet: any[]
) {
  const level = airport.level;
  const hubAutoUpgrade = infrastructure.level >= 2;

  const slotCosts = {
    regional: 250,
    narrowbody: 250,
    widebody: 250
  };
  
  const standUpgradeCosts = {
    regional: 150,
    narrowbody: 300,
    widebody: 600
  };
  
  const deskCosts = {
    normal: Math.floor(2500 * (hubAutoUpgrade ? 0.95 : 1)),
    self: Math.floor(1500 * (hubAutoUpgrade ? 0.95 : 1))
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

  if (hubFacilities?.hangar) b.facilities.hangar = 10000; 
  if (hubFacilities?.vipLounge) b.facilities.vip = 12500; 
  if (hubFacilities?.catering) b.facilities.catering = 10000; 

  b.total = b.slots.regional + b.slots.narrowbody + b.slots.widebody 
          + b.stands.regional + b.stands.narrowbody + b.stands.widebody 
          + b.desks.normal + b.desks.self
          + b.facilities.hangar + b.facilities.vip + b.facilities.catering;

  const totalDeskCapacity = ((desks.normal || 0) * deskCapacities.normal) + ((desks.self || 0) * deskCapacities.self);
  const deskLoad = totalDeskCapacity > 0 ? (passengerData.departing / totalDeskCapacity) * 100 : 0;
  let satDeduction = 0;
  if (deskLoad > 100) satDeduction = -((deskLoad - 100) / 10);
  if (totalDeskCapacity === 0 && passengerData.departing > 0) satDeduction = -25;

  
  return {
    ...b,
    passengerData,
    deskLoad,
    satDeduction,
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

export const TIME_CLASS_SAT_MULTIPLIERS: Record<number, number> = {
  1: 3.0,
  2: 2.2,
  3: 1.8,
  4: 1.4,
  5: 1.1,
  6: 0.9,
  7: 0.8,
  8: 0.8
};


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

  const allowedPrefixes = [];
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
    const filteredExtras = (current.extras || []).filter((ext: string) => {
        if (ext === 'wifi_limited' || ext === 'wifi_unlimited') return hasWifi;
        if (ext === 'premium_alcohol') return hasPremiumGalley;
        return true;
    });
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
  let avgCost = totalCost / n;
  let avgSat = totalSat / n;

  if (n > 1) {
    const extraCount = n - 1;
    avgCost = avgCost * (1 + (extraCount * 0.05));
    avgSat = avgSat * (1 + (extraCount * 0.075));
  }

  return {
    label: labels.join(', '),
    cost: Math.round(avgCost * 100) / 100,
    sat: Math.round(avgSat * 10) / 10
  };
}

export function getMultiOptionSum(ids: string[], options: Record<string, { label: string, cost: number, sat: number }>) {
  const activeIds = ids.filter(id => id !== 'none');
  if (activeIds.length === 0) return { label: 'None', cost: 0, sat: 0 };
  
  let cost = 0;
  let sat = 0;
  let labels: string[] = [];
  
  activeIds.forEach(id => {
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

export function adjustSatForDifficulty(baseSat: number, difficulty: string): number {
  if (difficulty === 'Easy') {
    if (baseSat <= -10) {
      return baseSat;
    }
    return baseSat * 1.15;
  }
  if (difficulty === 'Hard') {
    return baseSat * 0.85;
  }
  return baseSat;
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

export const getPlaneSat = (aircraft?: any) => {
  if (!aircraft) return 0;
  const generalPlaneSat = Math.round((aircraft.popularity * 0.33) + (aircraft.baseInteriorPop * 0.67));
  const combinedPlaneSat = Math.round(generalPlaneSat * (0.4 + 0.6 * (aircraft.conditionInterior / 100)));
  return combinedPlaneSat;
};

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
  if (load > 100) sat -= 20;
  else if (load > 90) sat -= 4;
  else if (load > 80) sat -= 2;

  return { load, sat, myPax, cap: totalCap };
};

export const getStandBonus = (selectedOrigin?: any, selectedDest?: any, selectedAircraft?: any, airportManagement?: any) => {
  const mgt = airportManagement || {};
  if (!selectedOrigin || !selectedDest || !selectedAircraft || !mgt) return 0;
  
  let infraClass = "regional";
  const acClass = (selectedAircraft.class || "").toLowerCase();
  if (acClass === "narrowbody") infraClass = "narrowbody";
  if (acClass === "widebody") infraClass = "widebody";
  
  const oSlots = mgt[selectedOrigin.id]?.slots?.[infraClass] || 0;
  const oStands = mgt[selectedOrigin.id]?.stands?.[infraClass] || 0;
  const oRatio = oSlots > 0 ? Math.min(1, oStands / oSlots) : 0;
  
  const dSlots = mgt[selectedDest.id]?.slots?.[infraClass] || 0;
  const dStands = mgt[selectedDest.id]?.stands?.[infraClass] || 0;
  const dRatio = dSlots > 0 ? Math.min(1, dStands / dSlots) : 0;
  
  return ((oRatio + dRatio) / 2) * 2;
};



import { getEventMultipliers } from "./eventSystem";

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
    extraDemandFactor: number = 1
) {
    const mvValues = [0.89, 0.91, 0.92, 0.96, 1.03, 1.10, 1.15, 1.14, 1.06, 0.95, 0.88, 1.00];
    const Mv = mvValues[currentMonth - 1] || 1.0;
    const S = difficulty === 'Easy' ? 1.2 : difficulty === 'Normal' ? 1.1 : 1.0;
    const E = 1;

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

    const baseDemand = 34.141967 * Math.pow(totalInteraction, 0.448351) * S * E * tcDemandMultiplier * eventMult * extraDemandFactor;
    const businessRatio = totalInteraction > 0 ? businessInteraction / totalInteraction : 0.5;
    const premiumMultiplier = Math.pow(timeClass / 8, 0.7);

    const firstPct = Math.max(0.01, 0.05 * businessRatio * Math.pow(premiumMultiplier, 1.5));
    const busPct = Math.max(0.05, 0.15 * businessRatio * premiumMultiplier);
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
       formulaVars: { b1, t1, b2, t2, businessRatio, premiumMultiplier, Mv, S, E, totalInteraction, eventMult, tcDemandMultiplier, extraDemandFactor }
    };
}

export function calculateBasePrices(distance: number, timeClass: number) {
    let baseEconomy = 30 + (distance * 0.05);

    if (timeClass === 1 || timeClass === 2) {
        baseEconomy *= 1.15;
    } else if (timeClass === 3 || timeClass === 4) {
        baseEconomy *= 1.10;
    } else if (timeClass === 5) {
        baseEconomy *= 1.05;
    }

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


export function calculateClassSatisfaction(c: string, aircraft: any, config: any, dur: number, airportManagement: any, routeOrigin: string, routeDest: string, difficulty: string, slotType: string = 'regional') {
      const timeClass = getFlightTimeClass(dur);
      const multiplier = TIME_CLASS_SAT_MULTIPLIERS[timeClass] || 1.0;
      const mealCount = timeClass <= 5 ? 1 : timeClass <= 7 ? 2 : 3;
      
      let cateringSat = 0;
      for (let i = 0; i < mealCount; i++) {
          cateringSat += getCateringOpt(config.catering, i).sat;
      }
      const extrasSat = getMultiOptionSum(config.extras, EXTRAS_OPTIONS).sat;
      const serviceSat = getMultiOptionSum(config.service, SERVICE_OPTIONS).sat;
      
      const loungeBonus = getLoungeBonus(routeOrigin, c, airportManagement) + getLoungeBonus(routeDest, c, airportManagement);
      
      const originMgt = airportManagement[routeOrigin];
      const originStandLimit = originMgt?.slots?.[slotType] || 0;
      const originStands = originMgt?.stands?.[slotType] || 0;
      let standBonus = 0;
      if (originStandLimit > 0 && originStands >= originStandLimit) {
         standBonus = 2; // +2 sat for having stands
      }
      

      const oAirport = airportManagement[routeOrigin] || {};
      const hasSelfDesks = (oAirport?.desks?.self || 0) > 0;
      const hasNormalDesks = (oAirport?.desks?.normal || 0) > 0;
      const isPremium = c === 'business' || c === 'first' || c === 'premium';
      
      let deskPenalty = 0;
      if (!hasSelfDesks && !hasNormalDesks) deskPenalty = -15;
      else if (isPremium && !hasNormalDesks) deskPenalty = -25;
      else if (!isPremium && hasSelfDesks && !hasNormalDesks) deskPenalty = 5;

      const planeSat = getPlaneSat(aircraft);

      const hardProduct = Math.max(1, 20 + planeSat + (extrasSat * multiplier) + standBonus);
      const softProduct = Math.max(1, 20 + ((cateringSat + serviceSat) * multiplier) + loungeBonus + deskPenalty);
      
      const providedQuality = Math.sqrt(hardProduct * softProduct);
      
      const expectationBase: Record<string, number> = { economy: 12, premium: 30, business: 65, first: 95 };
      const eBase = expectationBase[c] || 18;
      const expectationMultiplier = 1.0 + ((timeClass - 1) * 0.15);
      const expectationTarget = eBase * expectationMultiplier;
      
      const baseSat = (providedQuality / expectationTarget) * 100;
      const adjustedSat = Math.round(Math.max(0, adjustSatForDifficulty(baseSat, difficulty)));
      
      return {
         hardProduct: Math.round(hardProduct),
         softProduct: Math.round(softProduct),
         providedQuality: Math.round(providedQuality),
         expectationTarget: Math.round(expectationTarget),
         satisfactionPercentage: adjustedSat
      };
}

export function getPriceDemandMultiplier(price: number, satBasePrice: number, sat: number) {
    const baseElasticity = 1.5;
    const elasticity = Math.max(0.5, baseElasticity - (sat / 200));
    const rawDemand = Math.pow(satBasePrice / price, elasticity);
    return Math.min(1.5, rawDemand);
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
  extraDemandFactor: number = 1
) {
  const dist = route.distance || 0;
  const fuelPricePerL = Math.round((fuelPrice / 3.78541) * 1000) / 1000;
  const weeklyFlights = route.schedule?.length || route.weeklyFlights || 0;
  const flightLegs = route.schedule ? route.schedule.reduce((acc: number, s: any) => acc + (s.isOneWay ? 1 : 2), 0) : weeklyFlights * 2;

  // Initial Costs
  const totalWeeklyFuelLiters = (7.5 * aircraft.capacity * (dist / 100)) / (0.75 + (aircraft.efficiency / 70)) * flightLegs;
  const weeklyFuelCost = fuelPricePerL * totalWeeklyFuelLiters;
  
  // Crew Costs (Base: 2 Pilots * 100/hr + FAs * 40/hr)
  const durMin = Number(route.durMin) || 0;
  const flightHoursWeekly = (durMin * flightLegs) / 60;
  const faCount = Math.ceil(aircraft.capacity / 50);
  const hourlyCrewRate = (2 * 100) + (faCount * 40);
  const weeklyCrewCost = hourlyCrewRate * flightHoursWeekly;
  
  // Assuming staff cost is same as crew or similar if handled differently
  const weeklyStaffCost = weeklyCrewCost * 0.3; // Just a flat ground staff assumption
  
  const originAirport = airportsMap.get(route.origin);
  const destAirport = airportsMap.get(route.destination);
  const originLevel = originAirport?.level || 0;
  const destLevel = destAirport?.level || 0;
  
  const originHub = airportManagement[route.origin]?.level >= 2;
  const destHub = airportManagement[route.destination]?.level >= 2;

  const getLandingFee = (level: number, hub: boolean, type: string) => {
    switch (type.toLowerCase()) {
      case 'regional': return Math.floor((2000 + 100 * level) * 1.1 * (hub ? 0.95 : 1));
      case 'narrowbody': return Math.floor((2500 + 100 * level) * 1.1 * (hub ? 0.95 : 1));
      case 'widebody': return Math.floor((3000 + 150 * level) * 1.1 * (hub ? 0.95 : 1));
      default: return 2200;
    }
  };

  // Infrastructure is keyed by lower-case class names ("regional" / "narrowbody" /
  // "widebody") while aircraft data capitalises them, so normalise once here.
  // Passing the capitalised form made every slots/stands lookup miss silently.
  const slotType = String(aircraft.class || 'regional').toLowerCase();
  const originLandingFees = getLandingFee(originLevel, originHub, slotType) * weeklyFlights;
  const destLandingFees = getLandingFee(destLevel, destHub, slotType) * weeklyFlights;

  const originCheckInUnit = originHub ? 0.475 : 0.5;
  const destCheckInUnit = destHub ? 0.475 : 0.5;
  const getPaxHandlingUnit = (level: number) => level >= 5 ? 5 : level >= 3 ? 4 : 3;

  const timeClass = getFlightTimeClass(durMin);

  let routeSat: Record<string, number> = {};
  const satisfactionDetails: Record<string, any> = {};
  const classConfigs = route.classConfigs || {};

  // PRE-CALCULATE SATISFACTION PER CLASS
  const originDeskSim = getDeskSim(route.origin, airportManagement, allRoutes, fleet, undefined, undefined, aircraft, weeklyFlights, route.id);
  const destDeskSim = getDeskSim(route.destination, airportManagement, allRoutes, fleet, undefined, undefined, aircraft, weeklyFlights, route.id);
  const overloadPenalty = (originDeskSim.sat < 0 ? originDeskSim.sat : 0) + (destDeskSim.sat < 0 ? destDeskSim.sat : 0);

  ['economy', 'premium', 'business', 'first'].forEach(c => {
    const seats = aircraft.config?.[c] || 0;
    if (seats > 0) {
      const config = classConfigs[c] || classConfigs.general || { catering: [['none']], extras: ['none'], service: ['none'] };
      
      const satData = calculateClassSatisfaction(c, aircraft, config, durMin, airportManagement, route.origin, route.destination, difficulty, slotType);

      routeSat[c] = Math.max(0, satData.satisfactionPercentage + overloadPenalty);

      // Returned as part of the result instead of being written onto the route
      // argument, which is a React state object at most call sites.
      satisfactionDetails[c] = {
        ...satData,
        satisfactionPercentage: routeSat[c],
        overloadPenalty
      };
    }
  });

  const originStats = getAirportStats(originAirport, currentYear);
  const destStats = getAirportStats(destAirport, currentYear);

  const demandData = calculateDemand(
    originStats.business, originStats.tourism,
    destStats.business, destStats.tourism,
    timeClass, currentMonth, difficulty, currentYear, extraDemandFactor
  );

  const bases = calculateBasePrices(dist, timeClass);
  let totalPax = 0;
  let totalRev = 0;
  const paxByClass: Record<string, { actual: number, max: number }> = {};
  const ticketPrices = route.activeTicketPrices || route.ticketPrices || { economy: bases.economy, premium: bases.premium, business: bases.business, first: bases.first };

  let totalWeeklyCateringCost = 0;
  
  // CALCULATE PAX AND DEPENDENT COSTS
  ['economy', 'premium', 'business', 'first'].forEach(c => {
    const seats = aircraft.config?.[c] || 0;
    if (seats > 0) {
      const maxPax = demandData[c as keyof typeof demandData] as number;
      const sat = routeSat[c];
      const satMultiplier = getSatMultiplier(sat);
      const satBase = Math.round(bases[c as keyof typeof bases] * satMultiplier);
      const price = ticketPrices[c];
      const demMult = getPriceDemandMultiplier(price, satBase, sat);
      
      const targetPax = Math.floor(maxPax * demMult);
      const weeklySupply = seats * flightLegs;
      
      const actualPax = forceFullLoad ? weeklySupply : Math.min(weeklySupply, targetPax);
      
      paxByClass[c] = { actual: actualPax, max: weeklySupply };
      totalPax += actualPax;
      totalRev += actualPax * price;
      
      // Calculate catering cost for this class's ACTUAL pax
      const config = classConfigs[c] || classConfigs.general || { catering: [['none']], extras: ['none'], service: ['none'] };
      const mealCount = timeClass <= 5 ? 1 : timeClass <= 7 ? 2 : 3;
      let catSum = 0;
      for (let i = 0; i < mealCount; i++) catSum += getCateringOpt(config.catering, i).cost;
      const extSum = getMultiOptionSum(config.extras, EXTRAS_OPTIONS).cost;
      const srvSum = getMultiOptionSum(config.service, SERVICE_OPTIONS).cost;
      
      totalWeeklyCateringCost += (catSum + extSum + srvSum) * actualPax;
    }
  });

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
    routeSat,
    satisfactionDetails,
    demandData,
    distance: dist,
    durMin,
    timeClass,
    flightLegs,
    weeklyFlights,
    weightedSeatsPerWeek,
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
}): number {
  const baseValue = plane.basePrice || 10000000;
  const condGenFactor = ((plane.conditionGeneral ?? 100) / 100) * 0.45;
  const condIntFactor = ((plane.conditionInterior ?? 100) / 100) * 0.15;
  return Math.round(baseValue * (0.30 + condGenFactor + condIntFactor));
}

export function getSlotPurchaseCost(type: string) {
  switch (type) {
    case 'regional': return 25000;
    case 'narrowbody': return 50000;
    case 'widebody': return 100000;
    default: return 25000;
  }
}
