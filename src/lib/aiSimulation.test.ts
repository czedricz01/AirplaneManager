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
