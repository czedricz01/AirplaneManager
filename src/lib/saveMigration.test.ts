import test from 'node:test';
import assert from 'node:assert/strict';

import { migrateSave, SAVE_VERSION } from './saveMigration';
import { findNonFinite } from './invariants';

const oldSave = () => ({
  airlineName: 'Test Air',
  capital: 1_000_000,
  selectedHub: 'FRA',
  currentDateOffset: 12,
  fleet: [
    // Written before interior/airframe condition and cabin quality existed.
    { registration: 'D-ABCD', id: '737-100', type: '737-100', manufacturer: 'Boeing', capacity: 100, popularity: 60, cruiseSpeed: 800 }
  ],
  routes: [
    {
      id: 'r1', origin: 'FRA', destination: 'CDG', aircraft: 'D-ABCD', distance: '450',
      schedule: [{ dayId: 1, startHour: 8, startMin: 0, durMin: NaN, turnoverMin: 60 }]
    },
    { id: 'broken' } // no endpoints: unusable
  ],
  airportManagement: { FRA: { level: 2, slots: { narrowbody: 4 } } }
});

test('an old savegame loads without a single non-finite number', () => {
  const migrated = migrateSave(oldSave());
  assert.deepEqual(findNonFinite(migrated, 6), []);
  assert.equal(migrated.saveVersion, SAVE_VERSION);
});

test('missing aircraft fields get neutral defaults', () => {
  const plane = migrateSave(oldSave()).fleet[0];
  assert.equal(plane.conditionInterior, 100);
  assert.equal(plane.conditionGeneral, 100);
  assert.equal(plane.baseInteriorPop, 50);
  assert.equal(plane.config.economy, 100);
});

test('NaN schedule legs are recomputed from the airports and the aircraft', () => {
  const route = migrateSave(oldSave()).routes[0];
  assert.ok(route.schedule[0].durMin > 30 && route.schedule[0].durMin < 120, `got ${route.schedule[0].durMin}`);
  assert.equal(route.distance, 450);
});

test('unusable routes are dropped instead of crashing a screen later', () => {
  const routes = migrateSave(oldSave()).routes;
  assert.deepEqual(routes.map((r: any) => r.id), ['r1']);
});

test('a save without an inbox starts with the welcome message, not the previous game', () => {
  const migrated = migrateSave(oldSave());
  assert.equal(migrated.messages.length, 1);
  assert.equal(migrated.messages[0].id, 1);
});

test('duplicate message ids are made unique and the inbox is capped', () => {
  const messages = Array.from({ length: 250 }, (_, i) => ({ id: i < 2 ? 7 : 100 + i, text: `m${i}`, isRead: true, dateStr: '01/1960' }));
  const migrated = migrateSave({ ...oldSave(), messages });
  const ids = migrated.messages.map((m: any) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(migrated.messages.length, 200);
});

test('infrastructure gains the fields the economy reads', () => {
  const infra = migrateSave(oldSave()).airportManagement.FRA;
  assert.deepEqual(infra.slots, { regional: 0, narrowbody: 4, widebody: 0 });
  assert.deepEqual(infra.desks, { normal: 0, self: 0 });
});

test('the input is not modified', () => {
  const raw = oldSave();
  const snapshot = JSON.stringify(raw);
  migrateSave(raw);
  assert.equal(JSON.stringify(raw), snapshot);
});

test('garbage is rejected with a clear error', () => {
  assert.throws(() => migrateSave(null), /empty/);
});

test('engine internals stored on routes by older versions are removed', () => {
  const raw = oldSave();
  (raw.routes[0] as any).costsBreakdown = { fuel: 1 };
  (raw.routes[0] as any).demandData = { total: 1 };
  (raw.routes[0] as any).satisfactionDetails = { economy: {} };
  (raw.routes[0] as any).paxPerWeek = 700;
  const route = migrateSave(raw).routes[0];
  assert.equal(route.costsBreakdown, undefined);
  assert.equal(route.demandData, undefined);
  assert.equal(route.satisfactionDetails, undefined);
  assert.equal(route.paxPerWeek, 700, 'the figures screens read are kept');
});
