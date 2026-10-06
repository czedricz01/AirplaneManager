import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FREE_MODE_RANK, MAX_RANK, RANKS, RANK_NEEDED, clampRank, countHubs, effectiveRank, hubAllowance, managementGate,
  migrateOldRank, nextRank, normalizeMode, qualifyingRank, rankGateMessage, rankProgress, startingRank, type RankStats
} from './airlineRank';

const stats = (over: Partial<RankStats> = {}): RankStats => ({ routes: 0, monthlyPax: 0, reputation: 50, regions: 0, years: 0, ...over });

test('there are ten ranks, from Startup to Global Player', () => {
  assert.equal(RANKS.length, 10);
  assert.equal(RANKS[0].title, 'Startup');
  assert.equal(RANKS[MAX_RANK].title, 'Global Player');
  assert.equal(new Set(RANKS.map(r => r.id)).size, 10);
});

test('requirements only grow from rank to rank, and so do hubs and airport levels', () => {
  for (let i = 1; i < RANKS.length; i++) {
    const a = RANKS[i - 1].requires, b = RANKS[i].requires;
    assert.ok(b.routes > a.routes && b.monthlyPax > a.monthlyPax, `${RANKS[i].id}: more routes and passengers`);
    assert.ok(b.reputation >= a.reputation && b.regions >= a.regions && b.years >= a.years, `${RANKS[i].id}: nothing gets easier`);
    assert.ok(RANKS[i].maxHubs >= RANKS[i - 1].maxHubs);
    assert.ok(RANKS[i].maxAirportLevel >= RANKS[i - 1].maxAirportLevel);
  }
});

test('the climb is slow: the top ranks need decades in business', () => {
  assert.ok(RANKS[4].requires.years >= 5, 'National takes years');
  assert.ok(RANKS[MAX_RANK].requires.years >= 35, 'Global Player takes most of a career');
});

test('the great airports (level 6 and 7) open at National', () => {
  const national = RANKS.findIndex(r => r.id === 'national');
  assert.ok(RANKS[national - 1].maxAirportLevel <= 5);
  assert.equal(RANKS[national].maxAirportLevel, 7);
});

test('a new airline is a startup', () => {
  assert.equal(qualifyingRank(stats()), 0);
  assert.equal(qualifyingRank(stats({ routes: 2, monthlyPax: 100_000, years: 50 })), 0, 'too few routes');
});

test('every requirement has to be met, the years in business included', () => {
  const regional = RANKS[2].requires;
  assert.equal(qualifyingRank({ ...regional }), 2);
  assert.equal(qualifyingRank({ ...regional, reputation: regional.reputation - 1 }), 1);
  assert.equal(qualifyingRank({ ...regional, monthlyPax: regional.monthlyPax - 1 }), 1);
  assert.equal(qualifyingRank({ ...regional, years: regional.years - 1 }), 1, 'a year cannot be bought');
  assert.equal(qualifyingRank({ ...regional, regions: 0 }), 0, 'no region served, no rank at all');
});

test('the top rank is reachable and a rank is not skipped', () => {
  assert.equal(qualifyingRank(RANKS[MAX_RANK].requires), MAX_RANK);
  assert.equal(qualifyingRank({ ...RANKS[3].requires, reputation: 10 }), 0);
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
  const withYears = rankProgress(1, stats())!;
  assert.ok(withYears.lines.some(l => l.label === 'Years in business'), 'the years are a line of their own');
});

test('the refusal names both ranks and is null when the rank suffices', () => {
  assert.equal(rankGateMessage(4, 4, 'The VIP lounge'), null);
  const msg = rankGateMessage(0, RANK_NEEDED.vipLounge, 'The VIP lounge')!;
  assert.match(msg, /VIP lounge/);
  assert.match(msg, /National Airline/);
  assert.match(msg, /Startup/);
});

test('hubs: the rank allows some, milestones add more, tier 2 airports count', () => {
  assert.equal(hubAllowance(0, 0), 1);
  assert.equal(hubAllowance(4, 1), RANKS[4].maxHubs + 1);
  assert.equal(countHubs({ FRA: { level: 2 }, CDG: { level: 1 }, LHR: { level: 3 } }), 2);
  assert.equal(countHubs(null), 0);
});

test('Free Mode is the top rank with unlimited hubs; Normal Mode keeps what was earned', () => {
  assert.equal(effectiveRank('free', 0), FREE_MODE_RANK);
  assert.equal(FREE_MODE_RANK, MAX_RANK);
  assert.equal(effectiveRank('normal', 3), 3);
  assert.equal(effectiveRank('normal', 99), MAX_RANK);
  assert.equal(normalizeMode('free'), 'free');
  assert.equal(normalizeMode('normal'), 'normal');
  assert.equal(normalizeMode('x'), 'normal');
  assert.equal(normalizeMode(undefined), 'normal');
  assert.equal(hubAllowance(0, 0, true), Infinity);
  const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`A${i}`, { level: 2 }]));
  assert.notEqual(managementGate(2, 0, 0, many), null, 'a startup may not run thirty hubs');
  assert.equal(managementGate(2, 0, 0, many, undefined, true), null, 'but Free Mode may');
  assert.equal(managementGate(3, 0, 0, {}, undefined, false)?.includes('Management tier 3'), true);
});

test('the first six-step ladder maps onto the same places on this one', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(migrateOldRank), [0, 2, 4, 6, 8, 9]);
  assert.equal(migrateOldRank(99), 9);
  assert.equal(migrateOldRank(NaN), 0);
});

test('a scenario or a loaded game starts at the rank its figures give, no lower than the floor', () => {
  assert.equal(startingRank(stats(), 3), 3, 'a scenario floor');
  assert.equal(startingRank(RANKS[4].requires), 4);
  assert.equal(startingRank(stats()), 0);
});
