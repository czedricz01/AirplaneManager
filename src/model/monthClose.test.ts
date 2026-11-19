/**
 * Regeltests zu SPEZIFIKATION 8.1, 8.2, 8.15, 8.16 (Monatsabschluss, Kasse, Szenario, Prüfung) und den in 3.7b/3.8a
 * offenen Regeln: Buchung unabhängig von der Reihenfolge (7.8), Dividende (7.13), Übernahme (7.16), Vogelschlag und
 * Lieferung im Bericht dieses Monats (8.6, 8.12), keine globalen Daten (8.3), halber Flugplan (8.9), Planer =
 * Abschluss (R2). Paket 3.8b.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aircraftList as AIRCRAFT } from '../data/aircraft';
import { atCost, costIndex } from './basics';
import { WEEKS_PER_MONTH } from './constants';
import { aircraftValue } from './fleet';
import { creditInterest } from './fleetMarket';
import { birdStrikeCost, rollBirdStrike } from './monthEvents';
import {
  bookMonth,
  cashEquationGap,
  finishMonth,
  monthFleetValueParts,
  type BookingMarket,
  type BookingRoute,
  type CompanyWorld,
  type MonthTransaction,
  type RouteUnits,
} from './monthBooking';
import {
  bookingCompany,
  closeMonth,
  forecastMonth,
  guardNumbers,
  newRivalBrain,
  plannerResultAt,
  scenarioStep,
  scenarioTarget,
  type CompanyState,
  type MonthState,
  type MonthWorld,
  type PlayerProgress,
  type ScenarioState,
  type StatePlane,
} from './monthClose';
import { RIVAL_HEALTHY } from './rivalMonth';

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

const X = (1990 - 1960) * 12; // Januar 1990
const A320 = AIRCRAFT.find((a) => a.id === 'a320ceo')!;

const MARKETS: BookingMarket[] = [
  { id: 'FRA-MAD', regions: ['EU', 'EU'], greatCircleKm: 1420, referenceBlockMinutes: 150, marketSize: 2500, businessShare: 0.5 },
  { id: 'FRA-LHR', regions: ['EU', 'EU'], greatCircleKm: 650, referenceBlockMinutes: 85, marketSize: 4000, businessShare: 0.6 },
];

function plane(id: string, over: Partial<StatePlane> = {}): StatePlane {
  return {
    id,
    family: A320.family,
    listPrice1960: A320.basePrice / 4,
    builtMonth: X - 60,
    cabinListPrice1960: 400_000,
    cabinInstalledMonth: X - 60,
    airframeCondition: 90,
    cabinCondition: 85,
    hasHangar: false,
    overhaulsDone: 0,
    ...over,
  };
}

function route(id: string, planeId: string, marketId = 'FRA-MAD', over: Partial<BookingRoute> = {}): BookingRoute {
  return {
    id,
    marketId,
    planeId,
    airportIds: marketId === 'FRA-MAD' ? ['FRA', 'MAD'] : ['FRA', 'LHR'],
    seatsPerFlight: { economy: 150 },
    departuresPerWeek: 14,
    blockMinutes: marketId === 'FRA-MAD' ? 160 : 95,
    ageMonths: 12,
    ...over,
  };
}

const UNITS: RouteUnits = {
  fuelPerLeg: 3000,
  crewPerLeg: 1200,
  landingPerLeg: 700,
  passengerCost: { economy: { catering: 8, fees: 15, ffp: 0, total: 23 } },
  satisfaction: { economy: 100 },
  slotShare: 800,
  aircraftShare: 15_000,
};

function worldFor(companies: readonly CompanyState[]): MonthWorld {
  const out: Record<string, CompanyWorld> = {};
  for (const c of companies) {
    const routes: Record<string, RouteUnits> = {};
    for (const r of c.routes) routes[r.id] = UNITS;
    out[c.id] = { routes, airportUpkeepWeekly: [4000], ownerFeeIncomeWeekly: [] };
  }
  return { markets: MARKETS, companies: out };
}

function playerProgress(over: Partial<PlayerProgress> = {}): PlayerProgress {
  return {
    startMonth: X - 24,
    rank: 1,
    rankHistory: [],
    research: { done: [], active: [] },
    milestones: [],
    profitStreak: 0,
    careerPax: 0,
    takeovers: 0,
    staff: { salaryPct: 100, morale: 50 },
    preorders: [],
    overdrawnMonths: 0,
    bankrupt: false,
    ...over,
  };
}

function player(over: Partial<CompanyState> = {}): CompanyState {
  return {
    id: 'player',
    cashAtMonthStart: 20_000_000,
    cash: 20_000_000,
    reputation: 50,
    planes: [plane('p1'), plane('p2')],
    routes: [route('r1', 'p1'), route('r2', 'p2', 'FRA-LHR')],
    transactions: [],
    campaigns: [],
    ffpActive: false,
    badLuckCap: true,
    reports: [],
    player: playerProgress(),
    ...over,
  };
}

function rival(id = 'lcc1', over: Partial<CompanyState> = {}): CompanyState {
  return {
    id,
    cashAtMonthStart: 30_000_000,
    cash: 30_000_000,
    reputation: 50,
    planes: [plane(`${id}-a`), plane(`${id}-b`)],
    routes: [route(`${id}-r1`, `${id}-a`), route(`${id}-r2`, `${id}-b`, 'FRA-LHR')],
    transactions: [],
    campaigns: [],
    ffpActive: false,
    badLuckCap: false,
    reports: [],
    rival: newRivalBrain('lcc', 'normal', true),
    ...over,
  };
}

function monthState(companies: CompanyState[], over: Partial<MonthState> = {}): MonthState {
  return { month: X, seed: 1234, companies, randomEvents: [], disruptions: [], badLuck: false, usedMarket: [], ...over };
}

function close(state: MonthState) {
  return closeMonth(state, worldFor(state.companies));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as object)) deepFreeze(v);
  }
  return value;
}

/** Kassen-Gleichung (8.2) bis auf Rundung der Gleitkommazahlen (relativ zu den Beträgen des Berichts). */
function assertCashEquation(report: Parameters<typeof cashEquationGap>[0]): void {
  const scale = Math.abs(report.cashStart) + Math.abs(report.cashEnd) + report.fleetValueStart + report.fleetValueEnd + Math.abs(report.result);
  assert.ok(Math.abs(cashEquationGap(report)) <= 1e-12 * scale, `Kassen-Gleichung: Rest ${cashEquationGap(report)}`);
}

const near = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

// ---------------------------------------------------------------------------
// 8.1 Ablauf
// ---------------------------------------------------------------------------

describe('Abschnitt 8.1 Ablauf des Monatsabschlusses', () => {
  it('8.1: zwei Aufrufe mit gleichem Spielstand ergeben genau dasselbe', () => {
    const state = monthState([player(), rival('lcc1'), rival('lcc2')]);
    assert.deepEqual(close(state), close(state));
  });

  it('8.1: der Abschluss führt in den nächsten Monat; Kasse am Monatsanfang = Kasse am Monatsende (8.2)', () => {
    const out = close(monthState([player(), rival()]));
    assert.equal(out.state.month, X + 1);
    for (const c of out.state.companies) {
      assert.equal(c.cash, out.reports[c.id].cashEnd);
      assert.equal(c.cashAtMonthStart, out.reports[c.id].cashEnd);
      assert.deepEqual(c.transactions, []);
      assert.equal(c.reports.at(-1), out.reports[c.id]);
    }
  });

  it('7.8: die Buchung hängt nicht von der Reihenfolge der Gesellschaften ab', () => {
    const a = close(monthState([player(), rival('lcc1'), rival('lcc2')]));
    const b = close(monthState([rival('lcc2'), rival('lcc1'), player()]));
    assert.deepEqual(a.reports, b.reports);
    const byId = (s: MonthState) => Object.fromEntries(s.companies.map((c) => [c.id, c]));
    assert.deepEqual(byId(a.state), byId(b.state));
  });

  it('8.1 / R2: Vorhersage des Monats = Buchung im Abschluss (Erlös, Fluggäste je Gesellschaft)', () => {
    const state = monthState([player(), rival()]);
    const forecast = forecastMonth(state, worldFor(state.companies));
    const out = close(state);
    for (const f of forecast) {
      near(out.reports[f.companyId].revenue, f.revenue);
      near(out.reports[f.companyId].passengers, f.passengers);
    }
  });

  it('R2: Planer-Hauptzahl beim heutigen Plan = Strecken-Ergebnis × Wochen im Abschluss (ohne Störungen)', () => {
    const state = monthState([player(), rival()]);
    const world = worldFor(state.companies);
    const booked = forecastMonth(state, world).find((b) => b.companyId === 'player')!.routes.find((r) => r.id === 'r1')!;
    near(plannerResultAt(state, world, 'player', 'r1', 7), booked.result * WEEKS_PER_MONTH);
  });
});

// ---------------------------------------------------------------------------
// 8.2 Kasse und Bericht
// ---------------------------------------------------------------------------

describe('Abschnitt 8.2 Kasse am Monatsende und Bericht', () => {
  it('8.2: Kassen-Gleichung gilt in jedem Monat für jede Gesellschaft (24 Monate, mit Geschäften im Monat)', () => {
    let state = monthState([player(), rival('lcc1'), rival('lcc2')]);
    for (let k = 0; k < 24; k++) {
      // Geschäfte des Spielers während des Monats: Kauf zum Wert, Forschung, Krisen-Antwort, Anzahlung.
      const p = state.companies.find((c) => c.id === 'player')!;
      const bought = plane(`buy-${k}`, { builtMonth: state.month, cabinInstalledMonth: state.month, airframeCondition: 100, cabinCondition: 100 });
      const price = aircraftValue(bought, state.month);
      const tx: MonthTransaction[] = [
        { kind: 'purchase', cash: -price, valueChange: price, planeId: bought.id },
        { kind: 'research', cash: -50_000 },
        { kind: 'crisisResponse', cash: -20_000 },
        { kind: 'deposit', cash: -100_000, depositChange: 100_000 },
      ];
      const used = k % 3 === 0 ? tx : tx.slice(1);
      const withTx: CompanyState = {
        ...p,
        cash: p.cash + used.reduce((s, t) => s + t.cash, 0),
        planes: k % 3 === 0 ? [...p.planes, bought] : p.planes,
        transactions: used,
        player: {
          ...p.player!,
          preorders: [
            ...p.player!.preorders,
            { id: `po-${k}`, listPrice1960: A320.basePrice / 4, cabinListPrice1960: 400_000, family: A320.family, n: 1, deliveryMonth: state.month + 30, deposit: 100_000, delays: 0 },
          ],
        },
      };
      state = { ...state, companies: state.companies.map((c) => (c.id === 'player' ? withTx : c)) };
      const out = close(state);
      for (const [id, report] of Object.entries(out.reports)) {
        assertCashEquation(report);
        assert.equal(out.state.companies.find((c) => c.id === id)!.cash, report.cashEnd, 'Kasse danach = Spielstand');
      }
      state = out.state;
    }
  });

  it('8.2 / 8.12: Lieferung steht im Bericht dieses Monats; Flugzeug in der Flotte, Anzahlung aufgelöst', () => {
    const p = player({
      cash: 500_000_000,
      cashAtMonthStart: 500_000_000,
      player: playerProgress({
        preorders: [
          { id: 'po', listPrice1960: A320.basePrice / 4, cabinListPrice1960: 400_000, family: A320.family, n: 2, deliveryMonth: X + 1, deposit: 3_000_000, delays: 0 },
        ],
      }),
    });
    const out = close(monthState([p, rival()]));
    const report = out.reports.player;
    assert.ok((report.transactions.delivery ?? 0) < 0);
    assert.equal(report.depositsStart, 3_000_000);
    assert.equal(report.depositsEnd, 0);
    assertCashEquation(report);
    const next = out.state.companies.find((c) => c.id === 'player')!;
    assert.equal(next.planes.length, 4);
    assert.equal(next.player!.preorders.length, 0);
    // Wert neu = Preis ohne Rabatt; Ertrag = Rabatt (8.12) steht in „Aircraft trades“.
    assert.ok(report.costs.aircraftTrades < 0);
  });

  it('8.2 / 8.6: Vogelschlag steht im Bericht dieses Monats (Posten „Damage“)', () => {
    let seed = 0;
    while (!rollBirdStrike(seed, X, 'p1') || rollBirdStrike(seed, X, 'p2')) seed++;
    const out = close(monthState([player(), rival()], { seed }));
    near(out.reports.player.costs.damages, birdStrikeCost(A320.basePrice / 4, X));
    assertCashEquation(out.reports.player);
  });

  it('8.14 / 8.17: Zinsen 333 333 $ bei −50 Mio. $ am Monatsanfang, im Posten „Interest“', () => {
    const p = player({ cashAtMonthStart: -50_000_000, cash: -50_000_000 });
    const out = close(monthState([p, rival()]));
    near(out.reports.player.costs.interest, 333_333.333333, 1e-9);
    near(out.reports.player.costs.interest, creditInterest(-50_000_000));
  });

  it('8.14: Zwangsverkauf nach 6 überzogenen Monaten, Erlös im Bericht, Flugzeug im Gebrauchtmarkt', () => {
    const p = player({ cashAtMonthStart: -500_000_000, cash: -500_000_000, player: playerProgress({ overdrawnMonths: 5 }) });
    const out = close(monthState([p, rival()]));
    assert.ok((out.reports.player.transactions.sale ?? 0) > 0);
    const next = out.state.companies.find((c) => c.id === 'player')!;
    assert.equal(next.planes.length, 1);
    assert.equal(out.state.usedMarket.length, 1);
    assert.ok(out.news.some((n) => n.kind === 'forcedSale'));
    assertCashEquation(out.reports.player);
  });

  it('8.14: Spielende, wenn überzogen und ohne Flugzeug', () => {
    const p = player({ cashAtMonthStart: -500_000_000, cash: -500_000_000, planes: [], routes: [] });
    const out = close(monthState([p, rival()]));
    assert.equal(out.state.companies.find((c) => c.id === 'player')!.player!.bankrupt, true);
    assert.ok(out.news.some((n) => n.kind === 'bankrupt'));
  });

  it('6.11: im Dezember Prämie oder Strafe in die Kasse, nicht ins Monatsergebnis', () => {
    const dec = X + 11;
    const goal = { year: 1990, kind: 'routes' as const, tag: 'steady' as const, target: 1, reward: 1_000_000, penalty: 500_000 };
    const met = close(monthState([player({ player: playerProgress({ goal }) }), rival()], { month: dec }));
    const missed = close(monthState([player({ player: playerProgress({ goal: { ...goal, target: 99 } }) }), rival()], { month: dec }));
    assert.equal(met.reports.player.result, missed.reports.player.result);
    near(met.reports.player.cashEnd - missed.reports.player.cashEnd, 1_500_000);
    assert.equal(met.state.companies.find((c) => c.id === 'player')!.player!.goal, undefined);
  });
});

// ---------------------------------------------------------------------------
// Offene Regeln aus 7 und 8
// ---------------------------------------------------------------------------

describe('Offene Regeln aus Abschnitt 7 und 8', () => {
  it('7.13: Dividende ändert weder Monatsergebnis noch Ruf', () => {
    const rich = close(monthState([player(), rival('lcc1', { cash: 10_000_000_000, cashAtMonthStart: 10_000_000_000 })]));
    const poor = close(monthState([player(), rival('lcc1', { cash: 2_000_000, cashAtMonthStart: 2_000_000 })]));
    assert.ok((rich.reports.lcc1.transactions.dividend ?? 0) < 0);
    assert.equal(poor.reports.lcc1.transactions.dividend, undefined);
    near(rich.reports.lcc1.result, poor.reports.lcc1.result);
    const rep = (o: typeof rich) => o.state.companies.find((c) => c.id === 'lcc1')!.reputation;
    assert.equal(rep(rich), rep(poor));
    assertCashEquation(rich.reports.lcc1);
  });

  it('7.16: Übernahme ändert das Monatsergebnis nicht (Flugzeuge zum Wert, Kassen-Gleichung gilt)', () => {
    const p = player();
    const world = worldFor([p]);
    const booking = bookMonth({
      month: X,
      seed: 1,
      markets: MARKETS,
      events: [],
      disruptions: [],
      companies: [{ company: bookingCompany(p, X), world: world.companies.player }],
    })[0];
    // Flugzeuge älter als 25 Jahre: Wert ändert sich im Monat nicht.
    const old = [plane('t1', { builtMonth: X - 400 }), plane('t2', { builtMonth: X - 420 })];
    const value = old.reduce((s, q) => s + aircraftValue(q, X), 0);
    const takeover: MonthTransaction = { kind: 'takeover', cash: 5_000_000 - 40_000_000, valueChange: value };
    const planesAtEnd = p.planes.map((q) => {
      const b = booking.planes.find((x) => x.id === q.id)!;
      return { ...q, airframeCondition: b.airframeCondition, cabinCondition: b.cabinCondition };
    });
    const without = finishMonth({ month: X, company: bookingCompany(p, X), booking, planesAtEnd, closingTransactions: [] });
    const withTo = finishMonth({
      month: X,
      company: bookingCompany({ ...p, cash: p.cash + takeover.cash, transactions: [takeover] }, X),
      booking: { ...booking, fleetValueStart: booking.fleetValueStart, cashAfterOperations: booking.cashAfterOperations + takeover.cash },
      planesAtEnd: [...planesAtEnd, ...old],
      closingTransactions: [],
    });
    near(withTo.result, without.result);
    assertCashEquation(withTo);
    assert.equal(monthFleetValueParts(0, value, [takeover]).total, 0);
  });

  it('8.9: ein halber Flugplan bringt höchstens die Hälfte weniger Fluggäste', () => {
    const p = player();
    const base = forecastMonth(monthState([p, rival()]), worldFor([p, rival()])).find((b) => b.companyId === 'player')!;
    const half = forecastMonth(
      monthState([p, rival()], { disruptions: [{ month: X, kind: 'defect', target: 'p1', share: 0.5 }] }),
      worldFor([p, rival()]),
    ).find((b) => b.companyId === 'player')!;
    const r = (b: typeof base) => b.routes.find((x) => x.id === 'r1')!.totalPassengers;
    assert.ok(r(half) < r(base));
    assert.ok(r(half) >= 0.5 * r(base) - 1e-9);
    assert.ok(half.cancelledShare > 0);
  });

  it('8.3: ein Test mit closeMonth ändert keine globalen Daten und nicht seine Eingabe', () => {
    const aircraftBefore = JSON.stringify(AIRCRAFT);
    const state = deepFreeze(monthState([player(), rival('lcc1'), rival('lcc2')]));
    const world = deepFreeze(worldFor(state.companies));
    const copy = JSON.stringify(state);
    closeMonth(state, world);
    closeMonth(state, world);
    assert.equal(JSON.stringify(state), copy);
    assert.equal(JSON.stringify(AIRCRAFT), aircraftBefore);
  });

  it('7.1: Spieler und KI mit gleichen neutralen Eingaben bekommen dieselbe Buchung', () => {
    const a = player({ id: 'a', player: undefined, badLuckCap: false });
    const b = rival('b', { ...a, id: 'b', rival: newRivalBrain('flag', 'normal', false) });
    const out = forecastMonth(monthState([a, b]), worldFor([a, b]));
    near(out[0].revenue, out[1].revenue);
    near(out[0].operatingCosts.total, out[1].operatingCosts.total);
  });

  it('7.6: die KI setzt neue Preise für den nächsten Monat; der laufende Monat rechnet mit den alten (4.5)', () => {
    const out = close(monthState([player(), rival()]));
    const next = out.state.companies.find((c) => c.id === 'lcc1')!;
    assert.ok(next.routes.every((r) => r.fareRatio?.economy !== undefined));
    assert.equal(next.rival!.routes['lcc1-r1'].avgProfit !== undefined, true);
  });

  it('7.15: Auflösung: Flugzeuge in den Gebrauchtmarkt, keine Strecken, kein Markt mehr', () => {
    const r = rival('lcc1', {
      cash: -900_000_000,
      cashAtMonthStart: -900_000_000,
      rival: { ...newRivalBrain('lcc', 'normal', false), distress: { status: 'forSale', distressMonths: 10, forSaleMonths: 99 } },
    });
    const out = close(monthState([player(), r]));
    const next = out.state.companies.find((c) => c.id === 'lcc1')!;
    assert.equal(next.rival!.distress.status, 'liquidated');
    assert.equal(next.planes.length, 0);
    assert.equal(next.routes.length, 0);
    assert.ok(out.state.usedMarket.length >= 2);
    const after = close(out.state);
    assert.equal(after.reports.lcc1, undefined, 'aufgelöste KI bucht nicht mehr');
    assert.deepEqual(RIVAL_HEALTHY.status, 'healthy');
  });
});

// ---------------------------------------------------------------------------
// 8.15 Szenario-Ziele
// ---------------------------------------------------------------------------

describe('Abschnitt 8.15 Szenario-Ziele', () => {
  const scenario: ScenarioState = {
    win: [{ id: 'cash', metric: 'capital', target: 10_000_000 }],
    floorMonths: 3,
    deadline: X + 24,
    floorStreak: 0,
    met: [],
    status: 'running',
  };
  const values = { capital: 0, monthlyProfit: 0, reputation: 50, routes: 1, regions: 1, transferPax: 0, creditLimit: 10_000_000, bankrupt: false };

  it('8.15: Ziel-Beträge 2020 = Wert 1960 × costIndex 2020', () => {
    const m2020 = (2020 - 1960) * 12;
    near(scenarioTarget({ metric: 'capital', target: 1_000_000 }, m2020), 1_000_000 * costIndex(m2020));
    near(scenarioTarget({ metric: 'capital', target: 1_000_000 }, m2020), atCost(1_000_000, m2020));
    assert.equal(scenarioTarget({ metric: 'reputation', target: 55 }, m2020), 55);
  });

  it('8.15: Kassen-Ziel prüft die Kasse am Monatsende nach allen Buchungen (kein schon ausgegebenes Geld)', () => {
    const target = scenarioTarget(scenario.win[0], X);
    const p = player({ cash: target + 5_000_000, cashAtMonthStart: target + 5_000_000, player: playerProgress({ scenario }) });
    // Im Monat für 30 Mio. $ geforscht: das Geld ist weg, das Ziel nicht erreicht.
    const spent = { ...p, cash: p.cash - 30_000_000, transactions: [{ kind: 'research' as const, cash: -30_000_000 }] };
    const out = close(monthState([spent, rival()]));
    const s = out.state.companies.find((c) => c.id === 'player')!.player!.scenario!;
    assert.ok(out.reports.player.cashEnd < target);
    assert.equal(s.status, 'running');
  });

  it('8.15: verloren nach `floorMonths` Monatsenden unter −creditLimit in Folge, oder bei Spielende', () => {
    let s = scenario;
    for (let k = 0; k < 3; k++) s = scenarioStep(s, { ...values, capital: -20_000_000 }, X + k);
    assert.equal(s.status, 'lost');
    assert.equal(scenarioStep(scenario, { ...values, bankrupt: true }, X).status, 'lost');
    assert.equal(scenarioStep(scenario, { ...values, capital: -5_000_000 }, X).floorStreak, 0);
  });

  it('8.15: gewonnen, wenn alle Ziele erreicht; nach dem Stichtag sonst verloren', () => {
    assert.equal(scenarioStep(scenario, { ...values, capital: atCost(10_000_000, X) }, X).status, 'won');
    assert.equal(scenarioStep(scenario, values, X + 24).status, 'lost');
  });
});

// ---------------------------------------------------------------------------
// 8.16 Prüfung
// ---------------------------------------------------------------------------

describe('Abschnitt 8.16 Prüfung auf ungültige Zahlen', () => {
  it('8.16: ungültiger Wert → Meldung, Größe behält ihren Wert vom Monatsanfang', () => {
    const before = player();
    const broken = { ...before, cash: Number.NaN, planes: before.planes.map((q, i) => (i === 0 ? { ...q, cabinCondition: Number.POSITIVE_INFINITY } : q)) };
    const { company, invalid } = guardNumbers(broken, before);
    assert.deepEqual(invalid.sort(), ['cash', 'p1.cabinCondition']);
    assert.equal(company.cash, before.cash);
    assert.equal(company.planes[0].cabinCondition, before.planes[0].cabinCondition);
  });

  it('8.16: ein Abschluss mit gewöhnlichen Werten meldet nichts Ungültiges', () => {
    const out = close(monthState([player(), rival()]));
    assert.ok(!out.news.some((n) => n.kind === 'invalidNumber'));
    for (const r of Object.values(out.reports)) assert.ok(Number.isFinite(r.cashEnd) && Number.isFinite(r.result));
  });

  it('8.16: ein NaN in der Eingabe wird abgefangen und gemeldet', () => {
    const p = player({ planes: [plane('p1', { cabinCondition: Number.NaN }), plane('p2')] });
    const out = close(monthState([p, rival()]));
    assert.ok(out.news.some((n) => n.kind === 'invalidNumber'));
  });
});
