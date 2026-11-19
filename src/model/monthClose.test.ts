/**
 * Regeltests zu SPEZIFIKATION 8.0–8.2 und 8.16 (Monatsabschluss) und die offenen Abschluss-Tests aus 3.6a, 3.7b und
 * 3.8a: Buchung unabhängig von der Reihenfolge (7.8), Kassen-Gleichung (8.2), Lieferung und Vogelschlag im Bericht
 * dieses Monats (8.6, 8.12), keine globalen Daten (8.3), halber Flugplan (8.9), Charter, Kreditlinie (8.14), Vorhersage =
 * Abschluss (R2). Paket 3.8b.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aircraftList } from '../data/aircraft';
import { airportsData } from '../data/airports';
import { HISTORICAL_EVENTS, WEEKS_PER_MONTH, type WorldRegion } from './constants';
import { newAircraftPrice } from './fleet';
import { birdStrikeCost, rollBirdStrike } from './monthEvents';
import { preorderBalance, preorderDeposit } from './fleetMarket';
import {
  buyAircraft,
  closeMonth,
  fleetValue,
  monthOperations,
  newLedger,
  NO_DECISIONS,
  spend,
  type AircraftState,
  type CompanyInputs,
  type CompanyState,
  type ModelAirport,
  type ModelState,
  type PreorderState,
  type RouteState,
} from './monthClose';
import { RIVAL_INPUTS } from './rivals';

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

/** Die neutralen Eingaben (KI, 7.2) als `CompanyInputs`. */
const NEUTRAL: CompanyInputs = { ...RIVAL_INPUTS, campaigns: [] };
/** Spieler-Eingaben mit denselben Werten, aber Pech-Deckel, Charter, Personal-Modell, Kreditlinie. */
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

function route(id: string, aircraftId: string, to = 'MAD', departuresPerWeek = 14): RouteState {
  return { id, aircraftId, from: 'FRA', to, departuresPerWeek, ageMonths: 24, service: { economy: PEANUTS, business: PEANUTS } };
}

function company(id: string, inputs: CompanyInputs, opts: Partial<CompanyState> = {}): CompanyState {
  const aircraft = opts.aircraft ?? [plane(`${id}-p1`)];
  const routes = opts.routes ?? [route(`${id}-r1`, aircraft[0].id)];
  const cash = opts.cash ?? 50_000_000;
  const holding = { managementTier: 0, slots: { Narrowbody: 7 }, stands: {}, desks: { normal: 2, self: 0 }, facilities: [] };
  const preorders = opts.preorders ?? [];
  return {
    id,
    cash,
    reputation: 50,
    inputs,
    aircraft,
    routes,
    airports: { FRA: holding, MAD: holding },
    preorders,
    overdrawnMonths: 0,
    profitStreak: 0,
    ledger: newLedger(cash, fleetValue(aircraft, M), preorders.reduce((s, p) => s + p.deposit, 0)),
    reports: [],
    ...opts,
  };
}

function world(companies: CompanyState[], extra: Partial<ModelState> = {}): ModelState {
  return { month: M, seed: 42, airports: AIRPORTS, randomEvents: [], disruptions: [], badLuck: false, resold: [], companies, ...extra };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as object)) deepFreeze(v);
  }
  return value;
}

const companyAfter = (state: ModelState, id: string) => state.companies.find((c) => c.id === id) as CompanyState;

describe('Abschnitt 8.1 Ablauf des Monatsabschlusses', () => {
  it('8.1: zwei Aufrufe mit gleichem Spielstand ergeben genau dasselbe Ergebnis', () => {
    const s = world([company('pl', PLAYER), company('ai', NEUTRAL)]);
    assert.deepEqual(closeMonth(s, NO_DECISIONS), closeMonth(s, NO_DECISIONS));
  });

  it('8.3: ein Test mit closeMonth ändert keine globalen Daten und nicht seine Eingabe', () => {
    const s = deepFreeze(world([company('pl', PLAYER), company('ai', NEUTRAL)]));
    const before = JSON.stringify(s);
    const events = JSON.stringify(HISTORICAL_EVENTS);
    const aircraft = JSON.stringify(aircraftList);
    const result = closeMonth(s, NO_DECISIONS);
    assert.equal(JSON.stringify(s), before);
    assert.equal(JSON.stringify(HISTORICAL_EVENTS), events);
    assert.equal(JSON.stringify(aircraftList), aircraft);
    assert.equal(result.state.month, M + 1);
  });

  it('7.8: die Buchung hängt nicht von der Reihenfolge der Gesellschaften ab', () => {
    const a = company('a', PLAYER);
    const b = company('b', NEUTRAL, { aircraft: [plane('b-p1', M - 60)] });
    const c = company('c', NEUTRAL, { aircraft: [plane('c-p1')], routes: [route('c-r1', 'c-p1', 'CDG')] });
    const one = closeMonth(world([a, b, c]), NO_DECISIONS);
    const two = closeMonth(world([c, b, a]), NO_DECISIONS);
    assert.deepEqual(one.reports, two.reports);
  });

  it('7.8: Entscheidungen ändern keine Zahl des laufenden Monats; ihre Kasse steht im Bericht', () => {
    const s = world([company('pl', PLAYER), company('ai', NEUTRAL)]);
    const decide = (c: CompanyState) => (c.id === 'ai' ? { ...c, cash: c.cash - 1_000_000, routes: c.routes.map((r) => ({ ...r, nextFareRatios: { economy: 0.8 } })) } : c);
    const without = closeMonth(s, NO_DECISIONS);
    const withDecisions = closeMonth(s, decide);
    for (const id of ['pl', 'ai']) {
      const x = without.reports[id];
      const y = withDecisions.reports[id];
      assert.equal(y.revenue, x.revenue);
      assert.deepEqual(y.costs, x.costs);
      assert.equal(y.result, x.result);
      assert.deepEqual(y.reputation, x.reputation);
    }
    assert.equal(withDecisions.reports.ai.decisionsCash, -1_000_000);
    close(withDecisions.reports.ai.cashEnd, without.reports.ai.cashEnd - 1_000_000);
  });
});

describe('Abschnitt 3.11 / R1 Eine Marktaufteilung für alle', () => {
  it('R1: zwei gleiche Angebote teilen sich den Markt genau zur Hälfte; zusammen mehr Fluggäste als eines allein', () => {
    // Viele Abflüge, damit die Sitze nicht voll sind (sonst begrenzen die Sitze, nicht der Markt).
    const big = (id: string) => company(id, NEUTRAL, { routes: [route(`${id}-r1`, `${id}-p1`, 'MAD', 140)] });
    const alone = monthOperations(world([big('a')])).a;
    const seats = alone.routes[0].offeredSeats.economy;
    assert.ok(alone.routes[0].passengers.economy < seats, 'Sitze nicht voll');
    const ops = monthOperations(world([big('a'), big('b')]));
    close(ops.a.passengers, ops.b.passengers);
    assert.ok(ops.a.passengers < alone.passengers);
    assert.ok(ops.a.passengers + ops.b.passengers > alone.passengers);
  });

  it('7.1: Spieler und KI mit gleichen (neutralen) Werten bekommen dieselben Zahlen', () => {
    const neutralPlayer: CompanyInputs = { ...NEUTRAL, badLuckCap: true, staffModel: true, forcedSale: true };
    const ops = monthOperations(world([company('a', neutralPlayer), company('b', NEUTRAL)]));
    close(ops.a.revenue, ops.b.revenue);
    close(ops.a.routes[0].result, ops.b.routes[0].result);
  });
});

describe('Abschnitt 8.2 Kasse am Monatsende und Bericht', () => {
  it('8.2: Kassen-Gleichung mit Kauf, Krisen-Antwort, Slot-Kauf, Lieferung und Anzahlung', () => {
    const base = newAircraftPrice(A320.basePrice, 0, M);
    const order: PreorderState = {
      id: 'o1',
      plane: (({ id: _id, builtMonth: _b, cabinInstalledMonth: _c, airframeCondition: _a, cabinCondition: _k, ...rest }) => rest)(plane('x')),
      count: 2,
      deposit: preorderDeposit(base, 2),
      deliveryMonth: M,
      delays: 0,
      firstDeliveryOffset: A320.firstDeliveryOffset,
    };
    const later: PreorderState = { ...order, id: 'o2', deliveryMonth: M + 5 };
    let pl = company('pl', PLAYER, { cash: 400_000_000, preorders: [order, later] });
    pl = buyAircraft(pl, plane('pl-p2'), base, M);
    pl = spend(pl, 'crisisResponse', 1_000_000);
    pl = spend(pl, 'slots', 250_000);
    const result = closeMonth(world([pl, company('ai', NEUTRAL)]), NO_DECISIONS);
    for (const id of ['pl', 'ai']) {
      const r = result.reports[id];
      const other = Object.values(r.otherSpending).reduce((a, b) => a + b, 0);
      close(
        r.cashEnd - r.cashStart,
        r.result - (r.fleetValueEnd - r.fleetValueStart) - (r.depositsEnd - r.depositsStart) - other + r.decisionsCash,
        1e-9,
      );
      assert.equal(r.cashEnd, companyAfter(result.state, id).cash);
      assert.equal(companyAfter(result.state, id).ledger.cashAtStart, r.cashEnd);
      close(companyAfter(result.state, id).ledger.fleetValueAtStart, r.fleetValueEnd);
    }
    assert.equal(result.reports.pl.costs.crisisResponses, 1_000_000);
  });

  it('8.12: die Lieferung erscheint mit Restzahlung im Bericht dieses Monats; der Rabatt ist Ertrag', () => {
    const base = newAircraftPrice(A320.basePrice, 0, M);
    const order: PreorderState = {
      id: 'o1',
      plane: (({ id: _id, builtMonth: _b, cabinInstalledMonth: _c, airframeCondition: _a, cabinCondition: _k, ...rest }) => rest)(plane('x')),
      count: 12,
      deposit: preorderDeposit(base, 12),
      deliveryMonth: M,
      delays: 0,
      firstDeliveryOffset: A320.firstDeliveryOffset,
    };
    const rich = closeMonth(world([company('pl', PLAYER, { cash: 2_000_000_000, preorders: [order] })]), NO_DECISIONS);
    const r = rich.reports.pl;
    assert.deepEqual(r.deliveries, [{ preorderId: 'o1', outcome: 'deliver', amount: preorderBalance(base, 12, order.deposit) }]);
    assert.equal(companyAfter(rich.state, 'pl').aircraft.length, 13);
    assert.equal(r.depositsEnd, 0);
    // Rabatt 12 % auf 12 × Wert als Ertrag in „Aircraft trades“.
    close(-r.costs.aircraftTrades, 0.12 * 12 * base, 1e-9);

    const poor = closeMonth(world([company('pl', PLAYER, { cash: 0, preorders: [order] })]), NO_DECISIONS);
    assert.equal(poor.reports.pl.deliveries[0].outcome, 'delay');
    assert.equal(companyAfter(poor.state, 'pl').preorders[0].deliveryMonth, M + 1);
  });

  it('8.6: ein Vogelschlag steht im Bericht des Monats, in dem er gewürfelt wurde', () => {
    let seed = 0;
    while (!rollBirdStrike(seed, M, 'pl-p1')) seed++;
    const result = closeMonth(world([company('pl', PLAYER)], { seed }), NO_DECISIONS);
    assert.deepEqual(result.reports.pl.birdStrikes, ['pl-p1']);
    close(result.reports.pl.costs.damages, birdStrikeCost(A320.basePrice, M));
    // Kein Flug fällt aus.
    assert.equal(result.reports.pl.cancelledShare, 0);
  });

  it('6.5: der Ruf ändert sich nur im Abschluss; Bericht und Spielstand haben denselben Wert', () => {
    const result = closeMonth(world([company('pl', PLAYER)]), NO_DECISIONS);
    assert.equal(companyAfter(result.state, 'pl').reputation, result.reports.pl.reputation.reputation);
    const sum = result.reports.pl.reputation.causes.reduce((s, c) => s + c.amount, 0);
    close(50 + sum, result.reports.pl.reputation.reputation);
  });

  it('8.2: Berichte bleiben im Spielstand, höchstens 120', () => {
    const old = Array.from({ length: 120 }, () => ({}) as never);
    const result = closeMonth(world([company('pl', PLAYER, { reports: old })]), NO_DECISIONS);
    const reports = companyAfter(result.state, 'pl').reports;
    assert.equal(reports.length, 120);
    assert.equal(reports[119], result.reports.pl);
  });
});

describe('Abschnitt 8.9 Gestrichene und gecharterte Flüge im Abschluss', () => {
  const strike = (inputs: CompanyInputs): CompanyInputs => ({ ...inputs, staffStrike: { month: M, answer: 'raisePay' } });

  it('8.9: ein halber Flugplan bringt höchstens die Hälfte weniger Fluggäste', () => {
    const full = monthOperations(world([company('pl', PLAYER)])).pl;
    const half = monthOperations(world([company('pl', strike(PLAYER))])).pl;
    close(half.routes[0].shares.cancelledShare, 0.5);
    assert.ok(half.passengers >= 0.5 * full.passengers);
    assert.ok(half.passengers < full.passengers);
    close(half.cancelledShare, 0.5);
  });

  it('8.9: Charter → Erlös wie ohne Störung, kein gestrichener Anteil; Kosten − eigene Flugkosten + Gebühr', () => {
    const defect = { month: M, kind: 'defect' as const, target: 'pl-p1', share: 0.5, charter: true };
    const none = monthOperations(world([company('pl', PLAYER)])).pl;
    const chartered = monthOperations(world([company('pl', PLAYER)], { disruptions: [defect] })).pl;
    close(chartered.revenue, none.revenue);
    assert.equal(chartered.cancelledShare, 0);
    const r0 = none.routes[0];
    const r1 = chartered.routes[0];
    close(r1.fixed.flightOps, 0.5 * r0.fixed.flightOps);
    close(chartered.charter, 1.5 * r0.flightOpsFull * 0.5 * WEEKS_PER_MONTH);

    // Dieselbe Störung bei der KI (kein Charter, 7.2): gestrichen.
    const ai = monthOperations(world([company('ai', NEUTRAL, { aircraft: [plane('pl-p1')], routes: [route('r', 'pl-p1')] })], { disruptions: [defect] })).ai;
    close(ai.cancelledShare, 0.5);
    assert.equal(ai.charter, 0);
  });
});

describe('Abschnitt 8.10 Verschleiß und 5.13 Wert im Abschluss', () => {
  it('8.10: der Abschluss nutzt Kabine und Zelle ab; der Flottenwert am Monatsende ist kleiner', () => {
    const result = closeMonth(world([company('pl', PLAYER)]), NO_DECISIONS);
    const p = companyAfter(result.state, 'pl').aircraft[0];
    assert.ok(p.cabinCondition < 100 && p.airframeCondition < 100);
    assert.ok(result.reports.pl.fleetValueEnd < result.reports.pl.fleetValueStart);
    close(result.reports.pl.costs.depreciation, result.reports.pl.fleetValueStart - result.reports.pl.fleetValueEnd);
  });
});

describe('Abschnitt 8.14 Kreditlinie im Abschluss', () => {
  it('8.14: Zinsen aus der Kasse am Monatsanfang, Guthaben ohne Zinsen', () => {
    const pl = company('pl', PLAYER, { cash: -50_000_000, ledger: newLedger(-50_000_000, fleetValue([plane('pl-p1')], M), 0) });
    close(closeMonth(world([pl]), NO_DECISIONS).reports.pl.costs.interest, 333_333.333333, 1e-9);
    assert.equal(closeMonth(world([company('x', PLAYER)]), NO_DECISIONS).reports.x.costs.interest, 0);
  });

  it('8.14: nach 6 überzogenen Monaten in Folge ein Zwangsverkauf; die KI nicht (Notlage nach 7.15)', () => {
    const aircraft = [plane('pl-p1'), plane('pl-p2')];
    const opts = { cash: -500_000_000, overdrawnMonths: 5, aircraft, ledger: newLedger(0, fleetValue(aircraft, M), 0) };
    const player = closeMonth(world([company('pl', PLAYER, opts)]), NO_DECISIONS);
    assert.deepEqual(player.reports.pl.forcedSales, ['pl-p2']); // abgestellt zuerst
    assert.equal(companyAfter(player.state, 'pl').aircraft.length, 1);
    assert.equal(companyAfter(player.state, 'pl').overdrawnMonths, 6);
    assert.ok(player.state.resold.some((p) => p.id === 'pl-p2'));
    const rival = closeMonth(world([company('ai', NEUTRAL, { ...opts, aircraft: [plane('ai-p1'), plane('ai-p2')], routes: [route('r', 'ai-p1')] })]), NO_DECISIONS);
    assert.deepEqual(rival.reports.ai.forcedSales, []);
    assert.equal(companyAfter(rival.state, 'ai').overdrawnMonths, 6);
  });

  it('8.14: überzogen und ohne Flugzeug → Spielende', () => {
    const pl = company('pl', PLAYER, { cash: -1, aircraft: [], routes: [], ledger: newLedger(-1, 0, 0) });
    assert.deepEqual(closeMonth(world([pl]), NO_DECISIONS).bankrupt, ['pl']);
  });
});

describe('Abschnitt 8.16 Prüfung auf ungültige Zahlen', () => {
  it('8.16: ein ungültiger Wert steht im Log und behält den Wert vom Beginn des Abschlusses', () => {
    const s = world([company('ai', NEUTRAL)]);
    const result = closeMonth(s, (c) => ({ ...c, cash: Number.NaN }));
    assert.equal(companyAfter(result.state, 'ai').cash, 50_000_000);
    assert.equal(result.log.length, 1);
    assert.match(result.log[0], /cash/);
  });
});

describe('R2 Vorhersage = Abschluss, Preise ab X+1 (4.5)', () => {
  it('R2/8.1: die Vorhersage für X+1 ist das Ergebnis des Abschlusses von X+1', () => {
    const next = closeMonth(world([company('pl', PLAYER), company('ai', NEUTRAL)]), NO_DECISIONS).state;
    const forecast = monthOperations(next);
    const closed = closeMonth(next, NO_DECISIONS);
    for (const id of ['pl', 'ai']) {
      close(closed.reports[id].revenue, forecast[id].revenue);
      assert.deepEqual(closed.reports[id].routes, forecast[id].routes);
    }
  });

  it('4.5: eine Preisänderung ändert die Fluggäste des laufenden Monats nicht, aber die des nächsten', () => {
    const base = company('pl', PLAYER, { routes: [route('pl-r1', 'pl-p1', 'MAD', 140)] });
    const changed = { ...base, routes: base.routes.map((r) => ({ ...r, nextFareRatios: { economy: 0.7, business: 0.7 } })) };
    const a = closeMonth(world([base]), NO_DECISIONS);
    const b = closeMonth(world([changed]), NO_DECISIONS);
    assert.equal(b.reports.pl.passengers, a.reports.pl.passengers);
    assert.deepEqual(companyAfter(b.state, 'pl').routes[0].fareRatios, { economy: 0.7, business: 0.7 });
    assert.ok(monthOperations(b.state).pl.passengers > monthOperations(a.state).pl.passengers);
  });
});

describe('Abschnitt 8.0 Übergang zu X+1', () => {
  it('8.0: Monat + 1, Strecken älter, neues Kassenbuch, abgelaufene Kampagnen weg', () => {
    const inputs: CompanyInputs = { ...PLAYER, campaigns: [{ tier: 'local', regions: ['EU'], endMonth: M }] };
    const result = closeMonth(world([company('pl', inputs)]), NO_DECISIONS);
    const pl = companyAfter(result.state, 'pl');
    assert.equal(result.state.month, M + 1);
    assert.equal(pl.routes[0].ageMonths, 25);
    assert.equal(pl.inputs.campaigns.length, 0);
    assert.equal(pl.ledger.purchases, 0);
    assert.ok(result.reports.pl.costs.marketing > 0);
  });

  it('8.7: Moral ändert sich nur mit Personal-Modell', () => {
    const low: CompanyInputs = { ...PLAYER, salaryPct: 80 };
    const player = companyAfter(closeMonth(world([company('pl', low)]), NO_DECISIONS).state, 'pl');
    assert.ok(player.inputs.morale < 50);
    const rival = companyAfter(closeMonth(world([company('ai', { ...NEUTRAL, salaryPct: 80 })]), NO_DECISIONS).state, 'ai');
    assert.equal(rival.inputs.morale, 50);
  });
});
