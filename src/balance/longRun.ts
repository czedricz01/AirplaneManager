/**
 * Balance-Skript (Paket 3.9b): Langläufe der KI ohne Spieler mit `closeMonth`.
 *
 * Ein Lauf: Start im Januar `startYear`, je Persönlichkeit eine Gründer-KI an einem festen Drehkreuz, KI-Stärke nach
 * Einstellung, Nachrücken bis zur gewählten Zahl (`rivalRefill`, 7.7), alle Flughäfen der Daten und der ganze
 * Typen-Katalog. Jeder Monat ist ein ganzer Abschluss (`closeMonth(state, rivalDecisions, rivalRefill(...))`), wie im
 * Spiel. Das Skript ändert keine Konstante: „ohne Zuschuss“ setzt nur `inputs.subsidized = false` je Gesellschaft.
 *
 * Gemessen wird, was die Prüfregeln aus Abschnitt 7 und 3.13 brauchen (Liste in `docs/neubau/BALANCE.md`).
 */

import { aircraftList } from '../data/aircraft';
import { airports as registryAirports } from '../data/airportRegistry';
import { regionOf } from '../lib/geoUtils';
import { costIndex } from '../model/basics';
import { START_YEAR, CABIN_CLASSES, type RivalPersonality, type RivalStrength, type WorldRegion } from '../model/constants';
import {
  closeMonth,
  fleetValue,
  newLedger,
  pairPassengers,
  type AfterClose,
  type CompanyState,
  type ModelAirport,
  type ModelState,
  type MonthReport,
} from '../model/monthClose';
import { companyValue } from '../model/progress';
import { RIVAL_INPUTS, pickStartAircraft, rivalAircraft, rivalStartCash, rivalStartSetup, startFleetKinds } from '../model/rivals';
import { companyValueOf, newRivalAgent, rivalAgentOf, rivalDecisions, rivalRefill, rivalSize, rivalSlotCap } from '../model/rivalMonth';
import { slotLimit } from '../model/airportCosts';
import { rng } from '../model/rng';
import { quantile } from './market';

/** Die fünf Persönlichkeiten in fester Reihenfolge (7.4). */
export const PERSONALITY_ORDER: readonly RivalPersonality[] = ['flag', 'lcc', 'expansionist', 'optimizer', 'boutique'];

/**
 * Drehkreuze der Gründer: zehn große Flughäfen in fünf Regionen. Lauf `i` gibt der Persönlichkeit `k` das Drehkreuz
 * `HUBS[(i + 2k) mod 10]`; über 10 Läufe hat so jede Persönlichkeit jedes Drehkreuz genau einmal (fairer Vergleich).
 */
export const FOUNDER_HUBS: readonly string[] = ['JFK', 'LHR', 'FRA', 'ORD', 'CDG', 'LAX', 'HND', 'SIN', 'ATL', 'SYD'];

/** Drehkreuz der Persönlichkeit `k` in Lauf `run`. */
export function founderHub(run: number, k: number): string {
  return FOUNDER_HUBS[(run + 2 * k) % FOUNDER_HUBS.length];
}

/** Einstellungen eines Langlaufs. */
export interface LongRunSettings {
  /** Nummer des Laufs (Drehkreuze, Zufall). */
  readonly run: number;
  readonly startYear: number;
  readonly years: number;
  readonly strength: RivalStrength;
  /** Zuschuss für alle KI (7.14); `false` = Lauf ohne Zuschuss. */
  readonly subsidy: boolean;
  /** Gewählte Zahl der KI (Nachrücken, 7.7); Standard 5 = je Persönlichkeit ein Gründer. */
  readonly wanted?: number;
  /** Umsteiger je Paar alle so viele Jahre messen (teuer: eine zusätzliche volle Rechnung); Standard 5. */
  readonly transferEveryYears?: number;
}

/** Alle Flughäfen der Daten als `ModelAirport` (Region über `regionOf`, R15). */
export function allModelAirports(): Record<string, ModelAirport> {
  const out: Record<string, ModelAirport> = {};
  for (const a of registryAirports) {
    out[a.id] = { id: a.id, coords: a.coords, stats: a.stats, size: a.level, region: regionOf(a.coords) as WorldRegion, maxIcaoCode: a.maxIcaoCode };
  }
  return out;
}

/**
 * Eine Gründer-KI wie `foundRivalCompany` (7.7), aber mit fester Persönlichkeit und festem Drehkreuz: Startflotte neu
 * nach Stärke und Persönlichkeit, Startkasse nach Stärke, Stufe 2 und ein Schalter am Drehkreuz, Ruf 50.
 */
export function founderCompany(personality: RivalPersonality, hub: string, strength: RivalStrength, month: number, seed: number, subsidy: boolean): CompanyState {
  const id = `f-${personality}`;
  const u = (purpose: string, k: string | number) => rng(seed, month, purpose, `${id}|${k}`);
  const aircraft = startFleetKinds(strength).flatMap((kind, i) => {
    const index = pickStartAircraft(personality, kind, aircraftList, month, (t) => u('startType', `${i}|${t}`));
    return index >= 0 ? [rivalAircraft(personality, aircraftList[index], month, `${id}-a${i + 1}`)] : [];
  });
  const cash = rivalStartCash(strength, month, 2 * u('cash', 0) - 1);
  const setup = rivalStartSetup();
  return {
    id,
    cash,
    reputation: setup.reputation,
    inputs: { ...RIVAL_INPUTS, campaigns: [], subsidized: subsidy },
    aircraft,
    routes: [],
    airports: { [hub]: { managementTier: setup.managementTier, slots: {}, stands: {}, desks: { ...setup.desks }, facilities: [] } },
    preorders: [],
    overdrawnMonths: 0,
    profitStreak: 0,
    ledger: newLedger(cash, fleetValue(aircraft, month), 0),
    reports: [],
    hubs: [hub],
    agent: newRivalAgent(personality, strength),
  };
}

/** Der Start-Spielstand eines Laufs. */
export function longRunStart(s: LongRunSettings, airports: Record<string, ModelAirport> = allModelAirports()): ModelState {
  const month = (s.startYear - START_YEAR) * 12;
  const seed = 1000 + s.run;
  return {
    month,
    seed,
    airports,
    randomEvents: [],
    disruptions: [],
    badLuck: false,
    resold: [],
    catalog: aircraftList,
    companies: PERSONALITY_ORDER.map((p, k) => founderCompany(p, founderHub(s.run, k), s.strength, month, seed, s.subsidy)),
  };
}

/** Nachrücken; ohne Zuschuss bekommt auch die neue KI keinen. */
function refillFor(s: LongRunSettings): AfterClose {
  const refill = rivalRefill({ wanted: s.wanted ?? PERSONALITY_ORDER.length, strength: s.strength });
  if (s.subsidy) return refill;
  return (state) => {
    const out = refill(state);
    const companies = out.state.companies.map((c) => (c.inputs.subsidized ? { ...c, inputs: { ...c.inputs, subsidized: false } } : c));
    return { ...out, state: { ...out.state, companies } };
  };
}

// ---------------------------------------------------------------------------
// Messwerte
// ---------------------------------------------------------------------------

/** Verteilung einer Größe: Anzahl, Median, 10. und 90. Perzentil, Mittel. */
export interface Spread {
  readonly n: number;
  readonly p10: number;
  readonly median: number;
  readonly p90: number;
  readonly mean: number;
}

/** `Spread` einer Liste. */
export function spreadOf(values: readonly number[]): Spread {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const mean = sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : Number.NaN;
  return { n: sorted.length, p10: quantile(sorted, 0.1), median: quantile(sorted, 0.5), p90: quantile(sorted, 0.9), mean };
}

/** Stand einer Gesellschaft im Januar eines Jahres (nach dem Abschluss des Dezembers). */
export interface CompanyYear {
  readonly id: string;
  readonly personality: RivalPersonality;
  readonly founder: boolean;
  readonly status: string;
  /** Unternehmenswert (6.12) in Preisen von 1960 (÷ `costIndex`). */
  readonly value1960: number;
  readonly cash1960: number;
  readonly routes: number;
  readonly planes: number;
  /** `rivalSize`: Sitze je Woche (7.13). */
  readonly seats: number;
  readonly hubs: number;
  /** Summen über die 12 Monate des Vorjahres. */
  readonly result1960: number;
  readonly revenue1960: number;
  readonly subsidy1960: number;
  readonly passengers: number;
}

/** Werte eines Jahres über alle KI (Monate Januar … Dezember). */
export interface YearStats {
  readonly year: number;
  readonly companies: readonly CompanyYear[];
  /** Preisniveau Economy je Strecke und Monat (alle KI). */
  readonly fareEconomy: Spread;
  /** Preisniveau Economy je Persönlichkeit (Median). */
  readonly fareByPersonality: Readonly<Partial<Record<RivalPersonality, number>>>;
  /** Monatliche Änderung |Δ Preisniveau Economy| der Optimizer-Strecken (Strecke in beiden Monaten). */
  readonly optimizerStep: Spread;
  /** Anteil der Optimizer-Schritte ≥ `BIG_STEP`. */
  readonly optimizerBigSteps: number;
  /** Dasselbe für alle anderen Persönlichkeiten (Vergleich). */
  readonly otherStep: Spread;
  readonly otherBigSteps: number;
  /** Anteil der Strecken-Monate im Preiskampf. */
  readonly priceWarShare: number;
  /** Auslastung je Strecke und Monat (Direkt- und Umsteiger ÷ angebotene Sitze). */
  readonly loadFactor: Spread;
  /** Marge je Strecke und Monat (`result ÷ revenue`, nur Strecken mit Erlös). */
  readonly margin: Spread;
  /** Anteil der Strecken-Monate mit Verlust. */
  readonly losingShare: number;
  /** Anzahl Gesellschaften je bedientem Paar (Januar). */
  readonly offersPerPair: Spread;
  /** Anteil der bedienten Paare mit ≥ 2 Gesellschaften (Januar). */
  readonly sharedPairs: number;
  /** Ereignisse im Jahr (Meldungen des Abschlusses). */
  readonly news: Readonly<Record<string, number>>;
  /** Dividenden im Jahr in Preisen von 1960. */
  readonly dividends1960: number;
  /** Slots im Januar: Gesellschaft-Flughafen-Paare mit Slots, davon an der eigenen Grenze (7.10). */
  readonly slotHoldings: number;
  readonly slotHoldingsAtCap: number;
  /** Größter Anteil aller KI zusammen an der Slot-Grenze eines Flughafens (5.10). */
  readonly maxAirportSlotShare: number;
  /** Umsteiger je Paar mit Direktangebot (nur in Mess-Jahren, sonst `undefined`). */
  readonly transfers?: TransferStats;
  /** Rechenzeit des Jahres in ms. */
  readonly ms: number;
}

/** Umsteiger-Anteil in Märkten mit Direktangebot (3.13). */
export interface TransferStats {
  /** Paare mit Direktangebot und Umsteige-Verbindung. */
  readonly pairs: number;
  /** Anteil der Umsteiger (platziert) je Paar: Umsteiger ÷ (Direkt + Umsteiger). */
  readonly placedShare: Spread;
  /** Anteil vor der Sitz-Verteilung (Wunsch aus der Marktaufteilung). */
  readonly wishShare: Spread;
  /** Anteil der Paare mit platziertem Anteil über 25 %. */
  readonly over25: number;
  /** Summe über alle Paare: Umsteiger ÷ (Direkt + Umsteiger). */
  readonly overall: number;
  /** Umsteiger in Paaren ohne Direktangebot je Woche (zum Vergleich). */
  readonly withoutDirect: number;
}

/** Ein großer Preisschritt in einem Monat (Grenze für „störende Sprünge“, E65). */
export const BIG_STEP = 0.25;

/** Ergebnis eines Laufs. */
export interface LongRunResult {
  readonly settings: LongRunSettings;
  readonly years: readonly YearStats[];
  /** Jahr der Auflösung je Gründer (fehlt = nicht aufgelöst). */
  readonly founderLiquidated: Readonly<Partial<Record<RivalPersonality, number>>>;
  readonly ms: number;
}

const sumOf = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

function companyYear(c: CompanyState, month: number, reports: readonly MonthReport[]): CompanyYear {
  const agent = rivalAgentOf(c);
  const ci = costIndex(month);
  const liquidated = agent?.distress.status === 'liquidated';
  const plane = new Map(c.aircraft.map((p) => [p.id, p]));
  const seats = rivalSize(
    c.routes.map((r) => ({
      seats: CABIN_CLASSES.reduce((s, k) => s + (plane.get(r.aircraftId)?.seats[k] ?? 0), 0),
      weeklyFrequency: r.departuresPerWeek / 2,
    })),
  );
  return {
    id: c.id,
    personality: agent?.personality ?? 'flag',
    founder: c.id.startsWith('f-'),
    status: agent?.distress.status ?? 'healthy',
    value1960: liquidated ? 0 : companyValue(companyValueOf(c, month)) / ci,
    cash1960: c.cash / ci,
    routes: c.routes.length,
    planes: c.aircraft.length,
    seats,
    hubs: (c.hubs ?? []).length,
    result1960: sumOf(reports.map((r) => r.result / costIndex(r.month))),
    revenue1960: sumOf(reports.map((r) => r.revenue / costIndex(r.month))),
    subsidy1960: sumOf(reports.map((r) => r.costs.subsidy / costIndex(r.month))),
    passengers: sumOf(reports.map((r) => r.passengers)),
  };
}

function transferStats(state: ModelState): TransferStats {
  const pairs = pairPassengers(state);
  const placed: number[] = [];
  const wish: number[] = [];
  let direct = 0;
  let transfers = 0;
  let withoutDirect = 0;
  for (const p of pairs) {
    if (p.direct > 0) {
      direct += p.direct;
      transfers += p.transferPlaced;
      if (p.transferWish > 0) {
        placed.push(p.transferPlaced / (p.direct + p.transferPlaced));
        wish.push(p.transferWish / (p.direct + p.transferWish));
      }
    } else {
      withoutDirect += p.transferPlaced;
    }
  }
  return {
    pairs: placed.length,
    placedShare: spreadOf(placed),
    wishShare: spreadOf(wish),
    over25: placed.length > 0 ? placed.filter((s) => s > 0.25).length / placed.length : 0,
    overall: direct + transfers > 0 ? transfers / (direct + transfers) : 0,
    withoutDirect,
  };
}

/** Slots im Spielstand: Haltungen an der eigenen Grenze, größter Anteil aller an einem Flughafen. */
function slotStats(state: ModelState): { holdings: number; atCap: number; maxShare: number } {
  let holdings = 0;
  let atCap = 0;
  const byAirport = new Map<string, number>();
  for (const c of state.companies) {
    if (rivalAgentOf(c)?.distress.status === 'liquidated') continue;
    for (const [id, h] of Object.entries(c.airports)) {
      const owned = sumOf(Object.values(h.slots).map((n) => n ?? 0));
      if (owned <= 0) continue;
      holdings++;
      const size = state.airports[id]?.size ?? 1;
      if (owned >= rivalSlotCap(size, (c.hubs ?? []).includes(id))) atCap++;
      byAirport.set(id, (byAirport.get(id) ?? 0) + owned);
    }
  }
  let maxShare = 0;
  for (const [id, owned] of byAirport) maxShare = Math.max(maxShare, owned / slotLimit(state.airports[id]?.size ?? 1));
  return { holdings, atCap, maxShare };
}

/**
 * Ein Langlauf. `onYear` meldet jedes fertige Jahr (Fortschritt). Rein bis auf die Uhr (Rechenzeit).
 */
export function runLong(s: LongRunSettings, onYear?: (y: YearStats) => void, airports?: Record<string, ModelAirport>): LongRunResult {
  const started = Date.now();
  let state = longRunStart(s, airports);
  const after = refillFor(s);
  const transferEvery = s.transferEveryYears ?? 5;
  const years: YearStats[] = [];
  const founderLiquidated: Partial<Record<RivalPersonality, number>> = {};
  let previousFare = new Map<string, number>();

  for (let y = 0; y < s.years; y++) {
    const yearStarted = Date.now();
    const year = s.startYear + y;
    const fares: number[] = [];
    const fareByP = new Map<RivalPersonality, number[]>();
    const optSteps: number[] = [];
    const otherSteps: number[] = [];
    let routeMonths = 0;
    let warMonths = 0;
    const loads: number[] = [];
    const margins: number[] = [];
    let losing = 0;
    const news: Record<string, number> = {};
    let dividends = 0;
    const reports = new Map<string, MonthReport[]>();

    for (let m = 0; m < 12; m++) {
      const month = state.month;
      // Preise des Monats (gelten in diesem Monat) und Preiskampf.
      const fareNow = new Map<string, number>();
      for (const c of state.companies) {
        const agent = rivalAgentOf(c);
        if (!agent || agent.distress.status === 'liquidated') continue;
        for (const r of c.routes) {
          const ratio = r.fareRatios?.economy;
          if (ratio === undefined) continue;
          const key = `${c.id}|${r.id}`;
          fareNow.set(key, ratio);
          fares.push(ratio);
          const list = fareByP.get(agent.personality) ?? [];
          list.push(ratio);
          fareByP.set(agent.personality, list);
          const before = previousFare.get(key);
          if (before !== undefined) (agent.personality === 'optimizer' ? optSteps : otherSteps).push(Math.abs(ratio - before));
          routeMonths++;
          if (agent.routes[r.id]?.priceWar?.startedMonth !== undefined) warMonths++;
        }
      }
      previousFare = fareNow;

      const close = closeMonth(state, rivalDecisions, after);
      for (const n of close.news) {
        news[n.kind] = (news[n.kind] ?? 0) + 1;
        if (n.kind === 'dividend') dividends += (n.amount ?? 0) / costIndex(month);
        if (n.kind === 'liquidated' && n.companyId.startsWith('f-')) {
          const p = n.companyId.slice(2) as RivalPersonality;
          if (founderLiquidated[p] === undefined) founderLiquidated[p] = year + m / 12;
        }
      }
      for (const [id, report] of Object.entries(close.reports)) {
        const list = reports.get(id) ?? [];
        list.push(report);
        reports.set(id, list);
        for (const r of report.routes) {
          const seats = sumOf(CABIN_CLASSES.map((k) => r.offeredSeats[k]));
          const pax = sumOf(CABIN_CLASSES.map((k) => r.passengers[k] + r.transferPassengers[k]));
          if (seats > 0) loads.push(pax / seats);
          if (r.revenue > 0) margins.push(r.result / r.revenue);
          if (r.result < 0) losing++;
        }
      }
      state = close.state;
    }

    // Januar des Folgejahres: Stand.
    const companies = state.companies
      .filter((c) => rivalAgentOf(c) !== undefined)
      .map((c) => companyYear(c, state.month, reports.get(c.id) ?? []));
    const pairCompanies = new Map<string, Set<string>>();
    for (const c of state.companies) {
      if (rivalAgentOf(c)?.distress.status === 'liquidated') continue;
      for (const r of c.routes) {
        const pair = r.from < r.to ? `${r.from}|${r.to}` : `${r.to}|${r.from}`;
        const set = pairCompanies.get(pair) ?? new Set<string>();
        set.add(c.id);
        pairCompanies.set(pair, set);
      }
    }
    const offerCounts = [...pairCompanies.values()].map((set) => set.size);
    const slots = slotStats(state);
    const fareByPersonality: Partial<Record<RivalPersonality, number>> = {};
    for (const [p, list] of fareByP) fareByPersonality[p] = spreadOf(list).median;
    const measureTransfers = (y + 1) % transferEvery === 0;
    const routeMonthSteps = (steps: number[]) => (steps.length > 0 ? steps.filter((d) => d >= BIG_STEP).length / steps.length : 0);
    const stats: YearStats = {
      year,
      companies,
      fareEconomy: spreadOf(fares),
      fareByPersonality,
      optimizerStep: spreadOf(optSteps),
      optimizerBigSteps: routeMonthSteps(optSteps),
      otherStep: spreadOf(otherSteps),
      otherBigSteps: routeMonthSteps(otherSteps),
      priceWarShare: routeMonths > 0 ? warMonths / routeMonths : 0,
      loadFactor: spreadOf(loads),
      margin: spreadOf(margins),
      losingShare: loads.length > 0 ? losing / loads.length : 0,
      offersPerPair: spreadOf(offerCounts),
      sharedPairs: offerCounts.length > 0 ? offerCounts.filter((n) => n >= 2).length / offerCounts.length : 0,
      news,
      dividends1960: dividends,
      slotHoldings: slots.holdings,
      slotHoldingsAtCap: slots.atCap,
      maxAirportSlotShare: slots.maxShare,
      transfers: measureTransfers ? transferStats(state) : undefined,
      ms: Date.now() - yearStarted,
    };
    years.push(stats);
    onYear?.(stats);
  }
  return { settings: s, years, founderLiquidated, ms: Date.now() - started };
}
