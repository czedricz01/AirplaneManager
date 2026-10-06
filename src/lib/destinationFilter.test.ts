import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DESTINATION_FILTERS_KEY,
  NO_DESTINATION_FILTERS,
  activeDestinationFilterCount,
  loadDestinationFilters,
  passesDestinationFilters,
  sanitizeDestinationFilters,
  saveDestinationFilters,
  type DestinationCandidate,
  type DestinationFilters
} from './destinationFilter';

/**
 * A stand-in for the browser's localStorage. "blocked" throws on every access,
 * the way a browser with site data blocked does.
 */
function installStorage(mode: 'ok' | 'blocked' = 'ok') {
  const data = new Map<string, string>();
  const store = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); }
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

const airport = (over: Partial<DestinationCandidate> = {}): DestinationCandidate => ({
  distanceKm: 1000,
  business: 50,
  tourism: 80,
  served: false,
  ...over
});

const withFilters = (over: Partial<DestinationFilters>): DestinationFilters => ({
  ...NO_DESTINATION_FILTERS,
  ...over
});

test('without filters every airport passes', () => {
  assert.equal(passesDestinationFilters(NO_DESTINATION_FILTERS, airport()), true);
  assert.equal(passesDestinationFilters(NO_DESTINATION_FILTERS, airport({ served: true, distanceKm: null })), true);
});

test('"not yet served" hides airports the player already flies to', () => {
  const filters = withFilters({ unservedOnly: true });
  assert.equal(passesDestinationFilters(filters, airport({ served: true })), false);
  assert.equal(passesDestinationFilters(filters, airport({ served: false })), true);
});

test('"rank reachable only" hides airports the rank does not allow yet', () => {
  const filters = withFilters({ reachableOnly: true });
  assert.equal(passesDestinationFilters(filters, airport({ rankLocked: true })), false);
  assert.equal(passesDestinationFilters(filters, airport({ rankLocked: false })), true);
  assert.equal(passesDestinationFilters(filters, airport()), true);
  // Switched off, locked airports stay in the list.
  assert.equal(passesDestinationFilters(NO_DESTINATION_FILTERS, airport({ rankLocked: true })), true);
  assert.equal(activeDestinationFilterCount(filters, false), 1);
});

test('distance bounds are inclusive and each one is optional', () => {
  const band = withFilters({ distance: { min: '500', max: '1500' } });
  assert.equal(passesDestinationFilters(band, airport({ distanceKm: 500 })), true);
  assert.equal(passesDestinationFilters(band, airport({ distanceKm: 1500 })), true);
  assert.equal(passesDestinationFilters(band, airport({ distanceKm: 499 })), false);
  assert.equal(passesDestinationFilters(band, airport({ distanceKm: 1501 })), false);

  const onlyMin = withFilters({ distance: { min: '2000', max: '' } });
  assert.equal(passesDestinationFilters(onlyMin, airport({ distanceKm: 9000 })), true);
  assert.equal(passesDestinationFilters(onlyMin, airport({ distanceKm: 1999 })), false);

  const onlyMax = withFilters({ distance: { min: '', max: '800' } });
  assert.equal(passesDestinationFilters(onlyMax, airport({ distanceKm: 0 })), true);
  assert.equal(passesDestinationFilters(onlyMax, airport({ distanceKm: 801 })), false);
});

test('the distance filter is ignored while there is no origin to measure from', () => {
  const filters = withFilters({ distance: { min: '500', max: '1500' } });
  assert.equal(passesDestinationFilters(filters, airport({ distanceKm: null })), true);
});

test('business and tourism are filtered independently', () => {
  const filters = withFilters({ business: { min: '40', max: '' }, tourism: { min: '', max: '100' } });
  assert.equal(passesDestinationFilters(filters, airport({ business: 40, tourism: 100 })), true);
  assert.equal(passesDestinationFilters(filters, airport({ business: 39, tourism: 10 })), false);
  assert.equal(passesDestinationFilters(filters, airport({ business: 90, tourism: 101 })), false);
});

test('all filters have to match together', () => {
  const filters = withFilters({
    unservedOnly: true,
    distance: { min: '500', max: '' },
    business: { min: '10', max: '' }
  });
  assert.equal(passesDestinationFilters(filters, airport()), true);
  assert.equal(passesDestinationFilters(filters, airport({ served: true })), false);
  assert.equal(passesDestinationFilters(filters, airport({ distanceKm: 100 })), false);
  assert.equal(passesDestinationFilters(filters, airport({ business: 5 })), false);
});

test('empty, blank or invalid bounds count as no limit', () => {
  const filters = withFilters({
    distance: { min: '  ', max: 'abc' },
    business: { min: '', max: '' },
    tourism: { min: '-', max: 'Infinity' }
  });
  assert.equal(passesDestinationFilters(filters, airport({ distanceKm: 99999, business: 0, tourism: 99999 })), true);
  assert.equal(activeDestinationFilterCount(filters, true), 0);
});

test('the filter count follows what actually narrows the list', () => {
  assert.equal(activeDestinationFilterCount(NO_DESTINATION_FILTERS, true), 0);

  const filters = withFilters({
    unservedOnly: true,
    distance: { min: '500', max: '' },
    tourism: { min: '', max: '90' }
  });
  assert.equal(activeDestinationFilterCount(filters, true), 3);
  // No origin: the distance filter does nothing, so it is not counted.
  assert.equal(activeDestinationFilterCount(filters, false), 2);
});

test('with nothing stored the planner starts without filters', () => {
  installStorage();
  assert.deepEqual(loadDestinationFilters(), NO_DESTINATION_FILTERS);
});

test('saved filters come back as they were set, text bounds included', () => {
  installStorage();
  const filters = withFilters({
    unservedOnly: true,
    distance: { min: '500', max: '' },
    business: { min: '', max: '80' },
    tourism: { min: '1', max: '9.5' }
  });
  saveDestinationFilters(filters);
  assert.deepEqual(loadDestinationFilters(), filters);
});

test('resetting the filters is saved too, so they do not come back', () => {
  installStorage();
  saveDestinationFilters(withFilters({ unservedOnly: true, distance: { min: '500', max: '1500' } }));
  saveDestinationFilters(NO_DESTINATION_FILTERS);
  assert.deepEqual(loadDestinationFilters(), NO_DESTINATION_FILTERS);
});

test('the filters live under their own key', () => {
  const data = installStorage();
  saveDestinationFilters(withFilters({ unservedOnly: true }));
  assert.deepEqual([...data.keys()], [DESTINATION_FILTERS_KEY]);
});

test('an unreadable stored value means no filters instead of an error', () => {
  const data = installStorage();
  data.set(DESTINATION_FILTERS_KEY, '{not json');
  assert.deepEqual(loadDestinationFilters(), NO_DESTINATION_FILTERS);
});

test('stored values of the wrong shape are discarded field by field', () => {
  for (const raw of [null, undefined, 42, 'text', true, [], [1, 2]]) {
    assert.deepEqual(sanitizeDestinationFilters(raw), NO_DESTINATION_FILTERS, JSON.stringify(raw));
  }

  const mixed = sanitizeDestinationFilters({
    unservedOnly: 'yes',
    reachableOnly: 1,
    distance: 5,
    business: { min: 3, max: '80' },
    tourism: { min: '10', max: null },
    extra: 'ignored'
  });
  assert.deepEqual(mixed, {
    unservedOnly: false,
    reachableOnly: false,
    distance: { min: '', max: '' },
    business: { min: '', max: '80' },
    tourism: { min: '10', max: '' }
  });
});

test('blocked site data neither loads nor throws', () => {
  installStorage('blocked');
  assert.deepEqual(loadDestinationFilters(), NO_DESTINATION_FILTERS);
  assert.doesNotThrow(() => saveDestinationFilters(withFilters({ unservedOnly: true })));
});
