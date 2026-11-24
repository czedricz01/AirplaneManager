import test from 'node:test';
import assert from 'node:assert/strict';

import { activeEvents, eventRegionLabel, eventScope, historicalEvents } from './eventSystem';
import { HISTORICAL_EVENTS, RANDOM_EVENT_TEMPLATES } from '../model/constants';

test('regional events carry their regions and leave fuel alone', () => {
  const regional = historicalEvents.filter(e => e.regions && e.regions.length > 0);
  assert.ok(regional.length >= 8);
  for (const e of regional) {
    assert.equal(e.fuelMultiplier, 1, e.title);
    assert.ok(e.duration >= 1 && e.demandMultiplier > 0, e.title);
  }
  // Both kinds of weather are there: crises and booms.
  assert.ok(regional.some(e => e.demandMultiplier < 1) && regional.some(e => e.demandMultiplier > 1));
});

test('regions read as words', () => {
  assert.equal(eventRegionLabel({ regions: ['EU'] }), 'Europe');
  assert.equal(eventRegionLabel({ regions: ['AS', 'OC'] }), 'Asia and Oceania');
  assert.equal(eventScope({ regions: ['AF'] }), ' in Africa');
  assert.equal(eventScope({}), '');
  assert.equal(eventRegionLabel({ regions: ['EU', 'AS', 'OC'] }), 'Europe, Asia and Oceania');
});

test('5.2b: the events are the model\'s, with the answers\' wording and no placeholder price', () => {
  assert.equal(historicalEvents.length, HISTORICAL_EVENTS.length);
  for (const [i, def] of HISTORICAL_EVENTS.entries()) {
    const ev = historicalEvents[i];
    assert.equal(ev.title, def.title);
    assert.equal(ev.startOffset, def.startMonth);
    assert.equal(ev.duration, def.months);
    assert.equal(ev.demandMultiplier, def.demandMultiplier);
    assert.equal(ev.description, def.description);
    assert.equal(!!ev.choices, !!def.response, `${def.title}: answers only where the model has a response`);
    for (const c of ev.choices ?? []) assert.equal(c.cost, 0, 'priced by the model, not here');
    const recovery = ev.choices?.find(c => c.softensDemand);
    if (def.response?.kind === 'demandRecovery') assert.equal(recovery?.softensDemand, def.response.recoveryShare);
    if (def.response?.kind === 'fuelHedge') assert.ok(ev.choices?.some(c => c.hedgesFuel));
  }
  // The fuel figure of the texts is the peak of the model's fuel table.
  assert.equal(historicalEvents.find(e => e.title === '1973 Oil Crisis')!.fuelMultiplier, 2);
  assert.equal(historicalEvents.find(e => e.title === 'Aviation Downturn')!.fuelMultiplier, 1);
});

test('5.2b: running events come from the model, rolled ones from the world state', () => {
  const oct1973 = (1973 - 1960) * 12 + 9;
  assert.deepEqual(activeEvents(oct1973).map(e => e.title), ['1973 Oil Crisis']);
  assert.deepEqual(activeEvents(oct1973 - 1), []);
  const rolled = { title: 'Economic Slump', startMonth: 5, months: 3, demandMultiplier: 0.87 };
  const [ev] = activeEvents(6, [rolled]);
  assert.equal(ev.title, 'Economic Slump');
  assert.equal(ev.description, RANDOM_EVENT_TEMPLATES.find(t => t.title === 'Economic Slump')!.description);
  assert.equal(ev.choices, undefined);
  assert.deepEqual(activeEvents(8, [rolled]), [], 'over after its three months');
});
