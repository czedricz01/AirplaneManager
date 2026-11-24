import test from 'node:test';
import assert from 'node:assert/strict';

import { campaignBlocker, createCampaign, isCampaignActive, routesByRegion, startFfp, stopFfp } from './marketing';
import { DEFAULT_MARKETING, type Marketing } from './gameState';
import { loadSave, SAVE_VERSION } from './saveLoad';
import { airportsMapAdjusted } from '../data/airportRegistry';

const marketingWith = (...campaigns: Marketing['campaigns']): Marketing => ({ ...DEFAULT_MARKETING, campaigns });

test('the frequent-flyer programme starts once and starts over after a stop', () => {
  const on = startFfp(DEFAULT_MARKETING, 3);
  assert.equal(on.ffpActive, true);
  assert.equal(on.ffpSinceOffset, 3);
  assert.equal(startFfp(on, 9), on, 'already running');
  const off = stopFfp(on);
  assert.equal(off.ffpActive, false);
  assert.equal(off.ffpSinceOffset, null);
  assert.equal(startFfp(off, 9).ffpSinceOffset, 9);
});

test('one campaign per region, one worldwide', () => {
  const m = marketingWith(createCampaign('local', 'EU', 6, 10, 'a'), createCampaign('global', 'NA', 6, 10, 'g'));
  assert.match(campaignBlocker(m, 'national', 'EU', 12)!, /Europe/);
  assert.equal(campaignBlocker(m, 'national', 'AS', 12), null);
  assert.match(campaignBlocker(m, 'global', 'AS', 12)!, /global/);
  assert.equal(campaignBlocker(m, 'national', 'EU', 16), null, 'free again once it has run out');
});

test('campaign routes are counted per region they touch', () => {
  const counts = routesByRegion(
    [{ origin: 'FRA', destination: 'CDG' }, { origin: 'FRA', destination: 'JFK' }, { origin: 'XXX', destination: 'SYD' }],
    airportsMapAdjusted
  );
  assert.deepEqual(counts, { EU: 2, NA: 1, SA: 0, AF: 0, AS: 0, OC: 1 });
});

test('saved marketing is repaired: bad lengths clamped, finished campaigns and duplicates dropped', () => {
  const migrated = loadSave({
    saveVersion: SAVE_VERSION,
    currentDateOffset: 50,
    marketing: {
      campaigns: [
        { id: 'a', tier: 'national', region: 'EU', startOffset: 48, duration: 6 },
        { id: 'a', tier: 'local', region: 'AS', startOffset: 49, duration: 6 },
        { id: 'old', tier: 'local', region: 'EU', startOffset: 10, duration: 3 },
        { id: 'long', tier: 'global', region: 'NA', startOffset: 50, duration: 1e9 },
        { id: 'zero', tier: 'local', region: 'SA', startOffset: 50, duration: 0 },
        { id: 'bad', tier: 'mega', region: 'EU', startOffset: 50, duration: 3 }
      ],
      ffpActive: true,
      ffpSinceOffset: 90
    }
  }).marketing;
  assert.deepEqual(migrated.campaigns.map((c: any) => c.id), ['a', 'long']);
  assert.equal(migrated.campaigns[0].tier, 'national', 'the first of two with one id is kept');
  assert.equal(migrated.campaigns[1].duration, 120);
  assert.equal(migrated.ffpSinceOffset, 50, 'a start in the future counts from now');
});

test('a campaign dated in the future starts on load, and only running campaigns block a region', () => {
  // The marketing screen lists running campaigns only. One scheduled for
  // later blocked its region with nothing on screen to cancel.
  const migrated = loadSave({
    saveVersion: SAVE_VERSION,
    currentDateOffset: 50,
    marketing: { campaigns: [{ id: 'future', tier: 'national', region: 'EU', startOffset: 70, duration: 6 }], ffpActive: false }
  }).marketing;
  assert.equal(migrated.campaigns[0].startOffset, 50);
  assert.equal(isCampaignActive(migrated.campaigns[0], 50), true, 'running, so shown with its cancel button');
  assert.ok(campaignBlocker(migrated, 'local', 'EU', 50), 'and it blocks a second one, visibly');

  const scheduled = marketingWith(createCampaign('national', 'EU', 6, 70, 'later'));
  assert.equal(campaignBlocker(scheduled, 'local', 'EU', 50), null, 'nothing running in Europe now');
});
