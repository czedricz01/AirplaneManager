/**
 * Regeltests zu Paket 3.8c (Monatsabschluss Teil 3): Umsteiger im Abschluss (3.13), KI-Entscheidungen
 * `rivalDecisions` (7.6, 7.8, 7.11, 7.13, 7.15), Übernahme (7.16), Fortschritt im Abschluss (6.7, 6.9–6.11),
 * Szenario-Ziele (8.15) und Planer = Abschluss (R2).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aircraftList } from '../data/aircraft';
import { airportsData } from '../data/airports';
import { costIndex } from './basics';
import { FARE_RATIO_DEFAULT, REPORT_HISTORY_MONTHS, RIVAL_REPORT_MONTHS, WEEKS_PER_MONTH, type WorldRegion } from './constants';
import { aircraftValue } from './fleet';
import { marketFares } from './fare';
import { creditLimit, saleProceeds } from './fleetMarket';
import { distanceKm } from './demand';
import {
  closeMonth,
  fleetValue,
  keptReports,
  monthOperations,
  newLedger,
  NO_DECISIONS,
  plannerRouteResult,
  scenarioFloor,
  scenarioStep,
  servedCityPairs,
  scenarioTarget,
  sellAircraft,
  type AircraftState,
  type CompanyInputs,
  type CompanyProgress,
  type CompanyState,
  type ModelAirport,
  type ModelState,
  type RouteSchedule,
  type RouteState,
  type ScenarioState,
} from './monthClose';
import { milestoneDef, milestonePrize, startingResearch } from './progress';
import { RIVAL_INPUTS } from './rivals';
import { dividendLimit, newRivalAgent, rivalAgentOf, rivalDecisions, takeOverCompany, type RivalAgent } from './rivalMonth';
import { transferFare } from './transfers';

const close = (actual: number, expected: number, tol = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);

const M = (1990 - 1960) * 12; // Januar 1990
const A320 = aircraftList.find((a) => a.id === 'a320ceo')!;

function airport(id: string, region: WorldRegion): ModelAirport {
  const a = airportsData.find((x) => x.id === id);
  if (!a) throw new Error(id);
  return { id, coords: a.coords, stats: a.stats, size: a.level, region };
}
const AIRPORTS = { FRA: airport('FRA', 'EU'), MAD: airport('MAD', 'EU'), CDG: airport('CDG', 'EU') };

const NEUTRAL: CompanyInputs = { ...RIVAL_INPUTS, campaigns: [] };
const PLAYER: CompanyInputs = { ...NEUTRAL, badLuckCap: true, charter: true, staffModel: true, forcedSale: true };

function plane(id: string, builtMonth = M): AircraftState {
  return {
    id,
    typeId: A320.id,
    family: A320.family,
    aircraftClass: 'Narrowbody',
    capacity: A320.capacity,
    cruiseSpeed: A320.cruiseSpeed,
    efficiency: A320.efficiency,
    catalogAppeal: A320.popularity,
    hasWifi: false,
    hasPremiumGalley: false,
    listPrice1960: A320.basePrice,
    builtMonth,
    cabinListPrice1960: 0,
    cabinInstalledMonth: builtMonth,
    airframeCondition: 100,
    cabinCondition: 100,
    seats: { economy: 150, business: 12 },
    interiorScore: { economy: 50, business: 50 },
  };
}

const PEANUTS = { meals: [['b5']], extras: [], onboardService: [] };

function route(id: string, aircraftId: string, from = 'FRA', to = 'MAD', departuresPerWeek = 14, schedule?: RouteSchedule): RouteState {
  return { id, aircraftId, from, to, departuresPerWeek, ageMonths: 24, service: { economy: PEANUTS, business: PEANUTS }, schedule };
}

const HOLDING = { managementTier: 2, slots: { Narrowbody: 30 }, stands: {}, desks: { normal: 4, self: 0 }, facilities: [] };

function company(id: string, inputs: CompanyInputs, opts: Partial<CompanyState> = {}): CompanyState {
  const aircraft = opts.aircraft ?? [plane(`${id}-p1`)];
  const routes = opts.routes ?? [route(`${id}-r1`, aircraft[0].id)];
  const cash = opts.cash ?? 50_000_000;
  return {
    id,
    cash,
    reputation: 50,
    inputs,
    aircraft,
    routes,
    airports: { FRA: HOLDING, MAD: HOLDING, CDG: HOLDING },
    preorders: [],
    overdrawnMonths: 0,
    profitStreak: 0,
    ledger: newLedger(cash, fleetValue(aircraft, M), 0),
    reports: [],
    ...opts,
  };
}

function world(companies: CompanyState[], extra: Partial<ModelState> = {}): ModelState {
  return { month: M, seed: 42, airports: AIRPORTS, randomEvents: [], disruptions: [], badLuck: false, resold: [], companies, ...extra };
}

const companyAfter = (state: ModelState, id: string) => state.companies.find((c) => c.id === id) as CompanyState;
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

/** Tägliche Abflüge zur Minute `minute` (Minuten der Woche). */
const daily = (minute: number) => Array.from({ length: 7 }, (_, d) => d * 1440 + minute);

/**
 * Drehkreuz CDG mit Strecken CDG–MAD und CDG–FRA (Umweg MAD–CDG–FRA ≈ 1,06). Fahrplan: MAD ab 06:00 → CDG,
 * CDG ab 09:30 → FRA; FRA ab 11:00 → CDG, CDG ab 13:30 → MAD.
 */
function hubCompany(id: string, inputs: CompanyInputs, opts: Partial<CompanyState> = {}): CompanyState {
  const aircraft = [plane(`${id}-p1`), plane(`${id}-p2`)];
  return company(id, inputs, {
    aircraft,
    hubs: ['CDG'],
    routes: [
      // Viele Abflüge, damit nach den Direktgästen Sitze frei sind.
      route(`${id}-mad`, aircraft[0].id, 'CDG', 'MAD', 140, { fromDepartures: daily(810), toDepartures: daily(360) }),
      route(`${id}-fra`, aircraft[1].id, 'CDG', 'FRA', 140, { fromDepartures: daily(570), toDepartures: daily(660) }),
    ],
    ...opts,
  });
}

function progress(extra: Partial<CompanyProgress> = {}): CompanyProgress {
  return { startMonth: M - 12, rank: 0, rankHistory: [], research: startingResearch(0), milestones: [], careerPax: 0, takeovers: 0, ...extra };
}

function rival(id: string, agent: Partial<RivalAgent> = {}, opts: Partial<CompanyState> = {}): CompanyState {
  return company(id, NEUTRAL, { agent: { ...newRivalAgent('lcc', 'normal'), ...agent }, ...opts });
}

// ---------------------------------------------------------------------------

describe('Abschnitt 3.13 Umsteiger im Abschluss', () => {
  it('3.13: Umsteiger belegen nie mehr als die freien Sitze; Bericht zählt sie', () => {
    const ops = monthOperations(world([hubCompany('pl', PLAYER)])).pl;
    assert.ok(ops.transferPassengers > 0, 'Umsteiger vorhanden');
    for (const r of ops.routes) {
      for (const c of ['economy', 'business'] as const) {
        assert.ok(r.passengers[c] + r.transferPassengers[c] <= r.offeredSeats[c] + 1e-9, `${r.routeId} ${c}`);
      }
    }
    // Jede Reise belegt zwei Teilstrecken.
    const legs = sum(ops.routes.map((r) => r.transferPassengers.economy + r.transferPassengers.business)) * WEEKS_PER_MONTH;
    close(legs, 2 * ops.transferPassengers);
    const report = closeMonth(world([hubCompany('pl', PLAYER)]), NO_DECISIONS).reports.pl;
    close(report.transferPassengers, ops.transferPassengers);
  });

  it('4.8: Erlös der Umsteiger auf beiden Teilstrecken = Reisen × transferFare des Paars O–D', () => {
    const s = world([hubCompany('pl', PLAYER)]);
    const ops = monthOperations(s).pl;
    const od = marketFares(distanceKm(AIRPORTS.MAD.coords, AIRPORTS.FRA.coords), M);
    let transferRevenue = 0;
    for (const r of ops.routes) {
      const direct = sum((['economy', 'premium', 'business', 'first'] as const).map((c) => r.passengers[c] * r.fares[c]));
      transferRevenue += r.revenue - direct;
    }
    // Je Klasse: Reisen = Umsteiger einer Teilstrecke (beide Teilstrecken gleich).
    const trips = (c: 'economy' | 'business') => ops.routes[0].transferPassengers[c];
    close(ops.routes[0].transferPassengers.economy, ops.routes[1].transferPassengers.economy, 1e-9);
    close(transferRevenue, trips('economy') * transferFare(od.economy) + trips('business') * transferFare(od.business), 1e-9);
  });

  it('3.13: ohne Fahrplan oder mit Direktflug O–D keine Verbindung; Direktgäste haben Vorrang', () => {
    const noSchedule = hubCompany('pl', PLAYER);
    const plain = { ...noSchedule, routes: noSchedule.routes.map((r) => ({ ...r, schedule: undefined })) };
    assert.equal(monthOperations(world([plain])).pl.transferPassengers, 0);

    const withDirect = hubCompany('pl', PLAYER);
    const third = plane('pl-p3');
    const direct = { ...withDirect, aircraft: [...withDirect.aircraft, third], routes: [...withDirect.routes, route('pl-direct', third.id, 'MAD', 'FRA')] };
    assert.equal(monthOperations(world([direct])).pl.transferPassengers, 0);

    // Direktgäste der Teilstrecken sind mit und ohne Umsteiger gleich.
    const a = monthOperations(world([plain])).pl.routes;
    const b = monthOperations(world([hubCompany('pl', PLAYER)])).pl.routes;
    for (let i = 0; i < a.length; i++) assert.deepEqual(a[i].passengers, b[i].passengers);
  });
});

describe('Abschnitt 4.12 / R2 Planer = Abschluss', () => {
  it('R2: Planer-Hauptzahl beim heutigen Plan = Strecken-Ergebnis × Wochen im Abschluss (ohne Störungen)', () => {
    const s = world([company('pl', PLAYER), rival('ai')]);
    const ops = monthOperations(s);
    close(plannerRouteResult(s, 'pl', 'pl-r1', 14), ops.pl.routes[0].result * WEEKS_PER_MONTH, 1e-9);
    close(plannerRouteResult(s, 'ai', 'ai-r1', 14), ops.ai.routes[0].result * WEEKS_PER_MONTH, 1e-9);
    // Mehr Abflüge, andere Zahl.
    assert.notEqual(plannerRouteResult(s, 'pl', 'pl-r1', 28), ops.pl.routes[0].result * WEEKS_PER_MONTH);
  });
});

describe('Abschnitt 7.8 KI-Entscheidungen im Abschluss', () => {
  it('7.8: eine Gesellschaft ohne KI-Zustand bleibt unverändert', () => {
    const s = world([company('pl', PLAYER)]);
    assert.deepEqual(closeMonth(s, rivalDecisions), closeMonth(s, NO_DECISIONS));
  });

  it('7.8: Entscheidungen ändern keine Zahl des Monats X; die Buchung hängt nicht von der Reihenfolge der KI ab', () => {
    const a = rival('a', {}, { cash: 900_000_000 });
    const b = rival('b', { personality: 'optimizer' }, { routes: [route('b-r1', 'b-p1', 'FRA', 'MAD', 28)] });
    const pl = company('pl', PLAYER);
    const plain = closeMonth(world([pl, a, b]), NO_DECISIONS);
    const one = closeMonth(world([pl, a, b]), rivalDecisions);
    const two = closeMonth(world([b, a, pl]), rivalDecisions);
    for (const id of ['pl', 'a', 'b']) {
      assert.equal(one.reports[id].revenue, plain.reports[id].revenue);
      assert.deepEqual(one.reports[id].costs, plain.reports[id].costs);
      assert.equal(one.reports[id].result, plain.reports[id].result);
      assert.deepEqual(one.reports[id].reputation, plain.reports[id].reputation);
      assert.deepEqual(one.reports[id], two.reports[id]);
    }
  });

  it('7.6 / 4.5: die KI setzt Preise für X+1; der laufende Monat rechnet mit den alten', () => {
    const s = world([company('pl', PLAYER), rival('ai', { personality: 'optimizer' })]);
    const result = closeMonth(s, rivalDecisions);
    const after = companyAfter(result.state, 'ai').routes[0];
    assert.ok(after.fareRatios && after.fareRatios.economy !== undefined);
    assert.equal(after.nextFareRatios, undefined);
    assert.equal(result.reports.ai.revenue, closeMonth(s, NO_DECISIONS).reports.ai.revenue);
    // Vorher galt das Standard-Niveau.
    assert.equal(s.companies[1].routes[0].fareRatios?.economy ?? FARE_RATIO_DEFAULT, FARE_RATIO_DEFAULT);
  });

  it('7.13: die Dividende ändert weder Ergebnis noch Ruf; Kasse danach ≤ Grenze; Kassen-Gleichung gilt', () => {
    const s = world([rival('ai', {}, { cash: 2_000_000_000 })]);
    const plain = closeMonth(s, NO_DECISIONS).reports.ai;
    const result = closeMonth(s, rivalDecisions);
    const r = result.reports.ai;
    assert.equal(r.result, plain.result);
    assert.deepEqual(r.reputation, plain.reputation);
    assert.ok(r.decisionsCash < 0);
    assert.ok(result.news.some((n) => n.companyId === 'ai' && n.kind === 'dividend'));
    const agent = rivalAgentOf(companyAfter(result.state, 'ai')) as RivalAgent;
    assert.ok(r.cashEnd <= dividendLimit(M, agent.costHistory) + 1e-6);
    close(
      r.cashEnd - r.cashStart,
      r.result - (r.fleetValueEnd - r.decisionsValueChange - r.fleetValueStart) + r.decisionsCash,
      1e-9,
    );
  });

  it('7.11: Leerlauf-Verkauf nach 6 Monaten; Erlös KI = Erlös Spieler; Flugzeug im Gebrauchtmarkt', () => {
    const idle = plane('ai-idle', M - 120);
    const ai = rival('ai', { idleMonths: { 'ai-idle': 5 } }, { aircraft: [plane('ai-p1'), idle] });
    const result = closeMonth(world([ai]), rivalDecisions);
    assert.ok(!companyAfter(result.state, 'ai').aircraft.some((p) => p.id === 'ai-idle'));
    assert.ok(result.state.resold.some((p) => p.id === 'ai-idle'));
    const sale = result.news.find((n) => n.kind === 'planeSold' && n.subject === 'ai-idle');
    // Wert am Monatsende nach dem Verschleiß des Monats.
    const worn = companyAfter(closeMonth(world([ai]), NO_DECISIONS).state, 'ai').aircraft.find((p) => p.id === 'ai-idle') as AircraftState;
    close(sale?.amount as number, saleProceeds(aircraftValue(worn, M + 1)), 1e-12);
    // Derselbe Erlös für den Spieler (gleiches Flugzeug, gleicher Monat).
    const player = sellAircraft(company('pl', PLAYER, { aircraft: [plane('pl-p1'), worn] }), 'ai-idle', M + 1);
    close(player.company.ledger.saleProceeds, sale?.amount as number, 1e-12);
    // Der Verkauf wirkt ab X+1: nicht im Ergebnis von X.
    assert.equal(result.reports.ai.result, closeMonth(world([ai]), NO_DECISIONS).reports.ai.result);
  });

  it('7.15: Auflösung: alle Flugzeuge im Gebrauchtmarkt, keine Strecken und Slots mehr; danach keine Entscheidungen', () => {
    const ai = rival('ai', { distress: { status: 'forSale', distressMonths: 20, forSaleMonths: 11 } }, { cash: -900_000_000, ledger: newLedger(-900_000_000, fleetValue([plane('ai-p1')], M), 0) });
    const result = closeMonth(world([company('pl', PLAYER), ai]), rivalDecisions);
    const after = companyAfter(result.state, 'ai');
    assert.equal(after.aircraft.length, 0);
    assert.equal(after.routes.length, 0);
    assert.deepEqual(after.airports, {});
    assert.ok(result.state.resold.some((p) => p.id === 'ai-p1'));
    assert.equal(rivalAgentOf(after)?.distress.status, 'liquidated');
    assert.ok(result.news.some((n) => n.companyId === 'ai' && n.kind === 'liquidated'));
    // Der nächste Monat: keine Strecke, kein Angebot im Markt, keine Entscheidungen.
    const next = closeMonth(result.state, rivalDecisions);
    assert.equal(next.reports.ai.revenue, 0);
    assert.deepEqual(companyAfter(next.state, 'ai').agent, after.agent);
  });
});

describe('Abschnitt 7.16 Übernahme', () => {
  it('7.16: Kasse danach = vorher − Preis + KI-Kasse; Flugzeuge und Slots je Flughafen beim Käufer; KI weg', () => {
    const ai = rival('ai', {}, { cash: 3_000_000, hubs: ['MAD'] });
    const pl = company('pl', PLAYER, { cash: 500_000_000, progress: progress() });
    const s = world([pl, ai]);
    const after = takeOverCompany(s, 'pl', 'ai');
    const buyer = companyAfter(after, 'pl');
    assert.equal(after.companies.length, 1);
    assert.equal(buyer.aircraft.length, 2);
    assert.equal(buyer.routes.length, 1);
    assert.equal(buyer.airports.MAD.slots.Narrowbody, 60);
    assert.equal(buyer.airports.MAD.managementTier, 2);
    assert.equal(buyer.progress?.takeovers, 1);
    const price = pl.cash + ai.cash - buyer.cash;
    assert.ok(price >= aircraftValue(ai.aircraft[0], M) + ai.cash);
  });

  it('7.16: die Übernahme ändert das Monatsergebnis nicht (Kauf zum Wert; Rest ohne Ergebnis-Wirkung)', () => {
    // KI ohne Flugzeuge und Slots auf einem anderen Paar: Ergebnis des Käufers genau gleich.
    const ai = rival('ai', {}, { cash: 7_000_000, aircraft: [], routes: [], airports: {} });
    const pl = company('pl', PLAYER, { cash: 500_000_000 });
    const plain = closeMonth(world([pl, ai]), NO_DECISIONS).reports.pl;
    const taken = closeMonth(takeOverCompany(world([pl, ai]), 'pl', 'ai'), NO_DECISIONS).reports.pl;
    assert.equal(taken.result, plain.result);
    // Mit Flugzeug: „Aircraft trades“ unverändert (Kauf zum Wert), Kassen-Gleichung gilt.
    const ai2 = rival('ai', {}, { cash: 7_000_000, routes: [], airports: {} });
    const plain2 = closeMonth(world([pl, ai2]), NO_DECISIONS).reports.pl;
    const r = closeMonth(takeOverCompany(world([pl, ai2]), 'pl', 'ai'), NO_DECISIONS).reports.pl;
    close(r.costs.aircraftTrades, plain2.costs.aircraftTrades, 1e-9);
    const other = sum(Object.values(r.otherSpending));
    close(r.cashEnd - r.cashStart, r.result - (r.fleetValueEnd - r.decisionsValueChange - r.fleetValueStart) - other, 1e-9);
  });
});

describe('Abschnitt 6.7–6.11 Fortschritt im Abschluss', () => {
  it('6.10: Meilenstein-Prämie in die Kasse, nicht ins Ergebnis; kein Ruf; jeder höchstens einmal', () => {
    const s = world([company('pl', PLAYER, { progress: progress() })]);
    const plain = closeMonth(world([company('pl', PLAYER)]), NO_DECISIONS).reports.pl;
    const result = closeMonth(s, NO_DECISIONS);
    const r = result.reports.pl;
    const after = companyAfter(result.state, 'pl');
    assert.ok(after.progress?.milestones.includes('first-route'));
    close(r.milestonePrizes, milestonePrize(milestoneDef('first-route'), M), 1e-12);
    assert.equal(r.result, plain.result);
    assert.deepEqual(r.reputation, plain.reputation);
    close(r.cashEnd, plain.cashEnd + r.milestonePrizes, 1e-12);
    const again = closeMonth(result.state, NO_DECISIONS);
    assert.equal(again.reports.pl.milestonePrizes, 0);
    assert.equal(companyAfter(again.state, 'pl').progress?.milestones.filter((m) => m === 'first-route').length, 1);
  });

  it('6.10 / 8.1: Kassen-Meilensteine prüfen die Kasse nach allen Buchungen ohne die Prämien dieses Abschlusses', () => {
    const s = world([company('pl', PLAYER, { progress: progress(), cash: 10_000_000, ledger: newLedger(10_000_000, fleetValue([plane('pl-p1')], M), 0) })]);
    const result = closeMonth(s, NO_DECISIONS);
    const cashMilestones = companyAfter(result.state, 'pl').progress?.milestones.filter((id) => milestoneDef(id).metric === 'cash') ?? [];
    for (const id of cashMilestones) assert.ok(result.reports.pl.cashEnd - result.reports.pl.milestonePrizes >= 0, id);
  });

  it('6.7: Rang-Werte im Verlauf (höchstens 3 Monate); nie Abstieg', () => {
    let s = world([company('pl', PLAYER, { progress: progress({ rank: 4 }) })]);
    for (let k = 0; k < 4; k++) s = closeMonth(s, NO_DECISIONS).state;
    const p = companyAfter(s, 'pl').progress as CompanyProgress;
    assert.equal(p.rankHistory.length, 3);
    assert.equal(p.rank, 4);
  });

  it('6.11: Dezember: verfehltes Ziel → Kasse − Strafe, Ergebnis gleich; Angebot für das neue Jahr, sicheres gilt', () => {
    const dec = M + 11;
    const goal = { year: 1990, kind: 'profit' as const, tag: 'steady' as const, target: 1e12, reward: 3_000_000, penalty: 1_500_000 };
    const pl = company('pl', PLAYER, { progress: progress({ goal, milestones: ['first-route'] }) });
    const s = world([pl], { month: dec });
    const plainPl = company('pl', PLAYER, { progress: progress({ milestones: ['first-route'] }) });
    const plain = closeMonth(world([plainPl], { month: dec }), NO_DECISIONS).reports.pl;
    const result = closeMonth(s, NO_DECISIONS);
    const r = result.reports.pl;
    assert.equal(r.goalCash, -1_500_000);
    assert.equal(r.result, plain.result);
    close(r.cashEnd, plain.cashEnd - 1_500_000, 1e-12);
    const p = companyAfter(result.state, 'pl').progress as CompanyProgress;
    assert.equal(p.goal?.year, 1991);
    assert.equal(p.goal?.tag, 'steady');
    assert.ok((p.goalOffers?.length ?? 0) >= 2);
    assert.ok(result.news.some((n) => n.kind === 'goalMissed'));
  });

  it('6.11: Gewählt wird bis zum Januar-Abschluss; danach ist das Angebot weg und das gewählte Ziel gilt (5.3b)', () => {
    const dec = M + 11;
    const pl = company('pl', PLAYER, { progress: progress({ milestones: ['first-route'] }) });
    const afterDec = closeMonth(world([pl], { month: dec }), NO_DECISIONS).state;
    const offered = companyAfter(afterDec, 'pl').progress as CompanyProgress;
    assert.ok((offered.goalOffers?.length ?? 0) >= 2);
    // Der Spieler wählt im Januar das hohe Ziel; der Januar-Abschluss beendet das Angebot.
    const stretch = offered.goalOffers?.find((g) => g.tag === 'stretch');
    assert.ok(stretch);
    const chosen = afterDec.companies.map((c) => (c.id === 'pl' ? { ...c, progress: { ...offered, goal: stretch } } : c));
    const afterJan = closeMonth({ ...afterDec, companies: chosen }, NO_DECISIONS).state;
    const p = companyAfter(afterJan, 'pl').progress as CompanyProgress;
    assert.equal(p.goalOffers, undefined);
    assert.deepEqual(p.goal, stretch);
  });

  it('8.2: Berichte im Spielstand: höchstens REPORT_HISTORY_MONTHS, Strecken-Zahlen nur im neuesten (5.3b)', () => {
    const s0 = world([company('pl', PLAYER)]);
    const s1 = closeMonth(s0, NO_DECISIONS).state;
    const s2 = closeMonth(s1, NO_DECISIONS).state;
    const reports = companyAfter(s2, 'pl').reports;
    assert.equal(reports.length, 2);
    assert.equal(reports[0].routes.length, 0);
    assert.ok(reports[1].routes.length > 0);
    // Alle übrigen Zahlen des älteren Berichts bleiben.
    const first = companyAfter(s1, 'pl').reports[0];
    assert.deepEqual({ ...reports[0], routes: first.routes }, first);
    // Länge bleibt begrenzt.
    const many = Array.from({ length: REPORT_HISTORY_MONTHS + 5 }, (_, i) => ({ ...first, month: M - 200 + i }));
    const kept = keptReports(many, { ...first, month: M });
    assert.equal(kept.length, REPORT_HISTORY_MONTHS);
    assert.equal(kept[kept.length - 1].month, M);
    assert.ok(kept.slice(0, -1).every((r) => r.routes.length === 0));
    // Eine KI behält nur RIVAL_REPORT_MONTHS Berichte; der Spieler weiter REPORT_HISTORY_MONTHS.
    const old = Array.from({ length: 20 }, (_, i) => ({ ...first, companyId: 'ai', month: M - 20 + i }));
    const withHistory = world([company('pl', PLAYER, { reports: old.map((r) => ({ ...r, companyId: 'pl' })) }), rival('ai', {}, { reports: old })]);
    const closed = closeMonth(withHistory, NO_DECISIONS).state;
    assert.equal(companyAfter(closed, 'ai').reports.length, RIVAL_REPORT_MONTHS);
    assert.equal(companyAfter(closed, 'pl').reports.length, 21);
  });

  it('6.9: Forschung wird im Übergang fertig und wirkt ab X+1 (`completedResearch` = `research.done`)', () => {
    const research = { done: [], active: [{ id: 'fuel-1', startMonth: M - 5 }] };
    const result = closeMonth(world([company('pl', PLAYER, { progress: progress({ research }) })]), NO_DECISIONS);
    const after = companyAfter(result.state, 'pl');
    assert.deepEqual(after.progress?.research.done, ['fuel-1']);
    assert.deepEqual(after.inputs.completedResearch, ['fuel-1']);
    assert.ok(result.news.some((n) => n.kind === 'researchDone' && n.subject === 'fuel-1'));
    // Ein Monat früher noch nicht fertig.
    const early = closeMonth(world([company('pl', PLAYER, { progress: progress({ research: { done: [], active: [{ id: 'fuel-1', startMonth: M - 4 }] } }) })]), NO_DECISIONS);
    assert.deepEqual(companyAfter(early.state, 'pl').inputs.completedResearch, []);
  });
});

describe('Abschnitt 8.15 Szenario-Ziele', () => {
  const scenario = (extra: Partial<ScenarioState> = {}): ScenarioState => ({
    win: [{ id: 'cash', metric: 'capital', target: 10_000_000 }],
    floorMonths: 3,
    deadline: M + 24,
    floorStreak: 0,
    met: [],
    status: 'running',
    ...extra,
  });
  const values = { capital: 0, monthlyProfit: 0, reputation: 50, routes: [{ from: 'FRA', to: 'MAD', departuresPerWeek: 14 }], regions: 1, transferPax: 0, creditLimit: 5_000_000, bankrupt: false };

  it('8.15: Ziel-Beträge 2020 = Wert 1960 × costIndex 2020; Ruf-Ziele ohne Umrechnung', () => {
    const m2020 = (2020 - 1960) * 12;
    close(scenarioTarget({ metric: 'capital', target: 1_000_000 }, m2020), 1_000_000 * costIndex(m2020), 1e-12);
    assert.equal(scenarioTarget({ metric: 'reputation', target: 55 }, m2020), 55);
  });

  it('8.15: verloren nach `floorMonths` Monatsenden unter −creditLimit in Folge, oder bei Spielende', () => {
    let s = scenario();
    for (let k = 0; k < 2; k++) s = scenarioStep(s, { ...values, capital: -6_000_000 }, M + k);
    assert.equal(s.status, 'running');
    assert.equal(scenarioStep(s, { ...values, capital: -6_000_000 }, M + 2).status, 'lost');
    assert.equal(scenarioStep(s, { ...values, capital: 0 }, M + 2).floorStreak, 0);
    assert.equal(scenarioStep(scenario(), { ...values, bankrupt: true }, M).status, 'lost');
  });

  it('E77: eigene Untergrenze des Szenarios (`floorThreshold`, $ von 1960) statt −creditLimit', () => {
    const solvent = scenario({ floorMonths: 1, floorThreshold: 0 });
    assert.equal(scenarioFloor(solvent, 5_000_000, M), 0);
    assert.equal(scenarioFloor(scenario(), 5_000_000, M), -5_000_000);
    close(scenarioFloor({ floorThreshold: -1_000_000 }, 5_000_000, M), -1_000_000 * costIndex(M), 1e-12);
    // −1 $ verliert bei Untergrenze 0 sofort, obwohl die Kreditlinie 5 Mio. $ ist.
    assert.equal(scenarioStep(solvent, { ...values, capital: -1 }, M).status, 'lost');
    assert.equal(scenarioStep(solvent, { ...values, capital: 0 }, M).status, 'running');
    // Ohne eigene Schwelle: −1 $ liegt über −creditLimit.
    assert.equal(scenarioStep(scenario({ floorMonths: 1 }), { ...values, capital: -1 }, M).floorStreak, 0);
  });

  it('8.15: gewonnen, wenn alle Ziele erreicht; nach dem Stichtag sonst verloren', () => {
    const target = scenarioTarget({ metric: 'capital', target: 10_000_000 }, M);
    assert.equal(scenarioStep(scenario(), { ...values, capital: target }, M).status, 'won');
    assert.equal(scenarioStep(scenario(), { ...values, capital: target - 1 }, M + 24).status, 'lost');
  });

  it('8.15: Ziel `routes` zählt Städtepaare mit `minWeeklyFlights` Hin- und Rückflügen je Woche, beide Richtungen und alle Flugzeuge zusammen', () => {
    const routes = [
      { from: 'JFK', to: 'BOS', departuresPerWeek: 8 }, // 4 + 3 = 7 je Woche auf einem Paar: täglich
      { from: 'BOS', to: 'JFK', departuresPerWeek: 6 },
      { from: 'JFK', to: 'ORD', departuresPerWeek: 12 }, // 6 je Woche: nicht täglich
      { from: 'JFK', to: 'MIA', departuresPerWeek: 14 },
      { from: 'JFK', to: 'MIA', departuresPerWeek: 14 }, // zweites Flugzeug: dasselbe Paar
    ];
    assert.equal(servedCityPairs(routes), 3);
    assert.equal(servedCityPairs(routes, 7), 2);
    const daily = scenario({ win: [{ id: 'routes', metric: 'routes', target: 2, minWeeklyFlights: 7 }] });
    assert.equal(scenarioStep(daily, { ...values, routes }, M).status, 'won');
    assert.equal(scenarioStep(daily, { ...values, routes: routes.slice(0, 3) }, M).status, 'running', 'nur ein täglicher Dienst');
    const any = scenario({ win: [{ id: 'routes', metric: 'routes', target: 4 }] });
    assert.equal(scenarioStep(any, { ...values, routes }, M).status, 'running', 'fünf Strecken, aber drei Paare');
  });

  it('8.15: das Kassen-Ziel prüft die Kasse am Monatsende nach allen Buchungen (R11)', () => {
    const goal = 1_000_000_000 / costIndex(M); // Wert 1960 für 1 Mrd. $ im Prüfmonat
    const pl = company('pl', PLAYER, { cash: 990_000_000, progress: progress({ milestones: ['first-route'], scenario: scenario({ win: [{ id: 'cash', metric: 'capital', target: goal }] }) }) });
    const result = closeMonth(world([pl]), NO_DECISIONS);
    const status = companyAfter(result.state, 'pl').progress?.scenario?.status;
    assert.equal(status, result.reports.pl.cashEnd >= 1_000_000_000 - 1e-3 ? 'won' : 'running');
    // Ein Kauf im Monat senkt die Kasse am Monatsende: Geld, das schon ausgegeben ist, gewinnt nicht.
    const spent = { ...pl, cash: pl.cash - 50_000_000, ledger: { ...pl.ledger, otherSpending: { slots: 50_000_000 } } };
    const r2 = closeMonth(world([spent]), NO_DECISIONS);
    assert.equal(companyAfter(r2.state, 'pl').progress?.scenario?.status, 'running');
    assert.ok(r2.reports.pl.cashEnd < 1_000_000_000);
    assert.ok(creditLimit(r2.reports.pl.fleetValueEnd) > 0);
  });
});
