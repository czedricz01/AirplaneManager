import test from 'node:test';
import assert from 'node:assert/strict';

import { createOwnedAircraft, defaultCabin, startingFleet } from './fleet';
import { aircraftList } from '../data/aircraft';
import { scenarioById } from '../data/scenarios';

const b707 = aircraftList.find(a => a.id === '707-420')!;

test('new aircraft get unique registrations from the hub country, the date and a full condition', () => {
  const { config, baseInteriorPop } = defaultCabin(b707);
  const planes = createOwnedAircraft(b707, 3, { config, baseInteriorPop, hub: 'FRA', existingRegistrations: [], purchasedAt: 7 });
  assert.equal(planes.length, 3);
  assert.equal(new Set(planes.map(p => p.registration)).size, 3);
  for (const p of planes) {
    assert.match(p.registration, /^D-A/);
    assert.equal(p.purchasedAt, 7);
    assert.equal(p.conditionGeneral, 100);
    assert.equal(p.conditionInterior, 100);
    assert.equal(p.refitsDone, 0);
    assert.equal(p.id, '707-420');
  }
  const more = createOwnedAircraft(b707, 1, { config, baseInteriorPop, hub: 'FRA', existingRegistrations: planes.map(p => p.registration), purchasedAt: 8 });
  assert.ok(!planes.some(p => p.registration === more[0].registration), 'never a registration already flying');
});

test('the default cabin is all economy, as the purchase screen starts', () => {
  const { config, baseInteriorPop } = defaultCabin(b707);
  assert.deepEqual([config.first, config.business, config.premium, config.economy], [0, 0, 0, b707.capacity]);
  assert.equal(config.details.economy.pitch, 74);
  assert.equal(config.details.economy.seats, b707.capacity);
  assert.equal(baseInteriorPop, 50);
});

test('a scenario fleet arrives with its age and wear', () => {
  const oil = scenarioById('oil-shock')!;
  const fleet = startingFleet(oil);
  assert.equal(fleet.length, 4);
  assert.match(fleet[0].registration, /^G-/);
  const b707s = fleet.filter(p => p.id === '707-320b');
  assert.equal(b707s.length, 2);
  assert.equal(b707s[0].purchasedAt, oil.startOffset - 96);
  assert.equal(b707s[0].conditionGeneral, 60);
  assert.equal(new Set(fleet.map(p => p.registration)).size, fleet.length);
  assert.equal(startingFleet({ ...oil, fleet: [{ model: 'no-such-jet', count: 2 }] }).length, 0);
});
