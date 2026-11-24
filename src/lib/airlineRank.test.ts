import test from 'node:test';
import assert from 'node:assert/strict';

import { FREE_MODE_RANK, MAX_RANK, RANKS, clampRank, countHubs, effectiveRank, hubAllowance, managementGate, normalizeMode, rankDef, rankGateMessage, rankUnlockLines } from './airlineRank';
import { RANK_UNLOCKS, RANKS as MODEL_RANKS } from '../model/constants';

test('the ranks are the model table (6.7)', () => {
  assert.equal(RANKS, MODEL_RANKS);
  assert.equal(RANKS.length, 10);
  assert.equal(RANKS[0].title, 'Startup');
  assert.equal(RANKS[MAX_RANK].title, 'Global Player');
  assert.equal(RANKS[1].requires.reputation, 30, 'reputation thresholds of the new scale (E36, E39)');
});

test('any number is a rank', () => {
  assert.equal(clampRank(-3), 0);
  assert.equal(clampRank(99), MAX_RANK);
  assert.equal(clampRank('x'), 0);
  assert.equal(rankDef(42).title, 'Global Player');
});

test('what a rank opens is generated from the model tables', () => {
  assert.deepEqual(rankUnlockLines(0).slice(0, 4), ['Airports up to level 4', 'Up to 1 hub', '2 development projects at a time', 'Local marketing campaigns']);
  const regional = rankUnlockLines(2);
  assert.ok(regional.includes('Up to 2 hubs'));
  assert.ok(regional.includes('The frequent-flyer programme'));
  assert.ok(regional.includes('Narrowbody aircraft (development)'), 'class ranks from CLASS_RESEARCH (E41)');
  const continental = rankUnlockLines(5);
  assert.ok(continental.includes('Jumbo aircraft (development)'));
  assert.ok(continental.includes('Supersonic aircraft (development)'));
  assert.ok(rankUnlockLines(4).includes('3 development projects at a time'), 'research slots of the rank (E42)');
  assert.ok(rankUnlockLines(8).includes('Management tier 3 at a hub'));
  for (const r of RANKS) assert.ok(rankUnlockLines(r.index).length > 0, `${r.title} opens something`);
});

test('the refusal names both ranks and is null when the rank suffices', () => {
  assert.equal(rankGateMessage(4, 4, 'The VIP lounge'), null);
  const msg = rankGateMessage(0, RANK_UNLOCKS.vipLounge, 'The VIP lounge')!;
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
  assert.equal(normalizeMode('x'), 'normal');
  assert.equal(normalizeMode(undefined), 'normal');
  assert.equal(hubAllowance(0, 0, true), Infinity);
  const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`A${i}`, { level: 2 }]));
  assert.notEqual(managementGate(2, 0, 0, many), null, 'a startup may not run thirty hubs');
  assert.equal(managementGate(2, 0, 0, many, undefined, true), null, 'but Free Mode may');
  assert.equal(managementGate(3, 0, 0, {}, undefined, false)?.includes('Management tier 3'), true);
  assert.equal(managementGate(3, 8, 0, {}), null);
});
