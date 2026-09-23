import test from 'node:test';
import assert from 'node:assert/strict';

import { readJson, readString, removeKey, writeJson, writeString } from './safeStorage';

/**
 * A fake Storage that can be made to fail the way real browsers do: blocked site
 * data throws on every access, and a full origin throws on setItem only.
 */
function installStorage(mode: 'ok' | 'quota' | 'blocked') {
  const data = new Map<string, string>();
  const store = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (mode === 'quota') throw new DOMExceptionLike('QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => { data.delete(k); },
    clear: () => data.clear(),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    get length() { return data.size; }
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      if (mode === 'blocked') throw new Error('access denied');
      return store;
    }
  });
  return data;
}

class DOMExceptionLike extends Error {}

test('round-trips a value', () => {
  installStorage('ok');
  assert.equal(writeJson('k', { a: 1 }), true);
  assert.deepEqual(readJson('k', null), { a: 1 });
  removeKey('k');
  assert.equal(readJson('k', 'gone'), 'gone');
});

test('a corrupt value falls back instead of throwing', () => {
  const data = installStorage('ok');
  writeString('k', '{not json');
  assert.deepEqual(readJson('k', []), []);
  assert.equal(data.get('k'), '{not json');
});

test('a stored null yields the fallback, not null', () => {
  installStorage('ok');
  writeJson('k', null);
  assert.equal(readJson('k', 7), 7);
});

test('a full origin reports failure rather than throwing', () => {
  installStorage('quota');
  assert.equal(writeJson('k', { a: 1 }), false);
  assert.equal(writeString('k', 'x'), false);
});

test('blocked site data is survivable in both directions', () => {
  installStorage('blocked');
  assert.equal(readString('k'), null);
  assert.deepEqual(readJson('k', 'fallback'), 'fallback');
  assert.equal(writeString('k', 'x'), false);
  assert.doesNotThrow(() => removeKey('k'));
});

test('a value that cannot be serialised does not throw', () => {
  installStorage('ok');
  const circular: any = {};
  circular.self = circular;
  assert.equal(writeJson('k', circular), false);
});
