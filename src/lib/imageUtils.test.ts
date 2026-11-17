import test from 'node:test';
import assert from 'node:assert/strict';

import { aircraftImageStem, clearAircraftImageCandidateCache, clearFailedImageUrls, getAircraftImageCandidates, markImageUrlFailed } from './imageUtils';

test('a cached candidate list keeps its identity while nothing has failed', () => {
  clearAircraftImageCandidateCache();
  clearFailedImageUrls();
  const first = getAircraftImageCandidates('Douglas DC-8-10', 'Douglas', 'DC-8-10');
  assert.ok(first.length > 0);
  assert.equal(getAircraftImageCandidates('Douglas DC-8-10', 'Douglas', 'DC-8-10'), first);
});

test('URLs that failed after caching are left out for cards that mount later', () => {
  clearAircraftImageCandidateCache();
  clearFailedImageUrls();
  const first = getAircraftImageCandidates('Douglas DC-8-10', 'Douglas', 'DC-8-10');
  markImageUrlFailed(first[0]);
  markImageUrlFailed(first[1]);
  const later = getAircraftImageCandidates('Douglas DC-8-10', 'Douglas', 'DC-8-10');
  assert.deepEqual(later, first.slice(2));
});

test('once every guess has failed, a later card gets no URLs to request', () => {
  clearAircraftImageCandidateCache();
  clearFailedImageUrls();
  const first = getAircraftImageCandidates('Douglas DC-8-10', 'Douglas', 'DC-8-10');
  first.forEach(markImageUrlFailed);
  assert.deepEqual(getAircraftImageCandidates('Douglas DC-8-10', 'Douglas', 'DC-8-10'), []);
});

test('a bundled picture comes before every remote guess', () => {
  clearAircraftImageCandidateCache();
  clearFailedImageUrls();
  const bundled = { airbus_a220_100: '/assets/airbus_a220_100-abc.webp' };
  const list = getAircraftImageCandidates('Airbus A220-100', 'Airbus', 'A220-100', undefined, undefined, bundled);
  assert.equal(list[0], bundled.airbus_a220_100);
});

test('aircraftImageStem matches the file names in src/assets/planes', () => {
  assert.equal(aircraftImageStem('Airbus A220-100'), 'airbus_a220_100');
  assert.equal(aircraftImageStem('Aerospatiale BAC Concorde'), 'aerospatiale_bac_concorde');
});
