import test from 'node:test';
import assert from 'node:assert/strict';

import { findNonFinite, finiteOr } from './invariants';

test('findNonFinite names every NaN and Infinity by path', () => {
  const found = findNonFinite({
    ok: 1,
    profit: NaN,
    paxByClass: { economy: { actual: Infinity, max: 10 } },
    list: [1, -Infinity]
  });
  assert.deepEqual(found.sort(), ['list[1]', 'paxByClass.economy.actual', 'profit']);
});

test('findNonFinite ignores strings, nulls and cycles', () => {
  const a: any = { label: 'NaN', nothing: null };
  a.self = a;
  assert.deepEqual(findNonFinite(a), []);
});

test('findNonFinite reports a bare non-finite number as the root', () => {
  assert.deepEqual(findNonFinite(NaN), ['(root)']);
});

test('finiteOr falls back only for unusable numbers', () => {
  assert.equal(finiteOr(5, 0), 5);
  assert.equal(finiteOr('7', 0), 7);
  assert.equal(finiteOr(NaN, 3), 3);
  assert.equal(finiteOr(undefined, 3), 3);
  assert.equal(finiteOr(Infinity, 3), 3);
});
