/**
 * Regeltests zur Brücke Teil 2 (Paket 4.2c, E72, F55): Eingaben, Kassenbuch, Vorbestellungen und Lieferungen,
 * Berichte, Fortschritt; „Hin und zurück ändert nichts“ und ein ganzer Monat mit `closeMonth`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aircraftList } from '../data/aircraft';
import type { OwnedAircraft } from '../components/MyFleetView';
import { atCost } from '../model/basics';
import { LAUNCH_BONUS_MONTHS, STRIKE_FULL_CANCEL_SHARE, WEEKS_PER_MONTH } from '../model/constants';
import { fleetValueResultParts } from '../model/fleet';
import { closeMonth, fleetValue, NO_DECISIONS, type AircraftState, type CompanyState, type ModelState } from '../model/monthClose';
import { goalPenalty } from '../model/progress';
import { eventKey, historicalEvents } from './eventSystem';
import { createOwnedAircraft, defaultCabin } from './fleet';
import { createGameSystems, type Career, type Marketing, type ScenarioState, type Staff } from './gameState';
import type { AnnualGoal } from './annualGoals';
import type { MonthlyReport, SimulatedRoute } from './gameTypes';
import type { PreOrder } from './preorders';
import { aircraftState, modelAirports, modelOperations, applyModelOperations, type PlayerOperations, type RouteContext } from './modelBridge';
import {
  appReport,
  applyCompanyInputs,
  applyCompanyProgress,
  applyLedger,
  applyPreorders,
  applyScenario,
  capexOf,
  companyInputs,
  companyProgress,
  crisisResponses,
  deliveredAircraft,
  ffpMonthsRunning,
  historyReports,
  modelScenario,
  monthLedger,
  openLedgerValues,
  preorderState,
  rankHistory,
  reportMonth,
  staffStrike,
  withTradeValue,
  type PlayerInputsSource,
  type PlayerProgressSource,
} from './modelBridgeCompany';

const close = (actual: number, expected: number, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);

const M = (1995 - 1960) * 12 + 5; // Juni 1995
const A320 = aircraftList.find((a) => a.id === 'a320ceo')!;
const AIRPORTS = modelAirports();
const OIL_1973 = historicalEvents.find((e) => e.title === '1973 Oil Crisis')!;
const DOWNTURN = historicalEvents.find((e) => e.title === 'Aviation Downturn')!;
const GFC = historicalEvents.find((e) => e.title === 'Global Financial Crisis')!;

function plane(reg: string, month = M - 24): OwnedAircraft {
  const { config, baseInteriorPop } = defaultCabin(A320);
  const [p] = createOwnedAircraft(A320, 1, { config, baseInteriorPop, hub: 'FRA', existingRegistrations: [], purchasedAt: month });
  return { ...p, registration: reg };
}

function inputsSource(over: Partial<PlayerInputsSource> = {}): PlayerInputsSource {
  const marketing: Marketing = {
    campaigns: [
      { id: 'c1', tier: 'local', region: 'EU', startOffset: M - 2, duration: 6 },
      { id: 'c2', tier: 'global', region: 'NA', startOffset: M - 1, duration: 3 },
      { id: 'old', tier: 'national', region: 'AS', startOffset: M - 5, duration: 5 },
    ],
    ffpActive: true,
    ffpSinceOffset: M - 3,
  };
  const staff: Staff = { salaryPct: 110, morale: 64, strike: null };
  return {
    research: { done: ['eff-1', 'class-regional'] },
    staff,
    marketing,
    difficulty: 'Hard',
    eventChoices: {
      [eventKey(OIL_1973)]: 'hedge',
      [eventKey(DOWNTURN)]: 'reassure',
      [eventKey(GFC)]: 'ride',
    },
    ...over,
  };
}

describe('Eingaben (4.2c)', () => {
  it('liest Forschung, Lohn, Moral, laufende Kampagnen, Frequent flyer, Schwierigkeit und Spieler-Schalter', () => {
    const inputs = companyInputs(inputsSource(), M);
    assert.deepEqual(inputs.completedResearch, ['eff-1', 'class-regional']);
    assert.equal(inputs.salaryPct, 110);
    assert.equal(inputs.morale, 64);
    assert.deepEqual(inputs.campaigns, [
      { tier: 'local', regions: ['EU'], endMonth: M + 3 },
      { tier: 'global', regions: [], endMonth: M + 1 },
    ], 'abgelaufene Kampagne fehlt, weltweite ohne Regionen');
    assert.equal(inputs.ffpMonthsRunning, 4, 'der laufende Monat zählt mit');
    assert.equal(inputs.difficulty, 'Hard');
    assert.equal(companyInputs(inputsSource({ difficulty: 'Brutal' }), M).difficulty, 'Normal');
    assert.deepEqual([inputs.badLuckCap, inputs.charter, inputs.staffModel, inputs.forcedSale], [true, true, true, true]);
    assert.equal(inputs.staffStrike, undefined);
  });

  it('Frequent flyer: 1 im Startmonat, 0 wenn es nicht läuft', () => {
    assert.equal(ffpMonthsRunning({ ffpActive: true, ffpSinceOffset: M }, M), 1);
    assert.equal(ffpMonthsRunning({ ffpActive: false, ffpSinceOffset: null }, M), 0);
  });

  it('Krisen-Antworten: Absicherung und Rückgewinnung nach Titel, „abwarten“ zählt nicht', () => {
    assert.deepEqual(crisisResponses(inputsSource().eventChoices), { hedged: ['1973 Oil Crisis'], recovery: ['Aviation Downturn'] });
    assert.deepEqual(crisisResponses({ 'Unknown@3': 'hedge' }), { hedged: [], recovery: [] });
  });

  it('Streik: mit vereinbartem Lohn „Raise pay“, sonst ohne Antwort', () => {
    assert.deepEqual(staffStrike({ startOffset: M, cancelShare: 0.5, agreedPct: 115 }), { month: M, answer: 'raisePay', agreedPct: 115 });
    assert.deepEqual(staffStrike({ startOffset: M, cancelShare: 1 }), { month: M });
    assert.equal(staffStrike(null), undefined);
  });

  it('hin und zurück ändert nichts; nach dem Abschluss: Moral, neuer Streik, abgelaufene Kampagne', () => {
    const src = inputsSource();
    const running = { ...src, marketing: { ...src.marketing, campaigns: src.marketing.campaigns.filter((c) => c.id !== 'old') } };
    const same = applyCompanyInputs(running, companyInputs(running, M), M);
    assert.equal(same.staff, running.staff);
    assert.equal(same.marketing, running.marketing);
    // Eine schon abgelaufene Kampagne räumt das Zurückschreiben weg (wie `src/lib/marketing.ts:180`).
    assert.deepEqual(applyCompanyInputs(src, companyInputs(src, M), M).marketing.campaigns.map((c) => c.id), ['c1', 'c2']);
    const next = { ...companyInputs(src, M), morale: 61, staffStrike: { month: M + 2 } };
    const out = applyCompanyInputs(src, next, M + 2);
    assert.equal(out.staff.morale, 61);
    assert.deepEqual(out.staff.strike, { startOffset: M + 2, cancelShare: STRIKE_FULL_CANCEL_SHARE });
    assert.deepEqual(out.marketing.campaigns.map((c) => c.id), ['c1'], 'c2 endet im Monat M+1');
  });
});

describe('Kassenbuch (4.2c)', () => {
  const fleet = [aircraftState(plane('D-AAAA')), aircraftState(plane('D-AAAB'))];
  const capex = [
    { label: 'Aircraft Purchases', amount: 30e6 },
    { label: 'Used Aircraft', amount: 10e6 },
    { label: 'Cabin Refits', amount: 2e6 },
    { label: 'General Checks', amount: 1e6 },
    { label: 'Aircraft Sales', amount: -8e6 },
    { label: 'Crisis response: Aviation Downturn', amount: 5e6 },
    { label: 'Airport Slots', amount: 3e6 },
    { label: 'Aircraft Deposits', amount: 4e6 },
  ];

  it('Kasse am Anfang = Kasse + Σ Einmalausgaben; Posten in ihre Felder', () => {
    const values = withTradeValue(openLedgerValues(fleet, [], M), 33e6);
    const l = monthLedger(100e6, capex, values, M, { aircraft: fleet, preorders: [] });
    assert.equal(l.cashAtStart, 100e6 + 47e6);
    assert.deepEqual(
      [l.purchases, l.refits, l.overhauls, l.saleProceeds, l.crisisResponses],
      [40e6, 2e6, 1e6, 8e6, 5e6],
    );
    assert.deepEqual(l.otherSpending, { 'Airport Slots': 3e6, 'Aircraft Deposits': 4e6 });
    assert.equal(l.tradeValueChange, 33e6);
    close(l.fleetValueAtStart, fleetValue(fleet, M));
  });

  it('ohne Werte für den Monat gelten Geschäfte als zum Wert („Aircraft trades“ 0)', () => {
    const l = monthLedger(100e6, capex, openLedgerValues(fleet, [], M - 1), M, { aircraft: fleet, preorders: [] });
    assert.equal(l.tradeValueChange, 40e6 + 2e6 + 1e6 - 8e6);
    const parts = fleetValueResultParts({ valueStart: l.fleetValueAtStart, valueEnd: fleetValue(fleet, M), ...l });
    close(parts.trades, 0);
    close(parts.depreciation, 0, 1e-6);
  });

  it('hin und zurück ändert nichts; nach dem Abschluss leere Einmalausgaben', () => {
    const before = { capital: 100e6, monthlyCapex: capex, ledgerValues: openLedgerValues(fleet, [], M) };
    const fb = { aircraft: fleet, preorders: [] };
    const l = monthLedger(before.capital, before.monthlyCapex, before.ledgerValues, M, fb);
    assert.equal(applyLedger(before, 100e6, l, M, fb), before);
    const fresh = { ...l, cashAtStart: 120e6, tradeValueChange: 0, purchases: 0, refits: 0, overhauls: 0, saleProceeds: 0, crisisResponses: 0, otherSpending: {} };
    const out = applyLedger(before, 120e6, fresh, M + 1, fb);
    assert.equal(out.capital, 120e6);
    assert.deepEqual(out.monthlyCapex, []);
    assert.equal(out.ledgerValues?.month, M + 1);
    assert.deepEqual(capexOf(l).find((c) => c.label === 'Aircraft Sales'), { label: 'Aircraft Sales', amount: -8e6 });
  });
});

describe('Vorbestellungen und Lieferungen (4.2c)', () => {
  const order: PreOrder = { id: 'ord1', aircraftId: 'a320ceo', quantity: 2, placedOffset: M - 6, deliveryOffset: M, unitPrice: 1, deposit: 9e6, postponed: 1 };

  it('Standard-Kabine, Anzahlung, Liefermonat, Verschiebungen, Erstauslieferung', () => {
    const p = preorderState(order);
    assert.deepEqual([p.count, p.deposit, p.deliveryMonth, p.delays, p.firstDeliveryOffset], [2, 9e6, M, 1, A320.firstDeliveryOffset]);
    assert.deepEqual(p.plane.seats, { economy: A320.capacity });
    const owned = aircraftState(plane('D-XXXX', M));
    assert.deepEqual(p.plane.interiorScore, owned.interiorScore, 'wie ein am Liefermonat gekauftes Flugzeug');
    assert.equal(p.plane.cabinListPrice1960, owned.cabinListPrice1960);
    assert.throws(() => preorderState({ ...order, aircraftId: 'nope' }), /fehlt im Katalog/);
  });

  it('hin und zurück ändert nichts; verschoben und geliefert', () => {
    const orders = [order, { ...order, id: 'ord2', deliveryOffset: M + 4 }];
    assert.equal(applyPreorders(orders, orders.map((o) => preorderState(o))), orders);
    const delayed = { ...preorderState(order), deliveryMonth: M + 1, delays: 2 };
    const out = applyPreorders(orders, [delayed]);
    assert.deepEqual(out.map((o) => [o.id, o.deliveryOffset, o.postponed]), [['ord1', M + 1, 2]]);
  });

  it('geliefertes Flugzeug liest sich wieder wie im Modell (bis auf die Kennung)', () => {
    const p = preorderState(order);
    const delivered: AircraftState[] = [1, 2].map((i) => ({
      ...p.plane, id: `ord1-${i}`, builtMonth: M, cabinInstalledMonth: M, airframeCondition: 100, cabinCondition: 100, launchCustomer: true,
    }));
    const { planes, renamed } = deliveredAircraft(delivered, { hub: 'FRA', existingRegistrations: ['D-AAAA'] });
    assert.equal(new Set(planes.map((x) => x.registration)).size, 2);
    assert.ok(!planes.some((x) => x.registration === 'D-AAAA'));
    planes.forEach((x, i) => {
      assert.equal(renamed[`ord1-${i + 1}`], x.registration);
      assert.equal(x.launchBonusUntil, M + LAUNCH_BONUS_MONTHS);
      assert.deepEqual({ ...aircraftState(x), id: delivered[i].id }, delivered[i]);
    });
  });
});

describe('Fortschritt (4.2c)', () => {
  const goal: AnnualGoal = { year: 1995, kind: 'routes', tag: 'focus', target: 12, reward: 1e6, penalty: goalPenalty(1e6) };
  const reports: MonthlyReport[] = [1, 2, 3, 4].map((i) => ({
    month: i, year: 1995, routeRevenues: 10e6 * i, routeCosts: 0, airportUpkeep: 0, totalProfit: 1e6 * i, breakdown: {},
    paxTotal: 1000 * i, routeCount: 3 + i, reputation: 50 + i, regions: ['EU', 'NA'],
  }));
  function source(over: Partial<PlayerProgressSource> = {}): PlayerProgressSource {
    const career: Career = {
      ...createGameSystems().career,
      rank: 3,
      careerPax: 123_456,
      takeovers: 1,
      research: { done: ['eff-1'], active: [{ id: 'sat-1', startMonth: M - 2 }] },
      goalOffer: null,
    };
    return { career, milestones: ['first-route', 'regions-2', 'reputation-bronze'], annualGoal: goal, scenario: null, startMonth: (1990 - 1960) * 12, reports, ...over };
  }

  it('liest Rang, Rang-Werte, Forschung, Meilensteine, Fluggäste, Übernahmen und Jahresziel', () => {
    const p = companyProgress(source(), M);
    assert.equal(p.rank, 3);
    assert.deepEqual(p.research, { done: ['eff-1'], active: [{ id: 'sat-1', startMonth: M - 2 }] });
    assert.deepEqual(p.milestones, ['first-route', 'regions-2', 'reputation-bronze']);
    assert.deepEqual([p.careerPax, p.takeovers], [123_456, 1]);
    assert.deepEqual(p.goal, { year: 1995, kind: 'routes', tag: 'focus', target: 12, reward: 1e6, penalty: goalPenalty(1e6) });
    assert.deepEqual(p.rankHistory.map((s) => s.routes), [5, 6, 7], 'die letzten 3 Berichte');
    assert.deepEqual(p.rankHistory[2], { routes: 7, monthlyPax: 4000, reputation: 54, regions: 2, years: 5 });
    assert.equal(p.goalOffers, undefined);
    assert.equal(rankHistory(reports, 0, reportMonth(reports[1])).length, 1, 'nur Berichte vor dem Monat');
  });

  it('Szenario: Dollar-Ziele in $ von 1960, Untergrenze in Monaten, Stichtag; Entscheidung mit Grund', () => {
    const s: ScenarioState = { id: 'jet-age', startedOffset: 0, status: 'running' };
    const m = modelScenario(s);
    close(m.win[0].target, 100e6 / atCost(1, 0));
    assert.deepEqual([m.floorMonths, m.deadline, m.floorStreak, m.met, m.status], [3, (1964 - 1960) * 12 + 11, 0, [], 'running']);
    const oil = modelScenario({ id: 'oil-shock', startedOffset: 165, status: 'running' });
    assert.equal(oil.win[0].target, 60, 'Ruf bleibt');
    assert.equal(oil.win[0].atDeadline, true);
    assert.equal(applyScenario(s, m, M), s);
    const won = applyScenario(s, { ...m, met: ['capital'], status: 'won' }, M);
    assert.deepEqual(won.result, { offset: M, reason: 'Every goal met.' });
    assert.deepEqual(won.met, ['capital']);
    const lost = applyScenario(s, { ...m, floorStreak: 3, status: 'lost' }, M);
    assert.match(lost.result!.reason, /3 month-ends/);
    assert.throws(() => modelScenario({ id: 'moon', startedOffset: 0, status: 'running' }), /Unbekanntes Szenario/);
  });

  it('hin und zurück ändert nichts (mit Szenario und Angebot)', () => {
    const src = source({
      scenario: { id: 'hub-builder', startedOffset: 360, status: 'running', floorStreak: 1, met: ['transfer'] },
      career: { ...source().career, goalOffer: { year: 1996, options: [goal, { ...goal, kind: 'profit', tag: 'steady', target: 5e6 }] } },
    });
    const out = applyCompanyProgress(src, companyProgress(src, M), M);
    assert.equal(out.career, src.career);
    assert.equal(out.milestones, src.milestones);
    assert.equal(out.annualGoal, src.annualGoal);
    assert.equal(out.scenario, src.scenario);
  });

  it('Zurückschreiben: Rang, Forschung fertig, neuer Meilenstein in Kennung des Modells, neues Angebot', () => {
    const src = source();
    const p = companyProgress(src, M);
    const offers: AnnualGoal[] = [{ ...goal, year: 1996 }, { ...goal, year: 1996, kind: 'profit', tag: 'stretch', target: 9e6 }];
    const out = applyCompanyProgress(src, {
      ...p,
      rank: 4,
      research: { done: ['eff-1', 'sat-1'], active: [] },
      milestones: [...p.milestones, 'regions-4'],
      goalOffers: offers,
      goal: offers[0],
    }, M);
    assert.equal(out.career.rank, 4);
    assert.deepEqual(out.career.research, { done: ['eff-1', 'sat-1'], active: [] });
    assert.deepEqual(out.milestones, ['first-route', 'regions-2', 'reputation-bronze', 'regions-4']);
    assert.equal(out.career.goalOffer?.year, 1996);
    assert.equal(out.career.goalOffer?.options.length, 2);
    assert.equal(out.annualGoal?.year, 1996);
    assert.deepEqual(out.annualGoal, offers[0]);
  });

  it('gespeicherte Berichte: Monat, Ergebnis, Erlös, Fluggäste für das Jahresziel', () => {
    const h = historyReports(reports, 'player', reportMonth(reports[3]));
    assert.deepEqual(h.map((r) => [r.month, r.result, r.revenue, r.passengers]), [
      [M - 5, 1e6, 10e6, 1000],
      [M - 4, 2e6, 20e6, 2000],
      [M - 3, 3e6, 30e6, 3000],
    ]);
  });
});

describe('Ein Monat über die Brücke (4.2c)', () => {
  const CTX: RouteContext = { month: M, startMonth: M - 60, airports: AIRPORTS };
  const route: SimulatedRoute = {
    id: 'r1', airline: 'Player', origin: 'FRA', destination: 'MAD', distance: 1420, aircraft: 'D-AAAA', weeklyFlights: 7, paxPerWeek: 0,
    classConfigs: { economy: { catering: [['b15']], extras: [], service: [] } },
    ticketPrices: { economy: 150 },
  };
  const ops: PlayerOperations = { fleet: [plane('D-AAAA')], routes: [route], airportManagement: {} };
  const order: PreOrder = { id: 'ord1', aircraftId: 'a320ceo', quantity: 1, placedOffset: M - 6, deliveryOffset: M, unitPrice: 1, deposit: 9e6, postponed: 0 };

  function stateOf(): ModelState {
    const m = modelOperations(ops, CTX);
    const preorders = [preorderState(order)];
    const player: CompanyState = {
      id: 'player',
      cash: 200e6,
      reputation: 55,
      inputs: companyInputs(inputsSource({ staff: { salaryPct: 100, morale: 70, strike: null } }), M),
      aircraft: m.aircraft,
      routes: m.routes,
      airports: m.airports,
      preorders,
      overdrawnMonths: 0,
      profitStreak: 0,
      ledger: monthLedger(200e6, [], undefined, M, { aircraft: m.aircraft, preorders }),
      reports: [],
      progress: companyProgress({ career: createGameSystems().career, milestones: [], annualGoal: null, scenario: null, startMonth: M - 60, reports: [] }, M),
    };
    return { month: M, seed: 11, airports: AIRPORTS, randomEvents: [], disruptions: [], badLuck: false, resold: [], companies: [player] };
  }

  it('Lieferung kommt in die Flotte, Bestellung fällt weg, Kasse und Bericht zurück', () => {
    const { state, reports } = closeMonth(stateOf(), NO_DECISIONS);
    const company = state.companies[0];
    const ctx1 = { ...CTX, month: state.month };
    const applied = applyModelOperations(ops, company, ctx1);
    assert.equal(applied.newAircraft.length, 1);
    const { planes } = deliveredAircraft(applied.newAircraft, { hub: 'FRA', existingRegistrations: applied.fleet.map((p) => p.registration) });
    assert.equal(planes[0].purchasedAt, M);
    assert.deepEqual(applyPreorders([order], company.preorders), []);

    const ledger = applyLedger({ capital: 200e6, monthlyCapex: [] }, company.cash, company.ledger, state.month, { aircraft: company.aircraft, preorders: [] });
    assert.equal(ledger.capital, company.cash);
    assert.deepEqual(ledger.monthlyCapex, []);
    close(ledger.ledgerValues!.fleetValueAtStart, fleetValue(company.aircraft, state.month));

    const report = reports.player;
    assert.equal(report.deliveries[0].outcome, 'deliver');
    const r = appReport(report, { routes: ops.routes, airports: AIRPORTS, morale: company.inputs.morale, fleetSize: company.aircraft.length, routeCount: company.routes.length, capex: [] });
    assert.deepEqual([r.month, r.year], [6, 1995]);
    assert.equal(r.totalProfit, report.result);
    assert.equal(r.capitalAfter, company.cash);
    assert.equal(r.routeRevenues + 0, report.revenue);
    close(r.routes![0].profit, report.routes[0].result * WEEKS_PER_MONTH);
    assert.equal(r.routes![0].name, 'FRA-MAD (D-AAAA)');
    assert.deepEqual(r.regions, ['EU']);
    assert.equal(r.fleetSize, 2);
  });
});
