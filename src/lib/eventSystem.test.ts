import test from 'node:test';
import assert from 'node:assert/strict';

import {
  eventRegionLabel, eventScope, getEventMultipliers, historicalEvents, regionalDemandFactor, setRuntimeRandomEvents,
  type HistoricalEvent
} from './eventSystem';
import { calculateRouteFinancials, getFlightDurationMinutes } from './financeUtils';
import { airportsMapAdjusted } from '../data/airportRegistry';
import { aircraftList } from '../data/aircraft';

const offsetOf = (year: number, month: number) => (year - 1960) * 12 + (month - 1);

test('regional events carry their regions and leave fuel alone', () => {
  const regional = historicalEvents.filter(e => e.regions && e.regions.length > 0);
  assert.ok(regional.length >= 8);
  for (const e of regional) {
    assert.equal(e.fuelMultiplier, 1, e.title);
    assert.ok(e.duration >= 1 && e.demandMultiplier > 0, e.title);
  }
  // Both kinds of weather are there: crises and booms.
  assert.ok(regional.some(e => e.demandMultiplier < 1) && regional.some(e => e.demandMultiplier > 1));
});

test('a regional event is not part of the world-wide demand figure', () => {
  const sars = historicalEvents.find(e => e.title === 'SARS Outbreak')!;
  assert.equal(getEventMultipliers(sars.startOffset).demandMult, 1);
  // World events are as before.
  assert.equal(getEventMultipliers(offsetOf(2020, 6)).demandMult, 0.2);
});

test('a route inside the region feels the event fully, one end in it half, none at all in it nothing', () => {
  const ash = historicalEvents.find(e => e.title.startsWith('Eyjafjalla'))!;
  const at = ash.startOffset;
  assert.equal(regionalDemandFactor(at, 'EU', 'EU'), ash.demandMultiplier);
  assert.ok(Math.abs(regionalDemandFactor(at, 'EU', 'NA') - (1 + ash.demandMultiplier) / 2) < 1e-12);
  assert.equal(regionalDemandFactor(at, 'NA', 'AS'), 1);
  assert.equal(regionalDemandFactor(at - 12, 'EU', 'EU'), 1, 'a year before');
});

test('regions read as words', () => {
  assert.equal(eventRegionLabel({ regions: ['EU'] }), 'Europe');
  assert.equal(eventRegionLabel({ regions: ['AS', 'OC'] }), 'Asia and Oceania');
  assert.equal(eventScope({ regions: ['AF'] }), ' in Africa');
  assert.equal(eventScope({}), '');
  assert.equal(eventRegionLabel({ regions: ['EU', 'AS', 'OC'] }), 'Europe, Asia and Oceania');
});

function pax(origin: string, dest: string, year: number, month: number) {
  const spec = aircraftList.find(a => a.id === '737-200')!;
  const aircraft: any = {
    ...spec, registration: 'T-EV', purchasedAt: 0, conditionInterior: 90, conditionGeneral: 90, baseInteriorPop: 60,
    config: { economy: 150, premium: 0, business: 0, first: 0, details: {} }
  };
  const o = airportsMapAdjusted.get(origin)!, d = airportsMapAdjusted.get(dest)!;
  const durMin = getFlightDurationMinutes(o, d, aircraft);
  const route: any = {
    id: 'r', origin, destination: dest, aircraft: 'T-EV', distance: 800, durMin,
    schedule: Array.from({ length: 70 }, (_, i) => ({ dayId: (i % 7) + 1, startHour: 8, startMin: 0, durMin, turnoverMin: 60 })),
    classConfigs: { economy: { catering: [['b1']], extras: ['none'], service: ['none'] } }, ticketPrices: { economy: 90 }
  };
  const infra = { level: 2, slots: { regional: 0, narrowbody: 500, widebody: 0 }, stands: {}, desks: { normal: 20, self: 0 } };
  return calculateRouteFinancials(route, aircraft, 1, { [origin]: infra, [dest]: infra }, year, month, 'Normal', airportsMapAdjusted, [route], [aircraft]).paxPerWeek;
}

test('the finance engine applies a regional event to the routes it touches only', () => {
  const event: HistoricalEvent = {
    startOffset: offsetOf(1985, 3), duration: 3, title: 'Test Closure', description: '',
    demandMultiplier: 0.5, fuelMultiplier: 1, regions: ['EU']
  };
  const before = { inside: pax('FRA', 'CDG', 1985, 4), across: pax('FRA', 'JFK', 1985, 4), outside: pax('JFK', 'ORD', 1985, 4) };
  setRuntimeRandomEvents([event]);
  try {
    const during = { inside: pax('FRA', 'CDG', 1985, 4), across: pax('FRA', 'JFK', 1985, 4), outside: pax('JFK', 'ORD', 1985, 4) };
    assert.ok(during.inside < before.inside * 0.7, `inside: ${during.inside} vs ${before.inside}`);
    assert.ok(during.across < before.across && during.across > during.across * 0.5, 'across: hit by half');
    assert.equal(during.outside, before.outside);
  } finally {
    setRuntimeRandomEvents([]);
  }
});
