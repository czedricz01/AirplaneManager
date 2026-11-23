import test from 'node:test';
import assert from 'node:assert/strict';

import { MILESTONES, SLOT_DISCOUNT_CAP, milestonePerks } from './milestones';

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

test('slot discounts add up but stop at the cap, and gold milestones give hubs', () => {
  assert.equal(milestonePerks([]).slotPriceFactor, 1);
  const some = milestonePerks(['routes-50']);
  assert.ok(some.slotPriceFactor < 1 && some.slotPriceFactor > 1 - SLOT_DISCOUNT_CAP);
  const all = milestonePerks(MILESTONES.map(m => m.id));
  assert.equal(Math.round(all.slotPriceFactor * 1000) / 1000, 1 - SLOT_DISCOUNT_CAP);
  assert.ok(all.extraHubs >= 2);
  assert.equal(milestonePerks(['no-such-milestone']).slotPriceFactor, 1);
});
