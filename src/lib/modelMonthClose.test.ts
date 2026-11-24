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
import { PLAYER_ID, closeNewsMessages, defaultModelEnv, planesValue, type AppMonth } from './modelMonth';
import type { Disruption as AppDisruption } from './gameState';
import { cancelledOperations, charterQuestionFigures, launchPreviewMessage, modelDisruptionOf, modelMonthClose, rivalViewsBefore, type ModelCloseInput } from './modelMonthClose';
import { rivalMoves } from './newspaper';
import { withTradeValue } from './modelBridgeCompany';
import { CHARTER_MARKUP, WEEKS_PER_MONTH } from '../model/constants';
import { monthOperations } from '../model/monthClose';
import type { Disruption } from '../model/monthEvents';

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

  it('E76: Störungs-Frage rechnet den Monat X+1 zweimal (gestrichen, gechartert)', () => {
    const out = modelMonthClose(input(), ENV, ids()).month;
    const strike: Disruption = { month: M + 1, kind: 'airportStrike', target: 'FRA', share: 0.6 };
    const state = { ...out.state, disruptions: [...out.state.disruptions, strike] };
    const q = charterQuestionFigures(state, strike);
    const cancelled = monthOperations(state)[PLAYER_ID];
    const chartered = monthOperations({ ...state, disruptions: state.disruptions.map((d) => (d === strike ? { ...d, charter: true } : d)) })[PLAYER_ID];
    const near = (a: number, b: number) => assert.ok(Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
    const r = chartered.routes.find((x) => x.routeId === 'r1');
    assert.ok(r && r.plannedLegs > 0);
    near(q.flights, r.plannedLegs * WEEKS_PER_MONTH * 0.6);
    near(q.revenue, chartered.revenue - cancelled.revenue);
    near(q.fee, chartered.charter - cancelled.charter);
    near(q.fee, CHARTER_MARKUP * q.ownFlightCost);
    assert.ok(q.revenue > 0 && q.fee > 0 && q.passengerCost > 0);
    const result = (o: typeof cancelled) => o.routes.reduce((s, x) => s + x.result, 0) * WEEKS_PER_MONTH - o.charter;
    near(q.advantage, result(chartered) - result(cancelled));
    // Die mitgebrachte Rechnung „gestrichen“ ändert nichts.
    assert.deepEqual(charterQuestionFigures(state, strike, PLAYER_ID, cancelledOperations(state, strike)), q);
    // Unbekannte Gesellschaft oder Störung ohne getroffene Strecke: nichts.
    assert.equal(charterQuestionFigures(state, strike, 'niemand').fee, 0);
    const elsewhere: Disruption = { month: M + 1, kind: 'airportStrike', target: 'JFK', share: 0.6 };
    const q2 = charterQuestionFigures({ ...out.state, disruptions: [elsewhere] }, elsewhere);
    assert.equal(q2.flights, 0);
    assert.ok(Math.abs(q2.advantage) < 1e-6);
  });

  it('E76: die Gebühr der Frage bucht der nächste Abschluss, wenn der Spieler chartert', () => {
    const first = modelMonthClose(input(), ENV, ids()).month;
    const strike: Disruption = { month: M + 1, kind: 'airportStrike', target: 'FRA', share: 0.6 };
    const q = charterQuestionFigures({ ...first.state, disruptions: [...first.state.disruptions, strike] }, strike);
    const answered: AppDisruption = { id: 'dis_x', kind: 'airport-strike', offset: M + 1, routeIds: ['r1'], cancelShare: 0.6, ref: 'FRA', mitigated: true };
    assert.equal(modelDisruptionOf(answered, [strike]), strike);
    const n1 = next(input(), first);
    const second = modelMonthClose(
      { ...n1, modelWorld: { ...first.modelWorld, disruptions: [...first.modelWorld.disruptions, strike] }, disruptions: [answered] },
      ENV,
      ids(),
    ).month;
    assert.ok(Math.abs(second.modelReport.costs.charter - q.fee) <= 1e-6 * q.fee, `${second.modelReport.costs.charter} ≠ ${q.fee}`);
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
