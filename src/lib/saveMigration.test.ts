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

// --- Version 3 ---------------------------------------------------------------

import { MAP_YELLOW, RIVAL_PALETTE } from './theme';
import { DEFAULT_STAFF, FREE_OPTION_ID } from './gameState';

const v2Save = () => ({
  ...oldSave(),
  saveVersion: 2,
  aiAirlines: [
    { id: 'ai_lh', name: 'Lufthansa', code: 'LH', hub: 'FRA', capital: 1, fleet: [], routes: [], monthlyProfitsHistory: [] },
    { id: 'ai_af', name: 'Air France', code: 'AF', hub: 'CDG', capital: 1, fleet: [], routes: [], monthlyProfitsHistory: [] },
    { id: 'ai_ba', name: 'British Airways', code: 'BA', hub: 'LHR', capital: 1, fleet: [], routes: [], monthlyProfitsHistory: [], color: '#123456' }
  ]
});

test('a version 2 save gets the version 3 systems at their defaults', () => {
  const migrated = migrateSave(v2Save());
  assert.equal(migrated.saveVersion, 3);
  assert.deepEqual(migrated.branding, { color: MAP_YELLOW, icon: 'initials' }, 'the airline keeps the yellow it always had');
  assert.deepEqual(migrated.marketing, { campaigns: [], ffpActive: false, ffpSinceOffset: null });
  assert.deepEqual(migrated.staff, DEFAULT_STAFF);
  assert.deepEqual(migrated.disruptions, []);
  assert.deepEqual(migrated.pendingDecisions, []);
  assert.deepEqual(migrated.chronicle, []);
  assert.equal(migrated.scenario, null);
  assert.equal(migrated.tutorialStep, null, 'an existing player is not sent through the tutorial');
  assert.deepEqual(findNonFinite(migrated, 6), []);
});

test('rivals from a version 2 save get distinct palette colours, the same ones every load', () => {
  const [lh, af, ba] = migrateSave(v2Save()).aiAirlines;
  assert.ok((RIVAL_PALETTE as readonly string[]).includes(lh.color));
  assert.ok((RIVAL_PALETTE as readonly string[]).includes(af.color));
  assert.notEqual(lh.color, af.color);
  assert.equal(ba.color, '#123456', 'a colour already chosen is kept');
  assert.equal(migrateSave(v2Save()).aiAirlines[0].color, lh.color, 'deterministic');
});

test('broken version 3 fields are repaired rather than trusted', () => {
  const migrated = migrateSave({
    ...v2Save(),
    branding: { color: 'red', icon: 7 },
    staff: { salaryPct: 500, morale: NaN, strike: { startOffset: 3, cancelShare: 4 } },
    pendingDecisions: [
      { id: 'd1', kind: 'strike', ref: '3', title: 'Strike', options: [{ id: 'a', label: 'Pay', cost: NaN }] },
      { id: 'd2', kind: 'strike', title: 'Nothing to choose', options: [] },
      { id: 'd3', kind: 'unknown', title: 'From the future', options: [{ id: 'a', label: 'OK' }] }
    ],
    chronicle: Array.from({ length: 400 }, (_, i) => ({ offset: i, kind: 'record', text: `r${i}` })),
    tutorialStep: 2.4
  });
  assert.equal(migrated.branding.color, MAP_YELLOW);
  assert.equal(migrated.branding.icon, 'initials');
  assert.equal(migrated.staff.salaryPct, 130);
  assert.equal(migrated.staff.morale, 70);
  assert.equal(migrated.staff.strike.cancelShare, 1);
  assert.deepEqual(migrated.pendingDecisions.map((d: any) => d.id), ['d1']);
  assert.equal(migrated.pendingDecisions[0].options[0].cost, 0);
  assert.equal(migrated.chronicle.length, 300);
  assert.equal(migrated.chronicle[0].offset, 100, 'the oldest entries go first');
  assert.equal(migrated.tutorialStep, 2);
});

test('chronicle keys and record values survive a load, and keyed firsts outlast trimming', () => {
  const migrated = migrateSave({
    ...v2Save(),
    chronicle: [
      { offset: 1, kind: 'network', text: 'First route to Asia', key: 'region:AS' },
      { offset: 2, kind: 'record', text: 'Best month', key: 'record:profit', value: 5e5 },
      { offset: 3, kind: 'record', text: 'Odd', key: 42, value: 'much' },
      ...Array.from({ length: 300 }, (_, i) => ({ offset: 10 + i, kind: 'crisis', text: `c${i}` }))
    ]
  });
  assert.equal(migrated.chronicle.length, 300);
  assert.deepEqual(migrated.chronicle[0], { offset: 1, kind: 'network', text: 'First route to Asia', key: 'region:AS' });
  assert.deepEqual(migrated.chronicle[1], { offset: 2, kind: 'record', text: 'Best month', key: 'record:profit', value: 5e5 });
  assert.equal(migrated.chronicle.some((e: any) => e.text === 'Odd'), false, 'unkeyed, so trimmed first');
});

test('a loaded decision with only paid answers gets a free one', () => {
  const migrated = migrateSave({
    ...v2Save(),
    staff: { salaryPct: 80, morale: 20, strike: { startOffset: 12, cancelShare: 1 } },
    pendingDecisions: [
      { id: 'd1', kind: 'strike', ref: '12', title: 'Strike', options: [{ id: 'buy-peace', label: 'Buy peace', cost: 5_000_000 }] }
    ]
  });
  const options = migrated.pendingDecisions[0].options;
  assert.equal(options.length, 2);
  assert.equal(options[0].id, 'buy-peace');
  assert.equal(options[1].id, FREE_OPTION_ID);
  assert.equal(options[1].cost, 0);

  // A charter is billed at the month's close: a saved up-front price would be paid twice.
  const charter = migrateSave({
    ...v2Save(),
    disruptions: [{ id: 'dis1', kind: 'technical', offset: 12, routeIds: ['r1'], cancelShare: 0.25 }],
    pendingDecisions: [{ id: 'd1', kind: 'disruption', ref: 'dis1', title: 'Charter?', options: [
      { id: 'charter', label: 'Charter', cost: 300_000 },
      { id: 'cancel', label: 'Cancel', cost: 0 }
    ] }]
  });
  assert.deepEqual(charter.pendingDecisions[0].options.map((o: any) => o.cost), [0, 0]);
});

test('strikes and disruptions dated after the current month are dropped, and so are questions about them', () => {
  // The save is at month 12: whatever a close rolls is for the month it moves to, never beyond.
  const migrated = migrateSave({
    ...v2Save(),
    staff: { salaryPct: 90, morale: 30, strike: { startOffset: 5000, cancelShare: 1 } },
    disruptions: [
      { id: 'now', kind: 'technical', offset: 12, routeIds: ['r1'], cancelShare: 0.25 },
      { id: 'future', kind: 'weather', offset: 13, routeIds: ['r1'], cancelShare: 0.15 }
    ],
    pendingDecisions: [
      { id: 'q-strike', kind: 'strike', ref: '5000', title: 'Strike', options: [{ id: 'sit-out', label: 'Sit out', cost: 0 }] },
      { id: 'q-now', kind: 'disruption', ref: 'now', title: 'Defect', options: [{ id: 'cancel', label: 'Cancel', cost: 0 }] },
      { id: 'q-future', kind: 'disruption', ref: 'future', title: 'Weather', options: [{ id: 'cancel', label: 'Cancel', cost: 0 }] },
      { id: 'q-gone', kind: 'disruption', ref: 'gone', title: 'Old', options: [{ id: 'cancel', label: 'Cancel', cost: 0 }] }
    ]
  });
  assert.equal(migrated.staff.strike, null);
  assert.deepEqual(migrated.disruptions.map((d: any) => d.id), ['now']);
  assert.deepEqual(migrated.pendingDecisions.map((d: any) => d.id), ['q-now']);

  const settled = migrateSave({ ...v2Save(), staff: { salaryPct: 100, morale: 40, strike: { startOffset: 12, cancelShare: 0.5, agreedPct: 400 } } });
  assert.equal(settled.staff.strike.agreedPct, 130, 'agreed pay is kept inside the range');
  const plain = migrateSave({ ...v2Save(), staff: { salaryPct: 100, morale: 40, strike: { startOffset: 12, cancelShare: 1, agreedPct: 'lots' } } });
  assert.equal('agreedPct' in plain.staff.strike, false);
});
