import test from 'node:test';
import assert from 'node:assert/strict';

import { getCateringOpt, getMultiOptionSum, applyDiminishingReturns, buildRivalRoutesByPair, marketKey } from './financeUtils';
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

test('applyDiminishingReturns passes through below the threshold and dampens above it', () => {
  assert.equal(applyDiminishingReturns(50), 50);
  assert.equal(applyDiminishingReturns(100), 88);
  assert.equal(applyDiminishingReturns(150), 102);
  assert.equal(applyDiminishingReturns(210), 115);
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

import {
  calculateRouteFinancials,
  getRouteClassSatisfaction,
  seatWeightedSatisfaction,
  getFlightDurationMinutes,
  getManagementUnlockCost,
  applyManagementUnlock,
  getInfraAvailability
} from './financeUtils';
import { airportsMapAdjusted } from '../data/airportRegistry';
import { aircraftList } from '../data/aircraft';

function sampleRoute(weeklyFlights: number, desks = { normal: 1, self: 0 }) {
  const spec = aircraftList.find(a => a.id === '737-100')!;
  const aircraft = {
    ...spec, registration: 'T-TEST', purchasedAt: 0, conditionInterior: 90, conditionGeneral: 90, baseInteriorPop: 60,
    config: { economy: 80, premium: 0, business: 20, first: 0, details: {} }
  };
  const origin = airportsMapAdjusted.get('FRA')!;
  const dest = airportsMapAdjusted.get('CDG')!;
  const durMin = getFlightDurationMinutes(origin, dest, aircraft);
  const route = {
    id: 'r1', origin: 'FRA', destination: 'CDG', aircraft: 'T-TEST', distance: 450, durMin,
    schedule: Array.from({ length: weeklyFlights }, (_, i) => ({ dayId: (i % 7) + 1, startHour: 8, startMin: 0, durMin, turnoverMin: 60 })),
    classConfigs: { economy: { catering: [['b5']], extras: ['none'], service: ['none'] } },
    ticketPrices: { economy: 120, business: 400 }
  };
  const infra = { level: 2, slots: { regional: 0, narrowbody: 50, widebody: 0 }, stands: { narrowbody: 0 }, desks };
  const mgt = { FRA: infra, CDG: infra };
  return { aircraft, route, mgt };
}

test('the satisfaction screens show is the one the economy prices with', () => {
  const { aircraft, route, mgt } = sampleRoute(7);
  const fin = calculateRouteFinancials(route, aircraft, 1, mgt, 1970, 6, 'Normal', airportsMapAdjusted, [route], [aircraft]);
  const shown = getRouteClassSatisfaction(route, aircraft, mgt, [route], [aircraft], 'Normal');
  assert.deepEqual(shown.routeSat, fin.routeSat);
  assert.equal(shown.satisfactionDetails.business.satisfactionPercentage, fin.routeSat.business);
});

test('a cabin menu the aircraft or hub no longer supports is not priced or costed', () => {
  // A route saved while the aircraft had a premium galley and the hub had a
  // catering facility -- both required for a Premium-tier meal on a
  // Narrowbody. Neither the route's classConfigs nor the aircraft's fleet
  // record change on their own when one of those goes away; only the cabin
  // editor used to notice, and only if the player happened to reopen it.
  const spec = aircraftList.find(a => a.id === '737-100')!;
  const origin = airportsMapAdjusted.get('FRA')!;
  const dest = airportsMapAdjusted.get('CDG')!;
  const makeAircraft = (hasPremiumCatering: boolean) => ({
    ...spec, registration: 'T-REFIT', purchasedAt: 0, conditionInterior: 90, conditionGeneral: 90, baseInteriorPop: 60,
    config: { economy: 100, premium: 0, business: 0, first: 0, details: { hasPremiumCatering } }
  });
  const withGalley = makeAircraft(true);
  const durMin = getFlightDurationMinutes(origin, dest, withGalley);
  const route = {
    id: 'refit-route', origin: 'FRA', destination: 'CDG', aircraft: 'T-REFIT', distance: 450, durMin,
    schedule: Array.from({ length: 7 }, (_, i) => ({ dayId: i + 1, startHour: 8, startMin: 0, durMin, turnoverMin: 60 })),
    classConfigs: { economy: { catering: [['p1']], extras: ['none'], service: ['none'] } },
    ticketPrices: { economy: 120 }
  };
  const infra = {
    level: 2, slots: { regional: 0, narrowbody: 50, widebody: 0 }, stands: { narrowbody: 0 },
    desks: { normal: 1, self: 0 }, hubFacilities: { catering: true }
  };
  const mgt = { FRA: infra, CDG: infra };

  const beforeRefit = getRouteClassSatisfaction(route, withGalley, mgt, [route], [withGalley], 'Normal');
  assert.equal(beforeRefit.classConfigs.economy.catering[0][0], 'p1', 'the premium meal is allowed while the galley is fitted');

  // Refitted: the galley is gone, but the route's saved menu is untouched.
  const refitted = makeAircraft(false);
  const afterRefit = getRouteClassSatisfaction(route, refitted, mgt, [route], [refitted], 'Normal');
  assert.equal(afterRefit.classConfigs.economy.catering[0][0], 'none', 'a meal the aircraft can no longer serve is dropped, not priced as-is');
  assert.ok(afterRefit.routeSat.economy < beforeRefit.routeSat.economy, 'satisfaction reflects the downgrade');

  const finBefore = calculateRouteFinancials(route, withGalley, 1, mgt, 1990, 6, 'Normal', airportsMapAdjusted, [route], [withGalley]);
  const finAfter = calculateRouteFinancials(route, refitted, 1, mgt, 1990, 6, 'Normal', airportsMapAdjusted, [route], [refitted]);
  assert.ok(finAfter.costsBreakdown.catering < finBefore.costsBreakdown.catering, 'catering cost drops once the meal it can no longer serve is dropped');

  // The route's own saved state is never mutated by pricing it.
  assert.equal(route.classConfigs.economy.catering[0][0], 'p1');
});

test("a route's own passengers count towards the check-in load it causes", () => {
  // One standard desk handles 5,000 seats a week; 40 round trips of 100 seats
  // need 4,000 -- 80% load, no penalty. 60 trips need 6,000 -- overloaded.
  const light = sampleRoute(40);
  const heavy = sampleRoute(60);
  const satLight = getRouteClassSatisfaction(light.route, light.aircraft, light.mgt, [light.route], [light.aircraft], 'Normal');
  const satHeavy = getRouteClassSatisfaction(heavy.route, heavy.aircraft, heavy.mgt, [heavy.route], [heavy.aircraft], 'Normal');
  assert.equal(satLight.overloadPenalty, 0);
  assert.ok(satHeavy.originDeskSim.load > 100, `load ${satHeavy.originDeskSim.load}`);
  assert.ok(satHeavy.overloadPenalty < 0);
});

test('route satisfaction is weighted by seats, including classes at 0%', () => {
  const avg = seatWeightedSatisfaction({ economy: 100, business: 0 }, { economy: 80, business: 20 });
  assert.equal(avg, 80);
  assert.equal(seatWeightedSatisfaction({}, undefined), 0);
});

// --- Airport management ------------------------------------------------------

test('management tiers cost the same wherever they are bought', () => {
  assert.equal(getManagementUnlockCost(4, 1), 120_000);
  assert.equal(getManagementUnlockCost(2, 2), 1_500_000);
  assert.equal(getManagementUnlockCost(1, 3), 500_000_000);
});

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

test('what can be built follows the airport size and the year', () => {
  assert.deepEqual(getInfraAvailability({ level: 2 }, 1990), { widebodySlots: false, stands: false, selfCheckIn: false });
  assert.deepEqual(getInfraAvailability({ level: 3 }, 1995), { widebodySlots: true, stands: true, selfCheckIn: true });
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
