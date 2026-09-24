import test from 'node:test';
import assert from 'node:assert/strict';

import {
  blockMinutes,
  checkOverlap,
  findMaxFlightStarts,
  getTurnoverMinutes,
  getUsedWeeklySlots,
  minuteToTripStart,
  occupiedIntervals,
  tripInterval,
  Interval,
  WEEK_MIN
} from './scheduleUtils';

/** The planner's search as it was before (RoutePlannerView), kept as the reference. */
function referenceSearch(occupied: Interval[], cycleMin: number, remainingSlots: number) {
  let bestCount = -1;
  let bestStartTimes: number[] = [];
  for (let testStart = 0; testStart < WEEK_MIN; testStart += 5) {
    let searchTime = testStart;
    let added = 0;
    let i = 0;
    const localOccupied = [...occupied];
    while (added < remainingSlots && i < 2100) {
      i++;
      const candidateStart = searchTime % WEEK_MIN;
      const candidateEnd = candidateStart + cycleMin;
      let conflict = false;
      for (const occ of localOccupied) {
        if (checkOverlap(candidateStart, candidateEnd, occ.start, occ.end)) { conflict = true; break; }
      }
      if (!conflict) {
        localOccupied.push({ start: candidateStart, end: candidateEnd });
        added++;
        searchTime += cycleMin;
      } else {
        searchTime += 5;
      }
      if (searchTime >= testStart + WEEK_MIN) break;
    }
    if (added > bestCount) { bestCount = added; bestStartTimes = [testStart]; }
    else if (added === bestCount) bestStartTimes.push(testStart);
  }
  return { bestCount, bestStartTimes };
}

/** Small deterministic PRNG so the comparison is reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

test('the fast Max Flights search returns exactly what the original did', () => {
  const rand = rng(42);
  for (let round = 0; round < 12; round++) {
    const blocks = Math.floor(rand() * 18);
    const occupied: Interval[] = [];
    for (let b = 0; b < blocks; b++) {
      const start = Math.floor(rand() * (WEEK_MIN / 5)) * 5;
      const len = 60 + Math.floor(rand() * 60) * 5;
      occupied.push({ start, end: start + len });
    }
    const cycle = 90 + Math.floor(rand() * 60) * 5;
    const slots = 1 + Math.floor(rand() * 40);
    assert.deepEqual(findMaxFlightStarts(occupied, cycle, slots), referenceSearch(occupied, cycle, slots), `round ${round}`);
  }
});

test('blocks follow the boarding / legs / turnaround convention and round to 5', () => {
  assert.equal(blockMinutes({ durMin: 61, turnoverMin: 60 }), 245); // 30+61+60+61+30 = 242 -> 245
  assert.equal(blockMinutes({ durMin: 61, turnoverMin: 60, isOneWay: true }), 125); // 30+61+30 = 121 -> 125
});

test('turnaround depends on the aircraft class', () => {
  assert.equal(getTurnoverMinutes('Regional'), 30);
  assert.equal(getTurnoverMinutes('Narrowbody'), 60);
  assert.equal(getTurnoverMinutes('widebody'), 90);
});

test('blocks overlap across Sunday midnight', () => {
  const sundayNight = tripInterval({ dayId: 7, startHour: 23, startMin: 0, durMin: 60, turnoverMin: 60 });
  const mondayMorning = tripInterval({ dayId: 1, startHour: 0, startMin: 30, durMin: 60, turnoverMin: 60 });
  assert.ok(checkOverlap(sundayNight.start, sundayNight.end, mondayMorning.start, mondayMorning.end));
  assert.ok(checkOverlap(mondayMorning.start, mondayMorning.end, sundayNight.start, sundayNight.end));
});

test('minuteToTripStart wraps into the week', () => {
  assert.deepEqual(minuteToTripStart(WEEK_MIN + 65), { dayId: 1, startHour: 1, startMin: 5 });
  assert.deepEqual(minuteToTripStart(-5), { dayId: 7, startHour: 23, startMin: 55 });
});

test('slots are counted per aircraft class, excluding the route being edited', () => {
  const fleet = new Map([['A', { class: 'Regional' }], ['B', { class: 'Narrowbody' }]]);
  const routes = [
    { id: 'r1', origin: 'FRA', destination: 'CDG', aircraft: 'A', schedule: [1, 2, 3] },
    { id: 'r2', origin: 'MUC', destination: 'FRA', aircraft: 'B', schedule: [1, 2] },
    { id: 'r3', origin: 'FRA', destination: 'LHR', aircraft: 'B', schedule: [1] }
  ];
  assert.equal(getUsedWeeklySlots(routes, fleet, 'FRA', 'narrowbody'), 3);
  assert.equal(getUsedWeeklySlots(routes, fleet, 'FRA', 'Regional'), 3);
  assert.equal(getUsedWeeklySlots(routes, fleet, 'FRA', 'narrowbody', 'r2'), 1);
});

test('occupiedIntervals skips other aircraft and the excluded route', () => {
  const trip = { dayId: 2, startHour: 8, startMin: 0, durMin: 60, turnoverMin: 60 };
  const routes = [
    { id: 'a', aircraft: 'X', schedule: [trip] },
    { id: 'b', aircraft: 'X', schedule: [trip, trip] },
    { id: 'c', aircraft: 'Y', schedule: [trip] }
  ];
  assert.equal(occupiedIntervals(routes, 'X').length, 3);
  assert.equal(occupiedIntervals(routes, 'X', 'b').length, 1);
});
