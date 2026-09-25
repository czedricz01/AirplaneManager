import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPlayerModifiers,
  reputationDemandFactor,
  eventReliefFactor,
  normalizeGameSettings,
  DEFAULT_GAME_SETTINGS,
  createGameSystems
} from './gameState';
import { continentOf, regionOf } from './geoUtils';
import { assignRivalColors, colorDistance, MAP_YELLOW, RIVAL_PALETTE } from './theme';
import { airports } from '../data/airportRegistry';
import { historicalEvents, eventKey } from './eventSystem';

test('the player modifiers carry the demand factor the game has always used', () => {
  const oilCrisis = historicalEvents.find(ev => ev.choices?.some(c => c.softensDemand))!;
  const choice = oilCrisis.choices!.find(c => c.softensDemand)!;
  const eventChoices = { [eventKey(oilCrisis)]: choice.id };
  const offset = oilCrisis.startOffset + 1;

  const mods = buildPlayerModifiers({ reputation: 72, eventChoices }, offset);
  assert.equal(mods.demandFactor, reputationDemandFactor(72) * eventReliefFactor(offset, eventChoices));
  assert.ok(eventReliefFactor(offset, eventChoices) > 1, 'the relief bought is in there');
});

test('every airport has a region, and the milestone continents are unchanged', () => {
  const valid = new Set(['EU', 'NA', 'SA', 'AF', 'AS', 'OC']);
  for (const a of airports) {
    const region = regionOf(a.coords);
    assert.ok(valid.has(region), `${a.id}: ${region}`);
    const continent = continentOf(a.coords);
    if (continent !== 'OT') assert.equal(region, continent, `${a.id} keeps its continent`);
  }
  assert.equal(regionOf([-17.55, -149.61]), 'OC', 'Papeete');
  assert.equal(regionOf([37.74, -25.70]), 'EU', 'Ponta Delgada');
  assert.equal(regionOf([16.73, -22.95]), 'AF', 'Sal');
  assert.equal(continentOf([37.74, -25.70]), 'OT', 'the milestone still counts the Azores as it did');
});

test('stored settings are repaired field by field', () => {
  assert.deepEqual(normalizeGameSettings(null), DEFAULT_GAME_SETTINGS);
  assert.deepEqual(normalizeGameSettings({ heatmap: true, newspaper: 'yes' }), { ...DEFAULT_GAME_SETTINGS, heatmap: true });
});

test('a fresh set of game systems shares nothing with the last one', () => {
  const a = createGameSystems();
  const b = createGameSystems();
  assert.notEqual(a.marketing.campaigns, b.marketing.campaigns);
  assert.notEqual(a.staff, b.staff);
  assert.equal(a.tutorialStep, null);
});

test('rival colours are distinct and keep clear of the player', () => {
  const rivals = ['LH', 'AF', 'BA', 'KL', 'IB', 'AZ'].map(code => ({ code }));
  const colors = assignRivalColors(rivals, MAP_YELLOW);
  assert.equal(new Set(colors).size, colors.length);
  for (const c of colors) assert.ok(colorDistance(c, MAP_YELLOW) >= 100, `${c} is too close to the player's yellow`);

  // A player in sky blue never sees a rival in sky blue.
  const sky = RIVAL_PALETTE[0];
  assert.ok(!assignRivalColors(rivals, sky).includes(sky));
});
