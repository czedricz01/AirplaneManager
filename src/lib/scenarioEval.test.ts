import test from 'node:test';
import assert from 'node:assert/strict';

import { formatGoalValue, goalValue, meetsTarget, monthsLeft, scenarioBriefing, scenarioGoals, type ScenarioContext } from './scenarioEval';
import { SCENARIOS, scenarioById } from '../data/scenarios';
import { setDecimalSymbol } from './format';

setDecimalSymbol('.');

const jetAge = scenarioById('jet-age')!;
const oilShock = scenarioById('oil-shock')!;
const deregulation = scenarioById('deregulation')!;

const ctx = (over: Partial<ScenarioContext> = {}): ScenarioContext => ({
  offset: 10,
  capital: 20_000_000,
  routes: [],
  reputation: 50,
  regionsServed: 1,
  transferPaxMonth: 0,
  monthlyProfit: 0,
  floorStreak: 0,
  creditLimit: 10_000_000,
  ...over
});

/** A route from New York to destination number `i`, flown `weeklyFlights` times a week by one aircraft. */
const fromJfk = (i: number, weeklyFlights: number) => ({ origin: 'JFK', destination: `D${String(i).padStart(2, '0')}`, weeklyFlights });

test('an operating profit means more than breaking even, and needs a closed month', () => {
  const profit = deregulation.win[1];
  assert.equal(profit.target, 0);
  const at = (monthlyProfit: number | null) => scenarioGoals(deregulation, ctx({ monthlyProfit })).find(g => g.id === 'profit')!;
  assert.equal(at(0).done, false, 'a month that only breaks even has made no profit');
  assert.equal(at(0).progress, 0);
  assert.equal(at(1).done, true);
  assert.equal(at(1).progress, 1);
  assert.equal(at(-5).done, false);

  // Before the scenario's first close there is no month to judge.
  const none = at(null);
  assert.equal(none.done, false);
  assert.equal(none.current, null);
  assert.equal(none.progress, 0);
  assert.equal(formatGoalValue('monthlyProfit', none.current, true), '\u2014');
  assert.equal(formatGoalValue('transferPax', null), '\u2014');
  const pax = scenarioGoals(scenarioById('hub-builder')!, ctx({ transferPaxMonth: null }))[0];
  assert.equal(pax.current, null);
  assert.equal(pax.done, false);

  // Only a target of zero is strict; any other is met on reaching it.
  assert.equal(meetsTarget(0, 0), false);
  assert.equal(meetsTarget(100, 100), true);
  assert.equal(meetsTarget(-1_000, -1_000), true);
  assert.equal(meetsTarget(null, -1_000), false);
});

test('every metric reads its own figure', () => {
  const c = ctx({ capital: 1, reputation: 2, regionsServed: 3, transferPaxMonth: 4, monthlyProfit: 5, routes: [fromJfk(1, 1)] });
  const value = (metric: any) => goalValue({ id: 'x', kind: 'target', metric, target: 1, label: '' }, c);
  assert.deepEqual(['capital', 'reputation', 'regions', 'transferPax', 'monthlyProfit', 'routes'].map(value), [1, 2, 3, 4, 5, 1]);
});

test('months left counts the current month, and the goals list covers both kinds', () => {
  assert.equal(monthsLeft(jetAge, jetAge.startOffset), 60);
  assert.equal(monthsLeft(jetAge, jetAge.deadlineOffset), 1);
  assert.equal(monthsLeft(jetAge, jetAge.deadlineOffset + 5), 0);
  const goals = scenarioGoals(deregulation, ctx());
  assert.deepEqual(goals.map(g => g.kind), ['win', 'win', 'lose']);
});

test('the briefing names every goal and every way to lose', () => {
  for (const s of SCENARIOS) {
    const text = scenarioBriefing(s);
    for (const g of [...s.win, ...s.lose]) assert.ok(text.includes(g.label), `${s.id}: ${g.label}`);
  }
  assert.match(scenarioBriefing(oilShock), /decided at the close of 12\/1976/);
  assert.match(scenarioBriefing(jetAge), /won on the spot/);
});

test('E77: the floor is the model\'s: the negative credit line, or the scenario\'s own threshold', () => {
  const lose = (s: typeof oilShock, c: Partial<ScenarioContext> = {}) => scenarioGoals(s, ctx(c)).find(g => g.kind === 'lose')!;
  const bankrupt = lose(deregulation, { offset: deregulation.startOffset, creditLimit: 12_000_000, capital: -13_000_000, floorStreak: 2 });
  assert.equal(bankrupt.target, -12_000_000);
  assert.equal(bankrupt.streak, 2);
  assert.equal(bankrupt.months, 3);
  assert.equal(bankrupt.below, true);
  assert.equal(bankrupt.done, false);
  assert.equal(lose(deregulation, { floorStreak: 3 }).done, true);
  assert.equal(lose(deregulation, { capital: -9_000_000 }).below, false);
  assert.match(deregulation.lose[0].label, /negative credit line/);
  // Oil Shock: never below $0, whatever the credit line.
  const solvent = lose(oilShock, { offset: oilShock.startOffset + 10, creditLimit: 50_000_000, capital: -1 });
  assert.equal(solvent.target, 0);
  assert.equal(solvent.below, true);
  assert.equal(solvent.months, 1);
});
