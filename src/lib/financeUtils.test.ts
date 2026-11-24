import test from 'node:test';
import assert from 'node:assert/strict';

import { getCateringOpt, getMultiOptionSum, buildRivalRoutesByPair, marketKey } from './financeUtils';
import { MEAL_DATA, EXTRAS_OPTIONS } from '../data/catering';

test('getCateringOpt sums cost across combined meal items instead of averaging', () => {
  const wagyuAlone = getCateringOpt(['l15']);
  assert.equal(wagyuAlone.cost, 82.60);
  assert.equal(wagyuAlone.sat, 60);

  const wagyuPlusFiller = getCateringOpt(['l15', 'b1']);
  assert.equal(wagyuPlusFiller.cost, 87.05);
  assert.ok(wagyuPlusFiller.cost > wagyuAlone.cost, 'adding a second dish must never lower the cost');

  const threeWagyu = getCateringOpt(['l15', 'l15', 'l15']);
  assert.equal(threeWagyu.cost, 272.58);
});

test('getMultiOptionSum collapses a stale double-selection within a tiered family', () => {
  const bothWifiTiers = getMultiOptionSum(['wifi_limited', 'wifi_unlimited'], EXTRAS_OPTIONS);
  const unlimitedAlone = getMultiOptionSum(['wifi_unlimited'], EXTRAS_OPTIONS);
  assert.equal(bothWifiTiers.sat, unlimitedAlone.sat, 'selecting both wifi tiers must not double-count sat');
  assert.equal(bothWifiTiers.cost, unlimitedAlone.cost);
});

test('getMultiOptionSum leaves independent (non-grouped) extras additive', () => {
  const combo = getMultiOptionSum(['pillows', 'headphones'], EXTRAS_OPTIONS);
  assert.equal(combo.sat, EXTRAS_OPTIONS.pillows.sat + EXTRAS_OPTIONS.headphones.sat);
  assert.equal(combo.cost, EXTRAS_OPTIONS.pillows.cost + EXTRAS_OPTIONS.headphones.cost);
});

test('MEAL_DATA cost and sat are non-decreasing within each tier', () => {
  for (const [tier, meals] of Object.entries(MEAL_DATA)) {
    for (let i = 1; i < meals.length; i++) {
      assert.ok(meals[i].cost >= meals[i - 1].cost, `${tier}: ${meals[i].id} cost must be >= ${meals[i - 1].id}`);
      assert.ok(meals[i].sat >= meals[i - 1].sat, `${tier}: ${meals[i].id} sat must be >= ${meals[i - 1].id}`);
    }
  }
});

test('no lower tier dominates a higher tier (equal-or-cheaper AND equal-or-better sat)', () => {
  const tierOrder = ['Basic', 'Standard', 'Premium', 'Luxury'];
  const all = tierOrder.flatMap((tier, idx) => MEAL_DATA[tier].map(m => ({ ...m, tierIndex: idx, tier })));
  for (const higher of all) {
    for (const lower of all) {
      if (lower.tierIndex >= higher.tierIndex) continue;
      const dominates = lower.cost <= higher.cost && lower.sat >= higher.sat &&
        (lower.cost < higher.cost || lower.sat > higher.sat);
      assert.ok(!dominates, `${lower.tier}/${lower.id} must not dominate ${higher.tier}/${higher.id}`);
    }
  }
});

// --- One satisfaction figure per route ----------------------------------------

import { applyManagementUnlock } from './financeUtils';

test('unlocking a tier applies its effects and never lowers the tier', () => {
  const t1 = applyManagementUnlock(undefined, 1);
  assert.equal(t1.level, 1);
  assert.equal(t1.desks.normal, 1);
  assert.equal(t1.hubAutoUpgrade, false);

  const withSlots = { ...t1, slots: { regional: 2, narrowbody: 5, widebody: 1 } };
  const t2 = applyManagementUnlock(withSlots, 2);
  assert.equal(t2.hubAutoUpgrade, true);
  assert.deepEqual(
    { regional: t2.stands.regional, narrowbody: t2.stands.narrowbody, widebody: t2.stands.widebody },
    { regional: 2, narrowbody: 5, widebody: 1 }
  );
  assert.equal(applyManagementUnlock(t2, 1).level, 2);
});

test('COMP hint counts rivals on the exact origin-destination pair, not merely at the destination', () => {
  // Regression for a historical bug where the "COMP" count on the route planner's
  // destination list was built from any rival route touching the candidate airport
  // -- origin or destination -- instead of the exact pair the player was building.
  const aiAirlines = [
    { routes: [{ origin: 'FRA', destination: 'JFK' }, { origin: 'FRA', destination: 'CDG' }] },
    { routes: [{ origin: 'JFK', destination: 'FRA' }] }, // same market as FRA-JFK, reversed
    { routes: [{ origin: 'LHR', destination: 'JFK' }] },  // touches JFK, but a different pair
  ];
  const byPair = buildRivalRoutesByPair(aiAirlines);

  // Player is building FRA -> JFK: two rivals fly this exact pair (one each direction).
  assert.equal(byPair.get(marketKey('FRA', 'JFK')), 2);

  // Player is building CDG -> JFK: nobody flies this exact pair, even though CDG has a
  // FRA rival and JFK has two others. The old destination-only bug would have counted
  // every route touching JFK (3) here instead of 0.
  assert.equal(byPair.get(marketKey('CDG', 'JFK')) || 0, 0);

  // Player is building FRA -> CDG: exactly the one rival on that exact pair, not the
  // two other rivals that merely touch FRA on unrelated pairs.
  assert.equal(byPair.get(marketKey('FRA', 'CDG')) || 0, 1);
});
