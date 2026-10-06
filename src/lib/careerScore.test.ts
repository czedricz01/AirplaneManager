import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HALL_SIZE, RANK_POINTS, SCENARIO_ORDER, bestStars, careerScore, fileCareer, hallPosition, normalizeHall, normalizeStars,
  scenarioUnlocked, starsFor, type HallOfFameEntry
} from './careerScore';
import { SCENARIOS } from '../data/scenarios';

const input = (over = {}) => ({ netWorth: 100_000_000, rank: 2, milestones: 8, reputation: 70, takeovers: 1, projectsDone: 3, years: 20, ...over });

test('every part of a career adds to the score', () => {
  const base = careerScore(input());
  for (const [key, better] of [
    ['netWorth', 1_000_000_000], ['rank', 4], ['milestones', 20], ['reputation', 90], ['takeovers', 3], ['projectsDone', 8], ['years', 40]
  ] as const) {
    assert.ok(careerScore(input({ [key]: better })).total > base.total, key);
  }
  assert.equal(base.total, base.wealth + base.rank + base.milestones + base.reputation + base.takeovers + base.development + base.longevity);
});

test('wealth counts in orders of magnitude and nothing goes below zero', () => {
  assert.equal(careerScore(input({ netWorth: 1_000_000 })).wealth, 0);
  assert.equal(careerScore(input({ netWorth: 100_000_000 })).wealth, 200);
  assert.equal(careerScore(input({ netWorth: 100_000_000_000 })).wealth, 500);
  assert.equal(careerScore(input({ netWorth: -5 })).wealth, 0);
  assert.equal(careerScore(input({ years: 400 })).longevity, 300, 'longevity stops at sixty years');
});

const entry = (id: string, score: number, filed = '2026-01-01'): HallOfFameEntry =>
  ({ id, airline: id, code: 'XX', score, rank: 1, years: 10, netWorth: 1, filed });

test('the hall of fame keeps the ten best, best first, and a career only once', () => {
  let hall: HallOfFameEntry[] = [];
  for (let i = 0; i < 14; i++) hall = fileCareer(hall, entry(`a${i}`, i * 10));
  assert.equal(hall.length, HALL_SIZE);
  assert.deepEqual(hall.slice(0, 2).map(e => e.id), ['a13', 'a12']);
  hall = fileCareer(hall, entry('a13', 500));
  assert.equal(hall.filter(e => e.id === 'a13').length, 1);
  assert.equal(hall[0].score, 500);
  assert.equal(hallPosition(hall, entry('new', 1)), null, 'too low to make it');
  assert.equal(hallPosition(hall, entry('new', 10_000)), 1);
});

test('a damaged hall is repaired', () => {
  const hall = normalizeHall([entry('a', 5), null, { id: 'x' }, entry('b', 9), 'junk']);
  assert.deepEqual(hall.map(e => e.id), ['b', 'a']);
  assert.deepEqual(normalizeHall('nope'), []);
});

test('stars: none for a loss, one for a win, two within three quarters of the time, three within half', () => {
  assert.equal(starsFor(false, 1, 60), 0);
  assert.equal(starsFor(true, 59, 60), 1);
  assert.equal(starsFor(true, 45, 60), 2);
  assert.equal(starsFor(true, 30, 60), 3);
  assert.equal(starsFor(true, 10, 0), 1);
});

test('the scenarios open one after another, and the order names every scenario there is', () => {
  assert.deepEqual([...SCENARIO_ORDER].sort(), SCENARIOS.map(s => s.id).sort());
  assert.equal(scenarioUnlocked('jet-age', {}), true);
  assert.equal(scenarioUnlocked('oil-shock', {}), false);
  assert.equal(scenarioUnlocked('oil-shock', { 'jet-age': 1 }), true);
  assert.equal(scenarioUnlocked('deregulation', { 'jet-age': 3 }), false);
  assert.equal(scenarioUnlocked('hub-builder', { 'deregulation': 2 }), true);
  assert.equal(scenarioUnlocked('unknown', {}), true, 'not part of the chain');
});

test('only a better result replaces the stars held, and saved stars are cleaned', () => {
  const held = { 'jet-age': 2 };
  assert.equal(bestStars(held, 'jet-age', 1), held);
  assert.deepEqual(bestStars(held, 'jet-age', 3), { 'jet-age': 3 });
  assert.deepEqual(bestStars({}, 'oil-shock', 1), { 'oil-shock': 1 });
  assert.deepEqual(normalizeStars({ a: 2, b: 9, c: 0, d: 'x', e: -1 }), { a: 2, b: 3 });
  assert.deepEqual(normalizeStars(null), {});
});

test('a rank is worth points in Normal Mode and nothing in Free Mode', () => {
  assert.equal(careerScore(input({ rank: 4 })).rank, 4 * RANK_POINTS);
  assert.equal(careerScore(input({ rank: 9, free: true })).rank, 0, 'there is no rank to earn');
  assert.ok(careerScore(input({ rank: 9 })).rank <= 9 * RANK_POINTS);
});

test('a Free Mode career is filed with its mode; older entries count as Normal Mode', () => {
  const hall = normalizeHall([
    { ...entry('a', 500), mode: 'free' },
    entry('b', 400),
    { ...entry('c', 300), mode: 'junk' }
  ]);
  assert.deepEqual(hall.map(e => e.mode), ['free', 'normal', 'normal']);
});
