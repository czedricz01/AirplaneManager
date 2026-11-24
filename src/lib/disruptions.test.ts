import test from 'node:test';
import assert from 'node:assert/strict';

import { DISRUPTION_OPTION_CANCEL, DISRUPTION_OPTION_CHARTER, DISRUPTION_SPECS, MAX_DISRUPTION_DECISIONS, buildDisruptionDecision, describeRouteCancellations, disruptionsToAsk, routeCancelShare } from './disruptions';
import { CHARTER_MARKUP } from '../model/constants';
import type { Disruption } from './gameState';

const disruption = (over: Partial<Disruption>): Disruption => ({
  id: 'd', kind: 'technical', offset: 200, routeIds: ['r1'], cancelShare: 0.25, ...over
});

test('causes combine as independent shares, as the model books them (8.9)', () => {
  const list = [
    disruption({ id: 'a', routeIds: ['r1'], cancelShare: 0.25 }),
    disruption({ id: 'b', kind: 'airport-strike', routeIds: ['r1', 'r2'], cancelShare: 0.3 }),
    disruption({ id: 'c', offset: 201, routeIds: ['r3'] }),
    disruption({ id: 'd', kind: 'weather', routeIds: ['r2'], cancelShare: 0.15, mitigated: true })
  ];
  assert.ok(Math.abs(routeCancelShare('r1', list, 200, 0) - 0.475) < 1e-12);
  assert.ok(Math.abs(routeCancelShare('r2', list, 200, 0) - 0.3) < 1e-12, 'the chartered weather cancels nothing');
  assert.equal(routeCancelShare('r3', list, 200, 0), 0, 'next month is next month');
  assert.equal(routeCancelShare('r1', list, 199, 0), 0);

  // With a strike on top: every route, also one the planner is still drafting.
  assert.ok(Math.abs(routeCancelShare('r1', list, 200, 0.5) - (1 - 0.525 * 0.5)) < 1e-12);
  assert.equal(routeCancelShare('r9', list, 200, 0.5), 0.5, 'the strike alone');
  assert.equal(routeCancelShare('r9', undefined, 200, 1), 1);
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
  const out = describeRouteCancellations(['r1', 'r2', 'r3'], list, 200, 0);
  assert.deepEqual(out.r1.reasons, ['Technical defect: D-ABCD (25%)', 'Winter weather in Europe (15%)']);
  assert.ok(Math.abs(out.r1.share - (1 - 0.75 * 0.85)) < 1e-12);
  assert.deepEqual(out.r2.reasons, ['Winter weather in Europe (15%)'], 'the chartered strike is not a cause');
  assert.equal(out.r3, undefined);

  const striking = describeRouteCancellations(['r3'], [], 200, 0.5);
  assert.deepEqual(striking.r3.reasons, ['Staff strike (50%)']);
  assert.equal(striking.r3.share, 0.5);
});

test('5.2e, E76: the question names fee, revenue lost and own flight costs from the model (8.9)', () => {
  const estimate = { flights: 30.4, revenue: 120_000, passengerCost: 9_000, ownFlightCost: 40_000, fee: 60_000, advantage: 51_000 };
  const q = buildDisruptionDecision(disruption({ id: 'x', cancelShare: 0.5, ref: 'D-ABCD' }), '03/1975', estimate, () => 'FRA-LHR');
  const [charter, cancel] = q.options;
  assert.equal(charter.id, DISRUPTION_OPTION_CHARTER);
  assert.match(charter.detail, new RegExp(`${CHARTER_MARKUP} times your own fuel, crew and landing cost`));
  assert.match(charter.detail, /Fee about \$60,000/);
  assert.match(charter.detail, /\$9,000 of passenger costs, the month ends about \$51,000 better than cancelling/);
  assert.doesNotMatch(charter.detail, /% of the ticket revenue/);
  assert.equal(cancel.id, DISRUPTION_OPTION_CANCEL);
  assert.match(cancel.detail, /about \$120,000 of ticket revenue is lost/);
  assert.doesNotMatch(cancel.detail, /\d+(\.\d+)? reputation/, 'no one-time reputation loss (E38)');
  assert.ok(q.options.every(o => o.cost === 0));
  assert.match(q.description, /50% of the flights on FRA-LHR would not operate: about 30 flights\. Cancelling them loses about \$120,000 of ticket revenue/);
  assert.match(q.description, /saving about \$40,000 of fuel, crew and landing cost/);
  assert.match(q.description, /Worked out for 03\/1975 with your current schedule and prices\./);
  assert.doesNotMatch(q.description, /last month's figures/);

  const worse = buildDisruptionDecision(disruption({ id: 'y', cancelShare: 0.5 }), '03/1975', { ...estimate, flights: 0.3, advantage: -2_500 }, () => 'FRA-LHR');
  assert.match(worse.options[0].detail, /about \$2,500 worse than cancelling/);
  assert.match(worse.description, /about 1 flight\. Cancelling/);
});
