import test from 'node:test';
import assert from 'node:assert/strict';

import { buildYearSnapshot, goalFraction, normalizeGoal, type AnnualGoal, type YearSnapshot } from './annualGoals';
const snap = (over: Partial<YearSnapshot> = {}): YearSnapshot => ({
  profit: 0, pax: 0, lossMonths: 0, routes: 0, regions: 0, reputation: 50, ...over
});

test('progress is a fraction between 0 and 1', () => {
  const goal: AnnualGoal = { year: 1970, kind: 'profit', target: 200, label: 'p', tag: 'steady', reward: { reputation: 3, cash: 0 }, penalty: 1 };
  assert.equal(goalFraction(goal, snap({ profit: 50 })), 0.25);
  assert.equal(goalFraction(goal, snap({ profit: 900 })), 1);
  assert.equal(goalFraction(goal, snap({ profit: -50 })), 0);
  assert.equal(goalFraction({ ...goal, kind: 'noLoss', target: 0 }, snap({ lossMonths: 2 })), 0);
});

test('the year snapshot sums the year, counts loss months and ignores other years', () => {
  const reports = [
    { year: 1969, totalProfit: 999, paxTotal: 999 },
    { year: 1970, totalProfit: 100, paxTotal: 10 },
    { year: 1970, totalProfit: -40, paxTotal: 20 },
    { year: 1970, totalProfit: 5 }
  ];
  assert.deepEqual(buildYearSnapshot(reports, 1970, { routes: 4, regions: 2, reputation: 61 }),
    { profit: 65, pax: 30, lossMonths: 1, routes: 4, regions: 2, reputation: 61 });
});

test('the old { year, targetProfit } goal loads as a steady profit goal', () => {
  const g = normalizeGoal({ year: 1975, targetProfit: 3_000_000 })!;
  assert.equal(g.kind, 'profit');
  assert.equal(g.target, 3_000_000);
  assert.equal(g.reward.reputation, 4);
  assert.equal(g.penalty, 0);
  assert.equal(normalizeGoal(null), null);
  assert.equal(normalizeGoal({ year: 'x' }), null);
  assert.equal(normalizeGoal({ year: 1975 }), null);
});
