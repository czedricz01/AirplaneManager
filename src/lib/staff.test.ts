import test from 'node:test';
import assert from 'node:assert/strict';

import { isStrikeActive } from './staff';
import { decisionTargetExists, DEFAULT_STAFF, type Staff } from './gameState';

const staffAt = (morale: number, salaryPct = 100, strike: Staff['strike'] = null): Staff => ({ salaryPct, morale, strike });

test('a strike runs in its own month only', () => {
  const staff = staffAt(30, 90, { startOffset: 20, cancelShare: 0.5 });
  assert.equal(isStrikeActive(staff, 20), true);
  assert.equal(isStrikeActive(staff, 21), false);
  assert.equal(isStrikeActive(staffAt(50), 20), false);
});

test('a question is only answered while what it asks about still exists', () => {
  const staff = staffAt(20, 80, { startOffset: 12, cancelShare: 1 });
  const disruptions = [{ id: 'dis_a' }];
  assert.equal(decisionTargetExists({ kind: 'strike', ref: '12' }, { staff, disruptions }), true);
  assert.equal(decisionTargetExists({ kind: 'strike', ref: '11' }, { staff, disruptions }), false, 'an older strike');
  assert.equal(decisionTargetExists({ kind: 'strike', ref: '12' }, { staff: DEFAULT_STAFF, disruptions }), false);
  assert.equal(decisionTargetExists({ kind: 'disruption', ref: 'dis_a' }, { staff, disruptions }), true);
  assert.equal(decisionTargetExists({ kind: 'disruption', ref: 'dis_b' }, { staff, disruptions }), false);
});
