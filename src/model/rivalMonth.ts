/**
 * Konkurrenz Teil b: SPEZIFIKATION 7.8–7.17 (Paket 3.7b); Entscheidungen im Monatsabschluss `rivalDecisions` und
 * Übernahme im Spielstand `takeOverCompany` (Paket 3.8c); Eröffnungen, Wachstum, Slots, Schalter, Lounge, Fahrpläne,
 * Kabinen-Erneuerung, Gründung und Nachrücken `rivalRefill` im Abschluss (Paket 3.8d).
 *
 * 7.8 Monat der KI (Ablauf, geglätteter Gewinn, Verlierer, Feinabstimmung), 7.9 Planung einer Strecke,
 * 7.10 Slots, Schalter, Drehkreuze, Lounge und Sperre durch Spieler-Stufe 3 (E63), 7.11 Flotte, 7.12 Krise,
 * 7.13 Größe, neues Drehkreuz, Dividende, 7.14 Zuschuss, 7.15 Notlage, 7.16 Übernahme, 7.17 Ticker und Meldungen.
 *
 * Wie in `rivals.ts` gilt E44: Hier stehen nur **Entscheidungen** der KI. Gerechnet wird mit denselben Funktionen
 * wie beim Spieler; Zahlen aus dem Modell (Planer-Hauptzahl, Preise, Kosten, Verkaufserlös) bekommt jede Funktion
 * als Zahl oder als Rückruf vom Aufrufer (3.8). Zufall nur über `rng` (8.3): Die Funktionen bekommen Zufallszahlen
 * in [0, 1) als `u`. Das Modell kennt den Spielstand nicht (F14).
 */

import { atCost, clamp, yearOf } from './basics';
import { subsidy1960, subsidyIncome } from './costTotals';
import { departuresOnPair, facilityPrice, managementTierPrice, slotLimit, slotPrice, slotResalePrice } from './airportCosts';
import { fuelTable } from './costs';
import { creditLimit, overhaulQuote, refitCabinCondition, refitPrice, saleCandidate, saleProceeds } from './fleetMarket';
import { blockMinutes, citySize, distanceKm, eventDemandFactor, type DemandEvent } from './demand';
import { bestFareRatio, breakEvenFareLevel, marketFares, type BreakEvenClass, type PartialClassFigures } from './fare';
import { aircraftValue, newAircraftPrice } from './fleet';
import { activeWorldEvents } from './monthEvents';
import {
  fleetValue,
  newLedger,
  plannerRouteFigures,
  plannerRouteResult,
  routeClassPassengersCurve,
  type AfterClose,
  type AircraftState,
  type CatalogType,
  type CloseNews,
  type CompanyDecisions,
  type CompanyState,
  type DecisionContext,
  type DecisionOutcome,
  type HoldingState,
  type ModelAirport,
  type ModelState,
  type ResoldPlane,
  type RouteSchedule,
  type RouteState,
} from './monthClose';
import { REAL_AIRLINES } from '../data/rivalAirlines';
import { companyValue, hasUnlock, researchEffects, type CompanyValueInput } from './progress';
import { deskCapacity, satisfactionFactor } from './satisfaction';
import { rng } from './rng';
import {
  fictionalHubWeights,
  fictionalRivalCount,
  isOnMarket,
  longHaulFactor,
  mayFoundAt,
  pickStartAircraft,
  realRivalWeight,
  RIVAL_INPUTS,
  rivalAircraft,
  rivalBuyChance,
  rivalDeskType,
  rivalService,
  rivalStartCash,
  rivalStartSetup,
  shouldRefill,
  startFleetKinds,
  type HubCandidate,
  nextYieldPosition,
  priceWarStep,
  rivalCashReserve,
  rivalFareRatio,
  rivalPatience,
  rivalTargetFareRatio,
  targetWeight,
  weightedPick,
  type PriceWarState,
} from './rivals';
import {
  AVG_PROFIT_KEEP,
  CORE_NETWORK,
  CRISIS_FROM,
  CRISIS_FUEL_WEIGHT,
  CRISIS_FUEL_WINDOW,
  CRISIS_FULL_LOAD,
  CRISIS_IDLE_MONTHS,
  CRISIS_RECOVERY_STEP,
  CRISIS_TARGET_LOAD,
  DESK_OVERLOAD_FROM,
  DISTRESS_TO_SALE_MONTHS,
  DIVIDEND_COST_WINDOW,
  DIVIDEND_FLOOR_1960,
  DIVIDEND_RESERVE_MONTHS,
  FINE_TUNE_MIN_GAIN,
  FINE_TUNE_MIN_ROUTE_AGE,
  FINE_TUNE_STEP_SHARE,
  HOME_REGION_WEIGHT,
  LOUNGE_CASH_COVER,
  MAX_IDLE_MONTHS,
  MAX_WEEKLY_ROTATIONS,
  MIN_ROUTE_KM,
  MODERNIZE_AFTER_END_MONTHS,
  MODERNIZE_AGE_YEARS,
  NEW_HUB_CHANCE,
  NEW_HUB_MIN_LEVEL,
  NEW_HUB_MIN_SEATS,
  NEW_HUB_NO_PROFIT_MONTHS,
  NEW_HUB_SLOT_USE,
  NO_PROFIT_PRICE_CASH_SHARE,
  PERSONALITIES,
  PLAN_FREQUENCY_SHARES,
  PLAYER_HUB_AGGRESSION_PIVOT,
  PLAYER_HUB_WEIGHT,
  PRESELECT_CROWDING_DEPARTURES,
  PRESELECT_RIVAL_HUB_WEIGHT,
  PRESELECT_RANGE_SHARE,
  RIVAL_HUB_TIER,
  RIVAL_OVERHAUL_BELOW,
  RIVAL_RANDOM_TARGETS,
  RIVAL_SLOT_IDLE_MONTHS,
  RIVAL_SLOT_SHARE_HUB,
  RIVAL_SLOT_SHARE_OTHER,
  RIVAL_STRENGTH,
  RIVAL_SUBSIDY_ENABLED,
  SALE_TO_LIQUIDATION_MONTHS,
  TAKEOVER_MIN_PRICE_1960,
  TAKEOVER_MIN_TIER,
  THIN_SHARE,
  WEEKLY_OPERATING_MINUTES,
  WORLD_REGIONS,
  CABIN_CLASSES,
  AIRCRAFT_CLASSES,
  WEEKS_PER_MONTH,
  MINUTES_PER_WEEK,
  PROFIT_LOOKBACK_MONTHS,
  RAMP_MONTHS,
  RIVAL_FIRST_DEPARTURE_MINUTE,
  RIVAL_TURN_MINUTES,
  MAX_MANAGEMENT_TIER,
  SCALES,
  type AircraftClass,
  type CabinClass,
  type DeskType,
  type RivalPersonality,
  type RivalStrength,
  type WorldRegion,
} from './constants';

// ---------------------------------------------------------------------------
// 7.8 Monat der KI
// ---------------------------------------------------------------------------

/**
 * Geglätteter Gewinn einer Strecke: `0,65 × alt + 0,35 × routeResult` (Monatswert, 5.9). Eine neue Strecke beginnt
 * mit dem ersten Monatswert (`previous` fehlt). SPEZIFIKATION 7.8.
 */
export function smoothedProfit(previous: number | undefined, monthResult: number): number {
  if (previous === undefined) return monthResult;
  return AVG_PROFIT_KEEP * previous + (1 - AVG_PROFIT_KEEP) * monthResult;
}

/** Eine KI-Strecke, wie die Entscheidungen sie sehen. */
export interface RivalRouteView {
  readonly id: string;
  /** Umläufe je Woche (= Abflüge je Woche an jedem Ende). */
  readonly weeklyFrequency: number;
  /** Alter der Strecke in Monaten. */
  readonly ageMonths: number;
  /** Geglätteter Gewinn (`smoothedProfit`). */
  readonly avgProfit: number;
}

/**
 * Planer-Hauptzahl (4.12) einer bestehenden Strecke mit einer anderen Zahl an Umläufen: erwarteter Gewinn je Monat
 * mit allen Angeboten des Markts. Rechnet der Aufrufer mit dem Modell (dieselbe Zahl wie im Planer, 7.9).
 */
export type ExpectedProfitAt = (routeId: string, weeklyFrequency: number) => number;

/** Was mit einer Verlierer-Strecke geschieht. */
export interface LoserDecision {
  readonly routeId: string;
  readonly action: 'thin' | 'close';
  /** Neue Umläufe je Woche (`thin`) oder 0 (`close`). */
  readonly weeklyFrequency: number;
}

/** Ausgedünnter Plan einer Verlierer-Strecke: `max(1, runden(THIN_SHARE × Umläufe))`. SPEZIFIKATION 7.8. */
export function thinnedFrequency(weeklyFrequency: number): number {
  return Math.max(1, Math.round(weeklyFrequency * THIN_SHARE));
}

/**
 * Verlierer (7.8 Schritt 3): Strecken mit geglättetem Gewinn < 0, die mindestens die Geduld (7.4) alt sind; die
 * schlechtesten zuerst, je Monat so viele wie die KI-Stärke erlaubt (Easy/Normal 1, Hard 2). Je Strecke erst auf
 * `THIN_SHARE` der Flüge, wenn das nach der Planer-Hauptzahl Gewinn bringt; sonst streichen, solange mehr als
 * `CORE_NETWORK` Strecken bleiben. Steht das Kernnetz, endet die Liste (wie heute `:970`). SPEZIFIKATION 7.8.
 */
export function loserDecisions(
  routes: readonly RivalRouteView[],
  personality: RivalPersonality,
  strength: RivalStrength,
  expectedProfitAt: ExpectedProfitAt,
): LoserDecision[] {
  const patience = rivalPatience(personality);
  const losers = routes
    .filter((r) => r.ageMonths >= patience && r.avgProfit < 0)
    .sort((a, b) => a.avgProfit - b.avgProfit)
    .slice(0, RIVAL_STRENGTH[strength].actionsPerMonth);
  const decisions: LoserDecision[] = [];
  let remaining = routes.length;
  for (const r of losers) {
    const thin = thinnedFrequency(r.weeklyFrequency);
    if (thin < r.weeklyFrequency && expectedProfitAt(r.id, thin) > 0) {
      decisions.push({ routeId: r.id, action: 'thin', weeklyFrequency: thin });
      continue;
    }
    if (remaining <= CORE_NETWORK) break;
    decisions.push({ routeId: r.id, action: 'close', weeklyFrequency: 0 });
    remaining--;
  }
  return decisions;
}

/** Findet in diesem Monat eine Feinabstimmung statt? Easy nie, Normal mit 0,5, Hard immer (7.3). SPEZIFIKATION 7.8. */
export function fineTuneThisMonth(strength: RivalStrength, u: number): boolean {
  return u < RIVAL_STRENGTH[strength].fineTuneChance;
}

/** Eingaben der Feinabstimmung einer Strecke. */
export interface FineTuneInput {
  readonly route: RivalRouteView;
  /** Höchste Umläufe des Flugzeugs auf der Strecke (7.9). */
  readonly maxRotations: number;
  /** So viele Slots kann die KI an der engeren Seite noch belegen (eigene freie + kaufbare, 7.10). */
  readonly slotRoom: number;
  /** Ist die Strecke noch vom Krisen-Fahrplan gekürzt? Dann baut 7.12 sie wieder auf, nicht die Feinabstimmung. */
  readonly crisisReduced: boolean;
}

/**
 * Feinabstimmung einer Strecke (7.8 Schritt 4, wie heute `:982-1001`): Schritt `max(1, runden(25 % der Flüge))`;
 * bei geglättetem Gewinn ≥ 0 mehr Flüge (höchstens bis zu den höchsten Umläufen und nur so viele, wie Slots frei
 * sind), sonst weniger (mindestens 1). Behalten, wenn die Planer-Hauptzahl um mehr als `FINE_TUNE_MIN_GAIN` ihres
 * Betrags steigt. Ohne Änderung (zu jung, gekürzt, kein Platz, kein Gewinn) `null`. SPEZIFIKATION 7.8.
 *
 * @returns die neuen Umläufe je Woche, oder `null` für „bleibt“.
 */
export function fineTune(input: FineTuneInput, expectedProfitAt: ExpectedProfitAt): number | null {
  const r = input.route;
  if (r.ageMonths < FINE_TUNE_MIN_ROUTE_AGE || input.crisisReduced) return null;
  const step = Math.max(1, Math.round(r.weeklyFrequency * FINE_TUNE_STEP_SHARE));
  const alt =
    r.avgProfit >= 0
      ? Math.min(input.maxRotations, r.weeklyFrequency + Math.min(step, Math.max(0, input.slotRoom)))
      : Math.max(1, r.weeklyFrequency - step);
  if (alt === r.weeklyFrequency) return null;
  const now = expectedProfitAt(r.id, r.weeklyFrequency);
  const then = expectedProfitAt(r.id, alt);
  return then > now + Math.abs(now) * FINE_TUNE_MIN_GAIN ? alt : null;
}

// ---------------------------------------------------------------------------
// 7.9 Planung einer Strecke
// ---------------------------------------------------------------------------

/** Ein mögliches Ziel für ein freies Flugzeug, vom Drehkreuz aus. */
export interface TargetCandidate {
  readonly id: string;
  /** Entfernung Drehkreuz–Ziel in km. */
  readonly km: number;
  /** Geschäfts- und Tourismus-Stärke des Ziels (wie heute `getAirportStats`). */
  readonly business: number;
  readonly tourism: number;
  /** Abflüge je Woche anderer Gesellschaften auf dem Paar. */
  readonly otherDepartures: number;
  /** Ist das Ziel Drehkreuz einer anderen KI (E66)? Dann zählt es × `PRESELECT_RIVAL_HUB_WEIGHT` statt geteilt. */
  readonly otherRivalHub?: boolean;
  /** Passt die Piste für das Flugzeug? */
  readonly runwayOk: boolean;
  /** Freie Slots an beiden Enden (7.10: `rivalSlotRoom` > 0 an beiden Enden)? */
  readonly slotsFree: boolean;
  /** Hat der Spieler an einem der beiden Enden Verwaltungsstufe 3 (E63)? */
  readonly playerTier3: boolean;
  /** Bedient die KI das Paar schon? */
  readonly served: boolean;
}

/** Was die Vorauswahl über Drehkreuz und Flugzeug weiß. */
export interface PreselectContext {
  readonly personality: RivalPersonality;
  readonly strength: RivalStrength;
  /** Geschäfts- und Tourismus-Stärke des Drehkreuzes. */
  readonly hubBusiness: number;
  readonly hubTourism: number;
  /** Reichweite des Flugzeugs in km. */
  readonly rangeKm: number;
}

/**
 * Darf das Ziel in die Vorauswahl: in Reichweite, ab `MIN_ROUTE_KM`, passende Piste, freie Slots an beiden Enden,
 * nicht mit Spieler-Stufe 3 an einem Ende (E63), nicht schon bedient. SPEZIFIKATION 7.9, 7.10.
 */
export function isEligibleTarget(target: TargetCandidate, rangeKm: number): boolean {
  return (
    target.km >= MIN_ROUTE_KM &&
    target.km <= rangeKm &&
    target.runwayOk &&
    target.slotsFree &&
    !target.playerTier3 &&
    !target.served
  );
}

/**
 * Wert eines Ziels in der Vorauswahl (billig, ohne Modell-Rechnung; wie heute `:503-521`):
 * `√(Gewicht(Drehkreuz) × Gewicht(Ziel)) × min(1, km / (0,2 × Reichweite)) × Langstrecken-Faktor × Andrang`.
 * Andrang = `1 / (1 + Abflüge anderer / 14)`; ist das Ziel Drehkreuz einer anderen KI, stattdessen
 * `PRESELECT_RIVAL_HUB_WEIGHT` (E66). Nicht erlaubte Ziele 0. SPEZIFIKATION 7.9.
 */
export function preselectScore(target: TargetCandidate, ctx: PreselectContext): number {
  if (!isEligibleTarget(target, ctx.rangeKm)) return 0;
  const hub = targetWeight(ctx.personality, ctx.hubBusiness, ctx.hubTourism);
  const dest = targetWeight(ctx.personality, target.business, target.tourism);
  const crowding = target.otherRivalHub
    ? PRESELECT_RIVAL_HUB_WEIGHT
    : 1 / (1 + target.otherDepartures / PRESELECT_CROWDING_DEPARTURES);
  return (
    Math.sqrt(Math.max(0, hub * dest)) *
    Math.min(1, target.km / (PRESELECT_RANGE_SHARE * ctx.rangeKm)) *
    longHaulFactor(ctx.personality, target.km) *
    crowding
  );
}

/**
 * Vorauswahl: die besten `Suchbreite` Ziele (7.3) nach `preselectScore`, dazu `RIVAL_RANDOM_TARGETS` zufällige aus
 * dem Rest (gleich gewichtet). Nur Ziele mit Wert > 0. SPEZIFIKATION 7.9.
 *
 * @param u Zufallszahlen in [0, 1) für die zufälligen Ziele (die k-te Zahl für das k-te).
 * @returns Indizes in `targets`, beste zuerst, dann die zufälligen.
 */
export function preselectTargets(
  targets: readonly TargetCandidate[],
  ctx: PreselectContext,
  u: (k: number) => number,
): number[] {
  const ranked = targets
    .map((t, i) => ({ i, score: preselectScore(t, ctx) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const width = RIVAL_STRENGTH[ctx.strength].searchWidth;
  const chosen = ranked.slice(0, width).map((x) => x.i);
  const rest = ranked.slice(width).map((x) => x.i);
  for (let k = 0; k < RIVAL_RANDOM_TARGETS && rest.length > 0; k++) {
    const pick = weightedPick(rest.map(() => 1), u(k));
    chosen.push(rest[pick]);
    rest.splice(pick, 1);
  }
  return chosen;
}

/**
 * Höchste Umläufe je Woche eines Flugzeugs, bis die Planer-Funktion für machbare Flüge (E51) steht:
 * `abrunden(7 × 18 h / Blockzeit eines Umlaufs)`, 1 … 21 (wie heute `:105-108`, `:281-285`). SPEZIFIKATION 7.9.
 *
 * @param roundTripBlockMinutes Blockzeit hin und zurück mit Bodenzeiten, Minuten.
 */
export function maxWeeklyRotations(roundTripBlockMinutes: number): number {
  if (!(roundTripBlockMinutes > 0)) throw new Error(`Ungültige Blockzeit: ${roundTripBlockMinutes}`);
  return clamp(Math.floor(WEEKLY_OPERATING_MINUTES / roundTripBlockMinutes), 1, MAX_WEEKLY_ROTATIONS);
}

/** Bewertete Flugzahlen je Ziel: 100 %, 60 %, 30 % der höchsten Umläufe, gerundet, mindestens 1, ohne doppelte. SPEZIFIKATION 7.9. */
export function planFrequencies(maxRotations: number): number[] {
  const out: number[] = [];
  for (const share of PLAN_FREQUENCY_SHARES) {
    const f = Math.max(1, Math.round(maxRotations * share));
    if (!out.includes(f)) out.push(f);
  }
  return out;
}

/** Erwarteter Gewinn mit Schätzfehler der KI-Stärke: `Gewinn × (1 + Fehler × noise)`, `noise` in [−1, 1]. SPEZIFIKATION 7.9. */
export function forecastWithNoise(expectedProfit: number, strength: RivalStrength, noise: number): number {
  return expectedProfit * (1 + RIVAL_STRENGTH[strength].forecastNoise * noise);
}

/** Ein bewerteter Plan: Ziel und Umläufe mit der Planer-Hauptzahl (4.12) und dem Wert mit Schätzfehler. */
export interface RoutePlan {
  readonly targetIndex: number;
  readonly weeklyFrequency: number;
  /** Planer-Hauptzahl: erwarteter Gewinn je Monat (dieselbe Zahl wie im Planer). */
  readonly expectedProfit: number;
  /** `forecastWithNoise(expectedProfit)`: danach wählt die KI. */
  readonly forecast: number;
}

/**
 * Planung einer Strecke (7.9): je vorausgewähltem Ziel die Flugzahlen aus `planFrequencies` mit der
 * Planer-Hauptzahl bewerten (Rückruf des Aufrufers, alle Angebote des Markts, Anlauf 1, `fareRatio` einer neuen
 * Strecke), Schätzfehler dazu; der beste Wert gewinnt. Hard (Fehler 0) wählt so immer den höchsten erwarteten
 * Gewinn. `null`, wenn kein Ziel bewertet wurde. SPEZIFIKATION 7.9.
 *
 * @param expectedProfit Planer-Hauptzahl für Ziel (Index in den Kandidaten) und Umläufe.
 * @param noise Zufallszahl in [−1, 1] je Plan (k = laufende Nummer).
 */
export function rivalPlanRoute(
  targetIndices: readonly number[],
  maxRotations: (targetIndex: number) => number,
  expectedProfit: (targetIndex: number, weeklyFrequency: number) => number,
  strength: RivalStrength,
  noise: (k: number) => number,
): RoutePlan | null {
  let best: RoutePlan | null = null;
  let k = 0;
  for (const targetIndex of targetIndices) {
    for (const weeklyFrequency of planFrequencies(maxRotations(targetIndex))) {
      const profit = expectedProfit(targetIndex, weeklyFrequency);
      const plan = { targetIndex, weeklyFrequency, expectedProfit: profit, forecast: forecastWithNoise(profit, strength, noise(k++)) };
      if (best === null || plan.forecast > best.forecast) best = plan;
    }
  }
  return best;
}

/**
 * Eröffnet die KI den besten Plan? Nur mit erwartetem Gewinn > 0 (nach Schätzfehler); Easy auch ohne Gewinn mit
 * `openWithoutProfitChance` (jeder 2. Versuch, F38). Dazu muss die Kasse die fehlenden Slots und die Reserve decken
 * (keine Pauschale mehr). SPEZIFIKATION 7.9.
 */
export function mayOpenRoute(
  plan: RoutePlan,
  strength: RivalStrength,
  u: number,
  cash: number,
  slotCost: number,
  reserve: number,
): boolean {
  const wanted = plan.forecast > 0 || u < RIVAL_STRENGTH[strength].openWithoutProfitChance;
  return wanted && cash >= slotCost + reserve;
}

// ---------------------------------------------------------------------------
// 7.10 Slots, Schalter, Drehkreuze und Einrichtungen
// ---------------------------------------------------------------------------

/**
 * Höchstzahl Slots einer KI an einem Flughafen: `abrunden(Anteil × slotLimit)`, Anteil 0,25 am eigenen Drehkreuz,
 * sonst 0,10. SPEZIFIKATION 7.10.
 */
export function rivalSlotCap(airportSize: number, ownHub: boolean): number {
  return Math.floor((ownHub ? RIVAL_SLOT_SHARE_HUB : RIVAL_SLOT_SHARE_OTHER) * slotLimit(airportSize));
}

/** Slot-Stand einer KI an einem Flughafen. */
export interface RivalSlotState {
  /** Flughafen-Größe 1 … 5. */
  readonly airportSize: number;
  readonly ownHub: boolean;
  /** Gekaufte Slots dieser KI. */
  readonly owned: number;
  /** Davon belegt (Abflüge je Woche dort). */
  readonly used: number;
  /** Gekaufte Slots **aller** Gesellschaften dort, diese KI eingeschlossen. */
  readonly ownedByAll: number;
}

/**
 * Wie viele Slots die KI hier noch belegen kann: eigene freie + kaufbare. Kaufbar ist, was die Grenze des
 * Flughafens (alle Gesellschaften, E50) und der eigene Anteil (`rivalSlotCap`) noch zulassen. SPEZIFIKATION 7.10.
 */
export function rivalSlotRoom(s: RivalSlotState): number {
  const buyable = Math.max(0, Math.min(slotLimit(s.airportSize) - s.ownedByAll, rivalSlotCap(s.airportSize, s.ownHub) - s.owned));
  return Math.max(0, s.owned - s.used) + buyable;
}

/**
 * Slots, die die KI für `extra` zusätzliche Abflüge je Woche kaufen muss: was die eigenen freien nicht decken.
 * `null`, wenn Grenze oder Anteil das nicht zulassen. SPEZIFIKATION 7.10.
 */
export function rivalSlotsToBuy(s: RivalSlotState, extra: number): number | null {
  if (extra > rivalSlotRoom(s)) return null;
  return Math.max(0, extra - Math.max(0, s.owned - s.used));
}

/** Kaufpreis fehlender Slots an beiden Enden (5.10; die KI ohne Forschung und Meilensteine, 7.2). SPEZIFIKATION 7.10. */
export function rivalSlotCost(missingA: number, missingB: number, cls: AircraftClass, month: number): number {
  return (missingA + missingB) * slotPrice(cls, month);
}

/**
 * Freie Slots zum Verkauf: die kleinste Zahl freier Slots der letzten `RIVAL_SLOT_IDLE_MONTHS` Monate (so viele
 * waren die ganze Zeit frei); mit kürzerer Geschichte 0. SPEZIFIKATION 7.10.
 *
 * @param freeHistory freie Slots (gekauft − belegt) je Monat, ältester zuerst.
 */
export function idleSlotsToSell(freeHistory: readonly number[]): number {
  if (freeHistory.length < RIVAL_SLOT_IDLE_MONTHS) return 0;
  return Math.max(0, Math.min(...freeHistory.slice(-RIVAL_SLOT_IDLE_MONTHS)));
}

/**
 * Schalter, die die KI an einem Flughafen hält: so viele ihrer Art, dass `deskLoad ≤ DESK_OVERLOAD_FROM` (keine
 * Überlast, 2.6.3); mit eigenen Abflügen mindestens einer (E55), sonst keiner. SPEZIFIKATION 7.10.
 *
 * @param departingSeatsPerWeek Σ Sitze aller eigenen Abflüge von diesem Flughafen je Woche.
 */
export function rivalDesksNeeded(departingSeatsPerWeek: number, deskType: DeskType): number {
  if (departingSeatsPerWeek <= 0) return 0;
  const one = deskCapacity({ normal: deskType === 'normal' ? 1 : 0, self: deskType === 'self' ? 1 : 0 });
  return Math.max(1, Math.ceil(departingSeatsPerWeek / (DESK_OVERLOAD_FROM * one)));
}

/** Verwaltungsstufe der KI an einem Flughafen: 2 an eigenen Drehkreuzen, sonst 0; nie 3 (E63). SPEZIFIKATION 7.10. */
export function rivalManagementTier(ownHub: boolean): number {
  return ownHub ? RIVAL_HUB_TIER : 0;
}

/**
 * Sperre durch den Spieler (E63): An einem Flughafen mit Spieler-Stufe 3 eröffnet die KI keine neue Strecke (an
 * keinem Ende) und kein Drehkreuz. Bestehende Strecken und Drehkreuze bleiben, mehr Flüge auf ihnen auch.
 * SPEZIFIKATION 7.10.
 */
export function rivalMayOpenAt(playerTier3: boolean): boolean {
  return !playerTier3;
}

/** Darf eine KI eine neue Strecke zwischen A und B eröffnen: an keinem Ende Spieler-Stufe 3 (E63). SPEZIFIKATION 7.10. */
export function rivalMayOpenRouteBetween(playerTier3A: boolean, playerTier3B: boolean): boolean {
  return rivalMayOpenAt(playerTier3A) && rivalMayOpenAt(playerTier3B);
}

/**
 * Baut die KI an einem eigenen Drehkreuz eine VIP-Lounge: nur Flag und Boutique, noch keine dort, Business- oder
 * First-Sitze ab dort, Kasse ≥ 3 × Preis (5.11). SPEZIFIKATION 7.10.
 */
export function rivalBuildsLounge(
  personality: RivalPersonality,
  hasLounge: boolean,
  premiumSeatsFromHub: boolean,
  cash: number,
  month: number,
): boolean {
  return (
    PERSONALITIES[personality].buildsLounge &&
    !hasLounge &&
    premiumSeatsFromHub &&
    cash >= LOUNGE_CASH_COVER * facilityPrice('vipLounge', month)
  );
}

// ---------------------------------------------------------------------------
// 7.11 Flotte der KI
// ---------------------------------------------------------------------------

/** Warum eine KI kein Flugzeug kauft (Texte in Phase 4). */
export type RivalBuyBlocker =
  | 'aircraftIdle'
  | 'growthStop'
  | 'noRoute'
  | 'notThisMonth'
  | 'cashShare'
  | 'reserve'
  | 'noRecentProfit';

/** Eingaben der Kauf-Entscheidung. */
export interface RivalBuyInput {
  readonly personality: RivalPersonality;
  readonly strength: RivalStrength;
  readonly month: number;
  readonly cash: number;
  /** Fliegen alle Flugzeuge (keines ohne Strecke)? */
  readonly allFlying: boolean;
  /** Wachstumsstopp aus der Krise (`growthStopped`). */
  readonly growthStop: boolean;
  /** Wurde eine Strecke mit freien Slots gefunden (7.9)? */
  readonly routeFound: boolean;
  /** Kaufpreis nach dem Wertmodell mit Kabine (`newAircraftPrice`, 5.13; E54). */
  readonly price: number;
  /** Kaufpreis der fehlenden Slots für die Strecke (`rivalSlotCost`). */
  readonly slotCost: number;
  /** Gab es in den letzten `PROFIT_LOOKBACK_MONTHS` Monaten ein Monatsergebnis > 0? */
  readonly recentProfit: boolean;
  /** Zufallszahl in [0, 1) gegen die Kaufneigung. */
  readonly u: number;
  /** Kaufneigung `rivalBuyChance` (7.3 × 7.4). */
  readonly buyChance: number;
}

/**
 * Kauft die KI diesen Monat ein Flugzeug (7.11)? Alle Flugzeuge fliegen, kein Wachstumsstopp, eine Strecke mit
 * freien Slots gefunden, Zufall unter der Kaufneigung, Preis ≤ Anteil der Kasse (7.4), Preis + Slots ≤ Kasse −
 * Reserve; ohne Gewinn in den letzten 3 Monaten nur bei Preis ≤ Kasse / 3. Ergebnis: `null` = kaufen, sonst der
 * erste Grund dagegen. SPEZIFIKATION 7.11.
 */
export function rivalBuyBlocker(input: RivalBuyInput): RivalBuyBlocker | null {
  if (!input.allFlying) return 'aircraftIdle';
  if (input.growthStop) return 'growthStop';
  if (!input.routeFound) return 'noRoute';
  if (!(input.u < input.buyChance)) return 'notThisMonth';
  if (input.price > PERSONALITIES[input.personality].purchaseCashShare * input.cash) return 'cashShare';
  if (input.price + input.slotCost > input.cash - rivalCashReserve(input.personality, input.month)) return 'reserve';
  if (!input.recentProfit && input.price > input.cash * NO_PROFIT_PRICE_CASH_SHARE) return 'noRecentProfit';
  return null;
}

/** Ein Typ als Kauf- oder Ersatzkandidat für eine Strecke. */
export interface PurchaseOption {
  /** Lieferzeitraum der Daten (`firstDeliveryOffset`, `lastDeliveryOffset`). */
  readonly firstDeliveryOffset: number;
  readonly lastDeliveryOffset: number | null;
  /** Passt die Piste an beiden Enden? */
  readonly runwayOk: boolean;
  /** Reichweite ≥ Entfernung der Strecke? */
  readonly inRange: boolean;
  /** Kaufpreis nach dem Wertmodell mit Kabine (`newAircraftPrice`). */
  readonly price: number;
  /** Planer-Hauptzahl der Strecke mit diesem Typ (Wartung über `fixedWeeklyCost` mit Flotten-Mischung, 5.12). */
  readonly expectedProfit: number;
}

/**
 * Wahl des Typs (7.11): unter den im Monat lieferbaren Typen mit passender Piste und Reichweite der mit der besten
 * Planer-Hauptzahl je Kaufpreis. Typen aus vorhandenen Familien haben ihren Wartungs-Vorteil schon in der
 * Planer-Hauptzahl (5.12). −1, wenn keiner passt. SPEZIFIKATION 7.11.
 */
export function pickPurchaseType(options: readonly PurchaseOption[], month: number): number {
  let best = -1;
  let bestValue = Number.NEGATIVE_INFINITY;
  options.forEach((o, i) => {
    if (!isOnMarket(o, month) || !o.runwayOk || !o.inRange || !(o.price > 0)) return;
    const value = o.expectedProfit / o.price;
    if (value > bestValue) {
      bestValue = value;
      best = i;
    }
  });
  return best;
}

/** Ein KI-Flugzeug, wie die Flotten-Entscheidungen es sehen. */
export interface RivalPlaneView {
  readonly id: string;
  /** Baumonat. */
  readonly builtMonth: number;
  /** Lieferende seines Typs (Daten), `null` = noch lieferbar. */
  readonly typeLastDeliveryOffset: number | null;
  /** Zellen- und Kabinenzustand in %. */
  readonly airframeCondition: number;
  readonly cabinCondition: number;
  /** Fliegt es eine Strecke? */
  readonly flying: boolean;
  /** Ergebnis seiner Strecke im Monat (`routeResult`, 5.9); ohne Strecke ohne Bedeutung. */
  readonly routeResult: number;
  /** Monate in Folge ohne Strecke (`nextIdleMonths`). */
  readonly idleMonths: number;
}

/**
 * Muss ein Flugzeug modernisiert werden: älter als 20 Jahre oder mehr als 12 Jahre nach dem Lieferende seines Typs
 * (wie heute `:1006-1031`). SPEZIFIKATION 7.11.
 */
export function needsModernization(plane: Pick<RivalPlaneView, 'builtMonth' | 'typeLastDeliveryOffset'>, month: number): boolean {
  const pastProduction = plane.typeLastDeliveryOffset !== null && month > plane.typeLastDeliveryOffset + MODERNIZE_AFTER_END_MONTHS;
  return pastProduction || month - plane.builtMonth > MODERNIZE_AGE_YEARS * 12;
}

/** Das Flugzeug, das diesen Monat modernisiert wird: das älteste, das es braucht; −1 = keines. Eines je Monat (wie heute). SPEZIFIKATION 7.11. */
export function modernizationCandidate(planes: readonly RivalPlaneView[], month: number): number {
  let best = -1;
  planes.forEach((p, i) => {
    if (needsModernization(p, month) && (best === -1 || p.builtMonth < planes[best].builtMonth)) best = i;
  });
  return best;
}

/**
 * Kann die KI den Ersatz bezahlen: Preis ≤ Kasse + Verkaufserlös des alten Flugzeugs (`saleProceeds`, 8.11) −
 * Reserve; kein Wachstumsstopp (7.12). SPEZIFIKATION 7.11.
 */
export function mayModernize(
  personality: RivalPersonality,
  month: number,
  cash: number,
  oldSaleProceeds: number,
  replacementPrice: number,
  growthStop: boolean,
): boolean {
  return !growthStop && replacementPrice <= cash + oldSaleProceeds - rivalCashReserve(personality, month);
}

/** Braucht ein Flugzeug eine Grundüberholung: Zellen- oder Kabinenzustand unter `RIVAL_OVERHAUL_BELOW`. SPEZIFIKATION 7.11. */
export function needsOverhaul(plane: Pick<RivalPlaneView, 'airframeCondition' | 'cabinCondition'>): boolean {
  return plane.airframeCondition < RIVAL_OVERHAUL_BELOW || plane.cabinCondition < RIVAL_OVERHAUL_BELOW;
}

/** Überholt die KI: nur, wenn die Kasse nach dem Preis (`overhaulPrice`, 8.13) noch die Reserve hat. SPEZIFIKATION 7.11. */
export function mayOverhaul(personality: RivalPersonality, month: number, cash: number, overhaulPrice: number): boolean {
  return cash - overhaulPrice >= rivalCashReserve(personality, month);
}

/**
 * Notverkauf bei Kasse < 0 (7.11): je Monat ein Flugzeug, zuerst ein freies, sonst das der schlechtesten Strecke
 * (auch wenn alle Strecken Gewinn machen, W11). −1 = keines (Kasse ≥ 0 oder keine Flugzeuge). Dieselbe Wahl wie der
 * Zwangsverkauf des Spielers (`saleCandidate`, 8.14). Erlös aus dem Wertmodell mit Händler-Spanne (8.11). SPEZIFIKATION 7.11.
 */
export function emergencySaleCandidate(planes: readonly RivalPlaneView[], cash: number): number {
  if (!(cash < 0)) return -1;
  return saleCandidate(planes);
}

/** Monate ohne Strecke: + 1 ohne Strecke, sonst 0. Die Uhr läuft auch in der Krise (R14, W9). SPEZIFIKATION 7.11. */
export function nextIdleMonths(previous: number, flying: boolean): number {
  return flying ? 0 : previous + 1;
}

/** Leerlauf-Verkauf: nach `MAX_IDLE_MONTHS` ohne Strecke, in der Krise nach `CRISIS_IDLE_MONTHS`. SPEZIFIKATION 7.11. */
export function sellIdle(idleMonths: number, inCrisis: boolean): boolean {
  return idleMonths >= (inCrisis ? CRISIS_IDLE_MONTHS : MAX_IDLE_MONTHS);
}

// ---------------------------------------------------------------------------
// 7.12 Krise
// ---------------------------------------------------------------------------

/**
 * Weltweiter Ereignis-Faktor: Mittel über die sechs Regionen von `eventDemandFactor` eines Paars innerhalb der
 * Region (3.5). Ein weltweites Ereignis zählt voll, ein regionales mit seinem Anteil. SPEZIFIKATION 7.12.
 */
export function worldEventDemandFactor(events: readonly DemandEvent[]): number {
  let sum = 0;
  for (const r of WORLD_REGIONS) sum += eventDemandFactor(events, r, r);
  return sum / WORLD_REGIONS.length;
}

/** Mittel des Tabellenpreises (`fuelTable`, 5.2) über die `CRISIS_FUEL_WINDOW` Monate **vor** `month`. SPEZIFIKATION 7.12. */
export function fuelTableAverage(month: number): number {
  let sum = 0;
  for (let k = 1; k <= CRISIS_FUEL_WINDOW; k++) sum += fuelTable(month - k);
  return sum / CRISIS_FUEL_WINDOW;
}

/**
 * Krisenstärke 0 … 1: `kappen(max(1 − weltweiter Ereignis-Faktor, (fuelTable / Mittel der 24 Monate davor − 1) / 2),
 * 0, 1)`. Ölkrisen stehen in der Tabelle (E61) und lösen so eine Krise aus. SPEZIFIKATION 7.12.
 */
export function crisisSeverity(events: readonly DemandEvent[], month: number): number {
  const demandLoss = 1 - worldEventDemandFactor(events);
  const fuelRise = (fuelTable(month) / fuelTableAverage(month) - 1) * CRISIS_FUEL_WEIGHT;
  return clamp(Math.max(demandLoss, fuelRise), 0, 1);
}

/** Krise ab `CRISIS_FROM`. SPEZIFIKATION 7.12. */
export function isCrisis(severity: number): boolean {
  return severity >= CRISIS_FROM;
}

/** Wachstumsstopp ab der Schwelle der Persönlichkeit (7.4): kein Kauf, keine Modernisierung, kein neues Drehkreuz. SPEZIFIKATION 7.12. */
export function growthStopped(personality: RivalPersonality, severity: number): boolean {
  return severity >= PERSONALITIES[personality].growthStopSeverity;
}

/** Eingaben des Krisen-Fahrplans einer Strecke. */
export interface CrisisScheduleInput {
  /** Umläufe je Woche jetzt. */
  readonly current: number;
  /** Plan vor der ersten Kürzung; nie überschritten. */
  readonly full: number;
  /** Auslastung im Monat; fehlt, wenn die Strecke nicht flog (dann bleibt der Plan in der Krise). */
  readonly loadFactor?: number;
  readonly inCrisis: boolean;
}

/**
 * Krisen-Fahrplan (wie heute `src/lib/rivalCrisis.ts:52-85`): in der Krise bei Auslastung < 0,8 auf
 * `max(1, runden(Flüge × Auslastung / 0,8))`; ab 0,95 + `aufrunden(25 % des alten Plans)`; nach der Krise je Monat
 * + 25 % bis zum alten Plan. Slots bleiben gekauft. SPEZIFIKATION 7.12.
 */
export function crisisFrequency(input: CrisisScheduleInput): number {
  const { current, full, loadFactor, inCrisis } = input;
  const step = Math.max(1, Math.ceil(full * CRISIS_RECOVERY_STEP));
  if (!inCrisis) return Math.min(full, current + step);
  if (loadFactor === undefined) return current;
  if (loadFactor < CRISIS_TARGET_LOAD) {
    return Math.min(current, Math.max(1, Math.round((current * loadFactor) / CRISIS_TARGET_LOAD)));
  }
  if (loadFactor >= CRISIS_FULL_LOAD) return Math.min(full, current + step);
  return current;
}

// ---------------------------------------------------------------------------
// 7.13 Wachstum, Größe und Dividende
// ---------------------------------------------------------------------------

/**
 * Größe einer Gesellschaft: angebotene Sitze je Woche, beide Richtungen = Σ Sitze × Umläufe × 2 (E46). Ersetzt
 * Flugzeugzahl und Kasse als Maß (W4). SPEZIFIKATION 7.13.
 */
export function rivalSize(routes: readonly { readonly seats: number; readonly weeklyFrequency: number }[]): number {
  let total = 0;
  for (const r of routes) total += r.seats * r.weeklyFrequency * 2;
  return total;
}

/** Ein eigenes Drehkreuz bei der Prüfung „neues Drehkreuz“. */
export interface OwnHubView {
  /** Belegte Slots dort. */
  readonly usedSlots: number;
  /** Flughafen-Größe. */
  readonly airportSize: number;
  /** Monate, seit die KI dort zuletzt eine Strecke mit erwartetem Gewinn > 0 fand. */
  readonly monthsWithoutProfitableRoute: number;
}

/** Eingaben der Entscheidung „neues Drehkreuz“. */
export interface NewHubInput {
  readonly personality: RivalPersonality;
  readonly ownHubs: readonly OwnHubView[];
  /** `rivalSize`. */
  readonly size: number;
  readonly cash: number;
  readonly month: number;
  /** Preis der Verwaltungsstufen 1 und 2 am gewählten Ort (`newHubTierPrice`). */
  readonly tierPrice: number;
  readonly growthStop: boolean;
  /** Zufallszahl in [0, 1) gegen `NEW_HUB_CHANCE`. */
  readonly u: number;
}

/** Preis der Verwaltungsstufen 1 und 2 an einem Flughafen (5.11). SPEZIFIKATION 7.13. */
export function newHubTierPrice(airportSize: number, month: number): number {
  return managementTierPrice(1, airportSize, month) + managementTierPrice(2, airportSize, month);
}

/**
 * Eröffnet die KI diesen Monat ein neues Drehkreuz (7.13): weniger als `MAX_HUBS`; an jedem eigenen Drehkreuz
 * mindestens 90 % des eigenen Slot-Anteils belegt oder seit 3 Monaten dort keine Strecke mit Gewinn gefunden;
 * `rivalSize ≥ NEW_HUB_MIN_SEATS × Drehkreuze`; Kasse ≥ Stufen 1 und 2 + Reserve; kein Wachstumsstopp; Zufall unter
 * `NEW_HUB_CHANCE`. SPEZIFIKATION 7.13.
 */
export function wantsNewHub(input: NewHubInput): boolean {
  const def = PERSONALITIES[input.personality];
  const hubs = input.ownHubs.length;
  if (hubs >= def.maxHubs || input.growthStop) return false;
  const saturated = input.ownHubs.every(
    (h) =>
      h.usedSlots >= NEW_HUB_SLOT_USE * rivalSlotCap(h.airportSize, true) ||
      h.monthsWithoutProfitableRoute >= NEW_HUB_NO_PROFIT_MONTHS,
  );
  return (
    saturated &&
    input.size >= NEW_HUB_MIN_SEATS * hubs &&
    input.cash >= input.tierPrice + rivalCashReserve(input.personality, input.month) &&
    input.u < NEW_HUB_CHANCE
  );
}

/** Ein Flughafen als Ort für ein neues Drehkreuz. */
export interface NewHubCandidate {
  readonly id: string;
  /** Flughafen-Größe 1 … 5. */
  readonly level: number;
  /** Nachfrage am Flughafen. */
  readonly demand: number;
  /** Region (`regionOf`, R15). */
  readonly region: WorldRegion;
  /** Drehkreuz einer KI (auch dieser)? */
  readonly rivalHub: boolean;
  readonly playerHub: boolean;
  readonly playerTier3: boolean;
}

/**
 * Gewichte der Orte für ein neues Drehkreuz: nur Flughäfen ab Größe 5 (R14), nicht Drehkreuz einer KI, nicht mit
 * Spieler-Stufe 3 (E63); Gewicht = Nachfrage × (Heimatregion: `HOME_REGION_WEIGHT`) × (Spieler-Drehkreuz:
 * `3 × Angriffslust / 6`). Wahl mit `weightedPick`. SPEZIFIKATION 7.13.
 */
export function newHubWeights(
  candidates: readonly NewHubCandidate[],
  personality: RivalPersonality,
  homeRegion: WorldRegion,
): number[] {
  const aggression = PERSONALITIES[personality].aggression;
  return candidates.map((c) => {
    if (c.level < NEW_HUB_MIN_LEVEL || c.rivalHub || !rivalMayOpenAt(c.playerTier3)) return 0;
    const region = c.region === homeRegion ? HOME_REGION_WEIGHT : 1;
    const player = c.playerHub ? (PLAYER_HUB_WEIGHT * aggression) / PLAYER_HUB_AGGRESSION_PIVOT : 1;
    return c.demand * region * player;
  });
}

/**
 * Dividenden-Grenze: `max(atCost(DIVIDEND_FLOOR_1960), 12 × Mittel der Monatskosten der letzten 12 Monate)`. Mit
 * kürzerer Geschichte das Mittel der vorhandenen Monate; ohne Geschichte nur der Boden. SPEZIFIKATION 7.13.
 *
 * @param monthlyCostHistory `monthlyCosts` (5.16, Summe) je Monat, ältester zuerst.
 */
export function dividendLimit(month: number, monthlyCostHistory: readonly number[]): number {
  const recent = monthlyCostHistory.slice(-DIVIDEND_COST_WINDOW);
  const mean = recent.length === 0 ? 0 : recent.reduce((s, c) => s + c, 0) / recent.length;
  return Math.max(atCost(DIVIDEND_FLOOR_1960, month), DIVIDEND_RESERVE_MONTHS * mean);
}

/**
 * Dividende am Monatsende nach allen Buchungen (R11): `max(0, Kasse − dividendLimit)`. Nur in der Kasse, kein
 * Posten im Monatsergebnis (5.16), zählt nicht zum Unternehmenswert. SPEZIFIKATION 7.13.
 */
export function rivalDividend(cash: number, limit: number): number {
  return Math.max(0, cash - limit);
}

// ---------------------------------------------------------------------------
// 7.14 Zuschuss (E47)
// ---------------------------------------------------------------------------

/** Zuschuss je Monat in $ von 1960 (Formel in `costTotals.ts`, F43). SPEZIFIKATION 7.14. */
export { subsidy1960 };

/**
 * Zuschuss einer KI im Monat: `atCost(subsidy1960(month), month)`, ausgeschaltet 0. Der Abschluss bucht ihn als
 * Zeile „Subsidy“ im Monatsergebnis für Gesellschaften mit dem Merkmal `subsidized` (`subsidyIncome`, F43).
 * Bis zur Abschaffung (Prüfregel 7.14 im Balance-Skript 3.9). SPEZIFIKATION 7.14.
 */
export function rivalSubsidy(month: number, enabled: boolean = RIVAL_SUBSIDY_ENABLED): number {
  return subsidyIncome(month, true, enabled);
}

// ---------------------------------------------------------------------------
// 7.15 Notlage, Verkauf, Auflösung
// ---------------------------------------------------------------------------

/** Zustand einer KI: gesund, zum Verkauf, aufgelöst. */
export type RivalStatus = 'healthy' | 'forSale' | 'liquidated';

/** Notlage-Stand einer KI. */
export interface RivalDistressState {
  readonly status: RivalStatus;
  /** Monate **in Folge** mit Kasse < 0 am Monatsende. */
  readonly distressMonths: number;
  /** Monate zum Verkauf. */
  readonly forSaleMonths: number;
}

/** Was am Monatsende über die Notlage zählt. */
export interface RivalDistressInput {
  /** Kasse am Monatsende nach allen Buchungen. */
  readonly cash: number;
  /** Kreditgrenze (8.14): `CREDIT_LIMIT_SHARE × Σ aircraftValue`. */
  readonly creditLimit: number;
  readonly aircraftCount: number;
}

/** Ergebnis des Notlage-Schritts mit Meldung (Texte in Phase 4). */
export interface RivalDistressStep {
  readonly state: RivalDistressState;
  readonly event: 'forSale' | 'recovered' | 'liquidated' | null;
}

/** Start-Zustand einer KI. */
export const RIVAL_HEALTHY: RivalDistressState = { status: 'healthy', distressMonths: 0, forSaleMonths: 0 };

/**
 * Notlage am Monatsende (7.15, E34, E49): Zähler + 1 bei Kasse < 0, sonst 0 (in Folge, W11). Zum Verkauf ab
 * `DISTRESS_TO_SALE_MONTHS` oder Kasse unter der Kreditgrenze (überzogen, 8.14); zurück zu gesund bei Kasse ≥ 0.
 * Auflösung nach `SALE_TO_LIQUIDATION_MONTHS` zum Verkauf oder ohne Flugzeuge. SPEZIFIKATION 7.15.
 */
export function rivalDistressStep(state: RivalDistressState, input: RivalDistressInput): RivalDistressStep {
  if (state.status === 'liquidated') return { state, event: null };
  const distressMonths = input.cash < 0 ? state.distressMonths + 1 : 0;
  if (input.aircraftCount <= 0) {
    return { state: { status: 'liquidated', distressMonths, forSaleMonths: state.forSaleMonths }, event: 'liquidated' };
  }
  if (state.status === 'forSale') {
    if (input.cash >= 0) return { state: { status: 'healthy', distressMonths, forSaleMonths: 0 }, event: 'recovered' };
    const forSaleMonths = state.forSaleMonths + 1;
    if (forSaleMonths >= SALE_TO_LIQUIDATION_MONTHS) {
      return { state: { status: 'liquidated', distressMonths, forSaleMonths }, event: 'liquidated' };
    }
    return { state: { status: 'forSale', distressMonths, forSaleMonths }, event: null };
  }
  if (distressMonths >= DISTRESS_TO_SALE_MONTHS || input.cash < -input.creditLimit) {
    return { state: { status: 'forSale', distressMonths, forSaleMonths: 0 }, event: 'forSale' };
  }
  return { state: { status: 'healthy', distressMonths, forSaleMonths: 0 }, event: null };
}

/** Slots einer Gesellschaft an einem Flughafen. */
export interface AirportHolding {
  readonly airportId: string;
  readonly slots: number;
  /** Schalter je Art. */
  readonly desks: { readonly normal: number; readonly self: number };
  /** Drehkreuz dieser Gesellschaft? */
  readonly hub: boolean;
}

/** Was bei der Auflösung einer KI geschieht. */
export interface LiquidationResult<P> {
  /** Alle Flugzeuge mit Alter, Zustand und Kabine in den Gebrauchtmarkt (E49, R13). */
  readonly toUsedMarket: readonly P[];
  /** Slots je Flughafen, die frei werden (für alle). */
  readonly freedSlots: readonly { readonly airportId: string; readonly slots: number }[];
  /** Schulden, die verfallen (Meldung, E52). */
  readonly debtWrittenOff: number;
}

/**
 * Auflösung (7.15): Flugzeuge in den Gebrauchtmarkt, Slots zurück an die Flughäfen, Schalter, Lounges und Stufen
 * entfallen, Schulden verfallen. SPEZIFIKATION 7.15.
 */
export function liquidate<P>(planes: readonly P[], holdings: readonly AirportHolding[], cash: number): LiquidationResult<P> {
  return {
    toUsedMarket: [...planes],
    freedSlots: holdings.filter((h) => h.slots > 0).map((h) => ({ airportId: h.airportId, slots: h.slots })),
    debtWrittenOff: Math.max(0, -cash),
  };
}

// ---------------------------------------------------------------------------
// 7.16 Übernahme (E48)
// ---------------------------------------------------------------------------

/** Darf der Spieler diese KI übernehmen: zum Verkauf ab Rang 6, gesund ab Rang 9 (6.7). SPEZIFIKATION 7.16. */
export function mayTakeOver(playerRank: number, status: RivalStatus): boolean {
  if (status === 'forSale') return hasUnlock(playerRank, 'takeoverDistressed');
  if (status === 'healthy') return hasUnlock(playerRank, 'takeoverHealthy');
  return false;
}

/**
 * Übernahme-Preis = Unternehmenswert (`companyValue`, 6.12), mindestens `atCost(TAKEOVER_MIN_PRICE_1960)`. Gleiche
 * Formel für gesund und zum Verkauf (E48). SPEZIFIKATION 7.16.
 */
export function takeoverPrice(value: CompanyValueInput, month: number): number {
  return Math.max(atCost(TAKEOVER_MIN_PRICE_1960, month), companyValue(value));
}

/** Was der Spieler an einem Flughafen nach der Übernahme hat. */
export interface TakeoverAirport {
  readonly airportId: string;
  /** Slots des Spielers + Slots der KI. */
  readonly slots: number;
  readonly desks: { readonly normal: number; readonly self: number };
  /** `max(Spieler-Stufe, 1)`, an KI-Drehkreuzen `max(Spieler-Stufe, 2)`. */
  readonly tier: number;
}

/** Ergebnis einer Übernahme (nur Kasse und Bestand; das Monatsergebnis ändert sie nicht, 5.16). */
export interface TakeoverResult {
  /** Kasse des Spielers danach: vorher − Preis + Kasse der KI (auch negativ: Schulden gehen mit). */
  readonly playerCash: number;
  readonly price: number;
  /** Je Flughafen mit Slots oder Schaltern der KI. */
  readonly airports: readonly TakeoverAirport[];
}

/**
 * Übernahme (7.16): Der Spieler zahlt den Preis und bekommt die Kasse der KI, alle Flugzeuge (abgestellt, mit
 * Alter, Zustand und Kabine; der Aufrufer übergibt sie), alle Slots und Schalter **je Flughafen** und dort
 * mindestens Stufe 1, an KI-Drehkreuzen Stufe 2. Strecken, Lounges und Ruf der KI verfallen; kein Ruf-Sprung (E38).
 * Übernahmen + 1 zählt der Aufrufer (6.12). SPEZIFIKATION 7.16.
 *
 * @param playerAirports Slots, Schalter und Stufe des Spielers je Flughafen (fehlt = nichts).
 */
export function takeover(
  playerCash: number,
  rivalValue: CompanyValueInput,
  rivalHoldings: readonly AirportHolding[],
  playerAirports: ReadonlyMap<string, { readonly slots: number; readonly desks: { readonly normal: number; readonly self: number }; readonly tier: number }>,
  month: number,
): TakeoverResult {
  const price = takeoverPrice(rivalValue, month);
  const airports = rivalHoldings.map((h) => {
    const mine = playerAirports.get(h.airportId);
    const minTier = h.hub ? RIVAL_HUB_TIER : TAKEOVER_MIN_TIER;
    return {
      airportId: h.airportId,
      slots: (mine?.slots ?? 0) + h.slots,
      desks: { normal: (mine?.desks.normal ?? 0) + h.desks.normal, self: (mine?.desks.self ?? 0) + h.desks.self },
      tier: Math.max(mine?.tier ?? 0, minTier),
    };
  });
  return { playerCash: playerCash - price + rivalValue.cash, price, airports };
}

// ---------------------------------------------------------------------------
// 7.17 Wirkung auf den Spieler und Anzeige
// ---------------------------------------------------------------------------

/** Ticker-Rang des Spielers: `1 + Anzahl KI mit mehr Fluggästen im Monat` (E46; heute nach Kasse). SPEZIFIKATION 7.17. */
export function tickerRank(playerPassengers: number, rivalPassengers: readonly number[]): number {
  return 1 + rivalPassengers.filter((p) => p > playerPassengers).length;
}

/** Arten der KI-Meldungen (Texte aus den Konstanten in Phase 4, E52). */
export type RivalNewsKind =
  | 'priceWar'
  | 'scheduleCut'
  | 'routeClosed'
  | 'newHub'
  | 'forSale'
  | 'recovered'
  | 'liquidated'
  | 'modernized'
  | 'newRival';

/** Meldungen, die nur erscheinen, wenn ein Flughafen des Spielers betroffen ist. SPEZIFIKATION 7.17. */
export const RIVAL_NEWS_IF_PLAYER_AIRPORT: readonly RivalNewsKind[] = ['priceWar', 'scheduleCut', 'routeClosed', 'newHub'];

/**
 * Erscheint eine KI-Meldung: Preiskampf, Kürzung, Streckenende und neues Drehkreuz nur, wenn ein Flughafen des
 * Spielers betroffen ist; Verkauf, Erholung, Auflösung, Modernisierung und neue KI immer. Rückschlag entfällt.
 * SPEZIFIKATION 7.17.
 */
export function showRivalNews(kind: RivalNewsKind, touchesPlayerAirport: boolean): boolean {
  return !RIVAL_NEWS_IF_PLAYER_AIRPORT.includes(kind) || touchesPlayerAirport;
}

// ---------------------------------------------------------------------------
// 7.9–7.13 Bausteine im Abschluss (Paket 3.8d)
// ---------------------------------------------------------------------------

/**
 * Fahrplan einer KI-Strecke (F43): die Umläufe einer Woche gleichmäßig auf die 7 Tage verteilt; am Tag der erste Abflug
 * am Anfang der Strecke um `RIVAL_FIRST_DEPARTURE_MINUTE`, weitere im Abstand eines Umlaufs
 * (`2 × (Blockzeit + RIVAL_TURN_MINUTES)`); Rückflug nach Blockzeit + Bodenzeit. Minuten der Woche (Montag 00:00 = 0),
 * sortiert. Ohne Fahrplan bildet eine Strecke keine Umsteige-Verbindung (F42). SPEZIFIKATION 3.13, 7.9.
 *
 * @param weeklyFrequency Umläufe je Woche (Abflüge je Ende).
 * @param blockMinutesOneWay Blockzeit einer Richtung (`blockMinutes`).
 */
export function rivalSchedule(weeklyFrequency: number, blockMinutesOneWay: number): RouteSchedule {
  const n = Math.max(0, Math.round(weeklyFrequency));
  const cycle = 2 * (blockMinutesOneWay + RIVAL_TURN_MINUTES);
  const fromDepartures: number[] = [];
  const toDepartures: number[] = [];
  for (let i = 0; i < n; i++) {
    const day = Math.floor((i * 7) / n);
    const nthOfDay = i - Math.ceil((day * n) / 7);
    const out = Math.round(day * 1440 + RIVAL_FIRST_DEPARTURE_MINUTE + nthOfDay * cycle) % MINUTES_PER_WEEK;
    fromDepartures.push(out);
    toDepartures.push(Math.round(out + blockMinutesOneWay + RIVAL_TURN_MINUTES) % MINUTES_PER_WEEK);
  }
  const ascending = (a: number, b: number) => a - b;
  return { fromDepartures: fromDepartures.sort(ascending), toDepartures: toDepartures.sort(ascending) };
}

/**
 * Wie viele Slots eine KI an einem Flughafen im Monat noch kaufen darf (7.10, E50, F43): die kleinere Lücke aus
 * eigenem Anteil (`rivalSlotCap − eigene Slots`) und ihrem **Teil** der freien Slots des Flughafens zu Beginn der
 * Entscheidungen (`abrunden(frei / Zahl der entscheidenden KI)`), weniger schon in diesem Monat dort gekaufte. So hängt
 * das Ergebnis nicht von der Reihenfolge der KI ab (7.8), und Σ Slots aller bleibt ≤ Grenze.
 *
 * @param freeAtStart `slotLimit − Σ gekaufte Slots aller Gesellschaften` zu Beginn der Entscheidungen.
 */
export function rivalBuyableSlots(
  airportSize: number,
  ownHub: boolean,
  ownedTotal: number,
  freeAtStart: number,
  deciders: number,
  boughtThisMonth: number,
): number {
  const fairShare = Math.floor(Math.max(0, freeAtStart) / Math.max(1, deciders)) - boughtThisMonth;
  return Math.max(0, Math.min(fairShare, rivalSlotCap(airportSize, ownHub) - ownedTotal));
}

/** Passt ein Typ auf die Piste: ICAO-Code ≤ größter Code des Flughafens; ohne Angabe ja (wie `fitsAirport` heute). SPEZIFIKATION 7.9. */
export function runwayFits(icaoCode: string | undefined, maxIcaoCode: string | undefined): boolean {
  return !icaoCode || !maxIcaoCode || icaoCode <= maxIcaoCode;
}

/** Gab es in den letzten `PROFIT_LOOKBACK_MONTHS` Monaten (dieser eingeschlossen) ein Monatsergebnis > 0? SPEZIFIKATION 7.11. */
export function hadRecentProfit(results: readonly number[]): boolean {
  return results.slice(-PROFIT_LOOKBACK_MONTHS).some((r) => r > 0);
}

/**
 * Bezugs-Typ für die Streckensuche vor einem Kauf (F43): der Typ des jüngsten eigenen Flugzeugs, wenn er noch lieferbar
 * ist; sonst unter den lieferbaren Typen derselben Bauart der beliebteste; sonst der beliebteste lieferbare. `-1` = keiner.
 * Den gekauften Typ wählt danach `pickPurchaseType` für die gefundene Strecke. SPEZIFIKATION 7.11.
 */
export function referenceTypeIndex(catalog: readonly CatalogType[], newestTypeId: string | undefined, month: number): number {
  const onMarket = catalog.map((t) => isOnMarket(t, month));
  const own = catalog.findIndex((t) => t.id === newestTypeId);
  if (own >= 0 && onMarket[own]) return own;
  const kind = own >= 0 ? catalog[own].class : undefined;
  let best = -1;
  for (const sameKind of kind ? [true, false] : [false]) {
    catalog.forEach((t, i) => {
      if (!onMarket[i] || (sameKind && t.class !== kind)) return;
      if (best === -1 || t.popularity > catalog[best].popularity) best = i;
    });
    if (best >= 0) return best;
  }
  return best;
}

// ---------------------------------------------------------------------------
// 7.8 Entscheidungen im Monatsabschluss (Paket 3.8c)
// ---------------------------------------------------------------------------

/** Was die KI je Strecke behält (7.6, 7.8, 7.12). */
export interface RivalRouteMemory {
  /** Geglätteter Gewinn (`smoothedProfit`, Monatswert). */
  readonly avgProfit?: number;
  /** Umläufe je Woche vor der ersten Krisen-Kürzung; fehlt = nicht gekürzt. */
  readonly fullFrequency?: number;
  /** Lage je Klasse (`nextYieldPosition`). */
  readonly yieldPosition?: Readonly<Partial<Record<CabinClass, number>>>;
  readonly priceWar?: PriceWarState;
}

/**
 * Zustand der KI-Entscheidungen (`CompanyState.agent`; 7.3–7.15). Eine Gesellschaft ohne diesen Zustand trifft keine
 * KI-Entscheidungen.
 */
export interface RivalAgent {
  readonly kind: 'rival';
  readonly personality: RivalPersonality;
  readonly strength: RivalStrength;
  readonly distress: RivalDistressState;
  readonly routes: Readonly<Record<string, RivalRouteMemory>>;
  /** Monate ohne Strecke je Flugzeug (7.11). */
  readonly idleMonths: Readonly<Record<string, number>>;
  /** Bisherige Grundüberholungen je Flugzeug (8.13). */
  readonly overhauls: Readonly<Record<string, number>>;
  /** Monatskosten (5.16, Summe) je Monat, ältester zuerst, für die Dividenden-Grenze (7.13). */
  readonly costHistory: readonly number[];
  /** Freie Slots je Flughafen und Slot-Art (`Flughafen|Art`) je Monat, ältester zuerst (Verkauf nach 6 Monaten, 7.10). */
  readonly slotFree?: Readonly<Record<string, readonly number[]>>;
  /** Monate mit Suche ohne Strecke mit erwartetem Gewinn > 0 je eigenem Drehkreuz (neues Drehkreuz, 7.13). */
  readonly hubNoProfit?: Readonly<Record<string, number>>;
  /** Bisherige Kabinen-Erneuerungen je Flugzeug (8.13, F43). */
  readonly refits?: Readonly<Record<string, number>>;
}

/** Start-Zustand der Entscheidungen einer neuen KI (7.7). */
export function newRivalAgent(personality: RivalPersonality, strength: RivalStrength): RivalAgent {
  return {
    kind: 'rival',
    personality,
    strength,
    distress: RIVAL_HEALTHY,
    routes: {},
    idleMonths: {},
    overhauls: {},
    costHistory: [],
    slotFree: {},
    hubNoProfit: {},
    refits: {},
  };
}

/** Der KI-Zustand einer Gesellschaft, oder `undefined`. */
export function rivalAgentOf(company: CompanyState): RivalAgent | undefined {
  const agent = company.agent as Partial<RivalAgent> | undefined;
  return agent && agent.kind === 'rival' ? (agent as RivalAgent) : undefined;
}

const sumOf = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

/**
 * Entscheidungen einer KI nach der Buchung (7.8), in der Reihenfolge `RIVAL_DECISION_STEPS`. Sie wirken ab X+1:
 * Preise als `nextFareRatios` (4.5), Flugpläne, Verkäufe, Überholungen, Dividende und Notlage ändern keine Zahl des
 * Monats X (der Abschluss bucht sie als `decisionsCash` / `decisionsValueChange`). Zahlen aus derselben Rechnung wie der
 * Planer (`plannerRouteResult`, R2); Zufall aus `rng` mit Zweck und Gesellschaft als Schlüssel, daher zählt die
 * Reihenfolge der KI nicht (7.8).
 *
 * Schritte: `prices`, `crisis`, `losers`, `fineTune`, `fleet` (Modernisierung, Grundüberholung, Kabinen-Erneuerung,
 * Leerlauf- und Notverkauf), `openings` (freie Flugzeuge, Slot-Kauf an beiden Enden), `growth` (Kauf mit Strecke, neues
 * Drehkreuz; danach Bestand: Lounge, Verkauf freier Slots, Schalter, Fahrpläne), `dividend`, `distress` mit Auflösung.
 * Typen-Katalog aus `ModelState.catalog`, Flughafen-Kandidaten aus `ModelState.airports` (F43). Den Zuschuss bucht der
 * Abschluss (`subsidyIncome`), das Nachrücken `rivalRefill` nach dem Übergang.
 */
export const rivalDecisions: CompanyDecisions = (company, ctx) => {
  const agent = rivalAgentOf(company);
  if (!agent || agent.distress.status === 'liquidated') return { company };
  return rivalMonth(company, agent, ctx);
};

function rivalMonth(company: CompanyState, agent: RivalAgent, ctx: DecisionContext): DecisionOutcome {
  const X = ctx.month;
  const news: CloseNews[] = [];
  const sold: ResoldPlane[] = [];
  const say = (kind: CloseNews['kind'], subject?: string, amount?: number) => news.push({ companyId: company.id, kind, subject, amount });
  const figures = new Map(ctx.operations.routes.map((r) => [r.routeId, r]));
  const airports = ctx.state.airports;
  const pairOf = (r: RouteState) => (r.from < r.to ? `${r.from}|${r.to}` : `${r.to}|${r.from}`);
  const kmOf = (r: RouteState) => distanceKm(airports[r.from].coords, airports[r.to].coords);
  const others = ctx.state.companies.filter((c) => c.id !== company.id);
  const resaleBonus = researchEffects(company.inputs.completedResearch).resaleBonus;

  const memory: Record<string, RivalRouteMemory> = {};
  for (const r of company.routes) {
    const f = figures.get(r.id);
    const old = agent.routes[r.id];
    memory[r.id] = f ? { ...old, avgProfit: smoothedProfit(old?.avgProfit, f.result * WEEKS_PER_MONTH) } : { ...old };
  }
  let routes: RouteState[] = company.routes.map((r) => ({ ...r }));
  let aircraft: AircraftState[] = [...company.aircraft];
  let cash = company.cash;
  let holdings: Record<string, HoldingState> = { ...company.airports };
  const hubs: string[] = [...(company.hubs ?? [])];
  const current = (): CompanyState => ({ ...company, routes, aircraft, cash, airports: holdings, hubs });
  const stateWith = (c: CompanyState): ModelState => ({ ...ctx.state, companies: ctx.state.companies.map((o) => (o.id === company.id ? c : o)) });
  const stateNow = () => stateWith(current());
  const next = X + 1;
  const personality = agent.personality;
  const catalog = ctx.state.catalog ?? [];
  const typeOf = (typeId: string) => catalog.find((t) => t.id === typeId);
  const planeOf = (id: string) => aircraft.find((p) => p.id === id) as AircraftState;
  let serial = 0;
  const newId = (kind: string) => `${company.id}-${kind}${next}-${++serial}`;

  // 1 prices (7.6): Preiskampf je Paar, Lage je Klasse, Preisniveau ab X+1.
  routes = routes.map((r) => {
    const f = figures.get(r.id);
    if (!f) return r;
    const m = memory[r.id];
    const fares = marketFares(kmOf(r), X);
    const competitors = others.flatMap((o) => o.routes.filter((x) => pairOf(x) === pairOf(r)));
    const ownEconomy = (r.fareRatios?.economy ?? 1) * fares.economy;
    const war = priceWarStep(m.priceWar ?? {}, {
      personality: agent.personality,
      month: X,
      routeAgeMonths: r.ageMonths,
      avgProfit: m.avgProfit ?? 0,
      lastRivalOpeningMonth: competitors.length > 0 ? X - Math.min(...competitors.map((o) => o.ageMonths)) : undefined,
      undercutInEconomy: competitors.some((o) => (o.fareRatios?.economy ?? 1) * fares.economy < ownEconomy),
      competitorPresent: competitors.length > 0,
    });
    if (war.event) say(war.event === 'started' ? 'priceWarStarted' : 'priceWarEnded', r.id);
    const plane = aircraft.find((p) => p.id === r.aircraftId) as AircraftState;
    const classes: Partial<Record<CabinClass, BreakEvenClass>> = {};
    for (const c of CABIN_CLASSES) {
      const seats = (plane.seats[c] ?? 0) * r.departuresPerWeek;
      if (seats > 0) classes[c] = { seatsPerWeek: seats, marketFare: fares[c], costPerPassenger: f.costPerPassenger[c] ?? 0 };
    }
    const fixedFull = f.flightOpsFull + f.fixed.slotShare + f.fixed.aircraftShare;
    const breakEvenFull = Object.keys(classes).length > 0 ? breakEvenFareLevel(1, fixedFull, classes) : 0;
    const yieldPosition: Partial<Record<CabinClass, number>> = {};
    const nextFareRatios: Partial<Record<CabinClass, number>> = {};
    for (const c of CABIN_CLASSES) {
      const seats = f.offeredSeats[c];
      if (!((plane.seats[c] ?? 0) > 0)) continue;
      const load = seats > 0 ? (f.passengers[c] + f.transferPassengers[c]) / seats : 0;
      const position = nextYieldPosition(m.yieldPosition?.[c] ?? 0, load);
      yieldPosition[c] = position;
      const best =
        PERSONALITIES[agent.personality].farePosition === 'best'
          ? bestFareRatio(routeClassPassengersCurve(ctx.state, company.id, r.id, c), fares[c], f.costPerPassenger[c] ?? 0)
          : undefined;
      nextFareRatios[c] = rivalFareRatio({
        personality: agent.personality,
        target: rivalTargetFareRatio(agent.personality, satisfactionFactor(f.satisfaction[c] ?? 100), best),
        yieldPosition: position,
        priceWar: war.state.startedMonth !== undefined,
        breakEvenFull,
      });
    }
    memory[r.id] = { ...m, priceWar: war.state, yieldPosition };
    return { ...r, nextFareRatios };
  });

  // 2 crisis (7.12): Krisen-Fahrplan.
  const severity = crisisSeverity(activeWorldEvents(X, ctx.state.randomEvents), X);
  const inCrisis = isCrisis(severity);
  routes = routes.map((r) => {
    const f = figures.get(r.id);
    const m = memory[r.id];
    const now = r.departuresPerWeek / 2;
    const full = m.fullFrequency ?? now;
    const seats = f ? sumOf(CABIN_CLASSES.map((c) => f.offeredSeats[c])) : 0;
    const pax = f ? sumOf(CABIN_CLASSES.map((c) => f.passengers[c] + f.transferPassengers[c])) : 0;
    const next = crisisFrequency({ current: now, full, loadFactor: seats > 0 ? pax / seats : undefined, inCrisis });
    memory[r.id] = { ...m, fullFrequency: inCrisis || next < full ? full : undefined };
    if (next < now) say('scheduleCut', r.id);
    return next === now ? r : { ...r, departuresPerWeek: 2 * next };
  });

  // Planer-Hauptzahl mit dem jeweils aktuellen Plan dieser KI (R2).
  const expectedProfitAt: ExpectedProfitAt = (routeId, weeklyFrequency) => plannerRouteResult(stateNow(), company.id, routeId, 2 * weeklyFrequency);
  const view = (): RivalRouteView[] =>
    routes.map((r) => ({ id: r.id, weeklyFrequency: r.departuresPerWeek / 2, ageMonths: r.ageMonths, avgProfit: memory[r.id].avgProfit ?? 0 }));

  // 3 losers (7.8).
  for (const d of loserDecisions(view(), agent.personality, agent.strength, expectedProfitAt)) {
    if (d.action === 'close') {
      routes = routes.filter((r) => r.id !== d.routeId);
      say('routeClosed', d.routeId);
    } else {
      routes = routes.map((r) => (r.id === d.routeId ? { ...r, departuresPerWeek: 2 * d.weeklyFrequency } : r));
      say('scheduleCut', d.routeId);
    }
  }

  // 4 fineTune (7.8): höchstens bis zu den höchsten Umläufen des Flugzeugs und den freien eigenen Slots (7.10).
  if (fineTuneThisMonth(agent.strength, rng(ctx.seed, X, 'fineTune', company.id))) {
    for (const v of view()) {
      const r = routes.find((x) => x.id === v.id) as RouteState;
      const plane = aircraft.find((p) => p.id === r.aircraftId) as AircraftState;
      const f = figures.get(r.id);
      if (!f) continue;
      const otherRotations = sumOf(routes.filter((x) => x.aircraftId === plane.id && x.id !== r.id).map((x) => x.departuresPerWeek / 2));
      const slotRoom = Math.min(
        ...[r.from, r.to].map((id) => {
          const owned = company.airports[id]?.slots[plane.aircraftClass] ?? 0;
          const used = sumOf(
            routes
              .filter((x) => (x.from === id || x.to === id) && aircraft.find((p) => p.id === x.aircraftId)?.aircraftClass === plane.aircraftClass)
              .map((x) => x.departuresPerWeek / 2),
          );
          return owned - used;
        }),
      );
      const alt = fineTune(
        {
          route: v,
          maxRotations: Math.max(1, maxWeeklyRotations(2 * f.blockMinutes) - otherRotations),
          slotRoom,
          crisisReduced: memory[r.id].fullFrequency !== undefined && v.weeklyFrequency < (memory[r.id].fullFrequency as number),
        },
        expectedProfitAt,
      );
      if (alt !== null) routes = routes.map((x) => (x.id === r.id ? { ...x, departuresPerWeek: 2 * alt } : x));
    }
  }

  // Gemeinsame Bausteine für Flotte, Eröffnungen und Wachstum (7.9–7.11, Paket 3.8d).
  const severityGrowthStop = growthStopped(personality, severity);
  const pairKeyOf = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const seatsOf = (p: AircraftState) => sumOf(CABIN_CLASSES.map((c) => p.seats[c] ?? 0));
  const serviceFor = (plane: AircraftState, km: number): RouteState['service'] => {
    const minutes = blockMinutes(km, plane.cruiseSpeed);
    const service: Partial<Record<CabinClass, RouteState['service'][CabinClass]>> = {};
    for (const c of CABIN_CLASSES) if ((plane.seats[c] ?? 0) > 0) service[c] = rivalService(personality, c, minutes);
    return service;
  };
  const usedBy = (id: string, cls: AircraftClass) =>
    sumOf(routes.filter((r) => (r.from === id || r.to === id) && planeOf(r.aircraftId)?.aircraftClass === cls).map((r) => r.departuresPerWeek / 2));
  const ownedTotal = (id: string) => sumOf(AIRCRAFT_CLASSES.map((cls) => holdings[id]?.slots[cls] ?? 0));
  const freeOwn = (id: string, cls: AircraftClass) => Math.max(0, (holdings[id]?.slots[cls] ?? 0) - usedBy(id, cls));
  const deciders = ctx.state.companies.filter((c) => {
    const a = rivalAgentOf(c);
    return a !== undefined && a.distress.status !== 'liquidated';
  }).length;
  const freeAtStart = (id: string) =>
    slotLimit(airports[id].size) - sumOf(ctx.state.companies.map((c) => sumOf(AIRCRAFT_CLASSES.map((cls) => c.airports[id]?.slots[cls] ?? 0))));
  const bought: Record<string, number> = {};
  const room = (id: string, cls: AircraftClass) =>
    freeOwn(id, cls) + rivalBuyableSlots(airports[id].size, hubs.includes(id), ownedTotal(id), freeAtStart(id), deciders, bought[id] ?? 0);
  const playerTier3At = (id: string) => others.some((o) => (o.airports[id]?.managementTier ?? 0) >= MAX_MANAGEMENT_TIER);
  const otherRoutes = others.flatMap((o) => o.routes.map((r) => ({ origin: r.from, destination: r.to, weeklyFrequency: r.departuresPerWeek / 2 })));
  const otherRivalHubs = new Set(
    others.filter((o) => {
      const a = rivalAgentOf(o);
      return a !== undefined && a.distress.status !== 'liquidated';
    }).flatMap((o) => o.hubs ?? []),
  );
  const sizes = new Map<string, { business: number; tourism: number }>();
  const sizeOf = (id: string) => {
    let size = sizes.get(id);
    if (!size) {
      size = citySize(airports[id], next);
      sizes.set(id, size);
    }
    return size;
  };

  /**
   * Die Gesellschaft mit einer weiteren Strecke `plane` zwischen `hub` und `target`: fehlende Slots an beiden Enden
   * gekauft (7.10), Schalter nach `rivalDesksNeeded` an beiden Enden (E55). Für die Planung und die echte Eröffnung.
   */
  const withRoute = (base: CompanyState, plane: AircraftState, hub: string, target: string, f: number, fareRatios: PartialClassFigures, id: string, age: number) => {
    const km = distanceKm(airports[hub].coords, airports[target].coords);
    const route: RouteState = { id, aircraftId: plane.id, from: hub, to: target, departuresPerWeek: 2 * f, ageMonths: age, service: serviceFor(plane, km), fareRatios };
    const planes = base.aircraft.some((p) => p.id === plane.id) ? base.aircraft : [...base.aircraft, plane];
    const nextRoutes = [...base.routes.filter((r) => r.id !== id), route];
    const nextHoldings: Record<string, HoldingState> = { ...base.airports };
    const missing: Record<string, number> = {};
    const deskType = rivalDeskType(personality, next);
    for (const end of [hub, target]) {
      const h = nextHoldings[end] ?? EMPTY_HOLDING;
      const cls = plane.aircraftClass;
      const used = sumOf(
        nextRoutes
          .filter((r) => (r.from === end || r.to === end) && planes.find((p) => p.id === r.aircraftId)?.aircraftClass === cls)
          .map((r) => r.departuresPerWeek / 2),
      );
      missing[end] = Math.max(0, used - (h.slots[cls] ?? 0));
      const seatsOut = sumOf(
        nextRoutes
          .filter((r) => r.from === end || r.to === end)
          .map((r) => seatsOf(planes.find((p) => p.id === r.aircraftId) as AircraftState) * (r.departuresPerWeek / 2)),
      );
      const desks = Math.max(h.desks.normal + h.desks.self, rivalDesksNeeded(seatsOut, deskType));
      nextHoldings[end] = {
        ...h,
        slots: { ...h.slots, [cls]: (h.slots[cls] ?? 0) + missing[end] },
        desks: { normal: deskType === 'normal' ? desks : 0, self: deskType === 'self' ? desks : 0 },
      };
    }
    const slotCost = rivalSlotCost(missing[hub], missing[target], plane.aircraftClass, next);
    return { company: { ...base, aircraft: planes, routes: nextRoutes, airports: nextHoldings }, slotCost, missing, km };
  };

  /** Preisniveau einer neuen Strecke (7.6: Lage 0, kein Preiskampf); der Optimizer plant mit `satisfactionFactor` (F43). */
  const newRouteFares = (plane: AircraftState, satisfaction: PartialClassFigures): PartialClassFigures => {
    const fares: Partial<Record<CabinClass, number>> = {};
    for (const c of CABIN_CLASSES) {
      if (!((plane.seats[c] ?? 0) > 0)) continue;
      const factor = satisfactionFactor(satisfaction[c] ?? SCALES.satisfaction.neutral);
      const target = rivalTargetFareRatio(personality, factor, factor);
      fares[c] = rivalFareRatio({ personality, target, yieldPosition: 0, priceWar: false, breakEvenFull: 0 });
    }
    return fares;
  };
  const planId = `${company.id}-plan`;
  const plannedFares = (base: CompanyState, plane: AircraftState, hub: string, target: string, f: number) => {
    const probe = withRoute(base, plane, hub, target, f, {}, planId, RAMP_MONTHS);
    const figures = plannerRouteFigures(stateWith(probe.company), company.id, planId, 2 * f);
    return newRouteFares(plane, figures.satisfaction);
  };
  const searched = new Set<string>();
  const profitable = new Set<string>();

  /**
   * Planung für ein freies Flugzeug (7.9): Vorauswahl je eigenem Drehkreuz, Bewertung mit der Planer-Hauptzahl einer
   * neuen Strecke (Anlauf 1: Alter `RAMP_MONTHS`, Preise nach 7.6), Schätzfehler; der beste Plan.
   */
  const planOpening = (plane: AircraftState, base: CompanyState, key: string) => {
    const type = typeOf(plane.typeId);
    if (!type) return null;
    const cls = plane.aircraftClass;
    const items: { hub: string; target: string; km: number }[] = [];
    for (const hub of [...hubs].sort()) {
      const h = airports[hub];
      if (!h) continue;
      searched.add(hub);
      const ids = Object.keys(airports)
        .filter((id) => id !== hub)
        .sort();
      const hubRoom = room(hub, cls);
      const candidates: TargetCandidate[] = ids.map((id) => {
        const a = airports[id];
        const size = sizeOf(id);
        return {
          id,
          km: distanceKm(h.coords, a.coords),
          business: size.business,
          tourism: size.tourism,
          otherDepartures: departuresOnPair(otherRoutes, hub, id),
          otherRivalHub: otherRivalHubs.has(id),
          runwayOk: runwayFits(type.icaoCode, a.maxIcaoCode) && runwayFits(type.icaoCode, h.maxIcaoCode),
          slotsFree: hubRoom >= 1 && room(id, cls) >= 1,
          playerTier3: playerTier3At(hub) || playerTier3At(id),
          served: routes.some((r) => pairKeyOf(r.from, r.to) === pairKeyOf(hub, id)),
        };
      });
      const hubSize = sizeOf(hub);
      const chosen = preselectTargets(
        candidates,
        { personality, strength: agent.strength, hubBusiness: hubSize.business, hubTourism: hubSize.tourism, rangeKm: type.maxRange },
        (k) => rng(ctx.seed, X, 'target', `${company.id}|${key}|${hub}|${k}`),
      );
      for (const i of chosen) items.push({ hub, target: ids[i], km: candidates[i].km });
    }
    if (items.length === 0) return null;
    const maxRot = (i: number) =>
      Math.max(1, Math.min(maxWeeklyRotations(2 * blockMinutes(items[i].km, plane.cruiseSpeed)), room(items[i].hub, cls), room(items[i].target, cls)));
    const fares = new Map<number, PartialClassFigures>();
    const evaluate = (i: number, f: number) => {
      const it = items[i];
      let ratios = fares.get(i);
      if (!ratios) {
        ratios = plannedFares(base, plane, it.hub, it.target, maxRot(i));
        fares.set(i, ratios);
      }
      const built = withRoute(base, plane, it.hub, it.target, f, ratios, planId, RAMP_MONTHS);
      const profit = plannerRouteResult(stateWith(built.company), company.id, planId, 2 * f);
      if (profit > 0) profitable.add(it.hub);
      return profit;
    };
    const plan = rivalPlanRoute(
      items.map((_, i) => i),
      maxRot,
      evaluate,
      agent.strength,
      (k) => 2 * rng(ctx.seed, X, 'forecast', `${company.id}|${key}|${k}`) - 1,
    );
    if (!plan) return null;
    return { ...items[plan.targetIndex], plan, fareRatios: fares.get(plan.targetIndex) as PartialClassFigures };
  };

  /** Eröffnet die Strecke: Slots kaufen (Kasse), Strecke ab X+1 mit Preisen nach 7.6 (`nextFareRatios`). */
  const openRoute = (plane: AircraftState, hub: string, target: string, f: number, fareRatios: PartialClassFigures) => {
    // Alter −1: Der Übergang zählt es auf 0; die Strecke fliegt ab X+1 im ersten Monat (3.12).
    const built = withRoute(current(), plane, hub, target, f, fareRatios, newId('r'), -1);
    const route = built.company.routes[built.company.routes.length - 1];
    routes = built.company.routes.map((r) => (r.id === route.id ? { ...r, fareRatios: undefined, nextFareRatios: fareRatios } : r));
    holdings = { ...built.company.airports };
    for (const [id, n] of Object.entries(built.missing)) bought[id] = (bought[id] ?? 0) + n;
    cash -= built.slotCost;
    say('routeOpened', route.id, built.slotCost);
  };

  // 5 fleet (7.11): Modernisierung, Grundüberholung, Kabinen-Erneuerung, Leerlauf-Verkauf, Notverkauf; Werte am
  // Monatsende (X + 1, nach dem Verschleiß).
  const overhauls: Record<string, number> = { ...agent.overhauls };
  const refits: Record<string, number> = { ...(agent.refits ?? {}) };
  const sell = (planeId: string) => {
    const plane = planeOf(planeId);
    const proceeds = saleProceeds(aircraftValue(plane, next), resaleBonus);
    cash += proceeds;
    aircraft = aircraft.filter((p) => p.id !== planeId);
    routes = routes.filter((r) => r.aircraftId !== planeId);
    sold.push({ ...plane, soldMonth: X });
    say('planeSold', planeId, proceeds);
  };

  // 5a Modernisierung: das älteste Flugzeug, das sie braucht; Ersatz derselben Bauart nach Planer-Hauptzahl je Preis.
  if (catalog.length > 0 && !severityGrowthStop) {
    const views = aircraft.map((p) => ({
      id: p.id,
      builtMonth: p.builtMonth,
      typeLastDeliveryOffset: typeOf(p.typeId)?.lastDeliveryOffset ?? null,
      airframeCondition: p.airframeCondition,
      cabinCondition: p.cabinCondition,
      flying: true,
      routeResult: 0,
      idleMonths: 0,
    }));
    const index = modernizationCandidate(views, X);
    const old = index >= 0 ? aircraft[index] : undefined;
    const route = old && routes.find((r) => r.aircraftId === old.id);
    if (old && route) {
      const km = kmOf(route);
      const candidateId = `${company.id}-candidate`;
      const options: PurchaseOption[] = catalog.map((t) => {
        const fits =
          t.class === old.aircraftClass &&
          isOnMarket(t, next) &&
          t.maxRange >= km &&
          runwayFits(t.icaoCode, airports[route.from].maxIcaoCode) &&
          runwayFits(t.icaoCode, airports[route.to].maxIcaoCode);
        if (!fits) return { ...t, runwayOk: false, inRange: false, price: 0, expectedProfit: 0 };
        const candidate = rivalAircraft(personality, t, next, candidateId);
        const swapped: CompanyState = {
          ...current(),
          aircraft: [...aircraft.filter((p) => p.id !== old.id), candidate],
          routes: routes.map((r) => (r.id === route.id ? { ...r, aircraftId: candidateId, service: serviceFor(candidate, km) } : r)),
        };
        return {
          ...t,
          runwayOk: true,
          inRange: true,
          price: newAircraftPrice(candidate.listPrice1960, candidate.cabinListPrice1960, next),
          expectedProfit: plannerRouteResult(stateWith(swapped), company.id, route.id, route.departuresPerWeek),
        };
      });
      const pick = pickPurchaseType(options, next);
      if (pick >= 0) {
        const price = options[pick].price;
        const oldProceeds = saleProceeds(aircraftValue(old, next), resaleBonus);
        if (mayModernize(personality, X, cash, oldProceeds, price, severityGrowthStop)) {
          const plane = rivalAircraft(personality, catalog[pick], next, newId('a'));
          cash -= price;
          aircraft = [...aircraft, plane];
          routes = routes.map((r) => (r.aircraftId === old.id ? { ...r, aircraftId: plane.id, service: serviceFor(plane, kmOf(r)) } : r));
          sell(old.id);
          say('modernized', plane.id, price);
        }
      }
    }
  }

  // 5b Grundüberholung (8.13): hebt nur die Zelle.
  for (const plane of [...aircraft]) {
    if (!needsOverhaul({ airframeCondition: plane.airframeCondition, cabinCondition: 100 })) continue;
    const done = overhauls[plane.id] ?? 0;
    const quote = overhaulQuote(plane, next, done, false);
    if (!quote || !mayOverhaul(personality, X, cash, quote.price)) continue;
    cash -= quote.price;
    overhauls[plane.id] = done + 1;
    aircraft = aircraft.map((p) => (p.id === plane.id ? { ...p, airframeCondition: quote.airframeAfter } : p));
    say('overhaul', plane.id, quote.price);
  }

  // 5c Kabinen-Erneuerung (F43): Kabinenzustand unter `RIVAL_OVERHAUL_BELOW` → dieselbe Kabine neu (Umbau-Preis und
  // -Zustand 8.13). Die KI baut nie auf eine andere Kabine um (7.5). Nur, wenn die Kabine danach wieder mindestens bei
  // `RIVAL_OVERHAUL_BELOW` ist (F45): Sonst wäre sie im nächsten Monat wieder fällig, und die KI zahlte jeden Monat den
  // vollen Preis für weniger als einen Punkt Zustand.
  for (const plane of [...aircraft]) {
    if (!needsOverhaul({ airframeCondition: 100, cabinCondition: plane.cabinCondition })) continue;
    const done = refits[plane.id] ?? 0;
    const price = refitPrice(plane.cabinListPrice1960, seatsOf(plane), next);
    const after = refitCabinCondition(plane.cabinCondition, done);
    if (after < RIVAL_OVERHAUL_BELOW || !(after > plane.cabinCondition) || !mayOverhaul(personality, X, cash, price)) continue;
    cash -= price;
    refits[plane.id] = done + 1;
    aircraft = aircraft.map((p) => (p.id === plane.id ? { ...p, cabinCondition: after, cabinInstalledMonth: next } : p));
    say('cabinRenewed', plane.id, price);
  }

  // 5d Leerlauf- und Notverkauf.
  const idleMonths: Record<string, number> = {};
  for (const plane of aircraft) idleMonths[plane.id] = nextIdleMonths(agent.idleMonths[plane.id] ?? 0, routes.some((r) => r.aircraftId === plane.id));
  for (const plane of [...aircraft]) {
    if (!routes.some((r) => r.aircraftId === plane.id) && sellIdle(idleMonths[plane.id], inCrisis)) sell(plane.id);
  }
  const planeResult = (id: string) => sumOf(ctx.operations.routes.filter((r) => r.aircraftId === id).map((r) => r.result));
  const emergency = emergencySaleCandidate(
    aircraft.map((p) => ({
      id: p.id,
      builtMonth: p.builtMonth,
      typeLastDeliveryOffset: null,
      airframeCondition: p.airframeCondition,
      cabinCondition: p.cabinCondition,
      flying: routes.some((r) => r.aircraftId === p.id),
      routeResult: planeResult(p.id),
      idleMonths: idleMonths[p.id] ?? 0,
    })),
    cash,
  );
  if (emergency >= 0) sell(aircraft[emergency].id);

  // 6 openings (7.9, 7.10): freie Flugzeuge auf neue Strecken; je Monat `actionsPerMonth` Versuche (7.3).
  let attempts = 0;
  const reserve = rivalCashReserve(personality, next);
  for (const plane of [...aircraft].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (attempts >= RIVAL_STRENGTH[agent.strength].actionsPerMonth) break;
    if (routes.some((r) => r.aircraftId === plane.id)) continue;
    attempts++;
    const found = planOpening(plane, current(), plane.id);
    if (!found) continue;
    const slotCost = withRoute(current(), plane, found.hub, found.target, found.plan.weeklyFrequency, {}, planId, 0).slotCost;
    if (!mayOpenRoute(found.plan, agent.strength, rng(ctx.seed, X, 'open', `${company.id}|${plane.id}`), cash, slotCost, reserve)) continue;
    openRoute(plane, found.hub, found.target, found.plan.weeklyFrequency, found.fareRatios);
  }

  // 7 growth (7.11, 7.13): Kauf mit Strecke, neues Drehkreuz.
  const buyChance = rivalBuyChance(agent.strength, personality);
  const uBuy = rng(ctx.seed, X, 'buy', company.id);
  const allFlying = aircraft.every((p) => routes.some((r) => r.aircraftId === p.id));
  if (catalog.length > 0 && hubs.length > 0 && allFlying && !severityGrowthStop && uBuy < buyChance) {
    const newest = [...aircraft].sort((a, b) => b.builtMonth - a.builtMonth || (a.id < b.id ? -1 : 1))[0];
    const ref = referenceTypeIndex(catalog, newest?.typeId, next);
    if (ref >= 0) {
      const candidateId = `${company.id}-candidate`;
      const refPlane = rivalAircraft(personality, catalog[ref], next, candidateId);
      const found = planOpening(refPlane, current(), 'buy');
      const wanted = found !== null && mayOpenRoute(found.plan, agent.strength, rng(ctx.seed, X, 'open', `${company.id}|buy`), Infinity, 0, 0);
      if (found && wanted) {
        const options: PurchaseOption[] = catalog.map((t) => {
          const fits =
            isOnMarket(t, next) &&
            t.maxRange >= found.km &&
            runwayFits(t.icaoCode, airports[found.hub].maxIcaoCode) &&
            runwayFits(t.icaoCode, airports[found.target].maxIcaoCode);
          const cls = t.class as AircraftClass;
          const f = Math.min(found.plan.weeklyFrequency, maxWeeklyRotations(2 * blockMinutes(found.km, t.cruiseSpeed)));
          if (!fits || room(found.hub, cls) < f || room(found.target, cls) < f) {
            return { ...t, runwayOk: false, inRange: false, price: 0, expectedProfit: 0 };
          }
          const candidate = rivalAircraft(personality, t, next, candidateId);
          const built = withRoute(current(), candidate, found.hub, found.target, f, found.fareRatios, planId, RAMP_MONTHS);
          return {
            ...t,
            runwayOk: true,
            inRange: true,
            price: newAircraftPrice(candidate.listPrice1960, candidate.cabinListPrice1960, next),
            expectedProfit: plannerRouteResult(stateWith(built.company), company.id, planId, 2 * f),
          };
        });
        const pick = pickPurchaseType(options, next);
        if (pick >= 0) {
          const plane = rivalAircraft(personality, catalog[pick], next, newId('a'));
          const f = Math.min(found.plan.weeklyFrequency, maxWeeklyRotations(2 * blockMinutes(found.km, plane.cruiseSpeed)));
          const price = options[pick].price;
          const slotCost = withRoute(current(), plane, found.hub, found.target, f, {}, planId, 0).slotCost;
          const blocker = rivalBuyBlocker({
            personality,
            strength: agent.strength,
            month: next,
            cash,
            allFlying,
            growthStop: severityGrowthStop,
            routeFound: true,
            price,
            slotCost,
            recentProfit: hadRecentProfit([...company.reports.map((r) => r.result), ctx.result]),
            u: uBuy,
            buyChance,
          });
          if (blocker === null) {
            cash -= price;
            aircraft = [...aircraft, plane];
            say('planeBought', plane.id, price);
            openRoute(plane, found.hub, found.target, f, plannedFares(current(), plane, found.hub, found.target, f));
          }
        }
      }
    }
  }

  // 7b Neues Drehkreuz (7.13): Ort nach Gewicht, Kauf der Verwaltungsstufen 1 und 2.
  const hubNoProfit: Record<string, number> = {};
  for (const hub of hubs) {
    const before = agent.hubNoProfit?.[hub] ?? 0;
    hubNoProfit[hub] = !searched.has(hub) ? before : profitable.has(hub) ? 0 : before + 1;
  }
  const uHub = rng(ctx.seed, X, 'newHub', company.id);
  if (hubs.length > 0 && uHub < NEW_HUB_CHANCE && !severityGrowthStop) {
    const rivalHubs = new Set(ctx.state.companies.filter((c) => rivalAgentOf(c) !== undefined).flatMap((c) => c.hubs ?? []));
    const playerHubs = new Set(ctx.state.companies.filter((c) => rivalAgentOf(c) === undefined).flatMap((c) => c.hubs ?? []));
    const ids = Object.keys(airports).sort();
    const candidates: NewHubCandidate[] = ids.map((id) => {
      const size = sizeOf(id);
      return {
        id,
        level: airports[id].size,
        demand: size.business + size.tourism,
        region: airports[id].region,
        rivalHub: rivalHubs.has(id) || hubs.includes(id),
        playerHub: playerHubs.has(id),
        playerTier3: playerTier3At(id),
      };
    });
    const homeRegion = airports[hubs[0]]?.region;
    const pick = homeRegion ? weightedPick(newHubWeights(candidates, personality, homeRegion), rng(ctx.seed, X, 'hubPlace', company.id)) : -1;
    if (pick >= 0) {
      const id = ids[pick];
      const tierPrice = newHubTierPrice(airports[id].size, next);
      const ownHubs: OwnHubView[] = hubs.map((h) => ({
        usedSlots: sumOf(AIRCRAFT_CLASSES.map((cls) => usedBy(h, cls))),
        airportSize: airports[h]?.size ?? 1,
        monthsWithoutProfitableRoute: hubNoProfit[h] ?? 0,
      }));
      const size = rivalSize(routes.map((r) => ({ seats: seatsOf(planeOf(r.aircraftId)), weeklyFrequency: r.departuresPerWeek / 2 })));
      if (wantsNewHub({ personality, ownHubs, size, cash, month: next, tierPrice, growthStop: severityGrowthStop, u: uHub })) {
        cash -= tierPrice;
        holdings[id] = { ...(holdings[id] ?? EMPTY_HOLDING), managementTier: rivalManagementTier(true) };
        hubs.push(id);
        hubNoProfit[id] = 0;
        say('newHub', id, tierPrice);
      }
    }
  }

  // 7c Bestand nach allen Strecken (7.10): VIP-Lounge, Verkauf freier Slots, Schalter, Fahrpläne.
  for (const hub of hubs) {
    const h = holdings[hub];
    if (!h) continue;
    const premium = routes.some(
      (r) => (r.from === hub || r.to === hub) && ((planeOf(r.aircraftId).seats.business ?? 0) > 0 || (planeOf(r.aircraftId).seats.first ?? 0) > 0),
    );
    if (rivalBuildsLounge(personality, h.facilities.includes('vipLounge'), premium, cash, next)) {
      const price = facilityPrice('vipLounge', next);
      cash -= price;
      holdings[hub] = { ...h, facilities: [...h.facilities, 'vipLounge'] };
      say('loungeBuilt', hub, price);
    }
  }
  const slotFree: Record<string, number[]> = {};
  for (const id of Object.keys(holdings).sort()) {
    for (const cls of AIRCRAFT_CLASSES) {
      const h = holdings[id];
      const owned = h.slots[cls] ?? 0;
      if (owned <= 0) continue;
      const key = `${id}|${cls}`;
      const history = [...(agent.slotFree?.[key] ?? []), Math.max(0, owned - usedBy(id, cls))].slice(-RIVAL_SLOT_IDLE_MONTHS);
      const n = idleSlotsToSell(history);
      if (n > 0) {
        const proceeds = n * slotResalePrice(cls, next, company.inputs.completedResearch);
        cash += proceeds;
        holdings[id] = { ...h, slots: { ...h.slots, [cls]: owned - n } };
        say('slotsSold', `${id}|${cls}`, proceeds);
      }
      slotFree[key] = history.map((v) => Math.max(0, v - n));
    }
  }
  const deskType = rivalDeskType(personality, next);
  const ends = new Set([...Object.keys(holdings), ...routes.flatMap((r) => [r.from, r.to])]);
  for (const id of [...ends].sort()) {
    const seatsOut = sumOf(routes.filter((r) => r.from === id || r.to === id).map((r) => seatsOf(planeOf(r.aircraftId)) * (r.departuresPerWeek / 2)));
    const n = rivalDesksNeeded(seatsOut, deskType);
    const h = holdings[id] ?? EMPTY_HOLDING;
    const desks = { normal: deskType === 'normal' ? n : 0, self: deskType === 'self' ? n : 0 };
    const empty = n === 0 && h.managementTier === 0 && h.facilities.length === 0 && AIRCRAFT_CLASSES.every((cls) => !(h.slots[cls] ?? 0));
    if (empty && !hubs.includes(id)) {
      const { [id]: _dropped, ...rest } = holdings;
      holdings = rest;
    } else if (h.desks.normal !== desks.normal || h.desks.self !== desks.self || !holdings[id]) {
      holdings[id] = { ...h, desks };
    }
  }
  routes = routes.map((r) => ({ ...r, schedule: rivalSchedule(r.departuresPerWeek / 2, blockMinutes(kmOf(r), planeOf(r.aircraftId).cruiseSpeed)) }));

  // 8 dividend (7.13): nach allen Buchungen der KI.
  const costHistory = [...agent.costHistory, ctx.costsTotal].slice(-DIVIDEND_COST_WINDOW);
  const dividend = rivalDividend(cash, dividendLimit(X, costHistory));
  if (dividend > 0) {
    cash -= dividend;
    say('dividend', undefined, dividend);
  }

  // 9 distress (7.15) mit Auflösung: Flugzeuge in den Gebrauchtmarkt, Slots frei, Schulden verfallen.
  const step = rivalDistressStep(agent.distress, { cash, creditLimit: creditLimit(fleetValue(aircraft, next)), aircraftCount: aircraft.length });
  if (step.event) say(step.event, undefined, step.event === 'liquidated' ? Math.max(0, -cash) : undefined);
  let hubsAfter: string[] = hubs;
  if (step.state.status === 'liquidated') {
    const out = liquidate(aircraft, [], cash);
    sold.push(...out.toUsedMarket.map((p) => ({ ...p, soldMonth: X })));
    aircraft = [];
    routes = [];
    holdings = {};
    hubsAfter = [];
    cash = 0;
  }

  const keptRoutes: Record<string, RivalRouteMemory> = {};
  for (const r of routes) keptRoutes[r.id] = memory[r.id] ?? {};
  const keptIdle: Record<string, number> = {};
  for (const p of aircraft) keptIdle[p.id] = idleMonths[p.id] ?? 0;
  const keptOverhauls: Record<string, number> = {};
  for (const p of aircraft) if (overhauls[p.id]) keptOverhauls[p.id] = overhauls[p.id];
  const keptRefits: Record<string, number> = {};
  for (const p of aircraft) if (refits[p.id]) keptRefits[p.id] = refits[p.id];
  const nextAgent: RivalAgent = {
    ...agent,
    distress: step.state,
    routes: keptRoutes,
    idleMonths: keptIdle,
    overhauls: keptOverhauls,
    costHistory,
    slotFree: step.state.status === 'liquidated' ? {} : slotFree,
    hubNoProfit: step.state.status === 'liquidated' ? {} : hubNoProfit,
    refits: keptRefits,
  };
  const hubsField = company.hubs === undefined && hubsAfter.length === 0 ? {} : { hubs: hubsAfter };
  return {
    company: { ...company, routes, aircraft, cash, airports: holdings, ...hubsField, agent: nextAgent },
    sold,
    news,
  };
}

/** Bestand an einem Flughafen ohne Stufe, Slots, Schalter und Einrichtungen. */
const EMPTY_HOLDING: HoldingState = { managementTier: 0, slots: {}, stands: {}, desks: { normal: 0, self: 0 }, facilities: [] };

// ---------------------------------------------------------------------------
// 7.7 Gründung und Nachrücken im Abschluss (Paket 3.8d)
// ---------------------------------------------------------------------------

/** Eine echte Gesellschaft als möglicher Nachrücker (Felder wie `src/data/rivalAirlines.ts`). */
export interface RealRivalInput {
  readonly code: string;
  readonly hub: string;
  readonly founded: number;
  readonly ceased?: number;
  readonly personality: RivalPersonality;
}

/** Einstellungen des Nachrückens (beim Spielstart gewählt). */
export interface RivalRefillSettings {
  /** Gewählte Zahl der KI. */
  readonly wanted: number;
  readonly strength: RivalStrength;
  /** Echte Gesellschaften; Standard aus `src/data/rivalAirlines.ts`. */
  readonly realAirlines?: readonly RealRivalInput[];
}

/**
 * Gründet eine KI im Spielstand-Monat (7.7): echt (im Jahr aktiv, an ihrem Drehkreuz, gewichtet nach √Nachfrage) oder
 * erfunden (`fictionalRivalCount` für eine KI; Drehkreuz nach `fictionalHubWeights`, Persönlichkeit gleich verteilt);
 * nie am Drehkreuz einer anderen Gesellschaft oder mit Spieler-Stufe 3. Startkasse nach Stärke, Startflotte neu mit
 * Kabine nach 7.5 (kommt zur Kasse dazu), Stufe 2 und ein bedienter Schalter am Drehkreuz, keine Slots, Ruf 50, Zuschuss
 * nach 7.14. `null`, wenn kein Ort frei ist oder kein Typ lieferbar. SPEZIFIKATION 7.7.
 *
 * @param key Schlüssel der Zufallszahlen (mehrere Gründungen im selben Monat).
 */
export function foundRivalCompany(
  state: ModelState,
  strength: RivalStrength,
  realAirlines: readonly RealRivalInput[] = REAL_AIRLINES,
  key = 'refill',
): CompanyState | null {
  const month = state.month;
  const year = yearOf(month);
  const u = (purpose: string, k: string | number = 0) => rng(state.seed, month, purpose, `${key}|${k}`);
  const living = state.companies.filter((c) => rivalAgentOf(c)?.distress.status !== 'liquidated');
  const rivalHubs = new Set(living.filter((c) => rivalAgentOf(c) !== undefined).flatMap((c) => c.hubs ?? []));
  const playerHubs = new Set(living.filter((c) => rivalAgentOf(c) === undefined).flatMap((c) => c.hubs ?? []));
  const tier3 = (id: string) => living.some((c) => (c.airports[id]?.managementTier ?? 0) >= MAX_MANAGEMENT_TIER);
  const candidateOf = (a: ModelAirport): HubCandidate => {
    const size = citySize(a, month);
    return { id: a.id, level: a.size, demand: size.business + size.tourism, playerHub: playerHubs.has(a.id), rivalHub: rivalHubs.has(a.id), playerTier3: tier3(a.id) };
  };
  const taken = new Set(state.companies.map((c) => c.id));

  let personality: RivalPersonality | undefined;
  let hub: string | undefined;
  let id = '';
  if (fictionalRivalCount(1, u('fictional')) === 0) {
    const real = realAirlines.filter(
      (r) => r.founded <= year && (r.ceased === undefined || year < r.ceased) && state.airports[r.hub] && !taken.has(`rival-${r.code}`),
    );
    const pick = weightedPick(
      real.map((r) => realRivalWeight(candidateOf(state.airports[r.hub]))),
      u('real'),
    );
    if (pick >= 0) {
      personality = real[pick].personality;
      hub = real[pick].hub;
      id = `rival-${real[pick].code}`;
    }
  }
  if (!hub) {
    const airports = Object.values(state.airports).sort((a, b) => (a.id < b.id ? -1 : 1));
    const pick = weightedPick(fictionalHubWeights(airports.map(candidateOf)), u('hub'));
    if (pick < 0 || !mayFoundAt(candidateOf(airports[pick]))) return null;
    const kinds = Object.keys(PERSONALITIES).sort() as RivalPersonality[];
    personality = kinds[weightedPick(kinds.map(() => 1), u('personality'))];
    hub = airports[pick].id;
    id = `rival-f${month}-${hub}`;
    if (taken.has(id)) return null;
  }
  const p = personality as RivalPersonality;
  const catalog = state.catalog ?? [];
  const aircraft: AircraftState[] = [];
  startFleetKinds(strength).forEach((kind, i) => {
    const index = pickStartAircraft(p, kind, catalog, month, (t) => u('startType', `${i}|${t}`));
    if (index >= 0) aircraft.push(rivalAircraft(p, catalog[index], month, `${id}-a${i + 1}`));
  });
  if (aircraft.length === 0) return null;
  const cash = rivalStartCash(strength, month, 2 * u('cash') - 1);
  const setup = rivalStartSetup();
  return {
    id,
    cash,
    reputation: setup.reputation,
    inputs: { ...RIVAL_INPUTS, campaigns: [], subsidized: true },
    aircraft,
    routes: [],
    airports: {
      [hub]: { managementTier: setup.managementTier, slots: {}, stands: {}, desks: { ...setup.desks }, facilities: [] },
    },
    preorders: [],
    overdrawnMonths: 0,
    profitStreak: 0,
    ledger: newLedger(cash, fleetValue(aircraft, month), 0),
    reports: [],
    hubs: [hub],
    agent: newRivalAgent(p, strength),
  };
}

/**
 * Nachrücken (7.7) als letzter Schritt des Abschlusses (`closeMonth(state, rivalDecisions, rivalRefill(...))`): fehlen
 * KI zur gewählten Zahl (aufgelöste zählen nicht), rückt mit `RIVAL_REFILL_CHANCE` eine nach (`foundRivalCompany`), im
 * neuen Monat (Kasse mit `atCost`, W5). SPEZIFIKATION 7.7, 7.19.
 */
export function rivalRefill(settings: RivalRefillSettings): AfterClose {
  return (state) => {
    const active = state.companies.filter((c) => {
      const a = rivalAgentOf(c);
      return a !== undefined && a.distress.status !== 'liquidated';
    }).length;
    if (!shouldRefill(active, settings.wanted, rng(state.seed, state.month, 'refill', 'chance'))) return { state };
    const company = foundRivalCompany(state, settings.strength, settings.realAirlines ?? REAL_AIRLINES);
    if (!company) return { state };
    return {
      state: { ...state, companies: [...state.companies, company] },
      news: [{ companyId: company.id, kind: 'newRival', subject: company.hubs?.[0] }],
    };
  };
}

// ---------------------------------------------------------------------------
// 7.16 Übernahme im Spielstand (Paket 3.8c)
// ---------------------------------------------------------------------------

/** Unternehmenswert einer Gesellschaft im Monat (6.12): Kasse, Flugzeuge, Slots zum Verkaufswert (5.10), Anzahlungen. */
export function companyValueOf(company: CompanyState, month: number): CompanyValueInput {
  let slotResaleValue = 0;
  for (const holding of Object.values(company.airports)) {
    for (const cls of AIRCRAFT_CLASSES) slotResaleValue += (holding.slots[cls] ?? 0) * slotResalePrice(cls, month, company.inputs.completedResearch);
  }
  return {
    cash: company.cash,
    aircraftValues: company.aircraft.map((p) => aircraftValue(p, month)),
    slotResaleValue,
    preorderDeposits: company.preorders.reduce((sum, p) => sum + p.deposit, 0),
  };
}

/**
 * Übernahme einer KI durch die Gesellschaft `buyerId` während des Monats (7.16, E48): Preis = Unternehmenswert der KI
 * (`takeoverPrice`); der Käufer bekommt ihre Kasse (auch negativ), alle Flugzeuge abgestellt mit Alter, Zustand und
 * Kabine, alle Slots und Schalter je Flughafen und dort mindestens Stufe 1, an ihren Drehkreuzen Stufe 2. Strecken,
 * Einrichtungen und Ruf der KI verfallen; kein Ruf-Sprung (E38); Übernahmen + 1. Die KI verschwindet.
 *
 * Buchung (5.13, 5.16): Die Flugzeuge gehen zum Wert ins Kassenbuch (Kauf zum Wert, ergebnisneutral); der Rest
 * `Preis − KI-Kasse − Σ Flugzeugwerte` ist eine Einmalausgabe `takeover` ohne Ergebnis-Wirkung. So ändert die
 * Übernahme das Monatsergebnis nicht. Rang und Status prüft `mayTakeOver`. SPEZIFIKATION 7.16.
 */
export function takeOverCompany(state: ModelState, buyerId: string, rivalId: string): ModelState {
  const buyer = state.companies.find((c) => c.id === buyerId);
  const rival = state.companies.find((c) => c.id === rivalId);
  if (!buyer || !rival || buyer === rival) throw new Error(`takeOverCompany: ${buyerId} / ${rivalId} fehlt`);
  const month = state.month;
  const price = takeoverPrice(companyValueOf(rival, month), month);
  const planesValue = rival.aircraft.reduce((sum, p) => sum + aircraftValue(p, month), 0);
  const rest = price - rival.cash - planesValue;

  const airports: Record<string, HoldingState> = { ...buyer.airports };
  const rivalHubs = new Set(rival.hubs ?? []);
  for (const [id, h] of Object.entries(rival.airports)) {
    const mine = airports[id];
    const slots: Partial<Record<AircraftClass, number>> = { ...(mine?.slots ?? {}) };
    for (const cls of AIRCRAFT_CLASSES) if (h.slots[cls]) slots[cls] = (slots[cls] ?? 0) + (h.slots[cls] ?? 0);
    airports[id] = {
      managementTier: Math.max(mine?.managementTier ?? 0, rivalHubs.has(id) ? RIVAL_HUB_TIER : TAKEOVER_MIN_TIER),
      slots,
      stands: mine?.stands ?? {},
      desks: { normal: (mine?.desks.normal ?? 0) + h.desks.normal, self: (mine?.desks.self ?? 0) + h.desks.self },
      facilities: mine?.facilities ?? [],
    };
  }
  const l = buyer.ledger;
  const bought: CompanyState = {
    ...buyer,
    cash: buyer.cash - price + rival.cash,
    aircraft: [...buyer.aircraft, ...rival.aircraft],
    airports,
    progress: buyer.progress ? { ...buyer.progress, takeovers: buyer.progress.takeovers + 1 } : buyer.progress,
    ledger: {
      ...l,
      purchases: l.purchases + planesValue,
      tradeValueChange: l.tradeValueChange + planesValue,
      otherSpending: { ...l.otherSpending, takeover: (l.otherSpending.takeover ?? 0) + rest },
    },
  };
  return { ...state, companies: state.companies.filter((c) => c.id !== rivalId).map((c) => (c.id === buyerId ? bought : c)) };
}
