/**
 * Detects and fixes bad year-over-year patterns in the airport demand tables:
 * frozen runs (identical value repeated for years), single-year outlier spikes,
 * and downward dips -- all of which break the "starts low, grows steadily"
 * trend the two stats channels (tourism, business) are meant to follow.
 *
 * Leading zeros (an airport not yet built) are left untouched: the channel is
 * only inspected from its first nonzero year onward, so neither the zeros nor
 * the jump into the first real value are touched.
 *
 * Re-run after any manual edit to airportsRows.ts / moreAirportsRows.ts that
 * might reintroduce one of these patterns. The regression tests in
 * src/data/airportRegistry.test.ts enforce the same invariants this script
 * establishes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { AirportRow } from '../src/data/airportTypes';
import { airportRows } from '../src/data/airportsRows';
import { moreAirportRows } from '../src/data/moreAirportsRows';

// Kept in sync with src/data/airportRegistry.test.ts, which enforces the same
// invariants this function establishes.
const MAX_ANNUAL_GROWTH = 1.2;
const MAX_FROZEN_RUN = 4;
// Below this, a single passenger more or less swings the ratio by double-digit
// percentages -- that is integer quantization, not a demand-curve problem, so
// frozen-run and spike checks only apply once a value clears this floor.
const MIN_MAGNITUDE = 15;

/** Fixes one channel (every other element of `stats`, offset 0 or 1) in place. */
function fixChannel(stats: number[], offset: number): void {
  const n = stats.length / 2;
  let start = -1;
  for (let i = 0; i < n; i++) {
    if (stats[i * 2 + offset] > 0) {
      start = i;
      break;
    }
  }
  if (start === -1) return; // channel is all zero (airport not open yet), nothing to fix

  let i = start;
  let runLen = 1;
  while (i + 1 < n) {
    const prevVal = stats[i * 2 + offset];
    const nextVal = stats[(i + 1) * 2 + offset];
    const magnitudeOk = prevVal >= MIN_MAGNITUDE;

    let bad = nextVal < prevVal; // a decrease is always bad
    if (nextVal === prevVal && magnitudeOk && runLen + 1 > MAX_FROZEN_RUN) bad = true;
    if (nextVal > prevVal && magnitudeOk && nextVal / prevVal > MAX_ANNUAL_GROWTH) bad = true;

    if (!bad) {
      runLen = nextVal === prevVal ? runLen + 1 : 1;
      i++;
      continue;
    }

    // Find the next year that would be an acceptable step directly from `i`.
    let found = -1;
    for (let j = i + 2; j < n; j++) {
      const vj = stats[j * 2 + offset];
      if (vj <= prevVal) continue;
      const cagr = Math.pow(vj / prevVal, 1 / (j - i));
      if (!magnitudeOk || cagr <= MAX_ANNUAL_GROWTH) {
        found = j;
        break;
      }
    }

    if (found === -1) {
      // Trailing unresolvable tail: project forward from `i` using the best
      // growth rate seen over the last 10 accepted years (or a small default).
      const back = Math.max(start, i - 10);
      const rate =
        back < i && stats[back * 2 + offset] > 0
          ? Math.min(MAX_ANNUAL_GROWTH, Math.max(1.005, Math.pow(prevVal / stats[back * 2 + offset], 1 / (i - back))))
          : 1.02;
      for (let k = i + 1; k < n; k++) {
        stats[k * 2 + offset] = Math.round(prevVal * Math.pow(rate, k - i));
      }
      return;
    }

    // Interpolate geometrically between i and found.
    const vFound = stats[found * 2 + offset];
    const span = found - i;
    for (let k = i + 1; k < found; k++) {
      stats[k * 2 + offset] = Math.round(prevVal * Math.pow(vFound / prevVal, (k - i) / span));
    }
    runLen = 1;
    i = found;
  }
}

/**
 * fixChannel's geometric interpolation can still leave a run of identical
 * rounded integers when the real total growth across a long stretch is
 * smaller than the number of years it spans -- there simply are not enough
 * distinct integers to give one per year. This final pass guarantees the
 * MAX_FROZEN_RUN invariant regardless, nudging only the years past the
 * allowed run length up by the smallest possible step (+1) and letting that
 * nudge cascade forward, which keeps the sequence non-decreasing.
 */
function breakFrozenRuns(stats: number[], offset: number): void {
  const n = stats.length / 2;
  let start = -1;
  for (let i = 0; i < n; i++) {
    if (stats[i * 2 + offset] > 0) {
      start = i;
      break;
    }
  }
  if (start === -1) return;

  let runLen = 1;
  for (let i = start + 1; i < n; i++) {
    const prev = stats[(i - 1) * 2 + offset];
    let curr = Math.max(stats[i * 2 + offset], prev);
    if (curr === prev) {
      runLen++;
      if (prev >= MIN_MAGNITUDE && runLen > MAX_FROZEN_RUN) {
        curr = prev + 1;
        runLen = 1;
      }
    } else {
      runLen = 1;
    }
    stats[i * 2 + offset] = curr;
  }
}

function fixRows(rows: AirportRow[]): number {
  let touched = 0;
  for (const row of rows) {
    const stats = row[6];
    if (!stats || stats.length < 4) continue;
    const before = stats.slice();
    fixChannel(stats, 0);
    fixChannel(stats, 1);
    breakFrozenRuns(stats, 0);
    breakFrozenRuns(stats, 1);
    if (stats.some((v, idx) => v !== before[idx])) touched++;
  }
  return touched;
}

const DUPLICATE_IDS = new Set(['SKG', 'HER', 'RHO', 'AYT', 'ADB', 'ESB', 'BJV', 'DLM']);

function serializeRow(row: AirportRow): string {
  const [id, name, lat, lon, level, maxIcaoCode, stats] = row;
  const statsStr = stats ? `[${stats.join(',')}]` : 'null';
  return `[${JSON.stringify(id)},${JSON.stringify(name)},${lat},${lon},${level},${JSON.stringify(maxIcaoCode)},${statsStr}]`;
}

function rewriteFile(filePath: string, exportLine: string, rows: AirportRow[]): void {
  const original = readFileSync(filePath, 'utf8');
  const headerEnd = original.indexOf(exportLine);
  if (headerEnd === -1) throw new Error(`could not find "${exportLine}" in ${filePath}`);
  const header = original.slice(0, headerEnd);
  const body = rows.map(r => `${serializeRow(r)},`).join('\n');
  const out = `${header}${exportLine}\n${body}\n];\n`;
  writeFileSync(filePath, out);
}

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');

const touchedCore = fixRows(airportRows);
const touchedMore = fixRows(moreAirportRows);

const dedupedMore = moreAirportRows.filter(r => !DUPLICATE_IDS.has(r[0]));
const removed = moreAirportRows.length - dedupedMore.length;

rewriteFile(path.join(dataDir, 'airportsRows.ts'), 'export const airportRows: AirportRow[] = [', airportRows);
rewriteFile(path.join(dataDir, 'moreAirportsRows.ts'), 'export const moreAirportRows: AirportRow[] = [', dedupedMore);

console.log(`airportsRows.ts: fixed ${touchedCore}/${airportRows.length} airports`);
console.log(`moreAirportsRows.ts: fixed ${touchedMore}/${moreAirportRows.length} airports, removed ${removed} orphaned duplicates`);
