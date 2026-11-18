/**
 * Umsteige-Verbindungen: SPEZIFIKATION 3.13.
 *
 * Eine Gesellschaft bietet zwischen O und D eine Reise mit Umstieg an ihrem Drehkreuz H an. Die
 * Verbindung ist ein Angebot im Markt O–D und wird mit allen anderen in `marketSplit` aufgeteilt
 * (R1, W9), mit derselben Marktgröße wie die Direktrechnung. Danach kommen ihre Fluggäste auf die
 * freien Sitze der Teilstrecken (`allocateTransferSeats`).
 *
 * Welche Gesellschaft welche Strecken und Drehkreuze hat, ob sie das Paar direkt bedient und die
 * Fahrpläne liefert der Aufrufer (F18). Hier stehen nur die Regeln.
 */

import {
  CABIN_CLASSES,
  CONNECTION_APPEAL,
  HUB_QUALITY_BASE,
  HUB_QUALITY_EXTRA_LEVEL,
  HUB_QUALITY_PER_EXTRA,
  HUB_QUALITY_PER_LEVEL,
  MAX_CONNECTION,
  MAX_DETOUR,
  MINUTES_PER_WEEK,
  MIN_CONNECTION,
  TRANSFER_FARE_SHARE,
  type CabinClass,
} from './constants';

// ---------------------------------------------------------------------------
// Umweg und Anschlüsse
// ---------------------------------------------------------------------------

/** Umweg: `(Entfernung O–H + H–D) / Entfernung O–D`. SPEZIFIKATION 3.13. */
export function detourRatio(kmOriginHub: number, kmHubDestination: number, kmOriginDestination: number): number {
  return (kmOriginHub + kmHubDestination) / kmOriginDestination;
}

/**
 * Wartezeit am Drehkreuz in Minuten von einer Ankunft bis zu einem Abflug, über das Wochenende hinweg
 * (Minuten der Woche, Montag 00:00 = 0). Ergebnis 0 … `MINUTES_PER_WEEK`.
 */
export function connectionWait(arrivalMinute: number, departureMinute: number): number {
  return (((departureMinute - arrivalMinute) % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
}

/** Ob ein Umstieg machbar ist: Wartezeit `MIN_CONNECTION` … `MAX_CONNECTION`. SPEZIFIKATION 3.13. */
export function isFeasibleConnection(arrivalMinute: number, departureMinute: number): boolean {
  const wait = connectionWait(arrivalMinute, departureMinute);
  return wait >= MIN_CONNECTION && wait <= MAX_CONNECTION;
}

/** Machbare Anschlüsse einer Richtung. */
export interface ConnectionSummary {
  /** Ankünfte in H mit mindestens einem machbaren Anschluss (jede zählt einmal). */
  readonly count: number;
  /** Summe der kürzesten machbaren Wartezeit je gezählter Ankunft, Minuten. */
  readonly waitMinutesSum: number;
}

/**
 * Machbare Anschlüsse einer Richtung: Jeder ankommende Flug in H zählt einmal, wenn er einen machbaren
 * Anschluss hat; seine Wartezeit ist die kürzeste machbare (F19). SPEZIFIKATION 3.13.
 *
 * @param arrivals Ankünfte in H vom Start der Richtung, Minuten der Woche.
 * @param departures Abflüge von H zum Ziel der Richtung, Minuten der Woche.
 */
export function connections(arrivals: readonly number[], departures: readonly number[]): ConnectionSummary {
  let count = 0;
  let waitMinutesSum = 0;
  for (const arrival of arrivals) {
    let shortest = Number.POSITIVE_INFINITY;
    for (const departure of departures) {
      if (isFeasibleConnection(arrival, departure)) shortest = Math.min(shortest, connectionWait(arrival, departure));
    }
    if (shortest !== Number.POSITIVE_INFINITY) {
      count += 1;
      waitMinutesSum += shortest;
    }
  }
  return { count, waitMinutesSum };
}

// ---------------------------------------------------------------------------
// Drehkreuz-Güte und Anziehung
// ---------------------------------------------------------------------------

/** Was ein Drehkreuz für die Güte hat. */
export interface HubFacilities {
  /** Verwaltungsstufe 0 … 3. */
  readonly level: number;
  readonly lounge?: boolean;
  readonly catering?: boolean;
}

/**
 * Wie gut ein Flughafen zum Umsteigen ist:
 * `min(1, 0,4 + 0,15 × Stufe + 0,05 je Extra (Stufe 3, Lounge, Catering)) × researchFactor`.
 * SPEZIFIKATION 3.13.
 *
 * @param researchFactor Feld `hubQualityFactor` fertiger Forschung (6.9; „Alliance“ = `HUB_QUALITY_RESEARCH_FACTOR`).
 */
export function hubQuality(hub: HubFacilities, researchFactor = 1): number {
  const extras =
    (hub.level >= HUB_QUALITY_EXTRA_LEVEL ? 1 : 0) + (hub.lounge ? 1 : 0) + (hub.catering ? 1 : 0);
  return Math.min(1, HUB_QUALITY_BASE + HUB_QUALITY_PER_LEVEL * hub.level + HUB_QUALITY_PER_EXTRA * extras) * researchFactor;
}

/** Zusätzlicher Faktor in der Anziehung einer Verbindung: `CONNECTION_APPEAL × hubQuality`. SPEZIFIKATION 3.13. */
export function connectionFactor(hubQualityValue: number): number {
  return CONNECTION_APPEAL * hubQualityValue;
}

/**
 * Preis einer Verbindung in `c`: `TRANSFER_FARE_SHARE × marketFare(c)` des Paars **O–D** (E25).
 * Zugleich `offerFare` der Verbindung. SPEZIFIKATION 3.13, 4.8.
 */
export function transferFare(marketFareOriginDestination: number): number {
  return TRANSFER_FARE_SHARE * marketFareOriginDestination;
}

/** Klassen einer Verbindung: nur Klassen, in denen beide Teilstrecken Sitze haben. SPEZIFIKATION 3.13. */
export function transferClasses(
  seatsOriginHub: Readonly<Partial<Record<CabinClass, number>>>,
  seatsHubDestination: Readonly<Partial<Record<CabinClass, number>>>,
): CabinClass[] {
  return CABIN_CLASSES.filter((c) => (seatsOriginHub[c] ?? 0) > 0 && (seatsHubDestination[c] ?? 0) > 0);
}

// ---------------------------------------------------------------------------
// Kennzahlen einer Verbindung (3.8)
// ---------------------------------------------------------------------------

/** Eingaben für `transferOffer`. */
export interface TransferOfferInput {
  readonly kmOriginHub: number;
  readonly kmHubDestination: number;
  readonly kmOriginDestination: number;
  /** `blockMinutes` der Teilstrecke O–H. */
  readonly blockMinutesOriginHub: number;
  /** `blockMinutes` der Teilstrecke H–D. */
  readonly blockMinutesHubDestination: number;
  /** Richtung O → D: Ankünfte in H aus O und Abflüge von H nach D (Minuten der Woche). */
  readonly outbound: { readonly arrivals: readonly number[]; readonly departures: readonly number[] };
  /** Richtung D → O: Ankünfte in H aus D und Abflüge von H nach O (Minuten der Woche). */
  readonly inbound: { readonly arrivals: readonly number[]; readonly departures: readonly number[] };
}

/** Kennzahlen einer Verbindung (ohne Satisfaction, Preis und Anziehung). */
export interface TransferOfferFigures {
  readonly detour: number;
  /** Machbare Anschlüsse je Woche und Richtung, Mittel beider Richtungen. */
  readonly frequency: number;
  /** Mittlere Wartezeit aller machbaren Anschlüsse beider Richtungen, Minuten. */
  readonly meanWaitMinutes: number;
  /** `offerBlockMinutes`: O–H + H–D + mittlere Wartezeit. Der Umweg kostet so über `flightTimeFactor`. */
  readonly blockMinutes: number;
}

/**
 * Kennzahlen einer Umsteige-Verbindung, oder `null`, wenn es keine gibt (Umweg über `MAX_DETOUR` oder
 * kein machbarer Anschluss in beiden Richtungen). SPEZIFIKATION 3.13.
 *
 * Nicht hier geprüft (Aufrufer, F18): Strecken O–H und H–D derselben Gesellschaft, H ist ihr Drehkreuz,
 * sie bedient O–D nicht direkt.
 */
export function transferOffer(input: TransferOfferInput): TransferOfferFigures | null {
  const detour = detourRatio(input.kmOriginHub, input.kmHubDestination, input.kmOriginDestination);
  if (detour > MAX_DETOUR) return null;
  const out = connections(input.outbound.arrivals, input.outbound.departures);
  const back = connections(input.inbound.arrivals, input.inbound.departures);
  const count = out.count + back.count;
  if (count === 0) return null;
  const meanWaitMinutes = (out.waitMinutesSum + back.waitMinutesSum) / count;
  return {
    detour,
    frequency: count / 2,
    meanWaitMinutes,
    blockMinutes: input.blockMinutesOriginHub + input.blockMinutesHubDestination + meanWaitMinutes,
  };
}

// ---------------------------------------------------------------------------
// Sitze der Umsteiger
// ---------------------------------------------------------------------------

/** Was eine Verbindung in einer Klasse nach der Aufteilung (3.11) an Fluggästen bekommen hat. */
export interface TransferDemand {
  /** Eindeutig über alle Verbindungen und Klassen. */
  readonly id: string;
  /**
   * Schlüssel der freien Sitze beider Teilstrecken in dieser Klasse (z. B. `"<Strecken-Id>|business"`),
   * wie in `freeSeats`.
   */
  readonly legs: readonly [string, string];
  /** Fluggäste je Woche aus `marketSplit`. */
  readonly passengers: number;
  /** Tarif je Fluggast (`transferFare`); höchster zuerst. */
  readonly fare: number;
}

/** Ergebnis von `allocateTransferSeats`. */
export interface TransferAllocation {
  /** Fluggäste je Verbindung, die einen Sitz bekommen haben. */
  readonly placed: Readonly<Record<string, number>>;
  /** Freie Sitze danach. */
  readonly freeSeats: Readonly<Record<string, number>>;
}

/**
 * Nach der Aufteilung aller Märkte kommen die Umsteiger auf die **freien** Sitze derselben Klasse beider
 * Teilstrecken, höchster Tarif zuerst (bei gleichem Tarif nach Id). Wer keinen Platz findet, fliegt
 * nicht (kein zweiter Überlauf). Direktgäste haben Vorrang: `freeSeats` sind die Sitze nach ihnen.
 * Sitze je Strecke beide Richtungen zusammen (F20). SPEZIFIKATION 3.13.
 */
export function allocateTransferSeats(
  demands: readonly TransferDemand[],
  freeSeats: Readonly<Record<string, number>>,
): TransferAllocation {
  const free: Record<string, number> = { ...freeSeats };
  const placed: Record<string, number> = {};
  const order = [...demands].sort((a, b) => b.fare - a.fare || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const demand of order) {
    const [legA, legB] = demand.legs;
    const take = Math.max(0, Math.min(demand.passengers, free[legA] ?? 0, free[legB] ?? 0));
    placed[demand.id] = (placed[demand.id] ?? 0) + take;
    if (take > 0) {
      free[legA] -= take;
      free[legB] -= take;
    }
  }
  return { placed, freeSeats: free };
}
