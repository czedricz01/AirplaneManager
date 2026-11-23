import test from 'node:test';
import assert from 'node:assert/strict';

// --- Who the rivals are ---------------------------------------------------

import { generateAiAirlines, pickRivalIdentities } from './aiSimulation';
import { REAL_AIRLINES, FICTIONAL_AIRLINES, isActiveIn } from '../data/rivalAirlines';
import { airportsMapAdjusted } from '../data/airportRegistry';

test('every real carrier in the list has a hub that exists in the game', () => {
  for (const a of REAL_AIRLINES) assert.ok(airportsMapAdjusted.has(a.hub), `${a.name}: unknown hub ${a.hub}`);
});

test('no two carriers ever fly under the same code at the same time', () => {
  for (const a of REAL_AIRLINES) {
    for (const b of REAL_AIRLINES) {
      if (a === b || a.code !== b.code) continue;
      const overlap = a.founded < (b.ceased ?? Infinity) && b.founded < (a.ceased ?? Infinity);
      assert.ok(!overlap, `${a.name} and ${b.name} share ${a.code} in overlapping years`);
    }
  }
  const realCodes = new Set(REAL_AIRLINES.map(a => a.code));
  for (const f of FICTIONAL_AIRLINES) assert.ok(!realCodes.has(f.code), `${f.name} uses a real code`);
  assert.equal(new Set(FICTIONAL_AIRLINES.map(f => f.code)).size, FICTIONAL_AIRLINES.length);
});

test('no rival ever starts at the player hub, and the carrier based there is left out', () => {
  // Frankfurt means no Lufthansa, London no BA/BOAC, New York no Pan Am.
  const cases: [string, string][] = [['FRA', 'LH'], ['LHR', 'BA'], ['JFK', 'PA'], ['CDG', 'AF'], ['ATL', 'DL'], ['DXB', 'EK']];
  for (const [hub, code] of cases) {
    for (const year of [1965, 1975, 1990, 2010]) {
      for (let i = 0; i < 20; i++) {
        const rivals = pickRivalIdentities(12, hub, year);
        assert.equal(rivals.length, 12);
        for (const r of rivals) assert.notEqual(r.hub, hub, `${r.name} starts at the player hub ${hub}`);
        assert.ok(!rivals.some(r => r.isReal && r.code === code), `${code} must not exist for a ${hub} player`);
      }
    }
  }
});

test('real carriers start at their real hub and only in years they flew', () => {
  for (const year of [1962, 1972, 1985, 1999, 2015]) {
    for (let i = 0; i < 10; i++) {
      for (const r of pickRivalIdentities(12, 'MUC', year).filter(x => x.isReal)) {
        const entry = REAL_AIRLINES.find(a => a.code === r.code && a.name === r.name);
        assert.ok(entry, `${r.name} is not in the list`);
        assert.equal(r.hub, entry!.hub, `${r.name} must start at ${entry!.hub}`);
        assert.ok(isActiveIn(entry!, year), `${r.name} did not fly in ${year}`);
      }
    }
  }
  // BOAC before 1974, British Airways from 1974 -- never both.
  const early = pickRivalIdentities(12, 'MUC', 1965);
  assert.ok(!early.some(r => r.name === 'British Airways' || r.name === 'Emirates'));
});

test('the field mixes real and fictional airlines, with unique hubs and codes', () => {
  for (let i = 0; i < 30; i++) {
    const rivals = pickRivalIdentities(8, 'FRA', 1990, 'XX');
    assert.ok(rivals.some(r => r.isReal), 'some rivals are real');
    assert.ok(rivals.some(r => !r.isReal), 'some rivals are fictional');
    assert.equal(new Set(rivals.map(r => r.hub)).size, rivals.length, 'one rival per hub');
    assert.equal(new Set(rivals.map(r => r.code)).size, rivals.length, 'one rival per code');
  }
  // The player's own code is never handed to a rival.
  for (let i = 0; i < 30; i++) {
    assert.ok(!pickRivalIdentities(12, 'MUC', 1990, 'LH').some(r => r.code === 'LH'));
  }
});

const offsetFor = (year: number) => (year - 1960) * 12;

test('a new rival founded in a running game takes no hub or code that is in use', () => {
  const existing = generateAiAirlines(6, 'Normal', 'FRA', offsetFor(1990));
  for (let n = 0; n < 5; n++) {
    const [fresh] = generateAiAirlines(1, 'Normal', 'FRA', offsetFor(1990), '', '#facc15', existing);
    if (!fresh) continue;
    assert.ok(!existing.some(e => e.code === fresh.code || e.hub === fresh.hub), `${fresh.code} at ${fresh.hub} clashes`);
    assert.ok(!existing.some(e => e.color === fresh.color), 'its own colour');
  }
});
