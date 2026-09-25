import test from 'node:test';
import assert from 'node:assert/strict';

import { SCENARIOS, scenarioById } from './scenarios';
import { aircraftList } from './aircraft';
import { airportsMapAdjusted } from './airportRegistry';
import { getAirportStats } from './airports';

test('every scenario is playable as written', () => {
  const ids = new Set<string>();
  for (const s of SCENARIOS) {
    assert.ok(!ids.has(s.id), `${s.id} is unique`);
    ids.add(s.id);
    assert.equal(scenarioById(s.id), s);

    const hub = airportsMapAdjusted.get(s.hub);
    assert.ok(hub, `${s.id}: hub ${s.hub} exists`);
    const stats = getAirportStats(hub, 1960 + Math.floor(s.startOffset / 12));
    assert.ok(stats.business + stats.tourism > 0, `${s.id}: ${s.hub} has passengers in the start year`);

    assert.ok(s.deadlineOffset > s.startOffset, `${s.id}: the deadline is after the start`);
    assert.ok(s.startOffset >= 0 && s.deadlineOffset <= 731, `${s.id}: inside the calendar`);
    assert.ok(s.capital > 0, `${s.id}: starts with cash, there are no loans`);
    assert.ok(s.win.length > 0, `${s.id}: has something to win`);
    assert.ok(s.lose.length > 0, `${s.id}: has a way to lose`);
    assert.ok(s.rivals.count >= 0 && s.rivals.count <= 12);

    for (const entry of s.fleet) {
      const spec = aircraftList.find(a => a.id === entry.model);
      assert.ok(spec, `${s.id}: ${entry.model} is in the catalogue`);
      const joined = s.startOffset - (entry.ageMonths ?? 0);
      assert.ok(spec!.firstDeliveryOffset <= joined, `${s.id}: ${entry.model} was delivered by the month it joined (${joined})`);
      assert.ok(spec!.lastDeliveryOffset === null || spec!.lastDeliveryOffset >= joined, `${s.id}: ${entry.model} was still built then`);
      assert.ok(spec!.icaoCode <= hub!.maxIcaoCode, `${s.id}: ${entry.model} fits ${s.hub}`);
      assert.ok(entry.count > 0);
    }
  }
});
