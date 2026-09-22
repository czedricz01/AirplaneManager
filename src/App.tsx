/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, ReactNode, useEffect, useRef, useMemo } from "react";
import { FinancialReport } from "./components/FinancialReport";
import { motion, AnimatePresence } from "motion/react";
import { 
  Plane, 
  Map as MapIcon, 
  Settings as SettingsIcon, 
  Save, 
  ChevronRight,
  Globe,
  Navigation,
  Wind,
  Bird,
  Target,
  X,
  ShoppingCart,
  MapPin,
  Briefcase,
  Users,
  Plus,
  LogOut,
  ChevronDown,
  Bell,
  AlertTriangle,
  Trash2,
  Edit2,
  Check
} from "lucide-react";

import { MapContainer, TileLayer, Marker, CircleMarker, Tooltip, Polyline, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { airportsData, Airport, calculateDistance } from "./data/airports";
import { moreAirports } from "./data/more_airports";
import { LiveTraffic } from "./components/LiveTraffic";
const airportsMap = new Map<string, Airport>();
for (const a of airportsData) airportsMap.set(a.id, a as Airport);
for (const a of moreAirports) {
  if (!airportsMap.has(a.id)) {
    airportsMap.set(a.id, a as unknown as Airport);
  }
}
const rawAirports: Airport[] = Array.from(airportsMap.values());

const sovietAirports = new Set(['SVO', 'DME', 'VKO', 'LED', 'OVB', 'KBP', 'MSQ', 'TAS', 'ALA', 'EVN', 'GYD', 'TBS', 'KIV', 'PRG', 'WAW', 'BUD', 'SOF', 'OTP', 'SXF']);
const westernAirports = new Set(['JFK', 'EWR', 'LGA', 'ORD', 'LAX', 'SFO', 'ATL', 'DFW', 'MIA', 'IAD', 'DCA', 'LHR', 'LGW', 'CDG', 'ORY', 'FRA', 'MUC', 'AMS', 'MAD', 'BCN', 'FCO', 'MXP', 'ZRH']);

const airports: Airport[] = rawAirports.map(a => {
  const isSoviet = sovietAirports.has(a.id);
  const isWesternMajor = westernAirports.has(a.id);
  
  if (!isSoviet && !isWesternMajor || !a.stats) return a;

  const sourceStats = a.stats;
  const newStats: Record<string, { tourism: number; business: number }> = { ...sourceStats };
  for (const yearStr in sourceStats) {
    const year = parseInt(yearStr);
    let multiplier = 1.0;

    if (isSoviet) {
      if (year < 1990) multiplier = 0.45; // Significant dampening of Soviet era
      else if (year < 2000) multiplier = 0.55; // Post-Soviet transition collapse
      else multiplier = 0.65; // Modern era adjustment - Russian aviation challenges
    } else if (isWesternMajor) {
      if (year < 1975) multiplier = 1.15; // Buff early Western hubs
    }

    if (multiplier !== 1.0) {
      newStats[yearStr] = {
        tourism: Math.max(1, Math.round(sourceStats[yearStr].tourism * multiplier)),
        business: Math.max(1, Math.round(sourceStats[yearStr].business * multiplier))
      };
    }
  }
  return { ...a, stats: newStats };
});

export const airportsMapAdjusted = new Map<string, Airport>();
airports.forEach(a => airportsMapAdjusted.set(a.id, a));

import { jetFuelPrices } from "./data/fuelPrices";
import { BuyAircraftView } from "./components/BuyAircraftView";
import { MyFleetView, OwnedAircraft } from "./components/MyFleetView";
import { RoutesView } from "./components/RoutesView";
import { RoutePlannerView } from "./components/RoutePlannerView";
import { AirportsView } from "./components/AirportsView";
import { AirportDetailView } from "./components/AirportDetailView";
import RouteScheduleEditView from "./components/RouteScheduleEditView";
import { calculateRouteFinancials, getAirportUpkeep, getFlightTimeClass, calculateBasePrices } from "./lib/financeUtils";
import { ConfigurePurchaseView, ConfigOutput } from "./components/ConfigurePurchaseView";
import { MyCompanyView } from "./components/MyCompanyView";
import { CompetitorsView, AiAirline } from "./components/CompetitorsView";

import { Aircraft, aircraftList } from "./data/aircraft";
import { getEventMultipliers, setRuntimeRandomEvents, HistoricalEvent } from "./lib/eventSystem";
import { generateUniqueRegistration } from "./utils/registration";
import { supabase, isCloudConfigured, ensureProfile } from "./lib/supabase";
import { AuthGate } from "./components/AuthGate";
import {
  SaveMetadata,
  listSaves,
  readSave,
  writeSave,
  deleteSave as deleteSaveSlot,
  syncPending,
  findLegacyLocalSaves,
  importLegacyLocalSaves,
} from "./lib/cloudSaves";

function getGreatCirclePoints(start: [number, number], end: [number, number], segments = 150): [number, number][] {
  const points: [number, number][] = [];
  
  const lat1 = start[0] * Math.PI / 180;
  const lon1 = start[1] * Math.PI / 180;
  const lat2 = end[0] * Math.PI / 180;
  const lon2 = end[1] * Math.PI / 180;

  const d = Math.acos(
    Math.min(1, Math.max(-1, Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon1 - lon2)))
  );

  if (d === 0 || isNaN(d)) {
    return [start, end];
  }

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const A = Math.sin((1 - t) * d) / Math.sin(d);
    const B = Math.sin(t * d) / Math.sin(d);
    
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI;
    let lon = Math.atan2(y, x) * 180 / Math.PI;

    if (points.length > 0) {
      const prevLon = points[points.length - 1][1];
      while (lon - prevLon > 180) lon -= 360;
      while (lon - prevLon < -180) lon += 360;
    }

    points.push([lat, lon]);
  }
  return points;
}

/**
 * Cached polyline for an airport pair on a given world copy.
 *
 * A route's great circle never changes, but this used to be recomputed — 101
 * trigonometric points per route per world copy — on every single render of App,
 * which happens on any capital, message or zoom change.
 */
const ROUTE_PATH_SEGMENTS = 100;
const routePathCache = new Map<string, [number, number][]>();

function getRoutePath(a1: Airport, a2: Airport, offset: number): [number, number][] {
  const key = `${a1.id}>${a2.id}@${offset}`;
  const cached = routePathCache.get(key);
  if (cached) return cached;

  const points = getGreatCirclePoints(a1.coords, a2.coords, ROUTE_PATH_SEGMENTS)
    .map(p => [p[0], p[1] + offset] as [number, number]);
  routePathCache.set(key, points);
  return points;
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

const generateAiAirlines = (count: number, difficultyVal: string, playerHubId: string, startDateOffset: number = 0): AiAirline[] => {
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
    const hubAirport = airportsMap.get(hub);
    
    if (hubAirport) {
      const numRoutes = Math.min(fleet.length, 2);
      const sortedDests = rawAirports.filter(a => a.id !== hub && a.id !== playerHubId);
      
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

const simulateAiAirlinesTurn = (
  currentAiAirlines: AiAirline[],
  allAirports: Airport[],
  currentDateOffset: number,
  playerHubId: string
): { updatedAis: AiAirline[], newMessages: GameMessage[] } => {
  const newMessages: GameMessage[] = [];
  const monthStr = (1 + (currentDateOffset % 12)).toString().padStart(2, '0');
  const yearStr = (1960 + Math.floor(currentDateOffset / 12)).toString();
  const dateStr = `${monthStr}/${yearStr}`;

  const getFuelPriceForAi = (offset: number, diff: 'Easy' | 'Normal' | 'Hard') => {
    const y = 1960 + Math.floor(offset / 12);
    const m = 1 + (offset % 12);
    const dateKey = `${y}-${m.toString().padStart(2, '0')}`;
    let pr = jetFuelPrices[dateKey] || 1.05;
    if (diff === 'Hard') {
      pr *= 1.15;
    }
    return pr;
  };

  const currentYearNum = 1960 + Math.floor(currentDateOffset / 12);
  const currentMonthNum = 1 + (currentDateOffset % 12);

  const personalitiesList: ('flag' | 'lcc' | 'expansionist' | 'optimizer' | 'boutique')[] = ['flag', 'lcc', 'expansionist', 'optimizer', 'boutique'];

  const updatedAis = currentAiAirlines.map((ai, idxOfAiZone) => {
    const newFleet = [...ai.fleet];
    // Clone each route: the loop below writes monthlyProfit/distance/durMin onto these
    // objects, and mutating the ones held in React state would be a state mutation.
    const newRoutes = ai.routes.map(r => ({ ...r }));
    const currentFuelPrice = getFuelPriceForAi(currentDateOffset, ai.aiDifficulty);

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

      const originAir = airportsMap.get(r.origin);
      const destAir = airportsMap.get(r.destination);
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

      const aircraftSimObj = {
        capacity: assignedPlane.capacity || 131,
        efficiency: assignedPlane.efficiency || 50,
        popularity: assignedPlane.popularity || 70,
        class: assignedPlane.class ? (assignedPlane.class.charAt(0).toUpperCase() + assignedPlane.class.slice(1)) : 'Narrowbody',
        registration: assignedPlane.reg,
        config: assignedPlane.config || {
          economy: Math.floor((assignedPlane.capacity || 131) * 0.85),
          premium: Math.floor((assignedPlane.capacity || 131) * 0.10),
          business: Math.floor((assignedPlane.capacity || 131) * 0.04),
          first: Math.max(0, (assignedPlane.capacity || 131) - Math.floor((assignedPlane.capacity || 131) * 0.85) - Math.floor((assignedPlane.capacity || 131) * 0.10) - Math.floor((assignedPlane.capacity || 131) * 0.04))
        }
      };

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
          airportsMap,
          [],
          [aircraftSimObj]
        );

        const computedMonthlyValue = Math.floor(finObj.estWeeklyProfit * 4);
        r.monthlyProfit = isNaN(computedMonthlyValue) ? 100000 : computedMonthlyValue;
      } catch (err) {
        console.error("AI route calculation failure:", err);
        r.monthlyProfit = 120000;
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
        id: Date.now() + Math.floor(Math.random() * 20000),
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
          a.id !== playerHubId &&
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

          const originAir = airportsMap.get(ai.hub);
          const destAir = airportsMap.get(selectedDest.id);

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
                id: Date.now() + Math.floor(Math.random() * 10000),
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

function MapEvents({ setZoom, setBounds }: { setZoom: (z: number) => void, setBounds?: (b: L.LatLngBounds) => void }) {
  useMapEvents({
    zoomend: (e) => {
      setZoom(e.target.getZoom());
      if (setBounds) setBounds(e.target.getBounds());
    },
    moveend: (e) => {
      if (setBounds) setBounds(e.target.getBounds());
    }
  });
  return null;
}

type ViewState = 'login' | 'main-menu' | 'start-menu' | 'monthly-overview' | 'game';
type ActiveWindow = 'map' | 'buy-aircraft' | 'my-fleet' | 'routes' | 'airports' | 'my-company' | 'competitors' | 'new-route';

export interface GameMessage {
  id: number;
  text: string;
  isRead: boolean;
  dateStr: string;
  details?: {
    title: string;
    source: string;
    content: string;
  };
}

export type ManagementLevel = 0 | 1 | 2 | 3; // 0: None, 1: Basic, 2: Hub, 3: Owner

export interface AirportInfrastructure {
  level: ManagementLevel;
  slots: { regional: number; narrowbody: number; widebody: number };
  stands: { regional?: number; narrowbody: number; widebody: number }; // manual upgrades if level < 2
  autoBuyStands?: boolean;
  desks: { normal: number; self: number };
  hubAutoUpgrade?: boolean;
  hubFacilities?: {
    hangar?: boolean;
    vipLounge?: boolean;
    catering?: boolean;
  };
}

export interface SimulatedRoute {
  id: string;
  airline: string;
  origin: string;
  destination: string;
  distance: number;
  aircraft: string;
  weeklyFlights: number;
  paxPerWeek: number;
  paxByClass?: Record<string, { actual: number, max: number }>;
  schedule?: any[];
  classConfigs?: Record<string, { catering: string[][], extras: string[], service: string[] }>;
  ticketPrices?: Record<string, number>;
  activeTicketPrices?: Record<string, number>;
  durMin?: number;
  turnoverMin?: number;
  routeSat?: Record<string, number>;
  monthlyProfit?: number;
  weeklyRevenue?: number;
  weeklyCost?: number;
}

export const randomEventTemplates = [
  {
    title: "Volcanic Ash Disruption",
    description: "An unexpected volcanic eruption has filled key coordinates with ash clouds, forcing flight path redirections and minor booking dips.",
    demandMin: 0.88, demandMax: 0.92,
    fuelMin: 1.02, fuelMax: 1.08,
    durationMin: 2, durationMax: 4
  },
  {
    title: "Summer Vacation Surge",
    description: "An intense, prolonged heatwave trigger-starts an unprecedented summer flight rush! All routes see major bookings.",
    demandMin: 1.10, demandMax: 1.15,
    fuelMin: 1.04, fuelMax: 1.10,
    durationMin: 2, durationMax: 3
  },
  {
    title: "Global Commerce Summit",
    description: "Massive international tech and economic summits catalyze a heavy surge in first/business class travelers.",
    demandMin: 1.05, demandMax: 1.09,
    fuelMin: 0.96, fuelMax: 1.01,
    durationMin: 1, durationMax: 2
  },
  {
    title: "Refinery Pipeline Outages",
    description: "Unplanned pipeline maintenance in major refinery sectors has triggered a sudden hike in immediate jet fuel delivery prices.",
    demandMin: 0.97, demandMax: 1.01,
    fuelMin: 1.25, fuelMax: 1.40,
    durationMin: 2, durationMax: 3
  },
  {
    title: "Biofuel Refinement Breakthrough",
    description: "Widespread integration of new agricultural synthetic fuel mixtures reduces traditional jet A-1 demand and pushes fuel costs down.",
    demandMin: 1.00, demandMax: 1.04,
    fuelMin: 0.82, fuelMax: 0.88,
    durationMin: 3, durationMax: 5
  },
  {
    title: "Economic Slump",
    description: "A minor global economic contraction impacts customer confidence. Forward bookings are moderately slowed down.",
    demandMin: 0.85, demandMax: 0.90,
    fuelMin: 0.88, fuelMax: 0.95,
    durationMin: 3, durationMax: 6
  },
  {
    title: "Wanderlust Marketing Campaign",
    description: "Highly successful global advertising campaigns promote exploration and long-distance holidays.",
    demandMin: 1.10, demandMax: 1.15,
    fuelMin: 1.01, fuelMax: 1.05,
    durationMin: 3, durationMax: 4
  },
  {
    title: "Geopolitical Energy Friction",
    description: "Temporary political standoffs in major energy regions cause speculators to bid up fuel and hydrocarbon costs.",
    demandMin: 0.95, demandMax: 0.99,
    fuelMin: 1.15, fuelMax: 1.25,
    durationMin: 2, durationMax: 4
  }
];

export const GENERAL_CHECK_COST = 200000;

/** How much airframe condition a general check restores. The fifth and later checks
 *  restore nothing, so the UI must not charge for them. */
export function getGeneralCheckRestore(checksDone: number): number {
  if (checksDone === 0) return 50;
  if (checksDone === 1) return 50;
  if (checksDone === 2) return 40;
  if (checksDone === 3) return 30;
  return 0;
}

export default function App() {
  const [view, setView] = useState<ViewState>('login');
  const [activeWindow, setActiveWindow] = useState<ActiveWindow>('map');
  const [user, setUser] = useState<string | null>(null);
  // The signed-in player's id. It scopes savegames, both in the cloud and in the
  // local mirror, so two accounts on one browser never see each other's games.
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(!isCloudConfigured);
  const [cloudOnline, setCloudOnline] = useState(false);

  const [messages, setMessages] = useState<GameMessage[]>([
    { 
      id: 1, 
      text: "Herzlich willkommen bei Neo Airlines!", 
      isRead: false, 
      dateStr: "01/1960",
      details: {
        title: "Welcome to Neo Airlines",
        source: "Board of Directors",
        content: "Dear Chief Executive,\n\nWe are absolutely thrilled to welcome you to the helm of Neo Airlines!\n\nAs the golden age of aviation dawns, you are tasked with building a global network, managing slot infrastructure, setting up luxurious passenger experiences, and modernizing a state-of-the-art fleet.\n\nKeep a close eye on the market, look out for annual aircraft releases from major aerospace corporations, and be ready to adapt to unexpected global events.\n\nGood luck, Captain!"
      }
    }
  ]);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [randomEvents, setRandomEventsState] = useState<HistoricalEvent[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<GameMessage | null>(null);

  useEffect(() => {
    setRuntimeRandomEvents(randomEvents);
  }, [randomEvents]);
  
  const unreadMessagesCount = messages.filter(m => !m.isRead).length;

  const [decimalSymbol, setDecimalSymbol] = useState(".");
  const [airportManagement, setAirportManagement] = useState<Record<string, AirportInfrastructure>>({});
  const [showRivalRoutes, setShowRivalRoutes] = useState(true);
  const [showYourRoutes, setShowYourRoutes] = useState(true);
  const [showLiveTraffic, setShowLiveTraffic] = useState(false);
  const [isMapSettingsOpen, setIsMapSettingsOpen] = useState(false);
  const [realTime, setRealTime] = useState(new Date());

  // Ticks the live traffic clock. Recomputing positions is cheap now that the markers
  // are plain cached SVG icons, so 20s gives visible movement without a render loop.
  useEffect(() => {
    if (!showLiveTraffic) return;
    setRealTime(new Date());
    const interval = setInterval(() => setRealTime(new Date()), 20000);
    return () => clearInterval(interval);
  }, [showLiveTraffic]);
  const [routes, setRoutes] = useState<SimulatedRoute[]>([]);
  const [latestReport, setLatestReport] = useState<any>(null);
  const [openReportCategories, setOpenReportCategories] = useState<string[]>([]);
  
  const toggleReportCategory = (category: string) => {
    setOpenReportCategories(prev => 
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  // Load game data from local storage if available
  useEffect(() => {
    const savedRoutes = localStorage.getItem('neo_routes');
    if (savedRoutes) {
      try {
        const parsed = JSON.parse(savedRoutes);
        // Data Migration/Cleanup: Ensure all numerical fields are valid
        const cleaned = parsed.map((r: any) => ({
          ...r,
          distance: Number(r.distance) || 0,
          paxPerWeek: Number(r.paxPerWeek) || 0,
          weeklyFlights: Number(r.weeklyFlights) || 0,
          durMin: Number(r.durMin) || 0,
          turnoverMin: Number(r.turnoverMin) || 0,
          schedule: r.schedule?.map((s: any) => ({
            ...s,
            startHour: (isNaN(Number(s.startHour)) ? 12 : Number(s.startHour)),
            startMin: (isNaN(Number(s.startMin)) ? 0 : Number(s.startMin)),
            dayId: (isNaN(Number(s.dayId)) ? 1 : Number(s.dayId)),
            durMin: (isNaN(Number(s.durMin)) ? 0 : Number(s.durMin)),
            turnoverMin: (isNaN(Number(s.turnoverMin)) ? 0 : Number(s.turnoverMin))
          })) || []
        }));
        setRoutes(cleaned);
      } catch (e) {
        console.error("Failed to load routes", e);
      }
    }
  }, []);

  // Save game data. An empty network has to be written too, otherwise deleting the
  // last route left the old list in storage and it came back on the next page load.
  useEffect(() => {
    try {
      if (routes.length > 0) {
        localStorage.setItem('neo_routes', JSON.stringify(routes));
      } else {
        localStorage.removeItem('neo_routes');
      }
    } catch (e) {
      console.error("Failed to persist routes", e);
    }
  }, [routes]);


  const [airlineName, setAirlineName] = useState("");
  const [airlineCode, setAirlineCode] = useState("");
  const [selectedHub, setSelectedHub] = useState<string>("FRA");
  const [difficulty, setDifficulty] = useState("Normal");
  const [startingBudget, setStartingBudget] = useState("$25M");
  const [debugMode, setDebugMode] = useState(() => {
    return localStorage.getItem('airline_debug_mode') === 'true';
  });
  const [capital, setCapital] = useState(0);
  const [fleet, setFleet] = useState<OwnedAircraft[]>([]);
  const [selectedPurchasingAircraft, setSelectedPurchasingAircraft] = useState<Aircraft | OwnedAircraft | null>(null);
  const [externalSelectedRoute, setExternalSelectedRoute] = useState<SimulatedRoute | null>(null);
  const [aiAirlinesCount, setAiAirlinesCount] = useState(6);
  const [aiDifficulty, setAiDifficulty] = useState("Normal");
  const [aiAirlines, setAiAirlines] = useState<AiAirline[]>([]);
  const [pendingSlotBills, setPendingSlotBills] = useState<number>(0);
  const [startDateOffset, setStartDateOffset] = useState(0); // 0 = 01/1960
  const [currentDateOffset, setCurrentDateOffset] = useState(0);
  
  const [uiScaleSetting, setUiScaleSetting] = useState(1.0);
  const [autoScale, setAutoScale] = useState(1.0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280) {
        setAutoScale(window.innerWidth / 1280);
      } else {
        setAutoScale(1.0);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hub Migration: assign a hub to existing aircraft if they have routes
  useEffect(() => {
    if (fleet.length > 0 && routes.length > 0) {
      let changed = false;
      const updatedFleet = fleet.map(ac => {
        if (!ac.hubId) {
          const firstRoute = routes.find(r => r.aircraft === ac.registration);
          if (firstRoute) {
            changed = true;
            return { ...ac, hubId: firstRoute.origin };
          }
        }
        return ac;
      });
      if (changed) {
        setFleet(updatedFleet);
      }
    }
  }, [routes, fleet]);

  const [zoom, setZoom] = useState(3);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);

  const visibleWorldOffsets = useMemo(() => {
    if (!mapBounds) return [-360, 0, 360];
    const offsets = [];
    if (mapBounds.getWest() < -180) offsets.push(-360);
    if (mapBounds.getEast() > 180) offsets.push(360);
    if (mapBounds.getWest() <= 180 && mapBounds.getEast() >= -180) offsets.push(0);
    if (offsets.length === 0) offsets.push(0);
    // Always include nearby worlds if zoomed out to avoid pop-in
    if (zoom < 3 && !offsets.includes(-360)) offsets.push(-360);
    if (zoom < 3 && !offsets.includes(360)) offsets.push(360);
    if (zoom < 3 && !offsets.includes(0)) offsets.push(0);
    return offsets;
  }, [mapBounds, zoom]);

  // Flattened once: passing a fresh array on every render defeated the memoisation
  // inside LiveTraffic.
  const aiRouteList = useMemo(
    () => aiAirlines.flatMap(a => a.routes || []),
    [aiAirlines]
  );

  const finalUiScale = uiScaleSetting * autoScale;

  const formatDate = (offset: number) => {
    const year = 1960 + Math.floor(offset / 12);
    const month = 1 + (offset % 12);
    return `${month.toString().padStart(2, '0')}/${year}`;
  };

  const getFuelData = (offset: number) => {
    const year = 1960 + Math.floor(offset / 12);
    const month = 1 + (offset % 12);
    const dateKey = `${year}-${month.toString().padStart(2, '0')}`;
    let price = jetFuelPrices[dateKey] || 1.05;
    
    // Apply Historical Event modifiers
    const { fuelMult } = getEventMultipliers(offset);
    price *= fuelMult;

    if (difficulty === 'Hard') {
      price *= 1.15; // 15% more expensive fuel/sprit on Hard difficulty
    }
    
    let trend = "";
    if (offset > 0) {
      const prevYear = 1960 + Math.floor((offset - 1) / 12);
      const prevMonth = 1 + ((offset - 1) % 12);
      const prevKey = `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;
      let prevPrice = jetFuelPrices[prevKey] || 1.05;
      const { fuelMult: prevMult } = getEventMultipliers(offset - 1);
      prevPrice *= prevMult;

      if (difficulty === 'Hard') {
        prevPrice *= 1.15;
      }
      const diff = ((price - prevPrice) / prevPrice) * 100;
      if (diff > 0) trend = `+${diff.toFixed(1)}%`;
      else if (diff < 0) trend = `${diff.toFixed(1)}%`;
      else trend = "0%";
    } else {
      trend = "0%";
    }
    
    return { price, trend };
  };

  const fuelData = getFuelData(currentDateOffset);

  const getBaseGlobalDemand = (offset: number) => {
    const mvValues = [0.89, 0.91, 0.92, 0.96, 1.03, 1.10, 1.15, 1.14, 1.06, 0.95, 0.88, 1.00];
    const mNum = 1 + (offset % 12);
    const mFactor = mvValues[mNum - 1] || 1.0;
    const { demandMult } = getEventMultipliers(offset);
    
    let trend = "";
    if (offset > 0) {
      const prevMNum = 1 + ((offset - 1) % 12);
      const prevMFactor = mvValues[prevMNum - 1] || 1.0;
      const { demandMult: prevMult } = getEventMultipliers(offset - 1);
      const currentVal = mFactor * demandMult;
      const prevVal = prevMFactor * prevMult;
      const diff = ((currentVal - prevVal) / prevVal) * 100;
      if (diff > 0) trend = `+${diff.toFixed(1)}%`;
      else if (diff < 0) trend = `${diff.toFixed(1)}%`;
      else trend = "0%";
    } else {
      trend = "0%";
    }

    return { value: mFactor * demandMult, trend };
  };

  const globalDemandData = getBaseGlobalDemand(currentDateOffset);

  const handleAirlineCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAirlineCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2));
  };

  // Supabase owns the session: it restores it from storage on load, refreshes the
  // token, and tells us about sign-in and sign-out. Nothing here decides whether a
  // password was correct — that happens on the server.
  useEffect(() => {
    if (!supabase) return;

    let active = true;

    const adopt = (session: import('@supabase/supabase-js').Session | null) => {
      if (!active) return;
      if (session?.user) {
        setUserId(session.user.id);
        const meta = session.user.user_metadata as { display_name?: string } | undefined;
        const name = meta?.display_name || session.user.email || 'Operator';
        setUser(name);
        void ensureProfile(session.user.id, name);
        setView(prev => (prev === 'login' ? 'main-menu' : prev));
      } else {
        setUserId(null);
        setUser(null);
        setSaves([]);
        setView('login');
      }
      setIsAuthResolved(true);
    };

    supabase.auth.getSession().then(({ data }) => adopt(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => adopt(session));

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const [isImportingLegacy, setIsImportingLegacy] = useState(false);

  const cloudStatusLabel = !userId
    ? 'Local only'
    : cloudOnline
      ? 'Cloud synced'
      : 'Offline - changes queued';

  const handleImportLegacySaves = async () => {
    setIsImportingLegacy(true);
    const imported = await importLegacyLocalSaves(userId);
    await refreshSaves();
    setLegacySaveCount(0);
    setIsImportingLegacy(false);
    setAppAlert(
      imported > 0
        ? `Imported ${imported} savegame${imported === 1 ? '' : 's'} into your account.`
        : 'Nothing to import - those savegames are already in your account.'
    );
  };

  // Play without an account when no Supabase project is attached to this build.
  const handleLocalOnly = () => {
    setUserId(null);
    setUser('Local Operator');
    setView('main-menu');
  };

  const handleDisconnect = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUserId(null);
    setUser(null);
    setSaves([]);
    setIsGameMenuOpen(false);
    setView('login');
  };

  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [isPlanningRoute, setIsPlanningRoute] = useState(false);
  const [planningOriginId, setPlanningOriginId] = useState<string | null>(null);
  const [planningDestId, setPlanningDestId] = useState<string | null>(null);
  const [planningReg, setPlanningReg] = useState<string | null>(null);
  const [planningStep, setPlanningStep] = useState<number>(1);
  const [planningSchedule, setPlanningSchedule] = useState<any[]>([]);
  const [planningClassConfigs, setPlanningClassConfigs] = useState<Record<string, any>>({
    general: { catering: [['none']], extras: ['none'], service: ['none'] },
    economy: { catering: [['none']], extras: ['none'], service: ['none'] },
    premium: { catering: [['none']], extras: ['none'], service: ['none'] },
    business: { catering: [['none']], extras: ['none'], service: ['none'] },
    first: { catering: [['none']], extras: ['none'], service: ['none'] }
  });
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editingCabinRouteId, setEditingCabinRouteId] = useState<string | null>(null);
  const [isPurchasingForRoute, setIsPurchasingForRoute] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [routeFilter, setRouteFilter] = useState<string>("");
  const [appAlert, setAppAlert] = useState<string | null>(null);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  
  const [saves, setSaves] = useState<SaveMetadata[]>([]);
  const [legacySaveCount, setLegacySaveCount] = useState(0);

  // Refresh the save list whenever the player changes. listSaves merges the cloud
  // list with the local mirror and reports whether the server answered, which
  // drives the "offline" badge in the menus.
  const refreshSaves = React.useCallback(async () => {
    const { saves: list, cloudOk } = await listSaves(userId);
    setSaves(list);
    setCloudOnline(cloudOk);
    return cloudOk;
  }, [userId]);

  useEffect(() => {
    if (!isAuthResolved) return;
    let cancelled = false;

    (async () => {
      const cloudOk = await refreshSaves();
      if (cancelled) return;

      if (cloudOk) {
        // Anything written while the server was unreachable goes up now.
        const pushed = await syncPending(userId);
        if (pushed > 0 && !cancelled) {
          await refreshSaves();
          setAppAlert(`Synchronised ${pushed} savegame${pushed === 1 ? '' : 's'} that were waiting to upload.`);
        }
      }

      if (!cancelled && userId) {
        setLegacySaveCount(findLegacyLocalSaves().length);
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthResolved, userId, refreshSaves]);

  const [autosaveInterval, setAutosaveInterval] = useState(6);
  const [autosaveOverwrite, setAutosaveOverwrite] = useState(true);
  const [currentSaveId, setCurrentSaveId] = useState<string | null>(null);
  const [currentSaveName, setCurrentSaveName] = useState<string | null>(null);
  const [pendingAutosave, setPendingAutosave] = useState(false);
  const [pendingInitialSave, setPendingInitialSave] = useState(false);
  const [initialSaveFileName, setInitialSaveFileName] = useState("");

  useEffect(() => {
    const savedSettings = localStorage.getItem('neo_autosave_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.autosaveInterval !== undefined) setAutosaveInterval(parsed.autosaveInterval);
        if (parsed.autosaveOverwrite !== undefined) setAutosaveOverwrite(parsed.autosaveOverwrite);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('neo_autosave_settings', JSON.stringify({ autosaveInterval, autosaveOverwrite }));
  }, [autosaveInterval, autosaveOverwrite]);


  // Fix for Leaflet marker icons in React
  useEffect(() => {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);

  const iconCache = useRef<Record<string, L.DivIcon>>({});

  const getAirportIcon = (zoomLevel: number, level: number) => {
    const key = `${zoomLevel}-${level}`;
    if (iconCache.current[key]) return iconCache.current[key];

    let bgColor = "#FACC15"; // aero-yellow
    if (level === 1) bgColor = "#FB923C"; // orange-400
    else if (level === 2) bgColor = "#EA580C"; // orange-600
    else if (level >= 3) bgColor = "#DC2626"; // red-600

    let iconInfo: L.DivIcon;
    if (zoomLevel < 5) {
      // Simple dot for low zoom
      const dotSize = zoomLevel < 3 ? 2 : 3;
      iconInfo = L.divIcon({
        className: '',
        html: `<div style="width: ${dotSize}px; height: ${dotSize}px; background-color: ${bgColor}; border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none;"></div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
    } else if (zoomLevel < 8) {
      // Small circle with border
      const outerSize = Math.max(6, zoomLevel * 1.2);
      iconInfo = L.divIcon({
        className: '',
        html: `<div style="width: ${outerSize}px; height: ${outerSize}px; background-color: ${bgColor}; border: 1px solid black; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
    } else {
      // Complex "radar" icon for high zoom
      const outerSize = Math.max(10, zoomLevel * 2.5);
      iconInfo = L.divIcon({
        className: '',
        html: `<div style="width: ${outerSize}px; height: ${outerSize}px; background-color: ${bgColor}; border: 2px solid black; border-radius: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px rgba(0,0,0,0.5);">
                 <div style="width: 30%; height: 30%; background-color: black; border-radius: 50%;"></div>
                 <div style="position: absolute; width: 120%; height: 120%; border: 1px dashed ${bgColor}; border-radius: 50%; opacity: 0.3;"></div>
               </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
    }
    iconCache.current[key] = iconInfo;
    return iconInfo;
  };

  const visibleAirports = useMemo(() => {
    return airports.filter(airport => {
      const isManaged = (airportManagement[airport.id]?.level || 0) > 0;
      if (isManaged) return true;
      if (zoom < 6) {
        if (airport.level < 3) return false;
      }
      
      // Perform bounding box cull if bounds are available.
      if (mapBounds && zoom >= 4) { // Only do precise cull when somewhat zoomed in
        // Extend bounds slightly to avoid popping issues at screen edges
        const padLat = 5;
        const padLng = 5;
        const lat = airport.coords[0];
        const lng = airport.coords[1];
        
        let inBounds = false;
        // Check for multiple worlds
        for (const offset of [-360, 0, 360]) {
           const adjustedLng = lng + offset;
           if (lat >= mapBounds.getSouth() - padLat && lat <= mapBounds.getNorth() + padLat &&
               adjustedLng >= mapBounds.getWest() - padLng && adjustedLng <= mapBounds.getEast() + padLng) {
               inBounds = true;
               break;
           }
        }
        if (!inBounds) return false;
      } else if (zoom < 4) {
        // At extremely zoomed out levels, cull aggressively if not managed
        if (airport.level < 4) return false; 
      }
      
      return true;
    });
  }, [zoom, mapBounds, airportManagement]);

  const formatNumber = (val: number, decimals: number = 0) => {
    return new Intl.NumberFormat(decimalSymbol === "," ? 'de-DE' : 'en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(val);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(decimalSymbol === "," ? 'de-DE' : 'en-US', { 
      style: 'currency', 
      currency: 'USD', 
      maximumFractionDigits: 0 
    }).format(val);
  };

  const handleAdvanceMonth = () => {
    // Generate Report First using CURRENT date
    // airportsMapAdjusted is the same lookup, built once at module load.
    const localAirportsMap = airportsMapAdjusted;
    const currentFuelPrice = getFuelData(currentDateOffset).price;
    const currentYearNum = 1960 + Math.floor(currentDateOffset / 12);
    const currentMonthNum = 1 + (currentDateOffset % 12);

    let totalRouteRevenues = 0;
    let totalRouteCosts = 0;
    let totalRouteProfit = 0;
    let fuelCosts = 0;
    let fuelLitersUsed = 0;
    let averageFuelPricePerL = 0;
    let cateringCosts = 0;
    let staffCosts = 0;
    let infraCosts = 0;
    let landingFees = 0;
    let paxFees = 0;
    const routeDetails: { id: string, name: string, profit: number, revenue: number, cost: number }[] = [];

    routes.forEach(r => {
      const ac = fleet.find(a => a.registration === r.aircraft);
      if (ac) {
        const fin = calculateRouteFinancials(
          r, ac, currentFuelPrice, airportManagement, currentYearNum, currentMonthNum,
          difficulty, localAirportsMap, routes, fleet
        );
        const mRev = (fin.estWeeklyRev || 0) * 4;
        const mCost = (fin.estWeeklyCosts || 0) * 4;
        const mProfit = (fin.estWeeklyProfit || 0) * 4;

        totalRouteRevenues += mRev;
        totalRouteCosts += mCost;
        totalRouteProfit += mProfit;

        if (fin.costsBreakdown) {
          fuelCosts += fin.costsBreakdown.fuel * 4;
          fuelLitersUsed += (fin.costsBreakdown.fuelLiters || 0) * 4;
          averageFuelPricePerL = fin.costsBreakdown.fuelPriceL || Math.round((currentFuelPrice / 3.78541) * 1000) / 1000;
          cateringCosts += fin.costsBreakdown.catering * 4;
          staffCosts += fin.costsBreakdown.crew * 4;
          infraCosts += fin.costsBreakdown.infra * 4;
          landingFees += (fin.costsBreakdown.landingFees || 0) * 4;
          paxFees += (fin.costsBreakdown.paxFees || 0) * 4;
        }

        routeDetails.push({ 
          id: r.id, 
          name: `${r.origin}-${r.destination} (${r.aircraft})`, 
          profit: mProfit,
          revenue: mRev,
          cost: mCost
        });
      }
    });

    let managementCosts = 0;
    let deskCosts = 0;
    
    Object.entries(airportManagement).forEach(([airportId, mgt]) => {
      const airport = localAirportsMap.get(airportId);
      if (airport) {
         const monthlyUpkeepObj = getAirportUpkeep(airport, mgt, routes, fleet);
         
         const monthSlots = monthlyUpkeepObj.slots.regional + monthlyUpkeepObj.slots.narrowbody + monthlyUpkeepObj.slots.widebody;
         const monthStands = monthlyUpkeepObj.stands.regional + monthlyUpkeepObj.stands.narrowbody + monthlyUpkeepObj.stands.widebody;
         const monthFacs = monthlyUpkeepObj.facilities.hangar + monthlyUpkeepObj.facilities.vip + monthlyUpkeepObj.facilities.catering;
         managementCosts += (monthSlots + monthStands + monthFacs) * 4;

         const monthDesks = monthlyUpkeepObj.desks.normal + monthlyUpkeepObj.desks.self;
         deskCosts += (monthDesks) * 4;
      }
    });

    const totalAirportUpkeep = managementCosts + deskCosts;
    const totalMonthlyProfit = totalRouteProfit - totalAirportUpkeep - pendingSlotBills;

    setLatestReport({
      month: currentMonthNum,
      year: currentYearNum,
      routeRevenues: totalRouteRevenues,
      routeCosts: totalRouteCosts,
      airportUpkeep: totalAirportUpkeep,
      totalProfit: totalMonthlyProfit,
      pendingSlotBills: pendingSlotBills,
      routes: routeDetails,
      breakdown: {
        fuel: fuelCosts,
        fuelLiters: fuelLitersUsed,
        fuelPriceL: averageFuelPricePerL,
        catering: cateringCosts,
        staff: staffCosts,
        routeInfra: infraCosts,
        landingFees: landingFees,
        paxFees: paxFees,
        mgt: managementCosts,
        desks: deskCosts,
        purchasedSlots: pendingSlotBills
      }
    });

    // Apply Financials
    setCapital(prev => prev + totalMonthlyProfit);
    setPendingSlotBills(0);

    // Simulate AI Controlled Airlines
    let aiMessages: GameMessage[] = [];
    if (aiAirlines.length > 0) {
      const { updatedAis, newMessages } = simulateAiAirlinesTurn(
        aiAirlines,
        airports,
        currentDateOffset,
        selectedHub
      );
      setAiAirlines(updatedAis);
      aiMessages = newMessages;
    }

    const nextOffset = currentDateOffset + 1;
    const isNextJanuary = nextOffset % 12 === 0;
    const additionalMessages: GameMessage[] = [];

    // 1. Check January Forecast News
    if (isNextJanuary) {
      const forecastYear = 1960 + Math.floor(nextOffset / 12);
      const debutingAircraft = aircraftList.filter(
        ac => ac.firstDeliveryOffset >= nextOffset && ac.firstDeliveryOffset <= nextOffset + 11
      );

      if (debutingAircraft.length > 0) {
        const textList = debutingAircraft.map(ac => {
          const relMonth = 1 + (ac.firstDeliveryOffset % 12);
          const relMonthStr = relMonth.toString().padStart(2, '0');
          return `• ${ac.manufacturer} ${ac.type} (${ac.class}, Range: ${ac.maxRange}km, Pax: ${ac.capacity}) - Expected debut: ${relMonthStr}/${forecastYear}`;
        }).join("\n");

        additionalMessages.push({
          id: Date.now() + Math.floor(Math.random() * 60000) + 12000,
          text: `LAUNCH PREVIEW ${forecastYear}: ${debutingAircraft.length} new aircraft models scheduled to debut this year (including ${debutingAircraft[0].manufacturer} ${debutingAircraft[0].type}). Click for full forecast.`,
          isRead: false,
          dateStr: `01/${forecastYear}`,
          details: {
            title: `Aviation Forecast ${forecastYear}`,
            source: "Aerospace Forecast Gazette",
            content: `AEROSPACE FORECAST FOR ${forecastYear}\n\nThe world aviation industry expects several landmark aircraft introductions during this upcoming calendar year. Plan your fleet and base configurations accordingly:\n\n${textList}\n\nNote: These aircraft will become purchasable in their launch month offsets inside your hangar. Make sure you upgrade your stands and slots to support their specific configurations!`
          }
        });
      } else {
        additionalMessages.push({
          id: Date.now() + Math.floor(Math.random() * 60000) + 12000,
          text: `LAUNCH PREVIEW ${forecastYear}: No major aircraft releases are scheduled to hit the commercial markets this year.`,
          isRead: false,
          dateStr: `01/${forecastYear}`,
          details: {
            title: `Aviation Forecast ${forecastYear}`,
            source: "Aerospace Forecast Gazette",
            content: `AEROSPACE FORECAST FOR ${forecastYear}\n\nOur analysts report that no major commercial aircraft models are scheduled to make their maiden deliveries during this upcoming calendar year.\n\nAircraft models currently in production will remain the primary pathways for fleet growth worldwide. Use this period of aerospace stability to optimize your routes, build customer satisfaction, and acquire strategically vital airport slot bundles.`
          }
        });
      }
    }

    // 2. Roll for a random event: average 0.6 per year -> 0.05 probability per month (1 / 20)
    if (Math.random() < 0.05) {
      const template = randomEventTemplates[Math.floor(Math.random() * randomEventTemplates.length)];
      const duration = Math.floor(Math.random() * (template.durationMax - template.durationMin + 1)) + template.durationMin;
      const demandMultiplier = Math.round((template.demandMin + Math.random() * (template.demandMax - template.demandMin)) * 100) / 100;
      const fuelMultiplier = Math.round((template.fuelMin + Math.random() * (template.fuelMax - template.fuelMin)) * 100) / 100;

      const newEv = {
        startOffset: nextOffset,
        duration,
        title: template.title,
        description: template.description,
        demandMultiplier,
        fuelMultiplier
      };

      const updatedRandomEvents = [...randomEvents, newEv];
      setRandomEventsState(updatedRandomEvents);
      setRuntimeRandomEvents(updatedRandomEvents);

      const targetMonthStr = (1 + (nextOffset % 12)).toString().padStart(2, '0');
      const targetYearStr = (1960 + Math.floor(nextOffset / 12)).toString();
      const targetDateStr = `${targetMonthStr}/${targetYearStr}`;

      const effectDemandPercent = Math.round((demandMultiplier - 1.0) * 100);
      const effectFuelPercent = Math.round((fuelMultiplier - 1.0) * 100);
      const demandSign = effectDemandPercent >= 0 ? "+" : "";
      const fuelSign = effectFuelPercent >= 0 ? "+" : "";

      additionalMessages.push({
        id: Date.now() + Math.floor(Math.random() * 50000) + 24000,
        text: `GLOBAL EVENT TRIGGERED: "${template.title}" starts next month. Key Impacts: Demand ${demandSign}${effectDemandPercent}%, Fuel ${fuelSign}${effectFuelPercent}%. Click for details.`,
        isRead: false,
        dateStr: targetDateStr,
        details: {
          title: template.title,
          source: "Global Intelligence Agency",
          content: `${template.description}\n\nThis event is active in the world sector starting ${targetDateStr} and will persist for ${duration} months.\n\nProjected Impacts:\n• Global Passenger Demand: ${demandSign}${effectDemandPercent}%\n• Jet Fuel Market Index: ${fuelSign}${effectFuelPercent}%`
        }
      });
    }

    if (aiMessages.length > 0 || additionalMessages.length > 0) {
      setMessages(prev => [...additionalMessages, ...aiMessages, ...prev]);
    }
    
    // Advance time and update view. The autosave decision is made here rather than
    // inside the state updater: updaters must be pure, and StrictMode runs them twice.
    const monthsPassed = nextOffset - startDateOffset;
    if (autosaveInterval >= 1 && autosaveInterval <= 12 && monthsPassed > 0 && monthsPassed % autosaveInterval === 0) {
      setPendingAutosave(true);
    }
    setCurrentDateOffset(nextOffset);

    setRoutes(prevRoutes => prevRoutes.map(r => {
      const activePrices = r.ticketPrices || { economy: 100 };
      const ac = fleet.find(a => a.registration === r.aircraft);
      let updatedRoute = { ...r, activeTicketPrices: activePrices, ticketPrices: activePrices };
      if (ac) {
        const nextFuelPrice = getFuelData(nextOffset).price;
        const nextYearNum = 1960 + Math.floor(nextOffset / 12);
        const nextMonthNum = 1 + (nextOffset % 12);
        const fin = calculateRouteFinancials(
          updatedRoute,
          ac,
          nextFuelPrice,
          airportManagement,
          nextYearNum,
          nextMonthNum,
          difficulty,
          localAirportsMap,
          prevRoutes,
          fleet
        );
        updatedRoute = { ...updatedRoute, ...fin };
      }
      return updatedRoute;
    }));

    setView('monthly-overview');

    const routesByAircraft: Record<string, SimulatedRoute[]> = {};
    routes.forEach(r => {
      if (!routesByAircraft[r.aircraft]) routesByAircraft[r.aircraft] = [];
      routesByAircraft[r.aircraft].push(r);
    });

    // Process month effects 
    setFleet(prevFleet => prevFleet.map(plane => {
      // Calculate weekly flight hours dynamically
      const aircraftRoutes = routesByAircraft[plane.registration] || [];
      let weeklyFlightMinutes = 0;
      aircraftRoutes.forEach(r => {
        if (!r.schedule) return;
        r.schedule.forEach(s => {
          const dur = Number(s.durMin) || 0;
          const turn = Number(s.turnoverMin) || 0;
          weeklyFlightMinutes += s.isOneWay ? (30 + dur + 30) : (30 + dur + turn + dur + 30);
        });
      });
      // Rough monthly logic: 4 weeks per month
      const monthlyFlightHours = isNaN(weeklyFlightMinutes) ? 0 : (weeklyFlightMinutes / 60) * 4;

      // Wear rates. At a busy ~300 block hours per month the cabin needs a refit after
      // roughly eight years and the airframe a general check after about twelve, which
      // is what the refit/check restore values are sized for. The small constant term
      // makes parked aircraft age too, slowly.
      const INTERIOR_WEAR_PER_HOUR = 0.0035;
      const AIRFRAME_WEAR_PER_HOUR = 0.0022;
      const IDLE_WEAR_PER_MONTH = 0.1;

      const interiorDecay = monthlyFlightHours * INTERIOR_WEAR_PER_HOUR + IDLE_WEAR_PER_MONTH;
      // conditionGeneral previously never decreased at all, which made the general
      // check a pure money sink and the "< 40 %" fleet warning unreachable.
      const airframeDecay = monthlyFlightHours * AIRFRAME_WEAR_PER_HOUR + IDLE_WEAR_PER_MONTH;

      return {
        ...plane,
        conditionInterior: Math.max(0, plane.conditionInterior - interiorDecay),
        conditionGeneral: Math.max(0, plane.conditionGeneral - airframeDecay)
      };
    }));
  };

  const [sessionKey, setSessionKey] = useState(Date.now());
  
  const handleSaveGame = async (slotId?: string, customName?: string, isAutosave: boolean = false) => {
    let finalId = slotId;
    let finalName = customName;

    let newSaves = [...saves];
    
    if (isAutosave) {
        if (autosaveOverwrite && currentSaveId) {
            finalId = currentSaveId;
            finalName = currentSaveName || `Save ${new Date().toLocaleString()}`;
        } else {
            let baseId = currentSaveId || `save_${Date.now()}`;
            if (baseId.includes('_auto_')) {
                baseId = baseId.split('_auto_')[0];
            }
            const baseName = (currentSaveName || 'Save').replace(/\s*\(Autosave.*\)$/, '');
            
            const autoSlots = [1, 2, 3].map(i => `${baseId}_auto_${i}`);
            const existingAutos = saves.filter(s => autoSlots.includes(s.id));
            let nextIndex = 1;
            
            if (existingAutos.length >= 3) {
                const oldest = existingAutos.reduce((a, b) => a.timestamp < b.timestamp ? a : b);
                nextIndex = parseInt(oldest.id.split('_auto_')[1]);
                await deleteSaveSlot(userId, oldest.id);
                newSaves = newSaves.filter(s => s.id !== oldest.id);
            } else if (existingAutos.length > 0) {
                const usedIndices = existingAutos.map(s => parseInt(s.id.split('_auto_')[1]));
                nextIndex = [1, 2, 3].find(i => !usedIndices.includes(i)) || 1;
            }
            
            finalId = `${baseId}_auto_${nextIndex}`;
            finalName = `${baseName} (Autosave ${nextIndex})`;
        }
    } else {
        finalId = slotId || `save_${Date.now()}`;
        finalName = customName || `Save ${new Date().toLocaleString()}`;
    }

    const id = finalId;
    const name = finalName;
    
    const saveObj = {
      airlineName,
      airlineCode,
      selectedHub,
      difficulty,
      startingBudget,
      debugMode,
      capital,
      fleet,
      aiAirlinesCount,
      aiDifficulty,
      aiAirlines,
      pendingSlotBills,
      startDateOffset,
      currentDateOffset,
      airportManagement,
      routes,
      messages,
      randomEvents
    };
    
    // Writes to this browser first and then to the cloud, so a save never depends
    // on the network. A failed upload is flagged and retried on the next sign-in.
    const { meta, cloudOk } = await writeSave(userId, id, name, saveObj);
    setCloudOnline(cloudOk);

    newSaves = [...newSaves.filter(sv => sv.id !== id), meta].sort((a, b) => b.timestamp - a.timestamp);
    setSaves(newSaves);
    
    setCurrentSaveId(id);
    setCurrentSaveName(name);

    const where = userId ? (cloudOk ? ' (synced to your account)' : ' (saved locally — upload pending)') : '';
    if (!isAutosave) {
      setAppAlert(`Game "${name}" saved successfully!${where}`);
    } else {
      setAppAlert(`Autosave complete: "${name}"${where}`);
    }
    setShowSaveMenu(false);
  };

  useEffect(() => {
    if (pendingAutosave) {
      setPendingAutosave(false);
      handleSaveGame(undefined, undefined, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDateOffset, pendingAutosave]);

  useEffect(() => {
    if (pendingInitialSave) {
      setPendingInitialSave(false);
      handleSaveGame(currentSaveId || undefined, currentSaveName || undefined, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDateOffset, pendingInitialSave]);

  const handleLoadGame = async (slotId: string) => {
    const saveObj = await readSave(userId, slotId);
    if (saveObj) {
      try {
        setAirlineName(saveObj.airlineName || "");
        setAirlineCode(saveObj.airlineCode || "");
        setSelectedHub(saveObj.selectedHub || "FRA");
        setDifficulty(saveObj.difficulty || "Normal");
        setStartingBudget(saveObj.startingBudget || "$25M");
        const loadedDebug = saveObj.debugMode === true;
        setDebugMode(loadedDebug);
        localStorage.setItem('airline_debug_mode', String(loadedDebug));
        setCapital(saveObj.capital || 0);
        setFleet(saveObj.fleet || []);
        setAiAirlinesCount(saveObj.aiAirlinesCount || 6);
        setAiDifficulty(saveObj.aiDifficulty || "Normal");
        setStartDateOffset(saveObj.startDateOffset || 0);
        setCurrentDateOffset(saveObj.currentDateOffset || 0);
        setAirportManagement(saveObj.airportManagement || {});
        setRoutes(saveObj.routes || []);
        
        const loadedHub = saveObj.selectedHub || "FRA";
        const rawLoadedAis: AiAirline[] = saveObj.aiAirlines || generateAiAirlines(saveObj.aiAirlinesCount || 6, saveObj.aiDifficulty || "Normal", loadedHub, saveObj.startDateOffset || 0);
        const personalitiesList: ('flag' | 'lcc' | 'expansionist' | 'optimizer' | 'boutique')[] = ['flag', 'lcc', 'expansionist', 'optimizer', 'boutique'];
        const patchedAis = rawLoadedAis.map((ai, idx) => {
          if (!ai.personality) {
            const personality = personalitiesList[idx % personalitiesList.length];
            const aggression = personality === 'expansionist' ? 9 : personality === 'lcc' ? 8 : personality === 'flag' ? 6 : personality === 'optimizer' ? 4 : 5;
            return {
              ...ai,
              personality,
              aggression
            };
          }
          return ai;
        });
        setAiAirlines(patchedAis);
        setPendingSlotBills(saveObj.pendingSlotBills || 0);
        
        if (saveObj.messages) {
          setMessages(saveObj.messages);
        }
        if (saveObj.randomEvents) {
          setRandomEventsState(saveObj.randomEvents);
          setRuntimeRandomEvents(saveObj.randomEvents);
        } else {
          setRandomEventsState([]);
          setRuntimeRandomEvents([]);
        }

        setSessionKey(Date.now());
        setCurrentSaveId(slotId);
        setCurrentSaveName(saves.find(s => s.id === slotId)?.name || "Loaded Save");
        setView('game');
        setIsGameMenuOpen(false);
        setShowLoadMenu(false);
        setAppAlert("Game loaded successfully!");
      } catch (e) {
        setAppAlert("Error loading save file.");
      }
    } else {
      setAppAlert("Save file missing!");
    }
  };

  const deleteSave = async (id: string) => {
    setSaves(prev => prev.filter(s => s.id !== id));
    await deleteSaveSlot(userId, id);
  };

  const handleSellAircraft = (plane: OwnedAircraft) => {
    const baseValue = plane.basePrice || 10000000;
    const condGenFactor = (plane.conditionGeneral / 100) * 0.45;
    const condIntFactor = (plane.conditionInterior / 100) * 0.15;
    const residualFactor = 0.30;
    const factor = residualFactor + condGenFactor + condIntFactor;
    const value = Math.round(baseValue * factor);

    setCapital(prev => prev + value);
    setFleet(prev => prev.filter(p => p.registration !== plane.registration));
    setRoutes(prev => prev.filter(r => r.aircraft !== plane.registration));
    
    setAppAlert(`SUCCESS: You sold ${plane.registration} (${plane.manufacturer} ${plane.type}) for ${formatCurrency(value)}. All assigned routes have been decommissioned.`);
  };

  const handlePurchase = (
    aircraft: Aircraft, 
    quantity: number, 
    config: ConfigOutput,
    baseInteriorPop: number,
    totalCost: number
  ) => {
    let isRenovating = 'registration' in aircraft;
    if (capital >= totalCost) {
      setCapital(prev => prev - totalCost);
      
      if (isRenovating) {
         setFleet(prev => prev.map(p => {
           if (p.registration === (aircraft as any).registration) {
             const refits = p.refitsDone || 0;
             let restorePercent = 90 - (refits * 10);
             restorePercent = Math.max(30, restorePercent); // floor at 30% or maybe 0, assuming 30
             return {
               ...p,
               config,
               baseInteriorPop,
               refitsDone: refits + 1,
               conditionInterior: Math.min(100, Math.max(p.conditionInterior, restorePercent))
             };
           }
           return p;
         }));
      } else {
         const newPlanes: OwnedAircraft[] = [];
         const existingRegistrations = fleet.map(p => p.registration);
         for (let i = 0; i < quantity; i++) {
           const hub = selectedHub || 'FRA';
           const reg = generateUniqueRegistration(
             aircraft.manufacturer,
             aircraft.type,
             aircraft.family || '',
             hub,
             [...existingRegistrations, ...newPlanes.map(np => np.registration)]
           );
           newPlanes.push({
             ...aircraft,
             registration: reg,
             purchasedAt: currentDateOffset,
             conditionInterior: 100,
             conditionGeneral: 100,
             refitsDone: 0,
             config,
             baseInteriorPop
           });
         }
         setFleet(prev => [...prev, ...newPlanes]);

         if (isPurchasingForRoute) {
           const newReg = newPlanes[0].registration;
           if (planningOriginId && planningDestId) {
             const origin = airportsMapAdjusted.get(planningOriginId);
             const dest = airportsMapAdjusted.get(planningDestId);
             if (origin && dest) {
               const dist = calculateDistance(origin.coords[0], origin.coords[1], dest.coords[0], dest.coords[1]);
               if (dist > aircraft.maxRange) {
                 setAppAlert(`Warning: The aircraft ${newReg} (${aircraft.type}) was purchased, but with ${aircraft.maxRange.toLocaleString()}km it does not have enough range for the planned route (${Math.round(dist).toLocaleString()}km).`);
                 setIsPurchasingForRoute(false);
                 setSelectedPurchasingAircraft(null);
                 return;
               } else {
                 setPlanningReg(newReg);
                 setIsPlanningRoute(true);
               }
             } else {
               setPlanningReg(newReg);
               setIsPlanningRoute(true);
             }
           } else {
             setPlanningReg(newReg);
             setIsPlanningRoute(true);
           }
           setIsPurchasingForRoute(false);
           setSelectedPurchasingAircraft(null);
           setActiveWindow('map');
           return;
         }
      }
      setSelectedPurchasingAircraft(null);
      setActiveWindow('map');
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-aero-black">
      <div 
        className="bg-aero-black text-white font-sans selection:bg-aero-yellow selection:text-black overflow-hidden flex flex-col absolute top-0 left-0"
        style={{ 
          transform: `scale(${finalUiScale})`, 
          transformOrigin: 'top left',
          width: `${(100 / finalUiScale).toFixed(5)}%`,
          height: `${(100 / finalUiScale).toFixed(5)}%`,
        }}
      >
        <div className="w-full h-full relative flex flex-col">
          {appAlert && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-[#1a1a1a] border border-white/10 p-4 max-w-md w-full shadow-2xl">
                <h3 className="text-aero-yellow font-black uppercase tracking-widest text-lg mb-4 flex items-center gap-2">
                  <AlertTriangle size={24} /> System Alert
                </h3>
                <p className="text-white/80 mb-3">{appAlert}</p>
                <div className="flex justify-end">
                  <button 
                    onClick={() => setAppAlert(null)}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-bold uppercase tracking-wider transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="flex-1 relative flex overflow-hidden">
            {/* Sidebar for Game View */}
        {view === 'game' && (
          <div className="w-14 lg:w-16 bg-[#141414] border-r border-white/10 flex flex-col items-center pb-4 shrink-0 z-50 h-full overflow-y-auto no-scrollbar">
            {/* Spacer corresponding to the h-14 height of the Game Stats Bar */}
            <div className="h-14 shrink-0 w-full" />
            <div className="flex flex-col w-full">
              {/* Fleet & Ops */}
              <div className="flex flex-col divide-y divide-white/5">
                <SidebarIcon icon={<MapIcon size={28} />} label="MAP" active={activeWindow === 'map' && !isPlanningRoute} onClick={() => { setIsPlanningRoute(false); setIsEditingSchedule(false); setEditingRouteId(null); setActiveWindow('map'); setSelectedPurchasingAircraft(null); setSelectedAirport(null); }} />
                <SidebarIcon icon={<ShoppingCart size={28} />} label="BUY AIRCRAFT" active={activeWindow === 'buy-aircraft' && !isPlanningRoute} onClick={() => { setIsPlanningRoute(false); setIsEditingSchedule(false); setEditingRouteId(null); setActiveWindow('buy-aircraft'); setSelectedPurchasingAircraft(null); setSelectedAirport(null); }} />
                <SidebarIcon icon={<Plane size={28} />} label="MY FLEET" active={activeWindow === 'my-fleet' && !isPlanningRoute} onClick={() => { setIsPlanningRoute(false); setIsEditingSchedule(false); setEditingRouteId(null); setActiveWindow('my-fleet'); setSelectedPurchasingAircraft(null); setSelectedAirport(null); }} />
              </div>

              {/* Network */}
              <div className="flex flex-col divide-y divide-white/5 border-t border-white/10">
                <SidebarIcon icon={<Navigation size={28} />} label="ROUTES" active={activeWindow === 'routes' && !isPlanningRoute} onClick={() => { setIsPlanningRoute(false); setIsEditingSchedule(false); setEditingRouteId(null); setRouteFilter(""); setActiveWindow('routes'); setSelectedPurchasingAircraft(null); setSelectedAirport(null); }} />
                <SidebarIcon icon={<MapPin size={28} />} label="AIRPORTS" active={activeWindow === 'airports' && !isPlanningRoute} onClick={() => { setIsPlanningRoute(false); setIsEditingSchedule(false); setEditingRouteId(null); setActiveWindow('airports'); setSelectedPurchasingAircraft(null); setSelectedAirport(null); }} />
              </div>

              {/* Business */}
              <div className="flex flex-col divide-y divide-white/5 border-t border-white/10">
                <SidebarIcon icon={<Briefcase size={28} />} label="MY COMPANY" active={activeWindow === 'my-company' && !isPlanningRoute} onClick={() => { setIsPlanningRoute(false); setIsEditingSchedule(false); setEditingRouteId(null); setActiveWindow('my-company'); setSelectedPurchasingAircraft(null); setSelectedAirport(null); }} />
                <SidebarIcon icon={<Users size={28} />} label="RIVALS" active={activeWindow === 'competitors' && !isPlanningRoute} onClick={() => { setIsPlanningRoute(false); setIsEditingSchedule(false); setEditingRouteId(null); setActiveWindow('competitors'); setSelectedPurchasingAircraft(null); setSelectedAirport(null); }} />
              </div>

              {/* Actions */}
              <div className="flex flex-col border-t border-white/10 bg-aero-yellow/5">
                <SidebarIcon icon={<Plus size={28} />} label="NEW ROUTE" active={isPlanningRoute} onClick={() => { setIsPlanningRoute(true); setIsEditingSchedule(false); setEditingRouteId(null); setSelectedPurchasingAircraft(null); setSelectedAirport(null); }} />
              </div>
            </div>
            <div className="mt-4 pb-4 shrink-0 w-full mb-3">
              
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col relative overflow-hidden">
          <AnimatePresence mode="wait">
            {view === 'login' && (
              <AuthGate onLocalOnly={handleLocalOnly} />
            )}

            {view === 'main-menu' && (
              <motion.div
                key="main-menu"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col items-center justify-center p-4 bg-[#121212] relative"
              >
                <div className="absolute top-4 right-8 z-50 flex items-center gap-4">
                  <div className="text-white/40 font-mono text-xs tracking-widest flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shadow-2xl ${userId ? (cloudOnline ? 'bg-aero-yellow animate-pulse' : 'bg-white/30') : 'bg-white/20'}`}></div>
                    {user || 'UNKNOWN_USER'}
                  </div>
                  <div className="h-4 w-px bg-white/10"></div>
                  <span className="text-white/25 font-mono text-[10px] uppercase tracking-widest">{cloudStatusLabel}</span>
                  <div className="h-4 w-px bg-white/10"></div>
                  <button 
                    onClick={handleDisconnect}
                    className="text-white/40 hover:text-white font-mono text-xs uppercase tracking-widest flex items-center gap-2 transition-colors"
                  >
                    <LogOut size={14} /> Logout
                  </button>
                </div>
                {/* Background Decor */}
                <svg className="absolute inset-0 w-full h-full opacity-5 pointer-events-none" viewBox="0 0 800 400">
                  <path d="M150,100 Q200,80 250,120 T400,100 T550,150 T700,80" fill="none" stroke="#FACC15" strokeWidth="1" strokeDasharray="4" />
                  <circle cx="150" cy="100" r="3" fill="#FACC15" />
                  <circle cx="700" cy="80" r="3" fill="#FACC15" />
                </svg>

                <div className="w-full max-w-xl z-10 flex flex-col gap-12">
                  <div className="space-y-4">
                    <Bird className="text-aero-yellow" size={64} strokeWidth={2.5} />
                    <h1 className="text-8xl font-black italic tracking-tighter leading-none">
                      <span className="text-aero-yellow">AM</span><br/>
                      <span className="text-white">NEO</span>
                    </h1>
                    <p className="text-[10px] tracking-[0.4em] font-light text-white/40 pl-2">COMMAND INTERFACE v4.2</p>
                  </div>

                  {legacySaveCount > 0 && (
                    <div className="bg-aero-yellow/5 border border-aero-yellow/30 p-4 flex flex-col gap-3">
                      <div className="text-[11px] font-mono uppercase tracking-widest text-aero-yellow font-bold">
                        {legacySaveCount} savegame{legacySaveCount === 1 ? '' : 's'} found from before accounts existed
                      </div>
                      <p className="text-[10px] font-mono text-white/40 leading-relaxed">
                        They are still stored in this browser. Import them into your account to
                        reach them from any device. The originals are left untouched.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={handleImportLegacySaves}
                          disabled={isImportingLegacy}
                          className="px-4 py-2 bg-aero-yellow text-black font-black uppercase tracking-widest text-[10px] hover:bg-white transition-colors disabled:opacity-50"
                        >
                          {isImportingLegacy ? 'Importing...' : 'Import into my account'}
                        </button>
                        <button
                          onClick={() => setLegacySaveCount(0)}
                          className="px-4 py-2 border border-white/20 text-white/50 font-black uppercase tracking-widest text-[10px] hover:text-white transition-colors"
                        >
                          Not now
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <ThemeMenuButton 
                      index="01" 
                      label="Resume Game" 
                      onClick={() => {
                        if (saves.length > 0) {
                          const latest = [...saves].sort((a, b) => b.timestamp - a.timestamp)[0];
                          handleLoadGame(latest.id);
                        } else {
                          setAppAlert("No telemetry archives discovered to resume from.");
                        }
                      }} 
                    />
                    <ThemeMenuButton 
                      index="02" 
                      label="Load Game" 
                      onClick={() => setShowLoadMenu(true)} 
                    />
                    <ThemeMenuButton 
                      index="03" 
                      label="Start Game" 
                      onClick={() => setView('start-menu')} 
                      primary 
                    />
                    <ThemeMenuButton 
                      index="04" 
                      label="Settings" 
                      onClick={() => setIsSettingsOpen(true)} 
                    />

                  </div>
                </div>

                {/* Radar HUD Element */}
                <div className="absolute bottom-10 right-10 w-48 h-48 border border-white/5 rounded-full hidden xl:flex items-center justify-center">
                  <div className="w-40 h-40 border border-aero-yellow/10 rounded-full flex items-center justify-center relative">
                    <div className="text-[10px] font-mono text-aero-yellow/40 animate-pulse">MONITORING...</div>
                    <motion.div 
                      className="absolute inset-0 border-t border-aero-yellow/30 rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'start-menu' && (
              <motion.div
                key="start-menu"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-1 min-h-0 p-4 lg:p-12 overflow-y-auto custom-scrollbar"
              >
                <div className="max-w-4xl mx-auto space-y-12 pb-20">
                  <div className="flex items-end justify-between border-b border-white/10 pb-6">
                    <div>
                      <span className="text-aero-yellow font-mono text-xs tracking-widest uppercase block mb-2">Operation: Initialize</span>
                      <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">Pre-Flight <span className="text-aero-yellow">Config</span></h2>
                    </div>
                    <button 
                      onClick={() => setView('main-menu')}
                      className="text-[11px] font-mono uppercase tracking-widest text-white/40 hover:text-aero-yellow transition-colors"
                    >
                      [ Abort_Mission ]
                    </button>
                  </div>

                  <div className="space-y-8 max-w-2xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Airline Name</label>
                        <input 
                          type="text" 
                          value={airlineName}
                          onChange={(e) => setAirlineName(e.target.value)}
                          placeholder="Neo Airlines"
                          className="w-full bg-aero-carbon border border-white/10 p-4 font-mono text-sm outline-none focus:border-aero-yellow text-aero-yellow placeholder:text-white/20"
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Airline Code</label>
                        <input 
                          type="text" 
                          value={airlineCode}
                          onChange={handleAirlineCodeChange}
                          placeholder="NX"
                          className="w-full bg-aero-carbon border border-white/10 p-4 font-mono text-sm outline-none focus:border-aero-yellow text-aero-yellow uppercase placeholder:text-white/20"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Select Hub</label>
                      <div className="relative w-full">
                        <select 
                          value={selectedHub}
                          onChange={(e) => setSelectedHub(e.target.value)}
                          className="w-full bg-aero-carbon border border-white/10 p-4 pl-4 pr-10 font-mono text-sm outline-none focus:border-aero-yellow text-white hover:border-aero-yellow/50 transition-colors appearance-none cursor-pointer"
                        >
                          {airports.slice().sort((a,b) => a.name.localeCompare(b.name)).map(a => (
                            <option key={a.id} value={a.id}>{a.name} ({a.id}) - Level {a.level}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
                          <ChevronDown size={16} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Difficulty</label>
                      <div className="flex gap-4">
                        {['Easy', 'Normal', 'Hard'].map((diff) => (
                          <button
                            key={diff}
                            onClick={() => setDifficulty(diff)}
                            className={`flex-1 p-4 font-mono text-sm border uppercase tracking-widest transition-colors ${difficulty === diff ? 'bg-aero-yellow text-black border-aero-yellow' : 'bg-aero-carbon border-white/10 text-white hover:border-aero-yellow'}`}
                          >
                            {diff}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Starting Budget</label>
                      <div className="flex flex-wrap gap-4">
                        {['$25M', '$50M', '$100M', '$200M'].map((budget) => (
                          <button
                            key={budget}
                            onClick={() => setStartingBudget(budget)}
                            className={`flex-1 min-w-[100px] p-4 font-mono text-[11px] border uppercase tracking-widest transition-colors ${startingBudget === budget ? 'bg-aero-yellow text-black border-aero-yellow' : 'bg-aero-carbon border-white/10 text-white hover:border-aero-yellow'}`}
                          >
                            {budget}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Debug Mode</label>
                      <div className="flex gap-4">
                        {[
                          { label: 'Deactivated (Normal Play)', value: false },
                          { label: 'Activated (Debug Info)', value: true }
                        ].map((opt) => (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => {
                              setDebugMode(opt.value);
                              localStorage.setItem('airline_debug_mode', String(opt.value));
                            }}
                            className={`flex-1 p-4 font-mono text-xs border uppercase tracking-widest transition-all ${debugMode === opt.value ? 'bg-aero-yellow text-black border-aero-yellow font-black shadow-2xl' : 'bg-aero-carbon border-white/10 text-white hover:border-aero-yellow/50'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-white/40 italic">When activated, real-time demand calculation and pricing base debug tools are enabled.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/60">AI-Controlled Airlines</label>
                          <span className="text-xl font-mono text-aero-yellow">{aiAirlinesCount}</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="12"
                          value={aiAirlinesCount}
                          onChange={(e) => setAiAirlinesCount(parseInt(e.target.value))}
                          className="w-full appearance-none bg-white/10 h-2 outline-none slider-thumb-aero"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-white/40">
                          <span>0</span>
                          <span>12</span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Opponent Difficulty</label>
                        <select 
                          value={aiDifficulty}
                          onChange={(e) => setAiDifficulty(e.target.value)}
                          className="w-full bg-aero-carbon border border-white/10 p-4 font-mono text-sm outline-none focus:border-aero-yellow text-white"
                        >
                          <option>Easy</option>
                          <option>Normal</option>
                          <option>Hard</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Start Date</label>
                        <span className="text-xl font-mono text-aero-yellow">{formatDate(startDateOffset)}</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="731"
                        value={startDateOffset}
                        onChange={(e) => setStartDateOffset(parseInt(e.target.value))}
                        className="w-full appearance-none bg-white/10 h-2 outline-none slider-thumb-aero"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-white/40">
                        <span>01/1960</span>
                        <span>12/2020</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-aero-yellow">Initial Save File Name</label>
                      <input 
                        type="text" 
                        value={initialSaveFileName}
                        onChange={(e) => setInitialSaveFileName(e.target.value)}
                        placeholder="My Airline Save 1"
                        className="w-full bg-aero-carbon border border-aero-yellow/30 p-4 font-mono text-sm outline-none focus:border-aero-yellow text-aero-yellow placeholder:text-white/20"
                      />
                      <p className="text-[10px] text-white/40 italic mt-2">A save file name must be provided to initialize the system.</p>
                    </div>
                    
                    <div className="pt-8 flex justify-end">
                      <button 
                        onClick={() => {
                          if (!initialSaveFileName.trim()) {
                            setAppAlert("You must provide a save file name to begin.");
                            return;
                          }
                          setCurrentDateOffset(startDateOffset);
                          let initialCapital = 25000000; // Default for $25M
                          if (startingBudget === '$50M') initialCapital = 50000000;
                          if (startingBudget === '$100M') initialCapital = 100000000;
                          if (startingBudget === '$200M') initialCapital = 200000000;
                          setCapital(initialCapital);
                          setFleet([]);
                          setAirportManagement({ 
                            [selectedHub]: {
                              level: 2,
                              slots: { regional: 0, narrowbody: 0, widebody: 0 },
                              stands: { narrowbody: 0, widebody: 0 },
                              desks: { normal: 1, self: 0 }
                            }
                          });
                          setRoutes([]);
                          setAiAirlines(generateAiAirlines(aiAirlinesCount, aiDifficulty, selectedHub, startDateOffset));
                          setPendingSlotBills(0);
                          setSessionKey(Date.now());
                          const newSaveId = `save_${Date.now()}`;
                          setCurrentSaveId(newSaveId);
                          setCurrentSaveName(initialSaveFileName.trim());
                          setPendingInitialSave(true);
                          setView('game');
                          setActiveWindow('map');
                        }}
                        className="group flex items-center bg-aero-yellow text-black px-4 py-4 font-bold uppercase tracking-widest hover:bg-white transition-all w-full md:w-auto"
                      >
                        Start Game
                        <ChevronRight size={20} className="ml-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'monthly-overview' && (
              <motion.div
                key="monthly-overview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col items-center justify-center bg-aero-black relative p-12"
              >
                <div className="max-w-4xl w-full">
                  <div className="border-b border-white/10 pb-6 mb-6">
                    <span className="text-aero-yellow font-mono text-xs tracking-widest uppercase block mb-2">Operation: Execution</span>
                    <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">Monthly <span className="text-aero-yellow">Report</span></h2>
                    {/* The report covers the month that just ended, not the one the clock
                        has already advanced to, so label it from the report itself. */}
                    <p className="text-white/60 font-mono mt-4 font-bold text-xl">
                      {latestReport
                        ? `${latestReport.month.toString().padStart(2, '0')}/${latestReport.year}`
                        : formatDate(currentDateOffset)} - {airlineName || 'Neo Airlines'} ({airlineCode || 'NX'})
                    </p>
                  </div>
                  
                  <div className="mb-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-4">
                    {latestReport ? (
                      <FinancialReport
                         title="Monthly Financial Overview"
                         netProfit={latestReport.totalProfit}
                         totalRevenue={latestReport.routeRevenues}
                         expenses={[
                           {
                             id: 'routeCosts',
                             label: 'Route Operational Costs',
                             total: latestReport.routeCosts,
                             items: [
                               { label: `Jet Fuel (${formatNumber(latestReport.breakdown.fuelLiters || 0)} L @ $${(latestReport.breakdown.fuelPriceL || 0).toFixed(3)})`, amount: latestReport.breakdown.fuel },
                               { label: 'In-Flight Catering & Amenities', amount: latestReport.breakdown.catering },
                               { label: 'Flight Crew & Ground Staff Salaries', amount: latestReport.breakdown.staff },
                               { label: 'Route Infrastructure (Slots & Pax Fees)', amount: latestReport.breakdown.routeInfra }
                             ]
                           },
                           {
                             id: 'airportCosts',
                             label: 'Airport & Hub Upkeep',
                             total: latestReport.airportUpkeep,
                             items: [
                               { label: 'Base Management & Slot Maintenance', amount: latestReport.breakdown.mgt },
                               { label: 'Check-in & Service Desk Operations', amount: latestReport.breakdown.desks }
                             ]
                           },
                           ...(latestReport.routes && latestReport.routes.length > 0 ? [{
                             id: 'routeBreakdown',
                             label: 'Route Breakdown',
                             total: 0,
                             items: latestReport.routes.map((r: any) => ({
                               label: `${r.name} (Rev: ${formatCurrency(r.revenue)}, Exp: ${formatCurrency(r.cost)})`,
                               amount: -r.profit // Negating profit to show as an expense line or just displaying the value, but since it's an expense category we might want to make it special. Wait, I should add a custom category for it, or just use FinancialReport's flexible structure.
                             }))
                           }] : [])
                         ]}
                         defaultOpen={true}
                      />
                    ) : (
                      <div className="h-64 flex items-center justify-center text-white/40">
                        No financial data available for this month.
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button 
                      onClick={() => setView('game')}
                      className="group flex items-center bg-aero-yellow text-black px-4 py-4 font-bold uppercase tracking-widest hover:bg-white transition-all w-full md:w-auto"
                    >
                      Continue
                      <ChevronRight size={20} className="ml-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'game' && (
              <motion.div
                key="game"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col bg-aero-black relative"
              >
                {/* Game Stats Bar */}
                <div className="h-14 bg-[var(--aero-carbon)] border-b border-white/5 flex items-center justify-between px-4 shrink-0 relative z-50">
                  <div className="flex gap-5 items-center">
                    <GameStat label="Capital" value={formatCurrency(capital)} />
                    <GameStat label="Fleet" value={fleet.length.toString()} />
                    <GameStat label="Routes" value={routes.length.toString()} />
                    <GameStat label="Global Demand" value={`${Math.round(globalDemandData.value * 100)}%`} trend={globalDemandData.trend} />
                    <GameStat label="Fuel" value={`$${formatNumber(fuelData.price / 3.78541, 3)}`} trend={fuelData.trend} />
                  </div>
                  <div className="flex items-center gap-3 relative">
                    <div className="flex items-center gap-4">
                      <div className="text-aero-yellow font-mono text-sm font-bold tracking-widest">{formatDate(currentDateOffset)}</div>
                    </div>

                    <div className="relative">
                       <button 
                         onClick={() => {
                           setIsMessagesOpen(!isMessagesOpen);
                           if (!isMessagesOpen) {
                             setMessages(messages.map(m => ({ ...m, isRead: true })));
                           }
                         }}
                         className={`flex items-center gap-2 px-3 py-1 border text-[10px] uppercase font-bold tracking-widest transition-all ${unreadMessagesCount > 0 ? 'bg-aero-yellow text-black border-aero-yellow' : 'bg-white/5 text-white hover:bg-white/10 border-white/10'}`}
                       >
                         <Bell size={12} />
                         <span className="hidden sm:inline">Messages</span>
                         {unreadMessagesCount > 0 && (
                           <span className="ml-1 bg-black text-aero-yellow px-1.5 py-0.5 text-[8px] rounded-sm">{unreadMessagesCount}</span>
                         )}
                       </button>
                       
                       {isMessagesOpen && (
                         <div className="absolute top-full right-0 mt-2 w-80 bg-[#141414] border border-aero-yellow/20 shadow-2xl z-[3000] flex flex-col">
                           <div className="p-3 border-b border-white/10 flex justify-between items-center">
                             <span className="text-aero-yellow text-[10px] uppercase tracking-widest font-bold">Communications</span>
                             <button onClick={() => setIsMessagesOpen(false)} className="text-white/40 hover:text-white"><X size={14}/></button>
                           </div>
                           <div className="max-h-64 overflow-y-auto no-scrollbar">
                             {messages.length === 0 ? (
                               <div className="p-4 text-center text-white/30 text-xs font-mono">No new messages</div>
                             ) : (
                               messages.map(msg => (
                                 <div 
                                   key={msg.id} 
                                   onClick={() => {
                                     setSelectedMessage(msg);
                                     setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isRead: true } : m));
                                   }}
                                   className="p-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group flex flex-col gap-1 text-left"
                                 >
                                   <div className="text-[9px] text-white/40 font-mono flex justify-between items-center w-full"><span>{msg.dateStr}</span><span className="text-[8px] opacity-0 group-hover:opacity-100 text-aero-yellow font-bold uppercase transition-opacity">Read Dispatch</span></div>
                                   <div className={`text-xs ${msg.isRead ? 'text-white/60' : 'text-white font-semibold'} group-hover:text-aero-yellow transition-colors line-clamp-3`}>{msg.text}</div>
                                 </div>
                               ))
                             )}
                           </div>
                         </div>
                       )}
                    </div>
                    
                    <div className="relative">
                      <button 
                         onClick={() => setIsMapSettingsOpen(!isMapSettingsOpen)}
                         className="px-3 py-2 border border-white/10 text-white/40 text-[10px] font-black uppercase tracking-widest hover:border-aero-yellow hover:text-white transition-all mr-2"
                      >
                        [ Map ]
                      </button>
                      {isMapSettingsOpen && (
                        <div className="absolute top-12 right-0 mt-2 w-64 bg-[#141414] border border-aero-yellow/20 shadow-2xl flex flex-col z-[3000] p-4 gap-4">
                          <label className="flex items-center gap-3 text-xs uppercase font-bold tracking-widest text-[#F2CB05] cursor-pointer hover:bg-white/5 p-2 transition-colors">
                            <input type="checkbox" checked={showYourRoutes} onChange={(e) => setShowYourRoutes(e.target.checked)} className="accent-[#F2CB05] w-4 h-4 cursor-pointer" />
                            Your Routes
                          </label>
                          <label className="flex items-center gap-3 text-xs uppercase font-bold tracking-widest text-aero-yellow/60 cursor-pointer hover:bg-white/5 p-2 transition-colors">
                            <input type="checkbox" checked={showRivalRoutes} onChange={(e) => setShowRivalRoutes(e.target.checked)} className="accent-red-500 w-4 h-4 cursor-pointer" />
                            Rival Routes
                          </label>
                          <label className="flex items-center gap-3 text-xs uppercase font-bold tracking-widest text-white/80 cursor-pointer hover:bg-white/5 p-2 transition-colors">
                            <input type="checkbox" checked={showLiveTraffic} onChange={(e) => setShowLiveTraffic(e.target.checked)} className="accent-blue-400 w-4 h-4 cursor-pointer" />
                            Live Traffic
                          </label>
                        </div>
                      )}
                    </div>

                    <button 
                       onClick={() => setIsGameMenuOpen(!isGameMenuOpen)}
                       className="px-3 py-2 border border-white/10 text-white/40 text-[10px] font-black uppercase tracking-widest hover:border-aero-yellow hover:text-white transition-all"
                    >
                      [ Menu ]
                    </button>
                    {isGameMenuOpen && (
                      <div className="absolute top-12 right-0 mt-2 w-56 bg-aero-carbon border border-white/10 shadow-2xl flex flex-col z-[100] py-2">
                        <GameMenuOption label="Continue" onClick={() => setIsGameMenuOpen(false)} />
                        <GameMenuOption label="Save Game" onClick={() => { setShowSaveMenu(true); setIsGameMenuOpen(false); }} />
                        <GameMenuOption label="Settings" onClick={() => { setIsSettingsOpen(true); setIsGameMenuOpen(false); }} />
                        <div className="h-px bg-white/10 my-2"></div>
                        <GameMenuOption label="Return to Main Menu" onClick={() => { setView('main-menu'); setIsGameMenuOpen(false); setActiveWindow('map'); setSelectedPurchasingAircraft(null); setSelectedAirport(null); }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Active Events Banner */}
                {getEventMultipliers(currentDateOffset).activeEvents.map((ev, i) => (
                   <div key={`idx-${i}`} className="bg-[#111] border-b border-white/20 text-aero-yellow/60 px-4 py-2.5 flex items-center gap-4 z-40 shrink-0 shadow-2xl">
                      <AlertTriangle className="text-aero-yellow/60 shrink-0" size={16} />
                      <div className="flex-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-4 min-w-0">
                         <span className="font-black uppercase tracking-widest text-[#FFB0B0] text-[10px] shrink-0">{ev.title}</span>
                         <span className="text-[10px] md:text-[11px] opacity-80 truncate font-mono">{ev.description}</span>
                         <span className="text-[10px] md:text-[11px] font-bold text-aero-yellow/60 ml-auto whitespace-nowrap">
                            PAX: {ev.demandMultiplier >= 1 ? '+' : ''}{((ev.demandMultiplier - 1) * 100).toFixed(0)}% | FUEL: {ev.fuelMultiplier >= 1 ? '+' : ''}{((ev.fuelMultiplier - 1) * 100).toFixed(0)}%
                         </span>
                      </div>
                   </div>
                ))}

                {/* Main Viewport */}
                <div className="flex-1 relative bg-[#0a0a0a]">
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '40px 40px' }} />
                  
                  {/* Map Viewport - Leaflet Map */}
                  <div className="absolute inset-0 z-0 bg-[#0a0a0a]">
                      <MapContainer 
                        key={`map-${sessionKey}`}
                        center={[20, 0]} 
                        zoom={3} 
                        minZoom={2}
                        preferCanvas={true}
                        worldCopyJump={true}
                        maxBounds={[[-85, -5000], [85, 5000]]}
                        maxBoundsViscosity={0.8}
                        className="w-full h-full"
                        style={{ backgroundColor: '#131517' }}
                        zoomControl={false}
                      >
                        {/* Low-resolution world backdrop that fills gaps while the detail
                            layer loads. Two further duplicate layers were removed here:
                            all four requested the same tile service, so the map fetched
                            every visible area up to four times. */}
                        <TileLayer
                          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                          attribution='&copy; Esri'
                          noWrap={false}
                          minNativeZoom={2}
                          maxNativeZoom={3}
                          maxZoom={20}
                          zIndex={0}
                          opacity={0.9}
                          keepBuffer={8}
                        />
                        <TileLayer
                          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                          attribution='&copy; Esri'
                          noWrap={false}
                          updateInterval={100}
                          keepBuffer={6}
                          updateWhenIdle={false}
                          updateWhenZooming={true}
                          zIndex={2}
                        />
                      <MapEvents setZoom={setZoom} setBounds={setMapBounds} />
                              {/* Route Lines - Rendered on 3 worlds for continuity */}
                      {visibleWorldOffsets.map(offset => (
                        <React.Fragment key={`world-${offset}-routes`}>
                          {(() => {
                            const pairs = new Set<string>();
                            const lines = showYourRoutes ? routes.map(r => {
                              const a1 = airportsMapAdjusted.get(r.origin);
                              const a2 = airportsMapAdjusted.get(r.destination);
                              if (!a1 || !a2) return null;
                              const key = [a1.id, a2.id].sort().join('-');
                              if (pairs.has(key)) return null;
                              pairs.add(key);
                              const points = getRoutePath(a1, a2, offset);
                              return (
                                <Polyline 
                                  key={`${r.id}-${offset}`}
                                  positions={points}
                                  color="#F2CB05"
                                  weight={1.2}
                                  opacity={0.8}
                                  smoothFactor={1} 
                                  lineCap="round"
                                  lineJoin="round"
                                />
                              );
                            }) : [];

                            // Add planning line if both ends are selected
                            if (showYourRoutes && planningOriginId && planningDestId) {
                                const a1 = airportsMapAdjusted.get(planningOriginId);
                                const a2 = airportsMapAdjusted.get(planningDestId);
                                if (a1 && a2) {
                                    const points = getRoutePath(a1, a2, offset);
                                    lines.push(
                                        <Polyline 
                                            key={`planning-${offset}`}
                                            positions={points}
                                            color="#F2CB05"
                                            weight={1.2}
                                            opacity={0.8} 
                                            smoothFactor={1}
                                            lineCap="round"
                                            lineJoin="round"
                                        />
                                    );
                                }
                            }

                            // Render Rival routes as red lines on the map
                            if (showRivalRoutes && aiAirlines && aiAirlines.length > 0) {
                              aiAirlines.forEach((airline, aiIdx) => {
                                if (airline.routes && airline.routes.length > 0) {
                                  airline.routes.forEach((r, routeIdx) => {
                                    const a1 = airportsMapAdjusted.get(r.origin);
                                    const a2 = airportsMapAdjusted.get(r.destination);
                                    if (!a1 || !a2) return;
                                    const points = getRoutePath(a1, a2, offset);
                                    lines.push(
                                      <Polyline 
                                        key={`ai-${airline.code}-${aiIdx}-${routeIdx}-${offset}`}
                                        positions={points}
                                        color="#ef4444"
                                        weight={1.5}
                                        opacity={0.7}
                                        smoothFactor={1}
                                        lineCap="round"
                                        lineJoin="round"
                                      >
                                        <Tooltip sticky>
                                          <div className="bg-aero-black/95 backdrop-blur-sm border border-white/10 text-aero-yellow/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest shadow-2xl">
                                            <div className="text-[12px] leading-none mb-1 text-white font-sans font-bold">{airline.name}</div>
                                            <div className="text-[10px] leading-none text-aero-yellow/60 font-mono mb-1">{r.origin} ↔ {r.destination}</div>
                                            <div className="text-[8px] opacity-60 leading-none">{r.departures} departures/week</div>
                                          </div>
                                        </Tooltip>
                                      </Polyline>
                                    );
                                  });
                                }
                              });
                            }
                            return lines;
                          })()}
                        </React.Fragment>
                      ))}
                      
                      {/* Airport Markers - Rendered on 3 worlds */}
                      {visibleWorldOffsets.map(offset => (
                        <React.Fragment key={`world-${offset}-airports`}>
                          {visibleAirports.map((airport) => {
                            const mgtLvl = airportManagement[airport.id]?.level || 0;
                            const pos: [number, number] = [airport.coords[0], airport.coords[1] + offset];
                            
                            if (zoom >= 6) {
                              return (
                                <Marker 
                                  key={`${airport.id}-${offset}`} 
                                  position={pos}
                                  icon={getAirportIcon(zoom, mgtLvl)}
                                  eventHandlers={{
                                    click: () => setSelectedAirport(airport)
                                  }}
                                >
                                  <Tooltip direction="top" offset={[0, -10]} opacity={1} sticky>
                                    <div className="bg-aero-black/90 backdrop-blur-sm border border-aero-yellow text-aero-yellow px-3 py-1.5 font-mono text-[11px] uppercase font-black tracking-widest shadow-2xl flex flex-col items-center">
                                      <div className="text-[14px] leading-none mb-1 text-white">{airport.id}</div>
                                      <div className="text-[8px] opacity-60 leading-none">{airport.name}</div>
                                    </div>
                                  </Tooltip>
                                </Marker>
                              );
                            } else {
                              const radius = Math.max(3, zoom * 1.2);
                              const isGreen = mgtLvl > 0;
                              return (
                                <CircleMarker
                                  key={`${airport.id}-${offset}`}
                                  center={pos}
                                  radius={radius}
                                  pathOptions={{
                                    color: 'black',
                                    weight: 1,
                                    fillColor: isGreen ? '#10b981' : '#F2CB05',
                                    fillOpacity: 1
                                  }}
                                  eventHandlers={{
                                    click: () => setSelectedAirport(airport)
                                  }}
                                >
                                  <Tooltip direction="top" opacity={1} sticky>
                                    <div className="bg-aero-black/90 backdrop-blur-sm border border-aero-yellow text-aero-yellow px-2 py-1 font-mono text-[10px] uppercase font-black tracking-widest shadow-2xl">
                                      {airport.id}
                                    </div>
                                  </Tooltip>
                                </CircleMarker>
                              );
                            }
                          })}
                        </React.Fragment>
                      ))}

                      {/* Rendered once for every world copy: flight positions do not
                          depend on the copy, only the drawn longitude does. */}
                      {showLiveTraffic && (
                        <LiveTraffic
                          realTime={realTime}
                          routes={routes}
                          aiRoutes={aiRouteList}
                          airports={airports}
                          offsets={visibleWorldOffsets}
                          fleet={fleet}
                        />
                      )}
                    </MapContainer>
                  </div>
                  
                  {/* Active Window Views Overlay */}
                  {activeWindow === 'buy-aircraft' ? (
                    <div className="absolute inset-0 z-40 bg-[url('https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=1600&auto=format&fit=crop')] bg-cover bg-center before:content-[''] before:absolute before:inset-0 before:bg-aero-black/95 before:backdrop-blur-md flex">
                      <div className="relative z-10 w-full h-full">
                        <BuyAircraftView currentDateOffset={currentDateOffset} onSelectAircraft={setSelectedPurchasingAircraft} debugMode={debugMode} />
                        {selectedPurchasingAircraft && (
                          <ConfigurePurchaseView 
                            aircraft={selectedPurchasingAircraft} 
                            capital={capital} 
                            currentDateOffset={currentDateOffset}
                            initialPlane={'registration' in selectedPurchasingAircraft ? selectedPurchasingAircraft : null}
                            fleet={fleet}
                            onCancel={() => setSelectedPurchasingAircraft(null)} 
                            onConfirmPurchase={handlePurchase} 
                          />
                        )}
                      </div>
                    </div>
                  ) : activeWindow === 'my-fleet' ? (
                    <div className="absolute inset-0 z-40 bg-[url('https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=1600&auto=format&fit=crop')] bg-cover bg-center before:content-[''] before:absolute before:inset-0 before:bg-aero-black/95 before:backdrop-blur-md flex">
                      <div className="relative z-10 w-full h-full">
                        <MyFleetView 
                           fleet={fleet} 
                           routes={routes}
                           onRenovate={(plane) => {
                             setSelectedPurchasingAircraft(plane);
                             setActiveWindow('buy-aircraft');
                           }} 
                           onSelectRoute={(route) => {
                             setExternalSelectedRoute(route);
                             setActiveWindow('routes');
                           }}
                           onStartRoute={(reg) => {
                             setIsPlanningRoute(true);
                             setPlanningReg(reg);
                             setPlanningOriginId(null);
                             setPlanningDestId(null);
                           }}
                           onSell={handleSellAircraft}
                        />
                      </div>
                    </div>
                  ) : activeWindow === 'routes' ? (
                    <div className="absolute inset-0 z-40 bg-[url('https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=1600&auto=format&fit=crop')] bg-cover bg-center before:content-[''] before:absolute before:inset-0 before:bg-aero-black/95 before:backdrop-blur-md flex">
                      <div className="relative z-10 w-full h-full">
                        <RoutesView 
                          routes={routes}
                          fleet={fleet}
                          initialAirportFilter={routeFilter} 
                          onPlanRoute={() => setIsPlanningRoute(true)}
                          onDeleteRoute={(id) => setRoutes(prev => prev.filter(r => r.id !== id))}
                          externalSelectedRoute={externalSelectedRoute}
                          onClearExternalSelectedRoute={() => setExternalSelectedRoute(null)}
                          onChangeAircraftRoute={(route) => {
                             setPlanningOriginId(route.origin);
                             setPlanningDestId(route.destination);
                             setPlanningReg(route.aircraft);
                             setPlanningStep(1);
                             setEditingRouteId(route.id);
                             setIsPlanningRoute(true);
                          }}
                          onEditSchedule={(id) => {
                             setEditingRouteId(id);
                             setIsEditingSchedule(true);
                             setIsPlanningRoute(false);
                          }}
                          onEditCabinServices={(id) => {
                             setEditingCabinRouteId(id);
                          }}
                          onUpdatePricing={(id, pricing) => {
                             setRoutes(prev => prev.map(r => {
                               if (r.id !== id) return r;
                               return { ...r, ticketPrices: pricing };
                             }));
                          }}
                          fuelPrice={fuelData.price}
                          airportManagement={airportManagement}
                          currentYear={1960 + Math.floor(currentDateOffset / 12)}
                          currentMonth={1 + (currentDateOffset % 12)}
                          difficulty={difficulty}
                        />
                      </div>
                    </div>
                  ) : activeWindow === 'airports' ? (
                    <div className="absolute inset-0 z-40 bg-[url('https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=1600&auto=format&fit=crop')] bg-cover bg-center before:content-[''] before:absolute before:inset-0 before:bg-aero-black/95 before:backdrop-blur-md flex">
                      <div className="relative z-10 w-full h-full">
                        <AirportsView 
                          currentYear={1960 + Math.floor(currentDateOffset / 12)} 
                          onSelectAirport={(airport) => setSelectedAirport(airport)}
                          airportManagement={airportManagement}
                          aiAirlines={aiAirlines}
                        />
                      </div>
                    </div>
                  ) : activeWindow === 'my-company' ? (
                    <div className="absolute inset-0 z-40 bg-[url('https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=1600&auto=format&fit=crop')] bg-cover bg-center before:content-[''] before:absolute before:inset-0 before:bg-aero-black/95 before:backdrop-blur-md flex">
                      <div className="relative z-10 w-full h-full">
                        <MyCompanyView capital={capital} latestReport={latestReport} />
                      </div>
                    </div>
                  ) : activeWindow === 'competitors' ? (
                    <div className="absolute inset-0 z-40 bg-[url('https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=1600&auto=format&fit=crop')] bg-cover bg-center before:content-[''] before:absolute before:inset-0 before:bg-aero-black/95 before:backdrop-blur-md flex">
                      <div className="relative z-10 w-full h-full">
                        <CompetitorsView
                          aiAirlines={aiAirlines}
                          playerCapital={capital}
                          playerFleetCount={fleet.length}
                          playerRoutesCount={routes.length}
                          playerAirlineName={airlineName}
                          playerAirlineCode={airlineCode}
                          playerHub={selectedHub}
                          playerFleet={fleet}
                          playerRoutes={routes}
                        />
                      </div>
                    </div>
                  ) : activeWindow !== 'map' && (
                    <div className="absolute inset-0 z-40 bg-[url('https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=1600&auto=format&fit=crop')] bg-cover bg-center before:content-[''] before:absolute before:inset-0 before:bg-aero-black/95 before:backdrop-blur-md flex flex-col items-center p-4 overflow-y-auto pt-8">
                      <h2 className="text-4xl font-mono text-aero-yellow uppercase tracking-[0.3em] font-black drop-shadow-lg mb-4 relative z-10">{activeWindow.replace('-', ' ')}</h2>
                      <div className="max-w-4xl w-full text-white/70 text-center uppercase tracking-widest font-mono text-sm leading-relaxed border border-aero-yellow/20 shadow-2xl p-12 bg-black/60 backdrop-blur-xl rounded-sm relative z-10">
                        <div className="text-aero-yellow mb-4 text-xs font-black tracking-[0.4em]">SYSTEM MODULE [{activeWindow.toUpperCase()}]</div>
                        <div className="opacity-50">INITIALIZATION STRATEGY DEPLOYED.</div>
                        <div className="animate-pulse text-aero-yellow/80 mt-4">AWAITING UPLINK...</div>
                      </div>
                    </div>
                  )}

                  {isEditingSchedule && editingRouteId && (
                    <RouteScheduleEditView 
                      route={routes.find(r => r.id === editingRouteId)!}
                      aircraft={fleet.find(a => a.registration === routes.find(r => r.id === editingRouteId)?.aircraft)!}
                      allAirports={airports}
                      allRoutes={routes}
                      airportManagement={airportManagement}
                      airlineCode={airlineCode}
                      onSave={(updatedRoute) => {
                        setRoutes(prev => prev.map(r => r.id === updatedRoute.id ? updatedRoute : r));
                      }}
                      onClose={() => {
                        setIsEditingSchedule(false);
                        const route = routes.find(r => r.id === editingRouteId);
                        if (route) {
                          setExternalSelectedRoute(route);
                          setActiveWindow('routes');
                        }
                      }}
                    />
                  )}
                  
                  {editingCabinRouteId && (
                    <div className="absolute inset-0 z-[60] flex">
                      <RoutePlannerView
                        airports={airports}
                        fleet={fleet}
                        routes={routes}
                        airportManagement={airportManagement}
                        capital={capital}
                        onAddPendingSlotBills={(amt) => setPendingSlotBills(prev => prev + amt)}
                        pendingSlotBills={pendingSlotBills}
                        currentYear={1960 + Math.floor(currentDateOffset / 12)}
                        currentMonth={1 + (currentDateOffset % 12)}
                        difficulty={difficulty}
                        initialRouteId={editingCabinRouteId}
                        isEditingCabinOnly={true}
                        onSaveRoute={(route) => {
                          setRoutes(prev => prev.map(r => r.id === route.id ? route : r));
                          setEditingCabinRouteId(null);
                        }}
                        onClose={() => setEditingCabinRouteId(null)}
                        aiAirlines={aiAirlines}
                        airlineCode={airlineCode}
                      />
                    </div>
                  )}

                  {isPlanningRoute && (
                    <div className="absolute inset-0 z-[45] flex">
                      <RoutePlannerView
                        airports={airports}
                        fleet={fleet}
                        routes={routes}
                        airportManagement={airportManagement}
                        capital={capital}
                        initialOriginId={planningOriginId || undefined}
                        initialDestId={planningDestId || undefined}
                        initialSelectedReg={planningReg || undefined}
                        initialStep={planningStep}
                        initialSchedule={planningSchedule}
                        initialClassConfigs={planningClassConfigs}
                        initialRouteId={editingRouteId || undefined}
                        onOpenCatalog={(step) => {
                          setIsPurchasingForRoute(true);
                          setIsPlanningRoute(false);
                          if (step !== undefined) setPlanningStep(step);
                          setActiveWindow('buy-aircraft');
                        }}
                        onGoToAirport={(airport) => {
                          setIsPlanningRoute(false);
                          setSelectedAirport(airport);
                        }}
                        onOriginChange={(id) => setPlanningOriginId(id)}
                        onDestChange={(id) => setPlanningDestId(id)}
                        onRegChange={(reg) => setPlanningReg(reg)}
                        onStepChange={(step) => setPlanningStep(step)}
                        onScheduleChange={(s) => setPlanningSchedule(s)}
                        onClassConfigsChange={(cf) => setPlanningClassConfigs(cf)}
                        currentYear={1960 + Math.floor(currentDateOffset / 12)}
                        currentMonth={1 + (currentDateOffset % 12)}
                        difficulty={difficulty}
                        aiAirlines={aiAirlines}
                        airlineCode={airlineCode}
                        onSaveRoute={(route) => {
                          setRoutes(prev => {
                            const existing = prev.find(r => r.id === route.id);
                            if (existing) {
                              return prev.map(r => r.id === route.id ? route : r);
                            }
                            return [...prev, route];
                          });
                          // Reset planning state after save
                          setPlanningOriginId(null);
                          setPlanningDestId(null);
                          setPlanningReg(null);
                          setPlanningStep(1);
                          setPlanningSchedule([]);
                          setPlanningClassConfigs({
                            general: { catering: [['none']], extras: ['none'], service: ['none'] },
                            economy: { catering: [['none']], extras: ['none'], service: ['none'] },
                            premium: { catering: [['none']], extras: ['none'], service: ['none'] },
                            business: { catering: [['none']], extras: ['none'], service: ['none'] },
                            first: { catering: [['none']], extras: ['none'], service: ['none'] }
                          });
                          setEditingRouteId(null);
                          setIsPlanningRoute(false);
                          // Assign hub to aircraft if not present
                          setFleet(prev => prev.map(p => {
                            if (p.registration === route.aircraft && !p.hubId) {
                              return { ...p, hubId: route.origin };
                            }
                            return p;
                          }));
                        }}
                        onClose={() => {
                          setIsPlanningRoute(false);
                          setActiveWindow('map');
                        }}
                        onUnlockManagement={(airportId, level) => {
                          const cost = level === 1 ? 100000 : level === 2 ? 500000 : 2500000;
                          if (capital >= cost) {
                            setCapital(prev => prev - cost);
                            setAirportManagement(prev => {
                              const existing = prev[airportId] || { slots: { regional: 0, narrowbody: 0, widebody: 0 }, stands: { narrowbody: 0, widebody: 0 }, desks: { normal: 0, self: 0 } };
                              const desks = { ...existing.desks };
                              if (level >= 1 && desks.normal < 1) desks.normal = 1;
                              return {
                                ...prev,
                                [airportId]: {
                                  ...existing,
                                  desks,
                                  level: level as ManagementLevel
                                }
                              };
                            });
                          }
                        }}
                        onUpdateInfrastructure={(airportId, infra) => {
                          setAirportManagement(prev => ({ ...prev, [airportId]: infra }));
                        }}
                        onSubtractCapital={(amount) => {
                          setCapital(prev => prev - amount);
                        }}
                        onAddPendingSlotBills={(amt) => setPendingSlotBills(prev => prev + amt)}
                        pendingSlotBills={pendingSlotBills}
                      />
                    </div>
                  )}

                  {/* Airport Selection Window - Rendered inside the main view layout so sidebars remain visible */}
                  {selectedAirport && (
                    <div className="absolute inset-0 z-[2000]">
                      <AirportDetailView
                        airport={selectedAirport}
                        currentDateOffset={currentDateOffset}
                        onClose={() => setSelectedAirport(null)}
                        fleet={fleet}
                        routes={routes}
                        aiAirlines={aiAirlines}
                        onPerformGeneralCheck={(registration) => {
                          const plane = fleet.find(p => p.registration === registration);
                          if (!plane) return;

                          const restore = getGeneralCheckRestore(plane.generalChecksDone || 0);
                          // A fifth check restores nothing, so do not take the money for it.
                          if (restore <= 0) {
                            setAppAlert(`${registration} has had all four general checks. Further checks would restore nothing — retire or replace the airframe.`);
                            return;
                          }
                          if (capital < GENERAL_CHECK_COST) {
                            setAppAlert(`A general check costs ${formatCurrency(GENERAL_CHECK_COST)}. You do not have the capital.`);
                            return;
                          }

                          setCapital(prev => prev - GENERAL_CHECK_COST);
                          setFleet(prev => prev.map(p => {
                            if (p.registration !== registration) return p;
                            return {
                              ...p,
                              generalChecksDone: (p.generalChecksDone || 0) + 1,
                              conditionGeneral: Math.min(100, p.conditionGeneral + restore)
                            };
                          }));
                        }}
                        infrastructure={airportManagement[selectedAirport.id] || {
                          level: 0,
                          slots: { regional: 0, narrowbody: 0, widebody: 0 },
                          stands: { narrowbody: 0, widebody: 0 },
                          desks: { normal: 0, self: 0 }
                        }}
                        onBuyManagement={(tier) => {
                          const level = selectedAirport.level;
                          let cost = 0;
                          if (tier === 1) cost = level * 30000;
                          if (tier === 2) cost = level * 750000;
                          if (tier === 3) cost = level * 500000000;
                          
                          if (capital >= cost) {
                            setCapital(prev => prev - cost);
                            setAirportManagement(prev => {
                              const infra = prev[selectedAirport.id] || {
                                slots: { regional: 0, narrowbody: 0, widebody: 0 },
                                stands: { narrowbody: 0, widebody: 0, regional: 0 },
                                desks: { normal: 0, self: 0 }
                              };
                              const desks = { ...infra.desks };
                              if (tier >= 1 && desks.normal < 1) desks.normal = 1;

                              return {
                                ...prev,
                                [selectedAirport.id]: {
                                  ...infra,
                                  desks,
                                  level: tier as ManagementLevel,
                                  hubAutoUpgrade: tier >= 2,
                                  ...(tier >= 2 ? {
                                    stands: {
                                      ...infra.stands,
                                      narrowbody: infra.slots.narrowbody,
                                      widebody: infra.slots.widebody,
                                      regional: infra.slots.regional || 0
                                    }
                                  } : {})
                                }
                              };
                            });
                          }
                        }}
                        onUpdateInfrastructure={(infra) => {
                          // Costs are settled by onSubtractCapital / onAddPendingSlotBills
                          // before this runs; here we only store the new layout.
                          setAirportManagement(prev => ({
                            ...prev,
                            [selectedAirport.id]: infra
                          }));
                        }}
                        onSubtractCapital={(amount) => setCapital(prev => prev - amount)}
                        onAddPendingSlotBills={(amt) => setPendingSlotBills(prev => prev + amt)}
                        pendingSlotBills={pendingSlotBills}
                        capital={capital}
                        onManageRoutes={() => {
                          if (selectedAirport) {
                            setRouteFilter(selectedAirport.id);
                            setActiveWindow('routes');
                            setSelectedAirport(null);
                          }
                        }}
                        onStartRoute={(airportId, role) => {
                          setIsPlanningRoute(true);
                          if (role === 'origin') {
                            setPlanningOriginId(airportId);
                            setPlanningDestId(null);
                          } else {
                            setPlanningDestId(airportId);
                            setPlanningOriginId(null);
                          }
                          setSelectedAirport(null);
                        }}
                      />
                    </div>
                  )}
                  {/* Floating Next Month Button */}
                  {activeWindow === 'map' && !isPlanningRoute && !editingCabinRouteId && (
                    <div className="fixed bottom-6 right-6 z-[1000] pointer-events-auto">
                      <button
                        onClick={handleAdvanceMonth}
                        className="flex items-center gap-3 bg-aero-yellow text-black px-3 py-3 font-bold uppercase tracking-[0.2em] text-xs shadow-2xl border-2 border-aero-yellow hover:bg-white hover:border-white transition-all transform hover:scale-105 group font-sans italic"
                        title="Advance to next month"
                      >
                        Next Month
                        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Global Bottom Branding has been removed per user request */}
      
      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-aero-carbon border border-white/10 shadow-2xl p-4 max-w-lg w-full">
            <h2 className="text-2xl font-mono text-aero-yellow uppercase tracking-[0.2em] font-black drop-shadow-md mb-3">System Settings</h2>
            
            <div className="flex flex-col gap-4">
              <div className="space-y-4">
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Number Format (Decimal Separator)</label>
                <div className="flex gap-4">
                  {[".", ","].map((symbol) => (
                    <button
                      key={symbol}
                      onClick={() => setDecimalSymbol(symbol)}
                      className={`flex-1 p-4 font-mono text-xl border uppercase tracking-widest transition-colors ${decimalSymbol === symbol ? 'bg-aero-yellow text-black border-aero-yellow font-black' : 'bg-aero-carbon border-white/10 text-white hover:border-aero-yellow'}`}
                    >
                      {symbol === "." ? "1.234" : "1,234"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-white/50 font-bold flex justify-between">
                  <span>UI Scale Factor</span>
                  <span className="text-aero-yellow">{uiScaleSetting.toFixed(2)}x</span>
                </label>
                <input 
                  type="range" 
                  min="0.5" 
                  max="1.5" 
                  step="0.05" 
                  value={uiScaleSetting}
                  onChange={(e) => setUiScaleSetting(parseFloat(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
                <span className="text-[10px] text-white/30 font-mono">Adjusts the scale of the user interface. Auto-scaling is also active for small screens.</span>
              </div>

              <div className="flex flex-col gap-4 pt-4 border-t border-white/10">
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-widest text-white/50 font-bold flex justify-between">
                    <span>Autosave Interval (Months)</span>
                    <span className="text-aero-yellow">{autosaveInterval} Months</span>
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="12" 
                    step="1" 
                    value={autosaveInterval}
                    onChange={(e) => setAutosaveInterval(parseInt(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-aero-yellow"
                  />
                  <div className="flex justify-between text-[10px] text-white/30 uppercase tracking-widest">
                    <span>1 Month</span>
                    <span>12 Months</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white/5 p-4 select-none cursor-pointer border border-transparent hover:border-white/10 transition-colors" onClick={() => setAutosaveOverwrite(!autosaveOverwrite)}>
                  <div className={`w-5 h-5 flex items-center justify-center border ${autosaveOverwrite ? 'bg-aero-yellow border-aero-yellow text-black' : 'border-white/20'}`}>
                    {autosaveOverwrite && <Check size={14} />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-white uppercase tracking-widest font-black">Overwrite Save File</span>
                    <span className="text-[10px] text-white/40 max-w-sm leading-tight mt-1">If active, pending autosaves overwrite the current archive. If disabled, each autosave registers as a new clone.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-3 py-2 font-mono text-sm tracking-widest uppercase transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showSaveMenu && (
          <SaveLoadOverlay 
            mode="save"
            saves={saves}
            onSave={handleSaveGame}
            onDelete={deleteSave}
            onClose={() => setShowSaveMenu(false)}
          />
        )}
        {showLoadMenu && (
          <SaveLoadOverlay 
            mode="load"
            saves={saves}
            onLoad={handleLoadGame}
            onDelete={deleteSave}
            onClose={() => setShowLoadMenu(false)}
          />
        )}
        {selectedMessage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#121212] border-2 border-aero-yellow/40 max-w-lg w-full p-4 shadow-2xl relative text-left"
            >
              <div className="flex justify-between items-start border-b border-white/10 pb-4 mb-4">
                <div>
                  <span className="text-[9px] font-mono text-white/40 block mb-1 uppercase tracking-widest font-black">
                    {selectedMessage.details?.source || "Neo Airlines Dispatch"} • {selectedMessage.dateStr}
                  </span>
                  <h3 className="text-aero-yellow font-sans font-black italic tracking-wide text-lg uppercase leading-tight">
                    {selectedMessage.details?.title || "Inbox Transmission"}
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedMessage(null)}
                  className="text-white/40 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-sm transition-all"
                >
                  <X size={16} />
                </button>
              </div>
              
              <div className="text-sm text-white/85 font-sans leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto no-scrollbar pt-2 font-medium">
                {selectedMessage.details?.content || selectedMessage.text}
              </div>

              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => setSelectedMessage(null)}
                  className="bg-aero-yellow text-black hover:bg-white hover:text-black px-3 py-2.5 text-xs uppercase font-black tracking-widest transition-all animate-pulse"
                >
                  Acknowledge Dispatch
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
      </div>
    </div>
    </div>
  );
}

function ThemeMenuButton({ 
  index, 
  label, 
  onClick, 
  primary = false,
  disabled = false 
}: { 
  index: string, 
  label: string, 
  onClick: () => void,
  primary?: boolean,
  disabled?: boolean
}) {
  return (
    <button 
      onClick={disabled ? undefined : onClick}
      className={`
        group flex items-center p-1 transition-all
        ${disabled ? 'opacity-30 cursor-not-allowed grayscale' : 'cursor-pointer'}
        ${primary 
          ? 'bg-white text-black hover:bg-aero-yellow' 
          : 'bg-aero-carbon border border-white/10 text-white hover:border-aero-yellow'}
      `}
    >
      <span className={`
        px-4 py-3 font-mono text-sm transition-all
        ${primary 
          ? 'bg-black text-white group-hover:bg-white group-hover:text-black' 
          : 'bg-white/10 text-white/40 group-hover:bg-aero-yellow/20 group-hover:text-aero-yellow'}
      `}>
        {index}
      </span>
      <span className="flex-1 text-left px-3 font-black uppercase tracking-widest text-lg italic">
        {label}
      </span>
      <span className={`pr-6 opacity-0 group-hover:opacity-100 transition-all ${primary ? 'text-black' : 'text-aero-yellow'}`}>
        →
      </span>
    </button>
  );
}

function SidebarIcon({ icon, label, active = false, onClick }: { icon: ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`
      py-1.5 flex flex-col items-center gap-0.5 cursor-pointer transition-all w-full select-none
      ${active ? 'text-aero-yellow opacity-100' : 'text-white opacity-40 hover:opacity-100 hover:text-white'}
    `}>
      <div className={`p-1.5 rounded-lg border border-transparent ${active ? 'bg-aero-yellow/10 border-aero-yellow/20' : 'bg-transparent'}`}>
        {icon}
      </div>
      <span className="text-[7.5px] font-black tracking-widest text-center px-1 leading-[1.2]">{label}</span>
    </div>
  );
}

function GameStat({ label, value, trend }: { label: string, value: string, trend?: string }) {
  const isNegative = trend && (trend.startsWith('-') || trend.includes('-'));
  const trendColor = isNegative ? 'text-aero-yellow/60 font-bold' : 'text-aero-yellow font-bold';
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10.5px] uppercase tracking-widest text-white/40 font-bold mb-1 leading-none text-center">{label}</span>
      <div className="flex items-baseline justify-center gap-1.5 leading-none">
        <span className="text-sm md:text-base font-black italic tracking-tighter text-white font-mono">{value}</span>
        {trend && <span className={`${trendColor} font-mono text-[9px]`}>{trend}</span>}
      </div>
    </div>
  );
}

function GameMenuOption({ label, onClick }: { label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="text-left px-4 py-3 text-[11px] font-mono uppercase tracking-widest text-white/70 hover:text-aero-yellow hover:bg-white/5 transition-all outline-none"
    >
      {label}
    </button>
  );
}


function Stat({ label, value, highlighted = false }: { label: string, value: string, highlighted?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold">{label}</span>
      <span className={`text-xs font-mono font-bold ${highlighted ? 'text-[#FFD700]' : 'text-white'}`}>{value}</span>
    </div>
  );
}

function NavButton({ icon, label, active = false }: { icon: ReactNode, label: string, active?: boolean }) {
  return (
    <button className={`
      flex flex-col items-center justify-center gap-1 px-3 h-full transition-all border-t-2
      ${active ? 'border-[#FFD700] text-[#FFD700] bg-[#1a1a1a]/50' : 'border-transparent text-zinc-500 hover:text-white'}
    `}>
      {icon}
      <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
    </button>
  );
}


function LogEntry({ time, msg, type = 'info' }: { time: string, msg: string, type?: 'info' | 'warning' }) {
  return (
    <div className="flex gap-3 text-[10px] font-mono leading-tight">
      <span className="text-zinc-600 shrink-0">{time}</span>
      <span className={type === 'warning' ? 'text-aero-yellow/60' : 'text-zinc-400'}>{msg}</span>
    </div>
  );
}

function SaveLoadOverlay({ 
  saves, 
  onSave, 
  onLoad, 
  onDelete, 
  onClose, 
  mode 
}: { 
  saves: SaveMetadata[], 
  onSave?: (id?: string, name?: string) => void, 
  onLoad?: (id: string) => void, 
  onDelete: (id: string) => void, 
  onClose: () => void,
  mode: 'save' | 'load'
}) {
  const [saveName, setSaveName] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleAction = () => {
    if (mode === 'save') {
      if (selectedSlot) {
        setShowOverwriteConfirm(true);
      } else {
        onSave?.(undefined, saveName);
      }
    } else {
      if (selectedSlot) {
        onLoad?.(selectedSlot);
      }
    }
  };

  const handleConfirmOverwrite = () => {
    onSave?.(selectedSlot || undefined, saveName);
    setShowOverwriteConfirm(false);
  };

  const handleConfirmDelete = () => {
    if (showDeleteConfirm) {
      onDelete(showDeleteConfirm);
      if (selectedSlot === showDeleteConfirm) setSelectedSlot(null);
      setShowDeleteConfirm(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/90 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#141414] border border-white/10 w-full max-w-lg overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
           <h2 className="text-aero-yellow font-black uppercase tracking-[0.2em] text-[10px]">{mode === 'save' ? 'Operation: PERSISTENCE' : 'Operation: RESTORATION'}</h2>
           <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20}/></button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto no-scrollbar max-h-[60vh]">
          <div className="grid gap-2 mb-3">
            {saves.length === 0 ? (
              <div className="text-white/20 font-mono text-xs p-12 text-center border border-dashed border-white/5 uppercase tracking-widest">
                No telemetry archives discovered
              </div>
            ) : (
              [...saves].sort((a, b) => b.timestamp - a.timestamp).map(slot => (
                <div 
                  key={slot.id}
                  onClick={() => {
                    setSelectedSlot(slot.id);
                    if (mode === 'save') setSaveName(slot.name);
                  }}
                  className={`group p-4 border transition-all cursor-pointer flex justify-between items-center ${selectedSlot === slot.id ? 'bg-aero-yellow/10 border-aero-yellow shadow-2xl' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                >
                  <div className="flex flex-col">
                    <span className={`text-sm font-bold uppercase tracking-tight ${selectedSlot === slot.id ? 'text-aero-yellow' : 'text-white'}`}>{slot.name}</span>
                    <span className="text-[10px] font-mono text-white/30">{new Date(slot.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {mode === 'load' && selectedSlot === slot.id && <ChevronRight className="text-aero-yellow" size={16} />}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(slot.id); }}
                      className="opacity-0 group-hover:opacity-100 p-2 text-white/20 border border-transparent hover:text-aero-yellow/60 hover:border-white/20 hover:bg-[#111] transition-all rounded-sm"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {mode === 'save' && (
            <div className="space-y-4">
              <div className="h-px bg-white/10"></div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40">ARCHIVE_NAME_INPUT</label>
                <input 
                  type="text" 
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Designate save archive..."
                  className="w-full bg-black border border-white/10 p-4 text-white font-mono text-sm focus:outline-none focus:border-aero-yellow/50 transition-all placeholder:text-white/10"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-black/40 border-t border-white/5 flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 border border-white/10 text-white font-black uppercase tracking-widest hover:bg-white/5 transition-all text-xs"
          >
            Back
          </button>
          <button 
            onClick={handleAction}
            disabled={mode === 'save' ? !saveName.trim() : !selectedSlot}
            className={`flex-1 py-4 font-black uppercase tracking-widest transition-all text-xs ${mode === 'save' ? 'bg-aero-yellow text-black hover:bg-white' : 'bg-aero-yellow text-black hover:bg-white'} disabled:opacity-30`}
          >
            {mode === 'save' ? 'Save' : 'Load'}
          </button>
        </div>

        <AnimatePresence>
          {showOverwriteConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 flex items-center justify-center p-4 z-[100]"
            >
              <div className="text-center space-y-6 max-w-sm">
                 <div className="flex justify-center">
                    <AlertTriangle className="text-aero-yellow/60" size={64} />
                 </div>
                 <div className="space-y-2">
                   <h3 className="text-white text-xl font-bold uppercase tracking-tight">Overwrite Archive?</h3>
                   <p className="text-white/40 text-sm italic">Initializing this sequence will permanently erase the prior telemetry state for "{saves.find(s => s.id === selectedSlot)?.name}".</p>
                 </div>
                 <div className="flex gap-4 w-full">
                   <button 
                     onClick={() => setShowOverwriteConfirm(false)}
                     className="flex-1 py-3 border border-white/10 text-white font-bold uppercase tracking-widest hover:bg-white/5 transition-all text-xs"
                   >
                     Back
                   </button>
                   <button 
                     onClick={handleConfirmOverwrite}
                     className="flex-1 py-3 bg-[#1a1a1a] text-white font-bold uppercase tracking-widest hover:bg-[#1a1a1a] transition-all text-xs shadow-2xl"
                   >
                     Overwrite
                   </button>
                 </div>
              </div>
            </motion.div>
          )}

          {showDeleteConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 flex items-center justify-center p-4 z-[100]"
            >
              <div className="text-center space-y-6 max-w-sm">
                 <div className="flex justify-center">
                    <Trash2 className="text-aero-yellow/60" size={64} />
                 </div>
                 <div className="space-y-2">
                   <h3 className="text-white text-xl font-bold uppercase tracking-tight">Erase Archive?</h3>
                   <p className="text-white/40 text-sm italic">Are you sure you want to delete this telemetry archive? This action cannot be undone.</p>
                 </div>
                 <div className="flex gap-4 w-full">
                   <button 
                     onClick={() => setShowDeleteConfirm(null)}
                     className="flex-1 py-3 border border-white/10 text-white font-bold uppercase tracking-widest hover:bg-white/5 transition-all text-xs"
                   >
                     Back
                   </button>
                   <button 
                     onClick={handleConfirmDelete}
                     className="flex-1 py-3 bg-[#1a1a1a] text-white font-bold uppercase tracking-widest hover:bg-[#1a1a1a] transition-all text-xs shadow-2xl"
                   >
                     Delete
                   </button>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
