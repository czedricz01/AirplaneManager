import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PARKED_SHARE, POPULARITY_DECAY_MAX, RESALE_AGE_FLOOR, ageYears, agedPopularity, fleetOwnershipCost, maintenanceRate,
  monthlyOwnershipCost, popularityDecay, resaleAgeFactor
} from './fleetCosts';
import { getAircraftResaleValue } from './financeUtils';

test('age counts from the purchase month, and an aircraft with no date is new', () => {
  assert.equal(ageYears({ purchasedAt: 0 }, 24), 2);
  assert.equal(ageYears({}, 500), 0);
  assert.equal(ageYears({ purchasedAt: 100 }, 50), 0);
});

test('upkeep rises with age and stops rising at 25 years', () => {
  assert.equal(maintenanceRate(0), 0.03);
  assert.ok(maintenanceRate(10) > maintenanceRate(5));
  assert.equal(maintenanceRate(25), 0.08);
  assert.equal(maintenanceRate(60), 0.08);
});

test('an old aircraft costs more per month than a new one, and a parked one half', () => {
  const price = 40_000_000;
  const fresh = monthlyOwnershipCost({ basePrice: price, purchasedAt: 0 }, 0, true);
  const old = monthlyOwnershipCost({ basePrice: price, purchasedAt: 0 }, 12 * 25, true);
  assert.ok(old > fresh * 1.5);
  const parked = monthlyOwnershipCost({ basePrice: price, purchasedAt: 0 }, 0, false);
  assert.equal(parked, Math.round(fresh * PARKED_SHARE));
  // About 3.6% of the price a year for a new aircraft.
  assert.ok(Math.abs(fresh * 12 / price - 0.036) < 0.001);
});

test('the fleet bill adds every aircraft and reports the parked share', () => {
  const fleet = [
    { registration: 'A', basePrice: 10_000_000, purchasedAt: 0 },
    { registration: 'B', basePrice: 10_000_000, purchasedAt: 0 }
  ];
  const bill = fleetOwnershipCost(fleet, new Set(['A']), 0);
  const one = monthlyOwnershipCost(fleet[0], 0, true);
  assert.equal(bill.total, one + Math.round(one * PARKED_SHARE));
  assert.equal(bill.parked, Math.round(one * PARKED_SHARE));
  assert.equal(bill.parkedCount, 1);
  assert.deepEqual(fleetOwnershipCost([], new Set(), 0), { total: 0, parked: 0, parkedCount: 0 });
});

test('resale value falls with age, to a floor, and condition still counts', () => {
  assert.equal(resaleAgeFactor(0), 1);
  assert.ok(resaleAgeFactor(10) < resaleAgeFactor(5));
  assert.equal(resaleAgeFactor(100), RESALE_AGE_FLOOR);
  const plane = { basePrice: 10_000_000, conditionGeneral: 100, conditionInterior: 100 };
  assert.equal(getAircraftResaleValue(plane), 9_000_000, 'no age given: as before');
  assert.equal(getAircraftResaleValue({ ...plane, ageYears: 10 }), Math.round(9_000_000 * resaleAgeFactor(10)));
  assert.ok(getAircraftResaleValue({ ...plane, ageYears: 10, conditionGeneral: 20 }) < getAircraftResaleValue({ ...plane, ageYears: 10 }));
});

test('a type loses popularity after eight years, by at most 15 points, and never goes below 1', () => {
  assert.equal(popularityDecay(5), 0);
  assert.equal(popularityDecay(8), 0);
  assert.equal(popularityDecay(13), 5);
  assert.equal(popularityDecay(80), POPULARITY_DECAY_MAX);
  assert.equal(agedPopularity(80, 13), 75);
  assert.equal(agedPopularity(10, 80), 1);
});
