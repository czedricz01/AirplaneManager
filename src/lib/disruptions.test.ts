import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AIRPORT_STRIKE_CHANCE,
  BIRDSTRIKE_CHANCE,
  BIRDSTRIKE_REPAIR_COST,
  DISRUPTION_OPTION_CANCEL,
  DISRUPTION_OPTION_CHARTER,
  DISRUPTION_SPECS,
  MAX_DISRUPTION_DECISIONS,
  WEATHER_CHANCE,
  buildDisruptionDecision,
  cancelReputationPenalty,
  charterCost,
  combineCancelShares,
  describeRouteCancellations,
  disruptionCancelShares,
  disruptionIncidents,
  disruptionRepairCost,
  disruptionsToAsk,
  dropPastDisruptions,
  isWinterIn,
  rollDisruptions,
  technicalDefectChance,
  type DisruptionRoute
} from './disruptions';
import { buildPlayerModifiers, routeCancelShare, type Disruption } from './gameState';
import { calculateRouteFinancials, getFlightDurationMinutes } from './financeUtils';
import { migrateSave } from './saveMigration';
import { airportsMapAdjusted } from '../data/airportRegistry';
import { calculateDistance } from '../data/airports';
import { aircraftList } from '../data/aircraft';

/** Small deterministic PRNG, so a test run can be repeated exactly. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const daily = Array.from({ length: 7 }, (_, i) => ({ dayId: i + 1 }));

/** Three routes out of Frankfurt, one of them to New York, each with its own aircraft. */
const ROUTES: DisruptionRoute[] = [
  { id: 'r1', origin: 'FRA', destination: 'LHR', aircraft: 'A1', schedule: daily },
  { id: 'r2', origin: 'FRA', destination: 'CDG', aircraft: 'A2', schedule: daily },
  { id: 'r3', origin: 'FRA', destination: 'JFK', aircraft: 'A3', schedule: daily }
];
const FLEET = [
  { registration: 'A1', conditionGeneral: 100, purchasedAt: 180 },
  { registration: 'A2', conditionGeneral: 60, purchasedAt: 120 },
  { registration: 'A3', conditionGeneral: 90, purchasedAt: 170 }
];
const JANUARY_1975 = 180;
const JULY_1975 = 186;

const roll = (offset: number, rng: () => number, mgt = {}) =>
  rollDisruptions(ROUTES, FLEET, mgt, offset, rng, airportsMapAdjusted);

const disruption = (over: Partial<Disruption>): Disruption => ({
  id: 'd', kind: 'technical', offset: 200, routeIds: ['r1'], cancelShare: 0.25, ...over
});

test('worn and old aircraft break down more often, a hangar at the origin halves it', () => {
  const fresh = technicalDefectChance({ conditionGeneral: 100, purchasedAt: 200 }, 200, false);
  assert.equal(fresh, 0.01, 'a new aircraft: the base chance');
  const worn = technicalDefectChance({ conditionGeneral: 50, purchasedAt: 200 }, 200, false);
  assert.ok(Math.abs(worn - (0.01 + 50 * 0.0008)) < 1e-12);
  const old = technicalDefectChance({ conditionGeneral: 100, purchasedAt: 80 }, 200, false);
  assert.ok(Math.abs(old - (0.01 + 10 * 0.001)) < 1e-12, 'ten years old');
  assert.ok(worn > fresh && old > fresh);

  const hangared = technicalDefectChance({ conditionGeneral: 50, purchasedAt: 80 }, 200, true);
  const open = technicalDefectChance({ conditionGeneral: 50, purchasedAt: 80 }, 200, false);
  assert.ok(Math.abs(hangared - open / 2) < 1e-12);

  assert.equal(technicalDefectChance(undefined, 200, false), 0.01, 'unknown aircraft: treated as new');
  assert.equal(technicalDefectChance({ conditionGeneral: 100, purchasedAt: 300 }, 200, false), 0.01, 'no negative age');
});

test('a hangar at the origin halves the defects actually rolled', () => {
  // Many seeds: count defects with and without a hangar at FRA.
  let open = 0;
  let hangared = 0;
  for (let seed = 1; seed <= 4000; seed++) {
    open += roll(JULY_1975, seeded(seed)).filter(d => d.kind === 'technical').length;
    hangared += roll(JULY_1975, seeded(seed), { FRA: { hubFacilities: { hangar: true } } }).filter(d => d.kind === 'technical').length;
  }
  const ratio = hangared / open;
  assert.ok(ratio > 0.4 && ratio < 0.6, `${hangared} / ${open}`);
});

test('the roll is deterministic for a given generator', () => {
  for (const seed of [1, 7, 42, 1234]) {
    assert.deepEqual(roll(JANUARY_1975, seeded(seed)), roll(JANUARY_1975, seeded(seed)));
  }
  // Nothing at all when every draw misses.
  assert.deepEqual(roll(JANUARY_1975, () => 0.999999), []);
});

test('every kind comes up when every draw hits, each with its own share and scope', () => {
  const all = roll(JANUARY_1975, () => 0);
  const byKind = (k: string) => all.filter(d => d.kind === k);
  assert.equal(byKind('technical').length, 3, 'one per route');
  assert.equal(byKind('birdstrike').length, 3);
  assert.equal(byKind('airport-strike').length, 4, 'FRA, LHR, CDG, JFK');
  assert.deepEqual(byKind('weather').map(d => d.ref), ['EU', 'NA'], 'the winter regions the network touches');

  const fra = byKind('airport-strike').find(d => d.ref === 'FRA')!;
  assert.deepEqual(fra.routeIds, ['r1', 'r2', 'r3'], 'an airport strike hits every route there');
  assert.equal(fra.cancelShare, 0.3);
  assert.deepEqual(byKind('weather').find(d => d.ref === 'NA')!.routeIds, ['r3']);
  assert.ok(byKind('birdstrike').every(d => d.cost === BIRDSTRIKE_REPAIR_COST && d.cancelShare === 0.1));
  assert.ok(byKind('technical').every(d => d.cancelShare === 0.25 && d.offset === JANUARY_1975));
  assert.equal(new Set(all.map(d => d.id)).size, all.length, 'ids are unique');

  // A route without departures or without its aircraft does not fly, so nothing hits it.
  const idle = rollDisruptions(
    [{ id: 'x', origin: 'FRA', destination: 'LHR', aircraft: 'A1', schedule: [] }, { id: 'y', origin: 'FRA', destination: 'LHR', aircraft: 'GONE', schedule: daily }],
    FLEET, {}, JANUARY_1975, () => 0, airportsMapAdjusted
  );
  assert.deepEqual(idle, []);
});

test('winter weather only in December to February, and only in the northern regions', () => {
  assert.equal(isWinterIn('EU', JANUARY_1975), true);
  assert.equal(isWinterIn('NA', JANUARY_1975 - 1), true, 'December');
  assert.equal(isWinterIn('AS', JANUARY_1975 + 1), true, 'February');
  assert.equal(isWinterIn('EU', JANUARY_1975 + 2), false, 'March');
  assert.equal(isWinterIn('EU', JULY_1975), false);
  assert.equal(isWinterIn('OC', JANUARY_1975), false, 'southern summer');
  assert.equal(isWinterIn('SA', JANUARY_1975), false);

  assert.equal(roll(JULY_1975, () => 0).filter(d => d.kind === 'weather').length, 0, 'no summer weather');
});

test('causes combine as independent shares', () => {
  assert.equal(combineCancelShares(0.25, 0.3), 1 - 0.75 * 0.7);
  assert.equal(combineCancelShares(0.25), 0.25);
  assert.equal(combineCancelShares(), 0);
  assert.equal(combineCancelShares(2, -1), 1, 'clamped');

  const list = [
    disruption({ id: 'a', routeIds: ['r1'], cancelShare: 0.25 }),
    disruption({ id: 'b', kind: 'airport-strike', routeIds: ['r1', 'r2'], cancelShare: 0.3 }),
    disruption({ id: 'c', offset: 201, routeIds: ['r3'] })
  ];
  const shares = disruptionCancelShares(list, 200)!;
  assert.ok(Math.abs(shares.r1 - 0.475) < 1e-12);
  assert.equal(shares.r2, 0.3);
  assert.equal(shares.r3, undefined, 'next month is next month');
  assert.equal(disruptionCancelShares(list, 199), undefined);

  // With a strike on top, through the modifiers the engine reads.
  const mods = buildPlayerModifiers({
    reputation: 50, eventChoices: {}, disruptions: list,
    staff: { salaryPct: 100, morale: 60, strike: { startOffset: 200, cancelShare: 0.5 } }
  }, 200);
  assert.ok(Math.abs(routeCancelShare(mods, 'r1') - (1 - 0.525 * 0.5)) < 1e-12);
  assert.equal(routeCancelShare(mods, 'r9'), 0.5, 'the strike alone');
});

test('a chartered replacement cancels nothing', () => {
  const list = [disruption({ id: 'a', mitigated: true }), disruption({ id: 'b', kind: 'birdstrike', cancelShare: 0.1, cost: BIRDSTRIKE_REPAIR_COST })];
  const mods = buildPlayerModifiers({ reputation: 50, eventChoices: {}, disruptions: list }, 200);
  assert.equal(routeCancelShare(mods, 'r1'), 0.1, 'only the bird strike is left');
  const allChartered = buildPlayerModifiers({ reputation: 50, eventChoices: {}, disruptions: [list[0]] }, 200);
  assert.equal(allChartered.cancelShare, undefined);
  assert.deepEqual(allChartered, buildPlayerModifiers({ reputation: 50, eventChoices: {} }, 200), 'as if nothing had happened');

  const incidents = disruptionIncidents(list, 200, id => id.toUpperCase());
  assert.equal(incidents[0].mitigated, true);
  assert.equal(incidents[0].cancelShare, 0);
  assert.equal(incidents[1].cost, BIRDSTRIKE_REPAIR_COST);
  assert.equal(disruptionRepairCost(list, 200), BIRDSTRIKE_REPAIR_COST);
  assert.equal(disruptionRepairCost(list, 201), 0);
});

test('the charter costs 90% of the revenue at stake, cancelling costs reputation', () => {
  const revenue = { r1: 1_000_000, r2: 400_000 };
  const tech = disruption({ routeIds: ['r1'] });
  assert.equal(charterCost(tech, revenue), 225_000);
  const strike = disruption({ kind: 'airport-strike', routeIds: ['r1', 'r2'], cancelShare: 0.3 });
  assert.equal(charterCost(strike, revenue), Math.round(0.9 * 0.3 * 1_400_000));

  assert.equal(cancelReputationPenalty(tech), 1);
  assert.equal(cancelReputationPenalty(disruption({ routeIds: ['a', 'b', 'c', 'd', 'e', 'f'] })), 4, 'capped');

  const decision = buildDisruptionDecision(tech, '01/1975', revenue, id => id);
  assert.equal(decision.kind, 'disruption');
  assert.equal(decision.ref, tech.id);
  assert.deepEqual(decision.options.map(o => [o.id, o.cost]), [[DISRUPTION_OPTION_CHARTER, 225_000], [DISRUPTION_OPTION_CANCEL, 0]]);
});

test('only the big ones are asked about, largest first, three a month', () => {
  const revenue: Record<string, number> = { r1: 100, r2: 500, r3: 300, r4: 900, r5: 50 };
  const list = [
    disruption({ id: 'a', routeIds: ['r1'] }),
    disruption({ id: 'b', routeIds: ['r2'] }),
    disruption({ id: 'c', routeIds: ['r3'] }),
    disruption({ id: 'd', routeIds: ['r4'] }),
    disruption({ id: 'e', kind: 'weather', routeIds: ['r5', 'r4'], cancelShare: DISRUPTION_SPECS.weather.cancelShare }),
    disruption({ id: 'f', routeIds: ['closed'] })
  ];
  const asked = disruptionsToAsk(list, revenue);
  assert.deepEqual(asked.map(d => d.id), ['d', 'b', 'c']);
  assert.equal(asked.length, MAX_DISRUPTION_DECISIONS);
  assert.ok(!asked.some(d => d.id === 'e'), 'weather is minor');
  assert.deepEqual(disruptionsToAsk([list[5]], revenue), [], 'nothing at stake, nothing to ask');
});

test('the route screens name every cause, with the share the engine applies', () => {
  const list = [
    disruption({ id: 'a', routeIds: ['r1'], ref: 'D-ABCD' }),
    disruption({ id: 'b', kind: 'weather', routeIds: ['r1', 'r2'], cancelShare: 0.15, ref: 'EU' }),
    disruption({ id: 'c', kind: 'airport-strike', routeIds: ['r2'], cancelShare: 0.3, ref: 'CDG', mitigated: true })
  ];
  const mods = buildPlayerModifiers({ reputation: 50, eventChoices: {}, disruptions: list }, 200);
  const out = describeRouteCancellations(['r1', 'r2', 'r3'], id => routeCancelShare(mods, id), list, 200, 0);
  assert.deepEqual(out.r1.reasons, ['Technical defect: D-ABCD (25%)', 'Winter weather in Europe (15%)']);
  assert.ok(Math.abs(out.r1.share - (1 - 0.75 * 0.85)) < 1e-12);
  assert.deepEqual(out.r2.reasons, ['Winter weather in Europe (15%)'], 'the chartered strike is not a cause');
  assert.equal(out.r3, undefined);

  const striking = describeRouteCancellations(['r3'], () => 0.5, [], 200, 0.5);
  assert.deepEqual(striking.r3.reasons, ['Staff strike (50%)']);
});

test('past disruptions are dropped, saved ones survive a load', () => {
  const list = [disruption({ id: 'old', offset: 199 }), disruption({ id: 'now', offset: 200 }), disruption({ id: 'next', offset: 201 })];
  assert.deepEqual(dropPastDisruptions(list, 200).map(d => d.id), ['now', 'next']);

  const loaded = migrateSave({
    currentDateOffset: 200,
    disruptions: [
      { ...disruption({ id: 'x', kind: 'birdstrike', cost: BIRDSTRIKE_REPAIR_COST }), mitigated: true },
      { ...disruption({ id: 'y' }), cost: -5, mitigated: 'yes' },
      { id: 'z', kind: 'volcano', offset: 200, routeIds: [], cancelShare: 1 }
    ]
  });
  assert.deepEqual(loaded.disruptions.map((d: Disruption) => d.id), ['x', 'y']);
  assert.equal(loaded.disruptions[0].mitigated, true);
  assert.equal(loaded.disruptions[0].cost, BIRDSTRIKE_REPAIR_COST);
  assert.equal(loaded.disruptions[1].cost, undefined, 'a negative bill is dropped');
  assert.equal(loaded.disruptions[1].mitigated, undefined);
});

test('a disrupted route flies what is left, in whole seats and passengers', () => {
  const spec = aircraftList.find(a => a.id === '737-100')!;
  const aircraft = {
    ...spec, registration: 'T-DIS', purchasedAt: 0, conditionInterior: 90, conditionGeneral: 90, baseInteriorPop: 60,
    config: { economy: 80, premium: 0, business: 20, first: 0, details: {} }
  };
  const o = airportsMapAdjusted.get('FRA')!;
  const d = airportsMapAdjusted.get('CDG')!;
  const durMin = getFlightDurationMinutes(o, d, aircraft);
  const route = {
    id: 'r1', origin: 'FRA', destination: 'CDG', aircraft: 'T-DIS',
    distance: Math.round(calculateDistance(o.coords[0], o.coords[1], d.coords[0], d.coords[1])), durMin,
    schedule: Array.from({ length: 7 }, (_, i) => ({ dayId: i + 1, startHour: 8, startMin: 0, durMin, turnoverMin: 60 })),
    classConfigs: { economy: { catering: [['b5']], extras: ['none'], service: ['none'] } },
    ticketPrices: { economy: 40, business: 90 }
  };
  const price = (disruptions: Disruption[], strike: number | null) => {
    const mods = buildPlayerModifiers({
      reputation: 50, eventChoices: {}, disruptions,
      staff: { salaryPct: 100, morale: 60, strike: strike === null ? null : { startOffset: 200, cancelShare: strike } }
    }, 200);
    return calculateRouteFinancials(route, aircraft, 1.2, {}, 1976, 9, 'Normal', airportsMapAdjusted, [route], [aircraft], false, mods.demandFactor, [], mods);
  };
  const base = price([], null);
  const hit = price([disruption({ routeIds: ['r1'] }), disruption({ id: 'w', kind: 'weather', routeIds: ['r1'], cancelShare: 0.15 })], 0.5);
  assert.ok(Math.abs(hit.flightLegs / base.flightLegs - 0.5 * 0.75 * 0.85) < 1e-12);
  for (const cls of ['economy', 'business']) {
    assert.ok(Number.isInteger(hit.paxByClass[cls].max), `${cls} seats ${hit.paxByClass[cls].max}`);
    assert.ok(Number.isInteger(hit.paxByClass[cls].actual), `${cls} passengers ${hit.paxByClass[cls].actual}`);
  }
  assert.ok(Number.isInteger(hit.paxPerWeek));
  assert.ok(hit.paxPerWeek < base.paxPerWeek);
  assert.deepEqual(price([disruption({ routeIds: ['r1'], mitigated: true })], null), base, 'chartered: the full timetable flies');
});

test('the chances are the documented ones', () => {
  assert.equal(BIRDSTRIKE_CHANCE, 0.004);
  assert.equal(AIRPORT_STRIKE_CHANCE, 0.01);
  assert.equal(WEATHER_CHANCE, 0.03);
});
