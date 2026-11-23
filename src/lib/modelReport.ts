/**
 * Monatsbericht der Oberfläche nach dem Modell (Paket 4.7a, docs/neubau F67).
 *
 * Monatsbericht (`MonthlyReportScreen.tsx`) und Firma (`MyCompanyView.tsx`) bauten ihre Zeilen je selbst aus Schlüsseln
 * des alten Abschlusses (`routeInfra`, `mgt`, `desks`, `fleetParked` …), die der Abschluss nach dem Modell nicht mehr
 * schreibt; Abschreibung, Flugzeug-Geschäfte, Zinsen und Krisen-Antworten fehlten, die Summen passten nicht. Hier baut
 * eine Funktion die Zeilen für beide: Kosten je Posten aus 5.16 (mit den Posten aus Abschnitt 8) und der Weg vom
 * Monatsergebnis zur Kassen-Änderung (8.2), mit Prämien, Jahresziel (6.11, E58) und Kreditlinie (8.14).
 *
 * Berichte aus der Zeit vor dem Modell (alte Spielstände) zeigen ihre gespeicherten Posten; was keinem Posten zugeordnet
 * ist, steht in einer Rest-Zeile, damit die Summe immer Erlös − Ergebnis ist.
 *
 * Alles hier ist rein (keine Zustände, keine globalen Daten).
 */
import type { FinancialCategory, FinancialItem } from '../components/FinancialReport';
import { CREDIT_LIMIT_SHARE } from '../model/constants';
import { formatCurrency, formatNumber } from './format';
import type { MonthlyReport } from './gameTypes';

/** Die Zeilen eines Berichts für `FinancialReport`. */
export interface ReportView {
  /** Erlös je Strecke mit Auslastung und Umsteigern. */
  readonly revenues: FinancialItem[];
  /**
   * Kosten nach Posten. Abschnitte mit `variant: 'net'` sind Einnahmen bzw. Ergebnisse mit Vorzeichen (+ = mehr
   * Ergebnis); die übrigen sind Kosten. Σ Kosten − Σ net = Erlös − Monatsergebnis.
   */
  readonly expenses: FinancialCategory[];
  /** Ergebnis je Strecke (nur zur Ansicht, nicht in der Summe). */
  readonly routes: FinancialCategory | null;
  /** Vom Monatsergebnis zur Kassen-Änderung (8.2); Σ Zeilen = `cashChange`. */
  readonly cash: FinancialCategory;
  /** Kreditlinie am Monatsende (8.14); null bei Berichten vor dem Modell. */
  readonly credit: ReportCredit | null;
}

/** Kreditlinie am Monatsende aus dem Bericht. */
export interface ReportCredit {
  readonly limit: number;
  readonly used: number;
  readonly state: 'healthy' | 'credit' | 'overdrawn';
  /** Text für den Bericht (Englisch). */
  readonly text: string;
}

const num = (n: number | undefined): number => (Number.isFinite(n) ? (n as number) : 0);
const total = (items: readonly FinancialItem[]): number => items.reduce((s, i) => s + i.amount, 0);
const nonZero = (items: FinancialItem[]): FinancialItem[] => items.filter((i) => Math.abs(i.amount) >= 0.5);

/** Ein Bericht, den der Abschluss nach dem Modell geschrieben hat (`appReport` setzt „depreciation“, der alte nie). */
export function isModelReport(r: MonthlyReport): boolean {
  return r.breakdown != null && 'depreciation' in r.breakdown;
}

/** Kosten-Abschnitt; leer (alle Zeilen 0) → keiner. */
function section(id: string, label: string, items: FinancialItem[], variant?: 'net'): FinancialCategory[] {
  const shown = nonZero(items);
  if (shown.length === 0) return [];
  return [{ id, label, total: total(shown), items: shown, ...(variant ? { variant } : {}) }];
}

/** Posten 5.16 (Bericht nach dem Modell). */
function modelExpenses(r: MonthlyReport): FinancialCategory[] {
  const b = r.breakdown;
  return [
    ...section('flight', 'Flight costs', [
      { label: 'Fuel', amount: num(b.fuel) },
      { label: 'Crew', amount: num(b.staff) },
      { label: 'Landing fees', amount: num(b.landingFees) },
      { label: 'Passenger fees (check-in & handling)', amount: num(b.paxFees) },
      { label: 'Catering', amount: num(b.catering) },
    ]),
    ...section('airport', 'Airport upkeep', [{ label: 'Slots, stands, desks & facilities', amount: num(b.airportUpkeep) }]),
    ...section('aircraft', 'Aircraft', [
      { label: 'Insurance & maintenance (upkeep)', amount: num(b.fleetOwnership) },
      { label: 'Depreciation', amount: num(b.depreciation) },
    ]),
    // Signed: selling above or buying below the value is a gain.
    ...section('trades', 'Aircraft trades (price against value)', [{ label: 'Bought, sold, refitted & overhauled', amount: -num(b.aircraftTrades) }], 'net'),
    ...section('marketing', 'Marketing & loyalty', [{ label: 'Campaigns & frequent flyer programme', amount: num(b.marketing) }]),
    ...section('events', 'Charters, crises & credit', [
      { label: 'Charter fees', amount: num(b.charters) },
      { label: 'Crisis responses', amount: num(b.crisisResponses) },
      { label: 'Interest on the credit line', amount: num(b.interest) },
      { label: 'Damages', amount: num(b.damages) },
    ]),
    ...section('income', 'Airport income', [{ label: 'Fees from rivals at owned airports', amount: num(b.hubIncome) }], 'net'),
    ...section('subsidy', 'Subsidy', [{ label: 'Subsidy', amount: num(b.subsidy) }], 'net'),
  ];
}

/** Gespeicherte Posten eines Berichts vor dem Modell; Rest = Erlös − Ergebnis − Σ Posten. */
function oldExpenses(r: MonthlyReport): FinancialCategory[] {
  const b = r.breakdown ?? {};
  const fees = b.routeInfra !== undefined ? [{ label: 'Landing & passenger fees', amount: num(b.routeInfra) }] : [
    { label: 'Landing fees', amount: num(b.landingFees) },
    { label: 'Passenger fees', amount: num(b.paxFees) },
  ];
  const parts: FinancialCategory[] = [
    ...section('flight', 'Flight costs', [
      { label: 'Fuel', amount: num(b.fuel) },
      { label: 'Crew', amount: num(b.staff) },
      ...fees,
      { label: 'Catering', amount: num(b.catering) },
    ]),
    ...section('airport', 'Airport upkeep', [
      { label: 'Stands & slots', amount: num(b.mgt) },
      { label: 'Check-in desks', amount: num(b.desks) },
    ]),
    ...section('aircraft', 'Aircraft', [{ label: 'Insurance & maintenance (upkeep)', amount: num(b.fleetOwnership) }]),
    ...section('marketing', 'Marketing & loyalty', [{ label: 'Campaigns & frequent flyer programme', amount: num(b.marketing) }]),
    ...section('events', 'Repairs & charters', [{ label: 'Repairs & charters', amount: num(b.incidents) }]),
    ...section('income', 'Airport income', [{ label: 'Fees from rivals at owned airports', amount: num(b.hubIncome) }], 'net'),
  ];
  const listed = parts.reduce((s, p) => s + (p.variant === 'net' ? -p.total : p.total), 0);
  const rest = num(r.routeRevenues) - num(r.totalProfit) - listed;
  return [...parts, ...section('other', 'Other (older report)', [{ label: 'Not itemised in this report', amount: rest }])];
}

/** Kassen-Zeilen: Monatsergebnis → Kassen-Änderung (8.2). Die letzte Zeile ist der Rest, damit Σ = `cashChange`. */
function cashLines(r: MonthlyReport): FinancialItem[] {
  const result = num(r.totalProfit);
  const change = Number.isFinite(r.cashChange) ? (r.cashChange as number) : result;
  const lines: FinancialItem[] = [{ label: 'Operating profit', amount: result }];
  const b = r.breakdown ?? {};
  if (r.cash) {
    // In the profit but not paid this way: depreciation moves no money; trades and crisis responses were paid
    // in full with the one-off payments below.
    lines.push({ label: 'Depreciation (no cash)', amount: num(b.depreciation) });
    lines.push({ label: 'Aircraft trades & crisis responses (in the payments below)', amount: num(b.aircraftTrades) + num(b.crisisResponses) });
  }
  for (const i of r.capexItems ?? []) lines.push({ label: i.label, amount: -num(i.amount) });
  if (r.cash) {
    lines.push({ label: 'Milestone prizes', amount: num(r.cash.milestonePrizes) });
    const goal = num(r.cash.goal);
    lines.push({ label: goal >= 0 ? 'Board goal: reward' : 'Board goal missed: penalty', amount: goal });
  }
  const listed = total(lines);
  const rest = change - listed;
  const restLabel = r.cash
    ? `Deliveries${r.cash.forcedSales.length > 0 ? ' & forced sales' : ''} (balances and proceeds)`
    : 'Other cash movements';
  // The operating profit always shows, even at 0; every other line only when it moved money.
  const [profit, ...others] = lines;
  return [profit, ...nonZero([...others, { label: restLabel, amount: rest }])];
}

/** Kreditlinie am Monatsende (8.14) aus dem Bericht. */
function reportCredit(r: MonthlyReport): ReportCredit | null {
  if (!r.cash) return null;
  const cash = num(r.capitalAfter);
  const used = Math.max(0, -cash);
  const limit = num(r.cash.creditLimit);
  const state = r.cash.creditState;
  const share = `${formatNumber(CREDIT_LIMIT_SHARE * 100)}% of the fleet value`;
  const text =
    state === 'healthy'
      ? `Credit line ${formatCurrency(limit)} (${share}), unused.`
      : state === 'credit'
        ? `Credit used ${formatCurrency(used)} of ${formatCurrency(limit)} (${share}). Interest is charged on it.`
        : `Overdrawn: ${formatCurrency(used)} against a credit line of ${formatCurrency(limit)}. The bank sells aircraft if this lasts.`;
  return { limit, used, state, text };
}

/** Alle Zeilen eines gespeicherten Berichts für Monatsbericht und Firma. */
export function reportView(r: MonthlyReport): ReportView {
  const revenues = (r.routes ?? []).map((x) => {
    const lf = num(x.capacity) > 0 ? ` (${Math.round((num(x.paxPerWeek) / num(x.capacity)) * 100)}% LF)` : '';
    const transfer = num(x.transferPax) > 0 ? `, incl. ${formatNumber(num(x.transferPax))} transfer pax/wk` : '';
    return { label: `${x.name}${lf}${transfer}`, amount: num(x.revenue) };
  });
  const routes: FinancialCategory | null =
    r.routes && r.routes.length > 0
      ? {
          id: 'routeBreakdown',
          label: 'Per route',
          variant: 'net',
          total: r.routes.reduce((s, x) => s + num(x.profit), 0),
          items: r.routes.map((x) => ({ label: `${x.name} (rev ${formatCurrency(num(x.revenue))}, exp ${formatCurrency(num(x.cost))})`, amount: num(x.profit) })),
        }
      : null;
  const cash = cashLines(r);
  return {
    revenues,
    expenses: isModelReport(r) ? modelExpenses(r) : oldExpenses(r),
    routes,
    cash: { id: 'cash', label: 'From profit to cash', variant: 'net', total: total(cash), items: cash },
    credit: reportCredit(r),
  };
}
