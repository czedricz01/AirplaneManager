import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MORALE_INERTIA,
  SALARY_PCT_MAX,
  SALARY_PCT_MIN,
  STRIKE_FULL_CANCEL_SHARE,
  STRIKE_SETTLED_CANCEL_SHARE,
  advanceStaff,
  crewCostFactor,
  isStrikeActive,
  moraleSatDelta,
  settleStrikeWithPayRise,
  staffOutlook,
  stepMorale,
  strikeCancelShare,
  strikeChance,
  strikeIsRecent,
  targetMorale
} from './staff';
import { buildPlayerModifiers, combineCancelShares, routeCancelShare, DEFAULT_STAFF, type Staff } from './gameState';
import { calculateRouteFinancials, getFlightDurationMinutes } from './financeUtils';
import { airportsMapAdjusted } from '../data/airportRegistry';
import { calculateDistance } from '../data/airports';
import { aircraftList } from '../data/aircraft';

/** Small deterministic PRNG, so a test run can be repeated exactly. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const staffAt = (morale: number, salaryPct = 100, strike: Staff['strike'] = null): Staff => ({ salaryPct, morale, strike });

test('target morale follows pay, a profit streak and a recent strike', () => {
  assert.equal(targetMorale(100, 0, false), 50, 'market pay');
  assert.equal(targetMorale(80, 0, false), 20);
  assert.equal(targetMorale(130, 0, false), 95);
  assert.equal(targetMorale(100, 6, false), 50, 'six months is not yet a long streak');
  assert.equal(targetMorale(100, 7, false), 55);
  assert.equal(targetMorale(100, 0, true), 40);
  assert.equal(targetMorale(80, 0, true), 10);
  assert.equal(targetMorale(500, 0, false), 95, 'pay is clamped to the range first');

  const strike = { startOffset: 10, cancelShare: 1 };
  assert.equal(strikeIsRecent(strike, 9), false, 'not before it');
  assert.equal(strikeIsRecent(strike, 10), true);
  assert.equal(strikeIsRecent(strike, 16), true, 'six months after');
  assert.equal(strikeIsRecent(strike, 17), false);
  assert.equal(strikeIsRecent(null, 10), false);
});

test('morale moves a fifth of the way to its target each month', () => {
  assert.equal(stepMorale(70, 50), 66);
  assert.equal(stepMorale(20, 95), 35);
  assert.equal(stepMorale(50, 50), 50);

  // Twelve months at 80% pay from the default 70: most of the way down, not all.
  let morale = DEFAULT_STAFF.morale;
  for (let i = 0; i < 12; i++) morale = stepMorale(morale, targetMorale(80, 0, false));
  const expected = 20 + (70 - 20) * Math.pow(1 - MORALE_INERTIA, 12);
  assert.ok(Math.abs(morale - expected) < 1e-9, `${morale}`);
  assert.ok(morale > 23 && morale < 25);
});

test('morale moves satisfaction by about four points either way, pay moves crew cost', () => {
  assert.equal(moraleSatDelta(60), 0);
  assert.equal(moraleSatDelta(100), 4);
  assert.equal(moraleSatDelta(0), -6);
  assert.equal(moraleSatDelta(50), -1, 'market pay settles slightly below neutral');
  assert.equal(moraleSatDelta(-20), -6, 'clamped');

  assert.equal(crewCostFactor(100), 1);
  assert.equal(crewCostFactor(SALARY_PCT_MIN), 0.8);
  assert.equal(crewCostFactor(SALARY_PCT_MAX), 1.3);
  assert.equal(crewCostFactor(200), 1.3);
  assert.equal(crewCostFactor(Number.NaN), 1);
});

test('the strike chance starts below morale 35 and grows 0.6% a point', () => {
  assert.equal(strikeChance(70), 0);
  assert.equal(strikeChance(35), 0);
  assert.ok(Math.abs(strikeChance(34) - 0.006) < 1e-12);
  assert.ok(Math.abs(strikeChance(20) - 0.09) < 1e-12);
  assert.ok(Math.abs(strikeChance(0) - 0.21) < 1e-12);
});

test('a month close is deterministic for a given generator and never calls a strike on content staff', () => {
  const run = (seed: number, start: Staff) => {
    const rng = seeded(seed);
    let staff = start;
    const strikes: number[] = [];
    for (let offset = 0; offset < 240; offset++) {
      const r = advanceStaff(staff, { profitStreak: 0, nextOffset: offset + 1 }, rng);
      staff = r.staff;
      if (r.strikeCalled) {
        strikes.push(offset + 1);
        assert.equal(r.staff.strike?.cancelShare, STRIKE_FULL_CANCEL_SHARE, 'called at full strength');
      }
    }
    return strikes;
  };

  const underpaid = staffAt(20, 80);
  assert.deepEqual(run(7, underpaid), run(7, underpaid), 'same seed, same history');
  assert.ok(run(7, underpaid).length > 0, 'twenty years at 80% pay sees strikes');
  assert.deepEqual(run(7, staffAt(70, 100)), [], 'market pay: morale settles at 50 and never strikes');

  // Never two in a row: the month after a strike is always strike-free.
  const strikes = run(3, underpaid);
  for (let i = 1; i < strikes.length; i++) assert.ok(strikes[i] - strikes[i - 1] >= 2, `${strikes}`);
});

test('no strike is called while one is running or waiting for an answer', () => {
  const always = () => 0;
  const miserable = staffAt(0, 80);
  assert.equal(advanceStaff(miserable, { profitStreak: 0, nextOffset: 5 }, always).strikeCalled, true);
  assert.equal(advanceStaff(miserable, { profitStreak: 0, nextOffset: 5, strikePending: true }, always).strikeCalled, false);
  assert.equal(advanceStaff(miserable, { profitStreak: 0, nextOffset: 5, noRoutes: true }, always).strikeCalled, false, 'nothing to strike against');

  const striking = staffAt(0, 80, { startOffset: 4, cancelShare: 1 });
  assert.equal(advanceStaff(striking, { profitStreak: 0, nextOffset: 5 }, always).strikeCalled, false, 'the one ending now');
  const called = staffAt(0, 80, { startOffset: 5, cancelShare: 1 });
  assert.equal(advanceStaff(called, { profitStreak: 0, nextOffset: 5 }, always).strikeCalled, false, 'the one already called');
  const past = staffAt(0, 80, { startOffset: 3, cancelShare: 1 });
  const again = advanceStaff(past, { profitStreak: 0, nextOffset: 5 }, always);
  assert.equal(again.strikeCalled, true, 'one month clear of the last');
  assert.deepEqual(again.staff.strike, { startOffset: 5, cancelShare: 1 });

  // The generator is not touched when no strike is possible.
  let draws = 0;
  advanceStaff(staffAt(70), { profitStreak: 0, nextOffset: 5 }, () => { draws++; return 0; });
  assert.equal(draws, 0);
});

test('raising pay halves the strike and lifts pay by ten points, capped', () => {
  const striking = staffAt(20, 85, { startOffset: 12, cancelShare: 1 });
  const settled = settleStrikeWithPayRise(striking, 12);
  assert.equal(settled.salaryPct, 95);
  assert.equal(settled.strike?.cancelShare, STRIKE_SETTLED_CANCEL_SHARE);
  assert.equal(striking.salaryPct, 85, 'the input is not modified');

  assert.equal(settleStrikeWithPayRise(staffAt(20, 125, { startOffset: 12, cancelShare: 1 }), 12).salaryPct, SALARY_PCT_MAX);
  assert.equal(settleStrikeWithPayRise(striking, 11), striking, 'an answer to an older strike changes nothing');
});

test('a strike grounds every route through the modifiers, in its own month only', () => {
  const staff = staffAt(30, 90, { startOffset: 20, cancelShare: 0.5 });
  assert.equal(isStrikeActive(staff, 20), true);
  assert.equal(strikeCancelShare(staff, 21), 0);

  const during = buildPlayerModifiers({ reputation: 50, eventChoices: {}, staff }, 20);
  assert.equal(during.cancelShareAll, 0.5);
  assert.equal(routeCancelShare(during, 'any-route'), 0.5, 'a route drafted during the strike too');
  assert.equal(during.crewCostFactor, 0.9);
  assert.equal(during.satDelta, -3);

  const after = buildPlayerModifiers({ reputation: 50, eventChoices: {}, staff }, 21);
  assert.equal(after.cancelShareAll, undefined);

  // With a route's own cancellations, the causes combine rather than add up.
  const both = { ...during, cancelShare: { r1: 0.5 } };
  assert.equal(routeCancelShare(both, 'r1'), 0.75);
  assert.equal(combineCancelShares(0.25, 0.25), 0.4375);
  assert.equal(combineCancelShares(), 0);
  assert.equal(combineCancelShares(1, 0.3), 1);

  // Neutral staff add nothing at all: market pay at morale 60.
  const neutral = buildPlayerModifiers({ reputation: 50, eventChoices: {}, staff: staffAt(60) }, 20);
  assert.deepEqual(neutral, buildPlayerModifiers({ reputation: 50, eventChoices: {} }, 20));
});

test('the engine flies what a strike leaves and pays the crew what the slider says', () => {
  const spec = aircraftList.find(a => a.id === '737-100')!;
  const aircraft = {
    ...spec, registration: 'T-STF', purchasedAt: 0, conditionInterior: 90, conditionGeneral: 90, baseInteriorPop: 60,
    config: { economy: 80, premium: 0, business: 20, first: 0, details: {} }
  };
  const o = airportsMapAdjusted.get('FRA')!;
  const d = airportsMapAdjusted.get('LHR')!;
  const durMin = getFlightDurationMinutes(o, d, aircraft);
  const route = {
    id: 'FRA-LHR', origin: 'FRA', destination: 'LHR', aircraft: 'T-STF',
    distance: Math.round(calculateDistance(o.coords[0], o.coords[1], d.coords[0], d.coords[1])), durMin,
    schedule: Array.from({ length: 7 }, (_, i) => ({ dayId: i + 1, startHour: 8, startMin: 0, durMin, turnoverMin: 60 })),
    classConfigs: { economy: { catering: [['b5']], extras: ['none'], service: ['none'] } }
  };
  const price = (staff: Staff) => {
    const mods = buildPlayerModifiers({ reputation: 50, eventChoices: {}, staff }, 180);
    return calculateRouteFinancials(route, aircraft, 1.2, {}, 1975, 1, 'Normal', airportsMapAdjusted, [route], [aircraft], false, mods.demandFactor, [], mods);
  };

  const normal = price(staffAt(60));
  const sitOut = price(staffAt(60, 100, { startOffset: 180, cancelShare: 1 }));
  assert.equal(sitOut.paxPerWeek, 0, 'nothing flies');
  assert.equal(sitOut.estWeeklyRev, 0);
  assert.equal(sitOut.costsBreakdown.fuel, 0);

  const halved = price(staffAt(60, 100, { startOffset: 180, cancelShare: 0.5 }));
  assert.ok(Math.abs(halved.costsBreakdown.fuel / normal.costsBreakdown.fuel - 0.5) < 1e-9);

  const generous = price(staffAt(60, 120));
  assert.ok(Math.abs(generous.costsBreakdown.crew / normal.costsBreakdown.crew - 1.2) < 1e-9);
});

test('the outlook shows what the coming close will do at today\'s pay', () => {
  const outlook = staffOutlook(staffAt(40, 80), 0, 100);
  assert.equal(outlook.target, 20);
  assert.equal(outlook.nextMorale, 36);
  assert.equal(outlook.strikeChance, 0);
  const worse = staffOutlook(staffAt(30, 80), 0, 100);
  assert.equal(worse.nextMorale, 28);
  assert.ok(Math.abs(worse.strikeChance - 0.042) < 1e-12);
  assert.equal(staffOutlook(staffAt(30, 80), 0, 100, true).strikeChance, 0, 'none while one waits for an answer');
});
