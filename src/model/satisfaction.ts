/**
 * Zufriedenheit: SPEZIFIKATION Abschnitt 2 (ohne Kabine, die steht in `cabin.ts`).
 *
 * Stand Paket 3.2b: Flugzeit-Index (2.1), Type appeal (2.2), Service points (2.5), Teile der
 * Satisfaction (2.6), Satisfaction je Klasse (2.7), Offer satisfaction (2.8), Route und Airline
 * satisfaction (2.9), Satisfaction factor (2.10).
 *
 * Was andere Abschnitte liefern, kommt als fertige Zahl: Cabin rating (`cabin.ts`), Service points
 * (2.5), Moral (Personal, Abschnitt 8), fertige Forschungen (6.9), Fluggäste (Abschnitt 3).
 */

import { EXTRAS_OPTIONS, MEAL_DATA, SERVICE_OPTIONS } from '../data/catering';
import { clamp, clampScale } from './basics';
import {
  CABIN_CLASSES,
  CABIN_EXPECTATION,
  CABIN_LIMIT,
  CABIN_WEIGHT_BASE,
  CABIN_WEIGHT_PER_INDEX,
  DESK_CAPACITY,
  DESK_OVERLOAD_FROM,
  DESK_OVERLOAD_MAX,
  DESK_OVERLOAD_SLOPE,
  DESK_OVERLOAD_STEEP_FROM,
  DESK_OVERLOAD_STEEP_SLOPE,
  DESK_TYPE_PENALTY,
  FLIGHT_TIME_INDEX_ANCHORS,
  GROUND_WEIGHT_BASE,
  GROUND_WEIGHT_PER_INDEX,
  LAUNCH_BONUS,
  LAUNCH_BONUS_MONTHS,
  MEAL_CATEGORIES,
  MEAL_RAMP_FROM,
  MEAL_RAMP_TO,
  MEALS_MAX,
  LOUNGE_POINTS,
  MENU_COURSE_SHARE,
  MORALE_NEUTRAL,
  SAT_FACTOR_HIGH_A,
  SAT_FACTOR_HIGH_B,
  SAT_FACTOR_LOW_SLOPE,
  SAT_PER_MORALE_POINT,
  SCALES,
  SERVICE_DELIGHT,
  SERVICE_EXPECTATION,
  SHORTFALL_BASE,
  SHORTFALL_CLASS,
  SHORTFALL_PER_INDEX,
  STAND_POINTS,
  TYPE_APPEAL_DECAY_FROM,
  TYPE_APPEAL_DECAY_MAX,
  type AircraftClass,
  type CabinClass,
  type DeskType,
  type MealCategory,
} from './constants';
import { researchEffects } from './progress';

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

/** Was Flugzeug und Strecke an Bord möglich machen (Alt-Code: `validateClassConfigs`). SPEZIFIKATION 2.5. */
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

/** Was von einer Auswahl wirklich an Bord kommt (bekannt und lieferbar). */
export interface ServedItems {
  /** Ids der Gerichte je Mahlzeit (1 … `MEALS_MAX`), nur bekannte Gerichte lieferbarer Stufen. */
  readonly meals: readonly (readonly string[])[];
  /** Ids der Extras, die zählen (je Gruppe die beste lieferbare Stufe). */
  readonly extraIds: readonly string[];
  /** Ids des Bordservice, die zählen. */
  readonly onboardServiceIds: readonly string[];
}

/**
 * Was von der Auswahl an Bord kommt: nur bekannte und lieferbare Gerichte, Extras und Bordservice
 * (`capability`); je Gruppe der Extras die beste Stufe. Dieselbe Auswahl bestimmt die Service points
 * (2.5) und die Verpflegungskosten (5.7): Was zählt, kostet; was nicht an Bord kommt, kostet nichts.
 * SPEZIFIKATION 2.5, 5.7.
 */
export function servedItems(selection: ServiceSelection, capability: ServiceCapability): ServedItems {
  const allowed = new Set(capability.mealCategories);
  const meals = Array.from({ length: MEALS_MAX }, (_, i) =>
    (selection.meals[i] ?? []).filter((id) => {
      const item = MEAL_ITEMS.get(id);
      return item !== undefined && allowed.has(item.category);
    }),
  );
  return {
    meals,
    extraIds: countedOptions(selection.extras, EXTRAS_OPTIONS, capability),
    onboardServiceIds: countedOptions(selection.onboardService, SERVICE_OPTIONS, capability),
  };
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
  const served = servedItems(selection, capability);

  const meals = served.meals.map((dishes, i) => {
    const dishPoints = dishes.map((id) => (MEAL_ITEMS.get(id) as MealItem).points);
    const weight = mealWeight(i + 1, fti);
    const value = menuPoints(dishPoints);
    return { weight, menuPoints: value, points: weight * value };
  });

  const extraIds = served.extraIds;
  const extrasPoints = extraIds.reduce((sum, id) => sum + EXTRAS_OPTIONS[id].sat, 0);
  const onboardServicePoints = served.onboardServiceIds.reduce((sum, id) => sum + SERVICE_OPTIONS[id].sat, 0);

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

// ---------------------------------------------------------------------------
// 2.6.1 Kabinen-Teil
// ---------------------------------------------------------------------------

/** `CABIN_WEIGHT_BASE + CABIN_WEIGHT_PER_INDEX × (flightTimeIndex − 1)`: 0,5 bei 30 min, 1,2 ab 810 min. SPEZIFIKATION 2.6.1. */
export function cabinWeight(flightTimeIdx: number): number {
  return CABIN_WEIGHT_BASE + CABIN_WEIGHT_PER_INDEX * (flightTimeIdx - 1);
}

/**
 * Kabinen-Teil: `30 × tanh((cabinRating − Erwartung) × cabinWeight / 30)`.
 * 0 bei Erwartung, nie mehr als ± `CABIN_LIMIT`; auf Langstrecke stärker. SPEZIFIKATION 2.6.1.
 *
 * @param cabinRatingValue `cabinRating` der Klasse (2.4).
 */
export function cabinPart(cabinClass: CabinClass, cabinRatingValue: number, flightTimeIdx: number): number {
  const gap = cabinRatingValue - CABIN_EXPECTATION[cabinClass];
  return CABIN_LIMIT * Math.tanh((gap * cabinWeight(flightTimeIdx)) / CABIN_LIMIT);
}

// ---------------------------------------------------------------------------
// 2.6.2 Service-Teil
// ---------------------------------------------------------------------------

/** Service points, die eine Klasse bei dieser Flugzeit erwartet. SPEZIFIKATION 2.6.2. */
export function expectedServicePoints(cabinClass: CabinClass, flightTimeIdx: number): number {
  const { base, perIndex } = SERVICE_EXPECTATION[cabinClass];
  return base + perIndex * (flightTimeIdx - 1);
}

/** Abzug für gar keinen Service: `(6 + 9 × (Index − 1)) × SHORTFALL_CLASS[c]`. SPEZIFIKATION 2.6.2. */
export function maxServiceShortfall(cabinClass: CabinClass, flightTimeIdx: number): number {
  return (SHORTFALL_BASE + SHORTFALL_PER_INDEX * (flightTimeIdx - 1)) * SHORTFALL_CLASS[cabinClass];
}

/**
 * Service-Teil aus `ratio = servicePoints / erwartet`:
 * unter Erwartung `−maxShortfall × (1 − ratio)`, ab Erwartung `25 × (1 − e^−(ratio − 1))`.
 * 0 genau bei Erwartung; nie unter `−maxShortfall`, nie über `SERVICE_DELIGHT`. SPEZIFIKATION 2.6.2.
 */
export function servicePart(cabinClass: CabinClass, servicePointsValue: number, flightTimeIdx: number): number {
  const ratio = servicePointsValue / expectedServicePoints(cabinClass, flightTimeIdx);
  if (ratio < 1) return -maxServiceShortfall(cabinClass, flightTimeIdx) * (1 - ratio);
  return SERVICE_DELIGHT * (1 - Math.exp(-(ratio - 1)));
}

// ---------------------------------------------------------------------------
// 2.6.3 Boden-Teil
// ---------------------------------------------------------------------------

/** `GROUND_WEIGHT_BASE − GROUND_WEIGHT_PER_INDEX × (flightTimeIndex − 1)`: 1,2 bei 30 min, 0,5 ab 810 min. SPEZIFIKATION 2.6.3. */
export function groundWeight(flightTimeIdx: number): number {
  return GROUND_WEIGHT_BASE - GROUND_WEIGHT_PER_INDEX * (flightTimeIdx - 1);
}

/** Eigene Check-in-Schalter einer Gesellschaft an einem Flughafen, je Art. */
export type Desks = Readonly<Record<DeskType, number>>;

/** Sitze je Woche, die die Schalter abfertigen: `5 000 × bediente + 10 000 × Selbstbedienung`. SPEZIFIKATION 2.6.3. */
export function deskCapacity(desks: Desks): number {
  return DESK_CAPACITY.normal * desks.normal + DESK_CAPACITY.self * desks.self;
}

/**
 * Schalter-Auslastung einer Gesellschaft an einem Flughafen, als Anteil (1 = voll):
 * Sitze aller eigenen Abflüge dort je Woche / Kapazität. Gezählt werden **Sitze**, nicht Fluggäste
 * (kein Kreis über die Nachfrage). Eine Funktion für Satisfaction (2.6.3) und Schalter-Miete (5.10).
 * Ohne Sitze 0; Sitze ohne jeden Schalter (Pflicht verletzt, E18, E55) = unendlich (F21). SPEZIFIKATION 2.6.3.
 *
 * @param departingSeatsPerWeek Σ Sitze je Flug × Abflüge je Woche **von diesem Flughafen** aller eigenen
 *   Strecken; im Planer zählt die geplante Strecke mit.
 */
export function deskLoad(departingSeatsPerWeek: number, desks: Desks): number {
  if (departingSeatsPerWeek === 0) return 0;
  return departingSeatsPerWeek / deskCapacity(desks);
}

/**
 * Abzug für überlastete Schalter, −20 … 0: bis 80 % nichts; 80 … 100 % −0,2 je Prozentpunkt (−4 bei 100 %);
 * darüber −4 − 1,6 je Prozentpunkt, höchstens −20 (Alt-Code: `getDeskOverloadSat`). SPEZIFIKATION 2.6.3.
 *
 * @param load `deskLoad` als Anteil.
 */
export function deskOverloadPoints(load: number): number {
  const percent = load * 100;
  const from = DESK_OVERLOAD_FROM * 100;
  const steepFrom = DESK_OVERLOAD_STEEP_FROM * 100;
  if (percent <= from) return 0;
  if (percent <= steepFrom) return -DESK_OVERLOAD_SLOPE * (percent - from);
  const atSteep = DESK_OVERLOAD_SLOPE * (steepFrom - from);
  return -Math.min(DESK_OVERLOAD_MAX, atSteep + DESK_OVERLOAD_STEEP_SLOPE * (percent - steepFrom));
}

/** Eigene Einrichtungen einer Gesellschaft an einem Ende der Strecke. */
export interface GroundSide {
  /** Eigene VIP-Lounge vorhanden. */
  readonly lounge: boolean;
  /** Abstellplätze der Größenklasse des Flugzeugs. */
  readonly stands: number;
  /** Belegte Slots der Größenklasse des Flugzeugs (Abflüge je Woche, E50). */
  readonly occupiedSlots: number;
  /** Eigene Check-in-Schalter je Art. */
  readonly desks: Desks;
  /** Sitze aller eigenen Abflüge von hier je Woche, für `deskLoad`. */
  readonly departingSeatsPerWeek: number;
}

/** Die vier Bodenteile, in Satisfaction-Punkten (vor Mittel und Bodengewicht oder danach). */
export interface GroundParts {
  readonly lounge: number;
  readonly stands: number;
  readonly deskType: number;
  readonly deskOverload: number;
}

/** Bodenteile an einem Flughafen, vor dem Mittel beider Enden und vor dem Bodengewicht. SPEZIFIKATION 2.6.3. */
export function groundSidePoints(cabinClass: CabinClass, side: GroundSide): GroundParts {
  const coverage = side.occupiedSlots > 0 ? Math.min(1, side.stands / side.occupiedSlots) : 0;
  const premiumClass = cabinClass !== 'economy';
  return {
    lounge: side.lounge ? LOUNGE_POINTS[cabinClass] : 0,
    stands: STAND_POINTS * coverage,
    deskType: premiumClass && side.desks.normal < 1 ? DESK_TYPE_PENALTY : 0,
    deskOverload: deskOverloadPoints(deskLoad(side.departingSeatsPerWeek, side.desks)),
  };
}

/** Boden-Teil mit Aufschlüsselung: jeder Teil als Mittel beider Enden × Bodengewicht. */
export interface GroundPartParts extends GroundParts {
  readonly weight: number;
  /** Summe der vier Teile = `groundPart`. */
  readonly total: number;
}

/**
 * Boden-Teil mit Aufschlüsselung:
 * `groundPart = groundWeight × Σ_Teil (Teil(Start) + Teil(Ziel)) / 2` (E17, W3). Beide Enden sind
 * Abflughäfen (E55). SPEZIFIKATION 2.6.3.
 */
export function groundPartParts(
  cabinClass: CabinClass,
  origin: GroundSide,
  destination: GroundSide,
  flightTimeIdx: number,
): GroundPartParts {
  const weight = groundWeight(flightTimeIdx);
  const a = groundSidePoints(cabinClass, origin);
  const b = groundSidePoints(cabinClass, destination);
  const part = (key: keyof GroundParts) => (weight * (a[key] + b[key])) / 2;
  const lounge = part('lounge');
  const stands = part('stands');
  const deskType = part('deskType');
  const deskOverload = part('deskOverload');
  return { lounge, stands, deskType, deskOverload, weight, total: lounge + stands + deskType + deskOverload };
}

/** Boden-Teil einer Klasse. Siehe `groundPartParts`. SPEZIFIKATION 2.6.3. */
export function groundPart(
  cabinClass: CabinClass,
  origin: GroundSide,
  destination: GroundSide,
  flightTimeIdx: number,
): number {
  return groundPartParts(cabinClass, origin, destination, flightTimeIdx).total;
}

// ---------------------------------------------------------------------------
// 2.6.4 Personal-Teil, 2.6.5 Forschungs-Teil
// ---------------------------------------------------------------------------

/** `(morale − 50) × 0,1`, −5 … +5, gleich für alle Klassen. KI: 0 (kein Personal-Modell). SPEZIFIKATION 2.6.4. */
export function staffPart(morale: number): number {
  return (morale - MORALE_NEUTRAL) * SAT_PER_MORALE_POINT;
}

/**
 * Summe der Satisfaction-Punkte aller fertigen Forschungen (Feld `satisfactionPoints` der Forschungs-Tabelle,
 * 6.9), gleich für alle Klassen, höchstens +8. Jede Id zählt einmal; andere Ids zählen 0. KI: 0.
 * SPEZIFIKATION 2.6.5.
 *
 * @param completedResearch Ids der fertigen Forschungen.
 */
export function researchPart(completedResearch: readonly string[]): number {
  return researchEffects(completedResearch).satisfactionPoints;
}

// ---------------------------------------------------------------------------
// 2.7 Satisfaction je Klasse
// ---------------------------------------------------------------------------

/** Was eine Klasse einer Strecke für ihre Satisfaction braucht (aus 2.4, 2.5). */
export interface ClassSatisfactionInput {
  /** `cabinRating` dieser Klasse im Flugzeug der Strecke (2.4). */
  readonly cabinRating: number;
  /** `servicePoints` dieser Klasse auf der Strecke (2.5). */
  readonly servicePoints: number;
}

/** Was alle Klassen einer Strecke gemeinsam haben. */
export interface RouteSatisfactionInput {
  /** Flugzeit der Strecke in Minuten, eine Richtung (`blockMinutes`, 3.1). */
  readonly blockMinutes: number;
  /** Eigene Einrichtungen am Start-Flughafen. */
  readonly origin: GroundSide;
  /** Eigene Einrichtungen am Ziel-Flughafen. */
  readonly destination: GroundSide;
  /** Personalmoral 0 … 100; Standard 50 (neutral). KI: 50. */
  readonly morale?: number;
  /** Ids der fertigen Forschungen; Standard keine. KI: keine. */
  readonly completedResearch?: readonly string[];
}

/** Alle Teile der Satisfaction einer Klasse. */
export interface ClassSatisfactionBreakdown {
  readonly flightTimeIndex: number;
  readonly cabinPart: number;
  /** Erwartete Service points, für die Anzeige „geliefert / erwartet“. */
  readonly expectedServicePoints: number;
  readonly servicePart: number;
  readonly groundPart: GroundPartParts;
  readonly staffPart: number;
  readonly researchPart: number;
  /** `100 + Summe der Teile`, vor dem Kappen. */
  readonly unclamped: number;
  /** `satisfaction(c)`, gekappt auf 0 … 160, ungerundet. */
  readonly satisfaction: number;
}

/**
 * Satisfaction einer Klasse mit allen Teilen:
 * `kappen(100 + cabinPart + servicePart + groundPart + staffPart + researchPart, 0, 160)`,
 * einmal gekappt, ungerundet (R4, W6). Keine Schwierigkeit, keine gestrichenen Flüge, kein Eigentümer
 * (Spieler und KI gleich). SPEZIFIKATION 2.7.
 */
export function classSatisfactionBreakdown(
  cabinClass: CabinClass,
  classInput: ClassSatisfactionInput,
  route: RouteSatisfactionInput,
): ClassSatisfactionBreakdown {
  const fti = flightTimeIndex(route.blockMinutes);
  const cabin = cabinPart(cabinClass, classInput.cabinRating, fti);
  const service = servicePart(cabinClass, classInput.servicePoints, fti);
  const ground = groundPartParts(cabinClass, route.origin, route.destination, fti);
  const staff = staffPart(route.morale ?? MORALE_NEUTRAL);
  const research = researchPart(route.completedResearch ?? []);
  const unclamped = SCALES.satisfaction.neutral + cabin + service + ground.total + staff + research;
  return {
    flightTimeIndex: fti,
    cabinPart: cabin,
    expectedServicePoints: expectedServicePoints(cabinClass, fti),
    servicePart: service,
    groundPart: ground,
    staffPart: staff,
    researchPart: research,
    unclamped,
    satisfaction: clampScale('satisfaction', unclamped),
  };
}

/**
 * Die eine Funktion für die Satisfaction einer Strecke (R2, E44): je Klasse mit Sitzen alle Teile und
 * die Satisfaction. Klassen ohne Sitze fehlen im Ergebnis. Planer, Overlay, Streckenansicht, Bericht und
 * Monatsabschluss lesen nur diese Funktion. SPEZIFIKATION 2.7.
 *
 * @param classes Je Klasse mit Sitzen Cabin rating und Service points.
 */
export function satisfactionBreakdown(
  classes: Readonly<Partial<Record<CabinClass, ClassSatisfactionInput>>>,
  route: RouteSatisfactionInput,
): Partial<Record<CabinClass, ClassSatisfactionBreakdown>> {
  const result: Partial<Record<CabinClass, ClassSatisfactionBreakdown>> = {};
  for (const cabinClass of CABIN_CLASSES) {
    const classInput = classes[cabinClass];
    if (classInput) result[cabinClass] = classSatisfactionBreakdown(cabinClass, classInput, route);
  }
  return result;
}

/** Satisfaction einer Klasse, 0 … 160 (100 = wie erwartet). Siehe `classSatisfactionBreakdown`. SPEZIFIKATION 2.7. */
export function satisfaction(
  cabinClass: CabinClass,
  classInput: ClassSatisfactionInput,
  route: RouteSatisfactionInput,
): number {
  return classSatisfactionBreakdown(cabinClass, classInput, route).satisfaction;
}

// ---------------------------------------------------------------------------
// 2.8 Offer satisfaction
// ---------------------------------------------------------------------------

/** Gewichtetes Mittel; ohne Gewicht `undefined`. */
function weightedMean(entries: readonly { readonly value: number; readonly weight: number }[]): number | undefined {
  let weightSum = 0;
  let sum = 0;
  for (const { value, weight } of entries) {
    if (weight <= 0) continue;
    weightSum += weight;
    sum += weight * value;
  }
  return weightSum > 0 ? sum / weightSum : undefined;
}

/**
 * Offer satisfaction einer Klasse im Direktangebot einer Gesellschaft auf einem Paar (R1): Mittel der
 * `satisfaction(c)` ihrer Strecken mit Sitzen in `c`, gewichtet nach Sitzen je Woche in `c`. Weil sich die
 * Fluggäste eines Angebots nach Sitzen verteilen (3.11), ist das zugleich nach Fluggästen (E10).
 * Ohne Sitze in `c` `undefined`: Das Angebot nimmt am Markt `c` nicht teil (F21). SPEZIFIKATION 2.8.
 */
export function directOfferSatisfaction(
  routes: readonly { readonly satisfaction: number; readonly seatsPerWeek: number }[],
): number | undefined {
  return weightedMean(routes.map((r) => ({ value: r.satisfaction, weight: r.seatsPerWeek })));
}

/**
 * Offer satisfaction einer Klasse einer Umsteige-Verbindung: Mittel der `offerSatisfaction(c)` der
 * Teilstrecken, gewichtet nach `blockMinutes`. SPEZIFIKATION 2.8, 3.13.
 */
export function connectionOfferSatisfaction(
  legs: readonly { readonly offerSatisfaction: number; readonly blockMinutes: number }[],
): number | undefined {
  return weightedMean(legs.map((l) => ({ value: l.offerSatisfaction, weight: l.blockMinutes })));
}

// ---------------------------------------------------------------------------
// 2.9 Route satisfaction und Airline satisfaction
// ---------------------------------------------------------------------------

/**
 * Route satisfaction: Mittel der `satisfaction(c)` der Klassen nach Fluggästen je Woche (E10); ohne
 * Fluggäste nach Sitzen; ohne beides 100 (F21). Nur Anzeige. SPEZIFIKATION 2.9.
 */
export function routeSatisfaction(
  classes: readonly { readonly satisfaction: number; readonly passengers: number; readonly seats: number }[],
): number {
  const byPassengers = weightedMean(classes.map((c) => ({ value: c.satisfaction, weight: c.passengers })));
  const bySeats = weightedMean(classes.map((c) => ({ value: c.satisfaction, weight: c.seats })));
  return clampScale('routeSatisfaction', byPassengers ?? bySeats ?? SCALES.routeSatisfaction.neutral);
}

/**
 * Airline satisfaction eines Monats: Mittel der `satisfaction(c)` über alle Strecken und Klassen, nach
 * beförderten Fluggästen (E10, E39). Ohne Fluggäste 100. Gestrichene Flüge senken sie nicht (E33).
 * Spieler und KI. Wirkt auf das Ruf-Ziel (Abschnitt 6). SPEZIFIKATION 2.9.
 */
export function airlineSatisfaction(
  entries: readonly { readonly satisfaction: number; readonly passengers: number }[],
): number {
  const mean = weightedMean(entries.map((e) => ({ value: e.satisfaction, weight: e.passengers })));
  return clampScale('satisfaction', mean ?? SCALES.satisfaction.neutral);
}

// ---------------------------------------------------------------------------
// 2.10 Satisfaction factor
// ---------------------------------------------------------------------------

/**
 * Zahlungsbereitschaft für Satisfaction `s` gegenüber Satisfaction 100: bis 100
 * `1 − 0,005 × (100 − s)` (0 → 0,5; 50 → 0,75), darüber `1 + 0,008 × (s − 100) − 0,000035 × (s − 100)²`
 * (160 → ≈ 1,35). Die einzige Wirkung der Satisfaction im Markt: Feld `satisfactionFactor` der Anziehung
 * (3.9.2). SPEZIFIKATION 2.10.
 *
 * @param offerSatisfactionValue `offerSatisfaction(c)` (2.8).
 */
export function satisfactionFactor(offerSatisfactionValue: number): number {
  const excess = offerSatisfactionValue - SCALES.satisfaction.neutral;
  if (excess <= 0) return 1 + SAT_FACTOR_LOW_SLOPE * excess;
  return 1 + SAT_FACTOR_HIGH_A * excess - SAT_FACTOR_HIGH_B * excess * excess;
}
