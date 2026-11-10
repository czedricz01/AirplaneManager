/**
 * The month's close: everything that happens when the player ends a month.
 *
 * This is the game's main step. It prices the month, writes the report, lets
 * the rivals move, rolls events, disruptions and deliveries, settles goals,
 * the rank, the scenario and the staff, and prepares the next month.
 *
 * It used to be a 1 100-line function inside the App component that called
 * about forty React state setters as it went, which made it impossible to run
 * outside the browser. Here it takes the game's state as one object and
 * returns the state changes as a list of commands, in the order it used to
 * make them. App replays the list on its setters, so the behaviour is the
 * same call for call, and the close can now be run from a test.
 *
 * Two things reach outside the function: the active random events are kept in
 * eventSystem's module state (the event lookups below read them from there),
 * and a scenario's stars are written to browser storage when it is won.
 */
import type { AiAirline } from '../components/CompetitorsView';
import type { AnnualGoal } from './annualGoals';
import type { ScenarioStars } from './careerScore';
import type { BirdStrike } from './disruptions';
import type { Branding, ChronicleEntry, GameDecision, GameSettings, Marketing, RegionId, ScenarioState } from './gameState';
import { ensureFreeOption } from './gameState';
import type { AirportInfrastructure, ViewState } from './gameTypes';
import type { Edition } from './newspaper';
import type { ResearchEffects } from './research';
import type React from 'react';
import { LITRES_PER_GALLON, formatCurrency, formatNumber, monthOf, yearOf } from './format';
import { EventRegion, HistoricalEvent, eventKey, eventScope, getActiveEvents, setRuntimeRandomEvents } from './eventSystem';
import { GameMessage, MonthlyReport, SimulatedRoute } from './gameTypes';
import { ScenarioContext, evaluateScenario } from './scenarioEval';
import { airports, airportsMapAdjusted } from '../data/airportRegistry';
import { NetworkEnv, computeNetworkFinancials } from './transferUtils';
import { Career, Disruption, PlayerModifiers, ReportIncident, Staff, buildPlayerModifiers } from './gameState';
import { findNonFinite } from './invariants';
import { logWarn } from './debugLog';
import { getAirportUpkeep, toStoredRouteMetrics } from './financeUtils';
import { ageYears, agedPopularity, fleetOwnershipCost } from './fleetCosts';
import { ownedAirports, ownerIncome } from './hubOwnership';
import { CAMPAIGN_SPECS, REGION_LABELS, dropExpiredCampaigns, marketingMonthCost, marketingReputation } from './marketing';
import { MAJOR_DISRUPTION_SHARE, buildDisruptionDecision, charterFeesFor, describeDisruption, disruptionIncidents, disruptionRoutesLabel, disruptionTitle, disruptionsIn, disruptionsToAsk, dropPastDisruptions, marginalLostRevenue, rollBirdStrikes, rollDisruptions } from './disruptions';
import { OwnedAircraft } from '../components/MyFleetView';
import { continentOf } from './geoUtils';
import { appendChronicle, chronicleEntriesForMonth, departureMarketShare, regionsServed } from './chronicle';
import { MilestoneContext, describeReward, newlyEarned as newlyEarnedMilestones, totalReward as totalMilestoneReward } from './milestones';
import { capMessages, nextMessageId } from './messages';
import { RankStats, nextRank, rankDef } from './airlineRank';
import { isMalusEvent, malusMonthOpen } from './malus';
import { STRIKE_MORALE_THRESHOLD, STRIKE_PAY_RAISE, STRIKE_REPUTATION_PENALTY, advanceStaff, buildStrikeDecision, strikeCancelShare } from './staff';
import { generateAiAirlines, simulateAiAirlinesTurn } from './aiSimulation';
import { aircraftList } from '../data/aircraft';
import { buildYearSnapshot, describeGoal, generateGoalOffers, settleGoal } from './annualGoals';
import { bestStars, careerScore, starsFor } from './careerScore';
import { CLASS_PROJECTS, advanceResearch, boostedEfficiency, boostedPopularity, researchEffects } from './research';
import { LAUNCH_BONUS, LAUNCH_BONUS_MONTHS, isLaunchDelivery, settleDeliveries } from './preorders';
import { createOwnedAircraft, defaultCabin } from './fleet';
import { scenarioById } from '../data/scenarios';
import { writeJson } from './safeStorage';
import { buildEdition, rivalMoves } from './newspaper';
import { rawBlockMinutes } from './scheduleUtils';

export const offsetToDateStr = (offset: number) =>
  `${(monthOf(offset)).toString().padStart(2, '0')}/${yearOf(offset)}`;

export const signedPercent = (multiplier: number) => {
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
export function buildEventStartMessage(ev: HistoricalEvent, idSeed: number): GameMessage {
  const dateStr = offsetToDateStr(ev.startOffset);
  const demand = signedPercent(ev.demandMultiplier);
  const fuel = signedPercent(ev.fuelMultiplier);
  return {
    id: idSeed,
    text: ev.regions?.length
      ? `${ev.demandMultiplier < 1 ? 'REGIONAL CRISIS' : 'REGIONAL EVENT'}: "${ev.title}" begins${eventScope(ev)}. Demand ${demand} there, for ${ev.duration} months.`
      : `GLOBAL EVENT: "${ev.title}" begins. Demand ${demand}, fuel ${fuel}, for ${ev.duration} months.`,
    isRead: false,
    dateStr,
    details: {
      title: ev.title,
      source: "Global Intelligence Agency",
      content:
        `${ev.description}\n\nActive from ${dateStr} for ${ev.duration} months, ` +
        `through ${offsetToDateStr(ev.startOffset + ev.duration - 1)}.\n\n` +
        `Projected impact:\n` +
        (ev.regions?.length
          ? `\u2022 Passenger demand${eventScope(ev)}: ${demand}, on routes inside the region; a route with one end there feels half of it\n` +
            `\u2022 Everywhere else: no change\n\n`
          : `\u2022 Global passenger demand: ${demand}\n` +
            `\u2022 Jet fuel market index: ${fuel}\n\n`) +
        `These multiply with any other event running at the same time.`
    }
  };
}

export function buildEventEndMessage(ev: HistoricalEvent, idSeed: number, endOffset: number): GameMessage {
  return {
    id: idSeed,
    text: ev.regions?.length ? `"${ev.title}" has ended${eventScope(ev)}. Demand there returns to normal.` : `"${ev.title}" has ended. Demand and fuel return to normal.`,
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

/** Adds a one-off amount to the month's list, merging items with the same label. */
export function addCapexItem(list: { label: string; amount: number }[], label: string, amount: number) {
  return list.some(c => c.label === label)
    ? list.map(c => (c.label === label ? { ...c, amount: c.amount + amount } : c))
    : [...list, { label, amount }];
}

/** The month a saved report closed, as an offset from 01/1960. */
export const reportOffset = (r: { year: number; month: number }) => (r.year - 1960) * 12 + (r.month - 1);

/** Capital at the month-ends a scenario has seen so far, oldest first, from the saved reports. */
export function scenarioCapitalHistory(reports: MonthlyReport[], startedOffset: number): number[] {
  return reports
    .filter(r => r && reportOffset(r) >= startedOffset)
    .map(r => r.capitalAfter)
    .filter((capital): capital is number => typeof capital === 'number' && Number.isFinite(capital));
}

/** The player's routes as a scenario's goals count them: by city pair, with their weekly departures. */
export const scenarioRoutes = (routes: SimulatedRoute[]): ScenarioContext['routes'] =>
  routes.map(r => ({ origin: r.origin, destination: r.destination, weeklyFlights: r.schedule?.length || r.weeklyFlights || 0 }));

/** Every rival departure, as offers the finance engine can split demand by. */
export function buildRivalOffers(ais: any[] | null | undefined) {
  return (ais || []).flatMap((ai: any) =>
    (ai.routes || []).map((r: any) => ({
      origin: r.origin,
      destination: r.destination,
      departures: r.departures || 0,
      airline: ai.name,
      // A rival cutting fares in a price war is that much more attractive.
      ...(r.priceCut > 0 ? { priceAppeal: 1 / (1 - Math.min(0.5, r.priceCut)) } : {})
    }))
  );
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
    title: "Regional Airspace Closure",
    description: "A conflict and the airspace restrictions that follow cut the routes into and out of one part of the world.",
    demandMin: 0.70, demandMax: 0.82,
    fuelMin: 1.0, fuelMax: 1.0,
    durationMin: 2, durationMax: 4,
    regional: true
  },
  {
    title: "Regional Tourism Boom",
    description: "A destination goes viral and a whole region fills with visitors.",
    demandMin: 1.12, demandMax: 1.20,
    fuelMin: 1.0, fuelMax: 1.0,
    durationMin: 3, durationMax: 6,
    regional: true
  },
  {
    title: "Regional Aviation Strike Wave",
    description: "Airport and airline staff across one region take turns to strike; bookings go elsewhere.",
    demandMin: 0.82, demandMax: 0.90,
    fuelMin: 1.0, fuelMax: 1.0,
    durationMin: 2, durationMax: 3,
    regional: true
  },
  {
    title: "Geopolitical Energy Friction",
    description: "Temporary political standoffs in major energy regions cause speculators to bid up fuel and hydrocarbon costs.",
    demandMin: 0.95, demandMax: 0.99,
    fuelMin: 1.15, fuelMax: 1.25,
    durationMin: 2, durationMax: 4
  }
];

/** Everything the close reads. */
export interface MonthCloseInput {
  getFuelData: (offset: number) => { price: number; trend: string; };
  currentDateOffset: number;
  airportManagement: Record<string, AirportInfrastructure>;
  difficulty: string;
  rivalOffers: any[];
  routes: SimulatedRoute[];
  fleet: OwnedAircraft[];
  playerMods: PlayerModifiers;
  researchFx: ResearchEffects;
  aiAirlines: AiAirline[];
  marketing: Marketing;
  disruptions: Disruption[];
  reputation: number;
  eventChoices: Record<string, string>;
  staff: Staff;
  profitStreak: number;
  career: Career;
  capital: number;
  milestones: string[];
  yearsInBusiness: number;
  randomEvents: HistoricalEvent[];
  pendingDecisions: GameDecision[];
  monthlyCapex: { label: string; amount: number; }[];
  selectedHub: string;
  aiAirlinesCount: number;
  aiDifficulty: string;
  airlineCode: string;
  branding: Branding;
  annualGoal: AnnualGoal | null;
  reportHistory: MonthlyReport[];
  startDateOffset: number;
  fleetValue: number;
  freeMode: boolean;
  airlineName: string;
  chronicle: ChronicleEntry[];
  homeRegion: RegionId;
  scenario: ScenarioState | null;
  scenarioStars: ScenarioStars;
  userId: string | null;
  getBaseGlobalDemand: (offset: number) => { value: number; trend: string; };
  latestReport: MonthlyReport | null;
  gameSettings: GameSettings;
  autosaveInterval: number;
  /** Random numbers in [0, 1); Math.random unless a test supplies its own. */
  rng?: () => number;
}

/** The state setters whose calls the close records. */
export interface MonthCloseSetters {
  setProfitStreak: React.Dispatch<React.SetStateAction<number>>;
  setMilestones: React.Dispatch<React.SetStateAction<string[]>>;
  setStaff: React.Dispatch<React.SetStateAction<Staff>>;
  setCapital: React.Dispatch<React.SetStateAction<number>>;
  setMonthlyCapex: React.Dispatch<React.SetStateAction<{ label: string; amount: number; }[]>>;
  setAiAirlines: React.Dispatch<React.SetStateAction<AiAirline[]>>;
  setRandomEventsState: React.Dispatch<React.SetStateAction<HistoricalEvent[]>>;
  setDisruptions: React.Dispatch<React.SetStateAction<Disruption[]>>;
  setBirdStrikeAlerts: React.Dispatch<React.SetStateAction<BirdStrike[]>>;
  setAnnualGoal: React.Dispatch<React.SetStateAction<AnnualGoal | null>>;
  setGoalOfferOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setReputation: React.Dispatch<React.SetStateAction<number>>;
  setCareer: React.Dispatch<React.SetStateAction<Career>>;
  setPendingDecision: React.Dispatch<React.SetStateAction<HistoricalEvent | null>>;
  setReportHistory: React.Dispatch<React.SetStateAction<MonthlyReport[]>>;
  setScenarioStars: React.Dispatch<React.SetStateAction<ScenarioStars>>;
  setScenario: React.Dispatch<React.SetStateAction<ScenarioState | null>>;
  setScenarioResultOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setChronicle: React.Dispatch<React.SetStateAction<ChronicleEntry[]>>;
  setEdition: React.Dispatch<React.SetStateAction<Edition | null>>;
  setIsNewspaperOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMarketing: React.Dispatch<React.SetStateAction<Marketing>>;
  setMessages: React.Dispatch<React.SetStateAction<GameMessage[]>>;
  setPendingAutosave: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentDateOffset: React.Dispatch<React.SetStateAction<number>>;
  setRoutes: React.Dispatch<React.SetStateAction<SimulatedRoute[]>>;
  setView: React.Dispatch<React.SetStateAction<ViewState>>;
  setFleet: React.Dispatch<React.SetStateAction<OwnedAircraft[]>>;
  setPendingDecisions: React.Dispatch<React.SetStateAction<GameDecision[]>>;
}

/** One recorded setter call: which setter, and the value or updater it was given. */
export type MonthCloseCommand = { [K in keyof MonthCloseSetters]: { setter: K; value: Parameters<MonthCloseSetters[K]>[0] } }[keyof MonthCloseSetters];

/** Replays the close's commands on the real setters, in order. */
export function applyMonthClose(commands: MonthCloseCommand[], setters: MonthCloseSetters): void {
  for (const command of commands) {
    (setters[command.setter] as (value: unknown) => void)(command.value);
  }
}

export function closeMonth(input: MonthCloseInput): MonthCloseCommand[] {
  const {
    getFuelData, currentDateOffset, airportManagement, difficulty, rivalOffers, routes, fleet, playerMods, researchFx, aiAirlines, marketing, disruptions, reputation, eventChoices, staff, profitStreak, career, capital, milestones, yearsInBusiness, randomEvents, pendingDecisions, monthlyCapex, selectedHub, aiAirlinesCount, aiDifficulty, airlineCode, branding, annualGoal, reportHistory, startDateOffset, fleetValue, freeMode, airlineName, chronicle, homeRegion, scenario, scenarioStars, userId, getBaseGlobalDemand, latestReport, gameSettings, autosaveInterval
  } = input;
  const rng = input.rng ?? Math.random;

  const commands: MonthCloseCommand[] = [];
  /** Stands in for a React setter: it notes the call instead of making it. */
  const record = <K extends keyof MonthCloseSetters>(setter: K) =>
    ((value: Parameters<MonthCloseSetters[K]>[0]) => { commands.push({ setter, value } as MonthCloseCommand); }) as MonthCloseSetters[K];
  const setProfitStreak = record('setProfitStreak');
  const setMilestones = record('setMilestones');
  const setStaff = record('setStaff');
  const setCapital = record('setCapital');
  const setMonthlyCapex = record('setMonthlyCapex');
  const setAiAirlines = record('setAiAirlines');
  const setRandomEventsState = record('setRandomEventsState');
  const setDisruptions = record('setDisruptions');
  const setBirdStrikeAlerts = record('setBirdStrikeAlerts');
  const setAnnualGoal = record('setAnnualGoal');
  const setGoalOfferOpen = record('setGoalOfferOpen');
  const setReputation = record('setReputation');
  const setCareer = record('setCareer');
  const setPendingDecision = record('setPendingDecision');
  const setReportHistory = record('setReportHistory');
  const setScenarioStars = record('setScenarioStars');
  const setScenario = record('setScenario');
  const setScenarioResultOpen = record('setScenarioResultOpen');
  const setChronicle = record('setChronicle');
  const setEdition = record('setEdition');
  const setIsNewspaperOpen = record('setIsNewspaperOpen');
  const setMarketing = record('setMarketing');
  const setMessages = record('setMessages');
  const setPendingAutosave = record('setPendingAutosave');
  const setCurrentDateOffset = record('setCurrentDateOffset');
  const setRoutes = record('setRoutes');
  const setView = record('setView');
  const setFleet = record('setFleet');
  const setPendingDecisions = record('setPendingDecisions');

  /** Deducts a one-off cost and records it for the month's report; a negative amount is money coming in. */
  const spend = (amount: number, label: string) => {
    setCapital(prev => prev - amount);
    setMonthlyCapex(prev => addCapexItem(prev, label, amount));
  };
  /** Puts a question to the player, always with an answer that costs nothing. */
  const queueDecision = (decision: GameDecision) => {
    setPendingDecisions(prev => [...prev, ensureFreeOption(decision)]);
  };

  // Generate Report First using CURRENT date
  // airportsMapAdjusted is the same lookup, built once at module load.
  const localAirportsMap = airportsMapAdjusted;
  const currentFuelPrice = getFuelData(currentDateOffset).price;
  const currentYearNum = yearOf(currentDateOffset);
  const currentMonthNum = monthOf(currentDateOffset);

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
  const routeDetails: { id: string, name: string, profit: number, revenue: number, cost: number, paxPerWeek: number, capacity: number, transferPax: number }[] = [];
  // Samples for the reputation update further down.
  let repPaxWeek = 0;
  let repSatTimesPax = 0;
  let repSeatsWeek = 0;
  // Passengers flown, connecting ones on each leg, for the frequent-flyer bill.
  let paxWeek = 0;
  const flyingRegs = new Set<string>();

  // The same network pricing the route list shows, connecting passengers included.
  const monthEnv: NetworkEnv = {
    fuelPrice: currentFuelPrice,
    airportManagement,
    year: currentYearNum,
    month: currentMonthNum,
    difficulty,
    airportsMap: localAirportsMap,
    rivalOffers
  };
  const monthNetwork = computeNetworkFinancials(routes, fleet, playerMods, monthEnv);
  /** Ticket revenue of a priced network in a month. */
  const revenueOf = (net: { finById: Map<string, { estWeeklyRev?: number }> }) => {
    let week = 0;
    net.finById.forEach(fin => { week += fin.estWeeklyRev || 0; });
    return week * 4;
  };
  /** Ticket revenue of a whole network in a month, for pricing what a disruption costs. */
  const networkRevenue = (list: SimulatedRoute[], mods: PlayerModifiers, env: NetworkEnv) =>
    revenueOf(computeNetworkFinancials(list, fleet, mods, env));

  routes.forEach(r => {
    const fin = monthNetwork.finById.get(r.id);
    if (fin) {
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
        averageFuelPricePerL = fin.costsBreakdown.fuelPriceL || Math.round((currentFuelPrice / LITRES_PER_GALLON) * 1000) / 1000;
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
      paxWeek += fin.paxPerWeek || 0;
      flyingRegs.add(r.aircraft);

      const weeklySeats = Object.values(fin.paxByClass || {}).reduce((sum: number, pax: any) => sum + (pax?.max || 0), 0);

      routeDetails.push({
        id: r.id,
        name: `${r.origin}-${r.destination} (${r.aircraft})`,
        profit: mProfit,
        revenue: mRev,
        cost: mCost,
        paxPerWeek: fin.paxPerWeek || 0,
        capacity: weeklySeats,
        transferPax: fin.transferPax || 0
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
       const monthlyUpkeepObj = getAirportUpkeep(airport, mgt, routes, fleet, currentYearNum);
       
       const monthSlots = monthlyUpkeepObj.slots.regional + monthlyUpkeepObj.slots.narrowbody + monthlyUpkeepObj.slots.widebody;
       const monthStands = monthlyUpkeepObj.stands.regional + monthlyUpkeepObj.stands.narrowbody + monthlyUpkeepObj.stands.widebody;
       const monthFacs = monthlyUpkeepObj.facilities.hangar + monthlyUpkeepObj.facilities.vip + monthlyUpkeepObj.facilities.catering;
       managementCosts += (monthSlots + monthStands + monthFacs) * 4;

       const monthDesks = monthlyUpkeepObj.desks.normal + monthlyUpkeepObj.desks.self;
       deskCosts += (monthDesks) * 4;
    }
  });

  const totalAirportUpkeep = managementCosts + deskCosts;

  // Every aircraft is insured and kept airworthy whether it flies or not, and
  // more so as it ages; see fleetCosts.ts.
  const ownership = fleetOwnershipCost(fleet, flyingRegs, currentDateOffset, researchFx.maintenanceFactor);
  // The airports owned outright (management tier 3) collect from the rivals
  // that land there; see hubOwnership.ts.
  const hubIncome = ownerIncome(airportManagement, id => localAirportsMap.get(id)?.level ?? 1, aiAirlines);

  // Campaigns running this month and the frequent-flyer programme. Their
  // demand and loyalty are already in this month's route figures above,
  // through playerMods; here they are paid for.
  const marketingCost = marketingMonthCost(marketing, currentDateOffset, paxWeek * 4);
  // Replacement aircraft chartered for this month, billed as an operating
  // cost: 90% of the tickets each one saved, with every other cause -- a
  // strike above all -- applied. The routes' figures above already fly
  // those flights, through playerMods.
  // Charters sharing a route share what they save. The month as it is has
  // been priced already, above: monthNetwork is that very network.
  const charterFees = charterFeesFor(
    disruptions,
    currentDateOffset,
    list => networkRevenue(routes, buildPlayerModifiers({ reputation, eventChoices, marketing, staff, disruptions: list, routes, research: researchFx }, currentDateOffset), monthEnv),
    revenueOf(monthNetwork)
  );
  const charterCosts = Object.values(charterFees).reduce((sum, fee) => sum + fee, 0);
  const totalMonthlyProfit = totalRouteProfit - totalAirportUpkeep - marketingCost.total - charterCosts - ownership.total + hubIncome.total;

  // Inbox messages produced by this tick. Declared here because the
  // milestone check below already writes into it.
  const additionalMessages: GameMessage[] = [];
  /** Aircraft delivered this close; they join the fleet after the month's wear. */
  let deliveredPlanes: OwnedAircraft[] = [];

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
  // Advertising and a loyalty scheme build the brand whether or not
  // anything flew; ahead of the milestones, which may reward the result.
  nextReputation = Math.max(0, Math.min(100, nextReputation + marketingReputation(marketing, currentDateOffset)));

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

  // Passengers flown this month, every leg counted, and what the career
  // has added up to. The rank and the passenger milestones read these.
  const monthlyPax = Math.round(paxWeek * 4);
  const careerPaxNow = career.careerPax + monthlyPax;
  const regionCountNow = regionsServed(routes, localAirportsMap).size;
  const transferPaxMonth = Math.round(
    Object.values(monthNetwork.hubStats).reduce((sum, h) => sum + (h.pax > 0 ? h.pax * 4 : 0), 0)
  );
  // Money the board and the sponsors pay out this close; settled once, below.
  let awardsCash = 0;

  const mctx: MilestoneContext = {
    routeCount: routes.length,
    fleetSize: fleet.length,
    capital: capital + totalMonthlyProfit,
    longestRouteKm: longestKm,
    continents: servedContinents.size,
    profitableMonthStreak: nextStreak,
    reputation: nextReputation,
    careerPax: careerPaxNow,
    transferPaxMonth,
    hasWidebody: fleet.some(p => p.class === 'Widebody'),
    hasSupersonic: fleet.some(p => (p.cruiseSpeed ?? 0) > 1000),
    takeovers: career.takeovers
  };

  const newlyEarned = newlyEarnedMilestones(milestones, mctx);
  if (newlyEarned.length > 0) {
    setMilestones(prev => [...prev, ...newlyEarned.map(m => m.id)]);
    const reward = totalMilestoneReward(newlyEarned);
    nextReputation = Math.min(100, nextReputation + reward.reputation);
    awardsCash += reward.cash;
    newlyEarned.forEach(m => {
      additionalMessages.push({
        id: nextMessageId(),
        text: `MILESTONE: ${m.title}`,
        isRead: false,
        dateStr: offsetToDateStr(currentDateOffset),
        details: {
          title: m.title,
          source: 'Board of Directors',
          content: `${m.detail}\n\nReward: ${describeReward(m.reward, formatCurrency)}.`
        }
      });
    });
  }

  // --- Rank -------------------------------------------------------------------
  // Judged on the month's final reputation, after the milestone bonuses. A
  // rank is never lost, so this only ever moves up.
  const rankStats: RankStats = { routes: routes.length, monthlyPax, reputation: nextReputation, regions: regionCountNow, years: yearsInBusiness };
  const newRank = nextRank(career.rank, rankStats);
  const rankUps: { title: string; detail: string }[] = [];
  for (let r = career.rank + 1; r <= newRank; r++) {
    const def = rankDef(r);
    rankUps.push({ title: `Promoted to ${def.title}`, detail: `Now open: ${def.unlocks.join(', ')}.` });
    nextReputation = Math.min(100, nextReputation + 3);
    additionalMessages.push({
      id: nextMessageId(),
      text: `RANK: your airline is now a ${def.title}.`,
      isRead: false,
      dateStr: offsetToDateStr(currentDateOffset),
      details: {
        title: `Promoted to ${def.title}`,
        source: 'Aviation Authority',
        content:
          `Your network, your passengers and your reputation have earned the rank ${def.title}.\n\n` +
          `Now open to you:\n${def.unlocks.map(u => `• ${u}`).join('\n')}\n\nReputation +3.`
      }
    });
  }
  const nextCareer: Career = { ...career, rank: newRank, careerPax: careerPaxNow };


  // Bad luck is capped at half the months (see malus.ts). Whether the coming
  // month may take on a new malus event is settled once, here, for the strike,
  // the random event and the disruptions below alike.
  const malusOpen = malusMonthOpen(randomEvents, disruptions, staff, currentDateOffset + 1);

  // --- Staff ------------------------------------------------------------
  // Morale takes its monthly step towards what pay and the run of results
  // justify. At the new morale the staff may call a strike for the month
  // about to start, which grounds every flight until the player answers.
  const staffMonth = advanceStaff(staff, {
    profitStreak: nextStreak,
    nextOffset: currentDateOffset + 1,
    strikePending: pendingDecisions.some(d => d.kind === 'strike'),
    noRoutes: routes.length === 0,
    malusBlocked: !malusOpen,
    moraleBonus: researchFx.moraleBonus
  }, rng);
  const nextStaff = staffMonth.staff;
  setStaff(nextStaff);
  if (staff.morale >= STRIKE_MORALE_THRESHOLD && nextStaff.morale < STRIKE_MORALE_THRESHOLD && !staffMonth.strikeCalled) {
    additionalMessages.push({
      id: nextMessageId(),
      text: `STAFF UNREST: morale has fallen to ${Math.round(nextStaff.morale)}.`,
      isRead: false,
      dateStr: offsetToDateStr(currentDateOffset),
      details: {
        title: 'Staff unrest',
        source: 'Human resources',
        content:
          `Morale among crew and ground staff is down to ${Math.round(nextStaff.morale)}. Below ${STRIKE_MORALE_THRESHOLD} the unions ` +
          `may call a strike at any month's end, and the lower it goes the likelier that becomes.\n\n` +
          `Pay is set under My Company > Staff. Morale follows it slowly, a fifth of the way each month.`
      }
    });
  }
  if (staffMonth.strikeCalled) {
    const strikeMonth = offsetToDateStr(currentDateOffset + 1);
    queueDecision(buildStrikeDecision(nextStaff, currentDateOffset + 1, strikeMonth, totalRouteRevenues));
    additionalMessages.push({
      id: nextMessageId(),
      text: `STRIKE: your staff walk out in ${strikeMonth}.`,
      isRead: false,
      dateStr: offsetToDateStr(currentDateOffset),
      details: {
        title: 'Strike called',
        source: 'Human resources',
        content:
          `With morale at ${Math.round(nextStaff.morale)} and pay at ${Math.round(nextStaff.salaryPct)}% of the market wage, ` +
          `the unions have called a strike for ${strikeMonth}.\n\n` +
          `Raising pay by ${STRIKE_PAY_RAISE} points gets half the flights back in the air; sitting it out grounds all of them ` +
          `and costs ${STRIKE_REPUTATION_PENALTY} reputation. The route list already shows the month without them.`
      }
    });
  }

  // What cost the airline flights this month, for the report.
  const incidents: ReportIncident[] = [];
  const strikeShare = strikeCancelShare(staff, currentDateOffset);
  if (strikeShare > 0 && routes.length > 0) {
    incidents.push({
      kind: 'strike',
      title: 'Staff strike',
      detail: strikeShare >= 1
        ? 'Sat out: every route grounded'
        : `Settled with a pay rise: ${Math.round((1 - strikeShare) * 100)}% of flights operated`,
      cancelShare: strikeShare,
      routeCount: routes.length
    });
  }
  const routeLabel = (id: string) => {
    const r = routes.find(x => x.id === id);
    return r ? `${r.origin}-${r.destination}` : 'a closed route';
  };
  incidents.push(...disruptionIncidents(disruptions, currentDateOffset, routeLabel, charterFees));

  const capexTotal = monthlyCapex.reduce((sum, c) => sum + c.amount, 0);

  const report = {
    month: currentMonthNum,
    year: currentYearNum,
    routeRevenues: totalRouteRevenues,
    routeCosts: totalRouteCosts,
    airportUpkeep: totalAirportUpkeep,
    totalProfit: totalMonthlyProfit,
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
      marketing: marketingCost.total,
      marketingCampaigns: marketingCost.campaigns,
      ffp: marketingCost.ffp,
      // Charters, as the report lists them per incident (older reports add repair bills).
      incidents: charterCosts,
      charters: charterCosts,
      // Insurance and maintenance of the whole fleet, and what of it was
      // spent on aircraft with no route; income from rivals at owned airports.
      fleetOwnership: ownership.total,
      fleetParked: ownership.parked,
      fleetParkedCount: ownership.parkedCount,
      hubIncome: hubIncome.total
    },
    ...(hubIncome.items.length > 0
      ? { hubIncomeItems: hubIncome.items.map(i => ({ label: `${localAirportsMap.get(i.airportId)?.name || i.airportId}: ${formatNumber(i.landings)} rival landings a week`, amount: i.amount })) }
      : {}),
    marketingItems: marketingCost.items,
    // Only in months that had any; older reports have none.
    ...(incidents.length > 0 ? { incidents } : {})
  };

  // Apply Financials
  setCapital(prev => prev + totalMonthlyProfit);
  setMonthlyCapex([]);

  // Simulate AI Controlled Airlines
  const nextOffsetForRivals = currentDateOffset + 1;
  let aiMessages: GameMessage[] = [];
  let aisAfterTurn = aiAirlines;
  if (aiAirlines.length > 0) {
    const { updatedAis, newMessages } = simulateAiAirlinesTurn(
      aiAirlines,
      airports,
      currentDateOffset,
      selectedHub,
      routes,
      { blocked: ownedAirports(airportManagement) }
    );
    // A rival wound up is eventually replaced by a new one, so the market
    // does not empty over the decades; the game's rival count is the target.
    let afterTurn = updatedAis;
    if (updatedAis.length < aiAirlinesCount && rng() < 0.15) {
      const fresh = generateAiAirlines(1, aiDifficulty, selectedHub, nextOffsetForRivals, airlineCode, branding.color, updatedAis);
      if (fresh.length > 0) {
        afterTurn = [...updatedAis, ...fresh];
        newMessages.push({
          id: nextMessageId(),
          text: `NEW RIVAL: ${fresh[0].name} (${fresh[0].code}) starts flying from ${fresh[0].hub}.`,
          isRead: false,
          dateStr: offsetToDateStr(currentDateOffset)
        });
      }
    }
    setAiAirlines(afterTurn);
    aiMessages = newMessages;
    aisAfterTurn = afterTurn;
  }

  const nextOffset = currentDateOffset + 1;
  const isNextJanuary = nextOffset % 12 === 0;

  // Which world events are running right now. Compared against the same list
  // for next month further below, this is what tells the player an event
  // started or ended -- for scripted history as well as random events.
  const activeBefore = new Set(getActiveEvents(currentDateOffset).map(eventKey));

  // 1. Check January Forecast News
  if (isNextJanuary) {
    const forecastYear = yearOf(nextOffset);
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

  // 2. Roll for a random event: average 0.6 per year -> 0.05 probability per month (1 / 20).
  // One that only hurts is dropped when the malus ceiling holds the month clear.
  if (rng() < 0.05) {
    const template = randomEventTemplates[Math.floor(rng() * randomEventTemplates.length)];
    const duration = Math.floor(rng() * (template.durationMax - template.durationMin + 1)) + template.durationMin;
    const demandMultiplier = Math.round((template.demandMin + rng() * (template.demandMax - template.demandMin)) * 100) / 100;
    const fuelMultiplier = Math.round((template.fuelMin + rng() * (template.fuelMax - template.fuelMin)) * 100) / 100;

    const regionPool: EventRegion[] = ['EU', 'NA', 'SA', 'AF', 'AS', 'OC'];
    const newEv: HistoricalEvent = {
      startOffset: nextOffset,
      duration,
      title: template.title,
      description: template.description,
      demandMultiplier,
      fuelMultiplier,
      // A regional template picks where it happens; the other templates are worldwide.
      ...((template as { regional?: boolean }).regional ? { regions: [regionPool[Math.floor(rng() * regionPool.length)]] } : {})
    };

    if (malusOpen || !isMalusEvent(newEv)) {
      const updatedRandomEvents = [...randomEvents, newEv];
      setRandomEventsState(updatedRandomEvents);
      setRuntimeRandomEvents(updatedRandomEvents);
    }
  }

  // 2b. Roll next month's operational disruptions. They are known for the
  // whole month they hit, so the forecast below and every screen in it
  // already leave the cancelled flights out; the month's close books that.
  // A month the malus ceiling holds clear is not rolled for at all.
  const rolledDisruptions = malusOpen
    ? rollDisruptions(routes, fleet, airportManagement, nextOffset, rng, localAirportsMap, researchFx.defectFactor)
    : [];
  const nextDisruptions = [...dropPastDisruptions(disruptions, nextOffset), ...rolledDisruptions];
  if (nextDisruptions.length !== disruptions.length || rolledDisruptions.length > 0) setDisruptions(nextDisruptions);
  if (rolledDisruptions.length > 0) {
    const monthStr = offsetToDateStr(nextOffset);
    const lines = rolledDisruptions.map(d => describeDisruption(d, routeLabel));
    additionalMessages.push({
      id: nextMessageId(),
      text: rolledDisruptions.length === 1
        ? `OPERATIONS: ${disruptionTitle(rolledDisruptions[0])} in ${monthStr}.`
        : `OPERATIONS: ${rolledDisruptions.length} disruptions in ${monthStr}.`,
      isRead: false,
      dateStr: offsetToDateStr(currentDateOffset),
      details: {
        title: `Operations outlook ${monthStr}`,
        source: 'Operations control',
        content:
          `The following will cost flights in ${monthStr}:\n\n${lines.join('\n')}\n\n` +
          `The route list marks the routes hit and its figures already leave the cancelled flights out. ` +
          `A hangar at a route's origin halves the chance of a technical defect; worn and old aircraft break more often.`
      }
    });
  }

  // 2c. Bird strikes hit next month's flights at once and are done with:
  // the repair bill comes off the bank balance now (and shows as capex in
  // next month's report), a pop-up says so, and nothing is cancelled.
  const birdStrikes = rollBirdStrikes(routes, fleet, nextOffset, rng);
  if (birdStrikes.length > 0) {
    setBirdStrikeAlerts(prev => [...prev, ...birdStrikes]);
    for (const b of birdStrikes) {
      spend(b.cost, `Bird strike: ${b.registration}`);
      additionalMessages.push({
        id: nextMessageId(),
        text: `BIRD STRIKE: ${b.registration}, ${formatCurrency(-b.cost)}.`,
        isRead: false,
        dateStr: offsetToDateStr(currentDateOffset),
        details: {
          title: `Bird strike: ${b.registration}`,
          source: 'Operations control',
          content:
            `${b.registration} flew into a flock of birds on ${routeLabel(b.routeId)} in ${offsetToDateStr(nextOffset)}. ` +
            `The repair bill of ${formatCurrency(b.cost)} was paid on the spot; no flights were cancelled.`
        }
      });
    }
  }

  // --- Annual goal -------------------------------------------------------
  // Each December the board settles the goal the player picked for the year
  // and puts three goals for the next one. An offer still unanswered when the
  // next year's first month closes is settled by taking the steady goal.
  const closingYear = currentYearNum;
  const isDecember = currentMonthNum === 12;
  const nowFigures = { routes: routes.length, regions: regionCountNow, reputation: nextReputation };
  let goalResult: { year: number; target: number; achieved: number; met: boolean; text?: string } | null = null;
  let activeGoal = annualGoal;
  if (nextCareer.goalOffer && nextCareer.goalOffer.year <= closingYear && (!activeGoal || activeGoal.year < nextCareer.goalOffer.year)) {
    const fallback = nextCareer.goalOffer.options[0];
    activeGoal = fallback;
    setAnnualGoal(fallback);
    nextCareer.goalOffer = null;
    additionalMessages.push({
      id: nextMessageId(),
      text: `TARGET FOR ${fallback.year}: the board set the standard goal, ${describeGoal(fallback, formatCurrency, formatNumber)}.`,
      isRead: false,
      dateStr: offsetToDateStr(currentDateOffset),
      details: {
        title: `${fallback.year} target`,
        source: 'Board of Directors',
        content:
          `The board waited for your choice and, having none, set the standard goal for ${fallback.year}: ` +
          `${describeGoal(fallback, formatCurrency, formatNumber)}.\n\nMeeting it is worth ${fallback.reward.reputation} reputation.`
      }
    });
  }
  if (isDecember) {
    const yearSnap = buildYearSnapshot(
      [...reportHistory, { ...report, paxTotal: monthlyPax }],
      closingYear,
      nowFigures
    );

    if (activeGoal && activeGoal.year === closingYear) {
      const settled = settleGoal(activeGoal, yearSnap);
      const summary = describeGoal(activeGoal, formatCurrency, formatNumber);
      goalResult = {
        year: closingYear,
        target: activeGoal.target,
        achieved: settled.achieved,
        met: settled.met,
        text: settled.met
          ? `${closingYear} goal met: ${summary}.`
          : `${closingYear} goal missed: ${summary}.`
      };
      nextReputation = Math.max(0, Math.min(100, nextReputation + settled.reputation));
      awardsCash += settled.cash;
      additionalMessages.push({
        id: nextMessageId(),
        text: settled.met ? `GOAL MET: ${summary}.` : `GOAL MISSED: ${summary}.`,
        isRead: false,
        dateStr: offsetToDateStr(currentDateOffset),
        details: {
          title: `${closingYear} annual result`,
          source: 'Board of Directors',
          content:
            `Goal for ${closingYear}: ${summary}\n\n` +
            (settled.met
              ? `The board is satisfied. Reputation +${settled.reputation}` +
                (settled.cash > 0 ? ` and a bonus of ${formatCurrency(settled.cash)}.` : '.')
              : `The board expected more. Reputation ${settled.reputation}.`)
        }
      });
    }

    const options = generateGoalOffers(closingYear + 1, {
      lastYearProfit: yearSnap.profit,
      lastYearPax: yearSnap.pax,
      routes: routes.length,
      regions: regionCountNow,
      reputation: nextReputation
    });
    nextCareer.goalOffer = { year: closingYear + 1, options };
    setAnnualGoal(null);
    setGoalOfferOpen(true);
    additionalMessages.push({
      id: nextMessageId(),
      text: `GOALS FOR ${closingYear + 1}: the board asks you to choose one.`,
      isRead: false,
      dateStr: offsetToDateStr(currentDateOffset),
      details: {
        title: `${closingYear + 1} goals`,
        source: 'Board of Directors',
        content:
          `The board offers three goals for ${closingYear + 1}:\n\n` +
          options.map(o => `• ${describeGoal(o, formatCurrency, formatNumber)} -- reputation +${o.reward.reputation}` +
            (o.reward.cash > 0 ? `, bonus ${formatCurrency(o.reward.cash)}` : '') +
            `; missing it costs ${o.penalty} reputation`).join('\n') +
          `\n\nChoose one under My Company > Overview. Without a choice the first is taken when ${closingYear + 1} begins.`
      }
    });
  }

  // --- Anniversaries ------------------------------------------------------------
  // Every ten years the board takes stock and points out that the airline may
  // retire at any time.
  if (currentDateOffset + 1 > startDateOffset && (currentDateOffset + 1 - startDateOffset) % 120 === 0) {
    const years = (currentDateOffset + 1 - startDateOffset) / 12;
    const snapshot = careerScore({
      netWorth: capital + totalMonthlyProfit + fleetValue,
      rank: nextCareer.rank,
      free: freeMode,
      milestones: milestones.length + newlyEarned.length,
      reputation: nextReputation,
      takeovers: nextCareer.takeovers,
      // As on the Career screen: the classes a Free Mode airline starts with do not count.
      projectsDone: Math.max(0, nextCareer.research.done.length - (freeMode ? CLASS_PROJECTS.length : 0)),
      years
    });
    additionalMessages.push({
      id: nextMessageId(),
      text: `ANNIVERSARY: ${years} years of ${airlineName || 'Neo Airlines'}. Career score ${formatNumber(snapshot.total)}.`,
      isRead: false,
      dateStr: offsetToDateStr(currentDateOffset),
      details: {
        title: `${years} years`,
        source: 'Board of Directors',
        content:
          `The board looks back on ${years} years: career score ${formatNumber(snapshot.total)}.\n\n` +
          `You may retire at any time under Career: the career is filed in the hall of fame, and you can play on.`
      }
    });
  }

  // --- Development --------------------------------------------------------------
  const research = advanceResearch(nextCareer.research, currentDateOffset + 1);
  nextCareer.research = research.state;
  // What the development tree has finished by now, this month's completions
  // included, already acts on the month that starts.
  const fxAfter = researchEffects(nextCareer.research.done);
  const boost = (p: OwnedAircraft): OwnedAircraft => ({
    ...p,
    efficiency: boostedEfficiency(p.efficiency, fxAfter),
    popularity: boostedPopularity(p.popularity, fxAfter)
  });
  for (const project of research.completed) {
    additionalMessages.push({
      id: nextMessageId(),
      text: `DEVELOPMENT: "${project.title}" is complete.`,
      isRead: false,
      dateStr: offsetToDateStr(currentDateOffset),
      details: { title: project.title, source: 'Development department', content: project.kind === 'class'
        ? `${project.detail}\n\nThese aircraft can be bought, ordered and found second-hand from now on.`
        : `${project.detail}\n\nThe effect is in place from next month.` }
    });
  }

  // --- Deliveries ---------------------------------------------------------------
  // Ordered aircraft arrive when their month comes, paid for from the cash
  // the month leaves; see preorders.ts. They join the fleet after the month's
  // wear is applied, so a new aircraft is not worn on arrival.
  const deliveryMonth = currentDateOffset + 1;
  const book = settleDeliveries(nextCareer.orders, deliveryMonth, capital + totalMonthlyProfit);
  nextCareer.orders = book.remaining;
  deliveredPlanes = [];
  for (const o of book.delivered) {
    const spec = aircraftList.find(a => a.id === o.aircraftId);
    if (!spec) continue;
    const { config, baseInteriorPop } = defaultCabin(spec);
    const made = createOwnedAircraft(spec, o.quantity, {
      config,
      baseInteriorPop,
      hub: selectedHub || 'FRA',
      existingRegistrations: [...fleet.map(p => p.registration), ...deliveredPlanes.map(p => p.registration)],
      purchasedAt: deliveryMonth
    });
    const launch = isLaunchDelivery(spec, deliveryMonth);
    deliveredPlanes.push(...made.map(p => boost(launch ? { ...p, popularity: p.popularity + LAUNCH_BONUS, launchBonusUntil: deliveryMonth + LAUNCH_BONUS_MONTHS } : p)));
    additionalMessages.push({
      id: nextMessageId(),
      text: `DELIVERY: ${o.quantity} \u00d7 ${spec.manufacturer} ${spec.type} have arrived.`,
      isRead: false,
      dateStr: offsetToDateStr(currentDateOffset),
      details: {
        title: 'Aircraft delivered',
        source: 'Manufacturer',
        content:
          `${o.quantity} \u00d7 ${spec.manufacturer} ${spec.type} joined your fleet at ${selectedHub || 'FRA'}, with the standard economy cabin. ` +
          `The balance of ${formatCurrency(o.unitPrice * o.quantity - o.deposit)} was paid on delivery.` +
          (launch ? ` As a launch customer you get +${LAUNCH_BONUS} popularity on them for ${LAUNCH_BONUS_MONTHS} months.` : '')
      }
    });
  }
  for (const o of book.postponed) {
    const spec = aircraftList.find(a => a.id === o.aircraftId);
    additionalMessages.push({
      id: nextMessageId(),
      text: `DELIVERY DELAYED: ${spec ? `${spec.manufacturer} ${spec.type}` : 'an order'} slips a month; the balance could not be paid.`,
      isRead: false,
      dateStr: offsetToDateStr(currentDateOffset)
    });
  }
  for (const o of book.cancelled) {
    const spec = aircraftList.find(a => a.id === o.aircraftId);
    additionalMessages.push({
      id: nextMessageId(),
      text: `ORDER CANCELLED: the manufacturer gave up on your order of ${spec ? `${spec.manufacturer} ${spec.type}` : 'aircraft'}; the deposit of ${formatCurrency(o.deposit)} is lost.`,
      isRead: false,
      dateStr: offsetToDateStr(currentDateOffset)
    });
  }
  if (book.charged > 0) {
    setCapital(prev => prev - book.charged);
    setMonthlyCapex(prev => addCapexItem(prev, 'Aircraft Deliveries', book.charged));
  }

  // Written once, after the milestone, rank and annual-goal bonuses have all
  // had their say. Setting it earlier silently dropped the December bonus.
  setReputation(nextReputation);
  setCareer(nextCareer);

  // 3. Announce every event that starts or ends with this tick.
  const afterEvents = getActiveEvents(nextOffset);
  const activeAfter = new Set(afterEvents.map(eventKey));

  const eventsStarted: HistoricalEvent[] = [];
  const eventsEnded: HistoricalEvent[] = [];
  for (const ev of afterEvents) {
    if (!activeBefore.has(eventKey(ev))) {
      eventsStarted.push(ev);
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
      eventsEnded.push(ev);
      additionalMessages.push(buildEventEndMessage(ev, nextMessageId(), nextOffset));
    }
  }

  // --- History ------------------------------------------------------------
  // The report gains the figures the history charts plot, taken once
  // everything above has had its say: reputation after the milestone and
  // annual-goal bonuses, morale after this month's step.
  const regionsNow = regionsServed(routes, localAirportsMap);
  const hubsNow = Object.entries(monthNetwork.hubStats)
    .filter(([, h]) => h.pax > 0)
    .map(([id, h]) => ({ id, name: localAirportsMap.get(id)?.name || id, pax: h.pax * 4 }));
  // Prizes and bonuses paid at this close enter the report as negative
  // one-off spending, so cash change and capital still reconcile.
  const awardedCash = awardsCash;
  const awardedItems = awardedCash > 0 ? [{ label: 'Board prizes & bonuses', amount: -awardedCash }] : [];
  if (awardedCash > 0) setCapital(prev => prev + awardedCash);
  const fullReport = {
    ...report,
    capex: report.capex - awardedCash,
    capexItems: [...report.capexItems, ...awardedItems],
    cashChange: report.cashChange + awardedCash,
    capitalAfter: report.capitalAfter + awardedCash,
    reputation: nextReputation,
    morale: nextStaff.morale,
    paxTotal: Math.round(paxWeek * 4),
    transferPax: Math.round(hubsNow.reduce((sum, h) => sum + h.pax, 0)),
    fleetSize: fleet.length,
    routeCount: routes.length,
    marketShare: departureMarketShare(routes, rivalOffers),
    regions: [...regionsNow.keys()],
    transferHubs: hubsNow.map(h => h.id)
  };
  // Keep ten years. Long enough for any chart the game shows, short enough
  // that the savegame does not grow without bound over a sixty-year run.
  setReportHistory(prev => [...prev, fullReport].slice(-120));

  const monthChronicle = chronicleEntriesForMonth(chronicle, {
    offset: currentDateOffset,
    profit: totalMonthlyProfit,
    capitalAfter: capital + totalMonthlyProfit + awardedCash,
    reputation: nextReputation,
    reputationBefore: reputation,
    history: reportHistory,
    milestones: [...newlyEarned, ...rankUps],
    goal: goalResult,
    eventsStarted,
    eventsEnded: eventsEnded.map(ev => ({ title: ev.title, endOffset: nextOffset })),
    strike: staffMonth.strikeCalled ? { offset: currentDateOffset + 1, morale: nextStaff.morale } : null,
    // What hit the month just closed, now that any charter is known.
    disruptions: disruptionsIn(disruptions, currentDateOffset).map(d => ({
      offset: d.offset,
      cancelShare: d.cancelShare,
      routeCount: d.routeIds.length,
      mitigated: d.mitigated,
      title: disruptionTitle(d),
      where: disruptionRoutesLabel(d, routeLabel, 3)
    })),
    regions: regionsNow,
    homeRegion,
    hubs: hubsNow
  });

  // --- The scenario -----------------------------------------------------------
  // Judged on the month's final figures. Once won or lost it stays so and
  // the game carries on as free play, no longer judged.
  const runningScenario = scenario?.status === 'running' ? scenarioById(scenario.id) : undefined;
  let scenarioDecided: { title: string; won: boolean; reason: string } | null = null;
  let earnedStars = 0;
  if (scenario && runningScenario) {
    // Prizes paid at this close count, as they do in the report and the chronicle.
    const closingCapital = capital + totalMonthlyProfit + awardedCash;
    const evaluation = evaluateScenario(runningScenario, {
      offset: currentDateOffset,
      capital: closingCapital,
      routes: scenarioRoutes(routes),
      reputation: nextReputation,
      regionsServed: regionsNow.size,
      transferPaxMonth: fullReport.transferPax,
      monthlyProfit: totalMonthlyProfit,
      capitalHistory: [...scenarioCapitalHistory(reportHistory, scenario.startedOffset), closingCapital]
    });
    if (evaluation.status !== 'running') {
      const won = evaluation.status === 'won';
      const reason = evaluation.reason || '';
      scenarioDecided = { title: runningScenario.title, won, reason };
      // Stars for how fast it was won; the best of every try is kept.
      earnedStars = starsFor(
        won,
        currentDateOffset - scenario.startedOffset + 1,
        runningScenario.deadlineOffset - scenario.startedOffset + 1
      );
      if (earnedStars > 0) {
        const nextStars = bestStars(scenarioStars, runningScenario.id, earnedStars);
        if (nextStars !== scenarioStars) {
          setScenarioStars(nextStars);
          writeJson(`neo_scenario_stars:${userId || 'local'}`, nextStars);
        }
      }
      setScenario({ ...scenario, status: evaluation.status, result: { offset: currentDateOffset, reason } });
      setScenarioResultOpen(true);
      monthChronicle.push({
        offset: currentDateOffset,
        kind: 'scenario',
        key: 'scenario:result',
        text: `Scenario "${runningScenario.title}" ${won ? `won with ${earnedStars} star${earnedStars === 1 ? '' : 's'}` : 'lost'}. ${reason}`
      });
      additionalMessages.push({
        id: nextMessageId(),
        text: won ? `SCENARIO WON: ${runningScenario.title} (${'\u2605'.repeat(earnedStars)}${'\u2606'.repeat(3 - earnedStars)}).` : `SCENARIO LOST: ${runningScenario.title}.`,
        isRead: false,
        dateStr: offsetToDateStr(currentDateOffset),
        details: {
          title: `${runningScenario.title}: ${won ? 'scenario won' : 'scenario lost'}`,
          source: 'Board of Directors',
          content:
            `${reason}\n\n` +
            (won ? `Stars: ${earnedStars} of 3. Two for winning within three quarters of the time, three within half.\n\n` : '') +
            `Capital ${formatCurrency(closingCapital)}, ${routes.length} route${routes.length === 1 ? '' : 's'}, ` +
            `${fleet.length} aircraft, reputation ${Math.round(nextReputation)}.\n\n` +
            `The airline is yours to fly on without the scenario; it is no longer judged.`
        }
      });
    }
  }
  if (monthChronicle.length > 0) setChronicle(appendChronicle(chronicle, monthChronicle));

  // --- The newspaper --------------------------------------------------------
  // Written from the same facts as the chronicle, plus what the rivals did
  // in their turn and where the markets stand for the coming month.
  const capitalAfterMonth = capital + totalMonthlyProfit;
  const nextFuel = getFuelData(nextOffset);
  const nextDemand = getBaseGlobalDemand(nextOffset);
  setEdition(buildEdition({
    offset: currentDateOffset,
    airlineName,
    report: fullReport,
    prevReport: latestReport,
    profitHistory: reportHistory.map(r => r.totalProfit),
    chronicle: monthChronicle,
    milestones: [...newlyEarned, ...rankUps],
    eventsStarted,
    eventsEnded,
    eventsRunning: afterEvents,
    strike: staffMonth.strikeCalled ? { morale: nextStaff.morale } : null,
    disruptions: rolledDisruptions.map(d => ({
      kind: d.kind,
      title: disruptionTitle(d),
      text: describeDisruption(d, routeLabel).replace(/^\u2022\s*/, ''),
      cancelShare: d.cancelShare,
      routeCount: d.routeIds.length,
      ref: d.ref
    })),
    rivalMoves: rivalMoves(aiAirlines, aisAfterTurn),
    launches: marketing.campaigns
      .filter(c => c.startOffset === currentDateOffset)
      .map(c => ({ tier: CAMPAIGN_SPECS[c.tier].label, region: c.tier === 'global' ? 'global' as const : c.region })),
    ffpStarted: marketing.ffpActive && marketing.ffpSinceOffset === currentDateOffset,
    scenario: scenarioDecided,
    airportName: id => localAirportsMap.get(id)?.name || id,
    ticker: {
      fuelPerLitre: nextFuel.price / LITRES_PER_GALLON,
      fuelTrend: nextFuel.trend,
      demand: nextDemand.value,
      demandTrend: nextDemand.trend,
      rank: 1 + aisAfterTurn.filter(ai => (ai.capital || 0) > capitalAfterMonth).length,
      airlines: aisAfterTurn.length + 1
    }
  }));
  if (gameSettings.newspaper) setIsNewspaperOpen(true);

  // Campaigns whose last month just closed come off the books. Next
  // month's forecast below prices without them, and with any still running.
  const nextMarketing = dropExpiredCampaigns(marketing, nextOffset);
  if (nextMarketing !== marketing) {
    setMarketing(nextMarketing);
    for (const c of marketing.campaigns) {
      if (nextMarketing.campaigns.includes(c)) continue;
      const where = c.tier === 'global' ? 'worldwide' : `in ${REGION_LABELS[c.region]}`;
      additionalMessages.push({
        id: nextMessageId(),
        text: `CAMPAIGN ENDED: ${CAMPAIGN_SPECS[c.tier].label} campaign ${where}.`,
        isRead: false,
        dateStr: offsetToDateStr(currentDateOffset),
        details: {
          title: 'Campaign ended',
          source: 'Marketing department',
          content:
            `The ${CAMPAIGN_SPECS[c.tier].label.toLowerCase()} campaign ${where} has run its ${c.duration} months. ` +
            `Its demand boost ends with this month.\n\nA new one can be booked under My Company > Marketing.`
        }
      });
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
  const nextMods = buildPlayerModifiers({
    reputation: nextReputation, eventChoices, marketing: nextMarketing, staff: nextStaff, disruptions: nextDisruptions, routes, research: researchFx
  }, nextOffset);
  const nextRivalOffers = buildRivalOffers(aisAfterTurn);
  const nextEnv = {
    fuelPrice: getFuelData(nextOffset).price,
    airportManagement,
    year: yearOf(nextOffset),
    month: monthOf(nextOffset),
    difficulty,
    airportsMap: localAirportsMap,
    rivalOffers: nextRivalOffers
  };
  const repriceForNextMonth = (list: SimulatedRoute[]) => list.map(r => {
    const activePrices = r.ticketPrices || { economy: 100 };
    return { ...r, activeTicketPrices: activePrices, ticketPrices: activePrices };
  });
  // Next month priced once, as it stands: the forecast stored on the
  // routes below, and the starting point for pricing the questions.
  const repricedNext = repriceForNextMonth(routes);
  const nextNetwork = computeNetworkFinancials(repricedNext, fleet, nextMods, nextEnv);

  // The bigger disruptions are put to the player: charter a replacement or
  // cancel. What is at stake is the revenue each one takes from next
  // month's forecast, every other disruption applied. A strike called at
  // this close is left out: its answer is still to come, and the charter
  // is billed at the month's close on what it actually saved anyway.
  // Every candidate is still cancelling in nextDisruptions, so the month
  // with it cancelling is the same network for all of them: priced once,
  // and without a strike called at this close it is nextNetwork itself.
  const majorCandidates = rolledDisruptions.filter(d => d.cancelShare >= MAJOR_DISRUPTION_SHARE);
  if (majorCandidates.length > 0) {
    const staffBeforeStrike: Staff = { ...nextStaff, strike: staffMonth.strikeCalled ? null : nextStaff.strike };
    const revenueWith = (list: Disruption[]) => networkRevenue(repricedNext, buildPlayerModifiers({
      reputation: nextReputation, eventChoices, marketing: nextMarketing, staff: staffBeforeStrike, disruptions: list, routes, research: researchFx
    }, nextOffset), nextEnv);
    const allCancelling = staffMonth.strikeCalled ? revenueWith(nextDisruptions) : revenueOf(nextNetwork);
    const lostBy = new Map(majorCandidates.map(d => [d.id, marginalLostRevenue(d, nextDisruptions, revenueWith, allCancelling)]));
    const monthStr = offsetToDateStr(nextOffset);
    for (const d of disruptionsToAsk(majorCandidates, x => lostBy.get(x.id) ?? 0)) {
      queueDecision(buildDisruptionDecision(d, monthStr, lostBy.get(d.id) ?? 0, routeLabel));
    }
  }

  setRoutes(prevRoutes => repriceForNextMonth(prevRoutes).map(r => {
    const fin = nextNetwork.finById.get(r.id);
    return fin ? { ...r, ...toStoredRouteMetrics(fin) } : r;
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
        weeklyFlightMinutes += rawBlockMinutes(s);
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

    // Protective materials (development) make both wear more slowly.
    const interiorDecay = fxAfter.wearFactor * Math.min(
      monthlyFlightHours * INTERIOR_WEAR_PER_HOUR + IDLE_WEAR_PER_MONTH,
      IC_MONTHLY_CAP
    );
    // conditionGeneral previously never decreased at all, which made the general
    // check a pure money sink and the "< 40 %" fleet warning unreachable.
    const airframeDecay = fxAfter.wearFactor * Math.min(
      monthlyFlightHours * AIRFRAME_WEAR_PER_HOUR + IDLE_WEAR_PER_MONTH,
      GC_MONTHLY_CAP
    );

    // Passengers like an old aircraft less, whatever its condition: the
    // type's popularity from the catalogue, less what its age takes.
    // The development tree adds points to both the type's popularity and the
    // aircraft's efficiency, always counted from the catalogue so they never
    // add up on themselves.
    const spec = aircraftList.find(a => a.id === plane.id);
    const launchBonus = plane.launchBonusUntil !== undefined && nextOffset < plane.launchBonusUntil ? LAUNCH_BONUS : 0;
    const popularity = spec === undefined
      ? plane.popularity
      : boostedPopularity(agedPopularity(spec.popularity, ageYears(plane, nextOffset)) + launchBonus, fxAfter);
    const efficiency = spec === undefined ? plane.efficiency : boostedEfficiency(spec.efficiency, fxAfter);

    return {
      ...plane,
      popularity,
      efficiency,
      conditionInterior: Math.max(0, plane.conditionInterior - interiorDecay),
      conditionGeneral: Math.max(0, plane.conditionGeneral - airframeDecay)
    };
  }));
  if (deliveredPlanes.length > 0) setFleet(prev => [...prev, ...deliveredPlanes]);

  return commands;
}
