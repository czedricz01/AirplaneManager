import test from 'node:test';
import assert from 'node:assert/strict';

import { generateAiAirlines, simulateAiAirlinesTurn, buildAiSimAircraft } from './aiSimulation';
import { airports } from '../data/airportRegistry';
import { getPlaneSat } from './financeUtils';

test('the AI simulation aircraft never produces a NaN satisfaction', () => {
  const sim = buildAiSimAircraft({
    id: '737-100', manufacturer: 'Boeing', family: '737', type: '737-100',
    class: 'narrowbody', reg: 'LH-A100', capacity: 100, popularity: 70, efficiency: 55
  }, 'flag');
  assert.ok(Number.isFinite(getPlaneSat(sim)));
});

test('getPlaneSat stays finite when fields are missing', () => {
  assert.ok(Number.isFinite(getPlaneSat({ popularity: 70 })));
  assert.ok(Number.isFinite(getPlaneSat({})));
});

test('AI routes earn real, finite and distinct monthly profits', () => {
  // Several months so that every airline has routes, from a start date with
  // a wide choice of aircraft.
  let ais = generateAiAirlines(6, 'Normal', 'FRA', (1995 - 1960) * 12);
  for (let m = 0; m < 6; m++) {
    ais = simulateAiAirlinesTurn(ais, airports, (1995 - 1960) * 12 + m, 'FRA', []).updatedAis;
  }

  const profits = ais.flatMap(ai => ai.routes.map(r => r.monthlyProfit));
  assert.ok(profits.length > 3, 'the AI should be flying some routes');
  for (const p of profits) assert.ok(Number.isFinite(p), `profit ${p} must be finite`);

  // The old code booked exactly 100,000 for every route because every result
  // was NaN. Real results differ from route to route.
  assert.ok(new Set(profits).size > 1, 'profits must not all be the same constant');
  assert.ok(!profits.every(p => p === 100000), 'profits must not be the old fallback');

  for (const ai of ais) {
    for (const v of ai.monthlyProfitsHistory) assert.ok(Number.isFinite(v));
    assert.ok(Number.isFinite(ai.capital));
  }
});

// --- Who the rivals are ---------------------------------------------------

import { pickRivalIdentities, maxWeeklyRotations, cabinConfigFor } from './aiSimulation';
import { REAL_AIRLINES, FICTIONAL_AIRLINES, isActiveIn } from '../data/rivalAirlines';
import { airportsMapAdjusted } from '../data/airportRegistry';
import { aircraftList } from '../data/aircraft';

const offsetFor = (year: number) => (year - 1960) * 12;

test('every real carrier in the list has a hub that exists in the game', () => {
  for (const a of REAL_AIRLINES) assert.ok(airportsMapAdjusted.has(a.hub), `${a.name}: unknown hub ${a.hub}`);
});

test('no two carriers ever fly under the same code at the same time', () => {
  for (const a of REAL_AIRLINES) {
    for (const b of REAL_AIRLINES) {
      if (a === b || a.code !== b.code) continue;
      const overlap = a.founded < (b.ceased ?? Infinity) && b.founded < (a.ceased ?? Infinity);
      assert.ok(!overlap, `${a.name} and ${b.name} share ${a.code} in overlapping years`);
    }
  }
  const realCodes = new Set(REAL_AIRLINES.map(a => a.code));
  for (const f of FICTIONAL_AIRLINES) assert.ok(!realCodes.has(f.code), `${f.name} uses a real code`);
  assert.equal(new Set(FICTIONAL_AIRLINES.map(f => f.code)).size, FICTIONAL_AIRLINES.length);
});

test('no rival ever starts at the player hub, and the carrier based there is left out', () => {
  // Frankfurt means no Lufthansa, London no BA/BOAC, New York no Pan Am.
  const cases: [string, string][] = [['FRA', 'LH'], ['LHR', 'BA'], ['JFK', 'PA'], ['CDG', 'AF'], ['ATL', 'DL'], ['DXB', 'EK']];
  for (const [hub, code] of cases) {
    for (const year of [1965, 1975, 1990, 2010]) {
      for (let i = 0; i < 20; i++) {
        const rivals = pickRivalIdentities(12, hub, year);
        assert.equal(rivals.length, 12);
        for (const r of rivals) assert.notEqual(r.hub, hub, `${r.name} starts at the player hub ${hub}`);
        assert.ok(!rivals.some(r => r.isReal && r.code === code), `${code} must not exist for a ${hub} player`);
      }
    }
  }
});

test('the generated airlines obey the same hub rule', () => {
  for (const hub of ['FRA', 'LHR', 'JFK']) {
    const ais = generateAiAirlines(12, 'Normal', hub, offsetFor(1980));
    for (const ai of ais) assert.notEqual(ai.hub, hub);
    for (const ai of ais) for (const r of ai.routes) assert.equal(r.origin, ai.hub);
  }
});

test('real carriers start at their real hub and only in years they flew', () => {
  for (const year of [1962, 1972, 1985, 1999, 2015]) {
    for (let i = 0; i < 10; i++) {
      for (const r of pickRivalIdentities(12, 'MUC', year).filter(x => x.isReal)) {
        const entry = REAL_AIRLINES.find(a => a.code === r.code && a.name === r.name);
        assert.ok(entry, `${r.name} is not in the list`);
        assert.equal(r.hub, entry!.hub, `${r.name} must start at ${entry!.hub}`);
        assert.ok(isActiveIn(entry!, year), `${r.name} did not fly in ${year}`);
      }
    }
  }
  // BOAC before 1974, British Airways from 1974 -- never both.
  const early = pickRivalIdentities(12, 'MUC', 1965);
  assert.ok(!early.some(r => r.name === 'British Airways' || r.name === 'Emirates'));
});

test('the field mixes real and fictional airlines, with unique hubs and codes', () => {
  for (let i = 0; i < 30; i++) {
    const rivals = pickRivalIdentities(8, 'FRA', 1990, 'XX');
    assert.ok(rivals.some(r => r.isReal), 'some rivals are real');
    assert.ok(rivals.some(r => !r.isReal), 'some rivals are fictional');
    assert.equal(new Set(rivals.map(r => r.hub)).size, rivals.length, 'one rival per hub');
    assert.equal(new Set(rivals.map(r => r.code)).size, rivals.length, 'one rival per code');
  }
  // The player's own code is never handed to a rival.
  for (let i = 0; i < 30; i++) {
    assert.ok(!pickRivalIdentities(12, 'MUC', 1990, 'LH').some(r => r.code === 'LH'));
  }
});

// --- How they play ----------------------------------------------------------

test('an aircraft is never scheduled for more round trips than fit in a week', () => {
  // A ten-hour sector: 30 + 600 + 90 + 600 + 30 minutes per round trip.
  assert.equal(maxWeeklyRotations(600, 'widebody'), Math.floor((7 * 18 * 60) / 1350));
  assert.equal(maxWeeklyRotations(45, 'regional'), 21);

  let ais = generateAiAirlines(8, 'Hard', 'FRA', offsetFor(1995));
  for (let m = 0; m < 24; m++) {
    ais = simulateAiAirlinesTurn(ais, airports, offsetFor(1995) + m, 'FRA', []).updatedAis;
    for (const ai of ais) {
      for (const r of ai.routes) {
        const plane = ai.fleet.find(f => f.reg === r.aircraftReg)!;
        assert.ok(plane, `${ai.code} route without its aircraft`);
        assert.ok(r.departures >= 1 && r.departures <= maxWeeklyRotations(r.durMin!, plane.class),
          `${ai.code} ${r.origin}-${r.destination} flies ${r.departures}x with a ${plane.type}`);
        assert.ok((plane.maxRange || 0) >= (r.distance || 0), `${ai.code} flies beyond range`);
        const icao = aircraftList.find(a => a.id === plane.id)?.icaoCode;
        const dest = airportsMapAdjusted.get(r.destination)!;
        assert.ok(!icao || icao <= dest.maxIcaoCode, `${plane.type} cannot land at ${dest.id}`);
      }
      // One aircraft per route, and no route twice.
      assert.equal(new Set(ai.routes.map(r => r.aircraftReg)).size, ai.routes.length);
      assert.equal(new Set(ai.routes.map(r => r.destination)).size, ai.routes.length);
    }
  }
});

test('rivals do not hoard idle aircraft', () => {
  let ais = generateAiAirlines(8, 'Normal', 'FRA', offsetFor(1985));
  for (let m = 0; m < 36; m++) {
    ais = simulateAiAirlinesTurn(ais, airports, offsetFor(1985) + m, 'FRA', []).updatedAis;
  }
  for (const ai of ais) {
    const idle = ai.fleet.filter(p => !ai.routes.some(r => r.aircraftReg === p.reg));
    for (const p of idle) {
      assert.ok(p.idleSince !== undefined && offsetFor(1985) + 35 - p.idleSince < 7,
        `${ai.code} ${p.reg} has been idle too long`);
    }
  }
});

test('a rival thins out or drops a route that keeps losing money', () => {
  const [ai] = generateAiAirlines(1, 'Hard', 'MUC', offsetFor(1990));
  const plane = ai.fleet.find(p => p.reg === ai.routes[0].aircraftReg)!;
  // Established long ago, and losing heavily on average.
  const loser = { ...ai.routes[0], openedAt: 0, avgProfit: -5_000_000 };
  loser.departures = maxWeeklyRotations(loser.durMin!, plane.class);
  const others = ai.routes.slice(1).map(r => ({ ...r, openedAt: offsetFor(1990) }));
  const out = simulateAiAirlinesTurn([{ ...ai, routes: [loser, ...others] }], airports, offsetFor(1990), 'MUC', []).updatedAis[0];
  const after = out.routes.find(r => r.destination === loser.destination);
  assert.ok(!after || after.departures < loser.departures, 'the losing route is thinned out or closed');
});

test('old saves keep working: no new fields needed, frequencies capped', () => {
  const plane = aircraftList.find(a => a.id.startsWith('747'))!;
  const oldAi: any = {
    id: 'ai_pa', name: 'Pan American', code: 'PA', hub: 'JFK', capital: 50_000_000, aiDifficulty: 'Normal',
    fleet: [{ id: plane.id, manufacturer: plane.manufacturer, family: plane.family, type: plane.type,
      class: 'widebody', reg: 'PA-A100', maxRange: plane.maxRange, capacity: plane.capacity,
      basePrice: plane.basePrice, popularity: plane.popularity, efficiency: plane.efficiency,
      cruiseSpeed: plane.cruiseSpeed, purchasedAt: offsetFor(1975), config: cabinConfigFor('flag', plane.capacity) }],
    // The old code flew any route 14 times a week, even JFK-LHR on one aircraft.
    routes: [{ origin: 'JFK', destination: 'LHR', aircraftClass: 'widebody', departures: 14, monthlyProfit: 0, aircraftReg: 'PA-A100' }],
    monthlyProfitsHistory: []
  };
  const out = simulateAiAirlinesTurn([oldAi], airports, offsetFor(1978), 'FRA', []).updatedAis[0];
  const r = out.routes.find(x => x.destination === 'LHR')!;
  assert.ok(r, 'the route survives its first month');
  assert.ok(r.departures < 14, 'frequency is capped to what one aircraft can fly');
  assert.ok(Number.isFinite(r.monthlyProfit) && Number.isFinite(r.avgProfit!));
  assert.ok(Number.isFinite(out.capital));
});
