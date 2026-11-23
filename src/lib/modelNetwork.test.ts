/**
 * Tests für `src/lib/modelNetwork.ts` (Paket 4.7b): das Netz des Spielers im laufenden Monat nach dem Modell statt der
 * alten Netz-Rechnung `computeNetworkFinancials`. Jede Zahl muss die sein, die der Abschluss bucht (R2).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { OwnedAircraft } from '../components/MyFleetView';
import { aircraftList } from '../data/aircraft';
import { WEEKS_PER_MONTH } from '../model/constants';
import { NO_DECISIONS, closeMonth, monthOperations } from '../model/monthClose';
import { createOwnedAircraft, defaultCabin } from './fleet';
import { createGameSystems } from './gameState';
import type { AirportInfrastructure, ScheduledTrip, SimulatedRoute } from './gameTypes';
import { PLAYER_ID, defaultModelEnv, modelGame, playerTransferHubs, runModelMonth, type AppGame } from './modelMonth';
import { ffpForecast, hubTransfers, playerMonth } from './modelNetwork';
import { routesThisMonth } from './modelRoute';

const M = (1995 - 1960) * 12 + 5; // Juni 1995
const ENV = defaultModelEnv();
const A320 = aircraftList.find((a) => a.id === 'a320ceo')!;

function plane(reg: string): OwnedAircraft {
  const { config, baseInteriorPop } = defaultCabin(A320);
  const [p] = createOwnedAircraft(A320, 1, { config, baseInteriorPop, hub: 'FRA', existingRegistrations: [], purchasedAt: M - 24 });
  return { ...p, registration: reg };
}

const infra = (level: 1 | 2 | 3, narrowbody: number): AirportInfrastructure => ({
  level,
  slots: { regional: 0, narrowbody, widebody: 0 },
  stands: { narrowbody: 2, widebody: 0 },
  desks: { normal: 2, self: 0 },
});

/** Täglich zwei Umläufe ab FRA (Abflug `hours`), damit Umsteiger in FRA Anschluss finden. */
function daily(hours: readonly number[]): ScheduledTrip[] {
  const trips: ScheduledTrip[] = [];
  for (let day = 1; day <= 7; day++) {
    for (const h of hours) {
      trips.push({ id: `${day}-${h}`, flightNumOut: 'XA1', flightNumIn: 'XA2', dayId: day, startHour: h, startMin: 0, durMin: 90, turnoverMin: 45 });
    }
  }
  return trips;
}

const route = (id: string, destination: string, aircraft: string, hours: readonly number[]): SimulatedRoute => ({
  id, airline: 'Player', origin: 'FRA', destination, distance: 0, aircraft, weeklyFlights: 14, paxPerWeek: 0,
  classConfigs: { economy: { catering: [['b15']], extras: [], service: [] } },
  ticketPrices: { economy: 150 },
  openedOffset: M - 24,
  schedule: daily(hours),
});

const ROUTES = [route('r1', 'LHR', 'D-AAAA', [6, 15]), route('r2', 'VIE', 'D-AAAB', [10, 19])];

function game(over: Partial<AppGame> = {}): AppGame {
  const sys = createGameSystems();
  return {
    month: M, startMonth: M - 60, airlineCode: 'XA', selectedHub: 'FRA', difficulty: 'Normal', aiDifficulty: 'Normal', aiAirlinesCount: 0,
    capital: 150e6, monthlyCapex: [], fleet: [plane('D-AAAA'), plane('D-AAAB')], routes: ROUTES,
    airportManagement: { FRA: infra(2, 60), LHR: infra(1, 30), VIE: infra(1, 30) },
    reputation: 55, profitStreak: 0, staff: { salaryPct: 100, morale: 70, strike: null }, marketing: sys.marketing, eventChoices: {},
    career: sys.career, milestones: [], annualGoal: null, scenario: null, reportHistory: [], aiAirlines: [], randomEvents: [], disruptions: [],
    ...over,
  };
}

const STATE = modelGame(game(), ENV).state;

describe('Paket 4.7b: Umsteiger nach dem Modell (3.13, R2)', () => {
  it('Umsteiger am Drehkreuz = Umsteiger-Reisen des Abschlusses; Strom LHR → FRA → VIE', () => {
    const net = playerMonth(STATE);
    const report = closeMonth(STATE, NO_DECISIONS).reports[PLAYER_ID];
    const fra = net.hubs.FRA;
    assert.ok(fra && fra.pax > 0, 'FRA hat Umsteiger');
    assert.ok(Math.abs(fra.pax * WEEKS_PER_MONTH - report.transferPassengers) < 1e-6);
    assert.deepEqual(Object.keys(net.hubs), ['FRA']);
    assert.equal(fra.flows.length, 1);
    assert.deepEqual([fra.flows[0].o, fra.flows[0].d, fra.flows[0].hub].sort(), ['FRA', 'LHR', 'VIE']);
  });

  it('Ströme je Strecke = Umsteiger der Strecke; jede Reise zählt auf beiden Teilstrecken', () => {
    const net = playerMonth(STATE);
    let onRoutes = 0;
    net.routes.forEach((m, id) => {
      const flows = net.flowsByRoute[id] ?? [];
      const sum = flows.reduce((s, f) => s + f.pax, 0);
      assert.ok(Math.abs(sum - m.transferPassengers) < 1e-9, `${id}: ${sum} ≠ ${m.transferPassengers}`);
      onRoutes += sum;
    });
    assert.ok(Math.abs(onRoutes - 2 * net.hubs.FRA.pax) < 1e-9);
  });

  it('Strecken-Zahlen = routesThisMonth (eine Rechnung)', () => {
    const net = playerMonth(STATE);
    const months = routesThisMonth(STATE);
    assert.equal(net.routes.size, months.size);
    net.routes.forEach((m, id) => assert.deepEqual(m, months.get(id)));
  });

  it('hubTransfers: Drehkreuze ohne Umsteiger fehlen, größter Strom zuerst', () => {
    const hubs = hubTransfers([
      { hubId: 'FRA', origin: 'LHR', destination: 'VIE', passengers: 10, routes: {} },
      { hubId: 'FRA', origin: 'CDG', destination: 'VIE', passengers: 30, routes: {} },
      { hubId: 'MUC', origin: 'CDG', destination: 'VIE', passengers: 0, routes: {} },
    ]);
    assert.deepEqual(Object.keys(hubs), ['FRA']);
    assert.equal(hubs.FRA.pax, 40);
    assert.deepEqual(hubs.FRA.flows.map((f) => f.pax), [30, 10]);
  });
});

describe('Paket 4.7b: Fluggäste, Besatzung und Frequent flyer im Monat (5.4, 5.7, R2)', () => {
  it('Reisen im Monat (Umsteiger einmal) und Besatzung = Bericht des Abschlusses', () => {
    const net = playerMonth(STATE);
    const report = closeMonth(STATE, NO_DECISIONS).reports[PLAYER_ID];
    assert.ok(report.transferPassengers > 0);
    assert.ok(Math.abs(net.monthlyPassengers - (report.passengers - report.transferPassengers)) < 1e-6);
    assert.ok(net.monthlyCrewCost > 0);
    assert.ok(Math.abs(net.monthlyCrewCost - report.costs.crew) < 1e-6, `${net.monthlyCrewCost} ≠ ${report.costs.crew}`);
  });

  it('Besatzung folgt dem Lohn (payFactor, 8.7)', () => {
    const base = playerMonth(STATE).monthlyCrewCost;
    const higher = playerMonth(modelGame(game({ staff: { salaryPct: 120, morale: 70, strike: null } }), ENV).state).monthlyCrewCost;
    assert.ok(Math.abs(higher / base - 1.2) < 1e-9, `${higher / base}`);
  });

  it('Frequent flyer: Vorschau = Grundbetrag + Kosten je Fluggast, die der Abschluss bucht', () => {
    const sys = createGameSystems();
    const state = modelGame(game({ marketing: { ...sys.marketing, ffpActive: true, ffpSinceOffset: M - 3 } }), ENV).state;
    const ops = monthOperations(state)[PLAYER_ID];
    let booked = ops.ffpBase;
    for (const r of ops.routes) booked += r.passengerCost.ffp * WEEKS_PER_MONTH;
    const forecast = ffpForecast(M, playerMonth(state).monthlyPassengers);
    assert.ok(forecast.base > 0 && forecast.perPassenger > 0);
    assert.ok(Math.abs(forecast.total - booked) < 1e-6, `${forecast.total} ≠ ${booked}`);
    assert.equal(forecast.base, ops.ffpBase);
  });

  it('ohne Strecken: alles 0', () => {
    const net = playerMonth(modelGame(game({ routes: [] }), ENV).state);
    assert.equal(net.routes.size, 0);
    assert.equal(net.monthlyPassengers, 0);
    assert.equal(net.monthlyCrewCost, 0);
    assert.deepEqual(net.hubs, {});
  });
});

describe('Paket 4.7b: Drehkreuze im Bericht und in der Chronik (3.13)', () => {
  it('runModelMonth: transferHubs im Bericht; Umsteiger je Drehkreuz = Umsteiger-Reisen des Abschlusses', () => {
    const month = runModelMonth(game(), ENV, () => 1);
    assert.deepEqual(month.report.transferHubs, ['FRA']);
    assert.equal(month.transferHubs.length, 1);
    assert.ok(Math.abs(month.transferHubs[0].pax - month.modelReport.transferPassengers) < 1e-6);
    assert.deepEqual(playerTransferHubs(STATE), month.transferHubs);
  });

  it('ohne Drehkreuz-Verbindung: keine Drehkreuze', () => {
    const month = runModelMonth(game({ routes: [ROUTES[0]] }), ENV, () => 1);
    assert.deepEqual(month.report.transferHubs, []);
    assert.deepEqual(month.transferHubs, []);
  });
});
