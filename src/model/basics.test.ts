/**
 * Regeltests zu SPEZIFIKATION Abschnitt 1 (Grundbegriffe und Einheiten).
 *
 * Muster: Jeder Test beginnt mit der Nummer des Abschnitts, aus dem die Regel stammt.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  COST_GROWTH,
  COST_INDEX_LAST_YEAR,
  DAYS_PER_YEAR,
  DIFFICULTY_FACTOR,
  LITRES_PER_GALLON,
  SCALES,
  START_YEAR,
  WEEKS_PER_MONTH,
  type Difficulty,
  type ScaleName,
} from './constants';
import { atCost, clamp, clampScale, costIndex, difficultyCostFactor, difficultyFactor, timeOf, yearOf } from './basics';

/** Spielmonat zu Kalenderjahr und Monat (0 = Januar). */
const monthAt = (year: number, monthOfYear = 0) => (year - START_YEAR) * 12 + monthOfYear;

/** Gleich bis auf Rundungsfehler der Gleitkommazahlen. */
function assertClose(actual: number, expected: number, tolerance = 1e-9, message?: string) {
  assert.ok(Math.abs(actual - expected) <= tolerance, message ?? `${actual} ≉ ${expected}`);
}

describe('Abschnitt 1.1 Zeit', () => {
  it('1.1: WEEKS_PER_MONTH = 365,25 / 12 / 7 ≈ 4,348', () => {
    assertClose(WEEKS_PER_MONTH, 365.25 / 12 / 7);
    assertClose(WEEKS_PER_MONTH, 4.348, 0.001);
  });

  it('1.1: Wochenwert × WEEKS_PER_MONTH × 12 = Wochenwert × 52,18 (eine Jahreslänge für Erlös und Kosten)', () => {
    const weekly = 1000;
    assertClose(weekly * WEEKS_PER_MONTH * 12, weekly * (DAYS_PER_YEAR / 7));
    assertClose(weekly * WEEKS_PER_MONTH * 12, weekly * 52.18, weekly * 0.005, '52,18 ist gerundet');
  });

  it('1.1: timeOf steigt mit jedem Monat um genau 1/12', () => {
    for (let month = 0; month < 12 * 200; month++) {
      assertClose(timeOf(month + 1) - timeOf(month), 1 / 12);
    }
    assert.equal(timeOf(0), 1960);
    assert.equal(timeOf(12), 1961);
  });

  it('1.1: yearOf = 1960 + abrunden(month / 12)', () => {
    assert.equal(yearOf(0), 1960);
    assert.equal(yearOf(11), 1960);
    assert.equal(yearOf(12), 1961);
    assert.equal(yearOf(monthAt(2020, 6)), 2020);
  });

  it('1.1: yearOf ist der ganze Teil von timeOf', () => {
    for (let month = 0; month < 12 * 100; month++) {
      assert.equal(yearOf(month), Math.floor(timeOf(month)));
    }
  });
});

describe('Abschnitt 1.2 Raum und Mengen', () => {
  it('1.2: 1 Gallone = 3,78541 Liter', () => {
    assert.equal(LITRES_PER_GALLON, 3.78541);
  });
});

describe('Abschnitt 1.3 Geld und Kostenindex', () => {
  it('1.3: costIndex(0) = 1', () => {
    assert.equal(costIndex(0), 1);
  });

  it('1.3: costIndex sinkt nie mit der Zeit', () => {
    let previous = costIndex(0);
    for (let month = 1; month <= monthAt(COST_INDEX_LAST_YEAR + 5); month++) {
      const current = costIndex(month);
      assert.ok(current >= previous, `Monat ${month}: ${current} < ${previous}`);
      previous = current;
    }
  });

  it('1.3: costIndex = (1 + COST_GROWTH) ^ (timeOf − 1960), stetig ohne Sprung am Jahreswechsel', () => {
    assertClose(costIndex(monthAt(2020)), Math.pow(1 + COST_GROWTH, 60));
    assertClose(costIndex(6), Math.pow(1 + COST_GROWTH, 0.5));
    const step = (month: number) => costIndex(month + 1) / costIndex(month);
    assertClose(step(monthAt(1999, 11)), step(monthAt(1999, 5)), 1e-12, 'Dezember → Januar wie jeder andere Monat');
  });

  it('1.3: Zeit begrenzt auf 1960 … 2100', () => {
    assert.equal(costIndex(-24), 1);
    assert.equal(costIndex(monthAt(COST_INDEX_LAST_YEAR + 10)), costIndex(monthAt(COST_INDEX_LAST_YEAR)));
  });

  it('1.3: atCost(Betrag, 0) = Betrag von 1960', () => {
    assert.equal(atCost(2500, 0), 2500);
  });

  it('1.3: Jeder feste Betrag im Jahr 2020 = Betrag 1960 × costIndex 2020', () => {
    const month2020 = monthAt(2020);
    for (const amount1960 of [1, 1500, 2500, 200_000, 3_000_000]) {
      assertClose(atCost(amount1960, month2020), amount1960 * costIndex(month2020), 1e-6);
    }
  });

  it('1.3: atCost ist proportional (doppelter Betrag → doppelter Wert, 0 bleibt 0)', () => {
    const month = monthAt(1985, 3);
    assertClose(atCost(2000, month), 2 * atCost(1000, month));
    assert.equal(atCost(0, month), 0);
  });
});

describe('Abschnitt 1.4 Skalen', () => {
  const expected: Record<ScaleName, [number, number]> = {
    satisfaction: [0, 160],
    routeSatisfaction: [0, 160],
    cabinRating: [0, 100],
    typeAppeal: [0, 100],
    servicePoints: [0, Number.POSITIVE_INFINITY],
    reputation: [0, 100],
    cabinCondition: [0, 100],
    airframeCondition: [0, 100],
    passengerShare: [0, 1],
    departureShare: [0, 1],
  };

  it('1.4: Jede Skala hat den Bereich aus der Tabelle', () => {
    assert.deepEqual(Object.keys(SCALES).sort(), Object.keys(expected).sort());
    for (const [name, [min, max]] of Object.entries(expected) as [ScaleName, [number, number]][]) {
      assert.equal(SCALES[name].min, min, `${name}.min`);
      assert.equal(SCALES[name].max, max, `${name}.max`);
    }
  });

  it('1.4: Neutralpunkte: Satisfaction 100, Reputation 50', () => {
    assert.equal(SCALES.satisfaction.neutral, 100);
    assert.equal(SCALES.routeSatisfaction.neutral, 100);
    assert.equal(SCALES.reputation.neutral, 50);
  });

  it('1.4: clampScale gibt nie einen Wert außerhalb des Bereichs zurück', () => {
    const probes = [-1e9, -1, -0.001, 0, 0.5, 1, 50, 99.9, 100, 100.1, 159.99, 160, 161, 1e9, Infinity, -Infinity];
    for (const name of Object.keys(SCALES) as ScaleName[]) {
      const { min, max } = SCALES[name];
      for (const value of probes) {
        const result = clampScale(name, value);
        assert.ok(result >= min && result <= max, `${name}(${value}) = ${result}`);
      }
    }
  });

  it('1.4: Kappen zweimal ändert nichts (Leser müssen nicht noch einmal kappen)', () => {
    for (const value of [-5, 42.7, 170]) {
      const once = clampScale('satisfaction', value);
      assert.equal(clampScale('satisfaction', once), once);
    }
  });

  it('1.4: clamp lässt NaN durch, damit die Prüfung aus 8.16 ungültige Werte findet', () => {
    assert.ok(Number.isNaN(clamp(Number.NaN, 0, 1)));
  });
});

describe('Abschnitt 1.7 Rundung', () => {
  it('1.7: Kappen rundet nicht: +0,3 Punkte bleiben erhalten', () => {
    assert.equal(clampScale('satisfaction', 100.3), 100.3);
    assert.notEqual(clampScale('satisfaction', 100.3), clampScale('satisfaction', 100));
  });

  it('1.7: Geld bleibt ungerundet', () => {
    const value = atCost(1, 7);
    assert.notEqual(value, Math.round(value));
  });
});

describe('Abschnitt 1.8 Schwierigkeit', () => {
  it('1.8: Normal = 1, Easy > 1, Hard < 1', () => {
    assert.equal(difficultyFactor('Normal'), 1);
    assert.ok(difficultyFactor('Easy') > 1);
    assert.ok(difficultyFactor('Hard') < 1);
  });

  it('1.8: Startwerte Easy 1,1 und Hard 0,9', () => {
    assert.equal(DIFFICULTY_FACTOR.Easy, 1.1);
    assert.equal(DIFFICULTY_FACTOR.Hard, 0.9);
  });

  it('1.8: Jede Schwierigkeit hat einen endlichen, positiven Faktor', () => {
    for (const difficulty of ['Easy', 'Normal', 'Hard'] as Difficulty[]) {
      const factor = difficultyFactor(difficulty);
      assert.ok(Number.isFinite(factor) && factor > 0, difficulty);
    }
  });

  it('E112: Kosten-Faktor Hard 1,05 bis Ende 1979, stetig zu 1,1 ab 1985; Easy und Normal fest', () => {
    const m = (year: number, month = 0) => (year - 1960) * 12 + month;
    assert.equal(difficultyCostFactor('Hard', m(1960)), 1.05);
    assert.equal(difficultyCostFactor('Hard', m(1979, 11)), 1.05);
    assert.ok(Math.abs(difficultyCostFactor('Hard', m(1982, 6)) - 1.075) < 1e-12);
    assert.equal(difficultyCostFactor('Hard', m(1985)), 1.1);
    assert.equal(difficultyCostFactor('Hard', m(2025)), 1.1);
    for (let x = m(1979); x < m(1986); x++) {
      const step = difficultyCostFactor('Hard', x + 1) - difficultyCostFactor('Hard', x);
      assert.ok(step >= 0 && step < 0.001, `kein Sprung in Monat ${x}`);
    }
    for (const x of [m(1960), m(1982), m(2025)]) {
      assert.equal(difficultyCostFactor('Normal', x), 1);
      assert.equal(difficultyCostFactor('Easy', x), 0.85);
    }
  });
});
