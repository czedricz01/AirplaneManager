import React, { useState, useMemo, useEffect } from 'react';
import { Plane, ChevronRight, Map as MapIcon, ArrowRightLeft, Search, Settings, Plus, Minus, Check, ChevronDown, ChevronUp, Utensils, Wifi, Users, Save, FolderOpen, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Airport, calculateDistance, getAirportStats } from '../data/airports';
import { OwnedAircraft } from './MyFleetView';
import { AirportInfrastructure, ManagementLevel } from '../App';
import { MEAL_DATA, EXTRAS_OPTIONS, SERVICE_OPTIONS } from '../data/catering';
import { RouteConfigOverlay } from './RouteConfigOverlay';
import { InfoTooltip, GLOSSARY } from './InfoTooltip';
import { RoutePlannerProvider, usePlanner } from './routePlanner/RoutePlannerContext';
import { CabinConfigDialogs } from './routePlanner/CabinConfigDialogs';
// The component used to declare a near-identical ScheduledTrip that shadowed
// this one, differing only in groupId being required. One type now.
import type { ConfigOutput } from './ConfigurePurchaseView';
import type { ScheduledTrip } from './RouteScheduleEditView';
import { readString } from '../lib/safeStorage';
import {
  getSlotPurchaseCost,
  calculateRouteFinancials,
  getJetFuelPrice,
  getPlaneSat,
  getDeskSim,
  getStandBonus,
  getLoungeBonus,
  calculateClassSatisfaction,
  getFlightTimeClass,
  getCateringOpt,
  getMultiOptionSum,
  TIME_CLASS_SAT_MULTIPLIERS,
  calculateDemand,
  calculateBasePrices,
  getSatMultiplier,
  getPriceDemandMultiplier,
  adjustSatForDifficulty,
  validateClassConfigs,
  getFlightDurationMinutes as sharedFlightDurationMinutes,
  RouteOffer,
} from '../lib/financeUtils';

interface Props {
  airports: Airport[];
  fleet: OwnedAircraft[];
  routes: import('../App').SimulatedRoute[];
  airportManagement: Record<string, AirportInfrastructure>;
  capital: number;
  initialOriginId?: string;
  initialDestId?: string;
  initialSelectedReg?: string;
  initialStep?: number;
  initialRouteId?: string;
  onUnlockManagement?: (airportId: string, level: ManagementLevel) => void;
  onUpdateInfrastructure?: (airportId: string, infra: AirportInfrastructure) => void;
  onSubtractCapital?: (amount: number) => void;
  onAddPendingSlotBills?: (amount: number) => void;
  /** Reports a refused or trimmed infrastructure purchase; these all used to fail silently. */
  onNotify?: (message: string) => void;
  /** Reputation effect on demand, so the preview matches the monthly report. */
  demandFactor?: number;
  /** Rival departures per city pair, for the market-share split. */
  rivalOffers?: RouteOffer[];
  pendingSlotBills?: number;
  onGoToAirport?: (airport: Airport) => void;
  onClose: () => void;
  onOpenCatalog?: (currentStep?: number) => void;
  onSaveRoute: (route: any) => void;
  onOriginChange?: (id: string | null) => void;
  onDestChange?: (id: string | null) => void;
  onRegChange?: (reg: string | null) => void;
  onStepChange?: (step: number) => void;
  onScheduleChange?: (schedule: any[]) => void;
  onClassConfigsChange?: (configs: any) => void;
  initialSchedule?: any[];
  initialClassConfigs?: Record<string, { catering: string[][], extras: string[], service: string[] }>;
  isEditingCabinOnly?: boolean;
  currentYear: number;
  currentMonth: number;
  difficulty: string;
  aiAirlines?: any[];
  airlineCode?: string;
}

function InfaRowSmall({ label, count, used, cost, costSuffix = '/wk', onBuy, disabled, disableRemove }: { label: string, count: number, used?: number, cost: number, costSuffix?: string, onBuy: (n: number, isShift: boolean) => void, disabled?: boolean, disableRemove?: boolean }) {
  return (
    <div className={`py-1.5 px-2 border transition-colors flex items-center justify-between ${disabled ? 'bg-white/[0.02] border-white/5 opacity-50' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
      <div className="flex flex-col w-24 shrink-0">
        <span className="text-3xs font-bold text-white uppercase tracking-widest">{label}</span>
        <span className="text-4xs text-aero-yellow/70 font-mono mt-0.5">{cost > 0 ? `$${cost.toLocaleString()}${costSuffix}` : 'FREE'}</span>
      </div>
      <div className="flex items-center gap-2">
        {used !== undefined && (
          <div className="text-right flex flex-col items-end border-r border-white/10 pr-2">
            <div className="text-4xs text-white/20 uppercase mb-0.5">Free</div>
            <span className="text-xs font-black text-white leading-none">{count - used}</span>
          </div>
        )}
        <div className="text-right flex flex-col items-end border-r border-white/10 pr-2">
          <div className="text-4xs text-white/20 uppercase mb-0.5">Stock</div>
          <span className="text-xs font-black text-white leading-none">{count}</span>
        </div>
        <div className="flex gap-0.5 ml-1">
          <button 
            disabled={disableRemove || disabled || count <= 0} 
            onClick={(e) => onBuy(-1, e.shiftKey)}
            className="w-5 h-5 flex items-center justify-center bg-black/40 border border-white/5 hover:border-aero-yellow disabled:opacity-0 transition-all text-white/50 hover:text-white text-2xs"
          >
            -
          </button>
          <button 
            disabled={disabled}
            onClick={(e) => onBuy(1, e.shiftKey)}
            className="w-5 h-5 flex items-center justify-center bg-white text-black font-black hover:bg-aero-yellow transition-all text-2xs"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfigBox({ label, value }: { label: string, value: number }) {
   return (
      <div className="bg-black/40 border border-white/10 p-2 flex flex-col items-center justify-center">
         <span className="text-4xs text-white/30 font-black uppercase tracking-widest mb-1">{label}</span>
         <span className="text-xs font-black text-white">{value}</span>
      </div>
   );
}

function DetailMetric({ label, value, color }: { label: string, value: string, color?: string }) {
   return (
      <div className="flex flex-col gap-0.5">
         <span className="text-2xs text-white/40 uppercase tracking-widest font-black">{label}</span>
         <span className={`text-base font-black italic tracking-tighter ${color || 'text-white'}`}>{value}</span>
      </div>
   );
}


/**
 * The wizard's state lives in RoutePlannerProvider; see
 * routePlanner/RoutePlannerContext.tsx for why. This outer component exists
 * only to mount it, so the inner one can read the state through a hook instead
 * of receiving thirty-odd values as props.
 */
export function RoutePlannerView(props: Props) {
  return (
    <RoutePlannerProvider
      initialSelection={{
        step: props.isEditingCabinOnly ? 3 : (props.initialRouteId ? 2 : (props.initialStep || 1)),
        originId: props.initialOriginId ?? null,
        destId: props.initialDestId ?? null,
        selectedReg: props.initialSelectedReg ?? null,
        schedule: props.initialSchedule || [],
        stashedSchedule: props.initialSchedule || [],
        classConfigs: props.initialClassConfigs || DEFAULT_CLASS_CONFIGS,
        ticketPrices: {}
      }}
    >
      <RoutePlannerInner {...props} />
    </RoutePlannerProvider>
  );
}

const DEFAULT_CLASS_CONFIGS = {
  general: { catering: [['none']], extras: ['none'], service: ['none'] },
  economy: { catering: [['none']], extras: ['none'], service: ['none'] },
  premium: { catering: [['none']], extras: ['none'], service: ['none'] },
  business: { catering: [['none']], extras: ['none'], service: ['none'] },
  first: { catering: [['none']], extras: ['none'], service: ['none'] }
};

function RoutePlannerInner({ 
  airports, fleet, routes, airportManagement, capital, 
  onUnlockManagement, onUpdateInfrastructure, onSubtractCapital, onAddPendingSlotBills, onNotify, demandFactor = 1, rivalOffers = [], pendingSlotBills, onClose, onSaveRoute, onOpenCatalog, currentYear, currentMonth, difficulty, onGoToAirport,
  initialOriginId, initialDestId, initialSelectedReg, initialStep, initialRouteId,
  initialSchedule, initialClassConfigs, isEditingCabinOnly,
  onOriginChange, onDestChange, onRegChange, onStepChange, onScheduleChange, onClassConfigsChange,
  aiAirlines = [],
  airlineCode = "NE"
}: Props) {
  const airportsMap = useMemo(() => {
    const m = new Map<string, Airport>();
    airports.forEach(a => m.set(a.id, a));
    return m;
  }, [airports]);

  const fleetMap = useMemo(() => {
    const m = new Map<string, OwnedAircraft>();
    fleet.forEach(f => m.set(f.registration, f));
    return m;
  }, [fleet]);

  const getUsedWeeklySlots = (airportId: string | null, aircraftClass: string) => {
    if (!airportId) return 0;
    return routes.reduce((acc, r) => {
       if (r.origin !== airportId && r.destination !== airportId) return acc;
       const rAc = fleetMap.get(r.aircraft);
       if (!rAc || rAc.class.toLowerCase() !== aircraftClass.toLowerCase()) return acc;
       return acc + (r.schedule?.length || 0);
    }, 0);
  };

  const getAiUsedWeeklySlots = (airportId: string | null) => {
    if (!airportId) return 0;
    return aiAirlines.reduce((sum, aiItem) => {
      if (!aiItem.routes) return sum;
      return sum + aiItem.routes.reduce((routeSum: number, r: any) => {
        if (r.origin === airportId || r.destination === airportId) {
          return routeSum + (r.departures || 0);
        }
        return routeSum;
      }, 0);
    }, 0);
  };

  const getAirportBonus = (airportId: string | null) => {
    return 0; // Removed level-based bonus
  };

  // Everything below reads the wizard state from the provider. The local names
  // are unchanged on purpose: the 3,000 lines of JSX further down did not have
  // to be touched, which is what makes this reviewable.
  const { selection, dispatch, ui, setUi } = usePlanner();
  const { step, originId, destId, selectedReg, schedule, classConfigs, ticketPrices, validationMsg } = selection;

  const setStep = (s: number) => {
    dispatch({ type: 'setStep', step: s });
    onStepChange?.(s);
  };
  const showSuccess = ui.showSuccess;
  const setShowSuccess = (v: any) => setUi('showSuccess', typeof v === 'function' ? v(ui.showSuccess) : v);
  const isFinalizing = ui.isFinalizing;
  const setIsFinalizing = (v: any) => setUi('isFinalizing', typeof v === 'function' ? v(ui.isFinalizing) : v);
  const activeConfigClass = ui.activeConfigClass;
  const setActiveConfigClass = (v: any) => setUi('activeConfigClass', typeof v === 'function' ? v(ui.activeConfigClass) : v);
  const expandedSections = ui.expandedSections;
  const setExpandedSections = (v: any) => setUi('expandedSections', typeof v === 'function' ? v(ui.expandedSections) : v);
  const takeControl = ui.takeControl;
  const setTakeControl = (v: any) => setUi('takeControl', typeof v === 'function' ? v(ui.takeControl) : v);
  const expandedMealCats = ui.expandedMealCats;
  const setExpandedMealCats = (v: any) => setUi('expandedMealCats', typeof v === 'function' ? v(ui.expandedMealCats) : v);
  const setClassConfigs = (
    next: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)
  ) => {
    dispatch({
      type: 'setClassConfigs',
      classConfigs: typeof next === 'function' ? (next as any)(classConfigs) : next
    });
  };

  useEffect(() => {
    if (initialRouteId && (!initialClassConfigs || JSON.stringify(initialClassConfigs) === JSON.stringify({
      general: { catering: [['none']], extras: ['none'], service: ['none'] },
      economy: { catering: [['none']], extras: ['none'], service: ['none'] },
      premium: { catering: [['none']], extras: ['none'], service: ['none'] },
      business: { catering: [['none']], extras: ['none'], service: ['none'] },
      first: { catering: [['none']], extras: ['none'], service: ['none'] }
    }))) {
      const r = routes.find(rt => rt.id === initialRouteId);
      if (r && r.classConfigs) {
        setClassConfigs(r.classConfigs);
      }
    }
  }, [initialRouteId]);

  
  useEffect(() => {
    onClassConfigsChange?.(classConfigs);
  }, [classConfigs, onClassConfigsChange]);

  const showConfigSaveModal = ui.showConfigSaveModal;
  const setShowConfigSaveModal = (v: any) => setUi('showConfigSaveModal', typeof v === 'function' ? v(ui.showConfigSaveModal) : v);
  const showConfigLoadModal = ui.showConfigLoadModal;
  const setShowConfigLoadModal = (v: any) => setUi('showConfigLoadModal', typeof v === 'function' ? v(ui.showConfigLoadModal) : v);
  const newConfigName = ui.newConfigName;
  const setNewConfigName = (v: any) => setUi('newConfigName', typeof v === 'function' ? v(ui.newConfigName) : v);






  const getComputedRouteSatCache = () => {
    const satCache: Record<string, number> = {};
    if (!selectedOrigin || !selectedDest || !selectedAircraft) return satCache;
    const planeSat = getPlaneSat(selectedAircraft);
    const deskPenalty = originDeskSim.sat + 
                        destDeskSim.sat;
    const standBonus = getStandBonus(selectedOrigin, selectedDest, selectedAircraft, airportManagement);

    ['economy', 'premium', 'business', 'first'].forEach(c => {
      const seats = selectedAircraft.config?.[c as keyof typeof selectedAircraft.config] as number || 0;
      if (seats > 0) {
         const dur = getFlightDurationMinutes();
         const sce = calculateClassSatisfaction(c, selectedAircraft, classConfigs[c], dur, airportManagement, selectedOrigin.id, selectedDest.id, difficulty).satisfactionPercentage;
         const loungeBonus = getLoungeBonus(selectedOrigin.id, c, airportManagement) + getLoungeBonus(selectedDest.id, c, airportManagement);
         const baseSat = (planeSat * 0.4) + (sce * 0.6) + loungeBonus + deskPenalty + standBonus;
         satCache[c] = Math.round(Math.max(0, adjustSatForDifficulty(baseSat, difficulty)));
      }
    });
    return satCache;
  };



  const setOriginId = (id: string | null) => {
    dispatch({ type: 'selectOrigin', originId: id });
    onOriginChange?.(id);
  };
  const setDestId = (id: string | null) => {
    dispatch({ type: 'selectDest', destId: id });
    onDestChange?.(id);
  };

  useEffect(() => {
    if (initialOriginId) {
      setOriginId(initialOriginId);
    }
  }, [initialOriginId]);

  useEffect(() => {
    if (initialDestId) {
      setDestId(initialDestId);
    }
  }, [initialDestId]);



  /**
   * Choosing an aircraft has to re-time the existing timetable, and the reducer
   * cannot work out the new leg duration and turnaround on its own: they depend
   * on the airports and the incoming aircraft's cruise speed. So they are
   * computed here, for the aircraft being selected rather than the one still in
   * state, and handed to the action along with the range and ICAO verdict.
   */
  const setSelectedReg = (reg: string | null) => {
    const incoming = reg ? fleet.find(f => f.registration === reg) : null;

    let adapt: { durMin: number; turnoverMin: number } | undefined;
    let validationMsg: string | null = null;

    if (incoming && selectedOrigin && selectedDest) {
      adapt = {
        durMin: sharedFlightDurationMinutes(selectedOrigin, selectedDest, incoming),
        turnoverMin: incoming.class === 'Regional' ? 30 : incoming.class === 'Widebody' ? 90 : 60
      };

      const dist = Math.round(calculateDistance(
        selectedOrigin.coords[0], selectedOrigin.coords[1],
        selectedDest.coords[0], selectedDest.coords[1]
      ));
      if (incoming.maxRange < dist) {
        validationMsg = `AIRCRAFT RANGE VIOLATION: Range is ${incoming.maxRange.toLocaleString()} km but distance is ${dist.toLocaleString()} km.`;
      } else if (incoming.icaoCode > selectedDest.maxIcaoCode || incoming.icaoCode > selectedOrigin.maxIcaoCode) {
        validationMsg = 'AIRCRAFT CLASS EXCEEDS PORT CAPACITY';
      }
    }

    dispatch({ type: 'selectAircraft', reg, adapt, validationMsg });
    onRegChange?.(reg);
  };

  useEffect(() => {
    if (initialSelectedReg) {
      setSelectedReg(initialSelectedReg);
    }
  }, [initialSelectedReg]);

  useEffect(() => {
    if (initialRouteId) {
      const r = routes.find(rt => rt.id === initialRouteId);
      if (r) {
        if (!initialSchedule || initialSchedule.length === 0) {
          if (r.schedule) {
            const cleanSchedule = (r.schedule || []).map((s: any) => ({
              ...s,
              startHour: Number(s.startHour) || 0,
              startMin: Number(s.startMin) || 0,
              dayId: Number(s.dayId) || 1,
              durMin: Number(s.durMin) || 0,
              turnoverMin: Number(s.turnoverMin) || 0
            }));
            setSchedule(cleanSchedule);
          }
        }
        if (!originId) setOriginId(r.origin);
        if (!destId) setDestId(r.destination);
        if (!selectedReg) setSelectedReg(r.aircraft);
        if (r.ticketPrices && Object.keys(ticketPrices).length === 0) {
          setTicketPrices(r.ticketPrices);
        }
      }
    }
  }, [initialRouteId]);

  const originSearch = ui.originSearch;
  const setOriginSearch = (v: any) => setUi('originSearch', typeof v === 'function' ? v(ui.originSearch) : v);
  const destSearch = ui.destSearch;
  const setDestSearch = (v: any) => setUi('destSearch', typeof v === 'function' ? v(ui.destSearch) : v);
  const debugMode = readString('airline_debug_mode') === 'true';
  const showDemandDebug = ui.showDemandDebug;
  const setShowDemandDebug = (v: any) => setUi('showDemandDebug', typeof v === 'function' ? v(ui.showDemandDebug) : v);
  const showPricingDebug = ui.showPricingDebug;
  const setShowPricingDebug = (v: any) => setUi('showPricingDebug', typeof v === 'function' ? v(ui.showPricingDebug) : v);
  const destSortBy = ui.destSortBy;
  const setDestSortBy = (v: any) => setUi('destSortBy', typeof v === 'function' ? v(ui.destSortBy) : v);
  const aircraftSearch = ui.aircraftSearch;
  const setAircraftSearch = (v: any) => setUi('aircraftSearch', typeof v === 'function' ? v(ui.aircraftSearch) : v);
  const setTicketPrices = (
    next: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)
  ) => {
    dispatch({
      type: 'setTicketPrices',
      ticketPrices: typeof next === 'function' ? (next as any)(ticketPrices) : next
    });
  };

  const selectedOrigin = useMemo(() => originId ? airportsMap.get(originId) : undefined, [originId, airportsMap]);
  const selectedDest = useMemo(() => destId ? airportsMap.get(destId) : undefined, [destId, airportsMap]);

  
  const selectedAircraft = useMemo(() => selectedReg ? fleetMap.get(selectedReg) : undefined, [selectedReg, fleetMap]);

  useEffect(() => {
    if (selectedAircraft && classConfigs) {
      const validated = validateClassConfigs(classConfigs, selectedAircraft, airportManagement, selectedOrigin, selectedDest);
      if (validated !== classConfigs) {
        setClassConfigs(validated);
      }
    }
  }, [selectedAircraft, airportManagement, selectedOrigin, selectedDest, classConfigs]);

  const originHubs = useMemo(() => {
    return airports.filter(a => {
      const isHub = (airportManagement?.[a.id]?.level || 0) >= 2;
      const matchesSearch = a.id.toLowerCase().includes(originSearch.toLowerCase()) || a.name.toLowerCase().includes(originSearch.toLowerCase());
      return isHub && matchesSearch;
    });
  }, [airports, airportManagement, originSearch]);

  function getLongestFreeBlock(aircraftRegistration: string) {
    const aircraftRoutes = routes.filter(r => r.aircraft === aircraftRegistration && r.id !== initialRouteId);
    const occupied = aircraftRoutes.flatMap(r => r.schedule?.map(s => {
      const cycleMin = s.isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30);
      const start = ((s.dayId - 1) * 24 * 60) + (s.startHour * 60 + s.startMin);
      return { start, end: start + Math.ceil(cycleMin / 5) * 5 };
    }) || []).sort((a, b) => a.start - b.start);

    if (occupied.length === 0) return 10080;

    const merged: { start: number, end: number }[] = [];
    if (occupied.length > 0) {
      let current = { ...occupied[0] };
      for (let i = 1; i < occupied.length; i++) {
        if (occupied[i].start < current.end) {
          current.end = Math.max(current.end, occupied[i].end);
        } else {
          merged.push(current);
          current = { ...occupied[i] };
        }
      }
      merged.push(current);
    }

    let maxGap = 0;
    for (let i = 0; i < merged.length; i++) {
      const nextStart = i === merged.length - 1 ? merged[0].start + 10080 : merged[i+1].start;
      const gap = nextStart - merged[i].end;
      if (gap > maxGap) maxGap = gap;
    }
    
    return maxGap;
  }

  function getOpsCapacityForDays(aircraftRegistration: string, days: number[]) {
    const aircraftRoutes = routes.filter(r => r.aircraft === aircraftRegistration && r.id !== initialRouteId);
    const existingOccupied = aircraftRoutes.flatMap(r => r.schedule?.map(s => {
      const cycleMin = s.isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30);
      const start = ((s.dayId - 1) * 1440) + (s.startHour * 60 + s.startMin);
      return { start, end: start + Math.ceil(cycleMin / 5) * 5 };
    }) || []);

    const currentOccupied = schedule.map(s => {
      const cycleMin = s.isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30);
      const start = ((s.dayId - 1) * 1440) + (s.startHour * 60 + s.startMin);
      return { start, end: start + Math.ceil(cycleMin / 5) * 5 };
    });

    const occupied = [...existingOccupied, ...currentOccupied];
    const testDays = days.length > 0 ? days : [1,2,3,4,5,6,7];
    
    let minMaxDayFree = 1440;
    for (const d of testDays) {
      const dayStart = (d - 1) * 1440;
      const dayEnd = d * 1440;
      const dayOcc = occupied.filter(o => o.start < dayEnd && o.end > dayStart)
        .map(o => ({ 
          start: Math.max(dayStart, o.start), 
          end: Math.min(dayEnd, o.end) 
        }))
        .sort((a,b) => a.start - b.start);
      
      if (dayOcc.length === 0) {
        minMaxDayFree = Math.min(minMaxDayFree, 1440);
        continue;
      }

      let currentMax = 0;
      let last = dayStart;
      for (const occ of dayOcc) {
        currentMax = Math.max(currentMax, occ.start - last);
        last = Math.max(last, occ.end);
      }
      currentMax = Math.max(currentMax, dayEnd - last);
      minMaxDayFree = Math.min(minMaxDayFree, currentMax);
    }
    return minMaxDayFree;
  }

  function getFlightDurationMinutes(dest?: Airport) {
    // The model itself lives in financeUtils so the schedule editor computes the
    // same block time this planner priced the route with.
    return sharedFlightDurationMinutes(selectedOrigin, dest || selectedDest, selectedAircraft);
  }

  function getTurnoverMinutes() {
    if (!selectedAircraft) return 60;
    if (selectedAircraft.class === 'Regional') return 30;
    if (selectedAircraft.class === 'Widebody') return 90;
    return 60; // Narrowbody
  }

  const validDestinations = useMemo(() => {
    const search = destSearch.toLowerCase();
    // These do not depend on the candidate airport, so they are computed once instead
    // of once per airport. getLongestFreeBlock alone rescans and sorts the whole
    // timetable, and it used to run for every one of the ~500 airports per keystroke.
    const turnMin = getTurnoverMinutes();
    const longestFree = selectedAircraft ? getLongestFreeBlock(selectedAircraft.registration) : 0;

    const list = airports.filter(a => {
      if (a.id === originId) return false;
      const matchesSearch = a.id.toLowerCase().includes(search) || a.name.toLowerCase().includes(search);
      if (!selectedOrigin || !selectedAircraft || !matchesSearch) return matchesSearch;

      const dist = Math.round(calculateDistance(selectedOrigin.coords[0], selectedOrigin.coords[1], a.coords[0], a.coords[1]));
      if (dist > selectedAircraft.maxRange) return false;

      // ICAO Code Restrictions
      if (selectedAircraft.icaoCode > a.maxIcaoCode) return false;

      // Time constraint filtering
      const testDurMin = getFlightDurationMinutes(a);
      const blockTime = Math.ceil((30 + testDurMin * 2 + turnMin + 30) / 5) * 5;

      return blockTime <= longestFree;
    });

    return [...list].sort((a, b) => {
      if (destSortBy === 'distance') {
        const distA = selectedOrigin ? calculateDistance(selectedOrigin.coords[0], selectedOrigin.coords[1], a.coords[0], a.coords[1]) : 0;
        const distB = selectedOrigin ? calculateDistance(selectedOrigin.coords[0], selectedOrigin.coords[1], b.coords[0], b.coords[1]) : 0;
        return distB - distA; // Large to small
      }
      
      const statsA = getAirportStats(a, currentYear);
      const statsB = getAirportStats(b, currentYear);
      
      if (destSortBy === 'tourism') return statsB.tourism - statsA.tourism;
      if (destSortBy === 'business') return statsB.business - statsA.business;
      
      // Default: combined
      return (statsB.tourism + statsB.business) - (statsA.tourism + statsA.business);
    });
  }, [airports, destSearch, originId, selectedAircraft, selectedOrigin, routes, destSortBy, currentYear]);

  // Routes grouped by aircraft, so the utilisation check below is a lookup instead of
  // a full scan of the network for every aircraft in the fleet.
  const routesByAircraft = useMemo(() => {
    const map = new Map<string, any[]>();
    routes.forEach(r => {
      if (r.id === initialRouteId) return;
      const list = map.get(r.aircraft);
      if (list) list.push(r);
      else map.set(r.aircraft, [r]);
    });
    return map;
  }, [routes, initialRouteId]);

  const validAircraft = useMemo(() => {
    const search = aircraftSearch.toLowerCase();
    return fleet.filter(ac => {
      const matchesSearch = ac.registration.toLowerCase().includes(search) || ac.type.toLowerCase().includes(search);
      if (!matchesSearch) return false;

      // Hub restriction
      if (selectedOrigin && ac.hubId && ac.hubId !== selectedOrigin.id) {
        return false;
      }

      // ICAO Code Restrictions (infrastructure check)
      if (selectedOrigin || selectedDest) {
        const checkIcao = (airportId: string | null) => {
          if (!airportId) return true;
          const airport = airportsMap.get(airportId);
          if (!airport) return true;
          return ac.icaoCode <= airport.maxIcaoCode;
        };

        if (!checkIcao(selectedOrigin?.id || null)) return false;
        if (!checkIcao(selectedDest?.id || null)) return false;
      }

      // Utilization check
      let usedMins = 0;
      (routesByAircraft.get(ac.registration) || []).forEach(r => {
         if (r.schedule) {
            r.schedule.forEach((s: any) => {
               const cycleMin = s.isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30);
               usedMins += Math.ceil(cycleMin / 5) * 5;
            });
         }
      });
      const utilPercent = (usedMins / 10080) * 100;
      if (utilPercent >= 95) return false;

      // Check if any flight is possible
      const longestFree = getLongestFreeBlock(ac.registration);
      if (longestFree < 120) return false; // Minimum block time for round trip

      if (!selectedOrigin || !selectedDest) return true;
      const dist = calculateDistance(selectedOrigin.coords[0], selectedOrigin.coords[1], selectedDest.coords[0], selectedDest.coords[1]);
      return ac.maxRange >= dist;
    });
  }, [fleet, selectedOrigin, selectedDest, aircraftSearch, routes, routesByAircraft, airportsMap]);

  const mgt = airportManagement || {};
  const originMgtLvl = selectedOrigin ? (mgt[selectedOrigin.id]?.level || 0) : 0;
  const destMgtLvl = selectedDest ? (mgt[selectedDest.id]?.level || 0) : 0;

  const isOneWay = false;
  const [isStopoverMode, setIsStopoverMode] = useState(false);

  const initialBase = React.useMemo(() => Math.floor(1000 + Math.random() * 8000), []);
  // Stable id for a route that is being created. The previous code minted a fresh id
  // on every render, so the draft had no identity until the moment it was saved.
  const draftRouteId = React.useMemo(() => Date.now().toString(36) + Math.random().toString(36).substring(2), []);
  const [flightNumberOutbound, setFlightNumberOutbound] = useState(initialBase.toString());
  const [flightNumberInbound, setFlightNumberInbound] = useState((initialBase + 1).toString());

  const [flightHour, setFlightHour] = useState(() => {
    return initialSchedule && initialSchedule.length > 0 ? initialSchedule[0].startHour : 8;
  });
  const [flightMinute, setFlightMinute] = useState(() => {
    return initialSchedule && initialSchedule.length > 0 ? initialSchedule[0].startMin : 0;
  });

  const isScheduleValid = (testSchedule: ScheduledTrip[]) => {
    const existingAircraftRoutes = selectedAircraft ? routes.filter(r => r.aircraft === selectedAircraft.registration && r.id !== initialRouteId) : [];
    const occupied = existingAircraftRoutes.flatMap(r => r.schedule?.map(s => {
      const c = Math.ceil(((s as any).isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30)) / 5) * 5;
      const start = ((s.dayId - 1) * 24 * 60) + (s.startHour * 60 + s.startMin);
      return { start, end: start + c };
    }) || []);

    for (const trip of testSchedule) {
      const tempStart = (trip.dayId - 1) * 1440 + trip.startHour * 60 + trip.startMin;
      const cycle = Math.ceil(((trip as any).isOneWay ? (30 + trip.durMin + 30) : (30 + trip.durMin + trip.turnoverMin + trip.durMin + 30)) / 5) * 5;
      const newEnd = tempStart + cycle;
      for (const occ of occupied) {
        if (checkOverlap(tempStart, newEnd, occ.start, occ.end)) {
          return false;
        }
      }
    }
    return true;
  }

  const handleClockChange = (deltaMin: number) => {
    if (schedule.length > 0) {
      const nextSchedule = schedule.map(trip => {
        const currentTotal = (trip.dayId - 1) * 1440 + trip.startHour * 60 + trip.startMin;
        const newTotalWeekMin = (currentTotal + deltaMin + 10080) % 10080;
        return {
          ...trip,
          dayId: Math.floor(newTotalWeekMin / 1440) + 1,
          startHour: Math.floor((newTotalWeekMin % 1440) / 60),
          startMin: (newTotalWeekMin % 1440) % 60,
          _tempStart: newTotalWeekMin
        };
      });
      if (isScheduleValid(nextSchedule)) {
         setSchedule(nextSchedule);
         const dragInitial = schedule.find(s => s.isGroupLead);
         if (dragInitial) {
            const currentTotal = (dragInitial.dayId - 1) * 1440 + dragInitial.startHour * 60 + dragInitial.startMin;
            const newTotalMin = (currentTotal + deltaMin + 10080) % 10080;
            setFlightHour(Math.floor((newTotalMin % 1440) / 60));
            setFlightMinute((newTotalMin % 1440) % 60);
         } else {
           const total = flightHour * 60 + flightMinute + deltaMin;
           const newTotal = (total + 10080) % 1440;
           setFlightHour(Math.floor(newTotal / 60));
           setFlightMinute(newTotal % 60);
         }
      }
    } else {
         const total = flightHour * 60 + flightMinute + deltaMin;
         const newTotal = (total + 10080) % 1440;
         setFlightHour(Math.floor(newTotal / 60));
         setFlightMinute(newTotal % 60);
    }
  }

  // Time displayed in clock: Preparation Start (30m before departure)
  const prepStartHour = Math.floor(((flightHour * 60 + flightMinute - 30 + 1440) % 1440) / 60);
  const prepStartMin = (flightHour * 60 + flightMinute - 30 + 1440) % 60;

  const handleSetPrepTime = (h: number, m: number) => {
    // Convert prep start back to departure time
    const depTotalMin = (h * 60 + m + 30) % 1440;
    setFlightHour(Math.floor(depTotalMin / 60));
    setFlightMinute(depTotalMin % 60);
  };

  const daysOfWeek = [
    { id: 1, label: 'Mon' },
    { id: 2, label: 'Tue' },
    { id: 3, label: 'Wed' },
    { id: 4, label: 'Thu' },
    { id: 5, label: 'Fri' },
    { id: 6, label: 'Sat' },
    { id: 7, label: 'Sun' },
  ];

  const setSchedule = (
    next: ScheduledTrip[] | ((prev: ScheduledTrip[]) => ScheduledTrip[])
  ) => {
    dispatch({
      type: 'setSchedule',
      schedule: typeof next === 'function' ? (next as any)(schedule) : next
    });
  };

  /**
   * The check-in simulation for each end of the route.
   *
   * getDeskSim builds a Map over the whole fleet and scans every route on each
   * call. Step 3 of the wizard used to call it 28 times per render with
   * identical arguments -- once per toggle of a meal, an extra or a class tab.
   * Two memos cover all 28.
   */
  const originDeskSim = React.useMemo(
    () => selectedOrigin && selectedDest && selectedAircraft
      ? getDeskSim(selectedOrigin.id, airportManagement, routes, fleet, selectedOrigin, selectedDest, selectedAircraft, schedule.length, initialRouteId)
      // Must match what getDeskSim actually returns. It was { capacity, weeklyPax }
      // here, so with an origin and destination chosen but no aircraft yet, the
      // JSX read sim.myPax as undefined and .toLocaleString() took down the
      // whole planner.
      : { load: 0, sat: 0, myPax: 0, cap: 0 },
    [selectedOrigin, selectedDest, selectedAircraft, airportManagement, routes, fleet, schedule.length, initialRouteId]
  );
  const destDeskSim = React.useMemo(
    () => selectedOrigin && selectedDest && selectedAircraft
      ? getDeskSim(selectedDest.id, airportManagement, routes, fleet, selectedOrigin, selectedDest, selectedAircraft, schedule.length, initialRouteId)
      // Must match what getDeskSim actually returns. It was { capacity, weeklyPax }
      // here, so with an origin and destination chosen but no aircraft yet, the
      // JSX read sim.myPax as undefined and .toLocaleString() took down the
      // whole planner.
      : { load: 0, sat: 0, myPax: 0, cap: 0 },
    [selectedOrigin, selectedDest, selectedAircraft, airportManagement, routes, fleet, schedule.length, initialRouteId]
  );

  const lastScheduleRef = React.useRef<ScheduledTrip[]>(initialSchedule || []);

  React.useEffect(() => {
    if (schedule.length > 0) {
      lastScheduleRef.current = schedule;
    }
  }, [schedule]);

  const weeklyUtilization = useMemo(() => {
    if (!selectedAircraft) return 0;
    const aircraftRoutes = routes.filter(r => r.aircraft === selectedAircraft.registration && r.id !== initialRouteId);
    let totalMinutes = aircraftRoutes.reduce((acc, r) => {
      const tripsMinutes = (r.schedule || []).reduce((sAcc, s) => {
        const cycleMin = s.isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30);
        return sAcc + cycleMin;
      }, 0);
      return acc + tripsMinutes;
    }, 0);
    const draftMinutes = schedule.reduce((acc, s) => {
      const cycleMin = s.isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30);
      return acc + cycleMin;
    }, 0);
    totalMinutes += draftMinutes;
    return Math.min(100, (totalMinutes / 10080) * 100);
  }, [selectedAircraft, routes, schedule]);

  
  const fuelPrice = useMemo(
    () => getJetFuelPrice(currentYear, currentMonth, difficulty),
    [currentYear, currentMonth, difficulty]
  );

  // A draft of the route as it currently stands in the wizard. Every financial
  // preview below is derived from this one object via the shared engine, so the
  // planner can no longer disagree with the monthly report.
  const routeDraft = useMemo(() => {
    if (!selectedOrigin || !selectedDest || !selectedAircraft) return null;
    return {
      id: initialRouteId || draftRouteId,
      origin: selectedOrigin.id,
      destination: selectedDest.id,
      distance: Math.round(calculateDistance(selectedOrigin.coords[0], selectedOrigin.coords[1], selectedDest.coords[0], selectedDest.coords[1])),
      durMin: getFlightDurationMinutes(),
      schedule,
      classConfigs,
      ticketPrices,
      activeTicketPrices: ticketPrices
    };
  }, [selectedOrigin, selectedDest, selectedAircraft, schedule, classConfigs, ticketPrices, initialRouteId, draftRouteId]);

  // Numbers shown in the wizard. Outside Easy these assume a full aircraft, which is
  // what a "what could this route earn" preview should show.
  const financials = useMemo(() => {
    if (!routeDraft || !selectedAircraft) return null;

    const engine = calculateRouteFinancials(
      routeDraft, selectedAircraft, fuelPrice, airportManagement,
      currentYear, currentMonth, difficulty, airportsMap, routes, fleet,
      difficulty !== 'Easy', demandFactor, rivalOffers
    );
    const b = engine.costsBreakdown;

    return {
      ...engine,
      dist: engine.distance,
      fuelPrice,
      weeklyFuelCost: b.fuel,
      weeklyCrewCost: b.crew,
      weeklyInfraCost: b.infra,
      originDepartures: schedule.length,
      destDepartures: schedule.filter(s => !s.isOneWay).length,
      originLandingFees: b.originLandingFees,
      destLandingFees: b.destLandingFees,
      originCheckInUnit: b.originCheckInUnit,
      destCheckInUnit: b.destCheckInUnit,
      originCheckInFees: b.originCheckInFees,
      destCheckInFees: b.destCheckInFees,
      originPaxFeeUnit: b.originPaxFeeUnit,
      destPaxFeeUnit: b.destPaxFeeUnit,
      originPaxHandlingFees: b.originPaxHandlingFees,
      destPaxHandlingFees: b.destPaxHandlingFees
    };
  }, [routeDraft, selectedAircraft, fuelPrice, airportManagement, currentYear, currentMonth, difficulty, airportsMap, routes, fleet, schedule]);

  // The figures actually stored on the route: realistic load factors, not full load.
  const saveFinancials = useMemo(() => {
    if (!routeDraft || !selectedAircraft) return null;
    return calculateRouteFinancials(
      routeDraft, selectedAircraft, fuelPrice, airportManagement,
      currentYear, currentMonth, difficulty, airportsMap, routes, fleet,
      false, demandFactor, rivalOffers
    );
  }, [routeDraft, selectedAircraft, fuelPrice, airportManagement, currentYear, currentMonth, difficulty, airportsMap, routes, fleet, demandFactor]);

  useEffect(() => {
    if (step === 4 && financials && Object.keys(ticketPrices).length === 0) {
       const base = financials.basePriceBE75;
       setTicketPrices({
         economy: Math.round(base),
         premium: Math.round(base * 1.6),
         business: Math.round(base * 3.0),
         first: Math.round(base * 5.0)
       });
    }
  }, [step, financials, ticketPrices]);

  useEffect(() => {
    onScheduleChange?.(schedule);
  }, [schedule]);
  const setValidationMsg = (message: string | null) =>
    dispatch({ type: 'setValidation', message });

  const checkOverlap = (s1: number, e1: number, s2: number, e2: number) => {
    if (s1 < e2 && e1 > s2) return true;
    if (s1 + 10080 < e2 && e1 + 10080 > s2) return true;
    if (s1 - 10080 < e2 && e1 - 10080 > s2) return true;
    return false;
  };

  const handleDragStart = (e: React.MouseEvent, dragTrip: ScheduledTrip) => {
    e.preventDefault();
    const startY = e.clientY;
    
    // Shift all trips in the current schedule proportionally
    const initialPositions = schedule.map(s => ({ 
      id: s.id, 
      startWeekMin: (s.dayId - 1) * 1440 + s.startHour * 60 + s.startMin
    }));

    const existingAircraftRoutes = selectedAircraft ? routes.filter(r => r.aircraft === selectedAircraft.registration && r.id !== initialRouteId) : [];
    const occupied = existingAircraftRoutes.flatMap(r => r.schedule?.map(s => {
      const c = Math.ceil((s.isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30)) / 5) * 5;
      const start = ((s.dayId - 1) * 24 * 60) + (s.startHour * 60 + s.startMin);
      return { start, end: start + c };
    }) || []);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaMin = Math.round(deltaY / 10) * 5;
      
      const nextSchedule = schedule.map(trip => {
        const initial = initialPositions.find(p => p.id === trip.id);
        if (initial) {
          const newTotalWeekMin = (initial.startWeekMin + deltaMin + 10080) % 10080;
          return {
            ...trip,
            dayId: Math.floor(newTotalWeekMin / 1440) + 1,
            startHour: Math.floor((newTotalWeekMin % 1440) / 60),
            startMin: (newTotalWeekMin % 1440) % 60,
            _tempStart: newTotalWeekMin
          };
        }
        return trip;
      });

      let conflict = false;
      for (const trip of nextSchedule) {
        const tempStart = (trip as any)._tempStart;
        if (tempStart !== undefined) {
          const cycle = Math.ceil(((trip as any).isOneWay ? (30 + trip.durMin + 30) : (30 + trip.durMin + trip.turnoverMin + trip.durMin + 30)) / 5) * 5;
          const newEnd = tempStart + cycle;
          for (const occ of occupied) {
            if (checkOverlap(tempStart, newEnd, occ.start, occ.end)) {
              conflict = true;
              break;
            }
          }
        }
        if (conflict) break;
      }

      if (!conflict) {
        setSchedule(nextSchedule);
        
        // Update the reference flight control time based on the dragged trip's movement
        const dragInitial = initialPositions.find(p => p.id === dragTrip.id)!;
        const newDragWeekMin = (dragInitial.startWeekMin + deltaMin + 10080) % 10080;
        
        // If we are dragging a group lead, we can update the flight controls directly
        if (dragTrip.isGroupLead) {
          setFlightHour(Math.floor((newDragWeekMin % 1440) / 60));
          setFlightMinute((newDragWeekMin % 1440) % 60);
        }
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const generateFlightNumber = () => {
    const base = Math.floor(1000 + Math.random() * 8000);
    setFlightNumberOutbound(base.toString());
    setFlightNumberInbound((base + 1).toString());
  };

  const handleToggleDay = (d: number) => {
    // Determine base days currently selected
    let currentDays = schedule.filter(s => s.isGroupLead).map(s => {
      let baseDay = s.dayId - Math.floor((s.startHour * 60 + s.startMin) / 1440);
      while (baseDay < 1) baseDay += 7;
      while (baseDay > 7) baseDay -= 7;
      return baseDay;
    });

    if (currentDays.includes(d)) {
      currentDays = currentDays.filter(day => day !== d);
    } else {
      currentDays.push(d);
    }

    setSchedule([]); // clear current schedule, we will rebuild it
    setValidationMsg(null);

    if (currentDays.length === 0) return;
    if (!selectedOrigin || !selectedDest || !selectedAircraft) return;

    const aircraftClass = selectedAircraft.class;
    const slotKey = aircraftClass.toLowerCase() as 'regional' | 'narrowbody' | 'widebody';
    
    // Fast capacity check
    const currentOriginUsed = getUsedWeeklySlots(selectedOrigin.id, aircraftClass);
    const originCap = airportManagement[selectedOrigin.id]?.slots?.[slotKey] || 0;
    if (currentOriginUsed + currentDays.length * multipleOps > originCap) {
       setValidationMsg(`Not enough ${aircraftClass} slots at ${selectedOrigin.id}.`);
       return;
    }
    
    const currentDestUsed = getUsedWeeklySlots(selectedDest.id, aircraftClass);
    const destCap = airportManagement[selectedDest.id]?.slots?.[slotKey] || 0;
    if (currentDestUsed + currentDays.length * multipleOps > destCap) {
       setValidationMsg(`Not enough ${aircraftClass} slots at ${selectedDest.id}.`);
       return;
    }

    const durMin = getFlightDurationMinutes();
    const turnMin = getTurnoverMinutes();
    const cycleMin = Math.ceil((30 + durMin + turnMin + durMin + 30) / 5) * 5;

    let bestStartM = (flightHour * 60 + flightMinute);
    const existingAircraftRoutes = routes.filter(r => r.aircraft === selectedAircraft.registration && r.id !== initialRouteId);
    const occupied = existingAircraftRoutes.flatMap(r => r.schedule?.map(s => {
      const c = Math.ceil(((s as any).isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30)) / 5) * 5;
      const start = ((s.dayId - 1) * 24 * 60) + (s.startHour * 60 + s.startMin);
      return { start, end: start + c };
    }) || []);

    // Search for best start time universally
    let found = false;

    // Check if the current time works first
    let currentConflict = false;
    if (schedule.length > 0) {
      for (const cd of currentDays) {
        let dayConflict = false;
        for (let op = 0; op < multipleOps; op++) {
          const currentStart = bestStartM + (op * cycleMin);
          const newStart = ((cd - 1) * 24 * 60) + currentStart;
          const newEnd = newStart + cycleMin;
          for (const occ of occupied) {
            if (checkOverlap(newStart, newEnd, occ.start, occ.end)) { dayConflict = true; break; }
          }
          if (dayConflict) break;
        }
        if (dayConflict) { currentConflict = true; break; }
      }
      if (!currentConflict) {
        found = true;
      }
    }

    if (!found) {
      let testTimes = [];
      for (let testM = 0; testM < 1440; testM += 5) testTimes.push(testM);
      
      const allEnds = [
        ...occupied.map(occ => (occ.end % 1440)),
        ...schedule.map(s => {
          const c = s.isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30);
          return ((s.startHour * 60 + s.startMin) + Math.ceil(c / 5) * 5) % 1440;
        })
      ];

      // If the aircraft has no trips and we are starting fresh, pick a random time
      if (allEnds.length === 0) {
        testTimes = [testTimes[Math.floor(Math.random() * testTimes.length)]];
      } else {
        // Find the latest end time across all days to prioritize continuity
        const maxEnd = Math.max(...allEnds);
        
        testTimes.sort((a, b) => {
          let diffA = (a - maxEnd + 1440) % 1440;
          let diffB = (b - maxEnd + 1440) % 1440;
          return diffA - diffB;
        });
      }

      for (const testM of testTimes) {
        let conflict = false;
        for (const cd of currentDays) {
          let dayConflict = false;
          for (let op = 0; op < multipleOps; op++) {
            const currentStart = testM + (op * cycleMin);
            const newStart = ((cd - 1) * 24 * 60) + currentStart;
            const newEnd = newStart + cycleMin;
            for (const occ of occupied) {
              if (checkOverlap(newStart, newEnd, occ.start, occ.end)) { dayConflict = true; break; }
            }
            if (dayConflict) break;
          }
          if (dayConflict) { conflict = true; break; }
        }
        if (!conflict) {
          bestStartM = testM;
          found = true;
          break;
        }
      }
    }

    if (!found) {
      setValidationMsg(`Could not find a valid time slot for all selected days.`);
      return;
    }

    setFlightHour(Math.floor(bestStartM / 60));
    setFlightMinute(bestStartM % 60);

    let newSchedule: ScheduledTrip[] = [];
    for (const cd of currentDays) {
      if (isNaN(cd)) continue;
      const bGroupId = Math.random().toString();
      for (let i = 0; i < multipleOps; i++) {
        const currentStart = Number(bestStartM) + (i * cycleMin);
        const dayOffset = Math.floor(currentStart / 1440);
        const adjustedDayId = ((Number(cd) + dayOffset - 1) % 7) + 1;
        const startInDay = currentStart % 1440;
        
        const fOut = (parseInt(flightNumberOutbound) || 1000) + (i * 2);
        const fIn = (parseInt(flightNumberInbound) || 1001) + (i * 2);

        newSchedule.push({
          id: Math.random().toString(),
          groupId: bGroupId,
          isGroupLead: i === 0,
          flightNumOut: fOut.toString(),
          flightNumIn: fIn.toString(),
          dayId: adjustedDayId,
          startHour: Math.floor(startInDay / 60),
          startMin: Math.floor(startInDay % 60),
          durMin: Number(durMin) || 0,
          turnoverMin: Number(turnMin) || 0
        });
      }
    }
    
    setSchedule(newSchedule);
  };

  const getDeskCost = (hub: boolean, type: string) => {
    switch (type) {
      case 'normal': return Math.floor(2500 * (hub ? 0.95 : 1));
      case 'self': return Math.floor(1500 * (hub ? 0.95 : 1));
      default: return 2500;
    }
  };

  const getStandCost = (type: string) => {
    switch(type) {
       case 'regional': return 150;
       case 'narrowbody': return 300;
       case 'widebody': return 600;
       default: return 0;
    }
  };

  const handleUpdateInfra = (airportId: string, type: 'slots' | 'stands' | 'desks', subType: string, baseAmount: number, isShift?: boolean) => {
     let amount = isShift ? baseAmount * 10 : baseAmount;
     // What the click asked for, before any clamping below. Comparing against
     // baseAmount would be wrong on a shift-click, where amount starts at 10x.
     const requested = amount;
     const mgt = airportManagement || {};

     const level = mgt[airportId]?.level || 0;
     const hubAutoUpgrade = level >= 2;
     
     // Only slots have a one-off purchase price. Desks and stands are rented and show
     // up as weekly upkeep instead — charging their weekly rate as an upfront fee here
     // made them cost money in this screen but nothing in the airport console.
     const costPerUnit = type === 'slots' ? getSlotPurchaseCost(subType) : 0;

     const infra = mgt[airportId] || { level, slots: { regional: 0, narrowbody: 0, widebody: 0 }, stands: { narrowbody: 0, widebody: 0 }, desks: { normal: 0, self: 0 } };
     
     let actualCost = costPerUnit * amount;

     const currentPending = pendingSlotBills || 0;
     if (type === 'slots' && amount > 0) {
        const targetAirport = airportsMap.get(airportId);
        if (targetAirport) {
           const totalS = targetAirport.level * 300;
           const currentRented = (infra.slots?.regional || 0) + (infra.slots?.narrowbody || 0) + (infra.slots?.widebody || 0);
           const aiUsedS = getAiUsedWeeklySlots(airportId);
           const availS = Math.max(0, totalS - currentRented - aiUsedS);
           if (amount > availS) {
              amount = availS;
              actualCost = costPerUnit * amount;
           }
        }
     }
     if (amount <= 0 && baseAmount > 0) {
       onNotify?.(`No ${subType} slots are free at ${airportId} — the airport and its other carriers have taken them all.`);
       return;
     }
     if (requested > 0 && amount < requested) {
       onNotify?.(`Only ${amount} of the ${requested} ${subType} slots you asked for are free at ${airportId}.`);
     }
     if (amount > 0 && type === 'slots' && (capital - currentPending) < actualCost) {
       onNotify?.(
         `${amount} ${subType} slot${amount === 1 ? '' : 's'} at ${airportId} cost $${Math.round(actualCost).toLocaleString('en-US')}, ` +
         `but only $${Math.round(capital - currentPending).toLocaleString('en-US')} is uncommitted. Nothing was bought.`
       );
       return;
     }

     const newInfra = JSON.parse(JSON.stringify(infra)); // Deep copy
     if (!newInfra[type]) newInfra[type] = {};
     
     const oldVal = newInfra[type][subType] || 0;
     let newVal = Math.max(0, oldVal + amount);
     
     // Ensure minimum 1 normal desk if level >= 1
     if (level >= 1 && type === 'desks' && subType === 'normal' && newVal < 1) newVal = 1;

     // Ensure stands can't exceed slots if level < 2
     if (!hubAutoUpgrade && type === 'stands' && amount > 0) {
         const currentSlots = newInfra.slots[subType] || 0;
         if (newVal > currentSlots) {
             newVal = currentSlots;
             amount = newVal - oldVal;
             actualCost = costPerUnit * amount;
         }
         if (amount <= 0) {
           onNotify?.(`Stands cannot outnumber slots. Buy more ${subType} slots at ${airportId} first.`);
           return;
         }
     }

     newInfra[type][subType] = newVal;

     // Process auto buy stands
     if (type === 'slots' && amount > 0 && (hubAutoUpgrade || infra.autoBuyStands)) {
         if (!newInfra.stands) newInfra.stands = {};
         newInfra.stands[subType] = (newInfra.stands[subType] || 0) + amount;
     }

     if (amount > 0 && type === 'slots' && actualCost > 0) {
        if (onAddPendingSlotBills) {
           onAddPendingSlotBills(actualCost);
        } else {
           onSubtractCapital?.(actualCost);
        }
     }
     onUpdateInfrastructure(airportId, newInfra);
  };

  // Reset and Auto-set optimal start time logic
  React.useEffect(() => {
    if (step === 2 && selectedOrigin && selectedDest && selectedAircraft) {
      if (schedule.length === 0) {
        const { hour, minute, autoSchedule } = findOptimalConfig();
        setFlightHour(hour);
        setFlightMinute(minute);
        setSchedule(autoSchedule);
      }
    }
  }, [step, selectedOrigin, selectedDest, selectedAircraft]); 

  // The cascade that used to live here -- an effect comparing the current
  // origin, destination and registration against a ref of their previous values
  // to decide whether to clear the schedule, restore a stashed one, re-time it
  // and reset the validation message -- is now three reducer cases in
  // routePlanner/plannerState.ts. It applies in the same tick as the change
  // instead of a render later, and it is covered by tests that need no browser.

  const findOptimalConfig = () => {
    if (!selectedOrigin || !selectedDest || !selectedAircraft) return { hour: 8, minute: 0, autoSchedule: [] };

    const durMin = getFlightDurationMinutes();
    const turnMin = getTurnoverMinutes();
    const totalDurRaw = (30 + durMin + turnMin + durMin + 30);
    const cycleMin = Math.ceil(totalDurRaw / 5) * 5;

    const existingTrips = routes
      .filter(r => r.aircraft === selectedAircraft.registration && r.id !== initialRouteId)
      .flatMap(r => r.schedule?.map(s => {
          const exCycleRaw = s.isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30);
          const exCycle = Math.ceil(exCycleRaw / 5) * 5;
          const start = ((s.dayId - 1) * 24 * 60) + (s.startHour * 60 + s.startMin);
          return { start, end: start + exCycle };
      }) || []);

    const aircraftClass = selectedAircraft.class;
    const slotKey = aircraftClass.toLowerCase() as 'regional' | 'narrowbody' | 'widebody';
    const mgt = airportManagement || {};
    const originCap = mgt[selectedOrigin.id]?.slots?.[slotKey] || 0;
    const destCap = mgt[selectedDest.id]?.slots?.[slotKey] || 0;
    const originUsed = getUsedWeeklySlots(selectedOrigin.id, aircraftClass);
    const destUsed = getUsedWeeklySlots(selectedDest.id, aircraftClass);
    const maxPossibleTrips = Math.min(7, originCap - originUsed, destCap - destUsed);

    if (maxPossibleTrips <= 0) return { hour: 8, minute: 0, autoSchedule: [] };

    let bestScore = -1;
    let bestResult = { hour: 8, minute: 0, autoSchedule: [] as ScheduledTrip[] };

    // If no existing trips, randomize or pick a set time that works
    const noExisting = existingTrips.length === 0;

    for (let totalMin = 0; totalMin < 1440; totalMin += 5) {
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      
      const testSchedule: ScheduledTrip[] = [];
      const checkOverlapLocal = (s1: number, e1: number, s2: number, e2: number) => {
        if (s1 < e2 && e1 > s2) return true;
        if (s1 + 10080 < e2 && e1 + 10080 > s2) return true;
        if (s1 - 10080 < e2 && e1 - 10080 > s2) return true;
        return false;
      };

      for (let dayId = 1; dayId <= 7; dayId++) {
        if (testSchedule.length >= maxPossibleTrips) break;
        
        const start = ((dayId - 1) * 24 * 60) + totalMin;
        const end = start + cycleMin;
        
        let conflict = false;
        for (const ex of existingTrips) {
          if (checkOverlapLocal(start, end, ex.start, ex.end)) {
            conflict = true;
            break;
          }
        }
        if (!conflict) {
          for (const ts of testSchedule) {
             const tsStart = ((ts.dayId - 1) * 24 * 60) + totalMin;
             const tsEnd = tsStart + cycleMin;
             if (checkOverlapLocal(start, end, tsStart, tsEnd)) {
               conflict = true;
               break;
             }
          }
        }

        if (!conflict) {
          testSchedule.push({
            id: Math.random().toString(),
            groupId: Math.random().toString(),
            isGroupLead: true,
            flightNumOut: (parseInt(flightNumberOutbound) || 1000).toString(),
            flightNumIn: (parseInt(flightNumberInbound) || 1001).toString(),
            dayId: Number(dayId), 
            startHour: Number(h), 
            startMin: Number(m),
            durMin: Number(durMin) || 0, 
            turnoverMin: Number(turnMin) || 0
          });
        }
      }

      if (testSchedule.length > 0) {
        let minGap = 10080;
        if (existingTrips.length > 0) {
           testSchedule.forEach(ts => {
             const tsStart = ((ts.dayId - 1) * 24 * 60) + totalMin;
             existingTrips.forEach(ex => {
                let gap = (tsStart - ex.end + 10080) % 10080;
                if (gap < minGap) minGap = gap;
             });
           });
        } else {
           // For 0 existing trips, we prefer a time that looks "standard" like 08:00
           // But still want max frequency. We add a small preference for earlier morning or 08:00
           const morningPref = Math.abs(totalMin - 480); // Distance from 08:00
           minGap = morningPref; 
        }

        const score = testSchedule.length * 100000 - minGap;
        if (score > bestScore) {
          bestScore = score;
          bestResult = { hour: h, minute: m, autoSchedule: testSchedule };
        }
      }
    }

    return bestResult;
  };

  const [showSuccessMsg, setShowSuccessMsg] = useState(false);

  const [multipleOps, setMultipleOps] = useState(1);
  const [maximizeFlights, setMaximizeFlights] = useState(false);

  // How many round trips a day can physically hold for the selected aircraft.
  // Computed once instead of three times inline, and clamped through an effect
  // rather than a setTimeout fired from the middle of render.
  const maxMultipleOps = useMemo(() => {
    if (!selectedAircraft) return 1;
    const legMin = getFlightDurationMinutes();
    const turnMin = getTurnoverMinutes();
    const totalDurRaw = 30 + legMin + turnMin + legMin + 30;
    if (totalDurRaw >= 720) return 1;
    const cycleMin = Math.ceil(totalDurRaw / 5) * 5;
    if (cycleMin <= 0) return 1;
    const maxDayFree = getOpsCapacityForDays(selectedAircraft.registration, []);
    return Math.max(1, Math.floor(maxDayFree / cycleMin));
  }, [selectedAircraft, selectedOrigin, selectedDest, routes, schedule, initialRouteId]);

  useEffect(() => {
    if (multipleOps > maxMultipleOps) setMultipleOps(maxMultipleOps);
  }, [multipleOps, maxMultipleOps]);

  const allBlocks = React.useMemo(() => {
    if (!selectedOrigin || !selectedDest || !selectedAircraft) return [];
    
    const rawBlocks = [
      ...routes.filter(r => r.aircraft === selectedAircraft.registration && r.id !== initialRouteId).flatMap(r => r.schedule?.map(s => ({ s: s, isBusy: true, orig: r.origin, dest: r.destination })) || []),
      ...schedule.map(s => ({ s: s, isBusy: false, orig: selectedOrigin.id, dest: selectedDest.id }))
    ];

    return rawBlocks.flatMap(({ s, isBusy, orig, dest }) => {
      const durMin = s.durMin;
      const turnMin = s.turnoverMin;
      const totalDurRaw = (s as any).isOneWay ? (30 + durMin + 30) : (30 + durMin + turnMin + durMin + 30);
      const cycleMin = Math.ceil(totalDurRaw / 5) * 5;
      const blockStartAbs = s.startHour * 60 + s.startMin; 
      
      let blocksArr = [];
      let remCycle = cycleMin;
      let currStart = blockStartAbs;
      let currDay = s.dayId;

      if (currStart < 0) {
          currDay = (currDay - 2 + 7) % 7 + 1;
          currStart += 1440;
      }

      let iIdx = 0;
      while (remCycle > 0) {
          const availToday = 1440 - currStart;
          const durToday = Math.min(availToday, remCycle);
          const isFirst = iIdx === 0;
          remCycle -= durToday;
          const isLast = remCycle <= 0;

          blocksArr.push({
             id: `${s.id}-${iIdx++}`,
             dayId: currDay,
             top: (currStart / 60) * 30, // Matches 720px / 24h
             height: (durToday / 60) * 30,
             isBusy, s, orig, dest,
             isFirst, isLast,
             isContinues: !isFirst
          });
          currStart = 0;
          currDay = (currDay % 7) + 1;
      }
      return blocksArr;
    });
  }, [routes, schedule, selectedAircraft, selectedOrigin, selectedDest]);

  return (
    <div 
       className="absolute inset-0 z-50 p-2 lg:p-3 flex flex-col font-sans overflow-hidden bg-aero-panel-2 text-white"
       style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.98)), url("https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=2000&auto=format&fit=crop")' }}
    >
      {/* Success Message Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
             <div className="bg-aero-yellow text-black px-12 py-4 rounded-sm shadow-2xl flex flex-col items-center gap-4 text-center">
                <div className="w-20 h-20 bg-black/10 rounded-full flex items-center justify-center">
                   <Check size={48} strokeWidth={3} />
                </div>
                <div>
                   <h3 className="text-3xl font-black uppercase italic tracking-tighter">Route Updated</h3>
                   <p className="text-xs uppercase tracking-[0.2em] font-bold opacity-70 mt-1">Changes saved successfully</p>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. SHARED UNIFIED HEADER WITH DYNAMIC ROUTE INFO BADGES */}
      <div className="flex flex-col gap-2 mb-2 shrink-0 relative bg-black/60 border-b border-white/10 px-4 py-2 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
             <h2 className="text-sm font-black uppercase tracking-wider text-aero-yellow whitespace-nowrap">
                {isEditingCabinOnly ? "Cabin Editor" : "Route Planner"}
             </h2>
             <span className="text-white/20 text-xs font-normal">|</span>
             <div className="flex bg-white/5 border border-white/10 rounded-sm">
               {!isEditingCabinOnly && [
                  { id: 1, label: "1. Setup" },
                  { id: 2, label: "2. Schedule" },
                  { id: 3, label: "3. Cabin" },
                  { id: 4, label: "4. Pricing" }
               ].map((s) => {
                 const isActive = step === s.id;
                 const isCompleted = step > s.id;
                 const isAllowed = s.id === 1 ||
                   (s.id === 2 && selectedOrigin && selectedAircraft && selectedDest && destMgtLvl >= 1) ||
                   (s.id === 3 && selectedOrigin && selectedAircraft && selectedDest && schedule.length > 0) ||
                   (s.id === 4 && selectedOrigin && selectedAircraft && selectedDest && schedule.length > 0 && Object.keys(classConfigs).length > 0);
                 
                 return (
                   <button
                     key={s.id}
                     type="button"
                     disabled={!isAllowed}
                     aria-current={isActive ? 'step' : undefined}
                     onClick={() => isAllowed && setStep(s.id)}
                     className={`flex items-center px-3 py-1.5 text-2xs uppercase font-bold tracking-widest border-0 border-r border-white/5 last:border-0 bg-transparent transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-aero-yellow ${
                       isActive ? 'bg-aero-yellow/10 text-aero-yellow cursor-default' : 
                       isAllowed ? 'text-white/60 hover:text-white hover:bg-white/5 cursor-pointer' : 'text-white/20 cursor-not-allowed'
                     }`}
                   >
                     {s.label}
                     {isCompleted && <Check size={8} className="ml-1 text-aero-yellow" />}
                   </button>
                 )
               })}
             </div>
          </div>
          <div className="flex items-center gap-2">
            {/*
              This is the wizard's only error channel — range violations, missing
              slots, ICAO limits and failed schedule fits all surface here. It
              used to render black text on #111 at 9px, a contrast ratio of about
              1.06:1, so the player saw a disabled Next button and no reason for
              it. Made legible, and announced to assistive tech.
            */}
            {validationMsg && (
              <div
                role="alert"
                className="flex items-center gap-1.5 bg-aero-warn/15 border border-aero-warn/50 text-aero-warn px-2.5 py-1 font-bold uppercase tracking-wider text-2xs mr-2"
              >
                <AlertTriangle size={12} className="shrink-0" />
                {validationMsg}
              </div>
            )}
            <button 
               onClick={() => setIsStopoverMode(!isStopoverMode)}
               className={`hidden px-2 py-1 text-3xs uppercase font-bold tracking-widest border transition-all ${isStopoverMode ? 'bg-[#FACC15] text-black border-transparent shadow-2xl' : 'bg-white/5 text-white/30 border-white/10 hover:border-white/30'}`}
            >
              Stopover
            </button>
            <button onClick={onClose} className="text-white/60 hover:text-white uppercase text-3xs tracking-widest font-bold font-mono border border-white/10 px-2 py-1 bg-black/30 hover:border-aero-yellow transition-all">
              [X]
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden relative">
        {step === 1 && (
          <div className="w-full flex flex-col flex-1 min-h-0">
            <div className="flex-1 w-full flex flex-col lg:flex-row gap-4 min-h-0 overflow-y-auto lg:overflow-hidden">
            {/* Origin */}
            <div className="w-full lg:w-1/3 border border-white/10 flex flex-col h-full bg-black/40">
              <div className="py-2.5 px-3 bg-white/5 border-b border-white/10 text-center uppercase tracking-widest font-bold text-xs">Origin Hub</div>
              
              {!selectedOrigin ? (
                <div className="p-2.5 flex flex-col flex-1 overflow-hidden">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search Hub..." 
                      className="w-full bg-white/5 border border-white/10 p-2 pl-9 outline-none text-xs font-mono focus:border-aero-yellow"
                      value={originSearch}
                      onChange={e => setOriginSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-1 bg-black/20 p-2 border border-white/5">
                      {originHubs.map(a => {
                        const totalSlots = a.level * 300;
                        const infra = airportManagement[a.id];
                        const rentedSlots = infra ? (infra.slots.regional + infra.slots.narrowbody + infra.slots.widebody) : 0;
                        const aiSlotsUsed = getAiUsedWeeklySlots(a.id);
                        const available = Math.max(0, totalSlots - rentedSlots - aiSlotsUsed);
                        return (
                          <div 
                            key={a.id} 
                            onClick={() => setOriginId(a.id)}
                            className="p-3 border border-white/10 bg-white/5 hover:bg-aero-yellow/10 hover:border-aero-yellow/50 cursor-pointer flex justify-between items-center"
                          >
                            <div>
                              <div className="font-bold">{a.id}</div>
                              <div className="text-2xs text-white/50">{a.name}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className="text-3xs font-mono text-white/30">
                                SLOTS: {available}/{totalSlots}
                              </div>
                              <div className="flex gap-2 text-4xs font-mono">
                                <span className="text-aero-yellow">T: {getAirportStats(a, currentYear).tourism}</span>
                                <span className="text-white/80">B: {getAirportStats(a, currentYear).business}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex justify-between items-center bg-white/5 p-2 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="text-xl font-black text-aero-yellow">{selectedOrigin.id}</div>
                      <div className="flex flex-col">
                         <div className="text-2xs text-white/60 truncate w-32 md:w-auto">{selectedOrigin.name}</div>
                         <div className="flex gap-2 text-4xs uppercase tracking-widest font-mono text-white/40">
                           <span>B:{getAirportStats(selectedOrigin, currentYear).business}</span>
                           <span>T:{getAirportStats(selectedOrigin, currentYear).tourism}</span>
                           <span className={((airportManagement[selectedOrigin.id]?.slots?.regional || 0) + (airportManagement[selectedOrigin.id]?.slots?.narrowbody || 0) + (airportManagement[selectedOrigin.id]?.slots?.widebody || 0)) > 0 ? "text-aero-yellow font-bold" : ""}>S:{Math.max(0, (selectedOrigin.level * 300) - getAiUsedWeeklySlots(selectedOrigin.id)) - ((airportManagement[selectedOrigin.id]?.slots?.regional || 0) + (airportManagement[selectedOrigin.id]?.slots?.narrowbody || 0) + (airportManagement[selectedOrigin.id]?.slots?.widebody || 0))}/{selectedOrigin.level * 300}</span>
                         </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                       <button onClick={() => onGoToAirport(selectedOrigin)} className="text-4xs text-white/50 hover:text-white py-1.5 px-2 border border-white/10" title="Go to Airport"><MapIcon size={10} /></button>
                       <button onClick={() => setOriginId(null)} className="text-4xs text-aero-yellow py-1.5 px-2 border border-aero-yellow/20 hover:bg-aero-yellow hover:text-black">CHG</button>
                    </div>
                  </div>
                  {/* Strategic Infrastructure Dashboard */}
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-black/40 p-2.5 flex flex-col gap-4 pb-32">
                     <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <div className="text-aero-yellow text-2xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                           <MapIcon size={12} /> Strategic Slots
                        </div>
                        <span className="text-4xs text-white/30 tracking-widest font-mono">STOCK / COST / ACTION</span>
                     </div>
                     <div className="space-y-2">
                        <InfaRowSmall label="Regional" count={(airportManagement || {})[selectedOrigin.id]?.slots?.regional || 0} used={getUsedWeeklySlots(selectedOrigin.id, 'regional')} cost={getSlotPurchaseCost('regional')} costSuffix=" one-off" onBuy={(n, shift) => handleUpdateInfra(selectedOrigin.id, 'slots', 'regional', n, shift)} />
                        <InfaRowSmall label="Narrowb." count={(airportManagement || {})[selectedOrigin.id]?.slots?.narrowbody || 0} used={getUsedWeeklySlots(selectedOrigin.id, 'narrowbody')} cost={getSlotPurchaseCost('narrowbody')} costSuffix=" one-off" onBuy={(n, shift) => handleUpdateInfra(selectedOrigin.id, 'slots', 'narrowbody', n, shift)} />
                        <InfaRowSmall label="Widebody" count={(airportManagement || {})[selectedOrigin.id]?.slots?.widebody || 0} used={getUsedWeeklySlots(selectedOrigin.id, 'widebody')} cost={getSlotPurchaseCost('widebody')} costSuffix=" one-off" onBuy={(n, shift) => handleUpdateInfra(selectedOrigin.id, 'slots', 'widebody', n, shift)} />
                     </div>

                     <div className="flex justify-between items-center border-b border-white/10 pb-2 mt-2">
                        <div className="text-aero-yellow text-2xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                           <Plane size={12} /> Stand Upgrades
                        </div>
                        {(airportManagement[selectedOrigin.id]?.level || 0) < 2 && (
                          <button 
                             onClick={() => onUpdateInfrastructure(selectedOrigin.id, { ...airportManagement[selectedOrigin.id], autoBuyStands: !(airportManagement[selectedOrigin.id]?.autoBuyStands) })}
                             className={`text-4xs uppercase tracking-widest px-2 py-0.5 border ${airportManagement[selectedOrigin.id]?.autoBuyStands ? 'border-aero-yellow text-aero-yellow bg-aero-yellow/10' : 'border-white/20 text-white/40'}`}
                          >
                             AUTO-BUY: {airportManagement[selectedOrigin.id]?.autoBuyStands ? 'ON' : 'OFF'}
                          </button>
                        )}
                     </div>
                     <div className="space-y-2">
                        <InfaRowSmall label="Narrowb." count={airportManagement[selectedOrigin.id]?.stands?.narrowbody || 0} cost={getStandCost('narrowbody')} disabled={(airportManagement[selectedOrigin.id]?.level || 0) >= 2} onBuy={(n, shift) => handleUpdateInfra(selectedOrigin.id, 'stands', 'narrowbody', n, shift)} />
                        <InfaRowSmall label="Widebody" count={airportManagement[selectedOrigin.id]?.stands?.widebody || 0} cost={getStandCost('widebody')} disabled={(airportManagement[selectedOrigin.id]?.level || 0) >= 2} onBuy={(n, shift) => handleUpdateInfra(selectedOrigin.id, 'stands', 'widebody', n, shift)} />
                     </div>

                     <div className="flex justify-between items-center border-b border-white/10 pb-2 mt-2">
                        <div className="text-aero-yellow text-2xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                           <ChevronRight size={12} /> Passenger Processing
                        </div>
                     </div>
                     <div className="space-y-2">
                        <InfaRowSmall label="Normal Desk" count={airportManagement[selectedOrigin.id]?.desks?.normal || 0} disableRemove={(airportManagement[selectedOrigin.id]?.level || 0) >= 1 && (airportManagement[selectedOrigin.id]?.desks?.normal || 0) <= 1} cost={getDeskCost((airportManagement[selectedOrigin.id]?.level || 0) >= 2, 'normal')} onBuy={(n, shift) => handleUpdateInfra(selectedOrigin.id, 'desks', 'normal', n, shift)} />
                        <InfaRowSmall label="Self-Check" count={airportManagement[selectedOrigin.id]?.desks?.self || 0} cost={getDeskCost((airportManagement[selectedOrigin.id]?.level || 0) >= 2, 'self')} onBuy={(n, shift) => handleUpdateInfra(selectedOrigin.id, 'desks', 'self', n, shift)} />
                     </div>
                     {(() => {
                        const sim = originDeskSim;
                        return (
                          <div className="mt-2 text-2xs text-white/50 space-y-1">
                            <div className="flex justify-between"><span className="uppercase tracking-widest flex items-center">Desk Load:<InfoTooltip size={11} {...GLOSSARY.deskLoad} /></span><span className={sim.load > 90 ? 'text-aero-warn font-bold' : 'text-white'}>{sim.load.toFixed(1)}%</span></div>
                            <div className="flex justify-between"><span className="uppercase tracking-widest">Weekly Pax:</span><span className="text-white">{sim.myPax.toLocaleString()} / {sim.cap.toLocaleString()}</span></div>
                            <div className="w-full h-1 bg-white/5 overflow-hidden"><div className={`h-full ${sim.load > 90 ? 'bg-aero-warn' : 'bg-aero-yellow'}`} style={{ width: `${Math.min(100, sim.load)}%` }}></div></div>
                            <div className="flex justify-between"><span className="uppercase tracking-widest">SAT Impact:</span><span className={sim.sat < 0 ? 'text-aero-yellow/60 font-bold' : 'text-aero-yellow'}>{sim.sat === 0 ? '0.0' : `${sim.sat > 0 ? '+' : ''}${sim.sat.toFixed(1)}`}</span></div>
                          </div>
                        );
                      })()}
                  </div>
                </div>
              )}
            </div>

            {/* Aircraft */}
            <div className="w-full lg:w-1/3 border-y border-white/10 flex flex-col h-full bg-black/60 relative z-10 px-2 lg:px-3">
              <div className="py-2.5 px-3 bg-aero-yellow/10 border-b border-aero-yellow/20 text-center uppercase tracking-[0.2em] font-black text-aero-yellow text-xs">Aircraft Selection</div>
              
              {!selectedAircraft ? (
                <div className="p-2.5 flex flex-col flex-1 overflow-hidden">
                  <button 
                    onClick={() => onOpenCatalog?.(step)}
                    className="w-full h-10 mb-4 bg-white/5 border border-white/20 text-white/50 hover:text-white hover:bg-white/10 hover:border-aero-yellow transition-all uppercase text-2xs font-black tracking-widest flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> Buy Aircraft
                  </button>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search Registration or Type..." 
                      className="w-full bg-white/5 border border-white/10 p-2 pl-9 outline-none text-xs font-mono focus:border-aero-yellow"
                      value={aircraftSearch}
                      onChange={e => setAircraftSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2 pb-32">
                     {/* Without this, a player who opens the planner before buying
                         anything -- which both entry points allow -- sees an empty
                         black column and no reason for it. The filter also hides
                         aircraft based at another hub and aircraft too large for
                         either airport, which looked identical to owning none. */}
                     {validAircraft.length === 0 && (
                       <div className="border border-white/10 bg-white/[0.02] p-4 text-2xs font-mono text-white/50 leading-relaxed space-y-2">
                         {fleet.length === 0 ? (
                           <>
                             <p className="text-aero-yellow font-bold uppercase tracking-widest text-2xs">No aircraft yet</p>
                             <p>Your fleet is empty. Visit Buy Aircraft in the sidebar and purchase one first — a route needs an aircraft assigned to it.</p>
                           </>
                         ) : (
                           <>
                             <p className="text-aero-yellow font-bold uppercase tracking-widest text-2xs">None of your aircraft fit</p>
                             <p>You own {fleet.length} aircraft, but none can serve this pairing. Usually one of:</p>
                             <ul className="list-disc pl-4 space-y-1 text-white/40">
                               <li>it is based at a different hub</li>
                               <li>its ICAO code is larger than {selectedOrigin?.id || 'the origin'}
                                   {selectedDest ? ` or ${selectedDest.id}` : ''} can handle</li>
                               <li>its week is already fully committed to other routes</li>
                               {aircraftSearch ? <li>the search above is filtering it out</li> : null}
                             </ul>
                           </>
                         )}
                       </div>
                     )}
                     {validAircraft.map(ac => {
                       let usedMins = 0;
                       routes.filter(r => r.aircraft === ac.registration && r.id !== initialRouteId).forEach(r => {
                          if (r.schedule) {
                             r.schedule.forEach(s => {
                                const cycleMin = s.isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30);
                                usedMins += cycleMin;
                             });
                          }
                       });
                       const utilPercent = Math.round((usedMins / 10080) * 100);

                       return (
                         <div 
                           key={ac.registration}
                           onClick={() => setSelectedReg(ac.registration)}
                           className="p-3 border border-white/10 bg-black/40 hover:bg-aero-yellow/20 hover:border-aero-yellow/50 cursor-pointer flex gap-4"
                         >
                           <div className="w-16 h-16 bg-black/50 border border-white/10 flex items-center justify-center shrink-0">
                              <Plane size={24} className="text-white/20" />
                           </div>
                           <div className="flex-1 flex flex-col justify-center">
                             <div className="flex justify-between items-center mb-1">
                               <div className="font-black text-sm flex gap-2 items-center">
                                 {ac.registration}
                                 {ac.hubId && (
                                   <span className="text-4xs bg-white/10 px-1 border border-white/20 uppercase tracking-widest">{ac.hubId} HUB</span>
                                 )}
                               </div>
                               <div className="text-2xs bg-white/10 px-1 py-0.5">{ac.class}</div>
                             </div>
                             <div className="text-2xs flex justify-between text-white/50 font-mono">
                               <span>{ac.type} • {ac.maxRange.toLocaleString()} km</span>
                               <span>{ac.capacity} pax</span>
                             </div>
                             <div className="mt-2 w-full bg-black h-1 rounded-sm overflow-hidden relative">
                                <div className={`h-full ${utilPercent > 80 ? 'bg-aero-warn' : 'bg-aero-yellow'}`} style={{ width: `${Math.min(100, utilPercent)}%` }}></div>
                             </div>
                             <div className="text-4xs text-white/40 mt-0.5 uppercase text-right tracking-widest leading-none">{utilPercent}% utilized</div>
                           </div>
                         </div>
                       );
                     })}
                  </div>
                </div>
              ) : (
                  <div className="flex flex-col flex-1 overflow-hidden min-h-0 bg-black/40">
                    <div className="flex justify-between items-center bg-aero-yellow/10 p-2 border-b border-aero-yellow/20 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-black/50 border border-white/10 flex items-center justify-center shrink-0">
                           <Plane size={14} className="text-white/20" />
                        </div>
                        <div className="flex flex-col">
                           <div className="text-base font-black text-white leading-tight">{selectedAircraft.registration}</div>
                           <div className="flex gap-2 text-4xs uppercase tracking-widest font-mono text-white/40">
                             <span className="text-aero-yellow">{selectedAircraft.type}</span>
                             <span>{(weeklyUtilization).toFixed(0)}% USE</span>
                             <span className={getPlaneSat(selectedAircraft) < 50 ? 'text-aero-yellow/60' : 'text-aero-yellow'}>{getPlaneSat(selectedAircraft)}% SAT</span>
                           </div>
                        </div>
                      </div>
                      <button onClick={() => setSelectedReg(null)} className="text-4xs text-aero-yellow py-1.5 px-2 border border-aero-yellow/20 hover:bg-aero-yellow hover:text-black">CHG</button>
                    </div>
                    
                    <div className="p-4 space-y-4 font-mono text-2xs flex-1 overflow-y-auto custom-scrollbar pb-32">
                       {/* Config */}
                       <div className="grid grid-cols-4 gap-2 text-center text-3xs">
                          <div className="bg-white/5 py-2 border border-white/10 rounded-sm"><div className="text-4xs text-white/30 uppercase mb-1">ECO</div><div className="font-bold">{selectedAircraft.config?.economy || 0}</div></div>
                          <div className="bg-white/5 py-2 border border-white/10 rounded-sm"><div className="text-4xs text-aero-yellow/50 uppercase mb-1">PRE</div><div className="font-bold text-aero-yellow">{selectedAircraft.config?.premium || 0}</div></div>
                          <div className="bg-white/5 py-2 border border-white/10 rounded-sm"><div className="text-4xs text-white/80/50 uppercase mb-1">BUS</div><div className="font-bold text-white/80">{selectedAircraft.config?.business || 0}</div></div>
                          <div className="bg-white/5 py-2 border border-white/10 rounded-sm"><div className="text-4xs text-aero-yellow/50 uppercase mb-1">FST</div><div className="font-bold text-aero-yellow">{selectedAircraft.config?.first || 0}</div></div>
                       </div>
                       {/* Stats */}
                       <div className="grid grid-cols-2 gap-2 text-3xs">
                          <div className="bg-black/30 p-2 border border-white/5 rounded-sm flex justify-between items-center"><span className="text-white/40 uppercase tracking-widest">Efficiency</span><span className="font-bold">{selectedAircraft.efficiency}/100</span></div>
                          <div className="bg-black/30 p-2 border border-white/5 rounded-sm flex justify-between items-center"><span className="text-white/40 uppercase tracking-widest">Max Range</span><span className="font-bold">{selectedAircraft.maxRange.toLocaleString()} km</span></div>
                          <div className="bg-black/30 p-2 border border-white/5 rounded-sm flex justify-between items-center"><span className="text-white/40 uppercase tracking-widest">Gen. Cond</span><span className={`font-bold ${selectedAircraft.conditionGeneral < 50 ? 'text-aero-yellow/60' : 'text-aero-yellow'}`}>{Math.floor(selectedAircraft.conditionGeneral)}%</span></div>
                          <div className="bg-black/30 p-2 border border-white/5 rounded-sm flex justify-between items-center"><span className="text-white/40 uppercase tracking-widest">Int. Cond</span><span className={`font-bold ${selectedAircraft.conditionInterior < 50 ? 'text-aero-yellow/60' : 'text-aero-yellow'}`}>{Math.floor(selectedAircraft.conditionInterior)}%</span></div>
                       </div>
                    </div>
                  </div>
              )}
            </div>

            {/* Destination */}
            <div className="w-full lg:w-1/3 border border-white/10 flex flex-col h-full bg-black/40 relative">
              <div className="py-2.5 px-3 bg-white/5 border-b border-white/10 text-center uppercase tracking-widest font-bold text-xs">Destination</div>
              
              {!selectedDest ? (
                <div className="p-2.5 flex flex-col flex-1 overflow-hidden">
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search Destination..." 
                      className="w-full bg-white/5 border border-white/10 p-2 pl-9 outline-none text-xs font-mono focus:border-aero-yellow"
                      value={destSearch}
                      onChange={e => setDestSearch(e.target.value)}
                    />
                  </div>

                  {/* Sorting Buttons */}
                  <div className="flex gap-1 mb-4">
                    {[
                      { id: 'combined', label: 'T+B' },
                      { id: 'tourism', label: 'Tour' },
                      { id: 'business', label: 'Bus' },
                      { id: 'distance', label: 'Dist' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setDestSortBy(opt.id as any)}
                        className={`flex-1 py-1 text-4xs font-black uppercase tracking-widest border transition-all ${
                          destSortBy === opt.id 
                            ? 'bg-aero-yellow border-aero-yellow text-black' 
                            : 'bg-white/5 border-white/10 text-white/40 hover:border-white/30 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-1 bg-black/20 p-2 border border-white/5 pb-32">
                    {validDestinations.map(a => {
                      const mgtLvl = airportManagement[a.id]?.level || 0;
                      const totalSlots = a.level * 300;
                      const infra = airportManagement[a.id];
                      const rentedSlots = infra ? (infra.slots.regional + infra.slots.narrowbody + infra.slots.widebody) : 0;
                      const aiSlotsUsed = getAiUsedWeeklySlots(a.id);
                      const availableDestSlots = Math.max(0, totalSlots - rentedSlots - aiSlotsUsed);
                      
                      // Route Hints
                      const myRoutesCount = routes.filter(r => r.airline === airlineCode && (r.origin === a.id || r.destination === a.id)).length;
                      const compRoutesCount = routes.filter(r => r.airline !== airlineCode && (r.origin === a.id || r.destination === a.id)).length;

                      return (
                        <div 
                          key={a.id} 
                          onClick={() => setDestId(a.id)}
                          className="p-3 border border-white/10 bg-white/5 hover:bg-aero-yellow/10 hover:border-aero-yellow/50 cursor-pointer flex justify-between items-center group"
                        >
                          <div>
                            <div className="font-bold flex items-center gap-1">
                              {a.id} 
                              {mgtLvl >= 1 && <span className="text-4xs bg-aero-yellow/20 text-aero-yellow px-1 rounded-sm">UNLOCKED</span>}
                            </div>
                            <div className="text-2xs text-white/50">{a.name}</div>
                            
                            {/* Simple Hints */}
                            <div className="flex gap-2 mt-1">
                              {myRoutesCount > 0 && (
                                <div className="text-4xs font-black text-aero-yellow/80 uppercase">
                                  YOU: {myRoutesCount}
                                </div>
                              )}
                              {compRoutesCount > 0 && (
                                <div className="text-4xs font-black text-aero-yellow/60/80 uppercase">
                                  COMP: {compRoutesCount}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 text-right">
                             {selectedOrigin && (
                               <div className="text-2xs font-mono text-white/30">
                                  {Math.round(calculateDistance(selectedOrigin.coords[0], selectedOrigin.coords[1], a.coords[0], a.coords[1]))} km
                               </div>
                             )}
                             <div className="text-3xs font-mono text-white/30">
                                SLOTS: {availableDestSlots}/{totalSlots}
                             </div>
                             <div className="flex gap-2 text-4xs font-mono">
                               <span className="text-aero-yellow">T: {getAirportStats(a, currentYear).tourism}</span>
                               <span className="text-white/80">B: {getAirportStats(a, currentYear).business}</span>
                             </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex justify-between items-center bg-white/5 p-2 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="text-xl font-black text-aero-yellow">{selectedDest.id}</div>
                      <div className="flex flex-col">
                         <div className="text-2xs text-white/60 truncate w-32 md:w-auto">{selectedDest.name}</div>
                         <div className="flex gap-2 text-4xs uppercase tracking-widest font-mono text-white/40">
                           <span>B:{getAirportStats(selectedDest, currentYear).business}</span>
                           <span>T:{getAirportStats(selectedDest, currentYear).tourism}</span>
                           <span className={((airportManagement[selectedDest.id]?.slots?.regional || 0) + (airportManagement[selectedDest.id]?.slots?.narrowbody || 0) + (airportManagement[selectedDest.id]?.slots?.widebody || 0)) > 0 ? "text-aero-yellow font-bold" : ""}>S:{Math.max(0, (selectedDest.level * 300) - getAiUsedWeeklySlots(selectedDest.id)) - ((airportManagement[selectedDest.id]?.slots?.regional || 0) + (airportManagement[selectedDest.id]?.slots?.narrowbody || 0) + (airportManagement[selectedDest.id]?.slots?.widebody || 0))}/{selectedDest.level * 300}</span>
                         </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                       <button onClick={() => onGoToAirport(selectedDest)} className="text-4xs text-white/50 hover:text-white py-1.5 px-2 border border-white/10" title="Go to Airport"><MapIcon size={10} /></button>
                       <button onClick={() => setDestId(null)} className="text-4xs text-aero-yellow py-1.5 px-2 border border-aero-yellow/20 hover:bg-aero-yellow hover:text-black">CHG</button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-black/40 p-2.5 flex flex-col gap-4 pb-32">
                  {selectedOrigin && selectedDest && (
                    <div className="mb-2 p-3 border border-aero-yellow/20 bg-aero-yellow/5 rounded-sm">
                      <div 
                        className={`flex justify-between items-center ${debugMode ? 'cursor-pointer' : ''}`}
                        onClick={() => debugMode && setShowDemandDebug(!showDemandDebug)}
                      >
                        <div className="text-aero-yellow/80 text-3xs font-black uppercase tracking-widest flex items-center gap-1.5">
                          <Search size={12} /> Demand Forecast {debugMode && <span className="text-4xs bg-aero-yellow/20 px-1 py-0.5 rounded-sm text-aero-yellow ml-1">DEBUG</span>}
                        </div>
                        <div className="text-white font-mono text-xs font-bold">
                          {(() => {
                             const dist = Math.round(calculateDistance(selectedOrigin.coords[0], selectedOrigin.coords[1], selectedDest.coords[0], selectedDest.coords[1]));
                             const tc = getFlightTimeClass(dist / 850 * 60); // approximate duration
                             const d = calculateDemand(
                               getAirportStats(selectedOrigin, currentYear).business, getAirportStats(selectedOrigin, currentYear).tourism,
                               getAirportStats(selectedDest, currentYear).business, getAirportStats(selectedDest, currentYear).tourism,
                               tc,
                               currentMonth,
                               difficulty, currentYear
                             );
                             const basePrices = calculateBasePrices(dist, tc);
                             return d.total.toLocaleString() + ' MAX DEMAND';
                          })()}
                        </div>
                      </div>
                      
                      {showDemandDebug && debugMode && (
                        <div className="mt-4 pt-4 border-t border-white/10 space-y-2 text-2xs font-mono text-white/50 bg-black/60 p-4 rounded-sm">
                          {(() => {
                             const dist = Math.round(calculateDistance(selectedOrigin.coords[0], selectedOrigin.coords[1], selectedDest.coords[0], selectedDest.coords[1]));
                             const tc = getFlightTimeClass(dist / 850 * 60);
                             const d = calculateDemand(
                               getAirportStats(selectedOrigin, currentYear).business, getAirportStats(selectedOrigin, currentYear).tourism,
                               getAirportStats(selectedDest, currentYear).business, getAirportStats(selectedDest, currentYear).tourism,
                               tc,
                               currentMonth,
                               difficulty, currentYear
                             );
                             const basePrices = calculateBasePrices(dist, tc);
                             return (
                               <>
                                 <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
                                   <div><span className="text-white/30">b1 (Orig Bus):</span> <span className="text-white/80">{d.formulaVars.b1}</span></div>
                                   <div><span className="text-white/30">t1 (Orig Tou):</span> <span className="text-aero-yellow">{d.formulaVars.t1}</span></div>
                                   <div><span className="text-white/30">b2 (Dest Bus):</span> <span className="text-white/80">{d.formulaVars.b2}</span></div>
                                   <div><span className="text-white/30">t2 (Dest Tou):</span> <span className="text-aero-yellow">{d.formulaVars.t2}</span></div>
                                   <div><span className="text-white/30">Time Class:</span> <span className="text-white">{tc}</span></div>
                                   <div><span className="text-white/30">Business Ratio:</span> <span className="text-white">{(d.formulaVars.businessRatio * 100).toFixed(1)}%</span></div>
                                   <div><span className="text-white/30">Mv (Month {currentMonth}):</span> <span className="text-aero-yellow">{d.formulaVars.Mv}</span></div>
                                   <div><span className="text-white/30">S (Diff {difficulty}):</span> <span className="text-aero-yellow">{d.formulaVars.S}</span></div>
                                 </div>
                                 <div className="text-white/40 mb-2 pb-2 border-b border-white/5">
                                   Formula: 34.14 * (({d.formulaVars.b1}*{d.formulaVars.b2} + ({d.formulaVars.b1}*{d.formulaVars.t2} + {d.formulaVars.b2}*{d.formulaVars.t1})*{d.formulaVars.Mv}/2)^0.448) * {d.formulaVars.S} * 1
                                   <br />
                                   Interaction: {d.formulaVars.totalInteraction.toLocaleString()}
                                 </div>
                                 <div className="flex justify-between items-center text-aero-yellow">
                                   <span>ECONOMY:</span> <span>{d.economy.toLocaleString()} | BASE: ${basePrices.economy}</span>
                                 </div>
                                 <div className="flex justify-between items-center text-aero-yellow">
                                   <span>PREMIUM:</span> <span>{d.premium.toLocaleString()} | BASE: ${basePrices.premium}</span>
                                 </div>
                                 <div className="flex justify-between items-center text-white/80">
                                   <span>BUSINESS:</span> <span>{d.business.toLocaleString()} | BASE: ${basePrices.business}</span>
                                 </div>
                                 <div className="flex justify-between items-center text-purple-400 font-bold border-b border-white/10 pb-1 mb-1">
                                   <span>FIRST:</span> <span>{d.first.toLocaleString()} | BASE: ${basePrices.first}</span>
                                 </div>
                                 <div className="flex justify-between items-center text-white font-black text-sm pt-1">
                                   <span>MAX DEMAND:</span> <span>{d.total.toLocaleString()}</span>
                                 </div>
                               </>
                             );
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  {destMgtLvl < 1 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 border border-white/10 bg-aero-panel text-center">
                       <div className="text-aero-yellow/60 font-bold mb-2 uppercase tracking-widest">Destination Locked</div>
                       <p className="text-xs text-white/50 mb-3">You must unlock T1 Management at {selectedDest.id} to fly there.</p>
                       <button 
                         onClick={() => onUnlockManagement(selectedDest.id, 1)}
                         className="px-3 py-3 bg-aero-panel-2 text-white font-black uppercase text-sm hover:bg-aero-panel-2 transition-colors"
                       >
                         Unlock T1 ($100,000)
                       </button>
                    </div>
                  ) : (
                    /* Strategic Infrastructure Dashboard */
                    <div className="flex flex-col gap-4 mt-2 pb-16">
                       <div className="flex justify-between items-center border-b border-white/10 pb-2">
                          <div className="text-aero-yellow text-2xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                             <MapIcon size={12} /> Strategic Slots
                          </div>
                          <span className="text-4xs text-white/30 tracking-widest font-mono">STOCK / COST / ACTION</span>
                       </div>
                       <div className="space-y-2">
                          <InfaRowSmall label="Regional" count={(airportManagement || {})[selectedDest.id]?.slots?.regional || 0} used={getUsedWeeklySlots(selectedDest.id, 'regional')} cost={getSlotPurchaseCost('regional')} costSuffix=" one-off" onBuy={(n, shift) => handleUpdateInfra(selectedDest.id, 'slots', 'regional', n, shift)} />
                          <InfaRowSmall label="Narrowb." count={(airportManagement || {})[selectedDest.id]?.slots?.narrowbody || 0} used={getUsedWeeklySlots(selectedDest.id, 'narrowbody')} cost={getSlotPurchaseCost('narrowbody')} costSuffix=" one-off" onBuy={(n, shift) => handleUpdateInfra(selectedDest.id, 'slots', 'narrowbody', n, shift)} />
                          <InfaRowSmall label="Widebody" count={(airportManagement || {})[selectedDest.id]?.slots?.widebody || 0} used={getUsedWeeklySlots(selectedDest.id, 'widebody')} cost={getSlotPurchaseCost('widebody')} costSuffix=" one-off" onBuy={(n, shift) => handleUpdateInfra(selectedDest.id, 'slots', 'widebody', n, shift)} />
                       </div>

                       <div className="flex justify-between items-center border-b border-white/10 pb-2 mt-2">
                          <div className="text-aero-yellow text-2xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                             <Plane size={12} /> Stand Upgrades
                          </div>
                          {(airportManagement[selectedDest.id]?.level || 0) < 2 && (
                            <button 
                               onClick={() => onUpdateInfrastructure(selectedDest.id, { ...airportManagement[selectedDest.id], autoBuyStands: !(airportManagement[selectedDest.id]?.autoBuyStands) })}
                               className={`text-4xs uppercase tracking-widest px-2 py-0.5 border ${airportManagement[selectedDest.id]?.autoBuyStands ? 'border-aero-yellow text-aero-yellow bg-aero-yellow/10' : 'border-white/20 text-white/40'}`}
                            >
                               AUTO-BUY: {airportManagement[selectedDest.id]?.autoBuyStands ? 'ON' : 'OFF'}
                            </button>
                          )}
                       </div>
                       <div className="space-y-2">
                          <InfaRowSmall label="Narrowb." count={airportManagement[selectedDest.id]?.stands?.narrowbody || 0} cost={(airportManagement[selectedDest.id]?.level || 0) >= 2 ? 0 : getStandCost('narrowbody')} disabled={(airportManagement[selectedDest.id]?.level || 0) >= 2} onBuy={(n, shift) => handleUpdateInfra(selectedDest.id, 'stands', 'narrowbody', n, shift)} />
                          <InfaRowSmall label="Widebody" count={airportManagement[selectedDest.id]?.stands?.widebody || 0} cost={(airportManagement[selectedDest.id]?.level || 0) >= 2 ? 0 : getStandCost('widebody')} disabled={(airportManagement[selectedDest.id]?.level || 0) >= 2} onBuy={(n, shift) => handleUpdateInfra(selectedDest.id, 'stands', 'widebody', n, shift)} />
                       </div>

                       <div className="flex justify-between items-center border-b border-white/10 pb-2 mt-2">
                          <div className="text-aero-yellow text-2xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                             <ChevronRight size={12} /> Passenger Processing
                          </div>
                       </div>
                       <div className="space-y-2">
                          <InfaRowSmall label="Normal Desk" count={airportManagement[selectedDest.id]?.desks?.normal || 0} disableRemove={(airportManagement[selectedDest.id]?.level || 0) >= 1 && (airportManagement[selectedDest.id]?.desks?.normal || 0) <= 1} cost={getDeskCost((airportManagement[selectedDest.id]?.level || 0) >= 2, 'normal')} onBuy={(n, shift) => handleUpdateInfra(selectedDest.id, 'desks', 'normal', n, shift)} />
                          <InfaRowSmall label="Self-Check" count={airportManagement[selectedDest.id]?.desks?.self || 0} cost={getDeskCost((airportManagement[selectedDest.id]?.level || 0) >= 2, 'self')} onBuy={(n, shift) => handleUpdateInfra(selectedDest.id, 'desks', 'self', n, shift)} />
                       </div>
                       {(() => {
                           const sim = destDeskSim;
                           return (
                             <div className="mt-2 text-2xs text-white/50 space-y-1">
                               <div className="flex justify-between"><span className="uppercase tracking-widest flex items-center">Desk Load:<InfoTooltip size={11} {...GLOSSARY.deskLoad} /></span><span className={sim.load > 90 ? 'text-aero-warn font-bold' : 'text-white'}>{sim.load.toFixed(1)}%</span></div>
                               <div className="flex justify-between"><span className="uppercase tracking-widest">Weekly Pax:</span><span className="text-white">{sim.myPax.toLocaleString()} / {sim.cap.toLocaleString()}</span></div>
                               <div className="w-full h-1 bg-white/5 overflow-hidden"><div className={`h-full ${sim.load > 90 ? 'bg-aero-warn' : 'bg-aero-yellow'}`} style={{ width: `${Math.min(100, sim.load)}%` }}></div></div>
                               <div className="flex justify-between"><span className="uppercase tracking-widest">SAT Impact:</span><span className={sim.sat < 0 ? 'text-aero-yellow/60 font-bold' : 'text-aero-yellow'}>{sim.sat === 0 ? '0.0' : `${sim.sat > 0 ? '+' : ''}${sim.sat.toFixed(1)}`}</span></div>
                             </div>
                           );
                       })()}
                    </div>
                  )}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Step 1 Snug Footer Action Bar */}
          <div className="p-4 mt-3 border border-white/10 bg-white/[0.01] flex shrink-0 rounded-sm w-full">
             <div className="flex gap-4 w-full">
                <button onClick={onClose} className="flex-1 py-4 border border-white/20 text-white/60 font-black uppercase text-sm tracking-widest py-4 px-6 rounded-sm hover:text-white hover:bg-white/10 transition-all">Cancel</button>
                <button 
                  disabled={!selectedOrigin || !selectedAircraft || !selectedDest || (destMgtLvl < 1)}
                  onClick={() => setStep(2)} 
                  className="flex-[2] py-4 bg-aero-yellow text-black font-black uppercase text-sm tracking-widest hover:bg-white hover:shadow-2xl hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans flex items-center justify-center gap-2"
                >
                  Next Step: Timetable <ChevronRight size={16} />
                </button>
             </div>
          </div>
        </div>
      )}

        {step === 2 && selectedOrigin && selectedDest && selectedAircraft && (
          <div className="w-full flex gap-4 h-full">
            {/* Left Column: Form */}
            <div className="w-1/3 border border-white/10 bg-black/40 flex flex-col overflow-y-auto">
              <div className="p-4 bg-aero-yellow/10 border-b border-aero-yellow/20 text-center uppercase tracking-[0.2em] font-black text-aero-yellow text-sm">Timetable Configuration</div>
              
              <div className="p-4 space-y-8">
                {/* Slot Status */}
                <div className="bg-white/5 border border-white/10 p-4 space-y-2 mb-2 rounded-sm border-t-2 border-t-aero-yellow">
                   <div className="text-2xs uppercase font-black tracking-widest text-aero-yellow mb-2 flex justify-between">
                     <span>Required Slots</span>
                     <span>({selectedAircraft.class})</span>
                   </div>
                   <div className="flex justify-between font-mono text-xs text-white/70">
                     <span>{selectedOrigin.id}</span>
                     <span className={getUsedWeeklySlots(selectedOrigin.id, selectedAircraft.class) + schedule.length > (airportManagement[selectedOrigin.id]?.slots?.[selectedAircraft.class.toLowerCase() as any] || 0) ? 'text-aero-yellow/60' : 'text-aero-yellow font-bold'}>
                        {getUsedWeeklySlots(selectedOrigin.id, selectedAircraft.class) + schedule.length} / {airportManagement[selectedOrigin.id]?.slots?.[selectedAircraft.class.toLowerCase() as any] || 0}
                     </span>
                   </div>
                   <div className="flex justify-between font-mono text-xs text-white/70">
                     <span>{selectedDest.id}</span>
                     <span className={getUsedWeeklySlots(selectedDest.id, selectedAircraft.class) + schedule.length > (airportManagement[selectedDest.id]?.slots?.[selectedAircraft.class.toLowerCase() as any] || 0) ? 'text-aero-yellow/60' : 'text-aero-yellow font-bold'}>
                        {getUsedWeeklySlots(selectedDest.id, selectedAircraft.class) + schedule.length} / {airportManagement[selectedDest.id]?.slots?.[selectedAircraft.class.toLowerCase() as any] || 0}
                     </span>
                   </div>
                </div>

                {/* Flight Number */}
                <div className="flex gap-4">
                  <div className="flex flex-col flex-[0.8] min-w-0">
                    <label className="block text-2xs uppercase tracking-widest text-white/50 mb-2 font-bold">
                       Code
                    </label>
                    <div className="h-10 bg-white/5 border border-white/10 font-black text-aero-yellow text-center select-none uppercase tracking-widest flex items-center justify-center truncate px-1">{airlineCode}</div>
                  </div>
                  <div className="flex flex-col flex-1">
                    <label className="block text-2xs uppercase tracking-widest text-white/50 mb-2 font-bold">Flight Out</label>
                    <input 
                      type="text" 
                      value={flightNumberOutbound}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setFlightNumberOutbound(val);
                        setFlightNumberInbound((parseInt(val) + 1).toString() || "");
                      }}
                      className="h-10 w-full bg-white/5 border border-white/10 px-2 outline-none focus:border-aero-yellow font-mono text-sm text-center"
                      placeholder="Out"
                    />
                  </div>
                  <div className="flex flex-col flex-1">
                    <label className="block text-2xs uppercase tracking-widest text-white/50 mb-2 font-bold">Flight In</label>
                    <input 
                      type="text" 
                      value={flightNumberInbound}
                      onChange={e => setFlightNumberInbound(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="h-10 w-full bg-white/5 border border-white/10 px-2 outline-none focus:border-aero-yellow font-mono text-sm text-center"
                      placeholder="In"
                    />
                  </div>
                  <div className="flex flex-col flex-[0.8]">
                    <label className="block text-2xs uppercase tracking-widest text-transparent mb-2 font-bold select-none">Action</label>
                    <button 
                      onClick={generateFlightNumber}
                      className="h-10 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors uppercase tracking-widest text-3xs font-black italic text-center text-white/50 hover:text-white leading-tight flex items-center justify-center"
                    >
                      RANDOM
                    </button>
                  </div>
                </div>

                <div>
                  {/* Inline settings */}
                  <div className={`flex items-center justify-between bg-black/40 border border-white/10 p-2 mb-2 transition-opacity ${schedule.length > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center gap-2">
                       <label className="text-3xs font-black uppercase tracking-widest text-white/50">Multiple Ops:</label>
                       <div className="flex items-center gap-1">
                         <button 
                           onClick={() => setMultipleOps(Math.max(1, multipleOps - 1))} 
                           className="w-5 h-5 flex items-center justify-center bg-white/5 border border-white/10 text-white hover:border-aero-yellow"
                         >
                           <Minus className="w-2 h-2" />
                         </button>
                         <div className="w-6 h-5 flex items-center justify-center bg-black border border-white/20 font-mono text-2xs text-aero-yellow font-bold">
                           {Math.min(multipleOps, maxMultipleOps)}
                         </div>
                         <button
                           onClick={() => setMultipleOps(Math.min(maxMultipleOps, multipleOps + 1))}
                           disabled={multipleOps >= maxMultipleOps}
                           className="w-5 h-5 flex items-center justify-center bg-white/5 border border-white/10 text-white hover:border-aero-yellow disabled:opacity-20"
                         >
                           <Plus className="w-2 h-2" />
                         </button>
                       </div>
                    </div>
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setMaximizeFlights(!maximizeFlights)}>
                       <span className="text-3xs font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors">Max Flights</span>
                       <div className={`w-4 h-4 border flex items-center justify-center transition-all ${maximizeFlights ? 'bg-aero-yellow border-aero-yellow text-black' : 'border-white/20'}`}>
                         {maximizeFlights && <Check className="w-2 h-2" />}
                       </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        if (schedule.length > 0) {
                          setSchedule([]);
                        } else {
                          if (!selectedOrigin || !selectedDest || !selectedAircraft) return;
                          const aircraftClass = selectedAircraft.class;
                          const slotKey = aircraftClass.toLowerCase() as 'regional' | 'narrowbody' | 'widebody';
                          
                          const originCap = airportManagement[selectedOrigin.id]?.slots?.[slotKey] || 0;
                          const destCap = airportManagement[selectedDest.id]?.slots?.[slotKey] || 0;
                          
                          const currentOriginUsed = getUsedWeeklySlots(selectedOrigin.id, aircraftClass);
                          const currentDestUsed = getUsedWeeklySlots(selectedDest.id, aircraftClass);
                          
                          let remainingSlots = Math.min(originCap - currentOriginUsed, destCap - currentDestUsed);

                          const durMin = getFlightDurationMinutes();
                          const turnMin = getTurnoverMinutes();
                          const totalDurRaw = (30 + durMin + turnMin + durMin + 30);
                          const cycleMin = Math.ceil(totalDurRaw / 5) * 5;
                          
                          const newTrips: ScheduledTrip[] = [];

                          const existingAircraftRoutes = routes.filter(r => r.aircraft === selectedAircraft.registration && r.id !== initialRouteId);
                          const occupied = existingAircraftRoutes.flatMap(r => r.schedule?.map(s => {
                            const c = Math.ceil(((s as any).isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30)) / 5) * 5;
                            const start = ((s.dayId - 1) * 24 * 60) + (s.startHour * 60 + s.startMin);
                            return { start, end: start + c };
                          }) || []).sort((a, b) => a.start - b.start);

                          if (maximizeFlights) {
                            const maxWeekMins = 10080;
                            let bestCount = -1;
                            let bestStartTimes: number[] = [];

                            if (occupied.length === 0) {
                               // When aircraft is empty, any Monday start is equally optimal for maximize.
                               const randomMondayStart = Math.floor(Math.random() * (1440 / 5)) * 5;
                               let searchTime = randomMondayStart;
                               let i = 0;
                               let added = 0;
                               while (added < remainingSlots && i < 2100) {
                                  i++;
                                  added++;
                                  searchTime += cycleMin;
                                  if (searchTime >= randomMondayStart + maxWeekMins) break;
                               }
                               bestCount = added;
                               bestStartTimes = [randomMondayStart];
                            } else {
                              for (let testStart = 0; testStart < maxWeekMins; testStart += 5) {
                                let searchTime = testStart;
                                let added = 0;
                                let i = 0;
                                const localOccupied = [...occupied];

                                while (added < remainingSlots && i < 2100) {
                                  i++;
                                  const candidateStart = searchTime % maxWeekMins;
                                  const candidateEnd = candidateStart + cycleMin;
                                  
                                  let conflict = false;
                                  for (const occ of localOccupied) {
                                    if (checkOverlap(candidateStart, candidateEnd, occ.start, occ.end)) {
                                      conflict = true; break;
                                    }
                                  }
                                  
                                  if (!conflict) {
                                    localOccupied.push({ start: candidateStart, end: candidateEnd });
                                    added++;
                                    searchTime += cycleMin;
                                  } else {
                                    searchTime += 5;
                                  }

                                  if (searchTime >= testStart + maxWeekMins) break;
                                }

                                if (added > bestCount) {
                                  bestCount = added;
                                  bestStartTimes = [testStart];
                                } else if (added === bestCount) {
                                  bestStartTimes.push(testStart);
                                }
                              }
                            }

                            let chosenStart = bestStartTimes[0];
                            if (occupied.length > 0 && bestStartTimes.length > 1) {
                               const firstTripEnd = occupied[0].end;
                               let minDiff = Infinity;
                               for (const st of bestStartTimes) {
                                  let diff = (st - firstTripEnd + 10080) % 10080;
                                  if (diff < minDiff) {
                                     minDiff = diff;
                                     chosenStart = st;
                                  }
                               }
                            } else if (bestStartTimes.length > 0) {
                               chosenStart = bestStartTimes[Math.floor(Math.random() * bestStartTimes.length)];
                            }

                            if (bestCount > 0 && bestStartTimes.length > 0) {
                              const startH = Math.floor((chosenStart % 1440) / 60);
                              const startM = chosenStart % 60;
                              
                              setFlightHour(startH);
                              setFlightMinute(startM);

                              let searchTime = chosenStart;
                              let added = 0;
                              let i = 0;
                              const timeToFlightNum = new globalThis.Map<number, number>();
                              let nextNumOffset = 0;

                              while (added < bestCount && i < 2100) {
                                i++;
                                const candidateStart = searchTime % maxWeekMins;
                                const candidateEnd = candidateStart + cycleMin;
                                
                                let conflict = false;
                                for (const occ of occupied) {
                                  if (checkOverlap(candidateStart, candidateEnd, occ.start, occ.end)) {
                                    conflict = true; break;
                                  }
                                }
                                if (!conflict) {
                                  for (const nt of newTrips) {
                                    const ntStart = ((nt.dayId - 1) * 24 * 60) + (nt.startHour * 60 + nt.startMin);
                                    const ntEnd = ntStart + cycleMin;
                                    if (checkOverlap(candidateStart, candidateEnd, ntStart, ntEnd)) {
                                      conflict = true; break;
                                    }
                                  }
                                }

                                if (!conflict) {
                                  const dayId = ((Math.floor(candidateStart / 1440)) % 7) + 1;
                                  const startInDay = candidateStart % 1440;
                                  
                                  if (!timeToFlightNum.has(startInDay)) {
                                    timeToFlightNum.set(startInDay, nextNumOffset);
                                    nextNumOffset++;
                                  }
                                  const addedOffset = timeToFlightNum.get(startInDay)!;

                                  newTrips.push({
                                    id: Math.random().toString(),
                                    groupId: "maximized",
                                    isGroupLead: added === 0,
                                    flightNumOut: (parseInt(flightNumberOutbound) + (addedOffset * 2)).toString(),
                                    flightNumIn: (parseInt(flightNumberInbound) + (addedOffset * 2)).toString(),
                                    dayId: dayId,
                                    startHour: Math.floor(startInDay / 60),
                                    startMin: startInDay % 60,
                                    durMin: durMin,
                                    turnoverMin: turnMin
                                  });
                                  added++;
                                  searchTime += cycleMin;
                                } else {
                                  searchTime += 5;
                                }

                                if (searchTime >= chosenStart + maxWeekMins) break;
                              }
                            }
                          } else {
                            // Auto optimize start time before scheduling
                            let bestStartM = (flightHour * 60 + flightMinute);
                            
                            // Let's test the current selected time first
                            let foundForSelectAll = false;
                            if (schedule.length > 0) {
                              let validDays = 0;
                              for (const d of daysOfWeek) {
                                let currentAbs = (d.id - 1) * 1440 + bestStartM;
                                let dayConflict = false;
                                for (let op = 0; op < multipleOps; op++) {
                                  const s = currentAbs + op * cycleMin;
                                  const e = s + cycleMin;
                                  for (const occ of occupied) {
                                    if (checkOverlap(s, e, occ.start, occ.end)) { dayConflict = true; break; }
                                  }
                                  if (dayConflict) break;
                                }
                                if (!dayConflict) validDays++;
                              }
                              if (validDays === daysOfWeek.length) {
                                foundForSelectAll = true;
                              }
                            }

                            if (!foundForSelectAll) {
                              let testTimes = [];
                              for (let testM = 0; testM < 1440; testM += 5) testTimes.push(testM);

                              const allEnds = [
                                ...occupied.map(occ => (occ.end % 1440)),
                                ...schedule.map(s => {
                                  const c = s.isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30);
                                  return ((s.startHour * 60 + s.startMin) + Math.ceil(c / 5) * 5) % 1440;
                                })
                              ];

                              // If the aircraft has no trips and we are starting fresh, pick a random time
                              if (allEnds.length === 0) {
                                testTimes = [testTimes[Math.floor(Math.random() * testTimes.length)]];
                              } else {
                                // Find the latest end time across all days to prioritize continuity
                                const maxEnd = Math.max(...allEnds);
                                
                                testTimes.sort((a, b) => {
                                  let diffA = (a - maxEnd + 1440) % 1440;
                                  let diffB = (b - maxEnd + 1440) % 1440;
                                  return diffA - diffB;
                                });
                              }

                              for (const testM of testTimes) {
                                let conflict = false;
                                let validDays = 0;
                                for (const d of daysOfWeek) {
                                  let currentAbs = (d.id - 1) * 1440 + testM;
                                  let dayConflict = false;
                                  for (let op = 0; op < multipleOps; op++) {
                                    const s = currentAbs + op * cycleMin;
                                    const e = s + cycleMin;
                                    for (const occ of occupied) {
                                      if (checkOverlap(s, e, occ.start, occ.end)) { dayConflict = true; break; }
                                    }
                                    if (dayConflict) break;
                                  }
                                  if (!dayConflict) validDays++;
                                }
                                if (validDays === daysOfWeek.length) {
                                  bestStartM = testM;
                                  setFlightHour(Math.floor(testM / 60));
                                  setFlightMinute(testM % 60);
                                  break;
                                }
                              }
                            }

                            const blockStartAbs = bestStartM;
                            for (const d of daysOfWeek) {
                              if (remainingSlots <= 0) break;
                              
                              let fitsAll = true;
                              let subTrips: ScheduledTrip[] = [];
                              const bGroupId = Math.random().toString();

                              for (let i = 0; i < multipleOps; i++) {
                                const currentStart = blockStartAbs + (i * cycleMin);
                                const dayOffset = Math.floor(currentStart / 1440);
                                const adjustedDayId = ((d.id + dayOffset - 1) % 7) + 1;
                                const startInDay = currentStart % 1440;

                                const newStart = ((d.id - 1) * 24 * 60) + currentStart;
                                const newEnd = newStart + cycleMin;

                                let conflict = false;
                                const existingAircraftRoutes = routes.filter(r => r.aircraft === selectedAircraft.registration && r.id !== initialRouteId);
                                for (const r of existingAircraftRoutes) {
                                  if (!r.schedule) continue;
                                  for (const s of r.schedule) {
                                    const exStart = ((s.dayId - 1) * 24 * 60) + (s.startHour * 60 + s.startMin);
                                    const exCycle = Math.ceil((s.isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30)) / 5) * 5;
                                    if (checkOverlap(newStart, newEnd, exStart, exStart + exCycle)) {
                                      conflict = true; break;
                                    }
                                  }
                                  if (conflict) break;
                                }
                                if (conflict) { fitsAll = false; break; }

                                for (const s of newTrips) {
                                  const exStart = ((s.dayId - 1) * 24 * 60) + (s.startHour * 60 + s.startMin);
                                  const exCycle = Math.ceil((30 + s.durMin + s.turnoverMin + s.durMin + 30) / 5) * 5;
                                  if (checkOverlap(newStart, newEnd, exStart, exStart + exCycle)) {
                                    conflict = true; break;
                                  }
                                }
                                if (conflict) { fitsAll = false; break; }

                                subTrips.push({
                                  id: Math.random().toString(),
                                  groupId: bGroupId,
                                  isGroupLead: i === 0,
                                  flightNumOut: (parseInt(flightNumberOutbound) + (i * 2)).toString(),
                                  flightNumIn: (parseInt(flightNumberInbound) + (i * 2)).toString(),
                                  dayId: adjustedDayId,
                                  startHour: Math.floor(startInDay / 60),
                                  startMin: startInDay % 60,
                                  durMin: durMin,
                                  turnoverMin: turnMin
                                });
                              }

                              if (fitsAll && remainingSlots >= multipleOps) {
                                newTrips.push(...subTrips);
                                remainingSlots -= multipleOps;
                              }
                            }
                          }
                          
                          if (newTrips.length === 0) setValidationMsg("No valid slots or days available.");
                          else { setSchedule(newTrips); setValidationMsg(null); }
                        }
                      }}
                      className={`flex-1 h-8 text-2xs uppercase font-bold border transition-colors px-2 py-0.5 ${schedule.length > 0 ? 'border-white/10 text-aero-yellow/60 hover:bg-aero-panel-2 hover:text-white' : 'bg-aero-yellow border-aero-yellow text-black hover:bg-aero-yellow/80'}`}
                    >
                      {schedule.length > 0 ? 'Clear All' : (maximizeFlights ? 'Apply' : 'Select All')}
                    </button>
                  </div>

                  <div className={`flex flex-wrap gap-2 mt-4 justify-center transition-opacity ${maximizeFlights ? 'opacity-30 pointer-events-none' : ''}`}>
                    {daysOfWeek.map(day => {
                      const isSelected = schedule.some(s => s.dayId === day.id);
                      return (
                        <button
                          key={day.id}
                          disabled={maximizeFlights}
                          onClick={() => handleToggleDay(day.id)}
                          className={`w-12 h-12 flex items-center justify-center border font-black text-xs transition-all ${isSelected ? 'bg-aero-yellow text-black border-aero-yellow shadow-2xl' : 'bg-black/40 text-white/30 border-white/10 hover:border-white/40 hover:text-white'}`}
                        >
                          {day.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Time Selection */}
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/50 mb-2 font-bold">Starting Time</label>
                  <div className={`flex items-center justify-center gap-4 bg-black/60 border border-white/10 p-4 font-mono shadow-2xl transition-all ${maximizeFlights ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                    <div className="flex flex-col items-center">
                      <button onClick={() => handleClockChange(60)} className="p-2 text-white/50 hover:text-aero-yellow transition-colors">▲</button>
                      <div className="text-4xl font-black">{maximizeFlights ? '--' : flightHour.toString().padStart(2, '0')}</div>
                      <button onClick={() => handleClockChange(-60)} className="p-2 text-white/50 hover:text-aero-yellow transition-colors">▼</button>
                    </div>
                    <div className="text-4xl text-white/30 pb-2">:</div>
                    <div className="flex flex-col items-center">
                      <button onClick={() => handleClockChange(5)} className="p-2 text-white/50 hover:text-aero-yellow transition-colors">▲</button>
                      <div className="text-4xl font-black">{maximizeFlights ? '--' : flightMinute.toString().padStart(2, '0')}</div>
                      <button onClick={() => handleClockChange(-5)} className="p-2 text-white/50 hover:text-aero-yellow transition-colors">▼</button>
                    </div>
                  </div>
                </div>

                {/* Flightplan Details output */}
                <div className="bg-white/5 border border-white/10 p-4 space-y-2 text-xs font-mono">
                    <div className="text-2xs uppercase tracking-widest font-black text-aero-yellow border-b border-white/10 pb-2 mb-2 font-sans">Flightplan</div>
                    
                    {(() => {
                      if (schedule.length === 0) {
                        return <div className="text-white/30 italic pb-2 text-2xs">No flights scheduled.</div>;
                      }

                      const durMin = getFlightDurationMinutes();
                      const turnMin = getTurnoverMinutes();
                      
                      const formatTime = (totalMins: number) => {
                        const d = Math.floor(Math.round(totalMins) / 1440);
                        const h = Math.floor((Math.round(totalMins) % 1440) / 60);
                        const m = (Math.round(totalMins) % 1440) % 60;
                        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}${d > 0 ? ` (+${d})` : ''}`;
                      };

                      const uniqueFlights = Object.values(schedule.reduce((acc, s) => {
                        if (!acc[s.flightNumOut]) {
                          acc[s.flightNumOut] = { ...s, days: [s.dayId] };
                        } else {
                          if (!acc[s.flightNumOut].days.includes(s.dayId)) {
                            acc[s.flightNumOut].days.push(s.dayId);
                          }
                        }
                        return acc;
                      }, {} as Record<string, any>)).sort((a: any, b: any) => {
                         const aTotal = a.startHour * 60 + a.startMin;
                         const bTotal = b.startHour * 60 + b.startMin;
                         return aTotal - bTotal;
                      });

                      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-[1fr,auto] gap-x-4 gap-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                             <span className="text-white/30 uppercase text-3xs font-black">Operation</span>
                             <span className="text-white/30 uppercase text-3xs font-black text-right">Schedule</span>
                             
                             {uniqueFlights.map((s: any) => {
                               const base = s.startHour * 60 + s.startMin;
                               const dep1 = formatTime(base + 30);
                               const arr1 = formatTime(base + 30 + s.durMin);
                               const dep2 = formatTime(base + 30 + s.durMin + turnMin);
                               const arr2 = formatTime(base + 30 + s.durMin + turnMin + durMin);
                               const daysStr = s.days.sort((a: number, b: number) => a - b).map((d: number) => dayNames[d - 1]).join(", ");
                               
                               return (
                                 <React.Fragment key={s.flightNumOut}>
                                    <div className="flex flex-col">
                                      <span className="text-aero-yellow font-bold text-2xs">{airlineCode}{s.flightNumOut}</span>
                                      <span className="text-4xs text-white/50">{selectedOrigin.id} → {selectedDest.id}</span>
                                      <span className="text-4xs text-white/30 mt-0.5">{daysStr}</span>
                                    </div>
                                    <span className="text-white font-mono text-2xs text-right">{dep1} → {arr1}</span>
                                    
                                    {!(s as any).isOneWay && (
                                      <>
                                        <div className="flex flex-col">
                                          <span className="text-aero-yellow font-bold text-2xs opacity-70">{airlineCode}{s.flightNumIn}</span>
                                          <span className="text-4xs text-white/50 opacity-70">{selectedDest.id} → {selectedOrigin.id}</span>
                                        </div>
                                        <span className="text-white font-mono text-2xs text-right opacity-70">{dep2} → {arr2}</span>
                                       </>
                                     )}
                                     <div className="col-span-2 h-[1px] bg-white/5 my-1"></div>
          </React.Fragment>
                               );
                             })}
                          </div>
                          
                          <div className="flex justify-between font-black text-white/50 font-sans text-2xs uppercase tracking-wider">
                            <span>Total Flights:</span>
                            <span className="text-white">{schedule.length} ({schedule.length * (schedule[0]?.isOneWay ? 1 : 2)} Legs)</span>
                          </div>
                        </div>
                      );
                    })()}
                </div>
              </div>
            </div>

            {/* Right Column: Timetable */}
            <div className="flex-1 border border-white/10 bg-black/60 flex flex-col overflow-hidden relative">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=1600&auto=format&fit=crop')] bg-cover opacity-[0.03] pointer-events-none"></div>
              
              {/* Header Days */}
              <div className="flex shrink-0 z-30">
                <div className="w-14 border-r border-white/10 bg-black"></div>
                <div className="flex-1 flex border-b border-white/20">
                   {daysOfWeek.map(day => (
                      <div key={day.id} className="flex-1 text-center text-2xs uppercase font-bold text-white/50 py-3 bg-black relative">
                        {day.label}
                      </div>
                   ))}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-auto flex relative custom-scrollbar bg-black/40 pt-7">
                {/* Time Indicators */}
                <div className="w-16 shrink-0 border-r border-white/30 relative bg-black/95 z-20 shadow-2xl">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="h-[30px] text-3xs text-white/40 text-right pr-2 font-mono flex items-start justify-end relative group">
                      {/* Hour mark (Full line) */}
                      <div className="w-4 h-[1px] bg-white/30 absolute right-0 top-0"></div>
                      
                      {i % 2 === 0 ? (
                        <span className="absolute font-black text-aero-yellow top-0 -translate-y-1/2 mr-[-4px] transition-all hover:scale-110 z-30 tracking-tighter">
                          {i.toString().padStart(2, '0')}:00
                        </span>
                      ) : (
                        <span className="opacity-0 group-hover:opacity-100 absolute font-bold text-white/60 top-0 -translate-y-1/2 mr-[-4px] text-4xs z-30 transition-all">
                          {i.toString().padStart(2, '0')}:00
                        </span>
                      )}
                      
                      {/* Half hour tick (Single tick) */}
                      <div className="absolute top-1/2 right-0 w-2 h-[1px] bg-white/10"></div>
                    </div>
                  ))}
                  <div className="h-0 text-2xs text-white/50 text-right pr-2 font-mono flex items-start justify-end relative">
                    <span className="absolute font-black text-aero-yellow top-0 -translate-y-1/2 mr-[-4px] z-30 tracking-tighter">
                      24:00
                    </span>
                    <div className="w-4 h-[1px] bg-white/30 absolute right-0 top-0"></div>
                  </div>
                </div>

                <div className="flex-1 flex min-w-[700px]">
                  {daysOfWeek.map(day => (
                    <div key={day.id} className="flex-1 border-r border-white/5 relative bg-gradient-to-b from-white/[0.02] to-transparent">
                       <div className="relative h-[720px] border-y border-aero-yellow/30 shadow-2xl"> {/* 24 * 30px */}
                          <div className="absolute inset-0 grid grid-rows-[repeat(24,minmax(0,1fr))] pointer-events-none opacity-20">
                            {Array.from({ length: 24 }).map((_, i) => (
                              <div key={i} className="border-b border-white/10 flex flex-col">
                                <div className="flex-1 border-b border-white/5 border-dashed"></div>
                                <div className="flex-1"></div>
                              </div>
                            ))}
                          </div>
                          
                          {allBlocks.filter(b => b.dayId === day.id).map(b => {
                              const startAbs = Math.round(b.s.startHour * 60 + b.s.startMin);
                              const totalDurRaw = ((b.s as any).isOneWay ? (30 + b.s.durMin + 30) : (30 + b.s.durMin + b.s.turnoverMin + b.s.durMin + 30));
                              const cycleMin = Math.ceil(totalDurRaw / 5) * 5;
                              const endAbs = startAbs + cycleMin;
                              
                              const formatT = (m: number) => {
                                const h = Math.floor(((Math.round(m) + 1440) % 1440) / 60);
                                const min = (Math.round(m) + 1440) % 60;
                                return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                              };

                              return (
                                <div 
                                  key={b.id} 
                                  onMouseDown={!b.isBusy ? (e) => handleDragStart(e, b.s) : undefined}
                                  className={`absolute left-0.5 right-0.5 p-1 px-1.5 text-2xs font-mono shadow-2xl backdrop-blur-md z-10 flex flex-col overflow-hidden transition-all ${
                                    b.isBusy 
                                      ? 'bg-white/10 border-l-2 border-white/30 cursor-default grayscale opacity-60' 
                                      : 'bg-aero-yellow/30 border-l-2 border-aero-yellow cursor-ns-resize hover:bg-aero-yellow/40 hover:scale-[1.01] hover:z-20'
                                  }`}
                                  style={{ top: b.top, height: b.height, zIndex: b.isBusy ? 5 : 10 }}
                                >
                                   <div className="flex flex-col h-full relative">
                                     {b.isFirst && (
                                       <div className="text-white font-black absolute top-[-2px] left-0 bg-black/80 px-1 py-0.5 rounded-sm z-20 text-3xs border border-white/10 leading-none">
                                         {formatT(startAbs)}
                                       </div>
                                     )}
                                     
                                     <div className={`font-black tracking-tight leading-none truncate ${b.isBusy ? 'text-white/70' : 'text-aero-yellow'} ${b.isFirst ? 'mt-4 mb-1 text-2xs' : 'mb-0.5 text-2xs'}`}>
                                       {b.isBusy ? (b.s.isOneWay ? `${airlineCode}${b.s.flightNumOut}` : `${airlineCode}${b.s.flightNumOut} & ${airlineCode}${b.s.flightNumIn}`) : (b.s.isOneWay ? `${airlineCode}${b.s.flightNumOut}` : `${airlineCode}${b.s.flightNumOut} & ${airlineCode}${b.s.flightNumIn}`)}
                                     </div>
                                     
                                     <div className={`font-bold leading-none truncate ${b.isBusy ? 'text-white/40' : 'text-white'} ${b.isFirst ? 'mb-1 text-2xs' : 'text-3xs'}`}>
                                       {b.orig} {b.s.isOneWay ? '→' : '⇄'} {b.dest}
                                     </div>
                                     
                                     {b.isLast && (
                                       <div className="mt-auto text-white font-black text-right bg-black/80 px-1 py-0.5 rounded-sm self-end text-3xs border border-white/10 leading-none">
                                         {formatT(endAbs)}
                                       </div>
                                     )}
                                     
                                     {!b.isLast && (
                                       <div className="mt-auto text-white/30 text-4xs font-black italic uppercase truncate">Cont...</div>
                                     )}
                                     
                                     {b.isContinues && !b.isFirst && (
                                       <div className="absolute top-0 right-0 text-white/30 text-4xs font-black italic uppercase">Part 2</div>
                                     )}
                                   </div>
                                </div>
                              );
                          })}
                       </div>
                    </div>
                  ))}
                 </div>
              </div>
              
              <div className="p-4 border-t border-white/10 bg-white/[0.01] flex gap-4 shrink-0 rounded-sm w-full">
                  {!initialRouteId && (
                    <button onClick={() => setStep(1)} className="flex-1 py-4 border border-white/20 text-white/60 font-black uppercase text-sm tracking-widest py-4 px-6 rounded-sm hover:text-white hover:bg-white/10 transition-all">Back</button>
                  )}
                  {initialRouteId ? (
                    <button 
                      disabled={schedule.length === 0 || isFinalizing}
                      onClick={() => {
                        if (isFinalizing) return;
                        setIsFinalizing(true);
                        const r = routes.find(rt => rt.id === initialRouteId);
                        const routeData = {
                          ...r,
                          origin: originId,
                          destination: destId,
                          aircraft: selectedReg,
                          weeklyFlights: schedule.length,
                          schedule: schedule,
                          // Origin/destination can change in this dialog, so the stored
                          // distance and the derived financials have to be refreshed too;
                          // previously the old route's distance was carried over unchanged.
                          distance: routeDraft?.distance ?? r?.distance ?? 0,
                          durMin: getFlightDurationMinutes(),
                          classConfigs: classConfigs,
                          routeSat: getComputedRouteSatCache(),
                          ...(saveFinancials || {})
                        };
                        onSaveRoute(routeData);
                        setShowSuccess(true);
                        setTimeout(() => {
                          setShowSuccess(false);
                          setIsFinalizing(false);
                          onClose();
                        }, 2000);
                      }} 
                      className="flex-[2] py-4 bg-aero-yellow text-black font-black uppercase text-sm tracking-widest hover:bg-white hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans flex items-center justify-center gap-2"
                    >
                      {isFinalizing ? 'Saving...' : 'Save Changes'} <Check size={16} />
                    </button>
                  ) : (
                    <button 
                      onClick={() => setStep(3)} 
                      disabled={schedule.length === 0}
                      className="flex-[2] py-4 bg-aero-yellow text-black font-black uppercase text-sm tracking-widest hover:bg-white hover:shadow-2xl hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans flex items-center justify-center gap-2"
                    >
                      Proceed to Cabin Services <ChevronRight size={16} />
                    </button>
                  )}
              </div>
            </div>
          </div>
        )}


        {step === 3 && selectedOrigin && selectedDest && selectedAircraft && (() => {
          const planeSat = getPlaneSat(selectedAircraft);
          const deskPenalty = originDeskSim.sat + destDeskSim.sat;
          const standBonus = getStandBonus(selectedOrigin, selectedDest, selectedAircraft, airportManagement);

          return (
          <div className="flex-1 w-full flex flex-col min-h-0 overflow-y-auto custom-scrollbar animate-in fade-in duration-500 bg-black/25">
             <div className="flex-1 w-full max-w-[1800px] mx-auto p-4 flex flex-col lg:flex-row gap-4">
                {/* Left Area: Class Selection Boxes */}
                <div className="flex-1 flex flex-col gap-3">
                   <div className="flex justify-between items-center bg-white/[0.03] border border-white/10 p-4 rounded-sm">
                      <div className="flex flex-col">
                         <h3 className="text-2xl font-black uppercase tracking-tighter text-white leading-none">In-Flight Configuration</h3>
                         <span className="text-2xs text-white/40 uppercase tracking-widest mt-2 block">Select a category to customize service levels. Use "General" to apply settings to all classes simultaneously.</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setShowConfigLoadModal(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 hover:border-aero-yellow transition-all uppercase text-2xs font-black tracking-widest"
                        >
                          <FolderOpen size={14} /> Load Config
                        </button>
                        <button 
                          onClick={() => setShowConfigSaveModal(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-aero-yellow text-black hover:bg-white hover:scale-105 transition-all uppercase text-2xs font-black tracking-widest"
                        >
                          <Save size={14} /> Save Config
                        </button>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                      {['general', 'economy', 'premium', 'business', 'first'].map((c) => {
                         const seats = c === 'general' ? 0 : (selectedAircraft.config?.[c as keyof typeof selectedAircraft.config] as number || 0);
                         if (c !== 'general' && seats <= 0) return null;

                          const config = classConfigs[c];
                                                    let displaySatVal = 0;
                          let pureServiceSat = 0;
                          let providedQuality = 0;
                          let expectationTarget = 0;
                          
                          if (c === 'general') {
                             let activeClasses = 0;
                             let totalSce = 0;
                             let totalPure = 0;
                             let totalExp = 0;
                             let totalProv = 0;
                             ['economy', 'premium', 'business', 'first'].forEach(cl => {
                                const clsSeats = selectedAircraft.config?.[cl as keyof typeof selectedAircraft.config] as number || 0;
                                if (clsSeats > 0) {
                                   const sd = calculateClassSatisfaction(cl, selectedAircraft, classConfigs[cl], getFlightDurationMinutes(), airportManagement, selectedOrigin.id, selectedDest.id, difficulty);
                                   totalSce += sd.satisfactionPercentage;
                                   totalPure += sd.softProduct;
                                   totalProv += sd.providedQuality;
                                   totalExp += sd.expectationTarget;
                                   activeClasses++;
                                }
                             });
                             displaySatVal = activeClasses > 0 ? totalSce / activeClasses : 0;
                             pureServiceSat = activeClasses > 0 ? totalPure / activeClasses : 0;
                             providedQuality = activeClasses > 0 ? totalProv / activeClasses : 0;
                             expectationTarget = activeClasses > 0 ? totalExp / activeClasses : 0;
                          } else {
                             const sd = calculateClassSatisfaction(c, selectedAircraft, config, getFlightDurationMinutes(), airportManagement, selectedOrigin.id, selectedDest.id, difficulty);
                             displaySatVal = sd.satisfactionPercentage;
                             pureServiceSat = sd.softProduct;
                             providedQuality = sd.providedQuality;
                             expectationTarget = sd.expectationTarget;
                          }
                          
                          return (
                             <div 
                               key={c}
                               onClick={() => setActiveConfigClass(c)}
                               className={`group relative flex flex-col items-center justify-center p-4 border transition-all cursor-pointer min-h-[220px] overflow-hidden rounded-sm ${
                                  activeConfigClass === c 
                                     ? 'bg-aero-yellow border-aero-yellow text-black scale-[1.02] z-10 shadow-2xl' 
                                     : 'bg-white/[0.02] border-white/10 text-white hover:border-aero-yellow/50 hover:bg-white/[0.05]'
                               }`}
                             >
                                {/* Decorative background class name */}
                                <div className={`absolute -bottom-4 -right-2 text-7xl font-black opacity-[0.03] select-none pointer-events-none uppercase italic tracking-tighter group-hover:opacity-[0.1] transition-opacity ${activeConfigClass === c ? 'text-black' : 'text-white'}`}>
                                   {c === 'general' ? 'general' : c}
                                </div>

                                <div className={`text-2xs font-black uppercase tracking-[0.25em] mb-10 ${activeConfigClass === c ? 'text-black/60' : 'text-white/40'}`}>
                                   {c === 'general' ? 'General Standards' : c}
                                </div>

                                <div className="flex flex-col items-center">
                                   <div className="text-7xl font-black tracking-tighter mb-2 flex items-start">
                                      {Math.round(displaySatVal)}
                                      <span className="text-sm mt-2 ml-1 opacity-50">%</span>
                                   </div>
                                   <div className={`text-2xs font-bold uppercase tracking-widest py-1 px-4 border rounded-full ${activeConfigClass === c ? 'border-black/20 text-black/60' : 'border-white/10 text-white/40'}`}>
                                      {c === 'general' ? 'Global' : `${seats} Seats`}
                                   </div>
                                </div>

                                 {/* Summary Footer */}
                                 <div className={`mt-auto pt-10 flex flex-col items-center gap-2 text-3xs font-black uppercase tracking-widest ${activeConfigClass === c ? 'text-black/70' : 'text-white/30'}`}>
                                    <div className="flex gap-3 justify-center items-center">
                                       <span>{getCateringOpt(config.catering).label.split(',')[0]}</span>
                                       <span className="opacity-30">|</span>
                                       <span>{getMultiOptionSum(config.service, SERVICE_OPTIONS).label.split(',')[0]}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-current/10 bg-current/5">
                                       <span className="opacity-60">Service SAT:</span>
                                       <span className={activeConfigClass === c ? 'text-black font-black' : 'text-aero-yellow font-black'}>+{Math.round(pureServiceSat)}%</span>
                                    </div>
                                 </div>
                              </div>
                          );
                       })}
                    </div>
   
                    
          </div>

             {/* Right Sidebar: Satisfaction Breakdown spreadsheet */}
             <div className="w-full lg:w-[450px] min-h-0 shrink-0 border border-white/10 bg-black/40 flex flex-col overflow-y-auto custom-scrollbar rounded-sm font-mono shadow-2xl relative z-20">
                <div className="p-4 border-b border-white/10 bg-white/[0.04]">
                   <div className="text-2xs text-white/30 uppercase font-black tracking-[0.2em] leading-none mb-3">Cabin Services Budget</div>
                   <div className="text-4xl font-black text-aero-yellow italic leading-none tracking-tighter">
                      ${Object.keys(classConfigs).reduce((acc, c) => {
                         if (c === 'general') return acc; 
                         const seats = selectedAircraft.config?.[c as keyof typeof selectedAircraft.config] as number || 0; 
                         if (seats <= 0) return acc;
                         const mealCount = getFlightTimeClass(getFlightDurationMinutes()) <= 5 ? 1 : getFlightTimeClass(getFlightDurationMinutes()) <= 7 ? 2 : 3; 
                         let mealCost = 0; 
                         for (let i = 0; i < mealCount; i++) { 
                            mealCost += getCateringOpt(classConfigs[c].catering, i).cost; 
                         } 
                         const extras = getMultiOptionSum(classConfigs[c].extras, EXTRAS_OPTIONS); 
                         const services = getMultiOptionSum(classConfigs[c].service, SERVICE_OPTIONS); 
                         return acc + ((mealCost + extras.cost + services.cost) * seats);
                      }, 0).toLocaleString()} <span className="text-sm font-bold opacity-40">/ wk</span>
                   </div>
                </div>

                <div className="p-4 border-b border-white/10 bg-white/[0.02]">
                   <div className="flex justify-between items-end mb-3">
                      <div>
                         <h3 className="text-2xl font-black uppercase tracking-tighter text-white mb-1">Route Satisfaction</h3>
                         <div className="text-2xs text-white/40 uppercase tracking-widest font-bold">Yield Performance Index</div>
                      </div>
                      {(() => {
                           let totalWeightedSat = 0;
                           let totalSeats = 0;
                           const planeSat = getPlaneSat(selectedAircraft);
                           const deskPenalty = originDeskSim.sat + destDeskSim.sat;
                           const standBonus = getStandBonus(selectedOrigin, selectedDest, selectedAircraft, airportManagement);

                           ['economy', 'premium', 'business', 'first'].forEach(c => {
                              const seats = selectedAircraft.config?.[c as keyof typeof selectedAircraft.config] as number || 0;
                              if (seats > 0) {
                                 const config = classConfigs[c];
                                 const sce = calculateClassSatisfaction(c, selectedAircraft, config, getFlightDurationMinutes(), airportManagement, selectedOrigin.id, selectedDest.id, difficulty).satisfactionPercentage;
                                 const loungeBonus = getLoungeBonus(selectedOrigin.id, c, airportManagement) + getLoungeBonus(selectedDest.id, c, airportManagement);
                                 const baseClassRouteSat = (planeSat * 0.4) + (sce * 0.6) + loungeBonus + deskPenalty + standBonus;
                                 const classRouteSat = adjustSatForDifficulty(baseClassRouteSat, difficulty);
                                 totalWeightedSat += (classRouteSat * seats);
                                 totalSeats += seats;
                              }
                           });

                           const finalSat = totalSeats > 0 ? (totalWeightedSat / totalSeats) : 0;
                           return (
                              <div className="text-5xl font-black italic text-aero-yellow tracking-tighter leading-none">
                                 {Math.round(Math.max(0, finalSat))}%
                              </div>
                           );
                      })()}
                   </div>

                   <div className="grid grid-cols-2 gap-2">
                      {['economy', 'premium', 'business', 'first'].map(c => {
                         const seats = selectedAircraft.config?.[c as keyof typeof selectedAircraft.config] as number || 0;
                         if (seats <= 0) return null;
                         const sce = calculateClassSatisfaction(c, selectedAircraft, classConfigs[c], getFlightDurationMinutes(), airportManagement, selectedOrigin.id, selectedDest.id, difficulty).satisfactionPercentage;
                         const loungeBonus = getLoungeBonus(selectedOrigin.id, c, airportManagement) + getLoungeBonus(selectedDest.id, c, airportManagement);
                         const cSatVal = calculateClassSatisfaction(c, selectedAircraft, classConfigs[c], getFlightDurationMinutes(), airportManagement, selectedOrigin.id, selectedDest.id, difficulty).satisfactionPercentage;
                         return (
                            <div key={c} className="bg-white/[0.03] p-3 border border-white/5 flex flex-col gap-1 transition-all hover:bg-white/[0.06] hover:border-aero-yellow/20">
                               <span className="text-4xs font-black uppercase tracking-widest text-white/40">{c}</span>
                               <span className="text-lg font-black italic text-aero-yellow leading-none">{Math.round(Math.max(0, cSatVal))}%</span>
                            </div>
                         );
                      })}
                   </div>
                </div>

                <div className="flex-1 divide-y divide-white/10">
                   {/* Combined Plane SAT Row */}
                   <div className="flex flex-col">
                      <button 
                        onClick={() => setExpandedSections(prev => ({ ...prev, plane: !prev.plane }))}
                        className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
                            <span className="text-2xs font-black uppercase tracking-widest flex items-center">Combined Plane SAT<InfoTooltip size={11} {...GLOSSARY.sat} /></span>
                         </div>
                         <div className="flex items-center gap-4">
                            <span className="text-sm font-black italic">{Math.round(getPlaneSat(selectedAircraft))}%</span>
                            <ChevronDown size={16} className={`text-white/20 group-hover:text-white transition-transform ${expandedSections.plane ? 'rotate-180' : ''}`} />
                         </div>
                      </button>
                      <AnimatePresence>
                         {expandedSections.plane && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-black/60 border-b border-white/10">
                               <div className="p-4 pt-0 space-y-3 text-2xs uppercase font-bold tracking-[0.2em] text-white/50">
                                  <div className="flex justify-between items-center bg-white/[0.03] p-3 border border-white/5">
                                     <span>Condition Weighted</span>
                                     <span className="text-white font-mono">{Math.round(getPlaneSat(selectedAircraft))}%</span>
                                  </div>
                                  
                                  <div className="border-t border-white/5 pt-3 mt-3">
                                     <div className="text-4xs text-white/20 mb-3 px-1 font-black tracking-widest">BY CABIN CLASS</div>
                                     {['economy', 'premium', 'business', 'first'].map(c => {
                                        const seats = selectedAircraft.config?.[c as keyof typeof selectedAircraft.config] as number || 0;
                                        if (seats <= 0) return null;
                                        return (
                                           <div key={c} className="flex justify-between items-center p-3 border border-white/5 bg-white/[0.02] mb-1">
                                              <span className="text-2xs text-white/70 font-black uppercase">{c}</span>
                                              <span className="text-white font-black italic text-xs">{Math.round(getPlaneSat(selectedAircraft))}%</span>
                                           </div>
                                        );
                                     })}
                                  </div>
                               </div>
                            </motion.div>
                         )}
                      </AnimatePresence>
                   </div>

                   {/* SCE-SAT Row */}
                   <div className="flex flex-col">
                      <button 
                        onClick={() => setExpandedSections(prev => ({ ...prev, sce: !prev.sce }))}
                        className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-aero-yellow shadow-2xl"></div>
                            <span className="text-2xs font-black uppercase tracking-widest">Cabin Services SAT</span>
                         </div>
                         <div className="flex items-center gap-4">
                            {(() => {
                               let totalSce = 0; let totalSeats = 0;
                               ['economy', 'premium', 'business', 'first'].forEach(c => {
                                  const seats = selectedAircraft.config?.[c as keyof typeof selectedAircraft.config] as number || 0;
                                  if (seats > 0) {
                                     const sce = calculateClassSatisfaction(c, selectedAircraft, classConfigs[c], getFlightDurationMinutes(), airportManagement, selectedOrigin.id, selectedDest.id, difficulty).satisfactionPercentage;
                                     totalSce += (sce * seats); totalSeats += seats;
                                  }
                               });
                               return <span className="text-sm font-black italic">{Math.round(totalSeats > 0 ? totalSce / totalSeats : 0)}%</span>;
                            })()}
                            <ChevronDown size={16} className={`text-white/20 group-hover:text-white transition-transform ${expandedSections.sce ? 'rotate-180' : ''}`} />
                         </div>
                      </button>
                      <AnimatePresence>
                         {expandedSections.sce && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-black/60 border-b border-white/10">
                               <div className="p-4 pt-0 space-y-2 text-2xs uppercase font-bold tracking-[0.2em] text-white/50">
                                  {['economy', 'premium', 'business', 'first'].map(c => {
                                     const seats = selectedAircraft.config?.[c as keyof typeof selectedAircraft.config] as number || 0;
                                     if (seats <= 0) return null;
                                     const config = classConfigs[c];
                                     const sce = calculateClassSatisfaction(c, selectedAircraft, config, getFlightDurationMinutes(), airportManagement, selectedOrigin.id, selectedDest.id, difficulty).satisfactionPercentage;
                                     return (
                                        <div key={c} className="flex justify-between items-center bg-white/[0.03] p-3 border border-white/5 mb-1 group-hover:border-aero-yellow/20 transition-all">
                                           <span className="text-2xs text-white/70 font-black">{c}</span>
                                           <span className="text-white font-mono text-xs">{Math.round(sce)}%</span>
                                        </div>
                                     );
                                  })}
                               </div>
                            </motion.div>
                         )}
                      </AnimatePresence>
                   </div>

                   {/* Airport Details Row */}
                   <div className="flex flex-col">
                      <button 
                        onClick={() => setExpandedSections(prev => ({ ...prev, airport: !prev.airport }))}
                        className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-aero-yellow shadow-2xl"></div>
                            <span className="text-2xs font-black uppercase tracking-widest">Ground Services & Bonuses</span>
                         </div>
                         <div className="flex items-center gap-4">
                            <span className="text-sm font-black italic text-aero-yellow">
                               {originDeskSim.sat + destDeskSim.sat + getStandBonus(selectedOrigin, selectedDest, selectedAircraft, airportManagement) >= 0 ? '+' : ''}
                               {Math.round(originDeskSim.sat + destDeskSim.sat + getStandBonus(selectedOrigin, selectedDest, selectedAircraft, airportManagement))}%
                            </span>
                            <ChevronDown size={16} className={`text-white/20 group-hover:text-white transition-transform ${expandedSections.airport ? 'rotate-180' : ''}`} />
                         </div>
                      </button>
                      <AnimatePresence>
                         {expandedSections.airport && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-black/60 border-b border-white/10">
                               <div className="p-4 pt-0 space-y-2 text-3xs uppercase font-bold tracking-[0.2em] text-white/40">
                                  <div className="text-white/20 mb-2 border-b border-white/5 pb-2 font-black tracking-[0.3em]">Operational Metrics</div>
                                  <div className="flex justify-between items-center px-2 py-1">
                                     <span className="italic">Origin Check-In</span>
                                     <span className={originDeskSim.sat < 0 ? 'text-aero-yellow/60' : 'text-aero-yellow'}>{originDeskSim.sat > 0 ? '+' : ''}{originDeskSim.sat}%</span>
                                  </div>
                                  <div className="flex justify-between items-center px-2 py-1">
                                     <span className="italic">Dest Check-In</span>
                                     <span className={destDeskSim.sat < 0 ? 'text-aero-yellow/60' : 'text-aero-yellow'}>{destDeskSim.sat > 0 ? '+' : ''}{destDeskSim.sat}%</span>
                                  </div>
                                  <div className="flex justify-between items-center px-2 py-1">
                                     <span className="italic">Stand Priority</span>
                                     <span className="text-aero-yellow">+{getStandBonus(selectedOrigin, selectedDest, selectedAircraft, airportManagement)}%</span>
                                  </div>
                                  
                                  <div className="border-t border-white/5 pt-4 mt-4">
                                     <div className="text-white/20 mb-3 px-2 font-black tracking-[0.3em]">ROUTE SAT PER CLASS</div>
                                     {['economy', 'premium', 'business', 'first'].map(c => {
                                        const seats = selectedAircraft.config?.[c as keyof typeof selectedAircraft.config] as number || 0;
                                        if (seats <= 0) return null;
                                        const config = classConfigs[c];
                                        const sceData = calculateClassSatisfaction(c, selectedAircraft, config, getFlightDurationMinutes(), airportManagement, selectedOrigin.id, selectedDest.id, difficulty);
                                        const originLoadSim = originDeskSim;
                                        const destLoadSim = destDeskSim;
                                        const overloadPenalty = (originLoadSim.sat < 0 ? originLoadSim.sat : 0) + (destLoadSim.sat < 0 ? destLoadSim.sat : 0);
                                        const classRouteSat = Math.max(0, sceData.satisfactionPercentage + overloadPenalty);
                                        return (
                                           <div key={c} className="flex justify-between items-center p-3 border border-white/5 bg-white/[0.02] mb-1">
                                              <div className="flex flex-col">
                                                 <span className="text-2xs text-white/70 font-black">{c}</span>
                                                 <span className="text-4xs text-white/30">Target: {sceData.expectationTarget} | Quality: {sceData.providedQuality}{overloadPenalty < 0 ? ` | Overload Penalty: ${overloadPenalty}` : ''}</span>
                                              </div>
                                              <span className="text-aero-yellow font-black italic text-xs">{Math.round(Math.max(0, classRouteSat))}%</span>
                                           </div>
                                        );
                                     })}
                                  </div>
                               </div>
                            </motion.div>
                         )}
                      </AnimatePresence>
                   </div>
                </div>

                <div className="p-4 border-t border-white/10 flex flex-col gap-3 bg-white/[0.01]">
                   <p className="text-2xs text-white/30 leading-relaxed italic border-l-3 border-aero-yellow/30 pl-6 mb-2 font-bold uppercase tracking-widest">
                      SAT is what this cabin scores against what passengers expect for the class and
                      the flight length. 100% meets expectations; above that they tolerate a higher
                      fare, below it they only book at a discount. Expectations rise with distance,
                      so the same cabin scores lower on a long haul.
                   </p>
                   <div className="flex gap-4 mt-auto">
                      {!isEditingCabinOnly && <button onClick={() => setStep(2)} className="flex-1 py-4 border border-white/20 text-white/60 font-black uppercase text-sm tracking-widest py-4 px-6 rounded-sm hover:text-white hover:bg-white/10 transition-all">Back</button>}
                      {!isEditingCabinOnly && <button onClick={() => setStep(4)} className="flex-[2] py-4 bg-aero-yellow text-black font-black uppercase text-sm tracking-widest py-4 px-6 rounded-sm hover:bg-white transition-all shadow-2xl disabled:opacity-50">Next: Pricing</button>}
                      {isEditingCabinOnly && (
                        <button 
                          disabled={isFinalizing}
                          onClick={() => {
                             if (isFinalizing) return;
                             setIsFinalizing(true);
                             const r = routes.find(rt => rt.id === initialRouteId);
                             if (r) {
                               const routeData = {
                                 ...r,
                                 classConfigs: classConfigs,
                                 durMin: getFlightDurationMinutes(),
                                 ticketPrices: ticketPrices || r.ticketPrices || { economy: 100 },
                                 activeTicketPrices: r.activeTicketPrices || ticketPrices || r.ticketPrices || { economy: 100 }
                               };

                               const liveFinancials = calculateRouteFinancials(
                                 routeData,
                                 selectedAircraft,
                                 fuelPrice,
                                 airportManagement,
                                 currentYear,
                                 currentMonth,
                                 difficulty,
                                 airportsMap,
                                 routes,
                                 fleet,
                                 false,
                                 demandFactor,
                                 rivalOffers
                               );

                               onSaveRoute({
                                 ...routeData,
                                 ...liveFinancials
                               });
                             }
                             setShowSuccess(true);
                             setTimeout(() => {
                               setShowSuccess(false);
                               setIsFinalizing(false);
                               onClose();
                             }, 1500);
                          }}
                          className="flex-[2] py-4 bg-aero-yellow text-black font-black uppercase text-sm tracking-widest hover:bg-white transition-all shadow-2xl font-sans">
                          {isFinalizing ? 'Saving Cabin Configuration...' : 'Save Cabin Services'}
                        </button>
                      )}
                   </div>
                </div>
              </div>
              </div>
              </div>
        )})()}

        {step === 4 && financials && (() => {
           const { 
              dist, fuelPrice, flightLegs, weeklyFuelCost, weeklyCrewCost, weeklyInfraCost, 
              originDepartures, destDepartures, originLandingFees, destLandingFees,
              originCheckInUnit, destCheckInUnit, originCheckInFees, destCheckInFees,
              originPaxFeeUnit, destPaxFeeUnit, originPaxHandlingFees, destPaxHandlingFees
           } = financials;

           // `financials` already IS the full-load engine result for this draft, and
           // `saveFinancials` the realistic-load one. Both are memoised above, so this
           // block no longer recomputes the model on every keystroke.
           const displayFinancials = financials;

           const totalExpenses = displayFinancials.estWeeklyCosts;
           const estProfit = displayFinancials.estWeeklyProfit;
           const paxPerWeek = displayFinancials.paxPerWeek;
           const maxRevenue = displayFinancials.estWeeklyRev;

           const classes = ['economy', 'premium', 'business', 'first'];
           const aircraftConfig = (selectedAircraft.config || {}) as Partial<ConfigOutput>;
           const classSeatCount: Record<string, number> = {
             economy: aircraftConfig.economy || 0,
             premium: aircraftConfig.premium || 0,
             business: aircraftConfig.business || 0,
             first: aircraftConfig.first || 0
           };
           const totalEstPaxWeightedMax = (classSeatCount.economy * 1 + classSeatCount.premium * 1.6 + classSeatCount.business * 3.0 + classSeatCount.first * 5.0) * flightLegs;
           const basePriceBE75 = totalEstPaxWeightedMax > 0 ? displayFinancials.estWeeklyCosts / (totalEstPaxWeightedMax * 0.75) : 100;
           const basePriceBE99 = totalEstPaxWeightedMax > 0 ? displayFinancials.estWeeklyCosts / (totalEstPaxWeightedMax * 0.99) : 80;
           const basePriceBE35 = totalEstPaxWeightedMax > 0 ? displayFinancials.estWeeklyCosts / (totalEstPaxWeightedMax * 0.35) : 300;
           
           const actualCapacity = aircraftConfig 
             ? ((aircraftConfig.economy || 0) + (aircraftConfig.premium || 0) + (aircraftConfig.business || 0) + (aircraftConfig.first || 0)) 
             : 0;
           const finalCapacity = actualCapacity > 0 ? actualCapacity : selectedAircraft.capacity;
           const totalEstPaxMax = finalCapacity * flightLegs;

           return (
              <div className="flex-1 w-full flex flex-col min-h-0 overflow-y-auto custom-scrollbar animate-in bg-black/25">
                <div className="flex-1 w-full max-w-[1800px] mx-auto p-4 flex flex-col lg:flex-row gap-4">
                  {/* Left Area: Financial Summary */}
                  <div className="flex-[1] flex flex-col gap-3">
                     <div className="bg-white/[0.03] border border-white/10 p-4 rounded-sm shrink-0 sticky top-[100px] w-full lg:w-[350px]">
                        <div className="mb-4 flex flex-col gap-1.5 pointer-events-none">
                           <h3 className="text-xl font-black uppercase tracking-widest text-white leading-tight">
                              Financial Summary
                           </h3>
                           <span className="text-2xs text-white/40 tracking-widest font-mono font-bold uppercase">{paxPerWeek.toLocaleString()} / {totalEstPaxMax.toLocaleString()} Weekly PAX</span>
                        </div>
                        
                        <div className="space-y-4 mb-4">
                           <div className="flex justify-between items-end border-b border-white/5 pb-2">
                             <span className="text-2xs uppercase font-bold tracking-widest text-white/60">Est. Weekly Revenue</span>
                             <span className="text-lg font-mono text-aero-yellow">+${maxRevenue.toLocaleString()}</span>
                           </div>
                           <div className="flex flex-col border-b border-white/5 pb-2">
                             <div 
                               className="flex justify-between items-end cursor-pointer group"
                               onClick={() => setExpandedSections(prev => ({ ...prev, fuel4: !prev.fuel4 }))}
                             >
                               <span className="text-2xs uppercase font-bold tracking-widest text-white/60 hover:text-aero-yellow transition-colors flex items-center gap-1">
                                 Opx: Fuel Cost {expandedSections.fuel4 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                               </span>
                               <span className="text-sm font-mono text-white/40 group-hover:text-white transition-colors">-${weeklyFuelCost.toLocaleString()}</span>
                             </div>
                             {expandedSections.fuel4 && (
                               <div className="pl-4 mt-2 space-y-1">
                                 <div className="flex justify-between items-end">
                                   <span className="text-3xs uppercase tracking-widest text-white/30">Fuel Price</span>
                                   <span className="text-2xs font-mono text-white/30">${(fuelPrice / 3.785).toFixed(2)}/L</span>
                                 </div>
                                 <div className="flex justify-between items-end">
                                   <span className="text-3xs uppercase tracking-widest text-white/30">Max Pax</span>
                                   <span className="text-2xs font-mono text-white/30">{selectedAircraft.capacity}</span>
                                 </div>
                                 <div className="flex justify-between items-end">
                                   <span className="text-3xs uppercase tracking-widest text-white/30">Oneway Distance</span>
                                   <span className="text-2xs font-mono text-white/30">{dist.toFixed(0)} km</span>
                                 </div>
                                 <div className="flex justify-between items-end">
                                   <span className="text-3xs uppercase tracking-widest text-white/30">Formula Divider</span>
                                   <span className="text-2xs font-mono text-white/30">{(0.75 + (selectedAircraft.efficiency / 70)).toFixed(2)}</span>
                                 </div>
                                 <div className="flex justify-between items-end">
                                   <span className="text-3xs uppercase tracking-widest text-white/30">Weekly Flight Legs</span>
                                   <span className="text-2xs font-mono text-white/30">{flightLegs}x</span>
                                 </div>
                               </div>
                             )}
                           </div>
                           <div className="flex justify-between items-end border-b border-white/5 pb-2">
                             <span className="text-2xs uppercase font-bold tracking-widest text-white/60">Opx: Cabin & Catering</span>
                             <span className="text-sm font-mono text-white/40">-${Math.round(totalExpenses - weeklyFuelCost - weeklyCrewCost - weeklyInfraCost).toLocaleString()}</span>
                           </div>
                             <div 
                               className="flex justify-between items-end cursor-pointer group"
                               onClick={() => setExpandedSections(prev => ({ ...prev, crew4: !prev.crew4 }))}
                             >
                                <span className="text-2xs uppercase font-bold tracking-widest text-white/60 hover:text-aero-yellow transition-colors flex items-center gap-1">
                                 Opx: Crew Costs {expandedSections.crew4 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                               </span>
                               <span className="text-sm font-mono text-white/40 group-hover:text-white transition-colors">-${weeklyCrewCost.toLocaleString()}</span>
                             </div>
                             {expandedSections.crew4 && (
                               <div className="pl-4 mt-2 space-y-1">
                                 <div className="flex justify-between items-end">
                                   <span className="text-3xs uppercase tracking-widest text-white/30">Hourly Rate</span>
                                   <span className="text-2xs font-mono text-white/30">${((2 * 100) + (Math.ceil(selectedAircraft.capacity / 50) * 40)).toFixed(2)}</span>
                                 </div>
                                 <div className="flex justify-between items-end">
                                   <span className="text-3xs uppercase tracking-widest text-white/30">Pilots / FAs</span>
                                   <span className="text-2xs font-mono text-white/30">2 / {Math.ceil(selectedAircraft.capacity / 50)}</span>
                                 </div>
                                 <div className="flex justify-between items-end">
                                   <span className="text-3xs uppercase tracking-widest text-white/30">Weekly Flight Hours</span>
                                   <span className="text-2xs font-mono text-white/30">{(schedule.reduce((acc, s) => acc + (s.durMin * (s.isOneWay ? 1 : 2)), 0) / 60).toFixed(2)}h</span>
                                 </div>
                               </div>
                             )}
                           <div className="flex flex-col border-b border-white/5 pb-2">
                             <div 
                               className="flex justify-between items-end cursor-pointer group"
                               onClick={() => setExpandedSections(prev => ({ ...prev, infra4: !prev.infra4 }))}
                             >
                               <span className="text-2xs uppercase font-bold tracking-widest text-white/60 hover:text-aero-yellow transition-colors flex items-center gap-1">
                                 Opx: Infrastructure {expandedSections.infra4 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                               </span>
                               <span className="text-sm font-mono text-white/40 group-hover:text-white transition-colors">-${weeklyInfraCost.toLocaleString()}</span>
                             </div>
                             {expandedSections.infra4 && (
                               <div className="pl-4 mt-2 space-y-2 border-l border-white/10 ml-1">
                                 <div className="space-y-1">
                                   <h4 className="text-4xs font-black uppercase tracking-widest text-aero-yellow/50 mb-1">Landing Fees</h4>
                                   <div className="flex justify-between items-end">
                                     <span className="text-3xs uppercase tracking-widest text-white/30">{selectedOrigin.id} ({originDepartures}x landings)</span>
                                     <span className="text-2xs font-mono text-white/30">-${originLandingFees.toLocaleString()}</span>
                                   </div>
                                   <div className="flex justify-between items-end">
                                     <span className="text-3xs uppercase tracking-widest text-white/30">{selectedDest.id} ({destDepartures}x landings)</span>
                                     <span className="text-2xs font-mono text-white/30">-${destLandingFees.toLocaleString()}</span>
                                   </div>
                                 </div>

                                 <div className="space-y-1 pt-1 border-t border-white/5">
                                   <h4 className="text-4xs font-black uppercase tracking-widest text-aero-yellow/50 mb-1">Check-in Desk Costs</h4>
                                   <div className="flex justify-between items-end">
                                     <span className="text-3xs uppercase tracking-widest text-white/30">{selectedOrigin.id} ({originCheckInUnit.toFixed(3)}€/Pax)</span>
                                     <span className="text-2xs font-mono text-white/30">-${originCheckInFees.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                   </div>
                                   <div className="flex justify-between items-end">
                                     <span className="text-3xs uppercase tracking-widest text-white/30">{selectedDest.id} ({destCheckInUnit.toFixed(3)}€/Pax)</span>
                                     <span className="text-2xs font-mono text-white/30">-${destCheckInFees.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                   </div>
                                 </div>

                                 <div className="space-y-1 pt-1 border-t border-white/5">
                                   <h4 className="text-4xs font-black uppercase tracking-widest text-aero-yellow/50 mb-1">PAX Handling Fees (Security/Baggage)</h4>
                                   <div className="flex justify-between items-end">
                                     <span className="text-3xs uppercase tracking-widest text-white/30">{selectedOrigin.id} (L{selectedOrigin.level}: ${originPaxFeeUnit}/pax)</span>
                                     <span className="text-2xs font-mono text-white/30">-${originPaxHandlingFees.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                   </div>
                                   <div className="flex justify-between items-end">
                                     <span className="text-3xs uppercase tracking-widest text-white/30">{selectedDest.id} (L{selectedDest.level}: ${destPaxFeeUnit}/pax)</span>
                                     <span className="text-2xs font-mono text-white/30">-${destPaxHandlingFees.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                   </div>
                                 </div>

                                 <div className="pt-1 border-t border-white/5">
                                    <p className="text-4xs text-white/20 uppercase font-bold leading-tight">
                                      * Costs include slot license, check-in desk personnel, terminal usage fees, and baggage handling systems per departure.
                                    </p>
                                 </div>
                               </div>
                             )}
                           </div>
                        </div>

                        <div className={`p-4 border ${estProfit >= 0 ? 'bg-aero-yellow/10 border-aero-yellow/30' : 'bg-aero-panel border-white/20'} flex flex-col items-center justify-center`}>
                            <span className="text-2xs uppercase font-black tracking-widest text-white/50 mb-1">Max Possible Profit</span>
                           <span className={`text-4xl font-black italic tracking-tighter ${estProfit >= 0 ? 'text-aero-yellow' : 'text-aero-yellow/60'}`}>
                             {estProfit >= 0 ? '+' : '-'}${Math.abs(Math.round(estProfit)).toLocaleString()}
                           </span>
                        </div>
                     </div>
                  </div>

                  {/* Right Area: Sliders */}
                  <div className="flex-[2] flex flex-col">
                     <div className="bg-white/[0.03] border border-white/10 p-4 rounded-sm mb-3 flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-3">
                           <h3 className="text-xl font-black uppercase tracking-widest text-white mb-2">Configure Pricing</h3>
                           {debugMode && (
                             <div 
                                className="text-white/50 text-2xs font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer border border-white/10 px-2 py-1 bg-black/40 hover:bg-white/10"
                                onClick={() => setShowPricingDebug(!showPricingDebug)}
                             >
                                <Search size={12} /> Base P. <span className="text-4xs bg-white/10 px-1 py-0.5 rounded-sm">DEBUG</span>
                             </div>
                           )}
                        </div>

                        {showPricingDebug && debugMode && (
                          <div className="mb-4 p-4 border border-white/10 bg-black/60 rounded-sm font-mono text-2xs text-white/60 space-y-2">
                             <div className="text-white font-bold mb-2 uppercase tracking-widest">SAT-Basisprice Calculation & Demand</div>
                             {(() => {
                                const aircraftConfig = (selectedAircraft.config || {}) as Partial<ConfigOutput>;
                                const classSeatCountLocal: Record<string, number> = {
                                  economy: aircraftConfig.economy || 0,
                                  premium: aircraftConfig.premium || 0,
                                  business: aircraftConfig.business || 0,
                                  first: aircraftConfig.first || 0
                                };
                                const dist = Math.round(calculateDistance(selectedOrigin.coords[0], selectedOrigin.coords[1], selectedDest.coords[0], selectedDest.coords[1]));
                                const tc = getFlightTimeClass(getFlightDurationMinutes());
                                const bases = calculateBasePrices(dist, tc);
                                const routeSatCache = getComputedRouteSatCache();
                                const d = calculateDemand(
                                    getAirportStats(selectedOrigin, currentYear).business, getAirportStats(selectedOrigin, currentYear).tourism,
                                    getAirportStats(selectedDest, currentYear).business, getAirportStats(selectedDest, currentYear).tourism,
                                    tc, currentMonth, difficulty, currentYear
                                );
                                return ['economy', 'premium', 'business', 'first'].map(c => {
                                   if (!classSeatCountLocal[c]) return null;
                                   const maxDemand = d[c as keyof typeof d] as number || 0;
                                   const base = bases[c as keyof typeof bases];
                                   const sat = Math.max(0, routeSatCache[c] || 0);
                                   const satMultiplier = getSatMultiplier(sat);
                                   const satBase = Math.round(base * satMultiplier);
                                   const currentPrice = ticketPrices[c] || satBase; 
                                   const demMult = getPriceDemandMultiplier(currentPrice, satBase, sat);
                                   const finalDemand = Math.floor(maxDemand * demMult);
                                   return (
                                      <div key={c} className="flex flex-col py-2 border-b border-white/5 last:border-0 gap-1">
                                         <div className="flex justify-between text-white">
                                           <span className="uppercase font-bold">{c}</span>
                                           <span>Base: ${base} &times; SAT-Mult: {satMultiplier.toFixed(3)} ({sat}%) &rarr; <strong className="text-aero-yellow">SAT-Base: ${satBase}</strong></span>
                                         </div>
                                         {sat > 100 && (
                                            <div className="pl-4 text-4xs text-white/30 italic">
                                               SAT &gt; 100%: {sat <= 200 ? `1.0 + (0.008 * ${sat-100}) - (0.000035 * ${Math.pow(sat-100, 2).toFixed(0)})` : `1.45 + (0.001 * ${sat-200})`}
                                            </div>
                                         )}
                                         <div className="flex justify-between pl-4 text-3xs">
                                           <span>Ratio (R): {(currentPrice/satBase).toFixed(2)}x</span>
                                         </div>
                                         <div className="flex justify-between pl-4 text-3xs">
                                           <span>Demand Formula: 1.0 - (R - 1)^2</span>
                                           <span>Mult: {(demMult*100).toFixed(1)}%</span>
                                         </div>
                                         <div className="flex justify-between pl-4 text-3xs text-aero-yellow">
                                           <span>{maxDemand.toLocaleString()} Max Pax &times; {(demMult*100).toFixed(1)}%</span>
                                           <span>Real max pax: {finalDemand.toLocaleString()}</span>
                                         </div>
                                         <div className="flex justify-between pl-4 text-3xs text-white/40">
                                            <span>Seats on Aircraft:</span>
                                            <span>{classSeatCountLocal[c]}</span>
                                         </div>
                                      </div>
                                   );
                                });
                             })()}
                          </div>
                        )}

                        <div className="space-y-8 max-w-2xl">
                                                      <div className="flex flex-col gap-4 bg-black/40 p-4 border border-white/5 group hover:border-white/20 transition-all mb-4 shadow-2xl relative overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-r from-aero-yellow/10 to-transparent pointer-events-none" />
                              <div className="flex justify-between items-center relative z-10">
                                 <div className="flex flex-col">
                                    <span className="text-sm uppercase font-black tracking-widest text-aero-yellow">General Settings</span>
                                    <span className="text-2xs text-white/40 uppercase tracking-widest mt-1">Adjust All Prices</span>
                                 </div>
                              </div>
                              <div className="relative pt-4 z-10">
                                 <input 
                                    type="range"
                                    min={Math.round(basePriceBE99)}
                                    max={Math.round(basePriceBE35)}
                                    value={ticketPrices['economy'] || Math.round(basePriceBE75)}
                                    onChange={(e) => {
                                       const val = parseInt(e.target.value);
                                       const newPrices = { ...ticketPrices };
            classes.forEach(c => {
                                          if (classSeatCount[c] > 0) {
                                             const multi = (c === 'premium' ? 1.6 : c === 'business' ? 3.0 : c === 'first' ? 5.0 : 1.0);
                                             newPrices[c] = Math.round(val * multi);
                                          }
                                       });
                                       setTicketPrices(newPrices);
                                    }}
                                    className="w-full h-2 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-aero-yellow [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg cursor-pointer relative z-10"
                                 />
                                 <div 
                                    className="absolute top-[20px] h-4 w-1 bg-aero-yellow/70 pointer-events-none z-0 rounded-b-sm" 
                                    style={{ left: `calc(${((basePriceBE75 - basePriceBE99) / (basePriceBE35 - basePriceBE99)) * 100}% + ${8 - ((basePriceBE75 - basePriceBE99) / (basePriceBE35 - basePriceBE99)) * 16}px)`, transform: 'translateX(-50%)' }} 
                                 />
                                 <div className="flex justify-between mt-2 px-1">
                                    <span className="text-2xs text-white/40 font-mono">
                                      ${Math.round(basePriceBE99)}<span className="text-white/25 ml-1">break-even at 99% full</span>
                                    </span>
                                    <span className="text-2xs text-white/40 font-mono">
                                      <span className="text-white/25 mr-1">break-even at 35% full</span>${Math.round(basePriceBE35)}
                                    </span>
                                 </div>
                                 <p className="text-2xs text-white/30 leading-relaxed mt-1">
                                   The notch is break-even at 75% full, a realistic year-round average. Below it you
                                   are betting on filling more seats than that; well above it passengers stop booking.
                                 </p>
                              </div>
                           </div>

                           {classes.map(c => {
                             if (classSeatCount[c] <= 0) return null;
                             const currentPrice = ticketPrices[c] || 0;
                             const multiplier = (c === 'premium' ? 1.6 : c === 'business' ? 3.0 : c === 'first' ? 5.0 : 1.0);
                             
                             const breakEvenPrice = Math.round(basePriceBE75 * multiplier);
                             const minPossiblePrice = Math.round(basePriceBE99 * multiplier);
                             const maxPossiblePrice = Math.round(basePriceBE35 * multiplier);
                             
                             return (
                               <div key={c} className="flex flex-col gap-4 bg-black/40 p-4 border border-white/5 group hover:border-white/20 transition-all">
                                  <div className="flex justify-between items-center">
                                     <div className="flex flex-col">
                                        <span className="text-sm uppercase font-black tracking-widest text-aero-yellow">{c} Class</span>
                                        <span className="text-2xs text-white/40 uppercase tracking-widest mt-1">{classSeatCount[c]} Seats</span>
                                     </div>
                                     <div className="flex flex-col items-end">
                                        <span className="text-2xl font-mono text-white font-bold">${currentPrice}</span>
                                     </div>
                                  </div>
                                  
                                  <div className="relative pt-4">
                                     <input 
                                        type="range"
                                        min={minPossiblePrice}
                                        max={maxPossiblePrice}
                                        value={currentPrice}
                                        onChange={(e) => setTicketPrices(prev => ({ ...prev, [c]: parseInt(e.target.value) }))}
                                        className="w-full h-2 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-aero-yellow [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg cursor-pointer relative z-10"
                                     />
                                     <div 
                                        className="absolute top-[20px] h-4 w-1 bg-aero-yellow/70 pointer-events-none z-0 rounded-b-sm" 
                                        style={{ left: `calc(${((breakEvenPrice - minPossiblePrice) / (maxPossiblePrice - minPossiblePrice)) * 100}% + ${8 - ((breakEvenPrice - minPossiblePrice) / (maxPossiblePrice - minPossiblePrice)) * 16}px)`, transform: 'translateX(-50%)' }} 
                                     />
                                     <div className="flex justify-between mt-2 px-1">
                                        <span className="text-2xs text-white/30 font-mono" title="Break-Even at 99% LF">${minPossiblePrice}</span>
                                        <span className="text-2xs text-white/30 font-mono" title="Break-Even at 35% LF">${maxPossiblePrice}</span>
                                     </div>
                                  </div>
                               </div>
                             );
                           })}
</div>
                     </div>
                     <div className="flex gap-4">
                        <button onClick={() => setStep(3)} className="flex-1 py-4 border border-white/20 text-white/60 font-black uppercase text-sm tracking-widest py-4 px-6 rounded-sm hover:text-white hover:bg-white/10 transition-all">Back</button>
                        <button 
                          disabled={isFinalizing || schedule.length === 0}
                          onClick={() => {
                            if (isFinalizing || !routeDraft) return;
                            setIsFinalizing(true);

                            // routeDraft and saveFinancials are the memoised draft and
                            // its realistic-load figures; nothing needs recomputing here.
                            onSaveRoute({
                              ...routeDraft,
                              airline: "My Airline",
                              airlineCode: airlineCode,
                              flightNumberOut: flightNumberOutbound,
                              flightNumberIn: flightNumberInbound,
                              isOneWay: false,
                              aircraft: selectedAircraft.registration, 
                              weeklyFlights: schedule.length, 
                              turnoverMin: getTurnoverMinutes(),
                              ...saveFinancials
                            });
                            setShowSuccessMsg(true);
                            setTimeout(() => {
                              onClose();
                              setShowSuccessMsg(false);
                              setIsFinalizing(false);
                              setStep(1);
                              setOriginId(null);
                              setDestId(null);
                              setSelectedReg(null);
                              setSchedule([]);
                              setValidationMsg(null);
                              const nextBase = Math.floor(1000 + Math.random() * 8000);
                              setFlightNumberOutbound(nextBase.toString());
                              setFlightNumberInbound((nextBase + 1).toString());
                            }, 2000);
                          }}
                          className="flex-[2] py-4 bg-aero-yellow text-black font-black uppercase text-sm tracking-widest hover:bg-white hover:shadow-2xl hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans"
                        >
                          {isFinalizing ? 'Finalizing...' : 'Finalize Route'}
                        </button>
                     </div>
                  </div>
               </div>
            );
              </div>
            );
         })()}

        {/* The save and load dialogs are rendered once, below, inside
            AnimatePresence. A second, non-animated copy used to live here and
            was bound to the same two flags, so opening either one stacked two
            identical dialogs on top of each other. */}

        {/* Global Configuration Overlay */}
        {activeConfigClass && selectedAircraft && selectedOrigin && selectedDest && (
          <RouteConfigOverlay
            activeConfigClass={activeConfigClass}
            selectedAircraft={selectedAircraft}
            selectedOrigin={selectedOrigin}
            selectedDest={selectedDest}
            airportManagement={airportManagement}
            classConfigs={classConfigs}
            setClassConfigs={setClassConfigs}
            setActiveConfigClass={setActiveConfigClass}
            takeControl={takeControl}
            setTakeControl={setTakeControl}
            getFlightDurationMinutes={getFlightDurationMinutes}
                         routes={routes}
             fleet={fleet}
             schedule={schedule}
             initialRouteId={initialRouteId}
             difficulty={difficulty}
          />
        )}

        <CabinConfigDialogs />

      </div>
    </div>
  );
}
