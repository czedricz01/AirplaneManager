import test from 'node:test';
import assert from 'node:assert/strict';

import type { Airport } from '../data/airportTypes';
import {
  AssignmentContext,
  PlaneLike,
  RouteLike,
  checkReassignment,
  findOpenShifts,
  idleAircraft,
  nearestShift,
  openShiftWindows,
  shiftTrips,
  timetablePeriod
} from './aircraftAssignment';
import { WEEK_MIN, blockMinutes, tripStartMinute } from './scheduleUtils';

const airport = (id: string, lat: number, lon: number, maxIcaoCode: Airport['maxIcaoCode'] = 'F'): Airport =>
  ({ id, name: id, coords: [lat, lon], level: 5, maxIcaoCode, stats: null });

const AIRPORTS = new Map<string, Airport>([
  ['FRA', airport('FRA', 50.03, 8.57)],
  ['LHR', airport('LHR', 51.47, -0.45)],
  ['JFK', airport('JFK', 40.64, -73.78)],
  ['SYL', airport('SYL', 54.91, 8.34, 'C')]
]);

const plane = (registration: string, over: Partial<PlaneLike> = {}): PlaneLike => ({
  registration,
  manufacturer: 'Airbus',
  type: 'A320',
  class: 'Narrowbody',
  maxRange: 6000,
  cruiseSpeed: 830,
  icaoCode: 'C',
  capacity: 180,
  config: { first: 0, business: 12, premium: 0, economy: 150 },
  ...over
});

/** A daily round trip starting its block at `hour`:00. */
const daily = (hour: number, durMin: number, turnoverMin = 60) =>
  [1, 2, 3, 4, 5, 6, 7].map(dayId => ({
    id: `t${dayId}-${hour}`,
    flightNumOut: '100',
    flightNumIn: '101',
    dayId,
    startHour: hour,
    startMin: 0,
    durMin,
    turnoverMin
  }));

const route = (id: string, aircraft: string, over: Partial<RouteLike> = {}): RouteLike => ({
  id,
  origin: 'FRA',
  destination: 'LHR',
  aircraft,
  airlineCode: 'NE',
  durMin: 80,
  turnoverMin: 60,
  schedule: daily(8, 80),
  ...over
});

const ctx = (routes: RouteLike[], fleet: PlaneLike[], slots: Record<string, Record<string, number>> = {}): AssignmentContext => ({
  routes,
  fleet,
  airports: AIRPORTS,
  airportManagement: Object.fromEntries(
    ['FRA', 'LHR', 'JFK', 'SYL'].map(id => [id, { slots: { regional: 50, narrowbody: 50, widebody: 50, ...(slots[id] || {}) } }])
  )
});

test('a twin aircraft takes over every route at the same times', () => {
  const old = plane('D-AAAA');
  const twin = plane('D-BBBB');
  const routes = [route('r1', 'D-AAAA'), route('r2', 'D-AAAA', { schedule: daily(14, 80) })];
  const res = checkReassignment(routes, twin, ctx(routes, [old, twin]));

  assert.equal(res.ok, true, JSON.stringify(res.issues));
  assert.equal(res.patches.length, 2);
  for (const p of res.patches) {
    assert.equal(p.aircraft, 'D-BBBB');
    assert.equal(p.weeklyFlights, 7);
  }
  assert.deepEqual(
    res.patches[1].schedule.map(t => tripStartMinute(t)),
    routes[1].schedule!.map(t => tripStartMinute(t))
  );
});

test('the leg time and turnaround follow the new aircraft', () => {
  const old = plane('D-AAAA');
  const turboprop = plane('D-CCCC', { class: 'Regional', cruiseSpeed: 500 });
  const routes = [route('r1', 'D-AAAA')];
  const res = checkReassignment(routes, turboprop, ctx(routes, [old, turboprop]));

  const p = res.patches[0];
  assert.ok(p.durMin > 80, `slower aircraft should need longer than 80 min, got ${p.durMin}`);
  assert.equal(p.turnoverMin, 30);
  assert.ok(p.schedule.every(t => t.durMin === p.durMin && t.turnoverMin === 30));
  assert.ok(res.notes.some(n => n.kind === 'flight-time'));
});

test('too little range is refused and says by how much', () => {
  const old = plane('D-AAAA', { maxRange: 9000 });
  const shortHaul = plane('D-BBBB', { maxRange: 3000 });
  const routes = [route('r1', 'D-AAAA', { destination: 'JFK', schedule: daily(8, 500) })];
  const res = checkReassignment(routes, shortHaul, ctx(routes, [old, shortHaul]));

  assert.equal(res.ok, false);
  const issue = res.issues.find(i => i.kind === 'range');
  assert.ok(issue);
  assert.match(issue!.message, /3,000 km at most/);
});

test('an airport too small for the aircraft is refused', () => {
  const old = plane('D-AAAA');
  const widebody = plane('D-WIDE', { class: 'Widebody', icaoCode: 'E' });
  const routes = [route('r1', 'D-AAAA', { destination: 'SYL' })];
  const res = checkReassignment(routes, widebody, ctx(routes, [old, widebody]));

  assert.ok(res.issues.some(i => i.kind === 'runway' && i.message.includes('SYL')));
});

test('an aircraft based at another hub is refused; one without a hub is fine', () => {
  const old = plane('D-AAAA');
  const routes = [route('r1', 'D-AAAA')];

  const elsewhere = plane('D-BBBB', { hubId: 'LHR' });
  const res = checkReassignment(routes, elsewhere, ctx(routes, [old, elsewhere]));
  assert.ok(res.issues.some(i => i.kind === 'hub'));

  const sameHub = plane('D-CCCC', { hubId: 'FRA' });
  assert.equal(checkReassignment(routes, sameHub, ctx(routes, [old, sameHub])).ok, true);
});

test('flights that only fit back to back on the faster aircraft are reported as overlapping', () => {
  const old = plane('D-AAAA');
  const slow = plane('D-SLOW', { cruiseSpeed: 350 });
  // Two daily FRA-LHR rotations with a tight gap: 08:00 and exactly one block later.
  const first = route('r1', 'D-AAAA');
  const gap = blockMinutes(first.schedule![0]) / 60;
  const routes = [first, route('r2', 'D-AAAA', { schedule: daily(8 + Math.ceil(gap), 80) })];
  const res = checkReassignment(routes, slow, ctx(routes, [old, slow]));

  assert.equal(res.ok, false);
  const issue = res.issues.find(i => i.kind === 'timetable');
  assert.ok(issue);
  assert.match(issue!.message, /overlap/);
  assert.match(issue!.message, /and \d+ more/, 'a long list is cut short');
});

test('a class change needs slots of the new class; the same class never does', () => {
  const old = plane('D-AAAA');
  const regional = plane('D-REG', { class: 'Regional' });
  const routes = [route('r1', 'D-AAAA')];

  const tight = ctx(routes, [old, regional], { LHR: { regional: 3, narrowbody: 0 } });
  const res = checkReassignment(routes, regional, tight);
  const slot = res.issues.find(i => i.kind === 'slots');
  assert.ok(slot);
  assert.match(slot!.message, /LHR: 7 regional slots per week needed, 3 rented/);

  // Already over the narrowbody limit before the move: not the move's fault.
  const twin = plane('D-BBBB');
  const over = ctx(routes, [old, twin], { LHR: { narrowbody: 3 } });
  assert.equal(checkReassignment(routes, twin, over).issues.some(i => i.kind === 'slots'), false);
});

test('notes list fewer seats, lost cabins and removed services', () => {
  const old = plane('D-AAAA', { config: { first: 0, business: 12, premium: 0, economy: 150 } });
  const small = plane('D-SMAL', { config: { first: 0, business: 0, premium: 0, economy: 120 } });
  const routes = [route('r1', 'D-AAAA', {
    classConfigs: { economy: { catering: [['none']], extras: ['wifi_limited'], service: ['none'] } }
  })];
  const res = checkReassignment(routes, small, ctx(routes, [old, small]));

  assert.equal(res.ok, true);
  assert.ok(res.notes.some(n => n.kind === 'seats' && n.message.startsWith('120 seats instead of 162')));
  assert.ok(res.notes.some(n => n.kind === 'cabin' && n.message.includes('business')));
  assert.ok(res.notes.some(n => n.kind === 'service'), 'wifi is dropped on an aircraft without it');
});

test('with allowShift the route moves to the free time closest to its old times', () => {
  const old = plane('D-AAAA');
  const busy = plane('D-BUSY', { hubId: 'FRA' });
  const own = route('mine', 'D-BUSY', { schedule: daily(7, 80) });
  const moving = route('r1', 'D-AAAA');
  const routes = [own, moving];
  const res = checkReassignment([moving], busy, ctx(routes, [old, busy]), { allowShift: true });

  assert.equal(res.ok, true, JSON.stringify(res.issues));
  assert.ok(res.shifts && res.shifts.length > 0);
  assert.notEqual(res.shift, 0, '08:00 collides with the 07:00 rotation, so it has to move');
  const occupiedEnd = 7 * 60 + blockMinutes(own.schedule![0]);
  const firstStart = tripStartMinute(res.patches[0].schedule[0]);
  assert.ok(firstStart >= occupiedEnd || firstStart + blockMinutes(res.patches[0].schedule[0]) <= 7 * 60);
});

test('with allowShift an aircraft without room says so', () => {
  const old = plane('D-AAAA');
  const full = plane('D-FULL');
  // Four daily rotations leave no gap long enough for a fifth.
  const routes = [
    route('a', 'D-FULL', { schedule: daily(0, 250, 60) }),
    route('b', 'D-FULL', { schedule: daily(10, 250, 60) }),
    route('c', 'D-FULL', { schedule: daily(20, 180, 60) }),
    route('r1', 'D-AAAA')
  ];
  const res = checkReassignment([routes[3]], full, ctx(routes, [old, full]), { allowShift: true });
  assert.equal(res.ok, false);
  assert.ok(res.issues.some(i => i.kind === 'timetable' && /no free time/.test(i.message)));
  assert.deepEqual(res.shifts, []);
});

test('findOpenShifts and nearestShift', () => {
  const trips = [{ dayId: 1, startHour: 0, startMin: 0, durMin: 30, turnoverMin: 0, isOneWay: true }]; // 90-minute block
  // Everything but Monday 02:00-04:00 is taken.
  const occupied = [{ start: 240, end: WEEK_MIN + 120 }];
  const shifts = findOpenShifts(trips, occupied);
  assert.deepEqual(shifts, [120, 125, 130, 135, 140, 145, 150]);
  assert.equal(nearestShift(shifts), 120);
  assert.equal(nearestShift([WEEK_MIN - 10, 600]), WEEK_MIN - 10, 'ten minutes earlier beats ten hours later');
  assert.equal(nearestShift([]), undefined);

  const moved = shiftTrips(trips, -30);
  assert.deepEqual([moved[0].dayId, moved[0].startHour, moved[0].startMin], [7, 23, 30]);
});

test('idleAircraft lists only aircraft without routes', () => {
  const fleet = [plane('A'), plane('B'), plane('C')];
  const routes = [route('r', 'B')];
  assert.deepEqual(idleAircraft(fleet, routes, 'A').map(p => p.registration), ['C']);
});

test('timetablePeriod: a day for a daily route, a week for a single flight', () => {
  assert.equal(timetablePeriod(daily(8, 80)), 1440);
  assert.equal(timetablePeriod(daily(8, 80).slice(0, 1)), WEEK_MIN);
  assert.equal(timetablePeriod(daily(8, 80).slice(0, 3)), WEEK_MIN, 'Mon-Wed does not repeat');
  assert.equal(timetablePeriod([]), WEEK_MIN);
});

test('openShiftWindows offers each free stretch of a day once', () => {
  // The aircraft already flies 12:00-16:00 every day.
  const occupied = [1, 2, 3, 4, 5, 6, 7].map(d => ({ start: (d - 1) * 1440 + 720, end: (d - 1) * 1440 + 960 }));
  const trips = daily(8, 60, 60); // 30+60+60+60+30 = 240-minute block from 08:00
  const windows = openShiftWindows(trips, occupied);

  // A block may start from 16:00 until 08:00 the next morning (it then ends
  // 12:00 sharp). Relative to today's 08:00 that is one window across the
  // wrap: from 16 h earlier up to where it is now.
  assert.equal(windows.length, 1);
  assert.equal(windows[0].from, 480 - 1440, 'from 16:00 the day before');
  assert.equal(windows[0].to, 0, 'up to 08:00, where it is now');

  // Nothing booked: the whole day, once.
  assert.deepEqual(openShiftWindows(trips, []), [{ from: 0, to: 1435 }]);
});
