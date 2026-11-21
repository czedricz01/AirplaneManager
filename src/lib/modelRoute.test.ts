/**
 * Regeltests Paket 4.5a (F62): Prognose einer Strecke für den Planer (`routeForecast`, `routeBestFares`,
 * `pricesAtLevel`) aus derselben Rechnung wie der Monatsabschluss (R2, 4.10–4.12).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { OwnedAircraft } from '../components/MyFleetView';
import { aircraftList } from '../data/aircraft';
import { CABIN_CLASSES, RAMP_MONTHS } from '../model/constants';
import { monthOperations, type ModelState } from '../model/monthClose';
import { createOwnedAircraft, defaultCabin } from './fleet';
import { createGameSystems } from './gameState';
import type { AirportInfrastructure, SimulatedRoute } from './gameTypes';
import { PLAYER_ID, defaultModelEnv, modelGame, type AppGame } from './modelMonth';
import { pricesAtLevel, routeBestFares, routeForecast, routeMarketFares, withPlannedRoute, type PlannedRoute } from './modelRoute';

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

const ROUTE: SimulatedRoute = {
  id: 'r1', airline: 'Player', origin: 'FRA', destination: 'MAD', distance: 1420, aircraft: 'D-AAAA', weeklyFlights: 7, paxPerWeek: 0,
  classConfigs: { economy: { catering: [['b15']], extras: [], service: [] } },
  ticketPrices: { economy: 150 },
  openedOffset: M - 24,
};

function game(over: Partial<AppGame> = {}): AppGame {
  const sys = createGameSystems();
  return {
    month: M, startMonth: M - 60, airlineCode: 'XA', selectedHub: 'FRA', difficulty: 'Normal', aiDifficulty: 'Normal', aiAirlinesCount: 0,
    capital: 150e6, monthlyCapex: [], fleet: [plane('D-AAAA'), plane('D-AAAB')], routes: [ROUTE],
    airportManagement: { FRA: infra(2, 40), MAD: infra(1, 20), LIS: infra(1, 20) },
    reputation: 55, profitStreak: 0, staff: { salaryPct: 100, morale: 70, strike: null }, marketing: sys.marketing, eventChoices: {},
    career: sys.career, milestones: [], annualGoal: null, scenario: null, reportHistory: [], aiAirlines: [], randomEvents: [], disruptions: [],
    ...over,
  };
}

const STATE: ModelState = modelGame(game(), ENV).state;
const EXISTING: PlannedRoute = { route: ROUTE, isNew: false, startMonth: M - 60 };
const NEW: PlannedRoute = {
  route: { ...ROUTE, id: 'draft', destination: 'LIS', aircraft: 'D-AAAB', openedOffset: undefined, ticketPrices: { economy: 200 } },
  isNew: true,
  startMonth: M - 60,
};

describe('Paket 4.5a: Prognose einer Strecke (4.11, 4.12)', () => {
  it('Hauptzahl = Ergebnis der Strecke im Monatsabschluss bei gleichem Stand nach dem Anlauf (4.12, R2)', () => {
    const f = routeForecast(STATE, EXISTING);
    assert.ok(f);
    const ops = monthOperations(STATE)[PLAYER_ID].routes.find((r) => r.routeId === 'r1')!;
    assert.ok(Math.abs(f.weeklyProfit - ops.result) < 1e-6, `${f.weeklyProfit} ≠ ${ops.result}`);
    assert.ok(Math.abs(f.figures.revenue - ops.revenue) < 1e-6);
  });

  it('eine bestehende Strecke wird ersetzt, nicht doppelt gezählt', () => {
    const s = withPlannedRoute(STATE, EXISTING);
    const player = s.companies.find((c) => c.id === PLAYER_ID)!;
    assert.equal(player.routes.filter((r) => r.id === 'r1').length, 1);
    assert.equal(player.routes.length, 1);
  });

  it('neue Strecke: „First month“ mit Anlauf-Monat 0 bringt weniger als die Hauptzahl nach dem Anlauf (3.12, 4.12)', () => {
    const f = routeForecast(STATE, NEW);
    assert.ok(f);
    assert.ok(f.firstMonth.passengers.economy < f.figures.passengers.economy);
    assert.ok(f.firstMonthWeeklyProfit < f.weeklyProfit);
    const route = withPlannedRoute(STATE, NEW).companies.find((c) => c.id === PLAYER_ID)!.routes.find((r) => r.id === 'draft')!;
    assert.equal(route.ageMonths, 0);
    const later = withPlannedRoute(STATE, NEW, RAMP_MONTHS).companies.find((c) => c.id === PLAYER_ID)!.routes.find((r) => r.id === 'draft')!;
    assert.equal(later.ageMonths, RAMP_MONTHS);
  });

  it('Preis der Prognose = eingestellter Preis in $; Abstand zum Marktpreis (4.5)', () => {
    const f = routeForecast(STATE, NEW)!;
    const e = f.classes.economy!;
    assert.ok(Math.abs(e.fare - 200) < 1e-6);
    assert.ok(Math.abs(e.vsMarket - (200 / e.marketFare - 1)) < 1e-9);
    assert.equal(f.classes.premium, undefined, 'Klassen ohne Sitze fehlen');
  });

  it('Gewinnschwelle (4.11): bei voller Maschine Gewinn 0, erwartete Auslastung nie tiefer als voll', () => {
    const f = routeForecast(STATE, NEW)!;
    let profitAtFull = -f.figures.fixed.total;
    for (const c of CABIN_CLASSES) {
      const k = f.classes[c];
      if (!k) continue;
      profitAtFull += k.seatsPerWeek * (k.breakEvenFull - k.costPerPassenger);
      assert.ok(Math.abs(k.breakEvenFull - f.breakEvenLevel.full * k.marketFare) < 1e-9);
    }
    assert.ok(Math.abs(profitAtFull) < 1e-6, `Gewinn an der Schwelle ${profitAtFull}`);
    assert.ok(f.expectedLoad > 0 && f.expectedLoad <= 1);
    assert.ok(f.breakEvenLevel.expected! >= f.breakEvenLevel.full - 1e-12);
  });

  it('„Full aircraft at market fare“ hängt nicht vom eingestellten Preis ab (4.12, E26)', () => {
    const a = routeForecast(STATE, NEW)!;
    const b = routeForecast(STATE, { ...NEW, route: { ...NEW.route, ticketPrices: { economy: 90 } } })!;
    assert.ok(Math.abs(a.fullAircraft.profit - b.fullAircraft.profit) < 1e-6);
    assert.ok(Math.abs(a.fullAircraft.revenue - a.figures.offeredSeats.economy * a.marketFares.economy) < 1e-6);
  });

  it('„before aircraft costs“ = Ergebnis + Flugzeug-Anteil (E57)', () => {
    const f = routeForecast(STATE, EXISTING)!;
    assert.ok(f.figures.fixed.aircraftShare > 0);
    assert.ok(Math.abs(f.beforeAircraftWeeklyProfit - f.weeklyProfit - f.figures.fixed.aircraftShare) < 1e-9);
  });

  it('ohne Abflüge keine Prognose', () => {
    assert.equal(routeForecast(STATE, { ...NEW, route: { ...NEW.route, weeklyFlights: 0, schedule: [] } }), null);
    assert.deepEqual(routeBestFares(STATE, { ...NEW, route: { ...NEW.route, weeklyFlights: 0, schedule: [] } }), {});
  });
});

describe('Paket 4.5a: bester Preis und Preisniveau (4.5, 4.10)', () => {
  it('die Hauptzahl steigt nie allein dadurch, dass ein Preis über den besten Preis erhöht wird (4.12)', () => {
    const best = routeBestFares(STATE, NEW).economy!;
    assert.ok(best.fare > 0);
    const at = (fare: number) => routeForecast(STATE, { ...NEW, route: { ...NEW.route, ticketPrices: { economy: fare } } })!.weeklyProfit;
    const atBest = at(best.fare);
    assert.ok(atBest >= at(best.fare * 1.2) - 1e-6);
    assert.ok(atBest >= at(best.fare * 1.5) - 1e-6);
    assert.ok(atBest >= at(best.fare * 0.8) - 1e-6);
  });

  it('der beste Preis hängt nicht vom eingestellten Preis der Klasse ab', () => {
    const a = routeBestFares(STATE, NEW).economy!;
    const b = routeBestFares(STATE, { ...NEW, route: { ...NEW.route, ticketPrices: { economy: 400 } } }).economy!;
    assert.ok(Math.abs(a.fareRatio - b.fareRatio) < 1e-12);
  });

  it('Preisniveau 1 = Marktpreis je Klasse; ein Niveau hält die Klassen-Verhältnisse des Markts (E23)', () => {
    const fares = routeMarketFares(STATE, NEW.route);
    const p1 = pricesAtLevel(fares, 1, CABIN_CLASSES);
    for (const c of CABIN_CLASSES) assert.equal(p1[c], Math.round(fares[c]));
    const p = pricesAtLevel(fares, 1.3, ['economy', 'business']);
    assert.deepEqual(Object.keys(p), ['economy', 'business']);
    assert.ok(Math.abs(p.business / p.economy - fares.business / fares.economy) < 0.02);
  });
});
