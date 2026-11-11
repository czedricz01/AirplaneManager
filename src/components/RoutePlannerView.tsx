import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { Plane, ChevronRight, Map as MapIcon, Search, Plus, Minus, Check, ChevronDown, ChevronUp, Save, FolderOpen, AlertTriangle, Eye, EyeOff, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { Airport, calculateDistance, getAirportStats } from '../data/airports';
import type { OwnedAircraft } from './MyFleetView';
import type { AirportInfrastructure, ManagementLevel } from '../lib/gameTypes';
import { SERVICE_OPTIONS } from '../data/catering';
import { RouteConfigOverlay } from './RouteConfigOverlay';
import { InfoTooltip, GLOSSARY } from './InfoTooltip';
import { RoutePlannerProvider, usePlanner, type PlannerUiState } from './routePlanner/RoutePlannerContext';
import type { PlannerSelection } from './routePlanner/plannerState';
import { CabinConfigDialogs } from './routePlanner/CabinConfigDialogs';
import { AircraftImage } from './AircraftImage';
import { loadAircraftImagesMap } from '../lib/imageUtils';
// The component used to declare a near-identical ScheduledTrip that shadowed
// this one, differing only in groupId being required. One type now.
import type { ConfigOutput } from './ConfigurePurchaseView';
import type { ScheduledTrip } from '../lib/gameTypes';
import { readJson, writeJson } from '../lib/safeStorage';
import {
  NO_DESTINATION_FILTERS,
  activeDestinationFilterCount,
  passesDestinationFilters,
  type DestinationFilters,
  type RangeFilter
} from '../lib/destinationFilter';

const HIDDEN_AIRCRAFT_KEY = 'planner_hidden_aircraft';
import { blockMinutes, rawBlockMinutes, dailyRunCapacity, findMaxFlightStarts, getUsedWeeklySlots as sharedUsedWeeklySlots, occupiedIntervals, getTurnoverMinutes as turnoverForClass } from '../lib/scheduleUtils';
import { formatCurrency, formatNumber, formatSignedCurrency } from '../lib/format';
import { createTimerBag } from '../lib/timerBag';
import {
  getSlotPurchaseCost,
  applyInfrastructureChange,
  SLOT_CAPEX_LABEL,
  calculateRouteFinancials,
  getJetFuelPrice,
  getPlaneSat,
  getRouteClassSatisfaction,
  getManagementUnlockCost,
  getInfraAvailability,
  seatWeightedSatisfaction,
  classConfigFor,
  CABIN_CLASSES,
  getFlightTimeClass,
  getCateringOpt,
  getMultiOptionSum,
  calculateDemand,
  calculateBasePrices,
  eventRegionalFactor,
  getSatMultiplier,
  getPriceDemandMultiplier,
  MAX_SCARCITY_PREMIUM,
  PRICE_INSENSITIVE_SHARE,
  validateClassConfigs,
  getFlightDurationMinutes as sharedFlightDurationMinutes,
  toStoredRouteMetrics,
  marketKey,
  buildRivalRoutesByPair,
  RouteOffer
} from '../lib/financeUtils';
import { NEUTRAL_PLAYER_MODIFIERS, routeDemandFactor, type PlayerModifiers } from '../lib/gameState';
import { priceDraftInNetwork, type NetworkEnv } from '../lib/transferUtils';

const EMPTY_DESK_SIM = { load: 0, sat: 0, myPax: 0, cap: 0 };
// A stable default, so a missing prop does not invalidate the memos below on every render.
const NO_RIVAL_OFFERS: RouteOffer[] = [];
const NO_AI_AIRLINES: any[] = [];

/** A typed flight number, or `fallback` while the field is empty or not a number. */
const flightNumberBase = (value: string, fallback: number) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

interface Props {
  airports: Airport[];
  fleet: OwnedAircraft[];
  routes: import('../lib/gameTypes').SimulatedRoute[];
  airportManagement: Record<string, AirportInfrastructure>;
  capital: number;
  initialOriginId?: string;
  initialDestId?: string;
  initialSelectedReg?: string;
  initialStep?: number;
  initialRouteId?: string;
  onUnlockManagement?: (airportId: string, level: ManagementLevel) => void;
  /** Why an airport is closed at the airline's rank, or null when it is open; see airportAccess.ts. */
  airportLock?: (airport: Airport) => string | null;
  onUpdateInfrastructure?: (airportId: string, infra: AirportInfrastructure) => void;
  /**
   * Takes a one-off cost out of the capital at once; a negative amount pays
   * money in. `label` names the line in the month's report.
   */
  onSubtractCapital?: (amount: number, label?: string) => void;
  /** Reports a refused or trimmed infrastructure purchase; these all used to fail silently. */
  onNotify?: (message: string) => void;
  /** The player-only effects on the economy, so the preview matches the monthly report. */
  playerMods?: PlayerModifiers;
  /**
   * The fuel price the player pays this month, fuel hedge included. Without
   * it the planner falls back to the market price, which a hedged airline
   * does not pay.
   */
  fuelPrice?: number;
  /** Rival departures per city pair, for the market-share split. */
  rivalOffers?: RouteOffer[];
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
  isEditingPricingOnly?: boolean;
  /** Shows the demand and pricing breakdowns; the game's debug setting. */
  debugMode?: boolean;
  currentYear: number;
  currentMonth: number;
  difficulty: string;
  aiAirlines?: any[];
  airlineCode?: string;
}

function InfaRowSmall({ label, count, used, cost, costSuffix = '/wk', onBuy, disabled, disableRemove }: { label: string, count: number, used?: number, cost: number, costSuffix?: string, onBuy: (n: number, isShift: boolean) => void, disabled?: boolean, disableRemove?: boolean }) {
  return (
    <div className={`py-1.5 px-2 border transition-colors flex items-center justify-between ${disabled ? 'bg-surface border-line opacity-50' : 'bg-surface border-line hover:border-rule'}`}>
      <div className="flex flex-col w-24 shrink-0">
        <span className="text-2xs font-semibold text-ink uppercase tracking-label">{label}</span>
        <span className="text-2xs text-accent font-mono mt-0.5">{cost > 0 ? `$${formatNumber(cost)}${costSuffix}` : 'FREE'}</span>
      </div>
      <div className="flex items-center gap-2">
        {used !== undefined && (
          <div className="text-right flex flex-col items-end border-r border-line pr-2">
            <div className="text-2xs text-muted uppercase mb-0.5">Free</div>
            <span className="text-xs font-semibold text-ink leading-none">{count - used}</span>
          </div>
        )}
        <div className="text-right flex flex-col items-end border-r border-line pr-2">
          <div className="text-2xs text-muted uppercase mb-0.5">Stock</div>
          <span className="text-xs font-semibold text-ink leading-none">{count}</span>
        </div>
        <div className="flex gap-0.5 ml-1">
          <button
            disabled={disableRemove || disabled || count <= 0 || (used !== undefined && count - used <= 0)}
            onClick={(e) => onBuy(-1, e.shiftKey)}
            className="w-5 h-5 flex items-center justify-center bg-ground/40 border border-line hover:border-accent disabled:opacity-0 transition-all text-muted hover:text-ink text-2xs"
          >
            -
          </button>
          <button 
            disabled={disabled}
            onClick={(e) => onBuy(1, e.shiftKey)}
            className="w-5 h-5 flex items-center justify-center bg-ink text-on-accent font-semibold hover:bg-accent transition-all text-2xs"
          >
            +
          </button>
        </div>
      </div>
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
        step: props.isEditingCabinOnly ? 3 : props.isEditingPricingOnly ? 4 : (props.initialRouteId ? 2 : (props.initialStep || 1)),
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

/** Same picture name the fleet view uses: "Airbus A320", slashes made safe. */
const aircraftImageName = (ac: OwnedAircraft) =>
  `${ac.manufacturer} ${ac.type}`.split('/').join('-').split('\\').join('-');

function RoutePlannerInner({ 
  airports, fleet, routes, airportManagement, capital, 
  onUnlockManagement, airportLock, onUpdateInfrastructure, onSubtractCapital, onNotify, playerMods = NEUTRAL_PLAYER_MODIFIERS, fuelPrice: playerFuelPrice, rivalOffers = NO_RIVAL_OFFERS, onClose, onSaveRoute, onOpenCatalog, currentYear, currentMonth, difficulty, onGoToAirport,
  initialOriginId, initialDestId, initialSelectedReg, initialRouteId,
  initialSchedule, initialClassConfigs, isEditingCabinOnly, isEditingPricingOnly,
  onOriginChange, onDestChange, onRegChange, onStepChange, onScheduleChange, onClassConfigsChange,
  aiAirlines = NO_AI_AIRLINES,
  airlineCode = "NE",
  debugMode = false
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

  // Uploaded aircraft pictures for the step 1 cards. Fetched once per session
  // and shared with the fleet and market views.
  const [imagesMap, setImagesMap] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    loadAircraftImagesMap().then(map => { if (active) setImagesMap(map); });
    return () => { active = false; };
  }, []);

  // The short pause after a save, before the screen closes itself. The host
  // already closes the planner when the route is saved, so by the time a pause
  // ends the planner is usually gone; its timer must go with it, or it closes
  // whatever the player opened in the meantime (a new planner, another screen).
  const timers = React.useRef<ReturnType<typeof createTimerBag> | null>(null);
  if (timers.current === null) timers.current = createTimerBag();
  const later = timers.current.after;
  useEffect(() => () => timers.current?.cancelAll(), []);

  // Checks for room for the draft timetable pass the route being edited as
  // `excludeRouteId`: its saved flights are being replaced by the draft, and
  // counting both refused edits that fit.
  const getUsedWeeklySlots = (airportId: string | null, aircraftClass: string, excludeRouteId?: string) =>
    sharedUsedWeeklySlots(routes, fleetMap, airportId, aircraftClass, excludeRouteId);

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

  // Everything below reads the wizard state from the provider. The local names
  // are unchanged on purpose: the 3,000 lines of JSX further down did not have
  // to be touched, which is what makes this reviewable.
  const { selection, dispatch, ui, setUi } = usePlanner();

  /**
   * A useState-style setter for one field of the planner's interface state:
   * it takes the new value, or a function of the current one.
   */
  const uiSetter = <K extends keyof PlannerUiState>(key: K) =>
    (next: PlannerUiState[K] | ((prev: PlannerUiState[K]) => PlannerUiState[K])) =>
      setUi(key, typeof next === 'function' ? (next as (prev: PlannerUiState[K]) => PlannerUiState[K])(ui[key]) : next);
  const { step, originId, destId, selectedReg, schedule, classConfigs, ticketPrices, validationMsg } = selection;

  const setStep = (s: number) => {
    dispatch({ type: 'setStep', step: s });
    onStepChange?.(s);
  };
  const showSuccess = ui.showSuccess;
  const setShowSuccess = uiSetter('showSuccess');
  const isFinalizing = ui.isFinalizing;
  const setIsFinalizing = uiSetter('isFinalizing');
  const activeConfigClass = ui.activeConfigClass;
  const setActiveConfigClass = uiSetter('activeConfigClass');
  const expandedSections = ui.expandedSections;
  const setExpandedSections = uiSetter('expandedSections');
  const takeControl = ui.takeControl;
  const setTakeControl = uiSetter('takeControl');
  const setClassConfigs = (
    next: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)
  ) => {
    dispatch({
      type: 'setClassConfigs',
      classConfigs: typeof next === 'function' ? (next as any)(classConfigs) : next
    });
  };

  useEffect(() => {
    if (initialRouteId && (!initialClassConfigs || JSON.stringify(initialClassConfigs) === JSON.stringify(DEFAULT_CLASS_CONFIGS))) {
      const r = routes.find(rt => rt.id === initialRouteId);
      if (r && r.classConfigs) {
        setClassConfigs(r.classConfigs);
      }
    }
  }, [initialRouteId]);

  
  useEffect(() => {
    onClassConfigsChange?.(classConfigs);
  }, [classConfigs, onClassConfigsChange]);

  const setShowConfigSaveModal = uiSetter('showConfigSaveModal');
  const setShowConfigLoadModal = uiSetter('showConfigLoadModal');

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
        turnoverMin: turnoverForClass(incoming.class)
      };

      const dist = Math.round(calculateDistance(
        selectedOrigin.coords[0], selectedOrigin.coords[1],
        selectedDest.coords[0], selectedDest.coords[1]
      ));
      if (incoming.maxRange < dist) {
        validationMsg = `AIRCRAFT RANGE VIOLATION: Range is ${formatNumber(incoming.maxRange)} km but distance is ${formatNumber(dist)} km.`;
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
        // A single 'hydrate' patch, not the individual setOriginId/setDestId/
        // setSelectedReg/setSchedule setters: those go through the
        // selectOrigin/selectDest/selectAircraft reducer cases, which clear
        // the schedule whenever the origin, destination or aircraft change
        // (by design, for the interactive wizard). Dispatched separately here,
        // the schedule set first would immediately be wiped out by the origin
        // and destination hydration right after it -- leaving an existing
        // route's schedule empty, and with it flightLegs at 0, so every
        // Financial Summary figure that depends on flightLegs (revenue,
        // fuel/crew/infra cost) came out as 0.
        const patch: Partial<PlannerSelection> = {};
        if (!originId) patch.originId = r.origin;
        if (!destId) patch.destId = r.destination;
        if (!selectedReg) patch.selectedReg = r.aircraft;
        if ((!initialSchedule || initialSchedule.length === 0) && r.schedule) {
          const cleanSchedule = (r.schedule || []).map((s: any) => ({
            ...s,
            startHour: Number(s.startHour) || 0,
            startMin: Number(s.startMin) || 0,
            dayId: Number(s.dayId) || 1,
            durMin: Number(s.durMin) || 0,
            turnoverMin: Number(s.turnoverMin) || 0
          }));
          patch.schedule = cleanSchedule;
          patch.stashedSchedule = cleanSchedule;
        }
        if (r.ticketPrices && Object.keys(ticketPrices).length === 0) {
          patch.ticketPrices = r.ticketPrices;
        }
        if (Object.keys(patch).length > 0) {
          dispatch({ type: 'hydrate', patch });
        }
      }
    }
  }, [initialRouteId]);

  const originSearch = ui.originSearch;
  const setOriginSearch = uiSetter('originSearch');
  const destSearch = ui.destSearch;
  const setDestSearch = uiSetter('destSearch');
  const showDemandDebug = ui.showDemandDebug;
  const setShowDemandDebug = uiSetter('showDemandDebug');
  const showPricingDebug = ui.showPricingDebug;
  const setShowPricingDebug = uiSetter('showPricingDebug');
  const destSortBy = ui.destSortBy;
  const setDestSortBy = uiSetter('destSortBy');
  const destFilters = ui.destFilters;
  const setDestFilters = (v: DestinationFilters) => setUi('destFilters', v);
  const destFiltersOpen = ui.destFiltersOpen;
  const setDestFiltersOpen = (v: boolean) => setUi('destFiltersOpen', v);
  const setDestRange = (key: 'distance' | 'business' | 'tourism', bound: keyof RangeFilter, value: string) =>
    setDestFilters({ ...destFilters, [key]: { ...destFilters[key], [bound]: value } });
  const aircraftSearch = ui.aircraftSearch;
  const setAircraftSearch = uiSetter('aircraftSearch');
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
      const cycleMin = rawBlockMinutes(s);
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

  // Longest run of back-to-back round trips the aircraft's other routes leave
  // room for on each day. Only the other routes count: the trips of this
  // route are rebuilt from Multiple Ops whenever a day is toggled, so they
  // must not lower the limit (it would also shrink Multiple Ops under them).
  function getOpsCapacityForDays(aircraftRegistration: string, days: number[]) {
    return dailyRunCapacity(occupiedIntervals(routes, aircraftRegistration, initialRouteId), days);
  }

  function getFlightDurationMinutes(dest?: Airport) {
    // The model itself lives in financeUtils so the schedule editor computes the
    // same block time this planner priced the route with.
    return sharedFlightDurationMinutes(selectedOrigin, dest || selectedDest, selectedAircraft);
  }

  function getTurnoverMinutes() {
    return turnoverForClass(selectedAircraft?.class);
  }

  const validDestinations = useMemo(() => {
    const search = destSearch.toLowerCase();
    // These do not depend on the candidate airport, so they are computed once instead
    // of once per airport. getLongestFreeBlock alone rescans and sorts the whole
    // timetable, and it used to run for every one of the ~500 airports per keystroke.
    const turnMin = getTurnoverMinutes();
    const longestFree = selectedAircraft ? getLongestFreeBlock(selectedAircraft.registration) : 0;

    // Airports one of the player's routes starts or ends at, for the "not yet served" filter.
    const servedIds = new Set<string>();
    routes.forEach(r => { servedIds.add(r.origin); servedIds.add(r.destination); });

    const list = airports.filter(a => {
      if (a.id === originId) return false;
      const matchesSearch = a.id.toLowerCase().includes(search) || a.name.toLowerCase().includes(search);
      if (!matchesSearch) return false;

      const dist = selectedOrigin
        ? Math.round(calculateDistance(selectedOrigin.coords[0], selectedOrigin.coords[1], a.coords[0], a.coords[1]))
        : null;
      const stats = getAirportStats(a, currentYear);
      const passesFilters = passesDestinationFilters(destFilters, {
        distanceKm: dist,
        business: stats.business,
        tourism: stats.tourism,
        served: servedIds.has(a.id),
        // Built-up airports stay open whatever the rank, like the RANK badge in the list.
        rankLocked: (airportManagement?.[a.id]?.level || 0) < 1 && !!airportLock?.(a)
      });
      if (!passesFilters) return false;

      if (dist === null || !selectedAircraft) return true;
      if (dist > selectedAircraft.maxRange) return false;

      // ICAO Code Restrictions
      if (selectedAircraft.icaoCode > a.maxIcaoCode) return false;

      // Time constraint filtering
      const testDurMin = getFlightDurationMinutes(a);
      const blockTime = Math.ceil((30 + testDurMin * 2 + turnMin + 30) / 5) * 5;

      return blockTime <= longestFree;
    });

    // The figure each airport is sorted by, worked out once per airport
    // rather than twice per comparison. Largest first; the default is tourism
    // and business combined.
    const sortValue = (a: Airport) => {
      if (destSortBy === 'distance') {
        return selectedOrigin ? calculateDistance(selectedOrigin.coords[0], selectedOrigin.coords[1], a.coords[0], a.coords[1]) : 0;
      }
      const stats = getAirportStats(a, currentYear);
      if (destSortBy === 'tourism') return stats.tourism;
      if (destSortBy === 'business') return stats.business;
      return stats.tourism + stats.business;
    };
    return list
      .map(airport => ({ airport, value: sortValue(airport) }))
      .sort((a, b) => b.value - a.value)
      .map(entry => entry.airport);
  }, [airports, destSearch, destFilters, originId, selectedAircraft, selectedOrigin, routes, destSortBy, currentYear, airportLock, airportManagement]);

  // How many round trips the selected aircraft can still fly on this city pair:
  // per week (best packing of the free time) and per day (the tightest day).
  const tripCapacity = useMemo(() => {
    if (!selectedAircraft || !selectedOrigin || !selectedDest) return null;
    const dur = sharedFlightDurationMinutes(selectedOrigin, selectedDest, selectedAircraft);
    const cycleMin = blockMinutes({ durMin: dur, turnoverMin: turnoverForClass(selectedAircraft.class) });
    const occupied = occupiedIntervals(routes, selectedAircraft.registration, initialRouteId);
    const perWeek = Math.max(0, findMaxFlightStarts(occupied, cycleMin, 2100).bestCount);
    const perDay = Math.floor(dailyRunCapacity(occupied, []) / cycleMin);
    return { cycleMin, perWeek, perDay };
  }, [selectedAircraft, selectedOrigin, selectedDest, routes, initialRouteId]);

  const activeDestFilterCount = activeDestinationFilterCount(destFilters, !!selectedOrigin);

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
               const cycleMin = rawBlockMinutes(s);
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

  // Aircraft the player hid from the selection list. They stay available in
  // the collapsed "Hidden Aircraft" list below it. Kept in the browser like
  // the other planner preferences, by registration.
  const [hiddenRegs, setHiddenRegs] = useState<string[]>(() => {
    const stored = readJson<unknown>(HIDDEN_AIRCRAFT_KEY, []);
    return Array.isArray(stored) ? stored.filter((r): r is string => typeof r === 'string') : [];
  });
  const [showHiddenAircraft, setShowHiddenAircraft] = useState(false);
  const setAircraftHidden = (registration: string, hidden: boolean) => {
    setHiddenRegs(prev => {
      const next = hidden ? Array.from(new Set([...prev, registration])) : prev.filter(r => r !== registration);
      writeJson(HIDDEN_AIRCRAFT_KEY, next);
      return next;
    });
  };
  const hiddenSet = useMemo(() => new Set(hiddenRegs), [hiddenRegs]);
  const shownAircraft = useMemo(() => validAircraft.filter(ac => !hiddenSet.has(ac.registration)), [validAircraft, hiddenSet]);
  const hiddenAircraft = useMemo(() => validAircraft.filter(ac => hiddenSet.has(ac.registration)), [validAircraft, hiddenSet]);

  // One aircraft card of the step-1 selection list; a hidden one offers "show" instead of "hide".
  const renderAircraftCard = (ac: OwnedAircraft, isHidden: boolean) => {
    let usedMins = 0;
    // Grouped once above; this used to filter every route per card.
    (routesByAircraft.get(ac.registration) || []).forEach(r => {
       if (r.schedule) {
          r.schedule.forEach((s: any) => {
             const cycleMin = rawBlockMinutes(s);
             usedMins += cycleMin;
          });
       }
    });
    const utilPercent = Math.round((usedMins / 10080) * 100);

    return (
      <div 
        key={ac.registration}
        onClick={() => setSelectedReg(ac.registration)}
        className={`p-3 border border-line bg-ground/40 hover:bg-accent/20 hover:border-accent/50 cursor-pointer flex gap-4 ${isHidden ? 'opacity-60 hover:opacity-100' : ''}`}
      >
        <div className="w-20 h-14 bg-ground/50 border border-line flex items-center justify-center shrink-0 overflow-hidden">
           <AircraftImage
             safeName={aircraftImageName(ac)}
             manufacturer={ac.manufacturer}
             type={ac.type}
             imagesMap={imagesMap}
             fallback={<Plane size={24} className="text-muted" />}
           />
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <div className="flex justify-between items-center mb-1">
            <div className="font-semibold text-sm flex gap-2 items-center">
              {ac.registration}
              {ac.hubId && (
                <span className="text-2xs bg-raised px-1 border border-rule uppercase tracking-label">{ac.hubId} HUB</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="text-2xs bg-raised px-1 py-0.5">{ac.class}</div>
              <button
                onClick={e => { e.stopPropagation(); setAircraftHidden(ac.registration, !isHidden); }}
                className="p-1 text-muted hover:text-accent border border-transparent hover:border-accent/40 transition-colors"
                title={isHidden ? 'Show in the list again' : 'Hide from the list'}
                aria-label={isHidden ? `Show ${ac.registration}` : `Hide ${ac.registration}`}
              >
                {isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
            </div>
          </div>
          <div className="text-2xs flex justify-between text-muted">
            <span>{ac.type} • {formatNumber(ac.maxRange)} km</span>
            <span>{ac.capacity} pax</span>
          </div>
          <div className="mt-2 w-full bg-ground h-1 rounded-sm overflow-hidden relative">
             <div className={`h-full ${utilPercent > 80 ? 'bg-bad' : 'bg-accent'}`} style={{ width: `${Math.min(100, utilPercent)}%` }}></div>
          </div>
          <div className="text-2xs text-muted mt-0.5 uppercase text-right tracking-label leading-none">{utilPercent}% utilized</div>
        </div>
      </div>
    );
  };

  const mgt = airportManagement || {};
  const originAvail = getInfraAvailability(selectedOrigin, currentYear);
  const destAvail = getInfraAvailability(selectedDest, currentYear);
  const destMgtLvl = selectedDest ? (mgt[selectedDest.id]?.level || 0) : 0;

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
      const c = blockMinutes(s);
      const start = ((s.dayId - 1) * 24 * 60) + (s.startHour * 60 + s.startMin);
      return { start, end: start + c };
    }) || []);

    for (const trip of testSchedule) {
      const tempStart = (trip.dayId - 1) * 1440 + trip.startHour * 60 + trip.startMin;
      const cycle = blockMinutes(trip);
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
        const cycleMin = rawBlockMinutes(s);
        return sAcc + cycleMin;
      }, 0);
      return acc + tripsMinutes;
    }, 0);
    const draftMinutes = schedule.reduce((acc, s) => {
      const cycleMin = rawBlockMinutes(s);
      return acc + cycleMin;
    }, 0);
    totalMinutes += draftMinutes;
    return Math.min(100, (totalMinutes / 10080) * 100);
  }, [selectedAircraft, routes, schedule]);

  
  // What the player pays, hedge included; the market price only when App did
  // not say. The planner used to price every draft at the market rate, so a
  // hedged airline saw different fuel costs here than in the route list.
  const marketFuelPrice = useMemo(
    () => getJetFuelPrice(currentYear, currentMonth, difficulty),
    [currentYear, currentMonth, difficulty]
  );
  const fuelPrice = playerFuelPrice ?? marketFuelPrice;

  // A draft of the route as it currently stands in the wizard. Every financial
  // preview below is derived from this one object via the shared engine, so the
  // planner can no longer disagree with the monthly report.
  const routeDraft = useMemo(() => {
    if (!selectedOrigin || !selectedDest || !selectedAircraft) return null;
    return {
      // The edited route's own id, so the network below replaces it rather
      // than counting it twice.
      id: initialRouteId || draftRouteId,
      origin: selectedOrigin.id,
      destination: selectedDest.id,
      // Without it computeNetworkFinancials cannot find the aircraft and
      // leaves the draft out of the network altogether.
      aircraft: selectedAircraft.registration,
      distance: Math.round(calculateDistance(selectedOrigin.coords[0], selectedOrigin.coords[1], selectedDest.coords[0], selectedDest.coords[1])),
      durMin: getFlightDurationMinutes(),
      schedule,
      classConfigs,
      ticketPrices,
      activeTicketPrices: ticketPrices
    };
  }, [selectedOrigin, selectedDest, selectedAircraft, schedule, classConfigs, ticketPrices, initialRouteId, draftRouteId]);

  const networkEnv = useMemo<NetworkEnv>(() => ({
    fuelPrice, airportManagement, year: currentYear, month: currentMonth, difficulty, airportsMap, rivalOffers
  }), [fuelPrice, airportManagement, currentYear, currentMonth, difficulty, airportsMap, rivalOffers]);

  /**
   * A route as it will be saved, priced inside the player's network the way
   * the monthly report will price it: connecting passengers depend on every
   * route meeting this one and on the seats it leaves empty. For the save
   * buttons, which price exactly the object they store.
   */
  const priceInNetwork = (route: any) =>
    priceDraftInNetwork(route, routes, fleet, playerMods, networkEnv)?.fin ?? null;

  /**
   * The draft's connecting passengers, from the whole network with the draft
   * in it. Pricing the network takes 10-80 ms on a large airline, too much for
   * every tick of a price slider, so it follows a deferred copy of the draft:
   * the slider stays responsive and the figure catches up as soon as React
   * has a moment. Only the steps that show realistic loads (2-4) need it.
   */
  const deferredDraft = useDeferredValue(routeDraft);
  const draftTransfer = useMemo(() => {
    if (!deferredDraft || step < 2) return undefined;
    return priceDraftInNetwork(deferredDraft, routes, fleet, playerMods, networkEnv)?.transfer;
  }, [deferredDraft, step, routes, fleet, playerMods, networkEnv]);

  /** The player's modifiers with the draft's connecting passengers, keyed to the draft. */
  const plannerMods = useMemo(
    () => routeDraft && draftTransfer ? { ...playerMods, transfer: { [routeDraft.id]: draftTransfer } } : playerMods,
    [routeDraft, draftTransfer, playerMods]
  );

  // Rival routes per city pair, for the "COMP" hint in the destination list.
  const rivalRoutesByPair = useMemo(() => buildRivalRoutesByPair(aiAirlines), [aiAirlines]);

  /**
   * The city pair's weekly market for the preview in step 1. It used to assume
   * 850 km/h instead of the flight-time model and left out the player's demand
   * factor, so it disagreed with the fares and loads computed later.
   */
  const demandPreview = useMemo(() => {
    if (!selectedOrigin || !selectedDest) return null;
    const dist = Math.round(calculateDistance(selectedOrigin.coords[0], selectedOrigin.coords[1], selectedDest.coords[0], selectedDest.coords[1]));
    const dur = sharedFlightDurationMinutes(selectedOrigin, selectedDest, selectedAircraft || { cruiseSpeed: 800 });
    const tc = getFlightTimeClass(dur);
    const o = getAirportStats(selectedOrigin, currentYear);
    const t = getAirportStats(selectedDest, currentYear);
    const d = calculateDemand(o.business, o.tourism, t.business, t.tourism, tc, currentMonth, difficulty, currentYear, routeDemandFactor(playerMods, selectedOrigin, selectedDest) * eventRegionalFactor(currentYear, currentMonth, selectedOrigin, selectedDest));
    return { d, tc, basePrices: calculateBasePrices(dist, tc), assumedAircraft: !selectedAircraft };
  }, [selectedOrigin, selectedDest, selectedAircraft, currentYear, currentMonth, difficulty, playerMods]);

  /**
   * Satisfaction per class and the check-in simulation at both ends of the
   * route, from the same function the economy prices the route with.
   *
   * Step 3 used to re-derive these about 30 times per render, in three
   * different ways, so its headline, its tiles and the fares disagreed. One
   * memo now feeds every figure on that screen and the cabin overlay.
   */
  const classSat = useMemo(
    () => routeDraft && selectedAircraft
      ? getRouteClassSatisfaction(routeDraft, selectedAircraft, airportManagement, routes, fleet, difficulty)
      : null,
    [routeDraft, selectedAircraft, airportManagement, routes, fleet, difficulty]
  );
  const originDeskSim = classSat?.originDeskSim ?? EMPTY_DESK_SIM;
  const destDeskSim = classSat?.destDeskSim ?? EMPTY_DESK_SIM;

  // Numbers shown in the wizard. Outside Easy these assume a full aircraft, which is
  // what a "what could this route earn" preview should show.
  const financials = useMemo(() => {
    if (!routeDraft || !selectedAircraft) return null;

    const engine = calculateRouteFinancials(
      routeDraft, selectedAircraft, fuelPrice, airportManagement,
      currentYear, currentMonth, difficulty, airportsMap, routes, fleet,
      difficulty !== 'Easy', plannerMods.demandFactor, rivalOffers, plannerMods
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
  }, [routeDraft, selectedAircraft, fuelPrice, airportManagement, currentYear, currentMonth, difficulty, airportsMap, routes, fleet, schedule, plannerMods, rivalOffers]);

  // The figures actually stored on the route: realistic load factors, not full load.
  const saveFinancials = useMemo(() => {
    if (!routeDraft || !selectedAircraft) return null;
    return calculateRouteFinancials(
      routeDraft, selectedAircraft, fuelPrice, airportManagement,
      currentYear, currentMonth, difficulty, airportsMap, routes, fleet,
      false, plannerMods.demandFactor, rivalOffers, plannerMods
    );
  }, [routeDraft, selectedAircraft, fuelPrice, airportManagement, currentYear, currentMonth, difficulty, airportsMap, routes, fleet, plannerMods, rivalOffers]);

  // Break-even prices at 99%/75%/35% load, shared by the pricing step's sliders
  // and the auto-seed effect below. They come straight from the engine result,
  // which weights the cabins and divides the weekly cost, so the sliders and the
  // saved route cannot drift apart. (A copy of that formula used to live here.)
  const basePricePoints = useMemo(() => {
    if (!financials) return null;
    return {
      be75: financials.basePriceBE75,
      be99: financials.basePriceBE99,
      be35: financials.basePriceBE35
    };
  }, [financials]);

  // New fares start at what the market pays per cabin. They used to start at
  // break-even at 75% load, which on a costly route lay far above that fare,
  // so the first thing a player saw was a nearly empty aircraft at every
  // price near the notch. Break-even is the fallback when no fare is known.
  useEffect(() => {
    if (step === 4 && basePricePoints && Object.keys(ticketPrices).length === 0) {
       const base = basePricePoints.be75;
       const fare = saveFinancials?.marketFare ?? {};
       const seed = (c: string, multiplier: number) =>
         Math.round(fare[c] > 0 ? fare[c] : base * multiplier);
       setTicketPrices({
         economy: seed('economy', 1),
         premium: seed('premium', 1.6),
         business: seed('business', 3.0),
         first: seed('first', 5.0)
       });
    }
  }, [step, basePricePoints, ticketPrices, saveFinancials]);

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

  // Pointer events rather than mouse events, so a block can be dragged with a
  // finger as well as a mouse; the block itself is touch-none so the drag does
  // not scroll the timetable instead.
  const handleDragStart = (e: React.PointerEvent, dragTrip: ScheduledTrip) => {
    e.preventDefault();
    const startY = e.clientY;
    
    // Shift all trips in the current schedule proportionally
    const initialPositions = schedule.map(s => ({ 
      id: s.id, 
      startWeekMin: (s.dayId - 1) * 1440 + s.startHour * 60 + s.startMin
    }));

    const existingAircraftRoutes = selectedAircraft ? routes.filter(r => r.aircraft === selectedAircraft.registration && r.id !== initialRouteId) : [];
    const occupied = existingAircraftRoutes.flatMap(r => r.schedule?.map(s => {
      const c = blockMinutes(s);
      const start = ((s.dayId - 1) * 24 * 60) + (s.startHour * 60 + s.startMin);
      return { start, end: start + c };
    }) || []);

    const handlePointerMove = (moveEvent: PointerEvent) => {
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
          const cycle = blockMinutes(trip);
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

    // pointercancel: the browser took the touch over (e.g. a system gesture).
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
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
    const currentOriginUsed = getUsedWeeklySlots(selectedOrigin.id, aircraftClass, initialRouteId);
    const originCap = airportManagement[selectedOrigin.id]?.slots?.[slotKey] || 0;
    if (currentOriginUsed + currentDays.length * multipleOps > originCap) {
       setValidationMsg(`Not enough ${aircraftClass} slots at ${selectedOrigin.id}.`);
       return;
    }
    
    const currentDestUsed = getUsedWeeklySlots(selectedDest.id, aircraftClass, initialRouteId);
    const destCap = airportManagement[selectedDest.id]?.slots?.[slotKey] || 0;
    if (currentDestUsed + currentDays.length * multipleOps > destCap) {
       setValidationMsg(`Not enough ${aircraftClass} slots at ${selectedDest.id}.`);
       return;
    }

    const durMin = getFlightDurationMinutes();
    const turnMin = getTurnoverMinutes();
    const cycleMin = blockMinutes({ durMin, turnoverMin: turnMin });

    let bestStartM = (flightHour * 60 + flightMinute);
    const existingAircraftRoutes = routes.filter(r => r.aircraft === selectedAircraft.registration && r.id !== initialRouteId);
    const occupied = existingAircraftRoutes.flatMap(r => r.schedule?.map(s => {
      const c = blockMinutes(s);
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
          const c = rawBlockMinutes(s);
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
        
        const fOut = flightNumberBase(flightNumberOutbound, 1000) + (i * 2);
        const fIn = flightNumberBase(flightNumberInbound, 1001) + (i * 2);

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
     const requestedAmount = isShift ? baseAmount * 10 : baseAmount;
     const mgt = airportManagement || {};

     const level = mgt[airportId]?.level || 0;
     const hubAutoUpgrade = level >= 2;

     // Only slots have a one-off purchase price. Desks and stands are rented and show
     // up as weekly upkeep instead — charging their weekly rate as an upfront fee here
     // made them cost money in this screen but nothing in the airport console.
     const costPerUnit = type === 'slots' ? getSlotPurchaseCost(subType) : 0;

     const infra = mgt[airportId] || { level, slots: { regional: 0, narrowbody: 0, widebody: 0 }, stands: { narrowbody: 0, widebody: 0 }, desks: { normal: 0, self: 0 } };

     let availableSlots = Infinity;
     if (type === 'slots' && requestedAmount > 0) {
        const targetAirport = airportsMap.get(airportId);
        if (targetAirport) {
           const totalS = targetAirport.level * 300;
           const currentRented = (infra.slots?.regional || 0) + (infra.slots?.narrowbody || 0) + (infra.slots?.widebody || 0);
           const aiUsedS = getAiUsedWeeklySlots(airportId);
           availableSlots = Math.max(0, totalS - currentRented - aiUsedS);
        }
     }

     const result = applyInfrastructureChange({
        infra,
        type, subType,
        requestedAmount,
        hubAutoUpgrade,
        autoBuyStands: !!infra.autoBuyStands,
        availableSlots,
        utilizedSlots: type === 'slots' ? getUsedWeeklySlots(airportId, subType) : 0,
        costPerUnit,
        minNormalDesks: level >= 1 ? 1 : 0,
     });

     if (result.actualAmount === 0) {
       if (type === 'slots' && requestedAmount > 0) {
         onNotify?.(`No ${subType} slots are free at ${airportId} — the airport and its other carriers have taken them all.`);
       } else if (type === 'slots' && requestedAmount < 0) {
         onNotify?.(`Those ${subType} slots at ${airportId} are in use by your current schedule and cannot be sold.`);
       } else if (type === 'stands' && requestedAmount > 0) {
         onNotify?.(`Stands cannot outnumber slots. Buy more ${subType} slots at ${airportId} first.`);
       }
       return;
     }
     if (type === 'slots' && requestedAmount > 0 && result.actualAmount < requestedAmount) {
       onNotify?.(`Only ${result.actualAmount} of the ${requestedAmount} ${subType} slots you asked for are free at ${airportId}.`);
     }
     if (result.cost > 0 && capital < result.cost) {
       onNotify?.(
         `${result.actualAmount} ${subType} slot${result.actualAmount === 1 ? '' : 's'} at ${airportId} cost $${formatNumber(Math.round(result.cost))}, ` +
         `but you only have $${formatNumber(Math.round(capital))}. Nothing was bought.`
       );
       return;
     }

     // Paid for on the spot, like every other one-off cost; a sale refunds at once.
     if (result.cost !== 0) onSubtractCapital?.(result.cost, SLOT_CAPEX_LABEL);
     onUpdateInfrastructure?.(airportId, result.infra);
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
    const totalDurRaw = rawBlockMinutes({ durMin, turnoverMin: turnMin });
    const cycleMin = Math.ceil(totalDurRaw / 5) * 5;

    const existingTrips = routes
      .filter(r => r.aircraft === selectedAircraft.registration && r.id !== initialRouteId)
      .flatMap(r => r.schedule?.map(s => {
          const exCycleRaw = rawBlockMinutes(s);
          const exCycle = Math.ceil(exCycleRaw / 5) * 5;
          const start = ((s.dayId - 1) * 24 * 60) + (s.startHour * 60 + s.startMin);
          return { start, end: start + exCycle };
      }) || []);

    const aircraftClass = selectedAircraft.class;
    const slotKey = aircraftClass.toLowerCase() as 'regional' | 'narrowbody' | 'widebody';
    const mgt = airportManagement || {};
    const originCap = mgt[selectedOrigin.id]?.slots?.[slotKey] || 0;
    const destCap = mgt[selectedDest.id]?.slots?.[slotKey] || 0;
    const originUsed = getUsedWeeklySlots(selectedOrigin.id, aircraftClass, initialRouteId);
    const destUsed = getUsedWeeklySlots(selectedDest.id, aircraftClass, initialRouteId);
    const maxPossibleTrips = Math.min(7, originCap - originUsed, destCap - destUsed);

    if (maxPossibleTrips <= 0) return { hour: 8, minute: 0, autoSchedule: [] };

    let bestScore = -1;
    let bestResult = { hour: 8, minute: 0, autoSchedule: [] as ScheduledTrip[] };

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
            flightNumOut: flightNumberBase(flightNumberOutbound, 1000).toString(),
            flightNumIn: flightNumberBase(flightNumberInbound, 1001).toString(),
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
  }, [selectedAircraft, selectedOrigin, selectedDest, routes, initialRouteId]);

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
      const totalDurRaw = rawBlockMinutes(s);
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
       className="absolute inset-0 z-50 p-2 lg:p-3 flex flex-col font-sans overflow-hidden bg-raised text-ink"
    >
      {/* Success Message Overlay */}
      <>
        {showSuccess && (
          <div
            className="absolute inset-0 z-[200] bg-ground/80 flex items-center justify-center p-4 animate-appear"
          >
             <div className="bg-accent text-on-accent px-12 py-4 rounded-sm flex flex-col items-center gap-4 text-center">
                <div className="w-20 h-20 bg-ground/10 rounded-full flex items-center justify-center">
                   <Check size={48} strokeWidth={3} />
                </div>
                <div>
                   <h3 className="font-label text-3xl font-semibold">Route Updated</h3>
                   <p className="text-xs uppercase tracking-label font-semibold opacity-70 mt-1">Changes saved successfully</p>
                </div>
             </div>
          </div>
        )}
      </>

      {/* 1. SHARED UNIFIED HEADER WITH DYNAMIC ROUTE INFO BADGES */}
      <div className="flex flex-col gap-2 mb-2 short:mb-1 shrink-0 relative bg-ground/60 border-b border-line px-4 bar:px-3 py-2 short:py-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Upright phones: title and close button share the first row and the
              step buttons take the full row below (the title group is display:
              contents there, so its children are ordered with the close button). */}
          <div className="contents md:flex md:flex-nowrap md:items-center md:gap-x-3 md:w-auto">
             <h2 className="font-label order-1 md:order-none text-sm font-semibold text-ink whitespace-nowrap">
                {isEditingCabinOnly ? "Cabin Editor" : isEditingPricingOnly ? "Pricing Editor" : "Route Planner"}
             </h2>
             <span className="hidden md:inline text-muted text-xs font-normal">|</span>
             <div className="order-3 md:order-none flex w-full md:w-auto bg-surface border border-line rounded-sm">
               {!isEditingCabinOnly && !isEditingPricingOnly && [
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
                     className={`flex flex-1 md:flex-none justify-center items-center px-1.5 md:px-3 py-1.5 text-2xs uppercase font-semibold tracking-label md:tracking-label whitespace-nowrap border-0 border-r border-line last:border-0 bg-transparent transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                       isActive ? 'bg-accent/10 text-accent cursor-default' : 
                       isAllowed ? 'text-muted hover:text-ink hover:bg-raised cursor-pointer' : 'text-muted cursor-not-allowed'
                     }`}
                   >
                     {s.label}
                     {isCompleted && <Check size={8} className="ml-1 text-accent" />}
                   </button>
                 )
               })}
             </div>
          </div>
          <div className="order-2 md:order-none ml-auto md:ml-0 flex items-center gap-2">
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
                className="flex items-center gap-1.5 bg-bad/15 border border-bad/50 text-bad px-2.5 py-1 font-semibold uppercase tracking-label text-2xs mr-2"
              >
                <AlertTriangle size={12} className="shrink-0" />
                {validationMsg}
              </div>
            )}
            <button 
               onClick={() => setIsStopoverMode(!isStopoverMode)}
               className={`hidden px-2 py-1 text-2xs uppercase font-semibold tracking-label border transition-all ${isStopoverMode ? 'bg-accent text-on-accent border-transparent' : 'bg-surface text-muted border-line hover:border-rule'}`}
            >
              Stopover
            </button>
            <button onClick={onClose} className="text-muted hover:text-ink uppercase text-2xs tracking-label font-semibold font-label border border-line px-2 py-1 bg-ground/30 hover:border-accent transition-all">
              [X]
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden relative">
        {step === 1 && (
          <div className="w-full flex flex-col flex-1 min-h-0">
            {/* Side by side from lg up, and on a phone held sideways, where a
                stack would leave each panel a sliver of the short screen. */}
            <div className="flex-1 w-full flex flex-col lg:flex-row short:flex-row gap-4 short:gap-2 min-h-0 overflow-y-auto lg:overflow-hidden short:overflow-hidden">
            {/* Origin */}
            <div className="w-full lg:w-1/3 short:w-1/3 short:min-w-0 border border-line flex flex-col h-full bg-ground/40">
              <div className="py-2.5 short:py-1.5 px-3 bg-surface border-b border-line text-center uppercase tracking-label font-semibold text-xs">Origin Hub</div>
              
              {!selectedOrigin ? (
                <div className="p-2.5 flex flex-col flex-1 overflow-hidden">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search Hub..." 
                      className="w-full bg-surface border border-line p-2 pl-9 outline-none text-xs focus:border-accent"
                      value={originSearch}
                      onChange={e => setOriginSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1 bg-ground/20 p-2 border border-line">
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
                            className="p-3 border border-line bg-surface hover:bg-accent/10 hover:border-accent/50 cursor-pointer flex justify-between items-center"
                          >
                            <div>
                              <div className="font-semibold">{a.id}</div>
                              <div className="text-2xs text-muted">{a.name}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className="text-2xs font-mono text-muted">
                                SLOTS: {available}/{totalSlots}
                              </div>
                              <div className="flex gap-2 text-2xs">
                                <span className="text-accent">T: {getAirportStats(a, currentYear).tourism}</span>
                                <span className="text-ink">B: {getAirportStats(a, currentYear).business}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex justify-between items-center bg-surface p-2 border-b border-line shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="text-xl font-semibold text-accent">{selectedOrigin.id}</div>
                      <div className="flex flex-col">
                         <div className="text-2xs text-muted truncate w-32 md:w-auto">{selectedOrigin.name}</div>
                         <div className="flex gap-2 text-2xs uppercase tracking-label font-label text-muted">
                           <span>B:{getAirportStats(selectedOrigin, currentYear).business}</span>
                           <span>T:{getAirportStats(selectedOrigin, currentYear).tourism}</span>
                           <span className={((airportManagement[selectedOrigin.id]?.slots?.regional || 0) + (airportManagement[selectedOrigin.id]?.slots?.narrowbody || 0) + (airportManagement[selectedOrigin.id]?.slots?.widebody || 0)) > 0 ? "text-accent font-semibold" : ""}>S:{Math.max(0, (selectedOrigin.level * 300) - getAiUsedWeeklySlots(selectedOrigin.id)) - ((airportManagement[selectedOrigin.id]?.slots?.regional || 0) + (airportManagement[selectedOrigin.id]?.slots?.narrowbody || 0) + (airportManagement[selectedOrigin.id]?.slots?.widebody || 0))}/{selectedOrigin.level * 300}</span>
                         </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                       <button onClick={() => onGoToAirport?.(selectedOrigin)} className="text-2xs text-muted hover:text-ink py-1.5 px-2 border border-line" title="Go to Airport"><MapIcon size={10} /></button>
                       <button onClick={() => setOriginId(null)} className="text-2xs text-accent py-1.5 px-2 border border-accent/20 hover:bg-accent hover:text-on-accent">CHG</button>
                    </div>
                  </div>
                  {/* Strategic Infrastructure Dashboard */}
                  <div className="flex-1 min-h-0 overflow-y-auto bg-ground/40 p-2.5 flex flex-col gap-4 pb-32 bar:pb-3 short:pb-3">
                     <div className="flex justify-between items-center border-b border-line pb-2">
                        <div className="text-muted text-2xs font-semibold uppercase tracking-label flex items-center gap-2">
                           <MapIcon size={12} /> Strategic Slots
                        </div>
                        <span className="text-2xs text-muted">Stock / cost / action</span>
                     </div>
                     <div className="space-y-2">
                        <InfaRowSmall label="Regional" count={(airportManagement || {})[selectedOrigin.id]?.slots?.regional || 0} used={getUsedWeeklySlots(selectedOrigin.id, 'regional')} cost={getSlotPurchaseCost('regional')} costSuffix=" one-off" onBuy={(n, shift) => handleUpdateInfra(selectedOrigin.id, 'slots', 'regional', n, shift)} />
                        <InfaRowSmall label="Narrowb." count={(airportManagement || {})[selectedOrigin.id]?.slots?.narrowbody || 0} used={getUsedWeeklySlots(selectedOrigin.id, 'narrowbody')} cost={getSlotPurchaseCost('narrowbody')} costSuffix=" one-off" onBuy={(n, shift) => handleUpdateInfra(selectedOrigin.id, 'slots', 'narrowbody', n, shift)} />
                        {originAvail.widebodySlots && <InfaRowSmall label="Widebody" count={(airportManagement || {})[selectedOrigin.id]?.slots?.widebody || 0} used={getUsedWeeklySlots(selectedOrigin.id, 'widebody')} cost={getSlotPurchaseCost('widebody')} costSuffix=" one-off" onBuy={(n, shift) => handleUpdateInfra(selectedOrigin.id, 'slots', 'widebody', n, shift)} />}
                     </div>

                     <div className="flex justify-between items-center border-b border-line pb-2 mt-2">
                        <div className="text-muted text-2xs font-semibold uppercase tracking-label flex items-center gap-2">
                           <Plane size={12} /> Stand Upgrades
                        </div>
                        {(airportManagement[selectedOrigin.id]?.level || 0) < 2 && (
                          <button 
                             onClick={() => onUpdateInfrastructure?.(selectedOrigin.id, { ...airportManagement[selectedOrigin.id], autoBuyStands: !(airportManagement[selectedOrigin.id]?.autoBuyStands) })}
                             className={`text-2xs uppercase tracking-label px-2 py-0.5 border ${airportManagement[selectedOrigin.id]?.autoBuyStands ? 'border-accent text-accent bg-accent/10' : 'border-rule text-muted'}`}
                          >
                             AUTO-BUY: {airportManagement[selectedOrigin.id]?.autoBuyStands ? 'ON' : 'OFF'}
                          </button>
                        )}
                     </div>
                     <div className="space-y-2">
                        {originAvail.stands && <InfaRowSmall label="Narrowb." count={airportManagement[selectedOrigin.id]?.stands?.narrowbody || 0} cost={getStandCost('narrowbody')} disabled={(airportManagement[selectedOrigin.id]?.level || 0) >= 2} onBuy={(n, shift) => handleUpdateInfra(selectedOrigin.id, 'stands', 'narrowbody', n, shift)} />}
                        {originAvail.stands && <InfaRowSmall label="Widebody" count={airportManagement[selectedOrigin.id]?.stands?.widebody || 0} cost={getStandCost('widebody')} disabled={(airportManagement[selectedOrigin.id]?.level || 0) >= 2} onBuy={(n, shift) => handleUpdateInfra(selectedOrigin.id, 'stands', 'widebody', n, shift)} />}
                     </div>

                     <div className="flex justify-between items-center border-b border-line pb-2 mt-2">
                        <div className="text-muted text-2xs font-semibold uppercase tracking-label flex items-center gap-2">
                           <ChevronRight size={12} /> Passenger Processing
                        </div>
                     </div>
                     <div className="space-y-2">
                        <InfaRowSmall label="Normal Desk" count={airportManagement[selectedOrigin.id]?.desks?.normal || 0} disableRemove={(airportManagement[selectedOrigin.id]?.level || 0) >= 1 && (airportManagement[selectedOrigin.id]?.desks?.normal || 0) <= 1} cost={getDeskCost((airportManagement[selectedOrigin.id]?.level || 0) >= 2, 'normal')} onBuy={(n, shift) => handleUpdateInfra(selectedOrigin.id, 'desks', 'normal', n, shift)} />
                        {originAvail.selfCheckIn && <InfaRowSmall label="Self-Check" count={airportManagement[selectedOrigin.id]?.desks?.self || 0} cost={getDeskCost((airportManagement[selectedOrigin.id]?.level || 0) >= 2, 'self')} onBuy={(n, shift) => handleUpdateInfra(selectedOrigin.id, 'desks', 'self', n, shift)} />}
                     </div>
                     {(() => {
                        const sim = originDeskSim;
                        return (
                          <div className="mt-2 text-2xs text-muted space-y-1">
                            <div className="flex justify-between"><span className="uppercase tracking-label flex items-center">Desk Load:<InfoTooltip size={11} {...GLOSSARY.deskLoad} /></span><span className={sim.load > 90 ? 'text-bad font-semibold' : 'text-ink'}>{sim.load.toFixed(1)}%</span></div>
                            <div className="flex justify-between"><span className="uppercase tracking-label">Weekly Seats:</span><span className="text-ink">{formatNumber(sim.myPax)} / {formatNumber(sim.cap)}</span></div>
                            <div className="w-full h-1 bg-surface overflow-hidden"><div className={`h-full ${sim.load > 90 ? 'bg-bad' : 'bg-accent'}`} style={{ width: `${Math.min(100, sim.load)}%` }}></div></div>
                            <div className="flex justify-between"><span className="uppercase tracking-label">SAT Impact:</span><span className={sim.sat < 0 ? 'text-bad font-semibold' : 'text-accent'}>{sim.sat === 0 ? '0.0' : `${sim.sat > 0 ? '+' : ''}${sim.sat.toFixed(1)}`}</span></div>
                          </div>
                        );
                      })()}
                  </div>
                </div>
              )}
            </div>

            {/* Aircraft */}
            <div className="w-full lg:w-1/3 short:w-1/3 short:min-w-0 border-y border-line flex flex-col h-full bg-ground/60 relative z-10 px-2 lg:px-3 short:px-1.5">
              <div className="py-2.5 short:py-1.5 px-3 bg-accent/10 border-b border-accent/20 text-center uppercase tracking-label font-semibold text-muted text-xs">Aircraft Selection</div>
              
              {!selectedAircraft ? (
                <div className="p-2.5 flex flex-col flex-1 overflow-hidden">
                  <button 
                    onClick={() => onOpenCatalog?.(step)}
                    className="w-full h-10 mb-4 bg-surface border border-rule text-muted hover:text-ink hover:bg-raised hover:border-accent transition-all uppercase text-2xs font-semibold tracking-label flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> Buy Aircraft
                  </button>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search Registration or Type..." 
                      className="w-full bg-surface border border-line p-2 pl-9 outline-none text-xs focus:border-accent"
                      value={aircraftSearch}
                      onChange={e => setAircraftSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pb-32 bar:pb-3 short:pb-3">
                     {/* Without this, a player who opens the planner before buying
                         anything -- which both entry points allow -- sees an empty
                         black column and no reason for it. The filter also hides
                         aircraft based at another hub and aircraft too large for
                         either airport, which looked identical to owning none. */}
                     {validAircraft.length === 0 && (
                       <div className="border border-line bg-surface p-4 text-2xs text-muted leading-relaxed space-y-2">
                         {fleet.length === 0 ? (
                           <>
                             <p className="text-muted font-semibold uppercase tracking-label text-2xs">No aircraft yet</p>
                             <p>Your fleet is empty. Visit Buy Aircraft in the sidebar and purchase one first — a route needs an aircraft assigned to it.</p>
                           </>
                         ) : (
                           <>
                             <p className="text-muted font-semibold uppercase tracking-label text-2xs">None of your aircraft fit</p>
                             <p>You own {fleet.length} aircraft, but none can serve this pairing. Usually one of:</p>
                             <ul className="list-disc pl-4 space-y-1 text-muted">
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
                     {shownAircraft.length === 0 && hiddenAircraft.length > 0 && (
                       <div className="border border-line bg-surface p-3 text-2xs text-muted leading-relaxed">
                         All fitting aircraft are hidden. Open Hidden Aircraft below to show them again.
                       </div>
                     )}
                     {shownAircraft.map(ac => renderAircraftCard(ac, false))}
                     {hiddenAircraft.length > 0 && (
                       <div className="border border-line bg-ground/30 mt-3">
                         <button
                           onClick={() => setShowHiddenAircraft(v => !v)}
                           className="w-full flex items-center justify-between px-3 py-2 text-2xs uppercase font-semibold tracking-label text-muted hover:text-ink hover:bg-raised transition-colors"
                         >
                           <span className="flex items-center gap-2"><EyeOff size={12} /> Hidden Aircraft ({hiddenAircraft.length})</span>
                           {showHiddenAircraft ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                         </button>
                         {showHiddenAircraft && (
                           <div className="p-2 space-y-2 border-t border-line">
                             {hiddenAircraft.map(ac => renderAircraftCard(ac, true))}
                           </div>
                         )}
                       </div>
                     )}
                  </div>
                </div>
              ) : (
                  <div className="flex flex-col flex-1 overflow-hidden min-h-0 bg-ground/40">
                    <div className="flex justify-between items-center bg-accent/10 p-2 border-b border-accent/20 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                           <div className="text-base font-semibold text-ink leading-tight">{selectedAircraft.registration}</div>
                           <div className="flex gap-2 text-2xs uppercase tracking-label font-label text-muted">
                             <span className="text-accent">{selectedAircraft.type}</span>
                             <span>{(weeklyUtilization).toFixed(0)}% USE</span>
                             <span className={getPlaneSat(selectedAircraft) < 50 ? 'text-bad' : 'text-accent'}>{getPlaneSat(selectedAircraft)}% SAT</span>
                           </div>
                        </div>
                      </div>
                      <button onClick={() => setSelectedReg(null)} className="text-2xs text-accent py-1.5 px-2 border border-accent/20 hover:bg-accent hover:text-on-accent">CHG</button>
                    </div>
                    
                    <div className="p-4 space-y-4 text-2xs flex-1 overflow-y-auto pb-32 bar:pb-3 short:pb-3">
                       {/* Picture */}
                       <div className="relative w-full aspect-[16/9] max-h-[180px] bg-ground/60 border border-line rounded-sm overflow-hidden">
                          <AircraftImage
                            safeName={aircraftImageName(selectedAircraft)}
                            manufacturer={selectedAircraft.manufacturer}
                            type={selectedAircraft.type}
                            imagesMap={imagesMap}
                          />
                       </div>
                       {/* Config */}
                       <div className="grid grid-cols-4 gap-2 text-center text-2xs">
                          <div className="bg-surface py-2 border border-line rounded-sm"><div className="text-2xs text-muted uppercase mb-1">ECO</div><div className="font-semibold">{selectedAircraft.config?.economy || 0}</div></div>
                          <div className="bg-surface py-2 border border-line rounded-sm"><div className="text-2xs text-muted uppercase mb-1">PRE</div><div className="font-semibold text-accent">{selectedAircraft.config?.premium || 0}</div></div>
                          <div className="bg-surface py-2 border border-line rounded-sm"><div className="text-2xs text-ink uppercase mb-1">BUS</div><div className="font-semibold text-ink">{selectedAircraft.config?.business || 0}</div></div>
                          <div className="bg-surface py-2 border border-line rounded-sm"><div className="text-2xs text-muted uppercase mb-1">FST</div><div className="font-semibold text-accent">{selectedAircraft.config?.first || 0}</div></div>
                       </div>
                       {/* Stats */}
                       <div className="grid grid-cols-2 gap-2 text-2xs">
                          <div className="bg-ground/30 p-2 border border-line rounded-sm flex justify-between items-center"><span className="text-muted uppercase tracking-label">Efficiency</span><span className="font-semibold">{selectedAircraft.efficiency}/100</span></div>
                          <div className="bg-ground/30 p-2 border border-line rounded-sm flex justify-between items-center"><span className="text-muted uppercase tracking-label">Max Range</span><span className="font-semibold">{formatNumber(selectedAircraft.maxRange)} km</span></div>
                          <div className="bg-ground/30 p-2 border border-line rounded-sm flex justify-between items-center"><span className="text-muted uppercase tracking-label">Gen. Cond</span><span className={`font-semibold ${selectedAircraft.conditionGeneral < 50 ? 'text-bad' : 'text-accent'}`}>{Math.floor(selectedAircraft.conditionGeneral)}%</span></div>
                          <div className="bg-ground/30 p-2 border border-line rounded-sm flex justify-between items-center"><span className="text-muted uppercase tracking-label">Int. Cond</span><span className={`font-semibold ${selectedAircraft.conditionInterior < 50 ? 'text-bad' : 'text-accent'}`}>{Math.floor(selectedAircraft.conditionInterior)}%</span></div>
                       </div>
                       {tripCapacity && (
                         <div className="grid grid-cols-2 gap-2 text-2xs">
                            <div className="bg-accent/5 p-2 border border-accent/20 rounded-sm flex justify-between items-center"><span className="text-muted uppercase tracking-label">Trips / week</span><span className="font-semibold text-accent">{tripCapacity.perWeek}</span></div>
                            <div className="bg-accent/5 p-2 border border-accent/20 rounded-sm flex justify-between items-center"><span className="text-muted uppercase tracking-label">Trips / day</span><span className="font-semibold text-accent">{tripCapacity.perDay}</span></div>
                         </div>
                       )}
                    </div>
                  </div>
              )}
            </div>

            {/* Destination */}
            <div className="w-full lg:w-1/3 short:w-1/3 short:min-w-0 border border-line flex flex-col h-full bg-ground/40 relative">
              <div className="py-2.5 short:py-1.5 px-3 bg-surface border-b border-line text-center uppercase tracking-label font-semibold text-xs">Destination</div>
              
              {!selectedDest ? (
                <div className="p-2.5 flex flex-col flex-1 overflow-hidden">
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search Destination..." 
                      className="w-full bg-surface border border-line p-2 pl-9 outline-none text-xs focus:border-accent"
                      value={destSearch}
                      onChange={e => setDestSearch(e.target.value)}
                    />
                  </div>

                  {/* Sorting Buttons */}
                  <div className="flex gap-1 mb-2">
                    {[
                      { id: 'combined', label: 'T+B' },
                      { id: 'tourism', label: 'Tour' },
                      { id: 'business', label: 'Bus' },
                      { id: 'distance', label: 'Dist' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setDestSortBy(opt.id as any)}
                        className={`flex-1 py-1 text-2xs font-semibold uppercase tracking-label border transition-all ${
                          destSortBy === opt.id 
                            ? 'bg-accent border-accent text-on-accent' 
                            : 'bg-surface border-line text-muted hover:border-rule hover:text-ink'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Filters: airports not flown to yet, distance from the origin,
                      and business / tourism demand. Folded by default, since the
                      column is short on a phone held sideways. */}
                  <div className="mb-3 short:mb-2 min-h-0 flex flex-col border border-line bg-surface">
                    <button
                      onClick={() => setDestFiltersOpen(!destFiltersOpen)}
                      aria-expanded={destFiltersOpen}
                      className="w-full shrink-0 flex items-center justify-between px-2 py-1.5 text-2xs font-semibold uppercase tracking-label text-muted hover:text-ink hover:bg-raised transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <SlidersHorizontal size={11} /> Filter
                        {activeDestFilterCount > 0 && (
                          <span className="bg-accent text-on-accent px-1 rounded-sm">{activeDestFilterCount}</span>
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono normal-case text-muted">{validDestinations.length} {validDestinations.length === 1 ? 'airport' : 'airports'}</span>
                        {destFiltersOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </span>
                    </button>
                    {destFiltersOpen && (
                      <div className="min-h-0 overflow-y-auto p-2 border-t border-line space-y-2">
                        <button
                          onClick={() => setDestFilters({ ...destFilters, unservedOnly: !destFilters.unservedOnly })}
                          aria-pressed={destFilters.unservedOnly}
                          title="Hide airports that one of your routes already starts or ends at"
                          className={`w-full py-1 text-2xs font-semibold uppercase tracking-label border transition-all ${
                            destFilters.unservedOnly
                              ? 'bg-accent border-accent text-on-accent'
                              : 'bg-surface border-line text-muted hover:border-rule hover:text-ink'
                          }`}
                        >
                          Not yet served
                        </button>
                        <button
                          onClick={() => setDestFilters({ ...destFilters, reachableOnly: !destFilters.reachableOnly })}
                          aria-pressed={destFilters.reachableOnly}
                          title="Hide airports your airline's rank does not allow yet"
                          className={`w-full py-1 text-2xs font-semibold uppercase tracking-label border transition-all ${
                            destFilters.reachableOnly
                              ? 'bg-accent border-accent text-on-accent'
                              : 'bg-surface border-line text-muted hover:border-rule hover:text-ink'
                          }`}
                        >
                          Rank reachable only
                        </button>
                        {([
                          { key: 'distance', label: 'Distance km', disabled: !selectedOrigin },
                          { key: 'business', label: 'Business', disabled: false },
                          { key: 'tourism', label: 'Tourism', disabled: false }
                        ] as const).map(row => (
                          <div
                            key={row.key}
                            className={`flex items-center gap-1.5 ${row.disabled ? 'opacity-40' : ''}`}
                            title={row.disabled ? 'Choose an origin hub first' : undefined}
                          >
                            <span className="w-20 short:w-14 shrink-0 text-2xs font-semibold uppercase tracking-label text-muted">{row.label}</span>
                            {(['min', 'max'] as const).map((bound, i) => (
                              <React.Fragment key={bound}>
                                {i === 1 && <span className="text-muted">–</span>}
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  placeholder={bound}
                                  aria-label={`${row.label} ${bound}`}
                                  disabled={row.disabled}
                                  value={destFilters[row.key][bound]}
                                  onChange={e => setDestRange(row.key, bound, e.target.value)}
                                  className="w-full min-w-0 bg-surface border border-line p-1 text-2xs outline-none focus:border-accent disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                              </React.Fragment>
                            ))}
                          </div>
                        ))}
                        <button
                          onClick={() => setDestFilters(NO_DESTINATION_FILTERS)}
                          disabled={activeDestFilterCount === 0}
                          className="w-full py-1 flex items-center justify-center gap-1.5 text-2xs font-semibold uppercase tracking-label border border-line text-muted hover:text-ink hover:border-rule transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <RotateCcw size={10} /> Reset filters
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1 bg-ground/20 p-2 border border-line pb-32 bar:pb-3 short:pb-3">
                    {validDestinations.length === 0 && (
                      <div className="p-3 text-2xs text-muted leading-relaxed">
                        No airport matches the search and filters.
                      </div>
                    )}
                    {validDestinations.map(a => {
                      const mgtLvl = airportManagement[a.id]?.level || 0;
                      const totalSlots = a.level * 300;
                      const infra = airportManagement[a.id];
                      const rentedSlots = infra ? (infra.slots.regional + infra.slots.narrowbody + infra.slots.widebody) : 0;
                      const aiSlotsUsed = getAiUsedWeeklySlots(a.id);
                      const availableDestSlots = Math.max(0, totalSlots - rentedSlots - aiSlotsUsed);
                      
                      // Route hints. `routes` holds only the player's routes, each
                      // tagged "My Airline", so comparing with the airline code
                      // counted nothing as yours and your own routes as rivals'.
                      const myRoutesCount = routes.filter(r => r.origin === a.id || r.destination === a.id).length;
                      const compRoutesCount = originId != null ? (rivalRoutesByPair.get(marketKey(originId, a.id)) || 0) : 0;

                      return (
                        <div 
                          key={a.id} 
                          onClick={() => setDestId(a.id)}
                          className="p-3 border border-line bg-surface hover:bg-accent/10 hover:border-accent/50 cursor-pointer flex justify-between items-center group"
                        >
                          <div>
                            <div className="font-semibold flex items-center gap-1">
                              {a.id} 
                              {mgtLvl >= 1 && <span className="text-2xs bg-accent/20 text-accent px-1 rounded-sm">Unlocked</span>}
                              {mgtLvl < 1 && airportLock?.(a) && <span className="text-2xs bg-bad/20 text-bad px-1 rounded-sm" title={airportLock(a) ?? undefined}>RANK</span>}
                            </div>
                            <div className="text-2xs text-muted">{a.name}</div>
                            
                            {/* Simple Hints */}
                            <div className="flex gap-2 mt-1">
                              {myRoutesCount > 0 && (
                                <div className="text-2xs font-semibold text-muted uppercase">
                                  YOU: {myRoutesCount}
                                </div>
                              )}
                              {compRoutesCount > 0 && (
                                <div className="text-2xs font-semibold text-bad uppercase">
                                  COMP: {compRoutesCount}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 text-right">
                             {selectedOrigin && (
                               <div className="text-2xs font-mono text-muted">
                                  {Math.round(calculateDistance(selectedOrigin.coords[0], selectedOrigin.coords[1], a.coords[0], a.coords[1]))} km
                               </div>
                             )}
                             <div className="text-2xs font-mono text-muted">
                                SLOTS: {availableDestSlots}/{totalSlots}
                             </div>
                             <div className="flex gap-2 text-2xs">
                               <span className="text-accent">T: {getAirportStats(a, currentYear).tourism}</span>
                               <span className="text-ink">B: {getAirportStats(a, currentYear).business}</span>
                             </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex justify-between items-center bg-surface p-2 border-b border-line shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="text-xl font-semibold text-accent">{selectedDest.id}</div>
                      <div className="flex flex-col">
                         <div className="text-2xs text-muted truncate w-32 md:w-auto">{selectedDest.name}</div>
                         <div className="flex gap-2 text-2xs uppercase tracking-label font-label text-muted">
                           <span>B:{getAirportStats(selectedDest, currentYear).business}</span>
                           <span>T:{getAirportStats(selectedDest, currentYear).tourism}</span>
                           <span className={((airportManagement[selectedDest.id]?.slots?.regional || 0) + (airportManagement[selectedDest.id]?.slots?.narrowbody || 0) + (airportManagement[selectedDest.id]?.slots?.widebody || 0)) > 0 ? "text-accent font-semibold" : ""}>S:{Math.max(0, (selectedDest.level * 300) - getAiUsedWeeklySlots(selectedDest.id)) - ((airportManagement[selectedDest.id]?.slots?.regional || 0) + (airportManagement[selectedDest.id]?.slots?.narrowbody || 0) + (airportManagement[selectedDest.id]?.slots?.widebody || 0))}/{selectedDest.level * 300}</span>
                         </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                       <button onClick={() => onGoToAirport?.(selectedDest)} className="text-2xs text-muted hover:text-ink py-1.5 px-2 border border-line" title="Go to Airport"><MapIcon size={10} /></button>
                       <button onClick={() => setDestId(null)} className="text-2xs text-accent py-1.5 px-2 border border-accent/20 hover:bg-accent hover:text-on-accent">CHG</button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto bg-ground/40 p-2.5 flex flex-col gap-4 pb-32 bar:pb-3 short:pb-3">
                  {selectedOrigin && selectedDest && (
                    <div className="mb-2 p-3 border border-accent/20 bg-accent/5 rounded-sm">
                      <div 
                        className={`flex justify-between items-center ${debugMode ? 'cursor-pointer' : ''}`}
                        onClick={() => debugMode && setShowDemandDebug(!showDemandDebug)}
                      >
                        <div className="text-muted text-2xs font-semibold uppercase tracking-label flex items-center gap-1.5">
                          <Search size={12} /> Demand Forecast {debugMode && <span className="text-2xs bg-accent/20 px-1 py-0.5 rounded-sm text-accent ml-1">Debug</span>}
                        </div>
                        <div className="text-ink font-mono text-xs font-semibold">
                          {demandPreview ? `${formatNumber(demandPreview.d.total)} / WK MARKET` : ''}
                        </div>
                      </div>
                      {demandPreview?.assumedAircraft && (
                        <div className="text-2xs text-muted uppercase tracking-label mt-1">Flight time assumed at 800 km/h until an aircraft is chosen</div>
                      )}

                      {showDemandDebug && debugMode && demandPreview && (
                        <div className="mt-4 pt-4 border-t border-line space-y-2 text-2xs text-muted bg-ground/60 p-4 rounded-sm">
                          {(() => {
                             const { d, tc, basePrices } = demandPreview;
                             return (
                               <>
                                 <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
                                   <div><span className="text-muted">b1 (Orig Bus):</span> <span className="text-ink">{d.formulaVars.b1}</span></div>
                                   <div><span className="text-muted">t1 (Orig Tou):</span> <span className="text-accent">{d.formulaVars.t1}</span></div>
                                   <div><span className="text-muted">b2 (Dest Bus):</span> <span className="text-ink">{d.formulaVars.b2}</span></div>
                                   <div><span className="text-muted">t2 (Dest Tou):</span> <span className="text-accent">{d.formulaVars.t2}</span></div>
                                   <div><span className="text-muted">Time Class:</span> <span className="text-ink">{tc}</span></div>
                                   <div><span className="text-muted">Business Ratio:</span> <span className="text-ink">{(d.formulaVars.businessRatio * 100).toFixed(1)}%</span></div>
                                   <div><span className="text-muted">Mv (Month {currentMonth}):</span> <span className="text-accent">{d.formulaVars.Mv}</span></div>
                                   <div><span className="text-muted">S (Diff {difficulty}):</span> <span className="text-accent">{d.formulaVars.S}</span></div>
                                 </div>
                                 <div className="text-muted mb-2 pb-2 border-b border-line">
                                   Demand = 29.00 &times; Interaction^0.448 &times; S {d.formulaVars.S} &times; era {formatNumber(d.formulaVars.eraFactor, 2)} &times; time class {formatNumber(d.formulaVars.tcDemandMultiplier, 2)} &times; events {formatNumber(d.formulaVars.eventMult, 2)} &times; your factor {formatNumber(d.formulaVars.extraDemandFactor, 2)}
                                   <br />
                                   Interaction: {formatNumber(d.formulaVars.totalInteraction)}
                                 </div>
                                 <div className="flex justify-between items-center text-accent">
                                   <span>Economy:</span> <span>{formatNumber(d.economy)} | BASE: ${basePrices.economy}</span>
                                 </div>
                                 <div className="flex justify-between items-center text-accent">
                                   <span>Premium:</span> <span>{formatNumber(d.premium)} | BASE: ${basePrices.premium}</span>
                                 </div>
                                 <div className="flex justify-between items-center text-ink">
                                   <span>Business:</span> <span>{formatNumber(d.business)} | BASE: ${basePrices.business}</span>
                                 </div>
                                 <div className="flex justify-between items-center text-ink font-semibold border-b border-line pb-1 mb-1">
                                   <span>First:</span> <span>{formatNumber(d.first)} | BASE: ${basePrices.first}</span>
                                 </div>
                                 <div className="flex justify-between items-center text-ink font-semibold text-sm pt-1">
                                   <span>MARKET DEMAND / WK (all airlines):</span> <span>{formatNumber(d.total)}</span>
                                 </div>
                               </>
                             );
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  {destMgtLvl < 1 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 border border-line bg-surface text-center">
                       <div className="text-bad font-semibold mb-2 uppercase tracking-label">Destination Locked</div>
                       <p className="text-xs text-muted mb-3">You must unlock T1 Management at {selectedDest.id} to fly there.</p>
                       {airportLock?.(selectedDest) && (
                         <p className="text-xs text-bad mb-3 max-w-sm leading-relaxed">{airportLock(selectedDest)}</p>
                       )}
                       <button
                         onClick={() => onUnlockManagement?.(selectedDest.id, 1)}
                         disabled={!!airportLock?.(selectedDest)}
                         className="px-3 py-3 bg-raised text-ink font-semibold text-sm hover:bg-raised transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                       >
                         Unlock T1 ({formatCurrency(getManagementUnlockCost(selectedDest.level, 1))})
                       </button>
                    </div>
                  ) : (
                    /* Strategic Infrastructure Dashboard */
                    <div className="flex flex-col gap-4 mt-2 pb-16 bar:pb-3 short:pb-3">
                       <div className="flex justify-between items-center border-b border-line pb-2">
                          <div className="text-muted text-2xs font-semibold uppercase tracking-label flex items-center gap-2">
                             <MapIcon size={12} /> Strategic Slots
                          </div>
                          <span className="text-2xs text-muted">Stock / cost / action</span>
                       </div>
                       <div className="space-y-2">
                          <InfaRowSmall label="Regional" count={(airportManagement || {})[selectedDest.id]?.slots?.regional || 0} used={getUsedWeeklySlots(selectedDest.id, 'regional')} cost={getSlotPurchaseCost('regional')} costSuffix=" one-off" onBuy={(n, shift) => handleUpdateInfra(selectedDest.id, 'slots', 'regional', n, shift)} />
                          <InfaRowSmall label="Narrowb." count={(airportManagement || {})[selectedDest.id]?.slots?.narrowbody || 0} used={getUsedWeeklySlots(selectedDest.id, 'narrowbody')} cost={getSlotPurchaseCost('narrowbody')} costSuffix=" one-off" onBuy={(n, shift) => handleUpdateInfra(selectedDest.id, 'slots', 'narrowbody', n, shift)} />
                          {destAvail.widebodySlots && <InfaRowSmall label="Widebody" count={(airportManagement || {})[selectedDest.id]?.slots?.widebody || 0} used={getUsedWeeklySlots(selectedDest.id, 'widebody')} cost={getSlotPurchaseCost('widebody')} costSuffix=" one-off" onBuy={(n, shift) => handleUpdateInfra(selectedDest.id, 'slots', 'widebody', n, shift)} />}
                       </div>

                       <div className="flex justify-between items-center border-b border-line pb-2 mt-2">
                          <div className="text-muted text-2xs font-semibold uppercase tracking-label flex items-center gap-2">
                             <Plane size={12} /> Stand Upgrades
                          </div>
                          {(airportManagement[selectedDest.id]?.level || 0) < 2 && (
                            <button 
                               onClick={() => onUpdateInfrastructure?.(selectedDest.id, { ...airportManagement[selectedDest.id], autoBuyStands: !(airportManagement[selectedDest.id]?.autoBuyStands) })}
                               className={`text-2xs uppercase tracking-label px-2 py-0.5 border ${airportManagement[selectedDest.id]?.autoBuyStands ? 'border-accent text-accent bg-accent/10' : 'border-rule text-muted'}`}
                            >
                               AUTO-BUY: {airportManagement[selectedDest.id]?.autoBuyStands ? 'ON' : 'OFF'}
                            </button>
                          )}
                       </div>
                       <div className="space-y-2">
                          {destAvail.stands && <InfaRowSmall label="Narrowb." count={airportManagement[selectedDest.id]?.stands?.narrowbody || 0} cost={(airportManagement[selectedDest.id]?.level || 0) >= 2 ? 0 : getStandCost('narrowbody')} disabled={(airportManagement[selectedDest.id]?.level || 0) >= 2} onBuy={(n, shift) => handleUpdateInfra(selectedDest.id, 'stands', 'narrowbody', n, shift)} />}
                          {destAvail.stands && <InfaRowSmall label="Widebody" count={airportManagement[selectedDest.id]?.stands?.widebody || 0} cost={(airportManagement[selectedDest.id]?.level || 0) >= 2 ? 0 : getStandCost('widebody')} disabled={(airportManagement[selectedDest.id]?.level || 0) >= 2} onBuy={(n, shift) => handleUpdateInfra(selectedDest.id, 'stands', 'widebody', n, shift)} />}
                       </div>

                       <div className="flex justify-between items-center border-b border-line pb-2 mt-2">
                          <div className="text-muted text-2xs font-semibold uppercase tracking-label flex items-center gap-2">
                             <ChevronRight size={12} /> Passenger Processing
                          </div>
                       </div>
                       <div className="space-y-2">
                          <InfaRowSmall label="Normal Desk" count={airportManagement[selectedDest.id]?.desks?.normal || 0} disableRemove={(airportManagement[selectedDest.id]?.level || 0) >= 1 && (airportManagement[selectedDest.id]?.desks?.normal || 0) <= 1} cost={getDeskCost((airportManagement[selectedDest.id]?.level || 0) >= 2, 'normal')} onBuy={(n, shift) => handleUpdateInfra(selectedDest.id, 'desks', 'normal', n, shift)} />
                          {destAvail.selfCheckIn && <InfaRowSmall label="Self-Check" count={airportManagement[selectedDest.id]?.desks?.self || 0} cost={getDeskCost((airportManagement[selectedDest.id]?.level || 0) >= 2, 'self')} onBuy={(n, shift) => handleUpdateInfra(selectedDest.id, 'desks', 'self', n, shift)} />}
                       </div>
                       {(() => {
                           const sim = destDeskSim;
                           return (
                             <div className="mt-2 text-2xs text-muted space-y-1">
                               <div className="flex justify-between"><span className="uppercase tracking-label flex items-center">Desk Load:<InfoTooltip size={11} {...GLOSSARY.deskLoad} /></span><span className={sim.load > 90 ? 'text-bad font-semibold' : 'text-ink'}>{sim.load.toFixed(1)}%</span></div>
                               <div className="flex justify-between"><span className="uppercase tracking-label">Weekly Seats:</span><span className="text-ink">{formatNumber(sim.myPax)} / {formatNumber(sim.cap)}</span></div>
                               <div className="w-full h-1 bg-surface overflow-hidden"><div className={`h-full ${sim.load > 90 ? 'bg-bad' : 'bg-accent'}`} style={{ width: `${Math.min(100, sim.load)}%` }}></div></div>
                               <div className="flex justify-between"><span className="uppercase tracking-label">SAT Impact:</span><span className={sim.sat < 0 ? 'text-bad font-semibold' : 'text-accent'}>{sim.sat === 0 ? '0.0' : `${sim.sat > 0 ? '+' : ''}${sim.sat.toFixed(1)}`}</span></div>
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

          {/* Step 1 Snug Footer Action Bar. The step buttons are flatter on a
              phone held sideways (short:py-2), where height is scarce. */}
          <div className="p-4 bar:p-2 short:p-2 tiny:p-1.5 mt-3 bar:mt-2 short:mt-2 tiny:mt-1 border border-line bg-surface flex shrink-0 rounded-sm w-full">
             <div className="flex gap-4 w-full">
                <button onClick={onClose} className="flex-1 py-4 bar:py-2.5 short:py-2 tiny:py-1.5 tiny:text-xs border border-rule text-muted font-semibold text-sm py-4 px-6 rounded-sm hover:text-ink hover:bg-raised transition-all">Cancel</button>
                <button 
                  disabled={!selectedOrigin || !selectedAircraft || !selectedDest || (destMgtLvl < 1)}
                  onClick={() => setStep(2)} 
                  className="flex-[2] py-4 bar:py-2.5 short:py-2 tiny:py-1.5 tiny:text-xs bg-accent text-on-accent font-semibold text-sm hover:bg-ink hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans flex items-center justify-center gap-2"
                >
                  Next Step: Timetable <ChevronRight size={16} />
                </button>
             </div>
          </div>
        </div>
      )}

        {step === 2 && selectedOrigin && selectedDest && selectedAircraft && (
          /* Phones: the form above the timetable, scrolling together; the
             timetable keeps its own scroll area at most of the screen height. */
          <div className="w-full flex flex-col md:flex-row gap-4 h-full overflow-y-auto md:overflow-visible">
            {/* Left Column: Form */}
            <div className="w-full md:w-80 shrink-0 border border-line bg-ground/40 flex flex-col md:overflow-y-auto">
              <div className="p-4 bg-accent/10 border-b border-accent/20 text-center font-semibold text-accent text-sm">Timetable Configuration</div>
              
              <div className="p-4 space-y-8">
                {/* Slot Status */}
                <div className="bg-surface border border-line p-4 space-y-2 mb-2 rounded-sm border-t-2 border-t-accent">
                   <div className="text-2xs uppercase font-semibold tracking-label text-muted mb-2 flex justify-between">
                     <span>Required Slots</span>
                     <span>({selectedAircraft.class})</span>
                   </div>
                   <div className="flex justify-between text-xs text-muted">
                     <span>{selectedOrigin.id}</span>
                     <span className={getUsedWeeklySlots(selectedOrigin.id, selectedAircraft.class, initialRouteId) + schedule.length > (airportManagement[selectedOrigin.id]?.slots?.[selectedAircraft.class.toLowerCase() as 'regional' | 'narrowbody' | 'widebody'] || 0) ? 'text-bad' : 'text-accent font-semibold'}>
                        {getUsedWeeklySlots(selectedOrigin.id, selectedAircraft.class, initialRouteId) + schedule.length} / {airportManagement[selectedOrigin.id]?.slots?.[selectedAircraft.class.toLowerCase() as 'regional' | 'narrowbody' | 'widebody'] || 0}
                     </span>
                   </div>
                   <div className="flex justify-between text-xs text-muted">
                     <span>{selectedDest.id}</span>
                     <span className={getUsedWeeklySlots(selectedDest.id, selectedAircraft.class, initialRouteId) + schedule.length > (airportManagement[selectedDest.id]?.slots?.[selectedAircraft.class.toLowerCase() as 'regional' | 'narrowbody' | 'widebody'] || 0) ? 'text-bad' : 'text-accent font-semibold'}>
                        {getUsedWeeklySlots(selectedDest.id, selectedAircraft.class, initialRouteId) + schedule.length} / {airportManagement[selectedDest.id]?.slots?.[selectedAircraft.class.toLowerCase() as 'regional' | 'narrowbody' | 'widebody'] || 0}
                     </span>
                   </div>
                </div>

                {/* Flight Number */}
                <div className="flex gap-2">
                  <div className="flex flex-col flex-[0.8] min-w-0">
                    <label className="block text-2xs uppercase tracking-label text-muted mb-2 font-semibold">
                       Code
                    </label>
                    <div className="h-10 bg-surface border border-line font-semibold text-muted text-center select-none uppercase tracking-label flex items-center justify-center truncate px-1">{airlineCode}</div>
                  </div>
                  <div className="flex flex-col flex-1">
                    <label className="block text-2xs uppercase tracking-label text-muted mb-2 font-semibold">Flight Out</label>
                    <input
                      type="text"
                      value={flightNumberOutbound}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setFlightNumberOutbound(val);
                        // An empty field used to produce "NaN" here and on every flight.
                        setFlightNumberInbound(val ? (parseInt(val, 10) + 1).toString() : "");
                      }}
                      className="h-10 w-full bg-surface border border-line px-1 outline-none focus:border-accent text-sm text-center"
                      placeholder="Out"
                    />
                  </div>
                  <div className="flex flex-col flex-1">
                    <label className="block text-2xs uppercase tracking-label text-muted mb-2 font-semibold">Flight In</label>
                    <input
                      type="text"
                      value={flightNumberInbound}
                      onChange={e => setFlightNumberInbound(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="h-10 w-full bg-surface border border-line px-1 outline-none focus:border-accent text-sm text-center"
                      placeholder="In"
                    />
                  </div>
                  <div className="flex flex-col flex-[0.8]">
                    <label className="block text-2xs uppercase tracking-label text-transparent mb-2 font-semibold select-none">Action</label>
                    <button
                      onClick={generateFlightNumber}
                      className="h-10 bg-surface hover:bg-raised border border-line transition-colors uppercase tracking-label text-2xs font-semibold text-center text-muted hover:text-ink leading-tight flex items-center justify-center"
                    >
                      RANDOM
                    </button>
                  </div>
                </div>

                <div>
                  {/* Inline settings */}
                  <div className={`flex items-center justify-between bg-ground/40 border border-line p-2 mb-2 transition-opacity ${schedule.length > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center gap-2">
                       <label className="text-2xs font-semibold uppercase tracking-label text-muted">Multiple Ops:</label>
                       <div className="flex items-center gap-1">
                         <button 
                           onClick={() => setMultipleOps(Math.max(1, multipleOps - 1))} 
                           className="w-5 h-5 flex items-center justify-center bg-surface border border-line text-ink hover:border-accent"
                         >
                           <Minus className="w-2 h-2" />
                         </button>
                         <div className="w-6 h-5 flex items-center justify-center bg-ground border border-rule text-2xs text-accent font-semibold">
                           {Math.min(multipleOps, maxMultipleOps)}
                         </div>
                         <button
                           onClick={() => setMultipleOps(Math.min(maxMultipleOps, multipleOps + 1))}
                           disabled={multipleOps >= maxMultipleOps}
                           className="w-5 h-5 flex items-center justify-center bg-surface border border-line text-ink hover:border-accent disabled:opacity-20"
                         >
                           <Plus className="w-2 h-2" />
                         </button>
                       </div>
                    </div>
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setMaximizeFlights(!maximizeFlights)}>
                       <span className="text-2xs font-semibold uppercase tracking-label text-muted hover:text-ink transition-colors">Max Flights</span>
                       <div className={`w-4 h-4 border flex items-center justify-center transition-all ${maximizeFlights ? 'bg-accent border-accent text-on-accent' : 'border-rule'}`}>
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
                          
                          const currentOriginUsed = getUsedWeeklySlots(selectedOrigin.id, aircraftClass, initialRouteId);
                          const currentDestUsed = getUsedWeeklySlots(selectedDest.id, aircraftClass, initialRouteId);
                          
                          let remainingSlots = Math.min(originCap - currentOriginUsed, destCap - currentDestUsed);

                          const durMin = getFlightDurationMinutes();
                          const turnMin = getTurnoverMinutes();
                          const totalDurRaw = rawBlockMinutes({ durMin, turnoverMin: turnMin });
                          const cycleMin = Math.ceil(totalDurRaw / 5) * 5;
                          
                          const newTrips: ScheduledTrip[] = [];

                          const existingAircraftRoutes = routes.filter(r => r.aircraft === selectedAircraft.registration && r.id !== initialRouteId);
                          const occupied = existingAircraftRoutes.flatMap(r => r.schedule?.map(s => {
                            const c = blockMinutes(s);
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
                              // Same search as before, but O(1) per conflict check;
                              // the old loop froze the UI for a busy aircraft.
                              ({ bestCount, bestStartTimes } = findMaxFlightStarts(occupied, cycleMin, remainingSlots));
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
                                    flightNumOut: (flightNumberBase(flightNumberOutbound, 1000) + (addedOffset * 2)).toString(),
                                    flightNumIn: (flightNumberBase(flightNumberInbound, 1001) + (addedOffset * 2)).toString(),
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
                                  const c = rawBlockMinutes(s);
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
                                    const exCycle = blockMinutes(s);
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
                                  flightNumOut: (flightNumberBase(flightNumberOutbound, 1000) + (i * 2)).toString(),
                                  flightNumIn: (flightNumberBase(flightNumberInbound, 1001) + (i * 2)).toString(),
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
                      className={`flex-1 h-8 text-2xs uppercase font-semibold border transition-colors px-2 py-0.5 ${schedule.length > 0 ? 'border-line text-accent hover:bg-raised hover:text-ink' : 'bg-accent border-accent text-on-accent hover:bg-accent/80'}`}
                    >
                      {schedule.length > 0 ? 'Clear All' : (maximizeFlights ? 'Apply' : 'Select All')}
                    </button>
                  </div>

                  <div className={`grid grid-cols-7 gap-1 mt-4 transition-opacity ${maximizeFlights ? 'opacity-30 pointer-events-none' : ''}`}>
                    {daysOfWeek.map(day => {
                      const isSelected = schedule.some(s => s.dayId === day.id);
                      return (
                        <button
                          key={day.id}
                          disabled={maximizeFlights}
                          onClick={() => handleToggleDay(day.id)}
                          className={`h-9 flex flex-col items-center justify-center border font-semibold transition-all rounded-sm gap-0.5 ${isSelected ? 'bg-accent text-on-accent border-accent' : 'bg-ground/40 text-muted border-line hover:border-rule hover:text-ink'}`}
                        >
                          <span className="text-2xs leading-none">{day.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Time Selection */}
                <div>
                  <label className="block text-xs uppercase tracking-label text-muted mb-2 font-semibold">Starting Time</label>
                  <div className={`flex items-center justify-center gap-2 bg-ground/60 border border-line p-2 font-mono rounded-sm transition-all ${maximizeFlights ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                    <div className="flex flex-col items-center">
                      <button onClick={() => handleClockChange(60)} className="p-0.5 text-muted hover:text-accent hover:scale-125 transition-all text-xs leading-none">▲</button>
                      <div className="text-2xl font-semibold">{maximizeFlights ? '--' : flightHour.toString().padStart(2, '0')}</div>
                      <button onClick={() => handleClockChange(-60)} className="p-0.5 text-muted hover:text-accent hover:scale-125 transition-all text-xs leading-none">▼</button>
                    </div>
                    <div className="text-xl text-muted mb-1 shrink-0">:</div>
                    <div className="flex flex-col items-center">
                      <button onClick={() => handleClockChange(5)} className="p-0.5 text-muted hover:text-accent hover:scale-125 transition-all text-xs leading-none">▲</button>
                      <div className="text-2xl font-semibold">{maximizeFlights ? '--' : flightMinute.toString().padStart(2, '0')}</div>
                      <button onClick={() => handleClockChange(-5)} className="p-0.5 text-muted hover:text-accent hover:scale-125 transition-all text-xs leading-none">▼</button>
                    </div>
                  </div>
                </div>

                {/* Flightplan Details output */}
                <div className="bg-surface border border-line p-4 space-y-2 text-xs">
                    <div className="text-2xs uppercase tracking-label font-semibold text-muted border-b border-line pb-2 mb-2 font-sans">Flightplan</div>
                    
                    {(() => {
                      if (schedule.length === 0) {
                        return <div className="text-muted pb-2 text-2xs">No flights scheduled.</div>;
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
                          <div className="grid grid-cols-[1fr,auto] gap-x-4 gap-y-1 max-h-64 overflow-y-auto pr-2">
                             <span className="text-muted uppercase text-2xs font-semibold">Operation</span>
                             <span className="text-muted uppercase text-2xs font-semibold text-right">Schedule</span>
                             
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
                                      <span className="text-accent font-semibold text-2xs">{airlineCode}{s.flightNumOut}</span>
                                      <span className="text-2xs text-muted">{selectedOrigin.id} → {selectedDest.id}</span>
                                      <span className="text-2xs text-muted mt-0.5">{daysStr}</span>
                                    </div>
                                    <span className="text-ink font-mono text-2xs text-right">{dep1} → {arr1}</span>
                                    
                                    {!(s as any).isOneWay && (
                                      <>
                                        <div className="flex flex-col">
                                          <span className="text-accent font-semibold text-2xs opacity-70">{airlineCode}{s.flightNumIn}</span>
                                          <span className="text-2xs text-muted opacity-70">{selectedDest.id} → {selectedOrigin.id}</span>
                                        </div>
                                        <span className="text-ink font-mono text-2xs text-right opacity-70">{dep2} → {arr2}</span>
                                       </>
                                     )}
                                     <div className="col-span-2 h-[1px] bg-surface my-1"></div>
          </React.Fragment>
                               );
                             })}
                          </div>
                          
                          <div className="flex justify-between font-semibold text-muted font-sans text-2xs uppercase tracking-label">
                            <span>Total Flights:</span>
                            <span className="text-ink">{schedule.length} ({schedule.length * (schedule[0]?.isOneWay ? 1 : 2)} Legs)</span>
                          </div>
                        </div>
                      );
                    })()}
                </div>
              </div>
            </div>

            {/* Right Column: Timetable */}
            <div className="flex-none md:flex-1 h-[75dvh] md:h-auto border border-line bg-ground/60 flex flex-col overflow-hidden relative">
              
              {/* Header Days */}
              <div className="flex shrink-0 z-30">
                <div className="w-14 border-r border-line bg-ground"></div>
                <div className="flex-1 flex border-b border-rule">
                   {daysOfWeek.map(day => (
                      <div key={day.id} className="flex-1 text-center text-2xs uppercase font-semibold text-muted py-3 bg-ground relative">
                        {day.label}
                      </div>
                   ))}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-auto flex relative bg-ground/40 pt-7">
                {/* Time Indicators */}
                <div className="w-16 shrink-0 border-r border-rule relative bg-ground/95 z-20">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="h-[30px] text-2xs text-muted text-right pr-2 flex items-start justify-end relative group">
                      {/* Hour mark (Full line) */}
                      <div className="w-4 h-[1px] bg-rule absolute right-0 top-0"></div>
                      
                      {i % 2 === 0 ? (
                        <span className="absolute font-semibold text-accent top-0 -translate-y-1/2 mr-[-4px] transition-all hover:scale-110 z-30">
                          {i.toString().padStart(2, '0')}:00
                        </span>
                      ) : (
                        <span className="opacity-0 group-hover:opacity-100 absolute font-semibold text-muted top-0 -translate-y-1/2 mr-[-4px] text-2xs z-30 transition-all">
                          {i.toString().padStart(2, '0')}:00
                        </span>
                      )}
                      
                      {/* Half hour tick (Single tick) */}
                      <div className="absolute top-1/2 right-0 w-2 h-[1px] bg-raised"></div>
                    </div>
                  ))}
                  <div className="h-0 text-2xs text-muted text-right pr-2 flex items-start justify-end relative">
                    <span className="absolute font-semibold text-accent top-0 -translate-y-1/2 mr-[-4px] z-30">
                      24:00
                    </span>
                    <div className="w-4 h-[1px] bg-rule absolute right-0 top-0"></div>
                  </div>
                </div>

                {/* No minimum width on phones, upright or sideways: the day headers
                    above do not scroll sideways, so seven narrow columns stay
                    aligned with them. */}
                <div className="flex-1 flex md:min-w-[700px] short:min-w-0">
                  {daysOfWeek.map(day => (
                    <div key={day.id} className="flex-1 min-w-0 border-r border-line relative">
                       <div className="relative h-[720px] border-y border-accent/30"> {/* 24 * 30px */}
                          <div className="absolute inset-0 grid grid-rows-[repeat(24,minmax(0,1fr))] pointer-events-none opacity-20">
                            {Array.from({ length: 24 }).map((_, i) => (
                              <div key={i} className="border-b border-line flex flex-col">
                                <div className="flex-1 border-b border-line border-dashed"></div>
                                <div className="flex-1"></div>
                              </div>
                            ))}
                          </div>
                          
                          {allBlocks.filter(b => b.dayId === day.id).map(b => {
                              const startAbs = Math.round(b.s.startHour * 60 + b.s.startMin);
                              const totalDurRaw = rawBlockMinutes(b.s);
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
                                  onPointerDown={!b.isBusy ? (e) => handleDragStart(e, b.s) : undefined}
                                  className={`absolute left-0.5 right-0.5 p-1 px-1.5 text-2xs font-mono z-10 flex flex-col overflow-hidden transition-all ${
                                    b.isBusy 
                                      ? 'bg-raised border-l-2 border-rule cursor-default grayscale opacity-60' 
                                      : 'bg-accent/30 border-l-2 border-accent cursor-ns-resize touch-none hover:bg-accent/40 hover:scale-[1.01] hover:z-20'
                                  }`}
                                  style={{ top: b.top, height: b.height, zIndex: b.isBusy ? 5 : 10 }}
                                >
                                   <div className="flex flex-col h-full relative">
                                     {b.isFirst && (
                                       <div className="text-ink font-semibold absolute top-[-2px] left-0 bg-ground/80 px-1 py-0.5 rounded-sm z-20 text-2xs border border-line leading-none">
                                         {formatT(startAbs)}
                                       </div>
                                     )}
                                     
                                     <div className={`font-semibold leading-none truncate ${b.isBusy ? 'text-muted' : 'text-accent'} ${b.isFirst ? 'mt-4 mb-1 text-2xs' : 'mb-0.5 text-2xs'}`}>
                                       {b.isBusy ? (b.s.isOneWay ? `${airlineCode}${b.s.flightNumOut}` : `${airlineCode}${b.s.flightNumOut} & ${airlineCode}${b.s.flightNumIn}`) : (b.s.isOneWay ? `${airlineCode}${b.s.flightNumOut}` : `${airlineCode}${b.s.flightNumOut} & ${airlineCode}${b.s.flightNumIn}`)}
                                     </div>
                                     
                                     <div className={`font-semibold leading-none truncate ${b.isBusy ? 'text-muted' : 'text-ink'} ${b.isFirst ? 'mb-1 text-2xs' : 'text-2xs'}`}>
                                       {b.orig} {b.s.isOneWay ? '→' : '⇄'} {b.dest}
                                     </div>
                                     
                                     {b.isLast && (
                                       <div className="mt-auto text-ink font-semibold text-right bg-ground/80 px-1 py-0.5 rounded-sm self-end text-2xs border border-line leading-none">
                                         {formatT(endAbs)}
                                       </div>
                                     )}
                                     
                                     {!b.isLast && (
                                       <div className="mt-auto text-muted text-2xs font-semibold uppercase truncate">Cont...</div>
                                     )}
                                     
                                     {b.isContinues && !b.isFirst && (
                                       <div className="absolute top-0 right-0 text-muted text-2xs font-semibold uppercase">Part 2</div>
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
              
              <div className="p-4 bar:p-2 short:p-2 tiny:p-1.5 border-t border-line bg-surface flex gap-4 shrink-0 rounded-sm w-full">
                  {!initialRouteId && (
                    <button onClick={() => setStep(1)} className="flex-1 py-4 bar:py-2.5 short:py-2 tiny:py-1.5 tiny:text-xs border border-rule text-muted font-semibold text-sm px-6 rounded-sm hover:text-ink hover:bg-raised transition-all">Back</button>
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
                          classConfigs: classConfigs
                        };
                        // Priced as stored: it keeps the route's current fares,
                        // which the draft does not.
                        const stored = priceInNetwork(routeData) ?? saveFinancials;
                        onSaveRoute({ ...routeData, ...(stored ? toStoredRouteMetrics(stored) : {}) });
                        setShowSuccess(true);
                        later(() => {
                          setShowSuccess(false);
                          setIsFinalizing(false);
                          onClose();
                        }, 2000);
                      }} 
                      className="flex-[2] py-4 bar:py-2.5 short:py-2 tiny:py-1.5 tiny:text-xs bg-accent text-on-accent font-semibold text-sm hover:bg-ink transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans flex items-center justify-center gap-2"
                    >
                      {isFinalizing ? 'Saving...' : 'Save Changes'} <Check size={16} />
                    </button>
                  ) : (
                    <button 
                      onClick={() => setStep(3)} 
                      disabled={schedule.length === 0}
                      className="flex-[2] py-4 bar:py-2.5 short:py-2 tiny:py-1.5 tiny:text-xs bg-accent text-on-accent font-semibold text-sm hover:bg-ink hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans flex items-center justify-center gap-2"
                    >
                      Proceed to Cabin Services <ChevronRight size={16} />
                    </button>
                  )}
              </div>
            </div>
          </div>
        )}


        {step === 3 && selectedOrigin && selectedDest && selectedAircraft && classSat && (() => {
          const planeSat = getPlaneSat(selectedAircraft);
          const details = classSat.satisfactionDetails;
          // Seat-weighted over the classes the aircraft actually has, as passengers are.
          const weighted = (pick: (d: any) => number) => seatWeightedSatisfaction(
            Object.fromEntries(Object.entries(details).map(([c, d]) => [c, pick(d)])),
            selectedAircraft.config
          );
          // The stand bonus depends on the two airports and the aircraft, not the class.
          const standBonus = (Object.values(details)[0] as any)?.standBonus ?? 0;
          const signed = (v: number, digits = 0) => `${v > 0 ? '+' : ''}${formatNumber(v, digits)}`;

          return (
          <div className="flex-1 w-full flex flex-col min-h-0 overflow-y-auto animate-appear fade-in duration-500 bg-ground/25">
             <div className="flex-1 w-full max-w-[1800px] mx-auto p-4 flex flex-col lg:flex-row gap-4">
                {/* Left Area: Class Selection Boxes */}
                <div className="flex-1 flex flex-col gap-3">
                   {/* Upright phones: the Load/Save buttons drop below the heading. */}
                   <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-0 bg-surface border border-line p-4 rounded-sm">
                      <div className="flex flex-col">
                         <h3 className="font-label text-2xl font-semibold text-ink leading-none">In-Flight Configuration</h3>
                         <span className="text-2xs text-muted uppercase tracking-label mt-2 block">Select a category to customize service levels. Use "General" to apply settings to all classes simultaneously.</span>
                      </div>
                      <div className="flex gap-2 shrink-0 md:shrink">
                        <button 
                          onClick={() => setShowConfigLoadModal(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-surface border border-line text-muted hover:text-ink hover:bg-raised hover:border-accent transition-all uppercase text-2xs font-semibold tracking-label"
                        >
                          <FolderOpen size={14} /> Load Config
                        </button>
                        <button 
                          onClick={() => setShowConfigSaveModal(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-accent text-on-accent hover:bg-ink hover:scale-105 transition-all uppercase text-2xs font-semibold tracking-label"
                        >
                          <Save size={14} /> Save Config
                        </button>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                      {['general', 'economy', 'premium', 'business', 'first'].map((c) => {
                         const seats = c === 'general' ? 0 : (selectedAircraft.config?.[c as keyof typeof selectedAircraft.config] as number || 0);
                         if (c !== 'general' && seats <= 0) return null;

                          const config = classConfigFor(classConfigs, c);
                          const sd = c === 'general' ? null : details[c];
                          const displaySatVal = sd ? sd.satisfactionPercentage : weighted(d => d.satisfactionPercentage);
                          const serviceQuality = sd ? sd.softProduct : weighted(d => d.softProduct);

                          return (
                             <div 
                               key={c}
                               onClick={() => setActiveConfigClass(c)}
                               className={`group relative flex flex-col items-center justify-center p-4 border transition-all cursor-pointer min-h-[220px] overflow-hidden rounded-sm ${
                                  activeConfigClass === c 
                                     ? 'bg-accent border-accent text-on-accent scale-[1.02] z-10' 
                                     : 'bg-surface border-line text-ink hover:border-accent/50 hover:bg-raised'
                               }`}
                             >

                                <div className={`text-2xs font-semibold uppercase tracking-label mb-10 ${activeConfigClass === c ? 'text-on-accent' : 'text-muted'}`}>
                                   {c === 'general' ? 'General Standards' : c}
                                </div>

                                <div className="flex flex-col items-center">
                                   <div className="text-3xl font-semibold mb-2 flex items-start">
                                      {Math.round(displaySatVal)}
                                      <span className="text-sm mt-2 ml-1 opacity-50">%</span>
                                   </div>
                                   <div className={`text-2xs font-semibold uppercase tracking-label py-1 px-4 border rounded-full ${activeConfigClass === c ? 'border-ground text-on-accent' : 'border-line text-muted'}`}>
                                      {c === 'general' ? 'Global' : `${seats} Seats`}
                                   </div>
                                </div>

                                 {/* Summary Footer */}
                                 <div className={`mt-auto pt-10 flex flex-col items-center gap-2 text-2xs font-semibold uppercase tracking-label ${activeConfigClass === c ? 'text-on-accent' : 'text-muted'}`}>
                                    <div className="flex gap-3 justify-center items-center">
                                       <span>{getCateringOpt(config.catering).label.split(',')[0]}</span>
                                       <span className="opacity-30">|</span>
                                       <span>{getMultiOptionSum(config.service, SERVICE_OPTIONS).label.split(',')[0]}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-current/10 bg-current/5">
                                       <span className="opacity-60">Service quality:</span>
                                       <span className={activeConfigClass === c ? 'text-on-accent font-semibold' : 'text-accent font-semibold'}>{Math.round(serviceQuality)} pts</span>
                                    </div>
                                 </div>
                              </div>
                          );
                       })}
                    </div>
   
                    
          </div>

             {/* Right Sidebar: Satisfaction Breakdown spreadsheet */}
             <div className="w-full lg:w-[450px] min-h-0 shrink-0 border border-line bg-ground/40 flex flex-col overflow-y-auto rounded-sm relative z-20">
                <div className="p-4 border-b border-line bg-surface">
                   <div className="text-2xs text-muted uppercase font-semibold tracking-label leading-none mb-3">Cabin Services Budget</div>
                   {/* What the economy charges: per-passenger cost times the passengers
                       expected on every leg. It used to price one full flight. */}
                   <div className="text-3xl font-semibold text-accent leading-none">
                      {formatCurrency(saveFinancials?.costsBreakdown.catering ?? 0)} <span className="text-sm font-semibold opacity-40">/ wk</span>
                   </div>
                   <div className="text-2xs text-muted uppercase tracking-label mt-2">At {formatNumber(saveFinancials?.paxPerWeek ?? 0)} expected passengers per week</div>
                </div>

                <div className="p-4 border-b border-line bg-surface">
                   <div className="flex justify-between items-end mb-3">
                      <div>
                         <h3 className="font-label text-2xl font-semibold text-ink mb-1">Route Satisfaction</h3>
                         <div className="text-2xs text-muted uppercase tracking-label font-semibold">Average over all seats</div>
                      </div>
                      <div className="text-3xl font-semibold text-accent leading-none">
                         {Math.round(weighted(d => d.satisfactionPercentage))}%
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-2">
                      {['economy', 'premium', 'business', 'first'].map(c => {
                         const seats = selectedAircraft.config?.[c as keyof typeof selectedAircraft.config] as number || 0;
                         if (seats <= 0) return null;
                         const cSatVal = details[c]?.satisfactionPercentage ?? 0;
                         return (
                            <div key={c} className="bg-surface p-3 border border-line flex flex-col gap-1 transition-all hover:bg-raised hover:border-accent/20">
                               <span className="text-2xs font-semibold uppercase tracking-label text-muted">{c}</span>
                               <span className="text-lg font-semibold text-accent leading-none">{Math.round(Math.max(0, cSatVal))}%</span>
                            </div>
                         );
                      })}
                   </div>
                </div>

                <div className="flex-1 divide-y divide-line">
                   {/* Combined Plane SAT Row */}
                   <div className="flex flex-col">
                      {/* The info icon is itself a button, and a button inside a
                          button is invalid HTML, so it sits between two halves. */}
                      <div className="flex items-center hover:bg-raised transition-colors group">
                        <button
                          onClick={() => setExpandedSections(prev => ({ ...prev, plane: !prev.plane }))}
                          className="flex items-center gap-4 p-4 pr-0"
                        >
                           <div className="w-1.5 h-1.5 rounded-full bg-raised"></div>
                           <span className="text-2xs font-semibold uppercase tracking-label">Combined Plane SAT</span>
                        </button>
                        <InfoTooltip size={11} {...GLOSSARY.sat} />
                        <button
                          onClick={() => setExpandedSections(prev => ({ ...prev, plane: !prev.plane }))}
                          className="flex-1 flex items-center justify-end gap-4 p-4"
                          aria-label="Toggle plane satisfaction details"
                        >
                           <span className="text-sm font-semibold">{planeSat}%</span>
                           <ChevronDown size={16} className={`text-muted group-hover:text-ink transition-transform ${expandedSections.plane ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      <>
                         {expandedSections.plane && (
                            <div className="overflow-hidden bg-ground/60 border-b border-line animate-appear">
                               <div className="p-4 pt-0 space-y-3 text-2xs uppercase font-semibold tracking-label text-muted">
                                  <div className="flex justify-between items-center bg-surface p-3 border border-line">
                                     <span>Condition Weighted</span>
                                     <span className="text-ink font-mono">{planeSat}%</span>
                                  </div>
                                  
                                  <div className="border-t border-line pt-3 mt-3">
                                     <div className="text-2xs text-muted mb-3 px-1 font-semibold">By cabin class</div>
                                     {['economy', 'premium', 'business', 'first'].map(c => {
                                        const seats = selectedAircraft.config?.[c as keyof typeof selectedAircraft.config] as number || 0;
                                        if (seats <= 0) return null;
                                        return (
                                           <div key={c} className="flex justify-between items-center p-3 border border-line bg-surface mb-1">
                                              <span className="text-2xs text-muted font-semibold uppercase">{c}</span>
                                              <span className="text-ink font-semibold text-xs">{planeSat}%</span>
                                           </div>
                                        );
                                     })}
                                  </div>
                               </div>
                            </div>
                         )}
                      </>
                   </div>

                   {/* SCE-SAT Row */}
                   <div className="flex flex-col">
                      <button 
                        onClick={() => setExpandedSections(prev => ({ ...prev, sce: !prev.sce }))}
                        className="flex items-center justify-between p-4 hover:bg-raised transition-colors group"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
                            <span className="text-2xs font-semibold uppercase tracking-label">Cabin SAT (before check-in load)</span>
                         </div>
                         <div className="flex items-center gap-4">
                            <span className="text-sm font-semibold">{Math.round(weighted(d => d.baseSatisfaction))}%</span>
                            <ChevronDown size={16} className={`text-muted group-hover:text-ink transition-transform ${expandedSections.sce ? 'rotate-180' : ''}`} />
                         </div>
                      </button>
                      <>
                         {expandedSections.sce && (
                            <div className="overflow-hidden bg-ground/60 border-b border-line animate-appear">
                               <div className="p-4 pt-0 space-y-2 text-2xs uppercase font-semibold tracking-label text-muted">
                                  {['economy', 'premium', 'business', 'first'].map(c => {
                                     const seats = selectedAircraft.config?.[c as keyof typeof selectedAircraft.config] as number || 0;
                                     if (seats <= 0) return null;
                                     const sce = details[c]?.baseSatisfaction ?? 0;
                                     return (
                                        <div key={c} className="flex justify-between items-center bg-surface p-3 border border-line mb-1 group-hover:border-accent/20 transition-all">
                                           <span className="text-2xs text-muted font-semibold">{c}</span>
                                           <span className="text-ink font-mono text-xs">{Math.round(sce)}%</span>
                                        </div>
                                     );
                                  })}
                               </div>
                            </div>
                         )}
                      </>
                   </div>

                   {/* Airport Details Row */}
                   <div className="flex flex-col">
                      <button 
                        onClick={() => setExpandedSections(prev => ({ ...prev, airport: !prev.airport }))}
                        className="flex items-center justify-between p-4 hover:bg-raised transition-colors group"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
                            <span className="text-2xs font-semibold uppercase tracking-label">Ground Services & Bonuses</span>
                         </div>
                         <div className="flex items-center gap-4">
                            {/* Only the check-in load changes SAT directly; stands, lounges
                                and desk types are quality points inside each class score. */}
                            <span className="text-sm font-semibold text-accent">
                               {signed(classSat.overloadPenalty, 1)}%
                            </span>
                            <ChevronDown size={16} className={`text-muted group-hover:text-ink transition-transform ${expandedSections.airport ? 'rotate-180' : ''}`} />
                         </div>
                      </button>
                      <>
                         {expandedSections.airport && (
                            <div className="overflow-hidden bg-ground/60 border-b border-line animate-appear">
                               <div className="p-4 pt-0 space-y-2 text-2xs uppercase font-semibold tracking-label text-muted">
                                  <div className="text-muted mb-2 border-b border-line pb-2 font-semibold">Operational Metrics</div>
                                  <div className="flex justify-between items-center px-2 py-1">
                                     <span className="">Origin Check-In ({formatNumber(originDeskSim.load)}% load)</span>
                                     <span className={originDeskSim.sat < 0 ? 'text-bad' : 'text-accent'}>{signed(originDeskSim.sat, 1)}%</span>
                                  </div>
                                  <div className="flex justify-between items-center px-2 py-1">
                                     <span className="">Dest Check-In ({formatNumber(destDeskSim.load)}% load)</span>
                                     <span className={destDeskSim.sat < 0 ? 'text-bad' : 'text-accent'}>{signed(destDeskSim.sat, 1)}%</span>
                                  </div>
                                  <div className="flex justify-between items-center px-2 py-1">
                                     <span className="">Stand Priority (both ends)</span>
                                     <span className="text-accent">{signed(standBonus, 1)} quality pts</span>
                                  </div>
                                  
                                  <div className="border-t border-line pt-4 mt-4">
                                     <div className="text-muted mb-3 px-2 font-semibold">Route SAT per class</div>
                                     {['economy', 'premium', 'business', 'first'].map(c => {
                                        const seats = selectedAircraft.config?.[c as keyof typeof selectedAircraft.config] as number || 0;
                                        if (seats <= 0) return null;
                                        const sceData = details[c];
                                        if (!sceData) return null;
                                        const overloadPenalty = sceData.overloadPenalty;
                                        const classRouteSat = sceData.satisfactionPercentage;
                                        return (
                                           <div key={c} className="flex justify-between items-center p-3 border border-line bg-surface mb-1">
                                              <div className="flex flex-col">
                                                 <span className="text-2xs text-muted font-semibold">{c}</span>
                                                 <span className="text-2xs text-muted">Target: {sceData.expectationTarget} | Quality: {sceData.providedQuality} | Lounge: {signed(sceData.loungeBonus)} | Desks: {signed(sceData.deskPenalty, 1)}{overloadPenalty < 0 ? ` | Check-in load: ${formatNumber(overloadPenalty, 1)}%` : ''}</span>
                                              </div>
                                              <span className="text-accent font-semibold text-xs">{Math.round(Math.max(0, classRouteSat))}%</span>
                                           </div>
                                        );
                                     })}
                                  </div>
                               </div>
                            </div>
                         )}
                      </>
                   </div>
                </div>

                <div className="p-4 border-t border-line flex flex-col gap-3 bg-surface">
                   <p className="text-2xs text-muted leading-relaxed border-l-3 border-accent/30 pl-6 mb-2 font-semibold uppercase tracking-label">
                      SAT is what this cabin scores against what passengers expect for the class and
                      the flight length. 100% meets expectations; above that they tolerate a higher
                      fare, below it they only book at a discount. Expectations rise with distance,
                      so the same cabin scores lower on a long haul.
                   </p>
                   <div className="flex gap-4 mt-auto">
                      {!isEditingCabinOnly && <button onClick={() => setStep(2)} className="flex-1 py-4 bar:py-2.5 short:py-2 tiny:py-1.5 tiny:text-xs border border-rule text-muted font-semibold text-sm py-4 px-6 rounded-sm hover:text-ink hover:bg-raised transition-all">Back</button>}
                      {!isEditingCabinOnly && <button onClick={() => setStep(4)} className="flex-[2] py-4 bar:py-2.5 short:py-2 tiny:py-1.5 tiny:text-xs bg-accent text-on-accent font-semibold text-sm py-4 px-6 rounded-sm hover:bg-ink transition-all disabled:opacity-50">Next: Pricing</button>}
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

                               // Priced with its own connecting passengers. They used to
                               // come from the draft, which sells at the new fares while
                               // this keeps the ones already on sale this month.
                               const liveFinancials = priceInNetwork(routeData) ?? calculateRouteFinancials(
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
                                 playerMods.demandFactor,
                                 rivalOffers,
                                 playerMods
                               );

                               onSaveRoute({
                                 ...routeData,
                                 ...toStoredRouteMetrics(liveFinancials)
                               });
                             }
                             setShowSuccess(true);
                             later(() => {
                               setShowSuccess(false);
                               setIsFinalizing(false);
                               onClose();
                             }, 1500);
                          }}
                          className="flex-[2] py-4 bar:py-2.5 short:py-2 tiny:py-1.5 tiny:text-xs bg-accent text-on-accent font-semibold text-sm hover:bg-ink transition-all font-sans">
                          {isFinalizing ? 'Saving Cabin Configuration...' : 'Save Cabin Services'}
                        </button>
                      )}
                   </div>
                </div>
              </div>
              </div>
              </div>
        )})()}

        {step === 4 && financials && selectedAircraft && selectedOrigin && selectedDest && (() => {
           const { 
              dist, flightLegs, weeklyFuelCost, weeklyCrewCost, weeklyInfraCost, 
              originDepartures, destDepartures, originLandingFees, destLandingFees,
              originCheckInUnit, destCheckInUnit, originCheckInFees, destCheckInFees,
              originPaxFeeUnit, destPaxFeeUnit, originPaxHandlingFees, destPaxHandlingFees
           } = financials;

           // `financials` already IS the full-load engine result for this draft, and
           // `saveFinancials` the realistic-load one. Both are memoised above, so this
           // block no longer recomputes the model on every keystroke.
           const displayFinancials = financials;

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
           // Shares the one basePricePoints memo with the auto-seed effect above,
           // so the sliders and the price ticketPrices gets seeded to can never
           // drift apart (see the comment on that memo).
           const basePriceBE75 = basePricePoints?.be75 ?? 100;
           const basePriceBE99 = basePricePoints?.be99 ?? 80;
           const basePriceBE35 = basePricePoints?.be35 ?? 300;
           // Twice the room on both sides of the break-even-at-75% notch, which
           // stays at the same relative spot on the bar either way, so a player
           // testing a much cheaper or much pricier fare isn't capped at the
           // 99%/35%-load break-even points.
           // The bar also always reaches half and one and a half times the
           // market fare, so on a route that costs more than passengers pay the
           // fares that actually sell are still on it.
           const marketFare: Record<string, number> = saveFinancials?.marketFare ?? {};
           const fareRange = (min: number, max: number, fare: number | undefined) => fare && fare > 0
             ? { min: Math.max(1, Math.min(min, fare * 0.5)), max: Math.max(max, fare * 1.5) }
             : { min, max };
           const { min: sliderMin, max: sliderMax } = fareRange(
             basePriceBE75 - 2 * (basePriceBE75 - basePriceBE99),
             basePriceBE75 + 2 * (basePriceBE35 - basePriceBE75),
             marketFare.economy
           );
           const tickPct = (value: number, min: number, max: number) => ((value - min) / (max - min)) * 100;

           const actualCapacity = aircraftConfig 
             ? ((aircraftConfig.economy || 0) + (aircraftConfig.premium || 0) + (aircraftConfig.business || 0) + (aircraftConfig.first || 0)) 
             : 0;
           const finalCapacity = actualCapacity > 0 ? actualCapacity : selectedAircraft.capacity;
           const totalEstPaxMax = finalCapacity * flightLegs;

           return (
              <div className="flex-1 w-full flex flex-col min-h-0 overflow-y-auto animate-appear bg-ground/25">
                <div className="flex-1 w-full max-w-[1800px] mx-auto p-4 flex flex-col lg:flex-row gap-4">
                  {/* Left Area: Financial Summary */}
                  <div className="flex-[1] flex flex-col gap-3">
                     <div className="bg-surface border border-line p-4 rounded-sm shrink-0 sticky top-4 w-full lg:w-[350px]">
                        <div className="mb-4 flex flex-col gap-1.5 pointer-events-none">
                           <h3 className="font-label text-xl font-semibold text-ink leading-tight">
                              Financial Summary
                           </h3>
                           {/* Everything below this line is the full-aircraft ceiling
                               (the realistic figure on Easy). The expected result at
                               today's demand is shown at the bottom. */}
                           <span className="text-2xs text-muted tracking-label font-label font-semibold uppercase">{formatNumber(paxPerWeek)} / {formatNumber(totalEstPaxMax)} Weekly PAX {difficulty !== 'Easy' ? '(full aircraft)' : ''}</span>
                        </div>
                        
                        <div className="space-y-4 mb-4">
                           <div className="flex justify-between items-end border-b border-line pb-2">
                             <span className="text-2xs uppercase font-semibold tracking-label text-muted">Est. Weekly Revenue</span>
                             <span className="text-lg font-mono text-accent">+{formatCurrency(maxRevenue)}</span>
                           </div>
                           <div className="flex flex-col border-b border-line pb-2">
                             <div 
                               className="flex justify-between items-end cursor-pointer group"
                               onClick={() => setExpandedSections(prev => ({ ...prev, fuel4: !prev.fuel4 }))}
                             >
                               <span className="text-2xs uppercase font-semibold tracking-label text-muted hover:text-accent transition-colors flex items-center gap-1">
                                 Opx: Fuel Cost {expandedSections.fuel4 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                               </span>
                               <span className="text-sm font-mono text-muted group-hover:text-ink transition-colors">-{formatCurrency(weeklyFuelCost)}</span>
                             </div>
                             {expandedSections.fuel4 && (
                               <div className="pl-4 mt-2 space-y-1">
                                 <div className="flex justify-between items-end">
                                   <span className="text-2xs uppercase tracking-label text-muted">Fuel Price</span>
                                   <span className="text-2xs font-mono text-muted">${formatNumber(displayFinancials.costsBreakdown.fuelPriceL, 3)}/L</span>
                                 </div>
                                 <div className="flex justify-between items-end">
                                   <span className="text-2xs uppercase tracking-label text-muted">Seats (type capacity, fuel basis)</span>
                                   <span className="text-2xs font-mono text-muted">{finalCapacity} ({selectedAircraft.capacity})</span>
                                 </div>
                                 <div className="flex justify-between items-end">
                                   <span className="text-2xs uppercase tracking-label text-muted">Oneway Distance</span>
                                   <span className="text-2xs font-mono text-muted">{dist.toFixed(0)} km</span>
                                 </div>
                                 <div className="flex justify-between items-end">
                                   <span className="text-2xs uppercase tracking-label text-muted">Formula Divider</span>
                                   <span className="text-2xs font-mono text-muted">{(0.75 + (selectedAircraft.efficiency / 70)).toFixed(2)}</span>
                                 </div>
                                 <div className="flex justify-between items-end">
                                   <span className="text-2xs uppercase tracking-label text-muted">Weekly Flight Legs</span>
                                   <span className="text-2xs font-mono text-muted">{flightLegs}x</span>
                                 </div>
                               </div>
                             )}
                           </div>
                           <div className="flex justify-between items-end border-b border-line pb-2">
                             <span className="text-2xs uppercase font-semibold tracking-label text-muted">Opx: Cabin & Catering</span>
                             <span className="text-sm font-mono text-muted">-{formatCurrency(displayFinancials.costsBreakdown.catering)}</span>
                           </div>
                             <div 
                               className="flex justify-between items-end cursor-pointer group"
                               onClick={() => setExpandedSections(prev => ({ ...prev, crew4: !prev.crew4 }))}
                             >
                                <span className="text-2xs uppercase font-semibold tracking-label text-muted hover:text-accent transition-colors flex items-center gap-1">
                                 Opx: Crew Costs {expandedSections.crew4 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                               </span>
                               <span className="text-sm font-mono text-muted group-hover:text-ink transition-colors">-{formatCurrency(weeklyCrewCost)}</span>
                             </div>
                             {expandedSections.crew4 && (
                               <div className="pl-4 mt-2 space-y-1">
                                 <div className="flex justify-between items-end">
                                   <span className="text-2xs uppercase tracking-label text-muted">Hourly Rate</span>
                                   <span className="text-2xs font-mono text-muted">${((2 * 100) + (Math.ceil(selectedAircraft.capacity / 50) * 40)).toFixed(2)}</span>
                                 </div>
                                 <div className="flex justify-between items-end">
                                   <span className="text-2xs uppercase tracking-label text-muted">Pilots / FAs</span>
                                   <span className="text-2xs font-mono text-muted">2 / {Math.ceil(selectedAircraft.capacity / 50)}</span>
                                 </div>
                                 <div className="flex justify-between items-end">
                                   <span className="text-2xs uppercase tracking-label text-muted">Weekly Flight Hours</span>
                                   <span className="text-2xs font-mono text-muted">{(schedule.reduce((acc, s) => acc + (s.durMin * (s.isOneWay ? 1 : 2)), 0) / 60).toFixed(2)}h</span>
                                 </div>
                               </div>
                             )}
                           <div className="flex flex-col border-b border-line pb-2">
                             <div 
                               className="flex justify-between items-end cursor-pointer group"
                               onClick={() => setExpandedSections(prev => ({ ...prev, infra4: !prev.infra4 }))}
                             >
                               <span className="text-2xs uppercase font-semibold tracking-label text-muted hover:text-accent transition-colors flex items-center gap-1">
                                 Opx: Infrastructure {expandedSections.infra4 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                               </span>
                               <span className="text-sm font-mono text-muted group-hover:text-ink transition-colors">-{formatCurrency(weeklyInfraCost)}</span>
                             </div>
                             {expandedSections.infra4 && (
                               <div className="pl-4 mt-2 space-y-2 border-l border-line ml-1">
                                 <div className="space-y-1">
                                   <h4 className="font-label text-2xs font-semibold uppercase tracking-label text-ink mb-1">Landing Fees</h4>
                                   <div className="flex justify-between items-end">
                                     <span className="text-2xs uppercase tracking-label text-muted">{selectedOrigin.id} ({originDepartures}x landings)</span>
                                     <span className="text-2xs font-mono text-muted">-{formatCurrency(originLandingFees)}</span>
                                   </div>
                                   <div className="flex justify-between items-end">
                                     <span className="text-2xs uppercase tracking-label text-muted">{selectedDest.id} ({destDepartures}x landings)</span>
                                     <span className="text-2xs font-mono text-muted">-{formatCurrency(destLandingFees)}</span>
                                   </div>
                                 </div>

                                 <div className="space-y-1 pt-1 border-t border-line">
                                   <h4 className="font-label text-2xs font-semibold uppercase tracking-label text-ink mb-1">Check-in Desk Costs</h4>
                                   <div className="flex justify-between items-end">
                                     <span className="text-2xs uppercase tracking-label text-muted">{selectedOrigin.id} (${formatNumber(originCheckInUnit, 3)}/pax)</span>
                                     <span className="text-2xs font-mono text-muted">-{formatCurrency(originCheckInFees)}</span>
                                   </div>
                                   <div className="flex justify-between items-end">
                                     <span className="text-2xs uppercase tracking-label text-muted">{selectedDest.id} (${formatNumber(destCheckInUnit, 3)}/pax)</span>
                                     <span className="text-2xs font-mono text-muted">-{formatCurrency(destCheckInFees)}</span>
                                   </div>
                                 </div>

                                 <div className="space-y-1 pt-1 border-t border-line">
                                   <h4 className="font-label text-2xs font-semibold uppercase tracking-label text-ink mb-1">PAX Handling Fees (Security/Baggage)</h4>
                                   <div className="flex justify-between items-end">
                                     <span className="text-2xs uppercase tracking-label text-muted">{selectedOrigin.id} (L{selectedOrigin.level}: ${originPaxFeeUnit}/pax)</span>
                                     <span className="text-2xs font-mono text-muted">-{formatCurrency(originPaxHandlingFees)}</span>
                                   </div>
                                   <div className="flex justify-between items-end">
                                     <span className="text-2xs uppercase tracking-label text-muted">{selectedDest.id} (L{selectedDest.level}: ${destPaxFeeUnit}/pax)</span>
                                     <span className="text-2xs font-mono text-muted">-{formatCurrency(destPaxHandlingFees)}</span>
                                   </div>
                                 </div>

                                 <div className="pt-1 border-t border-line">
                                    <p className="text-2xs text-muted uppercase font-semibold leading-tight">
                                      * Costs include slot license, check-in desk personnel, terminal usage fees, and baggage handling systems per departure.
                                    </p>
                                 </div>
                               </div>
                             )}
                           </div>
                        </div>

                        {/* Two different questions: what the route earns at today's demand,
                            and what it could earn with every seat sold. The screen used to
                            show only the second, under the same label on every difficulty. */}
                        {saveFinancials && difficulty !== 'Easy' && (
                          <div className={`p-4 mb-2 border ${saveFinancials.estWeeklyProfit >= 0 ? 'bg-good/10 border-good/30' : 'bg-bad/10 border-bad/30'} flex flex-col items-center justify-center`}>
                             <span className="text-2xs uppercase font-semibold tracking-label text-muted mb-1">Expected Weekly Profit (current demand)</span>
                             <span className={`text-3xl font-semibold ${saveFinancials.estWeeklyProfit >= 0 ? 'text-good' : 'text-bad'}`}>
                               {formatSignedCurrency(saveFinancials.estWeeklyProfit)}
                             </span>
                             <span className="text-2xs text-muted mt-1">
                               {formatNumber(saveFinancials.paxPerWeek)} / {formatNumber(totalEstPaxMax)} pax per week
                               {saveFinancials.transferPax > 0 && ` · incl. ${formatNumber(saveFinancials.transferPax)} transfer`}
                             </span>
                          </div>
                        )}
                        <div className={`p-4 border ${estProfit >= 0 ? 'bg-accent/10 border-accent/30' : 'bg-surface border-rule'} flex flex-col items-center justify-center`}>
                            <span className="text-2xs uppercase font-semibold tracking-label text-muted mb-1">{difficulty !== 'Easy' ? 'Max Weekly Profit (full aircraft)' : 'Expected Weekly Profit'}</span>
                           <span className={`text-3xl font-semibold ${estProfit >= 0 ? 'text-accent' : 'text-bad'}`}>
                             {formatSignedCurrency(estProfit)}
                           </span>
                        </div>
                     </div>
                  </div>

                  {/* Right Area: Sliders */}
                  <div className="flex-[2] flex flex-col">
                     <div className="bg-surface border border-line p-4 rounded-sm mb-3 flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-3">
                           <h3 className="font-label text-xl font-semibold text-ink mb-2">Configure Pricing</h3>
                           {debugMode && (
                             <div 
                                className="text-muted text-2xs font-semibold uppercase tracking-label flex items-center gap-2 cursor-pointer border border-line px-2 py-1 bg-ground/40 hover:bg-raised"
                                onClick={() => setShowPricingDebug(!showPricingDebug)}
                             >
                                <Search size={12} /> Base P. <span className="text-2xs bg-raised px-1 py-0.5 rounded-sm">Debug</span>
                             </div>
                           )}
                        </div>

                        {showPricingDebug && debugMode && (
                          <div className="mb-4 p-4 border border-line bg-ground/60 rounded-sm text-2xs text-muted space-y-2">
                             <div className="text-ink font-semibold mb-2 uppercase tracking-label">SAT base price &amp; demand (expected load)</div>
                             {saveFinancials && (() => {
                                // Everything here is read from the engine result the route is
                                // saved with, so the debug view cannot drift from the model.
                                const bases = calculateBasePrices(saveFinancials.distance, saveFinancials.timeClass);
                                const d = saveFinancials.demandData;
                                return CABIN_CLASSES.map(c => {
                                   const seats = selectedAircraft.config?.[c] || 0;
                                   if (!seats) return null;
                                   const maxDemand = d[c] || 0;
                                   const base = bases[c];
                                   const sat = Math.max(0, saveFinancials.routeSat[c] || 0);
                                   const satMultiplier = getSatMultiplier(sat);
                                   const satBase = Math.round(base * satMultiplier);
                                   const currentPrice = ticketPrices[c] || satBase;
                                   const elasticity = Math.max(0.5, 1.5 - sat / 200);
                                   const fare = saveFinancials.marketFare?.[c] ?? satBase;
                                   const demMult = getPriceDemandMultiplier(currentPrice, fare, sat);
                                   const pax = saveFinancials.paxByClass[c];
                                   return (
                                      <div key={c} className="flex flex-col py-2 border-b border-line last:border-0 gap-1">
                                         <div className="flex justify-between text-ink">
                                           <span className="uppercase font-semibold">{c}</span>
                                           <span>Base: ${base} &times; SAT mult: {formatNumber(satMultiplier, 3)} ({sat}%) &rarr; <strong className="text-accent">SAT base: ${satBase}</strong></span>
                                         </div>
                                         {sat > 100 && (
                                            <div className="pl-4 text-2xs text-muted">
                                               SAT &gt; 100%: {sat <= 200 ? `1.0 + (0.008 * ${sat-100}) - (0.000035 * ${Math.pow(sat-100, 2).toFixed(0)})` : `1.45 + (0.001 * ${sat-200})`}
                                            </div>
                                         )}
                                         <div className="flex justify-between pl-4 text-2xs">
                                           <span>Scarcity premium (demand over seats, at most +{Math.round(MAX_SCARCITY_PREMIUM * 100)}%): &times;{formatNumber(fare / Math.max(1, satBase), 3)} &rarr; market fare ${fare}</span>
                                         </div>
                                         <div className="flex justify-between pl-4 text-2xs">
                                           <span>Price ratio: market fare / price = {formatNumber(fare / currentPrice, 2)}</span>
                                         </div>
                                         <div className="flex justify-between pl-4 text-2xs">
                                           <span>Demand mult: {currentPrice <= fare ? `min(1.5, ratio^${formatNumber(elasticity, 2)})` : `${formatNumber(1 - PRICE_INSENSITIVE_SHARE, 2)} × ratio^${formatNumber(elasticity * 3, 2)} + ${formatNumber(PRICE_INSENSITIVE_SHARE, 2)} × ratio`}</span>
                                           <span>{formatNumber(demMult * 100, 1)}%</span>
                                         </div>
                                         <div className="flex justify-between pl-4 text-2xs text-accent">
                                           <span>Market demand {formatNumber(maxDemand)} / wk, before competitors and seat cap</span>
                                           <span>Expected pax: {formatNumber(pax?.actual ?? 0)}{pax?.transfer ? ` + ${formatNumber(pax.transfer)} transfer` : ''} / {formatNumber(pax?.max ?? 0)}</span>
                                         </div>
                                         <div className="flex justify-between pl-4 text-2xs text-muted">
                                            <span>Seats on aircraft:</span>
                                            <span>{seats}</span>
                                         </div>
                                      </div>
                                   );
                                });
                             })()}
                          </div>
                        )}

                        <div className="space-y-8 max-w-2xl">
                                                      <div className="flex flex-col gap-4 bg-ground/40 p-4 border border-line group hover:border-rule transition-all mb-4 relative overflow-hidden">
                              <div className="flex justify-between items-center relative z-10">
                                 <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-accent">General Settings</span>
                                    <span className="text-2xs text-muted uppercase tracking-label mt-1">Adjust All Prices</span>
                                 </div>
                              </div>
                              <div className="relative pt-4 z-10">
                                 <input
                                    type="range"
                                    min={Math.round(sliderMin)}
                                    max={Math.round(sliderMax)}
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
                                    className="w-full h-2 bg-raised rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer cursor-pointer relative z-10"
                                 />
                                 <div
                                    className="absolute top-[20px] h-4 w-1 bg-accent/70 pointer-events-none z-0 rounded-b-sm"
                                    style={{ left: `calc(${tickPct(basePriceBE75, sliderMin, sliderMax)}% + ${8 - tickPct(basePriceBE75, sliderMin, sliderMax) * 0.16}px)`, transform: 'translateX(-50%)' }}
                                 />
                                 <div
                                    className="absolute top-[20px] h-3 w-0.5 bg-rule pointer-events-none z-0"
                                    title={`Break-even at 99% full: $${Math.round(basePriceBE99)}`}
                                    style={{ left: `calc(${tickPct(basePriceBE99, sliderMin, sliderMax)}% + ${8 - tickPct(basePriceBE99, sliderMin, sliderMax) * 0.16}px)`, transform: 'translateX(-50%)' }}
                                 />
                                 {marketFare.economy > 0 && (
                                   <div
                                      className="absolute top-[20px] h-4 w-0.5 bg-good/80 pointer-events-none z-0"
                                      title={`Economy market fare: $${marketFare.economy}. Above it, passengers stay away.`}
                                      style={{ left: `calc(${tickPct(marketFare.economy, sliderMin, sliderMax)}% + ${8 - tickPct(marketFare.economy, sliderMin, sliderMax) * 0.16}px)`, transform: 'translateX(-50%)' }}
                                   />
                                 )}
                                 <div
                                    className="absolute top-[20px] h-3 w-0.5 bg-rule pointer-events-none z-0"
                                    title={`Break-even at 35% full: $${Math.round(basePriceBE35)}`}
                                    style={{ left: `calc(${tickPct(basePriceBE35, sliderMin, sliderMax)}% + ${8 - tickPct(basePriceBE35, sliderMin, sliderMax) * 0.16}px)`, transform: 'translateX(-50%)' }}
                                 />
                                 <div className="flex justify-between mt-2 px-1">
                                    <span className="text-2xs text-muted font-mono">${Math.round(sliderMin)}</span>
                                    <span className="text-2xs text-muted font-mono">${Math.round(sliderMax)}</span>
                                 </div>
                                 <p className="text-2xs text-muted leading-relaxed mt-1">
                                   The notch is break-even at 75% full, a realistic year-round average; the two thin
                                   ticks mark break-even at 99% and 35% full. The green tick is the market fare: what
                                   passengers pay for this cabin, up to {Math.round(MAX_SCARCITY_PREMIUM * 100)}% more when they want far more seats than
                                   the route offers. Above it they stay away quickly. A route whose break-even lies
                                   above the green tick loses money at any fare. The bar itself reaches twice as far
                                   past both ticks for testing more extreme fares.
                                 </p>
                              </div>
                           </div>

                           {classes.map(c => {
                             if (classSeatCount[c] <= 0) return null;
                             const currentPrice = ticketPrices[c] || 0;
                             const multiplier = (c === 'premium' ? 1.6 : c === 'business' ? 3.0 : c === 'first' ? 5.0 : 1.0);
                             
                             const breakEvenPrice = Math.round(basePriceBE75 * multiplier);
                             const be99Price = Math.round(basePriceBE99 * multiplier);
                             const be35Price = Math.round(basePriceBE35 * multiplier);
                             // Same doubled headroom as the general-settings bar above, scaled
                             // by this class's price multiplier.
                             const classFare = marketFare[c];
                             const classRange = fareRange(sliderMin * multiplier, sliderMax * multiplier, classFare);
                             const minPossiblePrice = Math.round(classRange.min);
                             const maxPossiblePrice = Math.round(classRange.max);
                             // Expected load of this cabin at today's demand: local
                             // passengers plus the connecting ones the network sells
                             // in it (the same figures as the expected-profit box).
                             const cabinLoad = saveFinancials?.paxByClass?.[c];
                             const cabinTransfer = cabinLoad?.transfer ?? 0;
                             const cabinLf = cabinLoad && cabinLoad.max > 0
                               ? Math.round(((cabinLoad.actual + cabinTransfer) / cabinLoad.max) * 100)
                               : 0;

                             return (
                               <div key={c} className="flex flex-col gap-4 bg-ground/40 p-4 border border-line group hover:border-rule transition-all">
                                  <div className="flex justify-between items-center">
                                     <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-accent">{c} Class</span>
                                        <span className="text-2xs text-muted uppercase tracking-label mt-1">{classSeatCount[c]} Seats</span>
                                        {cabinLoad && (
                                          <span className="text-2xs text-muted mt-1">
                                            Expected {formatNumber(cabinLoad.actual)} local
                                            {cabinTransfer > 0 && ` + ${formatNumber(cabinTransfer)} transfer`}
                                            {' '}/ {formatNumber(cabinLoad.max)} pax per week ({cabinLf}% LF)
                                          </span>
                                        )}
                                     </div>
                                     <div className="flex flex-col items-end">
                                        <span className="text-2xl font-mono text-ink font-semibold">${currentPrice}</span>
                                        {classFare > 0 && (
                                          <span className="text-2xs font-mono text-good mt-1">Market fare ${classFare}</span>
                                        )}
                                     </div>
                                  </div>
                                  
                                  <div className="relative pt-4">
                                     <input 
                                        type="range"
                                        min={minPossiblePrice}
                                        max={maxPossiblePrice}
                                        value={currentPrice}
                                        onChange={(e) => setTicketPrices(prev => ({ ...prev, [c]: parseInt(e.target.value) }))}
                                        className="w-full h-2 bg-raised rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer cursor-pointer relative z-10"
                                     />
                                     <div
                                        className="absolute top-[20px] h-4 w-1 bg-accent/70 pointer-events-none z-0 rounded-b-sm"
                                        style={{ left: `calc(${tickPct(breakEvenPrice, minPossiblePrice, maxPossiblePrice)}% + ${8 - tickPct(breakEvenPrice, minPossiblePrice, maxPossiblePrice) * 0.16}px)`, transform: 'translateX(-50%)' }}
                                     />
                                     <div
                                        className="absolute top-[20px] h-3 w-0.5 bg-rule pointer-events-none z-0"
                                        title={`Break-Even at 99% LF: $${be99Price}`}
                                        style={{ left: `calc(${tickPct(be99Price, minPossiblePrice, maxPossiblePrice)}% + ${8 - tickPct(be99Price, minPossiblePrice, maxPossiblePrice) * 0.16}px)`, transform: 'translateX(-50%)' }}
                                     />
                                     <div
                                        className="absolute top-[20px] h-3 w-0.5 bg-rule pointer-events-none z-0"
                                        title={`Break-Even at 35% LF: $${be35Price}`}
                                        style={{ left: `calc(${tickPct(be35Price, minPossiblePrice, maxPossiblePrice)}% + ${8 - tickPct(be35Price, minPossiblePrice, maxPossiblePrice) * 0.16}px)`, transform: 'translateX(-50%)' }}
                                     />
                                     {classFare > 0 && (
                                       <div
                                          className="absolute top-[20px] h-4 w-0.5 bg-good/80 pointer-events-none z-0"
                                          title={`Market fare: $${classFare}. Above it, passengers stay away.`}
                                          style={{ left: `calc(${tickPct(classFare, minPossiblePrice, maxPossiblePrice)}% + ${8 - tickPct(classFare, minPossiblePrice, maxPossiblePrice) * 0.16}px)`, transform: 'translateX(-50%)' }}
                                       />
                                     )}
                                     <div className="flex justify-between mt-2 px-1">
                                        <span className="text-2xs text-muted font-mono">${minPossiblePrice}</span>
                                        <span className="text-2xs text-muted font-mono">${maxPossiblePrice}</span>
                                     </div>
                                  </div>
                               </div>
                             );
                           })}
</div>
                     </div>
                     <div className="flex gap-4">
                        {!isEditingPricingOnly && <button onClick={() => setStep(3)} className="flex-1 py-4 bar:py-2.5 short:py-2 tiny:py-1.5 tiny:text-xs border border-rule text-muted font-semibold text-sm py-4 px-6 rounded-sm hover:text-ink hover:bg-raised transition-all">Back</button>}
                        {!isEditingPricingOnly && (
                        <button
                          disabled={isFinalizing || schedule.length === 0}
                          onClick={() => {
                            if (isFinalizing || !routeDraft) return;
                            setIsFinalizing(true);

                            const newRoute = {
                              ...routeDraft,
                              airline: "My Airline",
                              airlineCode: airlineCode,
                              flightNumberOut: flightNumberOutbound,
                              flightNumberIn: flightNumberInbound,
                              isOneWay: false,
                              aircraft: selectedAircraft.registration,
                              weeklyFlights: schedule.length,
                              turnoverMin: getTurnoverMinutes()
                            };
                            // Priced once more, in full: the preview's connecting
                            // passengers follow a deferred copy of the draft and can
                            // be a slider tick behind.
                            const stored = priceInNetwork(newRoute) ?? saveFinancials;
                            onSaveRoute({ ...newRoute, ...(stored ? toStoredRouteMetrics(stored) : {}) });
                            later(() => {
                              onClose();
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
                          className="flex-[2] py-4 bar:py-2.5 short:py-2 tiny:py-1.5 tiny:text-xs bg-accent text-on-accent font-semibold text-sm hover:bg-ink hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans"
                        >
                          {isFinalizing ? 'Finalizing...' : 'Finalize Route'}
                        </button>
                        )}
                        {isEditingPricingOnly && (
                        <button
                          disabled={isFinalizing}
                          onClick={() => {
                            if (isFinalizing) return;
                            setIsFinalizing(true);
                            const r = routes.find(rt => rt.id === initialRouteId);
                            if (r) {
                              // activeTicketPrices is intentionally left untouched: fares
                              // already sold for this month stay at the old price, the new
                              // one takes effect at the next month-end sync — only the
                              // "what you're asking for" field changes right away.
                              onSaveRoute({
                                ...r,
                                ticketPrices: ticketPrices || r.ticketPrices || { economy: 100 }
                              });
                            }
                            later(() => {
                              setIsFinalizing(false);
                              onClose();
                            }, 1500);
                          }}
                          className="flex-[2] py-4 bar:py-2.5 short:py-2 tiny:py-1.5 tiny:text-xs bg-accent text-on-accent font-semibold text-sm hover:bg-ink transition-all font-sans"
                        >
                          {isFinalizing ? 'Saving Pricing...' : 'Save Pricing'}
                        </button>
                        )}
                     </div>
                  </div>
               </div>
              {/* A stray ");" used to sit here as a text node and was printed
                  under the pricing screen. */}
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
            routeSat={classSat?.routeSat ?? {}}
          />
        )}

        <CabinConfigDialogs />

      </div>
    </div>
  );
}
