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

// --- Commonality ---------------------------------------------------------------

import { fleetCommonality, familyDiscount, varietyPenalty, VARIETY_PENALTY_MAX } from './fleetCosts';

const planes = (family: string, n: number, prefix = family) =>
  Array.from({ length: n }, (_, i) => ({ registration: `${prefix}-${i}`, family, basePrice: 20_000_000, purchasedAt: 0 }));

test('a family of aircraft earns a bigger maintenance discount the larger it is', () => {
  assert.equal(familyDiscount(1), 0);
  assert.equal(familyDiscount(3), 0.04);
  assert.equal(familyDiscount(6), 0.08);
  assert.equal(familyDiscount(12), 0.12);
  assert.equal(familyDiscount(40), 0.15);
});

test('three families are free, each one beyond costs 3% on everything, to a ceiling', () => {
  assert.equal(varietyPenalty(1), 0);
  assert.equal(varietyPenalty(3), 0);
  assert.ok(Math.abs(varietyPenalty(5) - 0.06) < 1e-12);
  assert.equal(varietyPenalty(40), VARIETY_PENALTY_MAX);
});

test('ten aircraft of one family are cheaper to keep than ten of ten families', () => {
  const same = planes('A320', 10);
  const mixed = Array.from({ length: 10 }, (_, i) => ({ registration: `M-${i}`, family: `Type${i}`, basePrice: 20_000_000, purchasedAt: 0 }));
  const flying = (list: { registration: string }[]) => new Set(list.map(p => p.registration));
  const a = fleetOwnershipCost(same, flying(same), 0).total;
  const b = fleetOwnershipCost(mixed, flying(mixed), 0).total;
  assert.ok(a < b, `${a} vs ${b}`);
  assert.ok(b / a > 1.1, 'a difference worth planning for');
  assert.ok(fleetCommonality(same).meanFactor < 1);
  assert.ok(fleetCommonality(mixed).meanFactor > 1);
});

test('the commonality report lists the biggest family first and an empty fleet is neutral', () => {
  const fleet = [...planes('737', 5), ...planes('A320', 2, 'B')];
  const c = fleetCommonality(fleet);
  assert.deepEqual(c.families.map(f => [f.family, f.count]), [['737', 5], ['A320', 2]]);
  assert.equal(c.penalty, 0);
  assert.equal(fleetCommonality([]).meanFactor, 1);
});
