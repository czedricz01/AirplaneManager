import test from 'node:test';
import assert from 'node:assert/strict';

import { airportGate, exemptAirports, lockedSummary, maxAirportLevel, rankForLevel } from './airportAccess';
import { RANKS } from './airlineRank';
import { airports } from '../data/airportRegistry';

const ap = (id: string, level: number) => ({ id, name: `Port ${id}`, level });
const nobody = new Set<string>();

test('the levels open one rank after another and the great hubs open at National', () => {
  const national = RANKS.findIndex(r => r.id === 'national');
  assert.equal(maxAirportLevel(0), 3);
  assert.equal(maxAirportLevel(1), 4);
  assert.equal(maxAirportLevel(3), 5);
  assert.equal(maxAirportLevel(national - 1), 5, 'one rank below National there are no level 6 or 7 airports');
  assert.equal(maxAirportLevel(national), 7);
  assert.equal(rankForLevel(6), national);
  assert.equal(rankForLevel(7), national);
  assert.equal(rankForLevel(1), 0);
  for (let r = 1; r < RANKS.length; r++) assert.ok(maxAirportLevel(r) >= maxAirportLevel(r - 1), 'never less than the rank before');
});

test('an airport above the rank is refused with both ranks named, and one at or below is open', () => {
  assert.equal(airportGate(ap('XYZ', 3), 0, nobody), null);
  const msg = airportGate(ap('ABC', 7), 1, nobody)!;
  assert.match(msg, /level 7/);
  assert.match(msg, /National Airline/);
  assert.match(msg, /Local Airline/);
  assert.equal(airportGate(ap('ABC', 7), 4, nobody), null);
  assert.equal(airportGate(null, 0, nobody), null);
});

test('what the airline already has stays open, whatever the rank', () => {
  const exempt = exemptAirports('FRA', { CDG: { level: 1 }, MUC: { level: 0 } }, [{ origin: 'FRA', destination: 'JFK' }]);
  assert.deepEqual([...exempt].sort(), ['CDG', 'FRA', 'JFK']);
  assert.equal(airportGate(ap('FRA', 7), 0, exempt), null, 'the home airport');
  assert.equal(airportGate(ap('JFK', 7), 0, exempt), null, 'flown to already');
  assert.notEqual(airportGate(ap('MUC', 6), 0, exempt), null, 'built-up needs level 1 at least');
});

test('real airports: a startup is shut out of every level 6 and 7 airport and not of the rest', () => {
  const locked = lockedSummary(airports, 0, nobody);
  const bigOnes = airports.filter(a => a.level >= 6).length;
  const fourOnes = airports.filter(a => a.level === 4 || a.level === 5).length;
  assert.equal(locked.count, bigOnes + fourOnes);
  assert.equal(locked.opensAt, 1, 'level 4 opens at the next rank');
  assert.equal(lockedSummary(airports, 4, nobody).count, 0);
  assert.ok(bigOnes >= 30, 'the great hubs exist');
  assert.equal(lockedSummary(airports, 3, nobody).opensAt, 4);
});
