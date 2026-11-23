import test from 'node:test';
import assert from 'node:assert/strict';

import { isStrikeActive, strikeCancelShare } from './staff';
import { buildPlayerModifiers, combineCancelShares, decisionTargetExists, routeCancelShare, DEFAULT_STAFF, type Staff } from './gameState';

const staffAt = (morale: number, salaryPct = 100, strike: Staff['strike'] = null): Staff => ({ salaryPct, morale, strike });

test('a strike grounds every route through the modifiers, in its own month only', () => {
  const staff = staffAt(30, 90, { startOffset: 20, cancelShare: 0.5 });
  assert.equal(isStrikeActive(staff, 20), true);
  assert.equal(strikeCancelShare(staff, 21), 0);

  const during = buildPlayerModifiers({ reputation: 50, eventChoices: {}, staff }, 20);
  assert.equal(during.cancelShareAll, 0.5);
  assert.equal(routeCancelShare(during, 'any-route'), 0.5, 'a route drafted during the strike too');
  assert.equal(during.crewCostFactor, 0.9);
  assert.equal(during.satDelta, -2);

  const after = buildPlayerModifiers({ reputation: 50, eventChoices: {}, staff }, 21);
  assert.equal(after.cancelShareAll, undefined);

  // With a route's own cancellations, the causes combine rather than add up.
  const both = { ...during, cancelShare: { r1: 0.5 } };
  assert.equal(routeCancelShare(both, 'r1'), 0.75);
  assert.equal(combineCancelShares(0.25, 0.25), 0.4375);
  assert.equal(combineCancelShares(), 0);
  assert.equal(combineCancelShares(1, 0.3), 1);

  // Neutral staff add nothing at all: market pay at morale 50.
  const neutral = buildPlayerModifiers({ reputation: 50, eventChoices: {}, staff: staffAt(50) }, 20);
  assert.deepEqual(neutral, buildPlayerModifiers({ reputation: 50, eventChoices: {} }, 20));
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
