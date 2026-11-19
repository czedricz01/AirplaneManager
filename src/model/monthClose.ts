/**
 * Der Monatsabschluss `closeMonth` (SPEZIFIKATION 8.0, 8.1, 8.2, 8.15, 8.16): eine reine Funktion, Spielstand des
 * Modells rein, Spielstand für X+1 und Bericht X raus. Aller Zufall kommt aus `rng` mit dem Startwert des
 * Spielstands (8.3, R12).
 *
 * Diese Datei setzt die Schritte zusammen. Die Buchung (Schritt 2, für alle gleich) steht in `monthBooking.ts`,
 * das nie nach der KI fragt. Hier stehen zusätzlich die Entscheidungen der KI (Schritt 4, 7.8) und die Schritte nur
 * des Spielers (5, 6); deshalb zählt diese Datei zu den Entscheidungs-Dateien (F41).
 *
 * Stand 3.8b: KI-Schritte `prices`, `crisis`, `losers`, `fineTune`, `fleet` (Überholung, Leerlauf- und Notverkauf),
 * `dividend`, `distress`. Offen für 3.8c: neue Strecken (`openings`), Flugzeugkäufe und Modernisierung (`fleet`),
 * neue Drehkreuze (`growth`), Nachrücken (7.7), Umsteiger (3.13) in der Buchung.
 */

import { atCost, yearOf } from './basics';
import {
  CABIN_CLASSES,
  RANK_AVERAGE_MONTHS,
  REPORT_HISTORY_MONTHS,
  SCENARIO_DOLLAR_METRICS,
  USED_RESOLD_MONTHS,
  WEEKS_PER_MONTH,
  type CabinClass,
  type CampaignLevel,
  type RivalPersonality,
  type RivalStrength,
  type ScenarioMetric,
  type SizeClass,
  type WorldRegion,
} from './constants';
import { breakEvenFareLevel, bestFareRatio, marketFares, type PartialClassFigures } from './fare';
import { aircraftValue, newAircraftPrice } from './fleet';
import {
  creditLimit,
  creditState,
  forcedSale,
  isBankrupt,
  nextOverdrawnMonths,
  overhaulQuote,
  preorderBalance,
  preorderDelivery,
  saleProceeds,
} from './fleetMarket';
import {
  bookMonth,
  finishMonth,
  splitMarket,
  type BookingCompany,
  type BookingMarket,
  type BookingPlane,
  type BookingRoute,
  type CompanyBooking,
  type CompanyWorld,
  type MonthReport,
  type MonthTransaction,
} from './monthBooking';
import {
  activeWorldEvents,
  moraleTarget,
  nextMorale,
  rollTransition,
  strikeCancelShare,
  type Disruption,
  type StaffStrike,
  type WorldEvent,
} from './monthEvents';
import {
  advanceResearch,
  goalValue,
  isDecember,
  milestonePrizeTotal,
  newMilestones,
  nextProfitStreak,
  nextRank,
  rankStats,
  reputationChange,
  researchEffects,
  settleGoal,
  yearSnapshot,
  type AnnualGoal,
  type MilestoneContext,
  type RankStats,
  type ReputationChange,
  type ResearchState,
} from './progress';
import { nextYieldPosition, priceWarStep, rivalFareRatio, rivalTargetFareRatio, type PriceWarState } from './rivals';
import {
  RIVAL_HEALTHY,
  crisisFrequency,
  crisisSeverity,
  dividendLimit,
  emergencySaleCandidate,
  fineTune,
  fineTuneThisMonth,
  isCrisis,
  liquidate,
  loserDecisions,
  maxWeeklyRotations,
  mayOverhaul,
  needsOverhaul,
  nextIdleMonths,
  rivalDistressStep,
  rivalDividend,
  rivalSubsidy,
  sellIdle,
  smoothedProfit,
  type RivalDistressState,
} from './rivalMonth';
import { rng } from './rng';
import { satisfactionFactor } from './satisfaction';

// ---------------------------------------------------------------------------
// Spielstand des Modells
// ---------------------------------------------------------------------------

/** Ein Flugzeug im Spielstand. */
export interface StatePlane extends BookingPlane {
  /** Eigener Hangar an einem Flughafen seiner Strecken (8.6, 8.13; KI nie). */
  readonly hasHangar: boolean;
  /** Bisherige Grundüberholungen (8.13). */
  readonly overhaulsDone: number;
  /** Flugzeugklasse (6.8) für Meilensteine. */
  readonly sizeClass?: SizeClass;
}

/** Was die KI je Strecke behält (7.6, 7.8, 7.12). */
export interface RivalRouteMemory {
  /** Geglätteter Gewinn (`smoothedProfit`, Monatswert). */
  readonly avgProfit?: number;
  /** Plan vor der ersten Krisen-Kürzung, Umläufe je Woche. */
  readonly fullFrequency?: number;
  /** Lage je Klasse (`nextYieldPosition`). */
  readonly yieldPosition?: PartialClassFigures;
  readonly priceWar?: PriceWarState;
}

/** Was eine KI über ihre Entscheidungen behält (7.3–7.15). */
export interface RivalBrain {
  readonly personality: RivalPersonality;
  readonly strength: RivalStrength;
  readonly distress: RivalDistressState;
  readonly routes: Readonly<Record<string, RivalRouteMemory>>;
  /** Monate ohne Strecke je Flugzeug. */
  readonly idleMonths: Readonly<Record<string, number>>;
  /** Monatskosten (5.16, Summe) je Monat, ältester zuerst, für die Dividenden-Grenze. */
  readonly costHistory: readonly number[];
  /** Zuschuss eingeschaltet (7.14, bis zur Prüfung im Balance-Skript). */
  readonly subsidy: boolean;
}

/** Eine Vorbestellung (8.12). */
export interface StatePreorder {
  readonly id: string;
  readonly listPrice1960: number;
  readonly cabinListPrice1960: number;
  readonly family: string;
  readonly sizeClass?: SizeClass;
  /** Stückzahl. */
  readonly n: number;
  /** Liefermonat: ab diesem Monat fliegen die Flugzeuge; geliefert im Abschluss davor. */
  readonly deliveryMonth: number;
  readonly deposit: number;
  readonly delays: number;
}

/** Ein Ziel eines Szenarios (8.15). */
export interface ScenarioTarget {
  readonly id: string;
  readonly metric: ScenarioMetric;
  /** Ziel; bei Dollar-Zielen als Wert von 1960. */
  readonly target: number;
  /** Zählt erst beim Abschluss des Stichtags. */
  readonly atDeadline?: boolean;
}

/** Ein laufendes Szenario. */
export interface ScenarioState {
  readonly win: readonly ScenarioTarget[];
  /** Kasse unter −`creditLimit` an so vielen Monatsenden in Folge verliert (8.15, Lesart von E34). */
  readonly floorMonths: number;
  /** Letzter Monat, dessen Abschluss zählt. */
  readonly deadline: number;
  readonly floorStreak: number;
  /** Erreichte Ziele (Ids). */
  readonly met: readonly string[];
  readonly status: 'running' | 'won' | 'lost';
}

/** Was nur der Spieler hat (7.2): Fortschritt, Personal, Vorbestellungen, Kreditlinie, Szenario. */
export interface PlayerProgress {
  readonly startMonth: number;
  readonly rank: number;
  readonly rankHistory: readonly RankStats[];
  readonly research: ResearchState;
  readonly milestones: readonly string[];
  readonly profitStreak: number;
  readonly careerPax: number;
  readonly takeovers: number;
  readonly goal?: AnnualGoal;
  readonly staff: { readonly salaryPct: number; readonly morale: number; readonly strike?: StaffStrike };
  readonly preorders: readonly StatePreorder[];
  readonly overdrawnMonths: number;
  readonly bankrupt: boolean;
  readonly scenario?: ScenarioState;
}

/** Eine laufende Kampagne (5.14, 6.3). */
export interface StateCampaign {
  readonly level: CampaignLevel;
  /** Letzter Monat, in dem sie läuft. */
  readonly untilMonth: number;
}

/** Eine Gesellschaft im Spielstand. Spieler: `player`; KI: `rival`. */
export interface CompanyState {
  readonly id: string;
  readonly cashAtMonthStart: number;
  readonly cash: number;
  readonly reputation: number;
  readonly planes: readonly StatePlane[];
  readonly routes: readonly BookingRoute[];
  readonly transactions: readonly MonthTransaction[];
  readonly campaigns: readonly StateCampaign[];
  readonly ffpActive: boolean;
  /** Unter dem Pech-Deckel (8.8; KI: `RIVAL_INPUTS.badLuckCap = false`). */
  readonly badLuckCap: boolean;
  /** Berichte, ältester zuerst, höchstens `REPORT_HISTORY_MONTHS`. */
  readonly reports: readonly MonthReport[];
  /** Ruf-Änderung des letzten Abschlusses mit Ursachen (6.5). */
  readonly reputationChange?: ReputationChange;
  readonly player?: PlayerProgress;
  readonly rival?: RivalBrain;
}

/** Ein an den Markt verkauftes Flugzeug (8.11). */
export interface ResoldPlane extends StatePlane {
  readonly soldMonth: number;
}

/** Spielstand des Modells am Ende von Monat `month`, vor dem Abschluss (8.3). */
export interface MonthState {
  readonly month: number;
  readonly seed: number;
  readonly companies: readonly CompanyState[];
  /** Gewürfelte Zufallsereignisse (8.4). */
  readonly randomEvents: readonly WorldEvent[];
  /** Störungen dieses Monats mit Charter-Antworten (8.6, 8.9). */
  readonly disruptions: readonly Disruption[];
  /** Hatte dieser Monat einmaliges Pech (8.8)? */
  readonly badLuck: boolean;
  /** Weiterverkaufte Flugzeuge (8.11). */
  readonly usedMarket: readonly ResoldPlane[];
}

/** Abgeleitete Werte des Monats X (Aufrufer, Phase 4). */
export interface MonthWorld {
  readonly markets: readonly BookingMarket[];
  readonly companies: Readonly<Record<string, CompanyWorld>>;
  /** KI: Slots, die je Strecke noch belegt werden können (7.10); fehlt = 0. */
  readonly slotRoom?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** Szenario: Strecken, Regionen, Umsteiger aus dem Modell (8.15); fehlt = aus den Strecken. */
  readonly transferPax?: number;
}

/** Eine Meldung des Abschlusses (Texte in Phase 4, E52). */
export interface CloseNews {
  readonly companyId: string;
  readonly kind:
    | 'priceWarStarted'
    | 'priceWarEnded'
    | 'scheduleCut'
    | 'routeClosed'
    | 'planeSold'
    | 'overhaul'
    | 'dividend'
    | 'forSale'
    | 'recovered'
    | 'liquidated'
    | 'delivery'
    | 'deliveryDelayed'
    | 'preorderCancelled'
    | 'forcedSale'
    | 'bankrupt'
    | 'milestone'
    | 'rankUp'
    | 'goalMet'
    | 'goalMissed'
    | 'researchDone'
    | 'staffStrike'
    | 'randomEvent'
    | 'scenarioWon'
    | 'scenarioLost'
    | 'invalidNumber';
  readonly subject?: string;
  readonly amount?: number;
}

/** Ergebnis von `closeMonth`. */
export interface CloseResult {
  /** Spielstand für X+1. */
  readonly state: MonthState;
  /** Bericht X je Gesellschaft (auch im Spielstand, `reports`). */
  readonly reports: Readonly<Record<string, MonthReport>>;
  readonly news: readonly CloseNews[];
}

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

/** Laufende Kampagnen im Monat. */
function runningCampaigns(c: CompanyState, month: number): CampaignLevel[] {
  return c.campaigns.filter((k) => k.untilMonth >= month).map((k) => k.level);
}

/** Die Gesellschaft, wie die Buchung sie sieht (neutrale Felder, 7.2). */
export function bookingCompany(c: CompanyState, month: number): BookingCompany {
  return {
    id: c.id,
    cashAtMonthStart: c.cashAtMonthStart,
    cash: c.cash,
    reputation: c.reputation,
    planes: c.planes,
    routes: c.routes,
    transactions: c.transactions,
    completedResearch: c.player?.research.done ?? [],
    campaigns: runningCampaigns(c, month),
    ffpActive: c.ffpActive,
    staffStrikeShare: c.player ? strikeCancelShare(c.player.staff.strike, month) : 0,
    subsidy: c.rival ? rivalSubsidy(month, c.rival.subsidy) : 0,
    depositsAtMonthStart:
      sum((c.player?.preorders ?? []).map((p) => p.deposit)) - sum(c.transactions.map((t) => t.depositChange ?? 0)),
  };
}

/** Regionen aller Strecken-Enden (R15). */
function routeRegions(c: Pick<CompanyState, 'routes'>, markets: ReadonlyMap<string, BookingMarket>): WorldRegion[] {
  return c.routes.flatMap((r) => markets.get(r.marketId)?.regions ?? []);
}

/** Gesellschaften, die am Markt teilnehmen (aufgelöste KI nicht). */
function active(c: CompanyState): boolean {
  return c.rival?.distress.status !== 'liquidated';
}

/**
 * Vorhersage des Monats (R2): dieselbe Buchung wie im Abschluss mit den bekannten Störungen und Ereignissen. Planer
 * und Streckenliste lesen sie; sie gleicht dem Abschluss, solange sich am Stand nichts ändert (8.1).
 */
export function forecastMonth(state: MonthState, world: MonthWorld): CompanyBooking[] {
  const companies = state.companies.filter(active);
  return bookMonth({
    month: state.month,
    seed: state.seed,
    markets: world.markets,
    events: activeWorldEvents(state.month, state.randomEvents),
    disruptions: state.disruptions,
    companies: companies.map((c) => ({ company: bookingCompany(c, state.month), world: world.companies[c.id] })),
  });
}

/**
 * Planer-Hauptzahl einer Strecke (4.12, 7.9) mit anderen Umläufen je Woche: erwarteter Gewinn je Monat
 * (`routeResult × WEEKS_PER_MONTH`) mit allen Angeboten des Paars, ohne Störungen. Dieselbe Buchung wie der
 * Abschluss (R2); die KI rechnet damit ihre Verlierer und die Feinabstimmung (7.8).
 */
export function plannerResultAt(
  state: MonthState,
  world: MonthWorld,
  companyId: string,
  routeId: string,
  weeklyFrequency: number,
): number {
  const own = state.companies.find((c) => c.id === companyId);
  const route = own?.routes.find((r) => r.id === routeId);
  if (!own || !route) throw new Error(`plannerResultAt: Strecke ${companyId}/${routeId} fehlt`);
  const companies = state.companies.filter(active).map((c) => {
    const routes = c.routes
      .filter((r) => r.marketId === route.marketId)
      .map((r) => (c.id === companyId && r.id === routeId ? { ...r, departuresPerWeek: 2 * weeklyFrequency } : r));
    return { company: { ...bookingCompany({ ...c, routes }, state.month), planes: [], transactions: [] }, world: world.companies[c.id] };
  });
  const booking = bookMonth({
    month: state.month,
    seed: state.seed,
    markets: world.markets.filter((m) => m.id === route.marketId),
    events: activeWorldEvents(state.month, state.randomEvents),
    disruptions: [],
    companies,
  });
  const result = booking.find((b) => b.companyId === companyId)!.routes.find((r) => r.id === routeId)!.result;
  return result * WEEKS_PER_MONTH;
}

// ---------------------------------------------------------------------------
// 8.15 Szenario-Ziele
// ---------------------------------------------------------------------------

/** Werte eines Abschlusses für die Szenario-Ziele (8.15). */
export interface ScenarioValues {
  readonly capital: number;
  readonly monthlyProfit: number;
  readonly reputation: number;
  readonly routes: number;
  readonly regions: number;
  readonly transferPax: number;
  readonly creditLimit: number;
  readonly bankrupt: boolean;
}

/** Schwelle eines Ziels im Monat `month`: Dollar-Ziele als Wert von 1960 über `atCost` (E6). SPEZIFIKATION 8.15. */
export function scenarioTarget(target: Pick<ScenarioTarget, 'metric' | 'target'>, month: number): number {
  return SCENARIO_DOLLAR_METRICS.includes(target.metric) ? atCost(target.target, month) : target.target;
}

/**
 * Szenario nach dem Abschluss von `month` (8.15): Ziele mit den Werten dieses Abschlusses (Kasse am Monatsende nach
 * allen Buchungen, R11); verloren bei Spielende (8.14) oder Kasse unter −`creditLimit` an `floorMonths` Monatsenden
 * in Folge; nach dem Stichtag verloren, wenn nicht alle Ziele erreicht sind.
 */
export function scenarioStep(s: ScenarioState, values: ScenarioValues, month: number): ScenarioState {
  if (s.status !== 'running') return s;
  const floorStreak = values.capital < -values.creditLimit ? s.floorStreak + 1 : 0;
  if (values.bankrupt || floorStreak >= s.floorMonths) return { ...s, floorStreak, status: 'lost' };
  const met = new Set(s.met);
  for (const t of s.win) {
    if (t.atDeadline && month !== s.deadline) continue;
    if (values[t.metric] >= scenarioTarget(t, month)) met.add(t.id);
  }
  const all = s.win.every((t) => met.has(t.id));
  const status = all ? 'won' : month >= s.deadline ? 'lost' : 'running';
  return { ...s, floorStreak, met: [...met].sort(), status };
}

// ---------------------------------------------------------------------------
// 8.16 Prüfung auf ungültige Zahlen
// ---------------------------------------------------------------------------

/** Größen einer Gesellschaft, die nach dem Abschluss endlich sein müssen. */
function invalidFields(c: CompanyState): string[] {
  const bad: string[] = [];
  const check = (name: string, v: number) => {
    if (!Number.isFinite(v)) bad.push(name);
  };
  check('cash', c.cash);
  check('reputation', c.reputation);
  if (c.player) check('morale', c.player.staff.morale);
  for (const p of c.planes) {
    check(`${p.id}.airframeCondition`, p.airframeCondition);
    check(`${p.id}.cabinCondition`, p.cabinCondition);
  }
  return bad;
}

/**
 * Prüfung am Ende des Abschlusses (8.16): Kasse, Ruf, Moral und Zustände jeder Gesellschaft müssen endlich sein.
 * Ein ungültiger Wert ist ein Fehler: Meldung, und die Größe behält ihren Wert vom Monatsanfang.
 */
export function guardNumbers(next: CompanyState, before: CompanyState): { company: CompanyState; invalid: string[] } {
  const invalid = invalidFields(next);
  if (invalid.length === 0) return { company: next, invalid };
  const planesBefore = new Map(before.planes.map((p) => [p.id, p]));
  const company: CompanyState = {
    ...next,
    cash: Number.isFinite(next.cash) ? next.cash : before.cash,
    cashAtMonthStart: Number.isFinite(next.cashAtMonthStart) ? next.cashAtMonthStart : before.cash,
    reputation: Number.isFinite(next.reputation) ? next.reputation : before.reputation,
    planes: next.planes.map((p) => {
      const old = planesBefore.get(p.id);
      return {
        ...p,
        airframeCondition: Number.isFinite(p.airframeCondition) ? p.airframeCondition : (old?.airframeCondition ?? 100),
        cabinCondition: Number.isFinite(p.cabinCondition) ? p.cabinCondition : (old?.cabinCondition ?? 100),
      };
    }),
    player:
      next.player && before.player && !Number.isFinite(next.player.staff.morale)
        ? { ...next.player, staff: { ...next.player.staff, morale: before.player.staff.morale } }
        : next.player,
  };
  return { company, invalid };
}

// ---------------------------------------------------------------------------
// Schritt 4: Entscheidungen der KI (7.8)
// ---------------------------------------------------------------------------

interface RivalStepResult {
  readonly company: CompanyState;
  readonly closing: MonthTransaction[];
  readonly sold: ResoldPlane[];
  readonly news: CloseNews[];
}

/**
 * Entscheidungen einer KI nach der Buchung in der Reihenfolge `RIVAL_DECISION_STEPS` (7.8). Sie wirken ab X+1
 * (Preise, Flugpläne) bzw. stehen als Geschäfte im Bericht X (Verkäufe, Überholungen, Dividende). Der Zufall
 * kommt aus `rng` mit Zweck und Gesellschaft als Schlüssel, die Reihenfolge der KI zählt daher nicht.
 */
function rivalDecisions(
  state: MonthState,
  world: MonthWorld,
  company: CompanyState,
  booking: CompanyBooking,
  monthlyCostsTotal: number,
  cashNow: number,
  markets: ReadonlyMap<string, BookingMarket>,
): RivalStepResult {
  const brain = company.rival!;
  const X = state.month;
  const news: CloseNews[] = [];
  const closing: MonthTransaction[] = [];
  const sold: ResoldPlane[] = [];
  const byRoute = new Map(booking.routes.map((r) => [r.id, r]));
  const units = world.companies[company.id].routes;
  const events = activeWorldEvents(X, state.randomEvents);

  // Gedächtnis: geglätteter Gewinn.
  const memory: Record<string, RivalRouteMemory> = {};
  for (const r of company.routes) {
    memory[r.id] = { ...brain.routes[r.id], avgProfit: smoothedProfit(brain.routes[r.id]?.avgProfit, byRoute.get(r.id)!.result * WEEKS_PER_MONTH) };
  }
  let routes = company.routes.map((r) => ({ ...r }));

  // prices (7.6): Lage je Klasse, Preiskampf je Paar, Preisniveau ab X+1.
  routes = routes.map((r) => {
    const b = byRoute.get(r.id)!;
    const m = memory[r.id];
    const market = markets.get(r.marketId)!;
    const others = state.companies.filter((o) => o.id !== company.id && active(o)).flatMap((o) => o.routes.filter((x) => x.marketId === r.marketId));
    const fares = marketFares(market.greatCircleKm, X);
    const ownEconomy = (r.fareRatio?.economy ?? 1) * fares.economy;
    const war = priceWarStep(m.priceWar ?? {}, {
      personality: brain.personality,
      month: X,
      routeAgeMonths: r.ageMonths,
      avgProfit: m.avgProfit ?? 0,
      lastRivalOpeningMonth: others.length > 0 ? X - Math.min(...others.map((o) => o.ageMonths)) : undefined,
      undercutInEconomy: others.some((o) => (o.fareRatio?.economy ?? 1) * fares.economy < ownEconomy),
      competitorPresent: others.length > 0,
    });
    if (war.event) news.push({ companyId: company.id, kind: war.event === 'started' ? 'priceWarStarted' : 'priceWarEnded', subject: r.marketId });
    const u = units[r.id];
    const classes: Partial<Record<CabinClass, { seatsPerWeek: number; marketFare: number; costPerPassenger: number }>> = {};
    for (const c of CABIN_CLASSES) {
      const seats = (r.seatsPerFlight[c] ?? 0) * r.departuresPerWeek;
      if (seats > 0) classes[c] = { seatsPerWeek: seats, marketFare: fares[c], costPerPassenger: u.passengerCost[c]?.total ?? 0 };
    }
    const fixed = (u.fuelPerLeg + u.crewPerLeg + u.landingPerLeg) * r.departuresPerWeek + u.slotShare + u.aircraftShare;
    const breakEvenFull = Object.keys(classes).length > 0 ? breakEvenFareLevel(1, fixed, classes) : 0;
    const yieldPosition: Partial<Record<CabinClass, number>> = {};
    const fareRatio: Partial<Record<CabinClass, number>> = {};
    for (const c of CABIN_CLASSES) {
      const seats = (r.seatsPerFlight[c] ?? 0) * r.departuresPerWeek * (1 - b.shares.cancelledShare);
      if (!(seats > 0)) continue;
      const position = nextYieldPosition(m.yieldPosition?.[c] ?? 0, b.passengers[c] / seats);
      yieldPosition[c] = position;
      const sf = satisfactionFactor(u.satisfaction[c] ?? 100);
      const best =
        brain.personality === 'optimizer'
          ? bestFareRatio((ratio) => routePassengersAt(state, world, company.id, r.id, c, ratio), fares[c], u.passengerCost[c]?.total ?? 0)
          : undefined;
      fareRatio[c] = rivalFareRatio({
        personality: brain.personality,
        target: rivalTargetFareRatio(brain.personality, sf, best),
        yieldPosition: position,
        priceWar: war.state.startedMonth !== undefined,
        breakEvenFull,
      });
    }
    memory[r.id] = { ...m, priceWar: war.state, yieldPosition };
    return { ...r, fareRatio };
  });

  // crisis (7.12): Krisen-Fahrplan.
  const severity = crisisSeverity(events, X);
  const inCrisis = isCrisis(severity);
  routes = routes.map((r) => {
    const b = byRoute.get(r.id)!;
    const m = memory[r.id];
    const current = r.departuresPerWeek / 2;
    const full = m.fullFrequency ?? current;
    const seats = b.offeredSeats;
    const next = crisisFrequency({ current, full, loadFactor: seats > 0 ? b.totalPassengers / seats : undefined, inCrisis });
    const keepFull = inCrisis || next < full;
    memory[r.id] = { ...m, fullFrequency: keepFull ? full : undefined };
    if (next < current) news.push({ companyId: company.id, kind: 'scheduleCut', subject: r.id });
    return next === current ? r : { ...r, departuresPerWeek: 2 * next };
  });

  const view = () =>
    routes.map((r) => ({ id: r.id, weeklyFrequency: r.departuresPerWeek / 2, ageMonths: r.ageMonths, avgProfit: memory[r.id].avgProfit ?? 0 }));
  // Planer-Hauptzahl mit dem jeweils aktuellen Plan dieser KI (R2).
  const expectedProfitAt = (routeId: string, weeklyFrequency: number) =>
    plannerResultAt(
      { ...state, companies: state.companies.map((c) => (c.id === company.id ? { ...c, routes } : c)) },
      world,
      company.id,
      routeId,
      weeklyFrequency,
    );

  // losers (7.8 Schritt 3).
  for (const d of loserDecisions(view(), brain.personality, brain.strength, expectedProfitAt)) {
    if (d.action === 'close') {
      routes = routes.filter((r) => r.id !== d.routeId);
      news.push({ companyId: company.id, kind: 'routeClosed', subject: d.routeId });
    } else {
      routes = routes.map((r) => (r.id === d.routeId ? { ...r, departuresPerWeek: 2 * d.weeklyFrequency } : r));
      news.push({ companyId: company.id, kind: 'scheduleCut', subject: d.routeId });
    }
  }

  // fineTune (7.8 Schritt 4).
  if (fineTuneThisMonth(brain.strength, rng(state.seed, X, 'fineTune', company.id))) {
    const slotRoom = world.slotRoom?.[company.id] ?? {};
    for (const v of view()) {
      const r = routes.find((x) => x.id === v.id)!;
      const alt = fineTune(
        {
          route: v,
          maxRotations: maxWeeklyRotations(2 * r.blockMinutes),
          slotRoom: slotRoom[r.id] ?? 0,
          crisisReduced: memory[r.id].fullFrequency !== undefined && v.weeklyFrequency < memory[r.id].fullFrequency!,
        },
        expectedProfitAt,
      );
      if (alt !== null) routes = routes.map((x) => (x.id === r.id ? { ...x, departuresPerWeek: 2 * alt } : x));
    }
  }

  // fleet (7.11): Überholung, Leerlauf-Verkauf, Notverkauf. Werte am Monatsende (X+1, nach dem Verschleiß).
  const wear = new Map(booking.planes.map((p) => [p.id, p]));
  let planes: StatePlane[] = company.planes.map((p) => ({
    ...p,
    airframeCondition: wear.get(p.id)!.airframeCondition,
    cabinCondition: wear.get(p.id)!.cabinCondition,
  }));
  let cash = cashNow;
  const idleMonths: Record<string, number> = {};
  const flyingIds = new Set(routes.filter((r) => r.departuresPerWeek > 0).map((r) => r.planeId));
  for (const p of planes) idleMonths[p.id] = nextIdleMonths(brain.idleMonths[p.id] ?? 0, flyingIds.has(p.id));

  const sell = (planeId: string, kind: CloseNews['kind']) => {
    const p = planes.find((x) => x.id === planeId)!;
    const value = aircraftValue(p, X + 1);
    const proceeds = saleProceeds(value);
    closing.push({ kind: 'sale', cash: proceeds, valueChange: -value, planeId });
    cash += proceeds;
    planes = planes.filter((x) => x.id !== planeId);
    routes = routes.filter((r) => r.planeId !== planeId);
    sold.push({ ...p, soldMonth: X + 1 });
    news.push({ companyId: company.id, kind, subject: planeId, amount: proceeds });
  };

  for (const p of [...planes]) {
    if (!needsOverhaul(p)) continue;
    const quote = overhaulQuote(p, X + 1, p.overhaulsDone, false);
    if (!quote || !mayOverhaul(brain.personality, X, cash, quote.price)) continue;
    closing.push({ kind: 'overhaul', cash: -quote.price, valueChange: quote.valueGain, planeId: p.id });
    cash -= quote.price;
    planes = planes.map((x) => (x.id === p.id ? { ...x, airframeCondition: quote.airframeAfter, overhaulsDone: x.overhaulsDone + 1 } : x));
    news.push({ companyId: company.id, kind: 'overhaul', subject: p.id, amount: quote.price });
  }
  for (const p of [...planes]) {
    if (!flyingIds.has(p.id) && sellIdle(idleMonths[p.id], inCrisis)) sell(p.id, 'planeSold');
  }
  const planeResult = (id: string) => sum(booking.routes.filter((r) => r.planeId === id).map((r) => r.result));
  const emergency = emergencySaleCandidate(
    planes.map((p) => ({
      id: p.id,
      builtMonth: p.builtMonth,
      typeLastDeliveryOffset: null,
      airframeCondition: p.airframeCondition,
      cabinCondition: p.cabinCondition,
      flying: routes.some((r) => r.planeId === p.id && r.departuresPerWeek > 0),
      routeResult: planeResult(p.id),
      idleMonths: idleMonths[p.id] ?? 0,
    })),
    cash,
  );
  if (emergency >= 0) sell(planes[emergency].id, 'planeSold');

  // dividend (7.13): nach allen Buchungen.
  const costHistory = [...brain.costHistory, monthlyCostsTotal].slice(-REPORT_HISTORY_MONTHS);
  const dividend = rivalDividend(cash, dividendLimit(X, costHistory));
  if (dividend > 0) {
    closing.push({ kind: 'dividend', cash: -dividend });
    cash -= dividend;
    news.push({ companyId: company.id, kind: 'dividend', amount: dividend });
  }

  // distress (7.15).
  const fleetValue = sum(planes.map((p) => aircraftValue(p, X + 1)));
  const step = rivalDistressStep(brain.distress, { cash, creditLimit: creditLimit(fleetValue), aircraftCount: planes.length });
  if (step.event) news.push({ companyId: company.id, kind: step.event });
  if (step.state.status === 'liquidated' && brain.distress.status !== 'liquidated') {
    const out = liquidate(planes, [], cash);
    sold.push(...out.toUsedMarket.map((p) => ({ ...p, soldMonth: X + 1 })));
    planes = [];
    routes = [];
  }

  const kept: Record<string, RivalRouteMemory> = {};
  for (const r of routes) kept[r.id] = memory[r.id];
  const keptIdle: Record<string, number> = {};
  for (const p of planes) keptIdle[p.id] = idleMonths[p.id];

  return {
    company: {
      ...company,
      planes,
      routes,
      rival: { ...brain, distress: step.state, routes: kept, idleMonths: keptIdle, costHistory },
    },
    closing,
    sold,
    news,
  };
}

/** Direktgäste einer Strecke in einer Klasse je Woche beim Preisniveau `fareRatio` (für den besten Preis, 4.10). */
function routePassengersAt(state: MonthState, world: MonthWorld, companyId: string, routeId: string, c: CabinClass, fareRatio: number): number {
  const own = state.companies.find((x) => x.id === companyId)!;
  const route = own.routes.find((r) => r.id === routeId)!;
  const market = world.markets.find((m) => m.id === route.marketId)!;
  const offers = state.companies.filter(active).flatMap((co) => {
    const routes = co.routes
      .filter((r) => r.marketId === route.marketId)
      .map((r) => (co.id === companyId && r.id === routeId ? { ...r, fareRatio: { ...r.fareRatio, [c]: fareRatio } } : r));
    if (routes.length === 0) return [];
    return [{ companyId: co.id, reputation: co.reputation, routes: routes.map((r) => ({ route: r, units: world.companies[co.id].routes[r.id], cancelledShare: 0 })) }];
  });
  return splitMarket(market, offers, state.month, activeWorldEvents(state.month, state.randomEvents))[routeId][c];
}

// ---------------------------------------------------------------------------
// closeMonth
// ---------------------------------------------------------------------------

/**
 * Der Monatsabschluss von Monat X (8.0, 8.1). Reine Funktion: liest nur `state` und `world`, schreibt nichts außerhalb
 * (R12, 8.3). Zwei Aufrufe mit gleicher Eingabe ergeben dasselbe; die Reihenfolge der Gesellschaften ändert nichts.
 *
 * 1. Stand von X: Strecken, Preise vom Monatsbeginn, Ruf und Moral vom Monatsbeginn, Störungen aus dem Spielstand.
 * 2. Buchung für alle in einer Marktaufteilung (`bookMonth`).
 * 3. Ruf für alle (6.5).
 * 4. KI-Entscheidungen (7.8).
 * 5. Spieler: Lieferungen (8.12), Kreditlinie, Zwangsverkauf, Spielende (8.14).
 * 6. Spieler: Gewinnserie, Meilensteine, Rang, im Dezember Jahresziel; Prämien und Strafe in die Kasse.
 * 7. Kasse am Monatsende und Bericht X (8.2); Szenario (8.15); Prüfung (8.16).
 * 8. Übergang zu X+1: Forschung, Moral, Würfe unter dem Pech-Deckel (8.8), Gebrauchtmarkt, Kampagnen, Alter.
 */
export function closeMonth(state: MonthState, world: MonthWorld): CloseResult {
  const X = state.month;
  const markets = new Map(world.markets.map((m) => [m.id, m]));
  const news: CloseNews[] = [];
  const sold: ResoldPlane[] = [];

  // Schritte 1 und 2.
  const bookings = new Map(forecastMonth(state, world).map((b) => [b.companyId, b]));

  const reports: Record<string, MonthReport> = {};
  const nextCompanies: CompanyState[] = [];

  for (const company of state.companies) {
    if (!active(company)) {
      nextCompanies.push(company);
      continue;
    }
    const booking = bookings.get(company.id)!;
    const base = bookingCompany(company, X);

    // Schritt 3: Ruf (6.5) mit Satisfaction und gestrichenen Sitzen des Monats.
    const rep = reputationChange(company.reputation, {
      airlineSatisfaction: booking.airlineSatisfaction,
      cancelledShare: booking.cancelledShare,
      campaigns: base.campaigns,
    });

    const wear = new Map(booking.planes.map((p) => [p.id, p]));
    let planes: StatePlane[] = company.planes.map((p) => ({
      ...p,
      airframeCondition: wear.get(p.id)!.airframeCondition,
      cabinCondition: wear.get(p.id)!.cabinCondition,
    }));
    let routes: BookingRoute[] = [...company.routes];
    let closing: MonthTransaction[] = [];
    let current: CompanyState = company;
    let cash = booking.cashAfterOperations;
    const provisional = (extra: readonly MonthTransaction[] = []) =>
      finishMonth({ month: X, company: base, booking, planesAtEnd: planes, closingTransactions: [...closing, ...extra] });

    // Schritt 4: KI.
    if (company.rival) {
      const step = rivalDecisions(state, world, company, booking, provisional().costs.total, cash, markets);
      closing = step.closing;
      planes = [...step.company.planes];
      routes = [...step.company.routes];
      current = step.company;
      cash += sum(step.closing.map((t) => t.cash));
      sold.push(...step.sold);
      news.push(...step.news);
    }

    // Schritte 5 und 6: Spieler.
    let player = company.player;
    if (player) {
      // 5: Lieferungen.
      const preorders: StatePreorder[] = [];
      for (const p of player.preorders) {
        if (p.deliveryMonth > X + 1) {
          preorders.push(p);
          continue;
        }
        const unitValue = newAircraftPrice(p.listPrice1960, p.cabinListPrice1960, X + 1);
        const balance = preorderBalance(unitValue, p.n, p.deposit);
        const decision = preorderDelivery(cash, balance, p.delays);
        if (decision === 'deliver') {
          for (let k = 0; k < p.n; k++) {
            planes.push({
              id: `${p.id}-${k + 1}`,
              family: p.family,
              listPrice1960: p.listPrice1960,
              cabinListPrice1960: p.cabinListPrice1960,
              builtMonth: X + 1,
              cabinInstalledMonth: X + 1,
              airframeCondition: 100,
              cabinCondition: 100,
              hasHangar: false,
              overhaulsDone: 0,
              sizeClass: p.sizeClass,
            });
          }
          closing.push({ kind: 'delivery', cash: -balance, valueChange: p.n * unitValue, depositChange: -p.deposit });
          cash -= balance;
          news.push({ companyId: company.id, kind: 'delivery', subject: p.id, amount: balance });
        } else if (decision === 'delay') {
          preorders.push({ ...p, deliveryMonth: p.deliveryMonth + 1, delays: p.delays + 1 });
          news.push({ companyId: company.id, kind: 'deliveryDelayed', subject: p.id });
        } else {
          closing.push({ kind: 'preorderCancel', cash: 0, depositChange: -p.deposit });
          news.push({ companyId: company.id, kind: 'preorderCancelled', subject: p.id, amount: p.deposit });
        }
      }

      // 5: Kreditlinie, Zwangsverkauf, Spielende.
      const fleetValue = () => sum(planes.map((p) => aircraftValue(p, X + 1)));
      let credit = creditState(cash, creditLimit(fleetValue()));
      const overdrawnMonths = nextOverdrawnMonths(player.overdrawnMonths, credit);
      const planeResult = (id: string) => sum(booking.routes.filter((r) => r.planeId === id).map((r) => r.result));
      const forced = forcedSale(
        planes.map((p) => ({ flying: routes.some((r) => r.planeId === p.id && r.departuresPerWeek > 0), routeResult: planeResult(p.id) })),
        overdrawnMonths,
        credit,
      );
      if (forced >= 0) {
        const p = planes[forced];
        const value = aircraftValue(p, X + 1);
        const proceeds = saleProceeds(value, researchEffects(player.research.done).resaleBonus);
        closing.push({ kind: 'sale', cash: proceeds, valueChange: -value, planeId: p.id });
        cash += proceeds;
        planes = planes.filter((x) => x.id !== p.id);
        routes = routes.filter((r) => r.planeId !== p.id);
        sold.push({ ...p, soldMonth: X + 1 });
        news.push({ companyId: company.id, kind: 'forcedSale', subject: p.id, amount: proceeds });
        credit = creditState(cash, creditLimit(fleetValue()));
      }
      const bankrupt = player.bankrupt || isBankrupt(credit, planes.length);
      if (bankrupt && !player.bankrupt) news.push({ companyId: company.id, kind: 'bankrupt' });

      // 6: Gewinnserie, Meilensteine (Kasse nach allen Buchungen, ohne die Prämien dieses Abschlusses), Rang, Ziel.
      const before = provisional();
      const regions = routeRegions({ routes }, markets);
      const profitStreak = nextProfitStreak(player.profitStreak, before.result, routes.length);
      const careerPax = player.careerPax + booking.passengers;
      const context: MilestoneContext = {
        routes: routes.length,
        fleet: planes.length,
        careerPax,
        regions: new Set(regions).size,
        longestRouteKm: Math.max(0, ...routes.map((r) => markets.get(r.marketId)?.greatCircleKm ?? 0)),
        cash: before.cashEnd,
        profitStreak,
        reputation: rep.reputation,
        monthTransferPax: world.transferPax ?? 0,
        widebodies: planes.filter((p) => p.sizeClass === 'widebody' || p.sizeClass === 'jumbo').length,
        supersonics: planes.filter((p) => p.sizeClass === 'supersonic').length,
        takeovers: player.takeovers,
      };
      const earned = newMilestones(player.milestones, context, X);
      if (earned.length > 0) {
        const prize = milestonePrizeTotal(earned, X);
        closing.push({ kind: 'prize', cash: prize });
        cash += prize;
        for (const m of earned) news.push({ companyId: company.id, kind: 'milestone', subject: m.id });
      }
      const stats = rankStats({
        routes: routes.length,
        weeklyPassengers: booking.weeklyPassengers,
        reputation: rep.reputation,
        routeEndRegions: regions,
        monthsPlayed: X - player.startMonth,
      });
      const rankHistory = [...player.rankHistory, stats].slice(-RANK_AVERAGE_MONTHS);
      const rank = nextRank(player.rank, rankHistory);
      if (rank > player.rank) news.push({ companyId: company.id, kind: 'rankUp', amount: rank });

      let goal = player.goal;
      if (goal && isDecember(X) && goal.year === yearOf(X)) {
        const history = [...company.reports, before].map((r) => ({ year: yearOf(r.month), result: r.result, revenue: r.revenue, passengers: r.passengers }));
        const snapshot = yearSnapshot(history, goal.year, { routes: routes.length, regions: new Set(regions).size, reputation: rep.reputation });
        const settled = settleGoal(goal, snapshot);
        closing.push({ kind: settled.met ? 'prize' : 'goalPenalty', cash: settled.cash });
        cash += settled.cash;
        news.push({ companyId: company.id, kind: settled.met ? 'goalMet' : 'goalMissed', amount: goalValue(goal, snapshot) });
        goal = undefined;
      }

      player = {
        ...player,
        preorders,
        overdrawnMonths,
        bankrupt,
        profitStreak,
        careerPax,
        milestones: [...player.milestones, ...earned.map((m) => m.id)],
        rankHistory,
        rank,
        goal,
      };
    }

    // Schritt 7: Kasse am Monatsende und Bericht.
    const report = provisional();
    reports[company.id] = report;

    if (player?.scenario) {
      const scenario = scenarioStep(
        player.scenario,
        {
          capital: report.cashEnd,
          monthlyProfit: report.result,
          reputation: rep.reputation,
          routes: new Set(routes.map((r) => r.marketId)).size,
          regions: new Set(routeRegions({ routes }, markets)).size,
          transferPax: world.transferPax ?? 0,
          creditLimit: report.creditLimit,
          bankrupt: player.bankrupt,
        },
        X,
      );
      if (scenario.status !== player.scenario.status) {
        news.push({ companyId: company.id, kind: scenario.status === 'won' ? 'scenarioWon' : 'scenarioLost' });
      }
      player = { ...player, scenario };
    }

    // Schritt 8 (je Gesellschaft): Übergang.
    let staff = player?.staff;
    let research = player?.research;
    if (player && staff && research) {
      const advanced = advanceResearch(research, X + 1);
      research = advanced.state;
      for (const id of advanced.completed) news.push({ companyId: company.id, kind: 'researchDone', subject: id });
      const target = moraleTarget({
        salaryPct: staff.salaryPct,
        month: X + 1,
        moralePoints: researchEffects(research.done).moralePoints,
        profitStreak: player.profitStreak,
        strike: staff.strike,
      });
      staff = { ...staff, morale: nextMorale(staff.morale, target) };
    }

    const next: CompanyState = {
      ...current,
      cashAtMonthStart: report.cashEnd,
      cash: report.cashEnd,
      reputation: rep.reputation,
      reputationChange: rep,
      planes,
      routes: routes.map((r) => ({ ...r, ageMonths: r.ageMonths + 1 })),
      transactions: [],
      campaigns: company.campaigns.filter((k) => k.untilMonth > X),
      reports: [...company.reports, report].slice(-REPORT_HISTORY_MONTHS),
      player: player && staff && research ? { ...player, staff, research } : player,
    };

    // Prüfung (8.16).
    const guarded = guardNumbers(next, company);
    for (const field of guarded.invalid) news.push({ companyId: company.id, kind: 'invalidNumber', subject: field });
    nextCompanies.push(guarded.company);
  }

  // Schritt 8 (gemeinsam): Würfe für X+1 in fester Reihenfolge unter dem Pech-Deckel (8.8).
  const live = nextCompanies.filter(active);
  const capped = live.filter((c) => c.badLuckCap);
  const routeEnds = new Map<string, { capped: boolean }>();
  for (const c of live) {
    for (const r of c.routes) {
      if (r.departuresPerWeek <= 0) continue;
      for (const a of r.airportIds) routeEnds.set(a, { capped: (routeEnds.get(a)?.capped ?? false) || c.badLuckCap });
    }
  }
  const staffCompany = live.find((c) => c.player);
  const roll = rollTransition({
    seed: state.seed,
    month: X + 1,
    randomEvents: state.randomEvents,
    previousBadLuck: state.badLuck,
    morale: staffCompany?.player?.staff.morale,
    planes: live.flatMap((c) => {
      const effects = researchEffects(c.player?.research.done ?? []);
      return c.planes.map((p) => ({
        id: p.id,
        airframeCondition: p.airframeCondition,
        builtMonth: p.builtMonth,
        hasHangar: p.hasHangar,
        defectFactor: effects.defectFactor,
        flies: c.routes.some((r) => r.planeId === p.id && r.departuresPerWeek > 0),
        badLuckCap: c.badLuckCap,
      }));
    }),
    airports: [...routeEnds.entries()].map(([id, v]) => ({ id, hasDepartures: true, badLuckCap: v.capped })),
    capRegions: [...new Set(capped.flatMap((c) => routeRegions(c, markets)))],
  });
  if (roll.randomEvent) news.push({ companyId: '', kind: 'randomEvent', subject: roll.randomEvent.title });

  const finalCompanies = nextCompanies.map((c) => {
    if (c === staffCompany && roll.staffStrike && c.player) {
      news.push({ companyId: c.id, kind: 'staffStrike' });
      return { ...c, player: { ...c.player, staff: { ...c.player.staff, strike: { month: X + 1 } } } };
    }
    return c;
  });

  return {
    state: {
      month: X + 1,
      seed: state.seed,
      companies: finalCompanies,
      randomEvents: roll.randomEvent ? [...state.randomEvents, roll.randomEvent] : state.randomEvents,
      disruptions: roll.disruptions,
      badLuck: roll.badLuck,
      usedMarket: [...state.usedMarket, ...sold].filter((p) => X + 1 - p.soldMonth < USED_RESOLD_MONTHS),
    },
    reports,
    news,
  };
}

/** Start-Gehirn einer neuen KI (7.7). */
export function newRivalBrain(personality: RivalPersonality, strength: RivalStrength, subsidy: boolean): RivalBrain {
  return { personality, strength, distress: RIVAL_HEALTHY, routes: {}, idleMonths: {}, costHistory: [], subsidy };
}
