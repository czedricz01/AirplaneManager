import test from 'node:test';
import assert from 'node:assert/strict';

import { TRACK_LABELS, describeReward, milestonePerks } from './milestones';
import { MILESTONE_SLOT_DISCOUNT_MAX, MILESTONES } from '../model/constants';
import { milestoneDef, milestonePrize } from '../model/progress';

test('every track of the model table has a name', () => {
  for (const m of MILESTONES) assert.ok(TRACK_LABELS[m.track], m.id);
});

test('slot discounts add up but stop at the cap, and gold milestones give hubs (6.10)', () => {
  assert.deepEqual(milestonePerks([]), { slotPriceFactor: 1, extraHubs: 0 });
  const some = milestonePerks(['routes-50']);
  assert.ok(some.slotPriceFactor < 1 && some.slotPriceFactor > 1 - MILESTONE_SLOT_DISCOUNT_MAX);
  const all = milestonePerks(MILESTONES.map(m => m.id));
  assert.equal(Math.round(all.slotPriceFactor * 1000) / 1000, 1 - MILESTONE_SLOT_DISCOUNT_MAX);
  assert.equal(all.extraHubs, 3);
  assert.equal(milestonePerks(['no-such-milestone']).slotPriceFactor, 1);
});

test('the reward text names the prize of the month, the slot discount and the hubs, no reputation (E38)', () => {
  const money = (n: number) => '$' + Math.round(n);
  const first = milestoneDef('first-route');
  assert.equal(describeReward(first, 0, money), money(milestonePrize(first, 0)) + ' prize');
  const gold = describeReward(milestoneDef('routes-150'), 300, money);
  assert.match(gold, /slots 3% cheaper/);
  assert.match(gold, /room for 1 more hub$/);
  assert.doesNotMatch(gold, /reputation/);
  assert.notEqual(describeReward(first, 600, money), describeReward(first, 0, money), 'prize with the cost index');
});
