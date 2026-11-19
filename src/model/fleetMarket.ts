/**
 * Monatsabschluss Teil a, Flottenmarkt und Kasse: SPEZIFIKATION 8.11–8.14 (Paket 3.8a).
 *
 * 8.11 Händler-Spanne, Verkauf, Gebrauchtmarkt; 8.12 Neukauf und Vorbestellung; 8.13 Grundüberholung und
 * Kabinen-Umbau; 8.14 Kreditlinie, Zwangsverkauf, Spielende.
 *
 * Grundlage jedes Preises ist das Wertmodell `aircraftValue` / `valueBase` (5.13, E29). Beträge als Anteil einer
 * Größe bekommen keinen zweiten Index (Abschnitt 8, „Geld“); feste Beträge laufen über `atCost`. Eine Regel für
 * Spieler und KI (E44): Was nur der Spieler hat (Forschungs-Zuschlag auf den Erlös, Vorbestellung, Gebrauchtkauf),
 * kommt als neutrale Eingabe. Alles ungerundet (R4).
 */

import { atCost, clamp, clampScale } from './basics';
import {
  CREDIT_LIMIT_SHARE,
  CREDIT_RATE,
  DEALER_SPREAD_BUY,
  DEALER_SPREAD_SELL,
  EXTERNAL_OVERHAUL_SURCHARGE,
  LAUNCH_WINDOW_MONTHS,
  OVERDRAWN_TO_FORCED_SALE,
  OVERHAUL_POINTS,
  OVERHAUL_PRICE_SHARE,
  PREORDER_BASE_WAIT,
  PREORDER_BATCH,
  PREORDER_DEPOSIT_SHARE,
  PREORDER_DISCOUNT_BASE,
  PREORDER_DISCOUNT_MAX,
  PREORDER_DISCOUNT_STEP,
  PREORDER_MAX,
  PREORDER_MAX_DELAYS,
  PREORDER_REFUND_SHARE,
  PREORDER_WINDOW_MONTHS,
  REFIT_CONDITION_MIN,
  REFIT_CONDITION_START,
  REFIT_CONDITION_STEP,
  REFIT_PER_SEAT_1960,
  USED_AGE_MAX,
  USED_AGE_MIN,
  USED_CONDITION,
  USED_CONDITION_MAX,
  USED_CONDITION_MIN,
  USED_MARKET_SEED,
  USED_MIN_SERVICE_YEARS,
  USED_OFFERS_PER_MONTH,
  USED_RESOLD_MAX,
  USED_RESOLD_MONTHS,
} from './constants';
import { aircraftValue, newPrice, type ValuedAircraft } from './fleet';
import { rng } from './rng';
import { ageYears } from './satisfaction';

// ---------------------------------------------------------------------------
// 8.11 Händler-Spanne und Verkauf
// ---------------------------------------------------------------------------

/**
 * Verkaufserlös an den Markt: `aircraftValue × (1 − DEALER_SPREAD_SELL) × (1 + Σ resaleBonus)`. Gilt für jeden
 * Verkauf (Spieler, KI-Modernisierung, Not-, Leerlauf- und Zwangsverkauf). SPEZIFIKATION 8.11.
 *
 * @param value `aircraftValue` im Verkaufsmonat.
 * @param resaleBonus `researchEffects(...).resaleBonus` (6.9); KI und ohne Forschung 0.
 */
export function saleProceeds(value: number, resaleBonus = 0): number {
  return value * (1 - DEALER_SPREAD_SELL) * (1 + resaleBonus);
}

/** Gebrauchtpreis: `aircraftValue × (1 + DEALER_SPREAD_BUY)`; kein Mindestpreis (Restwert in 5.13). SPEZIFIKATION 8.11. */
export function usedPrice(value: number): number {
  return value * (1 + DEALER_SPREAD_BUY);
}

/** Ein Flugzeug für die Wahl beim Not- und Zwangsverkauf. */
export interface SaleCandidatePlane {
  /** Fliegt es eine Strecke? */
  readonly flying: boolean;
  /** `routeResult` seiner Strecke im Monat (5.9); ohne Strecke ohne Bedeutung. */
  readonly routeResult: number;
}

/**
 * Welches Flugzeug zuerst verkauft wird: ein abgestelltes (das erste), sonst das mit dem schlechtesten
 * Strecken-Ergebnis. −1 ohne Flugzeuge. Eine Regel für den Notverkauf der KI (7.11) und den Zwangsverkauf (8.14).
 * SPEZIFIKATION 8.14.
 */
export function saleCandidate(planes: readonly SaleCandidatePlane[]): number {
  if (planes.length === 0) return -1;
  const idle = planes.findIndex((p) => !p.flying);
  if (idle !== -1) return idle;
  let worst = 0;
  planes.forEach((p, i) => {
    if (p.routeResult < planes[worst].routeResult) worst = i;
  });
  return worst;
}

// ---------------------------------------------------------------------------
// 8.11 Gebrauchtmarkt
// ---------------------------------------------------------------------------

/** Was der Gebrauchtmarkt von einem Typ braucht (Felder wie `src/data/aircraft.ts`). */
export interface UsedMarketType {
  readonly id: string;
  readonly firstDeliveryOffset: number;
  /** Bauende; `null` = noch lieferbar. */
  readonly lastDeliveryOffset: number | null;
  /** Listenpreis in $ von 1960 (`basePrice`). */
  readonly basePrice: number;
}

/**
 * Mögliche Baumonate eines Gebraucht-Angebots im Monat `month`: zwischen Erstauslieferung und Bauende und mit Alter
 * `USED_AGE_MIN … USED_AGE_MAX` Jahren; nur Typen mit `USED_MIN_SERVICE_YEARS` im Dienst. `null` = kein Angebot
 * möglich (R13, W9). SPEZIFIKATION 8.11.
 */
export function usedBuildRange(type: UsedMarketType, month: number): { readonly from: number; readonly to: number } | null {
  if (!(type.basePrice > 0) || type.firstDeliveryOffset > month - USED_MIN_SERVICE_YEARS * 12) return null;
  const end = type.lastDeliveryOffset ?? month;
  const from = Math.max(type.firstDeliveryOffset, month - USED_AGE_MAX * 12);
  const to = Math.min(end, month - USED_AGE_MIN * 12);
  return from <= to ? { from, to } : null;
}

/** Ein neues Gebraucht-Angebot (ohne Preis; der folgt aus `usedPrice(aircraftValue)` im aktuellen Monat). */
export interface UsedOffer {
  /** `${Monat}:${n}`, im Monat fest. */
  readonly id: string;
  readonly typeId: string;
  readonly builtMonth: number;
  readonly airframeCondition: number;
  readonly cabinCondition: number;
}

/** Zustand eines Gebraucht-Angebots: `kappen(start − perYear × Alter + (u − 0,5) × 2 × spread, 20, 95)`. */
function usedCondition(part: keyof typeof USED_CONDITION, age: number, u: number): number {
  const c = USED_CONDITION[part];
  return clamp(c.start - c.perYear * age + (u - 0.5) * 2 * c.spread, USED_CONDITION_MIN, USED_CONDITION_MAX);
}

/**
 * Die neuen Angebote des Monats: `USED_OFFERS_PER_MONTH` Stück, nur nach Monat gewürfelt (gleiche Angebote in jedem
 * Spiel, 8.3); Typ gleich verteilt unter den möglichen, Baumonat gleich verteilt in `usedBuildRange`, Zustand nach
 * Alter mit Streuung. Kabine: Auslieferungs-Kabine (alles Economy, 74 cm, keine Extras), Einbaumonat = Baumonat;
 * deren `cabinListPrice` setzt der Aufrufer in `ValuedAircraft`. SPEZIFIKATION 8.11.
 */
export function usedOffers(types: readonly UsedMarketType[], month: number): UsedOffer[] {
  const eligible = types
    .map((type) => ({ type, range: usedBuildRange(type, month) }))
    .filter((e): e is { type: UsedMarketType; range: { from: number; to: number } } => e.range !== null);
  if (eligible.length === 0) return [];
  const offers: UsedOffer[] = [];
  for (let n = 0; n < USED_OFFERS_PER_MONTH; n++) {
    const draw = (what: string) => rng(USED_MARKET_SEED, month, 'usedMarket', `${n}:${what}`);
    const { type, range } = eligible[Math.floor(draw('type') * eligible.length)];
    const builtMonth = range.from + Math.floor(draw('built') * (range.to - range.from + 1));
    const age = ageYears(builtMonth, month);
    offers.push({
      id: `${month}:${n}`,
      typeId: type.id,
      builtMonth,
      airframeCondition: usedCondition('airframe', age, draw('airframe')),
      cabinCondition: usedCondition('cabin', age, draw('cabin')),
    });
  }
  return offers;
}

/** Ein an den Markt verkauftes Flugzeug (Spieler, KI, Auflösung 7.15), mit Baumonat, Zustand und Kabine. */
export interface ResoldAircraft {
  /** Monat des Verkaufs an den Markt. */
  readonly soldMonth: number;
}

/**
 * Weiterverkaufte Flugzeuge, die im Monat `month` im Markt stehen: verkauft vor höchstens `USED_RESOLD_MONTHS`
 * Monaten, die neuesten `USED_RESOLD_MAX` (bei gleichem Monat in der Reihenfolge der Eingabe). Verschleißen nicht,
 * altern aber (8.10). SPEZIFIKATION 8.11.
 */
export function resoldInMarket<P extends ResoldAircraft>(resold: readonly P[], month: number): P[] {
  return resold
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => month - p.soldMonth >= 0 && month - p.soldMonth < USED_RESOLD_MONTHS)
    .sort((a, b) => b.p.soldMonth - a.p.soldMonth || a.i - b.i)
    .slice(0, USED_RESOLD_MAX)
    .map(({ p }) => p);
}

/** Preis eines Flugzeugs im Gebrauchtmarkt im Monat `month`: `usedPrice(aircraftValue)`. SPEZIFIKATION 8.11. */
export function usedMarketPrice(plane: ValuedAircraft, month: number): number {
  return usedPrice(aircraftValue(plane, month));
}

// ---------------------------------------------------------------------------
// 8.12 Vorbestellung
// ---------------------------------------------------------------------------

/** Vorbestellbar im Monat `month`: Erstauslieferung in den nächsten `PREORDER_WINDOW_MONTHS` Monaten. SPEZIFIKATION 8.12. */
export function isPreorderable(type: Pick<UsedMarketType, 'firstDeliveryOffset'>, month: number): boolean {
  return type.firstDeliveryOffset > month && type.firstDeliveryOffset <= month + PREORDER_WINDOW_MONTHS;
}

/** Stückzahl einer Bestellung, ganzzahlig in 1 … `PREORDER_MAX`. SPEZIFIKATION 8.12. */
export function preorderQuantity(n: number): number {
  return clamp(Math.round(n), 1, PREORDER_MAX);
}

/** Rabatt: `min(PREORDER_DISCOUNT_MAX, PREORDER_DISCOUNT_BASE + PREORDER_DISCOUNT_STEP × (n − 1))`. SPEZIFIKATION 8.12. */
export function preorderDiscount(n: number): number {
  return Math.min(PREORDER_DISCOUNT_MAX, PREORDER_DISCOUNT_BASE + PREORDER_DISCOUNT_STEP * (preorderQuantity(n) - 1));
}

/** Liefermonat: Erstauslieferung + `PREORDER_BASE_WAIT` + ⌊n / `PREORDER_BATCH`⌋ (wie heute). SPEZIFIKATION 8.12. */
export function preorderDeliveryMonth(firstDeliveryOffset: number, n: number): number {
  return firstDeliveryOffset + PREORDER_BASE_WAIT + Math.floor(preorderQuantity(n) / PREORDER_BATCH);
}

/**
 * Preis je Flugzeug: `(1 − preorderDiscount) × valueBase` mit der `valueBase` eines neuen Flugzeugs (mit der
 * gewählten Kabine) im Liefermonat, also im Geld des Liefermonats. SPEZIFIKATION 8.12.
 */
export function preorderUnitPrice(valueBaseAtDelivery: number, n: number): number {
  return (1 - preorderDiscount(n)) * valueBaseAtDelivery;
}

/**
 * Anzahlung bei der Bestellung: `PREORDER_DEPOSIT_SHARE × geschätzter Preis × n`; geschätzter Preis = Preis je
 * Flugzeug mit der `valueBase` des **Bestellmonats** (F40). Ein Guthaben, kein Aufwand (8.2, 6.12). SPEZIFIKATION 8.12.
 */
export function preorderDeposit(valueBaseAtOrder: number, n: number): number {
  return PREORDER_DEPOSIT_SHARE * preorderUnitPrice(valueBaseAtOrder, n) * preorderQuantity(n);
}

/** Rest bei Lieferung: Preis der ganzen Bestellung − Anzahlung. SPEZIFIKATION 8.12. */
export function preorderBalance(valueBaseAtDelivery: number, n: number, deposit: number): number {
  return preorderUnitPrice(valueBaseAtDelivery, n) * preorderQuantity(n) - deposit;
}

/** Was mit einer fälligen Lieferung geschieht. */
export type PreorderDelivery = 'deliver' | 'delay' | 'cancel';

/**
 * Lieferung im Schritt 5: geliefert und bezahlt, wenn die Kasse nach allen übrigen Buchungen den Rest deckt (keine
 * Kreditlinie für Käufe, 8.14); sonst einen Monat später, höchstens `PREORDER_MAX_DELAYS` Mal; danach storniert,
 * Anzahlung verloren („Aircraft trades“). SPEZIFIKATION 8.12.
 *
 * @param delays bisherige Verschiebungen.
 */
export function preorderDelivery(cash: number, balance: number, delays: number): PreorderDelivery {
  if (cash >= balance) return 'deliver';
  return delays < PREORDER_MAX_DELAYS ? 'delay' : 'cancel';
}

/** Storno durch den Spieler: `PREORDER_REFUND_SHARE` der Anzahlung zurück; der Rest ist Aufwand. SPEZIFIKATION 8.12. */
export function preorderRefund(deposit: number): number {
  return PREORDER_REFUND_SHARE * deposit;
}

/** Erstkunde: Lieferung höchstens `LAUNCH_WINDOW_MONTHS` nach der Erstauslieferung → `launchBonus` (2.2). SPEZIFIKATION 8.12. */
export function isLaunchCustomer(deliveryMonth: number, firstDeliveryOffset: number): boolean {
  return deliveryMonth - firstDeliveryOffset <= LAUNCH_WINDOW_MONTHS;
}

// ---------------------------------------------------------------------------
// 8.13 Grundüberholung und Kabinen-Umbau
// ---------------------------------------------------------------------------

/** Zellen-Punkte der nächsten Überholung nach `done` bisherigen; 0 = keine weitere möglich. SPEZIFIKATION 8.13. */
export function overhaulPoints(done: number): number {
  return OVERHAUL_POINTS[done] ?? 0;
}

/** Angebot einer Grundüberholung. */
export interface OverhaulQuote {
  /** Zellen-Zustand danach (höchstens 100). */
  readonly airframeAfter: number;
  /** `aircraftValue` nachher − vorher. */
  readonly valueGain: number;
  /** Preis inklusive Werft-Zuschlag. */
  readonly price: number;
}

/**
 * Grundüberholung: Zelle + `OVERHAUL_POINTS[k]` (höchstens 100); Preis =
 * `max(OVERHAUL_PRICE_SHARE × newPrice(Typ, Monat), valueGain) × (1 + EXTERNAL_OVERHAUL_SURCHARGE ohne eigenen Hangar)`.
 * Der Wert steigt nie um mehr als den Preis (E31). `null`, wenn keine Überholung mehr möglich ist. Für Spieler und KI
 * (E62, 7.11). SPEZIFIKATION 8.13.
 *
 * @param hasHangar eigener Hangar an einem Flughafen seiner Strecken (KI: nie, 7.2).
 */
export function overhaulQuote(plane: ValuedAircraft, month: number, overhaulsDone: number, hasHangar: boolean): OverhaulQuote | null {
  const points = overhaulPoints(overhaulsDone);
  if (points <= 0) return null;
  const airframeAfter = clampScale('airframeCondition', plane.airframeCondition + points);
  const valueGain = aircraftValue({ ...plane, airframeCondition: airframeAfter }, month) - aircraftValue(plane, month);
  const base = Math.max(OVERHAUL_PRICE_SHARE * newPrice(plane.listPrice1960, month), valueGain);
  return { airframeAfter, valueGain, price: base * (1 + (hasHangar ? 0 : EXTERNAL_OVERHAUL_SURCHARGE)) };
}

/** Umbau-Lohn: `atCost(REFIT_PER_SEAT_1960 × Sitze, Monat)`; hebt keinen Wert („Aircraft trades“). SPEZIFIKATION 8.13. */
export function refitLabour(seats: number, month: number): number {
  return atCost(REFIT_PER_SEAT_1960 * seats, month);
}

/**
 * Preis eines Kabinen-Umbaus: `atCost(cabinListPrice(neue Kabine), Monat) + Umbau-Lohn`. Der Kabinen-Teil von
 * `valueBase` wird durch die neue Kabine ersetzt (Einbaumonat = jetzt, 5.13). SPEZIFIKATION 8.13.
 */
export function refitPrice(newCabinListPrice1960: number, seats: number, month: number): number {
  return atCost(newCabinListPrice1960, month) + refitLabour(seats, month);
}

/** Kabinenzustand nach dem Umbau: `max(jetzt, 90 − 10 × bisherige Umbauten, 30)`. SPEZIFIKATION 8.13. */
export function refitCabinCondition(cabinCondition: number, refitsDone: number): number {
  return Math.max(cabinCondition, REFIT_CONDITION_START - REFIT_CONDITION_STEP * refitsDone, REFIT_CONDITION_MIN);
}

// ---------------------------------------------------------------------------
// 8.14 Kreditlinie, Zwangsverkauf, Spielende (E34)
// ---------------------------------------------------------------------------

/** Kreditgrenze: `CREDIT_LIMIT_SHARE × Σ aircraftValue` (Flottenwert am Monatsende). SPEZIFIKATION 8.14. */
export function creditLimit(fleetValue: number): number {
  return CREDIT_LIMIT_SHARE * fleetValue;
}

/** Zinsen im Monat: `CREDIT_RATE / 12 × max(0, −Kasse am Monatsanfang)`; Guthaben bringt nichts. Posten „Interest“. SPEZIFIKATION 8.14. */
export function creditInterest(cashAtMonthStart: number): number {
  return (CREDIT_RATE / 12) * Math.max(0, -cashAtMonthStart);
}

/** Zustand der Kasse am Monatsende. */
export type CreditState = 'healthy' | 'credit' | 'overdrawn';

/** `healthy` bei Kasse ≥ 0, `credit` bis −Grenze, `overdrawn` darunter. SPEZIFIKATION 8.14. */
export function creditState(cash: number, limit: number): CreditState {
  if (cash >= 0) return 'healthy';
  return cash >= -limit ? 'credit' : 'overdrawn';
}

/** Überzogene Monate in Folge: + 1 bei `overdrawn`, sonst 0. SPEZIFIKATION 8.14. */
export function nextOverdrawnMonths(previous: number, state: CreditState): number {
  return state === 'overdrawn' ? previous + 1 : 0;
}

/**
 * Zwangsverkauf in diesem Abschluss: ab `OVERDRAWN_TO_FORCED_SALE` überzogenen Monaten in Folge ein Flugzeug
 * (`saleCandidate`) zu `saleProceeds`, solange die Kasse unter −Grenze liegt. −1 = keiner. SPEZIFIKATION 8.14.
 */
export function forcedSale(planes: readonly SaleCandidatePlane[], overdrawnMonths: number, state: CreditState): number {
  if (overdrawnMonths < OVERDRAWN_TO_FORCED_SALE || state !== 'overdrawn') return -1;
  return saleCandidate(planes);
}

/** Spielende (Pleite): überzogen und kein Flugzeug mehr. Nur Spieler; die KI folgt 7.15. SPEZIFIKATION 8.14. */
export function isBankrupt(state: CreditState, planeCount: number): boolean {
  return state === 'overdrawn' && planeCount === 0;
}

/** Einmalausgaben nur aus Guthaben: Kasse ≥ Preis. Die Kreditlinie deckt nur laufende Verluste und Zinsen. SPEZIFIKATION 8.14. */
export function canPay(cash: number, price: number): boolean {
  return cash >= price;
}
