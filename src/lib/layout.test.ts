import test from 'node:test';
import assert from 'node:assert/strict';

import { autoScaleFor, isPhoneLandscape, DESIGN_WIDTH, PHONE_MAX_WIDTH } from './layout';

test('upright phones are not scaled down', () => {
  assert.equal(autoScaleFor(390, 844), 1);
  assert.equal(autoScaleFor(PHONE_MAX_WIDTH - 1, 1024), 1);
});

test('phones held sideways are not scaled down', () => {
  assert.equal(autoScaleFor(844, 390), 1);
  assert.equal(autoScaleFor(932, 430), 1);
  assert.equal(autoScaleFor(667, 375), 1);
});

test('widths between the phone breakpoint and the design width scale to fit', () => {
  assert.equal(autoScaleFor(PHONE_MAX_WIDTH, 1024), PHONE_MAX_WIDTH / DESIGN_WIDTH);
  assert.equal(autoScaleFor(1024, 768), 0.8);
});

test('the design width and wider are shown at full size', () => {
  assert.equal(autoScaleFor(DESIGN_WIDTH, 800), 1);
  assert.equal(autoScaleFor(1920, 1080), 1);
});

test('only short, wide viewports count as a phone held sideways', () => {
  assert.equal(isPhoneLandscape(844, 390), true);
  assert.equal(isPhoneLandscape(1024, 768), false);
  assert.equal(isPhoneLandscape(390, 844), false);
  assert.equal(isPhoneLandscape(500, 500), false);
});
