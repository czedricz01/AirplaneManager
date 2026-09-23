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

/**
 * Demand is meant to start low and grow steadily. These checks run on
 * `rawAirports` -- the merged list before the Soviet/Western era multipliers
 * in airportRegistry.ts, which are a deliberate runtime effect, not a data
 * error -- and only from each channel's first nonzero year onward, since a
 * leading run of zeros represents an airport that has not opened yet.
 *
 * Below MIN_MAGNITUDE, a single passenger swings the ratio by double-digit
 * percentages -- that is integer quantization, not a demand-curve problem, so
 * the frozen-run and spike checks only apply once a value clears that floor.
 * A decrease is checked regardless of magnitude.
 *
 * Keep these constants in sync with scripts/fix_airport_stats.ts, which uses
 * the same thresholds to smooth violations of these invariants.
 */
const MAX_ANNUAL_GROWTH = 1.2;
const MAX_FROZEN_RUN = 4;
const MIN_MAGNITUDE = 15;

function checkChannel(id: string, label: string, stats: number[], offset: number): string[] {
  const problems: string[] = [];
  const n = stats.length / 2;
  let anchor = -1;
  for (let i = 0; i < n; i++) {
    if (stats[i * 2 + offset] > 0) {
      anchor = i;
      break;
    }
  }
  if (anchor === -1) return problems;

  let frozenRun = 1;
  for (let i = anchor + 1; i < n; i++) {
    const prev = stats[(i - 1) * 2 + offset];
    const curr = stats[i * 2 + offset];
    const magnitudeOk = prev >= MIN_MAGNITUDE;
    if (curr < prev) problems.push(`${id} ${label} decreases at index ${i} (${prev} -> ${curr})`);
    if (curr === prev) {
      frozenRun++;
      if (magnitudeOk && frozenRun > MAX_FROZEN_RUN) {
        problems.push(`${id} ${label} frozen for ${frozenRun} years ending at index ${i}`);
      }
    } else {
      frozenRun = 1;
    }
    if (magnitudeOk && prev > 0 && curr / prev > MAX_ANNUAL_GROWTH) {
      problems.push(`${id} ${label} spikes at index ${i} (${prev} -> ${curr}, ${((curr / prev - 1) * 100).toFixed(0)}%)`);
    }
  }
  return problems;
}

test('demand tables start low and grow steadily, with no frozen runs, dips or spikes', () => {
  const problems: string[] = [];
  for (const a of rawAirports) {
    if (!a.stats) continue;
    problems.push(...checkChannel(a.id, 'tourism', a.stats, 0));
    problems.push(...checkChannel(a.id, 'business', a.stats, 1));
  }
  assert.deepEqual(problems, []);
});
