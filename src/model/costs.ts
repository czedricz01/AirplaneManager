/**
 * Kosten: SPEZIFIKATION Abschnitt 5.
 *
 * Diese Datei: Kosten-Faktoren (5.1), Treibstoffpreis mit Krisen (5.2), Kosten des Flugbetriebs einer
 * Strecke (Treibstoff 5.3, Besatzung 5.4, Landung 5.5), Gebühren je Fluggast (5.6), Verpflegung (5.7)
 * und Kosten je Fluggast (5.8). Der Rest von Abschnitt 5 steht in eigenen Dateien (Paket 3.5b):
 * `airportCosts.ts` (5.10, 5.11, 5.15), `fleet.ts` (5.12, 5.13), `costTotals.ts` (5.9, 5.14, 5.16).
 *
 * Strecken-Kosten gelten je Woche, beide Richtungen zusammen (wie der Erlös, 4.7). Kosten je Fluggast
 * gelten je Fluggast und Flugabschnitt. Alles ungerundet (R4). Feste Beträge nur über `atCost` (1.3);
 * Ausnahme: Treibstoff (Tabelle, echte Preise, E8).
 *
 * Was andere Abschnitte liefern, kommt als fertige Zahl (wie F14): fertige Forschungen als Ids,
 * Verwaltungsstufe, Lohn in Prozent, Flughafengröße, Flugabschnitte nach Ausfällen.
 */

import { EXTRAS_OPTIONS, MEAL_DATA, SERVICE_OPTIONS } from '../data/catering';
import { jetFuelPrices } from '../data/fuelPrices';
import { atCost, yearOf } from './basics';
import {
  ATTENDANT_RATE_1960,
  CABIN_CLASSES,
  CHECKIN_FEE_1960,
  COCKPIT_CREW,
  EFFICIENCY_MAX,
  FFP_COST_PER_PAX_1960,
  FUEL_BASE,
  FUEL_CRISES,
  FUEL_CRISIS_RAMP,
  FUEL_EFF_OFFSET,
  FUEL_EFF_SCALE,
  HANDLING_FEE_1960,
  HANDLING_LARGE_FROM,
  HANDLING_MEDIUM_FROM,
  HUB_FEE_FACTOR_TIER2,
  HUB_FEE_FACTOR_TIER3,
  LANDING_BASE_1960,
  LANDING_PER_LEVEL_1960,
  LANDING_REFERENCE_SEATS,
  LITRES_PER_GALLON,
  MAX_MANAGEMENT_TIER,
  MIN_CABIN_CREW,
  ATTENDANT_FROM_SEATS,
  PILOT_RATE_MIN_SHARE,
  PILOT_RATE_REFERENCE_SEATS,
  PILOT_RATE_1960,
  PROPELLER_FEE_SHARE,
  PROPELLER_MAX_SPEED,
  SEATS_PER_ATTENDANT,
  TRANSFER_CHECKIN_SHARE,
  type AircraftClass,
  type CostResearchKind,
} from './constants';
import type { PartialClassFigures } from './fare';
import {
  flightTimeIndex,
  mealWeight,
  servedItems,
  type ServiceCapability,
  type ServiceSelection,
} from './satisfaction';
import { researchEffects } from './progress';

// ---------------------------------------------------------------------------
// 5.1 Kosten-Faktoren der Gesellschaft
// ---------------------------------------------------------------------------

/**
 * Faktor der Forschung auf eine Kostenart: `max(RESEARCH_COST_FLOOR, 1 − Σ costSaving[Art])` der fertigen
 * Projekte (Feld `costSaving` der Forschungs-Tabelle, 6.9). Unbekannte Ids zählen nicht, doppelte einmal.
 * KI: keine Forschung, also 1. SPEZIFIKATION 5.1.
 *
 * @param completedResearch Ids der fertigen Forschungen.
 */
export function researchCostFactor(kind: CostResearchKind, completedResearch: readonly string[] = []): number {
  return researchEffects(completedResearch).costFactor[kind];
}

/**
 * Lohn-Faktor: `salaryPct / 100` (Lohn in Prozent des Marktlohns, 80 … 130, Abschnitt 8.7).
 * Wirkt nur auf die Besatzung (5.4). KI: kein Personal-Modell, also 1. SPEZIFIKATION 5.1.
 */
export function payFactor(salaryPct: number): number {
  return salaryPct / 100;
}

/**
 * Nachlass der Verwaltungsstufe auf Flughafen-Gebühren: Stufe 0 und 1 → 1, Stufe 2 → 0,95,
 * Stufe 3 → 0,85. Eine Stufe außerhalb 0 … 3 ist ein Fehler. SPEZIFIKATION 5.1.
 */
export function hubFeeFactor(managementTier: number): number {
  if (!Number.isInteger(managementTier) || managementTier < 0 || managementTier > MAX_MANAGEMENT_TIER) {
    throw new Error(`Unbekannte Verwaltungsstufe: ${String(managementTier)}`);
  }
  if (managementTier >= 3) return HUB_FEE_FACTOR_TIER3;
  if (managementTier === 2) return HUB_FEE_FACTOR_TIER2;
  return 1;
}

/**
 * **Ein** Nachlass für alle Gebühren, die eine Gesellschaft an einem Flughafen zahlt:
 * `hubFeeFactor(Stufe dort) × researchCostFactor(fees)`. Gilt für Landung (5.5), Check-in und
 * Abfertigung (5.6), Slot-, Stand- und Schalter-Miete (5.10); nicht für Einrichtungen und
 * Einmalpreise. SPEZIFIKATION 5.1, R6.
 */
export function airportFeeFactor(managementTier: number, completedResearch: readonly string[] = []): number {
  return hubFeeFactor(managementTier) * researchCostFactor('fees', completedResearch);
}

// ---------------------------------------------------------------------------
// 5.2 Treibstoffpreis
// ---------------------------------------------------------------------------

/** Schlüssel der Tabelle für einen Spielmonat: „JJJJ-MM“. */
function fuelTableKey(month: number): string {
  const mm = (((month % 12) + 12) % 12) + 1;
  return `${yearOf(month)}-${String(mm).padStart(2, '0')}`;
}

/** Erster und letzter Eintrag der Tabelle, aus den Daten gelesen (unveränderlich). */
const FUEL_TABLE_KEYS = Object.keys(jetFuelPrices).sort();
const FUEL_TABLE_FIRST = jetFuelPrices[FUEL_TABLE_KEYS[0]];
const FUEL_TABLE_LAST_KEY = FUEL_TABLE_KEYS[FUEL_TABLE_KEYS.length - 1];
const FUEL_TABLE_LAST = jetFuelPrices[FUEL_TABLE_LAST_KEY];

/**
 * Form der Ölkrisen in der Tabelle (E61): `1 + (F − 1) × min(1, (k + 1) / (RAMP + 1), (D − k) / (RAMP + 1))`
 * im Monat `k` (0 … D − 1) einer Krise mit Faktor `F` und Dauer `D`, sonst 1. Je `FUEL_CRISIS_RAMP`
 * Monate An- und Abstieg innerhalb der Dauer. Überschneiden sich Krisen, gilt das Produkt.
 * SPEZIFIKATION 5.2.
 */
export function crisisFuelShape(month: number): number {
  let shape = 1;
  for (const crisis of FUEL_CRISES) {
    const k = month - crisis.startMonth;
    if (k < 0 || k >= crisis.months) continue;
    const step = Math.min(1, (k + 1) / (FUEL_CRISIS_RAMP + 1), (crisis.months - k) / (FUEL_CRISIS_RAMP + 1));
    shape *= 1 + (crisis.factor - 1) * step;
  }
  return shape;
}

/**
 * Treibstoff-Tabelle in $ je Gallone: Tabellenwert „JJJJ-MM“ aus `src/data/fuelPrices.ts` ×
 * `crisisFuelShape` (E61). Vor dem ersten Eintrag gilt der erste, nach dem letzten (2030-12) der
 * **letzte** (E8, W3). Kein Kostenindex, keine Schwierigkeit, kein Ereignis-Faktor. SPEZIFIKATION 5.2.
 *
 * Die Rohdaten bleiben unverändert, solange der alte Code sie mit seinem Ereignis-Faktor liest (F27).
 */
export function fuelTable(month: number): number {
  const key = fuelTableKey(month);
  let raw: number;
  if (month < 0) raw = FUEL_TABLE_FIRST;
  else if (key > FUEL_TABLE_LAST_KEY) raw = FUEL_TABLE_LAST;
  else {
    raw = jetFuelPrices[key];
    if (raw === undefined) throw new Error(`Treibstoff-Tabelle ohne Eintrag ${key}`);
  }
  return raw * crisisFuelShape(month);
}

/**
 * Preis eines Liters Jet-Treibstoff für eine Gesellschaft:
 * `fuelTable(month) / LITRES_PER_GALLON × researchCostFactor(fuel)`.
 * Läuft eine Preis-Absicherung (Abschnitt 8.5), ersetzt ihr gesicherter Tabellenwert `fuelTable(month)`.
 * SPEZIFIKATION 5.2.
 *
 * @param hedgedFuelTable gesicherter Tabellenwert in $ je Gallone, nur während der Absicherung.
 */
export function fuelPrice(month: number, completedResearch: readonly string[] = [], hedgedFuelTable?: number): number {
  const table = hedgedFuelTable ?? fuelTable(month);
  return (table / LITRES_PER_GALLON) * researchCostFactor('fuel', completedResearch);
}

// ---------------------------------------------------------------------------
// 5.3 Treibstoff je Strecke
// ---------------------------------------------------------------------------

/**
 * Effizienz eines Flugzeugs: Wert des Typs + Σ `efficiencyPoints` der fertigen Projekte (6.9; je Stufe
 * `EFFICIENCY_PER_RESEARCH`), höchstens `EFFICIENCY_MAX`, nie unter dem Wert des Typs. Berechnet, nicht
 * gespeichert. SPEZIFIKATION 5.3.
 */
export function aircraftEfficiency(typeEfficiency: number, completedResearch: readonly string[] = []): number {
  const points = researchEffects(completedResearch).efficiencyPoints;
  return Math.max(typeEfficiency, Math.min(EFFICIENCY_MAX, typeEfficiency + points));
}

/**
 * Liter je Sitz und 100 km: `FUEL_BASE / (FUEL_EFF_OFFSET + efficiency / FUEL_EFF_SCALE)`
 * (Effizienz 14 → 8,0; 50 → 5,1; 72 → 4,2; 96 → 3,5). SPEZIFIKATION 5.3.
 */
export function fuelLitresPerSeat100km(efficiency: number): number {
  return FUEL_BASE / (FUEL_EFF_OFFSET + efficiency / FUEL_EFF_SCALE);
}

/** Eingaben für `fuelCost`. */
export interface FuelCostInput {
  /** Effizienz mit Forschung (`aircraftEfficiency`). */
  readonly efficiency: number;
  /** Höchstsitze des Typs laut Daten (`capacity`), nicht die eingebauten Sitze. */
  readonly capacity: number;
  /** Großkreis-Entfernung in km. */
  readonly greatCircleKm: number;
  /** Geflogene Flugabschnitte je Woche (ohne gestrichene und gecharterte, 8.9). */
  readonly flownLegs: number;
  /** `fuelPrice` in $ je Liter. */
  readonly fuelPrice: number;
}

/**
 * Treibstoff-Rechnung einer Strecke je Woche:
 * `fuelLitresPerSeat100km × capacity × Entfernung / 100 × flownLegs × fuelPrice`.
 * Hängt nicht von den Fluggästen ab. SPEZIFIKATION 5.3.
 */
export function fuelCost(input: FuelCostInput): number {
  return (
    fuelLitresPerSeat100km(input.efficiency) *
    input.capacity *
    (input.greatCircleKm / 100) *
    input.flownLegs *
    input.fuelPrice
  );
}

// ---------------------------------------------------------------------------
// 5.4 Besatzung
// ---------------------------------------------------------------------------

/**
 * Flugbegleiter nach eingebauter Kabine: `max(MIN_CABIN_CREW, Σ Sitze(c) / SEATS_PER_ATTENDANT[c])`; unter
 * `ATTENDANT_FROM_SEATS` Sitzen keine (E89, wie bei echten Commutern bis 19 Sitze).
 * Kommazahl, ungerundet (R4). SPEZIFIKATION 5.4.
 *
 * @param seats eingebaute Sitze je Klasse; fehlende Klasse = 0.
 */
export function cabinCrew(seats: PartialClassFigures): number {
  let crew = 0;
  for (const c of CABIN_CLASSES) crew += (seats[c] ?? 0) / SEATS_PER_ATTENDANT[c];
  if (totalSeats(seats) < ATTENDANT_FROM_SEATS) return 0;
  return Math.max(MIN_CABIN_CREW, crew);
}

const totalSeats = (seats: PartialClassFigures): number => CABIN_CLASSES.reduce((n, c) => n + (seats[c] ?? 0), 0);

/**
 * Anteil des Piloten-Lohns nach Größe (E89): `clamp(Sitze / PILOT_RATE_REFERENCE_SEATS, PILOT_RATE_MIN_SHARE, 1)`.
 * Kleine Flugzeuge zahlen weniger je Blockstunde. SPEZIFIKATION 5.4.
 */
export function pilotRateShare(seats: PartialClassFigures): number {
  return Math.min(1, Math.max(PILOT_RATE_MIN_SHARE, totalSeats(seats) / PILOT_RATE_REFERENCE_SEATS));
}

/**
 * Stundensatz der Besatzung im Monat `month` (Geld dieses Monats, ohne Lohn-Faktor und Forschung):
 * `atCost(COCKPIT_CREW × PILOT_RATE_1960 × pilotRateShare + cabinCrew × ATTENDANT_RATE_1960, month)`. Auch für die
 * Anzeige im Planer. SPEZIFIKATION 5.4.
 */
export function crewHourlyRate(seats: PartialClassFigures, month: number): number {
  return atCost(COCKPIT_CREW * PILOT_RATE_1960 * pilotRateShare(seats) + cabinCrew(seats) * ATTENDANT_RATE_1960, month);
}

/** Eingaben für `crewCost`. */
export interface CrewCostInput {
  /** Eingebaute Sitze je Klasse. */
  readonly seats: PartialClassFigures;
  /** Flugzeit eines Abschnitts in Minuten (eine Richtung, 1.1). */
  readonly blockMinutes: number;
  /** Geflogene Flugabschnitte je Woche. */
  readonly flownLegs: number;
  readonly month: number;
  /** `payFactor` (KI: 1). */
  readonly payFactor: number;
  /** Ids der fertigen Forschungen (KI: keine). */
  readonly completedResearch?: readonly string[];
}

/**
 * Löhne von Cockpit und Kabine je Woche:
 * `crewHourlyRate × blockMinutes × flownLegs / 60 × payFactor × researchCostFactor(crew)`.
 * Bodenpersonal ist in der Abfertigung (5.6) enthalten. SPEZIFIKATION 5.4.
 */
export function crewCost(input: CrewCostInput): number {
  return (
    crewHourlyRate(input.seats, input.month) *
    ((input.blockMinutes * input.flownLegs) / 60) *
    input.payFactor *
    researchCostFactor('crew', input.completedResearch)
  );
}

// ---------------------------------------------------------------------------
// 5.5 Landegebühr
// ---------------------------------------------------------------------------

/** Was die Landegebühr vom Flugzeug braucht (Felder aus `src/data/aircraft.ts`). */
export interface LandingAircraft {
  /** Feld `class`. */
  readonly aircraftClass: AircraftClass;
  /** Höchstsitze des Typs (`capacity`). */
  readonly capacity: number;
  /** Reisegeschwindigkeit in km/h (`cruiseSpeed`). */
  readonly cruiseSpeed: number;
}

/**
 * Was eine Landung kostet:
 * `atCost(LANDING_BASE_1960[Klasse] + LANDING_PER_LEVEL_1960[Klasse] × Flughafengröße, month)
 *  × capacity / LANDING_REFERENCE_SEATS[Klasse] × (PROPELLER_FEE_SHARE für Propeller) × airportFeeFactor`.
 * Propeller = Regional und langsamer als `PROPELLER_MAX_SPEED`. Eine unbekannte Klasse ist ein Fehler.
 * Spieler und KI zahlen mit dieser Funktion (R6). SPEZIFIKATION 5.5.
 *
 * @param airportSize Größe des Zielflughafens (1 … 7).
 * @param feeFactor `airportFeeFactor` der Gesellschaft an diesem Flughafen.
 */
export function landingFee(aircraft: LandingAircraft, airportSize: number, month: number, feeFactor: number): number {
  const cls = aircraft.aircraftClass;
  const base = LANDING_BASE_1960[cls];
  if (base === undefined) throw new Error(`Unbekannte Flugzeugklasse: ${String(cls)}`);
  const propeller = cls === 'Regional' && aircraft.cruiseSpeed < PROPELLER_MAX_SPEED;
  return (
    atCost(base + LANDING_PER_LEVEL_1960[cls] * airportSize, month) *
    (aircraft.capacity / LANDING_REFERENCE_SEATS[cls]) *
    (propeller ? PROPELLER_FEE_SHARE : 1) *
    feeFactor
  );
}

/** Landungen an einem Zielflughafen einer Strecke, je Woche. */
export interface LandingsAt {
  /** Größe des Flughafens (1 … 7). */
  readonly airportSize: number;
  /** `airportFeeFactor` der Gesellschaft dort. */
  readonly feeFactor: number;
  /** Geflogene Abschnitte je Woche, die dort landen. */
  readonly landings: number;
}

/**
 * Landegebühren einer Strecke je Woche: Σ geflogene Abschnitte: `landingFee` am Zielflughafen des
 * Abschnitts. Je Flugabschnitt **eine** Landung am Ziel (R6, W12): Hin und Zurück = eine Landung an
 * jedem Ende, Einweg = eine. SPEZIFIKATION 5.5.
 */
export function landingCost(aircraft: LandingAircraft, arrivals: readonly LandingsAt[], month: number): number {
  return arrivals.reduce((sum, a) => sum + landingFee(aircraft, a.airportSize, month, a.feeFactor) * a.landings, 0);
}

// ---------------------------------------------------------------------------
// 5.6 Check-in und Abfertigung
// ---------------------------------------------------------------------------

/**
 * Check-in je Reise am Flughafen, an dem die Reise beginnt: `atCost(CHECKIN_FEE_1960) × airportFeeFactor`.
 * Ein Umsteiger checkt am Umsteige-Flughafen nicht noch einmal ein (E27). SPEZIFIKATION 5.6.
 */
export function checkInFee(month: number, feeFactor: number): number {
  return atCost(CHECKIN_FEE_1960, month) * feeFactor;
}

/** Abfertigungs-Satz von 1960 nach Flughafengröße: 1–2 → 6 $, 3–4 → 8 $, ab 5 → 10 $. SPEZIFIKATION 5.6. */
export function handlingFee1960(airportSize: number): number {
  if (airportSize >= HANDLING_LARGE_FROM) return HANDLING_FEE_1960.large;
  if (airportSize >= HANDLING_MEDIUM_FROM) return HANDLING_FEE_1960.medium;
  return HANDLING_FEE_1960.small;
}

/**
 * Abfertigung (Gepäck, Boarding, Bodenpersonal) je Abflug eines Fluggasts:
 * `atCost(HANDLING_FEE_1960[Größenstufe]) × airportFeeFactor`. SPEZIFIKATION 5.6.
 */
export function handlingFee(airportSize: number, month: number, feeFactor: number): number {
  return atCost(handlingFee1960(airportSize), month) * feeFactor;
}

// ---------------------------------------------------------------------------
// 5.7 Verpflegung
// ---------------------------------------------------------------------------

/** Preis von 1960 je Gericht (Feld `cost` in `MEAL_DATA`). */
const MEAL_COST: ReadonlyMap<string, number> = new Map(
  Object.values(MEAL_DATA).flatMap((items) => items.map((item) => [item.id, item.cost] as const)),
);

/** Aufschlüsselung der Verpflegungskosten je Fluggast, in Preisen von 1960 vor Forschung. */
export interface CateringCostParts {
  /** Je Mahlzeit: Gewicht (`mealWeight`, wie 2.5), Preis aller Gerichte, Beitrag = Gewicht × Preis. */
  readonly meals: readonly { readonly weight: number; readonly dishesCost1960: number; readonly cost1960: number }[];
  readonly extrasCost1960: number;
  readonly onboardServiceCost1960: number;
  /** Summe in $ von 1960. */
  readonly total1960: number;
}

/**
 * Verpflegungskosten in Preisen von 1960 mit Aufschlüsselung: `Σ_k mealWeight(k) × Σ Gerichte im Menü k:
 * Preis + Σ Extras: Preis + Σ Bordservice: Preis`. Es kostet genau, was an Bord kommt (`servedItems`,
 * dieselbe Auswahl wie für die Service points); jedes Gericht kostet voll. SPEZIFIKATION 5.7.
 */
export function cateringCostParts(
  selection: ServiceSelection,
  blockMinutes: number,
  capability: ServiceCapability,
): CateringCostParts {
  const fti = flightTimeIndex(blockMinutes);
  const served = servedItems(selection, capability);
  const meals = served.meals.map((dishes, i) => {
    const weight = mealWeight(i + 1, fti);
    const dishesCost1960 = dishes.reduce((sum, id) => sum + (MEAL_COST.get(id) as number), 0);
    return { weight, dishesCost1960, cost1960: weight * dishesCost1960 };
  });
  const extrasCost1960 = served.extraIds.reduce((sum, id) => sum + EXTRAS_OPTIONS[id].cost, 0);
  const onboardServiceCost1960 = served.onboardServiceIds.reduce((sum, id) => sum + SERVICE_OPTIONS[id].cost, 0);
  const mealsCost = meals.reduce((sum, meal) => sum + meal.cost1960, 0);
  return { meals, extrasCost1960, onboardServiceCost1960, total1960: mealsCost + extrasCost1960 + onboardServiceCost1960 };
}

/**
 * Verpflegung eines Fluggasts einer Klasse auf einem Flugabschnitt:
 * `atCost(Preise der Auswahl, month) × researchCostFactor(catering)`. SPEZIFIKATION 5.7.
 *
 * @param blockMinutes Flugzeit der Strecke in Minuten, eine Richtung.
 */
export function cateringCost(
  selection: ServiceSelection,
  blockMinutes: number,
  capability: ServiceCapability,
  month: number,
  completedResearch: readonly string[] = [],
): number {
  const parts = cateringCostParts(selection, blockMinutes, capability);
  return atCost(parts.total1960, month) * researchCostFactor('catering', completedResearch);
}

// ---------------------------------------------------------------------------
// 5.8 Kosten je Fluggast
// ---------------------------------------------------------------------------

/**
 * Frequent-flyer-Kosten je Reise: `atCost(FFP_COST_PER_PAX_1960, month)`, solange das Programm läuft,
 * sonst 0. KI: 0. SPEZIFIKATION 5.8, 5.14.
 */
export function ffpCostPerPassenger(programActive: boolean, month: number): number {
  return programActive ? atCost(FFP_COST_PER_PAX_1960, month) : 0;
}

/** Gebühren an einem Ende einer Strecke, für einen Fluggast. */
export interface EndFees {
  /** `checkInFee` dort. */
  readonly checkInFee: number;
  /** `handlingFee` dort. */
  readonly handlingFee: number;
  /** Anteil der Abflüge der Strecke an diesem Ende (`departureShares`). */
  readonly departureShare: number;
}

/**
 * Anteile der Abflüge einer Strecke an ihren beiden Enden A und B, nach Plan: Hin und Zurück → je 0,5.
 * Ohne Abflüge ist das ein Fehler. SPEZIFIKATION 5.8.
 */
export function departureShares(departuresFromA: number, departuresFromB: number): readonly [number, number] {
  const total = departuresFromA + departuresFromB;
  if (!(total > 0)) throw new Error('Strecke ohne Abflüge');
  return [departuresFromA / total, departuresFromB / total];
}

/** Eingaben für `costPerPassenger`. */
export interface PassengerCostInput {
  /** `cateringCost` der Klasse auf dieser Strecke. */
  readonly cateringCost: number;
  /** Gebühren an beiden Enden A und B. */
  readonly ends: readonly [EndFees, EndFees];
  /** `ffpCostPerPassenger`. */
  readonly ffpCostPerPassenger: number;
}

/**
 * Kosten je Fluggast nach den Posten des Monatsberichts (5.16): Verpflegung („Catering“), Check-in und
 * Abfertigung („Passenger fees“), Frequent flyer („Marketing“). Die Summe ist `costPerPassenger` bzw.
 * `transferCostPerPassenger`; kein Dollar zählt zweimal.
 */
export interface PassengerCostParts {
  readonly catering: number;
  readonly fees: number;
  readonly ffp: number;
  readonly total: number;
}

/**
 * Kosten eines zusätzlichen **Direktgasts** einer Klasse, je Flugabschnitt, nach Posten. Siehe
 * `costPerPassenger`. SPEZIFIKATION 5.8, 5.16.
 */
export function costPerPassengerParts(input: PassengerCostInput): PassengerCostParts {
  let fees = 0;
  let ffp = 0;
  for (const end of input.ends) {
    fees += end.departureShare * (end.handlingFee + end.checkInFee);
    ffp += end.departureShare * input.ffpCostPerPassenger;
  }
  return { catering: input.cateringCost, fees, ffp, total: input.cateringCost + fees + ffp };
}

/**
 * Kosten eines zusätzlichen **Direktgasts** einer Klasse, je Flugabschnitt:
 * `cateringCost + wA × (handlingFee(A) + tripCost(A)) + wB × (handlingFee(B) + tripCost(B))` mit
 * `tripCost(x) = checkInFee(x) + ffpCostPerPassenger` (je Reise, Start in x). Wer in A abfliegt, zahlt dort.
 * Hängt nicht vom Preis und nicht von der Zahl der Fluggäste ab. SPEZIFIKATION 5.8.
 */
export function costPerPassenger(input: PassengerCostInput): number {
  return costPerPassengerParts(input).total;
}

/** Eingaben für `transferCostPerPassenger`. */
export interface TransferPassengerCostInput {
  /** `cateringCost` der Klasse auf dieser Teilstrecke. */
  readonly cateringCost: number;
  /** Gebühren am äußeren Ende X der Teilstrecke. */
  readonly outer: EndFees;
  /** Gebühren am Drehkreuz H (Check-in zählt dort nicht). */
  readonly hub: EndFees;
  /** `ffpCostPerPassenger`. */
  readonly ffpCostPerPassenger: number;
}

/**
 * Kosten eines Umsteigers auf einer Teilstrecke, je Abschnitt, nach Posten. Siehe `transferCostPerPassenger`.
 * SPEZIFIKATION 5.8, 5.16.
 */
export function transferCostPerPassengerParts(input: TransferPassengerCostInput): PassengerCostParts {
  const fees =
    input.outer.departureShare * input.outer.handlingFee +
    input.hub.departureShare * input.hub.handlingFee +
    TRANSFER_CHECKIN_SHARE * input.outer.checkInFee;
  const ffp = TRANSFER_CHECKIN_SHARE * input.ffpCostPerPassenger;
  return { catering: input.cateringCost, fees, ffp, total: input.cateringCost + fees + ffp };
}

/**
 * Kosten eines Umsteigers auf einer Teilstrecke mit Drehkreuz H und äußerem Ende X, je Abschnitt:
 * `cateringCost + wX × handlingFee(X) + wH × handlingFee(H) + 0,5 × tripCost(X)`. Die Hälfte der
 * Umsteiger beginnt ihre Reise in X (Check-in hier), die andere am anderen Ende der Verbindung
 * (Check-in auf der anderen Teilstrecke). In H checkt niemand ein (E27, W5). SPEZIFIKATION 5.8.
 */
export function transferCostPerPassenger(input: TransferPassengerCostInput): number {
  return transferCostPerPassengerParts(input).total;
}
