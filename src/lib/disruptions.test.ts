import test from 'node:test';
import assert from 'node:assert/strict';

import { DISRUPTION_SPECS, MAX_DISRUPTION_DECISIONS, combineCancelShares, describeRouteCancellations, disruptionCancelShares, disruptionsToAsk } from './disruptions';
import { buildPlayerModifiers, routeCancelShare, type Disruption } from './gameState';

const disruption = (over: Partial<Disruption>): Disruption => ({
  id: 'd', kind: 'technical', offset: 200, routeIds: ['r1'], cancelShare: 0.25, ...over
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
  const lostOf = (d: Disruption) => d.routeIds.reduce((sum, id) => sum + (revenue[id] || 0) * d.cancelShare, 0);
  const asked = disruptionsToAsk(list, lostOf);
  assert.deepEqual(asked.map(d => d.id), ['d', 'b', 'c']);
  assert.equal(asked.length, MAX_DISRUPTION_DECISIONS);
  assert.ok(!asked.some(d => d.id === 'e'), 'weather is minor');
  assert.deepEqual(disruptionsToAsk([list[5]], lostOf), [], 'nothing at stake, nothing to ask');
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
