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
