import test from 'node:test';
import assert from 'node:assert/strict';

import { airportRows } from './airportsRows';
import { airports, getAirport, rawAirports } from './airportRegistry';

/**
 * The core list carried 19 ids twice (JNB SCL CPT LCA ASU MVD KRT FIH LAD LUN
 * MPM EBB KGL ACC BKO CKY FNA ROB SID), each pair with the same name and
 * coordinates but a different demand table. Only the registry's map collapsed
 * them, so anything reading airportsData directly saw whichever row it happened
 * to hit. These assertions keep the generated file unambiguous at the source.
 */

test('no airport id appears twice in the generated rows', () => {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const row of airportRows) {
    if (seen.has(row[0])) dupes.push(row[0]);
    seen.add(row[0]);
  }
  assert.deepEqual(dupes, []);
});

test('the registry is a bijection between ids and airports', () => {
  assert.equal(new Set(airports.map(a => a.id)).size, airports.length);
  assert.equal(airports.length, rawAirports.length);
  for (const a of airports) assert.equal(getAirport(a.id)?.id, a.id);
});

test('every airport has usable coordinates and a demand table', () => {
  for (const a of airports) {
    assert.ok(Number.isFinite(a.coords[0]) && Math.abs(a.coords[0]) <= 90, `${a.id} latitude`);
    assert.ok(Number.isFinite(a.coords[1]) && Math.abs(a.coords[1]) <= 180, `${a.id} longitude`);
    if (a.stats) {
      assert.equal(a.stats.length % 2, 0, `${a.id} stats must be tourism/business pairs`);
      assert.ok(a.stats.every(Number.isFinite), `${a.id} stats must all be numbers`);
    }
  }
});
