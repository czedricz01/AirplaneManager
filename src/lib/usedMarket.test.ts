import test from 'node:test';
import assert from 'node:assert/strict';

import { LISTINGS_PER_MONTH, MIN_SERVICE_MONTHS, seededRandom, usedListings } from './usedMarket';
import { aircraftList } from '../data/aircraft';
import { getAircraftResaleValue } from './financeUtils';

const byId = new Map(aircraftList.map(a => [a.id, a]));

test('there is nothing second-hand at the start of the game, and a full list later', () => {
  assert.deepEqual(usedListings(aircraftList, 0), []);
  assert.equal(usedListings(aircraftList, 40 * 12).length, LISTINGS_PER_MONTH);
});

test('the same month always gives the same list, and another month a different one', () => {
  const a = usedListings(aircraftList, 300);
  const b = usedListings(aircraftList, 300);
  const c = usedListings(aircraftList, 301);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.map(l => l.aircraftId + l.ageMonths), c.map(l => l.aircraftId + l.ageMonths));
});

test('every listing is of a type in service long enough, no older than the type, and priced below new', () => {
  for (const offset of [150, 300, 450, 600]) {
    for (const l of usedListings(aircraftList, offset)) {
      const spec = byId.get(l.aircraftId)!;
      assert.ok(spec.firstDeliveryOffset <= offset - MIN_SERVICE_MONTHS, `${spec.id} at ${offset}`);
      assert.ok(l.ageMonths <= offset - spec.firstDeliveryOffset, 'no older than the type');
      assert.ok(l.price < spec.basePrice, `${spec.id}: ${l.price} vs ${spec.basePrice}`);
      assert.ok(l.conditionGeneral >= 20 && l.conditionGeneral <= 95 && l.conditionInterior >= 20 && l.conditionInterior <= 95);
      assert.match(l.id, new RegExp(`^${offset}:\\d$`));
    }
  }
});

test('an older listing is worth less than a younger one of the same type and wear', () => {
  const spec = aircraftList[10];
  const young = getAircraftResaleValue({ basePrice: spec.basePrice, conditionGeneral: 70, conditionInterior: 60, ageYears: 5 });
  const old = getAircraftResaleValue({ basePrice: spec.basePrice, conditionGeneral: 70, conditionInterior: 60, ageYears: 20 });
  assert.ok(old < young);
});

test('rivals sometimes put their names on listings', () => {
  const names = usedListings(aircraftList, 500, ['Skyward Air']).map(l => l.seller);
  const all = Array.from({ length: 40 }, (_, i) => usedListings(aircraftList, 400 + i, ['Skyward Air']).map(l => l.seller)).flat();
  assert.ok(all.some(s => s === 'ex-Skyward Air'));
  assert.equal(names.length, LISTINGS_PER_MONTH);
});

test('the generator is deterministic and spreads over 0-1', () => {
  const r1 = seededRandom(5), r2 = seededRandom(5);
  const xs = Array.from({ length: 200 }, () => r1());
  assert.deepEqual(xs, Array.from({ length: 200 }, () => r2()));
  assert.ok(xs.every(x => x >= 0 && x < 1));
  assert.ok(Math.max(...xs) > 0.9 && Math.min(...xs) < 0.1);
});
