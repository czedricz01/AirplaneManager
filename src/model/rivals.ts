/**
 * Konkurrenz: SPEZIFIKATION Abschnitt 7.
 *
 * Teil a (Paket 3.7a): 7.1 gleiche Wirtschaft (neutrale Eingaben), 7.2 bewusst fehlende Teile, 7.3 KI-Stärke,
 * 7.4 Persönlichkeiten, 7.5 Kabine und Service, 7.6 Preise mit Preiskampf, 7.7 Gründung.
 *
 * Grundsatz (E44): Die KI rechnet mit **denselben** Funktionen wie der Spieler. Diese Datei enthält nur, was die
 * KI anders **entscheidet**, und die neutralen Eingaben für die Teile, die ihr fehlen (7.2). Kein anderer
 * Modell-Pfad fragt „ist das eine KI?“.
 */

import { atCost, clamp } from './basics';
import {
  cabinSpace,
  deliverableExtras,
  economySeatsLeft,
  isDeliverable,
  seatSpace,
  type CabinFit,
  type ClassInterior,
} from './cabin';
import { isDeskTypeAvailable } from './airportCosts';
import { flightTimeIndex, mealWeight, type ServiceSelection } from './satisfaction';
import { sizeClassOf, type SizeClassInput } from './progress';
import {
  CABIN_CLASSES,
  FARE_RATIO_MAX,
  FARE_RATIO_MIN,
  FARE_STEP,
  FEATURE_POINTS,
  FICTIONAL_SHARE_BASE,
  FICTIONAL_SHARE_SPREAD,
  FICTIONAL_SINGLE_CHANCE,
  LOAD_HIGH,
  LOAD_LOW,
  LONG_HAUL_KM,
  MEALS_MAX,
  MORALE_NEUTRAL,
  PATIENCE_AGGRESSION_PIVOT,
  PERSONALITIES,
  PRICE_WAR_COOLDOWN,
  PRICE_WAR_CUT,
  PRICE_WAR_MAX_MONTHS,
  PRICE_WAR_MIN_AGGRESSION,
  PRICE_WAR_MIN_ROUTE_AGE,
  PRICE_WAR_WINDOW,
  RIVAL_BASIC_FEATURES,
  RIVAL_HUB_FALLBACK_LEVEL,
  RIVAL_HUB_MIN_LEVEL,
  RIVAL_REFILL_CHANCE,
  RIVAL_START_CASH_NOISE_1960,
  RIVAL_STRENGTH,
  SEAT_TYPE_POINTS,
  START_AIRCRAFT_AGE_PENALTY,
  START_AIRCRAFT_NOISE,
  START_AIRCRAFT_WEIGHTS,
  START_HUB_SETUP,
  START_REPUTATION,
  YIELD_MAX,
  type CabinClass,
  type CampaignTier,
  type DeskType,
  type Difficulty,
  type PersonalityDef,
  type RivalPersonality,
  type RivalStrength,
  type RivalStrengthDef,
} from './constants';

// ---------------------------------------------------------------------------
// 7.1, 7.2 Gleiche Wirtschaft, bewusst fehlende Teile
// ---------------------------------------------------------------------------

/**
 * Die Eingaben, mit denen das Modell eine KI rechnet: überall der neutrale Wert (7.2). Der Aufrufer (3.8) reicht
 * sie an dieselben Funktionen wie beim Spieler (7.1). Kein Modell-Pfad fragt „ist das eine KI?“.
 * SPEZIFIKATION 7.1, 7.2.
 */
export const RIVAL_INPUTS = {
  /** Forschung: keine (`researchCostFactor`, `researchPart`, `aircraftEfficiency`, `researchEffects` neutral). */
  completedResearch: [] as readonly string[],
  /** Personal: Lohn 100 % (`payFactor = 1`), Moral neutral (`staffPart = 0`), kein Streik. */
  salaryPct: 100,
  morale: MORALE_NEUTRAL,
  /** Werbung: keine Kampagne (`advertisingRegionFactor = 1`, `advertisingReputation = 0`, keine Kosten). */
  campaigns: [] as readonly CampaignTier[],
  /** Frequent flyer: läuft nicht (`frequentFlyerFactor(0) = 1`, keine Kosten). */
  ffpMonthsRunning: 0,
  /** Schwierigkeit: wirkt nie (`difficultyFactor = 1`, E4, E53). */
  difficulty: 'Normal' as Difficulty,
  /** Anlauf ohne Forschungs-Bonus. */
  rampBonus: 0,
  /** Keine Vorbestellung, also kein Erstkunden-Bonus (7.1). */
  launchCustomer: false,
  /** Keine Krisen-Antworten (Abschnitt 8): Faktor 1, keine Kosten. */
  crisisResponseFactor: 1,
  /** Keine Charter: ausgefallene Flüge werden gestrichen (Abschnitt 8). */
  charter: false,
  /** Kein Pech-Deckel (8.8): Defekte jeden Monat gewürfelt. */
  badLuckCap: false,
  /** Kein Personal-Modell (8.7): Moral bleibt neutral, kein Streik-Wurf. */
  staffModel: false,
  /** Kein Zwangsverkauf und kein Spielende (8.14): Notlage, Verkauf und Auflösung nach 7.15. */
  forcedSale: false,
  /** Keine Krisen-Antworten (8.5). */
  hedgedEvents: [] as readonly string[],
  recoveryEvents: [] as readonly string[],
} as const;

/** Ein Eintrag der Liste „bewusst fehlende Teile“, als Text für die Rivalen-Ansicht (E52, Englisch). */
export interface RivalOmission {
  readonly part: string;
  readonly valueForRivals: string;
  readonly reason: string;
}

/**
 * Was die KI bewusst nicht hat, als Text (Oberfläche Englisch, E52). Die Werte, mit denen gerechnet wird, stehen
 * in `RIVAL_INPUTS`. SPEZIFIKATION 7.2.
 */
export const RIVAL_OMITTED: readonly RivalOmission[] = [
  { part: 'Research', valueForRivals: 'none (all effects neutral)', reason: 'Player progress; rivals buy any deliverable aircraft class instead.' },
  { part: 'Staff (pay, morale, strikes)', valueForRivals: 'pay 100 %, morale neutral, no strikes', reason: 'The staff model is a player tool.' },
  { part: 'Advertising', valueForRivals: 'none (no demand or reputation effect, no cost)', reason: 'A player tool.' },
  { part: 'Frequent flyer', valueForRivals: 'none (no effect, no cost)', reason: 'Part of advertising.' },
  { part: 'Difficulty', valueForRivals: 'never applies', reason: 'Difficulty only changes the player’s market.' },
  { part: 'Rank, milestones, annual goal, career points', valueForRivals: 'none; no unlocks or locks from them', reason: 'Player progress.' },
  { part: 'Crisis responses', valueForRivals: 'none', reason: 'Rivals answer crises with their crisis schedule.' },
  { part: 'Charter', valueForRivals: 'none; failed flights are cancelled', reason: 'Simplified decision.' },
  { part: 'Pre-orders, used aircraft', valueForRivals: 'none; rivals buy new aircraft only', reason: 'Simplified decision.' },
  { part: 'Hangar, catering kitchen, management tier 3', valueForRivals: 'none (VIP lounge: Flag and Boutique only)', reason: 'Simplified decision; tier 3 is a player tool.' },
  { part: 'Lock by management tier 3', valueForRivals: 'applies to rivals only; rivals never lock the player out', reason: 'Tier 3 is a player tool (rank 8).' },
  { part: 'Bad-luck cap', valueForRivals: 'none; defects are rolled every month', reason: 'Protects the player’s experience.' },
];

// ---------------------------------------------------------------------------
// 7.3 KI-Stärke
// ---------------------------------------------------------------------------

/** Werte einer KI-Stärke. Wirkt nur auf Entscheidungen (7.6–7.16), nie auf eine Funktion aus 7.1. SPEZIFIKATION 7.3. */
export function rivalStrengthDef(strength: RivalStrength): RivalStrengthDef {
  return RIVAL_STRENGTH[strength];
}

/** KI-Stärke aus der alten Schreibweise des Spielstands (`Easy`, `Normal`, `Hard`); Unbekanntes ist ein Fehler. */
export function rivalStrengthOf(value: string): RivalStrength {
  const lower = value.toLowerCase();
  if (lower === 'easy' || lower === 'normal' || lower === 'hard') return lower;
  throw new Error(`Unbekannte KI-Stärke: ${value}`);
}

// ---------------------------------------------------------------------------
// 7.4 Persönlichkeiten
// ---------------------------------------------------------------------------

/** Werte einer Persönlichkeit. SPEZIFIKATION 7.4. */
export function personalityDef(personality: RivalPersonality): PersonalityDef {
  return PERSONALITIES[personality];
}

/** Geduld in Monaten bis zum Urteil über eine Strecke: Grundwert + max(0, Angriffslust − 6). SPEZIFIKATION 7.4, 7.8. */
export function rivalPatience(personality: RivalPersonality): number {
  const def = PERSONALITIES[personality];
  return def.patienceBase + Math.max(0, def.aggression - PATIENCE_AGGRESSION_PIVOT);
}

/** Kaufneigung je Monat: `min(Höchstwert, Kaufneigung der Stärke × Faktor der Persönlichkeit)`. SPEZIFIKATION 7.4, 7.11. */
export function rivalBuyChance(strength: RivalStrength, personality: RivalPersonality): number {
  const def = PERSONALITIES[personality];
  return Math.min(def.buyChanceMax ?? 1, RIVAL_STRENGTH[strength].buyChance * def.buyFactor);
}

/** Reserve nach Kauf oder Eröffnung im Monat `month`: `atCost(CASH_RESERVE_1960)`. SPEZIFIKATION 7.4. */
export function rivalCashReserve(personality: RivalPersonality, month: number): number {
  return atCost(PERSONALITIES[personality].cashReserve1960, month);
}

/** Schalter-Art, die eine KI im Monat `month` baut: LCC Selbstbedienung, wo lieferbar; sonst bedient. SPEZIFIKATION 7.4, 7.10. */
export function rivalDeskType(personality: RivalPersonality, month: number): DeskType {
  return PERSONALITIES[personality].deskChoice === 'selfWhereAvailable' && isDeskTypeAvailable('self', month) ? 'self' : 'normal';
}

/**
 * Gewicht eines Ziels in der Vorauswahl nach Persönlichkeit: `Geschäft × g_B + Tourismus × g_T`, über
 * `LONG_HAUL_KM` × Langstrecken-Faktor (LCC 0,4). SPEZIFIKATION 7.4, 7.9.
 */
export function targetWeight(personality: RivalPersonality, business: number, tourism: number): number {
  const w = PERSONALITIES[personality].targetWeight;
  return business * w.business + tourism * w.tourism;
}

/** Langstrecken-Faktor der Vorauswahl: über `LONG_HAUL_KM` der Faktor der Persönlichkeit, sonst 1. SPEZIFIKATION 7.4, 7.9. */
export function longHaulFactor(personality: RivalPersonality, km: number): number {
  return km > LONG_HAUL_KM ? PERSONALITIES[personality].longHaulFactor : 1;
}

// ---------------------------------------------------------------------------
// 7.5 Kabine und Service der KI
// ---------------------------------------------------------------------------

/**
 * Sitztyp einer Sitz-Stufe (Reihenfolge der Sitzliste `SEAT_TYPE_POINTS`, 0 = Standard); ist er im Monat nicht
 * lieferbar, der höchste lieferbare darunter. SPEZIFIKATION 7.5.
 */
export function seatTypeAtLevel(cabinClass: CabinClass, level: number, fit: Pick<CabinFit, 'installedMonth' | 'capacity'>): string {
  const names = Object.keys(SEAT_TYPE_POINTS[cabinClass]);
  for (let i = Math.min(level, names.length - 1); i > 0; i--) {
    if (isDeliverable(SEAT_TYPE_POINTS[cabinClass][names[i]], fit)) return names[i];
  }
  return names[0];
}

/** Kabine eines KI-Flugzeugs. */
export interface RivalCabin {
  /** Sitze je Klasse. */
  readonly seats: Readonly<Record<CabinClass, number>>;
  /** Ausstattung je Klasse (auch für Klassen ohne Sitze, dann ohne Wirkung). */
  readonly interiors: Readonly<Record<CabinClass, ClassInterior>>;
  /** Einbau: Monat, Typ-Kapazität, lieferbare Extras. */
  readonly fit: CabinFit;
}

/**
 * Wie eine KI ein neues Flugzeug einrichtet (7.5): Platz nach `cabinSpace`; Premium-, Business- und First-Sitze
 * bekommen ihren Platz-Anteil `abrunden(Anteil × Platz / Platz eines Sitzes)`, der Rest wird Economy.
 * Commuter- und Regional-Flugzeuge (6.8) bekommen nur Economy. Sitztyp nach Sitz-Stufe, Ausstattung und Extras
 * nur, wenn im Kaufmonat lieferbar. Bewertet wird die Kabine mit `interiorScore` (2.3) wie beim Spieler.
 * SPEZIFIKATION 7.5.
 */
export function rivalCabin(personality: RivalPersonality, aircraft: SizeClassInput, month: number): RivalCabin {
  const def = PERSONALITIES[personality].cabin;
  const base = { installedMonth: month, capacity: aircraft.capacity };
  const fit: CabinFit = { ...base, extras: deliverableExtras(def.extras, base) };
  const space = cabinSpace(fit);
  const sizeClass = sizeClassOf(aircraft);
  const economyOnly = sizeClass === 'commuter' || sizeClass === 'regional';

  const interiors = {} as Record<CabinClass, ClassInterior>;
  for (const c of CABIN_CLASSES) {
    const features =
      def.features === 'none'
        ? []
        : Object.keys(FEATURE_POINTS[c]).filter(
            (key) => (def.features === 'all' || RIVAL_BASIC_FEATURES.includes(key)) && isDeliverable(FEATURE_POINTS[c][key], base),
          );
    interiors[c] = { seatType: seatTypeAtLevel(c, def.seatLevel, base), pitch: def.pitch[c], features };
  }

  const seats: Record<CabinClass, number> = { economy: 0, premium: 0, business: 0, first: 0 };
  const others: Partial<Record<Exclude<CabinClass, 'economy'>, { seats: number; interior: ClassInterior }>> = {};
  for (const c of ['premium', 'business', 'first'] as const) {
    const share = economyOnly ? 0 : def.spaceShare[c];
    seats[c] = share > 0 ? Math.floor((share * space) / seatSpace(c, interiors[c])) : 0;
    others[c] = { seats: seats[c], interior: interiors[c] };
  }
  seats.economy = economySeatsLeft(space, others, interiors.economy);
  return { seats, interiors, fit };
}

/**
 * Service einer KI-Klasse auf einer Strecke: das Menü der Persönlichkeit für **jede** Mahlzeit `k` mit
 * `mealWeight(k) > 0` (R14; heute nur Mahlzeit 1), dazu Extras und Bordservice. Bewertet mit `servicePoints`
 * (2.5), Kosten mit `cateringCost` (5.7), wie beim Spieler. SPEZIFIKATION 7.5.
 */
export function rivalService(personality: RivalPersonality, cabinClass: CabinClass, blockMinutes: number): ServiceSelection {
  const s = PERSONALITIES[personality].service[cabinClass];
  const fti = flightTimeIndex(blockMinutes);
  const meals: string[][] = [];
  for (let k = 1; k <= MEALS_MAX; k++) meals.push(mealWeight(k, fti) > 0 ? [...s.menu] : []);
  return { meals, extras: [...s.extras], onboardService: [...s.onboardService] };
}

// ---------------------------------------------------------------------------
// 7.6 KI-Preise
// ---------------------------------------------------------------------------

/**
 * Zielniveau einer Klasse: `FARE_POSITION × satisfactionFactor` (die KI verlangt, was ihre Fluggäste für ihre
 * Satisfaction zahlen, 2.10). Optimizer: der beste Preis (4.10) als Preisniveau, `bestFareRatio`. SPEZIFIKATION 7.6.
 *
 * @param satisfactionFactorValue `satisfactionFactor(offerSatisfaction)` der Klasse (2.10).
 * @param bestFareRatioValue `bestFare(...).fareRatio` (4.10); nur für den Optimizer gebraucht.
 */
export function rivalTargetFareRatio(
  personality: RivalPersonality,
  satisfactionFactorValue: number,
  bestFareRatioValue?: number,
): number {
  const position = PERSONALITIES[personality].farePosition;
  if (position === 'best') {
    if (bestFareRatioValue === undefined) throw new Error('Optimizer braucht den besten Preis (4.10).');
    return bestFareRatioValue;
  }
  return position * satisfactionFactorValue;
}

/**
 * Lage einer Klasse nach dem Monat: Auslastung ≥ `LOAD_HIGH` → + `FARE_STEP`; < `LOAD_LOW` → − `FARE_STEP`;
 * sonst um `FARE_STEP` Richtung 0 (liegt sie näher, genau 0). Begrenzt auf ± `YIELD_MAX`. Neue Strecke: 0.
 * SPEZIFIKATION 7.6.
 */
export function nextYieldPosition(previous: number, loadFactor: number): number {
  let next: number;
  if (loadFactor >= LOAD_HIGH) next = previous + FARE_STEP;
  else if (loadFactor < LOAD_LOW) next = previous - FARE_STEP;
  else if (Math.abs(previous) <= FARE_STEP + 1e-12) next = 0;
  else next = previous - Math.sign(previous) * FARE_STEP;
  return clamp(next, -YIELD_MAX, YIELD_MAX);
}

/**
 * Boden des Preisniveaus: `FARE_RATIO_MIN`; im Preiskampf `max(FARE_FLOOR, breakEvenFareLevel(L = 1))` – die
 * Strecke deckt selbst mit voller Maschine nur ihre Kosten. SPEZIFIKATION 7.6.
 *
 * @param breakEvenFull `breakEvenFareLevel(1, …)` der Strecke (4.11); nur im Preiskampf gebraucht.
 */
export function rivalPriceFloor(personality: RivalPersonality, priceWar: boolean, breakEvenFull = 0): number {
  if (!priceWar) return FARE_RATIO_MIN;
  return Math.max(FARE_RATIO_MIN, PERSONALITIES[personality].fareFloor, breakEvenFull);
}

/** Eingaben des KI-Preisniveaus einer Klasse. */
export interface RivalFareInput {
  readonly personality: RivalPersonality;
  /** `rivalTargetFareRatio` der Klasse. */
  readonly target: number;
  /** Lage der Klasse (`nextYieldPosition`). */
  readonly yieldPosition: number;
  /** Läuft auf dem Paar ein Preiskampf dieser KI? */
  readonly priceWar: boolean;
  /** `breakEvenFareLevel(1, …)` der Strecke (4.11). */
  readonly breakEvenFull: number;
}

/**
 * Preisniveau `fareRatio` (4.5) einer KI-Klasse: `Zielniveau × (1 + Lage) × (1 − Preiskampf-Nachlass)`, begrenzt
 * auf `priceFloor … FARE_RATIO_MAX`. Liegt der Boden über `FARE_RATIO_MAX`, gilt `FARE_RATIO_MAX` (Grenze aus 4.5).
 * Wirkt im Markt nur über `routeFare` und `priceFactor` (R7). SPEZIFIKATION 7.6.
 */
export function rivalFareRatio(input: RivalFareInput): number {
  const cut = input.priceWar ? PRICE_WAR_CUT : 0;
  const raw = input.target * (1 + input.yieldPosition) * (1 - cut);
  const floor = rivalPriceFloor(input.personality, input.priceWar, input.breakEvenFull);
  return clamp(raw, Math.min(floor, FARE_RATIO_MAX), FARE_RATIO_MAX);
}

/** Preiskampf einer KI auf einem Paar. */
export interface PriceWarState {
  /** Monat, in dem der laufende Preiskampf begann; fehlt = kein Preiskampf. */
  readonly startedMonth?: number;
  /** Erst ab diesem Monat wieder ein Preiskampf auf diesem Paar (`PRICE_WAR_COOLDOWN`). */
  readonly cooldownUntil?: number;
}

/** Was die KI im Monat über das Paar weiß. */
export interface PriceWarInput {
  readonly personality: RivalPersonality;
  readonly month: number;
  /** Alter der eigenen Strecke in Monaten. */
  readonly routeAgeMonths: number;
  /** Geglätteter Gewinn der Strecke (7.8). */
  readonly avgProfit: number;
  /** Monat, in dem eine **andere** Gesellschaft (Spieler oder KI) zuletzt ein Angebot auf dem Paar eröffnete. */
  readonly lastRivalOpeningMonth?: number;
  /** Bietet eine andere Gesellschaft Economy billiger an als diese KI? (E59) */
  readonly undercutInEconomy: boolean;
  /** Bietet überhaupt eine andere Gesellschaft auf dem Paar an? */
  readonly competitorPresent: boolean;
}

/** Ergebnis eines Preiskampf-Schritts, mit Meldung (Texte in Phase 4). */
export interface PriceWarStep {
  readonly state: PriceWarState;
  readonly event: 'started' | 'ended' | null;
}

/** Läuft ein Preiskampf? */
export function inPriceWar(state: PriceWarState): boolean {
  return state.startedMonth !== undefined;
}

/**
 * Preiskampf je Paar, einmal im Monat nach der Buchung (7.6, E59):
 * - **Beginn:** Angriffslust ≥ `PRICE_WAR_MIN_AGGRESSION`, Strecke ≥ 2 Monate alt, geglätteter Gewinn > 0, kein
 *   Abstand nach einem Preiskampf, und eine andere Gesellschaft hat in den letzten `PRICE_WAR_WINDOW` Monaten
 *   eröffnet (`month − Eröffnung < PRICE_WAR_WINDOW`) oder bietet Economy billiger an.
 * - **Ende:** nach `PRICE_WAR_MAX_MONTHS`, bei geglättetem Gewinn < 0 oder ohne Mitbewerber; danach
 *   `PRICE_WAR_COOLDOWN` Monate keiner.
 * Der Nachlass wirkt einmal (`rivalFareRatio`), nicht Monat für Monat wachsend. SPEZIFIKATION 7.6.
 */
export function priceWarStep(state: PriceWarState, input: PriceWarInput): PriceWarStep {
  if (state.startedMonth !== undefined) {
    const over =
      input.month - state.startedMonth >= PRICE_WAR_MAX_MONTHS || input.avgProfit < 0 || !input.competitorPresent;
    if (!over) return { state, event: null };
    return { state: { cooldownUntil: input.month + PRICE_WAR_COOLDOWN }, event: 'ended' };
  }
  const coolingDown = state.cooldownUntil !== undefined && input.month < state.cooldownUntil;
  const provoked =
    (input.lastRivalOpeningMonth !== undefined && input.month - input.lastRivalOpeningMonth < PRICE_WAR_WINDOW) ||
    input.undercutInEconomy;
  const starts =
    !coolingDown &&
    provoked &&
    input.competitorPresent &&
    PERSONALITIES[input.personality].aggression >= PRICE_WAR_MIN_AGGRESSION &&
    input.routeAgeMonths >= PRICE_WAR_MIN_ROUTE_AGE &&
    input.avgProfit > 0;
  if (!starts) return { state, event: null };
  return { state: { startedMonth: input.month }, event: 'started' };
}

// ---------------------------------------------------------------------------
// 7.7 Gründung und Startwerte
// ---------------------------------------------------------------------------

/**
 * Index nach Gewichten für eine Zufallszahl `u` in [0, 1); −1, wenn kein Gewicht > 0. Zufall nur über `rng` (8.3).
 */
export function weightedPick(weights: readonly number[], u: number): number {
  let total = 0;
  for (const w of weights) if (w > 0) total += w;
  if (!(total > 0)) return -1;
  let target = u * total;
  let last = -1;
  for (let i = 0; i < weights.length; i++) {
    if (!(weights[i] > 0)) continue;
    last = i;
    if (target < weights[i]) return i;
    target -= weights[i];
  }
  return last;
}

/**
 * Startkasse: `atCost(RIVAL_START_CASH_1960[Stärke]) ± atCost(3 Mio. $) × Zufall`, ohne Persönlichkeits-Faktor
 * (E45). Die Startflotte kommt dazu (wie heute). SPEZIFIKATION 7.7.
 *
 * @param noise Zufallszahl in [−1, 1] (`2 × rng(...) − 1`).
 */
export function rivalStartCash(strength: RivalStrength, month: number, noise: number): number {
  return atCost(RIVAL_STRENGTH[strength].startCash1960, month) + atCost(RIVAL_START_CASH_NOISE_1960, month) * noise;
}

/** Startausstattung am Drehkreuz: wie der Spieler (Stufe 2, keine Slots, ein bedienter Schalter), Ruf 50. SPEZIFIKATION 7.7. */
export function rivalStartSetup(): typeof START_HUB_SETUP & { readonly reputation: number } {
  return { ...START_HUB_SETUP, reputation: START_REPUTATION };
}

/** Wie viele der neuen KI erfunden sind (wie heute): eine → mit 40 % erfunden; mehrere → `round(n × (0,3 + 0,2 u))`, mindestens 1. SPEZIFIKATION 7.7. */
export function fictionalRivalCount(count: number, u: number): number {
  if (count <= 0) return 0;
  if (count === 1) return u < FICTIONAL_SINGLE_CHANCE ? 1 : 0;
  return Math.min(count, Math.max(1, Math.round(count * (FICTIONAL_SHARE_BASE + FICTIONAL_SHARE_SPREAD * u))));
}

/** Ein Flughafen als möglicher Gründungsort. */
export interface HubCandidate {
  readonly id: string;
  /** Flughafen-Größe 1 … 5 (Daten). */
  readonly level: number;
  /** Nachfrage am Flughafen (wie heute `airportDemand`). */
  readonly demand: number;
  /** Drehkreuz des Spielers? */
  readonly playerHub: boolean;
  /** Drehkreuz einer anderen KI? */
  readonly rivalHub: boolean;
  /** Hat der Spieler hier Verwaltungsstufe 3 (E63)? */
  readonly playerTier3: boolean;
}

/** Darf hier eine KI gegründet werden: nicht am Spieler-Drehkreuz, nicht am Drehkreuz einer anderen KI, nicht mit Spieler-Stufe 3 (E63). SPEZIFIKATION 7.7, 7.10. */
export function mayFoundAt(candidate: HubCandidate): boolean {
  return !candidate.playerHub && !candidate.rivalHub && !candidate.playerTier3;
}

/** Gewicht einer echten Gesellschaft: √(Nachfrage an ihrem Drehkreuz); 0, wenn dort nicht gegründet werden darf. SPEZIFIKATION 7.7. */
export function realRivalWeight(hub: HubCandidate): number {
  return mayFoundAt(hub) ? Math.sqrt(hub.demand) : 0;
}

/**
 * Gewichte der Drehkreuze erfundener KI: Flughäfen ab Größe 4, gibt es keinen, ab Größe 2; nur, wo gegründet werden
 * darf; gewichtet nach Nachfrage. SPEZIFIKATION 7.7.
 */
export function fictionalHubWeights(candidates: readonly HubCandidate[]): number[] {
  const open = candidates.map(mayFoundAt);
  const minLevel = candidates.some((a, i) => open[i] && a.level >= RIVAL_HUB_MIN_LEVEL)
    ? RIVAL_HUB_MIN_LEVEL
    : RIVAL_HUB_FALLBACK_LEVEL;
  return candidates.map((a, i) => (open[i] && a.level >= minLevel ? a.demand : 0));
}

/** Rückt in diesem Monat eine KI nach? Nur, wenn weniger als gewählt da sind, mit `RIVAL_REFILL_CHANCE`. SPEZIFIKATION 7.7. */
export function shouldRefill(current: number, wanted: number, u: number): boolean {
  return current < wanted && u < RIVAL_REFILL_CHANCE;
}

/** Bauart der Startflugzeuge: das erste Narrowbody, die anderen Regional; Anzahl nach Stärke. SPEZIFIKATION 7.7. */
export function startFleetKinds(strength: RivalStrength): readonly ('narrowbody' | 'regional')[] {
  return Array.from({ length: RIVAL_STRENGTH[strength].startFleet }, (_, i) => (i === 0 ? 'narrowbody' : 'regional'));
}

/** Was die Wahl der Startflugzeuge von einem Typ braucht (Felder aus `src/data/aircraft.ts`). */
export interface StartAircraftInput {
  readonly class: string;
  readonly popularity: number;
  readonly efficiency: number;
  readonly capacity: number;
  readonly maxRange: number;
  readonly firstDeliveryOffset: number;
  readonly lastDeliveryOffset: number | null;
}

/** Ist ein Typ im Monat neu lieferbar (Lieferzeitraum der Daten)? SPEZIFIKATION 7.7, 7.11. */
export function isOnMarket(aircraft: Pick<StartAircraftInput, 'firstDeliveryOffset' | 'lastDeliveryOffset'>, month: number): boolean {
  return month >= aircraft.firstDeliveryOffset && (aircraft.lastDeliveryOffset === null || month <= aircraft.lastDeliveryOffset);
}

/**
 * Wert eines Typs bei der Wahl der Startflugzeuge (wie heute `src/lib/aiSimulation.ts:661-677`):
 * `Beliebtheit − 0,2 × Monate seit Lieferbeginn + Gewichte der Persönlichkeit + (u − 0,5) × 15`. SPEZIFIKATION 7.7.
 *
 * @param u Zufallszahl in [0, 1).
 */
export function startAircraftScore(personality: RivalPersonality, aircraft: StartAircraftInput, month: number, u: number): number {
  const w = START_AIRCRAFT_WEIGHTS[personality];
  return (
    aircraft.popularity -
    (month - aircraft.firstDeliveryOffset) * START_AIRCRAFT_AGE_PENALTY +
    w.capacity * aircraft.capacity +
    w.efficiency * aircraft.efficiency +
    w.popularity * aircraft.popularity +
    w.range * aircraft.maxRange +
    (u - 0.5) * START_AIRCRAFT_NOISE
  );
}

/**
 * Startflugzeug einer Bauart: unter den im Monat lieferbaren Typen dieser Bauart der mit dem höchsten
 * `startAircraftScore`; gibt es keinen (z. B. kein Narrowbody lieferbar), unter allen lieferbaren. −1, wenn
 * keiner lieferbar ist. SPEZIFIKATION 7.7.
 *
 * @param noise Zufallszahl je Typ (Index wie `types`) in [0, 1).
 */
export function pickStartAircraft(
  personality: RivalPersonality,
  kind: 'narrowbody' | 'regional',
  types: readonly StartAircraftInput[],
  month: number,
  noise: (index: number) => number,
): number {
  const onMarket = types.map((t) => isOnMarket(t, month));
  const ofKind = types.map((t, i) => onMarket[i] && t.class.toLowerCase() === kind);
  const pool = ofKind.some(Boolean) ? ofKind : onMarket;
  let best = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  types.forEach((t, i) => {
    if (!pool[i]) return;
    const score = startAircraftScore(personality, t, month, noise(i));
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}
