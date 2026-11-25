import test from 'node:test';
import assert from 'node:assert/strict';

import { describeGoal, goalOfferLines, goalReports, normalizeGoal, normalizeOffer, type AnnualGoal } from './annualGoals';
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

test('the offer text counts the goals, says whether a harder goal pays more, and names the January deadline (5.3b)', () => {
  // A small airline without routes: two goals, both at the minimum bonus (model 6.11).
  const small = annualGoalOffers({ year: 1961, month: 11, lastYearProfit: -25_000, lastYearRevenue: 0, lastYearPax: 0, routes: 0, regions: 0, reputation: 50 });
  assert.equal(small.length, 2);
  assert.equal(small[0].reward, small[1].reward);
  const smallText = goalOfferLines({ year: 1961, options: [...small] });
  assert.match(smallText.intro, /offers two goals for 1961/);
  assert.match(smallText.intro, /same minimum bonus/);
  assert.equal(smallText.deadline, 'Choose before January 1961 is closed; without a choice the first goal stands.');
  // A large airline: three goals, a harder one pays more.
  const big = annualGoalOffers({ year: 1991, month: 371, lastYearProfit: 400e6, lastYearRevenue: 4e9, lastYearPax: 5e6, routes: 40, regions: 3, reputation: 60 });
  assert.equal(big.length, 3);
  const bigText = goalOfferLines({ year: 1991, options: [...big] });
  assert.match(bigText.intro, /offers three goals for 1991\. A harder goal pays more/);
});
