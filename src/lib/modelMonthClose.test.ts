/**
 * Regeltests Paket 4.2f (F58): Monatsabschluss der Oberfläche über das Modell (`modelMonthClose`) mit Meldungen,
 * Fragen, Chronik und Zeitung; gespeicherte Felder überstehen Speichern und Laden (JSON).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { AiAirline } from '../components/CompetitorsView';
import type { OwnedAircraft } from '../components/MyFleetView';
import { aircraftList } from '../data/aircraft';
import { createOwnedAircraft, defaultCabin } from './fleet';
import { createGameSystems } from './gameState';
import type { AirportInfrastructure, SimulatedRoute } from './gameTypes';
import { closeNewsMessages, defaultModelEnv, planesValue, type AppMonth } from './modelMonth';
import { disruptionCharterEstimate, launchPreviewMessage, modelMonthClose, rivalViewsBefore, type ModelCloseInput } from './modelMonthClose';
import { rivalMoves } from './newspaper';
import { withTradeValue } from './modelBridgeCompany';
import { WEEKS_PER_MONTH } from '../model/constants';
import { charterCost, disruptionShares } from '../model/monthEvents';

const ENV = defaultModelEnv();
const A320 = aircraftList.find((a) => a.id === 'a320ceo')!;
/** Juli 1990: der Abschluss führt in den August 1990 (Golfkrieg mit Krisen-Antwort beginnt). */
const M = (1990 - 1960) * 12 + 6;

function plane(reg: string, month = M - 24): OwnedAircraft {
  const { config, baseInteriorPop } = defaultCabin(A320);
  const [p] = createOwnedAircraft(A320, 1, { config, baseInteriorPop, hub: 'FRA', existingRegistrations: [], purchasedAt: month });
  return { ...p, registration: reg };
}

const infra = (level: 1 | 2 | 3, narrowbody: number): AirportInfrastructure => ({
  level,
  slots: { regional: 0, narrowbody, widebody: 0 },
  stands: { narrowbody: 2, widebody: 0 },
  desks: { normal: 2, self: 0 },
});

const ROUTE: SimulatedRoute = {
  id: 'r1', airline: 'Player', origin: 'FRA', destination: 'MAD', distance: 1420, aircraft: 'D-AAAA', weeklyFlights: 7, paxPerWeek: 0,
  classConfigs: { economy: { catering: [['b15']], extras: [], service: [] } },
  ticketPrices: { economy: 150 },
};

function oldRival(): AiAirline {
  return {
    id: 'ai_lh', name: 'Lufthansa', code: 'LH', hub: 'FRA', capital: 300e6, aiDifficulty: 'Normal',
    fleet: [{
      id: A320.id, manufacturer: A320.manufacturer, family: A320.family, type: A320.type, class: 'narrowbody', reg: 'LH-A100',
      capacity: A320.capacity, purchasedAt: M - 30, conditionGeneral: 81, conditionInterior: 64, config: { economy: 150, premium: 0, business: 0, first: 0 },
    }],
    routes: [{ origin: 'FRA', destination: 'MAD', aircraftClass: 'narrowbody', departures: 7, monthlyProfit: 1e5, aircraftReg: 'LH-A100', aircraft: A320.id, openedAt: M - 20 }],
    monthlyProfitsHistory: [1e5, 2e5],
    personality: 'flag',
    isReal: true,
    color: '#123456',
  };
}

function input(over: Partial<ModelCloseInput> = {}): ModelCloseInput {
  const sys = createGameSystems();
  return {
    month: M,
    startMonth: M - 60,
    airlineCode: 'XA',
    brandingColor: '#ffcc00',
    selectedHub: 'FRA',
    difficulty: 'Normal',
    aiDifficulty: 'Normal',
    aiAirlinesCount: 3,
    capital: 150e6,
    monthlyCapex: [],
    fleet: [plane('D-AAAA')],
    routes: [ROUTE],
    airportManagement: { FRA: infra(2, 20), MAD: infra(1, 10) },
    reputation: 55,
    profitStreak: 0,
    staff: { salaryPct: 100, morale: 70, strike: null },
    marketing: sys.marketing,
    eventChoices: {},
    career: sys.career,
    milestones: [],
    annualGoal: null,
    scenario: null,
    reportHistory: [],
    aiAirlines: [oldRival()],
    randomEvents: [],
    disruptions: [],
    airlineName: 'Test Air',
    chronicle: [],
    homeRegion: 'EU',
    scenarioStars: {},
    gameSettings: { newspaper: true },
    autosaveInterval: 0,
    freeMode: false,
    latestReport: null,
    getFuelData: () => ({ price: 2, trend: '0%' }),
    getBaseGlobalDemand: () => ({ value: 1, trend: '0%' }),
    ...over,
  };
}

/** Wie `App.tsx` die Felder nach dem Abschluss setzt. */
function next(i: ModelCloseInput, m: AppMonth): ModelCloseInput {
  return {
    ...i,
    month: m.month,
    capital: m.capital,
    monthlyCapex: m.monthlyCapex,
    ledgerValues: m.ledgerValues,
    overdrawnMonths: m.overdrawnMonths,
    fleet: m.fleet,
    routes: m.routes,
    airportManagement: m.airportManagement,
    reputation: m.reputation,
    profitStreak: m.profitStreak,
    staff: m.staff,
    marketing: m.marketing,
    career: m.career,
    milestones: m.milestones,
    annualGoal: m.annualGoal,
    scenario: m.scenario,
    reportHistory: m.reportHistory,
    aiAirlines: m.aiAirlines,
    rivals: m.rivals,
    modelWorld: m.modelWorld,
    randomEvents: m.randomEvents,
    disruptions: m.disruptions,
    latestReport: m.report,
  };
}

const ids = () => {
  let n = 0;
  return () => ++n;
};

describe('Monatsabschluss der Oberfläche über das Modell (4.2f)', () => {
  const i = input();
  const out = modelMonthClose(i, ENV, ids());

  it('Felder aus dem Modell; Bericht mit Marktanteil auch in der Liste', () => {
    assert.equal(out.month.month, M + 1);
    assert.equal(out.month.capital, out.month.modelReport.cashEnd);
    assert.equal(typeof out.month.report.marketShare, 'number');
    assert.equal(out.month.reportHistory[out.month.reportHistory.length - 1], out.month.report);
  });

  it('Ereignis mit Krisen-Antwort beginnt: Meldung und Frage (wie der alte Abschluss)', () => {
    assert.ok(out.crisisQuestion, 'Golfkrieg im August 1990');
    assert.ok(out.messages.some((m) => m.text.includes(out.crisisQuestion!.title)));
    // Mit gespeicherter Antwort keine Frage.
    const key = `${out.crisisQuestion!.title}@${out.crisisQuestion!.startOffset}`;
    assert.equal(modelMonthClose(input({ eventChoices: { [key]: 'x' } }), ENV, ids()).crisisQuestion, null);
  });

  it('Zeitung, Chronik, keine Szenario-Sterne im freien Spiel', () => {
    assert.equal(out.edition.offset, M + 1);
    assert.equal(out.openNewspaper, true);
    assert.equal(out.scenarioStars, null);
    assert.equal(out.scenarioResultOpen, false);
  });

  it('Zeitung beim ersten Abschluss: umgewandelte KI gilt nicht als aufgelöst und neu gegründet', () => {
    const moves = rivalMoves(rivalViewsBefore(i), [...out.month.aiAirlines]);
    assert.ok(!moves.some((m) => m.code === 'LH' && (m.kind === 'folded' || m.kind === 'founded')));
    assert.equal(rivalViewsBefore({ rivals: out.month.rivals, aiAirlines: out.month.aiAirlines })[0].id, 'rival-LH');
  });

  it('Autosave nach dem eingestellten Abstand', () => {
    assert.equal(out.autosave, false);
    assert.equal(modelMonthClose(input({ autosaveInterval: 1 }), ENV, ids()).autosave, true);
  });

  it('Gleicher Spielstand, gleiches Ergebnis (8.3)', () => {
    const again = modelMonthClose(input(), ENV, ids());
    assert.equal(again.month.capital, out.month.capital);
    assert.deepEqual(again.messages.map((m) => m.text), out.messages.map((m) => m.text));
  });

  it('Speichern und Laden (JSON) ändert den nächsten Monat nicht', () => {
    const n1 = next(i, out.month);
    const loaded = { ...n1, ...JSON.parse(JSON.stringify(n1)) } as ModelCloseInput;
    const a = modelMonthClose(n1, ENV, ids());
    const b = modelMonthClose(loaded, ENV, ids());
    assert.equal(b.month.capital, a.month.capital);
    assert.equal(b.month.reputation, a.month.reputation);
    assert.deepEqual(b.month.aiAirlines.map((x) => x.capital), a.month.aiAirlines.map((x) => x.capital));
    assert.deepEqual(b.month.modelReport.costs, a.month.modelReport.costs);
  });
});

describe('Hilfen des Abschlusses (4.2f)', () => {
  it('Flugzeug-Vorschau nur zum Januar', () => {
    assert.equal(launchPreviewMessage(M + 1, 1), null);
    const jan = launchPreviewMessage((1991 - 1960) * 12, 7);
    assert.ok(jan?.text.startsWith('LAUNCH PREVIEW 1991'));
    assert.equal(jan?.id, 7);
  });

  it('5.2e: Charter-Schätzung einer Störung aus den Strecken-Zahlen des Abschlusses (8.9)', () => {
    const f = {
      routeId: 'r1', plannedLegs: 14, shares: disruptionShares([{ share: 0.3, chartered: false }]),
      revenue: 98_000, passengerCost: { catering: 4_000, fees: 2_300, ffp: 0, total: 6_300 }, flightOpsFull: 42_000,
    };
    const e = disruptionCharterEstimate({ routeIds: ['r1', 'neu'], cancelShare: 0.5 }, [f]);
    const operated = 14 * 0.7;
    const flights = 14 * WEEKS_PER_MONTH * 0.5;
    const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);
    near(e.flights, flights);
    near(e.revenue, (98_000 / operated) * flights);
    near(e.passengerCost, (6_300 / operated) * flights);
    near(e.ownFlightCost, (42_000 / 14) * flights);
    near(e.fee, 1.5 * e.ownFlightCost);
    near(e.advantage, e.revenue - e.passengerCost - e.fee);
    // Gebühr = was der Abschluss X+1 bucht, wenn die Störung gechartert wird (`charterCost`).
    near(e.fee, charterCost([{ flightOpsWeekly: 42_000, plannedLegsPerWeek: 14, charteredShare: 0.5 }]));
    // Strecke ohne Zahlen oder ohne durchgeführte Flüge: keine Schätzung.
    const none = disruptionCharterEstimate({ routeIds: ['r1'], cancelShare: 0.5 }, [{ ...f, shares: disruptionShares([{ share: 1, chartered: false }]) }]);
    assert.equal(none.revenue, 0);
    assert.equal(disruptionCharterEstimate({ routeIds: ['neu'], cancelShare: 0.5 }, [f]).flights, 0);
  });

  it('5.2e: Schätzung mit den echten Zahlen des Abschlusses', () => {
    const figures = modelMonthClose(input(), ENV, ids()).month.modelReport.routes;
    const r = figures.find((x) => x.routeId === 'r1');
    assert.ok(r && r.revenue > 0);
    const e = disruptionCharterEstimate({ routeIds: ['r1'], cancelShare: 0.5 }, figures);
    assert.ok(e.flights > 0 && e.revenue > 0 && e.fee > 0);
    assert.ok(Math.abs(e.fee - charterCost([{ flightOpsWeekly: r.flightOpsFull, plannedLegsPerWeek: r.plannedLegs, charteredShare: 0.5 }])) < 1e-6);
  });

  it('Zufallsereignis meldet die Oberfläche selbst (keine doppelte Meldung)', () => {
    const news = [{ kind: 'randomEvent' as const, companyId: 'world', subject: 'Economic Slump' }];
    const ctx = { month: M, before: { companies: [] }, after: { companies: [] }, rivals: [], playerAirports: new Set<string>(), orders: [], catalog: aircraftList, newId: ids() };
    assert.equal(closeNewsMessages(news, ctx).length, 1);
    assert.equal(closeNewsMessages(news, { ...ctx, texts: { skipKinds: ['randomEvent'] } }).length, 0);
  });

  it('Geschäfte im Kassenbuch: Kauf + Wert nach dem Wertmodell', () => {
    const p = plane('D-BBBB', M);
    const v = planesValue([p], M);
    assert.ok(v > 0);
    const values = { month: M, fleetValueAtStart: 0, depositsAtStart: 0, tradeValueChange: 0 };
    assert.equal(withTradeValue(values, v).tradeValueChange, v);
    assert.equal(planesValue([], M), 0);
  });
});
