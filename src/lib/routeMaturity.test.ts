import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LOYALTY_MAX, RAMP_MONTHS, RAMP_START, maturityFactors, maturityNote, monthsOpen, routeMaturityFactor
} from './routeMaturity';

test('a new route starts at 60% and is at full demand after nine months', () => {
  assert.equal(routeMaturityFactor(0), RAMP_START);
  assert.equal(routeMaturityFactor(RAMP_MONTHS), 1);
  assert.ok(Math.abs(routeMaturityFactor(4.5) - 0.8) < 1e-9);
});

test('demand only grows with the months a route has been open, and flattens at 5% above full', () => {
  let last = 0;
  for (let m = 0; m <= 80; m++) {
    const f = routeMaturityFactor(m);
    assert.ok(f >= last, `month ${m}`);
    last = f;
  }
  assert.equal(routeMaturityFactor(12), 1);
  assert.equal(routeMaturityFactor(24), 1);
  assert.ok(routeMaturityFactor(36) > 1 && routeMaturityFactor(36) < 1 + LOYALTY_MAX);
  assert.equal(routeMaturityFactor(48), 1 + LOYALTY_MAX);
  assert.equal(routeMaturityFactor(500), 1 + LOYALTY_MAX);
});

test('nonsense months count as mature or as month zero, never as NaN', () => {
  assert.equal(routeMaturityFactor(NaN), 1);
  assert.equal(routeMaturityFactor(-5), RAMP_START);
});

test('routes without an opening date are mature and left out', () => {
  assert.equal(monthsOpen({}, 100), null);
  assert.equal(maturityFactors([{ id: 'old' }], 100), undefined);
  const f = maturityFactors([{ id: 'old' }, { id: 'new', openedOffset: 98 }, { id: 'prime', openedOffset: 80 }], 100)!;
  assert.deepEqual(Object.keys(f), ['new']);
  assert.ok(f.new < 1);
});

test('a route opened this month is month zero', () => {
  assert.equal(monthsOpen({ openedOffset: 40 }, 40), 0);
  assert.equal(monthsOpen({ openedOffset: 40 }, 30), 0, 'a date in the future cannot make it negative');
});

test('the note reads for ramping and loyal routes and is empty for mature ones', () => {
  assert.equal(maturityNote(0.74), 'Ramping up: 74% of full demand');
  assert.equal(maturityNote(1.03), 'Loyal customers: +3% demand');
  assert.equal(maturityNote(1), null);
  assert.equal(maturityNote(undefined), null);
});
