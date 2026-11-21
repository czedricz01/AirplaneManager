/**
 * Regeltests Zeitplan (Paket 4.4, E51, W6): Umlaufzeit, Flüge je Tag, Slots je Ende, Auslastung.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BOARDING_MINUTES, MINUTES_PER_DAY, MINUTES_PER_WEEK, SCHEDULE_STEP_MINUTES, TURNAROUND_MINUTES } from './constants';
import { departuresAt } from './airportCosts';
import { blockMinutes } from './demand';
import { timetableLegMinutes, tripBlockMinutes, tripSlotsAt, tripsPerDay, turnaroundMinutes, weeklyUtilization } from './schedule';

describe('Zeitplan (4.4)', () => {
  it('Flugzeit im Fahrplan = blockMinutes (3.1), gerundet', () => {
    for (const [km, v] of [[150, 450], [800, 800], [6000, 900]] as const) {
      assert.equal(timetableLegMinutes(km, v), Math.round(blockMinutes(km, v)));
    }
  });

  it('Umlaufzeit: Bodenzeit + Hin + Wende + Rück + Bodenzeit, auf das Raster aufgerundet; Einweg ohne Wende und Rückflug', () => {
    assert.equal(turnaroundMinutes('Regional'), TURNAROUND_MINUTES.Regional);
    // 30 + 61 + 60 + 61 + 30 = 242 → 245
    assert.equal(tripBlockMinutes(61, 60), 245);
    assert.equal(tripBlockMinutes(61, 60, true), 125);
    assert.equal(tripBlockMinutes(0, 0, true), 2 * BOARDING_MINUTES);
    for (let leg = 0; leg < 200; leg += 7) assert.equal(tripBlockMinutes(leg, 90) % SCHEDULE_STEP_MINUTES, 0);
  });

  it('E51: Flüge je Tag aus der freien Zeit, die die übrigen Strecken lassen', () => {
    assert.equal(tripsPerDay(180, MINUTES_PER_DAY), 8);
    // Andere Strecken lassen 12 h frei: nur noch 4 (der Editor rechnete bisher mit dem ganzen Tag, W6).
    assert.equal(tripsPerDay(180, MINUTES_PER_DAY / 2), 4);
    assert.equal(tripsPerDay(180, 179), 0);
    // Mehr als ein ganzer Tag zählt nicht.
    assert.equal(tripsPerDay(180, 2 * MINUTES_PER_DAY), 8);
  });

  it('E51: ab einem halben Tag Umlaufzeit höchstens ein Umlauf je Tag', () => {
    assert.equal(tripsPerDay(MINUTES_PER_DAY / 2, MINUTES_PER_DAY), 1);
    assert.equal(tripsPerDay(MINUTES_PER_DAY / 2 - SCHEDULE_STEP_MINUTES, MINUTES_PER_DAY), 2);
    assert.throws(() => tripsPerDay(0, MINUTES_PER_DAY));
  });

  it('1.6: ein Slot je Abflug; Einweg nur am Start', () => {
    assert.equal(tripSlotsAt(true), 1);
    assert.equal(tripSlotsAt(false), 1);
    assert.equal(tripSlotsAt(true, true), 1);
    assert.equal(tripSlotsAt(false, true), 0);
  });

  it('1.6: 7 Umläufe belegen 7 Slots an jedem Ende, wie departuresAt', () => {
    const trips = 7;
    const routes = [{ origin: 'FRA', destination: 'CDG', weeklyFrequency: trips }];
    assert.equal(trips * tripSlotsAt(true), departuresAt(routes, 'FRA'));
    assert.equal(trips * tripSlotsAt(false), departuresAt(routes, 'CDG'));
  });

  it('Auslastung = Summe der Umlaufzeiten / Woche', () => {
    assert.equal(weeklyUtilization([]), 0);
    assert.equal(weeklyUtilization([MINUTES_PER_WEEK / 4, MINUTES_PER_WEEK / 4]), 0.5);
  });
});
