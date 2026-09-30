import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NO_DESTINATION_FILTERS,
  activeDestinationFilterCount,
  passesDestinationFilters,
  type DestinationCandidate,
  type DestinationFilters
} from './destinationFilter';

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
