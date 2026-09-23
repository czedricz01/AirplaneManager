import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plannerReducer as reduce, initialPlannerSelection as init, PlannerSelection } from './plannerState';
import type { ScheduledTrip } from '../RouteScheduleEditView';

const trip = (id: string): ScheduledTrip => ({
  id, dayId: 1, startHour: 8, startMin: 0, durMin: 95, turnoverMin: 45,
  flightNumOut: '1', flightNumIn: '2'
} as ScheduledTrip);

const planned = (): PlannerSelection => init({
  originId: 'FRA', destId: 'CDG', selectedReg: 'D-AAAA',
  schedule: [trip('a'), trip('b')], validationMsg: 'stale'
});

test('changing an endpoint clears the schedule, the stash and the message at once', () => {
  const s = planned();
  const t = reduce(s, { type: 'selectDest', destId: 'LHR' });
  assert.equal(t.schedule.length, 0);
  assert.equal(t.stashedSchedule.length, 0);
  assert.equal(t.validationMsg, null);
  // The aircraft is still fine for a different destination, so it stays.
  assert.equal(t.selectedReg, 'D-AAAA');

  const u = reduce(s, { type: 'selectOrigin', originId: 'MUC' });
  assert.equal(u.schedule.length, 0);
  assert.equal(u.stashedSchedule.length, 0);
  assert.equal(u.validationMsg, null);
});

test('re-selecting the same value is a no-op by identity', () => {
  const s = planned();
  assert.equal(reduce(s, { type: 'selectDest', destId: 'CDG' }), s);
  assert.equal(reduce(s, { type: 'selectOrigin', originId: 'FRA' }), s);
  assert.equal(reduce(s, { type: 'selectAircraft', reg: 'D-AAAA' }), s);
  assert.equal(reduce(s, { type: 'setStep', step: s.step }), s);
});

test('swapping aircraft keeps the timetable and re-times it', () => {
  const s = planned();

  // The UI deselects first, then picks a replacement.
  const off = reduce(s, { type: 'selectAircraft', reg: null });
  assert.equal(off.schedule.length, 0, 'nothing shown while none is selected');
  assert.equal(off.stashedSchedule.length, 2, 'but the week is not thrown away');

  const on = reduce(off, {
    type: 'selectAircraft', reg: 'D-BBBB', adapt: { durMin: 70, turnoverMin: 30 }
  });
  assert.equal(on.schedule.length, 2);
  assert.ok(on.schedule.every(t => t.durMin === 70 && t.turnoverMin === 30));
  assert.equal(on.selectedReg, 'D-BBBB');
});

test('an aircraft that cannot fly the route carries its reason', () => {
  const off = reduce(planned(), { type: 'selectAircraft', reg: null });
  const on = reduce(off, {
    type: 'selectAircraft', reg: 'D-CCCC',
    adapt: { durMin: 70, turnoverMin: 30 },
    validationMsg: 'AIRCRAFT RANGE VIOLATION'
  });
  assert.equal(on.validationMsg, 'AIRCRAFT RANGE VIOLATION');
});

test('with no timetable to restore the schedule stays empty', () => {
  const blank = init({ originId: 'FRA', destId: 'CDG' });
  const t = reduce(blank, {
    type: 'selectAircraft', reg: 'D-DDDD', adapt: { durMin: 70, turnoverMin: 30 }
  });
  assert.equal(t.schedule.length, 0);
});

test('setting a schedule keeps the stash current, clearing it does not wipe the stash', () => {
  const blank = init({ originId: 'FRA', destId: 'CDG' });
  const filled = reduce(blank, { type: 'setSchedule', schedule: [trip('q')] });
  assert.equal(filled.stashedSchedule.length, 1);

  const cleared = reduce(filled, { type: 'setSchedule', schedule: [] });
  assert.equal(cleared.schedule.length, 0);
  assert.equal(cleared.stashedSchedule.length, 1, 'a later swap can still restore it');
});

test('the reducer never mutates what it is given', () => {
  const s = planned();
  const before = JSON.stringify(s);
  reduce(s, { type: 'selectOrigin', originId: 'MUC' });
  reduce(s, { type: 'selectAircraft', reg: null });
  reduce(s, { type: 'setSchedule', schedule: [trip('z')] });
  reduce(s, { type: 'hydrate', patch: { step: 4 } });
  assert.equal(JSON.stringify(s), before);
});
