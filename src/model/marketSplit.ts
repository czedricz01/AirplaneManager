/**
 * Aufteilung eines Markts auf seine Angebote: SPEZIFIKATION 3.8–3.12 und 3.14.
 *
 * Ein Markt ist ein Städtepaar mit einer Klasse. Alle Angebote darin (Direktangebote und
 * Umsteige-Verbindungen aller Gesellschaften) und „Nicht fliegen“ werden **einmal gemeinsam**
 * nach ihrer Anziehung aufgeteilt (R1). Danach folgen Anlauf, Sitz-Grenze und Überlauf.
 *
 * Eingaben aus anderen Abschnitten kommen als fertige Zahlen (F14): `satisfactionFactor`
 * (`satisfaction.ts`, 2.10, aus `offerSatisfaction` 2.8), Marktpreis (Abschnitt 4, Paket 3.4), Forschung,
 * Krisen-Antwort und Schwierigkeit als Faktoren.
 *
 * Alle Mengen sind Fluggäste je Woche, beide Richtungen zusammen, ungerundet (R4).
 */

import { clamp, clampScale } from './basics';
import {
  ADVERTISING_BOOST,
  ADVERTISING_MAX,
  CABIN_CLASSES,
  ESTABLISHED_BONUS_MAX,
  ESTABLISHED_FROM,
  ESTABLISHED_TO,
  FF_MAX,
  FF_PER_MONTH,
  FF_START,
  FLIGHT_TIME_EXP,
  FREQUENCY_EXP,
  PRICE_SENSITIVITY,
  RAMP_MONTHS,
  RAMP_START,
  REFERENCE_FREQUENCY,
  REPUTATION_DEMAND_SLOPE,
  type CabinClass,
  type CampaignTier,
} from './constants';

// ---------------------------------------------------------------------------
// 3.8 Angebote eines Markts
// ---------------------------------------------------------------------------

/** Eine Strecke einer Gesellschaft auf dem Paar, so weit das Direktangebot sie braucht. */
export interface OfferRoute {
  readonly id: string;
  /** Sitze je Flug in jeder Klasse; fehlende Klasse = 0. */
  readonly seatsPerFlight: Readonly<Partial<Record<CabinClass, number>>>;
  /**
   * Abflüge je Woche, **beide Richtungen zusammen**: täglich Hin und Zurück = 14,
   * ein täglicher Einweg-Umlauf = 7 (W14).
   */
  readonly departuresPerWeek: number;
  /** Preis je Klasse in Spiel-Dollar; fehlender Preis = Marktpreis (R8). */
  readonly fare?: Readonly<Partial<Record<CabinClass, number>>>;
  /** Flugzeit der Strecke (`blockMinutes`, 3.1). */
  readonly blockMinutes: number;
}

/** Kennzahlen eines Direktangebots (ohne Satisfaction, die aus 2.8 kommt). */
export interface DirectOfferFigures {
  /** `offerSeats(c)`: Sitze in `c` je Woche, beide Richtungen. */
  readonly seats: Readonly<Record<CabinClass, number>>;
  /** Abflüge je Richtung und Woche, für alle Klassen gleich. */
  readonly frequency: number;
  /** `offerFare(c)`: nach Sitzen in `c` gewichteter Preis; ohne Sitze in `c` der Marktpreis. */
  readonly fare: Readonly<Record<CabinClass, number>>;
  /** `offerBlockMinutes`: nach Sitzen je Woche (alle Klassen) gewichtete Flugzeit. */
  readonly blockMinutes: number;
}

/**
 * Kennzahlen des Direktangebots einer Gesellschaft = alle ihre Strecken auf dem Paar zusammen (3.8, R1).
 *
 * - Sitze: Sitze je Flug × Abflüge je Woche, summiert.
 * - Abflüge je Richtung: Summe der Abflüge / 2. Aufteilen derselben Flüge auf mehrere Strecken ändert
 *   nichts (W2).
 * - Preis: Mittel nach Sitzen in `c`; fehlender Preis = Marktpreis (R8).
 * - Flugzeit: Mittel nach Sitzen je Woche aller Klassen; ohne jeden Sitz das einfache Mittel (F15).
 *
 * @param marketFare Marktpreis je Klasse (Abschnitt 4), gleich für alle Angebote.
 */
export function directOffer(
  routes: readonly OfferRoute[],
  marketFare: Readonly<Record<CabinClass, number>>,
): DirectOfferFigures {
  if (routes.length === 0) throw new Error('directOffer: ein Direktangebot braucht mindestens eine Strecke');

  const seats = {} as Record<CabinClass, number>;
  const fare = {} as Record<CabinClass, number>;
  for (const cabinClass of CABIN_CLASSES) {
    let classSeats = 0;
    let fareSum = 0;
    for (const route of routes) {
      const weekly = (route.seatsPerFlight[cabinClass] ?? 0) * route.departuresPerWeek;
      classSeats += weekly;
      fareSum += weekly * (route.fare?.[cabinClass] ?? marketFare[cabinClass]);
    }
    seats[cabinClass] = classSeats;
    fare[cabinClass] = classSeats > 0 ? fareSum / classSeats : marketFare[cabinClass];
  }

  let departures = 0;
  let weightSum = 0;
  let blockSum = 0;
  for (const route of routes) {
    departures += route.departuresPerWeek;
    const weekly = CABIN_CLASSES.reduce((sum, c) => sum + (route.seatsPerFlight[c] ?? 0), 0) * route.departuresPerWeek;
    weightSum += weekly;
    blockSum += weekly * route.blockMinutes;
  }
  const blockMinutes =
    weightSum > 0 ? blockSum / weightSum : routes.reduce((sum, r) => sum + r.blockMinutes, 0) / routes.length;

  return { seats, frequency: departures / 2, fare, blockMinutes };
}

// ---------------------------------------------------------------------------
// 3.9.1 Abflüge
// ---------------------------------------------------------------------------

/**
 * `(frequency / REFERENCE_FREQUENCY) ^ FREQUENCY_EXP`: täglich (7 je Richtung) = 1.
 * `frequency` ist die Summe aller Abflüge der Gesellschaft auf dem Paar je Richtung (R1). SPEZIFIKATION 3.9.1.
 */
export function frequencyFactor(frequency: number): number {
  return (frequency / REFERENCE_FREQUENCY) ** FREQUENCY_EXP;
}

// ---------------------------------------------------------------------------
// 3.9.2 Preis und Satisfaction
// ---------------------------------------------------------------------------

/**
 * `(offerFare / (marketFare × satisfactionFactor)) ^ (−PRICE_SENSITIVITY[c])`.
 *
 * Die einzige Stelle, an der der Preis auf die Fluggäste wirkt (E13), und die einzige Wirkung der
 * Satisfaction im Markt (2.10): Satisfaction `s` und Preis `p` ziehen so stark an wie Satisfaction 100
 * und Preis `p / satisfactionFactor(s)`. SPEZIFIKATION 3.9.2.
 *
 * @param satisfactionFactorValue `satisfactionFactor(offerSatisfaction(c))` aus 2.10; 1 bei Satisfaction 100.
 */
export function priceFactor(
  cabinClass: CabinClass,
  offerFare: number,
  marketFare: number,
  satisfactionFactorValue: number,
): number {
  return (offerFare / (marketFare * satisfactionFactorValue)) ** -PRICE_SENSITIVITY[cabinClass];
}

// ---------------------------------------------------------------------------
// 3.9.3 Flugzeit
// ---------------------------------------------------------------------------

/**
 * `(offerBlockMinutes / referenceBlockMinutes) ^ (−FLIGHT_TIME_EXP)`: kürzere Reisezeit zieht spürbar
 * mehr an (E20); langsame Flugzeuge verlieren Anteil, der Markt wird nicht kleiner (W1). SPEZIFIKATION 3.9.3.
 */
export function flightTimeFactor(offerBlockMinutes: number, referenceMinutes: number): number {
  return (offerBlockMinutes / referenceMinutes) ** -FLIGHT_TIME_EXP;
}

// ---------------------------------------------------------------------------
// 3.9.4 Gesellschaft: Ruf, Frequent flyer
// ---------------------------------------------------------------------------

/**
 * `1 + REPUTATION_DEMAND_SLOPE × (reputation − 50)`: Ruf 50 = 1, 0 → 0,9, 100 → 1,1 (E36).
 * Spieler und KI (E44); Ruf vom Monatsanfang. Die einzige Wirkung des Rufs auf die Nachfrage. SPEZIFIKATION 3.9.4.
 */
export function reputationFactor(reputation: number): number {
  return 1 + REPUTATION_DEMAND_SLOPE * (reputation - 50);
}

/**
 * `1 + min(FF_MAX, FF_START + FF_PER_MONTH × (Laufmonate − 1))`, solange das Programm läuft; sonst 1.
 * Gilt für alle Angebote der Gesellschaft. Nur Spieler (Werbung, E44). SPEZIFIKATION 3.9.4.
 *
 * @param monthsRunning Laufmonate des Programms, der aktuelle mitgezählt (1 im ersten Monat);
 *   0 = läuft nicht (F16).
 */
export function frequentFlyerFactor(monthsRunning: number): number {
  if (monthsRunning < 1) return 1;
  return 1 + Math.min(FF_MAX, FF_START + FF_PER_MONTH * (monthsRunning - 1));
}

// ---------------------------------------------------------------------------
// 3.9.5 Werbung
// ---------------------------------------------------------------------------

/**
 * Werbe-Faktor einer Region: `1 + Summe der laufenden Kampagnen`, höchstens `ADVERTISING_MAX`.
 * SPEZIFIKATION 3.9.5.
 *
 * @param runningTiers Stufen aller Kampagnen, die in diesem Monat laufen und die Region abdecken
 *   (eine globale deckt jede Region ab).
 */
export function advertisingRegionFactor(runningTiers: readonly CampaignTier[]): number {
  const boost = runningTiers.reduce((sum, tier) => sum + ADVERTISING_BOOST[tier], 0);
  return Math.min(ADVERTISING_MAX, 1 + boost);
}

/**
 * Mittel der Werbe-Faktoren beider Enden. Wirkt nur, solange die Kampagne läuft (E37), nur auf die
 * Anziehung des Werbenden; nur Spieler (E44). SPEZIFIKATION 3.9.5.
 */
export function advertisingFactor(regionFactorA: number, regionFactorB: number): number {
  return (regionFactorA + regionFactorB) / 2;
}

// ---------------------------------------------------------------------------
// 3.9.6 Established route bonus
// ---------------------------------------------------------------------------

/**
 * `1 + ESTABLISHED_BONUS_MAX × kappen((offerAgeMonths − 24) / (48 − 24), 0, 1)`.
 * Spieler und KI (E44). SPEZIFIKATION 3.9.6.
 */
export function establishedRouteBonus(offerAgeMonths: number): number {
  return (
    1 +
    ESTABLISHED_BONUS_MAX *
      clamp((offerAgeMonths - ESTABLISHED_FROM) / (ESTABLISHED_TO - ESTABLISHED_FROM), 0, 1)
  );
}

// ---------------------------------------------------------------------------
// 3.9 Anziehung
// ---------------------------------------------------------------------------

/** Eingaben für `offerAppeal` eines Angebots in einer Klasse. */
export interface OfferAppealInput {
  /** Abflüge je Richtung und Woche (3.8; bei Verbindungen machbare Anschlüsse, 3.13). */
  readonly frequency: number;
  /** `offerFare(c)`. */
  readonly fare: number;
  /** `marketFare(c)` des Paars (Abschnitt 4). */
  readonly marketFare: number;
  /**
   * `satisfactionFactor(offerSatisfaction(c))` aus `satisfaction.ts` (2.8, 2.10); Standard 1 (Satisfaction 100).
   * Für Umsteige-Verbindungen mit `connectionOfferSatisfaction`.
   */
  readonly satisfactionFactor?: number;
  /** `offerBlockMinutes`. */
  readonly blockMinutes: number;
  /** `referenceBlockMinutes` des Paars (3.1). */
  readonly referenceBlockMinutes: number;
  /** Ruf der Gesellschaft vom Monatsanfang; Standard 50. */
  readonly reputation?: number;
  /** `offerAgeMonths`; Standard 0. Verbindungen haben keinen Bonus (wie Anlauf, 3.12): 0 lassen. */
  readonly ageMonths?: number;
  /** `advertisingFactor` (3.9.5); Standard 1. Nur Spieler. */
  readonly advertisingFactor?: number;
  /** `frequentFlyerFactor` (3.9.4); Standard 1. Nur Spieler. */
  readonly frequentFlyerFactor?: number;
  /** `researchDemandFactor` = Produkt der Felder `demandFactor` fertiger Projekte (6.9); Standard 1. Nur Spieler. */
  readonly researchDemandFactor?: number;
  /** `crisisResponseFactor` (3.9.7, Abschnitt 8); Standard 1. */
  readonly crisisResponseFactor?: number;
  /** `difficultyFactor` (1.8); Standard 1. Nur Spieler-Angebote (E53). */
  readonly difficultyFactor?: number;
  /** `connectionFactor` (3.13); Standard 1. Nur Umsteige-Verbindungen. */
  readonly connectionFactor?: number;
}

/** Alle Faktoren der Anziehung, für Anzeige und Tests. */
export interface OfferAppealParts {
  readonly frequencyFactor: number;
  readonly priceFactor: number;
  readonly flightTimeFactor: number;
  readonly reputationFactor: number;
  readonly establishedRouteBonus: number;
  readonly advertisingFactor: number;
  readonly frequentFlyerFactor: number;
  readonly researchDemandFactor: number;
  readonly crisisResponseFactor: number;
  readonly difficultyFactor: number;
  readonly connectionFactor: number;
  /** Produkt aller Faktoren; 1 = Bezugsangebot (3.9.0). */
  readonly appeal: number;
}

/**
 * Anziehung mit allen Faktoren (ein Produkt; jeder Faktor wirkt nur hier, R2). Ungerundet, nicht
 * gekappt (R4). SPEZIFIKATION 3.9.
 */
export function offerAppealParts(cabinClass: CabinClass, input: OfferAppealInput): OfferAppealParts {
  const parts = {
    frequencyFactor: frequencyFactor(input.frequency),
    priceFactor: priceFactor(cabinClass, input.fare, input.marketFare, input.satisfactionFactor ?? 1),
    flightTimeFactor: flightTimeFactor(input.blockMinutes, input.referenceBlockMinutes),
    reputationFactor: reputationFactor(input.reputation ?? 50),
    establishedRouteBonus: establishedRouteBonus(input.ageMonths ?? 0),
    advertisingFactor: input.advertisingFactor ?? 1,
    frequentFlyerFactor: input.frequentFlyerFactor ?? 1,
    researchDemandFactor: input.researchDemandFactor ?? 1,
    crisisResponseFactor: input.crisisResponseFactor ?? 1,
    difficultyFactor: input.difficultyFactor ?? 1,
    connectionFactor: input.connectionFactor ?? 1,
  };
  const appeal = Object.values(parts).reduce((product, factor) => product * factor, 1);
  return { ...parts, appeal };
}

/**
 * Wie stark ein Angebot Fluggäste einer Klasse anzieht; 1 = Bezugsangebot (3.9.0). SPEZIFIKATION 3.9.
 */
export function offerAppeal(cabinClass: CabinClass, input: OfferAppealInput): number {
  return offerAppealParts(cabinClass, input).appeal;
}

// ---------------------------------------------------------------------------
// 3.10 Nicht fliegen und Potenzial
// ---------------------------------------------------------------------------

/**
 * Anziehung von „Nicht fliegen“: `1 / (PRICE_SENSITIVITY[c] − 1)`. Folgt aus 3.9.2: Nur so ist das
 * Bezugsangebot ohne Rivalen erlösbest am Marktpreis (E24). Keine eigene Stellschraube. SPEZIFIKATION 3.10.
 */
export function noFlyAppeal(cabinClass: CabinClass): number {
  return 1 / (PRICE_SENSITIVITY[cabinClass] - 1);
}

/**
 * Alle Reisewilligen einer Klasse:
 * `marketSize × classShare(c) × PRICE_SENSITIVITY[c] / (PRICE_SENSITIVITY[c] − 1)`.
 * So fliegen beim Bezugsangebot allein genau `marketSize × classShare(c)`. SPEZIFIKATION 3.10.
 */
export function classPotential(cabinClass: CabinClass, marketSizeValue: number, classShareValue: number): number {
  const sensitivity = PRICE_SENSITIVITY[cabinClass];
  return (marketSizeValue * classShareValue * sensitivity) / (sensitivity - 1);
}

// ---------------------------------------------------------------------------
// 3.12 Anlauf
// ---------------------------------------------------------------------------

/**
 * `start + (1 − start) × kappen(offerAgeMonths / RAMP_MONTHS, 0, 1)` mit `start = RAMP_START + rampBonus`.
 * Wirkt in `marketSplit` **nach** der Wahl, nicht auf die Anziehung. Gilt je Angebot, nicht je Strecke;
 * Umsteige-Verbindungen haben keinen Anlauf. Spieler und KI (E44). SPEZIFIKATION 3.12.
 *
 * @param rampBonus Feld `rampBonus` fertiger Forschung (6.9; „Route planning suite“ = `RAMP_RESEARCH_BONUS`).
 */
export function rampFactor(offerAgeMonths: number, rampBonus = 0): number {
  const start = RAMP_START + rampBonus;
  return start + (1 - start) * clamp(offerAgeMonths / RAMP_MONTHS, 0, 1);
}

// ---------------------------------------------------------------------------
// 3.11 Aufteilung
// ---------------------------------------------------------------------------

/** Ein Angebot, wie die Aufteilung es sieht. */
export interface SplitOffer {
  /** Eindeutig im Markt. */
  readonly id: string;
  /** `offerAppeal` in dieser Klasse (≥ 0). */
  readonly appeal: number;
  /**
   * Sitze in dieser Klasse je Woche, beide Richtungen. `Infinity` = keine Grenze in diesem Schritt
   * (Umsteige-Verbindungen, 3.13). Ohne Sitze (≤ 0) nimmt das Angebot nicht teil (3.7).
   */
  readonly seats: number;
  /** `rampFactor` (3.12); Standard 1. */
  readonly ramp?: number;
}

/** Eingaben für `marketSplit`: ein Markt (Paar und Klasse). */
export interface MarketSplitInput {
  /** `classPotential` (3.10). */
  readonly potential: number;
  /** `noFlyAppeal` der Klasse (3.10). */
  readonly noFlyAppeal: number;
  readonly offers: readonly SplitOffer[];
}

/** Ergebnis der Aufteilung eines Markts. */
export interface MarketSplitResult {
  /** Schritt 1: Anteil an allen Reisewilligen je teilnehmendem Angebot (vor Anlauf und Sitz-Grenze). */
  readonly choiceShare: Readonly<Record<string, number>>;
  /** Schritt 1: Anteil von „Nicht fliegen“. Mit `choiceShare` zusammen genau 1. */
  readonly noFlyShare: number;
  /** Schritt 1: `Wunsch(o) = potential × choiceShare(o)`. */
  readonly wish: Readonly<Record<string, number>>;
  /** Fluggäste je Woche nach Anlauf, Sitz-Grenze und Überlauf; 0 für nicht teilnehmende Angebote. */
  readonly passengers: Readonly<Record<string, number>>;
  /** Angebote, deren Sitze voll sind. */
  readonly full: readonly string[];
  /** Reisewillige, die nicht fliegen (gewählt, wegen Anlauf, oder übergelaufen ohne Platz). */
  readonly notFlying: number;
}

/**
 * Wie viele Fluggäste je Woche jedes Angebot eines Markts bekommt. Eine Funktion je Markt und Klasse
 * für alle Angebote (R1); Planer, Monatsabschluss, KI-Planung und Bericht nutzen sie (R2).
 *
 * 1. Wahl: `Wunsch(o) = potential × appeal(o) / (Σ appeal + noFlyAppeal)`.
 * 2. Anlauf: `× ramp(o)`; wer wegen des Anlaufs fehlt, fliegt nicht.
 * 3. Sitz-Grenze und Überlauf: Wer keinen Sitz bekommt, wählt neu unter den Angeboten mit freien
 *    Sitzen und „Nicht fliegen“ (nach Anziehung, wieder mit Anlauf, F17). Alle vollen Angebote einer
 *    Runde werden zugleich begrenzt; daher hängt das Ergebnis nicht von der Reihenfolge ab.
 *
 * Schritt 4 (auf Strecken verteilen) macht `distributeToRoutes`. Ungerundet (R4). SPEZIFIKATION 3.11.
 */
export function marketSplit(input: MarketSplitInput): MarketSplitResult {
  const { potential } = input;
  const ids = new Set<string>();
  for (const offer of input.offers) {
    if (ids.has(offer.id)) throw new Error(`marketSplit: Angebot ${offer.id} doppelt`);
    ids.add(offer.id);
  }
  const taking = input.offers.filter((offer) => offer.seats > 0);

  const passengers: Record<string, number> = {};
  for (const offer of input.offers) passengers[offer.id] = 0;

  // Schritt 1: Wahl.
  const totalAppeal = taking.reduce((sum, offer) => sum + offer.appeal, 0) + input.noFlyAppeal;
  const choiceShare: Record<string, number> = {};
  const wish: Record<string, number> = {};
  for (const offer of taking) {
    choiceShare[offer.id] = offer.appeal / totalAppeal;
    wish[offer.id] = potential * choiceShare[offer.id];
  }

  // Schritte 2 und 3: Anlauf, Sitz-Grenze, Überlauf. Je Runde wird mindestens ein Angebot voll,
  // daher höchstens so viele Runden wie Angebote (+ 1 ohne Überlauf).
  const open = new Set(taking);
  const full: string[] = [];
  let choosing = potential;
  for (let round = 0; round <= taking.length && choosing > 0; round++) {
    const denominator = [...open].reduce((sum, offer) => sum + offer.appeal, 0) + input.noFlyAppeal;
    for (const offer of open) {
      passengers[offer.id] += (choosing * offer.appeal * (offer.ramp ?? 1)) / denominator;
    }
    choosing = 0;
    for (const offer of [...open]) {
      if (passengers[offer.id] > offer.seats) {
        choosing += passengers[offer.id] - offer.seats;
        passengers[offer.id] = offer.seats;
        open.delete(offer);
        full.push(offer.id);
      }
    }
  }

  const flying = Object.values(passengers).reduce((sum, value) => sum + value, 0);
  return {
    choiceShare,
    noFlyShare: input.noFlyAppeal / totalAppeal,
    wish,
    passengers,
    full: full.sort(),
    notFlying: potential - flying,
  };
}

/**
 * Schritt 4: Die Fluggäste eines Direktangebots in `c` verteilen sich auf seine Strecken **nach Sitzen
 * in `c` je Woche** (Vorgabe aus 2.8); jede Strecke hat dieselbe Auslastung in `c`. SPEZIFIKATION 3.11.
 *
 * @param weeklySeatsByRoute Sitze in `c` je Woche je Strecke (Schlüssel: Strecken-Id).
 */
export function distributeToRoutes(
  passengers: number,
  weeklySeatsByRoute: Readonly<Record<string, number>>,
): Record<string, number> {
  const total = Object.values(weeklySeatsByRoute).reduce((sum, seats) => sum + seats, 0);
  const result: Record<string, number> = {};
  for (const [id, seats] of Object.entries(weeklySeatsByRoute)) {
    result[id] = total > 0 ? (passengers * seats) / total : 0;
  }
  return result;
}

// ---------------------------------------------------------------------------
// 3.14 Passenger share und Departure share
// ---------------------------------------------------------------------------

/**
 * Passenger share: Fluggäste einer Gesellschaft auf dem Paar (alle Klassen, direkt und Umsteiger) /
 * Fluggäste aller Gesellschaften. „Nicht fliegen“ zählt nicht. Ohne Fluggäste 0. Nur Anzeige. SPEZIFIKATION 3.14.
 */
export function passengerShare(ownPassengers: number, allPassengers: number): number {
  if (allPassengers <= 0) return 0;
  return clampScale('passengerShare', ownPassengers / allPassengers);
}

/**
 * Departure share: Abflüge je Woche einer Gesellschaft auf dem Paar / Abflüge aller Gesellschaften
 * (nur Direktflüge). Ohne Abflüge 0. Nur Anzeige und Chronik. SPEZIFIKATION 3.14.
 */
export function departureShare(ownDepartures: number, allDepartures: number): number {
  if (allDepartures <= 0) return 0;
  return clampScale('departureShare', ownDepartures / allDepartures);
}
