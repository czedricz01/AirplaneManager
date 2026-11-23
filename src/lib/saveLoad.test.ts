import test from 'node:test';
import assert from 'node:assert/strict';

import { loadSave, OutdatedSaveError, SAVE_VERSION } from './saveLoad';
import { findNonFinite } from './invariants';
import { FREE_OPTION_ID } from './gameState';

const save = () => ({
  saveVersion: SAVE_VERSION,
  airlineName: 'Test Air',
  capital: 1_000_000,
  selectedHub: 'FRA',
  currentDateOffset: 12,
  fleet: [
    { registration: 'D-ABCD', id: '737-100', capacity: 100, conditionGeneral: NaN, config: { economy: 100, premium: 0, business: 0, first: 0, details: {} } }
  ],
  routes: [
    {
      id: 'r1', origin: 'FRA', destination: 'CDG', aircraft: 'D-ABCD', distance: '450',
      schedule: [{ dayId: 1, startHour: 8, startMin: 0, durMin: 75, turnoverMin: 60 }]
    },
    { id: 'broken' } // no endpoints: unusable
  ],
  aiAirlines: [],
  airportManagement: { FRA: { level: 2, slots: { narrowbody: 4 } } },
  career: { mode: 'normal', rank: 3, careerPax: 1000, research: { done: [], active: [] } }
});

test('a save of an older version is refused with OutdatedSaveError (E75)', () => {
  for (const version of [undefined, 1, 7]) {
    assert.throws(() => loadSave({ ...save(), saveVersion: version }), (e: unknown) =>
      e instanceof OutdatedSaveError && e.version === (version ?? 1));
  }
});

test('a save of a newer version is refused, but not as outdated', () => {
  assert.throws(() => loadSave({ ...save(), saveVersion: SAVE_VERSION + 1 }), (e: unknown) =>
    e instanceof Error && !(e instanceof OutdatedSaveError) && /newer/.test(e.message));
});

test('garbage is rejected with a clear error', () => {
  assert.throws(() => loadSave(null), /empty/);
});

test('a current save loads without a single non-finite number', () => {
  const loaded = loadSave(save());
  assert.deepEqual(findNonFinite(loaded, 6), []);
  assert.equal(loaded.saveVersion, SAVE_VERSION);
  assert.equal(loaded.fleet[0].conditionGeneral, 100);
  assert.equal(loaded.routes[0].distance, 450);
});

test('unusable routes are dropped instead of crashing a screen later', () => {
  assert.deepEqual(loadSave(save()).routes.map((r: any) => r.id), ['r1']);
});

test('a save without an inbox starts with the welcome message', () => {
  const loaded = loadSave(save());
  assert.equal(loaded.messages.length, 1);
});

test('infrastructure gets every field the economy reads', () => {
  const infra = loadSave(save()).airportManagement.FRA;
  assert.deepEqual(infra.slots, { regional: 0, narrowbody: 4, widebody: 0 });
  assert.deepEqual(infra.desks, { normal: 0, self: 0 });
});

test('the career is kept, with the rank clamped', () => {
  const loaded = loadSave(save());
  assert.equal(loaded.career.rank, 3);
  assert.equal(loaded.career.careerPax, 1000);
  assert.equal(loadSave({ ...save(), career: { rank: 99 } }).career.rank, 9);
});

test('the input is not modified', () => {
  const raw = save();
  const snapshot = JSON.stringify(raw);
  loadSave(raw);
  assert.equal(JSON.stringify(raw), snapshot);
});

test('a loaded decision with only paid answers gets a free one', () => {
  const loaded = loadSave({
    ...save(),
    staff: { salaryPct: 80, morale: 20, strike: { startOffset: 12, cancelShare: 1 } },
    pendingDecisions: [
      { id: 'd1', kind: 'strike', ref: '12', title: 'Strike', options: [{ id: 'buy-peace', label: 'Buy peace', cost: 5_000_000 }] }
    ]
  });
  assert.deepEqual(loaded.pendingDecisions[0].options.map((o: any) => o.id), ['buy-peace', FREE_OPTION_ID]);
});

test('strikes and disruptions dated after the current month are dropped, and so are questions about them', () => {
  const loaded = loadSave({
    ...save(),
    staff: { salaryPct: 90, morale: 30, strike: { startOffset: 5000, cancelShare: 1 } },
    disruptions: [
      { id: 'now', kind: 'technical', offset: 12, routeIds: ['r1'], cancelShare: 0.25 },
      { id: 'future', kind: 'weather', offset: 13, routeIds: ['r1'], cancelShare: 0.15 }
    ],
    pendingDecisions: [
      { id: 'q-now', kind: 'disruption', ref: 'now', title: 'Defect', options: [{ id: 'cancel', label: 'Cancel', cost: 0 }] },
      { id: 'q-future', kind: 'disruption', ref: 'future', title: 'Weather', options: [{ id: 'cancel', label: 'Cancel', cost: 0 }] }
    ]
  });
  assert.equal(loaded.staff.strike, null);
  assert.deepEqual(loaded.disruptions.map((d: any) => d.id), ['now']);
  assert.deepEqual(loaded.pendingDecisions.map((d: any) => d.id), ['q-now']);
});

test('a scenario the game no longer knows is played on as a free game', () => {
  assert.equal(loadSave({ ...save(), scenario: { id: 'moon-landing' } }).scenario, null);
  const tracked = loadSave({ ...save(), scenario: { id: 'jet-age', startedOffset: 0, status: 'running', floorStreak: 2, met: ['capital', 7] } });
  assert.equal(tracked.scenario.floorStreak, 2);
  assert.deepEqual(tracked.scenario.met, ['capital']);
});
