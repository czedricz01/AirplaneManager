/**
 * Monatsabschluss des Modells für die Oberfläche (Paket 4.2e, E72, F57): setzt die drei Teile der Brücke zusammen.
 *
 * - `modelGame` baut aus dem Spielstand der Oberfläche (`AppGame`) einen ganzen `ModelState`: der Spieler aus Teil 1
 *   (Betrieb, `modelBridge.ts`) und Teil 2 (Eingaben, Kasse, Fortschritt, `modelBridgeCompany.ts`), die KI und der
 *   Welt-Zustand aus Teil 3 (`modelBridgeWorld.ts`).
 * - `runModelMonth` rechnet einen Monat mit `closeMonth` (KI über `rivalDecisions`, Nachrücken über `rivalRefill`) und
 *   gibt alle Felder der Oberfläche für den neuen Monat zurück (`AppMonth`), dazu Bericht und Meldungen.
 * - `closeNewsMessages` macht aus den Meldungen des Abschlusses (`CloseNews`) Nachrichten im Posteingang.
 *
 * Rein: liest nur seine Eingabe (R12). Die Datei ist Teil der Oberfläche (`src/lib/`); `App.tsx` ruft sie in 4.2f auf.
 */
import { aircraftList, type Aircraft } from '../data/aircraft';
import type { OwnedAircraft } from '../components/MyFleetView';
import type { AiAirline } from '../components/CompetitorsView';
import { yearOf } from '../model/basics';
import { MILESTONES, RANKS, REPORT_HISTORY_MONTHS, RESEARCH_PROJECTS, type RivalStrength } from '../model/constants';
import { birdStrikeCost } from '../model/monthEvents';
import { closeMonth, type CloseNews, type CompanyState, type MonthReport, type ModelAirport, type ModelState } from '../model/monthClose';
import { companyValueOf, rivalDecisions, rivalRefill, showRivalNews, type RivalNewsKind } from '../model/rivalMonth';
import { companyValue } from '../model/progress';
import { rivalStrengthOf } from '../model/rivals';
import type { AnnualGoal as AppGoal } from './annualGoals';
import type { HistoricalEvent } from './eventSystem';
import { formatCurrency } from './format';
import type { Career, Disruption as AppDisruption, Marketing, ScenarioState as AppScenario, Staff } from './gameState';
import type { AirportInfrastructure, GameMessage, MonthlyReport, SimulatedRoute } from './gameTypes';
import { nextMessageId } from './messages';
import { fleetValue } from '../model/monthClose';
import { aircraftState, applyModelOperations, catalogType, modelAirports, modelOperations, type RouteContext } from './modelBridge';
import {
  appReport,
  applyCompanyInputs,
  applyCompanyProgress,
  applyLedger,
  applyPreorders,
  companyInputs,
  companyProgress,
  deliveredAircraft,
  historyReports,
  monthLedger,
  preorderState,
  type CapexItem,
  type LedgerValues,
} from './modelBridgeCompany';
import {
  applyDisruptionAnswers,
  applyModelRivals,
  applyModelWorld,
  modelRivals,
  modelWorld,
  rivalRegistration,
  rivalViews,
  type RivalRecord,
  type WorldState,
} from './modelBridgeWorld';

/** Kennung des Spielers im Modell. */
export const PLAYER_ID = 'player';

/** Was der Abschluss aus dem Spielstand der Oberfläche liest (Felder wie in `App.tsx`). */
export interface AppGame {
  /** Laufender Spielmonat X (`currentDateOffset`). */
  readonly month: number;
  /** Erster Spielmonat (`startDateOffset`). */
  readonly startMonth: number;
  readonly airlineCode: string;
  /** Farbe des Spielers (`branding.color`): keine neue KI wird so gezeichnet. */
  readonly brandingColor?: string;
  /** Heimat-Drehkreuz (`selectedHub`); Lieferungen landen hier. */
  readonly selectedHub: string;
  /** Schwierigkeit („Easy“, „Normal“, „Hard“). */
  readonly difficulty: string;
  /** KI-Stärke der Oberfläche (`aiDifficulty`). */
  readonly aiDifficulty: string;
  /** Gewünschte Zahl der KI (`aiAirlinesCount`, Nachrücken 7.7). */
  readonly aiAirlinesCount: number;

  readonly capital: number;
  readonly monthlyCapex: readonly CapexItem[];
  /** Neues Feld (4.2c): Werte des Kassenbuchs am Monatsanfang; fehlt bei alten Spielständen. */
  readonly ledgerValues?: LedgerValues | null;
  /** Neues Feld (F57): Monatsenden in Folge über der Kreditlinie (8.14); fehlt = 0. */
  readonly overdrawnMonths?: number;

  readonly fleet: readonly OwnedAircraft[];
  readonly routes: readonly SimulatedRoute[];
  readonly airportManagement: Readonly<Record<string, AirportInfrastructure>>;

  readonly reputation: number;
  readonly profitStreak: number;
  readonly staff: Staff;
  readonly marketing: Marketing;
  readonly eventChoices: Readonly<Record<string, string>>;

  readonly career: Career;
  readonly milestones: readonly string[];
  readonly annualGoal: AppGoal | null;
  readonly scenario: AppScenario | null;
  readonly reportHistory: readonly MonthlyReport[];

  /** Alte Ansicht der KI; nur gelesen, solange `rivals` fehlt (alter Spielstand). */
  readonly aiAirlines: readonly AiAirline[];
  /** Neues Feld (4.2d): KI im Format des Modells. */
  readonly rivals?: readonly RivalRecord[] | null;
  /** Neues Feld (4.2d): Welt-Zustand des Modells. */
  readonly modelWorld?: WorldState | null;
  /** Ansicht der Zufallsereignisse; nur gelesen, solange `modelWorld` fehlt. */
  readonly randomEvents: readonly HistoricalEvent[];
  /** Ansicht der Störungen des Spielers; die Charter-Antworten kommen von hier ins Modell. */
  readonly disruptions: readonly AppDisruption[];
}

/** Welt-Daten, die sich im Spiel nicht ändern (einmal gebaut). */
export interface ModelEnv {
  readonly airports: Readonly<Record<string, ModelAirport>>;
  readonly catalog: readonly Aircraft[];
}

let defaultEnvCache: ModelEnv | undefined;

/** Alle Flughäfen und der ganze Typen-Katalog des Spiels. */
export function defaultModelEnv(): ModelEnv {
  defaultEnvCache ??= { airports: modelAirports(), catalog: aircraftList };
  return defaultEnvCache;
}

/**
 * Drehkreuze des Spielers für Umsteige-Verbindungen (3.13, F57): das Heimat-Drehkreuz und jeder Flughafen mit
 * Verwaltungsstufe 2 oder 3 (wie `countHubs`, `src/lib/airlineRank.ts:212`). Sortiert, ohne Doppelte.
 */
export function playerHubs(selectedHub: string, airportManagement: Readonly<Record<string, Pick<AirportInfrastructure, 'level'>>>): string[] {
  const hubs = new Set<string>();
  if (selectedHub) hubs.add(selectedHub);
  for (const [id, infra] of Object.entries(airportManagement)) if ((infra?.level ?? 0) >= 2) hubs.add(id);
  return [...hubs].sort();
}

/** KI-Stärke der Oberfläche → Modell; Unbekanntes gilt als „normal“. */
export function rivalStrength(aiDifficulty: string): RivalStrength {
  try {
    return rivalStrengthOf(aiDifficulty);
  } catch {
    return 'normal';
  }
}

/**
 * Wert von Flugzeugen der Flotte im Monat `month` nach dem Wertmodell (5.13). Für die Wertänderung durch Geschäfte im
 * Kassenbuch (`withTradeValue`, F55): Kauf + Wert, Verkauf − Wert, Umbau und Überholung Wert nachher − vorher.
 */
export function planesValue(planes: readonly OwnedAircraft[], month: number, catalog: readonly Aircraft[] = aircraftList): number {
  return fleetValue(planes.map((p) => aircraftState(p, catalog)), month);
}

/** Der Spielstand als Modell: `ModelState` des Monats X, die KI und der Welt-Zustand, wie gelesen. */
export interface ModelGame {
  readonly state: ModelState;
  readonly rivals: readonly RivalRecord[];
  readonly world: WorldState;
}

/** Der Spieler als `CompanyState` im Monat `g.month`. */
export function playerCompany(g: AppGame, env: ModelEnv = defaultModelEnv()): CompanyState {
  const month = g.month;
  const ctx: RouteContext = { month, startMonth: g.startMonth, airports: env.airports };
  const ops = modelOperations({ fleet: g.fleet, routes: g.routes, airportManagement: g.airportManagement }, ctx, env.catalog);
  const preorders = g.career.orders.map((o) => preorderState(o, env.catalog));
  return {
    id: PLAYER_ID,
    cash: g.capital,
    reputation: g.reputation,
    inputs: companyInputs({ research: g.career.research, staff: g.staff, marketing: g.marketing, difficulty: g.difficulty, eventChoices: g.eventChoices }, month),
    aircraft: ops.aircraft,
    routes: ops.routes,
    airports: ops.airports,
    preorders,
    overdrawnMonths: g.overdrawnMonths ?? 0,
    profitStreak: g.profitStreak,
    ledger: monthLedger(g.capital, g.monthlyCapex, g.ledgerValues ?? undefined, month, { aircraft: ops.aircraft, preorders }),
    reports: historyReports(g.reportHistory, PLAYER_ID, month).slice(-REPORT_HISTORY_MONTHS),
    hubs: playerHubs(g.selectedHub, g.airportManagement),
    progress: companyProgress(
      { career: g.career, milestones: g.milestones, annualGoal: g.annualGoal, scenario: g.scenario, startMonth: g.startMonth, reports: g.reportHistory },
      month,
    ),
  };
}

/**
 * Der ganze Spielstand als `ModelState` des Monats X: Spieler zuerst, dann die KI (gespeichert oder aus den alten
 * `AiAirline` umgewandelt), Welt-Zustand (gespeichert oder aus dem alten Spielstand) mit den Charter-Antworten des
 * Spielers aus der Ansicht `disruptions`.
 */
export function modelGame(g: AppGame, env: ModelEnv = defaultModelEnv()): ModelGame {
  const rivals = modelRivals({ rivals: g.rivals, aiAirlines: g.aiAirlines }, { month: g.month, airports: env.airports, catalog: env.catalog });
  const read = modelWorld(
    { world: g.modelWorld, randomEvents: g.randomEvents, disruptions: g.disruptions, staff: g.staff, airlineCode: g.airlineCode, startMonth: g.startMonth },
    g.month,
  );
  const disruptions = applyDisruptionAnswers(read.disruptions, g.disruptions);
  const world: WorldState = disruptions === read.disruptions ? read : { ...read, disruptions };
  const state: ModelState = {
    month: g.month,
    seed: world.seed,
    randomEvents: world.randomEvents,
    disruptions: world.disruptions,
    badLuck: world.badLuck,
    resold: world.resold,
    airports: env.airports,
    companies: [playerCompany(g, env), ...rivals.map((r) => r.company)],
    catalog: env.catalog.map(catalogType),
  };
  return { state, rivals, world };
}

/** Alle Felder der Oberfläche nach dem Abschluss (Monat X+1), mit Bericht und Meldungen. */
export interface AppMonth {
  /** Neuer Monat X+1 (`currentDateOffset`). */
  readonly month: number;
  readonly capital: number;
  /** Nach dem Abschluss leer (8.0 Schritt 8). */
  readonly monthlyCapex: readonly CapexItem[];
  readonly ledgerValues: LedgerValues | undefined;
  readonly overdrawnMonths: number;
  /** Flotte mit den Lieferungen dieses Abschlusses. */
  readonly fleet: readonly OwnedAircraft[];
  readonly routes: readonly SimulatedRoute[];
  readonly airportManagement: Readonly<Record<string, AirportInfrastructure>>;
  readonly reputation: number;
  readonly profitStreak: number;
  readonly staff: Staff;
  readonly marketing: Marketing;
  readonly career: Career;
  readonly milestones: readonly string[];
  readonly annualGoal: AppGoal | null;
  readonly scenario: AppScenario | null;
  /** Bericht X im Format der Oberfläche (bis 4.7). */
  readonly report: MonthlyReport;
  /** Berichte mit dem neuen, höchstens `REPORT_HISTORY_MONTHS`. */
  readonly reportHistory: readonly MonthlyReport[];
  readonly rivals: readonly RivalRecord[];
  /** Ansicht der KI für Karte und Konkurrenz-Ansicht (bis 4.7). */
  readonly aiAirlines: readonly AiAirline[];
  readonly modelWorld: WorldState;
  readonly randomEvents: readonly HistoricalEvent[];
  readonly disruptions: readonly AppDisruption[];
  /** Spielende des Spielers (8.14). */
  readonly bankrupt: boolean;
  /** Unternehmenswert des Spielers nach dem Abschluss (6.12, E48: Kasse, Flugzeuge, Slots, Anzahlungen), im Monat X+1. */
  readonly companyValue: number;
  /** Nachrichten für den Posteingang, neueste zuerst. */
  readonly messages: readonly GameMessage[];
  /** Was das Modell gerechnet hat: Bericht des Spielers, alle Meldungen, Prüf-Fehler (8.16). */
  readonly modelReport: MonthReport;
  readonly news: readonly CloseNews[];
  readonly log: readonly string[];
  /** Neue Kennungen gelieferter Flugzeuge (Modell → Kennzeichen). */
  readonly renamed: Readonly<Record<string, string>>;
  /** Vogelschläge des Spielers im Monat X (8.6) mit Reparatur-Kosten, für den Hinweis der Oberfläche. */
  readonly birdStrikes: readonly { readonly registration: string; readonly cost: number }[];
}

/** Texte, die nur die Oberfläche kennt (F58): Jahresziel aus `describeGoal`, Szenario mit Titel und Sternen. */
export interface NewsTexts {
  /** Beschreibung des Jahresziels, das dieser Abschluss abrechnet. */
  readonly goal?: string;
  /** Titel des laufenden Szenarios und Sterne, falls es in diesem Abschluss gewonnen wird. */
  readonly scenario?: { readonly title: string; readonly stars: number };
  /** Arten, die die Oberfläche selbst meldet (z. B. `randomEvent` mit der Ereignis-Meldung der Oberfläche). */
  readonly skipKinds?: readonly CloseNews['kind'][];
}

/**
 * Ein Monat über das Modell: `closeMonth(state, rivalDecisions, rivalRefill(...))` und alles zurück in die Felder der
 * Oberfläche. Lieferungen bekommen Kennzeichen am Heimat-Drehkreuz; Defekte des neuen Monats zeigen auf diese.
 * `newId` vergibt die Kennungen der Nachrichten (Standard `nextMessageId`).
 */
export function runModelMonth(
  g: AppGame,
  env: ModelEnv = defaultModelEnv(),
  newId: () => number = nextMessageId,
  texts: NewsTexts = {},
): AppMonth {
  const before = modelGame(g, env);
  const result = closeMonth(before.state, rivalDecisions, rivalRefill({ wanted: g.aiAirlinesCount, strength: rivalStrength(g.aiDifficulty) }));
  const next = result.state;
  const player = next.companies.find((c) => c.id === PLAYER_ID);
  if (!player) throw new Error('Der Spieler fehlt im Spielstand nach dem Abschluss');
  const modelReport = result.reports[PLAYER_ID];

  // Betrieb (Teil 1) und Lieferungen (Teil 2): Preise als $ des neuen Monats.
  const ctx1: RouteContext = { month: next.month, startMonth: g.startMonth, airports: env.airports };
  const ops = applyModelOperations({ fleet: g.fleet, routes: g.routes, airportManagement: g.airportManagement }, player, ctx1);
  const delivered = deliveredAircraft(ops.newAircraft, {
    hub: g.selectedHub,
    existingRegistrations: ops.fleet.map((p) => p.registration),
    catalog: env.catalog,
  });
  const fleet = delivered.planes.length > 0 ? [...ops.fleet, ...delivered.planes] : ops.fleet;

  // Kasse, Eingaben, Fortschritt (Teil 2).
  const ledger = applyLedger(
    { capital: g.capital, monthlyCapex: g.monthlyCapex, ledgerValues: g.ledgerValues ?? undefined },
    player.cash,
    player.ledger,
    next.month,
    { aircraft: player.aircraft, preorders: player.preorders },
  );
  const inputs = applyCompanyInputs({ staff: g.staff, marketing: g.marketing }, player.inputs, next.month);
  const progressSrc = { career: g.career, milestones: g.milestones, annualGoal: g.annualGoal, scenario: g.scenario, startMonth: g.startMonth, reports: g.reportHistory };
  const progress = player.progress
    ? applyCompanyProgress(progressSrc, player.progress, g.month)
    : { career: g.career, milestones: g.milestones, annualGoal: g.annualGoal, scenario: g.scenario };
  const orders = applyPreorders(g.career.orders, player.preorders);
  const career = orders === g.career.orders ? progress.career : { ...progress.career, orders: [...orders] };

  const report = appReport(modelReport, {
    routes: g.routes,
    airports: env.airports,
    morale: player.inputs.morale,
    fleetSize: fleet.length,
    routeCount: ops.routes.length,
    capex: g.monthlyCapex,
  });

  // KI und Welt (Teil 3).
  const rivals = applyModelRivals(before.rivals, next.companies, { seed: next.seed, month: next.month, playerCode: g.airlineCode, playerColor: g.brandingColor });
  const aiAirlines = rivalViews(rivals, { month: next.month, airports: env.airports, catalog: env.catalog });
  const world = applyModelWorld(
    next,
    { world: before.world, randomEvents: g.randomEvents, disruptions: g.disruptions },
    { routes: ops.routes, airports: env.airports, renamed: delivered.renamed },
  );

  const messages = closeNewsMessages(result.news, {
    month: g.month,
    before: before.state,
    after: next,
    rivals: [...before.rivals, ...rivals],
    playerAirports: playerAirportIds(g.airportManagement, g.routes),
    orders: g.career.orders,
    catalog: env.catalog,
    renamed: delivered.renamed,
    newId,
    texts,
  });

  const planesBefore = before.state.companies.find((c) => c.id === PLAYER_ID)?.aircraft ?? [];
  const birdStrikes = (modelReport?.birdStrikes ?? []).flatMap((id) => {
    const p = planesBefore.find((x) => x.id === id);
    return p ? [{ registration: id, cost: birdStrikeCost(p.listPrice1960, g.month) }] : [];
  });

  return {
    month: next.month,
    capital: ledger.capital,
    monthlyCapex: ledger.monthlyCapex,
    ledgerValues: ledger.ledgerValues,
    overdrawnMonths: player.overdrawnMonths,
    fleet,
    routes: ops.routes,
    airportManagement: ops.airportManagement,
    reputation: player.reputation,
    profitStreak: player.profitStreak,
    staff: inputs.staff,
    marketing: inputs.marketing,
    career,
    milestones: progress.milestones,
    annualGoal: progress.annualGoal,
    scenario: progress.scenario,
    report,
    reportHistory: [...g.reportHistory, report].slice(-REPORT_HISTORY_MONTHS),
    rivals,
    aiAirlines,
    modelWorld: world.world,
    randomEvents: world.randomEvents,
    disruptions: world.disruptions,
    bankrupt: result.bankrupt.includes(PLAYER_ID),
    companyValue: companyValue(companyValueOf(player, next.month)),
    messages,
    modelReport,
    news: result.news,
    log: result.log,
    renamed: delivered.renamed,
    birdStrikes,
  };
}

// ===========================================================================
// Meldungen (CloseNews → Posteingang)
// ===========================================================================

/** Flughäfen des Spielers: verwaltete und Enden seiner Strecken (KI-Meldungen 7.17). */
export function playerAirportIds(
  airportManagement: Readonly<Record<string, unknown>>,
  routes: readonly Pick<SimulatedRoute, 'origin' | 'destination'>[],
): Set<string> {
  const ids = new Set(Object.keys(airportManagement));
  for (const r of routes) {
    ids.add(r.origin);
    ids.add(r.destination);
  }
  return ids;
}

/** Was die Texte der Meldungen brauchen. */
export interface NewsContext {
  /** Monat des Abschlusses X (Datum der Nachricht). */
  readonly month: number;
  /** Spielstand vor und nach dem Abschluss (Strecken und Flugzeuge der KI, auch gestrichene). */
  readonly before: Pick<ModelState, 'companies'>;
  readonly after: Pick<ModelState, 'companies'>;
  /** KI mit Name und Kürzel (vor und nach dem Abschluss). */
  readonly rivals: readonly RivalRecord[];
  /** Flughäfen des Spielers (`playerAirportIds`). */
  readonly playerAirports: ReadonlySet<string>;
  /** Bestellungen vor dem Abschluss (Typ einer Lieferung). */
  readonly orders: readonly Career['orders'][number][];
  readonly catalog: readonly Aircraft[];
  /** Modell-Kennung → Kennzeichen gelieferter Flugzeuge. */
  readonly renamed?: Readonly<Record<string, string>>;
  readonly newId: () => number;
  /** Texte der Oberfläche (Jahresziel, Szenario). */
  readonly texts?: NewsTexts;
}

/** Datum einer Nachricht wie im alten Abschluss: `MM/JJJJ`. */
const dateStr = (month: number) => `${String((month % 12) + 1).padStart(2, '0')}/${yearOf(month)}`;

/** Art der KI-Meldung für die Regel „nur, wenn ein Flughafen des Spielers betroffen ist“ (7.17); `null` = nicht zeigen. */
const RIVAL_NEWS: Partial<Record<CloseNews['kind'], RivalNewsKind>> = {
  priceWarStarted: 'priceWar',
  scheduleCut: 'scheduleCut',
  routeClosed: 'routeClosed',
  newHub: 'newHub',
  forSale: 'forSale',
  recovered: 'recovered',
  liquidated: 'liquidated',
  modernized: 'modernized',
  newRival: 'newRival',
};

const PLAYER_KINDS: ReadonlySet<CloseNews['kind']> = new Set([
  'delivery', 'deliveryDelayed', 'preorderCancelled', 'forcedSale', 'bankrupt', 'milestone', 'rankUp', 'goalMet',
  'goalMissed', 'goalOffered', 'researchDone', 'scenarioWon', 'scenarioLost', 'staffStrike',
]);

/**
 * Nachrichten aus den Meldungen des Abschlusses (Texte Englisch, E52: Zahlen aus den Daten des Modells). Meldungen des
 * Spielers immer; Zufallsereignis immer; KI-Meldungen nach `showRivalNews` (7.17), andere KI-Meldungen (Käufe,
 * Eröffnungen, Dividende …) nicht. Reihenfolge wie die Meldungen, neueste zuerst im Posteingang.
 */
export function closeNewsMessages(news: readonly CloseNews[], ctx: NewsContext): GameMessage[] {
  const out: GameMessage[] = [];
  const push = (text: string, details?: GameMessage['details']) =>
    out.push({ id: ctx.newId(), text, isRead: false, dateStr: dateStr(ctx.month), ...(details ? { details } : {}) });
  for (const n of news) {
    if (ctx.texts?.skipKinds?.includes(n.kind)) continue;
    if (n.companyId === PLAYER_ID && PLAYER_KINDS.has(n.kind)) {
      const msg = playerNewsText(n, ctx);
      if (msg) push(msg.text, msg.details);
    } else if (n.kind === 'randomEvent' && n.subject) {
      push(`WORLD EVENT: ${n.subject}.`);
    } else {
      const kind = RIVAL_NEWS[n.kind];
      if (!kind) continue;
      if (!showRivalNews(kind, rivalNewsTouchesPlayer(n, ctx))) continue;
      const text = rivalNewsText(n, ctx);
      if (text) push(text);
    }
  }
  return out.reverse();
}

const companyOf = (id: string, ctx: Pick<NewsContext, 'before' | 'after'>): CompanyState | undefined =>
  ctx.after.companies.find((c) => c.id === id) ?? ctx.before.companies.find((c) => c.id === id);

const routeOf = (companyId: string, routeId: string | undefined, ctx: Pick<NewsContext, 'before' | 'after'>) => {
  if (!routeId) return undefined;
  for (const s of [ctx.after, ctx.before]) {
    const r = s.companies.find((c) => c.id === companyId)?.routes.find((x) => x.id === routeId);
    if (r) return r;
  }
  return undefined;
};

/** Berührt eine KI-Meldung einen Flughafen des Spielers (Strecken-Enden, Drehkreuz)? */
function rivalNewsTouchesPlayer(n: CloseNews, ctx: NewsContext): boolean {
  if (n.kind === 'newHub' || n.kind === 'newRival') return n.subject !== undefined && ctx.playerAirports.has(n.subject);
  const r = routeOf(n.companyId, n.subject, ctx);
  return r !== undefined && (ctx.playerAirports.has(r.from) || ctx.playerAirports.has(r.to));
}

function rivalName(id: string, ctx: NewsContext): { name: string; code: string } {
  const rec = ctx.rivals.find((r) => r.company.id === id);
  return rec ? { name: rec.name, code: rec.code } : { name: id, code: id };
}

function rivalNewsText(n: CloseNews, ctx: NewsContext): string | undefined {
  const { name, code } = rivalName(n.companyId, ctx);
  const route = routeOf(n.companyId, n.subject, ctx);
  const pair = route ? `${route.from}-${route.to}` : 'a route';
  switch (n.kind) {
    case 'priceWarStarted':
      return `PRICE WAR: ${name} cuts its fares on ${pair}.`;
    case 'scheduleCut':
      return `${name} flies less on ${pair}.`;
    case 'routeClosed':
      return `${name} gives up ${pair}.`;
    case 'newHub':
      return `${name} opens a new hub at ${n.subject}.`;
    case 'forSale':
      return `${name} is in distress and up for sale.`;
    case 'recovered':
      return `${name} has recovered and is no longer for sale.`;
    case 'liquidated':
      return `${name} has been wound up.`;
    case 'modernized': {
      const reg = n.subject ? rivalRegistration({ id: n.companyId }, code, n.subject) : 'an aircraft';
      return `${name} replaces ${reg} with a newer type.`;
    }
    case 'newRival': {
      const company = companyOf(n.companyId, ctx);
      const hub = n.subject ?? company?.hubs?.[0] ?? '';
      return `NEW RIVAL: ${name} (${code}) starts flying from ${hub}.`;
    }
    default:
      return undefined;
  }
}

function typeName(typeId: string | undefined, catalog: readonly Aircraft[]): string {
  const t = typeId ? catalog.find((a) => a.id === typeId) : undefined;
  return t ? `${t.manufacturer} ${t.type}` : 'aircraft';
}

function playerNewsText(n: CloseNews, ctx: NewsContext): { text: string; details?: GameMessage['details'] } | undefined {
  const money = (v: number | undefined) => formatCurrency(v ?? 0);
  const order = n.subject ? ctx.orders.find((o) => o.id === n.subject) : undefined;
  switch (n.kind) {
    case 'delivery': {
      const name = typeName(order?.aircraftId, ctx.catalog);
      const count = order?.quantity ?? 1;
      return {
        text: `DELIVERY: ${count} × ${name} have arrived.`,
        details: {
          title: 'Aircraft delivered',
          source: 'Manufacturer',
          content: `${count} × ${name} joined your fleet with the standard economy cabin. The balance of ${money(n.amount)} was paid on delivery.`,
        },
      };
    }
    case 'deliveryDelayed':
      return { text: `DELIVERY DELAYED: ${typeName(order?.aircraftId, ctx.catalog)} slips a month; the balance could not be paid.` };
    case 'preorderCancelled':
      return { text: `ORDER CANCELLED: the order of ${typeName(order?.aircraftId, ctx.catalog)} was cancelled; the deposit of ${money(n.amount)} is lost.` };
    case 'forcedSale': {
      const reg = (n.subject && ctx.renamed?.[n.subject]) || n.subject || 'an aircraft';
      return {
        text: `FORCED SALE: ${reg} sold for ${money(n.amount)}.`,
        details: {
          title: 'Forced sale',
          source: 'Bank',
          content: `Your cash stayed below the credit line for too long. The bank sold ${reg} for ${money(n.amount)}.`,
        },
      };
    }
    case 'bankrupt':
      return {
        text: 'BANKRUPT: the airline has no aircraft left and cannot pay its debts.',
        details: { title: 'Bankruptcy', source: 'Bank', content: 'The credit line is used up and no aircraft are left to sell. The airline is bankrupt.' },
      };
    case 'milestone': {
      const def = MILESTONES.find((m) => m.id === n.subject);
      const title = def?.title ?? n.subject ?? 'Milestone';
      return {
        text: `MILESTONE: ${title}`,
        details: { title, source: 'Board of Directors', content: `Reward: ${money(n.amount)}.` },
      };
    }
    case 'rankUp': {
      const def = RANKS[n.amount ?? -1];
      return def ? { text: `RANK: your airline is now a ${def.title}.` } : undefined;
    }
    case 'goalMet': {
      const goal = ctx.texts?.goal;
      return {
        text: `GOAL MET: ${goal ? `${goal}. ` : ''}The board pays a bonus of ${money(n.amount)}.`,
        ...(goal ? { details: { title: `${yearOf(ctx.month)} annual result`, source: 'Board of Directors', content: `Goal for ${yearOf(ctx.month)}: ${goal}\n\nThe board is satisfied and pays a bonus of ${money(n.amount)}.` } } : {}),
      };
    }
    case 'goalMissed': {
      const goal = ctx.texts?.goal;
      const charge = money(Math.abs(n.amount ?? 0));
      return {
        text: `GOAL MISSED: ${goal ? `${goal}. ` : ''}The board charges ${charge}.`,
        ...(goal ? { details: { title: `${yearOf(ctx.month)} annual result`, source: 'Board of Directors', content: `Goal for ${yearOf(ctx.month)}: ${goal}\n\nThe board expected more and charges ${charge}, half the bonus.` } } : {}),
      };
    }
    case 'goalOffered':
      return { text: `GOALS FOR ${yearOf(ctx.month) + 1}: the board asks you to choose one.` };
    case 'researchDone': {
      const p = RESEARCH_PROJECTS.find((x) => x.id === n.subject);
      return { text: `DEVELOPMENT: "${p?.title ?? n.subject}" is complete.` };
    }
    case 'scenarioWon': {
      const sc = ctx.texts?.scenario;
      if (!sc) return { text: 'SCENARIO WON.' };
      const stars = Math.max(0, Math.min(3, sc.stars));
      return { text: `SCENARIO WON: ${sc.title} (${'\u2605'.repeat(stars)}${'\u2606'.repeat(3 - stars)}).` };
    }
    case 'scenarioLost': {
      const sc = ctx.texts?.scenario;
      return { text: sc ? `SCENARIO LOST: ${sc.title}.` : 'SCENARIO LOST.' };
    }
    case 'staffStrike':
      return { text: `STRIKE: your staff walk out in ${dateStr(ctx.month + 1)}.` };
    default:
      return undefined;
  }
}
