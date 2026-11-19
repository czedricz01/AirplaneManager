/**
 * Monatsabschluss: SPEZIFIKATION 8.0–8.2 und 8.16 (Paket 3.8b). Setzt die Bausteine der Abschnitte 2–8 zu einem
 * Zeitschritt zusammen.
 *
 * - `closeMonth(state, decisions)` ist eine **reine Funktion** (R12): Spielstand rein, Spielstand für X+1, Berichte
 *   und Log raus. Aller Zufall kommt aus `rng` mit dem `seed` des Spielstands (8.3).
 * - **Eine Rechnung für alle** (R1, E44, 7.8): Spieler und KI stehen gleichberechtigt in `companies`. Jede Gesellschaft
 *   unterscheidet sich nur durch ihre Eingaben (`CompanyInputs`; KI: die neutralen Werte aus `RIVAL_INPUTS`, 7.2).
 *   Diese Datei fragt nie „ist das eine KI?“ (Test 7.1).
 * - **KI-Entscheidungen** (Schritt 4, 7.8) kommen als Funktion `decisions` von außen: Sie stehen in `rivalMonth.ts`
 *   (Paket 3.8c), das diese Datei nicht kennt. So kann die Buchung nicht von ihnen abhängen.
 * - Der Spielstand enthält, was sich nur durch Einstellungen ändert (Kabine, Service-Auswahl, Interior score), als
 *   fertige Werte; alles, was sich mit Monat, Zustand, Ruf oder Markt ändert, rechnet der Abschluss (F41).
 *
 * Nicht hier (Paket 3.8c): Umsteiger im Abschluss (3.13), KI-Entscheidungen, Gewinnserie-Folgen, Meilensteine, Rang,
 * Jahresziel, Forschung im Übergang, Szenario-Ziele (8.15).
 */

import { difficultyFactor } from './basics';
import { cabinRating } from './cabin';
import {
  CABIN_CLASSES,
  OWNER_TIER,
  REPORT_HISTORY_MONTHS,
  WEEKS_PER_MONTH,
  type AircraftClass,
  type CabinClass,
  type CampaignTier,
  type Difficulty,
  type FacilityKind,
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
  fuelCost,
  fuelPrice,
  handlingFee,
  landingFee,
  payFactor,
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
  type Coords,
} from './demand';
import { marketFares, monthlyRevenue, routeFares, routeRevenue, type ClassFigures, type PartialClassFigures } from './fare';
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
import { nextProfitStreak, reputationChange, researchEffects, type ReputationChange } from './progress';
import {
  airlineSatisfaction,
  deskLoad as deskLoadOf,
  directOfferSatisfaction,
  satisfaction,
  satisfactionFactor,
  serviceCapability,
  servicePoints,
  typeAppeal,
  type Desks,
  type GroundSide,
  type ServiceSelection,
} from './satisfaction';

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
  /** Berichte, ältester zuerst, höchstens `REPORT_HISTORY_MONTHS` (8.2). */
  readonly reports: readonly MonthReport[];
  /** Zustand der Entscheidungen (KI: Persönlichkeit, Stärke, Notlage …); der Abschluss liest ihn nicht. */
  readonly agent?: unknown;
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
  readonly revenue: number;
  readonly passengerCost: PassengerCostParts;
  /** Feste Kosten mit den geflogenen Abschnitten (8.9). */
  readonly fixed: FixedWeeklyCostParts;
  /** `flightOpsCost` beim vollen Flugplan (für die Charter-Gebühr, 8.9). */
  readonly flightOpsFull: number;
  /** `routeResult` (5.9). */
  readonly result: number;
}

/** Was Schritt 2 für eine Gesellschaft ergibt (vor Lieferungen, Entscheidungen und Kreditlinie). */
export interface CompanyOperations {
  readonly companyId: string;
  readonly routes: readonly RouteFigures[];
  /** Monatserlös (4.9). */
  readonly revenue: number;
  /** Fluggäste im Monat. */
  readonly passengers: number;
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

/** Prüft den Spielstand auf Fehler, die die Rechnung falsch machen würden. */
function checkState(state: ModelState): void {
  const companyIds = new Set<string>();
  const planeIds = new Set<string>();
  let staffModels = 0;
  for (const c of state.companies) {
    if (companyIds.has(c.id)) throw new Error(`closeMonth: Gesellschaft ${c.id} doppelt`);
    companyIds.add(c.id);
    if (c.inputs.staffModel) staffModels++;
    for (const p of c.aircraft) {
      if (planeIds.has(p.id)) throw new Error(`closeMonth: Flugzeug ${p.id} doppelt`);
      planeIds.add(p.id);
    }
    for (const r of c.routes) {
      if (!c.aircraft.some((p) => p.id === r.aircraftId)) throw new Error(`closeMonth: Strecke ${r.id} ohne Flugzeug`);
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
  checkState(state);
  const X = state.month;
  const world = worldScale(X);
  const events = activeWorldEvents(X, state.randomEvents);
  const companies = byId(state.companies);

  // --- Vorbereitung je Gesellschaft und Strecke: Störungen, Sitze, Satisfaction, Preise.
  const prepared: PreparedRoute[] = [];
  for (const company of companies) {
    const { inputs } = company;
    const research = inputs.completedResearch;
    const planes = new Map(company.aircraft.map((p) => [p.id, p]));
    const holding = (id: string) => company.airports[id] ?? EMPTY_HOLDING;
    // Abflüge je Flughafen und Flugzeugklasse, Sitze der Abflüge je Flughafen (Bodenteile, 2.6.3).
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
    const groundSide = (airportId: string, cls: AircraftClass): GroundSide => {
      const h = holding(airportId);
      return {
        lounge: h.facilities.includes('vipLounge'),
        stands: h.stands[cls] ?? 0,
        occupiedSlots: departures.get(`${airportId}|${cls}`) ?? 0,
        desks: h.desks,
        departingSeatsPerWeek: departingSeats.get(airportId) ?? 0,
      };
    };
    const strikeShare = strikeCancelShare(inputs.staffStrike, X);
    const disruptions = state.disruptions.map((d) => ({ ...d, charter: d.charter === true && inputs.charter }));

    for (const route of company.routes) {
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

      const appealValue = typeAppeal({ catalogAppeal: plane.catalogAppeal, builtMonth: plane.builtMonth, month: X, launchCustomer: plane.launchCustomer });
      const cateringFacility = holding(A.id).facilities.includes('catering') || holding(B.id).facilities.includes('catering');
      const capability = serviceCapability({
        aircraftClass: plane.aircraftClass,
        hasWifi: plane.hasWifi,
        hasPremiumGalley: plane.hasPremiumGalley,
        cateringFacility,
      });
      const sat: Partial<Record<CabinClass, number>> = {};
      for (const c of CABIN_CLASSES) {
        if (!((plane.seats[c] ?? 0) > 0)) continue;
        const selection = route.service[c] ?? { meals: [], extras: [], onboardService: [] };
        sat[c] = satisfaction(
          c,
          {
            cabinRating: cabinRating(appealValue, plane.interiorScore[c] ?? 0, plane.cabinCondition),
            servicePoints: servicePoints(selection, minutes, capability),
          },
          {
            blockMinutes: minutes,
            origin: groundSide(A.id, plane.aircraftClass),
            destination: groundSide(B.id, plane.aircraftClass),
            morale: inputs.morale,
            completedResearch: research,
          },
        );
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

  // --- Eine Marktaufteilung je Paar und Klasse für alle Angebote (R1).
  const passengersByRoute = new Map<string, Record<CabinClass, number>>();
  const routeKey = (p: PreparedRoute) => `${p.company.id}|${p.route.id}`;
  const pairs = [...new Set(prepared.map((p) => p.pair))].sort();
  for (const pair of pairs) {
    const onPair = prepared.filter((p) => p.pair === pair);
    const [idA, idB] = pair.split('|');
    const A = state.airports[idA];
    const B = state.airports[idB];
    const km = distanceKm(A.coords, B.coords);
    const mf = marketFares(km, X);
    const reference = referenceBlockMinutes(A.coords, B.coords);
    const size = marketSizeParts({ a: A, b: B, month: X, world, eventFactor: eventDemandFactor(events, A.region, B.region) });
    const share = classShares(size.businessShare, reference);
    for (const p of onPair) passengersByRoute.set(routeKey(p), zeroClasses());

    const offerIds = [...new Set(onPair.map((p) => p.company.id))].sort();
    for (const c of CABIN_CLASSES) {
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
      if (offers.length === 0) continue;
      const split = marketSplit({ potential: classPotential(c, size.marketSize, share[c]), noFlyAppeal: noFlyAppeal(c), offers });
      for (const companyId of offerIds) {
        const own = onPair.filter((p) => p.company.id === companyId);
        const seatsByRoute: Record<string, number> = {};
        for (const p of own) seatsByRoute[p.route.id] = p.offeredSeats[c];
        const perRoute = distributeToRoutes(split.passengers[companyId] ?? 0, seatsByRoute);
        for (const p of own) (passengersByRoute.get(routeKey(p)) as Record<CabinClass, number>)[c] = perRoute[p.route.id];
      }
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
  for (const company of companies) {
    const { inputs } = company;
    const research = inputs.completedResearch;
    const holding = (id: string) => company.airports[id] ?? EMPTY_HOLDING;
    const feeFactor = (id: string) => airportFeeFactor(holding(id).managementTier, research);
    const fuel$ = fuelPrice(X, research, hedgedFuelTable(inputs.hedgedEvents.map(historicalEvent), X));
    const pay = payFactor(inputs.salaryPct);
    const ffpActive = inputs.ffpMonthsRunning > 0;
    const commonality = fleetCommonalityFactors(company.aircraft);
    const own = prepared.filter((p) => p.company.id === company.id);
    const hoursOfPlane = new Map<string, number>();
    for (const p of own) hoursOfPlane.set(p.plane.id, (hoursOfPlane.get(p.plane.id) ?? 0) + routeBlockHours(p.minutes, p.route.departuresPerWeek));

    const list: RouteFigures[] = [];
    for (const p of own) {
      const { route, plane } = p;
      const A = state.airports[route.from];
      const B = state.airports[route.to];
      const L = route.departuresPerWeek;
      const legs = L * p.shares.flownShare;
      const efficiency = aircraftEfficiency(plane.efficiency, research);
      const landingPlane: LandingAircraft = { aircraftClass: plane.aircraftClass, capacity: plane.capacity, cruiseSpeed: plane.cruiseSpeed };
      const landingA = landingFee(landingPlane, A.size, X, feeFactor(A.id));
      const landingB = landingFee(landingPlane, B.size, X, feeFactor(B.id));
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

      const end = (id: string, size: number): EndFees => ({ checkInFee: checkInFee(X, feeFactor(id)), handlingFee: handlingFee(size, X, feeFactor(id)), departureShare: 0.5 });
      const ends: [EndFees, EndFees] = [end(A.id, A.size), end(B.id, B.size)];
      const cateringFacility = holding(A.id).facilities.includes('catering') || holding(B.id).facilities.includes('catering');
      const capability = serviceCapability({ aircraftClass: plane.aircraftClass, hasWifi: plane.hasWifi, hasPremiumGalley: plane.hasPremiumGalley, cateringFacility });
      const passengers = passengersByRoute.get(routeKey(p)) as Record<CabinClass, number>;
      const direct: Partial<Record<CabinClass, { passengers: number; cost: PassengerCostParts }>> = {};
      for (const c of CABIN_CLASSES) {
        if (!(passengers[c] > 0)) continue;
        const selection = route.service[c] ?? { meals: [], extras: [], onboardService: [] };
        direct[c] = {
          passengers: passengers[c],
          cost: costPerPassengerParts({
            cateringCost: cateringCost(selection, p.minutes, capability, X, research),
            ends,
            ffpCostPerPassenger: ffpCostPerPassenger(ffpActive, X),
          }),
        };
      }
      const passengerCost = routePassengerCost(direct);
      const revenue = routeRevenue({ directPassengers: passengers, fares: p.fares });
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
        revenue,
        passengerCost,
        fixed,
        flightOpsFull: full.fuel + full.crew + full.landing,
        result: routeResult({ revenue, passengerCost: passengerCost.total, fixedWeeklyCost: fixed.total }),
      });
    }
    figuresByCompany.set(company.id, list);
  }

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

    const satisfactionEntries: { satisfaction: number; passengers: number }[] = [];
    for (const r of routes) {
      for (const c of CABIN_CLASSES) {
        const s = r.satisfaction[c];
        if (s !== undefined) satisfactionEntries.push({ satisfaction: s, passengers: r.passengers[c] });
      }
    }

    result[company.id] = {
      companyId: company.id,
      routes,
      revenue: monthlyRevenue(routes.map((r) => r.revenue)),
      passengers: sum(routes.map((r) => sum(CABIN_CLASSES.map((c) => r.passengers[c])))) * WEEKS_PER_MONTH,
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
  /** Kassen-Änderung durch Entscheidungen nach der Buchung (KI: Dividende, Käufe …; 7.8). */
  readonly decisionsCash: number;
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
  /** Fluggäste im Monat. */
  readonly passengers: number;
  readonly cancelledShare: number;
  readonly airlineSatisfaction: number;
  /** Ruf-Änderung mit Ursachen (6.5). */
  readonly reputation: ReputationChange;
  /** Strecken-Zahlen (je Woche). */
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
// Ablauf (8.0, 8.1)
// ===========================================================================

/** Was eine Entscheidungs-Funktion (Schritt 4) bekommt. */
export interface DecisionContext {
  /** Der abgeschlossene Monat X. */
  readonly month: number;
  readonly seed: number;
  /** Zahlen der Gesellschaft aus Schritt 2. */
  readonly operations: CompanyOperations;
  /** Monatsergebnis vor Lieferungen und Kreditlinie. */
  readonly result: number;
  /** Spielstand nach Buchung und Ruf aller Gesellschaften (nur lesen). */
  readonly state: ModelState;
}

/**
 * Entscheidungen einer Gesellschaft nach der Buchung (Schritt 4, 7.8); wirken ab X+1. Die KI-Entscheidungen stehen in
 * `rivalMonth.ts` (Paket 3.8c); für Gesellschaften ohne Entscheidungen gibt sie die Gesellschaft unverändert zurück.
 */
export type CompanyDecisions = (company: CompanyState, ctx: DecisionContext) => CompanyState;

/** Keine Entscheidungen (Tests und Vorhersage). */
export const NO_DECISIONS: CompanyDecisions = (company) => company;

/** Ergebnis eines Abschlusses. */
export interface CloseMonthResult {
  /** Spielstand für X+1. */
  readonly state: ModelState;
  /** Bericht X je Gesellschaft. */
  readonly reports: Readonly<Record<string, MonthReport>>;
  /** Gesellschaften mit Spielende (Pleite, 8.14). */
  readonly bankrupt: readonly string[];
  /** Fehler aus der Prüfung (8.16). */
  readonly log: readonly string[];
}

/**
 * Der einzige Zeitschritt des Spiels (8.1). Reihenfolge wie 8.0:
 * 1. Stand von X (Spielstand), 2. Rechnen für alle in einer Marktaufteilung (`monthOperations`), Verschleiß, Wert und
 * Kasse, 3. Ruf (6.5), 4. Entscheidungen (`decisions`, 7.8), 5. Lieferungen (8.12), Kreditlinie, Zwangsverkauf und
 * Spielende (8.14), 6. Gewinnserie (6.10), 7. Kasse am Monatsende und Bericht (8.2), Prüfung (8.16), 8. Übergang zu X+1
 * (Preise, Moral, Zufallsereignis, Störungen, Personalstreik unter dem Pech-Deckel, Gebrauchtmarkt, Kampagnen).
 * Rein: liest nur seine Eingabe (R12). SPEZIFIKATION 8.0, 8.1.
 */
export function closeMonth(state: ModelState, decisions: CompanyDecisions): CloseMonthResult {
  const X = state.month;
  const log: string[] = [];
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
    const costs = costsOf(o, company, fleetParts());
    // Kasse: nur zahlungswirksame Posten; Käufe, Verkäufe und Krisen-Antworten sind schon bezahlt (8.2).
    const operatingCash = o.revenue - (costs.total - costs.depreciation - costs.aircraftTrades - costs.crisisResponses);
    const reputation = reputationChange(company.reputation, {
      airlineSatisfaction: o.airlineSatisfaction,
      cancelledShare: o.cancelledShare,
      campaigns: runningCampaigns(company.inputs, X).map((c) => c.tier),
    });
    return {
      company: { ...company, cash: company.cash + operatingCash, reputation: reputation.reputation, aircraft: o.aircraftAfterWear },
      reputation,
      result: monthlyResult(o.revenue, costs),
      fleetParts,
    };
  });

  // Schritt 4: Entscheidungen nach der Buchung; sie sehen den gebuchten Stand aller Gesellschaften.
  const bookedState: ModelState = { ...state, companies: booked.map((b) => b.company) };
  const decided = booked.map((b) => {
    const cashBefore = b.company.cash;
    const company = decisions(b.company, { month: X, seed: state.seed, operations: ops[b.company.id], result: b.result, state: bookedState });
    return { ...b, company, decisionsCash: company.cash - cashBefore };
  });

  // Schritte 5–7 je Gesellschaft.
  const reports: Record<string, MonthReport> = {};
  const bankrupt: string[] = [];
  const sold: ResoldPlane[] = [];
  const closed = decided.map(({ company: start, reputation, decisionsCash, fleetParts }) => {
    const o = ops[start.id];
    const eff = researchEffects(start.inputs.completedResearch);
    let company = start;
    let extraTrade = 0;
    let extraPurchases = 0;
    let extraProceeds = 0;
    let valueEnd = fleetValue(company.aircraft, X + 1);
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
      } else if (outcome === 'delay') {
        preorders.push({ ...order, deliveryMonth: order.deliveryMonth + 1, delays: order.delays + 1 });
        deliveries.push({ preorderId: order.id, outcome, amount: 0 });
      } else {
        extraPurchases += order.deposit; // Anzahlung verloren: Aufwand „Aircraft trades“.
        deliveries.push({ preorderId: order.id, outcome, amount: order.deposit });
      }
    }
    company = { ...company, preorders };

    // 5b Kreditlinie, Zwangsverkauf, Spielende (8.14).
    const stateBeforeSale = creditState(company.cash, creditLimit(valueEnd));
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
      }
    }
    const limit = creditLimit(valueEnd);
    const credit = creditState(company.cash, limit);
    if (company.inputs.forcedSale && isBankrupt(credit, company.aircraft.length)) bankrupt.push(company.id);

    // 7 Bericht mit allen Buchungen dieses Abschlusses.
    const parts = fleetParts({ tradeValueChange: extraTrade, purchases: extraPurchases, saleProceeds: extraProceeds }, valueEnd);
    const costs = costsOf(o, start, parts);
    const result = monthlyResult(o.revenue, costs);

    // 6 Gewinnserie (Moral 8.7, Meilensteine 6.10).
    company = { ...company, overdrawnMonths, profitStreak: nextProfitStreak(company.profitStreak, result, company.routes.length) };
    company = checkCompany(company, before.get(company.id) as CompanyState, X + 1, log);

    const report: MonthReport = {
      month: X,
      companyId: company.id,
      revenue: o.revenue,
      costs,
      result,
      fleetValueResult: parts,
      otherSpending: start.ledger.otherSpending,
      decisionsCash,
      deliveries,
      forcedSales,
      birdStrikes: o.birdStrikes,
      cashStart: start.ledger.cashAtStart,
      cashEnd: company.cash,
      fleetValueStart: start.ledger.fleetValueAtStart,
      fleetValueEnd: valueEnd,
      depositsStart: start.ledger.depositsAtStart,
      depositsEnd: depositsOf(company.preorders),
      creditLimit: limit,
      creditState: credit,
      passengers: o.passengers,
      cancelledShare: o.cancelledShare,
      airlineSatisfaction: o.airlineSatisfaction,
      reputation,
      routes: o.routes,
    };
    reports[company.id] = report;
    return { ...company, reports: [...company.reports, report].slice(-REPORT_HISTORY_MONTHS) };
  });

  return { state: transition({ ...state, companies: closed }, sold), reports, bankrupt, log };
}

/** Kosten des Monats aus Schritt 2 und dem Flottenwert-Ergebnis (5.16). */
function costsOf(o: CompanyOperations, company: CompanyState, fleet: FleetValueResultParts): MonthlyCosts {
  return monthlyCosts({
    routes: o.routes.map((r) => ({ fuel: r.fixed.fuel, crew: r.fixed.crew, landing: r.fixed.landing, passengers: r.passengerCost })),
    airportUpkeep: o.airportUpkeep,
    aircraftUpkeep: o.aircraftUpkeep,
    fleetValue: fleet,
    campaigns: o.campaigns,
    ffpBase: o.ffpBase,
    events: { charter: o.charter, crisisResponses: company.ledger.crisisResponses, interest: o.interest, damages: o.damages },
    ownerFeeIncome: o.ownerFeeIncome,
  });
}

/**
 * Schritt 8: Übergang zu X+1. Preise ab X+1 (4.5), Strecken einen Monat älter, Moral (8.7), Würfe unter dem Pech-Deckel
 * (8.8: Zufallsereignis, Störungen, Personalstreik), Gebrauchtmarkt (8.11), abgelaufene Kampagnen, neues Kassenbuch.
 * SPEZIFIKATION 8.0.
 */
function transition(state: ModelState, sold: readonly ResoldPlane[]): ModelState {
  const next = state.month + 1;
  const companies = state.companies.map((company) => {
    const { inputs } = company;
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
  const roll = rollTransition({
    seed: state.seed,
    month: next,
    planes,
    airports: airportIds.map((id) => ({ id, hasDepartures: true, badLuckCap: capAirports.has(id) })),
    capRegions: [...new Set([...capAirports].map((id) => state.airports[id].region))].sort(),
    randomEvents: state.randomEvents,
    previousBadLuck: state.badLuck,
    morale: staffCompany?.inputs.morale,
  });

  return {
    ...state,
    month: next,
    randomEvents: roll.randomEvent ? [...state.randomEvents, roll.randomEvent] : state.randomEvents,
    disruptions: roll.disruptions,
    badLuck: roll.badLuck,
    resold: resoldInMarket([...state.resold, ...sold], next),
    companies: companies.map((c) =>
      roll.staffStrike && c.inputs.staffModel ? { ...c, inputs: { ...c.inputs, staffStrike: { month: next } } } : c,
    ),
  };
}
