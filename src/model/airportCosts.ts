/**
 * Kosten an Flughäfen: SPEZIFIKATION 5.10 (Slots, Abstellplätze, Schalter), 5.11 (Verwaltungsstufen und
 * Einrichtungen) und 5.15 (Einnahme eigener Flughäfen). Teil von Abschnitt 5, aus `costs.ts` ausgelagert
 * (Paket 3.5b, Datei sonst zu groß).
 *
 * Laufende Beträge gelten je Gesellschaft und Flughafen, **je Woche**. Mieten sind Flughafen-Gebühren und
 * tragen `airportFeeFactor` (5.1); Einrichtungen und Einmalpreise nicht. Alles ungerundet (R4); feste Beträge
 * nur über `atCost` (1.3).
 */

import { atCost } from './basics';
import {
  AIRCRAFT_CLASSES,
  DESK_FIXED_SHARE,
  DESK_RENT_1960,
  FACILITY_PRICE_1960,
  FACILITY_UPKEEP_1960,
  FREE_STANDS_FROM_TIER,
  MAX_MANAGEMENT_TIER,
  OWNER_FEE_SHARE,
  OWNER_TIER,
  SELF_DESK_FROM,
  SLOT_PRICE_1960,
  SLOT_RENT_1960,
  SLOT_RESALE_SHARE,
  SLOTS_PER_AIRPORT_LEVEL,
  STAND_RENT_1960,
  STANDS_MIN_AIRPORT_SIZE,
  TIER_PRICE_1960,
  type AircraftClass,
  type DeskType,
  type FacilityKind,
} from './constants';
import { researchCostFactor } from './costs';
import type { Desks } from './satisfaction';

/** Zahlen je Flugzeugklasse (Art der Slots und Abstellplätze); fehlende Klasse = 0. */
export type PerAircraftClass = Readonly<Partial<Record<AircraftClass, number>>>;

/** Liest einen Wert je Flugzeugklasse; eine unbekannte Klasse ist ein Fehler (wie F29). */
function perClass<T>(table: Readonly<Record<AircraftClass, T>>, cls: AircraftClass): T {
  const value = table[cls];
  if (value === undefined) throw new Error(`Unbekannte Flugzeugklasse: ${String(cls)}`);
  return value;
}

// ---------------------------------------------------------------------------
// 5.10 Slots
// ---------------------------------------------------------------------------

/**
 * Höchstzahl der Slots an einem Flughafen, alle Arten und alle Gesellschaften zusammen:
 * `SLOTS_PER_AIRPORT_LEVEL × Flughafengröße`. Ein Slot = ein Abflug je Woche (1.6, E50). SPEZIFIKATION 5.10.
 */
export function slotLimit(airportSize: number): number {
  return SLOTS_PER_AIRPORT_LEVEL * airportSize;
}

/** Eine Strecke einer Gesellschaft für das Zählen von Abflügen (Slots, 1.6). */
export interface DepartureRoute {
  readonly origin: string;
  readonly destination: string;
  /** Umläufe je Woche = Abflüge je Woche an **jedem** Ende (1.6). */
  readonly weeklyFrequency: number;
}

/**
 * Abflüge je Woche an einem Flughafen = belegte Slots dort: Σ Umläufe aller Strecken mit einem Ende dort. Eine
 * Funktion für Spieler und KI, Planer, Flughafen-Ansichten und Einnahme eigener Flughäfen (5.15).
 * SPEZIFIKATION 1.6, 7.17.
 */
export function departuresAt(routes: readonly DepartureRoute[], airportId: string): number {
  let total = 0;
  for (const r of routes) {
    if (r.origin === airportId) total += r.weeklyFrequency;
    if (r.destination === airportId) total += r.weeklyFrequency;
  }
  return total;
}

/** Abflüge je Woche auf einem Paar, in einer Richtung (Richtung egal). SPEZIFIKATION 1.6, 7.17. */
export function departuresOnPair(routes: readonly DepartureRoute[], a: string, b: string): number {
  let total = 0;
  for (const r of routes) {
    if ((r.origin === a && r.destination === b) || (r.origin === b && r.destination === a)) total += r.weeklyFrequency;
  }
  return total;
}

/**
 * Kaufpreis eines Slots: `atCost(SLOT_PRICE_1960[Art], month) × researchCostFactor(slots) × milestoneSlotFactor`.
 * Neu mit Kostenindex (E6, W8), ungerundet. SPEZIFIKATION 5.10.
 *
 * @param milestoneSlotFactor Nachlass aus Meilensteinen (Abschnitt 6), sonst 1.
 */
export function slotPrice(
  cls: AircraftClass,
  month: number,
  completedResearch: readonly string[] = [],
  milestoneSlotFactor = 1,
): number {
  return atCost(perClass(SLOT_PRICE_1960, cls), month) * researchCostFactor('slots', completedResearch) * milestoneSlotFactor;
}

/** Verkaufserlös eines Slots: `SLOT_RESALE_SHARE × slotPrice` des Verkaufsmonats. SPEZIFIKATION 5.10. */
export function slotResalePrice(
  cls: AircraftClass,
  month: number,
  completedResearch: readonly string[] = [],
  milestoneSlotFactor = 1,
): number {
  return SLOT_RESALE_SHARE * slotPrice(cls, month, completedResearch, milestoneSlotFactor);
}

/**
 * Miete eines gekauften Slots je Woche, belegt oder nicht: `atCost(SLOT_RENT_1960[Art], month) × airportFeeFactor`.
 * SPEZIFIKATION 5.10.
 *
 * @param feeFactor `airportFeeFactor` der Gesellschaft an diesem Flughafen.
 */
export function slotRent(cls: AircraftClass, month: number, feeFactor: number): number {
  return atCost(perClass(SLOT_RENT_1960, cls), month) * feeFactor;
}

// ---------------------------------------------------------------------------
// 5.10 Abstellplätze
// ---------------------------------------------------------------------------

/** Ob ein Flughafen Abstellplätze hat: erst ab Größe `STANDS_MIN_AIRPORT_SIZE` (3). SPEZIFIKATION 5.10. */
export function hasStands(airportSize: number): boolean {
  return airportSize >= STANDS_MIN_AIRPORT_SIZE;
}

/**
 * Miete eines Abstellplatzes je Woche: Verwaltungsstufe 0–1 `atCost(STAND_RENT_1960[Art]) × airportFeeFactor`;
 * ab Stufe 2 hat jeder Slot einen Abstellplatz **ohne Miete** (E28, bewusster Vorteil). SPEZIFIKATION 5.10.
 */
export function standRent(cls: AircraftClass, month: number, managementTier: number, feeFactor: number): number {
  if (managementTier >= FREE_STANDS_FROM_TIER) return 0;
  return atCost(perClass(STAND_RENT_1960, cls), month) * feeFactor;
}

// ---------------------------------------------------------------------------
// 5.10 Check-in-Schalter
// ---------------------------------------------------------------------------

/** Ob eine Schalter-Art in diesem Monat zu haben ist: bedient immer, Selbstbedienung ab 1995. SPEZIFIKATION 5.10. */
export function isDeskTypeAvailable(deskType: DeskType, month: number): boolean {
  return deskType === 'normal' || month >= SELF_DESK_FROM;
}

/**
 * Miete eines Schalters je Woche:
 * `atCost(DESK_RENT_1960[Art]) × (DESK_FIXED_SHARE + (1 − DESK_FIXED_SHARE) × min(1, deskLoad)) × airportFeeFactor`.
 * `deskLoad` aus 2.6.3 (eine Funktion für Satisfaction und Kosten). SPEZIFIKATION 5.10.
 */
export function deskRent(deskType: DeskType, month: number, load: number, feeFactor: number): number {
  const rent = DESK_RENT_1960[deskType];
  if (rent === undefined) throw new Error(`Unbekannte Schalter-Art: ${String(deskType)}`);
  return atCost(rent, month) * (DESK_FIXED_SHARE + (1 - DESK_FIXED_SHARE) * Math.min(1, load)) * feeFactor;
}

// ---------------------------------------------------------------------------
// 5.11 Verwaltungsstufen und Einrichtungen
// ---------------------------------------------------------------------------

/**
 * Einmalpreis einer Verwaltungsstufe: `atCost(Flughafengröße × TIER_PRICE_1960[Stufe], month)` (neu mit
 * Kostenindex, E6, W8). Keine laufenden Kosten der Stufe selbst. Stufe außerhalb 1 … 3 ist ein Fehler.
 * SPEZIFIKATION 5.11.
 */
export function managementTierPrice(tier: number, airportSize: number, month: number): number {
  if (!Number.isInteger(tier) || tier < 1 || tier > MAX_MANAGEMENT_TIER) {
    throw new Error(`Unbekannte Verwaltungsstufe: ${String(tier)}`);
  }
  return atCost(airportSize * TIER_PRICE_1960[tier as 1 | 2 | 3], month);
}

/** Einmalpreis einer Einrichtung: `atCost(FACILITY_PRICE_1960[Art], month)`. SPEZIFIKATION 5.11. */
export function facilityPrice(kind: FacilityKind, month: number): number {
  const price = FACILITY_PRICE_1960[kind];
  if (price === undefined) throw new Error(`Unbekannte Einrichtung: ${String(kind)}`);
  return atCost(price, month);
}

/** Unterhalt einer Einrichtung je Woche: `atCost(FACILITY_UPKEEP_1960[Art], month)`, ohne Gebühren-Faktor. SPEZIFIKATION 5.11. */
export function facilityUpkeep(kind: FacilityKind, month: number): number {
  const upkeep = FACILITY_UPKEEP_1960[kind];
  if (upkeep === undefined) throw new Error(`Unbekannte Einrichtung: ${String(kind)}`);
  return atCost(upkeep, month);
}

// ---------------------------------------------------------------------------
// 5.10 / 5.11 Laufende Kosten an einem Flughafen
// ---------------------------------------------------------------------------

/** Was eine Gesellschaft an einem Flughafen hat. */
export interface AirportHoldings {
  /** Größe des Flughafens (1 … 7). */
  readonly airportSize: number;
  /** Verwaltungsstufe der Gesellschaft dort (0 … 3). */
  readonly managementTier: number;
  /** `airportFeeFactor` der Gesellschaft dort (5.1). */
  readonly feeFactor: number;
  /** Gekaufte Slots je Art. */
  readonly slots: PerAircraftClass;
  /** Gemietete Abstellplätze je Art (nur ab Flughafengröße 3; ab Stufe 2 ohne Miete). */
  readonly stands: PerAircraftClass;
  /** Eigene Schalter je Art. */
  readonly desks: Desks;
  /** `deskLoad` an diesem Flughafen (2.6.3). */
  readonly deskLoad: number;
  /** Eigene Einrichtungen. */
  readonly facilities: readonly FacilityKind[];
}

/** Laufende Kosten an einem Flughafen je Woche, nach Posten (Anzeige „Weekly upkeep“). */
export interface AirportUpkeepParts {
  readonly slots: number;
  readonly stands: number;
  readonly desks: number;
  readonly facilities: number;
  readonly total: number;
}

/**
 * Laufende Kosten einer Gesellschaft an einem Flughafen je Woche: Slot-, Stand- und Schalter-Miete (5.10)
 * und der Unterhalt ihrer Einrichtungen (5.11), im Geld des Monats. Abstellplätze an einem Flughafen ohne
 * Abstellplätze sind ein Fehler. SPEZIFIKATION 5.10, 5.11, 5.16 („Airport upkeep“).
 */
export function airportUpkeepParts(holdings: AirportHoldings, month: number): AirportUpkeepParts {
  let slots = 0;
  let stands = 0;
  for (const cls of AIRCRAFT_CLASSES) {
    slots += (holdings.slots[cls] ?? 0) * slotRent(cls, month, holdings.feeFactor);
    const standCount = holdings.stands[cls] ?? 0;
    if (standCount > 0 && !hasStands(holdings.airportSize)) {
      throw new Error(`Abstellplätze an einem Flughafen der Größe ${holdings.airportSize}`);
    }
    stands += standCount * standRent(cls, month, holdings.managementTier, holdings.feeFactor);
  }
  let desks = 0;
  for (const deskType of ['normal', 'self'] as const) {
    desks += holdings.desks[deskType] * deskRent(deskType, month, holdings.deskLoad, holdings.feeFactor);
  }
  let facilities = 0;
  for (const kind of new Set(holdings.facilities)) facilities += facilityUpkeep(kind, month);
  return { slots, stands, desks, facilities, total: slots + stands + desks + facilities };
}

/** Laufende Kosten an einem Flughafen je Woche. Siehe `airportUpkeepParts`. SPEZIFIKATION 5.10. */
export function airportUpkeep(holdings: AirportHoldings, month: number): number {
  return airportUpkeepParts(holdings, month).total;
}

// ---------------------------------------------------------------------------
// 5.15 Einnahme eigener Flughäfen
// ---------------------------------------------------------------------------

/**
 * Anteil an den Landegebühren der **anderen** Gesellschaften an einem Flughafen, je Woche:
 * `OWNER_FEE_SHARE × Σ andere: landingFee × Landungen` / Zahl der Gesellschaften mit Stufe 3 dort.
 * Ohne Stufe 3 → 0. Die Gebühren sind dieselben `landingFee` (5.5), die die anderen zahlen; für sie ist die
 * Einnahme kein Abzug. SPEZIFIKATION 5.15.
 *
 * @param othersLandingFees Σ der Landegebühren der anderen Gesellschaften dort je Woche (`landingCost`-Anteile).
 * @param ownersAtAirport Gesellschaften mit Stufe 3 an diesem Flughafen, diese eingeschlossen.
 */
export function ownerFeeIncome(managementTier: number, othersLandingFees: number, ownersAtAirport: number): number {
  if (managementTier < OWNER_TIER) return 0;
  if (!(ownersAtAirport >= 1)) throw new Error('Stufe 3 ohne Inhaber');
  return (OWNER_FEE_SHARE * othersLandingFees) / ownersAtAirport;
}
