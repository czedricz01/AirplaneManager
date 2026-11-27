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
 * - „Alt-Code“ (auch „wie im Alt-Code“) meint die Rechnung vor dem Neubau, Stand Commit `231d08b`
 *   (aufgenommen in `docs/neubau/bestand/`). Datei- und Zeilenangaben dahinter gelten für diesen Commit;
 *   viele dieser Dateien sind inzwischen entfernt oder gekürzt (Paket 5.2). Eine Zeile ohne Datei (`:57`)
 *   gehört zur Datei des vorigen Verweises, im Abschnitt 7 sonst zu `src/lib/aiSimulation.ts`.
 *   Gilt für alle Dateien in `src/model/` (F78).
 */

import type { RivalPersonality } from '../data/rivalAirlines';

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
 * Wachstum des Kostenindex je Jahr (1,2 %). Startwert aus dem Alt-Code
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

/**
 * Faktor auf die Betriebskosten des Spielers: Flugbetrieb (Treibstoff, Besatzung, Landung) und Kosten je Fluggast
 * (Verpflegung, Gebühren, Frequent flyer). Normal = 1; KI immer 1 (E87). SPEZIFIKATION 1.8.
 */
export const DIFFICULTY_COST_FACTOR: Readonly<Record<Difficulty, number>> = {
  Easy: 0.85,
  Normal: 1,
  Hard: 1.1,
};

// ---------------------------------------------------------------------------
// 2.1 Flugzeit-Index
// ---------------------------------------------------------------------------

/**
 * Stützpunkte des Flugzeit-Index als [Minuten, Index]. Dazwischen gerade Linie,
 * darunter 1, darüber 8 (wie im Alt-Code `src/lib/financeUtils.ts:246-262`). SPEZIFIKATION 2.1.
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

/** Ab diesem Alter (Jahre) verliert ein Flugzeug Type appeal (Alt-Code: `src/lib/fleetCosts.ts:27`). SPEZIFIKATION 2.2. */
export const TYPE_APPEAL_DECAY_FROM = 8;

/** Höchster Verlust an Type appeal durch das Alter, Punkte (Alt-Code: `src/lib/fleetCosts.ts:28`). SPEZIFIKATION 2.2. */
export const TYPE_APPEAL_DECAY_MAX = 15;

/** Erstkunden-Bonus auf den Type appeal, Punkte (Alt-Code: `src/lib/preorders.ts:31`). SPEZIFIKATION 2.2, 8. */
export const LAUNCH_BONUS = 5;

/** So viele Monate ab Lieferung gilt der Erstkunden-Bonus (Alt-Code: `src/lib/preorders.ts:32`). SPEZIFIKATION 2.2, 8. */
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
  /** Erster Spielmonat, in dem das Teil eingebaut werden kann (Lieferbarkeit, Daten wie im Alt-Code). */
  readonly availableFrom: number;
  /** Nur in Flugzeugtypen mit mindestens so vielen Sitzen (Typ-Feld `capacity`). */
  readonly minCapacity?: number;
}

/** Grundwert des Interior score je Klasse (Alt-Code: `ConfigurePurchaseView.tsx:403-442`). SPEZIFIKATION 2.3. */
export const INTERIOR_BASE: Readonly<Record<CabinClass, number>> = {
  economy: 50,
  premium: 55,
  business: 60,
  first: 70,
};

/** Die Punkte des Sitztyps zählen so oft (Alt-Code: `ConfigurePurchaseView.tsx:109`). SPEZIFIKATION 2.3. */
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
 * Sitztypen je Klasse (Name wie gespeichert in `seatType`). Punkte und Lieferbarkeit wie im Alt-Code
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
 * Ausstattung je Klasse: Punkte und Lieferbarkeit wie im Alt-Code `FEATURE_POP`
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
 * Kabinenweite Extras: wirken in jeder Klasse gleich. Punkte wie im Alt-Code `CABIN_EXTRA_POP`
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

/** Anteil des Type appeal am Cabin rating (Alt-Code: `src/lib/financeUtils.ts:523`). SPEZIFIKATION 2.4. */
export const TYPE_APPEAL_SHARE = 0.33;

/** Anteil des Interior score am Cabin rating (Alt-Code: `src/lib/financeUtils.ts:523`). SPEZIFIKATION 2.4. */
export const INTERIOR_SHARE = 0.67;

/** So viel vom Interior score behält eine ganz abgenutzte Kabine (Alt-Code: `src/lib/financeUtils.ts:499`). SPEZIFIKATION 2.4. */
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
 * Ende der Strecke **und** Premium-Bordküche im Flugzeug). Wie im Alt-Code `validateClassConfigs`
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

/** Cabin rating, das eine Klasse erwartet (Alt-Code: `src/lib/financeUtils.ts:779`). SPEZIFIKATION 2.6.1. */
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
 * (Alt-Code: `src/lib/financeUtils.ts:788-793`). SPEZIFIKATION 2.6.2.
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
 * zählt die Hälfte (Business 4, wie im Alt-Code je Flughafen), an beiden Enden voll. SPEZIFIKATION 2.6.3.
 */
export const LOUNGE_POINTS: Readonly<Record<CabinClass, number>> = {
  economy: 0,
  premium: 2,
  business: 8,
  first: 8,
};

/** Punkte bei einem Abstellplatz für jeden belegten Slot (Alt-Code: `src/lib/financeUtils.ts:584`). SPEZIFIKATION 2.6.3. */
export const STAND_POINTS = 2;

/**
 * Abzug für Premium, Business und First an einem Flughafen ohne bedienten Schalter (nur Selbstbedienung).
 * Economy nie. E55. SPEZIFIKATION 2.6.3.
 */
export const DESK_TYPE_PENALTY = -10;

/** Arten der Check-in-Schalter: bedient und Selbstbedienung (Namen wie im Spielstand). */
export type DeskType = 'normal' | 'self';

/** Sitze je Woche, die ein Schalter abfertigt (Alt-Code: `src/lib/financeUtils.ts:141`). SPEZIFIKATION 2.6.3. */
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

/** Moral, bei der das Personal die Satisfaction weder hebt noch senkt (Alt-Code: `src/lib/staff.ts:86`). SPEZIFIKATION 2.6.4. */
export const MORALE_NEUTRAL = 50;

/** Satisfaction-Punkte je Moral-Punkt über oder unter `MORALE_NEUTRAL` (−5 … +5). SPEZIFIKATION 2.6.4. */
export const SAT_PER_MORALE_POINT = 0.1;

// ---------------------------------------------------------------------------
// 2.6.5 Forschungs-Teil
// ---------------------------------------------------------------------------

// Satisfaction-Punkte aus Forschung: Feld `satisfactionPoints` der Forschungs-Tabelle `RESEARCH_PROJECTS` (6.9, F37).

// ---------------------------------------------------------------------------
// 2.10 Satisfaction factor
// ---------------------------------------------------------------------------

/**
 * Bis Satisfaction 100: so viel weniger Zahlungsbereitschaft je Punkt unter 100 (50 → 0,75, 0 → 0,5).
 * Startwert; endgültige Kurve aus dem Balance-Skript (3.9, E15). SPEZIFIKATION 2.10.
 */
export const SAT_FACTOR_LOW_SLOPE = 0.005;

/** Über 100: linearer Zuwachs je Punkt (Alt-Code: `src/lib/financeUtils.ts:744`). SPEZIFIKATION 2.10. */
export const SAT_FACTOR_HIGH_A = 0.008;

/** Über 100: Abflachung je Punkt² (160 → ≈ 1,35). SPEZIFIKATION 2.10. */
export const SAT_FACTOR_HIGH_B = 0.000035;

// ---------------------------------------------------------------------------
// 3.1 Bezugs-Flugzeit und Flugzeit einer Strecke
// ---------------------------------------------------------------------------

/**
 * Feste Bezugsgeschwindigkeit, km/h: Die Marktgröße misst die Entfernung mit dieser Geschwindigkeit,
 * nie mit der des eingesetzten Flugzeugs (E20; Alt-Code: `src/lib/transferUtils.ts:70`). SPEZIFIKATION 3.1.
 */
export const REFERENCE_SPEED = 800;

/** Erdradius in km für die Großkreis-Entfernung (Alt-Code: `src/data/airports.ts:62`). SPEZIFIKATION 1.2, 3.1. */
export const EARTH_RADIUS_KM = 6371;

/** Geflogener Weg = Großkreis × diesen Faktor (Luftstraßen; Alt-Code: `src/lib/financeUtils.ts:203`). SPEZIFIKATION 3.1. */
export const ROUTE_DETOUR = 1.02;

/** Beschleunigung bis zur Reisegeschwindigkeit, km/h² (Alt-Code: `src/lib/financeUtils.ts:206`). SPEZIFIKATION 3.1. */
export const BLOCK_ACCEL = 6000;

/** Verzögerung aus der Reisegeschwindigkeit, km/h² (Alt-Code: `src/lib/financeUtils.ts:207`). SPEZIFIKATION 3.1. */
export const BLOCK_DECEL = 4000;

// ---------------------------------------------------------------------------
// 3.2 Stadtgrößen und Verflechtung
// ---------------------------------------------------------------------------

/** Hochzahl der kleineren Stadt in der Verflechtung (zählt stärker; Alt-Code: `src/lib/financeUtils.ts:670`). SPEZIFIKATION 3.2. */
export const LINK_SMALL = 1.4;

/** Hochzahl der größeren Stadt in der Verflechtung (Alt-Code: `src/lib/financeUtils.ts:670`). SPEZIFIKATION 3.2. */
export const LINK_LARGE = 0.6;

/**
 * Saison des Tourismus je Kalendermonat (Index 0 = Januar), Nordhalbkugel. Mittel ≈ 1.
 * Südhalbkugel: um 6 Monate versetzt (Alt-Code: `src/lib/financeUtils.ts:279`). SPEZIFIKATION 3.2.
 */
export const SEASON_BY_MONTH: readonly number[] = [
  0.89, 0.91, 0.92, 0.96, 1.03, 1.1, 1.15, 1.14, 1.06, 0.95, 0.88, 1.0,
];

/** Weltregionen für Ereignisse (wie im Alt-Code `EventRegion`, `src/lib/eventSystem.ts:28`). SPEZIFIKATION 3.5. */
export type WorldRegion = 'EU' | 'NA' | 'SA' | 'AF' | 'AS' | 'OC';

/** Alle Weltregionen (6 Stück; Rang, Meilensteine und Jahresziel zählen sie, R15). */
export const WORLD_REGIONS: readonly WorldRegion[] = ['EU', 'NA', 'SA', 'AF', 'AS', 'OC'];

// ---------------------------------------------------------------------------
// 3.3 Nachfrage-Wachstum
// ---------------------------------------------------------------------------

/**
 * Wachstum der Weltnachfrage 1960 → 2019 (E7, W8). Die einzige Wachstumsregel der Nachfrage.
 * 2,25 statt 2,5, weil sich die Weltanteile der Städte verschieben: Die Summe der Marktgrößen aller Paare wächst
 * damit 1960 → 2019 um etwa × 2,5 (E64, Balance-Skript B3.1). SPEZIFIKATION 3.3.
 */
export const DEMAND_GROWTH_1960_2019 = 2.25;

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

/** Wie stark der Entfernungs-Faktor mit der Flugzeit fällt (Hochzahl). Aus dem Balance-Skript (E70, Paket 3.9d; Start 0,5). SPEZIFIKATION 3.4. */
export const DISTANCE_EXP = 0.3;

// ---------------------------------------------------------------------------
// 3.6 Marktgröße
// ---------------------------------------------------------------------------

/** Hochzahl der Verflechtung (Abstand großer zu kleinen Paaren; Alt-Code: `src/lib/financeUtils.ts:683`). SPEZIFIKATION 3.6. */
export const LINK_EXP = 0.448351;

/** Maßstab der Marktgröße, Fluggäste je Woche (Alt-Code: 29 × 0,9 bei Normal; E67, E70: halbiert). Aus dem Balance-Skript (Paket 3.9d). SPEZIFIKATION 3.6. */
export const DEMAND_SCALE = 14.5;

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

/** Hochzahl der Abflüge in der Anziehung (Wurzel, Alt-Code: `src/lib/financeUtils.ts:1134`). SPEZIFIKATION 3.9.1. */
export const FREQUENCY_EXP = 0.5;

/**
 * Preis-Empfindlichkeit je Klasse (Hochzahl in `priceFactor`): wie stark der Preis die Anziehung eines Angebots
 * ändert. Bis E97 2,2 / 2,0 / 1,8 / 1,7 und zugleich Grundlage von `noFlyAppeal`; jetzt größer, damit Billigpreise
 * Fluggäste bringen und Wucher sie kostet (E90, E91, E97). Startwerte (3.9). SPEZIFIKATION 3.9.2.
 */
export const PRICE_SENSITIVITY: Readonly<Record<CabinClass, number>> = {
  economy: 3.4,
  premium: 3.0,
  business: 2.6,
  first: 2.4,
};

/**
 * Preis-Empfindlichkeit des Gesamtmarkts: bestimmt „Nicht fliegen“ (3.10) und das Potenzial je Klasse. Getrennt von
 * `PRICE_SENSITIVITY` (Anziehung zwischen den Angeboten, E97): Beim Marktpreis fliegen allein weiter genau
 * `marketSize × classShare`, aber billige Angebote ziehen mehr aus dem Markt und von Rivalen. Startwerte (3.9).
 * SPEZIFIKATION 3.10.
 */
export const NO_FLY_SENSITIVITY: Readonly<Record<CabinClass, number>> = {
  economy: 2.2,
  premium: 2.0,
  business: 1.8,
  first: 1.7,
};

/** Hochzahl der Flugzeit in der Anziehung: halbe Flugzeit = Faktor 2 (E20). Startwert (3.9). SPEZIFIKATION 3.9.3. */
export const FLIGHT_TIME_EXP = 1.0;

/** Ruf-Wirkung auf die Anziehung je Punkt über oder unter 50 (0,9 bei 0, 1,1 bei 100; E36). SPEZIFIKATION 3.9.4. */
export const REPUTATION_DEMAND_SLOPE = 0.002;

/** Frequent flyer im ersten Laufmonat (Alt-Code: `src/lib/marketing.ts:192`). SPEZIFIKATION 3.9.4. */
export const FF_START = 0.05;

/** Frequent flyer: Zuwachs je weiterem Laufmonat (Alt-Code: `src/lib/marketing.ts:193`). SPEZIFIKATION 3.9.4. */
export const FF_PER_MONTH = 0.01;

/** Frequent flyer: höchster Zuschlag (Alt-Code: `src/lib/marketing.ts:194`). SPEZIFIKATION 3.9.4. */
export const FF_MAX = 0.2;

/** Stufe einer Werbe-Kampagne. */
export type CampaignTier = 'local' | 'national' | 'global';

/** Zuschlag einer laufenden Kampagne auf den Werbe-Faktor ihrer Region (Alt-Code: `src/lib/marketing.ts:74-78`). SPEZIFIKATION 3.9.5. */
export const ADVERTISING_BOOST: Readonly<Record<CampaignTier, number>> = {
  local: 0.05,
  national: 0.1,
  global: 0.18,
};

/** Höchster Werbe-Faktor einer Region, wie viele Kampagnen auch laufen (Alt-Code: `src/lib/marketing.ts:84`). SPEZIFIKATION 3.9.5. */
export const ADVERTISING_MAX = 1.25;

/** Höchster Established route bonus (früher `src/lib/routeMaturity.ts`, entfernt in 5.2b). SPEZIFIKATION 3.9.6. */
export const ESTABLISHED_BONUS_MAX = 0.05;

/** Ab diesem Alter (Monate) wächst der Established route bonus. SPEZIFIKATION 3.9.6. */
export const ESTABLISHED_FROM = 24;

/** Ab diesem Alter (Monate) ist er voll. SPEZIFIKATION 3.9.6. */
export const ESTABLISHED_TO = 48;

// ---------------------------------------------------------------------------
// 3.12 Anlauf
// ---------------------------------------------------------------------------

/** Anteil der gewählten Fluggäste, den ein neues Angebot im ersten Monat erreicht (früher `src/lib/routeMaturity.ts`, entfernt in 5.2b). SPEZIFIKATION 3.12. */
export const RAMP_START = 0.6;

/** Monate bis zur vollen Nachfrage (früher `src/lib/routeMaturity.ts`, entfernt in 5.2b). SPEZIFIKATION 3.12. */
export const RAMP_MONTHS = 9;

/** Zuschlag auf `RAMP_START` mit der Forschung „Route planning suite“ (Feld `rampBonus`, 6.9). SPEZIFIKATION 3.12. */
export const RAMP_RESEARCH_BONUS = 0.15;

// ---------------------------------------------------------------------------
// 3.13 Umsteige-Verbindungen
// ---------------------------------------------------------------------------

/** Minuten einer Woche (Fahrplan: Montag 00:00 = 0). */
export const MINUTES_PER_WEEK = 7 * 24 * 60;

/** Größter Umweg (geflogene / direkte Entfernung) einer Verbindung (Alt-Code: `src/lib/transferUtils.ts:41`). SPEZIFIKATION 3.13. */
export const MAX_DETOUR = 1.6;

/** Kürzeste Umstiegszeit in Minuten (Alt-Code: `src/lib/transferUtils.ts:37`). SPEZIFIKATION 3.13. */
export const MIN_CONNECTION = 45;

/** Längste Umstiegszeit in Minuten (Alt-Code: `src/lib/transferUtils.ts:39`). SPEZIFIKATION 3.13. */
export const MAX_CONNECTION = 360;

/** Preis einer Verbindung als Anteil des Marktpreises Start–Ziel (E25; Alt-Code: `src/lib/transferUtils.ts:45`). SPEZIFIKATION 3.13, 4.8. */
export const TRANSFER_FARE_SHARE = 0.9;

/** Umsteigen ist lästig: Faktor auf die Anziehung einer Verbindung bei Drehkreuz-Güte 1. Startwert (3.9). SPEZIFIKATION 3.13. */
export const CONNECTION_APPEAL = 0.5;

/** Drehkreuz-Güte eines Flughafens ohne Verwaltung (Alt-Code: `src/lib/transferUtils.ts:161`). SPEZIFIKATION 3.13. */
export const HUB_QUALITY_BASE = 0.4;

/** Drehkreuz-Güte je Verwaltungsstufe. SPEZIFIKATION 3.13. */
export const HUB_QUALITY_PER_LEVEL = 0.15;

/** Drehkreuz-Güte je Extra (Stufe 3, Lounge, Catering; Alt-Code: `src/lib/hubOwnership.ts:27`, `transferUtils.ts:158-159`). SPEZIFIKATION 3.13. */
export const HUB_QUALITY_PER_EXTRA = 0.05;

/** Ab dieser Verwaltungsstufe zählt die Stufe selbst als Extra. SPEZIFIKATION 3.13. */
export const HUB_QUALITY_EXTRA_LEVEL = 3;

/** Faktor auf die Drehkreuz-Güte mit der Forschung „Alliance“ (Feld `hubQualityFactor`, 6.9). SPEZIFIKATION 3.13. */
export const HUB_QUALITY_RESEARCH_FACTOR = 1.1;

// ---------------------------------------------------------------------------
// 4.1 Grundpreis Economy
// ---------------------------------------------------------------------------

/** Grundbetrag eines Economy-Tickets in $ von 1960 (Alt-Code: `src/lib/financeUtils.ts:725`). Startwert (3.9). SPEZIFIKATION 4.1. */
export const FARE_BASE_1960 = 30;

/** Economy-Preis je km Großkreis-Entfernung in $ von 1960 (Alt-Code: `src/lib/financeUtils.ts:725`). Startwert (3.9). SPEZIFIKATION 4.1. */
export const FARE_PER_KM_1960 = 0.05;

/**
 * Preis-Faktor je Flugzeit-Index 1 … 8 (Stelle 0 = Index 1): Zuschlag auf Kurzstrecken, Abschlag auf Mittel- und
 * Langstrecken. Dazwischen gerade Linie (Alt-Code: `SHORT_HAUL_FARE_FACTOR` 1,15 … 1, `src/lib/financeUtils.ts:720`).
 * Werte aus dem Balance-Skript (E70, Paket 3.9d: Marge der KI um 20 %). SPEZIFIKATION 4.1.
 */
export const FARE_TIME_FACTOR: readonly number[] = [1.04, 1.04, 0.9, 0.86, 0.72, 0.59, 0.54, 0.5];

// ---------------------------------------------------------------------------
// 4.2 Klassen-Verhältnis
// ---------------------------------------------------------------------------

/** Klassen-Verhältnis bei Flugzeit-Index 1 (Alt-Code: `src/lib/financeUtils.ts:728-730`). Startwert (3.9). SPEZIFIKATION 4.2. */
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

/** Alle Kostenarten, die eine Forschung senken kann. SPEZIFIKATION 5.1, 6.9. */
export const COST_RESEARCH_KINDS: readonly CostResearchKind[] = ['fuel', 'crew', 'fees', 'catering', 'maintenance', 'slots'];

// Einsparungen je Projekt: Feld `costSaving` der Forschungs-Tabelle `RESEARCH_PROJECTS` (6.9, F37).

/** Kein Kosten-Faktor aus Forschung sinkt unter diesen Wert (Alt-Code: `src/lib/research.ts:253`). SPEZIFIKATION 5.1. */
export const RESEARCH_COST_FLOOR = 0.4;

/** Höchste Verwaltungsstufe an einem Flughafen. SPEZIFIKATION 5.1, 5.11. */
export const MAX_MANAGEMENT_TIER = 3;

/** Gebühren-Nachlass ab Verwaltungsstufe 2 (Alt-Code: `src/lib/hubOwnership.ts:20-24`). SPEZIFIKATION 5.1. */
export const HUB_FEE_FACTOR_TIER2 = 0.95;

/** Gebühren-Nachlass auf Verwaltungsstufe 3 (Alt-Code: `src/lib/hubOwnership.ts:20-24`). SPEZIFIKATION 5.1. */
export const HUB_FEE_FACTOR_TIER3 = 0.85;

// ---------------------------------------------------------------------------
// 5.2 Treibstoffpreis
// ---------------------------------------------------------------------------

/**
 * Ausschläge der geschichtlichen Ölkrisen in der Treibstoff-Tabelle (E61). `startMonth` = Spielmonat
 * des Beginns (0 = Januar 1960), `months` = Dauer, `factor` = höchster Faktor (Alt-Code: `fuelMultiplier`,
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

/** Liter je Sitz und 100 km: `FUEL_BASE / (FUEL_EFF_OFFSET + Effizienz / FUEL_EFF_SCALE)` (Alt-Code: `src/lib/financeUtils.ts:1256`). SPEZIFIKATION 5.3. */
export const FUEL_BASE = 7.5;

/** Siehe `FUEL_BASE`. SPEZIFIKATION 5.3. */
export const FUEL_EFF_OFFSET = 0.75;

/** Siehe `FUEL_BASE`. SPEZIFIKATION 5.3. */
export const FUEL_EFF_SCALE = 70;

/** Effizienz-Punkte je fertiger Effizienz-Forschung (Alt-Code: +1 %, `src/lib/research.ts:99-147`). SPEZIFIKATION 5.3. */
export const EFFICIENCY_PER_RESEARCH = 1;

// Effizienz-Forschungen: Feld `efficiencyPoints` der Forschungs-Tabelle `RESEARCH_PROJECTS` (6.9, F37).

/** Höchste Effizienz eines Flugzeugs mit Forschung. SPEZIFIKATION 5.3. */
export const EFFICIENCY_MAX = 100;

// ---------------------------------------------------------------------------
// 5.4 Besatzung
// ---------------------------------------------------------------------------

/** Piloten im Cockpit (Alt-Code: `src/lib/financeUtils.ts:1263`). SPEZIFIKATION 5.4. */
export const COCKPIT_CREW = 2;

/** Lohn eines Piloten je Blockstunde in $ von 1960. SPEZIFIKATION 5.4. */
export const PILOT_RATE_1960 = 100;

/** Lohn eines Flugbegleiters je Blockstunde in $ von 1960. SPEZIFIKATION 5.4. */
export const ATTENDANT_RATE_1960 = 40;

/** Sitze je Flugbegleiter nach Klasse (neu; Economy wie im Alt-Code 50). SPEZIFIKATION 5.4. */
export const SEATS_PER_ATTENDANT: Readonly<Record<CabinClass, number>> = {
  economy: 50,
  premium: 35,
  business: 20,
  first: 10,
};

/** Mindestens so viele Flugbegleiter je Flug. SPEZIFIKATION 5.4. */
export const MIN_CABIN_CREW = 1;

/** Ab so vielen Sitzen gilt `MIN_CABIN_CREW`; darunter nur die Flugbegleiter nach Sitzen (E89). SPEZIFIKATION 5.4. */
export const ATTENDANT_FROM_SEATS = 20;

/** Sitze, ab denen ein Pilot den vollen Satz bekommt; darunter anteilig (E89). Startwert (3.9). SPEZIFIKATION 5.4. */
export const PILOT_RATE_REFERENCE_SEATS = 60;

/** Kleinster Anteil des Piloten-Satzes (E89). Startwert (3.9). SPEZIFIKATION 5.4. */
export const PILOT_RATE_MIN_SHARE = 0.4;

// ---------------------------------------------------------------------------
// 5.5 Landegebühr
// ---------------------------------------------------------------------------

/** Grundbetrag einer Landung je Flugzeugklasse in $ von 1960 (Alt-Code: `(2500 + …) × 1,1`, `src/lib/financeUtils.ts:1211-1213`). SPEZIFIKATION 5.5. */
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

/** Höchstsitze, bei denen ein Flugzeug die volle Gebühr seiner Klasse zahlt (Alt-Code: `src/lib/financeUtils.ts:1171`). SPEZIFIKATION 5.5. */
export const LANDING_REFERENCE_SEATS: Readonly<Record<AircraftClass, number>> = {
  Regional: 180,
  Narrowbody: 180,
  Widebody: 420,
};

/** Anteil der Gebühr für Propeller-Flugzeuge (leichter je Sitz, Alt-Code: `src/lib/financeUtils.ts:1179`). SPEZIFIKATION 5.5. */
export const PROPELLER_FEE_SHARE = 0.85;

/** Regional-Flugzeuge langsamer als diese Reisegeschwindigkeit (km/h) gelten als Propeller-Flugzeuge. SPEZIFIKATION 5.5. */
export const PROPELLER_MAX_SPEED = 700;

// ---------------------------------------------------------------------------
// 5.6 Check-in und Abfertigung
// ---------------------------------------------------------------------------

/** Check-in je Reise in $ von 1960 (Alt-Code: 0,5 $ an beiden Enden, E27). SPEZIFIKATION 5.6. */
export const CHECKIN_FEE_1960 = 1.0;

/** Abfertigung je Abflug eines Fluggasts in $ von 1960, nach Flughafengröße (Alt-Code: 3 / 4 / 5 $ an beiden Enden). SPEZIFIKATION 5.6. */
export const HANDLING_FEE_1960 = { small: 6, medium: 8, large: 10 } as const;

/** Ab dieser Flughafengröße gilt `HANDLING_FEE_1960.medium`. SPEZIFIKATION 5.6. */
export const HANDLING_MEDIUM_FROM = 3;

/** Ab dieser Flughafengröße gilt `HANDLING_FEE_1960.large`. SPEZIFIKATION 5.6. */
export const HANDLING_LARGE_FROM = 5;

// ---------------------------------------------------------------------------
// 5.8 Kosten je Fluggast (Frequent flyer, 5.14)
// ---------------------------------------------------------------------------

/** Kosten des Frequent-flyer-Programms je Reise in $ von 1960 (Alt-Code: `src/lib/marketing.ts:189`, neu mit Index). SPEZIFIKATION 5.8, 5.14. */
export const FFP_COST_PER_PAX_1960 = 0.8;

/** Anteil der Umsteiger einer Teilstrecke, die ihre Reise am äußeren Ende beginnen (dort Check-in). SPEZIFIKATION 5.8. */
export const TRANSFER_CHECKIN_SHARE = 0.5;

// ---------------------------------------------------------------------------
// 5.10 Slots, Abstellplätze, Schalter
// ---------------------------------------------------------------------------

/** Slots aller Arten und aller Gesellschaften je Größenstufe eines Flughafens (Alt-Code: nur in Ansichten, `src/components/AirportDetailView.tsx:128`). SPEZIFIKATION 5.10, E50. */
export const SLOTS_PER_AIRPORT_LEVEL = 300;

/** Kaufpreis eines Slots je Art in $ von 1960 (Alt-Code: `src/lib/financeUtils.ts:1715-1719`, ohne Index). SPEZIFIKATION 5.10. */
export const SLOT_PRICE_1960: Readonly<Record<AircraftClass, number>> = {
  Regional: 25_000,
  Narrowbody: 50_000,
  Widebody: 100_000,
};

/** Miete eines gekauften Slots je Woche in $ von 1960, belegt oder nicht (Alt-Code: `src/lib/financeUtils.ts:25-29`). SPEZIFIKATION 5.10. */
export const SLOT_RENT_1960: Readonly<Record<AircraftClass, number>> = {
  Regional: 125,
  Narrowbody: 250,
  Widebody: 250,
};

/** Verkaufserlös eines Slots als Anteil des Kaufpreises im Verkaufsmonat (Alt-Code: `src/lib/financeUtils.ts:1806-1808`). SPEZIFIKATION 5.10. */
export const SLOT_RESALE_SHARE = 0.5;

/** Abstellplätze gibt es erst an Flughäfen ab dieser Größe (Alt-Code: `src/lib/financeUtils.ts:1703-1710`). SPEZIFIKATION 5.10. */
export const STANDS_MIN_AIRPORT_SIZE = 3;

/**
 * Slots der Klasse Widebody (Widebody, Jumbo, Überschall) gibt es erst an Flughäfen ab dieser Größe, für Spieler und KI
 * (E78; vorher nur Regel der Oberfläche, `getInfraAvailability`). SPEZIFIKATION 5.10, 7.10.
 */
export const WIDEBODY_SLOTS_MIN_AIRPORT_SIZE = 3;

/** Miete eines Abstellplatzes je Woche in $ von 1960, Verwaltungsstufe 0–1 (Alt-Code: `src/lib/financeUtils.ts:31-35`). SPEZIFIKATION 5.10. */
export const STAND_RENT_1960: Readonly<Record<AircraftClass, number>> = {
  Regional: 150,
  Narrowbody: 300,
  Widebody: 600,
};

/** Ab dieser Verwaltungsstufe hat jeder Slot einen Abstellplatz ohne Miete (E28). SPEZIFIKATION 5.10. */
export const FREE_STANDS_FROM_TIER = 2;

/** Miete eines Check-in-Schalters je Woche bei voller Auslastung, in $ von 1960 (Alt-Code: `src/lib/financeUtils.ts:38-64`). SPEZIFIKATION 5.10. */
export const DESK_RENT_1960: Readonly<Record<DeskType, number>> = {
  normal: 2500,
  self: 1500,
};

/** Anteil der Schalter-Miete, der auch ohne Fluggäste anfällt; der Rest wächst mit `deskLoad` bis 1. SPEZIFIKATION 5.10. */
export const DESK_FIXED_SHARE = 0.2;

/** Erster Spielmonat mit Selbstbedienungs-Schaltern: Januar 1995 (Alt-Code: `src/lib/financeUtils.ts:1703-1710`). SPEZIFIKATION 5.10. */
export const SELF_DESK_FROM = (1995 - START_YEAR) * 12;

// ---------------------------------------------------------------------------
// 5.11 Verwaltungsstufen und Einrichtungen
// ---------------------------------------------------------------------------

/** Einmalpreis einer Verwaltungsstufe je Größenstufe des Flughafens, in $ von 1960 (Alt-Code: `src/lib/financeUtils.ts:1656-1660`, ohne Index). SPEZIFIKATION 5.11. */
export const TIER_PRICE_1960: Readonly<Record<1 | 2 | 3, number>> = {
  1: 30_000,
  2: 750_000,
  3: 25_000_000,
};

/** Einrichtungen einer Gesellschaft an einem Flughafen (Namen wie im Spielstand, `hubFacilities` in `src/lib/gameTypes.ts`). */
export type FacilityKind = 'hangar' | 'vipLounge' | 'catering';

/** Einmalpreis einer Einrichtung in $ von 1960 (Alt-Code: im Klick-Handler, `src/components/AirportDetailView.tsx:443-554`). SPEZIFIKATION 5.11. */
export const FACILITY_PRICE_1960: Readonly<Record<FacilityKind, number>> = {
  hangar: 250_000,
  vipLounge: 1_000_000,
  catering: 250_000,
};

/** Unterhalt einer Einrichtung je Woche in $ von 1960, ohne Gebühren-Faktor (Alt-Code: `src/lib/financeUtils.ts:111-113`). SPEZIFIKATION 5.11. */
export const FACILITY_UPKEEP_1960: Readonly<Record<FacilityKind, number>> = {
  hangar: 10_000,
  vipLounge: 12_500,
  catering: 10_000,
};

// ---------------------------------------------------------------------------
// 5.12 Flugzeug-Unterhalt
// ---------------------------------------------------------------------------

/** Versicherung je Jahr als Anteil des heutigen Neupreises (Alt-Code: `src/lib/fleetCosts.ts:14`). SPEZIFIKATION 5.12. */
export const INSURANCE_RATE = 0.006;

/** Wartungsprogramm je Jahr als Anteil des Neupreises bei Alter 0 (Alt-Code: `src/lib/fleetCosts.ts:16`). SPEZIFIKATION 5.12. */
export const MAINTENANCE_RATE_NEW = 0.03;

/** Wartungsprogramm je Jahr ab `MAINTENANCE_FULL_AGE` (Alt-Code: `src/lib/fleetCosts.ts:17`). SPEZIFIKATION 5.12. */
export const MAINTENANCE_RATE_OLD = 0.08;

/** Ab diesem Alter in Jahren gilt `MAINTENANCE_RATE_OLD`; dazwischen gerade Linie. SPEZIFIKATION 5.12. */
export const MAINTENANCE_FULL_AGE = 25;

/** Anteil des Unterhalts für ein Flugzeug ohne Strecke (Alt-Code: `src/lib/fleetCosts.ts:20`). SPEZIFIKATION 5.12. */
export const PARKED_SHARE = 0.5;

/** So viele Flugzeug-Familien hat eine Flotte ohne Zuschlag (Alt-Code: `src/lib/fleetCosts.ts:73`). SPEZIFIKATION 5.12. */
export const FREE_FAMILIES = 3;

/** Wartungs-Zuschlag je Familie über `FREE_FAMILIES` (Alt-Code: `src/lib/fleetCosts.ts:74`). SPEZIFIKATION 5.12. */
export const VARIETY_PENALTY_PER_FAMILY = 0.03;

/** Höchster Wartungs-Zuschlag für viele Familien (Alt-Code: `src/lib/fleetCosts.ts:75`). SPEZIFIKATION 5.12. */
export const VARIETY_PENALTY_MAX = 0.3;

/**
 * Wartungs-Nachlass nach Zahl der Flugzeuge der eigenen Familie, größte Schwelle zuerst
 * (Alt-Code: `src/lib/fleetCosts.ts:67-72`). SPEZIFIKATION 5.12.
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

/** Jahre bis zum Restwert (Startwert; Alt-Code: 2 % je Jahr bis 40 %, `src/lib/fleetCosts.ts:23-24`). SPEZIFIKATION 5.13. */
export const DEPRECIATION_YEARS = 25;

/** Restwert nach `DEPRECIATION_YEARS` als Anteil von `valueBase` (3,2 % je Jahr). SPEZIFIKATION 5.13. */
export const RESIDUAL_SHARE = 0.2;

/** So viel vom Wert kostet ein ganz abgenutztes Flugzeug (Zustand 0) höchstens. SPEZIFIKATION 5.13. */
export const CONDITION_VALUE_SPAN = 0.6;

/** Anteil der Zelle am Zustand für den Wert; der Rest ist die Kabine (Alt-Code: 0,45 Zelle + 0,15 Kabine). SPEZIFIKATION 5.13. */
export const AIRFRAME_VALUE_SHARE = 0.75;

/**
 * Preis je Sitz des Sitztyps in $ von 1960 (Alt-Code: `SEAT_DEFS`, Feld `c`, `src/components/ConfigurePurchaseView.tsx:326-353`).
 * Schlüssel wie `SEAT_TYPE_POINTS`; Lieferbarkeit von dort. SPEZIFIKATION 5.13 (`cabinListPrice`).
 */
export const SEAT_TYPE_PRICE_1960: Readonly<Record<CabinClass, Readonly<Record<string, number>>>> = {
  economy: { Standard: 0, Comfort: 80, Ergonomic: 150, 'Premium-Eco': 300 },
  premium: { Standard: 0, Recliner: 400, Cradle: 800 },
  business: { Standard: 0, Recliner: 300, 'Angled Flat': 1000, 'Lie-Flat': 2500, Suites: 5000 },
  first: { Standard: 0, Recliner: 500, 'Flat Bed': 1500, 'Open Suite': 3000, 'Closed Suite': 8000, Residence: 25000 },
};

/**
 * Preis je Sitz einer Ausstattung in $ von 1960 (Alt-Code: `src/components/ConfigurePurchaseView.tsx:492-535`).
 * Schlüssel wie `FEATURE_POINTS`; Lieferbarkeit von dort. SPEZIFIKATION 5.13 (`cabinListPrice`).
 */
export const FEATURE_PRICE_1960: Readonly<Record<CabinClass, Readonly<Record<string, number>>>> = {
  economy: { ife: 300, power: 100, hooks: 20, armrests: 50, headrests: 80, shell: 200, ped: 60 },
  premium: { ife: 400, power: 150, table: 50, calf: 150, foot: 100, light: 80, usbc: 100 },
  business: { ife: 600, power: 200, lumbar: 200, control: 800, massage: 1200, divider: 1500, charging: 300 },
  first: { ife: 1000, power: 300, wardrobe: 800, wood: 3000, mirror: 400, minibar: 2500, climate: 4000 },
};

/**
 * Preis eines kabinenweiten Extras je Flugzeug in $ von 1960 (Alt-Code: `src/components/ConfigurePurchaseView.tsx:391-397`).
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

/** Stufen einer Werbe-Kampagne (Namen wie im Spielstand, `CampaignTier` in `src/lib/gameState.ts`). */
export type CampaignLevel = 'local' | 'national' | 'global';

/**
 * Kosten einer Kampagne je laufendem Monat in $ von 1960 (Alt-Code `src/lib/marketing.ts:75-77`: 150 000 / 400 000 /
 * 1 000 000; halbiert mit E104, Paket 5.4g; eigene Teuerung entfällt). SPEZIFIKATION 5.14.
 */
export const CAMPAIGN_COST_1960: Readonly<Record<CampaignLevel, number>> = {
  local: 75_000,
  national: 200_000,
  global: 500_000,
};

/** Grundbetrag des Frequent-flyer-Programms je Monat in $ von 1960 (Alt-Code: `src/lib/marketing.ts:187`). SPEZIFIKATION 5.14. */
export const FFP_BASE_COST_1960 = 50_000;

// ---------------------------------------------------------------------------
// 5.15 Einnahme eigener Flughäfen
// ---------------------------------------------------------------------------

/** Anteil der Landegebühren anderer Gesellschaften, den Inhaber der Stufe 3 bekommen (Alt-Code: `src/lib/hubOwnership.ts:30`). SPEZIFIKATION 5.15. */
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

/**
 * Startkapital-Stufen des Spielers in $ von 1960, wählbar beim neuen Spiel (E11; Alt-Code: nominal, `src/App.tsx:1595-1598`).
 * Startkasse = `atCost(Stufe, Startmonat)` wie die Startkasse der KI (7.7, E6). Szenarien bringen ihre eigene Kasse.
 * SPEZIFIKATION 6.13.
 */
export const START_CAPITAL_TIERS_1960: readonly number[] = [25_000_000, 50_000_000, 100_000_000, 200_000_000];

/** Abzug im Ruf-Ziel je Anteil gestrichener Sitze: 1 % gestrichen → −1 Punkt. Startwert (3.9). SPEZIFIKATION 6.2. */
export const CANCELLED_REPUTATION_WEIGHT = 100;

/** Beitrag einer laufenden Kampagne zum Ruf-Ziel, Punkte (Zahlen wie im Alt-Code `src/lib/marketing.ts:75-77`). Startwerte (3.9). SPEZIFIKATION 6.3, E37. */
export const CAMPAIGN_REPUTATION: Readonly<Record<CampaignTier, number>> = {
  local: 0.5,
  national: 1,
  global: 2,
};

/** Höchster Werbe-Beitrag zum Ruf-Ziel, Punkte, wie viele Kampagnen auch laufen. SPEZIFIKATION 6.3, E37. */
export const ADVERTISING_REPUTATION_MAX = 3;

/** Anteil des Abstands zum Ruf-Ziel, den der Ruf je Monat zurücklegt (Halbwertszeit 4,3 Monate; Alt-Code: `src/lib/monthClose.ts:143`). SPEZIFIKATION 6.5. */
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
 * Tabelle der Ränge (Startwerte, endgültig aus dem Balance-Skript 3.9). Strecken, Fluggäste, Regionen,
 * Drehkreuze, Flughafen-Größen wie im Alt-Code (`src/lib/airlineRank.ts:42-103`); Ruf-Schwellen neu für die Skala mit
 * Neutralpunkt 50 (E36, E39); Forschungsplätze 3 / 4 / 5 ab Rang 4 / 6 / 8 (E42). Keine Mindest-Jahre im Geschäft mehr. SPEZIFIKATION 6.7.
 */
export const RANKS: readonly RankDef[] = [
  { index: 0, title: 'Startup', requires: { routes: 0, monthlyPax: 0, reputation: 0, regions: 0 }, maxHubs: 1, maxAirportLevel: 4, researchSlots: 2 },
  { index: 1, title: 'Local Airline', requires: { routes: 3, monthlyPax: 8_000, reputation: 30, regions: 1 }, maxHubs: 1, maxAirportLevel: 5, researchSlots: 2 },
  { index: 2, title: 'Regional Airline', requires: { routes: 6, monthlyPax: 25_000, reputation: 35, regions: 1 }, maxHubs: 2, maxAirportLevel: 5, researchSlots: 2 },
  { index: 3, title: 'Domestic Airline', requires: { routes: 12, monthlyPax: 70_000, reputation: 40, regions: 1 }, maxHubs: 2, maxAirportLevel: 6, researchSlots: 2 },
  { index: 4, title: 'National Airline', requires: { routes: 24, monthlyPax: 170_000, reputation: 45, regions: 1 }, maxHubs: 3, maxAirportLevel: 7, researchSlots: 3 },
  { index: 5, title: 'Continental Airline', requires: { routes: 40, monthlyPax: 350_000, reputation: 50, regions: 2 }, maxHubs: 4, maxAirportLevel: 7, researchSlots: 3 },
  { index: 6, title: 'International Airline', requires: { routes: 65, monthlyPax: 700_000, reputation: 53, regions: 3 }, maxHubs: 5, maxAirportLevel: 7, researchSlots: 4 },
  { index: 7, title: 'Intercontinental Airline', requires: { routes: 95, monthlyPax: 1_200_000, reputation: 56, regions: 4 }, maxHubs: 6, maxAirportLevel: 7, researchSlots: 4 },
  { index: 8, title: 'Flag Carrier', requires: { routes: 135, monthlyPax: 2_000_000, reputation: 60, regions: 5 }, maxHubs: 8, maxAirportLevel: 7, researchSlots: 5 },
  { index: 9, title: 'Global Player', requires: { routes: 190, monthlyPax: 3_500_000, reputation: 65, regions: 6 }, maxHubs: 12, maxAirportLevel: 7, researchSlots: 5 },
];

/** Höchster Rang; im Free Mode gilt er vom ersten Monat an (wie im Alt-Code). SPEZIFIKATION 6.7. */
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

/** Rang, ab dem ein Werkzeug offen ist (wie im Alt-Code `src/lib/airlineRank.ts:187-197`). SPEZIFIKATION 6.7. */
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

/** Regional-Flugzeuge bis zu so vielen Sitzen sind „Commuter“ (offen; Alt-Code: `src/lib/aircraftClasses.ts:55`). SPEZIFIKATION 6.8. */
export const COMMUTER_MAX_SEATS = 60;

/** Narrowbodies bis zu so vielen Sitzen zählen als „Regional“ (Alt-Code: `src/lib/aircraftClasses.ts:54`). SPEZIFIKATION 6.8. */
export const REGIONAL_JET_MAX_SEATS = 130;

/** Widebodies über so vielen Sitzen sind „Jumbo“ (Alt-Code: `src/lib/aircraftClasses.ts:46`). SPEZIFIKATION 6.8. */
export const JUMBO_MIN_SEATS = 500;

/** Schneller als so viele km/h ist „Überschall“ (Alt-Code: `src/lib/aircraftClasses.ts:51`). SPEZIFIKATION 6.8. */
export const SUPERSONIC_MIN_KMH = 1000;

/** Forschungs-Projekt, das eine Flugzeugklasse öffnet. */
export interface ClassResearch {
  /** Id des Projekts (wie im Alt-Code, `src/lib/research.ts`). */
  readonly id: string;
  /** Name im Spiel (Oberflächentext, Englisch, wie im Alt-Code). */
  readonly title: string;
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
 * Widebody statt Jumbo (E41). Preise × 0,7 mit E102 (Paket 5.4g; vorher 3 / 12 / 40 / 80 / 60 Mio. $). SPEZIFIKATION 6.8.
 */
export const CLASS_RESEARCH: Readonly<Record<Exclude<SizeClass, 'commuter'>, ClassResearch>> = {
  regional: { id: 'class-regional', title: 'Regional aircraft class', rank: 1, requires: null, months: 6, price1960: 2_100_000 },
  narrowbody: { id: 'class-narrowbody', title: 'Narrowbody aircraft class', rank: 2, requires: 'regional', months: 9, price1960: 8_400_000 },
  widebody: { id: 'class-widebody', title: 'Wide-body aircraft class', rank: 4, requires: 'narrowbody', months: 12, price1960: 28_000_000 },
  jumbo: { id: 'class-jumbo', title: 'Jumbo aircraft class', rank: 5, requires: 'widebody', months: 18, price1960: 56_000_000 },
  supersonic: { id: 'class-supersonic', title: 'Supersonic aircraft class', rank: 5, requires: 'widebody', months: 24, price1960: 42_000_000 },
};

// ---------------------------------------------------------------------------
// 6.9 Forschung
// ---------------------------------------------------------------------------

/**
 * Wirkungen eines Forschungs-Projekts als Felder (5.19, Tabelle in 6.9). Jedes Feld wirkt an genau einer Stelle;
 * fehlende Felder sind neutral. Die Texte der Projekte werden aus den Feldern erzeugt (E52).
 */
export interface ResearchEffect {
  /** Einsparung je Kostenart (Anteil, 0,01 = 1 %); `researchCostFactor` = max(0,4; 1 − Σ). Wirkt in 5.1. */
  readonly costSaving?: Readonly<Partial<Record<CostResearchKind, number>>>;
  /** Effizienz-Punkte auf jedes Flugzeug (Summe). Wirkt in 5.3. */
  readonly efficiencyPoints?: number;
  /** Satisfaction-Punkte in jeder Kabinenklasse (Summe, E19). Wirkt in 2.6.5. */
  readonly satisfactionPoints?: number;
  /** Faktor auf die Anziehung jedes Angebots (Produkt). Wirkt in 3.9.4 `researchDemandFactor`. */
  readonly demandFactor?: number;
  /** Faktor auf die Drehkreuz-Güte (Produkt). Wirkt in 3.13 `hubQuality`. */
  readonly hubQualityFactor?: number;
  /** Zuschlag auf den Anlauf-Start (Summe). Wirkt in 3.12 `rampFactor`. */
  readonly rampBonus?: number;
  /** Weniger technische Ausfälle (Anteil); Faktor max(0,4; 1 − Σ). Wirkt in Abschnitt 8. */
  readonly defectSaving?: number;
  /** Langsamerer Verschleiß (Anteil); Faktor max(0,4; 1 − Σ). Wirkt in Abschnitt 8. */
  readonly wearSaving?: number;
  /** Höherer Verkaufserlös (Anteil, Summe). Wirkt in Abschnitt 8. */
  readonly resaleBonus?: number;
  /** Moral-Punkte (Summe). Wirkt in 2.6.4 über das Personal (Abschnitt 8). */
  readonly moralePoints?: number;
}

/** Art eines Projekts: öffnet eine Flugzeugklasse (6.8) oder bringt eine kleine Wirkung. */
export type ResearchKind = 'class' | 'bonus';

/** Ein Forschungs-Projekt (eine Zeile der Forschungs-Tabelle). SPEZIFIKATION 6.9. */
export interface ResearchProjectDef {
  /** Id wie im Alt-Code (`src/lib/research.ts:100-164`). */
  readonly id: string;
  /** Name im Spiel (Oberflächentext, Englisch, wie im Alt-Code). */
  readonly title: string;
  readonly kind: ResearchKind;
  /** Rang, ab dem das Projekt erscheint. */
  readonly rank: number;
  /** Id des Projekts, das vorher fertig sein muss; `null` = keines. */
  readonly requires: string | null;
  /** Dauer in Monaten. */
  readonly months: number;
  /** Preis in $ von 1960, über `atCost` (E6); ungerundet (R4). */
  readonly price1960: number;
  /** Klasse, die das Projekt öffnet; `null` bei Bonus-Projekten. */
  readonly opens: SizeClass | null;
  readonly effect: ResearchEffect;
}

/** Preis eines Bonus-Projekts ohne eigenen Preis: Grundbetrag in $ von 1960 (wie im Alt-Code `src/lib/research.ts:85`). SPEZIFIKATION 6.9. */
export const RESEARCH_BONUS_PRICE_BASE_1960 = 1_200_000;

/** Preis eines Bonus-Projekts ohne eigenen Preis: Zuschlag je Rang in $ von 1960. SPEZIFIKATION 6.9. */
export const RESEARCH_BONUS_PRICE_PER_RANK_1960 = 1_300_000;

/** Dauer eines Bonus-Projekts ohne eigene Dauer: `RESEARCH_BONUS_MONTHS_BASE + aufrunden(Rang / 2)` Monate (wie im Alt-Code `src/lib/research.ts:86`). SPEZIFIKATION 6.9. */
export const RESEARCH_BONUS_MONTHS_BASE = 3;

/** Kein Ausfall- oder Verschleiß-Faktor aus Forschung sinkt unter diesen Wert (wie die Kosten-Faktoren). SPEZIFIKATION 6.9. */
export const RESEARCH_EFFECT_FLOOR = RESEARCH_COST_FLOOR;

function bonusProject(
  id: string,
  title: string,
  rank: number,
  effect: ResearchEffect,
  requires: string | null = null,
  own: { readonly price1960?: number; readonly months?: number } = {},
): ResearchProjectDef {
  return {
    id,
    title,
    kind: 'bonus',
    rank,
    requires,
    months: own.months ?? RESEARCH_BONUS_MONTHS_BASE + Math.ceil(rank / 2),
    price1960: own.price1960 ?? RESEARCH_BONUS_PRICE_BASE_1960 + RESEARCH_BONUS_PRICE_PER_RANK_1960 * rank,
    opens: null,
    effect,
  };
}

const EFF: ResearchEffect = { efficiencyPoints: EFFICIENCY_PER_RESEARCH };
const SAT: ResearchEffect = { satisfactionPoints: 1 };

/**
 * Die 40 Bonus-Projekte: Ränge, Ketten, Dauer, Preise und Werte wie im Alt-Code (`src/lib/research.ts:100-164`).
 * Neu: „Plane type satisfaction“ (sat-1 … sat-6) wirkt als Satisfaction-Punkt (E19), Effizienz in Punkten (W12),
 * „Alliance“ als Faktor auf die Drehkreuz-Güte (3.13), Preise ungerundet (R4). SPEZIFIKATION 6.9.
 */
const BONUS_PROJECTS: readonly ResearchProjectDef[] = [
  // Startup
  bonusProject('eff-1', 'Lean flight operations', 0, EFF),
  bonusProject('sat-1', 'Passenger service basics', 0, SAT),
  bonusProject('crew-1', 'Crew rostering', 0, { costSaving: { crew: 0.01 } }),
  // Local Airline
  bonusProject('maint-1', 'Maintenance routines', 1, { costSaving: { maintenance: 0.01 } }),
  bonusProject('fees-1', 'Handling agreements', 1, { costSaving: { fees: 0.01 } }),
  bonusProject('eff-2', 'Winglets and weight', 1, EFF, 'eff-1'),
  // Regional Airline
  bonusProject('slots', 'Slot negotiators', 2, { costSaving: { slots: 0.08 } }, null, { price1960: 4_000_000, months: 6 }),
  bonusProject('sat-2', 'Cabin crew training', 2, SAT, 'sat-1'),
  bonusProject('catering-1', 'Galley logistics', 2, { costSaving: { catering: 0.02 } }),
  bonusProject('yield-1', 'Revenue management system', 2, { demandFactor: 1.015 }, null, { price1960: 6_000_000, months: 9 }),
  bonusProject('academy', 'Crew academy', 2, { moralePoints: 5 }, null, { price1960: 5_000_000, months: 6 }),
  // Domestic Airline
  bonusProject('fuel-1', 'Fuel management programme', 3, { costSaving: { fuel: 0.03 } }, null, { price1960: 4_000_000, months: 6 }),
  bonusProject('maint-2', 'Condition monitoring', 3, { costSaving: { maintenance: 0.01 } }, 'maint-1'),
  bonusProject('crew-2', 'Crew pairing optimiser', 3, { costSaving: { crew: 0.01 } }, 'crew-1'),
  bonusProject('planning', 'Route planning suite', 3, { rampBonus: RAMP_RESEARCH_BONUS }, null, { price1960: 7_000_000, months: 8 }),
  // National Airline
  bonusProject('eff-3', 'Engine upgrades', 4, EFF, 'eff-2'),
  bonusProject('sat-3', 'Premium service concept', 4, SAT, 'sat-2'),
  bonusProject('wear-1', 'Protective cabin materials', 4, { wearSaving: 0.03 }),
  bonusProject('maintenance', 'Predictive maintenance', 4, { defectSaving: 0.3 }, 'maint-2', { price1960: 9_000_000, months: 9 }),
  bonusProject('resale-1', 'Fleet remarketing', 4, { resaleBonus: 0.01 }),
  // Continental Airline
  bonusProject('alliance', 'Alliance and codeshare systems', 5, { hubQualityFactor: HUB_QUALITY_RESEARCH_FACTOR }, null, { price1960: 10_000_000, months: 12 }),
  bonusProject('eff-4', 'Aerodynamic refit programme', 5, EFF, 'eff-3'),
  bonusProject('fees-2', 'Airport partnerships', 5, { costSaving: { fees: 0.01 } }, 'fees-1'),
  bonusProject('fuel-2', 'Fleet fuel optimisation', 5, { costSaving: { fuel: 0.03 } }, 'fuel-1', { price1960: 12_000_000, months: 12 }),
  // International Airline
  bonusProject('sat-4', 'Lounge and service standards', 6, SAT, 'sat-3'),
  bonusProject('cabin', 'Cabin design studio', 6, { satisfactionPoints: 2 }, null, { price1960: 8_000_000, months: 9 }),
  bonusProject('yield-2', 'Dynamic pricing engine', 6, { demandFactor: 1.025 }, 'yield-1', { price1960: 18_000_000, months: 12 }),
  bonusProject('maint-3', 'Own maintenance base', 6, { costSaving: { maintenance: 0.01 } }, 'maint-2'),
  bonusProject('catering-2', 'Central kitchen', 6, { costSaving: { catering: 0.02 } }, 'catering-1'),
  // Intercontinental Airline
  bonusProject('eff-5', 'Composite wings', 7, EFF, 'eff-4'),
  bonusProject('crew-3', 'Crew base network', 7, { costSaving: { crew: 0.01 } }, 'crew-2'),
  bonusProject('wear-2', 'Nano-coated interiors', 7, { wearSaving: 0.03 }, 'wear-1'),
  // Flag Carrier
  bonusProject('sat-5', 'Ambassador airline', 8, SAT, 'sat-4'),
  bonusProject('resale-2', 'Certified pre-owned programme', 8, { resaleBonus: 0.015 }, 'resale-1'),
  bonusProject('fees-3', 'Terminal operating rights', 8, { costSaving: { fees: 0.01 } }, 'fees-2'),
  // Global Player
  bonusProject('eff-6', 'Next-generation engines', 9, EFF, 'eff-5'),
  bonusProject('maint-4', 'Self-diagnosing fleet', 9, { costSaving: { maintenance: 0.01 } }, 'maint-3'),
  bonusProject('sat-6', "The world's favourite airline", 9, SAT, 'sat-5'),
  bonusProject('yield-3', 'Global yield network', 9, { demandFactor: 1.01 }, 'yield-2'),
  bonusProject('fuel-3', 'Sustainable fuel contracts', 9, { costSaving: { fuel: 0.01 } }, 'fuel-2'),
];

/** Die 5 Klassen-Projekte aus `CLASS_RESEARCH` (6.8), mit der Vorgänger-Klasse als Projekt-Id. */
const CLASS_PROJECTS: readonly ResearchProjectDef[] = (Object.entries(CLASS_RESEARCH) as [SizeClass, ClassResearch][]).map(
  ([sizeClass, project]) => ({
    id: project.id,
    title: project.title,
    kind: 'class',
    rank: project.rank,
    requires: project.requires === null ? null : CLASS_RESEARCH[project.requires as Exclude<SizeClass, 'commuter'>].id,
    months: project.months,
    price1960: project.price1960,
    opens: sizeClass,
    effect: {},
  }),
);

/**
 * Die Forschungs-Tabelle: 45 Projekte (5 Klassen-Projekte, 40 Bonus-Projekte), nach Rang geordnet, je Rang die
 * Klasse zuerst. Ersetzt die Einzel-Tabellen `RESEARCH_SATISFACTION_POINTS` (F23), `RESEARCH_COST_SAVINGS` und
 * `EFFICIENCY_RESEARCH_IDS` (F29). SPEZIFIKATION 6.9.
 */
export const RESEARCH_PROJECTS: readonly ResearchProjectDef[] = [...CLASS_PROJECTS, ...BONUS_PROJECTS].sort(
  (a, b) => a.rank - b.rank,
);

// ---------------------------------------------------------------------------
// 6.10 Meilensteine
// ---------------------------------------------------------------------------

/** Stufe eines Meilensteins; „feat“ = Sonderleistung. */
export type MilestoneTier = 'bronze' | 'silver' | 'gold' | 'feat';

/** Spur eines Meilensteins (Gruppe in der Anzeige, wie im Alt-Code `src/lib/milestones.ts:15`). */
export type MilestoneTrack = 'network' | 'fleet' | 'passengers' | 'reach' | 'finance' | 'standing' | 'hub' | 'feats';

/** Belohnung je Stufe: Prämie in $ von 1960 (über `atCost`) und Slot-Nachlass (E38, keine Ruf-Punkte). SPEZIFIKATION 6.10. */
export const MILESTONE_TIER_REWARD: Readonly<Record<MilestoneTier, { readonly prize1960: number; readonly slotDiscount: number }>> = {
  bronze: { prize1960: 500_000, slotDiscount: 0 },
  silver: { prize1960: 3_000_000, slotDiscount: 0.02 },
  gold: { prize1960: 15_000_000, slotDiscount: 0.03 },
  feat: { prize1960: 2_000_000, slotDiscount: 0.01 },
};

/** Höchster Slot-Nachlass aus allen Meilensteinen zusammen (Alt-Code: `src/lib/milestones.ts:137`). SPEZIFIKATION 6.10. */
export const MILESTONE_SLOT_DISCOUNT_MAX = 0.3;

/**
 * Was ein Meilenstein misst (Feld der Eingabe `MilestoneContext`). `cash` ist ein Betrag von 1960 und wird über
 * `atCost` umgerechnet (E6, W9); alle anderen sind Anzahlen, Punkte oder km.
 */
export type MilestoneMetric =
  | 'routes'
  | 'fleet'
  | 'careerPax'
  | 'regions'
  | 'longestRouteKm'
  | 'cash'
  | 'profitStreak'
  | 'reputation'
  | 'monthTransferPax'
  | 'widebodies'
  | 'supersonics'
  | 'takeovers';

/** Ein Meilenstein: erreicht, wenn der Wert `metric` ≥ `threshold`. Texte daraus (E52). SPEZIFIKATION 6.10. */
export interface MilestoneDef {
  readonly id: string;
  readonly track: MilestoneTrack;
  readonly tier: MilestoneTier;
  /** Name im Spiel (Oberflächentext, Englisch). */
  readonly title: string;
  readonly metric: MilestoneMetric;
  /** Schwelle; bei `cash` in $ von 1960. */
  readonly threshold: number;
  /** Zusätzliche Drehkreuze (Gold einzeln, „Empire builder“; wie im Alt-Code). */
  readonly extraHubs: number;
}

function milestone(
  id: string,
  track: MilestoneTrack,
  tier: MilestoneTier,
  title: string,
  metric: MilestoneMetric,
  threshold: number,
  extraHubs = 0,
): MilestoneDef {
  return { id, track, tier, title, metric, threshold, extraHubs };
}

/**
 * Die 31 Meilensteine wie im Alt-Code (`src/lib/milestones.ts:85-134`), mit den Änderungen aus 6.10: Kasse über
 * `atCost`, Ruf 60 / 70 / 80, Regionen statt Kontinente, keine Ruf-Punkte. Ids wie im Alt-Code außer Ruf und Regionen
 * (F37). SPEZIFIKATION 6.10.
 */
export const MILESTONES: readonly MilestoneDef[] = [
  // Network
  milestone('first-route', 'network', 'bronze', 'First route opened', 'routes', 1),
  milestone('routes-10', 'network', 'bronze', 'Ten routes', 'routes', 10),
  milestone('routes-50', 'network', 'silver', 'Fifty routes', 'routes', 50),
  milestone('routes-150', 'network', 'gold', '150 routes', 'routes', 150, 1),
  // Fleet
  milestone('fleet-10', 'fleet', 'bronze', 'Ten aircraft', 'fleet', 10),
  milestone('fleet-50', 'fleet', 'silver', 'Fifty aircraft', 'fleet', 50),
  milestone('fleet-200', 'fleet', 'gold', '200 aircraft', 'fleet', 200),
  // Passengers, over the whole career
  milestone('pax-1m', 'passengers', 'bronze', 'One million passengers', 'careerPax', 1_000_000),
  milestone('pax-10m', 'passengers', 'silver', 'Ten million passengers', 'careerPax', 10_000_000),
  milestone('pax-100m', 'passengers', 'gold', 'One hundred million passengers', 'careerPax', 100_000_000, 1),
  // Reach
  milestone('regions-2', 'reach', 'bronze', 'Two regions served', 'regions', 2),
  milestone('longhaul', 'reach', 'bronze', 'First intercontinental route', 'longestRouteKm', 5000),
  milestone('regions-4', 'reach', 'silver', 'Four regions served', 'regions', 4),
  milestone('ultralong', 'reach', 'silver', 'Ultra long haul', 'longestRouteKm', 10_000),
  milestone('regions-6', 'reach', 'gold', 'Every region served', 'regions', 6),
  // Finance
  milestone('capital-100m', 'finance', 'bronze', 'Money in the bank', 'cash', 100_000_000),
  milestone('profit-12', 'finance', 'bronze', 'A full year in profit', 'profitStreak', 12),
  milestone('capital-1b', 'finance', 'silver', 'The banks now call you', 'cash', 1_000_000_000),
  milestone('profit-60', 'finance', 'silver', 'Five years without a loss', 'profitStreak', 60),
  milestone('capital-10b', 'finance', 'gold', 'A war chest', 'cash', 10_000_000_000),
  milestone('profit-120', 'finance', 'gold', 'A decade without a loss', 'profitStreak', 120),
  // Standing
  milestone('reputation-bronze', 'standing', 'bronze', 'A name people know', 'reputation', 60),
  milestone('reputation-silver', 'standing', 'silver', 'A reputation worth having', 'reputation', 70),
  milestone('reputation-gold', 'standing', 'gold', 'The gold standard', 'reputation', 80),
  // Hub
  milestone('transfer-1k', 'hub', 'bronze', '1,000 connecting passengers', 'monthTransferPax', 1_000),
  milestone('transfer-10k', 'hub', 'silver', '10,000 connecting passengers', 'monthTransferPax', 10_000),
  milestone('transfer-50k', 'hub', 'gold', '50,000 connecting passengers', 'monthTransferPax', 50_000),
  // Feats
  milestone('widebody', 'feats', 'feat', 'The wide-body age', 'widebodies', 1),
  milestone('supersonic', 'feats', 'feat', 'Flying faster than sound', 'supersonics', 1),
  milestone('takeover', 'feats', 'feat', 'Consolidator', 'takeovers', 1),
  milestone('takeover-3', 'feats', 'feat', 'Empire builder', 'takeovers', 3, 1),
];

// ---------------------------------------------------------------------------
// 6.11 Jahresziel
// ---------------------------------------------------------------------------

/** Mindest-Marge der Bezugsgröße: `GOAL_MIN_MARGIN × Vorjahreserlös`. Startwert (3.9). SPEZIFIKATION 6.11. */
export const GOAL_MIN_MARGIN = 0.05;

/** Kleinste Bezugsgröße in $ von 1960 (über `atCost`; Alt-Code: 2 Mio. $ nominal, `src/lib/annualGoals.ts:58`). SPEZIFIKATION 6.11. */
export const GOAL_PROFIT_FLOOR_1960 = 2_000_000;

/** Sicheres Gewinnziel: `GOAL_STEADY_FACTOR × goalBase` (wie im Alt-Code). SPEZIFIKATION 6.11. */
export const GOAL_STEADY_FACTOR = 1.1;

/** Hohes Gewinnziel: `GOAL_STRETCH_FACTOR × goalBase` (wie im Alt-Code). SPEZIFIKATION 6.11. */
export const GOAL_STRETCH_FACTOR = 1.35;

/** Art des angebotenen Ziels: sicher, andere Art, hoch. */
export type GoalTag = 'steady' | 'focus' | 'stretch';

/** Prämie als Anteil der Bezugsgröße je Art. Startwerte (3.9). SPEZIFIKATION 6.11. */
export const GOAL_REWARD_SHARE: Readonly<Record<GoalTag, number>> = {
  steady: 0.02,
  focus: 0.03,
  stretch: 0.05,
};

/**
 * Kleinste Prämie des sicheren Ziels in $ von 1960 (über `atCost`); die anderen Arten im Verhältnis von
 * `GOAL_REWARD_SHARE` (andere Art × 1,5, hoch × 2,5; E83, `goalMinReward`). SPEZIFIKATION 6.11.
 */
export const GOAL_MIN_REWARD_1960 = 250_000;

/** Strafe bei verfehltem Ziel als Anteil der Prämie (E58). SPEZIFIKATION 6.11. */
export const GOAL_MISS_PENALTY_SHARE = 0.5;

/** Ziel „Strecken“: mindestens so viele Strecken mehr (wie im Alt-Code `src/lib/annualGoals.ts:84`). SPEZIFIKATION 6.11. */
export const GOAL_ROUTES_MIN_STEP = 3;

/** Ziel „Strecken“: Anteil mehr Strecken (aufgerundet; wie im Alt-Code). SPEZIFIKATION 6.11. */
export const GOAL_ROUTES_SHARE = 0.2;

/** Ziel „Ruf“: so viele Punkte mehr (aufgerundet; wie im Alt-Code). SPEZIFIKATION 6.11. */
export const GOAL_REPUTATION_STEP = 6;

/** Ziel „Ruf“: höchstens dieser Wert (neue Skala, E36; Alt-Code: 98). SPEZIFIKATION 6.11. */
export const GOAL_REPUTATION_MAX = 90;

/** Ziel „Fluggäste“: Vorjahr × Faktor (wie im Alt-Code). SPEZIFIKATION 6.11. */
export const GOAL_PAX_FACTOR = 1.2;

/** Ziel „Fluggäste“: kleinstes Ziel (wie im Alt-Code). SPEZIFIKATION 6.11. */
export const GOAL_PAX_MIN = 1000;

// ---------------------------------------------------------------------------
// 6.12 Karriere-Punkte
// ---------------------------------------------------------------------------

/** Punkte je Zehnerpotenz Vermögen: `150 × log10(companyValue / atCost(1 Mio. $))` (E43). SPEZIFIKATION 6.12. */
export const CAREER_WEALTH_POINTS = 150;

/** Vermögens-Einheit in $ von 1960 (über `atCost`, W9). SPEZIFIKATION 6.12. */
export const CAREER_WEALTH_UNIT_1960 = 1_000_000;

/** Punkte je Rang (nur Normal; wie im Alt-Code). SPEZIFIKATION 6.12. */
export const CAREER_RANK_POINTS = 80;

/** Punkte je Meilenstein (wie im Alt-Code). SPEZIFIKATION 6.12. */
export const CAREER_MILESTONE_POINTS = 10;

/** Punkte je Ruf-Punkt (wie im Alt-Code). SPEZIFIKATION 6.12. */
export const CAREER_REPUTATION_POINTS = 2;

/** Punkte je Übernahme (wie im Alt-Code). SPEZIFIKATION 6.12. */
export const CAREER_TAKEOVER_POINTS = 25;

/** Punkte je fertigem Bonus-Projekt (Alt-Code: 15 je Projekt, E43). SPEZIFIKATION 6.12. */
export const CAREER_RESEARCH_POINTS = 5;

/** Punkte je vollem Jahr (wie im Alt-Code). SPEZIFIKATION 6.12. */
export const CAREER_YEAR_POINTS = 5;

/** Höchstens so viele Jahre zählen (wie im Alt-Code). SPEZIFIKATION 6.12. */
export const CAREER_MAX_YEARS = 60;

/** Einträge je Ruhmeshalle (wie im Alt-Code `src/lib/careerScore.ts:83`). SPEZIFIKATION 6.12. */
export const HALL_SIZE = 10;

// ---------------------------------------------------------------------------
// 7 Konkurrenz
// ---------------------------------------------------------------------------

/** Geschäftsmodell einer KI (Typ aus den Daten `src/data/rivalAirlines.ts`, dort auch für echte Gesellschaften). */
export type { RivalPersonality };

/** Alle Persönlichkeiten, einmal. SPEZIFIKATION 7.4. */
export const PERSONALITY_IDS: readonly RivalPersonality[] = ['lcc', 'expansionist', 'optimizer', 'flag', 'boutique'];

/** KI-Stärke: wie geschickt die KI entscheidet, nie wie sie rechnet (1.8, E4). SPEZIFIKATION 7.3. */
export type RivalStrength = 'easy' | 'normal' | 'hard';

/** Alle KI-Stärken, von schwach nach stark. SPEZIFIKATION 7.3. */
export const RIVAL_STRENGTHS: readonly RivalStrength[] = ['easy', 'normal', 'hard'];

/** Werte einer KI-Stärke. Startwerte (3.9). SPEZIFIKATION 7.3. */
export interface RivalStrengthDef {
  /** Startkasse in $ von 1960 (`RIVAL_START_CASH_1960`, früher `src/lib/aiSimulation.ts`, entfernt in 5.2b). 7.7. */
  readonly startCash1960: number;
  /** Flugzeuge der Startflotte. 7.7. */
  readonly startFleet: number;
  /** So viele beste Ziele bewertet die KI (dazu `RIVAL_RANDOM_TARGETS` zufällige). 7.9. */
  readonly searchWidth: number;
  /** Schätzfehler auf den erwarteten Gewinn: ± Anteil. 7.9. */
  readonly forecastNoise: number;
  /** Kaufneigung je Monat (× Faktor der Persönlichkeit). 7.11. */
  readonly buyChance: number;
  /** Wahrscheinlichkeit einer Feinabstimmung je Monat: nie 0, „jeden 2. Monat (zufällig)“ 0,5, jeden Monat 1. 7.8. */
  readonly fineTuneChance: number;
  /** Verlierer und Eröffnungen je Monat. 7.8, 7.9. */
  readonly actionsPerMonth: number;
  /** Wahrscheinlichkeit, auch ohne erwarteten Gewinn > 0 zu eröffnen (Easy: jeder 2. Versuch). 7.9. */
  readonly openWithoutProfitChance: number;
}

/** KI-Stärken (früher `src/lib/aiSimulation.ts`, entfernt in 5.2b). Startwerte (3.9). SPEZIFIKATION 7.3. */
export const RIVAL_STRENGTH: Readonly<Record<RivalStrength, RivalStrengthDef>> = {
  easy: {
    startCash1960: 50_000_000,
    startFleet: 2,
    searchWidth: 4,
    forecastNoise: 0.4,
    buyChance: 0.12,
    fineTuneChance: 0,
    actionsPerMonth: 1,
    openWithoutProfitChance: 0.5,
  },
  normal: {
    startCash1960: 80_000_000,
    startFleet: 3,
    searchWidth: 8,
    forecastNoise: 0.1,
    buyChance: 0.45,
    fineTuneChance: 0.5,
    actionsPerMonth: 1,
    openWithoutProfitChance: 0,
  },
  hard: {
    startCash1960: 120_000_000,
    startFleet: 4,
    searchWidth: 12,
    forecastNoise: 0,
    buyChance: 0.85,
    fineTuneChance: 1,
    actionsPerMonth: 2,
    openWithoutProfitChance: 0,
  },
};

/** Zur Vorauswahl der besten Ziele kommen so viele zufällige (Alt-Code: `:503-521`). SPEZIFIKATION 7.9. */
export const RIVAL_RANDOM_TARGETS = 2;

/**
 * Kapitalkosten der KI beim Kauf: Zins je Jahr auf den Kaufpreis (E81, O76). Die Typwahl rechnet
 * `Planer-Hauptzahl − Kaufpreis × RIVAL_CAPITAL_RATE / 12`; die Abschreibung steckt schon in der Planer-Hauptzahl
 * (`aircraftShare`, 5.9). Startwert = Kreditzins `CREDIT_RATE` (8.14). SPEZIFIKATION 7.11.
 */
export const RIVAL_CAPITAL_RATE = 0.08;

/** Bauarten, für die die KI vor einem Kauf zusätzlich mit dem beliebtesten lieferbaren Typ sucht (E81, O76). SPEZIFIKATION 7.11. */
export const RIVAL_REFERENCE_CLASSES: readonly AircraftClass[] = ['Narrowbody', 'Widebody'];

/** Schalter-Art einer Persönlichkeit: Selbstbedienung, wo lieferbar, oder bedient (E18, E55). SPEZIFIKATION 7.4, 7.10. */
export type RivalDeskChoice = 'selfWhereAvailable' | 'served';

/** Platz-Anteile, Sitzabstände, Sitz-Stufe, Ausstattung und Extras der Kabine einer Persönlichkeit. SPEZIFIKATION 7.5. */
export interface RivalCabinDef {
  /** Platz-Anteil je Premium-Klasse (0 = keine Sitze dieser Klasse). Economy bekommt den Rest. */
  readonly spaceShare: Readonly<Record<Exclude<CabinClass, 'economy'>, number>>;
  /** Sitzabstand je Klasse in cm (nur Klassen mit Platz-Anteil > 0 und Economy). */
  readonly pitch: Readonly<Record<CabinClass, number>>;
  /** Stufe der Sitzliste (`SEAT_TYPE_POINTS`, 0 = Standard); nicht lieferbar → höchste lieferbare darunter. */
  readonly seatLevel: number;
  /** Ausstattung je Klasse: keine, nur IFE und Strom, oder alle (je lieferbar). */
  readonly features: 'none' | 'ifePower' | 'all';
  /** Kabinenweite Extras (je lieferbar und passend). */
  readonly extras: readonly CabinExtra[];
}

/** Service einer Klasse: ein Menü (gilt für jede Mahlzeit, R14), Extras, Bordservice; Ids aus `src/data/catering.ts`. */
export interface RivalClassService {
  readonly menu: readonly string[];
  readonly extras: readonly string[];
  readonly onboardService: readonly string[];
}

/** Werte einer Persönlichkeit: nur Entscheidungen (E45). SPEZIFIKATION 7.4, 7.5. */
export interface PersonalityDef {
  /** Angriffslust 1 … 10 (Alt-Code: `:93`). */
  readonly aggression: number;
  /** Preis-Lage `FARE_POSITION` (7.6): Faktor auf das Zielniveau, oder `best` = bester Preis (4.10, Optimizer). */
  readonly farePosition: number | 'best';
  /** Preis-Boden im Preiskampf `FARE_FLOOR` (7.6), Preisniveau. */
  readonly fareFloor: number;
  /** Zielgewicht Geschäft / Tourismus in der Vorauswahl (7.9). */
  readonly targetWeight: { readonly business: number; readonly tourism: number };
  /** Faktor der Vorauswahl für Ziele über `LONG_HAUL_KM` (LCC 0,4, sonst 1). 7.9. */
  readonly longHaulFactor: number;
  /** Grundwert der Geduld in Monaten; dazu `max(0, aggression − PATIENCE_AGGRESSION_PIVOT)`. 7.8. */
  readonly patienceBase: number;
  /** Faktor auf die Kaufneigung der KI-Stärke (7.11). */
  readonly buyFactor: number;
  /** Höchste Kaufneigung nach dem Faktor; ohne Angabe 1. */
  readonly buyChanceMax?: number;
  /** Ein Flugzeug kostet höchstens diesen Anteil der Kasse (7.11). */
  readonly purchaseCashShare: number;
  /** Reserve nach einem Kauf oder einer Eröffnung in $ von 1960 (`CASH_RESERVE_1960`, Alt-Code: `:147-149`). */
  readonly cashReserve1960: number;
  /** Höchstzahl der Drehkreuze `MAX_HUBS` (7.13). */
  readonly maxHubs: number;
  /** Wachstumsstopp ab dieser Krisenstärke (7.12). */
  readonly growthStopSeverity: number;
  /** Schalter-Art (7.10). */
  readonly deskChoice: RivalDeskChoice;
  /** Baut eine VIP-Lounge an jedem eigenen Drehkreuz (Flag, Boutique). 7.10. */
  readonly buildsLounge: boolean;
  /** Kabine (7.5). */
  readonly cabin: RivalCabinDef;
  /** Service je Klasse (7.5; früher `src/lib/aiSimulation.ts`, entfernt in 5.2b, LCC nichts). */
  readonly service: Readonly<Record<CabinClass, RivalClassService>>;
}

const NO_SERVICE: RivalClassService = { menu: [], extras: [], onboardService: [] };

/** Persönlichkeiten. Startwerte (3.9: Prüfregel „ähnlicher Erfolg“). SPEZIFIKATION 7.4, 7.5. */
export const PERSONALITIES: Readonly<Record<RivalPersonality, PersonalityDef>> = {
  lcc: {
    aggression: 8,
    // 0,90 → 0,95 (E71, Paket 3.9e): Mit 0,90 brach die LCC in den Ölkrisen ein (Faktor 0,35 nach 20 Jahren).
    farePosition: 0.95,
    fareFloor: 0.6,
    targetWeight: { business: 0.6, tourism: 1.4 },
    longHaulFactor: 0.4,
    patienceBase: 4,
    buyFactor: 1.25,
    buyChanceMax: 0.85,
    purchaseCashShare: 0.65,
    cashReserve1960: 5_000_000,
    maxHubs: 3,
    growthStopSeverity: 0.35,
    deskChoice: 'selfWhereAvailable',
    buildsLounge: false,
    cabin: {
      spaceShare: { premium: 0, business: 0, first: 0 },
      pitch: { economy: 74, premium: 0, business: 0, first: 0 },
      seatLevel: 0,
      features: 'none',
      extras: ['reduced', 'minimal'],
    },
    service: { economy: NO_SERVICE, premium: NO_SERVICE, business: NO_SERVICE, first: NO_SERVICE },
  },
  expansionist: {
    aggression: 9,
    farePosition: 0.95,
    fareFloor: 0.65,
    targetWeight: { business: 1, tourism: 1 },
    longHaulFactor: 1,
    patienceBase: 5,
    buyFactor: 1.35,
    buyChanceMax: 0.9,
    purchaseCashShare: 0.65,
    cashReserve1960: 5_000_000,
    maxHubs: 4,
    growthStopSeverity: 0.5,
    deskChoice: 'served',
    buildsLounge: false,
    cabin: {
      spaceShare: { premium: 0.09, business: 0.06, first: 0 },
      pitch: { economy: 76, premium: 88, business: 105, first: 0 },
      seatLevel: 0,
      features: 'ifePower',
      extras: ['reduced'],
    },
    service: {
      economy: NO_SERVICE,
      premium: { menu: ['b14'], extras: ['water'], onboardService: [] },
      business: { menu: ['s10'], extras: ['softdrinks', 'pillows'], onboardService: ['drinks'] },
      first: { menu: ['p5'], extras: ['alcohol', 'amenities'], onboardService: ['drinks'] },
    },
  },
  optimizer: {
    aggression: 4,
    farePosition: 'best',
    fareFloor: 0.75,
    targetWeight: { business: 1, tourism: 1 },
    longHaulFactor: 1,
    patienceBase: 3,
    // 0,7 → 0,4 (E82, Paket 5.3d): Mit den Umläufen nach der Planer-Regel war der Optimizer nach 20 Jahren 2,56 × der Median.
    // 0,4 → 0,6 (E101, Paket 5.4g): Nach E97 liegt sein bester Preis näher am Markt; mit 0,4 nach 20 Jahren 0,43 × der Median.
    buyFactor: 0.6,
    purchaseCashShare: 0.45,
    cashReserve1960: 10_000_000,
    maxHubs: 2,
    growthStopSeverity: 0.25,
    deskChoice: 'served',
    buildsLounge: false,
    cabin: {
      spaceShare: { premium: 0.14, business: 0.1, first: 0.06 },
      pitch: { economy: 78, premium: 90, business: 115, first: 160 },
      seatLevel: 1,
      features: 'ifePower',
      extras: [],
    },
    service: {
      economy: { menu: ['b5'], extras: ['water'], onboardService: [] },
      premium: { menu: ['s8'], extras: ['softdrinks', 'pillows'], onboardService: ['drinks'] },
      business: { menu: ['p6'], extras: ['alcohol', 'amenities'], onboardService: ['drinks'] },
      first: { menu: ['l12'], extras: ['premium_alcohol', 'amenities_premium'], onboardService: ['dine_demand'] },
    },
  },
  flag: {
    aggression: 6,
    farePosition: 1,
    fareFloor: 0.75,
    targetWeight: { business: 1.5, tourism: 0.5 },
    longHaulFactor: 1,
    patienceBase: 6,
    buyFactor: 1,
    purchaseCashShare: 0.45,
    cashReserve1960: 10_000_000,
    maxHubs: 3,
    growthStopSeverity: 0.25,
    deskChoice: 'served',
    buildsLounge: true,
    cabin: {
      spaceShare: { premium: 0.15, business: 0.17, first: 0.13 },
      pitch: { economy: 79, premium: 95, business: 130, first: 180 },
      seatLevel: 1,
      features: 'all',
      extras: ['wifi', 'ambient'],
    },
    service: {
      economy: { menu: ['b15'], extras: ['water', 'pillows'], onboardService: [] },
      premium: { menu: ['s13'], extras: ['softdrinks', 'headphones', 'pillows'], onboardService: ['drinks'] },
      business: { menu: ['p6', 's1'], extras: ['alcohol', 'amenities', 'headphones'], onboardService: ['drinks', 'seat_coord'] },
      first: {
        menu: ['l13', 'p15'],
        extras: ['premium_alcohol', 'amenities_luxury', 'headphones', 'pajamas'],
        onboardService: ['dine_demand', 'turndown'],
      },
    },
  },
  boutique: {
    aggression: 5,
    farePosition: 1,
    fareFloor: 0.75,
    targetWeight: { business: 1.5, tourism: 0.5 },
    longHaulFactor: 1,
    patienceBase: 6,
    // Kaufneigung 0,6 → 0,9 und Drehkreuze 1 → 2 (E71, Paket 3.9e): Boutique lag nach 40 Jahren bei 0,37 des Medians.
    buyFactor: 0.9,
    purchaseCashShare: 0.45,
    cashReserve1960: 10_000_000,
    maxHubs: 2,
    growthStopSeverity: 0.25,
    deskChoice: 'served',
    buildsLounge: true,
    cabin: {
      spaceShare: { premium: 0.22, business: 0.25, first: 0.18 },
      pitch: { economy: 81, premium: 100, business: 150, first: 200 },
      seatLevel: 2,
      features: 'all',
      extras: ['wifi', 'ambient', 'bar'],
    },
    service: {
      economy: { menu: ['b14'], extras: ['water'], onboardService: [] },
      premium: { menu: ['s9'], extras: ['softdrinks', 'pillows'], onboardService: ['drinks'] },
      business: { menu: ['p9', 'p2'], extras: ['alcohol', 'amenities_premium', 'headphones'], onboardService: ['dine_demand'] },
      first: { menu: ['l14', 'l4'], extras: ['premium_alcohol', 'amenities_luxury', 'pajamas'], onboardService: ['dine_demand', 'turndown'] },
    },
  },
};

/** Geduld: Grundwert + (Angriffslust − 6), wenn positiv (Alt-Code: `:950`). SPEZIFIKATION 7.4. */
export const PATIENCE_AGGRESSION_PIVOT = 6;

/** Ab dieser Entfernung gilt der Langstrecken-Faktor der Vorauswahl, km. SPEZIFIKATION 7.4, 7.9. */
export const LONG_HAUL_KM = 3500;

// ---------------------------------------------------------------------------
// 7.5 Kabine (Platz-Regel des Kaufdialogs, gilt für Spieler und KI)
// ---------------------------------------------------------------------------

/** Platz je Sitz der Typ-Kapazität in cm: die Kapazität gilt bei 74 cm Sitzabstand (Alt-Code: `ConfigurePurchaseView.tsx:359`). SPEZIFIKATION 7.5. */
export const CABIN_SPACE_PER_CAPACITY_SEAT_CM = 74;

/** Mehr Platz durch kabinenweite Extras, Anteil („Reduced galley“ 3 %, „Minimal services“ 6 %; Alt-Code: `:361-363`). SPEZIFIKATION 7.5. */
export const CABIN_EXTRA_SPACE_GAIN: Readonly<Partial<Record<CabinExtra, number>>> = {
  reduced: 0.03,
  minimal: 0.06,
};

/** Platzbedarf kabinenweiter Extras in cm (Alt-Code: `ConfigurePurchaseView.tsx:372`). SPEZIFIKATION 7.5. */
export const CABIN_EXTRA_SPACE_CM: Readonly<Partial<Record<CabinExtra, number>>> = {
  catering: 200,
  bar: 400,
  shower: 800,
};

/**
 * Platzfaktor je Sitztyp: Platz eines Sitzes = Sitzabstand × Faktor (Alt-Code: `SEAT_DEFS`, Feld `m`,
 * `ConfigurePurchaseView.tsx:326-353`). Unbekannter Sitztyp wie `Standard` (1). SPEZIFIKATION 7.5.
 */
export const SEAT_SPACE_FACTOR: Readonly<Record<CabinClass, Readonly<Record<string, number>>>> = {
  economy: { Standard: 1, Comfort: 1.05, Ergonomic: 1, 'Premium-Eco': 1.1 },
  premium: { Standard: 1, Recliner: 1.2, Cradle: 1.4 },
  business: { Standard: 1, Recliner: 1.1, 'Angled Flat': 1.3, 'Lie-Flat': 1.6, Suites: 2 },
  first: { Standard: 1, Recliner: 1.2, 'Flat Bed': 1.5, 'Open Suite': 1.8, 'Closed Suite': 2.2, Residence: 3 },
};

/** Ausstattung „IFE und Strom“ der Expansionist- und Optimizer-Kabine. SPEZIFIKATION 7.5. */
export const RIVAL_BASIC_FEATURES: readonly string[] = ['ife', 'power'];

// ---------------------------------------------------------------------------
// 7.6 KI-Preise
// ---------------------------------------------------------------------------

/** Auslastung, ab der die KI die Lage um `FARE_STEP` hebt. Startwert (3.9). SPEZIFIKATION 7.6. */
export const LOAD_HIGH = 0.95;

/** Auslastung, unter der die KI die Lage um `FARE_STEP` senkt. Startwert (3.9). SPEZIFIKATION 7.6. */
export const LOAD_LOW = 0.6;

/** Schritt der Lage je Monat. Startwert (3.9). SPEZIFIKATION 7.6. */
export const FARE_STEP = 0.03;

/** Lage höchstens ± so viel. Startwert (3.9). SPEZIFIKATION 7.6. */
export const YIELD_MAX = 0.15;

/** Preiskampf ab dieser Angriffslust (wie im Alt-Code `:73`). SPEZIFIKATION 7.6. */
export const PRICE_WAR_MIN_AGGRESSION = 7;

/** Preiskampf: Nachlass auf das Preisniveau, einmal (wie im Alt-Code `:72`). SPEZIFIKATION 7.6. */
export const PRICE_WAR_CUT = 0.12;

/** Preiskampf: eine andere Gesellschaft hat in so vielen letzten Monaten eröffnet (E59). SPEZIFIKATION 7.6. */
export const PRICE_WAR_WINDOW = 6;

/** Preiskampf: so viele Monate höchstens. SPEZIFIKATION 7.6. */
export const PRICE_WAR_MAX_MONTHS = 12;

/** Nach einem Preiskampf so viele Monate keiner auf demselben Paar. SPEZIFIKATION 7.6. */
export const PRICE_WAR_COOLDOWN = 12;

/** Preiskampf erst ab diesem Alter der eigenen Strecke, Monate. SPEZIFIKATION 7.6. */
export const PRICE_WAR_MIN_ROUTE_AGE = 2;

// ---------------------------------------------------------------------------
// 7.7 Gründung und Startwerte
// ---------------------------------------------------------------------------

/** Zufälliger Teil der Startkasse: ± so viel in $ von 1960 (wie im Alt-Code `:708`). SPEZIFIKATION 7.7. */
export const RIVAL_START_CASH_NOISE_1960 = 3_000_000;

/** Startausstattung am Drehkreuz, gleich für Spieler und KI (Alt-Code: `src/App.tsx:1645-1652`). SPEZIFIKATION 7.7. */
export const START_HUB_SETUP = {
  managementTier: 2,
  slots: 0,
  desks: { normal: 1, self: 0 },
} as const;

/** Erfundene KI: Drehkreuz an Flughäfen ab dieser Größe; gibt es keinen freien, ab `RIVAL_HUB_FALLBACK_LEVEL`. SPEZIFIKATION 7.7. */
export const RIVAL_HUB_MIN_LEVEL = 4;

/** Siehe `RIVAL_HUB_MIN_LEVEL`. SPEZIFIKATION 7.7. */
export const RIVAL_HUB_FALLBACK_LEVEL = 2;

/** Bei einer KI: Wahrscheinlichkeit, dass sie erfunden ist (wie im Alt-Code `:629`). SPEZIFIKATION 7.7. */
export const FICTIONAL_SINGLE_CHANCE = 0.4;

/** Bei mehreren KI: Anteil erfundener = Grundwert + Spanne × Zufall, mindestens eine (wie im Alt-Code `:630`). SPEZIFIKATION 7.7. */
export const FICTIONAL_SHARE_BASE = 0.3;

/** Siehe `FICTIONAL_SHARE_BASE`. SPEZIFIKATION 7.7. */
export const FICTIONAL_SHARE_SPREAD = 0.2;

/** Je Monat Wahrscheinlichkeit, dass eine fehlende KI nachrückt. SPEZIFIKATION 7.7. */
export const RIVAL_REFILL_CHANCE = 0.15;

/**
 * Wahl der Startflugzeuge (früher `src/lib/aiSimulation.ts`, entfernt in 5.2b):
 * `Beliebtheit − 0,2 × Monate seit Lieferbeginn + Gewichte der Persönlichkeit + (Zufall − 0,5) × 15`. SPEZIFIKATION 7.7.
 */
export const START_AIRCRAFT_AGE_PENALTY = 0.2;

/** Siehe `START_AIRCRAFT_AGE_PENALTY`: Spanne des Zufalls (± die Hälfte). SPEZIFIKATION 7.7. */
export const START_AIRCRAFT_NOISE = 15;

/**
 * Gewichte der Persönlichkeit bei der Wahl der Startflugzeuge (wie im Alt-Code `:664-668`; E71, Paket 3.9e: LCC `capacity`
 * 0,15 → 0,05, Boutique `range` 0,02 → 0,001, sonst nahmen beide 1960 eine DC-8 ohne Strecke mit Gewinn). SPEZIFIKATION 7.7.
 */
export const START_AIRCRAFT_WEIGHTS: Readonly<
  Record<RivalPersonality, { readonly capacity: number; readonly efficiency: number; readonly popularity: number; readonly range: number }>
> = {
  lcc: { capacity: 0.05, efficiency: 0.6, popularity: 0, range: 0 },
  expansionist: { capacity: 0, efficiency: 0, popularity: 0, range: 0 },
  optimizer: { capacity: 0, efficiency: 1.2, popularity: 0, range: 0 },
  flag: { capacity: 0, efficiency: 0, popularity: 1.5, range: 0 },
  boutique: { capacity: 0, efficiency: 0, popularity: 0, range: 0.001 },
};

// ---------------------------------------------------------------------------
// 7.8 Monat der KI
// ---------------------------------------------------------------------------

/** Reihenfolge der KI-Entscheidungen nach der Buchung; alle wirken ab dem nächsten Monat. SPEZIFIKATION 7.8. */
export const RIVAL_DECISION_STEPS = [
  'prices',
  'crisis',
  'losers',
  'fineTune',
  'fleet',
  'openings',
  'growth',
  'dividend',
  'distress',
] as const;

/**
 * Fahrplan der KI (F43): erster Abflug am Drehkreuz je Tag, Minuten nach Mitternacht (06:00). Weitere Umläufe des Tages
 * folgen im Abstand eines Umlaufs. SPEZIFIKATION 7.9 (Fahrpläne für Umsteiger 3.13).
 */
export const RIVAL_FIRST_DEPARTURE_MINUTE = 6 * 60;

/** Fahrplan der KI (F43): Bodenzeit am Ziel und am Drehkreuz zwischen Ankunft und nächstem Abflug, Minuten. */
export const RIVAL_TURN_MINUTES = 45;

/** Ein Schritt aus `RIVAL_DECISION_STEPS`. */
export type RivalDecisionStep = (typeof RIVAL_DECISION_STEPS)[number];

/** Geglätteter Gewinn: Anteil des alten Werts (früher `src/lib/aiSimulation.ts`, entfernt in 5.2b); der Rest ist der neue Monat. SPEZIFIKATION 7.8. */
export const AVG_PROFIT_KEEP = 0.65;

/** Verlierer: erst auf diesen Anteil der Flüge (wie im Alt-Code `:957`). SPEZIFIKATION 7.8. */
export const THIN_SHARE = 0.4;

/** So viele Strecken behält eine KI mindestens (wie im Alt-Code `:133`). SPEZIFIKATION 7.8. */
export const CORE_NETWORK = 2;

/** Feinabstimmung: Schritt = max(1, Anteil × Flüge) (wie im Alt-Code `:991`). SPEZIFIKATION 7.8. */
export const FINE_TUNE_STEP_SHARE = 0.25;

/** Feinabstimmung: behalten, wenn die Planer-Hauptzahl um mehr als diesen Anteil steigt (wie im Alt-Code `:996`). SPEZIFIKATION 7.8. */
export const FINE_TUNE_MIN_GAIN = 0.02;

/** Feinabstimmung erst ab diesem Alter der Strecke, Monate (wie im Alt-Code `:986`). SPEZIFIKATION 7.8. */
export const FINE_TUNE_MIN_ROUTE_AGE = 2;

// ---------------------------------------------------------------------------
// 7.9 Planung einer Strecke
// ---------------------------------------------------------------------------

/** Kürzeste KI-Strecke in km (wie im Alt-Code). SPEZIFIKATION 7.9. */
export const MIN_ROUTE_KM = 150;

/** Vorauswahl: Strecken unter diesem Anteil der Reichweite zählen anteilig (`min(1, km / (0,2 × Reichweite))`). SPEZIFIKATION 7.9. */
export const PRESELECT_RANGE_SHARE = 0.2;

/** Vorauswahl: Abflüge anderer Gesellschaften auf dem Paar teilen durch `1 + Abflüge / 14`. SPEZIFIKATION 7.9. */
export const PRESELECT_CROWDING_DEPARTURES = 14;

/**
 * Vorauswahl: Ziele, die Drehkreuz einer anderen KI sind, zählen × 2 statt durch deren Abflüge geteilt (E66), damit
 * Drehkreuz-zu-Drehkreuz-Strecken unter der KI umkämpft werden. SPEZIFIKATION 7.9.
 */
export const PRESELECT_RIVAL_HUB_WEIGHT = 2;

/** Bewertete Flugzahlen je Ziel als Anteil der höchsten Umläufe. SPEZIFIKATION 7.9. */
export const PLAN_FREQUENCY_SHARES: readonly number[] = [1, 0.6, 0.3];


// ---------------------------------------------------------------------------
// 7.10 Slots, Schalter, Drehkreuze und Einrichtungen der KI
// ---------------------------------------------------------------------------

/** Anteil der Slot-Grenze, den eine KI an ihrem eigenen Drehkreuz höchstens hält. Startwert (3.9). SPEZIFIKATION 7.10. */
export const RIVAL_SLOT_SHARE_HUB = 0.25;

/** Anteil der Slot-Grenze, den eine KI an anderen Flughäfen höchstens hält. Startwert (3.9). SPEZIFIKATION 7.10. */
export const RIVAL_SLOT_SHARE_OTHER = 0.1;

/** Slots, die so viele Monate in Folge frei sind, verkauft die KI. SPEZIFIKATION 7.10. */
export const RIVAL_SLOT_IDLE_MONTHS = 6;

/** Verwaltungsstufe der KI an jedem eigenen Drehkreuz; sonst keine, nie Stufe 3 (E63). SPEZIFIKATION 7.10. */
export const RIVAL_HUB_TIER = 2;

/** VIP-Lounge erst, wenn die Kasse ihren Preis so oft deckt. SPEZIFIKATION 7.10. */
export const LOUNGE_CASH_COVER = 3;

// ---------------------------------------------------------------------------
// 7.11 Flotte der KI
// ---------------------------------------------------------------------------

/** Ohne Gewinn in den letzten Monaten kauft die KI nur, wenn Preis ≤ Kasse × dieser Anteil. SPEZIFIKATION 7.11. */
export const NO_PROFIT_PRICE_CASH_SHARE = 1 / 3;

/** „Gewinn in den letzten Monaten“: so viele Monate. SPEZIFIKATION 7.11. */
export const PROFIT_LOOKBACK_MONTHS = 3;

/** Modernisierung: Flugzeuge älter als so viele Jahre (wie im Alt-Code `:1012`). SPEZIFIKATION 7.11. */
export const MODERNIZE_AGE_YEARS = 20;

/** Modernisierung: so viele Monate nach dem Lieferende des Typs (12 Jahre, wie im Alt-Code `:1011`). SPEZIFIKATION 7.11. */
export const MODERNIZE_AFTER_END_MONTHS = 144;

/** Grundüberholung, wenn Zellen- oder Kabinenzustand darunter fällt, %. SPEZIFIKATION 7.11. */
export const RIVAL_OVERHAUL_BELOW = 60;

/** Leerlauf-Verkauf nach so vielen Monaten ohne Strecke. SPEZIFIKATION 7.11. */
export const MAX_IDLE_MONTHS = 6;

/** Leerlauf-Verkauf während einer Krise (7.12) nach so vielen Monaten (R14). SPEZIFIKATION 7.11. */
export const CRISIS_IDLE_MONTHS = 12;

// ---------------------------------------------------------------------------
// 7.12 Krise
// ---------------------------------------------------------------------------

/** Krise ab dieser Stärke (wie im Alt-Code `src/lib/rivalCrisis.ts:31`). SPEZIFIKATION 7.12. */
export const CRISIS_FROM = 0.25;

/** Treibstoff-Teil der Krise: Mittel der Tabelle über so viele Monate vor dem Monat. SPEZIFIKATION 7.12. */
export const CRISIS_FUEL_WINDOW = 24;

/** Treibstoff-Teil der Krise: Anstieg gegen das Mittel × diesen Faktor („/ 2“). SPEZIFIKATION 7.12. */
export const CRISIS_FUEL_WEIGHT = 0.5;

/** Krisen-Fahrplan: Ziel-Auslastung beim Kürzen (wie im Alt-Code `src/lib/rivalCrisis.ts:54`). SPEZIFIKATION 7.12. */
export const CRISIS_TARGET_LOAD = 0.8;

/** Krisen-Fahrplan: ab dieser Auslastung kommen Flüge zurück (wie im Alt-Code `:57`). SPEZIFIKATION 7.12. */
export const CRISIS_FULL_LOAD = 0.95;

/** Krisen-Fahrplan: so viel des alten Plans kommt je Monat zurück (aufgerundet, mindestens 1; wie im Alt-Code `:60`). SPEZIFIKATION 7.12. */
export const CRISIS_RECOVERY_STEP = 0.25;

// ---------------------------------------------------------------------------
// 7.13 Wachstum, Größe und Dividende
// ---------------------------------------------------------------------------

/** Neues Drehkreuz erst ab `rivalSize ≥ NEW_HUB_MIN_SEATS × Zahl der Drehkreuze` (Sitze je Woche). Startwert (3.9). SPEZIFIKATION 7.13. */
export const NEW_HUB_MIN_SEATS = 20_000;

/** Neues Drehkreuz: Wahrscheinlichkeit je Monat, wenn alle Bedingungen gelten. SPEZIFIKATION 7.13. */
export const NEW_HUB_CHANCE = 0.04;

/** Neues Drehkreuz: nur an Flughäfen ab dieser Größe (R14). SPEZIFIKATION 7.13. */
export const NEW_HUB_MIN_LEVEL = 5;

/** Neues Drehkreuz: eigene Drehkreuze gelten als voll ab diesem Anteil des eigenen Slot-Anteils. SPEZIFIKATION 7.13. */
export const NEW_HUB_SLOT_USE = 0.9;

/** Neues Drehkreuz: … oder seit so vielen Monaten dort keine Strecke mit Gewinn gefunden. SPEZIFIKATION 7.13. */
export const NEW_HUB_NO_PROFIT_MONTHS = 3;

/** Gewicht der Heimatregion bei der Wahl eines neuen Drehkreuzes. Startwert (3.9). SPEZIFIKATION 7.13. */
export const HOME_REGION_WEIGHT = 4;

/** Gewicht eines Spieler-Drehkreuzes: `3 × Angriffslust / 6` (wie im Alt-Code). SPEZIFIKATION 7.13. */
export const PLAYER_HUB_WEIGHT = 3;

/** Siehe `PLAYER_HUB_WEIGHT`: Angriffslust, bei der das Gewicht genau `PLAYER_HUB_WEIGHT` ist. SPEZIFIKATION 7.13. */
export const PLAYER_HUB_AGGRESSION_PIVOT = 6;

/** Dividenden-Grenze mindestens so viel in $ von 1960. Startwert (3.9). SPEZIFIKATION 7.13. */
export const DIVIDEND_FLOOR_1960 = 50_000_000;

/** Dividenden-Grenze: so viele mittlere Monatskosten der letzten 12 Monate. Startwert (3.9). SPEZIFIKATION 7.13. */
export const DIVIDEND_RESERVE_MONTHS = 12;

/** Mittel der Monatskosten über so viele Monate. SPEZIFIKATION 7.13. */
export const DIVIDEND_COST_WINDOW = 12;

// ---------------------------------------------------------------------------
// 7.14 Zuschuss (E47, abgeschafft in Paket 3.9e nach E68)
// ---------------------------------------------------------------------------

/**
 * Zuschuss aus (E68, Paket 3.9e): Das Balance-Skript erfüllt die Prüfregel aus 7.14 (ohne Zuschuss keine Auflösung
 * eines Gründers in 10 Läufen über 60 Jahre, „ähnlicher Erfolg“ Faktor 1,81 / 1,70). Die Zeile „Subsidy“ bleibt
 * (immer 0). SPEZIFIKATION 7.14.
 */
export const RIVAL_SUBSIDY_ENABLED = false;

/** Zuschuss je Monat in $ von 1960 bis `SUBSIDY_HIGH_UNTIL` (wie im Alt-Code nominal, `:47-65`). SPEZIFIKATION 7.14. */
export const SUBSIDY_HIGH_1960 = 450_000;

/** Zuschuss je Monat in $ von 1960 ab `SUBSIDY_LOW_FROM`. SPEZIFIKATION 7.14. */
export const SUBSIDY_LOW_1960 = 150_000;

/** Bis zu diesem Jahr der hohe Zuschuss; danach gerade fallend bis `SUBSIDY_LOW_FROM`. SPEZIFIKATION 7.14. */
export const SUBSIDY_HIGH_UNTIL = 1985;

/** Ab diesem Jahr der niedrige Zuschuss. SPEZIFIKATION 7.14. */
export const SUBSIDY_LOW_FROM = 2005;

// ---------------------------------------------------------------------------
// 7.15 Notlage, Verkauf, Auflösung
// ---------------------------------------------------------------------------

/** Zum Verkauf nach so vielen Monaten in Folge mit Kasse < 0. SPEZIFIKATION 7.15. */
export const DISTRESS_TO_SALE_MONTHS = 6;

/** Auflösung nach so vielen Monaten zum Verkauf. SPEZIFIKATION 7.15. */
export const SALE_TO_LIQUIDATION_MONTHS = 12;

// ---------------------------------------------------------------------------
// 7.16 Übernahme (E48)
// ---------------------------------------------------------------------------

/** Mindestpreis einer Übernahme in $ von 1960 (Alt-Code: nominal). SPEZIFIKATION 7.16. */
export const TAKEOVER_MIN_PRICE_1960 = 1_000_000;

/** Verwaltungsstufe, die der Spieler an jedem Flughafen mit übernommenen Slots mindestens bekommt. SPEZIFIKATION 7.16. */
export const TAKEOVER_MIN_TIER = 1;

// ===========================================================================
// Abschnitt 8 – Monatsabschluss, Ereignisse, Flottenmarkt (Paket 3.8a)
// ===========================================================================

// ---------------------------------------------------------------------------
// 8.4 Weltereignisse
// ---------------------------------------------------------------------------

/** Art der Krisen-Antwort eines geschichtlichen Ereignisses (8.5). */
export type CrisisResponseKind = 'fuelHedge' | 'demandRecovery';

/** Ein geschichtliches Weltereignis (Daten, nach Datum gelesen, nicht gespeichert). SPEZIFIKATION 8.4. */
export interface HistoricalEventDef {
  /** Name im Spiel (Oberflächentext, Englisch, wie im Alt-Code). */
  readonly title: string;
  /** Meldungstext (Englisch, wie im Alt-Code). */
  readonly description: string;
  /** Erster Spielmonat (0 = Januar 1960). */
  readonly startMonth: number;
  /** Dauer in Monaten. */
  readonly months: number;
  /** Faktor auf die Reiselust (3.5). */
  readonly demandMultiplier: number;
  /** Betroffene Regionen; fehlt = weltweit. */
  readonly regions?: readonly WorldRegion[];
  /** Krisen-Antwort, die der Spieler beim Beginn kaufen kann (8.5); nur die 6 weltweiten. */
  readonly response?: {
    readonly kind: CrisisResponseKind;
    /** Rückgewinnungs-Anteil `r` (nur `demandRecovery`; Alt-Code: `softensDemand`). */
    readonly recoveryShare?: number;
  };
}

const ev = (year: number, monthOfYear: number) => (year - START_YEAR) * 12 + monthOfYear;

/**
 * Die 17 geschichtlichen Ereignisse (6 weltweite mit Krisen-Antwort, 11 regionale), wie im Alt-Code
 * `src/lib/eventSystem.ts:68-307`. Das Feld `fuelMultiplier` entfällt; die Ölkrisen stehen in `FUEL_CRISES` (E61).
 * Feste Preise der Antworten entfallen (E6, E35). SPEZIFIKATION 8.4, 8.5.
 */
export const HISTORICAL_EVENTS: readonly HistoricalEventDef[] = [
  { title: '1973 Oil Crisis', description: 'An oil embargo has caused massive fuel shortages and skyrocketing prices.', startMonth: ev(1973, 9), months: 18, demandMultiplier: 0.9, response: { kind: 'fuelHedge' } },
  { title: '1979 Energy Crisis', description: 'A drop in oil production has triggered a severe energy crisis.', startMonth: ev(1979, 1), months: 24, demandMultiplier: 0.85, response: { kind: 'fuelHedge' } },
  { title: 'Gulf War Oil Shock', description: 'Geopolitical tensions have caused a short-term spike in oil prices.', startMonth: ev(1990, 7), months: 12, demandMultiplier: 0.95, response: { kind: 'fuelHedge' } },
  { title: 'Aviation Downturn', description: 'Global passenger demand has plummeted dramatically.', startMonth: ev(2001, 8), months: 12, demandMultiplier: 0.65, response: { kind: 'demandRecovery', recoveryShare: 0.4 } },
  { title: 'Global Financial Crisis', description: 'A severe worldwide economic crisis resulting in depressed passenger demand and volatile fuel prices.', startMonth: ev(2008, 8), months: 24, demandMultiplier: 0.75, response: { kind: 'demandRecovery', recoveryShare: 0.33 } },
  { title: 'Global Pandemic', description: 'International borders close and aviation demand nearly vanishes.', startMonth: ev(2020, 2), months: 24, demandMultiplier: 0.2, response: { kind: 'demandRecovery', recoveryShare: 0.35 } },
  { title: 'French General Strike', description: 'Strikes and unrest paralyse France; airports close and bookings across Western Europe collapse for weeks.', startMonth: ev(1968, 4), months: 2, demandMultiplier: 0.85, regions: ['EU'] },
  { title: "Air Traffic Controllers' Strike", description: 'American air traffic controllers walk out and the government grounds the strikers: flights across North America are cut for months.', startMonth: ev(1981, 7), months: 5, demandMultiplier: 0.8, regions: ['NA'] },
  { title: 'Barcelona Olympics', description: 'The Games fill Spanish hotels and the flights into Europe.', startMonth: ev(1992, 6), months: 2, demandMultiplier: 1.08, regions: ['EU'] },
  { title: 'Pacific Rim Boom', description: 'The Asian tigers grow at ten percent a year; business travel and tourism in Asia and Oceania take off.', startMonth: ev(1993, 0), months: 36, demandMultiplier: 1.12, regions: ['AS', 'OC'] },
  { title: 'Asian Financial Crisis', description: 'Currencies collapse from Thailand to Korea; travel in Asia and Oceania falls sharply.', startMonth: ev(1997, 6), months: 18, demandMultiplier: 0.78, regions: ['AS', 'OC'] },
  { title: 'Sydney Olympics', description: 'The Games bring the world to Australia for a fortnight, and a month of bookings with it.', startMonth: ev(2000, 8), months: 2, demandMultiplier: 1.15, regions: ['OC'] },
  { title: 'SARS Outbreak', description: 'A new respiratory disease spreads from Hong Kong; travellers stay away from Asia.', startMonth: ev(2003, 2), months: 5, demandMultiplier: 0.6, regions: ['AS'] },
  { title: 'Beijing Olympics', description: 'China shows itself to the world and crowds into its airports.', startMonth: ev(2008, 7), months: 2, demandMultiplier: 1.12, regions: ['AS'] },
  { title: 'Eyjafjallajökull Ash Cloud', description: 'An Icelandic volcano closes European airspace for days; the backlog lingers for weeks.', startMonth: ev(2010, 3), months: 2, demandMultiplier: 0.6, regions: ['EU'] },
  { title: 'Tohoku Earthquake', description: 'Earthquake, tsunami and nuclear accident in Japan: visitors cancel and flights across Asia thin out.', startMonth: ev(2011, 2), months: 3, demandMultiplier: 0.85, regions: ['AS'] },
  { title: 'Brazil World Cup', description: 'Fans from every continent fly to South America for the tournament.', startMonth: ev(2014, 5), months: 2, demandMultiplier: 1.15, regions: ['SA'] },
];

/** Vorlage eines Zufallsereignisses. SPEZIFIKATION 8.4. */
export interface RandomEventTemplate {
  readonly title: string;
  readonly description: string;
  /** Nachfrage-Faktor gleich verteilt in `demandMin … demandMax`. */
  readonly demandMin: number;
  readonly demandMax: number;
  /** Dauer gleich verteilt in ganzen Monaten `durationMin … durationMax`. */
  readonly durationMin: number;
  readonly durationMax: number;
  /** Regional: trifft eine von 6 Regionen; sonst weltweit. */
  readonly regional: boolean;
}

/**
 * Die 8 Vorlagen der Zufallsereignisse (Alt-Code: 11, `src/lib/monthClose.ts:206-287`): 4 Pech, 4 Glück. Es entfallen
 * die drei Treibstoff-Vorlagen (E61); das Feld `fuelMin/fuelMax` entfällt (E8). SPEZIFIKATION 8.4.
 */
export const RANDOM_EVENT_TEMPLATES: readonly RandomEventTemplate[] = [
  { title: 'Volcanic Ash Disruption', description: 'An unexpected volcanic eruption has filled key coordinates with ash clouds, forcing flight path redirections and minor booking dips.', demandMin: 0.88, demandMax: 0.92, durationMin: 2, durationMax: 4, regional: false },
  { title: 'Summer Vacation Surge', description: 'An intense, prolonged heatwave trigger-starts an unprecedented summer flight rush! All routes see major bookings.', demandMin: 1.1, demandMax: 1.15, durationMin: 2, durationMax: 3, regional: false },
  { title: 'Global Commerce Summit', description: 'Massive international tech and economic summits catalyze a heavy surge in first/business class travelers.', demandMin: 1.05, demandMax: 1.09, durationMin: 1, durationMax: 2, regional: false },
  { title: 'Economic Slump', description: 'A minor global economic contraction impacts customer confidence. Forward bookings are moderately slowed down.', demandMin: 0.85, demandMax: 0.9, durationMin: 3, durationMax: 6, regional: false },
  { title: 'Wanderlust Marketing Campaign', description: 'Highly successful global advertising campaigns promote exploration and long-distance holidays.', demandMin: 1.1, demandMax: 1.15, durationMin: 3, durationMax: 4, regional: false },
  { title: 'Regional Airspace Closure', description: 'A conflict and the airspace restrictions that follow cut the routes into and out of one part of the world.', demandMin: 0.7, demandMax: 0.82, durationMin: 2, durationMax: 4, regional: true },
  { title: 'Regional Tourism Boom', description: 'A destination goes viral and a whole region fills with visitors.', demandMin: 1.12, demandMax: 1.2, durationMin: 3, durationMax: 6, regional: true },
  { title: 'Regional Aviation Strike Wave', description: 'Airport and airline staff across one region take turns to strike; bookings go elsewhere.', demandMin: 0.82, demandMax: 0.9, durationMin: 2, durationMax: 3, regional: true },
];

/** Wahrscheinlichkeit eines Zufallsereignisses je Monat (Alt-Code: 0,05, `src/lib/monthClose.ts:916`). SPEZIFIKATION 8.4. */
export const RANDOM_EVENT_CHANCE = 0.05;

// ---------------------------------------------------------------------------
// 8.5 Krisen-Antworten
// ---------------------------------------------------------------------------

/**
 * Preis-Absicherung: Anteil der Treibstoff-Rechnung des letzten Monats je Monat Dauer (E69: 0,2 → 0,35, lohnt sich
 * 1973 / 1979 / 1990 etwa 2,6- / 1,4- / 1,05-fach). SPEZIFIKATION 8.5.
 */
export const HEDGE_PRICE_SHARE = 0.35;

/**
 * Rückgewinnung: Preis = Anteil × r × (1 − f) × Dauer × Monatserlös des letzten Monats (E69, Paket 3.9d: 0,15 → 0,25,
 * lohnt sich mit der Marktgröße aus E70 etwa 1,2- bis 2,4-fach). SPEZIFIKATION 8.5.
 */
export const RECOVERY_PRICE_SHARE = 0.25;

// ---------------------------------------------------------------------------
// 8.6 Betriebsstörungen und Vogelschläge
// ---------------------------------------------------------------------------

/** Art einer Störung. SPEZIFIKATION 8.6. */
export type DisruptionKind = 'defect' | 'airportStrike' | 'weather';

/** Reihenfolge der Würfe im Übergang (für den Pech-Deckel, 8.8; F40). */
export const DISRUPTION_KINDS: readonly DisruptionKind[] = ['defect', 'airportStrike', 'weather'];

/** Defekt-Chance je Flugzeug und Monat, Grundwert (wie im Alt-Code 0,01 / 3, `src/lib/disruptions.ts:64`). SPEZIFIKATION 8.6. */
export const DEFECT_BASE = 0.01 / 3;

/** … dazu je Punkt Zelle unter 100 (wie im Alt-Code 0,0008 / 3). SPEZIFIKATION 8.6. */
export const DEFECT_PER_AIRFRAME_POINT = 0.0008 / 3;

/** … dazu je Jahr Alter seit dem Baumonat (wie im Alt-Code 0,001 / 3, R13). SPEZIFIKATION 8.6. */
export const DEFECT_PER_YEAR = 0.001 / 3;

/** Eigener Hangar an einem Flughafen seiner Strecken: Defekt-Chance × 0,5. SPEZIFIKATION 8.6. */
export const HANGAR_DEFECT_FACTOR = 0.5;

/** Ein Defekt streicht diesen Anteil aller Flüge des Flugzeugs. SPEZIFIKATION 8.6. */
export const DEFECT_CANCEL_SHARE = 0.5;

/** Flughafen-Streik je Flughafen mit Abflügen und Monat (wie im Alt-Code 0,01 / 3). SPEZIFIKATION 8.6. */
export const AIRPORT_STRIKE_CHANCE = 0.01 / 3;

/** Ein Flughafen-Streik streicht diesen Anteil aller Abflüge und Ankünfte dort, für alle Gesellschaften. SPEZIFIKATION 8.6. */
export const AIRPORT_STRIKE_CANCEL_SHARE = 0.6;

/** Winterwetter je Region und Wintermonat. SPEZIFIKATION 8.6. */
export const WINTER_CHANCE = 0.03;

/** Winterwetter streicht diesen Anteil aller Flüge mit einem Ende in der Region. SPEZIFIKATION 8.6. */
export const WINTER_CANCEL_SHARE = 0.15;

/** Regionen mit Winterwetter (wie im Alt-Code). SPEZIFIKATION 8.6. */
export const WINTER_REGIONS: readonly WorldRegion[] = ['EU', 'NA', 'AS'];

/** Wintermonate als Monat im Jahr (0 = Januar): Dezember, Januar, Februar. SPEZIFIKATION 8.6. */
export const WINTER_MONTHS: readonly number[] = [11, 0, 1];

/** Vogelschlag je fliegendes Flugzeug und Monat (Alt-Code: je Strecke). SPEZIFIKATION 8.6. */
export const BIRD_STRIKE_CHANCE = 0.002;

/** Vogelschlag kostet diesen Anteil des Neupreises (5.12; Alt-Code: 100 000 / 200 000 / 400 000 $ fest). Startwert. SPEZIFIKATION 8.6. */
export const BIRD_STRIKE_COST_SHARE = 0.005;

/** Ab diesem gestrichenen Anteil (und mit Erlösverlust) fragt das Spiel: Charter oder streichen. SPEZIFIKATION 8.6. */
export const MAJOR_DISRUPTION_SHARE = 0.25;

/** Höchstens so viele Störungs-Fragen je Monat, größter Verlust zuerst. SPEZIFIKATION 8.6. */
export const MAX_DISRUPTION_QUESTIONS = 3;

// ---------------------------------------------------------------------------
// 8.7 Personal: Moral und Streik (nur Spieler)
// ---------------------------------------------------------------------------

/** Lohn in Prozent des Marktlohns: untere Grenze (wie im Alt-Code `src/lib/staff.ts:31`). SPEZIFIKATION 8.7, 5.1. */
export const SALARY_PCT_MIN = 80;

/** Lohn: obere Grenze. SPEZIFIKATION 8.7, 5.1. */
export const SALARY_PCT_MAX = 130;

/** Lohn: Marktlohn. SPEZIFIKATION 8.7. */
export const SALARY_PCT_MARKET = 100;

/** Moral beim Marktlohn ohne alles andere. SPEZIFIKATION 8.7. */
export const BASE_MORALE = 50;

/** Moral-Punkte je Lohn-Punkt über oder unter Marktlohn + Arbeitsmarkt-Zuschlag. SPEZIFIKATION 8.7. */
export const MORALE_PER_PAY_POINT = 1.5;

/** Gewinnserie länger als so viele Monate hebt die Moral … SPEZIFIKATION 8.7. */
export const PROFIT_STREAK_MONTHS = 6;

/** … um so viele Punkte. SPEZIFIKATION 8.7. */
export const PROFIT_STREAK_MORALE = 5;

/** Ein Streik drückt die Moral so viele Monate nach seinem Monat … SPEZIFIKATION 8.7. */
export const STRIKE_MEMORY_MONTHS = 6;

/** … um so viele Punkte. SPEZIFIKATION 8.7. */
export const STRIKE_MORALE_PENALTY = 10;

/** Anteil des Abstands zum Moral-Ziel, der je Monat geschlossen wird. SPEZIFIKATION 8.7. */
export const MORALE_STEP = 0.2;

/**
 * Arbeitsmarkt: Lohn-Punkte über dem Marktlohn, die das Personal in diesen Jahren erwartet (Daten wie im Alt-Code,
 * `src/lib/staff.ts:110-123`). Jahre außerhalb: 0. SPEZIFIKATION 8.7.
 */
export const LABOUR_MARKET: readonly { readonly from: number; readonly to: number; readonly points: number }[] = [
  { from: 1964, to: 1970, points: 6 },
  { from: 1973, to: 1975, points: -6 },
  { from: 1980, to: 1983, points: -4 },
  { from: 1987, to: 1990, points: 5 },
  { from: 1991, to: 1993, points: -5 },
  { from: 1996, to: 2000, points: 8 },
  { from: 2001, to: 2004, points: -6 },
  { from: 2005, to: 2008, points: 6 },
  { from: 2009, to: 2011, points: -5 },
  { from: 2014, to: 2019, points: 9 },
  { from: 2020, to: 2021, points: -8 },
  { from: 2022, to: 2200, points: 10 },
];

/** Unter dieser Moral kann das Personal streiken. SPEZIFIKATION 8.7. */
export const STRIKE_MORALE_THRESHOLD = 35;

/** Streik-Chance je Monat und Moral-Punkt unter der Schwelle. SPEZIFIKATION 8.7. */
export const STRIKE_CHANCE_PER_POINT = 0.006;

/** Antwort „Raise pay“: Lohn + so viele Punkte. SPEZIFIKATION 8.7. */
export const STRIKE_PAY_RAISE = 10;

/** Antwort „Raise pay“: gestrichener Anteil aller Flüge. SPEZIFIKATION 8.7. */
export const STRIKE_SETTLED_CANCEL_SHARE = 0.5;

/** „Sit it out“ oder keine Antwort: gestrichener Anteil aller Flüge. SPEZIFIKATION 8.7. */
export const STRIKE_FULL_CANCEL_SHARE = 1;

// ---------------------------------------------------------------------------
// 8.8 Pech-Deckel
// ---------------------------------------------------------------------------

/** Ein Zufalls-Pech-Ereignis beansprucht den Deckel für Dauer × diesen Faktor ab Beginn (wie im Alt-Code). SPEZIFIKATION 8.8. */
export const BAD_LUCK_CLAIM_FACTOR = 2;

// ---------------------------------------------------------------------------
// 8.9 Charter
// ---------------------------------------------------------------------------

/** Charter-Gebühr je Flug = Aufschlag × eigene Flugkosten je Flug (E32). Startwert (3.9). SPEZIFIKATION 8.9. */
export const CHARTER_MARKUP = 1.5;

// ---------------------------------------------------------------------------
// 8.10 Verschleiß
// ---------------------------------------------------------------------------

/** Kabinen-Verschleiß je geflogene Blockstunde in Punkten (wie im Alt-Code `src/lib/monthClose.ts:1512-1532`). SPEZIFIKATION 8.10. */
export const CABIN_WEAR_PER_HOUR = 0.0012;

/** Zellen-Verschleiß je geflogene Blockstunde in Punkten. SPEZIFIKATION 8.10. */
export const AIRFRAME_WEAR_PER_HOUR = 0.00076;

/** Grund-Verschleiß je Monat (auch ohne Flug). SPEZIFIKATION 8.10. */
export const WEAR_BASE = 0.1;

/** Kabinen-Verschleiß höchstens so viele Punkte je Monat (vor Forschung). SPEZIFIKATION 8.10. */
export const CABIN_WEAR_MAX = 1;

/** Zellen-Verschleiß höchstens so viele Punkte je Monat (vor Forschung). SPEZIFIKATION 8.10. */
export const AIRFRAME_WEAR_MAX = 0.667;

// ---------------------------------------------------------------------------
// 8.11 Händler-Spanne, Verkauf, Gebrauchtmarkt
// ---------------------------------------------------------------------------

/** Der Markt kauft so viel unter `aircraftValue` (E30). Startwert (3.9). SPEZIFIKATION 8.11. */
export const DEALER_SPREAD_SELL = 0.15;

/** Der Markt verkauft so viel über `aircraftValue` (E30). Startwert (3.9). SPEZIFIKATION 8.11. */
export const DEALER_SPREAD_BUY = 0.05;

/** Neue Gebraucht-Angebote je Monat. SPEZIFIKATION 8.11. */
export const USED_OFFERS_PER_MONTH = 6;

/** Ein Typ erscheint gebraucht erst nach so vielen Jahren im Dienst. SPEZIFIKATION 8.11. */
export const USED_MIN_SERVICE_YEARS = 5;

/** Jüngstes Gebraucht-Angebot in Jahren. SPEZIFIKATION 8.11. */
export const USED_AGE_MIN = 4;

/** Ältestes Gebraucht-Angebot in Jahren. SPEZIFIKATION 8.11. */
export const USED_AGE_MAX = 24;

/** Zustand eines Gebraucht-Angebots: `start − perYear × Alter ± spread`, gekappt (wie im Alt-Code `src/lib/usedMarket.ts:73-76`). SPEZIFIKATION 8.11. */
export const USED_CONDITION = {
  airframe: { start: 98, perYear: 2.2, spread: 7 },
  cabin: { start: 92, perYear: 2.8, spread: 11 },
} as const;

/** Untere Grenze des Zustands eines Gebraucht-Angebots. SPEZIFIKATION 8.11. */
export const USED_CONDITION_MIN = 20;

/** Obere Grenze des Zustands eines Gebraucht-Angebots. SPEZIFIKATION 8.11. */
export const USED_CONDITION_MAX = 95;

/** Weiterverkaufte Flugzeuge bleiben so viele Monate im Markt (E49). SPEZIFIKATION 8.11. */
export const USED_RESOLD_MONTHS = 6;

/** Gezeigt werden die neuesten so vielen weiterverkauften Flugzeuge. SPEZIFIKATION 8.11. */
export const USED_RESOLD_MAX = 12;

/** Startwert des Zufallsgebers für die neuen Angebote: Der Gebrauchtmarkt würfelt nur nach Monat (8.3, F40). */
export const USED_MARKET_SEED = 0;

// ---------------------------------------------------------------------------
// 8.12 Vorbestellung
// ---------------------------------------------------------------------------

/** Vorbestellbar: Erstauslieferung in den nächsten so vielen Monaten. SPEZIFIKATION 8.12. */
export const PREORDER_WINDOW_MONTHS = 12;

/** Höchstens so viele Flugzeuge je Bestellung. SPEZIFIKATION 8.12. */
export const PREORDER_MAX = 12;

/** Rabatt für 1 Stück. Startwert (3.9). SPEZIFIKATION 8.12. */
export const PREORDER_DISCOUNT_BASE = 0.05;

/** Rabatt je weiteres Stück. SPEZIFIKATION 8.12. */
export const PREORDER_DISCOUNT_STEP = 0.01;

/** Rabatt höchstens; muss unter `1 − (1 − DEALER_SPREAD_SELL) × (1 + größter resaleBonus)` bleiben (Test). SPEZIFIKATION 8.12. */
export const PREORDER_DISCOUNT_MAX = 0.12;

/** Anzahlung als Anteil des geschätzten Preises. SPEZIFIKATION 8.12. */
export const PREORDER_DEPOSIT_SHARE = 0.2;

/** Lieferung: Erstauslieferung + 1 + ⌊n / PREORDER_BATCH⌋ Monate (wie im Alt-Code). SPEZIFIKATION 8.12. */
export const PREORDER_BASE_WAIT = 1;

/** Siehe `PREORDER_BASE_WAIT`. SPEZIFIKATION 8.12. */
export const PREORDER_BATCH = 3;

/** Ohne Geld wird die Lieferung höchstens so oft um einen Monat verschoben, danach storniert. SPEZIFIKATION 8.12. */
export const PREORDER_MAX_DELAYS = 3;

/** Storno durch den Spieler: dieser Anteil der Anzahlung zurück. SPEZIFIKATION 8.12. */
export const PREORDER_REFUND_SHARE = 0.5;

/** Erstkunde: Lieferung höchstens so viele Monate nach der Erstauslieferung (2.2 `launchBonus`). SPEZIFIKATION 8.12. */
export const LAUNCH_WINDOW_MONTHS = 12;

// ---------------------------------------------------------------------------
// 8.13 Grundüberholung und Kabinen-Umbau
// ---------------------------------------------------------------------------

/** Zellen-Punkte der k-ten Überholung (k = 1, 2, …); danach keine weitere (wie im Alt-Code `src/App.tsx:222-229`). SPEZIFIKATION 8.13. */
export const OVERHAUL_POINTS: readonly number[] = [50, 50, 40, 30];

/** Überholung kostet mindestens diesen Anteil des Neupreises (5.12). Startwert (3.9). SPEZIFIKATION 8.13. */
export const OVERHAUL_PRICE_SHARE = 0.04;

/** Überholung ohne eigenen Hangar an einem Flughafen der Strecken: so viel teurer (fremde Werft, E62). SPEZIFIKATION 8.13. */
export const EXTERNAL_OVERHAUL_SURCHARGE = 0.25;

/** Umbau-Lohn je Sitz in $ von 1960 (neu mit Index, W8). SPEZIFIKATION 8.13. */
export const REFIT_PER_SEAT_1960 = 1_000;

/** Kabinenzustand nach dem Umbau: `max(jetzt, START − STEP × bisherige Umbauten, MIN)` (wie im Alt-Code). SPEZIFIKATION 8.13. */
export const REFIT_CONDITION_START = 90;

/** Siehe `REFIT_CONDITION_START`. SPEZIFIKATION 8.13. */
export const REFIT_CONDITION_STEP = 10;

/** Siehe `REFIT_CONDITION_START`. SPEZIFIKATION 8.13. */
export const REFIT_CONDITION_MIN = 30;

// ---------------------------------------------------------------------------
// 8.14 Kreditlinie, Zwangsverkauf, Spielende (E34)
// ---------------------------------------------------------------------------

/** Kreditgrenze = Anteil des Flottenwerts am Monatsende. Startwert (3.9). SPEZIFIKATION 8.14. */
export const CREDIT_LIMIT_SHARE = 0.5;

/** Zins je Jahr auf die negative Kasse am Monatsanfang. Startwert (3.9). SPEZIFIKATION 8.14. */
export const CREDIT_RATE = 0.08;

/** Ab so vielen überzogenen Monaten in Folge: Zwangsverkauf, ein Flugzeug je Abschluss. SPEZIFIKATION 8.14. */
export const OVERDRAWN_TO_FORCED_SALE = 6;

/**
 * Spielende des Spielers nach so vielen überzogenen Monatsenden in Folge, je Schwierigkeit (E93). Gilt zusätzlich zu
 * „überzogen und kein Flugzeug mehr“; die KI hat kein Spielende (7.15). SPEZIFIKATION 8.14.
 */
export const BANKRUPTCY_OVERDRAWN_MONTHS: Readonly<Record<Difficulty, number>> = {
  Easy: 12,
  Normal: 6,
  Hard: 3,
};

// ---------------------------------------------------------------------------
// 8.2 Bericht
// ---------------------------------------------------------------------------

/** So viele Monatsberichte bleiben im Spielstand (wie im Alt-Code `src/lib/monthClose.ts:1263`). SPEZIFIKATION 8.2. */
export const REPORT_HISTORY_MONTHS = 120;

/**
 * So viele Monatsberichte behält eine KI (Gesellschaft mit Entscheidungs-Zustand `agent`) im Spielstand. Gelesen werden
 * nur der letzte (Ansicht), die letzten `PROFIT_LOOKBACK_MONTHS` Ergebnisse (7.8) und die letzten 12 Ergebnisse
 * (Gewinn-Verlauf der Konkurrenz-Ansicht). Mit 120 Berichten je KI war der Spielstand mit 12 KI im späten Spiel größer
 * als der Browser-Speicher (Paket 5.3b, F82). SPEZIFIKATION 8.2.
 */
export const RIVAL_REPORT_MONTHS = 12;

// ---------------------------------------------------------------------------
// 8.15 Szenario-Ziele
// ---------------------------------------------------------------------------

/** Was ein Szenario-Ziel misst (Alt-Code: `src/data/scenarios.ts`). SPEZIFIKATION 8.15. */
export type ScenarioMetric = 'capital' | 'monthlyProfit' | 'reputation' | 'routes' | 'regions' | 'transferPax';

/** Ziele in Dollar: Schwelle als Wert von 1960, geprüft mit `atCost` des Prüfmonats (E6). SPEZIFIKATION 8.15. */
export const SCENARIO_DOLLAR_METRICS: readonly ScenarioMetric[] = ['capital', 'monthlyProfit'];

// ---------------------------------------------------------------------------
// Zeitplan (Umlaufzeit, Flüge je Tag; 1.1, 1.6, E51, `bestand/8-oberflaeche.md` W6)
// ---------------------------------------------------------------------------

/** Minuten einer Stunde (Anzeige und Uhrzeit im Fahrplan). */
export const MINUTES_PER_HOUR = 60;

/** Minuten eines Tages (Fahrplan: ein Tag der Woche). */
export const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/** Bodenzeit vor jedem Abflug und nach jeder Ankunft eines Umlaufs (Einsteigen, Aussteigen; Alt-Code: `src/lib/scheduleUtils.ts:22`). */
export const BOARDING_MINUTES = 30;

/** Wendezeit am Ziel je Bauart (Alt-Code: `getTurnoverMinutes`, `src/lib/scheduleUtils.ts:39-44`). */
export const TURNAROUND_MINUTES: Readonly<Record<AircraftClass, number>> = {
  Regional: 30,
  Narrowbody: 60,
  Widebody: 90,
};

/**
 * Wendezeit am Ziel mit LCC-Kabine (`quickTurnCabin`): Anteil von `TURNAROUND_MINUTES`, auf `SCHEDULE_STEP_MINUTES`
 * gerundet (E98, Paket 5.4f). Einsteigen und Aussteigen (`BOARDING_MINUTES`) bleiben. Gilt für Spieler und KI (R1).
 * SPEZIFIKATION 1.1.
 */
export const QUICK_TURN_FACTOR = 0.5;

/** Raster aller Zeiten im Fahrplan; die Umlaufzeit wird darauf aufgerundet (Alt-Code: `blockMinutes`, `scheduleUtils.ts:56-58`). */
export const SCHEDULE_STEP_MINUTES = 5;
