import test from 'node:test';
import assert from 'node:assert/strict';

import { eventRegionLabel, eventScope, historicalEvents } from './eventSystem';

test('regional events carry their regions and leave fuel alone', () => {
  const regional = historicalEvents.filter(e => e.regions && e.regions.length > 0);
  assert.ok(regional.length >= 8);
  for (const e of regional) {
    assert.equal(e.fuelMultiplier, 1, e.title);
    assert.ok(e.duration >= 1 && e.demandMultiplier > 0, e.title);
  }
  // Both kinds of weather are there: crises and booms.
  assert.ok(regional.some(e => e.demandMultiplier < 1) && regional.some(e => e.demandMultiplier > 1));
});

test('regions read as words', () => {
  assert.equal(eventRegionLabel({ regions: ['EU'] }), 'Europe');
  assert.equal(eventRegionLabel({ regions: ['AS', 'OC'] }), 'Asia and Oceania');
  assert.equal(eventScope({ regions: ['AF'] }), ' in Africa');
  assert.equal(eventScope({}), '');
  assert.equal(eventRegionLabel({ regions: ['EU', 'AS', 'OC'] }), 'Europe, Asia and Oceania');
});
