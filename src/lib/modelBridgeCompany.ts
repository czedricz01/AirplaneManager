/**
 * Brücke Teil 2 (Paket 4.2c, E72, F55): Eingaben, Kasse, Vorbestellungen, Fortschritt und Berichte des Spielers,
 * zwischen dem Spielstand der Oberfläche und `CompanyState` des Modells (`src/model/monthClose.ts`). Teil 1 (Welt,
 * Flugzeuge, Strecken, Bestand) steht in `modelBridge.ts`.
 *
 * Wie Teil 1:
 * - **Lesen** baut aus den Feldern der Oberfläche die Modell-Werte.
 * - **Zurückschreiben** (`apply…`) übernimmt, was der Abschluss ändert. Felder, die das Modell nicht kennt (Kennungen
 *   der Kampagnen, Texte der Ziele, Preis-Anzeige der Bestellungen), bleiben.
 * - Regel: Lesen und gleich wieder Zurückschreiben ändert nichts (dieselben Objekte).
 */

import { aircraftList, type Aircraft } from '../data/aircraft';
import { scenarioById } from '../data/scenarios';
import type { OwnedAircraft } from '../components/MyFleetView';
import { atCost, yearOf } from '../model/basics';
import {
  HISTORICAL_EVENTS,
  LAUNCH_BONUS_MONTHS,
  RANK_AVERAGE_MONTHS,
  SCENARIO_DOLLAR_METRICS,
  STRIKE_FULL_CANCEL_SHARE,
  WEEKS_PER_MONTH,
  type AircraftClass,
  type Difficulty,
  type WorldRegion,
} from '../model/constants';
import { fleetValue, depositsOf, type CompanyInputs, type CompanyProgress, type MonthLedger, type MonthReport, type ModelAirport, type PreorderState, type ScenarioState as ModelScenario, type AircraftState, type Campaign as ModelCampaign } from '../model/monthClose';
import { yearsPlayed, type AnnualGoal as ModelGoal, type RankStats } from '../model/progress';
import type { StaffStrike } from '../model/monthEvents';
import type { MonthlyCosts } from '../model/costTotals';
import { historicalEvents, eventKey } from './eventSystem';
import { createOwnedAircraft, defaultCabin } from './fleet';
import { modelCabin } from './modelBridge';
import type { Career, Marketing, RegionId, ScenarioState as AppScenario, Staff } from './gameState';
import type { MonthlyReport, ReportLine, SimulatedRoute } from './gameTypes';
import type { PreOrder } from './preorders';
import type { ResearchState as AppResearch } from './research';

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

// ===========================================================================
// Eingaben (CompanyInputs, 7.1, 7.2)
// ===========================================================================

/** Was die Eingaben des Spielers aus dem Spielstand der Oberfläche brauchen. */
export interface PlayerInputsSource {
  readonly research: Pick<AppResearch, 'done'>;
  readonly staff: Staff;
  readonly marketing: Marketing;
  /** Schwierigkeit der Oberfläche („Easy“, „Normal“, „Hard“). */
  readonly difficulty: string;
  /** Gewählte Antworten auf Ereignisse, je `eventKey`. */
  readonly eventChoices: Readonly<Record<string, string>>;
}

/** Letzter Monat einer Kampagne der Oberfläche (sie läuft `duration` Monate ab `startOffset`). */
const campaignEnd = (c: Marketing['campaigns'][number]) => c.startOffset + c.duration - 1;

/** Kampagne der Oberfläche → `Campaign` des Modells. Weltweit: keine Regionen (deckt jede ab). */
function modelCampaign(c: Marketing['campaigns'][number]): ModelCampaign {
  return { tier: c.tier, regions: c.tier === 'global' ? [] : [c.region as WorldRegion], endMonth: campaignEnd(c) };
}

/**
 * Laufmonate des Frequent-flyer-Programms im Monat `month`, der laufende mitgezählt (3.9.4): im Startmonat 1.
 * Läuft es nicht, 0.
 */
export function ffpMonthsRunning(marketing: Pick<Marketing, 'ffpActive' | 'ffpSinceOffset'>, month: number): number {
  if (!marketing.ffpActive || marketing.ffpSinceOffset == null) return 0;
  return Math.max(1, month - marketing.ffpSinceOffset + 1);
}

/**
 * Gekaufte Krisen-Antworten aus den gewählten Antworten: Titel der Ereignisse, deren gewählte Antwort den
 * Treibstoffpreis absichert (`hedgesFuel`) bzw. Nachfrage zurückgewinnt (`softensDemand`). Nur geschichtliche
 * Ereignisse des Modells (8.5: nur die 6 weltweiten haben Antworten). Sortiert, ohne Doppelte.
 */
export function crisisResponses(eventChoices: Readonly<Record<string, string>>): { readonly hedged: string[]; readonly recovery: string[] } {
  const known = new Set(HISTORICAL_EVENTS.filter((e) => e.response).map((e) => e.title));
  const hedged = new Set<string>();
  const recovery = new Set<string>();
  for (const ev of historicalEvents) {
    const chosen = eventChoices[eventKey(ev)];
    const choice = chosen ? ev.choices?.find((c) => c.id === chosen) : undefined;
    if (!choice || !known.has(ev.title)) continue;
    if (choice.hedgesFuel) hedged.add(ev.title);
    if (choice.softensDemand) recovery.add(ev.title);
  }
  return { hedged: [...hedged].sort(), recovery: [...recovery].sort() };
}

/**
 * Personalstreik der Oberfläche als `StaffStrike` (8.7). Monat = `startOffset` (der Monat, dessen Flüge er trifft).
 * Mit vereinbartem Lohn: Antwort „Raise pay“; sonst keine Antwort (wirkt wie „Sit it out“).
 */
export function staffStrike(strike: Staff['strike']): StaffStrike | undefined {
  if (!strike) return undefined;
  return strike.agreedPct !== undefined
    ? { month: strike.startOffset, answer: 'raisePay', agreedPct: strike.agreedPct }
    : { month: strike.startOffset };
}

const DIFFICULTIES: readonly Difficulty[] = ['Easy', 'Normal', 'Hard'];

/**
 * Eingaben des Spielers im Monat `month` (7.1): Forschung, Lohn und Moral, laufende Kampagnen, Frequent flyer,
 * Schwierigkeit, gekaufte Krisen-Antworten, Streik. Der Spieler hat Pech-Deckel, Charter, Personal-Modell und
 * Zwangsverkauf (7.2); kein Zuschuss.
 */
export function companyInputs(src: PlayerInputsSource, month: number): CompanyInputs {
  const responses = crisisResponses(src.eventChoices);
  const strike = staffStrike(src.staff.strike);
  return {
    completedResearch: src.research.done,
    salaryPct: src.staff.salaryPct,
    morale: src.staff.morale,
    campaigns: src.marketing.campaigns.filter((c) => campaignEnd(c) >= month).map(modelCampaign),
    ffpMonthsRunning: ffpMonthsRunning(src.marketing, month),
    difficulty: DIFFICULTIES.includes(src.difficulty as Difficulty) ? (src.difficulty as Difficulty) : 'Normal',
    badLuckCap: true,
    charter: true,
    staffModel: true,
    forcedSale: true,
    hedgedEvents: responses.hedged,
    recoveryEvents: responses.recovery,
    ...(strike ? { staffStrike: strike } : {}),
  };
}

/** Was der Abschluss an den Eingaben ändert: Moral, neuer Streik, abgelaufene Kampagnen. */
export interface AppliedInputs {
  readonly staff: Staff;
  readonly marketing: Marketing;
}

/**
 * Schreibt die Eingaben nach dem Abschluss zurück (`inputs` gilt für den Monat `month` = X+1): Moral; ein neuer
 * Streik (anderer Monat als der alte) kommt ohne Antwort (alle Flüge fallen aus, bis der Spieler antwortet);
 * abgelaufene Kampagnen fallen weg. Forschung schreibt `applyCompanyProgress` zurück. Unverändertes bleibt
 * dasselbe Objekt.
 */
export function applyCompanyInputs(src: Pick<PlayerInputsSource, 'staff' | 'marketing'>, inputs: CompanyInputs, month: number): AppliedInputs {
  let staff = src.staff;
  if (staff.morale !== inputs.morale) staff = { ...staff, morale: inputs.morale };
  const strikeMonth = inputs.staffStrike?.month;
  if (strikeMonth !== undefined && strikeMonth !== src.staff.strike?.startOffset) {
    staff = { ...staff, strike: { startOffset: strikeMonth, cancelShare: STRIKE_FULL_CANCEL_SHARE } };
  }
  const kept = src.marketing.campaigns.filter((c) => campaignEnd(c) >= month);
  const marketing = kept.length === src.marketing.campaigns.length ? src.marketing : { ...src.marketing, campaigns: kept };
  return { staff, marketing };
}

// ===========================================================================
// Kasse und Kassenbuch (8.2)
// ===========================================================================

/** Einmalausgaben der Oberfläche (`monthlyCapex`): Betrag positiv = ausgegeben, negativ = eingenommen. */
export type CapexItem = { readonly label: string; readonly amount: number };

/** Posten der Oberfläche, die eigene Felder im Kassenbuch haben. */
export const CAPEX_LABELS = {
  purchases: ['Aircraft Purchases', 'Used Aircraft'],
  refits: 'Cabin Refits',
  overhauls: 'General Checks',
  sales: 'Aircraft Sales',
  /** Präfix der Krisen-Antworten (`GameDialogs.tsx`: „Crisis response: <Titel>“). */
  crisisPrefix: 'Crisis response',
} as const;

/**
 * Werte des Kassenbuchs, die die Oberfläche nicht aus ihren Feldern kennt: Flottenwert und Anzahlungen am
 * Monatsanfang, Wertänderung durch Geschäfte. Gespeichert je Monat (Feld kommt mit 4.2e in den Spielstand).
 */
export interface LedgerValues {
  readonly month: number;
  readonly fleetValueAtStart: number;
  readonly depositsAtStart: number;
  readonly tradeValueChange: number;
}

/** Werte zu Beginn eines Monats. */
export function openLedgerValues(aircraft: readonly AircraftState[], preorders: readonly PreorderState[], month: number): LedgerValues {
  return { month, fleetValueAtStart: fleetValue(aircraft, month), depositsAtStart: depositsOf(preorders), tradeValueChange: 0 };
}

/** Ein Geschäft während des Monats ändert den Flottenwert um `change` (Kauf +Wert, Verkauf −Wert, Umbau Wert nachher − vorher). */
export function withTradeValue(values: LedgerValues, change: number): LedgerValues {
  return { ...values, tradeValueChange: values.tradeValueChange + change };
}

/** Einmalausgaben nach Feldern des Kassenbuchs. */
function capexParts(capex: readonly CapexItem[]) {
  let purchases = 0;
  let refits = 0;
  let overhauls = 0;
  let saleProceeds = 0;
  let crisis = 0;
  const other: Record<string, number> = {};
  for (const { label, amount } of capex) {
    if ((CAPEX_LABELS.purchases as readonly string[]).includes(label)) purchases += amount;
    else if (label === CAPEX_LABELS.refits) refits += amount;
    else if (label === CAPEX_LABELS.overhauls) overhauls += amount;
    else if (label === CAPEX_LABELS.sales) saleProceeds -= amount;
    else if (label.startsWith(CAPEX_LABELS.crisisPrefix)) crisis += amount;
    else other[label] = (other[label] ?? 0) + amount;
  }
  return { purchases, refits, overhauls, saleProceeds, crisisResponses: crisis, otherSpending: other };
}

/** Was das Kassenbuch braucht, wenn keine gespeicherten Werte für den Monat da sind. */
export interface LedgerFallback {
  readonly aircraft: readonly AircraftState[];
  readonly preorders: readonly PreorderState[];
}

/**
 * Kassenbuch des Monats `month` aus Kasse (`capital`, nach den Einmalausgaben) und `monthlyCapex`:
 * Kasse am Monatsanfang = Kasse + Σ Einmalausgaben; Käufe, Umbauten, Überholungen, Verkäufe und Krisen-Antworten in
 * ihre Felder, alles andere nach Posten in `otherSpending`.
 *
 * Flottenwert und Anzahlungen am Monatsanfang und die Wertänderung durch Geschäfte kommen aus `values`. Fehlen sie
 * (alter Spielstand, oder `values` von einem anderen Monat): Geschäfte gelten als zum Wert (Wertänderung = Käufe +
 * Umbauten + Überholungen − Verkäufe, Zeile „Aircraft trades“ 0 in diesem Monat), Flottenwert am Anfang = Wert der
 * Flotte jetzt − diese Wertänderung, Anzahlungen am Anfang = jetzt − Posten „Aircraft Deposits“.
 */
export function monthLedger(
  capital: number,
  capex: readonly CapexItem[],
  values: LedgerValues | undefined,
  month: number,
  fallback: LedgerFallback,
): MonthLedger {
  const p = capexParts(capex);
  const usable = values && values.month === month ? values : undefined;
  const tradeValueChange = usable ? usable.tradeValueChange : p.purchases + p.refits + p.overhauls - p.saleProceeds;
  return {
    cashAtStart: capital + sum(capex.map((c) => c.amount)),
    fleetValueAtStart: usable ? usable.fleetValueAtStart : fleetValue(fallback.aircraft, month) - tradeValueChange,
    depositsAtStart: usable ? usable.depositsAtStart : depositsOf(fallback.preorders) - (p.otherSpending['Aircraft Deposits'] ?? 0),
    tradeValueChange,
    purchases: p.purchases,
    refits: p.refits,
    overhauls: p.overhauls,
    saleProceeds: p.saleProceeds,
    crisisResponses: p.crisisResponses,
    otherSpending: p.otherSpending,
  };
}

/** Kassenbuch → Einmalausgaben der Oberfläche (Posten mit 0 entfallen). */
export function capexOf(ledger: MonthLedger): CapexItem[] {
  const items: CapexItem[] = [
    { label: CAPEX_LABELS.purchases[0], amount: ledger.purchases },
    { label: CAPEX_LABELS.refits, amount: ledger.refits },
    { label: CAPEX_LABELS.overhauls, amount: ledger.overhauls },
    { label: CAPEX_LABELS.sales, amount: -ledger.saleProceeds },
    { label: `${CAPEX_LABELS.crisisPrefix}s`, amount: ledger.crisisResponses },
    ...Object.entries(ledger.otherSpending).map(([label, amount]) => ({ label, amount })),
  ];
  return items.filter((c) => c.amount !== 0);
}

/** Kasse und Kassenbuch der Oberfläche. */
export interface AppLedger {
  readonly capital: number;
  readonly monthlyCapex: readonly CapexItem[];
  readonly ledgerValues?: LedgerValues;
}

const sameLedger = (a: MonthLedger, b: MonthLedger): boolean =>
  a.cashAtStart === b.cashAtStart &&
  a.fleetValueAtStart === b.fleetValueAtStart &&
  a.depositsAtStart === b.depositsAtStart &&
  a.tradeValueChange === b.tradeValueChange &&
  a.purchases === b.purchases &&
  a.refits === b.refits &&
  a.overhauls === b.overhauls &&
  a.saleProceeds === b.saleProceeds &&
  a.crisisResponses === b.crisisResponses &&
  Object.keys({ ...a.otherSpending, ...b.otherSpending }).every((k) => (a.otherSpending[k] ?? 0) === (b.otherSpending[k] ?? 0));

/**
 * Kasse und Kassenbuch zurück: Kasse = `cash`, Einmalausgaben aus dem Kassenbuch (`capexOf`), gespeicherte Werte für
 * `month`. Nach dem Abschluss ist das Kassenbuch leer (8.0 Schritt 8): `monthlyCapex` wird leer. Ist alles wie vorher
 * (`before` mit denselben Werten gelesen), bleibt `before`.
 */
export function applyLedger(
  before: AppLedger,
  cash: number,
  ledger: MonthLedger,
  month: number,
  fallback: LedgerFallback,
): AppLedger {
  const read = monthLedger(before.capital, before.monthlyCapex, before.ledgerValues, month, fallback);
  if (before.capital === cash && sameLedger(read, ledger)) return before;
  return {
    capital: cash,
    monthlyCapex: capexOf(ledger),
    ledgerValues: { month, fleetValueAtStart: ledger.fleetValueAtStart, depositsAtStart: ledger.depositsAtStart, tradeValueChange: ledger.tradeValueChange },
  };
}

// ===========================================================================
// Vorbestellungen und Lieferungen (8.12)
// ===========================================================================

const typeById = (id: string, catalog: readonly Aircraft[]): Aircraft => {
  const t = catalog.find((a) => a.id === id);
  if (!t) throw new Error(`Flugzeugtyp ${id} fehlt im Katalog`);
  return t;
};

/**
 * Eine Bestellung der Oberfläche als `PreorderState`. Geliefert wird mit der Standard-Kabine (`defaultCabin`, wie
 * heute), eingebaut im Liefermonat. Anzahlung, Liefermonat und Verschiebungen wie gespeichert. Den Preis rechnet das
 * Modell bei Lieferung (`preorderUnitPrice`, 8.12); `unitPrice` der Oberfläche ist nur Anzeige.
 */
export function preorderState(order: PreOrder, catalog: readonly Aircraft[] = aircraftList): PreorderState {
  const type = typeById(order.aircraftId, catalog);
  const cabin = modelCabin(defaultCabin(type).config, { installedMonth: order.deliveryOffset, capacity: type.capacity });
  return {
    id: order.id,
    plane: {
      typeId: type.id,
      family: type.family,
      aircraftClass: type.class as AircraftClass,
      capacity: type.capacity,
      cruiseSpeed: type.cruiseSpeed,
      efficiency: type.efficiency,
      catalogAppeal: type.popularity,
      hasWifi: cabin.hasWifi,
      hasPremiumGalley: cabin.hasPremiumGalley,
      seats: cabin.seats,
      interiorScore: cabin.interiorScore,
      listPrice1960: type.basePrice,
      cabinListPrice1960: cabin.cabinListPrice1960,
    },
    count: order.quantity,
    deposit: order.deposit,
    deliveryMonth: order.deliveryOffset,
    delays: order.postponed,
    firstDeliveryOffset: type.firstDeliveryOffset,
  };
}

/**
 * Bestellungen zurück: was das Modell nicht mehr hat (geliefert oder storniert), fällt weg; verschobene bekommen
 * Liefermonat und Zahl der Verschiebungen. Unverändertes bleibt dasselbe Objekt.
 */
export function applyPreorders(orders: readonly PreOrder[], model: readonly PreorderState[]): PreOrder[] | readonly PreOrder[] {
  const byId = new Map(model.map((p) => [p.id, p]));
  let changed = false;
  const out = orders.flatMap((o) => {
    const p = byId.get(o.id);
    if (!p) {
      changed = true;
      return [];
    }
    if (p.deliveryMonth === o.deliveryOffset && p.delays === o.postponed) return [o];
    changed = true;
    return [{ ...o, deliveryOffset: p.deliveryMonth, postponed: p.delays }];
  });
  return changed ? out : orders;
}

/** Gelieferte Flugzeuge in der Flotte der Oberfläche und die neue Kennung jedes Modell-Flugzeugs. */
export interface Deliveries {
  readonly planes: readonly OwnedAircraft[];
  /** Kennung im Modell (`<Bestellung>-<n>`) → Kennzeichen. Für Würfe des nächsten Monats (Störungen, 4.2d). */
  readonly renamed: Readonly<Record<string, string>>;
}

/**
 * Flugzeuge, die das Modell geliefert hat (`newAircraft` aus `applyModelOperations`), als Flugzeuge der Flotte:
 * Kennzeichen wie bei jedem Kauf (Land des Drehkreuzes), Standard-Kabine, Baumonat, Einbaumonat und Zustand aus dem
 * Modell; Erstkunde: `launchBonusUntil` = Baumonat + `LAUNCH_BONUS_MONTHS`. Typ-Werte aus dem Katalog (die Anzeige
 * mit Forschung und Erstkunden-Bonus kommt aus dem Modell, 4.2e / 4.6).
 */
export function deliveredAircraft(
  delivered: readonly AircraftState[],
  ctx: { readonly hub: string; readonly existingRegistrations: readonly string[]; readonly catalog?: readonly Aircraft[] },
): Deliveries {
  const taken = [...ctx.existingRegistrations];
  const planes: OwnedAircraft[] = [];
  const renamed: Record<string, string> = {};
  for (const s of delivered) {
    const type = typeById(s.typeId, ctx.catalog ?? aircraftList);
    const { config, baseInteriorPop } = defaultCabin(type);
    const [made] = createOwnedAircraft(type, 1, { config, baseInteriorPop, hub: ctx.hub, existingRegistrations: taken, purchasedAt: s.builtMonth });
    taken.push(made.registration);
    renamed[s.id] = made.registration;
    planes.push({
      ...made,
      conditionGeneral: s.airframeCondition,
      conditionInterior: s.cabinCondition,
      cabinInstalledAt: s.cabinInstalledMonth,
      ...(s.launchCustomer ? { launchBonusUntil: s.builtMonth + LAUNCH_BONUS_MONTHS } : {}),
    });
  }
  return { planes, renamed };
}

// ===========================================================================
// Berichte (8.2)
// ===========================================================================

/** Spielmonat eines gespeicherten Berichts (Monat 1 … 12, Jahr). */
export const reportMonth = (r: Pick<MonthlyReport, 'year' | 'month'>): number => (r.year - 1960) * 12 + (r.month - 1);

const NO_COSTS: MonthlyCosts = {
  fuel: 0, crew: 0, landingFees: 0, passengerFees: 0, catering: 0, airportUpkeep: 0, aircraftUpkeep: 0, depreciation: 0,
  aircraftTrades: 0, marketing: 0, charter: 0, crisisResponses: 0, interest: 0, damages: 0, airportIncome: 0, subsidy: 0, total: 0,
};

/**
 * Ein gespeicherter Bericht als `MonthReport`, so weit das Modell ihn liest (Jahresziel 6.11: Monat, Ergebnis, Erlös,
 * Fluggäste). Erlös = `routeRevenues`, Ergebnis = `totalProfit`, Fluggäste = `paxTotal`; Kosten = Erlös − Ergebnis in
 * einer Summe; alles andere leer. Die Anzeige liest weiter den gespeicherten Bericht.
 */
export function historyReport(r: MonthlyReport, companyId: string): MonthReport {
  return plainReport(reportMonth(r), companyId, {
    revenue: Number.isFinite(r.routeRevenues) ? r.routeRevenues : 0,
    result: Number.isFinite(r.totalProfit) ? r.totalProfit : 0,
    cash: Number.isFinite(r.capitalAfter) ? (r.capitalAfter as number) : 0,
    passengers: Number.isFinite(r.paxTotal) ? (r.paxTotal as number) : 0,
    transferPassengers: Number.isFinite(r.transferPax) ? (r.transferPax as number) : 0,
    reputation: r.reputation ?? 0,
  });
}

/** Was ein Bericht aus der Zeit vor dem Modell weiß (`plainReport`). */
export interface PlainReportValues {
  readonly revenue: number;
  readonly result: number;
  readonly cash: number;
  readonly passengers: number;
  readonly transferPassengers: number;
  readonly reputation: number;
}

/**
 * Ein Bericht nur mit Monat, Erlös, Ergebnis, Kasse, Fluggästen und Ruf; Kosten = Erlös − Ergebnis in einer Summe,
 * alles andere leer. Für Berichte aus der Zeit vor dem Modell (Spieler: `historyReport`; KI: `rivalRecord`, 4.2d).
 */
export function plainReport(month: number, companyId: string, v: PlainReportValues): MonthReport {
  const { revenue, result, cash } = v;
  return {
    month,
    companyId,
    revenue,
    costs: { ...NO_COSTS, total: revenue - result },
    result,
    fleetValueResult: { depreciation: 0, trades: 0, total: 0 },
    otherSpending: {},
    decisionsCash: 0,
    decisionsValueChange: 0,
    milestonePrizes: 0,
    goalCash: 0,
    deliveries: [],
    forcedSales: [],
    birdStrikes: [],
    cashStart: cash,
    cashEnd: cash,
    fleetValueStart: 0,
    fleetValueEnd: 0,
    depositsStart: 0,
    depositsEnd: 0,
    creditLimit: 0,
    creditState: cash >= 0 ? 'healthy' : 'credit',
    passengers: v.passengers,
    transferPassengers: v.transferPassengers,
    cancelledShare: 0,
    airlineSatisfaction: 0,
    reputation: { reputation: v.reputation, target: v.reputation, causes: [] },
    routes: [],
  };
}

/** Die gespeicherten Berichte vor dem Monat `month` als `MonthReport`, ältester zuerst. */
export function historyReports(reports: readonly MonthlyReport[], companyId: string, month: number): MonthReport[] {
  return reports
    .filter((r) => r && reportMonth(r) < month)
    .map((r) => historyReport(r, companyId))
    .sort((a, b) => a.month - b.month);
}

/** Was der Bericht der Oberfläche über die Gesellschaft nach dem Abschluss braucht. */
export interface AppReportContext {
  /** Strecken vor dem Abschluss (Namen der Zeilen). */
  readonly routes: readonly Pick<SimulatedRoute, 'id' | 'origin' | 'destination' | 'aircraft'>[];
  readonly airports: Readonly<Record<string, ModelAirport>>;
  /** Moral, Flotte und Strecken am Monatsende. */
  readonly morale: number;
  readonly fleetSize: number;
  readonly routeCount: number;
  /** Alle Einmalausgaben des Monats, wie der Spieler sie bezahlt hat (`monthlyCapex`; Flugzeuge eingeschlossen). */
  readonly capex: readonly CapexItem[];
}

/**
 * Bericht des Modells als Bericht der Oberfläche (`MonthlyReport`); die Anzeige baut `reportView`
 * (`src/lib/modelReport.ts`). Monatswerte; Strecken-Zahlen (je Woche) × `WEEKS_PER_MONTH`. `routeCosts` = alle Kosten
 * außer „Airport upkeep“, `capexItems` = alle Einmalausgaben des Monats (`ctx.capex`), `cashChange` = Kasse Ende −
 * Anfang, `cash` = Kasse am Anfang, Prämien, Jahresziel, Flottenwert, Kreditlinie, gestrichene Flüge, Zwangsverkäufe
 * (8.2, 8.14). `breakdown` mit den Posten aus 5.16.
 */
export function appReport(report: MonthReport, ctx: AppReportContext): MonthlyReport {
  const W = WEEKS_PER_MONTH;
  const c = report.costs;
  const routeName = (id: string) => {
    const r = ctx.routes.find((x) => x.id === id);
    return r ? `${r.origin}-${r.destination} (${r.aircraft})` : id;
  };
  const capexItems: ReportLine[] = ctx.capex.filter((i) => i.amount !== 0).map(({ label, amount }) => ({ label, amount }));
  const classSum = (f: Readonly<Record<string, number>>) => sum(Object.values(f));
  const regions = new Set<RegionId>();
  for (const r of ctx.routes) {
    for (const id of [r.origin, r.destination]) {
      const a = ctx.airports[id];
      if (a) regions.add(a.region);
    }
  }
  return {
    month: (report.month % 12) + 1,
    year: yearOf(report.month),
    routeRevenues: report.revenue,
    routeCosts: c.total - c.airportUpkeep,
    airportUpkeep: c.airportUpkeep,
    totalProfit: report.result,
    capex: sum(capexItems.map((i) => i.amount)),
    capexItems,
    cashChange: report.cashEnd - report.cashStart,
    capitalAfter: report.cashEnd,
    routes: report.routes.map((r) => ({
      id: r.routeId,
      name: routeName(r.routeId),
      revenue: r.revenue * W,
      cost: (r.revenue - r.result) * W,
      profit: r.result * W,
      paxPerWeek: classSum(r.passengers),
      capacity: classSum(r.offeredSeats),
      transferPax: classSum(r.transferPassengers),
    })),
    breakdown: {
      fuel: c.fuel,
      catering: c.catering,
      staff: c.crew,
      landingFees: c.landingFees,
      paxFees: c.passengerFees,
      airportUpkeep: c.airportUpkeep,
      marketing: c.marketing,
      charters: c.charter,
      incidents: c.charter,
      fleetOwnership: c.aircraftUpkeep,
      depreciation: c.depreciation,
      aircraftTrades: c.aircraftTrades,
      crisisResponses: c.crisisResponses,
      interest: c.interest,
      damages: c.damages,
      hubIncome: c.airportIncome,
      subsidy: c.subsidy,
    },
    reputation: report.reputation.reputation,
    morale: ctx.morale,
    paxTotal: report.passengers,
    transferPax: report.transferPassengers,
    fleetSize: ctx.fleetSize,
    routeCount: ctx.routeCount,
    regions: [...regions].sort(),
    cash: {
      start: report.cashStart,
      milestonePrizes: report.milestonePrizes,
      goal: report.goalCash,
      fleetValue: report.fleetValueEnd,
      creditLimit: report.creditLimit,
      creditState: report.creditState,
      cancelledShare: report.cancelledShare,
      forcedSales: [...report.forcedSales],
    },
  };
}

// ===========================================================================
// Fortschritt (6.7–6.11, 8.15)
// ===========================================================================

/**
 * Szenario der Oberfläche als `ScenarioState` des Modells (8.15). Ziele aus `src/data/scenarios.ts`; Dollar-Ziele
 * gelten als $ des Startmonats und werden in $ von 1960 umgerechnet (`SCENARIO_DOLLAR_METRICS`, E6). Verlust: so viele
 * Monatsenden in Folge unter −Kreditgrenze, wie die erste Untergrenze des Szenarios Monate hat (Lesart von E34;
 * ohne Untergrenze nie). Erreichte Ziele und Serie wie gespeichert (neue Felder, fehlt = keine).
 */
export function modelScenario(s: AppScenario): ModelScenario {
  const def = scenarioById(s.id);
  if (!def) throw new Error(`Unbekanntes Szenario ${s.id}`);
  const per1960 = atCost(1, def.startOffset);
  return {
    win: def.win.map((g) => ({
      id: g.id,
      metric: g.metric,
      target: SCENARIO_DOLLAR_METRICS.includes(g.metric) ? g.target / per1960 : g.target,
      ...(g.atDeadline ? { atDeadline: true } : {}),
      ...(g.minWeeklyFlights !== undefined ? { minWeeklyFlights: g.minWeeklyFlights } : {}),
    })),
    floorMonths: def.lose[0]?.months ?? Number.POSITIVE_INFINITY,
    deadline: def.deadlineOffset,
    floorStreak: s.floorStreak ?? 0,
    met: [...(s.met ?? [])].sort(),
    status: s.status,
  };
}

/**
 * Szenario zurück. Neu entschieden (Status anders): Ergebnis mit dem Monat `month` (Monat des Abschlusses) und einem
 * Grund. Erreichte Ziele und Serie werden gespeichert. Unverändert: `before`.
 */
export function applyScenario(before: AppScenario, s: ModelScenario, month: number): AppScenario {
  const met = [...s.met];
  const sameMet = (before.met ?? []).length === met.length && met.every((id) => before.met?.includes(id));
  if (before.status === s.status && (before.floorStreak ?? 0) === s.floorStreak && sameMet) return before;
  const out: AppScenario = { ...before, status: s.status, floorStreak: s.floorStreak, met };
  if (before.status === s.status) return out;
  const reason =
    s.status === 'won'
      ? 'Every goal met.'
      : s.floorStreak >= s.floorMonths
        ? `Cash below the credit line at ${s.floorStreak} month-end${s.floorStreak === 1 ? '' : 's'} in a row.`
        : 'The deadline passed with goals still open.';
  return { ...out, result: { offset: month, reason } };
}

/** Was der Fortschritt des Spielers aus dem Spielstand der Oberfläche braucht. */
export interface PlayerProgressSource {
  readonly career: Career;
  readonly milestones: readonly string[];
  readonly annualGoal: ModelGoal | null;
  readonly scenario: AppScenario | null;
  /** Erster Spielmonat (`startDateOffset`). */
  readonly startMonth: number;
  readonly reports: readonly MonthlyReport[];
}

/**
 * Rang-Werte der letzten `RANK_AVERAGE_MONTHS` Berichte vor `month` (6.7): Strecken, Fluggäste des Monats, Ruf,
 * Regionen und volle Jahre seit Spielstart, wie die Berichte sie gespeichert haben; fehlt ein Wert, 0.
 */
export function rankHistory(reports: readonly MonthlyReport[], startMonth: number, month: number): RankStats[] {
  return reports
    .filter((r) => r && reportMonth(r) < month)
    .sort((a, b) => reportMonth(a) - reportMonth(b))
    .slice(-RANK_AVERAGE_MONTHS)
    .map((r) => ({
      routes: r.routeCount ?? 0,
      monthlyPax: r.paxTotal ?? 0,
      reputation: r.reputation ?? 0,
      regions: r.regions?.length ?? 0,
      years: yearsPlayed(reportMonth(r) - startMonth),
    }));
}

/** Fortschritt des Spielers im Monat `month`. */
export function companyProgress(src: PlayerProgressSource, month: number): CompanyProgress {
  const offers = src.career.goalOffer?.options;
  return {
    startMonth: src.startMonth,
    rank: src.career.rank,
    rankHistory: rankHistory(src.reports, src.startMonth, month),
    research: src.career.research,
    milestones: src.milestones,
    careerPax: src.career.careerPax,
    takeovers: src.career.takeovers,
    ...(src.annualGoal ? { goal: src.annualGoal } : {}),
    ...(offers && offers.length > 0 ? { goalOffers: offers } : {}),
    ...(src.scenario ? { scenario: modelScenario(src.scenario) } : {}),
  };
}

/** Was der Abschluss am Fortschritt ändert. */
export interface AppliedProgress {
  readonly career: Career;
  readonly milestones: readonly string[];
  readonly annualGoal: ModelGoal | null;
  readonly scenario: AppScenario | null;
}

const sameStrings = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

const sameGoal = (a: ModelGoal, b: ModelGoal): boolean =>
  a.year === b.year && a.kind === b.kind && a.tag === b.tag && a.target === b.target && a.reward === b.reward && a.penalty === b.penalty;

/**
 * Schreibt den Fortschritt zurück (`month` = Monat des Abschlusses X): Rang, Fluggäste, Übernahmen, Forschung,
 * Meilensteine (Kennungen des Modells, 6.10), Jahresziel und neues Angebot (Dezember: Angebot für das neue Jahr, das
 * sichere Ziel gilt, bis der Spieler wählt), Szenario. Unverändertes bleibt dasselbe Objekt.
 */
export function applyCompanyProgress(src: PlayerProgressSource, p: CompanyProgress, month: number): AppliedProgress {
  const read = companyProgress(src, month);
  let career = src.career;
  if (career.rank !== p.rank || career.careerPax !== p.careerPax || career.takeovers !== p.takeovers) {
    career = { ...career, rank: p.rank, careerPax: p.careerPax, takeovers: p.takeovers };
  }
  const researchSame =
    sameStrings(read.research.done, p.research.done) &&
    read.research.active.length === p.research.active.length &&
    read.research.active.every((a, i) => a.id === p.research.active[i].id && a.startMonth === p.research.active[i].startMonth);
  if (!researchSame) {
    career = { ...career, research: { done: [...p.research.done], active: p.research.active.map((a) => ({ ...a })) } };
  }
  const offers = p.goalOffers ?? [];
  const oldOffers = read.goalOffers ?? [];
  const offersSame = offers.length === oldOffers.length && offers.every((g, i) => sameGoal(oldOffers[i], g));
  if (!offersSame) {
    career = { ...career, goalOffer: offers.length > 0 ? { year: offers[0].year, options: offers.map((g) => ({ ...g })) } : null };
  }
  const milestones = sameStrings(read.milestones, p.milestones) ? src.milestones : [...p.milestones];
  const annualGoal = p.goal ? (src.annualGoal && sameGoal(src.annualGoal, p.goal) ? src.annualGoal : { ...p.goal }) : null;
  const scenario = src.scenario && p.scenario ? applyScenario(src.scenario, p.scenario, month) : src.scenario;
  return { career, milestones, annualGoal, scenario };
}
