import test from 'node:test';
import assert from 'node:assert/strict';

import { describeGoal, goalReports, normalizeGoal, normalizeOffer, type AnnualGoal } from './annualGoals';
import { annualGoalOffers, yearSnapshot } from '../model/progress';

const goal: AnnualGoal = { year: 1970, kind: 'profit', tag: 'steady', target: 2_000_000, reward: 250_000, penalty: 125_000 };

test('a goal reads as a sentence', () => {
  const money = (n: number) => '$' + n;
  assert.equal(describeGoal(goal, money, String), 'Operating profit of $2000000');
  assert.equal(describeGoal({ ...goal, kind: 'routes', target: 12 }, money, String), '12 routes by December');
  assert.equal(describeGoal({ ...goal, kind: 'noLoss', target: 0 }, money, String), 'No month in loss');
});

test('the reports go to the model as result, revenue and passengers', () => {
  const reports = [
    { year: 1969, totalProfit: 999, routeRevenues: 9_999, paxTotal: 999 },
    { year: 1970, totalProfit: 100, routeRevenues: 1_000, paxTotal: 10 },
    { year: 1970, totalProfit: -40, routeRevenues: 500, paxTotal: 20 },
    { year: 1970, totalProfit: 5 }
  ];
  assert.deepEqual(goalReports(reports)[3], { year: 1970, result: 5, revenue: 0, passengers: 0 });
  assert.deepEqual(yearSnapshot(goalReports(reports), 1970, { routes: 4, regions: 2, reputation: 61 }),
    { profit: 65, revenue: 1_500, pax: 30, lossMonths: 1, routes: 4, regions: 2, reputation: 61 });
});

test('a saved goal is kept exactly as the model made it; anything else is dropped', () => {
  const offers = annualGoalOffers({ year: 1971, month: 131, lastYearProfit: 3e6, lastYearRevenue: 4e7, lastYearPax: 50_000, routes: 6, regions: 2, reputation: 55 });
  for (const g of offers) assert.deepEqual(normalizeGoal(JSON.parse(JSON.stringify(g))), g);
  assert.deepEqual(normalizeOffer({ year: 1971, options: [...offers, { year: 1975, targetProfit: 3e6 }] }), { year: 1971, options: offers });
  assert.equal(normalizeGoal({ year: 1975, targetProfit: 3_000_000 }), null, 'the old shape is not a goal any more');
  assert.equal(normalizeGoal({ ...goal, reward: { reputation: 4, cash: 0 } }), null);
  assert.equal(normalizeGoal(null), null);
  assert.equal(normalizeOffer({ year: 1971, options: [] }), null);
});
