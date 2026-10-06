import test from 'node:test';
import assert from 'node:assert/strict';

import { getCateringOpt, getMultiOptionSum, applyDiminishingReturns, buildRivalRoutesByPair, marketKey, getPriceDemandMultiplier } from './financeUtils';
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

test('getPriceDemandMultiplier falls faster above the base price than it grows below it', () => {
  const base = 100;
  const sat = 50;

  assert.equal(getPriceDemandMultiplier(base, base, sat), 1, 'no premium or discount at the base price');

  const underpriced = getPriceDemandMultiplier(80, base, sat);
  const overpriced = getPriceDemandMultiplier(120, base, sat);
  assert.ok(underpriced > 1, 'a discount must still grow demand');
  assert.ok(overpriced < 1, 'a premium must still shrink demand');

  const elasticity = Math.max(0.5, 1.5 - sat / 200);
  const symmetricOverpriced = Math.pow(base / 120, elasticity);
  assert.ok(overpriced < symmetricOverpriced, 'overpricing must fall off steeper than the plain elasticity curve');
  assert.equal(underpriced, Math.pow(base / 80, elasticity), 'underpricing is unaffected by the overprice penalty');
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
  getInfraAvailability,
  getAircraftResaleValue
} from './financeUtils';
import { fleetOwnershipCost } from './fleetCosts';
import { buildPlayerModifiers } from './gameState';
import { researchEffects } from './research';
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
  assert.equal(getManagementUnlockCost(1, 3), 25_000_000);
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

// --- Player modifiers ----------------------------------------------------------

import type { PlayerModifiers } from './gameState';
import type { RouteOffer } from './financeUtils';

/** Fourteen rival departures: enough that the market-share split matters. */
const RIVALS = [{ origin: 'CDG', destination: 'FRA', departures: 14, airline: 'Rival' }];

function priceWith(extraDemandFactor: number, mods?: PlayerModifiers, rivalOffers = RIVALS) {
  const { aircraft, route, mgt } = sampleRoute(7);
  return calculateRouteFinancials(
    route, aircraft, 1.2, mgt, 1970, 6, 'Normal', airportsMapAdjusted, [route], [aircraft], false,
    extraDemandFactor, rivalOffers, mods
  );
}

test('neutral player modifiers price a route exactly as the plain demand factor did', () => {
  const plain = priceWith(1.07);
  assert.deepStrictEqual(priceWith(1, { demandFactor: 1.07 }), plain, 'mods.demandFactor replaces extraDemandFactor');
  assert.deepStrictEqual(priceWith(1.07, { demandFactor: 1.07 }), plain);
  assert.deepStrictEqual(
    priceWith(1, {
      demandFactor: 1.07, regionDemand: { EU: 1 }, loyaltyBonus: 0, satDelta: 0,
      crewCostFactor: 1, cancelShare: { r1: 0 }, transfer: {}
    }),
    plain,
    'every field at its neutral value changes nothing, not even the last bit'
  );
});

test('player modifiers move a route the way they say', () => {
  const base = priceWith(1, { demandFactor: 1 });

  const happier = priceWith(1, { demandFactor: 1, satDelta: 10 });
  assert.equal(happier.routeSat.economy, base.routeSat.economy + 10);
  assert.equal(happier.routeSat.business, base.routeSat.business + 10);
  assert.ok(happier.paxPerWeek > base.paxPerWeek, 'happier passengers fly more often');

  const pricier = priceWith(1, { demandFactor: 1, crewCostFactor: 1.2 });
  assert.ok(Math.abs(pricier.costsBreakdown.crew / base.costsBreakdown.crew - 1.2) < 1e-9);
  assert.equal(pricier.costsBreakdown.fuel, base.costsBreakdown.fuel);
  assert.ok(pricier.estWeeklyProfit < base.estWeeklyProfit);

  const halved = priceWith(1, { demandFactor: 1, cancelShare: { r1: 0.5 } });
  assert.ok(Math.abs(halved.costsBreakdown.fuel / base.costsBreakdown.fuel - 0.5) < 1e-9, 'fuel follows the flights flown');
  assert.ok(Math.abs(halved.costsBreakdown.landingFees / base.costsBreakdown.landingFees - 0.5) < 1e-9);
  assert.equal(halved.paxByClass.economy.max, base.paxByClass.economy.max / 2, 'half the seats');
  assert.ok(halved.paxPerWeek <= base.paxPerWeek);
  assert.equal(halved.weeklyFlights, base.weeklyFlights, 'the timetable itself is unchanged');
  assert.deepStrictEqual(priceWith(1, { demandFactor: 1, cancelShare: { other: 0.5 } }), base, 'only the named route is hit');

  const regional = priceWith(1, { demandFactor: 1, regionDemand: { EU: 1.2 } });
  assert.ok(Math.abs(regional.demandData.total / base.demandData.total - 1.2) < 0.01, 'both ends in Europe: the full regional factor');
  assert.deepStrictEqual(priceWith(1, { demandFactor: 1, regionDemand: { NA: 1.2 } }), base, 'a region the route does not touch');
});

test('loyalty wins passengers back from rivals on a shared city pair', () => {
  // A dominant rival, so the route's demand is limited by its share rather
  // than by its seats.
  const rivals = [{ origin: 'CDG', destination: 'FRA', departures: 1000, airline: 'Giant' }];
  const base = priceWith(1, { demandFactor: 1 }, rivals);
  const loyal = priceWith(1, { demandFactor: 1, loyaltyBonus: 0.2 }, rivals);
  assert.ok(loyal.paxPerWeek > base.paxPerWeek, `${loyal.paxPerWeek} vs ${base.paxPerWeek}`);
  assert.deepStrictEqual(priceWith(1, { demandFactor: 1, loyaltyBonus: 0.2 }, []), priceWith(1, { demandFactor: 1 }, []), 'no rivals, nothing to win back');
});

test('loyalty does not take passengers from the airline\'s own parallel route', () => {
  // Two identical FRA-CDG routes of the player's. Loyalty lifted only the
  // route being priced, while the other one counted as an unboosted rival:
  // each won a bigger share of the same market, and together they carried
  // passengers who did not exist.
  const { aircraft, route, mgt } = sampleRoute(7);
  const twin = { ...route, id: 'r2', aircraft: 'T-TWIN' };
  const twinAircraft = { ...aircraft, registration: 'T-TWIN' };
  const both = [route, twin];
  const fleet = [aircraft, twinAircraft];
  const total = (mods: PlayerModifiers, rivals: RouteOffer[] = []) =>
    [route, twin].reduce((sum, r, i) => sum + calculateRouteFinancials(
      r, fleet[i], 1.2, mgt, 1970, 6, 'Normal', airportsMapAdjusted, both, fleet, false, 1, rivals, mods
    ).paxPerWeek, 0);

  // Thin demand, so each route carries its share of the market rather than
  // what its seats allow.
  const plain = total({ demandFactor: 0.2 });
  assert.ok(plain > 0);
  assert.equal(total({ demandFactor: 0.2, loyaltyBonus: 0.2 }), plain, 'no rivals: loyalty changes nothing');

  // With a rival on the pair, loyalty wins passengers, from the rival.
  const rival: RouteOffer[] = [{ origin: 'CDG', destination: 'FRA', departures: 14, airline: 'Rival' }];
  assert.ok(total({ demandFactor: 0.2, loyaltyBonus: 0.2 }, rival) > total({ demandFactor: 0.2 }, rival));
});

// --- Satisfaction rules -----------------------------------------------------

import {
  getDeskPenalty,
  getDeskOverloadSat,
  getStandBonus,
  getPlaneSat
} from './financeUtils';

test('diminishing returns never add points and never fall as the input grows', () => {
  // Below the threshold it passes through; just above it, it used to pay MORE
  // than it was given (65 became 70), which is the opposite of "diminishing".
  assert.equal(applyDiminishingReturns(65), 65);
  assert.equal(applyDiminishingReturns(80), 80);
  let previous = -Infinity;
  for (let raw = 0; raw <= 300; raw++) {
    const out = applyDiminishingReturns(raw);
    assert.ok(out <= raw, `${raw} became ${out}`);
    assert.ok(out >= previous, `${raw} fell to ${out} from ${previous}`);
    previous = out;
  }
});

test('adding a check-in desk never lowers satisfaction', () => {
  for (const premium of [false, true]) {
    const none = getDeskPenalty(false, false, premium);
    const selfOnly = getDeskPenalty(true, false, premium);
    const normal = getDeskPenalty(false, true, premium);
    const both = getDeskPenalty(true, true, premium);
    assert.ok(selfOnly >= none, `premium=${premium}: self-service only (${selfOnly}) must not be worse than no desk (${none})`);
    assert.ok(normal >= selfOnly, `premium=${premium}: a staffed desk must not be worse than self-service only`);
    assert.ok(both >= normal, `premium=${premium}: adding self-service to a staffed desk must not hurt`);
  }
  assert.equal(getDeskPenalty(false, false, false), -15);
  assert.equal(getDeskPenalty(true, false, true), -10);
  assert.equal(getDeskPenalty(true, true, true), 0);
});

test('check-in overload grows steadily with no cliff at 100%', () => {
  assert.equal(getDeskOverloadSat(0), 0);
  assert.equal(getDeskOverloadSat(80), 0);
  assert.equal(getDeskOverloadSat(90), -2);
  assert.equal(getDeskOverloadSat(100), -4);
  assert.equal(getDeskOverloadSat(110), -20);
  assert.equal(getDeskOverloadSat(300), -20);
  assert.ok(getDeskOverloadSat(100.5) > -5, 'half a percent over must cost about half a percent more, not 16 points');
  let previous = 0;
  for (let load = 0; load <= 200; load += 0.5) {
    const sat = getDeskOverloadSat(load);
    assert.ok(sat <= previous, `overload penalty rose at ${load}%`);
    previous = sat;
  }
});

test('the check-in desks at the destination count as much as those at the origin', () => {
  const { aircraft, route, mgt } = sampleRoute(7);
  const both = getRouteClassSatisfaction(route, aircraft, mgt, [route], [aircraft], 'Normal');
  const noDesk = { level: 2, slots: mgt.CDG.slots, stands: mgt.CDG.stands, desks: { normal: 0, self: 0 } };
  const noDestDesk = getRouteClassSatisfaction(route, aircraft, { ...mgt, CDG: noDesk }, [route], [aircraft], 'Normal');
  const noOriginDesk = getRouteClassSatisfaction(route, aircraft, { ...mgt, FRA: noDesk }, [route], [aircraft], 'Normal');
  assert.ok(noDestDesk.routeSat.economy < both.routeSat.economy, 'a destination without desks costs satisfaction');
  assert.equal(noDestDesk.routeSat.economy, noOriginDesk.routeSat.economy, 'the two ends are weighted the same');
});

test('interior wear lowers only the interior part of the plane satisfaction', () => {
  const plane = (conditionInterior: number) => ({ popularity: 80, baseInteriorPop: 50, conditionInterior });
  assert.equal(getPlaneSat(plane(100)), Math.round(80 * 0.33 + 50 * 0.67));
  // The 80-point model popularity is a fact about the type, not about the cabin.
  assert.equal(getPlaneSat(plane(0)), Math.round(80 * 0.33 + 50 * 0.67 * 0.4));
  assert.ok(getPlaneSat(plane(50)) < getPlaneSat(plane(100)));
  assert.ok(getPlaneSat(plane(50)) > getPlaneSat(plane(0)));
});

test('the stand bonus scales with the share of slots that have a stand, at both ends', () => {
  const ends = (o: number, d: number) => ({
    A: { slots: { narrowbody: 10 }, stands: { narrowbody: o } },
    B: { slots: { narrowbody: 10 }, stands: { narrowbody: d } }
  });
  assert.equal(getStandBonus('A', 'B', 'narrowbody', ends(10, 10)), 2);
  assert.equal(getStandBonus('A', 'B', 'narrowbody', ends(20, 10)), 2, 'stands beyond the slots add nothing');
  assert.equal(getStandBonus('A', 'B', 'narrowbody', ends(5, 5)), 1);
  assert.equal(getStandBonus('A', 'B', 'narrowbody', ends(10, 0)), 1);
  assert.equal(getStandBonus('A', 'B', 'narrowbody', ends(0, 0)), 0);
  assert.equal(getStandBonus('A', 'B', 'narrowbody', {}), 0);
});

test('a fare that is missing or zero never turns the route result into NaN', () => {
  assert.equal(getPriceDemandMultiplier(0, 100, 100), 1.5);
  assert.equal(getPriceDemandMultiplier(100, 0, 0), 0);

  // The aircraft has business seats but the saved fares only cover economy.
  const { aircraft, route, mgt } = sampleRoute(7);
  const partial = { ...route, ticketPrices: { economy: 120 } };
  const fin = calculateRouteFinancials(partial, aircraft, 1, mgt, 1970, 6, 'Normal', airportsMapAdjusted, [partial], [aircraft]);
  assert.ok(Number.isFinite(fin.estWeeklyRev), `revenue ${fin.estWeeklyRev}`);
  assert.ok(Number.isFinite(fin.paxPerWeek), `passengers ${fin.paxPerWeek}`);
});

// --- Demand level -------------------------------------------------------------

import { calculateDemand, eraDemandFactor, getSatMultiplier, calculateBasePrices } from './financeUtils';

test('the era factor keeps all of 1960, falls in a straight line, and holds after 2020', () => {
  assert.equal(eraDemandFactor(1960), 1);
  assert.equal(eraDemandFactor(1990), 0.65);
  assert.equal(eraDemandFactor(2020), 0.4);
  assert.ok(Math.abs(eraDemandFactor(1975) - 0.825) < 1e-9, 'halfway between the first two anchors');

  assert.equal(eraDemandFactor(1900), 1, 'before the first anchor');
  assert.equal(eraDemandFactor(2100), 0.4, 'after the last anchor');
  assert.equal(eraDemandFactor(NaN), 1, 'an unusable year is neutral, not the late-game value');

  let previous = eraDemandFactor(1960);
  for (let year = 1961; year <= 2030; year++) {
    const factor = eraDemandFactor(year);
    assert.ok(factor <= previous, `${year}: the factor never rises`);
    previous = factor;
  }
});

test('demand is the formula it reports, with the difficulty and era factors in it', () => {
  // 1965 and 1990 in June carry no historical event, so eventMult is 1 for both.
  const at = (year: number, difficulty: string) => calculateDemand(8000, 12000, 7000, 9000, 3, 6, difficulty, year);

  const normal = at(1965, 'Normal');
  const v = normal.formulaVars;
  assert.equal(v.eraFactor, eraDemandFactor(1965));
  assert.equal(
    normal.total,
    Math.round(29.0 * Math.pow(v.totalInteraction, 0.448351) * v.S * v.E * v.eraFactor * v.tcDemandMultiplier * v.eventMult * v.extraDemandFactor)
  );

  // Same pair, same month: only the era differs.
  const later = at(1990, 'Normal');
  assert.equal(later.formulaVars.eventMult, normal.formulaVars.eventMult);
  assert.ok(Math.abs(later.total / normal.total - eraDemandFactor(1990) / eraDemandFactor(1965)) < 0.002);
});

test('the three difficulty levels are told apart by 0.9 : 1.1 : 0.75', () => {
  const at = (difficulty: string) => calculateDemand(8000, 12000, 7000, 9000, 3, 6, difficulty, 1965);
  const easy = at('Easy');
  const normal = at('Normal');
  const hard = at('Hard');

  assert.ok(easy.total > normal.total && normal.total > hard.total, 'easier means more demand');
  assert.equal(easy.formulaVars.S, 1.1);
  assert.equal(normal.formulaVars.S, 0.9);
  assert.equal(hard.formulaVars.S, 0.75);
  assert.ok(Math.abs(normal.total / easy.total - 0.9 / 1.1) < 0.001);
  assert.ok(Math.abs(hard.total / normal.total - 0.75 / 0.9) < 0.001);
});

test('a full aircraft sells out at the base fare and loses passengers above it, however large the demand', () => {
  const { aircraft, route, mgt } = sampleRoute(7);
  const run = (economy: number) => {
    const priced = { ...route, ticketPrices: { economy, business: 400 } };
    return calculateRouteFinancials(priced, aircraft, 1, mgt, 1990, 6, 'Normal', airportsMapAdjusted, [priced], [aircraft]);
  };

  // The satisfaction-adjusted base fare, derived the way the engine derives it.
  const probe = run(120);
  const bases = calculateBasePrices(probe.distance, probe.timeClass);
  const satBase = Math.round(bases.economy * getSatMultiplier(probe.routeSat.economy));

  const atBase = run(satBase);
  const seats = atBase.paxByClass.economy.max;
  assert.ok(atBase.demandData.economy > 2 * seats, 'the market is several times the seats, so only the cap can matter');
  assert.equal(atBase.paxByClass.economy.actual, seats, 'the base fare fills the cabin');

  // Above it, the passengers the cap used to hold back are gone. 3% is inside
  // the 5% premium the old margin of 1.2 allowed, so this fails on the old cap.
  const above = run(Math.round(satBase * 1.03));
  assert.ok(above.paxByClass.economy.actual < seats, 'a fare 3% over the base does not fill the cabin');
});

test('a route in its first months draws less demand than the same route once mature', () => {
  const { aircraft, route, mgt } = sampleRoute(40);
  const price = (maturity?: Record<string, number>) =>
    calculateRouteFinancials(route, aircraft, 1, mgt, 1970, 6, 'Normal', airportsMapAdjusted, [route], [aircraft], false, 1, [], { demandFactor: 1, maturity });
  const mature = price();
  const fresh = price({ [route.id]: 0.6 });
  const loyal = price({ [route.id]: 1.05 });
  assert.ok(fresh.paxPerWeek < mature.paxPerWeek, 'ramping up carries fewer passengers');
  assert.ok(loyal.paxPerWeek >= mature.paxPerWeek, 'loyalty never carries fewer');
  assert.equal(price({ other: 0.6 }).paxPerWeek, mature.paxPerWeek, 'another route\'s ramp-up does not matter');
});

// --- What the development tree takes off the costs -------------------------------

test('development projects make airport charges, catering and crews cheaper on the player\'s routes only', () => {
  const { aircraft, route, mgt } = sampleRoute(7);
  const price = (mods?: ReturnType<typeof buildPlayerModifiers>) =>
    calculateRouteFinancials(route, aircraft, 1, mgt, 1970, 6, 'Normal', airportsMapAdjusted, [route], [aircraft], false, mods?.demandFactor ?? 1, [], mods);
  const none = buildPlayerModifiers({ reputation: 50, eventChoices: {}, research: researchEffects([]) }, 100);
  const done = buildPlayerModifiers({
    reputation: 50, eventChoices: {},
    research: researchEffects(['fees-1', 'fees-2', 'catering-1', 'crew-1', 'crew-2'])
  }, 100);
  assert.equal(done.feeFactor, 0.98);
  assert.equal(done.cateringFactor, 0.98);
  assert.ok(Math.abs((done.crewCostFactor ?? 1) - 0.98) < 1e-12);
  assert.equal(none.feeFactor, undefined, 'nothing developed changes nothing');
  const a = price(none), b = price(done);
  assert.equal(a.paxPerWeek, b.paxPerWeek, 'costs only: the passengers are the same');
  assert.ok(b.costsBreakdown.landingFees < a.costsBreakdown.landingFees);
  assert.ok(b.costsBreakdown.paxFees < a.costsBreakdown.paxFees);
  assert.ok(b.costsBreakdown.catering < a.costsBreakdown.catering);
  assert.ok(b.costsBreakdown.crew < a.costsBreakdown.crew);
  assert.ok(Math.abs(b.costsBreakdown.landingFees / a.costsBreakdown.landingFees - 0.98) < 0.01);
  assert.ok(b.estWeeklyProfit > a.estWeeklyProfit);
  const rival = price(undefined);
  assert.equal(rival.costsBreakdown.landingFees, a.costsBreakdown.landingFees, 'without modifiers (the rivals) nothing changes');
});

test('a development bonus on resale and on maintenance reaches the fleet\'s books', () => {
  const plane = { basePrice: 50_000_000, conditionGeneral: 80, conditionInterior: 70, ageYears: 5 };
  const plain = getAircraftResaleValue(plane);
  assert.equal(getAircraftResaleValue({ ...plane, resaleBonus: 0 }), plain);
  const better = getAircraftResaleValue({ ...plane, resaleBonus: researchEffects(['resale-1', 'resale-2']).resaleBonus });
  assert.ok(Math.abs(better / plain - 1.025) < 0.001);
  const fleet = [{ registration: 'A', basePrice: 50_000_000, purchasedAt: 0, family: 'x', type: 'x' }];
  const cost = (factor: number) => fleetOwnershipCost(fleet, new Set(['A']), 120, factor).total;
  assert.ok(cost(0.96) < cost(1));
  assert.ok(cost(0.96) > cost(1) * 0.9, 'insurance is not part of the maintenance programme');
});
