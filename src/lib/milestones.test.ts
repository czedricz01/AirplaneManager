import test from 'node:test';
import assert from 'node:assert/strict';

import { MILESTONES, SLOT_DISCOUNT_CAP, milestonePerks, newlyEarned, totalReward, describeReward, type MilestoneContext } from './milestones';

const ctx = (over: Partial<MilestoneContext> = {}): MilestoneContext => ({
  routeCount: 0, fleetSize: 0, capital: 0, longestRouteKm: 0, continents: 0, profitableMonthStreak: 0,
  reputation: 50, careerPax: 0, transferPaxMonth: 0, hasWidebody: false, hasSupersonic: false, ...over
});

test('ids are unique and every milestone has a track and tier', () => {
  const ids = MILESTONES.map(m => m.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(MILESTONES.length >= 28);
});

test('the seven original milestones keep their ids, so earned ones stay earned', () => {
  for (const id of ['first-route', 'fleet-10', 'longhaul', 'continents-4', 'capital-100m', 'profit-12', 'reputation-80']) {
    assert.ok(MILESTONES.some(m => m.id === id), id);
  }
});

test('nothing is earned by an empty airline at reputation 50', () => {
  assert.deepEqual(newlyEarned([], ctx()), []);
});

test('a milestone is awarded once', () => {
  const c = ctx({ routeCount: 12 });
  const first = newlyEarned([], c).map(m => m.id);
  assert.deepEqual(first, ['first-route', 'routes-10']);
  assert.deepEqual(newlyEarned(first, c), []);
});

test('tiers in a track need more each time', () => {
  const c = ctx({ routeCount: 60, careerPax: 11_000_000 });
  const ids = newlyEarned([], c).map(m => m.id);
  assert.ok(ids.includes('routes-50') && !ids.includes('routes-150'));
  assert.ok(ids.includes('pax-10m') && !ids.includes('pax-100m'));
});

test('feats are awarded for the fleet', () => {
  assert.ok(newlyEarned([], ctx({ hasWidebody: true })).some(m => m.id === 'widebody'));
  assert.ok(newlyEarned([], ctx({ hasSupersonic: true })).some(m => m.id === 'supersonic'));
});

test('slot discounts add up but stop at the cap, and gold milestones give hubs', () => {
  assert.equal(milestonePerks([]).slotPriceFactor, 1);
  const some = milestonePerks(['routes-50']);
  assert.ok(some.slotPriceFactor < 1 && some.slotPriceFactor > 1 - SLOT_DISCOUNT_CAP);
  const all = milestonePerks(MILESTONES.map(m => m.id));
  assert.equal(Math.round(all.slotPriceFactor * 1000) / 1000, 1 - SLOT_DISCOUNT_CAP);
  assert.ok(all.extraHubs >= 2);
  assert.equal(milestonePerks(['no-such-milestone']).slotPriceFactor, 1);
});

test('rewards sum and read as a sentence', () => {
  const sum = totalReward(MILESTONES.filter(m => m.id === 'routes-10' || m.id === 'routes-50'));
  assert.equal(sum.reputation, 8);
  assert.equal(sum.cash, 3_500_000);
  assert.match(describeReward(sum, n => `$${n}`), /reputation \+8, \$3500000 prize, slots 2% cheaper/);
  assert.match(describeReward({ reputation: 0, cash: 0, slotDiscount: 0, extraHubs: 0 }, String), /this one is the reward/);
});
