/**
 * Ruf, Rang, Fortschritt: SPEZIFIKATION Abschnitt 6.
 *
 * Paket 3.6a: Ruf (6.1–6.6), Rang (6.7), Flugzeugklassen (6.8).
 * Paket 3.6b ergänzt Forschung (6.9), Meilensteine (6.10), Jahresziel (6.11) und Karriere-Punkte (6.12).
 *
 * Den **Ruf** haben alle Gesellschaften mit derselben Funktion (E44). Rang, Forschung, Meilensteine,
 * Jahresziel und Karriere-Punkte hat nur der Spieler. Was andere Abschnitte liefern (Airline satisfaction 2.9,
 * gestrichene Sitze aus Abschnitt 8, laufende Kampagnen, Regionen der Strecken-Enden über `regionOf`), kommt
 * als fertige Zahl oder Liste (wie F14).
 */

import { clampScale } from './basics';
import {
  ADVERTISING_REPUTATION_MAX,
  CAMPAIGN_REPUTATION,
  CANCELLED_REPUTATION_WEIGHT,
  CLASS_RESEARCH,
  COMMUTER_MAX_SEATS,
  JUMBO_MIN_SEATS,
  MAX_RANK,
  RANK_AVERAGE_MONTHS,
  RANK_UNLOCKS,
  RANKS,
  REGIONAL_JET_MAX_SEATS,
  REPUTATION_DISPLAY_BAND,
  REPUTATION_NEUTRAL,
  REPUTATION_STEP,
  SCALES,
  SIZE_CLASSES,
  SUPERSONIC_MIN_KMH,
  WEEKS_PER_MONTH,
  type CampaignTier,
  type ClassResearch,
  type RankDef,
  type RankRequirement,
  type RankUnlock,
  type SizeClass,
  type WorldRegion,
} from './constants';

// ---------------------------------------------------------------------------
// 6.1 Ruf aus Satisfaction
// ---------------------------------------------------------------------------

/**
 * Ruf, den die Fluggäste auf Dauer verbreiten, stückweise gerade und stetig bei 100:
 * bis 100 `50 × s / 100`, darüber `50 + 50 × (s − 100) / 60`. Satisfaction 100 → 50, 160 → 100.
 * SPEZIFIKATION 6.1, E36, E39.
 *
 * @param airlineSatisfactionValue `airlineSatisfaction` (2.9); ohne Fluggäste 100.
 */
export function satisfactionReputation(airlineSatisfactionValue: number): number {
  const s = airlineSatisfactionValue;
  const neutral = SCALES.satisfaction.neutral;
  if (s <= neutral) return (REPUTATION_NEUTRAL * s) / neutral;
  const top = SCALES.satisfaction.max - neutral;
  return REPUTATION_NEUTRAL + ((SCALES.reputation.max - REPUTATION_NEUTRAL) * (s - neutral)) / top;
}

// ---------------------------------------------------------------------------
// 6.2 Gestrichene Flüge
// ---------------------------------------------------------------------------

/**
 * Anteil gestrichener Sitze des Monats: `gestrichene Sitze / geplante Sitze` (Sitze × Abflüge, alle Strecken und
 * Klassen). Gecharterte Flüge zählt der Aufrufer nicht als gestrichen (E32). Ohne geplante Sitze 0; mehr
 * gestrichene als geplante Sitze ist ein Fehler. SPEZIFIKATION 6.2.
 */
export function cancelledShare(cancelledSeats: number, plannedSeats: number): number {
  if (cancelledSeats < 0 || cancelledSeats > plannedSeats) throw new Error('Gestrichene Sitze außerhalb 0 … geplante');
  return plannedSeats > 0 ? cancelledSeats / plannedSeats : 0;
}

/** Abzug im Ruf-Ziel: `CANCELLED_REPUTATION_WEIGHT × cancelledShare`. Die einzige Ruf-Strafe für Ausfälle (E33, E38). SPEZIFIKATION 6.2. */
export function cancellationPenalty(cancelledShareValue: number): number {
  return CANCELLED_REPUTATION_WEIGHT * cancelledShareValue;
}

// ---------------------------------------------------------------------------
// 6.3 Werbe-Beitrag
// ---------------------------------------------------------------------------

/**
 * Werbe-Beitrag zum Ruf-Ziel: `min(3, Σ laufende Kampagnen: CAMPAIGN_REPUTATION[Stufe])`. Steht im Ziel, nicht als
 * Zuschlag danach; klingt darum nach dem Ende ab (E37). KI: keine Kampagnen, 0. SPEZIFIKATION 6.3.
 */
export function advertisingReputation(campaigns: readonly CampaignTier[]): number {
  const sum = campaigns.reduce((total, tier) => total + CAMPAIGN_REPUTATION[tier], 0);
  return Math.min(ADVERTISING_REPUTATION_MAX, sum);
}

// ---------------------------------------------------------------------------
// 6.4 Ruf-Ziel
// ---------------------------------------------------------------------------

/** Eingaben des Ruf-Ziels für einen Monat. */
export interface ReputationInput {
  /** `airlineSatisfaction` (2.9) des Monats; ohne Fluggäste 100. */
  readonly airlineSatisfaction: number;
  /** `cancelledShare` des Monats (6.2, Abschnitt 8); Standard 0. */
  readonly cancelledShare?: number;
  /** Laufende Kampagnen (Stufen); Standard keine. */
  readonly campaigns?: readonly CampaignTier[];
}

/** Ruf-Ziel nach Teilen (vor dem Kappen) und gekappt. */
export interface ReputationTargetParts {
  readonly satisfactionReputation: number;
  readonly cancellationPenalty: number;
  readonly advertisingReputation: number;
  /** `kappen(Ruf aus Satisfaction − Abzug + Werbung, 0, 100)`. */
  readonly target: number;
}

/** Ruf-Ziel mit Teilen. SPEZIFIKATION 6.4. */
export function reputationTargetParts(input: ReputationInput): ReputationTargetParts {
  const fromSatisfaction = satisfactionReputation(input.airlineSatisfaction);
  const penalty = cancellationPenalty(input.cancelledShare ?? 0);
  const advertising = advertisingReputation(input.campaigns ?? []);
  return {
    satisfactionReputation: fromSatisfaction,
    cancellationPenalty: penalty,
    advertisingReputation: advertising,
    target: clampScale('reputation', fromSatisfaction - penalty + advertising),
  };
}

/**
 * Wohin sich der Ruf bewegt: `kappen(satisfactionReputation − cancellationPenalty + advertisingReputation, 0, 100)`.
 * Nicht abhängig von Zustand, Auslastung, Schwierigkeit, Rang, Meilensteinen, Jahresziel. SPEZIFIKATION 6.4.
 */
export function reputationTarget(input: ReputationInput): number {
  return reputationTargetParts(input).target;
}

// ---------------------------------------------------------------------------
// 6.5 Ruf-Änderung
// ---------------------------------------------------------------------------

/** Ursache einer Ruf-Änderung (Anzeige-Namen in Phase 4). */
export type ReputationCause = 'satisfaction' | 'cancelled' | 'advertising' | 'limit';

/** Ergebnis der Ruf-Änderung eines Monats. */
export interface ReputationChange {
  /** Neuer Ruf. */
  readonly reputation: number;
  /** Ruf-Ziel des Monats (6.4). */
  readonly target: number;
  /** Anteile je Ursache; Summe = neuer Ruf − alter Ruf. `limit` nur, wenn das Ziel gekappt wurde. */
  readonly causes: readonly { readonly cause: ReputationCause; readonly amount: number }[];
}

/**
 * Die einzige Stelle, an der sich der Ruf ändert (R10): `neu = alt + REPUTATION_STEP × (Ziel − alt)`.
 * Einmal je Monat im Abschluss, Spieler und KI (E44). Ursachen-Liste für die Anzeige (E52). SPEZIFIKATION 6.5.
 *
 * @param reputation Ruf vom Monatsanfang, 0 … 100.
 */
export function reputationChange(reputation: number, input: ReputationInput): ReputationChange {
  const parts = reputationTargetParts(input);
  const total = REPUTATION_STEP * (parts.target - reputation);
  const causes: { cause: ReputationCause; amount: number }[] = [
    { cause: 'satisfaction', amount: REPUTATION_STEP * (parts.satisfactionReputation - reputation) },
  ];
  if (parts.cancellationPenalty !== 0) causes.push({ cause: 'cancelled', amount: -REPUTATION_STEP * parts.cancellationPenalty });
  if (parts.advertisingReputation !== 0) causes.push({ cause: 'advertising', amount: REPUTATION_STEP * parts.advertisingReputation });
  const unclamped = parts.satisfactionReputation - parts.cancellationPenalty + parts.advertisingReputation;
  if (unclamped !== parts.target) {
    const counted = causes.reduce((sum, c) => sum + c.amount, 0);
    causes.push({ cause: 'limit', amount: total - counted });
  }
  return { reputation: reputation + total, target: parts.target, causes };
}

// ---------------------------------------------------------------------------
// 6.6 Anzeige des Rufs
// ---------------------------------------------------------------------------

/** Farbstufe des Rufs. */
export type ReputationBand = 'high' | 'neutral' | 'low';

/** „hoch“ ab 60, „niedrig“ bis 40, sonst neutral (aus `REPUTATION_NEUTRAL` ± `REPUTATION_DISPLAY_BAND`). SPEZIFIKATION 6.6. */
export function reputationBand(reputation: number): ReputationBand {
  if (reputation >= REPUTATION_NEUTRAL + REPUTATION_DISPLAY_BAND) return 'high';
  if (reputation <= REPUTATION_NEUTRAL - REPUTATION_DISPLAY_BAND) return 'low';
  return 'neutral';
}

// ---------------------------------------------------------------------------
// 6.7 Rang
// ---------------------------------------------------------------------------

/** Rang-Werte eines Monats. */
export type RankStats = RankRequirement;

/** Eingaben für `rankStats` am Ende des Abschlusses. */
export interface RankStatsInput {
  /** Strecken am Monatsende. */
  readonly routes: number;
  /** Fluggäste je Woche, jede Teilstrecke gezählt (Umsteiger doppelt). */
  readonly weeklyPassengers: number;
  /** Ruf nach der Ruf-Änderung (6.5). */
  readonly reputation: number;
  /** Region jedes Strecken-Endes (`regionOf`, R15); doppelte zählen einmal. */
  readonly routeEndRegions: readonly WorldRegion[];
  /** Spielmonate seit Spielstart (Monat des Abschlusses − Startmonat). */
  readonly monthsPlayed: number;
}

/**
 * Rang-Werte eines Monats: Strecken, Fluggäste des Monats (`je Woche × WEEKS_PER_MONTH`, E5), Ruf, Zahl der
 * Regionen, volle Jahre seit Spielstart. Eine Funktion für Abschluss und Karriere-Ansicht (R2). SPEZIFIKATION 6.7.
 */
export function rankStats(input: RankStatsInput): RankStats {
  return {
    routes: input.routes,
    monthlyPax: input.weeklyPassengers * WEEKS_PER_MONTH,
    reputation: input.reputation,
    regions: new Set(input.routeEndRegions).size,
    years: Math.floor(input.monthsPlayed / 12),
  };
}

/**
 * Mittel der letzten `RANK_AVERAGE_MONTHS` Monate für Strecken, Fluggäste, Ruf, Regionen (E40); fehlende Monate
 * vor Spielstart zählen als 0. `years` aus dem letzten Monat. SPEZIFIKATION 6.7.
 *
 * @param history Rang-Werte je Monat, ältester zuerst, der aktuelle zuletzt; nicht leer.
 */
export function averageRankStats(history: readonly RankStats[]): RankStats {
  const latest = history[history.length - 1];
  if (!latest) throw new Error('Rang-Werte ohne Monat');
  const recent = history.slice(-RANK_AVERAGE_MONTHS);
  const mean = (key: 'routes' | 'monthlyPax' | 'reputation' | 'regions') =>
    recent.reduce((sum, s) => sum + s[key], 0) / RANK_AVERAGE_MONTHS;
  return {
    routes: mean('routes'),
    monthlyPax: mean('monthlyPax'),
    reputation: mean('reputation'),
    regions: mean('regions'),
    years: latest.years,
  };
}

const RANK_KEYS: readonly (keyof RankRequirement)[] = ['routes', 'monthlyPax', 'reputation', 'regions', 'years'];

function meets(stats: RankStats, requirement: RankRequirement): boolean {
  return RANK_KEYS.every((key) => stats[key] >= requirement[key]);
}

/** Höchste Stufe, deren Bedingungen alle erfüllt sind, Stufen der Reihe nach. SPEZIFIKATION 6.7. */
export function qualifyingRank(averaged: RankStats): number {
  let best = 0;
  for (const def of RANKS) {
    if (!meets(averaged, def.requires)) break;
    best = def.index;
  }
  return best;
}

/**
 * Rang nach dem Abschluss: `max(alter Rang, Prüfung über die 3-Monats-Mittel)`. Nie Abstieg (E40).
 * SPEZIFIKATION 6.7.
 *
 * @param history Rang-Werte je Monat, ältester zuerst, der aktuelle zuletzt.
 */
export function nextRank(currentRank: number, history: readonly RankStats[]): number {
  return Math.max(currentRank, qualifyingRank(averageRankStats(history)));
}

/** Spielart: Normal mit Rang-Aufstieg; Free Mode mit Rang 9 vom ersten Monat an. */
export type GameMode = 'normal' | 'free';

/** Der Rang, der gilt: im Free Mode `MAX_RANK`, sonst der erreichte. SPEZIFIKATION 6.7. */
export function effectiveRank(mode: GameMode, rank: number): number {
  return mode === 'free' ? MAX_RANK : rank;
}

/** Datensatz eines Rangs; ein Rang außerhalb 0 … 9 ist ein Fehler. */
export function rankDef(rank: number): RankDef {
  const def = RANKS[rank];
  if (!def) throw new Error(`Unbekannter Rang ${rank}`);
  return def;
}

/** Erlaubte Drehkreuze: Rang + Meilenstein-Zuschläge (6.10); im Free Mode unbegrenzt (wie heute). SPEZIFIKATION 6.7. */
export function hubAllowance(rank: number, milestoneHubs: number, mode: GameMode = 'normal'): number {
  if (mode === 'free') return Number.POSITIVE_INFINITY;
  return rankDef(rank).maxHubs + milestoneHubs;
}

/** Gleichzeitig laufende Forschungen (Feld `researchSlots`, E42). SPEZIFIKATION 6.7, 6.9. */
export function researchSlots(rank: number): number {
  return rankDef(rank).researchSlots;
}

/** Ist das Werkzeug beim Rang offen? (Spalte „Weitere Freischaltungen“). SPEZIFIKATION 6.7. */
export function hasUnlock(rank: number, unlock: RankUnlock): boolean {
  return rank >= RANK_UNLOCKS[unlock];
}

/** Wie ein Flughafen zur Gesellschaft steht (Ausnahmen beim Zugang, wie heute `src/lib/airportAccess.ts:31-44`). */
export interface AirportStanding {
  /** Heimat-Drehkreuz. */
  readonly isHome?: boolean;
  /** Eigene Verwaltungsstufe dort (0 … 3). */
  readonly managementTier?: number;
  /** Ende einer bestehenden eigenen Strecke. */
  readonly isRouteEnd?: boolean;
}

/**
 * Darf die Gesellschaft den Flughafen nutzen? Größe ≤ `maxAirportLevel` des Rangs, oder eine Ausnahme: Heimat,
 * eigene Verwaltungsstufe ≥ 1, Ende einer bestehenden Strecke. SPEZIFIKATION 6.7.
 */
export function isAirportOpen(rank: number, airportLevel: number, standing: AirportStanding = {}): boolean {
  if (standing.isHome || (standing.managementTier ?? 0) >= 1 || standing.isRouteEnd) return true;
  return airportLevel <= rankDef(rank).maxAirportLevel;
}

/** Eine Zeile des Fortschritts zum nächsten Rang. */
export interface RankProgressLine {
  readonly key: keyof RankRequirement;
  /** 3-Monats-Mittel (Jahre: aktueller Stand). */
  readonly current: number;
  readonly target: number;
  readonly met: boolean;
}

/** Fortschritt zum nächsten Rang. */
export interface RankProgress {
  readonly next: RankDef;
  /** Nur Bedingungen mit Schwelle > 0. */
  readonly lines: readonly RankProgressLine[];
  /** Mittel der Anteile `min(1, Mittel / Schwelle)`; 1 ohne Bedingung. */
  readonly fraction: number;
}

/**
 * Fortschritt zum nächsten Rang aus denselben 3-Monats-Mitteln wie die Prüfung (heute aus einem Monat,
 * `src/lib/airlineRank.ts:166-182`); `null` auf dem höchsten Rang. SPEZIFIKATION 6.7.
 */
export function rankProgress(currentRank: number, history: readonly RankStats[]): RankProgress | null {
  if (currentRank >= MAX_RANK) return null;
  const next = rankDef(currentRank + 1);
  const averaged = averageRankStats(history);
  const lines = RANK_KEYS.filter((key) => next.requires[key] > 0).map((key) => ({
    key,
    current: averaged[key],
    target: next.requires[key],
    met: averaged[key] >= next.requires[key],
  }));
  const fraction =
    lines.length === 0 ? 1 : lines.reduce((sum, l) => sum + Math.min(1, l.current / l.target), 0) / lines.length;
  return { next, lines, fraction };
}

// ---------------------------------------------------------------------------
// 6.8 Flugzeugklassen
// ---------------------------------------------------------------------------

/** Was `sizeClassOf` von einem Flugzeugtyp braucht (Felder aus `src/data/aircraft.ts`). */
export interface SizeClassInput {
  /** Bauart der Daten: „Regional“, „Narrowbody“, „Widebody“. */
  readonly class: string;
  /** Sitze (Höchstzahl der Daten). */
  readonly capacity: number;
  /** Reisegeschwindigkeit, km/h. */
  readonly cruiseSpeed: number;
}

/**
 * Flugzeugklasse wie heute (`src/lib/aircraftClasses.ts:48-58`): über 1 000 km/h Überschall; Widebody über
 * 500 Sitze Jumbo, sonst Widebody; Narrowbody bis 130 Sitze Regional, sonst Narrowbody; übrige bis 60 Sitze
 * Commuter, sonst Regional. SPEZIFIKATION 6.8.
 */
export function sizeClassOf(aircraft: SizeClassInput): SizeClass {
  if (aircraft.cruiseSpeed > SUPERSONIC_MIN_KMH) return 'supersonic';
  const kind = aircraft.class.toLowerCase();
  if (kind === 'widebody') return aircraft.capacity > JUMBO_MIN_SEATS ? 'jumbo' : 'widebody';
  if (kind === 'narrowbody') return aircraft.capacity <= REGIONAL_JET_MAX_SEATS ? 'regional' : 'narrowbody';
  return aircraft.capacity <= COMMUTER_MAX_SEATS ? 'commuter' : 'regional';
}

/** Forschungs-Projekt einer Klasse; Commuter hat keines (`null`). SPEZIFIKATION 6.8. */
export function classResearchOf(sizeClass: SizeClass): ClassResearch | null {
  return sizeClass === 'commuter' ? null : CLASS_RESEARCH[sizeClass];
}

/**
 * Offene Klassen: Commuter, Klassen mit fertiger Forschung, Klassen der eigenen Flotte; im Free Mode alle.
 * SPEZIFIKATION 6.8.
 *
 * @param doneResearchIds Ids der fertigen Forschungen.
 * @param fleetClasses Klassen der Flugzeuge in der eigenen Flotte.
 */
export function openSizeClasses(
  doneResearchIds: readonly string[],
  fleetClasses: readonly SizeClass[] = [],
  mode: GameMode = 'normal',
): ReadonlySet<SizeClass> {
  if (mode === 'free') return new Set(SIZE_CLASSES);
  const done = new Set(doneResearchIds);
  const open = SIZE_CLASSES.filter((c) => {
    const project = classResearchOf(c);
    return project === null || done.has(project.id);
  });
  return new Set([...open, ...fleetClasses]);
}

/**
 * Klassen-Projekte, die beim Spielstart als fertig gelten: alle, die bis zum Startrang erscheinen (wie heute
 * `src/lib/research.ts:191-193`). SPEZIFIKATION 6.8, 6.13.
 */
export function startingClassResearch(startRank: number): readonly string[] {
  return Object.values(CLASS_RESEARCH)
    .filter((project) => project.rank <= startRank)
    .map((project) => project.id);
}

/**
 * Kürzeste Dauer aller Klassen-Projekte bis zu dieser Klasse, nacheinander (eigenes Projekt und alle Vorgänger),
 * in Monaten. Für die Prüfung der Erreichbarkeit. SPEZIFIKATION 6.8.
 */
export function classResearchChainMonths(sizeClass: SizeClass): number {
  let months = 0;
  let current: SizeClass | null = sizeClass;
  while (current !== null) {
    const project = classResearchOf(current);
    if (project === null) break;
    months += project.months;
    current = project.requires;
  }
  return months;
}

