import test from 'node:test';
import assert from 'node:assert/strict';

import { HALL_SIZE, SCENARIO_ORDER, bestStars, fileCareer, hallOf, hallPosition, normalizeHalls, normalizeStars, scenarioUnlocked, starsFor, type HallOfFameEntry, type HallsOfFame } from './careerScore';
import { SCENARIOS } from '../data/scenarios';

const entry = (id: string, score: number, filed = '2026-01-01'): HallOfFameEntry =>
  ({ id, airline: id, code: 'XX', score, rank: 1, years: 10, netWorth: 1, filed });

const EMPTY: HallsOfFame = { normal: [], free: [] };

test('the hall of fame keeps the ten best, best first, and a career only once', () => {
  let halls = EMPTY;
  for (let i = 0; i < 14; i++) halls = fileCareer(halls, entry(`a${i}`, i * 10));
  assert.equal(halls.normal.length, HALL_SIZE);
  assert.deepEqual(halls.normal.slice(0, 2).map(e => e.id), ['a13', 'a12']);
  halls = fileCareer(halls, entry('a13', 500));
  assert.equal(halls.normal.filter(e => e.id === 'a13').length, 1);
  assert.equal(halls.normal[0].score, 500);
  assert.equal(hallPosition(halls, entry('new', 1)), null, 'too low to make it');
  assert.equal(hallPosition(halls, entry('new', 10_000)), 1);
});

test('5.2b (E43): Normal and Free Mode have a hall each', () => {
  let halls = EMPTY;
  halls = fileCareer(halls, { ...entry('n', 100), mode: 'normal' });
  halls = fileCareer(halls, { ...entry('f', 900), mode: 'free' });
  assert.deepEqual(hallOf(halls, 'normal').map(e => e.id), ['n']);
  assert.deepEqual(hallOf(halls, 'free').map(e => e.id), ['f'], 'a Free Mode score never pushes a Normal one out');
  assert.equal(hallPosition(halls, { ...entry('n2', 50), mode: 'normal' }), 2);
  assert.equal(hallPosition(halls, { ...entry('f2', 50), mode: 'free' }), 2);
});

test('a damaged hall is repaired, and the one list stored before 5.2b is split by mode', () => {
  const halls = normalizeHalls([entry('a', 5), null, { id: 'x' }, { ...entry('b', 9), mode: 'free' }, 'junk']);
  assert.deepEqual(halls.normal.map(e => e.id), ['a']);
  assert.deepEqual(halls.free.map(e => e.id), ['b']);
  assert.deepEqual(normalizeHalls('nope'), EMPTY);
  assert.deepEqual(normalizeHalls({ normal: [entry('c', 3)], free: 'junk' }).normal.map(e => e.id), ['c']);
  assert.deepEqual(normalizeHalls(JSON.parse(JSON.stringify(halls))), halls, 'what is stored loads again');
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

test('a Free Mode career is filed with its mode; older entries count as Normal Mode', () => {
  const halls = normalizeHalls([
    { ...entry('a', 500), mode: 'free' },
    entry('b', 400),
    { ...entry('c', 300), mode: 'junk' }
  ]);
  assert.deepEqual(halls.free.map(e => e.mode), ['free']);
  assert.deepEqual(halls.normal.map(e => e.mode), ['normal', 'normal']);
});
