import test from 'node:test';
import assert from 'node:assert/strict';

import { extentOf, nearestIndex, niceStep, niceTicks, scaleLinear, segmentsOf, timeTicks } from './chartMath';

test('steps are 1, 2 or 5 times a power of ten', () => {
  assert.equal(niceStep(100, 5), 20);
  assert.equal(niceStep(7, 5), 2);
  assert.equal(niceStep(15.7e6, 5), 5e6);
  assert.equal(niceStep(0.3, 3), 0.1);
  assert.equal(niceStep(0, 5), 1, 'no span, no crash');
});

test('ticks are round, cover the data and straddle zero cleanly', () => {
  assert.deepEqual(niceTicks(-3.2e6, 12.5e6, 5).ticks, [-5e6, 0, 5e6, 10e6, 15e6]);
  assert.deepEqual(niceTicks(0, 100, 5).ticks, [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(niceTicks(0.1, 0.7, 3).ticks, [0, 0.2, 0.4, 0.6, 0.8], 'no floating-point noise');
  const flat = niceTicks(42, 42, 5);
  assert.ok(flat.min < 42 && flat.max > 42, 'a flat series still gets an axis');
  assert.deepEqual(niceTicks(0, 0, 5).ticks, [-1, -0.5, 0, 0.5, 1]);
  assert.deepEqual(niceTicks(10, 0, 5).ticks, [0, 2, 4, 6, 8, 10], 'reversed input');
  assert.deepEqual(niceTicks(Number.NaN, 5).ticks, [0, 1]);
});

test('extent, scale and gaps', () => {
  assert.deepEqual(extentOf([[3, null, -2], [undefined, 8, Number.NaN]]), [-2, 8]);
  assert.equal(extentOf([[null, undefined], []]), null);

  const y = scaleLinear(0, 10, 100, 0);
  assert.equal(y(5), 50);
  assert.equal(y(10), 0);
  assert.equal(scaleLinear(4, 4, 0, 60)(4), 30, 'zero-width domain sits in the middle');

  assert.deepEqual(segmentsOf([1, null, 2, 3, undefined, Number.NaN, 4]), [[0], [2, 3], [6]]);
  assert.deepEqual(segmentsOf([null, null]), []);
});

test('the pointer snaps to the nearest month', () => {
  assert.equal(nearestIndex(40, 40, 400, 5), 0);
  assert.equal(nearestIndex(145, 40, 400, 5), 1, '105 px in: nearer the second point at 100 than the third at 200');
  assert.equal(nearestIndex(900, 40, 400, 5), 4, 'clamped');
  assert.equal(nearestIndex(100, 40, 400, 1), 0);
});

test('calendar ticks land on round months, or on Januaries for long ranges', () => {
  const year = Array.from({ length: 12 }, (_, i) => 62 + i); // 03/1965 to 02/1966
  assert.deepEqual(timeTicks(year, 6).map(t => t.label), ['03/1965', '05/1965', '07/1965', '09/1965', '11/1965', '01/1966']);

  const decade = Array.from({ length: 120 }, (_, i) => i);
  const ticks = timeTicks(decade, 8);
  assert.deepEqual(ticks.map(t => t.label), ['1960', '1962', '1964', '1966', '1968']);
  assert.deepEqual(ticks.map(t => t.index), [0, 24, 48, 72, 96]);

  assert.deepEqual(timeTicks([63], 6), [{ index: 0, label: '04/1965' }]);
  assert.deepEqual(timeTicks([], 6), []);
});
