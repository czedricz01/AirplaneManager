import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_RANK, RANKS, RANK_NEEDED, aircraftRankNeeded, clampRank, countHubs, hubAllowance, nextRank, qualifyingRank,
  rankGateMessage, rankProgress, startingRank, type RankStats
} from './airlineRank';

const stats = (over: Partial<RankStats> = {}): RankStats => ({ routes: 0, monthlyPax: 0, reputation: 50, regions: 0, ...over });

test('requirements only grow from rank to rank', () => {
  for (let i = 1; i < RANKS.length; i++) {
    const a = RANKS[i - 1].requires, b = RANKS[i].requires;
    assert.ok(b.routes > a.routes && b.monthlyPax > a.monthlyPax && b.reputation >= a.reputation && b.regions >= a.regions, RANKS[i].id);
    assert.ok(RANKS[i].maxHubs >= RANKS[i - 1].maxHubs);
  }
});

test('a new airline is a startup', () => {
  assert.equal(qualifyingRank(stats()), 0);
  assert.equal(qualifyingRank(stats({ routes: 2, monthlyPax: 100_000 })), 0, 'too few routes');
});

test('every requirement has to be met', () => {
  const regional = RANKS[1].requires;
  assert.equal(qualifyingRank({ ...regional }), 1);
  assert.equal(qualifyingRank({ ...regional, reputation: regional.reputation - 1 }), 0);
  assert.equal(qualifyingRank({ ...regional, monthlyPax: regional.monthlyPax - 1 }), 0);
  assert.equal(qualifyingRank({ ...regional, regions: 0 }), 0);
});

test('the top rank is reachable and a rank is not skipped', () => {
  assert.equal(qualifyingRank(RANKS[MAX_RANK].requires), MAX_RANK);
  // Qualifies for National figures but fails Regional's reputation: stays below both.
  assert.equal(qualifyingRank({ ...RANKS[2].requires, reputation: 10 }), 0);
});

test('a rank never falls', () => {
  assert.equal(nextRank(3, stats()), 3);
  assert.equal(nextRank(0, RANKS[2].requires), 2);
  assert.equal(nextRank(99, stats()), MAX_RANK);
  assert.equal(clampRank(NaN), 0);
  assert.equal(clampRank(-4), 0);
});

test('progress lists what is missing and is null at the top', () => {
  const p = rankProgress(0, stats({ routes: 1, monthlyPax: 4_000, reputation: 45, regions: 1 }))!;
  assert.equal(p.next.index, 1);
  const byLabel = Object.fromEntries(p.lines.map(l => [l.label, l.met]));
  assert.equal(byLabel['Routes'], false);
  assert.equal(byLabel['Reputation'], true);
  assert.ok(p.fraction > 0 && p.fraction < 1);
  assert.equal(rankProgress(MAX_RANK, stats()), null);
});

test('wide-bodies and supersonics are gated, everything else is open', () => {
  assert.equal(aircraftRankNeeded({ class: 'Narrowbody', cruiseSpeed: 850 }), 0);
  assert.equal(aircraftRankNeeded({ class: 'Regional' }), 0);
  assert.equal(aircraftRankNeeded({ class: 'Widebody', cruiseSpeed: 900 }), RANK_NEEDED.widebody);
  assert.equal(aircraftRankNeeded({ class: 'Narrowbody', cruiseSpeed: 2158 }), RANK_NEEDED.supersonic);
});

test('the refusal names both ranks and is null when the rank suffices', () => {
  assert.equal(rankGateMessage(2, 2, 'The Boeing 747'), null);
  const msg = rankGateMessage(0, 2, 'The Boeing 747')!;
  assert.match(msg, /747/);
  assert.match(msg, /National Airline/);
  assert.match(msg, /Startup/);
});

test('hubs: the rank allows some, milestones add more, tier 2 airports count', () => {
  assert.equal(hubAllowance(0, 0), 1);
  assert.equal(hubAllowance(2, 1), 4);
  assert.equal(countHubs({ FRA: { level: 2 }, CDG: { level: 1 }, LHR: { level: 3 } }), 2);
  assert.equal(countHubs(null), 0);
});

test('an old save keeps the wide-bodies it flies', () => {
  assert.equal(startingRank(stats(), [{ class: 'Widebody' }]), RANK_NEEDED.widebody);
  assert.equal(startingRank(stats(), [{ class: 'Narrowbody' }], 3), 3, 'a scenario floor');
  assert.equal(startingRank(RANKS[4].requires, []), 4);
});
