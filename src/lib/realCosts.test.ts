import test from 'node:test';
import assert from 'node:assert/strict';

import { REAL_COST_GROWTH, realCostIndex } from './realCosts';
import { calculateRouteFinancials, getAirportUpkeep, getFlightDurationMinutes } from './financeUtils';
import { airportsMapAdjusted } from '../data/airportRegistry';
import { aircraftList } from '../data/aircraft';

test('the index is 1 in 1960 and grows 1.2% a year, about double by 2020', () => {
  assert.equal(realCostIndex(1960), 1);
  assert.ok(Math.abs(realCostIndex(1961) - (1 + REAL_COST_GROWTH)) < 1e-12);
  assert.ok(realCostIndex(2020) > 2 && realCostIndex(2020) < 2.1);
  assert.equal(realCostIndex(1900), 1, 'before the game starts');
  assert.equal(realCostIndex(NaN), 1);
});

function route() {
  const spec = aircraftList.find(a => a.id === '737-200')!;
  const aircraft: any = {
    ...spec, registration: 'T-RC', purchasedAt: 0, conditionInterior: 90, conditionGeneral: 90, baseInteriorPop: 60,
    config: { economy: 120, premium: 0, business: 0, first: 0, details: {} }
  };
  const o = airportsMapAdjusted.get('FRA')!, d = airportsMapAdjusted.get('CDG')!;
  const durMin = getFlightDurationMinutes(o, d, aircraft);
  const r: any = {
    id: 'r', origin: 'FRA', destination: 'CDG', aircraft: 'T-RC', distance: 450, durMin,
    schedule: Array.from({ length: 14 }, (_, i) => ({ dayId: (i % 7) + 1, startHour: 8, startMin: 0, durMin, turnoverMin: 60 })),
    classConfigs: { economy: { catering: [['b1']], extras: ['none'], service: ['none'] } }, ticketPrices: { economy: 100 }
  };
  const infra = { level: 2, slots: { regional: 0, narrowbody: 50, widebody: 0 }, stands: { narrowbody: 0 }, desks: { normal: 2, self: 0 } };
  return { r, aircraft, mgt: { FRA: infra, CDG: infra } };
}

test('crew, landing and passenger fees cost more in a later year; fuel does not', () => {
  const { r, aircraft, mgt } = route();
  const at = (year: number) => calculateRouteFinancials(r, aircraft, 1, mgt, year, 6, 'Normal', airportsMapAdjusted, [r], [aircraft], true);
  const early = at(1962), late = at(2002);
  const f = realCostIndex(2002) / realCostIndex(1962);
  assert.ok(late.costsBreakdown.crew > early.costsBreakdown.crew * f * 0.98 && late.costsBreakdown.crew < early.costsBreakdown.crew * f * 1.02);
  assert.ok(late.costsBreakdown.landingFees > early.costsBreakdown.landingFees * f * 0.98);
  assert.ok(late.costsBreakdown.paxFees > early.costsBreakdown.paxFees);
  assert.equal(late.costsBreakdown.fuel, early.costsBreakdown.fuel, 'the fuel price follows its own list');
});

test('airport upkeep follows the index when a year is given and is the 1960 figure when it is not', () => {
  const airport: any = { id: 'FRA', level: 4 };
  const infra = { level: 2, slots: { regional: 0, narrowbody: 100, widebody: 0 }, stands: {}, desks: { normal: 10, self: 0 }, hubFacilities: { hangar: true } };
  const base = getAirportUpkeep(airport, infra, [], []);
  const later = getAirportUpkeep(airport, infra, [], [], 2000);
  assert.equal(getAirportUpkeep(airport, infra, [], [], 1960).total, base.total);
  assert.ok(later.total > base.total * 1.55 && later.total < base.total * 1.7);
});
