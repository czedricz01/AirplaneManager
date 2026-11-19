/**
 * Konkurrenz Teil b: SPEZIFIKATION 7.8–7.17 (Paket 3.7b).
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

import { atCost, clamp, timeOf } from './basics';
import { facilityPrice, managementTierPrice, slotLimit, slotPrice } from './airportCosts';
import { fuelTable } from './costs';
import { eventDemandFactor, type DemandEvent } from './demand';
import { companyValue, hasUnlock, type CompanyValueInput } from './progress';
import { deskCapacity } from './satisfaction';
import { isOnMarket, longHaulFactor, rivalCashReserve, rivalPatience, targetWeight, weightedPick } from './rivals';
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
  SUBSIDY_HIGH_1960,
  SUBSIDY_HIGH_UNTIL,
  SUBSIDY_LOW_1960,
  SUBSIDY_LOW_FROM,
  TAKEOVER_MIN_PRICE_1960,
  TAKEOVER_MIN_TIER,
  THIN_SHARE,
  WEEKLY_OPERATING_MINUTES,
  WORLD_REGIONS,
  type AircraftClass,
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
 * `√(Gewicht(Drehkreuz) × Gewicht(Ziel)) × min(1, km / (0,2 × Reichweite)) × Langstrecken-Faktor
 *  / (1 + Abflüge anderer / 14)`. Nicht erlaubte Ziele 0. SPEZIFIKATION 7.9.
 */
export function preselectScore(target: TargetCandidate, ctx: PreselectContext): number {
  if (!isEligibleTarget(target, ctx.rangeKm)) return 0;
  const hub = targetWeight(ctx.personality, ctx.hubBusiness, ctx.hubTourism);
  const dest = targetWeight(ctx.personality, target.business, target.tourism);
  return (
    (Math.sqrt(Math.max(0, hub * dest)) *
      Math.min(1, target.km / (PRESELECT_RANGE_SHARE * ctx.rangeKm)) *
      longHaulFactor(ctx.personality, target.km)) /
    (1 + target.otherDepartures / PRESELECT_CROWDING_DEPARTURES)
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
 * (auch wenn alle Strecken Gewinn machen, W11). −1 = keines (Kasse ≥ 0 oder keine Flugzeuge). Erlös aus dem
 * Wertmodell mit Händler-Spanne (8.11). SPEZIFIKATION 7.11.
 */
export function emergencySaleCandidate(planes: readonly RivalPlaneView[], cash: number): number {
  if (!(cash < 0) || planes.length === 0) return -1;
  const idle = planes.findIndex((p) => !p.flying);
  if (idle !== -1) return idle;
  let worst = 0;
  planes.forEach((p, i) => {
    if (p.routeResult < planes[worst].routeResult) worst = i;
  });
  return worst;
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

/**
 * Zuschuss je Monat in $ von 1960: 450 000 bis 1985, dann gerade fallend auf 150 000 bis 2005, danach 150 000.
 * Stetige Zeit (R5). SPEZIFIKATION 7.14.
 */
export function subsidy1960(month: number): number {
  const t = timeOf(month);
  if (t <= SUBSIDY_HIGH_UNTIL) return SUBSIDY_HIGH_1960;
  if (t >= SUBSIDY_LOW_FROM) return SUBSIDY_LOW_1960;
  const share = (t - SUBSIDY_HIGH_UNTIL) / (SUBSIDY_LOW_FROM - SUBSIDY_HIGH_UNTIL);
  return SUBSIDY_HIGH_1960 + (SUBSIDY_LOW_1960 - SUBSIDY_HIGH_1960) * share;
}

/**
 * Zuschuss einer KI im Monat: `atCost(subsidy1960(month), month)`, ausgeschaltet 0. Steht im Monatsergebnis der KI
 * als eigene Zeile „Subsidy“. Bis zur Abschaffung (Prüfregel 7.14 im Balance-Skript 3.9). SPEZIFIKATION 7.14.
 */
export function rivalSubsidy(month: number, enabled: boolean = RIVAL_SUBSIDY_ENABLED): number {
  return enabled ? atCost(subsidy1960(month), month) : 0;
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
