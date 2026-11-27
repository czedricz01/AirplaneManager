/**
 * Nachfrage und Marktanteil: SPEZIFIKATION Abschnitt 3.
 *
 * Hier: Marktgröße (3.1–3.6) und Klassen-Anteil (3.7). Die Aufteilung auf die Angebote steht in
 * `marketSplit.ts` (3.8–3.12, 3.14) und `transfers.ts` (3.13).
 *
 * Alle Mengen sind Fluggäste je Woche, beide Richtungen zusammen, ungerundet (R4).
 * Die Marktgröße hängt nur von Städten, Entfernung, Zeit, Saison und Ereignissen ab,
 * nie von einer Gesellschaft, einem Flugzeug oder der Schwierigkeit (E13, E20, E53).
 */

import { airportsData, getAirportStats, type Airport } from '../data/airports';
import { clamp, timeOf, yearOf } from './basics';
import {
  BLOCK_ACCEL,
  BLOCK_DECEL,
  CABIN_CLASSES,
  CLASS_BASE,
  CLASS_BUSINESS_GAIN,
  CLASS_BUSINESS_REF,
  CLASS_TIME_FROM,
  CLASS_TIME_GAIN,
  CLASS_TIME_TO,
  DEMAND_GROWTH_1960_2019,
  DEMAND_GROWTH_LAST_YEAR,
  DEMAND_GROWTH_YEARS,
  DEMAND_SCALE,
  DISTANCE_EXP,
  DISTANCE_MIN,
  DISTANCE_REF,
  EARTH_RADIUS_KM,
  LINK_EXP,
  LINK_LARGE,
  LINK_SMALL,
  REFERENCE_SPEED,
  ROUTE_DETOUR,
  SEASON_BY_MONTH,
  START_YEAR,
  type CabinClass,
  type UpperCabinClass,
  type WorldRegion,
} from './constants';

// ---------------------------------------------------------------------------
// Eingaben
// ---------------------------------------------------------------------------

/** Ort eines Flughafens: [Breite, Länge] in Grad (wie `Airport.coords`). Breite < 0 = Südhalbkugel. */
export type Coords = readonly [lat: number, lon: number];

/**
 * Was die Marktgröße von einem Flughafen braucht: Lage und Stadtgrößen-Tabelle.
 * Passt zu `Airport` aus `src/data/airports.ts`.
 */
export interface MarketAirport {
  readonly coords: Coords;
  /** Tourismus und Geschäft je Jahr ab 1960, abwechselnd (wie `Airport.stats`). */
  readonly stats?: readonly number[] | null;
}

/** Stadtgröße eines Flughafens: Geschäft `G` und Tourismus `T`. SPEZIFIKATION 3.2. */
export interface CitySize {
  readonly business: number;
  readonly tourism: number;
}

// ---------------------------------------------------------------------------
// 3.1 Bezugs-Flugzeit
// ---------------------------------------------------------------------------

/** Großkreis-Entfernung zweier Orte in km (Haversine). SPEZIFIKATION 1.2. */
export function distanceKm(from: Coords, to: Coords): number {
  const rad = Math.PI / 180;
  const dLat = (to[0] - from[0]) * rad;
  const dLon = (to[1] - from[1]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(from[0] * rad) * Math.cos(to[0] * rad) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Flugzeit (Blockzeit) einer Richtung in Minuten, ungerundet.
 *
 * Geflogener Weg = Großkreis × `ROUTE_DETOUR`. Das Flugzeug beschleunigt mit `BLOCK_ACCEL` auf
 * `speedKmh`, fliegt den Rest mit `speedKmh` und bremst mit `BLOCK_DECEL` ab. Beschleunigen und
 * Bremsen dauern immer gleich lang, auch auf sehr kurzen Strecken (wie im Alt-Code
 * `getFlightDurationMinutes`, `src/lib/financeUtils.ts:192-220`, dort gerundet). SPEZIFIKATION 1.1, 3.1.
 *
 * @param greatCircleKm Großkreis-Entfernung in km (`distanceKm`).
 * @param speedKmh Reisegeschwindigkeit in km/h.
 */
export function blockMinutes(greatCircleKm: number, speedKmh: number): number {
  const flownKm = greatCircleKm * ROUTE_DETOUR;
  const accelHours = speedKmh / BLOCK_ACCEL;
  const accelKm = 0.5 * BLOCK_ACCEL * accelHours * accelHours;
  const decelHours = speedKmh / BLOCK_DECEL;
  const decelKm = 0.5 * BLOCK_DECEL * decelHours * decelHours;
  const cruiseHours = Math.max(0, flownKm - accelKm - decelKm) / speedKmh;
  return (accelHours + cruiseHours + decelHours) * 60;
}

/**
 * Bezugs-Flugzeit eines Paars: `blockMinutes` mit `REFERENCE_SPEED` (800 km/h).
 * Maß für die Entfernung, gleich für alle Gesellschaften und Ansichten, nie vom Flugzeug abhängig
 * (E20, W1). SPEZIFIKATION 3.1.
 */
export function referenceBlockMinutes(a: Coords, b: Coords): number {
  return blockMinutes(distanceKm(a, b), REFERENCE_SPEED);
}

// ---------------------------------------------------------------------------
// 3.2 Stadtgrößen und Verflechtung
// ---------------------------------------------------------------------------

/**
 * Stadtgröße eines Flughafens im Spielmonat `month`, stetig über die Zeit (R5):
 * gerade Linie zwischen den Tabellenwerten des Jahres und des Folgejahres, nach `timeOf(month)`.
 * Tabellenwerte und Fortschreibung nach dem Tabellenende wie im Alt-Code (`getAirportStats`,
 * `src/data/airports.ts:33-59`). SPEZIFIKATION 3.2.
 */
export function citySize(airport: MarketAirport, month: number): CitySize {
  const year = yearOf(month);
  const share = timeOf(month) - year;
  // `getAirportStats` liest nur `stats` und verändert nichts; der Typ dort ist nur nicht `readonly`.
  const source = { stats: airport.stats } as Airport;
  const now = getAirportStats(source, year);
  if (share === 0) return { business: now.business, tourism: now.tourism };
  const next = getAirportStats(source, year + 1);
  return {
    business: now.business + share * (next.business - now.business),
    tourism: now.tourism + share * (next.tourism - now.tourism),
  };
}

/** Summe der Stadtgrößen aller Flughäfen im Spielmonat `month`. SPEZIFIKATION 3.2. */
export function worldCitySize(month: number, airports: readonly MarketAirport[] = airportsData): CitySize {
  let business = 0;
  let tourism = 0;
  for (const airport of airports) {
    const size = citySize(airport, month);
    business += size.business;
    tourism += size.tourism;
  }
  return { business, tourism };
}

/**
 * Faktor vom Stadtgröße zum Weltanteil im Spielmonat `month`:
 * `ΣG(1960) / ΣG(jetzt)`, ebenso für den Tourismus, Summe über alle Flughäfen der Daten.
 * Im Januar 1960 beide 1.
 *
 * Einmal je Monat berechnen und an `relativeSize` und `marketSizeParts` weitergeben
 * (Summe über alle Flughäfen; F9). SPEZIFIKATION 3.2.
 */
export function worldScale(month: number, airports: readonly MarketAirport[] = airportsData): CitySize {
  const cached = airports === airportsData ? WORLD_SCALE_CACHE.get(month) : undefined;
  if (cached) return cached;
  const start = worldCitySize(0, airports);
  const now = worldCitySize(month, airports);
  const scale = { business: start.business / now.business, tourism: start.tourism / now.tourism };
  if (airports === airportsData) WORLD_SCALE_CACHE.set(month, scale);
  return scale;
}

/**
 * Zwischenspeicher von `worldScale` je Monat für die Flughäfen der Daten (reine Rechnung, gleiches Ergebnis; spart die
 * Summe über alle Flughäfen in jeder Planer-Rechnung der KI, Paket 3.9b).
 */
const WORLD_SCALE_CACHE = new Map<number, CitySize>();

/**
 * Weltanteil einer Stadt (Code-Name `relativeSize`): `Grel = G × ΣG(1960) / ΣG(jetzt)`, ebenso `Trel`.
 * Eine Stadt „wächst“ nur, wenn sie schneller wächst als die Welt; das allgemeine Wachstum kommt
 * allein aus `demandGrowth` (3.3). SPEZIFIKATION 3.2.
 *
 * @param world `worldScale(month)` desselben Monats.
 */
export function relativeSize(airport: MarketAirport, month: number, world: CitySize): CitySize {
  const size = citySize(airport, month);
  return { business: size.business * world.business, tourism: size.tourism * world.tourism };
}

/**
 * Verflechtung zweier Größen: `min(x, y)^LINK_SMALL × max(x, y)^LINK_LARGE`.
 * Die kleinere Stadt zählt stärker. SPEZIFIKATION 3.2.
 */
export function pairLinkage(x: number, y: number): number {
  return Math.min(x, y) ** LINK_SMALL * Math.max(x, y) ** LINK_LARGE;
}

/** Geschäfts-Verflechtung: `pair(Grel(A), Grel(B))`. SPEZIFIKATION 3.2. */
export function businessLinkage(a: CitySize, b: CitySize): number {
  return pairLinkage(a.business, b.business);
}

/**
 * Tourismus-Verflechtung: `(pair(Grel(A), Trel(B)) + pair(Grel(B), Trel(A))) / 2 × season`.
 * Geschäftsleute der einen Stadt reisen als Touristen in die andere. SPEZIFIKATION 3.2.
 *
 * @param season `seasonFactor` des Paars; 1 = ohne Saison.
 */
export function tourismLinkage(a: CitySize, b: CitySize, season = 1): number {
  return ((pairLinkage(a.business, b.tourism) + pairLinkage(b.business, a.tourism)) / 2) * season;
}

/** Anteil der zwei Enden auf der Südhalbkugel (Breite < 0): 0, 0,5 oder 1. SPEZIFIKATION 3.2. */
export function southernShare(a: Coords, b: Coords): number {
  return ((a[0] < 0 ? 1 : 0) + (b[0] < 0 ? 1 : 0)) / 2;
}

/**
 * Saison des Tourismus im Spielmonat `month` (0 = Januar): Monatstabelle `SEASON_BY_MONTH`
 * (0,88 … 1,15, Mittel ≈ 1). Die Südhalbkugel ist um 6 Monate versetzt, anteilig je Ende
 * (wie im Alt-Code `seasonFactor`, `src/lib/financeUtils.ts:297-302`). Wirkt nur auf den Tourismus.
 * SPEZIFIKATION 3.2.
 *
 * @param south `southernShare` des Paars, 0 … 1.
 */
export function seasonFactor(month: number, south = 0): number {
  const index = ((month % 12) + 12) % 12;
  const north = SEASON_BY_MONTH[index];
  const southern = SEASON_BY_MONTH[(index + 6) % 12];
  return north * (1 - south) + southern * south;
}

/**
 * Geschäftsanteil eines Paars: `businessLinkage / (businessLinkage + tourismLinkage ohne Saison)`,
 * 0 … 1. Ohne Saison, damit die Klassen-Aufteilung nicht mit dem Monat springt.
 * Ohne jede Verflechtung 0,5 (F12). SPEZIFIKATION 3.2.
 */
export function businessShare(a: CitySize, b: CitySize): number {
  const business = businessLinkage(a, b);
  const total = business + tourismLinkage(a, b);
  return total > 0 ? business / total : 0.5;
}

// ---------------------------------------------------------------------------
// 3.3 Nachfrage-Wachstum
// ---------------------------------------------------------------------------

/**
 * Wie viel mehr Menschen weltweit fliegen als 1960: Faktor, 1 im Januar 1960, `DEMAND_GROWTH_1960_2019` im Januar 2019.
 * `DEMAND_GROWTH_1960_2019 ^ ((timeOf(month) − 1960) / 59)`, Zeit begrenzt auf 1960 … 2100.
 * Die einzige Wachstumsregel der Nachfrage (E7, W8). SPEZIFIKATION 3.3.
 */
export function demandGrowth(month: number): number {
  const time = clamp(timeOf(month), START_YEAR, DEMAND_GROWTH_LAST_YEAR);
  return DEMAND_GROWTH_1960_2019 ** ((time - START_YEAR) / DEMAND_GROWTH_YEARS);
}

// ---------------------------------------------------------------------------
// 3.4 Entfernungs-Faktor
// ---------------------------------------------------------------------------

/**
 * Kurze Strecken haben mehr Fluggäste je Verflechtung als lange (E22, W13):
 * `(max(referenceBlockMinutes, 45) / 450) ^ −0,5`. 1 bei 450 min, sinkt ohne Untergrenze.
 * SPEZIFIKATION 3.4.
 */
export function distanceFactor(referenceMinutes: number): number {
  return (Math.max(referenceMinutes, DISTANCE_MIN) / DISTANCE_REF) ** -DISTANCE_EXP;
}

// ---------------------------------------------------------------------------
// 3.5 Ereignis-Faktor
// ---------------------------------------------------------------------------

/** Was die Marktgröße von einem laufenden Ereignis braucht. */
export interface DemandEvent {
  /** Faktor auf die Reiselust in den betroffenen Regionen (z. B. 0,7 in einer Krise). */
  readonly demandMultiplier: number;
  /** Betroffene Regionen; leer oder fehlend = weltweit. */
  readonly regions?: readonly WorldRegion[];
}

/**
 * Wie die laufenden Ereignisse die Reiselust auf einem Paar ändern: Produkt über alle Ereignisse;
 * je Ereignis das Mittel beider Enden (Ende betroffen → `demandMultiplier`, sonst 1). Ein weltweites
 * Ereignis betrifft jedes Ende. Gilt für alle Gesellschaften gleich (E35). SPEZIFIKATION 3.5.
 *
 * Welche Ereignisse laufen (8.4) und in welcher Region ein Flughafen liegt, gibt der Aufrufer (F11).
 *
 * @param events Die in diesem Monat laufenden Ereignisse.
 */
export function eventDemandFactor(
  events: readonly DemandEvent[],
  regionA: WorldRegion,
  regionB: WorldRegion,
): number {
  let factor = 1;
  for (const event of events) {
    const at = (region: WorldRegion) =>
      !event.regions || event.regions.length === 0 || event.regions.includes(region) ? event.demandMultiplier : 1;
    factor *= (at(regionA) + at(regionB)) / 2;
  }
  return factor;
}

// ---------------------------------------------------------------------------
// 3.6 Marktgröße
// ---------------------------------------------------------------------------

/** Eingaben für `marketSize`. */
export interface MarketSizeInput {
  readonly a: MarketAirport;
  readonly b: MarketAirport;
  /** Spielmonat. */
  readonly month: number;
  /** `worldScale(month)` desselben Monats (F9). */
  readonly world: CitySize;
  /** `eventDemandFactor` des Paars in diesem Monat. Standard: 1 (kein Ereignis). */
  readonly eventFactor?: number;
}

/** Alle Teile der Marktgröße, für Anzeige und Tests. */
export interface MarketSizeParts {
  readonly referenceBlockMinutes: number;
  readonly season: number;
  readonly businessLinkage: number;
  readonly tourismLinkage: number;
  /** `businessLinkage + tourismLinkage`. */
  readonly linkage: number;
  readonly businessShare: number;
  readonly distanceFactor: number;
  readonly demandGrowth: number;
  readonly eventFactor: number;
  /** Fluggäste je Woche, beide Richtungen, ungerundet. */
  readonly marketSize: number;
}

/**
 * Marktgröße mit allen Teilen:
 * `DEMAND_SCALE × linkage ^ LINK_EXP × distanceFactor × demandGrowth × eventDemandFactor`.
 * SPEZIFIKATION 3.6.
 */
export function marketSizeParts(input: MarketSizeInput): MarketSizeParts {
  const { a, b, month, world } = input;
  const eventFactor = input.eventFactor ?? 1;
  const sizeA = relativeSize(a, month, world);
  const sizeB = relativeSize(b, month, world);
  const reference = referenceBlockMinutes(a.coords, b.coords);
  const season = seasonFactor(month, southernShare(a.coords, b.coords));
  const business = businessLinkage(sizeA, sizeB);
  const tourism = tourismLinkage(sizeA, sizeB, season);
  const linkage = business + tourism;
  const distance = distanceFactor(reference);
  const growth = demandGrowth(month);
  return {
    referenceBlockMinutes: reference,
    season,
    businessLinkage: business,
    tourismLinkage: tourism,
    linkage,
    businessShare: businessShare(sizeA, sizeB),
    distanceFactor: distance,
    demandGrowth: growth,
    eventFactor,
    marketSize: DEMAND_SCALE * linkage ** LINK_EXP * distance * growth * eventFactor,
  };
}

/**
 * Fluggäste je Woche auf einem Städtepaar, wenn **eine** Gesellschaft das Bezugsangebot macht (3.9.0).
 * Die Zahl „Market size“ im Planer. Hängt nicht von Flugzeug, Gesellschaft, Ruf, Preis, Satisfaction
 * oder Schwierigkeit ab; gleich für Spieler, KI, Planer und Umsteiger-Rechnung (W1, W9). SPEZIFIKATION 3.6.
 */
export function marketSize(input: MarketSizeInput): number {
  return marketSizeParts(input).marketSize;
}

// ---------------------------------------------------------------------------
// 3.7 Klassen-Anteil
// ---------------------------------------------------------------------------

/**
 * Welcher Teil der Marktgröße in der Klasse `cabinClass` reist (E21, W5). Für die höheren Klassen:
 * ```
 * CLASS_BASE × (1 + CLASS_BUSINESS_GAIN × (businessShare − CLASS_BUSINESS_REF)) × (1 + CLASS_TIME_GAIN × timeRamp)
 * timeRamp = kappen((referenceBlockMinutes − 60) / (720 − 60), 0, 1)
 * ```
 * Economy ist der Rest; die vier Anteile ergeben zusammen 1. SPEZIFIKATION 3.7.
 */
export function classShare(cabinClass: CabinClass, businessShareValue: number, referenceMinutes: number): number {
  if (cabinClass === 'economy') {
    return 1 - upperClassShare('premium', businessShareValue, referenceMinutes)
      - upperClassShare('business', businessShareValue, referenceMinutes)
      - upperClassShare('first', businessShareValue, referenceMinutes);
  }
  return upperClassShare(cabinClass, businessShareValue, referenceMinutes);
}

/** Alle vier Klassen-Anteile auf einmal; Summe = 1. SPEZIFIKATION 3.7. */
export function classShares(businessShareValue: number, referenceMinutes: number): Record<CabinClass, number> {
  const shares = {} as Record<CabinClass, number>;
  for (const cabinClass of CABIN_CLASSES) {
    shares[cabinClass] = classShare(cabinClass, businessShareValue, referenceMinutes);
  }
  return shares;
}

function upperClassShare(cabinClass: UpperCabinClass, businessShareValue: number, referenceMinutes: number): number {
  const timeRamp = clamp((referenceMinutes - CLASS_TIME_FROM) / (CLASS_TIME_TO - CLASS_TIME_FROM), 0, 1);
  return (
    CLASS_BASE[cabinClass] *
    (1 + CLASS_BUSINESS_GAIN[cabinClass] * (businessShareValue - CLASS_BUSINESS_REF)) *
    (1 + CLASS_TIME_GAIN[cabinClass] * timeRamp)
  );
}
