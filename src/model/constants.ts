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
