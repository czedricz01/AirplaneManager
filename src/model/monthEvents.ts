/**
 * Monatsabschluss Teil a, Ereignisse und Betrieb: SPEZIFIKATION 8.4–8.10 (Paket 3.8a).
 *
 * 8.4 Weltereignisse, 8.5 Krisen-Antworten, 8.6 Betriebsstörungen und Vogelschläge, 8.7 Personal (Moral, Streik),
 * 8.8 Pech-Deckel, 8.9 gestrichene und gecharterte Flüge, 8.10 Verschleiß. Der Zufallsgeber (8.3) steht in `rng.ts`;
 * Händler-Spanne, Gebrauchtmarkt, Vorbestellung, Überholung und Kreditlinie (8.11–8.14) in `fleetMarket.ts`;
 * `closeMonth` (8.1, 8.2) baut Paket 3.8b.
 *
 * Für alle gleich (E35, E44): Ereignisse, Störungen, Verschleiß gelten für jede Gesellschaft mit denselben
 * Funktionen. Was nur der Spieler hat (Krisen-Antworten, Charter, Personal, Pech-Deckel, Liste 7.2), bekommt die
 * KI als neutrale Eingabe (`RIVAL_INPUTS`): Die Funktionen fragen nie „ist das eine KI?“ (7.1), sondern lesen
 * Merkmale wie `badLuckCap` oder `defectFactor`.
 *
 * Alle Würfe kommen aus `rng(seed, month, purpose, key)` (8.3): kein `Math.random`, keine Reihenfolge-Abhängigkeit
 * außer der festen Reihenfolge unter dem Pech-Deckel (8.8, F40). Alles ungerundet (R4).
 */

import { clamp, clampScale, yearOf } from './basics';
import {
  AIRFRAME_WEAR_MAX,
  AIRFRAME_WEAR_PER_HOUR,
  AIRPORT_STRIKE_CANCEL_SHARE,
  AIRPORT_STRIKE_CHANCE,
  BAD_LUCK_CLAIM_FACTOR,
  BASE_MORALE,
  BIRD_STRIKE_CHANCE,
  BIRD_STRIKE_COST_SHARE,
  CABIN_WEAR_MAX,
  CABIN_WEAR_PER_HOUR,
  CHARTER_MARKUP,
  DEFECT_BASE,
  DEFECT_CANCEL_SHARE,
  DEFECT_PER_AIRFRAME_POINT,
  DEFECT_PER_YEAR,
  HANGAR_DEFECT_FACTOR,
  HEDGE_PRICE_SHARE,
  HISTORICAL_EVENTS,
  LABOUR_MARKET,
  MAJOR_DISRUPTION_SHARE,
  MAX_DISRUPTION_QUESTIONS,
  MORALE_PER_PAY_POINT,
  MORALE_STEP,
  PROFIT_STREAK_MONTHS,
  PROFIT_STREAK_MORALE,
  RANDOM_EVENT_CHANCE,
  RANDOM_EVENT_TEMPLATES,
  RECOVERY_PRICE_SHARE,
  SALARY_PCT_MARKET,
  SALARY_PCT_MAX,
  SALARY_PCT_MIN,
  STRIKE_CHANCE_PER_POINT,
  STRIKE_FULL_CANCEL_SHARE,
  STRIKE_MEMORY_MONTHS,
  STRIKE_MORALE_PENALTY,
  STRIKE_MORALE_THRESHOLD,
  STRIKE_PAY_RAISE,
  STRIKE_SETTLED_CANCEL_SHARE,
  WEAR_BASE,
  WEEKS_PER_MONTH,
  WINTER_CANCEL_SHARE,
  WINTER_CHANCE,
  WINTER_MONTHS,
  WINTER_REGIONS,
  WORLD_REGIONS,
  type CrisisResponseKind,
  type DisruptionKind,
  type HistoricalEventDef,
  type WorldRegion,
} from './constants';
import { fuelTable } from './costs';
import { newPrice } from './fleet';
import { cancelledShare } from './progress';
import { rng } from './rng';
import { ageYears } from './satisfaction';

// ---------------------------------------------------------------------------
// 8.4 Weltereignisse
// ---------------------------------------------------------------------------

/**
 * Ein Weltereignis, geschichtlich (Daten) oder zufällig (im Spielstand, 8.3). Passt als `DemandEvent` in
 * `eventDemandFactor` (3.5): Wirkung **nur** über die Marktgröße, für alle Gesellschaften gleich (E35).
 */
export interface WorldEvent {
  readonly title: string;
  /** Erster Spielmonat. */
  readonly startMonth: number;
  /** Dauer in Monaten. */
  readonly months: number;
  /** Faktor auf die Reiselust. */
  readonly demandMultiplier: number;
  /** Betroffene Regionen; fehlt = weltweit. */
  readonly regions?: readonly WorldRegion[];
}

/** Läuft das Ereignis im Monat `month`: `startMonth ≤ month < startMonth + months`. SPEZIFIKATION 8.4. */
export function isEventActive(event: Pick<WorldEvent, 'startMonth' | 'months'>, month: number): boolean {
  return month >= event.startMonth && month < event.startMonth + event.months;
}

/**
 * Alle im Monat laufenden Ereignisse: geschichtliche aus den Daten (immer, auch bei geschlossenem Pech-Deckel)
 * und gewürfelte aus dem Spielstand. Eingabe für `eventDemandFactor` (3.5) und `crisisSeverity` (7.12).
 * SPEZIFIKATION 8.4.
 */
export function activeWorldEvents(month: number, randomEvents: readonly WorldEvent[] = []): WorldEvent[] {
  return [...HISTORICAL_EVENTS, ...randomEvents].filter((e) => isEventActive(e, month));
}

/** Pech-Ereignis: `demandMultiplier < 1` (heute auch „Treibstoff > Nachfrage“, entfällt mit E8). SPEZIFIKATION 8.4. */
export function isBadLuckEvent(event: Pick<WorldEvent, 'demandMultiplier'>): boolean {
  return event.demandMultiplier < 1;
}

/**
 * Würfelt im Übergang ein Zufallsereignis, das im Monat `month` beginnt: mit `RANDOM_EVENT_CHANCE`; Vorlage gleich
 * verteilt; Dauer und Nachfrage-Faktor gleich verteilt im Bereich der Vorlage (ungerundet, R4); regionale Vorlage:
 * eine der 6 Regionen. Ein Pech-Ereignis nur bei offenem Pech-Deckel (8.8), sonst `null`. SPEZIFIKATION 8.4.
 *
 * @param month Der Monat, in dem das Ereignis beginnt (X+1).
 */
export function rollRandomEvent(seed: number, month: number, capOpen: boolean): WorldEvent | null {
  const draw = (key: string) => rng(seed, month, 'randomEvent', key);
  if (draw('chance') >= RANDOM_EVENT_CHANCE) return null;
  const template = RANDOM_EVENT_TEMPLATES[Math.floor(draw('template') * RANDOM_EVENT_TEMPLATES.length)];
  const months =
    template.durationMin + Math.floor(draw('duration') * (template.durationMax - template.durationMin + 1));
  const demandMultiplier = template.demandMin + draw('demand') * (template.demandMax - template.demandMin);
  const event: WorldEvent = {
    title: template.title,
    startMonth: month,
    months,
    demandMultiplier,
    ...(template.regional ? { regions: [WORLD_REGIONS[Math.floor(draw('region') * WORLD_REGIONS.length)]] } : {}),
  };
  return isBadLuckEvent(event) && !capOpen ? null : event;
}

/** Beginn und Ende von Ereignissen im Monat (für Meldungen, Texte aus den Daten, E52). */
export interface EventNews {
  /** Ereignisse, die in diesem Monat beginnen (geschichtliche mit Krisen-Antwort: Frage, 8.5). */
  readonly started: readonly WorldEvent[];
  /** Ereignisse, deren letzter Monat der Vormonat war. */
  readonly ended: readonly WorldEvent[];
}

/** Welche Ereignisse im Monat `month` beginnen und welche enden. SPEZIFIKATION 8.4. */
export function eventNews(month: number, randomEvents: readonly WorldEvent[] = []): EventNews {
  const all = [...HISTORICAL_EVENTS, ...randomEvents];
  return {
    started: all.filter((e) => e.startMonth === month),
    ended: all.filter((e) => e.startMonth + e.months === month),
  };
}

// ---------------------------------------------------------------------------
// 8.5 Krisen-Antworten (nur Spieler)
// ---------------------------------------------------------------------------

/** Geschichtliches Ereignis nach Titel; ein unbekannter Titel ist ein Fehler. SPEZIFIKATION 8.5. */
export function historicalEvent(title: string): HistoricalEventDef {
  const event = HISTORICAL_EVENTS.find((e) => e.title === title);
  if (!event) throw new Error(`Unbekanntes geschichtliches Ereignis ${title}`);
  return event;
}

/** Bezugsgrößen der Antwort aus dem Bericht des letzten abgeschlossenen Monats (bei der Wahl bekannt). */
export interface CrisisResponseBase {
  /** Treibstoff-Rechnung des letzten Monats in $. */
  readonly fuelBill: number;
  /** Monatserlös des letzten Monats in $. */
  readonly revenue: number;
}

/** Preis der Preis-Absicherung: `HEDGE_PRICE_SHARE × Treibstoff-Rechnung des letzten Monats × Dauer`. SPEZIFIKATION 8.5. */
export function hedgePrice(lastFuelBill: number, months: number): number {
  return HEDGE_PRICE_SHARE * lastFuelBill * months;
}

/**
 * Preis der Rückgewinnung: `RECOVERY_PRICE_SHARE × r × (1 − f) × Dauer × Monatserlös des letzten Monats`.
 * SPEZIFIKATION 8.5.
 */
export function recoveryPrice(recoveryShare: number, demandMultiplier: number, months: number, lastRevenue: number): number {
  return RECOVERY_PRICE_SHARE * recoveryShare * (1 - demandMultiplier) * months * lastRevenue;
}

/**
 * Restdauer eines Ereignisses im Monat `month` in Monaten, den laufenden mitgezählt (der Abschluss dieses Monats
 * rechnet eine jetzt gekaufte Antwort schon mit). Vor Beginn die volle Dauer, nach dem Ende 0. E73 (O69 = A).
 */
export function remainingEventMonths(event: Pick<WorldEvent, 'startMonth' | 'months'>, month: number): number {
  return Math.max(0, Math.min(event.months, event.startMonth + event.months - month));
}

/**
 * Preis der Krisen-Antwort eines Ereignisses als Anteil der betroffenen Größe (E6, E35); bezahlt bei der Wahl,
 * Posten „Crisis response“ (5.16). Gerechnet mit der **Restdauer** im Monat der Wahl statt der vollen Dauer (E73,
 * O69 = A): Wer später kauft, zahlt weniger, die Antwort wirkt aber auch nur noch für den Rest. Beim Beginn ist die
 * Restdauer die volle Dauer. Ein Ereignis ohne Antwort ist ein Fehler. SPEZIFIKATION 8.5.
 *
 * @param month Monat der Wahl (laufender Spielmonat).
 */
export function crisisResponsePrice(event: HistoricalEventDef, base: CrisisResponseBase, month: number): number {
  const response = event.response;
  if (!response) throw new Error(`Keine Krisen-Antwort für ${event.title}`);
  const months = remainingEventMonths(event, month);
  if (response.kind === 'fuelHedge') return hedgePrice(base.fuelBill, months);
  return recoveryPrice(response.recoveryShare ?? 0, event.demandMultiplier, months, base.revenue);
}

/** Art der Antwort eines Ereignisses (für die Frage beim Beginn); `null` ohne Antwort. */
export function crisisResponseKind(event: HistoricalEventDef): CrisisResponseKind | null {
  return event.response?.kind ?? null;
}

/**
 * Gesicherter Tabellenpreis der Absicherung: `fuelTable(Monat vor Beginn)` für die Dauer des Ereignisses (in beide
 * Richtungen), sonst `undefined` (dann gilt die Tabelle). Eingabe `hedgedFuelTable` von `fuelPrice` (5.2).
 * SPEZIFIKATION 8.5.
 *
 * @param hedgedEvents Ereignisse, für die diese Gesellschaft die Absicherung gekauft hat (KI: keine).
 */
export function hedgedFuelTable(hedgedEvents: readonly Pick<WorldEvent, 'startMonth' | 'months'>[], month: number): number | undefined {
  const locked = hedgeLockMonth(hedgedEvents, month);
  return locked === undefined ? undefined : fuelTable(locked);
}

/**
 * Monat, dessen Treibstoffpreis die Absicherung festhält: der Monat vor Beginn des ersten laufenden abgesicherten
 * Ereignisses; sonst `undefined` (dann gilt der Preis des Monats). Die Regel hinter `hedgedFuelTable`, getrennt von
 * der Preisquelle, damit die Kopfzeile sie nutzt, solange sie den Preis noch aus `src/lib/` liest (Paket 4.2).
 * SPEZIFIKATION 8.5.
 */
export function hedgeLockMonth(hedgedEvents: readonly Pick<WorldEvent, 'startMonth' | 'months'>[], month: number): number | undefined {
  const running = hedgedEvents.find((e) => isEventActive(e, month));
  return running ? running.startMonth - 1 : undefined;
}

/**
 * `crisisResponseFactor = (f + (1 − f) × r) / f` auf die Anziehung aller Angebote der Gesellschaft (3.9.7), mit
 * `f` = `demandMultiplier` und `r` = Rückgewinnungs-Anteil. SPEZIFIKATION 8.5.
 */
export function crisisResponseFactor(demandMultiplier: number, recoveryShare: number): number {
  return (demandMultiplier + (1 - demandMultiplier) * recoveryShare) / demandMultiplier;
}

/**
 * Faktor aller gekauften, laufenden Rückgewinnungen der Gesellschaft (Produkt); ohne Antwort 1 (KI:
 * `RIVAL_INPUTS.crisisResponseFactor`). SPEZIFIKATION 8.5.
 *
 * @param recoveryEvents Ereignisse, für die diese Gesellschaft die Rückgewinnung gekauft hat.
 */
export function activeCrisisResponseFactor(recoveryEvents: readonly HistoricalEventDef[], month: number): number {
  let factor = 1;
  for (const e of recoveryEvents) {
    if (isEventActive(e, month) && e.response?.kind === 'demandRecovery') {
      factor *= crisisResponseFactor(e.demandMultiplier, e.response.recoveryShare ?? 0);
    }
  }
  return factor;
}

// ---------------------------------------------------------------------------
// 8.6 Betriebsstörungen und Vogelschläge
// ---------------------------------------------------------------------------

/** Was die Defekt-Chance von einem Flugzeug braucht. */
export interface DefectInput {
  /** Zustand der Zelle in %. */
  readonly airframeCondition: number;
  readonly builtMonth: number;
  readonly month: number;
  /** Eigener Hangar an einem Flughafen seiner Strecken. */
  readonly hasHangar: boolean;
  /** `researchEffects(...).defectFactor` (6.9); KI und ohne Forschung 1. */
  readonly defectFactor: number;
}

/**
 * Defekt-Chance je Flugzeug und Monat: `(DEFECT_BASE + DEFECT_PER_AIRFRAME_POINT × (100 − Zelle) + DEFECT_PER_YEAR
 * × Alter) × (HANGAR_DEFECT_FACTOR mit Hangar) × defectFactor`. Alter seit dem Baumonat (R13). SPEZIFIKATION 8.6.
 */
export function defectChance(input: DefectInput): number {
  const base =
    DEFECT_BASE +
    DEFECT_PER_AIRFRAME_POINT * (100 - input.airframeCondition) +
    DEFECT_PER_YEAR * ageYears(input.builtMonth, input.month);
  return base * (input.hasHangar ? HANGAR_DEFECT_FACTOR : 1) * input.defectFactor;
}

/** Wintermonat (Dezember, Januar, Februar). SPEZIFIKATION 8.6. */
export function isWinterMonth(month: number): boolean {
  return WINTER_MONTHS.includes(((month % 12) + 12) % 12);
}

/** Gestrichener Anteil je Art. SPEZIFIKATION 8.6. */
export const DISRUPTION_CANCEL_SHARE: Readonly<Record<DisruptionKind, number>> = {
  defect: DEFECT_CANCEL_SHARE,
  airportStrike: AIRPORT_STRIKE_CANCEL_SHARE,
  weather: WINTER_CANCEL_SHARE,
};

/** Eine gewürfelte Störung (im Spielstand, 8.3). */
export interface Disruption {
  /** Monat, in dem sie Flüge streicht. */
  readonly month: number;
  readonly kind: DisruptionKind;
  /** Flugzeug-Kennung (Defekt), Flughafen-Kennung (Streik) oder Region (Wetter). */
  readonly target: string;
  /** Gestrichener Anteil der betroffenen Flüge. */
  readonly share: number;
  /** Antwort des Spielers: Charter statt streichen (8.9). Fehlt = streichen (auch KI, 7.2). */
  readonly charter?: boolean;
}

/** Ein Flugzeug, für das ein Defekt gewürfelt wird. */
export interface DisruptionPlane extends Omit<DefectInput, 'month'> {
  readonly id: string;
  /** Fliegt es im Monat eine Strecke? Nur dann wird gewürfelt. */
  readonly flies: boolean;
  /** Gehört einer Gesellschaft unter dem Pech-Deckel (Spieler; KI: `RIVAL_INPUTS.badLuckCap = false`). */
  readonly badLuckCap: boolean;
}

/** Ein Flughafen, für den ein Streik gewürfelt wird. */
export interface DisruptionAirport {
  readonly id: string;
  /** Hat er im Monat Abflüge (irgendeiner Gesellschaft)? Nur dann wird gewürfelt. */
  readonly hasDepartures: boolean;
  /** Fliegt eine Gesellschaft unter dem Pech-Deckel ihn an? */
  readonly badLuckCap: boolean;
}

/** Eingaben für `rollDisruptions`. */
export interface DisruptionRollInput {
  readonly seed: number;
  /** Monat, in dem die Störungen gelten (X+1). */
  readonly month: number;
  /** Pech-Deckel offen zu Beginn der Störungs-Würfe (nach dem Zufallsereignis, 8.8). */
  readonly capOpen: boolean;
  readonly planes: readonly DisruptionPlane[];
  readonly airports: readonly DisruptionAirport[];
  /** Regionen, die eine Gesellschaft unter dem Pech-Deckel anfliegt (Wetter). */
  readonly capRegions: readonly WorldRegion[];
}

/** Ergebnis von `rollDisruptions`. */
export interface DisruptionRoll {
  readonly disruptions: readonly Disruption[];
  /** Hat eine Störung eine Gesellschaft unter dem Pech-Deckel getroffen (einmaliges Pech, 8.8)? */
  readonly badLuck: boolean;
  /** Pech-Deckel offen nach den Störungs-Würfen. */
  readonly capOpen: boolean;
}

/**
 * Würfelt im Übergang die Störungen für den Monat `month` (8.6): Defekt je fliegendes Flugzeug jeder Gesellschaft,
 * Streik je Flughafen mit Abflügen, Winterwetter je Region in EU, NA, AS (Dez.–Feb.).
 *
 * Pech-Deckel (8.8): Feste Reihenfolge Defekt → Flughafen-Streik → Wetter, je Art nach Kennung sortiert (F40).
 * Würfe, die eine Gesellschaft unter dem Deckel träfen, werden bei geschlossenem Deckel **nicht** gewürfelt; der
 * erste solche Treffer schließt den Deckel. Alle anderen Würfe (z. B. Defekte von KI-Flugzeugen) immer.
 * SPEZIFIKATION 8.6, 8.8.
 */
export function rollDisruptions(input: DisruptionRollInput): DisruptionRoll {
  let capOpen = input.capOpen;
  let badLuck = false;
  const out: Disruption[] = [];
  const consider = (kind: DisruptionKind, target: string, chance: number, capped: boolean) => {
    if (capped && !capOpen) return;
    if (rng(input.seed, input.month, kind, target) >= chance) return;
    out.push({ month: input.month, kind, target, share: DISRUPTION_CANCEL_SHARE[kind] });
    if (capped) {
      badLuck = true;
      capOpen = false;
    }
  };
  const byId = <T extends { readonly id: string }>(list: readonly T[]) =>
    [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  for (const plane of byId(input.planes)) {
    if (!plane.flies) continue;
    consider('defect', plane.id, defectChance({ ...plane, month: input.month }), plane.badLuckCap);
  }
  for (const airport of byId(input.airports)) {
    if (!airport.hasDepartures) continue;
    consider('airportStrike', airport.id, AIRPORT_STRIKE_CHANCE, airport.badLuckCap);
  }
  if (isWinterMonth(input.month)) {
    for (const region of WINTER_REGIONS) consider('weather', region, WINTER_CHANCE, input.capRegions.includes(region));
  }
  return { disruptions: out, badLuck, capOpen };
}

/**
 * Vogelschlag im abgeschlossenen Monat (Schritt 2, im selben Bericht gebucht): je fliegendes Flugzeug jeder
 * Gesellschaft mit `BIRD_STRIKE_CHANCE`; außerhalb des Pech-Deckels; kein Flug fällt aus. SPEZIFIKATION 8.6.
 */
export function rollBirdStrike(seed: number, month: number, planeId: string): boolean {
  return rng(seed, month, 'birdStrike', planeId) < BIRD_STRIKE_CHANCE;
}

/** Kosten eines Vogelschlags: `BIRD_STRIKE_COST_SHARE × newPrice(Typ, Monat)` (5.12), Posten „Damage“. SPEZIFIKATION 8.6. */
export function birdStrikeCost(listPrice1960: number, month: number): number {
  return BIRD_STRIKE_COST_SHARE * newPrice(listPrice1960, month);
}

/** Eine Störung, zu der das Spiel fragen könnte. */
export interface DisruptionQuestionCandidate {
  /** Kennung der Störung beim Aufrufer. */
  readonly id: string;
  /** Gestrichener Anteil. */
  readonly share: number;
  /** Erlösverlust ohne Charter (aus dem Modell, R2). */
  readonly revenueLoss: number;
}

/**
 * Zu welchen Störungen das Spiel fragt (Charter oder streichen): Anteil ≥ `MAJOR_DISRUPTION_SHARE` und
 * Erlösverlust > 0, höchstens `MAX_DISRUPTION_QUESTIONS`, größter Verlust zuerst. Kennungen in dieser Reihenfolge.
 * SPEZIFIKATION 8.6.
 */
export function disruptionQuestions(candidates: readonly DisruptionQuestionCandidate[]): string[] {
  return candidates
    .filter((c) => c.share >= MAJOR_DISRUPTION_SHARE && c.revenueLoss > 0)
    .sort((a, b) => b.revenueLoss - a.revenueLoss)
    .slice(0, MAX_DISRUPTION_QUESTIONS)
    .map((c) => c.id);
}

// ---------------------------------------------------------------------------
// 8.7 Personal: Moral und Streik (nur Spieler)
// ---------------------------------------------------------------------------

/** Lohn in den Grenzen `SALARY_PCT_MIN … SALARY_PCT_MAX`. SPEZIFIKATION 8.7. */
export function clampSalary(salaryPct: number): number {
  return clamp(salaryPct, SALARY_PCT_MIN, SALARY_PCT_MAX);
}

/** Arbeitsmarkt-Zuschlag: Lohn-Punkte, die das Personal im Jahr des Monats erwartet (Daten); sonst 0. SPEZIFIKATION 8.7. */
export function labourMarketPremium(month: number): number {
  const year = yearOf(month);
  return LABOUR_MARKET.find((p) => year >= p.from && year <= p.to)?.points ?? 0;
}

/** Ein Personalstreik (im Spielstand, 8.3). */
export interface StaffStrike {
  /** Der Monat, den er trifft (ein ganzer Monat). */
  readonly month: number;
  /** Antwort; fehlt = keine Antwort (wie „Sit it out“). */
  readonly answer?: 'raisePay' | 'sitOut';
  /** Vereinbarter Lohn nach „Raise pay“; Untergrenze, solange der Streik nachwirkt. */
  readonly agreedPct?: number;
}

/** Wirkt der Streik im Monat `month` noch nach: `0 ≤ month − Streikmonat ≤ STRIKE_MEMORY_MONTHS`. SPEZIFIKATION 8.7. */
export function strikeIsRecent(strike: Pick<StaffStrike, 'month'> | undefined, month: number): boolean {
  if (!strike) return false;
  const since = month - strike.month;
  return since >= 0 && since <= STRIKE_MEMORY_MONTHS;
}

/** Eingaben für `moraleTarget`. */
export interface MoraleTargetInput {
  readonly salaryPct: number;
  /** Monat, für den das Ziel gilt (X+1). */
  readonly month: number;
  /** Σ `moralePoints` der fertigen Forschung (6.9). */
  readonly moralePoints: number;
  /** Gewinnserie in Monaten (6.10). */
  readonly profitStreak: number;
  /** Letzter Streik (oder keiner). */
  readonly strike?: Pick<StaffStrike, 'month'>;
}

/**
 * Moral-Ziel: `kappen(BASE_MORALE + Σ moralePoints + (Lohn − 100 − Arbeitsmarkt) × MORALE_PER_PAY_POINT
 * + (Serie > PROFIT_STREAK_MONTHS ? PROFIT_STREAK_MORALE : 0) − (Streik nachwirkend ? STRIKE_MORALE_PENALTY : 0),
 * 0, 100)`. SPEZIFIKATION 8.7.
 */
export function moraleTarget(input: MoraleTargetInput): number {
  return clamp(
    BASE_MORALE +
      input.moralePoints +
      (clampSalary(input.salaryPct) - SALARY_PCT_MARKET - labourMarketPremium(input.month)) * MORALE_PER_PAY_POINT +
      (input.profitStreak > PROFIT_STREAK_MONTHS ? PROFIT_STREAK_MORALE : 0) -
      (strikeIsRecent(input.strike, input.month) ? STRIKE_MORALE_PENALTY : 0),
    0,
    100,
  );
}

/** Moral im neuen Monat: `morale + MORALE_STEP × (Ziel − morale)`, in 0 … 100. SPEZIFIKATION 8.7. */
export function nextMorale(morale: number, target: number): number {
  return clamp(morale + MORALE_STEP * (target - morale), 0, 100);
}

/** Streik-Chance je Monat: `max(0, STRIKE_MORALE_THRESHOLD − Moral) × STRIKE_CHANCE_PER_POINT`. SPEZIFIKATION 8.7. */
export function strikeChance(morale: number): number {
  return Math.max(0, STRIKE_MORALE_THRESHOLD - morale) * STRIKE_CHANCE_PER_POINT;
}

/**
 * Würfelt im Übergang einen Personalstreik für den Monat `month`; nur bei offenem Pech-Deckel (8.8).
 * SPEZIFIKATION 8.7.
 */
export function rollStaffStrike(seed: number, month: number, morale: number, capOpen: boolean): boolean {
  if (!capOpen) return false;
  return rng(seed, month, 'staffStrike', 'staff') < strikeChance(morale);
}

/**
 * Gestrichener Anteil aller Flüge durch den Personalstreik im Monat `month`: „Raise pay“ 0,5, „Sit it out“ oder
 * keine Antwort 1; ohne Streik in diesem Monat 0. Kein Charter, kein eigener Ruf-Abzug (E38). SPEZIFIKATION 8.7.
 */
export function strikeCancelShare(strike: StaffStrike | undefined, month: number): number {
  if (!strike || strike.month !== month) return 0;
  return strike.answer === 'raisePay' ? STRIKE_SETTLED_CANCEL_SHARE : STRIKE_FULL_CANCEL_SHARE;
}

/** Antwort „Raise pay“: vereinbarter Lohn = Lohn + `STRIKE_PAY_RAISE`, in den Grenzen. SPEZIFIKATION 8.7. */
export function settledSalary(salaryPct: number): number {
  return clampSalary(salaryPct + STRIKE_PAY_RAISE);
}

/** Niedrigster einstellbarer Lohn: der vereinbarte, solange der Streik nachwirkt; sonst `SALARY_PCT_MIN`. SPEZIFIKATION 8.7. */
export function salaryFloor(strike: StaffStrike | undefined, month: number): number {
  return strike?.agreedPct !== undefined && strikeIsRecent(strike, month) ? clampSalary(strike.agreedPct) : SALARY_PCT_MIN;
}

/** Lohn, wie der Spieler ihn einstellt: in den Grenzen und nicht unter `salaryFloor`. SPEZIFIKATION 8.7. */
export function setSalary(salaryPct: number, strike: StaffStrike | undefined, month: number): number {
  return Math.max(salaryFloor(strike, month), clampSalary(salaryPct));
}

// ---------------------------------------------------------------------------
// 8.8 Pech-Deckel (nur Spieler)
// ---------------------------------------------------------------------------

/** Beansprucht ein Zufalls-Pech-Ereignis den Monat: `Beginn ≤ month < Beginn + BAD_LUCK_CLAIM_FACTOR × Dauer`. SPEZIFIKATION 8.8. */
export function claimedByRandomEvent(randomEvents: readonly WorldEvent[], month: number): boolean {
  return randomEvents.some(
    (e) => isBadLuckEvent(e) && month >= e.startMonth && month < e.startMonth + BAD_LUCK_CLAIM_FACTOR * e.months,
  );
}

/**
 * Pech-Deckel offen für den Monat `month` (X+1): kein Zufalls-Pech-Ereignis beansprucht ihn und Monat X hatte kein
 * einmaliges Pech (Störung, die eine Spieler-Strecke traf, oder Personalstreik). SPEZIFIKATION 8.8.
 *
 * @param randomEvents Zufallsereignisse im Spielstand (geschichtliche zählen nie).
 * @param previousBadLuck Hatte Monat X einmaliges Pech (`TransitionRoll.badLuck` des letzten Übergangs)?
 */
export function badLuckCapOpen(randomEvents: readonly WorldEvent[], month: number, previousBadLuck: boolean): boolean {
  return !claimedByRandomEvent(randomEvents, month) && !previousBadLuck;
}

/** Eingaben für `rollTransition`. */
export interface TransitionRollInput extends Omit<DisruptionRollInput, 'capOpen'> {
  /** Zufallsereignisse im Spielstand vor dem Übergang. */
  readonly randomEvents: readonly WorldEvent[];
  /** Hatte Monat X einmaliges Pech? */
  readonly previousBadLuck: boolean;
  /** Moral der Gesellschaft mit Personal-Modell für X+1 (nach `nextMorale`); fehlt = kein Streik-Wurf. */
  readonly morale?: number;
}

/** Würfe eines Übergangs zu X+1. */
export interface TransitionRoll {
  /** Pech-Deckel offen zu Beginn des Übergangs. */
  readonly capOpen: boolean;
  /** Neues Zufallsereignis (beginnt in X+1) oder `null`. */
  readonly randomEvent: WorldEvent | null;
  readonly disruptions: readonly Disruption[];
  /** Personalstreik in X+1. */
  readonly staffStrike: boolean;
  /** Einmaliges Pech in X+1 (Störung unter dem Deckel oder Streik); Eingabe `previousBadLuck` des nächsten Übergangs. */
  readonly badLuck: boolean;
}

/**
 * Alle Zufalls-Würfe eines Übergangs in fester Reihenfolge Zufallsereignis → Störungen → Personalstreik; sobald
 * einer Pech für die Gesellschaft unter dem Deckel bringt, ist der Deckel für den Rest des Übergangs zu (R12, W12).
 * Geschichtliche Ereignisse und Vogelschläge zählen nicht. SPEZIFIKATION 8.8.
 */
export function rollTransition(input: TransitionRollInput): TransitionRoll {
  const capOpenAtStart = badLuckCapOpen(input.randomEvents, input.month, input.previousBadLuck);
  let capOpen = capOpenAtStart;
  const randomEvent = rollRandomEvent(input.seed, input.month, capOpen);
  if (randomEvent && isBadLuckEvent(randomEvent)) capOpen = false;
  const roll = rollDisruptions({ ...input, capOpen });
  capOpen = roll.capOpen;
  const staffStrike = input.morale !== undefined && rollStaffStrike(input.seed, input.month, input.morale, capOpen);
  return {
    capOpen: capOpenAtStart,
    randomEvent,
    disruptions: roll.disruptions,
    staffStrike,
    badLuck: roll.badLuck || staffStrike,
  };
}

// ---------------------------------------------------------------------------
// 8.9 Gestrichene und gecharterte Flüge
// ---------------------------------------------------------------------------

/** Eine Ursache, die Flüge einer Strecke trifft. */
export interface DisruptionCause {
  /** Gestrichener Anteil der Ursache. */
  readonly share: number;
  /** Charter-Antwort (nur Spieler; Personalstreik nie). */
  readonly chartered: boolean;
}

/** Was eine Strecke für die Zuordnung der Störungen braucht. */
export interface DisruptedRoute {
  /** Flugzeug der Strecke. */
  readonly planeId: string;
  /** Flughäfen beider Enden. */
  readonly airportIds: readonly [string, string];
  /** Regionen beider Enden (`regionOf`, R15). */
  readonly regions: readonly [WorldRegion, WorldRegion];
}

/**
 * Ursachen einer Strecke im Monat: Defekt ihres Flugzeugs, Streik an einem ihrer Flughäfen (je Flughafen), Wetter in
 * einer Region ihrer Enden (je Region einmal) und der Personalstreik der Gesellschaft. SPEZIFIKATION 8.9.
 *
 * @param disruptions Störungen dieses Monats (alle Gesellschaften).
 * @param staffStrikeShare `strikeCancelShare` der Gesellschaft (KI: 0).
 */
export function routeCauses(route: DisruptedRoute, disruptions: readonly Disruption[], staffStrikeShare = 0): DisruptionCause[] {
  const causes: DisruptionCause[] = [];
  for (const d of disruptions) {
    const hits =
      (d.kind === 'defect' && d.target === route.planeId) ||
      (d.kind === 'airportStrike' && route.airportIds.includes(d.target)) ||
      (d.kind === 'weather' && route.regions.includes(d.target as WorldRegion));
    if (hits) causes.push({ share: d.share, chartered: d.charter === true });
  }
  if (staffStrikeShare > 0) causes.push({ share: staffStrikeShare, chartered: false });
  return causes;
}

/** Anteile der geplanten Flüge einer Strecke im Monat. */
export interface DisruptionShares {
  /** Von irgendeiner Ursache getroffen. */
  readonly affectedShare: number;
  /** Gestrichen (mindestens eine Ursache ohne Charter). */
  readonly cancelledShare: number;
  /** Gechartert. */
  readonly charteredShare: number;
  /** Fliegt das eigene Flugzeug. */
  readonly flownShare: number;
}

/**
 * `affectedShare = 1 − Π (1 − Anteil)`, `cancelledShare = 1 − Π über Ursachen ohne Charter (1 − Anteil)`,
 * `charteredShare = affected − cancelled`, `flownShare = 1 − affected`. Ein Flug, den eine nicht gecharterte Ursache
 * trifft, fällt aus. SPEZIFIKATION 8.9.
 */
export function disruptionShares(causes: readonly DisruptionCause[]): DisruptionShares {
  let notAffected = 1;
  let notCancelled = 1;
  for (const c of causes) {
    notAffected *= 1 - c.share;
    if (!c.chartered) notCancelled *= 1 - c.share;
  }
  const affectedShare = 1 - notAffected;
  const cancelled = 1 - notCancelled;
  return {
    affectedShare,
    cancelledShare: cancelled,
    charteredShare: affectedShare - cancelled,
    flownShare: notAffected,
  };
}

/** Sitze im Markt (3.11): `Sitze × (1 − cancelledShare)`; gecharterte Flüge bieten ihre Sitze wie sonst. SPEZIFIKATION 8.9. */
export function offeredSeats(seats: number, routeCancelledShare: number): number {
  return seats * (1 - routeCancelledShare);
}

/** Selbst geflogene Abschnitte (5.3–5.5): geplante Abschnitte × `flownShare`. SPEZIFIKATION 8.9. */
export function flownLegs(plannedLegs: number, flownShare: number): number {
  return plannedLegs * flownShare;
}

/** Eine Strecke für den gestrichenen Anteil der Gesellschaft. */
export interface CancelledRoute {
  /** Sitze je Abflug, alle Klassen. */
  readonly seats: number;
  /** Geplante Abflüge im Monat. */
  readonly plannedDepartures: number;
  /** `cancelledShare` der Strecke. */
  readonly cancelledShare: number;
}

/**
 * `cancelledShare` der Gesellschaft = Σ (Sitze × Abflüge × cancelledShare) / Σ (Sitze × Abflüge); Charter zählt
 * nicht. Eingabe für den Ruf (6.2). SPEZIFIKATION 8.9.
 */
export function companyCancelledShare(routes: readonly CancelledRoute[]): number {
  let planned = 0;
  let cancelled = 0;
  for (const r of routes) {
    planned += r.seats * r.plannedDepartures;
    cancelled += r.seats * r.plannedDepartures * r.cancelledShare;
  }
  return cancelledShare(cancelled, planned);
}

/**
 * Charter-Gebühr je gechartertem Abschnitt: `CHARTER_MARKUP × flightOpsCost / geplante Abschnitte je Woche` (E32).
 * `flightOpsCost` = Treibstoff + Besatzung + Landung der Strecke je Woche beim **vollen** Flugplan (5.9).
 * SPEZIFIKATION 8.9.
 */
export function charterFee(flightOpsWeekly: number, plannedLegsPerWeek: number): number {
  return plannedLegsPerWeek > 0 ? (CHARTER_MARKUP * flightOpsWeekly) / plannedLegsPerWeek : 0;
}

/** Eine Strecke für die Charter-Kosten. */
export interface CharterRoute {
  /** `flightOpsCost` je Woche beim vollen Flugplan. */
  readonly flightOpsWeekly: number;
  /** Geplante Abschnitte je Woche. */
  readonly plannedLegsPerWeek: number;
  /** `charteredShare` der Strecke. */
  readonly charteredShare: number;
}

/**
 * Charter-Kosten im Monat = Σ charterFee × geplante Abschnitte je Woche × charteredShare × `WEEKS_PER_MONTH`;
 * jeder Flug zählt einmal. Posten „Charter“ (5.16). SPEZIFIKATION 8.9.
 */
export function charterCost(routes: readonly CharterRoute[]): number {
  let sum = 0;
  for (const r of routes) {
    sum += charterFee(r.flightOpsWeekly, r.plannedLegsPerWeek) * r.plannedLegsPerWeek * r.charteredShare * WEEKS_PER_MONTH;
  }
  return sum;
}

/**
 * Vorteil von Charter gegenüber Streichen je betroffenem Flug: Erlös − Kosten je Fluggast − Charter-Gebühr (die
 * eigenen Flugkosten entfallen in beiden Fällen; Beispiel 8.17: +11 742 $). Für die Frage (R2). SPEZIFIKATION 8.9.
 */
export function charterAdvantage(revenuePerFlight: number, passengerCostPerFlight: number, charterFeePerFlight: number): number {
  return revenuePerFlight - passengerCostPerFlight - charterFeePerFlight;
}

// ---------------------------------------------------------------------------
// 8.10 Verschleiß
// ---------------------------------------------------------------------------

/** Eine Strecke eines Flugzeugs für die geflogenen Stunden. */
export interface WearRoute {
  /** Blockminuten je Woche beim vollen Flugplan (alle Abschnitte). */
  readonly blockMinutesPerWeek: number;
  /** `flownShare` der Strecke. */
  readonly flownShare: number;
}

/**
 * Geflogene Stunden eines Flugzeugs im Monat: Σ Blockminuten je Woche × `flownShare` × `WEEKS_PER_MONTH` / 60.
 * Gecharterte und gestrichene Flüge zählen nicht (R12, W11). SPEZIFIKATION 8.10.
 */
export function flownHours(routes: readonly WearRoute[]): number {
  let hours = 0;
  for (const r of routes) hours += (r.blockMinutesPerWeek * r.flownShare * WEEKS_PER_MONTH) / 60;
  return hours;
}

/** Verschleiß eines Flugzeugs im Monat in Punkten. */
export interface MonthlyWear {
  readonly cabin: number;
  readonly airframe: number;
}

/**
 * `cabin = min(CABIN_WEAR_PER_HOUR × Stunden + WEAR_BASE, CABIN_WEAR_MAX) × Forschungs-Faktor`, Zelle ebenso. Für
 * alle Gesellschaften (E44). SPEZIFIKATION 8.10.
 *
 * @param researchWearFactor `researchEffects(...).wearFactor` (6.9); KI und ohne Forschung 1.
 */
export function monthlyWear(hours: number, researchWearFactor = 1): MonthlyWear {
  return {
    cabin: Math.min(CABIN_WEAR_PER_HOUR * hours + WEAR_BASE, CABIN_WEAR_MAX) * researchWearFactor,
    airframe: Math.min(AIRFRAME_WEAR_PER_HOUR * hours + WEAR_BASE, AIRFRAME_WEAR_MAX) * researchWearFactor,
  };
}

/** Zustand nach dem Verschleiß: `max(0, Zustand − Verschleiß)` (Skala gekappt). SPEZIFIKATION 8.10. */
export function wornCondition(condition: number, wear: number, scale: 'cabinCondition' | 'airframeCondition'): number {
  return clampScale(scale, condition - wear);
}
