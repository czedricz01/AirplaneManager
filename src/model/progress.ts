/**
 * Ruf, Rang, Fortschritt: SPEZIFIKATION Abschnitt 6.
 *
 * Paket 3.6a: Ruf (6.1–6.6), Rang (6.7), Flugzeugklassen (6.8).
 * Paket 3.6b: Forschung (6.9), Meilensteine (6.10), Jahresziel (6.11), Karriere-Punkte (6.12).
 *
 * Den **Ruf** haben alle Gesellschaften mit derselben Funktion (E44). Rang, Forschung, Meilensteine,
 * Jahresziel und Karriere-Punkte hat nur der Spieler. Was andere Abschnitte liefern (Airline satisfaction 2.9,
 * gestrichene Sitze aus Abschnitt 8, laufende Kampagnen, Regionen der Strecken-Enden über `regionOf`), kommt
 * als fertige Zahl oder Liste (wie F14).
 */

import { atCost, clampScale } from './basics';
import {
  ADVERTISING_REPUTATION_MAX,
  CAMPAIGN_REPUTATION,
  CANCELLED_REPUTATION_WEIGHT,
  CAREER_MAX_YEARS,
  CAREER_MILESTONE_POINTS,
  CAREER_RANK_POINTS,
  CAREER_REPUTATION_POINTS,
  CAREER_RESEARCH_POINTS,
  CAREER_TAKEOVER_POINTS,
  CAREER_WEALTH_POINTS,
  CAREER_WEALTH_UNIT_1960,
  CAREER_YEAR_POINTS,
  CLASS_RESEARCH,
  COMMUTER_MAX_SEATS,
  COST_RESEARCH_KINDS,
  GOAL_MIN_MARGIN,
  GOAL_MIN_REWARD_1960,
  GOAL_MISS_PENALTY_SHARE,
  GOAL_PAX_FACTOR,
  GOAL_PAX_MIN,
  GOAL_PROFIT_FLOOR_1960,
  GOAL_REPUTATION_MAX,
  GOAL_REPUTATION_STEP,
  GOAL_REWARD_SHARE,
  GOAL_ROUTES_MIN_STEP,
  GOAL_ROUTES_SHARE,
  GOAL_STEADY_FACTOR,
  GOAL_STRETCH_FACTOR,
  HALL_SIZE,
  JUMBO_MIN_SEATS,
  MAX_RANK,
  MILESTONE_SLOT_DISCOUNT_MAX,
  MILESTONE_TIER_REWARD,
  MILESTONES,
  RAMP_START,
  RANK_AVERAGE_MONTHS,
  RANK_UNLOCKS,
  RANKS,
  REGIONAL_JET_MAX_SEATS,
  REPUTATION_DISPLAY_BAND,
  REPUTATION_NEUTRAL,
  REPUTATION_STEP,
  RESEARCH_COST_FLOOR,
  RESEARCH_EFFECT_FLOOR,
  RESEARCH_PROJECTS,
  SCALES,
  SIZE_CLASSES,
  SUPERSONIC_MIN_KMH,
  WEEKS_PER_MONTH,
  WORLD_REGIONS,
  type CampaignTier,
  type ClassResearch,
  type CostResearchKind,
  type GoalTag,
  type MilestoneDef,
  START_CAPITAL_TIERS_1960,
  type MilestoneMetric,
  type RankDef,
  type RankRequirement,
  type RankUnlock,
  type ResearchProjectDef,
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
    years: yearsPlayed(input.monthsPlayed),
  };
}

/**
 * Volle Jahre im Geschäft: `⌊max(0, Spielmonate) / 12⌋`. Eine Funktion für Rang (6.7), Karriere-Punkte (6.12) und
 * Ruhmeshalle (statt dreier Kopien in `src/App.tsx`, Bestand 1.8 Art D). SPEZIFIKATION 6.7.
 *
 * @param monthsPlayed Spielmonate seit Spielstart (Monat − Startmonat).
 */
export function yearsPlayed(monthsPlayed: number): number {
  return Math.floor(Math.max(0, monthsPlayed) / 12);
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

// ---------------------------------------------------------------------------
// 6.9 Forschung
// ---------------------------------------------------------------------------

const PROJECT_BY_ID: ReadonlyMap<string, ResearchProjectDef> = new Map(RESEARCH_PROJECTS.map((p) => [p.id, p]));

/** Projekt der Forschungs-Tabelle; eine unbekannte Id ist ein Fehler. SPEZIFIKATION 6.9. */
export function researchProject(id: string): ResearchProjectDef {
  const project = PROJECT_BY_ID.get(id);
  if (!project) throw new Error(`Unbekanntes Forschungs-Projekt ${id}`);
  return project;
}

/** Was alle fertigen Projekte zusammen bewirken; ohne fertige Projekte überall neutral. SPEZIFIKATION 6.9. */
export interface ResearchEffects {
  /** `max(0,4; 1 − Σ costSaving[Art])` je Kostenart; wirkt in 5.1. */
  readonly costFactor: Readonly<Record<CostResearchKind, number>>;
  /** Σ `efficiencyPoints`; wirkt in 5.3. */
  readonly efficiencyPoints: number;
  /** Σ `satisfactionPoints`; wirkt in 2.6.5. */
  readonly satisfactionPoints: number;
  /** Π `demandFactor` = `researchDemandFactor` in 3.9.4. */
  readonly demandFactor: number;
  /** Π `hubQualityFactor`; wirkt in 3.13. */
  readonly hubQualityFactor: number;
  /** Σ `rampBonus`; wirkt in 3.12. */
  readonly rampBonus: number;
  /** `max(0,4; 1 − Σ defectSaving)`: Faktor auf die Ausfall-Wahrscheinlichkeit (Abschnitt 8). */
  readonly defectFactor: number;
  /** `max(0,4; 1 − Σ wearSaving)`: Faktor auf den Verschleiß (Abschnitt 8). */
  readonly wearFactor: number;
  /** Σ `resaleBonus`: Zuschlag auf den Verkaufserlös (Abschnitt 8). */
  readonly resaleBonus: number;
  /** Σ `moralePoints`: Moral-Punkte (2.6.4 über Abschnitt 8). */
  readonly moralePoints: number;
}

/**
 * Wirkungen der fertigen Projekte, je Feld nach der Regel aus 6.9 zusammengefasst (Summe, Produkt oder
 * `max(0,4; 1 − Σ)`). Jede Id zählt einmal; Ids, die nicht in der Tabelle stehen, zählen nicht (wie 5.1).
 * KI: forscht nicht, also `researchEffects([])`. SPEZIFIKATION 6.9.
 *
 * @param completedResearch Ids der fertigen Projekte.
 */
export function researchEffects(completedResearch: readonly string[] = []): ResearchEffects {
  const key = completedResearch.join('|');
  const cached = RESEARCH_EFFECTS_CACHE.get(key);
  if (cached) return cached;
  const effects = computeResearchEffects(completedResearch);
  RESEARCH_EFFECTS_CACHE.set(key, effects);
  return effects;
}

/**
 * Zwischenspeicher von `researchEffects` je Liste der fertigen Forschungen (reine Rechnung; spart die Rechnung je
 * Angebot und Klasse in jeder Planer-Rechnung, Paket 3.9b). Die Werte sind eingefroren, damit niemand sie ändert.
 */
const RESEARCH_EFFECTS_CACHE = new Map<string, ResearchEffects>();

function computeResearchEffects(completedResearch: readonly string[]): ResearchEffects {
  const saving: Record<CostResearchKind, number> = { fuel: 0, crew: 0, fees: 0, catering: 0, maintenance: 0, slots: 0 };
  let efficiencyPoints = 0;
  let satisfactionPoints = 0;
  let demandFactor = 1;
  let hubQualityFactor = 1;
  let rampBonus = 0;
  let defectSaving = 0;
  let wearSaving = 0;
  let resaleBonus = 0;
  let moralePoints = 0;
  for (const id of new Set(completedResearch)) {
    const effect = PROJECT_BY_ID.get(id)?.effect;
    if (!effect) continue;
    for (const kind of COST_RESEARCH_KINDS) saving[kind] += effect.costSaving?.[kind] ?? 0;
    efficiencyPoints += effect.efficiencyPoints ?? 0;
    satisfactionPoints += effect.satisfactionPoints ?? 0;
    demandFactor *= effect.demandFactor ?? 1;
    hubQualityFactor *= effect.hubQualityFactor ?? 1;
    rampBonus += effect.rampBonus ?? 0;
    defectSaving += effect.defectSaving ?? 0;
    wearSaving += effect.wearSaving ?? 0;
    resaleBonus += effect.resaleBonus ?? 0;
    moralePoints += effect.moralePoints ?? 0;
  }
  const costFactor = {} as Record<CostResearchKind, number>;
  for (const kind of COST_RESEARCH_KINDS) costFactor[kind] = Math.max(RESEARCH_COST_FLOOR, 1 - saving[kind]);
  return Object.freeze({
    costFactor: Object.freeze(costFactor),
    efficiencyPoints,
    satisfactionPoints,
    demandFactor,
    hubQualityFactor,
    rampBonus,
    defectFactor: Math.max(RESEARCH_EFFECT_FLOOR, 1 - defectSaving),
    wearFactor: Math.max(RESEARCH_EFFECT_FLOOR, 1 - wearSaving),
    resaleBonus,
    moralePoints,
  });
}

/** Preis eines Projekts im Monat `month`: `atCost(price1960, month)`, ungerundet (R4, W9). SPEZIFIKATION 6.9. */
export function researchPrice(id: string, month: number): number {
  return atCost(researchProject(id).price1960, month);
}

/** Ein laufendes Projekt: Id und Spielmonat des Starts. */
export interface ActiveResearch {
  readonly id: string;
  readonly startMonth: number;
}

/** Forschungs-Stand des Spielers: fertige und laufende Projekte. */
export interface ResearchState {
  readonly done: readonly string[];
  readonly active: readonly ActiveResearch[];
}

/**
 * Startkasse des Spielers zur gewählten Stufe: `atCost(Stufe in $ von 1960, Startmonat)` (E6, E11), wie die
 * Startkasse der KI (7.7). Eine unbekannte Stufe ist ein Fehler. SPEZIFIKATION 6.13.
 *
 * @param tier1960 ein Wert aus `START_CAPITAL_TIERS_1960`.
 * @param startMonth Spielmonat des Spielstarts.
 */
export function startCapital(tier1960: number, startMonth: number): number {
  if (!START_CAPITAL_TIERS_1960.includes(tier1960)) throw new Error(`Unbekannte Startkapital-Stufe ${tier1960}`);
  return atCost(tier1960, startMonth);
}

/**
 * Stand beim Spielstart: Klassen-Projekte bis zum Startrang fertig (6.8), sonst nichts (6.13). Free Mode:
 * Startrang 9, also alle Klassen fertig. SPEZIFIKATION 6.13.
 */
export function startingResearch(startRank: number): ResearchState {
  return { done: startingClassResearch(startRank), active: [] };
}

/** Warum ein Projekt nicht starten kann (Reihenfolge der Prüfung wie heute `src/lib/research.ts:286-298`). */
export type ResearchBlocker = 'done' | 'running' | 'rank' | 'requires' | 'slots' | 'cash';

/**
 * Start-Sperre: fertig, läuft schon, Rang zu klein, Vorgänger fehlt, alle Plätze belegt (`researchSlots`),
 * zu wenig Geld (Preis des aktuellen Monats). `null` = darf starten. SPEZIFIKATION 6.9.
 *
 * @param rank Rang, der gilt (`effectiveRank`; Free Mode 9).
 * @param cash Kasse vor dem Start.
 */
export function researchStartBlocker(
  state: ResearchState,
  id: string,
  rank: number,
  cash: number,
  month: number,
): ResearchBlocker | null {
  const project = researchProject(id);
  if (state.done.includes(id)) return 'done';
  if (state.active.some((a) => a.id === id)) return 'running';
  if (project.rank > rank) return 'rank';
  if (project.requires !== null && !state.done.includes(project.requires)) return 'requires';
  if (state.active.length >= researchSlots(rank)) return 'slots';
  if (cash < researchPrice(id, month)) return 'cash';
  return null;
}

/**
 * Startet ein Projekt: neuer Stand und Preis, der beim Start aus der Kasse geht (nicht im Monatsergebnis, 5.16).
 * Ein gesperrtes Projekt zu starten ist ein Fehler. SPEZIFIKATION 6.9.
 */
export function startResearch(
  state: ResearchState,
  id: string,
  rank: number,
  cash: number,
  month: number,
): { readonly state: ResearchState; readonly price: number } {
  const blocker = researchStartBlocker(state, id, rank, cash, month);
  if (blocker !== null) throw new Error(`Forschung ${id} kann nicht starten: ${blocker}`);
  return {
    state: { done: state.done, active: [...state.active, { id, startMonth: month }] },
    price: researchPrice(id, month),
  };
}

/** Monate seit dem Start und erledigter Anteil 0 … 1 (Anzeige). SPEZIFIKATION 6.9. */
export function researchProgress(active: ActiveResearch, month: number): { readonly monthsDone: number; readonly fraction: number } {
  const monthsDone = Math.max(0, month - active.startMonth);
  return { monthsDone, fraction: Math.min(1, monthsDone / researchProject(active.id).months) };
}

/**
 * Zu Beginn des Monats `month`: Projekte mit `month − startMonth ≥ Dauer` werden fertig (wie heute
 * `src/lib/research.ts:312-323`). SPEZIFIKATION 6.9, Reihenfolge 6.15.
 */
export function advanceResearch(state: ResearchState, month: number): { readonly state: ResearchState; readonly completed: readonly string[] } {
  const completed: string[] = [];
  const active: ActiveResearch[] = [];
  for (const a of state.active) {
    if (month - a.startMonth >= researchProject(a.id).months) completed.push(a.id);
    else active.push(a);
  }
  if (completed.length === 0) return { state, completed };
  return { state: { done: [...state.done, ...completed], active }, completed };
}

/** Zahl der fertigen Bonus-Projekte (Klassen zählen nicht; für 6.12). Unbekannte Ids zählen nicht. */
export function completedBonusResearch(completedResearch: readonly string[]): number {
  return [...new Set(completedResearch)].filter((id) => PROJECT_BY_ID.get(id)?.kind === 'bonus').length;
}

/** Prozent mit höchstens einer Nachkommastelle, ohne unnötige Null: 0,015 → „1.5“, 0,03 → „3“. */
function percent(share: number): string {
  return String(Math.round(share * 1000) / 10);
}

const COST_TEXT: Readonly<Record<CostResearchKind, string>> = {
  fuel: 'Fuel bill',
  crew: 'Crew costs',
  fees: 'Airport charges',
  catering: 'Catering',
  maintenance: 'Maintenance programme',
  slots: 'Airport slots',
};

const CLASS_TEXT: Readonly<Record<SizeClass, string>> = {
  commuter: `Commuter aircraft up to ${COMMUTER_MAX_SEATS} seats`,
  regional: `regional aircraft over ${COMMUTER_MAX_SEATS} seats and jets up to ${REGIONAL_JET_MAX_SEATS} seats`,
  narrowbody: `single-aisle jets over ${REGIONAL_JET_MAX_SEATS} seats`,
  widebody: `twin-aisle jets up to ${JUMBO_MIN_SEATS} seats`,
  jumbo: `twin-aisle jets over ${JUMBO_MIN_SEATS} seats`,
  supersonic: `airliners faster than ${SUPERSONIC_MIN_KMH} km/h`,
};

/**
 * Texte der Wirkungen eines Projekts, aus seinen Feldern erzeugt (E52; Oberfläche Englisch). Jeder Text enthält die
 * Zahl aus dem Feld. SPEZIFIKATION 6.9.
 */
export function researchEffectLines(id: string): readonly string[] {
  const project = researchProject(id);
  const e = project.effect;
  const lines: string[] = [];
  if (project.opens !== null) lines.push(`Opens ${CLASS_TEXT[project.opens]}`);
  for (const kind of COST_RESEARCH_KINDS) {
    const value = e.costSaving?.[kind];
    if (value) lines.push(`${COST_TEXT[kind]} ${percent(value)}% lower`);
  }
  const points = (n: number) => `${n} point${n === 1 ? '' : 's'}`;
  if (e.efficiencyPoints) lines.push(`Aircraft efficiency +${points(e.efficiencyPoints)}`);
  if (e.satisfactionPoints) lines.push(`Satisfaction +${e.satisfactionPoints} in every cabin class`);
  if (e.demandFactor) lines.push(`Demand +${percent(e.demandFactor - 1)}% on every route`);
  if (e.hubQualityFactor) lines.push(`Hub quality for connecting passengers +${percent(e.hubQualityFactor - 1)}%`);
  if (e.rampBonus) {
    lines.push(`New routes start at ${percent(RAMP_START + e.rampBonus)}% of their demand instead of ${percent(RAMP_START)}%`);
  }
  if (e.defectSaving) lines.push(`Technical defects ${percent(e.defectSaving)}% less likely`);
  if (e.wearSaving) lines.push(`Cabin and airframe wear ${percent(e.wearSaving)}% slower`);
  if (e.resaleBonus) lines.push(`Resale value +${percent(e.resaleBonus)}%`);
  if (e.moralePoints) lines.push(`Staff morale +${points(e.moralePoints)}`);
  return lines;
}

// ---------------------------------------------------------------------------
// 6.10 Meilensteine
// ---------------------------------------------------------------------------

/** Was die Meilensteine im Abschluss messen (ein Feld je `MilestoneMetric`). SPEZIFIKATION 6.10. */
export type MilestoneContext = Readonly<Record<MilestoneMetric, number>>;

const MILESTONE_BY_ID: ReadonlyMap<string, MilestoneDef> = new Map(MILESTONES.map((m) => [m.id, m]));

/** Meilenstein nach Id; eine unbekannte Id ist ein Fehler. */
export function milestoneDef(id: string): MilestoneDef {
  const def = MILESTONE_BY_ID.get(id);
  if (!def) throw new Error(`Unbekannter Meilenstein ${id}`);
  return def;
}

/** Schwelle im Monat `month`: Kasse über `atCost` (E6, W9), sonst wie in der Tabelle. SPEZIFIKATION 6.10. */
export function milestoneThreshold(def: MilestoneDef, month: number): number {
  return def.metric === 'cash' ? atCost(def.threshold, month) : def.threshold;
}

/**
 * Meilensteine, die im Abschluss des Monats `month` neu erreicht sind (Reihenfolge der Tabelle); jeder höchstens
 * einmal. Ändern weder Ruf noch Rang-Werte (E38). SPEZIFIKATION 6.10.
 *
 * @param earnedIds schon erreichte Meilensteine.
 * @param context Werte am Monatsende: Kasse nach allen Buchungen (R11), Ruf nach der Ruf-Änderung.
 */
export function newMilestones(earnedIds: readonly string[], context: MilestoneContext, month: number): readonly MilestoneDef[] {
  const earned = new Set(earnedIds);
  return MILESTONES.filter((m) => !earned.has(m.id) && context[m.metric] >= milestoneThreshold(m, month));
}

/** Prämie eines Meilensteins im Monat `month`: `atCost(Prämie der Stufe)`; in die Kasse, nicht ins Monatsergebnis. SPEZIFIKATION 6.10. */
export function milestonePrize(def: MilestoneDef, month: number): number {
  return atCost(MILESTONE_TIER_REWARD[def.tier].prize1960, month);
}

/** Summe der Prämien mehrerer Meilensteine im Monat `month`. SPEZIFIKATION 6.10. */
export function milestonePrizeTotal(defs: readonly MilestoneDef[], month: number): number {
  return defs.reduce((sum, m) => sum + milestonePrize(m, month), 0);
}

/**
 * Slot-Nachlass: `1 − min(0,3; Σ Slot-Nachlässe der erreichten Meilensteine)`, 0,7 … 1. Wirkt nur im Slot-Kaufpreis
 * (5.10). Unbekannte Ids zählen nicht. SPEZIFIKATION 6.10.
 */
export function milestoneSlotFactor(earnedIds: readonly string[]): number {
  const discount = [...new Set(earnedIds)].reduce((sum, id) => {
    const def = MILESTONE_BY_ID.get(id);
    return sum + (def ? MILESTONE_TIER_REWARD[def.tier].slotDiscount : 0);
  }, 0);
  return 1 - Math.min(MILESTONE_SLOT_DISCOUNT_MAX, discount);
}

/** Zusätzliche Drehkreuze aus erreichten Meilensteinen (für `hubAllowance`, 6.7). SPEZIFIKATION 6.10. */
export function milestoneHubs(earnedIds: readonly string[]): number {
  return [...new Set(earnedIds)].reduce((sum, id) => sum + (MILESTONE_BY_ID.get(id)?.extraHubs ?? 0), 0);
}

/**
 * Gewinnserie nach dem Monat: Verlust → 0; ohne Strecken unverändert; Monatsergebnis > 0 → +1; sonst unverändert
 * (wie heute `src/lib/monthClose.ts:611`, F37). SPEZIFIKATION 6.10.
 *
 * @param monthResult Monatsergebnis (5.16).
 */
export function nextProfitStreak(streak: number, monthResult: number, routes: number): number {
  if (monthResult < 0) return 0;
  if (routes > 0 && monthResult > 0) return streak + 1;
  return streak;
}

function count(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function defaultMoney(n: number): string {
  return `$${count(n)}`;
}

/**
 * Bedingung eines Meilensteins als Text, aus Metrik und Schwelle erzeugt (E52; „or more“, W12). Beträge im Monat
 * `month`. SPEZIFIKATION 6.10.
 */
export function milestoneRequirementText(def: MilestoneDef, month: number, formatMoney: (n: number) => string = defaultMoney): string {
  const n = milestoneThreshold(def, month);
  switch (def.metric) {
    case 'routes':
      return `${count(n)} route${n === 1 ? '' : 's'} or more`;
    case 'fleet':
      return `${count(n)} aircraft or more in the fleet`;
    case 'careerPax':
      return `${count(n)} passengers or more over the career`;
    case 'regions':
      return `${count(n)} regions or more served`;
    case 'longestRouteKm':
      return `A route of ${count(n)} km or more`;
    case 'cash':
      return `${formatMoney(n)} or more in the bank`;
    case 'profitStreak':
      return `${count(n)} months in a row in profit`;
    case 'reputation':
      return `Reputation ${count(n)} or more`;
    case 'monthTransferPax':
      return `${count(n)} connecting passengers or more in one month`;
    case 'widebodies':
      return 'A wide-body aircraft in the fleet';
    case 'supersonics':
      return 'A supersonic aircraft in the fleet';
    case 'takeovers':
      return n === 1 ? 'A rival airline bought' : `${count(n)} rival airlines bought`;
  }
}

// ---------------------------------------------------------------------------
// 6.11 Jahresziel
// ---------------------------------------------------------------------------

/** Ist `month` ein Dezember (Monat des Angebots und der Messung)? Spielmonat 0 = Januar 1960. */
export function isDecember(month: number): boolean {
  return ((month % 12) + 12) % 12 === 11;
}

/**
 * Bezugsgröße: `max(Vorjahresergebnis, GOAL_MIN_MARGIN × Vorjahreserlös, atCost(GOAL_PROFIT_FLOOR_1960, month))`.
 * Nach einem Verlustjahr zählt die Größe (W10). SPEZIFIKATION 6.11.
 *
 * @param month Monat des Angebots (Dezember).
 */
export function goalBase(lastYearProfit: number, lastYearRevenue: number, month: number): number {
  return Math.max(lastYearProfit, GOAL_MIN_MARGIN * lastYearRevenue, atCost(GOAL_PROFIT_FLOOR_1960, month));
}

/** Prämie: `max(atCost(GOAL_MIN_REWARD_1960), GOAL_REWARD_SHARE[Art] × goalBase)`, ungerundet. SPEZIFIKATION 6.11. */
export function goalReward(tag: GoalTag, base: number, month: number): number {
  return Math.max(atCost(GOAL_MIN_REWARD_1960, month), GOAL_REWARD_SHARE[tag] * base);
}

/** Strafe bei verfehltem Ziel: `GOAL_MISS_PENALTY_SHARE × Prämie` (E58). SPEZIFIKATION 6.11. */
export function goalPenalty(reward: number): number {
  return GOAL_MISS_PENALTY_SHARE * reward;
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

/** Glatte Zahl für ein Gewinnziel (wie heute `niceDollars`, `src/lib/annualGoals.ts:62-66`). Nur einmal beim Angebot (R4). */
export function niceDollars(n: number): number {
  if (n >= 100_000_000) return roundTo(n, 5_000_000);
  if (n >= 10_000_000) return roundTo(n, 1_000_000);
  return roundTo(n, 100_000);
}

/** Art eines Jahresziels. */
export type GoalKind = 'profit' | 'routes' | 'regions' | 'reputation' | 'pax' | 'noLoss';

/** Ein angebotenes oder gewähltes Jahresziel; Ziel, Prämie und Strafe stehen fest (R4). SPEZIFIKATION 6.11. */
export interface AnnualGoal {
  /** Jahr, für das das Ziel gilt. */
  readonly year: number;
  readonly kind: GoalKind;
  readonly tag: GoalTag;
  /** Zu erreichender Wert ($, Anzahl, Ruf-Punkte); bei `noLoss` 0 (Verlustmonate höchstens 0). */
  readonly target: number;
  /** Prämie bei Erfolg, in die Kasse. */
  readonly reward: number;
  /** Strafe beim Verfehlen, aus der Kasse (E58). */
  readonly penalty: number;
}

/** Was das Angebot im Dezember braucht. */
export interface GoalOfferInput {
  /** Jahr, für das die Ziele gelten (das neue Jahr). */
  readonly year: number;
  /** Monat des Angebots (Dezember des alten Jahres), für `atCost`. */
  readonly month: number;
  /** Σ Monatsergebnisse des alten Jahres (5.16). */
  readonly lastYearProfit: number;
  /** Σ Monatserlöse des alten Jahres (4.9). */
  readonly lastYearRevenue: number;
  /** Σ Fluggäste des alten Jahres. */
  readonly lastYearPax: number;
  readonly routes: number;
  readonly regions: number;
  readonly reputation: number;
}

type FocusTarget = { readonly kind: Exclude<GoalKind, 'profit'>; readonly target: number } | null;

const FOCUS_TARGETS: readonly ((c: GoalOfferInput) => FocusTarget)[] = [
  (c) => (c.routes < 1 ? null : { kind: 'routes', target: c.routes + Math.max(GOAL_ROUTES_MIN_STEP, Math.ceil(c.routes * GOAL_ROUTES_SHARE)) }),
  (c) => (c.routes < 1 || c.regions >= WORLD_REGIONS.length ? null : { kind: 'regions', target: c.regions + 1 }),
  (c) => {
    if (c.routes < 1) return null;
    const target = Math.min(GOAL_REPUTATION_MAX, Math.ceil(c.reputation + GOAL_REPUTATION_STEP));
    return target <= c.reputation ? null : { kind: 'reputation', target };
  },
  (c) =>
    c.lastYearPax <= 0
      ? null
      : { kind: 'pax', target: Math.max(GOAL_PAX_MIN, roundTo(c.lastYearPax * GOAL_PAX_FACTOR, c.lastYearPax >= 1_000_000 ? 100_000 : 1_000)) },
  (c) => (c.routes < 1 ? null : { kind: 'noLoss', target: 0 }),
];

/**
 * Die drei Ziele des Dezember-Angebots: sicheres Gewinnziel, Ziel anderer Art (reihum nach Jahreszahl unter den
 * sinnvollen Arten, wie heute `src/lib/annualGoals.ts:115-121`), hohes Gewinnziel. Ohne sinnvolle andere Art nur
 * zwei. SPEZIFIKATION 6.11.
 */
export function annualGoalOffers(input: GoalOfferInput): readonly AnnualGoal[] {
  const base = goalBase(input.lastYearProfit, input.lastYearRevenue, input.month);
  const make = (kind: GoalKind, tag: GoalTag, target: number): AnnualGoal => {
    const reward = goalReward(tag, base, input.month);
    return { year: input.year, kind, tag, target, reward, penalty: goalPenalty(reward) };
  };
  const options = [make('profit', 'steady', niceDollars(GOAL_STEADY_FACTOR * base))];
  const eligible = FOCUS_TARGETS.map((f) => f(input)).filter((f): f is NonNullable<FocusTarget> => f !== null);
  if (eligible.length > 0) {
    const focus = eligible[((input.year % eligible.length) + eligible.length) % eligible.length];
    options.push(make(focus.kind, 'focus', focus.target));
  }
  options.push(make('profit', 'stretch', niceDollars(GOAL_STRETCH_FACTOR * base)));
  return options;
}

/** Das gewählte Ziel; ohne Wahl gilt das sichere (das erste Angebot). SPEZIFIKATION 6.11. */
export function chosenGoal(offers: readonly AnnualGoal[], choice?: number): AnnualGoal {
  const goal = offers[choice ?? 0] ?? offers[0];
  if (!goal) throw new Error('Jahresziel ohne Angebot');
  return goal;
}

/** Monatsbericht, soweit das Jahresziel ihn braucht. */
export interface GoalMonthReport {
  readonly year: number;
  /** Monatsergebnis (5.16). */
  readonly result: number;
  /** Monatserlös (4.9). */
  readonly revenue: number;
  /** Fluggäste des Monats. */
  readonly passengers: number;
}

/** Stand eines Jahres für Messung und Fortschrittsbalken. */
export interface YearSnapshot {
  readonly profit: number;
  readonly revenue: number;
  readonly pax: number;
  /** Monate des Jahres mit Monatsergebnis < 0. */
  readonly lossMonths: number;
  readonly routes: number;
  readonly regions: number;
  readonly reputation: number;
}

/**
 * Stand des Jahres `year`: Gewinn, Erlös, Fluggäste, Verlustmonate aus den Monatsberichten des Jahres; Strecken,
 * Regionen, Ruf wie jetzt (im Dezember nach der Ruf-Änderung). Eine Funktion für Abschluss und Balken (R2).
 * SPEZIFIKATION 6.11.
 */
export function yearSnapshot(
  reports: readonly GoalMonthReport[],
  year: number,
  now: { readonly routes: number; readonly regions: number; readonly reputation: number },
): YearSnapshot {
  let profit = 0;
  let revenue = 0;
  let pax = 0;
  let lossMonths = 0;
  for (const r of reports) {
    if (r.year !== year) continue;
    profit += r.result;
    revenue += r.revenue;
    pax += r.passengers;
    if (r.result < 0) lossMonths++;
  }
  return { profit, revenue, pax, lossMonths, routes: now.routes, regions: now.regions, reputation: now.reputation };
}

/** Der gemessene Wert eines Ziels. SPEZIFIKATION 6.11. */
export function goalValue(goal: AnnualGoal, snapshot: YearSnapshot): number {
  switch (goal.kind) {
    case 'profit':
      return snapshot.profit;
    case 'routes':
      return snapshot.routes;
    case 'regions':
      return snapshot.regions;
    case 'reputation':
      return snapshot.reputation;
    case 'pax':
      return snapshot.pax;
    case 'noLoss':
      return snapshot.lossMonths;
  }
}

/** Ziel erreicht? `noLoss`: kein Verlustmonat; sonst Wert ≥ Ziel. SPEZIFIKATION 6.11. */
export function goalMet(goal: AnnualGoal, snapshot: YearSnapshot): boolean {
  const value = goalValue(goal, snapshot);
  return goal.kind === 'noLoss' ? value <= 0 : value >= goal.target;
}

/** Fortschritt 0 … 1 für den Balken. SPEZIFIKATION 6.11. */
export function goalFraction(goal: AnnualGoal, snapshot: YearSnapshot): number {
  if (goal.kind === 'noLoss') return snapshot.lossMonths <= 0 ? 1 : 0;
  if (goal.target <= 0) return 1;
  return Math.max(0, Math.min(1, goalValue(goal, snapshot) / goal.target));
}

/**
 * Messung im Dezember-Abschluss: erreicht → `+Prämie`, verfehlt → `−Strafe` (E58), jeweils in die Kasse und
 * nicht ins Monatsergebnis; kein Ruf (E38). SPEZIFIKATION 6.11.
 */
export function settleGoal(goal: AnnualGoal, snapshot: YearSnapshot): { readonly met: boolean; readonly cash: number; readonly achieved: number } {
  const met = goalMet(goal, snapshot);
  return { met, cash: met ? goal.reward : -goal.penalty, achieved: goalValue(goal, snapshot) };
}

// ---------------------------------------------------------------------------
// 6.12 Karriere-Punkte und Ruhmeshallen
// ---------------------------------------------------------------------------

/** Teile des Unternehmenswerts (E48). */
export interface CompanyValueInput {
  readonly cash: number;
  /** `aircraftValue` (5.13) jedes eigenen Flugzeugs. */
  readonly aircraftValues: readonly number[];
  /** Σ Verkaufswert der eigenen Slots (5.10). */
  readonly slotResaleValue: number;
  /** Σ Anzahlungen auf Vorbestellungen (8.12); KI 0. */
  readonly preorderDeposits?: number;
}

/**
 * Unternehmenswert: Kasse + Σ Flugzeugwerte + Verkaufswert der Slots + Anzahlungen. Derselbe Wert für Karriere
 * (6.12) und Übernahme (7.16, E48). SPEZIFIKATION 6.12.
 */
export function companyValue(input: CompanyValueInput): number {
  return input.cash + input.aircraftValues.reduce((sum, v) => sum + v, 0) + input.slotResaleValue + (input.preorderDeposits ?? 0);
}

/** Eingaben der Karriere-Punkte beim Ruhestand. */
export interface CareerInput {
  /** `companyValue` beim Ruhestand. */
  readonly companyValue: number;
  /** Monat des Ruhestands (für `atCost`). */
  readonly month: number;
  readonly rank: number;
  readonly mode: GameMode;
  /** Zahl der erreichten Meilensteine. */
  readonly milestones: number;
  readonly reputation: number;
  readonly takeovers: number;
  /** Zahl der fertigen Bonus-Projekte (`completedBonusResearch`). */
  readonly bonusResearch: number;
  /** Gespielte Jahre (auch gebrochen; es zählen volle). */
  readonly years: number;
}

/** Karriere-Punkte nach Teilen, ungerundet (Anzeige ganze Punkte). */
export interface CareerScore {
  readonly wealth: number;
  readonly rank: number;
  readonly milestones: number;
  readonly reputation: number;
  readonly takeovers: number;
  readonly research: number;
  readonly years: number;
  readonly total: number;
}

/**
 * Karriere-Punkte (E43): Vermögen `150 × log10(max(1, companyValue / atCost(1 Mio. $)))`, Rang 80 je Stufe (nur
 * Normal), 10 je Meilenstein, 2 je Ruf-Punkt, 25 je Übernahme, 5 je Bonus-Projekt, 5 je volles Jahr (höchstens 60).
 * SPEZIFIKATION 6.12.
 */
export function careerScore(input: CareerInput): CareerScore {
  const wealth = CAREER_WEALTH_POINTS * Math.log10(Math.max(1, input.companyValue / atCost(CAREER_WEALTH_UNIT_1960, input.month)));
  const rank = input.mode === 'free' ? 0 : CAREER_RANK_POINTS * Math.max(0, input.rank);
  const milestones = CAREER_MILESTONE_POINTS * Math.max(0, input.milestones);
  const reputation = CAREER_REPUTATION_POINTS * clampScale('reputation', input.reputation);
  const takeovers = CAREER_TAKEOVER_POINTS * Math.max(0, input.takeovers);
  const research = CAREER_RESEARCH_POINTS * Math.max(0, input.bonusResearch);
  const years = CAREER_YEAR_POINTS * Math.min(CAREER_MAX_YEARS, Math.max(0, Math.floor(input.years)));
  return {
    wealth,
    rank,
    milestones,
    reputation,
    takeovers,
    research,
    years,
    total: wealth + rank + milestones + reputation + takeovers + research + years,
  };
}

/** Ein Eintrag der Ruhmeshalle. Ohne `mode` gehört er zu Normal (wie heute `src/lib/careerScore.ts:98`). */
export interface HallEntry {
  readonly id: string;
  readonly airline: string;
  readonly score: number;
  /** ISO-Datum des Eintrags; bei gleichen Punkten steht der frühere vorn. */
  readonly filed: string;
  readonly mode?: GameMode;
}

/** Zwei Ruhmeshallen (E43): Normal und Free Mode, je höchstens `HALL_SIZE` Einträge, beste zuerst. */
export interface HallsOfFame<E extends HallEntry = HallEntry> {
  readonly normal: readonly E[];
  readonly free: readonly E[];
}

function sortHall<E extends HallEntry>(entries: readonly E[]): E[] {
  return [...entries].sort((a, b) => b.score - a.score || a.filed.localeCompare(b.filed)).slice(0, HALL_SIZE);
}

/**
 * Trägt eine Laufbahn in die Halle ihrer Spielart ein; dieselbe Laufbahn (Id) steht nur einmal darin. Ein
 * Free-Eintrag erscheint nie in der Normal-Halle. SPEZIFIKATION 6.12.
 */
export function fileCareer<E extends HallEntry>(halls: HallsOfFame<E>, entry: E): HallsOfFame<E> {
  const key = entry.mode === 'free' ? 'free' : 'normal';
  const updated = sortHall([...halls[key].filter((e) => e.id !== entry.id), entry]);
  return key === 'free' ? { normal: halls.normal, free: updated } : { normal: updated, free: halls.free };
}

/** Teilt eine alte, gemeinsame Halle nach `mode` in zwei (für Phase 5.1). SPEZIFIKATION 6.12, 6.15. */
export function splitHall<E extends HallEntry>(entries: readonly E[]): HallsOfFame<E> {
  return {
    normal: sortHall(entries.filter((e) => e.mode !== 'free')),
    free: sortHall(entries.filter((e) => e.mode === 'free')),
  };
}
