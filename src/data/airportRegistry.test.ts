import test from 'node:test';
import assert from 'node:assert/strict';

import { airportRows } from './airportsRows';
import { moreAirportRows } from './moreAirportsRows';
import { STATS_BASE_YEAR } from './airportTypes';
import { TRAFFIC } from '../../scripts/airport-traffic/data';
import { FIRST_YEAR, LAST_YEAR, statsRow } from '../../scripts/airport-traffic/series';
import { airports, airportsMapAdjusted, rawAirports } from './airportRegistry';

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
  for (const a of airports) assert.equal(airportsMapAdjusted.get(a.id)?.id, a.id);
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

/**
 * The demand tables are generated from real passenger statistics by scripts/airport-traffic/build.ts.
 * Real traffic falls as well as rises (wars, closures, a hub moving to a new airport), so the old
 * "grows steadily" invariant no longer applies. Instead: the generated rows must match the source data
 * exactly (nobody edits them by hand), and the values must be plausible.
 */

test('generated demand tables match the source data (re-run scripts/airport-traffic/build.ts)', () => {
  const stale: string[] = [];
  for (const row of [...airportRows, ...moreAirportRows]) {
    const entry = TRAFFIC[row[0]];
    if (!entry || JSON.stringify(statsRow(entry)) !== JSON.stringify(row[6])) stale.push(row[0]);
  }
  assert.deepEqual(stale, []);
});

test('demand tables cover 1960-2025 with finite, non-negative values', () => {
  assert.equal(FIRST_YEAR, STATS_BASE_YEAR);
  const years = LAST_YEAR - FIRST_YEAR + 1;
  for (const a of rawAirports) {
    assert.ok(a.stats, `${a.id} has a table`);
    assert.equal(a.stats.length, years * 2, `${a.id} covers every year`);
    assert.ok(a.stats.every((v) => Number.isFinite(v) && v >= 0), `${a.id} values`);
  }
});

test('2019 local traffic matches the known order of magnitude', () => {
  const at = (id: string, year: number) => {
    const s = rawAirports.find((a) => a.id === id)!.stats!;
    const i = (year - STATS_BASE_YEAR) * 2;
    return s[i] + s[i + 1];
  };
  // Thousand origin/destination passengers per year: London (LHR+LGW) far above Frankfurt, Frankfurt far above Saarbrücken.
  assert.ok(at('LHR', 2019) > 90_000 && at('LHR', 2019) < 120_000);
  assert.ok(at('FRA', 2019) > 30_000 && at('FRA', 2019) < 40_000);
  assert.ok(at('SCN', 2019) > 200 && at('SCN', 2019) < 600);
  // Dubai barely existed in 1960; Kyiv has had no civil flights since 2022.
  assert.ok(at('DXB', 1960) < 20);
  assert.equal(at('KBP', 2024), 0);
});
