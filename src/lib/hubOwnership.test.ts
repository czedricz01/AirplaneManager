import test from 'node:test';
import assert from 'node:assert/strict';

import { hubFeeFactor, ownerIncome, rivalLandingFee, rivalLandingsPerWeek, rivalMayEnter } from './hubOwnership';
import { hubQuality } from './transferUtils';
import { getManagementUnlockCost, getAirportUpkeep } from './financeUtils';

const rivals = [
  { routes: [{ origin: 'FRA', destination: 'CDG', departures: 10 }, { origin: 'LHR', destination: 'FRA', departures: 5 }] },
  { routes: [{ origin: 'AMS', destination: 'CDG', departures: 7 }] }
];

test('fees fall with each tier, and tier 3 is the cheapest', () => {
  assert.equal(hubFeeFactor(1), 1);
  assert.equal(hubFeeFactor(2), 0.95);
  assert.equal(hubFeeFactor(3), 0.85);
  assert.equal(hubFeeFactor(undefined), 1);
});

test('tier 3 costs $25M a level and tier 2 is unchanged', () => {
  assert.equal(getManagementUnlockCost(4, 3), 100_000_000);
  assert.equal(getManagementUnlockCost(4, 2), 3_000_000);
});

test('tier 3 makes a better transfer hub than tier 2, within the cap', () => {
  assert.ok(hubQuality({ level: 3 }) > hubQuality({ level: 2 }));
  assert.ok(hubQuality({ level: 3 }) - hubQuality({ level: 2 }) > 0.15);
  assert.equal(hubQuality({ level: 3, hubFacilities: { vipLounge: true, catering: true } }), 1);
});

test('rival landings are counted at both ends of every route', () => {
  assert.equal(rivalLandingsPerWeek('FRA', rivals), 15);
  assert.equal(rivalLandingsPerWeek('CDG', rivals), 17);
  assert.equal(rivalLandingsPerWeek('MAD', rivals), 0);
});

test('the owner collects half the rivals\' landing fees, only at tier-3 airports', () => {
  const mgt = { FRA: { level: 3 }, CDG: { level: 2 } };
  const income = ownerIncome(mgt, () => 4, rivals);
  assert.equal(income.items.length, 1);
  assert.equal(income.items[0].airportId, 'FRA');
  assert.equal(income.total, Math.round(15 * 4 * rivalLandingFee(4) * 0.5));
  assert.equal(ownerIncome({ FRA: { level: 2 } }, () => 4, rivals).total, 0);
  assert.equal(ownerIncome(mgt, () => 4, []).total, 0);
});

test('rivals may enter every airport except the player\'s tier-3 ones', () => {
  assert.equal(rivalMayEnter('FRA', { FRA: { level: 3 } }), false);
  assert.equal(rivalMayEnter('FRA', { FRA: { level: 2 } }), true);
  assert.equal(rivalMayEnter('MAD', {}), true);
});

test('a tier-3 airport\'s desks are cheaper than a tier-2 one\'s', () => {
  const airport: any = { id: 'FRA', level: 4 };
  const infra = (level: number) => ({ level, slots: { regional: 0, narrowbody: 10, widebody: 0 }, stands: {}, desks: { normal: 10, self: 0 } });
  const t2 = getAirportUpkeep(airport, infra(2), [], []).desks.normal;
  const t3 = getAirportUpkeep(airport, infra(3), [], []).desks.normal;
  assert.ok(t3 < t2);
});
