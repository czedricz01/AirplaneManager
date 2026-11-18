/**
 * Zufriedenheit: SPEZIFIKATION Abschnitt 2 (ohne Kabine, die steht in `cabin.ts`).
 *
 * Stand Paket 3.2a: Flugzeit-Index (2.1), Type appeal (2.2), Service points (2.5).
 * Teile der Satisfaction und alles danach (2.6–2.10) folgen in Paket 3.2b.
 */

import { EXTRAS_OPTIONS, MEAL_DATA, SERVICE_OPTIONS } from '../data/catering';
import { clamp, clampScale } from './basics';
import {
  FLIGHT_TIME_INDEX_ANCHORS,
  LAUNCH_BONUS,
  LAUNCH_BONUS_MONTHS,
  MEAL_CATEGORIES,
  MEAL_RAMP_FROM,
  MEAL_RAMP_TO,
  MEALS_MAX,
  MENU_COURSE_SHARE,
  TYPE_APPEAL_DECAY_FROM,
  TYPE_APPEAL_DECAY_MAX,
  type AircraftClass,
  type MealCategory,
} from './constants';

// ---------------------------------------------------------------------------
// 2.1 Flugzeit-Index
// ---------------------------------------------------------------------------

/**
 * Wie lang ein Flug für die Erwartungen der Fluggäste zählt: 1 … 8, stufenlos.
 *
 * Gerade Linie zwischen den Stützpunkten `FLIGHT_TIME_INDEX_ANCHORS`
 * (30 min → 1 … 810 min → 8), darunter 1, darüber 8. SPEZIFIKATION 2.1.
 *
 * @param blockMinutes Flugzeit der Strecke in Minuten, eine Richtung.
 */
export function flightTimeIndex(blockMinutes: number): number {
  const anchors = FLIGHT_TIME_INDEX_ANCHORS;
  const [firstMinutes, firstIndex] = anchors[0];
  const [lastMinutes, lastIndex] = anchors[anchors.length - 1];
  if (blockMinutes <= firstMinutes) return firstIndex;
  if (blockMinutes >= lastMinutes) return lastIndex;
  for (let i = 1; i < anchors.length; i++) {
    const [toMinutes, toIndex] = anchors[i];
    if (blockMinutes <= toMinutes) {
      const [fromMinutes, fromIndex] = anchors[i - 1];
      const share = (blockMinutes - fromMinutes) / (toMinutes - fromMinutes);
      return fromIndex + share * (toIndex - fromIndex);
    }
  }
  // Nur bei NaN erreicht (alle Vergleiche falsch): nicht verstecken (F2).
  return Number.NaN;
}

// ---------------------------------------------------------------------------
// 2.2 Type appeal
// ---------------------------------------------------------------------------

/** Eingaben für `typeAppeal`. */
export interface TypeAppealInput {
  /** Wert `popularity` des Typs aus `src/data/aircraft.ts`. */
  readonly catalogAppeal: number;
  /** Spielmonat, in dem das Flugzeug gebaut (geliefert) wurde. */
  readonly builtMonth: number;
  /** Aktueller Spielmonat. */
  readonly month: number;
  /** Erstkunde (Lieferung im Erstkunden-Fenster einer Vorbestellung, Abschnitt 8). Standard: nein. */
  readonly launchCustomer?: boolean;
}

/** Alter in Jahren mit Bruchteil (Monate seit Bau / 12), keine Sprünge am Jahrestag (R5). SPEZIFIKATION 2.2. */
export function ageYears(builtMonth: number, month: number): number {
  return (month - builtMonth) / 12;
}

/**
 * Wie gern Fluggäste mit diesem Flugzeug fliegen: Punkte 0 … 100.
 *
 * `typeAppeal = kappen(catalogAppeal − ageDecay + launchBonus, 0, 100)` mit
 * `ageDecay = kappen(Alter − 8, 0, 15)` und `launchBonus = 5` in den ersten 24 Monaten
 * eines Erstkunden-Flugzeugs. Berechnet, nicht gespeichert; gleich für Spieler und KI.
 * SPEZIFIKATION 2.2.
 */
export function typeAppeal(input: TypeAppealInput): number {
  const { catalogAppeal, builtMonth, month, launchCustomer = false } = input;
  const ageDecay = clamp(ageYears(builtMonth, month) - TYPE_APPEAL_DECAY_FROM, 0, TYPE_APPEAL_DECAY_MAX);
  const monthsSinceBuilt = month - builtMonth;
  const launchBonus =
    launchCustomer && monthsSinceBuilt >= 0 && monthsSinceBuilt < LAUNCH_BONUS_MONTHS ? LAUNCH_BONUS : 0;
  return clampScale('typeAppeal', catalogAppeal - ageDecay + launchBonus);
}

// ---------------------------------------------------------------------------
// 2.5 Service points
// ---------------------------------------------------------------------------

/** Ein Gericht aus `MEAL_DATA`: Punkte und Stufe. */
interface MealItem {
  readonly points: number;
  readonly category: MealCategory;
}

/**
 * Nachschlagetabelle Gericht-Id → Punkte und Stufe, einmal aus `MEAL_DATA` gebaut.
 * Nur gelesen, nie geändert. (`sat` heißt in den Daten künftig `points`, SPEZIFIKATION 2.5.)
 */
const MEAL_ITEMS: ReadonlyMap<string, MealItem> = new Map(
  Object.entries(MEAL_DATA).flatMap(([category, items]) =>
    items.map((item) => [item.id, { points: item.sat, category: category as MealCategory }] as const),
  ),
);

/**
 * Wert eines Menüs (der Gerichte einer Mahlzeit): nach Punkten absteigend sortiert,
 * `p1 + 0,5 × p2 + 0,5² × p3 + …`. Das beste Gericht zählt voll, jedes weitere weniger,
 * aber immer etwas (E16, W1). SPEZIFIKATION 2.5.
 *
 * @param points Punkte der gewählten Gerichte, in beliebiger Reihenfolge.
 */
export function menuPoints(points: readonly number[]): number {
  const sorted = [...points].sort((a, b) => b - a);
  let total = 0;
  let weight = 1;
  for (const p of sorted) {
    total += weight * p;
    weight *= MENU_COURSE_SHARE;
  }
  return total;
}

/**
 * Wie viele Mahlzeiten ein Flug dieser Länge bekommt, stufenlos 1 … 3:
 * `1 + 2 × kappen((flightTimeIndex − 5) / 2,5, 0, 1)` (R5, W2). SPEZIFIKATION 2.5.
 */
export function mealCount(flightTimeIdx: number): number {
  const ramp = clamp((flightTimeIdx - MEAL_RAMP_FROM) / (MEAL_RAMP_TO - MEAL_RAMP_FROM), 0, 1);
  return 1 + (MEALS_MAX - 1) * ramp;
}

/**
 * Gewicht der Mahlzeit `k` (1, 2, 3): `kappen(mealCount − (k − 1), 0, 1)`.
 * Mahlzeit 1 zählt immer voll, 2 und 3 wachsen mit der Flugzeit stufenlos hinein.
 * Dieselben Gewichte bestimmen die Catering-Kosten (Abschnitt 5); die Formel steht nur hier.
 * SPEZIFIKATION 2.5.
 *
 * @param k Nummer der Mahlzeit, ab 1.
 */
export function mealWeight(k: number, flightTimeIdx: number): number {
  return clamp(mealCount(flightTimeIdx) - (k - 1), 0, 1);
}

/** Was Flugzeug und Strecke an Bord möglich machen (heute `validateClassConfigs`). SPEZIFIKATION 2.5. */
export interface ServiceCapability {
  /** Stufen der Gerichte, die geladen werden können. */
  readonly mealCategories: readonly MealCategory[];
  /** Flugzeug hat WLAN eingebaut (Kabinen-Extra `wifi`). */
  readonly hasWifi: boolean;
  /** Flugzeug hat die Premium-Bordküche (Kabinen-Extra `catering`). */
  readonly hasPremiumGalley: boolean;
}

/** Eingaben für `serviceCapability`. */
export interface ServiceCapabilityInput {
  /** Feld `class` des Flugzeugtyps. */
  readonly aircraftClass: AircraftClass;
  readonly hasWifi: boolean;
  readonly hasPremiumGalley: boolean;
  /** Catering-Einrichtung an mindestens einem Ende der Strecke. */
  readonly cateringFacility: boolean;
}

/**
 * Was an Bord möglich ist. Gerichte nach Flugzeugklasse (`MEAL_CATEGORIES`); eine Stufe mehr,
 * wenn das Flugzeug die Premium-Bordküche hat **und** ein Ende der Strecke eine Catering-Einrichtung.
 * SPEZIFIKATION 2.5.
 */
export function serviceCapability(input: ServiceCapabilityInput): ServiceCapability {
  const categories = MEAL_CATEGORIES[input.aircraftClass];
  if (!categories) throw new Error(`Unbekannte Flugzeugklasse: ${String(input.aircraftClass)}`);
  const upgraded = input.hasPremiumGalley && input.cateringFacility;
  return {
    mealCategories: upgraded ? categories.upgraded : categories.base,
    hasWifi: input.hasWifi,
    hasPremiumGalley: input.hasPremiumGalley,
  };
}

/** Auswahl einer Klasse auf einer Strecke. Ids aus `src/data/catering.ts`; `none` und unbekannte Ids zählen 0. */
export interface ServiceSelection {
  /** Gerichte je Mahlzeit: `meals[0]` = Mahlzeit 1 usw. Eine leere Mahlzeit zählt 0 (W15). */
  readonly meals: readonly (readonly string[])[];
  /** Extras (`EXTRAS_OPTIONS`). */
  readonly extras: readonly string[];
  /** Bordservice (`SERVICE_OPTIONS`). */
  readonly onboardService: readonly string[];
}

/** Aufschlüsselung der Service points, für Anzeige und Catering-Kosten. */
export interface ServicePointsParts {
  /** Je Mahlzeit (1 … `MEALS_MAX`): Gewicht, Menü-Wert und Beitrag = Gewicht × Menü-Wert. */
  readonly meals: readonly { readonly weight: number; readonly menuPoints: number; readonly points: number }[];
  /** Ids der Extras, die zählen (je Gruppe die beste lieferbare Stufe). */
  readonly extraIds: readonly string[];
  readonly extrasPoints: number;
  readonly onboardServicePoints: number;
  /** Summe, gekappt auf `SCALES.servicePoints`. */
  readonly total: number;
}

/** Ein Extra oder Bordservice aus den Daten. */
interface OptionData {
  readonly sat: number;
  readonly group?: string;
  readonly wifiRequired?: boolean;
  readonly galleyRequired?: boolean;
}

/**
 * Ids, die zählen: nur bekannte und lieferbare; je Gruppe (WLAN, Kits, Alkohol …) nur die beste Stufe;
 * jede Id einmal. Reihenfolge wie in der Eingabe.
 */
function countedOptions(
  ids: readonly string[],
  options: Readonly<Record<string, OptionData>>,
  capability: ServiceCapability,
): string[] {
  const deliverable = [...new Set(ids)].filter((id) => {
    const option = options[id];
    if (!option || id === 'none') return false;
    if (option.wifiRequired && !capability.hasWifi) return false;
    if (option.galleyRequired && !capability.hasPremiumGalley) return false;
    return true;
  });
  const bestOfGroup = new Map<string, string>();
  for (const id of deliverable) {
    const group = options[id].group;
    if (!group) continue;
    const best = bestOfGroup.get(group);
    if (best === undefined || options[id].sat > options[best].sat) bestOfGroup.set(group, id);
  }
  return deliverable.filter((id) => {
    const group = options[id].group;
    return !group || bestOfGroup.get(group) === id;
  });
}

/**
 * Service points mit Aufschlüsselung. Siehe `servicePoints`. SPEZIFIKATION 2.5.
 */
export function servicePointsParts(
  selection: ServiceSelection,
  blockMinutes: number,
  capability: ServiceCapability,
): ServicePointsParts {
  const fti = flightTimeIndex(blockMinutes);
  const allowed = new Set(capability.mealCategories);

  const meals = Array.from({ length: MEALS_MAX }, (_, i) => {
    const dishPoints = (selection.meals[i] ?? [])
      .map((id) => MEAL_ITEMS.get(id))
      .filter((item): item is MealItem => item !== undefined && allowed.has(item.category))
      .map((item) => item.points);
    const weight = mealWeight(i + 1, fti);
    const value = menuPoints(dishPoints);
    return { weight, menuPoints: value, points: weight * value };
  });

  const extraIds = countedOptions(selection.extras, EXTRAS_OPTIONS, capability);
  const extrasPoints = extraIds.reduce((sum, id) => sum + EXTRAS_OPTIONS[id].sat, 0);
  const serviceIds = countedOptions(selection.onboardService, SERVICE_OPTIONS, capability);
  const onboardServicePoints = serviceIds.reduce((sum, id) => sum + SERVICE_OPTIONS[id].sat, 0);

  const mealsPoints = meals.reduce((sum, meal) => sum + meal.points, 0);
  return {
    meals,
    extraIds,
    extrasPoints,
    onboardServicePoints,
    total: clampScale('servicePoints', mealsPoints + extrasPoints + onboardServicePoints),
  };
}

/**
 * Was eine Klasse an Bord an Essen, Getränken und Extras bekommt, als Punkte ≥ 0:
 *
 * `Σ_k mealWeight(k) × menuPoints(Menü k) + Extras + Bordservice`.
 *
 * Was Flugzeug oder Strecke nicht liefern können (`capability`), zählt nicht. SPEZIFIKATION 2.5.
 *
 * @param blockMinutes Flugzeit der Strecke in Minuten, eine Richtung.
 */
export function servicePoints(
  selection: ServiceSelection,
  blockMinutes: number,
  capability: ServiceCapability,
): number {
  return servicePointsParts(selection, blockMinutes, capability).total;
}
