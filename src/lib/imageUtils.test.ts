import test from 'node:test';
import assert from 'node:assert/strict';

import { clearAircraftImageCandidateCache, clearFailedImageUrls, getAircraftImageCandidates, markImageUrlFailed } from './imageUtils';

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
