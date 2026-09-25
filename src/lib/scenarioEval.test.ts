import test from 'node:test';
import assert from 'node:assert/strict';

import { capitalFloorStreak, cityPairsServed, evaluateScenario, formatGoalValue, goalValue, meetsTarget, monthsLeft, scenarioBriefing, scenarioGoals, type ScenarioContext } from './scenarioEval';
import { SCENARIOS, scenarioById, type Scenario } from '../data/scenarios';
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
  capitalHistory: [20_000_000],
  ...over
});

test('a scenario is won at the first close that meets every goal, long before the deadline', () => {
  const running = evaluateScenario(jetAge, ctx({ capital: 99_999_999 }));
  assert.equal(running.status, 'running');
  assert.equal(running.reason, undefined);
  assert.ok(Math.abs(running.goals[0].progress - 0.99999999) < 1e-6);

  const won = evaluateScenario(jetAge, ctx({ offset: 30, capital: 100_000_000, capitalHistory: [100_000_000] }));
  assert.equal(won.status, 'won');
  assert.match(won.reason!, /29 months before the deadline/);
  assert.equal(won.goals[0].done, true);
  assert.equal(won.goals[0].progress, 1);
});

test('the deadline close decides: met is won, missed is lost', () => {
  const at = jetAge.deadlineOffset;
  assert.equal(evaluateScenario(jetAge, ctx({ offset: at - 1, capital: 40_000_000 })).status, 'running', 'one month left');
  assert.equal(evaluateScenario(jetAge, ctx({ offset: at, capital: 100_000_000 })).status, 'won');
  const lost = evaluateScenario(jetAge, ctx({ offset: at, capital: 40_000_000 }));
  assert.equal(lost.status, 'lost');
  assert.match(lost.reason!, /Capital of \$100M \(\$40,000,000 of \$100,000,000\)/);
  assert.equal(evaluateScenario(jetAge, ctx({ offset: at + 3, capital: 1 })).status, 'lost', 'a close after the deadline cannot run on');
});

test('a goal counted at the deadline cannot win early', () => {
  const early = evaluateScenario(oilShock, ctx({ offset: oilShock.startOffset + 2, reputation: 80 }));
  assert.equal(early.status, 'running');
  assert.equal(early.goals[0].done, true, 'the goal shows as met for now');
  assert.equal(early.goals[0].atDeadline, true);
  assert.equal(evaluateScenario(oilShock, ctx({ offset: oilShock.deadlineOffset, reputation: 60 })).status, 'won');
  assert.equal(evaluateScenario(oilShock, ctx({ offset: oilShock.deadlineOffset, reputation: 59.9 })).status, 'lost');
});

test('bankruptcy needs three month-ends in a row below the floor, and beats a win in the same close', () => {
  const below = -6_000_000;
  assert.equal(capitalFloorStreak([below, 1, below, below], -5_000_000), 2);
  assert.equal(capitalFloorStreak([], 0), 0);

  const twoMonths = evaluateScenario(jetAge, ctx({ capital: below, capitalHistory: [1e6, below, below] }));
  assert.equal(twoMonths.status, 'running');
  const floor = twoMonths.goals.find(g => g.kind === 'lose')!;
  assert.equal(floor.streak, 2);
  assert.ok(Math.abs(floor.progress - 2 / 3) < 1e-9);
  assert.equal(floor.done, false);

  const recovered = evaluateScenario(jetAge, ctx({ capitalHistory: [below, below, 0] }));
  assert.equal(recovered.status, 'running', 'a month back above the floor resets the count');

  const bankrupt = evaluateScenario(jetAge, ctx({ capital: below, capitalHistory: [below, below, below] }));
  assert.equal(bankrupt.status, 'lost');
  assert.match(bankrupt.reason!, /3 month-ends in a row/);

  // A made-up scenario whose win is met in the very close it goes bankrupt.
  const both: Scenario = { ...jetAge, win: [{ id: 'r', kind: 'target', metric: 'reputation', target: 10, label: 'Any reputation' }] };
  assert.equal(evaluateScenario(both, ctx({ capitalHistory: [below, below, below] })).status, 'lost');
});

test('the oil shock allows not a single month-end below zero', () => {
  const lost = evaluateScenario(oilShock, ctx({ offset: oilShock.startOffset, capital: -1, capitalHistory: [-1] }));
  assert.equal(lost.status, 'lost');
  assert.match(lost.reason!, /fell below \$0/);
  assert.equal(evaluateScenario(oilShock, ctx({ offset: oilShock.startOffset, capital: 0, capitalHistory: [0] })).status, 'running');
});

/** A route from New York to destination number `i`, flown `weeklyFlights` times a week by one aircraft. */
const fromJfk = (i: number, weeklyFlights: number) => ({ origin: 'JFK', destination: `D${String(i).padStart(2, '0')}`, weeklyFlights });

test('only daily city pairs count towards deregulation, and the month must be in profit', () => {
  const routes = [...Array.from({ length: 29 }, (_, i) => fromJfk(i, 7)), fromJfk(29, 3)];
  const goal = deregulation.win[0];
  assert.equal(goalValue(goal, ctx({ routes })), 29);
  assert.equal(evaluateScenario(deregulation, ctx({ offset: deregulation.startOffset + 5, routes, monthlyProfit: 1 })).status, 'running');

  const thirty = [...routes, fromJfk(30, 14)];
  const loss = evaluateScenario(deregulation, ctx({ offset: deregulation.startOffset + 5, routes: thirty, monthlyProfit: -1 }));
  assert.equal(loss.status, 'running', 'thirty pairs flown at a loss are not enough');
  assert.equal(loss.goals[1].progress, 0);
  assert.equal(evaluateScenario(deregulation, ctx({ offset: deregulation.startOffset + 5, routes: thirty, monthlyProfit: 1 })).status, 'won');
});

test('a city pair counts once, with every aircraft flying it added up', () => {
  const goal = deregulation.win[0];
  // Daily JFK-LHR needs two 707s, one flying it four times a week and one three times.
  const twoAircraft = [
    { origin: 'JFK', destination: 'LHR', weeklyFlights: 4 },
    { origin: 'JFK', destination: 'LHR', weeklyFlights: 3 }
  ];
  assert.equal(goalValue(goal, ctx({ routes: twoAircraft })), 1, 'four and three a week make a daily service');
  assert.equal(cityPairsServed([{ origin: 'LHR', destination: 'JFK', weeklyFlights: 4 }, { origin: 'JFK', destination: 'LHR', weeklyFlights: 3 }], 7), 1,
    'either direction is the same pair');

  // Thirty daily aircraft on the one pair are one daily pair, not thirty.
  const onePair = Array.from({ length: 30 }, () => ({ origin: 'JFK', destination: 'LHR', weeklyFlights: 7 }));
  assert.equal(goalValue(goal, ctx({ routes: onePair })), 1);
  assert.equal(evaluateScenario(deregulation, ctx({ offset: deregulation.startOffset + 5, routes: onePair, monthlyProfit: 1 })).status, 'running');

  // Thirty pairs, each shared by two aircraft that are only daily together: won.
  const shared = Array.from({ length: 30 }, (_, i) => [fromJfk(i, 4), fromJfk(i, 3)]).flat();
  assert.equal(goalValue(goal, ctx({ routes: shared })), 30);
  assert.equal(evaluateScenario(deregulation, ctx({ offset: deregulation.startOffset + 5, routes: shared, monthlyProfit: 1 })).status, 'won');
  assert.equal(cityPairsServed(shared), 30, 'without a minimum every pair flown counts');
  assert.equal(deregulation.win[0].label, '30 city pairs with daily service');
});

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
