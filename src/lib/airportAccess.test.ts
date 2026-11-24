import test from 'node:test';
import assert from 'node:assert/strict';

import { isAirportOpen } from '../model/progress';
import { airportGate, airportStandings, maxAirportLevel, rankForLevel } from './airportAccess';
import { RANKS } from './airlineRank';

const ap = (id: string, level: number) => ({ id, name: `Port ${id}`, level });
const nobody = new Map();

test('airports up to level 4 are open from the start, each level after opens one rank later, level 7 at National', () => {
  const national = RANKS.findIndex(r => r.title === 'National Airline');
  assert.equal(maxAirportLevel(0), 4);
  assert.equal(maxAirportLevel(1), 5);
  assert.equal(maxAirportLevel(3), 6);
  assert.equal(maxAirportLevel(national - 1), 6, 'one rank below National there are no level 7 airports');
  assert.equal(maxAirportLevel(national), 7);
  assert.equal(rankForLevel(7), national);
  assert.equal(rankForLevel(4), 0);
  assert.equal(rankForLevel(1), 0);
  for (let r = 1; r < RANKS.length; r++) assert.ok(maxAirportLevel(r) >= maxAirportLevel(r - 1), 'never less than the rank before');
});

test('an airport above the rank is refused with both ranks named, and one at or below is open', () => {
  assert.equal(airportGate(ap('XYZ', 4), 0, nobody), null);
  const msg = airportGate(ap('ABC', 7), 1, nobody)!;
  assert.match(msg, /level 7/);
  assert.match(msg, /National Airline/);
  assert.match(msg, /Local Airline/);
  assert.equal(airportGate(ap('ABC', 7), 4, nobody), null);
  assert.equal(airportGate(null, 0, nobody), null);
});

test('what the airline already has stays open, whatever the rank', () => {
  const exempt = airportStandings('FRA', { CDG: { level: 1 }, MUC: { level: 0 } }, [{ origin: 'FRA', destination: 'JFK' }]);
  assert.deepEqual([...exempt.keys()].sort(), ['CDG', 'FRA', 'JFK']);
  assert.deepEqual(exempt.get('FRA'), { isHome: true, isRouteEnd: true });
  assert.deepEqual(exempt.get('CDG'), { managementTier: 1 });
  assert.equal(airportGate(ap('FRA', 7), 0, exempt), null, 'the home airport');
  assert.equal(airportGate(ap('JFK', 7), 0, exempt), null, 'flown to already');
  assert.notEqual(airportGate(ap('MUC', 7), 0, exempt), null, 'built-up needs level 1 at least');
});

test('the gate follows the model rule isAirportOpen for every rank, level and standing', () => {
  const standings = [undefined, { isHome: true }, { managementTier: 1 }, { managementTier: 0 }, { isRouteEnd: true }];
  for (let rank = 0; rank < RANKS.length; rank++) {
    for (let level = 1; level <= 7; level++) {
      for (const st of standings) {
        const map = new Map(st ? [['X', st]] : []);
        assert.equal(airportGate(ap('X', level), rank, map) === null, isAirportOpen(rank, level, st), `rank ${rank}, level ${level}`);
      }
    }
  }
});
