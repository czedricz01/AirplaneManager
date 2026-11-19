/**
 * Paket 3.9b (Rechenzeit der KI): Die Planer-Rechnungen `plannerRouteFigures` und `routeClassPassengersCurve` rechnen
 * nur die Märkte, von denen ihr Ergebnis abhängt. Sie müssen genau dasselbe ergeben wie die volle Rechnung
 * `monthOperations` auf dem Planer-Spielstand (R2), und der Abschluss selbst bleibt unverändert.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aircraftList } from '../data/aircraft';
import { airportsData } from '../data/airports';
import { CABIN_CLASSES, type RivalPersonality, type WorldRegion } from './constants';
import {
  closeMonth,
  fleetValue,
  monthOperations,
  newLedger,
  plannerRouteFigures,
  plannerState,
  routeClassPassengersAt,
  routeClassPassengersCurve,
  type CompanyState,
  type ModelAirport,
  type ModelState,
} from './monthClose';
import { RIVAL_INPUTS, pickStartAircraft, rivalAircraft, rivalStartCash, rivalStartSetup, startFleetKinds } from './rivals';
import { newRivalAgent, rivalDecisions } from './rivalMonth';

const M = (1990 - 1960) * 12;
const IDS = ['FRA', 'MAD', 'CDG', 'FCO', 'LHR', 'AMS', 'MUC', 'BCN', 'VIE', 'ZRH', 'CPH', 'ARN', 'LIS', 'ATH', 'DUB', 'BRU'];
const AIRPORTS: Record<string, ModelAirport> = {};
for (const id of IDS) {
  const a = airportsData.find((x) => x.id === id);
  if (a) AIRPORTS[id] = { id, coords: a.coords, stats: a.stats, size: a.level, region: 'EU' as WorldRegion, maxIcaoCode: a.maxIcaoCode };
}

function founder(personality: RivalPersonality, hub: string): CompanyState {
  const id = `k-${personality}`;
  const aircraft = startFleetKinds('hard').map((kind, i) => {
    const index = pickStartAircraft(personality, kind, aircraftList, M, () => 0.5);
    return rivalAircraft(personality, aircraftList[index], M, `${id}-a${i}`);
  });
  const cash = rivalStartCash('hard', M, 0);
  const setup = rivalStartSetup();
  return {
    id,
    cash,
    reputation: setup.reputation,
    inputs: { ...RIVAL_INPUTS, campaigns: [], subsidized: true },
    aircraft,
    routes: [],
    airports: { [hub]: { managementTier: setup.managementTier, slots: {}, stands: {}, desks: { ...setup.desks }, facilities: [] } },
    preorders: [],
    overdrawnMonths: 0,
    profitStreak: 0,
    ledger: newLedger(cash, fleetValue(aircraft, M), 0),
    reports: [],
    hubs: [hub],
    agent: newRivalAgent(personality, 'hard'),
  };
}

/** Eine Welt mit fünf KI (je Persönlichkeit eine), nach einigen Monaten mit Strecken, Fahrplänen und Umsteigern. */
function grownWorld(): ModelState {
  const personalities: RivalPersonality[] = ['flag', 'lcc', 'expansionist', 'optimizer', 'boutique'];
  let state: ModelState = {
    month: M,
    seed: 3,
    airports: AIRPORTS,
    randomEvents: [],
    disruptions: [],
    badLuck: false,
    resold: [],
    catalog: aircraftList,
    companies: personalities.map((p, i) => founder(p, ['FRA', 'CDG', 'AMS', 'LHR', 'MAD'][i])),
  };
  for (let i = 0; i < 8; i++) state = closeMonth(state, rivalDecisions).state;
  return state;
}

const WORLD = grownWorld();

describe('Planer-Rechnungen nur auf den gebrauchten Märkten (3.9b)', () => {
  it('die Welt hat Strecken auf gemeinsamen Paaren und Umsteiger', () => {
    const routes = WORLD.companies.flatMap((c) => c.routes);
    assert.ok(routes.length >= 20, `nur ${routes.length} Strecken`);
    const ops = monthOperations(WORLD);
    assert.ok(Object.values(ops).some((o) => o.transferPassengers > 0), 'keine Umsteiger');
  });

  it('plannerRouteFigures = monthOperations auf dem Planer-Spielstand, für jede Strecke', () => {
    for (const company of WORLD.companies) {
      for (const route of company.routes) {
        for (const departures of [route.departuresPerWeek, route.departuresPerWeek + 2]) {
          const fast = plannerRouteFigures(WORLD, company.id, route.id, departures);
          const full = monthOperations(plannerState(WORLD, company.id, route.id, (r) => ({ ...r, departuresPerWeek: departures })));
          assert.deepEqual(fast, full[company.id].routes.find((r) => r.routeId === route.id));
        }
      }
    }
  });

  it('routeClassPassengersAt / -Curve = monthOperations auf dem Planer-Spielstand', () => {
    for (const company of WORLD.companies) {
      for (const route of company.routes) {
        const plane = company.aircraft.find((a) => a.id === route.aircraftId);
        for (const c of CABIN_CLASSES) {
          if (!((plane?.seats[c] ?? 0) > 0)) continue;
          const curve = routeClassPassengersCurve(WORLD, company.id, route.id, c);
          for (const ratio of [0.4, 1, 1.37, 3.2]) {
            const full = monthOperations(plannerState(WORLD, company.id, route.id, (r) => ({ ...r, fareRatios: { ...r.fareRatios, [c]: ratio } })));
            const expected = (full[company.id].routes.find((r) => r.routeId === route.id) as { passengers: Record<string, number> }).passengers[c];
            assert.equal(curve(ratio), expected);
            assert.equal(routeClassPassengersAt(WORLD, company.id, route.id, c, ratio), expected);
          }
        }
      }
    }
  });
});
