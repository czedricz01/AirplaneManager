import test from 'node:test';
import assert from 'node:assert/strict';

import {
  crisisSeverity, growthFrozen, crisisDepartures, CRISIS_FROM, GROWTH_FREEZE_AT, TARGET_LOAD
} from './rivalCrisis';
import { historicalEvents, setRuntimeRandomEvents, type HistoricalEvent } from './eventSystem';
import { generateAiAirlines, simulateAiAirlinesTurn } from './aiSimulation';
import { airports } from '../data/airportRegistry';
import { aircraftList } from '../data/aircraft';
import type { AiAirline } from '../components/CompetitorsView';

/** Month offset of a calendar month: at(2020, 3) is March 2020. */
const at = (year: number, month: number) => (year - 1960) * 12 + (month - 1);

const scripted = [...historicalEvents];
/** Runs `fn` with only these scripted events, then puts the real ones back. */
function withEvents<T>(list: HistoricalEvent[], fn: () => T): T {
  historicalEvents.length = 0;
  historicalEvents.push(...list);
  try {
    return fn();
  } finally {
    historicalEvents.length = 0;
    historicalEvents.push(...scripted);
  }
}

const crisis = (startOffset: number, duration: number, demandMultiplier: number, fuelMultiplier = 1): HistoricalEvent => ({
  startOffset, duration, title: 'Test crisis', description: '', demandMultiplier, fuelMultiplier
});

const weekly = (ais: AiAirline[]) => ais.reduce((s, a) => s + a.routes.reduce((t, r) => t + r.departures, 0), 0);
const profit = (ais: AiAirline[]) => ais.reduce((s, a) => s + a.routes.reduce((t, r) => t + r.monthlyProfit, 0), 0);

/** A rival field with a network: fly `months` months from `start`, events as they stand. */
function network(start: number, months: number, hub = 'FRA', count = 8) {
  let ais = generateAiAirlines(count, 'Normal', hub, start);
  for (let m = 0; m < months; m++) ais = simulateAiAirlinesTurn(ais, airports, start + m, hub, []).updatedAis;
  return ais;
}

// --- The rules on their own -------------------------------------------------

test('severity: 0 in a normal year, the demand loss or half the fuel rise in a crisis', () => {
  assert.equal(crisisSeverity(at(1985, 6)), 0);
  assert.ok(Math.abs(crisisSeverity(at(2020, 6)) - 0.8) < 1e-9, 'pandemic: demand x0.20');
  assert.ok(Math.abs(crisisSeverity(at(1973, 11)) - 0.5) < 1e-9, 'oil shock: fuel x2.0');
  assert.ok(Math.abs(crisisSeverity(at(2001, 10)) - 0.35) < 1e-9, '2001: demand x0.65');
  // Every scripted crisis is above the line.
  for (const ev of scripted.filter(e => !e.regions)) {
    assert.ok(crisisSeverity(ev.startOffset) >= CRISIS_FROM, `${ev.title} should count as a crisis`);
  }
});

test('severity: random events and booms never count as a crisis', () => {
  withEvents([], () => {
    // The worst the random event templates can do.
    setRuntimeRandomEvents([crisis(at(1985, 1), 3, 0.85, 1.4)]);
    assert.ok(crisisSeverity(at(1985, 2)) < CRISIS_FROM);
    // Cheap fuel and full planes.
    setRuntimeRandomEvents([crisis(at(1985, 1), 3, 1.15, 0.7)]);
    assert.equal(crisisSeverity(at(1985, 2)), 0);
    setRuntimeRandomEvents([]);
  });
});

test('growth freeze: careful carriers stop first, expansionists last', () => {
  assert.equal(growthFrozen('optimizer', 0), false);
  for (const p of ['optimizer', 'flag', 'boutique'] as const) assert.equal(growthFrozen(p, 0.25), true, p);
  assert.equal(growthFrozen('lcc', 0.25), false);
  assert.equal(growthFrozen('lcc', 0.35), true);
  assert.equal(growthFrozen('expansionist', 0.35), false);
  assert.equal(growthFrozen('expansionist', 0.5), true);
  // The pandemic stops everyone.
  for (const p of Object.keys(GROWTH_FREEZE_AT) as (keyof typeof GROWTH_FREEZE_AT)[]) assert.equal(growthFrozen(p, 0.8), true, p);
});

test('a route that sells too few seats is cut to the load it can fill', () => {
  const cut = (current: number, loadFactor: number) => crisisDepartures({ current, full: current, loadFactor, inCrisis: true });
  assert.equal(cut(10, 0.4), 5, '40 % load: half the flights sell 80 %');
  assert.equal(cut(10, TARGET_LOAD), 10, 'on target: untouched');
  assert.equal(cut(10, 0.9), 10, 'busy: untouched');
  assert.equal(cut(1, 0.1), 1, 'never below one flight');
  assert.equal(cut(2, 0.79), 2, 'a whisker under target does not cost a flight');
});

test('flights come back when demand does, and never beyond the old schedule', () => {
  // Still in the crisis but full again: a quarter of the old schedule per month.
  assert.equal(crisisDepartures({ current: 5, full: 10, loadFactor: 0.99, inCrisis: true }), 8);
  assert.equal(crisisDepartures({ current: 9, full: 10, loadFactor: 1, inCrisis: true }), 10);
  // In between: hold.
  assert.equal(crisisDepartures({ current: 5, full: 10, loadFactor: 0.85, inCrisis: true }), 5);
  // No result last month: hold.
  assert.equal(crisisDepartures({ current: 5, full: 10, loadFactor: undefined, inCrisis: true }), 5);
  // Crisis over: rebuild whatever the load was.
  assert.equal(crisisDepartures({ current: 5, full: 10, loadFactor: 0.3, inCrisis: false }), 8);
  assert.equal(crisisDepartures({ current: 8, full: 10, loadFactor: 0.3, inCrisis: false }), 10);
});

// --- Rivals in a crisis -----------------------------------------------------

test('a world event hits the rivals: the pandemic and an oil shock both cost them money', () => {
  for (const [name, start, hitMonth] of [['pandemic', at(2019, 1), at(2020, 4)], ['oil shock', at(1972, 10), at(1973, 11)]] as const) {
    const ais = network(start, hitMonth - start - 1);
    const hit = profit(simulateAiAirlinesTurn(ais, airports, hitMonth, 'FRA', []).updatedAis);
    const calm = withEvents([], () => profit(simulateAiAirlinesTurn(ais, airports, hitMonth, 'FRA', []).updatedAis));
    assert.ok(hit < calm, `${name}: ${hit} should be below ${calm}`);
  }
});

test('in the first month of the pandemic rivals cut the flights that run empty', () => {
  const ais = network(at(2019, 1), 14); // to February 2020
  const after = simulateAiAirlinesTurn(ais, airports, at(2020, 3), 'FRA', []).updatedAis;

  const cut = after.flatMap(a => a.routes).filter(r => r.fullDepartures !== undefined);
  assert.ok(cut.length > 0, 'some routes are cut back');
  for (const r of cut) {
    assert.ok(r.departures < r.fullDepartures!, `${r.origin}-${r.destination}: ${r.departures} of ${r.fullDepartures}`);
    assert.ok(r.departures >= 1);
  }
});

test('rivals buy no aircraft while the pandemic runs', () => {
  let ais = network(at(2019, 1), 14);
  for (let m = 0; m < 12; m++) {
    const next = simulateAiAirlinesTurn(ais, airports, at(2020, 3) + m, 'FRA', []).updatedAis;
    next.forEach((a, i) => {
      const was = ais[i];
      assert.ok(a.fleet.length <= was.fleet.length, `${a.code} bought an aircraft in month ${m}`);
      // Nothing is replaced either: every registration flies the same type.
      for (const p of a.fleet) assert.equal(was.fleet.find(x => x.reg === p.reg)?.id, p.id, `${a.code} ${p.reg} was replaced`);
    });
    ais = next;
  }
});

test('after a crisis the schedule is rebuilt and growth resumes', () => {
  const start = at(1995, 1);
  const shock = at(1995, 13); // a three-month crisis a year in
  const event = crisis(shock, 3, 0.3);
  withEvents([event], () => {
    let ais = network(start, 12);
    const flownBefore = weekly(ais);
    const fleetBefore = ais.reduce((s, a) => s + a.fleet.length, 0);

    for (let m = 0; m < 3; m++) ais = simulateAiAirlinesTurn(ais, airports, shock + m, 'FRA', []).updatedAis;
    assert.ok(ais.flatMap(a => a.routes).some(r => r.fullDepartures !== undefined), 'the crisis cut something');

    // Rebuilding takes a quarter of the old schedule per month: four months
    // at most. A few more, so a full slot table cannot make the test flaky.
    for (let m = 0; m < 8; m++) ais = simulateAiAirlinesTurn(ais, airports, shock + 3 + m, 'FRA', []).updatedAis;
    const stillCut = ais.flatMap(a => a.routes).filter(r => r.fullDepartures !== undefined);
    assert.equal(stillCut.length, 0, 'every cut route is back at its full schedule');
    assert.ok(weekly(ais) >= flownBefore * 0.9, `schedule ${weekly(ais)} should be back near ${flownBefore}`);
    assert.ok(ais.reduce((s, a) => s + a.fleet.length, 0) >= fleetBefore, 'and the fleets are not smaller');
  });
});

test('a rival tells the player when it cuts a route into the player hub', () => {
  const plane = aircraftList.find(a => a.id.startsWith('747'))!;
  const ai: any = {
    id: 'ai_pa', name: 'Pan American', code: 'PA', hub: 'JFK', capital: 50_000_000, aiDifficulty: 'Normal',
    personality: 'flag',
    fleet: [{ id: plane.id, manufacturer: plane.manufacturer, family: plane.family, type: plane.type,
      class: 'widebody', reg: 'PA-A100', maxRange: plane.maxRange, capacity: plane.capacity,
      basePrice: plane.basePrice, popularity: plane.popularity, efficiency: plane.efficiency,
      cruiseSpeed: plane.cruiseSpeed, purchasedAt: at(1975, 1) }],
    routes: [{ origin: 'JFK', destination: 'LHR', aircraftClass: 'widebody', departures: 6, monthlyProfit: 0, aircraftReg: 'PA-A100', openedAt: at(1976, 1) }],
    monthlyProfitsHistory: []
  };
  withEvents([crisis(at(1978, 1), 6, 0.05)], () => {
    const out = simulateAiAirlinesTurn([ai], airports, at(1978, 2), 'LHR', []);
    const route = out.updatedAis[0].routes.find(r => r.destination === 'LHR')!;
    assert.ok(route.departures < 6, 'the route is cut');
    assert.equal(route.fullDepartures, 6);
    assert.ok(out.newMessages.some(m => m.text.startsWith('CAPACITY CUT: Pan American (PA)')), 'the player is told');
  });
});
