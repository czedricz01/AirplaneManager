/**
 * Zentrale Konstanten des neuen Rechenmodells.
 *
 * Jede Zahl, die das Modell als Regel festlegt, steht hier und nur hier.
 * Funktionen in `src/model/` lesen sie von hier; Erklärtexte in der Oberfläche
 * werden später (Paket 4.1) ebenfalls daraus erzeugt.
 *
 * Schreibweise:
 * - Feste Dollar-Beträge stehen als Wert von 1960 mit der Endung `_1960`
 *   (z. B. `SLOT_PRICE_NARROWBODY_1960`). Umgerechnet wird nur über `atCost`
 *   (`basics.ts`), nie direkt mit dem Kostenindex.
 * - Anteile und Prozent intern als 0 … 1.
 * - Jeder Wert nennt den Abschnitt von `docs/neubau/SPEZIFIKATION.md`, der ihn festlegt.
 */

// ---------------------------------------------------------------------------
// 1.1 Zeit
// ---------------------------------------------------------------------------

/** Kalenderjahr von Spielmonat 0 (Januar 1960). SPEZIFIKATION 1.1. */
export const START_YEAR = 1960;

/** Tage je Jahr im Mittel (mit Schaltjahren). */
export const DAYS_PER_YEAR = 365.25;

/**
 * Wochen je Spielmonat: 365,25 / 12 / 7 ≈ 4,348. Überall dieselbe Konstante.
 * Monatswert = Wochenwert × `WEEKS_PER_MONTH`. SPEZIFIKATION 1.1, E5.
 */
export const WEEKS_PER_MONTH = DAYS_PER_YEAR / 12 / 7;

// ---------------------------------------------------------------------------
// 1.2 Raum und Mengen
// ---------------------------------------------------------------------------

/** Liter je US-Gallone; die Treibstoff-Tabelle ist in $ je Gallone. SPEZIFIKATION 1.2. */
export const LITRES_PER_GALLON = 3.78541;

// ---------------------------------------------------------------------------
// 1.3 Geld und Kostenindex
// ---------------------------------------------------------------------------

/**
 * Wachstum des Kostenindex je Jahr (1,2 %). Startwert von heute
 * (`src/lib/realCosts.ts:19`); endgültiger Wert aus dem Balance-Skript (3.9). SPEZIFIKATION 1.3, E7.
 */
export const COST_GROWTH = 0.012;

/** Nach diesem Jahr wächst der Kostenindex nicht mehr. SPEZIFIKATION 1.3. */
export const COST_INDEX_LAST_YEAR = 2100;

// ---------------------------------------------------------------------------
// 1.4 Skalen
// ---------------------------------------------------------------------------

/** Eine Skala: Bereich und, wo es einen gibt, Neutralpunkt. */
export interface Scale {
  readonly min: number;
  readonly max: number;
  /** Üblicher Wert, bei dem die Größe nichts verschiebt (z. B. Ruf 50). */
  readonly neutral?: number;
}

/**
 * Alle Skalen aus SPEZIFIKATION 1.4. Eine Skala wird genau einmal gekappt:
 * am Ende der Funktion, die die Größe festlegt (R4), mit `clampScale` (`basics.ts`).
 */
export const SCALES = {
  /** Satisfaction je Klasse, Punkte. 100 = „wie erwartet“, 160 = Spitze. E9, E14. */
  satisfaction: { min: 0, max: 160, neutral: 100 },
  /** Route satisfaction, Punkte; Mittel der Klassen nach Fluggästen (E10). */
  routeSatisfaction: { min: 0, max: 160, neutral: 100 },
  /** Cabin rating eines Flugzeugs, Punkte. E9. */
  cabinRating: { min: 0, max: 100 },
  /** Type appeal eines Flugzeugtyps, Punkte. E9. */
  typeAppeal: { min: 0, max: 100 },
  /** Service points, Punkte ≥ 0, ohne Obergrenze (SPEZIFIKATION 2.5). */
  servicePoints: { min: 0, max: Number.POSITIVE_INFINITY },
  /** Reputation, Punkte. 50 = neutral (Nachfrage-Faktor 1), Start 50. E36. */
  reputation: { min: 0, max: 100, neutral: 50 },
  /** Zustand der Kabine, Prozent (Ausnahme: in % gespeichert). 100 = neu. */
  cabinCondition: { min: 0, max: 100 },
  /** Zustand der Zelle, Prozent. 100 = neu. */
  airframeCondition: { min: 0, max: 100 },
  /** Passenger share, Anteil 0 … 1. E9. */
  passengerShare: { min: 0, max: 1 },
  /** Departure share, Anteil 0 … 1. E9. */
  departureShare: { min: 0, max: 1 },
} as const satisfies Record<string, Scale>;

/** Name einer Skala aus `SCALES`. */
export type ScaleName = keyof typeof SCALES;

// ---------------------------------------------------------------------------
// 1.8 Schwierigkeit
// ---------------------------------------------------------------------------

/** Schwierigkeit des Spielers. SPEZIFIKATION 1.8. */
export type Difficulty = 'Easy' | 'Normal' | 'Hard';

/**
 * Faktor auf die Anziehung der Spieler-Angebote (E4, E53). Normal = 1.
 * Startwerte; endgültige Werte aus dem Balance-Skript (3.9). SPEZIFIKATION 1.8.
 */
export const DIFFICULTY_FACTOR: Readonly<Record<Difficulty, number>> = {
  Easy: 1.1,
  Normal: 1,
  Hard: 0.9,
};

// ---------------------------------------------------------------------------
// 2.1 Flugzeit-Index
// ---------------------------------------------------------------------------

/**
 * Stützpunkte des Flugzeit-Index als [Minuten, Index]. Dazwischen gerade Linie,
 * darunter 1, darüber 8 (wie heute `src/lib/financeUtils.ts:246-262`). SPEZIFIKATION 2.1.
 */
export const FLIGHT_TIME_INDEX_ANCHORS: readonly (readonly [minutes: number, index: number])[] = [
  [30, 1],
  [90, 2],
  [150, 3],
  [210, 4],
  [300, 5],
  [450, 6],
  [630, 7],
  [810, 8],
];

// ---------------------------------------------------------------------------
// 2.2 Type appeal
// ---------------------------------------------------------------------------

/** Ab diesem Alter (Jahre) verliert ein Flugzeug Type appeal (heute `src/lib/fleetCosts.ts:27`). SPEZIFIKATION 2.2. */
export const TYPE_APPEAL_DECAY_FROM = 8;

/** Höchster Verlust an Type appeal durch das Alter, Punkte (heute `src/lib/fleetCosts.ts:28`). SPEZIFIKATION 2.2. */
export const TYPE_APPEAL_DECAY_MAX = 15;

/** Erstkunden-Bonus auf den Type appeal, Punkte (heute `src/lib/preorders.ts:31`). SPEZIFIKATION 2.2, 8. */
export const LAUNCH_BONUS = 5;

/** So viele Monate ab Lieferung gilt der Erstkunden-Bonus (heute `src/lib/preorders.ts:32`). SPEZIFIKATION 2.2, 8. */
export const LAUNCH_BONUS_MONTHS = 24;

// ---------------------------------------------------------------------------
// 2.3 Interior score
// ---------------------------------------------------------------------------

/** Die vier Klassen einer Kabine. */
export type CabinClass = 'economy' | 'premium' | 'business' | 'first';

/** Alle Klassen, von der günstigsten zur teuersten. */
export const CABIN_CLASSES: readonly CabinClass[] = ['economy', 'premium', 'business', 'first'];

/** Ein Ausstattungs-Teil: Punkte im Interior score und erster Spielmonat, in dem er lieferbar ist. */
export interface InteriorItem {
  readonly points: number;
  /** Erster Spielmonat, in dem das Teil eingebaut werden kann (Lieferbarkeit, Daten wie heute). */
  readonly availableFrom: number;
  /** Nur in Flugzeugtypen mit mindestens so vielen Sitzen (Typ-Feld `capacity`). */
  readonly minCapacity?: number;
}

/** Grundwert des Interior score je Klasse (heute `ConfigurePurchaseView.tsx:403-442`). SPEZIFIKATION 2.3. */
export const INTERIOR_BASE: Readonly<Record<CabinClass, number>> = {
  economy: 50,
  premium: 55,
  business: 60,
  first: 70,
};

/** Die Punkte des Sitztyps zählen so oft (heute `ConfigurePurchaseView.tsx:109`). SPEZIFIKATION 2.3. */
export const SEAT_TYPE_FACTOR = 2;

/** Üblicher Sitzabstand je Klasse in cm; darüber Punkte dazu, darunter ab. SPEZIFIKATION 2.3. */
export const PITCH_NORM: Readonly<Record<CabinClass, number>> = {
  economy: 74,
  premium: 85,
  business: 100,
  first: 150,
};

/** Punkte je cm Sitzabstand über oder unter `PITCH_NORM`. SPEZIFIKATION 2.3. */
export const PITCH_FACTOR: Readonly<Record<CabinClass, number>> = {
  economy: 4,
  premium: 3,
  business: 2.4,
  first: 1.6,
};

/**
 * Sitztypen je Klasse (Name wie gespeichert in `seatType`). Punkte und Lieferbarkeit wie heute
 * `ConfigurePurchaseView.tsx:326-353` (`pop`, `req`). Ein unbekannter oder noch nicht lieferbarer
 * Sitztyp zählt wie `Standard` (0 Punkte). Kosten und Platzbedarf der Sitze folgen mit Abschnitt 5.
 * SPEZIFIKATION 2.3.
 */
export const SEAT_TYPE_POINTS: Readonly<Record<CabinClass, Readonly<Record<string, InteriorItem>>>> = {
  economy: {
    Standard: { points: 0, availableFrom: 0 },
    Comfort: { points: 5, availableFrom: 0 },
    Ergonomic: { points: 15, availableFrom: 600 },
    'Premium-Eco': { points: 25, availableFrom: 660 },
  },
  premium: {
    Standard: { points: 0, availableFrom: 0 },
    Recliner: { points: 20, availableFrom: 0 },
    Cradle: { points: 35, availableFrom: 600 },
  },
  business: {
    Standard: { points: 0, availableFrom: 0 },
    Recliner: { points: 10, availableFrom: 0 },
    'Angled Flat': { points: 20, availableFrom: 480 },
    'Lie-Flat': { points: 35, availableFrom: 540 },
    Suites: { points: 50, availableFrom: 660 },
  },
  first: {
    Standard: { points: 0, availableFrom: 0 },
    Recliner: { points: 10, availableFrom: 0 },
    'Flat Bed': { points: 20, availableFrom: 360 },
    'Open Suite': { points: 30, availableFrom: 420 },
    'Closed Suite': { points: 50, availableFrom: 540 },
    Residence: { points: 80, availableFrom: 648 },
  },
};

/**
 * Ausstattung je Klasse: Punkte und Lieferbarkeit wie heute `FEATURE_POP`
 * (`ConfigurePurchaseView.tsx:98-103`) und die Monatsgrenzen in `:405-450`. SPEZIFIKATION 2.3.
 */
export const FEATURE_POINTS: Readonly<Record<CabinClass, Readonly<Record<string, InteriorItem>>>> = {
  economy: {
    ife: { points: 5, availableFrom: 240 },
    power: { points: 5, availableFrom: 420 },
    hooks: { points: 1, availableFrom: 180 },
    armrests: { points: 2.5, availableFrom: 300 },
    headrests: { points: 2.5, availableFrom: 420 },
    shell: { points: 5, availableFrom: 540 },
    ped: { points: 4, availableFrom: 660 },
  },
  premium: {
    ife: { points: 5, availableFrom: 240 },
    power: { points: 5, availableFrom: 420 },
    table: { points: 2.5, availableFrom: 180 },
    calf: { points: 5, availableFrom: 300 },
    foot: { points: 4, availableFrom: 420 },
    light: { points: 2.5, availableFrom: 600 },
    usbc: { points: 4, availableFrom: 720 },
  },
  business: {
    ife: { points: 7.5, availableFrom: 240 },
    power: { points: 5, availableFrom: 360 },
    lumbar: { points: 4, availableFrom: 180 },
    control: { points: 7.5, availableFrom: 300 },
    massage: { points: 10, availableFrom: 420 },
    divider: { points: 12.5, availableFrom: 540 },
    charging: { points: 5, availableFrom: 720 },
  },
  first: {
    ife: { points: 10, availableFrom: 240 },
    power: { points: 7.5, availableFrom: 360 },
    wardrobe: { points: 7.5, availableFrom: 240 },
    wood: { points: 12.5, availableFrom: 360 },
    mirror: { points: 5, availableFrom: 480 },
    minibar: { points: 15, availableFrom: 600 },
    climate: { points: 17.5, availableFrom: 720 },
  },
};

/** Kabinenweite Extras. */
export type CabinExtra = 'wifi' | 'ambient' | 'catering' | 'bar' | 'shower' | 'reduced' | 'minimal';

/**
 * Kabinenweite Extras: wirken in jeder Klasse gleich. Punkte wie heute `CABIN_EXTRA_POP`
 * (`ConfigurePurchaseView.tsx:106`), Lieferbarkeit wie `:386-389`. „reduced“ (kleinere Bordküche)
 * und „minimal“ (Minimal services) sind Abzüge für mehr Platz. SPEZIFIKATION 2.3.
 */
export const CABIN_EXTRA_POINTS: Readonly<Record<CabinExtra, InteriorItem>> = {
  wifi: { points: 5, availableFrom: 480 },
  ambient: { points: 2.5, availableFrom: 540 },
  catering: { points: 2.5, availableFrom: 0 },
  bar: { points: 7.5, availableFrom: 120, minCapacity: 200 },
  shower: { points: 10, availableFrom: 576, minCapacity: 300 },
  reduced: { points: -2.5, availableFrom: 0 },
  minimal: { points: -7.5, availableFrom: 0 },
};

// ---------------------------------------------------------------------------
// 2.4 Cabin rating
// ---------------------------------------------------------------------------

/** Anteil des Type appeal am Cabin rating (heute `src/lib/financeUtils.ts:523`). SPEZIFIKATION 2.4. */
export const TYPE_APPEAL_SHARE = 0.33;

/** Anteil des Interior score am Cabin rating (heute `src/lib/financeUtils.ts:523`). SPEZIFIKATION 2.4. */
export const INTERIOR_SHARE = 0.67;

/** So viel vom Interior score behält eine ganz abgenutzte Kabine (heute `src/lib/financeUtils.ts:499`). SPEZIFIKATION 2.4. */
export const WEAR_FLOOR = 0.4;

// ---------------------------------------------------------------------------
// 2.5 Service points
// ---------------------------------------------------------------------------

/** Jedes weitere Gericht einer Mahlzeit zählt so viel wie das vorige mal diesen Anteil (E16). SPEZIFIKATION 2.5. */
export const MENU_COURSE_SHARE = 0.5;

/** Höchstens so viele Mahlzeiten je Flug. SPEZIFIKATION 2.5. */
export const MEALS_MAX = 3;

/** Ab diesem Flugzeit-Index (300 min) wächst die zweite Mahlzeit hinein. SPEZIFIKATION 2.5. */
export const MEAL_RAMP_FROM = 5;

/** Bei diesem Flugzeit-Index (720 min) zählen alle `MEALS_MAX` Mahlzeiten voll. SPEZIFIKATION 2.5. */
export const MEAL_RAMP_TO = 7.5;

/** Flugzeugklassen aus `src/data/aircraft.ts` (Feld `class`). */
export type AircraftClass = 'Regional' | 'Narrowbody' | 'Widebody';

/** Alle Flugzeugklassen der Daten; zugleich die Arten der Slots und Abstellplätze (5.10). */
export const AIRCRAFT_CLASSES: readonly AircraftClass[] = ['Regional', 'Narrowbody', 'Widebody'];

/** Stufen der Gerichte, wie die Gruppen in `MEAL_DATA` (`src/data/catering.ts`). */
export type MealCategory = 'Basic' | 'Standard' | 'Premium' | 'Luxury';

/**
 * Welche Gerichte ein Flugzeug laden kann: ohne und mit Catering-Upgrade (Catering-Einrichtung an einem
 * Ende der Strecke **und** Premium-Bordküche im Flugzeug). Wie heute `validateClassConfigs`
 * (`src/lib/financeUtils.ts:325-336`). SPEZIFIKATION 2.5.
 */
export const MEAL_CATEGORIES: Readonly<
  Record<AircraftClass, { readonly base: readonly MealCategory[]; readonly upgraded: readonly MealCategory[] }>
> = {
  Regional: { base: ['Basic'], upgraded: ['Basic', 'Standard'] },
  Narrowbody: { base: ['Basic', 'Standard'], upgraded: ['Basic', 'Standard', 'Premium'] },
  Widebody: { base: ['Basic', 'Standard', 'Premium'], upgraded: ['Basic', 'Standard', 'Premium', 'Luxury'] },
};

// ---------------------------------------------------------------------------
// 2.6.1 Kabinen-Teil
// ---------------------------------------------------------------------------

/** Cabin rating, das eine Klasse erwartet (heute `src/lib/financeUtils.ts:779`). SPEZIFIKATION 2.6.1. */
export const CABIN_EXPECTATION: Readonly<Record<CabinClass, number>> = {
  economy: 55,
  premium: 60,
  business: 68,
  first: 80,
};

/** Satisfaction-Punkte je Cabin-rating-Punkt bei Flugzeit-Index 1. SPEZIFIKATION 2.6.1. */
export const CABIN_WEIGHT_BASE = 0.5;

/** Zusätzliches Kabinen-Gewicht je Index-Stufe (0,5 bei 30 min, 1,2 ab 810 min). SPEZIFIKATION 2.6.1. */
export const CABIN_WEIGHT_PER_INDEX = 0.1;

/** Mehr als ± so viele Punkte bewirkt die Kabine nie. SPEZIFIKATION 2.6.1. */
export const CABIN_LIMIT = 30;

// ---------------------------------------------------------------------------
// 2.6.2 Service-Teil
// ---------------------------------------------------------------------------

/**
 * Service points, die eine Klasse erwartet: Grundwert bei Flugzeit-Index 1 und Zuwachs je Index-Stufe
 * (heute `src/lib/financeUtils.ts:788-793`). SPEZIFIKATION 2.6.2.
 */
export const SERVICE_EXPECTATION: Readonly<Record<CabinClass, { readonly base: number; readonly perIndex: number }>> = {
  economy: { base: 5, perIndex: 10 },
  premium: { base: 12, perIndex: 14 },
  business: { base: 25, perIndex: 21 },
  first: { base: 40, perIndex: 33 },
};

/** Abzug für gar keinen Service bei Flugzeit-Index 1 (vor dem Klassen-Faktor). SPEZIFIKATION 2.6.2. */
export const SHORTFALL_BASE = 6;

/** Zusätzlicher Abzug für gar keinen Service je Index-Stufe. SPEZIFIKATION 2.6.2. */
export const SHORTFALL_PER_INDEX = 9;

/** Fehlender Service schmerzt teure Klassen mehr: Faktor auf den Höchstabzug. SPEZIFIKATION 2.6.2. */
export const SHORTFALL_CLASS: Readonly<Record<CabinClass, number>> = {
  economy: 1,
  premium: 1.1,
  business: 1.25,
  first: 1.4,
};

/** Mehr als so viele Punkte bringt Service über der Erwartung nie (doppelte Erwartung ≈ 63 % davon). SPEZIFIKATION 2.6.2. */
export const SERVICE_DELIGHT = 25;

// ---------------------------------------------------------------------------
// 2.6.3 Boden-Teil
// ---------------------------------------------------------------------------

/** Bodengewicht bei Flugzeit-Index 1. SPEZIFIKATION 2.6.3. */
export const GROUND_WEIGHT_BASE = 1.2;

/** Bodengewicht sinkt je Index-Stufe um so viel (1,2 bei 30 min, 0,5 ab 810 min). SPEZIFIKATION 2.6.3. */
export const GROUND_WEIGHT_PER_INDEX = 0.1;

/**
 * Punkte einer eigenen VIP-Lounge an einem Flughafen, vor dem Mittel beider Enden: eine Lounge an einem Ende
 * zählt die Hälfte (Business 4, wie heute je Flughafen), an beiden Enden voll. SPEZIFIKATION 2.6.3.
 */
export const LOUNGE_POINTS: Readonly<Record<CabinClass, number>> = {
  economy: 0,
  premium: 2,
  business: 8,
  first: 8,
};

/** Punkte bei einem Abstellplatz für jeden belegten Slot (heute `src/lib/financeUtils.ts:584`). SPEZIFIKATION 2.6.3. */
export const STAND_POINTS = 2;

/**
 * Abzug für Premium, Business und First an einem Flughafen ohne bedienten Schalter (nur Selbstbedienung).
 * Economy nie. E55. SPEZIFIKATION 2.6.3.
 */
export const DESK_TYPE_PENALTY = -10;

/** Arten der Check-in-Schalter: bedient und Selbstbedienung (Namen wie im Spielstand). */
export type DeskType = 'normal' | 'self';

/** Sitze je Woche, die ein Schalter abfertigt (heute `src/lib/financeUtils.ts:141`). SPEZIFIKATION 2.6.3. */
export const DESK_CAPACITY: Readonly<Record<DeskType, number>> = {
  normal: 5000,
  self: 10000,
};

/** Bis zu dieser Schalter-Auslastung (Anteil) kein Abzug. SPEZIFIKATION 2.6.3. */
export const DESK_OVERLOAD_FROM = 0.8;

/** Ab dieser Auslastung (Anteil) steiler Abzug. SPEZIFIKATION 2.6.3. */
export const DESK_OVERLOAD_STEEP_FROM = 1;

/** Abzug je Prozentpunkt Auslastung zwischen 80 und 100 % (−4 bei 100 %). SPEZIFIKATION 2.6.3. */
export const DESK_OVERLOAD_SLOPE = 0.2;

/** Abzug je Prozentpunkt Auslastung über 100 %. SPEZIFIKATION 2.6.3. */
export const DESK_OVERLOAD_STEEP_SLOPE = 1.6;

/** Höchster Abzug durch Schalter-Überlast je Flughafen. SPEZIFIKATION 2.6.3. */
export const DESK_OVERLOAD_MAX = 20;

// ---------------------------------------------------------------------------
// 2.6.4 Personal-Teil
// ---------------------------------------------------------------------------

/** Moral, bei der das Personal die Satisfaction weder hebt noch senkt (heute `src/lib/staff.ts:86`). SPEZIFIKATION 2.6.4. */
export const MORALE_NEUTRAL = 50;

/** Satisfaction-Punkte je Moral-Punkt über oder unter `MORALE_NEUTRAL` (−5 … +5). SPEZIFIKATION 2.6.4. */
export const SAT_PER_MORALE_POINT = 0.1;

// ---------------------------------------------------------------------------
// 2.6.5 Forschungs-Teil
// ---------------------------------------------------------------------------

/**
 * Satisfaction-Punkte je fertiger Forschung (Feld `satisfactionPoints`, 6.9), für alle Klassen gleich:
 * „Cabin design studio“ +2, die sechs Stufen „Plane type satisfaction“ je +1 (E19). Höchstens +8.
 * Ids wie heute in `src/lib/research.ts:100-164`. Paket 3.6 führt die Tabelle mit allen Feldern
 * aus 6.9 zusammen (F22). SPEZIFIKATION 2.6.5.
 */
export const RESEARCH_SATISFACTION_POINTS: Readonly<Record<string, number>> = {
  'sat-1': 1,
  'sat-2': 1,
  'sat-3': 1,
  'sat-4': 1,
  'sat-5': 1,
  'sat-6': 1,
  cabin: 2,
};

// ---------------------------------------------------------------------------
// 2.10 Satisfaction factor
// ---------------------------------------------------------------------------

/**
 * Bis Satisfaction 100: so viel weniger Zahlungsbereitschaft je Punkt unter 100 (50 → 0,75, 0 → 0,5).
 * Startwert; endgültige Kurve aus dem Balance-Skript (3.9, E15). SPEZIFIKATION 2.10.
 */
export const SAT_FACTOR_LOW_SLOPE = 0.005;

/** Über 100: linearer Zuwachs je Punkt (heute `src/lib/financeUtils.ts:744`). SPEZIFIKATION 2.10. */
export const SAT_FACTOR_HIGH_A = 0.008;

/** Über 100: Abflachung je Punkt² (160 → ≈ 1,35). SPEZIFIKATION 2.10. */
export const SAT_FACTOR_HIGH_B = 0.000035;

// ---------------------------------------------------------------------------
// 3.1 Bezugs-Flugzeit und Flugzeit einer Strecke
// ---------------------------------------------------------------------------

/**
 * Feste Bezugsgeschwindigkeit, km/h: Die Marktgröße misst die Entfernung mit dieser Geschwindigkeit,
 * nie mit der des eingesetzten Flugzeugs (E20; heute `src/lib/transferUtils.ts:70`). SPEZIFIKATION 3.1.
 */
export const REFERENCE_SPEED = 800;

/** Erdradius in km für die Großkreis-Entfernung (heute `src/data/airports.ts:62`). SPEZIFIKATION 1.2, 3.1. */
export const EARTH_RADIUS_KM = 6371;

/** Geflogener Weg = Großkreis × diesen Faktor (Luftstraßen; heute `src/lib/financeUtils.ts:203`). SPEZIFIKATION 3.1. */
export const ROUTE_DETOUR = 1.02;

/** Beschleunigung bis zur Reisegeschwindigkeit, km/h² (heute `src/lib/financeUtils.ts:206`). SPEZIFIKATION 3.1. */
export const BLOCK_ACCEL = 6000;

/** Verzögerung aus der Reisegeschwindigkeit, km/h² (heute `src/lib/financeUtils.ts:207`). SPEZIFIKATION 3.1. */
export const BLOCK_DECEL = 4000;

// ---------------------------------------------------------------------------
// 3.2 Stadtgrößen und Verflechtung
// ---------------------------------------------------------------------------

/** Hochzahl der kleineren Stadt in der Verflechtung (zählt stärker; heute `src/lib/financeUtils.ts:670`). SPEZIFIKATION 3.2. */
export const LINK_SMALL = 1.4;

/** Hochzahl der größeren Stadt in der Verflechtung (heute `src/lib/financeUtils.ts:670`). SPEZIFIKATION 3.2. */
export const LINK_LARGE = 0.6;

/**
 * Saison des Tourismus je Kalendermonat (Index 0 = Januar), Nordhalbkugel. Mittel ≈ 1.
 * Südhalbkugel: um 6 Monate versetzt (heute `src/lib/financeUtils.ts:279`). SPEZIFIKATION 3.2.
 */
export const SEASON_BY_MONTH: readonly number[] = [
  0.89, 0.91, 0.92, 0.96, 1.03, 1.1, 1.15, 1.14, 1.06, 0.95, 0.88, 1.0,
];

/** Weltregionen für Ereignisse (wie heute `EventRegion`, `src/lib/eventSystem.ts:28`). SPEZIFIKATION 3.5. */
export type WorldRegion = 'EU' | 'NA' | 'SA' | 'AF' | 'AS' | 'OC';

// ---------------------------------------------------------------------------
// 3.3 Nachfrage-Wachstum
// ---------------------------------------------------------------------------

/**
 * So viel mehr Menschen fliegen 2019 als 1960 (E7, W8). Die einzige Wachstumsregel der Nachfrage.
 * Startwert; endgültig aus dem Balance-Skript (3.9). SPEZIFIKATION 3.3.
 */
export const DEMAND_GROWTH_1960_2019 = 2.5;

/** Jahre von 1960 bis 2019, Bezugszeitraum von `DEMAND_GROWTH_1960_2019`. SPEZIFIKATION 3.3. */
export const DEMAND_GROWTH_YEARS = 59;

/** Nach diesem Jahr wächst die Nachfrage nicht mehr (wie der Kostenindex). SPEZIFIKATION 3.3. */
export const DEMAND_GROWTH_LAST_YEAR = 2100;

// ---------------------------------------------------------------------------
// 3.4 Entfernungs-Faktor
// ---------------------------------------------------------------------------

/** Bei dieser Bezugs-Flugzeit (min) ist der Entfernungs-Faktor 1. Startwert (3.9). SPEZIFIKATION 3.4. */
export const DISTANCE_REF = 450;

/** Kürzere Bezugs-Flugzeiten (min) zählen wie diese. Startwert (3.9). SPEZIFIKATION 3.4. */
export const DISTANCE_MIN = 45;

/** Wie stark der Entfernungs-Faktor mit der Flugzeit fällt (Hochzahl). Startwert (3.9). SPEZIFIKATION 3.4. */
export const DISTANCE_EXP = 0.5;

// ---------------------------------------------------------------------------
// 3.6 Marktgröße
// ---------------------------------------------------------------------------

/** Hochzahl der Verflechtung (Abstand großer zu kleinen Paaren; heute `src/lib/financeUtils.ts:683`). SPEZIFIKATION 3.6. */
export const LINK_EXP = 0.448351;

/** Maßstab der Marktgröße, Fluggäste je Woche (heute 29 × 0,9 bei Normal, ohne den Abzug, E4). Startwert (3.9). SPEZIFIKATION 3.6. */
export const DEMAND_SCALE = 29;

// ---------------------------------------------------------------------------
// 3.7 Klassen-Anteil
// ---------------------------------------------------------------------------

/** Die höheren Klassen; Economy ist der Rest. */
export type UpperCabinClass = Exclude<CabinClass, 'economy'>;

/** Anteil der Klasse bei Geschäftsanteil 0,5 und kurzer Flugzeit. Startwerte (3.9). SPEZIFIKATION 3.7. */
export const CLASS_BASE: Readonly<Record<UpperCabinClass, number>> = {
  premium: 0.07,
  business: 0.05,
  first: 0.012,
};

/** Wie stark der Geschäftsanteil den Klassen-Anteil hebt (E21). Startwerte (3.9). SPEZIFIKATION 3.7. */
export const CLASS_BUSINESS_GAIN: Readonly<Record<UpperCabinClass, number>> = {
  premium: 0.6,
  business: 1.6,
  first: 1.6,
};

/** Wie stark lange Flugzeit den Klassen-Anteil hebt (E21). Startwerte (3.9). SPEZIFIKATION 3.7. */
export const CLASS_TIME_GAIN: Readonly<Record<UpperCabinClass, number>> = {
  premium: 0.5,
  business: 0.6,
  first: 1.5,
};

/** Ab dieser Bezugs-Flugzeit (min) steigen die höheren Klassen mit der Flugzeit. SPEZIFIKATION 3.7. */
export const CLASS_TIME_FROM = 60;

/** Ab dieser Bezugs-Flugzeit (min) steigen sie nicht mehr. SPEZIFIKATION 3.7. */
export const CLASS_TIME_TO = 720;

// ---------------------------------------------------------------------------
// 3.9 Anziehung
// ---------------------------------------------------------------------------

/** Abflüge je Richtung und Woche des Bezugsangebots (täglich): `frequencyFactor` = 1. SPEZIFIKATION 3.9.0, 3.9.1. */
export const REFERENCE_FREQUENCY = 7;

/** Hochzahl der Abflüge in der Anziehung (Wurzel, heute `src/lib/financeUtils.ts:1134`). SPEZIFIKATION 3.9.1. */
export const FREQUENCY_EXP = 0.5;

/**
 * Preis-Empfindlichkeit je Klasse (Hochzahl in `priceFactor`). Muss über 1 liegen, sonst brächte jeder
 * höhere Preis mehr Erlös; daraus folgt auch `noFlyAppeal` (3.10). Startwerte (3.9). SPEZIFIKATION 3.9.2.
 */
export const PRICE_SENSITIVITY: Readonly<Record<CabinClass, number>> = {
  economy: 2.2,
  premium: 2.0,
  business: 1.8,
  first: 1.7,
};

/** Hochzahl der Flugzeit in der Anziehung: halbe Flugzeit = Faktor 2 (E20). Startwert (3.9). SPEZIFIKATION 3.9.3. */
export const FLIGHT_TIME_EXP = 1.0;

/** Ruf-Wirkung auf die Anziehung je Punkt über oder unter 50 (0,9 bei 0, 1,1 bei 100; E36). SPEZIFIKATION 3.9.4. */
export const REPUTATION_DEMAND_SLOPE = 0.002;

/** Frequent flyer im ersten Laufmonat (heute `src/lib/marketing.ts:192`). SPEZIFIKATION 3.9.4. */
export const FF_START = 0.05;

/** Frequent flyer: Zuwachs je weiterem Laufmonat (heute `src/lib/marketing.ts:193`). SPEZIFIKATION 3.9.4. */
export const FF_PER_MONTH = 0.01;

/** Frequent flyer: höchster Zuschlag (heute `src/lib/marketing.ts:194`). SPEZIFIKATION 3.9.4. */
export const FF_MAX = 0.2;

/** Stufe einer Werbe-Kampagne. */
export type CampaignTier = 'local' | 'national' | 'global';

/** Zuschlag einer laufenden Kampagne auf den Werbe-Faktor ihrer Region (heute `src/lib/marketing.ts:74-78`). SPEZIFIKATION 3.9.5. */
export const ADVERTISING_BOOST: Readonly<Record<CampaignTier, number>> = {
  local: 0.05,
  national: 0.1,
  global: 0.18,
};

/** Höchster Werbe-Faktor einer Region, wie viele Kampagnen auch laufen (heute `src/lib/marketing.ts:84`). SPEZIFIKATION 3.9.5. */
export const ADVERTISING_MAX = 1.25;

/** Höchster Established route bonus (heute `src/lib/routeMaturity.ts:24`). SPEZIFIKATION 3.9.6. */
export const ESTABLISHED_BONUS_MAX = 0.05;

/** Ab diesem Alter (Monate) wächst der Established route bonus. SPEZIFIKATION 3.9.6. */
export const ESTABLISHED_FROM = 24;

/** Ab diesem Alter (Monate) ist er voll. SPEZIFIKATION 3.9.6. */
export const ESTABLISHED_TO = 48;

// ---------------------------------------------------------------------------
// 3.12 Anlauf
// ---------------------------------------------------------------------------

/** Anteil der gewählten Fluggäste, den ein neues Angebot im ersten Monat erreicht (heute `src/lib/routeMaturity.ts:17`). SPEZIFIKATION 3.12. */
export const RAMP_START = 0.6;

/** Monate bis zur vollen Nachfrage (heute `src/lib/routeMaturity.ts:19`). SPEZIFIKATION 3.12. */
export const RAMP_MONTHS = 9;

/** Zuschlag auf `RAMP_START` mit der Forschung „Route planning suite“ (Feld `rampBonus`, 6.9). SPEZIFIKATION 3.12. */
export const RAMP_RESEARCH_BONUS = 0.15;

// ---------------------------------------------------------------------------
// 3.13 Umsteige-Verbindungen
// ---------------------------------------------------------------------------

/** Minuten einer Woche (Fahrplan: Montag 00:00 = 0). */
export const MINUTES_PER_WEEK = 7 * 24 * 60;

/** Größter Umweg (geflogene / direkte Entfernung) einer Verbindung (heute `src/lib/transferUtils.ts:41`). SPEZIFIKATION 3.13. */
export const MAX_DETOUR = 1.6;

/** Kürzeste Umstiegszeit in Minuten (heute `src/lib/transferUtils.ts:37`). SPEZIFIKATION 3.13. */
export const MIN_CONNECTION = 45;

/** Längste Umstiegszeit in Minuten (heute `src/lib/transferUtils.ts:39`). SPEZIFIKATION 3.13. */
export const MAX_CONNECTION = 360;

/** Preis einer Verbindung als Anteil des Marktpreises Start–Ziel (E25; heute `src/lib/transferUtils.ts:45`). SPEZIFIKATION 3.13, 4.8. */
export const TRANSFER_FARE_SHARE = 0.9;

/** Umsteigen ist lästig: Faktor auf die Anziehung einer Verbindung bei Drehkreuz-Güte 1. Startwert (3.9). SPEZIFIKATION 3.13. */
export const CONNECTION_APPEAL = 0.5;

/** Drehkreuz-Güte eines Flughafens ohne Verwaltung (heute `src/lib/transferUtils.ts:161`). SPEZIFIKATION 3.13. */
export const HUB_QUALITY_BASE = 0.4;

/** Drehkreuz-Güte je Verwaltungsstufe. SPEZIFIKATION 3.13. */
export const HUB_QUALITY_PER_LEVEL = 0.15;

/** Drehkreuz-Güte je Extra (Stufe 3, Lounge, Catering; heute `src/lib/hubOwnership.ts:27`, `transferUtils.ts:158-159`). SPEZIFIKATION 3.13. */
export const HUB_QUALITY_PER_EXTRA = 0.05;

/** Ab dieser Verwaltungsstufe zählt die Stufe selbst als Extra. SPEZIFIKATION 3.13. */
export const HUB_QUALITY_EXTRA_LEVEL = 3;

/** Faktor auf die Drehkreuz-Güte mit der Forschung „Alliance“ (Feld `hubQualityFactor`, 6.9). SPEZIFIKATION 3.13. */
export const HUB_QUALITY_RESEARCH_FACTOR = 1.1;

// ---------------------------------------------------------------------------
// 4.1 Grundpreis Economy
// ---------------------------------------------------------------------------

/** Grundbetrag eines Economy-Tickets in $ von 1960 (heute `src/lib/financeUtils.ts:725`). Startwert (3.9). SPEZIFIKATION 4.1. */
export const FARE_BASE_1960 = 30;

/** Economy-Preis je km Großkreis-Entfernung in $ von 1960 (heute `src/lib/financeUtils.ts:725`). Startwert (3.9). SPEZIFIKATION 4.1. */
export const FARE_PER_KM_1960 = 0.05;

/**
 * Kurzstrecken-Zuschlag je Flugzeit-Index 1 … 8 (Stelle 0 = Index 1). Dazwischen gerade Linie
 * (heute `SHORT_HAUL_FARE_FACTOR`, `src/lib/financeUtils.ts:720`). SPEZIFIKATION 4.1.
 */
export const SHORT_HAUL_FARE_FACTOR: readonly number[] = [1.15, 1.15, 1.1, 1.1, 1.05, 1, 1, 1];

// ---------------------------------------------------------------------------
// 4.2 Klassen-Verhältnis
// ---------------------------------------------------------------------------

/** Klassen-Verhältnis bei Flugzeit-Index 1 (heute `src/lib/financeUtils.ts:728-730`). Startwert (3.9). SPEZIFIKATION 4.2. */
export const CLASS_FARE_RATIO_BASE: Readonly<Record<CabinClass, number>> = {
  economy: 1,
  premium: 1.3,
  business: 2.0,
  first: 3.0,
};

/** Zuwachs des Klassen-Verhältnisses je Stufe des Flugzeit-Index. Startwert (3.9). SPEZIFIKATION 4.2. */
export const CLASS_FARE_RATIO_SLOPE: Readonly<Record<CabinClass, number>> = {
  economy: 0,
  premium: 0.15,
  business: 0.25,
  first: 0.5,
};

// ---------------------------------------------------------------------------
// 4.5 Preis einer Strecke
// ---------------------------------------------------------------------------

/** Kleinstes Preisniveau (Preis / Marktpreis); darunter wäre `priceFactor` riesig. SPEZIFIKATION 4.5. */
export const FARE_RATIO_MIN = 0.25;

/** Größtes Preisniveau; darüber kommt praktisch niemand. SPEZIFIKATION 4.5. */
export const FARE_RATIO_MAX = 4;

/** Preisniveau einer neuen Strecke und bei fehlendem Preis (= Marktpreis, E23, R8). SPEZIFIKATION 4.5. */
export const FARE_RATIO_DEFAULT = 1;

// ---------------------------------------------------------------------------
// 4.10 Bester Preis
// ---------------------------------------------------------------------------

/** Schrittweite der groben Suche über das Preisniveau. SPEZIFIKATION 4.10. */
export const BEST_FARE_COARSE_STEP = 0.01;

/** Schrittweite der feinen Suche um den besten groben Punkt (± `BEST_FARE_COARSE_STEP`). SPEZIFIKATION 4.10. */
export const BEST_FARE_FINE_STEP = 0.001;

// ---------------------------------------------------------------------------
// 5.1 Kosten-Faktoren der Gesellschaft
// ---------------------------------------------------------------------------

/** Arten von Kosten, die eine Forschung senken kann. SPEZIFIKATION 5.1. */
export type CostResearchKind = 'fuel' | 'crew' | 'fees' | 'catering' | 'maintenance' | 'slots';

/**
 * Einsparung je fertiger Forschung (Anteil, 0,01 = 1 %), mit der Kostenart. Ids und Werte wie heute
 * (`src/lib/research.ts:99-160`): Treibstoff 3 + 3 + 1 %, Besatzung 3 × 1 %, Gebühren 3 × 1 %,
 * Verpflegung 2 × 2 %, Wartung 4 × 1 %, Slots 8 %. Paket 3.6 führt die Tabelle in die Felder der
 * Forschungs-Tabelle (6.9) über (wie F23). SPEZIFIKATION 5.1.
 */
export const RESEARCH_COST_SAVINGS: Readonly<Record<string, { readonly kind: CostResearchKind; readonly saving: number }>> = {
  'fuel-1': { kind: 'fuel', saving: 0.03 },
  'fuel-2': { kind: 'fuel', saving: 0.03 },
  'fuel-3': { kind: 'fuel', saving: 0.01 },
  'crew-1': { kind: 'crew', saving: 0.01 },
  'crew-2': { kind: 'crew', saving: 0.01 },
  'crew-3': { kind: 'crew', saving: 0.01 },
  'fees-1': { kind: 'fees', saving: 0.01 },
  'fees-2': { kind: 'fees', saving: 0.01 },
  'fees-3': { kind: 'fees', saving: 0.01 },
  'catering-1': { kind: 'catering', saving: 0.02 },
  'catering-2': { kind: 'catering', saving: 0.02 },
  'maint-1': { kind: 'maintenance', saving: 0.01 },
  'maint-2': { kind: 'maintenance', saving: 0.01 },
  'maint-3': { kind: 'maintenance', saving: 0.01 },
  'maint-4': { kind: 'maintenance', saving: 0.01 },
  slots: { kind: 'slots', saving: 0.08 },
};

/** Kein Kosten-Faktor aus Forschung sinkt unter diesen Wert (heute `src/lib/research.ts:253`). SPEZIFIKATION 5.1. */
export const RESEARCH_COST_FLOOR = 0.4;

/** Höchste Verwaltungsstufe an einem Flughafen. SPEZIFIKATION 5.1, 5.11. */
export const MAX_MANAGEMENT_TIER = 3;

/** Gebühren-Nachlass ab Verwaltungsstufe 2 (heute `src/lib/hubOwnership.ts:20-24`). SPEZIFIKATION 5.1. */
export const HUB_FEE_FACTOR_TIER2 = 0.95;

/** Gebühren-Nachlass auf Verwaltungsstufe 3 (heute `src/lib/hubOwnership.ts:20-24`). SPEZIFIKATION 5.1. */
export const HUB_FEE_FACTOR_TIER3 = 0.85;

// ---------------------------------------------------------------------------
// 5.2 Treibstoffpreis
// ---------------------------------------------------------------------------

/**
 * Ausschläge der geschichtlichen Ölkrisen in der Treibstoff-Tabelle (E61). `startMonth` = Spielmonat
 * des Beginns (0 = Januar 1960), `months` = Dauer, `factor` = höchster Faktor (heute `fuelMultiplier`,
 * `src/lib/eventSystem.ts:70-205`). Ereignisse mit Faktor 1 fehlen. SPEZIFIKATION 5.2.
 */
export const FUEL_CRISES: readonly { readonly name: string; readonly startMonth: number; readonly months: number; readonly factor: number }[] = [
  { name: '1973 Oil Crisis', startMonth: (1973 - START_YEAR) * 12 + 9, months: 18, factor: 2.0 },
  { name: '1979 Energy Crisis', startMonth: (1979 - START_YEAR) * 12 + 1, months: 24, factor: 1.8 },
  { name: 'Gulf War Oil Shock', startMonth: (1990 - START_YEAR) * 12 + 7, months: 12, factor: 1.5 },
  { name: 'Global Financial Crisis', startMonth: (2008 - START_YEAR) * 12 + 8, months: 24, factor: 1.2 },
  { name: 'Global Pandemic', startMonth: (2020 - START_YEAR) * 12 + 2, months: 24, factor: 0.7 },
];

/** Monate An- und Abstieg einer Krise in der Treibstoff-Tabelle, innerhalb ihrer Dauer (E61). SPEZIFIKATION 5.2. */
export const FUEL_CRISIS_RAMP = 3;

// ---------------------------------------------------------------------------
// 5.3 Treibstoff je Strecke
// ---------------------------------------------------------------------------

/** Liter je Sitz und 100 km: `FUEL_BASE / (FUEL_EFF_OFFSET + Effizienz / FUEL_EFF_SCALE)` (heute `src/lib/financeUtils.ts:1256`). SPEZIFIKATION 5.3. */
export const FUEL_BASE = 7.5;

/** Siehe `FUEL_BASE`. SPEZIFIKATION 5.3. */
export const FUEL_EFF_OFFSET = 0.75;

/** Siehe `FUEL_BASE`. SPEZIFIKATION 5.3. */
export const FUEL_EFF_SCALE = 70;

/** Effizienz-Punkte je fertiger Effizienz-Forschung (heute +1 %, `src/lib/research.ts:99-147`). SPEZIFIKATION 5.3. */
export const EFFICIENCY_PER_RESEARCH = 1;

/** Ids der Effizienz-Forschungen (Feld `efficiencyPoints`, 6.9; Paket 3.6 führt sie über). SPEZIFIKATION 5.3. */
export const EFFICIENCY_RESEARCH_IDS: readonly string[] = ['eff-1', 'eff-2', 'eff-3', 'eff-4', 'eff-5', 'eff-6'];

/** Höchste Effizienz eines Flugzeugs mit Forschung. SPEZIFIKATION 5.3. */
export const EFFICIENCY_MAX = 100;

// ---------------------------------------------------------------------------
// 5.4 Besatzung
// ---------------------------------------------------------------------------

/** Piloten im Cockpit (heute `src/lib/financeUtils.ts:1263`). SPEZIFIKATION 5.4. */
export const COCKPIT_CREW = 2;

/** Lohn eines Piloten je Blockstunde in $ von 1960. SPEZIFIKATION 5.4. */
export const PILOT_RATE_1960 = 100;

/** Lohn eines Flugbegleiters je Blockstunde in $ von 1960. SPEZIFIKATION 5.4. */
export const ATTENDANT_RATE_1960 = 40;

/** Sitze je Flugbegleiter nach Klasse (neu; Economy wie heute 50). SPEZIFIKATION 5.4. */
export const SEATS_PER_ATTENDANT: Readonly<Record<CabinClass, number>> = {
  economy: 50,
  premium: 35,
  business: 20,
  first: 10,
};

/** Mindestens so viele Flugbegleiter je Flug. SPEZIFIKATION 5.4. */
export const MIN_CABIN_CREW = 1;

// ---------------------------------------------------------------------------
// 5.5 Landegebühr
// ---------------------------------------------------------------------------

/** Grundbetrag einer Landung je Flugzeugklasse in $ von 1960 (heute `(2500 + …) × 1,1`, `src/lib/financeUtils.ts:1211-1213`). SPEZIFIKATION 5.5. */
export const LANDING_BASE_1960: Readonly<Record<AircraftClass, number>> = {
  Regional: 2750,
  Narrowbody: 2750,
  Widebody: 3300,
};

/** Zuschlag je Größenstufe des Flughafens in $ von 1960. SPEZIFIKATION 5.5. */
export const LANDING_PER_LEVEL_1960: Readonly<Record<AircraftClass, number>> = {
  Regional: 110,
  Narrowbody: 110,
  Widebody: 165,
};

/** Höchstsitze, bei denen ein Flugzeug die volle Gebühr seiner Klasse zahlt (heute `src/lib/financeUtils.ts:1171`). SPEZIFIKATION 5.5. */
export const LANDING_REFERENCE_SEATS: Readonly<Record<AircraftClass, number>> = {
  Regional: 180,
  Narrowbody: 180,
  Widebody: 420,
};

/** Anteil der Gebühr für Propeller-Flugzeuge (leichter je Sitz, heute `src/lib/financeUtils.ts:1179`). SPEZIFIKATION 5.5. */
export const PROPELLER_FEE_SHARE = 0.85;

/** Regional-Flugzeuge langsamer als diese Reisegeschwindigkeit (km/h) gelten als Propeller-Flugzeuge. SPEZIFIKATION 5.5. */
export const PROPELLER_MAX_SPEED = 700;

// ---------------------------------------------------------------------------
// 5.6 Check-in und Abfertigung
// ---------------------------------------------------------------------------

/** Check-in je Reise in $ von 1960 (heute 0,5 $ an beiden Enden, E27). SPEZIFIKATION 5.6. */
export const CHECKIN_FEE_1960 = 1.0;

/** Abfertigung je Abflug eines Fluggasts in $ von 1960, nach Flughafengröße (heute 3 / 4 / 5 $ an beiden Enden). SPEZIFIKATION 5.6. */
export const HANDLING_FEE_1960 = { small: 6, medium: 8, large: 10 } as const;

/** Ab dieser Flughafengröße gilt `HANDLING_FEE_1960.medium`. SPEZIFIKATION 5.6. */
export const HANDLING_MEDIUM_FROM = 3;

/** Ab dieser Flughafengröße gilt `HANDLING_FEE_1960.large`. SPEZIFIKATION 5.6. */
export const HANDLING_LARGE_FROM = 5;

// ---------------------------------------------------------------------------
// 5.8 Kosten je Fluggast (Frequent flyer, 5.14)
// ---------------------------------------------------------------------------

/** Kosten des Frequent-flyer-Programms je Reise in $ von 1960 (heute `src/lib/marketing.ts:189`, neu mit Index). SPEZIFIKATION 5.8, 5.14. */
export const FFP_COST_PER_PAX_1960 = 0.8;

/** Anteil der Umsteiger einer Teilstrecke, die ihre Reise am äußeren Ende beginnen (dort Check-in). SPEZIFIKATION 5.8. */
export const TRANSFER_CHECKIN_SHARE = 0.5;

// ---------------------------------------------------------------------------
// 5.10 Slots, Abstellplätze, Schalter
// ---------------------------------------------------------------------------

/** Slots aller Arten und aller Gesellschaften je Größenstufe eines Flughafens (heute nur in Ansichten, `src/components/AirportDetailView.tsx:128`). SPEZIFIKATION 5.10, E50. */
export const SLOTS_PER_AIRPORT_LEVEL = 300;

/** Kaufpreis eines Slots je Art in $ von 1960 (heute `src/lib/financeUtils.ts:1715-1719`, ohne Index). SPEZIFIKATION 5.10. */
export const SLOT_PRICE_1960: Readonly<Record<AircraftClass, number>> = {
  Regional: 25_000,
  Narrowbody: 50_000,
  Widebody: 100_000,
};

/** Miete eines gekauften Slots je Woche in $ von 1960, belegt oder nicht (heute `src/lib/financeUtils.ts:25-29`). SPEZIFIKATION 5.10. */
export const SLOT_RENT_1960: Readonly<Record<AircraftClass, number>> = {
  Regional: 125,
  Narrowbody: 250,
  Widebody: 250,
};

/** Verkaufserlös eines Slots als Anteil des Kaufpreises im Verkaufsmonat (heute `src/lib/financeUtils.ts:1806-1808`). SPEZIFIKATION 5.10. */
export const SLOT_RESALE_SHARE = 0.5;

/** Abstellplätze gibt es erst an Flughäfen ab dieser Größe (heute `src/lib/financeUtils.ts:1703-1710`). SPEZIFIKATION 5.10. */
export const STANDS_MIN_AIRPORT_SIZE = 3;

/** Miete eines Abstellplatzes je Woche in $ von 1960, Verwaltungsstufe 0–1 (heute `src/lib/financeUtils.ts:31-35`). SPEZIFIKATION 5.10. */
export const STAND_RENT_1960: Readonly<Record<AircraftClass, number>> = {
  Regional: 150,
  Narrowbody: 300,
  Widebody: 600,
};

/** Ab dieser Verwaltungsstufe hat jeder Slot einen Abstellplatz ohne Miete (E28). SPEZIFIKATION 5.10. */
export const FREE_STANDS_FROM_TIER = 2;

/** Miete eines Check-in-Schalters je Woche bei voller Auslastung, in $ von 1960 (heute `src/lib/financeUtils.ts:38-64`). SPEZIFIKATION 5.10. */
export const DESK_RENT_1960: Readonly<Record<DeskType, number>> = {
  normal: 2500,
  self: 1500,
};

/** Anteil der Schalter-Miete, der auch ohne Fluggäste anfällt; der Rest wächst mit `deskLoad` bis 1. SPEZIFIKATION 5.10. */
export const DESK_FIXED_SHARE = 0.2;

/** Erster Spielmonat mit Selbstbedienungs-Schaltern: Januar 1995 (heute `src/lib/financeUtils.ts:1703-1710`). SPEZIFIKATION 5.10. */
export const SELF_DESK_FROM = (1995 - START_YEAR) * 12;

// ---------------------------------------------------------------------------
// 5.11 Verwaltungsstufen und Einrichtungen
// ---------------------------------------------------------------------------

/** Einmalpreis einer Verwaltungsstufe je Größenstufe des Flughafens, in $ von 1960 (heute `src/lib/financeUtils.ts:1656-1660`, ohne Index). SPEZIFIKATION 5.11. */
export const TIER_PRICE_1960: Readonly<Record<1 | 2 | 3, number>> = {
  1: 30_000,
  2: 750_000,
  3: 25_000_000,
};

/** Einrichtungen einer Gesellschaft an einem Flughafen (Namen wie im Spielstand, `src/lib/gameTypes.ts:90-92`). */
export type FacilityKind = 'hangar' | 'vipLounge' | 'catering';

/** Einmalpreis einer Einrichtung in $ von 1960 (heute im Klick-Handler, `src/components/AirportDetailView.tsx:443-554`). SPEZIFIKATION 5.11. */
export const FACILITY_PRICE_1960: Readonly<Record<FacilityKind, number>> = {
  hangar: 250_000,
  vipLounge: 1_000_000,
  catering: 250_000,
};

/** Unterhalt einer Einrichtung je Woche in $ von 1960, ohne Gebühren-Faktor (heute `src/lib/financeUtils.ts:111-113`). SPEZIFIKATION 5.11. */
export const FACILITY_UPKEEP_1960: Readonly<Record<FacilityKind, number>> = {
  hangar: 10_000,
  vipLounge: 12_500,
  catering: 10_000,
};

// ---------------------------------------------------------------------------
// 5.12 Flugzeug-Unterhalt
// ---------------------------------------------------------------------------

/** Versicherung je Jahr als Anteil des heutigen Neupreises (heute `src/lib/fleetCosts.ts:14`). SPEZIFIKATION 5.12. */
export const INSURANCE_RATE = 0.006;

/** Wartungsprogramm je Jahr als Anteil des Neupreises bei Alter 0 (heute `src/lib/fleetCosts.ts:16`). SPEZIFIKATION 5.12. */
export const MAINTENANCE_RATE_NEW = 0.03;

/** Wartungsprogramm je Jahr ab `MAINTENANCE_FULL_AGE` (heute `src/lib/fleetCosts.ts:17`). SPEZIFIKATION 5.12. */
export const MAINTENANCE_RATE_OLD = 0.08;

/** Ab diesem Alter in Jahren gilt `MAINTENANCE_RATE_OLD`; dazwischen gerade Linie. SPEZIFIKATION 5.12. */
export const MAINTENANCE_FULL_AGE = 25;

/** Anteil des Unterhalts für ein Flugzeug ohne Strecke (heute `src/lib/fleetCosts.ts:20`). SPEZIFIKATION 5.12. */
export const PARKED_SHARE = 0.5;

/** So viele Flugzeug-Familien hat eine Flotte ohne Zuschlag (heute `src/lib/fleetCosts.ts:73`). SPEZIFIKATION 5.12. */
export const FREE_FAMILIES = 3;

/** Wartungs-Zuschlag je Familie über `FREE_FAMILIES` (heute `src/lib/fleetCosts.ts:74`). SPEZIFIKATION 5.12. */
export const VARIETY_PENALTY_PER_FAMILY = 0.03;

/** Höchster Wartungs-Zuschlag für viele Familien (heute `src/lib/fleetCosts.ts:75`). SPEZIFIKATION 5.12. */
export const VARIETY_PENALTY_MAX = 0.3;

/**
 * Wartungs-Nachlass nach Zahl der Flugzeuge der eigenen Familie, größte Schwelle zuerst
 * (heute `src/lib/fleetCosts.ts:67-72`). SPEZIFIKATION 5.12.
 */
export const COMMONALITY_DISCOUNTS: readonly { readonly from: number; readonly discount: number }[] = [
  { from: 25, discount: 0.15 },
  { from: 12, discount: 0.12 },
  { from: 6, discount: 0.08 },
  { from: 3, discount: 0.04 },
];

// ---------------------------------------------------------------------------
// 5.13 Wertmodell und Abschreibung
// ---------------------------------------------------------------------------

/** Jahre bis zum Restwert (Startwert; heute 2 % je Jahr bis 40 %, `src/lib/fleetCosts.ts:23-24`). SPEZIFIKATION 5.13. */
export const DEPRECIATION_YEARS = 25;

/** Restwert nach `DEPRECIATION_YEARS` als Anteil von `valueBase` (3,2 % je Jahr). SPEZIFIKATION 5.13. */
export const RESIDUAL_SHARE = 0.2;

/** So viel vom Wert kostet ein ganz abgenutztes Flugzeug (Zustand 0) höchstens. SPEZIFIKATION 5.13. */
export const CONDITION_VALUE_SPAN = 0.6;

/** Anteil der Zelle am Zustand für den Wert; der Rest ist die Kabine (heute 0,45 Zelle + 0,15 Kabine). SPEZIFIKATION 5.13. */
export const AIRFRAME_VALUE_SHARE = 0.75;

/**
 * Preis je Sitz des Sitztyps in $ von 1960 (heute `SEAT_DEFS`, Feld `c`, `src/components/ConfigurePurchaseView.tsx:326-353`).
 * Schlüssel wie `SEAT_TYPE_POINTS`; Lieferbarkeit von dort. SPEZIFIKATION 5.13 (`cabinListPrice`).
 */
export const SEAT_TYPE_PRICE_1960: Readonly<Record<CabinClass, Readonly<Record<string, number>>>> = {
  economy: { Standard: 0, Comfort: 80, Ergonomic: 150, 'Premium-Eco': 300 },
  premium: { Standard: 0, Recliner: 400, Cradle: 800 },
  business: { Standard: 0, Recliner: 300, 'Angled Flat': 1000, 'Lie-Flat': 2500, Suites: 5000 },
  first: { Standard: 0, Recliner: 500, 'Flat Bed': 1500, 'Open Suite': 3000, 'Closed Suite': 8000, Residence: 25000 },
};

/**
 * Preis je Sitz einer Ausstattung in $ von 1960 (heute `src/components/ConfigurePurchaseView.tsx:492-535`).
 * Schlüssel wie `FEATURE_POINTS`; Lieferbarkeit von dort. SPEZIFIKATION 5.13 (`cabinListPrice`).
 */
export const FEATURE_PRICE_1960: Readonly<Record<CabinClass, Readonly<Record<string, number>>>> = {
  economy: { ife: 300, power: 100, hooks: 20, armrests: 50, headrests: 80, shell: 200, ped: 60 },
  premium: { ife: 400, power: 150, table: 50, calf: 150, foot: 100, light: 80, usbc: 100 },
  business: { ife: 600, power: 200, lumbar: 200, control: 800, massage: 1200, divider: 1500, charging: 300 },
  first: { ife: 1000, power: 300, wardrobe: 800, wood: 3000, mirror: 400, minibar: 2500, climate: 4000 },
};

/**
 * Preis eines kabinenweiten Extras je Flugzeug in $ von 1960 (heute `src/components/ConfigurePurchaseView.tsx:391-397`).
 * „reduced“ und „minimal“ sind Nachlässe. Lieferbarkeit wie `CABIN_EXTRA_POINTS`. SPEZIFIKATION 5.13.
 */
export const CABIN_EXTRA_PRICE_1960: Readonly<Record<CabinExtra, number>> = {
  wifi: 150_000,
  ambient: 100_000,
  catering: 300_000,
  bar: 500_000,
  shower: 1_000_000,
  reduced: -25_000,
  minimal: -50_000,
};

// ---------------------------------------------------------------------------
// 5.14 Werbung und Frequent flyer
// ---------------------------------------------------------------------------

/** Stufen einer Werbe-Kampagne (Namen wie im Spielstand, `src/lib/gameState.ts:46`). */
export type CampaignLevel = 'local' | 'national' | 'global';

/** Kosten einer Kampagne je laufendem Monat in $ von 1960 (heute `src/lib/marketing.ts:75-77`; eigene Teuerung entfällt). SPEZIFIKATION 5.14. */
export const CAMPAIGN_COST_1960: Readonly<Record<CampaignLevel, number>> = {
  local: 150_000,
  national: 400_000,
  global: 1_000_000,
};

/** Grundbetrag des Frequent-flyer-Programms je Monat in $ von 1960 (heute `src/lib/marketing.ts:187`). SPEZIFIKATION 5.14. */
export const FFP_BASE_COST_1960 = 50_000;

// ---------------------------------------------------------------------------
// 5.15 Einnahme eigener Flughäfen
// ---------------------------------------------------------------------------

/** Anteil der Landegebühren anderer Gesellschaften, den Inhaber der Stufe 3 bekommen (heute `src/lib/hubOwnership.ts:30`). SPEZIFIKATION 5.15. */
export const OWNER_FEE_SHARE = 0.5;

/** Verwaltungsstufe, ab der eine Gesellschaft an den Landegebühren anderer verdient. SPEZIFIKATION 5.15. */
export const OWNER_TIER = 3;

// ---------------------------------------------------------------------------
// 6.1–6.6 Ruf
// ---------------------------------------------------------------------------

/** Neutralpunkt des Rufs: Satisfaction 100 ergibt Ruf 50 (E36). SPEZIFIKATION 6.1. */
export const REPUTATION_NEUTRAL = SCALES.reputation.neutral;

/** Ruf jeder Gesellschaft beim Start, Spieler und KI (E36, E11). SPEZIFIKATION 6.13. */
export const START_REPUTATION = 50;

/** Abzug im Ruf-Ziel je Anteil gestrichener Sitze: 1 % gestrichen → −1 Punkt. Startwert (3.9). SPEZIFIKATION 6.2. */
export const CANCELLED_REPUTATION_WEIGHT = 100;

/** Beitrag einer laufenden Kampagne zum Ruf-Ziel, Punkte (Zahlen wie heute `src/lib/marketing.ts:75-77`). Startwerte (3.9). SPEZIFIKATION 6.3, E37. */
export const CAMPAIGN_REPUTATION: Readonly<Record<CampaignTier, number>> = {
  local: 0.5,
  national: 1,
  global: 2,
};

/** Höchster Werbe-Beitrag zum Ruf-Ziel, Punkte, wie viele Kampagnen auch laufen. SPEZIFIKATION 6.3, E37. */
export const ADVERTISING_REPUTATION_MAX = 3;

/** Anteil des Abstands zum Ruf-Ziel, den der Ruf je Monat zurücklegt (Halbwertszeit 4,3 Monate; heute `src/lib/monthClose.ts:143`). SPEZIFIKATION 6.5. */
export const REPUTATION_STEP = 0.15;

/** Farbstufen der Anzeige: „hoch“ ab 50 + Band, „niedrig“ bis 50 − Band. SPEZIFIKATION 6.6. */
export const REPUTATION_DISPLAY_BAND = 10;

// ---------------------------------------------------------------------------
// 6.7 Rang
// ---------------------------------------------------------------------------

/** Rang-Werte zählen im Mittel dieser Zahl von Monaten (E40). SPEZIFIKATION 6.7. */
export const RANK_AVERAGE_MONTHS = 3;

/** Bedingungen einer Rang-Stufe. Fluggäste je Monat zählen jede Teilstrecke. SPEZIFIKATION 6.7. */
export interface RankRequirement {
  readonly routes: number;
  readonly monthlyPax: number;
  readonly reputation: number;
  readonly regions: number;
  readonly years: number;
}

/** Eine Stufe der Rang-Tabelle; alle Texte zum Rang werden daraus erzeugt (E42, E52). */
export interface RankDef {
  /** Stufe 0 … 9. */
  readonly index: number;
  /** Name im Spiel (Oberflächentext, Englisch). */
  readonly title: string;
  readonly requires: RankRequirement;
  /** Drehkreuze (Verwaltungsstufe 2), ohne Meilenstein-Zuschläge. */
  readonly maxHubs: number;
  /** Größte Flughafen-Größe, die die Gesellschaft nutzen darf. */
  readonly maxAirportLevel: number;
  /** Gleichzeitig laufende Forschungen (E42; ersetzt `2 + abrunden(Rang / 3)`, W7). */
  readonly researchSlots: number;
}

/**
 * Tabelle der Ränge (Startwerte, endgültig aus dem Balance-Skript 3.9). Strecken, Fluggäste, Regionen, Jahre,
 * Drehkreuze, Flughafen-Größen wie heute (`src/lib/airlineRank.ts:42-103`); Ruf-Schwellen neu für die Skala mit
 * Neutralpunkt 50 (E36, E39); Forschungsplätze 3 / 4 / 5 ab Rang 4 / 6 / 8 (E42). SPEZIFIKATION 6.7.
 */
export const RANKS: readonly RankDef[] = [
  { index: 0, title: 'Startup', requires: { routes: 0, monthlyPax: 0, reputation: 0, regions: 0, years: 0 }, maxHubs: 1, maxAirportLevel: 4, researchSlots: 2 },
  { index: 1, title: 'Local Airline', requires: { routes: 3, monthlyPax: 8_000, reputation: 30, regions: 1, years: 0 }, maxHubs: 1, maxAirportLevel: 5, researchSlots: 2 },
  { index: 2, title: 'Regional Airline', requires: { routes: 6, monthlyPax: 25_000, reputation: 35, regions: 1, years: 1 }, maxHubs: 2, maxAirportLevel: 5, researchSlots: 2 },
  { index: 3, title: 'Domestic Airline', requires: { routes: 12, monthlyPax: 70_000, reputation: 40, regions: 1, years: 3 }, maxHubs: 2, maxAirportLevel: 6, researchSlots: 2 },
  { index: 4, title: 'National Airline', requires: { routes: 24, monthlyPax: 170_000, reputation: 45, regions: 1, years: 6 }, maxHubs: 3, maxAirportLevel: 7, researchSlots: 3 },
  { index: 5, title: 'Continental Airline', requires: { routes: 40, monthlyPax: 350_000, reputation: 50, regions: 2, years: 10 }, maxHubs: 4, maxAirportLevel: 7, researchSlots: 3 },
  { index: 6, title: 'International Airline', requires: { routes: 65, monthlyPax: 700_000, reputation: 53, regions: 3, years: 15 }, maxHubs: 5, maxAirportLevel: 7, researchSlots: 4 },
  { index: 7, title: 'Intercontinental Airline', requires: { routes: 95, monthlyPax: 1_200_000, reputation: 56, regions: 4, years: 22 }, maxHubs: 6, maxAirportLevel: 7, researchSlots: 4 },
  { index: 8, title: 'Flag Carrier', requires: { routes: 135, monthlyPax: 2_000_000, reputation: 60, regions: 5, years: 30 }, maxHubs: 8, maxAirportLevel: 7, researchSlots: 5 },
  { index: 9, title: 'Global Player', requires: { routes: 190, monthlyPax: 3_500_000, reputation: 65, regions: 6, years: 40 }, maxHubs: 12, maxAirportLevel: 7, researchSlots: 5 },
];

/** Höchster Rang; im Free Mode gilt er vom ersten Monat an (wie heute). SPEZIFIKATION 6.7. */
export const MAX_RANK = RANKS.length - 1;

/** Werkzeuge, die ein Rang öffnet (Spalte „Weitere Freischaltungen“). */
export type RankUnlock =
  | 'localCampaign'
  | 'frequentFlyer'
  | 'nationalCampaign'
  | 'vipLounge'
  | 'globalCampaign'
  | 'takeoverDistressed'
  | 'managementTier3'
  | 'takeoverHealthy';

/** Rang, ab dem ein Werkzeug offen ist (wie heute `src/lib/airlineRank.ts:187-197`). SPEZIFIKATION 6.7. */
export const RANK_UNLOCKS: Readonly<Record<RankUnlock, number>> = {
  localCampaign: 0,
  frequentFlyer: 2,
  nationalCampaign: 3,
  vipLounge: 4,
  globalCampaign: 6,
  takeoverDistressed: 6,
  managementTier3: 8,
  takeoverHealthy: 9,
};

// ---------------------------------------------------------------------------
// 6.8 Flugzeugklassen
// ---------------------------------------------------------------------------

/** Flugzeugklasse für Freischaltung und Forschung (6 Stufen nach Größe; nicht `AircraftClass` der Daten). SPEZIFIKATION 6.8. */
export type SizeClass = 'commuter' | 'regional' | 'narrowbody' | 'widebody' | 'jumbo' | 'supersonic';

/** Alle Flugzeugklassen, kleinste zuerst. SPEZIFIKATION 6.8. */
export const SIZE_CLASSES: readonly SizeClass[] = ['commuter', 'regional', 'narrowbody', 'widebody', 'jumbo', 'supersonic'];

/** Regional-Flugzeuge bis zu so vielen Sitzen sind „Commuter“ (offen; heute `src/lib/aircraftClasses.ts:55`). SPEZIFIKATION 6.8. */
export const COMMUTER_MAX_SEATS = 60;

/** Narrowbodies bis zu so vielen Sitzen zählen als „Regional“ (heute `src/lib/aircraftClasses.ts:54`). SPEZIFIKATION 6.8. */
export const REGIONAL_JET_MAX_SEATS = 130;

/** Widebodies über so vielen Sitzen sind „Jumbo“ (heute `src/lib/aircraftClasses.ts:46`). SPEZIFIKATION 6.8. */
export const JUMBO_MIN_SEATS = 500;

/** Schneller als so viele km/h ist „Überschall“ (heute `src/lib/aircraftClasses.ts:51`). SPEZIFIKATION 6.8. */
export const SUPERSONIC_MIN_KMH = 1000;

/** Forschungs-Projekt, das eine Flugzeugklasse öffnet. */
export interface ClassResearch {
  /** Id des Projekts (wie heute, `src/lib/research.ts`). */
  readonly id: string;
  /** Rang, ab dem das Projekt erscheint (E41). */
  readonly rank: number;
  /** Klasse, deren Projekt vorher fertig sein muss; `null` = keine. */
  readonly requires: SizeClass | null;
  /** Dauer in Monaten. */
  readonly months: number;
  /** Preis in $ von 1960, über `atCost` (E6). */
  readonly price1960: number;
}

/**
 * Klassen-Projekte (Startwerte; Preise endgültig aus 3.9). Commuter ist ohne Projekt offen. Überschall braucht
 * Widebody statt Jumbo (E41). SPEZIFIKATION 6.8.
 */
export const CLASS_RESEARCH: Readonly<Record<Exclude<SizeClass, 'commuter'>, ClassResearch>> = {
  regional: { id: 'class-regional', rank: 1, requires: null, months: 6, price1960: 3_000_000 },
  narrowbody: { id: 'class-narrowbody', rank: 2, requires: 'regional', months: 9, price1960: 12_000_000 },
  widebody: { id: 'class-widebody', rank: 4, requires: 'narrowbody', months: 12, price1960: 40_000_000 },
  jumbo: { id: 'class-jumbo', rank: 5, requires: 'widebody', months: 18, price1960: 80_000_000 },
  supersonic: { id: 'class-supersonic', rank: 5, requires: 'widebody', months: 24, price1960: 60_000_000 },
};
