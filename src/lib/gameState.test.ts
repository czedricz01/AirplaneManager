import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPlayerModifiers,
  reputationDemandFactor,
  eventReliefFactor,
  normalizeGameSettings,
  DEFAULT_GAME_SETTINGS,
  createGameSystems,
  ensureFreeOption,
  FREE_OPTION_ID,
  type GameDecision
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

test('a decision always has an answer that costs nothing', () => {
  const base: GameDecision = { id: 'd', kind: 'strike', title: 'Strike', description: '', options: [] };
  const paid = { ...base, options: [{ id: 'raise', label: 'Pay more', detail: '', cost: 2_000_000 }] };
  const fixed = ensureFreeOption(paid);
  assert.deepEqual(fixed.options.map(o => o.id), ['raise', FREE_OPTION_ID]);
  assert.equal(fixed.options[1].cost, 0);
  assert.equal(paid.options.length, 1, 'the input is not modified');

  // One free answer is enough; nothing is added then.
  const withFree = { ...base, options: [...paid.options, { id: 'wait', label: 'Sit it out', detail: '', cost: 0 }] };
  assert.equal(ensureFreeOption(withFree), withFree);

  // The added option's id never collides with one already there.
  const clash = { ...base, options: [{ id: FREE_OPTION_ID, label: 'Costly', detail: '', cost: 10 }] };
  const ids = ensureFreeOption(clash).options.map(o => o.id);
  assert.equal(new Set(ids).size, 2);
  assert.ok(ids[1].startsWith(FREE_OPTION_ID));
});

import { researchEffects } from './research';
import { rollDisruptions } from './disruptions';

test('finished projects change the player modifiers, and nothing finished leaves them as before', () => {
  const base = buildPlayerModifiers({ reputation: 60, eventChoices: {} }, 100);
  const same = buildPlayerModifiers({ reputation: 60, eventChoices: {}, research: researchEffects([]) }, 100);
  assert.deepEqual(same, base);
  const done = buildPlayerModifiers({ reputation: 60, eventChoices: {}, research: researchEffects(['yield-1', 'yield-2', 'cabin', 'alliance']) }, 100);
  assert.ok(Math.abs(done.demandFactor - base.demandFactor * 1.04) < 1e-12);
  assert.equal(done.satDelta, 2);
  assert.equal(done.transferBoost, 0.1);
});

test('the planning suite lifts where a new route\'s demand starts', () => {
  const routes = [{ id: 'new', openedOffset: 100 }];
  const slow = buildPlayerModifiers({ reputation: 50, eventChoices: {}, routes }, 100);
  const fast = buildPlayerModifiers({ reputation: 50, eventChoices: {}, routes, research: researchEffects(['planning']) }, 100);
  assert.equal(slow.maturity!.new, 0.6);
  assert.equal(fast.maturity!.new, 0.75);
});

test('predictive maintenance makes technical defects rarer', () => {
  const plane = { registration: 'D-OLD', conditionGeneral: 10, purchasedAt: 0 };
  const routes = Array.from({ length: 200 }, (_, i) => ({ id: `r${i}`, origin: 'FRA', destination: 'CDG', aircraft: 'D-OLD', schedule: [{}] }));
  const airportsMap = new Map<string, { coords: [number, number] }>([['FRA', { coords: [50, 8] }], ['CDG', { coords: [49, 2] }]]);
  const count = (factor: number) => {
    let n = 0;
    let state = 12345;
    const rng = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    for (let m = 0; m < 30; m++) {
      n += rollDisruptions(routes as any, [plane] as any, {}, 400 + m, rng, airportsMap, factor).filter(d => d.kind === 'technical').length;
    }
    return n;
  };
  assert.ok(count(0.7) < count(1), `${count(0.7)} vs ${count(1)}`);
});
