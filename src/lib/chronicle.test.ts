import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RECORD_PROFIT_MARGIN,
  appendChronicle,
  chronicleEntriesForMonth,
  departureMarketShare,
  regionsServed,
  trimChronicle,
  type ChronicleHistoryReport,
  type ChronicleMonth
} from './chronicle';
import type { ChronicleEntry } from './gameState';
import { setDecimalSymbol } from './format';
import { airportsMapAdjusted } from '../data/airportRegistry';

setDecimalSymbol('.');

/** A quiet month: nothing happens unless a test puts it in. */
const month = (over: Partial<ChronicleMonth> = {}): ChronicleMonth => ({
  offset: 24,
  profit: -1000,
  capitalAfter: 10_000_000,
  reputation: 50,
  reputationBefore: 50,
  history: [],
  ...over
});

/** Runs months one after another the way the game does, feeding each close's entries back in. */
function run(months: Partial<ChronicleMonth>[], start: ChronicleEntry[] = []) {
  let chronicle = start;
  const history: ChronicleHistoryReport[] = [];
  const written: ChronicleEntry[][] = [];
  months.forEach((over, i) => {
    const m = month({ offset: i, history: [...history], ...over });
    const entries = chronicleEntriesForMonth(chronicle, m);
    written.push(entries);
    chronicle = appendChronicle(chronicle, entries);
    history.push({ totalProfit: m.profit, capitalAfter: m.capitalAfter, reputation: m.reputation, regions: m.regions ? [...m.regions.keys()] : [], transferHubs: (m.hubs || []).map(h => h.id) });
  });
  return { chronicle, written };
}

test('market share counts departures on the pairs the player flies, both directions, rivals and own routes', () => {
  const week = (n: number) => Array.from({ length: n }, () => ({}));
  const routes = [
    { origin: 'FRA', destination: 'LHR', schedule: week(7) },
    { origin: 'LHR', destination: 'FRA', schedule: week(7) },
    { origin: 'FRA', destination: 'CDG', schedule: week(14) }
  ];
  const offers = [
    { origin: 'LHR', destination: 'FRA', departures: 14 },
    { origin: 'CDG', destination: 'FRA', departures: 14 },
    { origin: 'FRA', destination: 'JFK', departures: 50 }
  ];
  // 28 own departures, 28 rival ones on the same pairs; JFK is not the player's market.
  assert.equal(departureMarketShare(routes, offers), 0.5);
  assert.equal(departureMarketShare(routes, []), 1, 'alone on every pair');
  assert.equal(departureMarketShare([], offers), null);
  assert.equal(departureMarketShare([{ origin: 'FRA', destination: 'LHR', weeklyFlights: 3 }], [{ origin: 'FRA', destination: 'LHR', departures: 1 }]), 0.75);
});

test('regions served name the first route that reaches each', () => {
  const served = regionsServed(
    [{ origin: 'FRA', destination: 'LHR' }, { origin: 'FRA', destination: 'JFK' }, { origin: 'LHR', destination: 'JFK' }],
    airportsMapAdjusted
  );
  assert.deepEqual([...served.entries()], [['EU', 'FRA-LHR'], ['NA', 'FRA-JFK']]);
});

test('trimming keeps the newest entry of every key and drops the oldest of the rest', () => {
  const list: ChronicleEntry[] = [
    { offset: 0, kind: 'network', key: 'region:NA', text: 'first NA' },
    { offset: 1, kind: 'record', key: 'record:profit', value: 1, text: 'r1' },
    { offset: 2, kind: 'crisis', text: 'c2' },
    { offset: 3, kind: 'record', key: 'record:profit', value: 2, text: 'r2' },
    { offset: 4, kind: 'crisis', text: 'c4' }
  ];
  assert.deepEqual(trimChronicle(list, 3).map(e => e.text), ['first NA', 'r2', 'c4']);
  assert.equal(trimChronicle(list, 10), list, 'unchanged within the limit');
  assert.deepEqual(trimChronicle(list, 1).map(e => e.text), ['r2'], 'only keys left: the oldest of them go');
  assert.equal(trimChronicle(Array.from({ length: 400 }, (_, i) => ({ offset: i, kind: 'crisis' as const, text: `${i}` }))).length, 300);
});

test('profit records: the first month in profit, then only a clear new best, not too soon, even when results creep up', () => {
  const profits = [-5e5, 1e5, 1.1e5, 1.2e5, 1.24e5, 1.3e5, 1.5e5, 1.6e5, 1.7e5, 2.1e5, 2.15e5, 2.2e5, 2.4e5, 2.6e5];
  const { written } = run(profits.map(profit => ({ profit })));
  const records = written.map((w, i) => [i, w.filter(e => e.kind === 'record').map(e => e.text)] as const).filter(([, r]) => r.length > 0);
  assert.deepEqual(records, [
    // 150k in month 6 is 50% up, but only five months after the first record.
    [1, ['First month in profit: $100,000.']],
    [7, [`Best month yet: $160,000 operating profit. 60% above the record set in 02/1960.`]],
    // 210k to 240k are bests, but within six months of the last record; 260k comes after them and clears 200k.
    [13, [`Best month yet: $260,000 operating profit. 63% above the record set in 08/1960.`]]
  ]);
  assert.ok(RECORD_PROFIT_MARGIN > 1);
});

test('a save from before the chronicle anchors on its first profitable month, not its creeping best', () => {
  const history = [2e5, 2.1e5, 2.2e5].map(totalProfit => ({ totalProfit }));
  assert.deepEqual(chronicleEntriesForMonth([], month({ profit: 2.3e5, history })).filter(e => e.kind === 'record'), []);
  const best = chronicleEntriesForMonth([], month({ profit: 2.6e5, history }));
  assert.deepEqual(best.map(e => e.text), ['Best month yet: $260,000 operating profit.']);
  assert.equal(best[0].value, 2.6e5);
});

test('reputation highs are written every five points, however slowly reputation climbs', () => {
  const reps = [51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 58, 62];
  const { written } = run(reps.map((reputation, i) => ({ reputation, reputationBefore: i === 0 ? 50 : reps[i - 1] })));
  const highs = written.flatMap(w => w.filter(e => e.key === 'record:reputation').map(e => [e.offset, e.value]));
  // The first month sets the bar at 51: 56, then 61. 62 is a high, but not five above 61.
  assert.deepEqual(highs, [[5, 56], [10, 61]]);
});

test('the first route into a region is written once, the home region never', () => {
  const eu = new Map([['EU', 'FRA-LHR']] as const);
  const euNa = new Map([['EU', 'FRA-LHR'], ['NA', 'FRA-JFK']] as const);
  const { written, chronicle } = run([
    { regions: new Map(eu), homeRegion: 'EU' },
    { regions: new Map(euNa), homeRegion: 'EU' },
    { regions: new Map(eu), homeRegion: 'EU' },
    { regions: new Map(euNa), homeRegion: 'EU' }
  ]);
  assert.deepEqual(written.map(w => w.map(e => e.text)), [[], ['First route to North America: FRA-JFK.'], [], []]);
  assert.equal(chronicle.filter(e => e.key === 'region:NA').length, 1);

  // A save from before the chronicle: the network it already had is not dated to today.
  const upgraded = chronicleEntriesForMonth([], month({ regions: new Map(euNa), homeRegion: 'EU', history: [{ totalProfit: 0 }] }));
  assert.deepEqual(upgraded, []);
});

test('each airport becomes a transfer hub once, the very first one named as such', () => {
  const { written } = run([
    { hubs: [] },
    { hubs: [{ id: 'FRA', name: 'Frankfurt', pax: 1200.4 }, { id: 'LHR', name: 'London', pax: 0.2 }] },
    { hubs: [{ id: 'FRA', name: 'Frankfurt', pax: 1500 }, { id: 'JFK', name: 'New York', pax: 80 }] },
    { hubs: [] },
    { hubs: [{ id: 'FRA', name: 'Frankfurt', pax: 900 }] }
  ]);
  assert.deepEqual(written.map(w => w.map(e => e.text)), [
    [],
    ['First transfer hub: 1,200 passengers changed planes at Frankfurt (FRA).'],
    ['New York (JFK) becomes a transfer hub: 80 passengers changed planes there.'],
    [],
    []
  ]);
});

test('capital below zero is written the first time only', () => {
  const { written } = run([
    { capitalAfter: 1e6 },
    { capitalAfter: -2e5 },
    { capitalAfter: -4e5 },
    { capitalAfter: 3e5 },
    { capitalAfter: -1e5 }
  ]);
  const lows = written.map(w => w.filter(e => e.kind === 'finance').map(e => e.text));
  assert.deepEqual(lows, [[], ['Capital falls below zero for the first time: -$200,000 at the month\'s end.'], [], [], []]);
  // Already below zero when the chronicle started: no "first time" to write.
  assert.deepEqual(chronicleEntriesForMonth([], month({ capitalAfter: -1, history: [{ capitalAfter: -5 }] })), []);
});

test('milestones, targets, strikes, major disruptions and world events, dated when they happen', () => {
  const entries = chronicleEntriesForMonth([], month({
    offset: 179,
    milestones: [{ title: 'Ten aircraft', detail: 'A fleet rather than a handful of aeroplanes.' }],
    goal: { year: 1974, target: 5e6, achieved: 4e6, met: false },
    strike: { offset: 180, morale: 28.4 },
    disruptions: [
      { offset: 180, cancelShare: 0.25, text: 'Technical defect: D-ABCD: 25% of flights cancelled on FRA-LHR.' },
      { offset: 180, cancelShare: 0.1, text: 'Bird strike: 10%.' }
    ],
    eventsStarted: [{ title: 'Oil crisis', startOffset: 180, duration: 12, demandMultiplier: 0.8, fuelMultiplier: 1.8 }],
    eventsEnded: [{ title: 'Summer surge', endOffset: 180 }]
  }));
  assert.deepEqual(entries.map(e => [e.offset, e.kind, e.text]), [
    [179, 'milestone', 'Ten aircraft. A fleet rather than a handful of aeroplanes.'],
    [179, 'goal', '1974 target missed: $4,000,000 of the $5,000,000 the board expected.'],
    [180, 'strike', 'Staff strike called for 01/1975, with morale at 28.'],
    [180, 'disruption', 'Technical defect: D-ABCD: 25% of flights cancelled on FRA-LHR.'],
    [180, 'crisis', 'Oil crisis begins: demand −20%, fuel +80%, for 12 months.'],
    [180, 'crisis', 'Summer surge is over.']
  ]);
  const met = chronicleEntriesForMonth([], month({ goal: { year: 1975, target: 5e6, achieved: 6e6, met: true } }));
  assert.equal(met[0].text, '1975 target met: $6,000,000 operating profit against $5,000,000.');
});

test('the same month always writes the same entries', () => {
  const m = month({
    profit: 3e5,
    hubs: [{ id: 'LHR', name: 'London', pax: 50 }, { id: 'CDG', name: 'Paris', pax: 50 }, { id: 'FRA', name: 'Frankfurt', pax: 90 }],
    regions: new Map([['NA', 'FRA-JFK'], ['AS', 'FRA-HKG']] as const),
    homeRegion: 'EU'
  });
  const a = chronicleEntriesForMonth([], m);
  assert.deepEqual(a, chronicleEntriesForMonth([], m));
  assert.deepEqual(a.filter(e => e.key?.startsWith('hub:')).map(e => e.key), ['hub:FRA', 'hub:CDG', 'hub:LHR'], 'busiest first, ties by code');
});
