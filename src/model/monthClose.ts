/**
 * Monatsabschluss: SPEZIFIKATION 8.0–8.2, 8.15 und 8.16 (Pakete 3.8b, 3.8c). Setzt die Bausteine der Abschnitte 2–8
 * zu einem Zeitschritt zusammen.
 *
 * - `closeMonth(state, decisions)` ist eine **reine Funktion** (R12): Spielstand rein, Spielstand für X+1, Berichte
 *   und Log raus. Aller Zufall kommt aus `rng` mit dem `seed` des Spielstands (8.3).
 * - **Eine Rechnung für alle** (R1, E44, 7.8): Spieler und KI stehen gleichberechtigt in `companies`. Jede Gesellschaft
 *   unterscheidet sich nur durch ihre Eingaben (`CompanyInputs`; KI: die neutralen Werte aus `RIVAL_INPUTS`, 7.2).
 *   Diese Datei fragt nie „ist das eine KI?“ (Test 7.1).
 * - **KI-Entscheidungen** (Schritt 4, 7.8) kommen als Funktion `decisions` von außen: `rivalDecisions` in
 *   `rivalMonth.ts`, das diese Datei nicht kennt. So kann die Buchung nicht von ihnen abhängen; sie wirken ab X+1.
 * - **Umsteiger** (3.13) sind Angebote in derselben Marktaufteilung; danach kommen sie auf die freien Sitze.
 * - **Fortschritt** (6.7–6.11, 8.15) rechnet Schritt 6 nur für eine Gesellschaft mit `progress` (Spieler, 7.2).
 * - Der Spielstand enthält, was sich nur durch Einstellungen ändert (Kabine, Service-Auswahl, Interior score), als
 *   fertige Werte; alles, was sich mit Monat, Zustand, Ruf oder Markt ändert, rechnet der Abschluss (F41).
 */

import { atCost, difficultyCostFactor, difficultyFactor, yearOf } from './basics';
import { cabinRating } from './cabin';
import {
  CABIN_CLASSES,
  MINUTES_PER_WEEK,
  OWNER_TIER,
  RANK_AVERAGE_MONTHS,
  BANKRUPTCY_OVERDRAWN_MONTHS,
  REPORT_HISTORY_MONTHS,
  RIVAL_REPORT_MONTHS,
  SCENARIO_DOLLAR_METRICS,
  WEEKS_PER_MONTH,
  type AircraftClass,
  type CabinClass,
  type CampaignTier,
  type Difficulty,
  type FacilityKind,
  type ScenarioMetric,
  type WorldRegion,
} from './constants';
import {
  airportFeeFactor,
  aircraftEfficiency,
  cateringCost,
  checkInFee,
  costPerPassengerParts,
  crewCost,
  ffpCostPerPassenger,
  transferCostPerPassengerParts,
  fuelCost,
  fuelPrice,
  handlingFee,
  landingFee,
  payFactor,
  researchCostFactor,
  type EndFees,
  type LandingAircraft,
  type PassengerCostParts,
} from './costs';
import { airportUpkeep, ownerFeeIncome as ownerFeeIncomeOf, slotRent, type PerAircraftClass } from './airportCosts';
import {
  aircraftShare,
  campaignCost,
  ffpBaseCost,
  fixedWeeklyCostParts,
  monthlyCosts,
  monthlyResult,
  routeBlockHours,
  routePassengerCost,
  routeResult,
  slotShare,
  subsidyIncome,
  type FixedWeeklyCostParts,
  type MonthlyCosts,
} from './costTotals';
import {
  blockMinutes,
  classShares,
  distanceKm,
  eventDemandFactor,
  marketSizeParts,
  referenceBlockMinutes,
  worldScale,
  type CitySize,
  type Coords,
  type MarketSizeParts,
} from './demand';
import {
  marketFares,
  monthlyRevenue,
  routeFares,
  routeRevenue,
  transferRevenueShare,
  type ClassFigures,
  type PartialClassFigures,
  type TransferFlow,
} from './fare';
import {
  aircraftUpkeep,
  aircraftValue,
  ageDepreciation,
  fleetCommonalityFactors,
  fleetValueResultParts,
  newAircraftPrice,
  type FleetValueResultParts,
  type ValuedAircraft,
} from './fleet';
import {
  creditInterest,
  creditLimit,
  creditState,
  forcedSale,
  isBankrupt,
  isLaunchCustomer,
  nextOverdrawnMonths,
  preorderBalance,
  preorderDelivery,
  preorderUnitPrice,
  resoldInMarket,
  saleProceeds,
  type CreditState,
} from './fleetMarket';
import {
  activeCrisisResponseFactor,
  activeWorldEvents,
  birdStrikeCost,
  charterCost,
  companyCancelledShare,
  disruptionShares,
  flownHours,
  hedgedFuelTable,
  historicalEvent,
  moraleTarget,
  monthlyWear,
  nextMorale,
  rollBirdStrike,
  rollTransition,
  routeCauses,
  strikeCancelShare,
  wornCondition,
  type Disruption,
  type DisruptionShares,
  type StaffStrike,
  type WorldEvent,
} from './monthEvents';
import {
  advertisingFactor,
  advertisingRegionFactor,
  classPotential,
  directOffer,
  distributeToRoutes,
  frequentFlyerFactor,
  marketSplit,
  noFlyAppeal,
  offerAppeal,
  rampFactor,
} from './marketSplit';
import {
  advanceResearch,
  annualGoalOffers,
  chosenGoal,
  isDecember,
  milestonePrize,
  milestonePrizeTotal,
  newMilestones,
  nextProfitStreak,
  nextRank,
  rankStats,
  reputationChange,
  researchEffects,
  settleGoal,
  sizeClassOf,
  yearSnapshot,
  type AnnualGoal,
  type MilestoneContext,
  type RankStats,
  type ReputationChange,
  type ResearchState,
} from './progress';
import {
  airlineSatisfaction,
  connectionOfferSatisfaction,
  deskLoad as deskLoadOf,
  directOfferSatisfaction,
  flightTimeIndex,
  groundSidePoints,
  mealCount,
  satisfactionBreakdown,
  satisfactionFactor,
  serviceCapability,
  servicePoints,
  servicePointsParts,
  typeAppeal,
  type ClassSatisfactionBreakdown,
  type ClassSatisfactionInput,
  type Desks,
  type GroundParts,
  type GroundSide,
  type RouteSatisfactionInput,
  type ServiceCapability,
  type ServicePointsParts,
  type ServiceSelection,
} from './satisfaction';
import {
  allocateTransferSeats,
  connectionFactor,
  hubQuality,
  transferClasses,
  transferFare,
  transferOffer,
  type HubFacilities,
  type TransferDemand,
  type TransferOfferFigures,
} from './transfers';

// ===========================================================================
// Spielstand im Modell (8.3)
// ===========================================================================

/** Ein Flughafen, so weit der Abschluss ihn braucht (aus `src/data/airports.ts`; Region über `regionOf`, R15). */
export interface ModelAirport {
  readonly id: string;
  readonly coords: Coords;
  /** Stadtgrößen-Tabelle (`Airport.stats`). */
  readonly stats?: readonly number[] | null;
  /** Größe 1 … 7 (`Airport.level`). */
  readonly size: number;
  readonly region: WorldRegion;
  /** Größter ICAO-Code, den die Piste trägt (`Airport.maxIcaoCode`); fehlt = jede Größe. */
  readonly maxIcaoCode?: string;
}

/**
 * Ein Flugzeugtyp des Typen-Katalogs (Felder wie `src/data/aircraft.ts`); für Käufe, Modernisierung und Gründung der KI
 * (7.7, 7.9, 7.11) und den Gebrauchtmarkt (8.11).
 */
export interface CatalogType {
  readonly id: string;
  readonly family: string;
  /** Bauart der Daten: „Regional“, „Narrowbody“, „Widebody“ (zugleich Slot-Art, 5.10). */
  readonly class: string;
  readonly capacity: number;
  readonly cruiseSpeed: number;
  readonly efficiency: number;
  readonly popularity: number;
  /** Reichweite in km. */
  readonly maxRange: number;
  /** Listenpreis in $ von 1960. */
  readonly basePrice: number;
  /** ICAO-Code der Spannweite („A“ … „F“). */
  readonly icaoCode: string;
  readonly firstDeliveryOffset: number;
  readonly lastDeliveryOffset: number | null;
}

/** Eine Werbe-Kampagne. */
export interface Campaign {
  readonly tier: CampaignTier;
  /** Regionen; leer = weltweit (deckt jede Region ab). */
  readonly regions: readonly WorldRegion[];
  /** Letzter Monat, in dem sie läuft. */
  readonly endMonth: number;
}

/**
 * Was eine Gesellschaft von den anderen unterscheidet (7.1, 7.2). Die KI hat überall den neutralen Wert
 * (`RIVAL_INPUTS`); dazu `staffModel = false` und `forcedSale = false` (Notlage nach 7.15 statt Zwangsverkauf).
 */
export interface CompanyInputs {
  /** Ids der fertigen Forschungen (6.9). */
  readonly completedResearch: readonly string[];
  /** Lohn in % (8.7). */
  readonly salaryPct: number;
  /** Moral 0 … 100, vom Monatsanfang (2.6.4, 8.7). */
  readonly morale: number;
  readonly campaigns: readonly Campaign[];
  /** Laufmonate des Frequent-flyer-Programms, der laufende mitgezählt; 0 = läuft nicht (3.9.4). */
  readonly ffpMonthsRunning: number;
  /** Schwierigkeit (1.8, E53). */
  readonly difficulty: Difficulty;
  /** Unter dem Pech-Deckel (8.8). */
  readonly badLuckCap: boolean;
  /** Darf chartern (8.9); sonst gilt jede Störung als gestrichen. */
  readonly charter: boolean;
  /** Hat das Personal-Modell (Moral ändert sich, Streik wird gewürfelt, 8.7). Höchstens eine Gesellschaft. */
  readonly staffModel: boolean;
  /** Kreditlinie mit Zwangsverkauf und Spielende (8.14). */
  readonly forcedSale: boolean;
  /** Titel der Ereignisse mit gekaufter Preis-Absicherung (8.5). */
  readonly hedgedEvents: readonly string[];
  /** Titel der Ereignisse mit gekaufter Rückgewinnung (8.5). */
  readonly recoveryEvents: readonly string[];
  /** Letzter Personalstreik (8.7). */
  readonly staffStrike?: StaffStrike;
  /** Bekommt den Zuschuss (7.14, Zeile „Subsidy“); die KI, solange `RIVAL_SUBSIDY_ENABLED`. Fehlt = nein. */
  readonly subsidized?: boolean;
}

/** Ein Flugzeug: Typ-Werte aus `src/data/aircraft.ts`, Kabine und Zustand. */
export interface AircraftState extends ValuedAircraft {
  /** Eindeutig über alle Gesellschaften (Würfe je Flugzeug, 8.3). */
  readonly id: string;
  readonly typeId: string;
  /** Feld `family` (Flotten-Mischung, 5.12). */
  readonly family: string;
  readonly aircraftClass: AircraftClass;
  /** Höchstsitze des Typs (`capacity`). */
  readonly capacity: number;
  readonly cruiseSpeed: number;
  /** Effizienz des Typs vor Forschung. */
  readonly efficiency: number;
  /** `popularity` des Typs (2.2). */
  readonly catalogAppeal: number;
  readonly hasWifi: boolean;
  readonly hasPremiumGalley: boolean;
  /** Eingebaute Sitze je Klasse. */
  readonly seats: PartialClassFigures;
  /** `interiorScore` je Klasse mit Sitzen (2.3), fertig aus der Kabine. */
  readonly interiorScore: PartialClassFigures;
  /** Erstkunde (8.12). */
  readonly launchCustomer?: boolean;
}

/** Eine Strecke: Hin und Zurück zwischen `from` und `to`, ein Flugzeug. */
export interface RouteState {
  readonly id: string;
  readonly aircraftId: string;
  readonly from: string;
  readonly to: string;
  /** Abflüge je Woche, beide Richtungen zusammen (geplante Flugabschnitte), halb an jedem Ende. */
  readonly departuresPerWeek: number;
  /** Preisniveau je Klasse für diesen Monat (E56, R8). */
  readonly fareRatios?: PartialClassFigures;
  /** Im laufenden Monat eingestellte Preise; gelten ab X+1 (4.5). */
  readonly nextFareRatios?: PartialClassFigures;
  /** Laufmonate der Strecke (Anlauf 3.12, Bonus 3.9.6). */
  readonly ageMonths: number;
  /** Service-Auswahl je Klasse (2.5, 5.7). */
  readonly service: Readonly<Partial<Record<CabinClass, ServiceSelection>>>;
  /**
   * Fahrplan in Minuten der Woche (Montag 00:00 = 0): Abflüge in `from` und in `to`. Nur für Umsteige-Anschlüsse
   * (3.13, F18); ohne Fahrplan bildet die Strecke keine Verbindung (F42).
   */
  readonly schedule?: RouteSchedule;
}

/** Fahrplan einer Strecke (Minuten der Woche). */
export interface RouteSchedule {
  readonly fromDepartures: readonly number[];
  readonly toDepartures: readonly number[];
}

/** Was eine Gesellschaft an einem Flughafen hat (5.10, 5.11). */
export interface HoldingState {
  readonly managementTier: number;
  readonly slots: PerAircraftClass;
  readonly stands: PerAircraftClass;
  readonly desks: Desks;
  readonly facilities: readonly FacilityKind[];
}

/** Eine Vorbestellung (8.12): ganze Bestellung, ein Typ, eine Kabine. */
export interface PreorderState {
  readonly id: string;
  /** Das Flugzeug, wie es geliefert wird (ohne Kennung, Bau- und Einbaumonat, Zustand). */
  readonly plane: Omit<AircraftState, 'id' | 'builtMonth' | 'cabinInstalledMonth' | 'airframeCondition' | 'cabinCondition' | 'launchCustomer'>;
  readonly count: number;
  /** Gezahlte Anzahlung (Guthaben, 8.2). */
  readonly deposit: number;
  readonly deliveryMonth: number;
  readonly delays: number;
  /** Erstauslieferung des Typs (Erstkunde). */
  readonly firstDeliveryOffset: number;
}

/**
 * Einmalausgaben und -einnahmen des laufenden Monats (8.2): Sie verlassen die Kasse, wenn der Spieler sie tätigt, und
 * gehören in den Bericht dieses Monats. Der Übergang setzt die Zähler auf 0.
 */
export interface MonthLedger {
  /** Kasse am Monatsanfang. */
  readonly cashAtStart: number;
  /** Σ `aircraftValue` der Flotte am Monatsanfang (= Wert am Ende des Vormonats). */
  readonly fleetValueAtStart: number;
  /** Σ Anzahlungen am Monatsanfang. */
  readonly depositsAtStart: number;
  /** Wertänderung der Flotte durch Geschäfte (Kauf +Wert, Verkauf −Wert, Umbau und Überholung Wert nachher − vorher). */
  readonly tradeValueChange: number;
  readonly purchases: number;
  readonly refits: number;
  readonly overhauls: number;
  readonly saleProceeds: number;
  /** Gekaufte Krisen-Antworten (Posten „Crisis response“, 5.16). */
  readonly crisisResponses: number;
  /** Übrige Einmalausgaben nach Art (Slots netto, Stufen, Einrichtungen, Forschung, Anzahlungen …), nicht im Ergebnis. */
  readonly otherSpending: Readonly<Record<string, number>>;
}

/** Ein an den Markt verkauftes Flugzeug (8.11). */
export interface ResoldPlane extends AircraftState {
  readonly soldMonth: number;
}

/** Eine Gesellschaft (Spieler oder KI), gleich aufgebaut (E44). */
export interface CompanyState {
  readonly id: string;
  readonly cash: number;
  /** Ruf 0 … 100 vom Monatsanfang. */
  readonly reputation: number;
  readonly inputs: CompanyInputs;
  readonly aircraft: readonly AircraftState[];
  readonly routes: readonly RouteState[];
  /** Je Flughafen-Kennung. */
  readonly airports: Readonly<Record<string, HoldingState>>;
  readonly preorders: readonly PreorderState[];
  /** Überzogene Monate in Folge (8.14). */
  readonly overdrawnMonths: number;
  /** Gewinnserie (6.10, Moral 8.7). */
  readonly profitStreak: number;
  readonly ledger: MonthLedger;
  /** Berichte, ältester zuerst, höchstens `REPORT_HISTORY_MONTHS`, KI `RIVAL_REPORT_MONTHS` (8.2, `keptReports`). */
  readonly reports: readonly MonthReport[];
  /** Drehkreuze (Flughafen-Kennungen): Umsteige-Verbindungen (3.13). */
  readonly hubs?: readonly string[];
  /**
   * Fortschritt (Rang, Forschung, Meilensteine, Jahresziel, Szenario; 6.7–6.11, 8.15). Nur eine Gesellschaft mit
   * Fortschritts-Modell hat ihn (Spieler; KI nach 7.2 ohne). Der Abschluss rechnet Schritt 6 nur, wenn er da ist.
   */
  readonly progress?: CompanyProgress;
  /** Zustand der Entscheidungen (KI: Persönlichkeit, Stärke, Notlage …); der Abschluss liest ihn nicht. */
  readonly agent?: unknown;
}

/** Fortschritt einer Gesellschaft (6.7–6.11, 8.15). */
export interface CompanyProgress {
  /** Erster Spielmonat (Rang-Jahre, 6.7). */
  readonly startMonth: number;
  readonly rank: number;
  /** Rang-Werte je Monat, ältester zuerst, höchstens `RANK_AVERAGE_MONTHS` (6.7). */
  readonly rankHistory: readonly RankStats[];
  /** Forschung (6.9); `inputs.completedResearch` ist immer `research.done`. */
  readonly research: ResearchState;
  /** Erreichte Meilensteine (Ids, 6.10). */
  readonly milestones: readonly string[];
  /** Fluggäste seit Spielstart (Meilensteine). */
  readonly careerPax: number;
  /** Übernahmen (6.12, 7.16). */
  readonly takeovers: number;
  /** Laufendes Jahresziel (6.11). */
  readonly goal?: AnnualGoal;
  /** Angebot des letzten Dezembers; `goal` ist das gewählte (ohne Wahl das sichere). */
  readonly goalOffers?: readonly AnnualGoal[];
  /** Laufendes Szenario (8.15). */
  readonly scenario?: ScenarioState;
}

/** Ein Ziel eines Szenarios (8.15). */
export interface ScenarioTarget {
  readonly id: string;
  readonly metric: ScenarioMetric;
  /** Schwelle; bei Dollar-Zielen als Wert von 1960 (`SCENARIO_DOLLAR_METRICS`, E6). */
  readonly target: number;
  /** Zählt nur im Abschluss des Stichtags. */
  readonly atDeadline?: boolean;
  /** Nur `routes`: zählt Städtepaare mit mindestens so vielen Hin- und Rückflügen je Woche (`servedCityPairs`). */
  readonly minWeeklyFlights?: number;
}

/** Ein laufendes Szenario (8.15). */
export interface ScenarioState {
  readonly win: readonly ScenarioTarget[];
  /** Kasse unter der Untergrenze (`scenarioFloor`) an so vielen Monatsenden in Folge verliert (`capitalFloor`, E34, E77). */
  readonly floorMonths: number;
  /** Untergrenze als $ von 1960 (E6); fehlt = −`creditLimit` des Monatsendes (8.15, E77). */
  readonly floorThreshold?: number;
  /** Letzter Monat, dessen Abschluss zählt. */
  readonly deadline: number;
  readonly floorStreak: number;
  /** Erreichte Ziele (Ids, sortiert). */
  readonly met: readonly string[];
  readonly status: 'running' | 'won' | 'lost';
}

/** Der Spielstand, so weit das Modell ihn braucht (8.3). */
export interface ModelState {
  /** Der Monat X, der abgeschlossen wird. */
  readonly month: number;
  readonly seed: number;
  readonly airports: Readonly<Record<string, ModelAirport>>;
  /** Gewürfelte Zufallsereignisse (8.4). */
  readonly randomEvents: readonly WorldEvent[];
  /** Störungen für den Monat X (beim letzten Abschluss gewürfelt, 8.6). */
  readonly disruptions: readonly Disruption[];
  /** Einmaliges Pech im Monat X (8.8). */
  readonly badLuck: boolean;
  /** Weiterverkaufte Flugzeuge im Gebrauchtmarkt (8.11). */
  readonly resold: readonly ResoldPlane[];
  readonly companies: readonly CompanyState[];
  /** Typen-Katalog (Käufe der KI, 7.11); fehlt = keine Käufe. */
  readonly catalog?: readonly CatalogType[];
}

// ===========================================================================
// Schritt 2: Rechnen, alle Gesellschaften in EINER Marktaufteilung (R1)
// ===========================================================================

/** Zahlen einer Strecke im Monat, je Woche (beide Richtungen). */
export interface RouteFigures {
  readonly routeId: string;
  readonly aircraftId: string;
  readonly greatCircleKm: number;
  readonly blockMinutes: number;
  readonly plannedLegs: number;
  readonly shares: DisruptionShares;
  /** Sitze je Woche im Markt (× (1 − cancelledShare), 8.9). */
  readonly offeredSeats: ClassFigures;
  /** Satisfaction je Klasse mit Sitzen (2.7). */
  readonly satisfaction: PartialClassFigures;
  readonly fares: ClassFigures;
  /** Direktgäste je Woche (3.11). */
  readonly passengers: ClassFigures;
  /** Umsteiger je Woche auf dieser Strecke (3.13, nach den Direktgästen auf freien Sitzen). */
  readonly transferPassengers: ClassFigures;
  /** Erlös je Woche mit dem Anteil der Umsteiger (4.7, 4.8). */
  readonly revenue: number;
  readonly passengerCost: PassengerCostParts;
  /** `costPerPassenger` je Klasse mit Sitzen (5.8, Direktgast). */
  readonly costPerPassenger: PartialClassFigures;
  /** Feste Kosten mit den geflogenen Abschnitten (8.9). */
  readonly fixed: FixedWeeklyCostParts;
  /** `flightOpsCost` beim vollen Flugplan (für die Charter-Gebühr, 8.9). */
  readonly flightOpsFull: number;
  /** `routeResult` (5.9). */
  readonly result: number;
}

/** Eine Umsteige-Verbindung O–H–D einer Gesellschaft im Monat (3.13). */
export interface TransferFlowFigures {
  /** Drehkreuz H. */
  readonly hubId: string;
  /** Enden O und D (Reihenfolge wie im Paar-Schlüssel; die Verbindung gilt in beide Richtungen). */
  readonly origin: string;
  readonly destination: string;
  /** Umsteiger je Woche, beide Richtungen, alle Klassen, jede Reise einmal. */
  readonly passengers: number;
  /** Umsteiger dieser Verbindung je Strecke der beiden Teilstrecken (Summe = 2 × `passengers`). */
  readonly routes: Readonly<Record<string, number>>;
}

/** Was Schritt 2 für eine Gesellschaft ergibt (vor Lieferungen, Entscheidungen und Kreditlinie). */
export interface CompanyOperations {
  readonly companyId: string;
  readonly routes: readonly RouteFigures[];
  /** Monatserlös (4.9). */
  readonly revenue: number;
  /** Fluggäste im Monat, jede Teilstrecke gezählt (Umsteiger doppelt, wie `rankStats`, 6.7). */
  readonly passengers: number;
  /** Fluggäste je Woche, jede Teilstrecke gezählt (Rang, 6.7). */
  readonly weeklyPassengers: number;
  /** Umsteiger-Reisen im Monat (jede Reise einmal; Meilensteine, Szenario). */
  readonly transferPassengers: number;
  /** Umsteige-Verbindungen O–H–D mit Umsteigern, größte zuerst (Anzeige: Flughafen, Strecke, Chronik). */
  readonly transferFlows: readonly TransferFlowFigures[];
  /** Flugzeuge nach Verschleiß (8.10), gleiche Reihenfolge. */
  readonly aircraftAfterWear: readonly AircraftState[];
  /** Σ `aircraftValue` am Monatsende (Monat X + 1) nach Verschleiß. */
  readonly fleetValueEnd: number;
  /** Flugzeuge mit Vogelschlag im Monat X (8.6). */
  readonly birdStrikes: readonly string[];
  readonly airportUpkeep: readonly number[];
  readonly aircraftUpkeep: readonly number[];
  readonly campaigns: readonly number[];
  readonly ffpBase: number;
  readonly charter: number;
  readonly interest: number;
  readonly damages: number;
  readonly ownerFeeIncome: readonly number[];
  readonly airlineSatisfaction: number;
  readonly cancelledShare: number;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const byId = <T extends { readonly id: string }>(items: readonly T[]) => [...items].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
const zeroClasses = (): Record<CabinClass, number> => ({ economy: 0, premium: 0, business: 0, first: 0 });
const totalSeats = (seats: PartialClassFigures) => CABIN_CLASSES.reduce((s, c) => s + (seats[c] ?? 0), 0);

const EMPTY_HOLDING: HoldingState = { managementTier: 0, slots: {}, stands: {}, desks: { normal: 0, self: 0 }, facilities: [] };

/** Laufende Kampagnen im Monat. */
function runningCampaigns(inputs: CompanyInputs, month: number): Campaign[] {
  return inputs.campaigns.filter((c) => month <= c.endMonth);
}

/** Werbe-Faktor einer Region (3.9.5). */
function regionAdvertising(campaigns: readonly Campaign[], region: WorldRegion): number {
  const tiers = campaigns.filter((c) => c.regions.length === 0 || c.regions.includes(region)).map((c) => c.tier);
  return advertisingRegionFactor(tiers);
}

/** Vorbereitete Werte einer Strecke vor der Marktaufteilung. */
interface PreparedRoute {
  readonly company: CompanyState;
  readonly route: RouteState;
  readonly plane: AircraftState;
  readonly pair: string;
  readonly km: number;
  readonly minutes: number;
  readonly shares: DisruptionShares;
  readonly offeredSeats: ClassFigures;
  readonly satisfaction: PartialClassFigures;
  readonly fares: ClassFigures;
}

/** Eine Umsteige-Verbindung O–H–D einer Gesellschaft (3.13). */
interface TransferConnection {
  /** Eindeutig im Markt O–D: `<Gesellschaft>@<Drehkreuz>|<Paar>`. */
  readonly id: string;
  readonly company: CompanyState;
  readonly hubId: string;
  /** Paar O–D. */
  readonly pair: string;
  /** Paare der Teilstrecken O–H und H–D. */
  readonly legPairs: readonly [string, string];
  readonly kmOriginHub: number;
  readonly kmHubDestination: number;
  readonly kmOriginDestination: number;
  readonly figures: TransferOfferFigures;
  /** `offerSatisfaction` je Klasse der Verbindung (2.8). */
  readonly satisfaction: PartialClassFigures;
  readonly hub: HubFacilities;
  /** Alter des Angebots: das jüngere der beiden Teilstrecken-Angebote (Anlauf 3.12). */
  readonly ageMonths: number;
}

/**
 * Umsteige-Verbindungen aller Gesellschaften (3.13, F18, F42): je Drehkreuz H und Paar O–D aus zwei eigenen
 * Teilstrecken O–H und H–D, wenn die Gesellschaft O–D nicht direkt bedient. Anschlüsse aus den Fahrplänen der
 * Strecken; ohne Fahrplan keine Verbindung. Keine Verbindungen über Gesellschaften hinweg.
 */
function transferConnections(
  state: ModelState,
  companies: readonly CompanyState[],
  prepared: readonly PreparedRoute[],
  onlyPairs?: ReadonlySet<string>,
): TransferConnection[] {
  const result: TransferConnection[] = [];
  for (const company of companies) {
    const hubs = [...new Set(company.hubs ?? [])].sort();
    if (hubs.length === 0) continue;
    const own = prepared.filter((p) => p.company.id === company.id);
    const served = new Set(own.map((p) => p.pair));
    for (const H of hubs) {
      if (!state.airports[H]) continue;
      const atHub = own.filter((p) => p.route.from === H || p.route.to === H);
      const ends = [...new Set(atHub.map((p) => (p.route.from === H ? p.route.to : p.route.from)))].sort();
      const timing = (legs: readonly PreparedRoute[], far: string) => {
        const arrivals: number[] = [];
        const departures: number[] = [];
        for (const p of legs) {
          const schedule = p.route.schedule;
          if (!schedule) continue;
          const fromFar = p.route.from === far;
          for (const t of fromFar ? schedule.fromDepartures : schedule.toDepartures) arrivals.push((t + p.minutes) % MINUTES_PER_WEEK);
          departures.push(...(fromFar ? schedule.toDepartures : schedule.fromDepartures));
        }
        return { arrivals, departures };
      };
      const meanMinutes = (legs: readonly PreparedRoute[]) =>
        sum(legs.map((p) => p.minutes * p.route.departuresPerWeek)) / sum(legs.map((p) => p.route.departuresPerWeek));
      const seatsOf = (legs: readonly PreparedRoute[]) => {
        const seats = zeroClasses();
        for (const p of legs) for (const c of CABIN_CLASSES) seats[c] += p.offeredSeats[c];
        return seats;
      };
      const legSatisfaction = (legs: readonly PreparedRoute[], c: CabinClass) =>
        directOfferSatisfaction(
          legs
            .filter((p) => (p.plane.seats[c] ?? 0) > 0)
            .map((p) => ({ satisfaction: p.satisfaction[c] ?? 0, seatsPerWeek: (p.plane.seats[c] ?? 0) * p.route.departuresPerWeek })),
        ) as number;
      for (let i = 0; i < ends.length; i++) {
        for (let j = i + 1; j < ends.length; j++) {
          const O = ends[i];
          const D = ends[j];
          const pair = pairKey(O, D);
          if (served.has(pair)) continue;
          if (onlyPairs && !onlyPairs.has(pair)) continue;
          const legOH = atHub.filter((p) => p.pair === pairKey(O, H));
          const legHD = atHub.filter((p) => p.pair === pairKey(H, D));
          const oh = timing(legOH, O);
          const hd = timing(legHD, D);
          const minutesOH = meanMinutes(legOH);
          const minutesHD = meanMinutes(legHD);
          const kmOriginDestination = distanceKm(state.airports[O].coords, state.airports[D].coords);
          const figures = transferOffer({
            kmOriginHub: legOH[0].km,
            kmHubDestination: legHD[0].km,
            kmOriginDestination,
            blockMinutesOriginHub: minutesOH,
            blockMinutesHubDestination: minutesHD,
            outbound: { arrivals: oh.arrivals, departures: hd.departures },
            inbound: { arrivals: hd.arrivals, departures: oh.departures },
          });
          if (!figures) continue;
          const satisfaction: Partial<Record<CabinClass, number>> = {};
          for (const c of transferClasses(seatsOf(legOH), seatsOf(legHD))) {
            satisfaction[c] = connectionOfferSatisfaction([
              { offerSatisfaction: legSatisfaction(legOH, c), blockMinutes: minutesOH },
              { offerSatisfaction: legSatisfaction(legHD, c), blockMinutes: minutesHD },
            ]) as number;
          }
          if (Object.keys(satisfaction).length === 0) continue;
          const h = company.airports[H] ?? EMPTY_HOLDING;
          result.push({
            id: `${company.id}@${H}|${pair}`,
            company,
            hubId: H,
            pair,
            legPairs: [pairKey(O, H), pairKey(H, D)],
            kmOriginHub: legOH[0].km,
            kmHubDestination: legHD[0].km,
            kmOriginDestination,
            figures,
            satisfaction,
            hub: { level: h.managementTier, lounge: h.facilities.includes('vipLounge'), catering: h.facilities.includes('catering') },
            ageMonths: Math.min(Math.max(...legOH.map((p) => p.route.ageMonths)), Math.max(...legHD.map((p) => p.route.ageMonths))),
          });
        }
      }
    }
  }
  return result;
}

/** Prüft den Spielstand auf Fehler, die die Rechnung falsch machen würden. */
function checkState(state: ModelState): void {
  const companyIds = new Set<string>();
  const planeIds = new Set<string>();
  let staffModels = 0;
  for (const c of state.companies) {
    if (companyIds.has(c.id)) throw new Error(`closeMonth: Gesellschaft ${c.id} doppelt`);
    companyIds.add(c.id);
    if (c.inputs.staffModel) staffModels++;
    const own = new Set<string>();
    for (const p of c.aircraft) {
      if (planeIds.has(p.id)) throw new Error(`closeMonth: Flugzeug ${p.id} doppelt`);
      planeIds.add(p.id);
      own.add(p.id);
    }
    for (const r of c.routes) {
      if (!own.has(r.aircraftId)) throw new Error(`closeMonth: Strecke ${r.id} ohne Flugzeug`);
      if (!state.airports[r.from] || !state.airports[r.to]) throw new Error(`closeMonth: Strecke ${r.id} mit unbekanntem Flughafen`);
      if (r.from === r.to) throw new Error(`closeMonth: Strecke ${r.id} ohne zweites Ende`);
      if (!(r.departuresPerWeek > 0)) throw new Error(`closeMonth: Strecke ${r.id} ohne Abflüge`);
    }
  }
  if (staffModels > 1) throw new Error('closeMonth: höchstens eine Gesellschaft mit Personal-Modell');
}

/**
 * Schritt 2 des Abschlusses für **alle** Gesellschaften: Fluggäste aus einer Marktaufteilung je Paar und Klasse
 * (3.11, R1), Erlös (4), Kosten (5 und Abschnitt 8), Verschleiß (8.10), Wert am Monatsende (5.13), Ruf-Eingaben (6.2,
 * 2.9). Bucht nichts. Dieselbe Rechnung ist die Vorhersage des Monats (R2, 8.1): Planer und Streckenliste lesen sie.
 * Ohne Umsteiger (Paket 3.8c). SPEZIFIKATION 8.0, 8.1.
 */
export function monthOperations(state: ModelState): Readonly<Record<string, CompanyOperations>> {
  const { companies, figuresByCompany, landingAt, transferFlowsByCompany } = operationsCore(state, {});
  return companyOperations(state, companies, figuresByCompany, landingAt, transferFlowsByCompany);
}

/** Fluggäste je Woche eines Paars (O–D) aus der Rechnung des Abschlusses (3.11, 3.13). */
export interface PairPassengers {
  readonly pair: string;
  /** Direktgäste aller Gesellschaften. */
  readonly direct: number;
  /** Umsteiger, die die Marktaufteilung den Verbindungen gibt (vor der Sitz-Verteilung). */
  readonly transferWish: number;
  /** Umsteiger, die einen Sitz auf beiden Teilstrecken bekommen. */
  readonly transferPlaced: number;
}

/**
 * Fluggäste je Paar nach Art, für das Balance-Skript (3.13: Umsteiger in Märkten mit Direktangebot typisch unter
 * 25 %). Dieselbe Rechnung wie `monthOperations` (R2); nur Paare mit Direktangebot oder Umsteige-Verbindung.
 */
export function pairPassengers(state: ModelState): PairPassengers[] {
  const core = operationsCore(state, {});
  const byPair = new Map<string, { direct: number; transferWish: number; transferPlaced: number }>();
  const entry = (pair: string) => {
    let e = byPair.get(pair);
    if (!e) byPair.set(pair, (e = { direct: 0, transferWish: 0, transferPlaced: 0 }));
    return e;
  };
  for (const company of core.companies) {
    for (const r of company.routes) {
      const passengers = core.passengersByRoute.get(`${company.id}|${r.id}`);
      if (passengers) entry(pairKey(r.from, r.to)).direct += sum(CABIN_CLASSES.map((c) => passengers[c]));
    }
  }
  for (const t of core.transfers) {
    const e = entry(t.pair);
    e.transferWish += t.wish;
    e.transferPlaced += t.placed;
  }
  return [...byPair.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([pair, e]) => ({ pair, ...e }));
}

/**
 * Was `operationsCore` rechnet. Ohne Angabe alles (Abschluss). Die Planer-Rechnungen brauchen nur einen Teil; sie
 * rechnen genau die Märkte, von denen ihr Ergebnis abhängt, mit derselben Rechnung (R2) – das Ergebnis ist gleich,
 * nur schneller (Paket 3.9b, Rechenzeit der KI).
 */
interface OperationsScope {
  /** Nur die Direktgäste dieser Paare (`routeClassPassengersCurve`); keine Umsteiger-Verteilung, keine Kosten. */
  readonly directPairs?: ReadonlySet<string>;
  /**
   * Nur die Zahlen dieser einen Strecke (`plannerRouteFigures`). Gilt nur, wenn die Gesellschaft keine Drehkreuze hat
   * (Planer-Spielstand, keine Umsteiger): Dann hängen die Zahlen nur vom eigenen Paar und von den Strecken desselben
   * Flugzeugs (Blockstunden, 5.9) ab. Hat sie Drehkreuze, wird alles gerechnet.
   */
  readonly route?: { readonly companyId: string; readonly routeId: string };
}

/** Ergebnis von `operationsCore`. */
interface OperationsCore {
  readonly companies: readonly CompanyState[];
  /** Direktgäste je Strecke (`<Gesellschaft>|<Strecke>`). */
  readonly passengersByRoute: ReadonlyMap<string, Record<CabinClass, number>>;
  readonly figuresByCompany: ReadonlyMap<string, RouteFigures[]>;
  readonly landingAt: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** Umsteige-Verbindungen mit Umsteigern je Gesellschaft. */
  readonly transferFlowsByCompany: ReadonlyMap<string, readonly TransferFlowFigures[]>;
  /** Umsteige-Verbindungen mit Wunsch (Marktaufteilung) und platzierten Umsteigern je Klasse und Woche. */
  readonly transfers: readonly { readonly pair: string; readonly wish: number; readonly placed: number }[];
}

/** Vorbereitete Angebote für die Marktaufteilung (`marketContext`). */
interface MarketContext {
  readonly state: ModelState;
  readonly X: number;
  readonly world: CitySize;
  readonly events: ReturnType<typeof activeWorldEvents>;
  readonly companies: readonly CompanyState[];
  /** Gesellschaft und Strecke aus `OperationsScope.route`, wenn nur sie gerechnet wird. */
  readonly focusCompany?: CompanyState;
  readonly narrowRouteId?: string;
  /** Gebrauchte Paare; fehlt = alle. */
  readonly needed?: ReadonlySet<string>;
  readonly prepared: readonly PreparedRoute[];
  readonly connectionsList: readonly TransferConnection[];
  readonly preparedByPair: ReadonlyMap<string, PreparedRoute[]>;
  readonly connectionsByPair: ReadonlyMap<string, TransferConnection[]>;
}

/**
 * Eigene Einrichtungen einer Gesellschaft je Flughafen und Flugzeugklasse für den Boden-Teil (2.6.3): Lounge, Stände,
 * belegte Slots (Abflüge der Klasse, halb an jedem Ende) und Sitze aller eigenen Abflüge für die Schalter-Last.
 */
function groundSides(company: CompanyState): (airportId: string, cls: AircraftClass) => GroundSide {
  const planes = new Map(company.aircraft.map((p) => [p.id, p]));
  const departures = new Map<string, number>();
  const departingSeats = new Map<string, number>();
  for (const r of company.routes) {
    const p = planes.get(r.aircraftId) as AircraftState;
    for (const end of [r.from, r.to]) {
      const key = `${end}|${p.aircraftClass}`;
      departures.set(key, (departures.get(key) ?? 0) + r.departuresPerWeek / 2);
      departingSeats.set(end, (departingSeats.get(end) ?? 0) + (totalSeats(p.seats) * r.departuresPerWeek) / 2);
    }
  }
  return (airportId, cls) => {
    const h = company.airports[airportId] ?? EMPTY_HOLDING;
    return {
      lounge: h.facilities.includes('vipLounge'),
      stands: h.stands[cls] ?? 0,
      occupiedSlots: departures.get(`${airportId}|${cls}`) ?? 0,
      desks: h.desks,
      departingSeatsPerWeek: departingSeats.get(airportId) ?? 0,
    };
  };
}

/** Eingaben der Satisfaction einer Strecke (2.4–2.7), so wie Abschluss und Planer sie bauen (R2). */
interface RouteSatisfactionSetup {
  /** Catering-Einrichtung an mindestens einem Ende (2.5). */
  readonly cateringFacility: boolean;
  readonly capability: ServiceCapability;
  /** Service-Auswahl je Klasse mit Sitzen (leer, wenn die Strecke keine hat). */
  readonly selections: Partial<Record<CabinClass, ServiceSelection>>;
  /** Je Klasse mit Sitzen Cabin rating und Service points. */
  readonly classes: Partial<Record<CabinClass, ClassSatisfactionInput>>;
  readonly route: RouteSatisfactionInput;
}

const NO_SERVICE: ServiceSelection = { meals: [], extras: [], onboardService: [] };

/** Baut `RouteSatisfactionSetup` für eine Strecke im Monat `X`. */
function routeSatisfactionSetup(
  company: CompanyState,
  route: RouteState,
  plane: AircraftState,
  minutes: number,
  X: number,
  groundSide: (airportId: string, cls: AircraftClass) => GroundSide,
): RouteSatisfactionSetup {
  const holding = (id: string) => company.airports[id] ?? EMPTY_HOLDING;
  const appealValue = typeAppeal({ catalogAppeal: plane.catalogAppeal, builtMonth: plane.builtMonth, month: X, launchCustomer: plane.launchCustomer });
  const cateringFacility = holding(route.from).facilities.includes('catering') || holding(route.to).facilities.includes('catering');
  const capability = serviceCapability({
    aircraftClass: plane.aircraftClass,
    hasWifi: plane.hasWifi,
    hasPremiumGalley: plane.hasPremiumGalley,
    cateringFacility,
  });
  const selections: Partial<Record<CabinClass, ServiceSelection>> = {};
  const classes: Partial<Record<CabinClass, ClassSatisfactionInput>> = {};
  for (const c of CABIN_CLASSES) {
    if (!((plane.seats[c] ?? 0) > 0)) continue;
    const selection = route.service[c] ?? NO_SERVICE;
    selections[c] = selection;
    classes[c] = {
      cabinRating: cabinRating(appealValue, plane.interiorScore[c] ?? 0, plane.cabinCondition),
      servicePoints: servicePoints(selection, minutes, capability),
    };
  }
  return {
    cateringFacility,
    capability,
    selections,
    classes,
    route: {
      blockMinutes: minutes,
      origin: groundSide(route.from, plane.aircraftClass),
      destination: groundSide(route.to, plane.aircraftClass),
      morale: company.inputs.morale,
      completedResearch: company.inputs.completedResearch,
    },
  };
}

/** Satisfaction einer Klasse mit allen Teilen und dem, was der Planer daneben zeigt (Paket 4.5b). */
export interface ClassSatisfactionDetail {
  /** Alle Teile und die Satisfaction (2.7), dieselbe Zahl wie im Abschluss. */
  readonly breakdown: ClassSatisfactionBreakdown;
  /** Cabin rating der Klasse (2.4). */
  readonly cabinRating: number;
  /** Service points mit Aufschlüsselung (2.5): geliefert; erwartet steht in `breakdown.expectedServicePoints`. */
  readonly service: ServicePointsParts;
  /** Bodenteile je Ende vor Mittel und Bodengewicht (2.6.3): Lounge, Stände, Schalter-Art, Schalter-Last. */
  readonly originGround: GroundParts;
  readonly destinationGround: GroundParts;
  /** Verpflegung je Direktgast in $ des Monats (5.7), wie in `costPerPassenger`. */
  readonly cateringCost: number;
}

/** Satisfaction einer Strecke mit allen Teilen (2.4–2.7) und den Verpflegungskosten (5.7). */
export interface RouteSatisfactionDetail {
  readonly blockMinutes: number;
  readonly flightTimeIndex: number;
  /** Mahlzeiten, die auf dieser Flugzeit zählen (2.5). */
  readonly mealCount: number;
  readonly cateringFacility: boolean;
  /** Was an Bord möglich ist (Gerichte-Stufen, WLAN, Premium-Bordküche). */
  readonly capability: ServiceCapability;
  readonly origin: GroundSide;
  readonly destination: GroundSide;
  /** Preis einer Verpflegung in $ des Monats je $ von 1960 (Kostenindex × Forschung, 5.7). */
  readonly cateringPriceFactor: number;
  readonly classes: Readonly<Partial<Record<CabinClass, ClassSatisfactionDetail>>>;
}

/**
 * Satisfaction einer Strecke mit allen Teilen, aus denselben Eingaben wie der Abschluss (`marketContext`, R2): Planer
 * Schritt 3 und das Kabinen-Fenster lesen nur diese Funktion (2.7, E44). Störungen ändern die Satisfaction nicht.
 * SPEZIFIKATION 2.4–2.7, 5.7.
 */
export function routeSatisfactionDetail(state: ModelState, companyId: string, routeId: string): RouteSatisfactionDetail {
  const company = state.companies.find((c) => c.id === companyId);
  const route = company?.routes.find((r) => r.id === routeId);
  if (!company || !route) throw new Error(`Satisfaction: Strecke ${companyId}/${routeId} fehlt`);
  const plane = company.aircraft.find((p) => p.id === route.aircraftId);
  if (!plane) throw new Error(`Satisfaction: Flugzeug ${route.aircraftId} fehlt`);
  const X = state.month;
  const minutes = blockMinutes(distanceKm(state.airports[route.from].coords, state.airports[route.to].coords), plane.cruiseSpeed);
  const setup = routeSatisfactionSetup(company, route, plane, minutes, X, groundSides(company));
  const breakdown = satisfactionBreakdown(setup.classes, setup.route);
  const research = company.inputs.completedResearch;
  const classes: Partial<Record<CabinClass, ClassSatisfactionDetail>> = {};
  for (const c of CABIN_CLASSES) {
    const b = breakdown[c];
    const input = setup.classes[c];
    const selection = setup.selections[c];
    if (!b || !input || !selection) continue;
    classes[c] = {
      breakdown: b,
      cabinRating: input.cabinRating,
      service: servicePointsParts(selection, minutes, setup.capability),
      originGround: groundSidePoints(c, setup.route.origin),
      destinationGround: groundSidePoints(c, setup.route.destination),
      cateringCost: cateringCost(selection, minutes, setup.capability, X, research),
    };
  }
  const fti = flightTimeIndex(minutes);
  return {
    blockMinutes: minutes,
    flightTimeIndex: fti,
    mealCount: mealCount(fti),
    cateringFacility: setup.cateringFacility,
    capability: setup.capability,
    origin: setup.route.origin,
    destination: setup.route.destination,
    cateringPriceFactor: atCost(1, X) * researchCostFactor('catering', research),
    classes,
  };
}

/**
 * Vorbereitung von Schritt 2 (siehe `monthOperations`): Strecken und Umsteige-Verbindungen. Mit `scope` nur der Teil,
 * den die Planer-Rechnung braucht: Eine Strecke wird nur vorbereitet, wenn ihr Paar gebraucht wird, sie als
 * Teilstrecke einer Umsteige-Verbindung in einem gebrauchten Paar dienen kann oder (bei `scope.route`) dasselbe
 * Flugzeug fliegt. Jede Marktaufteilung läuft genau wie im Abschluss.
 */
function marketContext(state: ModelState, scope: OperationsScope): MarketContext {
  checkState(state);
  const X = state.month;
  const world = worldScale(X);
  const events = activeWorldEvents(X, state.randomEvents);
  const companies = byId(state.companies);
  const scoped = scope.route ? companies.find((c) => c.id === scope.route?.companyId) : undefined;
  const focusCompany = scoped && (scoped.hubs ?? []).length === 0 ? scoped : undefined;
  const narrowRoute = focusCompany?.routes.find((r) => r.id === scope.route?.routeId);
  if (focusCompany && !narrowRoute) throw new Error(`monthOperations: Strecke ${scope.route?.companyId}/${scope.route?.routeId} fehlt`);
  const needed: ReadonlySet<string> | undefined =
    scope.directPairs ?? (narrowRoute ? new Set([pairKey(narrowRoute.from, narrowRoute.to)]) : undefined);
  const neededEnds = new Set([...(needed ?? [])].flatMap((pair) => pair.split('|')));
  /** Wird die Strecke gebraucht? Paar gebraucht, Teilstrecke an einem eigenen Drehkreuz zu einem gebrauchten Ende, oder dasselbe Flugzeug. */
  const wanted = (company: CompanyState, route: RouteState): boolean => {
    if (!needed) return true;
    if (needed.has(pairKey(route.from, route.to))) return true;
    if (narrowRoute && company === focusCompany && route.aircraftId === narrowRoute.aircraftId) return true;
    const hubs = company.hubs ?? [];
    return (hubs.includes(route.from) && neededEnds.has(route.to)) || (hubs.includes(route.to) && neededEnds.has(route.from));
  };

  // --- Vorbereitung je Gesellschaft und Strecke: Störungen, Sitze, Satisfaction, Preise.
  const prepared: PreparedRoute[] = [];
  for (const company of companies) {
    const { inputs } = company;
    const planes = new Map(company.aircraft.map((p) => [p.id, p]));
    const groundSide = groundSides(company);
    const strikeShare = strikeCancelShare(inputs.staffStrike, X);
    const disruptions = state.disruptions.map((d) => ({ ...d, charter: d.charter === true && inputs.charter }));

    for (const route of company.routes) {
      if (!wanted(company, route)) continue;
      const plane = planes.get(route.aircraftId) as AircraftState;
      const A = state.airports[route.from];
      const B = state.airports[route.to];
      const km = distanceKm(A.coords, B.coords);
      const minutes = blockMinutes(km, plane.cruiseSpeed);
      const shares = disruptionShares(
        routeCauses({ planeId: plane.id, airportIds: [A.id, B.id], regions: [A.region, B.region] }, disruptions, strikeShare),
      );
      const offeredSeats = zeroClasses();
      for (const c of CABIN_CLASSES) offeredSeats[c] = (plane.seats[c] ?? 0) * route.departuresPerWeek * (1 - shares.cancelledShare);

      const setup = routeSatisfactionSetup(company, route, plane, minutes, X, groundSide);
      const breakdown = satisfactionBreakdown(setup.classes, setup.route);
      const sat: Partial<Record<CabinClass, number>> = {};
      for (const c of CABIN_CLASSES) {
        const b = breakdown[c];
        if (b) sat[c] = b.satisfaction;
      }
      prepared.push({
        company,
        route,
        plane,
        pair: pairKey(A.id, B.id),
        km,
        minutes,
        shares,
        offeredSeats,
        satisfaction: sat,
        fares: routeFares(route.fareRatios, marketFares(km, X)),
      });
    }
  }

  // --- Umsteige-Verbindungen (3.13): je Gesellschaft, Drehkreuz und Paar O–D, das sie nicht direkt bedient.
  const connectionsList = transferConnections(state, companies, prepared, needed);
  const preparedByPair = new Map<string, PreparedRoute[]>();
  for (const p of prepared) {
    const list = preparedByPair.get(p.pair);
    if (list) list.push(p);
    else preparedByPair.set(p.pair, [p]);
  }
  const connectionsByPair = new Map<string, TransferConnection[]>();
  for (const t of connectionsList) {
    const list = connectionsByPair.get(t.pair);
    if (list) list.push(t);
    else connectionsByPair.set(t.pair, [t]);
  }
  return { state, X, world, events, companies, focusCompany, narrowRouteId: narrowRoute?.id, needed, prepared, connectionsList, preparedByPair, connectionsByPair };
}

/** Werte eines Paars, die nicht von den Angeboten abhängen: Marktpreise, Bezugs-Flugzeit, Marktgröße, Klassen-Anteile. */
interface PairBasics {
  readonly A: ModelAirport;
  readonly B: ModelAirport;
  readonly mf: ClassFigures;
  readonly reference: number;
  readonly size: ReturnType<typeof marketSizeParts>;
  readonly share: ReturnType<typeof classShares>;
}

/** `PairBasics` eines Paars im Monat des Spielstands. */
function pairBasics(context: MarketContext, pair: string): PairBasics {
  const [idA, idB] = pair.split('|');
  return pairBasicsAt(context.state, idA, idB, context.world, context.events);
}

function pairBasicsAt(
  state: ModelState,
  idA: string,
  idB: string,
  world: CitySize,
  events: ReturnType<typeof activeWorldEvents>,
): PairBasics {
  const X = state.month;
  const A = state.airports[idA];
  const B = state.airports[idB];
  if (!A || !B) throw new Error(`pairMarket: Flughafen ${A ? idB : idA} fehlt`);
  const mf = marketFares(distanceKm(A.coords, B.coords), X);
  const reference = referenceBlockMinutes(A.coords, B.coords);
  const size = marketSizeParts({ a: A, b: B, month: X, world, eventFactor: eventDemandFactor(events, A.region, B.region) });
  return { A, B, mf, reference, size, share: classShares(size.businessShare, reference) };
}

/** Markt eines Städtepaars im Monat des Spielstands, unabhängig von den Angeboten (3.3–3.7, 4.3). */
export interface PairMarket {
  /** Großkreis-Entfernung in km. */
  readonly km: number;
  /** Marktgröße mit allen Teilen (3.6); `size.marketSize` = Fluggäste je Woche, beide Richtungen. */
  readonly size: MarketSizeParts;
  /** Klassen-Anteile (3.7), Summe 1. */
  readonly share: ClassFigures;
  /** Fluggäste je Woche und Klasse beim Bezugsangebot: `marketSize × classShare` (3.6, 3.10). */
  readonly passengers: ClassFigures;
  /** Marktpreise in $ des Monats (4.3). */
  readonly fares: ClassFigures;
}

/**
 * Markt eines Städtepaars, genau wie der Abschluss ihn rechnet (dieselbe Funktion wie in `monthOperations`, R2):
 * Marktgröße mit Weltgröße und laufenden Ereignissen des Monats, Klassen-Anteile, Marktpreise. Für die Anzeige
 * „Market size“ im Planer (Paket 4.7c). Hängt nicht von Flugzeug, Gesellschaft, Preis oder Schwierigkeit ab (3.6).
 */
export function pairMarket(state: ModelState, idA: string, idB: string): PairMarket {
  const X = state.month;
  const basics = pairBasicsAt(state, idA, idB, worldScale(X), activeWorldEvents(X, state.randomEvents));
  const passengers = {} as Record<CabinClass, number>;
  for (const c of CABIN_CLASSES) passengers[c] = basics.size.marketSize * basics.share[c];
  return {
    km: distanceKm(basics.A.coords, basics.B.coords),
    size: basics.size,
    share: basics.share,
    passengers,
    fares: basics.mf,
  };
}

/**
 * Eine Marktaufteilung je Klasse auf einem Paar (3.11, R1): alle Direktangebote und Umsteige-Verbindungen. Schreibt die
 * Direktgäste je Strecke in `passengersByRoute` und den Umsteiger-Wunsch je Verbindung in `transferWish`.
 */
function splitPair(
  context: MarketContext,
  pair: string,
  onPair: readonly PreparedRoute[],
  viaHub: readonly TransferConnection[],
  classes: readonly CabinClass[],
  passengersByRoute: Map<string, Record<CabinClass, number>>,
  transferWish: Map<string, Record<CabinClass, number>>,
  basics: PairBasics = pairBasics(context, pair),
): void {
  const { X } = context;
  const { A, B, mf, reference, size, share } = basics;
  for (const p of onPair) passengersByRoute.set(routeKey(p), zeroClasses());

  const offerIds = [...new Set(onPair.map((p) => p.company.id))].sort();
  for (const c of classes) {
    const offers = [];
    for (const companyId of offerIds) {
      const own = onPair.filter((p) => p.company.id === companyId);
      const seats = sum(own.map((p) => p.offeredSeats[c]));
      if (!(seats > 0)) continue;
      const company = own[0].company;
      const offer = directOffer(
        own.map((p) => ({
          id: p.route.id,
          seatsPerFlight: p.plane.seats,
          departuresPerWeek: p.route.departuresPerWeek,
          fare: p.fares,
          blockMinutes: p.minutes,
        })),
        mf,
      );
      const offerSat = directOfferSatisfaction(
        own.map((p) => ({ satisfaction: p.satisfaction[c] ?? 0, seatsPerWeek: (p.plane.seats[c] ?? 0) * p.route.departuresPerWeek })),
      ) as number;
      const eff = researchEffects(company.inputs.completedResearch);
      const campaigns = runningCampaigns(company.inputs, X);
      const ageMonths = Math.max(...own.map((p) => p.route.ageMonths));
      const appeal = offerAppeal(c, {
        frequency: offer.frequency,
        fare: offer.fare[c],
        marketFare: mf[c],
        satisfactionFactor: satisfactionFactor(offerSat),
        blockMinutes: offer.blockMinutes,
        referenceBlockMinutes: reference,
        reputation: company.reputation,
        ageMonths,
        advertisingFactor: advertisingFactor(regionAdvertising(campaigns, A.region), regionAdvertising(campaigns, B.region)),
        frequentFlyerFactor: frequentFlyerFactor(company.inputs.ffpMonthsRunning),
        researchDemandFactor: eff.demandFactor,
        crisisResponseFactor: activeCrisisResponseFactor(company.inputs.recoveryEvents.map(historicalEvent), X),
        difficultyFactor: difficultyFactor(company.inputs.difficulty),
      });
      offers.push({ id: companyId, appeal, seats, ramp: rampFactor(ageMonths, eff.rampBonus) });
    }
    for (const t of viaHub) {
      const sat = t.satisfaction[c];
      if (sat === undefined) continue;
      const { company } = t;
      const eff = researchEffects(company.inputs.completedResearch);
      const campaigns = runningCampaigns(company.inputs, X);
      const appeal = offerAppeal(c, {
        frequency: t.figures.frequency,
        fare: transferFare(mf[c]),
        marketFare: mf[c],
        satisfactionFactor: satisfactionFactor(sat),
        blockMinutes: t.figures.blockMinutes,
        referenceBlockMinutes: reference,
        reputation: company.reputation,
        ageMonths: t.ageMonths,
        advertisingFactor: advertisingFactor(regionAdvertising(campaigns, A.region), regionAdvertising(campaigns, B.region)),
        frequentFlyerFactor: frequentFlyerFactor(company.inputs.ffpMonthsRunning),
        researchDemandFactor: eff.demandFactor,
        crisisResponseFactor: activeCrisisResponseFactor(company.inputs.recoveryEvents.map(historicalEvent), X),
        difficultyFactor: difficultyFactor(company.inputs.difficulty),
        connectionFactor: connectionFactor(hubQuality(t.hub, eff.hubQualityFactor)),
      });
      // Umsteiger sind im Markt nicht durch Sitze begrenzt; die Sitze verteilt `allocateTransferSeats` danach.
      offers.push({ id: t.id, appeal, seats: Infinity, ramp: rampFactor(t.ageMonths, eff.rampBonus) });
    }
    if (offers.length === 0) continue;
    const split = marketSplit({ potential: classPotential(c, size.marketSize, share[c]), noFlyAppeal: noFlyAppeal(c), offers });
    for (const companyId of offerIds) {
      const own = onPair.filter((p) => p.company.id === companyId);
      const seatsByRoute: Record<string, number> = {};
      for (const p of own) seatsByRoute[p.route.id] = p.offeredSeats[c];
      const perRoute = distributeToRoutes(split.passengers[companyId] ?? 0, seatsByRoute);
      for (const p of own) (passengersByRoute.get(routeKey(p)) as Record<CabinClass, number>)[c] = perRoute[p.route.id];
    }
    for (const t of viaHub) {
      const wish = transferWish.get(t.id) ?? zeroClasses();
      wish[c] = split.passengers[t.id] ?? 0;
      transferWish.set(t.id, wish);
    }
  }
}

/** Schlüssel einer Strecke in den Ergebnis-Tabellen: `<Gesellschaft>|<Strecke>`. */
const routeKey = (p: PreparedRoute) => `${p.company.id}|${p.route.id}`;

/** Schritt 2 bis zu den Strecken-Zahlen; siehe `monthOperations` und `marketContext`. */
function operationsCore(state: ModelState, scope: OperationsScope): OperationsCore {
  const context = marketContext(state, scope);
  const { X, companies, focusCompany, narrowRouteId, needed, prepared, connectionsList, preparedByPair, connectionsByPair } = context;

  // --- Eine Marktaufteilung je Paar und Klasse für alle Angebote (R1), direkt und mit Umstieg.
  const passengersByRoute = new Map<string, Record<CabinClass, number>>();
  const transferWish = new Map<string, Record<CabinClass, number>>();
  const pairs = [...new Set([...prepared.map((p) => p.pair), ...connectionsList.map((t) => t.pair)])].filter((pair) => !needed || needed.has(pair)).sort();
  for (const pair of pairs) {
    splitPair(context, pair, preparedByPair.get(pair) ?? [], connectionsByPair.get(pair) ?? [], CABIN_CLASSES, passengersByRoute, transferWish);
  }

  const emptyMaps = { landingAt: new Map(), transferFlowsByCompany: new Map(), figuresByCompany: new Map(), transfers: [] };
  if (scope.directPairs) return { companies, passengersByRoute, ...emptyMaps };
  // Mit Fokus: Umsteiger und Kosten nur für die Fokus-Gesellschaft. Ihre Sitze teilt sie mit niemandem (Schlüssel je
  // Gesellschaft), daher hängt ihre Verteilung nicht von den Umsteigern der anderen ab.
  const costCompanies = focusCompany ? [focusCompany] : companies;
  const ownConnections = focusCompany ? connectionsList.filter((t) => t.company.id === focusCompany.id) : connectionsList;

  // --- Umsteiger auf die freien Sitze beider Teilstrecken (3.13), höchster Tarif zuerst.
  const legKey = (companyId: string, pair: string, c: CabinClass) => `${companyId}|${pair}|${c}`;
  const freeSeats: Record<string, number> = {};
  for (const p of prepared) {
    if (focusCompany && p.company.id !== focusCompany.id) continue;
    const direct = passengersByRoute.get(routeKey(p)) as Record<CabinClass, number>;
    for (const c of CABIN_CLASSES) {
      const key = legKey(p.company.id, p.pair, c);
      freeSeats[key] = (freeSeats[key] ?? 0) + Math.max(0, p.offeredSeats[c] - direct[c]);
    }
  }
  const demands: TransferDemand[] = [];
  for (const t of ownConnections) {
    const wish = transferWish.get(t.id);
    if (!wish) continue;
    const fares = marketFares(t.kmOriginDestination, X);
    for (const c of CABIN_CLASSES) {
      if (!(wish[c] > 0)) continue;
      demands.push({
        id: `${t.id}|${c}`,
        legs: [legKey(t.company.id, t.legPairs[0], c), legKey(t.company.id, t.legPairs[1], c)],
        passengers: wish[c],
        fare: transferFare(fares[c]),
      });
    }
  }
  const allocation = allocateTransferSeats(demands, freeSeats);
  const transfers = ownConnections.map((t) => {
    const wish = transferWish.get(t.id);
    return {
      pair: t.pair,
      wish: wish ? sum(CABIN_CLASSES.map((c) => wish[c])) : 0,
      placed: sum(CABIN_CLASSES.map((c) => allocation.placed[`${t.id}|${c}`] ?? 0)),
    };
  });
  // Je Strecke: Umsteiger-Flüsse (4.8) und Kosten je Umsteiger (5.8); verteilt nach freien Sitzen der Strecke.
  const transferFlowsByRoute = new Map<string, { flow: TransferFlow; hubId: string }[]>();
  // Je Gesellschaft: Umsteige-Verbindungen mit Umsteigern und ihrer Verteilung auf die Strecken (Anzeige, Chronik).
  const transferFlowsByCompany = new Map<string, TransferFlowFigures[]>();
  for (const t of ownConnections) {
    const kmLegs = [t.kmOriginHub, t.kmHubDestination];
    const [origin, destination] = t.pair.split('|');
    const flowFigures = { hubId: t.hubId, origin, destination, passengers: 0, routes: {} as Record<string, number> };
    for (const c of CABIN_CLASSES) {
      const placed = allocation.placed[`${t.id}|${c}`] ?? 0;
      if (!(placed > 0)) continue;
      flowFigures.passengers += placed;
      const fare = transferFare(marketFares(t.kmOriginDestination, X)[c]);
      const shares = transferRevenueShare(fare, marketFares(kmLegs[0], X)[c], marketFares(kmLegs[1], X)[c]);
      t.legPairs.forEach((legPair, leg) => {
        const routesOnLeg = (preparedByPair.get(legPair) ?? []).filter((p) => p.company.id === t.company.id);
        const free: Record<string, number> = {};
        for (const p of routesOnLeg) {
          const direct = (passengersByRoute.get(routeKey(p)) as Record<CabinClass, number>)[c];
          free[routeKey(p)] = Math.max(0, p.offeredSeats[c] - direct);
        }
        const perRoute = distributeToRoutes(placed, free);
        for (const p of routesOnLeg) {
          const n = perRoute[routeKey(p)];
          if (!(n > 0)) continue;
          const list = transferFlowsByRoute.get(routeKey(p)) ?? [];
          list.push({ flow: { cabinClass: c, passengers: n, revenuePerPassenger: leg === 0 ? shares.originHub : shares.hubDestination }, hubId: t.hubId });
          transferFlowsByRoute.set(routeKey(p), list);
          flowFigures.routes[p.route.id] = (flowFigures.routes[p.route.id] ?? 0) + n;
        }
      });
    }
    if (flowFigures.passengers > 0) {
      const list = transferFlowsByCompany.get(t.company.id) ?? [];
      list.push(flowFigures);
      transferFlowsByCompany.set(t.company.id, list);
    }
  }

  // --- Landegebühren je Flughafen und Gesellschaft (für die Einnahmen der Stufe 3, 5.15).
  const landingAt = new Map<string, Map<string, number>>();
  const addLanding = (airportId: string, companyId: string, fee: number) => {
    const at = landingAt.get(airportId) ?? new Map<string, number>();
    at.set(companyId, (at.get(companyId) ?? 0) + fee);
    landingAt.set(airportId, at);
  };

  // --- Kosten, Erlös und Ergebnis je Strecke.
  const figuresByCompany = new Map<string, RouteFigures[]>();
  for (const company of costCompanies) {
    const { inputs } = company;
    const research = inputs.completedResearch;
    const holding = (id: string) => company.airports[id] ?? EMPTY_HOLDING;
    const feeFactor = (id: string) => airportFeeFactor(holding(id).managementTier, research);
    // Schwierigkeit auf die Betriebskosten (E87): Flugbetrieb und Kosten je Fluggast; KI immer 1 (Normal).
    const costF = difficultyCostFactor(inputs.difficulty);
    const fuel$ = fuelPrice(X, research, hedgedFuelTable(inputs.hedgedEvents.map(historicalEvent), X)) * costF;
    const pay = payFactor(inputs.salaryPct) * costF;
    const ffpActive = inputs.ffpMonthsRunning > 0;
    const commonality = fleetCommonalityFactors(company.aircraft);
    const own = prepared.filter((p) => p.company.id === company.id);
    const hoursOfPlane = new Map<string, number>();
    for (const p of own) hoursOfPlane.set(p.plane.id, (hoursOfPlane.get(p.plane.id) ?? 0) + routeBlockHours(p.minutes, p.route.departuresPerWeek));

    const list: RouteFigures[] = [];
    for (const p of own) {
      if (narrowRouteId !== undefined && p.route.id !== narrowRouteId) continue;
      const { route, plane } = p;
      const A = state.airports[route.from];
      const B = state.airports[route.to];
      const L = route.departuresPerWeek;
      const legs = L * p.shares.flownShare;
      const efficiency = aircraftEfficiency(plane.efficiency, research);
      const landingPlane: LandingAircraft = { aircraftClass: plane.aircraftClass, capacity: plane.capacity, cruiseSpeed: plane.cruiseSpeed };
      const landingA = landingFee(landingPlane, A.size, X, feeFactor(A.id)) * costF;
      const landingB = landingFee(landingPlane, B.size, X, feeFactor(B.id)) * costF;
      const ops = (n: number) => ({
        fuel: fuelCost({ efficiency, capacity: plane.capacity, greatCircleKm: p.km, flownLegs: n, fuelPrice: fuel$ }),
        crew: crewCost({ seats: plane.seats, blockMinutes: p.minutes, flownLegs: n, month: X, payFactor: pay, completedResearch: research }),
        landing: (landingA + landingB) * (n / 2),
      });
      const flown = ops(legs);
      const full = ops(L);
      addLanding(A.id, company.id, (landingA * legs) / 2);
      addLanding(B.id, company.id, (landingB * legs) / 2);

      const index = company.aircraft.findIndex((a) => a.id === plane.id);
      const upkeep = aircraftUpkeep({ listPrice1960: plane.listPrice1960, builtMonth: plane.builtMonth, month: X, commonalityFactor: commonality[index], parked: false, completedResearch: research });
      const fixed = fixedWeeklyCostParts({
        ...flown,
        slotShare: slotShare([
          { departures: L / 2, slotRent: slotRent(plane.aircraftClass, X, feeFactor(A.id)) },
          { departures: L / 2, slotRent: slotRent(plane.aircraftClass, X, feeFactor(B.id)) },
        ]),
        aircraftShare: aircraftShare({
          monthlyUpkeep: upkeep,
          monthlyAgeDepreciation: ageDepreciation(plane, X),
          routeBlockHours: routeBlockHours(p.minutes, L),
          aircraftBlockHours: hoursOfPlane.get(plane.id) as number,
        }),
      });

      const end = (id: string, size: number): EndFees => ({ checkInFee: checkInFee(X, feeFactor(id)) * costF, handlingFee: handlingFee(size, X, feeFactor(id)) * costF, departureShare: 0.5 });
      const ends: [EndFees, EndFees] = [end(A.id, A.size), end(B.id, B.size)];
      const cateringFacility = holding(A.id).facilities.includes('catering') || holding(B.id).facilities.includes('catering');
      const capability = serviceCapability({ aircraftClass: plane.aircraftClass, hasWifi: plane.hasWifi, hasPremiumGalley: plane.hasPremiumGalley, cateringFacility });
      const passengers = passengersByRoute.get(routeKey(p)) as Record<CabinClass, number>;
      const direct: Partial<Record<CabinClass, { passengers: number; cost: PassengerCostParts }>> = {};
      const costPerPassenger: Partial<Record<CabinClass, number>> = {};
      for (const c of CABIN_CLASSES) {
        if (!((plane.seats[c] ?? 0) > 0)) continue;
        const selection = route.service[c] ?? { meals: [], extras: [], onboardService: [] };
        const cost = costPerPassengerParts({
          cateringCost: cateringCost(selection, p.minutes, capability, X, research) * costF,
          ends,
          ffpCostPerPassenger: ffpCostPerPassenger(ffpActive, X) * costF,
        });
        costPerPassenger[c] = cost.total;
        if (passengers[c] > 0) direct[c] = { passengers: passengers[c], cost };
      }
      const flows = transferFlowsByRoute.get(routeKey(p)) ?? [];
      const transferPassengers = zeroClasses();
      const transfer: Partial<Record<CabinClass, { passengers: number; cost: PassengerCostParts }>> = {};
      for (const { flow, hubId } of flows) {
        const c = flow.cabinClass;
        transferPassengers[c] += flow.passengers;
        const selection = route.service[c] ?? { meals: [], extras: [], onboardService: [] };
        const outerIndex = A.id === hubId ? 1 : 0;
        const cost = transferCostPerPassengerParts({
          cateringCost: cateringCost(selection, p.minutes, capability, X, research) * costF,
          outer: ends[outerIndex],
          hub: ends[1 - outerIndex],
          ffpCostPerPassenger: ffpCostPerPassenger(ffpActive, X) * costF,
        });
        // Mittlerer Kostensatz je Klasse (eine Strecke kann an beiden Enden Drehkreuz sein).
        const before = transfer[c];
        const n0 = before?.passengers ?? 0;
        const n = n0 + flow.passengers;
        const mix = (k: 'catering' | 'fees' | 'ffp') => ((before?.cost[k] ?? 0) * n0 + cost[k] * flow.passengers) / n;
        const catering = mix('catering');
        const fees = mix('fees');
        const ffp = mix('ffp');
        transfer[c] = { passengers: n, cost: { catering, fees, ffp, total: catering + fees + ffp } };
      }
      const passengerCost = routePassengerCost(direct, transfer);
      const revenue = routeRevenue({ directPassengers: passengers, fares: p.fares, transfers: flows.map((f) => f.flow) });
      list.push({
        routeId: route.id,
        aircraftId: plane.id,
        greatCircleKm: p.km,
        blockMinutes: p.minutes,
        plannedLegs: L,
        shares: p.shares,
        offeredSeats: p.offeredSeats,
        satisfaction: p.satisfaction,
        fares: p.fares,
        passengers,
        transferPassengers,
        revenue,
        passengerCost,
        costPerPassenger,
        fixed,
        flightOpsFull: full.fuel + full.crew + full.landing,
        result: routeResult({ revenue, passengerCost: passengerCost.total, fixedWeeklyCost: fixed.total }),
      });
    }
    figuresByCompany.set(company.id, list);
  }
  return { companies, passengersByRoute, figuresByCompany, landingAt, transferFlowsByCompany, transfers };
}

/** Schritt 2 je Gesellschaft (nach den Strecken-Zahlen): Flughäfen, Flugzeuge, Verschleiß, Werbung, Abschnitt-8-Posten. */
function companyOperations(
  state: ModelState,
  companies: readonly CompanyState[],
  figuresByCompany: ReadonlyMap<string, RouteFigures[]>,
  landingAt: ReadonlyMap<string, ReadonlyMap<string, number>>,
  transferFlowsByCompany: ReadonlyMap<string, readonly TransferFlowFigures[]>,
): Readonly<Record<string, CompanyOperations>> {
  const X = state.month;
  // --- Gesellschaft: Flughäfen, Flugzeuge, Verschleiß, Werbung, Abschnitt-8-Posten.
  const owners = (airportId: string) => companies.filter((c) => (c.airports[airportId]?.managementTier ?? 0) >= OWNER_TIER).length;
  const result: Record<string, CompanyOperations> = {};
  for (const company of companies) {
    const { inputs } = company;
    const research = inputs.completedResearch;
    const eff = researchEffects(research);
    const routes = figuresByCompany.get(company.id) as RouteFigures[];
    const commonality = fleetCommonalityFactors(company.aircraft);

    const airportIds = Object.keys(company.airports).sort();
    const airportUpkeepList = airportIds.map((id) => {
      const h = company.airports[id];
      const departingSeats = sum(
        company.routes
          .filter((r) => r.from === id || r.to === id)
          .map((r) => (totalSeats((company.aircraft.find((a) => a.id === r.aircraftId) as AircraftState).seats) * r.departuresPerWeek) / 2),
      );
      return airportUpkeep(
        {
          airportSize: state.airports[id]?.size ?? 1,
          managementTier: h.managementTier,
          feeFactor: airportFeeFactor(h.managementTier, research),
          slots: h.slots,
          stands: h.stands,
          desks: h.desks,
          deskLoad: deskLoadOf(departingSeats, h.desks),
          facilities: h.facilities,
        },
        X,
      );
    });
    const ownerIncome = airportIds.map((id) => {
      const tier = company.airports[id].managementTier;
      if (tier < OWNER_TIER) return 0;
      const fees = landingAt.get(id) ?? new Map<string, number>();
      const others = sum([...fees.entries()].filter(([cid]) => cid !== company.id).map(([, fee]) => fee));
      return ownerFeeIncomeOf(tier, others, owners(id));
    });

    const flying = new Set(company.routes.map((r) => r.aircraftId));
    const aircraftUpkeepList = company.aircraft.map((p, i) =>
      aircraftUpkeep({ listPrice1960: p.listPrice1960, builtMonth: p.builtMonth, month: X, commonalityFactor: commonality[i], parked: !flying.has(p.id), completedResearch: research }),
    );
    const aircraftAfterWear = company.aircraft.map((p) => {
      const hours = flownHours(
        routes.filter((r) => r.aircraftId === p.id).map((r) => ({ blockMinutesPerWeek: r.blockMinutes * r.plannedLegs, flownShare: r.shares.flownShare })),
      );
      const wear = monthlyWear(hours, eff.wearFactor);
      return {
        ...p,
        cabinCondition: wornCondition(p.cabinCondition, wear.cabin, 'cabinCondition'),
        airframeCondition: wornCondition(p.airframeCondition, wear.airframe, 'airframeCondition'),
      };
    });
    const fleetValueEnd = sum(aircraftAfterWear.map((p) => aircraftValue(p, X + 1)));
    const birdStrikes = company.aircraft.filter((p) => flying.has(p.id) && rollBirdStrike(state.seed, X, p.id)).map((p) => p.id);
    const damages = sum(birdStrikes.map((id) => birdStrikeCost((company.aircraft.find((p) => p.id === id) as AircraftState).listPrice1960, X)));

    const flows = [...(transferFlowsByCompany.get(company.id) ?? [])].sort(
      (a, b) => b.passengers - a.passengers || (a.hubId + a.origin + a.destination < b.hubId + b.origin + b.destination ? -1 : 1),
    );
    const weeklyPassengers = sum(routes.map((r) => sum(CABIN_CLASSES.map((c) => r.passengers[c] + r.transferPassengers[c]))));
    const satisfactionEntries: { satisfaction: number; passengers: number }[] = [];
    for (const r of routes) {
      for (const c of CABIN_CLASSES) {
        const s = r.satisfaction[c];
        if (s !== undefined) satisfactionEntries.push({ satisfaction: s, passengers: r.passengers[c] + r.transferPassengers[c] });
      }
    }

    result[company.id] = {
      companyId: company.id,
      routes,
      revenue: monthlyRevenue(routes.map((r) => r.revenue)),
      passengers: weeklyPassengers * WEEKS_PER_MONTH,
      weeklyPassengers,
      transferPassengers: sum(flows.map((f) => f.passengers)) * WEEKS_PER_MONTH,
      transferFlows: flows,
      aircraftAfterWear,
      fleetValueEnd,
      birdStrikes,
      airportUpkeep: airportUpkeepList,
      aircraftUpkeep: aircraftUpkeepList,
      campaigns: runningCampaigns(inputs, X).map((c) => campaignCost(c.tier, X)),
      ffpBase: ffpBaseCost(inputs.ffpMonthsRunning > 0, X),
      charter: charterCost(routes.map((r) => ({ flightOpsWeekly: r.flightOpsFull, plannedLegsPerWeek: r.plannedLegs, charteredShare: r.shares.charteredShare }))),
      interest: creditInterest(company.ledger.cashAtStart),
      damages,
      ownerFeeIncome: ownerIncome,
      airlineSatisfaction: airlineSatisfaction(satisfactionEntries),
      cancelledShare: companyCancelledShare(
        routes.map((r) => ({
          seats: totalSeats((company.aircraft.find((a) => a.id === r.aircraftId) as AircraftState).seats),
          plannedDepartures: r.plannedLegs * WEEKS_PER_MONTH,
          cancelledShare: r.shares.cancelledShare,
        })),
      ),
    };
  }
  return result;
}

// ===========================================================================
// Einmalausgaben während des Monats (8.2)
// ===========================================================================

/** Leeres Kassenbuch für einen neuen Monat. */
export function newLedger(cash: number, fleetValue: number, deposits: number): MonthLedger {
  return {
    cashAtStart: cash,
    fleetValueAtStart: fleetValue,
    depositsAtStart: deposits,
    tradeValueChange: 0,
    purchases: 0,
    refits: 0,
    overhauls: 0,
    saleProceeds: 0,
    crisisResponses: 0,
    otherSpending: {},
  };
}

/** Σ `aircraftValue` einer Flotte im Monat. */
export function fleetValue(aircraft: readonly ValuedAircraft[], month: number): number {
  return sum(aircraft.map((p) => aircraftValue(p, month)));
}

/** Σ Anzahlungen der Vorbestellungen. */
export function depositsOf(preorders: readonly PreorderState[]): number {
  return sum(preorders.map((p) => p.deposit));
}

/**
 * Kauf eines Flugzeugs während des Monats zum Preis `price` (Neukauf: `valueBase`, gebraucht: `usedPrice`). Kasse sofort,
 * Bericht dieses Monats (Kauf: Wert − Preis in „Aircraft trades“, 5.13). Die Kasse muss reichen (8.14). SPEZIFIKATION 8.2.
 */
export function buyAircraft(company: CompanyState, plane: AircraftState, price: number, month: number): CompanyState {
  if (company.cash < price) throw new Error('buyAircraft: Kasse reicht nicht (keine Kreditlinie für Käufe, 8.14)');
  const l = company.ledger;
  return {
    ...company,
    cash: company.cash - price,
    aircraft: [...company.aircraft, plane],
    ledger: { ...l, purchases: l.purchases + price, tradeValueChange: l.tradeValueChange + aircraftValue(plane, month) },
  };
}

/**
 * Verkauf eines Flugzeugs während des Monats an den Markt zu `saleProceeds` (8.11); seine Strecken werden gelöscht, die
 * Slots bleiben. Gibt die Gesellschaft und das verkaufte Flugzeug (für den Gebrauchtmarkt) zurück. SPEZIFIKATION 8.2, 8.11.
 */
export function sellAircraft(company: CompanyState, planeId: string, month: number): { readonly company: CompanyState; readonly sold: ResoldPlane } {
  const plane = company.aircraft.find((p) => p.id === planeId);
  if (!plane) throw new Error(`sellAircraft: Flugzeug ${planeId} fehlt`);
  const value = aircraftValue(plane, month);
  const proceeds = saleProceeds(value, researchEffects(company.inputs.completedResearch).resaleBonus);
  const l = company.ledger;
  return {
    company: {
      ...company,
      cash: company.cash + proceeds,
      aircraft: company.aircraft.filter((p) => p.id !== planeId),
      routes: company.routes.filter((r) => r.aircraftId !== planeId),
      ledger: { ...l, saleProceeds: l.saleProceeds + proceeds, tradeValueChange: l.tradeValueChange - value },
    },
    sold: { ...plane, soldMonth: month },
  };
}

/**
 * Einmalausgabe ohne Ergebnis-Wirkung (Slots netto, Stufen, Einrichtungen, Forschung, Anzahlungen …) oder eine
 * Krisen-Antwort (Art `crisisResponse`, Posten „Crisis response“). Die Kasse muss reichen. SPEZIFIKATION 8.2, 8.14.
 */
export function spend(company: CompanyState, kind: string, amount: number): CompanyState {
  if (company.cash < amount) throw new Error('spend: Kasse reicht nicht (keine Kreditlinie für Käufe, 8.14)');
  const l = company.ledger;
  const ledger: MonthLedger =
    kind === 'crisisResponse'
      ? { ...l, crisisResponses: l.crisisResponses + amount }
      : { ...l, otherSpending: { ...l.otherSpending, [kind]: (l.otherSpending[kind] ?? 0) + amount } };
  return { ...company, cash: company.cash - amount, ledger };
}

// ===========================================================================
// Bericht (8.2)
// ===========================================================================

/** Eine Lieferung im Bericht. */
export interface DeliveryLine {
  readonly preorderId: string;
  readonly outcome: 'deliver' | 'delay' | 'cancel';
  /** Bezahlter Rest (Lieferung) oder verlorene Anzahlung (Storno). */
  readonly amount: number;
}

/** Bericht eines Monats für eine Gesellschaft. SPEZIFIKATION 8.2. */
export interface MonthReport {
  readonly month: number;
  readonly companyId: string;
  /** Monatserlös (4.9). */
  readonly revenue: number;
  /** Kosten je Posten (5.16 mit den Posten aus Abschnitt 8). */
  readonly costs: MonthlyCosts;
  /** Monatsergebnis (5.16). */
  readonly result: number;
  /** „Depreciation“ und „Aircraft trades“ (5.13). */
  readonly fleetValueResult: FleetValueResultParts;
  /** Einmalausgaben je Art, die nicht im Ergebnis stehen. */
  readonly otherSpending: Readonly<Record<string, number>>;
  /** Kassen-Änderung durch Entscheidungen nach der Buchung (KI: Dividende, Verkäufe, Überholungen …; 7.8). */
  readonly decisionsCash: number;
  /**
   * Wertänderung der Flotte durch Entscheidungen nach der Buchung (Verkauf −Wert, Überholung +Wertgewinn). Sie wirkt
   * ab X+1 und steht daher nicht im Monatsergebnis (7.8); `fleetValueEnd` enthält sie.
   */
  readonly decisionsValueChange: number;
  /** Prämien der Meilensteine (6.10), in die Kasse, nicht ins Ergebnis. */
  readonly milestonePrizes: number;
  /** Jahresziel im Dezember: + Prämie oder − Strafe (6.11), in die Kasse, nicht ins Ergebnis; sonst 0. */
  readonly goalCash: number;
  readonly deliveries: readonly DeliveryLine[];
  /** Zwangsverkäufe (Flugzeug-Kennungen, 8.14). */
  readonly forcedSales: readonly string[];
  /** Vogelschläge (Flugzeug-Kennungen, 8.6). */
  readonly birdStrikes: readonly string[];
  readonly cashStart: number;
  /** Kasse nach **allen** Buchungen des Abschlusses (R11) = Kasse des Spielstands danach. */
  readonly cashEnd: number;
  readonly fleetValueStart: number;
  readonly fleetValueEnd: number;
  readonly depositsStart: number;
  readonly depositsEnd: number;
  readonly creditLimit: number;
  readonly creditState: CreditState;
  /** Fluggäste im Monat, jede Teilstrecke gezählt (6.7). */
  readonly passengers: number;
  /** Umsteiger-Reisen im Monat (3.13). */
  readonly transferPassengers: number;
  readonly cancelledShare: number;
  readonly airlineSatisfaction: number;
  /** Ruf-Änderung mit Ursachen (6.5). */
  readonly reputation: ReputationChange;
  /**
   * Strecken-Zahlen (je Woche). Nur der neueste Bericht im Spielstand behält sie; ältere Berichte haben `[]`
   * (`keptReports`), sonst sprengen die Berichte der KI den Speicher des Browsers (Paket 5.3b, F82).
   */
  readonly routes: readonly RouteFigures[];
}

// ===========================================================================
// Prüfung (8.16)
// ===========================================================================

const finite = (n: number) => Number.isFinite(n);

/**
 * Prüfung am Ende des Abschlusses: Kasse, Ruf, Moral, Zustände und Werte jeder Gesellschaft. Ein ungültiger Wert ist ein
 * Fehler: Meldung im Log, die Größe behält ihren Wert vom Beginn des Abschlusses (`before`). SPEZIFIKATION 8.16.
 */
export function checkCompany(after: CompanyState, before: CompanyState, month: number, log: string[]): CompanyState {
  let company = after;
  const fail = (what: string) => log.push(`Invalid ${what} for ${after.id}; kept the value from the start of the month`);
  if (!finite(company.cash)) {
    fail('cash');
    company = { ...company, cash: before.cash };
  }
  if (!finite(company.reputation)) {
    fail('reputation');
    company = { ...company, reputation: before.reputation };
  }
  if (!finite(company.inputs.morale)) {
    fail('morale');
    company = { ...company, inputs: { ...company.inputs, morale: before.inputs.morale } };
  }
  const aircraft = company.aircraft.map((p) => {
    const old = before.aircraft.find((o) => o.id === p.id);
    const ok = finite(p.airframeCondition) && finite(p.cabinCondition) && finite(aircraftValue(p, month));
    if (ok) return p;
    fail(`aircraft ${p.id}`);
    return old ?? { ...p, airframeCondition: 100, cabinCondition: 100 };
  });
  return { ...company, aircraft };
}


// ===========================================================================
// Planer-Zahlen aus derselben Rechnung (4.12, 7.9, R2)
// ===========================================================================

/**
 * Spielstand für eine Planer-Rechnung einer Strecke: die eigenen Strecken an den beiden Enden und mit demselben
 * Flugzeug (Boden-Teil, Flugzeug-Anteil), die fremden Strecken auf dem Paar; Preise, die ab X+1 gelten; ohne Störungen
 * und ohne Umsteiger (die Vorhersage eines Plans kennt keine Würfe, 8.1). Exportiert für den Test, dass die schnellen
 * Planer-Rechnungen dasselbe ergeben wie `monthOperations` auf diesem Spielstand.
 */
export function plannerState(state: ModelState, companyId: string, routeId: string, change: (route: RouteState) => RouteState): ModelState {
  const own = state.companies.find((c) => c.id === companyId);
  const target = own?.routes.find((r) => r.id === routeId);
  if (!own || !target) throw new Error(`Planer: Strecke ${companyId}/${routeId} fehlt`);
  const pair = pairKey(target.from, target.to);
  const ends = new Set([target.from, target.to]);
  const companies = state.companies.map((c) => {
    const routes = c.routes
      .filter((r) =>
        c.id === companyId ? r.aircraftId === target.aircraftId || ends.has(r.from) || ends.has(r.to) : pairKey(r.from, r.to) === pair,
      )
      .map((r) => {
        const next: RouteState = { ...r, fareRatios: r.nextFareRatios ?? r.fareRatios, nextFareRatios: undefined };
        return c.id === companyId && r.id === routeId ? change(next) : next;
      });
    return { ...c, hubs: [], routes };
  });
  return { ...state, disruptions: [], companies };
}

/**
 * Planer-Hauptzahl einer Strecke (4.12): erwarteter Gewinn je Monat (`routeResult × WEEKS_PER_MONTH`) mit
 * `departuresPerWeek` Abflügen und allen Angeboten des Paars; dieselbe Rechnung wie der Abschluss (R2). Die KI
 * rechnet damit Verlierer und Feinabstimmung (7.8, 7.9). SPEZIFIKATION 4.12, 7.9.
 */
export function plannerRouteResult(state: ModelState, companyId: string, routeId: string, departuresPerWeek: number): number {
  return plannerRouteFigures(state, companyId, routeId, departuresPerWeek).result * WEEKS_PER_MONTH;
}

/**
 * Alle Zahlen einer Strecke aus der Planer-Rechnung (`plannerRouteResult`): Satisfaction, Fluggäste, Kosten je Woche.
 * Die KI liest daraus die Satisfaction einer geplanten Strecke für ihr Preisniveau (7.6, 7.9). SPEZIFIKATION 4.12, 7.9.
 */
export function plannerRouteFigures(state: ModelState, companyId: string, routeId: string, departuresPerWeek: number): RouteFigures {
  const core = operationsCore(plannerState(state, companyId, routeId, (r) => ({ ...r, departuresPerWeek })), { route: { companyId, routeId } });
  return (core.figuresByCompany.get(companyId) as RouteFigures[]).find((r) => r.routeId === routeId) as RouteFigures;
}

/**
 * Direktgäste je Woche einer Strecke in Klasse `c` beim Preisniveau `fareRatio` (alles andere fest); für den besten
 * Preis (4.10, `bestFareRatio`). SPEZIFIKATION 4.10.
 */
export function routeClassPassengersAt(state: ModelState, companyId: string, routeId: string, c: CabinClass, fareRatio: number): number {
  return routeClassPassengersCurve(state, companyId, routeId, c)(fareRatio);
}

/**
 * `routeClassPassengersAt` als Funktion des Preisniveaus: Der Planer-Spielstand wird einmal gebaut, je Preisniveau
 * ändert sich nur der Preis der Strecke. Gleiches Ergebnis, für die Suche nach dem besten Preis (4.10, ~57 Preisniveaus
 * je Klasse) aber ohne den Spielstand jedes Mal neu zu bauen (Paket 3.9b). SPEZIFIKATION 4.10.
 */
export function routeClassPassengersCurve(state: ModelState, companyId: string, routeId: string, c: CabinClass): (fareRatio: number) => number {
  const base = plannerState(state, companyId, routeId, (r) => r);
  const route = (base.companies.find((k) => k.id === companyId) as CompanyState).routes.find((r) => r.id === routeId) as RouteState;
  const pair = pairKey(route.from, route.to);
  const context = marketContext(base, { directPairs: new Set([pair]) });
  const onPair = context.preparedByPair.get(pair) ?? [];
  const viaHub = context.connectionsByPair.get(pair) ?? [];
  const index = onPair.findIndex((p) => p.company.id === companyId && p.route.id === routeId);
  const target = onPair[index];
  const key = routeKey(target);
  const basics = pairBasics(context, pair);
  const targetMarketFares = marketFares(target.km, context.X);
  return (fareRatio) => {
    // Nur der Preis der Strecke ändert sich (Satisfaction, Sitze und Flugzeit hängen nicht vom Preis ab).
    const fareRatios = { ...target.route.fareRatios, [c]: fareRatio };
    const changed: PreparedRoute = { ...target, route: { ...target.route, fareRatios }, fares: routeFares(fareRatios, targetMarketFares) };
    const routes = [...onPair];
    routes[index] = changed;
    const passengersByRoute = new Map<string, Record<CabinClass, number>>();
    splitPair(context, pair, routes, viaHub, [c], passengersByRoute, new Map(), basics);
    return (passengersByRoute.get(key) as Record<CabinClass, number>)[c];
  };
}

// ===========================================================================
// 8.15 Szenario-Ziele
// ===========================================================================

/** Werte eines Abschlusses für die Szenario-Ziele (8.15). */
export interface ScenarioValues {
  /** Kasse am Monatsende nach allen Buchungen (R11). */
  readonly capital: number;
  /** Monatsergebnis (5.16). */
  readonly monthlyProfit: number;
  /** Ruf nach der Ruf-Änderung (6.5). */
  readonly reputation: number;
  /** Strecken der Gesellschaft; das Ziel `routes` zählt daraus Städtepaare (`servedCityPairs`). */
  readonly routes: readonly Pick<RouteState, 'from' | 'to' | 'departuresPerWeek'>[];
  readonly regions: number;
  readonly transferPax: number;
  readonly creditLimit: number;
  /** Spielende (8.14). */
  readonly bankrupt: boolean;
}

/** Schwelle eines Ziels im Monat: Dollar-Ziele als Wert von 1960 über `atCost` (E6). SPEZIFIKATION 8.15. */
export function scenarioTarget(target: Pick<ScenarioTarget, 'metric' | 'target'>, month: number): number {
  return SCENARIO_DOLLAR_METRICS.includes(target.metric) ? atCost(target.target, month) : target.target;
}

/**
 * Städtepaare mit mindestens `minWeeklyFlights` Hin- und Rückflügen je Woche (Abflüge je Woche / 2): alle Strecken
 * eines Paars und beide Richtungen zusammen, so ist ein täglicher Dienst mit zwei Flugzeugen (4 + 3) täglich, und
 * dreißig Flugzeuge auf einem Paar sind ein Paar. Ziel `routes` der Szenarien. SPEZIFIKATION 8.15.
 */
export function servedCityPairs(routes: readonly Pick<RouteState, 'from' | 'to' | 'departuresPerWeek'>[], minWeeklyFlights = 0): number {
  const weekly = new Map<string, number>();
  for (const r of routes) {
    const key = r.from < r.to ? `${r.from}|${r.to}` : `${r.to}|${r.from}`;
    weekly.set(key, (weekly.get(key) ?? 0) + Math.max(0, r.departuresPerWeek) / 2);
  }
  let count = 0;
  for (const flights of weekly.values()) if (flights >= minWeeklyFlights) count++;
  return count;
}

/** Wert eines Ziels in diesem Abschluss (`routes` über `servedCityPairs`). SPEZIFIKATION 8.15. */
export function scenarioValue(target: Pick<ScenarioTarget, 'metric' | 'minWeeklyFlights'>, values: ScenarioValues): number {
  return target.metric === 'routes' ? servedCityPairs(values.routes, target.minWeeklyFlights ?? 0) : values[target.metric];
}

/**
 * Untergrenze der Kasse eines Szenarios am Ende von `month` (8.15, E77): −`creditLimit`, oder die eigene Schwelle des
 * Szenarios (`floorThreshold`, $ von 1960) mit dem Kostenindex des Monats.
 */
export function scenarioFloor(s: Pick<ScenarioState, 'floorThreshold'>, creditLimit: number, month: number): number {
  return s.floorThreshold === undefined ? -creditLimit : atCost(s.floorThreshold, month);
}

/**
 * Szenario nach dem Abschluss von `month` (8.15): Ziele mit den Werten dieses Abschlusses; verloren bei Spielende (8.14)
 * oder Kasse unter der Untergrenze (`scenarioFloor`: −`creditLimit` oder eigene Schwelle, E77) an `floorMonths`
 * Monatsenden in Folge; gewonnen, wenn alle Ziele erreicht sind; nach dem Stichtag sonst verloren. SPEZIFIKATION 8.15.
 */
export function scenarioStep(s: ScenarioState, values: ScenarioValues, month: number): ScenarioState {
  if (s.status !== 'running') return s;
  const floorStreak = values.capital < scenarioFloor(s, values.creditLimit, month) ? s.floorStreak + 1 : 0;
  if (values.bankrupt || floorStreak >= s.floorMonths) return { ...s, floorStreak, status: 'lost' };
  const met = new Set(s.met);
  for (const t of s.win) {
    if (t.atDeadline && month !== s.deadline) continue;
    if (scenarioValue(t, values) >= scenarioTarget(t, month)) met.add(t.id);
  }
  const won = s.win.every((t) => met.has(t.id));
  const status = won ? 'won' : month >= s.deadline ? 'lost' : 'running';
  return { ...s, floorStreak, met: [...met].sort(), status };
}

// ===========================================================================
// Ablauf (8.0, 8.1)
// ===========================================================================

/** Art einer Meldung des Abschlusses (Texte in Phase 4, E52). */
export type CloseNewsKind =
  | 'delivery'
  | 'deliveryDelayed'
  | 'preorderCancelled'
  | 'forcedSale'
  | 'bankrupt'
  | 'milestone'
  | 'rankUp'
  | 'goalMet'
  | 'goalMissed'
  | 'goalOffered'
  | 'researchDone'
  | 'scenarioWon'
  | 'scenarioLost'
  | 'staffStrike'
  | 'randomEvent'
  // Entscheidungen der KI (7.8; `rivalMonth.ts`).
  | 'priceWarStarted'
  | 'priceWarEnded'
  | 'scheduleCut'
  | 'routeClosed'
  | 'planeSold'
  | 'overhaul'
  | 'dividend'
  | 'forSale'
  | 'recovered'
  | 'liquidated'
  // Paket 3.8d: Eröffnungen, Wachstum, Bestand, Nachrücken (7.7, 7.9–7.11, 7.13).
  | 'routeOpened'
  | 'planeBought'
  | 'modernized'
  | 'cabinRenewed'
  | 'slotsSold'
  | 'loungeBuilt'
  | 'newHub'
  | 'newRival';

/** Eine Meldung des Abschlusses. */
export interface CloseNews {
  readonly companyId: string;
  readonly kind: CloseNewsKind;
  /** Strecke, Flugzeug, Meilenstein, Projekt, Ereignis … */
  readonly subject?: string;
  readonly amount?: number;
}

/** Was eine Entscheidungs-Funktion (Schritt 4) bekommt. */
export interface DecisionContext {
  /** Der abgeschlossene Monat X. */
  readonly month: number;
  readonly seed: number;
  /** Zahlen der Gesellschaft aus Schritt 2. */
  readonly operations: CompanyOperations;
  /** Monatsergebnis vor Lieferungen und Kreditlinie. */
  readonly result: number;
  /** Kosten des Monats (5.16, Summe) vor Lieferungen und Kreditlinie (Dividenden-Grenze, 7.13). */
  readonly costsTotal: number;
  /** Spielstand nach Buchung und Ruf aller Gesellschaften (nur lesen; Planer-Rechnungen ab X+1). */
  readonly state: ModelState;
}

/** Was eine Entscheidungs-Funktion zurückgibt. */
export interface DecisionOutcome {
  /**
   * Die Gesellschaft nach den Entscheidungen. Kasse und Flotte ändert sie direkt (nicht über das Kassenbuch); die
   * Änderungen stehen im Bericht als `decisionsCash` und `decisionsValueChange`.
   */
  readonly company: CompanyState;
  /** An den Markt verkaufte Flugzeuge (Gebrauchtmarkt, 8.11). */
  readonly sold?: readonly ResoldPlane[];
  readonly news?: readonly CloseNews[];
}

/**
 * Entscheidungen einer Gesellschaft nach der Buchung (Schritt 4, 7.8); wirken ab X+1. Die KI-Entscheidungen stehen in
 * `rivalMonth.ts` (`rivalDecisions`); Gesellschaften ohne Entscheidungen bleiben unverändert.
 */
export type CompanyDecisions = (company: CompanyState, ctx: DecisionContext) => DecisionOutcome;

/** Keine Entscheidungen (Tests und Vorhersage). */
export const NO_DECISIONS: CompanyDecisions = (company) => ({ company });

/**
 * Letzter Schritt nach dem Übergang (8.0, 7.19): bekommt den Spielstand für X+1 und gibt ihn mit Meldungen zurück. Die KI
 * rückt hier nach (`rivalRefill` in `rivalMonth.ts`, 7.7); der Abschluss kennt die KI nicht (7.1).
 */
export type AfterClose = (state: ModelState) => { readonly state: ModelState; readonly news?: readonly CloseNews[] };

/** Ergebnis eines Abschlusses. */
export interface CloseMonthResult {
  /** Spielstand für X+1. */
  readonly state: ModelState;
  /** Bericht X je Gesellschaft. */
  readonly reports: Readonly<Record<string, MonthReport>>;
  /** Gesellschaften mit Spielende (Pleite, 8.14). */
  readonly bankrupt: readonly string[];
  /** Meldungen (Texte in Phase 4). */
  readonly news: readonly CloseNews[];
  /** Fehler aus der Prüfung (8.16). */
  readonly log: readonly string[];
}

/** Regionen der Strecken-Enden einer Gesellschaft (`regionOf`, R15). */
function routeEndRegions(state: ModelState, routes: readonly RouteState[]): WorldRegion[] {
  return routes.flatMap((r) => [state.airports[r.from].region, state.airports[r.to].region]);
}

/** Ergebnis von Schritt 6 für eine Gesellschaft mit Fortschritt. */
interface ProgressStep {
  readonly progress: CompanyProgress;
  readonly milestonePrizes: number;
  readonly goalCash: number;
  readonly news: CloseNews[];
}

/**
 * Schritt 6 (6.7, 6.10, 6.11): Meilensteine mit der Kasse nach allen übrigen Buchungen (ohne die Prämien dieses
 * Abschlusses, 8.1), Rang über das 3-Monats-Mittel, im Dezember Jahresziel messen und das Angebot für das neue Jahr
 * machen (ohne Wahl gilt das sichere). Prämien und Strafe gehen in die Kasse, nicht ins Ergebnis.
 */
function progressStep(
  state: ModelState,
  company: CompanyState,
  o: CompanyOperations,
  values: { readonly cash: number; readonly reputation: number; readonly result: number; readonly revenue: number },
): ProgressStep {
  const X = state.month;
  const p = company.progress as CompanyProgress;
  const news: CloseNews[] = [];
  const regions = routeEndRegions(state, company.routes);
  const careerPax = p.careerPax + o.passengers - o.transferPassengers;
  const classes = company.aircraft.map((a) => sizeClassOf({ class: a.aircraftClass, capacity: a.capacity, cruiseSpeed: a.cruiseSpeed }));
  const context: MilestoneContext = {
    routes: company.routes.length,
    fleet: company.aircraft.length,
    careerPax,
    regions: new Set(regions).size,
    longestRouteKm: Math.max(0, ...company.routes.map((r) => distanceKm(state.airports[r.from].coords, state.airports[r.to].coords))),
    cash: values.cash,
    profitStreak: company.profitStreak,
    reputation: values.reputation,
    monthTransferPax: o.transferPassengers,
    widebodies: classes.filter((c) => c === 'widebody' || c === 'jumbo').length,
    supersonics: classes.filter((c) => c === 'supersonic').length,
    takeovers: p.takeovers,
  };
  const earned = newMilestones(p.milestones, context, X);
  const milestonePrizes = milestonePrizeTotal(earned, X);
  for (const m of earned) news.push({ companyId: company.id, kind: 'milestone', subject: m.id, amount: milestonePrize(m, X) });

  const stats = rankStats({
    routes: company.routes.length,
    weeklyPassengers: o.weeklyPassengers,
    reputation: values.reputation,
    routeEndRegions: regions,
    monthsPlayed: X - p.startMonth,
  });
  const rankHistory = [...p.rankHistory, stats].slice(-RANK_AVERAGE_MONTHS);
  const rank = nextRank(p.rank, rankHistory);
  if (rank > p.rank) news.push({ companyId: company.id, kind: 'rankUp', amount: rank });

  let goal = p.goal;
  // Gewählt wird bis zum Januar-Abschluss; danach gilt das Ziel, das bis dahin gewählt ist, ohne Wahl das sichere (6.11).
  let goalOffers = isDecember(X) ? p.goalOffers : undefined;
  let goalCash = 0;
  if (isDecember(X)) {
    const year = yearOf(X);
    const history = [
      ...company.reports.filter((r) => Number.isFinite(r?.month)),
      { month: X, result: values.result, revenue: values.revenue, passengers: o.passengers },
    ].map((r) => ({ year: yearOf(r.month), result: r.result, revenue: r.revenue, passengers: r.passengers }));
    const snapshot = yearSnapshot(history, year, { routes: company.routes.length, regions: new Set(regions).size, reputation: values.reputation });
    if (goal && goal.year === year) {
      const settled = settleGoal(goal, snapshot);
      goalCash = settled.cash;
      news.push({ companyId: company.id, kind: settled.met ? 'goalMet' : 'goalMissed', subject: goal.kind, amount: settled.cash });
    }
    goalOffers = annualGoalOffers({
      year: year + 1,
      month: X,
      lastYearProfit: snapshot.profit,
      lastYearRevenue: snapshot.revenue,
      lastYearPax: snapshot.pax,
      routes: snapshot.routes,
      regions: snapshot.regions,
      reputation: snapshot.reputation,
    });
    goal = chosenGoal(goalOffers);
    news.push({ companyId: company.id, kind: 'goalOffered', amount: goalOffers.length });
  }

  return {
    progress: { ...p, careerPax, milestones: [...p.milestones, ...earned.map((m) => m.id)], rankHistory, rank, goal, goalOffers },
    milestonePrizes,
    goalCash,
    news,
  };
}

/**
 * Berichte im Spielstand nach dem Abschluss (8.2): die letzten `limit` (Spieler `REPORT_HISTORY_MONTHS`, KI
 * `RIVAL_REPORT_MONTHS`), ältester zuerst. Die Strecken-Zahlen (`routes`) behält nur der neue Bericht; die älteren
 * tragen `[]`. Kein Leser braucht sie (Ansicht der KI und Abschluss lesen nur den letzten Bericht), und mit ihnen wächst
 * der Spielstand der KI um etwa 1 KB je Strecke und Monat: nach 7 Jahren mit 6 KI über 5 MB, die Grenze des
 * Browser-Speichers (Paket 5.3b, F82).
 */
export function keptReports(reports: readonly MonthReport[], report: MonthReport, limit = REPORT_HISTORY_MONTHS): readonly MonthReport[] {
  const older = limit > 1 ? reports.slice(-(limit - 1)).map((r) => (r?.routes?.length ? { ...r, routes: [] } : r)) : [];
  return [...older, report];
}

/**
 * Der einzige Zeitschritt des Spiels (8.1). Reihenfolge wie 8.0:
 * 1. Stand von X (Spielstand), 2. Rechnen für alle in einer Marktaufteilung mit Umsteigern (`monthOperations`),
 * Verschleiß, Wert und Kasse, 3. Ruf (6.5), 4. Entscheidungen (`decisions`, 7.8), 5. Lieferungen (8.12), Kreditlinie,
 * Zwangsverkauf und Spielende (8.14), 6. Gewinnserie (6.10); mit Fortschritt: Meilensteine, Rang, Jahresziel (6.7–6.11),
 * Prämien und Strafe in die Kasse, 7. Kasse am Monatsende und Bericht (8.2), Szenario (8.15), Prüfung (8.16),
 * 8. Übergang zu X+1 (Forschung, Preise, Moral, Zufallsereignis, Störungen, Personalstreik unter dem Pech-Deckel,
 * Gebrauchtmarkt, Kampagnen), 9. `after` im Spielstand für X+1 (Nachrücken der KI, 7.7). Rein: liest nur seine
 * Eingabe (R12). SPEZIFIKATION 8.0, 8.1.
 */
export function closeMonth(state: ModelState, decisions: CompanyDecisions, after?: AfterClose): CloseMonthResult {
  const X = state.month;
  const log: string[] = [];
  const news: CloseNews[] = [];
  const ops = monthOperations(state);
  const before = new Map(state.companies.map((c) => [c.id, c]));

  // Schritte 2 und 3: Buchung und Ruf, für alle (die Reihenfolge der Gesellschaften spielt keine Rolle).
  const booked = state.companies.map((company) => {
    const o = ops[company.id];
    const fleetParts = (extra: Partial<MonthLedger> = {}, valueEnd = o.fleetValueEnd) =>
      fleetValueResultParts({
        valueStart: company.ledger.fleetValueAtStart,
        valueEnd,
        tradeValueChange: company.ledger.tradeValueChange + (extra.tradeValueChange ?? 0),
        purchases: company.ledger.purchases + (extra.purchases ?? 0),
        refits: company.ledger.refits,
        overhauls: company.ledger.overhauls,
        saleProceeds: company.ledger.saleProceeds + (extra.saleProceeds ?? 0),
      });
    const costs = costsOf(o, company, fleetParts(), X);
    // Kasse: nur zahlungswirksame Posten; Käufe, Verkäufe und Krisen-Antworten sind schon bezahlt (8.2).
    const operatingCash = o.revenue - (costs.total - costs.depreciation - costs.aircraftTrades - costs.crisisResponses);
    const reputation = reputationChange(company.reputation, {
      airlineSatisfaction: o.airlineSatisfaction,
      cancelledShare: o.cancelledShare,
      campaigns: runningCampaigns(company.inputs, X).map((c) => c.tier),
    });
    const bookedCompany: CompanyState = { ...company, cash: company.cash + operatingCash, reputation: reputation.reputation, aircraft: o.aircraftAfterWear };
    return { company: bookedCompany, booked: bookedCompany, reputation, result: monthlyResult(o.revenue, costs), costsTotal: costs.total, fleetParts };
  });

  // Schritt 4: Entscheidungen nach der Buchung; sie sehen den gebuchten Stand aller Gesellschaften.
  const bookedState: ModelState = { ...state, companies: booked.map((b) => b.company) };
  const sold: ResoldPlane[] = [];
  const decided = booked.map((b) => {
    const outcome = decisions(b.company, {
      month: X,
      seed: state.seed,
      operations: ops[b.company.id],
      result: b.result,
      costsTotal: b.costsTotal,
      state: bookedState,
    });
    sold.push(...(outcome.sold ?? []));
    news.push(...(outcome.news ?? []));
    // Das Kassenbuch des Monats bleibt das der Buchung: Entscheidungen wirken ab X+1 (7.8).
    const company: CompanyState = { ...outcome.company, ledger: b.company.ledger };
    return {
      ...b,
      company,
      decisionsCash: company.cash - b.company.cash,
      decisionsValueChange: fleetValue(company.aircraft, X + 1) - fleetValue(b.company.aircraft, X + 1),
    };
  });

  // Schritte 5–7 je Gesellschaft.
  const reports: Record<string, MonthReport> = {};
  const bankrupt: string[] = [];
  const closed = decided.map(({ company: start, booked: bookedCompany, reputation, decisionsCash, decisionsValueChange, fleetParts }) => {
    const o = ops[start.id];
    const eff = researchEffects(start.inputs.completedResearch);
    let company = start;
    let extraTrade = 0;
    let extraPurchases = 0;
    let extraProceeds = 0;
    // Wert am Monatsende für das Ergebnis: ohne die Entscheidungen (sie wirken ab X+1, 7.8).
    let valueEnd = o.fleetValueEnd;
    const deliveries: DeliveryLine[] = [];

    // 5a Lieferungen (8.12): bezahlt, wenn die Kasse nach allen übrigen Buchungen den Rest deckt.
    const preorders: PreorderState[] = [];
    for (const order of company.preorders) {
      if (order.deliveryMonth > X) {
        preorders.push(order);
        continue;
      }
      const base = newAircraftPrice(order.plane.listPrice1960, order.plane.cabinListPrice1960, X);
      const balance = preorderBalance(base, order.count, order.deposit);
      const outcome = preorderDelivery(company.cash, balance, order.delays);
      if (outcome === 'deliver') {
        const planes: AircraftState[] = Array.from({ length: order.count }, (_, i) => ({
          ...order.plane,
          id: `${order.id}-${i + 1}`,
          builtMonth: X,
          cabinInstalledMonth: X,
          airframeCondition: 100,
          cabinCondition: 100,
          launchCustomer: isLaunchCustomer(X, order.firstDeliveryOffset),
        }));
        company = { ...company, cash: company.cash - balance, aircraft: [...company.aircraft, ...planes] };
        extraPurchases += preorderUnitPrice(base, order.count) * order.count;
        extraTrade += sum(planes.map((p) => aircraftValue(p, X)));
        valueEnd += fleetValue(planes, X + 1);
        deliveries.push({ preorderId: order.id, outcome, amount: balance });
        news.push({ companyId: company.id, kind: 'delivery', subject: order.id, amount: balance });
      } else if (outcome === 'delay') {
        preorders.push({ ...order, deliveryMonth: order.deliveryMonth + 1, delays: order.delays + 1 });
        deliveries.push({ preorderId: order.id, outcome, amount: 0 });
        news.push({ companyId: company.id, kind: 'deliveryDelayed', subject: order.id });
      } else {
        extraPurchases += order.deposit; // Anzahlung verloren: Aufwand „Aircraft trades“.
        deliveries.push({ preorderId: order.id, outcome, amount: order.deposit });
        news.push({ companyId: company.id, kind: 'preorderCancelled', subject: order.id, amount: order.deposit });
      }
    }
    company = { ...company, preorders };

    // 5b Kreditlinie, Zwangsverkauf, Spielende (8.14); Kreditgrenze aus der Flotte nach den Entscheidungen.
    const stateBeforeSale = creditState(company.cash, creditLimit(valueEnd + decisionsValueChange));
    const overdrawnMonths = nextOverdrawnMonths(company.overdrawnMonths, stateBeforeSale);
    const forcedSales: string[] = [];
    if (company.inputs.forcedSale) {
      const routeResults = (id: string) => sum(o.routes.filter((r) => r.aircraftId === id).map((r) => r.result));
      const flying = new Set(company.routes.map((r) => r.aircraftId));
      const index = forcedSale(
        company.aircraft.map((p) => ({ flying: flying.has(p.id), routeResult: routeResults(p.id) })),
        overdrawnMonths,
        stateBeforeSale,
      );
      if (index !== -1) {
        const plane = company.aircraft[index];
        const value = aircraftValue(plane, X + 1);
        const proceeds = saleProceeds(value, eff.resaleBonus);
        company = {
          ...company,
          cash: company.cash + proceeds,
          aircraft: company.aircraft.filter((p) => p.id !== plane.id),
          routes: company.routes.filter((r) => r.aircraftId !== plane.id),
        };
        extraTrade -= value;
        extraProceeds += proceeds;
        valueEnd -= value;
        forcedSales.push(plane.id);
        sold.push({ ...plane, soldMonth: X });
        news.push({ companyId: company.id, kind: 'forcedSale', subject: plane.id, amount: proceeds });
      }
    }
    const limit = creditLimit(valueEnd + decisionsValueChange);
    const credit = creditState(company.cash, limit);
    const isOver =
      company.inputs.forcedSale &&
      isBankrupt(credit, company.aircraft.length, overdrawnMonths, BANKRUPTCY_OVERDRAWN_MONTHS[company.inputs.difficulty]);
    if (isOver) {
      bankrupt.push(company.id);
      news.push({ companyId: company.id, kind: 'bankrupt' });
    }

    // Monatsergebnis mit allen Buchungen dieses Abschlusses außer den Entscheidungen (5.16).
    const parts = fleetParts({ tradeValueChange: extraTrade, purchases: extraPurchases, saleProceeds: extraProceeds }, valueEnd);
    const costs = costsOf(o, bookedCompany, parts, X);
    const result = monthlyResult(o.revenue, costs);

    // 6 Gewinnserie (Moral 8.7, Meilensteine 6.10); mit Fortschritt Meilensteine, Rang, Jahresziel.
    company = { ...company, overdrawnMonths, profitStreak: nextProfitStreak(company.profitStreak, result, company.routes.length) };
    let milestonePrizes = 0;
    let goalCash = 0;
    if (company.progress) {
      const step = progressStep(state, company, o, { cash: company.cash, reputation: reputation.reputation, result, revenue: o.revenue });
      milestonePrizes = step.milestonePrizes;
      goalCash = step.goalCash;
      news.push(...step.news);
      company = { ...company, cash: company.cash + milestonePrizes + goalCash, progress: step.progress };
    }

    // 7 Szenario (8.15) mit der Kasse am Monatsende nach allen Buchungen (R11).
    if (company.progress?.scenario) {
      const scenario = scenarioStep(
        company.progress.scenario,
        {
          capital: company.cash,
          monthlyProfit: result,
          reputation: reputation.reputation,
          routes: company.routes,
          regions: new Set(routeEndRegions(state, company.routes)).size,
          transferPax: o.transferPassengers,
          creditLimit: limit,
          bankrupt: isOver,
        },
        X,
      );
      if (scenario.status !== company.progress.scenario.status) {
        news.push({ companyId: company.id, kind: scenario.status === 'won' ? 'scenarioWon' : 'scenarioLost' });
      }
      company = { ...company, progress: { ...company.progress, scenario } };
    }

    // 7 Prüfung (8.16) und Bericht.
    company = checkCompany(company, before.get(company.id) as CompanyState, X + 1, log);
    const report: MonthReport = {
      month: X,
      companyId: company.id,
      revenue: o.revenue,
      costs,
      result,
      fleetValueResult: parts,
      otherSpending: bookedCompany.ledger.otherSpending,
      decisionsCash,
      decisionsValueChange,
      milestonePrizes,
      goalCash,
      deliveries,
      forcedSales,
      birdStrikes: o.birdStrikes,
      cashStart: bookedCompany.ledger.cashAtStart,
      cashEnd: company.cash,
      fleetValueStart: bookedCompany.ledger.fleetValueAtStart,
      fleetValueEnd: valueEnd + decisionsValueChange,
      depositsStart: bookedCompany.ledger.depositsAtStart,
      depositsEnd: depositsOf(company.preorders),
      creditLimit: limit,
      creditState: credit,
      passengers: o.passengers,
      transferPassengers: o.transferPassengers,
      cancelledShare: o.cancelledShare,
      airlineSatisfaction: o.airlineSatisfaction,
      reputation,
      routes: o.routes,
    };
    reports[company.id] = report;
    return { ...company, reports: keptReports(company.reports, report, company.agent ? RIVAL_REPORT_MONTHS : REPORT_HISTORY_MONTHS) };
  });

  const next = transition({ ...state, companies: closed }, sold);
  news.push(...next.news);
  // 9 Nachrücken (7.7) am Ende, im Spielstand für X+1.
  const finished = after ? after(next.state) : { state: next.state };
  news.push(...(finished.news ?? []));
  return { state: finished.state, reports, bankrupt, news, log };
}

/** Kosten des Monats aus Schritt 2 und dem Flottenwert-Ergebnis (5.16). */
function costsOf(o: CompanyOperations, company: CompanyState, fleet: FleetValueResultParts, month: number): MonthlyCosts {
  return monthlyCosts({
    routes: o.routes.map((r) => ({ fuel: r.fixed.fuel, crew: r.fixed.crew, landing: r.fixed.landing, passengers: r.passengerCost })),
    airportUpkeep: o.airportUpkeep,
    aircraftUpkeep: o.aircraftUpkeep,
    fleetValue: fleet,
    campaigns: o.campaigns,
    ffpBase: o.ffpBase,
    events: { charter: o.charter, crisisResponses: company.ledger.crisisResponses, interest: o.interest, damages: o.damages },
    ownerFeeIncome: o.ownerFeeIncome,
    subsidy: subsidyIncome(month, company.inputs.subsidized ?? false),
  });
}

/**
 * Schritt 8: Übergang zu X+1. Forschung fertig zu Beginn von X+1 (6.9), Preise ab X+1 (4.5), Strecken einen Monat
 * älter, Moral (8.7), Würfe unter dem Pech-Deckel (8.8: Zufallsereignis, Störungen, Personalstreik), Gebrauchtmarkt
 * (8.11), abgelaufene Kampagnen, neues Kassenbuch. SPEZIFIKATION 8.0.
 */
function transition(state: ModelState, sold: readonly ResoldPlane[]): { readonly state: ModelState; readonly news: CloseNews[] } {
  const next = state.month + 1;
  const news: CloseNews[] = [];
  const companies = state.companies.map((company) => {
    let { inputs } = company;
    let progress = company.progress;
    if (progress) {
      const advanced = advanceResearch(progress.research, next);
      for (const id of advanced.completed) news.push({ companyId: company.id, kind: 'researchDone', subject: id });
      progress = { ...progress, research: advanced.state };
      inputs = { ...inputs, completedResearch: advanced.state.done };
    }
    const morale = inputs.staffModel
      ? nextMorale(
          inputs.morale,
          moraleTarget({
            salaryPct: inputs.salaryPct,
            month: next,
            moralePoints: researchEffects(inputs.completedResearch).moralePoints,
            profitStreak: company.profitStreak,
            strike: inputs.staffStrike,
          }),
        )
      : inputs.morale;
    return {
      ...company,
      progress,
      inputs: {
        ...inputs,
        morale,
        campaigns: inputs.campaigns.filter((c) => c.endMonth >= next),
        ffpMonthsRunning: inputs.ffpMonthsRunning > 0 ? inputs.ffpMonthsRunning + 1 : 0,
      },
      routes: company.routes.map((r) => ({
        ...r,
        fareRatios: r.nextFareRatios ?? r.fareRatios,
        nextFareRatios: undefined,
        ageMonths: r.ageMonths + 1,
      })),
      ledger: newLedger(company.cash, fleetValue(company.aircraft, next), depositsOf(company.preorders)),
    };
  });

  // Würfe für X+1 (8.6–8.8), alle Gesellschaften; Pech-Deckel nur für Gesellschaften mit `badLuckCap`.
  const flying = new Set(companies.flatMap((c) => c.routes.map((r) => r.aircraftId)));
  const planes = companies.flatMap((c) => {
    const eff = researchEffects(c.inputs.completedResearch);
    return c.aircraft.map((p) => {
      const ends = c.routes.filter((r) => r.aircraftId === p.id).flatMap((r) => [r.from, r.to]);
      return {
        id: p.id,
        flies: flying.has(p.id),
        badLuckCap: c.inputs.badLuckCap,
        airframeCondition: p.airframeCondition,
        builtMonth: p.builtMonth,
        hasHangar: ends.some((id) => c.airports[id]?.facilities.includes('hangar') ?? false),
        defectFactor: eff.defectFactor,
      };
    });
  });
  const airportIds = [...new Set(companies.flatMap((c) => c.routes.flatMap((r) => [r.from, r.to])))].sort();
  const capAirports = new Set(companies.filter((c) => c.inputs.badLuckCap).flatMap((c) => c.routes.flatMap((r) => [r.from, r.to])));
  const staffCompany = companies.find((c) => c.inputs.staffModel);
  // Personalstreik nur mit mindestens einer Strecke (8.7, E74): ohne Flüge trifft er nichts.
  const strikeMorale = staffCompany && staffCompany.routes.length > 0 ? staffCompany.inputs.morale : undefined;
  const roll = rollTransition({
    seed: state.seed,
    month: next,
    planes,
    airports: airportIds.map((id) => ({ id, hasDepartures: true, badLuckCap: capAirports.has(id) })),
    capRegions: [...new Set([...capAirports].map((id) => state.airports[id].region))].sort(),
    randomEvents: state.randomEvents,
    previousBadLuck: state.badLuck,
    morale: strikeMorale,
  });
  if (roll.randomEvent) news.push({ companyId: '', kind: 'randomEvent', subject: roll.randomEvent.title });
  if (roll.staffStrike && staffCompany) news.push({ companyId: staffCompany.id, kind: 'staffStrike' });

  return {
    state: {
      ...state,
      month: next,
      randomEvents: roll.randomEvent ? [...state.randomEvents, roll.randomEvent] : state.randomEvents,
      disruptions: roll.disruptions,
      badLuck: roll.badLuck,
      resold: resoldInMarket([...state.resold, ...sold], next),
      companies: companies.map((c) =>
        roll.staffStrike && c.inputs.staffModel ? { ...c, inputs: { ...c.inputs, staffStrike: { month: next } } } : c,
      ),
    },
    news,
  };
}
