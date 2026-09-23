/**
 * The rival airlines: how they are founded and how they play a month.
 *
 * This lived inside App.tsx, where nothing could test it -- which is how the
 * whole AI economy ended up running on a fallback constant (see
 * buildAiSimAircraft below). It is plain data in, data out, so it can now be
 * exercised without a browser.
 */
import { calculateDistance } from '../data/airports';
import { rawAirports, airportsMapAdjusted } from '../data/airportRegistry';
import type { Airport } from '../data/airportTypes';
import { aircraftList } from '../data/aircraft';
import {
  calculateRouteFinancials,
  getFlightTimeClass,
  calculateBasePrices,
  getJetFuelPrice,
  RouteOffer
} from './financeUtils';
import type { AiAirline } from '../components/CompetitorsView';
import type { GameMessage } from './gameTypes';
import { findNonFinite } from './invariants';
import { logWarn, logError } from './debugLog';
import { nextMessageId } from './messages';

type Personality = 'flag' | 'lcc' | 'expansionist' | 'optimizer' | 'boutique';

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
export function buildAiSimAircraft(plane: AiAirline['fleet'][number], personality: Personality) {
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

const REALISTIC_HUBS: Record<string, string> = {
  LH: "FRA",
  AF: "CDG",
  BA: "LHR",
  PA: "JFK",
  UA: "SFO",
  SR: "ZRH",
  KL: "AMS",
  AZ: "FCO",
  SK: "CPH",
  IB: "MAD",
  JL: "HND",
  QF: "SYD",
  DL: "ATL",
  SQ: "SIN",
  CX: "HKG"
};

export const generateAiAirlines = (count: number, difficultyVal: string, playerHubId: string, startDateOffset: number = 0): AiAirline[] => {
  const pool = [
    { name: "Lufthansa", code: "LH" },
    { name: "Air France", code: "AF" },
    { name: "British Airways", code: "BA" },
    { name: "Pan American", code: "PA" },
    { name: "United Airlines", code: "UA" },
    { name: "Swissair", code: "SR" },
    { name: "KLM Royal Dutch", code: "KL" },
    { name: "Alitalia", code: "AZ" },
    { name: "Scandinavian SAS", code: "SK" },
    { name: "Iberia", code: "IB" },
    { name: "Japan Airlines", code: "JL" },
    { name: "Qantas", code: "QF" },
    { name: "Delta Air Lines", code: "DL" },
    { name: "Singapore Airlines", code: "SQ" },
    { name: "Cathay Pacific", code: "CX" }
  ];

  const shuffledPool = [...pool].sort(() => 0.5 - Math.random());
  const selectedList = shuffledPool.slice(0, Math.min(count, shuffledPool.length));

  const fallbackHubs = ["LHR", "CDG", "JFK", "HND", "AMS", "FCO", "MAD", "ORD", "SIN", "SYD", "DXB", "LAX", "FRA", "MUC", "ZRH", "SFO", "ATL", "CPH", "HKG"];
  
  const personalitiesList: ('flag' | 'lcc' | 'expansionist' | 'optimizer' | 'boutique')[] = ['flag', 'lcc', 'expansionist', 'optimizer', 'boutique'];
  const shuffledPersonalities = [...personalitiesList].sort(() => 0.5 - Math.random());

  return selectedList.map((airline, idx) => {
    let hub = REALISTIC_HUBS[airline.code] || "CDG";
    if (hub === playerHubId) {
      const remainingHubs = fallbackHubs.filter(h => h !== playerHubId && !Object.values(REALISTIC_HUBS).includes(h));
      hub = remainingHubs[idx % remainingHubs.length] || "CDG";
    }

    // Determine personality archetype
    const personality = shuffledPersonalities[idx % shuffledPersonalities.length];

    // Capital Reserves Variation based on personality + realistic small random noise
    const baseCapitalScale = difficultyVal === 'Hard' ? 120000000 : difficultyVal === 'Normal' ? 80000000 : 50000000;
    let prestigeMultiplier = 1.0;
    if (personality === 'flag') prestigeMultiplier = 1.25;
    else if (personality === 'boutique') prestigeMultiplier = 1.12;
    else if (personality === 'lcc') prestigeMultiplier = 0.88;
    else if (personality === 'expansionist') prestigeMultiplier = 0.94;

    const noise = Math.floor((Math.random() - 0.5) * 6000000); // ±3,000,000
    const finalCapital = Math.floor(baseCapitalScale * prestigeMultiplier + noise);

    const aggression = personality === 'expansionist' ? 9 : personality === 'lcc' ? 8 : personality === 'flag' ? 6 : personality === 'optimizer' ? 4 : 5;

    const fleet: any[] = [];
    const numInitialPlanes = difficultyVal === 'Hard' ? 4 : difficultyVal === 'Normal' ? 3 : 2;
    
    for (let i = 0; i < numInitialPlanes; i++) {
      const isReg = i > 0 || difficultyVal === 'Easy';
      const wantedClass = isReg ? 'regional' : 'narrowbody';
      
      const options = aircraftList.filter(a => {
        const isClass = a.class.toLowerCase() === wantedClass;
        const available = startDateOffset >= a.firstDeliveryOffset && (a.lastDeliveryOffset === null || startDateOffset <= a.lastDeliveryOffset);
        return isClass && available;
      });
      
      // Select appropriate plane, adding score weighting according to personality
      const sortedOptions = [...options].sort((a, b) => {
        let scoreA = a.popularity;
        let scoreB = b.popularity;
        
        const ageA = startDateOffset - a.firstDeliveryOffset;
        const ageB = startDateOffset - b.firstDeliveryOffset;
        
        scoreA -= ageA * 0.2; // penalty for age relative to simulation start
        scoreB -= ageB * 0.2;

        // Personality weightings
        if (personality === 'lcc') {
          scoreA += (a.capacity || 100) * 0.15 + (a.efficiency || 50) * 0.6;
          scoreB += (b.capacity || 100) * 0.15 + (b.efficiency || 50) * 0.6;
        } else if (personality === 'flag') {
          scoreA += (a.popularity || 50) * 1.5;
          scoreB += (b.popularity || 50) * 1.5;
        } else if (personality === 'boutique') {
          scoreA += (a.maxRange || 1000) * 0.02;
          scoreB += (b.maxRange || 1000) * 0.02;
        } else if (personality === 'optimizer') {
          scoreA += (a.efficiency || 50) * 1.2;
          scoreB += (b.efficiency || 50) * 1.2;
        }
        
        // Add random variation so they don't always pick identically
        scoreA += (Math.random() - 0.5) * 15;
        scoreB += (Math.random() - 0.5) * 15;
        
        return scoreB - scoreA;
      });
      
      const planeSpec = sortedOptions[0] || options[0] || aircraftList.find(a => a.class.toLowerCase() === wantedClass) || aircraftList[0];
      
      const newReg = `${airline.code}-A${100 + i}`;

      // Set seating configurations depending on strategic focus
      const config = { economy: 100, premium: 0, business: 0, first: 0 };
      const cap = planeSpec.capacity || 131;
      if (personality === 'lcc') {
        config.economy = Math.floor(cap * 0.96);
        config.premium = Math.floor(cap * 0.04);
        config.business = 0;
        config.first = 0;
      } else if (personality === 'flag') {
        config.economy = Math.floor(cap * 0.65);
        config.premium = Math.floor(cap * 0.15);
        config.business = Math.floor(cap * 0.12);
        config.first = cap - config.economy - config.premium - config.business;
      } else if (personality === 'boutique') {
        config.economy = Math.floor(cap * 0.45);
        config.premium = Math.floor(cap * 0.25);
        config.business = Math.floor(cap * 0.20);
        config.first = cap - config.economy - config.premium - config.business;
      } else if (personality === 'optimizer') {
        config.economy = Math.floor(cap * 0.76);
        config.premium = Math.floor(cap * 0.14);
        config.business = Math.floor(cap * 0.07);
        config.first = cap - config.economy - config.premium - config.business;
      } else { // expansionist
        config.economy = Math.floor(cap * 0.88);
        config.premium = Math.floor(cap * 0.08);
        config.business = Math.floor(cap * 0.04);
        config.first = 0;
      }
      
      const totalConfig = config.economy + config.premium + config.business + config.first;
      if (totalConfig !== cap) {
        config.economy += (cap - totalConfig);
      }

      fleet.push({
        id: planeSpec.id,
        manufacturer: planeSpec.manufacturer,
        family: planeSpec.family,
        type: planeSpec.type,
        class: planeSpec.class.toLowerCase() as 'regional' | 'narrowbody' | 'widebody',
        reg: newReg,
        maxRange: planeSpec.maxRange,
        capacity: planeSpec.capacity,
        basePrice: planeSpec.basePrice,
        popularity: planeSpec.popularity,
        efficiency: planeSpec.efficiency,
        cruiseSpeed: planeSpec.cruiseSpeed,
        purchasedAt: startDateOffset,
        conditionInterior: 100,
        conditionGeneral: 100,
        config
      });
    }

    const routes: any[] = [];
    const hubAirport = airportsMapAdjusted.get(hub);
    
    if (hubAirport) {
      const numRoutes = Math.min(fleet.length, 2);
      // The player's hub used to be excluded here, which made it a sanctuary:
      // the one airport where competition would bite hardest was the one place
      // rivals never flew. With demand now shared, that exemption has to go.
      const sortedDests = rawAirports.filter(a => a.id !== hub);
      
      let destIdx = 0;
      for (let rIndex = 0; rIndex < numRoutes; rIndex++) {
        const activePlane = fleet[rIndex];
        if (!activePlane) continue;
        
        // Filter based on personality destination search preferences
        let pickedDest = null;
        for (let tries = 0; tries < 50; tries++) {
          const testDest = sortedDests[(destIdx + tries) % sortedDests.length];
          const dist = calculateDistance(hubAirport.coords[0], hubAirport.coords[1], testDest.coords[0], testDest.coords[1]);
          if (dist <= activePlane.maxRange && dist > 150) {
            // Flags and boutique prefer level 3+ destinations primarily, if possible
            if ((personality === 'flag' || personality === 'boutique') && testDest.level < 3 && tries < 30) {
              continue;
            }
            pickedDest = testDest;
            destIdx += tries + 1;
            break;
          }
        }
        
        if (pickedDest) {
          const distance = Math.floor(calculateDistance(hubAirport.coords[0], hubAirport.coords[1], pickedDest.coords[0], pickedDest.coords[1]));
          const durMin = Math.floor((distance / activePlane.cruiseSpeed) * 60 + 40);
          
          let departures = difficultyVal === 'Hard' ? 14 : difficultyVal === 'Normal' ? 10 : 7;
          if (personality === 'lcc') departures = Math.floor(departures * 1.4);
          else if (personality === 'boutique') departures = Math.max(3, Math.floor(departures * 0.6));
          departures = Math.max(2, departures);

          routes.push({
            origin: hub,
            destination: pickedDest.id,
            aircraft: activePlane.id,
            aircraftReg: activePlane.reg,
            aircraftClass: activePlane.class,
            departures,
            monthlyProfit: 0,
            distance,
            durMin
          });
        }
      }
    }

    return {
      id: `ai_${airline.code.toLowerCase()}`,
      name: airline.name,
      code: airline.code,
      hub,
      capital: finalCapital,
      aiDifficulty: difficultyVal as 'Easy' | 'Normal' | 'Hard',
      fleet,
      routes,
      monthlyProfitsHistory: [Math.floor(finalCapital * 0.05)],
      personality,
      aggression
    };
  });
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
  const monthStr = (1 + (currentDateOffset % 12)).toString().padStart(2, '0');
  const yearStr = (1960 + Math.floor(currentDateOffset / 12)).toString();
  const dateStr = `${monthStr}/${yearStr}`;

  // Rivals buy fuel on the same market the player does. This used to read the
  // price table directly and skip getEventMultipliers, so through the 1973 oil
  // shock the player paid double while the AI paid the undisturbed price for
  // eighteen months — and again in 1979 and 1990.
  const getFuelPriceForAi = (offset: number, diff: 'Easy' | 'Normal' | 'Hard') =>
    getJetFuelPrice(1960 + Math.floor(offset / 12), 1 + (offset % 12), diff);

  // Everyone flying, as offers: the player plus every AI. An airline's own
  // entries are filtered out per airline below.
  const playerOffers: RouteOffer[] = playerRoutes.map(r => ({
    origin: r.origin,
    destination: r.destination,
    departures: r.schedule?.length || 0
  }));

  const currentYearNum = 1960 + Math.floor(currentDateOffset / 12);
  const currentMonthNum = 1 + (currentDateOffset % 12);

  const personalitiesList: ('flag' | 'lcc' | 'expansionist' | 'optimizer' | 'boutique')[] = ['flag', 'lcc', 'expansionist', 'optimizer', 'boutique'];

  const updatedAis = currentAiAirlines.map((ai, idxOfAiZone) => {
    const newFleet = [...ai.fleet];
    // Clone each route: the loop below writes monthlyProfit/distance/durMin onto these
    // objects, and mutating the ones held in React state would be a state mutation.
    const newRoutes = ai.routes.map(r => ({ ...r }));
    const currentFuelPrice = getFuelPriceForAi(currentDateOffset, ai.aiDifficulty);

    // Everyone else on the market from this airline's point of view: the player
    // plus the other AI carriers, never itself.
    const aiRivalOffers: RouteOffer[] = [
      ...playerOffers,
      ...currentAiAirlines
        .filter(other => other.id !== ai.id)
        .flatMap(other => (other.routes || []).map(r => ({
          origin: r.origin,
          destination: r.destination,
          departures: r.departures || 0
        })))
    ];

    // Dynamic Safe fallback if save file was old
    const personality = ai.personality || personalitiesList[idxOfAiZone % personalitiesList.length] || 'optimizer';
    const aggression = ai.aggression ?? (personality === 'expansionist' ? 9 : personality === 'lcc' ? 8 : personality === 'flag' ? 6 : personality === 'optimizer' ? 4 : 5);

    let totalMonthlyProfit = 0;
    
    newRoutes.forEach(r => {
      const assignedPlane = newFleet.find(f => f.reg === r.aircraftReg) || newFleet[0];
      if (!assignedPlane) {
        r.monthlyProfit = 0;
        return;
      }

      const originAir = airportsMapAdjusted.get(r.origin);
      const destAir = airportsMapAdjusted.get(r.destination);
      const distance = r.distance || (originAir && destAir ? Math.floor(calculateDistance(originAir.coords[0], originAir.coords[1], destAir.coords[0], destAir.coords[1])) : 1500);
      r.distance = distance;
      r.durMin = r.durMin || Math.floor((distance / (assignedPlane.cruiseSpeed || 800)) * 60 + 40);

      if (assignedPlane.maxRange && assignedPlane.maxRange < distance) {
        r.monthlyProfit = -150000;
        totalMonthlyProfit += r.monthlyProfit;
        return;
      }

      const mockSchedule = Array(r.departures).fill({ isOneWay: false });
      
      // Dynamic Catering simulation based on airline profile!
      let mockClassConfigs = {
        economy: { catering: [['none']], extras: ['none'], service: ['none'] },
        premium: { catering: [['none']], extras: ['none'], service: ['none'] },
        business: { catering: [['none']], extras: ['none'], service: ['none'] },
        first: { catering: [['none']], extras: ['none'], service: ['none'] }
      };

      if (personality === 'flag') {
        mockClassConfigs = {
          economy: { catering: [['b15']], extras: ['water', 'pillows'], service: ['none'] },
          premium: { catering: [['s13']], extras: ['softdrinks', 'headphones', 'pillows'], service: ['drinks'] },
          business: { catering: [['p6', 's1']], extras: ['alcohol', 'amenities', 'headphones'], service: ['drinks', 'seat_coord'] },
          first: { catering: [['l13', 'p15']], extras: ['premium_alcohol', 'amenities_luxury', 'headphones', 'pajamas'], service: ['dine_demand', 'turndown'] }
        };
      } else if (personality === 'boutique') {
        mockClassConfigs = {
          economy: { catering: [['b14']], extras: ['water'], service: ['none'] },
          premium: { catering: [['s9']], extras: ['softdrinks', 'pillows'], service: ['drinks'] },
          business: { catering: [['p9', 'p2']], extras: ['alcohol', 'amenities_premium', 'headphones'], service: ['dine_demand'] },
          first: { catering: [['l14', 'l4']], extras: ['premium_alcohol', 'amenities_luxury', 'pajamas'], service: ['dine_demand', 'turndown'] }
        };
      } else if (personality === 'optimizer') {
        mockClassConfigs = {
          economy: { catering: [['b5']], extras: ['water'], service: ['none'] },
          premium: { catering: [['s8']], extras: ['softdrinks', 'pillows'], service: ['drinks'] },
          business: { catering: [['p6']], extras: ['alcohol', 'amenities'], service: ['drinks'] },
          first: { catering: [['l12']], extras: ['premium_alcohol', 'amenities_premium'], service: ['dine_demand'] }
        };
      } else if (personality === 'expansionist') {
        mockClassConfigs = {
          economy: { catering: [['none']], extras: ['none'], service: ['none'] },
          premium: { catering: [['b14']], extras: ['water'], service: ['none'] },
          business: { catering: [['s10']], extras: ['softdrinks', 'pillows'], service: ['drinks'] },
          first: { catering: [['p5']], extras: ['alcohol', 'amenities'], service: ['drinks'] }
        };
      } // LCC uses default 'none'

      const aircraftSimObj = buildAiSimAircraft(assignedPlane, personality);

      // Ticket Pricing Skew simulation based on personality!
      const timeClass = getFlightTimeClass(r.durMin);
      const bases = calculateBasePrices(distance, timeClass);
      const ticketPrices = { economy: bases.economy, premium: bases.premium, business: bases.business, first: bases.first };

      if (ai.aiDifficulty === 'Easy') {
        ticketPrices.economy = Math.round(bases.economy * 2.25);
        ticketPrices.premium = Math.round(bases.premium * 2.30);
        ticketPrices.business = Math.round(bases.business * 2.40);
        ticketPrices.first = Math.round(bases.first * 2.50);
      } else if (personality === 'lcc') {
        ticketPrices.economy = Math.round(bases.economy * 0.82);
        ticketPrices.premium = Math.round(bases.premium * 0.85);
      } else if (personality === 'flag') {
        ticketPrices.economy = Math.round(bases.economy * 1.05);
        ticketPrices.premium = Math.round(bases.premium * 1.10);
        ticketPrices.business = Math.round(bases.business * 1.14);
        ticketPrices.first = Math.round(bases.first * 1.18);
      } else if (personality === 'boutique') {
        ticketPrices.economy = Math.round(bases.economy * 1.02);
        ticketPrices.premium = Math.round(bases.premium * 1.14);
        ticketPrices.business = Math.round(bases.business * 1.25);
        ticketPrices.first = Math.round(bases.first * 1.35);
      } else if (personality === 'optimizer') {
        ticketPrices.economy = Math.round(bases.economy * 1.04);
        ticketPrices.premium = Math.round(bases.premium * 1.04);
        ticketPrices.business = Math.round(bases.business * 1.06);
        ticketPrices.first = Math.round(bases.first * 1.06);
      } else { // expansionist
        ticketPrices.economy = Math.round(bases.economy * 0.92);
        ticketPrices.premium = Math.round(bases.premium * 0.94);
        ticketPrices.business = Math.round(bases.business * 0.95);
      }

      const routeSimObj = {
        origin: r.origin,
        destination: r.destination,
        distance,
        durMin: r.durMin,
        schedule: mockSchedule,
        classConfigs: mockClassConfigs,
        ticketPrices: ticketPrices
      };

      const aiAirportManagement: Record<string, any> = {};
      aiAirportManagement[r.origin] = {
        level: 3,
        slots: { regional: 100, narrowbody: 100, widebody: 100 },
        stands: { regional: 100, narrowbody: 100, widebody: 100 },
        desks: { normal: 10, self: 10 }
      };
      aiAirportManagement[r.destination] = {
        level: 2,
        slots: { regional: 100, narrowbody: 100, widebody: 100 },
        stands: { regional: 100, narrowbody: 100, widebody: 100 },
        desks: { normal: 5, self: 5 }
      };

      try {
        const finObj = calculateRouteFinancials(
          routeSimObj,
          aircraftSimObj,
          currentFuelPrice,
          aiAirportManagement,
          currentYearNum,
          currentMonthNum,
          ai.aiDifficulty,
          airportsMapAdjusted,
          [],
          [aircraftSimObj],
          false,
          1,
          aiRivalOffers
        );

        const computedMonthlyValue = Math.floor(finObj.estWeeklyProfit * 4);
        // A non-finite result is a bug in the inputs, not a result: report it
        // and book nothing, rather than inventing a profit as the old fallback did.
        if (Number.isFinite(computedMonthlyValue)) {
          r.monthlyProfit = computedMonthlyValue;
        } else {
          logWarn('ai', `Non-finite result for ${ai.code} ${r.origin}-${r.destination}`, findNonFinite(finObj));
          r.monthlyProfit = 0;
        }
      } catch (err) {
        logError('ai', `Route calculation failed for ${ai.code} ${r.origin}-${r.destination}`, err);
        r.monthlyProfit = 0;
      }

      totalMonthlyProfit += r.monthlyProfit;
    });

    const baseSubsidy = 450000;
    const finalCalculatedTurnover = totalMonthlyProfit + baseSubsidy;

    let newCapital = ai.capital + finalCalculatedTurnover;
    const nextProfitsHistory = [...(ai.monthlyProfitsHistory || []), finalCalculatedTurnover];
    if (nextProfitsHistory.length > 12) nextProfitsHistory.shift();

    // AI Fleet Modernization (replacing obsolete or overly old airframes with contemporary models of same class)
    let modernizedReg = '';
    let oldName = '';
    let newName = '';
    
    const obsoleteIndex = newFleet.findIndex(plane => {
      const spec = aircraftList.find(a => a.id === plane.id);
      if (!spec) return false;
      const age = currentDateOffset - (plane.purchasedAt || 0);
      const isPastProduction = spec.lastDeliveryOffset !== null && currentDateOffset > (spec.lastDeliveryOffset + 144);
      const isTooOld = age > 240; // 20 years old
      return isPastProduction || isTooOld;
    });

    if (obsoleteIndex !== -1) {
      const oldPlane = newFleet[obsoleteIndex];
      const wantedClass = oldPlane.class;
      
      const availableReplacements = aircraftList.filter(a => {
        const isClass = a.class.toLowerCase() === wantedClass;
        const delivered = currentDateOffset >= a.firstDeliveryOffset;
        const activeProduction = a.lastDeliveryOffset === null || currentDateOffset <= a.lastDeliveryOffset;
        return isClass && delivered && activeProduction;
      });

      if (availableReplacements.length > 0) {
        const salvageValue = Math.floor((oldPlane.basePrice || 1000000) * 0.20);
        const tempCapital = newCapital + salvageValue;
        
        const affordable = availableReplacements.filter(a => a.basePrice <= tempCapital + 5000000);
        const bestReplacement = affordable.sort((a, b) => b.popularity - a.popularity)[0] || 
                                availableReplacements.sort((a, b) => a.basePrice - b.basePrice)[0];

        if (bestReplacement && bestReplacement.id !== oldPlane.id) {
          newCapital = newCapital + salvageValue - bestReplacement.basePrice;

          // Align the replaced aircraft config to their personality
          const config = { economy: 100, premium: 0, business: 0, first: 0 };
          const cap = bestReplacement.capacity || 131;
          if (personality === 'lcc') {
            config.economy = Math.floor(cap * 0.96);
            config.premium = Math.floor(cap * 0.04);
            config.business = 0;
            config.first = 0;
          } else if (personality === 'flag') {
            config.economy = Math.floor(cap * 0.65);
            config.premium = Math.floor(cap * 0.15);
            config.business = Math.floor(cap * 0.12);
            config.first = cap - config.economy - config.premium - config.business;
          } else if (personality === 'boutique') {
            config.economy = Math.floor(cap * 0.45);
            config.premium = Math.floor(cap * 0.25);
            config.business = Math.floor(cap * 0.20);
            config.first = cap - config.economy - config.premium - config.business;
          } else if (personality === 'optimizer') {
            config.economy = Math.floor(cap * 0.76);
            config.premium = Math.floor(cap * 0.14);
            config.business = Math.floor(cap * 0.07);
            config.first = cap - config.economy - config.premium - config.business;
          } else { // expansionist
            config.economy = Math.floor(cap * 0.88);
            config.premium = Math.floor(cap * 0.08);
            config.business = Math.floor(cap * 0.04);
            config.first = 0;
          }

          const totalConfig = config.economy + config.premium + config.business + config.first;
          if (totalConfig !== cap) {
            config.economy += (cap - totalConfig);
          }
          
          newFleet[obsoleteIndex] = {
            id: bestReplacement.id,
            manufacturer: bestReplacement.manufacturer,
            family: bestReplacement.family,
            type: bestReplacement.type,
            class: bestReplacement.class.toLowerCase() as 'regional' | 'narrowbody' | 'widebody',
            reg: oldPlane.reg,
            maxRange: bestReplacement.maxRange,
            capacity: bestReplacement.capacity,
            basePrice: bestReplacement.basePrice,
            popularity: bestReplacement.popularity,
            efficiency: bestReplacement.efficiency,
            cruiseSpeed: bestReplacement.cruiseSpeed,
            purchasedAt: currentDateOffset,
            conditionInterior: 100,
            conditionGeneral: 100,
            config
          };

          modernizedReg = oldPlane.reg;
          oldName = `${oldPlane.manufacturer || ''} ${oldPlane.type}`;
          newName = `${bestReplacement.manufacturer} ${bestReplacement.type}`;
        }
      }
    }

    if (modernizedReg) {
      newMessages.push({
        id: nextMessageId(),
        text: `FLEET MODERNIZATION: ${ai.name} (${ai.code}) has retired their obsolete ${oldName} (Reg: ${modernizedReg}) and introduced a brand new ${newName} to their scheduled fleet.`,
        isRead: false,
        dateStr
      });
    }

    let planeModel = '';
    let planeCost = 0;
    let planeSpec: any = null;

    let buyProb = 0.12;
    if (ai.aiDifficulty === 'Normal') buyProb = 0.45;
    if (ai.aiDifficulty === 'Hard') buyProb = 0.85;

    // Apply personality multipliers to buying probability
    if (personality === 'expansionist') buyProb = Math.min(0.90, buyProb * 1.35);
    else if (personality === 'lcc') buyProb = Math.min(0.85, buyProb * 1.25);
    else if (personality === 'optimizer') buyProb = buyProb * 0.70;
    else if (personality === 'boutique') buyProb = buyProb * 0.60;

    const allPlanesAssigned = newFleet.every(plane => newRoutes.some(rt => rt.aircraftReg === plane.reg));

    if (Math.random() < buyProb || allPlanesAssigned) {
      const queryDate = currentDateOffset;
      const availableAircraft = aircraftList.filter(a => {
        const delivered = queryDate >= a.firstDeliveryOffset;
        const activeProduction = a.lastDeliveryOffset === null || queryDate <= a.lastDeliveryOffset;
        return delivered && activeProduction;
      });

      if (availableAircraft.length > 0) {
        // Aggressive buyers (low cost / expansionists) are willing to spend slightly more of their cash reserves
        const safeSpendRatio = (personality === 'expansionist' || personality === 'lcc') ? 0.65 : 0.45;
        const affordable = availableAircraft.filter(a => a.basePrice <= newCapital * safeSpendRatio);
        
        if (affordable.length > 0) {
          if (ai.aiDifficulty === 'Easy') {
            planeSpec = affordable[Math.floor(Math.random() * affordable.length)];
          } else if (personality === 'lcc') {
            // LCC prioritizes capacity index and efficiency!
            planeSpec = affordable.sort((a,b) => {
              const capA = (a.capacity || 100) * (a.efficiency || 50);
              const capB = (b.capacity || 100) * (b.efficiency || 50);
              return capB - capA;
            })[0];
          } else if (personality === 'boutique') {
            // Boutique prioritizes widebodies or higher range sectors
            planeSpec = affordable.sort((a,b) => (b.maxRange || 1000) - (a.maxRange || 1000))[0];
          } else if (personality === 'flag') {
            // Flag carriers love high status popular widebodies or primary narrowbodies
            const widebodies = affordable.filter(a => a.class.toLowerCase() === 'widebody');
            planeSpec = widebodies.sort((a,b) => b.popularity - a.popularity)[0] || 
                        affordable.sort((a,b) => b.popularity - a.popularity)[0];
          } else if (personality === 'optimizer') {
            // Optimizers strictly search for highest fuel efficiency
            planeSpec = affordable.sort((a,b) => (b.efficiency || 50) - (a.efficiency || 50))[0];
          } else {
            // Expansionist / defaults
            planeSpec = affordable.sort((a,b) => b.popularity - a.popularity)[0];
          }
        }
      }

      if (planeSpec) {
        planeCost = planeSpec.basePrice;
        planeModel = planeSpec.type;
        
        newCapital -= planeCost;
        const newReg = `${ai.code}-A${100 + newFleet.length}`;

        // Build customized layout for this newly purchased aircraft
        const config = { economy: 100, premium: 0, business: 0, first: 0 };
        const cap = planeSpec.capacity || 131;
        if (ai.aiDifficulty === 'Easy') {
          if (idxOfAiZone % 2 === 0) {
            config.first = Math.floor(cap * 0.85);
            config.economy = cap - config.first;
          } else {
            config.premium = Math.floor(cap * 0.50);
            config.business = Math.floor(cap * 0.38);
            config.economy = cap - config.premium - config.business;
          }
        } else if (personality === 'lcc') {
          config.economy = Math.floor(cap * 0.96);
          config.premium = Math.floor(cap * 0.04);
          config.business = 0;
          config.first = 0;
        } else if (personality === 'flag') {
          config.economy = Math.floor(cap * 0.65);
          config.premium = Math.floor(cap * 0.15);
          config.business = Math.floor(cap * 0.12);
          config.first = cap - config.economy - config.premium - config.business;
        } else if (personality === 'boutique') {
          config.economy = Math.floor(cap * 0.45);
          config.premium = Math.floor(cap * 0.25);
          config.business = Math.floor(cap * 0.20);
          config.first = cap - config.economy - config.premium - config.business;
        } else if (personality === 'optimizer') {
          config.economy = Math.floor(cap * 0.76);
          config.premium = Math.floor(cap * 0.14);
          config.business = Math.floor(cap * 0.07);
          config.first = cap - config.economy - config.premium - config.business;
        } else { // expansionist
          config.economy = Math.floor(cap * 0.88);
          config.premium = Math.floor(cap * 0.08);
          config.business = Math.floor(cap * 0.04);
          config.first = 0;
        }

        const totalConfig = config.economy + config.premium + config.business + config.first;
        if (totalConfig !== cap) {
          config.economy += (cap - totalConfig);
        }

        newFleet.push({
          id: planeSpec.id,
          manufacturer: planeSpec.manufacturer,
          family: planeSpec.family,
          type: planeSpec.type,
          class: planeSpec.class.toLowerCase() as 'regional' | 'narrowbody' | 'widebody',
          reg: newReg,
          maxRange: planeSpec.maxRange,
          capacity: planeSpec.capacity,
          basePrice: planeSpec.basePrice,
          popularity: planeSpec.popularity,
          efficiency: planeSpec.efficiency,
          cruiseSpeed: planeSpec.cruiseSpeed,
          purchasedAt: currentDateOffset,
          conditionInterior: 100,
          conditionGeneral: 100,
          config
        });

        // Rival Industry News has been removed per user request. We do not generate text here.
      }
    }

    const idlePlane = newFleet.find(plane => !newRoutes.some(rt => rt.aircraftReg === plane.reg));

    // Custom capital buffer trigger threshold based on expanding appetite
    const expansionCapitalBuffer = (personality === 'expansionist' || personality === 'lcc') ? 3500000 : 7000000;

    if (idlePlane && newCapital > expansionCapitalBuffer) {
      let openProb = 0.35;
      if (ai.aiDifficulty === 'Normal') openProb = 0.60;
      if (ai.aiDifficulty === 'Hard') openProb = 0.85;

      if (personality === 'expansionist') openProb = Math.min(0.95, openProb * 1.35);
      else if (personality === 'lcc') openProb = Math.min(0.90, openProb * 1.20);
      else if (personality === 'optimizer') openProb = openProb * 0.70;

      if (Math.random() < openProb) {
        const existingDestinations = newRoutes.map(rt => rt.destination);
        const availableDests = allAirports.filter(a => 
          a.id !== ai.hub &&
          !existingDestinations.includes(a.id)
        );

        if (availableDests.length > 0) {
          let selectedDest = availableDests[0];
          const sorted = [...availableDests].sort((a, b) => b.level - a.level);
          
          if (personality === 'flag' || personality === 'boutique') {
            // Elite networks expand strictly to key hubs
            selectedDest = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
          } else if (personality === 'lcc' || personality === 'expansionist') {
            // High randomness to support secondary/regional airports
            selectedDest = availableDests[Math.floor(Math.random() * availableDests.length)];
          } else {
            // optimizer / average
            const topHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
            selectedDest = topHalf[Math.floor(Math.random() * Math.min(5, topHalf.length))];
          }

          const originAir = airportsMapAdjusted.get(ai.hub);
          const destAir = airportsMapAdjusted.get(selectedDest.id);

          if (originAir && destAir) {
            const distance = Math.floor(calculateDistance(originAir.coords[0], originAir.coords[1], destAir.coords[0], destAir.coords[1]));
            const routeCost = 1500000;

            if (idlePlane.maxRange >= distance && newCapital >= routeCost) {
              newCapital -= routeCost;
              const durMin = Math.floor((distance / (idlePlane.cruiseSpeed || 800)) * 60 + 40);

              let departures = ai.aiDifficulty === 'Hard' ? 14 : ai.aiDifficulty === 'Normal' ? 10 : 7;
              if (personality === 'lcc') departures = Math.floor(departures * 1.4);
              else if (personality === 'boutique') departures = Math.max(3, Math.floor(departures * 0.6));
              departures = Math.max(2, departures);

              newRoutes.push({
                origin: ai.hub,
                destination: selectedDest.id,
                aircraft: idlePlane.id,
                aircraftReg: idlePlane.reg,
                aircraftClass: idlePlane.class,
                departures,
                monthlyProfit: 0,
                distance,
                durMin
              });

              newMessages.push({
                id: nextMessageId(),
                text: `NETWORK EXPANSION: ${ai.name} connects ${ai.hub} to ${selectedDest.name} (${selectedDest.id}) with the newly scheduled ${idlePlane.type}.`,
                isRead: false,
                dateStr
              });
            }
          }
        }
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
