/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronRight,
  X
} from "lucide-react";

import type L from "leaflet";
import { Airport, calculateDistance } from "./data/airports";
import { airports, airportsByName, airportsMapAdjusted } from "./data/airportRegistry";
export { airportsMapAdjusted };

import { recolorClashingRivals } from "./lib/theme";
import { getRoutePath, regionOf } from "./lib/geoUtils";


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
import { AccountScopeContext } from "./lib/accountScope";
import { syncAllPendingConfigs } from "./lib/configStore";
import { getJetFuelPrice, getAircraftResaleValue, toStoredRouteMetrics, getManagementUnlockCost, applyManagementUnlock } from "./lib/financeUtils";
import { computeNetworkFinancials } from "./lib/transferUtils";
import { regionsServed } from "./lib/chronicle";
import { type Edition } from "./lib/newspaper";
import {
  CAMPAIGN_SPECS,
  REGION_LABELS,
  campaignBlocker,
  campaignMonthlyCost,
  ffpRankGate,
  createCampaign,
  ffpMonthlyCost,
  routesByRegion,
  startFfp,
  stopFfp
} from "./lib/marketing";
import {
  STRIKE_OPTION_RAISE,
  STRIKE_PAY_RAISE,
  STRIKE_REPUTATION_PENALTY,
  setSalary,
  settleStrikeWithPayRise,
  strikeCancelShare
} from "./lib/staff";
import {
  DISRUPTION_OPTION_CHARTER,
  type BirdStrike,
  cancelReputationPenalty,
  combineCancelShares,
  describeRouteCancellations,
  disruptionCancelShares,
  disruptionTitle
} from "./lib/disruptions";
import { migrateSave, SAVE_VERSION } from "./lib/saveMigration";
import {
  milestonePerks
} from "./lib/milestones";
import {
  FREE_MODE_RANK,
  RANK_NEEDED,
  managementGate,
  rankGateMessage,
  startingRank,
  type GameMode,
  type RankStats
} from "./lib/airlineRank";
import { classGateMessage, classesOfFleet, openClasses, type AircraftClassId } from "./lib/aircraftClasses";
import { airportGate, exemptAirports, maxAirportLevel } from "./lib/airportAccess";
import {
  buildYearSnapshot,
  describeGoal,
  type AnnualGoal
} from "./lib/annualGoals";
import { setFeeFactor, setResaleBonus, setSlotPriceFactor } from "./lib/economyContext";
import { ageYears, fleetCommonality } from "./lib/fleetCosts";
import { buildTakeover, takeoverQuote, withTakenSlots } from "./lib/takeover";
import {
  cancelRefund,
  createOrder,
  quoteOrder
} from "./lib/preorders";
import { type UsedListing } from "./lib/usedMarket";
import {
  careerScore,
  fileCareer,
  hallPosition,
  normalizeHall,
  normalizeStars,
  scenarioUnlocked,
  type HallOfFameEntry,
  type ScenarioStars
} from "./lib/careerScore";
import {
  CLASS_PROJECTS,
  boostedEfficiency,
  boostedPopularity,
  projectById,
  projectCost,
  researchEffects,
  startBlocker as researchBlocker,
  projectsForClasses,
  startingResearch,
  startProject
} from "./lib/research";
import {
  buildPlayerModifiers,
  createGameSystems,
  decisionTargetExists,
  routeCancelShare,
  normalizeGameSettings,
  DEFAULT_BRANDING,
  DEFAULT_MARKETING,
  DEFAULT_STAFF,
  type Branding,
  type Career,
  type CampaignTier,
  type Marketing,
  type RegionId,
  type Staff,
  type Disruption,
  type GameDecision,
  type GameDecisionKind,
  type GameDecisionOption,
  type GameSettings,
  type GameSystems,
  type RouteCancellation,
  type ScenarioState,
  type ChronicleEntry
} from "./lib/gameState";
import { nextMessageId, reserveMessageIds, createWelcomeMessage } from "./lib/messages";
import { SaveLoadOverlay } from "./components/SaveLoadOverlay";
import { useStableCallback } from "./lib/useStableCallback";
import { logError, logWarn, setDiagnosticsSummaryProvider, getDiagnostics, getLogEntries } from "./lib/debugLog";
import { formatCurrency, formatNumber, setDecimalSymbol as setNumberFormatSymbol, DecimalSymbol, yearOf, monthOf } from "./lib/format";
import { generateAiAirlines } from "./lib/aiSimulation";
import type { ActiveWindow, AirportInfrastructure, GameMessage, ManagementLevel, MonthlyReport, ScheduledTrip, SimulatedRoute, ViewState } from "./lib/gameTypes";
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
// The map library is only needed once a game is on screen or the hub picker is
// open, so the sign-in screen and the menus no longer wait for it. The same
// goes for the newspaper, the tutorial and the monthly report.
const WorldMap = React.lazy(() => import("./components/WorldMap").then(m => ({ default: m.WorldMap })));
const NewspaperOverlay = React.lazy(() => import("./components/NewspaperOverlay").then(m => ({ default: m.NewspaperOverlay })));
const TutorialOverlay = React.lazy(() => import("./components/TutorialOverlay").then(m => ({ default: m.TutorialOverlay })));
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
import { getEventMultipliers, getActiveEvents, setRuntimeRandomEvents, HistoricalEvent, eventKey } from "./lib/eventSystem";
import { createOwnedAircraft, defaultCabin, startingFleet } from "./lib/fleet";
import { scenarioById, type Scenario } from "./data/scenarios";
import { monthsLeft, scenarioBriefing, scenarioGoals, type ScenarioContext } from "./lib/scenarioEval";
import { ScenarioProgressPanel } from "./components/ScenarioProgressPanel";
import { settleTutorialStep, type TutorialDestination, type TutorialState, type TutorialView } from "./lib/tutorial";
import { checkReassignment, RoutePatch } from "./lib/aircraftAssignment";
import { autoScaleFor } from "./lib/layout";
import { useFullscreen } from "./components/ui/useFullscreen";
import { useHoverAutoClose } from "./components/ui/useHoverAutoClose";
import { supabase, isCloudConfigured, ensureProfile } from "./lib/supabase";
import { AuthGate } from "./components/AuthGate";
import { ViewFrame } from "./components/ui/ViewFrame";
import { MonthlyReportScreen } from "./components/app/MonthlyReportScreen";
import { NewGameScreen } from "./components/app/NewGameScreen";
import { MainMenuScreen } from "./components/app/MainMenuScreen";
import { SettingsDialog } from "./components/app/SettingsDialog";
import { GameTopBar } from "./components/app/GameTopBar";
import { GameNavigation } from "./components/app/GameNavigation";
import { GameDialogs } from "./components/app/GameDialogs";
import { addCapexItem, applyMonthClose, buildRivalOffers, closeMonth, offsetToDateStr, reportOffset, scenarioCapitalHistory, scenarioRoutes } from "./lib/monthClose";
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

export const GENERAL_CHECK_COST = 200000;

/** One empty list for "nothing sold this month", so the market's props stay equal between renders. */
const NO_SOLD_IDS: string[] = [];

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
  /** Rank, career passengers and the annual goals on offer. */
  const [career, setCareer] = useState<Career>(() => createGameSystems().career);
  /** Milestone ids already awarded, so each is announced once. */
  const [milestones, setMilestones] = useState<string[]>([]);
  /** What the milestones earned so far give: cheaper slots, room for hubs. */
  const perks = useMemo(() => milestonePerks(milestones), [milestones]);
  // Published for the pricing code that has no access to the game state; see
  // economyContext.ts. Set while rendering, from a pure value, so a screen
  // never shows a price the next purchase would not charge.
  /** What the finished development projects do; see research.ts. */
  const researchFx = useMemo(() => researchEffects(career.research.done), [career.research.done]);
  setSlotPriceFactor(perks.slotPriceFactor * researchFx.slotFactor);
  setFeeFactor(researchFx.feeFactor);
  setResaleBonus(researchFx.resaleBonus);
  /** Free Mode: a Global Player from the first month, with nothing gated by rank. */
  const freeMode = career.mode === 'free';
  /** Consecutive months closed without a loss, for the profit milestone. */
  const [profitStreak, setProfitStreak] = useState(0);
  /**
   * The target set each January and settled each December. Gives the calendar a
   * rhythm: before this, which month you acted in never mattered.
   */
  const [annualGoal, setAnnualGoal] = useState<AnnualGoal | null>(null);
  /** The event whose decision is waiting to be made, if any. */
  const [pendingDecision, setPendingDecision] = useState<HistoricalEvent | null>(null);
  /** The airline's colour and badge. */
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  /** The colour and badge being picked on the new-game screen, until the game starts. */
  const [newGameBranding, setNewGameBranding] = useState<Branding>(DEFAULT_BRANDING);
  /** Advertising campaigns and the frequent-flyer programme. */
  const [marketing, setMarketing] = useState<Marketing>(DEFAULT_MARKETING);
  /** Pay, morale and any strike in progress. */
  const [staff, setStaff] = useState<Staff>(DEFAULT_STAFF);
  /** Cancellations rolled for the months ahead. */
  const [disruptions, setDisruptions] = useState<Disruption[]>([]);
  /**
   * Bird strikes waiting to be acknowledged, one pop-up each. The bill was
   * paid the moment they were rolled; this is only the message, so it is not
   * saved.
   */
  const [birdStrikeAlerts, setBirdStrikeAlerts] = useState<BirdStrike[]>([]);
  /**
   * Questions for the player that are not world events, answered one at a
   * time in the dialog below the event decision. See resolveDecision.
   */
  const [pendingDecisions, setPendingDecisions] = useState<GameDecision[]>([]);
  /** The scenario this game was started from; null for a free game. */
  const [scenario, setScenario] = useState<ScenarioState | null>(null);
  /** The scenario picked on the new-game screen; null for free play. */
  const [newGameScenarioId, setNewGameScenarioId] = useState<string | null>(null);
  /** Normal Mode or Free Mode, picked on the new-game screen (a scenario is always Normal Mode). */
  const [newGameMode, setNewGameMode] = useState<GameMode>('normal');
  const newGameScenario = scenarioById(newGameScenarioId);
  /** The won-or-lost dialog, shown once after the close that decided the scenario. Not saved. */
  const [scenarioResultOpen, setScenarioResultOpen] = useState(false);
  /** The annual-goal choice dialog; opens after the December close, not saved. */
  const [goalOfferOpen, setGoalOfferOpen] = useState(false);
  /** The ten best careers filed in this browser; see careerScore.ts. */
  const [hall, setHall] = useState<HallOfFameEntry[]>(() => normalizeHall(readJson('neo_hall_of_fame', [])));
  /** Best stars per scenario, kept per account in this browser. */
  const [scenarioStars, setScenarioStars] = useState<ScenarioStars>({});
  /** The final report of a retired career, shown until closed. Not saved. */
  const [retirement, setRetirement] = useState<{ entry: HallOfFameEntry; position: number | null } | null>(null);
  /** The airline's history, newest last. */
  const [chronicle, setChronicle] = useState<ChronicleEntry[]>([]);
  /** The tutorial step on screen; null once finished or skipped, and for loaded older saves. */
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  /**
   * The newspaper of the last month close. Not part of the savegame: it is
   * written from that close's events, which a loaded game no longer has.
   */
  const [edition, setEdition] = useState<Edition | null>(null);
  const [isNewspaperOpen, setIsNewspaperOpen] = useState(false);
  /** Stable, so the overlay's key listener is not re-attached on every render. */
  const closeNewspaper = React.useCallback(() => setIsNewspaperOpen(false), []);
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
  const [reportHistory, setReportHistory] = useState<MonthlyReport[]>([]);
  const latestReport = reportHistory.length > 0 ? reportHistory[reportHistory.length - 1] : null;

  // Routes used to be mirrored to an unscoped `neo_routes` key on every change:
  // a full serialisation per edit, shared between accounts on one browser, and
  // redundant with the savegames that actually restore a game. Clear the leftover.
  useEffect(() => {
    removeKey('neo_routes');
  }, []);


  const [airlineName, setAirlineName] = useState("");
  const [airlineCode, setAirlineCode] = useState("");
  const [selectedHub, setSelectedHub] = useState<string>("FRA");
  const [hubPickerOpen, setHubPickerOpen] = useState(false);
  /**
   * The home airports offered on the new-game screen. A Normal Mode startup
   * may only begin at an airport its rank allows (level 3); the great hubs are
   * for Free Mode. A scenario fixes its own hub.
   */
  const newGameHubChoices = useMemo(
    () => newGameScenarioId === null && newGameMode === 'normal'
      ? airportsByName.filter(a => a.level <= maxAirportLevel(0))
      : airportsByName,
    [newGameScenarioId, newGameMode]
  );
  useEffect(() => {
    if (newGameScenarioId !== null || newGameMode !== 'normal') return;
    if (!newGameHubChoices.some(a => a.id === selectedHub) && newGameHubChoices.length > 0) {
      setSelectedHub(newGameHubChoices[0].id);
    }
  }, [newGameScenarioId, newGameMode, newGameHubChoices, selectedHub]);
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

  /** Last closed month's profit per route id, for the route list's money column. */
  const routeProfits = useMemo(() => {
    const map: Record<string, number> = {};
    (latestReport?.routes || []).forEach(r => { if (r.id) map[r.id] = r.profit; });
    return map;
  }, [latestReport]);

  /** The player's closed monthly profits, for the rivals leaderboard chart. */
  const playerProfitHistory = useMemo(
    () => reportHistory.map(r => r.totalProfit),
    [reportHistory]
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

  /**
   * What answering a decision does, by kind. Each system that puts questions
   * to the player adds its handler here. By the time one runs, the option's
   * cost has been paid and the decision has left the queue. A handler must
   * also accept the free option ensureFreeOption may have added, whose id
   * starts with FREE_OPTION_ID, as "do nothing".
   */
  const decisionHandlers: Partial<Record<GameDecisionKind, (decision: GameDecision, option: GameDecisionOption) => void>> = {
    // A strike: raise pay and half the flights operate, or sit it out and
    // none do. Sitting it out is what any other answer means, the free one
    // included. `ref` is the month the strike was called for.
    strike: (decision, option) => {
      const strikeOffset = Number(decision.ref);
      if (option.id === STRIKE_OPTION_RAISE) {
        setStaff(prev => settleStrikeWithPayRise(prev, strikeOffset));
        setToast(`Pay raised by ${STRIKE_PAY_RAISE} points: half the flights operate during the strike`);
      } else {
        setReputation(prev => Math.max(0, prev - STRIKE_REPUTATION_PENALTY));
        setToast(`Strike sat out: no flights this month, reputation -${STRIKE_REPUTATION_PENALTY}`);
      }
    },
    // A disruption of 25% or more: charter a replacement and nothing is
    // cancelled, or cancel the flights, which is what any other answer means.
    // `ref` is the disruption's id. The charter is billed at the month's
    // close, on what it actually saved.
    disruption: (decision, option) => {
      const target = disruptions.find(d => d.id === decision.ref);
      if (!target) return;
      if (option.id === DISRUPTION_OPTION_CHARTER) {
        setDisruptions(prev => prev.map(d => (d.id === target.id ? { ...d, mitigated: true } : d)));
        setToast(`Replacement aircraft chartered: ${disruptionTitle(target)}. Billed at the month's end.`);
      } else {
        // Flights a strike or another disruption cancels anyway strand nobody more.
        const strikeShare = strikeCancelShare(staff, target.offset);
        const others = disruptionCancelShares(disruptions.filter(d => d.id !== target.id), target.offset) ?? {};
        const penalty = cancelReputationPenalty(target, id => combineCancelShares(strikeShare, others[id]));
        if (penalty > 0) setReputation(prev => Math.max(0, prev - penalty));
        setToast(penalty > 0
          ? `Flights cancelled: ${disruptionTitle(target)}, reputation -${formatNumber(penalty, penalty % 1 === 0 ? 0 : 1)}`
          : `Flights cancelled: ${disruptionTitle(target)}. They were grounded anyway: no reputation lost`);
      }
    }
  };

  /** Answers the decision with the given id: pays for the option, dequeues it, applies it. */
  const resolveDecision = (decisionId: string, optionId: string) => {
    const decision = pendingDecisions.find(d => d.id === decisionId);
    const option = decision?.options.find(o => o.id === optionId);
    if (!decision || !option) {
      logWarn('decisions', `Decision ${decisionId} has no option ${optionId}; nothing was done`);
      return;
    }
    // Checked before anything is paid: a question whose strike or disruption
    // is gone by now would otherwise charge for nothing.
    if (!decisionTargetExists(decision, { staff, disruptions })) {
      logWarn('decisions', `Decision ${decisionId} is about ${decision.ref}, which no longer exists; dropped it`);
      setPendingDecisions(prev => prev.filter(d => d.id !== decisionId));
      return;
    }
    if (option.cost > 0) spend(option.cost, `Decision: ${decision.title}`);
    setPendingDecisions(prev => prev.filter(d => d.id !== decisionId));
    decisionHandlers[decision.kind]?.(decision, option);
  };

  const [startDateOffset, setStartDateOffset] = useState(0); // 0 = 01/1960
  const [currentDateOffset, setCurrentDateOffset] = useState(0);

  /** Resale value of the whole fleet, for the balance sheet. */
  const fleetValue = useMemo(
    () => fleet.reduce((sum, p) => sum + getAircraftResaleValue({ ...p, ageYears: ageYears(p, currentDateOffset), resaleBonus: researchFx.resaleBonus }), 0),
    [fleet, currentDateOffset, researchFx.resaleBonus]
  );
  
  const [uiScaleSetting, setUiScaleSettingState] = useState(() => {
    const stored = parseFloat(readString('aero_ui_scale') || '');
    return Number.isFinite(stored) && stored >= 0.5 && stored <= 1.5 ? stored : 1.0;
  });
  const setUiScaleSetting = (value: number) => {
    setUiScaleSettingState(value);
    writeString('aero_ui_scale', String(value));
  };
  const [autoScale, setAutoScale] = useState(1.0);
  const fullscreen = useFullscreen();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setAutoScale(autoScaleFor(window.innerWidth, window.innerHeight));
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // An aircraft without a hub is based where its first route starts. This is
  // the one place that rule lives: it covers a route saved in the planner, a
  // route moved to another aircraft, and old savegames without hubs.
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
   * Everything that applies to the player's routes and not to the rivals --
   * reputation, crisis relief bought this month, and whatever the other
   * systems add -- in the one object every player call of the finance engine
   * receives, so the route list, the planner and the report agree.
   */
  const playerMods = useMemo(
    () => buildPlayerModifiers({ reputation, eventChoices, marketing, staff, disruptions, routes, research: researchFx }, currentDateOffset),
    // randomEvents: eventReliefFactor reads the active events from module state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reputation, currentDateOffset, eventChoices, marketing, staff, disruptions, randomEvents, routes, researchFx]
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
    () => aiAirlines.flatMap(a => (a.routes || []).map(r => ({ ...r, airlineName: a.name, airlineCode: a.code, airlineId: a.id, airlineColor: a.color }))),
    [aiAirlines]
  );

  const finalUiScale = uiScaleSetting * autoScale;

  const formatDate = (offset: number) => {
    const year = yearOf(offset);
    const month = monthOf(offset);
    return `${month.toString().padStart(2, '0')}/${year}`;
  };

  // Price comes from the shared model; only the month-on-month trend string is
  // computed here, so the top bar can never disagree with what routes are billed.
  const rawPriceAtOffset = (offset: number) =>
    getJetFuelPrice(yearOf(offset), monthOf(offset), difficulty);

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
    // The fuel programmes cut what the airline burns, so what it pays.
    const price = priceAtOffset(offset) * researchFx.fuelFactor;

    let trend = "0%";
    if (offset > 0) {
      const prevPrice = priceAtOffset(offset - 1) * researchFx.fuelFactor;
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
    [currentDateOffset, difficulty, eventChoices, randomEvents, researchFx]
  );

  /**
   * The whole network priced once for this month, connecting passengers
   * included: the same call the monthly report makes, so the two agree.
   */
  const network = useMemo(() => computeNetworkFinancials(routes, fleet, playerMods, {
    fuelPrice: fuelData.price,
    airportManagement,
    year: yearOf(currentDateOffset),
    month: monthOf(currentDateOffset),
    difficulty,
    airportsMap: airportsMapAdjusted,
    rivalOffers
  }),
    // randomEvents: calculateDemand reads the active events from module state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routes, fleet, fuelData.price, airportManagement, currentDateOffset, difficulty, playerMods, rivalOffers, randomEvents]
  );

  /**
   * The player's modifiers with this month's connecting passengers, for the
   * screens that price one route at a time (the route list and its detail
   * view). Reading `transfer` from here, their figures match the network's.
   */
  const playerModsWithTransfer = useMemo(
    () => Object.keys(network.transfer).length > 0 ? { ...playerMods, transfer: network.transfer } : playerMods,
    [playerMods, network]
  );

  /**
   * Every route with this month's figures, from the same engine call the
   * monthly report makes. The route list and the map read these. The copy
   * stored on each route changes only when a month closes, so a new rival, a
   * new timetable or a new route next door showed up there a month late.
   */
  const routesWithMetrics = useMemo(() => routes.map(r => {
    const fin = network.finById.get(r.id);
    return fin ? { ...r, ...toStoredRouteMetrics(fin) } : r;
  }), [routes, network]);

  /**
   * This month's profit and weekly passengers per route, for the map's profit
   * heatmap. The forecast rather than the last closed month, so a route opened
   * or repriced today shows its colour straight away. Profit is the weekly
   * figure times four, as the monthly report books it.
   */
  const routeHeat = useMemo(() => {
    const profit: Record<string, number> = {};
    const pax: Record<string, number> = {};
    network.finById.forEach((fin, id) => {
      profit[id] = (fin.estWeeklyProfit || 0) * 4;
      pax[id] = fin.paxPerWeek || 0;
    });
    return { profit, pax };
  }, [network]);

  /** Passengers this month at the current forecast, for the frequent-flyer programme's bill. */
  const projectedMonthlyPax = useMemo(() => {
    let week = 0;
    network.finById.forEach(fin => { week += fin.paxPerWeek || 0; });
    return week * 4;
  }, [network]);

  /** Crew and ground staff this month at the current forecast and pay, for the staff screen. */
  const monthlyCrewCost = useMemo(() => {
    let week = 0;
    network.finById.forEach(fin => { week += fin.costsBreakdown?.crew || 0; });
    return week * 4;
  }, [network]);

  /**
   * The routes losing flights this month and why, for the route list's badge
   * and the detail view. The shares are exactly what playerMods hands the
   * engine, so the badge and the figures beside it agree.
   */
  const routeCancellations = useMemo<Record<string, RouteCancellation>>(
    () => describeRouteCancellations(
      routes.map(r => r.id),
      id => routeCancelShare(playerMods, id),
      disruptions,
      currentDateOffset,
      playerMods.cancelShareAll ?? 0
    ),
    [routes, playerMods, disruptions, currentDateOffset]
  );

  /**
   * The running scenario's goals as they stand, for the progress panel:
   * standing figures (cash, routes, reputation) as of now, monthly ones
   * (connecting passengers, profit) from the last closed month, which is
   * what the close judges them on. Null for a free game or a decided one.
   */
  const activeScenario = scenario?.status === 'running' ? scenarioById(scenario.id) : undefined;
  const scenarioProgress = useMemo(() => {
    if (!activeScenario || !scenario) return null;
    // Until the scenario's first month has closed there is no monthly figure to judge.
    const lastClose = latestReport && reportOffset(latestReport) >= scenario.startedOffset ? latestReport : null;
    const ctx: ScenarioContext = {
      offset: currentDateOffset,
      capital,
      routes: scenarioRoutes(routes),
      reputation,
      regionsServed: regionsServed(routes, airportsMapAdjusted).size,
      transferPaxMonth: lastClose ? (typeof lastClose.transferPax === 'number' && Number.isFinite(lastClose.transferPax) ? lastClose.transferPax : 0) : null,
      monthlyProfit: lastClose && Number.isFinite(lastClose.totalProfit) ? lastClose.totalProfit : null,
      capitalHistory: scenarioCapitalHistory(reportHistory, scenario.startedOffset)
    };
    return { goals: scenarioGoals(activeScenario, ctx), monthsLeft: monthsLeft(activeScenario, currentDateOffset) };
  }, [activeScenario, scenario, currentDateOffset, capital, routes, reputation, latestReport, reportHistory]);

  /** A strike is waiting for the player's answer; no second one is called meanwhile. */
  const strikePending = pendingDecisions.some(d => d.kind === 'strike');

  /** How many of the player's routes a campaign in each region would reach. */
  const regionRouteCounts = useMemo(() => routesByRegion(routes, airportsMapAdjusted), [routes]);

  /** What the fleet's make-up does to maintenance, for My Company. */
  const commonality = useMemo(() => fleetCommonality(fleet), [fleet]);

  /** The figures the rank is judged on, as they stand now, for the Career tab. */
  const yearsInBusiness = Math.max(0, Math.floor((currentDateOffset - startDateOffset) / 12));
  const rankStats = useMemo<RankStats>(() => ({
    routes: routes.length,
    monthlyPax: reportHistory.length > 0 ? Math.max(0, reportHistory[reportHistory.length - 1].paxTotal ?? 0) : 0,
    reputation,
    regions: Object.values(regionRouteCounts).filter(n => n > 0).length,
    years: yearsInBusiness
  }), [routes.length, reportHistory, reputation, regionRouteCounts, yearsInBusiness]);

  /**
   * The aircraft classes the airline may buy: those it has developed (all of
   * them in Free Mode) and every one it already flies, so a class is never
   * taken away from a fleet. See aircraftClasses.ts.
   */
  const aircraftClassesOpen = useMemo<ReadonlySet<AircraftClassId>>(() => {
    const open = openClasses(career.research.done, freeMode);
    classesOfFleet(fleet).forEach(c => open.add(c));
    return open;
  }, [career.research.done, freeMode, fleet]);

  /** Airports open whatever their level: the home airport, built-up ones and every one a route touches. */
  const airportExempt = useMemo(() => exemptAirports(selectedHub, airportManagement, routes), [selectedHub, airportManagement, routes]);
  /** Why an airport cannot be used at the current rank, or null; see airportAccess.ts. */
  const airportRankGate = React.useCallback(
    (airport: { id: string; name?: string; level?: number } | null | undefined) => airportGate(airport, career.rank, airportExempt),
    [career.rank, airportExempt]
  );

  /** The year of the chosen annual goal as it stands, for its progress bar. */
  const goalSnapshot = useMemo(
    () => annualGoal
      ? buildYearSnapshot(reportHistory, annualGoal.year, { routes: rankStats.routes, regions: rankStats.regions, reputation })
      : null,
    [annualGoal, reportHistory, rankStats.routes, rankStats.regions, reputation]
  );

  /** Takes one of the board's offered goals for the coming year. */
  const handleChooseGoal = React.useCallback((goal: AnnualGoal) => {
    setAnnualGoal(goal);
    setCareer(prev => ({ ...prev, goalOffer: null }));
    setGoalOfferOpen(false);
    setToast(`Goal for ${goal.year}: ${describeGoal(goal, formatCurrency, formatNumber)}`);
  }, []);

  /** The career so far, as a score; see careerScore.ts. */
  const score = useMemo(() => careerScore({
    netWorth: capital + fleetValue,
    rank: career.rank,
    free: freeMode,
    milestones: milestones.length,
    reputation,
    takeovers: career.takeovers,
    // A Free Mode airline starts with every class developed; those do not count.
    projectsDone: Math.max(0, career.research.done.length - (freeMode ? CLASS_PROJECTS.length : 0)),
    years: Math.floor((currentDateOffset - startDateOffset) / 12)
  }), [capital, fleetValue, career.rank, freeMode, milestones.length, reputation, career.takeovers, career.research.done.length, currentDateOffset, startDateOffset]);

  /** Files the career in the hall of fame and shows the final report; the game can carry on. */
  const handleRetire = () => {
    const entry: HallOfFameEntry = {
      id: (currentSaveId || `career_${Date.now()}`).split('_auto_')[0],
      airline: airlineName || 'Neo Airlines',
      code: airlineCode,
      score: score.total,
      rank: career.rank,
      years: Math.floor((currentDateOffset - startDateOffset) / 12),
      netWorth: capital + fleetValue,
      filed: new Date().toISOString(),
      mode: career.mode
    };
    const position = hallPosition(hall, entry);
    const next = fileCareer(hall, entry);
    setHall(next);
    writeJson('neo_hall_of_fame', next);
    setRetirement({ entry, position });
  };

  /** The hub's region: where a global campaign is booked from, for the record. */
  const homeRegion = useMemo<RegionId>(() => {
    const hub = airportsMapAdjusted.get(selectedHub);
    return hub ? regionOf(hub.coords) : 'EU';
  }, [selectedHub]);

  const getBaseGlobalDemand = (offset: number) => {
    const mvValues = [0.89, 0.91, 0.92, 0.96, 1.03, 1.10, 1.15, 1.14, 1.06, 0.95, 0.88, 1.00];
    const mNum = monthOf(offset);
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

    supabase.auth.getSession()
      .then(({ data }) => adopt(data.session))
      .catch(e => {
        // Without a session the player is simply not signed in; the login screen follows.
        logError('auth', 'Restoring the session failed', e);
        adopt(null);
      });
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
  // The three dropdowns in the top bar close by themselves once the mouse has
  // been off them for two seconds.
  const messagesHover = useHoverAutoClose(isMessagesOpen, () => setIsMessagesOpen(false));
  const mapSettingsHover = useHoverAutoClose(isMapSettingsOpen, () => setIsMapSettingsOpen(false));
  const gameMenuHover = useHoverAutoClose(isGameMenuOpen, () => setIsGameMenuOpen(false));
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [isPlanningRoute, setIsPlanningRoute] = useState(false);
  const [planningOriginId, setPlanningOriginId] = useState<string | null>(null);
  const [planningDestId, setPlanningDestId] = useState<string | null>(null);
  const [planningReg, setPlanningReg] = useState<string | null>(null);
  const [planningStep, setPlanningStep] = useState<number>(1);
  const [planningSchedule, setPlanningSchedule] = useState<ScheduledTrip[]>([]);
  const [planningClassConfigs, setPlanningClassConfigs] = useState<Record<string, any>>(createDefaultPlanningClassConfigs);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editingCabinRouteId, setEditingCabinRouteId] = useState<string | null>(null);
  const [editingPricingRouteId, setEditingPricingRouteId] = useState<string | null>(null);
  const [isPurchasingForRoute, setIsPurchasingForRoute] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  /** A route moving to another aircraft whose new time slot is being picked. */
  const [reassigning, setReassigning] = useState<{ routeId: string; registration: string } | null>(null);
  const [routeFilter, setRouteFilter] = useState<string>("");
  const [appAlert, setAppAlert] = useState<string | null>(null);
  // Confirmations that need no decision; a blocking dialog for these interrupted every save.
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);
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
        // Saved configurations that were waiting to upload go up as well.
        await syncAllPendingConfigs(supabase, userId);
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

  // Read once, when the state is created. Loading them in an effect let the
  // effect below write the defaults over them first.
  const [autosaveInterval, setAutosaveInterval] = useState<number>(() => {
    const stored = readJson<{ autosaveInterval?: unknown } | null>('neo_autosave_settings', null)?.autosaveInterval;
    return typeof stored === 'number' && Number.isFinite(stored) ? stored : 6;
  });
  const [autosaveOverwrite, setAutosaveOverwrite] = useState<boolean>(() => {
    const stored = readJson<{ autosaveOverwrite?: unknown } | null>('neo_autosave_settings', null)?.autosaveOverwrite;
    return typeof stored === 'boolean' ? stored : true;
  });
  const [currentSaveId, setCurrentSaveId] = useState<string | null>(null);
  const [currentSaveName, setCurrentSaveName] = useState<string | null>(null);
  const [pendingAutosave, setPendingAutosave] = useState(false);
  const [pendingInitialSave, setPendingInitialSave] = useState(false);
  const [initialSaveFileName, setInitialSaveFileName] = useState("");

  useEffect(() => {
    writeJson('neo_autosave_settings', { autosaveInterval, autosaveOverwrite });
  }, [autosaveInterval, autosaveOverwrite]);

  /** The newspaper, tutorial and heatmap switches. Per browser, not per game. */
  const [gameSettings, setGameSettings] = useState<GameSettings>(
    () => normalizeGameSettings(readJson<unknown>('neo_game_settings', null))
  );

  useEffect(() => {
    writeJson('neo_game_settings', gameSettings);
  }, [gameSettings]);


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

  // The map is always the layer underneath. On top of it at most one of the
  // sidebar's windows is open: a screen (activeWindow) or the route planner
  // (isPlanningRoute). Opening one closes the other, and closing one leaves the
  // map. Only the planner is remembered: its draft lives in the planning*
  // states below and is still there when it is opened again. Every other screen
  // starts on its main view each time it is opened.

  /** Closes what opens on top of a window: its editors, dialogs and selections. */
  const closeWindowOverlays = () => {
    setIsEditingSchedule(false);
    setEditingRouteId(null);
    setEditingCabinRouteId(null);
    setEditingPricingRouteId(null);
    setReassigning(null);
    setSelectedPurchasingAircraft(null);
    setSelectedAirport(null);
  };

  /** Opens one of the sidebar's screens, closing whatever window is open. */
  const openWindow = (win: ActiveWindow) => {
    setIsPlanningRoute(false);
    closeWindowOverlays();
    // A screen opened from the sidebar starts on its list, not on a route or
    // filter left over from the last time it was used.
    setExternalSelectedRoute(null);
    setRouteFilter("");
    setActiveWindow(win);
  };

  /**
   * Opens the route planner over the map, closing any other window. Every way
   * into the planner goes through here, so it is never open above a screen.
   */
  const showPlanner = React.useCallback(() => {
    setActiveWindow('map');
    setIsPlanningRoute(true);
  }, []);

  /** Opens the route planner, as the sidebar's New Route does. */
  const openPlanner = () => {
    closeWindowOverlays();
    showPlanner();
  };

  /** Ends the month. The work is in lib/monthClose; this hands it the state and applies what it returns. */
  const handleAdvanceMonth = () => {
    const commands = closeMonth({
      getFuelData, currentDateOffset, airportManagement, difficulty, rivalOffers, routes, fleet, playerMods, researchFx, aiAirlines, marketing, disruptions, reputation, eventChoices, staff, profitStreak, career, capital, milestones, yearsInBusiness, randomEvents, pendingDecisions, monthlyCapex, selectedHub, aiAirlinesCount, aiDifficulty, airlineCode, branding, annualGoal, reportHistory, startDateOffset, fleetValue, freeMode, airlineName, chronicle, homeRegion, scenario, scenarioStars, userId, getBaseGlobalDemand, latestReport, gameSettings, autosaveInterval
    });
    applyMonthClose(commands, {
      setProfitStreak, setMilestones, setStaff, setCapital, setMonthlyCapex, setAiAirlines, setRandomEventsState, setDisruptions, setBirdStrikeAlerts, setAnnualGoal, setGoalOfferOpen, setReputation, setCareer, setPendingDecision, setReportHistory, setScenarioStars, setScenario, setScenarioResultOpen, setChronicle, setEdition, setIsNewspaperOpen, setMarketing, setMessages, setPendingAutosave, setCurrentDateOffset, setRoutes, setView, setFleet, setPendingDecisions
    });
  };

  const [sessionKey, setSessionKey] = useState(Date.now());
  
  const handleSaveGame = async (slotId?: string, customName?: string, isAutosave: boolean = false): Promise<boolean> => {
    try {
      await saveGameUnsafe(slotId, customName, isAutosave);
      return true;
    } catch (e) {
      // Saving must never fail silently: the player would carry on believing
      // the game is safe. The autosave path used to reject into the void.
      logError('saves', 'Saving failed', e);
      setAppAlert(`Saving failed: ${(e as Error)?.message || 'unknown error'}. Your game is still running; try again or free some browser storage.`);
      return false;
    }
  };

  // Autosave clones carry an "_auto_N" suffix; "save and exit" writes back to the
  // manual save they were cloned from instead of into one of the rotating slots.
  const manualSaveTarget = () => {
    if (!currentSaveId) return null;
    return {
      id: currentSaveId.split('_auto_')[0],
      name: (currentSaveName || 'Save').replace(/\s*\(Autosave.*\)$/, ''),
    };
  };

  const [showExitSavePrompt, setShowExitSavePrompt] = useState(false);
  const [isSavingBeforeExit, setIsSavingBeforeExit] = useState(false);

  const returnToMainMenu = () => {
    setShowExitSavePrompt(false);
    setView('main-menu');
    setIsGameMenuOpen(false);
    setActiveWindow('map');
    setSelectedPurchasingAircraft(null);
    setSelectedAirport(null);
  };

  const saveAndReturnToMainMenu = async () => {
    const target = manualSaveTarget();
    setIsSavingBeforeExit(true);
    const ok = await handleSaveGame(target?.id, target?.name, false);
    setIsSavingBeforeExit(false);
    if (ok) returnToMainMenu();
    else setShowExitSavePrompt(false);
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
      randomEvents,
      branding,
      marketing,
      staff,
      disruptions,
      pendingDecisions,
      scenario,
      chronicle,
      career,
      tutorialStep
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
      setToast(`Game "${name}" saved${where}`);
    } else {
      setToast(`Autosave complete: "${name}"${where}`);
    }
    setShowSaveMenu(false);
  };

  // Stars earned in scenarios, kept per account in this browser.
  useEffect(() => {
    setScenarioStars(normalizeStars(readJson(`neo_scenario_stars:${userId || 'local'}`, {})));
  }, [userId]);

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
   * A new colour or badge mid-game. Rivals keep their colours, except one the
   * new colour now sits too close to, which moves to a free one.
   */
  const handleBrandingChange = React.useCallback((next: Branding) => {
    setBranding(next);
    setAiAirlines(prev => {
      const colors = recolorClashingRivals(prev, next.color);
      return colors.every((c, i) => c === prev[i].color)
        ? prev
        : prev.map((ai, i) => ({ ...ai, color: colors[i] }));
    });
  }, []);

  /**
   * What the marketing handlers below read. They are handed to the memoised
   * company view, so they keep one identity and read the current cash, month
   * and campaigns from here rather than closing over a stale render.
   */
  const marketingCtx = useRef({ capital, currentDateOffset, marketing, projectedMonthlyPax, rank: career.rank, resaleBonus: researchFx.resaleBonus });
  marketingCtx.current = { capital, currentDateOffset, marketing, projectedMonthlyPax, rank: career.rank, resaleBonus: researchFx.resaleBonus };

  /**
   * Books a campaign from this month on. It is paid month by month at each
   * close, so launching needs only the first month in the bank.
   */
  const handleLaunchCampaign = React.useCallback((tier: CampaignTier, region: RegionId, months: number) => {
    const { capital: cash, currentDateOffset: offset, marketing: current, rank } = marketingCtx.current;
    const blocker = campaignBlocker(current, tier, region, offset, rank);
    if (blocker) {
      setAppAlert(blocker);
      return;
    }
    const firstMonth = campaignMonthlyCost(tier, offset);
    if (cash < firstMonth) {
      setAppAlert(`Not enough cash: the first month of this campaign costs ${formatCurrency(firstMonth)}, and you have ${formatCurrency(cash)}.`);
      return;
    }
    const id = `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    setMarketing(prev => ({ ...prev, campaigns: [...prev.campaigns, createCampaign(tier, region, months, offset, id)] }));
    const where = tier === 'global' ? 'worldwide' : `in ${REGION_LABELS[region]}`;
    setToast(`${CAMPAIGN_SPECS[tier].label} campaign launched ${where} for ${months} months`);
  }, []);

  /** Stops a campaign now. Nothing is charged for the month it is stopped in. */
  const handleCancelCampaign = React.useCallback((id: string) => {
    setMarketing(prev => ({ ...prev, campaigns: prev.campaigns.filter(c => c.id !== id) }));
    setToast('Campaign cancelled');
  }, []);

  /** Starts or ends the frequent-flyer programme. Ending it throws away the loyalty built up. */
  const handleSetFfp = React.useCallback((active: boolean) => {
    const { capital: cash, currentDateOffset: offset, projectedMonthlyPax: pax, rank } = marketingCtx.current;
    if (active) {
      const gate = ffpRankGate(rank);
      if (gate) {
        setAppAlert(gate);
        return;
      }
      const cost = ffpMonthlyCost(pax);
      if (cash < cost) {
        setAppAlert(`Not enough cash: the frequent flyer programme would cost about ${formatCurrency(cost)} this month, and you have ${formatCurrency(cash)}.`);
        return;
      }
      setMarketing(prev => startFfp(prev, offset));
      setToast('Frequent flyer programme launched');
    } else {
      setMarketing(prev => stopFfp(prev));
      setToast('Frequent flyer programme ended');
    }
  }, []);

  /**
   * Sets pay. It is felt at once: the crew bill and the forecast follow the
   * slider, while morale only starts moving towards the new target at the
   * next month's end.
   */
  const handleSetSalary = React.useCallback((pct: number) => {
    // Never below the pay agreed to settle a recent strike (salaryFloor).
    setStaff(prev => setSalary(prev, pct, marketingCtx.current.currentDateOffset));
  }, []);

  /** Sets every system saved since version 3 at once, from a save or from defaults. */
  const applyGameSystems = (systems: GameSystems) => {
    setBranding(systems.branding);
    setMarketing(systems.marketing);
    setStaff(systems.staff);
    setDisruptions(systems.disruptions);
    setPendingDecisions(systems.pendingDecisions);
    setScenario(systems.scenario);
    setChronicle(systems.chronicle);
    setCareer(systems.career);
    setTutorialStep(systems.tutorialStep);
  };

  /**
   * Clears everything that belongs to one game session but is not part of the
   * savegame: the planner, the editors, open dialogs, the inbox and the random
   * events. "Start Game" after a loaded game used to inherit the previous
   * game's events and messages, and a loaded game could open with the old
   * planner still half-filled.
   *
   * The systems added with save version 3 go back to their defaults here as
   * well, so nothing of them survives into the next game; a load sets them
   * again from the save right after.
   */
  const resetTransientGameState = () => {
    applyGameSystems(createGameSystems());
    setBirdStrikeAlerts([]);
    setScenarioResultOpen(false);
    setGoalOfferOpen(false);
    setEdition(null);
    setIsNewspaperOpen(false);
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
    // Saves from before rival airlines existed get a fresh set, founded as of
    // the save's current date so only carriers flying in that year appear.
    setAiAirlines(saveObj.aiAirlines ?? generateAiAirlines(saveObj.aiAirlinesCount, saveObj.aiDifficulty, saveObj.selectedHub, saveObj.currentDateOffset, saveObj.airlineCode, saveObj.branding.color));
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
    applyGameSystems(saveObj);
    if (saveObj.career?.goalOffer) setGoalOfferOpen(true);

    setSessionKey(Date.now());
    setCurrentSaveId(slotId);
    setCurrentSaveName(saves.find(s => s.id === slotId)?.name || "Loaded Save");
    setView('game');
    setIsGameMenuOpen(false);
    setShowLoadMenu(false);
    setToast("Game loaded");
  };

  /**
   * Picks free play (null) or a scenario on the new-game screen. A scenario
   * fills in the fields it sets, which stay locked while it is picked.
   */
  const pickNewGameScenario = (id: string | null, mode: GameMode = 'normal') => {
    if (id !== null && !scenarioUnlocked(id, scenarioStars)) return;
    setNewGameScenarioId(id);
    setNewGameMode(id === null ? mode : 'normal');
    const chosen = scenarioById(id);
    if (!chosen) return;
    setSelectedHub(chosen.hub);
    setStartDateOffset(chosen.startOffset);
    setDifficulty(chosen.difficulty);
    setAiAirlinesCount(chosen.rivals.count);
    setAiDifficulty(chosen.rivals.difficulty);
  };

  /**
   * Starts a new game from the new-game screen's settings, or from a
   * scenario, which overrides the hub, the date, the money, the difficulty
   * and the rivals and brings its own aircraft. Also what "Try again" on a
   * lost scenario runs.
   */
  const startNewGame = (saveName: string, chosen?: Scenario, keepBranding?: Branding) => {
    const hub = chosen?.hub ?? selectedHub;
    const start = chosen?.startOffset ?? startDateOffset;
    const gameDifficulty = chosen?.difficulty ?? difficulty;
    const rivalCount = chosen?.rivals.count ?? aiAirlinesCount;
    const rivalDifficulty = chosen?.rivals.difficulty ?? aiDifficulty;
    let initialCapital = 25000000; // Default for $25M
    if (startingBudget === '$50M') initialCapital = 50000000;
    if (startingBudget === '$100M') initialCapital = 100000000;
    if (startingBudget === '$200M') initialCapital = 200000000;
    if (chosen) initialCapital = chosen.capital;

    // A new game starts clean: no events, messages or open
    // editors carried over from a game played earlier.
    resetTransientGameState();
    // A new game offers the tutorial, unless it was switched off.
    const startFleet = chosen ? startingFleet(chosen) : [];
    // A scenario is always Normal Mode: it is judged on what the airline earns.
    const mode: GameMode = chosen ? 'normal' : newGameMode;
    const startRank = mode === 'free'
      ? FREE_MODE_RANK
      : startingRank({ routes: 0, monthlyPax: 0, reputation: 50, regions: 0, years: 0 }, chosen?.startRank ?? 0);
    const systems: GameSystems = {
      ...createGameSystems(),
      career: {
        ...createGameSystems().career,
        mode,
        rank: startRank,
        // The aircraft classes the rank has opened, and those the start fleet flies, are developed.
        research: {
          done: [...new Set([...startingResearch(startRank).done, ...projectsForClasses(classesOfFleet(startFleet))])],
          active: []
        }
      },
      branding: { ...(keepBranding ?? newGameBranding) },
      tutorialStep: gameSettings.tutorial ? 0 : null,
      ...(chosen ? {
        scenario: { id: chosen.id, startedOffset: start, status: 'running' as const },
        chronicle: [{
          offset: start,
          kind: 'scenario' as const,
          key: 'scenario:start',
          text: `Scenario "${chosen.title}" begins: ${chosen.win.map(g => g.label).join(', ')}, by ${offsetToDateStr(chosen.deadlineOffset)}.`
        }]
      } : {})
    };
    applyGameSystems(systems);
    setSelectedHub(hub);
    setStartDateOffset(start);
    setDifficulty(gameDifficulty);
    setAiAirlinesCount(rivalCount);
    setAiDifficulty(rivalDifficulty);
    setCurrentDateOffset(start);
    setCapital(initialCapital);
    // A scenario's aircraft come free, through the same code a purchase uses.
    setFleet(startFleet);
    setAirportManagement({ 
      [hub]: {
        level: 2,
        slots: { regional: 0, narrowbody: 0, widebody: 0 },
        stands: { narrowbody: 0, widebody: 0 },
        desks: { normal: 1, self: 0 }
      }
    });
    setRoutes([]);
    setAiAirlines(generateAiAirlines(rivalCount, rivalDifficulty, hub, start, airlineCode, systems.branding.color));
    setMonthlyCapex([]);
    setReportHistory([]);
    setEventChoices({});
    // A game that starts in the middle of a world event with a decision --
    // the Oil Shock scenario opens in the 1973 crisis -- is asked it now:
    // the question is otherwise only put when an event begins.
    setPendingDecision(getActiveEvents(start).find(ev => ev.choices && ev.choices.length > 0) ?? null);
    setReputation(50);
    setMilestones([]);
    setProfitStreak(0);
    setAnnualGoal(null);
    if (chosen) {
      const welcome = createWelcomeMessage();
      setMessages([{
        id: nextMessageId(),
        text: `SCENARIO: ${chosen.title}. ${chosen.win.map(g => g.label).join(', ')} by ${offsetToDateStr(chosen.deadlineOffset)}.`,
        isRead: false,
        dateStr: offsetToDateStr(start),
        details: {
          title: `Scenario: ${chosen.title}`,
          source: 'Board of Directors',
          content: scenarioBriefing(chosen)
        }
      }, welcome]);
    }
    setSessionKey(Date.now());
    const newSaveId = `save_${Date.now()}`;
    setCurrentSaveId(newSaveId);
    setCurrentSaveName(saveName);
    setPendingInitialSave(true);
    setView('game');
    setActiveWindow('map');
  };

  const deleteSave = async (id: string) => {
    setSaves(prev => prev.filter(s => s.id !== id));
    const cloudOk = await deleteSaveSlot(userId, id);
    if (!cloudOk) {
      setAppAlert('The savegame was deleted in this browser, but not in your account: the server could not be reached. It will be listed again until it is deleted while online.');
    }
  };

  // Handlers handed to the memoised views. They only use state setters, so they
  // can keep one identity for the life of the app; inline arrows here used to
  // defeat React.memo on every render of App.
  const handleSellAircraft = React.useCallback((plane: OwnedAircraft) => {
    const value = getAircraftResaleValue({ ...plane, ageYears: ageYears(plane, marketingCtx.current.currentDateOffset), resaleBonus: marketingCtx.current.resaleBonus });

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
    showPlanner();
    setPlanningReg(reg);
    setPlanningOriginId(null);
    setPlanningDestId(null);
  }, [showPlanner]);

  const handleOpenPlanner = showPlanner;
  /**
   * Unlocks a management tier at an airport. The route planner and the airport
   * console each had their own copy of this with different prices, and only
   * the console's applied the tier's effects.
   */
  const handleUnlockManagement = (airportId: string, tier: ManagementLevel) => {
    const lock = airportRankGate(airportsMapAdjusted.get(airportId));
    if (lock) {
      setAppAlert(lock);
      return;
    }
    const gate = managementGate(tier, career.rank, perks.extraHubs, airportManagement, airportId, freeMode);
    if (gate) {
      setAppAlert(gate);
      return;
    }
    const cost = getManagementUnlockCost(airportsMapAdjusted.get(airportId)?.level || 1, tier);
    if (capital < cost) {
      setAppAlert(`Unlocking T${tier} management at ${airportId} costs ${formatCurrency(cost)}, but you only have ${formatCurrency(capital)}.`);
      return;
    }
    spend(cost, `Airport Management T${tier}`);
    setAirportManagement(prev => ({ ...prev, [airportId]: applyManagementUnlock(prev[airportId], tier) }));
  };

  /** Starts a development project; the cost is paid at once. */
  const handleStartResearch = (projectId: string) => {
    const project = projectById(projectId);
    if (!project) return;
    const year = yearOf(currentDateOffset);
    const blocker = researchBlocker(career.research, project, career.rank, capital, year);
    if (blocker) {
      setAppAlert(blocker);
      return;
    }
    const cost = projectCost(project, year);
    spend(cost, 'Development Projects');
    setCareer(prev => ({ ...prev, research: startProject(prev.research, projectId, currentDateOffset) }));
    setToast(`Development started: ${project.title} (${project.months} months)`);
  };

  /** The standard cabin a delivered or second-hand aircraft arrives with. */
  const plainCabin = (spec: Aircraft) => defaultCabin(spec);

  /** A new aircraft with what the development tree adds to its efficiency and type satisfaction. */
  const withDevelopment = (plane: OwnedAircraft): OwnedAircraft => ({
    ...plane,
    efficiency: boostedEfficiency(plane.efficiency, researchFx),
    popularity: boostedPopularity(plane.popularity, researchFx)
  });

  /** Places an order for aircraft not yet delivered. Pays the deposit now. */
  const handlePlaceOrder = (spec: Aircraft, quantity: number) => {
    const gate = classGateMessage(spec, aircraftClassesOpen);
    if (gate) {
      setAppAlert(`${gate} Nothing was ordered.`);
      return;
    }
    const quote = quoteOrder(spec, quantity);
    if (capital < quote.deposit) {
      setAppAlert(`The deposit is ${formatCurrency(quote.deposit)}, but you only have ${formatCurrency(capital)}. Nothing was ordered.`);
      return;
    }
    const order = createOrder(spec, quantity, currentDateOffset, `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`);
    spend(order.deposit, 'Aircraft Deposits');
    setCareer(prev => ({ ...prev, orders: [...prev.orders, order] }));
    setToast(`Ordered ${order.quantity} \u00d7 ${spec.manufacturer} ${spec.type}: delivery ${offsetToDateStr(order.deliveryOffset)}`);
  };

  /** Cancels an order; half the deposit comes back. */
  const handleCancelOrder = (orderId: string) => {
    const order = career.orders.find(o => o.id === orderId);
    if (!order) return;
    const refund = cancelRefund(order);
    spend(-refund, 'Aircraft Deposits');
    setCareer(prev => ({ ...prev, orders: prev.orders.filter(o => o.id !== orderId) }));
    setToast(`Order cancelled: ${formatCurrency(refund)} of the deposit returned`);
  };

  /** Buys a second-hand aircraft from this month's listings. */
  const handleBuyUsed = (listing: UsedListing) => {
    const spec = aircraftList.find(a => a.id === listing.aircraftId);
    if (!spec) return;
    const gate = classGateMessage(spec, aircraftClassesOpen);
    if (gate) {
      setAppAlert(`${gate} Nothing was bought.`);
      return;
    }
    if (career.usedSold.offset === currentDateOffset && career.usedSold.ids.includes(listing.id)) return;
    if (capital < listing.price) {
      setAppAlert(`This aircraft costs ${formatCurrency(listing.price)}, but you only have ${formatCurrency(capital)}. Nothing was bought.`);
      return;
    }
    const { config, baseInteriorPop } = plainCabin(spec);
    const [plane] = createOwnedAircraft(spec, 1, {
      config,
      baseInteriorPop,
      hub: selectedHub || 'FRA',
      existingRegistrations: fleet.map(p => p.registration),
      purchasedAt: currentDateOffset - listing.ageMonths
    });
    spend(listing.price, 'Used Aircraft');
    setFleet(prev => [...prev, withDevelopment({ ...plane, conditionGeneral: listing.conditionGeneral, conditionInterior: listing.conditionInterior })]);
    setCareer(prev => ({
      ...prev,
      usedSold: {
        offset: currentDateOffset,
        ids: [...(prev.usedSold.offset === currentDateOffset ? prev.usedSold.ids : []), listing.id]
      }
    }));
    setToast(`Bought a ${(listing.ageMonths / 12).toFixed(1)}-year-old ${spec.manufacturer} ${spec.type} for ${formatCurrency(listing.price)}`);
  };

  /**
   * Buys a rival airline: its aircraft join the fleet, its slots at its home
   * airport become the player's, and it leaves the game. The price and the
   * rank needed come from takeoverQuote.
   */
  const handleTakeover = (aiId: string) => {
    const target = aiAirlines.find(a => a.id === aiId);
    if (!target) return;
    const quote = takeoverQuote(target, career.rank);
    if (quote.blocked) {
      setAppAlert(quote.blocked);
      return;
    }
    if (capital < quote.price) {
      setAppAlert(`Buying ${target.name} costs ${formatCurrency(quote.price)}, but you only have ${formatCurrency(capital)}.`);
      return;
    }
    const deal = buildTakeover(target, fleet.map(p => p.registration));
    spend(quote.price, 'Airline Takeover');
    setFleet(prev => [...prev, ...deal.aircraft]);
    setAirportManagement(prev => ({ ...prev, [deal.hub]: withTakenSlots(prev[deal.hub], deal.slots) }));
    setAiAirlines(prev => prev.filter(a => a.id !== aiId));
    setCareer(prev => ({ ...prev, takeovers: prev.takeovers + 1 }));
    setReputation(prev => Math.min(100, prev + 2));
    setAppAlert(
      `SUCCESS: ${target.name} is yours for ${formatCurrency(quote.price)}. ${deal.aircraft.length} aircraft joined your fleet` +
      `${deal.slots.narrowbody + deal.slots.regional + deal.slots.widebody > 0 ? ` and you took over its slots at ${deal.hub}` : ''}. ` +
      `The airline's routes are gone; plan new ones with your new aircraft.`
    );
  };

  const handleDeleteRoute = React.useCallback((id: string) => setRoutes(prev => prev.filter(r => r.id !== id)), []);
  const handleClearExternalRoute = React.useCallback(() => setExternalSelectedRoute(null), []);

  /**
   * Hands routes to other aircraft (aircraft swap, route "Change"). Each patch
   * replaces only the fields the move changes, so figures the month end wrote
   * onto the route in the meantime are kept.
   */
  const handleReassignRoutes = React.useCallback((patches: RoutePatch[], note: string) => {
    if (patches.length === 0) return;
    const byId = new Map(patches.map(p => [p.id, p]));
    setRoutes(prev => prev.map(r => {
      const p = byId.get(r.id);
      return p ? ({ ...r, ...p } as SimulatedRoute) : r;
    }));
    setToast(note);
  }, []);

  /**
   * The route as it would be on the picked aircraft: re-timed for it and
   * moved to the free time closest to its current times, as the starting
   * point of the timetable. Worked out once, when the aircraft is picked;
   * the editor keeps its own copy from then on.
   */
  const reassignDraft = useMemo(() => {
    if (!reassigning) return null;
    const route = routes.find(r => r.id === reassigning.routeId);
    const plane = fleet.find(p => p.registration === reassigning.registration);
    if (!route || !plane) return null;
    const check = checkReassignment(
      [route],
      plane,
      { routes, fleet, airports: airportsMapAdjusted, airportManagement, airlineCode },
      { allowShift: true }
    );
    return { route: { ...route, ...check.patches[0] } as SimulatedRoute, plane, from: route.aircraft };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reassigning]);

  /** Route page "Change": the aircraft is picked, its timetable opens to pick the time. */
  const handleReassignAircraft = React.useCallback((routeId: string, registration: string) => {
    setReassigning({ routeId, registration });
    setIsEditingSchedule(false);
    setIsPlanningRoute(false);
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
    const isRenovating = 'registration' in aircraft;
    if (!isRenovating) {
      const gate = classGateMessage(aircraft, aircraftClassesOpen);
      if (gate) {
        setAppAlert(`${gate} Nothing was bought.`);
        return;
      }
    }
    if (capital < totalCost) {
      setAppAlert(
        `${isRenovating ? 'This refit' : 'This purchase'} costs ${formatCurrency(totalCost)}, ` +
        `but you only have ${formatCurrency(capital)}. Nothing was bought.`
      );
      return;
    }
    spend(totalCost, isRenovating ? 'Cabin Refits' : 'Aircraft Purchases');

    if (isRenovating) {
      const registration = (aircraft as OwnedAircraft).registration;
      setFleet(prev => prev.map(p => {
        if (p.registration !== registration) return p;
        // Each refit restores less than the one before: 90%, 80%, ... never under 30%.
        const refits = p.refitsDone || 0;
        const restorePercent = Math.max(30, 90 - refits * 10);
        return {
          ...p,
          config,
          baseInteriorPop,
          refitsDone: refits + 1,
          conditionInterior: Math.min(100, Math.max(p.conditionInterior, restorePercent))
        };
      }));
    } else {
      const newPlanes = createOwnedAircraft(aircraft, quantity, {
        config,
        baseInteriorPop,
        hub: selectedHub || 'FRA',
        existingRegistrations: fleet.map(p => p.registration),
        purchasedAt: currentDateOffset
      });
      setFleet(prev => [...prev, ...newPlanes.map(withDevelopment)]);

      if (isPurchasingForRoute) {
        // Bought from the planner: go back to it with the new aircraft, unless
        // it cannot fly the route that was being planned.
        const newReg = newPlanes[0].registration;
        const origin = planningOriginId ? airportsMapAdjusted.get(planningOriginId) : undefined;
        const dest = planningDestId ? airportsMapAdjusted.get(planningDestId) : undefined;
        const dist = origin && dest
          ? calculateDistance(origin.coords[0], origin.coords[1], dest.coords[0], dest.coords[1])
          : 0;
        setIsPurchasingForRoute(false);
        setSelectedPurchasingAircraft(null);
        if (dist > aircraft.maxRange) {
          setAppAlert(`Warning: The aircraft ${newReg} (${aircraft.type}) was purchased, but with ${formatNumber(aircraft.maxRange)}km it does not have enough range for the planned route (${formatNumber(Math.round(dist))}km).`);
          return;
        }
        setPlanningReg(newReg);
        setIsPlanningRoute(true);
        setActiveWindow('map');
        return;
      }
    }
    setSelectedPurchasingAircraft(null);
    setActiveWindow('map');
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

  // --- Tutorial -------------------------------------------------------------
  // The step on screen is saved with the game; see lib/tutorial.ts for the
  // steps and when each finishes by itself.
  const tutorialState = useMemo<TutorialState>(() => ({
    fleetSize: fleet.length,
    routeCount: routes.length,
    planning: isPlanningRoute,
    reportOpen: view === 'monthly-overview'
  }), [fleet.length, routes.length, isPlanningRoute, view]);
  const inGame = view === 'game' || view === 'monthly-overview';

  // A step whose goal is reached moves on, past any others already done.
  useEffect(() => {
    if (tutorialStep === null || !inGame) return;
    const next = settleTutorialStep(tutorialStep, tutorialState);
    if (next !== tutorialStep) {
      setTutorialStep(next);
      if (next === null) setToast('Tutorial complete. Settings can restart it any time.');
    }
  }, [tutorialStep, tutorialState, inGame]);

  /** Next, Back, Finish and Skip on the tutorial card. */
  const goToTutorialStep = React.useCallback((step: number | null, skipped?: boolean) => {
    setTutorialStep(step);
    if (step === null) setToast(skipped ? 'Tutorial skipped. Settings can restart it any time.' : 'Tutorial complete. Settings can restart it any time.');
  }, []);

  /** "Show me": takes the player to where a step's control is. */
  const showTutorialTarget = (target: TutorialDestination) => {
    if (view === 'monthly-overview') setView('game');
    if (target === 'new-route') openPlanner();
    else openWindow(target);
  };

  /** Where the player is, in the tutorial's terms. */
  const tutorialView: TutorialView | null = view === 'monthly-overview' ? 'report'
    : view !== 'game' ? null
    : isPlanningRoute ? 'new-route'
    : activeWindow === 'map' || activeWindow === 'buy-aircraft' || activeWindow === 'my-company' ? activeWindow
    : null;

  /**
   * The tutorial steps aside for anything that asks for the player's
   * attention: decisions, the newspaper, alerts, the menus and their
   * dialogs, the scenario's verdict, and the consoles opened over the map
   * (an airport, a route's timetable) that leave the sidebar it points at in
   * view. It comes back once they are dealt with. Modals it is not told
   * about here it notices itself (see TutorialOverlay).
   */
  const tutorialHidden = !inGame || !!pendingDecision || pendingDecisions.length > 0 || birdStrikeAlerts.length > 0 || isNewspaperOpen || !!appAlert ||
    isSettingsOpen || !!selectedMessage || showSaveMenu || showLoadMenu || showExitSavePrompt || scenarioResultOpen ||
    !!selectedAirport || isEditingSchedule || !!reassigning || isMessagesOpen || isGameMenuOpen || isMapSettingsOpen;

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

  // Handlers and objects handed to the memoised views, kept at one identity so
  // those views re-render for their own data only (see useStableCallback).
  const onPlaceOrder = useStableCallback(handlePlaceOrder);
  const onCancelOrder = useStableCallback(handleCancelOrder);
  const onBuyUsed = useStableCallback(handleBuyUsed);
  const onStartResearch = useStableCallback(handleStartResearch);
  const onRetire = useStableCallback(handleRetire);
  const onTakeover = useStableCallback(handleTakeover);
  const onOpenProgression = useStableCallback(() => openWindow('progression'));
  const soldUsedIds = career.usedSold.offset === currentDateOffset ? career.usedSold.ids : NO_SOLD_IDS;
  const rivalNames = useMemo(() => aiAirlines.map(a => a.name), [aiAirlines]);
  const market = useMemo(() => ({
    currentDateOffset,
    capital,
    classesOpen: aircraftClassesOpen,
    orders: career.orders,
    soldUsedIds,
    rivalNames,
    onOrder: onPlaceOrder,
    onCancelOrder,
    onBuyUsed
  }), [currentDateOffset, capital, aircraftClassesOpen, career.orders, soldUsedIds, rivalNames, onPlaceOrder, onCancelOrder, onBuyUsed]);

  return (
    <AccountScopeContext.Provider value={userId}>
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
          {/* The month's newspaper comes before any question: the paper tells
              what happened, the dialogs below ask what to do about it. It can
              always be closed, so no question ever waits on it for long. */}
          {edition && (
            <React.Suspense fallback={null}>
              <NewspaperOverlay edition={edition} open={isNewspaperOpen} onClose={closeNewspaper} />
            </React.Suspense>
          )}
          <GameDialogs
            pendingDecision={pendingDecision}
            isNewspaperOpen={isNewspaperOpen}
            scenarioResultOpen={scenarioResultOpen}
            capital={capital}
            spend={spend}
            setEventChoices={setEventChoices}
            setPendingDecision={setPendingDecision}
            pendingDecisions={pendingDecisions}
            resolveDecision={resolveDecision}
            retirement={retirement}
            airlineName={airlineName}
            score={score}
            hall={hall}
            setRetirement={setRetirement}
            returnToMainMenu={returnToMainMenu}
            career={career}
            goalOfferOpen={goalOfferOpen}
            handleChooseGoal={handleChooseGoal}
            setGoalOfferOpen={setGoalOfferOpen}
            birdStrikeAlerts={birdStrikeAlerts}
            fleet={fleet}
            routes={routes}
            setBirdStrikeAlerts={setBirdStrikeAlerts}
            scenario={scenario}
            currentDateOffset={currentDateOffset}
            reputation={reputation}
            setScenarioResultOpen={setScenarioResultOpen}
            setShowExitSavePrompt={setShowExitSavePrompt}
            currentSaveName={currentSaveName}
            startNewGame={startNewGame}
            branding={branding}
            toast={toast}
            appAlert={appAlert}
            setAppAlert={setAppAlert}
          />
          {/* Upright phones stack the content above a bottom navigation bar; in
              the rail layout (md and up, or a phone held sideways) the navigation
              is the left-hand column. See the variants in index.css. */}
          <div className="flex-1 relative flex flex-col rail:flex-row overflow-hidden">
            {/* Sidebar for Game View. On upright phones the same buttons form the
                bottom bar, so the tutorial's data-tour anchors exist in every
                layout. Buttons there are as wide as their short label and share
                out any spare width; the bar scrolls sideways on very narrow
                screens. Sideways phones get a slightly wider, compact rail with
                no spacer, since height is what they lack. */}
        {view === 'game' && (
          <GameNavigation
            activeWindow={activeWindow}
            isPlanningRoute={isPlanningRoute}
            openWindow={openWindow}
            openPlanner={openPlanner}
          />
        )}

        <div className="flex-1 flex flex-col relative overflow-hidden">
          <AnimatePresence mode="wait">
            {view === 'login' && (
              <AuthGate onLocalOnly={handleLocalOnly} />
            )}

            {view === 'main-menu' && (
              <MainMenuScreen
                key="main-menu"
                userId={userId}
                cloudOnline={cloudOnline}
                user={user}
                cloudStatusLabel={cloudStatusLabel}
                fullscreen={fullscreen}
                handleDisconnect={handleDisconnect}
                legacySaveCount={legacySaveCount}
                handleImportLegacySaves={handleImportLegacySaves}
                isImportingLegacy={isImportingLegacy}
                setLegacySaveCount={setLegacySaveCount}
                saves={saves}
                handleLoadGame={handleLoadGame}
                setAppAlert={setAppAlert}
                setShowLoadMenu={setShowLoadMenu}
                setView={setView}
                setIsSettingsOpen={setIsSettingsOpen}
              />
            )}

            {view === 'start-menu' && (
              <NewGameScreen
                key="start-menu"
                setView={setView}
                newGameScenarioId={newGameScenarioId}
                newGameMode={newGameMode}
                pickNewGameScenario={pickNewGameScenario}
                scenarioStars={scenarioStars}
                newGameScenario={newGameScenario}
                airlineName={airlineName}
                setAirlineName={setAirlineName}
                airlineCode={airlineCode}
                handleAirlineCodeChange={handleAirlineCodeChange}
                newGameBranding={newGameBranding}
                setNewGameBranding={setNewGameBranding}
                setHubPickerOpen={setHubPickerOpen}
                selectedHub={selectedHub}
                hubPickerOpen={hubPickerOpen}
                startDateOffset={startDateOffset}
                setSelectedHub={setSelectedHub}
                setDifficulty={setDifficulty}
                difficulty={difficulty}
                setStartingBudget={setStartingBudget}
                startingBudget={startingBudget}
                setDebugMode={setDebugMode}
                debugMode={debugMode}
                aiAirlinesCount={aiAirlinesCount}
                setAiAirlinesCount={setAiAirlinesCount}
                aiDifficulty={aiDifficulty}
                setAiDifficulty={setAiDifficulty}
                formatDate={formatDate}
                setStartDateOffset={setStartDateOffset}
                initialSaveFileName={initialSaveFileName}
                setInitialSaveFileName={setInitialSaveFileName}
                setAppAlert={setAppAlert}
                startNewGame={startNewGame}
              />
            )}

            {view === 'monthly-overview' && (
              <MonthlyReportScreen
                key="monthly-overview"
                latestReport={latestReport}
                formatDate={formatDate}
                currentDateOffset={currentDateOffset}
                airlineName={airlineName}
                airlineCode={airlineCode}
                setView={setView}
                edition={edition}
                setIsNewspaperOpen={setIsNewspaperOpen}
              />
            )}

            {view === 'game' && (
              <motion.div
                key="game"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col bg-aero-black relative"
              >
                <GameTopBar
                  capital={capital}
                  fleet={fleet}
                  routes={routes}
                  reputation={reputation}
                  globalDemandData={globalDemandData}
                  fuelData={fuelData}
                  formatDate={formatDate}
                  currentDateOffset={currentDateOffset}
                  messagesHover={messagesHover}
                  setIsMessagesOpen={setIsMessagesOpen}
                  isMessagesOpen={isMessagesOpen}
                  setMessages={setMessages}
                  messages={messages}
                  unreadMessagesCount={unreadMessagesCount}
                  edition={edition}
                  setIsNewspaperOpen={setIsNewspaperOpen}
                  setSelectedMessage={setSelectedMessage}
                  mapSettingsHover={mapSettingsHover}
                  setIsMapSettingsOpen={setIsMapSettingsOpen}
                  isMapSettingsOpen={isMapSettingsOpen}
                  showYourRoutes={showYourRoutes}
                  setShowYourRoutes={setShowYourRoutes}
                  showRivalRoutes={showRivalRoutes}
                  setShowRivalRoutes={setShowRivalRoutes}
                  showLiveTraffic={showLiveTraffic}
                  setShowLiveTraffic={setShowLiveTraffic}
                  gameSettings={gameSettings}
                  setGameSettings={setGameSettings}
                  gameMenuHover={gameMenuHover}
                  setIsGameMenuOpen={setIsGameMenuOpen}
                  isGameMenuOpen={isGameMenuOpen}
                  setShowSaveMenu={setShowSaveMenu}
                  setIsSettingsOpen={setIsSettingsOpen}
                  fullscreen={fullscreen}
                  setShowExitSavePrompt={setShowExitSavePrompt}
                  activeWorldEvents={activeWorldEvents}
                  setPendingDecision={setPendingDecision}
                />
                {/* Main Viewport */}
                <div className="flex-1 relative bg-aero-panel">
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '40px 40px' }} />
                  
                  {/* Map Viewport - Leaflet Map */}
                  {/* The tutorial's "map" only while the map is what is on screen: under
                      a window it is not there to point at. */}
                  <div className="absolute inset-0 z-0 bg-aero-panel" data-tour={activeWindow === 'map' && !isPlanningRoute ? 'map' : undefined}>
                     <ErrorBoundary label="World Map" onReset={() => setSessionKey(Date.now())} resetLabel="RELOAD MAP">
                      <React.Suspense fallback={<LazyFallback label="World Map" />}>
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
                        playerColor={branding.color}
                        heatmap={gameSettings.heatmap}
                        routeProfits={routeHeat.profit}
                        routePax={routeHeat.pax}
                      />
                      </React.Suspense>
                     </ErrorBoundary>
                  </div>
                  
                  {/* The running scenario's goals, over the map's top-left corner.
                      On phones the top bar's dropdowns open over this corner, and
                      at z-[900] the panel would sit on top of them, so it steps
                      aside while one is open. */}
                  {scenarioProgress && activeScenario && activeWindow === 'map' && !isPlanningRoute && (
                    <div className={`absolute top-3 left-3 z-[900] ${isMessagesOpen || isGameMenuOpen || isMapSettingsOpen ? 'bar:hidden short:hidden' : ''}`} data-tour="scenario-panel">
                      <ScenarioProgressPanel scenario={activeScenario} goals={scenarioProgress.goals} monthsLeft={scenarioProgress.monthsLeft} />
                    </div>
                  )}

                  {/* Active Window Views Overlay. Keyed by the number format so the
                      memoised views re-render when the separator setting changes. */}
                  <React.Fragment key={decimalSymbol}>
                  {activeWindow === 'buy-aircraft' ? (
                    <ViewFrame label="Buy Aircraft" onReset={backToMap}>
                      <React.Suspense fallback={<LazyFallback label="Buy Aircraft" />}>
                        <BuyAircraftView
                          currentDateOffset={currentDateOffset}
                          onSelectAircraft={setSelectedPurchasingAircraft}
                          debugMode={debugMode}
                          classesOpen={aircraftClassesOpen}
                          market={market}
                        />
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
                           airportManagement={airportManagement}
                           onReassignRoutes={handleReassignRoutes}
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
                          onReassignAircraft={handleReassignAircraft}
                          onEditSchedule={handleEditSchedule}
                          onEditCabinServices={setEditingCabinRouteId}
                          onEditFinancials={setEditingPricingRouteId}
                          onUpdatePricing={handleUpdatePricing}
                          fuelPrice={fuelData.price}
                          playerMods={playerModsWithTransfer}
                          rivalOffers={rivalOffers}
                          transferFlows={network.flowsByRoute}
                          cancellations={routeCancellations}
                          airportManagement={airportManagement}
                          currentYear={yearOf(currentDateOffset)}
                          currentMonth={monthOf(currentDateOffset)}
                          difficulty={difficulty}
                          airlineCode={airlineCode}
                        />
                      </React.Suspense>
                    </ViewFrame>
                  ) : activeWindow === 'airports' ? (
                    <ViewFrame label="Airports" onReset={backToMap}>
                      <React.Suspense fallback={<LazyFallback label="Airports" />}>
                        <AirportsView
                          currentYear={yearOf(currentDateOffset)}
                          onSelectAirport={setSelectedAirport}
                          airportManagement={airportManagement}
                          aiAirlines={aiAirlines}
                          airportLock={airportRankGate}
                        />
                      </React.Suspense>
                    </ViewFrame>
                  ) : activeWindow === 'my-company' || activeWindow === 'progression' ? (
                    <ViewFrame label={activeWindow === 'progression' ? 'Career' : 'My Company'} onReset={backToMap}>
                      <React.Suspense fallback={<LazyFallback label="Career" />}>
                        <MyCompanyView
                          page={activeWindow === 'progression' ? 'progression' : 'company'}
                          onOpenProgression={onOpenProgression}
                          capital={capital}
                          reportHistory={reportHistory}
                          reputation={reputation}
                          milestones={milestones}
                          free={freeMode}
                          rank={career.rank}
                          rankStats={rankStats}
                          perks={perks}
                          goalOffer={career.goalOffer}
                          goalSnapshot={goalSnapshot}
                          onChooseGoal={handleChooseGoal}
                          research={career.research}
                          onStartResearch={onStartResearch}
                          score={score}
                          hall={hall}
                          onRetire={onRetire}
                          moraleBonus={researchFx.moraleBonus}
                          annualGoal={annualGoal}
                          fleetValue={fleetValue}
                          fleetCount={fleet.length}
                          commonality={commonality}
                          routeCount={routes.filter(r => r.airline === 'My Airline').length}
                          branding={branding}
                          airlineName={airlineName}
                          airlineCode={airlineCode}
                          onBrandingChange={handleBrandingChange}
                          chronicle={chronicle}
                          marketing={marketing}
                          currentDateOffset={currentDateOffset}
                          projectedMonthlyPax={projectedMonthlyPax}
                          regionRouteCounts={regionRouteCounts}
                          homeRegion={homeRegion}
                          onLaunchCampaign={handleLaunchCampaign}
                          onCancelCampaign={handleCancelCampaign}
                          onSetFfp={handleSetFfp}
                          staff={staff}
                          profitStreak={profitStreak}
                          monthlyCrewCost={monthlyCrewCost}
                          strikePending={strikePending}
                          onSetSalary={handleSetSalary}
                        />
                      </React.Suspense>
                    </ViewFrame>
                  ) : activeWindow === 'competitors' ? (
                    <ViewFrame label="Rivals" onReset={backToMap}>
                      <React.Suspense fallback={<LazyFallback label="Rivals" />}>
                        <CompetitorsView
                          aiAirlines={aiAirlines}
                          playerCapital={capital}
                          playerAirlineName={airlineName}
                          playerAirlineCode={airlineCode}
                          playerHub={selectedHub}
                          playerFleet={fleet}
                          playerRoutes={routes}
                          playerProfitHistory={playerProfitHistory}
                          playerRouteProfits={routeProfits}
                          playerColor={branding.color}
                          currentDateOffset={currentDateOffset}
                          rank={career.rank}
                          onTakeover={onTakeover}
                        />
                      </React.Suspense>
                    </ViewFrame>
                  ) : null}
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
                        fleet={fleet}
                        airportManagement={airportManagement}
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
                  
                  {reassignDraft && (() => {
                    const { route: draftRoute, plane, from } = reassignDraft;
                    const closeReassign = () => {
                      setReassigning(null);
                      const route = routes.find(r => r.id === draftRoute.id);
                      if (route) {
                        setExternalSelectedRoute(route);
                        setActiveWindow('routes');
                      }
                    };
                    // Sold while the timetable was open: nothing left to move to.
                    if (!fleet.some(p => p.registration === plane.registration)) return null;
                    return (
                     <ErrorBoundary label="Change Aircraft" onReset={() => setReassigning(null)} resetLabel="CLOSE EDITOR">
                      <React.Suspense fallback={<LazyFallback label="Change Aircraft" />}>
                      <RouteScheduleEditView
                        route={draftRoute}
                        aircraft={plane}
                        reassignFrom={from}
                        allAirports={airports}
                        allRoutes={routes}
                        fleet={fleet}
                        airportManagement={airportManagement}
                        onSave={(updatedRoute) => {
                          handleReassignRoutes(
                            [{
                              id: draftRoute.id,
                              origin: draftRoute.origin,
                              aircraft: plane.registration,
                              schedule: updatedRoute.schedule || [],
                              weeklyFlights: updatedRoute.schedule?.length || 0,
                              durMin: draftRoute.durMin || 0,
                              turnoverMin: draftRoute.turnoverMin || 0,
                              ...(draftRoute.classConfigs ? { classConfigs: draftRoute.classConfigs } : {})
                            }],
                            `${draftRoute.origin}-${draftRoute.destination} is now flown by ${plane.registration}`
                          );
                        }}
                        onClose={closeReassign}
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
                        debugMode={debugMode}
                        airports={airports}
                        fleet={fleet}
                        routes={routes}
                        onNotify={setAppAlert}
                        playerMods={playerMods}
                        fuelPrice={fuelData.price}
                        rivalOffers={rivalOffers}
                        airportManagement={airportManagement}
                        capital={capital}
                        onSubtractCapital={(amount, label) => spend(amount, label ?? 'Airport Infrastructure')}
                        currentYear={yearOf(currentDateOffset)}
                        currentMonth={monthOf(currentDateOffset)}
                        difficulty={difficulty}
                        initialRouteId={editingCabinRouteId}
                        isEditingCabinOnly={true}
                        onSaveRoute={(route) => {
                          setRoutes(prev => prev.map(r => r.id === route.id ? { ...route, openedOffset: r.openedOffset ?? route.openedOffset } : r));
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
                        debugMode={debugMode}
                        airports={airports}
                        fleet={fleet}
                        routes={routes}
                        onNotify={setAppAlert}
                        playerMods={playerMods}
                        fuelPrice={fuelData.price}
                        rivalOffers={rivalOffers}
                        airportManagement={airportManagement}
                        capital={capital}
                        onSubtractCapital={(amount, label) => spend(amount, label ?? 'Airport Infrastructure')}
                        currentYear={yearOf(currentDateOffset)}
                        currentMonth={monthOf(currentDateOffset)}
                        difficulty={difficulty}
                        initialRouteId={editingPricingRouteId}
                        isEditingPricingOnly={true}
                        onSaveRoute={(route) => {
                          setRoutes(prev => prev.map(r => r.id === route.id ? { ...route, openedOffset: r.openedOffset ?? route.openedOffset } : r));
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
                    <div className="absolute inset-0 z-[45] flex" data-tour="route-planner">
                     <ErrorBoundary label="Route Planner" onReset={() => setIsPlanningRoute(false)} resetLabel="CLOSE PLANNER">
                      <React.Suspense fallback={<LazyFallback label="Route Planner" />}>
                      <RoutePlannerView
                        debugMode={debugMode}
                        airports={airports}
                        fleet={fleet}
                        routes={routes}
                        onNotify={setAppAlert}
                        playerMods={playerMods}
                        fuelPrice={fuelData.price}
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
                        currentYear={yearOf(currentDateOffset)}
                        currentMonth={monthOf(currentDateOffset)}
                        difficulty={difficulty}
                        aiAirlines={aiAirlines}
                        airlineCode={airlineCode}
                        onSaveRoute={(route) => {
                          setRoutes(prev => {
                            const existing = prev.find(r => r.id === route.id);
                            if (existing) {
                              return prev.map(r => r.id === route.id ? { ...route, openedOffset: existing.openedOffset ?? route.openedOffset } : r);
                            }
                            // A new route starts its ramp-up now; see routeMaturity.ts.
                            return [...prev, { ...route, openedOffset: currentDateOffset }];
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
                        }}
                        onClose={() => {
                          setIsPlanningRoute(false);
                          setActiveWindow('map');
                        }}
                        onUnlockManagement={handleUnlockManagement}
                        airportLock={airportRankGate}
                        onUpdateInfrastructure={(airportId, infra) => {
                          setAirportManagement(prev => ({ ...prev, [airportId]: infra }));
                        }}
                        onSubtractCapital={(amount, label) => spend(amount, label ?? 'Airport Infrastructure')}
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
                        transferHub={network.hubStats[selectedAirport.id]}
                        onNotify={setAppAlert}
                        gates={{
                          airport: airportRankGate(selectedAirport),
                          tier2: managementGate(2, career.rank, perks.extraHubs, airportManagement, selectedAirport.id, freeMode),
                          tier3: managementGate(3, career.rank, perks.extraHubs, airportManagement, selectedAirport.id, freeMode),
                          vipLounge: rankGateMessage(career.rank, RANK_NEEDED.vipLounge, 'The VIP lounge')
                        }}
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
                          // Costs are settled by onSubtractCapital before this
                          // runs; here we only store the new layout.
                          setAirportManagement(prev => ({
                            ...prev,
                            [selectedAirport.id]: infra
                          }));
                        }}
                        onSubtractCapital={(amount, label) => spend(amount, label ?? 'Airport Infrastructure')}
                        capital={capital}
                        onManageRoutes={() => {
                          if (selectedAirport) {
                            setRouteFilter(selectedAirport.id);
                            setActiveWindow('routes');
                            setSelectedAirport(null);
                          }
                        }}
                        onStartRoute={(airportId, role) => {
                          showPlanner();
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
                  {/* Floating Next Month Button. Positioned in the map viewport rather
                      than the screen, so on upright phones it sits above the bottom
                      navigation. */}
                  {activeWindow === 'map' && !isPlanningRoute && !editingCabinRouteId && !editingPricingRouteId && (
                    <div className="absolute bottom-4 right-4 rail:bottom-6 rail:right-6 short:bottom-3 short:right-3 z-[1000] pointer-events-auto">
                      <button
                        onClick={handleAdvanceMonth}
                        data-tour="next-month"
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
        // Above the floating Next Month button (z-[1000]), which otherwise sat on top of the dialog.
        <SettingsDialog
          setDecimalSymbol={setDecimalSymbol}
          decimalSymbol={decimalSymbol}
          uiScaleSetting={uiScaleSetting}
          setUiScaleSetting={setUiScaleSetting}
          autosaveInterval={autosaveInterval}
          setAutosaveInterval={setAutosaveInterval}
          setAutosaveOverwrite={setAutosaveOverwrite}
          autosaveOverwrite={autosaveOverwrite}
          gameSettings={gameSettings}
          setGameSettings={setGameSettings}
          view={view}
          setTutorialStep={setTutorialStep}
          setIsSettingsOpen={setIsSettingsOpen}
          setView={setView}
          openWindow={openWindow}
        />
      )}

      {showExitSavePrompt && (() => {
        const target = manualSaveTarget();
        const existing = target ? saves.find(s => s.id === target.id) : undefined;
        return (
          <div className="fixed inset-0 z-[1001] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div role="dialog" aria-modal="true" aria-labelledby="exit-save-title" className="bg-aero-carbon border border-white/10 shadow-2xl p-4 max-w-md w-full">
              <h2 id="exit-save-title" className="text-lg font-mono text-aero-yellow uppercase tracking-[0.2em] font-black mb-3">Save before leaving?</h2>
              <p className="text-sm text-white/80 mb-4">
                {existing
                  ? <>This overwrites <span className="text-white font-bold">"{existing.name}"</span> (last saved {new Date(existing.timestamp).toLocaleString()}).</>
                  : target
                    ? <>This saves your game as <span className="text-white font-bold">"{target.name}"</span>.</>
                    : <>This game has not been saved yet. It will be stored as a new save.</>}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <button
                  onClick={() => setShowExitSavePrompt(false)}
                  disabled={isSavingBeforeExit}
                  className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-3 py-2 font-mono text-xs tracking-widest uppercase transition-all disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={returnToMainMenu}
                  disabled={isSavingBeforeExit}
                  className="bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 px-3 py-2 font-mono text-xs tracking-widest uppercase transition-all disabled:opacity-40"
                >
                  Leave without saving
                </button>
                <button
                  autoFocus
                  onClick={saveAndReturnToMainMenu}
                  disabled={isSavingBeforeExit}
                  className="bg-aero-yellow text-black border border-aero-yellow px-3 py-2 font-mono text-xs tracking-widest uppercase font-black transition-all hover:brightness-110 disabled:opacity-60"
                >
                  {isSavingBeforeExit ? 'Saving…' : 'Save & leave'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
              className="bg-aero-panel border-2 border-aero-yellow/40 max-w-lg w-full p-4 shadow-2xl relative text-left"
            >
              <div className="flex justify-between items-start border-b border-white/10 pb-4 mb-4">
                <div>
                  <span className="text-3xs font-mono text-white/40 block mb-1 uppercase tracking-widest font-black">
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
      {/* Outside the scaled root: the tutorial measures and draws in screen pixels. */}
      {tutorialStep !== null && !tutorialHidden && (
        <React.Suspense fallback={null}>
        <TutorialOverlay
          step={tutorialStep}
          state={tutorialState}
          currentView={tutorialView}
          layoutKey={`${view}|${activeWindow}|${isPlanningRoute}|${isEditingSchedule}|${finalUiScale}`}
          onGoTo={goToTutorialStep}
          onNavigate={showTutorialTarget}
        />
        </React.Suspense>
      )}
    </div>
    </AccountScopeContext.Provider>
  );
}
