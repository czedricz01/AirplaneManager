/**
 * Balance-Skript (Paket 3.9c): Abschnitt 8 der Spezifikation – Krisen-Antworten, Charter, Flottenmarkt, Verschleiß,
 * Kreditlinie, Szenario-Ziele – ohne Langlauf.
 *
 * Alle Zahlen kommen aus `src/model/` (Preise und Regeln aus `monthEvents.ts`, `fleetMarket.ts`, `fleet.ts`; Erlös und
 * Kosten aus `monthOperations` über die Beispiel-Welten in `world.ts`). Das Skript ändert keine Konstante.
 */

import { SCENARIOS } from '../data/scenarios';
import { charterQuestionFigures } from '../lib/modelMonthClose';
import { costIndex } from '../model/basics';
import {
  AIRPORT_STRIKE_CANCEL_SHARE,
  CREDIT_RATE,
  DEALER_SPREAD_BUY,
  DEALER_SPREAD_SELL,
  DEFECT_CANCEL_SHARE,
  HEDGE_PRICE_SHARE,
  HISTORICAL_EVENTS,
  OVERHAUL_PRICE_SHARE,
  PREORDER_DEPOSIT_SHARE,
  PREORDER_DISCOUNT_MAX,
  PREORDER_WINDOW_MONTHS,
  RECOVERY_PRICE_SHARE,
  START_REPUTATION,
  USED_CONDITION,
  USED_CONDITION_MAX,
  USED_CONDITION_MIN,
  WEEKS_PER_MONTH,
  type RivalPersonality,
} from '../model/constants';
import { fuelTable } from '../model/costs';
import { aircraftValue, newPrice, type ValuedAircraft } from '../model/fleet';
import { creditInterest, creditLimit, overhaulQuote, refitLabour, refitPrice, preorderDeliveryMonth, preorderDiscount, preorderUnitPrice, saleProceeds, usedPrice } from '../model/fleetMarket';
import { monthOperations, type CompanyOperations } from '../model/monthClose';
import { charterAdvantage, charterFee, defectChance, flownHours, historicalEvent, monthlyWear, recoveryPrice } from '../model/monthEvents';
import { researchEffects } from '../model/progress';
import { rivalAircraft } from '../model/rivals';
import { reputationAfter } from './career';
import { musd, num, pct, usd, type Check, type Section, type Table } from './report';
import { bestFareRatios, caseMarket, ROUTE_CASES, runCase, type CaseResult, type RouteCase } from './routes';
import { catalogType, marketState, monthOf, NEUTRAL_INPUTS, runMarket, sampleMonth, seatsTotal, type MarketSpec } from './world';

/** Größter Verkaufs-Bonus aus Forschung (resale-1 + resale-2, 6.9). */
export const MAX_RESALE_BONUS = researchEffects(['resale-1', 'resale-2']).resaleBonus;

// ---------------------------------------------------------------------------
// 8.5 Krisen-Antworten
// ---------------------------------------------------------------------------

/** Preis-Absicherung eines Ereignisses in Monats-Treibstoffrechnungen (Menge wie vor dem Beginn). */
export interface HedgeCase {
  readonly title: string;
  readonly months: number;
  /** Mittel `fuelTable(Monat) ÷ fuelTable(Monat vor Beginn)` über die Dauer. */
  readonly meanRatio: number;
  /** Preis in Monatsrechnungen: `HEDGE_PRICE_SHARE × Dauer`. */
  readonly price: number;
  /** Ersparnis in Monatsrechnungen: Σ (Verhältnis − 1). */
  readonly saving: number;
}

export function hedgeCases(): HedgeCase[] {
  return HISTORICAL_EVENTS.filter((e) => e.response?.kind === 'fuelHedge').map((e) => {
    const before = fuelTable(e.startMonth - 1);
    let sum = 0;
    for (let m = e.startMonth; m < e.startMonth + e.months; m++) sum += fuelTable(m) / before;
    return { title: e.title, months: e.months, meanRatio: sum / e.months, price: HEDGE_PRICE_SHARE * e.months, saving: sum - e.months };
  });
}

/** Rückgewinnung eines Ereignisses auf einer Strecke allein (Preis vor der Krise fest). */
export interface RecoveryCase {
  readonly title: string;
  readonly scale: number;
  readonly f: number;
  readonly r: number;
  readonly months: number;
  readonly lastRevenue: number;
  readonly price: number;
  /** Σ Ergebnis vor der Krise − ohne Antwort (Monatswerte über die Dauer). */
  readonly lostResult: number;
  /** Σ Ergebnis mit − ohne Antwort. */
  readonly gainedResult: number;
  /** Fluggäste mit ÷ ohne Antwort im ersten Monat. */
  readonly paxRatio: number;
}

/** Strecke für die Rückgewinnung: A320ceo FRA–MAD, Flag-Ausstattung, 14 Abflüge. */
const RECOVERY_ROUTE = { from: 'FRA', to: 'MAD', typeId: 'a320ceo', personality: 'flag' as RivalPersonality, departures: 14 };

export function recoveryCase(title: string, scale: number): RecoveryCase {
  const e = historicalEvent(title);
  const r = e.response?.recoveryShare ?? 0;
  const market = (month: number, recovery: boolean, fareRatios?: MarketSpec['offers'][number]['fareRatios']): MarketSpec => ({
    from: RECOVERY_ROUTE.from,
    to: RECOVERY_ROUTE.to,
    month,
    demandScale: scale,
    offers: [{ company: 'a', typeId: RECOVERY_ROUTE.typeId, personality: RECOVERY_ROUTE.personality, departures: RECOVERY_ROUTE.departures, fareRatios, inputs: { ...NEUTRAL_INPUTS, recoveryEvents: recovery ? [title] : [] } }],
  });
  const pre = e.startMonth - 1;
  const fares = bestFareRatios(market(pre, false), 'a');
  const preOps = runMarket(market(pre, false, fares)).a;
  const preResult = preOps.routes[0].result * WEEKS_PER_MONTH;
  let lost = 0;
  let gained = 0;
  let paxRatio = Number.NaN;
  for (let m = e.startMonth; m < e.startMonth + e.months; m++) {
    const without = runMarket(market(m, false, fares)).a;
    const withR = runMarket(market(m, true, fares)).a;
    lost += preResult - without.routes[0].result * WEEKS_PER_MONTH;
    gained += (withR.routes[0].result - without.routes[0].result) * WEEKS_PER_MONTH;
    if (m === e.startMonth) paxRatio = withR.passengers / without.passengers;
  }
  return { title, scale, f: e.demandMultiplier, r, months: e.months, lastRevenue: preOps.revenue, price: recoveryPrice(r, e.demandMultiplier, e.months, preOps.revenue), lostResult: lost, gainedResult: gained, paxRatio };
}

// ---------------------------------------------------------------------------
// 8.9 Charter
// ---------------------------------------------------------------------------

/** Charter oder streichen je betroffenem Flug (8.9). */
export interface CharterCase {
  readonly label: string;
  readonly revenuePerFlight: number;
  readonly passengerCostPerFlight: number;
  readonly ownOpsPerFlight: number;
  readonly feePerFlight: number;
  readonly advantage: number;
  readonly profitable: boolean;
}

export function charterCase(result: CaseResult, label = result.c.label): CharterCase {
  const r = result.route;
  const legs = r.plannedLegs;
  const fee = charterFee(r.flightOpsFull, legs);
  const revenuePerFlight = r.revenue / legs;
  const passengerCostPerFlight = r.passengerCost.total / legs;
  return {
    label,
    revenuePerFlight,
    passengerCostPerFlight,
    ownOpsPerFlight: r.flightOpsFull / legs,
    feePerFlight: fee,
    advantage: charterAdvantage(revenuePerFlight, passengerCostPerFlight, fee),
    profitable: r.result > 0,
  };
}

/**
 * Beträge der Störungs-Frage gegen die Rechnung des Monats (Paket 5.3a, E76). Die Frage rechnet den Monat der Störung
 * mit `charterQuestionFigures` (zweimal `monthOperations`: gestrichen, gechartert); hier wird derselbe Monat getrennt
 * ohne Störung, gestrichen und gechartert gerechnet. Alle Beträge je Monat.
 */
export interface CharterEstimateCase {
  readonly label: string;
  /** Auslastung ohne Störung. */
  readonly load: number;
  /** Erlösverlust beim Streichen nach der Frage. */
  readonly estimatedRevenue: number;
  /** Erlös ohne Störung − Erlös mit gestrichenen Flügen (Rechnung). */
  readonly realRevenueLoss: number;
  /** Erlös der betroffenen Flüge im Mittel (Erlös ohne Störung × Anteil; so schätzte die Frage bis 5.3a). */
  readonly naiveRevenue: number;
  /** Vorteil von Charter nach der Frage. */
  readonly estimatedAdvantage: number;
  /** Monatsergebnis mit Charter − mit gestrichenen Flügen (Rechnung; Ergebnis = Strecken-Ergebnis − Charter-Kosten). */
  readonly realAdvantage: number;
  /** Charter-Gebühr nach der Frage und gebucht (`charterCost`). */
  readonly estimatedFee: number;
  readonly realFee: number;
}

export function charterEstimateCase(result: CaseResult, label = result.c.label, share = AIRPORT_STRIKE_CANCEL_SHARE): CharterEstimateCase {
  const market = caseMarket(result.c, result.best, result.c.departures);
  const base = marketState(market);
  const strike = { month: market.month, kind: 'airportStrike' as const, target: market.from, share };
  const state = { ...base, companies: base.companies.map((c) => ({ ...c, inputs: { ...c.inputs, charter: true } })) };
  const run = (charter?: boolean): CompanyOperations =>
    monthOperations({ ...state, disruptions: charter === undefined ? [] : [{ ...strike, charter }] }).a;
  const none = run();
  const cancelled = run(false);
  const chartered = run(true);
  const monthResult = (o: CompanyOperations) => o.routes[0].result * WEEKS_PER_MONTH - o.charter;
  const question = charterQuestionFigures({ ...state, disruptions: [strike] }, strike, 'a');
  return {
    label,
    load: result.load,
    estimatedRevenue: question.revenue,
    realRevenueLoss: none.revenue - cancelled.revenue,
    naiveRevenue: none.revenue * share,
    estimatedAdvantage: question.advantage,
    realAdvantage: monthResult(chartered) - monthResult(cancelled),
    estimatedFee: question.fee,
    realFee: chartered.charter,
  };
}

// ---------------------------------------------------------------------------
// 8.11–8.13 Flottenmarkt
// ---------------------------------------------------------------------------

/** Zustand nach Alter wie im Gebrauchtmarkt (8.11, Mitte ohne Streuung); neu 100. */
export function typicalCondition(age: number): { readonly airframe: number; readonly cabin: number } {
  if (age <= 0) return { airframe: 100, cabin: 100 };
  const c = (start: number, perYear: number) => Math.min(USED_CONDITION_MAX, Math.max(USED_CONDITION_MIN, start - perYear * age));
  return { airframe: c(USED_CONDITION.airframe.start, USED_CONDITION.airframe.perYear), cabin: c(USED_CONDITION.cabin.start, USED_CONDITION.cabin.perYear) };
}

/** Ein Flugzeug mit Flag-Kabine, gebaut im Monat `built`, mit Zustand. */
export function valuedPlane(typeId: string, built: number, airframe: number, cabin: number): ValuedAircraft {
  const p = rivalAircraft('flag', catalogType(typeId), built, 'balance');
  return { ...p, airframeCondition: airframe, cabinCondition: cabin };
}

/** Strecken für den Kabinen-Umbau (B8.11). */
export const REFIT_ROUTES = ['A320ceo FRA–MAD 1990', 'A320ceo FRA–MAD 2019', 'A330-300 FRA–JFK 2019', 'ATR 72-200 HAM–NUE 1990'];

/** Kabinen-Umbau eines neuen Flugzeugs der Strecke auf dieselbe Kabine (8.13). */
export interface RefitCase {
  readonly label: string;
  readonly seats: number;
  readonly labour: number;
  readonly price: number;
  readonly monthlyResult: number;
}

export function refitCase(result: CaseResult): RefitCase {
  const month = sampleMonth(result.c.year);
  const plane = rivalAircraft(result.c.personality, catalogType(result.c.typeId), month, 'balance');
  const seats = seatsTotal(plane.seats);
  return {
    label: result.c.label,
    seats,
    labour: refitLabour(seats, month),
    price: refitPrice(plane.cabinListPrice1960, seats, month),
    monthlyResult: result.route.result * WEEKS_PER_MONTH,
  };
}

/** Händler-Spanne eines Flugzeugs im Alter `age`. */
export interface SpreadCase {
  readonly age: number;
  readonly value: number;
  readonly used: number;
  readonly sale: number;
  readonly saleMax: number;
  /** Verkauf (mit größter Forschung) ÷ Gebrauchtpreis. */
  readonly roundTrip: number;
}

export function spreadCase(typeId: string, built: number, age: number): SpreadCase {
  const cond = typicalCondition(age);
  const plane = valuedPlane(typeId, built, cond.airframe, cond.cabin);
  const value = aircraftValue(plane, built + age * 12);
  const used = usedPrice(value);
  const saleMax = saleProceeds(value, MAX_RESALE_BONUS);
  return { age, value, used, sale: saleProceeds(value), saleMax, roundTrip: saleMax / used };
}

/** Überholung eines Flugzeugs (8.13) mit Nutzen über weniger Defekte. */
export interface OverhaulCase {
  readonly label: string;
  readonly valueGain: number;
  readonly floor: number;
  readonly priceHangar: number;
  readonly priceExternal: number;
  readonly defectBefore: number;
  readonly defectAfter: number;
}

export function overhaulCase(label: string, typeId: string, built: number, month: number, airframe: number, cabin: number): OverhaulCase {
  const plane = valuedPlane(typeId, built, airframe, cabin);
  const withHangar = overhaulQuote(plane, month, 0, true);
  const external = overhaulQuote(plane, month, 0, false);
  if (!withHangar || !external) throw new Error('Überholung nicht möglich');
  const chance = (a: number) => defectChance({ airframeCondition: a, builtMonth: built, month, hasHangar: false, defectFactor: 1 });
  return {
    label,
    valueGain: withHangar.valueGain,
    floor: OVERHAUL_PRICE_SHARE * newPrice(plane.listPrice1960, month),
    priceHangar: withHangar.price,
    priceExternal: external.price,
    defectBefore: chance(airframe),
    defectAfter: chance(withHangar.airframeAfter),
  };
}

// ---------------------------------------------------------------------------
// 8.15 Szenario „Oil Shock“ (Ruf-Ziel 55)
// ---------------------------------------------------------------------------

/** Ruf-Ziel des Szenarios aus den Daten (`src/data/scenarios.ts`; 8.15, 6.15: 55). */
export const SCENARIO_REPUTATION_TARGET = ((): number => {
  const goal = SCENARIOS.find((s) => s.id === 'oil-shock')?.win.find((g) => g.kind === 'target' && g.metric === 'reputation');
  if (!goal || goal.kind !== 'target') throw new Error('Szenario oil-shock ohne Ruf-Ziel');
  return goal.target;
})();

/** Eine Ausstattung im Szenario: Persönlichkeit der Kabine und Kabinen-Zustand (Zelle bleibt 60). */
interface ScenarioSetup {
  readonly label: string;
  readonly personality: RivalPersonality;
  readonly cabin: number;
}

const SCENARIO_SETUPS: readonly ScenarioSetup[] = [
  { label: 'LCC-Kabine, Zustand 60', personality: 'lcc', cabin: 60 },
  { label: 'Flag-Kabine, Zustand 60 (ohne Umbau)', personality: 'flag', cabin: 60 },
  { label: 'Flag-Kabine nach Umbau (Zustand 90)', personality: 'flag', cabin: 90 },
  { label: 'Boutique-Kabine nach Umbau (Zustand 90)', personality: 'boutique', cabin: 90 },
];

/** Ergebnis einer Ausstattung im Szenario. */
export interface ScenarioCase {
  readonly label: string;
  readonly satisfaction: number;
  readonly reputationAtDeadline: number;
}

/** Szenario „Oil Shock“ (`src/data/scenarios.ts`): LHR, Okt. 1973 bis Dez. 1976, Trident 2E und 707-320B, Zustand 60. */
export function oilShockCases(): { readonly months: number; readonly cases: ScenarioCase[] } {
  const scenario = SCENARIOS.find((s) => s.id === 'oil-shock');
  if (!scenario) throw new Error('Szenario oil-shock fehlt');
  const months = scenario.deadlineOffset - scenario.startOffset + 1;
  const routes = [
    { to: 'CDG', typeId: 'trident-2e' },
    { to: 'JFK', typeId: '707-320b' },
  ];
  const cases = SCENARIO_SETUPS.map((s) => {
    let satPax = 0;
    let pax = 0;
    for (const r of routes) {
      const ops = runMarket({
        from: scenario.hub,
        to: r.to,
        month: scenario.startOffset,
        offers: [{ company: 'a', typeId: r.typeId, personality: s.personality, departures: 14, condition: { airframe: 60, cabin: s.cabin } }],
      }).a;
      satPax += ops.airlineSatisfaction * ops.passengers;
      pax += ops.passengers;
    }
    const satisfaction = satPax / pax;
    return { label: s.label, satisfaction, reputationAtDeadline: reputationAfter(START_REPUTATION, months, { airlineSatisfaction: satisfaction }) };
  });
  return { months, cases };
}

// ---------------------------------------------------------------------------
// Abschnitt
// ---------------------------------------------------------------------------

/** Rückgewinnungs-Fälle: drei Krisen, Marktgröße wie heute und × 0,25 (Richtung E67). */
export const RECOVERY_SCALES = [1, 0.25];

export interface EventInputs {
  /** Typische Strecken beim besten Preis (`ROUTE_CASES`, 3.9a). */
  readonly results: readonly CaseResult[];
  /** Dieselben Strecken mit Marktgröße × 0,25 (für Charter und Kreditlinie). */
  readonly smallMarket: readonly CaseResult[];
}

export function eventSection(inputs: EventInputs, recovery: readonly RecoveryCase[] = defaultRecovery()): Section {
  const checks: Check[] = [];
  const tables: Table[] = [];
  const { results } = inputs;

  // ---- 8.5 Preis-Absicherung ----
  const hedges = hedgeCases();
  checks.push({
    id: 'B8.1',
    spec: '8.5',
    rule: `Preis-Absicherung (\`HEDGE_PRICE_SHARE\` = ${num(HEDGE_PRICE_SHARE, 2)}): Ersparnis ÷ Preis je Ölkrise`,
    value: hedges.map((h) => `${h.title}: ${num(h.saving / h.price, 2)}`).join('; '),
    verdict: 'info',
  });
  tables.push({
    title: 'Preis-Absicherung je Ölkrise (in Treibstoff-Rechnungen des Monats vor dem Beginn)',
    header: ['Ereignis', 'Dauer', 'Treibstoff im Mittel (vor Beginn = 1)', 'Preis', 'Ersparnis', 'Ersparnis ÷ Preis'],
    rows: hedges.map((h) => [h.title, `${h.months} Monate`, num(h.meanRatio, 2), num(h.price, 2), num(h.saving, 2), num(h.saving / h.price, 2)]),
    note: 'Gleiche Menge Treibstoff wie vor der Krise; `fuelTable` mit den Krisen-Ausschlägen (E61). Die Absicherung friert den Tabellenpreis des Monats vor dem Beginn ein (8.5).',
  });

  // ---- 8.5 Rückgewinnung ----
  checks.push({
    id: 'B8.2',
    spec: '8.5',
    rule: `Rückgewinnung (\`RECOVERY_PRICE_SHARE\` = ${num(RECOVERY_PRICE_SHARE, 2)}): Mehr-Ergebnis ÷ Preis (A320ceo FRA–MAD allein, Preis vor der Krise fest)`,
    value: recovery.map((c) => `${c.title.split(' ')[1] ?? c.title} × ${num(c.scale, 2)}: ${num(c.gainedResult / c.price, 2)}`).join('; '),
    verdict: 'info',
  });
  tables.push({
    title: 'Rückgewinnung: A320ceo FRA–MAD, Flag-Ausstattung, allein, bester Preis des Monats vor der Krise',
    header: ['Ereignis', 'Marktgröße', 'f / r / Dauer', 'Fluggäste mit ÷ ohne Antwort', 'Ergebnis-Verlust ohne Antwort', 'davon zurückgeholt', 'Preis', 'Mehr-Ergebnis ÷ Preis'],
    rows: recovery.map((c) => [
      c.title,
      `× ${num(c.scale, 2)}`,
      `${num(c.f, 2)} / ${num(c.r, 2)} / ${c.months}`,
      num(c.paxRatio, 3),
      musd(c.lostResult, 2),
      c.lostResult > 0 ? pct(c.gainedResult / c.lostResult) : '–',
      musd(c.price, 2),
      num(c.gainedResult / c.price, 2),
    ]),
    note: 'Ergebnis = Strecken-Ergebnis (5.9) × `WEEKS_PER_MONTH`, Summe über die Dauer. „× 0,25“ verkleinert die Marktgröße wie ein kleineres `DEMAND_SCALE` (Richtung E67). Volle Flugzeuge verlieren bei kleinerer Nachfrage zuerst nur „Knappheit“; die Antwort holt dann wenig Fluggäste zurück.',
  });

  // ---- 8.9 Charter ----
  const charter = [...results.map((r) => charterCase(r)), ...inputs.smallMarket.map((r) => charterCase(r, `${r.c.label} × 0,25`))];
  const profitable = charter.filter((c) => c.profitable);
  checks.push({
    id: 'B8.3',
    spec: '8.9, E32',
    rule: `\`CHARTER_MARKUP\`: Charter lohnt gegenüber Streichen auf jeder Strecke mit Gewinn (Vorteil je Flug > 0)`,
    value: `${profitable.filter((c) => c.advantage > 0).length} von ${profitable.length} Strecken mit Gewinn; kleinster Vorteil ${usd(Math.min(...profitable.map((c) => c.advantage)))} je Flug (Gebühr ÷ Erlös je Flug ${pct(Math.min(...charter.map((c) => c.feePerFlight / c.revenuePerFlight)))} … ${pct(Math.max(...charter.map((c) => c.feePerFlight / c.revenuePerFlight)))})`,
    verdict: profitable.every((c) => c.advantage > 0) ? 'ok' : 'abweichung',
  });
  tables.push({
    title: 'Charter oder streichen je betroffenem Flug (Strecken beim besten Preis)',
    header: ['Strecke', 'Erlös je Flug', 'Kosten je Fluggast (Summe)', 'eigene Flugkosten', 'Charter-Gebühr', 'Vorteil Charter', 'Strecke mit Gewinn'],
    rows: charter.map((c) => [c.label, usd(c.revenuePerFlight), usd(c.passengerCostPerFlight), usd(c.ownOpsPerFlight), usd(c.feePerFlight), usd(c.advantage), c.profitable ? 'ja' : 'nein']),
    note: 'Vorteil = Erlös − Kosten je Fluggast − Charter-Gebühr (`charterAdvantage`, 8.9); die eigenen Flugkosten entfallen in beiden Fällen. Dazu kein Ruf-Abzug mit Charter (6.2).',
  });

  // ---- 8.9 Beträge der Störungs-Frage (5.3a, E76) ----
  const estimates = [...results.map((r) => charterEstimateCase(r)), ...inputs.smallMarket.map((r) => charterEstimateCase(r, `${r.c.label} × 0,25`))];
  const ratio = (a: number, b: number) => (Math.abs(b) > 1 ? a / b : Number.NaN);
  const same = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
  const differs = estimates.filter((e) => !same(e.estimatedRevenue, e.realRevenueLoss) || !same(e.estimatedAdvantage, e.realAdvantage) || !same(e.estimatedFee, e.realFee));
  const naive = estimates.map((e) => ratio(e.realRevenueLoss, e.naiveRevenue)).filter(Number.isFinite);
  checks.push({
    id: 'B8.10',
    spec: '8.9, E76, R2',
    rule: `Beträge der Störungs-Frage (\`charterQuestionFigures\`, Flughafen-Streik ${pct(AIRPORT_STRIKE_CANCEL_SHARE)}) = Rechnung des Monats mit und ohne Charter (Erlösverlust, Gebühr, Vorteil)`,
    value: `${estimates.length - differs.length} von ${estimates.length} Fällen gleich${differs.length ? ` (abweichend: ${differs.map((e) => e.label).join(', ')})` : ''}; echter Erlösverlust ÷ Erlös im Mittel ${pct(Math.min(...naive))} … ${pct(Math.max(...naive))} (so weit lag die Schätzung bis 5.3a daneben)`,
    verdict: differs.length === 0 ? 'ok' : 'abweichung',
  });
  tables.push({
    title: 'Beträge der Störungs-Frage gegen die Rechnung (Flughafen-Streik am Start-Flughafen, Monat, Strecken beim besten Preis)',
    header: ['Strecke', 'Auslastung', 'Erlös im Mittel × Anteil', 'Erlösverlust (Frage)', 'Erlösverlust (Rechnung)', 'Vorteil Charter (Frage)', 'Vorteil Charter (Rechnung)', 'Gebühr Frage / gebucht'],
    rows: estimates.map((e) => [
      e.label,
      pct(e.load),
      usd(e.naiveRevenue),
      usd(e.estimatedRevenue),
      `${usd(e.realRevenueLoss)} (${pct(ratio(e.realRevenueLoss, e.naiveRevenue))})`,
      usd(e.estimatedAdvantage),
      usd(e.realAdvantage),
      `${usd(e.estimatedFee)} / ${usd(e.realFee)}`,
    ]),
    note: 'Frage: `charterQuestionFigures` auf dem Monat mit der Störung (E76). Rechnung: derselbe Monat ohne Störung, gestrichen und gechartert (`monthOperations`), Vorteil = Monatsergebnis mit Charter − mit Streichen. „Erlös im Mittel × Anteil“ ist die alte Schätzung aus 5.2e: Beim Streichen verteilt das Modell die Fluggäste auf die übrigen Sitze (8.9), der echte Verlust ist darum kleiner, je mehr Sitze frei sind.',
  });

  // ---- 8.11 Händler-Spanne ----
  const built = sampleMonth(1990);
  const spreads = [0, 5, 10, 20].map((age) => spreadCase('a320ceo', built, age));
  const refLabel = 'A320ceo FRA–MAD 1990';
  const ref = results.find((r) => r.c.label === refLabel) ?? runCase(ROUTE_CASES.find((c) => c.label === refLabel) as RouteCase);
  const refMonthly = ref.route.result * WEEKS_PER_MONTH;
  const refAt = (month: number) => (refMonthly * costIndex(month)) / costIndex(built);
  const worstRoundTrip = Math.max(...spreads.map((s) => s.roundTrip));
  const bound = (1 - DEALER_SPREAD_SELL) * (1 + MAX_RESALE_BONUS) / (1 + DEALER_SPREAD_BUY);
  checks.push({
    id: 'B8.4',
    spec: '8.11, E30',
    rule: `Händler-Spanne −${pct(DEALER_SPREAD_SELL)} / +${pct(DEALER_SPREAD_BUY)}: Gebraucht kaufen und sofort verkaufen bringt höchstens ${pct(bound, 1)} zurück; Verlust in Monatsergebnissen einer Strecke`,
    value: `höchstens ${pct(worstRoundTrip, 1)}; Verlust Kauf→Verkauf ${spreads.map((s) => `Alter ${s.age}: ${num((s.used - s.sale) / refAt(built + s.age * 12), 2)}`).join(', ')} Monatsergebnisse (A320ceo FRA–MAD)`,
    verdict: worstRoundTrip <= bound + 1e-9 ? 'ok' : 'abweichung',
  });
  tables.push({
    title: 'Händler-Spanne: A320ceo (Flag-Kabine), gebaut Mai 1990',
    header: ['Alter', 'Zelle / Kabine', 'Wert', 'Gebrauchtpreis', 'Verkaufserlös', 'mit größter Forschung', 'zurück nach Kauf und Verkauf', 'Verlust in Monatsergebnissen'],
    rows: spreads.map((s) => {
      const c = typicalCondition(s.age);
      return [`${s.age} Jahre`, `${num(c.airframe)} / ${num(c.cabin)}`, musd(s.value, 2), musd(s.used, 2), musd(s.sale, 2), musd(s.saleMax, 2), pct(s.roundTrip, 1), num((s.used - s.sale) / refAt(built + s.age * 12), 2)];
    }),
    note: 'Zustand wie im Gebrauchtmarkt (8.11, ohne Streuung). Monatsergebnis: A320ceo FRA–MAD 1990 beim besten Preis × `WEEKS_PER_MONTH`, mit dem Kostenindex auf das Verkaufsjahr gerechnet (Fund 1: sehr hoch).',
  });

  // ---- 8.12 Vorbestellung ----
  const preorderRows = [1, 3, 6, 12].map((n) => {
    const d = preorderDiscount(n);
    const price = preorderUnitPrice(1, n);
    const heldMonths = preorderDeliveryMonth(PREORDER_WINDOW_MONTHS, n);
    return { n, d, price, heldMonths, flip: saleProceeds(1, MAX_RESALE_BONUS) - price, yearly: d / PREORDER_DEPOSIT_SHARE / (heldMonths / 12) };
  });
  const maxBound = 1 - (1 - DEALER_SPREAD_SELL) * (1 + MAX_RESALE_BONUS);
  checks.push({
    id: 'B8.5',
    spec: '8.12, E30',
    rule: `Vorbestell-Rabatt höchstens ${pct(PREORDER_DISCOUNT_MAX)} < ${pct(maxBound, 1)} (Vorbestellen und sofort verkaufen bringt nie Gewinn); Rabatt als Ertrag der Anzahlung`,
    value: `Rabatt 5 … ${pct(PREORDER_DISCOUNT_MAX)}; sofort verkauft ${pct(Math.max(...preorderRows.map((r) => r.flip)), 1)} des Werts; Rabatt ÷ Anzahlung je Jahr ${pct(Math.min(...preorderRows.map((r) => r.yearly)))} … ${pct(Math.max(...preorderRows.map((r) => r.yearly)))} (Kreditzins ${pct(CREDIT_RATE)})`,
    verdict: PREORDER_DISCOUNT_MAX < maxBound ? 'ok' : 'abweichung',
  });
  tables.push({
    title: `Vorbestellung (Bestellung ${PREORDER_WINDOW_MONTHS} Monate vor der Erstauslieferung; Anteile des Werts bei Lieferung)`,
    header: ['Stück', 'Rabatt', 'Preis', 'Lieferung nach', 'sofort verkauft (größte Forschung)', 'Rabatt ÷ Anzahlung je Jahr'],
    rows: preorderRows.map((r) => [String(r.n), pct(r.d), pct(r.price), `${r.heldMonths} Monaten`, pct(r.flip, 1), pct(r.yearly)]),
    note: `Anzahlung ${pct(PREORDER_DEPOSIT_SHARE)} des geschätzten Preises bei der Bestellung (8.12). „Rabatt ÷ Anzahlung je Jahr“ zeigt, wie viel die gebundene Anzahlung im Jahr einbringt (ohne Teuerung zwischen Bestellung und Lieferung).`,
  });

  // ---- 8.13 Überholung ----
  const overhauls = [
    overhaulCase('A320ceo, gebaut 1990, in 2010 (Zelle 50, Kabine 40)', 'a320ceo', monthOf(1990, 5), monthOf(2010, 5), 50, 40),
    overhaulCase('A320ceo, gebaut 1990, in 1995 (Zelle 85, Kabine 80)', 'a320ceo', monthOf(1990, 5), monthOf(1995, 5), 85, 80),
    overhaulCase('747-400, gebaut 1995, in 2015 (Zelle 50, Kabine 40)', '747-400', monthOf(1995, 5), monthOf(2015, 5), 50, 40),
    overhaulCase('CRJ200, gebaut 1995, in 2015 (Zelle 50, Kabine 40)', 'crj200', monthOf(1995, 5), monthOf(2015, 5), 50, 40),
    overhaulCase('A320ceo, gebaut 1990, in 2000 (Zelle 70, Kabine 60)', 'a320ceo', monthOf(1990, 5), monthOf(2000, 5), 70, 60),
  ];
  checks.push({
    id: 'B8.6',
    spec: '8.13, E31',
    rule: `Überholung (\`OVERHAUL_PRICE_SHARE\` = ${num(OVERHAUL_PRICE_SHARE, 2)}): Preis ≥ Wertgewinn; wo bindet der Mindestpreis?`,
    value: `Preis ≥ Wertgewinn in ${overhauls.filter((o) => o.priceHangar >= o.valueGain - 1e-6).length} von ${overhauls.length} Fällen; Mindestpreis bindet in ${overhauls.filter((o) => o.floor > o.valueGain).length}; Defekt-Chance sinkt um ${overhauls.map((o) => pct(o.defectBefore - o.defectAfter, 2)).join(' / ')} je Monat`,
    verdict: overhauls.every((o) => o.priceHangar >= o.valueGain - 1e-6) ? 'ok' : 'abweichung',
  });
  tables.push({
    title: 'Grundüberholung (erste Überholung, +50 Zellen-Punkte)',
    header: ['Fall', 'Wertgewinn', `${pct(OVERHAUL_PRICE_SHARE)} des Neupreises`, 'Preis mit Hangar', 'Preis fremde Werft', 'Defekt-Chance vorher / nachher', 'weniger gestrichene Flüge je Jahr'],
    rows: overhauls.map((o) => [
      o.label,
      musd(o.valueGain, 2),
      musd(o.floor, 2),
      musd(o.priceHangar, 2),
      musd(o.priceExternal, 2),
      `${pct(o.defectBefore, 2)} / ${pct(o.defectAfter, 2)}`,
      pct((o.defectBefore - o.defectAfter) * DEFECT_CANCEL_SHARE * 12, 2),
    ]),
    note: 'Ohne Hangar (Defekt-Chance). „Weniger gestrichene Flüge je Jahr“ = Anteil der Flüge des Flugzeugs im Jahr (Defekt streicht 50 % eines Monats). Mit Hangar ist der Netto-Preis (Preis − Wertgewinn) 0, sobald der Wertgewinn den Mindestpreis übersteigt.',
  });

  // ---- 8.13 Kabinen-Umbau (5.3a) ----
  const refits = REFIT_ROUTES.map((label) => refitCase(results.find((r) => r.c.label === label) ?? runCase(ROUTE_CASES.find((c) => c.label === label) as RouteCase)));
  checks.push({
    id: 'B8.11',
    spec: '8.13',
    rule: `Kabinen-Umbau (Kabine + \`REFIT_PER_SEAT_1960\` × Sitze, mit Kostenindex): Preis in Monatsergebnissen der Strecke`,
    value: refits.map((r) => `${r.label}: ${num(r.price / r.monthlyResult, 1)} (Lohn ${num(r.labour / r.monthlyResult, 2)})`).join('; '),
    verdict: 'info',
  });
  tables.push({
    title: 'Kabinen-Umbau auf dieselbe Kabine (Flag), Strecke beim besten Preis',
    header: ['Strecke', 'Sitze', 'Kabine', 'Umbau-Lohn', 'Preis', 'Monatsergebnis der Strecke', 'Preis ÷ Monatsergebnis'],
    rows: refits.map((r) => [r.label, num(r.seats), musd(r.price - r.labour, 2), musd(r.labour, 2), musd(r.price, 2), musd(r.monthlyResult, 2), num(r.price / r.monthlyResult, 1)]),
    note: '`refitPrice` (8.13): `atCost(cabinListPrice)` + `refitLabour`. Der Lohn war früher Typ-Kapazität × 1 000 $ ohne Kostenindex. Wie oft umgebaut wird, zeigt der Verschleiß (B8.7, Kabine 50 nach etwa 6–7 Jahren auf Langstrecke).',
  });

  // ---- 8.10 Verschleiß ----
  const wearRows = results.map((r) => {
    const hours = flownHours([{ blockMinutesPerWeek: r.route.blockMinutes * r.route.plannedLegs, flownShare: 1 }]);
    const w = monthlyWear(hours);
    return { label: r.c.label, hours, cabinYear: 12 * w.cabin, airframeYear: 12 * w.airframe };
  });
  checks.push({
    id: 'B8.7',
    spec: '8.10',
    rule: 'Verschleiß mit `WEEKS_PER_MONTH`: Punkte je Jahr und Jahre bis Zustand 50 (Kabine / Zelle) bei typischem Flugplan',
    value: `${num(Math.min(...wearRows.map((w) => w.hours)))} … ${num(Math.max(...wearRows.map((w) => w.hours)))} Stunden je Monat; Kabine ${num(Math.min(...wearRows.map((w) => w.cabinYear)), 1)} … ${num(Math.max(...wearRows.map((w) => w.cabinYear)), 1)}, Zelle ${num(Math.min(...wearRows.map((w) => w.airframeYear)), 1)} … ${num(Math.max(...wearRows.map((w) => w.airframeYear)), 1)} Punkte je Jahr`,
    verdict: 'info',
  });
  tables.push({
    title: 'Verschleiß je Strecke (Flugplan der typischen Strecken, nichts gestrichen)',
    header: ['Strecke', 'Blockstunden je Monat', 'Kabine je Jahr', 'Zelle je Jahr', 'Jahre bis Kabine 50', 'Jahre bis Zelle 50'],
    rows: wearRows.map((w) => [w.label, num(w.hours), num(w.cabinYear, 1), num(w.airframeYear, 1), num(50 / w.cabinYear, 1), num(50 / w.airframeYear, 1)]),
    note: 'Gebrauchtmarkt zum Vergleich: Zelle −2,2, Kabine −2,8 Punkte je Jahr (8.11).',
  });

  // ---- 8.14 Kreditlinie ----
  const creditRows = [...results, ...inputs.smallMarket].map((r, i) => {
    const plane = valuedPlane(r.c.typeId, sampleMonth(r.c.year), 100, 100);
    const limit = creditLimit(aircraftValue(plane, sampleMonth(r.c.year)));
    const monthlyCost = (r.route.passengerCost.total + r.route.fixed.total) * WEEKS_PER_MONTH;
    const monthlyFixed = r.route.fixed.total * WEEKS_PER_MONTH;
    const monthlyResult = r.route.result * WEEKS_PER_MONTH;
    return { label: i < results.length ? r.c.label : `${r.c.label} × 0,25`, limit, monthlyCost, monthlyFixed, monthlyResult, interest: creditInterest(-limit) };
  });
  checks.push({
    id: 'B8.8',
    spec: '8.14, E34',
    rule: `Kreditlinie (${pct(CREDIT_RATE)} Zins, Grenze \`CREDIT_LIMIT_SHARE\` × Flottenwert): Grenze in Monaten fester Strecken-Kosten; Zins bei voller Nutzung gegen das Monatsergebnis`,
    value: `Grenze = ${num(Math.min(...creditRows.map((c) => c.limit / c.monthlyFixed)), 1)} … ${num(Math.max(...creditRows.map((c) => c.limit / c.monthlyFixed)), 1)} Monate fester Kosten; Zins = ${pct(Math.min(...creditRows.filter((c) => c.monthlyResult > 0).map((c) => c.interest / c.monthlyResult)))} … ${pct(Math.max(...creditRows.filter((c) => c.monthlyResult > 0).map((c) => c.interest / c.monthlyResult)))} des Monatsergebnisses`,
    verdict: 'info',
  });
  tables.push({
    title: 'Kreditlinie für ein neues Flugzeug je Strecke',
    header: ['Strecke', 'Kreditgrenze', 'feste Kosten je Monat', 'Grenze in Monaten fester Kosten', 'Kosten je Monat', 'Monatsergebnis', 'Zins bei voller Nutzung'],
    rows: creditRows.map((c) => [c.label, musd(c.limit, 2), musd(c.monthlyFixed, 2), num(c.limit / c.monthlyFixed, 1), musd(c.monthlyCost, 2), musd(c.monthlyResult, 2), musd(c.interest, 3)]),
    note: 'Feste Kosten = Treibstoff, Besatzung, Landung, Slot- und Flugzeug-Anteil (5.9); ohne Kosten der Gesellschaft. Kauf nur aus Guthaben; die Kreditlinie deckt laufende Verluste (8.14).',
  });

  // ---- 8.15 Szenario-Ziele ----
  const oil = oilShockCases();
  const best = Math.max(...oil.cases.map((c) => c.reputationAtDeadline));
  const worst = Math.min(...oil.cases.map((c) => c.reputationAtDeadline));
  checks.push({
    id: 'B8.9',
    spec: '8.15, 6.15',
    rule: `Szenario „Oil Shock“: Ruf ${SCENARIO_REPUTATION_TARGET} bis zum Stichtag ist mit einer besseren Kabine erreichbar, aber nicht ohne Zutun`,
    value: `nach ${oil.months} Monaten: ${oil.cases.map((c) => `${c.label} ${num(c.reputationAtDeadline, 1)}`).join('; ')}`,
    verdict: best >= SCENARIO_REPUTATION_TARGET && worst < SCENARIO_REPUTATION_TARGET ? 'ok' : 'abweichung',
  });
  tables.push({
    title: `Szenario „Oil Shock“ (LHR, Okt. 1973 bis Dez. 1976): Ruf am Stichtag je Ausstattung (Start ${START_REPUTATION})`,
    header: ['Ausstattung', 'Airline satisfaction', 'Ruf am Stichtag', `Ziel ${SCENARIO_REPUTATION_TARGET} erreicht`],
    rows: oil.cases.map((c) => [c.label, num(c.satisfaction, 1), num(c.reputationAtDeadline, 1), c.reputationAtDeadline >= SCENARIO_REPUTATION_TARGET ? 'ja' : 'nein']),
    note: 'Trident 2E LHR–CDG und 707-320B LHR–JFK, je 14 Abflüge, Zelle 60, Service nach der Persönlichkeit; Satisfaction nach Fluggästen gemittelt, ohne Ausfälle. Ruf nach `reputationChange` Monat für Monat (6.5).',
  });
  const moneyRows: string[][] = [];
  for (const s of SCENARIOS) {
    for (const g of s.win) {
      if (g.metric === 'capital' || g.metric === 'monthlyProfit') moneyRows.push([s.title, g.label, usd(g.target), usd(g.target / costIndex(s.startOffset))]);
    }
    for (const g of s.lose) {
      const t = g.threshold;
      moneyRows.push([s.title, g.label, typeof t === 'number' ? usd(t) : '−Kreditlinie', typeof t === 'number' ? usd(t / costIndex(s.startOffset)) : '−Kreditlinie']);
    }
    moneyRows.push([s.title, 'Startkasse', usd(s.capital), usd(s.capital / costIndex(s.startOffset))]);
  }
  tables.push({
    title: 'Dollar-Beträge der Szenarien als Wert von 1960 (für Phase 5.1, E6)',
    header: ['Szenario', 'Ziel / Schwelle', 'heute', 'Wert 1960 (÷ Kostenindex des Starts)'],
    rows: moneyRows,
    note: 'Nach 8.15 stehen Dollar-Ziele als Wert von 1960 in den Daten und laufen über `atCost` des Prüfmonats. Die Pleite-Schwelle ist −`creditLimit` (8.15); „Oil Shock“ hat die eigene Schwelle 0 $ (E77).',
  });

  return { title: 'Abschnitt 8: Monatsabschluss, Ereignisse, Flottenmarkt', checks, tables };
}

/** Rückgewinnung für die drei Krisen mit Antwort `demandRecovery`, je Marktgröße. */
export function defaultRecovery(): RecoveryCase[] {
  const titles = HISTORICAL_EVENTS.filter((e) => e.response?.kind === 'demandRecovery').map((e) => e.title);
  return titles.flatMap((t) => RECOVERY_SCALES.map((s) => recoveryCase(t, s)));
}

/** Strecken mit kleinerem Markt (× 0,25) für Charter und Kreditlinie. */
export const SMALL_MARKET_CASES: readonly string[] = ['ATR 72-200 HAM–NUE 1990', 'A320ceo FRA–MAD 1990', 'A330-300 FRA–JFK 1995'];

/** Die kleineren Märkte zu `SMALL_MARKET_CASES`. */
export function smallMarketResults(cases: readonly RouteCase[]): CaseResult[] {
  return SMALL_MARKET_CASES.map((label) => {
    const c = cases.find((x) => x.label === label);
    if (!c) throw new Error(`Fall ${label} fehlt`);
    return runCase(c, 0.25);
  });
}
