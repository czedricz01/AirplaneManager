/**
 * Grundbegriffe und Einheiten: SPEZIFIKATION Abschnitt 1.
 *
 * Zeit (Spielmonat, Kalenderjahr, stetige Zeit), Kostenindex und `atCost`,
 * Kappen auf eine Skala, Schwierigkeits-Faktor. Alles reine Funktionen.
 */

import {
  COST_GROWTH,
  COST_INDEX_LAST_YEAR,
  DIFFICULTY_COST_EARLY_UNTIL,
  DIFFICULTY_COST_FACTOR,
  DIFFICULTY_COST_FACTOR_EARLY,
  DIFFICULTY_COST_RAMP_YEARS,
  DIFFICULTY_FACTOR,
  SCALES,
  START_YEAR,
  type Difficulty,
  type ScaleName,
} from './constants';

// ---------------------------------------------------------------------------
// 1.1 Zeit
// ---------------------------------------------------------------------------

/**
 * Kalenderjahr eines Spielmonats: 1960 + abrunden(month / 12).
 * Für Tabellen, Lieferzeiträume und Texte. SPEZIFIKATION 1.1.
 */
export function yearOf(month: number): number {
  return START_YEAR + Math.floor(month / 12);
}

/**
 * Stetige Zeit in Jahren mit Bruchteil: 1960 + month / 12.
 * Für alles, was mit der Zeit wächst; keine Sprünge am Jahreswechsel (R5). SPEZIFIKATION 1.1.
 */
export function timeOf(month: number): number {
  return START_YEAR + month / 12;
}

// ---------------------------------------------------------------------------
// 1.3 Geld und Kostenindex
// ---------------------------------------------------------------------------

/**
 * Kostenindex: wie viel teurer Löhne, Gebühren, Preise und Einmalbeträge
 * gegenüber Januar 1960 sind. 1 in Monat 0, wächst stetig bis 2100, danach gleich.
 *
 * `costIndex = (1 + COST_GROWTH) ^ (timeOf(month) − 1960)`. SPEZIFIKATION 1.3.
 *
 * Nur `atCost` ruft diese Funktion für Beträge auf; sie ist exportiert für
 * Tests und Anzeigen, die den Index selbst zeigen.
 */
export function costIndex(month: number): number {
  const cached = COST_INDEX_CACHE.get(month);
  if (cached !== undefined) return cached;
  const time = Math.min(COST_INDEX_LAST_YEAR, Math.max(START_YEAR, timeOf(month)));
  const value = Math.pow(1 + COST_GROWTH, time - START_YEAR);
  COST_INDEX_CACHE.set(month, value);
  return value;
}

/** Zwischenspeicher von `costIndex` je Monat (reine Rechnung, gleiches Ergebnis; Rechenzeit der KI, Paket 3.9b). */
const COST_INDEX_CACHE = new Map<number, number>();

/**
 * Ein fester Betrag von 1960 in Preisen des Monats `month`:
 * `amount1960 × costIndex(month)`. Die einzige Stelle, an der feste Beträge
 * mit dem Kostenindex umgerechnet werden. SPEZIFIKATION 1.3, E6, E7.
 *
 * Nicht für die Treibstoff-Tabelle (E8) und nicht für Beträge, die als Anteil
 * einer anderen Größe festgelegt sind.
 */
export function atCost(amount1960: number, month: number): number {
  return amount1960 * costIndex(month);
}

// ---------------------------------------------------------------------------
// 1.4 Skalen, 1.7 Rundung
// ---------------------------------------------------------------------------

/**
 * Begrenzt `value` auf `min … max`. Rundet nicht (R4).
 *
 * `NaN` bleibt `NaN`: Ein ungültiger Wert wird nicht versteckt; die Prüfung am
 * Ende des Monatsabschlusses findet ihn (SPEZIFIKATION 8.16).
 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Begrenzt `value` auf den Bereich der Skala `scale` aus `SCALES` (SPEZIFIKATION 1.4).
 * Nur am Ende der Funktion aufrufen, die die Größe festlegt; Leser kappen nicht noch einmal (1.7).
 */
export function clampScale(scale: ScaleName, value: number): number {
  const { min, max } = SCALES[scale];
  return clamp(value, min, max);
}

// ---------------------------------------------------------------------------
// 1.8 Schwierigkeit
// ---------------------------------------------------------------------------

/**
 * Faktor der Schwierigkeit auf die Anziehung der Spieler-Angebote:
 * Normal = 1, Easy > 1, Hard < 1. Wirkt an genau einer Stelle (Abschnitt 3),
 * nie auf die KI, nie auf Preise. SPEZIFIKATION 1.8, E4, E53.
 */
export function difficultyFactor(difficulty: Difficulty): number {
  return DIFFICULTY_FACTOR[difficulty];
}

/**
 * Faktor der Schwierigkeit auf die Betriebskosten des Spielers (Treibstoff, Besatzung, Landung, Kosten je Fluggast):
 * Normal = 1, Easy < 1, Hard > 1. Nie auf die KI (sie rechnet mit Normal). SPEZIFIKATION 1.8, E87.
 *
 * Bis Ende 1979 gilt der frühe Wert (`DIFFICULTY_COST_FACTOR_EARLY`, Hard 1,05), dann wandert der Faktor in
 * `DIFFICULTY_COST_RAMP_YEARS` Jahren stetig zum späten Wert (Hard 1,1 ab 1985). E112.
 */
export function difficultyCostFactor(difficulty: Difficulty, month: number): number {
  const early = DIFFICULTY_COST_FACTOR_EARLY[difficulty];
  const late = DIFFICULTY_COST_FACTOR[difficulty];
  const share = clamp((timeOf(month) - DIFFICULTY_COST_EARLY_UNTIL) / DIFFICULTY_COST_RAMP_YEARS, 0, 1);
  return early + (late - early) * share;
}
