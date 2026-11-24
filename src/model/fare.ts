/**
 * Preis und Erlös: SPEZIFIKATION Abschnitt 4.
 *
 * Preise gelten je Fluggast und Strecke, eine Richtung; eine Strecke hat einen Preis je Klasse, gleich in
 * beiden Richtungen. Erlöse gelten je Woche, beide Richtungen zusammen. Alles ungerundet (R4).
 *
 * Der Marktpreis hängt nur von Entfernung, Bezugs-Flugzeit und Kostenindex ab (4.3). Gespeichert wird je
 * Strecke und Klasse das Preisniveau `fareRatio` = Preis / Marktpreis (4.5, E56).
 *
 * Kosten aus Abschnitt 5 (`costPerPassenger`, `fixedWeeklyCost`) kommen als fertige Zahlen, solange
 * Paket 3.5 wartet (wie F14).
 */

import { atCost, clamp } from './basics';
import {
  BEST_FARE_COARSE_STEP,
  BEST_FARE_FINE_STEP,
  CABIN_CLASSES,
  CLASS_FARE_RATIO_BASE,
  CLASS_FARE_RATIO_SLOPE,
  FARE_BASE_1960,
  FARE_PER_KM_1960,
  FARE_RATIO_DEFAULT,
  FARE_RATIO_MAX,
  FARE_RATIO_MIN,
  REFERENCE_SPEED,
  FARE_TIME_FACTOR,
  WEEKS_PER_MONTH,
  type CabinClass,
} from './constants';
import { blockMinutes } from './demand';
import {
  directOffer,
  distributeToRoutes,
  marketSplit,
  noFlyAppeal,
  offerAppeal,
  type OfferAppealInput,
  type OfferRoute,
  type SplitOffer,
} from './marketSplit';
import { flightTimeIndex } from './satisfaction';

/** Eine Zahl je Klasse. */
export type ClassFigures = Readonly<Record<CabinClass, number>>;

/** Eine Zahl je Klasse; fehlende Klasse = keine Sitze bzw. kein Wert. */
export type PartialClassFigures = Readonly<Partial<Record<CabinClass, number>>>;

// ---------------------------------------------------------------------------
// 4.1 Grundpreis Economy
// ---------------------------------------------------------------------------

/**
 * Preis-Faktor beim Flugzeit-Index `timeIndex` (1 … 8, stufenlos): gerade Linie zwischen den Tabellenwerten
 * `FARE_TIME_FACTOR` (wie im Alt-Code `byTimeIndex`, `src/lib/financeUtils.ts:271-276`). SPEZIFIKATION 4.1.
 */
export function fareTimeFactor(timeIndex: number): number {
  const table = FARE_TIME_FACTOR;
  const t = clamp(timeIndex, 1, table.length);
  const low = Math.floor(t);
  const high = Math.min(table.length, low + 1);
  return table[low - 1] + (table[high - 1] - table[low - 1]) * (t - low);
}

/**
 * Was ein Economy-Ticket auf einem Paar „normal“ kostet, in $ von 1960:
 * `(FARE_BASE_1960 + FARE_PER_KM_1960 × Entfernung) × fareTimeFactor(flightTimeIndex(referenceMinutes))`.
 * Der Index kommt aus der **Bezugs-Flugzeit**, nie aus dem Flugzeug (3.16). SPEZIFIKATION 4.1.
 *
 * @param greatCircleKm Großkreis-Entfernung des Paars (`distanceKm`).
 * @param referenceMinutes `referenceBlockMinutes` des Paars (3.1).
 */
export function baseFareEconomy(greatCircleKm: number, referenceMinutes: number): number {
  return (
    (FARE_BASE_1960 + FARE_PER_KM_1960 * greatCircleKm) * fareTimeFactor(flightTimeIndex(referenceMinutes))
  );
}

// ---------------------------------------------------------------------------
// 4.2 Klassen-Verhältnis
// ---------------------------------------------------------------------------

/**
 * Wie viel teurer eine Klasse als Economy ist: `CLASS_FARE_RATIO_BASE[c] + CLASS_FARE_RATIO_SLOPE[c] × (i − 1)`
 * mit `i = flightTimeIndex(referenceMinutes)`. Eine Funktion für alle Zwecke (E23): Marktpreis, Startpreis,
 * „Adjust All“, Gewinnschwelle, KI-Preise. SPEZIFIKATION 4.2.
 */
export function classFareRatio(cabinClass: CabinClass, referenceMinutes: number): number {
  const index = flightTimeIndex(referenceMinutes);
  return CLASS_FARE_RATIO_BASE[cabinClass] + CLASS_FARE_RATIO_SLOPE[cabinClass] * (index - 1);
}

// ---------------------------------------------------------------------------
// 4.3 Marktpreis
// ---------------------------------------------------------------------------

/**
 * Bezugspreis einer Klasse auf einem Paar in $ des Monats:
 * `atCost(baseFareEconomy × classFareRatio(c), month)`. Die Bezugs-Flugzeit wird aus der Entfernung
 * gebildet (`blockMinutes` mit `REFERENCE_SPEED`, gleich `referenceBlockMinutes`, 3.1).
 *
 * Hängt nur von Entfernung und Monat ab: gleich für alle Angebote, Spieler und KI, Planer und
 * Monatsabschluss; nicht von Fluggästen, Sitzen, Satisfaction, Ruf, Saison, Schwierigkeit oder Flugzeug
 * (3.16, E4, E13). SPEZIFIKATION 4.3.
 */
export function marketFare(cabinClass: CabinClass, greatCircleKm: number, month: number): number {
  const referenceMinutes = blockMinutes(greatCircleKm, REFERENCE_SPEED);
  return atCost(baseFareEconomy(greatCircleKm, referenceMinutes) * classFareRatio(cabinClass, referenceMinutes), month);
}

/** `marketFare` aller Klassen eines Paars. SPEZIFIKATION 4.3. */
export function marketFares(greatCircleKm: number, month: number): ClassFigures {
  const result = {} as Record<CabinClass, number>;
  for (const cabinClass of CABIN_CLASSES) result[cabinClass] = marketFare(cabinClass, greatCircleKm, month);
  return result;
}

// ---------------------------------------------------------------------------
// 4.5 Preis einer Strecke
// ---------------------------------------------------------------------------

/** Preisniveau auf `FARE_RATIO_MIN … FARE_RATIO_MAX` begrenzen; einmal, beim Speichern (R4). SPEZIFIKATION 4.5. */
export function clampFareRatio(fareRatio: number): number {
  return clamp(fareRatio, FARE_RATIO_MIN, FARE_RATIO_MAX);
}

/**
 * Gespeichertes Preisniveau lesen; fehlt es, gilt `FARE_RATIO_DEFAULT` (= Marktpreis). Die **eine** Stelle
 * für fehlende Preise (R8): alte Spielstände, neue Klassen nach einem Umbau, KI-Strecken. SPEZIFIKATION 4.5.
 */
export function fareRatioOrDefault(storedFareRatio: number | undefined): number {
  return storedFareRatio ?? FARE_RATIO_DEFAULT;
}

/**
 * Eingabe des Planers in $ → zu speicherndes Preisniveau: `Eingabe / marketFare`, begrenzt. Mit dem
 * Marktpreis des aktuellen Monats aufrufen (bei Bestätigung). SPEZIFIKATION 4.5.
 */
export function fareRatioFromInput(fareInput: number, marketFareValue: number): number {
  return clampFareRatio(fareInput / marketFareValue);
}

/** Preis einer Strecke in einer Klasse: `fareRatio × marketFare`; fehlendes `fareRatio` = Marktpreis. SPEZIFIKATION 4.5, 4.6. */
export function routeFare(storedFareRatio: number | undefined, marketFareValue: number): number {
  return fareRatioOrDefault(storedFareRatio) * marketFareValue;
}

/** `routeFare` aller Klassen. Spieler und KI nutzen dieselbe Funktion (4.6, R7). SPEZIFIKATION 4.5. */
export function routeFares(storedFareRatios: PartialClassFigures | undefined, marketFareValues: ClassFigures): ClassFigures {
  const result = {} as Record<CabinClass, number>;
  for (const cabinClass of CABIN_CLASSES) {
    result[cabinClass] = routeFare(storedFareRatios?.[cabinClass], marketFareValues[cabinClass]);
  }
  return result;
}

/**
 * „Adjust All Prices“: **ein** Preisniveau für alle Klassen (begrenzt); die Abstände der Klassen kommen so
 * aus `classFareRatio` (E23). Eine neue Strecke startet mit `FARE_RATIO_DEFAULT`. SPEZIFIKATION 4.5.
 */
export function uniformFareRatios(fareRatio: number = FARE_RATIO_DEFAULT): ClassFigures {
  const value = clampFareRatio(fareRatio);
  const result = {} as Record<CabinClass, number>;
  for (const cabinClass of CABIN_CLASSES) result[cabinClass] = value;
  return result;
}

/** Abstand zum Marktpreis für die Anzeige „±x % vs. market“ (als Anteil: 0,1 = +10 %). SPEZIFIKATION 4.5, 4.12. */
export function fareVsMarket(fareRatio: number): number {
  return fareRatio - 1;
}

// ---------------------------------------------------------------------------
// 4.7 Erlös je Strecke
// ---------------------------------------------------------------------------

/** Ein Umsteiger-Fluss über eine Strecke (aus `allocateTransferSeats`, 3.13). */
export interface TransferFlow {
  readonly cabinClass: CabinClass;
  /** Umsteiger je Woche auf dieser Strecke (die einen Sitz bekommen haben). */
  readonly passengers: number;
  /** Anteil dieser Strecke am Umsteiger-Tarif je Fluggast (`transferRevenueShare`, 4.8). */
  readonly revenuePerPassenger: number;
}

/** Eingaben für `routeRevenue`. */
export interface RouteRevenueInput {
  /** `directPax(route, c)`: Direktgäste je Woche (3.11 Schritt 4); fehlende Klasse = 0. */
  readonly directPassengers: PartialClassFigures;
  /** `routeFare(route, c)` (4.5), Preise vom Monatsbeginn. */
  readonly fares: ClassFigures;
  /** Umsteiger-Flüsse über die Strecke; Standard keine. */
  readonly transfers?: readonly TransferFlow[];
}

/** Erlös einer Strecke je Woche, getrennt für die Anzeige („Weekly revenue“ je Klasse, Umsteiger getrennt). */
export interface RouteRevenueParts {
  readonly direct: ClassFigures;
  readonly transfer: ClassFigures;
  readonly total: number;
}

/**
 * Erlös einer Strecke je Woche: `Σ c: directPax × routeFare + Σ Umsteiger: Anteil am Umsteiger-Tarif`.
 * Nichts sonst: kein Zuschlag, keine Schwierigkeit, kein Abzug für gestrichene Flüge (die wirken über die
 * Sitze, E33). Charter-Fluggäste zahlen wie sonst (E32). Spieler und KI gleich (E44). SPEZIFIKATION 4.7.
 */
export function routeRevenueParts(input: RouteRevenueInput): RouteRevenueParts {
  const direct = {} as Record<CabinClass, number>;
  const transfer = {} as Record<CabinClass, number>;
  for (const cabinClass of CABIN_CLASSES) {
    direct[cabinClass] = (input.directPassengers[cabinClass] ?? 0) * input.fares[cabinClass];
    transfer[cabinClass] = 0;
  }
  for (const flow of input.transfers ?? []) {
    transfer[flow.cabinClass] += flow.passengers * flow.revenuePerPassenger;
  }
  let total = 0;
  for (const cabinClass of CABIN_CLASSES) total += direct[cabinClass] + transfer[cabinClass];
  return { direct, transfer, total };
}

/** Erlös einer Strecke je Woche, beide Richtungen. SPEZIFIKATION 4.7. */
export function routeRevenue(input: RouteRevenueInput): number {
  return routeRevenueParts(input).total;
}

// ---------------------------------------------------------------------------
// 4.8 Umsteiger-Tarif auf die Teilstrecken verteilen
// ---------------------------------------------------------------------------

/** Anteile einer Teilstrecke am Umsteiger-Tarif, $ je Fluggast. */
export interface TransferLegShares {
  /** Teilstrecke Start–Drehkreuz (O–H). */
  readonly originHub: number;
  /** Teilstrecke Drehkreuz–Ziel (H–D). */
  readonly hubDestination: number;
}

/**
 * Verteilt den Umsteiger-Tarif (`transferFare`, 3.13) auf die Teilstrecken **im Verhältnis ihrer
 * Marktpreise** in derselben Klasse: `Anteil(O–H) = marketFare_OH / (marketFare_OH + marketFare_HD)`, Rest an
 * H–D. Die Summe ist genau der Tarif. SPEZIFIKATION 4.8.
 */
export function transferRevenueShare(
  transferFareValue: number,
  marketFareOriginHub: number,
  marketFareHubDestination: number,
): TransferLegShares {
  const originHub = (transferFareValue * marketFareOriginHub) / (marketFareOriginHub + marketFareHubDestination);
  return { originHub, hubDestination: transferFareValue - originHub };
}

// ---------------------------------------------------------------------------
// 4.9 Monatserlös
// ---------------------------------------------------------------------------

/** Monatserlös: `Σ Strecken routeRevenue × WEEKS_PER_MONTH` (E5). SPEZIFIKATION 4.9. */
export function monthlyRevenue(weeklyRouteRevenues: readonly number[]): number {
  return weeklyRouteRevenues.reduce((sum, value) => sum + value, 0) * WEEKS_PER_MONTH;
}

// ---------------------------------------------------------------------------
// 4.10 Bester Preis
// ---------------------------------------------------------------------------

/**
 * Das Preisniveau in `FARE_RATIO_MIN … FARE_RATIO_MAX`, bei dem
 * `passengersAt(fareRatio) × (fareRatio × marketFare − costPerPassenger)` am größten ist.
 *
 * Suche: Gitter in Schritten von `BEST_FARE_COARSE_STEP`, dann um den besten Punkt ± einen groben Schritt in
 * Schritten von `BEST_FARE_FINE_STEP`. Bei Gleichstand der niedrigere Preis. Eindeutig und für Planer und
 * KI gleich. SPEZIFIKATION 4.10.
 *
 * @param passengersAt Fluggäste der Strecke in der Klasse beim Preisniveau (alles andere fest);
 *   für den Markt eines Paars: `routeClassPassengers`.
 */
export function bestFareRatio(
  passengersAt: (fareRatio: number) => number,
  marketFareValue: number,
  costPerPassenger = 0,
): number {
  const profitAt = (fareRatio: number) => passengersAt(fareRatio) * (fareRatio * marketFareValue - costPerPassenger);

  // Ganzzahlige Zähler, damit sich keine Rundungsfehler aufaddieren.
  const coarseSteps = Math.round((FARE_RATIO_MAX - FARE_RATIO_MIN) / BEST_FARE_COARSE_STEP);
  let coarseBest = Number.NaN;
  let bestProfit = Number.NEGATIVE_INFINITY;
  for (let k = 0; k <= coarseSteps; k++) {
    const fareRatio = FARE_RATIO_MIN + k * BEST_FARE_COARSE_STEP;
    const profit = profitAt(fareRatio);
    if (profit > bestProfit) {
      bestProfit = profit;
      coarseBest = fareRatio;
    }
  }

  const fineSteps = Math.round(BEST_FARE_COARSE_STEP / BEST_FARE_FINE_STEP);
  let best = Number.NaN;
  bestProfit = Number.NEGATIVE_INFINITY;
  for (let j = -fineSteps; j <= fineSteps; j++) {
    const fareRatio = clampFareRatio(coarseBest + j * BEST_FARE_FINE_STEP);
    const profit = profitAt(fareRatio);
    if (profit > bestProfit) {
      bestProfit = profit;
      best = fareRatio;
    }
  }
  return best;
}

/** Der Markt einer Klasse, wie ihn `routeClassPassengers` und `bestFare` brauchen. */
export interface RouteClassMarket {
  readonly cabinClass: CabinClass;
  /** `classPotential` (3.10) des Paars in dieser Klasse. */
  readonly potential: number;
  /** `marketFare` aller Klassen des Paars (4.3). */
  readonly marketFares: ClassFigures;
  /** Alle Strecken der eigenen Gesellschaft auf dem Paar, Preise in $ (`routeFares`). */
  readonly ownRoutes: readonly OfferRoute[];
  /** Die Strecke, um deren Preis es geht; muss in `ownRoutes` stehen. */
  readonly routeId: string;
  /**
   * Übrige Felder der eigenen Anziehung (3.9): Satisfaction, Bezugs-Flugzeit, Ruf, Alter, Werbung usw.
   * Abflüge, Preis, Marktpreis und Flugzeit kommen aus dem Direktangebot (`directOffer`).
   */
  readonly appeal: Omit<OfferAppealInput, 'frequency' | 'fare' | 'marketFare' | 'blockMinutes'>;
  /**
   * Alle anderen Angebote des Markts in dieser Klasse (Rivalen, Umsteige-Verbindungen) mit ihrer Anziehung
   * beim heutigen Preis; sie bleiben fest (keine Reaktion). Ids dürfen nicht `OWN_OFFER_ID` sein.
   */
  readonly otherOffers: readonly SplitOffer[];
}

/** Id des eigenen Angebots in `routeClassPassengers`. */
export const OWN_OFFER_ID = 'own';

/**
 * Direktgäste einer Strecke in einer Klasse je Woche, wenn sie das Preisniveau `fareRatio` hat und alles
 * andere bleibt: Direktangebot der Gesellschaft (3.8), Anziehung (3.9), Aufteilung mit allen Angeboten,
 * Sitz-Grenze und Überlauf (3.11), **eigener Anlauf = 1** (volle Nachfrage), verteilt nach Sitzen (3.11
 * Schritt 4). Umsteiger bleiben außen vor. SPEZIFIKATION 4.10.
 */
export function routeClassPassengers(market: RouteClassMarket, fareRatio: number): number {
  const { cabinClass, marketFares: fares, routeId } = market;
  if (!market.ownRoutes.some((route) => route.id === routeId)) {
    throw new Error(`routeClassPassengers: Strecke ${routeId} fehlt in ownRoutes`);
  }
  const fare = fareRatio * fares[cabinClass];
  const routes = market.ownRoutes.map((route) =>
    route.id === routeId ? { ...route, fare: { ...route.fare, [cabinClass]: fare } } : route,
  );
  const offer = directOffer(routes, fares);
  const seats = offer.seats[cabinClass];
  if (seats <= 0) return 0;

  const appeal = offerAppeal(cabinClass, {
    ...market.appeal,
    frequency: offer.frequency,
    fare: offer.fare[cabinClass],
    marketFare: fares[cabinClass],
    blockMinutes: offer.blockMinutes,
  });
  const split = marketSplit({
    potential: market.potential,
    noFlyAppeal: noFlyAppeal(cabinClass),
    offers: [{ id: OWN_OFFER_ID, appeal, seats, ramp: 1 }, ...market.otherOffers],
  });

  const weeklySeats: Record<string, number> = {};
  for (const route of routes) weeklySeats[route.id] = (route.seatsPerFlight[cabinClass] ?? 0) * route.departuresPerWeek;
  return distributeToRoutes(split.passengers[OWN_OFFER_ID], weeklySeats)[routeId];
}

/** Ergebnis von `bestFare`. */
export interface BestFareResult {
  /** `fareRatio*`. */
  readonly fareRatio: number;
  /** Bester Preis in $: `fareRatio* × marketFare`. */
  readonly fare: number;
  /** Direktgäste der Strecke in der Klasse je Woche bei diesem Preis. */
  readonly passengers: number;
  /** `passengers × (fare − costPerPassenger)`. */
  readonly profit: number;
}

/**
 * Gewinnbester Preis einer Strecke in einer Klasse (Erlös minus Kosten je Fluggast; ohne Kosten der
 * erlösbeste), alles andere fest. Planer („Best fare“, „Set best fares“) und KI-Planung nutzen ihn.
 * SPEZIFIKATION 4.10.
 *
 * @param costPerPassenger `costPerPassenger(route, c)` aus Abschnitt 5 (bis Paket 3.5 als Eingabe).
 */
export function bestFare(market: RouteClassMarket, costPerPassenger = 0): BestFareResult {
  const marketFareValue = market.marketFares[market.cabinClass];
  const fareRatio = bestFareRatio((ratio) => routeClassPassengers(market, ratio), marketFareValue, costPerPassenger);
  const fare = fareRatio * marketFareValue;
  const passengers = routeClassPassengers(market, fareRatio);
  return { fareRatio, fare, passengers, profit: passengers * (fare - costPerPassenger) };
}

// ---------------------------------------------------------------------------
// 4.11 Gewinnschwelle
// ---------------------------------------------------------------------------

/** Eine Klasse einer Strecke für die Gewinnschwelle. */
export interface BreakEvenClass {
  /** Sitze in der Klasse × Flüge je Woche (beide Richtungen). */
  readonly seatsPerWeek: number;
  /** `marketFare` der Klasse (4.3). */
  readonly marketFare: number;
  /** `costPerPassenger(route, c)` (Abschnitt 5). */
  readonly costPerPassenger: number;
}

/**
 * Preisniveau (für alle Klassen gleich, wie „Adjust All“), das die Kosten der Strecke bei Auslastung
 * `loadFactor` (0 < L ≤ 1, gleich in allen Klassen) genau deckt:
 * `(fixedWeeklyCost + Σ c: costPerPassenger × L × seatsPerWeek) / (L × Σ c: seatsPerWeek × marketFare)`.
 * Preis je Klasse an der Schwelle = Ergebnis × `marketFare(c)`. SPEZIFIKATION 4.11.
 *
 * @param fixedWeeklyCost Kosten je Woche, die nicht von den Fluggästen abhängen (Abschnitt 5).
 */
export function breakEvenFareLevel(
  loadFactor: number,
  fixedWeeklyCost: number,
  classes: Readonly<Partial<Record<CabinClass, BreakEvenClass>>>,
): number {
  let passengerCost = 0;
  let fullRevenue = 0;
  for (const cabinClass of CABIN_CLASSES) {
    const figures = classes[cabinClass];
    if (!figures) continue;
    passengerCost += figures.costPerPassenger * loadFactor * figures.seatsPerWeek;
    fullRevenue += figures.seatsPerWeek * figures.marketFare;
  }
  return (fixedWeeklyCost + passengerCost) / (loadFactor * fullRevenue);
}

// ---------------------------------------------------------------------------
// 4.12 Planer-Zahlen (ohne Kosten)
// ---------------------------------------------------------------------------

/** Auslastung: Fluggäste / Sitze; ohne Sitze 0. Für die Gewinnschwelle bei erwarteter Auslastung. SPEZIFIKATION 4.11, 4.12. */
export function loadFactor(passengers: number, seats: number): number {
  return seats > 0 ? passengers / seats : 0;
}

/**
 * Erlös der Nebenzahl „Full aircraft at market fare“: `Σ c: Sitze je Woche × marketFare`. Hängt nicht vom
 * eingestellten Preis ab; nur Vergleich, „not expected“ (E26). Die Kosten bei voller Maschine zieht der
 * Aufrufer ab (Abschnitt 5). SPEZIFIKATION 4.12.
 */
export function fullAircraftRevenue(seatsPerWeek: PartialClassFigures, marketFareValues: ClassFigures): number {
  let total = 0;
  for (const cabinClass of CABIN_CLASSES) total += (seatsPerWeek[cabinClass] ?? 0) * marketFareValues[cabinClass];
  return total;
}
