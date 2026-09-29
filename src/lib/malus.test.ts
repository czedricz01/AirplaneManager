import test from 'node:test';
import assert from 'node:assert/strict';

import { hadOneTimeMalus, isMalusEvent, malusEventClaim, malusMonthOpen } from './malus';
import { historicalEvents, type HistoricalEvent } from './eventSystem';
import type { Disruption, Staff } from './gameState';

/** Small deterministic PRNG, so a test run can be repeated exactly. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const NO_STRIKE: Pick<Staff, 'strike'> = { strike: null };

const disruptionAt = (offset: number): Disruption => ({
  id: `d${offset}`, kind: 'technical', offset, routeIds: ['r1'], cancelShare: 0.25
});

const randomEvent = (startOffset: number, duration: number, demandMultiplier = 0.9, fuelMultiplier = 1): HistoricalEvent => ({
  startOffset, duration, title: `e${startOffset}`, description: '', demandMultiplier, fuelMultiplier
});

test('an event is a malus when demand falls, or fuel rises by more than demand does', () => {
  // The extremes of the random event templates in App.tsx.
  assert.equal(isMalusEvent({ demandMultiplier: 0.88, fuelMultiplier: 1.08 }), true, 'volcanic ash');
  assert.equal(isMalusEvent({ demandMultiplier: 1.01, fuelMultiplier: 1.25 }), true, 'refinery outage');
  assert.equal(isMalusEvent({ demandMultiplier: 0.9, fuelMultiplier: 0.88 }), true, 'slump: cheaper fuel does not make up for empty seats');
  assert.equal(isMalusEvent({ demandMultiplier: 0.95, fuelMultiplier: 1.25 }), true, 'energy friction');

  assert.equal(isMalusEvent({ demandMultiplier: 1.1, fuelMultiplier: 1.1 }), false, 'summer surge, worst draw');
  assert.equal(isMalusEvent({ demandMultiplier: 1.05, fuelMultiplier: 1.01 }), false, 'commerce summit');
  assert.equal(isMalusEvent({ demandMultiplier: 1.0, fuelMultiplier: 0.82 }), false, 'biofuel');
  assert.equal(isMalusEvent({ demandMultiplier: 1.1, fuelMultiplier: 1.05 }), false, 'wanderlust');
});

test('every scripted historical event would be a malus, which is why none of them is counted', () => {
  for (const ev of historicalEvents) assert.equal(isMalusEvent(ev), true, ev.title);
});

test('a random malus event claims its own months and as many again to recover', () => {
  assert.deepEqual(malusEventClaim({ startOffset: 100, duration: 4 }), { first: 100, end: 108 });
  assert.deepEqual(malusEventClaim({ startOffset: 100, duration: 1 }), { first: 100, end: 102 });
  assert.deepEqual(malusEventClaim({ startOffset: 100, duration: 0 }), { first: 100, end: 102 }, 'unusable duration counts as one month');
});

test('the month after a disruption or a strike stays clear', () => {
  assert.equal(malusMonthOpen([], [], NO_STRIKE, 50), true, 'nothing happened');
  assert.equal(malusMonthOpen([], [disruptionAt(49)], NO_STRIKE, 50), false, 'a disruption in the month just closed');
  assert.equal(malusMonthOpen([], [disruptionAt(50)], NO_STRIKE, 50), true, 'one later than that is not the month just closed');
  assert.equal(malusMonthOpen([], [disruptionAt(48)], NO_STRIKE, 50), true, 'two months ago: clean month already served');
  assert.equal(malusMonthOpen([], undefined, NO_STRIKE, 50), true);

  const struck: Pick<Staff, 'strike'> = { strike: { startOffset: 49, cancelShare: 1 } };
  assert.equal(malusMonthOpen([], [], struck, 50), false, 'a strike in the month just closed');
  assert.equal(hadOneTimeMalus([], struck, 49), true);
  assert.equal(hadOneTimeMalus([], struck, 50), false);
  const old: Pick<Staff, 'strike'> = { strike: { startOffset: 40, cancelShare: 1 } };
  assert.equal(malusMonthOpen([], [], old, 50), true, 'the strike is kept in the state, but it is long past');
});

test('a random malus event keeps everything else away while it runs and for as long again after', () => {
  const events = [randomEvent(100, 3)];
  for (const offset of [100, 101, 102]) assert.equal(malusMonthOpen(events, [], NO_STRIKE, offset), false, `running, ${offset}`);
  for (const offset of [103, 104, 105]) assert.equal(malusMonthOpen(events, [], NO_STRIKE, offset), false, `recovering, ${offset}`);
  assert.equal(malusMonthOpen(events, [], NO_STRIKE, 106), true, 'the month after that is free');
  assert.equal(malusMonthOpen(events, [], NO_STRIKE, 99), true, 'before it started');
});

test('a random event that is a bonus, and the scripted ones, never close a month', () => {
  const surge = [randomEvent(100, 3, 1.12, 1.06)];
  for (const offset of [100, 101, 102, 103, 104]) assert.equal(malusMonthOpen(surge, [], NO_STRIKE, offset), true, `${offset}`);
  // The scripted list is not what is passed in, so the Oil Crisis does not matter either way.
  const crisis = historicalEvents[0];
  assert.equal(malusMonthOpen([], [], NO_STRIKE, crisis.startOffset + 1), true);
});

/**
 * Plays the month close over and over the way App.tsx does, with as much bad
 * luck as the rule lets through, and returns the months that had any.
 */
function play(months: number, seed: number, chanceEvent: number, chanceOneTime: number): Set<number> {
  const rng = seeded(seed);
  const events: HistoricalEvent[] = [];
  const disruptions: Disruption[] = [];
  const malus = new Set<number>();

  for (let closing = 0; closing < months; closing++) {
    const next = closing + 1;
    const open = malusMonthOpen(events, disruptions, NO_STRIKE, next);
    if (!open) continue;
    if (rng() < chanceEvent) {
      const duration = 2 + Math.floor(rng() * 5);
      events.push(randomEvent(next, duration));
      for (let m = next; m < next + duration; m++) malus.add(m);
    }
    if (rng() < chanceOneTime) {
      disruptions.push(disruptionAt(next));
      malus.add(next);
    }
  }
  return malus;
}

/** Every stretch of malus months must be followed by at least as many clean ones. */
function assertRecovers(malus: Set<number>, months: number) {
  let m = 0;
  while (m < months) {
    if (!malus.has(m)) { m++; continue; }
    const start = m;
    while (malus.has(m)) m++;
    const length = m - start;
    if (m + length > months) break; // the run at the very end has not had its time yet
    for (let clean = m; clean < m + length; clean++) {
      assert.equal(malus.has(clean), false, `a run of ${length} months from ${start} is not followed by ${length} clean ones`);
    }
  }
}

test('even with as much bad luck as possible, no more than half the months are hit', () => {
  const months = 2400; // two hundred years
  for (const [chanceEvent, chanceOneTime] of [[1, 1], [0, 1], [1, 0], [0.3, 0.9], [0.05, 1], [0.5, 0.5]]) {
    for (const seed of [1, 2, 3]) {
      const malus = play(months, seed, chanceEvent, chanceOneTime);
      assertRecovers(malus, months);
      const share = malus.size / months;
      // The rule holds at the end of every recovery; a run in progress at the very end may lean over by a few months.
      assert.ok(share <= 0.5 + 6 / months, `events ${chanceEvent}, one-time ${chanceOneTime}, seed ${seed}: ${(share * 100).toFixed(1)}% of months`);
    }
  }
});

test('one-time bad luck alone is at its worst every other month, which is exactly half', () => {
  const malus = play(1200, 9, 0, 1);
  assert.equal(malus.size, 600);
  for (let m = 1; m <= 1200; m++) assert.equal(malus.has(m), m % 2 === 1, `${m}`);
});

test('a small airline with little bad luck is left alone by the ceiling', () => {
  // Rare bad luck rarely meets a closed month, so the ceiling is never the thing that decides.
  const malus = play(2400, 5, 0.01, 0.05);
  const share = malus.size / 2400;
  assert.ok(share > 0.02 && share < 0.25, `${(share * 100).toFixed(1)}%`);
});
