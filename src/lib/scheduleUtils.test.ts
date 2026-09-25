import test from 'node:test';
import assert from 'node:assert/strict';

import {
  blockMinutes,
  checkOverlap,
  findCommonRunStart,
  findDayRunStart,
  findMaxFlightStarts,
  maxFlightStarts,
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

test('maxFlightStarts places as many blocks as the search found, none overlapping', () => {
  const occupied: Interval[] = [{ start: 600, end: 900 }, { start: 5000, end: 5400 }];
  const cyc = 240;
  const { bestCount } = findMaxFlightStarts(occupied, cyc, 100);
  const starts = maxFlightStarts(occupied, cyc, 100);
  assert.equal(starts.length, bestCount);
  for (const s of starts) {
    for (const o of occupied) assert.equal(checkOverlap(s, s + cyc, o.start, o.end), false);
  }
  for (let i = 0; i < starts.length; i++) {
    for (let j = i + 1; j < starts.length; j++) {
      assert.equal(checkOverlap(starts[i], starts[i] + cyc, starts[j], starts[j] + cyc), false);
    }
  }
});

test('maxFlightStarts respects the slot limit and starts at the preferred time on an empty aircraft', () => {
  const starts = maxFlightStarts([], 300, 5, 480);
  assert.equal(starts.length, 5);
  assert.equal(starts[0], 480);
  assert.deepEqual(maxFlightStarts([], 300, 0), []);
});

test('findDayRunStart keeps the preferred time when it is free', () => {
  assert.equal(findDayRunStart(3, 2, 200, [], 480), 2 * 1440 + 480);
});

test('findDayRunStart moves the run past a busy block on the same day', () => {
  // Tuesday 09:00-12:00 is taken; two 120-minute trips wanted from 08:00.
  const busy: Interval[] = [{ start: 1440 + 540, end: 1440 + 720 }];
  const start = findDayRunStart(2, 2, 120, busy, 480);
  assert.ok(start !== null);
  for (let op = 0; op < 2; op++) {
    const s = start! + op * 120;
    assert.equal(checkOverlap(s, s + 120, busy[0].start, busy[0].end), false);
  }
  assert.equal(start, 1440 + 720);
});

test('findDayRunStart returns null when the week is full', () => {
  assert.equal(findDayRunStart(1, 1, 60, [{ start: 0, end: WEEK_MIN }], 0), null);
});

test('findCommonRunStart finds one time of day that fits every day', () => {
  // Every day 06:00-10:00 is taken.
  const busy: Interval[] = [1, 2, 3, 4, 5, 6, 7].map(d => ({ start: (d - 1) * 1440 + 360, end: (d - 1) * 1440 + 600 }));
  const t = findCommonRunStart([1, 2, 3, 4, 5, 6, 7], 1, 180, busy, 420);
  assert.equal(t, 600);
  assert.equal(findCommonRunStart([1, 2], 2, 800, [], 0), null);
});

