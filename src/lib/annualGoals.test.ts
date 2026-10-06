import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildYearSnapshot, describeGoal, generateGoalOffers, goalFraction, goalMet, normalizeGoal, normalizeOffer, settleGoal,
  type AnnualGoal, type OfferContext, type YearSnapshot
} from './annualGoals';

const ctx = (over: Partial<OfferContext> = {}): OfferContext => ({
  lastYearProfit: 10_000_000, lastYearPax: 500_000, routes: 10, regions: 2, reputation: 60, ...over
});
const snap = (over: Partial<YearSnapshot> = {}): YearSnapshot => ({
  profit: 0, pax: 0, lossMonths: 0, routes: 0, regions: 0, reputation: 50, ...over
});

test('three goals: steady, one of another kind, stretch', () => {
  const offers = generateGoalOffers(1965, ctx());
  assert.equal(offers.length, 3);
  assert.deepEqual(offers.map(o => o.tag), ['steady', 'focus', 'stretch']);
  assert.ok(offers.every(o => o.year === 1965));
  const [steady, , stretch] = offers;
  assert.equal(steady.kind, 'profit');
  assert.ok(stretch.target > steady.target);
  assert.ok(stretch.reward.reputation > steady.reward.reputation && stretch.penalty > steady.penalty);
});

test('the profit floor holds for a weak year', () => {
  const [steady, , stretch] = generateGoalOffers(1961, ctx({ lastYearProfit: -5_000_000 }));
  assert.ok(steady.target >= 2_000_000);
  assert.ok(stretch.target >= 3_000_000);
});

test('the other goal rotates with the year and skips goals that make no sense', () => {
  const kinds = new Set([1960, 1961, 1962, 1963, 1964, 1965].map(y => generateGoalOffers(y, ctx())[1].kind));
  assert.ok(kinds.size >= 4);
  const all6 = [1960, 1961, 1962, 1963, 1964].map(y => generateGoalOffers(y, ctx({ regions: 6 }))[1].kind);
  assert.ok(!all6.includes('regions'), 'all six regions already served');
  const topRep = [1960, 1961, 1962, 1963, 1964].map(y => generateGoalOffers(y, ctx({ reputation: 95 }))[1].kind);
  assert.ok(!topRep.includes('reputation'));
  // No routes at all: only profit goals can be offered.
  const bare = generateGoalOffers(1960, ctx({ routes: 0, lastYearPax: 0 }));
  assert.deepEqual(bare.map(o => o.kind), ['profit', 'profit']);
});

test('targets read like targets', () => {
  const [steady] = generateGoalOffers(1970, ctx({ lastYearProfit: 4_321_987 }));
  assert.equal(steady.target % 100_000, 0);
});

test('each kind is judged on its own figure', () => {
  const g = (kind: AnnualGoal['kind'], target: number): AnnualGoal =>
    ({ year: 1970, kind, target, label: kind, tag: 'focus', reward: { reputation: 5, cash: 1 }, penalty: 2 });
  assert.equal(goalMet(g('profit', 100), snap({ profit: 100 })), true);
  assert.equal(goalMet(g('profit', 100), snap({ profit: 99 })), false);
  assert.equal(goalMet(g('routes', 12), snap({ routes: 12 })), true);
  assert.equal(goalMet(g('regions', 3), snap({ regions: 2 })), false);
  assert.equal(goalMet(g('reputation', 70), snap({ reputation: 71 })), true);
  assert.equal(goalMet(g('pax', 1000), snap({ pax: 999 })), false);
  assert.equal(goalMet(g('noLoss', 0), snap({ lossMonths: 0 })), true);
  assert.equal(goalMet(g('noLoss', 0), snap({ lossMonths: 1 })), false);
});

test('progress is a fraction between 0 and 1', () => {
  const goal: AnnualGoal = { year: 1970, kind: 'profit', target: 200, label: 'p', tag: 'steady', reward: { reputation: 3, cash: 0 }, penalty: 1 };
  assert.equal(goalFraction(goal, snap({ profit: 50 })), 0.25);
  assert.equal(goalFraction(goal, snap({ profit: 900 })), 1);
  assert.equal(goalFraction(goal, snap({ profit: -50 })), 0);
  assert.equal(goalFraction({ ...goal, kind: 'noLoss', target: 0 }, snap({ lossMonths: 2 })), 0);
});

test('settling pays the reward when met and costs reputation when missed', () => {
  const goal: AnnualGoal = { year: 1970, kind: 'profit', target: 100, label: 'p', tag: 'stretch', reward: { reputation: 7, cash: 500_000 }, penalty: 3 };
  assert.deepEqual(settleGoal(goal, snap({ profit: 100 })), { met: true, reputation: 7, cash: 500_000, achieved: 100 });
  assert.deepEqual(settleGoal(goal, snap({ profit: 10 })), { met: false, reputation: -3, cash: 0, achieved: 10 });
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

test('a saved goal and offer round-trip; garbage is dropped', () => {
  const offers = generateGoalOffers(1980, ctx());
  const reloaded = normalizeOffer(JSON.parse(JSON.stringify({ year: 1980, options: offers })))!;
  assert.deepEqual(reloaded.options, offers);
  assert.equal(normalizeOffer({ year: 1980, options: [{ nonsense: true }] }), null);
  assert.equal(normalizeOffer('x'), null);
});

test('goals describe themselves', () => {
  const fmt = (n: number) => `$${n}`;
  const num = (n: number) => String(n);
  const [steady, other] = generateGoalOffers(1960, ctx());
  assert.match(describeGoal(steady, fmt, num), /^Operating profit of \$/);
  assert.ok(describeGoal(other, fmt, num).length > 5);
});
