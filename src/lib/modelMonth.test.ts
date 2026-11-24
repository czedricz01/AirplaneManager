/**
 * Regeltests Paket 4.2e (F57): der ganze Spielstand der Oberfläche als `ModelState`, ein und zwei Monate über das
 * Modell (`runModelMonth`), Meldungstexte (`closeNewsMessages`).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { AiAirline } from '../components/CompetitorsView';
import type { OwnedAircraft } from '../components/MyFleetView';
import { aircraftList } from '../data/aircraft';
import { REPORT_HISTORY_MONTHS } from '../model/constants';
import type { CloseNews, CompanyState, RouteState } from '../model/monthClose';
import { createOwnedAircraft, defaultCabin } from './fleet';
import { createGameSystems, type Disruption as AppDisruption } from './gameState';
import type { AirportInfrastructure, SimulatedRoute } from './gameTypes';
import type { PreOrder } from './preorders';
import { worldSeed, type RivalRecord } from './modelBridgeWorld';
import { START_HUB_SETUP } from '../model/constants';
import { rivalAgentOf } from '../model/rivalMonth';
import {
  PLAYER_ID,
  START_RIVAL_TRIES,
  closeNewsMessages,
  defaultModelEnv,
  foundStartRivals,
  modelGame,
  playerAirportIds,
  playerHubs,
  rivalStrength,
  runModelMonth,
  type AppGame,
  type AppMonth,
  type NewsContext,
} from './modelMonth';

const M = (1995 - 1960) * 12 + 5; // Juni 1995
const ENV = defaultModelEnv();
const A320 = aircraftList.find((a) => a.id === 'a320ceo')!;

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

const ORDER: PreOrder = { id: 'ord1', aircraftId: 'a320ceo', quantity: 1, placedOffset: M - 6, deliveryOffset: M, unitPrice: 1, deposit: 9e6, postponed: 0 };

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

function game(over: Partial<AppGame> = {}): AppGame {
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
    career: { ...sys.career, orders: [ORDER] },
    milestones: [],
    annualGoal: null,
    scenario: null,
    reportHistory: [],
    aiAirlines: [oldRival()],
    randomEvents: [],
    disruptions: [],
    ...over,
  };
}

/** Das Ergebnis eines Monats als Spielstand des nächsten (wie `App.tsx` es in 4.2f speichert). */
function nextGame(g: AppGame, m: AppMonth): AppGame {
  return {
    ...g,
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
  };
}

const fixedIds = () => {
  let n = 0;
  return () => ++n;
};

describe('Spielstand → ModelState (4.2e)', () => {
  it('Drehkreuze des Spielers: Heimat und Stufe 2/3 (F57)', () => {
    assert.deepEqual(playerHubs('FRA', { MAD: infra(1, 1), LHR: infra(3, 1), CDG: infra(2, 1) }), ['CDG', 'FRA', 'LHR']);
    assert.deepEqual(playerHubs('', {}), []);
  });

  it('KI-Stärke: bekannte Werte, sonst normal', () => {
    assert.equal(rivalStrength('Hard'), 'hard');
    assert.equal(rivalStrength('Expert'), 'normal');
  });

  it('Spieler zuerst, KI umgewandelt, Welt aus dem alten Spielstand', () => {
    const { state, rivals, world } = modelGame(game(), ENV);
    assert.equal(state.month, M);
    assert.deepEqual(state.companies.map((c) => c.id), [PLAYER_ID, 'rival-LH']);
    const p = state.companies[0];
    assert.equal(p.cash, 150e6);
    assert.equal(p.reputation, 55);
    assert.deepEqual(p.hubs, ['FRA']);
    assert.equal(p.aircraft.length, 1);
    assert.equal(p.routes.length, 1);
    assert.equal(p.preorders.length, 1);
    assert.equal(p.agent, undefined);
    assert.ok(p.progress);
    assert.equal(rivals[0].name, 'Lufthansa');
    assert.equal(world.seed, worldSeed('XA', M - 60));
    assert.equal(state.seed, world.seed);
    assert.equal(state.catalog?.length, aircraftList.length);
  });

  it('Charter-Antwort des Spielers aus der Ansicht kommt ins Modell', () => {
    const old: AppDisruption = { id: `dis_${M}_technical_r1`, kind: 'technical', offset: M, routeIds: ['r1'], cancelShare: 0.5, ref: 'D-AAAA' };
    const asked = modelGame(game({ disruptions: [old] }), ENV);
    assert.equal(asked.state.disruptions[0].charter, undefined);
    // Gespeicherter Welt-Zustand ohne Charter, Ansicht mit Charter (Antwort im Dialog) → Modell mit Charter.
    const answered = modelGame(game({ modelWorld: asked.world, disruptions: [{ ...old, mitigated: true }] }), ENV);
    assert.equal(answered.state.disruptions[0].charter, true);
    // Ohne Antwort bleibt der gespeicherte Welt-Zustand dasselbe Objekt.
    assert.equal(modelGame(game({ modelWorld: asked.world, disruptions: [old] }), ENV).world, asked.world);
  });
});

describe('Ein Monat über das Modell (4.2e)', () => {
  const g = game();
  const out = runModelMonth(g, ENV, fixedIds());

  it('Monat, Kasse und Bericht passen zusammen (8.2)', () => {
    assert.equal(out.month, M + 1);
    assert.equal(out.capital, out.modelReport.cashEnd);
    assert.equal(out.report.capitalAfter, out.capital);
    assert.equal(out.report.totalProfit, out.modelReport.result);
    assert.deepEqual([out.report.month, out.report.year], [6, 1995]);
    assert.equal(out.reportHistory.length, 1);
    assert.equal(out.reportHistory[0], out.report);
    assert.deepEqual(out.monthlyCapex, []);
    assert.equal(out.ledgerValues?.month, M + 1);
    assert.equal(out.bankrupt, false);
    assert.deepEqual(out.log, []);
  });

  it('Lieferung kommt in die Flotte (Kennzeichen), Bestellung fällt weg, Meldung', () => {
    assert.equal(out.fleet.length, 2);
    assert.equal(out.fleet[0].registration, 'D-AAAA');
    const delivered = out.fleet[1];
    assert.equal(delivered.id, 'a320ceo');
    assert.equal(Object.values(out.renamed)[0], delivered.registration);
    assert.deepEqual(out.career.orders, []);
    assert.ok(out.messages.some((m) => m.text.startsWith('DELIVERY: 1 × Airbus')));
  });

  it('KI im Modell-Format gespeichert, Ansicht daraus; Welt-Zustand gespeichert', () => {
    assert.ok(out.rivals.length >= 1);
    assert.equal(out.rivals[0].name, 'Lufthansa');
    assert.equal(out.rivals[0].company.id, 'rival-LH');
    assert.ok(out.aiAirlines.some((a) => a.code === 'LH'));
    assert.equal(out.modelWorld.seed, worldSeed('XA', M - 60));
  });

  it('Gleicher Spielstand, gleiches Ergebnis (8.3)', () => {
    const again = runModelMonth(g, ENV, fixedIds());
    assert.deepEqual(again, out);
  });

  it('Zwei Monate hintereinander: gespeicherte Felder werden gelesen', () => {
    const g2 = nextGame(g, out);
    const out2 = runModelMonth(g2, ENV, fixedIds());
    assert.equal(out2.month, M + 2);
    assert.equal(out2.rivals.find((r) => r.company.id === 'rival-LH')?.color, '#123456');
    // Kassenbuch des zweiten Monats beginnt mit der Kasse und dem Flottenwert vom Ende des ersten.
    assert.equal(out2.modelReport.cashStart, out.capital);
    assert.ok(Math.abs(out2.modelReport.fleetValueStart - out.modelReport.fleetValueEnd) < 1e-6);
    assert.equal(out2.reportHistory.length, 2);
    assert.equal(out2.fleet.length, 2);
  });

  it('Berichte höchstens REPORT_HISTORY_MONTHS', () => {
    const many = Array.from({ length: REPORT_HISTORY_MONTHS }, () => out.report);
    const o = runModelMonth({ ...g, reportHistory: many.map((r, i) => ({ ...r, month: ((M - REPORT_HISTORY_MONTHS + i) % 12) + 1, year: 1960 + Math.floor((M - REPORT_HISTORY_MONTHS + i) / 12) })) }, ENV, fixedIds());
    assert.equal(o.reportHistory.length, REPORT_HISTORY_MONTHS);
    assert.equal(o.reportHistory[REPORT_HISTORY_MONTHS - 1], o.report);
  });
});

describe('Meldungen des Abschlusses (4.2e)', () => {
  const route = (id: string, from: string, to: string): RouteState => ({
    id, aircraftId: 'rival-LH-A100', from, to, departuresPerWeek: 14, ageMonths: 12, service: {},
  });
  const rival = { id: 'rival-LH', routes: [route('a', 'FRA', 'MAD'), route('b', 'JFK', 'LAX')], hubs: ['FRA'] } as unknown as CompanyState;
  const record = { name: 'Lufthansa', code: 'LH', isReal: true, company: rival } as RivalRecord;
  const ctx = (): NewsContext => ({
    month: M,
    before: { companies: [rival] },
    after: { companies: [rival] },
    rivals: [record],
    playerAirports: playerAirportIds({ FRA: infra(2, 1) }, [ROUTE]),
    orders: [ORDER],
    catalog: aircraftList,
    newId: fixedIds(),
  });
  const texts = (news: CloseNews[]) => closeNewsMessages(news, ctx()).map((m) => m.text);

  it('KI-Preiskampf nur an Flughäfen des Spielers (7.17)', () => {
    assert.deepEqual(texts([{ companyId: 'rival-LH', kind: 'priceWarStarted', subject: 'a' }]), ['PRICE WAR: Lufthansa cuts its fares on FRA-MAD.']);
    assert.deepEqual(texts([{ companyId: 'rival-LH', kind: 'priceWarStarted', subject: 'b' }]), []);
  });

  it('Neue KI und Auflösung immer; Käufe und Dividende nie', () => {
    assert.deepEqual(texts([{ companyId: 'rival-LH', kind: 'newRival', subject: 'JFK' }]), ['NEW RIVAL: Lufthansa (LH) starts flying from JFK.']);
    assert.deepEqual(texts([{ companyId: 'rival-LH', kind: 'liquidated' }]), ['Lufthansa has been wound up.']);
    assert.deepEqual(texts([{ companyId: 'rival-LH', kind: 'planeBought', subject: 'x', amount: 1 }, { companyId: 'rival-LH', kind: 'dividend', amount: 1 }]), []);
  });

  it('Meldungen des Spielers mit Namen aus den Daten; neueste zuerst', () => {
    const out = texts([
      { companyId: PLAYER_ID, kind: 'milestone', subject: 'first-route', amount: 1e5 },
      { companyId: PLAYER_ID, kind: 'rankUp', amount: 1 },
      { companyId: PLAYER_ID, kind: 'deliveryDelayed', subject: 'ord1' },
    ]);
    assert.equal(out.length, 3);
    assert.equal(out[2], 'MILESTONE: First route opened');
    assert.match(out[1], /^RANK: your airline is now a /);
    assert.match(out[0], /^DELIVERY DELAYED: Airbus /);
  });
});

describe('KI eines neuen Spiels nach dem Modell (5.2b, 7.7)', () => {
  const W = { seed: 4711, randomEvents: [], disruptions: [], badLuck: false, resold: [] };
  const start = (over: Partial<AppGame> = {}): AppGame =>
    game({ month: 0, startMonth: 0, fleet: [], routes: [], airportManagement: { FRA: infra(2, 0) }, aiAirlines: [], career: createGameSystems().career, modelWorld: W, ...over });

  it('gründet die gewählte Zahl, nie am Spieler-Drehkreuz, mit Startausstattung wie der Spieler', () => {
    const { rivals, aiAirlines } = foundStartRivals(start({ aiAirlinesCount: 4 }), ENV);
    assert.equal(rivals.length, 4);
    assert.equal(aiAirlines.length, 4);
    const hubs = rivals.map((r) => r.company.hubs?.[0]);
    assert.ok(!hubs.includes('FRA'), 'nicht am Spieler-Drehkreuz');
    assert.equal(new Set(hubs).size, hubs.length, 'jede an einem eigenen Drehkreuz');
    assert.equal(new Set(rivals.map((r) => r.code)).size, rivals.length, 'eindeutige Kürzel');
    assert.ok(!rivals.some((r) => r.code === 'XA'), 'nicht das Kürzel des Spielers');
    for (const r of rivals) {
      const hub = r.company.airports[r.company.hubs![0]];
      assert.equal(hub.managementTier, START_HUB_SETUP.managementTier);
      assert.deepEqual(hub.desks, START_HUB_SETUP.desks);
      assert.equal(r.company.routes.length, 0, 'ohne Strecken, wie der Spieler');
      assert.equal(r.company.aircraft.length, 3, 'Startflotte Normal');
      assert.equal(r.company.reputation, 50);
      assert.ok(rivalAgentOf(r.company), 'mit Entscheidungs-Zustand');
      assert.ok(r.color && r.color !== '#ffcc00', 'eigene Farbe');
    }
  });

  it('gleicher Startwert, gleiche KI; Stärke bestimmt die Startflotte; 0 gewünscht, keine', () => {
    const a = foundStartRivals(start({ aiAirlinesCount: 2 }), ENV);
    const b = foundStartRivals(start({ aiAirlinesCount: 2 }), ENV);
    assert.deepEqual(a.rivals.map((r) => r.company.id), b.rivals.map((r) => r.company.id));
    const hard = foundStartRivals(start({ aiAirlinesCount: 1, aiDifficulty: 'Hard' }), ENV);
    assert.equal(hard.rivals[0].company.aircraft.length, 4);
    assert.deepEqual(foundStartRivals(start({ aiAirlinesCount: 0 }), ENV).rivals, []);
    assert.ok(START_RIVAL_TRIES >= 1);
  });
});
