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
import { Airport, calculateDistance } from "./data/airports";
import { airports, airportsMapAdjusted } from "./data/airportRegistry";
export { airportsMapAdjusted };

const offsetToDateStr = (offset: number) =>
  `${(1 + (offset % 12)).toString().padStart(2, '0')}/${1960 + Math.floor(offset / 12)}`;

const signedPercent = (multiplier: number) => {
  const pct = Math.round((multiplier - 1.0) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
};

/**
 * Turns an event into the inbox message announcing it.
 *
 * The six scripted historical events used to fire in complete silence: in March
 * 2020 the game multiplied demand by 0.20 and told the player nothing, so an
 * 80% revenue collapse looked like a bug. Only the random events were ever
 * announced, and they had their own copy of this code.
 */
function buildEventStartMessage(ev: HistoricalEvent, idSeed: number): GameMessage {
  const dateStr = offsetToDateStr(ev.startOffset);
  const demand = signedPercent(ev.demandMultiplier);
  const fuel = signedPercent(ev.fuelMultiplier);
  return {
    id: idSeed,
    text: `GLOBAL EVENT: "${ev.title}" begins. Demand ${demand}, fuel ${fuel}, for ${ev.duration} months.`,
    isRead: false,
    dateStr,
    details: {
      title: ev.title,
      source: "Global Intelligence Agency",
      content:
        `${ev.description}\n\nActive from ${dateStr} for ${ev.duration} months, ` +
        `through ${offsetToDateStr(ev.startOffset + ev.duration - 1)}.\n\n` +
        `Projected impact:\n` +
        `\u2022 Global passenger demand: ${demand}\n` +
        `\u2022 Jet fuel market index: ${fuel}\n\n` +
        `These multiply with any other event running at the same time.`
    }
  };
}

function buildEventEndMessage(ev: HistoricalEvent, idSeed: number, endOffset: number): GameMessage {
  return {
    id: idSeed,
    text: `"${ev.title}" has ended. Demand and fuel return to normal.`,
    isRead: false,
    dateStr: offsetToDateStr(endOffset),
    details: {
      title: `${ev.title} - over`,
      source: "Global Intelligence Agency",
      content:
        `${ev.title} ran for ${ev.duration} months and is no longer in effect.\n\n` +
        `Its ${signedPercent(ev.demandMultiplier)} demand and ${signedPercent(ev.fuelMultiplier)} fuel ` +
        `adjustments have been lifted.`
    }
  };
}

/**
 * Airline reputation, 0-100.
 *
 * The game had no airline-level number that grew or decayed: after thirty
 * in-game years you had more money and newer aircraft, but nothing that said
 * you had become a better airline. Reputation is that number, and it is
 * deliberately slow -- it cannot be bought, only earned over months, and it
 * falls the same way.
 *
 * It is built only from things the simulation already computes:
 *   - how satisfied passengers were, weighted by how many of them there were
 *   - how worn the cabins of the aircraft actually flying are
 *   - how full the aircraft flew
 *
 * conditionGeneral is deliberately included through condScore's sibling below:
 * until now airframe condition affected nothing but resale value, which made
 * the $200k general check a pure sink.
 */

/**
 * Coarse continent lookup from coordinates, for the "continents served"
 * milestone only. The airport dataset carries no region field, and this is
 * approximate: it uses rectangles, so a handful of airports near a boundary
 * (the Urals, Sinai, Panama) land on the wrong side. That is acceptable for
 * counting how far a network reaches; it is not used anywhere in the economy.
 */
export function continentOf(coords: [number, number]): string {
  const [lat, lon] = coords;
  if (lat >= 7 && lon >= -170 && lon <= -50) return 'NA';
  if (lat < 13 && lon >= -92 && lon <= -34) return 'SA';
  if (lat >= 35 && lat <= 72 && lon >= -25 && lon <= 45) return 'EU';
  if (lat >= -35 && lat <= 37 && lon >= -20 && lon <= 52) return 'AF';
  if (lat <= 0 && lon >= 110 && lon <= 180) return 'OC';
  if (lon >= 45 || lon <= -170) return 'AS';
  return 'OT';
}

/**
 * Milestones. Checked at the end of each month, awarded once, announced in the
 * inbox. They are the only thing in the game that accumulates across a whole
 * career, and each one nudges reputation, which is the reward that lasts.
 */
export interface MilestoneContext {
  routeCount: number;
  fleetSize: number;
  capital: number;
  longestRouteKm: number;
  continents: number;
  profitableMonthStreak: number;
  reputation: number;
}

export const MILESTONES: {
  id: string;
  title: string;
  detail: string;
  reputationBonus: number;
  met: (c: MilestoneContext) => boolean;
}[] = [
  { id: 'first-route', title: 'First route opened', detail: 'Your airline is flying.', reputationBonus: 2,
    met: c => c.routeCount >= 1 },
  { id: 'fleet-10', title: 'Ten aircraft', detail: 'A fleet rather than a handful of aeroplanes.', reputationBonus: 3,
    met: c => c.fleetSize >= 10 },
  { id: 'longhaul', title: 'First intercontinental route', detail: 'A route beyond 5,000 km.', reputationBonus: 4,
    met: c => c.longestRouteKm >= 5000 },
  { id: 'continents-4', title: 'Four continents served', detail: 'Your network spans four continents.', reputationBonus: 5,
    met: c => c.continents >= 4 },
  { id: 'capital-100m', title: '$100 million in the bank', detail: 'Enough to buy almost anything on the market.', reputationBonus: 3,
    met: c => c.capital >= 100_000_000 },
  { id: 'profit-12', title: 'A full year in profit', detail: 'Twelve consecutive months without a loss.', reputationBonus: 6,
    met: c => c.profitableMonthStreak >= 12 },
  { id: 'reputation-80', title: 'A reputation worth having', detail: 'Reputation above 80.', reputationBonus: 0,
    met: c => c.reputation >= 80 }
];

export const REPUTATION_INERTIA = 0.15;

export function computeReputationTarget(samples: {
  weightedSat: number;      // pax-weighted mean route satisfaction, in percent
  meanInterior: number;     // 0-100
  meanAirframe: number;     // 0-100
  loadFactor: number;       // 0-1
}): number {
  // A route at 130% satisfaction is as good as this scale goes.
  const satScore = Math.max(0, Math.min(100, (samples.weightedSat / 130) * 100));
  const condScore = Math.max(0, Math.min(100, samples.meanInterior * 0.6 + samples.meanAirframe * 0.4));
  const loadScore = Math.max(0, Math.min(100, samples.loadFactor * 100));
  return 0.5 * satScore + 0.3 * condScore + 0.2 * loadScore;
}

/**
 * What reputation does to demand: a tenth either way. Small enough that a good
 * network still beats a good reputation, large enough to be worth protecting.
 */
export function reputationDemandFactor(reputation: number): number {
  return 0.9 + (Math.max(0, Math.min(100, reputation)) / 100) * 0.2;
}

/**
 * The correction that turns a crisis's raw demand hit into the softened one the
 * player paid for.
 *
 * calculateDemand has already applied the event's own multiplier via
 * getEventMultipliers, and that path is shared with the AI airlines. Rather
 * than fork it, the player's demand factor carries the ratio between the
 * softened multiplier and the raw one, so only the player sees the relief.
 */
export function eventReliefFactor(
  offset: number,
  choicesTaken: Record<string, string>
): number {
  let factor = 1;
  for (const ev of getActiveEvents(offset)) {
    const chosenId = choicesTaken[eventKey(ev)];
    if (!chosenId) continue;
    const choice = ev.choices?.find(c => c.id === chosenId);
    if (!choice?.softensDemand) continue;
    const raw = ev.demandMultiplier;
    if (raw >= 1) continue;
    const softened = raw + (1 - raw) * choice.softensDemand;
    factor *= softened / raw;
  }
  return factor;
}

/** Adds a one-off amount to the month's list, merging items with the same label. */
function addCapexItem(list: { label: string; amount: number }[], label: string, amount: number) {
  return list.some(c => c.label === label)
    ? list.map(c => (c.label === label ? { ...c, amount: c.amount + amount } : c))
    : [...list, { label, amount }];
}

/** Every rival departure, as offers the finance engine can split demand by. */
function buildRivalOffers(ais: any[] | null | undefined) {
  return (ais || []).flatMap((ai: any) =>
    (ai.routes || []).map((r: any) => ({
      origin: r.origin,
      destination: r.destination,
      departures: r.departures || 0,
      airline: ai.name
    }))
  );
}

import { WorldMap } from "./components/WorldMap";
import { getRoutePath } from "./lib/geoUtils";

/**
 * The hub picker's option list. This used to be sorted inline in the start
 * menu's JSX, which copied 562 airports and ran an Intl collator over them on
 * every keystroke in the airline name and code fields. The list never changes,
 * so it is built once.
 */
const airportsByName: Airport[] = [...airports].sort((a, b) => a.name.localeCompare(b.name));

/** A fresh, empty cabin set-up for the route planner. A factory, so no two plans share objects. */
const createDefaultPlanningClassConfigs = (): Record<string, any> => ({
  general: { catering: [['none']], extras: ['none'], service: ['none'] },
  economy: { catering: [['none']], extras: ['none'], service: ['none'] },
  premium: { catering: [['none']], extras: ['none'], service: ['none'] },
  business: { catering: [['none']], extras: ['none'], service: ['none'] },
  first: { catering: [['none']], extras: ['none'], service: ['none'] }
});

import { ErrorBoundary } from "./components/ErrorBoundary";
import { LazyFallback } from "./components/ui/LazyFallback";
import { readJson, writeJson, readString, writeString, removeKey } from "./lib/safeStorage";
import { calculateRouteFinancials, getAirportUpkeep, getJetFuelPrice, getAircraftResaleValue, toStoredRouteMetrics, getManagementUnlockCost, applyManagementUnlock } from "./lib/financeUtils";
import { migrateSave, SAVE_VERSION } from "./lib/saveMigration";
import { nextMessageId, reserveMessageIds, capMessages, createWelcomeMessage } from "./lib/messages";
import { logError, logWarn, setDiagnosticsSummaryProvider, getDiagnostics, getLogEntries } from "./lib/debugLog";
import { findNonFinite } from "./lib/invariants";
import { formatCurrency, formatNumber, setDecimalSymbol as setNumberFormatSymbol, DecimalSymbol } from "./lib/format";
import { generateAiAirlines, simulateAiAirlinesTurn } from "./lib/aiSimulation";
import type { GameMessage } from "./lib/gameTypes";
export type { GameMessage };
import type { OwnedAircraft } from "./components/MyFleetView";
import type { ConfigOutput } from "./components/ConfigurePurchaseView";
import type { AiAirline } from "./components/CompetitorsView";

/**
 * Every one of these is reached only after a tab click or opening a route or
 * an aircraft -- never on the first paint (the start menu, then the map) --
 * so bundling all of them into the entry chunk only slowed that first paint
 * down for a screen a session might not even open. `lazy()` plus the
 * `<Suspense>` around each render site below defers the download and the
 * parse to the moment it is actually opened; on a warm cache the difference
 * is imperceptible. `RoutePlannerView` alone is ~3,600 lines and
 * `ConfigurePurchaseView` ~1,500 -- between them the two biggest single cuts
 * to the shipped bundle.
 */
const BuyAircraftView = React.lazy(() => import("./components/BuyAircraftView").then(m => ({ default: m.BuyAircraftView })));
const MyFleetView = React.lazy(() => import("./components/MyFleetView").then(m => ({ default: m.MyFleetView })));
const RoutesView = React.lazy(() => import("./components/RoutesView").then(m => ({ default: m.RoutesView })));
const RoutePlannerView = React.lazy(() => import("./components/RoutePlannerView").then(m => ({ default: m.RoutePlannerView })));
const AirportsView = React.lazy(() => import("./components/AirportsView").then(m => ({ default: m.AirportsView })));
const AirportDetailView = React.lazy(() => import("./components/AirportDetailView").then(m => ({ default: m.AirportDetailView })));
const RouteScheduleEditView = React.lazy(() => import("./components/RouteScheduleEditView"));
const ConfigurePurchaseView = React.lazy(() => import("./components/ConfigurePurchaseView").then(m => ({ default: m.ConfigurePurchaseView })));
const MyCompanyView = React.lazy(() => import("./components/MyCompanyView").then(m => ({ default: m.MyCompanyView })));
const CompetitorsView = React.lazy(() => import("./components/CompetitorsView").then(m => ({ default: m.CompetitorsView })));

import { Aircraft, aircraftList } from "./data/aircraft";
import { getEventMultipliers, getActiveEvents, setRuntimeRandomEvents, HistoricalEvent, EventChoice, eventKey } from "./lib/eventSystem";
import { generateUniqueRegistration } from "./utils/registration";
import { supabase, isCloudConfigured, ensureProfile } from "./lib/supabase";
import { AuthGate } from "./components/AuthGate";
import { ViewFrame } from "./components/ui/ViewFrame";
import { Modal } from "./components/ui/Modal";
import { StatTile } from "./components/ui/StatTile";
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



type ViewState = 'login' | 'main-menu' | 'start-menu' | 'monthly-overview' | 'game';
type ActiveWindow = 'map' | 'buy-aircraft' | 'my-fleet' | 'routes' | 'airports' | 'my-company' | 'competitors' | 'new-route';


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

  const [messages, setMessages] = useState<GameMessage[]>(() => [createWelcomeMessage()]);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [randomEvents, setRandomEventsState] = useState<HistoricalEvent[]>([]);
  /**
   * Which choice the player took for each event, keyed by eventKey. Persisted,
   * so a hedge bought in 1973 survives a save and reload halfway through the
   * crisis.
   */
  const [eventChoices, setEventChoices] = useState<Record<string, string>>({});
  /** Airline reputation, 0-100. Starts neutral: nobody has heard of you yet. */
  const [reputation, setReputation] = useState(50);
  /** Milestone ids already awarded, so each is announced once. */
  const [milestones, setMilestones] = useState<string[]>([]);
  /** Consecutive months closed without a loss, for the profit milestone. */
  const [profitStreak, setProfitStreak] = useState(0);
  /**
   * The target set each January and settled each December. Gives the calendar a
   * rhythm: before this, which month you acted in never mattered.
   */
  const [annualGoal, setAnnualGoal] = useState<{ year: number; targetProfit: number } | null>(null);
  /** The event whose decision is waiting to be made, if any. */
  const [pendingDecision, setPendingDecision] = useState<HistoricalEvent | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<GameMessage | null>(null);

  useEffect(() => {
    setRuntimeRandomEvents(randomEvents);
  }, [randomEvents]);
  
  const unreadMessagesCount = messages.filter(m => !m.isRead).length;

  // Kept across sessions; both settings used to reset on every reload.
  const [decimalSymbol, setDecimalSymbolState] = useState<DecimalSymbol>(() => {
    const stored = readString('aero_decimal_symbol') === ',' ? ',' : '.';
    setNumberFormatSymbol(stored);
    return stored;
  });
  /** The formatters are module-level, so they follow the setting from here. */
  const setDecimalSymbol = (symbol: DecimalSymbol) => {
    setNumberFormatSymbol(symbol);
    setDecimalSymbolState(symbol);
    writeString('aero_decimal_symbol', symbol);
  };
  const [airportManagement, setAirportManagement] = useState<Record<string, AirportInfrastructure>>({});
  const [showRivalRoutes, setShowRivalRoutes] = useState(true);
  const [showYourRoutes, setShowYourRoutes] = useState(true);
  const [showLiveTraffic, setShowLiveTraffic] = useState(false);
  const [isMapSettingsOpen, setIsMapSettingsOpen] = useState(false);
  const [routes, setRoutes] = useState<SimulatedRoute[]>([]);
  /**
   * Every month the airline has closed, oldest first.
   *
   * The game used to keep only the current month, in state that was not part of
   * the savegame — so loading a save showed "No financial report generated yet"
   * and there was no way to tell whether a decision had worked. The AI airlines
   * have had a monthlyProfitsHistory all along; this is the player's.
   */
  const [reportHistory, setReportHistory] = useState<any[]>([]);
  const latestReport = reportHistory.length > 0 ? reportHistory[reportHistory.length - 1] : null;
  const [openReportCategories, setOpenReportCategories] = useState<string[]>([]);
  
  const toggleReportCategory = (category: string) => {
    setOpenReportCategories(prev => 
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  // Routes used to be mirrored to an unscoped `neo_routes` key on every change:
  // a full serialisation per edit, shared between accounts on one browser, and
  // redundant with the savegames that actually restore a game. Clear the leftover.
  useEffect(() => {
    removeKey('neo_routes');
  }, []);


  const [airlineName, setAirlineName] = useState("");
  const [airlineCode, setAirlineCode] = useState("");
  const [selectedHub, setSelectedHub] = useState<string>("FRA");
  const [difficulty, setDifficulty] = useState("Normal");
  const [startingBudget, setStartingBudget] = useState("$25M");
  const [debugMode, setDebugMode] = useState(() => {
    return readString('airline_debug_mode') === 'true';
  });
  const [capital, setCapital] = useState(0);
  const [fleet, setFleet] = useState<OwnedAircraft[]>([]);
  const [selectedPurchasingAircraft, setSelectedPurchasingAircraft] = useState<Aircraft | OwnedAircraft | null>(null);
  const [externalSelectedRoute, setExternalSelectedRoute] = useState<SimulatedRoute | null>(null);
  const [aiAirlinesCount, setAiAirlinesCount] = useState(6);
  const [aiDifficulty, setAiDifficulty] = useState("Normal");
  const [aiAirlines, setAiAirlines] = useState<AiAirline[]>([]);
  const [pendingSlotBills, setPendingSlotBills] = useState<number>(0);

  /** Last closed month's profit per route id, for the route list's money column. */
  const routeProfits = useMemo(() => {
    const map: Record<string, number> = {};
    (latestReport?.routes || []).forEach((r: any) => { map[r.id] = r.profit; });
    return map;
  }, [latestReport]);

  /** The player's closed monthly profits, for the rivals leaderboard chart. */
  const playerProfitHistory = useMemo(
    () => reportHistory.map(r => r.totalProfit),
    [reportHistory]
  );

  /** Resale value of the whole fleet, for the balance sheet. */
  const fleetValue = useMemo(
    () => fleet.reduce((sum, p) => sum + getAircraftResaleValue(p), 0),
    [fleet]
  );
  /**
   * One-off spending since the last month rolled over.
   *
   * Aircraft, refits, general checks and management tiers were deducted from
   * capital the moment they were bought and then appeared in no report, so the
   * monthly profit and the change in capital routinely disagreed with nothing to
   * explain the gap. Collected here and shown as a Capex section.
   */
  const [monthlyCapex, setMonthlyCapex] = useState<{ label: string; amount: number }[]>([]);

  /**
   * Deducts a one-off cost and records it so the month's report can explain it.
   * A negative amount is money coming in (an aircraft sale).
   */
  const spend = (amount: number, label: string) => {
    setCapital(prev => prev - amount);
    setMonthlyCapex(prev => addCapexItem(prev, label, amount));
  };
  const [startDateOffset, setStartDateOffset] = useState(0); // 0 = 01/1960
  const [currentDateOffset, setCurrentDateOffset] = useState(0);
  
  const [uiScaleSetting, setUiScaleSettingState] = useState(() => {
    const stored = parseFloat(readString('aero_ui_scale') || '');
    return Number.isFinite(stored) && stored >= 0.5 && stored <= 1.5 ? stored : 1.0;
  });
  const setUiScaleSetting = (value: number) => {
    setUiScaleSettingState(value);
    writeString('aero_ui_scale', String(value));
  };
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

  /**
   * World events running this month, with how long each still has to go.
   *
   * getActiveEvents already had everything needed for this; nothing in the
   * interface ever showed it, so a player in a crisis could see the demand
   * figure had dropped but not what was causing it or when it would lift.
   */
  /**
   * Every rival departure, as offers the finance engine can split demand by.
   * Rebuilt only when the AI airlines change, not per route.
   */
  /**
   * Everything that shifts the player's demand away from the shared baseline:
   * reputation, plus any crisis relief bought this month.
   */
  const playerDemandFactor = useMemo(
    () => reputationDemandFactor(reputation) * eventReliefFactor(currentDateOffset, eventChoices),
    [reputation, currentDateOffset, eventChoices, randomEvents]
  );

  const rivalOffers = useMemo(() => buildRivalOffers(aiAirlines), [aiAirlines]);

  const activeWorldEvents = useMemo(() => {
    return getActiveEvents(currentDateOffset).map(ev => {
      const chosenId = eventChoices[eventKey(ev)];
      return {
        ...ev,
        monthsLeft: ev.startOffset + ev.duration - currentDateOffset,
        chosen: chosenId ? ev.choices?.find(c => c.id === chosenId) : undefined
      };
    });
  }, [currentDateOffset, randomEvents, eventChoices]);

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
  // inside LiveTraffic. Each route carries its parent airline's name along, since
  // flattening used to discard it entirely and every rival flight popup fell back
  // to the generic "Rival Carrier" label.
  const aiRouteList = useMemo(
    () => aiAirlines.flatMap(a => (a.routes || []).map(r => ({ ...r, airlineName: a.name, airlineCode: a.code, airlineId: a.id }))),
    [aiAirlines]
  );

  const finalUiScale = uiScaleSetting * autoScale;

  const formatDate = (offset: number) => {
    const year = 1960 + Math.floor(offset / 12);
    const month = 1 + (offset % 12);
    return `${month.toString().padStart(2, '0')}/${year}`;
  };

  // Price comes from the shared model; only the month-on-month trend string is
  // computed here, so the top bar can never disagree with what routes are billed.
  const rawPriceAtOffset = (offset: number) =>
    getJetFuelPrice(1960 + Math.floor(offset / 12), 1 + (offset % 12), difficulty);

  /**
   * The fuel price the PLAYER pays, which is the market price unless a hedge is
   * in force. getFuelPriceForAi deliberately does not go through here: the
   * rivals keep paying the market rate, which is what makes the hedge worth
   * buying.
   *
   * A hedge locks the price at the month before the event began, both ways --
   * if fuel gets cheaper during the event, the locked price is the worse deal.
   */
  const priceAtOffset = (offset: number) => {
    const market = rawPriceAtOffset(offset);
    for (const ev of getActiveEvents(offset)) {
      const choiceId = eventChoices[eventKey(ev)];
      if (!choiceId) continue;
      const choice = ev.choices?.find(c => c.id === choiceId);
      if (choice?.hedgesFuel) {
        return rawPriceAtOffset(Math.max(0, ev.startOffset - 1));
      }
    }
    return market;
  };

  const getFuelData = (offset: number) => {
    const price = priceAtOffset(offset);

    let trend = "0%";
    if (offset > 0) {
      const prevPrice = priceAtOffset(offset - 1);
      if (prevPrice > 0) {
        const diff = ((price - prevPrice) / prevPrice) * 100;
        trend = diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
      }
    }

    return { price, trend };
  };

  // Recomputed only when something it depends on changes, not on every render of App.
  const fuelData = useMemo(
    () => getFuelData(currentDateOffset),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentDateOffset, difficulty, eventChoices, randomEvents]
  );

  /**
   * Every route with this month's figures, from the same engine call the
   * monthly report makes. The route list and the map read these. The copy
   * stored on each route changes only when a month closes, so a new rival, a
   * new timetable or a new route next door showed up there a month late.
   */
  const routesWithMetrics = useMemo(() => {
    const byRegistration = new Map(fleet.map(p => [p.registration, p]));
    const year = 1960 + Math.floor(currentDateOffset / 12);
    const month = 1 + (currentDateOffset % 12);
    return routes.map(r => {
      const ac = byRegistration.get(r.aircraft);
      if (!ac) return r;
      const fin = calculateRouteFinancials(
        r, ac, fuelData.price, airportManagement, year, month, difficulty,
        airportsMapAdjusted, routes, fleet, false, playerDemandFactor, rivalOffers
      );
      return { ...r, ...toStoredRouteMetrics(fin) };
    });
    // randomEvents: calculateDemand reads the active events from module state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, fleet, fuelData.price, airportManagement, currentDateOffset, difficulty, playerDemandFactor, rivalOffers, randomEvents]);

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

  const globalDemandData = useMemo(
    () => getBaseGlobalDemand(currentDateOffset),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentDateOffset, randomEvents]
  );

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
  const [planningClassConfigs, setPlanningClassConfigs] = useState<Record<string, any>>(createDefaultPlanningClassConfigs);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editingCabinRouteId, setEditingCabinRouteId] = useState<string | null>(null);
  const [editingPricingRouteId, setEditingPricingRouteId] = useState<string | null>(null);
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
        const { pushed, conflicts } = await syncPending(userId);
        if ((pushed > 0 || conflicts > 0) && !cancelled) {
          await refreshSaves();
          const parts: string[] = [];
          if (pushed > 0) parts.push(`Synchronised ${pushed} savegame${pushed === 1 ? '' : 's'} that were waiting to upload.`);
          if (conflicts > 0) {
            parts.push(
              `${conflicts} savegame${conflicts === 1 ? ' was' : 's were'} changed on another device while this one was offline. ` +
              `Both versions are kept: the offline one is listed as "(offline copy)".`
            );
            logWarn('saves', `Kept ${conflicts} offline cop${conflicts === 1 ? 'y' : 'ies'} after a sync conflict`);
          }
          setAppAlert(parts.join(' '));
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
    const parsed = readJson<any>('neo_autosave_settings', null);
    if (parsed) {
      if (parsed.autosaveInterval !== undefined) setAutosaveInterval(parsed.autosaveInterval);
      if (parsed.autosaveOverwrite !== undefined) setAutosaveOverwrite(parsed.autosaveOverwrite);
    }
  }, []);

  useEffect(() => {
    writeJson('neo_autosave_settings', { autosaveInterval, autosaveOverwrite });
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
    const routeDetails: { id: string, name: string, profit: number, revenue: number, cost: number, paxPerWeek: number, capacity: number }[] = [];
    // Samples for the reputation update further down.
    let repPaxWeek = 0;
    let repSatTimesPax = 0;
    let repSeatsWeek = 0;
    const flyingRegs = new Set<string>();

    routes.forEach(r => {
      const ac = fleet.find(a => a.registration === r.aircraft);
      if (ac) {
        const fin = calculateRouteFinancials(
          r, ac, currentFuelPrice, airportManagement, currentYearNum, currentMonthNum,
          difficulty, localAirportsMap, routes, fleet, false,
          playerDemandFactor, rivalOffers
        );
        // `|| 0` below would hide a NaN as a zero; name the field instead.
        const nonFinite = findNonFinite(fin);
        if (nonFinite.length > 0) {
          logWarn('month', `Route ${r.id} (${r.origin}-${r.destination}) produced non-finite numbers`, nonFinite);
        }
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

        // routeSat is per cabin class, so weight it by the passengers who
        // actually travelled in each before folding it into the airline figure.
        Object.entries(fin.paxByClass || {}).forEach(([cls, pax]: [string, any]) => {
          const actual = pax?.actual || 0;
          if (actual > 0) {
            repSatTimesPax += (fin.routeSat?.[cls] || 0) * actual;
            repPaxWeek += actual;
          }
        });
        repSeatsWeek += fin.weightedSeatsPerWeek || 0;
        flyingRegs.add(r.aircraft);

        const weeklySeats = Object.values(fin.paxByClass || {}).reduce((sum: number, pax: any) => sum + (pax?.max || 0), 0);

        routeDetails.push({
          id: r.id,
          name: `${r.origin}-${r.destination} (${r.aircraft})`,
          profit: mProfit,
          revenue: mRev,
          cost: mCost,
          paxPerWeek: fin.paxPerWeek || 0,
          capacity: weeklySeats
        });
      } else {
        logWarn('month', `Route ${r.id} has no aircraft ${r.aircraft}; it earned nothing this month`);
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

    // Inbox messages produced by this tick. Declared here because the
    // milestone check below already writes into it.
    const additionalMessages: GameMessage[] = [];

    // --- Reputation -------------------------------------------------------
    // Only updated when something actually flew. An airline with no routes is
    // not judged one way or the other, so its reputation simply holds.
    let nextReputation = reputation;
    if (repPaxWeek > 0 && flyingRegs.size > 0) {
      const flying = fleet.filter(f => flyingRegs.has(f.registration));
      const meanInterior = flying.reduce((a, f) => a + (f.conditionInterior ?? 100), 0) / flying.length;
      const meanAirframe = flying.reduce((a, f) => a + (f.conditionGeneral ?? 100), 0) / flying.length;
      const target = computeReputationTarget({
        weightedSat: repSatTimesPax / repPaxWeek,
        meanInterior,
        meanAirframe,
        loadFactor: repSeatsWeek > 0 ? repPaxWeek / repSeatsWeek : 0
      });
      nextReputation = reputation + (target - reputation) * REPUTATION_INERTIA;
    }

    // --- Milestones -------------------------------------------------------
    // A month without a single route is not a profitable month; it neither
    // extends the streak nor breaks it unless it lost money.
    const nextStreak = totalMonthlyProfit < 0 ? 0 : routes.length > 0 ? profitStreak + 1 : profitStreak;
    setProfitStreak(nextStreak);

    const servedContinents = new Set<string>();
    let longestKm = 0;
    routes.forEach(r => {
      longestKm = Math.max(longestKm, r.distance || 0);
      [r.origin, r.destination].forEach(id => {
        const ap = localAirportsMap.get(id);
        if (ap) servedContinents.add(continentOf(ap.coords));
      });
    });

    const mctx: MilestoneContext = {
      routeCount: routes.length,
      fleetSize: fleet.length,
      capital: capital + totalMonthlyProfit,
      longestRouteKm: longestKm,
      continents: servedContinents.size,
      profitableMonthStreak: nextStreak,
      reputation: nextReputation
    };

    const newlyEarned = MILESTONES.filter(m => !milestones.includes(m.id) && m.met(mctx));
    if (newlyEarned.length > 0) {
      setMilestones(prev => [...prev, ...newlyEarned.map(m => m.id)]);
      nextReputation = Math.min(100, nextReputation + newlyEarned.reduce((a, m) => a + m.reputationBonus, 0));
      newlyEarned.forEach((m, i) => {
        additionalMessages.push({
          id: nextMessageId(),
          text: `MILESTONE: ${m.title}`,
          isRead: false,
          dateStr: offsetToDateStr(currentDateOffset),
          details: {
            title: m.title,
            source: 'Board of Directors',
            content:
              `${m.detail}\n\n` +
              (m.reputationBonus > 0
                ? `Reputation +${m.reputationBonus}.`
                : `No bonus attached -- this one is the reward.`)
          }
        });
      });
    }


    const capexTotal = monthlyCapex.reduce((sum, c) => sum + c.amount, 0);

    const report = {
      month: currentMonthNum,
      year: currentYearNum,
      routeRevenues: totalRouteRevenues,
      routeCosts: totalRouteCosts,
      airportUpkeep: totalAirportUpkeep,
      totalProfit: totalMonthlyProfit,
      pendingSlotBills: pendingSlotBills,
      // Operating result minus the one-off spending, i.e. what actually moved
      // the bank balance this month.
      capex: capexTotal,
      capexItems: monthlyCapex,
      cashChange: totalMonthlyProfit - capexTotal,
      capitalAfter: capital + totalMonthlyProfit,
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
    };

    // Keep ten years. Long enough for any chart the game shows, short enough
    // that the savegame does not grow without bound over a sixty-year run.
    setReportHistory(prev => [...prev, report].slice(-120));

    // Apply Financials
    setCapital(prev => prev + totalMonthlyProfit);
    setPendingSlotBills(0);
    setMonthlyCapex([]);

    // Simulate AI Controlled Airlines
    let aiMessages: GameMessage[] = [];
    let aisAfterTurn = aiAirlines;
    if (aiAirlines.length > 0) {
      const { updatedAis, newMessages } = simulateAiAirlinesTurn(
        aiAirlines,
        airports,
        currentDateOffset,
        selectedHub,
        routes
      );
      setAiAirlines(updatedAis);
      aiMessages = newMessages;
      aisAfterTurn = updatedAis;
    }

    const nextOffset = currentDateOffset + 1;
    const isNextJanuary = nextOffset % 12 === 0;

    // Which world events are running right now. Compared against the same list
    // for next month further below, this is what tells the player an event
    // started or ended -- for scripted history as well as random events.
    const activeBefore = new Set(getActiveEvents(currentDateOffset).map(eventKey));

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
          id: nextMessageId(),
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
          id: nextMessageId(),
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

    }

    // --- Annual goal -------------------------------------------------------
    // Settled in December against the twelve months just closed, then a new one
    // is set for January. The target is 15% above what the year actually
    // delivered, with a floor so the first year is not trivially met.
    const closingYear = currentYearNum;
    const isDecember = currentMonthNum === 12;
    if (isDecember) {
      const yearReports = [...reportHistory, report].filter(
        r => r && r.year === closingYear
      );
      const achieved = yearReports.reduce((a, r) => a + (r.totalProfit || 0), 0);

      if (annualGoal && annualGoal.year === closingYear) {
        const met = achieved >= annualGoal.targetProfit;
        if (met) nextReputation = Math.min(100, nextReputation + 4);
        additionalMessages.push({
          id: nextMessageId(),
          text: met
            ? `TARGET MET: ${closingYear} closed at ${formatCurrency(achieved)}.`
            : `TARGET MISSED: ${closingYear} closed at ${formatCurrency(achieved)}.`,
          isRead: false,
          dateStr: offsetToDateStr(currentDateOffset),
          details: {
            title: `${closingYear} annual result`,
            source: 'Board of Directors',
            content:
              `Target for ${closingYear}: ${formatCurrency(annualGoal.targetProfit)}\n` +
              `Achieved: ${formatCurrency(achieved)}\n\n` +
              (met ? 'The board is satisfied. Reputation +4.' : 'The board expected more.')
          }
        });
      }

      const nextTarget = Math.max(2_000_000, Math.round(achieved * 1.15));
      setAnnualGoal({ year: closingYear + 1, targetProfit: nextTarget });
      additionalMessages.push({
        id: nextMessageId(),
        text: `TARGET FOR ${closingYear + 1}: ${formatCurrency(nextTarget)} operating profit.`,
        isRead: false,
        dateStr: offsetToDateStr(currentDateOffset),
        details: {
          title: `${closingYear + 1} target`,
          source: 'Board of Directors',
          content:
            `The board expects ${formatCurrency(nextTarget)} of operating profit across ${closingYear + 1}, ` +
            `15% above what ${closingYear} delivered.\n\nMeeting it is worth 4 reputation.`
        }
      });
    }

    // Written once, after both the milestone and the annual-goal bonuses have
    // had their say. Setting it earlier silently dropped the December bonus.
    setReputation(nextReputation);

    // 3. Announce every event that starts or ends with this tick.
    const afterEvents = getActiveEvents(nextOffset);
    const activeAfter = new Set(afterEvents.map(eventKey));

    for (const ev of afterEvents) {
      if (!activeBefore.has(eventKey(ev))) {
        additionalMessages.push(buildEventStartMessage(ev, nextMessageId()));
        // An event that offers a decision puts it to the player now, once. If
        // they close the dialog without choosing, the default is to do nothing.
        if (ev.choices && ev.choices.length > 0 && !eventChoices[eventKey(ev)]) {
          setPendingDecision(ev);
        }
      }
    }
    for (const ev of getActiveEvents(currentDateOffset)) {
      if (!activeAfter.has(eventKey(ev))) {
        additionalMessages.push(buildEventEndMessage(ev, nextMessageId(), nextOffset));
      }
    }

    if (aiMessages.length > 0 || additionalMessages.length > 0) {
      setMessages(prev => capMessages([...additionalMessages, ...aiMessages, ...prev]));
    }
    
    // Advance time and update view. The autosave decision is made here rather than
    // inside the state updater: updaters must be pure, and StrictMode runs them twice.
    const monthsPassed = nextOffset - startDateOffset;
    if (autosaveInterval >= 1 && autosaveInterval <= 12 && monthsPassed > 0 && monthsPassed % autosaveInterval === 0) {
      setPendingAutosave(true);
    }
    setCurrentDateOffset(nextOffset);

    // The figures stored on each route are next month's forecast. They used to
    // leave out reputation, crisis relief and every rival, so the route list and
    // the map disagreed with the report the same route then produced.
    const nextDemandFactor = reputationDemandFactor(nextReputation) * eventReliefFactor(nextOffset, eventChoices);
    const nextRivalOffers = buildRivalOffers(aisAfterTurn);
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
          fleet,
          false,
          nextDemandFactor,
          nextRivalOffers
        );
        updatedRoute = { ...updatedRoute, ...toStoredRouteMetrics(fin) };
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

      // Wear rates, capped so a year (12 calls to handleAdvanceMonth) can never lose
      // more than 12% interior / 8% general condition, however many hours are flown.
      // The small constant term makes parked aircraft age too, slowly.
      const INTERIOR_WEAR_PER_HOUR = 0.0012;
      const AIRFRAME_WEAR_PER_HOUR = 0.00076;
      const IDLE_WEAR_PER_MONTH = 0.1;
      const IC_MONTHLY_CAP = 12 / 12;
      const GC_MONTHLY_CAP = 8 / 12;

      const interiorDecay = Math.min(
        monthlyFlightHours * INTERIOR_WEAR_PER_HOUR + IDLE_WEAR_PER_MONTH,
        IC_MONTHLY_CAP
      );
      // conditionGeneral previously never decreased at all, which made the general
      // check a pure money sink and the "< 40 %" fleet warning unreachable.
      const airframeDecay = Math.min(
        monthlyFlightHours * AIRFRAME_WEAR_PER_HOUR + IDLE_WEAR_PER_MONTH,
        GC_MONTHLY_CAP
      );

      return {
        ...plane,
        conditionInterior: Math.max(0, plane.conditionInterior - interiorDecay),
        conditionGeneral: Math.max(0, plane.conditionGeneral - airframeDecay)
      };
    }));
  };

  const [sessionKey, setSessionKey] = useState(Date.now());
  
  const handleSaveGame = async (slotId?: string, customName?: string, isAutosave: boolean = false) => {
    try {
      await saveGameUnsafe(slotId, customName, isAutosave);
    } catch (e) {
      // Saving must never fail silently: the player would carry on believing
      // the game is safe. The autosave path used to reject into the void.
      logError('saves', 'Saving failed', e);
      setAppAlert(`Saving failed: ${(e as Error)?.message || 'unknown error'}. Your game is still running; try again or free some browser storage.`);
    }
  };

  const saveGameUnsafe = async (slotId?: string, customName?: string, isAutosave: boolean = false) => {
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
      saveVersion: SAVE_VERSION,
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
      monthlyCapex,
      reportHistory,
      eventChoices,
      reputation,
      milestones,
      profitStreak,
      annualGoal,
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

  /**
   * Clears everything that belongs to one game session but is not part of the
   * savegame: the planner, the editors, open dialogs, the inbox and the random
   * events. "Start Game" after a loaded game used to inherit the previous
   * game's events and messages, and a loaded game could open with the old
   * planner still half-filled.
   */
  const resetTransientGameState = () => {
    const welcome = [createWelcomeMessage()];
    setMessages(welcome);
    reserveMessageIds(welcome);
    setSelectedMessage(null);
    setIsMessagesOpen(false);
    setRandomEventsState([]);
    setRuntimeRandomEvents([]);
    setPendingDecision(null);
    setIsPlanningRoute(false);
    setPlanningOriginId(null);
    setPlanningDestId(null);
    setPlanningReg(null);
    setPlanningStep(1);
    setPlanningSchedule([]);
    setPlanningClassConfigs(createDefaultPlanningClassConfigs());
    setEditingRouteId(null);
    setEditingCabinRouteId(null);
    setEditingPricingRouteId(null);
    setIsEditingSchedule(false);
    setIsPurchasingForRoute(false);
    setExternalSelectedRoute(null);
    setSelectedAirport(null);
    setSelectedPurchasingAircraft(null);
    setRouteFilter("");
    setActiveWindow('map');
  };

  const handleLoadGame = async (slotId: string) => {
    let raw: any;
    try {
      raw = await readSave(userId, slotId);
    } catch (e) {
      logError('saves', `Reading save ${slotId} failed`, e);
      setAppAlert("This savegame could not be read.");
      return;
    }
    if (!raw) {
      setAppAlert("Save file missing!");
      return;
    }

    let saveObj: any;
    try {
      saveObj = migrateSave(raw);
    } catch (e) {
      logError('saves', `Savegame ${slotId} is not usable`, e);
      setAppAlert(`Error loading save file: ${(e as Error)?.message || 'unknown error'}`);
      return;
    }

    resetTransientGameState();

    setAirlineName(saveObj.airlineName);
    setAirlineCode(saveObj.airlineCode);
    setSelectedHub(saveObj.selectedHub);
    setDifficulty(saveObj.difficulty);
    setStartingBudget(saveObj.startingBudget || "$25M");
    const loadedDebug = saveObj.debugMode === true;
    setDebugMode(loadedDebug);
    writeString('airline_debug_mode', String(loadedDebug));
    setCapital(saveObj.capital);
    setFleet(saveObj.fleet);
    setAiAirlinesCount(saveObj.aiAirlinesCount);
    setAiDifficulty(saveObj.aiDifficulty);
    setStartDateOffset(saveObj.startDateOffset);
    setCurrentDateOffset(saveObj.currentDateOffset);
    setAirportManagement(saveObj.airportManagement);
    setRoutes(saveObj.routes);
    // Saves from before rival airlines existed get a fresh set.
    setAiAirlines(saveObj.aiAirlines ?? generateAiAirlines(saveObj.aiAirlinesCount, saveObj.aiDifficulty, saveObj.selectedHub, saveObj.startDateOffset));
    setPendingSlotBills(saveObj.pendingSlotBills);
    setMonthlyCapex(saveObj.monthlyCapex);
    setReportHistory(saveObj.reportHistory);
    setEventChoices(saveObj.eventChoices);
    setReputation(saveObj.reputation);
    setMilestones(saveObj.milestones);
    setProfitStreak(saveObj.profitStreak);
    setAnnualGoal(saveObj.annualGoal);
    setMessages(saveObj.messages);
    reserveMessageIds(saveObj.messages);
    setRandomEventsState(saveObj.randomEvents);
    setRuntimeRandomEvents(saveObj.randomEvents);

    setSessionKey(Date.now());
    setCurrentSaveId(slotId);
    setCurrentSaveName(saves.find(s => s.id === slotId)?.name || "Loaded Save");
    setView('game');
    setIsGameMenuOpen(false);
    setShowLoadMenu(false);
    setAppAlert("Game loaded successfully!");
  };

  const deleteSave = async (id: string) => {
    setSaves(prev => prev.filter(s => s.id !== id));
    await deleteSaveSlot(userId, id);
  };

  // Handlers handed to the memoised views. They only use state setters, so they
  // can keep one identity for the life of the app; inline arrows here used to
  // defeat React.memo on every render of App.
  const handleSellAircraft = React.useCallback((plane: OwnedAircraft) => {
    const value = getAircraftResaleValue(plane);

    // Recorded like any other one-off amount, so the month's report explains
    // the jump in capital instead of leaving it unaccounted for.
    setCapital(prev => prev + value);
    setMonthlyCapex(prev => addCapexItem(prev, 'Aircraft Sales', -value));
    setFleet(prev => prev.filter(p => p.registration !== plane.registration));
    setRoutes(prev => prev.filter(r => r.aircraft !== plane.registration));
    
    setAppAlert(`SUCCESS: You sold ${plane.registration} (${plane.manufacturer} ${plane.type}) for ${formatCurrency(value)}. All assigned routes have been decommissioned.`);
  }, []);

  const handleRenovateAircraft = React.useCallback((plane: OwnedAircraft) => {
    setSelectedPurchasingAircraft(plane);
    setActiveWindow('buy-aircraft');
  }, []);

  const handleShowRoute = React.useCallback((route: SimulatedRoute) => {
    setExternalSelectedRoute(route);
    setActiveWindow('routes');
  }, []);

  const handleStartRouteWithAircraft = React.useCallback((reg: string) => {
    setIsPlanningRoute(true);
    setPlanningReg(reg);
    setPlanningOriginId(null);
    setPlanningDestId(null);
  }, []);

  const handleOpenPlanner = React.useCallback(() => setIsPlanningRoute(true), []);
  /**
   * Unlocks a management tier at an airport. The route planner and the airport
   * console each had their own copy of this with different prices, and only
   * the console's applied the tier's effects.
   */
  const handleUnlockManagement = (airportId: string, tier: ManagementLevel) => {
    const cost = getManagementUnlockCost(airportsMapAdjusted.get(airportId)?.level || 1, tier);
    if (capital < cost) {
      setAppAlert(`Unlocking T${tier} management at ${airportId} costs ${formatCurrency(cost)}, but you only have ${formatCurrency(capital)}.`);
      return;
    }
    spend(cost, `Airport Management T${tier}`);
    setAirportManagement(prev => ({ ...prev, [airportId]: applyManagementUnlock(prev[airportId], tier) }));
  };

  const handleDeleteRoute = React.useCallback((id: string) => setRoutes(prev => prev.filter(r => r.id !== id)), []);
  const handleClearExternalRoute = React.useCallback(() => setExternalSelectedRoute(null), []);

  const handleChangeRouteAircraft = React.useCallback((route: SimulatedRoute) => {
    setPlanningOriginId(route.origin);
    setPlanningDestId(route.destination);
    setPlanningReg(route.aircraft);
    setPlanningStep(1);
    setEditingRouteId(route.id);
    setIsPlanningRoute(true);
  }, []);

  const handleEditSchedule = React.useCallback((id: string) => {
    setEditingRouteId(id);
    setIsEditingSchedule(true);
    setIsPlanningRoute(false);
  }, []);

  const handleUpdatePricing = React.useCallback((id: string, pricing: Record<string, number>) => {
    setRoutes(prev => prev.map(r => (r.id !== id ? r : { ...r, ticketPrices: pricing })));
  }, []);

  const handlePurchase = (
    aircraft: Aircraft, 
    quantity: number, 
    config: ConfigOutput,
    baseInteriorPop: number,
    totalCost: number
  ) => {
    let isRenovating = 'registration' in aircraft;
    if (capital < totalCost) {
      setAppAlert(
        `${isRenovating ? 'This refit' : 'This purchase'} costs ${formatCurrency(totalCost)}, ` +
        `but you only have ${formatCurrency(capital)}. Nothing was bought.`
      );
      return;
    }
    if (capital >= totalCost) {
      spend(totalCost, isRenovating ? 'Cabin Refits' : 'Aircraft Purchases');
      
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

  /** The way out of a tab whose screen failed to render. */
  const backToMap = () => {
    setSelectedPurchasingAircraft(null);
    setExternalSelectedRoute(null);
    setActiveWindow('map');
  };

  // Close the schedule editor when its route or aircraft goes away underneath it.
  useEffect(() => {
    if (!isEditingSchedule || !editingRouteId) return;
    const route = routes.find(r => r.id === editingRouteId);
    const hasAircraft = route ? fleet.some(a => a.registration === route.aircraft) : false;
    if (!route || !hasAircraft) {
      logWarn('schedule', `Closed the schedule editor: route ${editingRouteId} or its aircraft no longer exists`);
      setIsEditingSchedule(false);
      setEditingRouteId(null);
      setAppAlert('That route or its aircraft no longer exists, so the schedule editor was closed.');
    }
  }, [isEditingSchedule, editingRouteId, routes, fleet]);

  // What a diagnostics export says about the game it was taken from. A ref, so
  // the provider always reads the latest render without re-registering.
  const diagnosticsRef = useRef<Record<string, unknown>>({});
  diagnosticsRef.current = {
    view,
    activeWindow,
    date: formatDate(currentDateOffset),
    difficulty,
    capital,
    fleet: fleet.length,
    routes: routes.length,
    aiAirlines: aiAirlines.length,
    reportMonths: reportHistory.length,
    messages: messages.length,
    saveId: currentSaveId,
    signedIn: Boolean(userId),
    cloudOnline
  };
  useEffect(() => {
    setDiagnosticsSummaryProvider(() => diagnosticsRef.current);
    return () => setDiagnosticsSummaryProvider(null);
  }, []);

  // Console access to the diagnostic log while debug mode is on.
  useEffect(() => {
    if (!debugMode) return;
    (window as any).__amneo = { getDiagnostics, getLogEntries };
    return () => { delete (window as any).__amneo; };
  }, [debugMode]);

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
          {/* World event decision. The first point in the game where a crisis
              asks the player something instead of simply happening to them. */}
          {pendingDecision && (
            <Modal open size="lg" accent="warn" layer="top">
              <h3 className="text-aero-warn font-black uppercase tracking-widest text-lg mb-1 flex items-center gap-2">
                <AlertTriangle size={22} /> {pendingDecision.title}
              </h3>
              <p className="text-2xs font-mono text-white/50 mb-4 leading-relaxed">
                {pendingDecision.description} Running for {pendingDecision.duration} months.
              </p>

              <div className="space-y-2">
                {pendingDecision.choices?.map((choice: EventChoice) => {
                  const affordable = capital >= choice.cost;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      disabled={!affordable}
                      onClick={() => {
                        if (choice.cost > 0) spend(choice.cost, `Crisis response: ${pendingDecision.title}`);
                        setEventChoices(prev => ({ ...prev, [eventKey(pendingDecision)]: choice.id }));
                        setPendingDecision(null);
                      }}
                      className="w-full text-left p-3 border border-white/10 bg-white/[0.03] hover:border-aero-yellow hover:bg-white/[0.06] transition-all disabled:opacity-40 disabled:hover:border-white/10 disabled:cursor-not-allowed rounded-sm"
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span className="font-black uppercase tracking-widest text-2xs text-white">{choice.label}</span>
                        <span className={`font-mono text-2xs font-bold shrink-0 ${choice.cost > 0 ? 'text-aero-yellow' : 'text-aero-good'}`}>
                          {choice.cost > 0 ? formatCurrency(choice.cost) : 'No cost'}
                        </span>
                      </div>
                      <p className="text-2xs font-mono text-white/50 leading-relaxed">{choice.detail}</p>
                      {!affordable && (
                        <p className="text-2xs font-mono text-aero-warn mt-1">
                          {formatCurrency(choice.cost - capital)} short.
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setPendingDecision(null)}
                  className="px-3 py-2 text-white/40 hover:text-white text-2xs font-mono uppercase tracking-widest transition-colors bg-transparent border-0"
                >
                  Decide later (does nothing)
                </button>
              </div>
            </Modal>
          )}
          {appAlert && (
            <Modal open size="md" layer="top" onClose={() => setAppAlert(null)}>
              <h3 className="text-aero-yellow font-black uppercase tracking-widest text-lg mb-4 flex items-center gap-2">
                <AlertTriangle size={24} /> System Alert
              </h3>
              <p className="text-white/80 mb-3">{appAlert}</p>
              <div className="flex justify-end">
                <button
                  onClick={() => setAppAlert(null)}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-bold uppercase tracking-wider transition-colors rounded-sm"
                >
                  OK
                </button>
              </div>
            </Modal>
          )}
          <div className="flex-1 relative flex overflow-hidden">
            {/* Sidebar for Game View */}
        {view === 'game' && (
          <div className="w-14 lg:w-16 bg-aero-panel border-r border-white/10 flex flex-col items-center pb-4 shrink-0 z-50 h-full overflow-y-auto no-scrollbar">
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
                className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col items-center justify-center p-4 bg-aero-black relative"
              >
                <div className="absolute top-4 right-8 z-50 flex items-center gap-4">
                  <div className="text-white/40 font-mono text-xs tracking-widest flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shadow-2xl ${userId ? (cloudOnline ? 'bg-aero-yellow animate-pulse' : 'bg-white/30') : 'bg-white/20'}`}></div>
                    {user || 'UNKNOWN_USER'}
                  </div>
                  <div className="h-4 w-px bg-white/10"></div>
                  <span className="text-white/25 font-mono text-2xs uppercase tracking-widest">{cloudStatusLabel}</span>
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

                <div className="w-full max-w-2xl z-10 flex flex-col gap-12 border border-white/5 bg-aero-panel/30 rounded-sm p-8 lg:p-14">
                  <div className="space-y-4">
                    <Bird className="text-aero-yellow" size={64} strokeWidth={2.5} />
                    <h1 className="text-8xl font-black italic tracking-tighter leading-none">
                      <span className="text-aero-yellow">AM</span><br/>
                      <span className="text-white">NEO</span>
                    </h1>
                    <p className="text-2xs tracking-[0.4em] font-light text-white/40 pl-2">COMMAND INTERFACE v4.2</p>
                  </div>

                  {legacySaveCount > 0 && (
                    <div className="bg-aero-yellow/5 border border-aero-yellow/30 rounded-sm p-4 flex flex-col gap-3">
                      <div className="text-2xs font-mono uppercase tracking-widest text-aero-yellow font-bold">
                        {legacySaveCount} savegame{legacySaveCount === 1 ? '' : 's'} found from before accounts existed
                      </div>
                      <p className="text-2xs font-mono text-white/40 leading-relaxed">
                        They are still stored in this browser. Import them into your account to
                        reach them from any device. The originals are left untouched.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={handleImportLegacySaves}
                          disabled={isImportingLegacy}
                          className="px-4 py-2 bg-aero-yellow text-black font-black uppercase tracking-widest text-2xs hover:bg-white transition-colors disabled:opacity-50 rounded-sm"
                        >
                          {isImportingLegacy ? 'Importing...' : 'Import into my account'}
                        </button>
                        <button
                          onClick={() => setLegacySaveCount(0)}
                          className="px-4 py-2 border border-white/20 text-white/50 font-black uppercase tracking-widest text-2xs hover:text-white transition-colors rounded-sm"
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
                          {airportsByName.map(a => (
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
                              writeString('airline_debug_mode', String(opt.value));
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
                          // A new game starts clean: no events, messages or open
                          // editors carried over from a game played earlier.
                          resetTransientGameState();
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
                          setMonthlyCapex([]);
                          setReportHistory([]);
                          setEventChoices({});
                          setPendingDecision(null);
                          setReputation(50);
                          setMilestones([]);
                          setProfitStreak(0);
                          setAnnualGoal(null);
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
                   <ErrorBoundary label="Monthly Report" onReset={() => setView('game')} resetLabel="CONTINUE">
                    {latestReport ? (
                      <>
                      <FinancialReport
                         title="Monthly Financial Overview"
                         netProfit={latestReport.totalProfit}
                         totalRevenue={latestReport.routeRevenues}
                         revenues={(latestReport.routes || []).map((r: any) => ({
                           label: `${r.name}${r.capacity > 0 ? ` (${Math.round((r.paxPerWeek / r.capacity) * 100)}% LF)` : ''}`,
                           amount: r.revenue
                         }))}
                         expenses={[
                           {
                             id: 'routeCosts',
                             label: 'Route Operational Costs',
                             total: latestReport.routeCosts,
                             items: [
                               { label: `Jet Fuel (${formatNumber(latestReport.breakdown.fuelLiters || 0)} L @ $${(latestReport.breakdown.fuelPriceL || 0).toFixed(3)})`, amount: latestReport.breakdown.fuel },
                               { label: 'In-Flight Catering & Amenities', amount: latestReport.breakdown.catering },
                               { label: 'Flight Crew & Ground Staff Salaries', amount: latestReport.breakdown.staff },
                               { label: 'Landing & passenger fees', amount: latestReport.breakdown.routeInfra }
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
                           // Slots are billed into the month's result, so they
                           // belong above the line, not in capex.
                           // Signed: selling slots back refunds money, which the
                           // report used to drop because only purchases were shown.
                           ...((latestReport.breakdown.purchasedSlots || 0) !== 0 ? [{
                             id: 'slots',
                             label: 'Slot purchases & refunds',
                             variant: 'net' as const,
                             total: -latestReport.breakdown.purchasedSlots,
                             items: [{
                               label: latestReport.breakdown.purchasedSlots > 0 ? 'Slot rights bought this month' : 'Slot rights sold back this month',
                               amount: -latestReport.breakdown.purchasedSlots
                             }]
                           }] : []),
                           // These left the bank account but are not part of the
                           // operating profit above — without them the profit and
                           // the change in capital never reconcile.
                           // Signed as well: aircraft sales come in here.
                           ...((latestReport.capexItems || []).some((i: any) => i.amount !== 0) ? [{
                             id: 'capex',
                             label: 'One-off investments & sales (below the line)',
                             variant: 'net' as const,
                             total: -(latestReport.capex || 0),
                             items: (latestReport.capexItems || [])
                               .filter((i: any) => i.amount !== 0)
                               .map((i: any) => ({ label: i.label, amount: -i.amount }))
                           }] : []),
                           ...(latestReport.routes && latestReport.routes.length > 0 ? [{
                             id: 'routeBreakdown',
                             label: 'Route Breakdown',
                             // Profits and losses per route, not deductions — see
                             // the 'net' variant in FinancialReport.
                             variant: 'net' as const,
                             total: latestReport.routes.reduce((sum: number, r: any) => sum + r.profit, 0),
                             items: latestReport.routes.map((r: any) => ({
                               label: `${r.name} (Rev: ${formatCurrency(r.revenue)}, Exp: ${formatCurrency(r.cost)})`,
                               amount: r.profit
                             }))
                           }] : [])
                         ]}
                         defaultOpen={true}
                      />
                      {/* Operating profit and the change in the bank balance are
                          different numbers whenever anything was bought. Stating
                          both, next to each other, is what makes the report add up. */}
                      <div className="mt-4 flex items-center justify-between border border-white/10 bg-black/30 px-4 py-3 font-mono text-xs">
                        <span className="uppercase tracking-widest text-white/40 font-bold">Cash change this month</span>
                        <span className={(latestReport.cashChange ?? latestReport.totalProfit) >= 0 ? 'text-aero-good font-bold' : 'text-aero-warn font-bold'}>
                          {(latestReport.cashChange ?? latestReport.totalProfit) >= 0 ? '+' : ''}
                          {formatCurrency(latestReport.cashChange ?? latestReport.totalProfit)}
                        </span>
                      </div>
                      </>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-white/40">
                        No financial data available for this month.
                      </div>
                    )}
                   </ErrorBoundary>
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
                <div className="h-14 bg-aero-carbon border-b border-white/5 flex items-center justify-between px-4 shrink-0 relative z-50">
                  <div className="flex gap-5 items-center">
                    <GameStat label="Capital" value={formatCurrency(capital)} />
                    <GameStat label="Fleet" value={fleet.length.toString()} />
                    <GameStat label="Routes" value={routes.length.toString()} />
                    <GameStat label="Reputation" value={`${Math.round(reputation)}`} />
                    <GameStat label="Global Demand" value={`${Math.round(globalDemandData.value * 100)}%`} trend={globalDemandData.trend} />
                    <GameStat label="Fuel" value={`$${formatNumber(fuelData.price / 3.78541, 3)}`} trend={fuelData.trend} goodDirection="down" />
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
                         className={`flex items-center gap-2 px-3 py-1 border text-2xs uppercase font-bold tracking-widest transition-all rounded-sm ${unreadMessagesCount > 0 ? 'bg-aero-yellow text-black border-aero-yellow' : 'bg-white/5 text-white hover:bg-white/10 border-white/10'}`}
                       >
                         <Bell size={12} />
                         <span className="hidden sm:inline">Messages</span>
                         {unreadMessagesCount > 0 && (
                           <span className="ml-1 bg-black text-aero-yellow px-1.5 py-0.5 text-4xs rounded-sm">{unreadMessagesCount}</span>
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
                          <label className="flex items-center gap-3 text-xs uppercase font-bold tracking-widest text-aero-yellow cursor-pointer hover:bg-white/5 p-2 transition-colors">
                            <input type="checkbox" checked={showYourRoutes} onChange={(e) => setShowYourRoutes(e.target.checked)} className="accent-aero-yellow w-4 h-4 cursor-pointer" />
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

                {/* Active Events Banner. The banner itself already existed; what it
                    never said was how much longer the event runs, which is the one
                    thing a player needs in order to decide whether to ride it out. */}
                {activeWorldEvents.map((ev, i) => (
                   <div key={`idx-${i}`} className="bg-aero-warn/10 border-b border-aero-warn/40 text-white/80 px-4 py-2.5 flex items-center gap-4 z-40 shrink-0 shadow-2xl">
                      <AlertTriangle className="text-aero-warn shrink-0" size={16} />
                      <div className="flex-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-4 min-w-0">
                         <span className="font-black uppercase tracking-widest text-aero-warn text-[10px] shrink-0">{ev.title}</span>
                         <span className="text-[10px] md:text-[11px] font-bold text-white/70 shrink-0 whitespace-nowrap">
                            {ev.monthsLeft} {ev.monthsLeft === 1 ? 'month' : 'months'} left
                         </span>
                         {ev.chosen && ev.chosen.cost > 0 && (
                            <span className="text-[10px] font-mono font-bold text-aero-good shrink-0 whitespace-nowrap border border-aero-good/40 px-1.5 py-0.5">
                               {ev.chosen.label}
                            </span>
                         )}
                         {!ev.chosen && ev.choices && ev.choices.length > 0 && (
                            <button
                               type="button"
                               onClick={() => setPendingDecision(ev)}
                               className="text-[10px] font-mono font-bold text-black bg-aero-yellow hover:bg-white shrink-0 whitespace-nowrap px-1.5 py-0.5 border-0 cursor-pointer transition-colors"
                            >
                               Decision pending
                            </button>
                         )}
                         <span className="text-[10px] md:text-[11px] opacity-70 truncate font-mono">{ev.description}</span>
                         <span className="text-[10px] md:text-[11px] font-bold text-aero-warn ml-auto whitespace-nowrap">
                            {/* What the player actually gets: bought relief softens the
                                event's demand hit (see eventReliefFactor). The banner
                                used to show the raw hit even after paying for relief. */}
                            {(() => {
                              const softens = ev.chosen?.softensDemand;
                              const effective = softens && ev.demandMultiplier < 1
                                ? ev.demandMultiplier + (1 - ev.demandMultiplier) * softens
                                : ev.demandMultiplier;
                              const pct = (m: number) => `${m >= 1 ? '+' : ''}${((m - 1) * 100).toFixed(0)}%`;
                              return `PAX: ${pct(effective)}${effective !== ev.demandMultiplier ? ` (market ${pct(ev.demandMultiplier)})` : ''} | FUEL: ${pct(ev.fuelMultiplier)}`;
                            })()}
                         </span>
                      </div>
                   </div>
                ))}

                {/* Main Viewport */}
                <div className="flex-1 relative bg-[#0a0a0a]">
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '40px 40px' }} />
                  
                  {/* Map Viewport - Leaflet Map */}
                  <div className="absolute inset-0 z-0 bg-[#0a0a0a]">
                     <ErrorBoundary label="World Map" onReset={() => setSessionKey(Date.now())} resetLabel="RELOAD MAP">
                      <WorldMap
                        sessionKey={sessionKey}
                        zoom={zoom}
                        setZoom={setZoom}
                        setMapBounds={setMapBounds}
                        visibleAirports={visibleAirports}
                        visibleWorldOffsets={visibleWorldOffsets}
                        airports={airports}
                        routes={routesWithMetrics}
                        aiRouteList={aiRouteList}
                        aiAirlines={aiAirlines}
                        fleet={fleet}
                        airportManagement={airportManagement}
                        showYourRoutes={showYourRoutes}
                        showRivalRoutes={showRivalRoutes}
                        showLiveTraffic={showLiveTraffic}
                        planningOriginId={planningOriginId}
                        planningDestId={planningDestId}
                        setSelectedAirport={setSelectedAirport}
                        getRoutePath={getRoutePath}
                      />
                     </ErrorBoundary>
                  </div>
                  
                  {/* Active Window Views Overlay. Keyed by the number format so the
                      memoised views re-render when the separator setting changes. */}
                  <React.Fragment key={decimalSymbol}>
                  {activeWindow === 'buy-aircraft' ? (
                    <ViewFrame label="Buy Aircraft" onReset={backToMap}>
                      <React.Suspense fallback={<LazyFallback label="Buy Aircraft" />}>
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
                      </React.Suspense>
                    </ViewFrame>
                  ) : activeWindow === 'my-fleet' ? (
                    <ViewFrame label="My Fleet" onReset={backToMap}>
                      <React.Suspense fallback={<LazyFallback label="My Fleet" />}>
                        <MyFleetView
                           fleet={fleet}
                           routes={routes}
                           currentDateOffset={currentDateOffset}
                           onRenovate={handleRenovateAircraft}
                           onSelectRoute={handleShowRoute}
                           onStartRoute={handleStartRouteWithAircraft}
                           onSell={handleSellAircraft}
                           airlineCode={airlineCode}
                        />
                      </React.Suspense>
                    </ViewFrame>
                  ) : activeWindow === 'routes' ? (
                    <ViewFrame label="Routes" onReset={backToMap}>
                      <React.Suspense fallback={<LazyFallback label="Routes" />}>
                        <RoutesView
                          routes={routesWithMetrics}
                          fleet={fleet}
                          routeProfits={routeProfits}
                          initialAirportFilter={routeFilter}
                          onPlanRoute={handleOpenPlanner}
                          onDeleteRoute={handleDeleteRoute}
                          externalSelectedRoute={externalSelectedRoute}
                          onClearExternalSelectedRoute={handleClearExternalRoute}
                          onChangeAircraftRoute={handleChangeRouteAircraft}
                          onEditSchedule={handleEditSchedule}
                          onEditCabinServices={setEditingCabinRouteId}
                          onEditFinancials={setEditingPricingRouteId}
                          onUpdatePricing={handleUpdatePricing}
                          fuelPrice={fuelData.price}
                        demandFactor={playerDemandFactor}
                        rivalOffers={rivalOffers}
                          airportManagement={airportManagement}
                          currentYear={1960 + Math.floor(currentDateOffset / 12)}
                          currentMonth={1 + (currentDateOffset % 12)}
                          difficulty={difficulty}
                          airlineCode={airlineCode}
                        />
                      </React.Suspense>
                    </ViewFrame>
                  ) : activeWindow === 'airports' ? (
                    <ViewFrame label="Airports" onReset={backToMap}>
                      <React.Suspense fallback={<LazyFallback label="Airports" />}>
                        <AirportsView
                          currentYear={1960 + Math.floor(currentDateOffset / 12)}
                          onSelectAirport={setSelectedAirport}
                          airportManagement={airportManagement}
                          aiAirlines={aiAirlines}
                        />
                      </React.Suspense>
                    </ViewFrame>
                  ) : activeWindow === 'my-company' ? (
                    <ViewFrame label="My Company" onReset={backToMap}>
                      <React.Suspense fallback={<LazyFallback label="My Company" />}>
                        <MyCompanyView
                          capital={capital}
                          reportHistory={reportHistory}
                          reputation={reputation}
                          milestones={milestones}
                          milestoneCatalogue={MILESTONES}
                          annualGoal={annualGoal}
                          fleetValue={fleetValue}
                          fleetCount={fleet.length}
                          routeCount={routes.filter(r => r.airline === 'My Airline').length}
                        />
                      </React.Suspense>
                    </ViewFrame>
                  ) : activeWindow === 'competitors' ? (
                    <ViewFrame label="Rivals" onReset={backToMap}>
                      <React.Suspense fallback={<LazyFallback label="Rivals" />}>
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
                          playerProfitHistory={playerProfitHistory}
                          playerRouteProfits={routeProfits}
                        />
                      </React.Suspense>
                    </ViewFrame>
                  ) : activeWindow !== 'map' && (
                    <ViewFrame contentClassName="w-full h-full flex flex-col items-center p-4 overflow-y-auto pt-8">
                      <h2 className="text-4xl font-mono text-aero-yellow uppercase tracking-[0.3em] font-black drop-shadow-lg mb-4 relative z-10">{activeWindow.replace('-', ' ')}</h2>
                      <div className="max-w-4xl w-full text-white/70 text-center uppercase tracking-widest font-mono text-sm leading-relaxed border border-aero-yellow/20 shadow-2xl p-12 bg-black/60 backdrop-blur-xl rounded-sm relative z-10">
                        <div className="text-aero-yellow mb-4 text-xs font-black tracking-[0.4em]">SYSTEM MODULE [{activeWindow.toUpperCase()}]</div>
                        <div className="opacity-50">INITIALIZATION STRATEGY DEPLOYED.</div>
                        <div className="animate-pulse text-aero-yellow/80 mt-4">AWAITING UPLINK...</div>
                      </div>
                    </ViewFrame>
                  )}
                  </React.Fragment>

                  {isEditingSchedule && editingRouteId && (() => {
                    // The route or its aircraft can disappear while the editor is
                    // open (route deleted, aircraft sold). This used to be a
                    // non-null assertion and crashed the whole game.
                    const editRoute = routes.find(r => r.id === editingRouteId);
                    const editAircraft = editRoute ? fleet.find(a => a.registration === editRoute.aircraft) : undefined;
                    if (!editRoute || !editAircraft) return null;
                    return (
                     <ErrorBoundary label="Schedule Editor" onReset={() => setIsEditingSchedule(false)} resetLabel="CLOSE EDITOR">
                      <React.Suspense fallback={<LazyFallback label="Schedule Editor" />}>
                      <RouteScheduleEditView
                        route={editRoute}
                        aircraft={editAircraft}
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
                      </React.Suspense>
                     </ErrorBoundary>
                    );
                  })()}
                  
                  {editingCabinRouteId && (
                    <div className="absolute inset-0 z-[60] flex">
                     <ErrorBoundary label="Cabin Editor" onReset={() => setEditingCabinRouteId(null)} resetLabel="CLOSE EDITOR">
                      <React.Suspense fallback={<LazyFallback label="Cabin Editor" />}>
                      <RoutePlannerView
                        airports={airports}
                        fleet={fleet}
                        routes={routes}
                        onNotify={setAppAlert}
                        demandFactor={playerDemandFactor}
                        rivalOffers={rivalOffers}
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
                      </React.Suspense>
                     </ErrorBoundary>
                    </div>
                  )}

                  {editingPricingRouteId && (
                    <div className="absolute inset-0 z-[60] flex">
                     <ErrorBoundary label="Pricing Editor" onReset={() => setEditingPricingRouteId(null)} resetLabel="CLOSE EDITOR">
                      <React.Suspense fallback={<LazyFallback label="Pricing Editor" />}>
                      <RoutePlannerView
                        airports={airports}
                        fleet={fleet}
                        routes={routes}
                        onNotify={setAppAlert}
                        demandFactor={playerDemandFactor}
                        rivalOffers={rivalOffers}
                        airportManagement={airportManagement}
                        capital={capital}
                        onAddPendingSlotBills={(amt) => setPendingSlotBills(prev => prev + amt)}
                        pendingSlotBills={pendingSlotBills}
                        currentYear={1960 + Math.floor(currentDateOffset / 12)}
                        currentMonth={1 + (currentDateOffset % 12)}
                        difficulty={difficulty}
                        initialRouteId={editingPricingRouteId}
                        isEditingPricingOnly={true}
                        onSaveRoute={(route) => {
                          setRoutes(prev => prev.map(r => r.id === route.id ? route : r));
                          setEditingPricingRouteId(null);
                        }}
                        onClose={() => setEditingPricingRouteId(null)}
                        aiAirlines={aiAirlines}
                        airlineCode={airlineCode}
                      />
                      </React.Suspense>
                     </ErrorBoundary>
                    </div>
                  )}

                  {isPlanningRoute && (
                    <div className="absolute inset-0 z-[45] flex">
                     <ErrorBoundary label="Route Planner" onReset={() => setIsPlanningRoute(false)} resetLabel="CLOSE PLANNER">
                      <React.Suspense fallback={<LazyFallback label="Route Planner" />}>
                      <RoutePlannerView
                        airports={airports}
                        fleet={fleet}
                        routes={routes}
                        onNotify={setAppAlert}
                        demandFactor={playerDemandFactor}
                        rivalOffers={rivalOffers}
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
                        onOriginChange={setPlanningOriginId}
                        onDestChange={setPlanningDestId}
                        onRegChange={setPlanningReg}
                        onStepChange={setPlanningStep}
                        onScheduleChange={setPlanningSchedule}
                        onClassConfigsChange={setPlanningClassConfigs}
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
                          setPlanningClassConfigs(createDefaultPlanningClassConfigs());
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
                        onUnlockManagement={handleUnlockManagement}
                        onUpdateInfrastructure={(airportId, infra) => {
                          setAirportManagement(prev => ({ ...prev, [airportId]: infra }));
                        }}
                        onSubtractCapital={(amount) => spend(amount, 'Airport Infrastructure')}
                        onAddPendingSlotBills={(amt) => setPendingSlotBills(prev => prev + amt)}
                        pendingSlotBills={pendingSlotBills}
                      />
                      </React.Suspense>
                     </ErrorBoundary>
                    </div>
                  )}

                  {/* Airport Selection Window - Rendered inside the main view layout so sidebars remain visible */}
                  {selectedAirport && (
                    <div className="absolute inset-0 z-[2000]">
                     <ErrorBoundary label="Airport" onReset={() => setSelectedAirport(null)} resetLabel="CLOSE AIRPORT">
                      <React.Suspense fallback={<LazyFallback label="Airport" />}>
                      <AirportDetailView
                        airport={selectedAirport}
                        currentDateOffset={currentDateOffset}
                        onNotify={setAppAlert}
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

                          spend(GENERAL_CHECK_COST, 'General Checks');
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
                        onBuyManagement={(tier) => handleUnlockManagement(selectedAirport.id, tier as ManagementLevel)}
                        onUpdateInfrastructure={(infra) => {
                          // Costs are settled by onSubtractCapital / onAddPendingSlotBills
                          // before this runs; here we only store the new layout.
                          setAirportManagement(prev => ({
                            ...prev,
                            [selectedAirport.id]: infra
                          }));
                        }}
                        onSubtractCapital={(amount) => spend(amount, 'Airport Infrastructure')}
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
                      </React.Suspense>
                     </ErrorBoundary>
                    </div>
                  )}
                  {/* Floating Next Month Button */}
                  {activeWindow === 'map' && !isPlanningRoute && !editingCabinRouteId && !editingPricingRouteId && (
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
                      onClick={() => setDecimalSymbol(symbol as DecimalSymbol)}
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

/**
 * A real <button>, not a clickable <div>. The whole primary navigation used to
 * be unreachable by keyboard, and the 7.5px label was the smallest type in the
 * interface.
 */
function SidebarIcon({ icon, label, active = false, onClick }: { icon: ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`
      py-1.5 flex flex-col items-center gap-0.5 cursor-pointer transition-all w-full select-none bg-transparent border-0
      focus-visible:outline focus-visible:outline-2 focus-visible:outline-aero-yellow
      ${active ? 'text-aero-yellow opacity-100' : 'text-white opacity-40 hover:opacity-100 hover:text-white'}
    `}>
      <div className={`p-1.5 rounded-sm border border-transparent ${active ? 'bg-aero-yellow/10 border-aero-yellow/20' : 'bg-transparent'}`}>
        {icon}
      </div>
      <span className="text-3xs font-black tracking-widest text-center px-1 leading-[1.2]">{label}</span>
    </button>
  );
}

/**
 * `goodDirection` says which way is good news for this particular stat, because
 * the sign alone does not: demand falling is bad, the fuel price falling is
 * good. Thin wrapper over the shared StatTile so the top stats bar uses the
 * same tile component as every KPI card elsewhere in the app.
 */
function GameStat(
  { label, value, trend, goodDirection = 'up' }:
  { label: string, value: string, trend?: string, goodDirection?: 'up' | 'down' }
) {
  return <StatTile size="sm" label={label} value={value} trend={trend} goodDirection={goodDirection} />;
}

function GameMenuOption({ label, onClick }: { label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="text-left px-4 py-3 text-2xs font-mono uppercase tracking-widest text-white/70 hover:text-aero-yellow hover:bg-white/5 transition-all outline-none"
    >
      {label}
    </button>
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
